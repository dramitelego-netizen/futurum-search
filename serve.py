#!/usr/bin/env python3
"""Локальный сервер + прокси картинок с parapa.ru (обход bp_chl) + избранное."""

from __future__ import annotations

import http.cookiejar
import json
import re
import ssl
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
FAVS_DIR = ROOT / "data" / "user_favs"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
JAR = http.cookiejar.CookieJar()
CTX = ssl.create_default_context()
UID_RE = re.compile(r"^[a-zA-Z0-9_-]{8,64}$")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


OPENER_NR = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(JAR),
    NoRedirect,
    urllib.request.HTTPSHandler(context=CTX),
)
OPENER = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(JAR),
    urllib.request.HTTPSHandler(context=CTX),
)


def fetch_bytes(url: str) -> tuple[bytes, str]:
    headers = {"User-Agent": UA, "Referer": "https://parapa.ru/mall/"}
    req = urllib.request.Request(url, headers=headers)
    try:
        with OPENER_NR.open(req, timeout=45) as resp:
            ctype = resp.headers.get("Content-Type", "application/octet-stream")
            return resp.read(), ctype
    except urllib.error.HTTPError as err:
        if err.code in (301, 302, 303, 307, 308):
            err.read()
            with OPENER.open(urllib.request.Request(url, headers=headers), timeout=45) as resp:
                ctype = resp.headers.get("Content-Type", "application/octet-stream")
                return resp.read(), ctype
        raise


def fav_path(uid: str) -> Path | None:
    if not UID_RE.match(uid or ""):
        return None
    FAVS_DIR.mkdir(parents=True, exist_ok=True)
    return FAVS_DIR / f"{uid}.json"


def normalize_ids(raw) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    if not isinstance(raw, list):
        return out
    for x in raw:
        try:
            n = int(x)
        except (TypeError, ValueError):
            continue
        if n in seen:
            continue
        seen.add(n)
        out.append(n)
        if len(out) >= 2000:
            break
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        elif path.startswith("/data/img/"):
            self.send_header("Cache-Control", "public, max-age=604800, immutable")
        super().end_headers()

    def do_OPTIONS(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        self.send_error(404)

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/proxy":
            return self.proxy_image(parsed.query)
        if parsed.path == "/api/favs":
            return self.api_favs_get(parsed.query)
        return super().do_GET()

    def do_POST(self):  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/favs":
            return self.api_favs_post()
        self.send_error(404)

    def _json(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def api_favs_get(self, query: str) -> None:
        qs = parse_qs(query)
        uid = (qs.get("uid") or [""])[0]
        path = fav_path(uid)
        if not path:
            return self._json(400, {"error": "bad uid", "ids": []})
        if not path.exists():
            return self._json(200, {"uid": uid, "ids": []})
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            ids = normalize_ids(data.get("ids"))
        except Exception:
            ids = []
        return self._json(200, {"uid": uid, "ids": ids})

    def api_favs_post(self) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 200_000:
            return self._json(400, {"error": "bad body"})
        try:
            body = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "bad json"})
        uid = str(body.get("uid") or "")
        path = fav_path(uid)
        if not path:
            return self._json(400, {"error": "bad uid"})
        ids = normalize_ids(body.get("ids"))
        path.write_text(
            json.dumps({"uid": uid, "ids": ids}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return self._json(200, {"ok": True, "uid": uid, "count": len(ids)})

    def proxy_image(self, query: str) -> None:
        qs = parse_qs(query)
        raw = qs.get("u", [""])[0]
        url = unquote(raw)
        if not url.startswith("https://parapa.ru/") and not url.startswith(
            "http://parapa.ru/"
        ):
            self.send_error(400, "bad url")
            return
        try:
            data, ctype = fetch_bytes(url)
            if "text/html" in ctype and not re.search(rb"\x89PNG|JFIF|GIF8|RIFF", data[:16]):
                # challenge html — retry once via opener
                data, ctype = fetch_bytes(url)
            self.send_response(200)
            self.send_header("Content-Type", ctype.split(";")[0] or "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=86400")
            self.end_headers()
            self.wfile.write(data)
        except Exception as err:  # noqa: BLE001
            self.send_error(502, str(err))

    def log_message(self, fmt: str, *args) -> None:
        msg = args[0] if args else ""
        if "/proxy?" in msg or "/api/favs" in msg:
            return
        super().log_message(fmt, *args)


def main() -> None:
    port = 8080
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"FUTURUM: http://127.0.0.1:{port}/", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Докачать скрины титулов по imageUrl из titles.json (ретраи, unicode URL)."""

from __future__ import annotations

import http.cookiejar
import json
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data"
IMG = OUT / "title_img"
TITLES = OUT / "titles.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
RETRIES = 4
PROXY = "http://127.0.0.1:8080/proxy?u="


def ok_png(b: bytes) -> bool:
    return len(b) > 200 and b.startswith(b"\x89PNG\r\n\x1a\n") and b[-8:] == b"IEND\xaeB`\x82"


def encode_url(url: str) -> str:
    """Кодирует path (кириллица в имени файла), query не трогаем."""
    p = urllib.parse.urlsplit(url)
    # каждый сегмент path отдельно
    parts = []
    for seg in p.path.split("/"):
        if not seg:
            parts.append("")
            continue
        parts.append(urllib.parse.quote(seg, safe="._-~"))
    path = "/".join(parts)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, path, p.query, p.fragment))


def alt_hosts(url: str) -> list[str]:
    out = [encode_url(url)]
    if "://parapa.ru/" in url:
        out.append(encode_url(url.replace("://parapa.ru/", "://www.parapa.ru/", 1)))
    elif "://www.parapa.ru/" in url:
        out.append(encode_url(url.replace("://www.parapa.ru/", "://parapa.ru/", 1)))
    # локальный прокси (serve.py), если жив
    for u in list(out):
        out.append(PROXY + urllib.parse.quote(u, safe=""))
    # уникальные с сохранением порядка
    seen = set()
    uniq = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def fetch(op: urllib.request.OpenerDirector, url: str) -> bytes:
    last_err: Exception | None = None
    for attempt, candidate in enumerate(alt_hosts(url)):
        for try_i in range(RETRIES):
            try:
                req = urllib.request.Request(
                    candidate,
                    headers={
                        "User-Agent": UA,
                        "Referer": "https://www.parapa.ru/wiki/index.php/%D0%A2%D0%B8%D1%82%D1%83%D0%BB",
                        "Accept": "image/png,image/*;q=0.8,*/*;q=0.5",
                        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
                    },
                )
                with op.open(req, timeout=120) as resp:
                    raw = resp.read()
                if ok_png(raw):
                    return raw
                last_err = RuntimeError(f"bad png {len(raw)} via {candidate[:80]}")
            except Exception as e:
                last_err = e
                time.sleep(0.35 + try_i * 0.45)
        # небольшая пауза между хостами
        time.sleep(0.2)
    raise last_err or RuntimeError("fetch failed")


def main() -> int:
    try:
        from scrape_by_id import COOKIE_FILE, warmup

        print("warmup…", flush=True)
        warmup()
        ck = Path(COOKIE_FILE)
    except Exception as e:
        print("warmup skip:", e, flush=True)
        ck = OUT / "cookies.txt"

    jar = http.cookiejar.MozillaCookieJar(str(ck))
    try:
        jar.load(ignore_discard=True, ignore_expires=True)
    except Exception:
        jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )

    data = json.loads(TITLES.read_text(encoding="utf-8"))
    IMG.mkdir(parents=True, exist_ok=True)

    jobs = []
    seen = set()
    for it in data["items"]:
        url = it.get("imageUrl") or ""
        if not url:
            continue
        fname = Path(urllib.parse.unquote(url)).name.split("?")[0]
        if not fname or fname in seen:
            continue
        seen.add(fname)
        path = IMG / fname
        if path.exists() and ok_png(path.read_bytes()):
            it["image"] = f"data/title_img/{fname}"
            continue
        jobs.append((it, url, fname, path))

    print(f"need {len(jobs)}", flush=True)
    ok = fail = 0
    for i, (it, url, fname, path) in enumerate(jobs, 1):
        try:
            raw = fetch(op, url)
            # безопасное имя файла на диске (кириллица ок на NTFS)
            path.write_bytes(raw)
            it["image"] = f"data/title_img/{fname}"
            ok += 1
        except Exception as e:
            fail += 1
            print(f"  err {fname}: {e}", flush=True)
        if i % 20 == 0 or i == len(jobs):
            print(f"progress {i}/{len(jobs)} ok={ok} fail={fail}", flush=True)
            data["imagesMapped"] = sum(1 for x in data["items"] if x.get("image"))
            data["imagesDownloaded"] = sum(
                1
                for x in data["items"]
                if x.get("image") and (ROOT / x["image"]).exists()
            )
            TITLES.write_text(
                json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
            )
            time.sleep(0.2)
        else:
            time.sleep(0.1)

    data["imagesMapped"] = sum(1 for x in data["items"] if x.get("image"))
    data["imagesDownloaded"] = sum(
        1 for x in data["items"] if x.get("image") and (ROOT / x["image"]).exists()
    )
    TITLES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("done mapped=", data["imagesMapped"], "downloaded=", data["imagesDownloaded"], flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

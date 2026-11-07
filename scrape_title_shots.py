#!/usr/bin/env python3
"""
Страница вики «Титул»: названия = гиперссылки на PNG скрины титулов.
1) парсит name→url в titles.json (imageUrl)
2) качает PNG в data/title_img/ (urllib + cookie, без curl --compressed)
"""

from __future__ import annotations

import http.cookiejar
import json
import re
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data"
IMG_DIR = OUT / "title_img"
TITLES = OUT / "titles.json"
HTML_CACHE = OUT / "_wiki_titul.html"
PAGE = "https://www.parapa.ru/wiki/index.php/%D0%A2%D0%B8%D1%82%D1%83%D0%BB"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
CTX = ssl.create_default_context()


def warmup_cookie() -> Path:
    try:
        from scrape_by_id import COOKIE_FILE, warmup

        warmup()
        return Path(COOKIE_FILE)
    except Exception:
        return OUT / "cookies.txt"


def opener(ck: Path):
    jar = http.cookiejar.MozillaCookieJar(str(ck))
    try:
        jar.load(ignore_discard=True, ignore_expires=True)
    except Exception:
        jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=CTX),
    )


def fetch(op, url: str, timeout: int = 90) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Referer": "https://www.parapa.ru/wiki/index.php/%D0%A2%D0%B8%D1%82%D1%83%D0%BB",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
    )
    with op.open(req, timeout=timeout) as resp:
        return resp.read()


def norm(s: str) -> str:
    s = (s or "").casefold().replace("ё", "е")
    s = re.sub(r'[\"«»„“”]', "", s)
    s = re.sub(r"[,.!?…:;]+", " ", s)
    s = s.replace("—", "-").replace("–", "-")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def parse_links(html: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for m in re.finditer(
        r'<a[^>]+href="(https?://[^"]+/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"[^>]*>\s*([^<]+?)\s*</a>',
        html,
        re.I,
    ):
        url = m.group(1).replace("&amp;", "&")
        name = re.sub(r"\s+", " ", m.group(2)).strip()
        if len(name) < 2:
            continue
        pairs.append((name, url))
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for name, url in pairs:
        key = norm(name)
        if key in seen:
            continue
        seen.add(key)
        out.append((name, url))
    return out


def match_item(items: list[dict], name: str) -> dict | None:
    n = norm(name)
    for it in items:
        if norm(it.get("name") or "") == n:
            return it
    n2 = n.replace("-", " ")
    for it in items:
        iname = norm(it.get("name") or "")
        if iname.replace("-", " ") == n2:
            return it
        parts = [norm(p) for p in re.split(r"\s*/\s*", it.get("name") or "")]
        if n in parts or n2 in [p.replace("-", " ") for p in parts]:
            return it
    for it in items:
        iname = norm(it.get("name") or "")
        if n in iname or n2 in iname.replace("-", " "):
            return it
    return None


def local_name(url: str) -> str:
    base = Path(unquote(urlparse(url).path)).name
    safe = re.sub(r"[^a-zA-Z0-9._\u0400-\u04FF-]+", "_", base)
    return safe or "shot.png"


def is_complete_png(data: bytes) -> bool:
    return (
        len(data) > 100
        and data.startswith(b"\x89PNG\r\n\x1a\n")
        and data.endswith(b"IEND\xaeB`\x82")
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    ck = warmup_cookie()
    op = opener(ck)

    if not HTML_CACHE.exists() or HTML_CACHE.stat().st_size < 50000:
        print("download wiki page…")
        HTML_CACHE.write_bytes(fetch(op, PAGE, timeout=120))
    html = HTML_CACHE.read_text(encoding="utf-8", errors="replace")
    pairs = parse_links(html)
    print(f"title→png links: {len(pairs)}")

    data = json.loads(TITLES.read_text(encoding="utf-8"))
    items = data["items"]

    # map urls into json first
    mapped = 0
    misses: list[str] = []
    jobs: list[tuple[str, str, str]] = []  # name, url, local rel
    for name, url in pairs:
        fname = local_name(url)
        rel = f"data/title_img/{fname}"
        it = match_item(items, name)
        if it:
            it["imageUrl"] = url
            it["image"] = rel
            mapped += 1
        else:
            misses.append(name)
        jobs.append((name, url, fname))

    data["imagesMapped"] = sum(1 for it in items if it.get("image"))
    data["titleShots"] = mapped
    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    TITLES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"json mapped {mapped}/{len(pairs)}, miss {len(misses)}")
    if misses[:15]:
        print("miss:", ", ".join(misses[:15]))

    # download unique files
    unique: dict[str, str] = {}  # fname -> url
    for _, url, fname in jobs:
        unique.setdefault(fname, url)

    need = []
    for fname, url in unique.items():
        path = IMG_DIR / fname
        if path.exists() and is_complete_png(path.read_bytes()):
            continue
        need.append((fname, url))
    print(f"to download: {len(need)} / unique {len(unique)}")

    ok = 0
    fail = 0

    def one(fname: str, url: str) -> tuple[str, bool, str]:
        path = IMG_DIR / fname
        try:
            raw = fetch(opener(ck), url, timeout=120)
            if not is_complete_png(raw):
                return fname, False, f"bad png {len(raw)}"
            path.write_bytes(raw)
            return fname, True, str(len(raw))
        except Exception as e:
            return fname, False, str(e)

    # modest parallelism — wiki/CF can be touchy
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = [pool.submit(one, f, u) for f, u in need]
        for i, fut in enumerate(as_completed(futs), 1):
            fname, good, info = fut.result()
            if good:
                ok += 1
            else:
                fail += 1
                if fail <= 12:
                    print("  fail", fname, info)
            if i % 50 == 0 or i == len(futs):
                print(f"  progress {i}/{len(futs)} ok={ok} fail={fail}")

    print(f"downloaded ok={ok} fail={fail}")
    return 0 if fail < len(need) else 1


if __name__ == "__main__":
    raise SystemExit(main())

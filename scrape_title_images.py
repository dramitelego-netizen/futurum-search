#!/usr/bin/env python3
"""Скачать иконки титулов-предметов со страниц вики «Титул …» → data/title_img/ + обновить titles.json."""

from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data"
IMG_DIR = OUT / "title_img"
TITLES_FILE = OUT / "titles.json"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def cookie() -> Path:
    try:
        from scrape_by_id import COOKIE_FILE, warmup

        warmup()
        return Path(COOKIE_FILE)
    except Exception:
        return OUT / "cookies.txt"


def curl(url: str, dest: Path, ck: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    p = subprocess.run(
        [
            "curl.exe",
            "-sL",
            "--compressed",
            "-c",
            str(ck),
            "-b",
            str(ck),
            "-A",
            UA,
            "--max-time",
            "45",
            "-o",
            str(dest),
            "-w",
            "%{http_code}",
            url,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return int((p.stdout or "0").strip() or "0")


def read_html(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("utf-8", "windows-1251"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def is_cf(text: str) -> bool:
    return "Just a moment" in text or "bp_chl" in text


def list_title_pages(ck: Path) -> list[str]:
    url = (
        "https://www.parapa.ru/wiki/index.php?title=Special:PrefixIndex&prefix="
        + quote("Титул")
        + "&namespace=0"
    )
    dest = OUT / "_wiki_prefix.html"
    curl(url, dest, ck)
    html = read_html(dest)
    if is_cf(html):
        raise SystemExit("Cloudflare на PrefixIndex")
    pages: list[str] = []
    for m in re.finditer(r'href="/wiki/index\.php/([^"#?]+)"[^>]*title="([^"]+)"', html):
        title = unquote(m.group(2).replace("_", " "))
        if title.startswith("Титул ") and title not in pages:
            pages.append(title)
    return pages


def page_icon(html: str) -> tuple[str | None, str]:
    """Вернуть (url картинки, подпись) из контента страницы."""
    m = re.search(
        r'id="mw-content-text".*?(?:id="catlinks"|class="printfooter")',
        html,
        re.S | re.I,
    )
    chunk = m.group(0) if m else html
    # thumb with caption about иконка
    tm = re.search(
        r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>.*?<div class="thumbcaption"[^>]*>(.*?)</div>',
        chunk,
        re.S | re.I,
    )
    if not tm:
        im = re.search(r'<img[^>]+src=["\']([^"\']*images/[^"\']+)["\']', chunk, re.I)
        if not im:
            return None, ""
        src = im.group(1)
        cap = ""
    else:
        src = tm.group(1)
        cap = re.sub(r"<[^>]+>", "", tm.group(2))
        cap = re.sub(r"\s+", " ", cap).strip()
    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        src = "https://www.parapa.ru" + src
    if re.search(r"(poweredby|license|logo|favicon|button)", src, re.I):
        return None, ""
    return src, cap


def local_name(url: str) -> str:
    path = urlparse(url).path
    base = Path(path).name
    if not base or "." not in base:
        base = "icon.png"
    # keep hash-like names as-is
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", base)
    return safe


def norm_name(s: str) -> str:
    s = (s or "").casefold().replace("ё", "е")
    s = re.sub(r'[\"«»„“”]', "", s)
    s = re.sub(r"[,.!?…:;]+", " ", s)
    s = s.replace("—", "-").replace("–", "-")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def match_title(items: list[dict], page_title: str) -> dict | None:
    """page_title = 'Титул Восточная сказка' → найти в titles.json."""
    name = page_title.replace("Титул ", "", 1).strip()
    n = norm_name(name)
    # exact
    for it in items:
        if norm_name(it.get("name") or "") == n:
            return it
    # strip gender markers / slash variants
    n2 = re.sub(r"\s*\([мж]\)\s*", " ", n)
    n2 = re.sub(r"\s*/\s*", " / ", n2)
    n2 = re.sub(r"\s+", " ", n2).strip()
    for it in items:
        iname = norm_name(it.get("name") or "")
        if iname == n2:
            return it
        # "Рок-звезда" vs "Рок звезда"
        if iname.replace("-", " ") == n2.replace("-", " "):
            return it
        # contained in slash pairs
        parts = re.split(r"\s*/\s*", iname)
        if n2 in parts or n2.replace("-", " ") in [p.replace("-", " ") for p in parts]:
            return it
    # fuzzy: page name contained in title name
    for it in items:
        iname = norm_name(it.get("name") or "")
        if n in iname or n.replace("-", " ") in iname.replace("-", " "):
            return it
    return None


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    ck = cookie()

    pages = list_title_pages(ck)
    print(f"wiki pages: {len(pages)}")

    if not TITLES_FILE.exists():
        print("нет data/titles.json — сначала scrape_titles.py")
        return 1
    data = json.loads(TITLES_FILE.read_text(encoding="utf-8"))
    items = data.get("items") or []

    mapped = 0
    downloaded = 0
    misses: list[str] = []

    for i, title in enumerate(pages):
        url = "https://www.parapa.ru/wiki/index.php/" + quote(title.replace(" ", "_"))
        dest = OUT / f"_wiki_tpage_{i}.html"
        code = curl(url, dest, ck)
        html = read_html(dest) if dest.exists() else ""
        if code != 200 or is_cf(html) or len(html) < 500:
            print(f"  skip {title} code={code} cf={is_cf(html)}")
            time.sleep(0.2)
            continue
        img_url, cap = page_icon(html)
        if not img_url:
            print(f"  no img {title}")
            time.sleep(0.15)
            continue

        fname = local_name(img_url)
        local = IMG_DIR / fname
        if not local.exists() or local.stat().st_size < 100:
            code2 = curl(img_url, local, ck)
            if code2 == 200 and local.exists() and local.stat().st_size > 100:
                downloaded += 1
            else:
                print(f"  fail dl {title} → {img_url}")
                time.sleep(0.15)
                continue

        rel = f"data/title_img/{fname}"
        it = match_title(items, title)
        short = title.replace("Титул ", "", 1)
        if it:
            it["image"] = rel
            it["imageUrl"] = img_url
            mapped += 1
            print(f"  ✓ {short} → {fname}")
        else:
            misses.append(short)
            print(f"  · {short} img ok, no match in titles.json")
        time.sleep(0.15)

    data["imagesMapped"] = mapped
    data["imagesDownloaded"] = downloaded
    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    TITLES_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"mapped {mapped}/{len(pages)}, downloaded {downloaded}, unmatched pages {len(misses)}")
    if misses:
        print("unmatched:", ", ".join(misses[:20]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

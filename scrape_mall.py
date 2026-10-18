#!/usr/bin/env python3
"""Быстрый сбор: категории + параллельная загрузка страниц."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from html import unescape
from pathlib import Path
from threading import Lock

try:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
except Exception:
    pass

BASE = "https://parapa.ru"
CATEGORIES = {
    "packs": "Наборы",
    "wings": "Крылья",
    "pets": "Питомцы",
    "tricks": "Транспорт",
    "items": "Предметы",
    "clothes": "Внешность",
    "child_goods": "Детям",
}

# Сколько страниц качать одновременно
WORKERS = 6

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

OUT = Path(__file__).resolve().parent / "data"
COOKIE_FILE = OUT / "cookies.txt"
LOG_FILE = OUT / "scrape.log"
ITEMS_FILE = OUT / "items.json"
LOG_LOCK = Lock()


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def log(msg: str) -> None:
    line = f"[{ts()}] {msg}"
    with LOG_LOCK:
        print(line, flush=True)
        OUT.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line + "\n")


def decode_html(raw: bytes) -> str:
    head = raw[:2000].decode("ascii", errors="ignore")
    m = re.search(r'<meta[^>]+charset=["\']?([\w-]+)', head, re.I)
    charset = m.group(1) if m else None
    for enc in (charset, "windows-1251", "utf-8"):
        if not enc:
            continue
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("windows-1251", errors="replace")


def fetch(url: str, retries: int = 3) -> str:
    OUT.mkdir(parents=True, exist_ok=True)
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        t0 = time.perf_counter()
        proc = subprocess.run(
            [
                "curl.exe",
                "-sL",
                "--compressed",
                "-c",
                str(COOKIE_FILE),
                "-b",
                str(COOKIE_FILE),
                "-A",
                UA,
                "-H",
                "Accept-Language: ru-RU,ru;q=0.9",
                "--max-time",
                "90",
                url,
            ],
            capture_output=True,
            check=False,
        )
        elapsed = time.perf_counter() - t0
        if proc.returncode == 0 and proc.stdout:
            html = decode_html(proc.stdout)
            if 'class="store"' in html or 'id="store"' in html:
                return html
            last_err = RuntimeError("нет блока store")
        else:
            last_err = RuntimeError(f"curl {proc.returncode}")
        log(f"  retry {attempt}/{retries} {url} ({elapsed:.1f}с): {last_err}")
        time.sleep(attempt)
    raise RuntimeError(f"Не скачалось {url}: {last_err}")


def abs_url(src: str) -> str:
    src = unescape((src or "").strip())
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return BASE + src
    if src.startswith("http"):
        return src
    return BASE + "/" + src


def extract_category_store(html: str) -> str:
    m = re.search(
        r'<div id=["\']store["\']\s+class=["\']store["\']>(.*?)(?=<div id=["\']store["\']|$)',
        html,
        re.S | re.I,
    )
    return m.group(1) if m else ""


def last_page(html: str) -> int:
    m = re.search(r"mall_post_main.*?var\s+lastpage\s*=\s*(\d+)", html, re.S | re.I)
    if m:
        return int(m.group(1))
    matches = re.findall(r"var\s+lastpage\s*=\s*(\d+)", html)
    return max((int(x) for x in matches), default=1)


def parse_items(html: str, category: str, category_title: str) -> list[dict]:
    items: list[dict] = []
    for chunk in re.findall(r"<li\b[^>]*>.*?</li>", html, flags=re.S | re.I):
        id_m = re.search(r"name=['\"]id['\"]\s+value=['\"](\d+)['\"]", chunk, re.I)
        if not id_m:
            id_m = re.search(r"name=['\"]?id['\"]?\s+value=['\"]?(\d+)", chunk, re.I)
        if not id_m:
            continue
        item_id = int(id_m.group(1))

        title_m = re.search(
            r"<strong class=['\"]name['\"]>\s*<a[^>]*\btitle=['\"]([^'\"]+)['\"]",
            chunk,
            re.S | re.I,
        )
        alt_m = re.search(r"<img[^>]+alt=['\"]([^'\"]*)['\"]", chunk, re.I)
        text_m = re.search(
            r"<strong class=['\"]name['\"]>\s*<a[^>]*>(.*?)</a>",
            chunk,
            re.S | re.I,
        )
        candidates = []
        if title_m:
            candidates.append(unescape(title_m.group(1)).strip())
        if alt_m:
            candidates.append(unescape(alt_m.group(1)).strip())
        if text_m:
            candidates.append(unescape(re.sub(r"<[^>]+>", "", text_m.group(1))).strip())
        name = max(candidates, key=len) if candidates else f"Товар {item_id}"

        img_m = re.search(r"<img[^>]+src=['\"]([^'\"]+)['\"]", chunk, re.I)
        image = abs_url(img_m.group(1)) if img_m else ""

        desc_m = re.search(
            r"<div class=['\"]description['\"]>(.*?)</div>", chunk, re.S | re.I
        )
        description = ""
        if desc_m:
            description = unescape(re.sub(r"<[^>]+>", "", desc_m.group(1))).strip()
            description = re.sub(r"\s+", " ", description)

        price_m = re.search(
            r"name=['\"]?price\d+['\"]?\s+value=['\"]?(\d+)", chunk, re.I
        )
        price = int(price_m.group(1)) if price_m else None

        price_old = None
        price_block = re.search(
            r"<div class=['\"]price['\"]>(.*?)</div>", chunk, re.S | re.I
        )
        if price_block:
            for cand in re.finditer(r"<del([^>]*)>\s*(\d+)", price_block.group(1), re.I):
                attrs, val = cand.group(1), int(cand.group(2))
                if "display:none" in attrs.replace(" ", "") or val <= 0:
                    continue
                if price is not None and val > price:
                    price_old = val
                break

        items.append(
            {
                "id": item_id,
                "name": name,
                "description": description,
                "price": price,
                "priceOld": price_old,
                "onSale": bool(price_old and price and price_old > price)
                or ("sale_icon" in chunk),
                "image": image,
                "url": f"{BASE}/mall/goods/{item_id}/",
                "category": category,
                "categoryTitle": category_title,
                "categories": [category],
            }
        )
    return items


def merge_items(items: list[dict]) -> list[dict]:
    by_id: dict[int, dict] = {}
    for item in items:
        item = dict(item)
        cur = by_id.get(item["id"])
        if not cur:
            by_id[item["id"]] = item
            continue
        cats = set(cur.get("categories") or [])
        if item.get("category"):
            cats.add(item["category"])
            cur["category"] = item["category"]
            cur["categoryTitle"] = item.get("categoryTitle") or cur.get("categoryTitle")
        cur["categories"] = sorted(cats)
        for key in ("name", "description", "image", "price"):
            if item.get(key) and (
                not cur.get(key)
                or (key == "name" and len(str(item[key])) > len(str(cur.get(key) or "")))
            ):
                cur[key] = item[key]
        if item.get("priceOld"):
            cur["priceOld"] = item["priceOld"]
        cur["onSale"] = bool(cur.get("onSale") or item.get("onSale"))
    return sorted(by_id.values(), key=lambda x: x["id"])


def save_items(items: list[dict]) -> None:
    merged = merge_items(items)
    payload = {
        "source": "https://parapa.ru/mall/",
        "count": len(merged),
        "categories": CATEGORIES,
        "mode": "categories_parallel",
        "items": merged,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = ITEMS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(ITEMS_FILE)


def page_url(slug: str, page: int) -> str:
    if page <= 1:
        return f"{BASE}/mall/{slug}/"
    return f"{BASE}/mall/{slug}/{page}/"


def fetch_and_parse(slug: str, title: str, page: int, pages: int) -> tuple[int, list[dict], float]:
    url = page_url(slug, page)
    t0 = time.perf_counter()
    html = fetch(url)
    items = parse_items(extract_category_store(html), slug, title)
    elapsed = time.perf_counter() - t0
    log(
        f"✓ {title}: стр. {page}/{pages} — {len(items)} шт. за {elapsed:.1f}с | {url}"
    )
    for it in items:
        log(f"   • [{it['id']}] {it['name']} — {it['price']} монет")
    return page, items, elapsed


def discover_pages(slug: str, title: str) -> tuple[int, list[dict]]:
    """Первая страница: узнаём число страниц + товары page 1."""
    url = page_url(slug, 1)
    log(f"→ {title}: смотрю сколько страниц… {url}")
    t0 = time.perf_counter()
    html = fetch(url)
    pages = last_page(html)
    items = parse_items(extract_category_store(html), slug, title)
    log(
        f"✓ {title}: стр. 1/{pages} — {len(items)} шт. за {time.perf_counter()-t0:.1f}с (всего страниц: {pages})"
    )
    for it in items:
        log(f"   • [{it['id']}] {it['name']} — {it['price']} монет")
    return pages, items


def scrape_category(slug: str, title: str, cat_i: int, cat_n: int) -> list[dict]:
    log("")
    log("=" * 60)
    log(f"КАТЕГОРИЯ {cat_i}/{cat_n}: {title}")
    log("=" * 60)

    pages, collected = discover_pages(slug, title)
    if pages <= 1:
        return collected

    # Остальные страницы — параллельно
    log(f"→ {title}: качаю страницы 2–{pages} параллельно (потоков: {WORKERS})")
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {
            pool.submit(fetch_and_parse, slug, title, page, pages): page
            for page in range(2, pages + 1)
        }
        for fut in as_completed(futs):
            page = futs[fut]
            try:
                _, items, _ = fut.result()
                collected.extend(items)
            except Exception as err:  # noqa: BLE001
                log(f"✗ {title}: стр. {page} ошибка: {err}")

    log(f"ИТОГО «{title}»: {len(collected)} предметов")
    return collected


def warmup_cookie() -> None:
    """Один запрос, чтобы получить bp_chl cookie."""
    log("Прогрев cookie…")
    try:
        fetch(f"{BASE}/mall/packs/")
        log("Cookie готов")
    except Exception as err:  # noqa: BLE001
        log(f"Прогрев: {err}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text("", encoding="utf-8")

    log("Быстрый сбор Пара Па")
    log(f"Режим: категории + {WORKERS} потоков")
    log(f"Лог: {LOG_FILE}")
    log(f"Файл: {ITEMS_FILE}")

    warmup_cookie()

    all_items: list[dict] = []
    cats = list(CATEGORIES.items())
    t_all = time.perf_counter()

    for i, (slug, title) in enumerate(cats, start=1):
        try:
            batch = scrape_category(slug, title, i, len(cats))
            all_items.extend(batch)
            save_items(all_items)
            log(f"Сохранено уникальных пока: {len(merge_items(all_items))}")
        except Exception as err:  # noqa: BLE001
            log(f"КРИТИЧЕСКАЯ ОШИБКА «{title}»: {err}")

    merged = merge_items(all_items)
    save_items(merged)
    log("")
    log("=" * 60)
    log(f"ГОТОВО: {len(merged)} предметов за {time.perf_counter()-t_all:.0f} сек")
    log(f"Файл: {ITEMS_FILE}")
    log("=" * 60)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Перебор всех предметов по id:
  https://parapa.ru/mall/goods/{id}/

Без разделов магазина. Параллельная загрузка.
"""

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
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

OUT = Path(__file__).resolve().parent / "data"
COOKIE_FILE = OUT / "cookies.txt"
LOG_FILE = OUT / "scrape.log"
ITEMS_FILE = OUT / "items.json"
STATE_FILE = OUT / "id_state.json"

START_ID = 1
END_ID = 1500
WORKERS = 10
# После какого id начинаем считать «хвост» для ранней остановки
EARLY_STOP_AFTER = 50  # подряд пустых в конце диапазона (проверяем пачками)

LOG_LOCK = Lock()
SAVE_LOCK = Lock()


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


def fetch(url: str, retries: int = 2) -> str | None:
    OUT.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, retries + 1):
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
                "70",
                "--connect-timeout",
                "20",
                url,
            ],
            capture_output=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout:
            return decode_html(proc.stdout)
        time.sleep(0.4 * attempt)
    return None


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


def extract_description_block(html: str, after_pos: int) -> tuple[str, str]:
    """Текст и look-картинка из <div class=\"description\"> после формы."""
    window = html[after_pos : after_pos + 12000]
    m = re.search(r'<div\s+class=["\']description["\']\s*>', window, re.I)
    if not m:
        return "", ""
    start = m.end()
    i = start
    depth = 1
    raw = ""
    while i < len(window) and depth:
        nxt_open = window.find("<div", i)
        nxt_close = window.find("</div>", i)
        if nxt_close < 0:
            break
        if nxt_open >= 0 and nxt_open < nxt_close:
            depth += 1
            i = nxt_open + 4
            continue
        depth -= 1
        if depth == 0:
            raw = window[start:nxt_close]
            break
        i = nxt_close + 6
    if not raw:
        return "", ""

    look = ""
    # «как выглядит» — обычно /pictures/image/... или wiki; берём первое крупное
    for img in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', raw, re.I):
        src = abs_url(img.group(1))
        low = src.lower()
        if any(x in low for x in ("1x1.gif", "spacer", "pixel", "blank")):
            continue
        if "/pictures/image/" in low or "/wiki/" in low or "/pictures/" in low:
            # не иконка из mall thumb внутри description (редко)
            look = src
            break
    if not look:
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw, re.I)
        if img_m:
            look = abs_url(img_m.group(1))

    text = unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"&nbsp;", " ", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return text, look


def parse_goods(html: str, expected_id: int) -> dict | None:
    """Только форма form{id}: название, цена, картинка."""
    form_m = re.search(
        rf'<form\b[^>]*\bid=["\']form{expected_id}["\'][^>]*>.*?</form>',
        html,
        re.S | re.I,
    )
    if not form_m:
        return None
    chunk = form_m.group(0)

    id_m = re.search(r'name=["\']id["\']\s+value=["\'](\d+)["\']', chunk, re.I)
    if not id_m or int(id_m.group(1)) != expected_id:
        return None

    price_m = re.search(
        rf'id=["\']price{expected_id}["\'][^>]*value=["\'](\d+)["\']',
        chunk,
        re.I,
    )
    if not price_m:
        price_m = re.search(
            r'name=["\']price\d+["\']\s+value=["\'](\d+)["\']', chunk, re.I
        )
    if not price_m:
        return None
    price = int(price_m.group(1))

    title_m = re.search(
        r'<strong class=["\']name["\']>\s*<a[^>]*\btitle=["\']([^"\']+)["\']',
        chunk,
        re.S | re.I,
    )
    alt_m = re.search(r'<img[^>]+alt=["\']([^"\']*)["\']', chunk, re.I)
    text_m = re.search(
        r'<strong class=["\']name["\']>\s*<a[^>]*>(.*?)</a>', chunk, re.S | re.I
    )
    candidates = []
    if title_m:
        candidates.append(unescape(title_m.group(1)).strip())
    if alt_m:
        candidates.append(unescape(alt_m.group(1)).strip())
    if text_m:
        candidates.append(unescape(re.sub(r"<[^>]+>", "", text_m.group(1))).strip())
    name = max(candidates, key=len) if candidates else ""
    if not name:
        return None

    img_m = re.search(
        r'<a[^>]+class=["\']img_block["\'][^>]*>\s*<img[^>]+src=["\']([^"\']+)["\']',
        chunk,
        re.S | re.I,
    )
    if not img_m:
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', chunk, re.I)
    image = abs_url(img_m.group(1)) if img_m else ""

    # Типичная заглушка несуществующего товара
    if "redbox_128p" in image and "Интерактив" not in name:
        # если имя совсем общее — отбрасываем
        if name.lower() in {"магазин", "товар"} or len(name) < 2:
            return None

    price_old = None
    price_block = re.search(
        r'<div class=["\']price["\']>(.*?)</div>', chunk, re.S | re.I
    )
    if price_block:
        for cand in re.finditer(r"<del([^>]*)>\s*(\d+)", price_block.group(1), re.I):
            attrs, val = cand.group(1), int(cand.group(2))
            if "display:none" in attrs.replace(" ", "") or val <= 0:
                continue
            if val > price:
                price_old = val
            break

    # описание + look-картинка — соседний блок после </form>
    description, look_image = extract_description_block(html, form_m.end())

    return {
        "id": expected_id,
        "name": name,
        "description": description,
        "price": price,
        "priceOld": price_old,
        "onSale": bool(price_old and price_old > price) or ("sale_icon" in chunk),
        "image": image,
        "lookImage": look_image or None,
        "url": f"{BASE}/mall/goods/{expected_id}/",
        "category": None,
        "categoryTitle": None,
        "categories": [],
    }


def check_id(gid: int) -> tuple[int, dict | None, float, str]:
    url = f"{BASE}/mall/goods/{gid}/"
    t0 = time.perf_counter()
    html = fetch(url)
    elapsed = time.perf_counter() - t0
    if not html:
        return gid, None, elapsed, "нет ответа"
    item = parse_goods(html, gid)
    if not item:
        return gid, None, elapsed, "пусто"
    return gid, item, elapsed, "ok"


def load_found() -> dict[str, dict]:
    if ITEMS_FILE.exists():
        try:
            data = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
            if data.get("mode") == "by_id" or not data.get("categories"):
                return {str(i["id"]): i for i in data.get("items", [])}
        except Exception:
            pass
    if STATE_FILE.exists():
        try:
            st = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            # только мета — предметы в items.json
        except Exception:
            pass
    return {}


def save_found(found: dict[str, dict], next_hint: int) -> None:
    items = sorted(found.values(), key=lambda x: x["id"])
    payload = {
        "source": "https://parapa.ru/mall/goods/{id}/",
        "count": len(items),
        "mode": "by_id",
        "range": {"start": START_ID, "end": END_ID, "scanned_upto_hint": next_hint},
        "items": items,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = ITEMS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(ITEMS_FILE)
    try:
        from price_history import record_items

        record_items(items)
    except Exception:
        pass
    STATE_FILE.write_text(
        json.dumps(
            {"found": len(items), "hint": next_hint, "updated": ts()},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def warmup() -> None:
    log("Прогрев cookie…")
    html = fetch(f"{BASE}/mall/goods/82/")
    log("Cookie готов" if html else "Прогрев не удался, продолжаю")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text("", encoding="utf-8")

    found = load_found()
    # не перезаписываем чужой каталог из категорий — начинаем свой by_id
    if found and Path(ITEMS_FILE).exists():
        try:
            mode = json.loads(ITEMS_FILE.read_text(encoding="utf-8")).get("mode")
            if mode != "by_id":
                found = {}
        except Exception:
            found = {}

    already = {int(k) for k in found}
    todo = [i for i in range(START_ID, END_ID + 1) if i not in already]

    log("Перебор предметов по ID (без разделов)")
    log(f"Диапазон: {START_ID}…{END_ID}")
    log(f"Потоков: {WORKERS}")
    log(f"Уже есть: {len(found)}, осталось проверить: {len(todo)}")
    log(f"Файл: {ITEMS_FILE}")
    log("")

    warmup()

    t_all = time.perf_counter()
    checked = 0
    empty = 0
    # для ранней остановки: считаем пустые с конца, но проще — просто идём весь диапазон
    # т.к. дырки бывают в середине (id 1 пустой, 62 есть)

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        # пачками, чтобы логи были читаемые и сохранение частое
        batch_size = WORKERS * 3
        for offset in range(0, len(todo), batch_size):
            batch = todo[offset : offset + batch_size]
            futs = {pool.submit(check_id, gid): gid for gid in batch}
            for fut in as_completed(futs):
                gid, item, elapsed, status = fut.result()
                checked += 1
                if item:
                    with SAVE_LOCK:
                        found[str(gid)] = item
                    log(
                        f"✓ [{gid}] {item['name']} — {item['price']} монет ({elapsed:.1f}с) | найдено {len(found)}"
                    )
                else:
                    empty += 1
                    log(f"· [{gid}] нет ({status}, {elapsed:.1f}с)")

            with SAVE_LOCK:
                save_found(found, batch[-1])
            done = offset + len(batch)
            pct = 100.0 * done / max(len(todo), 1)
            log(
                f"— прогресс {done}/{len(todo)} ({pct:.1f}%), найдено {len(found)}, пустых {empty}, прошло {time.perf_counter()-t_all:.0f}с"
            )

    save_found(found, END_ID)
    log("")
    log("=" * 60)
    log(f"ГОТОВО: {len(found)} предметов за {time.perf_counter()-t_all:.0f} сек")
    log(f"Проверено id: {checked}, пустых: {empty}")
    log(f"Файл: {ITEMS_FILE}")
    log("=" * 60)


if __name__ == "__main__":
    main()

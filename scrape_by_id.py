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
# Диапазон, в котором ищем «дыры» (предмет мог появиться на любом свободном id)
GAP_SCAN_START = 1
GAP_SCAN_END = 1000
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


def _curl_cmd(url: str) -> list[str]:
    return [
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
    ]


def fetch(url: str, retries: int = 2) -> str | None:
    """Полная страница (редко нужно)."""
    OUT.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, retries + 1):
        proc = subprocess.run(
            _curl_cmd(url),
            capture_output=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout:
            return decode_html(proc.stdout)
        time.sleep(0.4 * attempt)
    return None


def _html_enough_for_goods(raw: bytes, expected_id: int) -> bool:
    """Уже есть форма товара (или ясно, что её нет в типичном начале страницы)."""
    marker = f'id="form{expected_id}"'.encode("ascii", errors="ignore")
    marker2 = f"id='form{expected_id}'".encode("ascii", errors="ignore")
    if marker in raw or marker2 in raw:
        # ждём закрытия формы + кусок description после неё
        idx = raw.find(marker) if marker in raw else raw.find(marker2)
        tail = raw[idx:]
        close = tail.find(b"</form>")
        if close < 0:
            return False
        # ~4 КБ после </form> обычно хватает на description
        return len(tail) >= close + 8 + 4000
    # пустые/чужие страницы: после ~48 КБ формы всё равно нет — хватит
    return len(raw) >= 48_000


def fetch_light(url: str, expected_id: int, retries: int = 2, max_bytes: int = 72_000) -> str | None:
    """
    Качает только нужный кусок HTML и обрывает поток.
    Сервер всё равно отдаёт ~150 КБ страницу, но мы не читаем хвост
    (скрипты/подвал) — меньше трафика и быстрее на «пустых» id.
    """
    OUT.mkdir(parents=True, exist_ok=True)
    for attempt in range(1, retries + 1):
        proc = subprocess.Popen(
            _curl_cmd(url),
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        assert proc.stdout is not None
        chunks: list[bytes] = []
        got = 0
        try:
            while got < max_bytes:
                piece = proc.stdout.read(min(8192, max_bytes - got))
                if not piece:
                    break
                chunks.append(piece)
                got += len(piece)
                blob = b"".join(chunks) if len(chunks) > 1 else chunks[0]
                if _html_enough_for_goods(blob, expected_id):
                    break
        finally:
            try:
                proc.kill()
            except OSError:
                pass
            try:
                proc.wait(timeout=2)
            except Exception:
                pass
        raw = b"".join(chunks)
        if raw:
            return decode_html(raw)
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
    # «как выглядит»: реальные превью, не иконки /pictures/mall/ из описания подарка
    for img in re.finditer(r'<img[^>]+src=["\']([^"\']+)["\']', raw, re.I):
        src = abs_url(img.group(1))
        low = src.lower()
        if any(x in low for x in ("1x1.gif", "spacer", "pixel", "blank", "redbox")):
            continue
        if "/pictures/mall/" in low and "/pictures/image/" not in low:
            continue
        if (
            "/pictures/image/" in low
            or "/wiki/" in low
            or "gyazo.com" in low
            or "i.gyazo.com" in low
            or "clip." in low
        ):
            look = src
            break

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
        # категорию страница товара не даёт — не пишем null, чтобы не стереть enrich
    }


def check_id(gid: int) -> tuple[int, dict | None, float, str]:
    url = f"{BASE}/mall/goods/{gid}/"
    t0 = time.perf_counter()
    html = fetch_light(url, expected_id=gid)
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


def replace_file(tmp: Path, target: Path, attempts: int = 12, delay: float = 0.35) -> None:
    """Windows часто держит items.json (браузер/антивирус) — replace с повторами."""
    last: OSError | None = None
    for i in range(attempts):
        try:
            tmp.replace(target)
            return
        except PermissionError as e:
            last = e
            time.sleep(delay * (1.0 + i * 0.15))
        except OSError as e:
            # WinError 5 / 32 — файл занят
            if getattr(e, "winerror", None) not in (5, 32) and e.errno not in (13, 11):
                raise
            last = e
            time.sleep(delay * (1.0 + i * 0.15))
    # запасной путь: копируем поверх, потом удаляем tmp
    try:
        data = tmp.read_bytes()
        target.write_bytes(data)
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        log(f"⚠ {target.name}: replace был занят, записал напрямую")
        return
    except OSError:
        pass
    raise last or PermissionError(f"не удалось заменить {target}")


def _preserve_local_meta(found: dict[str, dict]) -> None:
    """Не теряем category/gender/badge при перезаписи items.json."""
    prev = load_found()
    meta_keys = ("category", "categoryTitle", "categories", "gender", "badge")
    for key, item in found.items():
        old = prev.get(str(key)) or prev.get(key)
        if not old:
            continue
        for mk in meta_keys:
            cur = item.get(mk)
            empty = cur is None or cur == "" or cur == []
            if empty and old.get(mk) not in (None, "", []):
                item[mk] = old[mk]


def save_found(found: dict[str, dict], next_hint: int) -> None:
    _preserve_local_meta(found)
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
    replace_file(tmp, ITEMS_FILE)
    try:
        from price_history import record_items

        record_items(items)
    except Exception:
        pass
    # категории заново по имени/описанию — страховка от затирания
    try:
        import enrich_filters

        enrich_filters.main()
    except Exception as e:
        log(f"⚠ enrich_filters: {e}")
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


def _prepare_found() -> dict[str, dict]:
    found = load_found()
    if found and Path(ITEMS_FILE).exists():
        try:
            mode = json.loads(ITEMS_FILE.read_text(encoding="utf-8")).get("mode")
            if mode != "by_id":
                found = {}
        except Exception:
            found = {}
    return found


def scan_full() -> None:
    """Полный обход START_ID…END_ID (долго)."""
    OUT.mkdir(parents=True, exist_ok=True)
    LOG_FILE.write_text("", encoding="utf-8")

    found = _prepare_found()
    already = {int(k) for k in found}
    todo = [i for i in range(START_ID, END_ID + 1) if i not in already]

    log("Перебор предметов по ID (полный)")
    log(f"Диапазон: {START_ID}…{END_ID}")
    log(f"Потоков: {WORKERS}")
    log(f"Уже есть: {len(found)}, осталось проверить: {len(todo)}")
    log(f"Файл: {ITEMS_FILE}")
    log("")

    if not todo:
        log("Нечего проверять — все id в диапазоне уже в каталоге")
        return

    warmup()

    t_all = time.perf_counter()
    checked = 0
    empty = 0

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
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


def scan_gaps(
    start: int = GAP_SCAN_START,
    end: int = GAP_SCAN_END,
    workers: int = 6,
) -> int:
    """
    Проверяет ВСЕ id в [start, end], которых ещё нет в каталоге.
    Так ловим новые предметы не только «в хвосте», а в любом пропуске.
    """
    OUT.mkdir(parents=True, exist_ok=True)
    found = _prepare_found()
    known = {int(k) for k in found}
    start = max(1, int(start))
    end = max(start, int(end))
    todo = [i for i in range(start, end + 1) if i not in known]
    workers = max(1, min(workers, WORKERS))

    log("=" * 60)
    log("Проверка ПРОПУСКОВ (дыры в диапазоне)")
    log(f"Диапазон: {start}…{end}")
    log(f"В каталоге: {len(found)} шт., неизвестных id в диапазоне: {len(todo)}")
    log(f"Потоков: {workers}")
    log("=" * 60)

    if not todo:
        log("Пропусков нет — все id в диапазоне уже известны")
        return 0

    warmup()
    t_all = time.perf_counter()
    new_items: list[dict] = []
    empty_total = 0
    checked = 0
    batch_size = max(workers * 2, 8)

    for offset in range(0, len(todo), batch_size):
        batch = todo[offset : offset + batch_size]
        results: list[tuple[int, dict | None, float, str]] = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {pool.submit(check_id, gid): gid for gid in batch}
            for fut in as_completed(futs):
                results.append(fut.result())
        results.sort(key=lambda x: x[0])

        for gid, item, elapsed, status in results:
            checked += 1
            if item:
                with SAVE_LOCK:
                    found[str(gid)] = item
                new_items.append(item)
                log(
                    f"★ НОВЫЙ [{gid}] {item['name']} — {item['price']} монет ({elapsed:.1f}с)"
                )
            else:
                empty_total += 1
                log(f"· [{gid}] нет ({status}, {elapsed:.1f}с)")

        with SAVE_LOCK:
            save_found(found, max(end, max((int(k) for k in found), default=end)))
        done = min(offset + batch_size, len(todo))
        log(f"  прогресс дыр: {done}/{len(todo)} | новых: {len(new_items)}")

    save_found(found, max(end, max((int(k) for k in found), default=end)))
    log("")
    log("=" * 60)
    log(f"Проверка пропусков завершена за {time.perf_counter() - t_all:.0f}с")
    log(f"Проверено id: {checked}, пустых: {empty_total}, новых: {len(new_items)}")
    if new_items:
        for it in new_items[:20]:
            log(f"  + [{it['id']}] {it['name']}")
        if len(new_items) > 20:
            log(f"  … и ещё {len(new_items) - 20}")
    log(f"Всего в каталоге: {len(found)} → {ITEMS_FILE}")
    log("=" * 60)
    return len(new_items)


def scan_new(ahead: int = 120, empty_stop: int = 40, workers: int = 6) -> int:
    """
    Лёгкая проверка новых предметов: после максимального известного id
    идём вперёд, пока не наберём empty_stop пустых подряд (но не дальше ahead id).
    Возвращает число вновь найденных предметов.
    """
    OUT.mkdir(parents=True, exist_ok=True)
    found = _prepare_found()
    max_id = max((int(k) for k in found), default=0)
    start = max_id + 1
    end = start + max(1, ahead) - 1
    empty_stop = max(5, empty_stop)
    workers = max(1, min(workers, WORKERS))

    log("=" * 60)
    log("Проверка НОВЫХ предметов (лёгкий режим)")
    log(f"В каталоге сейчас: {len(found)} шт., максимальный id: {max_id}")
    log(f"Смотрим id: {start}…{end}")
    log(f"Стоп после {empty_stop} пустых подряд")
    log(f"Потоков: {workers}")
    log("=" * 60)

    if max_id <= 0 and not found:
        log("Каталог пуст — для первого заполнения запусти полный обход: scrape_by_id.py")
        return 0

    warmup()
    t_all = time.perf_counter()
    new_items: list[dict] = []
    checked = 0
    empty_streak = 0
    empty_total = 0
    cursor = start

    while cursor <= end and empty_streak < empty_stop:
        batch_end = min(end, cursor + workers * 2 - 1)
        batch = list(range(cursor, batch_end + 1))
        # если уже почти упёрлись в empty_stop — не тянем лишнее
        results: list[tuple[int, dict | None, float, str]] = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futs = {pool.submit(check_id, gid): gid for gid in batch}
            for fut in as_completed(futs):
                results.append(fut.result())
        results.sort(key=lambda x: x[0])

        stop_now = False
        for gid, item, elapsed, status in results:
            checked += 1
            if item:
                empty_streak = 0
                with SAVE_LOCK:
                    found[str(gid)] = item
                new_items.append(item)
                log(
                    f"★ НОВЫЙ [{gid}] {item['name']} — {item['price']} монет ({elapsed:.1f}с)"
                )
            else:
                empty_streak += 1
                empty_total += 1
                log(f"· [{gid}] нет ({status}, {elapsed:.1f}с) | пустых подряд: {empty_streak}/{empty_stop}")
                if empty_streak >= empty_stop:
                    stop_now = True
                    break
        with SAVE_LOCK:
            save_found(found, batch[-1])
        if stop_now:
            log(f"Ранний стоп: {empty_stop} пустых подряд — новых id дальше, скорее всего, нет")
            break
        cursor = batch_end + 1

    save_found(found, max(end, max_id))
    log("")
    log("=" * 60)
    log(f"Проверка новых завершена за {time.perf_counter() - t_all:.0f}с")
    log(f"Проверено id: {checked}, пустых: {empty_total}")
    log(f"Новых предметов: {len(new_items)}")
    if new_items:
        for it in new_items[:20]:
            log(f"  + [{it['id']}] {it['name']}")
        if len(new_items) > 20:
            log(f"  … и ещё {len(new_items) - 20}")
    else:
        log("Новых предметов не найдено")
    log(f"Всего в каталоге: {len(found)} → {ITEMS_FILE}")
    log("=" * 60)
    return len(new_items)


def main(argv: list[str] | None = None) -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Сбор предметов Parapa mall по id")
    ap.add_argument(
        "--new",
        action="store_true",
        help="лёгкая проверка только новых id после максимального известного",
    )
    ap.add_argument(
        "--ahead",
        type=int,
        default=120,
        help="сколько id вперёд смотреть в режиме --new (по умолчанию 120)",
    )
    ap.add_argument(
        "--empty-stop",
        type=int,
        default=40,
        help="стоп после N пустых подряд в режиме --new (по умолчанию 40)",
    )
    args = ap.parse_args(argv)

    if args.new:
        scan_new(ahead=args.ahead, empty_stop=args.empty_stop)
    else:
        scan_full()


if __name__ == "__main__":
    main()

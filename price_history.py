"""История цен предметов → data/price_history.json"""

from __future__ import annotations

import json
import time
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data"
HISTORY_FILE = OUT / "price_history.json"


def load_history() -> dict:
    if not HISTORY_FILE.exists():
        return {}
    try:
        data = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_history(hist: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = HISTORY_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(hist, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(HISTORY_FILE)


def _point(price: int | None, price_old: int | None = None, ts: int | None = None) -> dict:
    return {
        "t": int(ts if ts is not None else time.time()),
        "price": price,
        "priceOld": price_old,
    }


def record_price(hist: dict, item_id: int | str, price, price_old=None, ts: int | None = None) -> bool:
    """Добавляет точку, если цена изменилась. Возвращает True если записали."""
    if price is None:
        return False
    try:
        price = int(price)
    except (TypeError, ValueError):
        return False
    old = None
    if price_old is not None:
        try:
            old = int(price_old)
        except (TypeError, ValueError):
            old = None

    key = str(item_id)
    series = hist.setdefault(key, [])
    if series:
        last = series[-1]
        if last.get("price") == price and last.get("priceOld") == old:
            return False
    series.append(_point(price, old, ts))
    # не раздуваем бесконечно
    if len(series) > 120:
        hist[key] = series[-120:]
    return True


def seed_from_items(items: list[dict]) -> dict:
    """Первичный снимок: текущая цена + старая цена как прошлый уровень."""
    hist = load_history()
    now = int(time.time())
    day = 86400
    changed = False
    for item in items:
        gid = item.get("id")
        if gid is None:
            continue
        key = str(gid)
        if key in hist and hist[key]:
            # уже есть история — только дописать текущую если отличается
            if record_price(hist, gid, item.get("price"), item.get("priceOld"), now):
                changed = True
            continue

        price = item.get("price")
        price_old = item.get("priceOld")
        series = []
        if price_old is not None and price is not None:
            try:
                po, p = int(price_old), int(price)
                if po > p:
                    series.append(_point(po, None, now - day * 7))
                    series.append(_point(p, po, now))
                else:
                    series.append(_point(p, po if po else None, now))
            except (TypeError, ValueError):
                pass
        elif price is not None:
            try:
                series.append(_point(int(price), None, now))
            except (TypeError, ValueError):
                pass
        if series:
            hist[key] = series
            changed = True
    if changed:
        save_history(hist)
    return hist


def record_items(items: list[dict]) -> None:
    hist = load_history()
    now = int(time.time())
    changed = False
    for item in items:
        if record_price(hist, item.get("id"), item.get("price"), item.get("priceOld"), now):
            changed = True
    if changed:
        save_history(hist)


if __name__ == "__main__":
    items_file = OUT / "items.json"
    data = json.loads(items_file.read_text(encoding="utf-8"))
    items = data.get("items") or []
    seed_from_items(items)
    print(f"История: {HISTORY_FILE} ({len(load_history())} предметов)")

"""Дозаполняет пустые description у уже найденных предметов."""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from scrape_by_id import ITEMS_FILE, SAVE_LOCK, WORKERS, check_id, log, warmup

OUT = Path(__file__).resolve().parent / "data"
WORKERS_ENRICH = max(2, min(4, WORKERS))


def main() -> None:
    if not ITEMS_FILE.exists():
        log("нет items.json")
        return
    data = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    items = data.get("items") or []
    need = [i["id"] for i in items if not (i.get("description") or "").strip()]
    log(f"Пустых описаний: {len(need)} из {len(items)}")
    if not need:
        return

    warmup()
    by_id = {str(i["id"]): i for i in items}
    updated = 0
    t0 = time.perf_counter()

    with ThreadPoolExecutor(max_workers=WORKERS_ENRICH) as pool:
        futs = {pool.submit(check_id, gid): gid for gid in need}
        done = 0
        for fut in as_completed(futs):
            gid, item, elapsed, status = fut.result()
            done += 1
            if item and (item.get("description") or "").strip():
                old = by_id.get(str(gid), {})
                old.update(
                    {
                        "description": item["description"],
                        "price": item["price"],
                        "priceOld": item.get("priceOld"),
                        "onSale": item.get("onSale", False),
                        "image": item.get("image") or old.get("image"),
                        "name": item.get("name") or old.get("name"),
                    }
                )
                by_id[str(gid)] = old
                updated += 1
                log(f"✓ [{gid}] описание ({elapsed:.1f}с) | {updated}/{done}")
            else:
                log(f"· [{gid}] без описания ({status}, {elapsed:.1f}с)")

            if done % 8 == 0:
                with SAVE_LOCK:
                    data["items"] = sorted(by_id.values(), key=lambda x: x["id"])
                    data["count"] = len(data["items"])
                    tmp = ITEMS_FILE.with_suffix(".tmp")
                    tmp.write_text(
                        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
                    )
                    tmp.replace(ITEMS_FILE)

    with SAVE_LOCK:
        data["items"] = sorted(by_id.values(), key=lambda x: x["id"])
        data["count"] = len(data["items"])
        tmp = ITEMS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(ITEMS_FILE)

    log(f"Готово: обновлено {updated} за {time.perf_counter() - t0:.0f}с")


if __name__ == "__main__":
    main()

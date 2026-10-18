#!/usr/bin/env python3
"""Merge scraped page JSON dumps into data/items.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DUMPS = ROOT / "data" / "dumps"
OUT = ROOT / "data" / "items.json"


def merge(items: list[dict]) -> list[dict]:
    by_id: dict[int, dict] = {}
    for item in items:
        item_id = int(item["id"])
        existing = by_id.get(item_id)
        if not existing:
            item = dict(item)
            item["categories"] = [item["category"]] if item.get("category") else []
            # fix false onSale when priceOld is 0
            if item.get("priceOld") in (0, None):
                item["priceOld"] = None
                item["onSale"] = bool(item.get("onSale") and item.get("priceOld"))
            # recompute onSale properly
            if item.get("priceOld") and item.get("price") and item["priceOld"] > item["price"]:
                item["onSale"] = True
            else:
                item["onSale"] = bool(item.get("saleIcon"))
            by_id[item_id] = item
            continue
        cats = set(existing.get("categories") or [])
        if item.get("category"):
            cats.add(item["category"])
        existing["categories"] = sorted(cats)
        for key in ("name", "description", "image", "price", "category", "categoryTitle", "url"):
            if (not existing.get(key)) and item.get(key):
                existing[key] = item[key]
        old = item.get("priceOld")
        if old and old > 0:
            existing["priceOld"] = old
            if existing.get("price") and old > existing["price"]:
                existing["onSale"] = True
        if item.get("saleIcon"):
            existing["onSale"] = True
    return sorted(by_id.values(), key=lambda x: x["id"])


def main() -> None:
    all_items: list[dict] = []
    for path in sorted(DUMPS.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        batch = data.get("items") or data
        if isinstance(batch, str):
            batch = json.loads(batch)
        print(f"{path.name}: {len(batch)}")
        all_items.extend(batch)
    merged = merge(all_items)
    payload = {
        "source": "https://parapa.ru/mall/",
        "count": len(merged),
        "items": merged,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"merged {len(merged)} -> {OUT}")


if __name__ == "__main__":
    main()

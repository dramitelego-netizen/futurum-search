# -*- coding: utf-8 -*-
"""
Алиса (обмен подарков) → wiki_items.json

1. Дописать source «Алиса (обмен подарков)» существующим id из audit needsSource.
2. Добавить недостающие карточки (облачка чата, Грюмобиль, детские и т.п.).
   Расходники и карты транспорта не заводим.

Запуск:
  py -3 scrape_alice_items.py
  py -3 scrape_alice_items.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPORT = ROOT / "data" / "_alice_audit_report.json"
WIKI = ROOT / "data" / "wiki_items.json"
TITLES = ROOT / "data" / "titles.json"
SOURCE_TAG = "Алиса (обмен подарков)"

# не заводить как косметику каталога
SKIP_NAME_RE = re.compile(
    r"(?:"
    r"^карта\b|"
    r"карта улучшения|"
    r"коробка печенья|"
    r"красные бобы|"
    r"волшебная тыква|"
    r"праздничная микстура|"
    r"праздничный макияж|"
    r"юбилейные купоны|"
    r"хрустальное сердце|"
    r"сертификат обаяния|"
    r"подарок\s*[«\"]?\s*семейный отдых|"
    r"подарок\s*[«\"]?\s*облачко для чата\s*[»\"]?\s*$|"
    r"подарок\s*[«\"]?\s*юбилейные"
    r")",
    re.I,
)


def merge_source(old: str, extra: str) -> str:
    old = (old or "").strip()
    extra = (extra or "").strip()
    if not extra:
        return old
    if not old:
        return extra
    if SOURCE_TAG.lower() in old.lower():
        return old
    return f"{old}, {extra}"


def kind_for_missing(name: str, section: str) -> tuple[str, str]:
    n = name.casefold()
    if "облач" in n:
        return "chat_bubbles", "Облачка чата"
    if section.startswith("Питомцы") or "котоход" in n or "грюмобиль" in n:
        if "прическ" in n or "шапк" in n or "xkmy" in n:
            pass
        else:
            return "transport", "Транспорт"
    if "прическ" in n or "парик" in n:
        return "hairstyles", "Прически"
    if "метла" in n and "дет" in n:
        return "hand_decor", "Украшения"
    if "костюм" in n or "шапк" in n or "xkmy" in n:
        return "kids_clothes", "Детская одежда"
    if "тихий вечер" in n or "оформлен" in n:
        return "card_bg", "Фоны визитки"
    if "танц" in n or "бальн" in n:
        return "emotes", "Интерактивы"
    if section.startswith("Малыши"):
        return "kids_clothes", "Детская одежда"
    if section.startswith("Визитка"):
        return "card_bg", "Фоны визитки"
    return "accessories", "Аксессуары"


def apply_sources(items: list[dict], needs: list[dict], dry: bool) -> int:
    by_id = {int(it["id"]): it for it in items}
    n = 0
    for row in needs:
        iid = int(row["id"])
        it = by_id.get(iid)
        if not it:
            print("  skip missing id", iid, row.get("name"))
            continue
        before = it.get("source") or ""
        after = merge_source(before, SOURCE_TAG)
        if after == before:
            continue
        if not dry:
            it["source"] = after
        n += 1
    return n


def add_missing(items: list[dict], missing: list[dict], dry: bool) -> int:
    existing = {(it.get("name") or "").casefold() for it in items}
    next_id = max(int(it["id"]) for it in items) + 1
    added = 0
    for row in missing:
        name = (row.get("name") or "").strip()
        if not name:
            continue
        if SKIP_NAME_RE.search(name):
            print("  skip consumable/card:", name)
            continue
        if name.casefold() in existing:
            # already there — just ensure source
            for it in items:
                if (it.get("name") or "").casefold() == name.casefold():
                    before = it.get("source") or ""
                    after = merge_source(before, SOURCE_TAG)
                    if after != before and not dry:
                        it["source"] = after
                    break
            continue
        kind, label = kind_for_missing(name, row.get("section") or "")
        cost = (row.get("cost") or "").strip()
        wiki = ""
        href = row.get("href") or ""
        if href:
            if href.startswith("http"):
                wiki = href
            else:
                wiki = "https://parapa.ru" + href
        entry = {
            "kind": kind,
            "kindLabel": label,
            "name": name,
            "description": cost or f"Обмен у Алисы",
            "source": SOURCE_TAG + (f". {cost}" if cost else ""),
            "note": "",
            "category": SOURCE_TAG,
            "imageUrl": "",
            "wiki": wiki,
            "id": next_id,
            "image": None,
        }
        print(f"  + [{kind}] {name}")
        if not dry:
            items.append(entry)
            existing.add(name.casefold())
            next_id += 1
        added += 1
    return added


def rebuild_meta(data: dict, items: list[dict]) -> None:
    by_kind_label: dict[str, int] = {}
    kinds_map: dict[str, str] = {}
    for it in items:
        lab = it.get("kindLabel") or it.get("kind") or "Прочее"
        kid = it.get("kind") or "other"
        by_kind_label[lab] = by_kind_label.get(lab, 0) + 1
        kinds_map[kid] = lab
    # preserve order: existing kinds then new
    old_kinds = data.get("kinds") or []
    seen = set()
    kinds = []
    for k in old_kinds:
        kid = k.get("id") if isinstance(k, dict) else k
        if kid in kinds_map and kid not in seen:
            kinds.append({"id": kid, "label": kinds_map[kid]})
            seen.add(kid)
    for kid, lab in kinds_map.items():
        if kid not in seen:
            kinds.append({"id": kid, "label": lab})
            seen.add(kid)
    data["items"] = items
    data["count"] = len(items)
    data["byKind"] = by_kind_label
    data["kinds"] = kinds
    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    data["aliceExchange"] = {
        "page": "https://parapa.ru/wiki/index.php/Алиса_обмен_подарков",
        "sourceTag": SOURCE_TAG,
    }


def retag_title_obraztsovy() -> None:
    """Подарок «Семейный отдых» → титул Образцовый родитель."""
    if not TITLES.exists():
        return
    data = json.loads(TITLES.read_text(encoding="utf-8"))
    for it in data.get("items") or []:
        if (it.get("name") or "") == "Образцовый родитель":
            it["source"] = merge_source(it.get("source") or "", SOURCE_TAG)
            if not it.get("category"):
                it["category"] = SOURCE_TAG
            break
    TITLES.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not REPORT.exists():
        print("нет", REPORT)
        return 1
    if not WIKI.exists():
        print("нет", WIKI)
        return 1

    report = json.loads(REPORT.read_text(encoding="utf-8"))
    data = json.loads(WIKI.read_text(encoding="utf-8"))
    items = list(data.get("items") or [])
    needs = report.get("needsSource") or []
    missing = report.get("missing") or []

    print("wiki items", len(items))
    tagged = apply_sources(items, needs, args.dry_run)
    print("tagged source", tagged)
    added = add_missing(items, missing, args.dry_run)
    print("added cards", added)

    if not args.dry_run:
        rebuild_meta(data, items)
        WIKI.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        retag_title_obraztsovy()
        print("wrote", WIKI, "count", data["count"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

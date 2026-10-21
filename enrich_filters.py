#!/usr/bin/env python3
"""Локально обогащает items.json: category, gender, badge (★/☆)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent / "data"
ITEMS_FILE = OUT / "items.json"

CATEGORIES = {
    "packs": "Наборы",
    "wings": "Крылья",
    "pets": "Питомцы",
    "tricks": "Транспорт",
    "items": "Предметы",
    "clothes": "Внешность",
    "child_goods": "Детям",
}

MALE_RE = re.compile(
    r"(?:\(\s*м(?:уж(?:ской|ские|ская)?)?\.?\s*\)|\bмужск(?:ой|ие|ая|ого)\b|\bмуж\.?\b)",
    re.I,
)
FEMALE_RE = re.compile(
    r"(?:\(\s*ж(?:ен(?:ский|ские|ская)?)?\.?\s*\)|\bженск(?:ий|ие|ая|ого)\b|\bжен\.?\b)",
    re.I,
)

# порядок важен: более узкие правила раньше
CAT_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("child_goods", re.compile(r"детск|ребён|ребен|для детей|\(дет", re.I)),
    ("wings", re.compile(r"крыл", re.I)),
    (
        "pets",
        re.compile(
            r"питомец|щенок|кот[её]?н|кот\b|собак|лисиц|медвеж|зайц|хомяк|"
            r"попуга|дракончик|самоед|мегалодон|гробик",
            re.I,
        ),
    ),
    (
        "tricks",
        re.compile(
            r"скейт|велосипед|самокат|транспорт|скутер|борд|машинк|"
            r"мопед|снегоход|экраноплан",
            re.I,
        ),
    ),
    (
        "packs",
        re.compile(r"^★?\s*набор\b|набор «|подарок «|сундук с|связка из", re.I),
    ),
    (
        "clothes",
        re.compile(
            r"костюм|парик|туфл|сапог|ботин|платье|штаны|юбка|рубаш|"
            r"куртк|пальто|жилет|перчат|очк[аи]|маска|шляп|кепк|"
            r"бант|ободок|серьг|кулон|украшен|облик|наряд|причёс|причес|"
            r"макияж|губы|ресниц|тату",
            re.I,
        ),
    ),
    (
        "items",
        re.compile(
            r"карт[аы]|билет|лотере|красител|краска|фон\b|рамка|стикер|"
            r"интерактив|торт|роз[аы]|молот|стрел|лили|сертификат|"
            r"премиум|визитк|облачк|трон|зонт",
            re.I,
        ),
    ),
]


def detect_gender(name: str, description: str = "") -> str | None:
    text = f"{name} {description}"
    m = bool(MALE_RE.search(text))
    f = bool(FEMALE_RE.search(text))
    if m and f:
        return "unisex"
    if m:
        return "m"
    if f:
        return "f"
    return None


def detect_badge(name: str) -> str | None:
    s = (name or "").lstrip()
    if s.startswith("☆"):
        return "event"
    if s.startswith("★"):
        return "temp"
    return None


def detect_category(name: str, description: str = "") -> tuple[str | None, str | None]:
    text = f"{name} {description}"
    for slug, rx in CAT_RULES:
        if rx.search(text):
            return slug, CATEGORIES[slug]
    return None, None


def main() -> int:
    if not ITEMS_FILE.exists():
        print(f"нет файла {ITEMS_FILE}", flush=True)
        return 1

    data = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    items = data.get("items") or []

    cat_hit = gender_hit = badge_hit = 0
    by_cat: dict[str, int] = {k: 0 for k in CATEGORIES}

    for it in items:
        name = str(it.get("name") or "")
        desc = str(it.get("description") or "")

        slug, title = detect_category(name, desc)
        it["category"] = slug
        it["categoryTitle"] = title
        it["categories"] = [slug] if slug else []
        if slug:
            cat_hit += 1
            by_cat[slug] += 1

        gender = detect_gender(name, desc)
        it["gender"] = gender
        if gender:
            gender_hit += 1

        badge = detect_badge(name)
        it["badge"] = badge
        if badge:
            badge_hit += 1

    data["items"] = items
    data["count"] = len(items)
    data["categories"] = CATEGORIES
    data["filterMeta"] = {
        "mode": "local_heuristics",
        "withCategory": cat_hit,
        "withGender": gender_hit,
        "withBadge": badge_hit,
        "byCategory": by_cat,
        "total": len(items),
    }

    tmp = ITEMS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(ITEMS_FILE)

    print(
        f"готово: category={cat_hit}/{len(items)}, gender={gender_hit}, badge={badge_hit}",
        flush=True,
    )
    print("по разделам:", by_cat, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

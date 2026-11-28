# -*- coding: utf-8 -*-
import json
import pathlib
import re
from urllib.parse import unquote

root = pathlib.Path(__file__).resolve().parent
bot = pathlib.Path(r"C:\Users\user\Desktop\vk_news_bot4")


def norm(s):
    s = str(s or "").lower().replace("ё", "е")
    s = s.replace("«", '"').replace("»", '"').replace("“", '"').replace("”", '"')
    s = re.sub(r"\s+", " ", s).strip()
    return s


def wiki_url_to_local(url):
    if not url:
        return ""
    m = re.search(r"/wiki/images/[0-9a-fA-F]/[0-9a-fA-F]{2}/([^/?#]+)$", str(url))
    if not m:
        return ""
    file = unquote(m.group(1))
    stem = pathlib.Path(file).stem
    for rel in (
        f"data/guide_img/{stem}.webp",
        f"data/look_img/{stem}.webp",
        f"data/look_img/{stem}.gif",
        f"data/wiki_img/{file}",
    ):
        if (root / rel).exists():
            return rel
    return f"data/guide_img/{stem}.webp"


def local_image_field(image, image_url):
    if image and str(image).startswith("data/"):
        rel = str(image)
        if rel.startswith("data/wiki_img/"):
            stem = pathlib.Path(rel).stem
            for cand in (
                f"data/guide_img/{stem}.webp",
                f"data/look_img/{stem}.webp",
                rel,
            ):
                if (root / cand).exists():
                    return cand
            return f"data/guide_img/{stem}.webp"
        if rel.startswith("data/title_img/"):
            stem = pathlib.Path(rel).stem
            thumb = f"data/title_thumb/{stem}.webp"
            if (root / thumb).exists():
                return thumb
            return rel
        return rel
    loc = wiki_url_to_local(image_url or "")
    if loc:
        return loc
    if image_url:
        return image_url
    if image and str(image).startswith("http"):
        return image
    return ""


index = {}


def add(name, thumb, kind="", score=0):
    if not name or not thumb:
        return
    k = norm(name)
    prev = index.get(k)
    if prev and prev.get("_score", 0) >= score:
        return
    index[k] = {"name": name, "thumb": thumb, "kind": kind, "_score": score}


wiki = json.loads((root / "data/wiki_items.json").read_text(encoding="utf-8"))
for it in wiki.get("items") or []:
    thumb = local_image_field(it.get("image"), it.get("imageUrl"))
    kind = it.get("kind") or ""
    score = 80 if kind == "achievements" else 50
    add(it.get("name"), thumb, kind, score)

titles = json.loads((root / "data/titles.json").read_text(encoding="utf-8"))
for it in titles.get("items") or []:
    thumb = local_image_field(it.get("image"), it.get("imageUrl"))
    add(it.get("name"), thumb, "titles", 70)

mall = json.loads((root / "data/items.json").read_text(encoding="utf-8"))
for it in mall.get("items") or []:
    thumb = local_image_field(
        it.get("lookImage") or it.get("image"),
        it.get("lookImage") or it.get("image"),
    )
    if not thumb or not str(thumb).startswith("data/"):
        thumb = it.get("lookImage") or it.get("image") or ""
    add(it.get("name"), thumb, it.get("category") or "shop", 40)


OVERRIDES = {
    norm("Черный краситель для туфельки"): "data/guide_img/wheel_dye_shoe_black.webp",
    norm("Желтый краситель для туфельки"): "data/guide_img/wheel_dye_shoe_yellow.webp",
    norm("Розовый краситель для туфельки"): "data/guide_img/wheel_dye_shoe_pink.webp",
    norm("Лазурный ковер-самолет"): "data/guide_img/1278BD41.webp",
}


def find_thumb(name):
    k = norm(name)
    if k in OVERRIDES and (root / OVERRIDES[k]).exists():
        return OVERRIDES[k]
    if k in index:
        thumb = index[k]["thumb"]
        # if mapped path missing on disk, try override / ignore dead path
        if thumb.startswith("data/") and not (root / thumb).exists():
            if k in OVERRIDES and (root / OVERRIDES[k]).exists():
                return OVERRIDES[k]
        else:
            return thumb
    for key, val in index.items():
        if k and (k in key or key in k):
            thumb = val["thumb"]
            if thumb.startswith("data/") and not (root / thumb).exists():
                continue
            return thumb
    if k in OVERRIDES and (root / OVERRIDES[k]).exists():
        return OVERRIDES[k]
    return ""


cache = json.loads((bot / "wheel_achievements_cache.json").read_text(encoding="utf-8"))
report = cache.get("report") or []
cat = json.loads((bot / "achievement_items_catalog.json").read_text(encoding="utf-8"))

# Стабильные id: только append. Если файл уже есть — не перенумеровываем.
ids_path = bot / "achievement_item_ids.json"
prev_ids = []
if ids_path.exists():
    try:
        prev_ids = json.loads(ids_path.read_text(encoding="utf-8")).get("items") or []
    except Exception:
        prev_ids = []

ach_items = []
seen = {}
for row in prev_ids:
    name = row.get("name") or ""
    key = norm(name)
    if not name or key in seen:
        continue
    iid = int(row.get("id") or 0)
    if iid <= 0:
        continue
    seen[key] = iid
    ach_items.append({"id": iid, "name": name, "thumb": find_thumb(name), "badges": []})

next_id = max((it["id"] for it in ach_items), default=0) + 1


def ensure_item(name):
    global next_id
    name = str(name or "").strip()
    if not name:
        return None
    key = norm(name)
    if key in seen:
        return seen[key]
    iid = next_id
    next_id += 1
    seen[key] = iid
    ach_items.append({"id": iid, "name": name, "thumb": find_thumb(name), "badges": []})
    return iid


# item_key -> set(badge)
badge_of = {}


def link_badge(name, badge):
    key = norm(name)
    if not key or not badge:
        return
    badge_of.setdefault(key, set()).add(badge)


for ach in cat.get("achievements") or []:
    badge = ach.get("badge") or ""
    for name in ach.get("items") or []:
        ensure_item(name)
        link_badge(name, badge)
    for name in ach.get("also") or []:
        ensure_item(name)
        link_badge(name, badge)
    for group in ach.get("sets") or []:
        for name in group or []:
            ensure_item(name)
            link_badge(name, badge)

for entry in report:
    badge = entry.get("badge") or ""
    for it in entry.get("items") or []:
        name = it.get("name") or ""
        ensure_item(name)
        link_badge(name, badge)

for entry in report:
    entry["badgeThumb"] = find_thumb(entry.get("badge"))
    for it in entry.get("items") or []:
        wn = (it.get("wheel_names") or [""])[0]
        it["thumb"] = find_thumb(it.get("name")) or find_thumb(wn)

# проставить badges на ACH_ITEMS
by_key = {norm(it["name"]): it for it in ach_items}
for key, badges in badge_of.items():
    row = by_key.get(key)
    if row:
        row["badges"] = sorted(badges, key=lambda s: s.lower())
        row["thumb"] = row.get("thumb") or find_thumb(row["name"])

on_ids = []
amb_ids = []
unc_ids = []
for entry in report:
    for it in entry.get("items") or []:
        key = norm(it.get("name"))
        iid = seen.get(key)
        if not iid:
            continue
        if it.get("on_wheel"):
            if iid not in on_ids:
                on_ids.append(iid)
        elif it.get("ambiguous"):
            if iid not in amb_ids and iid not in on_ids:
                amb_ids.append(iid)
        elif it.get("uncertain"):
            if iid not in unc_ids and iid not in on_ids and iid not in amb_ids:
                unc_ids.append(iid)

snap = {
    "source": "vk_news_bot4/wheel_achievements_cache.json",
    "ts": cache.get("ts"),
    "title": "Колесо · для значков",
    "report": report,
    "demo_i": ".".join(str(i) for i in on_ids),
    "demo_a": ".".join(str(i) for i in amb_ids),
    "demo_u": ".".join(str(i) for i in unc_ids),
}

# каталог: предметы из json + всё, что привязано к значку (краски и т.п.)
ach_out = []
items_by_badge = {}
for it in ach_items:
    for b in it.get("badges") or []:
        items_by_badge.setdefault(b, []).append(it)

for ach in cat.get("achievements") or []:
    badge = ach.get("badge") or ""
    names = []
    seen_n = set()
    for n in ach.get("items") or []:
        k = norm(n)
        if k in seen_n:
            continue
        seen_n.add(k)
        names.append(n)
    for it in items_by_badge.get(badge) or []:
        k = norm(it["name"])
        if k in seen_n:
            continue
        seen_n.add(k)
        names.append(it["name"])
    ach_out.append(
        {
            "badge": badge,
            "badgeThumb": find_thumb(badge),
            "require": ach.get("require") or "all",
            "items": [{"name": n, "thumb": find_thumb(n)} for n in names],
            "sets": ach.get("sets") or [],
            "set_labels": ach.get("set_labels") or [],
            "also": ach.get("also") or [],
        }
    )

thumbed = sum(1 for it in ach_items if it.get("thumb"))
rep_thumbs = sum(1 for e in report for it in e["items"] if it.get("thumb"))
rep_total = sum(len(e["items"]) for e in report)
print("ach_items", len(ach_items), "with thumb", thumbed)
print("report item thumbs", rep_thumbs, "/", rep_total)
print("badges", [(e["badge"], bool(e.get("badgeThumb"))) for e in report])

js = (
    "window.WHEEL_SNAPSHOT = "
    + json.dumps(snap, ensure_ascii=False)
    + ";\n"
    + "window.ACH_ITEMS = "
    + json.dumps(ach_items, ensure_ascii=False)
    + ";\n"
    + "window.ACH_CATALOG = "
    + json.dumps(ach_out, ensure_ascii=False)
    + ";\n"
)
(root / "wheel-data.js").write_text(js, encoding="utf-8")
(root / "wheel-snapshot.json").write_text(
    json.dumps(snap, ensure_ascii=False, indent=2), encoding="utf-8"
)

ids_payload = {
    "note": "Stable item ids for wheel.html?i= — append only, never renumber",
    "items": [
        {"id": it["id"], "name": it["name"], "badges": it.get("badges") or []}
        for it in sorted(ach_items, key=lambda x: x["id"])
    ],
}
ids_path.write_text(
    json.dumps(ids_payload, ensure_ascii=False, indent=2), encoding="utf-8"
)
(root / "achievement_item_ids.json").write_text(
    json.dumps(ids_payload, ensure_ascii=False, indent=2), encoding="utf-8"
)

print("wrote wheel-data.js", (root / "wheel-data.js").stat().st_size)
print("demo_i", snap["demo_i"])
print("ids", len(ach_items), "->", ids_path.name)

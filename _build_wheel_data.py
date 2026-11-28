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
    s = s.replace("★", " ").replace("*", " ")
    s = re.sub(r"\s+", " ", s).strip()
    s = s.strip('"').strip()
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


# name → список кандидатов (одно имя: значок и развлечение «Трон Амура»)
index = {}
badge_ids = {}


def add(name, thumb, kind="", score=0, item_id=None):
    if not name or not thumb:
        return
    k = norm(name)
    row = {
        "name": name,
        "thumb": thumb,
        "kind": kind or "",
        "_score": score,
        "id": int(item_id) if item_id is not None else None,
    }
    bucket = index.setdefault(k, [])
    for prev in bucket:
        if prev.get("kind") == row["kind"] and prev.get("id") == row["id"]:
            if row["_score"] > prev.get("_score", 0):
                prev.update(row)
            return
    bucket.append(row)


wiki = json.loads((root / "data/wiki_items.json").read_text(encoding="utf-8"))
for it in wiki.get("items") or []:
    thumb = local_image_field(it.get("image"), it.get("imageUrl"))
    kind = it.get("kind") or ""
    score = 80 if kind == "achievements" else 50
    add(it.get("name"), thumb, kind, score, it.get("id"))
    if kind == "achievements" and it.get("id") is not None:
        badge_ids[norm(it.get("name"))] = int(it["id"])

titles = json.loads((root / "data/titles.json").read_text(encoding="utf-8"))
for it in titles.get("items") or []:
    thumb = local_image_field(it.get("image"), it.get("imageUrl"))
    add(it.get("name"), thumb, "titles", 70, it.get("id"))

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


def _thumb_ok(thumb):
    if not thumb:
        return False
    if str(thumb).startswith("data/") and not (root / thumb).exists():
        return False
    return True


def _pick_candidate(cands, for_badge=False):
    if not cands:
        return None
    alive = [c for c in cands if _thumb_ok(c.get("thumb"))]
    pool = alive or list(cands)

    def rank(c):
        kind = c.get("kind") or ""
        is_ach = kind == "achievements"
        # значок → картинка достижения; предмет → не значок (трон ≠ бейдж)
        kind_rank = (0 if is_ach else 1) if for_badge else (1 if is_ach else 0)
        return (kind_rank, -int(c.get("_score") or 0))

    pool.sort(key=rank)
    return pool[0]


def find_entry(name, for_badge=False):
    k = norm(name)
    if not for_badge and k in OVERRIDES and (root / OVERRIDES[k]).exists():
        return {"name": name, "thumb": OVERRIDES[k], "kind": "", "id": None}
    if k in index:
        pick = _pick_candidate(index[k], for_badge=for_badge)
        if pick and (for_badge or (pick.get("kind") or "") != "achievements"):
            return pick
        if for_badge and pick:
            return pick
    # нечёткий хвост: длинные совпадения важнее; для предметов не цепляем значки
    fuzzy = []
    for key, vals in index.items():
        if not k or not key:
            continue
        if not (k in key or key in k):
            continue
        # «краска бовуар» не должна взять значок «бовуар» только из-за подстроки
        if not for_badge:
            vals = [v for v in vals if (v.get("kind") or "") != "achievements"]
            if not vals:
                continue
            # слишком короткое имя значка/предмета внутри длинного запроса — слабый матч
            if len(key) < 6 and key in k and key != k:
                continue
        overlap = min(len(k), len(key))
        for v in vals:
            fuzzy.append((overlap, v))
    fuzzy.sort(key=lambda t: -t[0])
    pick = _pick_candidate([v for _, v in fuzzy], for_badge=for_badge)
    if pick:
        return pick
    if k in OVERRIDES and (root / OVERRIDES[k]).exists():
        return {"name": name, "thumb": OVERRIDES[k], "kind": "", "id": None}
    return None


def find_thumb(name, for_badge=False):
    ent = find_entry(name, for_badge=for_badge)
    return (ent or {}).get("thumb") or ""


cache_path = bot / "wheel_achievements_cache.json"
cat_path = bot / "achievement_items_catalog.json"
local_snap = root / "wheel-snapshot.json"
if cache_path.exists():
    cache = json.loads(cache_path.read_text(encoding="utf-8"))
    report = cache.get("report") or []
else:
    cache = json.loads(local_snap.read_text(encoding="utf-8")) if local_snap.exists() else {}
    report = cache.get("report") or []
    print("warn: no bot cache, using", local_snap.name)

if cat_path.exists():
    cat = json.loads(cat_path.read_text(encoding="utf-8"))
else:
    # минимальный каталог из уже собранного report / ACH_CATALOG
    cat = {"achievements": []}
    local_js = root / "wheel-data.js"
    if local_js.exists():
        class _Win:
            pass

        ns = {"window": _Win(), "true": True, "false": False, "null": None}
        exec(local_js.read_text(encoding="utf-8"), ns)
        catalog = getattr(ns["window"], "ACH_CATALOG", None) or ns.get("ACH_CATALOG") or []
        for row in catalog:
            cat["achievements"].append(
                {
                    "badge": row.get("badge"),
                    "require": row.get("require") or "all",
                    "items": [it.get("name") for it in (row.get("items") or []) if it.get("name")],
                    "sets": row.get("sets") or [],
                    "set_labels": row.get("set_labels") or [],
                    "also": row.get("also") or [],
                    "description": row.get("description") or "",
                }
            )
    print("warn: no achievement_items_catalog, rebuilt from wheel-data.js:", len(cat["achievements"]))

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
    badge = entry.get("badge") or ""
    entry["badgeThumb"] = find_thumb(badge, for_badge=True)
    bid = badge_ids.get(norm(badge))
    if bid:
        entry["badgeId"] = bid
    for it in entry.get("items") or []:
        wn = (it.get("wheel_names") or [""])[0]
        ent = find_entry(it.get("name")) or find_entry(wn)
        it["thumb"] = (ent or {}).get("thumb") or find_thumb(it.get("name")) or find_thumb(wn)
        if ent and ent.get("kind") and ent["kind"] != "achievements":
            it["guideSection"] = ent["kind"]
            if ent.get("id"):
                it["guideId"] = ent["id"]

# проставить badges на ACH_ITEMS
by_key = {norm(it["name"]): it for it in ach_items}
for key, badges in badge_of.items():
    row = by_key.get(key)
    if row:
        row["badges"] = sorted(badges, key=lambda s: s.lower())
        row["thumb"] = row.get("thumb") or find_thumb(row["name"], for_badge=False)

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

def unlock_meta(description, item_names):
    d = norm(description)
    interactives = ("интерактив" in d) and (
        "разблокир" in d or "все интерактив" in d or "интерактив" in d and "цвет" in d
    )
    # не путать с «предмет для интерактивов»
    if "предмет для интерактив" in d and "разблокир" not in d:
        interactives = False
    all_colors = (
        "все цвета" in d
        or "всех цвет" in d
        or ("разблокир" in d and "цвет" in d)
    )
    has_paints = any(re.search(r"краск|красител", n or "", re.I) for n in item_names)
    if has_paints:
        all_colors = False  # цвета уже отдельными строками
    targets = []
    for q in re.findall(r'[«"„]([^»"“]{2,80})[»"“]', description or ""):
        qk = norm(q).replace('"', "")
        for n in item_names:
            if re.search(r"краск|красител", n or "", re.I):
                continue
            nk = norm(n).replace('"', "")
            if qk and (qk == nk or qk in nk or nk in qk):
                if n not in targets:
                    targets.append(n)
    if interactives and not targets:
        targets = [
            n
            for n in item_names
            if n and not re.search(r"краск|красител", n or "", re.I)
        ]
    if not interactives and not all_colors:
        return {}
    return {
        "interactives": bool(interactives),
        "allColors": bool(all_colors),
        "targets": targets,
    }


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
    items_out = []
    for n in names:
        ent = find_entry(n)
        row_it = {"name": n, "thumb": (ent or {}).get("thumb") or find_thumb(n)}
        if ent and ent.get("kind") and ent["kind"] != "achievements":
            row_it["guideSection"] = ent["kind"]
            if ent.get("id"):
                row_it["guideId"] = ent["id"]
        items_out.append(row_it)
    row = {
        "badge": badge,
        "badgeThumb": find_thumb(badge, for_badge=True),
        "require": ach.get("require") or "all",
        "items": items_out,
        "sets": ach.get("sets") or [],
        "set_labels": ach.get("set_labels") or [],
        "also": ach.get("also") or [],
        "description": ach.get("description") or "",
    }
    bid = badge_ids.get(norm(badge))
    if bid:
        row["badgeId"] = bid
    u = unlock_meta(ach.get("description") or "", names)
    if u:
        row["unlock"] = u
    ach_out.append(row)

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
(root / "achievement_item_ids.json").write_text(
    json.dumps(ids_payload, ensure_ascii=False, indent=2), encoding="utf-8"
)
try:
    ids_path.parent.mkdir(parents=True, exist_ok=True)
    ids_path.write_text(
        json.dumps(ids_payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("ids", len(ach_items), "->", ids_path)
except OSError as exc:
    print("warn: skip bot ids file:", exc)

print("wrote wheel-data.js", (root / "wheel-data.js").stat().st_size)
print("demo_i", snap["demo_i"])

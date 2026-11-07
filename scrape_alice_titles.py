#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Титулы из обмена подарков у Алисы → дополнение data/titles.json

Страница:
  https://parapa.ru/wiki/index.php/Алиса_обмен_подарков

Логика:
  - в таблице «Титулы» ищем «Подарок с титулом "…"» / «Титул "…"»
  - по гиперссылке на подарок открываем страницу подарка
  - оттуда берём реальное имя титула (в кавычках) и картинку
  - в одном подарке может быть несколько титулов (ж/м, на выбор)

Запуск:
  py -3 scrape_alice_titles.py
  py -3 scrape_alice_titles.py --from-cache
  py -3 scrape_alice_titles.py --skip-download
"""

from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data"
TITLES_FILE = OUT / "titles.json"
CACHE = OUT / "_wiki_page_Алиса_обмен_подарков.html"
GIFT_CACHE_DIR = OUT / "_alice_gifts"
CATEGORY = "Алиса (обмен подарков)"
SOURCE_TAG = "Алиса (обмен подарков)"
PAGE = "Алиса_обмен_подарков"
# общий значок подарка/титула на вики — НЕ скрин титула
GIFT_ICON_RE = re.compile(r"3d077203ce\.png", re.I)


def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", " ", html or "")


def clean(s: str) -> str:
    s = unescape(s or "")
    s = s.replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s.strip(" «»\"„“”'").strip()


def norm_key(name: str) -> str:
    s = clean(name).casefold().replace("ё", "е")
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"[!.…]+$", "", s)
    s = re.sub(r"\s*\.\s*", ".", s)  # Искра. Буря. → Искра.Буря.
    s = re.sub(r"\s+", " ", s).strip()
    return s


def abs_img(url: str) -> str:
    url = (url or "").split("?")[0]
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("/"):
        return "https://parapa.ru" + url
    return url


def is_gift_icon(url: str) -> bool:
    return bool(url and GIFT_ICON_RE.search(url))


def title_img(url: str) -> str:
    """Абсолютный URL картинки титула; пусто если это общий значок подарка."""
    url = abs_img(url)
    return "" if is_gift_icon(url) else url


def fetch_page(title: str) -> str:
    import importlib.util

    spec = importlib.util.spec_from_file_location("sc", ROOT / "scrape_wiki_items.py")
    sc = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(sc)
    op = sc.opener()
    return sc.fetch_html(op, title)


def titles_section_html(html: str) -> str:
    m = re.search(
        r">Титулы</span>\s*</h3>([\s\S]*?)(?=<h3[\s>])",
        html,
        re.I,
    )
    if m:
        return m.group(1)
    m = re.search(
        r'id="[^"]*Титул[^"]*"[^>]*>[\s\S]*?</h3>([\s\S]*?)(?=<h3[\s>])',
        html,
        re.I,
    )
    return m.group(1) if m else html


def _first_quoted(s: str) -> str:
    qm = re.search(r'[«"„]([^»"“]+)[»"]', s or "")
    return clean(qm.group(1)) if qm else ""


def parse_alice_rows(sec: str) -> list[dict]:
    """Строки таблицы «Титулы»: Титул/Подарок/Набор/цветной титул."""
    rows: list[dict] = []
    for tr in re.findall(r"<tr>([\s\S]*?)</tr>", sec, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", tr, re.I)
        if len(cells) < 2:
            continue
        cell0 = cells[0]
        cost = clean(strip_tags(cells[1])) if len(cells) > 1 else ""
        cell_raw = unescape(strip_tags(cell0) or "")
        cell_raw = re.sub(r"\s+", " ", cell_raw.replace("\xa0", " ")).strip()
        if not cell_raw or cell_raw.casefold().startswith("наименование"):
            continue

        pack_label = ""
        gift_href = ""
        direct_img = ""
        is_gift_pack = False

        links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)</a>', cell0, re.I)
        for href, lab_html in links:
            # не clean() до извлечения кавычек — иначе срежется закрывающая "
            lab_raw = unescape(strip_tags(lab_html) or "")
            lab_raw = re.sub(r"\s+", " ", lab_raw.replace("\xa0", " ")).strip()
            if not lab_raw:
                continue

            # Титул / Синий титул / Красный титул / Подарок с титулом / Подарок "…"
            hm = re.match(
                r"^(?:"
                r"Подарок с (?:титулом|радужным титулом)"
                r"|Набор с титулом"
                r"|(?:Синий|Красный)\s+титул"
                r"|Титул"
                r"|Подарок"
                r")\s*(.*)$",
                lab_raw,
                re.I,
            )
            if hm:
                rest = (hm.group(1) or "").strip()
                name = _first_quoted(rest) or _first_quoted(lab_raw) or clean(rest)
                kind_is_gift = bool(re.match(r"^(Подарок|Набор)", lab_raw, re.I))
                if kind_is_gift:
                    is_gift_pack = True
                    pack_label = name or clean(lab_raw)
                    if "/wiki/images/" in href:
                        direct_img = title_img(href) or direct_img
                    elif "/index.php/" in href or "wiki" in href:
                        gift_href = href
                else:
                    pack_label = name or pack_label
                    if "/wiki/images/" in href:
                        direct_img = title_img(href) or direct_img
                    elif "/index.php/" in href:
                        gift_href = href
                continue

            # ссылка только на кавычки:  Подарок с титулом <a>"Name"</a>
            only_q = _first_quoted(lab_raw)
            if only_q and re.search(
                r"(?:Подарок|Набор)\s+с\s+(?:радужным\s+)?титулом", cell_raw, re.I
            ):
                is_gift_pack = True
                pack_label = only_q
                if "/wiki/images/" in href:
                    direct_img = title_img(href) or direct_img
                elif "/index.php/" in href:
                    gift_href = href
                continue

            # Подарок "Name" где текст ссылки — целиком подарок (уже выше) /
            # или картинка с подписью Подарок "…"
            if only_q and re.search(r"^Подарок\b", cell_raw, re.I):
                is_gift_pack = True
                pack_label = only_q
                if "/wiki/images/" in href:
                    direct_img = title_img(href) or direct_img
                elif "/index.php/" in href:
                    gift_href = href

        # plain text без подходящей ссылки: Набор с титулом "…", Подарок арифметика
        if not pack_label:
            hm = re.match(
                r"^(?:"
                r"Подарок с (?:титулом|радужным титулом)"
                r"|Набор с титулом"
                r"|(?:Синий|Красный)\s+титул"
                r"|Титул"
                r"|Подарок"
                r")\s*(.*)$",
                cell_raw,
                re.I,
            )
            if hm:
                rest = (hm.group(1) or "").strip()
                name = _first_quoted(cell_raw) or clean(rest)
                if name:
                    pack_label = name
                    is_gift_pack = bool(re.match(r"^(Подарок|Набор)", cell_raw, re.I))
                    # угадать wiki-страницу подарка, если нет href
                    if is_gift_pack and not gift_href:
                        if re.search(r"радужным\s+титулом", cell_raw, re.I):
                            gift_href = "/wiki/index.php/Подарок_с_радужным_титулом"
                        elif re.search(r"Набор с титулом", cell_raw, re.I):
                            gift_href = f"/wiki/index.php/Набор_с_титулом_{name.replace(' ', '_')}"
                        elif re.search(r"Подарок с титулом", cell_raw, re.I):
                            gift_href = f"/wiki/index.php/Подарок_с_титулом_{name.replace(' ', '_')}"
                        else:
                            gift_href = f"/wiki/index.php/Подарок_{name.replace(' ', '_')}"

        if not pack_label and not gift_href and not direct_img:
            continue
        if pack_label.casefold() in {"ом", "титул", "ы", "подарок"}:
            continue
        rows.append(
            {
                "packLabel": pack_label,
                "giftHref": gift_href,
                "directImg": direct_img,
                "cost": cost,
                "isGiftPack": is_gift_pack,
            }
        )
    return rows


def gift_page_title(href: str) -> str:
    raw = href.split("/index.php/")[-1]
    raw = raw.split("#")[0].split("?")[0]
    return urllib.parse.unquote(raw.replace(" ", "_"))


def parse_gift_page(html: str, fallback_name: str) -> list[dict]:
    """Реальные титулы внутри подарка: имя + картинка."""
    out: list[dict] = []
    seen: set[str] = set()

    def add(name: str, url: str, note: str = "") -> None:
        name = clean(name)
        if not name or len(name) < 2 or len(name) > 80:
            return
        if re.search(r"[<>={}]|href:|https?:|/wiki/", name, re.I):
            return
        # не принимать имя самого подарка/служебное
        if re.fullmatch(
            r"(титул|титула|титулов|подарок|набор|иконка.*|новый титул|отличный титул|особый титул)",
            name,
            re.I,
        ):
            return
        key = norm_key(name)
        if key in seen:
            return
        seen.add(key)
        out.append({"name": name, "imageUrl": title_img(url) if url else "", "note": note})

    # только тело статьи — без навигации/категорий (ломают кавычки в title="Титул")
    body_m = re.search(
        r'class="mw-parser-output"([^>]*)>([\s\S]*?)</div>\s*<!--',
        html,
        re.I,
    )
    body = body_m.group(2) if body_m else html

    # 1) титул "X" / титул для парней "X" → image
    # важно: кавычки снимать ПОСЛЕ извлечения имени (иначе "…?" ломается)
    for m in re.finditer(
        r'<a[^>]+href="([^"]+/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"[^>]*>\s*'
        r'([^<]*титул[^<]{0,100})</a>',
        body,
        re.I,
    ):
        url = m.group(1)
        lab_raw = unescape(m.group(2) or "")
        lab_raw = re.sub(r"\s+", " ", lab_raw.replace("\xa0", " ")).strip()
        if re.fullmatch(r"(?:новый |отличный |особый )?титул", lab_raw, re.I):
            # без имени — ниже из подписи/fallback
            if re.search(r"отличный|новый|особый", lab_raw, re.I):
                cm = re.search(r'титулом\s*[«"„]([^»"“]+)[»"]', body, re.I)
                name = cm.group(1) if cm else fallback_name
                add(name, url)
            continue
        name = ""
        qm = re.search(r'[«"„](.+?)[»"]', lab_raw)
        if qm:
            name = qm.group(1)
        gender = ""
        gm = re.search(r"для\s+(парней|девушек)", lab_raw, re.I)
        if gm:
            gender = "парней" if "парн" in gm.group(1).lower() else "девушек"
        note = f"для {gender}" if gender else ""
        if name:
            add(name, url, note)

    # 2) титул "X" в видимом тексте (без HTML-атрибутов)
    body_text = strip_tags(body)
    body_text = unescape(body_text)
    body_text = re.sub(r"\s+", " ", body_text.replace("\xa0", " "))
    for m in re.finditer(
        r'титул(?:\s+для\s+(?:парней|девушек))?\s*[«"„]([^»"“]+)[»"]',
        body_text,
        re.I,
    ):
        name = m.group(1)
        # картинка: ищем в body по имени в подписи ссылки или рядом
        url = ""
        qn = re.escape(name)
        im = re.search(
            rf'href="([^"]+/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"[^>]*>[^<]*{qn}',
            body,
            re.I,
        )
        if not im:
            im = re.search(
                rf'{qn}[^<]{{0,40}}</a>[^<]{{0,80}}href="([^"]+/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"',
                body,
                re.I,
            )
        if im:
            url = im.group(1)
        add(name, url)

    # 3) списки содержимого: <li><a href=image>Имя титула</a></li>
    #    (как в «Подарок арифметика» — без слова «титул»)
    for m in re.finditer(
        r'<li>\s*<a[^>]+href="([^"]+/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"[^>]*>\s*'
        r"([^<]{2,80})</a>\s*</li>",
        body,
        re.I,
    ):
        lab = unescape(m.group(2) or "")
        lab = re.sub(r"\s+", " ", lab.replace("\xa0", " ")).strip()
        if re.search(r"титул|подар|иконк", lab, re.I):
            q = _first_quoted(lab)
            if q:
                add(q, m.group(1))
            continue
        add(lab, m.group(1))

    # как получить
    how = ""
    hm = re.search(
        r"Приобрести можно:\s*</b>\s*([\s\S]*?)(?:</p>|<h2)",
        html,
        re.I,
    )
    if hm:
        how = clean(strip_tags(hm.group(1)))
    else:
        hm = re.search(
            r"Необходимо для обмена у Алисы\s*:\s*([\s\S]*?)(?:</p>|<h2)",
            html,
            re.I,
        )
        if hm:
            how = "Обмен у Алисы: " + clean(strip_tags(hm.group(1)))

    for it in out:
        it["how"] = how
    return out


def find_existing(items: list[dict], name: str) -> dict | None:
    key = norm_key(name)
    for it in items:
        if norm_key(it.get("name") or "") == key:
            return it
    # soft: startswith / contained without punctuation
    compact = re.sub(r"[^\wа-яё]+", "", key, flags=re.I)
    if len(compact) < 4:
        return None
    for it in items:
        other = re.sub(r"[^\wа-яё]+", "", norm_key(it.get("name") or ""), flags=re.I)
        if other == compact:
            return it
    return None


def merge_source(old: str, extra: str) -> str:
    old = (old or "").strip()
    extra = (extra or "").strip()
    if not extra:
        return old
    if not old:
        return extra
    if SOURCE_TAG.lower() in old.lower():
        # already mentions Alice; append cost detail if useful and short
        if extra not in old and len(extra) < 120 and "обмен" in extra.lower():
            return f"{old}; {extra}"
        return old
    return f"{old}, {extra}" if old else extra


def download_missing_images(items: list[dict]) -> int:
    """Скачать imageUrl без локального image."""
    import http.cookiejar
    import ssl
    import urllib.request

    try:
        from download_title_shots import COOKIE_FILE as _CF  # type: ignore
        from download_title_shots import fetch
    except Exception:
        from download_title_shots import fetch

        _CF = OUT / "cookies.txt"

    jar = http.cookiejar.MozillaCookieJar(str(_CF))
    try:
        jar.load(ignore_discard=True, ignore_expires=True)
    except Exception:
        jar = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    IMG = OUT / "title_img"
    IMG.mkdir(parents=True, exist_ok=True)
    ok = 0
    for it in items:
        url = title_img(it.get("imageUrl") or "")
        if not url:
            continue
        # выкинуть локальный общий значок подарка
        if is_gift_icon(str(it.get("image") or "")):
            it["image"] = None
        if it.get("image") and Path(str(it["image"])).exists():
            continue
        stem = Path(urllib.parse.unquote(urllib.parse.urlsplit(url).path)).stem
        stem = re.sub(r"[^\w.\-А-Яа-яЁё]+", "_", stem, flags=re.UNICODE).strip("._") or "title"
        dest = IMG / f"{stem}.png"
        if dest.exists() and dest.stat().st_size > 200:
            it["image"] = f"data/title_img/{dest.name}"
            ok += 1
            continue
        try:
            raw = fetch(op, url)
            dest.write_bytes(raw)
            it["image"] = f"data/title_img/{dest.name}"
            ok += 1
            print("  +", dest.name)
        except Exception as e:
            print("  FAIL", url[:70], e)
        time.sleep(0.05)
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-cache", action="store_true")
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()

    if not TITLES_FILE.exists():
        print("нет", TITLES_FILE)
        return 1

    data = json.loads(TITLES_FILE.read_text(encoding="utf-8"))
    items: list[dict] = list(data.get("items") or [])
    # убрать ошибочно добавленное имя подарка «арифметика» (внутри — др. титулы)
    items = [
        it
        for it in items
        if norm_key(it.get("name") or "") != norm_key("арифметика")
    ]
    before = len(items)

    if args.from_cache and CACHE.exists():
        html = CACHE.read_text(encoding="utf-8", errors="replace")
        print("cache", CACHE.name, len(html))
    else:
        print("fetch", PAGE)
        html = fetch_page(PAGE)
        CACHE.write_text(html, encoding="utf-8")

    sec = titles_section_html(html)
    rows = parse_alice_rows(sec)
    print("alice title rows", len(rows))

    GIFT_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    added = 0
    updated = 0
    resolved = 0

    for row in rows:
        pack = row["packLabel"]
        cost = row["cost"]
        source = SOURCE_TAG
        if cost:
            source = f"{SOURCE_TAG}. {cost}"

        resolved_titles: list[dict] = []
        if row["giftHref"]:
            page = gift_page_title(row["giftHref"])
            cache_path = GIFT_CACHE_DIR / (re.sub(r"[^\w.\-А-Яа-яЁё]+", "_", page)[:120] + ".html")
            try:
                if args.from_cache and cache_path.exists():
                    ghtml = cache_path.read_text(encoding="utf-8", errors="replace")
                else:
                    ghtml = fetch_page(page)
                    cache_path.write_text(ghtml, encoding="utf-8")
                # empty wiki page?
                if "нет текста" in ghtml.lower() and "mw-parser-output" in ghtml:
                    # still try parse; may be empty
                    pass
                resolved_titles = parse_gift_page(ghtml, pack)
            except Exception as e:
                print("  gift FAIL", page, e)

        if not resolved_titles:
            # имя с витрины / прямая картинка (не анонимный «радужный подарок»)
            if pack and not re.search(r"^подарок с радужным", pack, re.I):
                resolved_titles = [
                    {
                        "name": pack,
                        "imageUrl": row["directImg"] or "",
                        "note": "",
                        "how": cost,
                    }
                ]

        for rt in resolved_titles:
            name = clean(rt["name"])
            if not name or len(name) < 2:
                continue
            resolved += 1
            how = rt.get("how") or cost
            note_bits = []
            if rt.get("note"):
                note_bits.append(rt["note"])
            if pack and norm_key(pack) != norm_key(name) and not re.search(r"^подарок", pack, re.I):
                note_bits.append(f'Подарок: «{pack}»')
            elif pack and re.search(r"радужн|хэллоуин|подар", pack, re.I) and norm_key(pack) != norm_key(name):
                note_bits.append(f'Подарок: «{pack}»')
            note = " · ".join(note_bits)

            existing = find_existing(items, name)
            src_line = SOURCE_TAG
            if how:
                src_line = f"{SOURCE_TAG}. {how}" if SOURCE_TAG.lower() not in how.lower() else how

            if existing:
                before_src = existing.get("source") or ""
                existing["source"] = merge_source(before_src, src_line)
                if note and note not in (existing.get("note") or ""):
                    existing["note"] = (existing.get("note") + " · " if existing.get("note") else "") + note
                new_url = title_img(rt.get("imageUrl") or "")
                old_img = str(existing.get("image") or "")
                old_url = str(existing.get("imageUrl") or "")
                if new_url and (
                    (not old_url and not old_img)
                    or is_gift_icon(old_url)
                    or is_gift_icon(old_img)
                ):
                    existing["imageUrl"] = new_url
                    if is_gift_icon(old_img):
                        existing["image"] = None
                # витрина Алисы — категория фильтра
                existing["category"] = CATEGORY
                if existing.get("source") != before_src or new_url:
                    updated += 1
            else:
                items.append(
                    {
                        "id": 0,
                        "name": name,
                        "description": how or f"Обмен подарков у Алисы" + (f" (подарок «{pack}»)" if pack else ""),
                        "source": src_line,
                        "note": note,
                        "op": 0,
                        "color": "none",
                        "category": CATEGORY,
                        "imageUrl": rt.get("imageUrl") or "",
                        "image": None,
                    }
                )
                added += 1

    # stable ids
    for i, it in enumerate(items, 1):
        it["id"] = i

    by_cat: dict[str, int] = {}
    by_op: dict[str, int] = {}
    for it in items:
        by_cat[it.get("category") or "Прочее"] = by_cat.get(it.get("category") or "Прочее", 0) + 1
        by_op[str(it.get("op", 0))] = by_op.get(str(it.get("op", 0)), 0) + 1

    data["items"] = items
    data["count"] = len(items)
    data["byCategory"] = by_cat
    data["byOp"] = by_op
    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    data["aliceGifts"] = {
        "page": f"https://parapa.ru/wiki/index.php/{urllib.parse.quote(PAGE)}",
        "rows": len(rows),
        "resolved": resolved,
        "added": added,
        "updated": updated,
    }
    TITLES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"titles {before} → {len(items)} (+{added}, updated {updated}, resolved {resolved})")

    if not args.skip_download:
        # only download for newly added / missing local alice-related
        need = [
            it
            for it in items
            if it.get("imageUrl")
            and not it.get("image")
            and SOURCE_TAG.lower() in (it.get("source") or "").lower()
        ]
        print("download images", len(need))
        n = download_missing_images(need)
        print("downloaded/linked", n)
        TITLES_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

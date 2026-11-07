#!/usr/bin/env python3
"""
Ссылки из описаний и «Способа получения» на вики Parapa.

В JSON у записи появляются поля descriptionLinks / sourceLinks / noteLinks:
  {text, href, title?, kind: item|event|other, section?, itemId?}

kind=item — страница предмета, который есть в справочнике (внутренний переход).
kind=event — событие, конкурс, рейтинг, тема форума (внешняя вики/форум).
kind=other — прочая информационная страница.

Запуск (локальные дампы data/_wiki_page_*.html, без обхода всей вики):
  py -3 wiki_links.py
"""

from __future__ import annotations

import json
import re
import urllib.parse
from collections import defaultdict
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
TITLES_FILE = DATA / "titles.json"
WIKI_FILE = DATA / "wiki_items.json"
TITLES_HTML = DATA / "_wiki_page_Способы_получения_титулов.html"

LINK_FIELDS = ("description", "source", "note")
LINK_KEYS = tuple(f"{name}Links" for name in LINK_FIELDS)

A_RE = re.compile(r"<a\b([^>]*)>([\s\S]*?)</a>", re.I)
HREF_RE = re.compile(r'href="([^"]+)"', re.I)
TITLE_RE = re.compile(r'title="([^"]*)"', re.I)
SKIP_TEXT_RE = re.compile(r"^(да|нет|—|-|–|−|\(м\)|\(ж\)|м|ж)$", re.I)
EVENT_RE = re.compile(
    r"охот|конкурс|рейтинг|событи|фестив|турнир|колес|лотере|парад|чемпионат|марафон|обновлен",
    re.I,
)
QUOTE_RE = re.compile(r'["«„]([^"»“”]{2,80})["»“”]')

# Заголовок страницы-каталога → раздел справочника.
# Ссылка на такой каталог не является страницей конкретного предмета,
# пока в тексте ссылки не назван предмет этого раздела.
SECTION_BY_PAGE = {
    "достижения": "achievements",
    "крылья": "wings",
    "питомцы": "pets",
    "транспорт": "transport",
    "аксессуары": "accessories",
    "прически": "hairstyles",
    "прически с событий": "hairstyles",
    "интерактивные предметы": "interactive",
    "жезлы": "wands",
    "зонты": "umbrellas",
    "рюкзаки": "backpacks",
    "гитара на спину": "backpacks",
    "шарики": "balloons",
    "украшения (рука)": "hand_decor",
    "украшения рука": "hand_decor",
    "игрушки на плечо": "toys",
    "игрушки на ногу": "toys",
    "интерактивная обувь": "shoes",
    "детские маски": "kids_masks",
    "букеты": "bouquets",
    "лук": "bows",
    "развлечения": "amusements",
    "облик": "forms",
    "камни": "gems",
    "интерактивы": "emotes",
    "фон для визитки": "card_bg",
    "фон для шоу": "show_bg",
    "рамка для визитки": "card_frame",
    "стикеры": "stickers",
    "одежда с событий": "event_clothes",
    "детская одежда": "kids_clothes",
    "титул": "titles",
    "титулы": "titles",
    "способы получения титулов": "titles",
}

STANDARD_KINDS = {
    "wings",
    "transport",
    "accessories",
    "hairstyles",
    "interactive",
    "wands",
    "umbrellas",
    "backpacks",
    "balloons",
    "hand_decor",
    "toys",
    "shoes",
    "kids_masks",
    "bouquets",
    "bows",
    "amusements",
    "forms",
    "stickers",
}
NAME_VIEW_KINDS = {"card_bg", "show_bg", "card_frame"}


def plain_text(html: str) -> str:
    s = re.sub(r"<br\s*/?>", " ", html or "", flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = unescape(s).replace("\xa0", " ").replace("\u200b", "")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def norm_name(s: str) -> str:
    s = plain_text(s) if "<" in (s or "") else (s or "")
    s = s.replace("ё", "е").replace("Ё", "е")
    s = re.sub(r"\s+", " ", s).strip().casefold()
    s = s.strip(".").strip()
    return s


def norm_key(s: str) -> str:
    s = unescape(s or "")
    s = s.replace("ё", "е").replace("Ё", "е")
    s = s.replace("_", " ")
    for src, dst in (
        ("«", '"'),
        ("»", '"'),
        ("„", '"'),
        ("“", '"'),
        ("”", '"'),
    ):
        s = s.replace(src, dst)
    s = s.replace('"', "")
    s = re.sub(r"\s+", " ", s).strip().casefold()
    return s


def text_in_field(text: str, field: str) -> bool:
    if not text or not field:
        return False
    if text in field:
        return True
    parts = [re.escape(p) for p in text.split() if p]
    if not parts:
        return False
    return re.search(r"\s+".join(parts), field) is not None


def wiki_page_title(href: str) -> str:
    raw = unescape(href or "").strip()
    if not raw:
        return ""
    parts = urllib.parse.urlsplit(raw)
    path = urllib.parse.unquote(parts.path or raw)
    title = ""
    if "index.php/" in path:
        title = path.split("index.php/", 1)[1]
    elif "/wiki/" in path:
        title = path.split("/wiki/", 1)[1]
    else:
        return ""
    title = title.split("?")[0].strip("/")
    if not title:
        return ""
    low = title.casefold()
    if low.startswith("файл:") or low.startswith("file:") or low.startswith("служебная:"):
        return ""
    return title.replace("_", " ").strip()


def abs_href(href: str) -> str:
    href = unescape(href or "").strip()
    if href.startswith("//"):
        href = "https:" + href
    elif href.startswith("/"):
        href = "https://parapa.ru" + href
    if href.startswith("http://") and "parapa.ru" in href:
        href = "https://" + href[len("http://") :]
    href = href.split("#", 1)[0]
    return href


def keep_href(href: str, attrs: str) -> bool:
    low = unescape(href or "").strip().casefold()
    attrs_l = (attrs or "").casefold()
    if not low or low.startswith("#") or low.startswith("javascript:"):
        return False
    if "redlink=1" in low or "action=edit" in low:
        return False
    if 'class="new"' in attrs_l or "class='new'" in attrs_l:
        return False
    if "/wiki/images/" in low:
        return False
    if "/файл:" in low or "/file:" in low:
        return False
    if 'class="image"' in attrs_l or "class='image'" in attrs_l:
        return False
    if "служебная:" in low or "/special:" in low:
        return False
    return True


def links_in_html(fragment: str) -> list[dict]:
    """Навигационные ссылки ячейки. Картинки и «Да/Нет» не берём."""
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for m in A_RE.finditer(fragment or ""):
        attrs, inner = m.group(1), m.group(2)
        hm = HREF_RE.search(attrs)
        if not hm or not keep_href(hm.group(1), attrs):
            continue
        text = plain_text(inner)
        if not text or len(text) < 2 or SKIP_TEXT_RE.match(text):
            continue
        href = abs_href(hm.group(1))
        if not href.startswith("http"):
            continue
        tm = TITLE_RE.search(attrs)
        title_attr = unescape(tm.group(1)).strip() if tm else ""
        page = wiki_page_title(href)
        title = title_attr or page
        key = (text, href)
        if key in seen:
            continue
        seen.add(key)
        link = {"text": text, "href": href}
        if title:
            link["title"] = title
        out.append(link)
    return out


def _content_tools():
    from scrape_wiki_items import content_body, is_header_row, name_from_cell, strip_tags

    return content_body, is_header_row, name_from_cell, strip_tags


def _row(name: str, description_html: str = "", source_html: str = "", note_htmls: list[str] | None = None) -> dict:
    note_links: list[dict] = []
    for html in note_htmls or []:
        note_links.extend(links_in_html(html))
    return {
        "name": name,
        "descriptionLinks": links_in_html(description_html),
        "sourceLinks": links_in_html(source_html),
        "noteLinks": note_links,
    }


def extract_title_rows(html: str) -> list[dict]:
    content_body, _, _, _ = _content_tools()
    body = content_body(html)
    rows: list[dict] = []
    for tr in re.finditer(r"<tr[^>]*>([\s\S]*?)</tr>", body, re.I):
        tds = re.findall(r"<td[^>]*>([\s\S]*?)</td>", tr.group(1), re.I)
        if len(tds) < 5:
            continue
        name = plain_text(tds[0])
        if not name or norm_name(name) in {"титул", "название"}:
            continue
        rows.append(_row(name, tds[1], tds[2], [tds[3]]))
    return rows


def _cut_appearance(body: str) -> str:
    cut = re.search(
        r"<h2[^>]*>((?:(?!</h2>).)*внешний\s+вид(?:(?!</h2>).)*)</h2>",
        body,
        re.I,
    )
    if cut:
        return body[: cut.start()]
    return body


def extract_standard_rows(html: str, kind: str) -> list[dict]:
    content_body, is_header_row, name_from_cell, strip_tags = _content_tools()
    body = content_body(html)
    if kind == "stickers":
        body = _cut_appearance(body)
    rows: list[dict] = []
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        if len(cells) < 2:
            continue
        texts = [strip_tags(c) for c in cells]
        if is_header_row(texts):
            continue
        if "Возможно Вы искали" in (texts[1] or ""):
            continue
        name = name_from_cell(cells[1])
        if not name or len(name) < 2:
            continue
        if kind == "stickers" and re.match(r"^стикер\b", name, re.I):
            continue
        description_html = ""
        source_html = ""
        note_htmls: list[str] = []
        if kind in ("wings", "transport"):
            if any(re.search(r"можно\s+носить", t or "", re.I) for t in texts[2:5]):
                continue
            if len(cells) > 3:
                note_htmls.append(cells[3])
            if len(cells) > 4:
                note_htmls.append(cells[4])
        elif kind == "stickers":
            if len(cells) > 2:
                source_html = cells[2]
        else:
            if len(cells) > 2:
                description_html = cells[2]
            if len(cells) > 3:
                source_html = cells[3]
            if len(cells) > 4:
                note_htmls.append(cells[4])
        rows.append(_row(name, description_html, source_html, note_htmls))
    return rows


def extract_achievement_rows(html: str) -> list[dict]:
    content_body, is_header_row, name_from_cell, strip_tags = _content_tools()
    body = content_body(html)
    rows: list[dict] = []
    seen: set[str] = set()
    parts = re.split(r"(<h2[\s\S]*?</h2>)", body, flags=re.I)
    current_h2 = ""
    current_cat = ""
    for chunk in parts:
        if re.match(r"<h2[\s\S]*?</h2>", chunk, re.I):
            current_h2 = chunk
            current_cat = plain_text(chunk)
            current_cat = re.sub(r"^\[\s*править\s*\]\s*", "", current_cat, flags=re.I).strip()
            continue
        h2_links = links_in_html(current_h2)
        for row in re.findall(r"<tr>([\s\S]*?)</tr>", chunk, re.I):
            cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
            if len(cells) < 2:
                continue
            texts = [strip_tags(c) for c in cells]
            if is_header_row(texts) or texts[0] in {"Значок", "Иконка"}:
                continue
            if "Название" in texts and "Описание" in texts:
                continue
            name = name_from_cell(cells[1]) if len(cells) > 1 else ""
            if not name:
                name = texts[1] if len(texts) > 1 else ""
            if not name or len(name) < 2:
                continue
            key = norm_name(name)
            if key in seen:
                continue
            seen.add(key)
            source_links = [lk for lk in h2_links if text_in_field(lk["text"], current_cat)]
            item = _row(
                name,
                cells[2] if len(cells) > 2 else "",
                "",
                [cells[3]] if len(cells) > 3 else [],
            )
            if source_links:
                item["sourceLinks"] = source_links
            rows.append(item)
    return rows


def extract_name_view_rows(html: str) -> list[dict]:
    content_body, is_header_row, name_from_cell, strip_tags = _content_tools()
    body = _cut_appearance(content_body(html))
    rows: list[dict] = []
    seen: set[str] = set()
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        if len(cells) < 2:
            continue
        texts = [strip_tags(c) for c in cells]
        if is_header_row(texts) or "название" in (texts[0] or "").casefold():
            continue
        if "Возможно Вы искали" in (texts[0] or ""):
            continue
        if "thumbcaption" in (cells[0] or "").casefold() and len(cells) <= 5:
            if all("thumbcaption" in (c or "").casefold() or not strip_tags(c) for c in cells):
                continue
        name = name_from_cell(cells[0]) or texts[0]
        if not name or len(name) < 2:
            continue
        key = norm_name(name)
        if key in seen:
            continue
        seen.add(key)
        description_html = ""
        source_html = ""
        if len(cells) == 3:
            source_html = cells[2]
        elif len(cells) >= 4:
            description_html = cells[2]
            source_html = cells[3]
        rows.append(_row(name.rstrip("."), description_html, source_html, []))
    return rows


def extract_emote_rows(html: str) -> list[dict]:
    content_body, _, name_from_cell, strip_tags = _content_tools()
    body = content_body(html)
    rows: list[dict] = []
    seen: set[str] = set()
    parts = re.split(r"(<h[23][\s\S]*?</h[23]>)", body, flags=re.I)
    current_html = ""
    current_cat = ""
    for chunk in parts:
        hm = re.match(r"<h([23])[\s\S]*?</h\1>", chunk, re.I)
        if hm:
            current_html = chunk
            current_cat = plain_text(chunk)
            current_cat = re.sub(r"^\[\s*править\s*\]\s*", "", current_cat, flags=re.I).strip()
            continue
        head_links = links_in_html(current_html)
        for row in re.findall(r"<tr>([\s\S]*?)</tr>", chunk, re.I):
            cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
            if len(cells) < 2:
                continue
            texts = [strip_tags(c) for c in cells]
            joined = " ".join(texts).casefold()
            if "название" in joined and "сокращ" in joined:
                continue
            name = name_from_cell(cells[0]) or texts[0]
            if not name or len(name) < 2:
                continue
            key = norm_name(current_cat + "|" + name)
            if key in seen:
                continue
            seen.add(key)
            short = texts[1] if len(texts) > 1 else ""
            item = _row(
                name,
                cells[1] if short and short != name else "",
                "",
                [cells[2]] if len(cells) > 2 else [],
            )
            source_links = [lk for lk in head_links if text_in_field(lk["text"], current_cat)]
            if source_links:
                item["sourceLinks"] = source_links
            rows.append(item)
    return rows


def extract_gem_rows(html: str) -> list[dict]:
    content_body, _, _, strip_tags = _content_tools()
    body = content_body(html)
    rows: list[dict] = []
    seen: set[str] = set()
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        if len(cells) < 2:
            continue
        texts = [strip_tags(c) for c in cells]
        if "название" in (texts[0] or "").casefold() or "стоимость" in (texts[1] or "").casefold():
            continue
        name = texts[0]
        if not name or len(name) < 2 or not re.search(r"[А-Яа-яA-Za-z]", name):
            continue
        key = norm_name(name)
        if key in seen:
            continue
        seen.add(key)
        rows.append(_row(name, "", "", cells[1:]))
    return rows


def extract_clothes_rows(html: str) -> list[dict]:
    content_body, _, _, strip_tags = _content_tools()
    body = content_body(html)
    rows: list[dict] = []
    seen: set[str] = set()
    sections = re.split(r"(<h3[\s\S]*?</h3>)", body, flags=re.I)
    current_h3 = ""
    current_source = ""
    for chunk in sections:
        if re.match(r"<h3[\s\S]*?</h3>", chunk, re.I):
            current_h3 = chunk
            current_source = plain_text(chunk)
            continue
        h3_links = [lk for lk in links_in_html(current_h3) if text_in_field(lk["text"], current_source)]
        for li in re.findall(r"<li>([\s\S]*?)</li>", chunk, re.I):
            img_links = re.findall(
                r'<a[^>]+href="(https?://[^"]+/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"[^>]*>([\s\S]*?)</a>',
                li,
                re.I,
            )
            if not img_links:
                continue
            primary = ""
            for _href, label_html in img_links:
                label = strip_tags(label_html)
                if label and label not in {"(м)", "(ж)", "м", "ж"}:
                    primary = label
                    break
            if not primary:
                primary = strip_tags(li).split("/")[0].strip()
            if not primary or len(primary) < 2:
                continue
            key = norm_name(primary)
            if key in seen:
                continue
            seen.add(key)
            item = _row(primary, "", "", [li])
            if h3_links:
                item["sourceLinks"] = h3_links
            rows.append(item)
    return rows


def extract_rows(html: str, kind: str) -> list[dict]:
    if kind == "achievements":
        return extract_achievement_rows(html)
    if kind in NAME_VIEW_KINDS:
        return extract_name_view_rows(html)
    if kind == "emotes":
        return extract_emote_rows(html)
    if kind == "gems":
        return extract_gem_rows(html)
    if kind in ("event_clothes", "kids_clothes"):
        return extract_clothes_rows(html)
    if kind == "pets":
        return []
    if kind in STANDARD_KINDS:
        return extract_standard_rows(html, kind)
    return []


def _dedupe_links(links: list[dict]) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for lk in links:
        key = (lk.get("text") or "", lk.get("href") or "")
        if not key[0] or not key[1] or key in seen:
            continue
        seen.add(key)
        out.append(lk)
    return out


def attach_rows(items: list[dict], rows: list[dict]) -> int:
    """Кладёт сырые ссылки, если их текст реально есть в сохранённом поле."""
    by_name: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_name[norm_name(row.get("name") or "")].append(row)
    hit = 0
    for it in items:
        group = by_name.get(norm_name(it.get("name") or ""))
        if not group:
            continue
        changed = False
        for field in LINK_FIELDS:
            merged: list[dict] = []
            stored = it.get(field) or ""
            for row in group:
                for lk in row.get(field + "Links") or []:
                    if text_in_field(lk.get("text") or "", stored):
                        merged.append(lk)
            merged = _dedupe_links(merged)
            key = field + "Links"
            if merged:
                prev = it.get(key) or []
                it[key] = _dedupe_links(list(prev) + merged)
                changed = True
        if changed:
            hit += 1
    return hit


def attach_page_links(items: list[dict], html: str, kind: str, wiki_page: str = "") -> int:
    del wiki_page  # отбор записей делает вызывающий
    return attach_rows(items, extract_rows(html, kind))


def clear_links(items: list[dict]) -> None:
    for it in items:
        for key in LINK_KEYS:
            it.pop(key, None)


def _leaked(it: dict) -> bool:
    if it.get("kind") in (None, "", "achievements", "titles"):
        return False
    note = it.get("note") or ""
    desc = it.get("description") or ""
    if re.search(r"можно\s+носить", note, re.I):
        return True
    if re.search(r"чтобы получить", desc, re.I) and it.get("kind") in ("wings", "transport"):
        return True
    return False


def item_section(it: dict) -> str:
    kind = it.get("kind") or ""
    if not kind or kind == "titles":
        return "titles"
    return kind


def build_index(items: list[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = defaultdict(list)
    seen: set[tuple[str, str, int]] = set()
    for it in items:
        if _leaked(it):
            continue
        name = it.get("name") or ""
        key = norm_key(name)
        if len(key) < 2 or it.get("id") is None:
            continue
        section = item_section(it)
        token = (section, key, int(it["id"]))
        if token in seen:
            continue
        seen.add(token)
        index[key].append({"section": section, "id": int(it["id"]), "name": name})
    return index


def _same(hit: dict, it: dict) -> bool:
    if it.get("id") is None:
        return False
    return hit["section"] == item_section(it) and hit["id"] == int(it["id"])


def _quoted_keys(text: str) -> list[str]:
    keys: list[str] = []
    for m in QUOTE_RE.finditer(text or ""):
        key = norm_key(m.group(1))
        if len(key) >= 2 and key not in keys:
            keys.append(key)
    return keys


def classify_link(link: dict, owner: dict, index: dict[str, list[dict]]) -> dict | None:
    href = link.get("href") or ""
    text = link.get("text") or ""
    if not href or not text:
        return None
    page = wiki_page_title(href)
    title_attr = link.get("title") or ""
    keys: list[str] = []
    for cand in (page, title_attr):
        key = norm_key(cand)
        if key and key not in keys:
            keys.append(key)

    section_hit = ""
    section_key = ""
    for key in keys:
        if key in SECTION_BY_PAGE:
            section_hit = SECTION_BY_PAGE[key]
            section_key = key
            break

    def others(key: str) -> list[dict]:
        return [h for h in index.get(key, []) if not _same(h, owner)]

    chosen: dict | None = None
    if not section_hit:
        for key in keys:
            hits = others(key)
            if len(hits) == 1:
                chosen = hits[0]
                break
            if len(hits) > 1:
                # несколько предметов с одним именем — не угадываем
                break
    else:
        text_keys = _quoted_keys(text)
        full = norm_key(text)
        # подпись раздела («Крылья», «Достижения») сама по себе — страница каталога
        if full and full != section_key:
            text_keys.append(full)
        found: list[dict] = []
        for key in text_keys:
            for hit in others(key):
                if hit["section"] == section_hit and hit not in found:
                    found.append(hit)
        if len(found) == 1:
            chosen = found[0]
        elif not found:
            # страница каталога, в тексте нет нашего предмета
            only_self = False
            for key in text_keys:
                raw = index.get(key, [])
                if raw and all(_same(h, owner) for h in raw if h["section"] == section_hit):
                    only_self = True
            if only_self:
                return None

    if chosen is None and not section_hit:
        # ссылка ведёт только на саму запись
        for key in keys:
            raw = index.get(key, [])
            if raw and all(_same(h, owner) for h in raw):
                return None

    out = {"text": text, "href": href}
    if title_attr:
        out["title"] = title_attr
    elif page:
        out["title"] = page
    if chosen:
        out["kind"] = "item"
        out["section"] = chosen["section"]
        out["itemId"] = chosen["id"]
        return out

    low = href.casefold()
    blob = " ".join(part for part in (page, title_attr, text) if part)
    if "forums/showthread" in low or "/forums/" in low:
        out["kind"] = "event"
    elif EVENT_RE.search(blob):
        out["kind"] = "event"
    else:
        out["kind"] = "other"
    return out


def classify_items(items: list[dict], also_index: list[dict] | None = None) -> None:
    index = build_index(list(items) + list(also_index or []))
    link_keys = list(LINK_KEYS) + ["characteristicsLinks"]
    for it in items:
        for key in link_keys:
            raw = it.get(key)
            if not raw:
                continue
            out: list[dict] = []
            seen: set[tuple] = set()
            for lk in raw:
                got = classify_link(lk, it, index)
                if not got:
                    continue
                token = (got["text"], got["href"], got["kind"], got.get("section"), got.get("itemId"))
                if token in seen:
                    continue
                seen.add(token)
                out.append(got)
            if out:
                it[key] = out
            else:
                it.pop(key, None)


def read_items(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items")
    return items if isinstance(items, list) else []


def page_of_wiki(url: str) -> str:
    if not url:
        return ""
    path = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
    if "index.php/" in path:
        return path.split("index.php/", 1)[1]
    return ""


def _write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def link_count(it: dict) -> int:
    keys = list(LINK_KEYS) + ["characteristicsLinks"]
    return sum(len(it.get(key) or []) for key in keys)


def has_link(it: dict) -> bool:
    return link_count(it) > 0


def enrich() -> dict:
    from scrape_wiki_items import PAGES

    titles = json.loads(TITLES_FILE.read_text(encoding="utf-8"))
    wiki = json.loads(WIKI_FILE.read_text(encoding="utf-8"))
    title_items = titles.get("items") or []
    wiki_items = wiki.get("items") or []
    clear_links(title_items)
    clear_links(wiki_items)

    if not TITLES_HTML.exists():
        raise SystemExit(f"нет дампа титулов: {TITLES_HTML}")
    title_html = TITLES_HTML.read_text(encoding="utf-8")
    title_rows = extract_title_rows(title_html)
    title_hit = attach_rows(title_items, title_rows)
    print(f"titles: rows={len(title_rows)} with_links={title_hit}/{len(title_items)}", flush=True)

    catalog_pages = {title for title, _kind, _label in PAGES}
    for wiki_title, kind, _label in PAGES:
        cache = DATA / f"_wiki_page_{wiki_title}.html"
        if not cache.exists():
            print(f"skip {wiki_title}: no cache", flush=True)
            continue
        html = cache.read_text(encoding="utf-8")
        # Страница каталога и отдельные статьи предмета (у крыльев wiki ведёт на статью,
        # а не на «Крылья»). Чужой каталог того же kind не трогаем.
        page_items = []
        for it in wiki_items:
            if it.get("kind") != kind:
                continue
            page = page_of_wiki(it.get("wiki") or "")
            if page == wiki_title or page not in catalog_pages:
                page_items.append(it)
        if not page_items:
            print(f"skip {wiki_title}: no items", flush=True)
            continue
        hit = attach_page_links(page_items, html, kind, wiki_title)
        print(f"{kind}/{wiki_title}: {hit}/{len(page_items)}", flush=True)

    classify_items(title_items + wiki_items)
    _write(TITLES_FILE, titles)
    _write(WIKI_FILE, wiki)

    def tally(items: list[dict]) -> dict[str, int]:
        kinds = {"item": 0, "event": 0, "other": 0}
        for it in items:
            for key in LINK_KEYS:
                for lk in it.get(key) or []:
                    kinds[lk.get("kind") or "other"] = kinds.get(lk.get("kind") or "other", 0) + 1
        return kinds

    stats = {
        "titles": len(title_items),
        "titlesWithLinks": sum(1 for it in title_items if has_link(it)),
        "titleLinkKinds": tally(title_items),
        "wiki": len(wiki_items),
        "wikiWithLinks": sum(1 for it in wiki_items if has_link(it)),
        "wikiLinkKinds": tally(wiki_items),
        "wikiByKind": {},
    }
    by_kind: dict[str, list[dict]] = defaultdict(list)
    for it in wiki_items:
        by_kind[it.get("kind") or ""].append(it)
    for kind, group in sorted(by_kind.items()):
        stats["wikiByKind"][kind] = {
            "items": len(group),
            "withLinks": sum(1 for it in group if has_link(it)),
        }
    divine = next((it for it in title_items if it.get("name") == "Божественно!"), None)
    stats["divine"] = {
        "descriptionLinks": (divine or {}).get("descriptionLinks") or [],
        "sourceLinks": (divine or {}).get("sourceLinks") or [],
        "noteLinks": (divine or {}).get("noteLinks") or [],
    }
    print(json.dumps({k: stats[k] for k in stats if k != "wikiByKind"}, ensure_ascii=False, indent=2))
    print("wiki by kind:")
    for kind, row in stats["wikiByKind"].items():
        if row["withLinks"]:
            print(f"  {kind}: {row['withLinks']}/{row['items']}")
    return stats


if __name__ == "__main__":
    enrich()

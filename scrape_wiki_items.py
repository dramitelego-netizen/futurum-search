#!/usr/bin/env python3
"""
Сбор предметов Пара па из вики → data/wiki_items.json + data/wiki_img/

Страницы-каталоги (картинки самого предмета / внешний вид, не только значки):
  Достижения, Крылья, Питомцы, Транспорт, Аксессуары, Прически(+с событий),
  Интерактивные_предметы, Жезлы, Зонты, Рюкзаки(+Гитара_на_спину), Шарики,
  Украшения_(рука), Игрушки_на_плечо/ногу, Интерактивная_обувь,
  Детские_маски, Букеты, Лук, Развлечения, Одежда_с_событий, Детская_одежда

MediaWiki API (Служебная:ApiSandbox → /wiki/api.php) — discovery и imageinfo.
Обычная «Песочница» пустая, не источник.

Запуск:
  py -3 scrape_wiki_items.py
  py -3 scrape_wiki_items.py --skip-download
  py -3 scrape_wiki_items.py --from-cache
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import re
import ssl
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data"
IMG_DIR = OUT / "wiki_img"
JSON_OUT = OUT / "wiki_items.json"
COOKIE_FILE = OUT / "cookies.txt"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
PROXY = "http://127.0.0.1:8080/proxy?u="
BASE = "https://parapa.ru"
WIKI_BASE = "https://parapa.ru/wiki/index.php/"
API = "https://parapa.ru/wiki/api.php"

PAGES: list[tuple[str, str, str]] = [
    # (wiki_title, kind_slug, kind_label)
    ("Достижения", "achievements", "Достижения"),
    ("Крылья", "wings", "Крылья"),
    ("Питомцы", "pets", "Питомцы"),
    ("Транспорт", "transport", "Транспорт"),
    ("Аксессуары", "accessories", "Аксессуары"),
    ("Прически", "hairstyles", "Прически"),
    ("Прически_с_событий", "hairstyles", "Прически"),
    ("Интерактивные_предметы", "interactive", "Интерактив"),
    ("Жезлы", "wands", "Жезлы"),
    ("Зонты", "umbrellas", "Зонты"),
    ("Рюкзаки", "backpacks", "Рюкзаки"),
    ("Гитара_на_спину", "backpacks", "Рюкзаки"),
    ("Шарики", "balloons", "Шарики"),
    ("Украшения_(рука)", "hand_decor", "Украшения"),
    ("Игрушки_на_плечо", "toys", "Игрушки"),
    ("Игрушки_на_ногу", "toys", "Игрушки"),
    ("Интерактивная_обувь", "shoes", "Обувь"),
    ("Детские_маски", "kids_masks", "Маски"),
    ("Букеты", "bouquets", "Букеты"),
    ("Лук", "bows", "Лук"),
    ("Развлечения", "amusements", "Развлечения"),
    ("Облик", "forms", "Облики"),
    ("Камни", "gems", "Камни"),
    ("Интерактивы", "emotes", "Интерактивы"),
    ("Фон_для_визитки", "card_bg", "Фоны визитки"),
    ("Фон_для_шоу", "show_bg", "Фоны шоу"),
    ("Рамка_для_визитки", "card_frame", "Рамки"),
    ("Стикеры", "stickers", "Стикеры"),
    ("Одежда_с_событий", "event_clothes", "Одежда с событий"),
    ("Детская_одежда", "kids_clothes", "Детская одежда"),
]

SKIP_H2 = {
    "Содержание",
    "Использование и снятие значка",
    "Навигация",
    "См. также",
    "Примечания",
}

SKIP_IMG = re.compile(
    r"(Letter-Open-icon|Common\.css|edit|Icon_|spacer|pixel|wikia)",
    re.I,
)


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = unescape(s).replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n+", "\n", s).strip()
    if s in {"—", "-", "–", "−", "Нет", "нет", "Нет / Нет", "нет / нет"}:
        return ""
    return s


def plain_keep(s: str) -> str:
    """Как strip_tags, но «да/нет» остаются — они нужны в характеристиках."""
    s = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = unescape(s).replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n+", "\n", s).strip()
    if s in {"—", "-", "–", "−"}:
        return ""
    return s


_CATALOG_WIKI_TITLES = {
    "крылья",
    "транспорт",
    "достижения",
    "аура",
    "полет",
    "полёт",
    "аура от крыльев",
}


def wiki_title_from_url(url: str) -> str:
    raw = unescape(url or "").strip()
    if not raw or "index.php/" not in raw:
        return ""
    path = urllib.parse.unquote(raw.split("index.php/", 1)[1])
    title = path.split("?")[0].split("#")[0].strip("/")
    return title.replace(" ", "_")


def is_catalog_wiki_url(url: str) -> bool:
    title = wiki_title_from_url(url).replace("_", " ").casefold()
    return (not title) or title in _CATALOG_WIKI_TITLES


def article_url_from_cell(cell: str, catalog_page: str) -> str:
    """Первая содержательная ссылка в ячейке названия → URL статьи предмета."""
    catalog_norm = (catalog_page or "").replace("_", " ").casefold()
    for m in re.finditer(r"<a\b([^>]*)>([\s\S]*?)</a>", cell or "", re.I):
        attrs = m.group(1)
        if re.search(r'class="[^"]*\b(?:image|new)\b', attrs, re.I):
            continue
        if re.search(r"redlink=1", attrs, re.I):
            continue
        hm = re.search(r'href="([^"]+)"', attrs, re.I)
        if not hm:
            continue
        href = unescape(hm.group(1))
        if "index.php" not in href:
            continue
        path = urllib.parse.unquote(href.split("index.php/", 1)[-1])
        path = path.split("?")[0].split("#")[0].strip("/")
        low = path.replace("_", " ").casefold()
        if low.startswith("файл:") or low.startswith("file:") or low.startswith("служебная:"):
            continue
        if low in _CATALOG_WIKI_TITLES or low == catalog_norm:
            continue
        if not path:
            continue
        return WIKI_BASE + urllib.parse.quote(path.replace(" ", "_"))
    return WIKI_BASE + urllib.parse.quote(catalog_page)


def abs_wiki_url(src: str) -> str:
    src = (src or "").strip()
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("http://"):
        src = "https://" + src[7:]
    if src.startswith("https://"):
        return src
    if src.startswith("/"):
        return BASE + src
    return BASE + "/" + src


def full_img_path(src: str) -> str:
    """thumb/.../NNpx-file.png → /wiki/images/.../file.png"""
    # drop query; keep encoded path for download encode_url later
    src = src.split("?")[0]
    m = re.match(r"((?:https?://[^/]+)?/wiki/images)/thumb/(.+?)/[^/]+$", src)
    if m:
        return m.group(1) + "/" + m.group(2)
    return src


def _collect_img_urls(html: str) -> list[str]:
    pat = r'(?:src|href)="((?:https?:)?(?://[^"/]+)?/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp)(?:\?[^"]*)?)"'
    out: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(pat, html or "", re.I):
        u = full_img_path(m.group(1))
        if SKIP_IMG.search(u):
            continue
        if "/File:" in u or "/%D0%A4%D0%B0%D0%B9%D0%BB:" in u:
            continue
        abs_u = abs_wiki_url(u)
        if abs_u in seen:
            continue
        seen.add(abs_u)
        out.append(abs_u)
    return out


def first_img_url(html: str) -> str:
    urls = _collect_img_urls(html)
    return urls[0] if urls else ""


def appearance_img_url(html: str) -> str:
    """Картинка внешнего вида предмета (ссылки в колонке названия), не мелкая иконка и не gif-анимация."""
    urls = _collect_img_urls(html)
    static = [u for u in urls if not u.lower().split("?")[0].endswith(".gif")]
    if static:
        return static[0]
    return urls[0] if urls else ""


def pick_look_url(urls: list[str], icon_url: str = "") -> str:
    """Выбрать картинку внешнего вида, отличную от значка в списке."""
    icon_stem = ""
    if icon_url:
        icon_stem = Path(
            urllib.parse.unquote(urllib.parse.urlsplit(icon_url).path)
        ).stem.casefold()
    static = [u for u in urls if not u.lower().split("?")[0].endswith(".gif")]
    anims = [u for u in urls if u.lower().split("?")[0].endswith(".gif")]
    for pool in (static, urls, anims):
        for u in pool:
            stem = Path(urllib.parse.unquote(urllib.parse.urlsplit(u).path)).stem.casefold()
            if icon_stem and stem == icon_stem:
                continue
            if "иконк" in stem or "letter-open" in stem:
                continue
            return u
    return ""


def article_look_url(html: str, icon_url: str = "") -> str:
    """Картинка из блока «Внешний вид» статьи; иначе лучшая картинка со страницы."""
    body = content_body(html)
    look_html = ""
    for title, chunk in _h2_sections(body):
        low = _yo(title).casefold()
        if "внешний" in low and "вид" in low:
            look_html = chunk
            break
    urls = _collect_img_urls(look_html) if look_html else []
    hit = pick_look_url(urls, icon_url)
    if hit:
        return hit
    return pick_look_url(_collect_img_urls(html), icon_url)


def item_image_url(icon_cell: str, name_cell: str) -> str:
    """Запасной одиночный URL: иконка, иначе вид из названия."""
    return first_img_url(icon_cell) or appearance_img_url(name_cell) or first_img_url(name_cell)


def item_icon_and_look(icon_cell: str, name_cell: str) -> tuple[str, str]:
    """Иконка (значок в списке) и внешний вид (крупная картинка в карточке)."""
    icon = first_img_url(icon_cell) or ""
    look = appearance_img_url(name_cell) or first_img_url(name_cell) or ""
    if look and icon and look == icon:
        look = ""
    if not icon and look:
        # только одна картинка — оставляем как иконку списка
        icon, look = look, ""
    return icon, look


# подписи ссылок-цветов в колонке названия (причёски и т.п.)
_LOOK_VARIANT_SKIP = {
    "тц",
    "валюта",
    "мнт",
    "дн",
    "дней",
    "вечно",
    "навсегда",
}

# виды, у которых в таблице/списке есть ссылки на цвета и/или (м)/(ж)
LOOK_VARIANT_KINDS = {
    "hairstyles",
    "umbrellas",
    "bouquets",
    "bows",
    "balloons",
    "accessories",
    "backpacks",
    "hand_decor",
    "wands",
    "interactive",
    "shoes",
    "toys",
    "kids_masks",
    "event_clothes",
    "kids_clothes",
}

# после парсинга: нормализовать gender и склеить соседние (ж)/(м)
GENDER_LOOK_KINDS = {
    "accessories",
    "backpacks",
    "event_clothes",
    "kids_clothes",
    "hand_decor",
    "shoes",
    "wands",
    "interactive",
    "umbrellas",
    "balloons",
    "bouquets",
    "bows",
    "kids_masks",
    "toys",
}

_EXTRA_LOOK_LABELS = {
    "белье",
    "бельё",
    "штаны",
    "шорты",
    "юбка",
    "рука",
    "спина",
    "носочки",
    "носки",
    "гольфы",
    "колготки",
    "обычная",
    "расписная",
}

_ANIM_LAB = re.compile(
    r"^\(?анимац(?:ия|ии|ией|иями)?(?:\s*(\d+))?(?:\s*\(?([мж])\)?)?\)?$",
    re.I,
)


def extract_look_variants(name_cell: str, max_len: int = 80) -> list[dict]:
    """Цвета/варианты вида: ссылки на картинки с короткой подписью в колонке названия.

    У зонтов часто: «желтый (ж)», затем отдельная ссылка «(м)» — склеиваем в «желтый (м)».
    Анимации: «(анимация)», «(анимация 1)», «(2)» → «анимация N».
    Голое «(м)» после «белье» приклеивается к последнему полу, не к «белье».
    """
    out: list[dict] = []
    seen: set[str] = set()
    last_color_base = ""
    last_gendered_base = ""
    last_anim = False
    for m in re.finditer(
        r'<a[^>]+href="((?:https?:)?(?://[^"/]+)?/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp)(?:\?[^"]*)?)"[^>]*>([\s\S]*?)</a>',
        name_cell or "",
        re.I,
    ):
        url = abs_wiki_url(full_img_path(m.group(1)))
        label = _anchor_label(m.group(2))
        if not url or not label:
            continue
        lab_l = _yo(label).lower().strip()
        if lab_l in _LOOK_VARIANT_SKIP or len(lab_l) > max_len:
            continue
        if SKIP_IMG.search(url):
            continue

        if re.fullmatch(r"\(?[мж]\)?", lab_l):
            gender = "м" if "м" in lab_l else "ж"
            if last_anim:
                lab_l = f"анимация ({gender})"
            elif last_gendered_base:
                lab_l = f"{last_gendered_base} ({gender})"
                last_anim = False
            elif last_color_base:
                lab_l = f"{last_color_base} ({gender})"
                last_anim = False
            else:
                lab_l = f"({gender})"
                last_anim = False
        else:
            anim_m = _ANIM_LAB.match(lab_l)
            if anim_m:
                num = anim_m.group(1)
                g = (anim_m.group(2) or "").lower()
                lab_l = f"анимация {num}" if num else "анимация 1"
                if g:
                    lab_l = f"{lab_l} ({g})"
                last_anim = True
            elif re.fullmatch(r"\(\d+\)", lab_l) or re.fullmatch(r"\d+", lab_l):
                num = re.search(r"\d+", lab_l)
                lab_l = f"анимация {num.group()}" if num else "анимация 1"
                last_anim = True
            else:
                last_anim = False
                gm = re.match(r"^(.+?)\s*\(([мж])\)\s*$", lab_l)
                if gm:
                    last_color_base = gm.group(1).strip()
                    last_gendered_base = last_color_base
                elif not lab_l.startswith("("):
                    last_color_base = lab_l

        lab_l = re.sub(r"\s+", " ", lab_l).strip(" ,;")
        if not lab_l or len(lab_l) > max_len:
            continue
        if url in seen:
            continue
        seen.add(url)
        out.append({"label": lab_l, "url": url})
    return out


def _attach_look_variants(item: dict, cell_html: str, max_len: int = 80) -> None:
    look_variants = extract_look_variants(cell_html, max_len=max_len)
    if not look_variants:
        return
    static = [v for v in look_variants if not v["url"].lower().split("?")[0].endswith(".gif")]
    anims = [v for v in look_variants if v["url"].lower().split("?")[0].endswith(".gif")]
    ordered = (static + anims) if static else look_variants
    if len(ordered) >= 2:
        item["lookVariants"] = ordered
        if not item.get("lookImageUrl"):
            item["lookImageUrl"] = ordered[0]["url"]
    elif not item.get("lookImageUrl"):
        item["lookImageUrl"] = ordered[0]["url"]


# подписи, которые не являются названием предмета (пол / анимация в той же ячейке)
_NAME_SKIP = {
    "(м)",
    "(ж)",
    "м",
    "ж",
    "(анимация)",
    "анимация",
}


def _anchor_label(inner: str) -> str:
    inner = re.sub(r"<br\s*/?>", " ", inner or "", flags=re.I)
    return re.sub(r"\s+", " ", strip_tags(inner)).strip()


def _is_skip_name(name: str) -> bool:
    low = (name or "").lower().replace("ё", "е").strip()
    if not low or low in _NAME_SKIP:
        return True
    if low.startswith("(анимац") or low.startswith("(интерактив"):
        return True
    return bool(re.fullmatch(r"\([мж]\)", low))


def _first_real_link_name(cell: str) -> str:
    """Текст первой содержательной ссылки. <br> внутри <a> — часть названия."""
    for m in re.finditer(r"<a\b[^>]*>([\s\S]*?)</a>", cell or "", re.I):
        lab = _anchor_label(m.group(1))
        if len(lab) < 2 or _is_skip_name(lab):
            continue
        return lab
    return ""


def name_from_cell(cell: str) -> str:
    # Prefer title= link text, else first text before <br> / first <a>.
    # Если так получается только «(м)»/«(ж)», берём полный текст первой ссылки
    # (у обуви название и пол часто разорваны <br> внутри одного <a>).
    m = re.search(r'title="([^"]+)"[^>]*>([^<]+)</a>', cell or "")
    if m:
        got = unescape(m.group(2) or m.group(1)).strip()
        if got and not _is_skip_name(got):
            return got
    head = re.split(r"<br\s*/?>|<a\s", cell or "", maxsplit=1, flags=re.I)[0]
    name = strip_tags(head)
    if name and not _is_skip_name(name):
        return name
    real = _first_real_link_name(cell or "")
    if real:
        return real
    m = re.search(r"<a[^>]*>([^<]+)</a>", cell or "", re.I)
    if m:
        return unescape(m.group(1)).strip()
    return strip_tags(cell).split("\n")[0][:120]


def content_body(html: str) -> str:
    m = re.search(
        r'id="mw-content-text"[\s\S]*?(?=<div[^>]+id="catlinks"|<div class="printfooter"|$)',
        html,
    )
    return m.group(0) if m else html


_HEADER_CELL = re.compile(
    r"^(?:иконка|значок|название(?:\s+и\s+внешний\s+вид)?|описание|примечание|"
    r"способ(?:\s+приобретения)?|стоимость|достижения|аура(?:\s*/\s*пол[её]т)?|мест:?)$",
    re.I,
)


def is_header_row(texts: list[str]) -> bool:
    """Строка-шапка таблицы. Слово «достижения» внутри «магазин достижений» — не шапка."""
    cells = [re.sub(r"\s+", " ", (t or "").strip()) for t in texts]
    meaningful = [c for c in cells if c]
    if len(meaningful) < 2:
        return False
    if meaningful[0].casefold() in {"иконка", "значок"}:
        return True
    return all(_HEADER_CELL.match(c) for c in meaningful)


def parse_standard_table(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    body = content_body(html)
    # галерея «Внешний вид» внизу — не предметы (особенно стикеры)
    if kind == "stickers":
        cut = re.search(
            r"<h2[^>]*>((?:(?!</h2>).)*внешний\s+вид(?:(?!</h2>).)*)</h2>",
            body,
            re.I,
        )
        if cut:
            body = body[: cut.start()]
    items: list[dict] = []
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        if len(cells) < 2:
            continue
        texts = [strip_tags(c) for c in cells]
        if is_header_row(texts):
            continue
        # skip disambiguation
        if "Возможно Вы искали" in texts[1] or "другие значения" in (texts[1] or ""):
            continue

        # значок в col0, внешний вид — ссылки/картинки в колонке названия
        icon, look = item_icon_and_look(cells[0], cells[1] if len(cells) > 1 else "")
        name = name_from_cell(cells[1])
        if not name or len(name) < 2:
            continue
        if SKIP_IMG.search(name):
            continue
        if kind == "stickers" and re.match(r"^стикер\b", name, re.I):
            continue

        description = ""
        source = ""
        note = ""
        category = ""
        has_achievement = False
        characteristics: list[dict] = []
        # column layouts differ
        if kind in ("wings", "transport", "amusements"):
            # icon | name | achievements(Да/Нет) | aura[/flight] [| seats]
            # развлечения: Иконка | Название | Достижения | Аура | Количество мест
            # столбец «Достижения» — флаг связанного значка, НЕ сам значок
            # на тех же страницах внизу бывает таблица самих значков — её пропускаем
            if any(re.search(r"можно\s+носить", t or "", re.I) for t in texts[2:5]):
                continue
            if len(cells) > 2 and texts[2]:
                has_achievement = bool(re.search(r"^да$", texts[2], re.I))
            aura_cell = plain_keep(cells[3]) if len(cells) > 3 else ""
            if kind == "wings" and aura_cell:
                parts = [p.strip() for p in re.split(r"\s*/\s*", aura_cell) if p.strip()]
                if len(parts) == 2:
                    characteristics.append({"label": "Аура", "value": parts[0]})
                    characteristics.append({"label": "Полёт", "value": parts[1]})
                else:
                    characteristics.append({"label": "Аура / Полёт", "value": aura_cell})
            elif aura_cell:
                characteristics.append({"label": "Аура", "value": aura_cell})
            if len(cells) > 4 and (texts[4] or plain_keep(cells[4])):
                characteristics.append({"label": "Мест", "value": texts[4] or plain_keep(cells[4])})
            note = " · ".join(f"{c['label']}: {c['value']}" for c in characteristics)
        elif kind in (
            "accessories",
            "interactive",
            "hairstyles",
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
            "forms",
            "stickers",
        ):
            # icon | name[+variants] | desc | source [| cost]
            # стикеры: иконка | название | способ
            if kind == "stickers":
                if len(cells) > 2:
                    source = texts[2]
            else:
                if len(cells) > 2:
                    description = texts[2]
                if len(cells) > 3:
                    source = texts[3]
                if len(cells) > 4 and texts[4]:
                    note = "Стоимость: " + texts[4]
            # variants text after name in cell1 — оставляем, если нет картинок-вариантов
            variants = strip_tags(cells[1])
            if variants and variants != name and len(variants) > len(name) + 2:
                if variants.startswith(name):
                    rest = variants[len(name) :].strip(" ,;/")
                else:
                    flat = re.sub(r"\s+", " ", variants).strip()
                    rest = flat[len(name) :].strip(" ,;/") if flat.startswith(name) else ""
                if rest and len(rest) < 180:
                    note = (note + " · " if note else "") + "Варианты: " + rest
            if kind == "toys":
                if "плечо" in wiki_page.lower():
                    category = "На плечо"
                elif "ногу" in wiki_page.lower():
                    category = "На ногу"
            elif kind == "hairstyles" and "событий" in wiki_page.lower():
                category = "С событий"
            elif kind == "backpacks" and "гитар" in wiki_page.lower():
                category = "Гитара на спину"

        wiki_url = WIKI_BASE + urllib.parse.quote(wiki_page)
        if kind in ("wings", "transport", "amusements"):
            wiki_url = article_url_from_cell(cells[1] if len(cells) > 1 else "", wiki_page)
        item = {
            "kind": kind,
            "kindLabel": kind_label,
            "name": name,
            "description": description,
            "source": source,
            "note": note,
            "imageUrl": icon,
            "wiki": wiki_url,
        }
        if characteristics:
            item["characteristics"] = characteristics
        if look:
            item["lookImageUrl"] = look
        if kind in LOOK_VARIANT_KINDS:
            _attach_look_variants(item, cells[1] if len(cells) > 1 else "", max_len=80)
            if item.get("lookVariants"):
                item["note"] = _note_body(item.get("note") or "")
        if category:
            item["category"] = category
            if not source:
                item["source"] = category
        if kind in ("wings", "transport", "amusements"):
            item["hasAchievement"] = has_achievement
        items.append(item)
    return items


_STAT_LABELS = {
    "анимация": "Анимация",
    "полет": "Полёт",
    "полёт": "Полёт",
    "аура": "Аура",
    "скорость": "Скорость",
    "пол": "Пол",
    "возможно приобрести на": "Срок",
    "срок": "Срок",
    "количество мест": "Мест",
    "мест": "Мест",
    "места": "Мест",
    "интерактив": "Интерактив",
    "интерактивы": "Интерактив",
}
_SOURCE_LABELS = {
    "способ получения",
    "способ приобретения",
    "другие способы получения",
    "где получить",
}
_COST_LABELS = {"стоимость"}
_ALICE_LABEL_RE = re.compile(r"необходимо для обмена", re.I)
_AUTO_LABEL_RE = re.compile(r"необходимо для автообмена", re.I)
_COST_PERIOD_RE = re.compile(
    r"(на\s+\d+\s*дн(?:я|ей|ь)?|навечно|вечно|навсегда)\s*:\s*(\d[\d\s]*)\s*(мнт|днс|очков|очка|очки)",
    re.I,
)
_LABEL_SPLIT_RE = re.compile(r"<b>([\s\S]*?)</b>\s*:?\s*", re.I)


def _norm_label(label: str) -> str:
    t = _yo(plain_keep(label) or "").casefold()
    t = re.sub(r"\s+", " ", t).strip(" :")
    return t


def _map_stat_label(label: str) -> str:
    return _STAT_LABELS.get(_norm_label(label), "")


def _heading_plain(chunk: str) -> str:
    title = plain_keep(chunk)
    return re.sub(r"^\[\s*править\s*\]\s*", "", title, flags=re.I).strip()


def _h2_sections(body: str) -> list[tuple[str, str]]:
    parts = re.split(r"(<h2[\s\S]*?</h2>)", body, flags=re.I)
    sections: list[tuple[str, str]] = []
    current = "intro"
    buf: list[str] = []
    for chunk in parts:
        if re.match(r"<h2\b", chunk, re.I):
            if buf:
                sections.append((current, "".join(buf)))
            current = _heading_plain(chunk)
            buf = []
        else:
            buf.append(chunk)
    if buf:
        sections.append((current, "".join(buf)))
    return sections


def _html_links(fragment: str) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for m in re.finditer(r"<a\b([^>]*)>([\s\S]*?)</a>", fragment or "", re.I):
        attrs, inner = m.group(1), m.group(2)
        if re.search(r'class="[^"]*\bimage\b', attrs, re.I):
            continue
        hm = re.search(r'href="([^"]+)"', attrs, re.I)
        if not hm:
            continue
        href = unescape(hm.group(1)).strip()
        if href.startswith("//"):
            href = "https:" + href
        elif href.startswith("/wiki/"):
            href = BASE + href
        elif href.startswith("/"):
            href = BASE + href
        elif href.startswith("http://"):
            href = "https://" + href[7:]
        if not href.startswith("http"):
            continue
        if "/File:" in href or "/%D0%A4%D0%B0%D0%B9%D0%BB:" in href:
            continue
        text = re.sub(r"\s+", " ", plain_keep(inner)).strip()
        if not text or len(text) < 2 or re.fullmatch(r"да|нет|—|-|–", text, re.I):
            continue
        key = (text, href)
        if key in seen:
            continue
        seen.add(key)
        tm = re.search(r'title="([^"]*)"', attrs, re.I)
        link = {"text": text, "href": href}
        if tm:
            link["title"] = unescape(tm.group(1)).strip()
        out.append(link)
    return out


def _field_value(raw: str) -> str:
    # картинки кнопок «Стоп»/«Гулять» после характеристик — не часть значения
    raw = re.split(r'<div class="thumb\b', raw or "", maxsplit=1, flags=re.I)[0]
    items = re.findall(r"<li>([\s\S]*?)</li>", raw, re.I)
    lines: list[str] = []
    if items:
        before = re.split(r"<ul\b", raw, maxsplit=1, flags=re.I)[0]
        head = re.sub(r"\s+", " ", plain_keep(before)).strip(" :")
        if head:
            lines.append(head)
        for li in items:
            t = re.sub(r"\s+", " ", plain_keep(li)).strip()
            if t:
                lines.append(t)
        text = "; ".join(lines)
    else:
        text = re.sub(r"\s+", " ", plain_keep(raw)).strip()
    if not text and re.search(r"\.gif\b|анимац", raw, re.I):
        text = "да"
    return text


def _clean_stat_value(value: str) -> str:
    t = re.sub(r"\(\s*\d+\s*\)", "", value or "")
    t = re.sub(r"\s*/\s*", " / ", t)
    t = re.sub(r"\s+", " ", t).strip(" /")
    return t or (value or "").strip()


def _is_name_echo(text: str, name: str) -> bool:
    a = re.sub(r"[\s.«»\"'“”]+", "", _yo(text or "")).casefold()
    b = re.sub(r"[\s.«»\"'“”]+", "", _yo(name or "")).casefold()
    return bool(a) and bool(b) and (a == b or (a.startswith(b) and len(a) <= len(b) + 4))


def _labeled_fields(html: str) -> list[tuple[str, str, str]]:
    """(label, plain_value, raw_html) из <b>Метка:</b> значение."""
    matches = list(_LABEL_SPLIT_RE.finditer(html or ""))
    out: list[tuple[str, str, str]] = []
    for i, m in enumerate(matches):
        label = re.sub(r"\s+", " ", plain_keep(m.group(1))).strip().rstrip(":")
        if not label:
            continue
        raw = (html or "")[m.end() : matches[i + 1].start() if i + 1 < len(matches) else len(html or "")]
        out.append((label, _field_value(raw), raw))
    return out


def _expand_stat(label: str, value: str) -> list[tuple[str, str]]:
    if not value:
        return []
    low = _norm_label(label)
    if " и " in low:
        parts = [p.strip() for p in re.split(r"\s+и\s+", low) if p.strip()]
        mapped = [_STAT_LABELS.get(p, "") for p in parts]
        if all(mapped) and len(mapped) >= 2:
            return [(name, value) for name in mapped]
    mapped = _STAT_LABELS.get(low, "")
    if mapped:
        return [(mapped, value)]
    return []


def _format_cost(text: str) -> str:
    def repl(m: re.Match) -> str:
        period = re.sub(r"\s+", " ", m.group(1)).strip()
        amount = re.sub(r"\s+", "", m.group(2))
        unit = m.group(3).lower()
        return f"{period} ({amount} {unit})"

    return _COST_PERIOD_RE.sub(repl, text or "")


def _alice_need_line(value: str) -> str:
    t = re.sub(r"\s+", " ", value or "").strip(" .")
    if not t:
        return ""
    if re.search(r"для обмена", t, re.I):
        return t if t.endswith(".") else t + "."
    return f"Для обмена нужно {t}."


def is_missing_article(html: str) -> bool:
    if not html or len(html) < 400:
        return True
    if re.search(r'class="noarticletext"|wgArticleId["\']?\s*:\s*0\b', html, re.I):
        return True
    if re.search(r"такой страницы не существует|нет текста на этой странице", html, re.I):
        return True
    return False


def parse_item_article(html: str, name: str = "") -> dict:
    """Статья крыльев/транспорта: intro, Характеристики, способ получения, стоимость."""
    body = content_body(html)
    result: dict = {
        "description": "",
        "source": "",
        "cost": "",
        "extra": "",
        "alice": "",
        "characteristics": [],
        "characteristicsLinks": [],
        "sourceLinks": [],
        "noteLinks": [],
        "descriptionLinks": [],
    }
    if is_missing_article(html):
        return result

    sections = _h2_sections(body)
    intro = ""
    stats_html = ""
    extra_html = ""
    for title, chunk in sections:
        low = _yo(title).casefold()
        if title == "intro" or low in {"содержание", ""}:
            if not intro:
                intro = chunk
            continue
        if "характеристик" in low:
            stats_html = chunk
        elif low.startswith("дополнительн"):
            extra_html = chunk

    paras = [
        re.sub(r"\s+", " ", plain_keep(p)).strip()
        for p in re.findall(r"<p>([\s\S]*?)</p>", intro, re.I)
    ]
    name_cf = _yo(name or "").casefold()
    for p in paras:
        if len(p) < 12:
            continue
        if name_cf and (_yo(p).casefold() == name_cf or _is_name_echo(p, name)):
            continue
        if p.lower().startswith("материал из"):
            continue
        # дисклеймер «другие значения» — не описание предмета
        if re.search(r"другие значения|у этого термина существуют", p, re.I):
            continue
        result["description"] = p
        result["descriptionLinks"] = _html_links(
            next(
                (
                    raw
                    for raw in re.findall(r"<p>([\s\S]*?)</p>", intro, re.I)
                    if re.sub(r"\s+", " ", plain_keep(raw)).strip() == p
                ),
                "",
            )
        )
        break

    source_parts: list[str] = []
    source_links: list[dict] = []
    note_links: list[dict] = []
    chars: list[dict] = []
    char_links: list[dict] = []
    seen_labels: set[str] = set()

    for label, value, raw in _labeled_fields(stats_html):
        nlab = _norm_label(label)
        if not nlab:
            continue
        if nlab in _SOURCE_LABELS:
            if value:
                source_parts.append(value)
                source_links.extend(_html_links(raw))
            continue
        if nlab in {"обмен", "обмен у алисы"}:
            if value:
                source_parts.append(value)
                source_links.extend(_html_links(raw))
                if re.search(r"алис", value, re.I):
                    am = re.search(r"(\d[\d\s]*\s+элитных карт\w*)", value, re.I)
                    result["alice"] = (am.group(1).strip() if am else value)
            continue
        if _ALICE_LABEL_RE.search(label):
            if value:
                result["alice"] = value
                source_links.extend(_html_links(raw))
            continue
        if _AUTO_LABEL_RE.search(label):
            if value:
                source_parts.append("Автообмен: " + value)
                source_links.extend(_html_links(raw))
            continue
        if nlab in _COST_LABELS:
            if value:
                result["cost"] = _format_cost(value)
                note_links.extend(_html_links(raw))
            continue
        added_from_row = False
        for mapped, val in _expand_stat(label, _clean_stat_value(value)):
            key = mapped.casefold()
            if key in seen_labels:
                continue
            seen_labels.add(key)
            chars.append({"label": mapped, "value": val})
            added_from_row = True
        if added_from_row:
            char_links.extend(_html_links(raw))

    # запас: двухколоночные таблицы в блоке характеристик
    if not chars:
        for table in re.findall(r"<table[^>]*>([\s\S]*?)</table>", stats_html, re.I):
            for row in re.findall(r"<tr>([\s\S]*?)</tr>", table, re.I):
                cells = re.findall(r"<t[hd][^>]*>([\s\S]*?)</t[hd]>", row, re.I)
                if len(cells) != 2:
                    continue
                row_html = "".join(cells)
                for mapped, val in _expand_stat(plain_keep(cells[0]), _field_value(cells[1])):
                    key = mapped.casefold()
                    if key in seen_labels or not val:
                        continue
                    seen_labels.add(key)
                    chars.append({"label": mapped, "value": val})
                    char_links.extend(_html_links(row_html))

    result["characteristics"] = chars
    # Все ссылки из блока «Характеристики» (в т.ч. в подписи «Полёт», не только в значении)
    result["characteristicsLinks"] = _merge_link_lists(char_links, _html_links(stats_html))
    result["source"] = "; ".join(p for p in source_parts if p)
    result["sourceLinks"] = _merge_link_lists(source_links)
    result["noteLinks"] = _merge_link_lists(note_links)

    extra_items = [
        re.sub(r"\s+", " ", plain_keep(li)).strip()
        for li in re.findall(r"<li>([\s\S]*?)</li>", extra_html, re.I)
    ]
    extra_items = [t for t in extra_items if t]
    if extra_items:
        result["extra"] = "; ".join(extra_items)
        result["noteLinks"] = _merge_link_lists(result["noteLinks"], _html_links(extra_html))
    return result


def _char_note(chars: list[dict]) -> str:
    return " · ".join(
        f"{c.get('label')}: {c.get('value')}"
        for c in chars
        if c.get("label") and c.get("value")
    )


def _merge_characteristics(base: list[dict] | None, extra: list[dict] | None) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for row in list(extra or []) + list(base or []):
        label = (row.get("label") or "").strip()
        value = (row.get("value") or "").strip()
        if not label or not value:
            continue
        key = _yo(label).casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append({"label": label, "value": value})
    return out


def _follow_obtain_page(op: urllib.request.OpenerDirector, title: str, from_cache: bool) -> str:
    """Короткий способ получения со связанной страницы (подарок и т.п.)."""
    del from_cache
    cache = wiki_cache_path(title)
    try:
        if cache.exists() and cache.stat().st_size > 500:
            html = cache.read_text(encoding="utf-8", errors="replace")
        else:
            html = fetch_html(op, title)
            cache.write_text(html, encoding="utf-8")
            time.sleep(0.12)
    except Exception:
        return ""
    if is_missing_article(html):
        return ""
    parsed = parse_item_article(html)
    if parsed.get("source"):
        return parsed["source"]
    body = content_body(html)
    for p in re.findall(r"<p>([\s\S]*?)</p>", body, re.I):
        t = re.sub(r"\s+", " ", plain_keep(p)).strip()
        if len(t) >= 20 and re.search(r"получить|подар|магазин|лотере|колес|акци", t, re.I):
            return t[:400]
    return ""


def apply_article_fields(item: dict, parsed: dict) -> None:
    chars = _merge_characteristics(item.get("characteristics"), parsed.get("characteristics"))
    if chars:
        item["characteristics"] = chars
    cl = _merge_link_lists(item.get("characteristicsLinks"), parsed.get("characteristicsLinks"))
    if cl:
        item["characteristicsLinks"] = cl
    source = (parsed.get("source") or "").strip()
    if source:
        item["source"] = source
    alice_val = (parsed.get("alice") or "").strip()
    alice_line = _alice_need_line(alice_val) if alice_val else ""
    if alice_val:
        item["source"] = _merge_alice_source(item.get("source") or "")
    desc = (parsed.get("description") or "").strip()
    if desc and not re.search(r"для обмена", desc, re.I):
        item["description"] = desc
    note_parts: list[str] = []
    if parsed.get("cost"):
        note_parts.append("Стоимость: " + parsed["cost"])
    if alice_line:
        note_parts.append(alice_line)
    if parsed.get("extra"):
        note_parts.append(parsed["extra"])
    if note_parts:
        item["note"] = " · ".join(p for p in note_parts if p)
    elif chars:
        item["note"] = _char_note(chars)
    if parsed.get("sourceLinks"):
        item["sourceLinks"] = _merge_link_lists(item.get("sourceLinks"), parsed["sourceLinks"])
    if parsed.get("noteLinks"):
        item["noteLinks"] = _merge_link_lists(item.get("noteLinks"), parsed["noteLinks"])
    if parsed.get("descriptionLinks") and desc:
        item["descriptionLinks"] = _merge_link_lists(
            item.get("descriptionLinks"), parsed["descriptionLinks"]
        )


ARTICLE_ENRICH_KINDS = {"wings", "transport", "amusements"}


def enrich_item_articles(
    op: urllib.request.OpenerDirector,
    items: list[dict],
    *,
    from_cache: bool = False,
) -> list[dict]:
    """Подтянуть описание, способ получения, характеристики и вид со страницы предмета."""
    targets = [it for it in items if it.get("kind") in ARTICLE_ENRICH_KINDS]
    if not targets:
        return items
    ok = miss = fail = follow = looks = 0
    total = len(targets)
    print(f"    article enrich: {total}", flush=True)
    for i, it in enumerate(targets, 1):
        wiki = it.get("wiki") or ""
        title = wiki_title_from_url(wiki)
        if not title or is_catalog_wiki_url(wiki):
            miss += 1
            continue
        cache = wiki_cache_path(title)
        try:
            if cache.exists() and cache.stat().st_size > 500:
                html = cache.read_text(encoding="utf-8", errors="replace")
            else:
                html = fetch_html(op, title)
                cache.write_text(html, encoding="utf-8")
                time.sleep(0.12)
            if is_missing_article(html):
                miss += 1
                continue
            parsed = parse_item_article(html, it.get("name") or "")
            if not parsed.get("source"):
                for lk in parsed.get("sourceLinks") or []:
                    href = lk.get("href") or ""
                    page = wiki_title_from_url(href)
                    if not page or is_catalog_wiki_url(href):
                        continue
                    extra = _follow_obtain_page(op, page, from_cache)
                    if extra:
                        parsed["source"] = extra
                        follow += 1
                        break
            apply_article_fields(it, parsed)
            look = article_look_url(html, it.get("imageUrl") or "")
            if look:
                if it.get("lookImageUrl") != look:
                    it["lookImageUrl"] = look
                    # сбросить локальный файл, если URL сменился
                    it.pop("lookImage", None)
                looks += 1
            if (
                parsed.get("characteristics")
                or parsed.get("source")
                or parsed.get("description")
                or look
            ):
                ok += 1
            else:
                miss += 1
        except Exception as e:
            fail += 1
            if fail <= 8:
                print(f"      article FAIL {title}: {e}", flush=True)
        if i % 40 == 0 or i == total:
            print(
                f"      [{i}/{total}] ok={ok} empty={miss} fail={fail} follow={follow} look={looks}",
                flush=True,
            )
    print(
        f"    article enrich done: ok={ok} empty={miss} fail={fail} follow={follow} look={looks}",
        flush=True,
    )
    return items


def parse_achievements(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Страница Достижения: таблицы Значок | Название | Описание | Примечание под h2-группами."""
    body = content_body(html)
    items: list[dict] = []
    seen: set[str] = set()
    # режем по h2, чтобы знать группу значка
    parts = re.split(r"(<h2[\s\S]*?</h2>)", body, flags=re.I)
    current_cat = "Прочее"
    for chunk in parts:
        hm = re.match(r"<h2[\s\S]*?</h2>", chunk, re.I)
        if hm:
            title = strip_tags(chunk)
            title = re.sub(r"^\[\s*править\s*\]\s*", "", title, flags=re.I).strip()
            if title and title not in SKIP_H2:
                current_cat = title
            continue
        for row in re.findall(r"<tr>([\s\S]*?)</tr>", chunk, re.I):
            cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
            if len(cells) < 2:
                continue
            texts = [strip_tags(c) for c in cells]
            if is_header_row(texts) or texts[0] in {"Значок", "Иконка"}:
                continue
            if "Название" in texts and "Описание" in texts:
                continue
            icon = first_img_url(cells[0]) or first_img_url(row)
            name = name_from_cell(cells[1]) if len(cells) > 1 else ""
            if not name:
                name = texts[1] if len(texts) > 1 else ""
            if not name or len(name) < 2:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            description = texts[2] if len(texts) > 2 else ""
            note = texts[3] if len(texts) > 3 else ""
            items.append(
                {
                    "kind": kind,
                    "kindLabel": kind_label,
                    "name": name,
                    "description": description,
                    "source": current_cat,
                    "note": note,
                    "category": current_cat,
                    "imageUrl": icon,
                    "wiki": WIKI_BASE + urllib.parse.quote(wiki_page),
                }
            )
    return items


def parse_pets_grid(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    body = content_body(html)
    items: list[dict] = []
    seen: set[str] = set()
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        for cell in cells:
            name = name_from_cell(cell)
            img = first_img_url(cell)
            if not name or not img:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            items.append(
                {
                    "kind": kind,
                    "kindLabel": kind_label,
                    "name": name,
                    "description": "",
                    "source": "",
                    "note": "",
                    "imageUrl": img,
                    "wiki": WIKI_BASE + urllib.parse.quote(wiki_page),
                }
            )
    return items


LOOK_IMAGE_KINDS = {"card_bg", "show_bg", "card_frame", "stickers"}


def look_name_key(name: str) -> str:
    n = strip_tags(name or "").strip()
    n = re.sub(r"^стикер\s+", "", n, flags=re.I).strip()
    # кавычки и пунктуация с краёв (подпись «Стикер "Love".» → love)
    for _ in range(3):
        n2 = n.strip(" \t«»\"„“”'").rstrip(".,!;:…").strip(" \t«»\"„“”'")
        if n2 == n:
            break
        n = n2
    n = re.sub(r"\s+", " ", n)
    return n.lower().replace("ё", "е")


def parse_appearance_gallery(html: str) -> dict[str, str]:
    """Блок «Внешний вид…» внизу страницы: подпись → полный URL картинки."""
    body = content_body(html)
    out: dict[str, str] = {}
    parts = re.split(r"(<h2[\s\S]*?</h2>)", body, flags=re.I)
    in_look = False
    for chunk in parts:
        hm = re.match(r"<h2[\s\S]*?</h2>", chunk, re.I)
        if hm:
            title = strip_tags(chunk)
            title = re.sub(r"^\[\s*править\s*\]\s*", "", title, flags=re.I).strip()
            in_look = bool(re.search(r"внешний\s+вид", title, re.I))
            continue
        if not in_look:
            continue
        # thumbinner … thumbcaption (внутри caption часто есть div.magnify — имя после него)
        for m in re.finditer(
            r'<div class="thumbinner"[^>]*>([\s\S]*?)<div class="thumbcaption"[^>]*>'
            r'(?:<div class="magnify">[\s\S]*?</div>)?\s*([\s\S]*?)</div>',
            chunk,
            re.I,
        ):
            thumb_html, cap_html = m.group(1), m.group(2)
            key = look_name_key(cap_html)
            if not key or len(key) < 2:
                continue
            url = ""
            srcset = re.search(r'srcset="([^"]+)"', thumb_html, re.I)
            if srcset:
                for part in reversed([p.strip() for p in srcset.group(1).split(",")]):
                    u = part.split()[0] if part else ""
                    if not u:
                        continue
                    u = abs_wiki_url(full_img_path(u))
                    if u and not SKIP_IMG.search(u):
                        url = u
                        if "/thumb/" not in u:
                            break
            if not url:
                img_m = re.search(r'<img[^>]+src="([^"]+)"', thumb_html, re.I)
                if img_m:
                    url = abs_wiki_url(full_img_path(img_m.group(1)))
            if url:
                out[key] = url
    return out


def apply_appearance_looks(html: str, items: list[dict], kind: str) -> list[dict]:
    """Добавить полный внешний вид из нижнего блока (иконку в таблице не трогаем)."""
    if kind not in LOOK_IMAGE_KINDS or not items:
        return items
    gallery = parse_appearance_gallery(html)
    if not gallery:
        return items
    hit = 0
    for it in items:
        key = look_name_key(it.get("name") or "")
        url = gallery.get(key)
        if not url:
            continue
        it["lookImageUrl"] = url
        hit += 1
    if hit:
        print(f"    look gallery: {hit}/{len(items)} matched ({len(gallery)} captions)", flush=True)
    return items


def parse_name_view_table(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Фон/рамка: Название | Вид(иконка) | [Описание] | Способ + внешний вид из галереи внизу."""
    body = content_body(html)
    # не парсим строки из блока «Внешний вид» как отдельные предметы
    # важно: «внешний вид» должен быть в самом заголовке h2, а не в оглавлении ниже
    cut = re.search(
        r"<h2[^>]*>((?:(?!</h2>).)*внешний\s+вид(?:(?!</h2>).)*)</h2>",
        body,
        re.I,
    )
    if cut:
        body = body[: cut.start()]
    items: list[dict] = []
    seen: set[str] = set()
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        if len(cells) < 2:
            continue
        texts = [strip_tags(c) for c in cells]
        if is_header_row(texts) or "название" in (texts[0] or "").lower():
            continue
        if "Возможно Вы искали" in (texts[0] or ""):
            continue
        # галерея: ячейка = картинка+подпись, без отдельной колонки «способ»
        if "thumbcaption" in (cells[0] or "").lower() and len(cells) <= 5:
            if all("thumbcaption" in (c or "").lower() or not strip_tags(c) for c in cells):
                continue
        name = name_from_cell(cells[0]) or texts[0]
        if not name or len(name) < 2:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        img = appearance_img_url(cells[1]) or first_img_url(cells[1]) or first_img_url(row)
        description = ""
        source = ""
        if len(cells) == 3:
            source = texts[2]
        elif len(cells) >= 4:
            description = texts[2]
            source = texts[3]
        items.append(
            {
                "kind": kind,
                "kindLabel": kind_label,
                "name": name.rstrip("."),
                "description": description,
                "source": source,
                "note": "",
                "imageUrl": img,
                "wiki": WIKI_BASE + urllib.parse.quote(wiki_page),
            }
        )
    return items


def parse_emotes(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Интерактивы: название(+gif) | сокращение [| стоимость], группы по h2/h3."""
    body = content_body(html)
    items: list[dict] = []
    seen: set[str] = set()
    parts = re.split(r"(<h[23][\s\S]*?</h[23]>)", body, flags=re.I)
    current_cat = "Одиночные"
    for chunk in parts:
        hm = re.match(r"<h([23])[\s\S]*?</h\1>", chunk, re.I)
        if hm:
            title = strip_tags(chunk)
            title = re.sub(r"^\[\s*править\s*\]\s*", "", title, flags=re.I).strip()
            if title and title not in SKIP_H2 and title != "Содержание":
                current_cat = title
            continue
        for row in re.findall(r"<tr>([\s\S]*?)</tr>", chunk, re.I):
            cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
            if len(cells) < 2:
                continue
            texts = [strip_tags(c) for c in cells]
            joined = " ".join(texts).lower()
            if "название" in joined and "сокращ" in joined:
                continue
            name = name_from_cell(cells[0]) or texts[0]
            if not name or len(name) < 2:
                continue
            key = (current_cat + "|" + name).lower()
            if key in seen:
                continue
            seen.add(key)
            img = appearance_img_url(cells[0]) or first_img_url(cells[0])
            short = texts[1] if len(texts) > 1 else ""
            note = ""
            if len(texts) > 2 and texts[2]:
                note = "Стоимость: " + texts[2]
            elif short and short != name:
                note = "Сокр.: " + short
            items.append(
                {
                    "kind": kind,
                    "kindLabel": kind_label,
                    "name": name,
                    "description": short if short != name else "",
                    "source": current_cat,
                    "note": note,
                    "category": current_cat,
                    "imageUrl": img,
                    "wiki": WIKI_BASE + urllib.parse.quote(wiki_page),
                }
            )
    return items


def gem_page_icon_url(html: str) -> str:
    """Значок со страницы камня (thumb справа)."""
    body = content_body(html)
    m = re.search(
        r'<div class="thumb tright">[\s\S]*?<img[^>]+src="([^"]+)"',
        body,
        re.I,
    )
    if m:
        return abs_wiki_url(full_img_path(m.group(1)))
    return first_img_url(body)


def parse_gems(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Камни: таблица характеристик; значки — на отдельных страницах камней."""
    body = content_body(html)
    items: list[dict] = []
    seen: set[str] = set()
    for row in re.findall(r"<tr>([\s\S]*?)</tr>", body, re.I):
        cells = re.findall(r"<td[^>]*>([\s\S]*?)</td>", row, re.I)
        if len(cells) < 2:
            continue
        texts = [strip_tags(c) for c in cells]
        if "название" in (texts[0] or "").lower() or "стоимость" in (texts[1] or "").lower():
            continue
        name = texts[0]
        if not name or len(name) < 2 or not re.search(r"[А-Яа-яA-Za-z]", name):
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        note_parts = []
        labels = ("Стоимость", "Оценка", "Брейк", "Очки", "Команде", "Шанс")
        for i, lab in enumerate(labels, start=1):
            if i < len(texts) and texts[i]:
                note_parts.append(f"{lab}: {texts[i]}")
        items.append(
            {
                "kind": kind,
                "kindLabel": kind_label,
                "name": name,
                "description": "",
                "source": "Камни",
                "note": " · ".join(note_parts),
                "imageUrl": first_img_url(row),
                "wiki": WIKI_BASE + urllib.parse.quote(wiki_page),
            }
        )
    return items


def enrich_gem_icons(
    op: urllib.request.OpenerDirector,
    items: list[dict],
    *,
    from_cache: bool = False,
) -> list[dict]:
    """Подтянуть значки камней со страниц Жемчуг / Рубин / …"""
    gems = [it for it in items if it.get("kind") == "gems"]
    if not gems:
        return items
    hit = 0
    for it in gems:
        name = (it.get("name") or "").strip()
        if not name:
            continue
        cache = OUT / f"_wiki_page_{name.replace(' ', '_')}.html"
        try:
            if from_cache and cache.exists():
                html = cache.read_text(encoding="utf-8")
            else:
                html = fetch_html(op, name)
                cache.write_text(html, encoding="utf-8")
                time.sleep(0.12)
            url = gem_page_icon_url(html)
            if url:
                it["imageUrl"] = url
                hit += 1
        except Exception as e:
            print(f"  gem icon FAIL {name}: {e}", flush=True)
    print(f"    gem icons: {hit}/{len(gems)}", flush=True)
    return items


def parse_list_items(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Одежда с событий / детская: <li><a href=img>name</a> / <a>(м)</a></li> under h3 sections."""
    body = content_body(html)
    items: list[dict] = []
    seen: set[str] = set()

    # attach nearest h3 as source
    sections = re.split(r"(<h3[\s\S]*?</h3>)", body, flags=re.I)
    current_source = ""
    for chunk in sections:
        hm = re.match(r"<h3[\s\S]*?</h3>", chunk, re.I)
        if hm:
            current_source = strip_tags(chunk)
            continue
        for li in re.findall(r"<li>([\s\S]*?)</li>", chunk, re.I):
            links = re.findall(
                r'<a[^>]+href="((?:https?:)?(?://[^"/]+)?/wiki/images/[^"]+\.(?:png|jpe?g|gif|webp))"[^>]*>([\s\S]*?)</a>',
                li,
                re.I,
            )
            if not links:
                continue
            # primary = first link with real name (not just (м)/(ж))
            primary_name = ""
            primary_url = ""
            for href, label_html in links:
                label = _anchor_label(label_html)
                url = abs_wiki_url(full_img_path(href))
                if not primary_name and label and not _is_skip_name(label):
                    primary_name = label
                    primary_url = url
            if not primary_name:
                primary_name = strip_tags(li).split("/")[0].strip()
                primary_url = abs_wiki_url(full_img_path(links[0][0]))
            if not primary_name or len(primary_name) < 2:
                continue
            key = (kind + "|" + primary_name + "|" + current_source).lower()
            if key in seen:
                continue
            seen.add(key)
            item = {
                "kind": kind,
                "kindLabel": kind_label,
                "name": primary_name,
                "description": "",
                "source": current_source,
                "note": "",
                "imageUrl": primary_url,
                "wiki": WIKI_BASE + urllib.parse.quote(wiki_page),
            }
            _attach_look_variants(item, li, max_len=80)
            items.append(item)
    return items


_ACC_SLOTS = (
    "Украшения для головы",
    "Украшения для лица",
    "Очки",
    "Шея",
)
_GENDER_NAME = re.compile(r"^(?P<body>.+?)\s*\((?P<g>[мж])\)\s*$", re.I)
_GENDER_PAIR = re.compile(
    r"^(?P<a>.+?)\s*\((?P<ga>[мж])\)\s*/\s*(?:(?P<b>.+?)\s*)?\((?P<gb>[мж])\)\s*$",
    re.I,
)
_SLASH_QUOTES = re.compile(
    r'^(?P<pre>.*?)(?P<a>"[^"]+"|«[^»]+»)\s*/\s*(?P<b>"[^"]+"|«[^»]+»)(?P<post>.*)$'
)
_COLOR_ADJ = re.compile(r"(?:ый|ий|ой|ая|яя|ое|ее|ые|ие)$", re.I)
_EXTRA_COLORS = {
    "хаки",
    "индиго",
    "бирюза",
    "бирюзовый",
    "золото",
    "серебро",
    "бронза",
    "медь",
    "деним",
    "камуфляж",
    "леопард",
    "леопардовый",
}


def _yo(s: str) -> str:
    return (s or "").replace("ё", "е").replace("Ё", "Е")


def _is_color_word(base: str) -> bool:
    b = _yo(base).strip().lower()
    if not b or len(b) > 32:
        return False
    if any(ch in b for ch in "\"«»"):
        return False
    if re.search(r"\d", b):
        return False
    parts = b.split()
    if not 1 <= len(parts) <= 3:
        return False
    return all(p in _EXTRA_COLORS or _COLOR_ADJ.search(p) for p in parts)


def _split_variant_label(label: str) -> tuple[str, str]:
    text = (label or "").strip()
    m = re.search(r"\s*\(([мж])\)\s*$", text, re.I)
    if m:
        return (text[: m.start()] or "").strip(), m.group(1).lower()
    if "анимац" in _yo(text).lower():
        m = re.search(r"\s+([мж])\s*$", text, re.I)
        if m:
            return (text[: m.start()] or "").strip(), m.group(1).lower()
    return text, ""


def _fold_name(s: str) -> str:
    s = _yo(s or "").casefold()
    s = re.sub(r"\s*\([мж]\)\s*$", "", s)
    return re.sub(r"\s+", " ", s).strip(" \"«»")


def _is_item_title(base: str, name: str) -> bool:
    b, n = _fold_name(base), _fold_name(name)
    return bool(b) and b == n


def _is_extra_look_label(base: str) -> bool:
    b = _yo(base or "").strip().lower().strip(" -–—")
    if b in _EXTRA_LOOK_LABELS:
        return True
    if b.startswith("интерактив"):
        return True
    if b.startswith("рука") or b.startswith("спина"):
        return True
    return False


_COLOR_LEAD = re.compile(
    r"^(?P<color>(?:темно-|светло-|ярко-|бело-|красно-|розово-|сине-|черно-|жёлто-|желто-)?"
    r"[^\s]+(?:ый|ий|ой|ая|яя|ое|ее|ые|ие))\s+(?P<rest>.+)$",
    re.I,
)


def _split_color_prefix(name: str) -> tuple[str, str]:
    m = _COLOR_LEAD.match((name or "").strip())
    if not m:
        return "", name or ""
    color = m.group("color").strip()
    rest = m.group("rest").strip()
    rest = re.sub(r"\s*\([мж]\)\s*$", "", rest, flags=re.I).strip()
    if not rest or not _is_color_word(color):
        return "", name or ""
    return color, rest


def _align_gender_title(a: str, b: str) -> tuple[str, str]:
    a = (a or "").strip()
    b = (b or "").strip()
    if not b:
        return a, a
    m = re.match(r'^(?P<pre>.*?)(?P<q>"[^"]+"|«[^»]+»)\s*$', a)
    if m and re.fullmatch(r'"[^"]+"|«[^»]+»', b):
        b = m.group("pre") + b
    return a, b


def _catalog_join(a: str, b: str) -> str:
    a, b = _align_gender_title(a, b)
    if a.casefold() == b.casefold():
        return a
    ma = re.match(r'^(?P<pre>.*?)(?P<q>"[^"]+"|«[^»]+»)\s*$', a)
    mb = re.match(r'^(?P<pre>.*?)(?P<q>"[^"]+"|«[^»]+»)\s*$', b)
    if ma and mb and ma.group("pre") == mb.group("pre"):
        return f"{ma.group('pre')}{ma.group('q')} / {mb.group('q')}".strip()
    return f"{a} / {b}"


def _heading_title(chunk: str) -> str:
    title = strip_tags(chunk)
    return re.sub(r"^\[\s*править\s*\]\s*", "", title, flags=re.I).strip()


def _slot_name(title: str) -> str:
    t = _heading_title(title) if title.lstrip().startswith("<") else title.strip()
    for slot in _ACC_SLOTS:
        if t == slot or t.startswith(slot):
            return slot
    return ""


def parse_accessories(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Каталог аксессуаров: слот (голова/лицо/очки/шея) + строки таблиц."""
    body = content_body(html)
    parts = re.split(r"(<h[23][\s\S]*?</h[23]>)", body, flags=re.I)
    slot = ""
    items: list[dict] = []
    for chunk in parts:
        hm = re.match(r"<h([23])[\s\S]*?</h\1>", chunk, re.I)
        if hm:
            title = _heading_title(chunk)
            if hm.group(1) == "2":
                slot = ""
            else:
                slot = _slot_name(title)
            continue
        if not slot:
            continue
        for it in parse_standard_table(chunk, kind, kind_label, wiki_page):
            it["slot"] = slot
            items.append(it)
    return items


def _prepare_accessory(it: dict) -> dict:
    """Пол в поле gender, подпись цвета без (м)/(ж), общее имя семьи."""
    raw = (it.get("name") or "").strip()
    item = dict(it)
    item["_rawNames"] = [raw]
    parsed: list[dict] = []
    for v in it.get("lookVariants") or []:
        if not isinstance(v, dict):
            continue
        base, gender = _split_variant_label(v.get("label") or "")
        url = v.get("url") or ""
        if not url:
            continue
        parsed.append(
            {
                "base": base,
                "gender": gender,
                "url": url,
                "image": v.get("image") or "",
                "anim": _yo(base).lower().startswith("анимац"),
            }
        )

    row_m = _GENDER_NAME.match(raw)
    row_g = row_m.group("g").lower() if row_m else ""
    if row_g and parsed and all(not p["gender"] for p in parsed if not p["anim"]):
        for p in parsed:
            if not p["anim"]:
                p["gender"] = row_g

    last_g = ""
    for p in parsed:
        if p["anim"]:
            continue
        if p["gender"]:
            last_g = p["gender"]
        elif last_g and p["base"] and not _is_color_word(p["base"]):
            p["gender"] = last_g

    genders_present = {p["gender"] for p in parsed if p["gender"]}
    gender_names: dict[str, str] = {}
    name = raw
    pair = _GENDER_PAIR.match(raw)
    if pair:
        a = pair.group("a").strip()
        b = (pair.group("b") or "").strip()
        ga = pair.group("ga").lower()
        gb = pair.group("gb").lower()
        a, b = _align_gender_title(a, b if b else a)
        if a.casefold() != b.casefold():
            gender_names = {ga: a, gb: b}
        name = _catalog_join(a, b)
    elif row_m and len(genders_present) >= 2:
        a = row_m.group("body").strip()
        other = ""
        other_g = ""
        for p in parsed:
            if p["anim"] or not p["gender"] or p["gender"] == row_g:
                continue
            if (
                p["base"]
                and p["base"].casefold() != a.casefold()
                and not _is_color_word(p["base"])
                and not _is_extra_look_label(p["base"])
            ):
                other = p["base"]
                other_g = p["gender"]
                break
        if other and other_g:
            a2, b2 = _align_gender_title(a, other)
            gender_names = {row_g: a2, other_g: b2}
            name = _catalog_join(a2, b2)
        else:
            name = a

    if not gender_names and len(genders_present) >= 2:
        slash = _SLASH_QUOTES.match(name)
        if slash:
            pre, post = slash.group("pre"), slash.group("post")
            gender_names = {
                "ж": f"{pre}{slash.group('a')}{post}".strip(),
                "м": f"{pre}{slash.group('b')}{post}".strip(),
            }
            if gender_names["ж"].casefold() == gender_names["м"].casefold():
                gender_names = {}

    colorish = [p for p in parsed if p["base"] and not p["anim"]]
    all_colors = bool(colorish) and all(_is_color_word(p["base"]) for p in colorish)

    out_vars: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for p in parsed:
        if p["anim"]:
            label = p["base"] or "анимация 1"
            gender = p["gender"]
        elif _is_item_title(p["base"], name):
            label = ""
            gender = p["gender"]
        elif all_colors or _is_color_word(p["base"]):
            label = p["base"]
            gender = p["gender"]
        elif _is_extra_look_label(p["base"]):
            label = p["base"].strip(" -–—")
            gender = p["gender"]
        else:
            # другое имя того же семейства — пол, без отдельной «цветной» подписи
            label = ""
            gender = p["gender"]
        key = (label.casefold(), gender, p["url"])
        if key in seen:
            continue
        seen.add(key)
        row = {"label": label, "url": p["url"]}
        if gender:
            row["gender"] = gender
        if p["image"]:
            row["image"] = p["image"]
        out_vars.append(row)

    anims = [v for v in out_vars if _yo(v.get("label") or "").lower().startswith("анимац")]
    static = [v for v in out_vars if v not in anims]
    out_vars = static + anims

    item["name"] = name
    if gender_names and len({v.casefold() for v in gender_names.values()}) > 1:
        item["genderNames"] = gender_names
    else:
        item.pop("genderNames", None)
    if len(out_vars) >= 2:
        item["lookVariants"] = out_vars
    else:
        item.pop("lookVariants", None)
        if len(out_vars) == 1 and not item.get("lookImageUrl"):
            item["lookImageUrl"] = out_vars[0]["url"]
    _set_primary_look(item)
    return item


def _set_primary_look(it: dict) -> None:
    variants = [v for v in (it.get("lookVariants") or []) if isinstance(v, dict) and v.get("url")]
    if not variants:
        return

    def _anim(v: dict) -> bool:
        return _yo(v.get("label") or "").lower().startswith("анимац")

    url = ""
    for gender in ("ж", "м", ""):
        for v in variants:
            if _anim(v):
                continue
            if (v.get("gender") or "") == gender:
                url = v["url"]
                break
        if url:
            break
    it["lookImageUrl"] = url or variants[0]["url"]


def _same_text(a: str, b: str) -> bool:
    return re.sub(r"\s+", " ", (a or "").strip()) == re.sub(r"\s+", " ", (b or "").strip())


def _note_body(note: str) -> str:
    text = re.sub(r"варианты:\s*.*$", "", note or "", flags=re.I | re.S)
    return re.sub(r"\s+", " ", text).strip(" ·")


def _merge_link_lists(*groups: list | None) -> list[dict]:
    out: list[dict] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for lk in group or []:
            if not isinstance(lk, dict):
                continue
            key = (lk.get("text") or "", lk.get("href") or "")
            if not key[1] or key in seen:
                continue
            seen.add(key)
            out.append(dict(lk))
    return out


def _merge_gender_twins(a: dict, b: dict) -> dict:
    pa = _GENDER_NAME.match(a.get("name") or "")
    pb = _GENDER_NAME.match(b.get("name") or "")
    assert pa and pb
    ga = pa.group("g").lower()
    gb = pb.group("g").lower()
    merged = dict(a)
    merged["name"] = pa.group("body").strip()
    merged["_rawNames"] = list(a.get("_rawNames") or []) + list(b.get("_rawNames") or [])
    merged.pop("genderNames", None)

    def _vars_for(it: dict, gender: str) -> list[dict]:
        rows = []
        for v in it.get("lookVariants") or []:
            if not isinstance(v, dict) or not v.get("url"):
                continue
            row = dict(v)
            if not row.get("gender") and not _yo(row.get("label") or "").lower().startswith("анимац"):
                row["gender"] = gender
            rows.append(row)
        if rows:
            return rows
        url = it.get("lookImageUrl") or ""
        if not url:
            return []
        return [{"label": "", "gender": gender, "url": url}]

    out_vars: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for v in _vars_for(a, ga) + _vars_for(b, gb):
        key = ((v.get("label") or "").casefold(), v.get("gender") or "", v.get("url") or "")
        if key in seen:
            continue
        seen.add(key)
        out_vars.append(v)
    anims = [v for v in out_vars if _yo(v.get("label") or "").lower().startswith("анимац")]
    static = [v for v in out_vars if v not in anims]
    merged["lookVariants"] = static + anims

    primary = a if ga == "ж" else b if gb == "ж" else a
    secondary = b if primary is a else a
    merged["imageUrl"] = primary.get("imageUrl") or secondary.get("imageUrl") or ""
    if primary.get("image"):
        merged["image"] = primary["image"]
    else:
        merged.pop("image", None)

    da = (a.get("description") or "").strip()
    db = (b.get("description") or "").strip()
    sa = (a.get("source") or "").strip()
    sb = (b.get("source") or "").strip()
    na = (a.get("note") or "").strip()
    nb = (b.get("note") or "").strip()
    info: dict[str, dict] = {}
    if not _same_text(da, db):
        info.setdefault(ga, {})["description"] = da
        info.setdefault(gb, {})["description"] = db
        merged["description"] = (info.get("ж") or info.get(ga) or {}).get("description") or da
    else:
        merged["description"] = da
    if not _same_text(sa, sb):
        info.setdefault(ga, {})["source"] = sa
        info.setdefault(gb, {})["source"] = sb
        if a.get("sourceLinks"):
            info[ga]["sourceLinks"] = _merge_link_lists(a.get("sourceLinks"))
        if b.get("sourceLinks"):
            info[gb]["sourceLinks"] = _merge_link_lists(b.get("sourceLinks"))
        prefer = "ж" if "ж" in info and info["ж"].get("source") else ga
        merged["source"] = info.get(prefer, {}).get("source") or sa
        merged["sourceLinks"] = _merge_link_lists(info.get(prefer, {}).get("sourceLinks"))
    else:
        merged["source"] = sa
        merged["sourceLinks"] = _merge_link_lists(a.get("sourceLinks"), b.get("sourceLinks"))
    if _note_body(na) != _note_body(nb):
        info.setdefault(ga, {})["note"] = na
        info.setdefault(gb, {})["note"] = nb
        merged["note"] = (info.get("ж") or {}).get("note") or na
    else:
        merged["note"] = na if len(na) >= len(nb) else nb
        merged["noteLinks"] = _merge_link_lists(a.get("noteLinks"), b.get("noteLinks"))
    if info:
        merged["genderInfo"] = {k: v for k, v in info.items() if v}
    else:
        merged.pop("genderInfo", None)
    for key in ("descriptionLinks",):
        merged[key] = _merge_link_lists(a.get(key), b.get(key))
        if not merged[key]:
            merged.pop(key, None)
    if not merged.get("sourceLinks"):
        merged.pop("sourceLinks", None)
    if not merged.get("noteLinks"):
        merged.pop("noteLinks", None)
    _set_primary_look(merged)
    return merged


def _can_merge_gender_twins(a: dict, b: dict) -> bool:
    if (a.get("slot") or "") != (b.get("slot") or ""):
        return False
    if (a.get("category") or "") != (b.get("category") or ""):
        return False
    pa = _GENDER_NAME.match((a.get("name") or "").strip())
    pb = _GENDER_NAME.match((b.get("name") or "").strip())
    if not pa or not pb:
        return False
    if pa.group("body").strip().casefold() != pb.group("body").strip().casefold():
        return False
    if pa.group("g").lower() == pb.group("g").lower():
        return False

    def _genders(it: dict) -> set[str]:
        return {
            (v.get("gender") or "")
            for v in (it.get("lookVariants") or [])
            if isinstance(v, dict) and v.get("gender")
        }

    if len(_genders(a)) > 1 or len(_genders(b)) > 1:
        return False
    return True


def _merge_color_group(group: list[dict], stem: str) -> dict:
    merged = dict(group[0])
    title = stem[:1].upper() + stem[1:] if stem else merged.get("name") or ""
    merged["name"] = title
    raw: list[str] = []
    for it in group:
        raw.extend(it.get("_rawNames") or [it.get("name") or ""])
    merged["_rawNames"] = raw
    out_vars: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for it in group:
        color, _ = _split_color_prefix(it.get("name") or "")
        rows = [v for v in (it.get("lookVariants") or []) if isinstance(v, dict) and v.get("url")]
        if not rows:
            url = it.get("lookImageUrl") or it.get("imageUrl") or ""
            if url:
                rows = [{"label": "", "url": url}]
        for v in rows:
            row = dict(v)
            lab = (row.get("label") or "").strip()
            if not _yo(lab).lower().startswith("анимац") and not _is_extra_look_label(lab):
                if not lab or _is_item_title(lab, it.get("name") or "") or _is_item_title(lab, title):
                    if color:
                        row["label"] = color.lower()
            key = ((row.get("label") or "").casefold(), row.get("gender") or "", row.get("url") or "")
            if key in seen:
                continue
            seen.add(key)
            out_vars.append(row)
    anims = [v for v in out_vars if _yo(v.get("label") or "").lower().startswith("анимац")]
    static = [v for v in out_vars if v not in anims]
    merged["lookVariants"] = static + anims
    merged.pop("genderNames", None)
    _set_primary_look(merged)
    return merged


def _merge_color_families(items: list[dict]) -> list[dict]:
    """Соседние «Белый костюм X» / «Желтый костюм X» одного события → одна карточка."""
    out: list[dict] = []
    i = 0
    while i < len(items):
        cur = items[i]
        kind = cur.get("kind") or ""
        if kind not in {"event_clothes", "kids_clothes"} or cur.get("genderNames"):
            out.append(cur)
            i += 1
            continue
        color, stem = _split_color_prefix(cur.get("name") or "")
        if not color or not stem:
            out.append(cur)
            i += 1
            continue
        group = [cur]
        j = i + 1
        while j < len(items):
            nxt = items[j]
            if (nxt.get("kind") or "") != kind:
                break
            if (nxt.get("source") or "") != (cur.get("source") or ""):
                break
            if nxt.get("genderNames"):
                break
            c2, s2 = _split_color_prefix(nxt.get("name") or "")
            if not c2 or _fold_name(s2) != _fold_name(stem):
                break
            group.append(nxt)
            j += 1
        if len(group) >= 2:
            out.append(_merge_color_group(group, stem))
            i = j
        else:
            out.append(cur)
            i += 1
    return out


def finalize_accessory_items(items: list[dict]) -> list[dict]:
    """Склеивает соседние (ж)/(м) одного названия и нормализует цвета."""
    prepared = [_prepare_accessory(it) for it in items]
    out: list[dict] = []
    i = 0
    twin_merges = 0
    while i < len(prepared):
        cur = prepared[i]
        if i + 1 < len(prepared) and _can_merge_gender_twins(cur, prepared[i + 1]):
            out.append(_merge_gender_twins(cur, prepared[i + 1]))
            twin_merges += 1
            i += 2
            continue
        out.append(cur)
        i += 1
    before_color = len(out)
    out = _merge_color_families(out)
    finalize_accessory_items.last_stats = {
        "genderTwins": twin_merges,
        "colorFamilies": before_color - len(out),
    }
    # точный повтор строки на вики (одни и те же имя, слот, категория и источник)
    deduped: list[dict] = []
    seen: set[tuple[str, str, str, str]] = set()
    for it in out:
        key = (
            it.get("slot") or "",
            it.get("category") or "",
            (it.get("name") or "").casefold(),
            re.sub(r"\s+", " ", (it.get("source") or "").casefold()),
            re.sub(r"\s+", " ", (it.get("description") or "").casefold()),
        )  # slot, category, name, source, description
        if key in seen:
            continue
        seen.add(key)
        deduped.append(it)
    return deduped


finalize_look_items = finalize_accessory_items


def parse_backpacks(html: str, kind: str, kind_label: str, wiki_page: str) -> list[dict]:
    """Рюкзаки: взрослые / дети по h3; гитары — отдельная страница."""
    if "гитар" in (wiki_page or "").lower():
        items = parse_standard_table(html, kind, kind_label, wiki_page)
        for it in items:
            it["category"] = "Гитара на спину"
        return items
    body = content_body(html)
    parts = re.split(r"(<h3[\s\S]*?</h3>)", body, flags=re.I)
    cat = ""
    items: list[dict] = []
    for chunk in parts:
        hm = re.match(r"<h3[\s\S]*?</h3>", chunk, re.I)
        if hm:
            title = re.sub(r"^\[\s*править\s*\]\s*", "", strip_tags(chunk), flags=re.I).strip()
            low = title.lower()
            if "дет" in low:
                cat = "Для детей"
            elif "взросл" in low:
                cat = "Для взрослых"
            else:
                cat = title
            continue
        for it in parse_standard_table(chunk, kind, kind_label, wiki_page):
            if cat:
                it["category"] = cat
            items.append(it)
    return items


PARSERS = {
    "achievements": parse_achievements,
    "wings": parse_standard_table,
    "transport": parse_standard_table,
    "accessories": parse_accessories,
    "hairstyles": parse_standard_table,
    "interactive": parse_standard_table,
    "wands": parse_standard_table,
    "umbrellas": parse_standard_table,
    "backpacks": parse_backpacks,
    "balloons": parse_standard_table,
    "hand_decor": parse_standard_table,
    "toys": parse_standard_table,
    "shoes": parse_standard_table,
    "kids_masks": parse_standard_table,
    "bouquets": parse_standard_table,
    "bows": parse_standard_table,
    "amusements": parse_standard_table,
    "forms": parse_standard_table,
    "stickers": parse_standard_table,
    "gems": parse_gems,
    "emotes": parse_emotes,
    "card_bg": parse_name_view_table,
    "show_bg": parse_name_view_table,
    "card_frame": parse_name_view_table,
    "pets": parse_pets_grid,
    "event_clothes": parse_list_items,
    "kids_clothes": parse_list_items,
}


def wiki_api(**params) -> dict:
    """MediaWiki API — тот же endpoint, что Служебная:ApiSandbox."""
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
    cmd = [
        "curl.exe",
        "-sL",
        "--compressed",
        "-c",
        str(COOKIE_FILE),
        "-b",
        str(COOKIE_FILE),
        "-A",
        UA,
        "--max-time",
        "60",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0 or not proc.stdout:
        raise RuntimeError("wiki api failed")
    return json.loads(proc.stdout.decode("utf-8", "replace"))


def api_check_pages(titles: list[str]) -> list[dict]:
    """Проверка существования страниц через API (до HTML-скрапа)."""
    out: list[dict] = []
    for i in range(0, len(titles), 40):
        chunk = titles[i : i + 40]
        data = wiki_api(action="query", titles="|".join(chunk), prop="info")
        out.extend(data.get("query", {}).get("pages", []))
    return out


def opener() -> urllib.request.OpenerDirector:
    try:
        from scrape_by_id import COOKIE_FILE, warmup

        warmup()
        ck = Path(COOKIE_FILE)
    except Exception:
        ck = OUT / "cookies.txt"
    jar = http.cookiejar.MozillaCookieJar(str(ck))
    try:
        jar.load(ignore_discard=True, ignore_expires=True)
    except Exception:
        jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )


def wiki_cache_path(title: str) -> Path:
    safe = (title or "").replace("/", "_").replace("\\", "_").replace(" ", "_")
    return OUT / f"_wiki_page_{safe}.html"


def merge_characteristics_links_from_caches(items: list[dict]) -> None:
    """Заполнить characteristicsLinks из уже скачанных статей (без сети)."""
    for it in items:
        if it.get("kind") not in ARTICLE_ENRICH_KINDS:
            continue
        wiki = it.get("wiki") or ""
        title = wiki_title_from_url(wiki)
        if not title or is_catalog_wiki_url(wiki):
            continue
        cache = wiki_cache_path(title)
        if not cache.exists() or cache.stat().st_size <= 500:
            continue
        html = cache.read_text(encoding="utf-8", errors="replace")
        if is_missing_article(html):
            continue
        parsed = parse_item_article(html, it.get("name") or "")
        raw = parsed.get("characteristicsLinks") or []
        if not raw:
            continue
        it["characteristicsLinks"] = _merge_link_lists(it.get("characteristicsLinks"), raw)


def fetch_html(op: urllib.request.OpenerDirector, title: str) -> str:
    """curl надёжнее urllib на parapa (иначе 307-петля редиректов)."""
    url = WIKI_BASE + urllib.parse.quote(title)
    OUT.mkdir(parents=True, exist_ok=True)
    cmd = [
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
        "-H",
        "Referer: https://parapa.ru/wiki/",
        "--max-time",
        "90",
        "--connect-timeout",
        "25",
        url,
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode == 0 and proc.stdout and len(proc.stdout) > 500:
        return proc.stdout.decode("utf-8", "replace")
    # запасной путь через urllib/proxy
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Referer": "https://parapa.ru/wiki/", "Accept-Language": "ru"},
    )
    try:
        with op.open(req, timeout=90) as resp:
            return resp.read().decode("utf-8", "replace")
    except Exception:
        proxy_url = PROXY + urllib.parse.quote(url, safe="")
        req2 = urllib.request.Request(proxy_url, headers={"User-Agent": UA})
        with op.open(req2, timeout=90) as resp:
            return resp.read().decode("utf-8", "replace")


def encode_url(url: str) -> str:
    p = urllib.parse.urlsplit(url)
    parts = []
    for seg in p.path.split("/"):
        if not seg:
            parts.append("")
            continue
        parts.append(urllib.parse.quote(urllib.parse.unquote(seg), safe="._-~"))
    path = "/".join(parts)
    return urllib.parse.urlunsplit((p.scheme, p.netloc, path, p.query, p.fragment))


def alt_hosts(url: str) -> list[str]:
    out = [encode_url(url)]
    if "://parapa.ru/" in url:
        out.append(encode_url(url.replace("://parapa.ru/", "://www.parapa.ru/", 1)))
    elif "://www.parapa.ru/" in url:
        out.append(encode_url(url.replace("://www.parapa.ru/", "://parapa.ru/", 1)))
    for u in list(out):
        out.append(PROXY + urllib.parse.quote(u, safe=""))
    seen: set[str] = set()
    uniq: list[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def ok_image(b: bytes) -> bool:
    if len(b) < 200:
        return False
    if b.startswith(b"\x89PNG\r\n\x1a\n"):
        return True
    if b[:3] == b"\xff\xd8\xff":
        return True
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return True
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return True
    return False


def img_ext(b: bytes, url: str) -> str:
    if b.startswith(b"\x89PNG"):
        return ".png"
    if b[:3] == b"\xff\xd8\xff":
        return ".jpg"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    if b[:4] == b"RIFF":
        return ".webp"
    path = urllib.parse.urlsplit(url).path.lower()
    for ext in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    # редкий uppercase .PNG в URL без сигнатуры — всё равно png
    return ".png"


def safe_stem(url: str) -> str:
    path = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
    name = Path(path).name
    # убрать расширение — его добавит img_ext
    stem = Path(name).stem
    stem = re.sub(r"[^\w.\-А-Яа-яЁё]+", "_", stem, flags=re.UNICODE)
    stem = stem.strip("._") or "img"
    if len(stem) > 80:
        stem = stem[:80]
    return stem


def fetch_image(op: urllib.request.OpenerDirector, url: str) -> bytes:
    last: Exception | None = None
    for candidate in alt_hosts(url):
        for try_i in range(3):
            try:
                req = urllib.request.Request(
                    candidate,
                    headers={
                        "User-Agent": UA,
                        "Referer": "https://www.parapa.ru/wiki/",
                        "Accept": "image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
                    },
                )
                with op.open(req, timeout=90) as resp:
                    raw = resp.read()
                if ok_image(raw):
                    return raw
                last = RuntimeError(f"bad image {len(raw)}")
            except Exception as e:
                last = e
                time.sleep(0.25 + try_i * 0.35)
        time.sleep(0.15)
    raise last or RuntimeError("fetch failed")


def _resolve_local_image(url: str, url_to_local: dict[str, str]) -> str:
    if url in url_to_local:
        return url_to_local[url]
    stem = safe_stem(url) if url else ""
    for ext in (".png", ".jpg", ".gif", ".webp"):
        p = IMG_DIR / f"{stem}{ext}"
        if p.exists():
            return f"data/wiki_img/{p.name}"
    return ""


def download_images(op: urllib.request.OpenerDirector, items: list[dict]) -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    jobs: list[str] = []
    seen: set[str] = set()
    for it in items:
        for key in ("imageUrl", "lookImageUrl", "iconUrl"):
            url = it.get(key) or ""
            if not url or url in seen:
                continue
            seen.add(url)
            jobs.append(url)
        for var in it.get("lookVariants") or []:
            url = (var or {}).get("url") or ""
            if not url or url in seen:
                continue
            seen.add(url)
            jobs.append(url)

    url_to_local: dict[str, str] = {}
    ok = skip = fail = 0
    total = len(jobs)
    print(f"download images: {total}", flush=True)
    for i, url in enumerate(jobs, 1):
        stem = safe_stem(url)
        existing = None
        for ext in (".png", ".jpg", ".gif", ".webp"):
            p = IMG_DIR / f"{stem}{ext}"
            if p.exists() and p.stat().st_size > 200:
                existing = p
                break
        if existing:
            url_to_local[url] = f"data/wiki_img/{existing.name}"
            skip += 1
        else:
            try:
                raw = fetch_image(op, url)
                ext = img_ext(raw, url)
                dest = IMG_DIR / f"{stem}{ext}"
                n = 1
                while dest.exists() and dest.stat().st_size != len(raw):
                    dest = IMG_DIR / f"{stem}_{n}{ext}"
                    n += 1
                dest.write_bytes(raw)
                url_to_local[url] = f"data/wiki_img/{dest.name}"
                ok += 1
            except Exception as e:
                fail += 1
                if fail <= 12:
                    print(f"  FAIL {url[:70]}… {e}", flush=True)
        if i % 40 == 0 or i == total:
            print(f"  [{i}/{total}] ok={ok} skip={skip} fail={fail}", flush=True)

    for it in items:
        icon_url = it.get("imageUrl") or it.get("iconUrl") or ""
        look_url = it.get("lookImageUrl") or ""
        if icon_url:
            local = _resolve_local_image(icon_url, url_to_local)
            if local:
                it["image"] = local
        if look_url:
            local_look = _resolve_local_image(look_url, url_to_local)
            if local_look:
                it["lookImage"] = local_look
        for var in it.get("lookVariants") or []:
            if not isinstance(var, dict):
                continue
            local_v = _resolve_local_image(var.get("url") or "", url_to_local)
            if local_v:
                var["image"] = local_v


def _norm_acc_name(name: str) -> str:
    name = _yo(name or "").casefold()
    name = re.sub(r"\s*\([мж]\)\s*$", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def _alice_bits(text: str) -> list[str]:
    out: list[str] = []
    for sent in re.findall(
        r"(?:для обмена|обменять у алисы)\s*[^.]{0,180}",
        text or "",
        flags=re.I,
    ):
        sent = re.sub(r"\s+", " ", sent).strip(" ·,;")
        if sent and sent.casefold() not in {s.casefold() for s in out}:
            out.append(sent)
    return out


def _merge_alice_source(source: str) -> str:
    source = (source or "").strip().rstrip(",")
    tag = "Алиса (обмен подарков)"
    if tag.casefold() in source.casefold():
        return source
    return f"{source}, {tag}" if source else tag


def inherit_accessory_extras(new_items: list[dict], old_items: list[dict]) -> tuple[list[dict], list[dict]]:
    """Сохраняет id и пометки Алисы. Возвращает (новые, невошедшие старые карточки)."""
    old_by: dict[str, list[dict]] = {}
    for old in old_items:
        old_by.setdefault(_norm_acc_name(old.get("name") or ""), []).append(old)
    consumed: set[int] = set()
    fresh: list[dict] = []
    for it in new_items:
        found: list[dict] = []
        seen: set[int] = set()
        keys = list(it.get("_rawNames") or []) + [it.get("name") or ""]
        for raw in keys:
            for old in old_by.get(_norm_acc_name(raw), []):
                oid = old.get("id")
                if oid in seen:
                    continue
                seen.add(oid)
                found.append(old)
        if found:
            prefer = found[0]
            for old in found:
                if re.search(r"\(ж\)\s*$", old.get("name") or "", re.I):
                    prefer = old
                    break
            it["id"] = prefer["id"]
            for old in found:
                if old.get("id") is not None:
                    consumed.add(int(old["id"]))
            if any("алиса (обмен подарков)" in (o.get("source") or "").casefold() for o in found):
                it["source"] = _merge_alice_source(it.get("source") or "")
                info = it.get("genderInfo") or {}
                for meta in info.values():
                    if isinstance(meta, dict) and meta.get("source"):
                        meta["source"] = _merge_alice_source(meta.get("source") or "")
            for field in ("note", "description"):
                blob = it.get(field) or ""
                for old in found:
                    for sent in _alice_bits(old.get(field) or ""):
                        if sent.casefold() not in blob.casefold():
                            blob = f"{blob} · {sent}".strip(" ·")
                if blob:
                    it[field] = blob
            if not it.get("image") and prefer.get("image") and (prefer.get("imageUrl") or "") == (it.get("imageUrl") or ""):
                it["image"] = prefer["image"]
            if not it.get("lookImage") and prefer.get("lookImage") and (prefer.get("lookImageUrl") or "") == (it.get("lookImageUrl") or ""):
                it["lookImage"] = prefer["lookImage"]
            if not it.get("lookImageUrl") and prefer.get("lookImageUrl"):
                it["lookImageUrl"] = prefer["lookImageUrl"]
                if prefer.get("lookImage") and not it.get("lookImage"):
                    it["lookImage"] = prefer["lookImage"]
            if not it.get("lookVariants") and prefer.get("lookVariants"):
                it["lookVariants"] = prefer["lookVariants"]
            if is_catalog_wiki_url(it.get("wiki") or "") and prefer.get("wiki") and not is_catalog_wiki_url(prefer.get("wiki") or ""):
                it["wiki"] = prefer["wiki"]
        else:
            fresh.append(it)
        it.pop("_rawNames", None)
    used = {int(it["id"]) for it in new_items if it.get("id") is not None}
    next_id = max([int(it.get("id") or 0) for it in old_items] + [0]) + 1
    # id новых предметов не должны пересечься со всем каталогом — уточнит вызывающий
    for it in fresh:
        while next_id in used:
            next_id += 1
        it["id"] = next_id
        used.add(next_id)
        next_id += 1
    kept = [old for old in old_items if int(old.get("id") or -1) not in consumed]
    return new_items, kept


def accessory_report(items: list[dict]) -> dict:
    both = 0
    colors = 0
    with_v = 0
    for it in items:
        variants = [v for v in (it.get("lookVariants") or []) if isinstance(v, dict)]
        if len(variants) >= 2:
            with_v += 1
        genders = {(v.get("gender") or "") for v in variants if v.get("gender")}
        if genders >= {"м", "ж"}:
            both += 1
        labels: dict[str, set[str]] = {}
        for v in variants:
            lab = (v.get("label") or "").strip()
            if not lab or _yo(lab).lower().startswith("анимац"):
                continue
            labels.setdefault(v.get("gender") or "", set()).add(lab.casefold())
        if any(len(s) >= 2 for s in labels.values()):
            colors += 1
    return {
        "count": len(items),
        "lookVariants": with_v,
        "bothGenders": both,
        "colorVariants": colors,
    }


def _print_look_report(kind: str, items: list[dict], extra: str = "", *, with_merge: bool = False) -> None:
    report = accessory_report(items)
    merge = ""
    if with_merge:
        st = getattr(finalize_accessory_items, "last_stats", None) or {}
        merge = (
            f" mergedTwins={st.get('genderTwins', 0)} "
            f"mergedColorFamilies={st.get('colorFamilies', 0)}"
        )
    print(
        f"  {kind}: count={report['count']} lookVariants={report['lookVariants']} "
        f"bothGenders={report['bothGenders']} colorVariants={report['colorVariants']}"
        f"{merge}{extra}",
        flush=True,
    )


def classify_gender_info_links(items: list[dict], index) -> None:
    from wiki_links import classify_link

    for it in items:
        info = it.get("genderInfo") or {}
        for meta in info.values():
            if not isinstance(meta, dict) or not meta.get("sourceLinks"):
                continue
            classified = []
            seen_l: set[tuple] = set()
            for lk in meta.get("sourceLinks") or []:
                got = classify_link(lk, it, index)
                if not got:
                    continue
                token = (got.get("text"), got.get("href"), got.get("kind"), got.get("section"), got.get("itemId"))
                if token in seen_l:
                    continue
                seen_l.add(token)
                classified.append(got)
            if classified:
                meta["sourceLinks"] = classified
            else:
                meta.pop("sourceLinks", None)


def _item_dedupe_key(it: dict) -> str:
    kind = it.get("kind") or ""
    cat = it.get("category") or ""
    name = (it.get("name") or "").lower()
    src = (it.get("source") or "").lower() if kind in {"event_clothes", "kids_clothes"} else ""
    return f"{kind}|{cat}|{name}|{src}"


def _splice_kind(items: list[dict], kind: str, new_block: list[dict]) -> list[dict]:
    head: list[dict] = []
    tail: list[dict] = []
    seen = False
    for it in items:
        if it.get("kind") == kind:
            seen = True
            continue
        (tail if seen else head).append(it)
    if not seen:
        return items + new_block
    return head + new_block + tail


def _assign_unique_ids(block: list[dict], used: set[int], next_id: int) -> int:
    for it in block:
        iid = it.get("id")
        if iid is None or int(iid) in used:
            while next_id in used:
                next_id += 1
            it["id"] = next_id
            used.add(next_id)
            next_id += 1
        else:
            used.add(int(iid))
    return next_id


def refresh_accessories(from_cache: bool, skip_download: bool) -> int:
    """Пересобрать только аксессуары в wiki_items.json, не сдвигая остальные id."""
    wiki_title, kind, label = "Аксессуары", "accessories", "Аксессуары"
    cache = OUT / f"_wiki_page_{wiki_title}.html"
    op = opener()
    if from_cache and cache.exists():
        html = cache.read_text(encoding="utf-8")
        print(f"cache {wiki_title}", flush=True)
    else:
        print(f"fetch {wiki_title}…", flush=True)
        html = fetch_html(op, wiki_title)
        cache.write_text(html, encoding="utf-8")

    chunk = parse_accessories(html, kind, label, wiki_title)
    from wiki_links import attach_page_links, build_index, classify_items, classify_link, read_items

    attach_page_links(chunk, html, kind, wiki_title)
    chunk = finalize_accessory_items(chunk)
    print(f"parsed accessories: {len(chunk)}", flush=True)

    data = json.loads(JSON_OUT.read_text(encoding="utf-8"))
    items = data.get("items") or []
    old_acc = [it for it in items if it.get("kind") == "accessories"]
    others_ids = [int(it["id"]) for it in items if it.get("kind") != "accessories" and it.get("id") is not None]
    chunk, kept = inherit_accessory_extras(chunk, old_acc)
    used_seed = [int(it["id"]) for it in chunk + kept if it.get("id") is not None]
    used_seed.extend(others_ids)
    next_id = (max(used_seed) if used_seed else 0) + 1
    seen_ids: set[int] = set(others_ids)
    for it in chunk + kept:
        iid = it.get("id")
        if iid is None or int(iid) in seen_ids:
            while next_id in seen_ids:
                next_id += 1
            it["id"] = next_id
            seen_ids.add(next_id)
            next_id += 1
        else:
            seen_ids.add(int(iid))

    titles = read_items(OUT / "titles.json")
    head: list[dict] = []
    tail: list[dict] = []
    seen_acc = False
    for it in items:
        if it.get("kind") == "accessories":
            seen_acc = True
            continue
        (tail if seen_acc else head).append(it)
    all_items = head + chunk + kept + tail
    classify_items(all_items, also_index=titles)
    index = build_index(all_items + titles)
    for it in chunk:
        info = it.get("genderInfo") or {}
        for meta in info.values():
            if not isinstance(meta, dict) or not meta.get("sourceLinks"):
                continue
            classified = []
            seen_l: set[tuple] = set()
            for lk in meta.get("sourceLinks") or []:
                got = classify_link(lk, it, index)
                if not got:
                    continue
                token = (got.get("text"), got.get("href"), got.get("kind"), got.get("section"), got.get("itemId"))
                if token in seen_l:
                    continue
                seen_l.add(token)
                classified.append(got)
            if classified:
                meta["sourceLinks"] = classified
            else:
                meta.pop("sourceLinks", None)

    data["items"] = all_items
    data["count"] = len(all_items)
    by_kind = data.get("byKind") or {}
    by_kind[label] = len(chunk) + len(kept)
    data["byKind"] = by_kind
    data["updatedAt"] = datetime.now().isoformat(timespec="seconds")
    if not skip_download:
        download_images(op, chunk)
    JSON_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = accessory_report(chunk)
    print(
        f"accessories={report['count']} colorVariants={report['colorVariants']} "
        f"bothGenders={report['bothGenders']} keptExtra={len(kept)} total={len(all_items)}",
        flush=True,
    )
    if kept:
        print("kept outside wiki table:", ", ".join(it.get("name") or "?" for it in kept[:12]), flush=True)
    return 0


def _parse_kind_pages(
    op: urllib.request.OpenerDirector,
    kind: str,
    from_cache: bool,
) -> tuple[list[dict], str]:
    """Собрать и нормализовать все страницы одного kind."""
    from wiki_links import attach_page_links

    chunk: list[dict] = []
    label = kind
    pages = [(t, k, lab) for t, k, lab in PAGES if k == kind]
    for wiki_title, k, lab in pages:
        label = lab
        cache = OUT / f"_wiki_page_{wiki_title}.html"
        if from_cache and cache.exists():
            html = cache.read_text(encoding="utf-8")
            print(f"cache {wiki_title}", flush=True)
        else:
            print(f"fetch {wiki_title}…", flush=True)
            html = fetch_html(op, wiki_title)
            cache.write_text(html, encoding="utf-8")
        part = PARSERS[k](html, k, lab, wiki_title)
        attach_page_links(part, html, k, wiki_title)
        if k in LOOK_IMAGE_KINDS:
            part = apply_appearance_looks(html, part, k)
        if k in ARTICLE_ENRICH_KINDS:
            part = enrich_item_articles(op, part, from_cache=from_cache)
        chunk.extend(part)
        print(f"  parsed {lab}/{wiki_title}: {len(part)}", flush=True)
    if kind in GENDER_LOOK_KINDS:
        chunk = finalize_look_items(chunk)
    return chunk, label


def refresh_kinds(kind_set: set[str], from_cache: bool, skip_download: bool) -> int:
    """Пересобрать выбранные kind в wiki_items.json, сохранив остальные id."""
    unknown = kind_set - {k for _, k, _ in PAGES}
    if unknown:
        print(f"unknown kinds: {', '.join(sorted(unknown))}", flush=True)
        return 1
    op = opener()
    from wiki_links import build_index, classify_items, read_items

    data = json.loads(JSON_OUT.read_text(encoding="utf-8"))
    items = data.get("items") or []
    by_kind = data.get("byKind") or {}
    ordered: list[str] = []
    for _, k, _ in PAGES:
        if k in kind_set and k not in ordered:
            ordered.append(k)

    download_block: list[dict] = []
    used = {int(it["id"]) for it in items if it.get("id") is not None and it.get("kind") not in kind_set}
    next_id = (max(used) if used else 0) + 1

    for kind in ordered:
        chunk, label = _parse_kind_pages(op, kind, from_cache)
        old = [it for it in items if it.get("kind") == kind]
        chunk, kept = inherit_accessory_extras(chunk, old)
        if kind != "accessories":
            kept = []
        next_id = _assign_unique_ids(chunk + kept, used, next_id)
        items = _splice_kind(items, kind, chunk + kept)
        by_kind[label] = len(chunk) + len(kept)
        download_block.extend(chunk)
        extra = f" keptExtra={len(kept)}" if kept else ""
        _print_look_report(kind, chunk, extra, with_merge=kind in GENDER_LOOK_KINDS)
        if kept:
            print("  kept outside wiki table:", ", ".join(it.get("name") or "?" for it in kept[:12]), flush=True)

    titles = read_items(OUT / "titles.json")
    merge_characteristics_links_from_caches(items)
    classify_items(items, also_index=titles)
    classify_gender_info_links(items, build_index(items + titles))

    data["items"] = items
    data["count"] = len(items)
    data["byKind"] = by_kind
    data["updatedAt"] = datetime.now().isoformat(timespec="seconds")
    if not skip_download:
        download_images(op, download_block)
    JSON_OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {JSON_OUT} total={len(items)}", flush=True)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-cache", action="store_true", help="использовать data/_wiki_page_*.html")
    ap.add_argument("--skip-download", action="store_true")
    ap.add_argument(
        "--only-accessories",
        action="store_true",
        help="пересобрать только аксессуары в существующем wiki_items.json",
    )
    ap.add_argument(
        "--kinds",
        default="",
        help="через запятую: пересобрать только эти kind в существующем wiki_items.json",
    )
    args = ap.parse_args()
    kind_filter = {k.strip() for k in (args.kinds or "").split(",") if k.strip()}
    if args.only_accessories:
        kind_filter.add("accessories")
    if kind_filter:
        return refresh_kinds(kind_filter, args.from_cache, args.skip_download)

    OUT.mkdir(parents=True, exist_ok=True)
    op = opener()

    all_items: list[dict] = []
    by_kind: dict[str, int] = {}

    for wiki_title, kind, label in PAGES:
        cache = OUT / f"_wiki_page_{wiki_title}.html"
        try:
            if args.from_cache and cache.exists():
                html = cache.read_text(encoding="utf-8")
                print(f"cache {wiki_title}", flush=True)
            else:
                print(f"fetch {wiki_title}…", flush=True)
                html = fetch_html(op, wiki_title)
                cache.write_text(html, encoding="utf-8")
        except Exception as e:
            print(f"FAIL page {wiki_title}: {e}", flush=True)
            continue

        parser = PARSERS[kind]
        chunk = parser(html, kind, label, wiki_title)
        from wiki_links import attach_page_links

        attach_page_links(chunk, html, kind, wiki_title)
        if kind in GENDER_LOOK_KINDS:
            chunk = finalize_look_items(chunk)
            for it in chunk:
                it.pop("_rawNames", None)
        if kind in LOOK_IMAGE_KINDS:
            chunk = apply_appearance_looks(html, chunk, kind)
        if kind == "gems":
            chunk = enrich_gem_icons(op, chunk, from_cache=args.from_cache)
        if kind in ARTICLE_ENRICH_KINDS:
            chunk = enrich_item_articles(op, chunk, from_cache=args.from_cache)
        by_kind[label] = by_kind.get(label, 0) + len(chunk)
        print(
            f"  → {label}/{wiki_title}: {len(chunk)} "
            f"(imageUrl={sum(1 for it in chunk if it.get('imageUrl'))}, "
            f"look={sum(1 for it in chunk if it.get('lookImageUrl'))}, "
            f"lookV={sum(1 for it in chunk if len(it.get('lookVariants') or []) >= 2)})",
            flush=True,
        )
        if kind in GENDER_LOOK_KINDS:
            _print_look_report(kind, chunk, with_merge=True)
        all_items.extend(chunk)

    # дедуп по kind+name (прически/рюкзаки с двух страниц); одежда — ещё и по событию
    deduped: list[dict] = []
    seen_keys: set[str] = set()
    for it in all_items:
        key = _item_dedupe_key(it)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(it)
    if len(deduped) != len(all_items):
        print(f"dedupe {len(all_items)} → {len(deduped)}", flush=True)
    all_items = deduped

    # stable ids
    for i, it in enumerate(all_items, 1):
        it["id"] = i

    from wiki_links import classify_items, read_items, build_index

    titles = read_items(OUT / "titles.json")
    merge_characteristics_links_from_caches(all_items)
    classify_items(all_items, also_index=titles)
    classify_gender_info_links(all_items, build_index(all_items + titles))

    if not args.skip_download:
        download_images(op, all_items)

    payload = {
        "source": "https://www.parapa.ru/wiki/",
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "count": len(all_items),
        "byKind": by_kind,
        "kinds": [
            {"id": k, "label": lab}
            for k, lab in dict((k, lab) for _, k, lab in PAGES).items()
        ],
        "items": all_items,
    }
    JSON_OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {JSON_OUT} count={len(all_items)} byKind={by_kind}", flush=True)
    with_img = sum(1 for it in all_items if it.get("image"))
    print(f"with local image: {with_img}/{len(all_items)}", flush=True)
    for kind in sorted({it.get("kind") for it in all_items if it.get("kind") in GENDER_LOOK_KINDS | LOOK_VARIANT_KINDS}):
        chunk = [it for it in all_items if it.get("kind") == kind]
        _print_look_report(kind, chunk)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

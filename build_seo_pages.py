#!/usr/bin/env python3
"""
Генерация SEO-страниц из data/items.json:
  • sections/*.html — разделы и скидки
  • item/{id}.html  — карточки товаров
  • sitemap.xml / sitemap.txt

Запуск:
  py -3 build_seo_pages.py
"""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ITEMS_FILE = DATA / "items.json"
HISTORY_FILE = DATA / "price_history.json"
UPDATES_JSON = DATA / "updates.json"
SECTIONS_DIR = ROOT / "sections"
ITEMS_DIR = ROOT / "item"
SITE = "https://dramitelego-netizen.github.io/futurum-search"

SECTIONS = [
    ("packs", "Наборы", "Наборы и сундуки магазина Parapa — цены и список."),
    ("wings", "Крылья", "Крылья в магазине Parapa — цены, скидки и каталог."),
    ("pets", "Питомцы", "Питомцы магазина Parapa — цены и список предметов."),
    ("tricks", "Транспорт", "Транспорт и трюки Parapa — цены в каталоге."),
    ("items", "Предметы", "Предметы магазина Parapa — цены и каталог."),
    ("clothes", "Внешность", "Одежда и внешность Parapa — цены и список."),
    ("child_goods", "Детям", "Товары для детей в магазине Parapa — цены."),
]

CSS = """
:root{--bg:#07090d;--ink:#e8eef7;--mute:#7d8a9a;--accent:#3dffe0;--accent2:#ff4d6d;--line:rgba(232,238,247,.12);--panel:#12161e}
*{box-sizing:border-box}
body{margin:0;font-family:Rajdhani,system-ui,sans-serif;background:radial-gradient(ellipse 70% 45% at 20% 0%,#0f1a1c,transparent 55%),var(--bg);color:var(--ink);line-height:1.45;padding:1.25rem clamp(.85rem,3vw,1.75rem) 3rem}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:720px;margin:0 auto}
.nav{display:flex;flex-wrap:wrap;gap:.55rem 1rem;margin:0 0 1.1rem;font-size:.9rem;color:var(--mute)}
h1{font-family:Orbitron,sans-serif;font-size:clamp(1.05rem,2.8vw,1.45rem);letter-spacing:.1em;text-transform:uppercase;margin:0 0 .55rem}
.lead{color:var(--mute);margin:0 0 1.15rem;max-width:40rem}
.meta{color:var(--mute);font-size:.88rem;margin:0 0 1rem}
.card{background:color-mix(in srgb,var(--panel) 94%,black);border:1px solid var(--line);border-radius:14px;padding:1rem 1.05rem;margin:0 0 1rem}
.price{font-size:1.35rem;font-weight:700;color:var(--accent)}
.price.is-sale{color:var(--accent2)}
.old{color:var(--mute);text-decoration:line-through;margin-left:.45rem;font-size:.95rem}
.badge{display:inline-block;margin:.2rem .35rem .2rem 0;padding:.12rem .45rem;border-radius:999px;border:1px solid var(--line);font-size:.72rem;color:var(--mute)}
.badge.sale{color:var(--accent2);border-color:color-mix(in srgb,var(--accent2) 40%,transparent)}
.list{list-style:none;margin:0;padding:0;display:grid;gap:.45rem}
.list a.row{display:grid;grid-template-columns:1fr auto;gap:.75rem;align-items:baseline;padding:.55rem .7rem;border-radius:10px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 80%,transparent);color:inherit;text-decoration:none}
.list a.row:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--line))}
.list .nm{font-weight:600}
.list .pr{font-variant-numeric:tabular-nums;color:var(--accent);white-space:nowrap}
.list .pr.sale{color:var(--accent2)}
.thumb{display:block;width:min(160px,40vw);height:auto;border-radius:12px;border:1px solid var(--line);margin:0 0 .85rem;background:#0a0c10}
.sec-grid{display:flex;flex-wrap:wrap;gap:.4rem;margin:0 0 1.25rem}
.sec-grid a{padding:.28rem .65rem;border-radius:999px;border:1px solid var(--line);font-size:.8rem;color:var(--mute)}
.sec-grid a:hover,.sec-grid a.on{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 40%,var(--line))}
.footer{margin-top:2rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--mute);font-size:.85rem}
"""


def esc(s: object) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def load_items() -> list[dict]:
    data = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    items = data.get("items") or []
    return [i for i in items if i.get("id") is not None and i.get("name")]


def on_sale(it: dict) -> bool:
    if it.get("onSale"):
        return True
    old, price = it.get("priceOld"), it.get("price")
    try:
        return old is not None and price is not None and float(old) > float(price)
    except (TypeError, ValueError):
        return False


def fmt_price(n: object) -> str:
    try:
        v = int(float(n))
    except (TypeError, ValueError):
        return "—"
    return f"{v:,}".replace(",", "\u00a0") + " монет"


def item_in_category(it: dict, slug: str) -> bool:
    if it.get("category") == slug:
        return True
    cats = it.get("categories") or []
    return isinstance(cats, list) and slug in cats


def page_shell(
    *,
    title: str,
    description: str,
    canonical: str,
    body: str,
    json_ld: dict | list | None = None,
    extra_head: str = "",
) -> str:
    ld = ""
    if json_ld is not None:
        ld = (
            '<script type="application/ld+json">'
            + json.dumps(json_ld, ensure_ascii=False, separators=(",", ":"))
            + "</script>\n"
        )
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}" />
  <link rel="canonical" href="{esc(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:title" content="{esc(title)}" />
  <meta property="og:description" content="{esc(description)}" />
  <meta property="og:url" content="{esc(canonical)}" />
  <meta property="og:image" content="{SITE}/og-image.png" />
  <link rel="icon" href="{SITE}/favicon-48.png" type="image/png" sizes="48x48" />
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>{CSS}</style>
  {extra_head}{ld}</head>
<body>
  <div class="wrap">
{body}
  </div>
</body>
</html>
"""


def nav(extra: str = "") -> str:
    return f"""    <nav class="nav" aria-label="Навигация">
      <a href="{SITE}/">Поиск Пара па</a>
      <a href="{SITE}/catalog.html">Каталог</a>
      <a href="{SITE}/updates.html">Новинки</a>
      <a href="{SITE}/para-pa-skidki.html">Скидки</a>
      {extra}
    </nav>"""


def section_pills(active: str | None = None) -> str:
    bits = []
    for slug, title, _ in SECTIONS:
        cls = ' class="on"' if slug == active else ""
        bits.append(f'<a href="{SITE}/sections/{slug}.html"{cls}>{esc(title)}</a>')
    sale_cls = ' class="on"' if active == "sale" else ""
    bits.append(f'<a href="{SITE}/sections/sale.html"{sale_cls}>Скидки</a>')
    return '<div class="sec-grid">' + "".join(bits) + "</div>"


def item_rows(items: list[dict], *, limit: int | None = None) -> str:
    rows = []
    shown = items if limit is None else items[:limit]
    for it in shown:
        iid = int(it["id"])
        name = esc(it.get("name") or f"#{iid}")
        price = it.get("price")
        sale = on_sale(it)
        pr_cls = "pr sale" if sale else "pr"
        rows.append(
            f'<li><a class="row" href="{SITE}/item/{iid}.html">'
            f'<span class="nm">{name}</span>'
            f'<span class="{pr_cls}">{esc(fmt_price(price))}</span>'
            f"</a></li>"
        )
    return '<ul class="list">' + "\n".join(rows) + "</ul>"


def build_section_page(
    slug: str,
    title_ru: str,
    description: str,
    items: list[dict],
) -> str:
    count = len(items)
    sorted_items = sorted(
        items,
        key=lambda x: (0 if on_sale(x) else 1, str(x.get("name") or "").lower()),
    )
    h1 = f"{title_ru} — магазин Пара па"
    body = f"""{nav(f'<a href="{SITE}/sections/{slug}.html">{esc(title_ru)}</a>')}
    <h1>{esc(h1)}</h1>
    <p class="lead">{esc(description)} Неофициальный каталог магазина Пара па (Parapa).</p>
    <p class="meta">В разделе: <b>{count}</b> предметов. Цены в монетах магазина Пара па.</p>
    {section_pills(slug)}
    {item_rows(sorted_items)}
    <p class="footer">Неофициальный инструмент · не связан с администрацией Parapa ·
      <a href="{SITE}/?q=">открыть поиск</a></p>"""
    return page_shell(
        title=f"{title_ru} Пара па (Parapa) — цены | FUTURUM",
        description=f"{description} Магазин Пара па / Parapa.",
        canonical=f"{SITE}/sections/{slug}.html",
        body=body,
        json_ld={
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": h1,
            "url": f"{SITE}/sections/{slug}.html",
            "description": description,
            "isPartOf": {"@type": "WebSite", "name": "FUTURUM Search", "url": f"{SITE}/"},
            "numberOfItems": count,
        },
    )


def build_sale_page(items: list[dict]) -> str:
    sales = [i for i in items if on_sale(i) and not i.get("unavailable")]
    sales.sort(key=lambda x: str(x.get("name") or "").lower())
    desc = "Актуальные скидки в магазине Пара па (Parapa) — предметы со сниженной ценой в монетах."
    body = f"""{nav('<a href="' + SITE + '/sections/sale.html">Скидки</a>')}
    <h1>Скидки магазина Пара па</h1>
    <p class="lead">{esc(desc)} Также см.
      <a href="{SITE}/para-pa-skidki.html">обзор скидок Пара па</a>.</p>
    <p class="meta">Сейчас со скидкой: <b>{len(sales)}</b> предметов.</p>
    {section_pills("sale")}
    {item_rows(sales)}
    <p class="footer">Неофициальный инструмент ·
      <a href="{SITE}/">поиск по Пара па</a></p>"""
    return page_shell(
        title="Скидки Пара па (Parapa) — цены со скидкой | FUTURUM",
        description=desc,
        canonical=f"{SITE}/sections/sale.html",
        body=body,
        json_ld={
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Скидки магазина Пара па",
            "url": f"{SITE}/sections/sale.html",
            "numberOfItems": len(sales),
        },
    )


def build_item_page(it: dict) -> str:
    iid = int(it["id"])
    name = it.get("name") or f"Товар #{iid}"
    desc_raw = (it.get("description") or "").strip()
    short = desc_raw[:155] + ("…" if len(desc_raw) > 155 else "")
    if not short:
        short = f"{name} — цена в магазине Пара па (Parapa). Неофициальный каталог FUTURUM."
    price = it.get("price")
    old = it.get("priceOld")
    sale = on_sale(it)
    cat = it.get("category") or ""
    cat_title = it.get("categoryTitle") or next(
        (t for s, t, _ in SECTIONS if s == cat), ""
    )
    gender = {"m": "мужской", "f": "женский"}.get(it.get("gender") or "", "")
    gone = bool(it.get("unavailable"))
    img = it.get("imageLocal") or it.get("image") or ""
    if img and not str(img).startswith("http"):
        img_url = f"{SITE}/{str(img).lstrip('./')}"
    else:
        img_url = str(img) if img else f"{SITE}/og-image.png"
    parapa = it.get("url") or f"https://parapa.ru/mall/goods/{iid}/"
    search_q = re.sub(r"\s+", " ", str(name)).strip()
    from urllib.parse import quote

    search_href = f"{SITE}/?q={quote(search_q)}"

    badges = []
    if sale:
        badges.append('<span class="badge sale">скидка</span>')
    if gone:
        badges.append('<span class="badge">нет в продаже</span>')
    if gender:
        badges.append(f'<span class="badge">{esc(gender)}</span>')
    if cat_title:
        badges.append(
            f'<a class="badge" href="{SITE}/sections/{esc(cat)}.html">{esc(cat_title)}</a>'
        )

    price_html = f'<div class="price{" is-sale" if sale else ""}">{esc(fmt_price(price))}'
    if sale and old:
        price_html += f'<span class="old">{esc(fmt_price(old))}</span>'
    price_html += "</div>"

    thumb = ""
    if img:
        thumb = f'<img class="thumb" src="{esc(img_url)}" alt="{esc(name)}" width="128" height="128" loading="lazy" />'

    body = f"""{nav(f'<a href="{SITE}/item/{iid}.html">#{iid}</a>')}
    <article class="card">
      {thumb}
      <h1>{esc(name)}</h1>
      <div>{"".join(badges)}</div>
      {price_html}
      <p class="meta">id {iid} · магазин Пара па (Parapa)</p>
      <p>{esc(desc_raw) if desc_raw else "Описание появится после обновления каталога."}</p>
      <p>
        <a href="{esc(parapa)}" rel="noopener noreferrer" target="_blank">Открыть на Parapa</a>
        ·
        <a href="{esc(search_href)}">Найти в FUTURUM</a>
        {f'· <a href="{SITE}/sections/{esc(cat)}.html">{esc(cat_title)}</a>' if cat and cat_title else ""}
      </p>
    </article>
    <p class="footer">Неофициальный инструмент · не связан с администрацией Parapa</p>"""

    product: dict = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "sku": str(iid),
        "url": f"{SITE}/item/{iid}.html",
        "description": short,
        "image": img_url,
        "brand": {"@type": "Brand", "name": "Пара па"},
        "offers": {
            "@type": "Offer",
            "url": parapa,
            "priceCurrency": "RUB",
            "price": str(int(float(price))) if price is not None else "0",
            "availability": "https://schema.org/OutOfStock"
            if gone
            else "https://schema.org/InStock",
        },
    }

    return page_shell(
        title=f"{name} — цена Пара па (Parapa) | FUTURUM",
        description=short,
        canonical=f"{SITE}/item/{iid}.html",
        body=body,
        json_ld=product,
    )


def _load_price_lastmod() -> dict[int, str]:
    """id → YYYY-MM-DD по последней записи истории цен (реальная дата, не день сборки)."""
    out: dict[int, str] = {}
    if not HISTORY_FILE.exists():
        return out
    try:
        raw = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    except Exception:
        return out
    if not isinstance(raw, dict):
        return out
    for key, series in raw.items():
        try:
            iid = int(key)
        except (TypeError, ValueError):
            continue
        if not isinstance(series, list) or not series:
            continue
        last = series[-1]
        ts = last.get("t") if isinstance(last, dict) else None
        if not isinstance(ts, (int, float)) or ts <= 0:
            continue
        out[iid] = datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat()
    return out


def _load_history() -> dict:
    if not HISTORY_FILE.exists():
        return {}
    try:
        raw = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def _fmt_day(ts: int | float) -> str:
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).date().isoformat()


def collect_updates(items: list[dict]) -> dict:
    """Новинки (firstSeen / свежие id) + скидки + недавние смены цен."""
    by_id = {int(i["id"]): i for i in items}
    history = _load_history()

    news = [i for i in items if i.get("firstSeen")]
    news.sort(key=lambda x: int(x.get("firstSeen") or 0), reverse=True)
    if len(news) < 12:
        # запас: самые большие id как «относительно новые»
        rest = sorted(items, key=lambda x: int(x["id"]), reverse=True)
        seen = {int(i["id"]) for i in news}
        for it in rest:
            if int(it["id"]) in seen:
                continue
            news.append(it)
            if len(news) >= 16:
                break
    news = news[:16]

    sales = [i for i in items if on_sale(i) and not i.get("unavailable")]
    sales.sort(key=lambda x: str(x.get("name") or "").lower())

    price_moves: list[dict] = []
    for key, series in history.items():
        try:
            iid = int(key)
        except (TypeError, ValueError):
            continue
        if not isinstance(series, list) or len(series) < 2:
            continue
        last, prev = series[-1], series[-2]
        if not isinstance(last, dict) or not isinstance(prev, dict):
            continue
        if last.get("price") == prev.get("price") and last.get("priceOld") == prev.get(
            "priceOld"
        ):
            continue
        it = by_id.get(iid)
        if not it:
            continue
        price_moves.append(
            {
                "id": iid,
                "name": it.get("name"),
                "price": last.get("price"),
                "priceOld": last.get("priceOld") or prev.get("price"),
                "t": last.get("t") or 0,
            }
        )
    price_moves.sort(key=lambda x: int(x.get("t") or 0), reverse=True)
    price_moves = price_moves[:20]

    payload = {
        "generatedAt": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "news": [
            {
                "id": int(i["id"]),
                "name": i.get("name"),
                "price": i.get("price"),
                "firstSeen": i.get("firstSeen"),
            }
            for i in news
        ],
        "sales": [
            {
                "id": int(i["id"]),
                "name": i.get("name"),
                "price": i.get("price"),
                "priceOld": i.get("priceOld"),
            }
            for i in sales
        ],
        "priceMoves": price_moves,
    }
    UPDATES_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return payload


def build_updates_page(items: list[dict], payload: dict) -> str:
    news = payload.get("news") or []
    sales = payload.get("sales") or []
    moves = payload.get("priceMoves") or []
    by_id = {int(i["id"]): i for i in items}

    def rows_from(entries: list[dict], *, kind: str) -> str:
        bits = []
        for e in entries:
            iid = int(e["id"])
            it = by_id.get(iid) or e
            name = esc(it.get("name") or e.get("name") or f"#{iid}")
            price = e.get("price", it.get("price"))
            extra = ""
            if kind == "sale" and e.get("priceOld"):
                extra = f' <span class="pr sale">{esc(fmt_price(e.get("priceOld")))}</span>'
            if kind == "move" and e.get("t"):
                extra = f' <span class="meta">· {_fmt_day(e["t"])}</span>'
            bits.append(
                f'<li><a class="row" href="{SITE}/item/{iid}.html">'
                f'<span class="nm">{name}</span>'
                f'<span class="pr">{esc(fmt_price(price))}</span>{extra}'
                f"</a></li>"
            )
        return '<ul class="list">' + "\n".join(bits) + "</ul>" if bits else "<p class=\"meta\">Пока пусто.</p>"

    desc = (
        "Новинки и скидки магазина Пара па (Parapa): свежие предметы, "
        "акции и изменения цен в монетах. Обновляется мониторингом каталога."
    )
    body = f"""{nav('<a href="' + SITE + '/updates.html">Новинки</a>')}
    <h1>Новинки и скидки Пара па</h1>
    <p class="lead">{esc(desc)}</p>
    <p class="meta">Лента строится из каталога FUTURUM · неофициальный обзор магазина Пара па.</p>

    <h2 style="font-family:Orbitron,sans-serif;font-size:.95rem;letter-spacing:.08em;text-transform:uppercase;margin:1.4rem 0 .5rem">Скидки сейчас</h2>
    {rows_from(sales, kind="sale")}

    <h2 style="font-family:Orbitron,sans-serif;font-size:.95rem;letter-spacing:.08em;text-transform:uppercase;margin:1.4rem 0 .5rem">Недавние изменения цен</h2>
    {rows_from(moves, kind="move")}

    <h2 style="font-family:Orbitron,sans-serif;font-size:.95rem;letter-spacing:.08em;text-transform:uppercase;margin:1.4rem 0 .5rem">Новые / свежие id</h2>
    {rows_from(news, kind="news")}

    <p class="footer">См. также
      <a href="{SITE}/para-pa-skidki.html">скидки Пара па</a> ·
      <a href="{SITE}/para-pa-ceny.html">как читать цены</a> ·
      <a href="{SITE}/">поиск</a></p>"""
    return page_shell(
        title="Новинки и скидки Пара па (Parapa) — магазин | FUTURUM",
        description=desc,
        canonical=f"{SITE}/updates.html",
        body=body,
        json_ld={
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Новинки и скидки Пара па",
            "url": f"{SITE}/updates.html",
            "description": desc,
        },
    )


def build_landing_magazin() -> str:
    title = "Магазин Пара па (Parapa) — поиск предметов и каталог"
    desc = (
        "Что такое магазин Пара па и как быстро найти вещь по названию, id или ссылке. "
        "Неофициальный поиск FUTURUM по каталогу Parapa."
    )
    body = f"""{nav('<a href="' + SITE + '/para-pa-magazin.html">Магазин</a>')}
    <h1>Магазин Пара па — поиск и каталог</h1>
    <p class="lead">{esc(desc)}</p>
    <div class="card">
      <p><strong>Пара па</strong> (официально Parapa / «Пара Па: Город Танцев») — онлайн-игра.
        Внутри есть торговый центр: одежда, крылья, питомцы, транспорт и наборы.
        Официальная витрина:
        <a href="https://parapa.ru/mall/" rel="noopener noreferrer" target="_blank">parapa.ru/mall</a>.</p>
      <p>FUTURUM — <em>неофициальный</em> поиск по этому магазину: удобно смотреть
        <strong>цены в монетах</strong>, скидки и id, вставить ссылку
        <code>mall/goods/…</code> или просто название.</p>
      <p>Полезные страницы:</p>
      <ul class="list">
        <li><a class="row" href="{SITE}/"><span class="nm">Открыть поиск</span></a></li>
        <li><a class="row" href="{SITE}/catalog.html"><span class="nm">Полный каталог</span></a></li>
        <li><a class="row" href="{SITE}/para-pa-ceny.html"><span class="nm">Как читать цены</span></a></li>
        <li><a class="row" href="{SITE}/para-pa-skidki.html"><span class="nm">Скидки Пара па</span></a></li>
        <li><a class="row" href="{SITE}/updates.html"><span class="nm">Новинки и изменения</span></a></li>
      </ul>
    </div>
    <p class="footer">Не связан с администрацией Parapa · пишется также «парапа», «parapa»</p>"""
    return page_shell(
        title=f"{title} | FUTURUM",
        description=desc,
        canonical=f"{SITE}/para-pa-magazin.html",
        body=body,
        json_ld={
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "url": f"{SITE}/para-pa-magazin.html",
            "description": desc,
            "about": {
                "@type": "VideoGame",
                "name": "Пара Па: Город Танцев",
                "alternateName": ["Пара па", "Парапа", "Parapa"],
            },
        },
    )


def build_landing_ceny() -> str:
    title = "Цены магазина Пара па — монеты, скидки и id"
    desc = (
        "Как читать цены в магазине Пара па (Parapa): монеты, старая цена при скидке, "
        "id товара и ссылка mall/goods. Неофициальный гид FUTURUM."
    )
    body = f"""{nav('<a href="' + SITE + '/para-pa-ceny.html">Цены</a>')}
    <h1>Цены в магазине Пара па</h1>
    <p class="lead">{esc(desc)}</p>
    <div class="card">
      <p>В каталоге FUTURUM цены показаны <strong>в монетах</strong> магазина Пара па
        (как на витрине parapa.ru), а не в рублях сторонних магазинов.</p>
      <p>Если видите две цифры — сейчас скидка: новая цена и зачёркнутая старая.
        Список акций:
        <a href="{SITE}/para-pa-skidki.html">скидки Пара па</a>.</p>
      <p>У каждого предмета есть <strong>id</strong> (например 57) и страница
        <code>parapa.ru/mall/goods/ID/</code>. Можно вставить ссылку или id в
        <a href="{SITE}/">поиск</a> — откроется карточка и похожие варианты.</p>
      <p>Свежие смены цен смотрите в
        <a href="{SITE}/updates.html">ленте новинок</a>.</p>
    </div>
    <p class="footer"><a href="{SITE}/para-pa-magazin.html">← о магазине Пара па</a></p>"""
    return page_shell(
        title=f"{title} | FUTURUM",
        description=desc,
        canonical=f"{SITE}/para-pa-ceny.html",
        body=body,
        json_ld={
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "url": f"{SITE}/para-pa-ceny.html",
            "description": desc,
        },
    )


def build_landing_skidki(items: list[dict]) -> str:
    sales = [i for i in items if on_sale(i) and not i.get("unavailable")]
    sales.sort(key=lambda x: str(x.get("name") or "").lower())
    title = "Скидки Пара па (Parapa) — что по акции в магазине"
    desc = (
        "Актуальные скидки магазина Пара па: предметы со сниженной ценой в монетах. "
        "Неофициальный список FUTURUM."
    )
    body = f"""{nav('<a href="' + SITE + '/para-pa-skidki.html">Скидки</a>')}
    <h1>Скидки Пара па</h1>
    <p class="lead">{esc(desc)}</p>
    <p class="meta">Сейчас в каталоге со скидкой: <b>{len(sales)}</b>.
      Полный список также на
      <a href="{SITE}/sections/sale.html">странице скидок</a>.</p>
    {item_rows(sales)}
    <p class="footer">
      <a href="{SITE}/updates.html">новинки и изменения цен</a> ·
      <a href="{SITE}/para-pa-ceny.html">как читать цены</a> ·
      <a href="{SITE}/">поиск</a>
    </p>"""
    return page_shell(
        title=f"{title} | FUTURUM",
        description=desc,
        canonical=f"{SITE}/para-pa-skidki.html",
        body=body,
        json_ld={
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": title,
            "url": f"{SITE}/para-pa-skidki.html",
            "numberOfItems": len(sales),
        },
    )


def write_sitemap(entries: list[tuple[str, str | None]]) -> None:
    """entries: (url, lastmod YYYY-MM-DD | None). lastmod только если известен реально."""
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for u, lastmod in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{esc(u)}</loc>")
        if lastmod:
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append("  </url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    (ROOT / "sitemap.txt").write_text(
        "\n".join(u for u, _ in entries) + "\n", encoding="utf-8"
    )


def main() -> int:
    if not ITEMS_FILE.exists():
        print("нет data/items.json")
        return 1

    items = load_items()
    lastmods = _load_price_lastmod()
    SECTIONS_DIR.mkdir(parents=True, exist_ok=True)
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)

    # удалить устаревшие item/*.html которых больше нет
    live_ids = {int(i["id"]) for i in items}
    for old in ITEMS_DIR.glob("*.html"):
        try:
            oid = int(old.stem)
        except ValueError:
            continue
        if oid not in live_ids:
            old.unlink(missing_ok=True)

    catalog_last = max(lastmods.values()) if lastmods else None
    today = datetime.now(tz=timezone.utc).date().isoformat()
    entries: list[tuple[str, str | None]] = [
        (f"{SITE}/", catalog_last),
        (f"{SITE}/catalog.html", catalog_last),
    ]

    # посадочные «Пара па» + лента новинок/скидок
    updates = collect_updates(items)
    (ROOT / "updates.html").write_text(
        build_updates_page(items, updates), encoding="utf-8"
    )
    (ROOT / "para-pa-magazin.html").write_text(
        build_landing_magazin(), encoding="utf-8"
    )
    (ROOT / "para-pa-ceny.html").write_text(build_landing_ceny(), encoding="utf-8")
    (ROOT / "para-pa-skidki.html").write_text(
        build_landing_skidki(items), encoding="utf-8"
    )
    for path in (
        "updates.html",
        "para-pa-magazin.html",
        "para-pa-ceny.html",
        "para-pa-skidki.html",
    ):
        entries.append((f"{SITE}/{path}", today))

    # разделы
    sale_items = [i for i in items if on_sale(i) and not i.get("unavailable")]
    sale_last = None
    for it in sale_items:
        lm = lastmods.get(int(it["id"]))
        if lm and (sale_last is None or lm > sale_last):
            sale_last = lm
    (SECTIONS_DIR / "sale.html").write_text(build_sale_page(items), encoding="utf-8")
    entries.append((f"{SITE}/sections/sale.html", sale_last or catalog_last))

    for slug, title, desc in SECTIONS:
        subset = [i for i in items if item_in_category(i, slug)]
        (SECTIONS_DIR / f"{slug}.html").write_text(
            build_section_page(slug, title, desc, subset), encoding="utf-8"
        )
        sec_last = None
        for it in subset:
            lm = lastmods.get(int(it["id"]))
            if lm and (sec_last is None or lm > sec_last):
                sec_last = lm
        entries.append((f"{SITE}/sections/{slug}.html", sec_last or catalog_last))

    # товары
    for it in items:
        iid = int(it["id"])
        (ITEMS_DIR / f"{iid}.html").write_text(build_item_page(it), encoding="utf-8")
        entries.append((f"{SITE}/item/{iid}.html", lastmods.get(iid)))

    write_sitemap(entries)
    with_lm = sum(1 for _, lm in entries if lm)
    print(
        f"sections: {len(SECTIONS) + 1}, items: {len(items)}, "
        f"landings: 4, sitemap urls: {len(entries)} (lastmod: {with_lm})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""
Сбор титулов Пара па из вики → data/titles.json

Источник (основной): сохранённый дамп / live HTML страницы
  https://parapa.ru/wiki/index.php/Способы_получения_титулов

Запуск:
  py -3 scrape_titles.py
  py -3 scrape_titles.py --from-file path/to/dump.txt
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "data"
TITLES_FILE = OUT / "titles.json"
WIKI_URL = (
    "https://parapa.ru/wiki/index.php/"
    "%D0%A1%D0%BF%D0%BE%D1%81%D0%BE%D0%B1%D1%8B_%D0%BF%D0%BE%D0%BB%D1%83%D1%87%D0%B5%D0%BD%D0%B8%D1%8F_%D1%82%D0%B8%D1%82%D1%83%D0%BB%D0%BE%D0%B2"
)

# локальные дампы из Cursor WebFetch (если live недоступен)
DEFAULT_DUMPS = [
    Path(r"C:\Users\user\.cursor\projects\c-Users-user-Desktop-Poisk\agent-tools\ea7e1d9d-b9e1-4199-8e18-1efb5f02c87c.txt"),
    Path(r"C:\Users\user\.cursor\projects\c-Users-user-Desktop-Poisk\agent-tools\fa631356-4451-4826-a9db-b419e3e2b5d6.txt"),
]


def op_color(op: int) -> str:
    if op >= 8:
        return "red"
    if op >= 4:
        return "orange"
    if op >= 2:
        return "purple"
    if op >= 1:
        return "yellow"
    return "none"


def clean_cell(s: str) -> str:
    s = (s or "").strip()
    s = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", s)  # markdown links
    s = re.sub(r"<[^>]+>", "", s)
    s = s.replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    if s in {"—", "-", "–", "−", ""}:
        return ""
    return s


def parse_op(raw: str) -> int | None:
    raw = clean_cell(raw)
    if not raw:
        return None
    m = re.search(r"(\d+)", raw)
    if not m:
        return 0 if re.search(r"не\s*дают|нулев|0\s*оп", raw, re.I) else None
    return int(m.group(1))


def split_row(line: str) -> list[str]:
    # | a | b | c |
    parts = [p.strip() for p in line.strip().strip("|").split("|")]
    return parts


def parse_markdown_tables(text: str) -> list[dict]:
    lines = text.splitlines()
    section = "Прочее"
    items: list[dict] = []
    seen: set[str] = set()

    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("### "):
            section = line[4:].strip()
            i += 1
            continue
        if line.startswith("## ") and "Способы" not in line:
            # крупные разделы без ### — тоже категория
            maybe = line[3:].strip()
            if maybe and maybe not in {"Содержание", "См. также", "Примечания"}:
                section = maybe
            i += 1
            continue

        if not line.startswith("|"):
            i += 1
            continue

        cells = split_row(line)
        # header
        if cells and re.search(r"титул", cells[0], re.I):
            i += 1
            # skip separator
            if i < len(lines) and re.match(r"^\|\s*-+", lines[i]):
                i += 1
            while i < len(lines) and lines[i].startswith("|"):
                row = split_row(lines[i])
                i += 1
                if not row or re.search(r"титул", row[0], re.I):
                    continue
                if re.match(r"^-+$", row[0].replace(" ", "")):
                    continue
                # expect 5 cols: name, desc, source, note, op
                while len(row) < 5:
                    row.append("")
                name = clean_cell(row[0])
                if not name or len(name) < 2:
                    continue
                key = name.casefold()
                if key in seen:
                    # merge longer description if duplicate
                    continue
                seen.add(key)
                desc = clean_cell(row[1])
                source = clean_cell(row[2])
                note = clean_cell(row[3])
                op = parse_op(row[4])
                if op is None:
                    op = 0
                items.append(
                    {
                        "id": len(items) + 1,
                        "name": name,
                        "description": desc,
                        "source": source,
                        "note": note,
                        "op": op,
                        "color": op_color(op),
                    "category": section,
                    "image": None,
                }
            )
            continue
        i += 1

    return items


def try_fetch_html() -> str | None:
    """Попытка скачать live HTML с cookie прогревом магазина."""
    try:
        from scrape_by_id import COOKIE_FILE, UA, warmup
    except Exception:
        return None
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        warmup()
    except Exception:
        pass
    import subprocess

    out = OUT / "_titles_wiki.html"
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
        "90",
        "-o",
        str(out),
        WIKI_URL,
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0 or not out.exists() or out.stat().st_size < 5000:
        return None
    raw = out.read_bytes()
    for enc in ("utf-8", "windows-1251"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace")


def parse_html_tables(html: str) -> list[dict]:
    """Грубый разбор HTML-таблиц вики, если markdown дампа нет."""
    # упрощённо: вытащить текст и скормить markdown-парсеру не выйдет —
    # ищем <tr> с 5 <td>
    items: list[dict] = []
    seen: set[str] = set()
    section = "Прочее"
    for m in re.finditer(
        r"<h[23][^>]*>\s*(?:<span[^>]*>)?([^<]+)", html, re.I
    ):
        pass  # section updated in loop below

    # split by headings
    parts = re.split(r"(<h3[^>]*>.*?</h3>)", html, flags=re.I | re.S)
    current = "Прочее"
    chunks: list[tuple[str, str]] = []
    i = 0
    while i < len(parts):
        part = parts[i]
        hm = re.match(r"<h3[^>]*>\s*(?:<span[^>]*>)?([^<]+)", part, re.I)
        if hm:
            current = clean_cell(hm.group(1))
            i += 1
            if i < len(parts):
                chunks.append((current, parts[i]))
            i += 1
            continue
        if not chunks:
            chunks.append((current, part))
        i += 1

    from wiki_links import links_in_html, text_in_field

    field_of = {
        "descriptionLinks": "description",
        "sourceLinks": "source",
        "noteLinks": "note",
    }
    for section, chunk in chunks:
        for tr in re.finditer(r"<tr[^>]*>(.*?)</tr>", chunk, re.I | re.S):
            tds = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr.group(1), re.I | re.S)
            if len(tds) < 5:
                continue
            cells = [clean_cell(re.sub(r"<[^>]+>", " ", td)) for td in tds[:5]]
            if re.search(r"титул", cells[0], re.I):
                continue
            name = cells[0]
            if not name or len(name) < 2:
                continue
            key = name.casefold()
            if key in seen:
                continue
            seen.add(key)
            op = parse_op(cells[4]) or 0
            item = {
                "id": len(items) + 1,
                "name": name,
                "description": cells[1],
                "source": cells[2],
                "note": cells[3],
                "op": op,
                "color": op_color(op),
                "category": section,
                "image": None,
            }
            for field, cell in (
                ("descriptionLinks", tds[1]),
                ("sourceLinks", tds[2]),
                ("noteLinks", tds[3]),
            ):
                links = [
                    lk
                    for lk in links_in_html(cell)
                    if text_in_field(lk.get("text") or "", item.get(field_of[field]) or "")
                ]
                if links:
                    item[field] = links
            items.append(item)
    return items


def save_titles(items: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    by_cat: dict[str, int] = {}
    by_op: dict[str, int] = {}
    for it in items:
        by_cat[it["category"]] = by_cat.get(it["category"], 0) + 1
        by_op[str(it["op"])] = by_op.get(str(it["op"]), 0) + 1
    payload = {
        "source": WIKI_URL,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "count": len(items),
        "byCategory": by_cat,
        "byOp": by_op,
        "items": items,
    }
    TITLES_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"saved {len(items)} titles → {TITLES_FILE}")
    print("by OP:", dict(sorted(by_op.items(), key=lambda x: -int(x[0]))))
    print("categories:", len(by_cat))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-file", type=Path, default=None)
    args = ap.parse_args()

    text = None
    if args.from_file and args.from_file.exists():
        text = args.from_file.read_text(encoding="utf-8", errors="replace")
        print("from file", args.from_file)
    else:
        for dump in DEFAULT_DUMPS:
            if dump.exists():
                text = dump.read_text(encoding="utf-8", errors="replace")
                print("from dump", dump.name)
                break

    items: list[dict] = []
    if text:
        items = parse_markdown_tables(text)

    if len(items) < 50:
        print("мало из markdown, пробую live HTML…")
        html = try_fetch_html()
        if html:
            items = parse_html_tables(html)
            print("from html", len(items))

    if not items:
        print("не удалось собрать титулы")
        return 1

    # стабильные id по алфавиту внутри категории? лучше сохранить порядок вики
    for i, it in enumerate(items, start=1):
        it["id"] = i

    from wiki_links import classify_items, read_items

    classify_items(items, also_index=read_items(OUT / "wiki_items.json"))

    save_titles(items)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

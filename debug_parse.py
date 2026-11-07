from scrape_mall import fetch, extract_category_store, parse_items, last_page
import re
from pathlib import Path

html = fetch("https://parapa.ru/mall/clothes/")
Path("data/debug_clothes.html").write_text(html, encoding="utf-8")
print("len", len(html))
print("pages", last_page(html))

# exact store openings
for m in re.finditer(r"<div[^>]*id=\"store\"[^>]*>", html):
    print("OPEN", m.group(0), "at", m.start())

block = extract_category_store(html)
Path("data/debug_store_block.html").write_text(block, encoding="utf-8")
print("block len", len(block))
print("li count", len(re.findall(r"<li\b", block, flags=re.I)))
print("name=id count", block.count('name="id"'))

# More robust: find all product forms anywhere after last #store open for category
idx = html.rfind('<div id="store" class="store">')
if idx < 0:
    idx = html.rfind('id="store"')
chunk = html[idx:]
print("chunk from last store", len(chunk))
print("forms", len(re.findall(r"<form\b", chunk, flags=re.I)))
print("ids", re.findall(r'name="id"\s+value="(\d+)"', chunk)[:20])

items = parse_items(chunk, "clothes", "Внешность")
print("parsed from chunk", len(items))
if items:
    Path("data/debug_items.json").write_text(
        __import__("json").dumps(items, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("first", items[0]["name"], items[0]["price"])

# -*- coding: utf-8 -*-
import json
import re
from pathlib import Path

html = Path("data/_wiki_page_Прически.html").read_text(encoding="utf-8", errors="replace")
rows = re.findall(r"<tr>[\s\S]*?</tr>", html)
samples = []
for row in rows:
    links = re.findall(
        r'<a[^>]+href="(https?://parapa\.ru/wiki/images/[^"]+)"[^>]*>([^<]+)</a>',
        row,
    )
    colors = []
    for url, label in links:
        label = label.strip().lower()
        if label in {"тц", "валюта"}:
            continue
        if not re.search(r"wiki/images/", url):
            continue
        # skip mall currency etc - color labels are short russian words
        if len(label) > 24:
            continue
        colors.append({"label": label, "url": url})
    # keep only rows that look like color variants
    colorish = [c for c in colors if c["label"] not in {"тц"}]
    if len(colorish) < 4:
        continue
    name_m = re.search(r"<td[^>]*>\s*([^<]+?)\s*<br", row)
    name = name_m.group(1).strip() if name_m else "?"
    icon = re.search(r'src="(/wiki/images/[^"]+)"', row)
    desc_m = re.findall(r"<td>([\s\S]*?)</td>", row)
    desc = ""
    if len(desc_m) >= 3:
        desc = re.sub(r"<[^>]+>", " ", desc_m[2]).strip()
    samples.append(
        {
            "name": name,
            "icon": ("https://parapa.ru" + icon.group(1)) if icon else None,
            "desc": desc[:120],
            "colors": colorish[:12],
        }
    )
    if len(samples) >= 8:
        break

Path("data/_hair_color_samples.json").write_text(
    json.dumps(samples, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"wrote {len(samples)} samples")
for s in samples:
    print(s["name"], len(s["colors"]))

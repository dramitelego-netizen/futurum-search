# -*- coding: utf-8 -*-
"""Pack missing guide_img/look_img webp from local wiki_img sources.

Covers primary image, lookImage, and lookVariants — list badges use guide,
cards/carousel use look.
"""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
WIKI = ROOT / "data" / "wiki_img"
GUIDE = ROOT / "data" / "guide_img"
LOOK = ROOT / "data" / "look_img"
GUIDE.mkdir(parents=True, exist_ok=True)
LOOK.mkdir(parents=True, exist_ok=True)


def find_src(stem: str, image_field: str = "") -> Path | None:
    rel = (image_field or "").replace("\\", "/").lstrip("./")
    if rel:
        p = ROOT / rel
        if p.is_file():
            return p
    for folder in (WIKI, ROOT / "data" / "img"):
        for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            p = folder / f"{stem}{ext}"
            if p.is_file():
                return p
    return None


def pack(src: Path, stem: str) -> bool:
    wrote = False
    im = Image.open(src)
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGBA")
    for folder, side, q in ((GUIDE, 256, 72), (LOOK, 720, 82)):
        dest = folder / f"{stem}.webp"
        if dest.exists() and dest.stat().st_size > 500:
            continue
        out = im.copy()
        out.thumbnail((side, side), Image.Resampling.LANCZOS)
        if out.getextrema()[3][0] >= 250:
            out = out.convert("RGB")
        out.save(dest, "WEBP", quality=q, method=4)
        print("wrote", dest.relative_to(ROOT), dest.stat().st_size)
        wrote = True
    return wrote


def collect_refs(it: dict) -> list[tuple[str, str]]:
    """Return (stem, source_path_hint) pairs for all local image refs."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(path: str) -> None:
        rel = str(path or "").replace("\\", "/").lstrip("./")
        if not rel or not rel.startswith("data/"):
            return
        s = Path(rel).stem
        key = s.lower()
        if not s or key in seen:
            return
        seen.add(key)
        out.append((s, rel))

    add(it.get("image") or "")
    add(it.get("lookImage") or "")
    for v in it.get("lookVariants") or []:
        if isinstance(v, dict):
            add(v.get("image") or "")
            add(v.get("lookLocal") or "")
            add(v.get("imageLocal") or "")
        else:
            add(str(v))
    return out


def main() -> int:
    data = json.loads((ROOT / "data" / "wiki_items.json").read_text(encoding="utf-8"))
    packed = 0
    skipped = 0
    no_src: list[str] = []
    for it in data["items"]:
        for stem, hint in collect_refs(it):
            guide = GUIDE / f"{stem}.webp"
            look = LOOK / f"{stem}.webp"
            look_gif = LOOK / f"{stem}.gif"
            if (
                guide.is_file()
                and guide.stat().st_size > 500
                and (
                    (look.is_file() and look.stat().st_size > 500)
                    or (look_gif.is_file() and look_gif.stat().st_size > 500)
                )
            ):
                skipped += 1
                continue
            src = find_src(stem, hint)
            if not src:
                no_src.append(f"{it.get('kind')}:{it.get('name')}:{stem}")
                continue
            if pack(src, stem):
                packed += 1
    print("packed", packed, "already", skipped, "no_src", len(no_src))
    for n in no_src[:30]:
        print(" no_src", n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

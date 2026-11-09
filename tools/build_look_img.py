#!/usr/bin/env python3
"""Build data/look_img — HQ (max 800px) WebP for card+zoom on Pages.

Full data/wiki_img (~6GB) stays local-only / not deleted from disk.
look_img is the deployable pack. Also fills missing data/guide_img thumbs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "data" / "wiki_img"
GUIDE = ROOT / "data" / "guide_img"
LOOK = ROOT / "data" / "look_img"
WIKI_JSON = ROOT / "data" / "wiki_items.json"
MAX_SIDE = 800
WEBP_QUALITY = 80
GIF_KEEP_MAX = 900_000


def collect_names() -> set[str]:
    names: set[str] = set()
    if WIKI.is_dir():
        for p in WIKI.iterdir():
            if p.is_file():
                names.add(p.name)
    if WIKI_JSON.is_file():
        data = json.loads(WIKI_JSON.read_text(encoding="utf-8"))
        for it in data.get("items") or []:
            for k in ("image", "look", "lookLocal", "lookUrl", "imageUrl"):
                v = str(it.get(k) or "").replace("\\", "/")
                if v:
                    names.add(Path(v.split("?")[0]).name)
            for v in it.get("lookVariants") or []:
                if isinstance(v, dict):
                    for k in ("image", "local", "look", "src", "lookLocal", "imageLocal"):
                        s = str(v.get(k) or "").replace("\\", "/")
                        if s:
                            names.add(Path(s.split("?")[0]).name)
                elif isinstance(v, str) and v:
                    names.add(Path(v).name)
    return names


def look_dest_for(src: Path) -> Path:
    stem = src.stem
    if src.suffix.lower() == ".gif" and src.stat().st_size <= GIF_KEEP_MAX:
        return LOOK / f"{stem}.gif"
    return LOOK / f"{stem}.webp"


def save_look(src: Path, dest: Path) -> int:
    LOOK.mkdir(parents=True, exist_ok=True)
    if dest.suffix.lower() == ".gif":
        dest.write_bytes(src.read_bytes())
        return dest.stat().st_size

    im = Image.open(src)
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGBA")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    if im.getextrema()[3][0] >= 250:
        im = im.convert("RGB")
    im.save(dest, "WEBP", quality=WEBP_QUALITY, method=4)
    return dest.stat().st_size


def save_guide_thumb(src: Path, dest: Path) -> None:
    if dest.is_file():
        return
    GUIDE.mkdir(parents=True, exist_ok=True)
    ext = src.suffix.lower()
    if ext == ".gif" and src.stat().st_size <= 400_000:
        dest.write_bytes(src.read_bytes())
        return
    im = Image.open(src)
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGBA")
    im.thumbnail((256, 256), Image.Resampling.LANCZOS)
    if ext == ".gif":
        im.convert("P", palette=Image.ADAPTIVE).save(dest, "GIF", optimize=True)
    else:
        im.save(dest, "PNG", optimize=True)


def main() -> int:
    if not WIKI.is_dir():
        print("MISSING", WIKI, file=sys.stderr)
        return 1
    LOOK.mkdir(parents=True, exist_ok=True)
    names = sorted(n for n in collect_names() if (WIKI / n).is_file())
    print(f"building look_img for {len(names)} files…")
    wrote = skipped = guide_added = 0
    bytes_out = 0
    for i, name in enumerate(names, 1):
        src = WIKI / name
        dest = look_dest_for(src)
        try:
            if dest.is_file() and dest.stat().st_mtime >= src.stat().st_mtime and dest.stat().st_size > 0:
                skipped += 1
                bytes_out += dest.stat().st_size
            else:
                bytes_out += save_look(src, dest)
                wrote += 1
            guide = GUIDE / name
            if not guide.is_file():
                save_guide_thumb(src, guide)
                guide_added += 1
        except Exception as e:
            print(f"FAIL {name}: {e}", file=sys.stderr)
        if i % 500 == 0:
            print(f"… {i}/{len(names)} wrote={wrote} skip={skipped} MB={bytes_out / 1e6:.1f}")
    print(
        f"done wrote={wrote} skipped={skipped} guide_added={guide_added} "
        f"look_files={sum(1 for p in LOOK.iterdir() if p.is_file())} look_MB={bytes_out / 1e6:.1f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Build data/title_thumb — лёгкие WebP для списка титулов.

Список → title_thumb (маленькие).
Карточка/инфоблок → data/title_img (полное качество).
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "title_img"
DEST = ROOT / "data" / "title_thumb"
MAX_SIDE = 320
WEBP_QUALITY = 72


def main() -> int:
    if not SRC.is_dir():
        print("MISSING", SRC, file=sys.stderr)
        return 1
    DEST.mkdir(parents=True, exist_ok=True)
    files = sorted(
        p for p in SRC.iterdir() if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
    )
    print(f"building title_thumb for {len(files)} files…")
    wrote = skipped = 0
    bytes_out = 0
    for i, src in enumerate(files, 1):
        dest = DEST / f"{src.stem}.webp"
        try:
            if (
                dest.is_file()
                and dest.stat().st_mtime >= src.stat().st_mtime
                and dest.stat().st_size > 0
            ):
                skipped += 1
                bytes_out += dest.stat().st_size
            else:
                im = Image.open(src)
                if getattr(im, "n_frames", 1) > 1:
                    im.seek(0)
                im = im.convert("RGBA")
                im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
                if im.getextrema()[3][0] >= 250:
                    im = im.convert("RGB")
                im.save(dest, "WEBP", quality=WEBP_QUALITY, method=4)
                bytes_out += dest.stat().st_size
                wrote += 1
        except Exception as e:
            print(f"FAIL {src.name}: {e}", file=sys.stderr)
        if i % 200 == 0:
            print(f"… {i}/{len(files)} wrote={wrote} skip={skipped} MB={bytes_out / 1e6:.1f}")
    print(
        f"done wrote={wrote} skipped={skipped} "
        f"files={sum(1 for _ in DEST.iterdir())} MB={bytes_out / 1e6:.1f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

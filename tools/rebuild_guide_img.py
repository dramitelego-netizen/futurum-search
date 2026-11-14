#!/usr/bin/env python3
"""Rebuild data/guide_img as light WebP thumbs for list previews.

Список → guide_img/{stem}.webp (max 256, q72).
Карточка/инфоблок → look_img / wiki_img (HQ), без изменений здесь.

Удаляет старые .png/.gif/.jpg в guide_img после успешной записи webp.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / "data" / "wiki_img"
GUIDE = ROOT / "data" / "guide_img"
MAX_SIDE = 256
WEBP_QUALITY = 72
SRC_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def source_for(stem: str, existing: Path | None) -> Path | None:
    if WIKI.is_dir():
        for ext in (".png", ".gif", ".webp", ".jpg", ".jpeg"):
            p = WIKI / f"{stem}{ext}"
            if p.is_file():
                return p
    return existing if existing and existing.is_file() else None


def save_webp(src: Path, dest: Path) -> int:
    im = Image.open(src)
    if getattr(im, "n_frames", 1) > 1:
        im.seek(0)
    im = im.convert("RGBA")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    if im.getextrema()[3][0] >= 250:
        im = im.convert("RGB")
    GUIDE.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=WEBP_QUALITY, method=4)
    return dest.stat().st_size


def main() -> int:
    if not GUIDE.is_dir() and not WIKI.is_dir():
        print("MISSING guide_img and wiki_img", file=sys.stderr)
        return 1

    stems: dict[str, Path | None] = {}
    if GUIDE.is_dir():
        for p in GUIDE.iterdir():
            if p.is_file() and p.suffix.lower() in SRC_EXT:
                stems.setdefault(p.stem, p)
    if WIKI.is_dir():
        for p in WIKI.iterdir():
            if p.is_file() and p.suffix.lower() in SRC_EXT:
                stems.setdefault(p.stem, None)

    names = sorted(stems)
    print(f"rebuilding guide_img webp for {len(names)} stems…")
    wrote = skipped = failed = 0
    bytes_out = 0
    removed = 0

    for i, stem in enumerate(names, 1):
        dest = GUIDE / f"{stem}.webp"
        src = source_for(stem, stems.get(stem))
        try:
            if not src:
                failed += 1
                continue
            if (
                dest.is_file()
                and dest.stat().st_mtime >= src.stat().st_mtime
                and dest.stat().st_size > 0
                and dest.resolve() != src.resolve()
            ):
                skipped += 1
                bytes_out += dest.stat().st_size
            else:
                bytes_out += save_webp(src, dest)
                wrote += 1
            # drop heavy legacy formats for this stem
            for ext in (".png", ".gif", ".jpg", ".jpeg"):
                old = GUIDE / f"{stem}{ext}"
                if old.is_file() and old.resolve() != dest.resolve():
                    old.unlink()
                    removed += 1
        except Exception as e:
            failed += 1
            print(f"FAIL {stem}: {e}", file=sys.stderr)
        if i % 500 == 0:
            print(
                f"… {i}/{len(names)} wrote={wrote} skip={skipped} "
                f"rm={removed} MB={bytes_out / 1e6:.1f}"
            )

    left = sum(1 for _ in GUIDE.iterdir()) if GUIDE.is_dir() else 0
    print(
        f"done wrote={wrote} skipped={skipped} failed={failed} "
        f"removed={removed} files={left} MB={bytes_out / 1e6:.1f}"
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

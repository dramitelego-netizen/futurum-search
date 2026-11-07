#!/usr/bin/env python3
"""Крутит download_title_shots, пока не останется 0 need или сеть так и не оживёт."""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def remaining() -> int:
    import json
    from urllib.parse import unquote
    from pathlib import PurePosixPath

    sys.path.insert(0, str(ROOT))
    from download_title_shots import ok_png

    data = json.loads((ROOT / "data" / "titles.json").read_text(encoding="utf-8"))
    n = 0
    for it in data["items"]:
        url = it.get("imageUrl") or ""
        if not url:
            continue
        fname = PurePosixPath(unquote(url)).name.split("?")[0]
        path = ROOT / "data" / "title_img" / fname
        if not (path.exists() and ok_png(path.read_bytes())):
            n += 1
    return n


def wiki_up() -> bool:
    import socket

    try:
        with socket.create_connection(("95.181.177.87", 443), timeout=5):
            return True
    except OSError:
        return False


def main() -> int:
    rounds = 0
    while True:
        rounds += 1
        left = remaining()
        print(f"[round {rounds}] remaining={left} wiki_up={wiki_up()}", flush=True)
        if left == 0:
            print("all done", flush=True)
            return 0
        if not wiki_up():
            print("wiki unreachable, sleep 60s…", flush=True)
            time.sleep(60)
            continue
        r = subprocess.run([sys.executable, str(ROOT / "download_title_shots.py")], cwd=str(ROOT))
        print(f"download exit={r.returncode}", flush=True)
        time.sleep(5)
        if rounds >= 40:
            print("stop after 40 rounds, remaining=", remaining(), flush=True)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())

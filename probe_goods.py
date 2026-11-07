#!/usr/bin/env python3
import re
import subprocess
from pathlib import Path

COOKIE = Path("data/cookies.txt")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
OUT = Path("data/probe")
OUT.mkdir(parents=True, exist_ok=True)


def fetch(gid: int) -> tuple[int, bytes, float]:
    url = f"https://parapa.ru/mall/goods/{gid}/"
    import time

    t0 = time.perf_counter()
    proc = subprocess.run(
        [
            "curl.exe",
            "-sL",
            "-c",
            str(COOKIE),
            "-b",
            str(COOKIE),
            "-A",
            UA,
            "-w",
            "%{http_code}",
            "--max-time",
            "60",
            "-o",
            str(OUT / f"{gid}.html"),
            url,
        ],
        capture_output=True,
        check=False,
    )
    elapsed = time.perf_counter() - t0
    code = int(proc.stdout.decode().strip() or "0")
    raw = (OUT / f"{gid}.html").read_bytes() if (OUT / f"{gid}.html").exists() else b""
    return code, raw, elapsed


def analyze(gid: int, code: int, raw: bytes, elapsed: float) -> None:
    html = raw.decode("windows-1251", errors="replace")
    title_m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
    title = re.sub(r"\s+", " ", title_m.group(1)).strip() if title_m else ""
    has_id = bool(re.search(r"name=['\"]id['\"]\s+value=['\"](\d+)['\"]", html, re.I))
    price_m = re.search(r"name=['\"]price\d+['\"]\s+value=['\"](\d+)['\"]", html, re.I)
    # product image often in center content
    img_m = re.search(
        r'<a[^>]+class=["\']img_block["\'][^>]*>\s*<img[^>]+src=["\']([^"\']+)["\']',
        html,
        re.I | re.S,
    )
    print(f"id={gid} http={code} size={len(raw)} time={elapsed:.1f}s has_form={has_id} price={price_m.group(1) if price_m else None}")
    print(f"  title: {title[:120]}")
    print(f"  img: {img_m.group(1) if img_m else None}")
    low = html.lower()
    for marker in ["не найден", "товар не", "ошибка", "404", "удален"]:
        if marker in low:
            print(f"  marker: {marker}")


def main() -> None:
    for gid in (1, 62, 82, 773, 926, 99999):
        code, raw, elapsed = fetch(gid)
        analyze(gid, code, raw, elapsed)
        print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Сравнение скорости: curl vs urllib Session keep-alive."""
import http.cookiejar
import ssl
import subprocess
import time
import urllib.error
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
COOKIE = "data/cookies.txt"
URLS = [
    "https://parapa.ru/mall/goods/82/",
    "https://parapa.ru/mall/goods/100/",
    "https://parapa.ru/mall/goods/200/",
]


def curl_one(url: str) -> float:
    t0 = time.perf_counter()
    subprocess.run(
        [
            "curl.exe",
            "-sL",
            "--compressed",
            "-c",
            COOKIE,
            "-b",
            COOKIE,
            "-A",
            UA,
            "--max-time",
            "60",
            "-o",
            "NUL",
            url,
        ],
        check=False,
    )
    return time.perf_counter() - t0


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def make_opener():
    jar = http.cookiejar.MozillaCookieJar()
    try:
        jar.load(COOKIE, ignore_discard=True, ignore_expires=True)
    except Exception:
        pass
    ctx = ssl.create_default_context()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ctx),
    ), jar


def session_warmup(opener):
    # handle bp_chl
    no_redir = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(make_opener()[1] if False else http.cookiejar.CookieJar()),
        NoRedirect,
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    jar = http.cookiejar.CookieJar()
    opener_nr = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        NoRedirect,
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    opener_ok = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    req = urllib.request.Request(URLS[0], headers={"User-Agent": UA})
    try:
        opener_nr.open(req, timeout=60)
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 307, 308):
            e.read()
            opener_ok.open(urllib.request.Request(URLS[0], headers={"User-Agent": UA}), timeout=60)
    return opener_ok


def session_one(opener, url: str) -> float:
    t0 = time.perf_counter()
    req = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Connection": "keep-alive", "Accept-Encoding": "gzip"},
    )
    with opener.open(req, timeout=60) as resp:
        data = resp.read()
        # gzip?
        if resp.headers.get("Content-Encoding") == "gzip":
            import gzip

            data = gzip.decompress(data)
    return time.perf_counter() - t0, len(data)


def main():
    print("=== curl (новый процесс каждый раз) ===")
    for u in URLS:
        sec = curl_one(u)
        print(f"{sec:.1f}s  {u}")

    print("\n=== urllib Session keep-alive ===")
    jar = http.cookiejar.CookieJar()
    opener_nr = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        NoRedirect,
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    # warmup cookie
    req = urllib.request.Request(URLS[0], headers={"User-Agent": UA})
    try:
        with opener_nr.open(req, timeout=60) as r:
            r.read()
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 307, 308):
            e.read()
            with opener.open(urllib.request.Request(URLS[0], headers={"User-Agent": UA}), timeout=60) as r:
                print("warmup", len(r.read()), "bytes")

    for u in URLS:
        sec, n = session_one(opener, u)
        print(f"{sec:.1f}s  {n} bytes  {u}")

    print("\n=== HEAD via curl ===")
    for u in URLS[:1]:
        t0 = time.perf_counter()
        subprocess.run(
            ["curl.exe", "-sI", "-c", COOKIE, "-b", COOKIE, "-A", UA, "--max-time", "30", u],
            check=False,
        )
        print(f"{time.perf_counter()-t0:.1f}s HEAD {u}")


if __name__ == "__main__":
    main()

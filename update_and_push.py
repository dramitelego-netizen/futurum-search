#!/usr/bin/env python3
"""
Пайплайн FUTURUM: собрать/дополнить данные локально и залить на GitHub.

Показывает подробно:
  • что делает каждый шаг
  • что собрал / изменил
  • какие файлы уйдут в репозиторий

Примеры:
  py -3 update_and_push.py              # картинки + история цен + push
  py -3 update_and_push.py --enrich     # ещё дозаполнить описания
  py -3 update_and_push.py --scrape     # полный обход id (долго)
  py -3 update_and_push.py --dry-run    # только отчёт, без commit/push
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ITEMS = DATA / "items.json"
HISTORY = DATA / "price_history.json"
IMG = DATA / "img"
LOG = DATA / "update_and_push.log"

# Что можно заливать на GitHub (остальное — локальное/секретное)
PUSH_PATHS = [
    "data/items.json",
    "data/price_history.json",
    "data/id_state.json",
    "data/img",
    "index.html",
    "catalog.html",
    "styles.css",
    "catalog.css",
    "app.js",
    "catalog.js",
    "fav-store.js",
    "particles.js",
    "serve.py",
    "README.md",
    ".gitignore",
]


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def say(msg: str = "", *, box: bool = False) -> None:
    line = f"[{ts()}] {msg}" if msg else ""
    if box:
        bar = "═" * 64
        print(f"\n{bar}\n{msg}\n{bar}", flush=True)
        try:
            LOG.parent.mkdir(parents=True, exist_ok=True)
            with LOG.open("a", encoding="utf-8") as f:
                f.write(f"\n{bar}\n{msg}\n{bar}\n")
        except Exception:
            pass
        return
    print(line, flush=True)
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_items() -> list[dict]:
    if not ITEMS.exists():
        return []
    try:
        data = json.loads(ITEMS.read_text(encoding="utf-8"))
        return list(data.get("items") or [])
    except Exception as e:
        say(f"⚠ не удалось прочитать items.json: {e}")
        return []


def load_history() -> dict:
    if not HISTORY.exists():
        return {}
    try:
        data = json.loads(HISTORY.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def count_images() -> tuple[int, int, int]:
    """Возвращает (папок предметов, icon, look)."""
    if not IMG.exists():
        return 0, 0, 0
    folders = 0
    icons = 0
    looks = 0
    for d in IMG.iterdir():
        if not d.is_dir():
            continue
        folders += 1
        if any(d.glob("icon.*")):
            icons += 1
        if any(d.glob("look.*")):
            looks += 1
    return folders, icons, looks


def snapshot() -> dict:
    items = load_items()
    hist = load_history()
    folders, icons, looks = count_images()
    empty_desc = sum(1 for i in items if not (i.get("description") or "").strip())
    on_sale = sum(
        1
        for i in items
        if i.get("onSale")
        or (
            i.get("priceOld") is not None
            and i.get("price") is not None
            and i["priceOld"] > i["price"]
        )
    )
    no_local_icon = sum(1 for i in items if not i.get("imageLocal"))
    no_local_look = sum(1 for i in items if i.get("lookImage") and not i.get("lookLocal"))
    hist_points = sum(len(v) for v in hist.values() if isinstance(v, list))
    return {
        "items": len(items),
        "empty_desc": empty_desc,
        "on_sale": on_sale,
        "img_folders": folders,
        "icons": icons,
        "looks": looks,
        "no_local_icon": no_local_icon,
        "no_local_look": no_local_look,
        "hist_items": len(hist),
        "hist_points": hist_points,
        "items_mtime": ITEMS.stat().st_mtime if ITEMS.exists() else 0,
        "hist_mtime": HISTORY.stat().st_mtime if HISTORY.exists() else 0,
    }


def print_snapshot(title: str, s: dict) -> None:
    say(f"── {title} ──")
    say(f"  Предметов в каталоге:     {s['items']}")
    say(f"  Без описания:             {s['empty_desc']}")
    say(f"  Со скидкой:               {s['on_sale']}")
    say(f"  Папок картинок:           {s['img_folders']}")
    say(f"  Иконок локально:          {s['icons']}")
    say(f"  Look локально:            {s['looks']}")
    say(f"  Без локальной иконки:     {s['no_local_icon']}")
    say(f"  Look есть, файла нет:     {s['no_local_look']}")
    say(f"  История цен (предметов):  {s['hist_items']}")
    say(f"  История цен (точек):      {s['hist_points']}")


def diff_snapshots(before: dict, after: dict) -> None:
    say("── Что изменилось ──")
    keys = [
        ("items", "предметов"),
        ("empty_desc", "пустых описаний"),
        ("on_sale", "скидок"),
        ("icons", "иконок"),
        ("looks", "look-картинок"),
        ("hist_items", "историй цен"),
        ("hist_points", "точек истории"),
    ]
    any_change = False
    for key, label in keys:
        a, b = before[key], after[key]
        if a != b:
            sign = "+" if b > a else ""
            say(f"  {label}: {a} → {b}  ({sign}{b - a})")
            any_change = True
    if not any_change:
        say("  Существенных изменений в цифрах нет (файлы могли обновиться по содержимому).")


def run_step(title: str, detail: str, argv: list[str]) -> int:
    say(box=True, msg=f"ШАГ: {title}\n{detail}")
    say(f"Команда: {' '.join(argv)}")
    t0 = time.perf_counter()
    proc = subprocess.run(argv, cwd=str(ROOT))
    elapsed = time.perf_counter() - t0
    if proc.returncode == 0:
        say(f"✓ шаг «{title}» готов за {elapsed:.1f}с")
    else:
        say(f"✗ шаг «{title}» завершился с кодом {proc.returncode} ({elapsed:.1f}с)")
    return proc.returncode


def py_cmd(*script_args: str) -> list[str]:
    return [sys.executable, "-u", *script_args]


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def human_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"


def list_push_candidates() -> list[tuple[str, str, str]]:
    """path, status, size — что изменилось среди разрешённых путей."""
    st = git("status", "--porcelain", "--", *PUSH_PATHS)
    rows: list[tuple[str, str, str]] = []
    for line in (st.stdout or "").splitlines():
        if len(line) < 4:
            continue
        status = line[:2].strip() or "??"
        path = line[3:].strip().strip('"')
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        full = ROOT / path
        size = human_size(full.stat().st_size) if full.is_file() else ("dir" if full.is_dir() else "?")
        rows.append((path, status, size))
    return rows


def ensure_git_identity() -> None:
    name = git("config", "user.name")
    email = git("config", "user.email")
    if (name.stdout or "").strip() and (email.stdout or "").strip():
        return
    # не трогаем git config — только env на время процесса
    import os

    os.environ.setdefault("GIT_AUTHOR_NAME", "dramitelego-netizen")
    os.environ.setdefault(
        "GIT_AUTHOR_EMAIL", "253105569+dramitelego-netizen@users.noreply.github.com"
    )
    os.environ.setdefault("GIT_COMMITTER_NAME", os.environ["GIT_AUTHOR_NAME"])
    os.environ.setdefault("GIT_COMMITTER_EMAIL", os.environ["GIT_AUTHOR_EMAIL"])
    say("  git user не задан в config — использую временный identity для commit")


def push_to_github(dry_run: bool) -> int:
    say(box=True, msg="ШАГ: Заливка на GitHub\nПоказывает файлы и отправляет commit + push")

    remote = git("remote", "get-url", "origin")
    if remote.returncode != 0:
        say("✗ нет remote origin — сначала привяжи репозиторий")
        return 1
    say(f"  Remote: {(remote.stdout or '').strip()}")

    branch = git("rev-parse", "--abbrev-ref", "HEAD")
    br = (branch.stdout or "main").strip()
    say(f"  Ветка:  {br}")

    rows = list_push_candidates()
    if not rows:
        say("  Нечего заливать: среди данных/кода сайта нет изменений.")
        return 0

    say("── Файлы, которые уйдут на GitHub ──")
    total_files = 0
    for path, status, size in rows:
        mark = {
            "M": "изменён",
            "A": "новый",
            "D": "удалён",
            "??": "новый",
            "AM": "новый",
            "MM": "изменён",
        }.get(status, status)
        say(f"  [{mark:8}] {path}  ({size})")
        total_files += 1
    say(f"  Всего позиций: {total_files}")

    if dry_run:
        say("  --dry-run: commit/push пропущены")
        return 0

    ensure_git_identity()
    add = git("add", "--", *PUSH_PATHS)
    if add.returncode != 0:
        say(f"✗ git add: {add.stderr}")
        return 1

    before = snapshot()
    msg = (
        f"Update catalog: {before['items']} items, "
        f"{before['icons']} icons, {before['hist_points']} price points"
    )
    say(f"  Commit: {msg}")
    commit = git("commit", "-m", msg)
    out = (commit.stdout or "") + (commit.stderr or "")
    if commit.returncode != 0:
        if "nothing to commit" in out.lower():
            say("  Нечего коммитить (уже актуально).")
            return 0
        say(f"✗ git commit:\n{out}")
        return 1
    for line in out.splitlines():
        if line.strip():
            say(f"  {line}")

    say("  Push → origin …")
    push = git("push", "origin", br)
    pout = (push.stdout or "") + (push.stderr or "")
    for line in pout.splitlines():
        if line.strip():
            say(f"  {line}")
    if push.returncode != 0:
        say("✗ push не удался")
        return 1

    say("✓ залито на GitHub")
    say("  Репозиторий: https://github.com/dramitelego-netizen/futurum-search")
    say("  Сайт (через 1–2 мин): https://dramitelego-netizen.github.io/futurum-search/")
    return 0


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="Сбор данных FUTURUM + подробная заливка на GitHub"
    )
    ap.add_argument(
        "--scrape",
        action="store_true",
        help="полный обход товаров по id (долго, может занять часы)",
    )
    ap.add_argument(
        "--enrich",
        action="store_true",
        help="дозаполнить пустые описания",
    )
    ap.add_argument(
        "--skip-images",
        action="store_true",
        help="не скачивать картинки",
    )
    ap.add_argument(
        "--skip-history",
        action="store_true",
        help="не обновлять историю цен",
    )
    ap.add_argument(
        "--no-push",
        action="store_true",
        help="только собрать данные, не заливать на GitHub",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="показать что изменилось и что ушло бы на GitHub, без commit/push",
    )
    args = ap.parse_args()

    say(
        box=True,
        msg=(
            "FUTURUM · update_and_push\n"
            "Собирает/дополняет каталог у тебя на ПК и может залить на GitHub Pages"
        ),
    )
    say("План работы:")
    say(f"  1) Скрап по id .............. {'ДА (--scrape)' if args.scrape else 'нет (пропуск)'}")
    say(f"  2) Описания .................. {'ДА (--enrich)' if args.enrich else 'нет (пропуск)'}")
    say(f"  3) Картинки .................. {'нет' if args.skip_images else 'ДА'}")
    say(f"  4) История цен ............... {'нет' if args.skip_history else 'ДА'}")
    if args.dry_run:
        say("  5) GitHub .................... dry-run (только список файлов)")
    elif args.no_push:
        say("  5) GitHub .................... нет (--no-push)")
    else:
        say("  5) GitHub .................... ДА (commit + push)")

    before = snapshot()
    print_snapshot("Состояние ДО", before)

    failed = 0

    if args.scrape:
        code = run_step(
            "Сбор предметов по id",
            "Обходит https://parapa.ru/mall/goods/{id}/ и пишет data/items.json",
            py_cmd("scrape_by_id.py"),
        )
        failed += int(code != 0)

    if args.enrich:
        code = run_step(
            "Дозаполнение описаний",
            "Для предметов без description снова открывает карточку и сохраняет текст",
            py_cmd("enrich_descriptions.py"),
        )
        failed += int(code != 0)

    if not args.skip_images:
        code = run_step(
            "Скачивание картинок",
            "Кладёт иконки и look в data/img/{id}/ и прописывает imageLocal/lookLocal",
            py_cmd("download_images.py"),
        )
        failed += int(code != 0)

    if not args.skip_history:
        say(
            box=True,
            msg="ШАГ: История цен\nСравнивает текущие цены с data/price_history.json и дописывает изменения",
        )
        try:
            from price_history import load_history, record_items, seed_from_items

            items = load_items()
            hist_before = load_history()
            points_before = sum(len(v) for v in hist_before.values() if isinstance(v, list))
            seed_from_items(items)
            record_items(items)
            hist_after = load_history()
            points_after = sum(len(v) for v in hist_after.values() if isinstance(v, list))
            new_keys = set(hist_after) - set(hist_before)
            say(f"  Предметов в истории: {len(hist_before)} → {len(hist_after)}")
            say(f"  Точек истории:       {points_before} → {points_after}  (+{points_after - points_before})")
            if new_keys:
                sample = ", ".join(sorted(new_keys, key=lambda x: int(x) if x.isdigit() else x)[:12])
                more = "" if len(new_keys) <= 12 else f" … ещё {len(new_keys) - 12}"
                say(f"  Новые id в истории:  {sample}{more}")
            else:
                say("  Новых id в истории нет")
            say("✓ история цен обновлена")
        except Exception as e:
            say(f"✗ история цен: {e}")
            failed += 1

    after = snapshot()
    print_snapshot("Состояние ПОСЛЕ", after)
    diff_snapshots(before, after)

    say(box=True, msg="Итог сбора")
    say(f"  Каталог:     {ITEMS} ({after['items']} шт.)")
    say(f"  История:     {HISTORY} ({after['hist_points']} точек)")
    say(f"  Картинки:    {IMG} ({after['icons']} icon / {after['looks']} look)")
    say(f"  Лог пайплайна: {LOG}")

    if failed:
        say(f"⚠ были ошибки в {failed} шаге(ах) — заливка всё равно возможна")

    if args.no_push and not args.dry_run:
        say("Готово без заливки (--no-push).")
        return 0 if failed == 0 else 2

    code = push_to_github(dry_run=args.dry_run)
    say(box=True, msg="ГОТОВО" if code == 0 and failed == 0 else "ГОТОВО С ЗАМЕЧАНИЯМИ")
    return 0 if code == 0 and failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())

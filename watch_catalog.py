#!/usr/bin/env python3
"""
Непрерывный мониторинг каталога Parapa mall.

Не долбит весь сайт разом. Каждый круг:
  1) проверяет хвост id на НОВЫЕ предметы
  2) обновляет пачку УЖЕ известных (цены / скидки / названия)
  3) пишет историю цен
  4) при изменениях может залить на GitHub

Так за несколько кругов плавно перебирается весь каталог снова и снова.

Примеры:
  py -3 watch_catalog.py
  py -3 watch_catalog.py --batch 30 --sleep 90
  py -3 watch_catalog.py --no-push
  py -3 watch_catalog.py --once
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
STATE_FILE = DATA / "watch_state.json"
LOG_FILE = DATA / "watch_catalog.log"
ITEMS_FILE = DATA / "items.json"

PUSH_PATHS = [
    "data/items.json",
    "data/price_history.json",
    "data/id_state.json",
    "data/img",
]


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S")


def say(msg: str = "", *, box: bool = False) -> None:
    if box:
        bar = "═" * 64
        text = f"\n{bar}\n{msg}\n{bar}"
        print(text, flush=True)
        _append_log(text + "\n")
        return
    line = f"[{ts()}] {msg}"
    print(line, flush=True)
    _append_log(line + "\n")


def _append_log(text: str) -> None:
    try:
        DATA.mkdir(parents=True, exist_ok=True)
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(text)
    except Exception:
        pass


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception:
            pass
    return {"cursor": 0, "rounds": 0, "last_full_pass": None}


def save_state(state: dict) -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(STATE_FILE)


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )


def ensure_git_identity() -> None:
    name = (git("config", "user.name").stdout or "").strip()
    email = (git("config", "user.email").stdout or "").strip()
    if name and email:
        return
    os.environ.setdefault("GIT_AUTHOR_NAME", "dramitelego-netizen")
    os.environ.setdefault(
        "GIT_AUTHOR_EMAIL", "253105569+dramitelego-netizen@users.noreply.github.com"
    )
    os.environ.setdefault("GIT_COMMITTER_NAME", os.environ["GIT_AUTHOR_NAME"])
    os.environ.setdefault("GIT_COMMITTER_EMAIL", os.environ["GIT_AUTHOR_EMAIL"])


def push_if_needed(changed: bool, do_push: bool) -> None:
    if not changed:
        say("  GitHub: изменений нет — push не нужен")
        return
    if not do_push:
        say("  GitHub: есть изменения, но --no-push")
        return

    ensure_git_identity()
    st = git("status", "--porcelain", "--", *PUSH_PATHS)
    lines = [ln for ln in (st.stdout or "").splitlines() if ln.strip()]
    if not lines:
        say("  GitHub: файлы данных не отличаются от git")
        return

    say("── Заливка на GitHub ──")
    for ln in lines[:40]:
        say(f"  {ln}")
    if len(lines) > 40:
        say(f"  … ещё {len(lines) - 40}")

    git("add", "--", *PUSH_PATHS)
    msg = f"Watch update {datetime.now().strftime('%Y-%m-%d %H:%M')}"
    commit = git("commit", "-m", msg)
    out = (commit.stdout or "") + (commit.stderr or "")
    if commit.returncode != 0 and "nothing to commit" in out.lower():
        say("  Нечего коммитить")
        return
    if commit.returncode != 0:
        say(f"  ✗ commit: {out.strip()}")
        return

    branch = (git("rev-parse", "--abbrev-ref", "HEAD").stdout or "main").strip()
    push = git("push", "origin", branch)
    pout = (push.stdout or "") + (push.stderr or "")
    for line in pout.splitlines():
        if line.strip():
            say(f"  {line}")
    if push.returncode == 0:
        say("  ✓ залито → https://dramitelego-netizen.github.io/futurum-search/")
    else:
        say("  ✗ push не удался")


def merge_item(old: dict | None, new: dict) -> dict:
    """Новые данные с сайта + сохраняем локальные пути картинок."""
    merged = dict(old or {})
    for key in (
        "id",
        "name",
        "description",
        "price",
        "priceOld",
        "onSale",
        "image",
        "lookImage",
        "url",
        "category",
        "categoryTitle",
        "categories",
    ):
        if key in new:
            merged[key] = new[key]
    # локальные файлы не затираем
    if old:
        if old.get("imageLocal"):
            merged["imageLocal"] = old["imageLocal"]
        if old.get("lookLocal"):
            merged["lookLocal"] = old["lookLocal"]
    # товар снова на сайте — снимаем пометку
    merged["unavailable"] = False
    merged.pop("unavailableSince", None)
    merged["missStreak"] = 0
    return merged


def mark_unavailable(old: dict) -> dict:
    item = dict(old)
    already = bool(item.get("unavailable"))
    item["unavailable"] = True
    if not already:
        item["unavailableSince"] = int(time.time())
    item["missStreak"] = 0
    return item


def diff_item(old: dict, new: dict) -> list[str]:
    changes: list[str] = []
    if old.get("price") != new.get("price"):
        changes.append(f"цена {old.get('price')} → {new.get('price')}")
    if old.get("priceOld") != new.get("priceOld"):
        changes.append(f"старая {old.get('priceOld')} → {new.get('priceOld')}")
    if bool(old.get("onSale")) != bool(new.get("onSale")):
        changes.append(f"скидка {bool(old.get('onSale'))} → {bool(new.get('onSale'))}")
    if bool(old.get("unavailable")) != bool(new.get("unavailable")):
        if new.get("unavailable"):
            changes.append("снят с продажи")
        else:
            changes.append("снова в продаже")
    if (old.get("name") or "") != (new.get("name") or ""):
        changes.append("название")
    old_desc = (old.get("description") or "").strip()
    new_desc = (new.get("description") or "").strip()
    if new_desc and new_desc != old_desc:
        changes.append("описание")
    return changes


def refresh_batch(ids: list[int], found: dict[str, dict], workers: int) -> tuple[int, list[str]]:
    """Перепроверяет известные id. Возвращает (число изменений, список сообщений)."""
    from scrape_by_id import check_id, save_found

    if not ids:
        return 0, []

    say(f"  Обновляю пачку из {len(ids)} предметов: id {ids[0]}…{ids[-1]}")
    changed = 0
    notes: list[str] = []
    results = []
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futs = {pool.submit(check_id, gid): gid for gid in ids}
        for fut in as_completed(futs):
            results.append(fut.result())
    results.sort(key=lambda x: x[0])

    for gid, item, elapsed, status in results:
        key = str(gid)
        old = found.get(key)
        if not item:
            if not old:
                continue
            # «пусто» = карточки нет на сайте → помечаем «нет в продаже»
            # «нет ответа» = сеть/сайт лежит → не трогаем сразу, копим промахи
            if status == "пусто":
                was = bool(old.get("unavailable"))
                found[key] = mark_unavailable(old)
                if not was:
                    changed += 1
                    msg = f"[{gid}] {old.get('name')}: нет в продаже"
                    notes.append(msg)
                    say(f"  ✕ {msg} ({elapsed:.1f}с)")
                else:
                    say(f"  · [{gid}] по-прежнему нет в продаже ({elapsed:.1f}с)")
            else:
                streak = int(old.get("missStreak") or 0) + 1
                old = dict(old)
                old["missStreak"] = streak
                # после 3 сетевых промахов подряд тоже помечаем
                if streak >= 3 and not old.get("unavailable"):
                    found[key] = mark_unavailable(old)
                    changed += 1
                    msg = f"[{gid}] {old.get('name')}: нет в продаже (нет ответа ×{streak})"
                    notes.append(msg)
                    say(f"  ✕ {msg}")
                else:
                    found[key] = old
                    say(
                        f"  · [{gid}] не ответил ({status}, {elapsed:.1f}с) "
                        f"— промах {streak}/3, оставляю"
                    )
            continue
        if not old:
            found[key] = merge_item(None, item)
            changed += 1
            notes.append(f"[{gid}] появился в каталоге: {item.get('name')}")
            say(f"  ★ [{gid}] новый при обновлении: {item.get('name')}")
            continue
        merged = merge_item(old, item)
        changes = diff_item(old, merged)
        found[key] = merged
        if changes:
            changed += 1
            msg = f"[{gid}] {old.get('name')}: " + ", ".join(changes)
            notes.append(msg)
            say(f"  ✎ {msg} ({elapsed:.1f}с)")
        else:
            say(f"  · [{gid}] без изменений ({elapsed:.1f}с)")

    save_found(found, max(ids))
    return changed, notes


def download_for_new(new_ids: list[int]) -> None:
    if not new_ids:
        return
    say(f"  Качаю картинки для новых id: {new_ids[:12]}{'…' if len(new_ids) > 12 else ''}")
    # полный download_images сам найдёт недостающее — это проще и надёжнее
    subprocess.run(
        [sys.executable, "-u", "download_images.py"],
        cwd=str(ROOT),
    )


def one_round(
    *,
    batch: int,
    ahead: int,
    empty_stop: int,
    workers: int,
    do_images: bool,
    do_push: bool,
) -> dict:
    from scrape_by_id import load_found, scan_new, warmup
    from price_history import record_items

    state = load_state()
    found = load_found()
    ids = sorted(int(k) for k in found)
    total = len(ids)
    cursor = int(state.get("cursor") or 0)
    if cursor >= total:
        cursor = 0

    round_no = int(state.get("rounds") or 0) + 1
    say(
        box=True,
        msg=(
            f"КРУГ #{round_no}\n"
            f"В каталоге: {total} предметов | курсор обновления цен: {cursor}/{total}"
        ),
    )

    changed_total = 0
    new_count = 0

    # 1) новые id
    say("── 1/3 Новые предметы (хвост после max id) ──")
    before_ids = set(found.keys())
    warmup()
    new_count = scan_new(ahead=ahead, empty_stop=empty_stop, workers=workers)
    found = load_found()
    after_ids = set(found.keys())
    brand_new = sorted(int(x) for x in (after_ids - before_ids))
    if brand_new:
        changed_total += len(brand_new)
        say(f"  Найдено новых: {len(brand_new)} → {brand_new[:20]}")
        if do_images:
            download_for_new(brand_new)
    else:
        say("  Новых предметов нет")

    # 2) пачка известных — цены/скидки
    say("── 2/3 Обновление цен (пачка известных) ──")
    ids = sorted(int(k) for k in found)
    total = len(ids)
    if total == 0:
        say("  Каталог пуст — сначала нужен полный сбор")
    else:
        if cursor >= total:
            cursor = 0
        end = min(total, cursor + batch)
        batch_ids = ids[cursor:end]
        # wrap: если пачка короткая в конце — добираем с начала в следующем круге
        n_changed, _notes = refresh_batch(batch_ids, found, workers=workers)
        changed_total += n_changed
        cursor = end
        if cursor >= total:
            cursor = 0
            state["last_full_pass"] = datetime.now().isoformat(timespec="seconds")
            say("  ✓ полный круг по известным предметам завершён — начинаю сначала")
        pct = 100.0 * (cursor if cursor else total) / total
        say(f"  Прогресс обхода каталога: {cursor}/{total} ({pct:.1f}% к следующему кругу)")

    # 3) история цен
    say("── 3/3 История цен ──")
    found = load_found()
    items = sorted(found.values(), key=lambda x: x["id"])
    try:
        record_items(items)
        say(f"  История синхронизирована ({len(items)} предметов)")
    except Exception as e:
        say(f"  ⚠ история: {e}")

    state["cursor"] = cursor
    state["rounds"] = round_no
    state["updated"] = datetime.now().isoformat(timespec="seconds")
    save_state(state)

    say("── Итог круга ──")
    say(f"  Новых предметов: {new_count}")
    say(f"  Изменений в пачке: учтено в сумме → всего флагов изменений: {changed_total}")
    say(f"  Каталог сейчас: {len(items)} шт.")
    say(f"  Лог: {LOG_FILE}")

    push_if_needed(changed_total > 0, do_push)
    return {
        "round": round_no,
        "new": new_count,
        "changed": changed_total,
        "total": len(items),
        "cursor": cursor,
    }


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="Плавный постоянный мониторинг каталога Parapa → GitHub"
    )
    ap.add_argument("--batch", type=int, default=25, help="сколько известных предметов обновлять за круг (по умолчанию 25)")
    ap.add_argument("--ahead", type=int, default=80, help="сколько id вперёд искать новые (по умолчанию 80)")
    ap.add_argument("--empty-stop", type=int, default=30, help="стоп после N пустых подряд при поиске новых")
    ap.add_argument("--sleep", type=int, default=120, help="пауза между кругами в секундах (по умолчанию 120)")
    ap.add_argument("--workers", type=int, default=5, help="параллельных запросов")
    ap.add_argument("--once", action="store_true", help="сделать один круг и выйти")
    ap.add_argument("--no-push", action="store_true", help="не заливать на GitHub")
    ap.add_argument("--no-images", action="store_true", help="не качать картинки для новых")
    args = ap.parse_args()

    say(
        box=True,
        msg=(
            "FUTURUM · watch_catalog\n"
            "Плавный мониторинг: новые id + обновление цен пачками по кругу\n"
            "Остановка: Ctrl+C"
        ),
    )
    say("Настройки:")
    say(f"  Пачка цен за круг:     {args.batch}")
    say(f"  Поиск новых вперёд:    {args.ahead} id")
    say(f"  Пауза между кругами:   {args.sleep}с")
    say(f"  GitHub push:           {'нет' if args.no_push else 'да, если есть изменения'}")
    say(f"  Картинки новых:        {'нет' if args.no_images else 'да'}")
    say(f"  Режим:                 {'один круг' if args.once else 'постоянно'}")
    say("")
    say("Как это устроено:")
    say("  • Не сканирует весь сайт каждый раз")
    say("  • Каждый круг: хвост новых id + следующая пачка известных")
    say("  • За несколько кругов проходит ВСЕ предметы и начинает сначала")
    say("  • Так ловятся и новинки, и смены цен")

    try:
        while True:
            one_round(
                batch=max(1, args.batch),
                ahead=max(10, args.ahead),
                empty_stop=max(5, args.empty_stop),
                workers=max(1, args.workers),
                do_images=not args.no_images,
                do_push=not args.no_push,
            )
            if args.once:
                break
            say(f"Пауза {args.sleep}с до следующего круга…")
            time.sleep(max(5, args.sleep))
    except KeyboardInterrupt:
        say("")
        say("Остановлено пользователем (Ctrl+C). Состояние курсора сохранено — продолжит с места.")
        return 0

    say("Готово.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

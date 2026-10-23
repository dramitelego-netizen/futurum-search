#!/usr/bin/env python3
"""
Непрерывный мониторинг каталога Parapa mall.

Не долбит весь сайт разом. Каждый круг:
  1) проверяет хвост id на НОВЫЕ предметы
  2) обновляет пачку УЖЕ известных (цены / скидки / названия)
  3) пишет историю цен
  4) при изменениях может залить на GitHub

Так за несколько кругов плавно перебирается весь каталог снова и снова.

Подробный лог: консоль + data/watch_catalog.log
(включая построчный прогресс поиска новых id из scrape_by_id).

Запуск:
  py -3 ЗАПУСК_мониторинг_каталога.py
  py -3 ЗАПУСК_мониторинг_каталога.py --batch 30 --sleep 90
  py -3 ЗАПУСК_мониторинг_каталога.py --no-push
  py -3 ЗАПУСК_мониторинг_каталога.py --once

Или двойной клик: ЗАПУСК_мониторинг_каталога.bat
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


def attach_scrape_logger() -> None:
    """Дублируем scrape_by_id.log → watch_catalog.log (без второго print)."""
    import scrape_by_id as sb

    if getattr(sb, "_watch_tee", False):
        return
    orig = sb.log

    def tee(msg: str) -> None:
        orig(msg)
        try:
            DATA.mkdir(parents=True, exist_ok=True)
            with LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(f"[{ts()}] {msg}\n")
        except Exception:
            pass

    sb.log = tee
    sb._watch_tee = True


def fmt_duration(seconds: float) -> str:
    s = int(max(0, seconds))
    if s < 60:
        return f"{s}с"
    m, sec = divmod(s, 60)
    if m < 60:
        return f"{m}м {sec:02d}с"
    h, m = divmod(m, 60)
    return f"{h}ч {m:02d}м {sec:02d}с"


def catalog_stats(found: dict[str, dict]) -> dict:
    items = list(found.values())
    unavailable = sum(1 for i in items if i.get("unavailable"))
    on_sale = sum(
        1
        for i in items
        if not i.get("unavailable")
        and (
            i.get("onSale")
            or (
                i.get("priceOld") is not None
                and i.get("price") is not None
                and i["priceOld"] > i["price"]
            )
        )
    )
    prices = [
        int(i["price"])
        for i in items
        if not i.get("unavailable") and isinstance(i.get("price"), (int, float))
    ]
    return {
        "total": len(items),
        "unavailable": unavailable,
        "on_sale": on_sale,
        "active": len(items) - unavailable,
        "price_min": min(prices) if prices else None,
        "price_max": max(prices) if prices else None,
    }


def sleep_with_ticks(seconds: int) -> None:
    """Пауза с тиками в лог, чтобы было видно что процесс жив."""
    total = max(5, int(seconds))
    say(f"Пауза {fmt_duration(total)} до следующего круга…")
    tick = 30 if total >= 60 else max(5, total // 3)
    left = total
    while left > 0:
        step = min(tick, left)
        time.sleep(step)
        left -= step
        if left > 0:
            say(f"  …осталось {fmt_duration(left)}")


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
    """Новые данные с сайта + сохраняем локальные пути картинок и категории."""
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
    ):
        if key in new:
            merged[key] = new[key]
    # категорию с сайта берём только если она реально есть;
    # иначе не затираем локальное обогащение (иначе в разделах остаются одни ★)
    new_cat = new.get("category")
    new_cats = new.get("categories") or []
    if new_cat or (isinstance(new_cats, list) and any(new_cats)):
        merged["category"] = new_cat
        merged["categoryTitle"] = new.get("categoryTitle")
        merged["categories"] = list(new_cats) if isinstance(new_cats, list) else []
    elif old:
        if old.get("category"):
            merged["category"] = old["category"]
        if old.get("categoryTitle"):
            merged["categoryTitle"] = old["categoryTitle"]
        if old.get("categories"):
            merged["categories"] = old["categories"]
    for meta in ("gender", "badge"):
        if old and old.get(meta) and not new.get(meta):
            merged[meta] = old[meta]
        elif new.get(meta):
            merged[meta] = new[meta]
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


def _price_label(item: dict | None) -> str:
    if not item:
        return "?"
    p = item.get("price")
    old = item.get("priceOld")
    if p is None:
        return "?"
    if old is not None and old > p:
        return f"{p} (было {old})"
    return str(p)


def refresh_batch(ids: list[int], found: dict[str, dict], workers: int) -> tuple[int, list[str]]:
    """Перепроверяет известные id. Возвращает (число изменений, список сообщений)."""
    from scrape_by_id import check_id, save_found

    if not ids:
        return 0, []

    say(f"  Обновляю пачку из {len(ids)} предметов: id {ids[0]}…{ids[-1]}")
    say(f"  Потоков: {workers}")
    say("  Состав пачки:")
    for gid in ids:
        old = found.get(str(gid)) or {}
        flag = " [нет в продаже]" if old.get("unavailable") else ""
        sale = " [скидка]" if old.get("onSale") else ""
        say(
            f"    · [{gid}] {old.get('name') or '?'} — {_price_label(old)} монет"
            f"{sale}{flag}"
        )

    changed = 0
    notes: list[str] = []
    ok_n = same_n = gone_n = miss_n = new_n = 0
    done = 0
    total = len(ids)
    t0 = time.perf_counter()

    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futs = {pool.submit(check_id, gid): gid for gid in ids}
        for fut in as_completed(futs):
            gid, item, elapsed, status = fut.result()
            done += 1
            key = str(gid)
            old = found.get(key)
            prefix = f"  [{done}/{total}]"

            if not item:
                if not old:
                    say(f"{prefix} [{gid}] пустой ответ, в каталоге нет — пропускаю ({elapsed:.1f}с)")
                    continue
                # «пусто» = карточки нет на сайте → помечаем «нет в продаже»
                # «нет ответа» = сеть/сайт лежит → не трогаем сразу, копим промахи
                if status == "пусто":
                    was = bool(old.get("unavailable"))
                    found[key] = mark_unavailable(old)
                    if not was:
                        changed += 1
                        gone_n += 1
                        msg = f"[{gid}] {old.get('name')}: нет в продаже"
                        notes.append(msg)
                        say(f"{prefix} ✕ {msg} ({elapsed:.1f}с)")
                    else:
                        gone_n += 1
                        say(
                            f"{prefix} · [{gid}] {old.get('name')}: "
                            f"по-прежнему нет в продаже ({elapsed:.1f}с)"
                        )
                else:
                    streak = int(old.get("missStreak") or 0) + 1
                    old = dict(old)
                    old["missStreak"] = streak
                    # после 3 сетевых промахов подряд тоже помечаем
                    if streak >= 3 and not old.get("unavailable"):
                        found[key] = mark_unavailable(old)
                        changed += 1
                        gone_n += 1
                        msg = f"[{gid}] {old.get('name')}: нет в продаже (нет ответа ×{streak})"
                        notes.append(msg)
                        say(f"{prefix} ✕ {msg}")
                    else:
                        found[key] = old
                        miss_n += 1
                        say(
                            f"{prefix} · [{gid}] {old.get('name')}: "
                            f"не ответил ({status}, {elapsed:.1f}с) "
                            f"— промах {streak}/3, оставляю"
                        )
                continue

            if not old:
                found[key] = merge_item(None, item)
                changed += 1
                new_n += 1
                notes.append(f"[{gid}] появился в каталоге: {item.get('name')}")
                say(
                    f"{prefix} ★ [{gid}] новый при обновлении: {item.get('name')} "
                    f"— {_price_label(item)} монет ({elapsed:.1f}с)"
                )
                continue

            merged = merge_item(old, item)
            changes = diff_item(old, merged)
            found[key] = merged
            if changes:
                changed += 1
                ok_n += 1
                msg = f"[{gid}] {old.get('name')}: " + ", ".join(changes)
                notes.append(msg)
                say(
                    f"{prefix} ✎ {msg} | сейчас {_price_label(merged)} монет "
                    f"({elapsed:.1f}с)"
                )
            else:
                same_n += 1
                say(
                    f"{prefix} · [{gid}] {old.get('name')}: без изменений "
                    f"— {_price_label(merged)} монет ({elapsed:.1f}с)"
                )

    save_found(found, max(ids))
    elapsed_batch = time.perf_counter() - t0
    say(
        f"  Пачка готова за {fmt_duration(elapsed_batch)}: "
        f"изменений {changed}, без изменений {same_n}, "
        f"снято/нет {gone_n}, сетевых промахов {miss_n}, новых {new_n}"
    )
    return changed, notes


def download_for_new(new_ids: list[int]) -> None:
    if not new_ids:
        return
    say(f"  Качаю картинки для новых id ({len(new_ids)}): {new_ids[:12]}{'…' if len(new_ids) > 12 else ''}")
    t0 = time.perf_counter()
    # полный download_images сам найдёт недостающее — это проще и надёжнее
    proc = subprocess.run(
        [sys.executable, "-u", "download_images.py"],
        cwd=str(ROOT),
    )
    say(
        f"  Картинки: код выхода {proc.returncode}, "
        f"заняло {fmt_duration(time.perf_counter() - t0)}"
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
    from scrape_by_id import (
        GAP_SCAN_END,
        GAP_SCAN_START,
        load_found,
        scan_gaps,
        scan_new,
        warmup,
    )
    from price_history import record_items

    attach_scrape_logger()
    t_round = time.perf_counter()
    state = load_state()
    found = load_found()
    ids = sorted(int(k) for k in found)
    total = len(ids)
    cursor = int(state.get("cursor") or 0)
    if cursor >= total:
        cursor = 0

    stats = catalog_stats(found)
    rounds_left = 0
    if total > 0 and batch > 0:
        remaining = total - cursor
        rounds_left = (remaining + batch - 1) // batch

    round_no = int(state.get("rounds") or 0) + 1
    last_pass = state.get("last_full_pass") or "ещё не было"
    say(
        box=True,
        msg=(
            f"КРУГ #{round_no}\n"
            f"Каталог: {stats['total']} (в продаже {stats['active']}, "
            f"нет в продаже {stats['unavailable']}, скидок {stats['on_sale']})\n"
            f"Курсор цен: {cursor}/{total} | до полного обхода ≈ {rounds_left} круг(ов)\n"
            f"Последний полный обход: {last_pass}"
        ),
    )
    if stats["price_min"] is not None:
        say(f"  Цены в каталоге: от {stats['price_min']} до {stats['price_max']} монет")

    changed_total = 0
    new_count = 0

    # 1) новые id — сначала дыры 1…1000, потом хвост после max
    say("── 1/3 Новые предметы (дыры 1…1000 + хвост) ──")
    max_id = max(ids) if ids else 0
    say(f"  Макс. известный id: {max_id}")
    say(f"  Дыры: проверяем все неизвестные id в {GAP_SCAN_START}…{GAP_SCAN_END}")
    say(f"  Хвост: ещё +{ahead} id после max, стоп после {empty_stop} пустых подряд")
    say(f"  Потоков: {workers}")
    before_ids = set(found.keys())
    t1 = time.perf_counter()
    warmup()
    gaps_new = scan_gaps(
        start=GAP_SCAN_START, end=GAP_SCAN_END, workers=workers
    )
    say(f"  Пропуски 1…{GAP_SCAN_END}: найдено {gaps_new}")
    tail_new = scan_new(ahead=ahead, empty_stop=empty_stop, workers=workers)
    say(f"  Хвост после max: найдено {tail_new}")
    new_count = gaps_new + tail_new
    say(f"  Шаг 1 занял {fmt_duration(time.perf_counter() - t1)}")
    found = load_found()
    after_ids = set(found.keys())
    brand_new = sorted(int(x) for x in (after_ids - before_ids))
    if brand_new:
        changed_total += len(brand_new)
        say(f"  ★ Найдено новых всего: {len(brand_new)}")
        for nid in brand_new[:30]:
            it = found.get(str(nid)) or {}
            say(f"    + [{nid}] {it.get('name')} — {_price_label(it)} монет")
        if len(brand_new) > 30:
            say(f"    … и ещё {len(brand_new) - 30}")
        if do_images:
            download_for_new(brand_new)
        else:
            say("  Картинки: пропущено (--no-images)")
    else:
        say("  Новых предметов нет")

    # 2) пачка известных — цены/скидки
    say("── 2/3 Обновление цен (пачка известных) ──")
    ids = sorted(int(k) for k in found)
    total = len(ids)
    batch_notes: list[str] = []
    if total == 0:
        say("  Каталог пуст — сначала нужен полный сбор")
    else:
        if cursor >= total:
            cursor = 0
        end = min(total, cursor + batch)
        batch_ids = ids[cursor:end]
        say(f"  Курсор до: {cursor}/{total} → после пачки будет {end}/{total}")
        t2 = time.perf_counter()
        n_changed, batch_notes = refresh_batch(batch_ids, found, workers=workers)
        say(f"  Шаг 2 занял {fmt_duration(time.perf_counter() - t2)}")
        changed_total += n_changed
        cursor = end
        if cursor >= total:
            cursor = 0
            state["last_full_pass"] = datetime.now().isoformat(timespec="seconds")
            say("  ✓ полный круг по известным предметам завершён — начинаю сначала")
        pct = 100.0 * (cursor if cursor else total) / max(total, 1)
        say(f"  Прогресс обхода каталога: {cursor}/{total} ({pct:.1f}%)")
        if batch > 0 and total > 0:
            # cursor=0 после wrap → впереди следующий полный обход (total id)
            left_ids = (total - cursor) if cursor else total
            rounds_est = (left_ids + batch - 1) // batch
            say(f"  До конца полного обхода: ~{left_ids} id ≈ {rounds_est} круг(ов)")

    # 3) история цен
    say("── 3/3 История цен ──")
    found = load_found()
    items = sorted(found.values(), key=lambda x: x["id"])
    t3 = time.perf_counter()
    try:
        record_items(items)
        say(
            f"  История синхронизирована ({len(items)} предметов) "
            f"за {fmt_duration(time.perf_counter() - t3)}"
        )
    except Exception as e:
        say(f"  ⚠ история: {e}")

    # категории / пол / ★☆ — локальные эвристики (не затираются merge_item)
    say("── Категории ──")
    t4 = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, "-u", "enrich_filters.py"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        out = (proc.stdout or "").strip()
        if out:
            for line in out.splitlines()[-3:]:
                say(f"  {line}")
        if proc.returncode != 0:
            err = (proc.stderr or "").strip()
            say(f"  ⚠ enrich_filters код {proc.returncode}: {err[:200]}")
        else:
            say(f"  Категории обновлены за {fmt_duration(time.perf_counter() - t4)}")
            # перечитать после enrich
            found = load_found()
            items = sorted(found.values(), key=lambda x: x["id"])
    except Exception as e:
        say(f"  ⚠ категории: {e}")

    state["cursor"] = cursor
    state["rounds"] = round_no
    state["updated"] = datetime.now().isoformat(timespec="seconds")
    save_state(state)

    stats_after = catalog_stats(found)
    say("── Итог круга ──")
    say(f"  Длительность круга:     {fmt_duration(time.perf_counter() - t_round)}")
    say(f"  Новых предметов:        {new_count}")
    say(f"  Флагов изменений:       {changed_total}")
    if batch_notes:
        say(f"  Изменения в пачке ({len(batch_notes)}):")
        for n in batch_notes[:40]:
            say(f"    • {n}")
        if len(batch_notes) > 40:
            say(f"    … ещё {len(batch_notes) - 40}")
    say(
        f"  Каталог: {stats_after['total']} "
        f"(в продаже {stats_after['active']}, "
        f"нет в продаже {stats_after['unavailable']}, "
        f"скидок {stats_after['on_sale']})"
    )
    say(f"  Курсор на следующий круг: {cursor}/{stats_after['total']}")
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
    ap.add_argument("--batch", type=int, default=10, help="сколько известных предметов обновлять за круг (по умолчанию 10)")
    ap.add_argument("--ahead", type=int, default=40, help="сколько id вперёд искать новые (по умолчанию 40)")
    ap.add_argument("--empty-stop", type=int, default=20, help="стоп после N пустых подряд при поиске новых")
    ap.add_argument("--sleep", type=int, default=0, help="пауза между кругами в секундах (0 = без передышки)")
    ap.add_argument("--workers", type=int, default=2, help="параллельных запросов (по умолчанию 2, бережно к сайту)")
    ap.add_argument("--once", action="store_true", help="сделать один круг и выйти")
    ap.add_argument("--no-push", action="store_true", help="не заливать на GitHub")
    ap.add_argument("--no-images", action="store_true", help="не качать картинки для новых")
    args = ap.parse_args()

    attach_scrape_logger()
    say(
        box=True,
        msg=(
            "FUTURUM · мониторинг каталога\n"
            "Плавный мониторинг: новые id + обновление цен пачками по кругу\n"
            "Подробный лог → data/watch_catalog.log\n"
            "Остановка: Ctrl+C"
        ),
    )
    say("Настройки:")
    say(f"  Пачка цен за круг:     {args.batch}")
    say(f"  Поиск новых вперёд:    {args.ahead} id")
    say(f"  Стоп пустых подряд:    {args.empty_stop}")
    say(f"  Потоков:               {args.workers}")
    say(f"  Пауза между кругами:   {fmt_duration(args.sleep)}")
    say(f"  GitHub push:           {'нет' if args.no_push else 'да, если есть изменения'}")
    say(f"  Картинки новых:        {'нет' if args.no_images else 'да'}")
    say(f"  Режим:                 {'один круг' if args.once else 'постоянно'}")
    say(f"  Лог файл:              {LOG_FILE}")
    say("")
    say("Как это устроено:")
    say("  • Не сканирует весь сайт каждый раз")
    say("  • Каждый круг: хвост новых id + следующая пачка известных")
    say("  • За несколько кругов проходит ВСЕ предметы и начинает сначала")
    say("  • Так ловятся и новинки, и смены цен")
    say("  • В логе видно каждый id: цена, изменения, «нет в продаже»")

    # снимок на старте
    try:
        from scrape_by_id import load_found

        found0 = load_found()
        st0 = catalog_stats(found0)
        state0 = load_state()
        say("")
        say("Сейчас в каталоге:")
        say(f"  Предметов:        {st0['total']}")
        say(f"  В продаже:        {st0['active']}")
        say(f"  Нет в продаже:    {st0['unavailable']}")
        say(f"  Со скидкой:       {st0['on_sale']}")
        if st0["price_min"] is not None:
            say(f"  Цены:             {st0['price_min']}…{st0['price_max']} монет")
        say(f"  Курсор watch:     {state0.get('cursor', 0)}/{st0['total']}")
        say(f"  Кругов сделано:   {state0.get('rounds', 0)}")
        say(f"  Полный обход:     {state0.get('last_full_pass') or 'ещё не было'}")
    except Exception as e:
        say(f"  (не удалось прочитать каталог: {e})")

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
            if args.sleep > 0:
                sleep_with_ticks(args.sleep)
            else:
                say("Паузы нет — сразу следующий круг")
    except KeyboardInterrupt:
        say("")
        say("Остановлено пользователем (Ctrl+C). Состояние курсора сохранено — продолжит с места.")
        return 0

    say("Готово.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

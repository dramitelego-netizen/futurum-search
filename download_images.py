"""
Дозаполняет lookImage/description и скачивает картинки локально:
  data/img/{id}/icon.*  — иконка из формы
  data/img/{id}/look.*  — «как выглядит» из description (если есть)

Умеет продолжать с места остановки и переподключаться при обрыве.
"""

from __future__ import annotations

import json
import mimetypes
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlparse

from scrape_by_id import (
    COOKIE_FILE,
    ITEMS_FILE,
    OUT,
    SAVE_LOCK,
    UA,
    check_id,
    log,
    warmup,
)

IMG_ROOT = OUT / "img"
WORKERS = 3
MAX_TRIES = 5
DOWNLOAD_LOG = OUT / "download_images.log"


def blog(msg: str) -> None:
    log(msg)
    try:
        with DOWNLOAD_LOG.open("a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


def ext_from(url: str, content_type: str = "") -> str:
    path = urlparse(url).path
    suffix = Path(path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    if content_type:
        guess = mimetypes.guess_extension(content_type.split(";")[0].strip())
        if guess == ".jpe":
            return ".jpg"
        if guess:
            return guess
    return ".bin"


def download(url: str, dest: Path, tries: int = MAX_TRIES) -> bool:
    if not url or not url.startswith("http"):
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)

    for attempt in range(1, tries + 1):
        tmp = dest.with_suffix(dest.suffix + ".tmp")
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        proc = subprocess.run(
            [
                "curl.exe",
                "-sL",
                "--compressed",
                "--retry",
                "3",
                "--retry-delay",
                "2",
                "--retry-connrefused",
                "-c",
                str(COOKIE_FILE),
                "-b",
                str(COOKIE_FILE),
                "-A",
                UA,
                "-H",
                "Referer: https://parapa.ru/mall/",
                "--max-time",
                "70",
                "--connect-timeout",
                "25",
                "-o",
                str(tmp),
                "-w",
                "%{http_code}|%{content_type}",
                url,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        meta = (proc.stdout or "").strip()
        code = meta.split("|")[0] if meta else ""
        ctype = meta.split("|")[1] if "|" in meta else ""

        if proc.returncode != 0 or code not in {"200", "304"} or not tmp.exists():
            if tmp.exists():
                tmp.unlink(missing_ok=True)
            blog(f"  ↻ обрыв/ошибка ({code or proc.returncode}), попытка {attempt}/{tries}")
            if attempt == 2 or attempt == 4:
                warmup()
            time.sleep(0.8 * attempt)
            continue

        final = dest
        if final.suffix == ".bin":
            final = dest.with_suffix(ext_from(url, ctype))
        data = tmp.read_bytes()
        if len(data) < 80 or data[:15].lstrip().startswith(b"<"):
            tmp.unlink(missing_ok=True)
            blog(f"  ↻ мусор вместо файла, попытка {attempt}/{tries}")
            if attempt >= 2:
                warmup()
            time.sleep(0.6 * attempt)
            continue
        tmp.replace(final)
        return True
    return False


def local_rel(path: Path) -> str:
    return path.relative_to(OUT.parent).as_posix()


def existing_local(folder: Path, stem: str) -> str | None:
    if not folder.exists():
        return None
    for p in folder.glob(f"{stem}.*"):
        if p.suffix != ".tmp" and p.stat().st_size > 80:
            return local_rel(p)
    return None


def candidate_urls(url: str) -> list[str]:
    """Запасные зеркала: gyazo CDN и parapa pictures/image/mall."""
    if not url:
        return []
    out = [url]
    low = url.lower()
    if "gyazo.com/" in low and "i.gyazo.com" not in low:
        hid = url.rstrip("/").split("/")[-1].split(".")[0]
        out.extend(
            [
                f"https://i.gyazo.com/{hid}.png",
                f"https://i.gyazo.com/{hid}.jpg",
            ]
        )
    if "parapa.ru/pictures/mall/" in url:
        out.append(url.replace("/pictures/mall/", "/pictures/image/mall/"))
        out.append(url.replace("/pictures/mall/", "/pictures/image/"))
    # уникальные, порядок сохраняем
    seen: set[str] = set()
    uniq: list[str] = []
    for u in out:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def ensure_file(url: str, folder: Path, stem: str) -> str | None:
    if not url:
        return None
    had = existing_local(folder, stem)
    if had:
        return had
    for cand in candidate_urls(url):
        ext = ext_from(cand)
        dest = folder / f"{stem}{ext}"
        if download(cand, dest):
            found = existing_local(folder, stem)
            if found:
                return found
    return None


def fetch_page(gid: int, tries: int = MAX_TRIES):
    last_status = "нет ответа"
    for attempt in range(1, tries + 1):
        _, fresh, _, status = check_id(gid)
        last_status = status
        if fresh:
            return fresh, status
        blog(f"  ↻ [{gid}] страница ({status}), попытка {attempt}/{tries}")
        if attempt >= 2:
            warmup()
        time.sleep(1.0 * attempt)
    return None, last_status


def item_done(item: dict) -> bool:
    folder = IMG_ROOT / str(item["id"])
    has_icon = bool(existing_local(folder, "icon") or item.get("imageLocal"))
    # lookImage None vs missing: after enrich, lookImage key exists (even null)
    if "lookImage" in item and has_icon:
        look_url = item.get("lookImage") or ""
        if look_url:
            if existing_local(folder, "look") or item.get("lookLocal"):
                return True
            # мёртвые внешние ссылки / 403 — не крутить вечно
            return bool(item.get("lookUnavailable"))
        return True
    return False


def enrich_item(item: dict) -> dict:
    gid = int(item["id"])
    folder = IMG_ROOT / str(gid)

    # подхватить уже скачанное
    had_icon = existing_local(folder, "icon")
    had_look = existing_local(folder, "look")
    if had_icon:
        item["imageLocal"] = had_icon
    if had_look:
        item["lookLocal"] = had_look

    need_page = (
        "lookImage" not in item
        or not (item.get("description") or "").strip()
        or (not had_icon and not (item.get("image") or "").strip())
    )
    if need_page:
        fresh, status = fetch_page(gid)
        if fresh:
            if fresh.get("description"):
                item["description"] = fresh["description"]
            item["lookImage"] = fresh.get("lookImage")
            if fresh.get("image"):
                item["image"] = fresh["image"]
            if fresh.get("name"):
                item["name"] = fresh["name"]
            item["price"] = fresh.get("price", item.get("price"))
            item["priceOld"] = fresh.get("priceOld", item.get("priceOld"))
            item["onSale"] = fresh.get("onSale", item.get("onSale"))
        else:
            blog(f"· [{gid}] страница так и не открылась ({status})")
            item.setdefault("lookImage", None)

    if not item.get("imageLocal"):
        icon = ensure_file(item.get("image") or "", folder, "icon")
        if icon:
            item["imageLocal"] = icon

    if item.get("lookImage") and not item.get("lookLocal"):
        look = ensure_file(item.get("lookImage") or "", folder, "look")
        if look:
            item["lookLocal"] = look
            item.pop("lookUnavailable", None)
        elif item.get("lookImage"):
            # gyazo 503 / clip.mail / parapa 403 — не показываем битую look-заглушку
            item["lookUnavailable"] = True
            item["lookImage"] = None

    return item


def save_all(data: dict, by_id: dict) -> None:
    with SAVE_LOCK:
        data["items"] = sorted(by_id.values(), key=lambda x: x["id"])
        data["count"] = len(data["items"])
        tmp = ITEMS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(ITEMS_FILE)
        try:
            from price_history import record_items

            record_items(data["items"])
        except Exception:
            pass


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser(description="Скачать иконки/look для каталога")
    ap.add_argument(
        "--ids",
        default="",
        help="только эти id через запятую (например 758,900)",
    )
    args = ap.parse_args()

    if not ITEMS_FILE.exists():
        blog("нет items.json")
        return

    DOWNLOAD_LOG.write_text("", encoding="utf-8")
    data = json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
    items = data.get("items") or []
    by_id = {str(i["id"]): i for i in items}

    only_ids: set[str] | None = None
    if args.ids.strip():
        only_ids = {x.strip() for x in args.ids.split(",") if x.strip()}
        items_scope = [it for it in items if str(it["id"]) in only_ids]
        missing = sorted(only_ids - {str(it["id"]) for it in items_scope})
        if missing:
            blog(f"⚠ id нет в items.json: {missing[:20]}")
    else:
        items_scope = items

    pending = [it for it in items_scope if not item_done(it)]
    blog("=" * 56)
    blog(f"Скачивание картинок → {IMG_ROOT}")
    if only_ids is not None:
        blog(f"Режим: только id {sorted(only_ids, key=lambda x: int(x))[:30]}")
    blog(
        f"В области: {len(items_scope)}, уже готово: {len(items_scope) - len(pending)}, "
        f"осталось: {len(pending)}"
    )
    blog("При обрыве — автоповтор и переподключение cookie")
    blog("=" * 56)

    if not pending:
        blog("Нечего качать — всё на месте")
        return

    warmup()
    done = 0
    with_look = sum(1 for i in items if existing_local(IMG_ROOT / str(i["id"]), "look"))
    t0 = time.perf_counter()

    # несколько проходов: сначала все, потом только неудачные
    queue = [dict(it) for it in pending]
    for wave in range(1, 4):
        if not queue:
            break
        blog(f"— проход {wave}: в очереди {len(queue)}")
        failed: list[dict] = []

        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futs = {pool.submit(enrich_item, it): it["id"] for it in queue}
            for fut in as_completed(futs):
                gid = futs[fut]
                try:
                    item = fut.result()
                except Exception as exc:
                    blog(f"✗ [{gid}] {exc}")
                    failed.append(by_id[str(gid)])
                    done += 1
                    continue

                by_id[str(gid)] = item
                done += 1
                if item.get("lookLocal"):
                    with_look += 1

                ok_icon = bool(item.get("imageLocal"))
                ok_look = bool(item.get("lookLocal")) or not item.get("lookImage")
                flag = "look" if item.get("lookLocal") else ("icon" if ok_icon else "FAIL")
                blog(f"✓ [{gid}] {flag} | готово в этом запуске {done} | look всего ~{with_look}")

                if not ok_icon or (item.get("lookImage") and not ok_look):
                    failed.append(item)

                if done % 8 == 0:
                    save_all(data, by_id)

        save_all(data, by_id)
        queue = failed
        if queue:
            blog(f"⚠ не докачалось: {len(queue)} — переподключение и ещё раз…")
            warmup()
            time.sleep(2)

    save_all(data, by_id)
    left = [i for i in by_id.values() if not item_done(i)]
    blog("=" * 56)
    blog(
        f"ГОТОВО за {time.perf_counter() - t0:.0f}с. "
        f"Папка: {IMG_ROOT}. Осталось проблемных: {len(left)}"
    )
    blog("=" * 56)


if __name__ == "__main__":
    main()

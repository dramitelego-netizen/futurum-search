const THEME_KEY = "futurum_theme";
const THEME_MODES = ["dark", "gray", "light"];
const BG_KEY = "futurum_bg";
const BG_MODES = ["vitrine", "aurora", "minimal", "signal"];
const SORT_KEY = "futurum_sort";
const SORT_MODES = ["relevance", "price-asc", "price-desc", "discount", "name"];

/** Игровые сокращения / синонимы — группы взаимозаменяемых корней */
const SYNONYM_GROUPS = [
  ["крыл", "крылья", "крыло", "wing"],
  ["муж", "мужск", "муж.", "(м)", "м)"],
  ["жен", "женск", "жен.", "(ж)", "ж)"],
  ["пет", "питомец", "питомц", "ездов", "маунт", "mount"],
  ["шляп", "шапк", "кепк", "бандан", "берет"],
  ["очк", "очки", "glasses"],
  ["плат", "плать", "сарафан"],
  ["сундук", "набор", "бокс", "chest", "пак"],
  ["стрел", "лук", "arrow"],
  ["молот", "молоков", "milk"],
  ["бабочк", "butterfly"],
  ["скин", "шкур", "окрас"],
  ["фон", "обои", "wallpaper"],
  ["подарок", "gift", "гифт"],
  ["суперфон", "superfon"],
];

const state = {
  items: [],
  query: "",
  activeId: null,
  list: [],
  favs: (window.FavStore && FavStore.loadLocal()) || new Set(),
  showFavs: false,
  showSale: false,
  sort: loadSort(),
};

const els = {
  q: document.getElementById("q"),
  stage: document.getElementById("stage"),
  results: document.getElementById("results"),
  preview: document.getElementById("preview"),
  hint: document.getElementById("hint"),
  catalogStat: document.getElementById("catalogStat"),
  catalogCount: document.getElementById("catalogCount"),
  themeToggle: document.getElementById("themeToggle"),
  saleToggle: document.getElementById("saleToggle"),
  favsToggle: document.getElementById("favsToggle"),
  favsCount: document.getElementById("favsCount"),
  sortPills: document.getElementById("sortPills"),
  resultsCount: document.getElementById("resultsCount"),
  brand: document.querySelector(".brand"),
  brandSub: document.getElementById("brandSub"),
  menuOpen: document.getElementById("menuOpen"),
  menuClose: document.getElementById("menuClose"),
  menuBackdrop: document.getElementById("menuBackdrop"),
  sideMenu: document.getElementById("sideMenu"),
  bgPicks: document.getElementById("bgPicks"),
};

function loadSort() {
  try {
    const s = localStorage.getItem(SORT_KEY);
    if (SORT_MODES.includes(s)) return s;
  } catch {
    /* ignore */
  }
  return "relevance";
}

function persistSort() {
  try {
    localStorage.setItem(SORT_KEY, state.sort);
  } catch {
    /* ignore */
  }
}

function persistFavs() {
  if (window.FavStore) {
    FavStore.saveLocal(state.favs);
    FavStore.pushServer(state.favs);
  }
}

function isFav(id) {
  return state.favs.has(Number(id));
}

function toggleFav(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return;
  if (state.favs.has(n)) state.favs.delete(n);
  else state.favs.add(n);
  persistFavs();
  updateFiltersUi();
}

async function syncFavs() {
  if (!window.FavStore) return;
  state.favs = await FavStore.sync(state.favs);
  updateFiltersUi();
  if (browseMode()) render();
}

function updateFiltersUi() {
  const n = state.favs.size;
  if (els.favsCount) els.favsCount.textContent = String(n);
  if (els.favsToggle) {
    els.favsToggle.classList.toggle("on", state.showFavs);
    els.favsToggle.setAttribute("aria-pressed", state.showFavs ? "true" : "false");
  }
  if (els.saleToggle) {
    els.saleToggle.classList.toggle("on", state.showSale);
    els.saleToggle.setAttribute("aria-pressed", state.showSale ? "true" : "false");
  }
  if (els.sortPills) {
    els.sortPills.querySelectorAll("[data-sort]").forEach((btn) => {
      const on = btn.dataset.sort === state.sort;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
}

function currentTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  return THEME_MODES.includes(t) ? t : "dark";
}

function nextTheme(theme) {
  const i = THEME_MODES.indexOf(theme);
  return THEME_MODES[(i < 0 ? 0 : i + 1) % THEME_MODES.length];
}

function setTheme(theme) {
  const next = THEME_MODES.includes(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  if (els.themeToggle) {
    const labels = {
      dark: "Тема: тёмная. Дальше — серая",
      gray: "Тема: серая. Дальше — светлая",
      light: "Тема: светлая. Дальше — тёмная",
    };
    const titles = {
      dark: "Тёмная → серая → светлая",
      gray: "Серая → светлая → тёмная",
      light: "Светлая → тёмная → серая",
    };
    els.themeToggle.title = titles[next] || "Тема";
    els.themeToggle.setAttribute("aria-label", labels[next] || "Сменить тему");
    els.themeToggle.setAttribute("aria-checked", next === "dark" ? "true" : "false");
  }
}

function currentBg() {
  const b = document.documentElement.getAttribute("data-bg");
  return BG_MODES.includes(b) ? b : "vitrine";
}

function setBg(mode) {
  const next = BG_MODES.includes(mode) ? mode : "vitrine";
  document.documentElement.setAttribute("data-bg", next);
  try {
    localStorage.setItem(BG_KEY, next);
  } catch {
    /* ignore */
  }
  if (els.bgPicks) {
    els.bgPicks.querySelectorAll("[data-bg]").forEach((btn) => {
      const on = btn.dataset.bg === next;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
}

let bootPlayed = false;
let searchIdleTimer = 0;
let searchBusy = false;

const SEARCH_GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%*&<>/\\|";

function searchTarget() {
  return String(els.brandSub?.dataset.text || "Search").toUpperCase();
}

function randSearchGlyph() {
  return SEARCH_GLYPHS[(Math.random() * SEARCH_GLYPHS.length) | 0];
}

/** Вариант #5 — быстрый glitch decode */
function playSearchDecode() {
  const el = els.brandSub;
  if (!el || searchBusy) return Promise.resolve();
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = searchTarget();
  if (reduce) {
    el.textContent = target;
    return Promise.resolve();
  }

  searchBusy = true;
  el.classList.add("is-decoding", "is-decoding-fast");

  return new Promise((resolve) => {
    let i = 0;
    const scramble = () => {
      if (i < 12) {
        el.textContent = [...target].map(() => randSearchGlyph()).join("");
        i += 1;
        setTimeout(scramble, 28);
        return;
      }
      const settled = Array(target.length).fill(false);
      let lock = 0;
      const lockNext = () => {
        if (lock < target.length) {
          settled[lock] = true;
          lock += 1;
          el.textContent = [...target]
            .map((ch, j) => (settled[j] ? ch : randSearchGlyph()))
            .join("");
          setTimeout(lockNext, 45);
          return;
        }
        el.textContent = target;
        el.classList.remove("is-decoding", "is-decoding-fast");
        searchBusy = false;
        resolve();
      };
      lockNext();
    };
    scramble();
  });
}

/** Редкий тихий сбой: 1–2 буквы мигают и возвращаются */
function playSearchFlicker() {
  const el = els.brandSub;
  if (!el || searchBusy || document.hidden) return;
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  const target = searchTarget();
  const count = Math.random() < 0.55 ? 1 : 2;
  const idxs = new Set();
  while (idxs.size < count) {
    idxs.add((Math.random() * target.length) | 0);
  }

  searchBusy = true;
  el.classList.add("is-flicker");
  const chars = [...target];
  idxs.forEach((i) => {
    chars[i] = randSearchGlyph();
  });
  el.textContent = chars.join("");

  setTimeout(() => {
    if (!els.brandSub) return;
    els.brandSub.textContent = target;
    els.brandSub.classList.remove("is-flicker");
    searchBusy = false;
  }, 90 + Math.random() * 70);
}

function scheduleSearchFlickers() {
  const loop = () => {
    clearTimeout(searchIdleTimer);
    searchIdleTimer = setTimeout(() => {
      playSearchFlicker();
      loop();
    }, 7000 + Math.random() * 9000);
  };
  loop();
}

function revealSearchStatic() {
  const el = els.brandSub;
  if (!el) return;
  el.classList.remove("is-pending");
  el.classList.add("is-appear");
  el.textContent = searchTarget();
}

function playBootGlitch() {
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (bootPlayed) return;
  bootPlayed = true;

  if (reduce) {
    revealSearchStatic();
    return;
  }

  // сразу появляется и decode
  const el = els.brandSub;
  if (el) {
    el.classList.remove("is-pending");
    el.classList.add("is-appear");
    el.textContent = [...searchTarget()].map(() => randSearchGlyph()).join("");
  }
  setTimeout(() => {
    playSearchDecode().then(() => {
      scheduleSearchFlickers();
    });
  }, 180);

  // спокойно → короткий дрыг → снова спокойно
  setTimeout(() => {
    if (!els.brand) return;
    els.brand.classList.add("boot-glitch");
    setTimeout(() => els.brand?.classList.remove("boot-glitch"), 680);
  }, 1500);

  // редкие мягкие вспышки позже
  const pulse = () => {
    if (!els.brand || document.hidden) return;
    els.brand.classList.add("boot-glitch");
    setTimeout(() => els.brand?.classList.remove("boot-glitch"), 480);
    setTimeout(pulse, 9000 + Math.random() * 10000);
  };
  setTimeout(pulse, 9000 + Math.random() * 4000);
}

let displayedCount = 0;
let countAnim = null;
let inputTimer = null;

function setCatalogCount(n, animate = true) {
  const target = Number(n) || 0;
  if (!els.catalogCount) return;

  if (!animate || Math.abs(target - displayedCount) > 80) {
    displayedCount = target;
    els.catalogCount.textContent = target.toLocaleString("ru-RU");
    return;
  }

  const from = displayedCount;
  const diff = target - from;
  if (diff === 0) return;

  cancelAnimationFrame(countAnim);
  els.catalogStat?.classList.add("pulse");
  const start = performance.now();
  const dur = Math.min(900, 280 + Math.abs(diff) * 12);

  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    displayedCount = Math.round(from + diff * eased);
    els.catalogCount.textContent = displayedCount.toLocaleString("ru-RU");
    if (t < 1) {
      countAnim = requestAnimationFrame(tick);
    } else {
      displayedCount = target;
      els.catalogCount.textContent = target.toLocaleString("ru-RU");
      setTimeout(() => els.catalogStat?.classList.remove("pulse"), 220);
    }
  };
  countAnim = requestAnimationFrame(tick);
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»""„]/g, '"')
    .replace(/[-—–_/.,!?:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(q) {
  return normalize(q).split(" ").filter(Boolean);
}

function expandToken(token) {
  const n = normalize(token);
  if (!n) return [];
  const out = new Set([n]);
  for (const group of SYNONYM_GROUPS) {
    const hit = group.some(
      (g) => n === g || (n.length >= 2 && (n.startsWith(g) || g.startsWith(n)))
    );
    if (hit) group.forEach((g) => out.add(g));
  }
  return [...out];
}

/** Левенштейн, обрезанный по лимиту — для опечаток */
function editDistance(a, b, limit = 2) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > limit) return limit + 1;
  if (!la) return lb;
  if (!lb) return la;

  let prev = new Array(lb + 1);
  let curr = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > limit) return limit + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

function fuzzyTokenScore(token, hay) {
  if (!token || !hay) return -1;
  if (hay === token) return 100;
  if (hay.startsWith(token)) return 78;
  if (hay.includes(token)) return 52;

  const words = hay.split(" ");
  for (const w of words) {
    if (w.startsWith(token)) return 70;
    if (token.length >= 3 && w.includes(token)) return 48;

    if (token.length >= 3) {
      const maxDist = token.length <= 4 ? 1 : token.length <= 7 ? 2 : 2;
      const slice = w.slice(0, Math.max(token.length, Math.min(w.length, token.length + 1)));
      const d1 = editDistance(token, slice, maxDist);
      if (d1 <= maxDist) return 36 - d1 * 6;
      if (w.length <= token.length + 2) {
        const d2 = editDistance(token, w, maxDist);
        if (d2 <= maxDist) return 30 - d2 * 5;
      }
    }
  }
  return -1;
}

function scoreAgainst(hay, forms) {
  let best = -1;
  let viaSynonym = false;
  for (const f of forms) {
    const part = fuzzyTokenScore(f, hay);
    if (part > best) {
      best = part;
      viaSynonym = f !== forms[0];
    }
  }
  return { best, viaSynonym };
}

function scoreItem(item, tokens) {
  if (!tokens.length) return { score: -1, fuzzy: false };
  const name = normalize(item.name);
  const desc = normalize(item.description);
  let score = 0;
  let fuzzy = false;

  for (const t of tokens) {
    const forms = expandToken(t);
    let { best: part, viaSynonym } = scoreAgainst(name, forms);
    if (part < 0 && desc) {
      const d = scoreAgainst(desc, forms);
      if (d.best > 0) {
        part = d.best * 0.35;
        viaSynonym = viaSynonym || d.viaSynonym;
      }
    }
    if (part < 0) return { score: -1, fuzzy: false };
    if (part < 40 || viaSynonym) fuzzy = true;
    score += part;
  }

  score += Math.max(0, 16 - name.length * 0.12);
  return { score, fuzzy };
}

function formatPrice(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("ru-RU")} монет`;
}

function formatPriceShort(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("ru-RU");
}

function proxyImage(url) {
  if (!url) return "";
  if (url.startsWith("data/") || url.startsWith("./data/") || url.startsWith("/data/")) {
    return url.startsWith("/") ? url : `./${url.replace(/^\.\//, "")}`;
  }
  if (url.includes("parapa.ru")) {
    return `/proxy?u=${encodeURIComponent(url)}`;
  }
  return url;
}

function itemThumb(item) {
  return item.imageLocal || item.image || "";
}

function itemLook(item) {
  if (!item) return "";
  // локальный файл — ок; remote только если скачивание не помечено как failed
  if (item.lookLocal) return item.lookLocal;
  if (item.lookUnavailable) return "";
  return item.lookImage || "";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemOnSale(item) {
  return Boolean(
    item.onSale || (item.priceOld != null && item.priceOld > item.price)
  );
}

function briefDesc(text, max = 140) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

function passesFilters(item) {
  if (state.showFavs && !isFav(item.id)) return false;
  if (state.showSale && !itemOnSale(item)) return false;
  return true;
}

function browseMode() {
  return state.showFavs || state.showSale;
}

function discountAmount(item) {
  if (item.priceOld == null || item.priceOld <= item.price) return 0;
  return item.priceOld - item.price;
}

function sortRanked(list, hasQuery) {
  const byName = (a, b) => a.item.name.localeCompare(b.item.name, "ru");
  const mode = state.sort;

  list.sort((a, b) => {
    switch (mode) {
      case "price-asc":
        return a.item.price - b.item.price || byName(a, b);
      case "price-desc":
        return b.item.price - a.item.price || byName(a, b);
      case "discount":
        return (
          discountAmount(b.item) - discountAmount(a.item) ||
          a.item.price - b.item.price ||
          byName(a, b)
        );
      case "name":
        return byName(a, b);
      case "relevance":
      default:
        if (hasQuery) return b.score - a.score || byName(a, b);
        if (state.showSale) {
          return (
            discountAmount(b.item) - discountAmount(a.item) || byName(a, b)
          );
        }
        return byName(a, b);
    }
  });
  return list;
}

function filtered() {
  const tokens = tokenize(state.query);
  const hasQuery = Boolean(tokens.length);

  if (!hasQuery) {
    if (!browseMode()) return [];
    return sortRanked(
      state.items
        .filter(passesFilters)
        .map((item) => ({ item, score: 1, fuzzy: false })),
      false
    ).slice(0, 80);
  }

  return sortRanked(
    state.items
      .map((item) => {
        const { score, fuzzy } = scoreItem(item, tokens);
        return { item, score, fuzzy };
      })
      .filter((x) => x.score >= 0 && passesFilters(x.item)),
    true
  ).slice(0, 40);
}

function isCoarsePointer() {
  return window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

function prefersReducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Предзагрузка картинок — при прокрутке списка превью открывается из кэша */
const warmMap = new Map();

function warmImage(url) {
  const src = proxyImage(url);
  if (!src || warmMap.has(src)) return;
  warmMap.set(src, "loading");
  const img = new Image();
  img.decoding = "async";
  img.onload = () => warmMap.set(src, "ready");
  img.onerror = () => warmMap.set(src, "ready");
  img.src = src;
}

function isWarmed(src) {
  return warmMap.get(src) === "ready";
}

function warmItem(item) {
  if (!item) return;
  warmImage(itemThumb(item));
  warmImage(itemLook(item));
}

function warmAround(index, radius = 5) {
  if (!state.list.length) return;
  const from = Math.max(0, index - 1);
  const to = Math.min(state.list.length - 1, index + radius);
  for (let i = from; i <= to; i++) warmItem(state.list[i].item);
}

function hideBrokenLookFrame(root, frame) {
  if (!frame) return;
  const isLook =
    frame.classList.contains("preview-look-frame") ||
    frame.classList.contains("cat-card-look-frame");
  if (!isLook) return;
  frame.remove();
  root.querySelector(".preview-card")?.classList.remove("has-look");
  root.querySelector(".cat-card-media")?.classList.remove("has-look");
}

function wireMediaFrames(root) {
  if (!root) return;
  root.querySelectorAll(".media-frame img").forEach((img) => {
    const frame = img.closest(".media-frame");
    if (!frame) return;
    const done = () => {
      frame.classList.remove("is-loading");
      frame.classList.add("is-ready");
      if (img.currentSrc || img.src) warmMap.set(img.currentSrc || img.src, "ready");
    };
    const fail = () => {
      frame.classList.remove("is-loading");
      if (
        frame.classList.contains("preview-look-frame") ||
        frame.classList.contains("cat-card-look-frame")
      ) {
        hideBrokenLookFrame(root, frame);
        return;
      }
      frame.classList.add("is-ready");
    };
    if (img.complete) {
      if (img.naturalWidth > 0) done();
      else fail();
      return;
    }
    if (isWarmed(img.getAttribute("src") || "")) {
      // уже в кэше — показываем сразу, без долгого скелетона
      requestAnimationFrame(() => {
        if (img.complete) {
          if (img.naturalWidth > 0) done();
          else fail();
        } else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", fail, { once: true });
        }
      });
      return;
    }
    frame.classList.add("is-loading");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", fail, { once: true });
  });
}

function previewEmptyHtml() {
  let tip = isCoarsePointer() ? "Выберите название" : "Наведите на название";
  if (!tokenize(state.query).length) {
    if (state.showFavs && state.showSale) tip = "Избранное со скидкой";
    else if (state.showFavs) tip = "Выберите из избранного";
    else if (state.showSale) tip = "Выберите скидку";
  }
  return `
    <div class="preview-empty">
      <span class="preview-empty-dot" aria-hidden="true"></span>
      <p class="preview-empty-text">${tip}</p>
    </div>`;
}

function itemUnavailable(item) {
  return Boolean(item && item.unavailable);
}

function previewCardHtml(item) {
  const sale = itemOnSale(item);
  const gone = itemUnavailable(item);
  const old =
    item.priceOld && item.priceOld > item.price
      ? `<span class="preview-old">${escapeHtml(formatPrice(item.priceOld))}</span>`
      : "";
  const desc = briefDesc(item.description);
  const fav = isFav(item.id);
  const thumb = itemThumb(item);
  const look = itemLook(item);
  const thumbSrcRaw = thumb ? proxyImage(thumb) : "";
  const lookSrcRaw = look ? proxyImage(look) : "";
  const thumbSrc = thumbSrcRaw ? escapeHtml(thumbSrcRaw) : "";
  const lookSrc = lookSrcRaw ? escapeHtml(lookSrcRaw) : "";
  const thumbState = thumbSrcRaw && isWarmed(thumbSrcRaw) ? "is-ready" : "is-loading";
  const lookState = lookSrcRaw && isWarmed(lookSrcRaw) ? "is-ready" : "is-loading";
  const lookHtml = look
    ? `<span class="media-frame preview-look-frame ${lookState}">
        <img class="preview-look" src="${lookSrc}" alt="Как выглядит" decoding="async" fetchpriority="high" />
      </span>`
    : "";
  const thumbHtml = thumbSrc
    ? `<span class="media-frame preview-thumb-frame ${thumbState}">
        <img class="preview-thumb" src="${thumbSrc}" alt="" decoding="async" fetchpriority="high" />
      </span>`
    : "";

  return `
    <div class="preview-card${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}${desc ? " has-desc" : ""}${look ? " has-look" : ""}">
      <button
        type="button"
        class="fav-btn${fav ? " on" : ""}"
        data-fav="${item.id}"
        aria-pressed="${fav ? "true" : "false"}"
        aria-label="${fav ? "Убрать из избранного" : "В избранное"}"
        title="${fav ? "Убрать из избранного" : "В избранное"}"
      >★</button>
      ${gone ? `<span class="gone-badge">нет в продаже</span>` : ""}
      ${!gone && sale ? `<span class="sale-badge">скидка</span>` : ""}
      <div class="preview-media">
        ${thumbHtml}
        ${lookHtml}
      </div>
      <div class="preview-body">
        ${desc ? `<p class="preview-desc">${escapeHtml(desc)}</p>` : `<p class="preview-desc preview-desc-empty" aria-hidden="true"></p>`}
        <div class="preview-prices">
          <span class="preview-price">${escapeHtml(formatPrice(item.price))}</span>
          ${old}
        </div>
        ${gone ? `<p class="preview-gone-note">Сейчас этого товара нет в продаже на сайте</p>` : ""}
        <a class="preview-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Открыть на сайте</a>
      </div>
    </div>`;
}

let previewFadeTimer = null;

function showPreview(item) {
  if (!els.preview) return;
  if (item) {
    state.activeId = item.id;
    warmItem(item);
  }

  const html = item ? previewCardHtml(item) : previewEmptyHtml();
  const reduce = prefersReducedMotion();
  const layers = [...els.preview.querySelectorAll(".preview-layer")];

  // если обе картинки уже в кэше — без длинного crossfade, быстрее отклик
  const bothReady =
    item &&
    (!itemThumb(item) || isWarmed(proxyImage(itemThumb(item)))) &&
    (!itemLook(item) || isWarmed(proxyImage(itemLook(item))));

  if (reduce || !layers.length || bothReady) {
    els.preview.innerHTML = `<div class="preview-layer is-in">${html}</div>`;
    wireMediaFrames(els.preview);
    return;
  }

  layers.forEach((layer) => {
    layer.classList.remove("is-in");
    layer.classList.add("is-out");
  });

  const next = document.createElement("div");
  next.className = "preview-layer is-in";
  next.innerHTML = html;
  els.preview.appendChild(next);
  wireMediaFrames(next);

  clearTimeout(previewFadeTimer);
  previewFadeTimer = setTimeout(() => {
    layers.forEach((layer) => layer.remove());
  }, 220);
}

function selectByIndex(index, scroll = true) {
  if (!state.list.length) return;
  const i = Math.max(0, Math.min(state.list.length - 1, index));
  const entry = state.list[i];
  const same = state.activeId === entry.item.id;

  warmAround(i);

  // тот же пункт — не трогаем превью (иначе мигает при движении мыши по строке)
  if (!same) {
    state.activeId = entry.item.id;
    showPreview(entry.item);
  }

  const buttons = [...els.results.querySelectorAll(".result[data-id]")];
  buttons.forEach((btn) => {
    const on = Number(btn.dataset.id) === entry.item.id;
    btn.classList.toggle("active", on);
    if (on && scroll && !same) {
      btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });
}

function emptyMessage(hasQuery) {
  if (!hasQuery && state.showFavs && state.showSale) {
    return "В избранном нет скидок";
  }
  if (!hasQuery && state.showFavs) return "В избранном пока пусто";
  if (!hasQuery && state.showSale) return "Скидок пока нет в каталоге";
  if (state.showFavs && state.showSale) return "Ничего не найдено среди избранных скидок";
  if (state.showFavs) return "В избранном ничего не найдено";
  if (state.showSale) return "Среди скидок ничего не найдено";
  return "Ничего не найдено";
}

function render() {
  const ranked = filtered();
  state.list = ranked;
  const hasQuery = Boolean(tokenize(state.query).length);
  const showStage = hasQuery || browseMode();

  els.hint.hidden = showStage;
  els.stage.hidden = !showStage;
  document.body.classList.toggle("is-stage", showStage);
  updateFiltersUi();
  if (els.resultsCount) {
    els.resultsCount.textContent = String(ranked.length);
  }

  if (!showStage) {
    els.results.innerHTML = "";
    showPreview(null);
    state.activeId = null;
    return;
  }

  if (!ranked.length) {
    els.results.innerHTML = `<li><div class="result result-empty">${emptyMessage(hasQuery)}</div></li>`;
    showPreview(null);
    state.activeId = null;
    return;
  }

  els.results.innerHTML = ranked
    .map(({ item, fuzzy }) => {
      const sale = itemOnSale(item);
      const gone = itemUnavailable(item);
      const fav = isFav(item.id);
      return `
      <li>
        <div class="result-row">
          <button
            type="button"
            class="result${state.activeId === item.id ? " active" : ""}${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}"
            data-id="${item.id}"
          >
            <span class="result-main">
              <span class="result-name">${escapeHtml(item.name)}</span>
              <span class="result-price${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}">${escapeHtml(formatPriceShort(item.price))}</span>
            </span>
            <span class="result-meta">
              ${gone ? `<span class="result-gone">нет в продаже</span>` : ""}
              ${!gone && sale ? `<span class="result-sale">скидка</span>` : ""}
              ${fuzzy ? `<span class="result-tag">похоже</span>` : ""}
            </span>
          </button>
          <button
            type="button"
            class="result-fav${fav ? " on" : ""}"
            data-fav="${item.id}"
            aria-pressed="${fav ? "true" : "false"}"
            aria-label="${fav ? "Убрать из избранного" : "В избранное"}"
            title="${fav ? "Убрать из избранного" : "В избранное"}"
          >★</button>
        </div>
      </li>`;
    })
    .join("");

  // прогрев первых картинок сразу после выдачи
  ranked.slice(0, 12).forEach((x) => warmItem(x.item));

  const still = ranked.find((x) => x.item.id === state.activeId) || ranked[0];
  selectByIndex(
    ranked.findIndex((x) => x.item.id === still.item.id),
    false
  );
}

function setMenuOpen(open) {
  const on = Boolean(open);
  document.body.classList.toggle("menu-open", on);
  els.sideMenu?.classList.toggle("is-open", on);
  els.sideMenu?.setAttribute("aria-hidden", on ? "false" : "true");
  els.menuOpen?.setAttribute("aria-expanded", on ? "true" : "false");
  if (els.menuBackdrop) {
    els.menuBackdrop.hidden = !on;
  }
}

function bind() {
  els.menuOpen?.addEventListener("click", () => setMenuOpen(true));
  els.menuClose?.addEventListener("click", () => setMenuOpen(false));
  els.menuBackdrop?.addEventListener("click", () => setMenuOpen(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  // свайп от левого края — открыть; в меню влево — закрыть
  let touchX0 = null;
  let touchFromEdge = false;
  document.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      if (!t) return;
      touchX0 = t.clientX;
      touchFromEdge = t.clientX <= 22;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      if (!t || touchX0 == null) return;
      const dx = t.clientX - touchX0;
      const menuOpen = document.body.classList.contains("menu-open");
      if (!menuOpen && touchFromEdge && dx > 48) setMenuOpen(true);
      if (menuOpen && dx < -48) setMenuOpen(false);
      touchX0 = null;
      touchFromEdge = false;
    },
    { passive: true }
  );

  els.themeToggle?.addEventListener("click", () => {
    setTheme(nextTheme(currentTheme()));
  });

  els.bgPicks?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bg]");
    if (!btn) return;
    setBg(btn.dataset.bg);
  });

  els.favsToggle?.addEventListener("click", () => {
    state.showFavs = !state.showFavs;
    render();
  });

  els.saleToggle?.addEventListener("click", () => {
    state.showSale = !state.showSale;
    render();
  });

  els.sortPills?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort]");
    if (!btn) return;
    const next = btn.dataset.sort;
    if (!SORT_MODES.includes(next) || next === state.sort) return;
    state.sort = next;
    persistSort();
    state.activeId = null;
    render();
  });

  els.q.addEventListener("input", () => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      state.query = els.q.value;
      state.activeId = null;
      render();
    }, 50);
  });

  els.results.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const row = e.target.closest(".result-row");
    if (!row) return;
    // игнор, если курсор остался внутри той же строки (имя ↔ цена ↔ ★)
    const from = e.relatedTarget;
    if (from && row.contains(from)) return;
    const btn = row.querySelector(".result[data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (state.activeId === id) return;
    const idx = state.list.findIndex((x) => x.item.id === id);
    if (idx >= 0) selectByIndex(idx, false);
  });

  els.results.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = Number(favBtn.dataset.fav);
      toggleFav(id);
      favBtn.classList.toggle("on", isFav(id));
      favBtn.setAttribute("aria-pressed", isFav(id) ? "true" : "false");
      const cardFav = els.preview.querySelector(`[data-fav="${id}"]`);
      if (cardFav) {
        cardFav.classList.toggle("on", isFav(id));
        cardFav.setAttribute("aria-pressed", isFav(id) ? "true" : "false");
      }
      if (browseMode()) render();
      return;
    }
    const btn = e.target.closest(".result[data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const idx = state.list.findIndex((x) => x.item.id === id);
    if (idx < 0) return;
    // на тач: первый тап — превью, повторный — открыть сайт
    if (isCoarsePointer() && state.activeId !== id) {
      selectByIndex(idx, true);
      return;
    }
    selectByIndex(idx, false);
    window.open(state.list[idx].item.url, "_blank", "noopener");
  });

  els.preview.addEventListener("click", (e) => {
    const favBtn = e.target.closest("[data-fav]");
    if (!favBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = Number(favBtn.dataset.fav);
    toggleFav(id);
    favBtn.classList.toggle("on", isFav(id));
    favBtn.setAttribute("aria-pressed", isFav(id) ? "true" : "false");
    favBtn.setAttribute(
      "aria-label",
      isFav(id) ? "Убрать из избранного" : "В избранное"
    );
    favBtn.title = isFav(id) ? "Убрать из избранного" : "В избранное";
    const listFav = els.results.querySelector(`[data-fav="${id}"]`);
    if (listFav) {
      listFav.classList.toggle("on", isFav(id));
      listFav.setAttribute("aria-pressed", isFav(id) ? "true" : "false");
    }
    if (browseMode()) render();
  });

  // ПК: доп. картинка увеличивается при наведении
  els.preview.addEventListener("mouseover", (e) => {
    if (isCoarsePointer()) return;
    const frame = e.target.closest(".preview-look-frame");
    if (!frame || !els.preview.contains(frame)) return;
    els.preview.querySelectorAll(".preview-look-frame.is-open").forEach((f) => {
      if (f !== frame) f.classList.remove("is-open");
    });
    frame.classList.add("is-open");
  });
  els.preview.addEventListener("mouseout", (e) => {
    const frame = e.target.closest(".preview-look-frame");
    if (!frame) return;
    const next = e.relatedTarget?.closest?.(".preview-look-frame");
    if (next === frame) return;
    frame.classList.remove("is-open");
  });
}

async function load(isRefresh = false) {
  try {
    const res = await fetch("./data/items.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const next = data.items || [];
    const prevLen = state.items.length;
    state.items = next;
    setCatalogCount(next.length, isRefresh || prevLen > 0);
    if (!isRefresh) {
      els.hint.textContent = next.length
        ? "Начните вводить название"
        : "Каталог пока пуст — идёт сбор";
    }
    if (isRefresh && (tokenize(state.query).length || browseMode())) render();
  } catch {
    if (!isRefresh) {
      els.hint.textContent = "Не удалось загрузить каталог";
      setCatalogCount(0, false);
    }
  }
}

setTheme(currentTheme());
setBg(currentBg());
updateFiltersUi();
bind();
syncFavs().finally(() => load(false));
setInterval(() => load(true), 15000);

const boot = () => playBootGlitch();
if (document.readyState === "complete") {
  setTimeout(boot, 180);
} else {
  window.addEventListener("load", () => setTimeout(boot, 180), { once: true });
}

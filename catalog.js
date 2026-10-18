const THEME_KEY = "futurum_theme";
const SORT_KEY = "futurum_catalog_sort";
const SORT_MODES = ["name", "price-asc", "price-desc", "discount"];

const state = {
  items: [],
  history: {},
  query: "",
  activeId: null,
  list: [],
  favs: (window.FavStore && FavStore.loadLocal()) || new Set(),
  showFavs: false,
  showSale: false,
  sort: loadSort(),
};

const els = {
  catQ: document.getElementById("catQ"),
  catList: document.getElementById("catList"),
  catDetail: document.getElementById("catDetail"),
  catTotal: document.getElementById("catTotal"),
  catFound: document.getElementById("catFound"),
  themeToggle: document.getElementById("themeToggle"),
  saleToggle: document.getElementById("saleToggle"),
  favsToggle: document.getElementById("favsToggle"),
  favsCount: document.getElementById("favsCount"),
  sortPills: document.getElementById("sortPills"),
};

function loadSort() {
  try {
    const s = localStorage.getItem(SORT_KEY);
    if (SORT_MODES.includes(s)) return s;
  } catch {
    /* ignore */
  }
  return "name";
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
}

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function setTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* ignore */
  }
  if (els.themeToggle) {
    const isDark = next === "dark";
    els.themeToggle.setAttribute(
      "aria-label",
      isDark ? "Включить светлую тему" : "Включить тёмную тему"
    );
    els.themeToggle.setAttribute("aria-checked", isDark ? "true" : "false");
  }
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[-—–_/.,!?:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(q) {
  return normalize(q).split(" ").filter(Boolean);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("ru-RU")} монет`;
}

function formatPriceShort(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("ru-RU");
}

function formatDate(ts) {
  try {
    return new Date(Number(ts) * 1000).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
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
  return item.lookLocal || item.lookImage || "";
}

function itemOnSale(item) {
  return Boolean(
    item.onSale || (item.priceOld != null && item.priceOld > item.price)
  );
}

function itemUnavailable(item) {
  return Boolean(item && item.unavailable);
}

function discountAmount(item) {
  if (item.priceOld == null || item.priceOld <= item.price) return 0;
  return item.priceOld - item.price;
}

function passesFilters(item) {
  if (state.showFavs && !isFav(item.id)) return false;
  if (state.showSale && !itemOnSale(item)) return false;
  return true;
}

function matchesQuery(item, tokens) {
  if (!tokens.length) return true;
  const hay = `${normalize(item.name)} ${normalize(item.description)}`;
  return tokens.every((t) => hay.includes(t));
}

function filtered() {
  const tokens = tokenize(state.query);
  const list = state.items.filter(
    (item) => passesFilters(item) && matchesQuery(item, tokens)
  );
  const byName = (a, b) => a.name.localeCompare(b.name, "ru");
  list.sort((a, b) => {
    switch (state.sort) {
      case "price-asc":
        return a.price - b.price || byName(a, b);
      case "price-desc":
        return b.price - a.price || byName(a, b);
      case "discount":
        return discountAmount(b) - discountAmount(a) || a.price - b.price || byName(a, b);
      case "name":
      default:
        return byName(a, b);
    }
  });
  return list;
}

function updateFiltersUi() {
  if (els.favsCount) els.favsCount.textContent = String(state.favs.size);
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

function historyFor(id) {
  const series = state.history[String(id)] || [];
  return Array.isArray(series) ? series : [];
}

function sparkSvg(series) {
  if (!series.length) return "";
  const prices = series.map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return "";
  const w = 320;
  const h = 120;
  const pad = 12;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);
  const pts = prices.map((price, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, prices.length - 1);
    const y = h - pad - ((price - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fill = `${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#3dffe0";
  return `
    <svg class="cat-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="График цены">
      <polyline points="${fill}" fill="${accent}22" stroke="none" />
      <polyline points="${pts.join(" ")}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      ${prices.length === 1 ? `<circle cx="${pad}" cy="${h / 2}" r="4" fill="${accent}" />` : ""}
    </svg>`;
}

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
    if (img.complete && img.naturalWidth > 0) {
      done();
      return;
    }
    if (isWarmed(img.getAttribute("src") || "")) {
      requestAnimationFrame(() => {
        if (img.complete) done();
        else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
      });
      return;
    }
    frame.classList.add("is-loading");
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  });
}

function showDetail(item) {
  if (!els.catDetail) return;
  if (!item) {
    els.catDetail.innerHTML =
      '<div class="cat-detail-empty">Выберите предмет — увидите цену и историю</div>';
    return;
  }
  const sale = itemOnSale(item);
  const gone = itemUnavailable(item);
  const thumb = itemThumb(item);
  const look = itemLook(item);
  const series = historyFor(item.id);
  const prices = series.map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
  const minP = prices.length ? Math.min(...prices) : item.price;
  const maxP = prices.length ? Math.max(...prices) : item.price;
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  let deltaHtml = "";
  if (prev && last && Number.isFinite(last.price) && Number.isFinite(prev.price)) {
    const d = last.price - prev.price;
    if (d !== 0) {
      const sign = d > 0 ? "+" : "";
      deltaHtml = `<span>изм. <b>${sign}${d.toLocaleString("ru-RU")}</b></span>`;
    }
  }

  const rows = [...series]
    .reverse()
    .slice(0, 12)
    .map(
      (p) => `
      <tr>
        <td>${escapeHtml(formatDate(p.t))}</td>
        <td>${escapeHtml(formatPriceShort(p.price))}</td>
        <td>${p.priceOld != null ? escapeHtml(formatPriceShort(p.priceOld)) : "—"}</td>
      </tr>`
    )
    .join("");

  els.catDetail.innerHTML = `
    <div class="cat-card${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}">
      <div class="cat-card-top">
        <div class="cat-card-media${look ? " has-look" : ""}">
          ${
            thumb
              ? `<span class="media-frame cat-card-thumb-frame is-loading"><img class="cat-card-thumb" src="${escapeHtml(proxyImage(thumb))}" alt="" decoding="async" /></span>`
              : `<div class="cat-item-thumb empty" aria-hidden="true"></div>`
          }
          ${
            look
              ? `<span class="media-frame cat-card-look-frame is-loading"><img class="cat-card-look" src="${escapeHtml(proxyImage(look))}" alt="Как выглядит" decoding="async" /></span>`
              : ""
          }
        </div>
        <div>
          <h2 class="cat-card-title">${escapeHtml(item.name)}</h2>
          <div class="cat-card-prices">
            <span class="cat-card-price">${escapeHtml(formatPrice(item.price))}</span>
            ${
              item.priceOld && item.priceOld > item.price
                ? `<span class="cat-card-old">${escapeHtml(formatPrice(item.priceOld))}</span>`
                : ""
            }
            ${gone ? `<span class="cat-tag cat-tag-gone">нет в продаже</span>` : ""}
            ${!gone && sale ? `<span class="cat-tag">скидка</span>` : ""}
          </div>
          ${gone ? `<p class="cat-gone-note">Сейчас этого товара нет в продаже на сайте</p>` : ""}
          ${
            item.description
              ? `<p class="cat-card-desc">${escapeHtml(item.description)}</p>`
              : ""
          }
          <div class="cat-card-actions">
            <a class="cat-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Открыть на сайте</a>
            <button type="button" class="chip-toggle${isFav(item.id) ? " on" : ""}" data-fav="${item.id}" aria-pressed="${isFav(item.id) ? "true" : "false"}">
              ★ ${isFav(item.id) ? "В избранном" : "В избранное"}
            </button>
          </div>
        </div>
      </div>
      <div class="cat-history">
        <h3>История цены</h3>
        ${
          series.length
            ? `
          <div class="cat-history-stats">
            <span>мин. <b>${escapeHtml(formatPriceShort(minP))}</b></span>
            <span>макс. <b>${escapeHtml(formatPriceShort(maxP))}</b></span>
            <span>точек <b>${series.length}</b></span>
            ${deltaHtml}
          </div>
          ${sparkSvg(series)}
          <table class="cat-history-table">
            <thead><tr><th>Когда</th><th>Цена</th><th>Было</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          ${
            series.length < 2
              ? `<p class="cat-history-empty">Пока одна точка — дополнится при обновлении каталога</p>`
              : ""
          }`
            : `<p class="cat-history-empty">История цены начнёт копиться при обновлении каталога</p>`
        }
      </div>
    </div>
  `;
  els.catDetail.scrollTop = 0;
  wireMediaFrames(els.catDetail);
}

function renderList() {
  const list = filtered();
  state.list = list;
  if (els.catFound) els.catFound.textContent = String(list.length);
  if (els.catTotal) els.catTotal.textContent = String(state.items.length);

  if (!list.length) {
    els.catList.innerHTML = `<li class="cat-list-empty">Ничего не найдено</li>`;
    if (!list.find((i) => i.id === state.activeId)) {
      state.activeId = null;
      showDetail(null);
    }
    return;
  }

  // прогрев видимой части списка заранее
  list.slice(0, 40).forEach((item) => warmItem(item));

  els.catList.innerHTML = list
    .map((item, index) => {
      const sale = itemOnSale(item);
      const gone = itemUnavailable(item);
      const fav = isFav(item.id);
      const thumb = itemThumb(item);
      const src = thumb ? proxyImage(thumb) : "";
      const ready = src && isWarmed(src);
      const img = thumb
        ? `<span class="media-frame cat-item-thumb-frame ${ready ? "is-ready" : "is-loading"}"><img class="cat-item-thumb" src="${escapeHtml(src)}" alt="" loading="${index < 36 ? "eager" : "lazy"}" decoding="async" /></span>`
        : `<span class="cat-item-thumb empty" aria-hidden="true">·</span>`;
      return `
      <li>
        <div class="cat-row">
          <button type="button" class="cat-item${state.activeId === item.id ? " active" : ""}${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}" data-id="${item.id}">
            ${img}
            <span class="cat-item-main">
              <span class="cat-item-name">${escapeHtml(item.name)}</span>
              <span class="cat-item-meta">
                <span class="cat-item-price">${escapeHtml(formatPriceShort(item.price))}</span>
                ${
                  item.priceOld && item.priceOld > item.price
                    ? `<span class="cat-item-old">${escapeHtml(formatPriceShort(item.priceOld))}</span>`
                    : ""
                }
                ${gone ? `<span class="cat-tag cat-tag-gone">нет в продаже</span>` : ""}
                ${!gone && sale ? `<span class="cat-tag">скидка</span>` : ""}
              </span>
            </span>
          </button>
          <button type="button" class="cat-fav${fav ? " on" : ""}" data-fav="${item.id}" aria-pressed="${fav ? "true" : "false"}" aria-label="Избранное">★</button>
        </div>
      </li>`;
    })
    .join("");

  wireMediaFrames(els.catList);

  const still = list.find((i) => i.id === state.activeId) || list[0];
  state.activeId = still.id;
  warmItem(still);
  const idx = list.findIndex((i) => i.id === still.id);
  for (let i = Math.max(0, idx - 2); i <= Math.min(list.length - 1, idx + 8); i++) {
    warmItem(list[i]);
  }
  showDetail(still);
  const activeBtn = els.catList.querySelector(`.cat-item[data-id="${still.id}"]`);
  activeBtn?.classList.add("active");
}

function render() {
  updateFiltersUi();
  renderList();
}

function bind() {
  els.themeToggle?.addEventListener("click", () => {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  els.saleToggle?.addEventListener("click", () => {
    state.showSale = !state.showSale;
    render();
  });

  els.favsToggle?.addEventListener("click", () => {
    state.showFavs = !state.showFavs;
    render();
  });

  els.sortPills?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sort]");
    if (!btn) return;
    const next = btn.dataset.sort;
    if (!SORT_MODES.includes(next) || next === state.sort) return;
    state.sort = next;
    persistSort();
    render();
  });

  let t = null;
  els.catQ?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = els.catQ.value;
      state.activeId = null;
      render();
    }, 40);
  });

  els.catList?.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      e.preventDefault();
      e.stopPropagation();
      const id = Number(fav.dataset.fav);
      toggleFav(id);
      if (state.showFavs) render();
      else {
        updateFiltersUi();
        fav.classList.toggle("on", isFav(id));
        if (state.activeId === id) showDetail(state.items.find((i) => i.id === id));
      }
      return;
    }
    const btn = e.target.closest(".cat-item[data-id]");
    if (!btn) return;
    state.activeId = Number(btn.dataset.id);
    els.catList.querySelectorAll(".cat-item").forEach((b) => {
      b.classList.toggle("active", Number(b.dataset.id) === state.activeId);
    });
    showDetail(state.items.find((i) => i.id === state.activeId));
  });

  els.catDetail?.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-fav]");
    if (!fav) return;
    const id = Number(fav.dataset.fav);
    toggleFav(id);
    render();
  });
}

async function load() {
  try {
    const [itemsRes, histRes] = await Promise.all([
      fetch("./data/items.json", { cache: "no-store" }),
      fetch("./data/price_history.json", { cache: "no-store" }),
    ]);
    if (!itemsRes.ok) throw new Error(String(itemsRes.status));
    const data = await itemsRes.json();
    state.items = data.items || [];
    if (histRes.ok) {
      state.history = await histRes.json();
    }
    const params = new URLSearchParams(location.search);
    const id = Number(params.get("id"));
    if (Number.isFinite(id) && state.items.some((i) => i.id === id)) {
      state.activeId = id;
    }
    render();
  } catch {
    if (els.catList) {
      els.catList.innerHTML = `<li class="cat-list-empty">Не удалось загрузить каталог</li>`;
    }
  }
}

function playBootGlitch() {
  const brand = document.querySelector(".cat-brand");
  if (!brand) return;
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  // спокойно → короткий дрыг → снова спокойно
  setTimeout(() => {
    brand.classList.add("boot-glitch");
    setTimeout(() => brand.classList.remove("boot-glitch"), 680);
  }, 1500);

  const pulse = () => {
    if (document.hidden) return;
    brand.classList.add("boot-glitch");
    setTimeout(() => brand.classList.remove("boot-glitch"), 480);
    setTimeout(pulse, 9000 + Math.random() * 10000);
  };
  setTimeout(pulse, 9000 + Math.random() * 4000);
}

setTheme(currentTheme());
bind();
syncFavs().finally(() => load());

const boot = () => playBootGlitch();
if (document.readyState === "complete") {
  setTimeout(boot, 180);
} else {
  window.addEventListener("load", () => setTimeout(boot, 180), { once: true });
}

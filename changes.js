/** Лента изменений каталога: история всегда видна, «прочитано» только снимает бейдж */
(() => {
  const SEEN_KEY = "futurum_changes_seen";
  const KNOWN_KEY = "futurum_known_ids";
  const NEW_LOG_KEY = "futurum_new_log";
  const MAX_EVENTS = 300;
  const MAX_SEEN = 800;

  let events = [];
  let itemsById = new Map();
  let seen = loadSeen();
  let panelOpen = false;
  let openKey = "";

  const els = {
    bar: null,
    btn: null,
    count: null,
    panel: null,
    list: null,
    markBtn: null,
    closeBtn: null,
  };

  function loadSeen() {
    try {
      const raw = localStorage.getItem(SEEN_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr.map(String) : []);
    } catch {
      return new Set();
    }
  }

  function saveSeen() {
    try {
      let keys = [...seen];
      if (keys.length > MAX_SEEN) keys = keys.slice(-MAX_SEEN);
      localStorage.setItem(SEEN_KEY, JSON.stringify(keys));
    } catch {
      /* ignore */
    }
  }

  function loadNewLog() {
    try {
      const raw = JSON.parse(localStorage.getItem(NEW_LOG_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveNewLog(log) {
    try {
      localStorage.setItem(NEW_LOG_KEY, JSON.stringify(log.slice(-200)));
    } catch {
      /* ignore */
    }
  }

  function formatPrice(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return `${Number(n).toLocaleString("ru-RU")} монет`;
  }

  function formatPriceNum(n) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return String(Math.round(Number(n)));
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

  function itemThumbSrc(it) {
    if (!it) return "";
    return proxyImage(it.imageLocal || it.image || "");
  }

  function itemLookSrc(it) {
    if (!it) return "";
    if (it.lookLocal) return proxyImage(it.lookLocal);
    if (it.lookUnavailable) return "";
    return proxyImage(it.lookImage || "");
  }

  function thumbsHtml(it, big = false) {
    const thumb = itemThumbSrc(it);
    const look = itemLookSrc(it);
    if (!big) {
      // в списке — одна иконка фиксированного размера, чтобы строки были ровные
      const src = thumb || look;
      if (!src) {
        return `<span class="changes-thumbs changes-thumbs-empty" aria-hidden="true"></span>`;
      }
      return `
        <span class="changes-thumbs" aria-hidden="true">
          <img class="changes-thumb" src="${escapeAttr(src)}" alt="" loading="lazy" decoding="async" />
        </span>`;
    }
    if (!thumb && !look) {
      return `<span class="changes-thumbs is-big changes-thumbs-empty" aria-hidden="true"></span>`;
    }
    return `
      <span class="changes-thumbs is-big" aria-hidden="true">
        ${thumb ? `<img class="changes-thumb" src="${escapeAttr(thumb)}" alt="" loading="lazy" decoding="async" />` : ""}
        ${look ? `<img class="changes-look" src="${escapeAttr(look)}" alt="" loading="lazy" decoding="async" />` : ""}
      </span>`;
  }

  function formatWhen(ts) {
    if (!ts) return "";
    try {
      return new Date(ts * 1000).toLocaleString("ru-RU", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function itemName(map, id) {
    const it = map.get(Number(id)) || map.get(String(id));
    return (it && it.name) || `#${id}`;
  }

  function shortTag(type) {
    if (type === "price_down") return "↓ цена";
    if (type === "price_up") return "↑ цена";
    if (type === "sale") return "скидка";
    if (type === "gone") return "ушёл";
    if (type === "new") return "новый";
    return "цена";
  }

  function buildEvents(items, history) {
    itemsById = new Map();
    for (const it of items || []) itemsById.set(it.id, it);

    const out = [];

    for (const [id, series] of Object.entries(history || {})) {
      if (!Array.isArray(series) || series.length < 2) continue;
      const sorted = [...series].sort((a, b) => (a.t || 0) - (b.t || 0));
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (prev.price === cur.price && prev.priceOld === cur.priceOld) continue;

        let type = "price";
        if (cur.price < prev.price) type = "price_down";
        else if (cur.price > prev.price) type = "price_up";
        else if (cur.priceOld && (!prev.priceOld || cur.priceOld !== prev.priceOld)) type = "sale";

        const delta =
          typeof cur.price === "number" && typeof prev.price === "number"
            ? cur.price - prev.price
            : null;
        out.push({
          key: `${id}:price:${cur.t}`,
          id: Number(id),
          name: itemName(itemsById, id),
          type,
          title: shortTag(type),
          t: cur.t || 0,
          from: prev.price,
          to: cur.price,
          delta,
          priceOld: cur.priceOld,
          detail:
            type === "sale"
              ? `Скидка: было ${formatPrice(cur.priceOld)}, сейчас ${formatPrice(cur.price)}`
              : `Было ${formatPrice(prev.price)}, стало ${formatPrice(cur.price)}`,
        });
      }
    }

    for (const it of items || []) {
      if (!it.unavailable) continue;
      const since = it.unavailableSince || 0;
      out.push({
        key: `${it.id}:gone:${since || "1"}`,
        id: it.id,
        name: it.name || `#${it.id}`,
        type: "gone",
        title: shortTag("gone"),
        t: since || 0,
        from: it.price,
        to: null,
        delta: null,
        detail: it.price != null
          ? `Последняя цена: ${formatPrice(it.price)}. Сейчас нет в продаже на сайте`
          : "Сейчас нет в продаже на сайте",
      });
    }

    let known;
    try {
      const raw = JSON.parse(localStorage.getItem(KNOWN_KEY) || "[]");
      known = new Set(Array.isArray(raw) ? raw.map(String) : []);
    } catch {
      known = new Set();
    }

    const currentIds = (items || []).map((it) => String(it.id));
    let newLog = loadNewLog();
    const logged = new Set(newLog.map((x) => String(x.id)));

    if (known.size === 0) {
      try {
        localStorage.setItem(KNOWN_KEY, JSON.stringify(currentIds));
      } catch {
        /* ignore */
      }
    } else {
      const now = Math.floor(Date.now() / 1000);
      for (const it of items || []) {
        const sid = String(it.id);
        if (known.has(sid) || logged.has(sid)) continue;
        newLog.push({
          id: it.id,
          t: now,
          price: it.price ?? null,
          name: it.name || `#${it.id}`,
        });
        logged.add(sid);
      }
      try {
        localStorage.setItem(
          KNOWN_KEY,
          JSON.stringify([...new Set([...known, ...currentIds])])
        );
      } catch {
        /* ignore */
      }
      saveNewLog(newLog);
    }

    for (const entry of newLog) {
      const it = itemsById.get(Number(entry.id));
      out.push({
        key: `${entry.id}:new:${entry.t || 0}`,
        id: Number(entry.id),
        name: (it && it.name) || entry.name || `#${entry.id}`,
        type: "new",
        title: shortTag("new"),
        t: entry.t || 0,
        from: null,
        to: entry.price != null ? entry.price : it?.price ?? null,
        delta: null,
        detail:
          entry.price != null
            ? `Появился в каталоге по цене ${formatPrice(entry.price)}`
            : "Появился в каталоге",
      });
    }

    out.sort((a, b) => b.t - a.t || b.id - a.id);
    return out.slice(0, MAX_EVENTS);
  }

  function unreadEvents() {
    return events.filter((e) => !seen.has(e.key));
  }

  function unreadCount() {
    return unreadEvents().length;
  }

  function updateBadge() {
    if (!els.btn) return;
    const n = unreadCount();
    const total = events.length;
    els.btn.classList.toggle("has-new", n > 0);
    els.btn.setAttribute(
      "aria-label",
      n > 0 ? `Изменения каталога, новых: ${n}` : "Изменения каталога"
    );
    if (els.dot) els.dot.hidden = n === 0;
    if (els.label) els.label.textContent = "Изменения";
    if (els.title) els.title.textContent = "Изменения";
    if (els.sub) {
      els.sub.hidden = false;
      if (total === 0) {
        els.sub.textContent = "Пока пусто — появится, когда каталог изменится";
      } else if (n > 0) {
        els.sub.textContent = `${total} ${plural(total, "запись", "записи", "записей")} · ${n} ${plural(n, "новое", "новых", "новых")}`;
      } else {
        els.sub.textContent = `${total} ${plural(total, "запись", "записи", "записей")} · всё просмотрено`;
      }
    }
  }

  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function typeClass(type) {
    if (type === "price_down" || type === "sale") return "is-down";
    if (type === "price_up") return "is-up";
    if (type === "gone") return "is-gone";
    if (type === "new") return "is-new";
    return "";
  }

  function dayLabel(ts) {
    if (!ts) return "Без даты";
    try {
      const d = new Date(ts * 1000);
      const today = new Date();
      const yest = new Date();
      yest.setDate(today.getDate() - 1);
      const same = (a, b) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
      if (same(d, today)) return "Сегодня";
      if (same(d, yest)) return "Вчера";
      return d.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Без даты";
    }
  }

  function priceTone(e) {
    if (e.type === "price_down" || e.type === "sale" || (e.delta != null && e.delta < 0)) {
      return "is-down";
    }
    if (e.type === "price_up" || (e.delta != null && e.delta > 0)) return "is-up";
    if (e.type === "gone") return "is-gone";
    if (e.type === "new") return "is-new";
    return "";
  }

  function priceStripHtml(e) {
    const tone = priceTone(e);

    if (e.type === "gone") {
      return `
        <div class="changes-ticker ${tone}" title="нет в продаже">
          <span class="changes-ticker-old">${escapeHtml(formatPriceNum(e.from))}</span>
          <span class="changes-ticker-sep">→</span>
          <span class="changes-ticker-now">нет</span>
        </div>`;
    }

    if (e.type === "new") {
      return `
        <div class="changes-ticker ${tone}" title="новый предмет">
          <span class="changes-ticker-now">${escapeHtml(formatPriceNum(e.to))}</span>
          <span class="changes-ticker-delta is-new">new</span>
        </div>`;
    }

    if (e.from == null && e.to == null) return "";

    const delta =
      e.delta != null && e.delta !== 0
        ? `<span class="changes-ticker-delta ${e.delta < 0 ? "is-neg" : "is-pos"}">${
            e.delta < 0 ? "−" : "+"
          }${Math.abs(Math.round(e.delta))}</span>`
        : "";

    return `
      <div class="changes-ticker ${tone}">
        <span class="changes-ticker-old">${escapeHtml(formatPriceNum(e.from))}</span>
        <span class="changes-ticker-sep">→</span>
        <span class="changes-ticker-now">${escapeHtml(formatPriceNum(e.to))}</span>
        ${delta}
      </div>`;
  }

  function expandHtml(e) {
    const it = itemsById.get(e.id);
    const desc = (it && it.description ? String(it.description).trim() : "") || "";
    const short = desc.length > 180 ? `${desc.slice(0, 180).trim()}…` : desc;
    const status = it
      ? it.unavailable
        ? "<span>Статус: <strong>нет в продаже</strong></span>"
        : "<span>Статус: <strong>в продаже</strong></span>"
      : "";
    const url = it && it.url ? String(it.url) : "";
    const link = url
      ? `<a class="changes-item-link" href="${escapeAttr(url)}" target="_blank" rel="noopener">Открыть на сайте</a>`
      : "";

    return `
      <div class="changes-item-more">
        ${thumbsHtml(it, true)}
        <div class="changes-item-meta">
          ${status}
          <span>id <strong>${e.id}</strong></span>
        </div>
        ${e.detail ? `<p class="changes-item-desc">${escapeHtml(e.detail)}</p>` : ""}
        ${short && short !== e.detail ? `<p class="changes-item-desc">${escapeHtml(short)}</p>` : ""}
        ${link}
      </div>`;
  }

  function itemCardHtml(e) {
    const expanded = openKey === e.key;
    const unread = !seen.has(e.key);
    const it = itemsById.get(e.id);
    return `
      <li class="changes-item ${typeClass(e.type)}${expanded ? " is-open" : ""}${unread ? " is-unread" : " is-read"}" data-change-key="${escapeAttr(e.key)}">
        <button type="button" class="changes-item-main" data-toggle-key="${escapeAttr(e.key)}" aria-expanded="${expanded ? "true" : "false"}">
          <div class="changes-item-row">
            ${thumbsHtml(it, false)}
            <span class="changes-item-copy">
              <span class="changes-item-tag">${escapeHtml(e.title)}</span>
              <span class="changes-item-name">${escapeHtml(e.name)}</span>
            </span>
            <span class="changes-item-aside">
              ${priceStripHtml(e)}
              <span class="changes-item-meta-line">
                <time class="changes-item-time">${escapeHtml(formatWhen(e.t))}</time>
                ${unread ? '<span class="changes-unread-dot" aria-label="непрочитано"></span>' : ""}
              </span>
            </span>
          </div>
        </button>
        ${expanded ? expandHtml(e) : ""}
      </li>`;
  }

  function renderPanel() {
    if (!els.list) return;
    updateBadge();

    if (!events.length) {
      openKey = "";
      els.list.innerHTML = `
        <li class="changes-empty">
          <p>Пока изменений нет</p>
          <span>Здесь появится история цен, новинок и снятий с продажи</span>
        </li>`;
      if (els.markBtn) els.markBtn.hidden = true;
      return;
    }

    if (els.markBtn) els.markBtn.hidden = unreadCount() === 0;
    if (openKey && !events.some((e) => e.key === openKey)) openKey = "";

    let lastDay = "";
    const parts = [];
    for (const e of events) {
      const day = dayLabel(e.t);
      if (day !== lastDay) {
        lastDay = day;
        parts.push(`<li class="changes-day" aria-hidden="true">${escapeHtml(day)}</li>`);
      }
      parts.push(itemCardHtml(e));
    }
    els.list.innerHTML = parts.join("");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function setPanel(open) {
    panelOpen = open;
    if (!els.panel || !els.btn) return;
    els.panel.hidden = !open;
    els.btn.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("changes-open", open);
    if (open) {
      renderPanel();
      els.closeBtn?.focus();
    }
  }

  function markAllRead() {
    for (const e of events) seen.add(e.key);
    saveSeen();
    updateBadge();
    renderPanel();
  }

  function bind() {
    els.bar = document.getElementById("changesBar");
    els.btn = document.getElementById("changesBtn");
    els.dot = document.getElementById("changesDot");
    els.panel = document.getElementById("changesPanel");
    els.list = document.getElementById("changesList");
    els.markBtn = document.getElementById("changesMarkRead");
    els.closeBtn = document.getElementById("changesClose");
    els.sub = document.getElementById("changesSub");
    els.label = document.querySelector(".changes-btn-label");
    els.title = document.getElementById("changesScreenTitle");
    if (!els.btn || !els.panel) return;

    els.btn.addEventListener("click", () => setPanel(!panelOpen));
    els.closeBtn?.addEventListener("click", () => setPanel(false));
    els.markBtn?.addEventListener("click", () => markAllRead());

    els.list?.addEventListener("click", (e) => {
      const toggle = e.target.closest("[data-toggle-key]");
      if (!toggle) return;
      const key = toggle.dataset.toggleKey || "";
      openKey = openKey === key ? "" : key;
      // раскрытие тоже считает прочитанным
      if (openKey) {
        seen.add(openKey);
        saveSeen();
      }
      renderPanel();
      if (openKey) {
        const card = els.list.querySelector(`[data-change-key="${CSS.escape(openKey)}"]`);
        card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panelOpen) setPanel(false);
    });

    els.panel.addEventListener("pointerdown", (e) => {
      if (e.target === els.panel) setPanel(false);
    });
  }

  async function refresh(items) {
    let history = {};
    try {
      const res = await fetch("./data/price_history.json", { cache: "no-store" });
      if (res.ok) history = await res.json();
    } catch {
      history = {};
    }
    events = buildEvents(items, history);
    updateBadge();
    if (panelOpen) renderPanel();
  }

  function init() {
    bind();
    updateBadge();
  }

  window.FuturumChanges = { init, refresh, unreadCount };
})();

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

const CATEGORY_SLUGS = [
  "",
  "packs",
  "wings",
  "pets",
  "tricks",
  "items",
  "clothes",
  "child_goods",
];
const GENDER_SLUGS = ["", "m", "f"];
const BADGE_SLUGS = ["", "temp", "event"];

const state = {
  items: [],
  history: {},
  query: "",
  /** id товара из вставленной ссылки parapa.ru/mall/goods/N/ */
  linkItemId: null,
  activeId: null,
  list: [],
  favs: (window.FavStore && FavStore.loadLocal()) || new Set(),
  showFavs: false,
  showSale: false,
  category: "",
  gender: "",
  badge: "",
  sort: loadSort(),
};

const LINK_STOPWORDS = new Set([
  "для",
  "от",
  "на",
  "и",
  "с",
  "в",
  "по",
  "из",
  "к",
  "ко",
  "со",
  "или",
  "при",
  "без",
  "the",
  "a",
  "of",
  "and",
  // пол в названии — для «похоже» ищем без него
  "жен",
  "муж",
  "женск",
  "мужск",
  "женский",
  "мужской",
  "женская",
  "мужская",
  "женские",
  "мужские",
  "женскую",
  "мужскую",
]);

/** Граница слова для кириллицы (\b в JS — только ASCII) */
const UW = "(?<![\\p{L}\\p{N}_])";
const UE = "(?![\\p{L}\\p{N}_])";

/** Убрать пометку пола: «Спиннинг (женский)», «Мужское крыло…» */
function stripGenderFromName(name) {
  const wordRe = new RegExp(
    `${UW}(?:жен(?:ск(?:ий|ое|ая|ие|ую|ого|ой)?|\\.?)|муж(?:ск(?:ий|ое|ая|ие|ую|ого|ой)?|\\.?))${UE}`,
    "giu"
  );
  return String(name || "")
    .replace(
      /\s*\((?:жен(?:ск(?:ий|ая|ие|ую|ого)?|\.?|ский)?|муж(?:ск(?:ий|ая|ие|ую|ого)?|\.?|ской)?|ж|м)\)\s*/gi,
      " "
    )
    .replace(wordRe, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Цвет / оттенок в скобках и словами */
const COLOR_PAREN_RE =
  /\s*\((?:ярко-|тёмно-|темно-|светло-)?(?:черн|чёрн|бел|розов|красн|син|зелён|зелен|жёлт|желт|сер|золот|серебр|коричн|оранж|голуб|бирюз|бордов|бежев|кремов|фиолет|малин|изумруд|салат|бронз|перлам|радуж|сияющ|пурпур)[а-яёa-z.\s-]{0,16}\)\s*/gi;

const COLOR_WORD_RE = new RegExp(
  `${UW}(?:ярко-|тёмно-|темно-|светло-)?(?:белый|белая|белое|белые|чёрный|черный|чёрная|черная|чёрное|черное|чёрные|черные|красный|красная|красное|красные|синий|синяя|синее|синие|зелёный|зеленый|зелёная|зеленая|зелёное|зеленое|зелёные|зеленые|жёлтый|желтый|жёлтая|желтая|жёлтое|желтое|жёлтые|желтые|розовый|розовая|розовое|розовые|серый|серая|серое|серые|золотой|золотая|золотое|золотые|серебряный|серебряная|серебряное|серебристый|фиолетовый|фиолетовая|коричневый|коричневая|оранжевый|оранжевая|голубой|голубая|бирюзовый|бордовый|бежевый|кремовый|сияющий|сияющая|сияющее|пурпурный|пурпурная|бел[а-яё]*|чёрн[а-яё]*|черн[а-яё]*|красн[а-яё]*|син[а-яё]*|зелён[а-яё]*|зелен[а-яё]*|жёлт[а-яё]*|желт[а-яё]*|розов[а-яё]*|фиолет[а-яё]*|золот[а-яё]*|серебр[а-яё]*|коричн[а-яё]*|оранж[а-яё]*|голуб[а-яё]*|бирюз[а-яё]*|бордов[а-яё]*|бежев[а-яё]*|кремов[а-яё]*|сияющ[а-яё]*|пурпур[а-яё]*)${UE}`,
  "giu"
);

function stripColorFromName(name) {
  return String(name || "")
    .replace(COLOR_PAREN_RE, " ")
    .replace(COLOR_WORD_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Стиль / детские / упаковка / интерактив в скобках */
const META_PAREN_RE =
  /\s*\((?:круизер|классик|соло|парн(?:ый|\.)?|парный трюк|\d+\s*чел\.?|\d+\s*шт\.?|\d+шт\.?|\d+\s*карт(?:ы|а)?|\d+\s*дней?|детск?\.?|дет\.?|для детей|для малыша|дет\.\s*,\s*[мж]\.?|[мж]\.\s*,\s*[а-яё.]+|[мж],\s*[а-яё.]+)\)\s*/gi;

const META_QTY_RE = new RegExp(`${UW}\\d+\\s*шт\\.?${UE}`, "giu");

function stripMetaParens(name) {
  return String(name || "")
    .replace(META_PAREN_RE, " ")
    .replace(META_QTY_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** База названия без пола, цвета, стиля и упаковки */
function variantBaseKey(name) {
  let s = String(name || "").replace(/[★☆]/g, " ");
  s = stripGenderFromName(s);
  s = stripColorFromName(s);
  s = stripMetaParens(s);
  // остаток коротких скобок: (ж, черн.), (м.) …
  s = s.replace(/\s*\([^)]{1,22}\)\s*/g, " ");
  return normalize(s);
}

function genderBaseKey(name) {
  return variantBaseKey(name);
}

/** Подпись варианта для бейджа в выдаче */
function variantTagLabel(item) {
  const name = String(item?.name || "");
  const bits = [];
  if (new RegExp(`${UW}мужск`, "iu").test(name) || item.gender === "m") bits.push("муж.");
  else if (new RegExp(`${UW}женск`, "iu").test(name) || item.gender === "f") bits.push("жен.");

  const paren = name.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    const raw = paren[1].replace(/\.$/, "").trim().replace(/\s+/g, " ");
    if (/^[мж]/i.test(raw) && /,/.test(raw)) return raw;
    if (/^(?:ж|м|жен|муж)/i.test(raw)) {
      return item.gender === "m" || /^м/i.test(raw) ? "мужской" : "женский";
    }
    bits.push(raw);
    return bits.join(" ") || raw;
  }

  COLOR_WORD_RE.lastIndex = 0;
  const colorWord = name.match(COLOR_WORD_RE);
  if (colorWord) {
    bits.push(colorWord[0]);
    return bits.join(" ");
  }
  if (bits.length) return bits[0] === "муж." ? "мужской" : "женский";
  return "вариант";
}

const SET_PART_RE =
  /^(?:[★☆]\s*)?(верх|низ|обувь|штаны|куртка|головной убор|прическа|причёска|парик)(?:\s+от\s+костюма)?(?![\p{L}\p{N}])/iu;
const SET_TITLE_RE = /[«"]([^»"]+)[»"]/;

function setTitleKey(name) {
  const m = String(name || "").match(SET_TITLE_RE);
  return m ? normalize(m[1]) : "";
}

function setPartLabel(name) {
  const m = String(name || "").match(SET_PART_RE);
  return m ? m[1].toLowerCase() : "часть набора";
}

/** Части одного костюма (верх/низ/обувь с одним названием в кавычках) */
function findSetPartVariants(target) {
  if (!target || !SET_PART_RE.test(target.name || "")) return [];
  const title = setTitleKey(target.name);
  if (!title || title.length < 2) return [];
  return state.items
    .filter((it) => {
      if (Number(it.id) === Number(target.id)) return false;
      if (!SET_PART_RE.test(it.name || "")) return false;
      return setTitleKey(it.name) === title;
    })
    .map((item) => ({
      item,
      score: 8.5e5,
      fuzzy: false,
      genderTwin: true,
      variantLabel: setPartLabel(item.name),
    }));
}

/**
 * Варианты: пол, цвет, стиль, детские, упаковка (шт./дни), соло/парный
 * + части костюма с тем же названием в «ёлочках»
 */
function findGenderVariants(target) {
  if (!target) return [];
  const base = variantBaseKey(target.name);
  const targetNorm = normalize(target.name);
  const byId = new Map();

  if (base && base.length >= 2) {
    for (const it of state.items) {
      if (Number(it.id) === Number(target.id)) continue;
      if (normalize(it.name) === targetNorm) continue;
      if (variantBaseKey(it.name) !== base) continue;
      byId.set(Number(it.id), {
        item: it,
        score: 9e5,
        fuzzy: false,
        genderTwin: true,
        variantLabel: variantTagLabel(it),
      });
    }
  }

  for (const row of findSetPartVariants(target)) {
    const id = Number(row.item.id);
    if (!byId.has(id)) byId.set(id, row);
  }

  return [...byId.values()];
}


const els = {
  q: document.getElementById("q"),
  searchIdHint: document.getElementById("searchIdHint"),
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
  categoryPills: document.getElementById("categoryPills"),
  genderPills: document.getElementById("genderPills"),
  badgePills: document.getElementById("badgePills"),
  filtersRail: document.getElementById("filtersRail"),
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
  syncFilterPills(els.categoryPills, "category", state.category);
  syncFilterPills(els.genderPills, "gender", state.gender);
  syncFilterPills(els.badgePills, "badge", state.badge);
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

/** Убрать название игры из запроса: «пара па крылья» → «крылья» */
function stripGameName(q) {
  return String(q || "")
    .replace(/\bпара\s*[-–—]?\s*па\b/gi, " ")
    .replace(/\bпарапа\b/gi, " ")
    .replace(/\bparapa\b/gi, " ");
}

function tokenize(q) {
  return normalize(stripGameName(q)).split(" ").filter(Boolean);
}

/** Достаёт id из ссылки или если в поле ОДНО число (весь запрос = 758) */
function parseParapaGoodsId(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(
    /(?:https?:\/\/)?(?:www\.)?parapa\.ru\/mall\/goods\/(\d+)\/?/i
  );
  if (m) return Number(m[1]);
  // короткая вставка: /mall/goods/903
  const m2 = s.match(/^\/?mall\/goods\/(\d+)\/?$/i);
  if (m2) return Number(m2[1]);
  // только цифры целиком — id товара (не путаем с «25 лилий»)
  const m3 = s.match(/^(\d{1,6})$/);
  if (m3) return Number(m3[1]);
  return null;
}

function looksLikeParapaLink(raw) {
  return parseParapaGoodsId(raw) != null;
}

/** Значимые слова названия — для поиска похожих (без пола и цвета) */
function significantNameTokens(name) {
  const stripped = stripColorFromName(stripGenderFromName(name));
  const tokens = tokenize(stripped).filter(
    (t) => t.length >= 3 && !LINK_STOPWORDS.has(t) && !/^[☆★\d]+$/.test(t)
  );
  if (tokens.length >= 2) return tokens.slice(0, 6);
  return tokenize(stripped).filter(
    (t) => t.length >= 2 && !LINK_STOPWORDS.has(t)
  ).slice(0, 6);
}

/** Подсказка под строкой (вариант Z): крошечная метка, имя в title, поле не трогаем */
function syncIdHint(raw) {
  const hint = els.searchIdHint;
  const wrap = els.q?.closest(".search-wrap");
  if (!hint) return;
  const s = String(raw ?? els.q?.value ?? "").trim();
  const bareDigits = /^\d{1,6}$/.test(s);
  const id = bareDigits ? Number(s) : state.linkItemId;
  const item =
    bareDigits && state.items.length
      ? state.items.find((it) => Number(it.id) === id)
      : null;

  wrap?.classList.remove("has-id-hit", "has-id-miss");

  if (item && item.name) {
    hint.hidden = false;
    hint.classList.remove("is-miss");
    hint.textContent = item.name;
    hint.title = item.name;
    wrap?.classList.add("has-id-hit");
  } else if (bareDigits && state.linkItemId != null && !item) {
    const near = nearestItemsById(state.linkItemId, 1)[0];
    hint.hidden = false;
    hint.classList.add("is-miss");
    if (near?.item?.name) {
      hint.textContent = `ближайший #${near.item.id} · ${near.item.name}`;
      hint.title = `Нет #${state.linkItemId} — ближайший #${near.item.id}`;
    } else {
      hint.textContent = "нет в каталоге";
      hint.title = `Товар #${state.linkItemId} пока нет в каталоге`;
    }
    wrap?.classList.add("has-id-miss");
  } else {
    hint.hidden = true;
    hint.classList.remove("is-miss");
    hint.textContent = "";
    hint.removeAttribute("title");
  }
}

/**
 * Если в строке ссылка/id Parapa — запоминаем id (первый в выдаче + превью).
 * Полную ссылку mall/goods/… меняем на название; голое число (66) оставляем —
 * иначе нельзя дописать 666. Название показываем подсказкой под полем.
 * @returns {boolean} true, если ссылка/id распознаны
 */
function resolveParapaLinkInQuery(raw) {
  const id = parseParapaGoodsId(raw);
  if (id == null) {
    state.linkItemId = null;
    syncIdHint(raw);
    return false;
  }
  const item = state.items.find((it) => Number(it.id) === id);
  state.linkItemId = id;
  const bareDigits = /^\d{1,6}$/.test(String(raw || "").trim());
  if (item && item.name) {
    if (!bareDigits && els.q && els.q.value.trim() !== item.name) {
      els.q.value = item.name;
    }
    // для выдачи «похожих» нужен текст названия; в поле при id оставляем цифры
    state.query = item.name;
  } else {
    // ещё нет в нашем каталоге — оставляем как ввели
    state.query = String(raw || "").trim();
  }
  syncIdHint(raw);
  return true;
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

/** Лёгкая основа слова: лилия/лилий/лилии → «лил», лиловая → «лилов» */
function lightStem(word) {
  let s = String(word || "");
  if (s.length < 4) return s;
  const endings = [
    "ями",
    "ами",
    "иями",
    "ией",
    "ью",
    "ием",
    "иям",
    "иях",
    "ов",
    "ев",
    "ей",
    "ом",
    "ем",
    "ах",
    "ях",
    "ам",
    "ям",
    "ая",
    "яя",
    "ое",
    "ее",
    "ые",
    "ие",
    "ый",
    "ий",
    "ой",
    "ия",
    "ии",
    "ию",
    "ы",
    "и",
    "а",
    "я",
    "у",
    "ю",
    "е",
    "о",
  ];
  for (const end of endings) {
    if (s.length - end.length >= 3 && s.endsWith(end)) {
      return s.slice(0, -end.length);
    }
  }
  return s;
}

/**
 * Оценка одного токена по названию.
 * tier: 0 точное слово, 1 та же основа (лилия≈лилий), 2 префикс,
 *       3 вхождение, 4 опечатка, 5 слабо/описание
 */
function fuzzyTokenScore(token, hay) {
  if (!token || !hay) return { score: -1, tier: 9 };
  if (hay === token) return { score: 100, tier: 0 };

  const words = hay.split(" ").filter(Boolean);
  const tokenStem = lightStem(token);
  let best = { score: -1, tier: 9 };

  const take = (score, tier) => {
    if (score > best.score || (score === best.score && tier < best.tier)) {
      best = { score, tier };
    }
  };

  for (const w of words) {
    if (w === token) take(100, 0);
    else if (tokenStem.length >= 3 && lightStem(w) === tokenStem) take(96, 1);
    else if (w.startsWith(token)) take(88, 2);
    else if (token.length >= 3 && w.includes(token)) take(60, 3);
  }

  if (best.tier <= 1) return best;

  if (hay.startsWith(token)) take(80, 2);
  if (
    hay.includes(` ${token} `) ||
    hay.endsWith(` ${token}`) ||
    hay.startsWith(`${token} `)
  ) {
    take(98, 0);
  }
  if (hay.includes(token)) take(52, 3);

  // опечатки — только к словам почти той же длины
  if (token.length >= 4) {
    for (const w of words) {
      if (Math.abs(w.length - token.length) > 1) continue;
      if (tokenStem.length >= 3 && lightStem(w) === tokenStem) continue;
      const maxDist = token.length <= 5 ? 1 : 2;
      const d = editDistance(token, w, maxDist);
      if (d <= maxDist) take(36 - d * 8, 4);
    }
  }
  return best;
}

function scoreAgainst(hay, forms) {
  let best = { score: -1, tier: 9 };
  let viaSynonym = false;
  for (const f of forms) {
    const part = fuzzyTokenScore(f, hay);
    if (
      part.score > best.score ||
      (part.score === best.score && part.tier < best.tier)
    ) {
      best = part;
      viaSynonym = f !== forms[0];
    }
  }
  return { ...best, viaSynonym };
}

function scoreItem(item, tokens) {
  if (!tokens.length) return { score: -1, fuzzy: false, tier: 9 };
  const name = normalize(item.name);
  const desc = normalize(item.description);
  let score = 0;
  let fuzzy = false;
  let tier = 0;

  for (const t of tokens) {
    const forms = expandToken(t);
    let hit = scoreAgainst(name, forms);
    let fromDesc = false;
    if (hit.score < 0 && desc) {
      const d = scoreAgainst(desc, forms);
      if (d.score > 0) {
        hit = { score: d.score * 0.35, tier: 5, viaSynonym: d.viaSynonym };
        fromDesc = true;
      }
    }
    if (hit.score < 0) return { score: -1, fuzzy: false, tier: 9 };
    score += hit.score;
    tier = Math.max(tier, hit.tier);
    // «похоже» — не точное слово и не та же основа
    if (hit.tier >= 2 || hit.viaSynonym || fromDesc) fuzzy = true;
  }

  // сильнее поднимаем лучшие попадания
  if (tier === 0) score += 40;
  else if (tier === 1) score += 32;
  else if (tier === 2) score += 12;

  // чуть выше короткие названия при равном качестве
  score += Math.max(0, 6 - name.length * 0.05);
  return { score, fuzzy, tier };
}

function formatPrice(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Number(n).toLocaleString("ru-RU")} монет`;
}

function formatPriceShort(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("ru-RU");
}

function historyFor(id) {
  const series = state.history[String(id)] || [];
  return Array.isArray(series) ? series : [];
}

function sparkSvg(series) {
  if (!series.length) return "";
  const prices = series.map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return "";
  const w = 280;
  const h = 72;
  const pad = 8;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);
  const pts = prices.map((price, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, prices.length - 1);
    const y = h - pad - ((price - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fill = `${pad},${h - pad} ${pts.join(" ")} ${w - pad},${h - pad}`;
  const accent =
    getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#3dffe0";
  return `
    <svg class="preview-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="График цены">
      <polyline points="${fill}" fill="${accent}22" stroke="none" />
      <polyline points="${pts.join(" ")}" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
      ${prices.length === 1 ? `<circle cx="${pad}" cy="${h / 2}" r="3.5" fill="${accent}" />` : ""}
    </svg>`;
}

function previewHistoryHtml(item) {
  const series = historyFor(item.id);
  const prices = series.map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) {
    return `
      <div class="preview-history">
        <p class="preview-history-label">История цены</p>
        <p class="preview-history-empty">Появится после обновлений каталога</p>
      </div>`;
  }
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const last = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  let delta = "";
  if (prev && last && Number.isFinite(last.price) && Number.isFinite(prev.price)) {
    const d = last.price - prev.price;
    if (d !== 0) {
      const sign = d > 0 ? "+" : "";
      delta = `<span>изм. <b>${sign}${d.toLocaleString("ru-RU")}</b></span>`;
    }
  }
  return `
    <div class="preview-history">
      <p class="preview-history-label">История цены</p>
      <div class="preview-history-stats">
        <span>мин. <b>${escapeHtml(formatPriceShort(minP))}</b></span>
        <span>макс. <b>${escapeHtml(formatPriceShort(maxP))}</b></span>
        ${delta}
      </div>
      ${sparkSvg(series)}
    </div>`;
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

function syncFilterPills(root, attr, value) {
  if (!root) return;
  root.querySelectorAll(`[data-${attr}]`).forEach((btn) => {
    const on = (btn.dataset[attr] || "") === value;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function itemMatchesGender(item, gender) {
  if (!gender) return true;
  const g = item.gender || null;
  if (g === gender) return true;
  if (g === "unisex") return true;
  return false;
}

function passesFilters(item) {
  if (state.showFavs && !isFav(item.id)) return false;
  if (state.showSale && !itemOnSale(item)) return false;
  if (state.category) {
    const cats = item.categories || [];
    const hit =
      item.category === state.category ||
      (Array.isArray(cats) && cats.includes(state.category));
    if (!hit) return false;
  }
  if (!itemMatchesGender(item, state.gender)) return false;
  if (state.badge && item.badge !== state.badge) return false;
  return true;
}

function browseMode() {
  return (
    state.showFavs ||
    state.showSale ||
    Boolean(state.category) ||
    Boolean(state.gender) ||
    Boolean(state.badge)
  );
}

function discountAmount(item) {
  if (item.priceOld == null || item.priceOld <= item.price) return 0;
  return item.priceOld - item.price;
}

function sortRanked(list, hasQuery) {
  const byName = (a, b) => a.item.name.localeCompare(b.item.name, "ru");
  const byStock = (a, b) =>
    Number(itemUnavailable(a.item)) - Number(itemUnavailable(b.item));
  const mode = state.sort;

  list.sort((a, b) => {
    // сначала то, что в продаже, потом «нет в продаже»
    const stock = byStock(a, b);
    if (stock !== 0) return stock;

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
        if (hasQuery) {
          // 1) лучше качество совпадения (tier)  2) выше score  3) имя
          const ta = a.tier != null ? a.tier : a.fuzzy ? 4 : 0;
          const tb = b.tier != null ? b.tier : b.fuzzy ? 4 : 0;
          if (ta !== tb) return ta - tb;
          if (Boolean(a.fuzzy) !== Boolean(b.fuzzy)) return a.fuzzy ? 1 : -1;
          return b.score - a.score || byName(a, b);
        }
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

/** Ближайшие товары по числовому id (когда точного совпадения нет) */
function nearestItemsById(wantId, limit = 12) {
  const want = Number(wantId);
  if (!Number.isFinite(want) || !state.items.length) return [];
  return state.items
    .map((item) => {
      const id = Number(item.id);
      const dist = Math.abs(id - want);
      return { item, dist, id };
    })
    .filter((x) => Number.isFinite(x.dist) && x.dist > 0)
    .sort((a, b) => a.dist - b.dist || a.id - b.id)
    .slice(0, limit)
    .map((x, i) => ({
      item: x.item,
      score: 1e5 - x.dist * 10 - i,
      fuzzy: true,
      nearId: true,
      idDist: x.dist,
    }));
}

function filtered() {
  // Режим «по ссылке» / id: точный товар + вариант другого пола + похожие без учёта пола
  if (state.linkItemId != null && state.items.length) {
    const target = state.items.find((it) => Number(it.id) === state.linkItemId);
    if (target) {
      const twins = findGenderVariants(target);
      const twinIds = new Set(twins.map((x) => Number(x.item.id)));
      twinIds.add(Number(target.id));

      const tokens = significantNameTokens(target.name);
      const similar = sortRanked(
        state.items
          .filter((it) => !twinIds.has(Number(it.id)))
          .map((item) => {
            const { score, fuzzy, tier } = scoreItem(item, tokens);
            return { item, score, fuzzy: true, tier: Math.max(tier ?? 2, 2) };
          })
          .filter((x) => x.score >= 40 && passesFilters(x.item)),
        true
      ).slice(0, 40);

      // сам товар и парный пол — всегда, даже если фильтр пола другой
      const head = [{ item: target, score: 1e6, fuzzy: false, fromLink: true }];
      return head.concat(twins).concat(similar);
    }
    // точного id нет — ближайшие номера в каталоге
    return nearestItemsById(state.linkItemId, 12);
  }

  const tokens = tokenize(state.query);
  const hasQuery = Boolean(tokens.length);

  if (!hasQuery) {
    if (!browseMode()) return [];
    return sortRanked(
      state.items
        .filter(passesFilters)
        .map((item) => ({ item, score: 1, fuzzy: false })),
      false
    ).slice(0, 250);
  }

  return sortRanked(
    state.items
      .map((item) => {
        const { score, fuzzy, tier } = scoreItem(item, tokens);
        return { item, score, fuzzy, tier };
      })
      .filter((x) => x.score >= 0 && passesFilters(x.item)),
    true
  ).slice(0, 80);
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
    </div>
    ${previewHistoryHtml(item)}`;
}

let previewFadeTimer = null;

function hidePreviewZoom() {
  const zoom = els.preview?.querySelector(":scope > .preview-zoom");
  if (!zoom) return;
  zoom.classList.remove("is-on");
  zoom.hidden = true;
  zoom.setAttribute("aria-hidden", "true");
}

function ensurePreviewZoom() {
  if (!els.preview) return null;
  let zoom = els.preview.querySelector(":scope > .preview-zoom");
  if (!zoom) {
    zoom = document.createElement("div");
    zoom.className = "preview-zoom";
    zoom.hidden = true;
    zoom.setAttribute("aria-hidden", "true");
    zoom.innerHTML =
      '<div class="preview-zoom-card"><img class="preview-zoom-img" alt="Как выглядит" decoding="async" /></div>';
    els.preview.appendChild(zoom);
  } else {
    els.preview.appendChild(zoom);
  }
  return zoom;
}

function showPreviewZoom(src) {
  if (!src || isCoarsePointer() || !els.preview) return;
  const zoom = ensurePreviewZoom();
  if (!zoom) return;
  const img = zoom.querySelector(".preview-zoom-img");
  if (img && img.src !== src) img.src = src;
  zoom.hidden = false;
  zoom.setAttribute("aria-hidden", "false");
  zoom.classList.add("is-on");
}

function showPreview(item) {
  if (!els.preview) return;
  hidePreviewZoom();
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
    ensurePreviewZoom();
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
  ensurePreviewZoom();

  clearTimeout(previewFadeTimer);
  previewFadeTimer = setTimeout(() => {
    layers.forEach((layer) => layer.remove());
    ensurePreviewZoom();
  }, 220);
}

function selectByIndex(index, scroll = true, { forcePreview = false } = {}) {
  if (!state.list.length) return;
  const i = Math.max(0, Math.min(state.list.length - 1, index));
  const entry = state.list[i];
  const same = state.activeId === entry.item.id;
  const previewEmpty = !els.preview?.querySelector(".preview-card");

  warmAround(i);

  // тот же пункт — не трогаем превью (иначе мигает при движении мыши по строке),
  // но если превью пустое (ссылка/id) — обязательно показать
  if (!same || forcePreview || previewEmpty) {
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
  if (state.linkItemId != null) {
    return `Нет товара #${state.linkItemId} и рядом в каталоге тоже пусто`;
  }
  if (!hasQuery && state.showFavs && state.showSale) {
    return "В избранном нет скидок";
  }
  if (!hasQuery && state.showFavs) return "В избранном пока пусто";
  if (!hasQuery && state.showSale) return "Скидок пока нет в каталоге";
  if (!hasQuery && browseMode()) return "По фильтрам ничего нет";
  if (state.showFavs && state.showSale) return "Ничего не найдено среди избранных скидок";
  if (state.showFavs) return "В избранном ничего не найдено";
  if (state.showSale) return "Среди скидок ничего не найдено";
  if (browseMode()) return "По фильтрам ничего не найдено";
  return "Ничего не найдено";
}

function playHeroCarSettle() {
  const hero = document.querySelector(".hero");
  if (!hero) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  hero.classList.remove("hero-car-settle");
  void hero.offsetWidth;
  hero.classList.add("hero-car-settle");

  const done = (e) => {
    if (e.target !== hero) return;
    const name = e.animationName || "";
    if (name && name !== "hero-car-damper") return;
    hero.classList.remove("hero-car-settle");
    hero.removeEventListener("animationend", done);
  };
  hero.addEventListener("animationend", done);
}

function render() {
  const hasQuery =
    Boolean(tokenize(state.query).length) || state.linkItemId != null;
  const ranked = filtered();
  state.list = ranked;
  const showStage = hasQuery || browseMode();
  const wasStage = document.body.classList.contains("is-stage");

  els.hint.hidden = showStage;
  els.stage.hidden = !showStage;
  document.body.classList.toggle("is-stage", showStage);
  document.body.classList.toggle("has-query", hasQuery);
  document.body.classList.toggle("has-filters", browseMode());
  updateFiltersUi();
  const label = document.querySelector(".results-heading-label");
  if (label) {
    if (state.linkItemId != null) {
      const exact = state.items.some(
        (it) => Number(it.id) === Number(state.linkItemId)
      );
      label.textContent = exact
        ? "по ссылке и похожие"
        : `ближайшие к #${state.linkItemId}`;
    } else {
      label.textContent = "найдено";
    }
  }
  if (els.resultsCount) {
    els.resultsCount.textContent = String(ranked.length);
  }

  if (showStage && !wasStage) {
    playHeroCarSettle();
  }
  if (!showStage) {
    document.querySelector(".hero")?.classList.remove("hero-car-settle");
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
    .map(({ item, fuzzy, fromLink, nearId, genderTwin, variantLabel }) => {
      const sale = itemOnSale(item);
      const gone = itemUnavailable(item);
      const fav = isFav(item.id);
      const twinLabel = genderTwin
        ? escapeHtml(variantLabel || variantTagLabel(item))
        : "";
      return `
      <li>
        <div class="result-row">
          <button
            type="button"
            class="result${state.activeId === item.id ? " active" : ""}${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}${fromLink ? " is-link-hit" : ""}${nearId ? " is-near-id" : ""}${genderTwin ? " is-gender-twin" : ""}"
            data-id="${item.id}"
          >
            <span class="result-main">
              <span class="result-name">${escapeHtml(item.name)}</span>
              <span class="result-price${sale ? " is-sale" : ""}${gone ? " is-unavailable" : ""}">${escapeHtml(formatPriceShort(item.price))}</span>
            </span>
            <span class="result-meta">
              ${fromLink ? `<span class="result-tag is-link">по ссылке</span>` : ""}
              ${genderTwin ? `<span class="result-tag is-gender">${twinLabel}</span>` : ""}
              ${nearId ? `<span class="result-tag is-near">#${escapeHtml(String(item.id))}</span>` : ""}
              ${gone ? `<span class="result-gone">нет в продаже</span>` : ""}
              ${!gone && sale ? `<span class="result-sale">скидка</span>` : ""}
              ${!fromLink && !nearId && !genderTwin && fuzzy ? `<span class="result-tag">похоже</span>` : ""}
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

  const preferId = state.linkItemId != null ? state.linkItemId : state.activeId;
  const still =
    ranked.find((x) => Number(x.item.id) === Number(preferId)) || ranked[0];
  selectByIndex(
    ranked.findIndex((x) => Number(x.item.id) === Number(still.item.id)),
    false,
    { forcePreview: true }
  );
  // ссылка/id: ещё раз явно — на случай если selectByIndex рано вышел
  if (state.linkItemId != null) {
    const linkHit =
      ranked.find((x) => Number(x.item.id) === Number(state.linkItemId)) ||
      still;
    if (linkHit) showPreview(linkHit.item);
  }
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

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn) return;
      btn.classList.remove("is-click");
      void btn.offsetWidth;
      btn.classList.add("is-click");
      window.setTimeout(() => btn.classList.remove("is-click"), 520);
    },
    true
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

  els.categoryPills?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-category]");
    if (!btn) return;
    const next = btn.dataset.category || "";
    if (!CATEGORY_SLUGS.includes(next) || next === state.category) return;
    state.category = next;
    state.activeId = null;
    render();
  });

  els.genderPills?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-gender]");
    if (!btn) return;
    const next = btn.dataset.gender || "";
    if (!GENDER_SLUGS.includes(next)) return;
    state.gender = state.gender === next ? "" : next;
    state.activeId = null;
    render();
  });

  els.badgePills?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-badge]");
    if (!btn) return;
    const next = btn.dataset.badge || "";
    if (!BADGE_SLUGS.includes(next)) return;
    state.badge = state.badge === next ? "" : next;
    state.activeId = null;
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

  const searchWrap = els.q?.closest(".search-wrap");
  let typingPulseTimer = null;
  let keyFlashTimer = null;
  let resolveFlashTimer = null;

  function flashSearch(kind) {
    if (!searchWrap || prefersReducedMotion()) return;
    const cls = kind === "resolve" ? "is-resolved" : kind === "miss" ? "is-miss" : "is-key";
    searchWrap.classList.remove("is-key", "is-resolved", "is-miss");
    // restart animation
    void searchWrap.offsetWidth;
    searchWrap.classList.add(cls);
    clearTimeout(keyFlashTimer);
    clearTimeout(resolveFlashTimer);
    const ms = kind === "resolve" ? 720 : kind === "miss" ? 480 : 280;
    const t = setTimeout(() => searchWrap.classList.remove(cls), ms);
    if (kind === "key") keyFlashTimer = t;
    else resolveFlashTimer = t;
  }

  function syncSearchLine() {
    if (!searchWrap || !els.q) return;
    const empty = !els.q.value.trim();
    if (empty) {
      clearTimeout(typingPulseTimer);
      searchWrap.classList.add("is-idle");
      searchWrap.classList.remove("is-typing", "is-rest", "is-key", "is-resolved", "is-miss");
      return;
    }
    searchWrap.classList.remove("is-idle");
    searchWrap.classList.add("is-typing");
    searchWrap.classList.remove("is-rest");
    clearTimeout(typingPulseTimer);
    typingPulseTimer = setTimeout(() => {
      if (!els.q.value.trim()) {
        searchWrap.classList.add("is-idle");
        searchWrap.classList.remove("is-typing", "is-rest");
        return;
      }
      searchWrap.classList.remove("is-typing");
      searchWrap.classList.add("is-rest");
    }, 800);
  }
  syncSearchLine();

  function applyQueryFromInput() {
    const raw = els.q.value;
    const wasLink = looksLikeParapaLink(raw) || state.linkItemId != null;
    if (resolveParapaLinkInQuery(raw)) {
      const found = state.items.some((it) => Number(it.id) === state.linkItemId);
      flashSearch(found ? "resolve" : "miss");
      // не ставим activeId заранее — иначе render решит, что превью уже показано
      state.activeId = null;
      render();
      syncSearchUrl(state.query);
      scheduleSearchTrack(state.query);
      return;
    }
    state.linkItemId = null;
    state.query = raw;
    state.activeId = null;
    syncIdHint(raw);
    if (wasLink) flashSearch("key");
    render();
    syncSearchUrl(state.query);
    scheduleSearchTrack(state.query);
  }

  els.q.addEventListener("input", () => {
    syncSearchLine();
    flashSearch("key");
    clearTimeout(inputTimer);
    inputTimer = setTimeout(applyQueryFromInput, 50);
  });

  // Вставка ссылки — сразу, без ожидания ввода по символам
  els.q.addEventListener("paste", () => {
    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      syncSearchLine();
      applyQueryFromInput();
    }, 0);
  });

  // ПК: наведение на список переключает превью с короткой задержкой.
  // Пока курсор в правой колонке — выбор зафиксирован, чтобы можно было
  // спокойно увести мышь на картинку/цену, не задев соседние строки.
  let hoverSelectTimer = null;
  let previewPointerInside = false;
  const HOVER_SELECT_MS = 200;

  function clearHoverSelect() {
    if (hoverSelectTimer != null) {
      clearTimeout(hoverSelectTimer);
      hoverSelectTimer = null;
    }
  }

  function scheduleHoverSelect(idx) {
    clearHoverSelect();
    hoverSelectTimer = setTimeout(() => {
      hoverSelectTimer = null;
      if (previewPointerInside) return;
      selectByIndex(idx, false);
    }, HOVER_SELECT_MS);
  }

  els.results.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    if (previewPointerInside) return;
    const row = e.target.closest(".result-row");
    if (!row) return;
    // игнор, если курсор остался внутри той же строки (имя ↔ цена ↔ ★)
    const from = e.relatedTarget;
    if (from && row.contains(from)) return;
    const btn = row.querySelector(".result[data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (state.activeId === id) {
      clearHoverSelect();
      return;
    }
    const idx = state.list.findIndex((x) => x.item.id === id);
    if (idx >= 0) scheduleHoverSelect(idx);
  });

  els.results.addEventListener("pointerleave", () => {
    clearHoverSelect();
  });

  els.preview.addEventListener("pointerenter", () => {
    previewPointerInside = true;
    clearHoverSelect();
  });

  els.preview.addEventListener("pointerleave", () => {
    previewPointerInside = false;
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
    if (e.target.closest(".preview-zoom")) hidePreviewZoom();
  });

  // ПК: картинка «как выглядит» — крупно поверх всей панели превью
  els.preview.addEventListener("mouseover", (e) => {
    if (isCoarsePointer()) return;
    const frame = e.target.closest(".preview-look-frame");
    if (!frame || !els.preview.contains(frame)) return;
    const img = frame.querySelector("img.preview-look");
    const src = img?.currentSrc || img?.src;
    if (src) showPreviewZoom(src);
  });
  els.preview.addEventListener("mouseleave", () => {
    hidePreviewZoom();
  });
}

async function loadHistory() {
  try {
    const res = await fetch("./data/price_history.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data === "object") state.history = data;
  } catch {
    /* история необязательна */
  }
}

async function load(isRefresh = false) {
  try {
    const [res] = await Promise.all([
      fetch("./data/items.json", { cache: "no-store" }),
      loadHistory(),
    ]);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const next = data.items || [];
    const prevLen = state.items.length;
    state.items = next;
    setCatalogCount(next.length, isRefresh || prevLen > 0);
    if (!isRefresh) {
      els.hint.textContent = next.length
        ? "Введите название или выберите фильтр"
        : "Каталог пока пуст — идёт сбор";
    }
    // После загрузки каталога обязательно пересчитать выдачу
    // (иначе ?q= из ссылки срабатывает на пустом списке и зависает на 0)
    // ссылка/id могли прийти до загрузки каталога — резолвим после items.json
    if (els.q && (looksLikeParapaLink(els.q.value) || state.linkItemId != null)) {
      resolveParapaLinkInQuery(
        looksLikeParapaLink(els.q.value) ? els.q.value : String(state.linkItemId)
      );
      state.activeId = null;
    }
    if (tokenize(state.query).length || state.linkItemId != null || browseMode()) {
      render();
    } else if (!isRefresh && state.activeId) {
      const cur = state.items.find((it) => it.id === state.activeId);
      if (cur) showPreview(cur);
    }
    if (window.FuturumChanges) {
      FuturumChanges.refresh(state.items);
    }
  } catch {
    if (!isRefresh) {
      els.hint.textContent = "Не удалось загрузить каталог";
      setCatalogCount(0, false);
    }
  }
}

function openChangeItem(id) {
  const idx = state.items.findIndex((it) => it.id === id);
  if (idx < 0) return;
  const item = state.items[idx];
  if (els.q) {
    els.q.value = item.name || "";
    state.query = els.q.value;
    syncSearchUrl(state.query);
    scheduleSearchTrack(state.query);
    els.q.dispatchEvent(new Event("input", { bubbles: true }));
  }
  render();
  const listIdx = state.list.findIndex((row) => row.item.id === id);
  if (listIdx >= 0) selectByIndex(listIdx, true);
}

window.__futurumOpenChangeItem = openChangeItem;

setTheme(currentTheme());
setBg(currentBg());
updateFiltersUi();
bind();

// SEO SearchAction + GA: /?q=запрос
try {
  const qParam = new URLSearchParams(window.location.search).get("q");
  if (qParam && els.q) {
    els.q.value = qParam;
    state.query = qParam;
    els.q.dispatchEvent(new Event("input", { bubbles: true }));
  }
} catch {
  /* ignore */
}

/** Синхронизация ?q= для шаринга, SEO и улучшенной статистики GA */
function syncSearchUrl(query) {
  try {
    const url = new URL(window.location.href);
    const q = String(query || "").trim();
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    const next = `${url.pathname}${url.search}${url.hash}`;
    const cur = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== cur) history.replaceState({ futurumSearch: q }, "", next);
  } catch {
    /* ignore */
  }
}

let searchTrackTimer = null;
let lastTrackedSearch = "";

/** Поиск в GA: view_search_results + search (с debounce, без спама) */
function scheduleSearchTrack(query) {
  clearTimeout(searchTrackTimer);
  const term = String(query || "").trim();
  if (term.length < 2) {
    lastTrackedSearch = "";
    return;
  }
  searchTrackTimer = setTimeout(() => {
    if (term === lastTrackedSearch) return;
    lastTrackedSearch = term;
    if (typeof gtag !== "function") return;
    try {
      gtag("event", "view_search_results", { search_term: term });
      gtag("event", "search", { search_term: term });
    } catch {
      /* ignore */
    }
  }, 700);
}

if (window.FuturumChanges) FuturumChanges.init();
syncFavs().finally(() => load(false));
setInterval(() => load(true), 15000);

const boot = () => playBootGlitch();
if (document.readyState === "complete") {
  setTimeout(boot, 180);
} else {
  window.addEventListener("load", () => setTimeout(boot, 180), { once: true });
}

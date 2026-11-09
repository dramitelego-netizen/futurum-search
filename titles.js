const THEME_KEY = "futurum_theme";
const THEME_MODES = ["dark", "gray", "light"];
const IMG_SRC_KEY = "futurum_img_src";
const IMG_SRC_MANUAL_KEY = "futurum_img_src_manual";
const IMG_SRC_AUTO_AT_KEY = "futurum_img_src_auto_at";
const IMG_SRC_MODES = ["local", "remote"];
/** Повторный авто-замер не чаще раза в неделю (если пользователь не трогал вручную) */
const IMG_SRC_AUTO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Маленькая иконка, есть и на гиде, и на вики — для замера скорости */
const IMG_SRC_PROBE = {
  local: "data/guide_img/33fd5835c73f65abdcf02ad4e97823f2.png",
  remote: "https://parapa.ru/wiki/images/b/b5/33fd5835c73f65abdcf02ad4e97823f2.png",
};
const BG_KEY = "futurum_bg";
const ITEMS_VIEW_KEY = "futurum_items_layout";
const ITEMS_VIEWS = ["A", "B", "C", "D", "E", "G"];
const ITEMS_VIEW_ALIASES = {
  list: "A",
  compact: "B",
  tiles: "C",
  cards: "D",
  wide: "E",
  text: "A",
  F: "A",
  mini: "G",
  reel: "A",
  strip: "A",
  H: "A",
};
const THUMB_CAROUSEL_MS = 2800;
const THUMB_CAROUSEL_MAX = 6;
let thumbCarouselTimer = null;
const SORT_KEY = "futurum_titles_sort";
const SECTION_KEY = "futurum_guide_section";
const COST_CURRENCY_KEY = "futurum_guide_cost_currency";
const SORT_MODES = ["name", "op-desc", "op-asc", "price-asc", "price-desc"];
const COST_CURRENCIES = ["", "mnt", "dns", "points"];
const COST_CURRENCY_RANK = { mnt: 0, dns: 1, points: 2 };

const WIKI_SECTIONS = new Set([
  "achievements",
  "wings",
  "pets",
  "transport",
  "accessories",
  "hairstyles",
  "interactive",
  "wands",
  "backpacks",
  "umbrellas",
  "balloons",
  "hand_decor",
  "toys",
  "shoes",
  "kids_masks",
  "bouquets",
  "bows",
  "amusements",
  "forms",
  "gems",
  "emotes",
  "card_bg",
  "show_bg",
  "card_frame",
  "stickers",
  "chat_bubbles",
  "event_clothes",
  "kids_clothes",
]);

const SECTION_LABEL = {
  titles: "титулов",
  achievements: "достижений",
  wings: "крыльев",
  pets: "питомцев",
  transport: "транспорта",
  accessories: "аксессуаров",
  hairstyles: "причёсок",
  interactive: "жестов",
  wands: "жезлов",
  backpacks: "рюкзаков",
  umbrellas: "зонтов",
  balloons: "шариков",
  hand_decor: "украшений рук",
  toys: "игрушек",
  shoes: "обуви",
  kids_masks: "масок",
  bouquets: "букетов",
  bows: "луков",
  amusements: "развлечений",
  forms: "образов",
  gems: "камней",
  emotes: "реакций",
  card_bg: "фонов визитки",
  show_bg: "фонов шоу",
  card_frame: "рамок",
  stickers: "стикеров",
  chat_bubbles: "облачков чата",
  event_clothes: "костюмов",
  kids_clothes: "детской одежды",
};

const SECTION_TITLE = {
  titles: "Титулы",
  achievements: "Достижения",
  wings: "Крылья",
  pets: "Питомцы",
  transport: "Транспорт",
  accessories: "Украшения",
  hairstyles: "Причёски",
  interactive: "Жесты",
  wands: "Жезлы",
  backpacks: "Рюкзаки",
  umbrellas: "Зонты",
  balloons: "Шарики",
  hand_decor: "На руки",
  toys: "Игрушки",
  shoes: "Обувь",
  kids_masks: "Маски",
  bouquets: "Букеты",
  bows: "Луки",
  amusements: "Развлечения",
  forms: "Образы",
  gems: "Камни",
  emotes: "Реакции",
  card_bg: "Фон визитки",
  show_bg: "Фон шоу",
  card_frame: "Рамки",
  stickers: "Стикеры",
  chat_bubbles: "Облачка чата",
  event_clothes: "Костюмы",
  kids_clothes: "Детская одежда",
};

const SECTION_HINT = {
  titles: "имена над головой",
  achievements: "награды за задания",
  gems: "камни статуса",
  event_clothes: "основная одежда",
  kids_clothes: "для маленьких",
  shoes: "ботинки и туфли",
  hairstyles: "причёски персонажа",
  accessories: "шляпы, очки, украшения",
  hand_decor: "браслеты и перчатки",
  kids_masks: "маски на лицо",
  backpacks: "ранцы за спиной",
  wands: "палочки и жезлы",
  umbrellas: "зонтики",
  bouquets: "цветы в руках",
  bows: "луки и стрелы",
  balloons: "воздушные шары",
  toys: "игрушки в руках",
  wings: "крылья за спиной",
  pets: "питомцы рядом",
  transport: "машины и средства",
  forms: "смена облика",
  interactive: "анимации жестов",
  emotes: "эмодзи и реакции",
  amusements: "мини-игры и эффекты",
  card_bg: "фон карточки профиля",
  show_bg: "фон для выступлений",
  card_frame: "рамка вокруг визитки",
  stickers: "наклейки на визитку",
  chat_bubbles: "оформление сообщений",
};

/** 7 групп каталога */
const GUIDE_GROUPS = [
  {
    id: "status",
    code: "СТ",
    label: "Прогресс",
    hint: "титулы, достижения, камни",
    sections: ["titles", "achievements", "gems"],
  },
  {
    id: "clothes",
    code: "ОД",
    label: "Одежда",
    hint: "костюмы, обувь, причёски",
    sections: ["event_clothes", "kids_clothes", "shoes", "hairstyles"],
  },
  {
    id: "accessories",
    code: "АК",
    label: "Аксессуары",
    hint: "то, что надето на персонажа",
    sections: ["accessories", "hand_decor", "kids_masks", "backpacks"],
  },
  {
    id: "hands",
    code: "РК",
    label: "В руках",
    hint: "жезлы, зонты, букеты, игрушки",
    sections: ["wands", "umbrellas", "bouquets", "bows", "balloons", "toys"],
  },
  {
    id: "companions",
    code: "СП",
    label: "Спутники",
    hint: "крылья, питомцы, транспорт",
    sections: ["wings", "pets", "transport", "forms"],
  },
  {
    id: "emotions",
    code: "ЖС",
    label: "Жесты",
    hint: "реакции и развлечения",
    sections: ["interactive", "emotes", "amusements"],
  },
  {
    id: "card",
    code: "ВЗ",
    label: "Визитка",
    hint: "фон, рамка, стикеры, чат",
    sections: ["card_bg", "show_bg", "card_frame", "stickers", "chat_bubbles"],
  },
];

const GROUP_KEY = "futurum_guide_group";

function groupById(id) {
  return GUIDE_GROUPS.find((g) => g.id === id) || null;
}

function groupForSection(section) {
  return GUIDE_GROUPS.find((g) => g.sections.includes(section)) || GUIDE_GROUPS[0];
}

function sectionCount(section) {
  if (section === "titles") return state.titles.length;
  return state.wiki.filter((it) => it.kind === section && !isLeakedAchievementItem(it)).length;
}

function groupCount(group) {
  return group.sections.reduce((n, s) => n + sectionCount(s), 0);
}

function fmtCount(n) {
  return new Intl.NumberFormat("ru-RU").format(n || 0);
}

const SOURCE_BUCKETS = [
  { id: "all", label: "Все" },
  { id: "shop", label: "Магазин" },
  { id: "wheel", label: "Колёса" },
  { id: "event", label: "События" },
  { id: "ticket", label: "Билеты" },
  { id: "other", label: "Другое" },
];

const state = {
  section: loadSection(),
  group: "",
  titles: [],
  titlesMeta: null,
  wiki: [],
  wikiMeta: null,
  items: [],
  meta: null,
  query: "",
  op: "",
  category: "",
  sourceBucket: "all",
  catDetailOpen: false,
  catDetailQ: "",
  sort: loadSort(),
  costCurrency: loadCostCurrency(),
  activeId: null,
  list: [],
  shopItems: [],
  shopByKey: null,
  /** Стартовый экран: только поиск, пока не выбрали раздел / не начали искать */
  landing: true,
  /** Снимок экрана достижения, чтобы вернуться после «Перейти к предмету» */
  navBack: null,
};

state.group = groupForSection(state.section).id;

const els = {
  q: document.getElementById("q"),
  list: document.getElementById("results"),
  detail: document.getElementById("preview"),
  total: document.getElementById("ttlTotal"),
  found: document.getElementById("resultsCount"),
  hint: document.getElementById("hint"),
  stage: document.getElementById("stage"),
  themeToggle: document.getElementById("themeToggle"),
  imgSrcToggle: document.getElementById("imgSrcToggle"),
  imgSrcHint: document.getElementById("imgSrcHint"),
  opPills: document.getElementById("opPills"),
  opFiltersWrap: document.getElementById("opFiltersWrap"),
  catPills: document.getElementById("catPills"),
  catBuckets: document.getElementById("catBuckets"),
  guideCatD: document.getElementById("guideCatD"),
  catMoreToggle: document.getElementById("catMoreToggle"),
  catDetailPanel: document.getElementById("catDetailPanel"),
  catDetailList: document.getElementById("catDetailList"),
  catDetailQ: document.getElementById("catDetailQ"),
  catDetailClose: document.getElementById("catDetailClose"),
  sortPills: document.getElementById("sortPills"),
  costCurrencyPills: document.getElementById("costCurrencyPills"),
  guideSections: document.getElementById("guideSections"),
  guideRail: document.getElementById("guideRail"),
  guideSubs: document.getElementById("guideSubs"),
  guideCrumb: document.getElementById("guideCrumb"),
  guideTree: document.getElementById("guideTree"),
  guideTreeEmpty: document.getElementById("guideTreeEmpty"),
  guideSide: document.getElementById("guideSide"),
  guideSideBackdrop: document.getElementById("guideSideBackdrop"),
  guideCatalogBtn: document.getElementById("guideCatalogBtn"),
  guideSideCollapse: document.getElementById("guideSideCollapse"),
  guideSideClose: document.getElementById("guideSideClose"),
  guideSideModes: document.getElementById("guideSideModes"),
  sideModeCatalog: document.getElementById("sideModeCatalog"),
  sideModeFilters: document.getElementById("sideModeFilters"),
  sideModeFiltersDot: document.getElementById("sideModeFiltersDot"),
  guideSideCatalog: document.getElementById("guideSideCatalog"),
  guideSideFilters: document.getElementById("guideSideFilters"),
  guideFiltersEmpty: document.getElementById("guideFiltersEmpty"),
  menuOpen: document.getElementById("menuOpen"),
  menuClose: document.getElementById("menuClose"),
  menuBackdrop: document.getElementById("menuBackdrop"),
  sideMenu: document.getElementById("sideMenu"),
  guideBnav: document.getElementById("guideBnav"),
  guideSheetDim: document.getElementById("guideSheetDim"),
  guideMobCatalog: document.getElementById("guideMobCatalog"),
  guideMobCatList: document.getElementById("guideMobCatList"),
  guideMobCatTitle: document.getElementById("guideMobCatTitle"),
  guideMobCatTotal: document.getElementById("guideMobCatTotal"),
  guideMobCatBack: document.getElementById("guideMobCatBack"),
  guideMobFav: document.getElementById("guideMobFav"),
  guideMobFavList: document.getElementById("guideMobFavList"),
  guideMobFavCount: document.getElementById("guideMobFavCount"),
  guideMobMore: document.getElementById("guideMobMore"),
  guideFavBadge: document.getElementById("guideFavBadge"),
  guideMobOpenMenu: document.getElementById("guideMobOpenMenu"),
  guideMobFocusFilters: document.getElementById("guideMobFocusFilters"),
  guideMobChips: document.getElementById("guideMobChips"),
  guideLanding: document.getElementById("guideLanding"),
  guideLandingCatalog: document.getElementById("guideLandingCatalog"),
  guideLandingQuick: document.getElementById("guideLandingQuick"),
  guideLandingSearch: document.getElementById("guideLandingSearch"),
  itemsView: document.getElementById("itemsView"),
};

const ICO = {
  medal:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="5"/><path d="M9.2 9.2 8 3.8l4 1.6L16 3.8l-1.2 5.4"/><path d="M12 11.8v4.8"/><path d="M10.2 14.2h3.6"/></svg>',
  trophy:
    '<svg viewBox="0 0 24 24"><path d="M8 4h8v3.2a4 4 0 0 1-8 0V4z"/><path d="M8 5.2H5.6A1.6 1.6 0 0 0 4 6.8v.4a3.2 3.2 0 0 0 3.2 3.2"/><path d="M16 5.2h2.4A1.6 1.6 0 0 1 20 6.8v.4a3.2 3.2 0 0 1-3.2 3.2"/><path d="M10 15.2h4"/><path d="M12 15.2V18"/><path d="M8.5 20h7"/></svg>',
  gem: '<svg viewBox="0 0 24 24"><path d="M12 3.5 19 9l-7 11.5L5 9l7-5.5z"/><path d="M5 9h14"/><path d="M9.2 9 12 3.5 14.8 9 12 20.5 9.2 9z"/></svg>',
  shirt:
    '<svg viewBox="0 0 24 24"><path d="M8.4 4.5h2.1c.5 1.5 1.3 2.3 1.5 2.3s1-.8 1.5-2.3h2.1l3.9 2.7-2 2.6h-1.3V19.5H7.8V9.8H6.5l-2-2.6 3.9-2.7z"/></svg>',
  child:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="2.6"/><path d="M7.5 20v-1.4c0-2.4 2-4.3 4.5-4.3s4.5 1.9 4.5 4.3V20"/><path d="M9.2 12.8 7 15.2"/><path d="M14.8 12.8 17 15.2"/></svg>',
  shoe:
    '<svg viewBox="0 0 24 24"><path d="M4.5 15.5h9.2c1.2 0 2.3.5 3.1 1.3l1.7 1.7H4.5v-3z"/><path d="M4.5 15.5c0-2.2 1.2-4.2 3.2-5.1l2.1-.9c1-.4 2.1.2 2.5 1.2L13 13"/><path d="M4.5 18.5h13.9"/></svg>',
  hair:
    '<svg viewBox="0 0 24 24"><path d="M7 14.5c0-3.4 2.2-6.2 5-6.2s5 2.8 5 6.2"/><path d="M7 14.5c-1.2.4-2 1.4-2 2.7 0 1.3 1.2 2.3 2.7 2.3h8.6c1.5 0 2.7-1 2.7-2.3 0-1.3-.8-2.3-2-2.7"/><path d="M9.2 8.8c.7-1.4 1.9-2.3 2.8-2.3.8 0 1.5.4 2.1 1"/></svg>',
  spark:
    '<svg viewBox="0 0 24 24"><path d="M12 3.5v3.2"/><path d="M12 17.3v3.2"/><path d="M3.5 12h3.2"/><path d="M17.3 12h3.2"/><path d="M6.4 6.4l2.2 2.2"/><path d="M15.4 15.4l2.2 2.2"/><path d="M17.6 6.4l-2.2 2.2"/><path d="M8.6 15.4l-2.2 2.2"/><circle cx="12" cy="12" r="2.4"/></svg>',
  handRing:
    '<svg viewBox="0 0 24 24"><path d="M8 12.2c0-1.1.9-2 2-2h1.1V8.2c0-1 .7-1.7 1.6-1.7s1.6.7 1.6 1.7V14l2.8-1.1c.7-.3 1.4.2 1.4.9v2.2c0 .4-.2.7-.5.9L14 19.5H9.6C8.3 19.5 7.2 18.4 7.2 17v-2.4c0-1 .4-1.8.8-2.4z"/></svg>',
  mask:
    '<svg viewBox="0 0 24 24"><path d="M4.5 11.2c0-3.2 3.4-5.7 7.5-5.7s7.5 2.5 7.5 5.7c0 3.4-2.6 5.6-5.2 6.4-.7.2-1.4-.3-1.4-1v-1.2c0-.4-.3-.8-.7-1H11c-.4 0-.7.3-.7.7v1.5c0 .7-.7 1.2-1.4 1C6.8 16.8 4.5 14.6 4.5 11.2z"/><path d="M9 11.2h.01"/><path d="M15 11.2h.01"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M6.5 9.5h11v10h-11z"/><path d="M9 9.5V8a3 3 0 0 1 6 0v1.5"/><path d="M6.5 12.5h11"/></svg>',
  wand:
    '<svg viewBox="0 0 24 24"><path d="M5 19.5 14.2 10.3"/><path d="M13.2 9.3l2 2"/><path d="M15.5 7.2l1.3-1.3 1.8 1.8-1.3 1.3"/><path d="M17.8 4.8l.9-.9"/><path d="M19.5 6.5l.9-.9"/></svg>',
  umbrella:
    '<svg viewBox="0 0 24 24"><path d="M4.5 11.5c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5H4.5z"/><path d="M12 11.5v7.2"/><path d="M12 18.7c0 1.1-.8 2-2 2"/></svg>',
  bouquet:
    '<svg viewBox="0 0 24 24"><path d="M12 13.5c-2.2 0-4-1.6-4-3.8C8 7.2 10 5 12 5s4 2.2 4 4.7c0 2.2-1.8 3.8-4 3.8z"/><path d="M9.2 8.2c-1.5-.2-2.7-1.4-2.7-3"/><path d="M14.8 8.2c1.5-.2 2.7-1.4 2.7-3"/><path d="M12 13.5v6"/><path d="M10 19.5h4"/></svg>',
  bow: '<svg viewBox="0 0 24 24"><path d="M5 12h10"/><path d="M15 7.5 20.5 12 15 16.5"/><path d="M5 8.5v7"/><path d="M7.2 10.2 5 12l2.2 1.8"/></svg>',
  balloon:
    '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="9.5" rx="4.2" ry="5.2"/><path d="M12 14.7 10.8 20.5"/><path d="M10.2 14.2h3.6"/></svg>',
  toy: '<svg viewBox="0 0 24 24"><rect x="7" y="9" width="10" height="8" rx="2"/><path d="M9.5 9V7.5a2.5 2.5 0 0 1 5 0V9"/><circle cx="10" cy="13" r="0.8"/><circle cx="14" cy="13" r="0.8"/><path d="M7 12.5H4.8"/><path d="M16.2 12.5H19"/></svg>',
  wings:
    '<svg viewBox="0 0 24 24"><path d="M12 19.5V10"/><path d="M12 11.5C8.5 8.2 5.2 7.2 3.5 7.5c.8 3.2 2.8 5.8 5.2 7.5"/><path d="M12 11.5c3.5-3.3 6.8-4.3 8.5-4  -.8 3.2-2.8 5.8-5.2 7.5"/><path d="M12 14.2C9.2 12 7 11.2 5.5 11.4"/><path d="M12 14.2c2.8-2.2 5-3 6.5-2.8"/></svg>',
  pet: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="16.2" rx="4.2" ry="3.3"/><circle cx="7.2" cy="10.2" r="1.6"/><circle cx="10.2" cy="7.6" r="1.5"/><circle cx="13.8" cy="7.6" r="1.5"/><circle cx="16.8" cy="10.2" r="1.6"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M4.5 14.5h15v3.5h-15z"/><path d="M6 14.5l1.6-4.2A2 2 0 0 1 9.5 9h5a2 2 0 0 1 1.9 1.3l1.6 4.2"/><circle cx="8" cy="18" r="1.3"/><circle cx="16" cy="18" r="1.3"/></svg>',
  form:
    '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.2"/><circle cx="15.5" cy="14.5" r="3.2"/><path d="M11.4 10.6 13.2 12.8"/></svg>',
  gesture:
    '<svg viewBox="0 0 24 24"><path d="M8.2 11.2V7.8a1.3 1.3 0 0 1 2.6 0v2.2"/><path d="M10.8 10V6.6a1.3 1.3 0 0 1 2.6 0V10"/><path d="M13.4 10.2V7.2a1.3 1.3 0 0 1 2.6 0v6.1c0 2.4-1.7 4.4-4.1 4.7H12c-2.8 0-5-2.2-5-5v-2.8a1.3 1.3 0 0 1 2.6 0v1"/></svg>',
  smile:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><path d="M8.6 10.2h.01"/><path d="M15.4 10.2h.01"/><path d="M8.8 14c1 .9 2.1 1.4 3.2 1.4s2.2-.5 3.2-1.4"/></svg>',
  fun: '<svg viewBox="0 0 24 24"><path d="M8 5.5h8l2.5 4.5L12 19.5 5.5 10 8 5.5z"/><path d="M8 5.5 12 10l4-4.5"/><path d="M5.5 10h13"/></svg>',
  cardBg:
    '<svg viewBox="0 0 24 24"><rect x="4.5" y="5.5" width="15" height="13" rx="2"/><path d="M4.5 14.5c2.2-2 4.4-3 7.5-3s5.3 1 7.5 3"/><circle cx="9.2" cy="9.2" r="1.3"/></svg>',
  stage:
    '<svg viewBox="0 0 24 24"><path d="M4 18.5h16"/><path d="M6.5 18.5v-4.2L12 8l5.5 6.3v4.2"/><path d="M12 8V5.5"/><path d="M9.5 6.2 12 5.5l2.5.7"/></svg>',
  frame:
    '<svg viewBox="0 0 24 24"><rect x="4.5" y="5.5" width="15" height="13" rx="1.5"/><rect x="7" y="8" width="10" height="8" rx="1"/></svg>',
  sticker:
    '<svg viewBox="0 0 24 24"><path d="M7 4.5h7.5L19.5 9.5V17a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 17V7A2.5 2.5 0 0 1 7 4.5z"/><path d="M14.5 4.5V9h4.5"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M5 6.5h14v9.2H9.2L5 19v-3.3V6.5z"/><path d="M8.5 10h7"/><path d="M8.5 13h4.5"/></svg>',
};

const MOB_GROUP_META = {
  status: { color: "var(--op8)", icon: ICO.medal },
  clothes: { color: "var(--op4)", icon: ICO.shirt },
  accessories: { color: "var(--op2)", icon: ICO.spark },
  hands: { color: "#6ec8ff", icon: ICO.wand },
  companions: { color: "var(--op1)", icon: ICO.pet },
  emotions: { color: "#ff7ab8", icon: ICO.smile },
  card: { color: "#9b8cff", icon: ICO.frame },
};

const MOB_SECTION_META = {
  titles: { color: "var(--op8)", icon: ICO.medal },
  achievements: { color: "#ffb347", icon: ICO.trophy },
  gems: { color: "#7ad7ff", icon: ICO.gem },
  event_clothes: { color: "var(--op4)", icon: ICO.shirt },
  kids_clothes: { color: "#ff9ec8", icon: ICO.child },
  shoes: { color: "#c4a484", icon: ICO.shoe },
  hairstyles: { color: "#d4b8ff", icon: ICO.hair },
  accessories: { color: "var(--op2)", icon: ICO.spark },
  hand_decor: { color: "#ffd27a", icon: ICO.handRing },
  kids_masks: { color: "#ff8f8f", icon: ICO.mask },
  backpacks: { color: "#8fd4a8", icon: ICO.bag },
  wands: { color: "#b59cff", icon: ICO.wand },
  umbrellas: { color: "#6ec8ff", icon: ICO.umbrella },
  bouquets: { color: "#ff7ab8", icon: ICO.bouquet },
  bows: { color: "#ff9a5c", icon: ICO.bow },
  balloons: { color: "#7ad7ff", icon: ICO.balloon },
  toys: { color: "#ffb347", icon: ICO.toy },
  wings: { color: "#9b8cff", icon: ICO.wings },
  pets: { color: "var(--op1)", icon: ICO.pet },
  transport: { color: "#6ec8ff", icon: ICO.car },
  forms: { color: "#d4b8ff", icon: ICO.form },
  interactive: { color: "#ff7ab8", icon: ICO.gesture },
  emotes: { color: "#ff9ec8", icon: ICO.smile },
  amusements: { color: "#ffb347", icon: ICO.fun },
  card_bg: { color: "#9b8cff", icon: ICO.cardBg },
  show_bg: { color: "#b59cff", icon: ICO.stage },
  card_frame: { color: "#8fd4a8", icon: ICO.frame },
  stickers: { color: "#ff9a5c", icon: ICO.sticker },
  chat_bubbles: { color: "#6ec8ff", icon: ICO.chat },
};

const COLLAPSE_KEY = "futurum_guide_side_collapsed";
const navUi = {
  openGroups: new Set([state.group || "status"]),
  collapsed: loadCollapsed(),
  menuOpen: false,
  sideMode: "catalog",
  filtersAvailable: false,
};

function setGuideSideMode(mode) {
  const next = mode === "filters" ? "filters" : "catalog";
  if (next === "filters" && !navUi.filtersAvailable) {
    navUi.sideMode = "catalog";
  } else {
    navUi.sideMode = next;
  }
  if (navUi.sideMode === "catalog") setCatDetailOpen(false);
  paintGuideSideChrome();
}

function filtersAreActive() {
  return Boolean(state.category) || (state.sourceBucket && state.sourceBucket !== "all");
}

function loadCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistCollapsed() {
  try {
    localStorage.setItem(COLLAPSE_KEY, navUi.collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const GUIDE_NARROW_MQ = window.matchMedia("(max-width: 760px)");
const GUIDE_DESKTOP_POINTER_MQ = window.matchMedia("(hover: hover) and (pointer: fine)");
const FAV_KEY = "futurum_guide_favorites";

const mobileUi = {
  tab: "home",
  sheetOpen: false,
  sheetTall: false,
  /** @deprecated drill-down; accordion B2 использует catalogOpen */
  catalogGroup: null,
  /** id открытой группы в мобильном accordion */
  catalogOpen: null,
  favs: loadFavorites(),
};

/** Телефон/планшет → mobile E; обычный ПК (мышь) → desktop, даже в узком окне превью */
function isGuidePhoneDevice() {
  try {
    const ua = navigator.userAgent || "";
    if (/Android.+Mobile|iPhone|iPod|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      return true;
    }
    // iPadOS 13+ маскируется под Mac, но с multitouch
    if (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1) {
      return true;
    }
    if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** titles.html → desktop, titles-m.html → mobile; data-guide-force побеждает ?ui= */
function guideForceMode() {
  const forced = document.documentElement.getAttribute("data-guide-force");
  if (forced === "mobile" || forced === "desktop") return forced;
  try {
    const ui = new URLSearchParams(location.search).get("ui");
    if (ui === "mobile" || ui === "m") return "mobile";
    if (ui === "desktop" || ui === "pc") return "desktop";
  } catch {
    /* ignore */
  }
  return "";
}

function isGuideNarrow() {
  const force = guideForceMode();
  // Отдельные страницы: ПК никогда не уходит в mobile E UI
  if (force === "desktop") return false;
  if (force === "mobile") return true;
  // fallback: авто (если открыли без data-guide-force)
  if (isGuidePhoneDevice()) return true;
  if (GUIDE_DESKTOP_POINTER_MQ.matches) return false;
  return GUIDE_NARROW_MQ.matches;
}

/** Узкое окно (≤760px): выезжающий каталог по кнопке — и на ПК titles.html */
function isGuideDrawerViewport() {
  return GUIDE_NARROW_MQ.matches;
}

function favKey(id, section) {
  return `${section || ""}:${Number(id)}`;
}

function loadFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((x) => ({ id: Number(x.id), section: String(x.section || "") }))
      .filter((x) => Number.isFinite(x.id) && x.id > 0 && x.section);
  } catch {
    return [];
  }
}

function persistFavorites() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(mobileUi.favs.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

function isFavorite(id, section) {
  const k = favKey(id, section);
  return mobileUi.favs.some((f) => favKey(f.id, f.section) === k);
}

function toggleFavorite(id, section) {
  const k = favKey(id, section);
  const i = mobileUi.favs.findIndex((f) => favKey(f.id, f.section) === k);
  if (i >= 0) mobileUi.favs.splice(i, 1);
  else mobileUi.favs.unshift({ id: Number(id), section: String(section || state.section || "") });
  persistFavorites();
  paintFavBadge();
  renderMobFavorites();
  highlightActive();
  paintSheetFavBtn();
  return i < 0;
}

function paintFavBadge() {
  const n = mobileUi.favs.length;
  if (!els.guideFavBadge) return;
  els.guideFavBadge.hidden = n === 0;
  els.guideFavBadge.textContent = n > 9 ? "9+" : String(n);
  if (els.guideMobFavCount) els.guideMobFavCount.textContent = String(n);
}

function syncGuideLayoutMode() {
  const mobile = isGuideNarrow();
  document.documentElement.setAttribute("data-guide-layout", mobile ? "mobile" : "desktop");
  document.body.classList.toggle("guide-layout-mobile", mobile);
  document.body.classList.toggle("guide-layout-desktop", !mobile);
  // на ПК лендинг «только поиск» не нужен — сразу полный интерфейс
  if (!mobile && state.landing) {
    state.landing = false;
    document.body.classList.remove("guide-landing", "guide-landing-pick");
    if (els.guideLanding) els.guideLanding.hidden = true;
  }
  if (els.guideBnav) els.guideBnav.hidden = !mobile;
  if (!mobile) {
    closeMobileSheet();
    mobileUi.tab = "home";
    document.body.classList.remove("guide-mob-tab-fav", "guide-mob-tab-more", "guide-mob-tab-catalog");
    els.guideMobCatalog?.classList.remove("is-on");
    els.guideMobFav?.classList.remove("is-on");
    els.guideMobMore?.classList.remove("is-on");
    if (els.guideMobCatalog) els.guideMobCatalog.hidden = true;
    if (els.guideMobFav) els.guideMobFav.hidden = true;
    if (els.guideMobMore) els.guideMobMore.hidden = true;
    mobileUi.catalogGroup = null;
    if (navUi.menuOpen) setGuideMenu(false);
  } else {
    paintMobileChrome();
  }
  paintFavBadge();
  syncBrandHeroMode();
}

function syncBrandHeroMode() {
  const typing = Boolean((els.q?.value || state.query || "").trim());
  const on =
    isGuideNarrow() &&
    Boolean(state.landing) &&
    !hasGuideDeepLink() &&
    mobileUi.tab === "home" &&
    !mobileUi.sheetOpen &&
    !typing;
  document.body.classList.toggle("guide-brand-hero-on", on);
  if (els.guideLandingQuick) els.guideLandingQuick.hidden = !on;
}

function paintMobileChrome() {
  if (!isGuideNarrow()) return;
  const tab = mobileUi.tab;
  els.guideBnav?.querySelectorAll("[data-mob-tab]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.mobTab === tab);
  });
  document.body.classList.toggle("guide-mob-tab-fav", tab === "fav");
  document.body.classList.toggle("guide-mob-tab-more", false);
  document.body.classList.toggle("guide-mob-tab-catalog", tab === "catalog");

  const showCat = tab === "catalog";
  const showFav = tab === "fav";
  if (els.guideMobCatalog) {
    els.guideMobCatalog.hidden = !showCat;
    els.guideMobCatalog.classList.toggle("is-on", showCat);
  }
  if (els.guideMobFav) {
    els.guideMobFav.hidden = !showFav;
    els.guideMobFav.classList.toggle("is-on", showFav);
  }
  if (els.guideMobMore) {
    els.guideMobMore.hidden = true;
    els.guideMobMore.classList.remove("is-on");
  }

  // каталог E — отдельный экран, не старый боковой drawer
  if (navUi.menuOpen) setGuideMenu(false);

  if (tab === "catalog") renderMobCatalog();
  if (tab === "fav") renderMobFavorites();
  paintMobChips();
  syncBrandHeroMode();
}

function paintMobChips() {
  const host = els.guideMobChips;
  if (!host) return;
  // На лендинге группы живут во вкладке «Каталог». Под поиском — только разделы текущей группы.
  if (!isGuideNarrow() || mobileUi.tab !== "home" || state.landing) {
    host.hidden = true;
    host.innerHTML = "";
    host.classList.remove("is-sections");
    return;
  }
  const g = groupForSection(state.section) || GUIDE_GROUPS[0];
  host.hidden = false;
  host.classList.add("is-sections");
  host.setAttribute("aria-label", `Разделы: ${g.label}`);
  host.innerHTML = g.sections
    .map((sec) => {
      const on = state.section === sec ? " on" : "";
      const label = SECTION_TITLE[sec] || sec;
      return `<button type="button" class="guide-mob-chip${on}" data-mob-chip-section="${escapeHtml(sec)}"${
        on ? ' aria-current="true"' : ""
      }>${escapeHtml(label)}</button>`;
    })
    .join("");
}

function setMobileTab(tab, { fromClick } = {}) {
  if (!isGuideNarrow()) return;
  const next = ["home", "catalog", "fav"].includes(tab) ? tab : "home";
  if (next === "home" && mobileUi.tab === "home" && fromClick) {
    els.list?.closest(".results-panel")?.scrollTo?.(0, 0);
    els.list?.scrollTo?.(0, 0);
    closeMobileSheet();
    els.q?.focus?.({ preventScroll: true });
    return;
  }
  if (next === "catalog" && mobileUi.tab !== "catalog") {
    mobileUi.catalogGroup = null;
    mobileUi.catalogOpen = state.group || GUIDE_GROUPS[0]?.id || null;
  }
  mobileUi.tab = next;
  if (next === "home" || next === "catalog") closeMobileSheet();
  paintMobileChrome();
}

/** Превью всех разделов свёрнутой группы (B2) — без обрезки «+N» */
function sectionPeeksHtml(sections) {
  const list = Array.isArray(sections) ? sections : [];
  if (!list.length) return "";
  const chips = list
    .map(
      (sec) =>
        `<span class="guide-g-peek">${escapeHtml(SECTION_TITLE[sec] || sec)}</span>`
    )
    .join("");
  return `<span class="guide-g-peeks" aria-hidden="true">${chips}</span>`;
}

function renderMobCatalog() {
  if (!els.guideMobCatList) return;
  if (els.guideMobCatBack) els.guideMobCatBack.hidden = true;
  if (els.guideMobCatTitle) els.guideMobCatTitle.textContent = "Каталог";
  els.guideMobCatList.classList.remove("is-sections", "is-accordion");
  els.guideMobCatList.classList.add("is-segmented");

  if (!mobileUi.catalogOpen) {
    mobileUi.catalogOpen = state.group || GUIDE_GROUPS[0]?.id || null;
  }
  const g = groupById(mobileUi.catalogOpen) || GUIDE_GROUPS[0];
  if (g) mobileUi.catalogOpen = g.id;

  if (els.guideMobCatTotal) {
    els.guideMobCatTotal.hidden = false;
    els.guideMobCatTotal.textContent = g ? `${g.label}` : "Каталог";
  }

  els.guideMobCatList.innerHTML = `<div class="guide-seg" role="tablist" aria-label="Группы">${guideSegButtonsHtml(
    g?.id,
    { mob: true }
  )}</div>${guideSheetHtml(g, { mob: true })}`;
}

function openMobCatalogGroup(groupId) {
  if (!groupId) return;
  const g = groupById(groupId);
  if (!g) return;
  if (g.sections?.length === 1) {
    pickMobCatalogSection(g.sections[0]);
    return;
  }
  mobileUi.catalogOpen = groupId;
  renderMobCatalog();
}

function pickMobCatalogSection(section) {
  if (!section) return;
  leaveLanding();
  const g = groupForSection(section);
  if (g) mobileUi.catalogOpen = g.id;
  if (section !== state.section) setSection(section, { keepQuery: true });
  else {
    applySectionPool();
    updateSectionUi();
    filterAndSort();
  }
  mobileUi.catalogGroup = null;
  setMobileTab("home");
}

function openMobileSheet() {
  if (!isGuideNarrow()) return;
  mobileUi.sheetOpen = true;
  // сразу почти на весь экран — иначе половина карточки «тёмная и обрезанная»
  mobileUi.sheetTall = true;
  document.body.classList.add("guide-sheet-open", "guide-sheet-tall");
  if (els.guideSheetDim) {
    els.guideSheetDim.hidden = false;
    els.guideSheetDim.classList.add("is-on");
  }
  // прокрутка с начала карточки
  requestAnimationFrame(() => {
    const scroller = els.detail?.querySelector(".ttl-detail") || els.detail;
    scroller?.scrollTo?.(0, 0);
  });
  paintSheetFavBtn();
  syncBrandHeroMode();
}

function closeMobileSheet() {
  mobileUi.sheetOpen = false;
  mobileUi.sheetTall = false;
  document.body.classList.remove("guide-sheet-open", "guide-sheet-tall");
  if (els.guideSheetDim) {
    els.guideSheetDim.classList.remove("is-on");
    els.guideSheetDim.hidden = true;
  }
  syncBrandHeroMode();
}

function toggleMobileSheetTall() {
  if (!mobileUi.sheetOpen) return;
  mobileUi.sheetTall = !mobileUi.sheetTall;
  document.body.classList.toggle("guide-sheet-tall", mobileUi.sheetTall);
}

function paintSheetFavBtn() {
  const btn = els.detail?.querySelector("[data-fav-toggle]");
  if (!btn || state.activeId == null) return;
  const sec = btn.dataset.favSection || state.section;
  const on = isFavorite(state.activeId, sec);
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.title = on ? "Убрать из избранного" : "В избранное";
  btn.textContent = on ? "★" : "☆";
}

function sheetChromeHtml(it) {
  if (!isGuideNarrow() || !it) return "";
  const sec = itemSectionOf(it);
  const on = isFavorite(it.id, sec);
  return `<div class="guide-sheet-chrome">
    <button type="button" class="guide-sheet-back" data-sheet-close aria-label="Назад к списку">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
      <span>К списку</span>
    </button>
    <span class="guide-sheet-chrome-spacer" aria-hidden="true"></span>
    <button type="button" class="guide-sheet-fav${on ? " on" : ""}" data-fav-toggle data-fav-section="${escapeHtml(
      sec
    )}" aria-pressed="${on ? "true" : "false"}" title="${on ? "Убрать из избранного" : "В избранное"}">${
      on ? "★" : "☆"
    }</button>
    <button type="button" class="guide-sheet-close" data-sheet-close aria-label="Закрыть">✕</button>
  </div>`;
}

function renderMobFavorites() {
  if (!els.guideMobFavList) return;
  paintFavBadge();
  if (!mobileUi.favs.length) {
    els.guideMobFavList.innerHTML = `<li class="guide-mob-fav-empty">Пока пусто — открой карточку и нажми ☆</li>`;
    return;
  }
  const rows = mobileUi.favs
    .map((f) => {
      const it = findGuideItem(f.id, f.section);
      if (!it) return "";
      const sec = itemSectionOf(it) || f.section;
      const title = sec === "titles";
      const pair = title ? { src: titleBadgeSrc(), fb: "" } : itemImgPair(it);
      const thumb = pair.src
        ? `<span class="result-thumb-frame"><img class="result-thumb" src="${escapeHtml(
            pair.src
          )}" alt="" loading="lazy" decoding="async"${imgFbAttr(pair.fb)} /></span>`
        : `<span class="result-thumb-frame result-thumb-empty" aria-hidden="true"></span>`;
      const meta = SECTION_TITLE[sec] || sec;
      return `<li>
        <button type="button" class="result ttl-result has-img" data-id="${it.id}" data-section="${escapeHtml(sec)}" data-mob-fav-item="1">
          ${thumb}
          <span class="result-main">
            <span class="result-name">${escapeHtml(it.name)}</span>
            <span class="result-meta"><span class="result-sub">${escapeHtml(meta)}</span></span>
          </span>
        </button>
      </li>`;
    })
    .filter(Boolean)
    .join("");
  els.guideMobFavList.innerHTML = rows || `<li class="guide-mob-fav-empty">Сохранённые позиции недоступны</li>`;
}

function loadSort() {
  try {
    const s = localStorage.getItem(SORT_KEY);
    if (SORT_MODES.includes(s)) return s;
  } catch {
    /* ignore */
  }
  return "name";
}

function loadCostCurrency() {
  try {
    const s = localStorage.getItem(COST_CURRENCY_KEY);
    if (COST_CURRENCIES.includes(s)) return s;
  } catch {
    /* ignore */
  }
  return "";
}

function loadSection() {
  try {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("section");
    if (fromUrl === "titles" || WIKI_SECTIONS.has(fromUrl)) return fromUrl;
    const s = localStorage.getItem(SECTION_KEY);
    if (s === "titles" || WIKI_SECTIONS.has(s)) return s;
  } catch {
    /* ignore */
  }
  return "titles";
}

function hasGuideDeepLink() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("section") === "titles" || WIKI_SECTIONS.has(params.get("section") || "")) return true;
    if ((params.get("q") || "").trim()) return true;
    const id = Number(params.get("id"));
    if (Number.isFinite(id) && id > 0) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function queryLooksActive(q = state.query) {
  return String(q || "").replace(/\s+/g, "").length >= 2;
}

function paintLandingChrome() {
  const on = Boolean(state.landing);
  document.body.classList.toggle("guide-landing", on);
  if (!on) document.body.classList.remove("guide-landing-pick");
  if (els.guideLanding) {
    els.guideLanding.hidden = !on || document.body.classList.contains("guide-landing-pick");
  }
  if (on) {
    closeMobileSheet();
    if (els.found) els.found.textContent = "0";
    if (els.list) els.list.innerHTML = "";
    if (els.detail) {
      els.detail.innerHTML = '<div class="preview-empty">Выберите раздел</div>';
    }
  }
  paintMobChips();
  syncBrandHeroMode();
}

function leaveLanding() {
  if (!state.landing) return;
  state.landing = false;
  document.body.classList.remove("guide-landing-pick");
  paintLandingChrome();
}

function openLandingCatalog() {
  if (isGuideNarrow()) {
    setMobileTab("catalog", { fromClick: true });
    return;
  }
  // ПК: показать только каталог слева, список — после выбора раздела
  navUi.collapsed = false;
  document.body.classList.add("guide-landing-pick");
  paintLandingChrome();
  paintGuideSideChrome();
  els.guideSide?.scrollIntoView({ block: "nearest" });
}

function persistSort() {
  try {
    localStorage.setItem(SORT_KEY, state.sort);
  } catch {
    /* ignore */
  }
}

function persistCostCurrency() {
  try {
    localStorage.setItem(COST_CURRENCY_KEY, state.costCurrency || "");
  } catch {
    /* ignore */
  }
}

function persistSection() {
  try {
    localStorage.setItem(SECTION_KEY, state.section);
  } catch {
    /* ignore */
  }
}

function currentTheme() {
  const t = document.documentElement.getAttribute("data-theme");
  return THEME_MODES.includes(t) ? t : "dark";
}

function nextTheme(theme) {
  const i = THEME_MODES.indexOf(theme);
  return THEME_MODES[(i + 1) % THEME_MODES.length];
}

function applyTheme(theme) {
  const t = THEME_MODES.includes(theme) ? theme : "dark";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
  if (els.themeToggle) {
    els.themeToggle.setAttribute("aria-checked", t === "dark" ? "true" : "false");
  }
}

function normalizeItemsView(mode) {
  const raw = String(mode || "").trim();
  if (ITEMS_VIEWS.includes(raw)) return raw;
  if (ITEMS_VIEW_ALIASES[raw]) return ITEMS_VIEW_ALIASES[raw];
  const up = raw.toUpperCase();
  if (ITEMS_VIEWS.includes(up)) return up;
  return "A";
}

function storedItemsView() {
  try {
    return normalizeItemsView(localStorage.getItem(ITEMS_VIEW_KEY) || "A");
  } catch {
    return "A";
  }
}

function applyItemsView(mode, { persist = true, refreshList = true } = {}) {
  const next = normalizeItemsView(mode);
  document.documentElement.setAttribute("data-items-view", next);
  ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((key) => {
    document.body.classList.toggle(`guide-items-${key}`, next === key);
  });
  document.body.classList.toggle("guide-items-list", next === "A");
  document.body.classList.toggle("guide-items-compact", next === "B");
  document.body.classList.toggle("guide-items-tiles", next === "C");
  document.body.classList.toggle("guide-items-cards", next === "D");
  document.body.classList.toggle("guide-items-wide", next === "E");
  document.body.classList.toggle("guide-items-text", false);
  document.body.classList.toggle("guide-items-mini", next === "G");
  document.body.classList.toggle("guide-items-reel", false);
  if (persist) {
    try {
      localStorage.setItem(ITEMS_VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }
  els.itemsView?.querySelectorAll("[data-items-view]").forEach((btn) => {
    const on = normalizeItemsView(btn.dataset.itemsView) === next;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  if (refreshList && els.list && Array.isArray(state?.list)) {
    renderList();
    highlightActive();
  } else {
    syncThumbCarousel();
  }
}

function currentImgSrcMode() {
  const m = document.documentElement.getAttribute("data-img-src");
  return IMG_SRC_MODES.includes(m) ? m : "local";
}

function preferRemoteImages() {
  return currentImgSrcMode() === "remote";
}

function isImgSrcManual() {
  try {
    return localStorage.getItem(IMG_SRC_MANUAL_KEY) === "1";
  } catch {
    return false;
  }
}

function markImgSrcManual() {
  try {
    localStorage.setItem(IMG_SRC_MANUAL_KEY, "1");
  } catch {
    /* ignore */
  }
  document.documentElement.setAttribute("data-img-src-manual", "1");
}

function applyImgSrcMode(mode, { refresh = false, persist = true, manual = false } = {}) {
  const m = IMG_SRC_MODES.includes(mode) ? mode : "local";
  if (manual) markImgSrcManual();
  document.documentElement.setAttribute("data-img-src", m);
  document.documentElement.setAttribute("data-img-src-manual", isImgSrcManual() ? "1" : "0");
  if (persist) {
    try {
      localStorage.setItem(IMG_SRC_KEY, m);
    } catch {
      /* ignore */
    }
  }
  if (els.imgSrcToggle) {
    const remote = m === "remote";
    const locked = isImgSrcManual();
    const srcLabel = remote ? "вики" : "гид";
    els.imgSrcToggle.setAttribute("aria-checked", remote ? "true" : "false");
    els.imgSrcToggle.title = locked
      ? remote
        ? "Вручную: вики · нажми — гид"
        : "Вручную: гид · нажми — вики"
      : remote
        ? "Авто: вики (быстрее у вас) · нажми — выбрать вручную"
        : "Авто: гид (быстрее у вас) · нажми — выбрать вручную";
    els.imgSrcToggle.setAttribute(
      "aria-label",
      locked ? `Источник картинок вручную: ${srcLabel}` : `Источник картинок авто: ${srcLabel}`
    );
    if (els.imgSrcHint) {
      els.imgSrcHint.textContent = locked ? "вручную" : "авто";
    }
  }
  if (refresh) {
    renderList();
    const it =
      state.list.find((x) => x.id === state.activeId) ||
      state.items.find((x) => x.id === state.activeId) ||
      null;
    renderDetail(it);
  }
}

function timeImgProbe(url, timeoutMs = 4500) {
  return new Promise((resolve) => {
    const img = new Image();
    const t0 = performance.now();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      window.clearTimeout(tid);
      resolve({ ok, ms: performance.now() - t0 });
    };
    const tid = window.setTimeout(() => finish(false), timeoutMs);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    try {
      img.referrerPolicy = "no-referrer";
    } catch {
      /* ignore */
    }
    const sep = url.includes("?") ? "&" : "?";
    img.src = `${url}${sep}_probe=${Date.now()}`;
  });
}

/** Кто отвечает быстрее у этого пользователя: гид или вики */
async function probeFasterImgSrc() {
  const local = localImgPath(IMG_SRC_PROBE.local);
  const remote = absRemoteUrl(IMG_SRC_PROBE.remote);
  const [a, b] = await Promise.all([timeImgProbe(local), timeImgProbe(remote)]);
  if (a.ok && !b.ok) return "local";
  if (b.ok && !a.ok) return "remote";
  if (!a.ok && !b.ok) return "local";
  // вики только если заметно быстрее (не дёргаемся из‑за шума сети)
  if (b.ms + 40 < a.ms && b.ms < a.ms * 0.8) return "remote";
  return "local";
}

/** Slim static host (GitHub/Cloudflare Pages) — без тяжёлого data/wiki_img в артефакте. */
function isSlimPagesHost() {
  try {
    const h = String(location.hostname || "");
    return (
      /\.github\.io$/i.test(h) ||
      /\.pages\.dev$/i.test(h) ||
      /\.workers\.dev$/i.test(h)
    );
  } catch {
    return false;
  }
}

/** @deprecated use isSlimPagesHost */
function isGitHubPagesHost() {
  return isSlimPagesHost();
}

async function maybeAutoPickImgSrc() {
  if (isImgSrcManual()) {
    applyImgSrcMode(currentImgSrcMode(), { persist: false });
    return;
  }
  // Pages: локальные data/img + title_img + guide_img (полный wiki_img в артефакт не кладём).
  if (isSlimPagesHost()) {
    applyImgSrcMode("local", {
      refresh: currentImgSrcMode() !== "local",
      persist: true,
    });
    return;
  }
  try {
    const at = Number(localStorage.getItem(IMG_SRC_AUTO_AT_KEY) || 0);
    if (at && Date.now() - at < IMG_SRC_AUTO_TTL_MS) {
      applyImgSrcMode(storedImgSrcMode(), { persist: false });
      return;
    }
  } catch {
    /* ignore */
  }
  const mode = await probeFasterImgSrc();
  if (isImgSrcManual()) return;
  try {
    localStorage.setItem(IMG_SRC_AUTO_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  applyImgSrcMode(mode, { refresh: mode !== currentImgSrcMode(), persist: true });
}

/** Корень сайта с учётом GitHub project Pages (/user.github.io/repo/). */
function siteRootPrefix() {
  try {
    if (/\.github\.io$/i.test(location.hostname)) {
      const parts = String(location.pathname || "").split("/").filter(Boolean);
      if (parts.length) return `/${parts[0]}/`;
    }
  } catch {
    /* ignore */
  }
  return "/";
}

/** Внешний URL картинки. Parapa не используем — все картинки с гида (локальные packs). */
function absRemoteUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (/(?:^|\/\/)(?:www\.)?parapa\.ru\b/i.test(u)) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  // относительные /wiki/... раньше вели на parapa — больше не подставляем
  if (u.startsWith("/")) return "";
  return u;
}

function localImgPath(path) {
  const p = String(path || "").trim();
  if (!p) return "";
  let rel = p.replace(/^\.\//, "").replace(/^\/+/, "");
  // Полный data/wiki_img (~ГБ) в Pages не деплоим — всегда отдаём копию из data/guide_img.
  if (/^data\/wiki_img\//i.test(rel)) {
    const base = rel.split("/").pop();
    if (base) rel = `data/guide_img/${base}`;
  }
  if (isSlimPagesHost() && /^data\//i.test(rel)) {
    const enc = rel
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    return `${location.origin}${siteRootPrefix()}${enc}`;
  }
  return `./${rel}`;
}

/** Выбрать src + запасной путь (для onerror). Картинки только локальные packs. */
function pickImgSources(localPath, remoteUrl) {
  const local = localImgPath(localPath);
  const remote = absRemoteUrl(remoteUrl); // parapa → ""
  // Даже в режиме «вики» не уходим на parapa: remote почти всегда пуст.
  if (preferRemoteImages() && remote) {
    return { src: remote || local, fb: remote && local && remote !== local ? local : "" };
  }
  return { src: local || remote, fb: local && remote && local !== remote ? remote : "" };
}

function imgFbAttr(fb) {
  return fb ? ` data-img-fb="${escapeHtml(fb)}"` : "";
}

function setMenu(on) {
  const open = Boolean(on);
  document.body.classList.toggle("menu-open", open);
  els.sideMenu?.classList.toggle("is-open", open);
  if (els.sideMenu) els.sideMenu.setAttribute("aria-hidden", open ? "false" : "true");
  if (els.menuOpen) els.menuOpen.setAttribute("aria-expanded", open ? "true" : "false");
  if (els.menuBackdrop) els.menuBackdrop.hidden = !open;
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    // в данных часто «Хэллоуин» (э), в запросе — «хеллоуин» (е)
    .replace(/э/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

function opClass(op) {
  const n = Number(op) || 0;
  if (n >= 8) return "ttl-op-8";
  if (n >= 4) return "ttl-op-4";
  if (n >= 2) return "ttl-op-2";
  if (n >= 1) return "ttl-op-1";
  return "ttl-op-0";
}

function opLabel(op) {
  const n = Number(op) || 0;
  if (n <= 0) return "0 ОП";
  return `${n} ОП`;
}

function colorRu(color) {
  const map = {
    red: "красный",
    orange: "оранжевый",
    purple: "фиолетовый",
    yellow: "жёлтый",
    none: "без цвета",
  };
  return map[color] || color || "—";
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Куда ведёт ссылка вики, если это предмет из справочника. */
function wikiLinkTarget(link) {
  if (!link || link.kind !== "item" || !link.section) return null;
  const id = Number(link.itemId);
  if (!Number.isFinite(id)) return null;
  const it =
    link.section === "titles"
      ? (state.titles || []).find((x) => Number(x.id) === id)
      : (state.wiki || []).find((x) => Number(x.id) === id && x.kind === link.section);
  if (!it || isLeakedAchievementItem(it)) return null;
  return { section: link.section, id: it.id, name: it.name || "" };
}

function mergeLinkRanges(ranges) {
  const ordered = [...ranges].sort((a, b) => {
    const pd = (b.priority || 0) - (a.priority || 0);
    if (pd) return pd;
    return b.end - b.start - (a.end - a.start);
  });
  const kept = [];
  for (const r of ordered) {
    if (!(r.end > r.start)) continue;
    if (kept.some((k) => r.start < k.end && r.end > k.start)) continue;
    kept.push(r);
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}

/**
 * Текст описания или способа получения со ссылками вики.
 * Предмет из каталога — кнопка перехода внутри гида, событие и прочие страницы — вики.
 */
function renderWikiLinks(plain, links, extraRanges) {
  const raw = String(plain || "");
  if (!raw) return "";
  const ranges = [];
  for (const link of links || []) {
    const needle = String(link?.text || "").trim();
    if (needle.length < 2 || !link?.href) continue;
    const parts = needle.split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (!parts.length) continue;
    const re = new RegExp(parts.join("\\s+"), "gi");
    let m;
    while ((m = re.exec(raw))) {
      const target = wikiLinkTarget(link);
      ranges.push({
        start: m.index,
        end: m.index + m[0].length,
        link,
        target,
        priority: target ? 4 : 2,
      });
      if (m.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  for (const r of extraRanges || []) {
    const isItem = r.kind === "item" && r.req?.primary;
    ranges.push({ ...r, priority: isItem ? 3 : 1 });
  }
  const kept = mergeLinkRanges(ranges);
  if (!kept.length) return escapeHtml(raw);
  let html = "";
  let cursor = 0;
  for (const r of kept) {
    if (r.start < cursor) continue;
    html += escapeHtml(raw.slice(cursor, r.start));
    const text = escapeHtml(raw.slice(r.start, r.end));
    if (r.target) {
      html += `<button type="button" class="ttl-mark ttl-mark-link" data-wiki-nav="1" data-req-section="${escapeHtml(
        r.target.section
      )}" data-req-id="${r.target.id}" data-req-query="${escapeHtml(
        r.target.name || ""
      )}" title="Открыть в справочнике">${text}</button>`;
    } else if (r.link && r.link.href) {
      html += `<a class="ttl-mark ttl-mark-link ttl-mark-ext" href="${escapeHtml(
        r.link.href
      )}" target="_blank" rel="noopener noreferrer" title="Открыть на вики">${text}</a>`;
    } else if (r.kind === "item" && r.req?.primary) {
      html += `<button type="button" class="ttl-mark ttl-mark-item ttl-mark-link" data-req-section="${escapeHtml(
        r.req.section
      )}" data-req-id="${r.req.primary.id}" data-req-query="${escapeHtml(
        r.req.searchQuery || r.req.label || ""
      )}">${text}</button>`;
    } else {
      const cls =
        r.kind === "color"
          ? "ttl-mark ttl-mark-color"
          : r.kind === "hint"
            ? "ttl-mark ttl-mark-hint"
            : "ttl-mark ttl-mark-item";
      html += `<mark class="${cls}">${text}</mark>`;
    }
    cursor = r.end;
  }
  html += escapeHtml(raw.slice(cursor));
  return html;
}

function fieldLinks(it, ...keys) {
  const out = [];
  for (const key of keys) {
    const arr = it?.[key];
    if (Array.isArray(arr)) out.push(...arr);
  }
  return out;
}

/** Каталог для разбора «что нужно» у достижений */
const REQ_SKIP_KINDS = new Set([
  "achievements",
  "card_bg",
  "show_bg",
  "card_frame",
  "stickers",
  "gems",
  "emotes",
  "forms",
]);
const REQ_KIND_RANK = {
  titles: 100,
  wings: 90,
  transport: 85,
  event_clothes: 80,
  kids_clothes: 78,
  pets: 75,
  amusements: 70,
  interactive: 68,
  accessories: 55,
  hairstyles: 52,
  backpacks: 50,
  wands: 50,
  shoes: 48,
  toys: 45,
  hand_decor: 42,
  umbrellas: 40,
  balloons: 40,
  bows: 40,
  bouquets: 40,
  kids_masks: 35,
};
const REQ_GENERIC = new Set([
  "крылья",
  "титул",
  "титулы",
  "костюм",
  "костюмы",
  "автомобиль",
  "наряд",
  "наряды",
  "плащ",
  "мотоцикл",
  "спорткар",
  "суперкар",
  "джип",
  "карта",
  "карты",
  "комплект",
  "транспорт",
  "цвет",
  "цвета",
]);
const REQ_COLORS =
  "белый|белая|белое|белые|черный|черная|черное|черные|красный|красная|красное|красные|синий|синяя|синее|синие|зеленый|зеленая|зеленое|зеленые|желтый|желтая|желтое|желтые|розовый|розовая|розовое|розовые|фиолетовый|фиолетовая|фиолетовое|фиолетовые|оранжевый|оранжевая|оранжевое|оранжевые|голубой|голубая|голубое|голубые|серый|серая|серое|серые|золотой|золотая|золотое|золотые|серебряный|серебряная|серебряное|серебряные|багряный|багряная|багряные|лазурный|лазурная|лазурные|лиловый|лиловая|лиловые|пестрый|пестрая|пестрые|разноцветный|разноцветная|разноцветные|коричневый|коричневая|коричневые";

let reqCatalog = null;
/** section:id предмета → достижения, где он нужен */
let achRequiresIndex = null;

function stripReqParens(name) {
  return String(name || "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuotedParts(name) {
  const out = [];
  const re = /[«»""„‟"]([^«»""„‟"]{2,80})[«»""„‟"]/g;
  let m;
  while ((m = re.exec(String(name || "")))) {
    out.push(m[1].trim());
  }
  return out;
}

function seriesKeyFromName(name) {
  const q = extractQuotedParts(name)[0];
  if (q) return norm(q);
  let base = stripReqParens(name);
  base = base.replace(new RegExp(`^(?:${REQ_COLORS})\\s+`, "i"), "");
  base = base.replace(
    /^(?:костюм|комплект|свадебный наряд|наряд|парик|фата|очки|жезл|рюкзак)\s+/i,
    ""
  );
  return norm(base);
}

/** Сводим падежи к форме каталога: «орлиных крыльев» → «орлиные крылья» */
function morphReqWord(word) {
  const w = String(word || "");
  if (w.length < 4) return w;
  if (/^крыл/.test(w)) return "крылья";
  if (/^титул/.test(w)) return "титул";
  // прилагательные / причастия в род. и т.п. → им. мн. (орлиных→орлиные, черных→черные)
  if (/(ыми|ими)$/.test(w)) return w.replace(/(ыми|ими)$/, (m) => (m === "ими" ? "ие" : "ые"));
  if (/ых$/.test(w)) return w.replace(/ых$/, "ые");
  if (/их$/.test(w)) return w.replace(/их$/, "ие");
  // ед.ч. согласование с «крыло» почти не встречается; ого/его — для «цвета»
  if (/ого$/.test(w) && w.length >= 6) return w.replace(/ого$/, "ый");
  if (/его$/.test(w) && w.length >= 6) return w.replace(/его$/, "ий");
  // тв.п. ед.: «световым трициклом» → «световой трицикл»
  if (/овым$/.test(w) && w.length >= 6) return w.replace(/овым$/, "овой");
  if (/евым$/.test(w) && w.length >= 6) return w.replace(/евым$/, "евой");
  if (/ым$/.test(w) && w.length >= 5) return w.replace(/ым$/, "ый");
  if (/им$/.test(w) && w.length >= 5) return w.replace(/им$/, "ий");
  return w;
}

function morphReqText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»""„‟']/g, " ")
    .replace(/крыльями|крыльев|крыльях|крыльям|крылу|крылом/g, "крылья")
    .replace(/трона|троном|троне/g, "трон")
    .replace(/титула|титулом|титулу|титулы|титулов/g, "титул")
    .replace(/космобайка/g, "космобайк")
    .replace(/космобайком/g, "космобайк")
    .replace(/квадрокоптером/g, "квадрокоптер")
    .replace(/квадрокоптера/g, "квадрокоптер")
    .replace(/болида/g, "болид")
    .replace(/болидом/g, "болид")
    .replace(/спорткара/g, "спорткар")
    .replace(/спорткаром/g, "спорткар")
    .replace(/суперкара/g, "суперкар")
    .replace(/суперкаром/g, "суперкар")
    .replace(/мотоцикла/g, "мотоцикл")
    .replace(/мотоциклом/g, "мотоцикл")
    .replace(/джипа/g, "джип")
    .replace(/джипом/g, "джип")
    .replace(/чоппера/g, "чоппер")
    .replace(/чоппером/g, "чоппер")
    .replace(/плаща/g, "плащ")
    .replace(/плащом/g, "плащ")
    .replace(/саксофона/g, "саксофон")
    .replace(/саксофоном/g, "саксофон")
    .replace(/скрипкой/g, "скрипка")
    .replace(/скрипки/g, "скрипка")
    .replace(/роялем/g, "рояль")
    .replace(/рояля/g, "рояль")
    .replace(/трициклом|трицикла|трицикле|трициклу/g, "трицикл")
    .replace(/универсума|универсумом|универсуме/g, "универсум")
    .replace(/[!?.,;:…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map(morphReqWord)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function reqEndingOk(after) {
  if (!after || !/[а-яa-z0-9]/i.test(after[0])) return true;
  return /^(а|у|ом|ем|ами|ах|ов|ев|ей|и|ы|е|я|ю|ка|ой|ым|ого|ому|ыми|ными)\b/.test(
    after
  );
}

/** Детская версия предмета (малыши) — не путать со взрослой в требованиях достижений */
function isKidGuideItem(it) {
  if (!it) return false;
  const name = String(it.name || "");
  const wiki = String(it.wiki || "");
  if (/^детск/i.test(name) || /\bдетск(?:ие|ая|ий|ое|их)\b/i.test(name)) return true;
  // wiki: …/Детские_… или percent-encoded Детские
  if (/Детск/i.test(wiki) || /%D0%94%D0%B5%D1%82%D1%81%D0%BA/i.test(wiki)) return true;
  const gender =
    (Array.isArray(it.characteristics)
      ? it.characteristics.find((c) => /пол/i.test(String(c.label || "")))?.value
      : "") || "";
  if (/девочек|мальчиков/i.test(gender) && !/девушек|парней/i.test(gender)) return true;
  // описание: игнор шапки «другие значения, см. Детская…» у взрослой статьи
  const desc = String(it.description || "")
    .replace(/у этого термина существуют и другие значения[^.]*\./gi, " ")
    .trim();
  if (/\bдетск(?:ие|ая|ий|ое|их|ого|ому)\b/i.test(desc)) return true;
  return false;
}

function achTextWantsKids(raw, hay) {
  const t = `${String(raw || "")} ${String(hay || "")}`.toLowerCase();
  return /детск|малыш|реб[её]нк|для\s+малыш/.test(t);
}

function buildReqCatalog() {
  const aliases = [];
  const pushAlias = (alias, entry, weightBoost = 0) => {
    const a = morphReqText(alias);
    if (a.length < 4 || REQ_GENERIC.has(a)) return;
    aliases.push({
      alias: a,
      len: a.length,
      weight: (REQ_KIND_RANK[entry.section] || 20) + weightBoost + Math.min(a.length, 40),
      entry,
    });
  };

  const addEntry = (it, section, kindLabel) => {
    const entry = {
      id: it.id,
      section,
      kindLabel: kindLabel || it.kindLabel || section,
      name: it.name,
      image: it.image || "",
      imageUrl: it.imageUrl || "",
      series: seriesKeyFromName(it.name),
      kid: isKidGuideItem(it),
    };
    pushAlias(it.name, entry, 8);
    const stripped = stripReqParens(it.name);
    if (stripped && stripped !== it.name) pushAlias(stripped, entry, 4);
    for (const q of extractQuotedParts(it.name)) {
      pushAlias(q, entry, q.length >= 6 ? 12 : 2);
    }
    // «Крылья X» / «Детские крылья X» → также ищем «X» если длинный
    const m = /^(?:детские\s+)?крылья\s+(.+)$/i.exec(stripped);
    if (m && morphReqText(m[1]).length >= 5) pushAlias(m[1], entry, -5);
    // «Крылья светлого и темного духа» → отдельно «крылья светлого» / «крылья темного духа»
    if (m && /\s+и\s+/i.test(m[1])) {
      for (const bit of m[1].split(/\s+и\s+/i)) {
        const b = bit.trim();
        if (morphReqText(b).length < 5) continue;
        pushAlias(`крылья ${b}`, entry, 6);
        pushAlias(b, entry, 0);
      }
    }
  };

  for (const it of state.titles) {
    addEntry(it, "titles", "Титул");
  }
  for (const it of state.wiki) {
    if (REQ_SKIP_KINDS.has(it.kind)) continue;
    addEntry(it, it.kind, it.kindLabel || it.kind);
  }

  aliases.sort((a, b) => b.len - a.len || b.weight - a.weight);
  reqCatalog = { aliases };
  achRequiresIndex = null;
}

function pushAchRequireLink(map, section, itemId, ach) {
  if (!section || itemId == null || !ach) return;
  const id = Number(itemId);
  if (!Number.isFinite(id)) return;
  // не линкуем детские предметы, если достижение про взрослых (и наоборот)
  const it =
    section === "titles"
      ? state.titles.find((x) => Number(x.id) === id)
      : state.wiki.find((x) => x.kind === section && Number(x.id) === id);
  if (it && isKidGuideItem(it) && !achTextWantsKids(ach.description || "", "")) return;
  const key = `${section}:${id}`;
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  if (arr.some((a) => a.id === ach.id)) return;
  arr.push({
    id: ach.id,
    name: ach.name,
    image: ach.image || "",
    imageUrl: ach.imageUrl || "",
    category: ach.category || "",
  });
}

/** По note предмета «нужен для значка X» → привязка к достижению X */
function linkItemsFromBadgeNotes(map, achs) {
  const byName = new Map();
  for (const ach of achs) {
    const n = morphReqText(ach.name);
    if (n.length >= 3) byName.set(n, ach);
  }
  const noteRe = /значок\s+[«"«]?([^»"».,;:]+)/gi;
  const pool = [...(state.titles || []), ...(state.wiki || [])];
  for (const it of pool) {
    if (!it || it.kind === "achievements") continue;
    const blob = `${it.note || ""} ${it.description || ""}`;
    if (!/значок/i.test(blob)) continue;
    noteRe.lastIndex = 0;
    let m;
    while ((m = noteRe.exec(blob))) {
      const ach = byName.get(morphReqText(m[1]));
      if (!ach) continue;
      pushAchRequireLink(map, itemSectionOf(it), it.id, ach);
    }
  }
}

/** Индекс: какой предмет нужен для каких достижений (для карточки предмета и списка) */
function buildAchRequiresIndex() {
  if (!reqCatalog) buildReqCatalog();
  const map = new Map();
  const achs = state.wiki.filter((x) => x.kind === "achievements");
  for (const ach of achs) {
    const reqs = findAchievementRequires(ach.description, ach.name);
    for (const r of reqs) {
      for (const item of r.items || []) {
        pushAchRequireLink(map, r.section, item.id, ach);
      }
    }
    // Явные ссылки с вики (itemId) — добивают то, что морфология текста пропускает
    for (const L of ach.descriptionLinks || []) {
      if (L.kind !== "item" || L.itemId == null || !L.section) continue;
      pushAchRequireLink(map, L.section, L.itemId, ach);
    }
    for (const L of ach.characteristicsLinks || []) {
      if (L.kind !== "item" || L.itemId == null || !L.section) continue;
      pushAchRequireLink(map, L.section, L.itemId, ach);
    }
  }
  linkItemsFromBadgeNotes(map, achs);
  for (const arr of map.values()) {
    arr.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
  }
  achRequiresIndex = map;
}

function achievementsForItem(it) {
  if (!it || it.kind === "achievements") return [];
  if (!achRequiresIndex) buildAchRequiresIndex();
  const sec = itemSectionOf(it);
  return achRequiresIndex.get(`${sec}:${it.id}`) || [];
}

function contextKindBoost(hay, pos, section) {
  const window = hay.slice(Math.max(0, pos - 28), pos);
  if (/титул/.test(window) && section === "titles") return 40;
  if (/крыл/.test(window) && section === "wings") return 35;
  if (/(транспорт|авто|мото|спорткар|суперкар|болид|джип|чоппер|квадро)/.test(window) && section === "transport")
    return 35;
  if (/(костюм|наряд|комплект)/.test(window) && (section === "event_clothes" || section === "kids_clothes"))
    return 35;
  if (/питом/.test(window) && section === "pets") return 30;
  if (/(интерактив|предмет для)/.test(window) && (section === "interactive" || section === "amusements"))
    return 30;
  return 0;
}

function quoteContextBoost(raw, quoteText, section) {
  const idx = raw.toLowerCase().indexOf(quoteText.toLowerCase());
  const window = (idx >= 0 ? raw.slice(Math.max(0, idx - 36), idx) : raw).toLowerCase();
  if (/качел/.test(window) && section === "amusements") return 80;
  if (/титул/.test(window) && section === "titles") return 80;
  if (/крыл/.test(window) && section === "wings") return 70;
  if (/(костюм|наряд|комплект)/.test(window) && (section === "event_clothes" || section === "kids_clothes"))
    return 70;
  if (/(мотоцик|спорткар|суперкар|джип|авто|транспорт|болид|чоппер)/.test(window) && section === "transport")
    return 70;
  if (/(интерактив|предмет)/.test(window) && (section === "interactive" || section === "amusements"))
    return 60;
  return 0;
}

function findAchievementRequires(description, selfName = "") {
  if (!reqCatalog) buildReqCatalog();
  const raw = String(description || "").trim();
  if (!raw) return [];

  const hay = morphReqText(raw);
  const selfNorm = morphReqText(selfName);
  const wantsKids = achTextWantsKids(raw, hay);
  const used = new Uint8Array(hay.length);
  const hits = [];

  const allowEntry = (entry) => {
    if (!entry) return false;
    if (entry.kid && !wantsKids) return false;
    if (wantsKids && !entry.kid) {
      // если в каталоге есть детская версия той же серии — берём только её
      const series = entry.series || morphReqText(stripReqParens(entry.name));
      const hasKidTwin = reqCatalog.aliases.some(
        (a) => a.entry.kid && a.entry.section === entry.section && a.entry.series === series
      );
      if (hasKidTwin) return false;
    }
    return true;
  };

  const tryMark = (pos, len, aliasObj) => {
    if (!allowEntry(aliasObj.entry)) return false;
    for (let i = pos; i < pos + len; i++) if (used[i]) return false;
    const before = pos === 0 ? " " : hay[pos - 1];
    const after = hay.slice(pos + len);
    if (/[a-zа-я0-9]/i.test(before)) return false;
    if (!reqEndingOk(after)) return false;
    // «собрать оркестр» ≠ предмет «Оркестр»; «владельцем трона Амура» — да
    if (selfNorm && morphReqText(aliasObj.entry.name) === selfNorm) {
      const prev = hay.slice(Math.max(0, pos - 42), pos);
      const owned = /(владельц|обладател|обзавест|нужен|нужна|нужно\s+быть|иметь)/.test(prev);
      if (!owned) return false;
    }
    const score =
      aliasObj.weight +
      contextKindBoost(hay, pos, aliasObj.entry.section) +
      aliasObj.len;
    for (let i = pos; i < pos + len; i++) used[i] = 1;
    hits.push({ score, entry: aliasObj.entry, alias: aliasObj.alias, pos });
    return true;
  };

  for (const a of reqCatalog.aliases) {
    let from = 0;
    while (from < hay.length) {
      const pos = hay.indexOf(a.alias, from);
      if (pos < 0) break;
      tryMark(pos, a.alias.length, a);
      from = pos + 1;
    }
  }

  // кавычки в исходном тексте: «Скаут» / "Валентино" → серия в каталоге
  const rawQuotes = extractQuotedParts(raw);
  // плюс куски между типовыми кавычками, если extract пропустил вложенность
  const looseQuoteRe = /[«"]([^«»"]{2,80})[»"]/g;
  let lm;
  while ((lm = looseQuoteRe.exec(raw))) {
    rawQuotes.push(lm[1].trim());
  }
  const seenQ = new Set();
  for (const rawQ of rawQuotes) {
    const q = morphReqText(rawQ);
    if (q.length < 2 || REQ_GENERIC.has(q) || seenQ.has(q)) continue;
    seenQ.add(q);

    const candidates = reqCatalog.aliases.filter(
      (a) =>
        allowEntry(a.entry) &&
        (a.alias === q ||
          a.alias.includes(` ${q}`) ||
          a.alias.endsWith(q) ||
          a.alias.includes(q) ||
          a.entry.series === q)
    );
    if (!candidates.length) continue;
    candidates.sort(
      (a, b) =>
        b.weight +
        quoteContextBoost(raw, rawQ, b.entry.section) -
        (a.weight + quoteContextBoost(raw, rawQ, a.entry.section))
    );
    const best = candidates[0];
    const bestSection = best.entry.section;
    const pos = hay.indexOf(q);
    if (pos >= 0) {
      for (let i = pos; i < pos + q.length && i < used.length; i++) used[i] = 1;
    }
    hits.push({
      score: best.weight + 50 + q.length + quoteContextBoost(raw, rawQ, bestSection),
      entry: best.entry,
      alias: q,
      pos: pos < 0 ? 0 : pos,
    });
    const series = best.entry.series || q;
    const seen = new Set([`${best.entry.section}:${best.entry.id}`]);
    for (const c of candidates) {
      const key = `${c.entry.section}:${c.entry.id}`;
      if (seen.has(key)) continue;
      if (c.entry.section !== bestSection) continue;
      if (c.entry.series !== series && !c.alias.includes(q)) continue;
      if (!allowEntry(c.entry)) continue;
      seen.add(key);
      hits.push({
        score: c.weight + 20,
        entry: c.entry,
        alias: q,
        pos: pos < 0 ? 0 : pos,
      });
    }
  }

  // группировка: section + series
  const groups = new Map();
  for (const h of hits) {
    const e = h.entry;
    const series = e.series || morphReqText(stripReqParens(e.name));
    const gkey = `${e.section}::${series}`;
    let g = groups.get(gkey);
    if (!g) {
      g = {
        section: e.section,
        kindLabel: e.kindLabel,
        series,
        score: h.score,
        items: [],
        seen: new Set(),
      };
      groups.set(gkey, g);
    }
    if (!allowEntry(e)) continue;
    g.score = Math.max(g.score, h.score);
    const ik = e.id;
    if (!g.seen.has(ik)) {
      g.seen.add(ik);
      g.items.push(e);
    }
  }

  // если на один series несколько section — оставим сильнейший
  const bySeries = new Map();
  for (const g of groups.values()) {
    const prev = bySeries.get(g.series);
    if (!prev || g.score > prev.score) bySeries.set(g.series, g);
  }

  const list = [...bySeries.values()]
    .filter((g) => g.items.length)
    .sort((a, b) => b.score - a.score);

  return list.map((g) => {
    g.items.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru"));
    // для превью берём картинку с самым «полным» именем
    const primary =
      [...g.items].sort((a, b) => String(b.name).length - String(a.name).length)[0] || g.items[0];
    const quoted = extractQuotedParts(primary.name)[0];
    let label;
    if (g.section === "titles") {
      label = primary.name;
    } else if (quoted) {
      label = /качел/i.test(primary.name) ? `Качели «${quoted}»` : quoted;
    } else if (g.items.length === 1) {
      label = primary.name;
    } else {
      label = stripReqParens(primary.name).replace(new RegExp(`^(?:${REQ_COLORS})\\s+`, "i"), "");
      if (label) label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    const metaParts = [];
    if (g.items.length > 1) {
      const n = g.items.length;
      const word = n % 10 === 1 && n % 100 !== 11 ? "вариант" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "варианта" : "вариантов";
      metaParts.push(`${n} ${word} в гайде`);
    }
    return {
      section: g.section,
      kindLabel: g.kindLabel,
      label,
      meta: metaParts.join(" · "),
      searchQuery: quoted || label,
      primary,
      items: g.items,
    };
  });
}

function reqItemImg(entry) {
  return pickImgSources(entry.image || "", entry.imageUrl || "").src;
}

/** Цвета / оттенки в описаниях достижений (разные формы слова) */
const ACH_COLOR_RE =
  /черно-красн(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|разноцветн(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|радужн(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|пестр(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|багрян(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|лазурн(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|фиолетов(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|оранжев(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|коричневог[оа]|коричнев(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|серебрян(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|золот(?:ые|ой|ая|ое|ых|ыми|ого|ому)?|розов(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|голуб(?:ые|ой|ая|ое|ых|ыми|ого|ому)?|желт(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|зелен(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|красн(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|син(?:ие|ий|яя|ее|их|ими|его|ему|ей)?|бел(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|черн(?:ые|ый|ая|ое|ых|ыми|ого|ому|ой)?|бело(?:го|й|е|му)?/gi;

const ACH_COLOR_HINT_RE =
  /любого\s+другого\s+цвета|любого\s+цвета|всех\s+цветов|всех\s+цвета|любой\s+версии|для\s+своего\s+пола|для\s+твоего\s+пола|соответствующего\s+пола|кроме\s+пестрых/gi;

function shortColorLabel(word) {
  const w = String(word || "").toLowerCase().replace(/ё/g, "е");
  const map = [
    [/черно-красн/, "чёрно-красные"],
    [/разноцвет/, "разноцветные"],
    [/радужн/, "радужные"],
    [/пестр/, "пёстрые"],
    [/багрян/, "багряные"],
    [/лазурн/, "лазурные"],
    [/фиолетов/, "фиолетовые"],
    [/оранжев/, "оранжевые"],
    [/коричнев/, "коричневые"],
    [/серебрян/, "серебряные"],
    [/золот/, "золотые"],
    [/розов/, "розовые"],
    [/голуб/, "голубые"],
    [/желт/, "жёлтые"],
    [/зелен/, "зелёные"],
    [/красн/, "красные"],
    [/син/, "синие"],
    [/бел/, "белые"],
    [/черн/, "чёрные"],
  ];
  for (const [re, label] of map) {
    if (re.test(w)) return label;
  }
  return word;
}

function extractColorsNearPhrase(description, phrase) {
  const raw = String(description || "");
  if (!raw || !phrase) return [];
  const needle = morphReqText(phrase);
  let idx = -1;
  let matchLen = 0;

  // ищем только в исходном тексте (индексы должны совпадать с raw)
  const parts = needle.split(/\s+/).filter((p) => p.length > 2).slice(-4);
  if (parts.length) {
    const body = parts
      .map((p) => {
        if (p === "крылья" || /^крыл/.test(p)) return "крыл[а-я]*";
        const stem = p.replace(/(ые|ие|ый|ий|ая|ое|ее|ы|и)$/u, "");
        if (stem.length >= 4 && stem !== p) {
          return `${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[а-я]*`;
        }
        return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("[\\s\\S]{0,28}");
    const re = new RegExp(body, "i");
    const m = re.exec(raw);
    if (m) {
      idx = m.index;
      matchLen = m[0].length;
    }
  }
  if (idx < 0 && needle.length >= 3) {
    const parts = needle.split(/\s+/).filter((p) => p.length > 2);
    const body = parts
      .map((p) => {
        if (p === "крылья" || /^крыл/.test(p)) return "крыл[а-я]*";
        const stem = p.replace(/(ые|ие|ый|ий|ая|ое|ее|ы|и)$/u, "");
        if (stem.length >= 4 && stem !== p) {
          return `${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[а-я]*`;
        }
        return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("[\\s\\S]{0,28}");
    const re = new RegExp(body || needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const m = re.exec(raw);
    if (m) {
      idx = m.index;
      matchLen = m[0].length;
    }
  }
  if (idx < 0) return [];

  // цвета обычно ПЕРЕД названием: «черные и белые крылья …»
  const before = raw.slice(Math.max(0, idx - 100), idx);
  let colors = extractAllColorLabels(before);

  // либо сразу в скобках после: «крылья фантома (черные и белые)»
  const after = raw.slice(idx + matchLen, idx + matchLen + 60);
  const paren = after.match(/^\s*[\(（]([^\)）]{2,70})[\)）]/);
  if (paren) {
    for (const c of extractAllColorLabels(paren[1])) {
      if (!colors.includes(c)) colors.push(c);
    }
  }

  return colors;
}

function extractAllColorLabels(text) {
  const out = [];
  const seen = new Set();
  const s = String(text || "");
  let m;
  const re = new RegExp(ACH_COLOR_RE.source, "gi");
  while ((m = re.exec(s))) {
    const label = shortColorLabel(m[0]);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

function collectAchHighlightRanges(description, reqs) {
  const raw = String(description || "");
  if (!raw) return [];
  const ranges = [];

  const pushRange = (start, end, kind, req = null) => {
    if (start < 0 || end <= start || end > raw.length) return;
    ranges.push({ start, end, kind, req });
  };

  // цвета
  let m;
  const cre = new RegExp(ACH_COLOR_RE.source, "gi");
  while ((m = cre.exec(raw))) pushRange(m.index, m.index + m[0].length, "color");

  // подсказки про пол / любой цвет
  const hre = new RegExp(ACH_COLOR_HINT_RE.source, "gi");
  while ((m = hre.exec(raw))) pushRange(m.index, m.index + m[0].length, "hint");

  // названия предметов / титулов из требований (с учётом падежей в тексте)
  // важно: \\w в JS без unicode-флага не ест кириллицу → только [а-яa-z]*
  const softPart = (p) => {
    if (p === "крылья" || /^крыл/.test(p)) return "крыл[а-я]*";
    if (p === "титул") return "титул[а-я]*";
    const stem = p.replace(/(ые|ие|ый|ий|ая|ое|ее|ы|и)$/u, "");
    if (stem.length >= 4 && stem !== p) {
      return `${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[а-я]*`;
    }
    return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  for (const r of reqs || []) {
    const candidates = [
      r.label,
      r.searchQuery,
      r.primary?.name,
      ...(r.items || []).map((it) => it.name),
    ].filter(Boolean);
    for (const c of [...candidates]) {
      const q = extractQuotedParts(c)[0];
      if (q) candidates.push(q);
    }
    for (const c of candidates) {
      const needle = morphReqText(String(c).replace(/[«»""„‟']/g, " "));
      if (needle.length < 3) continue;
      const needles = [needle];
      // «крылья светлого и темного духа» → подсветить обе половины в тексте
      if (/^крылья\s+/.test(needle) && /\s+и\s+/.test(needle)) {
        const rest = needle.replace(/^крылья\s+/, "");
        for (const bit of rest.split(/\s+и\s+/)) {
          const b = bit.trim();
          if (b.length >= 5) needles.push(`крылья ${b}`);
        }
      }
      for (const n of needles) {
        const parts = n.split(/\s+/).filter((p) => p.length > 2);
        if (!parts.length) continue;
        // мягкий regex по исходному тексту: «орлиных крыльев» ↔ «орлиные крылья»
        const body = parts.map(softPart).join("[\\s\\S]{0,28}");
        const re = new RegExp(body, "gi");
        let sm;
        while ((sm = re.exec(raw))) {
          pushRange(sm.index, sm.index + sm[0].length, "item", r);
        }
      }
    }
  }

  // quoted phrases in description = often titles/items
  for (const q of extractQuotedParts(raw)) {
    const pos = raw.indexOf(q);
    // extractQuotedParts loses exact index with nested quotes — search
    let from = 0;
    while (from < raw.length) {
      const p = raw.indexOf(q, from);
      if (p < 0) break;
      if (q.length >= 3) pushRange(p, p + q.length, "item");
      from = p + q.length;
    }
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  // collapse overlaps: longer / item > color > hint
  const rank = { item: 3, color: 2, hint: 1 };
  const kept = [];
  for (const r of ranges) {
    const clash = kept.find((k) => !(r.end <= k.start || r.start >= k.end));
    if (!clash) {
      kept.push(r);
      continue;
    }
    if ((rank[r.kind] || 0) > (rank[clash.kind] || 0) || r.end - r.start > clash.end - clash.start) {
      kept.splice(kept.indexOf(clash), 1, r);
    }
  }
  kept.sort((a, b) => a.start - b.start);
  return kept;
}

function highlightAchievementDescription(description, reqs, links) {
  return renderWikiLinks(description, links, collectAchHighlightRanges(description, reqs));
}

function renderAchievementRequires(description, selfName = "") {
  const reqs = findAchievementRequires(description, selfName);
  if (!reqs.length) return { html: "", reqs: [] };
  const cards = reqs
    .map((r) => {
      const it = r.primary;
      const full = findItemBySectionId(r.section, it.id) || it;
      const lookPair = itemLookPair(full);
      const iconPair = itemImgPair(full);
      const reqPair = lookPair.src ? lookPair : iconPair;
      const src = reqPair.src;
      const thumb = src
        ? `<img class="ttl-req-img" src="${escapeHtml(src)}" alt="" loading="lazy" decoding="async"${imgFbAttr(
            reqPair.fb
          )} />`
        : `<span class="ttl-req-img ttl-req-img-empty" aria-hidden="true"></span>`;
      const colors = extractColorsNearPhrase(
        description,
        r.searchQuery || r.label || it?.name || ""
      );
      // для титулов цвета обычно не про цвет предмета
      const showColors = r.section !== "titles" && colors.length > 0;
      const colorHtml = showColors
        ? `<span class="ttl-req-colors">${colors
            .map((c) => `<span class="ttl-req-color">${escapeHtml(c)}</span>`)
            .join("")}</span>`
        : "";
      const facts = reqItemFacts(full, description, r.label || it?.name || "");
      const shopOffers = findShopOffers(
        r.label || it?.name || "",
        colors,
        full?.kind || r.section || ""
      );
      const shopSum = shopOffersSummary(shopOffers) || facts.shopSum;
      const shopHtml = shopSum
        ? `<span class="ttl-req-shop${shopSum.sale ? " is-sale" : ""}">магазин · ${escapeHtml(shopSum.label)}</span>`
        : "";
      const aliceHtml = facts.alice
        ? `<span class="ttl-req-alice">Алиса${
            facts.aliceCost ? ` · ${escapeHtml(facts.aliceCost)}` : ""
          }</span>`
        : "";
      const qtyHtml = facts.qty
        ? `<span class="ttl-req-qty">${escapeHtml(facts.qty)}</span>`
        : "";
      const metaBits = [];
      if (r.meta) metaBits.push(r.meta);
      if (facts.shortSrc) metaBits.push(facts.shortSrc);
      if (showColors) metaBits.push(`нужны цвета: ${colors.join(", ")}`);
      const badges = [shopHtml, aliceHtml].filter(Boolean).join("");
      return `<button type="button" class="ttl-req" data-req-section="${escapeHtml(
        r.section
      )}" data-req-id="${it.id}" data-req-query="${escapeHtml(r.searchQuery)}">
        ${thumb}
        <span class="ttl-req-body">
          <span class="ttl-req-kind">${escapeHtml(r.kindLabel)}${qtyHtml}</span>
          <span class="ttl-req-name">${escapeHtml(r.label)}</span>
          ${colorHtml}
          ${badges ? `<span class="ttl-req-badges">${badges}</span>` : ""}
          ${metaBits.length ? `<span class="ttl-req-meta">${escapeHtml(metaBits.join(" · "))}</span>` : ""}
        </span>
        <span class="ttl-req-go" aria-hidden="true">→</span>
      </button>`;
    })
    .join("");
  return {
    reqs,
    html: `<div class="ttl-req-grid">${cards}</div>
    <p class="ttl-info-hint">Нажми — где взять и как выглядит</p>`,
  };
}

/** Блок на карточке предмета: в каких достижениях он нужен */
function renderItemAchievementsHtml(it) {
  const list = achievementsForItem(it);
  if (!list.length) return "";
  const cards = list
    .map((ach) => {
      const pair = pickImgSources(ach.image || "", ach.imageUrl || "");
      const thumb = pair.src
        ? `<img class="ttl-ach-img" src="${escapeHtml(pair.src)}" alt="" loading="lazy" decoding="async"${imgFbAttr(
            pair.fb
          )} />`
        : `<span class="ttl-ach-img ttl-ach-img-empty" aria-hidden="true"></span>`;
      const cat = ach.category
        ? `<span class="ttl-ach-cat">${escapeHtml(ach.category)}</span>`
        : "";
      return `<button type="button" class="ttl-ach" data-ach-id="${ach.id}" title="Открыть достижение">
        ${thumb}
        <span class="ttl-ach-body">
          <span class="ttl-ach-kind">Достижение</span>
          <span class="ttl-ach-name">${escapeHtml(ach.name)}</span>
          ${cat}
        </span>
        <span class="ttl-ach-go" aria-hidden="true">→</span>
      </button>`;
    })
    .join("");
  return infoSection(
    `В достижениях · ${list.length}`,
    `<div class="ttl-ach-grid">${cards}</div>
    <p class="ttl-info-hint">Нажми — открыть достижение</p>`,
    "ttl-info-achs"
  );
}

function findItemBySectionId(section, id) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;
  if (section === "titles") {
    return state.titles.find((x) => Number(x.id) === numId) || null;
  }
  return (
    state.wiki.find((x) => x.kind === section && Number(x.id) === numId) ||
    state.wiki.find((x) => Number(x.id) === numId) ||
    null
  );
}

function formatShopPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return `${Number(n).toLocaleString("ru-RU")} мнт`;
}

/** Срок из описания магазина → подпись и порядок (Вечно → 30 дней → 7 дней) */
function shopPeriodMeta(offer) {
  const desc = String(offer?.description || "");
  const m = desc.match(/срок:\s*([^.\n]+)/i);
  let raw = (m ? m[1] : "").trim().toLowerCase().replace(/ё/g, "е");
  raw = raw.replace(/\s*тираж[\s\S]*$/i, "").replace(/\)+$/g, "").trim();
  if (!raw || /навсегда|навечно|^вечн/.test(raw)) {
    return { label: "Вечно", rank: 10000 };
  }
  const days = raw.match(/(\d+)\s*дн/);
  if (days) {
    const n = Number(days[1]);
    return { label: `${n} дней`, rank: n };
  }
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  return { label, rank: 5000 };
}

function sortShopOffersByPeriod(offers) {
  return [...(offers || [])].sort((a, b) => {
    const pa = shopPeriodMeta(a);
    const pb = shopPeriodMeta(b);
    return pb.rank - pa.rank || Number(a.price) - Number(b.price);
  });
}

/** Ключ для матча вики ↔ магазин: без пола в скобках и коротких хвостов */
function shopMatchKey(name) {
  return norm(
    String(name || "")
      .replace(/[«»""„‟']/g, " ")
      .replace(/[☆★✦]/g, " ")
      .replace(
        /\s*\((?:жен(?:ск(?:ий|ая|ое|ие|ую|ого|ой)?|\.?)?|муж(?:ск(?:ий|ая|ое|ие|ую|ого|ой)?|\.?)?|ж|м|ж\.|м\.)\)\s*/gi,
        " "
      )
      .replace(/\s*\([^)]{0,28}\)\s*$/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

const SHOP_GENDER_PREFIX =
  /^(?:муж(?:ск(?:ие|ое|ой|ая|ую|ого|ий))?|жен(?:ск(?:ие|ое|ой|ая|ую|ого|ий))?)\s+/iu;

const SHOP_COLOR_PREFIX =
  /^(?:бел(?:ый|ая|ое|ые)|чёрн(?:ый|ая|ое|ые)|черн(?:ый|ая|ое|ые)|красн(?:ый|ая|ое|ые)|розов(?:ый|ая|ое|ые)|ж[её]лт(?:ый|ая|ое|ые)|син(?:ий|яя|ее|ие)|зелён(?:ый|ая|ое|ые)|зелен(?:ый|ая|ое|ые)|фиолетов(?:ый|ая|ое|ые)|оранжев(?:ый|ая|ое|ые)|голуб(?:ой|ая|ое|ые)|пурпурн(?:ый|ая|ое|ые)|аквамаринов(?:ый|ая|ое|ые)|каштанов(?:ый|ая|ое|ые)|золот(?:ой|ая|ое|ые)|серебр(?:яный|яная|яное|яные)|сер(?:ый|ая|ое|ые)|коричнев(?:ый|ая|ое|ые)|бирюзов(?:ый|ая|ое|ые)|малинов(?:ый|ая|ое|ые)|сиренев(?:ый|ая|ое|ые)|изумрудн(?:ый|ая|ое|ые)|лаймов(?:ый|ая|ое|ые)|персиков(?:ый|ая|ое|ые)|алы(?:й|ая|ое|е)|белоснежн(?:ый|ая|ое|ые))\s+/iu;

const SHOP_PACK_PREFIX = /^(?:комплект|набор)\s+/iu;

/** Лёгкая нормализация окончания последнего слова (пингвина → пингвин) */
function shopStemTail(key) {
  const parts = String(key || "").split(" ");
  if (!parts.length) return key;
  const last = parts[parts.length - 1];
  if (last.length < 5) return key;
  const stemmed = last.replace(/(?:ами|ями|ов|ев|ей|ой|ый|ая|ое|ые|ие|ий|ы|и|а|я|у|ю)$/u, "");
  if (stemmed.length < 4) return key;
  parts[parts.length - 1] = stemmed;
  return parts.join(" ");
}

/**
 * Ключи магазина для индекса: полное имя + без пола/цвета/«комплект».
 * Без substring — только точные ключи, чтобы не клеить чужие цены.
 */
function shopIndexKeys(name) {
  const keys = new Set();
  let k = shopMatchKey(name);
  if (!k || k.length < 4) return keys;
  keys.add(k);

  let cur = k.replace(SHOP_GENDER_PREFIX, "").trim();
  if (cur.length >= 4) keys.add(cur);

  for (let i = 0; i < 2; i += 1) {
    const next = cur.replace(SHOP_COLOR_PREFIX, "").trim();
    if (next === cur) break;
    cur = next;
    if (cur.length >= 4) keys.add(cur);
  }

  cur = cur.replace(SHOP_PACK_PREFIX, "").trim();
  if (cur.length >= 4) keys.add(cur);

  for (const base of [...keys]) {
    const stemmed = shopStemTail(base);
    if (stemmed.length >= 4) keys.add(stemmed);
  }
  return keys;
}

/** Ключи поиска с вики: только имя и без пола — цвет с вики не срезаем */
function wikiLookupKeys(name) {
  const keys = new Set();
  const k = shopMatchKey(name);
  if (!k || k.length < 4) return keys;
  keys.add(k);
  const g = k.replace(SHOP_GENDER_PREFIX, "").trim();
  if (g.length >= 4) keys.add(g);
  const stemmed = shopStemTail(g.length >= 4 ? g : k);
  if (stemmed.length >= 4) keys.add(stemmed);
  return keys;
}

/** Разделы магазина, совместимые с kind вики (чтобы маска ≠ питомец с тем же именем) */
const SHOP_CATS_BY_WIKI_KIND = {
  pets: ["pets"],
  wings: ["wings"],
  transport: ["tricks", "child_goods"],
  kids_masks: ["child_goods", "clothes", "items"],
  kids_clothes: ["child_goods", "clothes"],
  event_clothes: ["clothes"],
  accessories: ["clothes", "items"],
  hairstyles: ["clothes"],
  forms: ["clothes"],
  shoes: ["clothes", "items"],
  interactive: ["items"],
  wands: ["items", "clothes"],
  umbrellas: ["items", "clothes"],
  backpacks: ["items", "clothes"],
  balloons: ["items"],
  hand_decor: ["items", "clothes"],
  toys: ["items", "child_goods"],
  bouquets: ["items"],
  bows: ["items", "clothes"],
  amusements: ["items", "tricks"],
  card_bg: ["items", "packs"],
  show_bg: ["items", "packs"],
  card_frame: ["items", "packs"],
  stickers: ["items", "packs"],
  emotes: ["items"],
  gems: ["items", "packs"],
};

function shopCatsForKind(wikiKind) {
  if (!wikiKind) return null;
  return SHOP_CATS_BY_WIKI_KIND[wikiKind] || null;
}

function shopHay(shopItem) {
  return `${shopItem?.name || ""} ${shopItem?.description || ""}`.toLowerCase().replace(/ё/g, "е");
}

/** Отсечь заведомо другой тип товара при совпадении имени */
function shopOfferCompatible(wikiKind, wikiName, shopItem) {
  if (!shopItem) return false;
  const cat = shopItem.category || "";
  const allowed = shopCatsForKind(wikiKind);
  if (allowed && !allowed.includes(cat)) return false;

  const hay = shopHay(shopItem);
  const wikiHay = `${wikiName || ""}`.toLowerCase().replace(/ё/g, "е");

  if (wikiKind === "kids_masks") {
    // «Серый волк»-питомец ≠ «Маска серого волка»
    return /маск/.test(hay) || /маск/.test(wikiHay);
  }
  if (wikiKind === "pets") {
    return cat === "pets";
  }
  if (wikiKind === "wings") {
    return cat === "wings" || /крыл/.test(hay);
  }
  if (wikiKind === "transport") {
    if (cat === "tricks") return true;
    // детский транспорт в child_goods — не маски/подарки/питомцы
    if (cat === "child_goods") {
      return !/маск|подарок|питом/.test(hay) && /велосипед|санк|самокат|роли|транспорт|машин/.test(hay + " " + wikiHay);
    }
    return false;
  }
  if (wikiKind === "toys" && /шт\.?\)|\d+\s*шт/i.test(shopItem.name || "")) {
    return false; // пачки «Снеговик (5 шт.)»
  }
  if (wikiKind === "interactive" && cat === "packs") return false;
  return true;
}

function buildShopIndex() {
  const byKey = new Map();
  for (const it of state.shopItems) {
    if (!it || it.unavailable) continue;
    if (it.price == null || !Number.isFinite(Number(it.price))) continue;
    // лотереи/сертификаты/интерактивы — только под полным именем, без укороченных ключей
    const promo = /лотерейн|билет|сертификат|интерактив\s+для/i.test(it.name || "");
    const keys = promo ? new Set([shopMatchKey(it.name)].filter((x) => x && x.length >= 4)) : shopIndexKeys(it.name);
    for (const key of keys) {
      if (!byKey.has(key)) byKey.set(key, []);
      const list = byKey.get(key);
      if (!list.some((x) => x.id === it.id)) list.push(it);
    }
  }
  state.shopByKey = byKey;
}

function scoreShopOffer(wikiName, shopItem, colors = [], wikiKind = "") {
  if (!shopOfferCompatible(wikiKind, wikiName, shopItem)) return 0;

  const wikiKeys = wikiLookupKeys(wikiName);
  const shopKeys = shopIndexKeys(shopItem.name);
  let best = 0;
  for (const wk of wikiKeys) {
    if (shopKeys.has(wk)) {
      best = Math.max(best, wk === shopMatchKey(wikiName) ? 100 : 90);
    }
  }

  // маски: «Серый волк» ↔ «Маска серого волка (для детей)»
  if (!best && wikiKind === "kids_masks") {
    const wk = shopMatchKey(wikiName);
    const sk = shopMatchKey(shopItem.name);
    if (wk && sk && /маск/.test(sk) && wikiTokensCoveredBy(wk, sk)) {
      best = 95;
    }
  }

  if (!best) return 0;

  const hay = shopHay(shopItem);
  for (const c of colors) {
    const stem = String(c || "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/(ые|ие|ый|ий|ая|ое|ых|их|ыми|ими)$/u, "")
      .slice(0, 5);
    if (stem.length >= 3 && hay.includes(stem)) best += 12;
  }
  if (shopItem.onSale) best += 2;
  return best;
}

/** Все значимые слова вики-имени встречаются в ключе магазина (с учётом окончаний) */
function wikiTokensCoveredBy(wikiKey, shopKey) {
  const tokens = String(wikiKey || "")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (!tokens.length) return false;
  const shopParts = String(shopKey || "").split(" ").filter(Boolean);
  return tokens.every((tok) => {
    const stem = tok.replace(/(?:ого|ему|ыми|ами|ями|ов|ев|ей|ой|ый|ая|ое|ые|ие|ий|ых|их|ы|и|а|я|у|ю|е)$/u, "");
    const prefix = (stem.length >= 4 ? stem : tok).slice(0, Math.min(5, Math.max(3, (stem || tok).length)));
    if (prefix.length < 3) return shopKey.includes(tok);
    return shopParts.some((p) => p.startsWith(prefix) || tok.startsWith(p.slice(0, prefix.length)));
  });
}

/** Предложения из магазина игры (parapa.ru/mall) для предмета вики */
function findShopOffers(wikiName, colors = [], wikiKind = "") {
  if (!wikiName || !state.shopItems.length) return [];
  if (!state.shopByKey) buildShopIndex();

  const lookup = wikiLookupKeys(wikiName);
  const candidates = new Map();

  const consider = (it) => {
    if (!it || it.unavailable) return;
    const sc = scoreShopOffer(wikiName, it, colors, wikiKind);
    if (sc < 90) return;
    const prev = candidates.get(it.id);
    if (!prev || sc > prev.score) candidates.set(it.id, { item: it, score: sc });
  };

  for (const key of lookup) {
    for (const it of state.shopByKey.get(key) || []) consider(it);
  }

  // детские маски часто названы на вики без слова «маска»
  if (wikiKind === "kids_masks") {
    for (const it of state.shopItems) {
      if (it?.unavailable) continue;
      if (!/маск/i.test(`${it.name || ""} ${it.description || ""}`)) continue;
      consider(it);
    }
  }

  return [...candidates.values()]
    .sort((a, b) => b.score - a.score || a.item.price - b.item.price)
    .slice(0, 8)
    .map((x) => x.item);
}

function shopOffersSummary(offers) {
  if (!offers?.length) return null;
  const prices = offers.map((o) => Number(o.price)).filter((n) => Number.isFinite(n));
  if (!prices.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const sale = offers.some((o) => o.onSale || (o.priceOld != null && o.priceOld > o.price));
  return {
    min,
    max,
    sale,
    label: min === max ? formatShopPrice(min) : `от ${formatShopPrice(min)}`,
    count: offers.length,
  };
}

/** Цена в магазине для предмета каталога (достижения пропускаем) */
function itemShopOffers(it) {
  if (!it?.name) return [];
  if (it.kind === "achievements") return [];
  return findShopOffers(it.name, [], it.kind || "");
}

/** Сколько штук/пар нужно — из текста достижения рядом с названием */
function extractQtyNearPhrase(description, phrase) {
  const raw = String(description || "");
  const needle = norm(phrase || "");
  if (!raw || needle.length < 3) return "";
  const low = norm(raw);
  const key = needle.split(/\s+/).slice(0, 3).join(" ");
  let idx = low.indexOf(key);
  if (idx < 0) {
    const short = needle.split(/\s+/).filter((w) => w.length >= 4)[0];
    if (short) idx = low.indexOf(short);
  }
  if (idx < 0) return "";
  const window = raw.slice(Math.max(0, idx - 40), Math.min(raw.length, idx + key.length + 48));
  const m =
    window.match(
      /(\d+)\s*(?:шт\.?|штук(?:и|а)?|пар[аыу]|комплект(?:а|ов)?|крыл(?:а|ьев)?|раз[а]?)?/i
    ) || window.match(/(?:нужн[аоые]{1,3}|требуется|собрать|надеть|иметь)\s+(\d+)/i);
  if (!m) return "";
  const n = m[1];
  if (!n || n === "1") return "";
  return `${n} шт.`;
}

/** Краткие факты предмета для карточки требования / peek */
function reqItemFacts(it, description, label) {
  const source = String(it?.source || "").trim();
  const shortSrc = source
    ? source.length > 72
      ? `${source.slice(0, 70)}…`
      : source
    : "";
  const qty = extractQtyNearPhrase(description, label || it?.name || "");
  const alice = isAliceExchange(it);
  const aliceCost = alice ? aliceExchangeCost(it) : "";
  const colors = [];
  const shopOffers = it
    ? findShopOffers(it.name || label || "", colors, it.kind || "")
    : [];
  const shopSum = shopOffersSummary(shopOffers);
  return { source, shortSrc, qty, alice, aliceCost, shopOffers, shopSum };
}

const ALICE_SOURCE_RE = /алиса\s*\(\s*обмен\s+подарков\s*\)/i;
const ALICE_WIKI_URL =
  "https://parapa.ru/wiki/index.php/%D0%90%D0%BB%D0%B8%D1%81%D0%B0_%D0%BE%D0%B1%D0%BC%D0%B5%D0%BD_%D0%BF%D0%BE%D0%B4%D0%B0%D1%80%D0%BA%D0%BE%D0%B2";

function isAliceExchange(it) {
  if (!it) return false;
  return (
    ALICE_SOURCE_RE.test(it.source || "") ||
    ALICE_SOURCE_RE.test(it.category || "") ||
    ALICE_SOURCE_RE.test(it.note || "")
  );
}

/** Стоимость обмена у Алисы из description/note/source */
function aliceExchangeCost(it) {
  const blob = [it?.description, it?.note, it?.source].filter(Boolean).join(" \n ");
  const m = blob.match(
    /((?:для обмена|требуется|нужно)[^\n.]{0,120}?\d[^\n.]{0,80}\.?)/i
  );
  return m ? m[1].replace(/\s+/g, " ").trim() : "";
}

/** Одна секция карточки: подпись слева, текст справа. Пустое не рисуем. */
function infoSection(label, bodyHtml, extraClass = "") {
  if (!bodyHtml) return "";
  const cls = extraClass ? ` ${extraClass}` : "";
  return `<section class="ttl-info-sec${cls}">
    <h3 class="ttl-info-label">${escapeHtml(label)}</h3>
    <div class="ttl-info-body">${bodyHtml}</div>
  </section>`;
}

function aliceExchangeHtml(it) {
  if (!isAliceExchange(it)) return "";
  const cost = aliceExchangeCost(it);
  const body = `${
    cost
      ? `<p class="ttl-info-text">${escapeHtml(cost)}</p>`
      : `<p class="ttl-info-text">Предмет есть в обмене подарков.</p>`
  }<a class="ttl-wiki-link" href="${ALICE_WIKI_URL}" target="_blank" rel="noopener noreferrer">Страница обмена →</a>`;
  return infoSection("Обмен у Алисы", body, "ttl-info-alice");
}

function shopBadgeHtml(offers, className = "ttl-req-shop") {
  const sum = shopOffersSummary(offers);
  if (!sum) return "";
  return `<span class="${className}${sum.sale ? " is-sale" : ""}">магазин · ${escapeHtml(
    sum.label
  )}</span>`;
}

function renderShopOffersHtml(offers) {
  if (!offers?.length) return "";
  const sorted = sortShopOffersByPeriod(offers);
  const rows = sorted
    .map((o) => {
      const period = shopPeriodMeta(o);
      const sale = o.onSale || (o.priceOld != null && o.priceOld > o.price);
      const url = o.url || `https://parapa.ru/mall/goods/${o.id}/`;
      const name = (o.name || "").trim();
      const old =
        o.priceOld != null && o.priceOld > o.price
          ? `<span class="ttl-shop-old">${escapeHtml(formatShopPrice(o.priceOld))}</span>`
          : "";
      return `<a class="ttl-shop-row${sale ? " is-sale" : ""}" href="${escapeHtml(
        url
      )}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(
        name ? `${name} · ${period.label}` : period.label
      )}">
        <span class="ttl-shop-name">${escapeHtml(name || "В магазине")}</span>
        <span class="ttl-shop-term">${escapeHtml(period.label)}</span>
        <span class="ttl-shop-price">${old}<b>${escapeHtml(formatShopPrice(o.price))}</b></span>
      </a>`;
    })
    .join("");
  return infoSection("Магазин", `<div class="ttl-shop-list">${rows}</div>`, "ttl-info-shop");
}

function closeReqPeek() {
  const peek = document.getElementById("guideReqPeek");
  if (!peek) return;
  peek.classList.remove("is-on");
  peek.setAttribute("aria-hidden", "true");
  document.body.classList.remove("guide-req-peek-open");
  window.setTimeout(() => {
    if (!peek.classList.contains("is-on")) peek.remove();
  }, 200);
}

/** Быстрый просмотр нужного предмета без ухода с достижения */
function captureNavBackFromAchievement() {
  const cur =
    state.items.find((x) => x.id === state.activeId) ||
    state.wiki.find((x) => x.kind === "achievements" && x.id === state.activeId) ||
    null;
  const fromAch =
    state.section === "achievements" || cur?.kind === "achievements";
  if (!fromAch || state.activeId == null) return;
  state.navBack = {
    section: "achievements",
    group: state.group || groupForSection("achievements").id,
    id: state.activeId,
    query: state.query || "",
    category: state.category || "",
    sourceBucket: state.sourceBucket || "all",
    op: state.op || "",
    name: cur?.name || "",
  };
}

function clearNavBack() {
  state.navBack = null;
}

function navBackHtml() {
  const back = state.navBack;
  if (!back) return "";
  const toAch = back.section === "achievements";
  const label = back.name
    ? toAch
      ? `К достижению «${escapeHtml(back.name)}»`
      : `К «${escapeHtml(back.name)}»`
    : toAch
      ? "К достижению"
      : "Назад";
  return `<button type="button" class="guide-nav-back" data-guide-nav-back title="${
    toAch ? "Вернуться к достижению" : "Вернуться к предмету"
  }">
    <span class="guide-nav-back-arrow" aria-hidden="true">←</span>
    <span class="guide-nav-back-label">${label}</span>
  </button>`;
}

/** Открыть достижение с карточки предмета (с кнопкой «назад») */
function openAchievementFromItem(achId) {
  const cur =
    state.items.find((x) => x.id === state.activeId) ||
    state.list.find((x) => x.id === state.activeId) ||
    findGuideItem(state.activeId, state.section) ||
    null;
  if (cur && state.activeId != null) {
    state.navBack = {
      section: itemSectionOf(cur),
      group: state.group || groupForSection(itemSectionOf(cur)).id,
      id: state.activeId,
      query: state.query || "",
      category: state.category || "",
      sourceBucket: state.sourceBucket || "all",
      op: state.op || "",
      name: cur.name || "",
    };
  }
  closeGuideZoom();
  closeReqPeek();
  state.query = "";
  if (els.q) els.q.value = "";
  const section = "achievements";
  state.group = groupForSection(section).id;
  if (section !== state.section) {
    setSection(section, { keepQuery: true, keepNavBack: true });
  } else {
    state.category = "";
    applySectionPool();
    buildCategoryPills();
    updateSectionUi();
    updatePillsUi();
  }
  filterAndSort();
  const numId = Number(achId);
  if (Number.isFinite(numId) && state.items.some((x) => x.id === numId)) {
    selectItem(numId, section);
  }
  els.detail?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function goNavBack() {
  const back = state.navBack;
  if (!back?.section || back.id == null) return;
  clearNavBack();
  closeReqPeek();
  closeGuideZoom();

  state.query = back.query || "";
  if (els.q) els.q.value = state.query;
  state.category = back.category || "";
  state.sourceBucket = back.sourceBucket || "all";
  state.op = back.op || "";
  state.group = back.group || groupForSection(back.section).id;

  if (back.section !== state.section) {
    state.section = back.section;
    persistSection();
    try {
      localStorage.setItem(GROUP_KEY, state.group);
    } catch {
      /* ignore */
    }
  }
  applySectionPool();
  buildCategoryPills();
  updateSectionUi();
  updatePillsUi();
  filterAndSort();

  const numId = Number(back.id);
  if (Number.isFinite(numId) && state.items.some((x) => x.id === numId)) {
    selectItem(numId);
  } else if (state.list[0]) {
    selectItem(state.list[0].id);
  }
  els.detail?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function openReqPeek(section, id, query, extras = {}) {
  if (!section) return;
  closeReqPeek();
  closeGuideZoom();

  const it = findItemBySectionId(section, id);
  const kindLabel =
    extras.kindLabel ||
    it?.kindLabel ||
    (section === "titles" ? "Титул" : SECTION_TITLE[section] || section);
  const name = it?.name || query || "Предмет";
  const pair = it ? itemImgPair(it) : { src: "", fb: "" };
  const lookPair = it ? itemLookPair(it) : { src: "", fb: "" };
  const src = lookPair.src || pair.src;
  const fb = lookPair.src ? lookPair.fb : pair.fb;
  const colors = Array.isArray(extras.colors) ? extras.colors.filter(Boolean) : [];
  const shopOffers = findShopOffers(name, colors, it?.kind || section || "");
  const facts = reqItemFacts(it, extras.achDescription || "", name);
  const isPeekTitle = section === "titles" || it?.kind === "titles";
  const isPeekAch = section === "achievements" || it?.kind === "achievements";
  const peekReqs = isPeekAch ? renderAchievementRequires(it?.description || "", it?.name || "") : { html: "", reqs: [] };
  const peekWiki =
    it?.wiki ||
    (isPeekTitle
      ? state.titlesMeta?.source || "https://parapa.ru/wiki/index.php/%D0%A2%D0%B8%D1%82%D1%83%D0%BB"
      : "");
  const peekStack = itemInfoStackHtml(it, {
    isTitle: isPeekTitle,
    isAch: isPeekAch,
    hideVariants: Array.isArray(it?.lookVariants) && it.lookVariants.filter((v) => lookVariantSrc(v)).length >= 2,
    shopOffers: isPeekAch ? [] : shopOffers,
    reqs: peekReqs.reqs,
    reqsHtml: peekReqs.html
      ? infoSection(`Нужные предметы · ${peekReqs.reqs.length}`, peekReqs.html, "ttl-info-reqs")
      : "",
    beforeHtml: facts.qty
      ? infoSection("Сколько нужно", `<p class="ttl-info-text">${escapeHtml(facts.qty)}</p>`)
      : "",
    wikiUrl: peekWiki,
  });
  const mediaHtml = src
    ? `<button type="button" class="guide-req-peek-zoom ttl-zoom-btn" data-zoom-src="${escapeHtml(
        src
      )}" data-zoom-fb="${escapeHtml(fb || "")}" data-zoom-name="${escapeHtml(
        name
      )}" title="Открыть картинку крупно" aria-label="Открыть картинку крупно: ${escapeHtml(name)}">
        <img class="guide-req-peek-img" src="${escapeHtml(src)}" alt=""${imgFbAttr(fb)} />
        <span class="guide-req-peek-zoom-hint">увеличить</span>
      </button>`
    : `<div class="guide-req-peek-img guide-req-peek-img-empty" aria-hidden="true"></div>`;

  const peek = document.createElement("div");
  peek.id = "guideReqPeek";
  peek.className = "guide-req-peek";
  peek.setAttribute("role", "dialog");
  peek.setAttribute("aria-modal", "true");
  peek.setAttribute("aria-label", `Предмет: ${name}`);
  peek.innerHTML = `
    <div class="guide-req-peek-card">
      <button type="button" class="guide-req-peek-close" aria-label="Закрыть">✕</button>
      <div class="guide-req-peek-media">${mediaHtml}</div>
      <div class="guide-req-peek-body">
        <span class="guide-req-peek-kind">${escapeHtml(kindLabel)}</span>
        <h2 class="guide-req-peek-name">${escapeHtml(name)}</h2>
        ${
          colors.length
            ? `<div class="guide-req-peek-colors">${colors
                .map((c) => `<span class="ttl-req-color">${escapeHtml(c)}</span>`)
                .join("")}</div>`
            : ""
        }
        ${peekStack}
        <div class="guide-req-peek-actions">
          <button type="button" class="guide-req-peek-btn guide-req-peek-dismiss">Закрыть</button>
          <button type="button" class="guide-req-peek-btn guide-req-peek-go">Перейти к предмету</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(peek);
  document.body.classList.add("guide-req-peek-open");
  requestAnimationFrame(() => {
    peek.classList.add("is-on");
    peek.setAttribute("aria-hidden", "false");
  });

  const go = () => {
    closeReqPeek();
    openRequiredItem(section, id, query || name);
  };
  peek.addEventListener("click", (e) => {
    const zoomBtn = e.target.closest(".guide-req-peek-zoom, [data-zoom-src]");
    if (zoomBtn && peek.contains(zoomBtn)) {
      e.preventDefault();
      e.stopPropagation();
      openGuideZoom(
        zoomBtn.dataset.zoomSrc || src,
        zoomBtn.dataset.zoomName || name,
        zoomBtn.dataset.zoomFb || ""
      );
      return;
    }
    const extLink = e.target.closest("a.ttl-mark-ext");
    if (extLink && peek.contains(extLink)) return;
    const wikiJump = e.target.closest("[data-wiki-nav]");
    if (wikiJump && peek.contains(wikiJump)) {
      e.preventDefault();
      openRequiredItem(wikiJump.dataset.reqSection || "", wikiJump.dataset.reqId, wikiJump.dataset.reqQuery || "");
      return;
    }
    const achBtn = e.target.closest(".ttl-ach[data-ach-id]");
    if (achBtn && peek.contains(achBtn)) {
      e.preventDefault();
      closeReqPeek();
      openAchievementFromItem(achBtn.dataset.achId);
      return;
    }
    const reqBtn = e.target.closest(".ttl-req, .ttl-mark-link");
    if (reqBtn && peek.contains(reqBtn)) {
      e.preventDefault();
      const colors = [...reqBtn.querySelectorAll(".ttl-req-color")].map((el) => el.textContent.trim());
      const kindLabel = reqBtn.querySelector(".ttl-req-kind")?.textContent?.trim() || "";
      openReqPeek(reqBtn.dataset.reqSection || "", reqBtn.dataset.reqId, reqBtn.dataset.reqQuery || "", {
        colors,
        kindLabel,
        achDescription: it?.description || extras.achDescription || "",
      });
      return;
    }
    if (e.target === peek || e.target.closest(".guide-req-peek-close, .guide-req-peek-dismiss")) {
      closeReqPeek();
      return;
    }
    if (e.target.closest(".guide-req-peek-go")) go();
  });
}

function openRequiredItem(section, id, query) {
  if (!section) return;
  captureNavBackFromAchievement();
  closeGuideZoom();
  closeReqPeek();
  state.query = query || "";
  if (els.q) els.q.value = state.query;
  state.group = groupForSection(section).id;
  if (section !== state.section) {
    setSection(section, { keepQuery: true, keepNavBack: true });
  } else {
    state.category = "";
    applySectionPool();
    buildCategoryPills();
    updateSectionUi();
    updatePillsUi();
  }
  if (els.q) els.q.value = state.query;
  filterAndSort();
  const numId = Number(id);
  if (Number.isFinite(numId) && state.items.some((x) => x.id === numId)) {
    selectItem(numId, section);
  } else if (state.list[0]) {
    selectItem(state.list[0].id, itemSectionOf(state.list[0]));
  }
  els.detail?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function isTitles() {
  return state.section === "titles";
}

/** Раздел записи (у титулов нет kind) */
function itemSectionOf(it) {
  if (!it) return state.section;
  if (it.kind && (WIKI_SECTIONS.has(it.kind) || it.kind === "titles")) return it.kind;
  return "titles";
}

function isTitleItem(it) {
  return itemSectionOf(it) === "titles";
}

/** При текстовом поиске смотрим весь справочник, не только открытый раздел */
/** Порциями рисуем список; в разделе без поиска — сразу все */
const LIST_RENDER_PAGE = 240;
let listRenderLimit = LIST_RENDER_PAGE;

function guideSearchPool(q) {
  if (!q) return state.items;
  // 1 символ → почти весь каталог; не раздуваем DOM и не тормозим ввод
  if (String(q).replace(/\s+/g, "").length < 2) return state.items;
  const out = [];
  for (const it of state.titles) out.push(it);
  for (const it of state.wiki) {
    if (!isLeakedAchievementItem(it)) out.push(it);
  }
  return out;
}

/** Варианты написания / синонимы для поиска в гиде */
/** Варианты написания (хеллоуин / хеллуин / halloween…) */
const GUIDE_SYNONYM_GROUPS = [
  ["хеллоуин", "хеллуин", "хэллоуин", "хэллуин", "halloween", "хеллоуинск", "хэллоуинск"],
];

function expandGuideToken(token) {
  const t = norm(token);
  if (!t) return [];
  const forms = new Set([t]);
  for (const group of GUIDE_SYNONYM_GROUPS) {
    const g = group.map(norm);
    if (g.some((x) => x === t || (t.length >= 4 && (x.startsWith(t) || t.startsWith(x))))) {
      g.forEach((x) => forms.add(x));
    }
  }
  return [...forms];
}

/** Общий значок титула в игре (одинаковый у всех) */
function titleBadgeSrc() {
  return isSlimPagesHost()
    ? `${location.origin}${siteRootPrefix()}data/title_img/3d077203ce.png`
    : "./data/title_img/3d077203ce.png";
}

function itemImgPair(it) {
  if (!it) return { src: "", fb: "" };
  const own = pickImgSources(it.image || "", it.imageUrl || "");
  if (own.src) return own;
  const offers = itemShopOffers(it);
  for (const o of offers) {
    const p = pickImgSources(o.imageLocal || "", o.image || "");
    if (p.src) return p;
  }
  return { src: "", fb: "" };
}

function itemImgSrc(it) {
  return itemImgPair(it).src;
}

/**
 * Реальные картинки товара (вид / варианты / скрин).
 * Если пусто — в списке останется обычный значок.
 */
function itemShowcasePairs(it) {
  if (!it) return [];
  const out = [];
  const seen = new Set();
  const add = (pair) => {
    const src = String(pair?.src || "").trim();
    if (!src || seen.has(src)) return;
    seen.add(src);
    out.push({ src, fb: pair.fb || "" });
  };

  const sec = itemSectionOf(it);
  if (sec === "titles") {
    // скрин текста титула (не общий игровой значок)
    add(itemImgPair(it));
    return out.slice(0, THUMB_CAROUSEL_MAX);
  }

  // Картинки только из локальных packs (guide_img / data/img). Parapa не используем.
  const badge = itemImgPair(it);
  const variants = Array.isArray(it.lookVariants) ? it.lookVariants : [];
  for (const v of variants) {
    const p = lookVariantPair(v);
    if (p.src) add({ src: p.src, fb: p.fb || badge.src || "" });
  }
  {
    const look = itemLookPair(it);
    if (look.src && look.src !== badge.src) add({ src: look.src, fb: look.fb || badge.src || "" });
  }
  for (const o of itemShopOffers(it)) {
    const p = pickImgSources(o.lookLocal || "", "");
    if (p.src) add({ src: p.src, fb: p.fb || badge.src || "" });
  }

  // Значок всегда первый (локальный guide_img). Look'и — дополнительные слайды.
  if (badge.src) {
    const rest = out.filter((p) => p.src !== badge.src);
    return [{ src: badge.src, fb: badge.fb || "" }, ...rest].slice(0, THUMB_CAROUSEL_MAX);
  }
  if (!out.length && sec === "achievements") add(itemImgPair(it));
  return out.slice(0, THUMB_CAROUSEL_MAX);
}

function stopThumbCarousel() {
  if (thumbCarouselTimer) {
    clearInterval(thumbCarouselTimer);
    thumbCarouselTimer = null;
  }
}

function syncThumbCarousel() {
  stopThumbCarousel();
  if (!els.list) return;
  const frames = els.list.querySelectorAll(".result-thumb-carousel");
  if (!frames.length) return;
  thumbCarouselTimer = setInterval(() => {
    frames.forEach((frame) => {
      if (!frame.isConnected) return;
      const slides = frame.querySelectorAll(".result-thumb-slide");
      if (slides.length < 2) return;
      let cur = -1;
      slides.forEach((s, i) => {
        if (s.classList.contains("is-on")) cur = i;
      });
      const next = (cur + 1 + slides.length) % slides.length;
      slides.forEach((s, i) => s.classList.toggle("is-on", i === next));
    });
  }, THUMB_CAROUSEL_MS);
}

/** В любом виде: реальные картинки если есть, иначе значок */
function resultThumbHtml(it, { title = false } = {}) {
  const showcase = itemShowcasePairs(it);
  if (showcase.length) {
    const slides = showcase
      .map(
        (p, i) =>
          `<img class="result-thumb result-thumb-slide${i === 0 ? " is-on" : ""}" src="${escapeHtml(
            p.src
          )}" alt="" loading="lazy" decoding="async"${imgFbAttr(p.fb)} />`
      )
      .join("");
    const cls =
      showcase.length > 1 ? "result-thumb-frame result-thumb-carousel" : "result-thumb-frame";
    return `<span class="${cls}" data-count="${showcase.length}">${slides}</span>`;
  }

  const badgePair = title ? { src: titleBadgeSrc(), fb: "" } : itemImgPair(it);
  if (badgePair.src) {
    return `<span class="result-thumb-frame"><img class="result-thumb" src="${escapeHtml(
      badgePair.src
    )}" alt="" loading="lazy" decoding="async"${imgFbAttr(badgePair.fb)} /></span>`;
  }
  return title
    ? `<span class="ttl-swatch ${opClass(it.op)}" aria-hidden="true"></span>`
    : `<span class="result-thumb-frame result-thumb-empty" aria-hidden="true"></span>`;
}

/** Скрин титула (как выглядит текст) — для карточки */
function titleShotSrc(it) {
  return itemImgSrc(it);
}

function itemLookPair(it) {
  if (!it) return { src: "", fb: "" };
  const badge = itemImgPair(it);
  const own = pickImgSources(it.lookImage || "", "");
  if (own.src) return { src: own.src, fb: own.fb || badge.src || "" };
  const offers = itemShopOffers(it);
  for (const o of offers) {
    const p = pickImgSources(o.lookLocal || "", "");
    if (p.src) return { src: p.src, fb: p.fb || badge.src || "" };
  }
  return badge;
}

/** Полный внешний вид предмета — отдельно от значка в списке */
function itemLookSrc(it) {
  return itemLookPair(it).src;
}

/** Картинка товара в инфо-блоке (не значок из списка) */
function detailProductSrc(it) {
  if (!it) return "";
  const look = itemLookSrc(it);
  if (look) return look;
  // нет отдельного «вида» — показываем иконку из списка (крылья, транспорт и т.п.)
  return itemImgSrc(it);
}

function detailProductPair(it) {
  if (!it) return { src: "", fb: "" };
  const look = itemLookPair(it);
  if (look.src) return look;
  return itemImgPair(it);
}

/** Класс размера: фоны/рамки сильно ужимаем, чтобы не растягивали карточку */
function lookImgClass(it) {
  const kind = it?.kind || "";
  if (kind === "card_bg" || kind === "show_bg") return "wiki-look-img is-wide";
  if (kind === "card_frame") return "wiki-look-img is-frame";
  if (kind === "emotes") return "wiki-look-img is-gif";
  return "wiki-look-img";
}

function lookVariantPair(v) {
  if (!v) return { src: "", fb: "" };
  return pickImgSources(v.image || "", "");
}

function lookVariantSrc(v) {
  return lookVariantPair(v).src;
}

function variantGender(v) {
  const g = String(v?.gender || "").toLowerCase();
  if (g === "м" || g === "ж") return g;
  const m = String(v?.label || "").match(/\(([мж])\)\s*$/i);
  return m ? m[1].toLowerCase() : "";
}

function variantColorLabel(v, itemName) {
  let lab = String(v?.label || "")
    .replace(/\s*\(([мж])\)\s*$/i, "")
    .trim();
  if (!lab) return "";
  if (/^анимац/i.test(lab)) return lab;
  const fold = (s) => String(s || "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  const nlab = fold(lab);
  const nname = fold(itemName);
  const nbase = fold(String(itemName || "").replace(/\s*\(([мж])\)\s*$/i, ""));
  if (nlab && (nlab === nname || nlab === nbase)) return "";
  return lab;
}

function lookCaption(v, it) {
  const color = variantColorLabel(v, it?.name);
  if (color) return color;
  const g = variantGender(v);
  if (g === "ж") return "женский";
  if (g === "м") return "мужской";
  return v?.label || "внешний вид";
}

const GENDER_PREF_KEY = "futurum_look_gender";

function savedGenderPref() {
  try {
    const g = localStorage.getItem(GENDER_PREF_KEY);
    return g === "м" || g === "ж" ? g : "";
  } catch {
    return "";
  }
}

function saveGenderPref(g) {
  if (g !== "м" && g !== "ж") return;
  try {
    localStorage.setItem(GENDER_PREF_KEY, g);
  } catch {
    /* ignore */
  }
}

function preferredGender(it) {
  const has = new Set((it?.lookVariants || []).map(variantGender).filter(Boolean));
  const pref = savedGenderPref();
  if (pref && has.has(pref)) return pref;
  if (has.has("ж")) return "ж";
  if (has.has("м")) return "м";
  return "";
}

function detailViewItem(it) {
  if (!it?.genderInfo) return it;
  const info = it.genderInfo[preferredGender(it)];
  if (!info) return it;
  const view = { ...it };
  if (info.description) view.description = info.description;
  if (info.source) {
    view.source = info.source;
    if (info.sourceLinks) view.sourceLinks = info.sourceLinks;
  }
  if (info.note) view.note = info.note;
  return view;
}

function genderMetaAttrs(it, g) {
  const info = (it?.genderInfo || {})[g] || {};
  const names = it?.genderNames || {};
  const attrs = [];
  if (names[g]) attrs.push(`data-g-name="${escapeHtml(names[g])}"`);
  if (info.description) attrs.push(`data-g-desc="${escapeHtml(info.description)}"`);
  if (info.source) {
    const html = renderWikiLinks(info.source, info.sourceLinks || it.sourceLinks || []);
    attrs.push(`data-g-source-html="${escapeHtml(html)}"`);
  }
  return attrs.join(" ");
}

function slotShort(slot) {
  const s = String(slot || "");
  if (/голов/i.test(s)) return "Голова";
  if (/лиц/i.test(s)) return "Лицо";
  if (/очк/i.test(s)) return "Очки";
  if (/ше/i.test(s)) return "Шея";
  return s;
}

function variantShown(v, activeGender) {
  if (!activeGender) return true;
  const g = variantGender(v);
  if (!g) return true;
  return g === activeGender;
}

function applyLookChoice(wrap, src, fb, label) {
  if (!wrap) return;
  const zoomBtn = wrap.querySelector(".ttl-zoom-btn");
  const img = zoomBtn?.querySelector("img");
  const caption = wrap.querySelector("[data-look-caption]");
  const name = wrap.dataset.lookName || "";
  if (img && src) {
    img.src = src;
    delete img.dataset.imgFbUsed;
    if (fb) img.setAttribute("data-img-fb", fb);
    else img.removeAttribute("data-img-fb");
  }
  if (caption) caption.textContent = label || "внешний вид";
  if (zoomBtn) {
    zoomBtn.dataset.zoomSrc = src || "";
    zoomBtn.dataset.zoomFb = fb || "";
    zoomBtn.dataset.zoomName = label ? `${name} — ${label}` : name;
  }
}

function syncGenderMeta(btn) {
  const detail = els.detail;
  if (!detail || !btn) return;
  const title = detail.querySelector(".wiki-name-preview");
  if (title) {
    if (btn.dataset.gName) title.textContent = btn.dataset.gName;
    else if (title.dataset.defaultName) title.textContent = title.dataset.defaultName;
  }
  const desc = detail.querySelector("[data-detail-desc]");
  if (desc && btn.hasAttribute("data-g-desc")) desc.textContent = btn.dataset.gDesc || "";
  const src = detail.querySelector("[data-detail-source]");
  if (src && btn.dataset.gSourceHtml) src.innerHTML = btn.dataset.gSourceHtml;
}

function markSwatchGenderFocus(wrap, g) {
  wrap.querySelectorAll(".ttl-look-swatch").forEach((el) => {
    const sg = el.dataset.gender || "";
    el.classList.toggle("is-other-gender", Boolean(g) && Boolean(sg) && sg !== g);
  });
}

function setGenderToggle(wrap, g) {
  if (!g) return null;
  saveGenderPref(g);
  const track = wrap.querySelector(".ttl-gender-toggle");
  if (track) track.dataset.active = g;
  let genderBtn = null;
  wrap.querySelectorAll(".ttl-gender-btn").forEach((el) => {
    const on = el.dataset.gender === g;
    el.classList.toggle("on", on);
    el.setAttribute("aria-pressed", on ? "true" : "false");
    if (on) genderBtn = el;
  });
  markSwatchGenderFocus(wrap, g);
  return genderBtn;
}

function applyGenderChoice(wrap, genderBtn) {
  const g = genderBtn?.dataset.gender || "";
  const activeBtn = setGenderToggle(wrap, g) || genderBtn;
  const swatches = [...wrap.querySelectorAll(".ttl-look-swatch")];
  const bar = wrap.querySelector(".ttl-look-swatches");
  if (bar) bar.hidden = swatches.length < 2;
  const prevColor = wrap.dataset.activeColor || "";
  const forGender = swatches.filter((el) => !el.dataset.gender || el.dataset.gender === g);
  const stills = forGender.filter((el) => !/^анимац/i.test(el.dataset.lookLabel || ""));
  const same = prevColor ? stills.find((el) => (el.dataset.color || "") === prevColor) : null;
  const pick = same || stills[0] || forGender[0] || swatches[0];
  if (pick) {
    applyLookChoice(wrap, pick.dataset.lookSrc || "", pick.dataset.lookFb || "", pick.dataset.lookLabel || "");
    wrap.dataset.activeColor = pick.dataset.color || "";
    swatches.forEach((el) => el.classList.toggle("on", el === pick));
  } else {
    applyLookChoice(
      wrap,
      activeBtn?.dataset.lookSrc || "",
      activeBtn?.dataset.lookFb || "",
      activeBtn?.dataset.lookLabel || ""
    );
    wrap.dataset.activeColor = "";
    swatches.forEach((el) => el.classList.remove("on"));
  }
  if (activeBtn) syncGenderMeta(activeBtn);
}

function applySwatchChoice(wrap, swatch) {
  if (!wrap || !swatch) return;
  applyLookChoice(wrap, swatch.dataset.lookSrc || "", swatch.dataset.lookFb || "", swatch.dataset.lookLabel || "");
  wrap.dataset.activeColor = swatch.dataset.color || "";
  wrap.querySelectorAll(".ttl-look-swatch").forEach((el) => {
    el.classList.toggle("on", el === swatch);
  });
  const g = swatch.dataset.gender || "";
  if (g) {
    const genderBtn = setGenderToggle(wrap, g);
    if (genderBtn) syncGenderMeta(genderBtn);
  }
}

/** Картинка товара слева от названия (без отдельного огромного блока) */
function lookMediaHtml(it) {
  const variants = Array.isArray(it?.lookVariants)
    ? it.lookVariants.filter((v) => lookVariantSrc(v))
    : [];
  if (variants.length >= 2) {
    const genderSet = new Set(variants.map(variantGender).filter(Boolean));
    const gendersOrdered = ["ж", "м"].filter((g) => genderSet.has(g));
    const activeGender =
      gendersOrdered.length === 2 ? preferredGender(it) || gendersOrdered[0] : gendersOrdered[0] || "";
    let firstShown = -1;
    variants.forEach((v, i) => {
      if (firstShown >= 0 || !variantShown(v, activeGender)) return;
      if (/^анимац/i.test(variantColorLabel(v, it.name))) return;
      firstShown = i;
    });
    if (firstShown < 0) {
      variants.forEach((v, i) => {
        if (firstShown < 0 && variantShown(v, activeGender)) firstShown = i;
      });
    }
    if (firstShown < 0) firstShown = 0;
    const active = variants[firstShown];
    const activePair = lookVariantPair(active);
    const colorLabel = lookCaption(active, it);
    const zoom = zoomImgHtml(
      activePair.src,
      `${it.name || ""} — ${colorLabel}`,
      lookImgClass(it),
      activePair.fb
    );
    const dualGender = gendersOrdered.length === 2;
    const swatches = variants
      .map((v, i) => {
        const pair = lookVariantPair(v);
        const g = variantGender(v);
        const color = variantColorLabel(v, it.name);
        let lab = lookCaption(v, it);
        if (dualGender && g && color) lab = `${color} · ${g}`;
        else if (dualGender && g && !color) lab = g === "ж" ? "женский" : "мужской";
        const other = dualGender && activeGender && g && g !== activeGender;
        const badge = dualGender && g ? `<span class="ttl-swatch-g" aria-hidden="true">${g === "ж" ? "Ж" : "М"}</span>` : "";
        return `<button type="button" class="ttl-look-swatch${i === firstShown ? " on" : ""}${
          other ? " is-other-gender" : ""
        }" data-gender="${escapeHtml(g)}" data-color="${escapeHtml(color)}" data-look-src="${escapeHtml(
          pair.src
        )}" data-look-fb="${escapeHtml(pair.fb || "")}" data-look-label="${escapeHtml(lab)}" title="${escapeHtml(
          lab
        )}" aria-label="${escapeHtml(lab)}">
          <img src="${escapeHtml(pair.src)}" alt="" loading="lazy" decoding="async"${imgFbAttr(pair.fb)} />
          ${badge}
        </button>`;
      })
      .join("");
    const genderWord = (g) => (g === "ж" ? "Женский" : "Мужской");
    const genderIcon = (g) =>
      g === "ж"
        ? `<svg class="ttl-gender-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="9" r="5.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 14.25v6.5M9.4 18.2h5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
        : `<svg class="ttl-gender-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.2" cy="13.8" r="5.25" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13.9 10.1 19.2 4.8M14.35 4.8h4.85V9.65" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const toggle = dualGender
      ? `<div class="ttl-gender-toggle" role="group" aria-label="Вариант по полу" data-active="${escapeHtml(
          activeGender
        )}"><span class="ttl-gender-thumb" aria-hidden="true"></span>${gendersOrdered
          .map((g) => {
            const mine = variants.filter((v) => variantGender(v) === g && !/^анимац/i.test(v.label || ""));
            const pic = mine[0] || variants.find((v) => variantGender(v) === g) || variants[0];
            const pair = lookVariantPair(pic);
            const cap = lookCaption(pic, it);
            const on = g === activeGender;
            const word = genderWord(g);
            return `<button type="button" class="ttl-gender-btn${on ? " on" : ""}" data-gender="${g}" aria-pressed="${
              on ? "true" : "false"
            }" data-look-src="${escapeHtml(pair.src)}" data-look-fb="${escapeHtml(pair.fb || "")}" data-look-label="${escapeHtml(
              cap
            )}" title="${escapeHtml(word)}" aria-label="${escapeHtml(word)}" ${genderMetaAttrs(it, g)}>${genderIcon(
              g
            )}<span class="ttl-gender-word">${escapeHtml(word)}</span></button>`;
          })
          .join("")}</div>`
      : "";
    return `<div class="ttl-look-wrap ttl-look-variants" data-look-name="${escapeHtml(
      it.name || ""
    )}" data-active-color="${escapeHtml(variantColorLabel(active, it.name))}">
      <div class="ttl-look-stage">${zoom}</div>
      <div class="ttl-look-bar">
        <div class="ttl-look-tools">
          <p class="ttl-look-caption" data-look-caption>${escapeHtml(colorLabel)}</p>
          ${toggle}
        </div>
        <div class="ttl-look-swatches" role="listbox" aria-label="Варианты"${variants.length < 2 ? " hidden" : ""}>${swatches}</div>
      </div>
    </div>`;
  }
  const pair = detailProductPair(it);
  if (!pair.src) return "";
  const isEmote = it.kind === "emotes";
  const label = isEmote ? "анимация" : "внешний вид";
  const zoom = zoomImgHtml(pair.src, `${it.name || ""} — ${label}`, lookImgClass(it), pair.fb);
  return `<div class="ttl-look-wrap">${zoom}</div>`;
}

function lookFieldHtml(it) {
  const media = lookMediaHtml(it);
  if (!media) return "";
  const isEmote = it.kind === "emotes";
  const label = isEmote ? "Анимация" : "Внешний вид";
  return `<div class="ttl-field ttl-field-look">
    <span class="ttl-field-label">${label}</span>
    ${media}
  </div>`;
}

/** Разбор «Варианты: белый (ж) / (м), голубой…» → список строк */
function parseVariantsLines(text) {
  const body = String(text || "")
    .replace(/^варианты:\s*/i, "")
    .replace(/\n+/g, " ")
    .trim();
  if (!body) return [];
  return body
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeCostCurrency(unit) {
  const u = String(unit || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  if (u.startsWith("очк")) return "points";
  if (u === "днс" || u === "dns") return "dns";
  if (u === "мнт") return "mnt";
  return "";
}

function parseCostAmount(raw) {
  const n = Number(String(raw || "").replace(/\s+/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Цены из примечания: МНТ / ДНС / очки (вечно и периоды). */
function extractCostEntries(text) {
  const src = String(text || "");
  if (!src) return [];
  const out = [];
  const re =
    /(?:(вечно|навсегда|навечно|\d+\s*дн(?:я|ей|ь)?)\s*)?\(\s*(\d[\d\s]*)\s*(мнт|днс|dns|очков|очка|очки)\s*\)/gi;
  let m;
  while ((m = re.exec(src))) {
    const currency = normalizeCostCurrency(m[3]);
    const amount = parseCostAmount(m[2]);
    if (!currency || amount <= 0) continue;
    const period = String(m[1] || "").toLowerCase();
    const forever = /вечно|навсегда|навечно/.test(period);
    out.push({ amount, currency, forever, period });
  }
  return out;
}

function itemHasCostCurrency(it, currency) {
  if (!currency) return true;
  return extractCostEntries(it?.note || "").some((e) => e.currency === currency);
}

/** Какие валюты есть в текущем разделе (для показа фильтров цены). */
function sectionCostAvailability(items = state.items) {
  const avail = { mnt: false, dns: false, points: false };
  for (const it of items || []) {
    for (const e of extractCostEntries(it?.note || "")) {
      if (e.currency in avail) avail[e.currency] = true;
    }
    if (avail.mnt && avail.dns && avail.points) break;
  }
  return {
    ...avail,
    any: avail.mnt || avail.dns || avail.points,
  };
}

/**
 * Ключ сортировки по цене:
 * вечная цена приоритетнее; валюты отдельно (мнт → днс → очки); без цены — в конце.
 * preferredCurrency — если выбран фильтр МНТ/ДНС/Очки.
 */
function itemCostSortKey(it, preferredCurrency = "") {
  let entries = extractCostEntries(it?.note || "");
  if (preferredCurrency) {
    entries = entries.filter((e) => e.currency === preferredCurrency);
  }
  if (!entries.length) {
    return { rank: 9, amount: 0, currency: "" };
  }
  const forever = entries.filter((e) => e.forever);
  const pool = forever.length ? forever : entries;
  pool.sort((a, b) => {
    if (!preferredCurrency) {
      const ra = COST_CURRENCY_RANK[a.currency] ?? 9;
      const rb = COST_CURRENCY_RANK[b.currency] ?? 9;
      if (ra !== rb) return ra - rb;
    }
    return b.amount - a.amount;
  });
  const best = pool[0];
  return {
    rank: preferredCurrency ? 0 : COST_CURRENCY_RANK[best.currency] ?? 9,
    amount: best.amount,
    currency: best.currency,
  };
}

/**
 * «Стоимость: Вечно (72 мнт) / 30 дней…» → строки вертикально,
 * даже если в данных нет переносов.
 */
function parseCostLines(text) {
  let body = String(text || "")
    .replace(/^стоимость:\s*/i, "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!body) return [];

  let lines = body
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 1) {
    const one = lines[0];
    // Вечно (… мнт) 30 дней (… мнт) 7 дней (… мнт) в одну строку
    const chunks = one.match(
      /(?:вечно|навсегда|навечно|\d+\s*дн(?:я|ей|ь)?)\s*\([^)]+\)/gi
    );
    if (chunks && chunks.length > 1) {
      const head = one.slice(0, one.search(chunks[0])).trim().replace(/[:：]\s*$/, "");
      lines = head ? [head, ...chunks.map((s) => s.trim())] : chunks.map((s) => s.trim());
    }
  }

  return lines.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function noteListBlock(lines, sublabel = "") {
  if (!lines?.length) return "";
  const list = `<ul class="ttl-variants-list">${lines
    .map((v) => `<li>${escapeHtml(v)}</li>`)
    .join("")}</ul>`;
  if (!sublabel) return list;
  return `<div class="ttl-variants">
    <span class="ttl-variants-label">${escapeHtml(sublabel)}</span>
    ${list}
  </div>`;
}

function noteParts(note) {
  return String(note || "")
    .replace(/\\n/g, "\n")
    .split(/\s·\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isPricedCost(part) {
  return /мнт|днс|очк|вечно|навсегда|навечно|\d+\s*дн/i.test(part);
}

function wearLine(part) {
  const t = String(part || "").trim();
  const m = t.match(/^\[?\s*(можно носить|нельзя носить)\s*\]?\.?$/i);
  if (!m) return "";
  const word = m[1].toLowerCase();
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** «Аура / Полёт: Нет / Да» и «Мест: 2» → пары для одной сетки */
function factPairs(part) {
  const m = String(part || "").match(/^([^:]{1,42}):\s*(.{1,200})$/);
  if (!m) return null;
  const rawKey = m[1].trim();
  const rawVal = m[2].trim().replace(/\s*->\s*/g, " → ");
  if (/^(варианты|стоимость)$/i.test(rawKey) && isPricedCost(part)) return null;
  const keys = rawKey.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  const vals = rawVal.split(/\s*\/\s*/).map((s) => s.trim()).filter(Boolean);
  if (keys.length > 1 && keys.length === vals.length) {
    return keys.map((k, i) => ({ k, v: vals[i] }));
  }
  return [{ k: rawKey, v: rawVal }];
}

function isAliceNoise(text, it) {
  if (!isAliceExchange(it)) return false;
  const t = String(text || "").trim();
  if (!t) return true;
  if (/^можно обменять у алисы\.?$/i.test(t)) return true;
  // \b не видит кириллицу, поэтому граница — пробел или знак
  if (/^для обмена (?:нужно|требуется)(?:\s|[.,;]|$)/i.test(t)) return true;
  if (/^обменяв\s/i.test(t) && /алис/i.test(t)) return true;
  if (ALICE_SOURCE_RE.test(t) && t.length < 90) return true;
  return false;
}

function tidyListText(s) {
  return String(s || "")
    .replace(/[·|]+/g, " ")
    .replace(/\s*([,;])\s*/g, "$1 ")
    .replace(/(,\s*){2,}/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/([.,;])(?=[.,;])/g, "")
    .replace(/^[\s.,;:\-—]+|[\s.,;:\-—]+$/g, "")
    .trim();
}

/** «Примечание: …» из поля источника, если его нет в note */
function sourceSideNotes(it) {
  const raw = String(it?.source || "");
  if (!/примечание:/i.test(raw)) return [];
  const out = [];
  const re = /примечание:\s*([^.;]+)/gi;
  let m;
  while ((m = re.exec(raw))) {
    const t = tidyListText(m[1]);
    if (!t || isAliceNoise(t, it)) continue;
    if (norm(it?.note || "").includes(norm(t))) continue;
    out.push(t.charAt(0).toUpperCase() + t.slice(1));
  }
  return out;
}

function variantsBodyHtml(lines) {
  const chips = lines.length <= 16 && lines.every((l) => l.length <= 32);
  if (chips) {
    return `<div class="ttl-chip-row">${lines
      .map((v) => `<span class="ttl-chip">${escapeHtml(v)}</span>`)
      .join("")}</div>`;
  }
  return `<ul class="ttl-plain-list">${lines.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>`;
}

function factsBodyHtml(facts, links) {
  return `<dl class="ttl-facts">${facts
    .map(
      (f) =>
        `<div><dt>${escapeHtml(f.k)}</dt><dd>${renderWikiLinks(f.v, links)}</dd></div>`
    )
    .join("")}</dl>`;
}

function characteristicsPairs(it) {
  const rows = Array.isArray(it?.characteristics) ? it.characteristics : [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row) continue;
    const k = String(row.label || row.k || "").trim();
    const v = String(row.value || row.v || "").trim();
    if (!k || !v) continue;
    const key = norm(k);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ k, v });
  }
  return out;
}

function characteristicsSectionHtml(it) {
  const facts = characteristicsPairs(it);
  if (!facts.length) return "";
  const links = fieldLinks(it, "characteristicsLinks", "noteLinks", "sourceLinks");
  return infoSection("Характеристики", factsBodyHtml(facts, links), "ttl-info-stats");
}

function costBodyHtml(lines, links) {
  const rows = lines
    .map((line) => {
      if (links && links.length) return `<li>${renderWikiLinks(line, links)}</li>`;
      const safe = escapeHtml(line);
      return `<li>${safe.replace(/\(([^)]+)\)/g, '<b class="ttl-price-bit">($1)</b>')}</li>`;
    })
    .join("");
  return `<ul class="ttl-cost-list">${rows}</ul>`;
}

/**
 * Поле note → только полезные секции: ношение, свойства, стоимость, варианты.
 * Свободный текст «Примечание» не показываем — на вики он почти всегда мусор.
 */
function noteSectionsHtml(it, { hideVariants = false } = {}) {
  const parts = noteParts(it?.note);
  if (!parts.length) return "";
  const descKey = norm(it?.description || "");
  const wear = [];
  const facts = [];
  const costs = [];
  const variants = [];

  for (const part of parts) {
    if (isAliceNoise(part, it)) continue;
    if (descKey && norm(part) === descKey) continue;

    if (/^варианты:\s*/i.test(part)) {
      if (hideVariants) continue;
      const lines = parseVariantsLines(part).filter((l) => !/^\(?анимаци/i.test(l));
      if (lines.length) variants.push(...lines);
      continue;
    }
    if (/^стоимость:\s*/i.test(part) && isPricedCost(part)) {
      const lines = parseCostLines(part);
      if (lines.length) costs.push(...lines);
      continue;
    }
    const worn = wearLine(part);
    if (worn) {
      wear.push(worn);
      continue;
    }
    const pairs = factPairs(part);
    if (pairs) {
      facts.push(...pairs);
      continue;
    }
    // произвольный prose («Примечание») — пропускаем
  }

  const charKeys = new Set(characteristicsPairs(it).map((f) => norm(f.k)));
  const leftoverFacts = facts.filter((f) => !charKeys.has(norm(f.k)));
  const noteLinks = fieldLinks(it, "noteLinks");
  return [
    wear.length
      ? infoSection(
          "Ношение",
          `<p class="ttl-info-text">${wear.map((w) => renderWikiLinks(w, noteLinks)).join(" · ")}</p>`
        )
      : "",
    leftoverFacts.length ? infoSection("Свойства", factsBodyHtml(leftoverFacts, noteLinks)) : "",
    costs.length ? infoSection("Стоимость", costBodyHtml(costs, noteLinks)) : "",
    variants.length ? infoSection("Варианты", variantsBodyHtml(variants)) : "",
  ].join("");
}

/** Текст «где получить» без повтора группы, раздела, «Примечание:» и фразы про Алису */
function displaySource(it, { isAch = false, isTitle = false } = {}) {
  let raw = String(it?.source || "").trim();
  if (!raw) return "";
  // хвост «Примечание: …» из источника не показываем
  raw = tidyListText(raw.replace(/[.;,]?\s*примечание:\s*[\s\S]*$/i, "").trim()) || raw;
  raw = tidyListText(raw.replace(/\bпримечание:\s*[^.;]+[.;]?/gi, " ").trim()) || raw;
  if (!raw) return "";
  const cat = String(it?.category || "").trim();
  const kindLabel = String(it?.kindLabel || "").trim();
  if (isAch && (raw === it?.name || (cat && raw === cat))) return "";
  if (!isTitle && kindLabel && raw === kindLabel) return "";
  if (!isTitle && cat && raw === cat) return "";
  if (!isAliceExchange(it)) return raw;
  return tidyListText(
    raw
      .replace(/алиса\s*\(\s*обмен\s+подарков\s*\)/gi, " ")
      .replace(/можно обменять у алисы\.?/gi, " ")
      .replace(/для обмена (?:нужно|требуется)[^.]+\.?/gi, " ")
      .replace(/обменяв\s[^.]{0,220}?у\s+алисы\.?/gi, " ")
      .replace(/примечание:\s*[^.;]+/gi, " ")
  );
}

function detailStatHtml(label, value, valueClass = "") {
  if (!value) return "";
  const cls = valueClass ? ` ${valueClass}` : "";
  return `<div class="ttl-stat">
    <span class="ttl-stat-label">${escapeHtml(label)}</span>
    <span class="ttl-stat-value${cls}">${escapeHtml(value)}</span>
  </div>`;
}

function detailStatsHtml(it, { isTitle = false, isAch = false } = {}) {
  const bits = [];
  if (isTitle) {
    bits.push(detailStatHtml("ОП", opLabel(it.op), opClass(it.op)));
    bits.push(detailStatHtml("Цвет", colorRu(it.color)));
    bits.push(detailStatHtml("Раздел", it.category || ""));
  } else {
    bits.push(detailStatHtml("Раздел", it.kindLabel || SECTION_TITLE[it.kind] || ""));
    if (it.slot) bits.push(detailStatHtml("Тип", it.slot));
    const cat = String(it.category || "").trim();
    if (isAch && cat) bits.push(detailStatHtml("Группа", cat));
    else if (cat && cat !== it.kindLabel && !ALICE_SOURCE_RE.test(cat)) {
      bits.push(detailStatHtml("Тип", cat));
    }
    // «Значок: есть» — по реальной привязке к достижениям, не только по флагу вики
    if (!isAch && (achievementsForItem(it).length || it.hasAchievement)) {
      bits.push(detailStatHtml("Значок", "есть"));
    }
  }
  const html = bits.filter(Boolean).join("");
  return html ? `<div class="ttl-detail-stats">${html}</div>` : "";
}

/**
 * Общий низ карточки для титула, одежды, крыльев, достижения и остальных разделов.
 * Секция появляется только если для неё есть данные.
 */
function itemInfoStackHtml(it, opt = {}) {
  const item = it || {};
  const isTitle = Boolean(opt.isTitle);
  const isAch = Boolean(opt.isAch);
  const hideVariants = Boolean(opt.hideVariants);
  const shopOffers = opt.shopOffers !== undefined ? opt.shopOffers : isAch ? [] : itemShopOffers(item);
  const sourceText = displaySource(item, { isAch, isTitle });
  let desc = String(item.description || "").trim();
  const aliceCost = isAliceExchange(item) ? aliceExchangeCost(item) : "";
  if (desc && sourceText && norm(desc) === norm(sourceText)) desc = "";
  if (desc && aliceCost && norm(desc) === norm(aliceCost)) desc = "";
  if (desc && isAliceNoise(desc, item)) desc = "";
  const descBody = !desc
    ? ""
    : isAch
      ? highlightAchievementDescription(desc, opt.reqs || [], item.descriptionLinks)
      : renderWikiLinks(desc, item.descriptionLinks);
  const descLabel = isAch ? "Как получить" : "Описание";
  const sections = [
    opt.beforeHtml || "",
    characteristicsSectionHtml(item),
    sourceText
      ? infoSection(
          "Где получить",
          `<p class="ttl-info-text" data-detail-source>${renderWikiLinks(sourceText, item.sourceLinks)}</p>`
        )
      : "",
    descBody
      ? infoSection(
          descLabel,
          `<div class="ttl-info-text${isAch ? " ttl-info-ach" : ""}" data-detail-desc>${descBody}</div>`,
          isAch ? "ttl-info-how" : ""
        )
      : "",
    opt.reqsHtml || "",
    !isAch && !opt.skipItemAchs ? renderItemAchievementsHtml(item) : "",
    noteSectionsHtml(item, { hideVariants }),
    renderShopOffersHtml(shopOffers),
    aliceExchangeHtml(item),
  ]
    .filter(Boolean)
    .join("");

  const wiki = opt.wikiUrl
    ? `<a class="ttl-wiki-link ttl-info-wiki" href="${escapeHtml(
        opt.wikiUrl
      )}" target="_blank" rel="noopener noreferrer">На вики Parapa →</a>`
    : "";
  if (!sections && !wiki) {
    return `<p class="ttl-info-empty">На вики не написано, откуда это берётся.</p>`;
  }
  const hint = !sections
    ? `<p class="ttl-info-empty">На вики не написано, откуда это берётся.</p>`
    : "";
  return `<div class="ttl-info">${hint}${sections}${wiki}</div>`;
}

/** Значки достижений, ошибочно попавшие в таблицы крыльев/транспорта на вики */
function isLeakedAchievementItem(it) {
  if (!it || it.kind === "achievements") return false;
  const note = String(it.note || "");
  const desc = String(it.description || "");
  if (/можно\s+носить/i.test(note)) return true;
  if (/чтобы получить/i.test(desc) && (it.kind === "wings" || it.kind === "transport")) {
    return true;
  }
  return false;
}

function applySectionPool() {
  if (isTitles()) {
    state.items = state.titles;
    state.meta = state.titlesMeta;
  } else {
    state.items = state.wiki.filter(
      (it) => it.kind === state.section && !isLeakedAchievementItem(it)
    );
    state.meta = state.wikiMeta;
  }
  if (els.total) {
    els.total.textContent = String(state.items.length);
  }
  if (els.hint) {
    const label = SECTION_LABEL[state.section] || "записей";
    const base = els.hint.childNodes[0];
    // keep structure: text + span#ttlTotal + rest via rebuild
    els.hint.innerHTML = `Поиск или фильтр · <span id="ttlTotal">${state.items.length}</span> ${escapeHtml(label)}`;
    els.total = document.getElementById("ttlTotal");
  }
  if (els.q) {
    els.q.placeholder = isGuideNarrow() ? "Название, ОП…" : "Название, описание, где взять…";
  }
  document.body.classList.toggle("guide-is-titles", isTitles());
  document.body.classList.toggle("guide-is-wiki", !isTitles());
  // ОП — только титулы; цена/валюта — только вики и только если в разделе есть цены
  const costAvail = isTitles() ? { any: false, mnt: false, dns: false, points: false } : sectionCostAvailability();
  if (!isTitles()) {
    state.op = "";
    if (state.sort === "op-desc" || state.sort === "op-asc") {
      state.sort = "name";
      persistSort();
    }
    if (!costAvail.any && (state.sort === "price-asc" || state.sort === "price-desc")) {
      state.sort = "name";
      persistSort();
    }
    if (state.costCurrency && !costAvail[state.costCurrency]) {
      state.costCurrency = "";
      persistCostCurrency();
    }
  } else {
    if (state.sort === "price-asc" || state.sort === "price-desc") {
      state.sort = "name";
      persistSort();
    }
    if (state.costCurrency) {
      state.costCurrency = "";
      persistCostCurrency();
    }
  }
  if (els.opFiltersWrap) {
    els.opFiltersWrap.hidden = !isTitles();
    els.opFiltersWrap.setAttribute("aria-hidden", isTitles() ? "false" : "true");
  }
  els.sortPills?.querySelectorAll(".sort-op").forEach((btn) => {
    btn.hidden = !isTitles();
    btn.setAttribute("aria-hidden", isTitles() ? "false" : "true");
  });
  const showPriceUi = !isTitles() && costAvail.any;
  els.sortPills?.querySelectorAll(".sort-price").forEach((btn) => {
    btn.hidden = !showPriceUi;
    btn.setAttribute("aria-hidden", showPriceUi ? "false" : "true");
  });
  if (els.costCurrencyPills) {
    els.costCurrencyPills.hidden = !showPriceUi;
    els.costCurrencyPills.setAttribute("aria-hidden", showPriceUi ? "false" : "true");
    els.costCurrencyPills.querySelectorAll("[data-cost-currency]").forEach((btn) => {
      const cur = btn.dataset.costCurrency || "";
      // «Все» всегда; МНТ/ДНС/Очки — только если есть в разделе
      const show = !cur || Boolean(costAvail[cur]);
      btn.hidden = !showPriceUi || !show;
      btn.setAttribute("aria-hidden", showPriceUi && show ? "false" : "true");
    });
  }
}

function classifySource(name) {
  const s = String(name || "").toLowerCase().replace(/ё/g, "е");
  if (/постоянн|магазин|новинк|тц|салон|онлайн/.test(s)) return "shop";
  if (/билет|лотерейн/.test(s)) return "ticket";
  if (/колес|фортун|чёртов|чертов/.test(s)) return "wheel";
  if (/событ|акци|турнир/.test(s)) return "event";
  return "other";
}

function shortSourceLabel(name) {
  let s = String(name || "")
    .replace(/^Событие\s+/i, "")
    .replace(/^Акция\s+/i, "")
    .replace(/^Лотерейный билет\s+/i, "")
    .replace(/^Билет\s+/i, "")
    .replace(/^Колесо фортуны\s+/i, "")
    .replace(/^Колесо удачи\s+/i, "")
    .replace(/[«»""„‟]/g, "")
    .trim();
  const lower = s.toLowerCase().replace(/ё/g, "е");
  if (/юбилейное колесо/.test(lower) || /^юбилейное$/i.test(s)) s = "Юбилейное";
  else if (/^летнее колесо/.test(lower) || /^летнее$/i.test(name)) s = "Летнее";
  else if (/^весеннее колесо/.test(lower)) s = "Весеннее";
  else if (/^осеннее колесо/.test(lower)) s = "Осеннее";
  else if (/^октябрьское колесо/.test(lower)) s = "Октябрьское";
  else if (/^новогоднее колесо/.test(lower)) s = "Новогоднее";
  else if (/^февральское колесо/.test(lower)) s = "Февральское";
  else if (/^веселое колесо/.test(lower)) s = "Весёлое";
  else if (/чертово колесо|чёртово колесо/.test(lower)) s = "Чёртово";
  else if (/постоянный ассортимент/.test(lower)) s = "Постоянный";
  else if (/новинки в онлайн/.test(lower)) s = "Новинки магазина";
  if (s.length > 22) s = s.slice(0, 21) + "…";
  return s || String(name || "");
}

function collectSourceCats() {
  // У достижений h2 на вики = почти каждое название значка → 90+ «категорий» бесполезны
  if (isTitles()) {
    const by = state.titlesMeta?.byCategory || {};
    return Object.keys(by)
      .sort((a, b) => a.localeCompare(b, "ru"))
      .map((name) => ({ name, n: by[name] || 0, bucket: "other" }));
  }
  if (state.section === "achievements") return [];
  const counts = new Map();
  for (const it of state.items) {
    const src = (it.category || it.source || "").trim();
    if (!src) continue;
    counts.set(src, (counts.get(src) || 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
    .map(([name, n]) => ({ name, n, bucket: classifySource(name) }));
}

const BUCKET_TITLE = {
  shop: "Магазин",
  wheel: "Колёса удачи",
  event: "События и акции",
  ticket: "Билеты",
  other: "Другое",
};

function setCatDetailOpen(on) {
  state.catDetailOpen = Boolean(on);
  if (!state.catDetailOpen) state.catDetailQ = "";
  if (els.catDetailQ && !state.catDetailOpen) els.catDetailQ.value = "";
  paintCatDetail();
}

function paintCatDetail() {
  const open = state.catDetailOpen;
  if (els.catMoreToggle) {
    els.catMoreToggle.classList.toggle("on", open);
    els.catMoreToggle.setAttribute("aria-expanded", open ? "true" : "false");
    els.catMoreToggle.textContent = open ? "Скрыть" : "Подробные";
  }
  els.guideCatD?.classList.toggle("is-detail", open);
  if (els.catDetailPanel) els.catDetailPanel.hidden = !open;
  if (!open || !els.catDetailList) return;

  const cats = collectSourceCats();
  const q = norm(state.catDetailQ);
  let list = cats;
  if (state.sourceBucket && state.sourceBucket !== "all") {
    list = list.filter((c) => c.bucket === state.sourceBucket);
  }
  if (q) list = list.filter((c) => norm(c.name).includes(q) || norm(shortSourceLabel(c.name)).includes(q));

  if (!list.length) {
    els.catDetailList.innerHTML = `<p class="guide-cat-detail-empty">Ничего не найдено</p>`;
    return;
  }

  const groups = new Map();
  for (const c of list) {
    const key = c.bucket || "other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const order = ["shop", "wheel", "event", "ticket", "other"];
  const parts = [];
  for (const key of order) {
    const items = groups.get(key);
    if (!items?.length) continue;
    parts.push(`<div class="guide-cat-detail-group">
      <div class="guide-cat-detail-label">${escapeHtml(BUCKET_TITLE[key] || key)}</div>
      <div class="guide-cat-detail-items">
        ${items
          .map((c) => {
            const on = state.category === c.name;
            return `<button type="button" class="guide-cat-detail-item${on ? " on" : ""}" data-category="${escapeHtml(
              c.name
            )}" title="${escapeHtml(c.name)}" role="option" aria-selected="${on ? "true" : "false"}">
              <span class="guide-cat-detail-name">${escapeHtml(c.name)}</span>
              <span class="guide-cat-n">${fmtCount(c.n)}</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>`);
  }
  // «Все» сброс
  parts.unshift(`<button type="button" class="guide-cat-detail-item guide-cat-detail-all${
    state.category ? "" : " on"
  }" data-category="" role="option" aria-selected="${state.category ? "false" : "true"}">
    <span class="guide-cat-detail-name">${
      state.sourceBucket && state.sourceBucket !== "all" ? "Все в выбранном типе" : "Все источники"
    }</span>
  </button>`);
  els.catDetailList.innerHTML = parts.join("");
}

function itemSourceName(it) {
  if (isTitles()) return (it.category || "").trim();
  return (it.category || it.source || "").trim();
}

function buildCategoryPills() {
  if (!els.catPills || !els.guideCatD) return;
  const cats = collectSourceCats();
  if (!cats.length) {
    navUi.filtersAvailable = false;
    els.guideCatD.hidden = true;
    els.catPills.replaceChildren();
    els.catBuckets?.replaceChildren();
    if (els.catMoreToggle) els.catMoreToggle.hidden = true;
    setCatDetailOpen(false);
    paintGuideSideChrome();
    return;
  }

  navUi.filtersAvailable = true;
  const useBuckets = !isTitles() && cats.some((c) => c.bucket !== "other");
  const bucketCounts = { all: state.items.length, shop: 0, wheel: 0, event: 0, ticket: 0, other: 0 };
  if (useBuckets) {
    for (const it of state.items) {
      const src = itemSourceName(it);
      if (!src) {
        bucketCounts.other += 1;
        continue;
      }
      bucketCounts[classifySource(src)] += 1;
    }
  }

  if (useBuckets && state.sourceBucket !== "all" && !SOURCE_BUCKETS.some((b) => b.id === state.sourceBucket)) {
    state.sourceBucket = "all";
  }
  if (!useBuckets) state.sourceBucket = "all";

  // если выбран конкретный источник не из текущего типа — сбросить
  if (state.category) {
    const hit = cats.find((c) => c.name === state.category);
    if (!hit || (useBuckets && state.sourceBucket !== "all" && hit.bucket !== state.sourceBucket)) {
      state.category = "";
    }
  }

  if (els.catBuckets) {
    if (!useBuckets) {
      els.catBuckets.hidden = true;
      els.catBuckets.replaceChildren();
    } else {
      els.catBuckets.hidden = false;
      const visibleBuckets = SOURCE_BUCKETS.filter(
        (b) => b.id === "all" || (bucketCounts[b.id] || 0) > 0
      );
      els.catBuckets.innerHTML = visibleBuckets
        .map((b) => {
          const on = state.sourceBucket === b.id;
          const n = bucketCounts[b.id] || 0;
          return `<button type="button" class="filter-pill guide-bucket${on ? " on" : ""}" data-bucket="${b.id}" aria-pressed="${
            on ? "true" : "false"
          }">${escapeHtml(b.label)}<span class="guide-cat-n">${fmtCount(n)}</span></button>`;
        })
        .join("");
    }
  }

  const filtered =
    useBuckets && state.sourceBucket !== "all"
      ? cats.filter((c) => c.bucket === state.sourceBucket)
      : cats;

  // в сайдбаре больше места — длинный вертикальный список + «Подробные» для поиска
  const compact = filtered.slice(0, 28);
  const hasMore = filtered.length > compact.length || (!isTitles() && cats.length > 10);

  const frag = document.createDocumentFragment();
  const all = document.createElement("button");
  all.type = "button";
  all.className = "filter-pill" + (state.category ? "" : " on");
  all.dataset.category = "";
  all.setAttribute("aria-pressed", state.category ? "false" : "true");
  all.textContent = useBuckets && state.sourceBucket !== "all" ? "Все в типе" : "Все источники";
  frag.appendChild(all);

  const shown = [...compact];
  if (state.category && !shown.some((c) => c.name === state.category)) {
    const selected = filtered.find((c) => c.name === state.category);
    if (selected) shown.unshift(selected);
  }

  for (const cat of shown) {
    const btn = document.createElement("button");
    btn.type = "button";
    const on = state.category === cat.name;
    btn.className = "filter-pill guide-source" + (on ? " on" : "");
    btn.dataset.category = cat.name;
    btn.title = cat.name;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const short = isTitles()
      ? cat.name.length > 14
        ? cat.name.slice(0, 13) + "…"
        : cat.name
      : shortSourceLabel(cat.name);
    const countHtml = cat.n ? `<span class="guide-cat-n">${fmtCount(cat.n)}</span>` : "";
    btn.innerHTML = `<span class="pill-full">${escapeHtml(cat.name)}</span><span class="pill-short">${escapeHtml(
      short
    )}</span>${countHtml}`;
    frag.appendChild(btn);
  }

  els.catPills.replaceChildren(frag);
  els.catPills.hidden = false;
  els.guideCatD.hidden = false;
  els.guideCatD.classList.toggle("is-buckets", useBuckets);
  if (els.catMoreToggle) {
    els.catMoreToggle.hidden = !hasMore && !useBuckets;
  }
  paintCatDetail();
  paintGuideSideChrome();
}

function guideSegButtonsHtml(activeId, { mob } = {}) {
  return GUIDE_GROUPS.map((g) => {
    const on = g.id === activeId;
    const gMeta = MOB_GROUP_META[g.id] || MOB_GROUP_META.status;
    const attrs = mob
      ? `data-mob-cat-kind="group" data-mob-cat-id="${escapeHtml(g.id)}"`
      : `data-guide-group="${escapeHtml(g.id)}"`;
    return `<button type="button" class="guide-seg-btn${on ? " on" : ""}" role="tab" aria-selected="${
      on ? "true" : "false"
    }" title="${escapeHtml(g.hint || g.label)}" ${attrs}>
      <span class="guide-seg-ico" aria-hidden="true">${gMeta.icon}</span>
      <span class="guide-seg-label">${escapeHtml(g.label)}</span>
    </button>`;
  }).join("");
}

function guideSectionLeafHtml(sec, groupMeta, { mob } = {}) {
  const on = sec === state.section;
  const label = SECTION_TITLE[sec] || sec;
  const sMeta = MOB_SECTION_META[sec] || groupMeta;
  const attrs = mob
    ? `data-mob-cat-kind="section" data-mob-cat-id="${escapeHtml(sec)}"`
    : `data-section="${escapeHtml(sec)}"`;
  return `<button type="button" class="guide-leaf${on ? " on" : ""}" ${attrs}${
    on ? ' aria-current="true"' : ""
  } style="--cat:${sMeta.color}">
    <span class="guide-leaf-ico" aria-hidden="true">${sMeta.icon}</span>
    <span class="guide-leaf-text">${escapeHtml(label)}</span>
    <span class="guide-leaf-count">${fmtCount(sectionCount(sec))}</span>
  </button>`;
}

function guideSheetHtml(group, { mob } = {}) {
  if (!group) return "";
  const gMeta = MOB_GROUP_META[group.id] || MOB_GROUP_META.status;
  const leaves = group.sections.map((sec) => guideSectionLeafHtml(sec, gMeta, { mob })).join("");
  return `<div class="guide-sheet" role="tabpanel" aria-label="${escapeHtml(group.label)}" data-sheet-group="${escapeHtml(
    group.id
  )}">
    <p class="guide-sheet-kicker">${escapeHtml(group.label)}</p>
    <div class="guide-sheet-list">${leaves}</div>
    <p class="guide-sheet-empty" hidden>В этой группе нет совпадений</p>
  </div>`;
}

function buildGuideTree() {
  if (!els.guideTree) return;
  const g = groupById(state.group) || GUIDE_GROUPS[0];
  els.guideTree.classList.add("is-segmented");
  els.guideTree.innerHTML = `<div class="guide-seg" role="tablist" aria-label="Группы">${guideSegButtonsHtml(
    g?.id
  )}</div>${guideSheetHtml(g)}`;
}

function updateGuideCrumb() {
  if (!els.guideCrumb) return;
  const g = groupById(state.group);
  const secLabel = SECTION_TITLE[state.section] || state.section;
  els.guideCrumb.innerHTML = g
    ? `<strong>${escapeHtml(g.label)}</strong> · ${escapeHtml(secLabel)} · ${fmtCount(state.items.length)} в разделе`
    : "";
}

function paintGuideSideChrome() {
  const drawer = isGuideDrawerViewport();
  const collapsed = navUi.collapsed && !drawer;
  if (collapsed && navUi.sideMode !== "catalog") navUi.sideMode = "catalog";
  if (!navUi.filtersAvailable && navUi.sideMode === "filters") navUi.sideMode = "catalog";

  els.guideSide?.classList.toggle("is-collapsed", collapsed);
  els.guideSide?.classList.toggle("is-open", navUi.menuOpen && drawer);
  els.guideSide?.classList.toggle("is-filters", navUi.sideMode === "filters");
  els.guideSideBackdrop?.classList.toggle("is-on", navUi.menuOpen && drawer);
  if (els.guideSideBackdrop) els.guideSideBackdrop.hidden = !(navUi.menuOpen && drawer);
  document.body.classList.toggle("guide-catalog-open", navUi.menuOpen && drawer);
  els.guideCatalogBtn?.setAttribute("aria-expanded", navUi.menuOpen && drawer ? "true" : "false");
  if (els.guideSideCollapse) {
    els.guideSideCollapse.textContent = navUi.collapsed ? "»" : "Свернуть";
    els.guideSideCollapse.setAttribute("aria-expanded", navUi.collapsed ? "false" : "true");
    els.guideSideCollapse.setAttribute(
      "aria-label",
      navUi.collapsed ? "Развернуть навигацию" : "Свернуть навигацию"
    );
  }

  const mode = navUi.sideMode;
  const onCatalog = mode === "catalog";
  els.sideModeCatalog?.classList.toggle("on", onCatalog);
  els.sideModeFilters?.classList.toggle("on", !onCatalog);
  els.sideModeCatalog?.setAttribute("aria-selected", onCatalog ? "true" : "false");
  els.sideModeFilters?.setAttribute("aria-selected", onCatalog ? "false" : "true");
  if (els.sideModeFilters) {
    els.sideModeFilters.disabled = !navUi.filtersAvailable;
    els.sideModeFilters.title = navUi.filtersAvailable
      ? "Фильтры источника"
      : "В этом разделе нет типов источника";
  }
  if (els.sideModeFiltersDot) {
    const active = navUi.filtersAvailable && filtersAreActive();
    els.sideModeFiltersDot.hidden = !active;
  }

  if (els.guideSideCatalog) {
    els.guideSideCatalog.hidden = !onCatalog;
    els.guideSideCatalog.classList.toggle("is-on", onCatalog);
  }
  if (els.guideSideFilters) {
    els.guideSideFilters.hidden = onCatalog;
    els.guideSideFilters.classList.toggle("is-on", !onCatalog);
  }
  if (els.guideFiltersEmpty) {
    const showEmpty = !onCatalog && !navUi.filtersAvailable;
    els.guideFiltersEmpty.hidden = !showEmpty;
  }
}

function guideGroupMatchesQuery(group, query) {
  if (!group) return false;
  if (!query) return true;
  if (norm(group.label).includes(query) || norm(group.hint || "").includes(query)) return true;
  return group.sections.some((sec) => norm(SECTION_TITLE[sec] || sec).includes(query));
}

function filterGuideTreeByQuery(q) {
  if (!els.guideTree) return;
  const query = norm(q);
  let any = false;
  const active = groupById(state.group) || GUIDE_GROUPS[0];
  GUIDE_GROUPS.forEach((g) => {
    const btn = els.guideTree.querySelector(`[data-guide-group="${g.id}"]`);
    if (!btn) return;
    const hit = guideGroupMatchesQuery(g, query);
    const keep = !query || hit || g.id === state.group;
    btn.classList.toggle("is-miss", !keep);
    btn.classList.toggle("on", g.id === state.group);
    btn.setAttribute("aria-selected", g.id === state.group ? "true" : "false");
    if (hit || !query) any = true;
  });
  if (active) {
    const headMatch = !query || norm(active.label).includes(query) || norm(active.hint || "").includes(query);
    let sheetHit = !query;
    active.sections.forEach((sec) => {
      const leaf = els.guideTree.querySelector(`.guide-sheet [data-section="${sec}"]`);
      if (!leaf) return;
      const label = SECTION_TITLE[sec] || sec;
      const ok = !query || headMatch || norm(label).includes(query);
      leaf.classList.toggle("is-miss", !ok);
      if (ok) sheetHit = true;
    });
    const sheetEmpty = els.guideTree.querySelector(".guide-sheet-empty");
    if (sheetEmpty) {
      const othersHit = GUIDE_GROUPS.some((g) => g.id !== active.id && guideGroupMatchesQuery(g, query));
      sheetEmpty.hidden = !query || sheetHit || !othersHit;
    }
  }
  if (els.guideTreeEmpty) els.guideTreeEmpty.hidden = !query || any;
}

function updateSectionUi() {
  state.group = groupForSection(state.section).id;
  navUi.openGroups.add(state.group);
  if (!mobileUi.catalogOpen) mobileUi.catalogOpen = state.group;
  buildGuideTree();
  paintGuideSideChrome();
  filterGuideTreeByQuery(state.query);
  updateGuideCrumb();
  paintMobChips();
  if (mobileUi.tab === "catalog") renderMobCatalog();
}

function setGuideMenu(on) {
  navUi.menuOpen = Boolean(on);
  paintGuideSideChrome();
}

function toggleGuideGroup(groupId) {
  if (navUi.openGroups.has(groupId)) navUi.openGroups.delete(groupId);
  else navUi.openGroups.add(groupId);
  const block = els.guideTree?.querySelector(`[data-group="${groupId}"]`);
  block?.classList.toggle("open", navUi.openGroups.has(groupId));
}

function setGroup(groupId, { keepQuery = true } = {}) {
  const g = groupById(groupId) || GUIDE_GROUPS[0];
  const nextSection = g.sections.includes(state.section) ? state.section : g.sections[0];
  state.group = g.id;
  navUi.openGroups.add(g.id);
  try {
    localStorage.setItem(GROUP_KEY, g.id);
  } catch {
    /* ignore */
  }
  setSection(nextSection, { keepQuery });
}

function updatePillsUi() {
  els.opPills?.querySelectorAll(".filter-pill").forEach((btn) => {
    const on = (btn.dataset.op || "") === state.op;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  els.catBuckets?.querySelectorAll("[data-bucket]").forEach((btn) => {
    const on = (btn.dataset.bucket || "all") === state.sourceBucket;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  els.catPills?.querySelectorAll(".filter-pill").forEach((btn) => {
    const on = (btn.dataset.category || "") === state.category;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  els.sortPills?.querySelectorAll(".sort-pill").forEach((btn) => {
    const on = btn.dataset.sort === state.sort;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  els.costCurrencyPills?.querySelectorAll("[data-cost-currency]").forEach((btn) => {
    const on = (btn.dataset.costCurrency || "") === (state.costCurrency || "");
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

function itemSearchHay(it) {
  if (!it) return "";
  if (it._searchHay) return it._searchHay;
  const variantBits = (it.lookVariants || []).map((v) =>
    [v.label, v.gender].filter(Boolean).join(" ")
  );
  const genderBits = it.genderNames ? Object.values(it.genderNames) : [];
  const charBits = (it.characteristics || []).map((c) =>
    [c.label, c.value].filter(Boolean).join(" ")
  );
  it._searchHay = norm(
    [
      it.name,
      it.description,
      it.source,
      it.note,
      it.category,
      it.slot,
      it.kindLabel,
      ...genderBits,
      ...variantBits,
      ...charBits,
    ].join(" ")
  );
  return it._searchHay;
}

function itemSearchWords(it) {
  if (!it) return [];
  if (it._searchWords) return it._searchWords;
  it._searchWords = itemSearchHay(it).split(" ").filter(Boolean);
  return it._searchWords;
}

/** Левенштейн с ранним выходом — для опечаток в 1–2 буквы */
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

/** Лёгкая основа: крылья/крыльев → крыл */
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
 * Оценка токена по строке поиска.
 * tier: 0 точное, 1 основа, 2 префикс, 3 вхождение, 4 опечатка, 5 слабо
 */
function fuzzyTokenScore(token, hay, words) {
  if (!token || !hay) return { score: -1, tier: 9 };
  if (hay === token) return { score: 100, tier: 0 };

  const tokenStem = lightStem(token);
  const wds = words || hay.split(" ").filter(Boolean);
  let best = { score: -1, tier: 9 };

  const take = (score, tier) => {
    if (score > best.score || (score === best.score && tier < best.tier)) {
      best = { score, tier };
    }
  };

  for (const w of wds) {
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

  // опечатка: 1 буква (короткие слова) или до 2 (длиннее)
  if (token.length >= 3) {
    const maxDist = token.length <= 4 ? 1 : token.length <= 7 ? 1 : 2;
    for (const w of wds) {
      if (Math.abs(w.length - token.length) > maxDist) continue;
      if (tokenStem.length >= 3 && lightStem(w) === tokenStem) continue;
      const d = editDistance(token, w, maxDist);
      if (d > 0 && d <= maxDist) take(40 - d * 10, 4);
    }
  }
  return best;
}

function scoreGuideTokenForms(forms, hay, words) {
  let best = { score: -1, tier: 9 };
  let viaSynonym = false;
  for (const f of forms) {
    const part = fuzzyTokenScore(f, hay, words);
    if (part.score > best.score || (part.score === best.score && part.tier < best.tier)) {
      best = part;
      viaSynonym = f !== forms[0];
    }
  }
  return { ...best, viaSynonym };
}

function scoreGuideItem(it, tokens) {
  if (!tokens.length) return { score: -1, fuzzy: false, tier: 9 };
  const name = norm(it.name || "");
  const nameWords = name.split(" ").filter(Boolean);
  const hay = itemSearchHay(it);
  const words = itemSearchWords(it);
  let score = 0;
  let fuzzy = false;
  let tier = 0;

  for (const t of tokens) {
    const forms = expandGuideToken(t);
    let hit = scoreGuideTokenForms(forms, name, nameWords);
    let fromExtra = false;
    if (hit.score < 0) {
      const d = scoreGuideTokenForms(forms, hay, words);
      if (d.score > 0) {
        hit = { score: d.score * 0.45, tier: Math.max(d.tier, 5), viaSynonym: d.viaSynonym };
        fromExtra = true;
      }
    }
    if (hit.score < 0) return { score: -1, fuzzy: false, tier: 9 };
    score += hit.score;
    tier = Math.max(tier, hit.tier);
    if (hit.tier >= 2 || hit.viaSynonym || fromExtra) fuzzy = true;
  }

  if (tier === 0) score += 40;
  else if (tier === 1) score += 32;
  else if (tier === 2) score += 12;
  else if (tier === 4) score += 4;

  score += Math.max(0, 6 - name.length * 0.04);
  return { score, fuzzy, tier };
}

function matchesQuery(it, q) {
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  return scoreGuideItem(it, tokens).score >= 0;
}

function guideItemRankKey(it) {
  return `${itemSectionOf(it)}:${it.id}`;
}

function filterAndSort() {
  const q = norm(state.query);
  if (state.landing && !queryLooksActive(q)) {
    state.list = [];
    document.body.classList.toggle("guide-global-search", false);
    if (els.found) els.found.textContent = "0";
    if (els.guideCrumb) els.guideCrumb.innerHTML = "";
    paintLandingChrome();
    return;
  }
  if (state.landing && queryLooksActive(q)) leaveLanding();

  const globalSearch = Boolean(q);
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const pool = guideSearchPool(q);
  const ranked = [];
  const rankMeta = new Map();

  for (const it of pool) {
    const sec = itemSectionOf(it);
    const title = sec === "titles";
    if (state.op !== "") {
      if (!title) continue;
      if (String(it.op) !== state.op) continue;
    }
    const src = itemSourceName(it);
    // узкие фильтры раздела — только если не глобальный текстовый поиск
    if (!globalSearch) {
      if (state.category) {
        if (src !== state.category) continue;
      } else if (!title && state.sourceBucket && state.sourceBucket !== "all") {
        if (classifySource(src || "other") !== state.sourceBucket) continue;
      }
      if (!title && state.costCurrency && !itemHasCostCurrency(it, state.costCurrency)) {
        continue;
      }
    } else if (state.costCurrency && !title && !itemHasCostCurrency(it, state.costCurrency)) {
      continue;
    }

    let score = 1;
    let fuzzy = false;
    let tier = 0;
    if (tokens.length) {
      const hit = scoreGuideItem(it, tokens);
      if (hit.score < 0) continue;
      score = hit.score;
      fuzzy = hit.fuzzy;
      tier = hit.tier;
    }
    ranked.push(it);
    rankMeta.set(guideItemRankKey(it), { score, fuzzy, tier });
  }

  ranked.sort((a, b) => {
    if (tokens.length) {
      const ra = rankMeta.get(guideItemRankKey(a));
      const rb = rankMeta.get(guideItemRankKey(b));
      const ta = ra?.tier ?? 9;
      const tb = rb?.tier ?? 9;
      if (ta !== tb) return ta - tb;
      const ds = (rb?.score || 0) - (ra?.score || 0);
      if (ds) return ds;
      if (Boolean(ra?.fuzzy) !== Boolean(rb?.fuzzy)) return ra?.fuzzy ? 1 : -1;
    }
    if (state.sort === "op-desc") {
      const d = (b.op || 0) - (a.op || 0);
      if (d) return d;
    } else if (state.sort === "op-asc") {
      const d = (a.op || 0) - (b.op || 0);
      if (d) return d;
    } else if (state.sort === "price-asc" || state.sort === "price-desc") {
      const ca = itemCostSortKey(a, state.costCurrency);
      const cb = itemCostSortKey(b, state.costCurrency);
      if (ca.rank !== cb.rank) return ca.rank - cb.rank;
      const d = state.sort === "price-asc" ? ca.amount - cb.amount : cb.amount - ca.amount;
      if (d) return d;
    }
    if (globalSearch) {
      const sa = SECTION_TITLE[itemSectionOf(a)] || "";
      const sb = SECTION_TITLE[itemSectionOf(b)] || "";
      const sd = sa.localeCompare(sb, "ru");
      if (sd) return sd;
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "ru");
  });

  state.list = ranked;
  state.rankMeta = rankMeta;
  if (els.found) els.found.textContent = String(ranked.length);
  document.body.classList.toggle("is-stage", true);
  document.body.classList.toggle("guide-global-search", globalSearch);
  if (els.hint) {
    const active = Boolean(
      q ||
        state.op ||
        state.category ||
        (state.sourceBucket && state.sourceBucket !== "all") ||
        state.costCurrency
    );
    els.hint.hidden = active && ranked.length > 0;
  }
  if (els.guideCrumb) {
    const shown = ranked.length;
    if (globalSearch) {
      els.guideCrumb.innerHTML = `<strong>Весь справочник</strong> · поиск · <span style="color:var(--accent)">${fmtCount(
        shown
      )}</span>`;
    } else {
      const g = groupById(state.group);
      const secLabel = SECTION_TITLE[state.section] || state.section;
      const poolN = state.items.length;
      els.guideCrumb.innerHTML = g
        ? `<strong>${escapeHtml(g.label)}</strong> · ${escapeHtml(secLabel)} · <span style="color:var(--accent)">${fmtCount(
            shown
          )}</span>${shown !== poolN ? ` из ${fmtCount(poolN)}` : ""}`
        : "";
    }
  }
  listRenderLimit = LIST_RENDER_PAGE;
  filterGuideTreeByQuery(state.query);
  renderList();
  if (state.activeId != null) {
    const still = state.list.some((it) => it.id === state.activeId);
    if (!still) {
      state.activeId = null;
      renderDetail(null);
    } else {
      highlightActive();
    }
  }
}

function renderList() {
  if (!els.list) return;
  if (!state.list.length) {
    els.list.innerHTML = `<li class="result-empty">Ничего не найдено</li>`;
    return;
  }
  const globalSearch = Boolean(norm(state.query));
  const total = state.list.length;
  // В разделе без поиска — все позиции; при поиске — порциями с «Показать ещё»
  if (!globalSearch) listRenderLimit = Math.max(listRenderLimit, total);
  const limit = Math.min(total, listRenderLimit);
  const visible = state.list.slice(0, limit);
  const rows = visible
    .map((it) => {
      const sec = itemSectionOf(it);
      const title = sec === "titles";
      const active = it.id === state.activeId ? " active" : "";
      const secLabel = SECTION_TITLE[sec] || it.kindLabel || "";
      const meta = globalSearch
        ? [secLabel, title ? it.category : it.source].filter(Boolean).join(" · ")
        : title
          ? [it.category, it.source].filter(Boolean).join(" · ")
          : sec === "achievements"
            ? (it.description || it.note || it.kindLabel || "").slice(0, 90)
            : sec === "accessories"
              ? [slotShort(it.slot), it.source].filter(Boolean).join(" · ")
              : [it.source, it.kindLabel].filter(Boolean).join(" · ");
      // реальные картинки если есть, иначе значок — во всех видах и категориях
      const pair = title ? { src: titleBadgeSrc(), fb: "" } : itemImgPair(it);
      const thumb = resultThumbHtml(it, { title });
      const opN = title ? Number(it.op) || 0 : 0;
      const opTone = title ? ` ${opClass(it.op)}` : "";
      const badge = title
        ? `<span class="ttl-op-badge ${opClass(it.op)}" title="${escapeHtml(opLabel(it.op))}"><span class="ttl-op-num">${opN}</span><span class="ttl-op-unit">ОП</span></span>`
        : "";
      const shopHtml = shopBadgeHtml(itemShopOffers(it), "result-shop ttl-req-shop");
      const achN = !title && sec !== "achievements" ? achievementsForItem(it).length : 0;
      const achHtml = achN
        ? `<span class="result-ach-badge" title="Нужен для ${achN} ${
            achN === 1 ? "достижения" : achN < 5 ? "достижений" : "достижений"
          }">★ ${achN}</span>`
        : "";
      const rank = state.rankMeta?.get(guideItemRankKey(it));
      const fuzzyHtml =
        rank?.fuzzy && rank.tier >= 4
          ? `<span class="result-fuzzy" title="Найдено с учётом опечатки">похоже</span>`
          : "";
      const nameBlock = title
        ? `<span class="result-row-top">
            <span class="result-name${opTone}">${escapeHtml(it.name)}</span>
            ${badge}
          </span>`
        : `<span class="result-name">${escapeHtml(it.name)}</span>`;
      return `
      <li>
        <button type="button" class="result ttl-result${pair.src || !title ? " has-img" : ""}${title ? " has-op" : ""}${opTone}${active}${
          rank?.fuzzy ? " is-fuzzy" : ""
        }" data-id="${it.id}" data-section="${escapeHtml(sec)}">
          ${thumb}
          <span class="result-main">
            ${nameBlock}
            <span class="result-meta">
              ${fuzzyHtml}
              ${achHtml}
              ${shopHtml}
              ${meta ? `<span class="result-sub">${escapeHtml(meta)}</span>` : ""}
            </span>
          </span>
        </button>
      </li>`;
    })
    .join("");
  const left = total - limit;
  const more =
    left > 0
      ? `<li class="result-more-wrap">
          <button type="button" class="result-more-btn" data-list-more="page">Показать ещё ${fmtCount(
            Math.min(LIST_RENDER_PAGE, left)
          )}</button>
          <button type="button" class="result-more-btn result-more-all" data-list-more="all">Все ${fmtCount(
            total
          )}</button>
        </li>`
      : "";
  els.list.innerHTML = rows + more;
  syncThumbCarousel();
}

function highlightActive() {
  els.list?.querySelectorAll(".result").forEach((btn) => {
    const sec = btn.dataset.section || "";
    btn.classList.toggle("is-fav", isFavorite(btn.dataset.id, sec));
    btn.classList.toggle("active", Number(btn.dataset.id) === state.activeId);
  });
}

function syncUrl() {
  const url = new URL(location.href);
  if (state.section && state.section !== "titles") url.searchParams.set("section", state.section);
  else url.searchParams.delete("section");
  if (state.query.trim()) url.searchParams.set("q", state.query.trim());
  else url.searchParams.delete("q");
  if (state.activeId != null) url.searchParams.set("id", String(state.activeId));
  else url.searchParams.delete("id");
  history.replaceState(null, "", url);
}

function findGuideItem(id, section) {
  const numId = Number(id);
  if (!Number.isFinite(numId)) return null;
  if (section === "titles") {
    return state.titles.find((x) => Number(x.id) === numId) || null;
  }
  if (section) {
    return state.wiki.find((x) => Number(x.id) === numId && x.kind === section) || null;
  }
  return (
    state.list.find((x) => Number(x.id) === numId) ||
    state.items.find((x) => Number(x.id) === numId) ||
    state.titles.find((x) => Number(x.id) === numId) ||
    state.wiki.find((x) => Number(x.id) === numId) ||
    null
  );
}

function selectItem(id, section) {
  state.activeId = id;
  const it =
    findGuideItem(id, section) ||
    state.list.find((x) => Number(x.id) === Number(id)) ||
    null;
  highlightActive();
  renderDetail(it);
  syncUrl();
  if (isGuideNarrow() && it) {
    if (mobileUi.tab === "fav") setMobileTab("home");
    openMobileSheet();
  }
}

function zoomImgHtml(src, name, extraClass = "", fb = "") {
  if (!src) return "";
  const extra = String(extraClass || "").trim();
  // wiki-look-img — отдельный размер; не мешать с ttl-detail-img (иначе мобилка жмёт в 3.5rem)
  const imgClass = /\bwiki-look-img\b/.test(extra)
    ? extra
    : ["ttl-detail-img", extra].filter(Boolean).join(" ");
  return `<button type="button" class="ttl-zoom-btn" data-zoom-src="${escapeHtml(src)}" data-zoom-fb="${escapeHtml(
    fb || ""
  )}" data-zoom-name="${escapeHtml(name)}" title="Открыть картинку крупно" aria-label="Открыть картинку крупно: ${escapeHtml(name)}">
    <img class="${imgClass}" src="${escapeHtml(src)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async"${imgFbAttr(
      fb
    )} />
    <span class="ttl-zoom-hint">увеличить</span>
  </button>`;
}

function closeGuideZoom() {
  const zoom = document.getElementById("guideZoom");
  if (!zoom) return;
  zoom.classList.remove("is-on");
  zoom.setAttribute("aria-hidden", "true");
  document.body.classList.remove("guide-zoom-open");
  window.setTimeout(() => {
    if (!zoom.classList.contains("is-on")) zoom.remove();
  }, 220);
}

function openGuideZoom(src, name, fb = "") {
  if (!src) return;
  closeGuideZoom();
  const zoom = document.createElement("div");
  zoom.id = "guideZoom";
  zoom.className = "guide-zoom";
  zoom.setAttribute("role", "dialog");
  zoom.setAttribute("aria-modal", "true");
  zoom.setAttribute("aria-label", name ? `Картинка: ${name}` : "Картинка");
  // крупный просмотр самой картинки (не миниатюры списка)
  zoom.innerHTML = `
    <div class="guide-zoom-card is-glitch">
      <button type="button" class="guide-zoom-close" aria-label="Закрыть">✕</button>
      <img class="guide-zoom-img is-glitch" src="${escapeHtml(src)}" alt="${escapeHtml(name || "")}"${imgFbAttr(
        fb
      )} />
      ${name ? `<div class="guide-zoom-caption">${escapeHtml(name)}</div>` : ""}
    </div>`;
  document.body.appendChild(zoom);
  document.body.classList.add("guide-zoom-open");

  const card = zoom.querySelector(".guide-zoom-card");
  const img = zoom.querySelector(".guide-zoom-img");
  // быстрый еле заметный глитч — каждый раз чуть другой
  const dur = 0.16 + Math.random() * 0.1; // 160–260мс
  if (card) {
    card.style.setProperty("--gz-dur", `${dur.toFixed(3)}s`);
    card.style.setProperty("--gz-x", `${((Math.random() - 0.5) * 5).toFixed(1)}px`);
    card.style.setProperty("--gz-y", `${((Math.random() - 0.5) * 3).toFixed(1)}px`);
    card.style.setProperty("--gz-skew", `${((Math.random() - 0.5) * 0.8).toFixed(2)}deg`);
    card.style.setProperty("--gz-hue", `${((Math.random() - 0.5) * 28).toFixed(0)}deg`);
    card.style.setProperty("--gz-ix", `${((Math.random() - 0.5) * 6).toFixed(1)}px`);
    card.style.setProperty("--gz-iy", `${((Math.random() - 0.5) * 2).toFixed(1)}px`);
  }

  if (img) {
    img.addEventListener(
      "load",
      () => {
        img.classList.add("is-ready");
      },
      { once: true }
    );
  }
  requestAnimationFrame(() => {
    zoom.classList.add("is-on");
    zoom.setAttribute("aria-hidden", "false");
  });
  const clearGlitch = () => {
    card?.classList.remove("is-glitch");
    img?.classList.remove("is-glitch");
  };
  window.setTimeout(clearGlitch, Math.round(dur * 1000) + 40);
  zoom.addEventListener("click", (e) => {
    if (e.target === zoom || e.target.closest(".guide-zoom-close")) closeGuideZoom();
  });
}

function renderDetail(it) {
  if (!els.detail) return;
  if (!it) {
    els.detail.innerHTML = isTitles()
      ? '<div class="preview-empty">Выберите титул</div>'
      : '<div class="preview-empty">Выберите предмет</div>';
    if (isGuideNarrow()) closeMobileSheet();
    return;
  }

  const sheetBar = sheetChromeHtml(it);
  const backBar = isGuideNarrow() ? "" : navBackHtml();
  const titleItem = isTitleItem(it);
  const wiki =
    it.wiki ||
    (titleItem
      ? state.titlesMeta?.source || "https://parapa.ru/wiki/index.php/%D0%A2%D0%B8%D1%82%D1%83%D0%BB"
      : state.wikiMeta?.source || "https://parapa.ru/wiki/");
  const isAch = !titleItem && (it.kind === "achievements" || state.section === "achievements");
  const hasColorLooks =
    !titleItem &&
    !isAch &&
    Array.isArray(it.lookVariants) &&
    it.lookVariants.filter((v) => lookVariantSrc(v)).length >= 2;
  const view = detailViewItem(it);
  const shownName = (it.genderNames && it.genderNames[preferredGender(it)]) || it.name;
  const reqPack = isAch ? renderAchievementRequires(it.description, it.name) : { html: "", reqs: [] };
  const stack = itemInfoStackHtml(view, {
    isTitle: titleItem,
    isAch,
    hideVariants: hasColorLooks,
    shopOffers: isAch ? [] : itemShopOffers(it),
    reqs: reqPack.reqs,
    reqsHtml: reqPack.html
      ? infoSection(
          `Что нужно · ${reqPack.reqs.length}`,
          reqPack.html,
          "ttl-info-reqs"
        )
      : "",
    wikiUrl: wiki,
  });
  const stats = detailStatsHtml(it, { isTitle: titleItem, isAch });

  if (titleItem) {
    const shotPair = itemImgPair(it);
    const topImg = shotPair.src
      ? zoomImgHtml(shotPair.src, it.name, "wiki-look-img", shotPair.fb)
      : "";
    const topClass = shotPair.src ? " has-look" : " no-thumb";
    const auraSrc = absRemoteUrl(it.auraUrl);
    const aura = auraSrc
      ? `<img class="ttl-aura-img" src="${escapeHtml(auraSrc)}" alt="Аура" loading="lazy" decoding="async" />`
      : "";
    els.detail.innerHTML = `
      <div class="ttl-detail">
        ${sheetBar}
        ${backBar}
        <div class="ttl-detail-top${topClass}">
          ${topImg}
          <div class="ttl-detail-aside">
            <div class="ttl-title-preview ${opClass(it.op)}" title="Цвет оповещения по ОП">${escapeHtml(it.name)}</div>
            ${stats}
            ${aura}
          </div>
        </div>
        <div class="ttl-detail-meta">${stack}</div>
      </div>
    `;
    return;
  }

  const iconPair = itemImgPair(it);
  const img = zoomImgHtml(iconPair.src, it.name, "wiki-detail-img", iconPair.fb);
  const topImg = isAch ? img : lookMediaHtml(it);
  const topClass = !topImg ? " no-thumb" : hasColorLooks ? " has-look-colors" : " has-look";

  if (hasColorLooks) {
    els.detail.innerHTML = `
    <div class="ttl-detail ttl-detail-colors">
      ${sheetBar}
      ${backBar}
      <div class="ttl-detail-top has-look-colors">
        <div class="ttl-look-head">
          <div class="wiki-name-preview" data-default-name="${escapeHtml(it.name)}">${escapeHtml(shownName)}</div>
          ${stats}
        </div>
        ${topImg}
      </div>
      <div class="ttl-detail-meta">${stack}</div>
    </div>`;
    return;
  }

  els.detail.innerHTML = `
    <div class="ttl-detail">
      ${sheetBar}
      ${backBar}
      <div class="ttl-detail-top${topClass}">
        ${topImg}
        <div class="ttl-detail-aside">
          <div class="wiki-name-preview" data-default-name="${escapeHtml(it.name)}">${escapeHtml(shownName)}</div>
          ${stats}
        </div>
      </div>
      <div class="ttl-detail-meta">${stack}</div>
    </div>
  `;
}

function setSection(section, { keepQuery = false, keepNavBack = false } = {}) {
  if (section !== "titles" && !WIKI_SECTIONS.has(section)) return;
  if (!keepNavBack) clearNavBack();
  leaveLanding();
  state.section = section;
  state.group = groupForSection(section).id;
  state.category = "";
  state.sourceBucket = "all";
  state.catDetailOpen = false;
  state.catDetailQ = "";
  state.op = "";
  state.activeId = null;
  if (!keepQuery) {
    state.query = "";
    if (els.q) els.q.value = "";
  }
  persistSection();
  try {
    localStorage.setItem(GROUP_KEY, state.group);
  } catch {
    /* ignore */
  }
  applySectionPool();
  buildCategoryPills();
  updateSectionUi();
  updatePillsUi();
  renderDetail(null);
  filterAndSort();
  syncUrl();
}

function prefersReducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function bindSearchFx() {
  const searchWrap = els.q?.closest(".search-wrap");
  if (!searchWrap || !els.q) return;

  let typingPulseTimer = null;

  function syncSearchLine() {
    syncBrandHeroMode();
    const empty = !els.q.value.trim();
    if (empty) {
      clearTimeout(typingPulseTimer);
      searchWrap.classList.add("is-idle");
      searchWrap.classList.remove("is-typing", "is-rest", "is-key", "is-resolved", "is-miss");
      return;
    }
    // без is-key / forced reflow на каждый символ — иначе ввод лагает
    searchWrap.classList.remove("is-idle", "is-key", "is-resolved", "is-miss");
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
  els.q.addEventListener("input", syncSearchLine);
  els.q.addEventListener("focus", syncSearchLine);
}

function bindFilterPillFx() {
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".filter-pill");
      if (!btn || !document.body.contains(btn)) return;
      if (prefersReducedMotion()) return;
      btn.classList.remove("is-click");
      void btn.offsetWidth;
      btn.classList.add("is-click");
      window.setTimeout(() => btn.classList.remove("is-click"), 520);
    },
    true
  );
}

function bindImgFbFallback() {
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      const fb = img.getAttribute("data-img-fb");
      if (!fb || img.dataset.imgFbUsed === "1") return;
      img.dataset.imgFbUsed = "1";
      img.removeAttribute("data-img-fb");
      img.src = fb;
      const zoom = img.closest("[data-zoom-src]");
      if (zoom) {
        zoom.dataset.zoomSrc = fb;
        zoom.dataset.zoomFb = "";
      }
    },
    true
  );
}

function bindUi() {
  bindSearchFx();
  bindFilterPillFx();
  bindImgFbFallback();
  els.themeToggle?.addEventListener("click", () => {
    applyTheme(nextTheme(currentTheme()));
  });
  els.imgSrcToggle?.addEventListener("click", () => {
    applyImgSrcMode(preferRemoteImages() ? "local" : "remote", { refresh: true, manual: true });
  });
  els.itemsView?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-items-view]");
    if (!btn || !els.itemsView.contains(btn)) return;
    applyItemsView(btn.dataset.itemsView);
  });

  els.menuOpen?.addEventListener("click", () => setMenu(true));
  els.menuClose?.addEventListener("click", () => setMenu(false));
  els.menuBackdrop?.addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (document.getElementById("guideZoom")?.classList.contains("is-on")) {
        closeGuideZoom();
        return;
      }
      if (document.getElementById("guideReqPeek")?.classList.contains("is-on")) {
        closeReqPeek();
        return;
      }
      if (mobileUi.sheetOpen) {
        closeMobileSheet();
        return;
      }
      if (state.catDetailOpen) {
        setCatDetailOpen(false);
        return;
      }
      if (navUi.menuOpen) {
        setGuideMenu(false);
        if (isGuideNarrow()) setMobileTab("home");
        return;
      }
      setMenu(false);
    }
  });

  els.guideBnav?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mob-tab]");
    if (!btn) return;
    setMobileTab(btn.dataset.mobTab, { fromClick: true });
  });

  els.guideSheetDim?.addEventListener("click", () => closeMobileSheet());

  // клик по пустому месту карточки / фону вокруг — закрыть
  els.detail?.addEventListener(
    "click",
    (e) => {
      if (!mobileUi.sheetOpen || !isGuideNarrow()) return;
      if (e.target.closest("[data-sheet-close], [data-sheet-expand], [data-fav-toggle]")) return;
      const t = e.target;
      const empty =
        t === els.detail ||
        t.classList?.contains("ttl-detail") ||
        t.classList?.contains("guide-sheet-chrome") ||
        t.classList?.contains("guide-sheet-chrome-spacer") ||
        t.classList?.contains("ttl-detail-top") ||
        t.classList?.contains("ttl-detail-aside") ||
        t.classList?.contains("ttl-detail-meta") ||
        t.classList?.contains("ttl-look-head");
      if (!empty) return;
      if (
        t.closest(
          "a, button, input, select, textarea, img, video, .ttl-zoom-btn, .ttl-look-variants, .ttl-look-stage, .ttl-wiki-link, [data-req-id], .ttl-info-block, .ttl-field, .ttl-stat, .ttl-detail-stats"
        )
      ) {
        return;
      }
      closeMobileSheet();
    },
    true
  );

  els.guideMobCatList?.addEventListener("click", (e) => {
    const row = e.target.closest("[data-mob-cat-kind]");
    if (!row) return;
    const kind = row.dataset.mobCatKind;
    const id = row.dataset.mobCatId;
    if (kind === "group") {
      openMobCatalogGroup(id);
      return;
    }
    if (kind === "section") pickMobCatalogSection(id);
  });

  els.guideMobCatBack?.addEventListener("click", () => {
    mobileUi.catalogOpen = state.group || GUIDE_GROUPS[0]?.id || null;
    mobileUi.catalogGroup = null;
    renderMobCatalog();
  });

  els.guideMobFavList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".result[data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const section = btn.dataset.section || "";
    if (!Number.isFinite(id)) return;
    setMobileTab("home");
    selectItem(id, section);
  });

  els.guideMobOpenMenu?.addEventListener("click", () => {
    setMobileTab("home");
    setMenu(true);
  });

  els.guideMobFocusFilters?.addEventListener("click", () => {
    setMobileTab("home");
    els.opPills?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    els.q?.focus?.({ preventScroll: true });
  });

  els.guideLandingCatalog?.addEventListener("click", () => openLandingCatalog());

  els.guideLandingQuick?.addEventListener("click", (e) => {
    const fav = e.target.closest("[data-mob-tab]");
    if (fav?.dataset.mobTab) {
      setMobileTab(fav.dataset.mobTab, { fromClick: true });
      return;
    }
    if (e.target.closest("#guideLandingSearch")) {
      setMobileTab("home", { fromClick: true });
      els.q?.focus?.({ preventScroll: false });
    }
  });

  els.guideMobChips?.addEventListener("click", (e) => {
    const groupBtn = e.target.closest("[data-mob-chip-group]");
    if (groupBtn) {
      const gid = groupBtn.dataset.mobChipGroup;
      const g = groupById(gid);
      if (!g) return;
      if (g.sections?.length === 1) {
        pickMobCatalogSection(g.sections[0]);
        return;
      }
      mobileUi.catalogOpen = gid;
      mobileUi.catalogGroup = null;
      setMobileTab("catalog", { fromClick: true });
      return;
    }
    const secBtn = e.target.closest("[data-mob-chip-section]");
    if (secBtn) {
      pickMobCatalogSection(secBtn.dataset.mobChipSection);
    }
  });

  els.detail?.addEventListener("click", (e) => {
    if (e.target.closest("[data-sheet-close]")) {
      e.preventDefault();
      closeMobileSheet();
      return;
    }
    if (e.target.closest("[data-sheet-expand]")) {
      e.preventDefault();
      toggleMobileSheetTall();
      return;
    }
    const favBtn = e.target.closest("[data-fav-toggle]");
    if (favBtn) {
      e.preventDefault();
      if (state.activeId == null) return;
      toggleFavorite(state.activeId, favBtn.dataset.favSection || state.section);
      return;
    }
    if (e.target.closest("[data-guide-nav-back]")) {
      e.preventDefault();
      goNavBack();
      return;
    }
    const genderBtn = e.target.closest(".ttl-gender-btn");
    if (genderBtn && els.detail.contains(genderBtn)) {
      e.preventDefault();
      e.stopPropagation();
      const wrap = genderBtn.closest(".ttl-look-variants");
      if (wrap) applyGenderChoice(wrap, genderBtn);
      return;
    }
    const swatch = e.target.closest(".ttl-look-swatch");
    if (swatch && els.detail.contains(swatch)) {
      e.preventDefault();
      e.stopPropagation();
      const wrap = swatch.closest(".ttl-look-variants");
      if (!wrap) return;
      applySwatchChoice(wrap, swatch);
      return;
    }
    const extLink = e.target.closest("a.ttl-mark-ext");
    if (extLink) return;
    const wikiJump = e.target.closest("[data-wiki-nav]");
    if (wikiJump) {
      e.preventDefault();
      openRequiredItem(wikiJump.dataset.reqSection || "", wikiJump.dataset.reqId, wikiJump.dataset.reqQuery || "");
      return;
    }
    const achBtn = e.target.closest(".ttl-ach[data-ach-id]");
    if (achBtn) {
      e.preventDefault();
      openAchievementFromItem(achBtn.dataset.achId);
      return;
    }
    const reqBtn = e.target.closest(".ttl-req, .ttl-mark-link");
    if (reqBtn) {
      e.preventDefault();
      const colors = [...reqBtn.querySelectorAll(".ttl-req-color")].map((el) => el.textContent.trim());
      const kindLabel = reqBtn.querySelector(".ttl-req-kind")?.textContent?.trim() || "";
      const achIt =
        state.items.find((x) => x.id === state.activeId) ||
        state.wiki.find((x) => x.kind === "achievements" && x.id === state.activeId) ||
        null;
      openReqPeek(reqBtn.dataset.reqSection || "", reqBtn.dataset.reqId, reqBtn.dataset.reqQuery || "", {
        colors,
        kindLabel,
        achDescription: achIt?.description || "",
      });
      return;
    }
    const btn = e.target.closest(".ttl-zoom-btn");
    if (!btn) return;
    e.preventDefault();
    openGuideZoom(btn.dataset.zoomSrc || "", btn.dataset.zoomName || "", btn.dataset.zoomFb || "");
  });

  els.guideTree?.addEventListener("click", (e) => {
    const groupBtn = e.target.closest("[data-guide-group]");
    if (groupBtn) {
      e.preventDefault();
      const gid = groupBtn.dataset.guideGroup;
      if (!gid || gid === state.group) return;
      setGroup(gid, { keepQuery: true });
      return;
    }
    const leaf = e.target.closest(".guide-leaf[data-section]");
    if (!leaf) return;
    const section = leaf.dataset.section;
    if (!section) return;
    if (section !== state.section) setSection(section, { keepQuery: true });
    if (isGuideDrawerViewport()) setGuideMenu(false);
    if (isGuideNarrow()) setMobileTab("home");
  });

  els.guideCatalogBtn?.addEventListener("click", () => {
    if (state.landing) {
      openLandingCatalog();
      return;
    }
    // Mobile E (titles-m): нижняя вкладка каталога
    if (isGuideNarrow()) {
      setMobileTab(mobileUi.tab === "catalog" ? "home" : "catalog", { fromClick: true });
      return;
    }
    // ПК, в т.ч. узкое окно: выезжающая панель
    setGuideMenu(!navUi.menuOpen);
  });
  els.guideSideClose?.addEventListener("click", () => {
    setGuideMenu(false);
  });
  els.guideSideBackdrop?.addEventListener("click", () => {
    setGuideMenu(false);
  });
  els.guideSideCollapse?.addEventListener("click", () => {
    navUi.collapsed = !navUi.collapsed;
    if (navUi.collapsed) navUi.sideMode = "catalog";
    persistCollapsed();
    paintGuideSideChrome();
  });

  els.guideSideModes?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-side-mode]");
    if (!btn || btn.disabled) return;
    setGuideSideMode(btn.dataset.sideMode);
  });

  const onGuideLayoutChange = () => {
    syncGuideLayoutMode();
    paintMobChips();
    paintGuideSideChrome();
    if (els.q) {
      els.q.placeholder = isGuideNarrow() ? "Название, ОП…" : "Название, описание, где взять…";
    }
    // закрыть drawer только когда окно снова широкое
    if (!isGuideDrawerViewport() && navUi.menuOpen) setGuideMenu(false);
    else paintGuideSideChrome();
  };
  const bindMq = (mq) => {
    if (!mq) return;
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onGuideLayoutChange);
    else if (typeof mq.addListener === "function") mq.addListener(onGuideLayoutChange);
  };
  bindMq(GUIDE_NARROW_MQ);
  bindMq(GUIDE_DESKTOP_POINTER_MQ);
  window.addEventListener("resize", onGuideLayoutChange);

  let t = null;
  els.q?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = els.q.value || "";
      syncUrl();
      filterAndSort();
    }, 200);
  });

  els.opPills?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-pill");
    if (!btn) return;
    state.op = btn.dataset.op ?? "";
    updatePillsUi();
    filterAndSort();
  });

  els.catBuckets?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-bucket]");
    if (!btn) return;
    const bucket = btn.dataset.bucket || "all";
    if (bucket === state.sourceBucket) return;
    state.sourceBucket = bucket;
    state.category = "";
    buildCategoryPills();
    updatePillsUi();
    filterAndSort();
  });

  els.catPills?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-pill");
    if (!btn) return;
    state.category = btn.dataset.category ?? "";
    updatePillsUi();
    paintCatDetail();
    filterAndSort();
  });

  els.catMoreToggle?.addEventListener("click", () => {
    setCatDetailOpen(!state.catDetailOpen);
  });
  els.catDetailClose?.addEventListener("click", () => setCatDetailOpen(false));
  els.catDetailQ?.addEventListener("input", () => {
    state.catDetailQ = els.catDetailQ.value || "";
    paintCatDetail();
  });
  els.catDetailList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-category]");
    if (!btn) return;
    state.category = btn.dataset.category ?? "";
    buildCategoryPills();
    updatePillsUi();
    filterAndSort();
  });

  els.sortPills?.addEventListener("click", (e) => {
    const btn = e.target.closest(".sort-pill");
    if (!btn || btn.hidden) return;
    state.sort = btn.dataset.sort || "name";
    persistSort();
    updatePillsUi();
    filterAndSort();
  });

  els.costCurrencyPills?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cost-currency]");
    if (!btn || els.costCurrencyPills.hidden) return;
    state.costCurrency = btn.dataset.costCurrency || "";
    persistCostCurrency();
    updatePillsUi();
    filterAndSort();
  });

  els.list?.addEventListener("click", (e) => {
    const moreBtn = e.target.closest("[data-list-more]");
    if (moreBtn) {
      const mode = moreBtn.dataset.listMore || "page";
      const total = state.list.length;
      if (mode === "all") listRenderLimit = total;
      else listRenderLimit = Math.min(total, listRenderLimit + LIST_RENDER_PAGE);
      renderList();
      return;
    }
    const btn = e.target.closest(".result");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (Number.isFinite(id)) selectItem(id, btn.dataset.section || "");
  });
}

async function loadData() {
  const [titlesRes, wikiRes, shopRes] = await Promise.all([
    fetch("./data/titles.json", { cache: "no-store" }),
    fetch("./data/wiki_items.json", { cache: "no-store" }),
    fetch("./data/items.json", { cache: "no-store" }),
  ]);
  if (!titlesRes.ok) throw new Error("titles.json " + titlesRes.status);
  const titlesData = await titlesRes.json();
  state.titlesMeta = titlesData;
  state.titles = Array.isArray(titlesData.items) ? titlesData.items : [];

  if (wikiRes.ok) {
    const wikiData = await wikiRes.json();
    state.wikiMeta = wikiData;
    state.wiki = Array.isArray(wikiData.items) ? wikiData.items : [];
  } else {
    state.wikiMeta = { byKind: {}, kinds: [] };
    state.wiki = [];
  }

  if (shopRes.ok) {
    const shopData = await shopRes.json();
    state.shopItems = Array.isArray(shopData.items) ? shopData.items : [];
  } else {
    state.shopItems = [];
  }
  buildShopIndex();
}

function storedImgSrcMode() {
  try {
    const m = localStorage.getItem(IMG_SRC_KEY);
    return IMG_SRC_MODES.includes(m) ? m : "local";
  } catch {
    return "local";
  }
}

async function init() {
  applyTheme(currentTheme());
  applyImgSrcMode(storedImgSrcMode(), { persist: false });
  applyItemsView(storedItemsView(), { persist: false });
  syncGuideLayoutMode();
  bindUi();
  try {
    await loadData();
  } catch (err) {
    if (els.detail) {
      els.detail.innerHTML = `<div class="preview-empty">Не удалось загрузить данные.<br>${escapeHtml(
        String(err.message || err)
      )}</div>`;
    }
    return;
  }

  buildReqCatalog();
  buildAchRequiresIndex();
  applySectionPool();
  buildCategoryPills();
  updateSectionUi();
  updatePillsUi();

  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  if (q && els.q) {
    els.q.value = q;
    state.query = q;
  }
  const id = Number(params.get("id"));
  // пустой «только поиск» — только на телефоне; на ПК сразу полный гид с каталогом
  state.landing = isGuideNarrow() && !hasGuideDeepLink();
  paintLandingChrome();
  filterAndSort();
  if (!state.landing && Number.isFinite(id) && id > 0 && state.items.some((it) => it.id === id)) {
    selectItem(id);
  }

  // авто-выбор источника картинок не блокирует UI; после ручного клика больше не трогаем
  void maybeAutoPickImgSrc();

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.FuturumPortalLive?.notifyReady?.({ page: "titles" });
    });
  });
}

init();

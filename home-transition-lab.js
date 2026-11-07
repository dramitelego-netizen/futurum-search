const EFFECTS = [
  {
    id: "true-window",
    name: "1 · Живое окно",
    hint: "Настоящая страница на весь экран, видна через вырез из плитки. Это и есть «окно», не картинка на обороте.",
    mode: "portal",
  },
  {
    id: "window-door",
    name: "2 · Окно + створка",
    hint: "То же живое окно, створка откидывается сильнее в сторону (дверь).",
    mode: "portal",
    door: true,
  },
  {
    id: "window-slow",
    name: "3 · Окно медленно",
    hint: "Живое окно, более плавное и длинное раскрытие.",
    mode: "portal",
    duration: 1600,
  },
  {
    id: "window-flip",
    name: "4 · Карточка-переворот",
    hint: "Старый способ: сайт уменьшен на обороте карточки — выглядит как картинка. Для сравнения.",
    mode: "card",
  },
  {
    id: "soft-door",
    name: "5 · Карточка-дверь",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "book",
    name: "6 · Карточка-книга",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "cube",
    name: "7 · Карточка-куб",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "iris",
    name: "8 · Карточка-диафрагма",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "tunnel",
    name: "9 · Карточка-туннель",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "zoom-fade",
    name: "10 · Карточка zoom",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "float-flip",
    name: "11 · Карточка float",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
  {
    id: "cinematic",
    name: "12 · Карточка cinematic",
    hint: "Карточный эффект (не живое окно).",
    mode: "card",
  },
];

const body = document.body;
const list = document.getElementById("fxList");
const hint = document.getElementById("fxHint");
const title = document.getElementById("fxTitle");
const gate = document.getElementById("gateDemo");
const flash = document.getElementById("flash");
const replayBtn = document.getElementById("replayBtn");
const autoPreview = document.getElementById("autoPreview");

let current = EFFECTS[0].id;
let busy = false;

function metaOf(id) {
  return EFFECTS.find((f) => f.id === id) || EFFECTS[0];
}

function setFx(id) {
  current = id;
  EFFECTS.forEach((fx) => body.classList.remove(`fx-${fx.id}`));
  body.classList.add(`fx-${id}`);
  const meta = metaOf(id);
  if (title) title.textContent = meta.name;
  if (hint) hint.textContent = meta.hint;
  list?.querySelectorAll(".lab-fx").forEach((btn) => {
    const on = btn.dataset.fx === id;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  try {
    localStorage.setItem("futurum_home_fx_pick", id);
  } catch {
    /* ignore */
  }
  warm();
}

function previewSrc() {
  return gate?.getAttribute("data-preview") || "./shop.html";
}

function flapSrc() {
  return gate?.querySelector(".home-gate-media img")?.getAttribute("src") || "";
}

function warm() {
  if (!autoPreview?.checked) return;
  const meta = metaOf(current);
  if (meta.mode === "portal") {
    window.FuturumPortal?.preload(previewSrc());
    return;
  }
  const iframe = gate?.querySelector(".home-gate-preview");
  const src = previewSrc();
  if (!iframe || !src) return;
  if (iframe.dataset.ready === "1") return;
  iframe.src = src;
  iframe.dataset.ready = "1";
}

function resetCardVisual() {
  busy = false;
  body.classList.remove("is-portal-dive");
  gate?.classList.remove("is-diving");
  flash?.classList.remove("is-on");
  const flip = gate?.querySelector(".home-gate-3d");
  if (flip) flip.style.animation = "none";
  void gate?.offsetWidth;
  if (flip) flip.style.animation = "";
}

function playCard() {
  if (!gate || busy) return;
  busy = true;
  warm();

  const rect = gate.getBoundingClientRect();
  const nx = rect.left / window.innerWidth + rect.width / window.innerWidth / 2 - 0.5;
  const ny = rect.top / window.innerHeight + rect.height / window.innerHeight / 2 - 0.5;
  gate.style.setProperty("--dive-x", `${(-nx * 14).toFixed(2)}vw`);
  gate.style.setProperty("--dive-y", `${(-ny * 10).toFixed(2)}vh`);
  gate.style.setProperty("--dive-yaw", `${nx >= 0 ? -8 : 8}deg`);

  body.classList.add("is-portal-dive");
  gate.classList.add("is-diving");
  flash?.classList.remove("is-on");
  void flash?.offsetWidth;
  flash?.classList.add("is-on");

  window.setTimeout(resetCardVisual, current === "cinematic" ? 1700 : 1450);
}

function playPortal() {
  if (!gate || busy || !window.FuturumPortal) return;
  busy = true;
  warm();

  gate.classList.add("is-diving");
  const meta = metaOf(current);
  const rect = gate.getBoundingClientRect();

  window.FuturumPortal.openPortal({
    rect,
    src: previewSrc(),
    flapSrc: flapSrc(),
    navigate: false,
    door: !!meta.door,
    duration: meta.duration || (meta.door ? 1250 : 1150),
    onDone: () => {
      busy = false;
      gate.classList.remove("is-diving");
    },
  });
}

function play() {
  const meta = metaOf(current);
  if (meta.mode === "portal") playPortal();
  else playCard();
}

function buildList() {
  if (!list) return;
  list.innerHTML = EFFECTS.map(
    (fx) => `
    <button type="button" class="lab-fx" role="option" data-fx="${fx.id}">
      ${fx.name}
      <small>${fx.hint}</small>
    </button>`
  ).join("");

  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".lab-fx");
    if (!btn) return;
    window.FuturumPortal?.closeLabPortal();
    resetCardVisual();
    setFx(btn.dataset.fx);
  });
}

buildList();

let saved = "true-window";
try {
  saved = localStorage.getItem("futurum_home_fx_pick") || saved;
} catch {
  /* ignore */
}
if (!EFFECTS.some((f) => f.id === saved)) saved = EFFECTS[0].id;
setFx(saved);

gate?.addEventListener("pointerenter", warm, { once: true });
gate?.addEventListener("click", (e) => {
  e.preventDefault();
  play();
});
replayBtn?.addEventListener("click", () => {
  window.FuturumPortal?.closeLabPortal();
  resetCardVisual();
  window.setTimeout(play, 50);
});

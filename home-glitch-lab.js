(() => {
  const G = window.FuturumGlitch;
  if (!G?.PRESETS) {
    console.warn("FuturumGlitch presets missing");
    return;
  }

  const list = document.getElementById("fxList");
  const hint = document.getElementById("fxHint");
  const title = document.getElementById("fxTitle");
  const tile = document.getElementById("tile");
  const replayBtn = document.getElementById("replayBtn");

  const ORDER = G.PRESET_ORDER || [];
  let lastId = null;
  let busy = false;

  // сбросить старую «фиксацию» — на сайте только random
  try {
    localStorage.setItem(G.PRESET_KEY, "random");
  } catch {
    /* ignore */
  }

  function chanceText(id) {
    const w = G.PRESET_WEIGHTS?.[id] ?? "—";
    const pct = G.weightChance?.(id);
    return `вес ${w} · ~${pct}%`;
  }

  function bar(level) {
    return "▮".repeat(level) + "▯".repeat(10 - level);
  }

  function markLast(id) {
    list?.querySelectorAll(".glab-fx").forEach((row) => {
      row.classList.toggle("on", row.dataset.fx === id);
    });
  }

  function runPreview() {
    if (busy) return;
    busy = true;
    const id = G.pickWeightedPresetId();
    lastId = id;
    const meta = G.PRESETS[id];
    if (title) title.textContent = meta?.name || id;
    if (hint) {
      hint.textContent = `Выпало: ${meta?.name || id}. ${chanceText(id)}. Дальше снова случайно.`;
    }
    markLast(id);

    const ok = G.openGlitchNav({
      href: "./shop.html",
      src: "./shop.html",
      preset: id,
      preview: true,
      onDone: () => {
        busy = false;
      },
    });
    if (!ok) busy = false;
    window.setTimeout(() => {
      busy = false;
    }, 3200);
  }

  ORDER.forEach((id) => {
    const meta = G.PRESETS[id];
    if (!meta) return;
    const level = meta.level || ORDER.indexOf(id) + 1;
    const row = document.createElement("div");
    row.className = "glab-fx";
    row.dataset.fx = id;
    row.innerHTML = `<strong>${meta.name}</strong><span>${bar(level)} · ${chanceText(id)}</span>`;
    list?.appendChild(row);
  });

  tile?.addEventListener("click", () => runPreview());
  replayBtn?.addEventListener("click", () => runPreview());

  if (title) title.textContent = "Случайный глитч";
  if (lastId) markLast(lastId);
})();

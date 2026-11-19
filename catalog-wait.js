/**
 * Skeletons that match each page's real rows while catalog JSON is in flight.
 * ?slow=1 holds the fetch so a slow connection can be previewed locally.
 */
(() => {
  const ROWS = 7;
  /* Fast connections finish before this, so the bars never appear. */
  const SHOW_AFTER = 400;
  let showTimer = 0;
  let released = false;

  function wantSlow() {
    try {
      return new URLSearchParams(location.search).has("slow");
    } catch {
      return false;
    }
  }

  function detect() {
    if (document.body.classList.contains("catalog-page")) return "catalog";
    if (document.body.classList.contains("shop-page")) return "shop";
    if (document.body.classList.contains("guide-layout-mobile")) return "guide-m";
    return "guide";
  }

  function listEl(mode) {
    if (mode === "catalog") return document.getElementById("catList");
    return document.getElementById("results");
  }

  function row(mode, i) {
    if (mode === "shop") {
      return (
        '<li class="cw-skel"><div class="result cw-skel-row" aria-hidden="true">' +
        '<span class="result-main"><span class="cw-skel-line name"></span></span>' +
        '<span class="cw-skel-price"></span></div></li>'
      );
    }
    if (mode === "catalog") {
      return (
        '<li class="cw-skel"><div class="cat-row cw-skel-row" aria-hidden="true">' +
        '<div class="cat-item"><span class="cw-skel-thumb"></span>' +
        '<span class="cat-item-main"><span class="cw-skel-line name"></span>' +
        '<span class="cw-skel-line price"></span></span></div>' +
        '<span class="cw-skel-star"></span></div></li>'
      );
    }
    if (mode === "guide-m") {
      return (
        '<li class="cw-skel"><div class="result ttl-result has-img cw-skel-row" aria-hidden="true">' +
        '<span class="cw-skel-thumb"></span><span class="result-main">' +
        '<span class="cw-skel-line name"></span></span></div></li>'
      );
    }
    return (
      '<li class="cw-skel"><div class="result ttl-result has-img cw-skel-row" aria-hidden="true">' +
      '<span class="cw-skel-thumb"></span><span class="result-main">' +
      '<span class="cw-skel-line name"></span><span class="cw-skel-line meta"></span>' +
      "</span></div></li>"
    );
  }

  function detailHtml() {
    return (
      '<div class="cw-detail" aria-hidden="true">' +
      '<div class="cw-detail-shot"></div>' +
      '<span class="cw-skel-line name"></span>' +
      '<span class="cw-skel-line meta"></span>' +
      '<div class="cw-detail-block"></div>' +
      "</div>"
    );
  }

  function mark(list) {
    if (!list) return;
    list.setAttribute("aria-busy", "true");
  }

  function reveal() {
    if (released) return;
    document.documentElement.classList.add("is-catalog-wait");
    mark(listEl(detect()));
  }

  function fill(mode) {
    const kind = mode === "guide" && document.body.classList.contains("guide-layout-mobile")
      ? "guide-m"
      : mode || detect();
    const list = listEl(kind);
    if (!list) return;
    mark(list);
    list.innerHTML = Array.from({ length: ROWS }, (_, i) => row(kind, i)).join("");
    if (kind === "catalog") {
      const detail = document.getElementById("catDetail");
      if (detail) detail.innerHTML = detailHtml();
    }
    reveal();
  }

  function release() {
    released = true;
    clearTimeout(showTimer);
    document.documentElement.classList.remove("is-catalog-wait");
    document.querySelectorAll("[aria-busy='true']").forEach((el) => {
      if (el.id === "results" || el.id === "catList") el.removeAttribute("aria-busy");
    });
  }

  function demoGate() {
    if (!wantSlow()) return Promise.resolve();
    return new Promise((r) => setTimeout(r, 2400));
  }

  function boot() {
    if (wantSlow()) {
      reveal();
      return;
    }
    showTimer = setTimeout(reveal, SHOW_AFTER);
  }

  window.FuturumCatalogWait = { fill, release, demoGate, detect };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

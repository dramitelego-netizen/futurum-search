(() => {
  const KEY = "futurum_edge_swap";
  const OUT_MS = { left: 440, right: 440, fade: 340 };
  const IN_MS = { left: 480, right: 480, fade: 440 };
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false;

  function normalizeEdge(edge) {
    if (edge === "left" || edge === "fade") return edge;
    return "right";
  }

  function clearSwapClasses() {
    document.documentElement.classList.remove(
      "edge-swap-out",
      "edge-swap-out-left",
      "edge-swap-out-right",
      "edge-swap-out-fade",
      "edge-swap-in",
      "edge-swap-in-left",
      "edge-swap-in-right",
      "edge-swap-in-fade"
    );
  }

  function playEnter() {
    if (window !== window.top) return;

    const already =
      document.documentElement.classList.contains("edge-swap-in");
    let raw = null;
    try {
      raw = sessionStorage.getItem(KEY);
      if (raw) sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }

    let edge = null;
    if (already) {
      if (document.documentElement.classList.contains("edge-swap-in-left")) {
        edge = "left";
      } else if (document.documentElement.classList.contains("edge-swap-in-fade")) {
        edge = "fade";
      } else {
        edge = "right";
      }
    } else if (raw && !reduce) {
      try {
        const data = JSON.parse(raw);
        if (data?.edge && Date.now() - (data.t || 0) <= 8000) {
          edge = normalizeEdge(data.edge);
          document.documentElement.classList.add(
            "edge-swap-in",
            `edge-swap-in-${edge}`
          );
        }
      } catch {
        /* ignore */
      }
    }

    if (!edge || reduce) {
      clearSwapClasses();
      return;
    }

    const clear = () => clearSwapClasses();
    const body = document.body;
    const onEnd = (e) => {
      if (e.target !== body) return;
      body.removeEventListener("animationend", onEnd);
      clear();
    };
    body?.addEventListener("animationend", onEnd);
    window.setTimeout(clear, IN_MS[edge] || 480);
  }

  function go(href, edge) {
    if (!href || busy) return;
    busy = true;
    const dir = normalizeEdge(edge);
    if (reduce) {
      window.location.href = href;
      return;
    }
    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ edge: dir, t: Date.now(), href })
      );
    } catch {
      /* ignore */
    }

    clearSwapClasses();
    // force reflow so leave keyframes always start from current paint
    void document.body?.offsetWidth;
    document.documentElement.classList.add("edge-swap-out", `edge-swap-out-${dir}`);

    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      window.location.href = href;
    };

    const body = document.body;
    const onEnd = (e) => {
      if (e.target !== body) return;
      body.removeEventListener("animationend", onEnd);
      navigate();
    };
    body?.addEventListener("animationend", onEnd);
    window.setTimeout(navigate, OUT_MS[dir] || 440);
  }

  function bindClick(el, edge) {
    el.addEventListener("click", (e) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const href = el.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      e.preventDefault();
      go(href, edge);
    });
  }

  function bind() {
    if (window !== window.top) return;

    document.querySelectorAll(".edge-neon[href]").forEach((el) => {
      bindClick(el, normalizeEdge(el.dataset.edge));
    });

    document
      .querySelectorAll(
        'a.side-nav-btn[href$="shop.html"], a.side-nav-btn[href$="titles.html"], a[data-edge-swap]'
      )
      .forEach((el) => {
        if (el.classList.contains("edge-neon")) return;
        if (el.classList.contains("on") || el.getAttribute("aria-current") === "page") {
          return;
        }
        bindClick(el, normalizeEdge(el.dataset.edge || el.dataset.edgeSwap));
      });
  }

  function onShow(e) {
    if (e.persisted) {
      busy = false;
      clearSwapClasses();
    }
  }

  window.addEventListener("pageshow", onShow);

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        playEnter();
        bind();
      },
      { once: true }
    );
  } else {
    playEnter();
    bind();
  }

  window.FuturumEdgeSwap = { go, KEY };
})();

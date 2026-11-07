(() => {
  const KEY = "futurum_edge_swap";
  const FADE_MS = 340;
  const gates = document.querySelectorAll(".home-gate[href]");
  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false;

  function dive(_gate, href) {
    if (busy) return;
    busy = true;

    if (reduce) {
      window.location.href = href;
      return;
    }

    try {
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ edge: "fade", t: Date.now(), href })
      );
    } catch {
      /* ignore */
    }

    // общий leave из edge-swap.css (подключён на хабе) — без cube-flip is-diving
    document.documentElement.classList.remove(
      "edge-swap-out",
      "edge-swap-out-left",
      "edge-swap-out-right",
      "edge-swap-out-fade"
    );
    void document.body.offsetWidth;
    document.documentElement.classList.add("edge-swap-out", "edge-swap-out-fade");

    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      window.location.href = href;
    };
    const onEnd = (e) => {
      if (e.target !== document.body) return;
      document.body.removeEventListener("animationend", onEnd);
      navigate();
    };
    document.body.addEventListener("animationend", onEnd);
    window.setTimeout(navigate, FADE_MS);
  }

  gates.forEach((gate) => {
    gate.addEventListener("click", (e) => {
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
      const href = gate.getAttribute("href");
      if (!href || href.startsWith("http")) return;
      e.preventDefault();
      dive(gate, href);
    });
  });

  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    busy = false;
    document.documentElement.classList.remove(
      "edge-swap-out",
      "edge-swap-out-left",
      "edge-swap-out-right",
      "edge-swap-out-fade",
      "is-home-fade"
    );
    document.body.classList.remove("is-home-fade-out");
  });
})();

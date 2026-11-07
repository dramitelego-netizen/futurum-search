(() => {
  /**
   * Жизнь целевой страницы в iframe во время глитча + сигнал «страница готова».
   */
  const FLAG = "futurum-live-handoff";

  function inPortalFrame() {
    try {
      return window !== window.top;
    } catch {
      return true;
    }
  }

  function shouldSkipBootFx() {
    return (
      inPortalFrame() ||
      document.documentElement.classList.contains("is-portal-live") ||
      document.documentElement.classList.contains("is-portal-promoted")
    );
  }

  function wake(reason) {
    document.documentElement.classList.add("is-portal-live");
    if (document.body) document.body.classList.add("is-portal-live");
    window.dispatchEvent(
      new CustomEvent("futurum-portal-live", { detail: { reason: reason || "wake" } })
    );
  }

  function notifyReady(detail) {
    document.documentElement.dataset.futurumReady = "1";
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: "futurum-page-ready", ...(detail && typeof detail === "object" ? detail : {}) },
          location.origin
        );
      }
    } catch {
      /* ignore */
    }
    window.dispatchEvent(
      new CustomEvent("futurum-page-ready", { detail: detail || null })
    );
  }

  function boot() {
    if (inPortalFrame()) wake("iframe");
    try {
      if (sessionStorage.getItem(FLAG) === "1") {
        sessionStorage.removeItem(FLAG);
        wake("handoff");
      }
    } catch {
      /* ignore */
    }
  }

  window.addEventListener("message", (e) => {
    const t = e?.data?.type;
    if (t === "futurum-portal-live" || t === "futurum-portal-promote") {
      wake(t);
    }
    if (t === "futurum-ask-ready" && document.documentElement.dataset.futurumReady === "1") {
      notifyReady({ page: "ping" });
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  window.FuturumPortalLive = {
    inPortalFrame,
    shouldSkipBootFx,
    wake,
    notifyReady,
  };
})();

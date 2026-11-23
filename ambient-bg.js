(() => {
  const bg = document.querySelector(".home-bg-video");
  if (!bg) return;

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    bg.pause();
    return;
  }

  const kick = () => {
    const p = bg.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  kick();
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) kick();
    },
    { passive: true }
  );
})();

(() => {
  const body = document.body;
  const cube = document.getElementById("cube");
  const live = document.getElementById("live");
  const replayBtn = document.getElementById("replayBtn");
  const hint = document.getElementById("hint");
  const src = cube?.getAttribute("data-src") || "./shop.html";

  const HINTS = {
    flip: "Квадрат переворачивается. На обороте — живой shop.html внутри грани (поиск, FUTURUM), не картинка кота.",
    door: "Створка открывается влево. На обороте тот же живой сайт в грани куба.",
  };

  let busy = false;
  let holdTimer = 0;

  function setFx(fx) {
    body.dataset.fx = fx;
    document.querySelectorAll(".cube-fx").forEach((btn) => {
      const on = btn.dataset.fx === fx;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (hint) hint.textContent = HINTS[fx] || HINTS.flip;
    try {
      localStorage.setItem("futurum_cube_fx", fx);
    } catch {
      /* ignore */
    }
  }

  function ensureLive() {
    if (!live) return;
    if (live.dataset.ready === "1") return;
    live.src = src;
    live.dataset.ready = "1";
  }

  function reset() {
    busy = false;
    window.clearTimeout(holdTimer);
    body.classList.remove("is-diving", "show-back");
    cube?.classList.remove("is-diving");
    const inner = document.getElementById("cubeInner");
    if (inner) {
      inner.style.animation = "none";
      void inner.offsetWidth;
      inner.style.animation = "";
    }
  }

  function play() {
    if (!cube || busy) return;
    busy = true;
    ensureLive();
    body.classList.add("is-diving");
    cube.classList.add("is-diving");

    // после переворота держим оборот, чтобы было видно живой сайт
    holdTimer = window.setTimeout(() => {
      body.classList.add("show-back");
      busy = false;
    }, 1150);
  }

  document.querySelectorAll(".cube-fx").forEach((btn) => {
    btn.addEventListener("click", () => {
      reset();
      setFx(btn.dataset.fx);
    });
  });

  cube?.addEventListener("pointerenter", ensureLive, { once: true });
  cube?.addEventListener("click", (e) => {
    e.preventDefault();
    if (body.classList.contains("show-back")) {
      reset();
      window.setTimeout(play, 40);
      return;
    }
    play();
  });

  replayBtn?.addEventListener("click", () => {
    reset();
    window.setTimeout(play, 40);
  });

  let saved = "flip";
  try {
    saved = localStorage.getItem("futurum_cube_fx") || saved;
  } catch {
    /* ignore */
  }
  if (saved !== "flip" && saved !== "door") saved = "flip";
  setFx(saved);
  ensureLive();
})();

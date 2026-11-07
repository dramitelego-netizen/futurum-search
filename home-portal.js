(() => {
  const REDUCE =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cache = new Map();
  let portalGen = 0;
  let activeSession = null;

  function preload(src) {
    if (!src || cache.has(src)) return cache.get(src);
    const iframe = document.createElement("iframe");
    iframe.className = "portal-win-preload";
    iframe.title = "";
    iframe.tabIndex = -1;
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;left:-120vw;top:0;width:100vw;height:100vh;opacity:0;pointer-events:none;border:0;";
    iframe.src = src;
    document.body.appendChild(iframe);
    cache.set(src, iframe);
    return iframe;
  }

  function takeFrame(src) {
    const cached = cache.get(src);
    if (cached && cached.parentNode) {
      cache.delete(src);
      return cached;
    }
    const iframe = document.createElement("iframe");
    iframe.src = src;
    return iframe;
  }

  function openPortal({
    rect,
    src,
    flapSrc,
    navigate = false,
    href = src,
    duration = 1150,
    door = false,
    onDone,
  }) {
    if (!src || !rect) {
      onDone?.();
      return null;
    }

    if (REDUCE) {
      if (navigate) window.location.href = href;
      else onDone?.();
      return null;
    }

    // отменяем предыдущий портал (лаба: смена эффекта / replay)
    closeLabPortal();

    const gen = ++portalGen;
    document.body.classList.add("has-portal-win");

    const root = document.createElement("div");
    root.className = "portal-win";
    root.setAttribute("aria-hidden", "true");
    root.dataset.portalGen = String(gen);

    const glass = document.createElement("div");
    glass.className = "portal-win-glass";

    const iframe = takeFrame(src);
    iframe.className = "portal-win-frame";
    iframe.title = "Окно перехода";
    iframe.tabIndex = -1;
    iframe.style.cssText = "";
    glass.appendChild(iframe);

    const flap = document.createElement("div");
    flap.className = "portal-win-flap";
    flap.style.top = `${rect.top}px`;
    flap.style.left = `${rect.left}px`;
    flap.style.width = `${rect.width}px`;
    flap.style.height = `${rect.height}px`;
    if (flapSrc) {
      const img = document.createElement("img");
      img.src = flapSrc;
      img.alt = "";
      img.decoding = "async";
      flap.appendChild(img);
    }
    const wash = document.createElement("div");
    wash.className = "portal-win-flap-wash";
    flap.appendChild(wash);

    const rim = document.createElement("div");
    rim.className = "portal-win-rim";
    rim.style.top = `${rect.top}px`;
    rim.style.left = `${rect.left}px`;
    rim.style.width = `${rect.width}px`;
    rim.style.height = `${rect.height}px`;

    root.appendChild(glass);
    root.appendChild(flap);
    root.appendChild(rim);
    document.body.appendChild(root);

    const t = Math.max(0, rect.top);
    const r = Math.max(0, window.innerWidth - rect.right);
    const b = Math.max(0, window.innerHeight - rect.bottom);
    const l = Math.max(0, rect.left);
    const fromClip = `inset(${t}px ${r}px ${b}px ${l}px round 18px)`;
    const toClip = "inset(0px round 0px)";

    glass.style.clipPath = fromClip;

    const ease = "cubic-bezier(0.22, 0.72, 0.12, 1)";

    const glassAnim = glass.animate(
      [{ clipPath: fromClip }, { clipPath: toClip }],
      { duration, easing: ease, fill: "forwards" }
    );

    const flapKeyframes = door
      ? [
          {
            transform: "perspective(1400px) rotateY(0deg)",
            opacity: 1,
            filter: "blur(0px)",
          },
          {
            transform: "perspective(1400px) rotateY(-88deg)",
            opacity: 0.55,
            filter: "blur(0px)",
            offset: 0.6,
          },
          {
            transform: "perspective(1400px) rotateY(-118deg)",
            opacity: 0,
            filter: "blur(2px)",
          },
        ]
      : [
          {
            transform: "perspective(1400px) rotateY(0deg) translateZ(0)",
            opacity: 1,
            filter: "blur(0px)",
          },
          {
            transform: "perspective(1400px) rotateY(-72deg) translateZ(40px)",
            opacity: 0.35,
            filter: "blur(1px)",
            offset: 0.55,
          },
          {
            transform: "perspective(1400px) rotateY(-105deg) translateZ(80px)",
            opacity: 0,
            filter: "blur(6px)",
          },
        ];

    const flapAnim = flap.animate(flapKeyframes, {
      duration: duration * (door ? 0.9 : 0.85),
      easing: ease,
      fill: "forwards",
    });

    const rimAnim = rim.animate(
      [
        {
          top: `${rect.top}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderRadius: "18px",
          opacity: 1,
        },
        {
          top: "0px",
          left: "0px",
          width: `${window.innerWidth}px`,
          height: `${window.innerHeight}px`,
          borderRadius: "0px",
          opacity: 0,
        },
      ],
      { duration, easing: ease, fill: "forwards" }
    );

    let finished = false;
    const finish = () => {
      if (finished || gen !== portalGen) return;
      finished = true;
      if (activeSession?.gen === gen) activeSession = null;
      if (navigate) {
        window.location.href = href;
        return;
      }
      root.remove();
      document.body.classList.remove("has-portal-win");
      preload(src);
      onDone?.();
    };

    const timer = window.setTimeout(finish, duration + 80);
    glassAnim.finished.then(finish).catch(() => {});

    activeSession = {
      gen,
      root,
      timer,
      anims: [glassAnim, flapAnim, rimAnim],
      finish,
    };

    return root;
  }

  function closeLabPortal() {
    portalGen += 1;
    if (activeSession) {
      window.clearTimeout(activeSession.timer);
      activeSession.anims.forEach((a) => {
        try {
          a.cancel();
        } catch {
          /* ignore */
        }
      });
      activeSession = null;
    }
    document.querySelectorAll(".portal-win").forEach((n) => n.remove());
    document.body.classList.remove("has-portal-win", "is-portal-dive");
  }

  window.FuturumPortal = { preload, openPortal, closeLabPortal };
})();

(() => {
  /**
   * Глитч-переход с хаба:
   * целевая страница живёт с первого кадра (в iframe / из прогретого превью),
   * просвечивает сквозь разрывы; в конце iframe повышается до «настоящей» страницы
   * без перезагрузки — анимации не сбрасываются.
   */
  const REDUCE =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LIVE_FLAG = "futurum-live-handoff";
  const PRESET_KEY = "futurum_glitch_preset";
  let gen = 0;

  /** 10 ступеней жёсткости: 1 мягкий → 10 максимум */
  const LEVEL_LABELS = [
    "Мягкий шёпот",
    "Лёгкая рябь",
    "Мягкий+",
    "Спокойный сбой",
    "Средний",
    "Средний+",
    "Жёсткий",
    "Жёсткий+",
    "Агрессивный",
    "Максимум",
  ];

  const LEVEL_HINTS = [
    "Почти незаметный переход, сайт проявляется спокойно.",
    "Чуть заметная рябь и редкие полосы.",
    "Лёгкий цифровой сдвиг без сильной тряски.",
    "Уже читается как глитч, но ещё мягко.",
    "Баланс: разрывы и RGB, сайт виден сквозь слой.",
    "Заметнее удары и цветовые сдвиги.",
    "Сильные сдвиги и вспышки — страница ломается явно.",
    "Агрессивный сбой, много разрезов и тряски.",
    "Почти хаос: плотные удары до появления сайта.",
    "Полный разнос — максимальная жёсткость.",
  ];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function buildLevelPreset(level) {
    // level 1..10 → t 0..1
    const t = (level - 1) / 9;
    const id = `g${level}`;
    const allModes = ["tear", "block", "wave", "scatter"];
    const modeCount = Math.max(1, Math.round(lerp(1, 4, t)));
    return {
      id,
      level,
      name: `${level} · ${LEVEL_LABELS[level - 1]}`,
      hint: LEVEL_HINTS[level - 1],
      duration: Math.round(lerp(1120, 1500, t)),
      chaos: lerp(0.16, 1.45, t),
      hitMin: Math.round(lerp(2, 18, t)),
      hitMax: Math.round(lerp(3, 26, t)),
      glitchEnd: lerp(0.48, 0.9, t),
      displace: lerp(14, 165, t),
      dy: lerp(8, 85, t),
      skew: lerp(1.2, 22, t),
      scaleJitter: lerp(0.025, 0.3, t),
      hue: lerp(30, 260, t),
      sat: lerp(0.35, 3, t),
      contrast: lerp(0.18, 1.5, t),
      invertChance: lerp(0.02, 0.45, t),
      ghost: lerp(0.12, 0.85, t),
      ghostMove: lerp(8, 52, t),
      beatMs: [Math.round(lerp(48, 10, t)), Math.round(lerp(78, 22, t))],
      scan: lerp(0.1, 0.7, t),
      bars: lerp(0.25, 2, t),
      flash: t >= 0.35,
      revealFade: lerp(0.72, 0.28, t),
      modes: allModes.slice(0, modeCount),
    };
  }

  const PRESETS = {};
  const PRESET_ORDER = [];
  const PRESET_WEIGHTS = {};
  for (let level = 1; level <= 10; level += 1) {
    const p = buildLevelPreset(level);
    PRESETS[p.id] = p;
    PRESET_ORDER.push(p.id);
    // 1→100, 2→90 … 10→10 (относительные веса)
    PRESET_WEIGHTS[p.id] = 110 - level * 10;
  }
  // алиасы старых id → ближайшие уровни (если что-то в localStorage)
  PRESETS.soft = PRESETS.g1;
  PRESETS.softPlus = PRESETS.g3;
  PRESETS.medium = PRESETS.g5;
  PRESETS.hard = PRESETS.g7;
  PRESETS.brutal = PRESETS.g8;
  PRESETS.brutalMax = PRESETS.g10;

  function getSavedPresetId() {
    try {
      const v = localStorage.getItem(PRESET_KEY);
      if (v === "random" || !v) return "random";
      if (PRESETS[v]) return v;
      return "random";
    } catch {
      return "random";
    }
  }

  function resolvePreset(id) {
    if (id && PRESETS[id]) return PRESETS[id];
    const saved = getSavedPresetId();
    if (saved !== "random" && PRESETS[saved]) return PRESETS[saved];
    return PRESETS[pickWeightedPresetId()] || PRESETS.g5;
  }

  function weightTotal() {
    return PRESET_ORDER.reduce((s, id) => s + (PRESET_WEIGHTS[id] || 0), 0);
  }

  function weightChance(id) {
    const w = PRESET_WEIGHTS[id] || 0;
    const t = weightTotal() || 1;
    return Math.round((w / t) * 1000) / 10;
  }

  /** Случайный глитч по весам 100/90/…/10 */
  function pickWeightedPresetId() {
    const total = weightTotal();
    let r = Math.random() * total;
    for (const id of PRESET_ORDER) {
      r -= PRESET_WEIGHTS[id] || 0;
      if (r <= 0) return id;
    }
    return PRESET_ORDER[0];
  }

  /** Всегда случайный уровень по весам 100→10 (выбор пользователем не нужен). */
  function pickPresetForNav(forcedId) {
    if (forcedId && PRESETS[forcedId]) return forcedId;
    return pickWeightedPresetId();
  }

  function randRange(a, b) {
    return a + Math.random() * (b - a);
  }

  function randomClip(mode) {
    if (mode === "block") {
      const t = Math.random() * 55;
      const b = Math.random() * (90 - t);
      const l = Math.random() * 40;
      const r = Math.random() * (90 - l);
      return `inset(${t.toFixed(1)}% ${r.toFixed(1)}% ${b.toFixed(1)}% ${l.toFixed(1)}%)`;
    }
    if (mode === "wave") {
      const bands = 3 + ((Math.random() * 4) | 0);
      const pts = ["0% 0%"];
      for (let i = 0; i <= bands; i++) {
        const y = (i / bands) * 100;
        const x = 5 + Math.random() * 90;
        pts.push(`${x.toFixed(1)}% ${y.toFixed(1)}%`);
      }
      pts.push("100% 100%", "0% 100%");
      return `polygon(${pts.join(",")})`;
    }
    const top = Math.random() * 70;
    const h = 6 + Math.random() * 28;
    const bottom = Math.max(0, 100 - top - h);
    const l = Math.random() * 25;
    const r = Math.random() * 25;
    return `inset(${top.toFixed(1)}% ${r.toFixed(1)}% ${bottom.toFixed(1)}% ${l.toFixed(1)}%)`;
  }

  function buildClone() {
    const wrap = document.createElement("div");
    wrap.className = "home-glitch-clone";
    for (const child of [...document.body.children]) {
      if (child.classList?.contains("home-glitch-portal")) continue;
      if (child.tagName === "SCRIPT") continue;
      wrap.appendChild(child.cloneNode(true));
    }
    wrap.querySelectorAll("a,button,input,iframe").forEach((el) => {
      el.removeAttribute("href");
      el.tabIndex = -1;
      if ("disabled" in el) el.disabled = true;
      if (el.tagName === "IFRAME") el.src = "about:blank";
    });
    return wrap;
  }

  function wakeDest(dest) {
    try {
      dest.contentWindow?.postMessage({ type: "futurum-portal-live" }, location.origin);
    } catch {
      /* ignore */
    }
  }

  /**
   * Новый iframe сразу в body. Не переносим превью из куба —
   * любой move iframe в DOM перезагружает страницу и даёт «зависание».
   * Превью куба всё равно греет HTTP-кэш.
   */
  function makeDestFrame(src) {
    const dest = document.createElement("iframe");
    dest.className = "home-glitch-dest is-alive";
    dest.title = "Куда идём";
    dest.tabIndex = -1;
    dest.setAttribute("scrolling", "no");
    dest.src = src || "";
    return dest;
  }

  function isDestPageReady(dest) {
    try {
      if (dest.dataset.pageReady === "1") return true;
      const doc = dest.contentDocument;
      if (!doc) return false;
      return doc.documentElement?.dataset?.futurumReady === "1";
    } catch {
      return false;
    }
  }

  /** Ждём ready-сигнал каталога, но не дольше ~1.2с — иначе кажется зависанием. */
  function waitForPageReady(dest, { timeout = 1200 } = {}) {
    return new Promise((resolve) => {
      if (isDestPageReady(dest)) {
        resolve(true);
        return;
      }

      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        window.clearInterval(poll);
        window.removeEventListener("message", onMsg);
        if (ok) dest.dataset.pageReady = "1";
        resolve(ok);
      };

      const onMsg = (e) => {
        if (e.origin !== location.origin) return;
        if (e.data?.type !== "futurum-page-ready") return;
        if (e.source && e.source !== dest.contentWindow) return;
        finish(true);
      };

      window.addEventListener("message", onMsg);
      const poll = window.setInterval(() => {
        if (isDestPageReady(dest)) finish(true);
        else {
          try {
            dest.contentWindow?.postMessage({ type: "futurum-ask-ready" }, location.origin);
          } catch {
            /* ignore */
          }
        }
      }, 60);
      const timer = window.setTimeout(() => finish(isDestPageReady(dest)), timeout);
    });
  }

  /**
   * iframe уже в body — не трогаем его место в DOM (иначе reload).
   * Убираем только оверлеи и оболочку хаба.
   */
  function promoteLiveDest(dest, href) {
    try {
      const idoc = dest.contentDocument;
      const iwin = dest.contentWindow;
      if (!idoc || !iwin) return false;

      try {
        iwin.postMessage({ type: "futurum-portal-promote" }, location.origin);
      } catch {
        /* ignore */
      }

      history.replaceState(null, "", href);
      try {
        document.title = idoc.title || document.title;
      } catch {
        /* ignore */
      }

      document.documentElement.classList.add("is-portal-promoted");
      document.body.className = "is-portal-promoted";
      document.body.style.cssText = "margin:0;padding:0;overflow:hidden;background:#05070a;";

      for (const child of [...document.body.children]) {
        if (child !== dest) child.remove();
      }

      dest.className = "home-glitch-promoted";
      dest.removeAttribute("aria-hidden");
      dest.removeAttribute("scrolling");
      dest.setAttribute("scrolling", "yes");
      dest.style.cssText =
        "position:fixed;inset:0;width:100%;height:100%;border:0;display:block;background:#05070a;pointer-events:auto;";
      dest.tabIndex = 0;

      const syncUrl = () => {
        try {
          history.replaceState(null, "", dest.contentWindow.location.href);
          document.title = dest.contentDocument.title || document.title;
        } catch {
          /* ignore */
        }
      };
      dest.addEventListener("load", syncUrl);

      return true;
    } catch {
      return false;
    }
  }

  function openGlitchNav({
    href,
    src,
    duration,
    liveFrame = null,
    preset = null,
    preview = false,
    onDone = null,
  } = {}) {
    if (!href && !preview) return false;
    if (REDUCE && !preview) {
      if (href) window.location.href = href;
      return true;
    }

    const presetId = pickPresetForNav(preset);
    const cfg = PRESETS[presetId] || PRESETS.medium;
    const my = ++gen;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const modes = cfg.modes?.length ? cfg.modes : ["tear", "block", "wave", "scatter"];
    const mode = modes[(Math.random() * modes.length) | 0];
    const chaos = cfg.chaos;
    const hueBias = Math.random() > 0.5 ? 1 : -1;
    const beatMs = randRange(cfg.beatMs[0], cfg.beatMs[1]);
    const glitchEnd = cfg.glitchEnd;
    const hitCount =
      cfg.hitMin + ((Math.random() * (cfg.hitMax - cfg.hitMin + 1)) | 0);
    duration = duration || cfg.duration;
    const targetSrc = src || href || "./shop.html";

    const root = document.createElement("div");
    root.className = "home-glitch-portal";
    root.setAttribute("aria-hidden", "true");

    // iframe сразу в body и больше не двигаем (move = reload + зависание)
    void liveFrame;
    const dest = makeDestFrame(targetSrc);

    const matte = document.createElement("div");
    matte.className = "home-glitch-matte";

    const veil = document.createElement("div");
    veil.className = "home-glitch-veil";

    const shot = document.createElement("div");
    shot.className = "home-glitch-shot";
    shot.appendChild(buildClone());

    const cyan = document.createElement("div");
    cyan.className = "home-glitch-ghost home-glitch-cyan";
    cyan.appendChild(buildClone());

    const mag = document.createElement("div");
    mag.className = "home-glitch-ghost home-glitch-magenta";
    mag.appendChild(buildClone());

    const canvas = document.createElement("canvas");
    canvas.className = "home-glitch-canvas";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scan = document.createElement("div");
    scan.className = "home-glitch-scan";

    const flash = document.createElement("div");
    flash.className = "home-glitch-flash";

    veil.appendChild(shot);
    veil.appendChild(cyan);
    veil.appendChild(mag);
    veil.appendChild(canvas);
    veil.appendChild(scan);

    root.appendChild(matte);
    // dest — сосед портала, не ребёнок: promote не будет его переносить
    document.body.appendChild(dest);
    document.body.appendChild(root);
    document.body.classList.add("is-home-glitch");

    dest.classList.add("is-ready", "is-show", "is-alive");
    dest.style.transform = "scale(1)";
    dest.style.filter = "none";
    wakeDest(dest);

    const wakePulse = window.setInterval(() => {
      if (my !== gen) {
        window.clearInterval(wakePulse);
        return;
      }
      wakeDest(dest);
    }, 220);

    waitForPageReady(dest, { timeout: preview ? 1000 : 1200 }).then(() => {
      if (my !== gen) return;

      // два кадра стабилизации — каталог уже на экране под матом
      return new Promise((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
    }).then(() => {
      if (my !== gen) return;

      window.clearInterval(wakePulse);
      wakeDest(dest);

      // глитч-слой поверх уже готовой страницы
      root.appendChild(veil);
      root.appendChild(flash);

      dest.style.transform = "scale(1.02)";
      dest.style.filter = "brightness(0.92) saturate(1.06)";

      const beats = [];
      for (let i = 0; i < hitCount; i++) {
        const p = ((i + 0.08 + Math.random() * 0.7) / (hitCount + 0.2)) * glitchEnd;
        const clipMode = mode === "scatter" ? (Math.random() > 0.5 ? "tear" : "block") : mode;
        beats.push({
          at: p * duration,
          dx: (Math.random() - 0.5) * cfg.displace,
          dy: (Math.random() - 0.5) * cfg.dy,
          skew: (Math.random() - 0.5) * cfg.skew,
          scaleX: 1 + (Math.random() - 0.5) * cfg.scaleJitter,
          hue: hueBias * (12 + Math.random() * cfg.hue),
          sat: 1 + Math.random() * cfg.sat,
          contrast: 1 + Math.random() * cfg.contrast,
          invert: Math.random() < cfg.invertChance ? 0.08 + Math.random() * 0.22 : 0,
          clip: randomClip(clipMode),
          cdx: (Math.random() - 0.5) * cfg.ghostMove,
          cdy: (Math.random() - 0.5) * (cfg.ghostMove * 0.5),
          mdx: (Math.random() - 0.5) * cfg.ghostMove,
          mdy: (Math.random() - 0.5) * (cfg.ghostMove * 0.5),
          ghostOp: cfg.ghost * (0.55 + Math.random() * 0.7),
        });
      }
      beats.sort((a, b) => a.at - b.at);

      let bars = [];
      function spawnBars(intensity) {
        const n = Math.max(2, ((4 + Math.random() * 14 * intensity * cfg.bars) | 0));
        bars = Array.from({ length: n }, () => ({
          x: Math.random() * W,
          y: Math.random() * H,
          w: 14 + Math.random() * (50 + 110 * chaos * cfg.bars),
          h: 1 + Math.random() * (2 + 7 * chaos),
          vx: (Math.random() - 0.5) * 420 * chaos,
          life: 0.08 + Math.random() * 0.3,
          hue: Math.random() > 0.5 ? 170 + Math.random() * 40 : 300 + Math.random() * 40,
        }));
      }
      spawnBars(cfg.bars);

      let beatIdx = 0;
      let cur = { dx: 0, dy: 0, skew: 0, scaleX: 1, ghostOp: 0, clip: "inset(0)" };
      let lastBeatAt = -1;
      let finishing = false;
      const t0 = performance.now();

      // мат уходит только сейчас — под ним уже полный сайт
      matte.classList.add("is-clear");

      function applyHit(hit) {
        cur = hit;
        shot.style.transform = `translate(${hit.dx}px, ${hit.dy}px) skewX(${hit.skew}deg) scaleX(${hit.scaleX})`;
        shot.style.filter = `hue-rotate(${hit.hue}deg) saturate(${hit.sat}) contrast(${hit.contrast}) invert(${hit.invert})`;
        shot.style.clipPath = hit.clip;
        cyan.style.opacity = String(hit.ghostOp);
        cyan.style.transform = `translate(${hit.cdx}px, ${hit.cdy}px)`;
        cyan.style.clipPath = hit.clip;
        mag.style.opacity = String(hit.ghostOp * 0.9);
        mag.style.transform = `translate(${hit.mdx}px, ${hit.mdy}px)`;
        mag.style.clipPath = hit.clip;
        spawnBars(0.55 + chaos * cfg.bars);
        if (cfg.flash) {
          flash.classList.remove("is-on");
          void flash.offsetWidth;
          flash.classList.add("is-on");
        }
      }

      function cleanupPreview() {
        root.remove();
        dest.remove();
        document.body.classList.remove("is-home-glitch");
        try {
          onDone?.();
        } catch {
          /* ignore */
        }
      }

      function finish() {
        if (finishing || my !== gen) return;
        finishing = true;
        window.clearInterval(wakePulse);

        scan.style.animation = "none";
        scan.style.opacity = "0";
        if (ctx) ctx.clearRect(0, 0, W, H);
        canvas.style.opacity = "0";
        cyan.style.opacity = "0";
        mag.style.opacity = "0";
        shot.style.opacity = "0";
        shot.style.filter = "none";
        shot.style.transform = "none";
        shot.style.clipPath = "inset(0)";
        flash.classList.remove("is-on");

        dest.classList.add("is-ready", "is-show", "is-settle", "is-alive");
        dest.style.transform = "scale(1)";
        dest.style.filter = "none";
        veil.classList.add("is-out");
        matte.classList.add("is-out", "is-clear");
        wakeDest(dest);

        window.setTimeout(() => {
          if (my !== gen) return;
          if (preview) {
            cleanupPreview();
            return;
          }
          if (href && promoteLiveDest(dest, href)) return;
          try {
            sessionStorage.setItem(LIVE_FLAG, "1");
          } catch {
            /* ignore */
          }
          if (href) window.location.replace(href);
        }, preview ? 220 : 80);
      }

      function frame(now) {
        if (my !== gen || finishing) return;
        const elapsed = now - t0;
        const t = Math.min(1, elapsed / duration);
        const inGlitch = t < glitchEnd;

        dest.classList.add("is-ready", "is-show", "is-alive");
        if (inGlitch) {
          const arrive = Math.min(1, Math.max(0, t / Math.max(0.2, glitchEnd * 0.55)));
          const ease = 1 - Math.pow(1 - arrive, 2.2);
          dest.style.transform = `scale(${(1.02 - ease * 0.02).toFixed(4)})`;
          dest.style.filter = `brightness(${(0.92 + ease * 0.08).toFixed(3)}) saturate(${(
            1.06 -
            ease * 0.06
          ).toFixed(3)})`;
        }

        while (beatIdx < beats.length && beats[beatIdx].at <= elapsed) {
          applyHit(beats[beatIdx]);
          lastBeatAt = elapsed;
          beatIdx += 1;
        }

        if (inGlitch) {
          const reveal = Math.min(1, t / glitchEnd);
          const baseOp = 1 - reveal * 0.55;
          if (elapsed - lastBeatAt > beatMs * 0.35) {
            const jx = (Math.random() - 0.5) * 5 * chaos;
            const jy = (Math.random() - 0.5) * 2.5 * chaos;
            shot.style.transform = `translate(${cur.dx + jx}px, ${cur.dy + jy}px) skewX(${cur.skew}deg) scaleX(${cur.scaleX})`;
            if (Math.random() > 0.68) {
              const clipMode = mode === "scatter" ? "tear" : mode;
              const clip = randomClip(clipMode);
              shot.style.clipPath = clip;
              cyan.style.clipPath = clip;
              mag.style.clipPath = clip;
            }
          }
          const minOp = Math.max(0.18, 1 - cfg.revealFade);
          shot.style.opacity = String(Math.max(minOp, baseOp));
          cyan.style.opacity = String((cur.ghostOp || 0) * Math.max(0.15, baseOp));
          mag.style.opacity = String((cur.ghostOp || 0) * 0.85 * Math.max(0.15, baseOp));
          scan.style.opacity = String(cfg.scan * (0.45 + (1 - reveal) * 0.7));
        } else {
          const u = Math.min(1, (t - glitchEnd) / (1 - glitchEnd));
          const ease = 1 - Math.pow(1 - u, 2.6);
          const fade = 1 - ease;
          shot.style.opacity = String(fade * 0.35);
          shot.style.filter = `brightness(${1 + ease * 0.25})`;
          shot.style.transform = `scale(${1 + ease * 0.03})`;
          shot.style.clipPath = "inset(0)";
          cyan.style.opacity = "0";
          mag.style.opacity = "0";
          scan.style.opacity = String(0.12 * fade);
          veil.style.opacity = String(fade);
          dest.style.transform = "scale(1)";
          dest.style.filter = "none";
          dest.classList.add("is-settle");
        }

        if (ctx) {
          ctx.clearRect(0, 0, W, H);
          if (inGlitch) {
            const scanOp =
              (0.04 + Math.sin(elapsed * 0.02) * 0.03) * chaos * cfg.scan * (1 - t * 0.45);
            ctx.fillStyle = `rgba(0, 255, 220, ${scanOp})`;
            for (let y = (elapsed * 0.15) % 4; y < H; y += 4) {
              ctx.fillRect(0, y, W, 1);
            }
            const dt = 1 / 60;
            for (const b of bars) {
              b.x += b.vx * dt;
              b.life -= dt * 1.25;
              if (b.life <= 0) continue;
              const a = Math.max(0, b.life);
              ctx.fillStyle = `hsla(${b.hue}, 100%, 65%, ${a * 0.7})`;
              ctx.fillRect(b.x, b.y, b.w, b.h);
              ctx.fillStyle = `hsla(${(b.hue + 120) % 360}, 100%, 60%, ${a * 0.3})`;
              ctx.fillRect(b.x + 4, b.y + 1, b.w * 0.7, b.h);
            }
            if (Math.random() > 0.88) {
              const x = Math.random() * W;
              const w = 2 + Math.random() * 16;
              ctx.fillStyle = "rgba(255, 0, 180, 0.12)";
              ctx.fillRect(x, 0, w, H);
            }
          }
        }

        if (t < 1) requestAnimationFrame(frame);
        else finish();
      }

      requestAnimationFrame(frame);
      window.setTimeout(() => {
        if (my === gen) finish();
      }, duration + 400);
    });

    return true;
  }

  window.FuturumGlitch = {
    openGlitchNav,
    PRESETS,
    PRESET_ORDER,
    PRESET_WEIGHTS,
    PRESET_KEY,
    getSavedPresetId,
    resolvePreset,
    pickWeightedPresetId,
    pickPresetForNav,
    weightChance,
    weightTotal,
    setPreset(id) {
      if (id !== "random" && !PRESETS[id]) return false;
      try {
        localStorage.setItem(PRESET_KEY, id || "random");
      } catch {
        /* ignore */
      }
      return true;
    },
  };
})();

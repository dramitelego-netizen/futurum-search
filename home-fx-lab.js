const EFFECTS = [
  {
    id: "burn",
    name: "1 · Сгорание листа",
    hint: "Как бумага: край огня идёт слева направо или со случайного края — за пеплом магазин.",
  },
  {
    id: "melt",
    name: "2 · Плавление",
    hint: "Слой стекает вниз, как растаял; снизу проступает новая страница.",
  },
  {
    id: "curtain",
    name: "3 · Шторы",
    hint: "Экран расходится влево и вправо — за ним живой сайт.",
  },
  {
    id: "ink",
    name: "4 · Чернильная дыра",
    hint: "Тёмное пятно съедает старый слой из точки клика.",
  },
  {
    id: "blinds",
    name: "5 · Жалюзи",
    hint: "Горизонтальные полосы схлопываются одна за другой.",
  },
  {
    id: "smoke",
    name: "6 · Дым",
    hint: "Страница размывается и растворяется дымом.",
  },
  {
    id: "shatter",
    name: "7 · Осколки",
    hint: "Слой бьётся на куски и разлетается.",
  },
  {
    id: "glitch",
    name: "8 · Глитч",
    hint: "Живой цифровой сбой: каждый раз новый паттерн разрезов и RGB-сдвигов.",
  },
  {
    id: "zoom",
    name: "9 · Zoom-dissolve",
    hint: "Старое улетает крупным планом и растворяется.",
  },
  {
    id: "peel",
    name: "10 · Сдирание",
    hint: "Лист страницы отгибается как бумага — под ним новая.",
  },
];

const body = document.body;
const list = document.getElementById("fxList");
const hint = document.getElementById("fxHint");
const title = document.getElementById("fxTitle");
const tile = document.getElementById("tile");
const portal = document.getElementById("portal");
const dest = document.getElementById("dest");
const veil = document.getElementById("veil");
const shot = document.getElementById("shot");
const fxLayer = document.getElementById("fxLayer");
const canvas = document.getElementById("fxCanvas");
const replayBtn = document.getElementById("replayBtn");

let current = "burn";
let busy = false;
let lastClick = { x: 0.5, y: 0.55 };
let particleGen = 0;

function setFx(id) {
  current = id;
  body.dataset.fx = id;
  const meta = EFFECTS.find((e) => e.id === id) || EFFECTS[0];
  if (title) title.textContent = meta.name;
  if (hint) hint.textContent = meta.hint;
  list?.querySelectorAll(".fxlab-fx").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.fx === id);
  });
  try {
    localStorage.setItem("futurum_fxlab_pick", id);
  } catch {
    /* ignore */
  }
}

function warmDest() {
  if (!dest || dest.dataset.ready === "1") return;
  dest.src = "./shop.html";
  dest.dataset.ready = "1";
}

function clearFxLayer() {
  if (fxLayer) {
    fxLayer.innerHTML = "";
    fxLayer.className = "fxlab-layer";
  }
  if (shot) {
    shot.innerHTML = "";
    shot.className = "fxlab-shot";
    shot.style.cssText = "";
  }
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/** Клон текущего экрана (без портала) — это и есть «первая страница» */
function buildPageClone() {
  const wrap = document.createElement("div");
  wrap.className = "fxlab-clone";
  for (const child of [...body.children]) {
    if (child.id === "portal") continue;
    if (child.tagName === "SCRIPT") continue;
    wrap.appendChild(child.cloneNode(true));
  }
  // убрать интерактив у клона
  wrap.querySelectorAll("a,button,input").forEach((el) => {
    el.removeAttribute("href");
    el.tabIndex = -1;
    el.disabled = true;
  });
  return wrap;
}

function placeCloneIn(el) {
  el.innerHTML = "";
  const clone = buildPageClone();
  el.appendChild(clone);
  return clone;
}

function prepareFxDom() {
  if (!veil || !shot || !fxLayer) return;
  clearFxLayer();
  veil.style.setProperty("--ox", `${lastClick.x * 100}%`);
  veil.style.setProperty("--oy", `${lastClick.y * 100}%`);

  if (current === "curtain") {
    shot.style.opacity = "0";
    const left = document.createElement("div");
    const right = document.createElement("div");
    left.className = "pane left";
    right.className = "pane right";
    left.appendChild(buildPageClone());
    right.appendChild(buildPageClone());
    // каждая половина показывает свою сторону
    left.querySelector(".fxlab-clone").style.clipPath = "inset(0 50% 0 0)";
    right.querySelector(".fxlab-clone").style.clipPath = "inset(0 0 0 50%)";
    right.querySelector(".fxlab-clone").style.marginLeft = "-100%";
    right.querySelector(".fxlab-clone").style.width = "200%";
    left.querySelector(".fxlab-clone").style.width = "200%";
    fxLayer.appendChild(left);
    fxLayer.appendChild(right);
    return;
  }

  if (current === "blinds") {
    shot.style.opacity = "0";
    const n = 14;
    for (let i = 0; i < n; i++) {
      const blind = document.createElement("div");
      blind.className = "blind";
      // волна от центра
      const mid = (n - 1) / 2;
      blind.style.setProperty("--d", `${Math.abs(i - mid) * 0.04}s`);
      const clone = buildPageClone();
      clone.style.top = `${(-i * 100) / n}vh`;
      blind.appendChild(clone);
      fxLayer.appendChild(blind);
    }
    return;
  }

  if (current === "shatter") {
    shot.style.opacity = "0";
    const cols = 6;
    const rows = 6;
    const cx = lastClick.x * (cols - 1);
    const cy = lastClick.y * (rows - 1);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const shard = document.createElement("div");
        shard.className = "shard";
        const dist = Math.hypot(x - cx, y - cy);
        shard.style.setProperty("--d", `${dist * 0.028}s`);
        const ang = Math.atan2(y - cy, x - cx) || Math.random() * Math.PI * 2;
        const power = 80 + dist * 55 + Math.random() * 90;
        shard.style.setProperty("--tx", `${Math.cos(ang) * power}px`);
        shard.style.setProperty("--ty", `${Math.sin(ang) * power + 40}px`);
        shard.style.setProperty("--rot", `${(Math.random() - 0.5) * 120}deg`);
        const clone = buildPageClone();
        clone.style.left = `${(-x * 100) / cols}vw`;
        clone.style.top = `${(-y * 100) / rows}vh`;
        shard.appendChild(clone);
        fxLayer.appendChild(shard);
      }
    }
    return;
  }

  if (current === "glitch") {
    shot.style.opacity = "1";
    placeCloneIn(shot);
    // RGB-призраки — каждый прогон со своими сдвигами
    const cyan = document.createElement("div");
    cyan.className = "glitch-ghost glitch-cyan";
    cyan.appendChild(buildPageClone());
    const mag = document.createElement("div");
    mag.className = "glitch-ghost glitch-magenta";
    mag.appendChild(buildPageClone());
    fxLayer.appendChild(cyan);
    fxLayer.appendChild(mag);
    return;
  }

  // остальные эффекты — один клон в shot
  shot.style.opacity = "1";
  placeCloneIn(shot);
}

function prepCanvas() {
  if (!canvas) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Откуда горит лист: чаще слева→направо, иначе случайный край */
function pickBurnDir() {
  const roll = Math.random();
  if (roll < 0.42) return "ltr";
  if (roll < 0.62) return "rtl";
  if (roll < 0.78) return "ttb";
  if (roll < 0.92) return "btt";
  // угол: от случайного угла листа
  const corners = ["tl", "tr", "bl", "br"];
  return corners[(Math.random() * corners.length) | 0];
}

function burnDirLabel(dir) {
  return (
    {
      ltr: "слева → направо",
      rtl: "справа → налево",
      ttb: "сверху → вниз",
      btt: "снизу → вверх",
      tl: "из угла",
      tr: "из угла",
      bl: "из угла",
      br: "из угла",
    }[dir] || "случайно"
  );
}

/**
 * Сгорание листа бумаги — качественный край огня, уголь, искры, пепел, дым.
 */
function runPaperBurn(duration) {
  const ctx = prepCanvas();
  if (!ctx || !shot) return;
  const gen = ++particleGen;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dir = pickBurnDir();
  body.dataset.burnDir = dir;
  if (hint && current === "burn") {
    hint.textContent = `Лист горит ${burnDirLabel(dir)} — живой край огня и пепел.`;
  }

  const N = 96;
  const seeds = Array.from({ length: N + 2 }, () => Math.random());
  const seeds2 = Array.from({ length: N + 2 }, () => Math.random());
  const embers = [];
  const ashes = [];
  const smokes = [];

  const ease = (t) => 1 - Math.pow(1 - t, 2.6);

  function frontPos(progress, i, time) {
    const u = i / N;
    const jag =
      (seeds[i] - 0.5) * 0.07 +
      (seeds2[i] - 0.5) * 0.035 +
      Math.sin(u * 14 + time * 3.2) * 0.022 +
      Math.sin(u * 37 - time * 5.1) * 0.012 +
      Math.sin(u * 71 + progress * 9) * 0.007;
    return Math.max(-0.02, Math.min(1.08, progress + jag));
  }

  function remainingClip(progress, time) {
    const pts = [];
    if (dir === "ltr") {
      for (let i = 0; i <= N; i++) {
        pts.push(
          `${(frontPos(progress, i, time) * 100).toFixed(3)}% ${((i / N) * 100).toFixed(3)}%`
        );
      }
      pts.push("100% 100%", "100% 0%");
    } else if (dir === "rtl") {
      pts.push("0% 0%", "0% 100%");
      for (let i = N; i >= 0; i--) {
        pts.push(
          `${((1 - frontPos(progress, i, time)) * 100).toFixed(3)}% ${((i / N) * 100).toFixed(3)}%`
        );
      }
    } else if (dir === "ttb") {
      for (let i = 0; i <= N; i++) {
        pts.push(
          `${((i / N) * 100).toFixed(3)}% ${(frontPos(progress, i, time) * 100).toFixed(3)}%`
        );
      }
      pts.push("100% 100%", "0% 100%");
    } else if (dir === "btt") {
      pts.push("0% 0%", "100% 0%");
      for (let i = N; i >= 0; i--) {
        pts.push(
          `${((i / N) * 100).toFixed(3)}% ${((1 - frontPos(progress, i, time)) * 100).toFixed(3)}%`
        );
      }
    } else {
      return cornerRemainingClip(progress, dir, seeds);
    }
    return `polygon(${pts.join(",")})`;
  }

  function cornerArc(progress, corner, seedsArr) {
    const steps = 64;
    const r = progress * 1.58;
    const arc = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * (Math.PI / 2);
      const jag =
        1 +
        (seedsArr[i % seedsArr.length] - 0.5) * 0.16 +
        Math.sin(t * 22 + progress * 8) * 0.03;
      const rr = r * jag;
      let x;
      let y;
      if (corner === "tl") {
        x = Math.cos(a) * rr;
        y = Math.sin(a) * rr;
      } else if (corner === "tr") {
        x = 1 - Math.sin(a) * rr;
        y = Math.cos(a) * rr;
      } else if (corner === "br") {
        x = 1 - Math.cos(a) * rr;
        y = 1 - Math.sin(a) * rr;
      } else {
        x = Math.sin(a) * rr;
        y = 1 - Math.cos(a) * rr;
      }
      arc.push([x, y]);
    }
    return arc;
  }

  function cornerRemainingClip(progress, corner, seedsArr) {
    const arc = cornerArc(progress, corner, seedsArr);
    const fmt = ([x, y]) =>
      `${(x * 100).toFixed(3)}% ${(y * 100).toFixed(3)}%`;
    const outer = [];
    for (let i = arc.length - 1; i >= 0; i--) outer.push(fmt(arc[i]));
    if (corner === "tl") outer.push("0% 100%", "100% 100%", "100% 0%");
    else if (corner === "tr") outer.push("100% 100%", "0% 100%", "0% 0%");
    else if (corner === "br") outer.push("100% 0%", "0% 0%", "0% 100%");
    else outer.push("0% 0%", "100% 0%", "100% 100%");
    return `polygon(${outer.join(",")})`;
  }

  function edgeSamples(progress, time) {
    if (dir === "tl" || dir === "tr" || dir === "bl" || dir === "br") {
      return cornerArc(progress, dir, seeds).map(([x, y]) => ({
        x: x * W,
        y: y * H,
      }));
    }
    const samples = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      if (dir === "ltr") samples.push({ x: frontPos(progress, i, time) * W, y: t * H });
      else if (dir === "rtl")
        samples.push({ x: (1 - frontPos(progress, i, time)) * W, y: t * H });
      else if (dir === "ttb")
        samples.push({ x: t * W, y: frontPos(progress, i, time) * H });
      else samples.push({ x: t * W, y: (1 - frontPos(progress, i, time)) * H });
    }
    return samples;
  }

  /** нормаль «в сторону огня» (в уже сгоревшую зону) */
  function burnNormal() {
    if (dir === "ltr") return { x: -1, y: 0 };
    if (dir === "rtl") return { x: 1, y: 0 };
    if (dir === "ttb") return { x: 0, y: -1 };
    if (dir === "btt") return { x: 0, y: 1 };
    if (dir === "tl") return { x: -0.7, y: -0.7 };
    if (dir === "tr") return { x: 0.7, y: -0.7 };
    if (dir === "br") return { x: 0.7, y: 0.7 };
    return { x: -0.7, y: 0.7 };
  }

  function strokeEdge(edge, width, color, blur, blurColor) {
    ctx.beginPath();
    edge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = blurColor || "transparent";
    ctx.shadowBlur = blur || 0;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function offsetEdge(edge, nx, ny, dist) {
    return edge.map((p) => ({ x: p.x + nx * dist, y: p.y + ny * dist }));
  }

  const t0 = performance.now();
  function frame(now) {
    if (gen !== particleGen) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    const raw = Math.min(1, (now - t0) / duration);
    const progress = ease(raw);
    const time = (now - t0) / 1000;
    shot.style.clipPath = remainingClip(progress, time);

    const heat = Math.min(1, progress * 1.25);
    const curl =
      dir === "ltr" || dir === "rtl"
        ? `perspective(1200px) rotateY(${(dir === "ltr" ? -1 : 1) * heat * 2.5}deg)`
        : `perspective(1200px) rotateX(${(dir === "ttb" || dir === "tl" || dir === "tr" ? 1 : -1) * heat * 2}deg)`;
    shot.style.transform = curl;
    shot.style.filter = [
      `sepia(${0.2 + heat * 0.65})`,
      `brightness(${1.05 + heat * 0.7})`,
      `contrast(${1.05 + heat * 0.35})`,
      `saturate(${1.15 + heat * 0.55})`,
      `hue-rotate(${-heat * 12}deg)`,
    ].join(" ");
    shot.style.opacity = String(1 - Math.pow(raw, 2.8) * 0.2);

    ctx.clearRect(0, 0, W, H);
    const edge = edgeSamples(progress, time);
    if (edge.length < 2) {
      if (raw < 1) requestAnimationFrame(frame);
      return;
    }

    const n = burnNormal();
    const fade = 1 - raw * 0.35;

    // —— угольная корка (в сторону пепла) ——
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    strokeEdge(
      offsetEdge(edge, n.x, n.y, 10),
      22,
      `rgba(12, 4, 0, ${0.55 * fade})`,
      8,
      "rgba(0,0,0,0.4)"
    );
    strokeEdge(
      offsetEdge(edge, n.x, n.y, 5),
      14,
      `rgba(28, 10, 2, ${0.7 * fade})`,
      0
    );

    // —— мягкое теплое свечение ——
    ctx.globalCompositeOperation = "lighter";
    edge.forEach((p, i) => {
      if (i % 2) return;
      const flick = 0.85 + Math.sin(time * 14 + i * 0.4) * 0.15;
      const rad = 36 + Math.sin(time * 9 + i) * 8;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, `rgba(255, 200, 90, ${0.28 * fade * flick})`);
      g.addColorStop(0.35, `rgba(255, 110, 30, ${0.16 * fade})`);
      g.addColorStop(1, "rgba(255, 40, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    });

    // —— слои пламени ——
    ctx.globalCompositeOperation = "lighter";
    strokeEdge(
      edge,
      28,
      `rgba(255, 140, 40, ${0.22 * fade})`,
      28,
      "rgba(255, 100, 20, 0.55)"
    );
    strokeEdge(
      edge,
      14,
      `rgba(255, 190, 80, ${0.45 * fade})`,
      16,
      "rgba(255, 150, 40, 0.7)"
    );
    strokeEdge(
      edge,
      6,
      `rgba(255, 240, 180, ${0.75 * fade})`,
      8,
      "rgba(255, 220, 120, 0.9)"
    );
    strokeEdge(edge, 2.2, `rgba(255, 255, 245, ${0.9 * fade})`, 0);

    // тонкая чёрная линия на самой кромке бумаги
    ctx.globalCompositeOperation = "source-over";
    strokeEdge(
      offsetEdge(edge, -n.x * 0.5, -n.y * 0.5, 1.5),
      2.5,
      `rgba(20, 8, 0, ${0.65 * fade})`,
      0
    );
    ctx.restore();

    // —— спавн частиц ——
    if (raw < 0.94) {
      const spawn = 3 + ((Math.random() * 4) | 0);
      for (let s = 0; s < spawn; s++) {
        const p = edge[(Math.random() * edge.length) | 0];
        if (!p) continue;
        // искры
        if (Math.random() > 0.35) {
          embers.push({
            x: p.x + (Math.random() - 0.5) * 6,
            y: p.y + (Math.random() - 0.5) * 6,
            vx: n.x * (10 + Math.random() * 40) + (Math.random() - 0.5) * 50,
            vy: n.y * (10 + Math.random() * 30) - 50 - Math.random() * 120,
            r: 0.8 + Math.random() * 2.6,
            life: 0.45 + Math.random() * 0.55,
            hue: 12 + Math.random() * 28,
            type: "spark",
          });
        }
        // пепел
        if (Math.random() > 0.55) {
          ashes.push({
            x: p.x + n.x * (4 + Math.random() * 16),
            y: p.y + n.y * (4 + Math.random() * 16),
            vx: (Math.random() - 0.5) * 25 + n.x * 15,
            vy: -15 - Math.random() * 40,
            r: 1.2 + Math.random() * 3.5,
            life: 0.6 + Math.random() * 0.7,
            rot: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 4,
            type: "ash",
          });
        }
        // дым
        if (Math.random() > 0.7) {
          smokes.push({
            x: p.x,
            y: p.y,
            vx: (Math.random() - 0.5) * 18,
            vy: -20 - Math.random() * 35,
            r: 10 + Math.random() * 22,
            life: 0.5 + Math.random() * 0.6,
            type: "smoke",
          });
        }
      }
    }

    const dt = 1 / 60;

    // дым (под искрами)
    ctx.save();
    for (let i = smokes.length - 1; i >= 0; i--) {
      const e = smokes[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.r += 28 * dt;
      e.life -= dt * 0.4;
      if (e.life <= 0) {
        smokes.splice(i, 1);
        continue;
      }
      const a = Math.max(0, e.life) * 0.14;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
      g.addColorStop(0, `rgba(180, 170, 160, ${a})`);
      g.addColorStop(1, "rgba(80, 70, 60, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // пепел
    for (let i = ashes.length - 1; i >= 0; i--) {
      const e = ashes[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 25 * dt;
      e.rot += e.spin * dt;
      e.life -= dt * 0.45;
      if (e.life <= 0) {
        ashes.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.fillStyle = `rgba(${40 + Math.random() * 30}, ${28}, ${18}, ${e.life * 0.7})`;
      ctx.fillRect(-e.r, -e.r * 0.4, e.r * 2, e.r * 0.8);
      ctx.restore();
    }

    // искры
    ctx.globalCompositeOperation = "lighter";
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vy += 55 * dt;
      e.life -= dt * 0.5;
      if (e.life <= 0) {
        embers.splice(i, 1);
        continue;
      }
      const a = Math.max(0, e.life);
      ctx.beginPath();
      ctx.fillStyle = `hsla(${e.hue}, 100%, ${65 + a * 20}%, ${a})`;
      ctx.arc(e.x, e.y, e.r * (0.6 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
      // хвост
      ctx.strokeStyle = `hsla(${e.hue}, 100%, 70%, ${a * 0.45})`;
      ctx.lineWidth = Math.max(0.5, e.r * 0.5);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x - e.vx * 0.04, e.y - e.vy * 0.04);
      ctx.stroke();
    }
    ctx.restore();

    if (raw < 1) requestAnimationFrame(frame);
    else {
      shot.style.opacity = "0";
      shot.style.clipPath = "polygon(0% 0%, 0% 0%)";
      shot.style.transform = "";
      ctx.clearRect(0, 0, W, H);
    }
  }
  requestAnimationFrame(frame);
}

/** Случайный clip: полосы / блок / диагональный рваный край */
function randomGlitchClip(mode) {
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
  // tear — несколько горизонтальных «окон»
  const top = Math.random() * 70;
  const h = 6 + Math.random() * 28;
  const bottom = Math.max(0, 100 - top - h);
  const l = Math.random() * 25;
  const r = Math.random() * 25;
  return `inset(${top.toFixed(1)}% ${r.toFixed(1)}% ${bottom.toFixed(1)}% ${l.toFixed(1)}%)`;
}

/**
 * Глитч каждый раз новый: случайный ритм, клипы, RGB-сдвиги, шум на canvas.
 */
function runDynamicGlitch(duration) {
  const ctx = prepCanvas();
  const gen = ++particleGen;
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!shot) return;

  const modes = ["tear", "block", "wave", "scatter"];
  const mode = modes[(Math.random() * modes.length) | 0];
  const chaos = 0.55 + Math.random() * 0.55;
  const hueBias = Math.random() > 0.5 ? 1 : -1;
  const beatMs = 28 + Math.random() * 52;
  const hitCount = 7 + ((Math.random() * 8) | 0);

  if (hint) {
    const labels = {
      tear: "рваные полосы",
      block: "блоки",
      wave: "волна",
      scatter: "россыпь",
    };
    hint.textContent = `Глитч · ${labels[mode] || mode} · хаос ${Math.round(chaos * 100)}% — каждый раз другой.`;
  }

  const cyan = fxLayer?.querySelector(".glitch-cyan");
  const mag = fxLayer?.querySelector(".glitch-magenta");

  shot.classList.add("is-dyn-glitch");
  fxLayer?.classList.add("is-dyn-glitch");

  // timeline ударов
  const beats = [];
  for (let i = 0; i < hitCount; i++) {
    const p = (i + 0.15 + Math.random() * 0.7) / (hitCount + 0.4);
    beats.push({
      at: p * duration,
      dx: (Math.random() - 0.5) * 90 * chaos,
      dy: (Math.random() - 0.5) * 45 * chaos,
      skew: (Math.random() - 0.5) * 10 * chaos,
      scaleX: 1 + (Math.random() - 0.5) * 0.16 * chaos,
      hue: hueBias * (30 + Math.random() * 160),
      sat: 1.1 + Math.random() * 1.8,
      contrast: 1.1 + Math.random() * 0.9,
      invert: Math.random() > 0.82 ? 0.12 + Math.random() * 0.25 : 0,
      clip: randomGlitchClip(mode === "scatter" ? (Math.random() > 0.5 ? "tear" : "block") : mode),
      cdx: (Math.random() - 0.5) * 28 * chaos,
      cdy: (Math.random() - 0.5) * 14 * chaos,
      mdx: (Math.random() - 0.5) * 28 * chaos,
      mdy: (Math.random() - 0.5) * 14 * chaos,
      ghostOp: 0.25 + Math.random() * 0.55,
    });
  }
  beats.sort((a, b) => a.at - b.at);

  // canvas noise bars — переспавниваются
  let bars = [];
  function spawnBars(intensity) {
    const n = 6 + ((Math.random() * 18 * intensity) | 0);
    bars = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      w: 20 + Math.random() * (80 + 140 * chaos),
      h: 1 + Math.random() * (3 + 8 * chaos),
      vx: (Math.random() - 0.5) * 500 * chaos,
      life: 0.12 + Math.random() * 0.35,
      hue: Math.random() > 0.5 ? 170 + Math.random() * 40 : 300 + Math.random() * 40,
    }));
  }
  spawnBars(1);

  let beatIdx = 0;
  let cur = {
    dx: 0,
    dy: 0,
    skew: 0,
    scaleX: 1,
    hue: 0,
    sat: 1,
    contrast: 1,
    invert: 0,
    clip: "inset(0)",
    cdx: 0,
    cdy: 0,
    mdx: 0,
    mdy: 0,
    ghostOp: 0,
  };

  const t0 = performance.now();
  let lastBeatAt = -1;

  function applyHit(hit) {
    cur = hit;
    shot.style.transform = `translate(${hit.dx}px, ${hit.dy}px) skewX(${hit.skew}deg) scaleX(${hit.scaleX})`;
    shot.style.filter = `hue-rotate(${hit.hue}deg) saturate(${hit.sat}) contrast(${hit.contrast}) invert(${hit.invert})`;
    shot.style.clipPath = hit.clip;
    if (cyan) {
      cyan.style.opacity = String(hit.ghostOp);
      cyan.style.transform = `translate(${hit.cdx}px, ${hit.cdy}px)`;
      cyan.style.clipPath = hit.clip;
    }
    if (mag) {
      mag.style.opacity = String(hit.ghostOp * 0.9);
      mag.style.transform = `translate(${hit.mdx}px, ${hit.mdy}px)`;
      mag.style.clipPath = hit.clip;
    }
    spawnBars(0.7 + chaos);
  }

  function frame(now) {
    if (gen !== particleGen) {
      ctx?.clearRect(0, 0, W, H);
      return;
    }
    const elapsed = now - t0;
    const t = Math.min(1, elapsed / duration);

    while (beatIdx < beats.length && beats[beatIdx].at <= elapsed) {
      applyHit(beats[beatIdx]);
      lastBeatAt = elapsed;
      beatIdx += 1;
    }

    // между ударами — микродрожание
    if (elapsed - lastBeatAt > beatMs * 0.35 && t < 0.88) {
      const jx = (Math.random() - 0.5) * 6 * chaos;
      const jy = (Math.random() - 0.5) * 3 * chaos;
      shot.style.transform = `translate(${cur.dx + jx}px, ${cur.dy + jy}px) skewX(${cur.skew}deg) scaleX(${cur.scaleX})`;
      if (Math.random() > 0.7) {
        shot.style.clipPath = randomGlitchClip(mode === "scatter" ? "tear" : mode);
      }
    }

    // финальный dissolve
    const fade = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
    shot.style.opacity = String(fade);
    if (cyan) cyan.style.opacity = String(cur.ghostOp * fade * (t > 0.7 ? 0.4 : 1));
    if (mag) mag.style.opacity = String(cur.ghostOp * 0.9 * fade * (t > 0.7 ? 0.4 : 1));

    if (ctx) {
      ctx.clearRect(0, 0, W, H);
      // scanlines pulse
      const scanOp = (0.08 + Math.sin(elapsed * 0.02) * 0.05) * fade * chaos;
      ctx.fillStyle = `rgba(0, 255, 220, ${scanOp})`;
      for (let y = (elapsed * 0.15) % 4; y < H; y += 4) {
        ctx.fillRect(0, y, W, 1);
      }
      const dt = 1 / 60;
      for (const b of bars) {
        b.x += b.vx * dt;
        b.life -= dt * 1.2;
        if (b.life <= 0) continue;
        const a = Math.max(0, b.life) * fade;
        ctx.fillStyle = `hsla(${b.hue}, 100%, 65%, ${a * 0.75})`;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        // дубль RGB
        ctx.fillStyle = `hsla(${(b.hue + 120) % 360}, 100%, 60%, ${a * 0.35})`;
        ctx.fillRect(b.x + 4, b.y + 1, b.w * 0.7, b.h);
      }
      // редкие вертикальные «столбы» сбоя
      if (Math.random() > 0.86 && t < 0.9) {
        const x = Math.random() * W;
        const w = 2 + Math.random() * 18;
        ctx.fillStyle = `rgba(255, 0, 180, ${0.15 * fade})`;
        ctx.fillRect(x, 0, w, H);
      }
    }

    if (t < 1) requestAnimationFrame(frame);
    else {
      shot.style.opacity = "0";
      shot.style.transform = "";
      shot.style.filter = "";
      shot.style.clipPath = "inset(50%)";
      if (cyan) cyan.style.opacity = "0";
      if (mag) mag.style.opacity = "0";
      ctx?.clearRect(0, 0, W, H);
    }
  }
  requestAnimationFrame(frame);
}

function runParticles(kind, duration) {
  const ctx = prepCanvas();
  if (!ctx) return;
  const gen = ++particleGen;
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = lastClick.x * W;
  const cy = lastClick.y * H;
  let parts = [];

  if (kind === "melt") {
    parts = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: H * (0.15 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 20,
      vy: 40 + Math.random() * 120,
      r: 2 + Math.random() * 6,
      life: 0.7 + Math.random() * 0.4,
      hue: 170 + Math.random() * 40,
    }));
  } else if (kind === "smoke") {
    parts = Array.from({ length: 50 }, () => ({
      x: W * (0.2 + Math.random() * 0.6),
      y: H * (0.35 + Math.random() * 0.4),
      vx: (Math.random() - 0.5) * 40,
      vy: -30 - Math.random() * 50,
      r: 18 + Math.random() * 40,
      life: 0.5 + Math.random() * 0.5,
      hue: 190 + Math.random() * 30,
    }));
  } else if (kind === "ink") {
    parts = Array.from({ length: 80 }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 140;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 2 + Math.random() * 8,
        life: 0.5 + Math.random() * 0.5,
        hue: 260 + Math.random() * 40,
      };
    });
  } else if (kind === "shatter") {
    parts = Array.from({ length: 40 }, () => {
      const a = Math.random() * Math.PI * 2;
      const sp = 100 + Math.random() * 280;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 1 + Math.random() * 2.5,
        life: 0.35 + Math.random() * 0.35,
        hue: 180 + Math.random() * 40,
        spark: true,
      };
    });
  const t0 = performance.now();
  function frame(now) {
    if (gen !== particleGen) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    const t = (now - t0) / duration;
    if (t > 1) {
      ctx.clearRect(0, 0, W, H);
      return;
    }
    ctx.clearRect(0, 0, W, H);
    if (kind === "burn") {
      // тёплое свечение в точке
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180 + t * 220);
      g.addColorStop(0, `rgba(255,220,140,${0.35 * (1 - t)})`);
      g.addColorStop(0.35, `rgba(255,100,40,${0.2 * (1 - t)})`);
      g.addColorStop(1, "rgba(255,60,20,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const dt = 1 / 60;
    for (const p of parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (kind === "burn" || kind === "melt") p.vy += (kind === "burn" ? 40 : 90) * dt;
      if (kind === "smoke") {
        p.vx += (Math.random() - 0.5) * 8;
        p.r += 20 * dt;
      }
      p.life -= dt * (kind === "shatter" ? 0.7 : 0.38);
      if (p.life <= 0) continue;
      const a = Math.max(0, Math.min(1, p.life));
      if (p.rect) {
        ctx.fillStyle = `hsla(${p.hue}, 100%, 65%, ${a * 0.7})`;
        ctx.fillRect(p.x, p.y, p.w, p.h);
        continue;
      }
      ctx.beginPath();
      if (kind === "smoke") {
        ctx.fillStyle = `hsla(${p.hue}, 40%, 80%, ${a * 0.12})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      } else if (p.spark) {
        ctx.fillStyle = `hsla(${p.hue}, 100%, 75%, ${a})`;
        ctx.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = `hsla(${p.hue}, 95%, 60%, ${a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function durationFor() {
  return (
    {
      burn: 2500,
      melt: 1550,
      curtain: 1400,
      ink: 1450,
      blinds: 1400,
      smoke: 1550,
      shatter: 1450,
      glitch: 1550,
      zoom: 1350,
      peel: 1500,
    }[current] || 1400
  );
}

function play(clientX, clientY) {
  if (busy || !portal || !shot || !fxLayer) return;
  busy = true;
  warmDest();

  lastClick = {
    x: Math.min(0.92, Math.max(0.08, clientX / window.innerWidth)),
    y: Math.min(0.92, Math.max(0.08, clientY / window.innerHeight)),
  };

  prepareFxDom();
  portal.hidden = false;
  portal.classList.add("is-revealing");
  body.classList.add("fxlab-playing");

  void shot.offsetWidth;
  shot.classList.add("is-run");
  if (current === "burn") shot.classList.add("is-paper-burn");
  fxLayer.classList.add("is-run");

  const hold = durationFor();
  if (current === "burn") {
    runPaperBurn(hold);
  } else if (current === "glitch") {
    runDynamicGlitch(hold);
  } else if (["melt", "smoke", "ink", "shatter"].includes(current)) {
    runParticles(current, hold);
  }

  window.setTimeout(() => {
    window.setTimeout(reset, 1500);
  }, hold);
}

function reset() {
  particleGen += 1;
  if (portal) {
    portal.hidden = true;
    portal.classList.remove("is-revealing");
  }
  body.classList.remove("fxlab-playing");
  delete body.dataset.burnDir;
  clearFxLayer();
  if (shot) {
    shot.classList.remove("is-run", "is-paper-burn", "is-dyn-glitch");
    shot.style.clipPath = "";
    shot.style.filter = "";
    shot.style.opacity = "";
    shot.style.transform = "";
  }
  fxLayer?.classList.remove("is-run", "is-dyn-glitch");
  if (dest) dest.style.cssText = "";
  busy = false;
  // вернуть подсказку эффекта
  const meta = EFFECTS.find((e) => e.id === current);
  if (hint && meta) hint.textContent = meta.hint;
}

function buildList() {
  if (!list) return;
  list.innerHTML = EFFECTS.map(
    (fx) => `
    <button type="button" class="fxlab-fx" data-fx="${fx.id}">
      ${fx.name}
      <small>${fx.hint}</small>
    </button>`
  ).join("");
  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".fxlab-fx");
    if (!btn) return;
    reset();
    setFx(btn.dataset.fx);
  });
}

buildList();

let saved = "glitch";
try {
  // выбранный эффект: 8 · Глитч (динамический)
  localStorage.setItem("futurum_fxlab_pick", "glitch");
  saved = localStorage.getItem("futurum_fxlab_pick") || "glitch";
} catch {
  saved = "glitch";
}
if (!EFFECTS.some((e) => e.id === saved)) saved = "glitch";
setFx(saved);

tile?.addEventListener("pointerenter", warmDest, { once: true });
tile?.addEventListener("click", (e) => {
  e.preventDefault();
  play(e.clientX, e.clientY);
});
replayBtn?.addEventListener("click", () => {
  const r = tile?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight / 2;
  reset();
  window.setTimeout(() => play(x, y), 40);
});

warmDest();

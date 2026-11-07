(() => {
  const canvas = document.getElementById("particleField");
  if (!canvas) return;

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    canvas.hidden = true;
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const mouse = { x: -9999, y: -9999, active: false };
  let particles = [];
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = 0;
  let t0 = performance.now();

  function isLight() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function countForSize() {
    const area = w * h;
    const n = Math.round(area / 14000);
    return Math.max(40, Math.min(110, n));
  }

  function spawn() {
    const n = countForSize();
    particles = Array.from({ length: n }, () => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      return {
        ox: x,
        oy: y,
        x,
        y,
        vx: 0,
        vy: 0,
        size: 0.6 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.25 + Math.random() * 0.55,
        depth: 0.45 + Math.random() * 0.55,
      };
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    spawn();
  }

  function onMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }

  function onLeave() {
    mouse.active = false;
  }

  function tick(now) {
    const t = (now - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    const light = isLight();
    const baseAlpha = light ? 0.28 : 0.42;
    const radius = Math.min(220, Math.max(140, w * 0.16));
    const push = light ? 18 : 26;

    for (const p of particles) {
      const floatX = Math.sin(t * p.speed + p.phase) * 6 * p.depth;
      const floatY = Math.cos(t * p.speed * 0.85 + p.phase) * 8 * p.depth;

      let tx = p.ox + floatX;
      let ty = p.oy + floatY;

      if (mouse.active) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const falloff = Math.max(0, 1 - dist / radius);
        const soft = falloff * falloff;
        // мягкий «разрез» поля — точки аккуратно расступаются
        const force = soft * push * p.depth;
        tx += (dx / dist) * force;
        ty += (dy / dist) * force;
        // лёгкое орбитальное смещение у края влияния
        tx += (-dy / dist) * soft * 4 * p.depth;
        ty += (dx / dist) * soft * 4 * p.depth;
      }

      p.vx += (tx - p.x) * 0.045;
      p.vy += (ty - p.y) * 0.045;
      p.vx *= 0.86;
      p.vy *= 0.86;
      p.x += p.vx;
      p.y += p.vy;

      const near = mouse.active
        ? Math.max(0, 1 - Math.hypot(p.x - mouse.x, p.y - mouse.y) / radius)
        : 0;
      const alpha = (baseAlpha * (0.35 + p.depth * 0.65) + near * 0.35) *
        (0.75 + 0.25 * Math.sin(t * 1.2 + p.phase));

      ctx.beginPath();
      ctx.fillStyle = light
        ? `rgba(30, 50, 55, ${alpha * 0.85})`
        : `rgba(230, 245, 255, ${alpha})`;
      ctx.arc(p.x, p.y, p.size * (1 + near * 0.35), 0, Math.PI * 2);
      ctx.fill();

      if (near > 0.15 && !light) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(61, 255, 224, ${near * 0.12})`;
        ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });
  document.addEventListener("mouseleave", onLeave, { passive: true });

  resize();
  raf = requestAnimationFrame(tick);

  window.addEventListener(
    "beforeunload",
    () => {
      cancelAnimationFrame(raf);
    },
    { once: true }
  );
})();

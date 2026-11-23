(() => {
  const wrap = document.querySelector(".home-bg");
  if (!wrap) return;

  let videos = Array.from(wrap.querySelectorAll(".home-bg-video"));
  if (!videos.length) return;

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduce) {
    videos.forEach((v) => v.pause());
    return;
  }

  // Второй буфер для мягкого кроссфейда на стыке петли
  if (videos.length < 2) {
    const clone = videos[0].cloneNode(true);
    clone.classList.remove("is-live");
    clone.removeAttribute("autoplay");
    clone.loop = false;
    wrap.appendChild(clone);
    videos = Array.from(wrap.querySelectorAll(".home-bg-video"));
  }

  const [a, b] = videos;
  a.loop = false;
  b.loop = false;
  // не светим кадр 0 до seek
  a.classList.remove("is-live");
  b.classList.remove("is-live");

  const FADE_MS = 1100;
  const LEAD = 1.15;
  /* ролик без холодного старта; вход в уже «живой» участок */
  const ENTRY_MIN = 6;
  const ENTRY_MAX = 40;
  let live = a;
  let fading = false;

  const playSafe = (video) => {
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  };

  const randomEntry = (video) => {
    const d = video.duration;
    let lo = ENTRY_MIN;
    let hi = ENTRY_MAX;
    if (d && isFinite(d) && d > ENTRY_MIN + LEAD + 1) {
      hi = Math.min(ENTRY_MAX, Math.max(ENTRY_MIN, d - LEAD - 2));
      if (hi < lo) hi = lo;
    }
    return lo + Math.random() * (hi - lo);
  };

  const whenReady = (video, fn) => {
    if (video.readyState >= 1 && video.duration && isFinite(video.duration)) {
      fn();
      return;
    }
    const onMeta = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      fn();
    };
    video.addEventListener("loadedmetadata", onMeta);
  };

  /** Есть ли ~0.6 с буфера вперёд от точки */
  const hasHeadroom = (video, at, need = 0.6) => {
    try {
      for (let i = 0; i < video.buffered.length; i++) {
        const s = video.buffered.start(i);
        const e = video.buffered.end(i);
        if (at >= s - 0.05 && e - at >= need) return true;
      }
    } catch {
      /* ignore */
    }
    return video.readyState >= 3;
  };

  /** Seek и ждать, пока кадр и буфер готовы — без рывка */
  const prepareAt = (video, at) =>
    new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("canplay", onReady);
        video.removeEventListener("canplaythrough", onReady);
        clearTimeout(failSafe);
        clearInterval(poll);
      };
      const onSeeked = () => {
        if (hasHeadroom(video, at) || video.readyState >= 3) finish();
        else waitReady();
      };
      const onReady = () => {
        if (Math.abs((video.currentTime || 0) - at) < 0.5) finish();
      };
      const waitReady = () => {
        video.addEventListener("canplay", onReady);
        video.addEventListener("canplaythrough", onReady);
      };
      const failSafe = window.setTimeout(finish, 2500);
      const poll = window.setInterval(() => {
        if (
          Math.abs((video.currentTime || 0) - at) < 0.45 &&
          (hasHeadroom(video, at) || video.readyState >= 3)
        ) {
          finish();
        }
      }, 120);

      video.pause();
      video.addEventListener("seeked", onSeeked);
      try {
        video.currentTime = at;
      } catch {
        finish();
      }
      // уже на нужном месте
      if (Math.abs((video.currentTime || 0) - at) < 0.2 && hasHeadroom(video, at)) {
        finish();
      }
    });

  const softLoop = (from) => {
    if (fading || from !== live) return;
    fading = true;
    const next = from === a ? b : a;
    const entry = randomEntry(next);

    prepareAt(next, entry).then(() => {
      if (from !== live) {
        fading = false;
        return;
      }
      next.classList.remove("is-fading");
      void next.offsetWidth;
      next.classList.add("is-live");
      playSafe(next);

      from.classList.remove("is-live");
      from.classList.add("is-fading");
      live = next;

      window.setTimeout(() => {
        from.classList.remove("is-fading");
        from.pause();
        const pre = randomEntry(from);
        try {
          from.currentTime = pre;
        } catch {
          /* ignore */
        }
        fading = false;
      }, FADE_MS);
    });
  };

  const wire = (video) => {
    video.addEventListener("timeupdate", () => {
      if (video !== live || fading) return;
      const d = video.duration;
      if (!d || !isFinite(d)) return;
      if (d - video.currentTime > LEAD) return;
      softLoop(video);
    });
    video.addEventListener("ended", () => {
      if (video !== live) return;
      softLoop(video);
    });
    // если буфер кончился — не дёргаем, просто дождёмся
    video.addEventListener("waiting", () => {
      if (video !== live) return;
      /* browser will resume on canplay */
    });
  };

  videos.forEach(wire);
  live = a;

  const startAtEntry = (video) => {
    whenReady(video, () => {
      const entry = randomEntry(video);
      prepareAt(video, entry).then(() => {
        video.classList.add("is-live");
        live = video;
        playSafe(video);
      });
    });
  };

  startAtEntry(a);
  whenReady(b, () => {
    const entry = randomEntry(b);
    prepareAt(b, entry);
  });

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) playSafe(live);
    },
    { passive: true }
  );
})();

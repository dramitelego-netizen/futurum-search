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

  /* Плитки: одно длинное цикл-видео на гейт, мягкий dual-buffer loop без рывка. */
  (() => {
    if (reduce) return;

    const FADE_MS = 1100;
    const LEAD = 1.15;

    const playSafe = (video) => {
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    const fromStart = (video) => {
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    };

    const bindGateAnim = (gate) => {
      const media = gate.querySelector(".home-gate-media-anim");
      if (!media) return;

      let loops = Array.from(media.querySelectorAll(".home-gate-anim-loop"));
      if (!loops.length) return;

      if (loops.length < 2) {
        const clone = loops[0].cloneNode(true);
        clone.classList.remove("is-live");
        clone.removeAttribute("autoplay");
        clone.loop = false;
        media.insertBefore(clone, loops[0].nextSibling);
        loops = Array.from(media.querySelectorAll(".home-gate-anim-loop"));
      }

      const [a, b] = loops;
      a.loop = false;
      b.loop = false;
      let live = a;
      let fading = false;

      const softLoop = (from) => {
        if (fading || from !== live) return;
        fading = true;
        const next = from === a ? b : a;

        const arm = () => {
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
            fromStart(from);
            fading = false;
          }, FADE_MS);
        };

        try {
          next.pause();
          fromStart(next);
          const onSeeked = () => {
            next.removeEventListener("seeked", onSeeked);
            arm();
          };
          if (next.readyState >= 2 && (next.currentTime || 0) < 0.08) {
            arm();
          } else {
            next.addEventListener("seeked", onSeeked);
            window.setTimeout(() => {
              next.removeEventListener("seeked", onSeeked);
              arm();
            }, 500);
          }
        } catch {
          fading = false;
          fromStart(from);
          playSafe(from);
        }
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
      };

      loops.forEach(wire);
      a.classList.add("is-live");
      live = a;
      playSafe(a);

      document.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) playSafe(live);
        },
        { passive: true }
      );
    };

    document.querySelectorAll(".home-gate").forEach(bindGateAnim);
  })();
})();

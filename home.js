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

  /* Плитки: idle всегда играет. Наведение — открытие, затем родной loop парения, уход — закрытие.
     Без перемоток внутри ролика: каждый клип только с начала и до конца. */
  (() => {
    if (reduce) return;

    const FADE_MS = 650;
    const ENTER_DELAY = 280;

    const playSafe = (video) => {
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    const bindGateAnim = (gate) => {
      const media = gate.querySelector(".home-gate-media-anim");
      if (!media) return;

      const idleV = media.querySelector(".home-gate-anim-idle");
      const openV = media.querySelector(".home-gate-anim-open");
      const floatV = media.querySelector(".home-gate-anim-float");
      const closeV = media.querySelector(".home-gate-anim-close");
      if (!idleV || !openV || !floatV || !closeV) return;

      const clips = [openV, floatV, closeV];
      let want = false;
      let phase = "idle"; // idle | armed | opening | floating | closing
      let active = null;
      let enterTimer = 0;
      let hideTimer = 0;

      const clearEnter = () => {
        if (enterTimer) window.clearTimeout(enterTimer);
        enterTimer = 0;
      };

      const fromStart = (video) => {
        try {
          video.currentTime = 0;
        } catch {
          /* ignore */
        }
      };

      const show = (video) => {
        if (hideTimer) {
          window.clearTimeout(hideTimer);
          hideTimer = 0;
        }
        clips.forEach((v) => {
          if (v === video) return;
          if (v.classList.contains("is-active")) {
            v.classList.remove("is-active");
            v.classList.add("is-fading");
            const dying = v;
            window.setTimeout(() => {
              if (active === dying) return;
              dying.pause();
              dying.classList.remove("is-fading");
              fromStart(dying);
            }, FADE_MS);
          }
        });
        video.classList.remove("is-fading");
        void video.offsetWidth;
        video.classList.add("is-active");
        active = video;
        playSafe(video);
      };

      const goIdle = () => {
        phase = "idle";
        active = null;
        clips.forEach((v) => {
          v.classList.remove("is-active");
          v.classList.add("is-fading");
        });
        hideTimer = window.setTimeout(() => {
          hideTimer = 0;
          clips.forEach((v) => {
            v.pause();
            v.classList.remove("is-fading", "is-active");
            fromStart(v);
          });
        }, FADE_MS);
      };

      const startOpen = () => {
        phase = "opening";
        floatV.pause();
        closeV.pause();
        fromStart(openV);
        show(openV);
      };

      const startFloat = () => {
        phase = "floating";
        fromStart(floatV);
        floatV.loop = true;
        show(floatV);
      };

      const startClose = () => {
        if (phase === "closing") return;
        phase = "closing";
        floatV.loop = false;
        fromStart(closeV);
        show(closeV);
      };

      const onEnter = () => {
        want = true;
        if (phase === "opening" || phase === "floating" || phase === "armed") {
          if (phase === "floating") floatV.loop = true;
          return;
        }
        if (phase === "closing") return; // доиграем закрытие, потом откроем снова
        phase = "armed";
        clearEnter();
        enterTimer = window.setTimeout(() => {
          enterTimer = 0;
          if (!want || phase !== "armed") {
            if (phase === "armed") phase = "idle";
            return;
          }
          startOpen();
        }, ENTER_DELAY);
      };

      const onLeave = () => {
        want = false;
        if (phase === "armed") {
          clearEnter();
          phase = "idle";
          return;
        }
        // Не режем кадр: парение доигрывает круг до исходной позы, потом закрытие
        if (phase === "floating") floatV.loop = false;
      };

      openV.addEventListener("ended", () => {
        if (phase !== "opening") return;
        if (want) startFloat();
        else startClose();
      });

      floatV.addEventListener("ended", () => {
        if (phase !== "floating") return;
        if (want) {
          floatV.loop = true;
          fromStart(floatV);
          playSafe(floatV);
          return;
        }
        startClose();
      });

      closeV.addEventListener("ended", () => {
        if (phase !== "closing") return;
        if (want) startOpen();
        else goIdle();
      });

      gate.addEventListener("pointerenter", onEnter);
      gate.addEventListener("pointerleave", onLeave);
      gate.addEventListener("focusin", onEnter);
      gate.addEventListener("focusout", (e) => {
        if (!gate.contains(e.relatedTarget)) onLeave();
      });

      idleV.loop = true;
      playSafe(idleV);
      document.addEventListener(
        "visibilitychange",
        () => {
          if (!document.hidden) playSafe(idleV);
        },
        { passive: true }
      );
    };

    document.querySelectorAll(".home-gate").forEach(bindGateAnim);
  })();
})();

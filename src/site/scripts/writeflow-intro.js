/**
 * WriteFlow Studio — shared intro splash animation (landing + studio).
 */
(() => {
  "use strict";

  const INTRO_TEXT = "WriteFlow Studio";
  const SCORE_TARGETS = { typing: 84, mechanics: 76, story: 91 };
  const STEP_MS = { type: 130, morph1: 1100, morph2: 1000, morph3: 1500, hold: 900 };

  let introRunning = false;
  let introPromise = null;

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function shouldSkipIntro() {
    try {
      return new URLSearchParams(location.search).get("skipIntro") === "1";
    } catch {
      return false;
    }
  }

  function getRevealTarget() {
    return document.getElementById("wfLanding")
      || document.getElementById("wfStudioShell")
      || document.querySelector(".wf-studio-app .dw-shell");
  }

  function setIntroStep(step) {
    const stage = document.getElementById("wfIntroStage");
    if (stage) stage.dataset.step = String(step);
  }

  function resetIntro() {
    const splash = document.getElementById("wfIntroSplash");
    const reveal = getRevealTarget();
    const typeEl = document.getElementById("wfIntroTypewriter");
    const morph = document.getElementById("wfIntroMorph");

    document.body.classList.add("wf-intro-active");
    splash?.classList.remove("dw-hidden", "wf-intro-splash--out");
    reveal?.classList.add("dw-hidden");
    morph?.classList.remove("wf-intro-morph--pulse");

    setIntroStep(0);

    if (typeEl) typeEl.textContent = "";
    document.querySelectorAll(".wf-intro-morph__score-val").forEach((el) => { el.textContent = "0"; });
    document.getElementById("wfIntroCursor")?.classList.remove("dw-hidden");
    const titleEl = document.getElementById("wfIntroTitle");
    if (titleEl) {
      titleEl.style.animation = "none";
      void titleEl.offsetWidth;
      titleEl.style.animation = "";
    }
  }

  function finishIntro({ animated = true } = {}) {
    const splash = document.getElementById("wfIntroSplash");
    const reveal = getRevealTarget();

    return new Promise((resolve) => {
      const show = () => {
        splash?.setAttribute("aria-hidden", "true");
        splash?.classList.add("dw-hidden", "wf-intro-splash--out");
        reveal?.classList.remove("dw-hidden");
        document.body.classList.remove("wf-intro-active");
        resolve();
      };

      if (!animated) {
        show();
        return;
      }

      splash?.classList.add("wf-intro-splash--out");
      delay(700).then(show);
    });
  }

  function animateScoreValues(duration = 1400) {
    const els = document.querySelectorAll(".wf-intro-morph__score-val");
    return Promise.all([...els].map((el) => {
      const key = el.dataset.score;
      const target = SCORE_TARGETS[key] || 80;
      return new Promise((resolve) => {
        const start = performance.now();
        function frame(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - t) ** 3;
          el.textContent = String(Math.round(target * eased));
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    }));
  }

  async function runIntroAnimation() {
    if (introRunning && introPromise) return introPromise;

    const splash = document.getElementById("wfIntroSplash");
    const typeEl = document.getElementById("wfIntroTypewriter");
    const cursorEl = document.getElementById("wfIntroCursor");
    const morph = document.getElementById("wfIntroMorph");

    if (!splash || !typeEl) {
      return finishIntro({ animated: false });
    }

    if (shouldSkipIntro()) {
      return finishIntro({ animated: false });
    }

    introRunning = true;
    introPromise = (async () => {
      const fast = prefersReducedMotion();
      const ms = (key) => (fast ? Math.round(STEP_MS[key] * 0.35) : STEP_MS[key]);
      const charDelay = fast ? 35 : 95;

      try {
        if (document.fonts?.ready) {
          await Promise.race([document.fonts.ready, delay(1500)]);
        }
        resetIntro();
        await waitForPaint();
        // Let step-0 styles apply before the typewriter starts.
        await delay(fast ? 80 : 180);
        for (const ch of INTRO_TEXT) {
          typeEl.textContent += ch;
          await delay(charDelay);
        }
        cursorEl?.classList.add("dw-hidden");
        await delay(fast ? 200 : 500);

        setIntroStep(1);
        const scorePromise = animateScoreValues(fast ? 500 : 1200);
        await delay(ms("morph1"));
        await scorePromise;

        setIntroStep(2);
        await delay(ms("morph2"));

        setIntroStep(3);
        await delay(ms("morph3"));

        morph?.classList.add("wf-intro-morph--pulse");
        await delay(ms("hold"));

        await finishIntro({ animated: true });
      } catch (err) {
        console.error("WriteFlow intro animation error:", err);
        await finishIntro({ animated: true });
      } finally {
        introRunning = false;
      }
    })();

    return introPromise;
  }

  window.WriteFlowIntro = {
    play: runIntroAnimation,
    skip: () => finishIntro({ animated: false }),
    isRunning: () => introRunning,
  };
})();

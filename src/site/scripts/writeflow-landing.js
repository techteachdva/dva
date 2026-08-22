/**
 * WriteFlow Studio landing page — intro animation, changelog, stats.
 */
(() => {
  "use strict";

  const Defaults = window.WriteFlowDefaults;
  if (!Defaults) return;

  const STATS_API = "/api/writeflow-submissions?action=stats";
  const INTRO_TEXT = "WriteFlow Studio";
  const SCORE_TARGETS = { typing: 84, mechanics: 76, story: 91 };
  const STEP_MS = { type: 130, morph1: 1100, morph2: 1000, morph3: 1500, hold: 900 };
  let introRunning = false;
  let cachedStats = null;

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function fetchImpactStats() {
    if (cachedStats) return cachedStats;
    try {
      const res = await fetch(STATS_API);
      if (!res.ok) return null;
      const data = await res.json();
      cachedStats = data.stats || null;
      return cachedStats;
    } catch {
      return null;
    }
  }

  function animateCounter(el, target, duration = 1800) {
    if (!el) return Promise.resolve();
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = Math.round(target * eased).toLocaleString();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function renderChangelog() {
    const full = document.getElementById("wfChangelogFull");
    const simple = document.getElementById("wfChangelogSimple");
    const entries = Defaults.CHANGELOG || [];

    if (full) {
      full.innerHTML = entries.map((entry) => `
        <article class="wf-changelog-entry">
          <header class="wf-changelog-entry__head">
            <strong>v${escapeHtml(entry.version)}</strong>
            <span class="dw-muted">${escapeHtml(entry.date)}</span>
          </header>
          <p>${escapeHtml(entry.summary)}</p>
          <ul>${(entry.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </article>`).join("");
    }

    if (simple) {
      const latest = entries[0];
      simple.innerHTML = latest
        ? `<p><strong>Latest (v${escapeHtml(latest.version)}):</strong> ${escapeHtml(latest.summary)}</p>`
        : "";
    }
  }

  function renderTutorial() {
    const list = document.getElementById("wfLandingTutorial");
    const steps = (Defaults.TUTORIAL_STEPS?.home || []).filter((s) => !s.highlight);
    if (!list) return;
    list.innerHTML = steps.map((step, i) => `
      <li class="wf-quickstart__step">
        <span class="wf-quickstart__num">${i + 1}</span>
        <div>
          <strong>${escapeHtml(step.title)}</strong>
          <p class="dw-muted">${escapeHtml(step.body)}</p>
        </div>
      </li>`).join("");
  }

  async function renderImpactStats() {
    const stats = await fetchImpactStats();
    const targets = {
      wfClassroomCount: stats?.classrooms ?? 0,
      wfAssignmentCount: stats?.assignments ?? 0,
      wfSubmissionCount: stats?.submissions ?? 0,
      wfSentenceCount: stats?.sentences ?? 0,
    };
    await Promise.all(Object.entries(targets).map(([id, target]) =>
      animateCounter(document.getElementById(id), target, 2000)
    ));
  }

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

  function setIntroStep(step) {
    const stage = document.getElementById("wfIntroStage");
    if (stage) stage.dataset.step = String(step);
  }

  function resetIntro() {
    const splash = document.getElementById("wfIntroSplash");
    const landing = document.getElementById("wfLanding");
    const typeEl = document.getElementById("wfIntroTypewriter");
    const morph = document.getElementById("wfIntroMorph");

    document.body.classList.add("wf-intro-active");
    splash?.classList.remove("dw-hidden", "wf-intro-splash--out");
    landing?.classList.add("dw-hidden");
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

  async function hideSplash() {
    const splash = document.getElementById("wfIntroSplash");
    const landing = document.getElementById("wfLanding");
    splash?.classList.add("wf-intro-splash--out");
    await delay(700);
    splash?.classList.add("dw-hidden");
    landing?.classList.remove("dw-hidden");
    document.body.classList.remove("wf-intro-active");
    await renderImpactStats();
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

  async function runIntroAnimation({ thenNavigate = null } = {}) {
    if (introRunning) return;
    introRunning = true;

    const splash = document.getElementById("wfIntroSplash");
    const typeEl = document.getElementById("wfIntroTypewriter");
    const cursorEl = document.getElementById("wfIntroCursor");
    const morph = document.getElementById("wfIntroMorph");

    if (!splash || !typeEl) {
      introRunning = false;
      if (thenNavigate) location.href = thenNavigate;
      return;
    }

    void fetchImpactStats();

    const fast = prefersReducedMotion();
    const ms = (key) => (fast ? Math.round(STEP_MS[key] * 0.35) : STEP_MS[key]);
    const charDelay = fast ? 35 : 95;

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      resetIntro();
      await waitForPaint();

      // Step 0 — typewriter (title grows in place)
      for (const ch of INTRO_TEXT) {
        typeEl.textContent += ch;
        await delay(charDelay);
      }
      cursorEl?.classList.add("dw-hidden");
      await delay(fast ? 200 : 500);

      // Step 1 — title dissolves into analysis tag + score cards (crossfade morph)
      setIntroStep(1);
      const scorePromise = animateScoreValues(fast ? 500 : 1200);
      await delay(ms("morph1"));
      await scorePromise;

      // Step 2 — scores dissolve; logo bars rise in place (same elements as final mark)
      setIntroStep(2);
      await delay(ms("morph2"));

      // Step 3 — brackets, math ops, and WFS letters assemble around the bars
      setIntroStep(3);
      await delay(ms("morph3"));

      morph?.classList.add("wf-intro-morph--pulse");
      await delay(ms("hold"));

      await hideSplash();
    } catch (err) {
      console.error("WriteFlow intro animation error:", err);
      await hideSplash();
    }

    introRunning = false;
    if (thenNavigate) location.href = thenNavigate;
  }

  function bindAppLinks() {
    document.querySelectorAll("[data-wf-app-link]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const href = link.getAttribute("href");
        if (!href || introRunning) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        void runIntroAnimation({ thenNavigate: href });
      });
    });
  }

  function bindReplay() {
    document.getElementById("replayIntroBtn")?.addEventListener("click", () => {
      void runIntroAnimation();
    });
  }

  function init() {
    const versionEl = document.getElementById("wfVersionLabel");
    if (versionEl) versionEl.textContent = Defaults.APP_VERSION || "2.0";
    renderChangelog();
    renderTutorial();
    bindAppLinks();
    bindReplay();
    void runIntroAnimation();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

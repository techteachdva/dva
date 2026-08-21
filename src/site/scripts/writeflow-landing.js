/**
 * WriteFlow Studio landing page — intro animation, changelog, stats.
 */
(() => {
  "use strict";

  const Defaults = window.WriteFlowDefaults;
  if (!Defaults) return;

  const STATS = {
    sentences: { key: "writeflow:global:sentences", base: 12840 },
    submissions: { key: "writeflow:global:submissions", base: 1840 },
    assignments: { key: "writeflow:assignments", base: 24, isList: true },
  };

  const INTRO_TEXT = "WriteFlow Studio";
  const SCORE_TARGETS = { typing: 84, mechanics: 76, story: 91 };
  let introRunning = false;

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function loadClassrooms() {
    try {
      const el = document.getElementById("wfClassroomsJson");
      if (!el) return 8;
      const list = JSON.parse(el.textContent || "[]");
      return Array.isArray(list) ? list.length : 8;
    } catch {
      return 8;
    }
  }

  function getStatValue(kind) {
    const cfg = STATS[kind];
    if (!cfg) return 0;
    try {
      if (cfg.isList) {
        const list = JSON.parse(localStorage.getItem(cfg.key) || "[]");
        return cfg.base + (Array.isArray(list) ? list.length : 0);
      }
      return cfg.base + Number(localStorage.getItem(cfg.key) || 0);
    } catch {
      return cfg.base;
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

  function renderImpactStats() {
    const classrooms = loadClassrooms();
    const targets = {
      wfClassroomCount: classrooms,
      wfAssignmentCount: getStatValue("assignments"),
      wfSubmissionCount: getStatValue("submissions"),
      wfSentenceCount: getStatValue("sentences"),
    };
    Object.entries(targets).forEach(([id, target]) => {
      void animateCounter(document.getElementById(id), target, 2000);
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function animateScoreValues() {
    const els = document.querySelectorAll(".wf-intro-score__val");
    return Promise.all([...els].map((el) => {
      const key = el.dataset.score;
      const target = SCORE_TARGETS[key] || 80;
      return new Promise((resolve) => {
        const start = performance.now();
        const duration = 1400;
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

  function showSplash() {
    const splash = document.getElementById("wfIntroSplash");
    const landing = document.getElementById("wfLanding");
    const typePhase = document.getElementById("wfIntroTypePhase");
    const scoreEl = document.getElementById("wfIntroScore");
    const logoEl = document.getElementById("wfIntroLogo");
    const graphEl = document.getElementById("wfIntroGraph");

    splash?.classList.remove("dw-hidden", "wf-intro-splash--out");
    landing?.classList.add("dw-hidden");

    typePhase?.classList.remove("dw-hidden", "wf-intro-type-phase--out");
    scoreEl?.classList.remove("wf-intro-score--in", "wf-intro-score--out");
    scoreEl?.classList.add("dw-hidden");
    logoEl?.classList.remove("wf-intro-logo--in", "wf-intro-logo--pulse");
    logoEl?.classList.add("dw-hidden");
    graphEl?.classList.remove("wf-intro-graph--in");

    const typeEl = document.getElementById("wfIntroTypewriter");
    if (typeEl) typeEl.textContent = "";
    document.querySelectorAll(".wf-intro-score__val").forEach((el) => { el.textContent = "0"; });
    document.getElementById("wfIntroCursor")?.classList.remove("dw-hidden");
  }

  async function hideSplash() {
    const splash = document.getElementById("wfIntroSplash");
    const landing = document.getElementById("wfLanding");
    splash?.classList.add("wf-intro-splash--out");
    await delay(700);
    splash?.classList.add("dw-hidden");
    landing?.classList.remove("dw-hidden");
    renderImpactStats();
  }

  async function runIntroAnimation({ thenNavigate = null } = {}) {
    if (introRunning) return;
    introRunning = true;

    const splash = document.getElementById("wfIntroSplash");
    const typeEl = document.getElementById("wfIntroTypewriter");
    const cursorEl = document.getElementById("wfIntroCursor");
    const typePhase = document.getElementById("wfIntroTypePhase");
    const scoreEl = document.getElementById("wfIntroScore");
    const logoEl = document.getElementById("wfIntroLogo");
    const graphEl = document.getElementById("wfIntroGraph");

    if (!splash || !typeEl) {
      introRunning = false;
      if (thenNavigate) location.href = thenNavigate;
      return;
    }

    if (prefersReducedMotion()) {
      await hideSplash();
      introRunning = false;
      if (thenNavigate) location.href = thenNavigate;
      return;
    }

    showSplash();

    // Phase 1 — typewriter
    typePhase?.classList.remove("dw-hidden");
    scoreEl?.classList.add("dw-hidden");
    logoEl?.classList.add("dw-hidden");
    typeEl.textContent = "";
    cursorEl?.classList.remove("dw-hidden");

    for (const ch of INTRO_TEXT) {
      typeEl.textContent += ch;
      await delay(130);
    }
    cursorEl?.classList.add("dw-hidden");
    await delay(700);

    // Phase 2 — score the words
    scoreEl?.classList.remove("dw-hidden");
    scoreEl?.classList.add("wf-intro-score--in");
    await animateScoreValues();
    await delay(500);

    if (graphEl) {
      graphEl.classList.add("wf-intro-graph--in");
      graphEl.querySelectorAll(".wf-intro-graph__bar").forEach((bar, i) => {
        bar.style.animationDelay = `${i * 120}ms`;
      });
    }
    await delay(1600);

    // Phase 3 — morph to WFS graph mark
    typePhase?.classList.add("wf-intro-type-phase--out");
    scoreEl?.classList.add("wf-intro-score--out");
    await delay(500);
    typePhase?.classList.add("dw-hidden");
    scoreEl?.classList.add("dw-hidden");

    logoEl?.classList.remove("dw-hidden");
    logoEl?.classList.add("wf-intro-logo--in");
    await delay(1800);

    logoEl?.classList.add("wf-intro-logo--pulse");
    await delay(600);

    await hideSplash();
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

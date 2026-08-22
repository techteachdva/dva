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

  function setPhaseVisible(id, visible) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("wf-intro-phase--hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function animateScoreValues(speed = 1) {
    const els = document.querySelectorAll(".wf-intro-score__val");
    const duration = Math.round(1400 / speed);
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

  function resetIntro() {
    const splash = document.getElementById("wfIntroSplash");
    const landing = document.getElementById("wfLanding");
    const typeEl = document.getElementById("wfIntroTypewriter");
    const scoreEl = document.getElementById("wfIntroScore");
    const graphEl = document.getElementById("wfIntroGraph");

    document.body.classList.add("wf-intro-active");
    splash?.classList.remove("dw-hidden", "wf-intro-splash--out");
    landing?.classList.add("dw-hidden");

    setPhaseVisible("wfIntroTypePhase", true);
    setPhaseVisible("wfIntroScore", false);
    setPhaseVisible("wfIntroLogo", false);

    scoreEl?.classList.remove("wf-intro-score--in", "wf-intro-score--out");
    graphEl?.classList.remove("wf-intro-graph--in");

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
    document.body.classList.remove("wf-intro-active");
    await renderImpactStats();
  }

  async function runTypewriterPhase(speed = 1) {
    const typeEl = document.getElementById("wfIntroTypewriter");
    const cursorEl = document.getElementById("wfIntroCursor");
    if (!typeEl) return;

    setPhaseVisible("wfIntroTypePhase", true);
    typeEl.textContent = "";
    cursorEl?.classList.remove("dw-hidden");

    const charDelay = Math.max(40, Math.round(130 / speed));
    for (const ch of INTRO_TEXT) {
      typeEl.textContent += ch;
      await delay(charDelay);
    }
    cursorEl?.classList.add("dw-hidden");
    await delay(Math.round(700 / speed));
  }

  async function runScorePhase(speed = 1) {
    const scoreEl = document.getElementById("wfIntroScore");
    const graphEl = document.getElementById("wfIntroGraph");

    setPhaseVisible("wfIntroTypePhase", false);
    setPhaseVisible("wfIntroScore", true);
    scoreEl?.classList.add("wf-intro-score--in");

    await animateScoreValues(speed);
    await delay(Math.round(500 / speed));

    if (graphEl) {
      graphEl.classList.add("wf-intro-graph--in");
      graphEl.querySelectorAll(".wf-intro-graph__bar").forEach((bar, i) => {
        bar.style.animationDelay = `${i * 120}ms`;
      });
    }
    await delay(Math.round(1600 / speed));
  }

  async function runLogoPhase(speed = 1) {
    const scoreEl = document.getElementById("wfIntroScore");
    const logoEl = document.getElementById("wfIntroLogo");

    scoreEl?.classList.add("wf-intro-score--out");
    await delay(Math.round(500 / speed));
    setPhaseVisible("wfIntroScore", false);

    setPhaseVisible("wfIntroLogo", true);
    logoEl?.classList.add("wf-intro-logo--in");
    await delay(Math.round(1800 / speed));

    logoEl?.classList.add("wf-intro-logo--pulse");
    await delay(Math.round(600 / speed));
  }

  async function runIntroAnimation({ thenNavigate = null } = {}) {
    if (introRunning) return;
    introRunning = true;

    const splash = document.getElementById("wfIntroSplash");
    if (!splash || !document.getElementById("wfIntroTypewriter")) {
      introRunning = false;
      if (thenNavigate) location.href = thenNavigate;
      return;
    }

    void fetchImpactStats();

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      resetIntro();
      await waitForPaint();

      const speed = prefersReducedMotion() ? 2.5 : 1;
      await runTypewriterPhase(speed);
      await runScorePhase(speed);
      await runLogoPhase(speed);
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

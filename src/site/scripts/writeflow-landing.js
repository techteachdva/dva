/**
 * WriteFlow Studio landing page — intro animation, changelog, stats.
 */
(() => {
  "use strict";

  const Defaults = window.WriteFlowDefaults;
  if (!Defaults) return;

  const STATS_KEY = "writeflow:global:sentences";
  const BASE_SENTENCE_COUNT = 12840;

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function getSentenceCount() {
    try {
      return BASE_SENTENCE_COUNT + Number(localStorage.getItem(STATS_KEY) || 0);
    } catch {
      return BASE_SENTENCE_COUNT;
    }
  }

  function animateCounter(el, target, duration = 1400) {
    if (!el) return;
    const start = performance.now();
    const from = 0;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const val = Math.round(from + (target - from) * eased);
      el.textContent = val.toLocaleString();
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  async function runIntroAnimation() {
    const splash = document.getElementById("wfIntroSplash");
    const landing = document.getElementById("wfLanding");
    const typeEl = document.getElementById("wfIntroTypewriter");
    const scoreEl = document.getElementById("wfIntroScore");
    const text = "WriteFlow Studio";

    if (prefersReducedMotion() || !splash || !typeEl) {
      splash?.remove();
      landing?.classList.remove("dw-hidden");
      return;
    }

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    typeEl.textContent = "";
    for (const ch of text) {
      typeEl.textContent += ch;
      await delay(85);
    }
    await delay(500);
    scoreEl?.classList.remove("dw-hidden");
    const scoreTargets = { typing: 84, mechanics: 76, story: 91 };
    document.querySelectorAll(".wf-intro-score__val").forEach((el) => {
      const key = el.dataset.score;
      const target = scoreTargets[key] || 80;
      let current = 0;
      const tick = () => {
        current = Math.min(target, current + 4);
        el.textContent = String(current);
        if (current < target) requestAnimationFrame(tick);
      };
      tick();
    });
    await delay(1200);
    splash.classList.add("wf-intro-splash--out");
    await delay(500);
    splash.remove();
    landing?.classList.remove("dw-hidden");
  }

  function init() {
    const versionEl = document.getElementById("wfVersionLabel");
    if (versionEl) versionEl.textContent = Defaults.APP_VERSION || "2.0";
    renderChangelog();
    renderTutorial();
    animateCounter(document.getElementById("wfSentenceCount"), getSentenceCount());
    void runIntroAnimation();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

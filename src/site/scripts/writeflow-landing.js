/**
 * WriteFlow Studio landing page — changelog, stats, and intro hookup.
 */
(() => {
  "use strict";

  const Defaults = window.WriteFlowDefaults;
  if (!Defaults) return;

  const STATS_API = "/api/writeflow-submissions?action=stats";
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

  function bindReplay() {
    document.getElementById("replayIntroBtn")?.addEventListener("click", () => {
      void window.WriteFlowIntro?.play().then(() => renderImpactStats());
    });
  }

  async function init() {
    const versionEl = document.getElementById("wfVersionLabel");
    if (versionEl) versionEl.textContent = Defaults.APP_VERSION || "2.0";
    renderChangelog();
    renderTutorial();
    bindReplay();
    void fetchImpactStats();
    if (window.WriteFlowIntro) {
      await window.WriteFlowIntro.play();
    } else {
      document.getElementById("wfLanding")?.classList.remove("dw-hidden");
      document.getElementById("wfIntroSplash")?.classList.add("dw-hidden");
    }
    await renderImpactStats();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else void init();
})();

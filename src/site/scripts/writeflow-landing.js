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

  function animateCounter(el, target, duration = 1400) {
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
    const entries = Defaults.CHANGELOG || [];

    if (full) {
      full.innerHTML = entries.map((entry) => {
        const items = entry.items || [];
        return `
        <article class="wf-changelog-entry wf-changelog-entry--landing">
          <header class="wf-changelog-entry__head">
            <strong>v${escapeHtml(entry.version)}</strong>
            <span class="dw-muted">${escapeHtml(entry.date)}</span>
          </header>
          <p class="wf-changelog-entry__summary">${escapeHtml(entry.summary)}</p>
          ${items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        </article>`;
      }).join("");
    }
  }

  function renderTutorial() {
    const list = document.getElementById("wfLandingTutorial");
    const steps = Defaults.LANDING_QUICKSTART || Defaults.TUTORIAL_STEPS?.home || [];
    if (!list) return;
    list.innerHTML = steps.map((step, i) => `
      <li class="wf-quickstart__step wf-quickstart__step--compact">
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
      animateCounter(document.getElementById(id), target, 1600)
    ));
  }

  async function init() {
    const versionEl = document.getElementById("wfVersionLabel");
    if (versionEl) versionEl.textContent = Defaults.APP_VERSION || "2.0";
    renderChangelog();
    renderTutorial();
    void fetchImpactStats();
    const introTask = window.WriteFlowIntro
      ? window.WriteFlowIntro.play()
      : Promise.resolve().then(() => {
          document.getElementById("wfLanding")?.classList.remove("dw-hidden");
          document.getElementById("wfIntroSplash")?.classList.add("dw-hidden");
        });
    await Promise.all([introTask, renderImpactStats()]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else void init();
})();

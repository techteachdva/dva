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

  function renderScoringGuide() {
    const root = document.getElementById("wfScoringGuide");
    const guide = Defaults.LANDING_SCORING_GUIDE;
    if (!root || !guide) return;

    const modes = (guide.modes || []).map((m) => `
      <div class="wf-landing-scoring__mode">
        <strong>${escapeHtml(m.name)}</strong>
        <span class="dw-muted">${escapeHtml(m.detail)}</span>
      </div>`).join("");

    const dimensions = (guide.dimensions || []).map((dim) => `
      <article class="wf-landing-scoring__dim">
        <h3 class="wf-landing-scoring__dim-title">${escapeHtml(dim.title)}</h3>
        <p class="wf-landing-scoring__formula">${escapeHtml(dim.formula)}</p>
        <ul class="wf-landing-scoring__signals">
          ${(dim.signals || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("")}
        </ul>
      </article>`).join("");

    const notes = (guide.notes || []).map((n) => `<p class="wf-landing-scoring__note">${escapeHtml(n)}</p>`).join("");

    root.innerHTML = `
      <h2 class="wf-landing__section-title" id="wfScoringTitle">${escapeHtml(guide.title)}</h2>
      <p class="wf-landing-scoring__lead">${escapeHtml(guide.lead)}</p>
      <p class="wf-landing-scoring__disclaimer" role="note">${escapeHtml(guide.disclaimer)}</p>
      <h3 class="wf-landing__mini-title">Overall score by assignment mode</h3>
      <div class="wf-landing-scoring__modes">${modes}</div>
      <h3 class="wf-landing__mini-title">What each dimension measures</h3>
      <div class="wf-landing-scoring__grid">${dimensions}</div>
      <div class="wf-landing-scoring__footer">${notes}</div>`;
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
    renderScoringGuide();
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

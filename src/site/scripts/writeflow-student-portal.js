/**
 * WriteFlow — student portal (submission history).
 */
(() => {
  "use strict";

  const Student = () => window.WriteFlowStudent;
  if (!Student) return;

  function formatDate(ms) {
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return String(ms);
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function show(id, visible) {
    document.getElementById(id)?.classList.toggle("dw-hidden", !visible);
  }

  function renderSubmissionCard(item) {
    const scores = item.analysis?.scores || {};
    const overall = scores.overall != null ? Math.round(scores.overall) : "—";
    const words = item.analysis?.wordCount || 0;
    const preview = escapeHtml((item.text || "").slice(0, 160));
    const grading = item.grading || {};
    const title = grading.title || item.assignmentId;
    const maxPoints = grading.maxPoints || 100;
    const hasReleasedGrade = grading.gradingEnabled && item.feedbackVisible;
    const gradeLine = hasReleasedGrade && item.teacherGrade != null
      ? `<p class="wf-submission-card__grade"><strong>${escapeHtml(String(item.teacherGrade))}</strong> / ${maxPoints} points</p>`
      : (grading.gradingEnabled
        ? `<p class="dw-muted dw-tiny">Auto score ${overall}/100 — teacher feedback not released yet.</p>`
        : `<p class="dw-muted dw-tiny">${escapeHtml(item.classroom || "")} · ${words} words · auto score ${overall}/100</p>`);
    const feedbackBlock = hasReleasedGrade && item.teacherFeedback
      ? `<div class="wf-submission-card__feedback"><p class="wf-submission-card__feedback-label">Teacher feedback</p><p>${escapeHtml(item.teacherFeedback)}</p></div>`
      : "";
    const metaLine = hasReleasedGrade
      ? `<p class="dw-muted dw-tiny">${escapeHtml(item.classroom || "")} · ${words} words · ${formatDate(item.submittedAt)}</p>`
      : "";

    return `<article class="wf-submission-card" role="listitem">
      <header class="wf-submission-card__head">
        <strong>${escapeHtml(title)}</strong>
        <span class="dw-muted dw-tiny">${formatDate(item.submittedAt)}</span>
      </header>
      ${metaLine}
      ${gradeLine}
      ${feedbackBlock}
      <p class="wf-submission-card__preview">${preview}${(item.text || "").length > 160 ? "…" : ""}</p>
    </article>`;
  }

  async function renderSubmissions() {
    const listEl = document.getElementById("studentPortalList");
    const emptyEl = document.getElementById("studentPortalEmpty");
    if (!listEl) return;

    const items = await Student().listMySubmissions();
    if (!items.length) {
      listEl.innerHTML = "";
      emptyEl?.classList.remove("dw-hidden");
      return;
    }
    emptyEl?.classList.add("dw-hidden");

    listEl.innerHTML = items.map((item) => renderSubmissionCard(item)).join("");
  }

  function renderSignedIn() {
    const session = Student()?.getSession();
    const nameEl = document.getElementById("studentPortalDisplayName");
    if (nameEl) nameEl.textContent = session?.username || "";

    if (session?.mustChangePassword) {
      show("studentPortalSignedOut", false);
      show("studentPortalSignedIn", false);
      show("studentPortalPasswordPanel", true);
      return;
    }

    show("studentPortalSignedOut", false);
    show("studentPortalPasswordPanel", false);
    show("studentPortalSignedIn", true);
    void renderSubmissions();
  }

  function renderSignedOut() {
    show("studentPortalSignedOut", true);
    show("studentPortalSignedIn", false);
    show("studentPortalPasswordPanel", false);
  }

  async function init() {
    await Student().validate();
    if (Student().isLoggedIn()) renderSignedIn();
    else renderSignedOut();

    document.getElementById("studentPortalLoginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("studentPortalLoginError");
      const username = document.getElementById("studentPortalUsername")?.value || "";
      const password = document.getElementById("studentPortalPassword")?.value || "";
      try {
        await Student().login(username, password);
        await Student().validate();
        renderSignedIn();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not sign in.";
          errEl.classList.remove("dw-hidden");
        }
      }
    });

    document.getElementById("studentPortalPasswordForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("studentPortalPasswordError");
      const newPassword = document.getElementById("studentPortalNewPassword")?.value || "";
      try {
        await Student().setPassword(newPassword);
        await Student().validate();
        renderSignedIn();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not save password.";
          errEl.classList.remove("dw-hidden");
        }
      }
    });

    document.getElementById("studentPortalLogoutBtn")?.addEventListener("click", async () => {
      await Student().logout();
      renderSignedOut();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();

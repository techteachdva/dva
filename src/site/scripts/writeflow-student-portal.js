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

  function assignmentUrl(assignmentId) {
    return `/writeflow/a/?id=${encodeURIComponent(assignmentId)}`;
  }

  function groupByAssignment(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.assignmentId || "unknown";
      if (!groups.has(key)) {
        groups.set(key, {
          assignmentId: key,
          title: item.grading?.title || key,
          meta: item.grading || {},
          items: [],
        });
      }
      groups.get(key).items.push(item);
    }
    return [...groups.values()]
      .map((group) => {
        group.items.sort((a, b) => (Number(a.attemptNumber) || 1) - (Number(b.attemptNumber) || 1));
        return group;
      })
      .sort((a, b) => {
        const maxA = Math.max(...a.items.map((i) => Number(i.submittedAt) || 0));
        const maxB = Math.max(...b.items.map((i) => Number(i.submittedAt) || 0));
        return maxB - maxA;
      });
  }

  function groupCanRetry(group) {
    const meta = group.meta || {};
    if (!meta.allowRetries || meta.retriesOpen === false) return false;
    const maxAttempts = Math.max(1, Number(meta.maxAttempts) || 2);
    return group.items.length < maxAttempts;
  }

  function renderAttemptCard(item, group) {
    const scores = item.analysis?.scores || {};
    const overall = scores.overall != null ? Math.round(scores.overall) : "—";
    const words = item.analysis?.wordCount || 0;
    const grading = item.grading || group.meta || {};
    const maxPoints = grading.maxPoints || 100;
    const hasReleasedGrade = grading.gradingEnabled && item.feedbackVisible;
    const attemptLabel = (item.attemptNumber || 1) > 1 || group.items.length > 1
      ? `Attempt ${item.attemptNumber || 1}`
      : "Submission";
    const countedBadge = item.countsForGrade
      ? `<span class="wf-submission-card__badge">Counted for grade</span>`
      : "";
    const gradeLine = hasReleasedGrade && item.teacherGrade != null
      ? `<p class="wf-submission-card__grade"><strong>${escapeHtml(String(item.teacherGrade))}</strong> / ${maxPoints} points</p>`
      : (grading.gradingEnabled
        ? `<p class="dw-muted dw-tiny">Auto score ${overall}/100 — teacher feedback not released yet.</p>`
        : `<p class="dw-muted dw-tiny">${escapeHtml(item.classroom || "")} · ${words} words · auto score ${overall}/100</p>`);
    const feedbackBlock = hasReleasedGrade && item.teacherFeedback
      ? `<div class="wf-submission-card__feedback"><p class="wf-submission-card__feedback-label">Teacher feedback</p><p>${escapeHtml(item.teacherFeedback)}</p></div>`
      : "";
    const preview = escapeHtml((item.text || "").slice(0, 200));
    const hasMore = (item.text || "").length > 200;
    const textUnavailable = item.textUnavailable || (!item.text && item.analysis);

    return `<article class="wf-submission-card" role="listitem">
      <header class="wf-submission-card__head">
        <div>
          <strong>${escapeHtml(attemptLabel)}</strong>
          ${countedBadge}
        </div>
        <span class="dw-muted dw-tiny">${formatDate(item.submittedAt)}</span>
      </header>
      ${gradeLine}
      ${feedbackBlock}
      <details class="wf-submission-card__details">
        <summary class="wf-submission-card__summary">${textUnavailable ? "Text unavailable" : (hasMore ? "Read full draft" : "View draft")}</summary>
        <div class="wf-submission-card__full">${textUnavailable
          ? `<p class="dw-muted dw-tiny">Your draft text could not be loaded. Ask your teacher if you need a copy.</p>`
          : `<p class="wf-submission-card__preview">${escapeHtml(item.text || "")}</p>`}</div>
      </details>
      ${!textUnavailable && preview ? `<p class="wf-submission-card__preview wf-submission-card__preview--clip">${preview}${hasMore ? "…" : ""}</p>` : ""}
    </article>`;
  }

  function renderAssignmentGroup(group) {
    const canRetry = groupCanRetry(group);
    const retryMsg = String(group.meta.retryStudentMessage || "").trim();
    const retryBlock = canRetry
      ? `<div class="wf-submission-group__retry">
          <p class="dw-muted dw-tiny">${escapeHtml(retryMsg || "Your teacher has allowed another attempt.")}</p>
          <a class="dw-btn dw-btn--compact" href="${assignmentUrl(group.assignmentId)}">Try again</a>
        </div>`
      : "";
    const attempts = group.items.map((item) => renderAttemptCard(item, group)).join("");

    return `<section class="wf-submission-group" role="listitem">
      <header class="wf-submission-group__head">
        <h3 class="wf-submission-group__title">${escapeHtml(group.title)}</h3>
        <span class="dw-muted dw-tiny">${group.items.length} attempt${group.items.length === 1 ? "" : "s"}</span>
      </header>
      ${retryBlock}
      <div class="wf-submission-group__attempts" role="list">${attempts}</div>
    </section>`;
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

    const groups = groupByAssignment(items);
    listEl.innerHTML = groups.map((group) => renderAssignmentGroup(group)).join("");
  }

  function renderSignedIn() {
    const session = Student()?.getSession();
    const nameEl = document.getElementById("studentPortalDisplayName");
    if (nameEl) nameEl.textContent = session?.username || "";

    show("studentPortalSignedOut", false);
    show("studentPortalSignedIn", true);
    show("studentPortalPasswordPanel", !!session?.offerPasswordChange);
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
      if (!newPassword.trim()) {
        if (errEl) {
          errEl.textContent = "Enter a new password, or click Keep SPARK.";
          errEl.classList.remove("dw-hidden");
        }
        return;
      }
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

    document.getElementById("studentPortalKeepSparkBtn")?.addEventListener("click", async () => {
      const errEl = document.getElementById("studentPortalPasswordError");
      try {
        await Student().keepDefaultPassword();
        await Student().validate();
        renderSignedIn();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not save choice.";
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

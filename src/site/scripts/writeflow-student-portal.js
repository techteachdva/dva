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

    listEl.innerHTML = items
      .map((item) => {
        const scores = item.analysis?.scores || {};
        const overall = scores.overall != null ? Math.round(scores.overall) : "—";
        const words = item.analysis?.wordCount || 0;
        const preview = escapeHtml((item.text || "").slice(0, 160));
        return `<article class="wf-submission-card" role="listitem">
          <header class="wf-submission-card__head">
            <strong>${escapeHtml(item.assignmentId)}</strong>
            <span class="dw-muted dw-tiny">${formatDate(item.submittedAt)}</span>
          </header>
          <p class="dw-muted dw-tiny">${escapeHtml(item.classroom || "")} · ${words} words · score ${overall}</p>
          <p class="wf-submission-card__preview">${preview}${(item.text || "").length > 160 ? "…" : ""}</p>
        </article>`;
      })
      .join("");
  }

  function renderSignedIn() {
    const session = Student().getSession();
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

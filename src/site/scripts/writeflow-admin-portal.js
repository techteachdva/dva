/**
 * WriteFlow — admin portal.
 */
(() => {
  "use strict";

  const Admin = () => window.WriteFlowAdmin;
  if (!Admin) return;

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

  function renderStats(stats) {
    const el = document.getElementById("adminPortalStats");
    if (!el) return;
    const rows = [
      ["Submissions", stats.submissions],
      ["Assignments", stats.assignments],
      ["Classrooms (in data)", stats.classrooms],
      ["Sentences analyzed", stats.sentences],
      ["Registered students", stats.registeredStudents],
      ["Teachers", stats.teachers],
      ["Roster entries", stats.rosterEntries],
    ];
    el.innerHTML = `<dl class="wf-stats-dl">${rows
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "—")}</dd></div>`)
      .join("")}</dl>`;
  }

  function renderTable(headers, rows) {
    if (!rows.length) return "<p class=\"dw-muted\">None yet.</p>";
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("");
    return `<table class="wf-admin-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }

  async function refreshDashboard() {
    const stats = await Admin().getStats();
    renderStats(stats);

    const teachers = await Admin().listTeachers();
    const teachersEl = document.getElementById("adminTeachersList");
    if (teachersEl) {
      teachersEl.innerHTML = renderTable(
        ["Username", "Display name", "Email", "Verified"],
        teachers.map((t) => [t.username, t.displayName, t.email, t.verified ? "Yes" : "No"])
      );
    }

    const students = await Admin().listStudents();
    const studentsEl = document.getElementById("adminStudentsList");
    if (studentsEl) {
      studentsEl.innerHTML = renderTable(
        ["Username", "Classroom", "Needs password change"],
        students.map((s) => [s.username, s.classroom, s.mustChangePassword ? "Yes" : "No"])
      );
    }

    const session = Admin().getSession();
    const note = document.getElementById("adminPortalImpersonateNote");
    if (note) {
      if (session?.impersonateAs) {
        note.textContent = `(impersonating ${session.impersonateAs})`;
        note.classList.remove("dw-hidden");
      } else {
        note.textContent = "";
        note.classList.add("dw-hidden");
      }
    }
  }

  function renderSignedIn() {
    show("adminPortalSignedOut", false);
    show("adminPortalSignedIn", true);
    void refreshDashboard();
  }

  function renderSignedOut() {
    show("adminPortalSignedOut", true);
    show("adminPortalSignedIn", false);
  }

  async function init() {
    await Admin().validate();
    if (Admin().isLoggedIn()) renderSignedIn();
    else renderSignedOut();

    document.getElementById("adminPortalLoginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("adminPortalLoginError");
      const username = document.getElementById("adminPortalUsername")?.value || "";
      const password = document.getElementById("adminPortalPassword")?.value || "";
      try {
        await Admin().login(username, password);
        renderSignedIn();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not sign in.";
          errEl.classList.remove("dw-hidden");
        }
      }
    });

    document.getElementById("adminPortalLogoutBtn")?.addEventListener("click", async () => {
      await Admin().logout();
      renderSignedOut();
    });

    document.getElementById("adminSeeAllResultsBtn")?.addEventListener("click", () => {
      window.open("/writeflow/admin/results/", "_blank", "noopener,noreferrer");
    });

    document.getElementById("adminDedupeBtn")?.addEventListener("click", async () => {
      const resultEl = document.getElementById("adminDedupeResult");
      try {
        const data = await Admin().dedupeSubmissions();
        if (resultEl) {
          resultEl.textContent = `Removed ${data.removed || 0} duplicate row(s).`;
          resultEl.classList.remove("dw-hidden");
        }
        await refreshDashboard();
      } catch (err) {
        if (resultEl) {
          resultEl.textContent = err.message || "Dedupe failed.";
          resultEl.classList.remove("dw-hidden");
        }
      }
    });

    document.getElementById("adminImpersonateForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("adminImpersonateError");
      const targetUsername = document.getElementById("adminImpersonateUsername")?.value || "";
      const targetRole = document.getElementById("adminImpersonateRole")?.value || "teacher";
      try {
        await Admin().impersonate(targetUsername, targetRole);
        if (errEl) errEl.classList.add("dw-hidden");
        await refreshDashboard();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not impersonate.";
          errEl.classList.remove("dw-hidden");
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();

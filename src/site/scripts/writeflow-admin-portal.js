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

  function formatCreatedAt(ts) {
    const n = Number(ts);
    if (!n) return "—";
    try {
      return new Date(n).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    } catch {
      return "—";
    }
  }

  let usernameCleanupPreview = [];

  function renderUsernameCleanupPreview(changes) {
    const el = document.getElementById("adminUsernameCleanupPreview");
    const applyBtn = document.getElementById("adminApplyUsernamesBtn");
    usernameCleanupPreview = Array.isArray(changes) ? changes : [];
    if (!el) return;
    const fixable = usernameCleanupPreview.filter((c) => c.toUsername);
    if (!fixable.length) {
      el.innerHTML = usernameCleanupPreview.length
        ? "<p class=\"dw-muted\">No automatic fixes found. Add missing students to the roster, then preview again.</p>"
        : "";
      if (applyBtn) applyBtn.disabled = true;
      return;
    }
    el.innerHTML = renderTable(
      ["Current name", "Suggested roster name", "Class", "Confidence", "Reason"],
      fixable.map((c) => [
        c.fromUsername || c.fromName || "—",
        c.toUsername,
        c.classroom || "—",
        c.confidence || "—",
        c.reason || "—",
      ])
    );
    if (applyBtn) applyBtn.disabled = false;
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
        ["Username", "Classroom", "Needs password change", "Created at"],
        students.map((s) => [s.username, s.classroom, s.mustChangePassword ? "Yes" : "No", formatCreatedAt(s.createdAt)])
      );
    }

    const roster = await Admin().listClassRoster();
    const rosterEl = document.getElementById("adminClassRosterList");
    if (rosterEl) {
      rosterEl.innerHTML = renderTable(
        ["Username", "Classroom", "Active", "Registered", "Created at"],
        roster.map((r) => [
          r.username,
          r.classroom,
          r.active ? "Yes" : "No",
          r.registered ? "Yes" : "No",
          formatCreatedAt(r.createdAt),
        ])
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

    document.getElementById("adminPreviewUsernamesBtn")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("adminUsernameCleanupStatus");
      try {
        const data = await Admin().previewUsernameCleanup();
        renderUsernameCleanupPreview(data.changes || []);
        if (statusEl) {
          const fixable = (data.changes || []).filter((c) => c.toUsername).length;
          const unmatched = data.unmatched || 0;
          statusEl.textContent = `${fixable} row(s) can be fixed automatically; ${unmatched} row(s) need manual review; ${data.unchanged || 0} already correct.`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Preview failed.";
          statusEl.classList.remove("dw-hidden");
          statusEl.classList.add("dw-error");
        }
      }
    });

    document.getElementById("adminApplyUsernamesBtn")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("adminUsernameCleanupStatus");
      const applyLow = document.getElementById("adminApplyLowConfidenceUsernames")?.checked === true;
      const fixable = usernameCleanupPreview.filter((c) => c.toUsername).length;
      if (!fixable) return;
      if (!window.confirm(`Update ${fixable} submission row(s) to roster usernames?`)) return;
      try {
        const data = await Admin().applyUsernameCleanup({ applyLowConfidence: applyLow });
        if (statusEl) {
          statusEl.textContent = `Updated ${data.updated || 0} row(s); skipped ${data.skipped || 0}; ${data.unmatched || 0} still unmatched.`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
        const preview = await Admin().previewUsernameCleanup();
        renderUsernameCleanupPreview(preview.changes || []);
        await refreshDashboard();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Apply failed.";
          statusEl.classList.remove("dw-hidden");
          statusEl.classList.add("dw-error");
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

    document.getElementById("adminBackfillCreatedAtBtn")?.addEventListener("click", async () => {
      const resultEl = document.getElementById("adminRosterStatus");
      try {
        const data = await Admin().backfillStudentCreatedAt();
        if (resultEl) {
          resultEl.textContent = `Filled in created-at for ${data.updated || 0} student account(s).`;
          resultEl.classList.remove("dw-hidden", "dw-error");
        }
        await refreshDashboard();
      } catch (err) {
        if (resultEl) {
          resultEl.textContent = err.message || "Backfill failed.";
          resultEl.classList.remove("dw-hidden");
          resultEl.classList.add("dw-error");
        }
      }
    });

    document.getElementById("adminAddRosterForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("adminAddRosterError");
      const statusEl = document.getElementById("adminRosterStatus");
      const classroom = document.getElementById("adminAddRosterClassroom")?.value || "";
      const username = document.getElementById("adminAddRosterUsername")?.value || "";
      try {
        await Admin().addRosterEntry(classroom, username);
        if (errEl) errEl.classList.add("dw-hidden");
        if (statusEl) {
          statusEl.textContent = `Added ${username.trim()} to ${classroom.trim()}. They can sign in at /writeflow/student/ with password SPARK.`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
        document.getElementById("adminAddRosterUsername").value = "";
        await refreshDashboard();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not add student.";
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

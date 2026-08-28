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
      ["Classrooms", stats.classrooms],
      ["Sentences", stats.sentences],
      ["Registered", stats.registeredStudents],
      ["Teachers", stats.teachers],
      ["Roster", stats.rosterEntries],
    ];
    el.innerHTML = rows
      .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? "—")}</dd></div>`)
      .join("");
  }

  function renderTable(headers, rows) {
    if (!rows.length) return "<p class=\"dw-muted\">None yet.</p>";
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
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
  let classroomOptions = [];

  function populateClassroomSelects(classrooms) {
    classroomOptions = classrooms || [];
    const datalist = document.getElementById("adminClassroomList");
    if (datalist) {
      datalist.innerHTML = classroomOptions.map((c) => `<option value="${escapeHtml(c)}"></option>`).join("");
    }
    const resetSelect = document.getElementById("adminBulkResetClassroom");
    if (resetSelect) {
      const current = resetSelect.value;
      resetSelect.innerHTML = `<option value="">All registered students</option>${classroomOptions
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join("")}`;
      resetSelect.value = current || "";
    }
  }

  function renderUsernameCleanupPreview(changes) {
    const el = document.getElementById("adminUsernameCleanupPreview");
    const applyBtn = document.getElementById("adminApplyUsernamesBtn");
    usernameCleanupPreview = Array.isArray(changes) ? changes : [];
    if (!el) return;
    const fixable = usernameCleanupPreview.filter((c) => c.toUsername);
    const unmatched = usernameCleanupPreview.filter((c) => !c.toUsername);
    if (!fixable.length && !unmatched.length) {
      el.innerHTML = "";
      if (applyBtn) applyBtn.disabled = true;
      return;
    }
    let html = "";
    if (fixable.length) {
      html += renderTable(
        ["Current name", "Roster name", "Class", "Confidence", "Reason"],
        fixable.map((c) => [
          escapeHtml(c.fromUsername || c.fromName || "—"),
          escapeHtml(c.toUsername),
          escapeHtml(c.classroom || "—"),
          escapeHtml(c.confidence || "—"),
          escapeHtml(c.reason || "—"),
        ])
      );
    }
    if (unmatched.length) {
      html += `<p class="dw-muted dw-tiny" style="margin-top:12px"><strong>${unmatched.length}</strong> submission(s) could not be matched — add those students to StudentRoster first.</p>`;
      html += renderTable(
        ["Unmatched name", "Class", "Assignment"],
        unmatched.slice(0, 30).map((c) => [
          escapeHtml(c.fromUsername || c.fromName || "—"),
          escapeHtml(c.classroom || "—"),
          escapeHtml(c.assignmentId || "—"),
        ])
      );
      if (unmatched.length > 30) {
        html += `<p class="dw-muted dw-tiny">…and ${unmatched.length - 30} more unmatched.</p>`;
      }
    }
    el.innerHTML = html;
    if (applyBtn) applyBtn.disabled = !fixable.length;
  }

  function renderStudentsTable(students) {
    const el = document.getElementById("adminStudentsList");
    if (!el) return;
    if (!students.length) {
      el.innerHTML = "<p class=\"dw-muted\">No registered students yet.</p>";
      return;
    }
    el.innerHTML = renderTable(
      ["Username", "Classroom", "Password", "Created at", ""],
      students.map((s) => [
        escapeHtml(s.username),
        escapeHtml(s.classroom),
        s.mustChangePassword ? "Needs change" : "Set",
        escapeHtml(formatCreatedAt(s.createdAt)),
        `<button class="dw-btn dw-btn-ghost" type="button" data-reset-password="${escapeHtml(s.username)}">Reset to SPARK</button>`,
      ])
    );
  }

  function renderRosterTable(roster) {
    const el = document.getElementById("adminClassRosterList");
    if (!el) return;
    if (!roster.length) {
      el.innerHTML = "<p class=\"dw-muted\">No roster entries yet.</p>";
      return;
    }
    el.innerHTML = renderTable(
      ["Username", "Classroom", "Active", "Registered", "Created at"],
      roster.map((r) => [
        escapeHtml(r.username),
        escapeHtml(r.classroom),
        r.active ? "Yes" : "No",
        r.registered ? "Yes" : "No",
        escapeHtml(formatCreatedAt(r.createdAt)),
      ])
    );
  }

  async function refreshDashboard() {
    const stats = await Admin().getStats();
    renderStats(stats);

    const classrooms = await Admin().listClassrooms();
    populateClassroomSelects(classrooms);

    const teachers = await Admin().listTeachers();
    const teachersEl = document.getElementById("adminTeachersList");
    if (teachersEl) {
      teachersEl.innerHTML = renderTable(
        ["Username", "Display name", "Email", "Verified"],
        teachers.map((t) => [
          escapeHtml(t.username),
          escapeHtml(t.displayName),
          escapeHtml(t.email),
          t.verified ? "Yes" : "No",
        ])
      );
    }

    const students = await Admin().listStudents();
    renderStudentsTable(students);

    const roster = await Admin().listClassRoster();
    renderRosterTable(roster);

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

    document.getElementById("adminSyncClassroomsBtn")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("adminSyncClassroomsStatus");
      try {
        const data = await Admin().syncStudentClassrooms();
        if (statusEl) {
          statusEl.textContent = `Updated classroom for ${data.updated || 0} registered student(s) from StudentRoster.`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
        await refreshDashboard();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Sync failed.";
          statusEl.classList.remove("dw-hidden");
          statusEl.classList.add("dw-error");
        }
      }
    });

    document.getElementById("adminDedupeBtn")?.addEventListener("click", async () => {
      const resultEl = document.getElementById("adminDedupeResult");
      try {
        const data = await Admin().dedupeSubmissions();
        if (resultEl) {
          resultEl.textContent = data.message || `Removed ${data.removed || 0} duplicate row(s).`;
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
          statusEl.textContent = `${fixable} row(s) can be fixed; ${unmatched} unmatched; ${data.unchanged || 0} already correct.`;
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

    document.getElementById("adminBulkResetPasswordsBtn")?.addEventListener("click", async () => {
      const statusEl = document.getElementById("adminRosterStatus");
      const classroom = document.getElementById("adminBulkResetClassroom")?.value || "";
      const label = classroom || "all registered students";
      if (!window.confirm(`Reset passwords to SPARK for ${label}? Students can keep SPARK or choose a new password — nothing is blocked.`)) return;
      try {
        const data = await Admin().bulkResetPasswords(classroom);
        if (statusEl) {
          statusEl.textContent = `Reset ${data.reset || 0} password(s) to SPARK. Students will see an optional prompt to change or keep SPARK. ${data.notRegistered || 0} on roster but not registered yet.`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
        await refreshDashboard();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Bulk reset failed.";
          statusEl.classList.remove("dw-hidden");
          statusEl.classList.add("dw-error");
        }
      }
    });

    document.getElementById("adminStudentsList")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-reset-password]");
      if (!btn) return;
      const username = btn.getAttribute("data-reset-password");
      if (!username) return;
      if (!window.confirm(`Reset ${username} to password SPARK? They can keep SPARK or choose a new password.`)) return;
      const statusEl = document.getElementById("adminRosterStatus");
      try {
        await Admin().resetStudentPassword(username);
        if (statusEl) {
          statusEl.textContent = `Reset ${username} to SPARK. They can keep SPARK or choose a new password on next sign-in.`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
        await refreshDashboard();
      } catch (err) {
        if (statusEl) {
          statusEl.textContent = err.message || "Reset failed.";
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
        const entry = await Admin().addRosterEntry(classroom, username);
        if (errEl) errEl.classList.add("dw-hidden");
        if (statusEl) {
          statusEl.textContent = `Added ${entry.username} to ${entry.classroom}. They can sign in with password SPARK.`;
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

    document.getElementById("adminBulkAddRosterForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("adminBulkAddError");
      const statusEl = document.getElementById("adminRosterStatus");
      const classroom = document.getElementById("adminBulkAddClassroom")?.value || "";
      const usernamesText = document.getElementById("adminBulkAddUsernames")?.value || "";
      try {
        const data = await Admin().bulkAddRosterEntries(classroom, usernamesText);
        if (errEl) errEl.classList.add("dw-hidden");
        const added = data.added?.length || 0;
        const skipped = data.skipped?.length || 0;
        if (statusEl) {
          statusEl.textContent = `Added ${added} student(s) to ${classroom.trim()}.${skipped ? ` Skipped ${skipped} duplicate or invalid line(s).` : ""}`;
          statusEl.classList.remove("dw-hidden", "dw-error");
        }
        if (skipped && errEl) {
          errEl.textContent = data.skipped.map((s) => `${s.username}: ${s.error}`).join(" ");
          errEl.classList.remove("dw-hidden");
        }
        document.getElementById("adminBulkAddUsernames").value = "";
        await refreshDashboard();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Bulk add failed.";
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

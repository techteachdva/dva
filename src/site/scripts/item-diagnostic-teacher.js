/**
 * ITEM 2025 Diagnostic — teacher dashboard.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  if (!Core) return;

  const TEACHER_PASSWORD = "studentsfirst";
  const API_URL = "/api/item-diagnostic-submissions";

  const views = {
    welcome: document.getElementById("welcomeView"),
    typing: document.getElementById("typingView"),
    quiz: document.getElementById("quizView"),
    analyzing: document.getElementById("analyzingView"),
    results: document.getElementById("resultsView"),
    teacherLogin: document.getElementById("teacherLoginView"),
    teacher: document.getElementById("teacherView"),
  };

  const VALID_CLASSROOMS = Core.loadJsonScript("itemClassroomsJson", []);
  let classroomCodes = Core.loadJsonScript("itemClassroomCodesJson", {});
  let allSubmissions = [];
  let classFilter = "all";

  const teacherMeta = document.getElementById("teacherMeta");
  const teacherTableBody = document.getElementById("teacherTableBody");
  const emptyState = document.getElementById("emptyState");
  const classFilterEl = document.getElementById("classFilter");
  const detailPanel = document.getElementById("detailPanel");

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function show(name) {
    Core.showView(views, name);
  }

  function formatDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return "—";
    }
  }

  async function fetchSubmissions() {
    const res = await fetch(`${API_URL}?password=${encodeURIComponent(TEACHER_PASSWORD)}`);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Incorrect teacher password.");
    if (!res.ok) {
      if (data.setupRequired) {
        throw new Error(
          "Cloud storage is not set up yet. Deploy google-apps-script/item-diagnostic-backend.gs and set ITEM_DIAGNOSTIC_SCRIPT_URL in Vercel."
        );
      }
      throw new Error(data.error || `Could not load submissions (${res.status})`);
    }
    if (!Array.isArray(data.submissions)) throw new Error("Invalid server response.");
    if (data.classroomCodes && typeof data.classroomCodes === "object") {
      classroomCodes = data.classroomCodes;
    }
    return data.submissions;
  }

  function filteredSubmissions() {
    if (classFilter === "all") return allSubmissions;
    return allSubmissions.filter((s) => s.classroom === classFilter);
  }

  function renderClassCodesPanel() {
    const grid = document.getElementById("classCodesGrid");
    if (!grid) return;
    grid.innerHTML = VALID_CLASSROOMS.map((cls) => `
      <div class="dw-class-code-card">
        <div class="dw-class-code-card__name">${escapeHtml(cls)}</div>
        <code class="dw-class-code-card__code">${escapeHtml(classroomCodes[cls] || "—")}</code>
      </div>`).join("");
  }

  function populateClassFilter() {
    if (!classFilterEl) return;
    const current = classFilterEl.value || "all";
    classFilterEl.innerHTML = `<option value="all">All classes</option>${VALID_CLASSROOMS.map((c) =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
    classFilterEl.value = VALID_CLASSROOMS.includes(current) ? current : "all";
  }

  function renderTeacherTable() {
    const rows = filteredSubmissions();
    if (!teacherTableBody) return;

    if (!rows.length) {
      teacherTableBody.innerHTML = "";
      emptyState?.classList.remove("dw-hidden");
      return;
    }
    emptyState?.classList.add("dw-hidden");

    teacherTableBody.innerHTML = rows.map((sub) => `
      <tr class="dw-table-row--clickable" data-id="${escapeHtml(sub.id)}">
        <td><button class="dw-btn dw-btn-ghost dw-btn--xs" type="button" data-view="${escapeHtml(sub.id)}">View</button></td>
        <td>${escapeHtml(sub.name)}</td>
        <td>${escapeHtml(sub.classroom)}</td>
        <td>${sub.quizScore}/${sub.quizTotal} (${sub.quizPct}%)</td>
        <td>${sub.typingWpm || "—"}</td>
        <td>${sub.gapCount ?? "—"}</td>
        <td class="dw-muted dw-tiny">${escapeHtml(formatDate(sub.submittedAt))}</td>
      </tr>`).join("");

    teacherTableBody.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = allSubmissions.find((s) => s.id === btn.dataset.view);
        if (sub) showDetail(sub);
      });
    });
  }

  function showDetail(sub) {
    if (!detailPanel) return;
    detailPanel.classList.remove("dw-hidden");
    detailPanel.dataset.openId = sub.id;

    document.getElementById("detailName").textContent = `${sub.name} · ${sub.classroom}`;
    document.getElementById("detailSummary").textContent =
      `Knowledge: ${sub.quizScore}/${sub.quizTotal} (${sub.quizPct}%) · Typing: ${sub.typingWpm || "—"} WPM · ${sub.gapCount || 0} standard gap${sub.gapCount === 1 ? "" : "s"}`;

    const standards = Array.isArray(sub.standards) ? sub.standards : [];
    document.getElementById("detailStandards").innerHTML = standards.length
      ? standards.map((s) => `
        <div class="std-card std-card--${escapeHtml(s.level || "developing")}">
          <div class="std-card__code">ITEM ${escapeHtml(s.code)}</div>
          <div class="std-card__title">${escapeHtml(s.title || "Standard")}</div>
          <div class="std-card__score">${s.correct}/${s.total} correct · ${s.pct}%</div>
        </div>`).join("")
      : `<p class="dw-muted">No standards breakdown saved.</p>`;

    const topics = sub.topics && typeof sub.topics === "object" ? sub.topics : {};
    document.getElementById("detailTopics").innerHTML = `
      <div class="dw-score-grid dw-score-grid--4">
        ${Object.entries(topics).map(([t, pair]) => {
          const ok = Array.isArray(pair) ? pair[0] : 0;
          const total = Array.isArray(pair) ? pair[1] : 0;
          return `
            <div class="dw-score-card">
              <div class="dw-score-card__title">${escapeHtml(t.charAt(0).toUpperCase() + t.slice(1))}</div>
              <div class="dw-score-card__value">${total ? Math.round((ok / total) * 100) : 0}%</div>
              <div class="dw-muted dw-tiny">${ok}/${total} correct</div>
            </div>`;
        }).join("")}
      </div>`;

    document.getElementById("detailTyping").textContent = sub.typingText || "(No typing text submitted)";

    const answers = Array.isArray(sub.quizAnswers) ? sub.quizAnswers : [];
    document.getElementById("detailQuiz").innerHTML = answers.length
      ? `<ul class="dw-feedback">${answers.map((a) => `
          <li class="dw-feedback-section">
            <strong>ITEM ${escapeHtml(a.std)}</strong> — ${a.correct ? "Correct" : "Incorrect"}
            <span class="dw-muted dw-tiny">${escapeHtml(a.topic || "")}</span>
          </li>`).join("")}</ul>`
      : `<p class="dw-muted">No quiz answers saved.</p>`;

    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportCsv() {
    const rows = filteredSubmissions();
    if (!rows.length) {
      teacherMeta.textContent = "No submissions to export.";
      return;
    }
    const header = ["id", "submittedAt", "name", "classroom", "quizScore", "quizTotal", "quizPct", "typingWpm", "typingWordCount", "typingLevel", "gapCount"];
    const lines = [header.join(",")];
    for (const sub of rows) {
      lines.push([
        sub.id,
        sub.submittedAt ? new Date(sub.submittedAt).toISOString() : "",
        `"${String(sub.name || "").replace(/"/g, '""')}"`,
        `"${String(sub.classroom || "").replace(/"/g, '""')}"`,
        sub.quizScore,
        sub.quizTotal,
        sub.quizPct,
        sub.typingWpm,
        sub.typingWordCount,
        `"${String(sub.typingLevel || "").replace(/"/g, '""')}"`,
        sub.gapCount,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `item-diagnostic-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function loadTeacherDashboard() {
    teacherMeta.textContent = "Loading submissions…";
    teacherMeta.classList.remove("dw-error");
    try {
      allSubmissions = await fetchSubmissions();
      teacherMeta.textContent = `${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"} loaded.`;
      renderClassCodesPanel();
      populateClassFilter();
      renderTeacherTable();
      show("teacher");
    } catch (err) {
      teacherMeta.textContent = err.message || "Could not load submissions.";
      teacherMeta.classList.add("dw-error");
    }
  }

  function bindEvents() {
    document.getElementById("teacherBtn")?.addEventListener("click", () => show("teacherLogin"));
    document.getElementById("teacherCancelBtn")?.addEventListener("click", () => show("welcome"));

    document.getElementById("teacherLoginBtn")?.addEventListener("click", async () => {
      const pw = document.getElementById("teacherPassword")?.value || "";
      const errEl = document.getElementById("teacherLoginError");
      if (pw !== TEACHER_PASSWORD) {
        errEl?.classList.remove("dw-hidden");
        return;
      }
      errEl?.classList.add("dw-hidden");
      await loadTeacherDashboard();
    });

    document.getElementById("teacherLogoutBtn")?.addEventListener("click", () => {
      allSubmissions = [];
      detailPanel?.classList.add("dw-hidden");
      show("welcome");
    });

    document.getElementById("refreshBtn")?.addEventListener("click", loadTeacherDashboard);
    document.getElementById("exportBtn")?.addEventListener("click", exportCsv);
    document.getElementById("closeDetailBtn")?.addEventListener("click", () => detailPanel?.classList.add("dw-hidden"));

    classFilterEl?.addEventListener("change", () => {
      classFilter = classFilterEl.value || "all";
      renderTeacherTable();
    });
  }

  bindEvents();
  window.ITEMDiagnosticTeacher = { show, loadTeacherDashboard };
})();

/**
 * ITEM 2025 Diagnostic — teacher dashboard.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  if (!Core) return;

  const TEACHER_PASSWORD = "studentsfirst";
  const API_URL = "/api/item-diagnostic-submissions";

  const TYPING_LEVELS = ["intervention", "developing", "proficient", "advanced"];
  const TYPING_LABELS = {
    intervention: "Needs intervention",
    developing: "Developing",
    proficient: "Proficient",
    advanced: "Advanced",
  };
  const TYPING_SHORT = {
    intervention: "Intv",
    developing: "Dev",
    proficient: "Prof",
    advanced: "Adv",
  };
  const TYPING_ORDER = {
    intervention: 0,
    developing: 1,
    proficient: 2,
    advanced: 3,
  };

  const TABLE_COLUMNS = ["name", "classroom", "quiz", "wpm", "typing", "gaps", "gapStandards", "submitted"];
  const HEADER_LABELS = {
    name: "Name",
    classroom: "Class",
    quiz: "Quiz",
    wpm: "WPM",
    typing: "Typing",
    gaps: "Gaps",
    gapStandards: "Standards to teach",
    submitted: "Submitted",
  };

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
  let typingFilter = "all";
  let teacherViewMode = "table";
  let tableSort = { col: "submitted", dir: "desc" };

  const teacherMeta = document.getElementById("teacherMeta");
  const teacherTableHead = document.getElementById("teacherTableHead");
  const teacherTableBody = document.getElementById("teacherTableBody");
  const teacherTableWrap = document.getElementById("teacherTableWrap");
  const teacherGroupsWrap = document.getElementById("teacherGroupsWrap");
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

  function shortClassName(classroom) {
    const c = String(classroom || "—");
    if (c.length <= 16) return c;
    if (c.startsWith("Tech ")) return c.replace("Tech ", "T");
    if (c.startsWith("Mrs. ")) return c.replace("Mrs. ", "M.").replace(" Grade ELA", "");
    return `${c.slice(0, 14)}…`;
  }

  function badgeClass(level) {
    return `dw-badge dw-badge--${level || "developing"}`;
  }

  function typingLabel(level) {
    return TYPING_LABELS[level] || level || "—";
  }

  function getTypingLevel(sub) {
    return sub.typingLevel || sub.typingAnalysis?.typingLevel || "";
  }

  function getGapStandards(sub) {
    const standards = Array.isArray(sub.standards) ? sub.standards : [];
    return standards.filter((s) => s && s.level === "gap");
  }

  function formatGapStandards(sub, max = 3) {
    const gaps = getGapStandards(sub);
    if (!gaps.length) return "—";
    const codes = gaps.map((g) => g.code).filter(Boolean);
    if (codes.length <= max) return codes.map((code) => `ITEM ${code}`).join(", ");
    const shown = codes.slice(0, max).map((code) => `ITEM ${code}`).join(", ");
    return `${shown} +${codes.length - max} more`;
  }

  function defaultSortDir(col) {
    return col === "name" || col === "classroom" || col === "gapStandards" ? "asc" : "desc";
  }

  function getSortValue(sub, col) {
    switch (col) {
      case "name":
        return (sub.name || "").toLowerCase();
      case "classroom":
        return (sub.classroom || "").toLowerCase();
      case "quiz":
        return Number(sub.quizPct) || 0;
      case "wpm":
        return Number(sub.typingWpm) || 0;
      case "typing":
        return TYPING_ORDER[getTypingLevel(sub)] ?? 99;
      case "gaps":
        return Number(sub.gapCount) || 0;
      case "gapStandards":
        return getGapStandards(sub).map((g) => g.code).join(",");
      case "submitted":
        return Number(sub.submittedAt) || 0;
      default:
        return 0;
    }
  }

  function sortSubmissions(rows) {
    const mult = tableSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = getSortValue(a, tableSort.col);
      const bv = getSortValue(b, tableSort.col);
      if (typeof av === "string" && typeof bv === "string") {
        return mult * av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
      }
      return mult * (av - bv);
    });
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
    return allSubmissions.filter((sub) => {
      const classOk = classFilter === "all" || sub.classroom === classFilter;
      const typingOk = typingFilter === "all" || getTypingLevel(sub) === typingFilter;
      return classOk && typingOk;
    });
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
    const classesWithData = [...new Set(allSubmissions.map((s) => s.classroom).filter(Boolean))].sort();
    const options = classesWithData.length ? classesWithData : VALID_CLASSROOMS;
    classFilterEl.innerHTML = `<option value="all">All classes</option>${options.map((c) =>
      `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
    const values = ["all", ...options];
    classFilterEl.value = values.includes(current) ? current : "all";
    classFilter = classFilterEl.value;
  }

  function renderTableHead() {
    if (!teacherTableHead) return;
    const sortIcon = (col) => {
      if (tableSort.col !== col) return "↕";
      return tableSort.dir === "asc" ? "↑" : "↓";
    };
    teacherTableHead.innerHTML = `<tr>
      <th class="dw-col-view" scope="col"></th>
      ${TABLE_COLUMNS.map((col) => {
        const aria = tableSort.col === col ? tableSort.dir === "asc" ? "ascending" : "descending" : "none";
        return `<th scope="col" class="dw-col-${col}" aria-sort="${aria}">
          <button type="button" class="dw-table-sort" data-sort-col="${col}">
            <span class="dw-table-sort__label">${escapeHtml(HEADER_LABELS[col])}</span>
            <span class="dw-table-sort__icon" aria-hidden="true">${sortIcon(col)}</span>
          </button>
        </th>`;
      }).join("")}
    </tr>`;

    teacherTableHead.querySelectorAll("[data-sort-col]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const col = btn.dataset.sortCol;
        if (tableSort.col === col) {
          tableSort.dir = tableSort.dir === "asc" ? "desc" : "asc";
        } else {
          tableSort = { col, dir: defaultSortDir(col) };
        }
        renderTeacherViews();
      });
    });
  }

  function renderTeacherTable() {
    const rows = sortSubmissions(filteredSubmissions());
    if (!teacherTableBody) return;

    if (!rows.length) {
      teacherTableBody.innerHTML = "";
      emptyState?.classList.remove("dw-hidden");
      return;
    }
    emptyState?.classList.add("dw-hidden");

    teacherTableBody.innerHTML = rows.map((sub) => {
      const level = getTypingLevel(sub);
      const gaps = getGapStandards(sub);
      return `
      <tr class="dw-table-row--clickable" data-id="${escapeHtml(sub.id)}">
        <td class="dw-col-view"><button class="dw-btn dw-btn-ghost dw-view-btn dw-view-btn--compact" type="button" data-view="${escapeHtml(sub.id)}">View</button></td>
        <td class="dw-col-name" title="${escapeHtml(sub.name)}">${escapeHtml(sub.name)}</td>
        <td class="dw-col-class" title="${escapeHtml(sub.classroom)}">${escapeHtml(shortClassName(sub.classroom))}</td>
        <td>${sub.quizScore}/${sub.quizTotal} (${sub.quizPct}%)</td>
        <td>${sub.typingWpm || "—"}</td>
        <td><span class="${badgeClass(level)}" title="${escapeHtml(typingLabel(level))}">${TYPING_SHORT[level] || "—"}</span></td>
        <td>${sub.gapCount ?? gaps.length ?? "—"}</td>
        <td title="${escapeHtml(gaps.map((g) => `ITEM ${g.code}: ${g.title || ""}`).join(" · "))}">${escapeHtml(formatGapStandards(sub, 4))}</td>
        <td class="dw-muted dw-tiny">${escapeHtml(formatDate(sub.submittedAt))}</td>
      </tr>`;
    }).join("");

    teacherTableBody.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sub = allSubmissions.find((s) => s.id === btn.dataset.view);
        if (sub) showDetail(sub);
      });
    });

    teacherTableBody.querySelectorAll("tr[data-id]").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const sub = allSubmissions.find((s) => s.id === row.dataset.id);
        if (sub) showDetail(sub);
      });
    });
  }

  function renderTypingBuckets(classSubs) {
    return TYPING_LEVELS.map((level) => {
      const students = classSubs.filter((sub) => getTypingLevel(sub) === level);
      const chips = students.length
        ? students.map((sub) => `<button type="button" class="idt-student-chip" data-view="${escapeHtml(sub.id)}">${escapeHtml(sub.name)}</button>`).join("")
        : `<span class="dw-muted dw-tiny">None</span>`;
      return `
        <div class="idt-typing-bucket">
          <div class="idt-typing-bucket__label">
            <span class="${badgeClass(level)}">${escapeHtml(typingLabel(level))}</span>
            <span class="dw-muted">${students.length}</span>
          </div>
          <div>${chips}</div>
        </div>`;
    }).join("");
  }

  function renderStandardGroups(classSubs) {
    const byStandard = new Map();
    for (const sub of classSubs) {
      for (const gap of getGapStandards(sub)) {
        const key = gap.code || "unknown";
        if (!byStandard.has(key)) {
          byStandard.set(key, { code: gap.code, title: gap.title || "Standard", students: [] });
        }
        byStandard.get(key).students.push(sub);
      }
    }

    const groups = [...byStandard.values()].sort((a, b) => {
      if (b.students.length !== a.students.length) return b.students.length - a.students.length;
      return String(a.code).localeCompare(String(b.code), undefined, { numeric: true });
    });

    if (!groups.length) {
      return `<p class="dw-muted dw-tiny">No major standard gaps in this class on the latest run.</p>`;
    }

    return groups.map((group) => `
      <div class="idt-std-group">
        <div class="idt-std-group__head">
          <span class="idt-std-group__code">ITEM ${escapeHtml(group.code)}</span>
          <span>${escapeHtml(group.title)}</span>
          <span class="dw-muted dw-tiny">${group.students.length} student${group.students.length === 1 ? "" : "s"}</span>
        </div>
        <div>
          ${group.students.map((sub) => `<button type="button" class="idt-student-chip" data-view="${escapeHtml(sub.id)}">${escapeHtml(sub.name)}</button>`).join("")}
        </div>
      </div>`).join("");
  }

  function renderClassGroups() {
    if (!teacherGroupsWrap) return;
    const rows = filteredSubmissions();
    if (!rows.length) {
      teacherGroupsWrap.innerHTML = `<p class="dw-muted dw-center">No submissions match this filter.</p>`;
      return;
    }

    const byClass = new Map();
    for (const sub of rows) {
      const cls = sub.classroom || "Unknown class";
      if (!byClass.has(cls)) byClass.set(cls, []);
      byClass.get(cls).push(sub);
    }

    const classes = [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));

    teacherGroupsWrap.innerHTML = classes.map(([cls, classSubs]) => `
      <section class="dw-card idt-class-group">
        <div class="idt-class-group__head">
          <h3 class="idt-class-group__title">${escapeHtml(cls)}</h3>
          <span class="idt-class-group__count">${classSubs.length} student${classSubs.length === 1 ? "" : "s"}</span>
        </div>
        <div class="idt-class-group__section">
          <h4 class="idt-class-group__section-title">Typing levels</h4>
          <div class="idt-typing-grid">${renderTypingBuckets(classSubs)}</div>
        </div>
        <div class="idt-class-group__section">
          <h4 class="idt-class-group__section-title">Standards to teach</h4>
          ${renderStandardGroups(classSubs)}
        </div>
      </section>`).join("");

    teacherGroupsWrap.querySelectorAll("[data-view]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = allSubmissions.find((s) => s.id === btn.dataset.view);
        if (sub) showDetail(sub);
      });
    });
  }

  function setTeacherViewMode(mode) {
    teacherViewMode = mode === "groups" ? "groups" : "table";
    const tableTab = document.getElementById("teacherTabTable");
    const groupsTab = document.getElementById("teacherTabGroups");
    tableTab?.classList.toggle("dw-teacher-tab--active", teacherViewMode === "table");
    groupsTab?.classList.toggle("dw-teacher-tab--active", teacherViewMode === "groups");
    tableTab?.setAttribute("aria-selected", teacherViewMode === "table" ? "true" : "false");
    groupsTab?.setAttribute("aria-selected", teacherViewMode === "groups" ? "true" : "false");
    teacherTableWrap?.classList.toggle("dw-hidden", teacherViewMode !== "table");
    teacherGroupsWrap?.classList.toggle("dw-hidden", teacherViewMode !== "groups");
    renderTeacherViews();
  }

  function updateTeacherMeta() {
    const rows = filteredSubmissions();
    const typingNote = typingFilter !== "all" ? ` · ${typingLabel(typingFilter)}` : "";
    const classNote = classFilter !== "all" ? ` · ${classFilter}` : "";
    teacherMeta.textContent = `${rows.length} shown of ${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"}${classNote}${typingNote}`;
  }

  function renderTeacherViews() {
    updateTeacherMeta();
    if (teacherViewMode === "groups") {
      renderClassGroups();
      return;
    }
    renderTableHead();
    renderTeacherTable();
  }

  function showDetail(sub) {
    if (!detailPanel) return;
    detailPanel.classList.remove("dw-hidden");
    detailPanel.dataset.openId = sub.id;

    const level = getTypingLevel(sub);
    document.getElementById("detailName").textContent = `${sub.name} · ${sub.classroom}`;
    document.getElementById("detailSummary").textContent =
      `Knowledge: ${sub.quizScore}/${sub.quizTotal} (${sub.quizPct}%) · Typing: ${sub.typingWpm || "—"} WPM (${typingLabel(level)}) · ${sub.gapCount || 0} standard gap${sub.gapCount === 1 ? "" : "s"}`;

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
    const rows = sortSubmissions(filteredSubmissions());
    if (!rows.length) {
      teacherMeta.textContent = "No submissions to export.";
      return;
    }
    const header = ["id", "submittedAt", "name", "classroom", "quizScore", "quizTotal", "quizPct", "typingWpm", "typingWordCount", "typingLevel", "gapCount", "gapStandards"];
    const lines = [header.join(",")];
    for (const sub of rows) {
      const gapCodes = getGapStandards(sub).map((g) => g.code).join("; ");
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
        `"${String(getTypingLevel(sub) || "").replace(/"/g, '""')}"`,
        sub.gapCount ?? getGapStandards(sub).length,
        `"${gapCodes.replace(/"/g, '""')}"`,
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
      renderClassCodesPanel();
      populateClassFilter();
      setTeacherViewMode(teacherViewMode);
      show("teacher");
    } catch (err) {
      teacherMeta.textContent = err.message || "Could not load submissions.";
      teacherMeta.classList.add("dw-error");
    }
  }

  function setTypingFilter(value) {
    typingFilter = value || "all";
    document.querySelectorAll("[data-typing-filter]").forEach((btn) => {
      btn.classList.toggle("dw-filter--active", btn.dataset.typingFilter === typingFilter);
    });
    renderTeacherViews();
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

    document.getElementById("teacherTabTable")?.addEventListener("click", () => setTeacherViewMode("table"));
    document.getElementById("teacherTabGroups")?.addEventListener("click", () => setTeacherViewMode("groups"));

    classFilterEl?.addEventListener("change", () => {
      classFilter = classFilterEl.value || "all";
      renderTeacherViews();
    });

    document.querySelectorAll("[data-typing-filter]").forEach((btn) => {
      btn.addEventListener("click", () => setTypingFilter(btn.dataset.typingFilter));
    });
  }

  bindEvents();
  window.ITEMDiagnosticTeacher = { show, loadTeacherDashboard };
})();

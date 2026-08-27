/**
 * WriteFlow — admin all-results view with fast grading queue.
 */
(() => {
  "use strict";

  const Admin = () => window.WriteFlowAdmin;
  const API_URL = "/api/writeflow-submissions";
  const CHUNK_SIZE = 25;
  const INPUT_DEBOUNCE_MS = 350;

  let allSubmissions = [];
  let filteredSubmissions = [];
  let selectedId = "";
  let tableSort = { col: "submitted", dir: "desc" };
  const configCache = new Map();
  const loadedAssignmentIds = new Set();
  let detailRequestId = 0;
  let gradingQueue = null;
  let inputDebounceTimer = null;
  let skipNextFormCapture = false;

  const TABLE_COLUMNS = ["name", "assignment", "class", "words", "wpm", "typing", "mechanics", "story", "overall", "teacher", "submitted"];
  const HEADER_LABELS = {
    name: "Student",
    assignment: "Assignment",
    class: "Class",
    words: "Wds",
    wpm: "WPM",
    typing: "Typ",
    mechanics: "Mech",
    story: "Story",
    overall: "Auto",
    teacher: "Teacher",
    submitted: "Submitted",
  };

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

  function looksLikeAnalysisJson(text) {
    const s = String(text || "").trim();
    if (!s || s.charAt(0) !== "{") return false;
    return s.includes('"scores"') || s.includes('"feedback"');
  }

  function resolveSubmissionText(sub) {
    if (!sub) return "";
    if (sub.textUnavailable) return "";
    if (sub.text) return String(sub.text);
    const raw = String(sub.textPreview || "").trim();
    if (looksLikeAnalysisJson(raw)) return "";
    return String(sub.textPreview || "");
  }

  function formatDate(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "—";
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const year = String(d.getFullYear()).slice(-2);
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12 || 12;
      const minStr = String(minutes).padStart(2, "0");
      return `${month}/${day}/${year} ${hours}:${minStr}${ampm}`;
    } catch {
      return "—";
    }
  }

  function defaultSortDir(col) {
    return col === "name" || col === "assignment" || col === "class" ? "asc" : "desc";
  }

  function getSortValue(sub, col) {
    switch (col) {
      case "name": return (sub.name || "").toLowerCase();
      case "assignment": return (sub.assignmentTitle || sub.assignmentId || "").toLowerCase();
      case "class": return (sub.classroom || "").toLowerCase();
      case "words": return Number(sub.analysis?.wordCount) || 0;
      case "wpm": return Number(sub.analysis?.wpm) || 0;
      case "typing": return Number(sub.analysis?.scores?.typing ?? -1);
      case "mechanics": return Number(sub.analysis?.scores?.mechanics ?? -1);
      case "story": return Number(sub.analysis?.scores?.story ?? -1);
      case "overall": return Number(sub.analysis?.scores?.overall ?? -1);
      case "teacher": {
        const draft = gradingQueue?.getDraft(sub.id);
        if (draft?.dirty && draft.teacherGrade != null && draft.teacherGrade !== "") {
          return Number(draft.teacherGrade);
        }
        const grade = Number(sub.teacherGrade);
        return Number.isFinite(grade) ? grade : -1;
      }
      case "submitted": return Number(sub.submittedAt) || 0;
      default: return 0;
    }
  }

  function sortSubmissions(subs) {
    const mult = tableSort.dir === "asc" ? 1 : -1;
    return [...subs].sort((a, b) => {
      const av = getSortValue(a, tableSort.col);
      const bv = getSortValue(b, tableSort.col);
      if (typeof av === "string" && typeof bv === "string") {
        return mult * av.localeCompare(bv, undefined, { sensitivity: "base", numeric: true });
      }
      return mult * (av - bv);
    });
  }

  function toggleTableSort(col) {
    if (!col) return;
    if (tableSort.col === col) {
      tableSort.dir = tableSort.dir === "asc" ? "desc" : "asc";
    } else {
      tableSort.col = col;
      tableSort.dir = defaultSortDir(col);
    }
    renderTable();
  }

  function renderTableHead() {
    const thead = document.getElementById("adminResultsTableHead");
    if (!thead) return;
    thead.innerHTML = TABLE_COLUMNS.map((col) => {
      const active = tableSort.col === col;
      const ariaSort = active ? (tableSort.dir === "asc" ? "ascending" : "descending") : "none";
      const icon = active ? (tableSort.dir === "asc" ? "▲" : "▼") : "↕";
      return `<th scope="col" class="dw-col-${col}" aria-sort="${ariaSort}">
        <button type="button" class="dw-table-sort" data-sort-col="${col}">
          <span class="dw-table-sort__label">${escapeHtml(HEADER_LABELS[col])}</span>
          <span class="dw-table-sort__icon" aria-hidden="true">${icon}</span>
        </button>
      </th>`;
    }).join("");
    thead.querySelectorAll("[data-sort-col]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleTableSort(btn.dataset.sortCol);
      });
    });
  }

  function scoreValue(analysis, key) {
    const value = analysis?.scores?.[key];
    return value == null || value === "" ? "—" : value;
  }

  function displayTeacherGrade(sub) {
    const draft = gradingQueue?.getDraft(sub.id);
    if (draft?.dirty) {
      const g = draft.teacherGrade;
      if (g != null && g !== "") return `${g}*`;
    }
    if (sub?.teacherGrade == null || sub.teacherGrade === "") return "—";
    const grade = Number(sub.teacherGrade);
    return Number.isFinite(grade) ? String(grade) : "—";
  }

  function resolveMaxPoints(config) {
    const max = Number(config?.maxPoints);
    return max > 0 ? max : 100;
  }

  function suggestedPointsFromAnalysis(analysis, maxPts) {
    const overall = Number(analysis?.scores?.overall);
    if (!Number.isFinite(overall)) return null;
    return Math.round((overall / 100) * maxPts);
  }

  function currentSubmission() {
    return allSubmissions.find((item) => item.id === selectedId) || null;
  }

  function sortedFilteredSubmissions() {
    return sortSubmissions(filteredSubmissions);
  }

  function setMeta(text, isError = false) {
    const el = document.getElementById("adminResultsMeta");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("dw-error", isError);
  }

  function updateQueueUi() {
    const dirty = gradingQueue?.countDirty() || 0;
    const btn = document.getElementById("adminSaveAllPendingBtn");
    if (btn) {
      btn.disabled = dirty === 0;
      btn.textContent = dirty ? `Save pending (${dirty})` : "Save pending";
    }
  }

  function applyGradingResult(item) {
    const idx = allSubmissions.findIndex((row) => row.id === item.id);
    if (idx < 0) return;
    allSubmissions[idx] = {
      ...allSubmissions[idx],
      teacherGrade: item.teacherGrade,
      teacherFeedback: item.teacherFeedback,
      feedbackVisible: item.feedbackVisible,
      gradedAt: item.gradedAt || Date.now(),
    };
    updateQueueUi();
    updateTeacherCell(allSubmissions[idx]);
  }

  function updateTeacherCell(sub) {
    const row = document.querySelector(`#adminResultsTableBody tr[data-sub-id="${CSS.escape(sub.id)}"]`);
    if (!row) return;
    const cell = row.querySelector(".dw-col-teacher");
    if (cell) {
      cell.textContent = displayTeacherGrade(sub);
      cell.classList.toggle("wf-grade-cell--pending", !!gradingQueue?.isDirty(sub.id));
    }
  }

  function getFilters() {
    return {
      assignmentId: document.getElementById("adminResultsAssignmentFilter")?.value || "",
      classroom: document.getElementById("adminResultsClassroomFilter")?.value || "",
      search: (document.getElementById("adminResultsSearch")?.value || "").trim().toLowerCase(),
    };
  }

  function applyFilters() {
    const { assignmentId, classroom, search } = getFilters();
    filteredSubmissions = allSubmissions.filter((sub) => {
      if (assignmentId && sub.assignmentId !== assignmentId) return false;
      if (classroom && sub.classroom !== classroom) return false;
      if (search) {
        const hay = `${sub.name || ""} ${sub.studentUsername || ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
    if (selectedId && !filteredSubmissions.some((sub) => sub.id === selectedId)) {
      closeDetail();
    }
    renderTable();
    updateMetaCount();
  }

  function updateMetaCount() {
    const total = allSubmissions.length;
    const shown = filteredSubmissions.length;
    if (!total) {
      setMeta("No submissions in the database yet.");
      return;
    }
    if (shown === total) {
      setMeta(`${total} submission${total === 1 ? "" : "s"} across all assignments`);
      return;
    }
    setMeta(`Showing ${shown} of ${total} submissions`);
  }

  function populateFilterOptions() {
    const assignmentSelect = document.getElementById("adminResultsAssignmentFilter");
    const classroomSelect = document.getElementById("adminResultsClassroomFilter");
    if (!assignmentSelect || !classroomSelect) return;

    const currentAssignment = assignmentSelect.value;
    const currentClassroom = classroomSelect.value;

    const assignments = new Map();
    const classrooms = new Set();
    for (const sub of allSubmissions) {
      if (sub.assignmentId) {
        assignments.set(sub.assignmentId, sub.assignmentTitle || sub.assignmentId);
      }
      if (sub.classroom) classrooms.add(sub.classroom);
    }

    const assignmentRows = [...assignments.entries()].sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]), undefined, { sensitivity: "base" })
    );
    assignmentSelect.innerHTML = `<option value="">All assignments</option>${assignmentRows
      .map(([id, title]) => `<option value="${escapeHtml(id)}">${escapeHtml(title)}</option>`)
      .join("")}`;
    assignmentSelect.value = [...assignments.keys()].includes(currentAssignment) ? currentAssignment : "";

    const classroomRows = [...classrooms].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    classroomSelect.innerHTML = `<option value="">All classrooms</option>${classroomRows
      .map((room) => `<option value="${escapeHtml(room)}">${escapeHtml(room)}</option>`)
      .join("")}`;
    classroomSelect.value = classrooms.has(currentClassroom) ? currentClassroom : "";
  }

  function renderTable() {
    const tbody = document.getElementById("adminResultsTableBody");
    if (!tbody) return;

    renderTableHead();

    if (!filteredSubmissions.length) {
      tbody.innerHTML = `<tr><td colspan="${TABLE_COLUMNS.length}" class="dw-muted">No submissions match these filters.</td></tr>`;
      return;
    }

    const subs = sortedFilteredSubmissions();

    tbody.innerHTML = subs.map((sub) => {
      const selected = sub.id === selectedId;
      const pending = gradingQueue?.isDirty(sub.id);
      const assignmentLabel = sub.assignmentTitle || sub.assignmentId || "—";
      return `<tr class="dw-table-row--clickable${selected ? " dw-table-row--selected" : ""}${pending ? " wf-grade-row--pending" : ""}" data-sub-id="${escapeHtml(sub.id)}" tabindex="0">
        <td class="dw-col-name">${escapeHtml(sub.name)}</td>
        <td class="dw-col-assignment"><span class="wf-admin-results__assignment" title="${escapeHtml(sub.assignmentId || "")}">${escapeHtml(assignmentLabel)}</span></td>
        <td class="dw-col-class">${escapeHtml(sub.classroom || "—")}</td>
        <td class="dw-col-words">${sub.analysis?.wordCount ?? "—"}</td>
        <td class="dw-col-wpm">${sub.analysis?.wpm ?? "—"}</td>
        <td class="dw-col-typing">${scoreValue(sub.analysis, "typing")}</td>
        <td class="dw-col-mechanics">${scoreValue(sub.analysis, "mechanics")}</td>
        <td class="dw-col-story">${scoreValue(sub.analysis, "story")}</td>
        <td class="dw-col-overall">${scoreValue(sub.analysis, "overall")}</td>
        <td class="dw-col-teacher wf-grade-cell${pending ? " wf-grade-cell--pending" : ""}">${displayTeacherGrade(sub)}</td>
        <td class="dw-col-submitted">${formatDate(sub.submittedAt)}</td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("tr[data-sub-id]").forEach((row) => {
      const open = () => {
        const sub = subs.find((item) => item.id === row.dataset.subId);
        if (sub) void showDetail(sub);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function readGradingForm() {
    const gradeVal = document.getElementById("adminGradeInput")?.value;
    const teacherGrade = gradeVal === "" ? null : Number(gradeVal);
    return {
      teacherGrade,
      teacherFeedback: document.getElementById("adminFeedbackInput")?.value || "",
      feedbackVisible: document.getElementById("adminFeedbackVisible")?.checked || false,
    };
  }

  function captureCurrentGradingDraft() {
    if (skipNextFormCapture || !selectedId) return;
    const sub = currentSubmission();
    if (!sub) return;
    const form = readGradingForm();
    if (form.teacherGrade != null && (!Number.isFinite(form.teacherGrade) || form.teacherGrade < 0)) return;
    gradingQueue?.stage(sub.id, sub.assignmentId, form);
    applyGradingResult({
      id: sub.id,
      teacherGrade: form.teacherGrade,
      teacherFeedback: form.teacherFeedback,
      feedbackVisible: form.feedbackVisible,
      gradedAt: sub.gradedAt || Date.now(),
    });
    updateQueueUi();
  }

  function scheduleCapture() {
    if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
    inputDebounceTimer = setTimeout(() => {
      captureCurrentGradingDraft();
      const statusEl = document.getElementById("adminGradeStatus");
      if (statusEl && gradingQueue?.isDirty(selectedId)) {
        statusEl.textContent = "Queued — saves automatically";
      }
    }, INPUT_DEBOUNCE_MS);
  }

  function closeDetail() {
    captureCurrentGradingDraft();
    selectedId = "";
    document.getElementById("adminResultsDetail")?.classList.add("wf-admin-results__detail--empty");
    document.getElementById("adminResultsDetailPlaceholder")?.classList.remove("dw-hidden");
    document.getElementById("adminResultsDetailContent")?.classList.add("dw-hidden");
    document.getElementById("adminResultsSplit")?.classList.remove("wf-admin-results__split--detail-open");
    const statusEl = document.getElementById("adminGradeStatus");
    if (statusEl) statusEl.textContent = "";
    renderTable();
  }

  async function ensureFullText(sub) {
    if (!sub) return sub;
    if (sub.text && !sub.textTruncated) return sub;
    if (sub.textPreview && !sub.textTruncated) {
      sub.text = sub.textPreview;
      return sub;
    }
    const assignmentId = String(sub.assignmentId || "").trim();
    if (!assignmentId || loadedAssignmentIds.has(assignmentId)) {
      return allSubmissions.find((item) => item.id === sub.id) || sub;
    }
    try {
      const items = await Admin().listAssignmentSubmissions(assignmentId);
      loadedAssignmentIds.add(assignmentId);
      for (const item of items) {
        const idx = allSubmissions.findIndex((row) => row.id === item.id);
        if (idx < 0) continue;
        allSubmissions[idx] = {
          ...allSubmissions[idx],
          ...item,
          assignmentTitle: allSubmissions[idx].assignmentTitle || item.assignmentTitle,
          textTruncated: false,
        };
      }
    } catch (err) {
      console.error("Could not load full drafts for", assignmentId, err);
    }
    return allSubmissions.find((item) => item.id === sub.id) || sub;
  }

  function fillGradingForm(sub, config) {
    const maxPts = resolveMaxPoints(config);
    const suggested = suggestedPointsFromAnalysis(sub.analysis, maxPts);
    const draft = gradingQueue?.getDraft(sub.id);
    const gradeInput = document.getElementById("adminGradeInput");
    const feedbackInput = document.getElementById("adminFeedbackInput");
    const visibleInput = document.getElementById("adminFeedbackVisible");
    const hint = document.getElementById("adminGradingHint");
    const notice = document.getElementById("adminResultsGradingNotice");
    const statusEl = document.getElementById("adminGradeStatus");

    skipNextFormCapture = true;
    if (gradeInput) {
      gradeInput.max = String(maxPts);
      if (draft?.dirty) {
        gradeInput.value = draft.teacherGrade != null ? String(draft.teacherGrade) : "";
      } else {
        gradeInput.value = sub.teacherGrade != null ? String(sub.teacherGrade) : (suggested != null ? String(suggested) : "");
      }
    }
    if (feedbackInput) {
      feedbackInput.value = draft?.dirty ? (draft.teacherFeedback || "") : (sub.teacherFeedback || "");
    }
    if (visibleInput) {
      if (draft?.dirty) {
        visibleInput.checked = !!draft.feedbackVisible;
      } else {
        visibleInput.checked = sub.gradedAt
          ? !!sub.feedbackVisible
          : !!(config.autoReleaseFeedback || sub.feedbackVisible);
      }
    }
    if (hint) {
      hint.textContent = suggested != null
        ? `Suggested ${suggested}/${maxPts} from auto score (${sub.analysis?.scores?.overall ?? "—"}/100). Override anytime — students see this when you release feedback.`
        : `Out of ${maxPts} points. Students see this when you release feedback.`;
    }
    if (notice) {
      if (config.gradingEnabled === false) {
        notice.classList.remove("dw-hidden");
        notice.textContent = "This assignment does not have points & feedback enabled in Studio yet. You can still save a grade here; students will see it after that option is turned on.";
      } else {
        notice.classList.add("dw-hidden");
        notice.textContent = "";
      }
    }
    if (statusEl) {
      statusEl.textContent = draft?.dirty ? "Queued — saves automatically" : "";
    }
    skipNextFormCapture = false;
  }

  function fillDraft(sub) {
    const draftEl = document.getElementById("adminResultsDraft");
    const noteEl = document.getElementById("adminResultsDraftNote");
    const storyText = resolveSubmissionText(sub);
    if (draftEl) {
      draftEl.textContent = storyText;
      draftEl.classList.toggle("dw-hidden", !storyText);
    }
    if (noteEl) {
      if (sub.textUnavailable) {
        noteEl.classList.remove("dw-hidden");
        noteEl.textContent = "Student text is unavailable for this submission (overwritten by an earlier Re-analyze bug). Restore from Google Sheets version history if needed, or open Results in Studio.";
      } else if (sub.textTruncated && storyText) {
        noteEl.classList.remove("dw-hidden");
        noteEl.textContent = "Preview only — full draft could not be loaded. Open assignment Results in Studio if you need the complete text.";
      } else {
        noteEl.classList.add("dw-hidden");
        noteEl.textContent = "";
      }
    }
  }

  function navigateSubmission(delta) {
    const subs = sortedFilteredSubmissions();
    if (!subs.length) return;
    const idx = subs.findIndex((sub) => sub.id === selectedId);
    const nextIdx = idx < 0 ? (delta > 0 ? 0 : subs.length - 1) : Math.max(0, Math.min(subs.length - 1, idx + delta));
    if (subs[nextIdx]) void showDetail(subs[nextIdx]);
  }

  async function showDetail(sub) {
    captureCurrentGradingDraft();
    const req = ++detailRequestId;
    selectedId = sub.id;
    const panel = document.getElementById("adminResultsDetail");
    const placeholder = document.getElementById("adminResultsDetailPlaceholder");
    const content = document.getElementById("adminResultsDetailContent");
    if (!panel || !placeholder || !content) return;

    panel.classList.remove("wf-admin-results__detail--empty");
    placeholder.classList.add("dw-hidden");
    content.classList.remove("dw-hidden");
    document.getElementById("adminResultsSplit")?.classList.add("wf-admin-results__split--detail-open");
    renderTable();

    const studioUrl = sub.assignmentId
      ? `/writeflow/studio/?id=${encodeURIComponent(sub.assignmentId)}&teacher=1`
      : "/writeflow/studio/";
    const studioLink = document.getElementById("adminResultsStudioLink");
    if (studioLink) studioLink.href = studioUrl;

    const meta = document.getElementById("adminResultsDetailMeta");
    const assignmentEl = document.getElementById("adminResultsDetailAssignment");
    const scoresEl = document.getElementById("adminResultsDetailScores");
    if (meta) {
      meta.innerHTML = `<strong>${escapeHtml(sub.name)}</strong> · ${escapeHtml(sub.classroom || "No class")} · ${formatDate(sub.submittedAt)}`;
    }
    if (assignmentEl) {
      assignmentEl.innerHTML = `Assignment: <strong>${escapeHtml(sub.assignmentTitle || sub.assignmentId || "—")}</strong>`;
    }
    if (scoresEl) {
      scoresEl.textContent = `Auto ${scoreValue(sub.analysis, "overall")} · Typ ${scoreValue(sub.analysis, "typing")} · Mech ${scoreValue(sub.analysis, "mechanics")} · Story ${scoreValue(sub.analysis, "story")} · Teacher ${displayTeacherGrade(sub)}`;
    }

    const cachedCfg = configCache.get(String(sub.assignmentId || "").trim()) || {};
    fillGradingForm(sub, cachedCfg);
    fillDraft(sub);

    const [cfg] = await Promise.all([
      fetchAssignmentConfig(sub.assignmentId),
      ensureFullText(sub),
    ]);
    if (req !== detailRequestId) return;

    const current = currentSubmission() || sub;
    if (scoresEl) {
      scoresEl.textContent = `Auto ${scoreValue(current.analysis, "overall")} · Typ ${scoreValue(current.analysis, "typing")} · Mech ${scoreValue(current.analysis, "mechanics")} · Story ${scoreValue(current.analysis, "story")} · Teacher ${displayTeacherGrade(current)}`;
    }
    const active = document.activeElement;
    const editingGrade = active && (active.id === "adminGradeInput" || active.id === "adminFeedbackInput" || active.id === "adminFeedbackVisible");
    if (!editingGrade) fillGradingForm(current, cfg || {});
    fillDraft(current);
    renderTable();
    document.getElementById("adminGradeInput")?.focus();
  }

  async function saveAndNext() {
    captureCurrentGradingDraft();
    const sub = currentSubmission();
    if (!sub) return;
    const statusEl = document.getElementById("adminGradeStatus");
    if (statusEl) statusEl.textContent = "Saving…";
    await gradingQueue?.flush();
    if (statusEl) statusEl.textContent = "";
    navigateSubmission(1);
  }

  async function fetchAssignmentConfig(assignmentId) {
    const key = String(assignmentId || "").trim();
    if (!key) return null;
    if (configCache.has(key)) return configCache.get(key);
    try {
      const res = await fetch(`${API_URL}?action=getAssignment&assignmentId=${encodeURIComponent(key)}`);
      const data = await res.json().catch(() => ({}));
      const config = data.config && typeof data.config === "object" ? data.config : {};
      configCache.set(key, config);
      return config;
    } catch {
      configCache.set(key, {});
      return {};
    }
  }

  async function prefetchAssignmentConfigs() {
    const ids = [...new Set(allSubmissions.map((sub) => String(sub.assignmentId || "").trim()).filter(Boolean))];
    await Promise.all(ids.map((id) => fetchAssignmentConfig(id)));
  }

  function reanalyzeOptions(config, sub) {
    const cfg = config || {};
    const ItemStd = window.WriteFlowItemStandards;
    const standards = Array.isArray(cfg.teachingStandards) ? cfg.teachingStandards : [];
    return {
      vocabWords: Array.isArray(cfg.vocabWords) ? cfg.vocabWords : [],
      assignmentMode: cfg.assignmentMode || "composition",
      rubrics: Array.isArray(cfg.rubrics) ? cfg.rubrics : ["mechanics", "story"],
      teachingStandards: ItemStd?.resolveAttachedList ? ItemStd.resolveAttachedList(standards) : standards,
      assignmentPrompt: cfg.prompt || cfg.promptBanner || "",
      classroom: sub?.classroom || "",
    };
  }

  async function loadSubmissions() {
    const refreshBtn = document.getElementById("adminResultsRefreshBtn");
    const reanalyzeBtn = document.getElementById("adminResultsReanalyzeBtn");
    refreshBtn && (refreshBtn.disabled = true);
    reanalyzeBtn && (reanalyzeBtn.disabled = true);
    setMeta("Loading submissions…");
    try {
      allSubmissions = await Admin().listAllSubmissions();
      loadedAssignmentIds.clear();
      populateFilterOptions();
      applyFilters();
      void prefetchAssignmentConfigs();
    } catch (err) {
      allSubmissions = [];
      filteredSubmissions = [];
      renderTable();
      setMeta(err.message || "Could not load submissions.", true);
    } finally {
      refreshBtn && (refreshBtn.disabled = false);
      reanalyzeBtn && (reanalyzeBtn.disabled = false);
    }
  }

  async function reanalyzeAll() {
    if (!allSubmissions.length) {
      setMeta("No submissions to re-analyze.");
      return;
    }
    const confirmed = window.confirm(
      `Re-analyze all ${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"} with the current rubric?\n\nStudent text is not changed — only scores and analysis data are updated. Teacher grades and feedback are not changed.`
    );
    if (!confirmed) return;

    const analyzeFn = window.WriteAnalysis?.analyzeText;
    if (!analyzeFn) {
      setMeta("Analysis engine not loaded.", true);
      return;
    }

    const refreshBtn = document.getElementById("adminResultsRefreshBtn");
    const reanalyzeBtn = document.getElementById("adminResultsReanalyzeBtn");
    refreshBtn && (refreshBtn.disabled = true);
    reanalyzeBtn && (reanalyzeBtn.disabled = true);

    let saved = 0;
    let fail = 0;
    let firstError = "";
    const pendingByAssignment = new Map();

    for (let i = 0; i < allSubmissions.length; i++) {
      const sub = allSubmissions[i];
      setMeta(`Scoring ${i + 1} of ${allSubmissions.length}…`);
      const assignmentId = String(sub.assignmentId || "").trim();
      if (!assignmentId) {
        fail++;
        if (!firstError) firstError = "Missing assignment ID";
        continue;
      }
      try {
        const cfg = await fetchAssignmentConfig(assignmentId);
        const analysis = analyzeFn(sub.text || "", Number(sub.durationSec) || 300, reanalyzeOptions(cfg, sub));
        sub.analysis = analysis;
        const bucket = pendingByAssignment.get(assignmentId) || [];
        bucket.push({ id: String(sub.id || "").trim(), analysis });
        pendingByAssignment.set(assignmentId, bucket);
      } catch (err) {
        console.error("Re-analyze failed for", sub.id, err);
        fail++;
        if (!firstError) firstError = err.message || "Scoring failed";
      }
    }

    const assignmentIds = [...pendingByAssignment.keys()];
    for (let a = 0; a < assignmentIds.length; a++) {
      const assignmentId = assignmentIds[a];
      const updates = pendingByAssignment.get(assignmentId) || [];
      for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
        const chunk = updates.slice(i, i + CHUNK_SIZE);
        setMeta(`Saving assignment ${a + 1} of ${assignmentIds.length} (${Math.min(i + chunk.length, updates.length)}/${updates.length})…`);
        try {
          const result = await Admin().reanalyzeBulk(assignmentId, chunk);
          saved += result.updated || 0;
          const chunkFail = chunk.length - (result.updated || 0);
          fail += chunkFail;
          if (result.errors?.length && !firstError) {
            firstError = result.errors[0].error || "Update failed";
          }
        } catch (err) {
          console.error("Bulk save failed:", err);
          fail += chunk.length;
          if (!firstError) firstError = err.message || "Could not save to Google Sheets";
        }
      }
    }

    refreshBtn && (refreshBtn.disabled = false);
    reanalyzeBtn && (reanalyzeBtn.disabled = false);
    applyFilters();
    if (fail) {
      setMeta(`Re-analyzed ${saved} submission${saved === 1 ? "" : "s"}; ${fail} failed.${firstError ? ` ${firstError}` : ""}`, true);
      return;
    }
    setMeta(`Re-analyzed ${saved} submission${saved === 1 ? "" : "s"} successfully.`);
  }

  function initGradingQueue() {
    if (!window.WriteFlowGradingQueue) return;
    gradingQueue = window.WriteFlowGradingQueue.createGradingQueue({
      storageKey: "writeflow:gradingPending:admin",
      saveBulk: (grades) => Admin().saveGradesBulk(grades),
      onStatus: (text, isError) => {
        const el = document.getElementById("adminGradingQueueStatus");
        if (el) {
          el.textContent = text || "";
          el.classList.toggle("dw-error", !!isError);
        }
        updateQueueUi();
      },
      onApplied: applyGradingResult,
    });
    updateQueueUi();
  }

  function bindGradingInputs() {
    for (const id of ["adminGradeInput", "adminFeedbackInput", "adminFeedbackVisible"]) {
      document.getElementById(id)?.addEventListener("input", scheduleCapture);
      document.getElementById(id)?.addEventListener("change", scheduleCapture);
    }
  }

  function bindKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (!selectedId) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const inField = tag === "input" || tag === "textarea" || tag === "select";
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        void saveAndNext();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        captureCurrentGradingDraft();
        void gradingQueue?.flush();
        return;
      }
      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        navigateSubmission(1);
        return;
      }
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        navigateSubmission(-1);
        return;
      }
      if (!inField && e.key === "j") {
        e.preventDefault();
        navigateSubmission(1);
      }
      if (!inField && e.key === "k") {
        e.preventDefault();
        navigateSubmission(-1);
      }
    });
  }

  async function init() {
    if (!Admin()) return;

    await Admin().validate();
    if (!Admin().isLoggedIn()) {
      show("adminResultsSignedOut", true);
      show("adminResultsSignedIn", false);
      setMeta("Admin sign-in required.");
      return;
    }

    show("adminResultsSignedOut", false);
    show("adminResultsSignedIn", true);
    initGradingQueue();

    document.getElementById("adminResultsRefreshBtn")?.addEventListener("click", () => void loadSubmissions());
    document.getElementById("adminResultsReanalyzeBtn")?.addEventListener("click", () => void reanalyzeAll());
    document.getElementById("adminResultsDetailClose")?.addEventListener("click", closeDetail);
    document.getElementById("adminPrevSubmissionBtn")?.addEventListener("click", () => navigateSubmission(-1));
    document.getElementById("adminNextSubmissionBtn")?.addEventListener("click", () => navigateSubmission(1));
    document.getElementById("adminResultsAssignmentFilter")?.addEventListener("change", applyFilters);
    document.getElementById("adminResultsClassroomFilter")?.addEventListener("change", applyFilters);
    document.getElementById("adminResultsSearch")?.addEventListener("input", applyFilters);
    document.getElementById("adminGradeSaveBtn")?.addEventListener("click", () => void saveAndNext());
    document.getElementById("adminSaveAllPendingBtn")?.addEventListener("click", () => {
      captureCurrentGradingDraft();
      void gradingQueue?.flush();
    });

    bindGradingInputs();
    bindKeyboardShortcuts();

    window.addEventListener("beforeunload", (e) => {
      if ((gradingQueue?.countDirty() || 0) > 0) {
        captureCurrentGradingDraft();
        e.preventDefault();
        e.returnValue = "";
      }
    });

    await loadSubmissions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();

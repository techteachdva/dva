/**
 * WriteFlow — admin all-results view.
 */
(() => {
  "use strict";

  const Admin = () => window.WriteFlowAdmin;
  const API_URL = "/api/writeflow-submissions";
  const CHUNK_SIZE = 25;

  let allSubmissions = [];
  let filteredSubmissions = [];
  let selectedId = "";
  const configCache = new Map();

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

  function formatDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch {
      return "—";
    }
  }

  function scoreValue(analysis, key) {
    const value = analysis?.scores?.[key];
    return value == null || value === "" ? "—" : value;
  }

  function setMeta(text, isError = false) {
    const el = document.getElementById("adminResultsMeta");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("dw-error", isError);
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

    if (!filteredSubmissions.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="dw-muted">No submissions match these filters.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredSubmissions.map((sub) => {
      const selected = sub.id === selectedId;
      const assignmentLabel = sub.assignmentTitle || sub.assignmentId || "—";
      return `<tr class="dw-table-row--clickable${selected ? " dw-table-row--selected" : ""}" data-sub-id="${escapeHtml(sub.id)}" tabindex="0">
        <td>${escapeHtml(sub.name)}</td>
        <td><span class="wf-admin-results__assignment" title="${escapeHtml(sub.assignmentId || "")}">${escapeHtml(assignmentLabel)}</span></td>
        <td>${escapeHtml(sub.classroom || "—")}</td>
        <td>${sub.analysis?.wordCount ?? "—"}</td>
        <td>${sub.analysis?.wpm ?? "—"}</td>
        <td>${scoreValue(sub.analysis, "typing")}</td>
        <td>${scoreValue(sub.analysis, "mechanics")}</td>
        <td>${scoreValue(sub.analysis, "story")}</td>
        <td>${scoreValue(sub.analysis, "overall")}</td>
        <td>${formatDate(sub.submittedAt)}</td>
      </tr>`;
    }).join("");

    tbody.querySelectorAll("tr[data-sub-id]").forEach((row) => {
      const open = () => {
        const sub = filteredSubmissions.find((item) => item.id === row.dataset.subId);
        if (sub) showDetail(sub);
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

  function closeDetail() {
    selectedId = "";
    document.getElementById("adminResultsDetail")?.classList.add("wf-admin-results__detail--empty");
    document.getElementById("adminResultsDetailPlaceholder")?.classList.remove("dw-hidden");
    document.getElementById("adminResultsDetailContent")?.classList.add("dw-hidden");
    document.getElementById("adminResultsSplit")?.classList.remove("wf-admin-results__split--detail-open");
    renderTable();
  }

  function showDetail(sub) {
    selectedId = sub.id;
    const panel = document.getElementById("adminResultsDetail");
    const placeholder = document.getElementById("adminResultsDetailPlaceholder");
    const content = document.getElementById("adminResultsDetailContent");
    if (!panel || !placeholder || !content) return;

    panel.classList.remove("wf-admin-results__detail--empty");
    placeholder.classList.add("dw-hidden");
    content.classList.remove("dw-hidden");
    document.getElementById("adminResultsSplit")?.classList.add("wf-admin-results__split--detail-open");

    const studioUrl = sub.assignmentId
      ? `/writeflow/studio/?id=${encodeURIComponent(sub.assignmentId)}&teacher=1`
      : "/writeflow/studio/";
    content.innerHTML = `
      <p class="dw-muted wf-admin-results__detail-meta">
        <strong>${escapeHtml(sub.name)}</strong> · ${escapeHtml(sub.classroom || "No class")} · ${formatDate(sub.submittedAt)}
      </p>
      <p class="dw-muted dw-tiny">
        Assignment: <strong>${escapeHtml(sub.assignmentTitle || sub.assignmentId || "—")}</strong>
        (<code>${escapeHtml(sub.assignmentId || "")}</code>)
      </p>
      <p class="dw-muted dw-tiny">Scores — Typ ${scoreValue(sub.analysis, "typing")} · Mech ${scoreValue(sub.analysis, "mechanics")} · Story ${scoreValue(sub.analysis, "story")} · Overall ${scoreValue(sub.analysis, "overall")}</p>
      <p><a class="dw-link" href="${escapeHtml(studioUrl)}" target="_blank" rel="noopener noreferrer">Open assignment results in Studio ↗</a></p>
      <pre class="wf-admin-results__draft">${escapeHtml(sub.text || "")}</pre>`;

    renderTable();
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
      populateFilterOptions();
      applyFilters();
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
      `Re-analyze all ${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"} with the current rubric?\n\nStudent text is not changed — only scores and analysis data are updated.`
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

    document.getElementById("adminResultsRefreshBtn")?.addEventListener("click", () => void loadSubmissions());
    document.getElementById("adminResultsReanalyzeBtn")?.addEventListener("click", () => void reanalyzeAll());
    document.getElementById("adminResultsDetailClose")?.addEventListener("click", closeDetail);
    document.getElementById("adminResultsAssignmentFilter")?.addEventListener("change", applyFilters);
    document.getElementById("adminResultsClassroomFilter")?.addEventListener("change", applyFilters);
    document.getElementById("adminResultsSearch")?.addEventListener("input", applyFilters);

    await loadSubmissions();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void init());
  } else {
    void init();
  }
})();

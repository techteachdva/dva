/**
 * WriteFlow Studio — configurable writing submission tool.
 * Student test flow + teacher builder GUI.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  const Defaults = window.WriteFlowDefaults?.DEFAULT_ASSIGNMENT;
  const STORAGE_PREFIX = "writeflow";
  const ASSIGNMENTS_KEY = "writeflow:assignments";
  const API_URL = "/api/writeflow-submissions";

  if (!Core || !Defaults) return;

  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") === "builder" ? "builder" : "student";
  const assignmentId = params.get("id") || "sample-persuasive";

  let config = Core.loadConfig(STORAGE_PREFIX, assignmentId, { ...Defaults, id: assignmentId });
  let timer = null;
  let allSubmissions = [];
  let teacherAuthed = false;

  const VALID_CLASSROOMS = Core.loadJsonScript("wfClassroomsJson", []);
  const CLASSROOM_CODES = Core.loadJsonScript("wfClassroomCodesJson", {});

  const shell = document.querySelector(".dw-shell");
  const views = {
    home: document.getElementById("wfHomeView"),
    welcome: document.getElementById("welcomeView"),
    writing: document.getElementById("writingView"),
    analyzing: document.getElementById("analyzingView"),
    results: document.getElementById("resultsView"),
    builder: document.getElementById("builderView"),
    teacherLogin: document.getElementById("teacherLoginView"),
    teacher: document.getElementById("teacherView"),
  };

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function applyConfigToUI() {
    Core.applyTheme(Core.resolveTheme(config));
    document.title = config.title + " · WriteFlow";
    const titleEl = document.getElementById("appTitle");
    const subEl = document.getElementById("appSubtitle");
    if (titleEl) titleEl.textContent = config.title;
    if (subEl) subEl.textContent = config.subtitle;

    const welcomeTitle = document.getElementById("welcomeTitle");
    const welcomeLead = document.getElementById("welcomeLead");
    if (welcomeTitle) welcomeTitle.textContent = config.welcomeTitle || config.title;
    if (welcomeLead) welcomeLead.innerHTML = config.welcomeLead || "";

    const promptQuote = document.getElementById("promptQuote");
    if (promptQuote) promptQuote.textContent = config.prompt;

    const promptBanner = document.getElementById("promptBanner");
    if (promptBanner) promptBanner.innerHTML = `<strong>Prompt:</strong> ${escapeHtml(config.promptBanner || config.prompt)}`;

    const checklist = document.getElementById("checklist");
    if (checklist) {
      checklist.innerHTML = (config.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    }

    const rubricGrid = document.getElementById("rubricGrid");
    if (rubricGrid && config.measureCategories) {
      rubricGrid.innerHTML = config.measureCategories.map((c) => `
        <div class="dw-rubric">
          <h3 class="dw-h3">${escapeHtml(c.icon)} ${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.desc)}</p>
        </div>`).join("");
    }

    const startBtn = document.getElementById("startBtn");
    if (startBtn) {
      const mins = Math.floor(config.durationSec / 60);
      const secs = config.durationSec % 60;
      const label = secs ? `${mins}:${String(secs).padStart(2, "0")}` : `${mins} minute${mins === 1 ? "" : "s"}`;
      startBtn.textContent = `Start ${label} timer`;
    }

    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) timerDisplay.textContent = Core.formatTime(config.durationSec);

    const classCodeField = document.getElementById("classCodeField");
    if (classCodeField) classCodeField.classList.toggle("dw-hidden", !config.requireClassCode);

    const heroImg = document.getElementById("heroImage");
    const heroSrc = config.heroImageData || config.heroImage;
    if (heroImg && heroSrc) {
      heroImg.src = heroSrc;
      heroImg.classList.remove("dw-hidden");
    } else if (heroImg) {
      heroImg.classList.add("dw-hidden");
    }
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Please choose an image file (JPG, PNG, GIF, or WebP)."));
        return;
      }
      if (file.size > 750000) {
        reject(new Error("Image must be under 750 KB for storage in assignment config."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function show(name) {
    Core.showView(views, name, shell, "teacher");
  }

  function canStart() {
    const nameOk = !config.requireName || document.getElementById("studentName")?.value.trim();
    const classEl = document.getElementById("studentClass");
    const classroom = config.requireClass ? Core.resolveClassroom(classEl?.value, VALID_CLASSROOMS) : true;
    const codeOk = !config.requireClassCode || Core.verifyClassroomCode(classroom, document.getElementById("classCode")?.value, CLASSROOM_CODES);
    return Boolean(nameOk && classroom && codeOk);
  }

  function updateStartButton() {
    const btn = document.getElementById("startBtn");
    if (btn) btn.disabled = !canStart();
    const classEl = document.getElementById("studentClass");
    const classroom = Core.resolveClassroom(classEl?.value, VALID_CLASSROOMS);
    const code = document.getElementById("classCode")?.value || "";
    const err = document.getElementById("classCodeError");
    if (err) {
      const show = config.requireClassCode && classroom && code && !Core.verifyClassroomCode(classroom, code, CLASSROOM_CODES);
      err.classList.toggle("dw-hidden", !show);
    }
  }

  function finishWriting() {
    const storyInput = document.getElementById("storyInput");
    if (storyInput && config.lockAfterTime) storyInput.readOnly = true;
    if (timer) timer.stop();
    show("analyzing");
    void showResults(storyInput?.value || "");
  }

  async function showResults(text) {
    const duration = Math.min(Math.max(timer?.getElapsed() || config.durationSec, 1), config.durationSec);
    const analysis = window.WriteAnalysis?.analyzeText(text, duration) || { scores: {}, wordCount: 0, wpm: 0, feedback: [] };
    const name = document.getElementById("studentName")?.value.trim() || "Student";
    const classEl = document.getElementById("studentClass");
    const classroom = Core.resolveClassroom(classEl?.value, VALID_CLASSROOMS) || "";
    const classCode = document.getElementById("classCode")?.value || "";

    document.getElementById("resultName").textContent = name;
    document.getElementById("resultClass").textContent = classroom || "—";
    document.getElementById("resultSummary").textContent =
      `You wrote ${analysis.wordCount} words in ${Core.formatTime(duration)} (${analysis.wpm} WPM). Overall: ${analysis.scores?.overall ?? "—"}/100`;

    const R = window.DWRubrics;
    const scoreGrid = document.getElementById("scoreGrid");
    if (scoreGrid && R) {
      scoreGrid.innerHTML = R.studentScoreCards(analysis).map((c) => `
        <div class="dw-score-card dw-band--${c.band.level}">
          <div class="dw-score-card__title">${escapeHtml(c.title)}</div>
          <div class="dw-score-card__value">${c.score}</div>
          <div class="dw-score-card__band">${escapeHtml(c.band.label)}</div>
        </div>`).join("");
    }

    const feedbackList = document.getElementById("feedbackList");
    if (feedbackList) {
      feedbackList.innerHTML = (analysis.feedback || []).map((sec) => `
        <li><strong>${escapeHtml(sec.title)}</strong><ul>${sec.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></li>`).join("");
    }

    document.getElementById("storyPreview").textContent = text;
    document.getElementById("scoreLegend")?.classList.remove("dw-hidden");

    let saveOk = false;
    let saveError = "";
    if (config.requireClass && !classroom) {
      saveError = "Your class was not recognized. Go back and pick your class from the list.";
    } else if (config.requireClassCode && classroom && !Core.verifyClassroomCode(classroom, classCode, CLASSROOM_CODES)) {
      saveError = "Your class code did not match. Check with your teacher.";
    } else {
      try {
        await submitResult(name, classroom, classCode, text, analysis, duration);
        saveOk = true;
        saveLocalSubmission({ name, classroom, text, analysis, submittedAt: Date.now() });
      } catch (err) {
        saveError = err.message || "Could not save your submission.";
        saveLocalSubmission({ name, classroom, text, analysis, submittedAt: Date.now() });
      }
    }

    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.classList.remove("dw-hidden", "dw-save-status--ok", "dw-save-status--error");
      if (saveOk) {
        saveStatus.textContent = "Saved to your class roster. Your teacher can view this from any computer.";
        saveStatus.classList.add("dw-save-status--ok");
      } else {
        saveStatus.textContent = saveError || "Could not save to the class roster.";
        saveStatus.classList.add("dw-save-status--error");
      }
    }

    show("results");
  }

  async function submitResult(name, classroom, classCode, text, analysis, durationSec) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignmentId: config.id,
        name,
        classroom,
        classCode,
        text,
        analysis,
        durationSec,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.setupRequired) {
        throw new Error("Results could not be saved online. Your teacher may need to finish setup.");
      }
      throw new Error(data.error || `Save failed (${res.status})`);
    }
    return data;
  }

  async function registerAssignmentCloud() {
    try {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "registerAssignment",
          assignmentId: config.id,
          teacherPassword: config.teacherPassword,
          title: config.title,
        }),
      });
    } catch {
      /* optional — builder still works offline */
    }
  }

  function saveLocalSubmission(entry) {
    const key = `writeflow:submissions:${config.id}`;
    let subs = [];
    try { subs = JSON.parse(localStorage.getItem(key) || "[]"); } catch { subs = []; }
    subs.push(entry);
    localStorage.setItem(key, JSON.stringify(subs));
  }

  function loadLocalSubmissions() {
    const key = `writeflow:submissions:${config.id}`;
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  }

  async function fetchSubmissions() {
    const pw = document.getElementById("teacherPassword")?.value || config.teacherPassword;
    const res = await fetch(
      `${API_URL}?password=${encodeURIComponent(pw)}&assignmentId=${encodeURIComponent(config.id)}`
    );
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error("Incorrect teacher password for this assignment.");
    if (!res.ok) {
      if (data.setupRequired) {
        throw new Error("Results are saved on this device only until online storage is connected.");
      }
      throw new Error(data.error || `Could not load submissions (${res.status})`);
    }
    return Array.isArray(data.submissions) ? data.submissions : [];
  }

  function initStudentFlow() {
    Core.populateClassSelect(document.getElementById("studentClass"), VALID_CLASSROOMS);
    applyConfigToUI();

    const storyInput = document.getElementById("storyInput");
    Core.setupPasteControl(storyInput, config.allowPaste);

    timer = Core.createTimer({
      durationSec: config.durationSec,
      displayEl: document.getElementById("timerDisplay"),
      progressEl: document.getElementById("timerProgress"),
      onComplete: finishWriting,
    });

    Core.setupLiveStats(storyInput, document.getElementById("liveWordCount"), document.getElementById("liveWpm"), () => timer?.getElapsed() || 0);

    document.getElementById("studentName")?.addEventListener("input", updateStartButton);
    document.getElementById("studentClass")?.addEventListener("change", updateStartButton);
    document.getElementById("classCode")?.addEventListener("input", updateStartButton);

    document.getElementById("startBtn")?.addEventListener("click", () => {
      if (!canStart()) return;
      storyInput.value = "";
      storyInput.readOnly = false;
      show("writing");
      storyInput.focus();
      timer.start();
    });

    document.getElementById("restartBtn")?.addEventListener("click", () => {
      timer?.stop();
      storyInput.value = "";
      storyInput.readOnly = false;
      document.getElementById("studentName").value = "";
      show("welcome");
      applyConfigToUI();
      updateStartButton();
    });

    document.getElementById("teacherBtn")?.addEventListener("click", () => show("teacherLogin"));
    document.getElementById("teacherCancelBtn")?.addEventListener("click", () => show("welcome"));
    document.getElementById("teacherLoginBtn")?.addEventListener("click", async () => {
      const pw = document.getElementById("teacherPassword")?.value;
      if (pw !== config.teacherPassword) {
        document.getElementById("teacherLoginError")?.classList.remove("dw-hidden");
        return;
      }
      document.getElementById("teacherLoginError")?.classList.add("dw-hidden");
      teacherAuthed = true;
      show("teacher");
      await loadTeacherDashboard();
    });
    document.getElementById("teacherLogoutBtn")?.addEventListener("click", () => { teacherAuthed = false; show("welcome"); });
    document.getElementById("refreshBtn")?.addEventListener("click", loadTeacherDashboard);
    document.getElementById("exportBtn")?.addEventListener("click", exportCsv);
    document.getElementById("builderLinkBtn")?.addEventListener("click", () => {
      location.href = `/writeflow/?mode=builder&id=${encodeURIComponent(config.id)}`;
    });

    updateStartButton();
    show("welcome");
  }

  async function loadTeacherDashboard() {
    const meta = document.getElementById("teacherMeta");
    if (meta) meta.textContent = "Loading submissions…";
    try {
      allSubmissions = await fetchSubmissions();
    } catch (err) {
      allSubmissions = loadLocalSubmissions();
      if (meta) {
        meta.textContent = allSubmissions.length
          ? `${allSubmissions.length} submission(s) · local backup (${err.message})`
          : err.message;
        meta.classList.add("dw-error");
      }
      renderTeacherTable();
      return;
    }
    if (meta) {
      meta.textContent = `${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"} · ${config.title}`;
      meta.classList.remove("dw-error");
    }
    renderTeacherTable();
  }

  function renderTeacherTable() {
    const subs = allSubmissions;
    const tbody = document.getElementById("teacherTableBody");
    if (!tbody) return;
    tbody.innerHTML = subs.map((s) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.classroom)}</td>
        <td>${s.analysis?.wordCount ?? "—"}</td>
        <td>${s.analysis?.wpm ?? "—"}</td>
        <td>${s.analysis?.scores?.typing ?? "—"}</td>
        <td>${s.analysis?.scores?.mechanics ?? "—"}</td>
        <td>${s.analysis?.scores?.story ?? "—"}</td>
        <td>${s.analysis?.scores?.overall ?? "—"}</td>
        <td>${s.submittedAt ? Core.formatDate(s.submittedAt) : "—"}</td>
      </tr>`).join("") || '<tr><td colspan="9" class="dw-muted">No submissions yet.</td></tr>';
  }

  function renderTeacherDashboard() {
    renderTeacherTable();
  }

  function exportCsv() {
    const subs = allSubmissions.length ? allSubmissions : loadLocalSubmissions();
    const rows = [["Name", "Class", "Words", "WPM", "Typing", "Mechanics", "Story", "Overall", "Submitted"]];
    for (const s of subs) {
      rows.push([s.name, s.classroom, s.analysis?.wordCount, s.analysis?.wpm,
        s.analysis?.scores?.typing, s.analysis?.scores?.mechanics, s.analysis?.scores?.story,
        s.analysis?.scores?.overall, new Date(s.submittedAt).toISOString()]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `writeflow-${config.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  /* ── Builder ── */
  let builderSection = "content";

  function getAssignmentsList() {
    try { return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || "[]"); } catch { return [config.id]; }
  }

  function saveAssignmentsList(ids) {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify([...new Set(ids)]));
  }

  function renderBuilder() {
    const nav = document.getElementById("builderNav");
    if (nav) {
      nav.innerHTML = (window.WriteFlowDefaults?.BUILDER_SECTIONS || []).map((s) => `
        <button class="wf-nav-item${builderSection === s.id ? " wf-nav-item--active" : ""}" type="button" data-section="${s.id}">
          ${s.icon} ${escapeHtml(s.label)}
        </button>`).join("");
      nav.querySelectorAll(".wf-nav-item").forEach((btn) => {
        btn.addEventListener("click", () => { builderSection = btn.dataset.section; renderBuilder(); });
      });
    }

    const canvas = document.getElementById("builderCanvas");
    if (!canvas) return;

    if (builderSection === "content") {
      canvas.innerHTML = `
        <h2 class="dw-h2">Assignment content</h2>
        <label class="dw-field"><span class="dw-label">Title</span><input id="bfTitle" class="dw-input" value="${escapeHtml(config.title)}" /></label>
        <label class="dw-field"><span class="dw-label">Subtitle</span><input id="bfSubtitle" class="dw-input" value="${escapeHtml(config.subtitle)}" /></label>
        <label class="dw-field"><span class="dw-label">Welcome headline</span><input id="bfWelcomeTitle" class="dw-input" value="${escapeHtml(config.welcomeTitle || "")}" /></label>
        <label class="dw-field"><span class="dw-label">Welcome intro</span><textarea id="bfWelcomeLead" class="dw-textarea" rows="3">${escapeHtml(config.welcomeLead || "")}</textarea></label>
        <label class="dw-field"><span class="dw-label">Writing prompt</span><textarea id="bfPrompt" class="dw-textarea" rows="4">${escapeHtml(config.prompt)}</textarea></label>
        <label class="dw-field"><span class="dw-label">In-session prompt banner</span><input id="bfPromptBanner" class="dw-input" value="${escapeHtml(config.promptBanner || "")}" /></label>
        <label class="dw-field"><span class="dw-label">Teacher password</span><input id="bfTeacherPw" class="dw-input" value="${escapeHtml(config.teacherPassword)}" /></label>`;
      bindBuilderField("bfTitle", "title");
      bindBuilderField("bfSubtitle", "subtitle");
      bindBuilderField("bfWelcomeTitle", "welcomeTitle");
      bindBuilderField("bfWelcomeLead", "welcomeLead");
      bindBuilderField("bfPrompt", "prompt");
      bindBuilderField("bfPromptBanner", "promptBanner");
      bindBuilderField("bfTeacherPw", "teacherPassword");
    } else if (builderSection === "timer") {
      canvas.innerHTML = `
        <h2 class="dw-h2">Timer &amp; rules</h2>
        <label class="dw-field"><span class="dw-label">Duration (seconds)</span><input id="bfDuration" class="dw-input" type="number" min="60" max="3600" step="30" value="${config.durationSec}" /></label>
        <label class="dw-field dw-row"><input id="bfAllowPaste" type="checkbox" ${config.allowPaste ? "checked" : ""} /><span>Allow paste</span></label>
        <label class="dw-field dw-row"><input id="bfLockAfter" type="checkbox" ${config.lockAfterTime ? "checked" : ""} /><span>Lock editor when time expires</span></label>
        <label class="dw-field dw-row"><input id="bfLiveStats" type="checkbox" ${config.showLiveStats ? "checked" : ""} /><span>Show live word count &amp; WPM</span></label>
        <label class="dw-field dw-row"><input id="bfRequireName" type="checkbox" ${config.requireName ? "checked" : ""} /><span>Require student name</span></label>
        <label class="dw-field dw-row"><input id="bfRequireClass" type="checkbox" ${config.requireClass ? "checked" : ""} /><span>Require class selection</span></label>
        <label class="dw-field dw-row"><input id="bfRequireCode" type="checkbox" ${config.requireClassCode ? "checked" : ""} /><span>Require class code</span></label>`;
      document.getElementById("bfDuration")?.addEventListener("change", (e) => { config.durationSec = Number(e.target.value) || 300; persistConfig(); renderInspector(); });
      ["bfAllowPaste", "bfLockAfter", "bfLiveStats", "bfRequireName", "bfRequireClass", "bfRequireCode"].forEach((id) => {
        const map = { bfAllowPaste: "allowPaste", bfLockAfter: "lockAfterTime", bfLiveStats: "showLiveStats", bfRequireName: "requireName", bfRequireClass: "requireClass", bfRequireCode: "requireClassCode" };
        document.getElementById(id)?.addEventListener("change", (e) => { config[map[id]] = e.target.checked; persistConfig(); });
      });
    } else if (builderSection === "appearance") {
      const fontKey = config.theme?.fontPreset || "google";
      canvas.innerHTML = `
        <h2 class="dw-h2">Appearance</h2>
        <p class="dw-muted">Theme, typography, and imagery — styled like a Google Forms header.</p>
        <div class="wf-inspector-group">
          <div class="wf-inspector-group__label">Color theme</div>
          <div class="wf-preset-grid" id="bfPresets"></div>
        </div>
        <label class="dw-field">
          <span class="dw-label">Font preset</span>
          <select id="bfFontPreset" class="dw-input dw-select">
            ${Object.entries(Core.FONT_PRESETS || {}).map(([k, v]) =>
              `<option value="${k}"${fontKey === k ? " selected" : ""}>${escapeHtml(v.label)}</option>`).join("")}
          </select>
        </label>
        <label class="dw-field">
          <span class="dw-label">Custom font stack (optional override)</span>
          <input id="bfFontCustom" class="dw-input" value="${escapeHtml(config.theme?.fontFamily || "")}" placeholder='e.g. "Comic Sans MS", cursive' />
        </label>
        <label class="dw-field">
          <span class="dw-label">Accent color</span>
          <div class="wf-color-row">
            <input id="bfAccent" class="wf-color-swatch" type="color" value="${config.theme?.accent || "#1a73e8"}" />
            <input id="bfAccentText" class="dw-input" value="${escapeHtml(config.theme?.accent || "#1a73e8")}" />
          </div>
        </label>
        <label class="dw-field">
          <span class="dw-label">Hero image URL (optional)</span>
          <input id="bfHero" class="dw-input" value="${escapeHtml(config.heroImage || "")}" placeholder="https://…" />
        </label>
        <label class="dw-field">
          <span class="dw-label">Or upload hero image</span>
          <input id="bfHeroUpload" class="dw-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" />
          <span class="dw-muted dw-tiny">Stored in assignment config (max 750 KB). Overrides URL when set.</span>
        </label>
        <div id="bfHeroPreview" class="wf-hero-preview dw-hidden"></div>
        <button id="bfClearHero" class="dw-btn dw-btn-ghost dw-hidden" type="button">Remove uploaded image</button>`;
      const presets = document.getElementById("bfPresets");
      Object.keys(Core.PRESETS).forEach((key) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `wf-preset-chip${config.theme?.preset === key ? " wf-preset-chip--active" : ""}`;
        chip.textContent = key.charAt(0).toUpperCase() + key.slice(1);
        chip.addEventListener("click", () => {
          config.theme = { ...config.theme, preset: key, ...Core.PRESETS[key] };
          persistConfig();
          Core.applyTheme(Core.resolveTheme(config));
          renderBuilder();
        });
        presets?.appendChild(chip);
      });
      document.getElementById("bfFontPreset")?.addEventListener("change", (e) => {
        config.theme = { ...config.theme, fontPreset: e.target.value };
        persistConfig();
        Core.applyTheme(Core.resolveTheme(config));
      });
      document.getElementById("bfFontCustom")?.addEventListener("change", (e) => {
        config.theme = { ...config.theme, fontFamily: e.target.value };
        persistConfig();
        Core.applyTheme(Core.resolveTheme(config));
      });
      document.getElementById("bfAccent")?.addEventListener("input", (e) => {
        config.theme = { ...config.theme, accent: e.target.value };
        document.getElementById("bfAccentText").value = e.target.value;
        persistConfig();
        Core.applyTheme(Core.resolveTheme(config));
      });
      document.getElementById("bfAccentText")?.addEventListener("change", (e) => {
        config.theme = { ...config.theme, accent: e.target.value };
        persistConfig();
        Core.applyTheme(Core.resolveTheme(config));
      });
      document.getElementById("bfHero")?.addEventListener("change", (e) => {
        config.heroImage = e.target.value;
        persistConfig();
      });
      document.getElementById("bfHeroUpload")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          config.heroImageData = await readImageFile(file);
          persistConfig();
          renderBuilder();
        } catch (err) {
          alert(err.message || "Could not load image.");
        }
      });
      document.getElementById("bfClearHero")?.addEventListener("click", () => {
        config.heroImageData = "";
        persistConfig();
        renderBuilder();
      });
      if (config.heroImageData) {
        const prev = document.getElementById("bfHeroPreview");
        const clr = document.getElementById("bfClearHero");
        if (prev) {
          prev.classList.remove("dw-hidden");
          prev.innerHTML = `<img src="${config.heroImageData}" alt="" style="width:100%;max-height:180px;object-fit:cover;border-radius:12px;" />`;
        }
        clr?.classList.remove("dw-hidden");
      }
    } else if (builderSection === "classes") {
      canvas.innerHTML = `
        <h2 class="dw-h2">Classes</h2>
        <p class="dw-muted">Class lists are shared site-wide (same as Summer Writing Test). Edit <code>api/diagnostic-writing/classes.json</code> to add classes.</p>
        <ul class="dw-list">${VALID_CLASSROOMS.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`;
    } else if (builderSection === "preview") {
      canvas.innerHTML = `
        <h2 class="dw-h2">Live preview</h2>
        <p class="dw-muted">This is how students will see the welcome screen.</p>
        <div class="wf-preview-frame dw-card">
          <h1 class="dw-h1">${escapeHtml(config.welcomeTitle || config.title)}</h1>
          <p class="dw-lead">${escapeHtml(config.welcomeLead || "")}</p>
          <blockquote class="dw-prompt-quote">${escapeHtml(config.prompt)}</blockquote>
          <button class="dw-btn" type="button" disabled>Start ${Core.formatTime(config.durationSec)} timer</button>
        </div>
        <div class="dw-row" style="margin-top:16px">
          <a class="dw-btn" href="/writeflow/?id=${encodeURIComponent(config.id)}">Open student view</a>
        </div>`;
    }
    renderInspector();
  }

  function bindBuilderField(id, key) {
    document.getElementById(id)?.addEventListener("input", (e) => {
      config[key] = e.target.value;
      persistConfig();
      renderInspector();
    });
  }

  function renderInspector() {
    const insp = document.getElementById("builderInspector");
    if (!insp) return;
    insp.innerHTML = `
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Assignment ID</div>
        <input id="bfId" class="dw-input" value="${escapeHtml(config.id)}" />
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Actions</div>
        <div class="dw-stack">
          <button id="bfSave" class="dw-btn" type="button">Save assignment</button>
          <button id="bfExport" class="dw-btn dw-btn-secondary" type="button">Export JSON</button>
          <label class="dw-btn dw-btn-ghost" style="cursor:pointer">Import JSON<input id="bfImport" type="file" accept=".json" hidden /></label>
          <button id="bfNew" class="dw-btn dw-btn-ghost" type="button">New assignment</button>
        </div>
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Share link</div>
        <input class="dw-input" readonly value="${location.origin}/writeflow/?id=${encodeURIComponent(config.id)}" onclick="this.select()" />
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Saved assignments</div>
        <div class="wf-assignment-list" id="bfAssignmentList"></div>
      </div>`;

    document.getElementById("bfId")?.addEventListener("change", (e) => {
      config.id = e.target.value.trim() || "assignment";
      persistConfig();
      history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(config.id)}`);
    });
    document.getElementById("bfSave")?.addEventListener("click", () => {
      persistConfig();
      alert("Assignment saved.");
    });
    document.getElementById("bfExport")?.addEventListener("click", () => Core.exportConfig(config));
    document.getElementById("bfImport")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        config = { ...Defaults, ...await Core.importConfig(file) };
        persistConfig();
        renderBuilder();
      } catch { alert("Invalid JSON file."); }
    });
    document.getElementById("bfNew")?.addEventListener("click", () => {
      config = { ...Defaults, id: `assignment-${Date.now()}`, title: "Untitled Assignment" };
      persistConfig();
      history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(config.id)}`);
      renderBuilder();
    });

    const list = document.getElementById("bfAssignmentList");
    getAssignmentsList().forEach((id) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "wf-assignment-card";
      card.innerHTML = `<span>${escapeHtml(id)}</span><span class="wf-assignment-card__meta">Open →</span>`;
      card.addEventListener("click", () => {
        config = Core.loadConfig(STORAGE_PREFIX, id, { ...Defaults, id });
        history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(id)}`);
        renderBuilder();
      });
      list?.appendChild(card);
    });
  }

  function persistConfig() {
    Core.saveConfig(STORAGE_PREFIX, config.id, config);
    const ids = getAssignmentsList();
    if (!ids.includes(config.id)) ids.push(config.id);
    saveAssignmentsList(ids);
    Core.applyTheme(Core.resolveTheme(config));
    void registerAssignmentCloud();
  }

  function initBuilder() {
    show("builder");
    document.getElementById("studentViewLink")?.addEventListener("click", () => {
      location.href = `/writeflow/?id=${encodeURIComponent(config.id)}`;
    });
    renderBuilder();
  }

  function initHome() {
    show("home");
    document.getElementById("openBuilderBtn")?.addEventListener("click", () => {
      location.href = "/writeflow/?mode=builder";
    });
    document.getElementById("openSampleBtn")?.addEventListener("click", () => {
      location.href = "/writeflow/?id=sample-persuasive";
    });
  }

  if (mode === "builder") initBuilder();
  else if (params.get("home") === "1") initHome();
  else initStudentFlow();
})();

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

  const APP_ROLE = window.WRITEFLOW_ROLE || "studio";
  const isStudentApp = APP_ROLE === "student";
  const isStudioApp = !isStudentApp;
  const STUDIO_PATH = "/writeflow/studio/";
  const ASSIGNMENT_PATH = "/writeflow/a/";
  const SENTENCE_STATS_KEY = "writeflow:global:sentences";

  function assignmentUrl(id) {
    return `${ASSIGNMENT_PATH}?id=${encodeURIComponent(id)}`;
  }

  function studioUrl(query = "") {
    if (!query) return STUDIO_PATH;
    return `${STUDIO_PATH}${query.startsWith("?") ? query : `?${query}`}`;
  }

  const params = new URLSearchParams(location.search);
  const mode = isStudentApp ? "student" : (params.get("mode") === "builder" ? "builder" : "studio");
  const assignmentId = params.get("id") || (isStudentApp ? "" : "sample-persuasive");

  let config = { ...Defaults, id: assignmentId };
  let timer = null;
  let allSubmissions = [];
  let teacherAuthed = false;
  let sessionTeacherPassword = "";
  let tutorialIndex = 0;
  let tutorialContextKey = "home";
  let tutorialHighlightEl = null;

  const TUTORIAL_STEPS = window.WriteFlowDefaults?.TUTORIAL_STEPS || {};
  const ASSIGNMENT_TEMPLATES = window.WriteFlowDefaults?.ASSIGNMENT_TEMPLATES || [];

  let timerWaitingForMinWords = false;
  let activeTemplateId = params.get("template") || "";
  let templateAnswers = {};

  const VALID_CLASSROOMS = Core.loadJsonScript("wfClassroomsJson", []);
  const CLASSROOM_CODES = Core.loadJsonScript("wfClassroomCodesJson", {});

  const shell = document.querySelector(".dw-shell");
  const views = isStudentApp
    ? {
        welcome: document.getElementById("welcomeView"),
        writing: document.getElementById("writingView"),
        analyzing: document.getElementById("analyzingView"),
        results: document.getElementById("resultsView"),
      }
    : {
        home: document.getElementById("wfHomeView"),
        builder: document.getElementById("builderView"),
        teacherLogin: document.getElementById("teacherLoginView"),
        teacher: document.getElementById("teacherView"),
      };

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function getVocabWords() {
    return (config.vocabWords || []).map((w) => String(w).trim()).filter(Boolean);
  }

  function highlightVocabHtml(text, vocabWords = getVocabWords()) {
    if (!text || !vocabWords.length || config.highlightVocab === false) {
      return escapeHtml(text);
    }
    let html = escapeHtml(text);
    const sorted = [...vocabWords].sort((a, b) => b.length - a.length);
    for (const word of sorted) {
      const re = new RegExp(`\\b(${escapeRegex(word)})\\b`, "gi");
      html = html.replace(re, '<mark class="wf-vocab-hit">$1</mark>');
    }
    return html;
  }

  function recordSentenceStats(sentenceCount) {
    if (!sentenceCount) return;
    try {
      const prev = Number(localStorage.getItem(SENTENCE_STATS_KEY) || 0);
      localStorage.setItem(SENTENCE_STATS_KEY, String(prev + sentenceCount));
    } catch {}
  }

  function hasLocalConfig(id) {
    try {
      return !!localStorage.getItem(Core.storageKey(STORAGE_PREFIX, id));
    } catch {
      return false;
    }
  }

  function readLocalConfig(id) {
    if (!hasLocalConfig(id)) return null;
    return Core.loadConfig(STORAGE_PREFIX, id, { ...Defaults, id });
  }

  async function fetchCloudConfig(id) {
    try {
      const res = await fetch(`${API_URL}?action=getAssignment&assignmentId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.config) return null;
      return data.config;
    } catch {
      return null;
    }
  }

  async function resolveAssignmentConfig(id) {
    const local = readLocalConfig(id);
    if (local) return { config: local, source: "local" };

    const cloud = await fetchCloudConfig(id);
    if (cloud) {
      return { config: { ...Defaults, ...cloud, id }, source: "cloud" };
    }

    return { config: { ...Defaults, id }, source: "missing" };
  }

  function showAssignmentNotice(message, isError = true) {
    const el = document.getElementById("assignmentLoadNotice");
    if (!el) return;
    if (!message) {
      el.classList.add("dw-hidden");
      el.textContent = "";
      return;
    }
    el.textContent = message;
    el.classList.toggle("dw-error", isError);
    el.classList.toggle("dw-save-status--ok", !isError);
    el.classList.remove("dw-hidden");
  }

  function mergeAccessibility(configA11y = {}) {
    return { ...Defaults.accessibility, ...configA11y };
  }

  function resolveSpellcheck() {
    if (typeof config.spellcheck === "boolean") return config.spellcheck;
    return mergeAccessibility(config.accessibility).spellcheck !== false;
  }

  function applyAccessibility() {
    const a11y = mergeAccessibility(config.accessibility);
    const shell = document.querySelector(".dw-shell");
    shell?.classList.toggle("wf-a11y-large-text", !!a11y.largeText);
    shell?.classList.toggle("wf-a11y-high-contrast", !!a11y.highContrast);
    shell?.classList.toggle("wf-reduced-motion", !!a11y.reducedMotion);

    const theme = Core.resolveTheme(config);
    if (a11y.dyslexiaFont) theme.fontPreset = "dyslexic";
    Core.applyTheme(theme);

    const storyInput = document.getElementById("storyInput");
    if (storyInput) storyInput.spellcheck = resolveSpellcheck();
  }

  function getStoryWordCount() {
    return Core.countWords(document.getElementById("storyInput")?.value || "");
  }

  function meetsMinWordCount() {
    const min = Math.max(0, Number(config.minWordCount) || 0);
    return !min || getStoryWordCount() >= min;
  }

  function showConfirmDialog({ title, body, confirmLabel = "Confirm", destructive = false }) {
    return new Promise((resolve) => {
      const overlay = document.getElementById("wfConfirm");
      const titleEl = document.getElementById("wfConfirmTitle");
      const bodyEl = document.getElementById("wfConfirmBody");
      const okBtn = document.getElementById("confirmOkBtn");
      const cancelBtn = document.getElementById("confirmCancelBtn");
      const backdrop = document.getElementById("confirmBackdrop");
      if (!overlay || !okBtn || !cancelBtn) {
        resolve(window.confirm(body || title));
        return;
      }

      titleEl.textContent = title || "Confirm";
      bodyEl.textContent = body || "";
      okBtn.textContent = confirmLabel;
      okBtn.classList.toggle("wf-confirm__danger", destructive);
      overlay.classList.remove("dw-hidden");
      okBtn.focus();

      function cleanup(result) {
        overlay.classList.add("dw-hidden");
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        backdrop?.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }

      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onKey(e) {
        if (e.key === "Escape") onCancel();
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      backdrop?.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
    });
  }

  function deleteAssignment(id) {
    try { localStorage.removeItem(Core.storageKey(STORAGE_PREFIX, id)); } catch {}
    try { localStorage.removeItem(`writeflow:submissions:${id}`); } catch {}
    const ids = getAssignmentsList().filter((x) => x !== id);
    saveAssignmentsList(ids);
    return ids;
  }

  function applyConfigToUI() {
    applyAccessibility();
    const pageTitle = isStudentApp ? (config.title || "Writing assignment") : `${config.title} · WriteFlow Studio`;
    document.title = pageTitle;

    const titleEl = document.getElementById("appTitle");
    const subEl = document.getElementById("appSubtitle");
    if (titleEl) titleEl.textContent = isStudentApp ? (config.title || "Writing assignment") : config.title;
    if (subEl) subEl.textContent = isStudentApp ? (config.subtitle || "") : (config.subtitle || "Teacher workspace");

    const welcomeTitle = document.getElementById("welcomeTitle");
    const welcomeLead = document.getElementById("welcomeLead");
    if (welcomeTitle) welcomeTitle.textContent = config.welcomeTitle || config.title;
    if (welcomeLead) welcomeLead.textContent = config.welcomeLead || "";

    const promptQuote = document.getElementById("promptQuote");
    if (promptQuote) promptQuote.textContent = config.prompt;

    const promptBanner = document.getElementById("promptBanner");
    if (promptBanner) {
      const bannerText = config.promptBanner || config.prompt;
      promptBanner.innerHTML = isStudentApp
        ? escapeHtml(bannerText)
        : `<strong>Prompt:</strong> ${escapeHtml(bannerText)}`;
    }

    const checklist = document.getElementById("checklist");
    if (checklist) {
      const items = (config.checklist || []).filter(Boolean);
      checklist.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
      checklist.closest(".wf-student-checklist, .dw-checklist")?.classList.toggle("dw-hidden", !items.length);
    }

    document.getElementById("nameField")?.classList.toggle("dw-hidden", !config.requireName);
    document.getElementById("classField")?.classList.toggle("dw-hidden", !config.requireClass);

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
      if (isStudentApp) {
        startBtn.textContent = "Start writing";
      } else {
        const mins = Math.floor(config.durationSec / 60);
        const secs = config.durationSec % 60;
        const label = secs ? `${mins}:${String(secs).padStart(2, "0")}` : `${mins} minute${mins === 1 ? "" : "s"}`;
        startBtn.textContent = `Start ${label} timer`;
      }
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

    const liveStatsBar = document.getElementById("liveStatsBar");
    if (liveStatsBar) liveStatsBar.classList.toggle("dw-hidden", !config.showLiveStats);

    const minEl = document.getElementById("minWordProgress");
    const minWords = Math.max(0, Number(config.minWordCount) || 0);
    if (minEl) {
      minEl.classList.toggle("dw-hidden", !minWords);
      if (minWords) minEl.textContent = `Goal: ${minWords} words`;
    }
  }

  function updateWritingControls() {
    const endEarlyBtn = document.getElementById("endEarlyBtn");
    const minWords = Math.max(0, Number(config.minWordCount) || 0);
    const words = getStoryWordCount();
    const canEndEarly = !!config.allowEndEarly && meetsMinWordCount();

    if (endEarlyBtn) {
      endEarlyBtn.classList.toggle("dw-hidden", !config.allowEndEarly);
      endEarlyBtn.disabled = !canEndEarly;
      if (config.allowEndEarly && minWords && words < minWords) {
        endEarlyBtn.title = `Write ${minWords - words} more word${minWords - words === 1 ? "" : "s"} to submit early`;
      } else {
        endEarlyBtn.title = "";
      }
    }

    const minEl = document.getElementById("minWordProgress");
    if (minEl && minWords) {
      const met = words >= minWords;
      minEl.textContent = met ? `Goal met: ${words} / ${minWords} words` : `${words} / ${minWords} words`;
      minEl.classList.toggle("wf-min-word-progress--met", met);
    }

    if (timerWaitingForMinWords && meetsMinWordCount()) {
      timerWaitingForMinWords = false;
      const notice = document.getElementById("timerExtendNotice");
      notice?.classList.add("dw-hidden");
      finishWriting();
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

  function scrollToMainTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("mainContent")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function show(name) {
    Core.showView(views, name, shell, "teacher");
    scrollToMainTop();
  }

  function formatDurationLabel(sec) {
    const total = Math.max(0, Number(sec) || 0);
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (!m) return `${s} seconds`;
    if (!s) return `${m} minute${m === 1 ? "" : "s"}`;
    return `${m} min ${s} sec`;
  }

  function builderSectionMeta(sectionId) {
    return (window.WriteFlowDefaults?.BUILDER_SECTIONS || []).find((s) => s.id === sectionId) || {};
  }

  function builderSectionHeader(sectionId) {
    const meta = builderSectionMeta(sectionId);
    return `
      <div class="wf-section-header">
        <h2 class="dw-h2">${escapeHtml(meta.label || sectionId)}</h2>
        <p class="dw-muted">${escapeHtml(meta.hint || "")}</p>
      </div>`;
  }

  function clearTutorialHighlight() {
    if (tutorialHighlightEl) {
      tutorialHighlightEl.classList.remove("wf-tutorial-highlight");
      tutorialHighlightEl = null;
    }
  }

  function applyTutorialHighlight(selector) {
    clearTutorialHighlight();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    tutorialHighlightEl = el;
    el.classList.add("wf-tutorial-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function currentTutorialSteps() {
    return TUTORIAL_STEPS[tutorialContextKey] || TUTORIAL_STEPS.home || [];
  }

  function getTutorialContext() {
    if (mode === "builder") return "builder";
    if (!isStudentApp) return "home";
    return "student";
  }

  function renderTutorialStep() {
    const steps = currentTutorialSteps();
    const step = steps[tutorialIndex];
    const overlay = document.getElementById("wfTutorial");
    if (!step || !overlay) return;

    if (step.section && mode === "builder") {
      builderSection = step.section;
      renderBuilder();
    }

    document.getElementById("wfTutorialTitle").textContent = step.title;
    document.getElementById("wfTutorialBody").textContent = step.body;
    document.getElementById("wfTutorialStep").textContent = `${tutorialIndex + 1} / ${steps.length}`;
    document.getElementById("wfTutorialEyebrow").textContent =
      tutorialContextKey === "builder" ? "Builder guide" : tutorialContextKey === "student" ? "Student guide" : "Teacher guide";

    const backBtn = document.getElementById("tutorialBackBtn");
    const nextBtn = document.getElementById("tutorialNextBtn");
    if (backBtn) backBtn.disabled = tutorialIndex === 0;
    if (nextBtn) nextBtn.textContent = tutorialIndex >= steps.length - 1 ? "Done" : "Next";

    requestAnimationFrame(() => applyTutorialHighlight(step.highlight));
  }

  function closeTutorial(markSeen = true) {
    const overlay = document.getElementById("wfTutorial");
    overlay?.classList.add("dw-hidden");
    clearTutorialHighlight();
    if (markSeen) {
      try { localStorage.setItem(`writeflow:tutorial:${tutorialContextKey}`, "1"); } catch {}
    }
  }

  function openTutorial(context = getTutorialContext()) {
    tutorialContextKey = context;
    tutorialIndex = 0;
    document.getElementById("wfTutorial")?.classList.remove("dw-hidden");
    renderTutorialStep();
  }

  function initTutorial() {
    document.getElementById("tutorialBtn")?.addEventListener("click", () => openTutorial(getTutorialContext()));
    document.getElementById("openTutorialHomeBtn")?.addEventListener("click", () => openTutorial("home"));
    document.getElementById("tutorialSkipBtn")?.addEventListener("click", () => closeTutorial(true));
    document.getElementById("tutorialBackdrop")?.addEventListener("click", () => closeTutorial(true));
    document.getElementById("tutorialBackBtn")?.addEventListener("click", () => {
      if (tutorialIndex > 0) {
        tutorialIndex--;
        renderTutorialStep();
      }
    });
    document.getElementById("tutorialNextBtn")?.addEventListener("click", () => {
      const steps = currentTutorialSteps();
      if (tutorialIndex >= steps.length - 1) closeTutorial(true);
      else {
        tutorialIndex++;
        renderTutorialStep();
      }
    });

    if (params.get("tutorial") === "1") {
      openTutorial(getTutorialContext());
      return;
    }
    const ctx = getTutorialContext();
    try {
      if (ctx === "home" && localStorage.getItem(`writeflow:tutorial:${ctx}`) !== "1") {
        setTimeout(() => openTutorial("home"), 400);
      }
    } catch {}
  }

  function showSaveStatus(message, ok = true) {
    const el = document.getElementById("bfSaveStatus");
    if (!el) return;
    el.textContent = message;
    el.classList.remove("dw-hidden", "wf-save-status--ok", "wf-save-status--error");
    el.classList.add(ok ? "wf-save-status--ok" : "wf-save-status--error");
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
    if (config.requireMinWordsToComplete && !meetsMinWordCount()) {
      timerWaitingForMinWords = true;
      const notice = document.getElementById("timerExtendNotice");
      const minWords = Math.max(0, Number(config.minWordCount) || 0);
      if (notice) {
        notice.textContent = `Time's up — keep writing until you reach ${minWords} words. Your work will submit automatically when you hit the goal.`;
        notice.classList.remove("dw-hidden");
      }
      updateWritingControls();
      return;
    }

    const storyInput = document.getElementById("storyInput");
    if (storyInput && config.lockAfterTime) storyInput.readOnly = true;
    if (timer) timer.stop();
    timerWaitingForMinWords = false;
    document.getElementById("timerExtendNotice")?.classList.add("dw-hidden");
    show("analyzing");
    void showResults(storyInput?.value || "");
  }

  async function showResults(text) {
    const duration = Math.min(Math.max(timer?.getElapsed() || config.durationSec, 1), config.durationSec);
    const vocabWords = getVocabWords();
    const analysis = window.WriteAnalysis?.analyzeText(text, duration, { vocabWords })
      || { scores: {}, wordCount: 0, wpm: 0, feedback: [], sentenceCount: 0 };
    recordSentenceStats(analysis.sentenceCount || window.WriteAnalysis?.getSentences?.(text)?.length || 0);

    const name = document.getElementById("studentName")?.value.trim() || "Student";
    const classEl = document.getElementById("studentClass");
    const classroom = Core.resolveClassroom(classEl?.value, VALID_CLASSROOMS) || "";
    const classCode = document.getElementById("classCode")?.value || "";

    const resultNameEl = document.getElementById("resultName");
    const resultSummaryEl = document.getElementById("resultSummary");
    if (resultNameEl) resultNameEl.textContent = name;
    const resultClassEl = document.getElementById("resultClass");
    if (resultClassEl) resultClassEl.textContent = classroom || "—";

    const summaryText = isStudentApp
      ? `You wrote ${analysis.wordCount} words in ${Core.formatTime(duration)} (${analysis.wpm} WPM).`
      : `You wrote ${analysis.wordCount} words in ${Core.formatTime(duration)} (${analysis.wpm} WPM). Overall: ${analysis.scores?.overall ?? "—"}/100`;
    if (resultSummaryEl) resultSummaryEl.textContent = summaryText;

    const vocabEl = document.getElementById("vocabResult");
    if (vocabEl && vocabWords.length && analysis.vocabulary) {
      const v = analysis.vocabulary;
      vocabEl.classList.remove("dw-hidden");
      vocabEl.innerHTML = `
        <p><strong>Vocabulary:</strong> ${v.usedCount} of ${v.requiredCount} expected words used.</p>
        ${v.found.length ? `<p class="wf-vocab-found">Used: ${v.found.map((w) => escapeHtml(w)).join(", ")}</p>` : ""}
        ${v.missing.length ? `<p class="wf-vocab-missing">Not found: ${v.missing.map((w) => escapeHtml(w)).join(", ")}</p>` : ""}`;
    } else if (vocabEl) {
      vocabEl.classList.add("dw-hidden");
    }

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

    const storyPreview = document.getElementById("storyPreview");
    if (storyPreview) storyPreview.textContent = text;
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

  async function publishAssignmentCloud() {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "registerAssignment",
        assignmentId: config.id,
        teacherPassword: config.teacherPassword,
        title: config.title,
        config,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.setupRequired) {
        throw new Error("Online storage is not configured on the server yet.");
      }
      const errMsg = data.error || `Publish failed (${res.status})`;
      if (/illegal spreadsheet id|paste_your_sheet_id/i.test(errMsg)) {
        throw new Error(
          "Google Apps Script is not linked to your sheet yet. In the script editor, replace PASTE_YOUR_SHEET_ID_HERE with your real Sheet ID, save, run initSheet once, then deploy a new web app version."
        );
      }
      throw new Error(errMsg);
    }
    return data;
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
    const pw = sessionTeacherPassword || document.getElementById("teacherPassword")?.value || config.teacherPassword;
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

  async function initStudentFlow() {
    if (!assignmentId) {
      showAssignmentNotice("This link is missing an assignment ID. Ask your teacher for the correct student link.");
      show("welcome");
      return;
    }

    showAssignmentNotice("");
    const resolved = await resolveAssignmentConfig(assignmentId);
    config = resolved.config;

    if (resolved.source === "missing") {
      showAssignmentNotice(
        "This assignment was not found. Ask your teacher to open WriteFlow Studio, save the assignment, and resend the link."
      );
    }

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
    storyInput?.addEventListener("input", () => {
      updateWritingControls();
    });

    function autoGrowTextarea() {
      if (!storyInput) return;
      storyInput.style.height = "auto";
      storyInput.style.height = `${Math.min(storyInput.scrollHeight, Math.round(window.innerHeight * 0.65))}px`;
    }
    storyInput?.addEventListener("input", autoGrowTextarea);

    document.getElementById("studentName")?.addEventListener("input", updateStartButton);
    document.getElementById("studentClass")?.addEventListener("change", updateStartButton);
    document.getElementById("classCode")?.addEventListener("input", updateStartButton);

    document.getElementById("startBtn")?.addEventListener("click", () => {
      if (!canStart()) return;
      storyInput.value = "";
      storyInput.readOnly = false;
      storyInput.style.height = "";
      timerWaitingForMinWords = false;
      document.getElementById("timerExtendNotice")?.classList.add("dw-hidden");
      show("writing");
      requestAnimationFrame(() => {
        applyAccessibility();
        storyInput.focus();
        document.getElementById("writingView")?.scrollIntoView({ behavior: "smooth", block: "start" });
        updateWritingControls();
      });
      timer.start();
    });

    document.getElementById("endEarlyBtn")?.addEventListener("click", () => {
      if (!config.allowEndEarly || !meetsMinWordCount()) return;
      finishWriting();
    });

    updateStartButton();
    show("welcome");
  }

  function bindTeacherEvents() {
    document.getElementById("teacherCancelBtn")?.addEventListener("click", () => show("home"));
    document.getElementById("teacherLoginBtn")?.addEventListener("click", async () => {
      const pw = document.getElementById("teacherPassword")?.value || "";
      const errEl = document.getElementById("teacherLoginError");
      if (!pw) {
        if (errEl) {
          errEl.textContent = "Enter your teacher password.";
          errEl.classList.remove("dw-hidden");
        }
        return;
      }
      if (errEl) errEl.classList.add("dw-hidden");

      try {
        const res = await fetch(
          `${API_URL}?password=${encodeURIComponent(pw)}&assignmentId=${encodeURIComponent(config.id)}`
        );
        if (res.status === 401) {
          if (errEl) {
            errEl.textContent = "Incorrect password for this assignment.";
            errEl.classList.remove("dw-hidden");
          }
          return;
        }
      } catch {
        if (config.teacherPassword && pw !== config.teacherPassword) {
          if (errEl) {
            errEl.textContent = "Incorrect password for this assignment.";
            errEl.classList.remove("dw-hidden");
          }
          return;
        }
      }

      sessionTeacherPassword = pw;
      teacherAuthed = true;
      show("teacher");
      await loadTeacherDashboard();
    });
    document.getElementById("teacherLogoutBtn")?.addEventListener("click", () => {
      teacherAuthed = false;
      sessionTeacherPassword = "";
      show("home");
    });
    document.getElementById("refreshBtn")?.addEventListener("click", loadTeacherDashboard);
    document.getElementById("exportBtn")?.addEventListener("click", exportCsv);
  }

  async function initTeacherPortal() {
    const id = params.get("id") || resolveDefaultAssignmentId();
    const resolved = await resolveAssignmentConfig(id);
    config = resolved.config;
    applyConfigToUI();
    bindTeacherEvents();
    show("teacherLogin");
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

  function showTeacherSubmission(sub) {
    const panel = document.getElementById("teacherSubmissionDetail");
    const meta = document.getElementById("teacherDetailMeta");
    const vocabSummary = document.getElementById("teacherVocabSummary");
    const preview = document.getElementById("teacherStoryPreview");
    if (!panel || !preview) return;

    panel.classList.remove("dw-hidden");
    if (meta) {
      meta.textContent = `${sub.name} · ${sub.classroom || "—"} · ${sub.analysis?.wordCount ?? 0} words · ${sub.submittedAt ? Core.formatDate(sub.submittedAt) : ""}`;
    }

    const vocab = sub.analysis?.vocabulary;
    if (vocabSummary) {
      if (vocab?.requiredCount) {
        vocabSummary.classList.remove("dw-hidden");
        vocabSummary.innerHTML = `
          <p><strong>Vocabulary:</strong> ${vocab.usedCount}/${vocab.requiredCount} (${vocab.score}%)</p>
          ${vocab.found.length ? `<p class="wf-vocab-found">Found: ${vocab.found.map((w) => `<span class="wf-vocab-chip">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
          ${vocab.missing.length ? `<p class="wf-vocab-missing">Missing: ${vocab.missing.map((w) => escapeHtml(w)).join(", ")}</p>` : ""}`;
      } else {
        vocabSummary.classList.add("dw-hidden");
        vocabSummary.innerHTML = "";
      }
    }

    preview.innerHTML = highlightVocabHtml(sub.text || "", getVocabWords());
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderTeacherTable() {
    const subs = allSubmissions;
    const tbody = document.getElementById("teacherTableBody");
    if (!tbody) return;
    const hasVocab = getVocabWords().length > 0;
    tbody.innerHTML = subs.map((s, idx) => `
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.classroom)}</td>
        <td>${s.analysis?.wordCount ?? "—"}</td>
        <td>${s.analysis?.wpm ?? "—"}</td>
        <td>${hasVocab ? (s.analysis?.vocabulary ? `${s.analysis.vocabulary.usedCount}/${s.analysis.vocabulary.requiredCount}` : "—") : "—"}</td>
        <td>${s.analysis?.scores?.typing ?? "—"}</td>
        <td>${s.analysis?.scores?.mechanics ?? "—"}</td>
        <td>${s.analysis?.scores?.story ?? "—"}</td>
        <td>${s.analysis?.scores?.overall ?? "—"}</td>
        <td>${s.submittedAt ? Core.formatDate(s.submittedAt) : "—"}</td>
        <td><button type="button" class="dw-btn dw-btn-ghost dw-btn--compact" data-sub-idx="${idx}">View</button></td>
      </tr>`).join("") || `<tr><td colspan="11" class="dw-muted">No submissions yet.</td></tr>`;

    tbody.querySelectorAll("[data-sub-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = subs[Number(btn.dataset.subIdx)];
        if (sub) showTeacherSubmission(sub);
      });
    });
  }

  function renderTeacherDashboard() {
    renderTeacherTable();
  }

  function exportCsv() {
    const subs = allSubmissions.length ? allSubmissions : loadLocalSubmissions();
    const hasVocab = getVocabWords().length > 0;
    const rows = [["Name", "Class", "Words", "WPM", ...(hasVocab ? ["Vocab"] : []), "Typing", "Mechanics", "Story", "Overall", "Submitted"]];
    for (const s of subs) {
      rows.push([
        s.name, s.classroom, s.analysis?.wordCount, s.analysis?.wpm,
        ...(hasVocab ? [`${s.analysis?.vocabulary?.usedCount ?? 0}/${s.analysis?.vocabulary?.requiredCount ?? 0}`] : []),
        s.analysis?.scores?.typing, s.analysis?.scores?.mechanics, s.analysis?.scores?.story,
        s.analysis?.scores?.overall, new Date(s.submittedAt).toISOString(),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `writeflow-${config.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  /* ── Builder ── */
  let builderSection = params.get("section") === "templates" || params.get("template") ? "templates" : "content";

  function getTemplateById(id) {
    return ASSIGNMENT_TEMPLATES.find((t) => t.id === id) || null;
  }

  function renderTemplateQuestionField(q, value) {
    const val = value ?? q.default ?? "";
    if (q.type === "textarea") {
      return `<label class="dw-field"><span class="dw-label">${escapeHtml(q.label)}</span><textarea class="dw-textarea wf-template-input" data-qid="${escapeHtml(q.id)}" rows="3" placeholder="${escapeHtml(q.placeholder || "")}">${escapeHtml(val)}</textarea></label>`;
    }
    if (q.type === "checkbox") {
      const checked = val === true || val === "true" || val === 1 || val === "1";
      return `<label class="wf-toggle-row"><input class="wf-template-input" data-qid="${escapeHtml(q.id)}" type="checkbox" ${checked ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>${escapeHtml(q.label)}</strong></span></label>`;
    }
    const inputType = q.type === "number" ? "number" : "text";
    const attrs = [
      q.min != null ? `min="${q.min}"` : "",
      q.max != null ? `max="${q.max}"` : "",
      q.required ? "required" : "",
    ].filter(Boolean).join(" ");
    return `<label class="dw-field"><span class="dw-label">${escapeHtml(q.label)}</span><input class="dw-input wf-template-input" data-qid="${escapeHtml(q.id)}" type="${inputType}" value="${escapeHtml(val)}" placeholder="${escapeHtml(q.placeholder || "")}" ${attrs} /></label>`;
  }

  function collectTemplateAnswers(template) {
    const answers = {};
    template.questions.forEach((q) => {
      const el = document.querySelector(`.wf-template-input[data-qid="${q.id}"]`);
      if (!el) return;
      if (q.type === "checkbox") answers[q.id] = el.checked;
      else if (q.type === "number") answers[q.id] = Number(el.value);
      else answers[q.id] = el.value;
    });
    return answers;
  }

  function applyTemplateToConfig(template, answers) {
    const built = template.build(answers);
    config = {
      ...Defaults,
      ...config,
      ...built,
      accessibility: { ...Defaults.accessibility, ...built.accessibility },
      theme: { ...Defaults.theme, ...config.theme, ...built.theme },
      version: 2,
    };
    persistConfig();
    history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(config.id)}`);
    builderSection = "content";
    renderBuilder();
    showSaveStatus(`Created "${config.title}" from template. Review settings, then Save assignment.`, true);
  }

  function renderTemplateGallery(containerId, onSelect) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = ASSIGNMENT_TEMPLATES.map((t) => `
      <button class="wf-template-card" type="button" data-template="${escapeHtml(t.id)}" role="listitem">
        <span class="wf-template-card__icon" aria-hidden="true">${t.icon}</span>
        <span class="wf-template-card__body">
          <span class="wf-template-card__title">${escapeHtml(t.title)}</span>
          <span class="wf-template-card__desc">${escapeHtml(t.description)}</span>
        </span>
      </button>`).join("");
    grid.querySelectorAll(".wf-template-card").forEach((btn) => {
      btn.addEventListener("click", () => onSelect(btn.dataset.template));
    });
  }

  function renderTemplateWizard(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return "";
    if (!templateAnswers[templateId]) {
      templateAnswers[templateId] = {};
      template.questions.forEach((q) => {
        templateAnswers[templateId][q.id] = q.default ?? (q.type === "checkbox" ? false : "");
      });
    }
    const answers = templateAnswers[templateId];
    return `
      <div class="wf-template-wizard dw-card">
        <button type="button" class="dw-btn dw-btn-ghost wf-template-wizard__back" id="templateWizardBack">← All templates</button>
        <h3 class="dw-h3">${template.icon} ${escapeHtml(template.title)}</h3>
        <p class="dw-muted">${escapeHtml(template.description)}</p>
        <div class="wf-template-wizard__form" id="templateWizardForm">
          ${template.questions.map((q) => renderTemplateQuestionField(q, answers[q.id])).join("")}
        </div>
        <button type="button" class="dw-btn" id="templateBuildBtn">Build assignment</button>
      </div>`;
  }

  function bindTemplateWizard(templateId) {
    const template = getTemplateById(templateId);
    if (!template) return;

    document.getElementById("templateWizardBack")?.addEventListener("click", () => {
      activeTemplateId = "";
      renderBuilder();
    });

    document.querySelectorAll(".wf-template-input").forEach((el) => {
      el.addEventListener("input", () => {
        templateAnswers[templateId] = collectTemplateAnswers(template);
      });
      el.addEventListener("change", () => {
        templateAnswers[templateId] = collectTemplateAnswers(template);
      });
    });

    document.getElementById("templateBuildBtn")?.addEventListener("click", () => {
      const answers = collectTemplateAnswers(template);
      const missing = template.questions.filter((q) => q.required && !String(answers[q.id] ?? "").trim());
      if (missing.length) {
        alert(`Please fill in: ${missing.map((q) => q.label).join(", ")}`);
        return;
      }
      templateAnswers[templateId] = answers;
      applyTemplateToConfig(template, answers);
    });
  }

  function getAssignmentsList() {
    try { return JSON.parse(localStorage.getItem(ASSIGNMENTS_KEY) || "[]"); } catch { return [config.id]; }
  }

  function saveAssignmentsList(ids) {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify([...new Set(ids)]));
  }

  function resolveDefaultAssignmentId() {
    const ids = getAssignmentsList();
    return ids[0] || assignmentId || "sample-persuasive";
  }

  function bindTopbarActions() {
    if (!isStudioApp) return;
    document.getElementById("builderLinkBtn")?.addEventListener("click", () => {
      const id = config?.id || resolveDefaultAssignmentId();
      location.href = studioUrl(`?mode=builder&id=${encodeURIComponent(id)}`);
    });

    document.getElementById("teacherBtn")?.addEventListener("click", () => {
      const id = config?.id || resolveDefaultAssignmentId();
      location.href = studioUrl(`?id=${encodeURIComponent(id)}&teacher=1`);
    });
  }

  function renderClassroomReferenceTable() {
    if (!VALID_CLASSROOMS.length) {
      return `<p class="dw-muted">No classes configured yet.</p>`;
    }
    return `
      <div class="wf-class-table-wrap">
        <table class="wf-class-table">
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Code</th>
            </tr>
          </thead>
          <tbody>
            ${VALID_CLASSROOMS.map((classroom) => {
              const code = CLASSROOM_CODES[classroom] || "";
              return `<tr>
                <td>${escapeHtml(classroom)}</td>
                <td><code class="wf-class-code">${escapeHtml(code || "—")}</code></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderBuilder() {
    const nav = document.getElementById("builderNav");
    if (nav) {
      const titleEl = nav.querySelector(".wf-builder-nav__title");
      const sectionsHtml = (window.WriteFlowDefaults?.BUILDER_SECTIONS || []).map((s) => `
        <button class="wf-nav-item${builderSection === s.id ? " wf-nav-item--active" : ""}" type="button" data-section="${s.id}" title="${escapeHtml(s.hint || "")}">
          ${s.icon} ${escapeHtml(s.label)}
        </button>`).join("");
      nav.innerHTML = `${titleEl ? titleEl.outerHTML : '<p class="wf-builder-nav__title">Settings</p>'}${sectionsHtml}`;
      nav.querySelectorAll(".wf-nav-item").forEach((btn) => {
        btn.addEventListener("click", () => { builderSection = btn.dataset.section; renderBuilder(); });
      });
    }

    const canvas = document.getElementById("builderCanvas");
    if (!canvas) return;

    if (builderSection === "templates") {
      if (activeTemplateId) {
        canvas.innerHTML = `${builderSectionHeader("templates")}${renderTemplateWizard(activeTemplateId)}`;
        bindTemplateWizard(activeTemplateId);
      } else {
        canvas.innerHTML = `
          ${builderSectionHeader("templates")}
          <p class="dw-muted">Pick a template, answer a few short questions, and WriteFlow builds the assignment for you. You can edit everything before sharing.</p>
          <div class="wf-template-grid" id="builderTemplateGrid" role="list"></div>`;
        renderTemplateGallery("builderTemplateGrid", (id) => {
          activeTemplateId = id;
          renderBuilder();
        });
      }
    } else if (builderSection === "content") {
      canvas.innerHTML = `
        ${builderSectionHeader("content")}
        <label class="dw-field"><span class="dw-label">Assignment title</span><span class="dw-muted dw-tiny">Shown in the browser tab and top bar</span><input id="bfTitle" class="dw-input" value="${escapeHtml(config.title)}" /></label>
        <label class="dw-field"><span class="dw-label">Subtitle</span><span class="dw-muted dw-tiny">Short line under the title</span><input id="bfSubtitle" class="dw-input" value="${escapeHtml(config.subtitle)}" /></label>
        <label class="dw-field"><span class="dw-label">Welcome headline</span><span class="dw-muted dw-tiny">First thing students read</span><input id="bfWelcomeTitle" class="dw-input" value="${escapeHtml(config.welcomeTitle || "")}" /></label>
        <label class="dw-field"><span class="dw-label">Welcome intro</span><span class="dw-muted dw-tiny">Brief instructions before they start</span><textarea id="bfWelcomeLead" class="dw-textarea" rows="3">${escapeHtml(config.welcomeLead || "")}</textarea></label>
        <label class="dw-field"><span class="dw-label">Writing prompt</span><span class="dw-muted dw-tiny">The main question or task</span><textarea id="bfPrompt" class="dw-textarea" rows="4">${escapeHtml(config.prompt)}</textarea></label>
        <label class="dw-field"><span class="dw-label">In-session prompt banner</span><span class="dw-muted dw-tiny">Stays visible while students type</span><input id="bfPromptBanner" class="dw-input" value="${escapeHtml(config.promptBanner || "")}" /></label>
        <label class="dw-field"><span class="dw-label">Expected vocabulary</span><span class="dw-muted dw-tiny">Comma or line-separated words students should use — highlighted in Results</span><textarea id="bfVocab" class="dw-textarea" rows="3" placeholder="photosynthesis, chlorophyll, glucose">${escapeHtml((config.vocabWords || []).join(", "))}</textarea></label>
        <label class="wf-toggle-row"><input id="bfHighlightVocab" type="checkbox" ${config.highlightVocab !== false ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Highlight vocabulary in teacher view</strong><span class="wf-toggle-row__hint">Marks expected words in submission previews</span></span></label>
        <label class="dw-field"><span class="dw-label">Teacher password</span><span class="dw-muted dw-tiny">Required to open Results for this assignment</span><input id="bfTeacherPw" class="dw-input" type="password" autocomplete="new-password" value="${escapeHtml(config.teacherPassword)}" /></label>`;
      bindBuilderField("bfTitle", "title");
      bindBuilderField("bfSubtitle", "subtitle");
      bindBuilderField("bfWelcomeTitle", "welcomeTitle");
      bindBuilderField("bfWelcomeLead", "welcomeLead");
      bindBuilderField("bfPrompt", "prompt");
      bindBuilderField("bfPromptBanner", "promptBanner");
      bindBuilderField("bfTeacherPw", "teacherPassword");
      document.getElementById("bfVocab")?.addEventListener("change", (e) => {
        config.vocabWords = window.WriteFlowDefaults?.parseVocabInput?.(e.target.value) || [];
        persistConfig();
      });
      document.getElementById("bfHighlightVocab")?.addEventListener("change", (e) => {
        config.highlightVocab = e.target.checked;
        persistConfig();
      });
    } else if (builderSection === "timer") {
      canvas.innerHTML = `
        ${builderSectionHeader("timer")}
        <label class="dw-field">
          <span class="dw-label">Duration (seconds)</span>
          <span class="dw-muted dw-tiny">Students write until the timer hits zero · about ${escapeHtml(formatDurationLabel(config.durationSec))}</span>
          <input id="bfDuration" class="dw-input" type="number" min="60" max="3600" step="30" value="${config.durationSec}" />
        </label>
        <label class="dw-field">
          <span class="dw-label">Minimum word count</span>
          <span class="dw-muted dw-tiny">0 = no minimum. Use with &ldquo;End early&rdquo; or &ldquo;Require minimum words&rdquo; to support different learners.</span>
          <input id="bfMinWords" class="dw-input" type="number" min="0" max="2000" step="5" value="${Math.max(0, Number(config.minWordCount) || 0)}" />
        </label>
        <div class="wf-toggle-list">
          <label class="wf-toggle-row"><input id="bfAllowPaste" type="checkbox" ${config.allowPaste ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Allow paste</strong><span class="wf-toggle-row__hint">Off = students must type their own words</span></span></label>
          <label class="wf-toggle-row"><input id="bfSpellcheck" type="checkbox" ${resolveSpellcheck() ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Spellcheck in typing window</strong><span class="wf-toggle-row__hint">Browser underlines possible spelling errors while students write</span></span></label>
          <label class="wf-toggle-row"><input id="bfAllowEndEarly" type="checkbox" ${config.allowEndEarly ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Allow end early</strong><span class="wf-toggle-row__hint">Students can tap &ldquo;I&rsquo;m done&rdquo; before the timer ends</span></span></label>
          <label class="wf-toggle-row"><input id="bfLockAfter" type="checkbox" ${config.lockAfterTime ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Lock editor when time expires</strong><span class="wf-toggle-row__hint">Prevents edits after the timer ends</span></span></label>
          <label class="wf-toggle-row"><input id="bfLiveStats" type="checkbox" ${config.showLiveStats ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Show live word count &amp; WPM</strong><span class="wf-toggle-row__hint">Displays stats during writing</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireMinWords" type="checkbox" ${config.requireMinWordsToComplete ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require minimum words to finish</strong><span class="wf-toggle-row__hint">If time runs out first, students keep writing until they hit the word goal</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireName" type="checkbox" ${config.requireName ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require student name</strong><span class="wf-toggle-row__hint">First name before starting</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireClass" type="checkbox" ${config.requireClass ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require class selection</strong><span class="wf-toggle-row__hint">Pick from the class list</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireCode" type="checkbox" ${config.requireClassCode ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require class code</strong><span class="wf-toggle-row__hint">Secret code from the Classes tab</span></span></label>
        </div>`;
      const minWordsInput = document.getElementById("bfMinWords");
      minWordsInput?.addEventListener("change", (e) => {
        config.minWordCount = Math.max(0, Number(e.target.value) || 0);
        persistConfig();
      });
      const durationInput = document.getElementById("bfDuration");
      durationInput?.addEventListener("input", (e) => {
        config.durationSec = Number(e.target.value) || 300;
        const hint = durationInput.parentElement?.querySelector(".dw-tiny");
        if (hint) hint.textContent = `Students write until the timer hits zero · about ${formatDurationLabel(config.durationSec)}`;
      });
      durationInput?.addEventListener("change", (e) => { config.durationSec = Number(e.target.value) || 300; persistConfig(); renderInspector(); });
      ["bfAllowPaste", "bfSpellcheck", "bfAllowEndEarly", "bfLockAfter", "bfLiveStats", "bfRequireMinWords", "bfRequireName", "bfRequireClass", "bfRequireCode"].forEach((id) => {
        const map = {
          bfAllowPaste: "allowPaste",
          bfSpellcheck: "spellcheck",
          bfAllowEndEarly: "allowEndEarly",
          bfLockAfter: "lockAfterTime",
          bfLiveStats: "showLiveStats",
          bfRequireMinWords: "requireMinWordsToComplete",
          bfRequireName: "requireName",
          bfRequireClass: "requireClass",
          bfRequireCode: "requireClassCode",
        };
        document.getElementById(id)?.addEventListener("change", (e) => {
          config[map[id]] = e.target.checked;
          if (id === "bfSpellcheck") {
            config.accessibility = { ...mergeAccessibility(config.accessibility), spellcheck: e.target.checked };
          }
          persistConfig();
          if (id === "bfSpellcheck") applyAccessibility();
        });
      });
    } else if (builderSection === "appearance") {
      const fontKey = config.theme?.fontPreset || "google";
      canvas.innerHTML = `
        ${builderSectionHeader("appearance")}
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
    } else if (builderSection === "accessibility") {
      const a11y = mergeAccessibility(config.accessibility);
      canvas.innerHTML = `
        ${builderSectionHeader("accessibility")}
        <p class="dw-muted">These options help you support students with different needs. Students see the settings you enable here.</p>
        <div class="wf-toggle-list">
          <label class="wf-toggle-row"><input id="bfA11yLarge" type="checkbox" ${a11y.largeText ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Larger text</strong><span class="wf-toggle-row__hint">Bigger prompt and writing area</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11yContrast" type="checkbox" ${a11y.highContrast ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>High contrast</strong><span class="wf-toggle-row__hint">Stronger text and border contrast</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11yDyslexia" type="checkbox" ${a11y.dyslexiaFont ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Dyslexia-friendly font</strong><span class="wf-toggle-row__hint">Uses OpenDyslexic for reading and writing</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11ySpell" type="checkbox" ${resolveSpellcheck() ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Spellcheck while typing</strong><span class="wf-toggle-row__hint">Same setting as Timer &amp; rules — browser underlines possible spelling errors</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11yMotion" type="checkbox" ${a11y.reducedMotion ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Reduce motion</strong><span class="wf-toggle-row__hint">Minimizes animations and smooth scrolling</span></span></label>
        </div>
        <p class="dw-muted dw-tiny">Tip: combine longer timers with minimum word counts and &ldquo;End early&rdquo; so fast finishers can submit while others keep working.</p>`;
      const bindA11y = (id, key, invert = false) => {
        document.getElementById(id)?.addEventListener("change", (e) => {
          config.accessibility = { ...mergeAccessibility(config.accessibility), [key]: invert ? !e.target.checked : e.target.checked };
          persistConfig();
          applyAccessibility();
        });
      };
      bindA11y("bfA11yLarge", "largeText");
      bindA11y("bfA11yContrast", "highContrast");
      bindA11y("bfA11yDyslexia", "dyslexiaFont");
      document.getElementById("bfA11ySpell")?.addEventListener("change", (e) => {
        config.spellcheck = e.target.checked;
        config.accessibility = { ...mergeAccessibility(config.accessibility), spellcheck: e.target.checked };
        persistConfig();
        applyAccessibility();
      });
      bindA11y("bfA11yMotion", "reducedMotion");
    } else if (builderSection === "classes") {
      canvas.innerHTML = `
        ${builderSectionHeader("classes")}
        <p class="dw-muted">Give each class the matching code below. Students enter it before they start writing.</p>
        <p class="dw-muted dw-tiny">Edit <code>api/diagnostic-writing/classes.json</code> and <code>classroom-codes.json</code>, then run <code>npm run sync:classrooms</code>.</p>
        ${renderClassroomReferenceTable()}`;
    } else if (builderSection === "preview") {
      canvas.innerHTML = `
        ${builderSectionHeader("preview")}
        <p class="dw-muted">This is how students will see the welcome screen.</p>
        <div class="wf-preview-frame dw-card">
          <h1 class="dw-h1">${escapeHtml(config.welcomeTitle || config.title)}</h1>
          <p class="dw-lead">${escapeHtml(config.welcomeLead || "")}</p>
          <blockquote class="dw-prompt-quote">${escapeHtml(config.prompt)}</blockquote>
          <button class="dw-btn" type="button" disabled>Start ${Core.formatTime(config.durationSec)} timer</button>
        </div>
        <div class="dw-row" style="margin-top:16px">
          <a class="dw-btn" href="${assignmentUrl(config.id)}" target="_blank" rel="noopener">Open student view</a>
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
        <p class="dw-muted dw-tiny">Used in the share link — use letters, numbers, and dashes only.</p>
        <input id="bfId" class="dw-input" value="${escapeHtml(config.id)}" />
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Save &amp; publish</div>
        <p class="dw-muted dw-tiny">Save publishes to the cloud so students can load this assignment from the share link.</p>
        <div class="dw-stack">
          <button id="bfSave" class="dw-btn" type="button">Save assignment</button>
          <p id="bfSaveStatus" class="wf-save-status dw-hidden" role="status"></p>
        </div>
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Share link</div>
        <p class="dw-muted dw-tiny">Send this URL to students — not the builder link.</p>
        <input id="bfShareLink" class="dw-input" readonly value="${location.origin}${assignmentUrl(config.id)}" />
        <button id="bfCopyLink" class="dw-btn dw-btn-secondary" type="button">Copy link</button>
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">More actions</div>
        <div class="dw-stack">
          <button id="bfExport" class="dw-btn dw-btn-secondary" type="button">Export JSON</button>
          <label class="dw-btn dw-btn-ghost" style="cursor:pointer">Import JSON<input id="bfImport" type="file" accept=".json" hidden /></label>
          <button id="bfNew" class="dw-btn dw-btn-ghost" type="button">New assignment</button>
          <button id="bfDeleteCurrent" class="dw-btn dw-btn-ghost wf-btn-danger" type="button">Delete this assignment</button>
        </div>
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
    document.getElementById("bfSave")?.addEventListener("click", async () => {
      persistConfig();
      showSaveStatus("Publishing…", true);
      try {
        await publishAssignmentCloud();
        showSaveStatus("Saved and published. Share link is ready for students.", true);
      } catch (err) {
        showSaveStatus(`Saved on this browser only. ${err.message}`, false);
      }
    });
    document.getElementById("bfCopyLink")?.addEventListener("click", async () => {
      const link = document.getElementById("bfShareLink")?.value || "";
      try {
        await navigator.clipboard.writeText(link);
        showSaveStatus("Share link copied to clipboard.", true);
      } catch {
        document.getElementById("bfShareLink")?.select();
        showSaveStatus("Select the link and copy it manually.", false);
      }
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

    document.getElementById("bfDeleteCurrent")?.addEventListener("click", async () => {
      const title = config.title || config.id;
      const ok = await showConfirmDialog({
        title: "Delete assignment?",
        body: `Delete "${title}" (${config.id}) from this browser? This cannot be undone. Cloud copies are not removed — duplicates there need to be cleaned up in your sheet if needed.`,
        confirmLabel: "Delete assignment",
        destructive: true,
      });
      if (!ok) return;
      const remaining = deleteAssignment(config.id);
      if (remaining.length) {
        const nextId = remaining[0];
        config = readLocalConfig(nextId) || { ...Defaults, id: nextId };
        history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(nextId)}`);
      } else {
        config = { ...Defaults, id: `assignment-${Date.now()}`, title: "Untitled Assignment" };
        persistConfig();
        history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(config.id)}`);
      }
      showSaveStatus("Assignment deleted from this browser.", true);
      renderBuilder();
    });

    const list = document.getElementById("bfAssignmentList");
    getAssignmentsList().forEach((id) => {
      const saved = readLocalConfig(id);
      const row = document.createElement("div");
      row.className = `wf-assignment-card${config.id === id ? " wf-assignment-card--active" : ""}`;
      row.innerHTML = `
        <button type="button" class="wf-assignment-card__open" data-id="${escapeHtml(id)}">
          <span class="wf-assignment-card__body">
            <span class="wf-assignment-card__title">${escapeHtml(saved?.title || id)}</span>
            <span class="wf-assignment-card__id">${escapeHtml(id)}</span>
          </span>
          <span class="wf-assignment-card__meta">Open →</span>
        </button>
        <button type="button" class="wf-assignment-card__delete" data-id="${escapeHtml(id)}" aria-label="Delete ${escapeHtml(saved?.title || id)}">Delete</button>`;
      row.querySelector(".wf-assignment-card__open")?.addEventListener("click", () => {
        config = saved || Core.loadConfig(STORAGE_PREFIX, id, { ...Defaults, id });
        history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(id)}`);
        renderBuilder();
      });
      row.querySelector(".wf-assignment-card__delete")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await showConfirmDialog({
          title: "Delete assignment?",
          body: `Delete "${saved?.title || id}" from this browser? This cannot be undone.`,
          confirmLabel: "Delete",
          destructive: true,
        });
        if (!ok) return;
        const wasCurrent = config.id === id;
        const remaining = deleteAssignment(id);
        if (wasCurrent) {
          if (remaining.length) {
            const nextId = remaining[0];
            config = readLocalConfig(nextId) || { ...Defaults, id: nextId };
            history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(nextId)}`);
          } else {
            config = { ...Defaults, id: `assignment-${Date.now()}`, title: "Untitled Assignment" };
            persistConfig();
            history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(config.id)}`);
          }
        }
        renderBuilder();
      });
      list?.appendChild(row);
    });
  }

  function persistConfig() {
    config.accessibility = mergeAccessibility(config.accessibility);
    if (config.minWordCount == null) config.minWordCount = 0;
    if (config.allowEndEarly == null) config.allowEndEarly = false;
    if (config.requireMinWordsToComplete == null) config.requireMinWordsToComplete = false;
    if (typeof config.spellcheck !== "boolean") {
      config.spellcheck = config.accessibility.spellcheck !== false;
    }
    config.accessibility.spellcheck = config.spellcheck;
    Core.saveConfig(STORAGE_PREFIX, config.id, config);
    const ids = getAssignmentsList();
    if (!ids.includes(config.id)) ids.push(config.id);
    saveAssignmentsList(ids);
    Core.applyTheme(Core.resolveTheme(config));
  }

  function initBuilder() {
    config = readLocalConfig(assignmentId) || Core.loadConfig(STORAGE_PREFIX, assignmentId, { ...Defaults, id: assignmentId });
    if (params.get("template")) {
      activeTemplateId = params.get("template");
      builderSection = "templates";
    }
    show("builder");
    document.getElementById("studentViewLink")?.addEventListener("click", () => {
      window.open(assignmentUrl(config.id), "_blank", "noopener");
    });
    renderBuilder();
  }

  function initHome() {
    Core.applyTheme(Core.resolveTheme({ ...Defaults, id: resolveDefaultAssignmentId() }));
    show("home");
    renderTemplateGallery("homeTemplateGrid", (id) => {
      location.href = studioUrl(`?mode=builder&template=${encodeURIComponent(id)}`);
    });
    document.getElementById("openBuilderBtn")?.addEventListener("click", () => {
      location.href = studioUrl("?mode=builder&section=templates");
    });
  }

  function initStudioApp() {
    Core.applyTheme(Core.resolveTheme({ ...Defaults, id: resolveDefaultAssignmentId() }));
    bindTopbarActions();
    initTutorial();
    if (mode === "builder") initBuilder();
    else if (params.get("teacher") === "1") void initTeacherPortal();
    else initHome();
  }

  if (isStudentApp) void initStudentFlow();
  else initStudioApp();
})();

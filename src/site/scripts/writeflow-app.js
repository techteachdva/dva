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
  const Teacher = () => window.WriteFlowTeacher;

  if (!Core || !Defaults) return;

  const APP_ROLE = window.WRITEFLOW_ROLE || "studio";
  const isStudentApp = APP_ROLE === "student";
  const isStudioApp = !isStudentApp;
  const STUDIO_PATH = "/writeflow/studio/";
  const ASSIGNMENT_PATH = "/writeflow/a/";
  function assignmentUrl(id) {
    return `${ASSIGNMENT_PATH}?id=${encodeURIComponent(id)}`;
  }

  function studioUrl(query = "") {
    if (!query) return STUDIO_PATH;
    return `${STUDIO_PATH}${query.startsWith("?") ? query : `?${query}`}`;
  }

  const params = new URLSearchParams(location.search);
  let studioMode = isStudentApp ? "student" : (params.get("mode") === "builder" ? "builder" : "studio");
  const assignmentId = params.get("id") || (isStudentApp ? "" : "sample-persuasive");

  const BOOT_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  function isBuilderMode() {
    return studioMode === "builder";
  }

  let config = { ...Defaults, id: assignmentId };
  let timer = null;
  let allSubmissions = [];
  let teacherAuthed = false;
  let sessionTeacherPassword = "";
  let cloudAssignmentMeta = {};
  let sharedAssignmentMeta = [];
  let tutorialIndex = 0;
  let tutorialContextKey = "home";
  let tutorialHighlightEl = null;

  const TUTORIAL_STEPS = window.WriteFlowDefaults?.TUTORIAL_STEPS || {};
  const ASSIGNMENT_TEMPLATES = window.WriteFlowDefaults?.ASSIGNMENT_TEMPLATES || [];
  const ASSIGNMENT_MODES = window.WriteFlowDefaults?.ASSIGNMENT_MODES || [];
  const DIFFERENTIATION_PRESETS = window.WriteFlowDefaults?.DIFFERENTIATION_PRESETS || [];

  function resolveTimerStyle() {
    return window.WriteFlowDefaults?.resolveTimerStyle?.(config) || config.timerStyle || "hard";
  }

  function resolveShowLiveWpm() {
    return window.WriteFlowDefaults?.resolveShowLiveWpm?.(config) || !!config.showLiveWpm;
  }

  function getActiveRubrics() {
    return window.WriteFlowDefaults?.resolveRubrics?.(config) || config.rubrics || ["typing", "mechanics", "story"];
  }

  function getAnalysisOptions() {
    return {
      vocabWords: getVocabWords(),
      assignmentMode: config.assignmentMode || "composition",
      rubrics: getActiveRubrics(),
    };
  }

  let timerWaitingForMinWords = false;
  let studentSession = { name: "", classroom: "", classCode: "" };
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

  function slugifyAssignmentName(text) {
    return window.WriteFlowDefaults?.slugify?.(text) || String(text || "assignment").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  }

  function ensureUniqueAssignmentId(baseName) {
    const existing = getAssignmentsList();
    return window.WriteFlowDefaults?.uniqueSlug?.(baseName, existing)
      || slugifyAssignmentName(baseName);
  }

  function promptAssignmentName(defaultName = "") {
    return new Promise((resolve) => {
      const overlay = document.getElementById("wfNameModal");
      const input = document.getElementById("wfNameModalInput");
      const slugEl = document.getElementById("wfNameModalSlug");
      const okBtn = document.getElementById("wfNameModalOk");
      const cancelBtn = document.getElementById("wfNameModalCancel");
      const backdrop = document.getElementById("wfNameModalBackdrop");
      if (!overlay || !input || !okBtn || !cancelBtn) {
        const name = window.prompt("Assignment name:", defaultName || "");
        resolve(name?.trim() || null);
        return;
      }

      const updateSlug = () => {
        if (slugEl) slugEl.textContent = ensureUniqueAssignmentId(input.value || "assignment");
      };

      input.value = defaultName || "";
      updateSlug();
      overlay.classList.remove("dw-hidden");
      input.focus();
      input.select();

      function cleanup(result) {
        overlay.classList.add("dw-hidden");
        input.removeEventListener("input", updateSlug);
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        backdrop?.removeEventListener("click", onCancel);
        document.removeEventListener("keydown", onKey);
        resolve(result);
      }

      function onOk() {
        const name = input.value.trim();
        if (!name) {
          input.focus();
          return;
        }
        cleanup(name);
      }
      function onCancel() { cleanup(null); }
      function onKey(e) {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") onOk();
      }

      input.addEventListener("input", updateSlug);
      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      backdrop?.addEventListener("click", onCancel);
      document.addEventListener("keydown", onKey);
    });
  }

  function assignmentModeIcon(mode) {
    const icons = { composition: "✏️", fluency: "⌨️", typing_practice: "⌨️", reflection: "💭" };
    return icons[mode] || "📄";
  }

  function assignmentTileSummary(saved = {}) {
    const mode = window.WriteFlowDefaults?.formatModeLabel?.(saved.assignmentMode) || "composition";
    const mins = Math.max(1, Math.round((Number(saved.durationSec) || 300) / 60));
    return `${mins} min · ${mode}`;
  }

  function renderTemplateDefaultsList(template) {
    const lines = template?.defaultsPreview || [];
    if (!lines.length) return "";
    return `<ul class="wf-template-card__defaults">${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
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
    if (welcomeLead) {
      welcomeLead.textContent = config.welcomeLead || "";
      welcomeLead.classList.toggle("dw-hidden", !config.welcomeLead);
    }

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

    const heroWrap = document.getElementById("heroImageWrap");
    const heroImg = document.getElementById("heroImage");
    const heroSrc = heroImageSrc();
    if (heroImg && heroSrc) {
      heroImg.src = heroSrc;
      heroWrap?.classList.remove("dw-hidden");
    } else {
      heroImg?.removeAttribute("src");
      heroWrap?.classList.add("dw-hidden");
    }

    const liveStatsBar = document.getElementById("liveStatsBar");
    if (liveStatsBar) liveStatsBar.classList.toggle("dw-hidden", !config.showLiveStats);

    const wpmStat = document.getElementById("wpmStat");
    if (wpmStat) wpmStat.classList.toggle("dw-hidden", !resolveShowLiveWpm());

    const timerStyle = resolveTimerStyle();
    const timeStat = document.getElementById("timeStat");
    const timerTrack = document.getElementById("timerTrack");
    const timerStatLabel = document.getElementById("timerStatLabel");
    if (timeStat) timeStat.classList.toggle("dw-hidden", timerStyle === "none");
    if (timerTrack) timerTrack.classList.toggle("dw-hidden", timerStyle === "none");
    if (timerStatLabel) {
      timerStatLabel.textContent = timerStyle === "goal" ? "Elapsed" : "Time";
    }

    const startersEl = document.getElementById("sentenceStarters");
    const starters = String(config.sentenceStarters || "").trim();
    if (startersEl) {
      if (starters) {
        startersEl.classList.remove("dw-hidden");
        startersEl.innerHTML = `<strong>Sentence starters:</strong> ${escapeHtml(starters)}`;
      } else {
        startersEl.classList.add("dw-hidden");
        startersEl.innerHTML = "";
      }
    }

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
      const isGif = file.type === "image/gif";
      const maxSize = isGif ? 2500000 : 750000;
      const maxLabel = isGif ? "2.5 MB" : "750 KB";
      if (file.size > maxSize) {
        reject(new Error(`Image must be under ${maxLabel}. For share links, use a direct image/GIF URL instead.`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function heroImageSrc() {
    return config.heroImageData || config.heroImage || "";
  }

  function setHeroPreview(container, src) {
    if (!container) return;
    if (!src) {
      container.classList.add("dw-hidden");
      container.innerHTML = "";
      return;
    }
    container.classList.remove("dw-hidden");
    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.className = container.classList.contains("wf-student-hero")
      ? "wf-student-hero__img"
      : "wf-hero-preview__img";
    img.loading = "lazy";
    container.appendChild(img);
  }

  function scrollToMainTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("mainContent")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function show(name) {
    Core.showView(views, name, shell, "teacher");
    scrollToMainTop();
    updateTopbarActiveState(name);
  }

  function updateTopbarActiveState(activeView = "") {
    if (!isStudioApp) return;
    const homeActive = activeView === "home";
    const resultsActive = activeView === "teacher" || activeView === "teacherLogin";
    document.getElementById("builderLinkBtn")?.classList.toggle("wf-topbar-btn--active", homeActive);
    document.getElementById("teacherBtn")?.classList.toggle("wf-topbar-btn--active", resultsActive);
  }

  function initBootLoader() {
    const track = document.getElementById("wfBootAlphabet");
    if (!track || track.childElementCount) return;
    track.innerHTML = BOOT_ALPHABET.map((ch) =>
      `<span class="wf-boot-loader__letter">${escapeHtml(ch)}</span>`
    ).join("");
  }

  function setBootProgress(ratio) {
    const letters = document.querySelectorAll("#wfBootAlphabet .wf-boot-loader__letter");
    const total = letters.length;
    if (!total) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    const filled = Math.min(total, Math.ceil(clamped * total - 1e-6));
    letters.forEach((el, i) => {
      el.classList.toggle("wf-boot-loader__letter--on", i < filled);
    });
  }

  function showBootLoader(visible = true) {
    const el = document.getElementById("wfBootLoader");
    if (!el) return;
    el.classList.toggle("dw-hidden", !visible);
    el.setAttribute("aria-busy", visible ? "true" : "false");
  }

  async function ownsAssignment(assignmentId) {
    const session = Teacher()?.getSession();
    if (!session?.username || !assignmentId) return false;
    const norm = normalizeUsername(session.username);
    if (normalizeUsername(config?.ownerUsername) === norm) return true;
    if (normalizeUsername(cloudAssignmentMeta[assignmentId]?.ownerUsername) === norm) return true;
    if (Teacher()?.canAccessResults) {
      try {
        if (await Teacher().canAccessResults(assignmentId)) return true;
      } catch {
        /* ignore */
      }
    }
    try {
      const items = await Teacher().listMyAssignments();
      return items.some((item) => item.assignmentId === assignmentId);
    } catch {
      return false;
    }
  }

  function showHomeView({ resultsPicker = false } = {}) {
    studioMode = "studio";
    document.getElementById("wfTeacherPickerBanner")?.classList.toggle("dw-hidden", !resultsPicker);
    Core.applyTheme(Core.resolveTheme({ ...Defaults, id: resolveDefaultAssignmentId() }));
    show("home");
    renderHomeDashboard();
    void refreshSharedLibrary();
  }

  async function navigateToHome({ resultsPicker = false } = {}) {
    teacherAuthed = false;
    sessionTeacherPassword = "";
    const query = resultsPicker ? "?teacher=1" : "";
    history.replaceState(null, "", studioUrl(query));
    showHomeView({ resultsPicker });
  }

  async function navigateToNewAssignment({ templateId = "", section = "templates", name = "" } = {}) {
    let assignmentName = name?.trim() || "";
    if (!assignmentName) {
      assignmentName = await promptAssignmentName();
      if (!assignmentName) return;
    }

    studioMode = "builder";
    activeTemplateId = templateId || "";
    builderSection = section || (templateId ? "templates" : "content");
    const id = ensureUniqueAssignmentId(assignmentName);
    config = {
      ...Defaults,
      id,
      title: assignmentName,
      teacherPassword: `wf${Math.random().toString(36).slice(2, 10)}`,
    };
    persistConfig();
    const qs = new URLSearchParams({ mode: "builder", id: config.id });
    if (section) qs.set("section", section);
    if (templateId) qs.set("template", templateId);
    history.replaceState(null, "", studioUrl(`?${qs}`));
    show("builder");
    applyConfigToUI();
    Core.applyTheme(Core.resolveTheme(config));
    renderBuilder();
  }

  async function navigateToResults(assignmentId) {
    if (!assignmentId) {
      await navigateToHome({ resultsPicker: true });
      return;
    }
    studioMode = "studio";
    config = (await loadAssignmentForEdit(assignmentId));
    applyConfigToUI();
    history.replaceState(null, "", studioUrl(`?id=${encodeURIComponent(assignmentId)}&teacher=1`));

    if (await ownsAssignment(assignmentId)) {
      teacherAuthed = true;
      sessionTeacherPassword = config.teacherPassword || "";
      show("teacher");
      await loadTeacherDashboard();
      return;
    }

    teacherAuthed = false;
    sessionTeacherPassword = "";
    const pwEl = document.getElementById("teacherPassword");
    if (pwEl) pwEl.value = "";
    document.getElementById("teacherLoginError")?.classList.add("dw-hidden");
    show("teacherLogin");
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
    const overlay = document.getElementById("wfTutorial");
    overlay?.classList.remove("wf-tutorial--spotlight");
    const backdrop = document.getElementById("tutorialBackdrop");
    const panel = overlay?.querySelector(".wf-tutorial__panel");
    if (backdrop) backdrop.style.removeProperty("clip-path");
    if (panel) {
      panel.style.removeProperty("marginTop");
      panel.style.removeProperty("marginBottom");
    }
    if (overlay) {
      overlay.style.removeProperty("alignItems");
    }
    if (tutorialHighlightEl) {
      tutorialHighlightEl.classList.remove("wf-tutorial-highlight");
      tutorialHighlightEl = null;
    }
  }

  function highlightCoversMostOfViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const viewportArea = window.innerWidth * window.innerHeight;
    const elArea = rect.width * rect.height;
    return elArea / viewportArea > 0.45 || rect.height > window.innerHeight * 0.55;
  }

  function pinTutorialPanel(position = "bottom") {
    const overlay = document.getElementById("wfTutorial");
    const panel = overlay?.querySelector(".wf-tutorial__panel");
    if (!overlay || !panel) return;
    panel.style.marginTop = "";
    panel.style.marginBottom = "";
    if (position === "top") {
      overlay.style.alignItems = "flex-start";
      panel.style.marginTop = "max(16px, env(safe-area-inset-top, 0))";
    } else {
      overlay.style.alignItems = "flex-end";
      panel.style.marginBottom = "max(16px, env(safe-area-inset-bottom, 0))";
    }
  }

  function positionTutorialSpotlight(el) {
    const overlay = document.getElementById("wfTutorial");
    const backdrop = document.getElementById("tutorialBackdrop");
    const panel = overlay?.querySelector(".wf-tutorial__panel");
    if (!el || !overlay || !backdrop) return;

    if (highlightCoversMostOfViewport(el)) {
      backdrop.style.removeProperty("clip-path");
      pinTutorialPanel("bottom");
      return;
    }

    const pad = 10;
    const rect = el.getBoundingClientRect();
    const x1 = Math.max(0, rect.left - pad);
    const y1 = Math.max(0, rect.top - pad);
    const x2 = Math.min(window.innerWidth, rect.right + pad);
    const y2 = Math.min(window.innerHeight, rect.bottom + pad);

    backdrop.style.clipPath = `polygon(
      evenodd,
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      ${x1}px ${y1}px,
      ${x1}px ${y2}px,
      ${x2}px ${y2}px,
      ${x2}px ${y1}px,
      ${x1}px ${y1}px
    )`;

    if (panel) {
      const panelRect = panel.getBoundingClientRect();
      const panelH = panelRect.height || 220;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const panelFitsBelow = spaceBelow >= panelH + 24;
      const panelFitsAbove = spaceAbove >= panelH + 24;

      if (panelFitsBelow && (spaceBelow >= spaceAbove || !panelFitsAbove)) {
        pinTutorialPanel("bottom");
      } else if (panelFitsAbove) {
        pinTutorialPanel("top");
      } else {
        backdrop.style.removeProperty("clip-path");
        pinTutorialPanel("bottom");
      }
    }
  }

  function applyTutorialHighlight(selector) {
    clearTutorialHighlight();
    const overlay = document.getElementById("wfTutorial");
    if (!selector) {
      pinTutorialPanel("bottom");
      return;
    }
    const el = document.querySelector(selector);
    if (!el) {
      pinTutorialPanel("bottom");
      return;
    }

    tutorialHighlightEl = el;
    el.classList.add("wf-tutorial-highlight");
    overlay?.classList.add("wf-tutorial--spotlight");

    const useSoftHighlight = highlightCoversMostOfViewport(el);
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });

    requestAnimationFrame(() => {
      if (useSoftHighlight) {
        const backdrop = document.getElementById("tutorialBackdrop");
        backdrop?.style.removeProperty("clip-path");
        pinTutorialPanel("bottom");
      } else {
        positionTutorialSpotlight(el);
      }
      requestAnimationFrame(() => {
        if (!useSoftHighlight) positionTutorialSpotlight(el);
        else pinTutorialPanel("bottom");
      });
    });
  }

  function currentTutorialSteps() {
    return TUTORIAL_STEPS[tutorialContextKey] || TUTORIAL_STEPS.studio || [];
  }

  function getTutorialContext() {
    if (isBuilderMode()) return "builder";
    if (!isStudentApp) return "studio";
    return "student";
  }

  function renderTutorialStep() {
    const steps = currentTutorialSteps();
    const step = steps[tutorialIndex];
    const overlay = document.getElementById("wfTutorial");
    if (!step || !overlay) return;

    if (step.section && isBuilderMode()) {
      builderSection = step.section;
      renderBuilder();
    }

    document.getElementById("wfTutorialTitle").textContent = step.title;
    document.getElementById("wfTutorialBody").textContent = step.body;
    document.getElementById("wfTutorialStep").textContent = `${tutorialIndex + 1} / ${steps.length}`;
    document.getElementById("wfTutorialEyebrow").textContent =
      tutorialContextKey === "builder" ? "Builder guide" : tutorialContextKey === "student" ? "Student guide" : "Studio guide";

    const backBtn = document.getElementById("tutorialBackBtn");
    const nextBtn = document.getElementById("tutorialNextBtn");
    if (backBtn) backBtn.disabled = tutorialIndex === 0;
    if (nextBtn) nextBtn.textContent = tutorialIndex >= steps.length - 1 ? "Done" : "Next";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => applyTutorialHighlight(step.highlight));
    });
  }

  function closeTutorial(markSeen = true) {
    const overlay = document.getElementById("wfTutorial");
    overlay?.classList.add("dw-hidden");
    clearTutorialHighlight();
    if (markSeen) {
      try {
        localStorage.setItem(`writeflow:tutorial:studio:${Defaults?.APP_VERSION || "2.3.2"}`, "1");
        localStorage.setItem(`writeflow:tutorial:${tutorialContextKey}`, "1");
      } catch {}
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
    document.getElementById("openTutorialHomeBtn")?.addEventListener("click", () => openTutorial("studio"));
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
    const tutorialKey = `writeflow:tutorial:studio:${Defaults?.APP_VERSION || "2.3.2"}`;
    try {
      if (!isStudentApp && !isBuilderMode() && localStorage.getItem(tutorialKey) !== "1") {
        setTimeout(() => openTutorial("studio"), 500);
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

  function captureStudentSession() {
    const classEl = document.getElementById("studentClass");
    studentSession = {
      name: document.getElementById("studentName")?.value.trim() || "",
      classroom: Core.resolveClassroom(classEl?.value, VALID_CLASSROOMS) || "",
      classCode: Core.normalizeClassCode(document.getElementById("classCode")?.value || ""),
    };
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
    const timerStyle = resolveTimerStyle();
    const maxDuration = timerStyle === "none" || timerStyle === "goal" || timerStyle === "soft"
      ? Math.max(timer?.getElapsed() || config.durationSec, 1)
      : config.durationSec;
    const duration = Math.min(Math.max(timer?.getElapsed() || config.durationSec, 1), maxDuration);
    const analysisOpts = getAnalysisOptions();
    const analysis = window.WriteAnalysis?.analyzeText(text, duration, analysisOpts)
      || { scores: {}, wordCount: 0, wpm: 0, feedback: [], sentenceCount: 0 };
    const name = studentSession.name || document.getElementById("studentName")?.value.trim() || "Student";
    const classEl = document.getElementById("studentClass");
    const classroom = studentSession.classroom || Core.resolveClassroom(classEl?.value, VALID_CLASSROOMS) || "";
    const classCode = studentSession.classCode
      || Core.normalizeClassCode(document.getElementById("classCode")?.value || "");

    const resultNameEl = document.getElementById("resultName");
    const resultSummaryEl = document.getElementById("resultSummary");
    if (resultNameEl) resultNameEl.textContent = name;
    const resultClassEl = document.getElementById("resultClass");
    if (resultClassEl) resultClassEl.textContent = classroom || "—";

    const mode = config.assignmentMode || "composition";
    const rubrics = getActiveRubrics();
    let summaryText;
    if (isStudentApp && (mode === "composition" || mode === "reflection")) {
      summaryText = `You wrote ${analysis.wordCount} words in ${Core.formatTime(duration)}. Your ideas are saved — revision and polish come next.`;
    } else if (isStudentApp) {
      summaryText = `You wrote ${analysis.wordCount} words in ${Core.formatTime(duration)} (${analysis.wpm} WPM).`;
    } else {
      summaryText = `You wrote ${analysis.wordCount} words in ${Core.formatTime(duration)} (${analysis.wpm} WPM). Overall: ${analysis.scores?.overall ?? "—"}/100`;
    }
    if (resultSummaryEl) resultSummaryEl.textContent = summaryText;

    const vocabEl = document.getElementById("vocabResult");
    if (vocabEl && getVocabWords().length && analysis.vocabulary) {
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
      scoreGrid.innerHTML = R.studentScoreCards(analysis, rubrics).map((c) => `
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
        requireClassCode: config.requireClassCode !== false,
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
    const sessionToken = Teacher()?.getToken() || "";
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "registerAssignment",
        assignmentId: config.id,
        teacherPassword: config.teacherPassword,
        title: config.title,
        config,
        sessionToken,
        shared: !!config.shared,
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
    const sessionToken = Teacher()?.getToken() || "";
    const qs = new URLSearchParams({ assignmentId: config.id });
    if (sessionToken) qs.set("sessionToken", sessionToken);
    else if (pw) qs.set("password", pw);
    const res = await fetch(`${API_URL}?${qs}`);
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
      timerStyle: resolveTimerStyle(),
      onComplete: finishWriting,
      onSoftExpire: () => {
        const notice = document.getElementById("timerExtendNotice");
        if (notice) {
          notice.textContent = "Suggested time is up — take a moment to wrap up, then tap \"I'm done\" when you're ready.";
          notice.classList.remove("dw-hidden");
        }
      },
    });

    Core.setupLiveStats(
      storyInput,
      document.getElementById("liveWordCount"),
      document.getElementById("liveWpm"),
      () => timer?.getElapsed() || 0,
      { showWpm: resolveShowLiveWpm() }
    );
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
      captureStudentSession();
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

  function updateAccountButton() {
    const btn = document.getElementById("wfAccountBtn");
    const session = Teacher()?.getSession();
    if (!btn) return;
    if (session?.displayName || session?.username) {
      btn.textContent = session.displayName || session.username;
      btn.setAttribute("aria-label", `Account: ${session.displayName || session.username}`);
    } else {
      btn.textContent = "Sign in";
      btn.setAttribute("aria-label", "Sign in to your teacher account");
    }
  }

  function showAccountPanel(showPanel = true) {
    const panel = document.getElementById("wfAccountPanel");
    panel?.classList.toggle("dw-hidden", !showPanel);
    if (showPanel) renderAccountPanel();
  }

  function renderAccountPanel() {
    const session = Teacher()?.getSession();
    const signedOut = document.getElementById("wfAccountSignedOut");
    const signedIn = document.getElementById("wfAccountSignedIn");
    const errEl = document.getElementById("wfAccountError");
    errEl?.classList.add("dw-hidden");

    if (session?.username) {
      signedOut?.classList.add("dw-hidden");
      signedIn?.classList.remove("dw-hidden");
      const nameEl = document.getElementById("wfAccountDisplayName");
      const userEl = document.getElementById("wfAccountUsername");
      if (nameEl) nameEl.textContent = session.displayName || session.username;
      if (userEl) userEl.textContent = session.username;
    } else {
      signedOut?.classList.remove("dw-hidden");
      signedIn?.classList.add("dw-hidden");
    }
    updateAccountButton();
  }

  function bindAccountEvents() {
    document.getElementById("wfAccountBtn")?.addEventListener("click", () => {
      const panel = document.getElementById("wfAccountPanel");
      const isOpen = panel && !panel.classList.contains("dw-hidden");
      showAccountPanel(!isOpen);
    });
    document.getElementById("wfAccountCloseBtn")?.addEventListener("click", () => showAccountPanel(false));

    document.getElementById("wfAccountTabLogin")?.addEventListener("click", () => {
      document.getElementById("wfAccountTabLogin")?.classList.add("wf-account-tab--active");
      document.getElementById("wfAccountTabRegister")?.classList.remove("wf-account-tab--active");
      document.getElementById("wfLoginForm")?.classList.remove("dw-hidden");
      document.getElementById("wfRegisterForm")?.classList.add("dw-hidden");
      document.getElementById("wfAccountError")?.classList.add("dw-hidden");
    });
    document.getElementById("wfAccountTabRegister")?.addEventListener("click", () => {
      document.getElementById("wfAccountTabRegister")?.classList.add("wf-account-tab--active");
      document.getElementById("wfAccountTabLogin")?.classList.remove("wf-account-tab--active");
      document.getElementById("wfRegisterForm")?.classList.remove("dw-hidden");
      document.getElementById("wfLoginForm")?.classList.add("dw-hidden");
      document.getElementById("wfAccountError")?.classList.add("dw-hidden");
    });

    document.getElementById("wfLoginForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("wfAccountError");
      const username = document.getElementById("wfLoginUsername")?.value || "";
      const password = document.getElementById("wfLoginPassword")?.value || "";
      try {
        await Teacher()?.login(username, password);
        renderAccountPanel();
        await refreshCloudAssignments();
        await refreshSharedLibrary();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not sign in.";
          errEl.classList.remove("dw-hidden");
        }
      }
    });

    document.getElementById("wfRegisterForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = document.getElementById("wfAccountError");
      const username = document.getElementById("wfRegisterUsername")?.value || "";
      const displayName = document.getElementById("wfRegisterDisplayName")?.value || "";
      const password = document.getElementById("wfRegisterPassword")?.value || "";
      try {
        await Teacher()?.register(username, password, displayName);
        renderAccountPanel();
        await refreshCloudAssignments();
        await refreshSharedLibrary();
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not create account.";
          errEl.classList.remove("dw-hidden");
        }
      }
    });

    document.getElementById("wfAccountLogoutBtn")?.addEventListener("click", async () => {
      await Teacher()?.logout();
      cloudAssignmentMeta = {};
      renderAccountPanel();
      renderHomeDashboard();
      renderSharedLibrary();
    });
  }

  async function refreshCloudAssignments() {
    if (!Teacher()?.isLoggedIn()) {
      cloudAssignmentMeta = {};
      renderHomeDashboard();
      return;
    }
    try {
      const items = await Teacher().listMyAssignments();
      cloudAssignmentMeta = {};
      for (const item of items) {
        cloudAssignmentMeta[item.assignmentId] = item;
        const ids = getAssignmentsList();
        if (!ids.includes(item.assignmentId)) {
          saveAssignmentsList([...ids, item.assignmentId]);
        }
      }
    } catch {
      cloudAssignmentMeta = {};
    }
    renderHomeDashboard();
  }

  async function refreshSharedLibrary() {
    const section = document.getElementById("wfSharedLibrary");
    try {
      sharedAssignmentMeta = await Teacher()?.listSharedAssignments() || [];
    } catch {
      sharedAssignmentMeta = [];
    }
    const hasShared = sharedAssignmentMeta.length > 0;
    section?.classList.toggle("dw-hidden", !hasShared);
    renderSharedLibrary();
  }

  function renderSharedAssignmentCard(item) {
    const title = item.title || item.assignmentId;
    const author = item.authorDisplayName || item.ownerUsername || "A teacher";
    return `
      <article class="wf-assignment-hub-card wf-assignment-hub-card--shared" role="listitem" data-shared-id="${escapeHtml(item.assignmentId)}">
        <div class="wf-assignment-hub-card__main">
          <h3 class="wf-assignment-hub-card__title">${escapeHtml(title)}</h3>
          <p class="wf-assignment-hub-card__id"><code>${escapeHtml(item.assignmentId)}</code></p>
          <p class="dw-muted dw-tiny">Shared by ${escapeHtml(author)}</p>
        </div>
        <div class="wf-assignment-hub-card__actions">
          <button class="dw-btn" type="button" data-action="copy-shared" data-id="${escapeHtml(item.assignmentId)}" data-title="${escapeHtml(title)}">Copy to my assignments</button>
        </div>
      </article>`;
  }

  function renderSharedLibrary() {
    const el = document.getElementById("wfSharedDashboard");
    if (!el) return;
    const session = Teacher()?.getSession();
    const items = sharedAssignmentMeta.filter((item) => {
      if (!session?.username) return true;
      return normalizeUsername(item.ownerUsername) !== normalizeUsername(session.username);
    });
    if (!items.length) {
      el.innerHTML = `<p class="dw-muted">No shared assignments yet. Teachers can enable sharing when they save an assignment.</p>`;
      return;
    }
    el.innerHTML = items.map((item) => renderSharedAssignmentCard(item)).join("");
    el.querySelectorAll("[data-action='copy-shared']").forEach((btn) => {
      btn.addEventListener("click", () => void copySharedAssignment(btn.dataset.id, btn.dataset.title));
    });
  }

  function normalizeUsername(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function copySharedAssignment(sourceId, title) {
    if (!Teacher()?.isLoggedIn()) {
      showAccountPanel(true);
      const errEl = document.getElementById("wfAccountError");
      if (errEl) {
        errEl.textContent = "Sign in to copy shared assignments.";
        errEl.classList.remove("dw-hidden");
      }
      return;
    }
    const defaultName = title ? `${title} (copy)` : "Shared assignment copy";
    const assignmentName = await promptAssignmentName(defaultName);
    if (!assignmentName) return;
    const newId = ensureUniqueAssignmentId(assignmentName);
    try {
      const data = await Teacher().copyAssignment(sourceId, newId, assignmentName);
      const next = { ...Defaults, ...data.config, id: data.assignmentId || newId, title: assignmentName };
      Core.saveConfig(STORAGE_PREFIX, next.id, next);
      const ids = getAssignmentsList();
      if (!ids.includes(next.id)) saveAssignmentsList([...ids, next.id]);
      await refreshCloudAssignments();
      await refreshSharedLibrary();
      await openAssignmentInBuilder(next.id);
      showSaveStatus(`Copied “${next.title}” into your assignments.`, true);
    } catch (err) {
      alert(err.message || "Could not copy assignment.");
    }
  }

  function bindTeacherEvents() {
    document.getElementById("teacherCancelBtn")?.addEventListener("click", () => void navigateToHome());
    document.getElementById("teacherLoginBtn")?.addEventListener("click", async () => {
      const pw = document.getElementById("teacherPassword")?.value || "";
      const errEl = document.getElementById("teacherLoginError");

      if (await ownsAssignment(config.id)) {
        teacherAuthed = true;
        sessionTeacherPassword = config.teacherPassword || "";
        if (errEl) errEl.classList.add("dw-hidden");
        show("teacher");
        await loadTeacherDashboard();
        return;
      }

      if (!pw) {
        if (errEl) {
          errEl.textContent = "Enter the assignment teacher password.";
          errEl.classList.remove("dw-hidden");
        }
        return;
      }
      if (errEl) errEl.classList.add("dw-hidden");

      try {
        const sessionToken = Teacher()?.getToken() || "";
        const qs = new URLSearchParams({ assignmentId: config.id });
        if (sessionToken) qs.set("sessionToken", sessionToken);
        else qs.set("password", pw);
        const res = await fetch(`${API_URL}?${qs}`);
        if (res.status === 401) {
          if (errEl) {
            errEl.textContent = "Incorrect password for this assignment.";
            errEl.classList.remove("dw-hidden");
          }
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not verify access.");
        }
      } catch (err) {
        if (errEl) {
          errEl.textContent = err.message || "Could not verify access. Check your connection and try again.";
          errEl.classList.remove("dw-hidden");
        }
        return;
      }

      sessionTeacherPassword = pw;
      teacherAuthed = true;
      show("teacher");
      await loadTeacherDashboard();
    });
    document.getElementById("teacherLogoutBtn")?.addEventListener("click", () => {
      teacherAuthed = false;
      sessionTeacherPassword = "";
      void navigateToHome();
    });
    document.getElementById("teacherHomeBtn")?.addEventListener("click", () => {
      teacherAuthed = false;
      sessionTeacherPassword = "";
      void navigateToHome();
    });
    document.getElementById("teacherEditBtn")?.addEventListener("click", () => {
      void openAssignmentInBuilder(config.id);
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

    if (await ownsAssignment(id)) {
      teacherAuthed = true;
      sessionTeacherPassword = config.teacherPassword || "";
      show("teacher");
      await loadTeacherDashboard();
      return;
    }

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
    const thead = document.getElementById("teacherTableHead");
    const rubrics = getActiveRubrics();
    const hasVocab = getVocabWords().length > 0;
    const showWpm = resolveShowLiveWpm() || rubrics.includes("typing");
    const cols = ["name", "class", "words"];
    if (showWpm) cols.push("wpm");
    if (hasVocab) cols.push("vocab");
    if (rubrics.includes("typing")) cols.push("typing");
    if (rubrics.includes("mechanics")) cols.push("mechanics");
    if (rubrics.includes("story")) cols.push("story");
    cols.push("overall", "submitted", "action");

    const headerLabels = {
      name: "Name",
      class: "Class",
      words: "Wds",
      wpm: "WPM",
      vocab: "Vocab",
      typing: "Typ",
      mechanics: "Mech",
      story: "Story",
      overall: "Overall",
      submitted: "Submitted",
      action: "",
    };

    if (thead) {
      thead.innerHTML = cols.map((c) => `<th>${headerLabels[c]}</th>`).join("");
    }

    if (!tbody) return;

    function cellValue(sub, col, idx) {
      switch (col) {
        case "name": return escapeHtml(sub.name);
        case "class": return escapeHtml(sub.classroom);
        case "words": return sub.analysis?.wordCount ?? "—";
        case "wpm": return sub.analysis?.wpm ?? "—";
        case "vocab": return sub.analysis?.vocabulary ? `${sub.analysis.vocabulary.usedCount}/${sub.analysis.vocabulary.requiredCount}` : "—";
        case "typing": return sub.analysis?.scores?.typing ?? "—";
        case "mechanics": return sub.analysis?.scores?.mechanics ?? "—";
        case "story": return sub.analysis?.scores?.story ?? "—";
        case "overall": return sub.analysis?.scores?.overall ?? "—";
        case "submitted": return sub.submittedAt ? Core.formatDate(sub.submittedAt) : "—";
        case "action": return `<button type="button" class="dw-btn dw-btn-ghost dw-btn--compact" data-sub-idx="${idx}">View</button>`;
        default: return "—";
      }
    }

    tbody.innerHTML = subs.map((s, idx) => `
      <tr>${cols.map((c) => `<td>${cellValue(s, c, idx)}</td>`).join("")}</tr>`).join("")
      || `<tr><td colspan="${cols.length}" class="dw-muted">No submissions yet.</td></tr>`;

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
    const rubrics = getActiveRubrics();
    const hasVocab = getVocabWords().length > 0;
    const showWpm = resolveShowLiveWpm() || rubrics.includes("typing");
    const header = ["Name", "Class", "Words"];
    if (showWpm) header.push("WPM");
    if (hasVocab) header.push("Vocab");
    if (rubrics.includes("typing")) header.push("Typing");
    if (rubrics.includes("mechanics")) header.push("Mechanics");
    if (rubrics.includes("story")) header.push("Story");
    header.push("Overall", "Submitted");
    const rows = [header];
    for (const s of subs) {
      const row = [s.name, s.classroom, s.analysis?.wordCount];
      if (showWpm) row.push(s.analysis?.wpm);
      if (hasVocab) row.push(`${s.analysis?.vocabulary?.usedCount ?? 0}/${s.analysis?.vocabulary?.requiredCount ?? 0}`);
      if (rubrics.includes("typing")) row.push(s.analysis?.scores?.typing);
      if (rubrics.includes("mechanics")) row.push(s.analysis?.scores?.mechanics);
      if (rubrics.includes("story")) row.push(s.analysis?.scores?.story);
      row.push(s.analysis?.scores?.overall, new Date(s.submittedAt).toISOString());
      rows.push(row);
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
    const preservedId = config.id;
    const preservedTitle = config.title;
    config = {
      ...Defaults,
      ...config,
      ...built,
      id: preservedId,
      title: preservedTitle || built.title,
      accessibility: { ...Defaults.accessibility, ...built.accessibility },
      theme: { ...Defaults.theme, ...config.theme, ...built.theme },
      version: 2,
    };
    persistConfig();
    history.replaceState(null, "", studioUrl(`?mode=builder&id=${encodeURIComponent(config.id)}`));
    builderSection = "content";
    renderBuilder();
    showSaveStatus(`Built "${config.title}" from ${template.title}. Review settings, then Save assignment.`, true);
  }

  function renderTemplateGallery(containerId, onSelect) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = ASSIGNMENT_TEMPLATES.map((t) => `
      <button class="wf-template-card wf-template-card--rich" type="button" data-template="${escapeHtml(t.id)}" role="listitem">
        <span class="wf-template-card__icon" aria-hidden="true">${t.icon}</span>
        <span class="wf-template-card__body">
          <span class="wf-template-card__title">${escapeHtml(t.title)}</span>
          <span class="wf-template-card__desc">${escapeHtml(t.description)}</span>
          ${renderTemplateDefaultsList(t)}
          <span class="wf-template-card__cta">Start wizard →</span>
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
        <div class="wf-template-defaults-box" role="note">
          <strong>Default student experience</strong>
          ${renderTemplateDefaultsList(template)}
          <p class="dw-muted dw-tiny">You can change every setting after building.</p>
        </div>
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

  async function loadAssignmentForEdit(id) {
    let next = readLocalConfig(id);
    if (!next) {
      const cloud = await fetchCloudConfig(id);
      if (cloud) {
        next = { ...Defaults, ...cloud, id };
        Core.saveConfig(STORAGE_PREFIX, id, next);
        const ids = getAssignmentsList();
        if (!ids.includes(id)) saveAssignmentsList([...ids, id]);
      }
    }
    return next || { ...Defaults, id };
  }

  async function openAssignmentInBuilder(id, { section = "content" } = {}) {
    if (!id) return;
    studioMode = "builder";
    config = await loadAssignmentForEdit(id);
    builderSection = section;
    activeTemplateId = "";
    history.replaceState(null, "", studioUrl(`?mode=builder&id=${encodeURIComponent(config.id)}`));
    show("builder");
    applyConfigToUI();
    Core.applyTheme(Core.resolveTheme(config));
    renderBuilder();
    showSaveStatus(`Opened “${config.title || config.id}”.`, true);
  }

  async function copyShareLink(id = config.id) {
    const link = `${location.origin}${assignmentUrl(id)}`;
    try {
      await navigator.clipboard.writeText(link);
      showSaveStatus("Student link copied to clipboard.", true);
    } catch {
      showSaveStatus(link, false);
    }
  }

  function renderAssignmentCard(id, { active = false, compact = false, meta = null } = {}) {
    const saved = readLocalConfig(id) || { id, title: id };
    const title = saved.title || meta?.title || id;
    const sharePath = assignmentUrl(id);
    const icon = assignmentModeIcon(saved.assignmentMode);
    const summary = assignmentTileSummary(saved);
    const badges = [];
    if (meta?.shared) badges.push('<span class="wf-badge wf-badge--shared">Shared</span>');
    if (meta?.ownerUsername && Teacher()?.getSession()?.username === normalizeUsername(meta.ownerUsername)) {
      badges.push('<span class="wf-badge wf-badge--cloud">Your account</span>');
    } else if (meta?.authorDisplayName) {
      badges.push(`<span class="wf-badge">${escapeHtml(meta.authorDisplayName)}</span>`);
    }
    const badgeHtml = badges.length ? `<div class="wf-assignment-badges">${badges.join("")}</div>` : "";
    if (compact) {
      return `
        <article class="wf-assignment-card${active ? " wf-assignment-card--active" : ""}" data-assignment-id="${escapeHtml(id)}">
          <button type="button" class="wf-assignment-card__open" data-action="edit" data-id="${escapeHtml(id)}">
            <span class="wf-assignment-card__body">
              <span class="wf-assignment-card__title">${escapeHtml(title)}</span>
              <span class="wf-assignment-card__id">${escapeHtml(id)}</span>
            </span>
            <span class="wf-assignment-card__meta">Edit →</span>
          </button>
          <button type="button" class="wf-assignment-card__delete" data-action="delete" data-id="${escapeHtml(id)}" aria-label="Delete ${escapeHtml(title)}">Delete</button>
        </article>`;
    }
    return `
      <article class="wf-file-tile${active ? " wf-file-tile--active" : ""}" role="listitem" data-assignment-id="${escapeHtml(id)}">
        <button type="button" class="wf-file-tile__body" data-action="edit" data-id="${escapeHtml(id)}">
          <span class="wf-file-tile__icon" aria-hidden="true">${icon}</span>
          <span class="wf-file-tile__name">${escapeHtml(title)}</span>
          <span class="wf-file-tile__meta">${escapeHtml(summary)}</span>
          <span class="wf-file-tile__id"><code>${escapeHtml(id)}</code></span>
          ${badgeHtml}
        </button>
        <div class="wf-file-tile__actions">
          <button class="dw-btn dw-btn-secondary dw-btn--compact" type="button" data-action="results" data-id="${escapeHtml(id)}">Results</button>
          <button class="dw-btn dw-btn-ghost dw-btn--compact" type="button" data-action="copy" data-id="${escapeHtml(id)}">Link</button>
          <a class="dw-btn dw-btn-ghost dw-btn--compact" href="${escapeHtml(sharePath)}" target="_blank" rel="noopener">Preview</a>
          <button class="wf-file-tile__delete" type="button" data-action="delete" data-id="${escapeHtml(id)}" aria-label="Delete ${escapeHtml(title)}">×</button>
        </div>
      </article>`;
  }

  function bindAssignmentCardActions(root) {
    root?.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === "edit") {
          e.preventDefault();
          await openAssignmentInBuilder(id);
          return;
        }
        if (action === "results") {
          e.preventDefault();
          void navigateToResults(id);
          return;
        }
        if (action === "copy") {
          e.preventDefault();
          await copyShareLink(id);
          return;
        }
        if (action === "delete") {
          e.preventDefault();
          e.stopPropagation();
          const saved = readLocalConfig(id) || { id, title: id };
          const ok = await showConfirmDialog({
            title: "Delete assignment?",
            body: `Delete "${saved.title || id}" from this browser? This cannot be undone.`,
            confirmLabel: "Delete",
            destructive: true,
          });
          if (!ok) return;
          const wasCurrent = config.id === id;
          const remaining = deleteAssignment(id);
          if (wasCurrent) {
            if (remaining.length) {
              await openAssignmentInBuilder(remaining[0]);
            } else {
              config = { ...Defaults, id: `assignment-${Date.now()}`, title: "Untitled Assignment" };
              persistConfig();
              history.replaceState(null, "", studioUrl(`?mode=builder&id=${encodeURIComponent(config.id)}`));
              renderBuilder();
            }
          } else {
            renderHomeDashboard();
            renderBuilder();
          }
        }
      });
    });
  }

  function renderHomeDashboard() {
    const el = document.getElementById("wfAssignmentsDashboard");
    if (!el) return;
    const localIds = getAssignmentsList();
    const cloudIds = Object.keys(cloudAssignmentMeta);
    const ids = [...new Set([...localIds, ...cloudIds])];
    const picker = params.get("teacher") === "1" && !params.get("id");
    document.getElementById("wfTeacherPickerBanner")?.classList.toggle("dw-hidden", !picker);

    if (!ids.length) {
      el.innerHTML = `
        <div class="wf-files-empty">
          <span class="wf-files-empty__icon" aria-hidden="true">📁</span>
          <p class="dw-lead">No assignments yet</p>
          <p class="dw-muted">Pick a template on the left, or create a blank assignment.${Teacher()?.isLoggedIn() ? "" : " Sign in to sync across devices."}</p>
        </div>`;
      return;
    }

    el.innerHTML = ids.map((id) => renderAssignmentCard(id, { meta: cloudAssignmentMeta[id] || null })).join("");
    bindAssignmentCardActions(el);
  }

  function resolveDefaultAssignmentId() {
    const ids = getAssignmentsList();
    return ids[0] || assignmentId || "sample-persuasive";
  }

  function bindTopbarActions() {
    if (!isStudioApp) return;
    document.getElementById("builderLinkBtn")?.addEventListener("click", () => {
      void navigateToHome();
    });

    document.getElementById("teacherBtn")?.addEventListener("click", () => {
      const ids = getAssignmentsList();
      const cloudIds = Object.keys(cloudAssignmentMeta);
      const allIds = [...new Set([...ids, ...cloudIds])];
      if (!allIds.length) {
        void navigateToHome({ resultsPicker: true });
        return;
      }
      const id = config?.id && allIds.includes(config.id) ? config.id : allIds[0];
      if (allIds.length > 1 && !isBuilderMode() && !teacherAuthed) {
        void navigateToHome({ resultsPicker: true });
        return;
      }
      void navigateToResults(id);
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
          <p class="dw-muted">Pick a template to see its default student experience, then answer a few questions. Your assignment name (from when you started) becomes the link ID.</p>
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
        <label class="dw-field"><span class="dw-label">Sentence starters (optional)</span><span class="dw-muted dw-tiny">Shown above the writing area — e.g. &ldquo;One thing I noticed…&rdquo; or &ldquo;I felt… because…&rdquo;</span><textarea id="bfSentenceStarters" class="dw-textarea" rows="2" placeholder="Optional scaffold text">${escapeHtml(config.sentenceStarters || "")}</textarea></label>
        <label class="dw-field"><span class="dw-label">Expected vocabulary</span><span class="dw-muted dw-tiny">Comma or line-separated words students should use — highlighted in Results</span><textarea id="bfVocab" class="dw-textarea" rows="3" placeholder="photosynthesis, chlorophyll, glucose">${escapeHtml((config.vocabWords || []).join(", "))}</textarea></label>
        <label class="wf-toggle-row"><input id="bfHighlightVocab" type="checkbox" ${config.highlightVocab !== false ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Highlight vocabulary in teacher view</strong><span class="wf-toggle-row__hint">Marks expected words in submission previews</span></span></label>
        <label class="dw-field"><span class="dw-label">Teacher password</span><span class="dw-muted dw-tiny">Required to open Results for this assignment</span><input id="bfTeacherPw" class="dw-input" type="password" autocomplete="new-password" value="${escapeHtml(config.teacherPassword)}" /></label>
        <div id="bfShareRow" class="dw-hidden">
          <label class="wf-toggle-row"><input id="bfShared" type="checkbox" ${config.shared ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Share with other teachers</strong><span class="wf-toggle-row__hint">Lets colleagues copy this assignment from the shared library</span></span></label>
        </div>`;
      bindBuilderField("bfTitle", "title");
      bindBuilderField("bfSubtitle", "subtitle");
      bindBuilderField("bfWelcomeTitle", "welcomeTitle");
      bindBuilderField("bfWelcomeLead", "welcomeLead");
      bindBuilderField("bfPrompt", "prompt");
      bindBuilderField("bfPromptBanner", "promptBanner");
      bindBuilderField("bfSentenceStarters", "sentenceStarters");
      bindBuilderField("bfTeacherPw", "teacherPassword");
      document.getElementById("bfVocab")?.addEventListener("change", (e) => {
        config.vocabWords = window.WriteFlowDefaults?.parseVocabInput?.(e.target.value) || [];
        persistConfig();
      });
      document.getElementById("bfHighlightVocab")?.addEventListener("change", (e) => {
        config.highlightVocab = e.target.checked;
        persistConfig();
      });
      const shareRow = document.getElementById("bfShareRow");
      if (shareRow) shareRow.classList.toggle("dw-hidden", !Teacher()?.isLoggedIn());
      document.getElementById("bfShared")?.addEventListener("change", (e) => {
        config.shared = e.target.checked;
        persistConfig();
      });
    } else if (builderSection === "timer") {
      const currentMode = config.assignmentMode || "composition";
      const timerStyle = resolveTimerStyle();
      const modeOptions = ASSIGNMENT_MODES.map((m) =>
        `<option value="${m}"${currentMode === m ? " selected" : ""}>${escapeHtml(m.replace(/_/g, " "))}</option>`).join("");
      canvas.innerHTML = `
        ${builderSectionHeader("timer")}
        <label class="dw-field">
          <span class="dw-label">Assignment mode</span>
          <span class="dw-muted dw-tiny">Sets scoring focus, live stats, and timer defaults</span>
          <select id="bfAssignmentMode" class="dw-input dw-select">${modeOptions}</select>
        </label>
        <label class="dw-field">
          <span class="dw-label">Timer style</span>
          <span class="dw-muted dw-tiny">Soft and goal timers let students finish on their own</span>
          <select id="bfTimerStyle" class="dw-input dw-select">
            <option value="soft"${timerStyle === "soft" ? " selected" : ""}>Soft — gentle notice at zero, keep writing</option>
            <option value="hard"${timerStyle === "hard" ? " selected" : ""}>Hard — auto-submit when time runs out</option>
            <option value="goal"${timerStyle === "goal" ? " selected" : ""}>Goal — count up with suggested duration</option>
            <option value="none"${timerStyle === "none" ? " selected" : ""}>None — no timer shown</option>
          </select>
        </label>
        <label class="dw-field">
          <span class="dw-label">Duration (seconds)</span>
          <span class="dw-muted dw-tiny">${timerStyle === "goal" ? "Suggested writing time" : "Students write until the timer hits zero"} · about ${escapeHtml(formatDurationLabel(config.durationSec))}</span>
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
          <label class="wf-toggle-row"><input id="bfLiveStats" type="checkbox" ${config.showLiveStats ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Show live word count</strong><span class="wf-toggle-row__hint">Word total during writing — on by default for composition</span></span></label>
          <label class="wf-toggle-row"><input id="bfLiveWpm" type="checkbox" ${config.showLiveWpm ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Show live WPM</strong><span class="wf-toggle-row__hint">Off by default in composition — use for fluency drills</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireMinWords" type="checkbox" ${config.requireMinWordsToComplete ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require minimum words to finish</strong><span class="wf-toggle-row__hint">If time runs out first, students keep writing until they hit the word goal</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireName" type="checkbox" ${config.requireName ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require student name</strong><span class="wf-toggle-row__hint">First name before starting</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireClass" type="checkbox" ${config.requireClass ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require class selection</strong><span class="wf-toggle-row__hint">Pick from the class list</span></span></label>
          <label class="wf-toggle-row"><input id="bfRequireCode" type="checkbox" ${config.requireClassCode ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Require class code</strong><span class="wf-toggle-row__hint">Secret code from the Classes tab</span></span></label>
        </div>`;
      document.getElementById("bfAssignmentMode")?.addEventListener("change", (e) => {
        const mode = e.target.value;
        const defaults = window.WriteFlowDefaults?.MODE_DEFAULTS?.[mode];
        if (defaults) {
          Object.assign(config, defaults);
          config.assignmentMode = mode;
        } else {
          config.assignmentMode = mode;
        }
        persistConfig();
        renderBuilder();
      });
      document.getElementById("bfTimerStyle")?.addEventListener("change", (e) => {
        config.timerStyle = e.target.value;
        persistConfig();
        renderBuilder();
      });
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
      ["bfAllowPaste", "bfSpellcheck", "bfAllowEndEarly", "bfLockAfter", "bfLiveStats", "bfLiveWpm", "bfRequireMinWords", "bfRequireName", "bfRequireClass", "bfRequireCode"].forEach((id) => {
        const map = {
          bfAllowPaste: "allowPaste",
          bfSpellcheck: "spellcheck",
          bfAllowEndEarly: "allowEndEarly",
          bfLockAfter: "lockAfterTime",
          bfLiveStats: "showLiveStats",
          bfLiveWpm: "showLiveWpm",
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
          <span class="dw-label">Hero image or GIF URL</span>
          <span class="dw-muted dw-tiny">Shown at the top of the student welcome screen — paste a direct link to an image or animated GIF.</span>
          <input id="bfHero" class="dw-input" value="${escapeHtml(config.heroImage || "")}" placeholder="https://…" />
        </label>
        <label class="dw-field">
          <span class="dw-label">Or upload image / GIF</span>
          <input id="bfHeroUpload" class="dw-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" />
          <span class="dw-muted dw-tiny">Images up to 750 KB, GIFs up to 2.5 MB. For share links, a URL is more reliable than a large upload.</span>
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
        renderBuilder();
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
        config.heroImage = "";
        persistConfig();
        renderBuilder();
      });
      const heroPreviewSrc = heroImageSrc();
      if (heroPreviewSrc) {
        setHeroPreview(document.getElementById("bfHeroPreview"), heroPreviewSrc);
        document.getElementById("bfClearHero")?.classList.remove("dw-hidden");
      }
    } else if (builderSection === "accessibility") {
      const a11y = mergeAccessibility(config.accessibility);
      const presetCards = DIFFERENTIATION_PRESETS.map((p) => `
        <button class="wf-diff-preset-card" type="button" data-preset="${escapeHtml(p.id)}" title="${escapeHtml(p.description)}">
          <span class="wf-diff-preset-card__icon" aria-hidden="true">${p.icon}</span>
          <span class="wf-diff-preset-card__body">
            <span class="wf-diff-preset-card__title">${escapeHtml(p.label)}</span>
            <span class="wf-diff-preset-card__desc">${escapeHtml(p.description)}</span>
          </span>
        </button>`).join("");
      canvas.innerHTML = `
        ${builderSectionHeader("accessibility")}
        <p class="dw-muted">One-click presets bundle timer, scoring, and display settings for common classroom needs.</p>
        <div class="wf-diff-preset-grid" role="list">${presetCards}</div>
        <p class="dw-muted dw-tiny">Presets update mode and accessibility — you can still tweak individual settings afterward.</p>
        <div class="wf-toggle-list">
          <label class="wf-toggle-row"><input id="bfA11yLarge" type="checkbox" ${a11y.largeText ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Larger text</strong><span class="wf-toggle-row__hint">Bigger prompt and writing area</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11yContrast" type="checkbox" ${a11y.highContrast ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>High contrast</strong><span class="wf-toggle-row__hint">Stronger text and border contrast</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11yDyslexia" type="checkbox" ${a11y.dyslexiaFont ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Dyslexia-friendly font</strong><span class="wf-toggle-row__hint">Uses OpenDyslexic for reading and writing</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11ySpell" type="checkbox" ${resolveSpellcheck() ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Spellcheck while typing</strong><span class="wf-toggle-row__hint">Same setting as Timer &amp; rules — browser underlines possible spelling errors</span></span></label>
          <label class="wf-toggle-row"><input id="bfA11yMotion" type="checkbox" ${a11y.reducedMotion ? "checked" : ""} /><span class="wf-toggle-row__label"><strong>Reduce motion</strong><span class="wf-toggle-row__hint">Minimizes animations and smooth scrolling</span></span></label>
        </div>
        <p class="dw-muted dw-tiny">Tip: combine soft timers with &ldquo;End early&rdquo; so fast finishers submit while others keep working.</p>`;
      document.querySelectorAll(".wf-diff-preset-card").forEach((btn) => {
        btn.addEventListener("click", () => {
          const preset = DIFFERENTIATION_PRESETS.find((p) => p.id === btn.dataset.preset);
          if (!preset?.settings) return;
          const { accessibility: presetA11y, ...rest } = preset.settings;
          Object.assign(config, rest);
          if (presetA11y) {
            config.accessibility = { ...mergeAccessibility(config.accessibility), ...presetA11y };
          }
          persistConfig();
          applyAccessibility();
          renderBuilder();
          showSaveStatus(`Applied "${preset.label}" preset. Review settings, then save.`, true);
        });
      });
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
        <div class="wf-preview-frame dw-card wf-student-prompt-box" id="wfPreviewFrame">
          <div class="wf-student-hero dw-hidden" id="wfPreviewHero"></div>
          <h1 class="dw-h1">${escapeHtml(config.welcomeTitle || config.title)}</h1>
          ${config.welcomeLead ? `<p class="dw-lead">${escapeHtml(config.welcomeLead)}</p>` : ""}
          <blockquote class="dw-prompt-quote">${escapeHtml(config.prompt)}</blockquote>
          <button class="dw-btn" type="button" disabled>Start writing</button>
        </div>
        <div class="dw-row" style="margin-top:16px">
          <a class="dw-btn" href="${assignmentUrl(config.id)}" target="_blank" rel="noopener">Open student view</a>
        </div>`;
      setHeroPreview(document.getElementById("wfPreviewHero"), heroImageSrc());
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
    const modeLabel = window.WriteFlowDefaults?.formatModeLabel?.(config.assignmentMode) || "composition";
    const timerLabel = resolveTimerStyle();
    const rubrics = resolveRubrics(config).join(", ");
    const mins = Math.max(1, Math.round((Number(config.durationSec) || 300) / 60));
    insp.innerHTML = `
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">File information</div>
        <dl class="wf-file-meta">
          <div class="wf-file-meta__row"><dt>Title</dt><dd>${escapeHtml(config.title || "Untitled")}</dd></div>
          <div class="wf-file-meta__row"><dt>Link ID</dt><dd><code>${escapeHtml(config.id)}</code></dd></div>
          <div class="wf-file-meta__row"><dt>Mode</dt><dd>${escapeHtml(modeLabel)}</dd></div>
          <div class="wf-file-meta__row"><dt>Timer</dt><dd>${escapeHtml(timerLabel)} · ${mins} min</dd></div>
          <div class="wf-file-meta__row"><dt>Scoring</dt><dd>${escapeHtml(rubrics)}</dd></div>
          <div class="wf-file-meta__row"><dt>Paste</dt><dd>${config.allowPaste ? "Allowed" : "Blocked"}</dd></div>
          <div class="wf-file-meta__row"><dt>Live WPM</dt><dd>${config.showLiveWpm ? "Shown" : "Hidden"}</dd></div>
        </dl>
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Assignment ID</div>
        <p class="dw-muted dw-tiny">Used in the share link — letters, numbers, and dashes only.</p>
        <input id="bfId" class="dw-input" value="${escapeHtml(config.id)}" />
      </div>
      <div class="wf-inspector-group">
        <div class="wf-inspector-group__label">Save &amp; publish</div>
        <p class="dw-muted dw-tiny">${Teacher()?.isLoggedIn() ? "Save publishes to the cloud and links this assignment to your account." : "Save publishes to the cloud so students can load this assignment from the share link. Sign in to attach assignments to your account."}</p>
        <div class="dw-stack">
          <button id="bfSave" class="dw-btn" type="button">Save assignment</button>
          <button id="bfPreviewStudent" class="dw-btn dw-btn-secondary" type="button">Preview student view</button>
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
        <p class="dw-muted dw-tiny">Switch assignments without leaving the builder.</p>
        <div class="wf-assignment-list" id="bfAssignmentList"></div>
      </div>`;

    document.getElementById("bfId")?.addEventListener("change", (e) => {
      config.id = e.target.value.trim() || "assignment";
      persistConfig();
      history.replaceState(null, "", `?mode=builder&id=${encodeURIComponent(config.id)}`);
    });
    document.getElementById("bfSave")?.addEventListener("click", async () => {
      if (!String(config.teacherPassword || "").trim()) {
        showSaveStatus("Set a teacher password in Content before saving — it protects your results.", false);
        builderSection = "content";
        renderBuilder();
        return;
      }
      persistConfig();
      showSaveStatus("Publishing…", true);
      try {
        await publishAssignmentCloud();
        if (Teacher()?.isLoggedIn()) await refreshCloudAssignments();
        if (config.shared) await refreshSharedLibrary();
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
    document.getElementById("bfPreviewStudent")?.addEventListener("click", () => {
      window.open(assignmentUrl(config.id), "_blank", "noopener");
    });
    document.getElementById("bfNew")?.addEventListener("click", () => {
      void navigateToNewAssignment({ section: "content" });
    });

    document.getElementById("bfDeleteCurrent")?.addEventListener("click", async () => {
      const title = config.title || config.id;
      const ok = await showConfirmDialog({
        title: "Delete assignment?",
        body: `Delete "${title}" (${config.id}) from this browser? This cannot be undone.`,
        confirmLabel: "Delete assignment",
        destructive: true,
      });
      if (!ok) return;
      const deletedId = config.id;
      const remaining = deleteAssignment(deletedId);
      if (remaining.length) {
        await openAssignmentInBuilder(remaining[0]);
      } else {
        void navigateToNewAssignment({ section: "content" });
      }
      showSaveStatus("Assignment deleted from this browser.", true);
    });

    const list = document.getElementById("bfAssignmentList");
    if (list) {
      const ids = getAssignmentsList();
      if (!ids.length) {
        list.innerHTML = `<p class="dw-muted dw-tiny">No saved assignments yet.</p>`;
      } else {
        list.innerHTML = ids.map((id) => renderAssignmentCard(id, { active: config.id === id, compact: true })).join("");
        bindAssignmentCardActions(list);
      }
    }
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

  async function initBuilder() {
    studioMode = "builder";
    const id = params.get("id") || resolveDefaultAssignmentId();
    config = await loadAssignmentForEdit(id);
    if (params.get("template")) {
      activeTemplateId = params.get("template");
      builderSection = "templates";
    } else if (params.get("section") === "templates") {
      builderSection = "templates";
    }
    show("builder");
    applyConfigToUI();
    renderBuilder();
  }

  function bindHomeEvents() {
    document.getElementById("openBuilderBtn")?.addEventListener("click", () => {
      void navigateToNewAssignment({ section: "content" });
    });
    renderTemplateGallery("homeTemplateGrid", (id) => {
      void navigateToNewAssignment({ templateId: id, section: "templates" });
    });
  }

  function initHome() {
    showHomeView();
  }

  async function initStudioApp() {
    bindTopbarActions();
    bindAccountEvents();
    bindHomeEvents();
    if (Teacher()) {
      await Teacher().validate();
      updateAccountButton();
      await refreshCloudAssignments();
      await refreshSharedLibrary();
    }
    initTutorial();
    if (isBuilderMode()) void initBuilder();
    else if (params.get("teacher") === "1" && params.get("id")) void initTeacherPortal();
    else initHome();
  }

  async function bootStudioApp() {
    if (document.getElementById("wfIntroSplash") && window.WriteFlowIntro) {
      await window.WriteFlowIntro.play();
    } else {
      document.getElementById("wfStudioShell")?.classList.remove("dw-hidden");
    }

    initBootLoader();
    showBootLoader(true);
    setBootProgress(0);
    const bootStart = performance.now();
    const minBootMs = 700;
    let bootDone = false;
    const progressTimer = setInterval(() => {
      if (bootDone) return;
      const elapsed = performance.now() - bootStart;
      const ratio = Math.min(0.88, elapsed / 1800);
      setBootProgress(ratio);
    }, 40);

    try {
      await initStudioApp();
    } finally {
      bootDone = true;
      clearInterval(progressTimer);
      const elapsed = performance.now() - bootStart;
      if (elapsed < minBootMs) await new Promise((r) => setTimeout(r, minBootMs - elapsed));
      setBootProgress(1);
      await new Promise((r) => setTimeout(r, 320));
      showBootLoader(false);
    }
  }

  if (isStudentApp) void initStudentFlow();
  else void bootStudioApp();
})();

/**
 * Shared engine for WriteFlow, ITEM Diagnostic, and Tech Trail.
 * Extracted from SWAT (diagnostic-writing.js) patterns.
 */
(() => {
  "use strict";

  const DEFAULT_THEME = {
    mode: "dark",
    accent: "#38bdf8",
    accent2: "#a78bfa",
    bg: "#0f172a",
    surface: "rgba(255,255,255,0.04)",
    text: "#e8eefc",
    muted: "#94a3b8",
    fontFamily: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    fontPreset: "libreBaskerville",
    radius: "16px",
  };

  const LIGHT_THEME = {
    mode: "light",
    accent: "#2563eb",
    accent2: "#7c3aed",
    bg: "#ffffff",
    surface: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontPreset: "inter",
    radius: "10px",
  };

  const PRESETS = {
    dark: DEFAULT_THEME,
    light: LIGHT_THEME,
    classroom: {
      mode: "classroom",
      accent: "#1d4ed8",
      accent2: "#db2777",
      bg: "#fffdf7",
      surface: "rgba(255, 255, 255, 0.88)",
      text: "#1f2937",
      muted: "#64748b",
      fontFamily: '"Caveat", "Patrick Hand", "Comic Sans MS", cursive',
      fontPreset: "classroomHand",
      radius: "8px",
    },
    midnight: {
      mode: "dark",
      accent: "#818cf8",
      accent2: "#c084fc",
      bg: "#0c0a1a",
      surface: "rgba(129, 140, 248, 0.08)",
      text: "#e8e4ff",
      muted: "#a5b4fc",
      fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
      fontPreset: "dmSans",
      radius: "14px",
    },
    sandiego: {
      mode: "custom",
      accent: "#c41e3a",
      accent2: "#ffd700",
      bg: "#1a0a2e",
      surface: "rgba(255,215,0,0.06)",
      text: "#f5e6c8",
      muted: "#c9b896",
      fontFamily: '"Newsreader", "Palatino Linotype", Georgia, serif',
      fontPreset: "newsreader",
      radius: "8px",
    },
    item: {
      mode: "dark",
      accent: "#34d399",
      accent2: "#fbbf24",
      bg: "#071612",
      surface: "rgba(16, 185, 129, 0.08)",
      text: "#ecfdf5",
      muted: "#6ee7b7",
      fontFamily: 'Roboto, "Segoe UI", system-ui, Arial, sans-serif',
      fontPreset: "google",
      radius: "14px",
    },
    gauntlet: {
      mode: "custom",
      accent: "#c41e3a",
      accent2: "#ffd700",
      bg: "#140818",
      surface: "rgba(196, 30, 58, 0.12)",
      text: "#fff8e7",
      muted: "#e8c896",
      fontFamily: '"Barlow", Roboto, "Segoe UI", sans-serif',
      fontPreset: "barlow",
      radius: "10px",
    },
  };

  const PRESET_LABELS = {
    dark: "Dark",
    light: "Light",
    classroom: "Classroom",
    midnight: "Midnight",
    sandiego: "San Diego",
    item: "ITEM",
    gauntlet: "Gauntlet",
  };

  const THEME_SKINS = Object.keys(PRESETS);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  function countWords(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function normalizeClassCode(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function normalizeClassroom(value) {
    return String(value || "").trim().replace(/[\u2018\u2019\u201B\u2032]/g, "'");
  }

  function resolveClassroom(value, validList) {
    const norm = normalizeClassroom(value);
    if (!norm) return "";
    for (const classroom of validList || []) {
      if (normalizeClassroom(classroom) === norm) return classroom;
    }
    return "";
  }

  function verifyClassroomCode(classroom, code, codes) {
    const expected = codes?.[classroom];
    if (!expected) return false;
    return normalizeClassCode(code) === normalizeClassCode(expected);
  }

  function loadJsonScript(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    try {
      return JSON.parse(el.textContent);
    } catch {
      return fallback;
    }
  }

  function showView(views, name, shellEl, teacherView) {
    if (shellEl) shellEl.classList.toggle("dw-shell--teacher", name === teacherView);
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("dw-hidden", key !== name);
    });
  }

  const FONT_PRESETS = {
    google: {
      label: "Google Sans / Roboto",
      family: '"Google Sans", Roboto, "Segoe UI", Arial, sans-serif',
      googleUrl: "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap",
    },
    readable: {
      label: "Atkinson Hyperlegible",
      family: '"Atkinson Hyperlegible", Verdana, sans-serif',
      googleUrl: "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
    },
    dyslexic: {
      label: "OpenDyslexic",
      family: "OpenDyslexic, Verdana, sans-serif",
      googleUrl: "",
      injectStyle: `@font-face{font-family:OpenDyslexic;src:url(https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.woff) format('woff');font-weight:400;font-style:normal;}`,
    },
    serif: {
      label: "Georgia / Serif",
      family: 'Georgia, "Palatino Linotype", "Times New Roman", serif',
      googleUrl: "",
    },
    libreBaskerville: {
      label: "Libre Baskerville",
      family: '"Libre Baskerville", Georgia, "Times New Roman", serif',
      googleUrl: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap",
    },
    inter: {
      label: "Inter (clean)",
      family: "Inter, ui-sans-serif, system-ui, sans-serif",
      googleUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
    },
    classroomHand: {
      label: "Classroom handwriting",
      family: '"Caveat", "Patrick Hand", "Comic Sans MS", cursive',
      googleUrl: "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Patrick+Hand&display=swap",
    },
    dmSans: {
      label: "DM Sans",
      family: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
      googleUrl: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap",
    },
    barlow: {
      label: "Barlow",
      family: '"Barlow", Roboto, "Segoe UI", sans-serif',
      googleUrl: "https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&display=swap",
    },
    newsreader: {
      label: "Newsreader",
      family: '"Newsreader", "Palatino Linotype", Georgia, serif',
      googleUrl: "https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap",
    },
    system: {
      label: "System UI",
      family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      googleUrl: "",
    },
  };

  let fontLinkEl = null;
  let fontStyleEl = null;

  function applyFontPreset(presetKey, customFamily) {
    const preset = FONT_PRESETS[presetKey] || FONT_PRESETS.google;
    const family = customFamily || preset.family;
    document.body.style.fontFamily = family;

    if (fontLinkEl) fontLinkEl.remove();
    if (fontStyleEl) fontStyleEl.remove();

    if (preset.googleUrl) {
      fontLinkEl = document.createElement("link");
      fontLinkEl.rel = "stylesheet";
      fontLinkEl.href = preset.googleUrl;
      document.head.appendChild(fontLinkEl);
    }
    if (preset.injectStyle) {
      fontStyleEl = document.createElement("style");
      fontStyleEl.textContent = preset.injectStyle;
      document.head.appendChild(fontStyleEl);
    }
  }

  function applyTheme(theme) {
    const presetKey = theme?.preset && PRESETS[theme.preset] ? theme.preset : null;
    const base = presetKey ? PRESETS[presetKey] : DEFAULT_THEME;
    const t = { ...DEFAULT_THEME, ...base, ...theme };

    const root = document.documentElement;
    root.style.setProperty("--dw-bg", t.bg);
    root.style.setProperty("--dw-surface", t.surface);
    root.style.setProperty("--dw-text", t.text);
    root.style.setProperty("--dw-muted", t.muted);
    root.style.setProperty("--dw-accent", t.accent);
    root.style.setProperty("--dw-accent-2", t.accent2);
    root.style.setProperty("--dw-radius", t.radius);

    const fontKey = theme?.fontPreset || t.fontPreset;
    if (fontKey) {
      applyFontPreset(fontKey, theme?.fontFamily || t.fontFamily || null);
    } else if (t.fontFamily) {
      document.body.style.fontFamily = t.fontFamily;
    }

    THEME_SKINS.forEach((skin) => document.body.classList.remove(`wp-theme--${skin}`));
    const skin = presetKey || (t.mode === "light" ? "light" : t.mode === "classroom" ? "classroom" : "dark");
    document.body.classList.add(`wp-theme--${skin}`);
    document.body.classList.toggle("wp-theme--light", skin === "light");
    document.body.classList.toggle("wp-theme--dark", skin !== "light" && skin !== "classroom");
  }

  function resolveTheme(config) {
    const preset = config?.theme?.preset;
    const base = PRESETS[preset] || PRESETS.dark;
    const merged = { ...base, ...config?.theme };
    if (!config?.theme?.fontPreset && base.fontPreset) {
      merged.fontPreset = base.fontPreset;
    }
    return merged;
  }

  function createTimer(opts) {
    const {
      durationSec,
      onTick,
      onComplete,
      onSoftExpire,
      displayEl,
      progressEl,
      urgentSec = 30,
      timerStyle = "hard",
    } = opts;

    let interval = null;
    let elapsed = 0;
    let startTime = 0;
    let softExpired = false;

    function tick() {
      elapsed = (Date.now() - startTime) / 1000;

      if (timerStyle === "none") {
        if (displayEl) displayEl.textContent = "—";
        if (progressEl) progressEl.style.width = "0%";
        if (onTick) onTick({ elapsed, remaining: Infinity, durationSec, softExpired });
        return;
      }

      if (timerStyle === "goal") {
        if (displayEl) {
          displayEl.textContent = formatTime(elapsed);
          displayEl.classList.remove("dw-timer-value--urgent");
        }
        if (progressEl) {
          progressEl.style.width = `${clamp(durationSec > 0 ? (elapsed / durationSec) * 100 : 0, 0, 100)}%`;
        }
        if (onTick) onTick({ elapsed, remaining: Math.max(0, durationSec - elapsed), durationSec, softExpired });
        return;
      }

      const remaining = Math.max(0, durationSec - elapsed);
      if (displayEl) {
        displayEl.textContent = formatTime(remaining);
        displayEl.classList.toggle("dw-timer-value--urgent", remaining <= urgentSec && remaining > 0);
      }
      if (progressEl) {
        progressEl.style.width = `${clamp((elapsed / durationSec) * 100, 0, 100)}%`;
      }
      if (onTick) onTick({ elapsed, remaining, durationSec, softExpired });

      if (remaining <= 0) {
        if (timerStyle === "soft") {
          if (!softExpired) {
            softExpired = true;
            if (onSoftExpire) onSoftExpire();
          }
          return;
        }
        stop();
        if (onComplete) onComplete();
      }
    }

    function start() {
      stop();
      elapsed = 0;
      startTime = Date.now();
      tick();
      interval = setInterval(tick, 200);
    }

    function stop() {
      if (interval) clearInterval(interval);
      interval = null;
    }

    function getElapsed() {
      return elapsed;
    }

    return { start, stop, getElapsed };
  }

  function setupPasteControl(textarea, allowPaste) {
    if (!textarea) return;
    textarea.addEventListener("paste", (e) => {
      if (!allowPaste && !textarea.readOnly) e.preventDefault();
    });
  }

  function setupLiveStats(textarea, wordEl, wpmEl, getElapsed, options = {}) {
    if (!textarea) return;
    const showWpm = options.showWpm !== false;
    textarea.addEventListener("input", () => {
      const words = countWords(textarea.value);
      const elapsed = getElapsed();
      const mins = Math.max(elapsed / 60, 0.01);
      const wpm = Math.round(words / mins);
      if (wordEl) wordEl.textContent = String(words);
      if (wpmEl && showWpm) wpmEl.textContent = String(wpm);
    });
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shuffleOptions(question) {
    const indices = question.a.map((_, i) => i);
    const shuffled = shuffle(indices);
    const newCorrect = question.correct.map((i) => shuffled.indexOf(i)).sort((a, b) => a - b);
    return {
      ...question,
      a: shuffled.map((i) => question.a[i]),
      correct: newCorrect,
      _originalCorrect: question.correct,
    };
  }

  function storageKey(prefix, id) {
    return `${prefix}:${id || "default"}`;
  }

  function loadConfig(prefix, id, fallback) {
    try {
      const raw = localStorage.getItem(storageKey(prefix, id));
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch {
      return fallback;
    }
  }

  function saveConfig(prefix, id, config) {
    localStorage.setItem(storageKey(prefix, id), JSON.stringify(config));
  }

  function exportConfig(config) {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.id || "assignment"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importConfig(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function populateClassSelect(selectEl, classrooms) {
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="" disabled selected>Select your class…</option>';
    for (const c of classrooms || []) {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      selectEl.appendChild(opt);
    }
  }

  window.WriteTestCore = {
    DEFAULT_THEME,
    LIGHT_THEME,
    PRESETS,
    PRESET_LABELS,
    FONT_PRESETS,
    clamp,
    formatTime,
    formatDate,
    countWords,
    normalizeClassCode,
    normalizeClassroom,
    resolveClassroom,
    verifyClassroomCode,
    loadJsonScript,
    showView,
    applyTheme,
    resolveTheme,
    createTimer,
    setupPasteControl,
    setupLiveStats,
    shuffle,
    shuffleOptions,
    storageKey,
    loadConfig,
    saveConfig,
    exportConfig,
    importConfig,
    populateClassSelect,
  };
})();

/**
 * Tech Trail Typing Engine — diagnostic, ghost-text matching, CPM (correct keys/min), typo tolerance.
 * Aligns with ITEM 2025 keyboarding benchmarks (8.3.2.1) and middle-school fluency goals.
 */
(() => {
  "use strict";

  /** Full-sentence diagnostic prompts — students must type the entire sentence including punctuation. */
  const DIAGNOSTIC_PHRASES = [
    "The quick brown fox jumped over the lazy dog.",
    "Always think carefully before you share online.",
    "Strong passwords help guard your personal data.",
    "Good designers build technology for real people.",
    "Check your sources before you trust a headline.",
  ];

  const RECOMMENDED_SPEED_RATIO = 0.5;
  const MAX_MANUAL_SPEED_RATIO = 1.5;
  /** Minimum target: correct keystrokes per minute */
  const MIN_TARGET_CPM = 20;
  const DEFAULT_TARGET_CPM = 45;
  /** Middle-school caps — short diagnostic phrases can otherwise spike to 200+ CPM */
  const MAX_TEST_CPM = 120;
  const MAX_TARGET_CPM = 95;
  /** Minimum ms per counted keystroke when measuring speed (prevents burst inflation) */
  const MIN_MS_PER_KEY = 320;
  /** Choice paths this short (e.g. "Design Lab") cannot sustain a CPM sample — accuracy only. */
  const SHORT_PATH_MAX_CHARS = 24;

  function isShortTranscriptionPath(target, maxLen = SHORT_PATH_MAX_CHARS) {
    return normalize(target).length <= maxLen;
  }

  /** Scale speed gate down for short targets; returns 0 to waive the gate entirely. */
  function scaledSpeedGateRatio(speedGate, targetLength, maxLen = SHORT_PATH_MAX_CHARS) {
    const len = Math.max(0, targetLength || 0);
    if (len <= maxLen) return 0;
    const rampStart = maxLen;
    const rampEnd = 48;
    if (len >= rampEnd) return speedGate ?? 0.85;
    const t = (len - rampStart) / (rampEnd - rampStart);
    return (speedGate ?? 0.85) * t;
  }

  /** Correct keystrokes per minute — only characters that match the target (spellcheck-valid). */
  function computeCpm(correctCharCount, durationMs, options = {}) {
    const count = Math.max(0, correctCharCount || 0);
    if (!count) return 0;

    const mode = options.mode || "game";

    if (mode === "live") {
      const minSampleMs = options.minSampleMs ?? 1500;
      const effectiveMs = Math.max(durationMs || 0, minSampleMs);
      if (effectiveMs <= 0) return 0;
      const maxCpm = options.maxCpm ?? 180;
      return Math.min(Math.round(count / (effectiveMs / 60000)), maxCpm);
    }

    if (mode === "diagnostic") {
      const minMsPerKey = options.minMsPerKey ?? 90;
      const effectiveMs = Math.max(durationMs || 0, count * minMsPerKey);
      if (effectiveMs <= 0) return 0;
      const maxCpm = options.maxCpm ?? MAX_TEST_CPM;
      return Math.min(Math.round(count / (effectiveMs / 60000)), maxCpm);
    }

    const maxCpm = options.maxCpm ?? MAX_TEST_CPM;
    const msPerKey = options.minMsPerKey ?? MIN_MS_PER_KEY;
    const effectiveMs = Math.max(durationMs || 0, count * msPerKey);
    if (effectiveMs <= 0) return 0;
    const minutes = effectiveMs / 60000;
    const raw = Math.round(count / minutes);
    return Math.min(raw, maxCpm);
  }

  function pickDiagnosticPhrase(rng = Math.random) {
    const i = Math.floor(rng() * DIAGNOSTIC_PHRASES.length);
    return DIAGNOSTIC_PHRASES[i];
  }

  function recommendedTargetCpm(testCpm) {
    const cappedTest = Math.min(Math.max(0, testCpm), MAX_TEST_CPM);
    const base = Math.max(MIN_TARGET_CPM, cappedTest * RECOMMENDED_SPEED_RATIO);
    return Math.round(Math.min(base, MAX_TARGET_CPM));
  }

  function clampTargetCpm(testCpm, chosen) {
    const min = MIN_TARGET_CPM;
    const cappedTest = Math.min(Math.max(0, testCpm), MAX_TEST_CPM);
    const max = Math.min(MAX_TARGET_CPM, Math.max(min, cappedTest * MAX_MANUAL_SPEED_RATIO));
    return Math.round(Math.min(max, Math.max(min, chosen)));
  }

  function maxManualTargetCpm(testCpm) {
    const cappedTest = Math.min(Math.max(0, testCpm), MAX_TEST_CPM);
    return Math.round(Math.min(MAX_TARGET_CPM, Math.max(MIN_TARGET_CPM, cappedTest * MAX_MANUAL_SPEED_RATIO)));
  }

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[\u2018\u2019']/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function deriveTypeText(label) {
    const text = String(label || "").trim();
    const dash = text.match(/\s[—–-]\s(.+)$/);
    if (dash) return dash[1].trim();
    const words = text.split(/\s+/);
    if (words.length <= 6) return text;
    return words.slice(0, 5).join(" ");
  }

  function choiceTypeText(choice) {
    if (choice.typeText) return String(choice.typeText).trim();
    return deriveTypeText(choice.label);
  }

  function countCorrectChars(chars) {
    return (chars || []).filter((c) => c.state === "correct").length;
  }

  /**
   * Compare typed input against a single target string.
   * Returns per-character states for ghost rendering.
   */
  function compareToTarget(target, input) {
    const t = normalize(target);
    const raw = String(input || "");
    const chars = [];
    let typoCount = 0;
    let consecutiveErrors = 0;

    for (let i = 0; i < raw.length; i++) {
      const typed = raw[i];
      const expected = t[i];
      if (!expected) {
        chars.push({ char: typed, state: "extra", index: i });
        typoCount++;
        continue;
      }
      const match = normalize(typed) === expected || typed.toLowerCase() === expected;
      if (match) {
        chars.push({ char: typed, state: "correct", index: i });
        consecutiveErrors = 0;
      } else {
        chars.push({ char: typed, state: "wrong", index: i, expected });
        typoCount++;
        consecutiveErrors++;
      }
    }

    const complete = normalize(raw) === t;
    const progress = t.length ? Math.min(100, Math.round((raw.length / t.length) * 100)) : 0;
    const correctCount = countCorrectChars(chars);

    return {
      target: t,
      raw,
      chars,
      typoCount,
      complete,
      progress,
      typedLength: raw.length,
      targetLength: t.length,
      correctCount,
    };
  }

  /**
   * Find which choice the user is typing toward (best prefix match).
   */
  function resolveActiveChoice(input, choices) {
    const raw = String(input || "");
    if (!raw.trim()) return { choice: null, choiceIndex: -1, typeText: "" };

    let bestIdx = -1;
    let bestScore = -1;

    choices.forEach((c, i) => {
      const typeText = normalize(choiceTypeText(c));
      const typed = normalize(raw);
      let score = 0;
      for (let j = 0; j < typed.length && j < typeText.length; j++) {
        if (typed[j] === typeText[j]) score++;
        else break;
      }
      if (typed.length <= typeText.length && score === typed.length) {
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    });

    if (bestIdx >= 0) {
      return { choice: choices[bestIdx], choiceIndex: bestIdx, typeText: choiceTypeText(choices[bestIdx]) };
    }

    // Fallback: partial overlap with any choice
    choices.forEach((c, i) => {
      const typeText = normalize(choiceTypeText(c));
      const typed = normalize(raw);
      let score = 0;
      for (let j = 0; j < Math.min(typed.length, typeText.length); j++) {
        if (typed[j] === typeText[j]) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });

    return {
      choice: bestIdx >= 0 ? choices[bestIdx] : null,
      choiceIndex: bestIdx,
      typeText: bestIdx >= 0 ? choiceTypeText(choices[bestIdx]) : "",
    };
  }

  function buildBranchDisplay(prefix, choices) {
    const p = String(prefix || "").trim();
    const branches = choices.map((c) => choiceTypeText(c));
    return { prefix: p, branches };
  }

  function renderGhostHtml(target, typedLength, options = {}) {
    const t = String(target || "");
    const len = typedLength || 0;
    const ghostClass = options.ghostClass || "tt-ghost-char";
    const solidClass = options.solidClass || "tt-ghost-char--solid";
    const sep = options.separator || "";

    let html = "";
    for (let i = 0; i < t.length; i++) {
      const ch = t[i] === " " ? "\u00a0" : escapeHtml(t[i]);
      const cls = i < len ? solidClass : ghostClass;
      html += `<span class="${cls}">${ch}</span>`;
    }
    if (sep) html += `<span class="tt-ghost-sep">${escapeHtml(sep)}</span>`;
    return html;
  }

  function renderBranchGhostHtml(prefix, branches, activeBranchIdx, typedInBranch) {
    const prefixHtml = prefix
      ? `<span class="tt-ghost-prefix">${escapeHtml(prefix)}</span><span class="tt-ghost-ellipsis">…</span>`
      : "";

    const branchHtml = branches
      .map((b, i) => {
        const typedLen = i === activeBranchIdx ? typedInBranch : 0;
        const inner = renderGhostHtml(b, typedLen);
        const active = i === activeBranchIdx ? " tt-ghost-branch--active" : "";
        return `<span class="tt-ghost-branch${active}">${inner}</span>`;
      })
      .join('<span class="tt-ghost-slash">/</span>');

    return prefixHtml + branchHtml;
  }

  function renderTypedCharsHtml(chars, maxTypos) {
    if (!chars.length) return "";
    return chars
      .map((c) => {
        let cls = "tt-typed-char";
        if (c.state === "correct") cls += " tt-typed-char--correct";
        else if (c.state === "wrong") cls += " tt-typed-char--wrong";
        else cls += " tt-typed-char--extra";
        const ch = c.char === " " ? "\u00a0" : escapeHtml(c.char);
        return `<span class="${cls}">${ch}</span>`;
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function exceedsTypoBudget(typoCount, maxTypos) {
    if (maxTypos >= 10) return false;
    return typoCount > maxTypos;
  }

  /**
   * Path choices require the full ghost phrase — no early unlock at 70% of letters.
   * Typo budget still applies once the whole target has been typed.
   */
  function isChoiceComplete(cmp, maxTypos = 0) {
    if (!cmp) return false;
    const targetLen = cmp.targetLength || 0;
    const typedLen = cmp.typedLength ?? 0;
    if (!targetLen || typedLen < targetLen) return false;
    if (exceedsTypoBudget(cmp.typoCount || 0, maxTypos)) return false;
    return true;
  }

  function meetsSpeedGate(cpm, targetCpm, ratio = 0.85) {
    if (!targetCpm || targetCpm <= 0 || ratio <= 0) return true;
    return cpm >= targetCpm * ratio;
  }

  /** Free-response accuracy: real letters/words vs junk. 0–1. */
  function estimateTextAccuracy(text) {
    const raw = String(text || "");
    const compact = raw.replace(/\s+/g, "");
    if (!compact) return 0;
    const letters = (raw.match(/[A-Za-z]/g) || []).length;
    const letterRatio = letters / compact.length;
    const words = raw.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return Math.max(0, Math.min(1, letterRatio));
    const realish = words.filter((w) => /[a-zA-Z]{2,}/.test(w)).length;
    const wordRatio = realish / words.length;
    return Math.max(0, Math.min(1, letterRatio * 0.55 + wordRatio * 0.45));
  }

  /**
   * Composition unlock — accuracy and communication before raw speed.
   * Delegates to TechTrailPedagogy when loaded; falls back to accuracy-weighted score.
   */
  function evaluateChallengeUnlock(cfg) {
    if (window.TechTrailPedagogy?.evaluateCompositionUnlock) {
      return window.TechTrailPedagogy.evaluateCompositionUnlock(cfg);
    }
    const words = Math.max(0, cfg.words || 0);
    const minWords = Math.max(1, cfg.minWords || 20);
    const liveCpm = Math.max(0, cfg.liveCpm || 0);
    const targetCpm = Math.max(0, cfg.targetCpm || 0);
    const accuracy = Math.max(0, Math.min(1, cfg.accuracy ?? 0));
    const speedGate = cfg.speedGate ?? 0.85;
    const accuracyMin = cfg.accuracyMin ?? 0.68;
    const minWordsFloor = cfg.minWordsFloor ?? 4;

    const speedRatio = targetCpm > 0 ? liveCpm / targetCpm : 1;
    const speedOk = speedRatio >= speedGate;
    const accuracyOk = accuracy >= accuracyMin;
    const enoughFloor = words >= minWordsFloor;
    const wordSoft = Math.min(1, words / minWords);
    const score = accuracy * 0.5 + wordSoft * 0.35 + Math.min(1, speedRatio) * 0.15;
    const unlocked = enoughFloor && accuracyOk && (score >= 0.55 || (accuracy >= 0.82 && wordSoft >= 0.45));
    return {
      unlocked,
      score,
      performanceScore: Math.round(score * 100),
      speedOk,
      accuracyOk,
      speedRatio,
      wordSoft,
    };
  }

  function classifyErrors(target, input, cmp, keystrokeStats) {
    if (window.TechTrailPedagogy?.classifyErrors) {
      return window.TechTrailPedagogy.classifyErrors(target, input, cmp, keystrokeStats);
    }
    const correct = cmp?.correctCount ?? 0;
    const len = cmp?.targetLength || 1;
    return {
      counts: {},
      totalErrors: cmp?.typoCount || 0,
      accuracy: correct / len,
      accuracyPct: Math.round((correct / len) * 100),
    };
  }

  window.TechTrailTyping = {
    DIAGNOSTIC_PHRASES,
    RECOMMENDED_SPEED_RATIO,
    MAX_MANUAL_SPEED_RATIO,
    MIN_TARGET_CPM,
    DEFAULT_TARGET_CPM,
    MAX_TEST_CPM,
    MAX_TARGET_CPM,
    MIN_MS_PER_KEY,
    SHORT_PATH_MAX_CHARS,
    normalize,
    deriveTypeText,
    choiceTypeText,
    countCorrectChars,
    computeCpm,
    pickDiagnosticPhrase,
    recommendedTargetCpm,
    clampTargetCpm,
    maxManualTargetCpm,
    compareToTarget,
    resolveActiveChoice,
    buildBranchDisplay,
    renderGhostHtml,
    renderBranchGhostHtml,
    renderTypedCharsHtml,
    exceedsTypoBudget,
    isChoiceComplete,
    meetsSpeedGate,
    isShortTranscriptionPath,
    scaledSpeedGateRatio,
    estimateTextAccuracy,
    evaluateChallengeUnlock,
    classifyErrors,
    escapeHtml,
  };
})();

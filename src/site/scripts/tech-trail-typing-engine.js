/**
 * Tech Trail Typing Engine — diagnostic, ghost-text matching, WPM, typo tolerance.
 * Aligns with ITEM 2025 keyboarding benchmarks (8.3.2.1) and middle-school fluency goals.
 */
(() => {
  "use strict";

  const DIAGNOSTIC_PHRASES = [
    "the quick brown fox jumped over the lazy log",
    "pack my box with five dozen liquor jugs",
    "sphinx of black quartz judge my vow",
    "how vexingly quick daft zebras jump",
    "jovial monks flee quirky badger packs",
  ];

  const RECOMMENDED_SPEED_RATIO = 0.88;
  const MAX_MANUAL_SPEED_RATIO = 1.5;
  const MIN_TARGET_WPM = 8;
  const DEFAULT_TARGET_WPM = 18;

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

  /** Standard WPM: (characters / 5) / minutes */
  function computeWpm(charCount, durationMs) {
    if (!durationMs || durationMs <= 0) return 0;
    const minutes = durationMs / 60000;
    return Math.round(((charCount / 5) / minutes) * 10) / 10;
  }

  function pickDiagnosticPhrase(rng = Math.random) {
    const i = Math.floor(rng() * DIAGNOSTIC_PHRASES.length);
    return DIAGNOSTIC_PHRASES[i];
  }

  function recommendedTargetWpm(testWpm) {
    const base = Math.max(MIN_TARGET_WPM, testWpm * RECOMMENDED_SPEED_RATIO);
    return Math.round(base * 10) / 10;
  }

  function clampTargetWpm(testWpm, chosen) {
    const min = MIN_TARGET_WPM;
    const max = Math.max(min, testWpm * MAX_MANUAL_SPEED_RATIO);
    return Math.round(Math.min(max, Math.max(min, chosen)) * 10) / 10;
  }

  function maxManualTargetWpm(testWpm) {
    return Math.round(Math.max(MIN_TARGET_WPM, testWpm * MAX_MANUAL_SPEED_RATIO) * 10) / 10;
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

    return {
      target: t,
      raw,
      chars,
      typoCount,
      complete,
      progress,
      typedLength: raw.length,
      targetLength: t.length,
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
    if (maxTypos >= 5) return false;
    return typoCount > maxTypos;
  }

  function meetsSpeedGate(wpm, targetWpm) {
    if (!targetWpm || targetWpm <= 0) return true;
    return wpm >= targetWpm * 0.85;
  }

  window.TechTrailTyping = {
    DIAGNOSTIC_PHRASES,
    RECOMMENDED_SPEED_RATIO,
    MAX_MANUAL_SPEED_RATIO,
    MIN_TARGET_WPM,
    DEFAULT_TARGET_WPM,
    normalize,
    deriveTypeText,
    choiceTypeText,
    computeWpm,
    pickDiagnosticPhrase,
    recommendedTargetWpm,
    clampTargetWpm,
    maxManualTargetWpm,
    compareToTarget,
    resolveActiveChoice,
    buildBranchDisplay,
    renderGhostHtml,
    renderBranchGhostHtml,
    renderTypedCharsHtml,
    exceedsTypoBudget,
    meetsSpeedGate,
    escapeHtml,
  };
})();

/**
 * Global Tech Gauntlet — typing-powered CYOA digital citizenship adventure.
 */
(() => {
  "use strict";

  const WriteTestCoreRef = window.WriteTestCore;
  const { STORY, CHARACTERS, START_MISSIONS, GOLDEN_SPINE } = window.TechTrailStory || {};
  const Visuals = window.TechTrailVisuals;
  const State = window.TechTrailState;
  const Audio = window.TechTrailAudio;

  /** Minimal fallback if typing-engine.js fails to load (SW cache / 404). */
  function buildTypingFallback() {
    const PHRASES = [
      "The quick brown fox jumped over the lazy dog.",
      "Always think carefully before you share online.",
      "Strong passwords help guard your personal data.",
    ];
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return {
      DIAGNOSTIC_PHRASES: PHRASES,
      MIN_TARGET_CPM: 40,
      DEFAULT_TARGET_CPM: 90,
      pickDiagnosticPhrase(rng = Math.random) {
        return PHRASES[Math.floor(rng() * PHRASES.length)];
      },
      renderGhostHtml(target, typedLength) {
        const t = String(target || "");
        const len = typedLength || 0;
        let html = "";
        for (let i = 0; i < t.length; i++) {
          const ch = t[i] === " " ? "\u00a0" : esc(t[i]);
          const cls = i < len ? "tt-ghost-char--solid" : "tt-ghost-char";
          html += `<span class="${cls}">${ch}</span>`;
        }
        return html;
      },
      renderBranchGhostHtml(prefix, branches, activeIdx, typedLen) {
        const branchHtml = (branches || []).map((b, i) => {
          const inner = this.renderGhostHtml(b, i === activeIdx ? typedLen : 0);
          return `<span class="tt-ghost-branch${i === activeIdx ? " tt-ghost-branch--active" : ""}">${inner}</span>`;
        }).join('<span class="tt-ghost-slash">/</span>');
        const prefixHtml = prefix
          ? `<span class="tt-ghost-prefix">${esc(prefix)}</span><span class="tt-ghost-ellipsis">…</span>`
          : "";
        return prefixHtml + branchHtml;
      },
      renderTypedCharsHtml(chars) {
        if (!chars?.length) return "";
        return chars.map((c) => {
          let cls = "tt-typed-char";
          if (c.state === "correct") cls += " tt-typed-char--correct";
          else if (c.state === "wrong") cls += " tt-typed-char--wrong";
          else cls += " tt-typed-char--extra";
          const ch = c.char === " " ? "\u00a0" : esc(c.char);
          return `<span class="${cls}">${ch}</span>`;
        }).join("");
      },
      normalize(s) {
        return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
      },
      compareToTarget(target, input) {
        const t = this.normalize(target);
        const raw = String(input || "");
        const chars = [];
        let typoCount = 0;
        for (let i = 0; i < raw.length; i++) {
          const expected = t[i];
          const typed = raw[i];
          if (!expected) {
            chars.push({ char: typed, state: "extra", index: i });
            typoCount++;
          } else if (typed.toLowerCase() === expected) {
            chars.push({ char: typed, state: "correct", index: i });
          } else {
            chars.push({ char: typed, state: "wrong", index: i });
            typoCount++;
          }
        }
        return {
          chars,
          typoCount,
          complete: this.normalize(raw) === t,
          progress: t.length ? Math.min(100, Math.round((raw.length / t.length) * 100)) : 0,
          typedLength: raw.length,
          targetLength: t.length,
          correctCount: chars.filter((c) => c.state === "correct").length,
        };
      },
      countCorrectChars(chars) {
        return (chars || []).filter((c) => c.state === "correct").length;
      },
      computeCpm(correctCharCount, durationMs, options = {}) {
        const count = Math.max(0, correctCharCount || 0);
        if (!count) return 0;
        const maxCpm = options.maxCpm ?? 120;
        const msPerKey = options.minMsPerKey ?? 320;
        const effectiveMs = Math.max(durationMs || 0, count * msPerKey);
        if (effectiveMs <= 0) return 0;
        return Math.min(Math.round(count / (effectiveMs / 60000)), maxCpm);
      },
      recommendedTargetCpm(testCpm) {
        const capped = Math.min(Math.max(0, testCpm), 120);
        return Math.round(Math.min(Math.max(20, capped * 0.5), 95));
      },
      clampTargetCpm(testCpm, chosen) {
        const capped = Math.min(Math.max(0, testCpm), 120);
        const max = Math.min(95, Math.max(20, capped * 1.5));
        return Math.round(Math.min(max, Math.max(20, chosen)));
      },
      maxManualTargetCpm(testCpm) {
        const capped = Math.min(Math.max(0, testCpm), 120);
        return Math.round(Math.min(95, Math.max(20, capped * 1.5)));
      },
      choiceTypeText(c) {
        if (c?.typeText) return String(c.typeText).trim();
        return String(c?.label || "").trim();
      },
      resolveActiveChoice(input, choices) {
        const raw = this.normalize(input);
        if (!raw) return { choice: null, choiceIndex: -1, typeText: "" };
        let bestIdx = -1;
        let bestScore = -1;
        (choices || []).forEach((c, i) => {
          const typeText = this.normalize(this.choiceTypeText(c));
          let score = 0;
          for (let j = 0; j < raw.length && j < typeText.length; j++) {
            if (raw[j] === typeText[j]) score++;
            else break;
          }
          if (raw.length <= typeText.length && score === raw.length && score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        });
        if (bestIdx < 0) {
          (choices || []).forEach((c, i) => {
            const typeText = this.normalize(this.choiceTypeText(c));
            let score = 0;
            for (let j = 0; j < Math.min(raw.length, typeText.length); j++) {
              if (raw[j] === typeText[j]) score++;
            }
            if (score > bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          });
        }
        return {
          choice: bestIdx >= 0 ? choices[bestIdx] : null,
          choiceIndex: bestIdx,
          typeText: bestIdx >= 0 ? this.choiceTypeText(choices[bestIdx]) : "",
        };
      },
      exceedsTypoBudget(typoCount, maxTypos) {
        if (maxTypos >= 10) return false;
        return typoCount > maxTypos;
      },
      isChoiceComplete(cmp, maxTypos = 0) {
        const targetLen = cmp?.targetLength || 0;
        const typedLen = cmp?.typedLength ?? cmp?.chars?.length ?? 0;
        if (!targetLen || typedLen < targetLen) return false;
        if (this.exceedsTypoBudget(cmp?.typoCount || 0, maxTypos)) return false;
        return true;
      },
      meetsSpeedGate(cpm, targetCpm, ratio = 0.85) {
        if (!targetCpm) return true;
        return cpm >= targetCpm * ratio;
      },
      estimateTextAccuracy(text) {
        const raw = String(text || "");
        const compact = raw.replace(/\s+/g, "");
        if (!compact) return 0;
        const letters = (raw.match(/[A-Za-z]/g) || []).length;
        const words = raw.trim().split(/\s+/).filter(Boolean);
        const realish = words.filter((w) => /[a-zA-Z]{2,}/.test(w)).length;
        const letterRatio = letters / compact.length;
        const wordRatio = words.length ? realish / words.length : 0;
        return Math.max(0, Math.min(1, letterRatio * 0.55 + wordRatio * 0.45));
      },
      evaluateChallengeUnlock(cfg) {
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
        const wordSoft = Math.min(1, words / minWords);
        const score = Math.min(1, Math.max(0, speedRatio)) * 0.62 + accuracy * 0.28 + wordSoft * 0.1;
        const unlocked = words >= minWordsFloor && accuracyOk && (speedOk || (wordSoft >= 0.5 && score >= 0.58));
        return { unlocked, score, speedOk, accuracyOk, speedRatio, wordSoft };
      },
    };
  }

  const Typing = window.TechTrailTyping || buildTypingFallback();
  if (!window.TechTrailTyping) {
    console.warn("[GTG] tech-trail-typing-engine.js missing — using built-in fallback");
  }

  const CoreStub = {
    PRESETS: { gauntlet: {} },
    applyTheme() {},
    setupPasteControl(textarea, allowPaste) {
      if (!textarea) return;
      textarea.addEventListener("paste", (e) => {
        if (!allowPaste && !textarea.readOnly) e.preventDefault();
      });
    },
    countWords(text) {
      return String(text || "").trim().split(/\s+/).filter(Boolean).length;
    },
  };
  const CoreApi = WriteTestCoreRef || CoreStub;
  if (WriteTestCoreRef) WriteTestCoreRef.applyTheme(WriteTestCoreRef.PRESETS.gauntlet);

  function showBootError(msg) {
    const el = document.getElementById("gtgBootError");
    if (el) {
      el.classList.remove("dw-hidden");
      el.textContent = msg;
    }
    console.error("[GTG]", msg);
  }

  if (!STORY || !Visuals || !State) {
    showBootError("Game scripts failed to load. Hard refresh (Ctrl+Shift+R) or clear site data for this page.");
    return;
  }

  const Core = CoreApi;

  const views = {
    title: document.getElementById("titleView"),
    game: document.getElementById("gameView"),
    ending: document.getElementById("endingView"),
  };

  let activeView = "title";
  let viewTransitionTimer = null;

  let currentNode = "start";
  let badges = new Set();
  let lessons = new Set();
  let goldenRules = new Set();
  let journal = [];
  let typingPending = null;
  let metCharacters = new Set();
  let visitedRooms = new Set(["start"]);
  let integrity = 100;
  let reputation = 50;
  let mentorTrust = {};
  let runRng = Math.random;
  let startChoices = [];
  let startTime = Date.now();
  let difficulty = "operative";
  let typingProfile = State.loadTypingProfile();
  let diagnosticPhrase = "";
  let diagnosticStartTime = 0;
  let choiceTypingStart = 0;
  let activeChoices = [];
  let activeChoicePrefix = "";
  let pendingDiagnosticAction = null;
  let choiceUnlocking = false;
  let choiceCooldownUntil = 0;
  let diagnosticKeystrokeTracker = null;
  let challengeKeystrokeTracker = null;
  let challengeStartTime = 0;

  function serializeAnalysis(analysis) {
    if (!analysis) return null;
    return {
      wordCount: analysis.wordCount,
      wpm: analysis.wpm,
      typingLevel: analysis.typingLevel,
      scores: analysis.scores,
      copyMatch: analysis.copyMatch,
      keystrokeAccuracy: analysis.keystrokeAccuracy,
      promptResponse: analysis.promptResponse ? {
        score: analysis.promptResponse.score,
        answerTier: analysis.promptResponse.answerTier,
        responseType: analysis.promptResponse.responseType,
      } : null,
      metricScores: {
        spelling: analysis.metricScores?.spelling,
        grammar: analysis.metricScores?.grammar,
        mechanics: analysis.metricScores?.mechanics,
        typing: analysis.metricScores?.typing,
        story: analysis.metricScores?.story,
        keystrokeAccuracy: analysis.metricScores?.keystrokeAccuracy,
      },
    };
  }

  function runGtgAnalysis(text, durationSec, options = {}) {
    if (!window.WriteAnalysis?.analyzeText || !String(text || "").trim()) return null;
    const duration = Math.max(1, Number(durationSec) || 1);
    return window.WriteAnalysis.analyzeText(text, duration, {
      assignmentMode: options.assignmentMode || "fluency",
      rubrics: options.rubrics || ["typing", "mechanics"],
      assignmentPrompt: options.assignmentPrompt || "",
      classroom: options.classroom || "",
      keystrokeStats: options.keystrokeStats || null,
      copyTarget: options.copyTarget || "",
    });
  }

  function analyzeDiagnosticTest(inputVal, phrase, durationMs) {
    const durationSec = Math.max(1, Math.round((durationMs || 0) / 1000));
    return runGtgAnalysis(inputVal, durationSec, {
      assignmentMode: "fluency",
      rubrics: ["typing", "mechanics"],
      assignmentPrompt: phrase,
      copyTarget: phrase,
      keystrokeStats: diagnosticKeystrokeTracker?.getStats?.() || null,
    });
  }

  function updateDiagnosticAlgoScore(analysis) {
    const el = document.getElementById("diagnosticAlgoScore");
    if (!el) return;
    if (!analysis?.scores) {
      el.classList.add("dw-hidden");
      el.textContent = "";
      return;
    }
    const typing = analysis.scores.typing ?? "—";
    const mechanics = analysis.scores.mechanics ?? "—";
    const copyPct = analysis.copyMatch ? Math.round((analysis.copyMatch.charAccuracy || 0) * 100) : null;
    const copyNote = analysis.copyMatch?.complete
      ? "Perfect sentence match"
      : copyPct != null
        ? `${copyPct}% character accuracy`
        : "";
    el.textContent = `Algorithm score — typing ${typing}, conventions ${mechanics}${copyNote ? ` · ${copyNote}` : ""}`;
    el.classList.remove("dw-hidden");
  }

  const DIFFICULTY_CONFIG = {
    cadet: { wordMult: 0.5, startChoicesMin: 3, startChoicesMax: 3, label: "Cadet", speedGate: 0.7, accuracyMin: 0.5, completeRatio: 1, typoBonus: 2, minWordsFloor: 3 },
    operative: { wordMult: 1, startChoicesMin: 3, startChoicesMax: 4, label: "Operative", speedGate: 0.85, accuracyMin: 0.68, completeRatio: 1, typoBonus: 0, minWordsFloor: 4 },
    analyst: { wordMult: 1.5, startChoicesMin: 4, startChoicesMax: 5, label: "Analyst", speedGate: 1, accuracyMin: 0.82, completeRatio: 1, typoBonus: -1, minWordsFloor: 6 },
  };

  function difficultyCfg() {
    return DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.operative;
  }

  function typoBudget() {
    return Math.max(0, (typingProfile.maxTypos || 0) + (difficultyCfg().typoBonus || 0));
  }

  function saveTypingProfile() {
    sanitizeTypingProfile();
    State.saveTypingProfile(typingProfile);
    updateTypingProfileUI();
  }

  function sanitizeTypingProfile() {
    const maxTest = Typing.MAX_TEST_CPM ?? 120;
    const maxTarget = Typing.MAX_TARGET_CPM ?? 95;
    const minTarget = Typing.MIN_TARGET_CPM ?? 20;
    if (typingProfile.testCpm > maxTest) typingProfile.testCpm = maxTest;
    if (typingProfile.targetCpm > maxTarget) typingProfile.targetCpm = maxTarget;
    if (typingProfile.targetCpm < minTarget && typingProfile.diagnosed) {
      typingProfile.targetCpm = minTarget;
    }
  }

  function updateTypingProfileUI() {
    const bar = document.getElementById("typingProfileBar");
    const testEl = document.getElementById("profileTestWpm");
    const targetEl = document.getElementById("profileTargetWpm");
    const statTarget = document.getElementById("statTargetWpm");
    if (typingProfile.diagnosed) {
      bar?.classList.remove("dw-hidden");
      if (testEl) testEl.textContent = String(typingProfile.testCpm);
      if (targetEl) targetEl.textContent = String(typingProfile.targetCpm);
    } else {
      bar?.classList.add("dw-hidden");
    }
    if (statTarget) statTarget.textContent = typingProfile.diagnosed ? String(typingProfile.targetCpm) : "—";
  }

  function updateTypoToleranceUI() {
    const label = document.getElementById("typoToleranceLabel");
    const range = document.getElementById("typoToleranceRange");
    if (range) range.value = String(Math.min(10, typingProfile.maxTypos));
    if (label) {
      label.textContent = typingProfile.maxTypos >= 10 ? "all typos OK" : `${typingProfile.maxTypos} typo${typingProfile.maxTypos === 1 ? "" : "s"}`;
    }
  }

  function requireDiagnostic(onComplete) {
    if (typingProfile.diagnosed) {
      onComplete?.();
      return;
    }
    pendingDiagnosticAction = onComplete;
    const overlay = document.getElementById("diagnosticOverlay");
    if (overlay && !overlay.classList.contains("dw-hidden")) return;
    showDiagnostic();
  }

  function startMissionCore() {
    hideDiagnostic();
    show("game");
    resetRun();
    showSceneLoader();
    setTimeout(() => {
      renderScene("start").catch((err) => {
        console.error("[GTG] Failed to load start scene:", err);
        toast("Mission failed to load — tap Play mission to try again.", "lesson");
      });
      hideSceneLoader();
      updateTitleLaunchUI();
    }, SCENE_LOADER_MIN_MS);
  }

  function updateTitleLaunchUI() {
    const isNew = !typingProfile.diagnosed;
    const hasRun = State.hasActiveRun();
    const welcome = document.getElementById("titleWelcome");
    const extras = document.getElementById("titleExtras");
    const typingMenu = document.getElementById("titleTypingMenu");
    const startBtn = document.getElementById("startGameBtn");
    const startLabel = document.getElementById("startGameBtnLabel");
    const startHint = document.getElementById("startGameBtnHint");
    const continueBtn = document.getElementById("continueRunBtn");
    const newRunBtn = document.getElementById("newRunBtn");

    if (isNew) {
      welcome?.classList.remove("dw-hidden");
      extras?.classList.add("dw-hidden");
      typingMenu?.classList.add("dw-hidden");
      if (startLabel) startLabel.textContent = "Start keystroke test";
      if (startHint) startHint.textContent = "Required before your first mission";
      startBtn?.setAttribute("aria-label", "Begin keystroke test — required for new players");
    } else {
      welcome?.classList.add("dw-hidden");
      extras?.classList.remove("dw-hidden");
      typingMenu?.classList.remove("dw-hidden");
      if (startLabel) startLabel.textContent = hasRun ? "New mission" : "Play mission";
      if (startHint) startHint.textContent = hasRun ? "Fresh run from the start" : "Tap or type ACCEPT MISSION";
      startBtn?.setAttribute("aria-label", hasRun ? "Start a new mission" : "Play mission");
    }

    if (hasRun) {
      startBtn?.classList.add("dw-hidden");
      continueBtn?.classList.remove("dw-hidden");
      newRunBtn?.classList.remove("dw-hidden");
    } else {
      startBtn?.classList.remove("dw-hidden");
      continueBtn?.classList.add("dw-hidden");
      newRunBtn?.classList.add("dw-hidden");
    }
  }

  function openDiagnosticForLaunch(onComplete) {
    const overlay = document.getElementById("diagnosticOverlay");
    if (overlay && !overlay.classList.contains("dw-hidden")) return;
    pendingDiagnosticAction = onComplete;
    showDiagnostic();
  }

  function showDiagnostic() {
    const overlay = document.getElementById("diagnosticOverlay");
    const input = document.getElementById("diagnosticInput");
    const result = document.getElementById("diagnosticResult");
    const status = document.getElementById("diagnosticStatus");
    const step = document.getElementById("diagnosticStep");
    const panel = overlay?.querySelector(".tt-diagnostic__panel");
    if (!overlay) return;

    diagnosticPhrase = Typing.pickDiagnosticPhrase(runRng) || Typing.DIAGNOSTIC_PHRASES?.[0] || "The quick brown fox jumped over the lazy dog.";
    diagnosticStartTime = 0;
    overlay.classList.remove("dw-hidden");
    result?.classList.add("dw-hidden");
    if (step) step.textContent = "Step 1 of 2 · Type the phrase";
    if (status) status.textContent = "Type the whole sentence in the box below — don't forget the period!";
    panel?.classList.remove("tt-diagnostic__panel--success");
    if (input) {
      input.value = "";
      input.disabled = false;
    }
    diagnosticKeystrokeTracker?.detach?.();
    diagnosticKeystrokeTracker = Core.createKeystrokeTracker?.(input) || null;
    diagnosticKeystrokeTracker?.attach?.();
    diagnosticKeystrokeTracker?.reset?.();
    document.getElementById("diagnosticAlgoScore")?.classList.add("dw-hidden");
    updateDiagnosticGhost("");
    document.getElementById("diagnosticTyped").innerHTML = "";
    updateTypingMeterUI({
      progressPct: 0,
      liveCpm: 0,
      progressFillId: "diagnosticProgressFill",
      speedFillId: "diagnosticWpmFill",
      progressPctId: "diagnosticProgressPct",
      liveCpmId: "diagnosticLiveWpm",
      inputEl: input,
    });
    panel?.classList.add("tt-diagnostic__panel--pop");
    setTimeout(() => input?.focus(), 120);
  }

  function hideDiagnostic() {
    document.getElementById("diagnosticOverlay")?.classList.add("dw-hidden");
  }

  function clearPendingDiagnostic() {
    pendingDiagnosticAction = null;
  }

  function updateDiagnosticGhost(inputVal) {
    const ghost = document.getElementById("diagnosticGhost");
    const plain = document.getElementById("diagnosticPhrasePlain");
    const phrase = diagnosticPhrase || Typing.DIAGNOSTIC_PHRASES?.[0] || "The quick brown fox jumped over the lazy dog.";
    if (plain) plain.textContent = phrase;
    if (ghost) ghost.innerHTML = Typing.renderGhostHtml(phrase, inputVal.length);
  }

  function handleDiagnosticInput() {
    const input = document.getElementById("diagnosticInput");
    const typedEl = document.getElementById("diagnosticTyped");
    const status = document.getElementById("diagnosticStatus");
    if (!input) return;

    if (!diagnosticStartTime && input.value.length > 0) {
      diagnosticStartTime = performance.now();
    }

    const cmp = Typing.compareToTarget(diagnosticPhrase, input.value);
    updateDiagnosticGhost(input.value);
    if (typedEl) typedEl.innerHTML = Typing.renderTypedCharsHtml(cmp.chars, typingProfile.maxTypos);

    const duration = diagnosticStartTime ? performance.now() - diagnosticStartTime : 0;
    const liveCpm = duration > 0 ? Typing.computeCpm(cmp.correctCount, duration) : 0;
    updateTypingMeterUI({
      progressPct: cmp.progress,
      liveCpm,
      targetCpm: typingProfile.targetCpm || Typing.DEFAULT_TARGET_CPM,
      progressFillId: "diagnosticProgressFill",
      speedFillId: "diagnosticWpmFill",
      progressPctId: "diagnosticProgressPct",
      liveCpmId: "diagnosticLiveWpm",
      inputEl: input,
      complete: cmp.complete,
      speedOk: true,
    });

    if (cmp.chars.length > 0) {
      const last = cmp.chars[cmp.chars.length - 1];
      if (last.state === "correct") Audio?.playCharCorrect?.();
      else Audio?.playTypeTick?.();
    }

    if (Typing.exceedsTypoBudget(cmp.typoCount, 0)) {
      if (status) status.textContent = "Fix the underlined letters before continuing.";
      return;
    }

    if (!cmp.complete && status) {
      const normInput = Typing.normalize(input.value);
      const normPhrase = Typing.normalize(diagnosticPhrase);
      if (normPhrase.endsWith(".") && normInput === normPhrase.slice(0, -1).trim()) {
        status.textContent = "Almost there — type the period to finish the sentence.";
      }
    }

    if (cmp.complete) {
      const duration = diagnosticStartTime ? performance.now() - diagnosticStartTime : 0;
      const cpm = Typing.computeCpm(cmp.correctCount, duration);
      typingProfile.testCpm = cpm;
      typingProfile.lastPhrase = diagnosticPhrase;
      typingProfile.diagnosedAt = Date.now();
      const recommended = Typing.recommendedTargetCpm(cpm);
      typingProfile.targetCpm = recommended;

      const diagnosticAnalysis = analyzeDiagnosticTest(input.value, diagnosticPhrase, duration);
      typingProfile.diagnosticAnalysis = serializeAnalysis(diagnosticAnalysis);
      updateDiagnosticAlgoScore(diagnosticAnalysis);

      input.disabled = true;
      document.getElementById("diagnosticWpm").textContent = String(cpm);
      document.getElementById("diagnosticRecommended").textContent = String(recommended);
      const targetInput = document.getElementById("diagnosticTargetInput");
      if (targetInput) {
        targetInput.min = String(Typing.MIN_TARGET_CPM);
        targetInput.max = String(Typing.maxManualTargetCpm(cpm));
        targetInput.value = String(recommended);
      }
      document.getElementById("diagnosticResult")?.classList.remove("dw-hidden");
      const step = document.getElementById("diagnosticStep");
      if (step) step.textContent = "Step 2 of 2 · Lock your target";
      if (status) status.textContent = "Great typing! Tap Start mission below (or press Enter).";
      document.getElementById("diagnosticAcceptBtn")?.focus();
      Audio?.playDiagnosticPop?.();
      document.querySelector(".tt-diagnostic__panel")?.classList.add("tt-diagnostic__panel--success");
      celebrateTypedSuccess(diagnosticPhrase, input, {
        badge: `${cpm} keys/min!`,
        badgeVariant: "green",
        confetti: 16,
        skipAudio: true,
        container: document.querySelector(".tt-diagnostic__panel"),
      });
    }
  }

  function acceptDiagnostic() {
    const targetInput = document.getElementById("diagnosticTargetInput");
    const chosen = Number(targetInput?.value || typingProfile.targetCpm);
    typingProfile.targetCpm = Typing.clampTargetCpm(typingProfile.testCpm, chosen);
    typingProfile.diagnosed = true;
    saveTypingProfile();
    updateTitleLaunchUI();
    const acceptBtn = document.getElementById("diagnosticAcceptBtn");
    celebrateTypedSuccess("MISSION LAUNCH", acceptBtn || targetInput, {
      badge: "LET'S GO!",
      confetti: 14,
      center: true,
      container: document.querySelector(".tt-diagnostic__panel"),
    });
    const launch = pendingDiagnosticAction;
    setTimeout(() => {
      hideDiagnostic();
      clearPendingDiagnostic();
      toast(`Target: ${typingProfile.targetCpm} keys/min — launching mission!`, "badge");
      launch?.();
    }, prefersReducedMotion ? 0 : 450);
  }

  function handleDiagnosticKeydown(e) {
    const result = document.getElementById("diagnosticResult");
    if (!result || result.classList.contains("dw-hidden")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      acceptDiagnostic();
    }
  }

  function clearChoiceTyping() {
    const input = document.getElementById("choiceTypingInput");
    const typed = document.getElementById("choiceTypedDisplay");
    const ghost = document.getElementById("choiceGhostPrompt");
    const hint = document.getElementById("choiceSpeedHint");
    if (input) input.value = "";
    if (typed) typed.innerHTML = "";
    if (ghost) ghost.innerHTML = "";
    if (hint) hint.textContent = "";
    choiceTypingStart = 0;
    activeChoices = [];
    activeChoicePrefix = "";
    choiceUnlocking = false;
    document.getElementById("liveWpmStat")?.classList.add("dw-hidden");
  }

  function renderClickChoices(node, choices) {
    const choicesEl = document.getElementById("sceneChoices");
    if (!choicesEl || !choices.length) return;
    clearChoiceTyping();
    activeChoices = choices;

    choicesEl.innerHTML = choices.map((c, i) => {
      const riskClass = c.risky ? " tt-choice--risky" : c.safe ? " tt-choice--safe" : "";
      const arrow = c.recommended ? "⭐" : "➤";
      const label = escapeHtml(c.label || c.typeText || "Choose");
      return `<button type="button" class="tt-choice${riskClass}" style="--tt-choice-i:${i}" data-idx="${i}">
        <span class="tt-choice__arrow">${arrow}</span>
        <span>${label}</span>
        <span class="tt-choice__glow"></span>
      </button>`;
    }).join("");

    choicesEl.querySelectorAll(".tt-choice").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (choiceCooldownUntil && Date.now() < choiceCooldownUntil) return;
        const idx = Number(btn.dataset.idx);
        const choice = activeChoices[idx];
        if (!choice) return;

        btn.classList.add("tt-choice--picked");
        choiceCooldownUntil = Date.now() + CHOICE_COOLDOWN_MS;

        const label = choice.label || choice.typeText || "";
        journal.push(`➤ ${label.slice(0, 80)}${label.length > 80 ? "…" : ""}`);

        applyChoiceEffects(choice);
        navigate(choice.next);
      });
    });
  }

  function setupTypingChoices(node, choices) {
    const wrap = document.getElementById("typingChoices");
    const choicesEl = document.getElementById("sceneChoices");
    if (!wrap || !choices.length) return;

    clearChoiceTyping();
    activeChoices = choices;
    activeChoicePrefix = node.choicePrefix || "";

    choicesEl.innerHTML = "";
    wrap.classList.remove("dw-hidden");

    const branches = choices.map((c) => Typing.choiceTypeText(c));
    const ghost = document.getElementById("choiceGhostPrompt");
    if (ghost) {
      ghost.innerHTML = Typing.renderBranchGhostHtml(activeChoicePrefix, branches, -1, 0);
    }

    const hint = document.getElementById("choiceSpeedHint");
    const cfg = difficultyCfg();
    const budget = typoBudget();
    if (hint) {
      hint.textContent = `Type the full highlighted path. Speed unlocks it (${Math.round(cfg.speedGate * 100)}% of ${typingProfile.targetCpm} keys/min) · ${budget >= 10 ? "typos forgiven" : `up to ${budget} typo${budget === 1 ? "" : "s"}`}`;
    }

    updateTypingMeterUI({
      progressPct: 0,
      liveCpm: 0,
      targetCpm: typingProfile.targetCpm,
      progressFillId: "choiceProgressFill",
      speedFillId: "choiceWpmFill",
      progressPctId: "choiceProgressPct",
      liveCpmId: "choiceLiveWpm",
      targetCpmId: "choiceTargetWpm",
      inputEl: document.getElementById("choiceTypingInput"),
    });

    document.getElementById("liveWpmStat")?.classList.remove("dw-hidden");
    const input = document.getElementById("choiceTypingInput");
    setTimeout(() => input?.focus(), prefersReducedMotion ? 0 : 480);
    wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleChoiceTypingInput() {
    if (choiceUnlocking || !activeChoices.length) return;
    const input = document.getElementById("choiceTypingInput");
    const typedEl = document.getElementById("choiceTypedDisplay");
    const ghost = document.getElementById("choiceGhostPrompt");
    const hint = document.getElementById("choiceSpeedHint");
    if (!input) return;

    if (!choiceTypingStart && input.value.length > 0) {
      choiceTypingStart = performance.now();
    }

    const resolved = Typing.resolveActiveChoice(input.value, activeChoices);
    const typeText = resolved.typeText || "";
    const cmp = Typing.compareToTarget(typeText, input.value);
    const branches = activeChoices.map((c) => Typing.choiceTypeText(c));

    if (ghost) {
      ghost.innerHTML = Typing.renderBranchGhostHtml(
        activeChoicePrefix,
        branches,
        resolved.choiceIndex,
        input.value.length
      );
    }
    if (typedEl) typedEl.innerHTML = Typing.renderTypedCharsHtml(cmp.chars, typoBudget());

    const cfg = difficultyCfg();
    const duration = choiceTypingStart ? performance.now() - choiceTypingStart : 0;
    const liveCpm = duration > 0 ? Typing.computeCpm(cmp.correctCount, duration) : 0;
    const liveEl = document.getElementById("statLiveWpm");
    if (liveEl) liveEl.textContent = String(liveCpm);
    const speedOk = Typing.meetsSpeedGate(liveCpm, typingProfile.targetCpm, cfg.speedGate);
    const pathComplete = Typing.isChoiceComplete
      ? Typing.isChoiceComplete(cmp, typoBudget())
      : Boolean(cmp.complete);

    updateTypingMeterUI({
      progressPct: cmp.progress,
      liveCpm,
      targetCpm: typingProfile.targetCpm,
      progressFillId: "choiceProgressFill",
      speedFillId: "choiceWpmFill",
      progressPctId: "choiceProgressPct",
      liveCpmId: "choiceLiveWpm",
      targetCpmId: "choiceTargetWpm",
      inputEl: input,
      complete: pathComplete,
      speedOk,
    });

    if (cmp.chars.length > 0) {
      const last = cmp.chars[cmp.chars.length - 1];
      if (last.state === "correct") Audio?.playCharCorrect?.();
      else Audio?.playTypeTick?.();
    }

    if (Typing.exceedsTypoBudget(cmp.typoCount, typoBudget())) {
      if (hint) hint.textContent = "Too many typos — fix the underlined letters!";
      return;
    }

    if (!pathComplete || !resolved.choice) {
      if (hint && resolved.choice && cmp.targetLength && cmp.typedLength < cmp.targetLength) {
        const left = Math.max(0, cmp.targetLength - cmp.typedLength);
        hint.textContent = `Keep typing the full path — ${left} character${left === 1 ? "" : "s"} left.`;
      }
      return;
    }

    if (!speedOk && !(pathComplete && difficulty !== "analyst")) {
      const need = Math.round(typingProfile.targetCpm * cfg.speedGate);
      if (hint) hint.textContent = `Path is complete — keep typing at about ${need} keys/min to unlock (${liveCpm} now).`;
      return;
    }

    choiceUnlocking = true;
    input.disabled = true;
    const displayPhrase = activeChoicePrefix
      ? `${activeChoicePrefix} ${typeText}`
      : typeText;
    celebrateTypedSuccess(displayPhrase, input, {
      badge: "PATH UNLOCKED!",
      confetti: 14,
      container: document.getElementById("typingChoices"),
    });
    if (hint) hint.textContent = "Path unlocked!";
    document.getElementById("typingChoices")?.classList.add("tt-typing-choices--unlock");

    const choiceData = resolved.choice;
    const label = choiceData.label || typeText;
    journal.push(`⌨️ ${label.slice(0, 80)}${label.length > 80 ? "…" : ""}`);

    setTimeout(() => {
      applyChoiceEffects(choiceData);
      navigate(choiceData.next);
    }, prefersReducedMotion ? 0 : 1000);
  }

  function getTitleChoices() {
    if (State.hasActiveRun()) {
      return [
        { typeText: "CONTINUE MISSION", action: "continue" },
        { typeText: "NEW MISSION", action: "newrun" },
        { typeText: "ACCEPT MISSION", action: "newrun" },
      ];
    }
    return [{ typeText: "ACCEPT MISSION", action: "start" }];
  }

  function resolveTitleCommand(inputVal) {
    const choices = getTitleChoices().map((c) => ({ ...c, label: c.typeText }));
    const resolved = Typing.resolveActiveChoice(inputVal, choices);
    return {
      choice: resolved.choice,
      choiceIndex: resolved.choiceIndex,
      typeText: resolved.typeText || "",
      action: resolved.choice?.action || null,
    };
  }

  function titlePrefixProgress(inputVal, typeText) {
    const t = Typing.normalize(typeText);
    const raw = Typing.normalize(inputVal);
    if (!t.length) return raw.length > 0 ? Math.min(99, raw.length * 5) : 0;
    let match = 0;
    for (let i = 0; i < raw.length; i++) {
      if (i < t.length && raw[i] === t[i]) match = i + 1;
      else break;
    }
    return Math.min(100, Math.round((match / t.length) * 100));
  }

  function isTitleCommandComplete(inputVal, typeText) {
    return Typing.normalize(inputVal) === Typing.normalize(typeText);
  }

  function runTitleCommand(action) {
    if (action === "start") beginStartMission();
    else if (action === "continue") beginContinueMission();
    else if (action === "newrun") beginNewMission();
  }

  function renderTitleTypingMenu() {
    const ghost = document.getElementById("titleGhostPrompt");
    const hint = document.getElementById("titleCommandHint");
    const choices = getTitleChoices();
    const options = choices.map((c) => c.typeText);
    if (hint) {
      hint.innerHTML = options.length > 1
        ? `Type: ${options.map((o) => `<strong>${escapeHtml(o)}</strong>`).join(" · ")}`
        : `Type: <strong>${escapeHtml(options[0])}</strong> to begin`;
    }
    if (!ghost) return;
    ghost.innerHTML = Typing.renderBranchGhostHtml("", options, -1, 0);
  }

  function handleTitleTypingInput() {
    const input = document.getElementById("titleTypingInput");
    const typedEl = document.getElementById("titleTypedDisplay");
    if (!input || input.disabled) return;

    const choices = getTitleChoices();
    const options = choices.map((c) => c.typeText);
    const resolved = resolveTitleCommand(input.value);
    const typeText = resolved.typeText;

    const ghost = document.getElementById("titleGhostPrompt");
    if (ghost) {
      const typedLen = resolved.choiceIndex >= 0 ? input.value.length : 0;
      ghost.innerHTML = Typing.renderBranchGhostHtml("", options, resolved.choiceIndex, typedLen);
    }

    if (!typeText) {
      if (typedEl) typedEl.innerHTML = "";
      updateTypingMeterUI({
        progressPct: titlePrefixProgress(input.value, options[0] || "ACCEPT MISSION"),
        progressFillId: "titleProgressFill",
        progressPctId: "titleProgressPct",
        inputEl: input,
      });
      return;
    }

    const cmp = Typing.compareToTarget(typeText, input.value);
    const progressPct = titlePrefixProgress(input.value, typeText);
    if (typedEl) typedEl.innerHTML = Typing.renderTypedCharsHtml(cmp.chars, 999);
    updateTypingMeterUI({
      progressPct,
      liveWpm: 0,
      targetWpm: 0,
      progressFillId: "titleProgressFill",
      progressPctId: "titleProgressPct",
      inputEl: input,
      complete: cmp.complete,
      speedOk: true,
    });

    if (cmp.chars.length > 0) {
      const last = cmp.chars[cmp.chars.length - 1];
      if (last.state === "correct") Audio?.playCharCorrect?.();
      else Audio?.playTypeTick?.();
    }

    const commandComplete = isTitleCommandComplete(input.value, typeText);
    if (!commandComplete || !resolved.action) return;

    input.disabled = true;

    const badge =
      resolved.action === "start" ? "MISSION ON!"
      : resolved.action === "continue" ? "WELCOME BACK!"
      : "NEW RUN!";
    celebrateTypedSuccess(typeText, input, {
      badge,
      confetti: 10,
      container: document.getElementById("titleTypingMenu"),
    });

    const delay = prefersReducedMotion ? 0 : 700;
    setTimeout(() => {
      input.value = "";
      if (typedEl) typedEl.innerHTML = "";
      input.disabled = false;
      updateTypingMeterUI({
        progressPct: 0,
        progressFillId: "titleProgressFill",
        progressPctId: "titleProgressPct",
        inputEl: input,
      });
      runTitleCommand(resolved.action);
    }, delay);
  }

  function handleTitleTypingKeydown(e) {
    if (e.key !== "Enter") return;
    const input = document.getElementById("titleTypingInput");
    if (!input || input.disabled) return;
    const resolved = resolveTitleCommand(input.value);
    if (!resolved.typeText) return;
    if (isTitleCommandComplete(input.value, resolved.typeText) && resolved.action) {
      e.preventDefault();
      handleTitleTypingInput();
    }
  }

  function beginStartMission() {
    Audio?.init?.();
    requestGameFullscreen().then(updateFullscreenButton);
    if (!typingProfile.diagnosed) {
      openDiagnosticForLaunch(() => startMissionCore());
      return;
    }
    startMissionCore();
  }

  function beginContinueMission() {
    Audio?.init?.();
    if (!typingProfile.diagnosed) {
      openDiagnosticForLaunch(() => beginContinueMission());
      return;
    }
    const saved = State.loadRun();
    if (saved) {
      currentNode = saved.currentNode;
      badges = saved.badges;
      lessons = saved.lessons;
      goldenRules = saved.goldenRules;
      journal = saved.journal;
      metCharacters = saved.metCharacters;
      visitedRooms = saved.visitedRooms instanceof Set ? saved.visitedRooms : new Set(saved.visitedRooms || [currentNode]);
      integrity = saved.integrity ?? 100;
      reputation = saved.reputation ?? 50;
      mentorTrust = saved.mentorTrust || {};
      startTime = saved.startedAt || Date.now();
      hideDiagnostic();
      show("game");
      showSceneLoader();
      setTimeout(() => {
        renderScene(currentNode).catch((err) => {
          console.error("[GTG] Failed to load saved scene:", err);
        });
        hideSceneLoader();
      }, SCENE_LOADER_MIN_MS);
    } else {
      startMissionCore();
    }
  }

  function beginNewMission() {
    Audio?.init?.();
    if (!typingProfile.diagnosed) {
      openDiagnosticForLaunch(() => beginNewMission());
      return;
    }
    startMissionCore();
  }

  function loadDifficulty() {
    try {
      const raw = localStorage.getItem("techtrail:difficulty");
      if (raw && DIFFICULTY_CONFIG[raw]) difficulty = raw;
    } catch {}
  }

  function saveDifficulty(tier) {
    if (DIFFICULTY_CONFIG[tier]) {
      difficulty = tier;
      try { localStorage.setItem("techtrail:difficulty", tier); } catch {}
      updateDifficultyButtons();
    }
  }

  function updateDifficultyButtons() {
    document.querySelectorAll(".tt-difficulty__btn").forEach((btn) => {
      btn.classList.toggle("tt-difficulty__btn--active", btn.dataset.tier === difficulty);
    });
  }

  function scaleMinWords(base) {
    const cfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.operative;
    return Math.max(5, Math.round(base * cfg.wordMult));
  }

  function nextSpineMission() {
    const spine = GOLDEN_SPINE || [];
    return spine.find((s) => !goldenRules.has(s.rule)) || null;
  }

  function buildStartChoices() {
    const missions = START_MISSIONS || [];
    return shuffle(missions.map((m) => ({ ...m })));
  }

  function enhanceChoices(node, nodeId, choices) {
    const list = (choices || []).map((c) => ({ ...c }));
    if (!list.length || node.dynamicChoices === "start" || nodeId === "start") return list;

    const spine = nextSpineMission();
    const tooEarlyForFinale = goldenRules.size < 3;

    const mapped = list.map((c) => {
      if ((c.next === "final_trial" || c.next === "mentor_ending") && tooEarlyForFinale && spine) {
        return {
          ...c,
          label: `Keep hunting — ${spine.typeText}`,
          next: spine.next,
          typeText: spine.typeText,
          recommended: true,
        };
      }
      return c;
    });

    const isWin = Boolean(node.badge || node.goldenRule);
    if (isWin && spine && !mapped.some((c) => c.next === spine.next || c.next === "final_trial")) {
      mapped.unshift({
        label: spine.label,
        next: spine.next,
        typeText: spine.typeText,
        recommended: true,
      });
    }

    return mapped;
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let typewriterGen = 0;
  let typewriterResolve = null;
  let lastZoneId = "";
  const CHOICE_COOLDOWN_MS = 1200;
  const SCENE_LOADER_MIN_MS = 420;
  const ROOM_HOLD_MS = 920;
  const CHARACTER_POP_MS = 380;
  const PANEL_FADE_MS = 520;
  const TYPEWRITER_MIN_DWELL_MS = 900;
  const TYPEWRITER_CHAR_MS = 16;

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function showSceneLoader() {
    const el = document.getElementById("sceneLoader");
    if (el) el.classList.remove("dw-hidden");
  }

  function hideSceneLoader() {
    const el = document.getElementById("sceneLoader");
    if (el) el.classList.add("dw-hidden");
  }

  function loadHighContrast() {
    try {
      if (localStorage.getItem("techtrail:highContrast") === "1") {
        document.body.classList.add("tt-high-contrast");
      }
    } catch {}
    updateHighContrastButton();
  }

  function stillCameraPreferred() {
    try {
      const raw = localStorage.getItem("techtrail:stillCamera");
      if (raw === "0") return false;
      return true;
    } catch {
      return true;
    }
  }

  function cameraLocked() {
    return prefersReducedMotion
      || stillCameraPreferred()
      || document.body.classList.contains("tt-high-contrast");
  }

  function applyStillCameraClass() {
    document.body.classList.toggle("tt-still-camera", cameraLocked());
    if (cameraLocked()) resetStageTilt();
  }

  function updateStillCameraButtons() {
    const still = stillCameraPreferred();
    const titleBtn = document.getElementById("stillCameraToggle");
    if (titleBtn) {
      titleBtn.setAttribute("aria-pressed", still ? "true" : "false");
      titleBtn.classList.toggle("tt-settings-btn--on", still);
      titleBtn.textContent = still ? "📷 Still camera on" : "📷 Still camera";
    }
    const hudBtn = document.getElementById("stillCameraHudBtn");
    if (hudBtn) {
      hudBtn.setAttribute("aria-pressed", still ? "true" : "false");
      hudBtn.title = still ? "Still camera on — click to allow a slight tilt" : "Camera tilt on — click to freeze the scene";
      hudBtn.textContent = still ? "📷" : "🎥";
    }
    applyStillCameraClass();
  }

  function toggleStillCamera() {
    const next = stillCameraPreferred() ? "0" : "1";
    try { localStorage.setItem("techtrail:stillCamera", next); } catch {}
    updateStillCameraButtons();
  }

  function updateHighContrastButton() {
    const btn = document.getElementById("highContrastToggle");
    if (!btn) return;
    const on = document.body.classList.contains("tt-high-contrast");
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("tt-settings-btn--on", on);
    btn.textContent = on ? "🔲 High contrast on" : "🔲 High contrast";
  }

  function toggleHighContrast() {
    document.body.classList.toggle("tt-high-contrast");
    const on = document.body.classList.contains("tt-high-contrast");
    try { localStorage.setItem("techtrail:highContrast", on ? "1" : "0"); } catch {}
    updateHighContrastButton();
    applyStillCameraClass();
  }

  function updateMuteButton() {
    const muted = Boolean(Audio?.isMuted?.());
    const gameBtn = document.getElementById("muteToggleBtn");
    if (gameBtn) gameBtn.textContent = muted ? "🔇" : "🔊";
    const titleBtn = document.getElementById("titleMuteBtn");
    if (titleBtn) {
      titleBtn.textContent = muted ? "🔇 Sound off" : "🔊 Sound on";
      titleBtn.setAttribute("aria-pressed", muted ? "true" : "false");
      titleBtn.classList.toggle("tt-settings-btn--on", muted);
    }
  }

  function toggleMute() {
    Audio?.init?.();
    Audio?.toggleMuted?.();
    if (!Audio?.isMuted?.()) Audio?.startSoundtrack?.();
    updateMuteButton();
  }

  function isGameFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  async function requestGameFullscreen() {
    const el = document.documentElement;
    try {
      if (isGameFullscreen()) return true;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      document.body.classList.add("tt-is-fullscreen");
      return true;
    } catch {
      return false;
    }
  }

  async function exitGameFullscreen() {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } catch {}
    document.body.classList.remove("tt-is-fullscreen");
  }

  function updateFullscreenButton() {
    const btn = document.getElementById("fullscreenToggleBtn");
    if (!btn) return;
    btn.textContent = isGameFullscreen() ? "⛶ Exit fullscreen" : "⛶ Fullscreen";
    document.body.classList.toggle("tt-is-fullscreen", isGameFullscreen());
  }

  async function toggleGameFullscreen() {
    if (isGameFullscreen()) {
      await exitGameFullscreen();
    } else {
      const ok = await requestGameFullscreen();
      if (!ok) toast("Fullscreen needs a click — browsers block auto-fullscreen.", "lesson");
    }
    updateFullscreenButton();
  }

  let fullscreenGestureHooked = false;
  function hookSoundtrackOnFirstGesture() {
    const start = () => {
      Audio?.init?.();
      Audio?.startSoundtrack?.();
    };
    document.addEventListener("pointerdown", start, { once: true, capture: true });
    document.addEventListener("keydown", start, { once: true, capture: true });
  }

  function hookFullscreenOnFirstGesture() {
    if (fullscreenGestureHooked) return;
    fullscreenGestureHooked = true;
    const once = () => {
      requestGameFullscreen().then(updateFullscreenButton);
    };
    document.addEventListener("pointerdown", once, { once: true, capture: true });
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderProfileMini() {
    const el = document.getElementById("profileMini");
    if (!el) return;
    const profile = State.loadProfile();
    const runs = profile.totalRuns || 0;
    const badges = (profile.totalBadges || []).length;
    const mentors = (profile.totalMentorsMet || []).length;
    el.innerHTML = `
      <div class="tt-profile-mini">
        <span class="tt-profile-chip">🎖️ ${runs} run${runs === 1 ? "" : "s"}</span>
        <span class="tt-profile-chip">🏅 ${badges} badge${badges === 1 ? "" : "s"}</span>
        <span class="tt-profile-chip">👥 ${mentors} mentor${mentors === 1 ? "" : "s"}</span>
      </div>`;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(runRng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function tokenizeHtml(html) {
    const tokens = [];
    let i = 0;
    while (i < html.length) {
      if (html[i] === "<") {
        const end = html.indexOf(">", i);
        if (end === -1) {
          tokens.push({ type: "text", value: html.slice(i) });
          break;
        }
        tokens.push({ type: "tag", value: html.slice(i, end + 1) });
        i = end + 1;
      } else {
        let j = i + 1;
        while (j < html.length && html[j] !== "<") j++;
        tokens.push({ type: "text", value: html.slice(i, j) });
        i = j;
      }
    }
    return tokens;
  }

  function splitNarrativeIntoParagraphs(html) {
    const trimmed = String(html || "").trim();
    if (!trimmed) return [""];
    const parts = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    return parts.length ? parts : [trimmed];
  }

  function cancelTypewriterWait() {
    if (typewriterResolve) {
      typewriterResolve();
      typewriterResolve = null;
    }
  }

  async function waitForNarrativeContinue(gen) {
    const continueBtn = document.getElementById("narrativeContinueBtn");
    continueBtn?.classList.remove("dw-hidden");
    await new Promise((resolve) => {
      typewriterResolve = resolve;
      const handler = (e) => {
        if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
        cleanup();
        resolve();
      };
      const cleanup = () => {
        continueBtn?.removeEventListener("click", handler);
        document.removeEventListener("keydown", handler);
        if (typewriterResolve === resolve) typewriterResolve = null;
      };
      continueBtn?.addEventListener("click", handler);
      document.addEventListener("keydown", handler);
    });
    if (gen !== typewriterGen) return;
    continueBtn?.classList.add("dw-hidden");
  }

  async function typeParagraph(paraDiv, html, gen) {
    const tokens = tokenizeHtml(html);
    let rendered = "";
    const paraStartTime = performance.now();

    for (const token of tokens) {
      if (gen !== typewriterGen) return;
      if (token.type === "tag") {
        rendered += token.value;
        paraDiv.innerHTML = rendered;
        continue;
      }
      for (const ch of token.value) {
        if (gen !== typewriterGen) return;
        rendered += ch;
        paraDiv.innerHTML = rendered;
        if (ch.trim()) {
          await new Promise((r) => setTimeout(r, TYPEWRITER_CHAR_MS));
        }
      }
    }

    const elapsed = performance.now() - paraStartTime;
    const remaining = Math.max(0, TYPEWRITER_MIN_DWELL_MS - elapsed);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
  }

  async function typewriteNarrative(html, gen, options = {}) {
    const narrativeEl = document.getElementById("sceneNarrative");
    const continueBtn = document.getElementById("narrativeContinueBtn");
    if (!narrativeEl) return;

    cancelTypewriterWait();

    const skipPauses = Boolean(options.skipPauses);

    if (prefersReducedMotion || skipPauses) {
      narrativeEl.innerHTML = html;
      narrativeEl.classList.remove("tt-narrative--typing");
      continueBtn?.classList.add("dw-hidden");
      return;
    }

    const paragraphs = splitNarrativeIntoParagraphs(html);
    narrativeEl.innerHTML = "";
    narrativeEl.classList.add("tt-narrative--typing");
    continueBtn?.classList.add("dw-hidden");

    for (let i = 0; i < paragraphs.length; i++) {
      if (gen !== typewriterGen) return;
      const paraDiv = document.createElement("div");
      paraDiv.className = "tt-narrative__para";
      narrativeEl.appendChild(paraDiv);
      await typeParagraph(paraDiv, paragraphs[i], gen);
      if (gen !== typewriterGen) return;

      if (i < paragraphs.length - 1 && !options.skipContinue) {
        narrativeEl.classList.remove("tt-narrative--typing");
        await waitForNarrativeContinue(gen);
        if (gen !== typewriterGen) return;
        narrativeEl.classList.add("tt-narrative--typing");
      }
    }

    narrativeEl.classList.remove("tt-narrative--typing");
    continueBtn?.classList.add("dw-hidden");
    narrativeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function show(name) {
    const target = views[name];
    if (!target || activeView === name) return;

    if (viewTransitionTimer) {
      clearTimeout(viewTransitionTimer);
      viewTransitionTimer = null;
    }

    if (activeView) {
      const current = views[activeView];
      if (current) current.classList.remove("tt-view--active");
    }

    target.classList.remove("dw-hidden");
    requestAnimationFrame(() => target.classList.add("tt-view--active"));

    if (activeView) {
      const prev = activeView;
      viewTransitionTimer = setTimeout(() => {
        const prevEl = views[prev];
        if (prevEl && activeView !== prev) prevEl.classList.add("dw-hidden");
        viewTransitionTimer = null;
      }, 350);
    }

    activeView = name;
  }

  function toast(message, type = "info") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = `tt-toast tt-toast--${type}`;
    el.textContent = message;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add("tt-toast--visible"));
    setTimeout(() => {
      el.classList.remove("tt-toast--visible");
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  function burstConfetti(count = 24) {
    if (prefersReducedMotion) return;
    const layer = document.getElementById("fxLayer");
    if (!layer) return;
    const colors = ["#ffd700", "#c41e3a", "#fff8e7", "#ff6b6b"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "tt-confetti";
      p.style.left = `${40 + Math.random() * 20}%`;
      p.style.top = `${30 + Math.random() * 20}%`;
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--tt-dx", `${(Math.random() - 0.5) * 280}px`);
      p.style.setProperty("--tt-dy", `${120 + Math.random() * 220}px`);
      p.style.setProperty("--tt-rot", `${Math.random() * 720}deg`);
      layer.appendChild(p);
      setTimeout(() => p.remove(), 1600);
    }
  }

  function popSuccessPhrase(text, anchorEl, options = {}) {
    if (!text) return;
    const layer = document.getElementById("phrasePopLayer");
    if (!layer) return;

    const delay = options.delay || 0;
    const duration = prefersReducedMotion ? 0 : (options.holdMs || 720);

    setTimeout(() => {
      const el = document.createElement("div");
      el.className = `tt-phrase-pop tt-phrase-pop--${options.variant || "gold"}`;
      if (options.size === "sm") el.classList.add("tt-phrase-pop--sm");
      if (options.size === "lg") el.classList.add("tt-phrase-pop--lg");
      el.textContent = text;

      if (anchorEl && !options.center) {
        const rect = anchorEl.getBoundingClientRect();
        el.style.setProperty("--tt-pop-x", `${rect.left + rect.width / 2}px`);
        el.style.setProperty("--tt-pop-y", `${rect.top + rect.height * 0.35}px`);
        el.classList.add("tt-phrase-pop--anchored");
      } else {
        el.classList.add("tt-phrase-pop--center");
      }

      layer.appendChild(el);
      if (prefersReducedMotion) {
        setTimeout(() => el.remove(), 400);
        return;
      }
      requestAnimationFrame(() => el.classList.add("tt-phrase-pop--active"));
      setTimeout(() => el.classList.add("tt-phrase-pop--out"), duration);
      setTimeout(() => el.remove(), duration + 650);
    }, delay);
  }

  function flashTypingPanel(container) {
    if (!container || prefersReducedMotion) return;
    container.classList.remove("tt-typing-panel--success");
    void container.offsetWidth;
    container.classList.add("tt-typing-panel--success");
  }

  function celebrateTypedSuccess(phrase, anchorEl, options = {}) {
    const container = options.container
      || anchorEl?.closest(".tt-typing-panel, .tt-title-typing, .tt-typing-choices, .tt-diagnostic__panel, .tt-typing-challenge");
    flashTypingPanel(container);
    popSuccessPhrase(phrase, anchorEl, { variant: options.variant || "phrase", size: options.phraseSize || "lg", center: options.center });
    if (options.badge) {
      popSuccessPhrase(options.badge, anchorEl, {
        variant: options.badgeVariant || "gold",
        size: "sm",
        delay: prefersReducedMotion ? 0 : 140,
        holdMs: 900,
      });
    }
    if (options.confetti) burstConfetti(options.confetti);
    if (!options.skipAudio) Audio?.playPathUnlock?.();
  }

  function updateTypingMeterUI(cfg) {
    const {
      progressPct = 0,
      liveCpm = 0,
      targetCpm = 0,
      progressFillId,
      speedFillId,
      wpmFillId,
      progressPctId,
      liveCpmId,
      liveWpmId,
      targetCpmId,
      targetWpmId,
      inputEl,
      complete = false,
      speedOk = true,
    } = cfg;

    const liveSpeed = liveCpm || cfg.liveWpm || 0;
    const targetSpeed = targetCpm || cfg.targetWpm || 0;
    const fillId = speedFillId || wpmFillId;
    const liveId = liveCpmId || liveWpmId;
    const targetId = targetCpmId || targetWpmId;

    const pct = Math.min(100, Math.max(0, Math.round(progressPct)));
    const progressFill = progressFillId ? document.getElementById(progressFillId) : null;
    if (progressFill) progressFill.style.width = `${pct}%`;

    const speedFill = fillId ? document.getElementById(fillId) : null;
    if (speedFill && targetSpeed > 0) {
      const speedPct = Math.min(100, Math.round((liveSpeed / targetSpeed) * 100));
      speedFill.style.width = `${speedPct}%`;
      speedFill.classList.toggle("tt-typing-meter__wpm--hot", speedPct >= 100);
      speedFill.classList.toggle("tt-typing-meter__wpm--cold", speedPct < 55);
    }

    if (progressPctId) {
      const el = document.getElementById(progressPctId);
      if (el) el.textContent = `${pct}%`;
    }
    if (liveId) {
      const el = document.getElementById(liveId);
      if (el) el.textContent = String(Math.round(liveSpeed));
    }
    if (targetId) {
      const el = document.getElementById(targetId);
      if (el) el.textContent = targetSpeed > 0 ? String(Math.round(targetSpeed)) : "—";
    }

    if (inputEl) {
      inputEl.classList.toggle("tt-typing-input--near", pct >= 65 && !complete);
      inputEl.classList.toggle("tt-typing-input--ready", complete && speedOk);
      inputEl.classList.toggle("tt-typing-input--slow", complete && !speedOk);
    }
  }

  function renderGoldenTrack(containerId = "goldenRulesTrack", options = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const interactive = Boolean(options.interactive);
    el.innerHTML = Visuals.GOLDEN_RULES.map((rule) => {
      const lit = interactive ? false : goldenRules.has(rule.n);
      if (interactive) {
        return `<button type="button" class="tt-golden-orb tt-golden-orb--interactive" data-rule-n="${rule.n}" aria-label="Golden Rule ${rule.n}: ${escapeHtml(rule.short)}" aria-pressed="false">
          <span class="tt-golden-orb__icon" aria-hidden="true">${rule.icon}</span>
          <span class="tt-golden-orb__label">${escapeHtml(rule.short)}</span>
        </button>`;
      }
      return `<button type="button" class="tt-golden-orb${lit ? " tt-golden-orb--lit" : ""}" data-rule-n="${rule.n}" title="${escapeHtml(rule.short)}" aria-label="Golden Rule ${rule.n}: ${escapeHtml(rule.short)}">
        <span class="tt-golden-orb__icon">${rule.icon}</span>
        <span class="tt-golden-orb__num">${rule.n}</span>
      </button>`;
    }).join("");

    if (!interactive && containerId === "goldenRulesTrack") {
      el.querySelectorAll(".tt-golden-orb").forEach((orb) => {
        const n = Number(orb.dataset.ruleN);
        const open = () => openInventory("rules", Number.isFinite(n) ? `rule:${n}` : "");
        orb.addEventListener("click", open);
      });
    }
  }

  function wireTitleGoldenRules() {
    const container = document.getElementById("titleGoldenPreview");
    const detail = document.getElementById("goldenRuleDetail");
    if (!container) return;
    container.querySelectorAll(".tt-golden-orb--interactive").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.dataset.ruleN);
        const rule = Visuals.GOLDEN_RULES.find((r) => r.n === n);
        if (!rule) return;
        container.querySelectorAll(".tt-golden-orb--interactive").forEach((b) => {
          b.classList.remove("tt-golden-orb--selected");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("tt-golden-orb--selected");
        btn.setAttribute("aria-pressed", "true");
        if (detail) {
          detail.classList.remove("dw-hidden");
          detail.innerHTML = `<div class="tt-golden-rule-detail__badge">Golden Rule ${rule.n}</div>
            <strong class="tt-golden-rule-detail__title">${escapeHtml(rule.short)}</strong>
            <p class="tt-golden-rule-detail__body">${escapeHtml(rule.detail || rule.short)}</p>
            ${rule.learnLine ? `<p class="tt-golden-rule-detail__hint">${escapeHtml(rule.learnLine)}</p>` : ""}
            <p class="tt-golden-rule-detail__hint">Recover this rule during your mission by making smart digital choices.</p>`;
        }
        toast(`Golden Rule ${rule.n}: ${rule.short}`, "lesson");
        Audio?.playPathUnlock?.();
        burstConfetti(8);
      });
    });
  }

  function renderTitleGoldenPreview() {
    renderGoldenTrack("titleGoldenPreview", { interactive: true });
    document.querySelectorAll("#titleGoldenPreview .tt-golden-orb").forEach((orb, i) => {
      setTimeout(() => orb.classList.add("tt-golden-orb--pulse"), 300 + i * 180);
    });
    wireTitleGoldenRules();
  }

  function applySceneZone(nodeId) {
    const zone = Visuals.zoneForNode(nodeId);
    const bg = document.getElementById("sceneBg");
    const tint = document.getElementById("sceneTint");
    const room = document.getElementById("sceneRoom");
    const mood = document.getElementById("sceneMood");
    const zoneChanged = lastZoneId !== zone.bg;
    lastZoneId = zone.bg;

    if (prefersReducedMotion) {
      if (bg) bg.style.backgroundImage = `url('${zone.bg}')`;
      if (tint) tint.style.background = zone.tint;
    } else {
      bg?.classList.toggle("tt-scene-bg--cross", zoneChanged);
      bg?.classList.add("tt-scene-bg--out");
      setTimeout(() => {
        if (bg) bg.style.backgroundImage = `url('${zone.bg}')`;
        if (tint) tint.style.background = zone.tint;
        bg?.classList.remove("tt-scene-bg--out");
        bg?.classList.add("tt-scene-bg--in");
        setTimeout(() => {
          bg?.classList.remove("tt-scene-bg--in");
          bg?.classList.remove("tt-scene-bg--cross");
        }, 700);
      }, zoneChanged ? 280 : 120);
    }

    if (mood) mood.textContent = zone.mood ? zone.mood.toUpperCase() : "";

    if (room && !prefersReducedMotion) {
      room.classList.remove("tt-stage__room--enter", "tt-stage__room--walk");
      void room.offsetWidth;
      room.classList.add("tt-stage__room--enter");
      if (zoneChanged) room.classList.add("tt-stage__room--walk");
    }

    if (Audio) {
      Audio.stopZoneAmbience?.();
      Audio.startZoneAmbience?.(zone.mood);
    }
  }

  function setPanelWaiting(waiting) {
    const panel = document.getElementById("scenePanel");
    const hudLayers = document.querySelectorAll("#typingChoices, #typingChallenge, #sceneNarrative, #sceneChoices, #narrativeContinueBtn");
    if (!panel) return;
    panel.classList.toggle("tt-scene-panel--waiting", waiting);
    panel.classList.toggle("tt-scene-panel--reveal", !waiting);
    hudLayers.forEach((el) => {
      if (!el) return;
      el.classList.toggle("tt-layer--waiting", waiting);
    });
  }

  async function playRoomReveal(node, gen) {
    const arrive = document.getElementById("sceneArrive");
    const door = document.getElementById("sceneDoor");
    const charEl = document.getElementById("sceneCharacter");
    const sting = node.enter || node.location || "";

    setPanelWaiting(true);
    charEl?.classList.add("tt-character--hidden");
    document.getElementById("typingChoices")?.classList.add("dw-hidden");
    document.getElementById("typingChallenge")?.classList.add("dw-hidden");

    if (arrive) {
      arrive.textContent = sting;
      arrive.classList.remove("dw-hidden");
      arrive.classList.add("tt-arrive-sting--show");
    }

    if (door && !prefersReducedMotion) {
      door.classList.remove("dw-hidden");
      door.classList.remove("tt-room-door--open");
      void door.offsetWidth;
      door.classList.add("tt-room-door--slam");
      await sleep(280);
      if (gen !== typewriterGen) return;
      door.classList.remove("tt-room-door--slam");
      door.classList.add("tt-room-door--open");
      setTimeout(() => door.classList.add("dw-hidden"), 820);
    }

    if (prefersReducedMotion) {
      renderCharacter(node.character);
      setPanelWaiting(false);
      charEl?.classList.remove("tt-character--hidden");
      arrive?.classList.add("dw-hidden");
      door?.classList.add("dw-hidden");
      return;
    }

    await sleep(ROOM_HOLD_MS);
    if (gen !== typewriterGen) return;

    arrive?.classList.remove("tt-arrive-sting--show");
    setTimeout(() => arrive?.classList.add("dw-hidden"), 420);

    charEl?.classList.remove("tt-character--hidden");
    renderCharacter(node.character);
    await sleep(CHARACTER_POP_MS);
    if (gen !== typewriterGen) return;

    setPanelWaiting(false);
    await sleep(PANEL_FADE_MS);
  }

  function tiltStage(clientX, clientY, target) {
    if (cameraLocked()) return;
    if (target?.closest?.("button, a, input, textarea, select, label, .tt-typing-choices, .tt-ghost-prompt, .tt-hud, .tt-inventory, .tt-pack-btn, .tt-mute-btn")) {
      resetStageTilt();
      return;
    }
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    viewport.style.setProperty("--tt-tilt-y", `${x * 4}deg`);
    viewport.style.setProperty("--tt-tilt-x", `${-y * 3}deg`);
  }

  function resetStageTilt() {
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    viewport.style.setProperty("--tt-tilt-y", "0deg");
    viewport.style.setProperty("--tt-tilt-x", "0deg");
  }

  function handleDeviceOrientation(e) {
    if (cameraLocked()) return;
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    const beta = Math.max(-45, Math.min(45, e.beta || 0));
    const gamma = Math.max(-45, Math.min(45, e.gamma || 0));
    viewport.style.setProperty("--tt-tilt-x", `${-beta * 0.15}deg`);
    viewport.style.setProperty("--tt-tilt-y", `${gamma * 0.15}deg`);
  }

  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e) {
    if (cameraLocked() || e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e) {
    if (cameraLocked() || e.touches.length !== 1) return;
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    const dx = (e.touches[0].clientX - touchStartX) / window.innerWidth;
    const dy = (e.touches[0].clientY - touchStartY) / window.innerHeight;
    viewport.style.setProperty("--tt-tilt-y", `${dx * 4}deg`);
    viewport.style.setProperty("--tt-tilt-x", `${-dy * 3}deg`);
  }

  function renderCharacter(charKey) {
    const char = CHARACTERS[charKey] || CHARACTERS.guide;
    const portrait = Visuals.PORTRAITS[charKey];
    const charEl = document.getElementById("sceneCharacter");
    if (!charEl) return;

    const avatarInner = portrait
      ? `<img class="tt-character__photo" src="${portrait}" alt="${escapeHtml(char.name)}" width="220" height="280" loading="eager" />`
      : `<span class="tt-character__emoji">${char.emoji}</span>`;

    charEl.innerHTML = `
      <div class="tt-character__card">
        <div class="tt-character__avatar">${avatarInner}</div>
        <div class="tt-character__info">
          <div class="tt-character__name">${escapeHtml(char.name)}</div>
          <div class="tt-character__role">${escapeHtml(char.role)}</div>
          <div class="tt-character__era">${escapeHtml(char.era)}</div>
        </div>
      </div>`;

    if (!prefersReducedMotion) {
      charEl.classList.remove("tt-character--pop");
      void charEl.offsetWidth;
      charEl.classList.add("tt-character--pop");
    }
  }

  function mapIdFor(nodeId) {
    return Visuals.mapRoomForNode?.(nodeId)?.id || "start";
  }

  function renderMissionChrome(nodeId, node) {
    const room = Visuals.mapRoomForNode?.(nodeId);
    const here = document.getElementById("youAreHereLabel");
    if (here) here.textContent = room?.label || node.location || "Unknown";

    const jobEl = document.getElementById("sceneJob");
    const isSolvedHub = Boolean(node.goldenRule || (node.badge && node.choices?.length));
    const job = node.job
      || (isSolvedHub ? "You cleared this room. Pick the next door — press Z for the campus map." : room?.job)
      || "";
    if (jobEl) {
      jobEl.classList.toggle("dw-hidden", !job);
      jobEl.innerHTML = job ? `<strong>Your job:</strong> ${escapeHtml(job)}` : "";
    }

    const char = CHARACTERS[node.character] || CHARACTERS.guide;
    const introEl = document.getElementById("mentorIntro");
    if (introEl) {
      const show = Boolean(char?.name && char?.research);
      introEl.classList.toggle("dw-hidden", !show);
      introEl.innerHTML = show
        ? `<strong>${escapeHtml(char.name)}</strong> <span class="tt-mentor-intro__era">${escapeHtml(char.era || "")}</span><span class="tt-mentor-intro__bio">${escapeHtml(char.research)}</span>`
        : "";
    }

    const conflict = node.conflict || room?.conflict;
    const holo = document.getElementById("sceneHolo");
    if (!holo) return;
    if (!conflict) {
      holo.classList.add("dw-hidden");
      return;
    }
    holo.classList.remove("dw-hidden");
    holo.classList.toggle("tt-holo--resolved", Boolean(conflict.resolved || isSolvedHub));
    const graphic = document.getElementById("holoGraphic");
    const title = document.getElementById("holoTitle");
    const sit = document.getElementById("holoSituation");
    const q = document.getElementById("holoQuestion");
    if (graphic) graphic.innerHTML = Visuals.holoGraphicHtml?.(conflict.graphic) || "";
    if (title) title.textContent = conflict.title || "Situation";
    if (sit) sit.textContent = conflict.situation || "";
    if (q) {
      q.textContent = isSolvedHub ? "Pick your next room." : (conflict.question || "");
      q.classList.toggle("dw-hidden", !q.textContent);
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    return Boolean(el.isContentEditable);
  }

  function mapIsOpen() {
    const el = document.getElementById("campusMap");
    return Boolean(el && !el.classList.contains("dw-hidden"));
  }

  function setMapOpen(open) {
    const el = document.getElementById("campusMap");
    const btn = document.getElementById("mapToggleBtn");
    if (!el) return;
    el.classList.toggle("dw-hidden", !open);
    el.setAttribute("aria-hidden", open ? "false" : "true");
    btn?.setAttribute("aria-pressed", open ? "true" : "false");
    document.body.classList.toggle("tt-map-open", open);
    if (open) {
      renderCampusMap(currentNode);
      el.querySelector(".tt-map__panel")?.focus?.();
    }
  }

  function toggleMap() {
    if (document.getElementById("gameView")?.classList.contains("dw-hidden")) return;
    if (window.TechTrailRhythm?.isActive?.()) return;
    setMapOpen(!mapIsOpen());
  }

  function renderCampusMap(nodeId) {
    const world = document.getElementById("mapWorld");
    const links = document.getElementById("mapLinks");
    const legend = document.getElementById("mapLegend");
    if (!world || !Visuals.MAP_ROOMS) return;
    const here = mapIdFor(nodeId);
    const node = STORY[nodeId];
    const exits = new Set();
    const choices = nodeId === "start" ? (startChoices.length ? startChoices : node?.choices || []) : (node?.choices || []);
    (choices || []).forEach((c) => {
      if (c?.next) exits.add(mapIdFor(c.next));
    });
    if (node?.typingChallenge?.next) exits.add(mapIdFor(node.typingChallenge.next));
    exits.delete(here);

    world.innerHTML = Object.values(Visuals.MAP_ROOMS).map((room) => {
      const current = room.id === here;
      const visited = visitedRooms.has(room.id);
      const exit = exits.has(room.id) && !current;
      const cls = ["tt-map-room", current ? "tt-map-room--here" : "", visited ? "tt-map-room--seen" : "", exit ? "tt-map-room--exit" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-room="${escapeHtml(room.id)}" style="--x:${room.x}%;--y:${room.y}%" ${current ? 'aria-current="true"' : ""}>
        <span class="tt-map-room__cube" aria-hidden="true">${room.icon}</span>
        <span class="tt-map-room__name">${escapeHtml(room.label)}</span>
      </button>`;
    }).join("");

    const pts = Visuals.MAP_ROOMS;
    const edgeHtml = (Visuals.MAP_EDGES || []).map(([a, b]) => {
      const ra = pts[a];
      const rb = pts[b];
      if (!ra || !rb) return "";
      const live = (a === here && exits.has(b)) || (b === here && exits.has(a));
      return `<line x1="${ra.x}" y1="${ra.y}" x2="${rb.x}" y2="${rb.y}" class="tt-map-link${live ? " tt-map-link--live" : ""}" />`;
    }).join("");
    links.innerHTML = edgeHtml;

    const hereRoom = pts[here];
    const exitNames = [...exits].map((id) => pts[id]?.label).filter(Boolean);
    if (legend) {
      legend.textContent = exitNames.length
        ? `You are in ${hereRoom?.label || "Unknown"}. Next doors: ${exitNames.join(" · ")}.`
        : `You are in ${hereRoom?.label || "Unknown"}. Finish the work in this room, then a door will light up.`;
    }

    world.querySelectorAll("[data-room]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.room;
        const label = Visuals.MAP_ROOMS?.[id]?.label || id;
        if (id === here) {
          toast("You are already here.", "lesson");
          return;
        }
        if (exits.has(id)) {
          toast(`Type “${label}” as your path to walk there.`, "lesson");
          setMapOpen(false);
          document.getElementById("choiceTypingInput")?.focus();
          return;
        }
        toast("That door isn't open from this room yet. Solve the hologram conflict first.", "lesson");
      });
    });
  }

  function recordLesson(code) {
    if (!code || lessons.has(code)) return;
    lessons.add(code);
    journal.push(`📚 Lesson logged`);
    pulsePackButton();
    const lore = Visuals.LESSONS?.[code];
    const lessonEl = document.getElementById("sceneLesson");
    if (lessonEl) {
      lessonEl.classList.remove("dw-hidden");
      lessonEl.innerHTML = lore
        ? `<button type="button" class="tt-lesson-flash__btn" data-lesson="${escapeHtml(code)}">${escapeHtml(lore.title)} — added to your pack</button>`
        : `<button type="button" class="tt-lesson-flash__btn" data-lesson="${escapeHtml(code)}">New insight added to your pack.</button>`;
      lessonEl.querySelector("button")?.addEventListener("click", () => openInventory("knowledge", `lesson:${code}`));
      if (!prefersReducedMotion) {
        lessonEl.classList.remove("tt-lesson-flash--show");
        void lessonEl.offsetWidth;
        lessonEl.classList.add("tt-lesson-flash--show");
      }
    }
  }

  function flashGoldenRule(n) {
    const rule = (Visuals.GOLDEN_RULES || []).find((r) => r.n === n);
    if (!rule) return;
    const lessonEl = document.getElementById("sceneLesson");
    if (lessonEl) {
      lessonEl.classList.remove("dw-hidden");
      const learn = rule.learnLine || rule.detail || "";
      lessonEl.innerHTML = `<button type="button" class="tt-lesson-flash__btn" data-rule="${n}">
        <strong class="tt-lesson-flash__rule">Golden Rule ${n}: ${escapeHtml(rule.short)}</strong>
        <span class="tt-lesson-flash__learn">${escapeHtml(learn)}</span>
      </button>`;
      lessonEl.querySelector("button")?.addEventListener("click", () => openInventory("rules", `rule:${n}`));
      if (!prefersReducedMotion) {
        lessonEl.classList.remove("tt-lesson-flash--show");
        void lessonEl.offsetWidth;
        lessonEl.classList.add("tt-lesson-flash--show");
      }
    }
  }

  function renderOathRuleRecap(visible) {
    const el = document.getElementById("oathRuleRecap");
    if (!el) return;
    if (!visible) {
      el.classList.add("dw-hidden");
      el.innerHTML = "";
      return;
    }
    const rules = Visuals.GOLDEN_RULES || [];
    el.classList.remove("dw-hidden");
    el.innerHTML = `<p class="tt-oath-recap__lead">Rules you recovered this run — name the ones you will actually use:</p>
      <ul class="tt-oath-recap__list">${rules.map((rule) => {
        const got = goldenRules.has(rule.n);
        return `<li class="tt-oath-recap__item${got ? " tt-oath-recap__item--got" : " tt-oath-recap__item--miss"}">
          <span class="tt-oath-recap__mark">${got ? "recovered" : "missed"}</span>
          <strong>${escapeHtml(rule.short)}</strong>
          <span class="tt-oath-recap__learn">${escapeHtml(rule.learnLine || "")}</span>
        </li>`;
      }).join("")}</ul>`;
  }

  function resolveChoices(node, nodeId) {
    let choices;
    if (node.dynamicChoices === "start" || (nodeId === "start" && !node.choices?.length)) {
      choices = startChoices.length ? startChoices : buildStartChoices();
    } else {
      choices = node.choices || [];
    }
    return enhanceChoices(node, nodeId, choices);
  }

  function maybeRollBonus(node) {
    const roll = node.rngBadge;
    if (!roll || runRng() >= roll.chance || badges.has(roll.badge)) return;
    badges.add(roll.badge);
    journal.push(`🏅 Badge: ${roll.badge}`);
    toast(roll.message || `Bonus badge: ${roll.badge}`, "badge");
    burstConfetti(14);
    pulsePackButton();
  }

  async function renderScene(nodeId) {
    const gen = ++typewriterGen;
    const node = STORY[nodeId];
    if (!node) {
      console.error("[GTG] Missing story node:", nodeId);
      toast("Story error — try Play mission again.", "lesson");
      return;
    }
    currentNode = nodeId;
    visitedRooms.add(mapIdFor(nodeId));

    if (!node.ending) {
      hideDiagnostic();
      show("game");
    }

    const choiceTypingInput = document.getElementById("choiceTypingInput");
    if (choiceTypingInput) choiceTypingInput.disabled = false;
    document.getElementById("typingChoices")?.classList.remove("tt-typing-choices--unlock");

    if (nodeId === "start") {
      startChoices = buildStartChoices();
      journal.push(`🎲 ${startChoices.length} missions on the board this run`);
    }

    applySceneZone(nodeId);
    renderMissionChrome(nodeId, node);
    if (mapIsOpen()) renderCampusMap(nodeId);

    const locEl = document.getElementById("sceneLocation");
    if (locEl) locEl.textContent = node.location || "Unknown";
    const narrativeEl = document.getElementById("sceneNarrative");
    const choicesEl = document.getElementById("sceneChoices");
    const typingEl = document.getElementById("typingChallenge");

    if (choicesEl) choicesEl.innerHTML = "";
    typingEl?.classList.add("dw-hidden");
    typingPending = null;
    if (narrativeEl) narrativeEl.innerHTML = "";

    if (!node.ending) {
      await playRoomReveal(node, gen);
      if (gen !== typewriterGen) return;
    } else {
      renderCharacter(node.character);
      setPanelWaiting(false);
    }

    if (narrativeEl) {
      narrativeEl.classList.remove("tt-narrative--reveal");
      void narrativeEl.offsetWidth;
      narrativeEl.classList.add("tt-narrative--reveal");
      await typewriteNarrative(node.narrative || "", gen, {
        skipPauses: prefersReducedMotion,
        skipContinue: true,
      });
    }
    if (gen !== typewriterGen) return;

    metCharacters.add(node.character);

    const prevBadgeCount = badges.size;
    const prevGoldenCount = goldenRules.size;

    if (node.lesson) recordLesson(node.lesson);
    maybeRollBonus(node);

    if (node.badge) {
      badges.add(node.badge);
      journal.push(`🏅 Badge: ${node.badge}`);
    }
    if (node.goldenRule) {
      goldenRules.add(node.goldenRule);
      journal.push(`⭐ Golden Rule #${node.goldenRule} recovered`);
    }

    if (badges.size > prevBadgeCount && node.badge) {
      toast(`Badge unlocked: ${node.badge} — tap your pack`, "badge");
      burstConfetti(18);
      Audio?.playBadgeChime?.();
      pulsePackButton();
    }
    if (node.goldenRule && goldenRules.size > prevGoldenCount) {
      const rule = (Visuals.GOLDEN_RULES || []).find((r) => r.n === node.goldenRule);
      const name = rule?.short ? `: ${rule.short}` : "";
      toast(`Golden Rule #${node.goldenRule}${name} recovered — tap your pack`, "golden");
      burstConfetti(28);
      Audio?.playGoldenFanfare?.();
      pulsePackButton();
      flashGoldenRule(node.goldenRule);
    }

    updateStats();
    renderGoldenTrack();

    State.saveRun({
      currentNode,
      badges,
      lessons,
      goldenRules,
      journal,
      metCharacters,
      visitedRooms,
      integrity,
      reputation,
      mentorTrust,
      startedAt: startTime,
    });

    if (node.typingChallenge) {
      typingPending = node.typingChallenge;
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      typingEl.classList.remove("dw-hidden");
      typingEl.classList.add("tt-layer--enter");
      if (choicesEl) choicesEl.innerHTML = "";
      document.getElementById("typingPrompt").textContent = node.typingChallenge.prompt;
      renderOathRuleRecap(nodeId === "final_trial");
      const savedDraft = State.loadDraft();
      const typingInput = document.getElementById("typingInput");
      typingInput.value = savedDraft || "";
      challengeStartTime = Date.now();
      challengeKeystrokeTracker?.detach?.();
      challengeKeystrokeTracker = Core.createKeystrokeTracker?.(typingInput) || null;
      challengeKeystrokeTracker?.attach?.();
      challengeKeystrokeTracker?.reset?.();
      const words = Core.countWords(typingInput.value);
      const min = scaleMinWords(typingPending.minWords || 20);
      challengeStartTime = 0;
      updateChallengeUnlockUI(typingInput.value, min);
      setTimeout(() => typingInput?.focus(), prefersReducedMotion ? 0 : 420);
      typingEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      renderOathRuleRecap(false);
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      const choices = resolveChoices(node, nodeId);
      if (choices.length) {
        renderClickChoices(node, choices);
        document.getElementById("sceneChoices")?.classList.add("tt-layer--enter");
      }
    }

    if (node.ending) {
      show("ending");
      renderEnding(node);
    }

    renderJournal();
    renderResearchPanel();
  }

  function updateTypingProgress(words, minWords) {
    updateChallengeUnlockUI(document.getElementById("typingInput")?.value || "", minWords);
  }

  function updateChallengeUnlockUI(text, minWords) {
    const cfg = difficultyCfg();
    const words = Core.countWords(text);
    const compactLen = String(text || "").replace(/\s/g, "").length;
    if (!challengeStartTime && compactLen > 0) challengeStartTime = performance.now();
    const duration = challengeStartTime ? performance.now() - challengeStartTime : 0;
    const liveCpm = duration > 0 ? Typing.computeCpm(compactLen, duration) : 0;
    const accuracy = Typing.estimateTextAccuracy?.(text) ?? 1;
    const evalFn = Typing.evaluateChallengeUnlock;
    const result = evalFn
      ? evalFn({
          words,
          minWords,
          liveCpm,
          targetCpm: typingProfile.targetCpm,
          accuracy,
          speedGate: cfg.speedGate,
          accuracyMin: cfg.accuracyMin,
          minWordsFloor: cfg.minWordsFloor,
        })
      : { unlocked: words >= cfg.minWordsFloor, score: words >= minWords ? 1 : 0.4, speedOk: true, accuracyOk: true };
    const pct = Math.min(100, Math.round((result.unlocked ? 100 : result.score * 100)));
    const fill = document.getElementById("typingProgressFill");
    const countEl = document.getElementById("typingWordCount");
    const challengeFill = document.getElementById("challengeWordFill");
    if (fill) fill.style.width = `${pct}%`;
    if (challengeFill) challengeFill.style.width = `${pct}%`;
    updateTypingMeterUI({
      progressPct: pct,
      liveCpm,
      targetCpm: typingProfile.targetCpm,
      progressFillId: "challengeWordFill",
      progressPctId: "challengeWordPct",
      liveCpmId: "challengeLiveWpm",
      inputEl: document.getElementById("typingInput"),
      complete: result.unlocked,
      speedOk: result.speedOk,
    });
    if (countEl) {
      const accPct = Math.round(accuracy * 100);
      countEl.textContent = result.unlocked
        ? `${words} words · ${Math.round(liveCpm)} keys/min · ready`
        : `${words} words · ${Math.round(liveCpm)} keys/min · ${accPct}% accuracy`;
      countEl.classList.toggle("tt-typing-count--ready", result.unlocked);
    }
    const hint = document.getElementById("challengeUnlockHint");
    if (hint) {
      if (result.unlocked) hint.textContent = "Unlocked — speed and accuracy are good. Submit whenever you're ready.";
      else if (words < cfg.minWordsFloor) hint.textContent = `Type a few real words to start (${cfg.minWordsFloor}+). Speed does most of the unlocking.`;
      else if (!result.accuracyOk) hint.textContent = "Accuracy is low for this difficulty — write in real sentences.";
      else if (!result.speedOk) hint.textContent = `Keep typing — hit about ${Math.round(typingProfile.targetCpm * cfg.speedGate)} keys/min to unlock. Word count is a bonus, not a lock.`;
      else hint.textContent = "Almost — keep going.";
    }
    const submitBtn = document.getElementById("typingSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = !result.unlocked;
      submitBtn.classList.toggle("tt-cta-btn--ready", result.unlocked);
    }
    const liveEl = document.getElementById("statLiveWpm");
    if (liveEl) liveEl.textContent = String(Math.round(liveCpm));
    document.getElementById("liveWpmStat")?.classList.remove("dw-hidden");
    return result;
  }

  function shouldSkipRhythm(fromId, toId) {
    if (!fromId) return true;
    const from = STORY?.[fromId];
    const to = STORY?.[toId];
    if (!from || from.ending) return true;
    if (to?.ending) return true;
    return false;
  }

  function runRhythmThen(fromId, then) {
    setMapOpen(false);
    const Rhythm = window.TechTrailRhythm;
    if (!Rhythm?.start) {
      then?.();
      return;
    }
    Rhythm.start({
      nodeId: fromId,
      difficulty,
      reducedMotion: prefersReducedMotion || document.body.classList.contains("tt-high-contrast"),
      onComplete(result) {
        if (result && !result.skipped && result.accuracy != null) {
          journal.push(`⌨️ Phrase ${Math.round(result.accuracy)}% · ${result.title || "citizenship"}`);
        }
        then?.();
      },
    });
  }

  function navigate(nodeId, opts = {}) {
    if (!opts.skipRhythm && !shouldSkipRhythm(currentNode, nodeId)) {
      runRhythmThen(currentNode, () => renderScene(nodeId));
      return;
    }
    renderScene(nodeId);
  }

  function updateStats() {
    document.getElementById("statBadges").textContent = badges.size;
    document.getElementById("statLessons").textContent = lessons.size;
    document.getElementById("statScenes").textContent = journal.length;
    const integrityEl = document.getElementById("statIntegrity");
    const repEl = document.getElementById("statReputation");
    if (integrityEl) {
      integrityEl.textContent = integrity;
      integrityEl.style.color = integrity >= 80 ? "#34d399" : integrity >= 50 ? "#fbbf24" : "#ef4444";
    }
    if (repEl) repEl.textContent = reputation;
    updatePackCount();
  }

  function applyChoiceEffects(choice) {
    let msgs = [];
    if (typeof choice.integrity === "number") {
      integrity = Math.max(0, Math.min(100, integrity + choice.integrity));
      if (choice.integrity < 0) msgs.push(`⚠️ Integrity −${Math.abs(choice.integrity)}`);
      else if (choice.integrity > 0) msgs.push(`✅ Integrity +${choice.integrity}`);
    }
    if (typeof choice.reputation === "number") {
      reputation = Math.max(0, Math.min(100, reputation + choice.reputation));
      if (choice.reputation < 0) msgs.push(`⚠️ Reputation −${Math.abs(choice.reputation)}`);
      else if (choice.reputation > 0) msgs.push(`✅ Reputation +${choice.reputation}`);
    }
    if (choice.mentorDelta) {
      const { key, delta } = choice.mentorDelta;
      mentorTrust[key] = (mentorTrust[key] || 0) + delta;
      if (delta < 0) msgs.push(`⚠️ ${CHARACTERS[key]?.name || key} trust decreased`);
      else msgs.push(`✅ ${CHARACTERS[key]?.name || key} trust increased`);
    }
    if (msgs.length) {
      toast(msgs.join(" · "), choice.integrity < 0 || choice.reputation < 0 ? "lesson" : "info");
    }
    if (integrity <= 0) {
      toast("Mission integrity critical — one more misstep and you're on probation.", "lesson");
    }
  }

  function renderJournal() {
    const el = document.getElementById("journalEntries");
    if (!el) return;
    el.innerHTML = journal.slice(-12).reverse().map((e) => `<div class="tt-journal__entry">${escapeHtml(e)}</div>`).join("")
      || '<div class="tt-journal__entry">Your adventure begins…</div>';
  }

  function renderResearchPanel() {
    const el = document.getElementById("researchPanel");
    if (!el) return;
    const chars = [...metCharacters].filter((k) => CHARACTERS[k]?.research);
    if (!chars.length) {
      el.innerHTML = '<p class="dw-muted dw-tiny">Meet heroes during your mission to unlock notes.</p>';
      return;
    }
    el.innerHTML = chars.slice(-6).map((k) => {
      const c = CHARACTERS[k];
      const portrait = Visuals.PORTRAITS[k];
      const thumb = portrait
        ? `<img class="tt-hero-note__thumb" src="${portrait}" alt="" width="72" height="72" loading="lazy" />`
        : `<span class="tt-hero-note__emoji">${c.emoji}</span>`;
      return `<div class="tt-hero-note">${thumb}<div><strong>${escapeHtml(c.name)}</strong><p>${escapeHtml(c.research)}</p></div></div>`;
    }).join("");
    el.querySelectorAll(".tt-hero-note").forEach((note, i) => {
      note.setAttribute("role", "button");
      note.tabIndex = 0;
      const key = chars.slice(-6)[i];
      note.addEventListener("click", () => openInventory("knowledge", `hero:${key}`));
      note.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openInventory("knowledge", `hero:${key}`);
        }
      });
    });
  }

  let inventoryTab = "trophies";

  function packCount() {
    return badges.size + goldenRules.size + lessons.size + metCharacters.size;
  }

  function pulsePackButton() {
    const btn = document.getElementById("inventoryBtn");
    if (!btn) return;
    btn.classList.remove("tt-pack-btn--pulse");
    void btn.offsetWidth;
    btn.classList.add("tt-pack-btn--pulse");
  }

  function updatePackCount() {
    const el = document.getElementById("packCount");
    if (el) el.textContent = String(packCount());
  }

  function openInventory(tab = "trophies", focusId = "") {
    inventoryTab = tab;
    const overlay = document.getElementById("inventoryOverlay");
    if (!overlay) return;
    overlay.classList.remove("dw-hidden");
    overlay.setAttribute("aria-hidden", "false");
    renderInventory(focusId);
    document.getElementById("inventoryCloseBtn")?.focus();
    Audio?.playPathUnlock?.();
  }

  function closeInventory() {
    const overlay = document.getElementById("inventoryOverlay");
    if (!overlay) return;
    overlay.classList.add("dw-hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  function renderInventory(focusId = "") {
    const grid = document.getElementById("inventoryGrid");
    const detail = document.getElementById("inventoryDetail");
    if (!grid) return;
    document.querySelectorAll("[data-inv-tab]").forEach((btn) => {
      btn.classList.toggle("tt-inventory__tab--active", btn.dataset.invTab === inventoryTab);
    });

    if (inventoryTab === "trophies") {
      const list = [...badges];
      if (!list.length) {
        grid.innerHTML = `<p class="dw-muted">No trophies yet. Make a smart call and they'll land in your pack.</p>`;
      } else {
        grid.innerHTML = list.map((name) => {
          const lore = Visuals.BADGES?.[name] || { icon: "🏅", blurb: "Earned on this run." };
          return `<button type="button" class="tt-inv-slot" data-inv-id="badge:${escapeHtml(name)}">
            <span class="tt-inv-slot__icon">${lore.icon}</span>
            <span class="tt-inv-slot__name">${escapeHtml(name)}</span>
          </button>`;
        }).join("");
      }
    } else if (inventoryTab === "rules") {
      grid.innerHTML = Visuals.GOLDEN_RULES.map((rule) => {
        const lit = goldenRules.has(rule.n);
        return `<button type="button" class="tt-inv-slot${lit ? " tt-inv-slot--lit" : " tt-inv-slot--locked"}" data-inv-id="rule:${rule.n}">
          <span class="tt-inv-slot__icon">${rule.icon}</span>
          <span class="tt-inv-slot__name">${lit ? escapeHtml(rule.short) : "???"}</span>
          <span class="tt-inv-slot__tag">${lit ? "Recovered" : "Still out there"}</span>
        </button>`;
      }).join("");
    } else {
      const heroes = [...metCharacters].filter((k) => CHARACTERS[k]);
      const lessonList = [...lessons];
      if (!heroes.length && !lessonList.length) {
        grid.innerHTML = `<p class="dw-muted">Meet mentors and clear scenes to fill this log.</p>`;
      } else {
        const heroHtml = heroes.map((k) => {
          const c = CHARACTERS[k];
          const portrait = Visuals.PORTRAITS[k];
          const thumb = portrait
            ? `<img src="${portrait}" alt="" width="48" height="48" />`
            : `<span>${c.emoji}</span>`;
          return `<button type="button" class="tt-inv-slot tt-inv-slot--hero" data-inv-id="hero:${k}">
            <span class="tt-inv-slot__icon tt-inv-slot__icon--photo">${thumb}</span>
            <span class="tt-inv-slot__name">${escapeHtml(c.name)}</span>
          </button>`;
        }).join("");
        const lessonHtml = lessonList.map((code) => {
          const lore = Visuals.LESSONS?.[code] || { title: "Insight", blurb: "" };
          return `<button type="button" class="tt-inv-slot" data-inv-id="lesson:${escapeHtml(code)}">
            <span class="tt-inv-slot__icon">📚</span>
            <span class="tt-inv-slot__name">${escapeHtml(lore.title)}</span>
          </button>`;
        }).join("");
        grid.innerHTML = heroHtml + lessonHtml;
      }
    }

    grid.querySelectorAll("[data-inv-id]").forEach((btn) => {
      btn.addEventListener("click", () => showInventoryDetail(btn.dataset.invId));
    });

    if (focusId) showInventoryDetail(focusId);
    else if (detail) {
      detail.innerHTML = `<p class="dw-muted dw-tiny">Tap a slot to inspect it.</p>`;
    }
  }

  function showInventoryDetail(id) {
    const detail = document.getElementById("inventoryDetail");
    if (!detail || !id) return;
    const [kind, ...rest] = String(id).split(":");
    const key = rest.join(":");
    document.querySelectorAll(".tt-inv-slot").forEach((s) => {
      s.classList.toggle("tt-inv-slot--selected", s.dataset.invId === id);
    });

    if (kind === "badge") {
      const lore = Visuals.BADGES?.[key] || { icon: "🏅", blurb: "Earned on this run." };
      detail.innerHTML = `<div class="tt-inv-detail__icon">${lore.icon}</div>
        <h3>${escapeHtml(key)}</h3>
        <p>${escapeHtml(lore.blurb)}</p>`;
    } else if (kind === "rule") {
      const n = Number(key);
      const rule = Visuals.GOLDEN_RULES.find((r) => r.n === n);
      const lit = goldenRules.has(n);
      if (!rule) return;
      detail.innerHTML = `<div class="tt-inv-detail__icon">${rule.icon}</div>
        <h3>Golden Rule ${n}${lit ? "" : " — locked"}</h3>
        <p><strong>${escapeHtml(rule.short)}</strong></p>
        <p>${lit ? escapeHtml(rule.detail) : "Still scattered. Recover it by making the right call in the field."}</p>`;
    } else if (kind === "hero") {
      const c = CHARACTERS[key];
      if (!c) return;
      const portrait = Visuals.PORTRAITS[key];
      const img = portrait ? `<img class="tt-inv-detail__photo" src="${portrait}" alt="${escapeHtml(c.name)}" />` : `<div class="tt-inv-detail__icon">${c.emoji}</div>`;
      detail.innerHTML = `${img}
        <h3>${escapeHtml(c.name)}</h3>
        <p class="dw-tiny">${escapeHtml(c.role)} · ${escapeHtml(c.era)}</p>
        <p>${escapeHtml(c.research)}</p>`;
    } else if (kind === "lesson") {
      const lore = Visuals.LESSONS?.[key] || { title: "Insight", blurb: "Logged during your mission." };
      detail.innerHTML = `<div class="tt-inv-detail__icon">📚</div>
        <h3>${escapeHtml(lore.title)}</h3>
        <p>${escapeHtml(lore.blurb)}</p>
        <p class="dw-tiny">Standard ${escapeHtml(key)}</p>`;
    }
  }

  function computeEndingType() {
    if (integrity >= 80 && goldenRules.size >= 5) return "champion";
    if (integrity >= 50 && goldenRules.size >= 3) return "operative";
    return "probation";
  }

  function renderEnding(node) {
    const endingType = computeEndingType();
    let title, narrativeOverride;
    if (endingType === "champion") {
      title = "Gauntlet Champion!";
    } else if (endingType === "operative") {
      title = "Mission Operative";
    } else {
      title = "Operative on Probation";
      narrativeOverride = `The five Golden Rules line up on the main screen, but the audit log tells a harder story.

<strong>Integrity: ${integrity}/100 · Reputation: ${reputation}/100 · ${goldenRules.size}/5 Golden Rules</strong>

You recovered some rules — but the cost was visible. Compromises leave traces. Mr. Phil grins anyway. "Next run, the stakes are real."

Play again to rebuild your record clean.`;
    }
    document.getElementById("endingTitle").textContent = title;
    document.getElementById("endingNarrative").innerHTML = narrativeOverride || node.narrative || "";
    document.getElementById("endingBadges").innerHTML = [...badges].map((b) => `<span class="tt-badge">${escapeHtml(b)}</span>`).join("");
    document.getElementById("endingLessons").textContent =
      `${lessons.size} lessons · ${badges.size} badges · ${goldenRules.size}/5 Golden Rules · Integrity ${integrity} · Reputation ${reputation}`;

    const endingBg = document.getElementById("endingBg");
    if (endingBg) {
      const zone = Visuals.zoneForNode(endingType === "champion" ? "final_trial" : "start");
      endingBg.style.backgroundImage = `url('${zone.bg}')`;
    }

    renderGoldenTrack("endingGoldenTrack");
    renderResearchPanel();
    burstConfetti(endingType === "probation" ? 16 : endingType === "operative" ? 32 : 48);

    const analystHint = document.getElementById("endingAnalystHint");
    if (analystHint) {
      analystHint.classList.toggle("dw-hidden", difficulty === "analyst");
    }

    const runSnapshot = {
      currentNode,
      badges,
      lessons,
      goldenRules,
      journal,
      metCharacters,
      integrity,
      reputation,
      mentorTrust,
      startedAt: startTime,
    };
    const profile = State.loadProfile();
    const updated = State.mergeRunToProfile(runSnapshot, profile);
    State.saveProfile(updated);
    State.clearRun();
    renderProfileMini();
  }

  function resetRun() {
    State.clearRun();
    runRng = Math.random;
    startChoices = buildStartChoices();
    badges.clear();
    lessons.clear();
    goldenRules.clear();
    metCharacters.clear();
    visitedRooms = new Set(["start"]);
    integrity = 100;
    reputation = 50;
    mentorTrust = {};
    journal = ["🌐 Mission accepted"];
    startTime = Date.now();
  }

  function init() {
    const titleTypingInput = document.getElementById("titleTypingInput");
    Core.setupPasteControl(titleTypingInput, false);
    titleTypingInput?.addEventListener("input", handleTitleTypingInput);
    titleTypingInput?.addEventListener("keydown", handleTitleTypingKeydown);

    loadDifficulty();
    loadHighContrast();
    updateStillCameraButtons();
    const loadedProfile = State.loadTypingProfile();
    typingProfile = loadedProfile;
    const prevTest = loadedProfile.testCpm;
    const prevTarget = loadedProfile.targetCpm;
    sanitizeTypingProfile();
    if (typingProfile.testCpm !== prevTest || typingProfile.targetCpm !== prevTarget) {
      State.saveTypingProfile(typingProfile);
    }
    renderTitleGoldenPreview();
    renderProfileMini();
    updateDifficultyButtons();
    updateMuteButton();
    updateTypingProfileUI();
    updateTypoToleranceUI();
    updateTitleLaunchUI();
    renderTitleTypingMenu();

    document.querySelectorAll(".tt-difficulty__btn").forEach((btn) => {
      btn.addEventListener("click", () => saveDifficulty(btn.dataset.tier));
    });

    document.getElementById("highContrastToggle")?.addEventListener("click", toggleHighContrast);
    document.getElementById("stillCameraToggle")?.addEventListener("click", toggleStillCamera);
    document.getElementById("stillCameraHudBtn")?.addEventListener("click", toggleStillCamera);
    document.getElementById("titleMuteBtn")?.addEventListener("click", toggleMute);
    document.getElementById("fullscreenToggleBtn")?.addEventListener("click", () => toggleGameFullscreen());
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
    updateFullscreenButton();
    hookFullscreenOnFirstGesture();
    hookSoundtrackOnFirstGesture();

    const playLaunch = new URLSearchParams(window.location.search).get("play") === "1";
    if (playLaunch) {
      hookFullscreenOnFirstGesture();
      if (typingProfile.diagnosed) {
        setTimeout(() => {
          toast("Tip: tap ⛶ Fullscreen for the best arcade view.", "info");
          document.getElementById("titleTypingInput")?.focus();
        }, 600);
      }
    }

    document.getElementById("inventoryBtn")?.addEventListener("click", () => openInventory("trophies"));
    document.getElementById("inventoryCloseBtn")?.addEventListener("click", closeInventory);
    document.getElementById("inventoryOverlay")?.addEventListener("click", (e) => {
      if (e.target?.id === "inventoryOverlay") closeInventory();
    });
    document.querySelectorAll("[data-inv-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        inventoryTab = btn.dataset.invTab;
        renderInventory();
      });
    });
    document.getElementById("statBadges")?.closest(".tt-stat")?.addEventListener("click", () => openInventory("trophies"));
    document.getElementById("statLessons")?.closest(".tt-stat")?.addEventListener("click", () => openInventory("knowledge"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (mapIsOpen()) { setMapOpen(false); return; }
        closeInventory();
        const sidebar = document.querySelector(".tt-sidebar");
        if (sidebar?.classList.contains("tt-sidebar--open")) {
          sidebar.classList.remove("tt-sidebar--open", "tt-sidebar--overlay");
        }
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTypingTarget(e.target)) return;
        if (window.TechTrailRhythm?.isActive?.()) return;
        e.preventDefault();
        toggleMap();
      }
    });
    document.getElementById("mapToggleBtn")?.addEventListener("click", () => toggleMap());
    document.getElementById("mapCloseBtn")?.addEventListener("click", () => setMapOpen(false));
    document.getElementById("youAreHere")?.addEventListener("click", () => toggleMap());

    document.getElementById("muteToggleBtn")?.addEventListener("click", toggleMute);

    document.getElementById("sidebarToggleBtn")?.addEventListener("click", () => {
      const sidebar = document.querySelector(".tt-sidebar");
      if (!sidebar) return;
      sidebar.classList.toggle("tt-sidebar--overlay");
      sidebar.classList.toggle("tt-sidebar--open");
    });

    document.addEventListener("click", (e) => {
      const sidebar = document.querySelector(".tt-sidebar");
      const toggle = document.getElementById("sidebarToggleBtn");
      if (!sidebar || !sidebar.classList.contains("tt-sidebar--open")) return;
      if (!sidebar.contains(e.target) && e.target !== toggle && !toggle?.contains(e.target)) {
        sidebar.classList.remove("tt-sidebar--open", "tt-sidebar--overlay");
      }
    });

    const startBtn = document.getElementById("startGameBtn");
    const continueBtn = document.getElementById("continueRunBtn");
    const newRunBtn = document.getElementById("newRunBtn");

    startBtn?.addEventListener("click", () => beginStartMission());

    continueBtn?.addEventListener("click", () => beginContinueMission());

    newRunBtn?.addEventListener("click", () => beginNewMission());

    document.getElementById("playAgainBtn")?.addEventListener("click", () => {
      Audio?.stopZoneAmbience?.();
      resetRun();
      show("title");
      renderTitleGoldenPreview();
      renderProfileMini();
      renderTitleTypingMenu();
      updateTitleLaunchUI();
    });

    document.getElementById("tryAnalystBtn")?.addEventListener("click", () => {
      saveDifficulty("analyst");
      toast("Analyst locked in — next run types longer paths with tighter accuracy.", "badge");
      document.getElementById("endingAnalystHint")?.classList.add("dw-hidden");
    });

    document.getElementById("retakeDiagnosticBtn")?.addEventListener("click", () => {
      typingProfile.diagnosed = false;
      saveTypingProfile();
      updateTitleLaunchUI();
      openDiagnosticForLaunch(() => updateTitleLaunchUI());
    });

    document.getElementById("diagnosticAcceptBtn")?.addEventListener("click", acceptDiagnostic);

    const diagnosticInput = document.getElementById("diagnosticInput");
    Core.setupPasteControl(diagnosticInput, false);
    diagnosticInput?.addEventListener("input", handleDiagnosticInput);
    diagnosticInput?.addEventListener("keydown", handleDiagnosticKeydown);

    const choiceTypingInput = document.getElementById("choiceTypingInput");
    Core.setupPasteControl(choiceTypingInput, false);
    choiceTypingInput?.addEventListener("input", handleChoiceTypingInput);

    const typoRange = document.getElementById("typoToleranceRange");
    typoRange?.addEventListener("input", () => {
      typingProfile.maxTypos = Number(typoRange.value);
      saveTypingProfile();
      updateTypoToleranceUI();
    });

    const viewport = document.getElementById("sceneViewport");
    viewport?.addEventListener("mousemove", (e) => tiltStage(e.clientX, e.clientY, e.target));
    viewport?.addEventListener("mouseleave", resetStageTilt);
    viewport?.addEventListener("touchstart", handleTouchStart, { passive: true });
    viewport?.addEventListener("touchmove", handleTouchMove, { passive: true });
    viewport?.addEventListener("touchend", resetStageTilt, { passive: true });
    window.addEventListener("deviceorientation", handleDeviceOrientation);

    const typingInput = document.getElementById("typingInput");
    Core.setupPasteControl(typingInput, false);

    typingInput?.addEventListener("input", () => {
      Audio?.playTypeTick?.();
      const min = scaleMinWords(typingPending?.minWords || 20);
      updateChallengeUnlockUI(typingInput.value, min);
      State.saveDraft(typingInput.value);
    });

    document.getElementById("typingSubmitBtn")?.addEventListener("click", () => {
      if (!typingPending) return;
      const typingInput = document.getElementById("typingInput");
      const min = scaleMinWords(typingPending.minWords || 20);
      const result = updateChallengeUnlockUI(typingInput?.value || "", min);
      if (!result?.unlocked) return;
      const words = Core.countWords(typingInput?.value || "");
      journal.push(`⌨️ Response logged (${words} words)`);
      celebrateTypedSuccess(`${words} WORDS LOGGED`, typingInput, {
        badge: "TRANSMITTED!",
        confetti: 20,
        container: document.getElementById("typingChallenge"),
      });
      toast("Transmitting response...", "badge");
      State.clearDraft();

      const nextNode = STORY[typingPending.next];
      const isEnding = nextNode && nextNode.ending;
      const delay = prefersReducedMotion ? SCENE_LOADER_MIN_MS : SCENE_LOADER_MIN_MS + 400;
      showSceneLoader();
      setTimeout(() => {
        hideSceneLoader();
        if (isEnding) {
          runRhythmThen(currentNode, () => {
            showIdentityGate(() => navigate(typingPending.next, { skipRhythm: true }));
          });
        } else {
          navigate(typingPending.next);
        }
      }, delay);
    });

    const identitySubmit = document.getElementById("identitySubmitBtn");
    identitySubmit?.addEventListener("click", handleIdentitySubmit);

    show("title");

    if (!typingProfile.diagnosed && !State.hasActiveRun()) {
      setTimeout(() => {
        openDiagnosticForLaunch(() => startMissionCore());
        toast("Welcome! Complete the keystroke test to launch your mission.", "lesson");
      }, prefersReducedMotion ? 200 : 650);
    }
  }

  function showIdentityGate(onComplete) {
    const gate = document.getElementById("identityGate");
    if (!gate) { onComplete?.(); return; }
    window._identityGateCallback = onComplete;
    gate.classList.remove("dw-hidden");
    const profile = State.loadProfile();
    const firstEl = document.getElementById("identityFirstName");
    const lastEl = document.getElementById("identityLastInitial");
    const classEl = document.getElementById("identityClassroom");
    const codeEl = document.getElementById("identityClassCode");
    if (profile.lastName && firstEl && lastEl) {
      const parts = profile.lastName.split(/\s+/);
      if (parts.length >= 2) {
        firstEl.value = parts.slice(0, -1).join(" ");
        lastEl.value = parts[parts.length - 1].slice(0, 1);
      }
    }
    if (profile.lastClassroom && classEl) {
      classEl.value = profile.lastClassroom;
    }
    firstEl?.focus();
  }

  function hideIdentityGate() {
    document.getElementById("identityGate")?.classList.add("dw-hidden");
    window._identityGateCallback = null;
  }

  async function handleIdentitySubmit() {
    const firstEl = document.getElementById("identityFirstName");
    const lastEl = document.getElementById("identityLastInitial");
    const classEl = document.getElementById("identityClassroom");
    const codeEl = document.getElementById("identityClassCode");
    const first = String(firstEl?.value || "").trim();
    const last = String(lastEl?.value || "").trim();
    const classroom = String(classEl?.value || "").trim();
    const classCode = String(codeEl?.value || "").trim();

    const name = first && last ? `${first} ${last.toUpperCase()}` : "";
    if (!first || !last || !classroom || !classCode) {
      toast("Fill in all fields to submit.", "lesson");
      return;
    }
    if (!/^[\p{L}][\p{L}'-]{0,15}$/u.test(first)) {
      toast("First name: letters only, up to 16 characters.", "lesson");
      return;
    }
    if (!/^[\p{L}]$/u.test(last)) {
      toast("Last initial must be one letter.", "lesson");
      return;
    }

    const profile = State.loadProfile();
    profile.lastName = name;
    profile.lastClassroom = classroom;
    State.saveProfile(profile);

    const oathText = document.getElementById("typingInput")?.value?.trim() || "";
    const challengeDurationSec = challengeStartTime
      ? Math.max(1, Math.round((Date.now() - challengeStartTime) / 1000))
      : Math.max(1, Math.round((Date.now() - startTime) / 1000 * 0.15));
    const oathPrompt = typingPending?.prompt || STORY?.final_trial?.typingChallenge?.prompt || "";
    const oathAnalysis = runGtgAnalysis(oathText, challengeDurationSec, {
      assignmentMode: "reflection",
      rubrics: ["typing", "mechanics", "story"],
      assignmentPrompt: oathPrompt,
      classroom,
      keystrokeStats: challengeKeystrokeTracker?.getStats?.() || null,
    });
    const submission = {
      name,
      classroom,
      classCode,
      oathText,
      badges: [...badges],
      goldenRules: [...goldenRules],
      mentorsMet: [...metCharacters],
      endingType: currentNode === "final_trial" ? "champion" : "mentor",
      endingNode: currentNode,
      durationSec: Math.max(0, Math.round((Date.now() - startTime) / 1000)),
      challengeDurationSec,
      analysis: serializeAnalysis(oathAnalysis),
      diagnosticAnalysis: typingProfile.diagnosticAnalysis || null,
      overallScore: oathAnalysis?.scores?.overall ?? null,
      oathWpm: oathAnalysis?.wpm ?? null,
    };

    try {
      const res = await fetch("/api/tech-trail/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      toast("Submission saved!", "badge");
      celebrateTypedSuccess(name, document.getElementById("identitySubmitBtn"), {
        badge: "OATH FILED!",
        confetti: 24,
        center: true,
        container: document.querySelector(".tt-identity-gate__panel"),
      });
    } catch (e) {
      State.queueOfflineSubmission(submission);
      toast("Saved locally — will retry when online.", "lesson");
      celebrateTypedSuccess("SAVED LOCALLY", document.getElementById("identitySubmitBtn"), {
        badge: "OFFLINE QUEUE",
        center: true,
        container: document.querySelector(".tt-identity-gate__panel"),
      });
    }

    setTimeout(() => {
      hideIdentityGate();
      window._identityGateCallback?.();
    }, prefersReducedMotion ? 0 : 700);
  }

  try {
    init();
  } catch (err) {
    showBootError("Game failed to start. Hard refresh (Ctrl+Shift+R) or clear site data for this page.");
    console.error("[GTG] init failed:", err);
  }
})();

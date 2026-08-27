/**
 * Global Tech Gauntlet — typing-powered CYOA digital citizenship adventure.
 */
(() => {
  "use strict";

  const WriteTestCoreRef = window.WriteTestCore;
  const { STORY, CHARACTERS, START_MISSIONS } = window.TechTrailStory || {};
  const Visuals = window.TechTrailVisuals;
  const State = window.TechTrailState;
  const Audio = window.TechTrailAudio;

  /** Minimal fallback if typing-engine.js fails to load (SW cache / 404). */
  function buildTypingFallback() {
    const PHRASES = [
      "the quick brown fox jumped over the lazy log",
      "pack my box with five dozen liquor jugs",
      "sphinx of black quartz judge my vow",
    ];
    const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return {
      DIAGNOSTIC_PHRASES: PHRASES,
      MIN_TARGET_WPM: 8,
      DEFAULT_TARGET_WPM: 18,
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
        };
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
      computeWpm(charCount, durationMs) {
        if (!durationMs) return 0;
        return Math.round(((charCount / 5) / (durationMs / 60000)) * 10) / 10;
      },
      recommendedTargetWpm(wpm) {
        return Math.round(Math.max(8, wpm * 0.88) * 10) / 10;
      },
      clampTargetWpm(testWpm, chosen) {
        const max = Math.max(8, testWpm * 1.5);
        return Math.round(Math.min(max, Math.max(8, chosen)) * 10) / 10;
      },
      maxManualTargetWpm(testWpm) {
        return Math.round(Math.max(8, testWpm * 1.5) * 10) / 10;
      },
      exceedsTypoBudget(typoCount, maxTypos) {
        if (maxTypos >= 10) return false;
        return typoCount > maxTypos;
      },
      meetsSpeedGate(wpm, targetWpm) {
        if (!targetWpm) return true;
        return wpm >= targetWpm * 0.85;
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

  let currentNode = "start";
  let badges = new Set();
  let lessons = new Set();
  let goldenRules = new Set();
  let journal = [];
  let typingPending = null;
  let metCharacters = new Set();
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

  const DIFFICULTY_CONFIG = {
    cadet: { wordMult: 0.5, startChoicesMin: 3, startChoicesMax: 3, label: "Cadet" },
    operative: { wordMult: 1, startChoicesMin: 3, startChoicesMax: 4, label: "Operative" },
    analyst: { wordMult: 1.5, startChoicesMin: 4, startChoicesMax: 5, label: "Analyst" },
  };

  function saveTypingProfile() {
    State.saveTypingProfile(typingProfile);
    updateTypingProfileUI();
  }

  function updateTypingProfileUI() {
    const bar = document.getElementById("typingProfileBar");
    const testEl = document.getElementById("profileTestWpm");
    const targetEl = document.getElementById("profileTargetWpm");
    const statTarget = document.getElementById("statTargetWpm");
    if (typingProfile.diagnosed) {
      bar?.classList.remove("dw-hidden");
      if (testEl) testEl.textContent = String(typingProfile.testWpm);
      if (targetEl) targetEl.textContent = String(typingProfile.targetWpm);
    } else {
      bar?.classList.add("dw-hidden");
    }
    if (statTarget) statTarget.textContent = typingProfile.diagnosed ? String(typingProfile.targetWpm) : "—";
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

  function showDiagnostic() {
    const overlay = document.getElementById("diagnosticOverlay");
    const input = document.getElementById("diagnosticInput");
    const result = document.getElementById("diagnosticResult");
    const status = document.getElementById("diagnosticStatus");
    if (!overlay) return;

    diagnosticPhrase = Typing.pickDiagnosticPhrase(runRng) || Typing.DIAGNOSTIC_PHRASES?.[0] || "the quick brown fox jumped over the lazy log";
    diagnosticStartTime = 0;
    overlay.classList.remove("dw-hidden");
    result?.classList.add("dw-hidden");
    if (status) status.textContent = "Focus on accuracy first — speed follows!";
    if (input) {
      input.value = "";
      input.disabled = false;
    }
    updateDiagnosticGhost("");
    document.getElementById("diagnosticTyped").innerHTML = "";
    updateTypingMeterUI({
      progressPct: 0,
      liveWpm: 0,
      progressFillId: "diagnosticProgressFill",
      wpmFillId: "diagnosticWpmFill",
      progressPctId: "diagnosticProgressPct",
      liveWpmId: "diagnosticLiveWpm",
      inputEl: input,
    });
    overlay.querySelector(".tt-diagnostic__panel")?.classList.add("tt-diagnostic__panel--pop");
    setTimeout(() => input?.focus(), 120);
  }

  function hideDiagnostic() {
    document.getElementById("diagnosticOverlay")?.classList.add("dw-hidden");
    pendingDiagnosticAction = null;
  }

  function updateDiagnosticGhost(inputVal) {
    const ghost = document.getElementById("diagnosticGhost");
    const plain = document.getElementById("diagnosticPhrasePlain");
    const phrase = diagnosticPhrase || Typing.DIAGNOSTIC_PHRASES?.[0] || "the quick brown fox jumped over the lazy log";
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
    const liveWpm = duration > 0 ? Typing.computeWpm(input.value.length, duration) : 0;
    updateTypingMeterUI({
      progressPct: cmp.progress,
      liveWpm,
      targetWpm: typingProfile.targetWpm || Typing.DEFAULT_TARGET_WPM,
      progressFillId: "diagnosticProgressFill",
      wpmFillId: "diagnosticWpmFill",
      progressPctId: "diagnosticProgressPct",
      liveWpmId: "diagnosticLiveWpm",
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

    if (cmp.complete) {
      const duration = diagnosticStartTime ? performance.now() - diagnosticStartTime : 0;
      const wpm = Typing.computeWpm(diagnosticPhrase.length, duration);
      typingProfile.testWpm = wpm;
      typingProfile.lastPhrase = diagnosticPhrase;
      typingProfile.diagnosedAt = Date.now();
      const recommended = Typing.recommendedTargetWpm(wpm);
      typingProfile.targetWpm = recommended;

      input.disabled = true;
      document.getElementById("diagnosticWpm").textContent = String(wpm);
      document.getElementById("diagnosticRecommended").textContent = String(recommended);
      const targetInput = document.getElementById("diagnosticTargetInput");
      if (targetInput) {
        targetInput.min = String(Typing.MIN_TARGET_WPM);
        targetInput.max = String(Typing.maxManualTargetWpm(wpm));
        targetInput.value = String(Math.round(recommended));
      }
      document.getElementById("diagnosticResult")?.classList.remove("dw-hidden");
      if (status) status.textContent = "Nice! Accept the recommended speed or set your own challenge.";
      Audio?.playDiagnosticPop?.();
      document.querySelector(".tt-diagnostic__panel")?.classList.add("tt-diagnostic__panel--success");
      celebrateTypedSuccess(diagnosticPhrase, input, {
        badge: `${wpm} WPM!`,
        badgeVariant: "green",
        confetti: 16,
        skipAudio: true,
        container: document.querySelector(".tt-diagnostic__panel"),
      });
    }
  }

  function acceptDiagnostic() {
    const targetInput = document.getElementById("diagnosticTargetInput");
    const chosen = Number(targetInput?.value || typingProfile.targetWpm);
    typingProfile.targetWpm = Typing.clampTargetWpm(typingProfile.testWpm, chosen);
    typingProfile.diagnosed = true;
    saveTypingProfile();
    const acceptBtn = document.getElementById("diagnosticAcceptBtn");
    celebrateTypedSuccess(`${typingProfile.targetWpm} WPM TARGET`, acceptBtn || targetInput, {
      badge: "LOCKED IN!",
      confetti: 12,
      center: true,
      container: document.querySelector(".tt-diagnostic__panel"),
    });
    setTimeout(() => {
      hideDiagnostic();
      toast(`Target set: ${typingProfile.targetWpm} WPM — type your adventure!`, "badge");
      pendingDiagnosticAction?.();
      pendingDiagnosticAction = null;
    }, prefersReducedMotion ? 0 : 850);
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
    if (hint) {
      hint.textContent = `Type one path at ${typingProfile.targetWpm} WPM · ${typingProfile.maxTypos >= 10 ? "typos forgiven" : `up to ${typingProfile.maxTypos} typo${typingProfile.maxTypos === 1 ? "" : "s"}`}`;
    }

    updateTypingMeterUI({
      progressPct: 0,
      liveWpm: 0,
      targetWpm: typingProfile.targetWpm,
      progressFillId: "choiceProgressFill",
      wpmFillId: "choiceWpmFill",
      progressPctId: "choiceProgressPct",
      liveWpmId: "choiceLiveWpm",
      targetWpmId: "choiceTargetWpm",
      inputEl: document.getElementById("choiceTypingInput"),
    });

    document.getElementById("liveWpmStat")?.classList.remove("dw-hidden");
    const input = document.getElementById("choiceTypingInput");
    setTimeout(() => input?.focus(), 200);
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
    if (typedEl) typedEl.innerHTML = Typing.renderTypedCharsHtml(cmp.chars, typingProfile.maxTypos);

    const duration = choiceTypingStart ? performance.now() - choiceTypingStart : 0;
    const liveWpm = duration > 0 ? Typing.computeWpm(input.value.length, duration) : 0;
    const liveEl = document.getElementById("statLiveWpm");
    if (liveEl) liveEl.textContent = String(Math.round(liveWpm));

    updateTypingMeterUI({
      progressPct: cmp.progress,
      liveWpm,
      targetWpm: typingProfile.targetWpm,
      progressFillId: "choiceProgressFill",
      wpmFillId: "choiceWpmFill",
      progressPctId: "choiceProgressPct",
      liveWpmId: "choiceLiveWpm",
      targetWpmId: "choiceTargetWpm",
      inputEl: input,
      complete: cmp.complete,
      speedOk: Typing.meetsSpeedGate(liveWpm, typingProfile.targetWpm),
    });

    if (cmp.chars.length > 0) {
      const last = cmp.chars[cmp.chars.length - 1];
      if (last.state === "correct") Audio?.playCharCorrect?.();
      else Audio?.playTypeTick?.();
    }

    if (Typing.exceedsTypoBudget(cmp.typoCount, typingProfile.maxTypos)) {
      if (hint) hint.textContent = "Too many typos — fix the underlined letters!";
      return;
    }

    if (!cmp.complete || !resolved.choice) return;

    if (!Typing.meetsSpeedGate(liveWpm, typingProfile.targetWpm)) {
      if (hint) hint.textContent = `Too slow (${Math.round(liveWpm)} WPM) — need ${typingProfile.targetWpm} WPM. Try again!`;
      Audio?.playSpeedFail?.();
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
    hideDiagnostic();
    pendingDiagnosticAction = null;

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
    requireDiagnostic(() => {
      resetRun();
      showSceneLoader();
      setTimeout(() => { renderScene("start"); hideSceneLoader(); }, SCENE_LOADER_MIN_MS);
    });
  }

  function beginContinueMission() {
    Audio?.init?.();
    requireDiagnostic(() => {
      const saved = State.loadRun();
      if (saved) {
        currentNode = saved.currentNode;
        badges = saved.badges;
        lessons = saved.lessons;
        goldenRules = saved.goldenRules;
        journal = saved.journal;
        metCharacters = saved.metCharacters;
        integrity = saved.integrity ?? 100;
        reputation = saved.reputation ?? 50;
        mentorTrust = saved.mentorTrust || {};
        startTime = saved.startedAt || Date.now();
        showSceneLoader();
        setTimeout(() => { renderScene(currentNode); hideSceneLoader(); }, SCENE_LOADER_MIN_MS);
      } else {
        resetRun();
        showSceneLoader();
        setTimeout(() => { renderScene("start"); hideSceneLoader(); }, SCENE_LOADER_MIN_MS);
      }
    });
  }

  function beginNewMission() {
    Audio?.init?.();
    requireDiagnostic(() => {
      resetRun();
      showSceneLoader();
      setTimeout(() => { renderScene("start"); hideSceneLoader(); }, SCENE_LOADER_MIN_MS);
    });
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

  function buildStartChoices() {
    const cfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.operative;
    const count = cfg.startChoicesMin + Math.floor(runRng() * (cfg.startChoicesMax - cfg.startChoicesMin + 1));
    return shuffle(START_MISSIONS || []).slice(0, Math.min(count, START_MISSIONS.length));
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let typewriterGen = 0;
  let typewriterResolve = null;
  const CHOICE_COOLDOWN_MS = 1200;
  const SCENE_LOADER_MIN_MS = 800;
  const TYPEWRITER_MIN_DWELL_MS = 1200;
  const TYPEWRITER_CHAR_MS = 22;

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
  }

  function toggleHighContrast() {
    const on = document.body.classList.toggle("tt-high-contrast");
    try { localStorage.setItem("techtrail:highContrast", on ? "1" : "0"); } catch {}
  }

  function updateMuteButton() {
    const btn = document.getElementById("muteToggleBtn");
    if (!btn) return;
    btn.textContent = Audio?.isMuted?.() ? "🔇" : "🔊";
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

  async function typewriteNarrative(html, gen) {
    const narrativeEl = document.getElementById("sceneNarrative");
    const continueBtn = document.getElementById("narrativeContinueBtn");
    if (!narrativeEl) return;

    cancelTypewriterWait();

    if (prefersReducedMotion) {
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

      if (i < paragraphs.length - 1) {
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
    Core.showView(views, name);
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
      liveWpm = 0,
      targetWpm = 0,
      progressFillId,
      wpmFillId,
      progressPctId,
      liveWpmId,
      targetWpmId,
      inputEl,
      complete = false,
      speedOk = true,
    } = cfg;

    const pct = Math.min(100, Math.max(0, Math.round(progressPct)));
    const progressFill = progressFillId ? document.getElementById(progressFillId) : null;
    if (progressFill) progressFill.style.width = `${pct}%`;

    const wpmFill = wpmFillId ? document.getElementById(wpmFillId) : null;
    if (wpmFill && targetWpm > 0) {
      const wpmPct = Math.min(100, Math.round((liveWpm / targetWpm) * 100));
      wpmFill.style.width = `${wpmPct}%`;
      wpmFill.classList.toggle("tt-typing-meter__wpm--hot", wpmPct >= 88);
      wpmFill.classList.toggle("tt-typing-meter__wpm--cold", wpmPct < 55);
    }

    if (progressPctId) {
      const el = document.getElementById(progressPctId);
      if (el) el.textContent = `${pct}%`;
    }
    if (liveWpmId) {
      const el = document.getElementById(liveWpmId);
      if (el) el.textContent = String(Math.round(liveWpm));
    }
    if (targetWpmId) {
      const el = document.getElementById(targetWpmId);
      if (el) el.textContent = targetWpm > 0 ? String(Math.round(targetWpm)) : "—";
    }

    if (inputEl) {
      inputEl.classList.toggle("tt-typing-input--near", pct >= 65 && !complete);
      inputEl.classList.toggle("tt-typing-input--ready", complete && speedOk);
      inputEl.classList.toggle("tt-typing-input--slow", complete && !speedOk);
    }
  }

  function renderGoldenTrack(containerId = "goldenRulesTrack") {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = Visuals.GOLDEN_RULES.map((rule) => {
      const lit = goldenRules.has(rule.n);
      return `<div class="tt-golden-orb${lit ? " tt-golden-orb--lit" : ""}" title="${escapeHtml(rule.short)}">
        <span class="tt-golden-orb__icon">${rule.icon}</span>
        <span class="tt-golden-orb__num">${rule.n}</span>
      </div>`;
    }).join("");
  }

  function renderTitleGoldenPreview() {
    renderGoldenTrack("titleGoldenPreview");
    document.querySelectorAll("#titleGoldenPreview .tt-golden-orb").forEach((orb, i) => {
      orb.classList.remove("tt-golden-orb--lit");
      setTimeout(() => orb.classList.add("tt-golden-orb--pulse"), 300 + i * 180);
    });
  }

  function applySceneZone(nodeId) {
    const zone = Visuals.zoneForNode(nodeId);
    const bg = document.getElementById("sceneBg");
    const tint = document.getElementById("sceneTint");
    const room = document.getElementById("sceneRoom");
    const mood = document.getElementById("sceneMood");

    if (prefersReducedMotion) {
      if (bg) bg.style.backgroundImage = `url('${zone.bg}')`;
      if (tint) tint.style.background = zone.tint;
    } else {
      bg?.classList.add("tt-scene-bg--out");
      setTimeout(() => {
        if (bg) bg.style.backgroundImage = `url('${zone.bg}')`;
        if (tint) tint.style.background = zone.tint;
        bg?.classList.remove("tt-scene-bg--out");
        bg?.classList.add("tt-scene-bg--in");
        setTimeout(() => bg?.classList.remove("tt-scene-bg--in"), 500);
      }, 450);
    }

    if (mood) mood.textContent = zone.mood ? zone.mood.toUpperCase() : "";

    if (room && !prefersReducedMotion) {
      room.classList.remove("tt-stage__room--enter");
      void room.offsetWidth;
      room.classList.add("tt-stage__room--enter");
    }

    if (Audio) {
      Audio.stopZoneAmbience?.();
      Audio.startZoneAmbience?.(zone.mood);
    }
  }

  function tiltStage(clientX, clientY) {
    if (prefersReducedMotion) return;
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    viewport.style.setProperty("--tt-tilt-y", `${x * 8}deg`);
    viewport.style.setProperty("--tt-tilt-x", `${-y * 5}deg`);
  }

  function resetStageTilt() {
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    viewport.style.setProperty("--tt-tilt-y", "0deg");
    viewport.style.setProperty("--tt-tilt-x", "0deg");
  }

  function handleDeviceOrientation(e) {
    if (prefersReducedMotion) return;
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
    if (prefersReducedMotion || e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchMove(e) {
    if (prefersReducedMotion || e.touches.length !== 1) return;
    const viewport = document.getElementById("sceneViewport");
    if (!viewport) return;
    const dx = (e.touches[0].clientX - touchStartX) / window.innerWidth;
    const dy = (e.touches[0].clientY - touchStartY) / window.innerHeight;
    viewport.style.setProperty("--tt-tilt-y", `${dx * 12}deg`);
    viewport.style.setProperty("--tt-tilt-x", `${-dy * 8}deg`);
  }

  function renderCharacter(charKey) {
    const char = CHARACTERS[charKey] || CHARACTERS.guide;
    const portrait = Visuals.PORTRAITS[charKey];
    const charEl = document.getElementById("sceneCharacter");
    if (!charEl) return;

    const avatarInner = portrait
      ? `<img class="tt-character__photo" src="${portrait}" alt="" width="72" height="72" loading="lazy" />`
      : `<span class="tt-character__emoji">${char.emoji}</span>`;

    charEl.innerHTML = `
      <div class="tt-character__card">
        <div class="tt-character__avatar">${avatarInner}</div>
        <div class="tt-character__info">
          <div class="tt-character__name">${escapeHtml(char.name)}</div>
          <div class="tt-character__role">${escapeHtml(char.role)} · ${escapeHtml(char.era)}</div>
        </div>
      </div>`;

    if (!prefersReducedMotion) {
      charEl.classList.remove("tt-character--pop");
      void charEl.offsetWidth;
      charEl.classList.add("tt-character--pop");
    }
  }

  function recordLesson(code) {
    if (!code || lessons.has(code)) return;
    lessons.add(code);
    journal.push(`📚 Lesson logged`);
    const lessonEl = document.getElementById("sceneLesson");
    if (lessonEl) {
      lessonEl.classList.remove("dw-hidden");
      lessonEl.innerHTML = `New insight added to your mission record.`;
      if (!prefersReducedMotion) {
        lessonEl.classList.remove("tt-lesson-flash--show");
        void lessonEl.offsetWidth;
        lessonEl.classList.add("tt-lesson-flash--show");
      }
    }
  }

  function resolveChoices(node, nodeId) {
    if (node.dynamicChoices === "start" || (nodeId === "start" && !node.choices?.length)) {
      return startChoices.length ? startChoices : buildStartChoices();
    }
    return node.choices || [];
  }

  function maybeRollBonus(node) {
    const roll = node.rngBadge;
    if (!roll || runRng() >= roll.chance || badges.has(roll.badge)) return;
    badges.add(roll.badge);
    journal.push(`🏅 Badge: ${roll.badge}`);
    toast(roll.message || `Bonus badge: ${roll.badge}`, "badge");
    burstConfetti(14);
  }

  async function renderScene(nodeId) {
    const gen = ++typewriterGen;
    const node = STORY[nodeId];
    if (!node) return;
    currentNode = nodeId;

    const choiceTypingInput = document.getElementById("choiceTypingInput");
    if (choiceTypingInput) choiceTypingInput.disabled = false;
    document.getElementById("typingChoices")?.classList.remove("tt-typing-choices--unlock");

    if (nodeId === "start") {
      startChoices = buildStartChoices();
      journal.push(`🎲 ${startChoices.length} missions on the board this run`);
    }

    applySceneZone(nodeId);

    document.getElementById("sceneLocation").textContent = node.location || "Unknown";
    const narrativeEl = document.getElementById("sceneNarrative");
    const choicesEl = document.getElementById("sceneChoices");
    const typingEl = document.getElementById("typingChallenge");

    choicesEl.innerHTML = "";
    typingEl.classList.add("dw-hidden");
    typingPending = null;

    if (narrativeEl) {
      narrativeEl.classList.remove("tt-narrative--reveal");
      void narrativeEl.offsetWidth;
      narrativeEl.classList.add("tt-narrative--reveal");
      await typewriteNarrative(node.narrative || "", gen);
    }
    if (gen !== typewriterGen) return;

    metCharacters.add(node.character);
    renderCharacter(node.character);

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
      toast(`Badge unlocked: ${node.badge}`, "badge");
      burstConfetti(18);
      Audio?.playBadgeChime?.();
    }
    if (node.goldenRule && goldenRules.size > prevGoldenCount) {
      toast(`Golden Rule #${node.goldenRule} recovered`, "golden");
      burstConfetti(28);
      Audio?.playGoldenFanfare?.();
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
      choicesEl.innerHTML = "";
      document.getElementById("typingPrompt").textContent = node.typingChallenge.prompt;
      const savedDraft = State.loadDraft();
      const typingInput = document.getElementById("typingInput");
      typingInput.value = savedDraft || "";
      const words = Core.countWords(typingInput.value);
      const min = scaleMinWords(typingPending.minWords || 20);
      updateTypingProgress(words, min);
      document.getElementById("typingSubmitBtn").disabled = words < min;
      typingInput?.focus();
      typingEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      const choices = resolveChoices(node, nodeId);
      if (choices.length) {
        setupTypingChoices(node, choices);
      }
    }

    if (node.ending) {
      show("ending");
      renderEnding(node);
    } else {
      show("game");
    }

    renderJournal();
    renderResearchPanel();
  }

  function updateTypingProgress(words, minWords) {
    const pct = Math.min(100, Math.round((words / minWords) * 100));
    const fill = document.getElementById("typingProgressFill");
    const countEl = document.getElementById("typingWordCount");
    const challengeFill = document.getElementById("challengeWordFill");
    if (fill) fill.style.width = `${pct}%`;
    if (challengeFill) challengeFill.style.width = `${pct}%`;
    updateTypingMeterUI({
      progressPct: pct,
      progressFillId: "challengeWordFill",
      progressPctId: "challengeWordPct",
      inputEl: document.getElementById("typingInput"),
      complete: words >= minWords,
      speedOk: true,
    });
    if (countEl) {
      countEl.textContent = `${words} / ${minWords} words`;
      countEl.classList.toggle("tt-typing-count--ready", words >= minWords);
    }
    const submitBtn = document.getElementById("typingSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = words < minWords;
      submitBtn.classList.toggle("tt-cta-btn--ready", words >= minWords);
    }
  }

  function navigate(nodeId) {
    if (prefersReducedMotion) {
      renderScene(nodeId);
      return;
    }
    showSceneLoader();
    setTimeout(() => {
      renderScene(nodeId);
      hideSceneLoader();
    }, SCENE_LOADER_MIN_MS);
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
        ? `<img class="tt-hero-note__thumb" src="${portrait}" alt="" width="40" height="40" loading="lazy" />`
        : `<span class="tt-hero-note__emoji">${c.emoji}</span>`;
      return `<div class="tt-hero-note">${thumb}<div><strong>${escapeHtml(c.name)}</strong><p>${escapeHtml(c.research)}</p></div></div>`;
    }).join("");
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

You recovered some rules — but the cost was visible. Compromises leave traces. The Host extends a hand anyway. "Next run, the stakes are real."

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
    typingProfile = State.loadTypingProfile();
    renderTitleGoldenPreview();
    renderProfileMini();
    updateDifficultyButtons();
    updateMuteButton();
    updateTypingProfileUI();
    updateTypoToleranceUI();
    renderTitleTypingMenu();

    document.querySelectorAll(".tt-difficulty__btn").forEach((btn) => {
      btn.addEventListener("click", () => saveDifficulty(btn.dataset.tier));
    });

    document.getElementById("highContrastToggle")?.addEventListener("click", toggleHighContrast);
    document.getElementById("fullscreenToggleBtn")?.addEventListener("click", () => toggleGameFullscreen());
    document.addEventListener("fullscreenchange", updateFullscreenButton);
    document.addEventListener("webkitfullscreenchange", updateFullscreenButton);
    updateFullscreenButton();
    hookFullscreenOnFirstGesture();

    const playLaunch = new URLSearchParams(window.location.search).get("play") === "1";
    if (playLaunch) {
      hookFullscreenOnFirstGesture();
      setTimeout(() => {
        toast("Tip: tap ⛶ Fullscreen for the best arcade view.", "info");
        document.getElementById("titleTypingInput")?.focus();
      }, 600);
    }

    document.getElementById("muteToggleBtn")?.addEventListener("click", () => {
      Audio?.toggleMuted?.();
      updateMuteButton();
    });

    const startBtn = document.getElementById("startGameBtn");
    const continueBtn = document.getElementById("continueRunBtn");
    const newRunBtn = document.getElementById("newRunBtn");

    if (State.hasActiveRun()) {
      startBtn?.classList.add("dw-hidden");
      continueBtn?.classList.remove("dw-hidden");
      newRunBtn?.classList.remove("dw-hidden");
    } else {
      startBtn?.classList.remove("dw-hidden");
      continueBtn?.classList.add("dw-hidden");
      newRunBtn?.classList.add("dw-hidden");
    }

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
    });

    document.getElementById("retakeDiagnosticBtn")?.addEventListener("click", () => {
      typingProfile.diagnosed = false;
      saveTypingProfile();
      showDiagnostic();
    });

    document.getElementById("diagnosticAcceptBtn")?.addEventListener("click", acceptDiagnostic);

    const diagnosticInput = document.getElementById("diagnosticInput");
    Core.setupPasteControl(diagnosticInput, false);
    diagnosticInput?.addEventListener("input", handleDiagnosticInput);

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
    viewport?.addEventListener("mousemove", (e) => tiltStage(e.clientX, e.clientY));
    viewport?.addEventListener("mouseleave", resetStageTilt);
    viewport?.addEventListener("touchstart", handleTouchStart, { passive: true });
    viewport?.addEventListener("touchmove", handleTouchMove, { passive: true });
    viewport?.addEventListener("touchend", resetStageTilt, { passive: true });
    window.addEventListener("deviceorientation", handleDeviceOrientation);

    const typingInput = document.getElementById("typingInput");
    Core.setupPasteControl(typingInput, false);

    typingInput?.addEventListener("input", () => {
      Audio?.playTypeTick?.();
      const words = Core.countWords(typingInput.value);
      const min = scaleMinWords(typingPending?.minWords || 20);
      updateTypingProgress(words, min);
      document.getElementById("typingSubmitBtn").disabled = words < min;
      State.saveDraft(typingInput.value);
    });

    document.getElementById("typingSubmitBtn")?.addEventListener("click", () => {
      if (!typingPending) return;
      const typingInput = document.getElementById("typingInput");
      const words = Core.countWords(typingInput?.value || "");
      const min = scaleMinWords(typingPending.minWords || 20);
      if (words < min) return;
      journal.push(`⌨️ Oath drafted (${words} words)`);
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
          showIdentityGate(() => navigate(typingPending.next));
        } else {
          navigate(typingPending.next);
        }
      }, delay);
    });

    const identitySubmit = document.getElementById("identitySubmitBtn");
    identitySubmit?.addEventListener("click", handleIdentitySubmit);

    show("title");
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

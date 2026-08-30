/**
 * Global Tech Gauntlet — typing-powered CYOA digital citizenship adventure.
 */
(() => {
  "use strict";

  const touchMode =
    window.matchMedia("(pointer: coarse)").matches
    || window.matchMedia("(hover: none)").matches
    || (navigator.maxTouchPoints > 0 && !window.matchMedia("(pointer: fine)").matches);
  if (touchMode) document.body.classList.add("tt-touch-mode");

  const WriteTestCoreRef = window.WriteTestCore;
  const { STORY, CHARACTERS, START_MISSIONS, GOLDEN_SPINE, MIN_GOLDEN_FOR_SPEEDRUN = 3 } = window.TechTrailStory || {};
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
        const mode = options.mode || "game";
        if (mode === "live") {
          const minSampleMs = options.minSampleMs ?? 1500;
          const effectiveMs = Math.max(durationMs || 0, minSampleMs);
          if (effectiveMs <= 0) return 0;
          return Math.min(Math.round(count / (effectiveMs / 60000)), options.maxCpm ?? 180);
        }
        if (mode === "diagnostic") {
          const minMsPerKey = options.minMsPerKey ?? 90;
          const effectiveMs = Math.max(durationMs || 0, count * minMsPerKey);
          if (effectiveMs <= 0) return 0;
          return Math.min(Math.round(count / (effectiveMs / 60000)), options.maxCpm ?? 120);
        }
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
        if (ratio <= 0) return true;
        return cpm >= targetCpm * ratio;
      },
      isShortTranscriptionPath(target, maxLen = 24) {
        return this.normalize(target).length <= maxLen;
      },
      scaledSpeedGateRatio(speedGate, targetLength, maxLen = 24) {
        const len = Math.max(0, targetLength || 0);
        if (len <= maxLen) return 0;
        const rampEnd = 48;
        if (len >= rampEnd) return speedGate ?? 0.85;
        return (speedGate ?? 0.85) * ((len - maxLen) / (rampEnd - maxLen));
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
  const Pedagogy = window.TechTrailPedagogy || null;
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
  let unlockedRooms = new Set(["start"]);
  let completedRooms = new Set();

  function canReachFinalTrial() {
    if (goldenRules.size >= 5) return true;
    return goldenRules.size >= MIN_GOLDEN_FOR_SPEEDRUN && completedRooms.has("reflect_phase");
  }

  function isRoomUnlocked(roomId) {
    return unlockedRooms.has(roomId);
  }

  function unlockRoom(roomId, opts = {}) {
    if (!Visuals.MAP_ROOMS?.[roomId] || unlockedRooms.has(roomId)) return false;
    unlockedRooms.add(roomId);
    if (!opts.silent) {
      const label = Visuals.MAP_ROOMS[roomId]?.label || roomId;
      journal.push(`🔓 Circuit open: ${label}`);
    }
    window.__gtgWorld3D?.refreshCampus?.();
    renderCampusLinkProgress();
    return true;
  }

  function unlockAdjacentRooms(roomId) {
    const newly = [];
    for (const adj of Visuals.getAdjacentRooms?.(roomId) || []) {
      if (unlockRoom(adj, { silent: true })) newly.push(adj);
    }
    if (newly.length) {
      const names = newly.map((id) => Visuals.MAP_ROOMS[id]?.label || id).join(" · ");
      toast(`Circuit linked — ${names} now open!`, "info");
      reputation = Math.min(100, reputation + newly.length * 2);
      journal.push(`⚡ Linked ${newly.length} new door${newly.length === 1 ? "" : "s"}`);
      Audio?.playBadgeChime?.();
    }
    return newly;
  }

  function checkFinalTrialUnlock() {
    if (unlockedRooms.has("final_trial")) return;
    if (canReachFinalTrial()) {
      unlockRoom("final_trial");
      toast("🏟️ Final Trial unlocked! The Arena circuit is live.", "golden");
      journal.push("🏟️ Final Trial — Arena circuit connected from Crawford's Bureau");
      burstConfetti(20);
      Audio?.playGoldenFanfare?.();
    }
  }

  function onTravelToRoom(fromNodeId, toNodeId) {
    const fromRoom = mapIdFor(fromNodeId);
    const toRoom = mapIdFor(toNodeId);
    if (fromRoom === toRoom) return;
    unlockRoom(toRoom, { silent: fromNodeId === "start" });
  }

  function choiceLeadsToLockedRoom(choice, fromNodeId) {
    const next = choice?.next;
    if (!next) return false;
    const fromRoom = mapIdFor(fromNodeId);
    const toRoom = mapIdFor(next);
    if (fromRoom === toRoom) return false;
    if (fromNodeId === "start" && Visuals.isGoldenPathRoom?.(toRoom)) return false;
    return !isRoomUnlocked(toRoom);
  }

  function renderCampusLinkProgress() {
    const el = document.getElementById("campusLinkProgress");
    if (!el || !Visuals.MAP_ROOMS) return;
    const total = Object.keys(Visuals.MAP_ROOMS).length - 1;
    const count = [...unlockedRooms].filter((id) => id !== "start").length;
    el.textContent = `Campus ${count}/${total}`;
    el.title = `${count} of ${total} rooms on your circuit — branch out to link them all`;
    el.classList.toggle("tt-campus-progress--ready", unlockedRooms.has("final_trial"));
  }

  function openFastTravel() {
    if (!window.__gtgWorld3D?.active) return;
    if (!document.body.classList.contains("tt-roam")) {
      toast("Leave the room first (🚪) or press E outside to roam the campus.", "lesson");
      return;
    }
    const gate = document.getElementById("fastTravelGate");
    const input = document.getElementById("fastTravelInput");
    const list = document.getElementById("fastTravelList");
    if (!gate || !input) return;
    gate.classList.remove("dw-hidden");
    gate.setAttribute("aria-hidden", "false");
    if (list) {
      const rooms = [...unlockedRooms]
        .filter((id) => id !== "start" && Visuals.MAP_ROOMS[id])
        .map((id) => Visuals.MAP_ROOMS[id])
        .sort((a, b) => a.label.localeCompare(b.label));
      list.innerHTML = rooms.length
        ? rooms.map((r) => `<button type="button" class="tt-fast-travel__room" data-room="${escapeHtml(r.id)}">${r.icon} ${escapeHtml(r.label)}</button>`).join("")
        : `<p class="tt-fast-travel__empty">Pick your first path from the Briefing Room to open doors.</p>`;
      list.querySelectorAll("[data-room]").forEach((btn) => {
        btn.addEventListener("click", () => fastTravelTo(btn.dataset.room));
      });
    }
    input.value = "";
    setTimeout(() => input.focus(), 80);
  }

  function closeFastTravel() {
    const gate = document.getElementById("fastTravelGate");
    gate?.classList.add("dw-hidden");
    gate?.setAttribute("aria-hidden", "true");
  }

  function fastTravelTo(roomId) {
    if (!isRoomUnlocked(roomId)) {
      toast("That room isn't on your circuit yet.", "lesson");
      return;
    }
    closeFastTravel();
    window.__gtgWorld3D?.teleportToRoom?.(roomId);
    const label = Visuals.MAP_ROOMS[roomId]?.label || roomId;
    toast(`Fast travel → ${label}`, "info");
    journal.push(`🚀 Fast travel: ${label}`);
  }

  function submitFastTravel() {
    const input = document.getElementById("fastTravelInput");
    const query = input?.value?.trim();
    if (!query) return;
    const roomId = Visuals.matchRoomQuery?.(query);
    if (!roomId) {
      toast(`No room matches "${query}" — try Design Lab, Data Vault, etc.`, "lesson");
      return;
    }
    fastTravelTo(roomId);
  }

  let goldenQuizPassed = false;
  let dataFragments = [];
  let mentorPackets = [];
  let integrity = 100;
  let reputation = 50;
  let mentorTrust = {};
  let strikes = 0;
  let completedMinigames = new Set();
  let phraseTrack = null;
  const MAX_STRIKES = 3;
  let runRng = Math.random;
  let startChoices = [];
  let startTime = Date.now();
  let identitySubmitting = false;
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
  let pendingChatMission = null;
  let chatMissionCallback = null;
  let completedChatMissions = new Set();
  let loadedRosterNames = [];
  let studentProfileSubmitting = false;
  let rosterLoadTimer = null;

  function normalizeClassroomApostrophe(value) {
    return String(value || "").trim().replace(/[\u2018\u2019\u201B\u2032]/g, "'");
  }

  function resolveClassroomOption(classEl, preferred) {
    if (!classEl) return "";
    const want = normalizeClassroomApostrophe(preferred);
    const options = Array.from(classEl.options || []);
    const hit = options.find((opt) => normalizeClassroomApostrophe(opt.value) === want);
    if (hit) return hit.value;
    return options[0]?.value || "";
  }
  let pendingBootCallback = null;

  const CLASS_CODE_SESSION_KEY = "techtrail:classCode";

  function getStudentIdentity() {
    const profile = State.loadProfile();
    return {
      name: profile.lastName || "",
      classroom: profile.lastClassroom || "",
      runId: String(startTime || ""),
    };
  }

  function getStoredClassCode() {
    try {
      return sessionStorage.getItem(CLASS_CODE_SESSION_KEY) || "";
    } catch {
      return "";
    }
  }

  function storeClassCode(code) {
    try {
      if (code) sessionStorage.setItem(CLASS_CODE_SESSION_KEY, code);
      else sessionStorage.removeItem(CLASS_CODE_SESSION_KEY);
    } catch {}
  }

  async function fetchClassrooms() {
    const res = await fetch("/api/tech-trail/roster?action=classrooms");
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.classrooms) ? data.classrooms : [];
  }

  async function fetchRosterNames(classroom, classCode) {
    const params = new URLSearchParams({ classroom, classCode });
    const res = await fetch(`/api/tech-trail/roster?${params}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || "Could not load roster.");
    return Array.isArray(data.names) ? data.names : [];
  }

  function fillStudentNameDatalist(names) {
    const list = document.getElementById("studentProfileNameList");
    if (!list) return;
    list.innerHTML = names.map((n) => {
      const parts = n.split(/\s+/);
      const last = parts.pop() || "";
      const first = parts.join(" ");
      return `<option value="${escapeHtml(first)}" label="${escapeHtml(n)}"></option>`;
    }).join("");
  }

  function renderStudentRosterList(names) {
    const el = document.getElementById("studentProfileRosterList");
    if (!el) return;
    if (!names.length) {
      el.innerHTML = "";
      el.classList.add("dw-hidden");
      return;
    }
    el.innerHTML = names.map((n) => {
      const parts = n.split(/\s+/);
      const last = parts.pop() || "";
      const first = parts.join(" ");
      return `<button type="button" class="tt-settings-btn tt-identity-gate__roster-btn" data-roster-first="${escapeHtml(first)}" data-roster-last="${escapeHtml(last)}">${escapeHtml(n)}</button>`;
    }).join("");
    el.classList.remove("dw-hidden");
  }

  function pickStudentFromRoster(first, last) {
    const firstEl = document.getElementById("studentProfileFirstName");
    const lastEl = document.getElementById("studentProfileLastInitial");
    if (firstEl) firstEl.value = first;
    if (lastEl) lastEl.value = last;
    document.getElementById("studentProfileError")?.classList.add("dw-hidden");
  }

  function scheduleStudentRosterLoad() {
    clearTimeout(rosterLoadTimer);
    rosterLoadTimer = setTimeout(() => {
      const classEl = document.getElementById("studentProfileClassroom");
      const codeEl = document.getElementById("studentProfileClassCode");
      const classroom = String(classEl?.value || "").trim();
      const classCode = String(codeEl?.value || "").trim();
      if (classroom && classCode) void loadStudentRoster();
    }, 350);
  }

  function showStudentProfileGate(onComplete) {
    const gate = document.getElementById("studentProfileGate");
    if (!gate) {
      onComplete?.();
      return;
    }
    pendingBootCallback = onComplete;
    show("title");
    gate.classList.remove("dw-hidden");
    const profile = State.loadProfile();
    const classEl = document.getElementById("studentProfileClassroom");
    const codeEl = document.getElementById("studentProfileClassCode");
    const firstEl = document.getElementById("studentProfileFirstName");
    const lastEl = document.getElementById("studentProfileLastInitial");
    const statusEl = document.getElementById("studentProfileRosterStatus");
    const errEl = document.getElementById("studentProfileError");
    errEl?.classList.add("dw-hidden");

    fetchClassrooms().then((rooms) => {
      if (!classEl) return;
      const selected = resolveClassroomOption(classEl, profile.lastClassroom || rooms[0] || "");
      classEl.innerHTML = rooms.map((r) => `<option value="${escapeHtml(r)}"${r === selected ? " selected" : ""}>${escapeHtml(r)}</option>`).join("");
      if (selected) classEl.value = selected;
      scheduleStudentRosterLoad();
    }).catch(() => {
      if (classEl) classEl.innerHTML = `<option value="">Could not load classrooms</option>`;
    });

    if (profile.lastName && firstEl && lastEl) {
      const parts = profile.lastName.split(/\s+/);
      if (parts.length >= 2) {
        firstEl.value = parts.slice(0, -1).join(" ");
        lastEl.value = parts[parts.length - 1].slice(0, 2);
      }
    }
    if (profile.lastClassroom && classEl) {
      const resolved = resolveClassroomOption(classEl, profile.lastClassroom);
      if (resolved) classEl.value = resolved;
    }
    if (codeEl) codeEl.value = getStoredClassCode() || codeEl.value || "";
    if (statusEl) statusEl.textContent = "";
    loadedRosterNames = [];
    renderStudentRosterList([]);
    firstEl?.focus();
  }

  function hideStudentProfileGate() {
    document.getElementById("studentProfileGate")?.classList.add("dw-hidden");
  }

  async function loadStudentRoster() {
    const classEl = document.getElementById("studentProfileClassroom");
    const codeEl = document.getElementById("studentProfileClassCode");
    const statusEl = document.getElementById("studentProfileRosterStatus");
    const errEl = document.getElementById("studentProfileError");
    const classroom = String(classEl?.value || "").trim();
    const classCode = String(codeEl?.value || "").trim();
    if (!classroom || !classCode) {
      toast("Pick your classroom and enter the class passcode first.", "lesson");
      return;
    }
    try {
      loadedRosterNames = await fetchRosterNames(classroom, classCode);
      fillStudentNameDatalist(loadedRosterNames);
      renderStudentRosterList(loadedRosterNames);
      if (statusEl) {
        statusEl.textContent = loadedRosterNames.length
          ? `${loadedRosterNames.length} names loaded — tap yours below or type it`
          : "No names found for this class yet.";
      }
      errEl?.classList.add("dw-hidden");
    } catch (e) {
      loadedRosterNames = [];
      renderStudentRosterList([]);
      if (statusEl) statusEl.textContent = "";
      if (errEl) {
        errEl.textContent = e.message || "Could not load roster.";
        errEl.classList.remove("dw-hidden");
      }
    }
  }

  async function confirmStudentProfile() {
    if (studentProfileSubmitting) return;
    const classEl = document.getElementById("studentProfileClassroom");
    const codeEl = document.getElementById("studentProfileClassCode");
    const firstEl = document.getElementById("studentProfileFirstName");
    const lastEl = document.getElementById("studentProfileLastInitial");
    const errEl = document.getElementById("studentProfileError");
    const btn = document.getElementById("studentProfileConfirmBtn");
    const classroom = String(classEl?.value || "").trim();
    const classCode = String(codeEl?.value || "").trim();
    const first = String(firstEl?.value || "").trim();
    const last = String(lastEl?.value || "").trim();

    if (!classroom || !classCode || !first || !last) {
      toast("Fill in classroom, passcode, and your name.", "lesson");
      return;
    }

    studentProfileSubmitting = true;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Checking roster…";
    }
    errEl?.classList.add("dw-hidden");

    try {
      const res = await fetch("/api/tech-trail/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classroom, classCode, firstName: first, lastInitial: last }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || "Roster check failed.");

      const profile = State.loadProfile();
      profile.lastName = data.name;
      profile.lastClassroom = data.classroom;
      profile.rosterVerified = true;
      profile.rosterVerifiedAt = Date.now();
      State.saveProfile(profile);
      storeClassCode(classCode);

      recordPedagogySession({
        eventType: "profile_start",
        detail: "Student profile confirmed at game start",
        performanceScore: 100,
        accuracyPct: 100,
      });

      hideStudentProfileGate();
      renderProfileMini();
      toast(`Welcome, ${data.name}!`, "badge");
      const boot = pendingBootCallback;
      pendingBootCallback = null;
      boot?.();
    } catch (e) {
      if (errEl) {
        errEl.textContent = e.message || "Could not verify your name on the roster.";
        errEl.classList.remove("dw-hidden");
      }
    } finally {
      studentProfileSubmitting = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Confirm & continue →";
      }
    }
  }

  function switchStudentProfile() {
    const profile = State.loadProfile();
    profile.rosterVerified = false;
    State.saveProfile(profile);
    storeClassCode("");
    showStudentProfileGate(() => {
      updateTitleLaunchUI();
      toast("Profile switched — your next run will use the new name.", "info");
    });
  }

  function ensurePedagogyProfile() {
    if (!typingProfile.pedagogy && Pedagogy) {
      typingProfile.pedagogy = Pedagogy.blankPedagogyProfile();
    }
    return typingProfile.pedagogy;
  }

  function recordPedagogySession(data) {
    if (!Pedagogy) return;
    ensurePedagogyProfile();
    const id = getStudentIdentity();
    Pedagogy.recordSession(typingProfile, {
      ...data,
      studentName: id.name || data.studentName || null,
      classroom: id.classroom || data.classroom || null,
      runId: id.runId || data.runId || null,
      node: data.node || currentNode || null,
    });
    saveTypingProfile();
    renderPedagogyProgress();
  }

  function renderPedagogyProgress() {
    const el = document.getElementById("pedagogyProgress");
    if (!el || !Pedagogy) return;
    if (document.getElementById("titleView")?.classList.contains("tt-view--active")) {
      el.classList.add("dw-hidden");
      el.innerHTML = "";
      return;
    }
    const ped = ensurePedagogyProfile();
    if (!ped.sessions && !ped.termsLearned.length) {
      el.classList.add("dw-hidden");
      return;
    }
    const tier = Pedagogy.staminaTier(ped);
    const terms = ped.termsLearned.map((id) => Pedagogy.CHAT_TERMS[id]?.term || id).filter(Boolean);
    el.innerHTML = `
      <p class="tt-pedagogy-progress__heading">Your communication progress</p>
      <div class="tt-pedagogy-progress__stats">
        <span>Stamina <strong>${escapeHtml(tier.label)}</strong></span>
        ${ped.bestAccuracyPct ? `<span>Best accuracy <strong>${ped.bestAccuracyPct}%</strong></span>` : ""}
        ${ped.bestPerformanceScore ? `<span>Best score <strong>${ped.bestPerformanceScore}</strong></span>` : ""}
        ${ped.accuracyStreak >= 2 ? `<span>Streak <strong>${ped.accuracyStreak}</strong></span>` : ""}
        ${ped.compositionUnlocks ? `<span>Compositions <strong>${ped.compositionUnlocks}</strong></span>` : ""}
        ${ped.transcriptionUnlocks ? `<span>Transcriptions <strong>${ped.transcriptionUnlocks}</strong></span>` : ""}
      </div>
      ${terms.length ? `<p class="tt-pedagogy-progress__terms">Chat terms learned: ${terms.join(", ")}</p>` : ""}
      ${ped.lastTip ? `<p class="tt-pedagogy-progress__tip">${escapeHtml(ped.lastTip)}</p>` : ""}
    `;
    el.classList.remove("dw-hidden");
  }

  function showDiagnosticPedagogyFeedback(cmp, inputVal) {
    const el = document.getElementById("diagnosticPedagogyFeedback");
    if (!el || !Pedagogy) return;
    const analysis = Pedagogy.classifyErrors(diagnosticPhrase, inputVal, cmp);
    const tip = Pedagogy.buildAdaptiveTip(analysis, diagnosticKeystrokeTracker?.getStats?.());
    const perf = Pedagogy.computePerformanceScore({
      accuracy: analysis.accuracy,
      usefulOutput: cmp.complete ? 1 : cmp.progress / 100,
      consistency: Pedagogy.consistencyFromKeystrokes(diagnosticKeystrokeTracker?.getStats?.()),
      speedFactor: 0.6,
    });
    recordPedagogySession({
      accuracyPct: analysis.accuracyPct,
      performanceScore: perf.score,
      errorCounts: analysis.counts,
      tip,
    });
    el.innerHTML = `
      <p class="tt-pedagogy-feedback__score">Communication score: <strong>${perf.score}</strong> (accuracy ${analysis.accuracyPct}% — not just speed)</p>
      <p class="tt-pedagogy-feedback__tip">${escapeHtml(tip)}</p>
    `;
    el.classList.remove("dw-hidden");
  }

  function openChatMission(missionId, onComplete) {
    const mission = Pedagogy?.CHAT_MISSIONS?.[missionId];
    const gate = document.getElementById("chatMissionGate");
    if (!mission || !gate) {
      onComplete?.();
      return;
    }
    if (completedChatMissions.has(missionId)) {
      onComplete?.();
      return;
    }
    pendingChatMission = mission;
    chatMissionCallback = onComplete;
    pendingToneScenario = null;
    toneMeterPassed = false;
    document.getElementById("toneMeter")?.classList.add("dw-hidden");
    document.getElementById("toneMeterLesson")?.classList.add("dw-hidden");
    document.getElementById("chatMissionIntro")?.classList.add("dw-hidden");
    document.getElementById("chatMissionSkill").textContent = mission.skill || "Digital literacy";
    document.getElementById("chatMissionTitle").textContent = mission.title;
    const thread = document.getElementById("chatMissionThread");
    if (thread) {
      thread.innerHTML = (mission.thread || []).map((m) => `
        <div class="tt-chat-bubble tt-chat-bubble--${m.from === "npc" ? "npc" : "you"}">
          <span class="tt-chat-bubble__name">${escapeHtml(m.name)}</span>
          <p>${escapeHtml(m.text)}</p>
        </div>
      `).join("");
    }
    const promptEl = document.getElementById("chatMissionPrompt");
    const inputEl = document.getElementById("chatMissionInput");
    const toneMissionMap = { misunderstood_tone: "whatever", short_k: "short_k" };
    const toneId = toneMissionMap[missionId];
    if (toneId && Pedagogy?.TONE_SCENARIOS?.[toneId]) {
      promptEl?.classList.add("dw-hidden");
      inputEl?.classList.add("dw-hidden");
      showToneMeter(toneId);
    } else {
      promptEl?.classList.remove("dw-hidden");
      inputEl?.classList.remove("dw-hidden");
      if (promptEl) promptEl.textContent = mission.prompt;
    }
    const regEl = document.getElementById("chatMissionRegister");
    if (regEl && mission.registerExamples) {
      regEl.innerHTML = `
        <p class="tt-chat-mission__register-title">Different audiences, different register:</p>
        <ul class="tt-chat-mission__register-list">
          ${Object.entries(mission.registerExamples).map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`).join("")}
        </ul>
      `;
      regEl.classList.remove("dw-hidden");
    } else {
      regEl?.classList.add("dw-hidden");
    }
    const input = document.getElementById("chatMissionInput");
    if (input) input.value = "";
    document.getElementById("chatMissionFeedback")?.classList.add("dw-hidden");
    gate.classList.remove("dw-hidden");
    gate.setAttribute("aria-hidden", "false");
    document.body.classList.add("tt-chat-mission-active");
    if (!toneId) setTimeout(() => input?.focus(), 200);
  }

  function closeChatMission() {
    const gate = document.getElementById("chatMissionGate");
    gate?.classList.add("dw-hidden");
    gate?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tt-chat-mission-active");
    pendingChatMission = null;
    chatMissionCallback = null;
  }

  function submitChatMission() {
    if (!pendingChatMission || !Pedagogy) return;
    const input = document.getElementById("chatMissionInput");
    const feedback = document.getElementById("chatMissionFeedback");
    if (pendingToneScenario && !toneMeterPassed) {
      if (feedback) {
        feedback.textContent = "Pick how the message might be read before you rewrite it.";
        feedback.classList.remove("dw-hidden");
      }
      return;
    }
    if (pendingToneScenario?.scenario?.revisionPatterns) {
      const raw = String(input?.value || "").trim();
      const ok = pendingToneScenario.scenario.revisionPatterns.some((pat) => pat.test(raw));
      if (!ok) {
        if (feedback) {
          feedback.textContent = "Add warmth and context — short replies are easy to misread.";
          feedback.classList.remove("dw-hidden");
        }
        return;
      }
    }
    const result = Pedagogy.scoreChatResponse(pendingChatMission, input?.value || "");
    if (!result.passed) {
      if (feedback) {
        feedback.textContent = result.reason;
        feedback.classList.remove("dw-hidden");
      }
      return;
    }
    const term = Pedagogy.CHAT_TERMS[pendingChatMission.termId];
    completedChatMissions.add(pendingChatMission.id);
    recordPedagogySession({
      accuracyPct: 95,
      performanceScore: 88,
      tip: pendingChatMission.toneNote,
      termId: pendingChatMission.termId,
      chatMissionId: pendingChatMission.id,
    });
    toast(term ? `Learned: ${term.term} = ${term.meaning}` : "Message sent!", "lesson");
    journal.push(`💬 Chat mission: ${pendingChatMission.title}`);
    const cb = chatMissionCallback;
    const missionId = pendingChatMission.id;
    closeChatMission();
    cb?.();
  }

  function maybeRunChatMission(node, nodeId, then) {
    const missionId = node?.chatMission;
    if (!missionId || completedChatMissions.has(missionId)) {
      then?.();
      return;
    }
    openChatMission(missionId, then);
  }

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

  function openPhraseTrackPicker(onPick) {
    const picker = document.getElementById("phraseTrackPicker");
    if (!picker) {
      phraseTrack = phraseTrack || "citizen";
      onPick?.(phraseTrack);
      return;
    }
    const shell = document.querySelector(".dw-shell.tt-shell");
    if (shell && picker.parentElement !== shell) shell.appendChild(picker);
    const citizen = window.TechTrailPhraseTracks?.citizen;
    const spark = window.TechTrailPhraseTracks?.spark;
    const citizenBtn = document.getElementById("phraseTrackCitizen");
    const sparkBtn = document.getElementById("phraseTrackSpark");
    const citizenLabel = document.getElementById("phraseTrackCitizenLabel");
    const sparkLabel = document.getElementById("phraseTrackSparkLabel");
    if (citizenLabel && citizen) citizenLabel.textContent = citizen.title;
    if (sparkLabel && spark) sparkLabel.textContent = spark.title;
    const citizenBlurb = document.getElementById("phraseTrackCitizenBlurb");
    const sparkBlurb = document.getElementById("phraseTrackSparkBlurb");
    if (citizenBlurb && citizen) citizenBlurb.textContent = citizen.blurb;
    if (sparkBlurb && spark) sparkBlurb.textContent = spark.blurb;

    const choose = (track) => {
      phraseTrack = track;
      picker.classList.add("dw-hidden");
      picker.setAttribute("aria-hidden", "true");
      citizenBtn?.removeEventListener("click", onCitizen);
      sparkBtn?.removeEventListener("click", onSpark);
      onPick?.(track);
    };
    const onCitizen = () => choose("citizen");
    const onSpark = () => choose("spark");
    citizenBtn?.addEventListener("click", onCitizen);
    sparkBtn?.addEventListener("click", onSpark);
    picker.classList.remove("dw-hidden");
    picker.setAttribute("aria-hidden", "false");
  }

  function promptPhraseTrackThen(next) {
    openPhraseTrackPicker(() => next?.());
  }

  function startMissionCore() {
    const track = phraseTrack;
    hideDiagnostic();
    show("game");
    resetRun();
    phraseTrack = track || "citizen";
    renderFragmentTracker();
    showSceneLoader();
    setTimeout(() => {
      renderScene("start").catch((err) => {
        console.error("[GTG] Failed to load start scene:", err);
        toast("Mission failed to load. Tap Play mission to try again.", "lesson");
      });
      hideSceneLoader();
      updateTitleLaunchUI();
    }, SCENE_LOADER_MIN_MS);
  }

  function updateTitleLaunchUI() {
    const isNew = !typingProfile.diagnosed;
    const hasRun = State.hasActiveRun();
    const welcome = document.getElementById("titleWelcome");
    const titleMain = document.getElementById("titleMain");
    const titleNewLaunch = document.getElementById("titleNewLaunch");
    const typingMenu = document.getElementById("titleTypingMenu");
    const startBtn = document.getElementById("startGameBtn");
    const startLabel = document.getElementById("startGameBtnLabel");
    const startHint = document.getElementById("startGameBtnHint");
    const continueBtn = document.getElementById("continueRunBtn");
    const newRunBtn = document.getElementById("newRunBtn");

    if (isNew) {
      welcome?.classList.remove("dw-hidden");
      titleMain?.classList.add("dw-hidden");
      titleNewLaunch?.classList.remove("dw-hidden");
      typingMenu?.classList.add("dw-hidden");
      if (startLabel) startLabel.textContent = "Start keystroke test";
      if (startHint) startHint.textContent = "Required before your first mission";
      startBtn?.setAttribute("aria-label", "Begin keystroke test — required for new players");
    } else {
      welcome?.classList.add("dw-hidden");
      titleMain?.classList.remove("dw-hidden");
      titleNewLaunch?.classList.add("dw-hidden");
      typingMenu?.classList.remove("dw-hidden");
      renderTitleTypingMenu();
    }

    renderTitleGoldenPreview();

    if (hasRun) {
      continueBtn?.classList.remove("dw-hidden");
      newRunBtn?.classList.remove("dw-hidden");
    } else {
      continueBtn?.classList.add("dw-hidden");
      newRunBtn?.classList.remove("dw-hidden");
    }
    fitTitleScreenScale();
  }

  function fitTitleScreenScale() {
    const content = document.querySelector(".tt-title-screen__content");
    const titleView = document.getElementById("titleView");
    if (!content || !titleView?.classList.contains("tt-view--active")) return;

    content.style.transform = "";
    content.style.width = "";
    content.style.maxHeight = "";

    const vh = window.visualViewport?.height || window.innerHeight;
    const vw = window.visualViewport?.width || window.innerWidth;
    content.style.setProperty("--tt-title-vh", `${vh}px`);
    content.style.setProperty("--tt-title-vw", `${vw}px`);

    const main = document.getElementById("titleMain");
    const welcome = document.getElementById("titleWelcome");
    const bodyRegion = main && !main.classList.contains("dw-hidden") ? main : welcome;
    if (bodyRegion) bodyRegion.style.maxHeight = "";

    const hero = content.querySelector(".tt-title-hero");
    const footer = content.querySelector(".tt-title-footer");
    const newLaunch = document.getElementById("titleNewLaunch");
    const launchBar = document.getElementById("titleLaunchBar");
    const reserved =
      (hero?.offsetHeight ?? 0)
      + (footer?.offsetHeight ?? 0)
      + (newLaunch && !newLaunch.classList.contains("dw-hidden") ? newLaunch.offsetHeight : 0)
      + 8;
    const available = vh - reserved;
    if (bodyRegion && available > 120) {
      bodyRegion.style.maxHeight = `${Math.floor(available)}px`;
    }
    if (main && !main.classList.contains("dw-hidden")) {
      main.style.display = "grid";
      main.style.gridTemplateColumns = "minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 1fr)";
      main.style.width = "100%";
      main.style.maxWidth = "none";
    } else if (main) {
      main.style.display = "";
      main.style.gridTemplateColumns = "";
      main.style.width = "";
      main.style.maxWidth = "";
    }
  }

  function openDiagnosticForLaunch(onComplete) {
    pendingDiagnosticAction = onComplete;
    const overlay = document.getElementById("diagnosticOverlay");
    if (overlay && !overlay.classList.contains("dw-hidden")) {
      setTimeout(() => document.getElementById("diagnosticInput")?.focus(), 60);
      return;
    }
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
    const liveCpm = duration > 0 && cmp.correctCount > 0
      ? Typing.computeCpm(cmp.correctCount, duration, { mode: "live" })
      : 0;
    updateTypingMeterUI({
      progressPct: cmp.progress,
      liveCpm,
      targetCpm: Typing.MAX_TEST_CPM || 120,
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
      const cpm = Typing.computeCpm(cmp.correctCount, duration, { mode: "diagnostic" });
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
      showDiagnosticPedagogyFeedback(cmp, input.value);
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

  let warmupPhrases = [];
  let warmupIndex = 0;
  let warmupCallback = null;
  let warmupStartTime = 0;
  let pendingToneScenario = null;
  let toneMeterPassed = false;

  function openWarmupThen(callback) {
    if (!Pedagogy || !typingProfile.diagnosed) {
      callback?.();
      return;
    }
    const ped = ensurePedagogyProfile();
    warmupPhrases = Pedagogy.pickWarmupDrills(ped, 3);
    warmupIndex = 0;
    warmupCallback = callback;
    const gate = document.getElementById("warmupGate");
    if (!gate || !warmupPhrases.length) {
      callback?.();
      return;
    }
    // Warm-up must live outside #gameView — that section is hidden on the title screen.
    const shell = document.querySelector(".dw-shell.tt-shell");
    if (shell && gate.parentElement !== shell) shell.appendChild(gate);
    const tip = Pedagogy.buildAdaptiveTip(
      { counts: ped.errorTotals },
      null
    );
    document.getElementById("warmupTip").textContent = tip;
    gate.classList.remove("dw-hidden");
    gate.setAttribute("aria-hidden", "false");
    document.body.classList.add("tt-warmup-active");
    renderWarmupPhrase();
  }

  function closeWarmup() {
    document.getElementById("warmupGate")?.classList.add("dw-hidden");
    document.getElementById("warmupGate")?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("tt-warmup-active");
    const cb = warmupCallback;
    warmupCallback = null;
    cb?.();
  }

  function renderWarmupPhrase() {
    const phrase = warmupPhrases[warmupIndex];
    document.getElementById("warmupProgress").textContent = `Phrase ${warmupIndex + 1} of ${warmupPhrases.length}`;
    document.getElementById("warmupGhost").innerHTML = Typing.renderGhostHtml(phrase, 0);
    const input = document.getElementById("warmupInput");
    if (input) {
      input.value = "";
      input.disabled = false;
      warmupStartTime = 0;
      setTimeout(() => input.focus(), 120);
    }
    document.getElementById("warmupTyped").innerHTML = "";
  }

  function handleWarmupInput() {
    const input = document.getElementById("warmupInput");
    const phrase = warmupPhrases[warmupIndex];
    if (!input || !phrase) return;
    if (!warmupStartTime && input.value.length) warmupStartTime = performance.now();
    const cmp = Typing.compareToTarget(phrase, input.value);
    document.getElementById("warmupGhost").innerHTML = Typing.renderGhostHtml(phrase, input.value.length);
    document.getElementById("warmupTyped").innerHTML = Typing.renderTypedCharsHtml(cmp.chars, 0);
    if (!cmp.complete) return;
    const analysis = Pedagogy?.classifyErrors(phrase, input.value, cmp);
    recordPedagogySession({
      accuracyPct: analysis?.accuracyPct ?? 100,
      performanceScore: analysis ? Math.round(analysis.accuracy * 100) : 90,
      errorCounts: analysis?.counts,
      warmupCompleted: warmupIndex === warmupPhrases.length - 1,
    });
    input.disabled = true;
    warmupIndex += 1;
    if (warmupIndex >= warmupPhrases.length) {
      toast("Warm-up complete — mission ready!", "badge");
      setTimeout(closeWarmup, prefersReducedMotion ? 0 : 600);
    } else {
      setTimeout(renderWarmupPhrase, prefersReducedMotion ? 0 : 500);
    }
  }

  function showToneMeter(scenarioId, onPass) {
    const scenario = Pedagogy?.TONE_SCENARIOS?.[scenarioId];
    const meter = document.getElementById("toneMeter");
    if (!scenario || !meter) {
      onPass?.();
      return;
    }
    pendingToneScenario = { scenario, onPass };
    toneMeterPassed = false;
    meter.classList.remove("dw-hidden");
    document.getElementById("chatMissionPrompt")?.classList.add("dw-hidden");
    document.getElementById("chatMissionInput")?.classList.add("dw-hidden");
    document.getElementById("toneMeterMessage").textContent = `"${scenario.message}"`;
    document.getElementById("toneMeterContext").textContent = scenario.context;
    const opts = document.getElementById("toneMeterOptions");
    opts.innerHTML = scenario.interpretations.map((opt) =>
      `<button type="button" class="tt-tone-meter__btn" data-id="${escapeHtml(opt.id)}">${escapeHtml(opt.label)}</button>`
    ).join("");
    opts.querySelectorAll(".tt-tone-meter__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pick = scenario.interpretations.find((o) => o.id === btn.dataset.id);
        const lessonEl = document.getElementById("toneMeterLesson");
        if (pick?.correct) {
          lessonEl.textContent = scenario.lesson + " Now type a better version below.";
          lessonEl.classList.remove("dw-hidden");
          toneMeterPassed = true;
          document.getElementById("chatMissionPrompt")?.classList.remove("dw-hidden");
          document.getElementById("chatMissionInput")?.classList.remove("dw-hidden");
          document.getElementById("chatMissionPrompt").textContent = scenario.revisionPrompt;
          document.getElementById("chatMissionInput").value = "";
          document.getElementById("chatMissionInput")?.focus();
        } else {
          lessonEl.textContent = "That reading is possible — text is ambiguous. " + scenario.lesson;
          lessonEl.classList.remove("dw-hidden");
        }
      });
    });
  }

  function startGuildQuest() {
    if (!Pedagogy) return;
    const ped = ensurePedagogyProfile();
    const step = Pedagogy.guildQuestStep(ped);
    if (!step) {
      toast("Chat Quest complete — you know the guild lingo!", "badge");
      return;
    }
    document.getElementById("chatMissionIntro").textContent = step.intro;
    document.getElementById("chatMissionIntro").classList.remove("dw-hidden");
    openChatMission(step.missionId, () => {
      ped.guildQuestStep = step.index + 1;
      saveTypingProfile();
      renderPedagogyProgress();
      const next = Pedagogy.guildQuestStep(ped);
      if (next) toast("Next guild mission ready — tap Chat Quest again.", "lesson");
    });
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

  function choiceFinishesRoom(choice) {
    const next = STORY?.[choice?.next];
    if (!next) return false;
    if (next.badge || next.goldenRule) return true;
    if (String(choice.next).includes("_win")) return true;
    if (next.lesson && !next.typingChallenge) return true;
    return false;
  }

  function triggerGlitchIfWrong(choice) {
    window.TechTrailGlitch?.onWrongChoice?.(choice);
  }

  function isWrongChoice(choice) {
    if (choice?.risky) return true;
    if (typeof choice?.integrity === "number" && choice.integrity < 0) return true;
    return /recovery|_fail|wrong/i.test(String(choice?.next || ""));
  }

  function triggerMissionFailure(reason) {
    journal.push(`🚨 Mission suspended — ${reason}`);
    toast("Mission failed — too many wrong calls. Play again!", "lesson");
    window.TechTrailGlitch?.onWrongChoice?.({ integrity: -20, next: "mission_fail" });
    setTimeout(() => {
      navigate("mission_fail", { skipRhythm: true, direct: true });
    }, prefersReducedMotion ? 0 : 1200);
  }

  function registerStrike(choice) {
    if (!isWrongChoice(choice)) return false;
    strikes = Math.min(MAX_STRIKES, strikes + 1);
    journal.push(`⚠️ Strike ${strikes}/${MAX_STRIKES}`);
    toast(`Strike ${strikes}/${MAX_STRIKES}! Wrong choices end runs.`, "lesson");
    updateStrikeMeter();
    return strikes >= MAX_STRIKES;
  }

  function processChoiceConsequences(choice) {
    applyChoiceEffects(choice);
    triggerGlitchIfWrong(choice);
    if (integrity <= 0) {
      triggerMissionFailure("integrity hit zero");
      return true;
    }
    if (registerStrike(choice)) {
      triggerMissionFailure(`${MAX_STRIKES} strikes`);
      return true;
    }
    return false;
  }

  function updateStrikeMeter() {
    const el = document.getElementById("strikeMeter");
    if (!el) return;
    el.className = `tt-strike-meter${strikes >= MAX_STRIKES - 1 ? " tt-strike-meter--danger" : ""}`;
    el.title = `Strikes ${strikes}/${MAX_STRIKES} — wrong choices end the run`;
    el.innerHTML = Array.from({ length: MAX_STRIKES }, (_, i) =>
      `<span class="tt-strike-dot${i < strikes ? " tt-strike-dot--lit" : ""}"></span>`
    ).join("");
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

        if (processChoiceConsequences(choice)) return;
        navigate(choice.next, { finishRhythm: choiceFinishesRoom(choice) });
      });
    });
    syncImmersiveTypingOverlay();
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
    const budget = typoBudget();
    const allShort = branches.length > 0 && branches.every((t) => Typing.isShortTranscriptionPath?.(t));
    if (hint) {
      hint.textContent = allShort
        ? "Type the room name to pick your path — accuracy unlocks your choice."
        : `Type the full highlighted path. Accuracy unlocks your choice · ${budget >= 10 ? "typos forgiven" : `up to ${budget} typo${budget === 1 ? "" : "s"}`}`;
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
    if (!isImmersiveRail()) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
    else if (touchMode) scrollTypingIntoView(input);
    syncImmersiveTypingOverlay();
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
    const errorAnalysis = Typing.classifyErrors?.(typeText, input.value, cmp) || { accuracy: 0.9 };
    const shortPath = Typing.isShortTranscriptionPath?.(typeText) ?? (cmp.targetLength <= 24);
    const speedGateRatio = Typing.scaledSpeedGateRatio?.(cfg.speedGate, cmp.targetLength) ?? cfg.speedGate;
    const pathComplete = Typing.isChoiceComplete
      ? Typing.isChoiceComplete(cmp, typoBudget())
      : Boolean(cmp.complete);
    const transcriptionEval = Pedagogy?.evaluateTranscriptionUnlock
      ? Pedagogy.evaluateTranscriptionUnlock(cmp, {
          target: typeText,
          input: input.value,
          typoBudget: typoBudget(),
          liveCpm,
          targetCpm: typingProfile.targetCpm,
          speedGate: cfg.speedGate,
          tier: difficulty,
          consistency: Pedagogy.consistencyFromKeystrokes?.(null),
          pathComplete,
          shortPath,
        })
      : null;
    const speedOk = transcriptionEval?.speedOk ?? Typing.meetsSpeedGate(liveCpm, typingProfile.targetCpm, speedGateRatio);
    const unlocked = transcriptionEval?.unlocked ?? (pathComplete && (speedOk || shortPath));

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
      complete: unlocked,
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

    if (!unlocked) {
      const accPct = errorAnalysis.accuracyPct ?? Math.round((errorAnalysis.accuracy || 0) * 100);
      if (hint) {
        if (accPct < 88 && difficulty !== "cadet") {
          hint.textContent = `Fix typos — accuracy ${accPct}% (need ~88%+). Speed is not the gate here.`;
        } else if (shortPath) {
          hint.textContent = pathComplete
            ? `Fix typos — accuracy ${accPct}% (need ~88%+). Short paths unlock on accuracy, not speed.`
            : `Type the full highlighted path — short choices unlock on accuracy, not speed.`;
        } else if (difficulty === "analyst" && !speedOk) {
          const need = Math.round(typingProfile.targetCpm * speedGateRatio);
          hint.textContent = `Analyst tier: hit ${need} keys/min after the path is accurate (${liveCpm} now).`;
        } else {
          hint.textContent = `Almost — accuracy ${accPct}%. Keep going.`;
        }
      }
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
    if (transcriptionEval && Pedagogy) {
      recordPedagogySession({
        accuracyPct: errorAnalysis.accuracyPct,
        performanceScore: transcriptionEval.performanceScore,
        errorCounts: errorAnalysis.counts,
        tip: Pedagogy.buildAdaptiveTip(errorAnalysis, null),
        transcriptionUnlock: true,
      });
    }
    if (hint) hint.textContent = "Path unlocked!";
    document.getElementById("typingChoices")?.classList.add("tt-typing-choices--unlock");

    const choiceData = resolved.choice;
    const label = choiceData.label || typeText;
    journal.push(`⌨️ ${label.slice(0, 80)}${label.length > 80 ? "…" : ""}`);

    setTimeout(() => {
      if (processChoiceConsequences(choiceData)) return;
      navigate(choiceData.next, { finishRhythm: choiceFinishesRoom(choiceData) });
    }, prefersReducedMotion ? 0 : 1000);
  }

  function getTitleChoices() {
    if (State.hasActiveRun()) {
      return [
        { typeText: "CONTINUE MISSION", action: "continue" },
        { typeText: "NEW MISSION", action: "newrun" },
      ];
    }
    return [{ typeText: "NEW MISSION", action: "newrun" }];
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
        progressPct: titlePrefixProgress(input.value, options[0] || "NEW MISSION"),
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
    if (!State.hasRosterProfile()) {
      showStudentProfileGate(() => beginStartMission());
      return;
    }
    Audio?.init?.();
    requestGameFullscreen().then(updateFullscreenButton);
    if (!typingProfile.diagnosed) {
      openDiagnosticForLaunch(() => openWarmupThen(() => promptPhraseTrackThen(() => startMissionCore())));
      return;
    }
    openWarmupThen(() => promptPhraseTrackThen(() => startMissionCore()));
  }

  function beginContinueMission() {
    if (!State.hasRosterProfile()) {
      showStudentProfileGate(() => beginContinueMission());
      return;
    }
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
      completedRooms = normalizeCompletedRooms(saved.completedRooms);
      goldenQuizPassed = Boolean(saved.goldenQuizPassed);
      dataFragments = saved.dataFragments || [];
      mentorPackets = saved.mentorPackets || [];
      journal = saved.journal;
      metCharacters = saved.metCharacters;
      visitedRooms = saved.visitedRooms instanceof Set ? saved.visitedRooms : new Set(saved.visitedRooms || [currentNode]);
      if (saved.unlockedRooms instanceof Set && saved.unlockedRooms.size) {
        unlockedRooms = saved.unlockedRooms;
      } else if (Array.isArray(saved.unlockedRooms) && saved.unlockedRooms.length) {
        unlockedRooms = new Set(saved.unlockedRooms);
      } else {
        unlockedRooms = Visuals.deriveUnlockedRooms?.([...visitedRooms], [...completedRooms]) || new Set(["start"]);
      }
      integrity = saved.integrity ?? 100;
      reputation = saved.reputation ?? 50;
      mentorTrust = saved.mentorTrust || {};
      strikes = saved.strikes ?? 0;
      completedMinigames = saved.completedMinigames instanceof Set
        ? saved.completedMinigames
        : new Set(saved.completedMinigames || []);
      phraseTrack = saved.phraseTrack === "spark" ? "spark" : saved.phraseTrack === "citizen" ? "citizen" : null;
      startTime = saved.startedAt || Date.now();
      hideDiagnostic();
      show("game");
      renderFragmentTracker();
      showSceneLoader();
      setTimeout(() => {
        renderScene(currentNode).catch((err) => {
          console.error("[GTG] Failed to load saved scene:", err);
        });
        hideSceneLoader();
      updateStrikeMeter();
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
    openWarmupThen(() => promptPhraseTrackThen(() => startMissionCore()));
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
    const ped = ensurePedagogyProfile();
    const staminaBase = Pedagogy?.staminaMinWords
      ? Pedagogy.staminaMinWords(base, ped)
      : base;
    return Math.max(3, Math.round(staminaBase * cfg.wordMult));
  }

  function nextSpineMission() {
    const spine = GOLDEN_SPINE || [];
    return spine.find((s) => !goldenRules.has(s.rule)) || null;
  }

  function buildStartChoices() {
    const missions = shuffle((START_MISSIONS || []).map((m) => ({ ...m })));
    if (visitedRooms.size > 1) {
      missions.push({
        label: "Ask Mr. Phil why he built the Gauntlet",
        next: "guide_deep",
        typeText: "Host Deep Dive",
      });
    }
    return missions;
  }

  function enhanceChoices(node, nodeId, choices) {
    const list = (choices || []).map((c) => ({ ...c }));
    if (!list.length || node.dynamicChoices === "start" || nodeId === "start") return list;

    const spine = nextSpineMission();

    const mapped = list.map((c) => {
      const blockFinale = c.next === "final_trial" && !canReachFinalTrial();
      const blockMentor = c.next === "mentor_ending" && goldenRules.size < 5;
      if ((blockFinale || blockMentor) && spine) {
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

  function clickChoicePreferred() {
    try {
      return localStorage.getItem("techtrail:clickChoices") === "1";
    } catch {
      return false;
    }
  }

  function loadClickChoiceMode() {
    updateClickChoiceButton();
  }

  function updateClickChoiceButton() {
    const btn = document.getElementById("clickChoiceToggle");
    if (!btn) return;
    const on = clickChoicePreferred();
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.classList.toggle("tt-settings-btn--on", on);
    btn.textContent = on ? "🖱️ Click choices on" : "🖱️ Click choices";
  }

  function toggleClickChoiceMode() {
    const on = !clickChoicePreferred();
    try { localStorage.setItem("techtrail:clickChoices", on ? "1" : "0"); } catch {}
    updateClickChoiceButton();
    toast(on ? "Choices will use buttons instead of typing." : "Choices will use typing again.", "info");
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
    const studentChip = profile.rosterVerified && profile.lastName
      ? `<span class="tt-profile-chip">🧑‍🚀 ${escapeHtml(profile.lastName)} · ${escapeHtml(profile.lastClassroom || "")}</span>`
      : "";
    el.innerHTML = `
      <div class="tt-profile-mini">
        ${studentChip}
        <span class="tt-profile-chip">🎖️ ${runs} run${runs === 1 ? "" : "s"}</span>
        <span class="tt-profile-chip">🏅 ${badges} badge${badges === 1 ? "" : "s"}</span>
        <span class="tt-profile-chip">👥 ${mentors} mentor${mentors === 1 ? "" : "s"}</span>
      </div>`;
  }

  function withStudentRunFields(payload) {
    const id = getStudentIdentity();
    return {
      ...payload,
      studentName: id.name || payload.studentName || "",
      classroom: id.classroom || payload.classroom || "",
    };
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

    if (name === "game") {
      window.TechTrailGlitch?.reset?.();
      requestAnimationFrame(() => window.__gtgWorld3D?.resize?.());
      setTimeout(() => window.__gtgWorld3D?.resize?.(), 400);
    } else {
      document.body.classList.remove("tt-3d");
      document.getElementById("gameView")?.classList.remove("tt-game-layout--immersive");
      window.TechTrailGlitch?.reset?.();
    }

    if (activeView) {
      const prev = activeView;
      viewTransitionTimer = setTimeout(() => {
        const prevEl = views[prev];
        if (prevEl && activeView !== prev) prevEl.classList.add("dw-hidden");
        viewTransitionTimer = null;
        if (name === "game") window.__gtgWorld3D?.resize?.();
      }, 350);
    }

    activeView = name;
    if (name === "title") {
      requestAnimationFrame(() => {
        fitTitleScreenScale();
        setTimeout(fitTitleScreenScale, 120);
      });
    }
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

  const TITLE_CORRUPT_ICONS = ["░", "▒", "▓", "█", "╳", "¿", "¤"];

  function titleGarbleSeed(ruleN, salt = 0) {
    return ruleN * 97 + salt * 31;
  }

  function titleSeededUnit(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function jumbleRuleName(name, ruleN) {
    return String(name || "")
      .split(" ")
      .map((word, wi) => {
        const chars = [...word];
        if (chars.length < 2) return word;
        for (let i = chars.length - 1; i > 0; i--) {
          const j = Math.floor(titleSeededUnit(titleGarbleSeed(ruleN, wi + 1) + i) * (i + 1));
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        let result = chars.join("");
        if (result.toLowerCase() === word.toLowerCase() && chars.length > 2) {
          result = chars.slice(1).join("") + chars[0];
        }
        return result;
      })
      .join(" ");
  }

  function corruptRuleText(text, ruleN) {
    const glitch = ["█", "▓", "░", "▒", "¿", "§", "¤", "þ", "╳", "⌐", "▌", "▀", "╬"];
    const symbols = "#@$%&*?/~\\|^<>{}[]═║";
    return [...String(text || "")].map((ch, i) => {
      if (ch === " " || ch === "—") {
        return ch === " " && titleSeededUnit(titleGarbleSeed(ruleN, i + 3)) < 0.1 ? "_" : ch;
      }
      const r = titleSeededUnit(titleGarbleSeed(ruleN, i + 5));
      if (r < 0.2) return glitch[Math.floor(titleSeededUnit(titleGarbleSeed(ruleN, i + 7)) * glitch.length)];
      if (r < 0.34) return symbols[Math.floor(titleSeededUnit(titleGarbleSeed(ruleN, i + 11)) * symbols.length)];
      if (r < 0.48) return ch;
      return String.fromCharCode(33 + Math.floor(titleSeededUnit(titleGarbleSeed(ruleN, i + 13)) * 94));
    }).join("");
  }

  function titleGoldenRulesUnlocked() {
    return State.hasBeatenGame?.() ?? false;
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
    container.querySelectorAll(".tt-golden-list__item, .tt-golden-orb--interactive").forEach((btn) => {
      btn.addEventListener("click", () => {
        const unlocked = titleGoldenRulesUnlocked();
        const n = Number(btn.dataset.ruleN);
        const rule = Visuals.GOLDEN_RULES.find((r) => r.n === n);
        if (!rule) return;
        container.querySelectorAll(".tt-golden-list__item, .tt-golden-orb--interactive").forEach((b) => {
          b.classList.remove("tt-golden-orb--selected", "tt-golden-list__item--selected");
          b.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("tt-golden-list__item--selected");
        btn.setAttribute("aria-pressed", "true");
        if (detail) {
          detail.classList.remove("dw-hidden");
          detail.classList.toggle("tt-golden-rule-detail--corrupted", !unlocked);
          if (unlocked) {
            detail.innerHTML = `<div class="tt-golden-rule-detail__badge">Golden Rule ${rule.n}</div>
              <strong class="tt-golden-rule-detail__title">${escapeHtml(rule.short)}</strong>
              <p class="tt-golden-rule-detail__body">${escapeHtml(rule.detail || rule.short)}</p>
              ${rule.learnLine ? `<p class="tt-golden-rule-detail__hint">${escapeHtml(rule.learnLine)}</p>` : ""}
              <p class="tt-golden-rule-detail__hint">Recover this rule during your mission by making smart digital choices.</p>`;
            toast(`Golden Rule ${rule.n}: ${rule.short}`, "lesson");
            Audio?.playPathUnlock?.();
            burstConfetti(8);
          } else {
            const garbledName = jumbleRuleName(rule.short, rule.n);
            detail.innerHTML = `<div class="tt-golden-rule-detail__badge tt-golden-rule-detail__badge--corrupt">Fragment ${rule.n} · signal corrupt</div>
              <strong class="tt-golden-rule-detail__title tt-golden-rule-detail__title--corrupt">${escapeHtml(garbledName)}</strong>
              <p class="tt-golden-rule-detail__body tt-golden-rule-detail__body--corrupt">${escapeHtml(corruptRuleText(rule.detail || rule.short, rule.n))}</p>
              <p class="tt-golden-rule-detail__hint tt-golden-rule-detail__hint--corrupt">${escapeHtml(corruptRuleText(rule.learnLine || "Data unreadable until gauntlet complete.", rule.n + 9))}</p>
              <p class="tt-golden-rule-detail__hint">Beat the Global Tech Gauntlet to decode the five Golden Rules.</p>`;
            toast(`Encrypted fragment ${rule.n} — finish the gauntlet to decode`, "info");
            window.TechTrailGlitch?.onWrongChoice?.({ label: "corrupt fragment" });
          }
        }
      });
    });
  }

  function renderTitleGoldenPreview() {
    const container = document.getElementById("titleGoldenPreview");
    if (!container) return;
    const unlocked = titleGoldenRulesUnlocked();
    const heading = document.querySelector(".tt-golden-preview__heading");
    const rulesPanel = document.querySelector(".tt-title-panel--rules");
    if (heading) heading.textContent = unlocked ? "Golden Rules" : "Corrupted fragments";
    rulesPanel?.classList.toggle("tt-title-panel--rules-corrupted", !unlocked);
    container.innerHTML = Visuals.GOLDEN_RULES.map((rule) => {
      const label = unlocked ? rule.short : jumbleRuleName(rule.short, rule.n);
      const icon = unlocked ? rule.icon : TITLE_CORRUPT_ICONS[rule.n % TITLE_CORRUPT_ICONS.length];
      const itemClass = unlocked ? "tt-golden-list__item" : "tt-golden-list__item tt-golden-list__item--corrupted";
      const aria = unlocked
        ? `Golden Rule ${rule.n}: ${rule.short}`
        : `Encrypted fragment ${rule.n}: ${label}`;
      return `
      <li>
        <button type="button" class="${itemClass}" data-rule-n="${rule.n}" aria-label="${escapeHtml(aria)}" aria-pressed="false">
          <span class="tt-golden-list__icon" aria-hidden="true">${icon}</span>
          <span class="tt-golden-list__text">${escapeHtml(label)}</span>
        </button>
      </li>`;
    }).join("");
    document.getElementById("goldenRuleDetail")?.classList.add("dw-hidden");
    wireTitleGoldenRules();
  }

  let scenePanelHome = null;

  function isImmersiveRail() {
    return document.getElementById("gameView")?.classList.contains("tt-game-layout--immersive") ?? false;
  }

  function scrollTypingIntoView(el) {
    if (!el) return;
    if (touchMode || isImmersiveRail()) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), touchMode ? 320 : 80);
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function initTouchMode() {
    if (!touchMode) return;

    document.querySelector(".tt-world-controls__desktop")?.classList.add("dw-hidden");
    document.querySelector(".tt-world-controls__touch")?.classList.remove("dw-hidden");

    const bindTypingFocus = (el) => {
      if (!el || el.dataset.ttTouchFocus) return;
      el.dataset.ttTouchFocus = "1";
      el.addEventListener("focus", () => scrollTypingIntoView(el));
    };
    document.querySelectorAll(".tt-typing-input, .tt-textarea, .tt-fast-travel__input, .dw-input").forEach(bindTypingFocus);
    new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.(".tt-typing-input, .tt-textarea, .tt-fast-travel__input, .dw-input")) bindTypingFocus(node);
          node.querySelectorAll?.(".tt-typing-input, .tt-textarea, .tt-fast-travel__input, .dw-input").forEach(bindTypingFocus);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });

    const syncKeyboardOpen = () => {
      const vv = window.visualViewport;
      const open = !!(vv && vv.height < window.innerHeight * 0.78);
      document.body.classList.toggle("tt-keyboard-open", open);
      if (open && vv) {
        document.documentElement.style.setProperty("--tt-vv-height", `${vv.height}px`);
        document.documentElement.style.setProperty("--tt-vv-offset-top", `${vv.offsetTop}px`);
      } else {
        document.documentElement.style.removeProperty("--tt-vv-height");
        document.documentElement.style.removeProperty("--tt-vv-offset-top");
      }
    };
    window.visualViewport?.addEventListener("resize", syncKeyboardOpen);
    window.visualViewport?.addEventListener("scroll", syncKeyboardOpen);
    syncKeyboardOpen();

    document.getElementById("worldTouchMapBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleMap();
    });
    document.getElementById("worldTouchTravelBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openFastTravel();
    });
    document.getElementById("worldTouchEnterBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.__gtgWorld3D?.triggerEnter?.();
    });
  }

  function syncImmersiveTypingOverlay() {
    const typingOverlay = document.getElementById("sceneTypingOverlay");
    if (!typingOverlay || !isImmersiveRail()) return;
    const challenge = document.getElementById("typingChallenge");
    const typingChoices = document.getElementById("typingChoices");
    const sceneChoices = document.getElementById("sceneChoices");
    const hasChallenge = Boolean(challenge && !challenge.classList.contains("dw-hidden"));
    const hasTypingChoices = Boolean(typingChoices && !typingChoices.classList.contains("dw-hidden"));
    const hasClickChoices = Boolean(sceneChoices?.children?.length);
    typingOverlay.classList.toggle("dw-hidden", !hasChallenge && !hasTypingChoices && !hasClickChoices);
  }

  function mountImmersiveRail() {
    const panel = document.getElementById("scenePanel");
    const storyBlock = document.getElementById("sceneStoryBlock");
    const typingBlock = document.getElementById("sceneTypingBlock");
    const overlay = document.getElementById("sceneStoryOverlay");
    const overlayPanel = overlay?.querySelector(".tt-scene-story-overlay__panel");
    const typingOverlay = document.getElementById("sceneTypingOverlay");
    const typingPanel = typingOverlay?.querySelector(".tt-scene-typing-overlay__panel");
    if (!panel || !storyBlock || !typingBlock || !overlay || !overlayPanel || !typingOverlay || !typingPanel) return;
    if (!scenePanelHome) scenePanelHome = panel.parentElement;
    if (storyBlock.parentElement !== overlayPanel) overlayPanel.appendChild(storyBlock);
    overlay.classList.remove("dw-hidden");
    if (typingBlock.parentElement !== typingPanel) typingPanel.appendChild(typingBlock);
    syncImmersiveStoryPanelState();
    syncImmersiveTypingOverlay();
  }

  function unmountImmersiveRail() {
    const panel = document.getElementById("scenePanel");
    const storyBlock = document.getElementById("sceneStoryBlock");
    const typingBlock = document.getElementById("sceneTypingBlock");
    const overlay = document.getElementById("sceneStoryOverlay");
    const typingOverlay = document.getElementById("sceneTypingOverlay");
    if (!panel || !scenePanelHome) return;
    if (storyBlock && storyBlock.parentElement !== panel) {
      panel.insertBefore(storyBlock, panel.firstChild);
    }
    if (typingBlock && typingBlock.parentElement !== panel) {
      panel.appendChild(typingBlock);
    }
    overlay?.classList.add("dw-hidden");
    typingOverlay?.classList.add("dw-hidden");
    if (panel.parentElement !== scenePanelHome) scenePanelHome.appendChild(panel);
  }

  function syncImmersiveStoryPanelState() {
    const panel = document.getElementById("scenePanel");
    const overlayPanel = document.querySelector(".tt-scene-story-overlay__panel");
    if (!panel || !overlayPanel) return;
    overlayPanel.classList.toggle("tt-scene-panel--waiting", panel.classList.contains("tt-scene-panel--waiting"));
    overlayPanel.classList.toggle("tt-scene-panel--reveal", panel.classList.contains("tt-scene-panel--reveal"));
  }

  function applySceneZone(nodeId) {
    const zone = Visuals.zoneForNode(nodeId);
    const world3d = window.__gtgWorld3D;
    if (world3d?.active && world3d?.ready) {
      world3d.resize?.();
      document.body.classList.add("tt-3d");
      document.getElementById("gameView")?.classList.add("tt-game-layout--immersive");
      mountImmersiveRail();
      requestAnimationFrame(() => world3d.resize?.());
    } else {
      unmountImmersiveRail();
      document.body.classList.remove("tt-3d");
      document.getElementById("gameView")?.classList.remove("tt-game-layout--immersive");
    }
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
    const overlayPanel = document.querySelector(".tt-scene-story-overlay__panel");
    const hudLayers = document.querySelectorAll("#typingChoices, #typingChallenge, #sceneNarrative, #sceneChoices, #narrativeContinueBtn");
    if (!panel) return;
    panel.classList.toggle("tt-scene-panel--waiting", waiting);
    panel.classList.toggle("tt-scene-panel--reveal", !waiting);
    overlayPanel?.classList.toggle("tt-scene-panel--waiting", waiting);
    overlayPanel?.classList.toggle("tt-scene-panel--reveal", !waiting);
    hudLayers.forEach((el) => {
      if (!el) return;
      el.classList.toggle("tt-layer--waiting", waiting);
    });
    syncImmersiveTypingOverlay();
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
    if (target?.closest?.("button, a, input, textarea, select, label, .tt-typing-choices, .tt-ghost-prompt, .tt-hud, .tt-sidebar, .tt-pack-btn, .tt-mute-btn")) {
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
      ? `<img class="tt-character__photo" src="${portrait}" alt="${escapeHtml(char.name)}" width="220" height="280" loading="eager" onerror="this.parentElement.innerHTML='<span class=\\'tt-character__emoji\\'>${char.emoji}</span>';" />`
      : `<span class="tt-character__emoji">${char.emoji}</span>`;

    charEl.innerHTML = `
      <button type="button" class="tt-character__card" data-char="${escapeHtml(charKey)}" title="Click to hear about ${escapeHtml(char.name)}">
        <div class="tt-character__avatar">${avatarInner}</div>
        <div class="tt-character__info">
          <div class="tt-character__name">${escapeHtml(char.name)}</div>
          <div class="tt-character__role">${escapeHtml(char.role)}</div>
          <div class="tt-character__era">${escapeHtml(char.era)}</div>
        </div>
      </button>`;

    charEl.querySelector(".tt-character__card")?.addEventListener("click", () => {
      showNpcDialog(charKey, mapIdFor(currentNode));
    });

    if (!prefersReducedMotion) {
      charEl.classList.remove("tt-character--pop");
      void charEl.offsetWidth;
      charEl.classList.add("tt-character--pop");
    }
  }

  function mapIdFor(nodeId) {
    return Visuals.mapRoomForNode?.(nodeId)?.id || "start";
  }

  function normalizeCompletedRooms(raw) {
    const set = raw instanceof Set ? raw : new Set(raw || []);
    const out = new Set();
    set.forEach((id) => {
      if (Visuals.MAP_ROOMS?.[id]) out.add(id);
      else out.add(mapIdFor(id));
    });
    return out;
  }

  function isMapRoomComplete(nodeId) {
    return completedRooms.has(mapIdFor(nodeId));
  }

  function markMapRoomComplete(nodeId) {
    completedRooms.add(mapIdFor(nodeId));
    unlockAdjacentRooms(mapIdFor(nodeId));
    checkFinalTrialUnlock();
    window.__gtgWorld3D?.refreshCampus?.();
  }

  const GOLDEN_RULES_QUIZ = [
    {
      scenario: "A team is about to ship an app on Friday. Nobody asked students whether they needed it.",
      correct: 1,
    },
    {
      scenario: "A classmate's phone number and schedule were posted in a public thread 'as a joke.'",
      correct: 2,
    },
    {
      scenario: "Someone used the same password for school email, a game, and a second account — with no two-factor auth.",
      correct: 3,
    },
    {
      scenario: "You're about to post a reply that tags someone just to embarrass them. It might go viral.",
      correct: 4,
    },
    {
      scenario: "Three headlines describe the same event. One is sourced, one is breathless, one is ALL CAPS with a question mark.",
      correct: 5,
    },
  ];

  /** Story node to load when the player enters a map room from the 3D campus. */
  function resolveEntryNode(roomId, pendingTarget) {
    if (pendingTarget?.roomId === roomId && pendingTarget?.nodeId) {
      return pendingTarget.nodeId;
    }
    const node = STORY[currentNode];
    if (node) {
      const choices = resolveChoices(node, currentNode);
      for (const c of choices) {
        if (c?.next && mapIdFor(c.next) === roomId) return c.next;
      }
      if (node.typingChallenge?.next && mapIdFor(node.typingChallenge.next) === roomId) {
        return node.typingChallenge.next;
      }
    }
    if (STORY[roomId]) return roomId;
    return currentNode;
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
    return document.body.classList.contains("tt-map-open");
  }

  function setMapOpen(open) {
    const btn = document.getElementById("mapToggleBtn");
    const hud = document.getElementById("mapFlyoverHud");
    document.body.classList.toggle("tt-map-open", open);
    btn?.setAttribute("aria-pressed", open ? "true" : "false");
    hud?.classList.toggle("dw-hidden", !open);
    hud?.setAttribute("aria-hidden", open ? "false" : "true");
    document.getElementById("campusMap")?.classList.add("dw-hidden");
    if (open) window.__gtgWorld3D?.resize?.();
  }

  function exitToCampus() {
    window.__gtgWorld3D?.exitToCampus?.();
    document.getElementById("exitRoomBtn")?.classList.add("dw-hidden");
    toast("Back on campus — use WASD to walk. Press E at a floor to enter.", "info");
  }

  function showNpcDialog(mentorKey, roomId) {
    const char = CHARACTERS[mentorKey];
    if (!char) return;
    const room = Visuals.MAP_ROOMS?.[roomId];
    const conflict = room?.conflict;
    const el = document.getElementById("npcDialog");
    const body = document.getElementById("npcDialogBody");
    if (!el || !body) return;
    const portrait = Visuals.PORTRAITS[mentorKey];
    const thumb = portrait
      ? `<img class="tt-npc-dialog__photo" src="${portrait}" alt="" width="120" height="150" />`
      : `<span class="tt-npc-dialog__emoji">${char.emoji}</span>`;
    body.innerHTML = `
      <div class="tt-npc-dialog__hero">${thumb}
        <div>
          <h3 id="npcDialogTitle" class="tt-npc-dialog__name">${escapeHtml(char.name)}</h3>
          <p class="tt-npc-dialog__role">${escapeHtml(char.role)} · ${escapeHtml(char.era)}</p>
        </div>
      </div>
      ${conflict ? `<p class="tt-npc-dialog__problem"><strong>${escapeHtml(conflict.title)}</strong> — ${escapeHtml(conflict.situation)}</p>` : ""}
      <p class="tt-npc-dialog__tech">${escapeHtml(char.research || "This mentor's notes unlock as you explore.")}</p>
      ${room?.job ? `<p class="tt-npc-dialog__job"><strong>Your job here:</strong> ${escapeHtml(room.job)}</p>` : ""}
      <button type="button" class="tt-cta-btn tt-cta-btn--sm" id="npcEnterRoomBtn">Enter ${escapeHtml(room?.label || "room")} ▶</button>`;
    el.classList.remove("dw-hidden");
    el.setAttribute("aria-hidden", "false");
    metCharacters.add(mentorKey);
    journal.push(`💬 Talked with ${char.name}`);
    document.getElementById("npcEnterRoomBtn")?.addEventListener("click", () => {
      el.classList.add("dw-hidden");
      if (roomId) window.__gtgWorld3D?.enterRoom?.(roomId);
    });
    document.getElementById("npcDialogCloseBtn")?.addEventListener("click", () => {
      el.classList.add("dw-hidden");
      el.setAttribute("aria-hidden", "true");
    }, { once: true });
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
      const completed = completedRooms.has(room.id);
      const unlocked = isRoomUnlocked(room.id);
      const exit = exits.has(room.id) && !current && unlocked;
      const cls = ["tt-map-room", current ? "tt-map-room--here" : "", visited ? "tt-map-room--seen" : "", completed ? "tt-map-room--completed" : "", exit ? "tt-map-room--exit" : "", !unlocked ? "tt-map-room--locked" : ""].filter(Boolean).join(" ");
      return `<button type="button" class="${cls}" data-room="${escapeHtml(room.id)}" style="--x:${room.x}%;--y:${room.y}%" ${current ? 'aria-current="true"' : ""} ${!unlocked ? "disabled" : ""}>
        <span class="tt-map-room__cube" aria-hidden="true">${unlocked ? room.icon : "🔒"}</span>
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
    const exitNames = [...exits].filter((id) => isRoomUnlocked(id)).map((id) => pts[id]?.label).filter(Boolean);
    const lockedExitCount = [...exits].filter((id) => !isRoomUnlocked(id)).length;
    if (legend) {
      if (exitNames.length) {
        legend.textContent = `You are in ${hereRoom?.label || "Unknown"}. Open doors: ${exitNames.join(" · ")}.${lockedExitCount ? ` (${lockedExitCount} locked — link adjacent rooms first)` : ""}`;
      } else if (lockedExitCount) {
        legend.textContent = `You are in ${hereRoom?.label || "Unknown"}. Clear this room to link the next circuit.`;
      } else {
        legend.textContent = `You are in ${hereRoom?.label || "Unknown"}. Finish the work in this room, then a door will light up.`;
      }
    }

    world.querySelectorAll("[data-room]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.room;
        const label = Visuals.MAP_ROOMS?.[id]?.label || id;
        if (id === here) {
          toast("You are already here.", "lesson");
          return;
        }
        if (!isRoomUnlocked(id)) {
          toast(`🔒 ${label} isn't on your circuit yet — complete adjacent rooms first.`, "lesson");
          return;
        }
        if (exits.has(id)) {
          toast(`Type “${label}” as your path to walk there.`, "lesson");
          setMapOpen(false);
          document.getElementById("choiceTypingInput")?.focus();
          return;
        }
        if (window.__gtgWorld3D?.active && document.body.classList.contains("tt-roam")) {
          fastTravelTo(id);
          setMapOpen(false);
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

  function getGoldenQuizQuestions() {
    const collected = GOLDEN_RULES_QUIZ.filter((q) => goldenRules.has(q.correct));
    return collected.length ? collected : GOLDEN_RULES_QUIZ.slice(0, MIN_GOLDEN_FOR_SPEEDRUN);
  }

  function renderGoldenRulesQuiz(choicesEl) {
    if (!choicesEl) return;
    const rules = Visuals.GOLDEN_RULES || [];
    const quizQuestions = getGoldenQuizQuestions();
    let index = 0;

    function renderQuestion() {
      const q = quizQuestions[index];
      if (!q) {
        goldenQuizPassed = true;
        journal.push("🏟️ Golden Rules final exam passed");
        const n = quizQuestions.length;
        toast(`${n} Golden Rule${n === 1 ? "" : "s"} matched — write your oath.`, "golden");
        Audio?.playGoldenFanfare?.();
        State.saveRun(withStudentRunFields({
          currentNode,
          badges,
          lessons,
          goldenRules,
          completedRooms,
          goldenQuizPassed,
          dataFragments,
          mentorPackets,
          journal,
          metCharacters,
          visitedRooms,
          unlockedRooms,
          integrity,
          reputation,
          mentorTrust,
          strikes,
          completedMinigames,
          phraseTrack,
          startedAt: startTime,
        }));
        renderScene(currentNode, { quizJustPassed: true }).catch((err) => console.error("[GTG] quiz:", err));
        return;
      }

      const rule = rules.find((r) => r.n === q.correct);
      const options = shuffle(rules.map((r) => r)).map((r) => `
        <button type="button" class="tt-choice tt-golden-quiz__opt" data-rule-n="${r.n}">
          <span class="tt-choice__arrow">${r.icon}</span>
          <span><strong>Golden Rule ${r.n}:</strong> ${escapeHtml(r.short)}</span>
          <span class="tt-choice__glow"></span>
        </button>`).join("");

      choicesEl.innerHTML = `
        <div class="tt-golden-quiz">
          <p class="tt-golden-quiz__progress">Final exam · Question ${index + 1} of ${quizQuestions.length}</p>
          <p class="tt-golden-quiz__scenario">${escapeHtml(q.scenario)}</p>
          <p class="tt-golden-quiz__prompt">Which Golden Rule applies?</p>
          <div class="tt-golden-quiz__options">${options}</div>
        </div>`;

      choicesEl.querySelectorAll("[data-rule-n]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const picked = Number(btn.dataset.ruleN);
          if (picked === q.correct) {
            btn.classList.add("tt-choice--picked");
            journal.push(`✓ Final exam ${index + 1}: ${rule?.short || "Golden Rule"}`);
            index += 1;
            setTimeout(() => renderQuestion(), prefersReducedMotion ? 120 : 380);
          } else {
            btn.classList.add("tt-choice--risky");
            triggerGlitchIfWrong({ risky: true, label: "Wrong rule" });
            toast("Not quite — read the scenario again and pick the rule that fits.", "lesson");
            integrity = Math.max(0, integrity - 2);
            updateStats();
          }
        });
      });
    }

    renderQuestion();
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
    const enhanced = enhanceChoices(node, nodeId, choices);
    return shuffle(enhanced.map((c) => ({ ...c }))).filter((c) => !choiceLeadsToLockedRoom(c, nodeId));
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

  async function renderScene(nodeId, opts = {}) {
    const gen = ++typewriterGen;
    const node = STORY[nodeId];
    if (!node) {
      console.error("[GTG] Missing story node:", nodeId);
      toast("Story error — try Play mission again.", "lesson");
      return;
    }
    currentNode = nodeId;
    visitedRooms.add(mapIdFor(nodeId));
    window.TechTrailGlitch?.reset?.();
    worldListeners.forEach((cb) => {
      try { cb(nodeId); } catch (err) { console.error("[GTG] world listener:", err); }
    });

    if (!node.ending) {
      hideDiagnostic();
      show("game");
      const exitBtn = document.getElementById("exitRoomBtn");
      if (exitBtn) {
        const showExit = Boolean(window.__gtgWorld3D?.active && !document.body.classList.contains("tt-roam"));
        exitBtn.classList.toggle("dw-hidden", !showExit);
      }
    }

    const choiceTypingInput = document.getElementById("choiceTypingInput");
    if (choiceTypingInput) choiceTypingInput.disabled = false;
    document.getElementById("typingChoices")?.classList.remove("tt-typing-choices--unlock");

    if (nodeId === "start") {
      startChoices = buildStartChoices();
      journal.push(`🎲 ${startChoices.length} missions on the board this run`);
    }
    if (nodeId === "reflect_win") checkFinalTrialUnlock();

    applySceneZone(nodeId);
    renderMissionChrome(nodeId, node);
    if (mapIsOpen()) renderCampusMap(nodeId);

    if (!node.ending && window.__gtgWorld3D?.active) {
      if (opts.campusRoam) {
        window.__gtgWorld3D.setCampusRoam?.(true);
      } else {
        // Always leave roam when a story room is active — otherwise the typing bar is CSS-hidden.
        window.__gtgWorld3D.setCampusRoam?.(false);
      }
    }

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
      if (opts.fromWorld) {
        renderCharacter(node.character);
        setPanelWaiting(false);
        document.getElementById("sceneArrive")?.classList.add("dw-hidden");
        document.getElementById("sceneDoor")?.classList.add("dw-hidden");
      } else {
        await playRoomReveal(node, gen);
        if (gen !== typewriterGen) return;
      }
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
      checkFinalTrialUnlock();

      const fragmentId = `fragment-${node.goldenRule}`;
      if (!dataFragments.includes(fragmentId)) {
        dataFragments.push(fragmentId);
        journal.push(`💾 Data fragment ${node.goldenRule}/5 recovered`);
        toast(`Data fragment ${node.goldenRule} of 5 collected`, "badge");
        renderFragmentTracker();
      }
    }

    if (nodeId.endsWith("_deep_win")) {
      const charKey = nodeId.replace("_deep_win", "");
      if (charKey && !mentorPackets.includes(charKey)) {
        mentorPackets.push(charKey);
        journal.push(`📦 Mentor packet: ${CHARACTERS[charKey]?.name || charKey}`);
        toast(`Mentor packet archived: ${CHARACTERS[charKey]?.name || charKey}`, "info");
        renderFragmentTracker();
      }
    }

    updateStats();
    renderGoldenTrack();
    renderCampusLinkProgress();

    State.saveRun(withStudentRunFields({
      currentNode,
      badges,
      lessons,
      goldenRules,
      completedRooms,
      goldenQuizPassed,
      dataFragments,
      mentorPackets,
      journal,
      metCharacters,
      visitedRooms,
      unlockedRooms,
      integrity,
      reputation,
      mentorTrust,
      strikes,
      completedMinigames,
      phraseTrack,
      startedAt: startTime,
    }));

    const isRoomCompleted = isMapRoomComplete(nodeId);
    const needsGoldenQuiz = Boolean(node.goldenRulesQuiz && !goldenQuizPassed);

    if (needsGoldenQuiz) {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      renderOathRuleRecap(false);
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      renderGoldenRulesQuiz(choicesEl);
    } else if (node.typingChallenge && !isRoomCompleted) {
      typingPending = node.typingChallenge;
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      typingEl.classList.remove("dw-hidden");
      typingEl.classList.add("tt-layer--enter");
      if (choicesEl) choicesEl.innerHTML = "";
      document.getElementById("typingPrompt").textContent = node.typingChallenge.prompt;
      const modeBadge = document.getElementById("typingModeBadge");
      const challengeLabel = document.getElementById("typingChallengeLabel");
      const mode = node.typingChallenge.mode || "composition";
      if (modeBadge) {
        modeBadge.textContent = mode === "transcription" ? "Transcription" : "Composition";
        modeBadge.classList.toggle("tt-typing-mode-badge--transcription", mode === "transcription");
      }
      if (challengeLabel) {
        challengeLabel.textContent = mode === "transcription" ? "⌨️ Transcription challenge" : "✍️ Composition challenge";
      }
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
      if (!isImmersiveRail()) typingEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      else if (touchMode) scrollTypingIntoView(typingInput);
      syncImmersiveTypingOverlay();
    } else if (node.typingChallenge && isRoomCompleted) {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      renderOathRuleRecap(false);
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      if (choicesEl) {
        choicesEl.innerHTML = `<button type="button" class="tt-choice" data-continue-next="${escapeHtml(node.typingChallenge.next)}">
          <span class="tt-choice__arrow">➤</span>
          <span>Room completed — continue to ${escapeHtml(STORY[node.typingChallenge.next]?.location || "next room")}</span>
          <span class="tt-choice__glow"></span>
        </button>`;
        choicesEl.querySelector("[data-continue-next]")?.addEventListener("click", () => {
          navigate(node.typingChallenge.next);
        });
      }
    } else {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      renderOathRuleRecap(false);
      document.getElementById("typingChoices")?.classList.add("dw-hidden");
      clearChoiceTyping();
      const choices = resolveChoices(node, nodeId);
      const showChoices = () => {
        if (choices.length) {
          const useTyping = typingProfile.diagnosed && node.typeChoices !== false && !clickChoicePreferred();
          if (useTyping) {
            setupTypingChoices(node, choices);
          } else {
            renderClickChoices(node, choices);
          }
          document.getElementById("sceneChoices")?.classList.add("tt-layer--enter");
        }
        syncImmersiveTypingOverlay();
      };

      const roomId = mapIdFor(nodeId);
      const mini = window.TechTrailMinigames?.forRoom?.(roomId);
      const needsMinigame = mini
        && !completedMinigames.has(roomId)
        && !isMapRoomComplete(nodeId)
        && !node.ending
        && !needsGoldenQuiz
        && !node.typingChallenge;

      if (needsMinigame) {
        window.__gtgWorld3D?.setCampusRoam?.(false);
        typingEl.classList.add("dw-hidden");
        document.getElementById("typingChoices")?.classList.add("dw-hidden");
        clearChoiceTyping();
        if (choicesEl) choicesEl.innerHTML = `<p class="tt-minigame__loading">Powering room systems…</p>`;
        syncImmersiveTypingOverlay();
        let ok = false;
        while (!ok) {
          if (gen !== typewriterGen) return;
          try {
            ok = await window.TechTrailMinigames.play(roomId);
          } catch (err) {
            console.error("[GTG] Room minigame failed:", err);
            ok = false;
          }
          if (gen !== typewriterGen) return;
          if (!ok) {
            strikes = Math.min(MAX_STRIKES, strikes + 1);
            journal.push(`⚠️ Failed room challenge — strike ${strikes}/${MAX_STRIKES}`);
            updateStrikeMeter();
            toast(`Challenge failed — try again (${strikes}/${MAX_STRIKES} strikes)`, "lesson");
            if (strikes >= MAX_STRIKES) {
              triggerMissionFailure("failed too many challenges");
              return;
            }
          }
        }
        completedMinigames.add(roomId);
        journal.push(`⚡ Cleared ${mini.title}`);
        toast("Room challenge cleared!", "info");
        if (choicesEl) choicesEl.innerHTML = "";
        document.getElementById("sceneChoices")?.classList.remove("tt-layer--enter");
        State.saveRun(withStudentRunFields({
          currentNode,
          badges,
          lessons,
          goldenRules,
          completedRooms,
          goldenQuizPassed,
          dataFragments,
          mentorPackets,
          journal,
          metCharacters,
          visitedRooms,
          unlockedRooms,
          integrity,
          reputation,
          mentorTrust,
          strikes,
          completedMinigames,
          phraseTrack,
          startedAt: startTime,
        }));
      }

      if (node.chatMission && !needsGoldenQuiz) {
        maybeRunChatMission(node, nodeId, showChoices);
      } else {
        showChoices();
      }
    }

    if (node.ending) {
      show("ending");
      renderEnding(node);
    }

    syncImmersiveTypingOverlay();
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
    const consistency = Pedagogy?.consistencyFromKeystrokes?.(challengeKeystrokeTracker?.getStats?.()) ?? 0.85;
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
          consistency,
        })
      : { unlocked: words >= cfg.minWordsFloor, score: words >= minWords ? 1 : 0.4, speedOk: true, accuracyOk: true };
    const pct = Math.min(100, Math.round(result.performanceScore ?? (result.unlocked ? 100 : result.score * 100)));
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
      const perf = result.performanceScore ?? Math.round((result.score || 0) * 100);
      countEl.textContent = result.unlocked
        ? `${words} words · score ${perf} · ready`
        : `${words} words · ${accPct}% accuracy · score ${perf}`;
      countEl.classList.toggle("tt-typing-count--ready", result.unlocked);
    }
    const tipEl = document.getElementById("challengePedagogyTip");
    if (tipEl && Pedagogy) {
      tipEl.textContent = Pedagogy.buildCompositionTip(accuracy, words, minWords);
      tipEl.classList.toggle("dw-hidden", result.unlocked);
    }
    const hint = document.getElementById("challengeUnlockHint");
    if (hint) {
      if (result.unlocked) hint.textContent = "Unlocked — your ideas and accuracy are strong. Submit when ready.";
      else if (words < cfg.minWordsFloor) hint.textContent = `Share a few real words to start (${cfg.minWordsFloor}+). Ideas matter more than speed.`;
      else if (!result.accuracyOk) hint.textContent = "Write in real sentences — accuracy unlocks this, not raw speed.";
      else if ((result.performanceScore ?? 0) < 52) hint.textContent = "Keep developing your answer — communication score builds with clarity and accuracy.";
      else hint.textContent = "Almost — keep communicating clearly.";
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
    if (isMapRoomComplete(fromId)) {
      then?.();
      return;
    }
    const Rhythm = window.TechTrailRhythm;
    if (!Rhythm?.start) {
      markMapRoomComplete(fromId);
      then?.();
      return;
    }
    Rhythm.start({
      nodeId: fromId,
      difficulty,
      phraseTrack,
      reducedMotion: prefersReducedMotion || document.body.classList.contains("tt-high-contrast"),
      onComplete(result) {
        if (result && !result.skipped && result.accuracy != null) {
          journal.push(`⌨️ Phrase ${Math.round(result.accuracy)}% · ${result.title || "citizenship"}`);
          if (Pedagogy) {
            recordPedagogySession({
              accuracyPct: Math.round(result.accuracy),
              performanceScore: Math.round(result.accuracy * 0.85),
              tip: result.accuracy >= 90 ? "Strong transcription — ideas come next." : "Slow down for accuracy — speed follows accuracy.",
            });
          }
        }
        markMapRoomComplete(fromId);
        then?.();
      },
    });
  }

  function navigate(nodeId, opts = {}) {
    const world = window.__gtgWorld3D;
    const targetRoom = mapIdFor(nodeId);
    const fromRoom = mapIdFor(currentNode);
    if (targetRoom !== fromRoom && !STORY[nodeId]?.ending) {
      const firstPathPick = currentNode === "start" && Visuals.isGoldenPathRoom?.(targetRoom);
      if (!isRoomUnlocked(targetRoom) && !firstPathPick) {
        const label = Visuals.MAP_ROOMS[targetRoom]?.label || targetRoom;
        toast(`🔒 ${label} isn't on your circuit yet — link adjacent rooms first.`, "lesson");
        return;
      }
      onTravelToRoom(currentNode, nodeId);
    }
    const isRoomHop = !!(
      world?.active &&
      !opts.direct &&
      !STORY[nodeId]?.ending &&
      activeView === "game" &&
      targetRoom !== mapIdFor(currentNode)
    );
    if (isRoomHop) {
      world.requestWalkTo(nodeId, mapIdFor(nodeId));
      return;
    }
    if (!opts.skipRhythm && opts.finishRhythm) {
      if (isMapRoomComplete(currentNode)) {
        renderScene(nodeId, { ...opts, skipRhythm: true });
        return;
      }
      runRhythmThen(currentNode, () => renderScene(nodeId, opts));
      return;
    }
    renderScene(nodeId, opts);
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
    updateStrikeMeter();
    updatePackCount();
  }

  function renderFragmentTracker() {
    const container = document.getElementById("fragmentTracker");
    if (!container) return;
    const total = 5;
    const collected = dataFragments.length;
    const html = Array.from({ length: total }, (_, i) => {
      const got = dataFragments.includes(`fragment-${i + 1}`);
      return `<span class="tt-fragment-dot${got ? " tt-fragment-dot--lit" : ""}" title="Fragment ${i + 1}${got ? " collected" : " missing"}"></span>`;
    }).join("");
    container.innerHTML = html;
    container.classList.toggle("tt-fragment-tracker--complete", collected >= total);
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
      triggerMissionFailure("integrity hit zero");
      return;
    }
    if (strikes >= MAX_STRIKES) {
      toast("Mission integrity critical — one more misstep ends the run.", "lesson");
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
  let sidebarMainTab = "log";

  function sidebarNeedsOverlay() {
    if (document.getElementById("gameView")?.classList.contains("tt-game-layout--immersive")) return false;
    return window.matchMedia("(max-width: 1080px)").matches;
  }

  function focusRailSidebar(tab = "log") {
    const sidebar = document.querySelector(".tt-sidebar");
    const rail = document.querySelector(".tt-immersive-rail");
    if (!sidebar) return;
    setSidebarTab(tab);
    if (!isImmersiveRail()) return;
    sidebar.classList.add("tt-sidebar--focused");
    window.setTimeout(() => sidebar.classList.remove("tt-sidebar--focused"), 700);
    rail?.querySelector(`[data-sidebar-tab="${tab}"]`)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    sidebar.scrollIntoView?.({ block: "end", behavior: "smooth" });
    rail?.querySelector(`[data-sidebar-tab="${tab}"]`)?.focus?.({ preventScroll: true });
  }

  function setSidebarTab(tab) {
    sidebarMainTab = tab;
    document.querySelectorAll("[data-sidebar-tab]").forEach((btn) => {
      const active = btn.dataset.sidebarTab === tab;
      btn.classList.toggle("tt-sidebar__tab--active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    document.querySelectorAll("[data-sidebar-panel]").forEach((panel) => {
      panel.classList.toggle("tt-sidebar__panel--active", panel.dataset.sidebarPanel === tab);
    });
  }

  function openSidebar(tab = "log") {
    const sidebar = document.querySelector(".tt-sidebar");
    if (!sidebar) return;
    setSidebarTab(tab);
    if (sidebarNeedsOverlay()) {
      sidebar.classList.add("tt-sidebar--overlay", "tt-sidebar--open");
      return;
    }
    focusRailSidebar(tab);
  }

  function closeSidebar() {
    const sidebar = document.querySelector(".tt-sidebar");
    if (!sidebar) return;
    if (sidebarNeedsOverlay()) {
      sidebar.classList.remove("tt-sidebar--open", "tt-sidebar--overlay");
    }
    setSidebarTab("log");
  }

  function toggleSidebarLog() {
    const sidebar = document.querySelector(".tt-sidebar");
    if (!sidebar) return;
    if (sidebarNeedsOverlay()) {
      if (sidebar.classList.contains("tt-sidebar--open") && sidebarMainTab === "log") {
        closeSidebar();
        return;
      }
      openSidebar("log");
      return;
    }
    if (sidebarMainTab === "log" && isImmersiveRail()) {
      focusRailSidebar("log");
      return;
    }
    openSidebar("log");
  }

  function isPackPanelOpen() {
    const packPanel = document.querySelector('[data-sidebar-panel="pack"]');
    if (!packPanel?.classList.contains("tt-sidebar__panel--active")) return false;
    if (!sidebarNeedsOverlay()) return true;
    return document.querySelector(".tt-sidebar")?.classList.contains("tt-sidebar--open") ?? false;
  }

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
    openSidebar("pack");
    renderInventory(focusId);
    Audio?.playPathUnlock?.();
  }

  function closeInventory() {
    setSidebarTab("log");
    const sidebar = document.querySelector(".tt-sidebar");
    if (sidebarNeedsOverlay() && sidebar?.classList.contains("tt-sidebar--open")) {
      sidebar.classList.remove("tt-sidebar--open", "tt-sidebar--overlay");
    }
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
    if (integrity >= 50 && goldenRules.size >= MIN_GOLDEN_FOR_SPEEDRUN) return "operative";
    return "probation";
  }

  function renderEnding(node) {
    let endingType = node.endingType === "fail" ? "fail" : computeEndingType();
    if (node.endingType === "champion" && endingType === "probation" && goldenRules.size >= MIN_GOLDEN_FOR_SPEEDRUN) {
      endingType = "operative";
    }
    let title, narrativeOverride;
    if (endingType === "champion") {
      title = "Gauntlet Champion!";
    } else if (endingType === "operative") {
      title = "Mission Operative";
    } else if (endingType === "fail") {
      title = "Mission Suspended";
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
    burstConfetti(endingType === "fail" ? 8 : endingType === "probation" ? 16 : endingType === "operative" ? 32 : 48);

    const mosaicEl = document.getElementById("endingMosaic");
    if (mosaicEl) {
      const hasAllFragments = dataFragments.length >= 5;
      mosaicEl.classList.toggle("dw-hidden", !hasAllFragments);
      if (hasAllFragments) {
        setTimeout(() => mosaicEl.classList.add("tt-ending-mosaic--revealed"), 600);
      }
    }

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
    if (endingType === "champion" || endingType === "operative") updated.hasBeatenGame = true;
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
    goldenQuizPassed = false;
    completedRooms = new Set();
    dataFragments = [];
    mentorPackets = [];
    metCharacters.clear();
    visitedRooms = new Set(["start"]);
    unlockedRooms = new Set(["start"]);
    integrity = 100;
    reputation = 50;
    mentorTrust = {};
    strikes = 0;
    completedMinigames = new Set();
    phraseTrack = null;
    journal = ["🌐 Mission accepted"];
    startTime = Date.now();
    const id = getStudentIdentity();
    if (id.name && id.classroom) {
      State.saveRun({
        currentNode: "start",
        badges,
        lessons,
        goldenRules,
        completedRooms,
        goldenQuizPassed,
        dataFragments,
        mentorPackets,
        journal,
        metCharacters,
        visitedRooms,
        unlockedRooms,
        integrity,
        reputation,
        mentorTrust,
        strikes,
        completedMinigames,
        phraseTrack,
        studentName: id.name,
        classroom: id.classroom,
        startedAt: startTime,
      });
    }
  }

  function init() {
    const titleTypingInput = document.getElementById("titleTypingInput");
    Core.setupPasteControl(titleTypingInput, false);
    titleTypingInput?.addEventListener("input", handleTitleTypingInput);
    titleTypingInput?.addEventListener("keydown", handleTitleTypingKeydown);

    loadDifficulty();
    loadHighContrast();
    loadClickChoiceMode();
    flushOfflineSubmissions();
    window.addEventListener("online", () => { flushOfflineSubmissions(); });
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
    renderPedagogyProgress();
    ensurePedagogyProfile();
    (typingProfile.pedagogy?.chatMissionsCompleted || []).forEach((id) => completedChatMissions.add(id));
    updateDifficultyButtons();
    updateMuteButton();
    updateTypingProfileUI();
    updateTypoToleranceUI();
    updateTitleLaunchUI();
    renderTitleTypingMenu();
    initTouchMode();
    window.addEventListener("resize", fitTitleScreenScale);
    window.visualViewport?.addEventListener("resize", fitTitleScreenScale);
    requestAnimationFrame(fitTitleScreenScale);

    document.querySelectorAll(".tt-difficulty__btn").forEach((btn) => {
      btn.addEventListener("click", () => saveDifficulty(btn.dataset.tier));
    });

    document.getElementById("highContrastToggle")?.addEventListener("click", toggleHighContrast);
    document.getElementById("clickChoiceToggle")?.addEventListener("click", toggleClickChoiceMode);
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
      setTimeout(() => {
        fitTitleScreenScale();
        document.getElementById("titleLaunchBar")?.scrollIntoView({ block: "nearest" });
        if (typingProfile.diagnosed) {
          toast("Tip: tap ⛶ Fullscreen for the best arcade view.", "info");
          document.getElementById("titleTypingInput")?.focus();
        } else {
          document.getElementById("diagnosticInput")?.focus();
        }
      }, prefersReducedMotion ? 250 : 700);
    }

    document.getElementById("inventoryBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInventory(inventoryTab || "trophies");
    });
    document.getElementById("gameView")?.addEventListener("click", (e) => {
      const sidebarTab = e.target.closest("[data-sidebar-tab]");
      if (sidebarTab) {
        e.preventDefault();
        e.stopPropagation();
        if (sidebarTab.dataset.sidebarTab === "pack") openInventory(inventoryTab);
        else openSidebar("log");
        return;
      }
      const invTab = e.target.closest("[data-inv-tab]");
      if (invTab) {
        e.preventDefault();
        inventoryTab = invTab.dataset.invTab || "trophies";
        renderInventory();
      }
    });
    document.getElementById("statBadges")?.closest(".tt-stat")?.addEventListener("click", () => openInventory("trophies"));
    document.getElementById("statLessons")?.closest(".tt-stat")?.addEventListener("click", () => openInventory("knowledge"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (mapIsOpen()) { setMapOpen(false); return; }
        const npc = document.getElementById("npcDialog");
        if (npc && !npc.classList.contains("dw-hidden")) {
          npc.classList.add("dw-hidden");
          npc.setAttribute("aria-hidden", "true");
          return;
        }
        closeInventory();
        return;
      }
      if (e.key === "z" || e.key === "Z") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTypingTarget(e.target)) return;
        if (window.TechTrailRhythm?.isActive?.()) return;
        e.preventDefault();
        toggleMap();
      }
      if (e.key === "t" || e.key === "T") {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (isTypingTarget(e.target)) return;
        if (window.TechTrailRhythm?.isActive?.()) return;
        if (!document.getElementById("gameView")?.classList.contains("dw-hidden")) {
          e.preventDefault();
          openFastTravel();
        }
      }
    });
    document.getElementById("mapToggleBtn")?.addEventListener("click", () => toggleMap());
    document.getElementById("fastTravelBtn")?.addEventListener("click", () => openFastTravel());
    document.getElementById("fastTravelCloseBtn")?.addEventListener("click", () => closeFastTravel());
    document.getElementById("fastTravelGoBtn")?.addEventListener("click", () => submitFastTravel());
    document.getElementById("fastTravelInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitFastTravel();
      }
      if (e.key === "Escape") closeFastTravel();
    });
    document.getElementById("mapFlyoverCloseBtn")?.addEventListener("click", () => setMapOpen(false));
    document.getElementById("mapCloseBtn")?.addEventListener("click", () => setMapOpen(false));
    document.getElementById("exitRoomBtn")?.addEventListener("click", () => exitToCampus());
    document.getElementById("youAreHere")?.addEventListener("click", () => toggleMap());

    document.getElementById("muteToggleBtn")?.addEventListener("click", toggleMute);

    document.getElementById("sidebarToggleBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebarLog();
    });

    document.addEventListener("click", (e) => {
      const sidebar = document.querySelector(".tt-sidebar");
      const toggle = document.getElementById("sidebarToggleBtn");
      const packBtn = document.getElementById("inventoryBtn");
      if (!sidebar || !sidebar.classList.contains("tt-sidebar--open")) return;
      if (sidebar.contains(e.target) || toggle?.contains(e.target) || packBtn?.contains(e.target)) return;
      sidebar.classList.remove("tt-sidebar--open", "tt-sidebar--overlay");
      setSidebarTab("log");
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
    document.getElementById("guildQuestBtn")?.addEventListener("click", startGuildQuest);
    document.getElementById("warmupBtn")?.addEventListener("click", () => {
      if (!typingProfile.diagnosed) {
        toast("Complete the keystroke test first.", "lesson");
        return;
      }
      openWarmupThen(() => toast("Warm-up done — ready when you are.", "badge"));
    });
    document.getElementById("warmupSkipBtn")?.addEventListener("click", closeWarmup);
    const warmupInput = document.getElementById("warmupInput");
    Core.setupPasteControl(warmupInput, false);
    warmupInput?.addEventListener("input", handleWarmupInput);
    document.getElementById("chatMissionSubmitBtn")?.addEventListener("click", submitChatMission);
    document.getElementById("chatMissionSkipBtn")?.addEventListener("click", () => {
      if (pendingChatMission) completedChatMissions.add(pendingChatMission.id);
      const cb = chatMissionCallback;
      closeChatMission();
      cb?.();
    });

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
      const mode = typingPending.mode || "composition";
      if (Pedagogy && mode === "composition") {
        recordPedagogySession({
          accuracyPct: Math.round((Typing.estimateTextAccuracy?.(typingInput?.value) ?? 0.9) * 100),
          performanceScore: result.performanceScore ?? 75,
          compositionUnlock: true,
          tip: Pedagogy.buildCompositionTip(
            Typing.estimateTextAccuracy?.(typingInput?.value) ?? 0.9,
            Core.countWords(typingInput?.value || ""),
            min
          ),
        });
      }
      const words = Core.countWords(typingInput?.value || "");
      journal.push(`⌨️ Response logged (${words} words)`);
      celebrateTypedSuccess(`${words} WORDS LOGGED`, typingInput, {
        badge: "TRANSMITTED!",
        confetti: 20,
        container: document.getElementById("typingChallenge"),
      });
      toast("Transmitting response...", "badge");
      State.clearDraft();

      markMapRoomComplete(currentNode);
      const node = STORY[currentNode];
      if (node?.goldenRule && !dataFragments.includes(`fragment-${node.goldenRule}`)) {
        dataFragments.push(`fragment-${node.goldenRule}`);
        journal.push(`💾 Data fragment ${node.goldenRule}/5 recovered`);
        toast(`Data fragment ${node.goldenRule} of 5 collected`, "badge");
      }
      renderFragmentTracker();

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
          navigate(typingPending.next, { skipRhythm: true });
        }
      }, delay);
    });

    const identitySubmit = document.getElementById("identitySubmitBtn");
    identitySubmit?.addEventListener("click", handleIdentitySubmit);

    document.getElementById("studentProfileLoadBtn")?.addEventListener("click", () => loadStudentRoster());
    document.getElementById("studentProfileConfirmBtn")?.addEventListener("click", () => confirmStudentProfile());
    document.getElementById("studentProfileClassroom")?.addEventListener("change", scheduleStudentRosterLoad);
    document.getElementById("studentProfileClassCode")?.addEventListener("input", scheduleStudentRosterLoad);
    document.getElementById("studentProfileRosterList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-roster-first]");
      if (!btn) return;
      pickStudentFromRoster(btn.dataset.rosterFirst || "", btn.dataset.rosterLast || "");
    });
    document.getElementById("switchStudentBtn")?.addEventListener("click", () => switchStudentProfile());

    function bootTitleScreen() {
      show("title");
      if (!typingProfile.diagnosed && !State.hasActiveRun()) {
        setTimeout(() => {
          openDiagnosticForLaunch(() => openWarmupThen(() => promptPhraseTrackThen(() => startMissionCore())));
          toast("Welcome! Complete the keystroke test to launch your mission.", "lesson");
        }, prefersReducedMotion ? 200 : 650);
      }
    }

    if (!State.hasRosterProfile()) {
      show("title");
      showStudentProfileGate(bootTitleScreen);
    } else {
      bootTitleScreen();
    }
  }

  function showIdentityGate(onComplete) {
    const gate = document.getElementById("identityGate");
    if (!gate) { onComplete?.(); return; }
    const profile = State.loadProfile();
    const name = profile.lastName || "";
    const classroom = profile.lastClassroom || "";
    if (name && classroom && State.hasSubmittedRun?.(name, classroom, startTime)) {
      onComplete?.();
      return;
    }
    window._identityGateCallback = onComplete;
    gate.classList.remove("dw-hidden");
    const firstEl = document.getElementById("identityFirstName");
    const lastEl = document.getElementById("identityLastInitial");
    const classEl = document.getElementById("identityClassroom");
    const codeEl = document.getElementById("identityClassCode");
    const submitBtn = document.getElementById("identitySubmitBtn");
    const introEl = gate.querySelector(".dw-muted");
    const fieldEls = gate.querySelectorAll(".tt-identity-gate__field");
    const rosterOk = State.hasRosterProfile();
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = rosterOk ? "Submit oath" : "Submit and enter";
    }
    identitySubmitting = false;
    if (rosterOk) {
      fieldEls.forEach((el) => el.classList.add("dw-hidden"));
      if (introEl) {
        introEl.textContent = `Submit your Digital Citizenship Oath as ${profile.lastName} (${profile.lastClassroom}).`;
      }
      if (codeEl) codeEl.value = getStoredClassCode() || "";
    } else {
      fieldEls.forEach((el) => el.classList.remove("dw-hidden"));
      if (introEl) introEl.textContent = "Enter your details to submit your Digital Citizenship Oath.";
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
      if (codeEl) codeEl.value = getStoredClassCode() || "";
      firstEl?.focus();
    }
    submitBtn?.focus();
  }

  function hideIdentityGate() {
    document.getElementById("identityGate")?.classList.add("dw-hidden");
    window._identityGateCallback = null;
  }

  let offlineFlushInFlight = false;

  async function postSubmissionPayload(submission) {
    const res = await fetch("/api/tech-trail/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  }

  async function flushOfflineSubmissions() {
    if (offlineFlushInFlight || !navigator.onLine || !State.hasOfflineSubmissions?.()) return;
    offlineFlushInFlight = true;
    const queue = State.dequeueOfflineSubmissions?.() || [];
    const failed = [];
    let synced = 0;
    for (const submission of queue) {
      try {
        const data = await postSubmissionPayload(submission);
        State.markRunSubmitted?.(
          submission.name,
          submission.classroom,
          submission.runId,
          data.id || "synced"
        );
        synced += 1;
      } catch (err) {
        console.warn("[GTG] Offline submission retry failed:", err);
        failed.push(submission);
      }
    }
    failed.forEach((entry) => State.queueOfflineSubmission?.(entry));
    offlineFlushInFlight = false;
    if (synced > 0) {
      toast(synced === 1 ? "Offline oath synced!" : `${synced} offline oaths synced!`, "badge");
    }
  }

  async function handleIdentitySubmit() {
    if (identitySubmitting) return;
    const submitBtn = document.getElementById("identitySubmitBtn");
    const firstEl = document.getElementById("identityFirstName");
    const lastEl = document.getElementById("identityLastInitial");
    const classEl = document.getElementById("identityClassroom");
    const codeEl = document.getElementById("identityClassCode");
    const profile = State.loadProfile();
    const rosterOk = State.hasRosterProfile();
    let first = String(firstEl?.value || "").trim();
    let last = String(lastEl?.value || "").trim();
    let classroom = String(classEl?.value || profile.lastClassroom || "").trim();
    let classCode = String(codeEl?.value || getStoredClassCode() || "").trim();

    if (rosterOk && profile.lastName) {
      const parts = profile.lastName.split(/\s+/);
      if (parts.length >= 2) {
        first = first || parts.slice(0, -1).join(" ");
        last = last || parts[parts.length - 1].slice(0, 1);
      }
      classroom = classroom || profile.lastClassroom || "";
    }

    const name = rosterOk && profile.lastName
      ? profile.lastName
      : (first && last ? `${first} ${last.toUpperCase()}` : "");
    if (!name || !classroom || !classCode) {
      toast(
        rosterOk && !classCode
          ? "Class passcode expired — tap Switch profile and sign in again."
          : "Fill in all fields to submit.",
        "lesson"
      );
      return;
    }
    if (!rosterOk) {
      if (!/^[\p{L}][\p{L}'-]{0,15}$/u.test(first)) {
        toast("First name: letters only, up to 16 characters.", "lesson");
        return;
      }
      if (!/^[\p{L}]$/u.test(last)) {
        toast("Last initial must be one letter.", "lesson");
        return;
      }
    }

    const oathText = document.getElementById("typingInput")?.value?.trim() || "";
    const oathWords = oathText.split(/\s+/).filter(Boolean).length;
    if (oathText.length < 20 || oathWords < 4) {
      toast("Complete your Digital Citizenship Oath before submitting.", "lesson");
      return;
    }

    if (State.hasSubmittedRun?.(name, classroom, startTime)) {
      toast("This run was already submitted.", "info");
      setTimeout(() => {
        hideIdentityGate();
        window._identityGateCallback?.();
      }, prefersReducedMotion ? 0 : 400);
      return;
    }

    identitySubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
    }

    profile.lastName = name;
    profile.lastClassroom = classroom;
    State.saveProfile(profile);

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
      pedagogy: Pedagogy?.snapshotForSubmit
        ? Pedagogy.snapshotForSubmit(ensurePedagogyProfile(), typingProfile, {
          integrity,
          reputation,
          studentName: name,
          classroom,
          runId: String(startTime),
        })
        : null,
      testCpm: typingProfile.testCpm ?? null,
      targetCpm: typingProfile.targetCpm ?? null,
      diagnosed: Boolean(typingProfile.diagnosed),
      integrity,
      reputation,
      runId: String(startTime),
    };

    try {
      const data = await postSubmissionPayload(submission);
      State.markRunSubmitted?.(name, classroom, startTime, data.id);
      if (data.duplicate) {
        toast(data.message || "Already submitted for this class.", "info");
      } else if (data.updated) {
        toast("Better run saved — submission updated!", "badge");
      } else {
        toast("Submission saved!", "badge");
      }
      if (!data.duplicate) {
        celebrateTypedSuccess(name, submitBtn, {
          badge: "OATH FILED!",
          confetti: 24,
          center: true,
          container: document.querySelector(".tt-identity-gate__panel"),
        });
      }
    } catch (e) {
      if (String(e.message || "").includes("Oath") || String(e.message || "").includes("already submitted")) {
        toast(e.message, "lesson");
        identitySubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit and enter";
        }
        return;
      }
      State.queueOfflineSubmission(submission);
      State.markRunSubmitted?.(name, classroom, startTime, "offline");
      toast("Saved locally — will retry when online.", "lesson");
      celebrateTypedSuccess("SAVED LOCALLY", submitBtn, {
        badge: "OFFLINE QUEUE",
        center: true,
        container: document.querySelector(".tt-identity-gate__panel"),
      });
    }

    setTimeout(() => {
      hideIdentityGate();
      window._identityGateCallback?.();
      identitySubmitting = false;
    }, prefersReducedMotion ? 0 : 700);
  }

  const worldListeners = new Set();

  window.TechTrailWorld = {
    navigate,
    mapIdFor,
    resolveEntryNode,
    onSceneRendered(cb) {
      if (typeof cb === "function") worldListeners.add(cb);
      return () => worldListeners.delete(cb);
    },
    getRunState() {
      return {
        currentNode,
        visitedRooms: [...visitedRooms],
        unlockedRooms: [...unlockedRooms],
        completedRooms: [...completedRooms],
        goldenRules: [...goldenRules],
      };
    },
    isRoomUnlocked,
    openFastTravel,
    closeFastTravel,
    isOverlayOpen() {
      return !!(
        document.getElementById("rhythmGate") && !document.getElementById("rhythmGate").classList.contains("dw-hidden")
      ) || !!(
        document.getElementById("identityGate") && !document.getElementById("identityGate").classList.contains("dw-hidden")
      ) || isPackPanelOpen() || !!(
        document.getElementById("diagnosticOverlay") && !document.getElementById("diagnosticOverlay").classList.contains("dw-hidden")
      ) || !!(
        document.getElementById("npcDialog") && !document.getElementById("npcDialog").classList.contains("dw-hidden")
      ) || !!(
        document.getElementById("fastTravelGate") && !document.getElementById("fastTravelGate").classList.contains("dw-hidden")
      ) || !!(
        document.getElementById("chatMissionGate") && !document.getElementById("chatMissionGate").classList.contains("dw-hidden")
      ) || !!(
        document.getElementById("warmupGate") && !document.getElementById("warmupGate").classList.contains("dw-hidden")
      );
    },
    isViewActive(name) {
      return activeView === name;
    },
    closeMap() {
      setMapOpen(false);
    },
    showNpcDialog,
    exitToCampus,
  };

  window.TechTrailUI = { openInventory, closeInventory };

  try {
    init();
  } catch (err) {
    showBootError("Game failed to start. Hard refresh (Ctrl+Shift+R) or clear site data for this page.");
    console.error("[GTG] init failed:", err);
  }
})();

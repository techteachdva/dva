/**
 * Global Tech Gauntlet — CYOA digital citizenship typing adventure.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  const { STORY, CHARACTERS, START_MISSIONS } = window.TechTrailStory || {};
  const Visuals = window.TechTrailVisuals;
  const State = window.TechTrailState;
  if (!Core || !STORY || !Visuals || !State) return;

  Core.applyTheme(Core.PRESETS.gauntlet);

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
  let runRng = Math.random;
  let startChoices = [];
  let startTime = Date.now();
  let difficulty = "operative";

  const DIFFICULTY_CONFIG = {
    cadet: { wordMult: 0.5, startChoicesMin: 3, startChoicesMax: 3, label: "Cadet" },
    operative: { wordMult: 1, startChoicesMin: 3, startChoicesMax: 4, label: "Operative" },
    analyst: { wordMult: 1.5, startChoicesMin: 4, startChoicesMax: 5, label: "Analyst" },
  };

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

  function buildStartChoices() {
    const count = runRng() < 0.45 ? 3 : 4;
    return shuffle(START_MISSIONS || []).slice(0, count);
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

    if (bg) bg.style.backgroundImage = `url('${zone.bg}')`;
    if (tint) tint.style.background = zone.tint;
    if (mood) mood.textContent = zone.mood ? zone.mood.toUpperCase() : "";

    if (room && !prefersReducedMotion) {
      room.classList.remove("tt-stage__room--enter");
      void room.offsetWidth;
      room.classList.add("tt-stage__room--enter");
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

  function renderScene(nodeId) {
    const node = STORY[nodeId];
    if (!node) return;
    currentNode = nodeId;

    if (nodeId === "start") {
      startChoices = buildStartChoices();
      journal.push(`🎲 ${startChoices.length} missions on the board this run`);
    }

    applySceneZone(nodeId);

    document.getElementById("sceneLocation").textContent = node.location || "Unknown";
    const narrativeEl = document.getElementById("sceneNarrative");
    if (narrativeEl) {
      narrativeEl.innerHTML = node.narrative || "";
      narrativeEl.classList.remove("tt-narrative--reveal");
      void narrativeEl.offsetWidth;
      narrativeEl.classList.add("tt-narrative--reveal");
    }

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
    }
    if (node.goldenRule && goldenRules.size > prevGoldenCount) {
      toast(`Golden Rule #${node.goldenRule} recovered`, "golden");
      burstConfetti(28);
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
      startedAt: startTime,
    });

    const typingEl = document.getElementById("typingChallenge");
    const choicesEl = document.getElementById("sceneChoices");
    const lessonEl = document.getElementById("sceneLesson");

    if (node.typingChallenge) {
      typingPending = node.typingChallenge;
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
    } else {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      const choices = resolveChoices(node, nodeId);
      choicesEl.innerHTML = choices.map((c, i) => `
        <button class="tt-choice" type="button" data-next="${escapeHtml(c.next)}" style="--tt-choice-i:${i}">
          <span class="tt-choice__glow" aria-hidden="true"></span>
          <span class="tt-choice__arrow">▶</span>
          <span class="tt-choice__label">${escapeHtml(c.label)}</span>
        </button>`).join("");

      choicesEl.querySelectorAll(".tt-choice").forEach((btn) => {
        btn.addEventListener("click", () => {
          const label = btn.querySelector(".tt-choice__label")?.textContent?.trim() || "Choice";
          journal.push(`→ ${label.slice(0, 80)}${label.length > 80 ? "…" : ""}`);
          btn.classList.add("tt-choice--picked");
          setTimeout(() => navigate(btn.dataset.next), prefersReducedMotion ? 0 : 220);
        });
      });
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
    if (fill) fill.style.width = `${pct}%`;
    if (countEl) {
      countEl.textContent = `${words} / ${minWords} words`;
      countEl.classList.toggle("tt-typing-count--ready", words >= minWords);
    }
  }

  function navigate(nodeId) {
    renderScene(nodeId);
  }

  function updateStats() {
    document.getElementById("statBadges").textContent = badges.size;
    document.getElementById("statLessons").textContent = lessons.size;
    document.getElementById("statScenes").textContent = journal.length;
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

  function renderEnding(node) {
    const isMentor = node.endingType === "mentor";
    document.getElementById("endingTitle").textContent = isMentor
      ? "Mentor Operative!"
      : node.endingType === "champion"
        ? "Gauntlet Champion!"
        : "Mission Complete!";
    document.getElementById("endingNarrative").innerHTML = node.narrative || "";
    document.getElementById("endingBadges").innerHTML = [...badges].map((b) => `<span class="tt-badge">${escapeHtml(b)}</span>`).join("");
    document.getElementById("endingLessons").textContent =
      `${lessons.size} lessons · ${badges.size} badges · ${goldenRules.size}/5 Golden Rules · ${metCharacters.size} mentors met`;

    const endingBg = document.getElementById("endingBg");
    if (endingBg) {
      const zone = Visuals.zoneForNode(node.endingType === "champion" ? "final_trial" : "start");
      endingBg.style.backgroundImage = `url('${zone.bg}')`;
    }

    renderGoldenTrack("endingGoldenTrack");
    renderResearchPanel();
    burstConfetti(isMentor ? 32 : 48);

    const runSnapshot = {
      currentNode,
      badges,
      lessons,
      goldenRules,
      journal,
      metCharacters,
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
    journal = ["🌐 Mission accepted"];
    startTime = Date.now();
  }

  function init() {
    loadDifficulty();
    renderTitleGoldenPreview();
    renderProfileMini();
    updateDifficultyButtons();

    document.querySelectorAll(".tt-difficulty__btn").forEach((btn) => {
      btn.addEventListener("click", () => saveDifficulty(btn.dataset.tier));
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

    startBtn?.addEventListener("click", () => {
      resetRun();
      renderScene("start");
    });

    continueBtn?.addEventListener("click", () => {
      const saved = State.loadRun();
      if (saved) {
        currentNode = saved.currentNode;
        badges = saved.badges;
        lessons = saved.lessons;
        goldenRules = saved.goldenRules;
        journal = saved.journal;
        metCharacters = saved.metCharacters;
        startTime = saved.startedAt || Date.now();
        renderScene(currentNode);
      } else {
        resetRun();
        renderScene("start");
      }
    });

    newRunBtn?.addEventListener("click", () => {
      resetRun();
      renderScene("start");
    });

    document.getElementById("playAgainBtn")?.addEventListener("click", () => {
      resetRun();
      show("title");
      renderTitleGoldenPreview();
      renderProfileMini();
    });

    const viewport = document.getElementById("sceneViewport");
    viewport?.addEventListener("mousemove", (e) => tiltStage(e.clientX, e.clientY));
    viewport?.addEventListener("mouseleave", resetStageTilt);

    const typingInput = document.getElementById("typingInput");
    Core.setupPasteControl(typingInput, false);

    typingInput?.addEventListener("input", () => {
      const words = Core.countWords(typingInput.value);
      const min = scaleMinWords(typingPending?.minWords || 20);
      updateTypingProgress(words, min);
      document.getElementById("typingSubmitBtn").disabled = words < min;
      State.saveDraft(typingInput.value);
    });

    document.getElementById("typingSubmitBtn")?.addEventListener("click", () => {
      if (!typingPending) return;
      const words = Core.countWords(typingInput.value);
      if (words < scaleMinWords(typingPending.minWords || 20)) return;
      journal.push(`⌨️ Oath drafted (${words} words)`);
      toast("Response submitted", "badge");
      burstConfetti(20);
      State.clearDraft();

      const nextNode = STORY[typingPending.next];
      const isEnding = nextNode && nextNode.ending;
      if (isEnding) {
        showIdentityGate(() => navigate(typingPending.next));
      } else {
        navigate(typingPending.next);
      }
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
    } catch (e) {
      State.queueOfflineSubmission(submission);
      toast("Saved locally — will retry when online.", "lesson");
    }

    hideIdentityGate();
    window._identityGateCallback?.();
  }

  init();
})();

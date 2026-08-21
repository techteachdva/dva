/**
 * Global Tech Gauntlet — CYOA digital citizenship typing adventure.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  const { STORY, CHARACTERS, START_MISSIONS } = window.TechTrailStory || {};
  const Visuals = window.TechTrailVisuals;
  const State = window.TechTrailState;
  const Audio = window.TechTrailAudio;
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
  let integrity = 100;
  let reputation = 50;
  let mentorTrust = {};
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
  let typewriterActive = false;
  let typewriterQueue = [];
  let typewriterResolve = null;
  const CHOICE_COOLDOWN_MS = 1200;
  const SCENE_LOADER_MIN_MS = 800;
  const TYPEWRITER_MIN_DWELL_MS = 1200;

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

  function splitNarrativeIntoParagraphs(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    const text = div.textContent || "";
    const rawParas = text.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
    if (rawParas.length <= 1) return [html];
    const result = [];
    let remaining = html;
    for (let i = 0; i < rawParas.length; i++) {
      const end = remaining.indexOf(rawParas[i]) + rawParas[i].length;
      result.push(remaining.slice(0, end));
      remaining = remaining.slice(end);
    }
    if (remaining.trim()) result.push(remaining.trim());
    return result.length ? result : [html];
  }

  async function typewriteNarrative(container, html) {
    const narrativeEl = document.getElementById("sceneNarrative");
    const continueBtn = document.getElementById("narrativeContinueBtn");
    if (!narrativeEl) return;

    if (prefersReducedMotion) {
      narrativeEl.innerHTML = html;
      narrativeEl.classList.remove("tt-narrative--typing");
      continueBtn?.classList.add("dw-hidden");
      narrativeEl.focus();
      return;
    }

    const paragraphs = splitNarrativeIntoParagraphs(html);
    narrativeEl.innerHTML = "";
    narrativeEl.classList.add("tt-narrative--typing");
    continueBtn?.classList.add("dw-hidden");

    for (let i = 0; i < paragraphs.length; i++) {
      const paraDiv = document.createElement("div");
      paraDiv.className = "tt-narrative__para";
      narrativeEl.appendChild(paraDiv);

      const fullText = paragraphs[i];
      let current = "";
      const speed = 25;
      const tagRe = /<[^>]+>/g;
      let pos = 0;
      const paraStartTime = performance.now();

      while (pos < fullText.length) {
        const nextTag = tagRe.exec(fullText);
        if (nextTag && nextTag.index === pos) {
          current += nextTag[0];
          pos += nextTag[0].length;
          tagRe.lastIndex = pos;
          continue;
        }
        current += fullText[pos];
        pos++;
        paraDiv.innerHTML = current;
        await new Promise((r) => setTimeout(r, speed));
      }

      if (i < paragraphs.length - 1) {
        const elapsed = performance.now() - paraStartTime;
        const remaining = Math.max(0, TYPEWRITER_MIN_DWELL_MS - elapsed);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
        continueBtn?.classList.remove("dw-hidden");
        narrativeEl.classList.remove("tt-narrative--typing");
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
          };
          continueBtn?.addEventListener("click", handler);
          document.addEventListener("keydown", handler);
        });
        continueBtn?.classList.add("dw-hidden");
        narrativeEl.classList.add("tt-narrative--typing");
      }
    }

    narrativeEl.classList.remove("tt-narrative--typing");
    continueBtn?.classList.add("dw-hidden");
    narrativeEl.focus();
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
      narrativeEl.classList.remove("tt-narrative--reveal");
      void narrativeEl.offsetWidth;
      narrativeEl.classList.add("tt-narrative--reveal");
      typewriteNarrative(narrativeEl, node.narrative || "");
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
        <button class="tt-choice tt-choice--cooldown" type="button" data-next="${escapeHtml(c.next)}" data-choice-idx="${i}" style="--tt-choice-i:${i}">
          <span class="tt-choice__glow" aria-hidden="true"></span>
          <span class="tt-choice__arrow">▶</span>
          <span class="tt-choice__label">${escapeHtml(c.label)}</span>
          ${c.integrity < 0 || c.reputation < 0 ? '<span class="tt-choice__risk" aria-hidden="true">⚠️</span>' : ""}
        </button>`).join("");

      const choiceButtons = choicesEl.querySelectorAll(".tt-choice");
      choiceButtons.forEach((btn) => {
        const choiceIdx = Number(btn.dataset.choiceIdx ?? -1);
        const choiceData = choices[choiceIdx] || {};
        btn.addEventListener("click", () => {
          Audio?.playChoiceClick?.();
          const label = btn.querySelector(".tt-choice__label")?.textContent?.trim() || "Choice";
          journal.push(`→ ${label.slice(0, 80)}${label.length > 80 ? "…" : ""}`);
          btn.classList.add("tt-choice--picked");
          applyChoiceEffects(choiceData);
          setTimeout(() => navigate(btn.dataset.next), prefersReducedMotion ? 0 : 220);
        });
      });
      if (!prefersReducedMotion) {
        setTimeout(() => {
          choiceButtons.forEach((b) => b.classList.remove("tt-choice--cooldown"));
        }, CHOICE_COOLDOWN_MS);
      } else {
        choiceButtons.forEach((b) => b.classList.remove("tt-choice--cooldown"));
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
    if (fill) fill.style.width = `${pct}%`;
    if (countEl) {
      countEl.textContent = `${words} / ${minWords} words`;
      countEl.classList.toggle("tt-typing-count--ready", words >= minWords);
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
    loadDifficulty();
    loadHighContrast();
    renderTitleGoldenPreview();
    renderProfileMini();
    updateDifficultyButtons();
    updateMuteButton();

    document.querySelectorAll(".tt-difficulty__btn").forEach((btn) => {
      btn.addEventListener("click", () => saveDifficulty(btn.dataset.tier));
    });

    document.getElementById("highContrastToggle")?.addEventListener("click", toggleHighContrast);
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

    startBtn?.addEventListener("click", () => {
      Audio?.init?.();
      resetRun();
      showSceneLoader();
      setTimeout(() => { renderScene("start"); hideSceneLoader(); }, SCENE_LOADER_MIN_MS);
    });

    continueBtn?.addEventListener("click", () => {
      Audio?.init?.();
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

    newRunBtn?.addEventListener("click", () => {
      Audio?.init?.();
      resetRun();
      showSceneLoader();
      setTimeout(() => { renderScene("start"); hideSceneLoader(); }, SCENE_LOADER_MIN_MS);
    });

    document.getElementById("playAgainBtn")?.addEventListener("click", () => {
      Audio?.stopZoneAmbience?.();
      resetRun();
      show("title");
      renderTitleGoldenPreview();
      renderProfileMini();
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
      const words = Core.countWords(typingInput.value);
      if (words < scaleMinWords(typingPending.minWords || 20)) return;
      journal.push(`⌨️ Oath drafted (${words} words)`);
      toast("Transmitting response...", "badge");
      burstConfetti(20);
      State.clearDraft();

      const nextNode = STORY[typingPending.next];
      const isEnding = nextNode && nextNode.ending;
      showSceneLoader();
      setTimeout(() => {
        hideSceneLoader();
        if (isEnding) {
          showIdentityGate(() => navigate(typingPending.next));
        } else {
          navigate(typingPending.next);
        }
      }, SCENE_LOADER_MIN_MS);
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

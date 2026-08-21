/**
 * Global Tech Gauntlet — CYOA digital citizenship typing adventure.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  const { STORY, CHARACTERS } = window.TechTrailStory || {};
  const Visuals = window.TechTrailVisuals;
  if (!Core || !STORY || !Visuals) return;

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

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

  function renderScene(nodeId) {
    const node = STORY[nodeId];
    if (!node) return;
    currentNode = nodeId;

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
      toast(`Golden Rule #${node.goldenRule} recovered!`, "golden");
      burstConfetti(28);
    }

    updateStats();
    renderGoldenTrack();

    const typingEl = document.getElementById("typingChallenge");
    const choicesEl = document.getElementById("sceneChoices");
    const lessonEl = document.getElementById("sceneLesson");

    if (lessonEl) lessonEl.classList.add("dw-hidden");

    if (node.typingChallenge) {
      typingPending = node.typingChallenge;
      typingEl.classList.remove("dw-hidden");
      choicesEl.innerHTML = "";
      document.getElementById("typingPrompt").textContent = node.typingChallenge.prompt;
      document.getElementById("typingInput").value = "";
      updateTypingProgress(0, typingPending.minWords || 20);
      document.getElementById("typingSubmitBtn").disabled = true;
      toast("Typing challenge — read the prompt carefully", "info");
    } else {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      choicesEl.innerHTML = (node.choices || []).map((c, i) => `
        <button class="tt-choice" type="button" data-next="${escapeHtml(c.next)}" data-lesson="${escapeHtml(c.lesson || "")}" style="--tt-choice-i:${i}">
          <span class="tt-choice__glow" aria-hidden="true"></span>
          <span class="tt-choice__arrow">▶</span>
          <span class="tt-choice__label">${escapeHtml(c.label)}</span>
          ${c.lesson ? `<span class="tt-choice__tag">ITEM ${escapeHtml(c.lesson)}</span>` : ""}
        </button>`).join("");

      choicesEl.querySelectorAll(".tt-choice").forEach((btn) => {
        btn.addEventListener("click", () => {
          const lesson = btn.dataset.lesson;
          if (lesson) recordLesson(lesson);
          journal.push(`→ ${btn.querySelector(".tt-choice__label")?.textContent?.trim().slice(0, 80) || "Choice"}…`);
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

  function recordLesson(code) {
    lessons.add(code);
    journal.push(`📚 ITEM ${code}`);
    const lessonEl = document.getElementById("sceneLesson");
    if (lessonEl) {
      lessonEl.classList.remove("dw-hidden");
      lessonEl.innerHTML = `<span class="qz-standard">ITEM ${escapeHtml(code)}</span> Standard explored — logged to your mission record.`;
      if (!prefersReducedMotion) {
        lessonEl.classList.remove("tt-lesson-flash--show");
        void lessonEl.offsetWidth;
        lessonEl.classList.add("tt-lesson-flash--show");
      }
    }
    toast(`ITEM ${code} — lesson logged`, "lesson");
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
      `${lessons.size} ITEM standards · ${badges.size} badges · ${goldenRules.size}/5 Golden Rules · ${metCharacters.size} heroes met`;

    const endingBg = document.getElementById("endingBg");
    if (endingBg) {
      const zone = Visuals.zoneForNode(node.endingType === "champion" ? "final_trial" : "start");
      endingBg.style.backgroundImage = `url('${zone.bg}')`;
    }

    renderGoldenTrack("endingGoldenTrack");
    renderResearchPanel();
    burstConfetti(isMentor ? 32 : 48);
  }

  function resetRun() {
    badges.clear();
    lessons.clear();
    goldenRules.clear();
    metCharacters.clear();
    journal = ["🌐 Mission accepted: Global Tech Gauntlet"];
  }

  function init() {
    renderTitleGoldenPreview();

    document.getElementById("startGameBtn")?.addEventListener("click", () => {
      resetRun();
      renderScene("start");
    });

    document.getElementById("playAgainBtn")?.addEventListener("click", () => {
      resetRun();
      show("title");
      renderTitleGoldenPreview();
    });

    const viewport = document.getElementById("sceneViewport");
    viewport?.addEventListener("mousemove", (e) => tiltStage(e.clientX, e.clientY));
    viewport?.addEventListener("mouseleave", resetStageTilt);

    const typingInput = document.getElementById("typingInput");
    Core.setupPasteControl(typingInput, false);

    typingInput?.addEventListener("input", () => {
      const words = Core.countWords(typingInput.value);
      const min = typingPending?.minWords || 20;
      updateTypingProgress(words, min);
      document.getElementById("typingSubmitBtn").disabled = words < min;
    });

    document.getElementById("typingSubmitBtn")?.addEventListener("click", () => {
      if (!typingPending) return;
      const words = Core.countWords(typingInput.value);
      if (words < (typingPending.minWords || 20)) return;
      journal.push(`⌨️ Typed ${words} words — challenge complete`);
      toast("Response submitted!", "badge");
      burstConfetti(20);
      navigate(typingPending.next);
    });

    show("title");
  }

  init();
})();

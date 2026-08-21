/**
 * Tech Trail — CYOA digital citizenship typing adventure.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  const { STORY, CHARACTERS } = window.TechTrailStory || {};
  if (!Core || !STORY) return;

  Core.applyTheme(Core.PRESETS.sandiego);

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

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function show(name) {
    Core.showView(views, name);
  }

  function renderScene(nodeId) {
    const node = STORY[nodeId];
    if (!node) return;
    currentNode = nodeId;

    document.getElementById("sceneLocation").textContent = node.location || "Unknown";
    document.getElementById("sceneNarrative").innerHTML = node.narrative || "";

    const char = CHARACTERS[node.character] || CHARACTERS.guide;
    metCharacters.add(node.character);
    const charEl = document.getElementById("sceneCharacter");
    if (charEl) {
      charEl.innerHTML = `
        <div class="tt-character__avatar">${char.emoji}</div>
        <div>
          <div class="tt-character__name">${escapeHtml(char.name)}</div>
          <div class="tt-character__role">${escapeHtml(char.role)} · ${escapeHtml(char.era)}</div>
        </div>`;
    }

    if (node.badge) {
      badges.add(node.badge);
      journal.push(`🏅 Badge: ${node.badge}`);
    }
    if (node.goldenRule) {
      goldenRules.add(node.goldenRule);
      journal.push(`⭐ Golden Rule #${node.goldenRule} recovered`);
    }

    updateStats();

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
      document.getElementById("typingWordCount").textContent = "0 words";
      document.getElementById("typingSubmitBtn").disabled = true;
    } else {
      typingEl.classList.add("dw-hidden");
      typingPending = null;
      choicesEl.innerHTML = (node.choices || []).map((c) => `
        <button class="tt-choice" type="button" data-next="${escapeHtml(c.next)}" data-lesson="${escapeHtml(c.lesson || "")}">
          <span class="tt-choice__arrow">▶</span>
          <span>${escapeHtml(c.label)}</span>
          ${c.lesson ? `<span class="qz-standard" style="margin-left:auto;font-size:11px;">ITEM ${escapeHtml(c.lesson)}</span>` : ""}
        </button>`).join("");

      choicesEl.querySelectorAll(".tt-choice").forEach((btn) => {
        btn.addEventListener("click", () => {
          const lesson = btn.dataset.lesson;
          if (lesson) recordLesson(lesson);
          journal.push(`→ ${btn.textContent.trim().slice(0, 80)}…`);
          navigate(btn.dataset.next);
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

  function recordLesson(code) {
    lessons.add(code);
    journal.push(`📚 ITEM ${code}`);
    const lessonEl = document.getElementById("sceneLesson");
    if (lessonEl) {
      lessonEl.classList.remove("dw-hidden");
      lessonEl.innerHTML = `<span class="qz-standard">ITEM ${escapeHtml(code)}</span> Standard explored — check your mission log.`;
    }
  }

  function navigate(nodeId) {
    renderScene(nodeId);
  }

  function updateStats() {
    document.getElementById("statBadges").textContent = badges.size;
    document.getElementById("statLessons").textContent = lessons.size;
    document.getElementById("statScenes").textContent = journal.length;
    const grEl = document.getElementById("statGoldenRules");
    if (grEl) grEl.textContent = goldenRules.size;
  }

  function renderJournal() {
    const el = document.getElementById("journalEntries");
    if (!el) return;
    el.innerHTML = journal.slice(-10).reverse().map((e) => `<div class="tt-journal__entry">${escapeHtml(e)}</div>`).join("") || '<div class="tt-journal__entry">Your adventure begins…</div>';
  }

  function renderResearchPanel() {
    const el = document.getElementById("researchPanel");
    if (!el) return;
    const chars = [...metCharacters].filter((k) => CHARACTERS[k]?.research).slice(-4);
    el.innerHTML = chars.map((k) => {
      const c = CHARACTERS[k];
      return `<div class="tt-journal__entry"><strong>${escapeHtml(c.name)}:</strong> ${escapeHtml(c.research)}</div>`;
    }).join("");
  }

  function renderEnding(node) {
    const isMentor = node.endingType === "mentor";
    document.getElementById("endingTitle").textContent = isMentor ? "Mentor Operative!" : "Mission Complete!";
    document.getElementById("endingNarrative").innerHTML = node.narrative || "";
    document.getElementById("endingBadges").innerHTML = [...badges].map((b) => `<span class="tt-badge">${escapeHtml(b)}</span>`).join("");
    document.getElementById("endingLessons").textContent =
      `${lessons.size} ITEM standards · ${badges.size} badges · ${goldenRules.size}/5 Golden Rules · ${metCharacters.size} heroes met`;
    renderResearchPanel();
  }

  function init() {
    document.getElementById("startGameBtn")?.addEventListener("click", () => {
      badges.clear();
      lessons.clear();
      goldenRules.clear();
      metCharacters.clear();
      journal = ["🌐 Mission accepted: Global Tech Gauntlet"];
      renderScene("start");
    });

    document.getElementById("playAgainBtn")?.addEventListener("click", () => {
      badges.clear();
      lessons.clear();
      goldenRules.clear();
      metCharacters.clear();
      journal = [];
      renderScene("start");
    });

    const typingInput = document.getElementById("typingInput");
    Core.setupPasteControl(typingInput, false);

    typingInput?.addEventListener("input", () => {
      const words = Core.countWords(typingInput.value);
      document.getElementById("typingWordCount").textContent = `${words} word${words === 1 ? "" : "s"}`;
      document.getElementById("typingSubmitBtn").disabled = words < (typingPending?.minWords || 20);
    });

    document.getElementById("typingSubmitBtn")?.addEventListener("click", () => {
      if (!typingPending) return;
      const words = Core.countWords(typingInput.value);
      if (words < (typingPending.minWords || 20)) return;
      journal.push(`⌨️ Typed ${words} words — challenge complete`);
      navigate(typingPending.next);
    });

    show("title");
  }

  init();
})();

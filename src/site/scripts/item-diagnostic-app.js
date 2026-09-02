/**
 * ITEM 2025 Diagnostic — typing warm-up + standards knowledge quiz.
 */
(() => {
  "use strict";

  const Core = window.WriteTestCore;
  const Bank = window.ITEMDiagnostic;
  if (!Core || !Bank) return;

  const VALID_CLASSROOMS = Core.loadJsonScript("itemClassroomsJson", []);
  const CLASSROOM_CODES = Core.loadJsonScript("itemClassroomCodesJson", {});
  const API_URL = "/api/item-diagnostic-submissions";

  const views = {
    welcome: document.getElementById("welcomeView"),
    typing: document.getElementById("typingView"),
    quiz: document.getElementById("quizView"),
    analyzing: document.getElementById("analyzingView"),
    results: document.getElementById("resultsView"),
    teacherLogin: document.getElementById("teacherLoginView"),
    teacher: document.getElementById("teacherView"),
  };

  let timer = null;
  let quizQuestions = [];
  let quizIndex = 0;
  let quizAnswers = [];
  let selectedOptions = new Set();
  let quizPhase = "select";
  let typingText = "";
  let typingAnalysis = null;

  const GLYPHS = ["A", "B", "C", "D", "E"];

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function show(name) {
    Core.showView(views, name);
  }

  function canStart() {
    const name = document.getElementById("studentName")?.value.trim();
    const classroom = Core.resolveClassroom(document.getElementById("studentClass")?.value, VALID_CLASSROOMS);
    const codeOk = Core.verifyClassroomCode(classroom, document.getElementById("classCode")?.value, CLASSROOM_CODES);
    return Boolean(name && classroom && codeOk);
  }

  function updateStartButton() {
    document.getElementById("startBtn").disabled = !canStart();
  }

  function finishTyping() {
    const input = document.getElementById("typingInput");
    if (input) input.readOnly = true;
    timer?.stop();
    typingText = input?.value || "";
    typingAnalysis = window.WriteAnalysis?.analyzeText(typingText, Bank.TYPING_DURATION) || null;
    startQuiz();
  }

  function startQuiz() {
    const pool = Bank.getQuestions();
    quizQuestions = Bank.drawQuestions(pool, Bank.QUIZ_COUNT).map((q) => Core.shuffleOptions(q));
    quizIndex = 0;
    quizAnswers = [];
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const q = quizQuestions[quizIndex];
    if (!q) { finishQuiz(); return; }

    selectedOptions = new Set();
    quizPhase = "select";

    document.getElementById("quizProgress").textContent =
      `Question ${quizIndex + 1} of ${quizQuestions.length || Bank.QUIZ_COUNT}`;
    document.getElementById("quizStandard").textContent = `ITEM ${q.std}`;
    document.getElementById("quizQuestion").textContent = q.q;

    const multi = q.correct.length > 1;
    document.getElementById("quizMultiselect").classList.toggle("dw-hidden", !multi);
    if (multi) {
      document.getElementById("quizMultiselect").textContent =
        `SELECT ALL THAT APPLY — ${q.correct.length} CORRECT`;
    }

    const opts = document.getElementById("quizOptions");
    opts.innerHTML = q.a.map((text, i) => `
      <li class="qz-option${multi ? " qz-option--checkbox" : ""}" data-idx="${i}" role="button" tabindex="0">
        <span class="qz-option__glyph">${GLYPHS[i]}</span>
        <span>${escapeHtml(text)}</span>
      </li>`).join("");

    document.getElementById("quizFeedback").classList.add("dw-hidden");
    document.getElementById("quizConfirmBtn").disabled = true;
    document.getElementById("quizConfirmBtn").textContent = "Confirm answer";

    opts.querySelectorAll(".qz-option").forEach((el) => {
      el.addEventListener("click", () => selectOption(Number(el.dataset.idx), multi));
    });

    document.getElementById("quizView")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectOption(idx, multi) {
    if (quizPhase !== "select") return;
    if (multi) {
      if (selectedOptions.has(idx)) selectedOptions.delete(idx);
      else selectedOptions.add(idx);
    } else {
      selectedOptions = new Set([idx]);
    }
    document.querySelectorAll(".qz-option").forEach((el, i) => {
      el.classList.toggle("qz-option--selected", selectedOptions.has(i));
    });
    document.getElementById("quizConfirmBtn").disabled = selectedOptions.size === 0;
  }

  function confirmAnswer() {
    if (quizPhase !== "select") return;
    const q = quizQuestions[quizIndex];
    const selected = [...selectedOptions].sort((a, b) => a - b);
    const correct = [...q.correct].sort((a, b) => a - b);
    const isCorrect = selected.length === correct.length && selected.every((v, i) => v === correct[i]);

    quizAnswers.push({
      id: q.id,
      std: q.std,
      stdLabel: q.stdLabel,
      topic: q.topic,
      correct: isCorrect,
      selected,
      correctIdx: correct,
      question: q.q,
      options: [...q.a],
      why: q.why,
      selectedText: selected.map((i) => q.a[i]),
      correctText: correct.map((i) => q.a[i]),
    });

    quizPhase = "feedback";
    document.querySelectorAll(".qz-option").forEach((el, i) => {
      el.classList.remove("qz-option--selected");
      if (correct.includes(i)) el.classList.add("qz-option--accepted");
      else if (selected.includes(i)) el.classList.add("qz-option--denied");
    });

    const fb = document.getElementById("quizFeedback");
    fb.classList.remove("dw-hidden");
    fb.className = `qz-feedback ${isCorrect ? "qz-feedback--correct" : "qz-feedback--wrong"}`;
    fb.innerHTML = `<strong>${isCorrect ? "Correct!" : "Not quite."}</strong> ${escapeHtml(q.why)}`;

    document.getElementById("quizConfirmBtn").textContent = quizIndex < quizQuestions.length - 1 ? "Next question" : "See results";
    document.getElementById("quizConfirmBtn").disabled = false;
  }

  function nextQuizStep() {
    if (quizPhase === "select") { confirmAnswer(); return; }
    quizIndex++;
    if (quizIndex >= quizQuestions.length) finishQuiz();
    else renderQuestion();
  }

  async function finishQuiz() {
    show("analyzing");

    const name = document.getElementById("studentName")?.value.trim() || "Student";
    const classroom = Core.resolveClassroom(document.getElementById("studentClass")?.value, VALID_CLASSROOMS) || "";
    const classCode = document.getElementById("classCode")?.value || "";
    const stdResults = Bank.mapResultsToStandards(quizAnswers);
    const quizScore = quizAnswers.filter((a) => a.correct).length;
    const quizPct = Math.round((quizScore / quizAnswers.length) * 100);
    const topics = Bank.topicSummary(quizAnswers);

    let saveOk = false;
    let saveError = "";
    if (!classroom) {
      saveError = "Your class was not recognized. Go back, pick your class from the list, and try again.";
    } else if (!Core.verifyClassroomCode(classroom, classCode, CLASSROOM_CODES)) {
      saveError = "Your class code did not match. Go back and enter the code your teacher gave you.";
    } else {
      try {
        await submitResult({
          name,
          classroom,
          classCode,
          typingText,
          typingAnalysis,
          quizAnswers,
          standards: stdResults,
          topics,
          quizScore,
          quizTotal: quizAnswers.length,
          quizPct,
          durationSec: Bank.TYPING_DURATION,
        });
        saveOk = true;
      } catch (err) {
        saveError = err.message || "Could not save your submission.";
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 800));
    showResults(saveOk, saveError);
  }

  async function submitResult(payload) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Save failed (${res.status})`);
    }
    return data;
  }

  function showResults(saveOk = false, saveError = "") {
    const name = document.getElementById("studentName")?.value.trim() || "Student";
    const classroom = Core.resolveClassroom(document.getElementById("studentClass")?.value, VALID_CLASSROOMS) || "—";
    const stdResults = Bank.mapResultsToStandards(quizAnswers);
    const quizScore = quizAnswers.filter((a) => a.correct).length;
    const quizPct = Math.round((quizScore / quizAnswers.length) * 100);

    document.getElementById("resultName").textContent = name;
    document.getElementById("resultClass").textContent = classroom;
    document.getElementById("resultSummary").textContent =
      `Knowledge: ${quizScore}/${quizAnswers.length} (${quizPct}%) · Typing: ${typingAnalysis?.wpm ?? "—"} WPM, ${typingAnalysis?.wordCount ?? 0} words`;

    const saveStatus = document.getElementById("saveStatus");
    if (saveStatus) {
      saveStatus.classList.remove("dw-hidden", "dw-save-status--ok", "dw-save-status--error");
      if (saveOk) {
        saveStatus.textContent = "Saved to your class roster. Your teacher can view this from any computer.";
        saveStatus.classList.add("dw-save-status--ok");
      } else {
        saveStatus.textContent = saveError || "Could not save to the class roster. Tell your teacher and try again.";
        saveStatus.classList.add("dw-save-status--error");
      }
    }

    const gaps = stdResults.filter((s) => s.level === "gap");
    const strong = stdResults.filter((s) => s.level === "strong");

    document.getElementById("gapSummary").innerHTML = gaps.length
      ? `<p class="dw-lead">Focus areas: ${gaps.map((g) => `<strong>ITEM ${g.code}</strong> (${g.title})`).join(", ")}</p>`
      : `<p class="dw-lead">Great work — no major standard gaps detected on this run!</p>`;

    document.getElementById("standardsGrid").innerHTML = stdResults.map((s) => `
      <div class="std-card std-card--${s.level}">
        <div class="std-card__code">ITEM ${escapeHtml(s.code)}</div>
        <div class="std-card__title">${escapeHtml(s.title || "Standard")}</div>
        <div class="std-card__score">${s.correct}/${s.total} correct · ${s.pct}% · ${escapeHtml(s.strand || "")}</div>
      </div>`).join("");

    const topics = Bank.topicSummary(quizAnswers);
    document.getElementById("topicSummary").innerHTML = `
      <div class="dw-score-grid dw-score-grid--4">
        ${Object.entries(topics).map(([t, [ok, total]]) => `
          <div class="dw-score-card">
            <div class="dw-score-card__title">${escapeHtml(t.charAt(0).toUpperCase() + t.slice(1))}</div>
            <div class="dw-score-card__value">${total ? Math.round((ok / total) * 100) : 0}%</div>
            <div class="dw-muted dw-tiny">${ok}/${total} correct</div>
          </div>`).join("")}
      </div>`;

    document.getElementById("typingSummary").innerHTML = typingAnalysis ? `
      <div class="dw-score-grid dw-score-grid--4">
        <div class="dw-score-card"><div class="dw-score-card__title">Words</div><div class="dw-score-card__value">${typingAnalysis.wordCount}</div></div>
        <div class="dw-score-card"><div class="dw-score-card__title">WPM</div><div class="dw-score-card__value">${typingAnalysis.wpm}</div></div>
        <div class="dw-score-card"><div class="dw-score-card__title">Typing</div><div class="dw-score-card__value">${typingAnalysis.scores?.typing ?? "—"}</div></div>
        <div class="dw-score-card"><div class="dw-score-card__title">Tier</div><div class="dw-score-card__value dw-tiny">${typingAnalysis.typingLevel}</div></div>
      </div>` : "";

    show("results");
  }

  function boot() {
    Core.applyTheme(Core.PRESETS.item);
    Core.populateClassSelect(document.getElementById("studentClass"), VALID_CLASSROOMS);
    bindEvents();
    updateStartButton();
    show("welcome");
  }

  function bindEvents() {

    const typingInput = document.getElementById("typingInput");
    Core.setupPasteControl(typingInput, false);

    timer = Core.createTimer({
      durationSec: Bank.TYPING_DURATION,
      displayEl: document.getElementById("timerDisplay"),
      progressEl: document.getElementById("timerProgress"),
      onComplete: finishTyping,
    });
    Core.setupLiveStats(typingInput, document.getElementById("liveWordCount"), document.getElementById("liveWpm"), () => timer?.getElapsed() || 0);

    document.getElementById("studentName")?.addEventListener("input", updateStartButton);
    document.getElementById("studentClass")?.addEventListener("change", updateStartButton);
    document.getElementById("classCode")?.addEventListener("input", updateStartButton);

    document.getElementById("startBtn")?.addEventListener("click", () => {
      if (!canStart()) return;
      typingInput.value = "";
      typingInput.readOnly = false;
      show("typing");
      typingInput.focus();
      timer.start();
    });

    document.getElementById("quizConfirmBtn")?.addEventListener("click", nextQuizStep);
    document.getElementById("restartBtn")?.addEventListener("click", () => location.reload());
  }

  if (window.ITEMDiagnosticBank) boot();
  else window.addEventListener("item-diagnostic-ready", boot);
})();

(() => {
  "use strict";

  const DURATION_SEC = 300;
  const TEACHER_PASSWORD = "studentsfirst";
  const API_URL = "/api/diagnostic-writing-submissions";

  const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "is", "was", "it", "i", "we", "they", "he", "she", "my", "our", "that",
    "this", "with", "as", "be", "had", "have", "has", "were", "are", "am",
    "so", "if", "not", "by", "from", "up", "out", "just", "like", "very",
  ]);

  const COMMON_MISSPELLINGS = {
    teh: "the", recieve: "receive", becuase: "because", wierd: "weird",
    freind: "friend", definately: "definitely", alot: "a lot", seperate: "separate",
    occured: "occurred", thier: "their", untill: "until", realy: "really",
    gonne: "gonna", somthing: "something", diffrent: "different", beautifull: "beautiful",
    happend: "happened", finaly: "finally", basicly: "basically", writting: "writing",
    swiming: "swimming", runing: "running", dont: "don't", wont: "won't", cant: "can't",
    didnt: "didn't", wasnt: "wasn't", couldnt: "couldn't", wouldnt: "wouldn't",
    im: "I'm", ive: "I've", youre: "you're", theyre: "they're", weve: "we've",
  };

  const SENSORY_PATTERN =
    /\b(saw|see|seen|heard|hear|felt|feel|smelled|smell|tasted|taste|touched|touch|bright|dark|loud|quiet|soft|rough|smooth|sweet|sour|cold|warm|hot|scary|exciting|beautiful|amazing|funny|nervous|happy|sad|angry|surprised|giggled|laughed|cried|shivered|gasped)\b/gi;

  const SUBORDINATOR_PATTERN =
    /\b(because|although|though|while|when|if|since|unless|until|before|after|where|whereas|even though|so that|in order to|as soon as|whenever|wherever|as|but|and|or)\b/gi;

  const TRANSITION_PATTERN =
    /\b(then|next|finally|suddenly|meanwhile|later|afterward|eventually|one day|that day|first|second|lastly|soon|before long|at first|in the end)\b/gi;

  const CONCRETE_PATTERN =
    /\b(house|beach|pool|park|school|friend|mom|dad|brother|sister|dog|cat|bike|car|boat|lake|river|tree|food|pizza|ice cream|summer|morning|night)\b/gi;

  const VOICE_PATTERN = /\b(i|me|my|mine|we|us|our|myself)\b/gi;

  const views = {
    welcome: document.getElementById("welcomeView"),
    writing: document.getElementById("writingView"),
    analyzing: document.getElementById("analyzingView"),
    results: document.getElementById("resultsView"),
    teacherLogin: document.getElementById("teacherLoginView"),
    teacher: document.getElementById("teacherView"),
  };

  const studentName = document.getElementById("studentName");
  const studentClass = document.getElementById("studentClass");
  const startBtn = document.getElementById("startBtn");
  const storyInput = document.getElementById("storyInput");
  const timerDisplay = document.getElementById("timerDisplay");
  const timerProgress = document.getElementById("timerProgress");
  const liveWordCount = document.getElementById("liveWordCount");
  const liveWpm = document.getElementById("liveWpm");
  const restartBtn = document.getElementById("restartBtn");
  const teacherBtn = document.getElementById("teacherBtn");
  const teacherPassword = document.getElementById("teacherPassword");
  const teacherLoginBtn = document.getElementById("teacherLoginBtn");
  const teacherCancelBtn = document.getElementById("teacherCancelBtn");
  const teacherLoginError = document.getElementById("teacherLoginError");
  const teacherLogoutBtn = document.getElementById("teacherLogoutBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportBtn = document.getElementById("exportBtn");
  const teacherTableBody = document.getElementById("teacherTableBody");
  const teacherMeta = document.getElementById("teacherMeta");
  const emptyState = document.getElementById("emptyState");
  const detailPanel = document.getElementById("detailPanel");
  const filterBar = document.getElementById("filterBar");
  const classFilter = document.getElementById("classFilter");

  let timerInterval = null;
  let elapsedSec = 0;
  let startTime = 0;
  let currentFilter = "all";
  let currentClassFilter = "all";
  let allSubmissions = [];
  let teacherAuthed = false;
  let selectedClassroom = "";

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("dw-hidden", key !== name);
    });
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  }

  function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function canStart() {
    return Boolean(studentName.value.trim() && studentClass.value);
  }

  function updateStartButton() {
    startBtn.disabled = !canStart();
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function scoreFromRange(value, breakpoints) {
    for (let i = 0; i < breakpoints.length - 1; i++) {
      const [v0, s0] = breakpoints[i];
      const [v1, s1] = breakpoints[i + 1];
      if (value <= v1) {
        const t = (value - v0) / (v1 - v0 || 1);
        return Math.round(s0 + t * (s1 - s0));
      }
    }
    return breakpoints[breakpoints.length - 1][1];
  }

  function getSentences(text) {
    return text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  }

  function normalizeWord(w) {
    return w.toLowerCase().replace(/[^\w']/g, "");
  }

  function analyzeSpelling(text, words) {
    const issues = [];
    const lowerWords = words.map(normalizeWord);
    let misspellCount = 0;

    for (let i = 0; i < lowerWords.length; i++) {
      const w = lowerWords[i];
      if (COMMON_MISSPELLINGS[w]) {
        misspellCount++;
        if (issues.length < 5) issues.push(`"${words[i]}" → try "${COMMON_MISSPELLINGS[w]}"`);
      }
    }

    const doubledLetter = /\b(\w{3,})\1{2,}\b/gi;
    const doubled = (text.match(doubledLetter) || []).length;
    misspellCount += doubled;

    const apostropheErrors = (text.match(/\bi\b/g) || []).length;
    const rate = words.length > 0 ? misspellCount / words.length : 0;
    const score = clamp(Math.round(100 - rate * 400 - apostropheErrors * 3), 0, 100);

    return {
      score,
      misspellCount,
      apostropheErrors,
      issues,
      rate: Math.round(rate * 1000) / 10,
    };
  }

  function analyzeGrammar(text, sentences, words) {
    const issues = [];
    let errorCount = 0;

    for (const sent of sentences) {
      const trimmed = sent.trim();
      if (!trimmed) continue;
      if (/^[a-z]/.test(trimmed)) {
        errorCount++;
        if (issues.length < 4) issues.push("Some sentences don't start with a capital letter.");
      }
    }

    const endsWithPunct = /[.!?]["']?\s*$/.test(text.trim());
    if (text.trim() && !endsWithPunct) {
      errorCount++;
      issues.push("Add ending punctuation to your final sentence.");
    }

    const commaSplices = (text.match(/,\s*(and|but|so)\s+\w+/gi) || []).length;
    const weakEnds = (text.match(/\b(is|are|was|were|am)\s*$/gim) || []).length;
    errorCount += Math.floor(commaSplices * 0.3);

    const doubleSpaces = (text.match(/  +/g) || []).length;
    errorCount += doubleSpaces;

    const repeatedAdjacent = words.filter((w, i) => i > 0 && normalizeWord(w) === normalizeWord(words[i - 1]) && normalizeWord(w).length > 2).length;
    errorCount += repeatedAdjacent;

    const rate = words.length > 0 ? errorCount / Math.max(sentences.length, 1) : 0;
    const score = clamp(Math.round(100 - rate * 25 - weakEnds * 5), 0, 100);

    return { score, errorCount, commaSplices, repeatedAdjacent, issues: [...new Set(issues)].slice(0, 5) };
  }

  function analyzeSyntax(sentences, words, text) {
    const sentLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const avgLen = sentLengths.reduce((a, b) => a + b, 0) / Math.max(sentLengths.length, 1);
    const variance = sentLengths.reduce((s, l) => s + (l - avgLen) ** 2, 0) / Math.max(sentLengths.length, 1);
    const variety = Math.sqrt(variance);

    const complexMarkers =
      (text.match(SUBORDINATOR_PATTERN) || []).length +
      (text.match(/;/g) || []).length +
      (text.match(/—|–/g) || []).length;

    const fragments = sentLengths.filter((l) => l > 0 && l < 4).length;
    const runOns = sentLengths.filter((l) => l > 35).length;

    const score = clamp(Math.round(
      scoreFromRange(variety, [[0, 20], [2, 40], [5, 65], [8, 82], [12, 95]]) * 0.3 +
      scoreFromRange(avgLen, [[0, 20], [6, 45], [10, 68], [14, 82], [20, 95]]) * 0.25 +
      scoreFromRange(complexMarkers, [[0, 30], [1, 50], [3, 70], [6, 88], [10, 100]]) * 0.3 -
      fragments * 4 - runOns * 6
    ), 0, 100);

    const issues = [];
    if (fragments > 2) issues.push("Some sentences are very short fragments — try combining ideas.");
    if (runOns > 0) issues.push("Very long sentences may be run-ons — break them with periods or semicolons.");
    if (variety < 3) issues.push("Sentence lengths are similar — mix short and long sentences.");

    return {
      score,
      avgSentenceLength: Math.round(avgLen * 10) / 10,
      sentenceVariety: Math.round(variety * 10) / 10,
      complexMarkers,
      fragments,
      runOns,
      issues,
    };
  }

  function analyzeSemantics(words, text) {
    const lowerWords = words.map(normalizeWord);
    const contentWords = lowerWords.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    const uniqueContent = new Set(contentWords);
    const lexicalDiversity = contentWords.length > 0 ? uniqueContent.size / contentWords.length : 0;

    const concreteCount = (text.match(CONCRETE_PATTERN) || []).length;
    const properNouns = (text.match(/\b[A-Z][a-z]+/g) || []).length;
    const numbers = (text.match(/\b\d+\b/g) || []).length;
    const specificity = concreteCount + properNouns + numbers;

    const freq = {};
    for (const w of contentWords) freq[w] = (freq[w] || 0) + 1;
    const maxFreq = Math.max(0, ...Object.values(freq));
    const repetitionPenalty = words.length > 0 ? maxFreq / words.length : 0;

    const score = clamp(Math.round(
      scoreFromRange(lexicalDiversity, [[0, 20], [0.35, 45], [0.5, 65], [0.65, 82], [0.8, 95]]) * 0.45 +
      scoreFromRange(specificity, [[0, 25], [2, 50], [5, 70], [10, 88], [15, 100]]) * 0.35 -
      repetitionPenalty * 60
    ), 0, 100);

    const issues = [];
    if (lexicalDiversity < 0.4) issues.push("Try using more varied vocabulary — synonyms keep writing fresh.");
    if (specificity < 3) issues.push("Add specific names, places, and concrete details so readers can picture your story.");
    if (repetitionPenalty > 0.12) issues.push("A word repeats often — try a thesaurus for variety.");

    return {
      score,
      lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
      specificity,
      repetitionPenalty: Math.round(repetitionPenalty * 100) / 100,
      issues,
    };
  }

  function analyzeText(text, durationSec) {
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const wordCount = words.length;
    const minutes = durationSec / 60;
    const wpm = minutes > 0 ? wordCount / minutes : 0;
    const sentences = getSentences(text);
    const sentenceCount = Math.max(sentences.length, 1);

    const spelling = analyzeSpelling(text, words);
    const grammar = analyzeGrammar(text, sentences, words);
    const syntax = analyzeSyntax(sentences, words, text);
    const semantics = analyzeSemantics(words, text);

    const sensoryCount = (text.match(SENSORY_PATTERN) || []).length;
    const transitionCount = (text.match(TRANSITION_PATTERN) || []).length;
    const dialogueLines = Math.round((text.match(/["']/g) || []).length / 2);
    const voiceCount = (text.match(VOICE_PATTERN) || []).length;
    const conflictWords = (text.match(/\b(but|however|problem|stuck|lost|scared|worried|until|finally)\b/gi) || []).length;

    const volumeScore = scoreFromRange(wordCount, [
      [0, 0], [40, 25], [75, 45], [100, 58], [150, 72], [200, 85], [280, 95], [400, 100],
    ]);

    const complexityScore = clamp(Math.round(
      syntax.score * 0.5 + semantics.score * 0.3 + grammar.score * 0.2
    ), 0, 100);

    const creativityScore = clamp(Math.round(
      scoreFromRange(sensoryCount, [[0, 25], [1, 45], [3, 65], [6, 80], [10, 95]]) * 0.35 +
      scoreFromRange(transitionCount, [[0, 30], [1, 50], [3, 70], [6, 90]]) * 0.25 +
      scoreFromRange(dialogueLines, [[0, 40], [1, 60], [3, 80], [5, 95]]) * 0.2 +
      scoreFromRange(conflictWords, [[0, 30], [1, 55], [3, 75], [5, 90]]) * 0.2
    ), 0, 100);

    const typingScore = scoreFromRange(wpm, [
      [0, 0], [8, 20], [15, 40], [22, 55], [30, 70], [38, 82], [45, 92], [55, 100],
    ]);

    const mechanicsScore = clamp(Math.round(spelling.score * 0.5 + grammar.score * 0.5), 0, 100);
    const voiceScore = clamp(Math.round(
      scoreFromRange(voiceCount, [[0, 20], [2, 45], [5, 65], [10, 82], [15, 95]]) * 0.6 +
      semantics.score * 0.4
    ), 0, 100);

    const narrativeScore = clamp(Math.round(
      scoreFromRange(sensoryCount, [[0, 20], [2, 50], [4, 70], [8, 90]]) * 0.35 +
      scoreFromRange(transitionCount, [[0, 25], [2, 55], [4, 75], [6, 90]]) * 0.25 +
      scoreFromRange(dialogueLines, [[0, 30], [1, 55], [2, 75], [4, 90]]) * 0.2 +
      scoreFromRange(conflictWords, [[0, 25], [1, 50], [3, 75], [5, 90]]) * 0.2
    ), 0, 100);

    const fluencyScore = typingScore;

    const metricScores = {
      spelling: spelling.score,
      grammar: grammar.score,
      mechanics: mechanicsScore,
      syntax: syntax.score,
      complexity: complexityScore,
      semantics: semantics.score,
      fluency: fluencyScore,
      volume: volumeScore,
      voice: voiceScore,
      creativity: creativityScore,
      narrative: narrativeScore,
    };

    const standards = window.DWStandards
      ? window.DWStandards.mapToStandards(metricScores)
      : { all: [], excelling: [], developing: [], needsSupport: [] };

    const typingLevel = classifyTyping(wordCount, wpm);
    const overallScore = Math.round(
      volumeScore * 0.2 + complexityScore * 0.2 + creativityScore * 0.15 +
      typingScore * 0.15 + mechanicsScore * 0.15 + semantics.score * 0.15
    );

    const studentFeedback = buildStudentFeedback({
      wordCount, wpm, typingLevel, spelling, grammar, syntax, semantics,
      sensoryCount, transitionCount, dialogueLines, voiceCount, conflictWords,
    });

    const teacherFeedback = buildTeacherFeedback(analysis);

    return {
      wordCount,
      wpm: Math.round(wpm * 10) / 10,
      sentenceCount,
      avgSentenceLength: syntax.avgSentenceLength,
      sentenceVariety: syntax.sentenceVariety,
      lexicalDiversity: semantics.lexicalDiversity,
      complexMarkers: syntax.complexMarkers,
      sensoryCount,
      transitionCount,
      dialogueLines,
      voiceCount,
      conflictWords,
      spelling,
      grammar,
      syntax,
      semantics,
      scores: {
        volume: volumeScore,
        complexity: complexityScore,
        creativity: creativityScore,
        typing: typingScore,
        spelling: spelling.score,
        grammar: grammar.score,
        syntax: syntax.score,
        semantics: semantics.score,
        mechanics: mechanicsScore,
        voice: voiceScore,
        narrative: narrativeScore,
        overall: overallScore,
      },
      metricScores,
      standards,
      typingLevel,
      feedback: studentFeedback,
      teacherFeedback,
      flags: buildFlags(typingLevel, wordCount, wpm, standards),
    };
  }

  function classifyTyping(wordCount, wpm) {
    if (wordCount < 60 || wpm < 12) return "intervention";
    if (wordCount < 110 || wpm < 20) return "developing";
    if (wordCount < 175 || wpm < 32) return "proficient";
    return "advanced";
  }

  function typingLabel(level) {
    return {
      intervention: "Needs intervention",
      developing: "Developing",
      proficient: "Proficient",
      advanced: "Advanced",
    }[level] || level;
  }

  function buildFlags(typingLevel, wordCount, wpm, standards) {
    const flags = [];
    if (typingLevel === "intervention") {
      flags.push({ type: "alert", text: `Typing intervention: ${wordCount} words, ${Math.round(wpm)} WPM` });
    } else if (typingLevel === "advanced") {
      flags.push({ type: "ok", text: "Strong typing fluency" });
    }
    for (const s of standards.needsSupport || []) {
      flags.push({ type: "alert", text: `MN ${s.id} (${s.title}): needs support` });
    }
    for (const s of standards.excelling || []) {
      flags.push({ type: "ok", text: `MN ${s.id} (${s.title}): excelling` });
    }
    return flags;
  }

  function buildStudentFeedback(m) {
    const sections = [];

    sections.push({
      title: "Typing & stamina",
      items: [
        m.wordCount >= 150
          ? `Strong stamina: ${m.wordCount} words in five minutes (${Math.round(m.wpm)} WPM).`
          : `You wrote ${m.wordCount} words (${Math.round(m.wpm)} WPM). Keep practicing daily timed writes to build fluency.`,
        m.typingLevel === "intervention"
          ? "Focus: short typing drills will help you get ideas on the page faster."
          : null,
      ].filter(Boolean),
    });

    sections.push({
      title: "Spelling & mechanics",
      items: [
        m.spelling.score >= 75
          ? "Spelling looks solid for a first draft — nice control under time pressure."
          : m.spelling.score >= 50
            ? "Some spelling patterns to watch — slow down on tricky words in revision."
            : "Spelling needs practice — try reading your story aloud to catch errors.",
        ...m.spelling.issues.slice(0, 2).map((i) => i),
        ...(m.grammar.score >= 75
          ? ["Capital letters and punctuation are mostly in place."]
          : m.grammar.issues.slice(0, 2)),
      ].filter(Boolean),
    });

    sections.push({
      title: "Syntax (how sentences are built)",
      items: [
        m.syntax.sentenceVariety >= 5
          ? "Good sentence variety — you mix short and long sentences."
          : "Try mixing short punchy sentences with longer descriptive ones.",
        m.syntax.complexMarkers >= 2
          ? "You used connecting words (because, when, although) to build complex sentences."
          : "Add connectors like because, when, or although to link ideas.",
        ...m.syntax.issues.slice(0, 2),
      ],
    });

    sections.push({
      title: "Semantics (word meaning & choice)",
      items: [
        m.semantics.lexicalDiversity >= 0.55
          ? "Strong vocabulary variety — your word choices feel specific."
          : "Use precise nouns and vivid verbs instead of general words like 'good' or 'nice'.",
        m.semantics.specificity >= 5
          ? "Specific details (names, places, numbers) help readers picture your story."
          : "Name people, places, and moments — specifics make stories believable.",
        ...m.semantics.issues.slice(0, 2),
      ],
    });

    sections.push({
      title: "Narrative craft",
      items: [
        m.sensoryCount >= 3
          ? "Sensory details (what you saw, heard, felt) bring your summer memory to life."
          : "Add what you saw, heard, smelled, or felt during the event.",
        m.voiceCount >= 5
          ? "Your personal voice comes through — this reads like your experience."
          : "Use 'I' and 'my' to keep the story in your own voice.",
        m.dialogueLines >= 1
          ? "Dialogue adds energy — keep using quoted speech when it fits."
          : "Try one line of dialogue if someone spoke during your story.",
        m.transitionCount >= 2
          ? "Time words (then, finally, suddenly) help the story flow."
          : "Signal time shifts with words like then, next, or finally.",
      ],
    });

    return sections;
  }

  function buildTeacherFeedback(analysis) {
    const R = window.DWRubrics;
    const lines = [];
    const m = analysis;
    const overallScore = m.scores?.overall;
    if (R) {
      const summary = R.overallSummary(m);
      lines.push(summary.teacherParagraph);
      lines.push("");
      lines.push("Skill bands (for grouping & next steps):");
      for (const c of R.teacherMetricCards(m).slice(2, 8)) {
        lines.push(`• ${c.teacherTitle}: ${c.band.label} (${c.score}) — ${c.teacherWhat}`);
      }
    } else {
      lines.push(`Overall: ${overallScore}/100 · ${m.wordCount} words · ${Math.round(m.wpm)} WPM`);
    }
    lines.push("");
    const standards = m.standards || {};
    if (standards.excelling?.length) {
      lines.push(`Excelling (${standards.excelling.length}): ${standards.excelling.map((s) => s.id).join(", ")}`);
    }
    if (standards.developing?.length) {
      lines.push(`Developing (${standards.developing.length}): ${standards.developing.map((s) => s.id).join(", ")}`);
    }
    if (standards.needsSupport?.length) {
      lines.push(`Needs support (${standards.needsSupport.length}): ${standards.needsSupport.map((s) => s.id).join(", ")}`);
      for (const s of standards.needsSupport.slice(0, 3)) {
        lines.push(`→ ${s.recommendation}`);
      }
    }
    return lines;
  }

  function updateLiveStats() {
    const words = countWords(storyInput.value);
    const mins = Math.max(elapsedSec / 60, 0.01);
    liveWordCount.textContent = `${words} word${words === 1 ? "" : "s"}`;
    liveWpm.textContent = `${Math.round(words / mins)} WPM`;
  }

  function startTimer() {
    elapsedSec = 0;
    startTime = Date.now();
    timerDisplay.textContent = formatTime(DURATION_SEC);
    timerDisplay.classList.remove("dw-timer-value--urgent");
    timerProgress.style.width = "100%";
    timerInterval = setInterval(() => {
      elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(DURATION_SEC - elapsedSec, 0);
      timerDisplay.textContent = formatTime(remaining);
      timerProgress.style.width = `${(remaining / DURATION_SEC) * 100}%`;
      updateLiveStats();
      if (remaining <= 30) timerDisplay.classList.add("dw-timer-value--urgent");
      if (remaining <= 0) finishWriting();
    }, 200);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  async function finishWriting() {
    stopTimer();
    storyInput.readOnly = true;
    showView("analyzing");
    const actualDuration = Math.min(Math.max(elapsedSec, 1), DURATION_SEC);
    const text = storyInput.value;
    const analysis = analyzeText(text, actualDuration);
    const name = studentName.value.trim();
    const classroom = selectedClassroom;
    let saveOk = false;
    let saveError = "";
    try {
      await submitResult(name, classroom, text, analysis, actualDuration);
      saveOk = true;
    } catch (err) {
      saveError = err.message || "Could not save your submission.";
    }
    renderStudentResults(name, classroom, text, analysis, saveOk, saveError);
    showView("results");
  }

  function renderStudentResults(name, classroom, text, analysis, saveOk, saveError) {
    const R = window.DWRubrics;
    const summary = R ? R.overallSummary(analysis) : null;

    document.getElementById("resultName").textContent = name;
    document.getElementById("resultClass").textContent = `Class: ${classroom}`;
    document.getElementById("resultSummary").innerHTML = summary
      ? `<strong>${escapeHtml(summary.headline)}</strong><br><span class="dw-muted">${escapeHtml(summary.studentParagraph)}</span>`
      : `You wrote ${analysis.wordCount} words at ${analysis.wpm} WPM. Overall: ${analysis.scores.overall}/100.`;

    const saveStatus = document.getElementById("saveStatus");
    saveStatus.classList.remove("dw-hidden", "dw-save-status--ok", "dw-save-status--error");
    if (saveOk) {
      saveStatus.textContent = "Saved to your class roster. Your teacher can view this from any computer.";
      saveStatus.classList.add("dw-save-status--ok");
    } else {
      saveStatus.textContent = saveError || "Could not save to the class roster. Tell your teacher and try again.";
      saveStatus.classList.add("dw-save-status--error");
    }

    const grid = document.getElementById("scoreGrid");
    grid.innerHTML = "";
    const cards = R ? R.studentScoreCards(analysis) : [];
    for (const c of cards) {
      const el = document.createElement("div");
      el.className = R.scoreCardClass(c.band.level);
      el.innerHTML = `
        <div class="dw-score-k">${escapeHtml(c.title)}</div>
        <div class="${R.bandClass(c.band.level)}">${escapeHtml(c.band.label)}</div>
        <div class="dw-score-v" title="Rubric score ${c.score}/100">${c.score}<span class="dw-score-v-suffix">/100</span></div>
        <p class="dw-score-meaning">${escapeHtml(c.studentWhat)}</p>
        <div class="dw-score-evidence">${escapeHtml(c.evidence)}</div>`;
      grid.appendChild(el);
    }

    const legend = document.getElementById("scoreLegend");
    if (legend) legend.classList.remove("dw-hidden");

    const fb = document.getElementById("feedbackList");
    fb.innerHTML = analysis.feedback.map((section) => `
      <li class="dw-feedback-section">
        <strong>${escapeHtml(section.title)}</strong>
        <ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </li>`).join("");
    document.getElementById("storyPreview").textContent = text;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function submitResult(name, classroom, text, analysis, durationSec) {
    const payload = { name, classroom, text, analysis, durationSec };
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

  async function fetchSubmissions() {
    const res = await fetch(`${API_URL}?password=${encodeURIComponent(TEACHER_PASSWORD)}`);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error("Incorrect teacher password.");
    }
    if (!res.ok) {
      if (data.setupRequired) {
        throw new Error(
          "Cloud storage is not set up yet. Ask Mr. Phil to connect the Google Sheet (see site setup notes), then try again."
        );
      }
      throw new Error(data.error || `Could not load submissions (${res.status})`);
    }
    if (!Array.isArray(data.submissions)) {
      throw new Error("Invalid server response.");
    }
    return data.submissions;
  }

  function badgeClass(level) {
    return `dw-badge dw-badge--${level}`;
  }

  function stdBadgeClass(level) {
    return `dw-std dw-std--${level}`;
  }

  async function loadTeacherDashboard() {
    teacherMeta.textContent = "Loading submissions…";
    teacherMeta.classList.remove("dw-error");
    try {
      allSubmissions = await fetchSubmissions();
      const classCounts = {};
      for (const sub of allSubmissions) {
        const cls = sub.classroom || "Unknown";
        classCounts[cls] = (classCounts[cls] || 0) + 1;
      }
      const classSummary = Object.entries(classCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([cls, count]) => `${cls}: ${count}`)
        .join(" · ");
      teacherMeta.textContent = classSummary
        ? `${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"} across all classes · ${classSummary}`
        : `${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"}`;
      renderTeacherTable();
    } catch (err) {
      allSubmissions = [];
      teacherMeta.textContent = err.message || "Could not load submissions.";
      teacherMeta.classList.add("dw-error");
      renderTeacherTable();
    }
  }

  function getFilteredSubmissions() {
    return allSubmissions.filter((s) => {
      const typingOk = currentFilter === "all" || s.analysis?.typingLevel === currentFilter;
      const classOk = currentClassFilter === "all" || s.classroom === currentClassFilter;
      return typingOk && classOk;
    });
  }

  function renderTeacherTable() {
    const filtered = getFilteredSubmissions();

    teacherTableBody.innerHTML = "";
    const table = document.getElementById("teacherTable");
    emptyState.classList.toggle("dw-hidden", filtered.length > 0);
    table.classList.toggle("dw-hidden", filtered.length === 0);

    for (const sub of filtered) {
      const a = sub.analysis || {};
      const R = window.DWRubrics;
      const needsCount = a.standards?.needsSupport?.length ?? 0;
      const mechBand = R ? R.band(a.scores?.mechanics) : null;
      const narrBand = R ? R.band(a.scores?.narrative) : null;
      const creatBand = R ? R.band(a.scores?.creativity) : null;
      const overallBand = R ? R.band(a.scores?.overall) : null;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(sub.name)}</td>
        <td>${escapeHtml(sub.classroom || "—")}</td>
        <td>${a.wordCount ?? "—"}</td>
        <td>${a.wpm ?? "—"}</td>
        <td><span class="${badgeClass(a.typingLevel)}">${typingLabel(a.typingLevel)}</span></td>
        <td>${mechBand ? `<span class="${R.bandClass(mechBand.level)}" title="${mechBand.short}">${mechBand.label}</span>` : (a.scores?.mechanics ?? "—")}</td>
        <td>${narrBand ? `<span class="${R.bandClass(narrBand.level)}" title="${narrBand.short}">${narrBand.label}</span>` : (a.scores?.narrative ?? "—")}</td>
        <td>${creatBand ? `<span class="${R.bandClass(creatBand.level)}" title="${creatBand.short}">${creatBand.label}</span>` : (a.scores?.creativity ?? "—")}</td>
        <td>${overallBand ? `<span class="${R.bandClass(overallBand.level)}">${overallBand.label}</span> <span class="dw-muted">${a.scores?.overall ?? ""}</span>` : (a.scores?.overall ?? "—")}</td>
        <td>${needsCount > 0 ? `<span class="dw-std dw-std--needs_support">${needsCount} std</span>` : "—"}</td>
        <td>${sub.submittedAt ? formatDate(sub.submittedAt) : "—"}</td>
        <td><button class="dw-btn dw-btn-ghost dw-view-btn" type="button" data-id="${sub.id}">View</button></td>`;
      teacherTableBody.appendChild(tr);
    }

    teacherTableBody.querySelectorAll(".dw-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = allSubmissions.find((s) => s.id === btn.dataset.id);
        if (sub) showDetail(sub);
      });
    });
  }

  function renderStandardsPanel(standards) {
    if (!standards) return "";
    const groups = [
      { key: "excelling", label: "Excelling", items: standards.excelling },
      { key: "developing", label: "Developing", items: standards.developing },
      { key: "needsSupport", label: "Needs support", items: standards.needsSupport },
    ];
    return groups.map((g) => {
      if (!g.items?.length) return "";
      return `<div class="dw-std-group">
        <h4 class="dw-std-group-title">${g.label} <span class="dw-muted">(${g.items.length})</span></h4>
        <ul class="dw-std-list">${g.items.map((s) => `
          <li class="dw-std-item">
            <span class="${stdBadgeClass(s.level)}">${escapeHtml(s.id)}</span>
            <strong>${escapeHtml(s.title)}</strong>
            <span class="dw-muted dw-std-bench">${escapeHtml(s.benchmark)}</span>
            <span class="dw-std-rec">${escapeHtml(s.recommendation)}</span>
            <span class="dw-std-score">${s.score}/100</span>
          </li>`).join("")}</ul>
      </div>`;
    }).join("");
  }

  function showDetail(sub) {
    const a = sub.analysis || {};
    const R = window.DWRubrics;
    detailPanel.classList.remove("dw-hidden");
    document.getElementById("detailName").textContent = `${sub.name} · ${sub.classroom || "Unknown class"}`;
    document.getElementById("detailStory").textContent = sub.text || "";

    if (R) {
      const cards = R.teacherMetricCards(a);
      document.getElementById("detailMetrics").innerHTML = cards.map((c) => `
        <div class="dw-metric-card ${R.scoreCardClass(c.band.level)}">
          <div class="dw-metric-card__head">
            <span class="dw-metric-card__title">${escapeHtml(c.teacherTitle)}</span>
            <span class="${R.bandClass(c.band.level)}">${escapeHtml(c.band.label)}</span>
          </div>
          <div class="dw-metric-card__score">${c.score}<span>/100</span></div>
          <p class="dw-metric-card__teacher">${escapeHtml(c.teacherWhat)}</p>
          <div class="dw-metric-card__evidence">${escapeHtml(c.evidence)}</div>
        </div>`).join("");
    } else {
      const metrics = [
        ["Words", a.wordCount], ["WPM", a.wpm], ["Overall", a.scores?.overall],
      ];
      document.getElementById("detailMetrics").innerHTML = metrics.map(([k, v]) => `
        <div class="dw-metric"><div class="dw-metric-k">${k}</div><div class="dw-metric-v">${v ?? "—"}</div></div>`).join("");
    }

    document.getElementById("detailFlags").innerHTML = (a.flags || [])
      .map((f) => `<span class="dw-flag dw-flag--${f.type}">${escapeHtml(f.text)}</span>`).join("");

    document.getElementById("detailStandards").innerHTML = renderStandardsPanel(a.standards);

    document.getElementById("detailFeedback").innerHTML = (a.teacherFeedback || [])
      .map((line) => `<li>${escapeHtml(line)}</li>`).join("");

    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportCsv() {
    const headers = [
      "Name", "Class", "Words", "WPM", "Typing", "Spelling", "Grammar", "Syntax", "Semantics",
      "Overall", "Standards Needing Support", "Submitted",
    ];
    const rows = allSubmissions.map((s) => {
      const a = s.analysis || {};
      return [
        s.name, s.classroom || "", a.wordCount, a.wpm, typingLabel(a.typingLevel),
        a.scores?.spelling, a.scores?.grammar, a.scores?.syntax, a.scores?.semantics,
        a.scores?.overall,
        (a.standards?.needsSupport || []).map((x) => x.id).join("; "),
        s.submittedAt ? new Date(s.submittedAt).toISOString() : "",
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostic-writing-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  studentName.addEventListener("input", updateStartButton);
  studentClass.addEventListener("change", updateStartButton);
  startBtn.addEventListener("click", () => {
    if (!canStart()) return;
    selectedClassroom = studentClass.value;
    storyInput.value = "";
    storyInput.readOnly = false;
    showView("writing");
    storyInput.focus();
    startTimer();
  });
  storyInput.addEventListener("paste", (e) => { if (!storyInput.readOnly) e.preventDefault(); });
  storyInput.addEventListener("input", updateLiveStats);
  restartBtn.addEventListener("click", () => {
    stopTimer(); storyInput.value = ""; storyInput.readOnly = false;
    studentName.value = ""; studentClass.selectedIndex = 0; selectedClassroom = "";
    updateStartButton();
    detailPanel.classList.add("dw-hidden"); showView("welcome");
  });
  teacherBtn.addEventListener("click", () => {
    if (teacherAuthed) { showView("teacher"); loadTeacherDashboard(); }
    else { teacherPassword.value = ""; teacherLoginError.classList.add("dw-hidden"); showView("teacherLogin"); teacherPassword.focus(); }
  });
  teacherLoginBtn.addEventListener("click", async () => {
    if (teacherPassword.value === TEACHER_PASSWORD) {
      teacherAuthed = true; teacherLoginError.classList.add("dw-hidden");
      showView("teacher"); await loadTeacherDashboard();
    } else teacherLoginError.classList.remove("dw-hidden");
  });
  teacherPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") teacherLoginBtn.click(); });
  teacherCancelBtn.addEventListener("click", () => showView("welcome"));
  teacherLogoutBtn.addEventListener("click", () => { teacherAuthed = false; detailPanel.classList.add("dw-hidden"); showView("welcome"); });
  refreshBtn.addEventListener("click", loadTeacherDashboard);
  exportBtn.addEventListener("click", exportCsv);
  document.getElementById("closeDetailBtn").addEventListener("click", () => detailPanel.classList.add("dw-hidden"));
  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".dw-filter");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filterBar.querySelectorAll(".dw-filter").forEach((b) => b.classList.toggle("dw-filter--active", b === btn));
    renderTeacherTable();
  });
  classFilter.addEventListener("change", () => {
    currentClassFilter = classFilter.value;
    renderTeacherTable();
  });
})();

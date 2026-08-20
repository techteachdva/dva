(() => {
  "use strict";

  const DURATION_SEC = 300;
  const TEACHER_PASSWORD = "studentsfirst";
  const API_URL = "/api/diagnostic-writing-submissions";

  function loadValidClassrooms() {
    const el = document.getElementById("dwClassroomsJson");
    if (!el) return [];
    try {
      const list = JSON.parse(el.textContent);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function loadClassroomCodes() {
    const el = document.getElementById("dwClassroomCodesJson");
    if (!el) return {};
    try {
      const map = JSON.parse(el.textContent);
      return map && typeof map === "object" ? map : {};
    } catch {
      return {};
    }
  }

  const VALID_CLASSROOMS = loadValidClassrooms();
  const CLASSROOM_CODES = loadClassroomCodes();

  function normalizeClassCode(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  }

  function verifyClassroomCode(classroom, code) {
    const resolved = resolveClassroom(classroom);
    if (!resolved) return false;
    const expected = CLASSROOM_CODES[resolved];
    if (!expected) return false;
    return normalizeClassCode(code) === normalizeClassCode(expected);
  }

  function normalizeClassroom(value) {
    return String(value || "").trim().replace(/[\u2018\u2019\u201B\u2032]/g, "'");
  }

  function resolveClassroom(value) {
    const norm = normalizeClassroom(value);
    if (!norm) return "";
    for (const classroom of VALID_CLASSROOMS) {
      if (normalizeClassroom(classroom) === norm) return classroom;
    }
    return "";
  }

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
  const classCode = document.getElementById("classCode");
  const classCodeError = document.getElementById("classCodeError");
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
  const reanalyzeBtn = document.getElementById("reanalyzeBtn");
  const teacherGuideBtn = document.getElementById("teacherGuideBtn");
  const exportBtn = document.getElementById("exportBtn");
  const teacherTableBody = document.getElementById("teacherTableBody");
  const teacherMeta = document.getElementById("teacherMeta");
  const emptyState = document.getElementById("emptyState");
  const detailPanel = document.getElementById("detailPanel");
  const filterBar = document.getElementById("filterBar");
  const classFilter = document.getElementById("classFilter");
  const teacherTabTable = document.getElementById("teacherTabTable");
  const teacherTabReader = document.getElementById("teacherTabReader");
  const teacherTableWrap = document.getElementById("teacherTableWrap");
  const teacherReaderWrap = document.getElementById("teacherReaderWrap");
  const readerSortEl = document.getElementById("readerSort");
  const readerPrintBtn = document.getElementById("readerPrintBtn");
  const readerFeed = document.getElementById("readerFeed");
  const readerNavList = document.getElementById("readerNavList");
  const readerEmpty = document.getElementById("readerEmpty");
  const readerMeta = document.getElementById("readerMeta");

  let timerInterval = null;
  let elapsedSec = 0;
  let startTime = 0;
  let currentFilter = "all";
  let currentClassFilter = "all";
  let allSubmissions = [];
  let teacherAuthed = false;
  let selectedClassroom = "";
  let selectedClassCode = "";
  let teacherClassroomCodes = {};
  let teacherViewMode = "table";
  let readerSort = "name";

  function showView(name) {
    const shell = document.querySelector(".dw-shell");
    if (shell) shell.classList.toggle("dw-shell--teacher", name === "teacher");
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
    const classroom = resolveClassroom(studentClass.value);
    const codeOk = verifyClassroomCode(classroom, classCode?.value || "");
    return Boolean(studentName.value.trim() && classroom && codeOk);
  }

  function updateStartButton() {
    const classroom = resolveClassroom(studentClass.value);
    const code = classCode?.value || "";
    const codeOk = classroom && verifyClassroomCode(classroom, code);
    const hasCode = normalizeClassCode(code).length > 0;

    if (classCodeError) {
      const showCodeErr = Boolean(classroom && hasCode && !codeOk);
      classCodeError.classList.toggle("dw-hidden", !showCodeErr);
    }

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
    const score = clamp(Math.round(100 - rate * 300 - apostropheErrors * 2), 0, 100);

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
      fragments * 3 - runOns * 5
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
      scoreFromRange(lexicalDiversity, [[0, 25], [0.3, 42], [0.45, 62], [0.58, 78], [0.72, 92]]) * 0.45 +
      scoreFromRange(specificity, [[0, 28], [1, 48], [3, 65], [6, 82], [10, 95]]) * 0.35 -
      repetitionPenalty * 50
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
      [0, 0], [30, 22], [55, 40], [80, 54], [110, 66], [140, 76], [175, 85], [220, 92], [280, 97], [350, 100],
    ]);

    const wpmScore = scoreFromRange(wpm, [
      [0, 0], [6, 18], [12, 36], [18, 52], [24, 66], [30, 78], [38, 88], [48, 100],
    ]);

    const typingScore = clamp(Math.round(wpmScore * 0.55 + volumeScore * 0.45), 0, 100);

    const mechanicsScore = clamp(Math.round(
      spelling.score * 0.45 + grammar.score * 0.35 + syntax.score * 0.2
    ), 0, 100);

    const storySubs = {
      voice: scoreFromRange(voiceCount, [[0, 42], [2, 58], [5, 74], [8, 86], [12, 95]]),
      detail: scoreFromRange(
        sensoryCount + dialogueLines * 1.5,
        [[0, 40], [1, 56], [2, 68], [4, 80], [6, 90], [9, 96]]
      ),
      structure: scoreFromRange(
        transitionCount + conflictWords,
        [[0, 40], [1, 58], [2, 72], [4, 84], [6, 93]]
      ),
      wordChoice: semantics.score,
    };

    let storyScore = clamp(Math.round(
      storySubs.voice * 0.2 +
      storySubs.detail * 0.25 +
      storySubs.structure * 0.25 +
      storySubs.wordChoice * 0.3
    ), 0, 100);

    if (wordCount >= 50 && voiceCount >= 2 && sentenceCount >= 3) {
      storyScore = Math.max(storyScore, 48);
    }
    if (wordCount >= 90 && voiceCount >= 4) {
      storyScore = Math.max(storyScore, 55);
    }

    const complexityScore = clamp(Math.round(
      syntax.score * 0.5 + semantics.score * 0.3 + grammar.score * 0.2
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
      typing: typingScore,
      story: storyScore,
      voice: storySubs.voice,
      narrative: Math.round((storySubs.detail + storySubs.structure) / 2),
      creativity: storySubs.detail,
    };

    const standards = window.DWStandards
      ? window.DWStandards.mapToStandards(metricScores)
      : { all: [], excelling: [], developing: [], needsSupport: [] };

    const typingLevel = classifyTyping(wordCount, wpm);
    const overallScore = Math.round((typingScore + mechanicsScore + storyScore) / 3);

    const studentFeedback = buildStudentFeedback({
      wordCount, wpm, typingLevel, spelling, grammar, syntax, semantics,
      sensoryCount, transitionCount, dialogueLines, voiceCount, conflictWords,
      storySubs, typingScore, mechanicsScore, storyScore,
    });

    const analysis = {
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
      storySubs,
      scores: {
        typing: typingScore,
        mechanics: mechanicsScore,
        story: storyScore,
        overall: overallScore,
        volume: volumeScore,
        wpm: wpmScore,
        spelling: spelling.score,
        grammar: grammar.score,
        syntax: syntax.score,
        semantics: semantics.score,
        complexity: complexityScore,
      },
      metricScores,
      standards,
      typingLevel,
      feedback: studentFeedback,
      flags: buildFlags(typingLevel, wordCount, wpm, standards),
    };

    analysis.teacherFeedback = buildTeacherFeedback(analysis);
    return analysis;
  }

  function classifyTyping(wordCount, wpm) {
    if (wordCount < 45 || wpm < 10) return "intervention";
    if (wordCount < 90 || wpm < 16) return "developing";
    if (wordCount < 150 || wpm < 28) return "proficient";
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

  function shortClassName(classroom) {
    const c = String(classroom || "—");
    if (c.length <= 14) return c;
    if (c.startsWith("Tech ")) return c.replace("Tech ", "T");
    if (c.startsWith("Mrs. ")) return c.replace("Mrs. ", "M.").replace(" Grade ELA", "");
    return c.slice(0, 13) + "…";
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
      title: "Mechanics (spelling, punctuation & sentences)",
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
        m.syntax.sentenceVariety >= 5
          ? "Good sentence variety — you mix short and long sentences."
          : "Try mixing short punchy sentences with longer descriptive ones.",
        ...m.syntax.issues.slice(0, 1),
      ].filter(Boolean),
    });

    sections.push({
      title: "Story (voice, details & narrative craft)",
      items: [
        m.storyScore >= 65
          ? "Your summer story comes through — voice, details, and sequence work together."
          : m.storyScore >= 50
            ? "You told a real story; add more specific details and time words to strengthen it."
            : "Focus on one summer moment: who was there, what happened, and how you felt.",
        m.voiceCount >= 4
          ? "Your personal voice comes through — this reads like your experience."
          : "Use 'I' and 'my' to keep the story in your own voice.",
        m.sensoryCount >= 2
          ? "Sensory details help readers picture your memory."
          : "Add what you saw, heard, or felt during the event.",
        m.semantics.specificity >= 4
          ? "Specific names and places make your story believable."
          : "Name people, places, and moments — specifics matter.",
        m.transitionCount >= 1
          ? "Time words help your story flow from start to finish."
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
      for (const c of R.teacherMetricCards(m)) {
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
    const name = studentName.value.trim();
    const classroom = resolveClassroom(selectedClassroom || studentClass.value);
    let analysis;
    try {
      analysis = analyzeText(text, actualDuration);
    } catch (err) {
      console.error("Writing analysis failed:", err);
      const note = document.getElementById("resultSummary");
      if (note) note.textContent = "Something went wrong analyzing your writing. Refresh and try again, or tell your teacher.";
      showView("results");
      return;
    }
    let saveOk = false;
    let saveError = "";
    if (!classroom) {
      saveError = "Your class was not recognized. Go back, pick your class from the list, and try again.";
    } else if (!verifyClassroomCode(classroom, selectedClassCode || classCode?.value || "")) {
      saveError = "Your class code did not match. Go back and enter the code your teacher gave you.";
    } else {
      try {
        await submitResult(name, classroom, text, analysis, actualDuration, selectedClassCode || classCode?.value || "");
        saveOk = true;
      } catch (err) {
        saveError = err.message || "Could not save your submission.";
      }
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

  async function updateSubmissionsBulk(updates) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateBulk",
        password: TEACHER_PASSWORD,
        updates,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Bulk update failed (${res.status})`);
    }
    return data;
  }

  async function updateSubmissionAnalysis(id, analysis) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        password: TEACHER_PASSWORD,
        id,
        analysis,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Update failed (${res.status})`);
    }
    return data;
  }

  async function reanalyzeAllSubmissions() {
    if (!allSubmissions.length) {
      teacherMeta.textContent = "No submissions to re-analyze.";
      return;
    }
    const confirmed = window.confirm(
      `Re-analyze all ${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"} with the updated rubric?\n\nStudent stories are not changed — only scores and analysis data are updated.`
    );
    if (!confirmed) return;

    reanalyzeBtn.disabled = true;
    refreshBtn.disabled = true;
    let ok = 0;
    let fail = 0;
    let firstError = "";
    const pending = [];

    for (let i = 0; i < allSubmissions.length; i++) {
      const sub = allSubmissions[i];
      teacherMeta.textContent = `Scoring ${i + 1} of ${allSubmissions.length}…`;
      teacherMeta.classList.remove("dw-error");

      const text = sub.text || "";
      const durationSec = Number(sub.durationSec) || 300;
      try {
        const analysis = analyzeText(text, durationSec);
        sub.analysis = analysis;
        pending.push({ id: String(sub.id || "").trim(), analysis });
      } catch (err) {
        console.error("Re-analyze failed for", sub.id, err);
        fail++;
        if (!firstError) firstError = err.message || "Scoring failed";
      }
    }

    const CHUNK_SIZE = 25;
    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE);
      teacherMeta.textContent = `Saving ${Math.min(i + chunk.length, pending.length)} of ${pending.length}…`;
      try {
        const result = await updateSubmissionsBulk(chunk);
        ok += result.updated || 0;
        const chunkFail = chunk.length - (result.updated || 0);
        fail += chunkFail;
        if (result.errors?.length && !firstError) {
          firstError = result.errors[0].error || "Update failed";
          if (result.errors[0].id) firstError += ` (id: ${result.errors[0].id})`;
        }
      } catch (err) {
        console.error("Bulk save failed:", err);
        fail += chunk.length;
        if (!firstError) firstError = err.message || "Could not save to Google Sheets";
      }
    }

    reanalyzeBtn.disabled = false;
    refreshBtn.disabled = false;
    if (fail) {
      const hint = /unknown action/i.test(firstError)
        ? " Redeploy Google Apps Script with the latest code (needs updateBulk action), then try again."
        : /not found/i.test(firstError)
          ? " Check that submission IDs in the sheet match the dashboard."
          : " Redeploy Google Apps Script if you recently updated it.";
      teacherMeta.textContent = `Re-analyzed ${ok} submission${ok === 1 ? "" : "s"}; ${fail} failed.${firstError ? ` First error: ${firstError}.` : ""}${hint}`;
      teacherMeta.classList.add("dw-error");
    } else {
      teacherMeta.textContent = `Re-analyzed ${ok} submission${ok === 1 ? "" : "s"} with the updated rubric.`;
    }
    renderTeacherViews();

    if (!detailPanel.classList.contains("dw-hidden")) {
      const openId = detailPanel.dataset.openId;
      if (openId) {
        const sub = allSubmissions.find((s) => s.id === openId);
        if (sub) showDetail(sub);
      }
    }
  }

  async function submitResult(name, classroom, text, analysis, durationSec, classCodeValue) {
    const payload = { name, classroom, text, analysis, durationSec, classCode: classCodeValue };
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
    if (data.classroomCodes && typeof data.classroomCodes === "object") {
      teacherClassroomCodes = data.classroomCodes;
    }
    return data.submissions;
  }

  function renderClassCodesPanel() {
    const grid = document.getElementById("classCodesGrid");
    if (!grid) return;
    const codes = Object.keys(teacherClassroomCodes).length ? teacherClassroomCodes : CLASSROOM_CODES;
    const entries = Object.entries(codes).sort((a, b) => a[0].localeCompare(b[0]));
    grid.innerHTML = entries.map(([cls, code]) => `
      <div class="dw-class-code-card">
        <div class="dw-class-code-card__name">${escapeHtml(cls)}</div>
        <code class="dw-class-code-card__code">${escapeHtml(code)}</code>
      </div>`).join("");
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
      renderClassCodesPanel();
      try {
        const saved = sessionStorage.getItem("dw-teacher-view-mode");
        if (saved === "reader" || saved === "table") teacherViewMode = saved;
      } catch { /* ignore */ }
      setTeacherViewMode(teacherViewMode, false);
      renderTeacherViews();
    } catch (err) {
      allSubmissions = [];
      teacherMeta.textContent = err.message || "Could not load submissions.";
      teacherMeta.classList.add("dw-error");
      renderTeacherViews();
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
      const overallBand = R ? R.band(a.scores?.overall) : null;
      const mechBand = R ? R.band(a.scores?.mechanics) : null;
      const narrBand = R ? R.band(resolveStoryScore(a)) : null;
      const typShort = { intervention: "Intv", developing: "Dev", proficient: "Prof", advanced: "Adv" };
      const bandShort = { strong: "Str", on_track: "Mid", developing: "Dev", needs_support: "Low" };
      const tr = document.createElement("tr");
      tr.className = "dw-table-row--clickable";
      tr.innerHTML = `
        <td class="dw-col-view"><button class="dw-btn dw-btn-ghost dw-view-btn dw-view-btn--compact" type="button" data-id="${sub.id}">View</button></td>
        <td class="dw-col-name" title="${escapeHtml(sub.name)}">${escapeHtml(sub.name)}</td>
        <td class="dw-col-class" title="${escapeHtml(sub.classroom || "")}">${escapeHtml(shortClassName(sub.classroom))}</td>
        <td>${a.wordCount ?? "—"}</td>
        <td>${a.wpm ?? "—"}</td>
        <td><span class="${badgeClass(a.typingLevel)}" title="${typingLabel(a.typingLevel)}">${typShort[a.typingLevel] || "—"}</span></td>
        <td>${mechBand ? `<span class="${R.bandClass(mechBand.level)}" title="${mechBand.short}">${bandShort[mechBand.level] || mechBand.label}</span>` : (a.scores?.mechanics ?? "—")}</td>
        <td>${narrBand ? `<span class="${R.bandClass(narrBand.level)}" title="${narrBand.short}">${bandShort[narrBand.level] || narrBand.label}</span>` : (resolveStoryScore(a) ?? "—")}</td>
        <td class="dw-col-overall">${overallBand ? `<span class="${R.bandClass(overallBand.level)}">${a.scores?.overall ?? "—"}</span>` : (a.scores?.overall ?? "—")}</td>`;
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".dw-view-btn")) return;
        showDetail(sub);
      });
      teacherTableBody.appendChild(tr);
    }

    teacherTableBody.querySelectorAll(".dw-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = allSubmissions.find((s) => s.id === btn.dataset.id);
        if (sub) showDetail(sub);
      });
    });
  }

  function sortReaderSubmissions(items) {
    const list = [...items];
    switch (readerSort) {
      case "overall-desc":
        return list.sort((a, b) => (b.analysis?.scores?.overall ?? -1) - (a.analysis?.scores?.overall ?? -1));
      case "overall-asc":
        return list.sort((a, b) => (a.analysis?.scores?.overall ?? 101) - (b.analysis?.scores?.overall ?? 101));
      case "story-desc":
        return list.sort((a, b) => (resolveStoryScore(b.analysis) ?? -1) - (resolveStoryScore(a.analysis) ?? -1));
      case "newest":
        return list.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
      default:
        return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
  }

  function readerSlug(sub) {
    const base = String(sub.id || sub.name).replace(/[^a-zA-Z0-9_-]/g, "-");
    return `dw-reader-${base}`;
  }

  function renderReaderScoreChip(label, score, bandLevel) {
    const R = window.DWRubrics;
    const bandClass = R && bandLevel ? R.bandClass(bandLevel) : "";
    return `<div class="dw-reader-score ${bandClass}">
      <span class="dw-reader-score__label">${escapeHtml(label)}</span>
      <span class="dw-reader-score__value">${score ?? "—"}</span>
    </div>`;
  }

  function renderClassReader() {
    if (!readerFeed || !readerNavList) return;

    const filtered = getFilteredSubmissions();
    const sorted = sortReaderSubmissions(filtered);
    const R = window.DWRubrics;
    const showClass = currentClassFilter === "all";
    const typShort = { intervention: "Intv", developing: "Dev", proficient: "Prof", advanced: "Adv" };

    const filterNote = currentFilter !== "all" ? ` · ${typingLabel(currentFilter)}` : "";
    const classNote = currentClassFilter === "all" ? "all classes" : currentClassFilter;
    if (readerMeta) {
      readerMeta.textContent = sorted.length
        ? `${sorted.length} stor${sorted.length === 1 ? "y" : "ies"} · ${classNote}${filterNote}`
        : "No submissions match this filter.";
    }

    readerFeed.innerHTML = "";
    readerNavList.innerHTML = "";
    const layout = teacherReaderWrap?.querySelector(".dw-reader-layout");
    if (layout) layout.classList.toggle("dw-hidden", sorted.length === 0);
    if (readerEmpty) readerEmpty.classList.toggle("dw-hidden", sorted.length > 0);

    for (const sub of sorted) {
      const a = sub.analysis || {};
      const slug = readerSlug(sub);
      const overallBand = R ? R.band(a.scores?.overall) : null;
      const mechBand = R ? R.band(a.scores?.mechanics) : null;
      const storyScore = resolveStoryScore(a);
      const storyBand = R ? R.band(storyScore) : null;
      const typingBand = R ? R.band(a.scores?.typing) : null;

      const navLi = document.createElement("li");
      navLi.innerHTML = `<a class="dw-reader-nav__link" href="#${slug}">
        <span class="dw-reader-nav__name">${escapeHtml(sub.name)}</span>
        <span class="dw-reader-nav__score ${overallBand ? R.bandClass(overallBand.level) : ""}">${a.scores?.overall ?? "—"}</span>
      </a>`;
      readerNavList.appendChild(navLi);

      const card = document.createElement("article");
      card.className = "dw-reader-card";
      card.id = slug;
      card.innerHTML = `
        <header class="dw-reader-card__head">
          <div class="dw-reader-card__identity">
            <h3 class="dw-reader-card__name">${escapeHtml(sub.name)}</h3>
            ${showClass ? `<p class="dw-reader-card__class">${escapeHtml(sub.classroom || "Unknown class")}</p>` : ""}
            <p class="dw-muted dw-tiny">${sub.submittedAt ? escapeHtml(formatDate(sub.submittedAt)) : ""}</p>
          </div>
          <div class="dw-reader-card__actions">
            <button class="dw-btn dw-btn-ghost dw-reader-analyze-btn" type="button" data-id="${escapeHtml(sub.id || "")}">Analytics</button>
          </div>
        </header>
        <div class="dw-reader-scores">
          ${renderReaderScoreChip("Overall", a.scores?.overall, overallBand?.level)}
          ${renderReaderScoreChip("Typing", a.scores?.typing, typingBand?.level)}
          ${renderReaderScoreChip("Mechanics", a.scores?.mechanics, mechBand?.level)}
          ${renderReaderScoreChip("Story", storyScore, storyBand?.level)}
        </div>
        <div class="dw-reader-stats">
          <span>${a.wordCount ?? "—"} words</span>
          <span>${a.wpm ?? "—"} WPM</span>
          <span class="${badgeClass(a.typingLevel)}" title="${typingLabel(a.typingLevel)}">${typShort[a.typingLevel] || "—"} typing</span>
        </div>
        <div class="dw-reader-story">${escapeHtml(sub.text || "(No text submitted)")}</div>`;
      readerFeed.appendChild(card);
    }

    readerFeed.querySelectorAll(".dw-reader-analyze-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const sub = allSubmissions.find((s) => s.id === btn.dataset.id);
        if (sub) showDetail(sub);
      });
    });
  }

  function setTeacherViewMode(mode, persist = true) {
    teacherViewMode = mode;
    if (teacherTabTable) {
      teacherTabTable.classList.toggle("dw-teacher-tab--active", mode === "table");
      teacherTabTable.setAttribute("aria-selected", mode === "table" ? "true" : "false");
    }
    if (teacherTabReader) {
      teacherTabReader.classList.toggle("dw-teacher-tab--active", mode === "reader");
      teacherTabReader.setAttribute("aria-selected", mode === "reader" ? "true" : "false");
    }
    if (teacherTableWrap) teacherTableWrap.classList.toggle("dw-hidden", mode !== "table");
    if (teacherReaderWrap) teacherReaderWrap.classList.toggle("dw-hidden", mode !== "reader");
    if (persist) {
      try { sessionStorage.setItem("dw-teacher-view-mode", mode); } catch { /* ignore */ }
    }
  }

  function renderTeacherViews() {
    renderTeacherTable();
    if (teacherViewMode === "reader") renderClassReader();
  }

  function printReaderList() {
    const sorted = sortReaderSubmissions(getFilteredSubmissions());
    if (!sorted.length) return;

    const classNote = currentClassFilter === "all" ? "All classes" : currentClassFilter;
    const cards = sorted.map((sub) => {
      const a = sub.analysis || {};
      const storyScore = resolveStoryScore(a);
      return `<article class="print-card">
        <h2>${escapeHtml(sub.name)}${currentClassFilter === "all" ? ` <span class="print-class">(${escapeHtml(sub.classroom || "")})</span>` : ""}</h2>
        <p class="print-scores">Overall ${a.scores?.overall ?? "—"} · Typing ${a.scores?.typing ?? "—"} · Mechanics ${a.scores?.mechanics ?? "—"} · Story ${storyScore ?? "—"} · ${a.wordCount ?? "—"} words · ${a.wpm ?? "—"} WPM</p>
        <div class="print-story">${escapeHtml(sub.text || "")}</div>
      </article>`;
    }).join("");

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Class stories — ${escapeHtml(classNote)}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 7in; margin: 0 auto; padding: 0.5in; color: #111; line-height: 1.5; }
        h1 { font-family: system-ui, sans-serif; font-size: 18px; margin: 0 0 1rem; }
        .print-card { break-inside: avoid; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ccc; }
        .print-card h2 { font-size: 16px; margin: 0 0 0.25rem; }
        .print-class { font-weight: normal; color: #555; font-size: 14px; }
        .print-scores { font-family: system-ui, sans-serif; font-size: 11px; color: #444; margin: 0 0 0.5rem; }
        .print-story { white-space: pre-wrap; font-size: 13px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Diagnostic writing — ${escapeHtml(classNote)} (${sorted.length})</h1>
      ${cards}
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
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
    const C = window.DWComparisons;
    detailPanel.classList.remove("dw-hidden");
    detailPanel.dataset.openId = sub.id || "";
    document.getElementById("detailName").textContent = `${sub.name} · ${sub.classroom || "Unknown class"}`;
    document.getElementById("detailStory").textContent = sub.text || "";

    const compareEl = document.getElementById("detailCompareCharts");
    if (compareEl) {
      compareEl.innerHTML = C
        ? C.renderComparisonPanel(allSubmissions, sub)
        : "";
    }

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

  function resolveStoryScore(analysis) {
    const s = analysis?.scores;
    if (!s) return null;
    if (Number.isFinite(s.story)) return s.story;
    const legacy = [s.narrative, s.voice, s.creativity].filter((v) => Number.isFinite(v));
    if (legacy.length) return Math.round(legacy.reduce((a, b) => a + b, 0) / legacy.length);
    return null;
  }

  function exportCsv() {
    const headers = [
      "Name", "Class", "Words", "WPM", "Typing", "Mechanics", "Story", "Overall", "Submitted",
    ];
    const rows = allSubmissions.map((s) => {
      const a = s.analysis || {};
      return [
        s.name, s.classroom || "", a.wordCount, a.wpm, a.scores?.typing, a.scores?.mechanics,
        resolveStoryScore(a), a.scores?.overall,
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
  studentClass.addEventListener("change", () => {
    if (classCode) classCode.value = "";
    updateStartButton();
  });
  if (classCode) classCode.addEventListener("input", updateStartButton);
  startBtn.addEventListener("click", () => {
    if (!canStart()) return;
    const classroom = resolveClassroom(studentClass.value);
    if (!classroom) return;
    selectedClassroom = classroom;
    selectedClassCode = classCode?.value || "";
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
    studentName.value = ""; studentClass.selectedIndex = 0;
    if (classCode) classCode.value = "";
    selectedClassroom = ""; selectedClassCode = "";
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
      renderClassCodesPanel();
      showView("teacher"); await loadTeacherDashboard();
    } else teacherLoginError.classList.remove("dw-hidden");
  });
  teacherPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") teacherLoginBtn.click(); });
  teacherCancelBtn.addEventListener("click", () => showView("welcome"));
  teacherLogoutBtn.addEventListener("click", () => { teacherAuthed = false; detailPanel.classList.add("dw-hidden"); showView("welcome"); });
  refreshBtn.addEventListener("click", loadTeacherDashboard);
  if (reanalyzeBtn) reanalyzeBtn.addEventListener("click", reanalyzeAllSubmissions);
  if (teacherGuideBtn) {
    teacherGuideBtn.addEventListener("click", () => {
      window.open("/diagnostic-writing/teacher-guide/", "_blank", "noopener,noreferrer");
    });
  }
  exportBtn.addEventListener("click", exportCsv);
  document.getElementById("closeDetailBtn").addEventListener("click", () => detailPanel.classList.add("dw-hidden"));
  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".dw-filter");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filterBar.querySelectorAll(".dw-filter").forEach((b) => b.classList.toggle("dw-filter--active", b === btn));
    renderTeacherViews();
  });
  classFilter.addEventListener("change", () => {
    currentClassFilter = classFilter.value;
    renderTeacherViews();
  });
  if (teacherTabTable) {
    teacherTabTable.addEventListener("click", () => {
      setTeacherViewMode("table");
      renderTeacherViews();
    });
  }
  if (teacherTabReader) {
    teacherTabReader.addEventListener("click", () => {
      setTeacherViewMode("reader");
      renderTeacherViews();
    });
  }
  if (readerSortEl) {
    readerSortEl.addEventListener("change", () => {
      readerSort = readerSortEl.value;
      renderClassReader();
    });
  }
  if (readerPrintBtn) readerPrintBtn.addEventListener("click", printReaderList);
})();

(() => {
  "use strict";

  const DURATION_SEC = 300;
  const TEACHER_PASSWORD = "studentsfirst";
  const API_URL = "/api/diagnostic-writing/submissions";
  const LOCAL_KEY = "dw_local_submissions";

  const STOP_WORDS = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
    "is", "was", "it", "i", "we", "they", "he", "she", "my", "our", "that",
    "this", "with", "as", "be", "had", "have", "has", "were", "are", "am",
    "so", "if", "not", "by", "from", "up", "out", "just", "like", "very",
  ]);

  const SENSORY_PATTERN =
    /\b(saw|see|seen|heard|hear|felt|feel|smelled|smell|tasted|taste|touched|touch|bright|dark|loud|quiet|soft|rough|smooth|sweet|sour|cold|warm|hot|scary|exciting|beautiful|amazing|funny|nervous|happy|sad|angry|surprised)\b/gi;

  const SUBORDINATOR_PATTERN =
    /\b(because|although|though|while|when|if|since|unless|until|before|after|where|whereas|even though|so that|in order to|as soon as|whenever|wherever)\b/gi;

  const TRANSITION_PATTERN =
    /\b(then|next|finally|suddenly|meanwhile|later|afterward|eventually|one day|that day|first|second|lastly|soon|before long)\b/gi;

  // DOM refs
  const views = {
    welcome: document.getElementById("welcomeView"),
    writing: document.getElementById("writingView"),
    analyzing: document.getElementById("analyzingView"),
    results: document.getElementById("resultsView"),
    teacherLogin: document.getElementById("teacherLoginView"),
    teacher: document.getElementById("teacherView"),
  };

  const studentName = document.getElementById("studentName");
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

  let timerInterval = null;
  let elapsedSec = 0;
  let startTime = 0;
  let currentFilter = "all";
  let allSubmissions = [];
  let teacherAuthed = false;

  // --- View helpers ---

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
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  // --- Analysis engine ---

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
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function analyzeText(text, durationSec) {
    const words = text.trim() ? text.trim().split(/\s+/) : [];
    const wordCount = words.length;
    const minutes = durationSec / 60;
    const wpm = minutes > 0 ? wordCount / minutes : 0;

    const sentences = getSentences(text);
    const sentenceCount = Math.max(sentences.length, 1);
    const avgSentenceLength = wordCount / sentenceCount;

    const sentLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
    const avgLen = sentLengths.reduce((a, b) => a + b, 0) / sentLengths.length;
    const variance =
      sentLengths.reduce((sum, len) => sum + (len - avgLen) ** 2, 0) / sentLengths.length;
    const sentenceVariety = Math.sqrt(variance);

    const lowerWords = words.map((w) => w.toLowerCase().replace(/[^\w']/g, ""));
    const contentWords = lowerWords.filter((w) => w.length > 1 && !STOP_WORDS.has(w));
    const uniqueContent = new Set(contentWords);
    const lexicalDiversity = contentWords.length > 0 ? uniqueContent.size / contentWords.length : 0;

    const complexMarkers =
      (text.match(SUBORDINATOR_PATTERN) || []).length +
      (text.match(/;/g) || []).length +
      (text.match(/—|–/g) || []).length;

    const sensoryCount = (text.match(SENSORY_PATTERN) || []).length;
    const transitionCount = (text.match(TRANSITION_PATTERN) || []).length;
    const dialogueLines = (text.match(/["']/g) || []).length / 2;
    const longWords = lowerWords.filter((w) => w.length >= 7).length;
    const longWordRatio = wordCount > 0 ? longWords / wordCount : 0;

    const freq = {};
    for (const w of contentWords) freq[w] = (freq[w] || 0) + 1;
    const maxFreq = Math.max(0, ...Object.values(freq));
    const repetitionPenalty = wordCount > 0 ? maxFreq / wordCount : 0;

    // Scores 0–100
    const volumeScore = scoreFromRange(wordCount, [
      [0, 0],
      [40, 25],
      [75, 45],
      [100, 58],
      [150, 72],
      [200, 85],
      [280, 95],
      [400, 100],
    ]);

    const complexityScore = clamp(
      Math.round(
        scoreFromRange(avgSentenceLength, [[0, 20], [6, 40], [10, 65], [14, 80], [20, 90], [30, 95]]) * 0.35 +
          scoreFromRange(sentenceVariety, [[0, 20], [2, 40], [5, 65], [8, 80], [12, 95]]) * 0.25 +
          scoreFromRange(lexicalDiversity, [[0, 20], [0.35, 45], [0.5, 65], [0.65, 80], [0.8, 95]]) * 0.25 +
          scoreFromRange(complexMarkers, [[0, 30], [1, 50], [3, 70], [6, 85], [10, 100]]) * 0.15
      ),
      0,
      100
    );

    const creativityScore = clamp(
      Math.round(
        scoreFromRange(sensoryCount, [[0, 25], [1, 45], [3, 65], [6, 80], [10, 95]]) * 0.3 +
          scoreFromRange(transitionCount, [[0, 30], [1, 50], [3, 70], [6, 90]]) * 0.2 +
          scoreFromRange(dialogueLines, [[0, 40], [1, 60], [3, 80], [5, 95]]) * 0.15 +
          scoreFromRange(longWordRatio, [[0, 30], [0.05, 50], [0.1, 70], [0.15, 90]]) * 0.15 +
          scoreFromRange(lexicalDiversity, [[0, 20], [0.4, 55], [0.55, 75], [0.7, 95]]) * 0.2 -
          repetitionPenalty * 80
      ),
      0,
      100
    );

    const typingScore = scoreFromRange(wpm, [
      [0, 0],
      [8, 20],
      [15, 40],
      [22, 55],
      [30, 70],
      [38, 82],
      [45, 92],
      [55, 100],
    ]);

    const overallScore = Math.round(
      volumeScore * 0.35 + complexityScore * 0.25 + creativityScore * 0.2 + typingScore * 0.2
    );

    const typingLevel = classifyTyping(wordCount, wpm);
    const feedback = buildFeedback({
      wordCount,
      wpm,
      avgSentenceLength,
      sentenceVariety,
      lexicalDiversity,
      complexMarkers,
      sensoryCount,
      transitionCount,
      dialogueLines,
      repetitionPenalty,
      typingLevel,
      volumeScore,
      complexityScore,
      creativityScore,
      typingScore,
    });

    return {
      wordCount,
      wpm: Math.round(wpm * 10) / 10,
      sentenceCount,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      sentenceVariety: Math.round(sentenceVariety * 10) / 10,
      lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
      complexMarkers,
      sensoryCount,
      transitionCount,
      dialogueLines: Math.round(dialogueLines),
      scores: {
        volume: volumeScore,
        complexity: complexityScore,
        creativity: creativityScore,
        typing: typingScore,
        overall: overallScore,
      },
      typingLevel,
      feedback,
      flags: buildFlags(typingLevel, wordCount, wpm, complexityScore, creativityScore),
    };
  }

  function classifyTyping(wordCount, wpm) {
    if (wordCount < 60 || wpm < 12) return "intervention";
    if (wordCount < 110 || wpm < 20) return "developing";
    if (wordCount < 175 || wpm < 32) return "proficient";
    return "advanced";
  }

  function typingLabel(level) {
    const map = {
      intervention: "Needs intervention",
      developing: "Developing",
      proficient: "Proficient",
      advanced: "Advanced",
    };
    return map[level] || level;
  }

  function buildFlags(typingLevel, wordCount, wpm, complexityScore, creativityScore) {
    const flags = [];
    if (typingLevel === "intervention") {
      flags.push({
        type: "alert",
        text: "Typing intervention recommended — low fluency (" + wordCount + " words, " + Math.round(wpm) + " WPM)",
      });
    } else if (typingLevel === "advanced") {
      flags.push({ type: "ok", text: "Strong typing fluency — proficient typist" });
    } else if (typingLevel === "proficient") {
      flags.push({ type: "ok", text: "On-track typing fluency" });
    }
    if (complexityScore < 45) {
      flags.push({ type: "alert", text: "Sentence complexity is emerging — practice varied sentence structures" });
    }
    if (creativityScore < 45) {
      flags.push({ type: "alert", text: "Storytelling details are limited — encourage sensory language and specifics" });
    }
    if (complexityScore >= 70 && creativityScore >= 70) {
      flags.push({ type: "ok", text: "Strong writer — good complexity and creativity" });
    }
    return flags;
  }

  function buildFeedback(metrics) {
    const lines = [];
    const { wordCount, wpm, typingLevel } = metrics;

    if (wordCount >= 175) {
      lines.push(`Strong output: you wrote ${wordCount} words in five minutes (${Math.round(wpm)} WPM).`);
    } else if (wordCount >= 100) {
      lines.push(`Solid effort: ${wordCount} words (${Math.round(wpm)} WPM). Keep building stamina by writing daily.`);
    } else {
      lines.push(`You wrote ${wordCount} words (${Math.round(wpm)} WPM). Regular practice will help you type more in five minutes.`);
    }

    if (metrics.avgSentenceLength >= 12) {
      lines.push("Your sentences tend to be longer and more developed — good for storytelling.");
    } else if (metrics.avgSentenceLength < 7) {
      lines.push("Try combining some short sentences to add detail and flow.");
    }

    if (metrics.sentenceVariety >= 5) {
      lines.push("Nice variety in sentence length — that keeps a story interesting.");
    }

    if (metrics.sensoryCount >= 3) {
      lines.push("You used sensory and feeling words — readers can picture your experience.");
    } else {
      lines.push("Add what you saw, heard, felt, or smelled to make your story come alive.");
    }

    if (metrics.complexMarkers >= 2) {
      lines.push("You used connecting words (because, when, although…) to build complex ideas.");
    }

    if (metrics.repetitionPenalty > 0.12) {
      lines.push("Watch for repeating the same words — try synonyms to keep your writing fresh.");
    }

    if (typingLevel === "intervention") {
      lines.push("Focus area: typing practice will help you get your ideas down faster.");
    }

    return lines;
  }

  // --- Timer & writing ---

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
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  async function finishWriting() {
    stopTimer();
    storyInput.readOnly = true;
    showView("analyzing");

    const actualDuration = Math.min(Math.max(elapsedSec, 1), DURATION_SEC);
    const text = storyInput.value;
    const analysis = analyzeText(text, actualDuration);
    const name = studentName.value.trim();

    await submitResult(name, text, analysis, actualDuration);
    renderStudentResults(name, text, analysis);
    showView("results");
  }

  function renderStudentResults(name, text, analysis) {
    document.getElementById("resultName").textContent = name;
    document.getElementById("resultSummary").textContent =
      `You wrote ${analysis.wordCount} words at ${analysis.wpm} WPM. Overall score: ${analysis.scores.overall}/100.`;

    const grid = document.getElementById("scoreGrid");
    grid.innerHTML = "";
    const cards = [
      { key: "Words typed", score: analysis.scores.volume, sub: `${analysis.wordCount} words` },
      { key: "Typing fluency", score: analysis.scores.typing, sub: `${analysis.wpm} WPM · ${typingLabel(analysis.typingLevel)}` },
      { key: "Sentence complexity", score: analysis.scores.complexity, sub: `Avg ${analysis.avgSentenceLength} words/sentence` },
      { key: "Creativity", score: analysis.scores.creativity, sub: `${analysis.sensoryCount} sensory cues` },
    ];
    for (const c of cards) {
      const el = document.createElement("div");
      el.className = "dw-score-card";
      el.innerHTML = `
        <div class="dw-score-k">${c.key}</div>
        <div class="dw-score-v">${c.score}</div>
        <div class="dw-score-sub">${c.sub}</div>
      `;
      grid.appendChild(el);
    }

    const fb = document.getElementById("feedbackList");
    fb.innerHTML = analysis.feedback.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
    document.getElementById("storyPreview").textContent = text;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- Submission storage ---

  async function submitResult(name, text, analysis, durationSec) {
    const payload = { name, text, analysis, durationSec };
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
    } catch {
      // fall through to local storage
    }
    saveLocalSubmission(payload);
  }

  function saveLocalSubmission(entry) {
    const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    stored.unshift({
      id: `local-${Date.now()}`,
      ...entry,
      submittedAt: Date.now(),
    });
    localStorage.setItem(LOCAL_KEY, JSON.stringify(stored.slice(0, 200)));
  }

  async function fetchSubmissions() {
    try {
      const res = await fetch(`${API_URL}?password=${encodeURIComponent(TEACHER_PASSWORD)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.submissions)) return data.submissions;
      }
    } catch {
      // fall through
    }
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  }

  // --- Teacher dashboard ---

  function badgeClass(level) {
    return `dw-badge dw-badge--${level}`;
  }

  async function loadTeacherDashboard() {
    teacherMeta.textContent = "Loading submissions…";
    allSubmissions = await fetchSubmissions();
    teacherMeta.textContent = `${allSubmissions.length} submission${allSubmissions.length === 1 ? "" : "s"}`;
    renderTeacherTable();
  }

  function renderTeacherTable() {
    const filtered =
      currentFilter === "all"
        ? allSubmissions
        : allSubmissions.filter((s) => s.analysis?.typingLevel === currentFilter);

    teacherTableBody.innerHTML = "";
    const table = document.getElementById("teacherTable");
    emptyState.classList.toggle("dw-hidden", filtered.length > 0);
    table.classList.toggle("dw-hidden", filtered.length === 0);

    for (const sub of filtered) {
      const a = sub.analysis || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(sub.name)}</td>
        <td>${a.wordCount ?? "—"}</td>
        <td>${a.wpm ?? "—"}</td>
        <td><span class="${badgeClass(a.typingLevel)}">${typingLabel(a.typingLevel)}</span></td>
        <td>${a.scores?.complexity ?? "—"}</td>
        <td>${a.scores?.creativity ?? "—"}</td>
        <td>${a.scores?.overall ?? "—"}</td>
        <td>${sub.submittedAt ? formatDate(sub.submittedAt) : "—"}</td>
        <td><button class="dw-btn dw-btn-ghost dw-view-btn" type="button" data-id="${sub.id}">View</button></td>
      `;
      teacherTableBody.appendChild(tr);
    }

    teacherTableBody.querySelectorAll(".dw-view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = allSubmissions.find((s) => s.id === btn.dataset.id);
        if (sub) showDetail(sub);
      });
    });
  }

  function showDetail(sub) {
    const a = sub.analysis || {};
    detailPanel.classList.remove("dw-hidden");
    document.getElementById("detailName").textContent = sub.name;
    document.getElementById("detailStory").textContent = sub.text || "";

    const metrics = [
      ["Words", a.wordCount],
      ["WPM", a.wpm],
      ["Sentences", a.sentenceCount],
      ["Avg sentence length", a.avgSentenceLength],
      ["Sentence variety", a.sentenceVariety],
      ["Lexical diversity", a.lexicalDiversity],
      ["Complex markers", a.complexMarkers],
      ["Sensory words", a.sensoryCount],
      ["Transitions", a.transitionCount],
      ["Dialogue cues", a.dialogueLines],
      ["Volume score", a.scores?.volume],
      ["Complexity score", a.scores?.complexity],
      ["Creativity score", a.scores?.creativity],
      ["Typing score", a.scores?.typing],
      ["Overall", a.scores?.overall],
    ];

    document.getElementById("detailMetrics").innerHTML = metrics
      .map(
        ([k, v]) => `
        <div class="dw-metric">
          <div class="dw-metric-k">${k}</div>
          <div class="dw-metric-v">${v ?? "—"}</div>
        </div>`
      )
      .join("");

    const flagsEl = document.getElementById("detailFlags");
    flagsEl.innerHTML = (a.flags || [])
      .map((f) => `<span class="dw-flag dw-flag--${f.type}">${escapeHtml(f.text)}</span>`)
      .join("");

    document.getElementById("detailFeedback").innerHTML = (a.feedback || [])
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("");

    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exportCsv() {
    const headers = [
      "Name", "Words", "WPM", "Typing Level", "Complexity", "Creativity",
      "Overall", "Avg Sentence Length", "Submitted",
    ];
    const rows = allSubmissions.map((s) => {
      const a = s.analysis || {};
      return [
        s.name,
        a.wordCount,
        a.wpm,
        typingLabel(a.typingLevel),
        a.scores?.complexity,
        a.scores?.creativity,
        a.scores?.overall,
        a.avgSentenceLength,
        s.submittedAt ? new Date(s.submittedAt).toISOString() : "",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagnostic-writing-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Event handlers ---

  studentName.addEventListener("input", () => {
    startBtn.disabled = !studentName.value.trim();
  });

  startBtn.addEventListener("click", () => {
    if (!studentName.value.trim()) return;
    storyInput.value = "";
    storyInput.readOnly = false;
    showView("writing");
    storyInput.focus();
    startTimer();
  });

  storyInput.addEventListener("paste", (e) => {
    if (!storyInput.readOnly) e.preventDefault();
  });

  storyInput.addEventListener("input", updateLiveStats);

  restartBtn.addEventListener("click", () => {
    stopTimer();
    storyInput.value = "";
    storyInput.readOnly = false;
    studentName.value = "";
    startBtn.disabled = true;
    detailPanel.classList.add("dw-hidden");
    showView("welcome");
  });

  teacherBtn.addEventListener("click", () => {
    if (teacherAuthed) {
      showView("teacher");
      loadTeacherDashboard();
    } else {
      teacherPassword.value = "";
      teacherLoginError.classList.add("dw-hidden");
      showView("teacherLogin");
      teacherPassword.focus();
    }
  });

  teacherLoginBtn.addEventListener("click", async () => {
    if (teacherPassword.value === TEACHER_PASSWORD) {
      teacherAuthed = true;
      teacherLoginError.classList.add("dw-hidden");
      showView("teacher");
      await loadTeacherDashboard();
    } else {
      teacherLoginError.classList.remove("dw-hidden");
    }
  });

  teacherPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") teacherLoginBtn.click();
  });

  teacherCancelBtn.addEventListener("click", () => showView("welcome"));

  teacherLogoutBtn.addEventListener("click", () => {
    teacherAuthed = false;
    detailPanel.classList.add("dw-hidden");
    showView("welcome");
  });

  refreshBtn.addEventListener("click", loadTeacherDashboard);
  exportBtn.addEventListener("click", exportCsv);

  document.getElementById("closeDetailBtn").addEventListener("click", () => {
    detailPanel.classList.add("dw-hidden");
  });

  filterBar.addEventListener("click", (e) => {
    const btn = e.target.closest(".dw-filter");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filterBar.querySelectorAll(".dw-filter").forEach((b) => {
      b.classList.toggle("dw-filter--active", b === btn);
    });
    renderTeacherTable();
  });
})();

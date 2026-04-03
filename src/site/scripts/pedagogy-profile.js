/* global Chart */

const state = {
  data: null,
  idx: 0,
  responses: {}, // qid -> 1..5
  chart: null,
};

const el = (id) => document.getElementById(id);

function scaleOften() {
  return [
    { value: 1, label: "Never / almost never" },
    { value: 2, label: "Rarely" },
    { value: 3, label: "Sometimes" },
    { value: 4, label: "Often" },
    { value: 5, label: "Almost always" },
  ];
}

function scaleChoice() {
  return [
    { value: 1, label: "Almost always option A" },
    { value: 2, label: "Usually option A" },
    { value: 3, label: "About half-and-half" },
    { value: 4, label: "Usually option B" },
    { value: 5, label: "Almost always option B" },
  ];
}

const INSTRUMENT = {
  framework:
    "Answer 24 short prompts about what you typically do in your classroom (or aim to do). Each prompt uses 1–5 frequency anchors. Six spectrums; higher scores align with student-centered, constructivist, social, experiential, and process-oriented writing pedagogy. On **Traditional ↔ Process**, 100 = **process pedagogy** (drafting, revision, invention)—contrasted with the **Current Traditional Paradigm** in composition (product-focused, single-draft). Results display on a 1–100 scale.",
  likert: scaleOften(),
  spectrums: [
    {
      key: "TEACHER_TO_STUDENT",
      label: "Teacher-Centered ↔ Student-Centered",
      short: "Teacher → Student",
      left: "Teacher-centered",
      right: "Student-centered",
    },
    {
      key: "TRADITIONAL_TO_PROCESS",
      label: "Current Traditional Paradigm ↔ Process pedagogy (writing)",
      short: "Traditional → Process",
      left: "Current Traditional Paradigm",
      right: "Process pedagogy",
    },
    {
      key: "BEHAVIORISM_TO_CONSTRUCTIVISM",
      label: "Behaviorism ↔ Constructivism",
      short: "Behaviorism → Constructivism",
      left: "Behaviorism",
      right: "Constructivism",
    },
    {
      key: "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM",
      label: "Cognitivism ↔ Social Constructivism",
      short: "Cognitivism → Social",
      left: "Cognitivism",
      right: "Social constructivism",
    },
    {
      key: "DIRECT_TO_EXPERIENTIAL",
      label: "Direct Instruction ↔ Experiential Learning",
      short: "Direct → Experiential",
      left: "Direct instruction",
      right: "Experiential learning",
    },
    {
      key: "CONSTRUCTIVISM_INDEX",
      label: "Constructivism (index)",
      short: "Constructivism",
      left: "Less constructivist",
      right: "More constructivist",
    },
  ],
  questions: [
    // 24-item, behavior-anchored bank (4 items per spectrum)
    // Teacher-centered ↔ Student-centered (higher = student-centered)
    {
      id: 1,
      stem: "In a typical week, how often do students make meaningful choices about topic, process, or product (with clear success criteria)?",
      spectrum: "TEACHER_TO_STUDENT",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 2,
      stem: "How often do you begin a lesson/unit by telling students exactly what to do step-by-step for most of the time?",
      spectrum: "TEACHER_TO_STUDENT",
      reverse_scored: true,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },
    {
      id: 3,
      stem: "When a student is stuck, how often do you ask a question that helps them generate the next step before you give the answer?",
      spectrum: "TEACHER_TO_STUDENT",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 4,
      stem: "How often do you adjust pacing, groupings, or scaffolds based on quick evidence of learning (not just a plan)?",
      spectrum: "TEACHER_TO_STUDENT",
      reverse_scored: false,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },

    // Current Traditional Paradigm ↔ Process pedagogy (composition); higher = process-oriented (100 = process)
    {
      id: 5,
      stem: "How often do students move through multiple drafts of a piece of writing, with meaningful revision between drafts?",
      spectrum: "TRADITIONAL_TO_PROCESS",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 6,
      stem: "How often do you respond to drafts in progress (conference, comment, workshop) rather than only grading a final product?",
      spectrum: "TRADITIONAL_TO_PROCESS",
      reverse_scored: false,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },
    {
      id: 7,
      stem: "How often is a writing grade based mainly on a single submitted draft with little or no revision cycle?",
      spectrum: "TRADITIONAL_TO_PROCESS",
      reverse_scored: true,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },
    {
      id: 8,
      stem: "How often do students spend class time on invention, exploration, or discovery before a fixed form is required?",
      spectrum: "TRADITIONAL_TO_PROCESS",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },

    // Behaviorism ↔ Constructivism (higher = constructivism)
    {
      id: 9,
      stem: "How often do students revise work based on feedback and submit a second (or third) version?",
      spectrum: "BEHAVIORISM_TO_CONSTRUCTIVISM",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 10,
      stem: "How often do you treat mistakes as data (predict → test → explain → revise), not as something to avoid quickly?",
      spectrum: "BEHAVIORISM_TO_CONSTRUCTIVISM",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 11,
      stem: "How often is “being correct on the first try” the main signal students receive that learning happened?",
      spectrum: "BEHAVIORISM_TO_CONSTRUCTIVISM",
      reverse_scored: true,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },
    {
      id: 12,
      stem: "How often do students build understanding by connecting new ideas to prior experiences/examples they bring in?",
      spectrum: "BEHAVIORISM_TO_CONSTRUCTIVISM",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },

    // Cognitivism ↔ Social constructivism (higher = social)
    {
      id: 13,
      stem: "How often do you structure discussion so students respond to each other with evidence (not just to you)?",
      spectrum: "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 14,
      stem: "How often do students use shared tools to co-construct meaning (e.g., shared notes, group models, joint solutions)?",
      spectrum: "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 15,
      stem: "How often is most thinking done silently and individually, with limited peer interaction during learning?",
      spectrum: "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM",
      reverse_scored: true,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },
    {
      id: 16,
      stem: "How often do students take roles that improve the quality of talk (summarizer, challenger, connector, evidence-checker)?",
      spectrum: "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM",
      reverse_scored: false,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },

    // Direct instruction ↔ Experiential learning (higher = experiential)
    {
      id: 17,
      stem: "How often do students learn through authentic tasks (real audience, real data, real constraints) rather than only practice sets?",
      spectrum: "DIRECT_TO_EXPERIENTIAL",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 18,
      stem: "How often do you run “task first, mini-lesson after” so students notice patterns before you explain them?",
      spectrum: "DIRECT_TO_EXPERIENTIAL",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 19,
      stem: "How often is most class time spent on teacher explanation/modeling while students mainly listen or copy notes?",
      spectrum: "DIRECT_TO_EXPERIENTIAL",
      reverse_scored: true,
      contributes_to_constructivism: false,
      anchors: scaleOften(),
    },
    {
      id: 20,
      stem: "How often do students create a product/performance that requires applying learning in a new context?",
      spectrum: "DIRECT_TO_EXPERIENTIAL",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },

    // Constructivism index (higher = more constructivist)
    // (Kept as an index: not a strict bipolar spectrum; still displayed as a left↔right continuum for readability.)
    {
      id: 21,
      stem: "How often do students use a rubric or success criteria they helped clarify (even if you drafted it first)?",
      spectrum: "CONSTRUCTIVISM_INDEX",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 22,
      stem: "How often do students generate questions that shape the lesson (what to investigate, what to test, what to read next)?",
      spectrum: "CONSTRUCTIVISM_INDEX",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 23,
      stem: "How often do students do short metacognitive routines (plan → monitor → reflect) during or after learning?",
      spectrum: "CONSTRUCTIVISM_INDEX",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
    {
      id: 24,
      stem: "How often do students critique each other’s work using a protocol, then revise based on that critique?",
      spectrum: "CONSTRUCTIVISM_INDEX",
      reverse_scored: false,
      contributes_to_constructivism: true,
      anchors: scaleOften(),
    },
  ],
};

function show(viewId) {
  for (const id of ["welcome", "question", "results"]) el(id).classList.add("pp-hidden");
  el(viewId).classList.remove("pp-hidden");
}

function setHeader(title, pill) {
  el("stepTitle").textContent = title;
  el("progressPill").textContent = pill;
}

function questionCount() {
  return state.data?.questions?.length ?? 0;
}

function currentQuestion() {
  return state.data.questions[state.idx];
}

function buildChoices(q) {
  const container = el("choices");
  container.innerHTML = "";
  const selected = state.responses[q.id] ?? 0;

  const anchors = Array.isArray(q?.anchors) && q.anchors.length === 5 ? q.anchors : state.data.likert;
  for (const item of anchors) {
    const wrap = document.createElement("label");
    wrap.className = "pp-choice";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "likert";
    input.value = String(item.value);
    input.checked = selected === item.value;

    input.addEventListener("change", () => {
      state.responses[q.id] = item.value;
    });

    const text = document.createElement("div");
    const top = document.createElement("div");
    top.className = "pp-choice-lbl";
    top.textContent = `${item.value} — ${item.label}`;
    text.appendChild(top);

    wrap.appendChild(input);
    wrap.appendChild(text);
    container.appendChild(wrap);
  }
}

function updateRadar(scores100) {
  const order = state.data.spectrums.map((s) => s.key);

  const labels = order.map((k) => {
    const spec = state.data.spectrums.find((x) => x.key === k);
    return spec?.short ?? k;
  });
  const values = order.map((k) => Number(scores100?.[k] ?? 50.5));

  const ctx = el("radarCanvas").getContext("2d");
  if (!state.chart) {
    state.chart = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Score (1–100)",
            data: values,
            borderColor: "rgba(79,124,255,0.95)",
            backgroundColor: "rgba(79,124,255,0.16)",
            pointBackgroundColor: "rgba(79,124,255,0.95)",
            pointRadius: 3,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, showLabelBackdrop: false, color: "rgba(232,238,252,0.8)" },
            grid: { color: "rgba(255,255,255,0.10)" },
            angleLines: { color: "rgba(255,255,255,0.10)" },
            pointLabels: { color: "rgba(232,238,252,0.92)", font: { size: 12, weight: "700" } },
          },
        },
        plugins: { legend: { display: false } },
      },
    });
    el("radarCanvas").parentElement.style.height = "520px";
  } else {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.update();
  }
}

function reverseIfNeeded(v, reverse) {
  return reverse ? 6 - v : v;
}

function likertMeanTo100(mean1to5) {
  return 1 + (mean1to5 - 1) * (99 / 4);
}

function computeScores(responses) {
  const sums = {};
  const counts = {};

  const add = (key, value) => {
    sums[key] = (sums[key] ?? 0) + value;
    counts[key] = (counts[key] ?? 0) + 1;
  };

  for (const q of state.data.questions) {
    const raw = Number(responses[q.id] ?? 0);
    if (!Number.isFinite(raw) || raw < 1 || raw > 5) continue;
    const adj = reverseIfNeeded(raw, Boolean(q.reverse_scored));
    add(q.spectrum, adj);
    if (q.contributes_to_constructivism) add("CONSTRUCTIVISM_INDEX", adj);
  }

  const means = {};
  const scores100 = {};
  for (const s of state.data.spectrums) {
    const c = counts[s.key] ?? 0;
    const mean = c > 0 ? (sums[s.key] ?? 0) / c : 3.0;
    means[s.key] = mean;
    scores100[s.key] = likertMeanTo100(mean);
  }

  return { means, scores100 };
}

function rankSpectrums(scores100) {
  const items = state.data.spectrums
    .map((s) => ({ field: s.key, score: Number(scores100?.[s.key] ?? 50.5) }))
    .sort((a, b) => b.score - a.score);
  return { ranked_high: items, ranked_low: [...items].reverse() };
}

function band(score100) {
  if (score100 >= 88) return "Distinguished alignment";
  if (score100 >= 75) return "Strong alignment";
  if (score100 >= 62) return "Solid alignment";
  if (score100 >= 48) return "Developing alignment";
  if (score100 >= 35) return "Emerging alignment";
  return "Entry / high-growth zone";
}

function renderSpectrumBars(scores100) {
  const wrap = el("spectrumBars");
  if (!wrap) return;
  wrap.innerHTML = "";

  for (const spec of state.data.spectrums) {
    const score = Math.max(1, Math.min(100, Number(scores100?.[spec.key] ?? 50.5)));
    const card = document.createElement("div");
    card.className = "pp-bar";

    const header = document.createElement("div");
    header.className = "pp-bar-h";

    const title = document.createElement("div");
    title.className = "pp-bar-title";
    title.textContent = spec.label;

    const meta = document.createElement("div");
    meta.className = "pp-bar-score";
    meta.textContent = `${Math.round(score)}/100 · ${band(score)}`;

    header.appendChild(title);
    header.appendChild(meta);

    const track = document.createElement("div");
    track.className = "pp-bar-track";

    const fill = document.createElement("div");
    fill.className = "pp-bar-fill";
    fill.style.width = `${score}%`;

    const mid = document.createElement("div");
    mid.className = "pp-bar-mid";

    const marker = document.createElement("div");
    marker.className = "pp-bar-marker";
    marker.style.left = `${score}%`;

    track.appendChild(fill);
    track.appendChild(mid);
    track.appendChild(marker);

    const poles = document.createElement("div");
    poles.className = "pp-bar-poles";

    const left = document.createElement("div");
    left.className = "pp-bar-pole-l";
    left.textContent = spec.left;

    const right = document.createElement("div");
    right.className = "pp-bar-pole-r";
    right.textContent = spec.right;

    poles.appendChild(left);
    poles.appendChild(right);

    const rec = document.createElement("div");
    rec.className = "pp-bar-rec";
    rec.innerHTML = `<b>Try next week:</b> ${microRecommendation(spec.key, score)}`;

    card.appendChild(header);
    card.appendChild(track);
    card.appendChild(poles);
    card.appendChild(rec);
    wrap.appendChild(card);
  }
}

function microRecommendation(fieldKey, score100) {
  const towardRight = score100 < 62;
  const toward = towardRight ? "toward the right-hand pole" : "without losing what already works";

  const picks = {
    TEACHER_TO_STUDENT: towardRight
      ? "Offer one bounded choice (topic OR method OR product) and keep success criteria constant."
      : "Ask students to propose the next step before you intervene; then compare their plan to yours."
    ,
    TRADITIONAL_TO_PROCESS: towardRight
      ? "Pilot a two-draft minimum on one assignment: quick first draft → reader response → revision before the grade."
      : "Add a meta question after revision: ‘What did you discover in drafting that you couldn’t plan in advance?’"
    ,
    BEHAVIORISM_TO_CONSTRUCTIVISM: towardRight
      ? "Add a revision loop: feedback → 10-minute revise → resubmit (collect both versions)."
      : "Make errors productive: have students explain a common misconception and how evidence changed their thinking."
    ,
    COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: towardRight
      ? "Run a 6-minute structured talk: roles + sentence stems (‘I agree because… / I challenge because…’)."
      : "Tighten collaboration: require evidence-based replies and a shared artifact (one group model, not four copies)."
    ,
    DIRECT_TO_EXPERIENTIAL: towardRight
      ? "Convert one explanation into ‘task first’: a short problem/task, then a mini-lesson after students notice patterns."
      : "Add an authentic constraint (real audience/data/tool) to one activity so doing stays aligned to goals."
    ,
    CONSTRUCTIVISM_INDEX: towardRight
      ? "Add a 2-question reflection: ‘What did I try?’ and ‘What will I do differently next time?’ (2 minutes)."
      : "Add peer critique with a simple protocol (glow/grow + one required revision) and collect the revision."
    ,
  };

  return `${picks[fieldKey] ?? "Pick one routine you can repeat 3 times in two weeks, then re-take the profile to see movement."} (${toward}.)`;
}

function improvementBullets(specKey, score100) {
  const s = Number(score100);
  const tier = s < 48 ? "strong" : s < 75 ? "moderate" : "refine";
  const packs = {
    TEACHER_TO_STUDENT: {
      strong: [
        "Offer one bounded student choice per week (topic, method, or product) with a shared rubric.",
        "Replace one ‘tell’ segment with questions so students generate the next step.",
      ],
      moderate: ["Co-create success criteria before students start one upcoming task.", "Use think–pair–share before you summarize."],
      refine: ["Document when students led the agenda; replicate what worked next unit.", "Keep high agency with tight feedback loops."],
    },
    TRADITIONAL_TO_PROCESS: {
      strong: [
        "Two-draft minimum before summative grade on one writing task; separate draft feedback from final evaluation.",
        "One class period for invention (freewrite, questioning) before locking thesis or outline.",
        "Peer response to drafts with a short protocol—not only line edits on polished text.",
        "Comment on drafts as a reader first (‘I’m confused here…’) before judging correctness.",
      ],
      moderate: [
        "One conference or audio comments on a draft before the final.",
        "Weight process (planning notes, revision log) for a small part of the grade.",
      ],
      refine: [
        "Students pick one global revision focus per draft (structure, evidence, voice).",
        "Ask: ‘What did you discover while drafting that you couldn’t plan?’",
      ],
    },
    BEHAVIORISM_TO_CONSTRUCTIVISM: {
      strong: ["Feedback → revise → resubmit with a one-line reflection on what changed.", "Swap one ‘correct answer’ check for ‘best explanation + what would change it.’"],
      moderate: ["Improve one anonymous sample as a class.", "Celebrate revision in public: ‘What changed between v1 and v2?’"],
      refine: ["Students tag what changed between versions.", "Normalize error as data in one unit routine."],
    },
    COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: {
      strong: ["Roles + evidence-based replies in discussion.", "Structured controversy with sentence stems."],
      moderate: ["Turn-and-talk before whole-class.", "One shared group artifact per task."],
      refine: ["Tighten norms so talk changes thinking, not just airtime.", "Require citing a peer’s idea."],
    },
    DIRECT_TO_EXPERIENTIAL: {
      strong: ["Task first, mini-lesson after in one lesson.", "One real audience or authentic constraint per unit."],
      moderate: ["Simulation or case before defining terms.", "Short field-like task before notes."],
      refine: ["Clarify success criteria for discovery tasks.", "Debrief patterns before naming rules."],
    },
    CONSTRUCTIVISM_INDEX: {
      strong: ["Co-build one rubric row; try it once.", "3-minute plan–monitor–reflect after a complex task."],
      moderate: ["Peer critique protocol + required revision.", "Student-generated questions drive one lesson segment."],
      refine: ["Track one strategy students used and its effect.", "Glow/grow with one mandatory revision."],
    },
  };
  const p = packs[specKey]?.[tier] ?? packs[specKey]?.moderate ?? [];
  const out = [...p];
  if (s < 62) {
    out.unshift(`Priority: move toward the right-hand pole in small, repeatable steps.`);
  }
  return out.slice(0, 5);
}

function buildReportText(scores100, means) {
  const lines = [];
  lines.push("FRAMEWORK");
  lines.push("—".repeat(44));
  lines.push(
    `This version has ${state.data.questions.length} behavior-anchored prompts (1–5) across six spectrums. Higher = more alignment with the right-hand pole (or constructivist index). **Traditional → Process** = composition: current-traditional (product/single-draft) vs. **process pedagogy** (drafting, revision, invention—Murray / writing-process tradition).`
  );
  lines.push("");
  lines.push("RAW (mean Likert per spectrum, 1–5)");
  lines.push("—".repeat(44));
  for (const spec of state.data.spectrums) {
    const v = Number(means?.[spec.key] ?? 3.0);
    lines.push(`${spec.short}: ${v.toFixed(2)}/5`);
  }
  lines.push("");
  lines.push("IMPROVEMENT MOVES (toward 100)");
  lines.push("—".repeat(44));
  for (const spec of state.data.spectrums) {
    const s = Number(scores100?.[spec.key] ?? 50.5);
    lines.push(`${spec.short} — ${s.toFixed(0)}/100`);
    for (const b of improvementBullets(spec.key, s)) {
      lines.push(`  • ${b}`);
    }
    lines.push("");
  }
  lines.push("FIELD-BY-FIELD SNAPSHOT");
  lines.push("—".repeat(44));
  for (const spec of state.data.spectrums) {
    const s = Number(scores100?.[spec.key] ?? 50.5);
    const pos =
      s <= 35
        ? `Leans toward ${spec.left}.`
        : s <= 48
          ? `Slight lean toward ${spec.left}.`
          : s < 62
            ? "Sits near the middle (mix of both)."
            : s < 75
              ? `Slight lean toward ${spec.right}.`
              : `Leans toward ${spec.right}.`;
    lines.push(`${spec.label} — ${s.toFixed(1)}/100 — ${band(s)}`);
    lines.push(pos);
    lines.push("");
  }
  lines.push("NOTE");
  lines.push("—".repeat(44));
  lines.push(
    "Use these as reflection signals, not grades. A ‘low’ score often reflects context (content, time, safety, class culture) and deliberate tradeoffs, not a deficit."
  );
  return lines.join("\n");
}

function renderWelcome() {
  setHeader("Welcome", "Ready");
  el("frameworkText").textContent = state.data.framework ?? "";
  show("welcome");
  updateRadar(null);
}

function renderQuestion() {
  const q = currentQuestion();
  setHeader("Question", `Q ${state.idx + 1} / ${questionCount()}`);
  el("spectrumLabel").textContent =
    state.data.spectrums.find((s) => s.key === q.spectrum)?.label ?? q.spectrum;
  el("qStem").textContent = q.stem;
  buildChoices(q);
  show("question");
}

function formatTop(fields) {
  const names = fields.slice(0, 2).map((x) => {
    const spec = state.data.spectrums.find((s) => s.key === x.field);
    return spec?.short ?? x.field;
  });
  return names.join(", ");
}

async function renderResults() {
  setHeader("Results", "Scoring…");
  show("results");

  const { means, scores100 } = computeScores(state.responses);
  const ranked = rankSpectrums(scores100);

  updateRadar(scores100);
  renderSpectrumBars(scores100);
  el("reportText").textContent = buildReportText(scores100, means);
  el("strengthsText").textContent = formatTop(ranked.ranked_high);
  el("growthText").textContent = formatTop(ranked.ranked_low);
  setHeader("Results", "Done");
}

function selectedForCurrent() {
  const q = currentQuestion();
  return Number(state.responses[q.id] ?? 0);
}

function wireKeys() {
  window.addEventListener("keydown", (e) => {
    const viewWelcome = !el("welcome").classList.contains("pp-hidden");
    const viewQuestion = !el("question").classList.contains("pp-hidden");

    if (viewWelcome && e.key === "Enter") {
      e.preventDefault();
      el("beginBtn").click();
      return;
    }

    if (!viewQuestion) return;

    if (["1", "2", "3", "4", "5"].includes(e.key)) {
      const q = currentQuestion();
      state.responses[q.id] = Number(e.key);
      renderQuestion();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      el("nextBtn").click();
      return;
    }
  });
}

function reset() {
  state.idx = 0;
  state.responses = {};
  renderWelcome();
}

async function init() {
  setHeader("Loading…", "Please wait");
  state.data = INSTRUMENT;

  wireKeys();
  el("beginBtn").addEventListener("click", () => {
    state.idx = 0;
    renderQuestion();
  });
  el("restartBtn").addEventListener("click", () => reset());
  el("backBtn").addEventListener("click", () => {
    if (state.idx === 0) {
      renderWelcome();
      return;
    }
    state.idx -= 1;
    renderQuestion();
  });
  el("nextBtn").addEventListener("click", async () => {
    if (selectedForCurrent() < 1) return;
    if (state.idx >= questionCount() - 1) {
      await renderResults();
      return;
    }
    state.idx += 1;
    renderQuestion();
  });

  renderWelcome();
}

init().catch((err) => {
  console.error(err);
  setHeader("Error", "See console");
  el("welcome").classList.remove("pp-hidden");
  el("frameworkText").textContent = String(err?.message ?? err);
});


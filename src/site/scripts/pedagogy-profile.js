/* global Chart */

const state = {
  data: null,
  idx: 0,
  responses: {}, // qid -> 1..5
  chart: null,
  picks: {}, // spectrumKey -> suggestion index
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
    "Answer 24 short questions about what you typically do in your classroom (or aim to do).\nYou'll be scored along 6 spectrums.\nHigher scores align with student-centered, constructivist, social, experiential, and process-oriented pedagogy.",
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

// 60 total suggestions (10 per spectrum), oriented toward moving toward 100 (right-hand pole).
const SUGGESTION_BANK = {
  TEACHER_TO_STUDENT: [
    "Offer one bounded choice (topic OR method OR product) while keeping success criteria constant.",
    "Co-create success criteria: show 2 exemplars, ask ‘what makes this strong?’, and post the class rubric.",
    "Use a ‘help ladder’: students try a strategy, ask a peer, then ask you—before you rescue.",
    "Start with a student question: collect 5 questions, pick 2 to investigate today, and revisit at the end.",
    "Replace one teacher explanation with a guided inquiry task + debrief (students notice patterns first).",
    "Add a ‘decision point’ checkpoint: students choose next steps (practice set A/B, extension, or reteach station).",
    "Use exit tickets that require agency: ‘What did you choose today and why?’",
    "Rotate roles so students lead parts of the routine (warm-up facilitator, summarizer, question curator).",
    "Make feedback student-driven: students pick one rubric row to improve and plan the revision.",
    "Run a 10-minute studio/work time with conferencing while students manage pacing via a checklist.",
  ],
  TRADITIONAL_TO_PROCESS: [
    "Two-draft minimum: quick draft → reader response → revision before the grade counts.",
    "Teach revision as global change: one revision target per draft (structure OR evidence OR clarity), not just edits.",
    "Schedule invention time (freewrite, question-burst, quick research) before thesis/outline is fixed.",
    "Respond as a reader first (‘I’m confused here… I’m interested here…’) before correctness comments.",
    "Use brief writing conferences on drafts-in-progress (3–5 minutes each) before the final submission.",
    "Add peer response with a protocol (what works / what’s unclear / one question) and require a revision note.",
    "Require a revision log: ‘What changed? Why? What feedback did you use?’ (2 minutes).",
    "Grade process lightly: small points for draft, revision, and reflection to signal writing is iterative.",
    "Model your own messy draft and revise it live so students see real composing decisions.",
    "End a writing block with: ‘What did you discover while drafting that you couldn’t have planned?’",
  ],
  BEHAVIORISM_TO_CONSTRUCTIVISM: [
    "Run predict → test → explain → revise at least once per week to normalize revision and sense-making.",
    "Collect two versions: students submit v1 and v2 with a one-line ‘what changed’ reflection.",
    "Use one ‘productive error’ routine: analyze a common misconception and improve it together.",
    "Swap one correctness check for ‘best current explanation + what evidence would change your mind?’",
    "Let students generate examples/counterexamples before you define the rule or concept.",
    "Use ‘My first idea / My revised idea’ exit tickets to reward changing thinking with evidence.",
    "Design one task with multiple valid approaches and have students compare strategies publicly.",
    "Add a ‘revision after feedback’ expectation for one assignment (not optional).",
    "Use warm feedback + one actionable next step; students must act on it before final submission.",
    "Ask students to annotate their work: ‘Where did I revise my thinking?’",
  ],
  COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: [
    "Use roles in talk (summarizer, challenger, connector, evidence-checker) and rotate weekly.",
    "Require evidence-based replies: ‘I agree/disagree because…’ plus a quote, data point, or example.",
    "Have groups produce one shared artifact (one model/solution), not four parallel copies.",
    "Run a structured academic controversy (argue both sides, then synthesize a joint position).",
    "Use sentence stems that force uptake: ‘I used to think…, now I think… because…’",
    "Teach a discussion skill explicitly (paraphrase, ask a clarifying question, build on a peer).",
    "Use think–pair–share, but require pairs to merge ideas into one improved claim before sharing.",
    "Create a ‘question curator’ role: students choose which questions the group will answer publicly.",
    "Use peer teaching: one student explains a strategy, another adds a caveat/example, group revises.",
    "Add a norm check: groups self-rate talk quality (equity of voice + evidence) after discussion.",
  ],
  DIRECT_TO_EXPERIENTIAL: [
    "Flip one lesson: short task first → pattern noticing → mini-lesson after students struggle productively.",
    "Add an authentic constraint (real audience, real data, real tool) for 15 minutes of a lesson.",
    "Use a simulation/case before defining terms; students propose solutions, then learn the concept.",
    "Turn one practice set into an applied product (poster, tutorial, explanation video, letter).",
    "Use stations: one hands-on task, one coached practice, one extension, one reflection checkpoint.",
    "Have students test a claim with data (even a small class dataset) and argue from evidence.",
    "Require application in a new context: ‘same concept, different setting’ exit problem.",
    "Use ‘build → break → rebuild’: make a model, stress-test it, then revise it.",
    "Invite a real reader/user (another class, admin, community) for one authentic feedback moment.",
    "End with a debrief: ‘What did we notice first? What did the mini-lesson clarify?’",
  ],
  CONSTRUCTIVISM_INDEX: [
    "Co-clarify one rubric row with students; use it immediately on a draft or practice task.",
    "Add plan–monitor–reflect in 3 minutes (What’s my plan? What’s working? What will I adjust?).",
    "Use peer critique (glow/grow + one specific revision) and collect the revision, not just comments.",
    "Have students generate questions that shape the lesson’s investigation (choose 2 to pursue).",
    "Require a revision submission with a short note: ‘Here’s what I changed and why.’",
    "Normalize error: celebrate a ‘best mistake’ and what it taught the class.",
    "Have students self-assess one criterion before you grade; compare their rating to yours.",
    "Use exemplars: students sort samples from weak→strong and extract criteria.",
    "Add a reflection prompt: ‘What strategy did I use and when did I switch?’",
    "Do a 2-minute peer check for understanding (teach-back) before moving on.",
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

function updateRadar(scores100, growthKeys) {
  const order = state.data.spectrums.map((s) => s.key);
  const growth = new Set(Array.isArray(growthKeys) ? growthKeys : []);

  const labels = order.map((k) => {
    const spec = state.data.spectrums.find((x) => x.key === k);
    const short = spec?.short ?? k;
    return growth.has(k) ? `${short} ★` : short;
  });
  const values = order.map((k) => Number(scores100?.[k] ?? 50.5));
  const pointRadius = order.map((k) => (growth.has(k) ? 8 : 3));
  const pointHoverRadius = order.map((k) => (growth.has(k) ? 10 : 5));
  const pointBackgroundColor = order.map((k) =>
    growth.has(k) ? "rgba(251,191,36,0.95)" : "rgba(79,124,255,0.95)"
  );
  const pointBorderColor = order.map((k) => (growth.has(k) ? "rgba(255,255,255,0.95)" : "rgba(79,124,255,0.35)"));
  const pointBorderWidth = order.map((k) => (growth.has(k) ? 2 : 1));

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
            pointBackgroundColor,
            pointBorderColor,
            pointBorderWidth,
            pointRadius,
            pointHoverRadius,
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
    const ds = state.chart.data.datasets[0];
    ds.pointBackgroundColor = pointBackgroundColor;
    ds.pointBorderColor = pointBorderColor;
    ds.pointBorderWidth = pointBorderWidth;
    ds.pointRadius = pointRadius;
    ds.pointHoverRadius = pointHoverRadius;
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

function renderSpectrumBars(scores100, growthKeys) {
  const wrap = el("spectrumBars");
  if (!wrap) return;
  wrap.innerHTML = "";
  const growth = new Set(Array.isArray(growthKeys) ? growthKeys : []);

  for (const spec of state.data.spectrums) {
    const score = Math.max(1, Math.min(100, Number(scores100?.[spec.key] ?? 50.5)));
    const card = document.createElement("div");
    card.className = "pp-bar";
    if (growth.has(spec.key)) card.classList.add("pp-bar--growth");

    if (growth.has(spec.key)) {
      const ribbon = document.createElement("div");
      ribbon.className = "pp-growth-ribbon";
      ribbon.textContent = "Growth focus";
      card.appendChild(ribbon);
    }

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

    card.appendChild(header);
    card.appendChild(track);
    card.appendChild(poles);
    wrap.appendChild(card);
  }
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

function renderPickStrategies(scores100, rankedLow) {
  const wrap = el("pickWrap");
  const grid = el("pickGrid");
  const note = el("pickNote");
  if (!wrap || !grid || !note) return;

  const growthKeys = (rankedLow ?? []).slice(0, 2).map((x) => x.field);
  const growthSet = new Set(growthKeys);
  const growthNames = growthKeys
    .map((k) => state.data.spectrums.find((s) => s.key === k)?.short ?? k)
    .join(", ");
  note.textContent = `Biggest growth edges to prioritize: ${growthNames || "—"}. Those two spectrums are highlighted below. Pick one strategy per spectrum for your next 2-week focus.`;

  grid.innerHTML = "";
  state.picks = {};

  const specsSorted = [...state.data.spectrums].sort((a, b) => {
    const ag = growthSet.has(a.key) ? 0 : 1;
    const bg = growthSet.has(b.key) ? 0 : 1;
    return ag - bg;
  });

  for (const spec of specsSorted) {
    const s = Number(scores100?.[spec.key] ?? 50.5);
    const suggestions = SUGGESTION_BANK?.[spec.key] ?? [];

    const card = document.createElement("div");
    card.className = "pp-pick-card";
    if (growthSet.has(spec.key)) card.classList.add("pp-pick-card--growth");

    const title = document.createElement("div");
    title.className = "pp-pick-title";
    if (growthSet.has(spec.key)) {
      title.innerHTML = `${spec.label} <span class="pp-pick-growth-badge">Growth focus</span>`;
    } else {
      title.textContent = spec.label;
    }
    card.appendChild(title);

    const list = document.createElement("div");
    list.className = "pp-pick-list";

    const recommended = improvementBullets(spec.key, s).slice(0, 2);

    suggestions.forEach((txt, idx) => {
      const opt = document.createElement("label");
      opt.className = "pp-pick-opt";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = `pick-${spec.key}`;
      input.value = String(idx);
      input.addEventListener("change", () => {
        state.picks[spec.key] = idx;
      });

      const t = document.createElement("div");
      t.className = "pp-pick-txt";
      t.textContent = txt;

      const badge = document.createElement("span");
      badge.className = "pp-pick-badge";
      if (recommended.some((r) => (r || "").toLowerCase().includes((txt || "").toLowerCase().slice(0, 18)))) {
        badge.textContent = "Recommended";
      } else if (growthKeys.includes(spec.key) && idx < 2) {
        badge.textContent = "Growth edge";
      } else {
        badge.textContent = "";
      }

      opt.appendChild(input);
      opt.appendChild(t);
      if (badge.textContent) opt.appendChild(badge);
      list.appendChild(opt);
    });

    card.appendChild(list);
    grid.appendChild(card);
  }
}

function selectedPicksComplete() {
  return state.data.spectrums.every((s) => Number.isInteger(state.picks?.[s.key]));
}

function buildFinalFocusSection() {
  const lines = [];
  lines.push("PRACTICAL FOCUS (your 6 chosen strategies)");
  lines.push("—".repeat(44));
  for (const spec of state.data.spectrums) {
    const idx = state.picks?.[spec.key];
    const txt = (SUGGESTION_BANK?.[spec.key] ?? [])[idx] ?? "—";
    lines.push(`${spec.short}: ${txt}`);
  }
  return lines.join("\n");
}

function strengthSummary(fieldKey) {
  const spec = state.data.spectrums.find((s) => s.key === fieldKey);
  if (!spec) return "You excel at making strong instructional choices.";
  const map = {
    TEACHER_TO_STUDENT: `You excel at sharing agency with students while keeping expectations clear.`,
    TRADITIONAL_TO_PROCESS: `You excel at treating writing as a process—drafting, feedback, and revision as learning.`,
    BEHAVIORISM_TO_CONSTRUCTIVISM: `You excel at helping students build understanding through revision, evidence, and reflection.`,
    COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: `You are very good at using discourse and collaboration to deepen learning.`,
    DIRECT_TO_EXPERIENTIAL: `You fully understand how to make learning stick through authentic, applied experiences.`,
    CONSTRUCTIVISM_INDEX: `You excel at routines that make thinking visible—reflection, criteria, critique, and revision.`,
  };
  return map[fieldKey] ?? `You excel at ${spec.right.toLowerCase()} practices.`;
}

function growthGoal(fieldKey) {
  const spec = state.data.spectrums.find((s) => s.key === fieldKey);
  if (!spec) return "Choose one small routine to repeat for two weeks.";
  const map = {
    TEACHER_TO_STUDENT: "Growth goal: shift one consequential decision to students (topic/method/product) while holding criteria steady.",
    TRADITIONAL_TO_PROCESS: "Growth goal: implement a two-draft minimum and respond to drafts-in-progress before grading the final.",
    BEHAVIORISM_TO_CONSTRUCTIVISM: "Growth goal: add a predict → test → explain → revise loop and collect revisions, not just finals.",
    COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM: "Growth goal: structure talk so students respond to peers with evidence and produce a shared artifact.",
    DIRECT_TO_EXPERIENTIAL: "Growth goal: convert one explanation into task-first learning with an authentic constraint and a debrief.",
    CONSTRUCTIVISM_INDEX: "Growth goal: add one reflection/revision routine (criteria + critique + revise) and require the revision.",
  };
  return map[fieldKey] ?? `Growth goal: move toward ${spec.right}.`;
}

function buildOnePagerHtml(scores100, rankedHigh, rankedLow) {
  const growth = (rankedLow ?? []).slice(0, 2).map((x) => x.field);
  const strengths = (rankedHigh ?? []).slice(0, 2).map((x) => x.field);

  const rows = state.data.spectrums
    .map((spec) => {
      const s = Math.max(1, Math.min(100, Number(scores100?.[spec.key] ?? 50.5)));
      const isGrowth = growth.includes(spec.key);
      const isStrength = strengths.includes(spec.key);
      const pickedIdx = state.picks?.[spec.key];
      const picked = Number.isInteger(pickedIdx) ? (SUGGESTION_BANK?.[spec.key] ?? [])[pickedIdx] : null;

      return `
        <div class="row ${isGrowth ? "row-growth" : ""} ${isStrength ? "row-strength" : ""}">
          <div class="row-h">
            <div class="row-title">${spec.label}</div>
            <div class="row-score">${Math.round(s)}/100</div>
          </div>
          <div class="track">
            <div class="fill" style="width:${s}%;"></div>
            <div class="mid"></div>
            <div class="dot" style="left:${s}%;"></div>
          </div>
          <div class="poles"><div>${spec.left}</div><div style="text-align:right">${spec.right}</div></div>
          ${picked ? `<div class="pick"><b>Chosen focus:</b> ${escapeHtml(picked)}</div>` : ``}
        </div>
      `;
    })
    .join("");

  const growthLines = growth
    .map((k) => `<li><b>${escapeHtml(state.data.spectrums.find((s) => s.key === k)?.short ?? k)}:</b> ${escapeHtml(growthGoal(k))}</li>`)
    .join("");
  const strengthLines = strengths
    .map((k) => `<li><b>${escapeHtml(state.data.spectrums.find((s) => s.key === k)?.short ?? k)}:</b> ${escapeHtml(strengthSummary(k))}</li>`)
    .join("");

  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Pedagogy Profile — One-page summary</title>
    <style>
      @page { size: letter; margin: 0.5in; }
      *{ box-sizing:border-box; }
      body{ font-family: ui-sans-serif, system-ui, Segoe UI, Roboto, Arial, sans-serif; margin:0; color:#0b1220; }
      .page{ width:100%; }
      .h{ display:flex; justify-content:space-between; align-items:flex-end; gap:12px; margin-bottom:10px; }
      .title{ font-size:20px; font-weight:900; }
      .sub{ font-size:12px; color:#334155; }
      .grid{ display:grid; grid-template-columns: 1.1fr .9fr; gap:12px; }
      .card{ border:1px solid #e2e8f0; border-radius:12px; padding:10px 10px; }
      .card h3{ margin:0 0 6px 0; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#334155; }
      ul{ margin:6px 0 0 18px; padding:0; }
      li{ margin:4px 0; font-size:12px; line-height:1.25; }
      .rows{ display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
      .row{ border:1px solid #e2e8f0; border-radius:12px; padding:10px; }
      .row-growth{ border-color: rgba(245,158,11,.55); box-shadow:0 0 0 2px rgba(245,158,11,.12) inset; }
      .row-strength{ border-color: rgba(59,130,246,.35); }
      .row-h{ display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin-bottom:6px; }
      .row-title{ font-size:12px; font-weight:900; }
      .row-score{ font-size:12px; color:#334155; font-weight:800; }
      .track{ position:relative; height:10px; border-radius:999px; background:#f1f5f9; overflow:hidden; border:1px solid #e2e8f0; }
      .fill{ position:absolute; top:0; bottom:0; left:0; background: linear-gradient(90deg, rgba(59,130,246,.55), rgba(37,99,235,.85)); }
      .row-growth .fill{ background: linear-gradient(90deg, rgba(251,191,36,.75), rgba(245,158,11,.95)); }
      .mid{ position:absolute; left:50%; top:-3px; bottom:-3px; width:2px; background:#cbd5e1; }
      .dot{ position:absolute; top:50%; transform:translate(-50%,-50%); width:8px; height:8px; border-radius:999px; background:#0b1220; }
      .row-growth .dot{ background:#b45309; }
      .poles{ display:flex; justify-content:space-between; gap:8px; margin-top:6px; font-size:11px; color:#475569; }
      .pick{ margin-top:6px; font-size:11.5px; color:#0b1220; }
      .footer{ margin-top:10px; font-size:10.5px; color:#475569; }
      .badge{ display:inline-block; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; background:#fde68a; color:#78350f; margin-left:8px; }
      .printHint{ margin-top:6px; font-size:11px; color:#475569; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="h">
        <div>
          <div class="title">Pedagogy Profile — One‑page summary</div>
          <div class="sub">Growth edges are highlighted; strengths are summarized for quick reflection.</div>
        </div>
        <div class="sub">Scale: 1–100 (higher = more right‑pole alignment)</div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Growth goals <span class="badge">focus</span></h3>
          <ul>${growthLines}</ul>
          <div class="printHint">Tip: Pick one routine per goal for two weeks, then re‑take.</div>
        </div>
        <div class="card">
          <h3>Strengths</h3>
          <ul>${strengthLines}</ul>
        </div>
      </div>

      <div class="rows">
        ${rows}
      </div>

      <div class="footer">This report is a reflection tool, not an evaluation. Context matters (content, time, class culture).</div>
    </div>
    <script>window.onload = () => { setTimeout(() => window.print(), 50); };</script>
  </body>
  </html>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
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

  if (selectedPicksComplete()) {
    lines.push(buildFinalFocusSection());
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
  const growthKeys = ranked.ranked_low.slice(0, 2).map((x) => x.field);

  updateRadar(scores100, growthKeys);
  renderSpectrumBars(scores100, growthKeys);
  renderPickStrategies(scores100, ranked.ranked_low);
  el("pdfBtn").onclick = () => {
    if (!selectedPicksComplete()) {
      el("finalizeHint").textContent = "Pick 1 strategy from each list before exporting the one-page PDF.";
      return;
    }
    const html = buildOnePagerHtml(scores100, ranked.ranked_high, ranked.ranked_low);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };
  el("finalizeBtn").onclick = () => {
    if (!selectedPicksComplete()) {
      el("finalizeHint").textContent = "Please pick 1 strategy from each list.";
      return;
    }
    el("finalizeHint").textContent = "Saved. Scroll down for your compiled report.";
    el("reportText").textContent = buildReportText(scores100, means);
  };
  // Show report skeleton immediately (without picks).
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


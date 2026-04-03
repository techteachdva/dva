/* global Chart */

const state = {
  data: null,
  idx: 0,
  responses: {}, // qid -> 1..5
  chart: null,
  lastScores: null,
};

const el = (id) => document.getElementById(id);

function show(viewId) {
  for (const id of ["welcome", "question", "results"]) el(id).classList.add("hidden");
  el(viewId).classList.remove("hidden");
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

  for (const item of state.data.likert) {
    const wrap = document.createElement("label");
    wrap.className = "choice";

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
    top.className = "lbl";
    top.textContent = `${item.value} — ${item.label}`;
    const sub = document.createElement("div");
    sub.className = "sub";
    sub.textContent = "";
    text.appendChild(top);
    text.appendChild(sub);

    wrap.appendChild(input);
    wrap.appendChild(text);
    container.appendChild(wrap);
  }
}

function updateRadar(scores100) {
  const order = [
    "TEACHER_TO_STUDENT",
    "TRADITIONAL_TO_PROCESS",
    "BEHAVIORISM_TO_CONSTRUCTIVISM",
    "COGNITIVISM_TO_SOCIAL_CONSTRUCTIVISM",
    "DIRECT_TO_EXPERIENTIAL",
    "CONSTRUCTIVISM_INDEX",
  ];

  const labels = order.map((k) => state.data.short_field_labels[k] ?? k);
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
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx2) => ` ${ctx2.parsed.r.toFixed(1)}/100`,
            },
          },
        },
      },
    });
    // Make canvas container tall enough
    el("radarCanvas").parentElement.style.height = "520px";
  } else {
    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = values;
    state.chart.update();
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`HTTP ${res.status}: ${t}`);
  }
  return await res.json();
}

function renderWelcome() {
  setHeader("Welcome", "Ready");
  el("frameworkText").textContent = "Rate each statement from 1 (Strongly Disagree) to 5 (Strongly Agree). Results are shown on a 1–100 scale.";
  show("welcome");
  updateRadar(null);
}

function renderQuestion() {
  const q = currentQuestion();
  setHeader("Question", `Q ${state.idx + 1} / ${questionCount()}`);
  el("spectrumLabel").textContent = q.spectrum_label;
  el("qStem").textContent = q.stem;
  buildChoices(q);
  show("question");
}

function formatTop(fields) {
  const names = fields.slice(0, 2).map((x) => state.data.short_field_labels[x.field] ?? x.field);
  return names.join(", ");
}

async function renderResults() {
  setHeader("Results", "Scoring…");
  show("results");

  const out = await fetchJson("/api/score", {
    method: "POST",
    body: JSON.stringify({ responses: state.responses }),
  });
  state.lastScores = out;

  updateRadar(out.scores_100);
  el("reportText").textContent = out.report ?? "";
  el("strengthsText").textContent = formatTop(out.ranked_high ?? []);
  el("growthText").textContent = formatTop(out.ranked_low ?? []);
  setHeader("Results", "Done");
}

function selectedForCurrent() {
  const q = currentQuestion();
  return Number(state.responses[q.id] ?? 0);
}

function wireKeys() {
  window.addEventListener("keydown", (e) => {
    const viewWelcome = !el("welcome").classList.contains("hidden");
    const viewQuestion = !el("question").classList.contains("hidden");
    const viewResults = !el("results").classList.contains("hidden");

    if (viewWelcome && (e.key === "Enter")) {
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
    if (e.key === "Backspace" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // prevent accidental navigation
      e.preventDefault();
    }
    if (e.key === "ArrowLeft") el("backBtn").click();
    if (e.key === "ArrowRight") el("nextBtn").click();
    if (viewResults && e.key === "Escape") el("restartBtn").click();
  });
}

function reset() {
  state.idx = 0;
  state.responses = {};
  state.lastScores = null;
  renderWelcome();
}

async function init() {
  setHeader("Loading…", "Please wait");
  state.data = await fetchJson("/api/questions");
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
  el("welcome").classList.remove("hidden");
  el("frameworkText").textContent = String(err?.message ?? err);
});


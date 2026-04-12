/* global loadPyodide, vis */

let pyodide = null;
let network = null;

const $ = (id) => document.getElementById(id);

function setTab(name) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  document.querySelectorAll(".out").forEach((s) => {
    s.classList.toggle("active", s.id === `out-${name}`);
  });
}

document.querySelectorAll(".tab").forEach((b) => {
  b.addEventListener("click", () => setTab(b.dataset.tab));
});

async function fetchBytes(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function initPyodide() {
  const status = $("status");
  status.textContent = "Loading Pyodide (~10–20 MB first visit)…";
  pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
  });

  const root = "/pkg";
  pyodide.FS.mkdir(root);
  pyodide.FS.mkdir(`${root}/uriel`);

  const man = await (await fetch("./pkg/manifest.json")).json();
  for (const f of man.root || []) {
    const data = await fetchBytes(`./pkg/${f}`);
    pyodide.FS.writeFile(`${root}/${f}`, data);
  }
  for (const f of man.uriel || []) {
    const data = await fetchBytes(`./pkg/uriel/${f}`);
    pyodide.FS.writeFile(`${root}/uriel/${f}`, data);
  }

  await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, "${root}")
`);

  $("btn-run").disabled = false;
  $("btn-copy").disabled = false;
  status.textContent = "Ready — paste text and click Analyze.";
}

function renderGraph(payload) {
  const el = $("graph");
  el.innerHTML = "";
  const nodes = (payload.nodes || []).map((n) => ({
    id: n.id,
    label: n.kind === "sentence" ? n.label : (n.label || n.surface || n.id),
    x: n.x,
    y: n.y,
    group: n.kind === "sentence" ? "S" : `T${n.topic ?? ""}`,
    title: n.kind === "token" ? `${n.surface} · ${n.topic_name}` : `${n.n_tokens} tokens`,
  }));
  const edges = (payload.edges || []).map((e) => ({
    from: e.source,
    to: e.target,
    title: e.kind,
  }));

  const data = { nodes, edges };
  const options = {
    physics: false,
    edges: { color: { color: "#565f89" }, smooth: { type: "continuous" } },
    nodes: {
      font: { color: "#c0caf5", size: 13 },
      borderWidth: 1,
      shape: "box",
      margin: 8,
    },
    groups: {
      S: { color: { background: "#414868", border: "#7aa2f7" } },
    },
    layout: { improvedLayout: false },
  };
  network = new vis.Network(el, data, options);
  network.once("afterDrawing", () => network.fit({ animation: false }));
}

async function runAnalyze() {
  const text = $("src").value;
  if (!text.trim()) {
    $("status").textContent = "Paste some text first.";
    return;
  }
  $("status").textContent = "Analyzing…";
  $("btn-run").disabled = true;

  pyodide.globals.set("input_text", text);
  await pyodide.runPythonAsync(`
from uriel.bundle import analyze_to_web_bundle
import json
_bundle = analyze_to_web_bundle(
    input_text,
    "/pkg/English_Morphemes.csv",
    "/pkg/kinds_chart.csv",
)
_out_json = __import__("json").dumps(_bundle)
`);
  const jsonStr = pyodide.globals.get("_out_json");
  const bundle = JSON.parse(jsonStr);

  $("out-dm").querySelector("pre").textContent = bundle.dm || "";
  $("out-player").querySelector("pre").textContent = bundle.player || "";
  $("out-technical").querySelector("pre").textContent = bundle.technical || "";

  renderGraph(bundle.graph || { nodes: [], edges: [] });

  const st = bundle.stats || {};
  $("status").textContent = `${st.sentences ?? "?"} sentence(s), ${st.tokens ?? "?"} holon token(s).`;
  $("btn-run").disabled = false;
}

$("btn-run").addEventListener("click", runAnalyze);

function copyVisibleOutput() {
  const active = document.querySelector(".out.active");
  if (!active) return;
  const pre = active.querySelector("pre");
  const text = pre ? pre.textContent || "" : "";
  if (!text.trim()) {
    $("status").textContent = "Nothing to copy yet — run Analyze first.";
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => {
      $("status").textContent = "Copied visible tab to clipboard.";
    },
    () => {
      $("status").textContent = "Copy failed — select text manually.";
    },
  );
}

$("btn-copy").addEventListener("click", copyVisibleOutput);

initPyodide().catch((e) => {
  $("status").textContent = `Load error: ${e.message || e}`;
  console.error(e);
});

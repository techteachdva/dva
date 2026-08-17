const API = "/api/about-mr-phil-vote";
const STORAGE_KEY = "about-mr-phil-vote-choice";

const LABELS = {
  short: "Short (one-pager)",
  mid: "Mid (in-between)",
  full: "Full (the long one)",
};

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

async function fetchTally() {
  const res = await fetch(API);
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

function renderBars(tally, highlight) {
  const wrap = document.getElementById("vote-results");
  if (!wrap) return;
  const total = tally.total || 0;
  wrap.innerHTML = "";

  for (const key of ["short", "mid", "full"]) {
    const count = tally[key] || 0;
    const row = document.createElement("div");
    row.className = "amp-vote-row";
    if (key === highlight) row.classList.add("amp-vote-row--yours");

    const head = document.createElement("div");
    head.className = "amp-vote-row-h";
    head.innerHTML = `<span>${LABELS[key]}</span><span>${count} vote${count === 1 ? "" : "s"} · ${pct(count, total)}%</span>`;

    const track = document.createElement("div");
    track.className = "amp-vote-track";
    const fill = document.createElement("div");
    fill.className = "amp-vote-fill";
    fill.style.width = `${pct(count, total)}%`;
    track.appendChild(fill);

    row.appendChild(head);
    row.appendChild(track);
    wrap.appendChild(row);
  }

  const totalEl = document.getElementById("vote-total");
  if (totalEl) totalEl.textContent = `${total} total vote${total === 1 ? "" : "s"}`;
}

function setVotedUI(choice) {
  document.querySelectorAll("[data-vote]").forEach((btn) => {
    const isPick = btn.dataset.vote === choice;
    btn.disabled = true;
    btn.classList.toggle("is-picked", isPick);
  });
  const note = document.getElementById("vote-note");
  if (note) {
    note.textContent = `You voted for ${LABELS[choice]}. Thanks!`;
  }
}

async function castVote(choice) {
  const prior = localStorage.getItem(STORAGE_KEY);
  if (prior) {
    setVotedUI(prior);
    return;
  }

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ choice }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = document.getElementById("vote-note");
    if (err) err.textContent = data.error || "Could not save vote. Try again.";
    return;
  }
  localStorage.setItem(STORAGE_KEY, choice);
  setVotedUI(choice);
  renderBars(data, choice);
}

async function init() {
  let tally = { short: 0, mid: 0, full: 0, total: 0 };
  try {
    tally = await fetchTally();
  } catch {
    const note = document.getElementById("vote-note");
    if (note) note.textContent = "Live results unavailable — you can still vote.";
  }

  const prior = localStorage.getItem(STORAGE_KEY);
  renderBars(tally, prior || null);
  if (prior) setVotedUI(prior);

  document.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.addEventListener("click", () => castVote(btn.dataset.vote));
  });

  window.setInterval(async () => {
    try {
      const fresh = await fetchTally();
      renderBars(fresh, localStorage.getItem(STORAGE_KEY));
    } catch {
      /* ignore poll errors */
    }
  }, 15000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

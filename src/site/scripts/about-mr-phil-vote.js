const API = "/api/about-mr-phil-vote";
const STORAGE_KEY = "about-mr-phil-vote-record";
let voteInFlight = false;

const LABELS = {
  short: "Short (one-pager)",
  mid: "Mid (in-between)",
  full: "Full (the long one)",
};

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function readStoredVote() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.choice) return null;
    return data;
  } catch {
    return null;
  }
}

function storeVote(record) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

function getFormValues() {
  const nameEl = document.getElementById("vote-name");
  const classEl = document.getElementById("vote-class");
  return {
    name: nameEl ? nameEl.value.trim() : "",
    class: classEl ? classEl.value.trim() : "",
  };
}

function setFormValues(record) {
  const nameEl = document.getElementById("vote-name");
  const classEl = document.getElementById("vote-class");
  if (nameEl && record?.name) nameEl.value = record.name;
  if (classEl && record?.class) classEl.value = record.class;
}

function lockIdentityFields(locked) {
  const nameEl = document.getElementById("vote-name");
  const classEl = document.getElementById("vote-class");
  if (nameEl) nameEl.disabled = locked;
  if (classEl) classEl.disabled = locked;
}

function formIsReady() {
  const { name, class: classroom } = getFormValues();
  return Boolean(name && classroom);
}

function updateVoteButtons() {
  const prior = readStoredVote();
  const ready = formIsReady();
  document.querySelectorAll("[data-vote]").forEach((btn) => {
    if (prior) {
      btn.disabled = true;
      return;
    }
    btn.disabled = !ready || voteInFlight;
  });
}

async function fetchTally() {
  const res = await fetch(API);
  const data = await res.json().catch(() => ({}));
  if (data.setupRequired) {
    const err = new Error("setup required");
    err.setupRequired = true;
    err.message = data.error || "Vote storage is not configured yet.";
    throw err;
  }
  if (!res.ok) throw new Error(data.error || "fetch failed");
  return data;
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

function setVotedUI(record) {
  const choice = record?.choice;
  if (!choice) return;

  document.querySelectorAll("[data-vote]").forEach((btn) => {
    const isPick = btn.dataset.vote === choice;
    btn.disabled = true;
    btn.classList.toggle("is-picked", isPick);
  });
  lockIdentityFields(true);

  const note = document.getElementById("vote-note");
  if (note) {
    const who = record.name ? `${record.name}` : "You";
    const classLabel = record.class ? ` (${record.class})` : "";
    note.textContent = `${who}${classLabel} voted for ${LABELS[choice]}. Thanks!`;
  }
}

async function castVote(choice) {
  const prior = readStoredVote();
  if (prior) {
    setVotedUI(prior);
    return;
  }
  if (voteInFlight) return;

  const { name, class: classroom } = getFormValues();
  if (!name || !classroom) {
    const note = document.getElementById("vote-note");
    if (note) note.textContent = "Enter your name and class before voting.";
    return;
  }

  voteInFlight = true;
  updateVoteButtons();

  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, class: classroom, choice }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    voteInFlight = false;
    updateVoteButtons();
    const err = document.getElementById("vote-note");
    if (err) {
      err.textContent =
        data.error ||
        (data.setupRequired
          ? "Votes are not set up on the server yet. Ask Mr. Phil to connect Google Sheets."
          : "Could not save vote. Try again.");
    }
    return;
  }

  const record = { name, class: classroom, choice };
  storeVote(record);
  voteInFlight = false;
  setVotedUI(record);
  renderBars(data, choice);
}

async function init() {
  let tally = { short: 0, mid: 0, full: 0, total: 0 };
  try {
    tally = await fetchTally();
  } catch (err) {
    const note = document.getElementById("vote-note");
    if (note) {
      note.textContent = err.setupRequired
        ? err.message
        : "Live results unavailable — you can still vote.";
    }
  }

  const prior = readStoredVote();
  if (prior) {
    setFormValues(prior);
    setVotedUI(prior);
  }
  renderBars(tally, prior?.choice || null);

  const nameEl = document.getElementById("vote-name");
  const classEl = document.getElementById("vote-class");
  if (nameEl) nameEl.addEventListener("input", updateVoteButtons);
  if (classEl) classEl.addEventListener("change", updateVoteButtons);

  document.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.addEventListener("click", () => castVote(btn.dataset.vote));
  });

  updateVoteButtons();

  window.setInterval(async () => {
    try {
      const fresh = await fetchTally();
      renderBars(fresh, readStoredVote()?.choice || null);
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

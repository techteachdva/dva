const API = "/api/about-mr-phil-vote";
const STORAGE_KEY = "about-mr-phil-vote-record";
const DEFAULT_NOTE =
  "One vote per student (name + class). Pick the version you'd want on the class site.";
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

function clearStoredVote() {
  localStorage.removeItem(STORAGE_KEY);
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

function resetVotableUI() {
  lockIdentityFields(false);
  document.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.classList.remove("is-picked");
  });
  const note = document.getElementById("vote-note");
  if (note) note.textContent = DEFAULT_NOTE;
  updateVoteButtons();
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

async function fetchVoteStatus(name, classroom) {
  const url = new URL(API, window.location.origin);
  url.searchParams.set("name", name);
  url.searchParams.set("class", classroom);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "status failed");
  return data;
}

async function syncVoteState() {
  const stored = readStoredVote();
  const form = getFormValues();
  const name = form.name || stored?.name || "";
  const classroom = form.class || stored?.class || "";

  if (!name || !classroom) {
    if (stored) clearStoredVote();
    resetVotableUI();
    return null;
  }

  try {
    const status = await fetchVoteStatus(name, classroom);
    if (status.voted && status.choice) {
      const record = { name, class: classroom, choice: status.choice };
      storeVote(record);
      setFormValues(record);
      setVotedUI(record);
      return record;
    }

    clearStoredVote();
    setFormValues({ name, class: classroom });
    resetVotableUI();
    return null;
  } catch {
    // Status endpoint missing or failed — keep form open; POST enforces duplicates.
    clearStoredVote();
    setFormValues({ name, class: classroom });
    resetVotableUI();
    return null;
  }
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

async function onIdentityReady() {
  updateVoteButtons();
  if (!formIsReady()) return;
  const active = await syncVoteState();
  try {
    const tally = await fetchTally();
    renderBars(tally, active?.choice || null);
  } catch {
    /* ignore */
  }
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

  const stored = readStoredVote();
  if (stored) setFormValues(stored);

  if (stored && tally.total === 0) {
    clearStoredVote();
    resetVotableUI();
  }

  let active = null;
  if (formIsReady()) {
    active = await syncVoteState();
  } else if (stored) {
    clearStoredVote();
    resetVotableUI();
  }
  renderBars(tally, active?.choice || null);

  const nameEl = document.getElementById("vote-name");
  const classEl = document.getElementById("vote-class");
  if (nameEl) {
    nameEl.addEventListener("input", updateVoteButtons);
    nameEl.addEventListener("blur", onIdentityReady);
  }
  if (classEl) classEl.addEventListener("change", onIdentityReady);

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

/**
 * Local high scores for standalone / itch.io builds (localStorage, this device only).
 */

const STORAGE_KEY = "somnia.localHighscores";
const MAX_SCORES = 100;

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, scores: [] };
    const data = JSON.parse(raw);
    if (!Array.isArray(data.scores)) return { version: 1, scores: [] };
    return { version: 1, scores: data.scores };
  } catch {
    return { version: 1, scores: [] };
  }
}

function saveStore(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeEntry(entry) {
  const score = Number(entry.score);
  if (!Number.isFinite(score)) return null;
  return {
    id: String(entry.id || ""),
    submittedAt: Number(entry.submittedAt) || 0,
    name: String(entry.name || "").slice(0, 24),
    score: Math.round(score),
    won: Boolean(entry.won),
    seconds: Number(entry.seconds) || 0,
    difficulty: String(entry.difficulty || "").slice(0, 24),
    breakdown: entry.breakdown && typeof entry.breakdown === "object" ? entry.breakdown : {},
    rank: Number(entry.rank) || 0,
  };
}

function sortScores(scores) {
  return [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.seconds !== b.seconds) return a.seconds - b.seconds;
    return b.submittedAt - a.submittedAt;
  });
}

function rankScores(scores) {
  return sortScores(scores)
    .slice(0, MAX_SCORES)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function fetchHighScores() {
  const data = loadStore();
  const scores = rankScores(data.scores.map(normalizeEntry).filter(Boolean));
  return {
    scores,
    setupRequired: false,
    local: true,
    error: null,
  };
}

export async function submitHighScore(entry) {
  const name = String(entry?.name || "").trim().slice(0, 24);
  const score = Number(entry?.score);
  const won = Boolean(entry?.won);
  const seconds = Number(entry?.seconds);
  const difficulty = String(entry?.difficulty || "").trim().slice(0, 24);
  const breakdown = entry?.breakdown && typeof entry.breakdown === "object" ? entry.breakdown : {};

  if (!name) {
    throw new Error("Enter your first name and last initial.");
  }
  if (!Number.isFinite(score) || score < 0) {
    throw new Error("Invalid score.");
  }
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error("Invalid run time.");
  }

  const data = loadStore();
  const id = globalThis.crypto?.randomUUID?.() || `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const newEntry = {
    id,
    submittedAt: Date.now(),
    name,
    score: Math.round(score),
    won,
    seconds: Math.round(seconds),
    difficulty,
    breakdown,
  };

  data.scores.push(newEntry);
  data.scores = rankScores(data.scores.map(normalizeEntry).filter(Boolean));
  saveStore(data);

  const rank = data.scores.findIndex((s) => s.id === id) + 1;

  return {
    ok: true,
    id,
    rank: rank > 0 ? rank : 0,
    inTop: rank > 0 && rank <= MAX_SCORES,
    scores: data.scores,
  };
}

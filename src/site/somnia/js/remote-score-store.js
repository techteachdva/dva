/**
 * Global high scores — Google Sheets via Vercel API proxy (web / dva site builds).
 */

const API_URL = "/api/somnia-highscores";

export async function fetchHighScores() {
  const res = await fetch(API_URL, { method: "GET", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.scores) {
    throw new Error(data.error || `Could not load scores (${res.status}).`);
  }
  return {
    scores: Array.isArray(data.scores) ? data.scores : [],
    setupRequired: Boolean(data.setupRequired),
    local: false,
    error: data.error || null,
  };
}

export async function submitHighScore(entry) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Could not save score (${res.status}).`);
  }
  return data;
}

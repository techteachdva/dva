/**
 * Tech Escape global leaderboard — Google Sheets via Vercel API proxy.
 */

const API_URL = '/api/tech-escape-highscores';

const FIRST_RE = /^[\p{L}][\p{L}'-]{0,15}$/u;
const LAST_RE = /^[\p{L}]$/u;

/**
 * Validate first name (≤16 letters) + single-letter last initial.
 * @returns {{ ok: true, name: string } | { ok: false, message: string }}
 */
export function validateScoreName(firstRaw, lastRaw) {
  const first = String(firstRaw ?? '').trim();
  const last = String(lastRaw ?? '').trim();
  if (!first) return { ok: false, message: 'Type your first name.' };
  if (!FIRST_RE.test(first)) {
    return { ok: false, message: 'First name: letters only, up to 16 characters.' };
  }
  if (!last || !LAST_RE.test(last)) {
    return { ok: false, message: 'Last initial must be one letter.' };
  }
  if (first.includes('@') || /\d{4,}/.test(first)) {
    return { ok: false, message: 'Use a nickname — no emails or long numbers.' };
  }
  return { ok: true, name: `${first} ${last.toUpperCase()}` };
}

/** Split a stored leaderboard name or profile name into form fields. */
export function splitNameHint(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { first: '', last: '' };
  const parts = s.split(/\s+/);
  if (parts.length < 2) return { first: s.slice(0, 16), last: '' };
  return {
    first: parts.slice(0, -1).join(' ').slice(0, 16),
    last: parts[parts.length - 1].slice(0, 1),
  };
}

export async function fetchHighScores() {
  const res = await fetch(API_URL, { method: 'GET', cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data.scores) {
    throw new Error(data.error || `Could not load scores (${res.status}).`);
  }
  return {
    scores: Array.isArray(data.scores) ? data.scores : [],
    setupRequired: Boolean(data.setupRequired),
    error: data.error || null,
  };
}

export async function submitHighScore(entry) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || `Could not save score (${res.status}).`);
  }
  return data;
}

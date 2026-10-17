/**
 * High score facade — local storage in standalone builds, remote API on the web site.
 */

import * as localStore from "./local-score-store.js";
import * as remoteStore from "./remote-score-store.js";
import { isStandaloneMode } from "../app/standalone.js";

const FIRST_RE = /^[\p{L}][\p{L}'-]{0,15}$/u;
const LAST_RE = /^[\p{L}]$/u;

/** The itch build keeps scores on this device; the website uses the Ainmos tab of the Google Sheet. */
function useCloud() {
  return !isStandaloneMode();
}

export { isStandaloneMode } from "../app/standalone.js";

/**
 * Ainmos 0.27.1: beating L3V1@+H@N D3$TR0Y3R 0F DR3@M$ scores "NaN". The boards
 * only take numbers, so it is saved as NAN_SCORE (ranks above everything) with
 * breakdown.nan, and every list shows it as NaN.
 */
export const NAN_SCORE = 999999999;

export function isNanScore(entry) {
  return !!entry && (Number(entry.score) >= NAN_SCORE || !!entry.breakdown?.nan);
}

/** "123 pts", or "NaN" for a run that beat Endless Mode. */
export function scoreLabel(entry) {
  return isNanScore(entry) ? "NaN" : `${entry?.score ?? 0} pts`;
}

export function validateScoreName(firstRaw, lastRaw) {
  const first = String(firstRaw ?? "").trim();
  const last = String(lastRaw ?? "").trim();
  if (!first) return { ok: false, message: "Type your first name." };
  if (!FIRST_RE.test(first)) {
    return { ok: false, message: "First name: letters only, up to 16 characters." };
  }
  if (!last || !LAST_RE.test(last)) {
    return { ok: false, message: "Last initial must be one letter." };
  }
  if (first.includes("@") || /\d{4,}/.test(first)) {
    return { ok: false, message: "Use a nickname — no emails or long numbers." };
  }
  return { ok: true, name: `${first} ${last.toUpperCase()}` };
}

export function splitNameHint(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/);
  if (parts.length < 2) return { first: s.slice(0, 16), last: "" };
  return {
    first: parts.slice(0, -1).join(" ").slice(0, 16),
    last: parts[parts.length - 1].slice(0, 1),
  };
}

export async function fetchHighScores() {
  if (!useCloud()) return localStore.fetchHighScores();
  try {
    const remote = await remoteStore.fetchHighScores();
    if (!remote.setupRequired) return remote;
    const local = await localStore.fetchHighScores();
    return { ...local, error: "The global board is offline, so these are this device's scores." };
  } catch {
    const local = await localStore.fetchHighScores();
    return { ...local, error: "The global board could not be reached, so these are this device's scores." };
  }
}

/** Cloud first; if the cloud cannot take it, the score is kept on this device and the result says so. */
export async function submitHighScore(entry) {
  if (!useCloud()) return localStore.submitHighScore(entry);
  try {
    return await remoteStore.submitHighScore(entry);
  } catch (err) {
    const saved = await localStore.submitHighScore(entry);
    return { ...saved, local: true, cloudError: err?.message || "The global board could not be reached." };
  }
}

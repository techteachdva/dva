/**
 * High score facade — local storage in standalone builds, remote API on the web site.
 */

import * as localStore from "./local-score-store.js";
import * as remoteStore from "./remote-score-store.js";
import { isStandaloneMode } from "./standalone.js";

const FIRST_RE = /^[\p{L}][\p{L}'-]{0,15}$/u;
const LAST_RE = /^[\p{L}]$/u;

function activeStore() {
  return isStandaloneMode() ? localStore : remoteStore;
}

export { isStandaloneMode } from "./standalone.js";

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
  return activeStore().fetchHighScores();
}

export async function submitHighScore(entry) {
  return activeStore().submitHighScore(entry);
}

/**
 * Saves live entirely in this browser (localStorage). No server, no save codes.
 * Every change is written within half a second, and again when the tab hides or closes.
 */

import { uid } from './util.js';
import { KEY_POOL } from '../data/world.js';

const KEY = 'cybermorph.save.v1';
const SCORES = 'cybermorph.scores.v1';
const MAX_PROFILES = 6;

let data = { version: 1, profiles: [], activeId: null };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) data = { ...data, ...JSON.parse(raw) };
} catch { /* storage blocked: the game still runs, it just won't remember */ }

let timer = 0;
function writeNow() {
  clearTimeout(timer);
  timer = 0;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
export function save() {
  if (!timer) timer = setTimeout(writeNow, 500);
}
window.addEventListener('pagehide', writeNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeNow(); });

export const profiles = () => data.profiles;
export const canAddProfile = () => data.profiles.length < MAX_PROFILES;

export function newProfile(name, avatar) {
  const p = {
    id: uid(),
    name: name || 'Morpher',
    created: Date.now(),
    avatar,
    learned: [],
    mastery: {},
    districts: {},
    keyIndex: Math.floor(Math.random() * KEY_POOL.length),
    clues: [false, false, false],
    deskOpen: false,
    finale: { beaten: false },
    lexicon: [],
    madeUp: [],
    log: [],
    milestones: [],
    stats: { compiled: 0, firstTry: 0, tasks: 0, splits: 0, bits: 0, crashes: 0, playMs: 0 },
    place: { id: 'hub', room: 0 },
  };
  data.profiles.push(p);
  data.activeId = p.id;
  writeNow();
  return p;
}

export function deleteProfile(id) {
  data.profiles = data.profiles.filter((p) => p.id !== id);
  if (data.activeId === id) data.activeId = null;
  writeNow();
}

export function setActive(id) { data.activeId = id; save(); }
export const active = () => data.profiles.find((p) => p.id === data.activeId) || null;

/** Per-room progress record, created on first visit. */
export function dprog(profile, id) {
  if (!profile.districts[id]) profile.districts[id] = { done: {}, cleared: false, room: 0, rotlings: {}, bridges: {}, gates: {}, batch: 0 };
  return profile.districts[id];
}

export function addMilestone(profile, key) {
  if (profile.milestones.includes(key)) return false;
  profile.milestones.push(key);
  save();
  return true;
}

export function learn(profile, ids) {
  let added = false;
  for (const id of ids) if (!profile.learned.includes(id)) { profile.learned.push(id); added = true; }
  if (added) save();
}

export function addLexicon(profile, word, ids) {
  if (!profile.lexicon.some((w) => w.w === word)) profile.lexicon.push({ w: word, p: ids });
  profile.log.unshift({ w: word, p: ids, t: Date.now() });
  profile.log.length = Math.min(profile.log.length, 40);
  save();
}

export function addMadeUp(profile, word, ids) {
  if (!profile.madeUp.some((w) => w.w === word)) profile.madeUp.push({ w: word, p: ids });
  save();
}

// ── Overclock Mode high scores (browser only) ─────────────────────────
export function loadScores() {
  try { return JSON.parse(localStorage.getItem(SCORES) || '[]'); } catch { return []; }
}
export function addScore(entry) {
  const list = loadScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 10);
  try { localStorage.setItem(SCORES, JSON.stringify(list)); } catch { /* ignore */ }
  return list.findIndex((e) => e === entry || (e.t === entry.t && e.name === entry.name));
}

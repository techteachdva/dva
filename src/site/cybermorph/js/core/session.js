/**
 * A class session: what this student practised since they sat down, for the exit ticket
 * and the class report code.
 *
 * The session lives on the profile (profile.session) so a page reload doesn't lose it.
 * A teacher's link can set a time limit with ?mins=12; the game then ends the session
 * itself and shows the exit ticket.
 *
 * Every task logs an attempt for each morpheme it used (first try or not), and every
 * mistake logs an error kind against the morphemes it is about (see ERROR_KINDS):
 * a skipped drop-e counts against the suffix that caused it, a swapped prefix against
 * the prefix, a wrong ring against the morpheme that ring needed.
 */

import { save } from './save.js';
import { SKILLS } from '../data/finale.js';
import { glow } from './mastery.js';
import { encodeReport, ERROR_KINDS } from './report.js';
import { morph, MORPHEMES } from '../data/morphemes.js';
import { mmKey, mmName, mmOrder } from '../data/mm.js';
import { build } from '../compiler/wordsum.js';

const MIN = 60 * 1000;
/** A session older than this is over even if nobody closed it (a new class period). */
const STALE = 3 * 60 * MIN;
/** After a timed session ends, the same browser waits this long before another one. */
export const COOLDOWN = 45 * MIN;

let profile = null;

let focusSet = null;
/** Exit Ticket practice records only the ticked morphemes, so the ticket and the class report stay on today's lesson. */
export function setFocus(ids) { focusSet = ids && ids.length ? new Set(ids) : null; }
const loggable = (id) => MORPHEMES[id] && !['link', 'word'].includes(morph(id).type) && (!focusSet || focusSet.has(id));

/** Start (or resume) this profile's session. mins = the teacher's limit, 0 for none. */
export function beginSession(p, mins = 0) {
  profile = p;
  const now = Date.now();
  const s = p.session;
  // Resume only the same kind of session (a reload mid-class). A different timer, an ended
  // session or an old one starts fresh, so yesterday's untimed play can't eat today's minutes.
  if (!s || s.ended || now - s.last > STALE || (s.mins || 0) !== mins) {
    p.session = { start: now, last: now, mins, by: {}, words: 0, rotlings: 0, ended: 0 };
  }
  save();
  return p.session;
}

export const current = () => (profile && profile.session && !profile.session.ended ? profile.session : null);

function rec(id) {
  const s = current();
  if (!s) return null;
  s.last = Date.now();
  return s.by[id] || (s.by[id] = { a: 0, ft: 0, e: {} });
}

/** One finished task: every morpheme in it gets an attempt. */
export function logAttempt(ids, firstTry, { word = false, rotling = false } = {}) {
  const s = current();
  if (!s) return;
  new Set(ids).forEach((id) => {
    if (!loggable(id)) return;
    const r = rec(id);
    r.a += 1;
    if (firstTry) r.ft += 1;
  });
  if (word) s.words += 1;
  if (rotling) s.rotlings += 1;
  save();
}

export function logError(ids, kind) {
  if (!current() || !ERROR_KINDS.includes(kind)) return;
  new Set(ids).forEach((id) => {
    if (!loggable(id)) return;
    const r = rec(id);
    r.e[kind] = (r.e[kind] || 0) + 1;
  });
  save();
}

/** The morphemes a spelling change belongs to: the suffix that triggers it, or the prefix that changes. */
export function jointIds(ids) {
  const out = [];
  build(ids).steps.forEach((st) => {
    if (st.kind === 'assim' || st.kind === 'elide') out.push(ids[st.at]);
    else if (ids[st.at + 1]) out.push(ids[st.at + 1]);
  });
  return out.length ? out : ids;
}

export function minutesPlayed(s = profile && profile.session) {
  if (!s) return 0;
  return Math.max(1, Math.round(((s.ended || Date.now()) - s.start) / MIN));
}

/** Seconds left on the teacher's timer, or null when there is no limit. */
export function secondsLeft() {
  const s = current();
  if (!s || !s.mins) return null;
  return Math.max(0, Math.round((s.start + s.mins * MIN - Date.now()) / 1000));
}

/** Close the session. Returns the exit ticket data. */
export function endSession() {
  const s = profile && profile.session;
  if (!s) return null;
  if (!s.ended) s.ended = Date.now();
  save();
  return ticket();
}

/** Still inside the cooldown after a timed session? Returns minutes to wait, or 0. */
export function cooldownLeft(p) {
  const s = p.session;
  if (!s || !s.ended || !s.mins) return 0;
  return Math.max(0, Math.ceil((s.ended + COOLDOWN - Date.now()) / MIN));
}

/** Everything the exit ticket and the report code need. */
export function ticket(p = profile) {
  const s = p.session;
  const lessons = {};
  Object.entries(s.by).forEach(([id, r]) => {
    const k = mmKey(id);
    const L = lessons[k] || (lessons[k] = [0, 0, ...ERROR_KINDS.map(() => 0)]);
    L[0] += r.a;
    L[1] += r.ft;
    ERROR_KINDS.forEach((kind, i) => { L[2 + i] += r.e[kind] || 0; });
  });
  // All-time mastery by lesson, so the class report can show what is fading.
  const mastery = {};
  p.learned.forEach((id) => {
    if (!loggable(id)) return;
    const k = mmKey(id);
    if (k === 'X') return;
    const g = glow(p, id);
    const m = mastery[k] || (mastery[k] = { sum: 0, fading: 0, n: 0 });
    m.sum += p.mastery[id] ? p.mastery[id].l : 0;
    m.fading += g.fading ? 1 : 0;
    m.n += 1;
  });
  const M = {};
  Object.entries(mastery).forEach(([k, m]) => { M[k] = [Math.round((m.sum / m.n) * 10), m.fading, m.n]; });
  const payload = { n: p.name, s: Math.round(s.start / 1000), m: minutesPlayed(s), w: s.words, r: s.rotlings, L: lessons, M };
  // The Final Test's best run: overall first-try %, then one % per skill (-1 = not measured).
  const best = p.finale && p.finale.best;
  if (best) payload.F = [best.pct, ...SKILLS.map((k) => (best.skills[k.id] ?? -1))];
  // For the student: what they practised (by morpheme) and what to look at again.
  const practised = Object.entries(s.by).filter(([, r]) => r.a > 0).sort((a, b) => b[1].a - a[1].a);
  const shaky = Object.entries(s.by).filter(([, r]) => Object.values(r.e).reduce((x, y) => x + y, 0) > 0)
    .sort((a, b) => Object.values(b[1].e).reduce((x, y) => x + y, 0) - Object.values(a[1].e).reduce((x, y) => x + y, 0));
  const focus = practised.find(([id]) => mmKey(id) !== 'X') || practised[0];
  return {
    payload,
    code: encodeReport(payload),
    minutes: payload.m,
    words: s.words,
    rotlings: s.rotlings,
    practised: practised.map(([id, r]) => ({ id, a: r.a, ft: r.ft, lesson: mmKey(id) })).sort((a, b) => mmOrder(a.lesson) - mmOrder(b.lesson)),
    shaky: shaky.slice(0, 4).map(([id]) => id),
    focus: focus ? focus[0] : null,
    lessonName: (id) => mmName(mmKey(id)),
  };
}

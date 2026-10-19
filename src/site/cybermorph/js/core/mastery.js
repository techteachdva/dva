/**
 * Leitner-style mastery per morpheme (levels 0–4), shown as glow: dim → lit → gold.
 * A morpheme that goes unused past its interval starts to fade. Fading morphemes
 * come back as review Rotlings in the hub, and using one restores it.
 */

import { save } from './save.js';

const DAY = 24 * 60 * 60 * 1000;
export const INTERVAL_DAYS = [1, 1, 3, 7, 14];

export function touch(profile, ids, ok) {
  const now = Date.now();
  for (const id of new Set(ids)) {
    const r = profile.mastery[id] || (profile.mastery[id] = { l: 0, t: now, n: 0, ok: 0 });
    r.n += 1;
    if (ok) { r.ok += 1; r.l = Math.min(4, r.l + 1); } else r.l = Math.max(0, r.l - 1);
    r.t = now;
  }
  save();
}

export function isDue(rec, now = Date.now()) {
  if (!rec) return false;
  return now - rec.t > INTERVAL_DAYS[rec.l] * DAY;
}

/** 'dim' | 'lit' | 'gold', and whether it is fading. */
export function glow(profile, id) {
  const r = profile.mastery[id];
  if (!r) return { tier: 'dim', fading: false, level: 0 };
  const fading = isDue(r);
  const lvl = fading ? Math.max(0, r.l - 1) : r.l;
  return { tier: lvl >= 4 ? 'gold' : lvl >= 2 ? 'lit' : 'dim', fading, level: r.l };
}

export function dueIds(profile) {
  const now = Date.now();
  return Object.keys(profile.mastery).filter((id) => isDue(profile.mastery[id], now) && profile.mastery[id].n > 0);
}

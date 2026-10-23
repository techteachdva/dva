/**
 * Warp codes: a code a day for every room and every level, so a student on a different
 * Chromebook can jump back to where the class is without replaying the start.
 *
 * Each code is a prefix + base + suffix built from the game's own morphemes (7 to 9 letters),
 * picked by hashing the date on this device with the section's id. Codes change at midnight.
 * Mr. Phil types TEACHER_CODE into the same box to see the whole day's list.
 */

import { MORPHEMES } from '../data/morphemes.js';
import { LEVELS } from '../data/levels.js';
import { DISTRICTS, MAIN_ORDER } from '../data/world.js';
import { hashSeed, seeded } from './rng.js';

export const TEACHER_CODE = '939393';
const SALT = 'lexinet-warp-1';
// Codes that spell something a class would giggle at are skipped.
const BLOCK = ['ass', 'sex', 'fag', 'nig', 'cum', 'tit', 'fuk', 'fuc', 'shit', 'piss', 'cock', 'porn', 'rape', 'anal', 'kkk', 'slut', 'hoe', 'kill', 'die', 'dead', 'butt', 'poo', 'pee', 'nazi'];

const pool = (type, min, max) => Object.values(MORPHEMES)
  .filter((m) => m.type === type && m.origin !== 'lingo' && /^[a-z]+$/.test(m.text) && m.text.length >= min && m.text.length <= max)
  .map((m) => m.text)
  .filter((t, i, a) => a.indexOf(t) === i)
  .sort();
const PFX = pool('pfx', 2, 4);
const BASE = pool('base', 3, 5);
const SFX = pool('sfx', 2, 3);

/** Every place a code can send a Morpher, in play order. */
export const SECTIONS = [
  ...MAIN_ORDER.flatMap((room) => [
    { id: room, room, level: null, label: `${DISTRICTS[room].name} · start` },
    ...(LEVELS[room] || []).map((L, i) => ({ id: L.id, room, level: i, label: `${DISTRICTS[room].name} · Level ${i + 1}` })),
  ]),
  { id: 'lingo', room: 'lingo', level: null, label: `${DISTRICTS.lingo.name} (the secret room)` },
  { id: 'finale', room: 'finale', level: null, label: 'The Rot · final fight' },
];


/** The local calendar day, e.g. 2026-10-23. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const cache = new Map();
/** Every section with its code for the day: { ...section, code: 'SUBVISION', parts: ['sub','vis','ion'] }. */
export function dailyCodes(date = new Date()) {
  const day = dayKey(date);
  if (cache.has(day)) return cache.get(day);
  const used = new Set();
  const list = SECTIONS.map((s) => {
    const r = seeded(hashSeed(`${SALT}|${day}|${s.id}`));
    for (;;) {
      const parts = [PFX, BASE, SFX].map((a) => a[Math.floor(r() * a.length)]);
      const code = parts.join('').toUpperCase();
      if (code.length < 7 || code.length > 9 || used.has(code) || BLOCK.some((b) => code.includes(b.toUpperCase()))) continue;
      used.add(code);
      return { ...s, code, parts };
    }
  });
  cache.clear();
  cache.set(day, list);
  return list;
}

/** What a typed code means: { teacher: true }, a section with its code, or null. */
export function readCode(typed, date = new Date()) {
  const t = String(typed || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!t) return null;
  if (t === TEACHER_CODE) return { teacher: true };
  return dailyCodes(date).find((s) => s.code === t) || null;
}

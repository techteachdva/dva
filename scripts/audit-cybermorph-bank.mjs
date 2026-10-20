#!/usr/bin/env node
/**
 * CyberMorph — content audit.
 *
 * Checks every district file against the spelling-joint engine:
 *   - every morpheme id exists
 *   - every COMPILE task builds, and every piece it needs was taught before it (district order)
 *   - every sentence lock's right answer builds a word, and no wrong ending builds the same word
 *   - every fake Rotling has one cut per seam, inside the shown word
 *   - every New Word uses only pieces taught before it
 *   - every keyword and finale word builds
 * Then prints a drift report: catalog meanings that differ between the game's fork and the Garden.
 *
 * Usage:  node scripts/audit-cybermorph-bank.mjs        (exit 1 on any error)
 *         node scripts/audit-cybermorph-bank.mjs --list (also print every built word)
 */

import { MORPHEMES } from '../src/site/cybermorph/js/data/morphemes.js';
import { build, sumText } from '../src/site/cybermorph/js/compiler/wordsum.js';
import { DISTRICTS, MAIN_ORDER, KEY_POOL, FINALE_POOLS, DICTIONARY } from '../src/site/cybermorph/js/data/world.js';
import { ROOM_W, ROOM_H, CORRIDOR } from '../src/site/cybermorph/js/data/layout.js';
import { MORPHEME_CATALOG as FORK } from '../src/site/cybermorph/js/data/catalog.js';
import { MORPHEME_CATALOG as GARDEN } from '../src/site/scripts/morphology-morpheme-catalog.js';

const list = process.argv.includes('--list');
const errors = [];
const warns = [];
const built = [];

const learned = new Set();
const need = (ids, where) => {
  for (const id of ids) {
    if (!MORPHEMES[id]) { errors.push(`${where}: unknown morpheme "${id}"`); continue; }
    if (!learned.has(id)) errors.push(`${where}: "${id}" is used before it is taught`);
  }
};
const tryBuild = (ids, where) => {
  try { return build(ids); } catch (e) { errors.push(`${where}: ${e.message}`); return null; }
};
const teach = (ids = []) => ids.forEach((id) => {
  if (!MORPHEMES[id]) errors.push(`teach: unknown morpheme "${id}"`);
  learned.add(id);
});

for (const id of [...MAIN_ORDER, 'lingo']) {
  const d = DISTRICTS[id];
  const tag = (s) => `${id} ${s}`;
  if (id === 'lingo') {
    // Lingo pieces are taught by the cards themselves.
    Object.values(MORPHEMES).filter((m) => m.origin === 'lingo').forEach((m) => learned.add(m.id));
    learned.add('friend');
  }
  // One big room per origin: every station must be reachable once firewalls open and the bridge forms.
  {
    const map = d.map;
    if (!map || map.length !== ROOM_H || map.some((r) => r.length !== ROOM_W)) errors.push(tag(`map must be ${ROOM_W}×${ROOM_H}`));
    const grid = map.map((row) => [...row]);
    const walk = (ch) => '.@&RGFH'.includes(ch);
    grid[CORRIDOR] = grid[CORRIDOR].map((ch) => (ch === '~' ? '.' : ch));
    const start = { c: 1, r: CORRIDOR };
    const seen = new Set([`${start.c},${start.r}`]);
    const q = [start];
    while (q.length) {
      const { c, r } = q.shift();
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = { c: c + dc, r: r + dr };
        if (!grid[n.r] || !grid[n.r][n.c] || seen.has(`${n.c},${n.r}`) || !walk(grid[n.r][n.c])) continue;
        seen.add(`${n.c},${n.r}`);
        q.push(n);
      }
    }
    map.forEach((row, r) => [...row].forEach((ch, c) => {
      if (!'MTNWCabcdefgh'.includes(ch)) return;
      const ok = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has(`${c + dc},${r + dr}`));
      if (!ok) errors.push(tag(`"${ch}" at ${c},${r} can't be reached`));
      if ('abcdefgh'.includes(ch) && !(d.props && d.props[ch])) errors.push(tag(`prop "${ch}" has no entry in props`));
    }));
    Object.entries(d.props || {}).forEach(([ch, p]) => { (p.ids || []).forEach((id) => { if (!MORPHEMES[id]) errors.push(tag(`prop ${ch}: unknown morpheme ${id}`)); }); });
  }
  d.mentorFlow.batches.forEach((b, bi) => {
    teach(b.teach);
    b.tasks.forEach((t, ti) => {
      const where = tag(`mentor batch ${bi + 1} task ${ti + 1}`);
      need(t.p, where);
      const r = tryBuild(t.p, where);
      if (r) built.push(`${where}: ${b.kind === 'unpack' ? `${t.w} ← ${r.word}` : sumText(t.p)}`);
    });
  });
  d.rooms.forEach((room, ri) => {
    const R = (s) => tag(`room ${ri} ${s}`);
    // Play order inside a room: Rotlings → terminal → gate → link / new word → core.
    if (room.terminal) teach(room.terminal.teach);
    if (room.gate) room.gate.tasks.forEach((t, ti) => {
      const where = R(`gate ${ti + 1}`);
      if (t.choices) { if (!(t.a >= 0 && t.a < t.choices.length)) errors.push(`${where}: answer out of range`); return; }
      need([...t.fixed, ...t.ring.flat()], where);
      const words = t.ring.map((end) => tryBuild([...t.fixed, ...end], where)?.word);
      const right = words[t.a];
      words.forEach((w, i) => { if (i !== t.a && w === right) errors.push(`${where}: option ${i} also builds "${w}"`); });
      built.push(`${where}: ${t.s.replace('___', `[${right}]`)}`);
    });
    if (room.rotlings) room.rotlings.forEach((t, ti) => {
      const where = R(`rotling ${ti + 1}`);
      if (id !== 'lingo') need(t.p, where);
      const r = tryBuild(t.p, where);
      if (!r) return;
      if (t.fake) {
        if (!t.cuts || !t.show) errors.push(`${where}: fake needs show + cuts`);
        else if (t.cuts.some((c) => c <= 0 || c >= t.show.length)) errors.push(`${where}: cut outside "${t.show}"`);
        if (!t.why) errors.push(`${where}: fake needs a reason`);
        built.push(`${where}: FAKE ${t.show} → ${r.word}`);
      } else {
        built.push(`${where}: ${r.segments.join('|')}`);
      }
    });
    if (room.terminal) {
      teach(room.terminal.teach);
      room.terminal.tasks.forEach((t, ti) => {
        const where = R(`terminal ${ti + 1}`);
        need(t.p, where);
        const r = tryBuild(t.p, where);
        if (r) built.push(`${where}: ${sumText(t.p)}`);
      });
    }
    if (room.newword) {
      const n = room.newword;
      const where = R('new word');
      teach(n.teachFirst);
      need(n.p, where);
      const r = tryBuild(n.p, where);
      if (r && id !== 'lingo' && r.word !== n.w) errors.push(`${where}: builds "${r.word}", data says "${n.w}"`);
      if (r) built.push(`${where}: ${n.w} = ${r.segments.join('|')}`);
    }
    if (room.core) {
      teach(room.core.teach);
      room.core.tasks.forEach((t, ti) => {
        const where = R(`core ${ti + 1}`);
        need(t.p, where);
        const r = tryBuild(t.p, where);
        if (r) built.push(`${where}: ${room.core.kind === 'unpack' ? `${t.w} ← ${r.word}` : sumText(t.p)}`);
      });
    }
  });
}

KEY_POOL.forEach((k, i) => {
  const r = tryBuild(k.p, `keyword ${i + 1}`);
  if (r) built.push(`keyword ${i + 1}: ${sumText(k.p)}`);
  if (k.clue.length !== 3) errors.push(`keyword ${i + 1}: needs 3 clue lists`);
});
FINALE_POOLS.forEach((pool) => pool.words.forEach((ids) => {
  const r = tryBuild(ids, `finale ${pool.label}`);
  if (r) built.push(`finale ${pool.label}: ${r.segments.join('|')} → ${r.word}`);
}));

// Drift: catalog rows the game uses whose meaning differs between the fork and the Garden.
const used = new Set(Object.values(MORPHEMES).map((m) => m.cat).filter(Boolean));
const forkBy = new Map(FORK.map((r) => [r.key, r]));
const gardenBy = new Map(GARDEN.map((r) => [r.key, r]));
const drift = [];
for (const key of used) {
  if (!forkBy.has(key)) { warns.push(`catalog key "${key}" is not in the fork`); continue; }
  const g = gardenBy.get(key);
  if (g && g.meaning !== forkBy.get(key).meaning) drift.push(`${key}: fork "${forkBy.get(key).meaning}" vs Garden "${g.meaning}"`);
}

if (list) console.log(built.join('\n'), '\n');
console.log(`Dictionary: ${DICTIONARY.size} words · Morphemes: ${Object.keys(MORPHEMES).length} · Built checks: ${built.length}`);
if (drift.length) console.log(`\nDrift from the Garden (report only):\n  ${drift.join('\n  ')}`);
if (warns.length) console.log(`\nWarnings:\n  ${warns.join('\n  ')}`);
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('\nNo errors.');

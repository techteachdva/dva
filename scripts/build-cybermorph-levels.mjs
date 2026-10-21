/**
 * Builds CyberMorph's levels (src/site/cybermorph/js/data/levels.js) from the word bank and each
 * room's teach order. A level: earn about six morphemes (one minigame each), then build words with
 * them on 2-3 dials. Each dial set is chosen so the dials make at least MIN_WORDS real words with
 * known meanings.
 *
 *   node scripts/build-cybermorph-levels.mjs           write js/data/levels.js
 *   node scripts/build-cybermorph-levels.mjs --report  print the plan only
 *
 * Deterministic: the same data always gives the same levels, so hand-written lines can key on level ids.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/site/cybermorph/js');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { MORPHEMES } = await imp('data/morphemes.js');
const { DISTRICTS, MAIN_ORDER } = await imp('data/world.js');
const { BANK } = await imp('data/bank.js');
const { build } = await imp('compiler/wordsum.js');
const { FAMILIES } = await imp('data/families.js');

const REPORT = process.argv.includes('--report');
// Pass 1 wants 5 words on two dials (4 on three); pass 2 settles for 4 (3) so no bound morpheme is stranded.
const PASSES = [[5, 4], [4, 3]];
const MAX_EARN = 8;
const type = (id) => MORPHEMES[id].type;

// ── Teach order: which district each morpheme belongs to, and its rank inside it ──
const home = new Map();
const rank = new Map();
let counter = 0;
for (const d of MAIN_ORDER) {
  const D = DISTRICTS[d];
  const add = (ids) => (ids || []).forEach((id) => { if (MORPHEMES[id] && !home.has(id)) { home.set(id, d); rank.set(id, counter++); } });
  D.mentorFlow.batches.forEach((b) => add(b.teach));
  D.rooms.forEach((rm) => { if (rm.terminal) add(rm.terminal.teach); if (rm.newword) add(rm.newword.teachFirst); if (rm.core) add(rm.core.teach); });
}

// ── Words with meanings ──
const words = new Map();
const addWord = (ids, meaning) => {
  if (!meaning || ids.length < 2 || !ids.every((id) => MORPHEMES[id])) return;
  let w;
  try { w = build(ids).word; } catch { return; }
  if (!words.has(w)) words.set(w, { w, p: ids, m: meaning });
};
for (const d of MAIN_ORDER) {
  const D = DISTRICTS[d];
  D.mentorFlow.batches.forEach((b) => b.tasks.forEach((t) => addWord(t.p, t.m)));
  D.rooms.forEach((rm) => { if (rm.terminal) rm.terminal.tasks.forEach((t) => addWord(t.p, t.m)); if (rm.core) (rm.core.tasks || []).forEach((t) => addWord(t.p, t.m)); });
}
BANK.forEach((b) => addWord(b.ids, b.meaning));

// Morphemes never taught by a room but used in a word belong to their origin's district, after the taught ones.
[...words.values()].forEach((x) => x.p.forEach((id) => {
  const m = MORPHEMES[id];
  if (!home.has(id) && MAIN_ORDER.includes(m.origin)) { home.set(id, m.origin); rank.set(id, counter++); }
}));
const districtOf = (ids) => ids.map((id) => home.get(id)).filter(Boolean).reduce((a, b) => (MAIN_ORDER.indexOf(b) > MAIN_ORDER.indexOf(a) ? b : a), MAIN_ORDER[0]);

// A word's shape: the dial pieces (linking vowels are fixed rings, not dials).
const shape = (ids) => ids.map((id) => (type(id) === 'link' ? `=${id}` : type(id))).join(' ');
const dialIds = (ids) => ids.filter((id) => type(id) !== 'link');

const SINGLES = Object.values(FAMILIES).filter((f) => f.single).flatMap((f) => f.members);
// Everyday free bases (sun, book) are words students already know: earned only when a level puts them on a dial.
const EVERYDAY = new Set(Object.values(FAMILIES.everyday.members).flat());

function plan(district, earnedBefore) {
  const pool = [...home.entries()].filter(([, d]) => d === district).map(([id]) => id).sort((a, b) => rank.get(a) - rank.get(b));
  const must = (id) => !EVERYDAY.has(id);
  const W = [...words.values()].filter((x) => districtOf(x.p) === district);
  const earned = new Set(earnedBefore);
  const levels = [];
  const usedWords = new Set();
  let pass = 0;
  for (let guard = 0; guard < 120; guard++) {
    const fresh = pool.filter((id) => !earned.has(id));
    if (!fresh.some(must)) break;
    const [MIN_WORDS, MIN_WORDS_3] = PASSES[pass];
    const allowThree = levels.length >= 3;
    // Group the remaining words by shape; each shape is a candidate dial layout.
    const byShape = new Map();
    W.filter((x) => !usedWords.has(x.w)).forEach((x) => {
      const n = dialIds(x.p).length;
      if (n < 2 || n > 3 || (n === 3 && !allowThree)) return;
      if (!x.p.some((id) => fresh.includes(id) && (must(id) || pass === 0))) return;
      const s = shape(x.p);
      if (!byShape.has(s)) byShape.set(s, []);
      byShape.get(s).push(x);
    });
    let best = null;
    for (const [s, list] of byShape) {
      const n = dialIds(list[0].p).length;
      const cap = n === 2 ? 3 : 2;
      // Seed from the earliest-taught fresh morphemes in this shape; single-morpheme families first.
      const seeds = [...new Set(list.flatMap((x) => dialIds(x.p)))].filter((id) => fresh.includes(id))
        .sort((a, b) => (SINGLES.includes(b) - SINGLES.includes(a)) || rank.get(a) - rank.get(b)).slice(0, 8);
      for (const seed of seeds) {
        const sets = Array.from({ length: n }, () => new Set());
        const fits = (x) => dialIds(x.p).every((id, k) => sets[k].has(id));
        const seedWord = list.find((x) => dialIds(x.p).includes(seed));
        dialIds(seedWord.p).forEach((id, k) => sets[k].add(id));
        // Grow the dials one morpheme at a time, keeping whichever adds the most real words.
        for (let step = 0; step < n * cap; step++) {
          let pick = null;
          for (let k = 0; k < n; k++) {
            if (sets[k].size >= cap) continue;
            const cands = new Set(list.map((x) => dialIds(x.p)[k]).filter((id) => !sets[k].has(id)));
            for (const c of cands) {
              sets[k].add(c);
              const count = list.filter(fits).length;
              sets[k].delete(c);
              const score = count * 10 + (fresh.includes(c) ? 3 : 0) - rank.get(c) / 1000;
              if (!pick || score > pick.score) pick = { k, c, score };
            }
          }
          if (!pick) break;
          sets[pick.k].add(pick.c);
        }
        const hits = list.filter(fits);
        if (hits.length < (n === 2 ? MIN_WORDS : MIN_WORDS_3)) continue;
        const all = sets.flatMap((st) => [...st]);
        const newCount = all.filter((id) => fresh.includes(id) && (must(id) || pass === 0)).length;
        if (!newCount) continue;
        const score = Math.min(hits.length, 7) * 2 + newCount * 3 - Math.min(...all.map((id) => rank.get(id))) / 40 + (all.some((id) => SINGLES.includes(id) && fresh.includes(id)) ? 50 : 0);
        if (!best || score > best.score) best = { s, sets: sets.map((st) => [...st]), hits, score };
      }
    }
    if (!best) { if (++pass >= PASSES.length) break; continue; }
    const earn = best.sets.flat().filter((id) => !earned.has(id));
    best.hits[0].p.filter((id) => type(id) === 'link').forEach((id) => { if (!earned.has(id) && !earn.includes(id)) earn.push(id); });
    // Top up to six earns with the next fresh morphemes in teach order (they become decoys and review).
    for (const id of fresh) { if (earn.length >= 6) break; if (!earn.includes(id) && !SINGLES.includes(id) && must(id)) earn.push(id); }
    const isNew = (x) => x.p.filter((id) => earn.includes(id)).length;
    const requests = [...best.hits].sort((a, b) => isNew(b) - isNew(a)).slice(0, 6).map((x) => ({ p: x.p, m: x.m }));
    best.hits.forEach((x) => usedWords.add(x.w));
    earn.forEach((id) => earned.add(id));
    levels.push({ shape: best.s, dials: best.sets, earn, requests, words: best.hits.map((x) => x.w), single: SINGLES.find((id) => earn.includes(id)) || null });
  }
  return { levels, earned, leftover: pool.filter((id) => !earned.has(id) && must(id)) };
}

const out = {};
let earnedSoFar = new Set();
const summary = [];
for (const d of MAIN_ORDER) {
  const { levels, earned, leftover } = plan(d, earnedSoFar);
  // Leftovers ride along as extra earn nodes (up to MAX_EARN per level), spread back from the end.
  // Each leftover joins the latest level (from its teach rank on) that still has room, so it is earned
  // no earlier than the room would have taught it.
  const unplaced = [];
  const sameMeaning = (a, b) => MORPHEMES[a].meaning === MORPHEMES[b].meaning && MORPHEMES[a].origin === MORPHEMES[b].origin && type(a) === type(b);
  for (const id of leftover) {
    // A sibling spelling (fac for fact) is earned on its sibling's node: same meaning, different clothes.
    const host = levels.find((L) => L.earn.some((e) => sameMeaning(e, id)));
    if (host) {
      const e = host.earn.find((x) => sameMeaning(x, id));
      host.with = host.with || {};
      (host.with[e] = host.with[e] || []).push(id);
      continue;
    }
    const open = levels.filter((L) => L.earn.length < MAX_EARN);
    if (!open.length) { unplaced.push(id); continue; }
    open.sort((x, y) => x.earn.length - y.earn.length);
    open[0].earn.push(id);
  }
  earnedSoFar = new Set([...earned, ...leftover]);
  out[d] = levels.map((L, n) => ({ id: `${d}-${n + 1}`, ...L }));
  summary.push({ d, levels: levels.length, earns: levels.reduce((a, L) => a + L.earn.length, 0), leftover: leftover.length, unplaced });
}

if (REPORT) {
  for (const d of MAIN_ORDER) {
    console.log(`\n== ${d} ==`);
    out[d].forEach((L) => L.with && console.log('          with', JSON.stringify(L.with)));
    out[d].forEach((L) => console.log(`${L.id.padEnd(9)} ${L.shape.padEnd(20)} ${L.dials.map((x) => x.join('/')).join(' × ').padEnd(44)} earn ${String(L.earn.length).padStart(2)} words ${String(L.words.length).padStart(2)}${L.single ? `  SINGLE ${L.single}` : ''}`));
  }
  console.log('\n', summary);
} else {
  const rows = (d) => out[d].map((L) => `    ${JSON.stringify(L)},`).join('\n');
  const body = `/**
 * CyberMorph levels. GENERATED by scripts/build-cybermorph-levels.mjs from the word bank and each
 * room's teach order. Change the generator and re-run it rather than editing here.
 *
 * A level: EARN each morpheme in \`earn\` with its minigame (the appetizer), BUILD the \`requests\` on
 * the dials (the main course; \`dials\` lists each dial's morphemes, linking vowels ride as fixed
 * rings), then DEBUG Rotlings made from the level's \`words\` (dessert).
 */

export const LEVELS = {
${MAIN_ORDER.map((d) => `  ${d}: [\n${rows(d)}\n  ],`).join('\n')}
};
`;
  writeFileSync(path.join(ROOT, 'data/levels.js'), body);
  console.log('wrote js/data/levels.js', summary);
}

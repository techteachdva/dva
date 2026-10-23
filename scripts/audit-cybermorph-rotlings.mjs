/**
 * CyberMorph Rotling mix audit. Runs the real generators (js/game/waves.js) the way the game calls
 * them and counts each call: real, misspelled, not a word, reversed.
 *
 *   level dessert  every level's three Rotlings, with what the player has earned by that level
 *   Rotling hall   every room's wave, with what the player has been taught by that room
 *   Rot Return     the harder wave in a cleared room
 *
 * Fails (exit 1) when dessert or hall drifts more than TOLERANCE points from MIX, or when a room
 * never shows one of the four calls.
 *
 *   node scripts/audit-cybermorph-rotlings.mjs [runs]
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/site/cybermorph/js');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const W = await imp('game/waves.js');
const { LEVELS } = await imp('data/levels.js');
const { MAIN_ORDER } = await imp('data/world.js');
const { verdictOf } = await imp('panels/debug.js').catch(() => ({ verdictOf: null }));

const RUNS = Number(process.argv[2]) || 200;
const TOLERANCE = 5;
const CALLS = ['real', 'misspelled', 'nonword', 'reversed'];
// debug.js touches the DOM on import in some builds, so fall back to the same rule here.
const call = verdictOf || ((it) => (!it.fake ? 'real' : it.fake === 'order' ? 'reversed' : it.fake === 'nonword' ? 'nonword' : 'misspelled'));

const blank = () => ({ calls: Object.fromEntries(CALLS.map((c) => [c, 0])), kinds: {} });
const add = (t, it) => { t.calls[call(it)]++; if (it.fake) t.kinds[it.fake] = (t.kinds[it.fake] || 0) + 1; };
const levelIds = (L) => [...L.earn, ...Object.values(L.with || {}).flat()];
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const dessert = blank();
const hall = blank();
const ret = blank();
const perRoom = Object.fromEntries(MAIN_ORDER.map((r) => [r, blank()]));
for (let run = 0; run < RUNS; run++) {
  const learned = new Set();
  for (const room of MAIN_ORDER) {
    // Dessert exactly as serveDessert deals it.
    for (const L of LEVELS[room]) {
      levelIds(L).forEach((id) => learned.add(id));
      const words = shuffle(L.requests).slice(0, 3).map((t) => ({ ids: t.p }));
      W.dealCalls(words, W.rollCalls(words.length), learned).forEach((it) => { add(dessert, it); add(perRoom[room], it); });
    }
    // The hall wave as spawnWave makes it (the hall sits between levels, so this is generous on what's learned).
    const taught = new Set([...W.taughtBy(room), ...learned]);
    W.makeWave({ learned: taught, origin: room, size: room === 'anglo' ? 6 : 7 }).filter((it) => !it.golden).forEach((it) => { add(hall, it); add(perRoom[room], it); });
    W.makeWave({ learned: taught, origin: room, size: 4, fakes: 0.5, minParts: 3, golden: 0 }).forEach((it) => add(ret, it));
  }
}

const pct = (t, c) => { const n = CALLS.reduce((a, k) => a + t.calls[k], 0); return n ? (100 * t.calls[c]) / n : 0; };
const row = (name, t, target) => `${name.padEnd(16)}${CALLS.map((c) => `${pct(t, c).toFixed(1).padStart(6)}%${target ? ` (${(target[c] * 100).toFixed(0)})` : ''}`.padEnd(target ? 14 : 9)).join('')}`;
console.log(`CyberMorph Rotling mix · ${RUNS} runs · target in brackets`);
console.log(`${''.padEnd(16)}${CALLS.map((c) => c.padEnd(14)).join('')}`);
console.log(row('level dessert', dessert, W.MIX));
console.log(row('Rotling hall', hall, W.MIX));
console.log(row('Rot Return', ret, { real: 0.5, misspelled: 0.3 / 0.6 * 0.5, nonword: 0.2 / 0.6 * 0.5, reversed: 0.1 / 0.6 * 0.5 }));
MAIN_ORDER.forEach((r) => console.log(row(`  ${r}`, perRoom[r])));
const kinds = { ...dessert.kinds };
Object.entries(hall.kinds).forEach(([k, v]) => { kinds[k] = (kinds[k] || 0) + v; });
const nFake = Object.values(kinds).reduce((a, b) => a + b, 0);
console.log(`fake kinds: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / nFake).toFixed(0)}%`).join(' · ')}`);

const problems = [];
[['level dessert', dessert], ['Rotling hall', hall]].forEach(([name, t]) => CALLS.forEach((c) => {
  const off = pct(t, c) - W.MIX[c] * 100;
  if (Math.abs(off) > TOLERANCE) problems.push(`${name}: ${c} is ${pct(t, c).toFixed(1)}%, target ${W.MIX[c] * 100}%`);
}));
MAIN_ORDER.forEach((r) => CALLS.forEach((c) => { if (!perRoom[r].calls[c]) problems.push(`${r}: never shows a ${c} Rotling`); }));
if (problems.length) { console.log(`\nFAIL\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log('\nOK: every call within ' + TOLERANCE + ' points of the mix, and every room shows all four.');

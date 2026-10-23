/**
 * CyberMorph Final Test audit. Draws many fights the way the game does (js/game/finale/draw.js) for a
 * player who has just cleared all three rooms, and fails (exit 1) when:
 *   - a beat comes back empty or short,
 *   - any Lingo morpheme appears,
 *   - a word doesn't rebuild to itself in the spelling engine,
 *   - a multiple-choice item has a repeated option or its answer missing,
 *   - the Swarm is missing one of the four calls.
 * It also prints how often two fights share items, so "you can't memorize it" is a number.
 *
 *   node scripts/audit-cybermorph-finale.mjs [fights]
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/site/cybermorph/js');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { drawContext, drawPhase } = await imp('game/finale/draw.js');
const { seeded } = await imp('core/rng.js');
const { LEVELS } = await imp('data/levels.js');
const { MORPHEMES } = await imp('data/morphemes.js');
const { build } = await imp('compiler/wordsum.js');

const FIGHTS = Number(process.argv[2]) || 1000;
const learned = Object.values(LEVELS).flat().flatMap((l) => [...l.earn, ...Object.values(l.with || {}).flat()]);
const profile = (beaten) => ({ learned, lexicon: [], mastery: {}, finale: { beaten } });

const problems = new Set();
const fail = (msg) => problems.add(msg);
const lingo = (ids) => ids.some((id) => !MORPHEMES[id] || MORPHEMES[id].origin === 'lingo');
const checkWord = (beat, ids, word) => {
  if (lingo(ids)) fail(`${beat}: Lingo or unknown morpheme in ${ids.join('+')}`);
  else if (word && build(ids).word !== word) fail(`${beat}: ${ids.join('+')} builds ${build(ids).word}, not ${word}`);
};
const checkChoice = (beat, it) => {
  if (new Set(it.options).size !== it.options.length) fail(`${beat}: repeated option in ${JSON.stringify(it.options)}`);
  if (!(it.a >= 0 && it.a < it.options.length)) fail(`${beat}: answer index missing`);
  if (it.options.length < 3) fail(`${beat}: only ${it.options.length} options`);
};

const seen = {};
const note = (beat, key) => { (seen[beat] ||= new Map()).set(key, (seen[beat].get(key) || 0) + 1); };
const sizes = {};
const minSize = (beat, n) => { sizes[beat] = Math.min(sizes[beat] ?? Infinity, n); };

for (let f = 0; f < FIGHTS; f++) {
  const ctx = drawContext(profile(f % 2 === 1));
  const rnd = seeded(f * 7919 + 13);
  [0, 1, 2].forEach((ph) => drawPhase(ph, rnd, ctx, f % 4 === 3 ? 'mirror' : null).forEach(({ beat, content: c }) => {
    const b = beat.id;
    if (!c) { fail(`${b}: drew nothing`); return; }
    if (b === 'volley') { minSize(b, c.items.length); c.items.forEach((it) => { checkWord(b, [it.id]); checkChoice(b, it); note(b, it.id); }); }
    if (b === 'twins') { minSize(b, c.pairs.length); c.pairs.forEach((p) => { checkWord(b, [p.l, p.r]); if (MORPHEMES[p.l].origin === MORPHEMES[p.r].origin) fail('twins: a pair from one language'); note(b, `${p.l}~${p.r}`); }); }
    if (b === 'shape') { minSize(b, c.tasks.length); c.tasks.forEach((t) => { checkWord(b, [...t.fixed, ...t.ring[t.a]]); note(b, t.s); }); }
    if (b === 'swarm') {
      minSize(b, c.items.length);
      const calls = new Set(c.items.map((it) => (!it.fake ? 'real' : it.fake === 'order' ? 'reversed' : it.fake === 'nonword' ? 'nonword' : 'misspelled')));
      if (calls.size < 4) fail(`swarm: only ${[...calls].join(', ')}`);
      c.items.forEach((it) => { checkWord(b, it.p, it.fake ? null : it.word); note(b, it.show || it.word); });
    }
    if (b === 'spell') { minSize(b, c.items.length); c.items.forEach((it) => { checkWord(b, it.p, it.word); note(b, it.word); }); }
    if (b === 'family') {
      minSize(b, c.bases.length * 3 + c.decoys.length);
      c.bases.forEach((x) => note(b, x.id));
      // scrib/script, duc/duct: spellings of one root are family, so they can never be a decoy.
      c.decoys.forEach((d) => c.bases.forEach((x) => {
        const m = MORPHEMES[d.base];
        const n = MORPHEMES[x.id];
        if (m.origin === n.origin && (m.text.slice(0, 3) === n.text.slice(0, 3) || m.meaning.split(/[;,(]/)[0] === n.meaning.split(/[;,(]/)[0])) fail(`family: decoy ${d.w} (${m.text}) is the same root as ${n.text}`);
      }));
    }
    if (b === 'volley') c.items.forEach((it) => {
      const words = (s) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !['being', 'state', 'something', 'with', 'that', 'which', 'this', 'from', 'your', 'into'].includes(w)));
      const right = words(it.options[it.a]);
      it.options.forEach((o, i) => { if (i !== it.a && [...words(o)].some((w) => right.has(w))) fail(`volley: option "${o}" shares a word with the answer "${it.options[it.a]}"`); });
    });
    if (b === 'forge') { minSize(b, c.tasks.length); c.tasks.forEach((t) => { checkWord(b, t.p, t.word); note(b, t.word); }); }
    if (b === 'detective') { minSize(b, c.items.length); c.items.forEach((it) => { checkWord(b, it.p, it.word); checkChoice(b, it); note(b, it.word); }); }
    if (b === 'giant') { checkWord(b, c.p, c.word); checkChoice(b, c); c.tags.forEach((t) => checkChoice('giant tag', t)); note(b, c.word); }
  }));
}

const NEED = { volley: 6, twins: 4, shape: 3, swarm: 6, spell: 4, family: 8, forge: 3, detective: 2 };
Object.entries(NEED).forEach(([b, n]) => { if ((sizes[b] ?? 0) < n) fail(`${b}: a fight drew only ${sizes[b]} (needs ${n})`); });

console.log(`CyberMorph Final Test · ${FIGHTS} fights drawn`);
console.log('beat        distinct items   most common item (share of fights)');
Object.entries(seen).forEach(([b, m]) => {
  const top = [...m.entries()].sort((x, y) => y[1] - x[1])[0];
  console.log(`${b.padEnd(12)}${String(m.size).padStart(8)}         ${String(top[0]).slice(0, 40)} (${((100 * top[1]) / FIGHTS).toFixed(0)}%)`);
});
if (problems.size) { console.log(`\nFAIL\n  ${[...problems].slice(0, 30).join('\n  ')}`); process.exit(1); }
console.log('\nOK: every beat drew in full, no Lingo, every word rebuilds, every choice is clean.');

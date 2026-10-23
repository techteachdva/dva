/**
 * Builds CyberMorph's extra MISSPELLED Rotlings (src/site/cybermorph/js/data/misspellings.js).
 *
 * The game already misspells a word when a spelling rule is skipped (joint: hopeing) or a linking o
 * is dropped (link). Those need a word where a rule fires, and most words have none. This adds
 * five kinds that work on far more words, each one a spelling fact about a morpheme:
 *
 *   twin      a look- or sound-alike affix      carefull, kindnes, visable, differance, perscribe
 *   overrule  a spelling rule used where it doesn't belong   sleepping, carful, plaied
 *   greek     a Greek piece spelled the everyday way         fotograph, sinonym, kronology
 *   seam      a doubled letter dropped or added where a prefix meets its base   interupt, missunderstand
 *   vowel     a hard-to-hear vowel in a root written wrong   posetion, geolagy
 *
 * Every result is checked against a full English word list (an-array-of-english-words, a
 * devDependency; nothing of it ships) so a "misspelling" is never a real word.
 *
 *   node scripts/build-cybermorph-misspellings.mjs
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ENGLISH = new Set(require('an-array-of-english-words'));
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/site/cybermorph/js');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { MORPHEMES, morph } = await imp('data/morphemes.js');
const { build } = await imp('compiler/wordsum.js');
const { DICTIONARY, collectPartWords } = await imp('data/world.js');
const { NONWORDS } = await imp('data/nonwords.js');

const PER_KIND = 2;
const real = (w) => ENGLISH.has(w) || DICTIONARY.has(w);
const nonwordShows = new Set(Object.values(NONWORDS).flat().map((n) => n.show));
const VOWELS = 'aeiou';
const isVowel = (c) => VOWELS.includes(c);
const isConsonant = (c) => !!c && /[a-z]/.test(c) && !isVowel(c);

// Affix twins: the spelling a student is likely to write instead. [wrong spelling, why]
const TWINS = {
  sfx: {
    ful: [['full', (w) => `As a suffix, -ful has only one l: ${w}.`]],
    ness: [['nes', (w) => `-ness ends in a double s: ${w}.`]],
    less: [['les', (w) => `-less ends in a double s: ${w}.`]],
    able: [['ible', (w) => `This word takes -able, not -ible: ${w}.`]],
    ible: [['able', (w) => `This word takes -ible, not -able: ${w}.`]],
    ance: [['ence', (w) => `This word takes -ance, not -ence: ${w}.`]],
    ence: [['ance', (w) => `This word takes -ence, not -ance: ${w}.`]],
    ant: [['ent', (w) => `This word takes -ant, not -ent: ${w}.`]],
    ent: [['ant', (w) => `This word takes -ent, not -ant: ${w}.`]],
    er: [['or', (w) => `This word ends in -er, not -or: ${w}.`]],
    or: [['er', (w) => `This word ends in -or, not -er: ${w}. Many Latin words take -or (actor, motor, inventor).`]],
    ary: [['ery', (w) => `This word takes -ary, not -ery: ${w}.`]],
    ic: [['ick', (w) => `The Greek suffix -ic is spelled with a c alone: ${w}.`]],
    ous: [['us', (w) => `-ous keeps its o: ${w}.`]],
  },
  base: {
    ceive: [['cieve', (w) => `After c, it's e before i: ceive (receive, deceive): ${w}.`]],
    ceit: [['ciet', (w) => `After c, it's e before i: ceit (deceit, conceit): ${w}.`]],
  },
  pfx: {
    pre: [['per', (w) => `pre- means "before"; per- means "through". This word needs pre-: ${w}.`]],
    per: [['pre', (w) => `per- means "through"; pre- means "before". This word needs per-: ${w}.`]],
    de: [['di', (w) => `This prefix is de- ("down, away"), not di-: ${w}.`]],
  },
};

// Greek letters spelled the everyday way. [regex on the piece, replacement, the Greek letters]
const GREEK = [
  [/ph/, 'f', 'ph'],
  [/^ps/, 's', 'ps'],
  [/ch/, 'k', 'ch'],
  [/y/, 'i', 'y'],
  [/rh/, 'r', 'rh'],
];

// The vowel a student writes for one they can't hear clearly.
const VOWEL_SLIP = { a: 'e', e: 'i', i: 'e', o: 'a', u: 'o' };

const cutsOf = (segs) => { const out = []; let p = 0; segs.slice(0, -1).forEach((s) => { p += s.length; out.push(p); }); return out; };

/** Every candidate misspelling of one word, as { kind, segs, at, why }. */
function candidates(ids, res) {
  const out = [];
  const segs = res.segments;
  const parts = res.parts;
  const word = res.word;
  const swap = (i, text) => segs.map((s, k) => (k === i ? text : s));
  parts.forEach((m, i) => {
    // twin: only where the piece is still spelled as itself (no rule has changed it)
    const twins = (TWINS[m.type] || {})[m.text];
    if (twins && segs[i] === m.text) twins.forEach(([wrong, why]) => out.push({ kind: 'twin', segs: swap(i, wrong), at: i, why: why(word) }));
    // greek: one Greek spelling, written the everyday way
    if (m.origin === 'greek' && (m.type === 'base' || m.type === 'pfx')) {
      GREEK.forEach(([re, to, from]) => {
        if (!re.test(segs[i])) return;
        out.push({ kind: 'greek', segs: swap(i, segs[i].replace(re, to)), at: i, why: `${m.text} is Greek, and Greek pieces keep their ${from} in English: ${word}.` });
      });
    }
    // vowel: a vowel that's hard to hear written as the wrong one (posetion, diagrum). Inside a root only,
    // never its first letter, and only where the root is still spelled as itself.
    // Skipped: a final (often silent) vowel, a vowel beside another vowel, and the one vowel of a
    // one-beat root that starts or ends the word (capt-ure, ex-tract: that beat is stressed, so it's heard clearly).
    if (m.type === 'base' && m.text.length >= 3 && segs[i] === m.text && m.origin !== 'anglo') {
      const beats = (m.text.match(/[aeiou]/g) || []).length;
      [...m.text].forEach((ch, k) => {
        if (k === 0 || k === m.text.length - 1 || !VOWEL_SLIP[ch] || isVowel(m.text[k - 1]) || isVowel(m.text[k + 1])) return;
        if (beats < 2 && (i === 0 || i === parts.length - 1)) return;
        out.push({ kind: 'vowel', segs: swap(i, m.text.slice(0, k) + VOWEL_SLIP[ch] + m.text.slice(k + 1)), at: i, why: `${m.text} keeps its spelling in every word, even where its vowel is hard to hear: ${word}.` });
      });
    }
    const next = parts[i + 1];
    // seam: a prefix and base that meet on the same letter keep both (inter + rupt); dis- and mis- add none
    if (m.type === 'pfx' && next && segs[i] === m.text) {
      const c = segs[i][segs[i].length - 1];
      if (segs[i + 1][0] === c) {
        out.push({ kind: 'seam', segs: swap(i, segs[i].slice(0, -1)), at: i, why: `${m.text}- ends in ${c} and ${next.text} starts with ${c}, so the word keeps both: ${word}.` });
      } else if ((m.text === 'dis' || m.text === 'mis') && isVowel(segs[i + 1][0])) {
        out.push({ kind: 'seam', segs: swap(i, segs[i] + 's'), at: i, why: `${m.text}- has one s. A second s comes only when the base starts with s (mis + spell): ${word}.` });
      }
    }
    // overrule: a rule applied at a joint where it doesn't belong
    if (!next || next.type !== 'sfx' || res.steps.some((s) => s.at === i)) return;
    const left = segs[i];
    const tail = left[left.length - 1];
    const tail2 = left[left.length - 2];
    const head = segs[i + 1][0];
    const vowelHead = isVowel(head) || head === 'y';
    // False doubling only on everyday Anglo-Saxon words, where students hear the vowel (sleepping, happenned).
    const beats = (left.match(/[aeiouy]+/g) || []).length;
    const reason = isVowel(left[left.length - 3]) ? `${m.text} has two vowels before the ${tail}` : beats >= 2 ? `${m.text} is said with the stress on its first beat` : null;
    if (vowelHead && isConsonant(tail) && !'wxy'.includes(tail) && isVowel(tail2) && !m.cvc && m.type === 'base' && m.origin === 'anglo' && reason) {
      out.push({ kind: 'overrule', segs: swap(i, left + tail), at: i + 1, why: `A consonant doubles only after one short vowel (run → running). ${reason}, so nothing doubles: ${word}.` });
    }
    if (!vowelHead && tail === 'e' && isConsonant(tail2) && m.origin === 'anglo') {
      out.push({ kind: 'overrule', segs: swap(i, left.slice(0, -1)), at: i + 1, why: `The final e drops only before a VOWEL suffix. -${next.text} starts with a consonant, so the e stays: ${word}.` });
    }
    if (tail === 'y' && isVowel(tail2) && head !== 'i') {
      out.push({ kind: 'overrule', segs: swap(i, left.slice(0, -1) + 'i'), at: i + 1, why: `A vowel before the y keeps the y (play → played, joy → joyful): ${word}.` });
    }
    if (tail === 'y' && isConsonant(tail2) && head === 'i') {
      out.push({ kind: 'overrule', segs: swap(i, left.slice(0, -1) + 'i'), at: i + 1, why: `y stays before -${next.text}, so there is never a double i: ${word}.` });
    }
  });
  return out;
}

const out = {};
const tally = { twin: 0, overrule: 0, greek: 0, seam: 0, vowel: 0 };
for (const w of collectPartWords()) {
  const ids = w.ids;
  if (out[w.word] || ids.some((id) => !MORPHEMES[id] || ['word'].includes(morph(id).type) || morph(id).origin === 'lingo')) continue;
  let res;
  try { res = build(ids); } catch { continue; }
  if (res.word !== w.word) continue;
  const found = [];
  const per = { twin: 0, overrule: 0, greek: 0, seam: 0, vowel: 0 };
  for (const c of candidates(ids, res)) {
    const show = c.segs.join('');
    if (per[c.kind] >= PER_KIND || show === res.word || show.length < 4 || /(.)\1\1/.test(show)) continue;
    if (real(show) || nonwordShows.has(show) || found.some((f) => f.show === show)) continue;
    found.push({ kind: c.kind, show, cuts: cutsOf(c.segs), at: c.at, why: c.why });
    per[c.kind]++;
    tally[c.kind]++;
  }
  if (found.length) out[w.word] = found;
}

const body = `/**
 * Extra MISSPELLED Rotlings. GENERATED by scripts/build-cybermorph-misspellings.mjs: each real word maps to
 * misspellings of it (twin affix, a spelling rule overused, a Greek letter spelled the everyday way),
 * checked against a full English word list so none of them is a real word. \`at\` is the morpheme the
 * mistake belongs to; \`cuts\` are the seams in the misspelled word.
 */

export const MISSPELLINGS = ${JSON.stringify(out)};
`;
writeFileSync(path.join(ROOT, 'data/misspellings.js'), body);
console.log(`wrote js/data/misspellings.js: ${Object.keys(out).length} words · twin ${tally.twin} · overrule ${tally.overrule} · greek ${tally.greek} · seam ${tally.seam} · vowel ${tally.vowel}`);

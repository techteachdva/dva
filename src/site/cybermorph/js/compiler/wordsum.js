/**
 * The spelling-joint engine.
 *
 * build(ids) turns a list of morpheme ids into a word and records every
 * spelling rule that fired, so the Morph Compiler can animate the joint
 * instead of just stating it:
 *
 *   hope + ing   -> hop(e) + ing  -> hoping         (drop e)
 *   run + ing    -> run + n + ing -> running        (double)
 *   friend + ly + ness -> friendl(y→i) + ness       (y to i)
 *   in + mobile  -> im + mobile   -> immobile       (assimilation)
 *   tie + ed     -> ti(e) + ed    -> tied           (e meets e)
 *
 * Rules on the right-hand side only fire when the right piece is a SUFFIX,
 * which keeps prefixes like pre- and de- from losing their e (pre + act stays preact).
 *
 * `segments` are the surface pieces of the finished word (hop | ing). They give
 * DEBUG its seam positions. A doubled consonant gives two acceptable seams.
 */

import { morph } from '../data/morphemes.js';

const VOWELS = 'aeiou';
const isVowel = (c) => VOWELS.includes(c);
const isConsonant = (c) => !!c && /[a-z]/.test(c) && !isVowel(c);

export function build(ids) {
  const parts = ids.map((id) => morph(id));
  const segments = [];
  const steps = [];
  const altCuts = []; // seams after a doubled consonant: one letter earlier is also accepted (runn|ing or run|ning)
  let acc = '';

  parts.forEach((p, i) => {
    let right = p.text;
    if (i === 0) {
      segments.push(right);
      acc = right;
      return;
    }
    const prev = parts[i - 1];
    let last = segments.length - 1;

    // Prefix assimilation: the prefix changes to match the next letter.
    if (prev.type === 'pfx' && prev.assim && prev.assim[right[0]]) {
      const from = segments[last];
      const to = prev.assim[right[0]];
      if (from === prev.text && to !== from) {
        segments[last] = to;
        acc = acc.slice(0, acc.length - from.length) + to;
        steps.push({ kind: 'assim', at: i - 1, from, to, note: `${from}- becomes ${to}- before "${right[0]}"` });
      }
    }

    // Greek elision: anti + onym -> antonym, homo + onym -> homonym.
    if (prev.elide && 'aeiou'.includes(right[0]) && segments[last] === prev.text) {
      segments[last] = prev.text.slice(0, -1);
      acc = acc.slice(0, -1);
      steps.push({ kind: 'elide', at: i - 1, note: `${prev.text}- drops its last vowel before another vowel` });
    }

    if (p.type === 'sfx') {
      const tail = acc[acc.length - 1];
      const tail2 = acc[acc.length - 2];
      const head = right[0];
      const vowelHead = isVowel(head) || head === 'y';

      if (tail === 'e' && head === 'e') {
        // tie + ed -> tied, free + ed -> freed
        segments[last] = segments[last].slice(0, -1);
        acc = acc.slice(0, -1);
        steps.push({ kind: 'merge-e', at: i - 1, note: `two e's meet, so one drops` });
      } else if (tail === 'e' && isConsonant(tail2) && vowelHead && !((tail2 === 'c' || tail2 === 'g') && (head === 'a' || head === 'o'))) {
        // hope + ing -> hoping, scope + ic -> scopic
        segments[last] = segments[last].slice(0, -1);
        acc = acc.slice(0, -1);
        steps.push({ kind: 'drop-e', at: i - 1, note: `-${right} starts with a vowel, so the final e drops` });
      } else if (tail === 'y' && isConsonant(tail2) && head !== 'i') {
        // sleepy + ness -> sleepiness, friendly + ness -> friendliness
        segments[last] = segments[last].slice(0, -1) + 'i';
        acc = acc.slice(0, -1) + 'i';
        steps.push({ kind: 'y-i', at: i - 1, note: `consonant + y changes y to i before -${right}` });
      } else if (prev.cvc && vowelHead && segments[last] === prev.text) {
        // run + ing -> running, mit + ed -> mitted
        const letter = tail;
        altCuts.push(acc.length + 1);
        segments[last] = segments[last] + letter;
        acc = acc + letter;
        steps.push({ kind: 'double', at: i - 1, letter, note: `short vowel + one consonant doubles the ${letter} before a vowel suffix` });
      }
    }

    if (p.type === 'word' || (prev.type === 'word' && p.type !== 'sfx')) {
      // Lingo phrases keep their spaces: fix + ing + to -> "fixing to"
      acc += ' ' + right;
    } else {
      acc += right;
    }
    segments.push(right);
    last = segments.length - 1;
  });

  const cuts = [];
  let pos = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    pos += segments[i].length;
    cuts.push(pos);
  }
  return { word: acc, segments, steps, cuts, altCuts, parts };
}

/** "hop(e) + ing → hoping", the way Structured Word Inquiry writes it. */
export function sumText(ids) {
  const res = build(ids);
  const plain = res.parts.map((p) => p.text).join(' + ');
  if (!res.steps.length) return `${plain} → ${res.word}`;
  const marked = res.parts.map((p, i) => {
    const s = res.steps.find((st) => st.at === i);
    if (!s) return p.text;
    if (s.kind === 'drop-e' || s.kind === 'merge-e') return p.text.slice(0, -1) + '(e)';
    if (s.kind === 'elide') return `${p.text.slice(0, -1)}(${p.text.slice(-1)})`;
    if (s.kind === 'y-i') return p.text.slice(0, -1) + '(y→i)';
    if (s.kind === 'double') return p.text + ' + ' + s.letter;
    if (s.kind === 'assim') return `${p.text}(→${s.to})`;
    return p.text;
  });
  return `${plain} → ${marked.join(' + ')} → ${res.word}`;
}

export function glossLine(ids) {
  return ids.map((id) => {
    const m = morph(id);
    return `${m.text} (${m.meaning})`;
  }).join(' + ');
}

/**
 * Check a set of player cuts against a word's accepted seams.
 * Every seam must be found; doubled consonants accept either side of the extra letter.
 */
export function cutsMatch(player, expected, doubled = []) {
  const p = [...player].sort((a, b) => a - b);
  if (p.length !== expected.length) return false;
  const dbl = new Set(doubled);
  return expected.every((c, i) => p[i] === c || (dbl.has(c) && p[i] === c - 1));
}

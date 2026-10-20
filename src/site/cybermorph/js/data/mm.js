/**
 * Morpheme Magic (3rd ed.) skills sequence, mapped to CyberMorph morpheme ids.
 * Lessons are numbered within each section, the way the book numbers them:
 * Suffix 1–13, Prefix 1–19, Root 1–18, Greek 1–2. Keys are S1…S13, P1…P19, R1…R18, G1…G2.
 *
 * No imports, so the teacher's class report page can load this on its own.
 * Morphemes the book doesn't teach report under the key X ("other").
 */

const SECTIONS = [
  ['S', 'Suffix', [
    ['-s, -es', ['s', 'es']], ['-ed', ['ed']], ['-ing', ['ing']], ['-ly', ['ly']], ['-er, -or', ['er', 'or']],
    ['-ion, -tion', ['ion', 'ation']], ['-al', ['al', 'ial']], ['-y', ['y']], ['-ness', ['ness']], ['-ment', ['ment']],
    ['-able, -ible', ['able', 'ible']], ['-ful', ['ful']], ['-less', ['less']],
  ]],
  ['P', 'Prefix', [
    ['un-', ['un']], ['re-', ['re']], ['in-, im-, il-, ir- (not)', ['in']], ['dis-, dif-', ['dis']], ['non-', ['non']],
    ['in-, im-, il-, ir- (in, on, toward)', ['in2']], ['over-', ['over']], ['mis-', ['mis']], ['sub-', ['sub']], ['pre-', ['pre']],
    ['inter-', ['inter']], ['fore-', ['fore']], ['de-', ['de']], ['trans-', ['trans']], ['anti-', ['anti']], ['mid-', ['mid']],
    ['con- (co-, col-, com-, cor-)', ['con']], ['ad- (ac-, af-, al-, an-, ap-, ar-, as-, at-)', ['ad']], ['ex-, e-, ef-', ['ex', 'e']],
  ]],
  ['R', 'Root', [
    ['form', ['form']], ['port', ['port']], ['rupt', ['rupt']], ['tract', ['tract']], ['scrib, script', ['scrib', 'scribe', 'script']],
    ['spect, spec, spic', ['spect', 'spec', 'spic']], ['struct, stru', ['struct', 'stru']], ['dict, dic', ['dict', 'dic']], ['fer', ['fer']],
    ['mit, miss', ['mit', 'miss']], ['duct, duc, duce', ['duct', 'duc', 'duce']], ['fact, fac, fect, fic', ['fact', 'fac', 'fect', 'fic']],
    ['ten, tain, tin, tinu', ['ten', 'tent', 'tain', 'tin', 'tinu']], ['vis, vid', ['vis', 'vise', 'vid', 'vide']],
    ['cap, ceit, ceive, cept, cip', ['cap', 'capt', 'ceit', 'ceive', 'cept', 'cip']], ['sta, sist, stat, stit', ['sta', 'sist', 'stat', 'stit']],
    ['pos, pon', ['pos', 'pose', 'posit', 'pon', 'pone']], ['plic, ply', ['plic', 'ply']],
  ]],
  ['G', 'Greek', [
    ['graph, gram', ['graph', 'gram']], ['logy', ['log', 'gy']],
  ]],
];

/** [{ key: 'P13', section: 'Prefix', n: 13, label: 'de-', ids: ['de'] }, …] in book order. */
export const MM_LESSONS = SECTIONS.flatMap(([k, section, list]) => list.map(([label, ids], i) => ({ key: `${k}${i + 1}`, section, n: i + 1, label, ids })));

const BY_ID = new Map();
MM_LESSONS.forEach((l) => l.ids.forEach((id) => BY_ID.set(id, l.key)));

/** The Morpheme Magic lesson key for a morpheme id, or 'X' if the book doesn't teach it. */
export const mmKey = (id) => BY_ID.get(id) || 'X';
export const mmLesson = (key) => MM_LESSONS.find((l) => l.key === key) || null;
/** "Prefix 13 · de-" */
export const mmName = (key) => { const l = mmLesson(key); return l ? `${l.section} ${l.n} · ${l.label}` : 'Other morphemes'; };
/** Sort order for keys: book order, X last. */
export const mmOrder = (key) => { const i = MM_LESSONS.findIndex((l) => l.key === key); return i < 0 ? 999 : i; };

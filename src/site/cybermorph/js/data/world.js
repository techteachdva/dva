/**
 * Everything that is not one district: the hub, the Secret Secretary Desk keywords,
 * the finale word pools, avatar parts, the dictionary and the Inspirations list.
 */

import { ANGLO } from './anglo.js';
import { LATIN } from './latin.js';
import { GREEK } from './greek.js';
import { LINGO } from './lingo.js';
import { build } from '../compiler/wordsum.js';
import { MORPHEMES } from './morphemes.js';

export const DISTRICTS = { anglo: ANGLO, latin: LATIN, greek: GREEK, lingo: LINGO };
export const MAIN_ORDER = ['anglo', 'latin', 'greek'];

/**
 * The hub (the Core).
 *   L  Lexicon Tree (center)       1 2 3  district ports      4  finale port
 *   D  Secret Secretary Desk       A  avatar booth            O  Overclock Mode arcade cabinet
 *   X  free Morph Compiler console @  arrival                 o  props
 */
export const HUB_MAP = [
  '#####1######',
  '#o........o#',
  '#.X.....D..#',
  '#..........#',
  '2@...L.....3',
  '#..........#',
  '#.A......O.#',
  '#o........o#',
  '#####4######',
];

/**
 * Secret Secretary Desk keywords: one is drawn for each new save.
 * The Anglo-Saxon District reveals the prefix, Latin the base, Greek the suffix.
 * Each clue asks the player to find the shared morpheme in three words.
 */
export const KEY_POOL = [
  { p: ['re', 'act', 'ion'], clue: [['rewind', 'replay', 'return'], ['actor', 'active', 'react'], ['action', 'construction', 'interruption']] },
  { p: ['dis', 'rupt', 'ive'], clue: [['disagree', 'dislike', 'disconnect'], ['erupt', 'interrupt', 'rupture'], ['active', 'creative', 'expensive']] },
  { p: ['pre', 'dict', 'able'], clue: [['preview', 'prefix', 'prepay'], ['dictate', 'verdict', 'contradict'], ['readable', 'washable', 'breakable']] },
  { p: ['trans', 'port', 'er'], clue: [['transfer', 'transform', 'transmit'], ['portable', 'export', 'import'], ['player', 'teacher', 'singer']] },
  { p: ['in2', 'script', 'ion'], clue: [['inside', 'input', 'inhale'], ['manuscript', 'transcript', 'scripture'], ['action', 'election', 'connection']] },
  { p: ['bene', 'fic', 'ial'], clue: [['benefit', 'benevolent', 'benefactor'], ['efficient', 'sufficient', 'artificial'], ['official', 'artificial', 'essential']] },
  { p: ['con', 'struct', 'ion'], clue: [['connect', 'contain', 'concert'], ['structure', 'destruct', 'instruct'], ['action', 'election', 'connection']] },
  { p: ['ex', 'tract', 'or'], clue: [['exit', 'export', 'exhale'], ['tractor', 'attract', 'subtract'], ['actor', 'inventor', 'editor']] },
  { p: ['inter', 'act', 'ive'], clue: [['internet', 'interview', 'international'], ['actor', 'active', 'react'], ['active', 'creative', 'expensive']] },
  { p: ['sub', 'mit', 'ed'], clue: [['submarine', 'subway', 'subtract'], ['transmit', 'admit', 'permit'], ['jumped', 'played', 'kicked']] },
  { p: ['de', 'form', 'ed'], clue: [['defrost', 'decode', 'deflate'], ['format', 'transform', 'uniform'], ['jumped', 'played', 'kicked']] },
  { p: ['re', 'ject', 'ion'], clue: [['rewind', 'replay', 'return'], ['eject', 'inject', 'project'], ['action', 'election', 'connection']] },
];

export const SLOT_NAMES = ['prefix', 'base', 'suffix'];

/** The finale: one boss word per origin, in this order, picked at random from each pool. */
export const FINALE_POOLS = [
  {
    origin: 'anglo',
    label: 'Anglo-Saxon',
    words: [
      ['un', 'help', 'ful', 'ness'],
      ['un', 'friend', 'ly', 'ness'],
      ['care', 'less', 'ness'],
      ['over', 'whelm', 'ing'],
      ['mis', 'under', 'stand', 'ing'],
      ['fear', 'less', 'ness'],
    ],
  },
  {
    origin: 'latin',
    label: 'Latin',
    words: [
      ['in', 'de', 'struct', 'ible'],
      ['re', 'con', 'struct', 'ion'],
      ['trans', 'port', 'ation'],
      ['contra', 'dict', 'ion'],
      ['inter', 'rupt', 'ion'],
    ],
  },
  {
    origin: 'greek',
    label: 'Greek',
    words: [
      ['tris', 'kai', 'deka', 'phob', 'ia'],
      ['auto', 'bio', 'graph', 'gy'],
      ['micro', 'bio', 'log', 'gy'],
      ['techn', 'o', 'log', 'ic', 'al'],
      ['photo', 'syn', 'the', 'sis'],
      ['chron', 'o', 'log', 'ic', 'al'],
    ],
  },
];

/**
 * Avatar parts. Four of each are open from the start; the rest unlock with progress.
 * pattern: solid | stripes | circuit | checker | glow | dots | camo | chrome
 */
export const AVATAR = {
  limbs: [
    { id: 'l-steel', name: 'Steel', color: '#9aa4b2', pattern: 'solid' },
    { id: 'l-cyan', name: 'Cyan', color: '#28c8f0', pattern: 'solid' },
    { id: 'l-tiger', name: 'Tiger', color: '#ff9d1f', pattern: 'stripes' },
    { id: 'l-grape', name: 'Grape', color: '#8a5cff', pattern: 'dots' },
    { id: 'l-amber', name: 'Amber Glass', color: '#ffb000', pattern: 'glow', unlock: 'anglo' },
    { id: 'l-marble', name: 'Grey Marble', color: '#b9bcc4', pattern: 'camo', unlock: 'latin' },
    { id: 'l-holo', name: 'Holo Blue', color: '#38b6ff', pattern: 'glow', unlock: 'greek' },
    { id: 'l-gold', name: 'Desk Gold', color: '#e6b84a', pattern: 'chrome', unlock: 'desk' },
    { id: 'l-paper', name: 'Lined Paper', color: '#f4f4ef', pattern: 'stripes', unlock: 'lingo' },
    { id: 'l-rot', name: 'Rot Slayer', color: '#7dff3a', pattern: 'circuit', unlock: 'finale' },
  ],
  torso: [
    { id: 't-white', name: 'Lab White', color: '#e9edf2', pattern: 'solid' },
    { id: 't-red', name: 'Arcade Red', color: '#ff3b5c', pattern: 'solid' },
    { id: 't-circuit', name: 'Circuit', color: '#1fd17a', pattern: 'circuit' },
    { id: 't-check', name: 'Checker', color: '#ffd23f', pattern: 'checker' },
    { id: 't-amber', name: 'Amber Glass', color: '#ffb000', pattern: 'glow', unlock: 'anglo' },
    { id: 't-marble', name: 'Grey Marble', color: '#b9bcc4', pattern: 'camo', unlock: 'latin' },
    { id: 't-holo', name: 'Holo Blue', color: '#38b6ff', pattern: 'circuit', unlock: 'greek' },
    { id: 't-gold', name: 'Desk Gold', color: '#e6b84a', pattern: 'chrome', unlock: 'desk' },
    { id: 't-paper', name: 'Lined Paper', color: '#f4f4ef', pattern: 'stripes', unlock: 'lingo' },
    { id: 't-rot', name: 'Rot Slayer', color: '#7dff3a', pattern: 'glow', unlock: 'finale' },
  ],
  head: [
    { id: 'h-steel', name: 'Steel', color: '#9aa4b2', pattern: 'solid' },
    { id: 'h-pink', name: 'Neon Pink', color: '#ff4fd8', pattern: 'solid' },
    { id: 'h-navy', name: 'Navy', color: '#2c3e8f', pattern: 'dots' },
    { id: 'h-lime', name: 'Lime', color: '#a6ff4d', pattern: 'stripes' },
    { id: 'h-amber', name: 'Amber Glass', color: '#ffb000', pattern: 'glow', unlock: 'anglo' },
    { id: 'h-marble', name: 'Grey Marble', color: '#b9bcc4', pattern: 'camo', unlock: 'latin' },
    { id: 'h-holo', name: 'Holo Blue', color: '#38b6ff', pattern: 'glow', unlock: 'greek' },
    { id: 'h-gold', name: 'Desk Gold', color: '#e6b84a', pattern: 'chrome', unlock: 'desk' },
    { id: 'h-paper', name: 'Lined Paper', color: '#f4f4ef', pattern: 'stripes', unlock: 'lingo' },
    { id: 'h-rot', name: 'Rot Slayer', color: '#7dff3a', pattern: 'circuit', unlock: 'finale' },
  ],
  face: [
    { id: 'f-smile', name: 'Smile', color: '#5cf2ff', pattern: 'smile' },
    { id: 'f-visor', name: 'Visor', color: '#ff4fd8', pattern: 'visor' },
    { id: 'f-pixel', name: 'Pixel', color: '#a6ff4d', pattern: 'pixel' },
    { id: 'f-cat', name: 'Cat', color: '#ffd23f', pattern: 'cat' },
    { id: 'f-shades', name: 'Shades', color: '#ffb000', pattern: 'shades', unlock: 'anglo' },
    { id: 'f-stars', name: 'Star Eyes', color: '#38b6ff', pattern: 'stars', unlock: 'latin' },
    { id: 'f-heart', name: 'Heart Eyes', color: '#ff5c8a', pattern: 'hearts', unlock: 'greek' },
    { id: 'f-mono', name: 'Monocle', color: '#e6b84a', pattern: 'mono', unlock: 'desk' },
    { id: 'f-glasses', name: 'Teacher Specs', color: '#f4f4ef', pattern: 'glasses', unlock: 'lingo' },
    { id: 'f-glitch', name: 'Glitch', color: '#7dff3a', pattern: 'glitch', unlock: 'finale' },
  ],
};

export const AVATAR_CATEGORIES = [
  { key: 'limbs', label: 'Arms & Legs' },
  { key: 'torso', label: 'Torso' },
  { key: 'head', label: 'Head' },
  { key: 'face', label: 'Face' },
];

export const UNLOCK_LABEL = {
  anglo: 'Clear the Anglo-Saxon District',
  latin: 'Clear the Latin District',
  greek: 'Clear the Greek District',
  desk: 'Open the Secret Secretary Desk',
  lingo: 'Finish the Lingo District',
  finale: 'Defeat the Rot',
};

/** Every real word CyberMorph knows. Built words not in here become Made-up Words. */
function collectWords() {
  const set = new Set();
  const addIds = (ids) => { try { set.add(build(ids).word); } catch { /* audit reports bad ids */ } };
  for (const d of Object.values(DISTRICTS)) {
    (d.extraWords || []).forEach((w) => set.add(w));
    for (const b of d.mentorFlow.batches) if (b.kind !== 'unpack') b.tasks.forEach((t) => addIds(t.p));
    for (const r of d.rooms) {
      (r.rotlings || []).forEach((t) => addIds(t.p));
      if (r.terminal) r.terminal.tasks.forEach((t) => addIds(t.p));
      if (r.core && r.core.kind !== 'unpack') r.core.tasks.forEach((t) => addIds(t.p));
      if (r.gate) r.gate.tasks.forEach((t) => { if (t.fixed) addIds([...t.fixed, ...t.ring[t.a]]); });
      if (r.link) { r.link.bases.forEach((b) => b.words.forEach((w) => set.add(w))); }
      if (r.newword) set.add(r.newword.w);
    }
  }
  FINALE_POOLS.forEach((pool) => pool.words.forEach(addIds));
  KEY_POOL.forEach((k) => addIds(k.p));
  // Free bases are words on their own (help, port, phone); bound ones (rupt, struct) are not.
  Object.values(MORPHEMES).filter((m) => m.type === 'base' && m.origin === 'anglo').forEach((m) => set.add(m.text));
  ['port', 'act', 'form', 'mobile', 'script', 'photo', 'graph', 'phone', 'meter', 'scope', 'log', 'tele', 'auto', 'demo', 'micro'].forEach((w) => set.add(w));
  return set;
}

export const DICTIONARY = collectWords();

/**
 * Words with their parts, for review Rotlings in the hub and for Overclock Mode.
 * Only real words built from morpheme ids (no Lingo phrases).
 */
export function collectPartWords() {
  const out = [];
  const seen = new Set();
  const push = (ids, origin) => {
    const w = build(ids).word;
    if (seen.has(w) || ids.length < 2) return;
    seen.add(w);
    out.push({ ids, word: w, origin });
  };
  for (const id of MAIN_ORDER) {
    const d = DISTRICTS[id];
    for (const b of d.mentorFlow.batches) b.tasks.forEach((t) => push(t.p, id));
    for (const r of d.rooms) {
      (r.rotlings || []).filter((t) => !t.fake).forEach((t) => push(t.p, id));
      if (r.terminal) r.terminal.tasks.forEach((t) => push(t.p, id));
      if (r.core) r.core.tasks.forEach((t) => push(t.p, id));
    }
  }
  return out;
}

/** Fake words for Overclock Mode, drawn from every district's fake Rotlings. */
export function collectFakes() {
  const out = [];
  for (const id of MAIN_ORDER) {
    for (const r of DISTRICTS[id].rooms) (r.rotlings || []).filter((t) => t.fake).forEach((t) => out.push({ ...t, origin: id }));
  }
  return out;
}

export const INSPIRATIONS = [
  { group: 'Programs and tools', items: [
    { t: '95 Percent Group, Morpheme Magic (3rd ed.), Deb Glaser', u: 'https://www.95percentgroup.com/products/morpheme-magic/' },
    { t: 'Structured Word Inquiry: word sums and word matrices (Peter Bowers)', u: 'https://en.wikipedia.org/wiki/Structured_word_inquiry' },
    { t: 'Neil Ramsden, Word Microscope and Mini Matrix-Maker', u: 'https://neilramsden.co.uk/spelling/matrix' },
    { t: 'Vanderbilt Word Detectives and Monster, P.I. (Amanda Goodwin)', u: 'https://my.vanderbilt.edu/worddetectives/' },
    { t: 'Word Explorer, Stanford Learning Design and Technology', u: 'https://ed.stanford.edu/ldt/students/projects/word-explorer-0' },
    { t: 'WordBuild, Dynamic Literacy', u: 'https://cathyduffyreviews.com/homeschool-reviews-core-curricula/spelling-vocabulary/vocabulary-resources/wordbuild-vocabulary-development-system' },
  ] },
  { group: 'Research', items: [
    { t: 'Bowers, Kirby & Deacon (2010). The effects of morphological instruction on literacy skills. Review of Educational Research, 80(2).', u: 'https://journals.sagepub.com/doi/10.3102/0034654309359353' },
    { t: 'Goodwin & Ahn (2010). A meta-analysis of morphological interventions. Annals of Dyslexia.', u: 'https://apps.asha.org/EvidenceMaps/Articles/ArticleSummary/93cb3843-8a27-4b52-887b-32781be13e92' },
    { t: 'Colenbrander et al. (2024). The effects of morphological instruction on literacy outcomes. Educational Psychology Review, 36:119.', u: 'https://link.springer.com/article/10.1007/s10648-024-09953-3' },
    { t: 'Kieffer & Lesaux (2007). Breaking down words to build meaning. The Reading Teacher, 61(2).', u: 'https://www.gse.harvard.edu/news/uk/10/07/making-words-add' },
    { t: 'Marcia Henry, Unlocking Literacy and "Morphemes Matter": the Anglo-Saxon, Latin and Greek layers of English', u: 'https://www.onlinedigeditions.com/article/Morphemes+Matter%3A+A+Framework+for+Instruction/2757855/398575/article.html' },
    { t: 'van der Kleij, Feskens & Eggen (2015). Effects of feedback in a computer-based learning environment. Review of Educational Research.', u: 'https://journals.sagepub.com/doi/10.3102/0034654314564881' },
  ] },
  { group: 'Game design', items: [
    { t: 'Sid Meier: a game is a series of interesting decisions', u: '' },
    { t: 'Will Wright: build the toy before the game', u: '' },
    { t: 'Robyn & Rand Miller: the world explains itself', u: '' },
    { t: 'Engelstein & Shalev, Building Blocks of Tabletop Game Design (2020)', u: '' },
    { t: 'Mr. Phil\'s own Tech Escape and Somnia', u: '/games/' },
  ] },
];

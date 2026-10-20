/**
 * Everything that is not one room: the hub, the Secret Secretary Desk keywords,
 * the finale word pools, avatar parts, the dictionary and the Inspirations list.
 */

import { ANGLO } from './anglo.js';
import { LATIN } from './latin.js';
import { GREEK } from './greek.js';
import { LINGO } from './lingo.js';
import { build } from '../compiler/wordsum.js';
import { MORPHEMES } from './morphemes.js';
import { buildHubMap } from './layout.js';
import { BANK } from './bank.js';

export const DISTRICTS = { anglo: ANGLO, latin: LATIN, greek: GREEK, lingo: LINGO };
export const MAIN_ORDER = ['anglo', 'latin', 'greek'];

/** The Hub: a larger room with the Lexicon Tree at its heart (see layout.js). */
export const HUB_MAP = buildHubMap();

/**
 * Secret Secretary Desk keywords: one is drawn for each new save.
 * The Anglo-Saxon Room reveals the prefix, Latin the base, Greek the suffix.
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
 * Avatar parts. Five of each are open from the start; the rest unlock with achievements
 * (the unlock key names one; see ACHIEVEMENTS).
 * pattern: solid | stripes | circuit | checker | glow | dots | camo | chrome | plaid | sparkle | buttons | leaves
 * Heads can change shape: box (default) | round | tv | prism | d20. Toppers sit on the head.
 * icon: shown on the swatch when the part is a shape or an object rather than a colour.
 */
export const AVATAR = {
  limbs: [
    { id: 'l-steel', name: 'Steel', color: '#9aa4b2', pattern: 'solid' },
    { id: 'l-cyan', name: 'Cyan', color: '#28c8f0', pattern: 'solid' },
    { id: 'l-tiger', name: 'Tiger', color: '#ff9d1f', pattern: 'stripes' },
    { id: 'l-grape', name: 'Grape', color: '#8a5cff', pattern: 'dots' },
    { id: 'l-mint', name: 'Mint', color: '#3ce0a0', pattern: 'solid' },
    { id: 'l-amber', name: 'Amber Glass', color: '#ffb000', pattern: 'glow', unlock: 'anglo' },
    { id: 'l-marble', name: 'Grey Marble', color: '#b9bcc4', pattern: 'camo', unlock: 'latin' },
    { id: 'l-holo', name: 'Holo Blue', color: '#38b6ff', pattern: 'glow', unlock: 'greek' },
    { id: 'l-gold', name: 'Desk Gold', color: '#e6b84a', pattern: 'chrome', unlock: 'desk' },
    { id: 'l-paper', name: 'Lined Paper', color: '#f4f4ef', pattern: 'stripes', unlock: 'lingo' },
    { id: 'l-rot', name: 'Rot Slayer', color: '#7dff3a', pattern: 'circuit', unlock: 'finale' },
    { id: 'l-dice', name: 'Dice Dots', color: '#18a83a', pattern: 'dots', unlock: 'roll10' },
    { id: 'l-rotcamo', name: 'Rot Camo', color: '#5a7a2a', pattern: 'camo', unlock: 'rotreturn' },
    { id: 'l-neon', name: 'Overclocked', color: '#ff3df0', pattern: 'glow', unlock: 'overclock' },
  ],
  torso: [
    { id: 't-white', name: 'Lab White', color: '#e9edf2', pattern: 'solid' },
    { id: 't-red', name: 'Arcade Red', color: '#ff3b5c', pattern: 'solid' },
    { id: 't-circuit', name: 'Circuit', color: '#1fd17a', pattern: 'circuit' },
    { id: 't-check', name: 'Checker', color: '#ffd23f', pattern: 'checker' },
    { id: 't-flannel', name: 'Flannel', color: '#c0392b', pattern: 'plaid' },
    { id: 't-amber', name: 'Amber Glass', color: '#ffb000', pattern: 'glow', unlock: 'anglo' },
    { id: 't-marble', name: 'Grey Marble', color: '#b9bcc4', pattern: 'camo', unlock: 'latin' },
    { id: 't-holo', name: 'Holo Blue', color: '#38b6ff', pattern: 'circuit', unlock: 'greek' },
    { id: 't-gold', name: 'Desk Gold', color: '#e6b84a', pattern: 'chrome', unlock: 'desk' },
    { id: 't-paper', name: 'Lined Paper', color: '#f4f4ef', pattern: 'stripes', unlock: 'lingo' },
    { id: 't-rot', name: 'Rot Slayer', color: '#7dff3a', pattern: 'glow', unlock: 'finale' },
    { id: 't-goldrush', name: 'Gold Rush', color: '#ffc928', pattern: 'sparkle', unlock: 'golden' },
    { id: 't-leafy', name: 'Word Forest', color: '#3ccf6a', pattern: 'leaves', unlock: 'lexicon150' },
    { id: 't-buttondown', name: 'Mr. Phil\'s Shirt', color: '#6f9fd8', pattern: 'buttons', unlock: 'curious' },
  ],
  head: [
    { id: 'h-steel', name: 'Steel', color: '#9aa4b2', pattern: 'solid' },
    { id: 'h-pink', name: 'Neon Pink', color: '#ff4fd8', pattern: 'solid' },
    { id: 'h-navy', name: 'Navy', color: '#2c3e8f', pattern: 'dots' },
    { id: 'h-lime', name: 'Lime', color: '#a6ff4d', pattern: 'stripes' },
    { id: 'h-round', name: 'Round Bot', color: '#9fd8ff', pattern: 'solid', shape: 'round', icon: '●' },
    { id: 'h-amber', name: 'Amber Glass', color: '#ffb000', pattern: 'glow', unlock: 'anglo' },
    { id: 'h-marble', name: 'Grey Marble', color: '#b9bcc4', pattern: 'camo', unlock: 'latin' },
    { id: 'h-holo', name: 'Holo Blue', color: '#38b6ff', pattern: 'glow', unlock: 'greek' },
    { id: 'h-gold', name: 'Desk Gold', color: '#e6b84a', pattern: 'chrome', unlock: 'desk' },
    { id: 'h-paper', name: 'Lined Paper', color: '#f4f4ef', pattern: 'stripes', unlock: 'lingo' },
    { id: 'h-rot', name: 'Rot Slayer', color: '#7dff3a', pattern: 'circuit', unlock: 'finale' },
    { id: 'h-d20', name: 'Critical d20', color: '#18a83a', pattern: 'solid', shape: 'd20', icon: '🎲', unlock: 'crit' },
    { id: 'h-tv', name: 'Retro TV', color: '#7a4f2a', pattern: 'solid', shape: 'tv', icon: '📺', unlock: 'firsttry25' },
    { id: 'h-prism', name: 'Prism', color: '#b98cff', pattern: 'glow', shape: 'prism', icon: '◆', unlock: 'learned300' },
  ],
  face: [
    { id: 'f-smile', name: 'Smile', color: '#5cf2ff', pattern: 'smile' },
    { id: 'f-visor', name: 'Visor', color: '#ff4fd8', pattern: 'visor' },
    { id: 'f-pixel', name: 'Pixel', color: '#a6ff4d', pattern: 'pixel' },
    { id: 'f-cat', name: 'Cat', color: '#ffd23f', pattern: 'cat' },
    { id: 'f-sleepy', name: 'Sleepy', color: '#b9a8ff', pattern: 'sleepy' },
    { id: 'f-shades', name: 'Shades', color: '#ffb000', pattern: 'shades', unlock: 'anglo' },
    { id: 'f-stars', name: 'Star Eyes', color: '#38b6ff', pattern: 'stars', unlock: 'latin' },
    { id: 'f-heart', name: 'Heart Eyes', color: '#ff5c8a', pattern: 'hearts', unlock: 'greek' },
    { id: 'f-mono', name: 'Monocle', color: '#e6b84a', pattern: 'mono', unlock: 'desk' },
    { id: 'f-glasses', name: 'Teacher Specs', color: '#f4f4ef', pattern: 'glasses', unlock: 'lingo' },
    { id: 'f-glitch', name: 'Glitch', color: '#7dff3a', pattern: 'glitch', unlock: 'finale' },
    { id: 'f-oof', name: 'Oof', color: '#ff8f6b', pattern: 'dizzy', unlock: 'nat1' },
    { id: 'f-laser', name: 'Laser Eyes', color: '#ff2a3a', pattern: 'laser', unlock: 'streak5' },
    { id: 'f-wink', name: 'Wink', color: '#7fe0ff', pattern: 'wink', unlock: 'curious' },
    { id: 'f-beard', name: 'Teacher Beard', color: '#c89a6a', pattern: 'beard', unlock: 'mrphil' },
    { id: 'f-static', name: 'Static', color: '#d9dce6', pattern: 'static', unlock: 'crash' },
  ],
  top: [
    { id: 'p-antenna', name: 'Antenna', icon: '📶', color: '#888899' },
    { id: 'p-propeller', name: 'Propeller', icon: '🌀', color: '#ff3b5c' },
    { id: 'p-cap', name: 'Ball Cap', icon: '🧢', color: '#2f6fde' },
    { id: 'p-bow', name: 'Bow', icon: '🎀', color: '#ff5c8a' },
    { id: 'p-none', name: 'Nothing', icon: '∅', color: '#555566' },
    { id: 'p-horns', name: 'Horned Helm', icon: '🛡', color: '#c9b58a', unlock: 'anglo' },
    { id: 'p-laurel', name: 'Laurel Wreath', icon: '🌿', color: '#5fbf4a', unlock: 'latin' },
    { id: 'p-dish', name: 'Satellite Dish', icon: '🛰', color: '#dfe8ff', unlock: 'greek' },
    { id: 'p-tophat', name: 'Top Hat', icon: '🎩', color: '#1a1a22', unlock: 'desk' },
    { id: 'p-headphones', name: 'Headphones', icon: '🎧', color: '#2a2f38', unlock: 'lingo' },
    { id: 'p-halo', name: 'Halo', icon: '✨', color: '#ffe680', unlock: 'finale' },
    { id: 'p-crown', name: 'Crown', icon: '👑', color: '#e6b84a', unlock: 'streak10' },
    { id: 'p-bulb', name: 'Bright Idea', icon: '💡', color: '#ffe066', unlock: 'madeup5' },
    { id: 'p-sprout', name: 'Sprout', icon: '🌱', color: '#3ccf6a', unlock: 'lexicon50' },
    { id: 'p-grad', name: 'Grad Cap', icon: '🎓', color: '#1d2b4f', unlock: 'session' },
    { id: 'p-curls', name: 'Wild Curls', icon: '➰', color: '#a47a4f', unlock: 'mrphil' },
  ],
};

export const AVATAR_CATEGORIES = [
  { key: 'limbs', label: 'Arms & Legs' },
  { key: 'torso', label: 'Torso' },
  { key: 'head', label: 'Head' },
  { key: 'face', label: 'Face' },
  { key: 'top', label: 'Topper' },
];

export const DEFAULT_AVATAR = { limbs: 'l-steel', torso: 't-red', head: 'h-steel', face: 'f-smile', top: 'p-antenna' };

/**
 * Achievements: story milestones, skill goals and secrets (easter eggs). Each unlocks the avatar
 * parts whose unlock names its key. A secret shows only its hint until it is earned.
 */
export const ACHIEVEMENTS = [
  { key: 'anglo', name: 'Old Code Restored', how: 'Clear the Anglo-Saxon Room' },
  { key: 'latin', name: 'Memory Restored', how: 'Clear the Latin Room' },
  { key: 'greek', name: 'Star Map Restored', how: 'Clear the Greek Room' },
  { key: 'desk', name: 'Lock Picker', how: 'Open the Secret Secretary Desk' },
  { key: 'lingo', name: 'Lingo Learner', how: 'Finish the Lingo Room' },
  { key: 'finale', name: 'Rot Slayer', how: 'Defeat the Rot' },
  { key: 'golden', name: 'Gold Rush', how: 'DEBUG a golden Rotling' },
  { key: 'streak5', name: 'Clean Streak', how: 'DEBUG 5 Rotlings in a row on the first try' },
  { key: 'streak10', name: 'Unstoppable', how: 'DEBUG 10 Rotlings in a row on the first try' },
  { key: 'rotreturn', name: 'Rot Return', how: 'Clear a Rot Return wave in a room you already restored' },
  { key: 'firsttry25', name: 'Sharp Eye', how: 'Get 25 tasks right on the first try' },
  { key: 'lexicon50', name: 'Growing Tree', how: 'Grow your Lexicon to 50 words' },
  { key: 'lexicon150', name: 'Word Forest', how: 'Grow your Lexicon to 150 words' },
  { key: 'learned300', name: 'Morpheme Master', how: 'Learn 300 morphemes' },
  { key: 'madeup5', name: 'Word Inventor', how: 'Save 5 Made-up Words at the Morph Compiler' },
  { key: 'overclock', name: 'Overclocked', how: 'Score 1,000 or more in Overclock Mode' },
  { key: 'session', name: 'Class Dismissed', how: 'Finish a class session and get your exit ticket' },
  { key: 'curious', name: 'Curious Morpher', how: 'Inspect 12 different morpheme props in the rooms' },
  { key: 'crit', name: 'Critical Hit', how: 'Roll a natural 20 on Mr. Phil\'s d20', secret: true, hint: 'Somewhere secret, a big green die is waiting to be rolled.' },
  { key: 'nat1', name: 'Natural 1', how: 'Roll a natural 1 on Mr. Phil\'s d20', secret: true, hint: 'Not every roll goes your way. That is part of the fun.' },
  { key: 'roll10', name: 'Dice Goblin', how: 'Roll Mr. Phil\'s d20 10 times', secret: true, hint: 'Some objects are worth clicking more than once.' },
  { key: 'mrphil', name: 'Teacher\'s Pet', how: 'Hear everything Mr. Phil has to say', secret: true, hint: 'A certain teacher always has one more thing to tell you.' },
  { key: 'crash', name: 'Rebooted', how: 'Get crashed by the Rot (it happens to everyone)', secret: true, hint: 'Sometimes losing unlocks something too.' },
];

export const UNLOCK_LABEL = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a.secret ? `Secret: ${a.hint}` : a.how]));
export const achievement = (key) => ACHIEVEMENTS.find((a) => a.key === key) || null;
/** The avatar parts an achievement unlocks, as [{ cat, part }]. */
export const rewardsOf = (key) => Object.entries(AVATAR).flatMap(([cat, list]) => list.filter((p) => p.unlock === key).map((part) => ({ cat, part })));

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
  BANK.forEach((b) => set.add(b.word));
  KEY_POOL.forEach((k) => addIds(k.p));
  // Free bases are words on their own (help, port, phone); bound ones (rupt, struct) are not.
  Object.values(MORPHEMES).filter((m) => m.type === 'base' && m.origin === 'anglo').forEach((m) => set.add(m.text));
  ['port', 'act', 'form', 'mobile', 'script', 'photo', 'graph', 'phone', 'meter', 'scope', 'log', 'tele', 'auto', 'demo', 'micro'].forEach((w) => set.add(w));
  return set;
}

export const DICTIONARY = collectWords();

/**
 * Words with their parts, for Rotling waves, review Rotlings in the Hub and Overclock Mode:
 * every authored task plus the word bank. Only real words built from morpheme ids (no Lingo phrases).
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
  BANK.forEach((b) => push(b.ids, b.origin));
  return out;
}

/** Fake words for Overclock Mode, drawn from every room's fake Rotlings. */
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

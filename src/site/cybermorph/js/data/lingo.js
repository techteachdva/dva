/**
 * The Lingo Room — Mr. Phil's computer science classroom, behind the Secret Secretary Desk.
 *
 * Lingo words are taught as UNPACK tasks: the player compiles the source pieces on the
 * Morph Compiler, then watches how speech reshaped them (fixing to → fixin' to → fixna → finna).
 *
 * Every card names where the word comes from. Dialects have rules; slang is English
 * doing what English has always done. A teacher should review this list for their school.
 */

import { buildRoomMap } from './layout.js';

/**
 * The classroom layout. Zone 0 is Mr. Phil's teacher corner: the green-screen wall,
 * the Chromebook cart with the desktop, and the d20 on the floor. Past the lab door is
 * the class: the Smart Board on the far wall (it is the room core), long desks in a
 * triangle pointing at it, and two 3D printers on the back wall.
 */
const DESK_ANCHOR = [15, 8];
const DESK_CORNERS = [[15, 4], [11, 10], [19, 10]]; // the first corner points at the Smart Board

/** Every tile a straight desk passes over, so nobody walks through the furniture. */
function deskTiles() {
  const out = new Map();
  for (let i = 0; i < 3; i++) {
    const [a, b] = [DESK_CORNERS[i], DESK_CORNERS[(i + 1) % 3]];
    const steps = 24;
    for (let k = 0; k <= steps; k++) {
      const c = Math.round(a[0] + ((b[0] - a[0]) * k) / steps);
      const r = Math.round(a[1] + ((b[1] - a[1]) * k) / steps);
      out.set(`${c},${r}`, [c, r, 'x']);
    }
  }
  return [...out.values()];
}

export const LINGO = {
  id: 'lingo',
  name: 'The Lingo Room',
  short: 'Lingo',
  origin: 'lingo',
  keySlot: -1,
  rotMeter: false,
  mentor: {
    id: 'phil',
    name: 'Mr. Phil',
    role: 'computer science teacher',
  },
  // One big room. Zone 0: Mr. Phil's teacher corner. Zone 1: the class (Rotlings, LINK, Unknown File, the Smart Board core).
  map: buildRoomMap([
    [4, 4, 'M'], [1, 1, 'P'], [6, 12, 'a'],
    [15, 1, 'C'], [13, 1, 'x'], [14, 1, 'x'], [16, 1, 'x'], [17, 1, 'x'],
    [DESK_ANCHOR[0], DESK_ANCHOR[1], 'Y'], ...deskTiles(),
    [13, 12, 'Q'], [17, 12, 'Q'],
    [10, 2, 'N'], [21, 12, 'W'],
    [10, 5, 'R'], [10, 9, 'R'], [12, 3, 'R'], [18, 3, 'R'], [20, 6, 'R'], [20, 11, 'R'],
    [22, 4, 'b'], [22, 1, 'c'], [22, 9, 'd'], [10, 12, 'e'], [19, 1, 'f'],
  ], { chasm: false, secondGate: false }),
  /** Wall paint: the north wall of the teacher corner is green-screen green. */
  paint: [{ c0: 0, c1: 8, r0: 0, r1: 0, color: 0x00b140 }],
  desks: { anchor: DESK_ANCHOR, corners: DESK_CORNERS },
  /** The d20 lives in the teacher corner (tiles 1–7 across, 1–12 down) and starts here. */
  d20: { c0: 1, c1: 7, r0: 1, r1: 12, start: [5, 9] },
  props: {
    P: { word: 'Chromebook cart', note: 'Chrome + book, a compound. The desktop on top draws a fractal: fract (Latin, to break) + -al, the same root as fraction and fracture.', model: 'cart', rot: Math.PI / 4 },
    Q: { word: '3D printer', note: 'print + -er: a machine that prints. Mr. Phil\'s printers are mostly making keychains.', model: 'printer3d', rot: Math.PI },
    a: { word: 'backpack', note: 'back + pack: a compound you carry every day', model: 'backpack' },
    b: { word: 'G.O.A.T. trophy', note: 'goated = G.O.A.T. (Greatest Of All Time) + -ed', model: 'trophy' },
    c: { word: 'vibe lamp', note: 'vibe: clipped from vibration', model: 'lavalamp' },
    d: { word: 'brunch tray', note: 'brunch = br(eakfast) + (l)unch, a blend', model: 'tray' },
    e: { word: 'no-cap hat hook', note: 'no cap = no lie (AAVE): the cap stays on the hook', model: 'caphook' },
    f: { word: 'glow-up mirror', note: 'glow + up: a big change for the better', model: 'mirror' },
  },

  mentorFlow: {
    intro: [
      'Oh hey! Welcome to my digital classroom! It\'s a work in progress, but it\'ll do for now.',
      'I hope you\'ve been enjoying the game so far! I hope it\'s been fun learning words and their meanings and connections.',
      'But there is one last important connection I want you to make. LINGO. SLANG. NON-ACADEMIC ENGLISH.',
      'There is a whole world out there of meaning, and we are making it every day whenever we communicate. I think it\'s a lot like magic.',
      'If you know a magic morpheme, it unlocks doors to worlds of words you never dreamed of. And we\'re unlocking worlds of meaning all the time!',
      'Even when you\'re about to be cooked because the goated teacher Mr. Phil caught you playing Granny again instead of doing the Worky Work.',
      'There are sus morphemes and there are fam morphemes. There are words within words. And the cool part is you already know a ton of them!',
      'Let\'s explore Lingo together!',
      'Take "finna". It comes from AAVE, and you\'ll hear it in Southern US English too. It started as "fixing to": fix + -ing + to. People said it so often that it wore down into one smooth word.',
      'Linguists call one form that carries several morphemes a portmanteau morph. Every dialect has rules, and so does slang. It isn\'t "wrong English". It\'s English doing what English has always done: reshaping morphemes.',
      'Here\'s how this works: I show you the word, you compile the pieces it came from, and then we watch it change.',
    ],
    batches: [
      {
        kind: 'unpack',
        say: ['Reductions and contractions: pieces wear down in fast speech until they blend together.'],
        tasks: [
          { w: 'finna', p: ['fix', 'ing', 'to'], chain: ['fixing to', 'fixin\' to', 'fixna', 'finna'], kind: 'Reduction (a portmanteau morph)', from: 'AAVE and Southern US English', means: 'about to', link: 'That -ing is the same suffix as in running and building.' },
          { w: 'gonna', p: ['go', 'ing', 'to'], chain: ['going to', 'goin\' to', 'gonna'], kind: 'Reduction', from: 'Everyday English, almost everywhere', means: 'going to; will', link: 'Same -ing as in playing. Same "to" as in want to.' },
          { w: 'wanna', p: ['want', 'to'], chain: ['want to', 'wanta', 'wanna'], kind: 'Reduction', from: 'Everyday English', means: 'want to', link: 'Two free morphemes squeezed into one sound.' },
          { w: 'aight', p: ['all', 'right'], chain: ['all right', 'alright', 'aight'], kind: 'Reduction', from: 'AAVE, now widely used', means: 'okay; fine', link: 'Even "alright" was once two words. Speech keeps squeezing.' },
          { w: '\'sup', p: ['what', 'is', 'up'], chain: ['what is up', 'what\'s up', 'wassup', '\'sup'], kind: 'Contraction, then reduction', from: 'Everyday English slang', means: 'hello; what is happening?', link: 'The apostrophe marks where letters were dropped.' },
          { w: 'y\'all', p: ['you', 'all'], chain: ['you all', 'y\'all'], kind: 'Contraction', from: 'Southern US English and AAVE', means: 'all of you', link: 'English lost its plural "you" (ye) long ago. Y\'all brings it back.' },
          { w: 'let\'s', p: ['let', 'us'], chain: ['let us', 'let\'s'], kind: 'Contraction', from: 'Standard English', means: 'let us (an invitation)', link: 'Contractions are morphemes sharing one word.' },
        ],
      },
      {
        kind: 'unpack',
        say: ['Clippings and blends: chop off part of a word, or melt two words into one.'],
        tasks: [
          { w: 'sus', p: ['suspicious'], chain: ['suspicious', 'sus·picious', 'sus'], kind: 'Clipping', from: 'Internet and gaming slang', means: 'suspicious; seems shady', link: 'Family: suspect, suspicion. The Latin spect means "look": something sus makes you look twice.' },
          { w: 'rizz', p: ['charisma'], chain: ['charisma', 'cha·ris·ma', 'ris', 'rizz'], kind: 'Clipping (from the middle)', from: 'Internet slang', means: 'charm', link: 'Most clippings keep the front (bro). Rizz keeps the middle.' },
          { w: 'bro', p: ['brother'], chain: ['brother', 'bro·ther', 'bro'], kind: 'Clipping', from: 'Everyday English', means: 'brother; a close friend', link: 'Formal family: brotherhood, brotherly.' },
          { w: 'fam', p: ['family'], chain: ['family', 'fam·ily', 'fam'], kind: 'Clipping', from: 'AAVE, now widely used', means: 'family; your people', link: 'Formal family: familiar, families.' },
          { w: 'vibe', p: ['vibration'], chain: ['vibration', 'vib·ration', 'vibe'], kind: 'Clipping', from: '1960s slang, still going', means: 'a feeling or mood', link: 'Formal family: vibrate, vibrant. Latin vibrare, "to shake".' },
          { w: 'frenemy', p: ['friend', 'enemy'], chain: ['friend + enemy', 'fren(d) + (e)nemy', 'frenemy'], kind: 'Blend', from: 'Everyday English', means: 'a friend who is also a rival', link: 'A blend keeps a piece of each word.' },
          { w: 'brunch', p: ['breakfast', 'lunch'], chain: ['breakfast + lunch', 'br(eakfast) + (l)unch', 'brunch'], kind: 'Blend', from: 'British student slang from the 1890s', means: 'a late-morning meal', link: 'Old slang can become plain English.' },
          { w: 'situationship', p: ['situation', 'relationship'], chain: ['situation + relationship', 'situation + (relation)ship', 'situationship'], kind: 'Blend', from: 'Internet slang', means: 'a close connection with no clear label', link: '-ship is an Anglo-Saxon suffix, the same one as in friendship.' },
        ],
      },
    ],
    done: [
      'Okay, I see you. The door to the computer lab needs a translation. Slang to formal, both directions.',
    ],
    repeat: ['Click the glowing lab door. Translate each sentence.'],
    /** Mr. Phil's small talk when you come back to him. One line per visit, in order. */
    chatter: [
      'Go ahead, roll my d20. It\'s on the floor. Land a natural 20 and you get a CRITICAL HIT. Critical: crit (to judge) + -ic + -al.',
      'The green screen is for my videos. Green: one free morpheme. Screen: one free morpheme. Green screen: a compound.',
      'See the desktop on the Chromebook cart? It\'s drawing a fractal. Fract means "to break". Same root as fraction and fracture.',
      'Chromebooks go back on the cart at the end of class. Plugged in. Every time. I\'m serious.',
      'The desks make a triangle pointing at the Smart Board. Tri- means three. Triangle: three angles. Morphemes are everywhere in here.',
      'The 3D printers in the back? print + -er, a thing that prints. Somebody always wants a keychain.',
      'Worky Work is not a real word. Yet. If enough people use it and understand it, it will be.',
    ],
  },

  rooms: [
    {
      gate: {
        needs: 'mentor',
        lockedMsg: 'The lab door is locked. Finish with Mr. Phil first.',
        say: ['FIREWALL LOCK: translate. Pick the formal words that mean the same thing.'],
        tasks: [
          { s: '"I\'m finna leave."  =  "I\'m ___ leave."', choices: ['about to', 'never going to', 'unable to', 'afraid to'], a: 0, why: 'finna = fixing to = about to.' },
          { s: '"That excuse is sus."  =  "That excuse is ___."', choices: ['successful', 'suspicious', 'sushi', 'super'], a: 1, why: 'sus is clipped from suspicious.' },
          { s: '"No cap, I finished my homework."  =  "___, I finished my homework."', choices: ['No hat', 'No lie', 'No time', 'No way'], a: 1, why: 'In AAVE and hip-hop slang, cap means a lie, so no cap means no lie.' },
        ],
      },
    },
    {
      rotlings: [
        { p: ['un', 'bother', 'ed'] },
        { p: ['ghost', 'ed'] },
        { p: ['cook', 'ed'] },
        { p: ['goat', 'ed'] },
        { p: ['re', 'watch', 'able'] },
        { show: 'watchreable', fake: 'order', p: ['re', 'watch', 'able'], cuts: [5, 7], why: 're- is a prefix, so it goes BEFORE the base: re + watch + able → rewatchable.' },
      ],
      rotlingSay: ['Real word or Rot? Here\'s my rule: if people use a word and understand it, it\'s real. Dictionaries catch up later. Old affixes, new bases: cooked, goated, ghosted, unbothered.'],
      link: {
        say: ['LINK: hang each slang word on its formal family. Watch for words that only look related.'],
        bases: [
          { label: 'sus', words: ['suspicious', 'suspect', 'suspicion'] },
          { label: 'fam', words: ['family', 'familiar', 'families'] },
          { label: 'vibe', words: ['vibration', 'vibrate', 'vibrant'] },
        ],
        ff: [
          { w: 'sushi', looks: 'sus + hi', why: 'sushi is a Japanese word. Its "su" means vinegar, not suspicious.' },
          { w: 'famous', looks: 'fam + ous', why: 'famous comes from fame, not family. Fame (fama) means "what people say about you".' },
        ],
      },
      newword: {
        s: 'I lowkey want to stay home today.',
        w: 'lowkey',
        p: ['low', 'lkey'],
        opts: ['a little; quietly', 'very loudly', 'for a low price'],
        a: 0,
      },
      core: {
        needs: ['link', 'newword', 'rotlings'],
        lockedMsg: 'Finish the Rotlings, the Link Node and the Unknown File console first.',
        kind: 'unpack',
        say: ['SMART BOARD: three phrases to finish the lesson.'],
        tasks: [
          { w: 'crash out', p: ['crash', 'lout'], chain: ['crash (to smash)', 'crash out', 'crash out (to lose control)'], kind: 'Compound with a new meaning', from: 'AAVE, now widely used', means: 'to lose control after being upset', link: 'Two free morphemes. The meaning grew from "smash" to "fall apart".' },
          { w: 'glow-up', p: ['glow', 'lup'], chain: ['glow + up', 'glow up', 'glow-up'], kind: 'Compound', from: 'AAVE and internet slang', means: 'a big change for the better', link: 'Compare: grown-up, warm-up, setup. Verb + up makes a noun.' },
          { w: 'let\'s go!', p: ['let', 'us', 'go'], chain: ['let us go', 'let\'s go', 'let\'s go!'], kind: 'Contraction turned cheer', from: 'Everyday English', means: 'a cheer: we did it!', link: 'Three morphemes, one celebration.' },
          { w: 'ain\'t', p: ['am', 'not'], chain: ['am not', 'amn\'t', 'an\'t', 'ain\'t'], kind: 'Contraction, then reduction', from: 'English dialects for 300+ years', means: 'am not; is not; are not', link: 'Once common in all speech, now informal. Still rule-governed.' },
        ],
        outro: [
          'That\'s the whole Lexinet: Anglo-Saxon, Latin, Greek, and the English you already speak.',
          'Every word you use is built from parts. Every part you know opens a door to a thousand new words.',
          'Lowkey proud of you. No cap. Let\'s go!',
        ],
      },
    },
  ],

  extraCards: [
    { w: 'hey', p: [], kind: 'One free morpheme', from: 'Middle English "hei"', means: 'hello; look here', link: 'Not every word has parts. "hey" is a single free morpheme.' },
    { w: 'bet', p: [], kind: 'An old word with a new meaning', from: 'AAVE', means: 'okay; for sure', link: 'From "you bet". The form stayed, the meaning moved.' },
    { w: 'goated', p: ['goat', 'ed'], kind: 'Acronym + old suffix', from: 'Sports and internet slang', means: 'the greatest; amazing', link: 'G.O.A.T. = Greatest Of All Time. Then the old Anglo-Saxon -ed.' },
    { w: 'cooked', p: ['cook', 'ed'], kind: 'Old word, new meaning', from: 'Internet slang', means: 'in big trouble; doomed', link: 'Same cook + -ed as in "cooked dinner".' },
    { w: 'ghosted', p: ['ghost', 'ed'], kind: 'Noun turned verb + old suffix', from: 'Internet slang', means: 'suddenly stopped answering', link: 'A noun used as a verb: English does this all the time (to email, to text).' },
  ],

  extraWords: [
    'finna', 'gonna', 'wanna', 'gotta', 'aight', 'sup', 'yall', 'lets', 'sus', 'rizz', 'bro', 'fam', 'vibe', 'frenemy', 'brunch', 'situationship',
    'unbothered', 'ghosted', 'cooked', 'goated', 'rewatchable', 'lowkey', 'highkey', 'glowup', 'crashout', 'bet', 'hey', 'aint',
    'fixing to', 'going to', 'want to', 'got to', 'all right', 'what is up', 'you all', 'let us', 'let us go', 'am not',
    'bothered', 'watchable', 'rewatch', 'ghosting', 'cooking', 'cooker', 'unwatched', 'bothering',
  ],
};

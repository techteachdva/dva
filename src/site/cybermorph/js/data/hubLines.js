/**
 * Noam Chomsky, the Hub mentor. The real Noam Chomsky (born 1928) is the linguist behind
 * generative grammar and the idea of a universal grammar: that every child is born ready to
 * learn a language, as if with a "language acquisition device". His sentence "Colorless green
 * ideas sleep furiously" (1957) shows grammar and meaning are separate things. His lines allude
 * to that work and nothing else.
 *
 * Scenes play in the Hub, in this order, each once (game.js, hubStory):
 *   INTRO            first visit; the Anglo-Saxon door unlocks between INTRO and INTRO_AFTER
 *   LAB              back from the first room with morphemes; the Word Lab unlocks
 *   CLEARED[room]    a room was just cleared: Noam on that room's family of words
 *   LATIN, GREEK     the first time the player comes back holding Latin / Greek morphemes
 *   DESK, DESK_AFTER all three rooms cleared; the Secret Secretary Desk clicks open between them
 *   TALK(state)      what he says when you click him
 * "___" is a word the Rot has eaten out of his sentence.
 */

export const INTRO = (name) => [
  ['pleased', 'Hello there, I\'m Noam Chomsky. Who are you?'],
  `${name}? Good to meet you. I\'m a linguist. I\'ve spent my life asking how every child, anywhere, learns a language so fast. My best answer: we\'re born with a grammar already built in.`,
  'I WAS at home doing a crossword puzzle online and somehow I ended up here. I\'m calling this place The Lexinet.',
  ['worried', 'I must have typed a wrong letter somewhere and I got ___ here. Wait... something\'s not right. I can\'t say ___.'],
  ['worried', 'What about ___? What\'s going on!? It looks like something is bugging out here.'],
];

export const INTRO_AFTER = [
  ['pleased', 'Oh! Another room. I\'m going to stay here and see if I can find a universal language acquisition device somewhere.'],
  'You should check it out and see what you can find. Come back here once you find anything.',
];

export const LAB = [
  ['pleased', 'You\'re back, and you\'re carrying pieces of words! Look what I found while you were gone.'],
  'A machine that puts morphemes together. Any of them, in any order the rules allow. Real words go in your Lexicon. New ones become Made-up Words.',
  ['special', 'I once wrote a sentence to make a point: "Colorless green ideas sleep furiously." Perfect grammar. No sense at all. See if you can build words that do better than that.'],
];

export const CLEARED = {
  anglo: [
    'The Anglo-Saxon Room! Those are the oldest words in English: help, kind, child, home. Short words, mostly one beat each.',
    ['special', 'And notice how a little ending like -ful or -less changes the whole job of a word. Children pick those up before they can spell them. That\'s the built-in grammar at work.'],
  ],
  latin: [
    'Every Latin root is home. Port, rupt, struct, dict. Half of a science textbook is built out of those four.',
    ['special', 'Latin words came into English centuries after the Anglo-Saxon ones, mostly through scholars and lawyers. That\'s why "help" sounds friendly and "assistance" sounds like paperwork.'],
  ],
  greek: [
    'Greek gave English its words for studying everything: biology, geology, psychology. Two Greek parts and you have a whole school subject.',
  ],
};

export const LATIN = [
  ['special', '"Carpe Diem." It means Seize the Day, and it\'s Latin. Latin is a fascinating watershed of ideas.'],
  ['pleased', 'Speaking of watering, it looks like the more morphemes you acquire, the more flowers spread in this room. Keep going, let\'s see how beautiful it can get in here.'],
];

export const GREEK = [
  'I bet you already heard of "ology" before today, which means "the study of". I\'ve made a practice of studying many different subjects. I just love learning new language.',
  ['pleased', 'Speaking of speaking, I\'ll let you get back to your knowledge acquisition. You\'re doing great. Keep going, see if you can find a way out of here.'],
];

export const DESK = (name) => [
  ['pleased', `Well done, ${name}. It looks like the three rooms are cleared.`],
];

export const DESK_AFTER = [
  ['worried', 'Huh. That was locked a minute ago, but it sounds like something changed.'],
  'Check it out.',
];

/** What Noam says when clicked, by how far the player has got. */
export function TALK(p, cleared) {
  if (!cleared('anglo')) return ['The Anglo-Saxon door is open. Find whatever is in there and bring it back. I\'ll keep looking for that device.'];
  if (!cleared('latin')) return ['The Latin door is next. I hear Latin roots are hiding in there. Hard to say "hear" without a root, but there you go.'];
  if (!cleared('greek')) return ['The Greek door is open now. Greek parts snap together in pairs. Bio, logy. Photo, graph.'];
  if (!p.deskOpen) return ['That Secret Secretary Desk clicked when the last room cleared. I\'d look there next.'];
  return [['pleased', 'Every room, every root. I\'m still looking for the language acquisition device. Between you and me, I think it was you all along.']];
}

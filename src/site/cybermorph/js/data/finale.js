/**
 * The Final Test: the Rot's three phases and nine beats (js/game/finale/), the giant words that
 * end the fight, the Rot's lines, and the mutations Boss Rush rolls.
 * Only Anglo-Saxon, Latin and Greek: Lingo never enters the fight.
 * Design: research/cybermorph-final-boss-plan.md
 */

export const ACADEMIC = ['anglo', 'latin', 'greek'];

/** Misses a phase can take before the Rot rewrites it. */
export const PIPS = 5;

export const PHASES = [
  { id: 'shell', name: 'THE SHELL', goal: 'Know the pieces', intro: ['You think you know my pieces? Prove it.'] },
  { id: 'swarm', name: 'THE SWARM', goal: 'Know the words', intro: ['Then I will come apart. Every piece of me a lie, or maybe the truth. Can you tell?'] },
  { id: 'true', name: 'THE TRUE FORM', goal: 'Read the unknown', intro: ['Enough. You will face words you have never seen. And then, my true name.'] },
];

/** The nine beats, in order. skill: the column it scores on the Test Results card. */
export const BEATS = [
  { id: 'volley', phase: 0, name: 'Meaning Volley', skill: 'meaning', how: 'Pick each tile\'s meaning before it lands.', taunt: 'Catch my pieces, if you know what they mean.' },
  { id: 'twins', phase: 0, name: 'Twin Roots', skill: 'connect', how: 'Wire each piece to its twin from another language: same meaning, different spelling.', taunt: 'Three languages. One meaning. You will never match them.' },
  { id: 'shape', phase: 0, name: 'Shape Shift', skill: 'suffix', how: 'Turn the ending ring until the word fits the sentence.', taunt: 'I broke your sentences. Mend them, if you can.' },
  { id: 'swarm', phase: 1, name: 'Swarm Debug', skill: 'judge', how: 'Click a Rotling before it reaches you. Split it, then call it.', taunt: 'Real or Rot? You have seconds.' },
  { id: 'spell', phase: 1, name: 'Spell Strike', skill: 'spelling', how: 'Type the word the sum builds. Watch the joints.', taunt: 'Spell it. All of it. No dials to save you.' },
  { id: 'family', phase: 1, name: 'Family Web', skill: 'connect', how: 'Hang each word on the base it carries. Same meaning is not the same family.', taunt: 'Some of these only pretend to be family.' },
  { id: 'forge', phase: 2, name: 'Meaning Forge', skill: 'compose', how: 'Build the word that means this. No recipe.', taunt: 'I will tell you only what it means. Build it yourself.' },
  { id: 'detective', phase: 2, name: 'Word Detective', skill: 'analysis', how: 'A word you have never built. Split it, read it, say what it means.', taunt: 'Words you have never seen. Read them.' },
  { id: 'giant', phase: 2, name: 'The Giant Word', skill: 'analysis', how: 'Cut it, name every piece, say what it means, then rebuild it.', taunt: 'My true name. Say it, and I end.' },
];

/** The Test Results columns. */
export const SKILLS = [
  { id: 'meaning', label: 'Meanings', note: 'what morphemes mean' },
  { id: 'connect', label: 'Connections', note: 'families and twin roots' },
  { id: 'suffix', label: 'Suffix use', note: 'the ending a sentence needs' },
  { id: 'judge', label: 'Real or Rot', note: 'spotting misspelled, made-up and flipped words' },
  { id: 'spelling', label: 'Spelling', note: 'the rules where pieces join' },
  { id: 'compose', label: 'Building', note: 'words from a meaning' },
  { id: 'analysis', label: 'Reading new words', note: 'splitting and reading words you have never seen' },
];

/**
 * The words the Rot's true form can wear. The first run is always Triskaidekaphobia (its pieces are
 * earned in Greek levels 4 to 6); later runs draw from the rest. `wrong` are meanings a student gets
 * by misreading one piece.
 */
export const GIANTS = [
  { p: ['tris', 'kai', 'deka', 'phob', 'ia'], m: 'a fear of the number thirteen', wrong: ['a love of the number thirteen', 'a fear of the number thirty'] },
  { p: ['auto', 'bio', 'graph', 'ic', 'al'], m: 'relating to the story of your own life, written by you', wrong: ['relating to a life story someone else wrote about you', 'relating to drawings of living things'] },
  { p: ['chron', 'o', 'log', 'ic', 'al'], m: 'in the order things happened in time', wrong: ['in order from smallest to largest', 'relating to the study of the stars'] },
  { p: ['psych', 'o', 'log', 'ic', 'al'], m: 'relating to the mind and how it works', wrong: ['relating to the bones and muscles', 'relating to the study of words'] },
  { p: ['phil', 'o', 'soph', 'ic', 'al'], m: 'relating to the love of wisdom and big questions', wrong: ['relating to the fear of knowledge', 'relating to the study of living things'] },
  { p: ['techn', 'o', 'log', 'ic', 'al'], m: 'relating to the use of tools and machines', wrong: ['relating to the study of the earth', 'relating to the art of making speeches'] },
  { p: ['tri', 'gon', 'o', 'metr', 'gy'], m: 'the math of measuring triangles', wrong: ['the study of three-sided buildings', 'measuring how far away the stars are'] },
  { p: ['in', 'de', 'struct', 'ible'], m: 'not able to be destroyed', wrong: ['able to be built again', 'not able to be built'] },
  { p: ['un', 'pre', 'dict', 'able'], m: 'not able to be told before it happens', wrong: ['able to be said out loud', 'not able to be said again'] },
  { p: ['un', 'friend', 'ly', 'ness'], m: 'the state of not being friendly', wrong: ['the state of having many friends', 'in a friendly way'] },
];

/** Boss Rush (and rematches) roll one of these per phase, so a won fight can't be memorized. */
export const MUTATIONS = [
  { id: 'bleached', name: 'BLEACHED', note: 'Tiles lose their origin colors.' },
  { id: 'haste', name: 'HASTE', note: 'Timers run faster.' },
  { id: 'mirror', name: 'MIRROR', note: 'More Rot in every swarm.' },
  { id: 'lean', name: 'LEAN', note: 'One fewer integrity pip this phase.' },
];

export const ROT_LINES = {
  hit: ['Gah!', 'A crack in me…', 'Lucky.', 'You read that? Impossible.', 'Again?!'],
  miss: ['Ha!', 'Wrong.', 'The Rot spreads.', 'Closer to nothing.'],
  rewrite: ['I rewrite myself. Try again, little Morpher.', 'Every word I am, I can be again. Again!'],
  phaseDown: ['Clever. But I have more forms.', 'You only broke my outside.'],
  defeat: ['No… every piece… has meaning…'],
};

/**
 * CyberMorph request audit and meaning rewrite.
 *
 * A request must contain one full sense of every morpheme on its rings (senses are the
 * semicolon-separated chunks of the gloss). Free Anglo-Saxon bases lead with the word itself.
 * When two real words on the same dials share that gloss, the request keeps a modern sense
 * that only the target owns.
 *
 *   node scripts/cybermorph-requests.mjs            print the meaning changes and the problems
 *   node scripts/cybermorph-requests.mjs --apply    rewrite bank.js and matching district tasks
 *   node scripts/cybermorph-requests.mjs --audit    fail (exit 1) on a broken level request
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/site/cybermorph/js');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { morph } = await imp('data/morphemes.js');
const { BANK } = await imp('data/bank.js');
const { build } = await imp('compiler/wordsum.js');
const { LEVELS } = await imp('data/levels.js');
const { DICTIONARY } = await imp('data/world.js');

const APPLY = process.argv.includes('--apply');
const AUDIT = process.argv.includes('--audit');

const STOP = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'to']);
const wordsOf = (s) => String(s).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 2);
export const tokens = (s) => [...new Set(wordsOf(s).filter((w) => !STOP.has(w)))];
const senses = (meaning) => String(meaning).split(';').map((s) => s.replace(/\([^)]*\)/g, '').trim()).filter(Boolean);

const IRREG = {
  child: ['children'], run: ['ran'], sing: ['sang'], write: ['wrote', 'written'],
  see: ['seen', 'saw'], do: ['does', 'did', 'done'], make: ['made'], take: ['taken', 'took'],
};
function inflect(have, need) {
  if (have === need) return true;
  if (IRREG[need] && IRREG[need].includes(have)) return true;
  if (/[^aeiou]e$/.test(need)) {
    const stem = need.slice(0, -1);
    if (have.startsWith(stem) && /^(ing|ed|er|est|d)$/.test(have.slice(stem.length))) return true;
  }
  if (/[^aeiou]y$/.test(need)) {
    const stem = `${need.slice(0, -1)}i`;
    if (have.startsWith(stem) && /^(es|ed|er|est)$/.test(have.slice(stem.length))) return true;
  }
  if (need.length < 2 || !have.startsWith(need)) return false;
  return /^(s|es|ed|ing|er|est|ly|ier|iest|ies)$/.test(have.slice(need.length));
}

/** Content words of one sense. A sense that is only "to" cannot satisfy a request on its own. */
function senseTokens(sense) {
  return wordsOf(sense).filter((w) => !STOP.has(w));
}

export function senseHit(sense, request) {
  const need = senseTokens(sense);
  if (!need.length) return false;
  const have = wordsOf(request);
  return need.every((n) => have.some((h) => inflect(h, n)));
}

export function glossCovered(ids, request) {
  return ids.every((id) => {
    const m = morph(id);
    if (m.type === 'link') return true;
    return senses(m.meaning).some((s) => senseHit(s, request));
  });
}

function pickSense(meaning, hint) {
  const list = senses(meaning);
  let best = list[0];
  let score = -1;
  const hintTok = wordsOf(hint);
  for (const s of list) {
    const sc = senseTokens(s).filter((t) => hintTok.some((h) => inflect(h, t) || inflect(t, h))).length;
    const richer = sc === score && senseTokens(s).join(' ').length > senseTokens(best).join(' ').length;
    if (sc > score || richer) { best = s; score = sc; }
  }
  return { sense: best, score };
}

function agent(text) {
  if (/(s|x|z|ch|sh)$/.test(text)) return `${text}es`;
  if (/[^aeiou]y$/.test(text)) return `${text.slice(0, -1)}ies`;
  return `${text}s`;
}

function bareVerb(phrase) {
  return phrase.replace(/^to /i, '').trim();
}

function gerund(word) {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ying`;
  if (/[^aeiou]e$/.test(word) && !word.endsWith('ee')) return `${word.slice(0, -1)}ing`;
  return `${word}ing`;
}

function participle(word) {
  if (word === 'see') return 'seen';
  if (word === 'do') return 'done';
  if (/[^aeiou]e$/.test(word)) return `${word}d`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
  return `${word}ed`;
}

function glossPhrase(ids, original) {
  const parts = ids.map((id) => {
    const m = morph(id);
    const picked = pickSense(m.meaning, original);
    return { type: m.type, text: m.text, origin: m.origin, sense: picked.sense, score: picked.score };
  }).filter((p) => p.type !== 'link');
  const bit = (p) => (p.origin === 'anglo' && p.type === 'base' ? p.text : p.sense.replace(/^to /i, ''));
  const pfx = parts.filter((p) => p.type === 'pfx');
  const bases = parts.filter((p) => p.type === 'base' || p.type === 'word');
  const sfx = parts.filter((p) => p.type === 'sfx');
  let phrase = bases.map(bit).join(' ');
  for (const p of pfx) {
    const mod = p.sense.replace(/^to /i, '');
    phrase = /^to /i.test(phrase) ? `${phrase} ${mod}` : `${mod} ${phrase}`;
  }
  const head = bases.length ? bit(bases[bases.length - 1]) : phrase;
  for (const s of sfx) {
    const sense = s.sense.replace(/\([^)]*\)/g, '').trim();
    const verb = bareVerb(phrase).split(' ')[0];
    const rest = bareVerb(phrase).split(' ').slice(1).join(' ');
    const tail = rest ? ` ${rest}` : '';
    if (/^one who$/i.test(sense) && sfx.length === 1 && bases.length === 1 && !pfx.length) {
      phrase = `one who ${agent(bases[0].origin === 'anglo' ? head : verb)}`;
    } else if (/^one who$/i.test(sense)) phrase = `one who ${agent(verb)}${tail}`;
    else if (/^a thing that$/i.test(sense)) phrase = `a thing that ${agent(verb)}${tail}`;
    else if (/^the most$/i.test(sense)) phrase = `the most ${head}`;
    else if (/^full of$/i.test(sense)) phrase = `full of ${phrase}`;
    else if (/^without$/i.test(sense)) phrase = `without ${phrase}`;
    else if (/^the state of being$/i.test(sense)) phrase = `the state of being ${phrase}`;
    else if (/^the state of$/i.test(sense)) phrase = `the state of ${gerund(verb)}${tail}`;
    else if (/^in a way$/i.test(sense)) phrase = `in a way ${phrase}`;
    else if (/^happening now$/i.test(sense)) phrase = `${phrase} happening now`;
    else if (/^the act of$/i.test(sense) || /^the result of$/i.test(sense) || /^the study of$/i.test(sense)) {
      phrase = `${sense} ${gerund(verb)}${tail}`;
    }
    else if (/^a place for$/i.test(sense)) phrase = `a place for ${gerund(verb)}${tail}`;
    else if (/^able to be$/i.test(sense)) phrase = `able to be ${participle(verb)}${tail}`;
    else if (/^tending to$/i.test(sense)) phrase = `tending to ${verb}${tail}`;
    else if (/^in the past$/i.test(sense)) phrase = `${phrase} in the past`;
    else if (/^to make$/i.test(sense)) phrase = `to make ${bareVerb(head)}`;
    else if (/^more than one$/i.test(sense)) phrase = `more than one ${head}`;
    else if (/^not$/i.test(sense) || /^not the opposite of$/i.test(sense)) phrase = `not ${phrase}`;
    else phrase = `${sense} ${bareVerb(phrase)}`.trim();
  }
  return { phrase: phrase.replace(/\s+/g, ' ').trim(), weak: parts.filter((p) => p.score === 0 && senses(p.sense).length > 1) };
}

/** Words whose request is authored, not composed. Each one already contains its gloss senses. */
const FINAL = {
  deduct: 'to lead away; to subtract',
  produce: 'to lead forward; to bring into being',
  product: 'to lead forward; something made',
  introduce: 'to lead inward',
  describe: 'to write down about',
  deduce: 'to lead away a conclusion; to infer',
  proscribe: 'to write forward; to forbid',
  defer: 'to carry away; to put off',
  deport: 'to carry away; to send out of a country',
  respect: 'to look back; to look up to',
  prefer: 'to carry before; to like better',
  predict: 'to say before; to say what will happen',
  transfer: 'to carry across',
  report: 'to carry back; to carry news back',
  import: 'to carry into; to carry goods into a country',
  support: 'to carry from under; to help',
  reject: 'to throw back; to refuse',
  conduct: 'to lead together; to lead',
  reduce: 'to lead back; to make smaller',
  education: 'to lead out; the act of leading out of not knowing',
  concept: 'to take together; an idea taken in',
  except: 'to take out; taken out; leaving out',
  interrupt: 'to break between; to break in between someone speaking',
  corrupt: 'to break together; broken by dishonesty',
  extract: 'to pull out',
  contract: 'to pull together; an agreement',
  inspect: 'to look into',
  consist: 'to stand together; to be made of',
  assist: 'to stand toward; to stand by to help',
  persist: 'to stand through; to stand firm through',
  contain: 'to hold together',
  attain: 'to hold toward; to reach; to get hold of',
  pertain: 'to hold completely; to have to do with',
  continent: 'one who holds together; land held together',
  reform: 'to shape again; to form again; to improve',
  deform: 'to shape down; to spoil the shape of',
  conform: 'to shape together; to fit the rules',
  contradict: 'to say against; to say the opposite',
  deceive: 'to take away the truth; to trick',
  receive: 'to take back; to get',
  conceive: 'to take together; to take in an idea',
  supervise: 'to see beyond; to watch over',
  advise: 'to see toward; to help someone see what to do',
  infect: 'to make into sickness; to make sick',
  affect: 'to make toward; to act on',
  apply: 'to fold toward; to put to use',
  imply: 'to fold in; to fold in a hidden meaning',
  visible: 'able to be seen',
  vision: 'the act of seeing',
  mission: 'the act of sending; a task you are sent to do',
  station: 'the act of standing; a place where things stand',
  stature: 'the result of standing; how tall someone stands',
  factory: 'a place for making; a place where things are made',
  factor: 'one that makes; something that makes a result',
  motion: 'the act of moving',
  action: 'the act of doing',
  motor: 'one that moves; a thing that moves',
  actor: 'one who does; one who acts',
  capture: 'the act of seizing; catching hold',
  captive: 'one who has been taken',
  position: 'the act of placing; where something is placed',
  positive: 'placed firmly; sure',
  difference: 'the state of carrying apart; the way things are unlike',
  different: 'one who carries apart; not the same',
  conference: 'the state of bringing together; a meeting to bring ideas together',
  postpone: 'to put after; to delay',
  postscript: 'written after; a note written after (P.S.)',
  transcript: 'written across; a written copy',
  provide: 'to see forward; to supply',
  spectator: 'one who makes a watch; one who watches',
  dictator: 'one who makes a saying; a ruler who says what goes',
  dictionary: 'a place for the result of telling; a book of what words mean',
  photograph: 'light writing; a picture made with light',
  telegraph: 'far writing; a machine that writes messages from far away',
  telescope: 'far looking; a tool to look at things far away',
  autograph: 'self writing; writing your own name yourself',
  telephoto: 'far light; a lens for taking pictures from far away',
  diagram: 'a writing across; a drawing that explains',
  dialogue: 'a talk across; a talk between people',
  monologue: 'a talk by one; a speech by one person',
  monogram: 'one writing; letters joined into one design',
  diameter: 'the measure across; the measure across a circle',
  program: 'a writing forward; a plan written ahead',
  prologue: 'a talk forward; a speech before the story',
  synonym: 'a same name; a word with the same meaning',
  antonym: 'an against name; a word with the opposite meaning',
  homophone: 'a same sound; a word that sounds the same as another',
  homonym: 'a same name; a word spelled or said the same as another',
  antigen: 'an against birth; something the body makes antibodies against',
  geology: 'earth study; the study of the earth',
  ecology: 'house study; the study of living things and their homes',
  geologist: 'one who studies the earth',
  ecologist: 'one who studies living things and their homes',
  economy: 'house management; how a household or country manages money',
  economist: 'one who studies money and trade',
  physics: 'nature study; the study of matter and energy',
  phonics: 'sound study; the study of letter sounds',
  phonic: 'relating to sound',
  graphic: 'relating to writing or drawing',
  graphics: 'writings; pictures and designs made for screens or print',
  astronomy: 'the study of star law; the study of stars and space',
  astronomer: 'one who studies star law; one who studies space',
  cosmic: 'relating to the world; relating to the universe',
  zoology: 'animal study; the study of animals',
  astrology: 'star speech; an old belief that stars shape lives',
  heroism: 'the state of a hero; great bravery',
  cyclist: 'one who rides a circle; one who rides a bicycle',
  cyclic: 'relating to a circle; happening in circles or cycles',
  heroic: 'relating to a hero; brave like a hero',
  anthropology: 'human study; the study of humans',
  pathology: 'disease study; the study of disease',
  pathologist: 'one who studies disease',
  anthropologist: 'one who studies humans',
  cardiology: 'heart study; the study of the heart',
  neurology: 'nerve study; the study of nerves',
  cardiologist: 'a heart doctor',
  neurologist: 'a nerve and brain doctor',
  hypodermic: 'under the skin',
  hypothermia: 'under heat; a condition of having too little body heat',
  hyperthermia: 'over heat; a condition of having too much body heat',
  philosophy: 'love of wisdom',
  morphology: 'shape study; the study of the shapes of words',
  philosopher: 'one who loves wisdom',
  philology: 'love of words; the study of language',
  astrologer: 'one who studies stars; a person who says stars shape lives',
  darkest: 'the most dark',
  brightest: 'the most bright',
  sweetest: 'the most sweet',
  hopeless: 'without hope',
  singer: 'one who sings',
  inject: 'to throw in',
  subject: 'to throw under; a topic placed under study',
  intercept: 'to take between; to catch',
  deceit: 'a taking away; a trick',
  conceit: 'a taking together; too much pride',
  caption: 'the act of taking; words taken with a picture',
  faction: 'the act of making; a group made inside a larger group',
  tenure: 'the act of holding; the time something is held',
  continence: 'the state of holding together; holding oneself back',
  hypothermic: 'relating to too little heat; having too little body heat',
  hyperthermic: 'relating to too much heat; having too much body heat',
};

/** Real words the dials can build that are not already requests. extra:true keeps them off the request slice. */
const ADD = [
  ['anglo', 'darkest', 'dark est', 'the most dark', true],
  ['anglo', 'brightest', 'bright est', 'the most bright', true],
  ['anglo', 'sweetest', 'sweet est', 'the most sweet', true],
  ['latin', 'deduce', 'de duce', 'to lead away a conclusion; to infer', true],
  ['latin', 'proscribe', 'pro scribe', 'to write forward; to forbid', true],
  ['latin', 'defer', 'de fer', 'to carry away; to put off', true],
  ['latin', 'deport', 'de port', 'to carry away; to send out of a country', false],
  ['latin', 'actor', 'act or', 'one who does; one who acts', true],
  ['latin', 'caption', 'capt ion', 'the act of taking; words taken with a picture', true],
  ['latin', 'faction', 'fact ion', 'the act of making; a group made inside a larger group', true],
  ['latin', 'tenure', 'ten ure', 'the act of holding; the time something is held', true],
  ['latin', 'continence', 'con tin ence', 'the state of holding together; holding oneself back', true],
  ['greek', 'philology', 'phil o log gy', 'love of words; the study of language', true],
  ['greek', 'astrologer', 'astro log er', 'one who studies stars; a person who says stars shape lives', true],
  ['greek', 'hypothermic', 'hypo therm ic', 'relating to too little heat; having too little body heat', true],
  ['greek', 'hyperthermic', 'hyper therm ic', 'relating to too much heat; having too much body heat', true],
];

function propose(ids, original, word) {
  if (FINAL[word] && glossCovered(ids, FINAL[word])) return { meaning: FINAL[word], changed: FINAL[word] !== original, weak: [] };
  if (glossCovered(ids, original)) return { meaning: original, changed: false, weak: [] };
  const { phrase, weak } = glossPhrase(ids, original);
  const extra = tokens(original).filter((t) => !tokens(phrase).some((p) => inflect(t, p) || inflect(p, t)));
  const meaning = extra.length ? `${phrase}; ${original}` : phrase;
  return { meaning: glossCovered(ids, meaning) ? meaning : `${phrase}; ${original}`, changed: true, weak, phrase };
}

const byWord = new Map();
for (const b of BANK) {
  let built;
  try { built = build(b.ids).word; } catch { continue; }
  const prop = propose(b.ids, b.meaning, b.word);
  byWord.set(b.word, { ...b, built, ...prop });
}

const targetWords = new Set();
for (const district of Object.keys(LEVELS)) {
  for (const L of LEVELS[district]) {
    for (const r of L.requests) {
      try { targetWords.add(build(r.p).word); } catch { /* skip */ }
    }
  }
}
for (const row of ADD) targetWords.add(row[1]);
const changes = [...byWord.values()].filter((b) => b.changed && targetWords.has(b.word));
const uncovered = changes.filter((b) => !glossCovered(b.ids, b.meaning));

function dialExpand(level) {
  const sample = level.requests[0].p;
  const linkAt = [];
  sample.forEach((id, i) => { if (morph(id).type === 'link') linkAt.push(i); });
  const combos = (dials) => {
    let out = [[]];
    for (const dial of dials) {
      const next = [];
      for (const acc of out) for (const id of dial) next.push([...acc, id]);
      out = next;
    }
    return out;
  };
  return combos(level.dials).map((pick) => {
    const ids = [];
    let d = 0;
    for (let i = 0; i < pick.length + linkAt.length; i++) {
      if (linkAt.includes(i)) ids.push(sample[i]);
      else ids.push(pick[d++]);
    }
    return ids;
  });
}

for (const district of Object.keys(LEVELS)) {
  for (const L of LEVELS[district]) {
    for (const ids of dialExpand(L)) {
      try { targetWords.add(build(ids).word); } catch { /* a joint that does not hold is not a word */ }
    }
  }
}
const dialChanges = [...byWord.values()].filter((b) => b.changed && targetWords.has(b.word));
changes.length = 0;
changes.push(...dialChanges);
uncovered.length = 0;
uncovered.push(...changes.filter((b) => !glossCovered(b.ids, b.meaning)));

function meaningOf(word, ids) {
  return (byWord.get(word) && byWord.get(word).meaning) || (FINAL[word]) || null;
}

const problems = [];
const queue = [];
if (AUDIT || !APPLY) {
  for (const district of Object.keys(LEVELS)) {
    for (const L of LEVELS[district]) {
      const real = [];
      for (const ids of dialExpand(L)) {
        let res;
        try { res = build(ids); } catch { continue; }
        const req = L.requests.find((r) => {
          try { return build(r.p).word === res.word; } catch { return false; }
        });
        const extra = (L.extra || []).find((e) => e.w === res.word);
        const entry = { w: res.word, p: ids, m: meaningOf(res.word, ids) || (req && req.m) || (extra && extra.m) };
        if (DICTIONARY.has(res.word) || byWord.has(res.word)) {
          if (!req && !extra && !byWord.has(res.word)) problems.push(`${L.id}: "${res.word}" is a real word on the dials and is neither a request nor Extra Credit`);
          real.push(entry);
        } else if (!req) queue.push(`${L.id}\t${res.word}\t${ids.map((id) => morph(id).text).join('+')}`);
      }
      for (const r of L.requests) {
        const word = build(r.p).word;
        const text = (byWord.get(word) && byWord.get(word).meaning) || r.m;
        if (!glossCovered(r.p, text)) {
          const miss = r.p.filter((id) => morph(id).type !== 'link' && !senses(morph(id).meaning).some((s) => senseHit(s, text)));
          problems.push(`${L.id}: "${text}" misses ${miss.map((id) => `${morph(id).text}="${morph(id).meaning}"`).join('; ')}`);
        }
        const rivals = real.filter((o) => o.w !== word && glossCovered(o.p, text));
        if (!rivals.length) continue;
        const glossTok = new Set(r.p.flatMap((id) => tokens(morph(id).meaning)));
        const distinctive = tokens(text).filter((t) => !glossTok.has(t));
        const still = rivals.filter((o) => o.m && distinctive.every((t) => tokens(o.m).includes(t)));
        const unnamed = rivals.filter((o) => !o.m);
        if (still.length || (unnamed.length && !distinctive.length)) {
          problems.push(`${L.id}: "${r.m}" also fits ${[...still, ...unnamed].map((o) => o.w).join(', ')}`);
        }
      }
    }
  }
}

if (!APPLY) {
  console.log(`changes ${changes.length}  still uncovered ${uncovered.length}  problems ${problems.length}  unmarked dial strings ${queue.length}`);
  console.log('\n-- changes --');
  changes.slice(0, 80).forEach((b) => console.log(`${b.word}: ${b.meaning}`));
  if (changes.length > 80) console.log(`... ${changes.length - 80} more`);
  if (uncovered.length) {
    console.log('\n-- still uncovered --');
    uncovered.forEach((b) => console.log(`${b.word}: ${b.meaning}`));
  }
  if (problems.length) {
    console.log('\n-- problems (current levels, proposed meanings only where the bank changed) --');
    problems.slice(0, 60).forEach((p) => console.log(p));
    if (problems.length > 60) console.log(`... ${problems.length - 60} more`);
  }
  console.log('\n-- unmarked (not in the dictionary) --');
  queue.forEach((q) => console.log(q));
}

if (AUDIT) {
  if (problems.length || uncovered.length) {
    console.error(`\n${problems.length} request problems, ${uncovered.length} bank words still miss a gloss.`);
    process.exit(1);
  }
  console.log('request audit ok');
}

if (APPLY) {
  const bankPath = path.join(ROOT, 'data/bank.js');
  let src = readFileSync(bankPath, 'utf8');
  const meaningAt = new Map(changes.map((b) => [b.word, b.meaning]));
  src = src.split('\n').map((line) => {
    const parts = line.split('|');
    if (parts.length < 3 || !meaningAt.has(parts[0])) return line;
    const next = [parts[0], parts[1], meaningAt.get(parts[0])];
    if (parts[3]) next.push(parts[3]);
    return next.join('|');
  }).join('\n');
  const have = new Set(BANK.map((b) => b.word));
  const fresh = { anglo: [], latin: [], greek: [] };
  for (const [origin, word, ids, meaning, extra] of ADD) {
    let built;
    try { built = build(ids.split(/\s+/)).word; } catch (e) { console.error('skip', word, e.message); continue; }
    if (built !== word) { console.error(`skip ${word}: joint builds "${built}"`); continue; }
    if (!glossCovered(ids.split(/\s+/), meaning)) console.error(`warn ${word}: meaning does not cover its gloss`);
    if (have.has(word)) {
      if (extra && !src.includes(`\n${word}|`) && !src.includes(`${word}|`)) continue;
      src = src.split('\n').map((line) => {
        if (!line.startsWith(`${word}|`)) return line;
        const parts = line.split('|');
        const m = meaningAt.get(word) || meaning;
        const role = extra ? 'extra' : parts[3];
        return [word, parts[1], m, role].filter((x) => x !== undefined && x !== '').join('|');
      }).join('\n');
      continue;
    }
    fresh[origin].push(`${word}|${ids}|${meaning}${extra ? '|extra' : ''}`);
  }
  for (const [name, lines] of Object.entries(fresh)) {
    if (!lines.length) continue;
    const re = new RegExp(`(const ${name.toUpperCase()} = \`[\\s\\S]*?)(\`;)`);
    src = src.replace(re, (_, body, end) => `${body.replace(/\s*$/, '\n')}${lines.join('\n')}\n${end}`);
  }
  writeFileSync(bankPath, src);

  const taskFiles = ['anglo.js', 'latin.js', 'greek.js'].map((f) => path.join(ROOT, 'data', f));
  for (const file of taskFiles) {
    const before = readFileSync(file, 'utf8');
    const after = before.split('\n').map((line) => {
      const m = line.match(/^(\s*\{\s*m:\s*')((?:\\'|[^'])*)(',\s*p:\s*\[)([^\]]+)(\].*)$/);
      if (!m) return line;
      const ids = m[4].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
      let word;
      try { word = build(ids).word; } catch { return line; }
      const next = meaningAt.get(word);
      if (!next || next === m[2]) return line;
      return `${m[1]}${next.replace(/'/g, "\\'")}${m[3]}${m[4]}${m[5]}`;
    }).join('\n');
    if (after !== before) writeFileSync(file, after);
  }
  console.log(`applied ${meaningAt.size} meaning edits; added ${Object.values(fresh).flat().length} bank words`);
}

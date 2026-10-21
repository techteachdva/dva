/**
 * Minigame families: every morpheme a student earns in 1.4 is won through a short minigame
 * themed on its meaning (levels plan, Fix 3). A family is one minigame template, skinned per
 * morpheme (its word, gloss, color and origin's material).
 *
 * Fields:
 *  - id       key used by FAMILY_OF and the minigame harness
 *  - name     what the level card calls it
 *  - game     the minigame in one line
 *  - rule     how the meaning becomes the rule of play (if you can win without the meaning, it's cut)
 *  - single   true for a single-morpheme family (at most six; each gets its own level)
 *  - subs     sub-groups that re-skin the template (Suffix shop jobs, Everyday base scenes)
 *  - members  morpheme ids, or { sub: [ids] } when the family has subs
 *
 * Lingo morphemes have no family: their words aren't earned pieces.
 * Check coverage with:  node scripts/audit-cybermorph-families.mjs
 */

const LIST = [
  // ── The ten families from Fix 3 ─────────────────────────────────
  {
    id: 'move', name: 'Move it',
    game: 'Move a data packet across a gap.',
    rule: 'The verb is the control: carry = hold and walk (port, fer), throw = aim and release (ject), send = launch to a receiver (mit, miss), pull = tug in rhythm (tract), lead = guide a line of sprites (duct), move = keep a runner going (mot, mobile, kine), hand over = pass it on (liver).',
    members: ['port', 'fer', 'ject', 'mit', 'miss', 'tract', 'duct', 'duc', 'duce', 'mot', 'mobile', 'kine', 'liver'],
  },
  {
    id: 'break', name: 'Break & cut',
    game: 'Hit the wall at its crack before the Rot seals it.',
    rule: 'To break is to burst through: only a hit on the crack opens it. The bank has no sect, frag or tom, so this family is rupt alone and counts as a single.',
    single: true,
    members: ['rupt'],
  },
  {
    id: 'look', name: 'Look & show',
    game: 'Spot the glitch in a scene.',
    rule: 'You win by looking: spect/vis watch for the change, scope zooms in, photo needs a light source to see anything, cover hides the glitch under a sheet you lift.',
    members: ['spect', 'spec', 'spic', 'vis', 'vid', 'vise', 'vide', 'scope', 'photo', 'cover'],
  },
  {
    id: 'say', name: 'Say & write',
    game: 'Echo a beat or trace a line.',
    rule: 'Say-words (dict, log, phon, aud) are played by ear: echo the sound pattern. Write-words (script, graph, gram) are played by hand: trace the line. onym names the thing you traced.',
    members: ['dict', 'dic', 'log', 'logue', 'phone', 'phon', 'aud', 'onym', 'script', 'scrib', 'scribe', 'graph', 'gram'],
  },
  {
    id: 'build', name: 'Build & make',
    game: 'Stack falling blocks into a shape.',
    rule: 'Making is the win: the blocks become the thing only when you put them together (struct builds, fact/fic make, act does, techn is the craft of doing it well).',
    members: ['struct', 'stru', 'fact', 'fac', 'fect', 'fic', 'act', 'techn'],
  },
  {
    id: 'hold', name: 'Hold, take, stand',
    game: 'Catch the pieces and keep a balance.',
    rule: 'ten/tain = keep holding while things pull, cap/cept/ceive = grab what falls, sta/sist = stay upright on a tilting plate, pos/pon/the = set each piece in its place.',
    members: ['ten', 'tent', 'tain', 'tin', 'tinu', 'cap', 'capt', 'ceit', 'ceive', 'cept', 'cip',
      'sta', 'sist', 'stat', 'stit', 'pos', 'pose', 'posit', 'pon', 'pone', 'the'],
  },
  {
    id: 'not', name: 'Not & against',
    game: 'Flip it: the scene shows X, and you invert it.',
    rule: 'Not = turn it to its opposite (lights on → off, tie → untie). de undoes or drops it, mis does it wrongly on purpose, anti/contra/ob push back against an incoming push.',
    members: ['un', 'in', 'non', 'dis', 'de', 'mis', 'anti', 'contra', 'ob'],
  },
  {
    id: 'count', name: 'How many, how big',
    game: 'Sort and count under time.',
    rule: 'The number is the answer: mono = 1, bi = 2, tri/tris = 3, deka = 10, multi/poly = many. micro/mega shrink or grow the target, and meter/metr measure it against a ruler.',
    members: ['mono', 'bi', 'tri', 'tris', 'deka', 'multi', 'poly', 'micro', 'mega', 'meter', 'metr'],
  },
  {
    id: 'where', name: 'Where & when',
    game: 'Place the piece before / under / between / across a moving marker.',
    rule: 'The position is the answer: sub/under/hypo below, super/over/hyper above, inter/mid between, trans/dia/per across or through, ex/e/out outside, in2/intro inside, ad/pro toward and forward, tele far off. When-words (pre, fore, post, chron) place it on a timeline instead.',
    members: ['over', 'under', 'out', 'mid', 'fore', 'in2', 'intro', 'inter', 'sub', 'super', 'trans', 'per', 'dia',
      'ex', 'e', 'ad', 'pro', 'pre', 'post', 'hyper', 'hypo', 'tele', 'chron'],
  },
  {
    id: 'suffix', name: 'Suffix shop',
    game: 'A conveyor belt: words roll in, and you stamp them into the right job.',
    rule: 'The job is the answer: thing / describer / how / person / verb / ending. -less removes, -ful fills, -s copies the item, -ed slides it into the past.',
    subs: {
      thing: 'thing-makers (makes a noun)',
      describer: 'describers (makes an adjective)',
      how: 'how (makes an adverb)',
      person: 'person (one who)',
      verb: 'verb-makers (to make; to become)',
      ending: 'plural, tense and most',
    },
    members: {
      thing: ['ness', 'ship', 'hood', 'dom', 'ion', 'ation', 'ment', 'ure', 'ity', 'yn', 'ence', 'ance', 'ute',
        'gy', 'ia', 'sis', 'ism', 'ics'],
      describer: ['ful', 'less', 'y', 'ish', 'some', 'able', 'ible', 'ble', 'ive', 'ous', 'al', 'ial', 'ic', 'tic',
        'ary', 'ory', 'ile', 'ite'],
      how: ['ly', 'ward'],
      person: ['er', 'or', 'ist', 'ant', 'ent'],
      verb: ['en', 'ate', 'ize'],
      ending: ['s', 'es', 'ed', 'ing', 'est'],
    },
  },

  // ── Everyday base: Anglo-Saxon free bases students already know ───
  {
    id: 'everyday', name: 'Everyday base',
    game: 'A 5-second catch: grab the word as its picture flies by.',
    rule: 'Catch the picture that matches the word. Each sub is its own scene (sky, toybox, playground…), so no two levels look the same.',
    subs: {
      nature: 'sky, land and sea',
      place: 'places and times',
      people: 'people and the body',
      things: 'things at home',
      moves: 'moving bodies',
      doing: 'doing and making',
      feelings: 'feelings and ideas',
      describer: 'describing words',
    },
    members: {
      nature: ['sun', 'rain', 'wind', 'snow', 'fire', 'water', 'light', 'dark', 'shine', 'star', 'night', 'day', 'noon',
        'earth', 'sea', 'shell', 'quake', 'bee', 'hive', 'afish'],
      place: ['way', 'side', 'back', 'down', 'top', 'end', 'after', 'week', 'east', 'west'],
      people: ['hand', 'foot', 'tooth', 'heart', 'lap', 'child', 'king', 'man', 'friend', 'neighbor'],
      things: ['home', 'house', 'bed', 'room', 'book', 'key', 'board', 'wall', 'net', 'box', 'dish', 'butter', 'brush',
        'ball', 'bow', 'load', 'craft', 'word'],
      moves: ['run', 'stop', 'stand', 'hop', 'swim', 'fly', 'fall', 'kick', 'jump', 'walk', 'set', 'hold', 'draw', 'whelm'],
      doing: ['help', 'play', 'sleep', 'rest', 'read', 'see', 'work', 'teach', 'learn', 'speak', 'talk', 'think', 'dream',
        'build', 'make', 'bake', 'sing', 'shop', 'write', 'thank', 'wish', 'tire'],
      feelings: ['kind', 'care', 'hope', 'fear', 'love', 'awe', 'wonder', 'joy', 'happy', 'sweet', 'mind', 'truth',
        'free', 'fair', 'lone'],
      describer: ['big', 'quick', 'slow', 'bright', 'cold', 'warm', 'soft', 'loud', 'clever', 'young', 'strong', 'weak',
        'black', 'wild'],
    },
  },

  // ── Grouped families for morphemes the ten don't cover ───────────
  {
    id: 'shape', name: 'Shape shifter',
    game: 'Bend, fold or roll a piece of wire to match a target outline.',
    rule: 'The shape is the answer: form/morph change the outline, gon makes corners, cycl rounds it into a wheel, sphere into a ball, plic/ply fold it over.',
    members: ['form', 'morph', 'gon', 'cycl', 'sphere', 'plic', 'ply'],
  },
  {
    id: 'join', name: 'Join up',
    game: 'Snap loose pieces together before they drift apart.',
    rule: 'Together is the win: con/syn/kai bring pieces together, homo pairs only the same kind, soci gathers a group, and the linking vowels o and i are the glue in the joint itself.',
    members: ['con', 'syn', 'kai', 'homo', 'soci', 'o', 'i'],
  },
  {
    id: 'life', name: 'Life & body',
    game: 'Keep a creature alive: feed the part of it that is fading.',
    rule: 'Each piece is a living part: bio keeps it alive, gen makes a new one, cardi is the heartbeat, derm the skin, neur the nerve signal, ped the feet, manu the hands, zoo the animal itself.',
    members: ['bio', 'gen', 'cardi', 'derm', 'neur', 'ped', 'manu', 'zoo'],
  },
  {
    id: 'elements', name: 'Elements',
    game: 'Balance a tiny world: send the right element where it is missing.',
    rule: 'The element does the job: hydro/hydr/aqua put out fires, therm warms the frozen corner, geo raises land, atmo fills the air, astro lights the sky, cosm/eco/phys keep the whole world in order.',
    members: ['hydro', 'hydr', 'aqua', 'therm', 'geo', 'atmo', 'astro', 'cosm', 'eco', 'phys'],
  },
  {
    id: 'mind', name: 'Mind & feeling',
    game: 'Read the crowd: send each sprite the feeling it shows.',
    rule: 'The feeling is the answer: phil loves it, phob runs from it, path feels it, psych thinks about it, soph is wise about it, cred believes it, sense perceives it.',
    members: ['psych', 'phil', 'phob', 'path', 'soph', 'cred', 'sense'],
  },
  {
    id: 'people', name: 'People & rule',
    game: 'Run a tiny town: hand each job to the right person.',
    rule: 'Who is in charge is the answer: demo is the people, cracy/crat/arch rule them, nom is the law they follow, anthrop is humankind, hero is the brave one who steps up.',
    members: ['demo', 'cracy', 'crat', 'arch', 'nom', 'anthrop', 'hero'],
  },

  // ── Single-morpheme families (at most six, each its own level) ───
  {
    id: 'again', name: 'Again & back',
    game: 'Rewind: play a scene backwards, then play it again.',
    rule: 're means again and back, so the only way through is to repeat or reverse what just happened.',
    single: true,
    members: ['re'],
  },
  {
    id: 'good', name: 'Good deed',
    game: 'Do a kind thing for every sprite that passes.',
    rule: 'bene means good and well: you score only for helping, never for grabbing.',
    single: true,
    members: ['bene'],
  },
  {
    id: 'self', name: 'Self',
    game: 'Autopilot: set the Morpher to run itself, then let go of the controls.',
    rule: 'auto means self: you win by making it work on its own, not by steering.',
    single: true,
    members: ['auto'],
  },
];

const flatten = (members) => (Array.isArray(members) ? members.map((id) => [id, null])
  : Object.entries(members).flatMap(([sub, ids]) => ids.map((id) => [id, sub])));

export const FAMILIES = Object.freeze(Object.fromEntries(LIST.map((f) => [f.id, Object.freeze(f)])));

/** morpheme id → family id */
export const FAMILY_OF = Object.freeze(Object.fromEntries(
  LIST.flatMap((f) => flatten(f.members).map(([id]) => [id, f.id]))));

/** morpheme id → sub-group id (Suffix shop and Everyday base only) */
export const SUB_OF = Object.freeze(Object.fromEntries(
  LIST.flatMap((f) => flatten(f.members).filter(([, sub]) => sub).map(([id, sub]) => [id, sub]))));

/** every [morpheme id, family id, sub] row, duplicates included, for the audit */
export const FAMILY_ROWS = LIST.flatMap((f) => flatten(f.members).map(([id, sub]) => [id, f.id, sub]));

/**
 * The Anglo-Saxon Room — the short warm-up. Map legend and zones: see layout.js.
 */

import { buildRoomMap } from './layout.js';

export const ANGLO = {
  id: 'anglo',
  name: 'The Anglo-Saxon Room',
  short: 'Anglo-Saxon',
  origin: 'anglo',
  keySlot: 0,
  rotMeter: false,
  mentor: {
    id: 'wynn',
    name: 'Old Wynn',
    role: 'maintenance program',
  },
  // One big room. Zone 0: Old Wynn's workshop. Zone 1: the Rotling hall and the chasm. Zone 2: the core.
  map: buildRoomMap([
    [4, 4, 'M'], [2, 2, 'a'], [6, 2, 'b'], [2, 11, 'c'], [6, 11, 'd'], [3, 9, 'o'],
    [10, 3, 'R'], [12, 4, 'R'], [10, 10, 'R'], [12, 11, 'R'], [13, 5, 'T'], [11, 1, 'k'], [11, 12, 'k'],
    [19, 3, 'N'], [19, 11, 'W'], [21, 7, 'C'], [22, 2, 'e'], [22, 12, 'f'], [18, 1, 'o'],
  ]),
  props: {
    a: { word: 'keyboard', ids: ['key', 'board'], model: 'keyboard' },
    b: { word: 'firewall', ids: ['fire', 'wall'], model: 'firewall' },
    c: { word: 'laptop', ids: ['lap', 'top'], model: 'laptop' },
    d: { word: 'network', ids: ['net', 'work'], model: 'network' },
    e: { word: 'rainbow', note: 'rain + bow: two Anglo-Saxon free bases', model: 'rainbow' },
    f: { word: 'windmill', note: 'wind + mill: an Anglo-Saxon compound', model: 'windmill' },
  },

  mentorFlow: {
    intro: [
      'Huh. A new Morpher. Good. I am Old Wynn. I keep the oldest code on the Lexinet.',
      'The Rot broke my words into bits. Morphemes. Small parts with meaning.',
      'One bit, two bits. One box, two boxes. See? Even counting is morphemes.',
      'I will hand you some parts. You put words back together on the Morph Compiler.',
    ],
    batches: [
      {
        teach: ['un', 'ful', 'less', 'help', 'care', 'hope', 'fear'],
        say: ['Four bases. Three affixes. Turn the rings until the meaning fits. Then press COMPILE.'],
        tasks: [
          { m: 'full of care; paying attention', p: ['care', 'ful'] },
          { m: 'without help; not able to help yourself', p: ['help', 'less'] },
          { m: 'not giving any help', p: ['un', 'help', 'ful'] },
          { m: 'full of hope', p: ['hope', 'ful'] },
        ],
      },
      {
        teach: ['er', 'ing', 'ed', 's', 'est', 'ness', 'ly', 'play', 'run', 'kind', 'friend', 'stop'],
        say: ['Some parts change when they join. Watch the joint. The compiler shows you why.'],
        tasks: [
          { m: 'one who plays', p: ['play', 'er'] },
          { m: 'moving fast on foot, right now', p: ['run', 'ing'] },
          { m: 'halted, in the past', p: ['stop', 'ed'] },
          { m: 'the state of being kind', p: ['kind', 'ness'] },
          { m: 'acting like a friend', p: ['friend', 'ly'] },
        ],
      },
      {
        teach: ['mis', 'over', 'fore', 'under', 'read', 'sleep', 'see', 'stand', 'dark', 'en'],
        say: ['Prefixes go in front. They push the meaning somewhere new.'],
        tasks: [
          { m: 'to read wrongly', p: ['mis', 'read'] },
          { m: 'to sleep too much', p: ['over', 'sleep'] },
          { m: 'to see before it happens', p: ['fore', 'see'] },
          { m: 'to get the meaning of something', p: ['under', 'stand'] },
        ],
      },
      {
        teach: ['mid', 'hood', 'dom', 'ish', 'ward', 'some', 'ship', 'out', 'es', 'child', 'king', 'free', 'night', 'home', 'awe'],
        say: ['Old suffixes, still busy. -hood is a time of life. -dom is a realm. -ward points a direction. -some causes a feeling.'],
        tasks: [
          { m: 'the time of being a child', p: ['child', 'hood'] },
          { m: 'the land a king rules', p: ['king', 'dom'] },
          { m: 'the state of being free', p: ['free', 'dom'] },
          { m: 'the middle of the night', p: ['mid', 'night'] },
          { m: 'toward home', p: ['home', 'ward'] },
          { m: 'causing awe; amazing', p: ['awe', 'some'] },
          { m: 'acting like a little child', p: ['child', 'ish'] },
          { m: 'the bond between friends', p: ['friend', 'ship'] },
        ],
      },
    ],
    done: [
      'Good hands. The glowing firewall wants a sentence fixed. Pick the ending that fits the sentence.',
      'A tip from an old bot: the Morph Compiler in the Hub is a WORD LAB. Build anything you like there. You might discover words nobody taught you, or invent your own.',
    ],
    repeat: ['Click the glowing firewall. Pick the ending that fits each sentence.'],
  },

  rooms: [
    {
      gate: {
        needs: 'mentor',
        lockedMsg: 'The firewall is sealed. Finish Old Wynn\'s parts first.',
        say: ['FIREWALL LOCK: one base, many endings. Only one ending fits the sentence.'],
        tasks: [
          { s: 'Thank you for your ___.', fixed: ['kind'], ring: [['ness'], ['ly'], ['est'], []], a: 0, why: '-ness turns "kind" into a thing you can have: kindness.' },
          { s: 'The puppy rolled ___ in the grass.', fixed: ['play'], ring: [['ful'], ['er'], ['ful', 'ly'], ['ing']], a: 2, why: '-ly says HOW it rolled. play + ful + ly → playfully.' },
          { s: 'The bus ___ at the corner yesterday.', fixed: ['stop'], ring: [['s'], ['ing'], ['er'], ['ed']], a: 3, why: '-ed puts it in the past. The p doubles: stop + p + ed → stopped.' },
        ],
      },
    },
    {
      rotlings: [
        { p: ['help', 'less'] },
        { p: ['run', 'er'] },
        { show: 'hopeing', fake: 'joint', p: ['hope', 'ing'], cuts: [4], why: '-ing starts with a vowel, so hope drops its e: hop(e) + ing → hoping.' },
        { show: 'lessfear', fake: 'order', p: ['fear', 'less'], cuts: [4], why: 'A suffix comes AFTER its base. fear + less → fearless.' },
      ],
      terminal: {
        needs: 'rotlings',
        lockedMsg: 'Rotlings are jamming this terminal. DEBUG them first.',
        teach: ['key', 'board', 'fire', 'wall', 'net', 'work', 'down', 'load'],
        say: ['TERMINAL: build the data bridge. Two free bases can join into one word: a compound.'],
        tasks: [
          { m: 'the board of keys you type on', p: ['key', 'board'] },
          { m: 'a wall that blocks dangerous fire (or data)', p: ['fire', 'wall'] },
          { m: 'to bring a file down to your device', p: ['down', 'load'] },
          { m: 'a web of connected computers', p: ['net', 'work'] },
        ],
      },
      gate: {
        needs: 'terminal',
        lockedMsg: 'Build the bridge first.',
        say: ['FIREWALL LOCK: pick the ending that fits.'],
        tasks: [
          { s: 'Our team needs a fast ___.', fixed: ['run'], ring: [['ing'], ['er'], ['s'], ['ness']], a: 1, why: '-er means "one who": a runner is one who runs. The n doubles.' },
          { s: 'Please be ___ with the glass cup.', fixed: ['care'], ring: [['less'], ['ful', 'ly'], ['ful'], ['ing']], a: 2, why: '"be ___" needs a describing word. careful = full of care.' },
          { s: 'After the storm, the town sat in ___.', fixed: ['dark'], ring: [['ness'], ['en'], ['ly'], ['er']], a: 0, why: '-ness makes a thing: darkness, the state of being dark.' },
        ],
      },
    },
    {
      link: {
        say: ['LINK NODE: hang each word on its family branch. Watch for look-alikes that are NOT family.'],
        bases: [
          { id: 'help', words: ['helpful', 'helper', 'unhelpful'] },
          { id: 'care', words: ['careful', 'careless', 'caring'] },
          { id: 'kind', words: ['kindness', 'unkind', 'kindly'] },
        ],
        ff: [
          { w: 'career', looks: 'care + er', why: 'career comes from an old French word for a road or racecourse. It has nothing to do with care.' },
          { w: 'kindle', looks: 'kind + le', why: 'kindle comes from an Old Norse word meaning "to light a fire". It is not about being kind.' },
        ],
      },
      newword: {
        s: 'The broken robot beeped unhelpfully at us.',
        w: 'unhelpfully',
        p: ['un', 'help', 'ful', 'ly'],
        opts: ['in a way that gives no help', 'full of help, again', 'without making a sound'],
        a: 0,
      },
      core: {
        needs: ['link', 'newword'],
        lockedMsg: 'The core needs the Link Node and the Unknown File console finished.',
        teach: ['y'],
        say: ['ROOM CORE: three long words to restore. Suffixes can stack.'],
        tasks: [
          { m: 'the state of being friendly', p: ['friend', 'ly', 'ness'] },
          { m: 'the state of being sleepy', p: ['sleep', 'y', 'ness'] },
          { m: 'the state of being without care', p: ['care', 'less', 'ness'] },
        ],
        outro: [
          'The old code hums again. Thank you, Morpher. My arcade cabinet, the Unbreakable, lights up.',
          'Before you go. My memory holds a KEYWORD. Old Wynn keeps one third of a key.',
        ],
      },
    },
  ],

  extraWords: [
    'helpful', 'helper', 'helping', 'helped', 'helps', 'player', 'playful', 'playing', 'played', 'plays', 'unkind', 'kindly', 'kinder', 'kindest',
    'friendly', 'unfriendly', 'friendship', 'friends', 'friendless', 'careful', 'careless', 'caring', 'cared', 'cares', 'carefully',
    'hopeful', 'hopeless', 'hoping', 'hoped', 'hopes', 'hopefully', 'fearful', 'fearless', 'fears', 'feared', 'fearing',
    'runner', 'running', 'runs', 'outrun', 'overrun', 'stopped', 'stopping', 'stops', 'stopper', 'bigger', 'biggest',
    'darken', 'darker', 'darkest', 'darkness', 'darkly', 'sleepy', 'sleepless', 'sleeping', 'sleeper', 'sleeps', 'oversleep', 'sleepiness',
    'misread', 'reading', 'reader', 'reads', 'foresee', 'seeing', 'sees', 'understand', 'standing', 'stands', 'outstanding', 'understanding',
    'overplay', 'outplay', 'unhelpful', 'helpless', 'kindness', 'friendliness', 'carelessness', 'unhelpfulness', 'unfriendliness',
    'keyboard', 'firewall', 'download', 'network', 'laptop', 'overwhelm', 'overwhelming', 'misunderstanding', 'foreseeable', 'fearlessness', 'sleeplessness',
    'keys', 'boards', 'walls', 'loads', 'loading', 'loaded', 'networks', 'works', 'worker', 'working', 'worked', 'unloaded', 'unload', 'reload',
    'boxes', 'wishes', 'tops', 'laps', 'firework', 'downward', 'overload', 'standstill', 'playfully', 'unhelpfully', 'misreading', 'unread',
    'helplessness', 'hopefulness', 'hopelessness', 'carefulness', 'playfulness', 'fearfully', 'helpfully', 'kindhearted', 'sleepily',
  ],
};

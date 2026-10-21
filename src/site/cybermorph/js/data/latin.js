/** The Latin Room. Map legend and zones: see layout.js. */

import { buildRoomMap } from './layout.js';

export const LATIN = {
  id: 'latin',
  name: 'The Latin Room',
  short: 'Latin',
  origin: 'latin',
  keySlot: 1,
  rotMeter: true,
  mentor: {
    id: 'aurelia',
    name: 'Aurelia Cache',
    role: 'archive AI',
  },
  // One big room. Zone 0: the archive. Zone 1: the server hall and the chasm. Zone 2: the core.
  map: buildRoomMap([
    [4, 4, 'M'], [2, 2, 'a'], [6, 2, 'b'], [2, 11, 'c'], [6, 11, 'd'], [3, 8, 'o'],
    [10, 2, 'R'], [12, 4, 'R'], [10, 10, 'R'], [12, 11, 'R'], [13, 6, 'T'], [9, 12, 'k'], [13, 1, 'k'],
    [19, 3, 'N'], [19, 11, 'W'], [21, 7, 'C'], [22, 2, 'e'], [22, 12, 'f'], [18, 1, 'g'],
  ]),
  props: {
    a: { word: 'dictionary', note: 'dict (to say) + ion + ary: a book of what words say', model: 'dictionary' },
    b: { word: 'structure', ids: ['struct', 'ure'], model: 'structure' },
    c: { word: 'tractor', ids: ['tract', 'or'], model: 'tractor' },
    d: { word: 'projector', note: 'pro (forward) + ject (throw) + or: it throws light forward', model: 'projector' },
    e: { word: 'aqueduct', note: 'aqua (water) + duct (lead): it leads water', model: 'aqueduct' },
    f: { word: 'transporter', ids: ['trans', 'port', 'er'], model: 'cart' },
    g: { word: 'inscription', ids: ['in2', 'script', 'ion'], model: 'tablet' },
  },

  mentorFlow: {
    intro: [
      'Visitor detected. Identity... Morpher. Welcome to the Latin Room. I am Aurelia Cache, keeper of the archive.',
      'Forgive my gaps. The Rot ate my roots. Without roots, my records have no meaning.',
      'Latin bases are often bound: "port" or "rupt" cannot stand alone. They need a prefix or suffix to make a word.',
      'Return my roots and each one restores a line of my memory.',
    ],
    batches: [
      {
        teach: ['port', 'rupt', 'trans', 'ex', 'in2', 'inter', 'ion', 'able', 'ible', 'ure'],
        say: ['Log restored: "port" means to carry. Every word with port carries something.'],
        tasks: [
          { m: 'to carry across from one place to another', p: ['trans', 'port'] },
          { m: 'to carry goods out of a country', p: ['ex', 'port'] },
          { m: 'to carry goods into a country', p: ['in2', 'port'] },
          { m: 'able to be carried', p: ['port', 'able'] },
          { m: 'to break in between someone speaking', p: ['inter', 'rupt'] },
          { m: 'the act of breaking in between', p: ['inter', 'rupt', 'ion'] },
        ],
      },
      {
        teach: ['struct', 'dict', 'con', 'de', 'pre', 'contra', 'ive', 'or'],
        say: ['Log restored: "struct" means to build, "dict" means to say. I remember building this archive. I remember... saying something I should not have.'],
        tasks: [
          { m: 'to build by putting parts together', p: ['con', 'struct'] },
          { m: 'the act of tearing down', p: ['de', 'struct', 'ion'] },
          { m: 'to say what will happen before it happens', p: ['pre', 'dict'] },
          { m: 'the act of saying something before it happens', p: ['pre', 'dict', 'ion'] },
          { m: 'to say the opposite; to speak against', p: ['contra', 'dict'] },
          { m: 'helpful for building up', p: ['con', 'struct', 'ive'] },
        ],
      },
      {
        teach: ['spect', 'tract', 'ject', 'sub', 'ad', 're', 'e', 'in', 'mobile'],
        say: ['Some prefixes change shape to fit the next letter. "ad" + "tract" becomes "attract". Watch the joint.'],
        tasks: [
          { m: 'to look into closely', p: ['in2', 'spect'] },
          { m: 'one who looks into things closely', p: ['in2', 'spect', 'or'] },
          { m: 'to pull away from; to take away numbers', p: ['sub', 'tract'] },
          { m: 'to pull toward', p: ['ad', 'tract'] },
          { m: 'to throw back; to refuse', p: ['re', 'ject'] },
          { m: 'to throw out', p: ['e', 'ject'] },
          { m: 'not able to move', p: ['in', 'mobile'] },
        ],
      },
      {
        teach: ['fer', 'mit', 'miss', 'duct', 'duc', 'duce', 'dis', 'pro', 'ob', 'per', 'intro', 'ence', 'ent', 'ment', 'ation'],
        say: ['Log restored: carry, send, lead. Some roots wear several spellings: duct, duc and duce all mean "to lead". Same meaning, different clothes.'],
        tasks: [
          { m: 'the way things are unlike', p: ['dis', 'fer', 'ence'] },
          { m: 'to carry across', p: ['trans', 'fer'] },
          { m: 'to send across', p: ['trans', 'mit'] },
          { m: 'the act of allowing', p: ['per', 'miss', 'ion'] },
          { m: 'one who leads', p: ['con', 'duct', 'or'] },
          { m: 'to lead back; to make smaller', p: ['re', 'duce'] },
          { m: 'the act of leading out of not knowing', p: ['e', 'duc', 'ation'] },
          { m: 'to bring toward someone', p: ['ob', 'fer'] },
        ],
      },
      {
        teach: ['fact', 'fac', 'fect', 'fic', 'i', 'bene', 'ten', 'tent', 'tain', 'tin', 'tinu', 'vid', 'vise', 'vide', 'super', 'ous', 'ity', 'ory', 'ant'],
        say: ['Log restored: make, hold, see. fact, fect and fic all mean "to make". ten, tain and tinu all mean "to hold".'],
        tasks: [
          { m: 'a place where things are made', p: ['fact', 'ory'] },
          { m: 'a result', p: ['ex', 'fect'] },
          { m: 'enough', p: ['sub', 'fic', 'i', 'ent'] },
          { m: 'to hold together', p: ['con', 'tain'] },
          { m: 'holding your mind toward', p: ['ad', 'tent', 'ion'] },
          { m: 'holding together without a break', p: ['con', 'tinu', 'ous'] },
          { m: 'easy to see', p: ['e', 'vid', 'ent'] },
          { m: 'to watch over', p: ['super', 'vise'] },
        ],
      },
      {
        teach: ['cap', 'capt', 'ceit', 'ceive', 'cept', 'cip', 'sta', 'sist', 'stat', 'stit', 'ute', 'ate', 'ble', 'multi'],
        say: ['Log restored: take and stand. ceive, cept and cip all mean "to take". sist, stat and stit all mean "to stand". My memory is nearly whole.'],
        tasks: [
          { m: 'to take back; to get', p: ['re', 'ceive'] },
          { m: 'to take willingly', p: ['ad', 'cept'] },
          { m: 'an idea taken in', p: ['con', 'cept'] },
          { m: 'to stand by to help', p: ['ad', 'sist'] },
          { m: 'to stand against', p: ['re', 'sist'] },
          { m: 'one set in place of another', p: ['sub', 'stit', 'ute'] },
          { m: 'a place where things stand', p: ['stat', 'ion'] },
        ],
      },
    ],
    done: [
      'Memory at 60 percent. The glowing firewall will test your endings. Mind the Rot meter in the next hall.',
    ],
    repeat: ['Click the glowing firewall for its lock. In the next hall, DEBUG the Rotlings before the Rot meter fills.'],
  },

  rooms: [
    {
      gate: {
        needs: 'mentor',
        lockedMsg: 'Sealed. Aurelia has more roots to return.',
        say: ['FIREWALL LOCK: choose the ending the sentence needs.'],
        tasks: [
          { s: 'The fire alarm caused a big ___ in class.', fixed: ['inter', 'rupt'], ring: [['ion'], ['ive'], ['or'], []], a: 0, why: '"a big ___" needs a thing (a noun). -ion makes the act of interrupting: interruption.' },
          { s: 'Mr. Phil asked us to ___ tomorrow\'s weather.', fixed: ['pre', 'dict'], ring: [['ion'], ['able'], [], ['or']], a: 2, why: '"to ___" needs an action word (a verb). predict needs no ending here.' },
          { s: 'The tablet is light, so it is very ___.', fixed: ['port'], ring: [['ible'], ['able'], ['ure'], []], a: 1, why: 'port takes -able: portable, able to be carried. Listen: "portible" is not how we say it.' },
        ],
      },
    },
    {
      rotlings: [
        { p: ['inter', 'rupt', 'ion'] },
        { p: ['in2', 'spect', 'or'] },
        { show: 'interuption', fake: 'spelling', p: ['inter', 'rupt', 'ion'], cuts: [5, 8], why: 'The base lost its r. inter + rupt + ion → interruption has two r\'s: one from inter, one from rupt.' },
        { show: 'inmobile', fake: 'joint', p: ['in', 'mobile'], cuts: [2], why: 'in- changes to im- before m: in + mobile → immobile.' },
      ],
      terminal: {
        needs: 'rotlings',
        lockedMsg: 'Rotlings are jamming this terminal. DEBUG them first.',
        teach: ['form', 'vis', 'act', 'pos', 'pose', 'posit', 'pon', 'pone', 'plic', 'ply', 'spec', 'spic', 'stru', 'dic', 'scrib', 'scribe', 'script', 'ite', 'post'],
        say: ['TERMINAL: build the data bridge. Careful: "in" can mean "into" or "not". Same spelling, two morphemes.'],
        tasks: [
          { m: 'to put together', p: ['con', 'pose'] },
          { m: 'one placed against you', p: ['ob', 'pon', 'ent'] },
          { m: 'to fold onto; to put to use', p: ['ad', 'ply'] },
          { m: 'to fold many times', p: ['multi', 'ply'] },
          { m: 'to write down about', p: ['de', 'scribe'] },
          { m: 'a written order from a doctor', p: ['pre', 'script', 'ion'] },
          { m: 'to point out', p: ['in2', 'dic', 'ate'] },
          { m: 'to change across into a new shape', p: ['trans', 'form'] },
          { m: 'able to be seen', p: ['vis', 'ible'] },
          { m: 'not able to be seen', p: ['in', 'vis', 'ible'] },
          { m: 'the act of doing something', p: ['act', 'ion'] },
          { m: 'to act back in return', p: ['re', 'act'] },
          { m: 'not doing anything; not active', p: ['in', 'act', 'ive'] },
        ],
      },
      gate: {
        needs: 'terminal',
        lockedMsg: 'Build the bridge first.',
        say: ['FIREWALL LOCK: choose the ending.'],
        tasks: [
          { s: 'The crew will ___ a new bridge.', fixed: ['con', 'struct'], ring: [['ion'], ['ive'], [], ['or']], a: 2, why: '"will ___" needs an action word. construct = to build together.' },
          { s: 'The tornado left a path of ___.', fixed: ['de', 'struct'], ring: [['ive'], ['ion'], ['or'], []], a: 1, why: '"a path of ___" needs a thing. -ion makes the act or result: destruction.' },
          { s: 'Is the ghost ___ or can you see it?', fixed: ['in', 'vis'], ring: [['ion'], ['able'], ['ible'], []], a: 2, why: 'vis takes -ible: invisible, not able to be seen.' },
        ],
      },
    },
    {
      link: {
        say: ['LINK NODE: hang each word on its root. Some words only LOOK related.'],
        bases: [
          { id: 'port', words: ['transport', 'portable', 'important'] },
          { id: 'struct', words: ['structure', 'construction', 'instructor'] },
          { id: 'form', words: ['transform', 'formation', 'uniform'] },
        ],
        ff: [
          { w: 'portrait', looks: 'port + rait', why: 'portrait comes from Latin protrahere, "to draw forth". It is about drawing, not carrying.' },
          { w: 'formidable', looks: 'form + idable', why: 'formidable comes from Latin formido, "fear". A formidable foe is one you fear, not one with a shape.' },
        ],
        surprise: { important: 'Surprise: important IS family. in + port + ant: something that carries weight.' },
      },
      newword: {
        s: 'The storm\'s path was unpredictable, so we stayed inside.',
        w: 'unpredictable',
        p: ['un', 'pre', 'dict', 'able'],
        opts: ['not able to be told before it happens', 'said again too many times', 'carried in front of everyone'],
        a: 0,
      },
      core: {
        needs: ['link', 'newword'],
        lockedMsg: 'The core needs the Link Node and the Unknown File console finished.',
        teach: ['sense', 'soci', 'cover', 'liver', 'cred', 'aud', 'mot', 'ped', 'aqua', 'manu', 'non', 'bi', 'yn', 'ary', 'ile', 'al', 'ial', 'ance'],
        say: ['ROOM CORE: restore the long words. Every root you earned in this room is on these rings.'],
        tasks: [
          { m: 'the act of carrying people or things across', p: ['trans', 'port', 'ation'] },
          { m: 'not able to be believed', p: ['in', 'cred', 'ible'] },
          { m: 'a group of people who hear a show', p: ['aud', 'i', 'ence'] },
          { m: 'the act of moving', p: ['mot', 'ion'] },
          { m: 'the state of mattering', p: ['in2', 'port', 'ance'] },
          { m: 'to hand over', p: ['de', 'liver'] },
          { m: 'relating to being with others', p: ['soci', 'al'] },
          { m: 'tending to break things apart', p: ['dis', 'rupt', 'ive'] },
          { m: 'the act of looking into something closely', p: ['in2', 'spect', 'ion'] },
        ],
        outro: [
          'The core is whole, and so am I. Mostly. A few dusty corners.',
          ['pleased', 'You build words that hold, Morpher. That is why I trust you with this: my KEYWORD, the second third of a key.'],
        ],
      },
    },
  ],

  extraWords: [
    'transport', 'export', 'import', 'report', 'support', 'portable', 'porter', 'exporter', 'importer', 'reporter', 'deport', 'transportation', 'exportation', 'importation',
    'interrupt', 'interruption', 'erupt', 'eruption', 'disrupt', 'disruption', 'disruptive', 'rupture', 'corrupt', 'corruption',
    'construct', 'construction', 'constructive', 'destruct', 'destruction', 'destructive', 'instruct', 'instruction', 'instructor', 'instructive', 'structure', 'reconstruct', 'reconstruction', 'indestructible', 'constructor',
    'predict', 'prediction', 'predictable', 'unpredictable', 'contradict', 'contradiction', 'dictate', 'dictator', 'diction', 'predictive',
    'inspect', 'inspector', 'inspection', 'respect', 'prospect', 'spectator', 'suspect', 'expect', 'expectation', 'respectable',
    'subtract', 'subtraction', 'attract', 'attraction', 'attractive', 'extract', 'extraction', 'distract', 'distraction', 'retract', 'tractor', 'traction', 'contract', 'contraction', 'detract',
    'reject', 'rejection', 'eject', 'ejection', 'inject', 'injection', 'project', 'projector', 'object', 'subject', 'deject',
    'transform', 'transformation', 'reform', 'deform', 'inform', 'information', 'conform', 'formation', 'formable', 'informative', 'former', 'transformer',
    'visible', 'invisible', 'vision', 'revision', 'visor', 'supervision',
    'action', 'active', 'actor', 'react', 'reaction', 'inactive', 'interact', 'interaction', 'interactive', 'transact', 'transaction', 'enact', 'activate',
    'immobile', 'mobile', 'transmit', 'submit', 'submitted', 'admit', 'emit', 'transmitted', 'remit', 'admitted', 'transmitter',
    'inscription', 'transcript', 'prescription', 'script', 'beneficial', 'disrespect', 'dispatch', 'disinform', 'interject', 'reinspect',
    'extractor', 'reactor', 'transporter', 'deformed', 'misspelling', 'untied', 'inactivity',
  ],
};

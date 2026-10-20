/** The Greek Room. Map legend and zones: see layout.js. */

import { buildRoomMap } from './layout.js';

export const GREEK = {
  id: 'greek',
  name: 'The Greek Room',
  short: 'Greek',
  origin: 'greek',
  keySlot: 2,
  rotMeter: true,
  mentor: {
    id: 'theo',
    name: 'Theo Parsec',
    role: 'satellite operator',
  },
  // One big room. Zone 0: the observatory deck. Zone 1: the uplink hall and the chasm. Zone 2: the core.
  map: buildRoomMap([
    [4, 4, 'M'], [2, 2, 'a'], [6, 2, 'b'], [2, 11, 'c'], [6, 11, 'd'], [3, 8, 'o'],
    [10, 3, 'R'], [12, 5, 'R'], [10, 10, 'R'], [12, 11, 'R'], [13, 6, 'T'], [11, 1, 'k'], [9, 12, 'k'],
    [19, 3, 'N'], [19, 11, 'W'], [21, 7, 'C'], [22, 2, 'e'], [22, 12, 'f'], [18, 1, 'g'],
  ]),
  props: {
    a: { word: 'telescope', ids: ['tele', 'scope'], model: 'telescope' },
    b: { word: 'microscope', ids: ['micro', 'scope'], model: 'microscope' },
    c: { word: 'telephone', ids: ['tele', 'phone'], model: 'telephone' },
    d: { word: 'thermometer', ids: ['therm', 'o', 'meter'], model: 'thermometer' },
    e: { word: 'geography globe', ids: ['geo', 'graph', 'gy'], model: 'globe' },
    f: { word: 'chronometer', ids: ['chron', 'o', 'meter'], model: 'clock' },
    g: { word: 'photograph camera', ids: ['photo', 'graph'], model: 'camera' },
  },

  mentorFlow: {
    intro: [
      'Ah! A visitor at the Array! Theo Parsec, satellite operator. I name every satellite with Greek parts, and I am never happy with the names.',
      'The eclipse is coming, and the Rot has scrambled my star map. I need words that hold.',
      'Greek words snap together like satellite modules. Many Greek pieces end in an o, like photo and bio. Some need an o added to link them.',
    ],
    batches: [
      {
        teach: ['bio', 'geo', 'photo', 'tele', 'graph', 'log', 'gy', 'ist'],
        say: ['Biology: bio + log + y. Life + study. Greek words often have two bases, not one.'],
        tasks: [
          { m: 'the study of life', p: ['bio', 'log', 'gy'] },
          { m: 'the study of the earth', p: ['geo', 'log', 'gy'] },
          { m: 'one who studies life', p: ['bio', 'log', 'ist'] },
          { m: 'writing (or drawing) about the earth', p: ['geo', 'graph', 'gy'] },
          { m: 'a picture made with light', p: ['photo', 'graph'] },
          { m: 'a machine that writes messages from far away', p: ['tele', 'graph'] },
        ],
      },
      {
        teach: ['micro', 'auto', 'scope', 'phone', 'meter', 'ic'],
        say: ['Listen to the stress move: PHO-to-graph, pho-TOG-ra-phy. Same parts, new beat.'],
        tasks: [
          { m: 'a tool to look at things far away', p: ['tele', 'scope'] },
          { m: 'a tool to look at small things', p: ['micro', 'scope'] },
          { m: 'a device that makes small sounds louder', p: ['micro', 'phone'] },
          { m: 'a device that carries a voice far away', p: ['tele', 'phone'] },
          { m: 'so small you need a microscope', p: ['micro', 'scope', 'ic'] },
          { m: 'writing your own name yourself', p: ['auto', 'graph'] },
        ],
      },
      {
        teach: ['therm', 'chron', 'psych', 'techn', 'o', 'al'],
        say: ['These bases end in a consonant, so they need a linking o to join the next Greek part: therm + o + meter.'],
        tasks: [
          { m: 'a tool that measures heat', p: ['therm', 'o', 'meter'] },
          { m: 'the study of the mind', p: ['psych', 'o', 'log', 'gy'] },
          { m: 'the study and use of skills and tools', p: ['techn', 'o', 'log', 'gy'] },
          { m: 'relating to the order of time', p: ['chron', 'o', 'log', 'ic', 'al'] },
        ],
      },
    ],
    done: [
      'Splendid! The glowing firewall will ask for endings. The next hall is crawling with Rotlings, so keep an eye on the meter.',
    ],
    repeat: ['Click the glowing firewall for its lock. In the next hall, DEBUG the Rotlings before the meter fills.'],
  },

  rooms: [
    {
      gate: {
        needs: 'mentor',
        lockedMsg: 'Locked. Theo has more modules for you.',
        say: ['FIREWALL LOCK: choose the ending.'],
        tasks: [
          { s: 'Theo took a ___ of the eclipse.', fixed: ['photo', 'graph'], ring: [['gy'], [], ['ic'], ['ist']], a: 1, why: '"a ___" needs the thing itself: photograph. Add -y and it becomes the art of it.' },
          { s: 'She wants to study ___ in college.', fixed: ['bio', 'log'], ring: [['ist'], ['ic', 'al'], ['gy'], []], a: 2, why: 'A subject you study takes -y: biology.' },
          { s: 'A ___ studies living things.', fixed: ['bio', 'log'], ring: [['gy'], ['ist'], [], ['ic']], a: 1, why: '-ist means "one who": a biologist.' },
        ],
      },
    },
    {
      rotlings: [
        { p: ['tele', 'scope'] },
        { p: ['bio', 'log', 'ist'] },
        { show: 'graphphoto', fake: 'order', p: ['photo', 'graph'], cuts: [5], why: 'Greek parts have an order: the describing part comes first. photo + graph → photograph.' },
        { show: 'thermmeter', fake: 'link', p: ['therm', 'o', 'meter'], cuts: [5], why: 'therm ends in a consonant, so it needs the linking o: therm + o + meter → thermometer.' },
      ],
      terminal: {
        needs: 'rotlings',
        lockedMsg: 'Rotlings are jamming this terminal. DEBUG them first.',
        teach: ['demo', 'cracy', 'hydro'],
        say: ['TERMINAL: build the uplink bridge.'],
        tasks: [
          { m: 'rule by the people', p: ['demo', 'cracy'] },
          { m: 'the art of making pictures with light', p: ['photo', 'graph', 'gy'] },
          { m: 'relating to writing or drawing', p: ['graph', 'ic'] },
          { m: 'a tool that measures water', p: ['hydro', 'meter'] },
        ],
      },
      gate: {
        needs: 'terminal',
        lockedMsg: 'Build the uplink bridge first.',
        say: ['FIREWALL LOCK: choose the ending.'],
        tasks: [
          { s: 'The dust was so tiny it was ___.', fixed: ['micro', 'scope'], ring: [['gy'], [], ['ic'], ['ist']], a: 2, why: '-ic makes a describing word: microscopic. Note: scope drops its e before -ic.' },
          { s: 'Put the events in ___ order.', fixed: ['chron', 'o', 'log'], ring: [['ic', 'al'], ['gy'], ['ist'], []], a: 0, why: '"___ order" needs a describing word: chronological.' },
          { s: 'Our class uses ___ every day.', fixed: ['techn', 'o', 'log'], ring: [['ist'], ['gy'], ['ic', 'al'], []], a: 1, why: 'The thing you use is technology: skill + study.' },
        ],
      },
    },
    {
      link: {
        say: ['LINK NODE: hang each word on its Greek base. Some imposters only look Greek.'],
        bases: [
          { id: 'graph', words: ['autograph', 'graphic', 'biography'] },
          { id: 'log', words: ['biology', 'technology', 'logic'] },
          { id: 'meter', words: ['thermometer', 'speedometer', 'kilometer'] },
        ],
        ff: [
          { w: 'login', looks: 'log + in', why: 'The log in login is a ship\'s logbook, from Middle English logge, a block of wood. Not the Greek log, "word".' },
          { w: 'meteor', looks: 'met + eor', why: 'meteor comes from Greek meteoros, "high up in the air". It does not measure anything.' },
        ],
      },
      newword: {
        s: 'Our cat\'s hydrophobia makes bath time very loud.',
        w: 'hydrophobia',
        p: ['hydro', 'phob', 'ia'],
        teachFirst: ['phob', 'ia'],
        opts: ['a fear of water', 'water that is afraid', 'a tool that measures water'],
        a: 0,
      },
      core: {
        needs: ['link', 'newword'],
        lockedMsg: 'The core needs the Link Node and the Unknown File console finished.',
        teach: ['syn', 'the', 'sis'],
        say: ['ROOM CORE: three long words to restore the star map.'],
        tasks: [
          { m: 'one who studies the mind', p: ['psych', 'o', 'log', 'ist'] },
          { m: 'putting things together with light (how plants make food)', p: ['photo', 'syn', 'the', 'sis'] },
          { m: 'relating to the study and use of tools', p: ['techn', 'o', 'log', 'ic', 'al'] },
        ],
        outro: [
          'The star map is whole! The eclipse can come. I have finally named my newest satellite: the Telegraphoscope. ...No. Still wrong.',
          'Here, the last KEYWORD. Three keywords, three parts. Somewhere in the Hub, something wants them.',
        ],
      },
    },
  ],

  extraWords: [
    'biology', 'biologist', 'biological', 'geology', 'geologist', 'geography', 'geographic', 'photograph', 'photography', 'photographic', 'photographer',
    'telegraph', 'telescope', 'telescopic', 'telephone', 'microscope', 'microscopic', 'microphone', 'autograph', 'autobiography', 'biography', 'graphic',
    'thermometer', 'psychology', 'psychologist', 'psychological', 'technology', 'technological', 'technologist', 'chronology', 'chronological',
    'democracy', 'democratic', 'hydrometer', 'hydrophobia', 'photosynthesis', 'triskaidekaphobia', 'microbiology', 'logic', 'logical', 'speedometer', 'kilometer',
    'geographic', 'geological', 'photophobia', 'telephoto', 'phonograph', 'graphology', 'micrometer', 'biologic', 'autographic', 'telegraphic',
    'phobia', 'synthesis', 'thesis', 'photos', 'graphs', 'phones', 'scopes', 'meters',
  ],
};

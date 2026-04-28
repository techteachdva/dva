/**
 * Morphology Garden — 3D + animated whiteboard view, shared morpheme bridges.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

/** Reused vectors — avoids per-frame allocations in bridge updates */
const _vBridgeA = new THREE.Vector3();
const _vBridgeB = new THREE.Vector3();
const _orbitDblClickTarget = new THREE.Vector3();

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TRANSITION_SEC = REDUCED_MOTION ? 0.01 : 1.48;
/** Skip tiny DOM writes when LOD opacity barely changes */
const LOD_OPACITY_EPS = 0.02;

/** Select “all trees” instead of isolating one */
const GARDEN_SELECT = "__garden__";

/** Whiteboard: trees on a circle (garden) vs one tree centered (isolate) */
const WB_CIRCLE_RADIUS = 92;

/** @type {Record<string, { mesh: THREE.Mesh, wordId: string }[]>} */
const morphemeRegistry = {};

function registerMorpheme(key, mesh, wordId) {
  if (!key) return;
  if (!morphemeRegistry[key]) morphemeRegistry[key] = [];
  morphemeRegistry[key].push({ mesh, wordId });
}

const WORDS = [
  {
    id: "presentation",
    label: "Presentation",
    bracket: "[[pre- + sent] + -ation]",
    note: "Like <em>statement</em> + <strong>-ment</strong> in the textbook, <strong>-ation</strong> is a derivational suffix that helps form an abstract noun (Table 4.2). The stem is not a separate modern English word, which is why many roots in academic vocabulary are <strong>bound morphemes</strong> (§4.3).",
    position: [29, 0, 24],
    tree: {
      text: "presentation",
      gloss: "noun: an act of presenting",
      children: [
        {
          text: "-ation",
          gloss: "suffix: action or result (derivational)",
          morphemeKey: "sfx:-ation",
          children: [
            {
              text: "present",
              gloss: "stem: set before, show",
              children: [
                {
                  text: "pre-",
                  gloss: "prefix: before, in front",
                  morphemeKey: "pfx:pre-",
                  children: [],
                },
                {
                  text: "sent",
                  gloss: "bound root: feel / send (as in consent)",
                  morphemeKey: "root:sent",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "hallway",
    label: "Hallway",
    bracket: "[hall + way]",
    note: "<strong>Compounding</strong> joins two existing words (§4.6). In English, the <strong>rightmost</strong> element often determines the word class of the whole—here <em>hallway</em> patterns like <em>way</em> (a path), not like <em>hall</em> alone.",
    position: [-34, 0, 19],
    tree: {
      text: "hallway",
      gloss: "noun: a corridor",
      children: [
        {
          text: "hall",
          gloss: "free morpheme: large room or passage",
          morphemeKey: "lex:hall",
          children: [],
        },
        {
          text: "way",
          gloss: "free morpheme: path",
          morphemeKey: "lex:way",
          children: [],
        },
      ],
    },
  },
  {
    id: "final",
    label: "Final",
    bracket: "[fin + -al]",
    note: "The suffix <strong>-al</strong> is one of the textbook’s derivational suffixes meaning ‘pertaining to’ (Table 4.2, as in <em>national</em>, <em>seasonal</em>). Here it attaches to a <strong>bound root</strong> <em>fin-</em> ‘end,’ parallel to the book’s examples like <em>ept</em> in <em>inept</em> (§4.3).",
    position: [-19, 0, -29],
    tree: {
      text: "final",
      gloss: "adjective: last; conclusive",
      children: [
        {
          text: "-al",
          gloss: "suffix: pertaining to (derivational)",
          morphemeKey: "sfx:-al",
          children: [
            {
              text: "fin",
              gloss: "bound root: end, limit",
              morphemeKey: "root:fin",
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: "sourdough",
    label: "Sourdough",
    bracket: "[sour + dough]",
    note: "Another compound of two <strong>content morphemes</strong> (open-class items; §4.3). The textbook reminds us that compounds may be written solid, with a hyphen, or as separate words (§4.6)—here both parts are merged in spelling.",
    position: [14, 0, -34],
    tree: {
      text: "sourdough",
      gloss: "noun: leavened bread or its starter",
      children: [
        {
          text: "sour",
          gloss: "free morpheme: acidic taste",
          morphemeKey: "lex:sour",
          children: [],
        },
        {
          text: "dough",
          gloss: "free morpheme: baked mixture",
          morphemeKey: "lex:dough",
          children: [],
        },
      ],
    },
  },
  {
    id: "before",
    label: "Before",
    bracket: "[be- + fore]",
    note: "As a <strong>function morpheme</strong> in use, <em>before</em> behaves as a closed-class preposition or adverb. Morphologically, many textbooks still separate <strong>be-</strong> + <strong>fore</strong> for teaching (compare the book’s discussion of how complex words are built from roots and affixes in §4.2).",
    position: [-38, 0, -10],
    tree: {
      text: "before",
      gloss: "preposition / adverb: earlier than; in front of",
      children: [
        {
          text: "be-",
          gloss: "prefix-like element (fossilized in set forms)",
          morphemeKey: "pfx:be-",
          children: [],
        },
        {
          text: "fore",
          gloss: "morpheme: front, ahead (cf. forethought)",
          morphemeKey: "lex:fore",
          children: [],
        },
      ],
    },
  },
  {
    id: "rainbow",
    label: "Rainbow",
    bracket: "[rain + bow]",
    note: "Compound noun: <em>rain</em> + <em>bow</em> (§4.6). The book’s stress contrast (<em>blúebird</em> vs. <em>blue bírd</em>) is a useful reminder that compounds are not just long spelling—they have their own pronunciation patterns.",
    position: [38, 0, -14],
    tree: {
      text: "rainbow",
      gloss: "noun: colored arc in the sky",
      children: [
        {
          text: "rain",
          gloss: "free morpheme: water from clouds",
          morphemeKey: "lex:rain",
          children: [],
        },
        {
          text: "bow",
          gloss: "free morpheme: curve; arc",
          morphemeKey: "lex:bow",
          children: [],
        },
      ],
    },
  },
  {
    id: "inhospitable",
    label: "Inhospitable",
    bracket: "[in- + [hospit + -able]]",
    note: "The textbook groups <strong>il-, im-, in-, ir-</strong> as variants of a negative prefix (Table 4.2). <strong>-able</strong> ‘capable of being’ is derivational (Table 4.2). Together they illustrate how derivational affixes change meaning and often word class (§4.3).",
    position: [-24, 0, 34],
    tree: {
      text: "inhospitable",
      gloss: "adjective: not welcoming; harsh (environment)",
      children: [
        {
          text: "in-",
          gloss: "prefix: not, without",
          morphemeKey: "pfx:in-",
          children: [],
        },
        {
          text: "hospitable",
          gloss: "adjective stem: welcoming (here: ‘able to host’)",
          children: [
            {
              text: "hospit",
              gloss: "bound root: guest / host (as in hospitality)",
              morphemeKey: "root:hospit",
              children: [],
            },
            {
              text: "-able",
              gloss: "suffix: able to be; tending to (derivational)",
              morphemeKey: "sfx:-able",
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: "demarcation",
    label: "Demarcation",
    bracket: "[[de- + mark] + -ation]",
    note: "Table 4.2 lists several negative / reversal prefixes (e.g. <strong>dis-</strong>, <strong>un-</strong>, <strong>in-</strong>); <strong>de-</strong> fits the same teaching point—derivational prefixes that reshape meaning before suffixes like <strong>-ation</strong> attach. That order (derivation before inflection) is stressed in §4.3.",
    position: [43, 0, 29],
    tree: {
      text: "demarcation",
      gloss: "noun: a boundary or the act of marking one",
      children: [
        {
          text: "-ation",
          gloss: "suffix: action or result (derivational)",
          morphemeKey: "sfx:-ation",
          children: [
            {
              text: "demarc",
              gloss: "stem: mark a limit",
              children: [
                {
                  text: "de-",
                  gloss: "prefix: reversal / off (Latinate pattern)",
                  morphemeKey: "pfx:de-",
                  children: [],
                },
                {
                  text: "mark",
                  gloss: "free root: visible sign; boundary",
                  morphemeKey: "root:mark",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "dehumanization",
    label: "Dehumanization",
    bracket: "[[de- + [human + -ize]] + -ation]",
    note: "Stacks like <strong>-ize</strong> + <strong>-ation</strong> mirror the textbook pattern: <strong>-ize</strong> ‘become’ builds a verb stem, then <strong>-ation</strong> forms an abstract noun (Tables 4.2–4.3 show how such suffixes differ from inflectional <strong>-s</strong> or <strong>-ed</strong>).",
    position: [48, 0, -24],
    tree: {
      text: "dehumanization",
      gloss: "noun: treating people as less than human",
      children: [
        {
          text: "-ation",
          gloss: "suffix: process or result (derivational)",
          morphemeKey: "sfx:-ation",
          children: [
            {
              text: "dehumanize",
              gloss: "verb stem: strip away human qualities",
              children: [
                {
                  text: "de-",
                  gloss: "prefix: removal / reversal (Latinate pattern)",
                  morphemeKey: "pfx:de-",
                  children: [],
                },
                {
                  text: "humanize",
                  gloss: "stem: make human",
                  children: [
                    {
                      text: "human",
                      gloss: "free root: person",
                      morphemeKey: "lex:human",
                      children: [],
                    },
                    {
                      text: "-ize",
                      gloss: "suffix: make, become (derivational)",
                      morphemeKey: "sfx:-ize",
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "resistance",
    label: "Resistance",
    bracket: "[[re- + sist] + -ance]",
    note: "The suffix <strong>-ance</strong> nominalizes the verb stem (parallel in function to nominal <strong>-ment</strong> in the book’s examples such as <em>argument</em>). <strong>re-</strong> is listed among productive prefixes in Table 4.2; here it patterns with ‘back / against’ more than ‘again’ (compare <em>rewrite</em> vs. <em>resist</em>).",
    position: [-43, 0, 24],
    tree: {
      text: "resistance",
      gloss: "noun: opposition; ability to withstand",
      children: [
        {
          text: "-ance",
          gloss: "suffix: state or action (derivational)",
          morphemeKey: "sfx:-ance",
          children: [
            {
              text: "resist",
              gloss: "verb stem: stand against",
              children: [
                {
                  text: "re-",
                  gloss: "prefix: back, against (Latinate pattern)",
                  morphemeKey: "pfx:re-",
                  children: [],
                },
                {
                  text: "sist",
                  gloss: "bound root: stand (as in persist)",
                  morphemeKey: "root:sist",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "revolution",
    label: "Revolution",
    bracket: "[[re- + volu] + -tion]",
    note: "Another <strong>re-</strong> + stem + <strong>-tion</strong> pattern, parallel to how the textbook discusses Latinate derivation in long academic words (§4.2–4.3). <strong>-tion</strong> is in the same family of nominalizing suffixes as <strong>-ation</strong>.",
    position: [-48, 0, -19],
    tree: {
      text: "revolution",
      gloss: "noun: overthrow; complete cycle",
      children: [
        {
          text: "-tion",
          gloss: "suffix: action or result (derivational)",
          morphemeKey: "sfx:-tion",
          children: [
            {
              text: "revolu",
              gloss: "stem: roll back, turn around",
              children: [
                {
                  text: "re-",
                  gloss: "prefix: again, back (Latinate pattern)",
                  morphemeKey: "pfx:re-",
                  children: [],
                },
                {
                  text: "volu",
                  gloss: "bound root: roll, turn (cf. revolve, volume)",
                  morphemeKey: "root:volu",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "unlockable-a",
    label: "Unlockable (not able to be locked)",
    bracket: "[un- + [lock + -able]]",
    note: "Table 4.2 lists <strong>un-</strong> as ‘not, opposite of.’ Here <strong>un-</strong> attaches to the adjective <em>lockable</em>, so the reading is ‘not lockable’—i.e. <strong>not able to be locked</strong>. Bracketing [[un- [lock -able]]] matches that scope (compare §4.2 on how affixes combine).",
    context:
      "Fire-safety rules meant the side door stayed <strong>unlockable</strong>: it <strong>could not be locked</strong> during store hours, even though managers wanted tighter security.",
    position: [5, 0, 38],
    tree: {
      text: "unlockable",
      gloss: "adj: not able to be locked",
      children: [
        {
          text: "un-",
          gloss: "prefix: not (reverses lockable)",
          morphemeKey: "pfx:un-",
          children: [],
        },
        {
          text: "lockable",
          gloss: "adjective: able to be locked",
          children: [
            {
              text: "lock",
              gloss: "free root: fastening device; to fasten",
              morphemeKey: "lex:lock",
              children: [],
            },
            {
              text: "-able",
              gloss: "suffix: able to be (derivational)",
              morphemeKey: "sfx:-able",
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: "unlockable-b",
    label: "Unlockable (able to be unlocked)",
    bracket: "[[un- + lock] + -able]",
    note: "Same surface string, different structure: <strong>-able</strong> attaches to the verb <em>unlock</em>, so the paraphrase is ‘able to be unlocked.’ This is a compact classroom example of why morphology cares about <strong>constituent structure</strong>, not just letters.",
    context:
      "After the update, my old phone was finally <strong>unlockable</strong>: Face ID meant we <strong>could unlock it</strong> without the forgotten passcode.",
    position: [19, 0, 43],
    tree: {
      text: "unlockable",
      gloss: "adj: able to be unlocked",
      children: [
        {
          text: "-able",
          gloss: "suffix: able to be (derivational)",
          morphemeKey: "sfx:-able",
          children: [
            {
              text: "unlock",
              gloss: "verb: remove a lock; open",
              children: [
                {
                  text: "un-",
                  gloss: "prefix: reverse an action (unlock)",
                  morphemeKey: "pfx:un-",
                  children: [],
                },
                {
                  text: "lock",
                  gloss: "free root: fasten with a lock",
                  morphemeKey: "lex:lock",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "belief",
    label: "Belief",
    bracket: "[be- + lief]",
    note: "A textbook-style <strong>bound root</strong> analysis: <strong>be-</strong> patterns with other <em>be-</em> + stem words (compare <em>before</em>, <em>believe</em>). The second piece is not a free modern English word on its own.",
    position: [11, 0, 50],
    tree: {
      text: "belief",
      gloss: "noun: conviction; acceptance as true",
      children: [
        {
          text: "be-",
          gloss: "prefix: fossilized element in a set of stems",
          morphemeKey: "pfx:be-",
          children: [],
        },
        {
          text: "lief",
          gloss: "bound root: dear, willing (archaic; cf. lief, believe)",
          morphemeKey: "root:lief",
          children: [],
        },
      ],
    },
  },
  {
    id: "believe",
    label: "Believe",
    bracket: "[be- + lieve]",
    note: "Parallel to <em>belief</em>: same <strong>be-</strong> prefix family, different bound stem. Useful for showing how <strong>related words</strong> can share a formative without sharing every morpheme.",
    position: [-11, 0, 50],
    tree: {
      text: "believe",
      gloss: "verb: hold as true; trust",
      children: [
        {
          text: "be-",
          gloss: "prefix: fossilized element in a set of stems",
          morphemeKey: "pfx:be-",
          children: [],
        },
        {
          text: "lieve",
          gloss: "bound root: dear, wish (cf. belief)",
          morphemeKey: "root:lieve",
          children: [],
        },
      ],
    },
  },
  {
    id: "endure",
    label: "Endure",
    bracket: "[en- + dure]",
    note: "The productive <strong>en-</strong> / <strong>em-</strong> pattern (Table 4.2 family) attaches to stems to form verbs such as <em>enable</em>, <em>enrich</em>. The stem here is a Latinate <strong>bound root</strong>.",
    position: [-54, 0, 6],
    tree: {
      text: "endure",
      gloss: "verb: last through; tolerate",
      children: [
        {
          text: "en-",
          gloss: "prefix: in, into; make (Latinate verb-forming)",
          morphemeKey: "pfx:en-",
          children: [],
        },
        {
          text: "dure",
          gloss: "bound root: hard, lasting (cf. durable)",
          morphemeKey: "root:dure",
          children: [],
        },
      ],
    },
  },
  {
    id: "enable",
    label: "Enable",
    bracket: "[en- + able]",
    note: "Shares the same <strong>en-</strong> prefix frame as <em>endure</em>. The stem <em>able</em> ties the word to the <strong>-able</strong> family (compare <em>inhospitable</em>, <em>unlockable</em>).",
    position: [-58, 0, -22],
    tree: {
      text: "enable",
      gloss: "verb: make able; authorize",
      children: [
        {
          text: "en-",
          gloss: "prefix: in, into; make (Latinate verb-forming)",
          morphemeKey: "pfx:en-",
          children: [],
        },
        {
          text: "able",
          gloss: "adjective stem: capable (related to the -able suffix family)",
          children: [],
        },
      ],
    },
  },
  {
    id: "freedom",
    label: "Freedom",
    bracket: "[free + -dom]",
    note: "The noun-forming suffix <strong>-dom</strong> (‘state, realm, condition’) builds an abstract noun on an adjective or noun stem—parallel examples include <em>wisdom</em> and <em>kingdom</em>.",
    position: [54, 0, 6],
    tree: {
      text: "freedom",
      gloss: "noun: liberty; state of being free",
      children: [
        {
          text: "free",
          gloss: "free morpheme: not bound; without cost",
          morphemeKey: "lex:free",
          children: [],
        },
        {
          text: "-dom",
          gloss: "suffix: state or realm (derivational)",
          morphemeKey: "sfx:-dom",
          children: [],
        },
      ],
    },
  },
  {
    id: "wisdom",
    label: "Wisdom",
    bracket: "[wise + -dom]",
    note: "Shares <strong>-dom</strong> with <em>freedom</em> and <strong>wise</strong> with <em>wiser</em> and <em>unwise</em>—a compact word-family cluster for teaching derivational networks.",
    position: [36, 0, 44],
    tree: {
      text: "wisdom",
      gloss: "noun: good judgment; learnedness",
      children: [
        {
          text: "wise",
          gloss: "free morpheme: showing good judgment",
          morphemeKey: "lex:wise",
          children: [],
        },
        {
          text: "-dom",
          gloss: "suffix: state or realm (derivational)",
          morphemeKey: "sfx:-dom",
          children: [],
        },
      ],
    },
  },
  {
    id: "kingdom",
    label: "Kingdom",
    bracket: "[king + -dom]",
    note: "Another <strong>-dom</strong> noun. The left element is a free noun stem; the right element fixes the ‘realm / domain’ reading—useful for comparing compound-like stress and structure with <em>freedom</em>.",
    position: [-6, 0, 54],
    tree: {
      text: "kingdom",
      gloss: "noun: realm ruled by a king; domain",
      children: [
        {
          text: "king",
          gloss: "free morpheme: monarch",
          morphemeKey: "lex:king",
          children: [],
        },
        {
          text: "-dom",
          gloss: "suffix: state or realm (derivational)",
          morphemeKey: "sfx:-dom",
          children: [],
        },
      ],
    },
  },
  {
    id: "wiser",
    label: "Wiser",
    bracket: "[wise + -er]",
    note: "Inflectional <strong>-er</strong> comparative on an adjective stem. The same written <strong>-er</strong> also appears in <strong>agentive</strong> derivations (e.g. <em>finisher</em>)—a classic classroom contrast.",
    position: [6, 0, -52],
    tree: {
      text: "wiser",
      gloss: "adjective: more wise (comparative)",
      children: [
        {
          text: "wise",
          gloss: "free morpheme: showing good judgment",
          morphemeKey: "lex:wise",
          children: [],
        },
        {
          text: "-er",
          gloss: "suffix: comparative (inflectional)",
          morphemeKey: "sfx:-er",
          children: [],
        },
      ],
    },
  },
  {
    id: "unwise",
    label: "Unwise",
    bracket: "[un- + wise]",
    note: "Shares <strong>un-</strong> with the <em>unlockable</em> trees and <strong>wise</strong> with <em>wisdom</em> / <em>wiser</em>.",
    position: [26, 0, -40],
    tree: {
      text: "unwise",
      gloss: "adjective: not wise",
      children: [
        {
          text: "un-",
          gloss: "prefix: not, opposite of",
          morphemeKey: "pfx:un-",
          children: [],
        },
        {
          text: "wise",
          gloss: "free morpheme: showing good judgment",
          morphemeKey: "lex:wise",
          children: [],
        },
      ],
    },
  },
  {
    id: "constitution",
    label: "Constitution",
    bracket: "[[con- + stitut] + -tion]",
    note: "Latinate bracketing: <strong>con-</strong> + <strong>stitut</strong> ‘set, place’ + nominalizing <strong>-tion</strong>. Bridges to <em>convince</em> on the prefix and to <em>revolution</em> on <strong>-tion</strong>.",
    position: [-34, 0, -46],
    tree: {
      text: "constitution",
      gloss: "noun: makeup of something; founding charter",
      children: [
        {
          text: "-tion",
          gloss: "suffix: action or result (derivational)",
          morphemeKey: "sfx:-tion",
          children: [
            {
              text: "constitut",
              gloss: "stem: set together; establish",
              children: [
                {
                  text: "con-",
                  gloss: "prefix: with, together (Latinate)",
                  morphemeKey: "pfx:con-",
                  children: [],
                },
                {
                  text: "stitut",
                  gloss: "bound root: set, place (as in institute)",
                  morphemeKey: "root:stitut",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "convince",
    label: "Convince",
    bracket: "[con- + vince]",
    note: "Shares <strong>con-</strong> with <em>constitution</em>. The bound stem is not a free modern English word—typical of Latinate vocabulary in academic registers.",
    position: [-26, 0, 40],
    tree: {
      text: "convince",
      gloss: "verb: persuade by argument or evidence",
      children: [
        {
          text: "con-",
          gloss: "prefix: with, together (Latinate)",
          morphemeKey: "pfx:con-",
          children: [],
        },
        {
          text: "vince",
          gloss: "bound root: conquer, overcome (cf. invincible)",
          morphemeKey: "root:vince",
          children: [],
        },
      ],
    },
  },
  {
    id: "finisher",
    label: "Finisher",
    bracket: "[finish + -er]",
    note: "Derivational <strong>-er</strong> forming an agent noun from a verb stem—compare textbook examples like <em>teacher</em> from <em>teach</em>. Contrast with comparative <strong>-er</strong> on <em>wiser</em>.",
    position: [44, 0, 34],
    tree: {
      text: "finisher",
      gloss: "noun: one that finishes; final action or blow",
      children: [
        {
          text: "finish",
          gloss: "free morpheme: complete; end",
          morphemeKey: "lex:finish",
          children: [],
        },
        {
          text: "-er",
          gloss: "suffix: one that does (derivational agentive)",
          morphemeKey: "sfx:-er",
          children: [],
        },
      ],
    },
  },
];

/** Wider 3D garden; whiteboard uses a circle (garden) or single centered tree (isolate) */
const POS3D_SCALE = 1.52;

function assignGrid2d() {
  WORDS.forEach((w) => {
    w.pos3d = new THREE.Vector3(
      w.position[0] * POS3D_SCALE,
      w.position[1],
      w.position[2] * POS3D_SCALE
    );
    if (!w.pos2d) w.pos2d = new THREE.Vector3();
  });
}

function assignWhiteboardCircle() {
  const n = WORDS.length;
  WORDS.forEach((w, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    w.pos2d.set(Math.cos(a) * WB_CIRCLE_RADIUS, -10, Math.sin(a) * WB_CIRCLE_RADIUS);
  });
}

function assignWhiteboardIsolate(wordId) {
  WORDS.forEach((w) => {
    w.pos2d.set(w.id === wordId ? 0 : WB_CIRCLE_RADIUS * 2.5, -10, 0);
  });
}

/** Vertical gap between levels (root at top → morphemes cascade downward) */
const TREE_DEPTH_STEP = 5.35;

function layoutSubtree(node, depth, xCenter, spread) {
  if (!node.children || node.children.length === 0) {
    return {
      width: spread,
      positions: [{ node, x: xCenter, y: -depth * TREE_DEPTH_STEP, z: 0, depth }],
    };
  }
  const childSpread = spread / node.children.length;
  const allPos = [{ node, x: xCenter, y: -depth * TREE_DEPTH_STEP, z: 0, depth }];
  let cursor = xCenter - spread / 2 + childSpread / 2;
  for (const c of node.children) {
    const sub = layoutSubtree(c, depth + 1, cursor, childSpread * 0.9);
    allPos.push(...sub.positions);
    cursor += childSpread;
  }
  return { width: spread, positions: allPos };
}

function sphere(r, color, roughness, metalness) {
  const g = new THREE.SphereGeometry(r, 28, 28);
  const m = new THREE.MeshStandardMaterial({
    color,
    metalness: metalness ?? 0.5,
    roughness: roughness ?? 0.35,
    emissive: color,
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.baseEmissive = color.clone();
  return mesh;
}

function edgeLine(a, b, colorHex, opacity) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: opacity ?? 0.92,
  });
  return new THREE.Line(geo, mat);
}

/** Gloss text after the first “category:” segment (avoids repeating Noun/Prefix in the subtitle). */
function glossDetail(gloss) {
  if (!gloss) return "";
  const i = gloss.indexOf(":");
  if (i < 0) return gloss.trim();
  return gloss.slice(i + 1).trim();
}

/** Part of speech for the whole word (apex node), from the gloss head before “:”. */
function parseCategoryFromGloss(gloss) {
  if (!gloss) return "Word";
  const i = gloss.indexOf(":");
  const head = (i >= 0 ? gloss.slice(0, i) : gloss).trim();
  const h = head.toLowerCase();
  if (h.includes("prep") && h.includes("adv")) return "Prep · Adv";
  if (h.startsWith("noun")) return "Noun";
  if (h.startsWith("adjective")) return "Adjective";
  if (h.startsWith("adj")) return "Adjective";
  if (h.includes("verb")) return "Verb";
  if (h.includes("adverb")) return "Adverb";
  if (h.includes("preposition")) return "Preposition";
  const word = head.split(/[\s/]+/)[0];
  if (!word) return "Word";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Syntactic/morphological category for a node (Wikipedia-style tree labels).
 * Optional `node.pos` in data overrides.
 */
function nodePosLabel(node, isRoot) {
  if (node.pos) return node.pos;
  if (isRoot) return parseCategoryFromGloss(node.gloss);
  if (node.morphemeKey) {
    if (node.morphemeKey.startsWith("pfx:")) return "Prefix";
    if (node.morphemeKey.startsWith("sfx:")) return "Suffix";
    if (node.morphemeKey.startsWith("root:")) return "Root";
    if (node.morphemeKey.startsWith("lex:")) return "Lexeme";
  }
  const g = (node.gloss || "").toLowerCase();
  if (g.includes("prefix")) return "Prefix";
  if (g.includes("suffix")) return "Suffix";
  if (g.includes("free morpheme")) return "Lexeme";
  if (g.includes("bound root")) return "Root";
  if (g.includes("verb stem")) return "Verb stem";
  if (g.includes("noun stem")) return "Noun stem";
  if (g.includes("adjective stem")) return "Adj. stem";
  if (g.startsWith("verb:") || g.startsWith("verb ")) return "Verb";
  if (g.startsWith("noun:") || g.startsWith("noun ")) return "Noun";
  if (g.startsWith("adjective:") || g.startsWith("adj:")) return "Adjective";
  if (g.includes("stem")) return "Stem";
  const t = node.text || "";
  if (t.startsWith("-")) return "Suffix";
  if (t.endsWith("-")) return "Prefix";
  return "Stem";
}

function makeLabel({ pos, text, gloss, isRoot }) {
  const div = document.createElement("div");
  div.className = "morph-lab" + (isRoot ? " morph-lab--root" : "");
  /** @type {HTMLElement | null} */
  let posEl = null;
  /** @type {HTMLElement | null} */
  let glossEl = null;
  if (pos) {
    const p = document.createElement("div");
    p.className = "morph-lab__pos";
    p.textContent = pos;
    div.appendChild(p);
    posEl = p;
  }
  const w = document.createElement("div");
  w.className = "morph-lab__word";
  w.textContent = text;
  div.appendChild(w);
  const detail = glossDetail(gloss);
  if (detail) {
    const ge = document.createElement("div");
    ge.className = "morph-lab__gloss";
    ge.textContent = detail;
    div.appendChild(ge);
    glossEl = ge;
  }
  const obj = new CSS2DObject(div);
  obj.userData.isRoot = isRoot;
  obj.userData.lodEls = { pos: posEl, word: w, gloss: glossEl };
  obj.userData.lodPrev = { g: -1, p: -1, w: -1 };
  return obj;
}

function buildWordGroup(word) {
  const group = new THREE.Group();
  group.userData.wordId = word.id;
  group.userData.meshes = [];
  group.userData.lines = [];

  const spread = 16.5;
  const { positions } = layoutSubtree(word.tree, 0, 0, spread);
  const meshes = new Map();

  for (const p of positions) {
    const { node, x, y, z, depth: treeDepth } = p;
    const isRoot = node === word.tree;
    const posLabel = nodePosLabel(node, isRoot);
    const r = isRoot ? 0.84 : node.morphemeKey ? 0.55 : 0.48;
    let hue = 0.38;
    if (isRoot) hue = 0.11;
    else if (node.morphemeKey) {
      if (node.morphemeKey.startsWith("pfx:")) hue = 0.56;
      else if (node.morphemeKey.startsWith("sfx:")) hue = 0.82;
      else if (node.morphemeKey.startsWith("lex:")) hue = 0.22;
      else hue = 0.14;
    } else {
      const pl = posLabel.toLowerCase();
      if (pl.includes("prefix")) hue = 0.56;
      else if (pl.includes("suffix")) hue = 0.82;
      else if (pl.includes("lexeme")) hue = 0.22;
      else if (pl.includes("root")) hue = 0.14;
    }
    const col = new THREE.Color().setHSL(hue, 0.72, 0.52);
    const mesh = sphere(r, col);
    mesh.position.set(x, y, z);
    mesh.userData.morphemeKey = node.morphemeKey || null;
    mesh.userData.wordId = word.id;
    mesh.userData.treeDepth = treeDepth;
    group.add(mesh);
    meshes.set(node, mesh);
    group.userData.meshes.push(mesh);
    if (node.morphemeKey) registerMorpheme(node.morphemeKey, mesh, word.id);

    const label = makeLabel({
      pos: posLabel,
      text: node.text,
      gloss: node.gloss || "",
      isRoot,
    });
    const lift = r + (isRoot ? 1.02 : 0.48);
    label.position.set(x, y - lift, z);
    group.add(label);
    mesh.userData.label = label;
  }

  for (const p of positions) {
    const { node } = p;
    if (!node.children || !node.children.length) continue;
    const parentMesh = meshes.get(node);
    for (const c of node.children) {
      const childMesh = meshes.get(c);
      if (parentMesh && childMesh) {
        const line = edgeLine(parentMesh.position.clone(), childMesh.position.clone(), 0x55ffcc, 0.9);
        line.userData.a = parentMesh;
        line.userData.b = childMesh;
        group.add(line);
        group.userData.lines.push(line);
      }
    }
  }

  return group;
}

function buildBridgeLines(scene) {
  const bridges = new THREE.Group();
  bridges.name = "morpheme-bridges";
  const mat = new THREE.LineBasicMaterial({
    color: 0xff4dd4,
    transparent: true,
    opacity: 0.62,
  });

  for (const key of Object.keys(morphemeRegistry)) {
    const arr = morphemeRegistry[key];
    if (arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].wordId === arr[j].wordId) continue;
        const geo = new THREE.BufferGeometry();
        const line = new THREE.Line(geo, mat.clone());
        line.userData.a = arr[i].mesh;
        line.userData.b = arr[j].mesh;
        line.userData.key = key;
        bridges.add(line);
      }
    }
  }
  scene.add(bridges);
  return bridges;
}

function updateBridgeLines(bridges) {
  bridges.children.forEach((line) => {
    if (!line.visible) return;
    if (!line.userData.a || !line.userData.b) return;
    line.userData.a.getWorldPosition(_vBridgeA);
    line.userData.b.getWorldPosition(_vBridgeB);
    line.geometry.setFromPoints([_vBridgeA, _vBridgeB]);
  });
}

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

function easeInOutCubic(t) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Overshoot pop (morphemes “burst” in the fast tail of the spawn) */
function easeOutBack(t, s = 1.55) {
  const x = Math.min(1, Math.max(0, t));
  const c1 = s;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateInternalTreeLine(line) {
  const a = line.userData.a;
  const b = line.userData.b;
  if (!a || !b || !line.geometry) return;
  line.geometry.setFromPoints([a.position, b.position]);
}

const SINGULARITY = new THREE.Vector3(0, -8, 0);
/** Per-morpheme spawn (slow → furious) → several camera orbits → settle */
const INTRO_SPAWN_POWER = 1.72;
const INTRO_SPAWN_SPREAD = 5.35;
const INTRO_POP_DUR_SLOW = 0.62;
const INTRO_POP_DUR_FAST = 0.2;
const INTRO_T_ORBIT = 13.2;
const INTRO_T_SETTLE = 2.05;
const INTRO_ORBIT_RADIUS = 64;
const INTRO_ORBIT_HEIGHT = 24;
/** Full 360° revolutions during the orbit phase */
const INTRO_SPIN_TURNS = 3.35;
/** Ring radius when trees peel out from the singularity (world XZ) */
const INTRO_RING_RADIUS = 54;

function init(host, detailEl, selectEl, shellEl) {
  assignGrid2d();
  assignWhiteboardCircle();
  Object.keys(morphemeRegistry).forEach((k) => delete morphemeRegistry[k]);

  const scene = new THREE.Scene();
  const bg3d = new THREE.Color(0x0a0e1a);
  const bg2d = new THREE.Color(0xf7f8fc);
  scene.background = bg3d.clone();
  scene.fog = new THREE.FogExp2(0x0a1528, 0.0085);

  const clock = new THREE.Clock();
  const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 600);
  const introStartPos = new THREE.Vector3(8, 58, 118);
  const focusCenter = new THREE.Vector3(0, -12, 0);
  const cam3dPos = new THREE.Vector3(22, 26, 62);
  const cam3dTarget = focusCenter.clone();
  camera.position.copy(REDUCED_MOTION ? cam3dPos : introStartPos);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  host.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(host.clientWidth, host.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  host.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 8;
  controls.maxDistance = 300;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.target.copy(cam3dTarget);
  controls.enabled = false;
  /** Hysteresis: avoid flipping min/max distance when blend hovers near the threshold (causes zoom snapping). */
  controls.userData.wbZoomLimits = false;

  function refreshControlsForViewMode(blend) {
    const u = smoothstep(blend);
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = u < 0.12;
    const enterWbZoom = u > 0.92;
    const exitWbZoom = u < 0.78;
    if (enterWbZoom && !controls.userData.wbZoomLimits) {
      controls.userData.wbZoomLimits = true;
      controls.minDistance = 40;
      controls.maxDistance = 520;
    } else if (exitWbZoom && controls.userData.wbZoomLimits) {
      controls.userData.wbZoomLimits = false;
      controls.minDistance = 8;
      controls.maxDistance = 300;
    }
  }

  const ambient3d = new THREE.AmbientLight(0x6a8cff, 0.38);
  const key3d = new THREE.DirectionalLight(0xffffff, 1.1);
  key3d.position.set(28, 50, 32);
  const rim3d = new THREE.PointLight(0xff6ad5, 0.85, 200);
  rim3d.position.set(-28, 18, -18);
  const fill3d = new THREE.PointLight(0x44ffd0, 0.5, 160);
  fill3d.position.set(40, -8, 28);
  scene.add(ambient3d, key3d, rim3d, fill3d);

  const ambient2d = new THREE.AmbientLight(0xffffff, 0.95);
  const key2d = new THREE.DirectionalLight(0xffffff, 0.55);
  key2d.position.set(0.3, 1, 0.65);
  ambient2d.visible = false;
  key2d.visible = false;
  scene.add(ambient2d, key2d);

  const grid = new THREE.GridHelper(220, 44, 0x00ffc8, 0x1a3048);
  grid.position.y = -22;
  scene.add(grid);

  const wordGroups = {};
  for (const w of WORDS) {
    const g = buildWordGroup(w);
    g.position.copy(w.pos3d);
    scene.add(g);
    wordGroups[w.id] = g;
  }

  const bridges = buildBridgeLines(scene);

  const gardenHints = new THREE.Group();
  gardenHints.name = "garden-hints";
  gardenHints.visible = false;
  scene.add(gardenHints);
  const hintLineMat = new THREE.LineBasicMaterial({
    color: 0xaaccff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();

  const sceneCenter = new THREE.Vector3();
  for (const w of WORDS) sceneCenter.add(w.pos3d);
  sceneCenter.multiplyScalar(1 / WORDS.length);

  /** @type {Record<string, THREE.Vector3>} */
  const introCirclePos = {};
  WORDS.forEach((w, idx) => {
    const a = (idx / WORDS.length) * Math.PI * 2 + 0.35;
    introCirclePos[w.id] = new THREE.Vector3(
      sceneCenter.x + Math.cos(a) * INTRO_RING_RADIUS,
      sceneCenter.y,
      sceneCenter.z + Math.sin(a) * INTRO_RING_RADIUS
    );
  });

  function rebuildGardenHints(focusWordId) {
    while (gardenHints.children.length) {
      const o = gardenHints.children[0];
      gardenHints.remove(o);
      if (o.geometry) o.geometry.dispose();
    }
    if (!focusWordId) return;
    const fg = wordGroups[focusWordId];
    if (!fg) return;
    const box = new THREE.Box3().setFromObject(fg);
    const c = box.getCenter(new THREE.Vector3());
    for (const w of WORDS) {
      if (w.id === focusWordId) continue;
      const end = w.pos3d.clone();
      end.y = c.y;
      const geo = new THREE.BufferGeometry().setFromPoints([c, end]);
      gardenHints.add(new THREE.Line(geo, hintLineMat));
    }
  }

  function clearWbPrune(g) {
    if (!g?.userData?.meshes) return;
    delete g.userData.wbPruneDepth;
    for (const mesh of g.userData.meshes) {
      mesh.scale.setScalar(1);
      if (mesh.userData.label) mesh.userData.label.visible = true;
    }
    for (const ln of g.userData.lines) {
      if (ln) ln.visible = true;
    }
  }

  /** @type {{ mesh: THREE.Mesh, label?: THREE.Object3D, tStart: number, popDur: number, fp: THREE.Vector3, fl?: THREE.Vector3 }[]} */
  const introSpawnList = [];
  let introPhaseAEnd = 0.35;

  if (!REDUCED_MOTION) {
    const allMeshes = [];
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      g.position.copy(SINGULARITY);
      g.scale.setScalar(1);
      g.rotation.y = 0;
      for (const mesh of g.userData.meshes) {
        mesh.userData.introFinalPos = mesh.position.clone();
        const lab = mesh.userData.label;
        if (lab) lab.userData.introFinalPos = lab.position.clone();
        allMeshes.push(mesh);
        mesh.position.set(0, 0, 0);
        mesh.scale.setScalar(0.018);
        if (lab) lab.position.set(0, 0.5, 0);
      }
      for (const line of g.userData.lines) {
        line.material.opacity = 0;
        updateInternalTreeLine(line);
      }
    }

    shuffleInPlace(allMeshes);
    const n = allMeshes.length;
    const denom = Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      const mesh = allMeshes[i];
      const lab = mesh.userData.label;
      const tStart = INTRO_SPAWN_SPREAD * (i / denom) ** INTRO_SPAWN_POWER;
      const burst = i / denom;
      const popDur = INTRO_POP_DUR_FAST + (INTRO_POP_DUR_SLOW - INTRO_POP_DUR_FAST) * (1 - burst) ** 1.35;
      introPhaseAEnd = Math.max(introPhaseAEnd, tStart + popDur);
      introSpawnList.push({
        mesh,
        label: lab,
        tStart,
        popDur,
        fp: /** @type {THREE.Vector3} */ (mesh.userData.introFinalPos),
        fl: lab?.userData.introFinalPos,
      });
    }
  } else {
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      g.position.copy(w.pos3d);
      g.scale.setScalar(1);
      g.rotation.y = 0;
    }
  }

  bridges.visible = false;
  bridges.children.forEach((line) => {
    if (line.material) line.material.opacity = 0;
  });
  grid.visible = false;

  function finishIntroGroups() {
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      g.position.copy(w.pos3d);
      g.scale.setScalar(1);
      g.rotation.y = 0;
      for (const mesh of g.userData.meshes) {
        const fp = mesh.userData.introFinalPos;
        if (fp) mesh.position.copy(fp);
        mesh.scale.setScalar(1);
        const lab = mesh.userData.label;
        const fl = lab?.userData.introFinalPos;
        if (lab && fl) lab.position.copy(fl);
      }
      for (const line of g.userData.lines) {
        updateInternalTreeLine(line);
        if (line.material) line.material.opacity = 0.9;
      }
    }
    bridges.visible = true;
    bridges.children.forEach((line) => {
      if (line.material) line.material.opacity = 0.62;
    });
    grid.visible = true;
  }

  let viewTarget = 0;
  let viewBlend = 0;
  let transition = null;
  /** @type {string | null} */
  let autoRotateAnchorUuid = null;

  function isGardenScope() {
    return !selectEl || selectEl.value === GARDEN_SELECT;
  }

  function flyToOverview() {
    cam3dTarget.copy(sceneCenter);
    cam3dPos.set(sceneCenter.x + 8, sceneCenter.y + 44, sceneCenter.z + 122);
    if (viewBlend < 0.06 && transition === null) {
      camera.position.copy(cam3dPos);
      controls.target.copy(cam3dTarget);
    }
    controls.update();
  }

  function applyScopeVisibility() {
    const garden = isGardenScope();
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      if (!g) continue;
      g.visible = garden || !!(selectEl && w.id === selectEl.value);
    }
    rebuildGardenHints(garden ? null : selectEl?.value || null);
  }

  function flyToActiveView() {
    if (isGardenScope()) flyToOverview();
    else if (selectEl) flyToWord(selectEl.value);
  }

  function flyToWord(id) {
    const g = wordGroups[id];
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    focusCenter.copy(c);
    cam3dTarget.copy(c);
    cam3dPos.copy(c).add(new THREE.Vector3(18, 16, 36));
    if (viewBlend < 0.06 && transition === null) {
      camera.position.copy(cam3dPos);
      controls.target.copy(cam3dTarget);
    }
    controls.update();
  }

  function fillDetail(wordId) {
    const w = WORDS.find((x) => x.id === wordId);
    if (!w || !detailEl) return;
    let html = `<strong>${w.label}</strong>`;
    html += `<div class="morph-bracket">${w.bracket}</div>`;
    html += `<p>${w.note}</p>`;
    if (w.context) html += `<p class="morph-context">${w.context}</p>`;
    detailEl.innerHTML = html;
  }

  function fillDetailFromSelect() {
    if (!detailEl) return;
    if (!selectEl || selectEl.value === GARDEN_SELECT) {
      detailEl.innerHTML = `<p><strong>Garden view.</strong> Every tree is shown together. Choose one word from the menu to <strong>isolate</strong> it: in 3D, faint lines suggest where the other words sit; on the whiteboard, a single tree moves to the center. Double-click a node to focus the camera (3D) or trim the tree / list shared morphemes (whiteboard).</p>`;
      return;
    }
    fillDetail(selectEl.value);
  }

  const morphPop = document.createElement("div");
  morphPop.className = "morph-morpheme-pop morph-morpheme-pop--hidden";
  morphPop.setAttribute("role", "dialog");
  morphPop.setAttribute("aria-label", "Words sharing this morpheme");
  host.appendChild(morphPop);

  function hideMorphemePop() {
    morphPop.classList.add("morph-morpheme-pop--hidden");
    morphPop.innerHTML = "";
  }

  function showMorphemePop(key) {
    const list = morphemeRegistry[key];
    if (!list || list.length < 2) {
      hideMorphemePop();
      return;
    }
    const items = [...new Set(list.map((x) => x.wordId))]
      .map((id) => WORDS.find((w) => w.id === id))
      .filter(Boolean)
      .map((w) => `<li><button type="button" class="morph-morpheme-pop__pick" data-morph-sel="${w.id}">${w.label}</button></li>`)
      .join("");
    const shortKey = key.replace(/^(pfx|sfx|root|lex):/, "");
    morphPop.innerHTML = `<div class="morph-morpheme-pop__inner"><h3 class="morph-morpheme-pop__h">Also in the garden: <code>${shortKey}</code></h3><ul class="morph-morpheme-pop__list">${items}</ul><button type="button" class="morph-morpheme-pop__close">Close</button></div>`;
    morphPop.classList.remove("morph-morpheme-pop--hidden");
    morphPop.querySelector(".morph-morpheme-pop__close")?.addEventListener("click", hideMorphemePop);
    morphPop.querySelectorAll(".morph-morpheme-pop__pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sid = btn.getAttribute("data-morph-sel");
        if (selectEl && sid) {
          selectEl.value = sid;
          selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        }
        hideMorphemePop();
      });
    });
  }

  const firstWordId = WORDS[0].id;
  if (selectEl) {
    selectEl.innerHTML =
      `<option value="${GARDEN_SELECT}">All words — garden</option>` +
      WORDS.map((w) => `<option value="${w.id}">${w.label}</option>`).join("");
    selectEl.value = GARDEN_SELECT;
    selectEl.addEventListener("change", () => {
      hideMorphemePop();
      if (isGardenScope()) assignWhiteboardCircle();
      else assignWhiteboardIsolate(selectEl.value);
      for (const w of WORDS) clearWbPrune(wordGroups[w.id]);
      applyScopeVisibility();
      fillDetailFromSelect();
      if (viewBlend < 0.06 && !transition) flyToActiveView();
    });
    applyScopeVisibility();
    fillDetailFromSelect();
    flyToOverview();
  } else {
    flyToWord(firstWordId);
  }

  const fsBtn = document.getElementById("morph-btn-fs");
  const fsTarget = shellEl || host;
  if (fsBtn && fsTarget) {
    fsBtn.addEventListener("click", () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void fsTarget.requestFullscreen?.();
    });
  }

  renderer.domElement.addEventListener("dblclick", (ev) => {
    if (!controls.enabled) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const meshes = [];
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      if (!g?.visible) continue;
      meshes.push(...g.userData.meshes);
    }
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return;
    const mesh = /** @type {THREE.Mesh} */ (hit.object);
    const u = smoothstep(viewBlend);
    if (u < 0.12) {
      mesh.getWorldPosition(_orbitDblClickTarget);
      controls.target.copy(_orbitDblClickTarget);
      if (autoRotateAnchorUuid === mesh.uuid && controls.autoRotate) {
        controls.autoRotate = false;
        autoRotateAnchorUuid = null;
      } else {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.75;
        autoRotateAnchorUuid = mesh.uuid;
      }
      controls.update();
    } else {
      const wid = mesh.userData.wordId;
      const g = wordGroups[wid];
      if (g) {
        const D = mesh.userData.treeDepth ?? 0;
        g.userData.wbPruneDepth = D;
        for (const ln of g.userData.lines) {
          const a = ln.userData.a;
          const b = ln.userData.b;
          const da = a?.userData.treeDepth ?? 0;
          const db = b?.userData.treeDepth ?? 0;
          ln.visible = da <= D && db <= D;
        }
        for (const m of g.userData.meshes) {
          const hide = (m.userData.treeDepth ?? 0) > D;
          m.scale.setScalar(hide ? 0.05 : 1);
          if (m.userData.label) m.userData.label.visible = !hide;
        }
      }
      const mk = mesh.userData.morphemeKey;
      if (mk) showMorphemePop(mk);
    }
  });

  const btn3d = document.getElementById("morph-btn-3d");
  const btn2d = document.getElementById("morph-btn-2d");

  function setViewButtons() {
    const is2 = viewTarget >= 0.5;
    if (btn3d) {
      btn3d.classList.toggle("morph-view-btn--active", !is2);
      btn3d.setAttribute("aria-pressed", (!is2).toString());
    }
    if (btn2d) {
      btn2d.classList.toggle("morph-view-btn--active", is2);
      btn2d.setAttribute("aria-pressed", is2.toString());
    }
  }

  function startTransition(to2d) {
    controls.autoRotate = false;
    autoRotateAnchorUuid = null;
    const next = to2d ? 1 : 0;
    if (next === viewTarget && transition === null && Math.abs(viewBlend - next) < 0.02) return;

    const cam0 = camera.position.clone();
    const tgt0 = controls.target.clone();
    let cam1;
    let tgt1;

    if (to2d) {
      cam1 = new THREE.Vector3(0, 28, 168);
      tgt1 = new THREE.Vector3(0, -10, 0);
    } else {
      flyToActiveView();
      cam1 = cam3dPos.clone();
      tgt1 = cam3dTarget.clone();
    }

    transition = {
      t0: clock.elapsedTime,
      fromBlend: viewBlend,
      toBlend: next,
      cam0,
      tgt0,
      cam1,
      tgt1,
    };
    viewTarget = next;
    setViewButtons();
  }

  if (btn3d) btn3d.addEventListener("click", () => startTransition(false));
  if (btn2d) btn2d.addEventListener("click", () => startTransition(true));

  function applyVisualTheme(blend) {
    const u = smoothstep(blend);
    scene.background.copy(bg3d).lerp(bg2d, u);
    scene.fog.color.copy(scene.background);
    scene.fog.density = 0.0085 * (1 - u);

    grid.visible = u < 0.35;
    ambient3d.intensity = 0.38 * (1 - u);
    key3d.intensity = 1.1 * (1 - u);
    rim3d.intensity = 0.85 * (1 - u);
    fill3d.intensity = 0.5 * (1 - u);
    ambient2d.visible = u > 0.2;
    key2d.visible = u > 0.2;

    host.classList.toggle("morph-canvas-host--wb", u > 0.88);
    if (shellEl) shellEl.classList.toggle("morphology-shell--wb", u > 0.88);

    const bridgeOpacity = 0.62 * (1 - u) * (1 - u);
    const isolate3d = selectEl && selectEl.value !== GARDEN_SELECT && u < 0.38;
    bridges.children.forEach((line) => {
      if (line.material) line.material.opacity = isolate3d ? 0 : bridgeOpacity;
      line.visible = !isolate3d && u < 0.92;
    });
    gardenHints.visible = isolate3d && u < 0.26;

    for (const w of WORDS) {
      const g = wordGroups[w.id];
      if (!g) continue;
      g.position.lerpVectors(w.pos3d, w.pos2d, u);

      const sway = (1 - u) * Math.sin(clock.elapsedTime * 0.1 + w.pos3d.x * 0.02) * 0.045;
      g.rotation.y = sway;

      const dim = 0.08 * u;
      for (const mesh of g.userData.meshes) {
        const m = mesh.material;
        m.metalness = 0.5 * (1 - u) + 0.12 * u;
        m.roughness = 0.35 * (1 - u) + 0.55 * u;
        m.emissiveIntensity = 0.12 * (1 - u) + 0.04 * u;
        if (mesh.userData.baseEmissive)
          m.emissive.copy(mesh.userData.baseEmissive).multiplyScalar(1 - dim);
      }
      const line3 = 0x33ddaa;
      const line2 = 0x1a4d44;
      const lc = new THREE.Color(line3).lerp(new THREE.Color(line2), u);
      for (const line of g.userData.lines) {
        line.material.color.copy(lc);
        line.material.opacity = 0.88 * (1 - u) + 0.95 * u;
      }
    }

    refreshControlsForViewMode(blend);
  }

  /* Intro overlay */
  const intro = document.createElement("div");
  intro.className = "morph-intro";
  intro.innerHTML = `
    <div class="morph-intro-chrome">
      <div class="morph-intro-grid" aria-hidden="true"></div>
      <div class="morph-intro-head">
        <div class="morph-intro-title">Morphology</div>
        <div class="morph-intro-sub">The Analysis of Words · Ch. 4</div>
        <div class="morph-intro-tag">● Word trees · 3D &amp; whiteboard ●</div>
      </div>
    </div>
  `;
  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className = "morph-skip";
  skipBtn.textContent = "Skip intro";
  intro.appendChild(skipBtn);
  host.appendChild(intro);

  let introDone = false;
  let introT = 0;

  let introSpinAngle = 0;
  const introSettle = {
    captured: false,
    fromPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
  };

  if (REDUCED_MOTION) {
    intro.remove();
    introDone = true;
    finishIntroGroups();
    flyToActiveView();
    camera.position.copy(cam3dPos);
    controls.target.copy(cam3dTarget);
    controls.enabled = true;
    controls.update();
  }

  function endIntro() {
    if (introDone) return;
    introDone = true;
    intro.remove();
    finishIntroGroups();
    flyToActiveView();
    camera.position.copy(cam3dPos);
    controls.target.copy(cam3dTarget);
    controls.enabled = true;
    controls.update();
  }

  skipBtn.addEventListener("click", endIntro);

  setViewButtons();

  const introTmp0 = new THREE.Vector3();
  const introTmp1 = new THREE.Vector3();
  const lodWorld = new THREE.Vector3();

  window.addEventListener("resize", () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    labelRenderer.setSize(host.clientWidth, host.clientHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.064);
    introT += dt;

    if (!introDone && !REDUCED_MOTION) {
      if (introT < introPhaseAEnd) {
        for (const row of introSpawnList) {
          const { mesh, label, tStart, popDur, fp, fl } = row;
          if (introT <= tStart) {
            mesh.position.set(0, 0, 0);
            mesh.scale.setScalar(0.018);
            if (label) label.position.set(0, 0.5, 0);
          } else {
            const raw = Math.min(1, (introT - tStart) / popDur);
            const uPos = easeOutCubic(raw);
            const uPop = Math.min(1, easeOutBack(raw));
            introTmp0.set(0, 0, 0);
            mesh.position.lerpVectors(introTmp0, fp, uPos);
            mesh.scale.setScalar(0.018 + 0.982 * uPop);
            if (label && fl) {
              introTmp1.set(0, 0.5, 0);
              label.position.lerpVectors(introTmp1, fl, uPos);
            }
          }
        }

        for (const w of WORDS) {
          for (const line of wordGroups[w.id].userData.lines) {
            updateInternalTreeLine(line);
          }
        }

        const spawnProg = Math.min(1, introT / introPhaseAEnd);
        const lineReveal = smoothstep((spawnProg - 0.28) / 0.55);
        for (const w of WORDS) {
          for (const line of wordGroups[w.id].userData.lines) {
            if (line.material) line.material.opacity = 0.88 * lineReveal;
          }
        }

        const bloomBridge = smoothstep((spawnProg - 0.38) / 0.42);
        bridges.visible = bloomBridge > 0.03;
        bridges.children.forEach((line) => {
          if (line.material) line.material.opacity = 0.62 * bloomBridge;
        });
        grid.visible = spawnProg > 0.06;

        const pull = easeInOutCubic(spawnProg);
        const orbitEntry = new THREE.Vector3(
          sceneCenter.x + INTRO_ORBIT_RADIUS * 0.92,
          sceneCenter.y + INTRO_ORBIT_HEIGHT + 18,
          sceneCenter.z + INTRO_ORBIT_RADIUS * 0.92
        );
        camera.position.lerpVectors(introStartPos, orbitEntry, pull);
        controls.target.lerpVectors(SINGULARITY, sceneCenter, pull);
      } else if (introT < introPhaseAEnd + INTRO_T_ORBIT) {
        const orbitElapsed = introT - introPhaseAEnd;
        const u = Math.min(1, orbitElapsed / INTRO_T_ORBIT);
        const spreadU = easeInOutCubic(Math.min(1, u / 0.4));
        const phi = easeInOutCubic(u) * Math.PI * 2 * INTRO_SPIN_TURNS;

        introSpinAngle = phi;
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          const phase = w.pos3d.x * 0.002 + w.pos3d.z * 0.0015;
          grp.rotation.y = introSpinAngle + phase * 0.09;
          grp.position.lerpVectors(SINGULARITY, introCirclePos[w.id], spreadU);
        }

        const R = INTRO_ORBIT_RADIUS;
        const y = sceneCenter.y + INTRO_ORBIT_HEIGHT;
        camera.position.set(
          sceneCenter.x + Math.cos(phi) * R,
          y,
          sceneCenter.z + Math.sin(phi) * R
        );
        controls.target.copy(sceneCenter);

        bridges.visible = true;
        bridges.children.forEach((line) => {
          if (line.material) line.material.opacity = 0.62;
        });
        grid.visible = true;
      } else {
        const settleElapsed = introT - introPhaseAEnd - INTRO_T_ORBIT;
        const se = Math.min(1, settleElapsed / INTRO_T_SETTLE);
        const spinDamp = 1 - easeOutCubic(se);
        const kPos = easeOutCubic(se);
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          const phase = w.pos3d.x * 0.002 + w.pos3d.z * 0.0015;
          grp.rotation.y = (introSpinAngle + phase * 0.09) * spinDamp;
          grp.position.lerpVectors(introCirclePos[w.id], w.pos3d, kPos);
        }

        if (!introSettle.captured) {
          introSettle.captured = true;
          introSettle.fromPos.copy(camera.position);
          introSettle.fromTarget.copy(controls.target);
          flyToActiveView();
        }
        const k = easeOutCubic(se);
        camera.position.lerpVectors(introSettle.fromPos, cam3dPos, k);
        controls.target.lerpVectors(introSettle.fromTarget, cam3dTarget, k);
        if (se >= 1) endIntro();
      }
    }

    if (transition) {
      const elapsed = clock.elapsedTime - transition.t0;
      const k = Math.min(1, elapsed / TRANSITION_SEC);
      const e = smoothstep(k);
      viewBlend = transition.fromBlend + (transition.toBlend - transition.fromBlend) * e;
      camera.position.lerpVectors(transition.cam0, transition.cam1, e);
      controls.target.lerpVectors(transition.tgt0, transition.tgt1, e);
      if (k >= 1) {
        viewBlend = transition.toBlend;
        transition = null;
        const ue = smoothstep(viewBlend);
        if (ue > 0.9) {
          controls.userData.wbZoomLimits = true;
          controls.minDistance = 40;
          controls.maxDistance = 520;
        } else {
          controls.userData.wbZoomLimits = false;
          controls.minDistance = 8;
          controls.maxDistance = 300;
        }
      }
    }

    if (introDone) applyVisualTheme(viewBlend);

    if (introDone) {
      const uLodView = smoothstep(viewBlend);
      if (uLodView > 0.84) {
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          if (!grp?.visible) continue;
          for (const mesh of grp.userData.meshes) {
            const lab = mesh.userData.label;
            const els = lab?.userData?.lodEls;
            const prev = lab?.userData?.lodPrev;
            if (!els || !prev) continue;
            if (els.gloss && Math.abs(prev.g - 1) > LOD_OPACITY_EPS) {
              els.gloss.style.opacity = "1";
              prev.g = 1;
            }
            if (els.pos && Math.abs(prev.p - 1) > LOD_OPACITY_EPS) {
              els.pos.style.opacity = "1";
              prev.p = 1;
            }
            if (els.word && Math.abs(prev.w - 1) > LOD_OPACITY_EPS) {
              els.word.style.opacity = "1";
              prev.w = 1;
            }
          }
        }
      } else {
        const camP = camera.position;
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          if (!grp?.visible) continue;
          for (const mesh of grp.userData.meshes) {
            const lab = mesh.userData.label;
            const els = lab?.userData?.lodEls;
            const prev = lab?.userData?.lodPrev;
            if (!els || !prev) continue;
            mesh.getWorldPosition(lodWorld);
            const d = camP.distanceTo(lodWorld);
            const gA = Math.max(0, Math.min(1, 1 - smoothstep((d - 14) / 22)));
            const pA = Math.max(0, Math.min(1, 1 - smoothstep((d - 30) / 30)));
            const wA = Math.max(0, Math.min(1, 1 - smoothstep((d - 50) / 42)));
            if (els.gloss && Math.abs(gA - prev.g) > LOD_OPACITY_EPS) {
              els.gloss.style.opacity = String(gA);
              prev.g = gA;
            }
            if (els.pos && Math.abs(pA - prev.p) > LOD_OPACITY_EPS) {
              els.pos.style.opacity = String(pA);
              prev.p = pA;
            }
            if (els.word && Math.abs(wA - prev.w) > LOD_OPACITY_EPS) {
              els.word.style.opacity = String(wA);
              prev.w = wA;
            }
          }
        }
      }
    }

    controls.update();
    if (bridges.visible) updateBridgeLines(bridges);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  animate();
}

const host = document.getElementById("morph-canvas-host");
if (host) {
  init(
    host,
    document.getElementById("morph-detail"),
    document.getElementById("morph-word-select"),
    document.getElementById("morphology-shell")
  );
}

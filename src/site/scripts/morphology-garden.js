/**
 * Morphology Garden — 3D + animated whiteboard view, shared morpheme bridges.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { configureLessonWordLookup, renderMorphLessonHtml } from "./morphology-lessons-data.js";

/** Reused vectors — avoids per-frame allocations in bridge updates */
const _vBridgeA = new THREE.Vector3();
const _vBridgeB = new THREE.Vector3();
const _midBridge = new THREE.Vector3();
/** Segments along each morpheme bridge spline (3D arcs). */
const BRIDGE_SEG = 28;
/** @type {THREE.Vector3[] | null} */
let _bridgeArcPts = null;

function bridgeArcEnsure(seg) {
  if (!_bridgeArcPts || _bridgeArcPts.length !== seg + 1) {
    _bridgeArcPts = Array.from({ length: seg + 1 }, () => new THREE.Vector3());
  }
  return _bridgeArcPts;
}

function quadBezierPoint(out, a, ctrl, b, t) {
  const o = 1 - t;
  out.copy(a).multiplyScalar(o * o).addScaledVector(ctrl, 2 * o * t).addScaledVector(b, t * t);
}
const _orbitDblClickTarget = new THREE.Vector3();
const _posFrom = new THREE.Vector3();
const _posTo = new THREE.Vector3();
const morphInspectTargetVec = new THREE.Vector3();
const _morphCamDir = new THREE.Vector3();
const _morphToNode = new THREE.Vector3();
const _morphFitBox = new THREE.Box3();
const _morphFitCenter = new THREE.Vector3();
const _morphFitSize = new THREE.Vector3();
const _keyPanFwd = new THREE.Vector3();
const _keyPanRight = new THREE.Vector3();
const _keyOrbitOff = new THREE.Vector3();
const _yAxisUp = new THREE.Vector3(0, 1, 0);

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TRANSITION_SEC = REDUCED_MOTION ? 0.01 : 1.48;
/** Skip tiny DOM writes when LOD opacity barely changes */
const LOD_OPACITY_EPS = 0.02;

/** Select “all trees” instead of isolating one */
const GARDEN_SELECT = "__garden__";

/** Whiteboard: trees on a circle (garden) vs one tree centered (isolate) */
/** Wider spacing on the whiteboard ring so neighboring trees / labels overlap less */
const WB_CIRCLE_RADIUS = 112;

/** @type {Record<string, { mesh: THREE.Mesh, wordId: string }[]>} */
const morphemeRegistry = {};

function registerMorpheme(key, mesh, wordId) {
  if (!key) return;
  if (!morphemeRegistry[key]) morphemeRegistry[key] = [];
  morphemeRegistry[key].push({ mesh, wordId });
}

/**
 * Thinkmap Visual Thesaurus is proprietary (see visualthesaurus.com); no open-source app code.
 * Manual highlights useful patterns we echo: center-focused exploration, hover definitions, clear help.
 */
function getStoredMorphCurriculum() {
  try {
    const q = new URLSearchParams(window.location.search).get("set");
    if (q === "elementary" || q === "middle" || q === "high") return q;
    const v = localStorage.getItem("morphCurriculum");
    if (v === "elementary" || v === "middle" || v === "high") return v;
  } catch (_) {}
  return "elementary";
}

/** Intro runs once per browser tab session so curriculum reload / in-page navigation does not replay it */
const MORPH_INTRO_SESSION_KEY = "morphGardenIntroPlayed";
function morphIntroPlayedThisSession() {
  try {
    return sessionStorage.getItem(MORPH_INTRO_SESSION_KEY) === "1";
  } catch (_) {
    return false;
  }
}
function morphIntroMarkPlayed() {
  try {
    sessionStorage.setItem(MORPH_INTRO_SESSION_KEY, "1");
  } catch (_) {
    /* ignore */
  }
}

function morphIntroEsc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** One row per letter in “MORPHOLOGY”: full word + morpheme chips for the title-card mini-trees */
const INTRO_OVERLAY_LEXEMES = [
  { word: "Multitude", parts: ["multi-", "-tude"] },
  { word: "Organization", parts: ["organ", "-ize", "-ation"] },
  { word: "Revolution", parts: ["re-", "volu", "-tion"] },
  { word: "Philosophy", parts: ["philo", "-sophy"] },
  { word: "Hospitalize", parts: ["hospital", "-ize"] },
  { word: "Order", parts: ["order"] },
  { word: "Language", parts: ["langu-", "-age"] },
  { word: "Oddity", parts: ["odd", "-ity"] },
  { word: "Generous", parts: ["gener", "-ous"] },
  { word: "Yardstick", parts: ["yard", "stick"] },
];

function cloneWordList(arr) {
  return JSON.parse(JSON.stringify(arr));
}

const ALL_WORD_DATA = [
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
  {
    id: "teacher",
    label: "Teacher",
    bracket: "[teach + -er]",
    note: "Agentive <strong>-er</strong> (person who): compare <em>finisher</em> and comparative <em>wiser</em> in other trees.",
    position: [22, 0, 48],
    tree: {
      text: "teacher",
      gloss: "noun: one who teaches",
      children: [
        {
          text: "teach",
          gloss: "free morpheme: to instruct",
          morphemeKey: "lex:teach",
          children: [],
        },
        {
          text: "-er",
          gloss: "suffix: one who (often agentive)",
          morphemeKey: "sfx:-er",
          children: [],
        },
      ],
    },
  },
  {
    id: "unhappy",
    label: "Unhappy",
    bracket: "[un- + happy]",
    note: "Productive <strong>un-</strong> ‘not’ on an adjective stem—same prefix family as <em>unwise</em>.",
    position: [-20, 0, 48],
    tree: {
      text: "unhappy",
      gloss: "adjective: not happy",
      children: [
        {
          text: "un-",
          gloss: "prefix: not, opposite of",
          morphemeKey: "pfx:un-",
          children: [],
        },
        {
          text: "happy",
          gloss: "free morpheme: glad, pleased",
          morphemeKey: "lex:happy",
          children: [],
        },
      ],
    },
  },
  {
    id: "baseball",
    label: "Baseball",
    bracket: "[base + ball]",
    note: "Compound noun: two free morphemes, like <em>rainbow</em> and <em>hallway</em>.",
    position: [34, 0, 40],
    tree: {
      text: "baseball",
      gloss: "noun: bat-and-ball sport; the ball",
      children: [
        {
          text: "base",
          gloss: "free morpheme: foundation; station",
          morphemeKey: "lex:base",
          children: [],
        },
        {
          text: "ball",
          gloss: "free morpheme: sphere; game object",
          morphemeKey: "lex:ball",
          children: [],
        },
      ],
    },
  },
  {
    id: "toothbrush",
    label: "Toothbrush",
    bracket: "[tooth + brush]",
    note: "Endocentric compound: a brush for teeth—stress and class often follow the right element.",
    position: [-32, 0, 44],
    tree: {
      text: "toothbrush",
      gloss: "noun: brush for cleaning teeth",
      children: [
        {
          text: "tooth",
          gloss: "free morpheme: dental crown",
          morphemeKey: "lex:tooth",
          children: [],
        },
        {
          text: "brush",
          gloss: "free morpheme: bristle tool",
          morphemeKey: "lex:brush",
          children: [],
        },
      ],
    },
  },
  {
    id: "national",
    label: "National",
    bracket: "[nation + -al]",
    note: "Derivational <strong>-al</strong> ‘pertaining to’—same suffix family as <em>final</em>.",
    position: [40, 0, -38],
    tree: {
      text: "national",
      gloss: "adjective: of a nation",
      children: [
        {
          text: "-al",
          gloss: "suffix: pertaining to (derivational)",
          morphemeKey: "sfx:-al",
          children: [
            {
              text: "nation",
              gloss: "free morpheme: country; people",
              morphemeKey: "lex:nation",
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: "careful",
    label: "Careful",
    bracket: "[care + -ful]",
    note: "Suffix <strong>-ful</strong> ‘full of, tending to’ builds adjectives from noun stems.",
    position: [-40, 0, -36],
    tree: {
      text: "careful",
      gloss: "adjective: cautious; thorough",
      children: [
        {
          text: "care",
          gloss: "free morpheme: concern; caution",
          morphemeKey: "lex:care",
          children: [],
        },
        {
          text: "-ful",
          gloss: "suffix: full of; characterized by",
          morphemeKey: "sfx:-ful",
          children: [],
        },
      ],
    },
  },
  {
    id: "readable",
    label: "Readable",
    bracket: "[read + -able]",
    note: "Same <strong>-able</strong> pattern as <em>unlockable</em>—able to be read.",
    position: [8, 0, -50],
    tree: {
      text: "readable",
      gloss: "adjective: able to be read; legible",
      children: [
        {
          text: "read",
          gloss: "free morpheme: interpret text",
          morphemeKey: "lex:read",
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
  },
  {
    id: "preview",
    label: "Preview",
    bracket: "[pre- + view]",
    note: "Shares <strong>pre-</strong> ‘before’ with <em>presentation</em>—see before the full thing.",
    position: [-8, 0, -50],
    tree: {
      text: "preview",
      gloss: "noun/verb: look beforehand",
      children: [
        {
          text: "pre-",
          gloss: "prefix: before, in front",
          morphemeKey: "pfx:pre-",
          children: [],
        },
        {
          text: "view",
          gloss: "free morpheme: see; outlook",
          morphemeKey: "lex:view",
          children: [],
        },
      ],
    },
  },
  {
    id: "invisible",
    label: "Invisible",
    bracket: "[in- + vis + -ible]",
    note: "Bound stem <em>vis</em> ‘see’ plus adjective-forming <strong>-ible</strong> (parallel to <strong>-able</strong>).",
    position: [50, 0, 8],
    tree: {
      text: "invisible",
      gloss: "adjective: cannot be seen",
      children: [
        {
          text: "in-",
          gloss: "prefix: not, without",
          morphemeKey: "pfx:in-",
          children: [],
        },
        {
          text: "visible",
          gloss: "adjective stem: able to be seen",
          children: [
            {
              text: "vis",
              gloss: "bound root: see (as in vision)",
              morphemeKey: "root:vis",
              children: [],
            },
            {
              text: "-ible",
              gloss: "suffix: able to be (derivational)",
              morphemeKey: "sfx:-ible",
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    id: "predict",
    label: "Predict",
    bracket: "[pre- + dict]",
    note: "Latin-style ‘say beforehand’—<strong>pre-</strong> plus bound stem <em>dict</em> ‘say.’",
    position: [-50, 0, 8],
    tree: {
      text: "predict",
      gloss: "verb: say what will happen before it does",
      children: [
        {
          text: "pre-",
          gloss: "prefix: before",
          morphemeKey: "pfx:pre-",
          children: [],
        },
        {
          text: "dict",
          gloss: "bound root: say (as in dictionary)",
          morphemeKey: "root:dict",
          children: [],
        },
      ],
    },
  },
  {
    id: "transport",
    label: "Transport",
    bracket: "[trans- + port]",
    note: "Carry ‘across’—<strong>trans-</strong> ‘across, through’ with <em>port</em> ‘carry.’",
    position: [46, 0, -8],
    tree: {
      text: "transport",
      gloss: "verb/noun: carry across; transportation",
      children: [
        {
          text: "trans-",
          gloss: "prefix: across, through",
          morphemeKey: "pfx:trans-",
          children: [],
        },
        {
          text: "port",
          gloss: "bound root: carry (as in portable)",
          morphemeKey: "root:port",
          children: [],
        },
      ],
    },
  },
];

const CURRICULUM_IDS = {
  elementary: new Set([
    "hallway",
    "rainbow",
    "sourdough",
    "before",
    "freedom",
    "kingdom",
    "wisdom",
    "believe",
    "unwise",
    "unhappy",
    "teacher",
    "toothbrush",
  ]),
  middle: new Set([
    "final",
    "belief",
    "wiser",
    "finisher",
    "enable",
    "endure",
    "resistance",
    "national",
    "careful",
    "readable",
    "preview",
    "baseball",
  ]),
  high: new Set([
    "presentation",
    "inhospitable",
    "demarcation",
    "dehumanization",
    "revolution",
    "convince",
    "constitution",
    "unlockable-a",
    "unlockable-b",
    "invisible",
    "predict",
    "transport",
  ]),
};

const ACTIVE_CURRICULUM_KEY = getStoredMorphCurriculum();
const WORDS = cloneWordList(
  ALL_WORD_DATA.filter((w) => CURRICULUM_IDS[ACTIVE_CURRICULUM_KEY]?.has(w.id))
);

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

/** Master view: tight grid of meaning-clusters + spiral placement of words within each hub */
const MASTER_HUB_SPACING = 46;
const MASTER_WORD_RADIUS = 19;
/** Golden-angle step (rad) for fractal-like packing within a hub */
const MASTER_GOLDEN_ANGLE = 2.39996322972865332;

function collectMorphemeKeys(node, /** @type {Set<string>} */ out) {
  if (node.morphemeKey) out.add(node.morphemeKey);
  for (const c of node.children || []) collectMorphemeKeys(c, out);
}

/**
 * Place words into shared-morpheme clusters on a large ring (master tree view).
 * @param {THREE.Vector3} sceneCenter
 */
function assignMasterTreeLayout(sceneCenter) {
  /** @type {Map<string, Set<string>>} */
  const adj = new Map();
  for (const w of WORDS) adj.set(w.id, new Set());

  /** @type {Map<string, string[]>} */
  const keyToWords = new Map();
  for (const w of WORDS) {
    const ks = new Set();
    collectMorphemeKeys(w.tree, ks);
    for (const k of ks) {
      if (!keyToWords.has(k)) keyToWords.set(k, []);
      keyToWords.get(k).push(w.id);
    }
  }
  for (const list of keyToWords.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        adj.get(a)?.add(b);
        adj.get(b)?.add(a);
      }
    }
  }

  const seen = new Set();
  const components = [];
  for (const w of WORDS) {
    if (seen.has(w.id)) continue;
    const comp = [];
    const stack = [w.id];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id)) continue;
      seen.add(id);
      comp.push(id);
      for (const n of adj.get(id) || []) {
        if (!seen.has(n)) stack.push(n);
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);

  const baseY = sceneCenter.y - 5;
  const nComp = components.length;
  for (const w of WORDS) {
    if (!w.posMaster) w.posMaster = new THREE.Vector3();
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(nComp * 1.2)));
  const rows = Math.max(1, Math.ceil(nComp / cols));
  const ix0 = (cols - 1) * 0.5;
  const iz0 = (rows - 1) * 0.5;

  components.forEach((comp, ci) => {
    const row = Math.floor(ci / cols);
    const col = ci % cols;
    const cx = sceneCenter.x + (col - ix0) * MASTER_HUB_SPACING;
    const cz = sceneCenter.z + (row - iz0) * MASTER_HUB_SPACING;
    const m = comp.length;
    comp.forEach((wid, j) => {
      const w = WORDS.find((x) => x.id === wid);
      if (!w) return;
      let ox = 0;
      let oz = 0;
      if (m > 1) {
        const ang = j * MASTER_GOLDEN_ANGLE + ci * 1.05;
        const rad = MASTER_WORD_RADIUS * (0.28 + (0.72 * (j + 0.6)) / m);
        ox = Math.cos(ang) * rad;
        oz = Math.sin(ang) * rad;
      }
      const yy = baseY + (j % 3) * 0.85 + (ci % 2) * 0.4;
      w.posMaster.set(cx + ox, yy, cz + oz);
    });
  });
}

/**
 * Combined layout (“Garden…” / “Master…”) × surface (“…3d” = spatial rendering, “…Wb” = whiteboard skins).
 */
function posForViewKey(w, key) {
  if (key.startsWith("Master")) return w.posMaster;
  return key.endsWith("Wb") ? w.pos2d : w.pos3d;
}

function blendForViewKey(key) {
  return key.endsWith("Wb") ? 1 : 0;
}

function masterWtKey(key) {
  return key.startsWith("Master") ? 1 : 0;
}

/** Vertical gap between levels (apex at top → constituents branch outward in XZ) */
const TREE_DEPTH_STEP = 5.75;
/** Initial ring radius from apex; children recurse in smaller wedges for a fractal, bushy silhouette */
const TREE_LAYOUT_RADIUS0 = 13.6;

/** Lateral kick so unary chains (one child) do not stack in a straight vertical “pole” */
function unaryBranchJitter(depth) {
  return Math.sin(depth * 1.41) * 0.62 + ((depth % 3) - 1) * 0.32;
}

/**
 * 3D radial layout: each node’s children live on a ring below it, spaced within a wedge.
 * Full circle at the root; nested wedges give branching, non-collinear edges.
 * @returns {Array<{ node: object, x: number, y: number, z: number, depth: number }>}
 */
function layoutSubtree(node, depth, x, y, z, wedgeStart, wedgeSize, radius) {
  const positions = [{ node, x, y, z, depth }];
  const children = node.children || [];
  if (!children.length) return positions;

  const yChild = y - TREE_DEPTH_STEP;
  const n = children.length;
  const r = Math.max(4.1, Math.min(17, radius * (0.58 + 0.12 * n)));
  const wedge = Math.max(wedgeSize, 0.52 * n);

  for (let i = 0; i < n; i++) {
    const slice = wedge / n;
    const t0 = wedgeStart + i * slice;
    const t1 = t0 + slice;
    let theta = (t0 + t1) * 0.5;
    if (n === 1) {
      theta = wedgeStart + wedge * 0.5 + unaryBranchJitter(depth);
    }
    const cx = x + Math.cos(theta) * r;
    const cz = z + Math.sin(theta) * r;

    const subW = Math.min(Math.PI * 1.42, slice * 1.72);
    const subStart = t0 - (subW - slice) * 0.14;

    positions.push(...layoutSubtree(children[i], depth + 1, cx, yChild, cz, subStart, subW, r * 1.06));
  }
  return positions;
}

function sphere(r, color, roughness, metalness) {
  const g = new THREE.SphereGeometry(r, 28, 28);
  const m = new THREE.MeshStandardMaterial({
    color,
    metalness: metalness ?? 0.5,
    roughness: roughness ?? 0.35,
    emissive: color,
    emissiveIntensity: 0.09,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.userData.baseEmissive = color.clone();
  return mesh;
}

/** Glass halo around morpheme node; raycast disabled so picks hit the inner sphere. */
function morphShellSphere(innerR, baseColor, isRoot) {
  const geo = new THREE.SphereGeometry(innerR * 1.65, 28, 28);
  const shellCol = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.22);
  const mat = new THREE.MeshPhysicalMaterial({
    color: shellCol,
    transparent: true,
    opacity: isRoot ? 0.24 : 0.2,
    transmission: 0.85,
    thickness: 0.22,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(geo, mat);
  shell.raycast = () => {};
  shell.userData.isMorphShell = true;
  return shell;
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
  if (h.includes("function") && (h.includes("prep") || h.includes("adv"))) return "Function";
  if (h.startsWith("noun")) return "Noun";
  if (h.startsWith("adjective")) return "Adjective";
  if (h.startsWith("adj")) return "Adjective";
  if (h.includes("verb") && !h.includes("adverb")) return "Verb";
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
  const g0 = (node.gloss || "").toLowerCase();
  if (g0.includes("adjective stem")) return "Adj. stem";
  if (g0.includes("noun stem")) return "Noun stem";
  if (g0.includes("verb stem")) return "Verb stem";
  if (g0.startsWith("stem") || g0.includes("stem:")) return "Stem";
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

function makeLabel({ pos, text, isRoot }) {
  const div = document.createElement("div");
  div.className =
    "morph-lab morph-lab--orbital" + (isRoot ? " morph-lab--root morph-lab--apex" : "");
  /** @type {HTMLElement | null} */
  let posEl = null;
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
  const obj = new CSS2DObject(div);
  obj.userData.isRoot = isRoot;
  obj.userData.lodScale0 = isRoot ? 1.08 : 1;
  obj.userData.lodEls = { pos: posEl, word: w, gloss: null };
  obj.userData.lodPrev = { g: -1, p: -1, w: -1 };
  return obj;
}

function buildWordGroup(word) {
  const group = new THREE.Group();
  group.userData.wordId = word.id;
  group.userData.meshes = [];
  group.userData.lines = [];

  const positions = layoutSubtree(word.tree, 0, 0, 0, 0, 0, Math.PI * 2, TREE_LAYOUT_RADIUS0);
  const meshes = new Map();

  for (const p of positions) {
    const { node, x, y, z, depth: treeDepth } = p;
    const isRoot = node === word.tree;
    const posLabel = nodePosLabel(node, isRoot);
    const r = isRoot ? 0.88 : node.morphemeKey ? 0.56 : 0.49;
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
    const glossLine = node.gloss || "";
    mesh.userData.morphTooltip = {
      morpheme: node.text,
      category: posLabel,
      gloss: glossDetail(glossLine) || glossLine,
      wordLabel: word.label,
      morphemeKey: node.morphemeKey || null,
    };
    const shell = morphShellSphere(r, col, isRoot);
    mesh.add(shell);
    mesh.userData.shell = shell;
    mesh.userData.shellIsRoot = isRoot;
    group.add(mesh);
    meshes.set(node, mesh);
    group.userData.meshes.push(mesh);
    if (node.morphemeKey) registerMorpheme(node.morphemeKey, mesh, word.id);

    const label = makeLabel({
      pos: posLabel,
      text: node.text,
      isRoot,
    });
    const lift = r * (isRoot ? 0.45 : 0.38);
    label.position.set(x, y + lift, z);
    label.scale.setScalar(label.userData.lodScale0);
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

function updateBridgeLines(bridges, blendVal) {
  const uSurf = smoothstep(blendVal);
  const arc = bridges?.userData?.arc3d && uSurf < 0.48;
  const pts = arc ? bridgeArcEnsure(BRIDGE_SEG) : null;

  bridges.children.forEach((line) => {
    try {
      if (!line.visible) return;
      if (!line.userData.a || !line.userData.b) return;
      line.userData.a.getWorldPosition(_vBridgeA);
      line.userData.b.getWorldPosition(_vBridgeB);
      if (!Number.isFinite(_vBridgeA.x) || !Number.isFinite(_vBridgeB.x)) return;
      if (!arc) {
        line.geometry.setFromPoints([_vBridgeA, _vBridgeB]);
        return;
      }
      _midBridge.lerpVectors(_vBridgeA, _vBridgeB, 0.5);
      const dx = _vBridgeB.x - _vBridgeA.x;
      const dz = _vBridgeB.z - _vBridgeA.z;
      const distH = Math.hypot(dx, dz);
      const lift = THREE.MathUtils.clamp(distH * 0.16 + 7, 9, 38);
      _midBridge.y += lift;
      const n = BRIDGE_SEG;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        quadBezierPoint(pts[i], _vBridgeA, _midBridge, _vBridgeB, t);
      }
      line.geometry.setFromPoints(pts);
    } catch {
      /* bad bridge geometry — skip frame */
    }
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
/** Letter overlay + trees peel to garden (≤ ~12s) vs legacy long cinematic */
const USE_TYPO_INTRO = !REDUCED_MOTION;
/** Title phase (letters + overlay mini-trees) then 3D garden settle — keep total under ~15s */
const TYPO_LETTER_SEC = 4.65;
const TYPO_SETTLE_SEC = 3.15;
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
  const runIntroCinematic = !REDUCED_MOTION && USE_TYPO_INTRO && !morphIntroPlayedThisSession();
  assignGrid2d();
  assignWhiteboardCircle();
  Object.keys(morphemeRegistry).forEach((k) => delete morphemeRegistry[k]);

  const scene = new THREE.Scene();
  const bg3d = new THREE.Color(0x0a0e1a);
  const bg2d = new THREE.Color(0xf7f8fc);
  scene.background = bg3d.clone();

  const clock = new THREE.Clock();
  /** Monotonic seconds for scripted tweens (independent of THREE.Clock / getDelta quirks). */
  function morphWallSec() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now() * 0.001
      : typeof Date !== "undefined"
        ? Date.now() * 0.001
        : clock.elapsedTime;
  }
  const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 600);
  const introStartPos = new THREE.Vector3(8, 58, 118);
  const focusCenter = new THREE.Vector3(0, -12, 0);
  const cam3dPos = new THREE.Vector3(22, 28, 76);
  const cam3dTarget = focusCenter.clone();
  camera.position.copy(REDUCED_MOTION || !runIntroCinematic ? cam3dPos : introStartPos);

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
  controls.dampingFactor = 0.062;
  controls.minDistance = 8;
  controls.maxDistance = 300;
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.minPolarAngle = Math.PI * 0.08;
  controls.maxPolarAngle = Math.PI * 0.92;
  controls.target.copy(cam3dTarget);
  controls.enabled = false;
  /** Hysteresis for min/max distance (OrbitControls has no userData — do not store state there). */
  let wbZoomLimitsActive = false;

  function refreshControlsForViewMode(blend, masterWeight = 0) {
    const u = smoothstep(blend);
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = u < 0.12;
    const enterWbZoom = u > 0.92;
    const exitWbZoom = u < 0.78;
    if (enterWbZoom && !wbZoomLimitsActive) {
      wbZoomLimitsActive = true;
      controls.minDistance = 40;
      controls.maxDistance = 520;
    } else if (exitWbZoom && wbZoomLimitsActive) {
      wbZoomLimitsActive = false;
      controls.minDistance = 8;
      controls.maxDistance = 300;
    }
    if (u > 0.88) {
      controls.rotateSpeed = 0.88;
      controls.zoomSpeed = 0.92;
    } else {
      const gardenRot = 0.64;
      const masterRot = 0.4;
      controls.rotateSpeed = gardenRot + (masterRot - gardenRot) * masterWeight;
      const gardenZoom = 0.82;
      const masterZoom = 0.72;
      controls.zoomSpeed = gardenZoom + (masterZoom - gardenZoom) * masterWeight;
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
  bridges.userData = { arc3d: true };

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

  assignMasterTreeLayout(sceneCenter);

  const cam3dMaster = new THREE.Vector3();
  const cam3dTargetMaster = new THREE.Vector3();

  function computeMasterCamera() {
    const box = new THREE.Box3();
    const pad = new THREE.Vector3(20, 14, 20);
    for (const w of WORDS) {
      if (!w.posMaster) continue;
      box.expandByPoint(w.posMaster.clone().add(pad));
      box.expandByPoint(w.posMaster.clone().sub(pad));
    }
    if (box.isEmpty()) {
      cam3dTargetMaster.copy(sceneCenter);
      cam3dMaster.copy(cam3dPos);
      return;
    }
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const extent = Math.max(size.x, size.y, size.z, 38);
    cam3dTargetMaster.copy(c);
    cam3dMaster.set(c.x + extent * 0.38, c.y + extent * 0.42, c.z + extent * 0.52);
  }

  computeMasterCamera();

  /** @type {'Garden3d'|'GardenWb'|'Master3d'|'MasterWb'} Active camera/layout key after last completed transition */
  let viewKey = "Garden3d";

  /** Effective target key while tweening layout/surface */
  function vk() {
    return transition?.toKey ?? viewKey;
  }

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

  if (runIntroCinematic) {
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      g.position.copy(SINGULARITY);
      g.scale.setScalar(0.06);
      g.rotation.y = 0;
      for (const mesh of g.userData.meshes) {
        mesh.userData.introFinalPos = mesh.position.clone();
        const lab = mesh.userData.label;
        if (lab) lab.userData.introFinalPos = lab.position.clone();
      }
      for (const line of g.userData.lines) {
        line.material.opacity = 0;
        updateInternalTreeLine(line);
      }
    }
    introPhaseAEnd = 0;
  } else if (!REDUCED_MOTION && !USE_TYPO_INTRO) {
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

  let viewBlend = 0;
  /** @type {{ wallSec0: number, fromKey: string, toKey: string, cam0: THREE.Vector3, tgt0: THREE.Vector3, cam1: THREE.Vector3, tgt1: THREE.Vector3 } | null} */
  let transition = null;
  /** @type {string | null} */
  let autoRotateAnchorUuid = null;

  /** @type {ReturnType<typeof setTimeout> | null} */
  let morphClickTimer = null;
  /** @type {THREE.Mesh | null} */
  let morphFocusMesh = null;
  let morphFocusT0 = 0;
  /** @type {THREE.Mesh | null} */
  let morphHoverMesh = null;
  let morphInspectActive = false;
  /** @type {ReturnType<typeof requestAnimationFrame> | null} */
  let morphHoverRaf = null;
  let morphHoverLastX = 0;
  let morphHoverLastY = 0;
  /** @type {HTMLElement | null} */
  let morphHelpEl = null;
  /** @type {() => void} */
  let closeMorphHelp = () => {};
  /** @type {{ wallSec0: number, dur: number, cam0: THREE.Vector3, tgt0: THREE.Vector3, cam1: THREE.Vector3, tgt1: THREE.Vector3 } | null} */
  let cameraFitTween = null;

  const morphFlyKeyCodes = new Set([
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);
  /** @type {Set<string>} */
  const morphKeysDown = new Set();

  const WB_DEFAULT_CAM = new THREE.Vector3(0, 34, 198);
  const WB_DEFAULT_TGT = new THREE.Vector3(0, -10, 0);

  function isGardenScope() {
    if (!selectEl) return true;
    const v = selectEl.value;
    return v === GARDEN_SELECT || v === "";
  }

  function syncCam3dToOverview() {
    cam3dTarget.copy(sceneCenter);
    cam3dPos.set(sceneCenter.x + 8, sceneCenter.y + 48, sceneCenter.z + 142);
  }

  function flyToOverview() {
    syncCam3dToOverview();
    if (vk().startsWith("Garden") && vk().endsWith("3d") && viewBlend < 0.06 && transition === null) {
      camera.position.copy(cam3dPos);
      controls.target.copy(cam3dTarget);
    }
    controls.update();
  }

  function syncCam3dToWord(id) {
    const g = wordGroups[id];
    if (!g) return;
    _morphFitBox.setFromObject(g);
    _morphFitBox.expandByScalar(5);
    const c = _morphFitBox.getCenter(_morphFitCenter);
    const sz = _morphFitBox.getSize(_morphFitSize);
    const ext = Math.max(sz.x, sz.y, sz.z, 14);
    cam3dTarget.copy(c);
    cam3dPos.copy(c).add(new THREE.Vector3(ext * 0.48, ext * 0.36, ext * 0.68));
  }

  function startCameraFit() {
    if (!introDone || transition) return;
    cameraFitTween = {
      wallSec0: morphWallSec(),
      dur: REDUCED_MOTION ? 0.01 : 0.52,
      cam0: camera.position.clone(),
      tgt0: controls.target.clone(),
      cam1: cam3dPos.clone(),
      tgt1: cam3dTarget.clone(),
    };
  }

  function morphApplyFlyCamera(dt) {
    if (transition) return;
    const moveSpeed = (vk().startsWith("Master") ? 44 : 54) * dt;
    const orbitSpeed = (vk().startsWith("Master") ? 0.92 : 1.12) * dt;
    camera.getWorldDirection(_keyPanFwd);
    _keyPanFwd.y = 0;
    if (_keyPanFwd.lengthSq() > 1e-8) _keyPanFwd.normalize();
    else _keyPanFwd.set(0, 0, -1);
    _keyPanRight.crossVectors(_keyPanFwd, _yAxisUp);
    if (_keyPanRight.lengthSq() > 1e-8) _keyPanRight.normalize();
    else _keyPanRight.set(1, 0, 0);

    if (morphKeysDown.has("KeyW")) {
      camera.position.addScaledVector(_keyPanFwd, moveSpeed);
      controls.target.addScaledVector(_keyPanFwd, moveSpeed);
    }
    if (morphKeysDown.has("KeyS")) {
      camera.position.addScaledVector(_keyPanFwd, -moveSpeed);
      controls.target.addScaledVector(_keyPanFwd, -moveSpeed);
    }
    if (morphKeysDown.has("KeyA")) {
      camera.position.addScaledVector(_keyPanRight, -moveSpeed);
      controls.target.addScaledVector(_keyPanRight, -moveSpeed);
    }
    if (morphKeysDown.has("KeyD")) {
      camera.position.addScaledVector(_keyPanRight, moveSpeed);
      controls.target.addScaledVector(_keyPanRight, moveSpeed);
    }

    const yaw =
      (morphKeysDown.has("ArrowLeft") ? 1 : 0) + (morphKeysDown.has("ArrowRight") ? -1 : 0);
    if (yaw !== 0) {
      _keyOrbitOff.copy(camera.position).sub(controls.target);
      _keyOrbitOff.applyAxisAngle(_yAxisUp, yaw * orbitSpeed);
      camera.position.copy(controls.target).add(_keyOrbitOff);
    }
    const pitchMove =
      (morphKeysDown.has("ArrowUp") ? 1 : 0) + (morphKeysDown.has("ArrowDown") ? -1 : 0);
    if (pitchMove !== 0) {
      const elev = pitchMove * moveSpeed * 0.88;
      camera.position.y += elev;
      controls.target.y += elev * 0.38;
    }
  }

  function morphResetCameraToMode() {
    morphInspectActive = false;
    cameraFitTween = null;
    controls.autoRotate = false;
    autoRotateAnchorUuid = null;
    if (vk().endsWith("Wb")) {
      cam3dPos.copy(WB_DEFAULT_CAM);
      cam3dTarget.copy(WB_DEFAULT_TGT);
    } else if (vk().startsWith("Master")) {
      computeMasterCamera();
      cam3dPos.copy(cam3dMaster);
      cam3dTarget.copy(cam3dTargetMaster);
    } else {
      if (isGardenScope()) syncCam3dToOverview();
      else if (selectEl && selectEl.value !== GARDEN_SELECT) syncCam3dToWord(selectEl.value);
      else syncCam3dToOverview();
    }
    startCameraFit();
  }

  function applyScopeVisibility() {
    const garden = isGardenScope();
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      if (!g) continue;
      g.visible = garden || !!(selectEl && w.id === selectEl.value);
    }
    if (vk().startsWith("Master")) {
      for (const w of WORDS) {
        const g = wordGroups[w.id];
        if (g) g.visible = true;
      }
    }
    rebuildGardenHints(garden ? null : selectEl?.value || null);
  }

  function flyToActiveView() {
    if (isGardenScope()) flyToOverview();
    else if (selectEl) flyToWord(selectEl.value);
  }

  function flyToWord(id) {
    if (!wordGroups[id]) return;
    syncCam3dToWord(id);
    focusCenter.copy(cam3dTarget);
    if (vk().startsWith("Garden") && vk().endsWith("3d") && viewBlend < 0.06 && transition === null) {
      camera.position.copy(cam3dPos);
      controls.target.copy(cam3dTarget);
    }
    controls.update();
  }

  function fillDetail(wordId) {
    const w = WORDS.find((x) => x.id === wordId);
    if (!w || !detailEl) return;
    configureLessonWordLookup((id) => WORDS.find((x) => x.id === id)?.label || id);
    const lessonHtml = renderMorphLessonHtml(w, morphemeRegistry);
    let html = lessonHtml;
    html += `<section class="morph-chapter-note"><h4 class="morph-chapter-note__h">Textbook excerpt (Park-Johnson &amp; Shin, Ch.&nbsp;4)</h4><div class="morph-chapter-note__body">${w.note}</div>`;
    if (w.context) html += `<p class="morph-context">${w.context}</p>`;
    html += `</section>`;
    detailEl.innerHTML = html;
  }

  function fillDetailFromSelect() {
    if (!detailEl) return;
    if (vk().startsWith("Master")) {
      if (selectEl && selectEl.value !== GARDEN_SELECT) {
        fillDetail(selectEl.value);
        return;
      }
      detailEl.innerHTML = `<p><strong>Master Tree (🔗 links).</strong> Every word packs into hubs so all shared morphemes stay visible together. Switch <strong>Arrangement ▸ Master</strong> for this linked layout; switch <strong>Surface ▸ 📋 Whiteboard</strong> for a flat projector view or <strong>🌐 3D</strong> so bridges arch in depth. Magenta ribbons connect identical morphemes across words—those <em>spatial</em> links are deliberately stronger in 3D. Hover spheres for gloss; pick a word in the menu for the chapter note and morphology mini-lesson.</p>`;
      return;
    }
    if (!selectEl || selectEl.value === GARDEN_SELECT) {
      detailEl.innerHTML = `<p><strong>Garden (🌳)</strong> — all words laid out spatially instead of clustered by links. Toggle <strong>Surface</strong> to compare the same arrangement on a <strong>whiteboard</strong> vs full <strong>3D</strong>. Isolate one word from the menu: in 3D, periphery fades; on the board, that tree snaps to center. Hover morphemes for meaning; sparse labels tighten when you zoom out. <strong>WASD</strong>/<strong>arrows</strong> move in 3D; <strong>double-click</strong> frames a tree; <kbd>Shift</kbd>+double-click toggles slow orbit.</p>`;
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

  function morphEscapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const morphTooltipEl = document.createElement("div");
  morphTooltipEl.className = "morph-node-tooltip morph-node-tooltip--hidden";
  morphTooltipEl.setAttribute("role", "tooltip");
  document.body.appendChild(morphTooltipEl);

  function hideMorphTooltip() {
    morphTooltipEl.classList.add("morph-node-tooltip--hidden");
    morphTooltipEl.innerHTML = "";
  }

  /**
   * Double-click: restore any whiteboard trim, then ease the camera so the full word tree fits on screen
   * with the orbit target biased toward the clicked node (garden, master, and whiteboard).
   */
  function morphFitCameraToWordTreeNode(/** @type {THREE.Mesh} */ mesh) {
    const wid = mesh.userData.wordId;
    const g = wordGroups[wid];
    if (!g) return;
    clearWbPrune(g);
    hideMorphemePop();

    _morphFitBox.setFromObject(g);
    _morphFitBox.expandByScalar(5);
    const c = _morphFitBox.getCenter(_morphFitCenter);
    const sz = _morphFitBox.getSize(_morphFitSize);
    const ext = Math.max(sz.x, sz.y, sz.z, 14);
    mesh.getWorldPosition(_orbitDblClickTarget);
    cam3dTarget.copy(c).lerp(_orbitDblClickTarget, 0.4);
    const wb = smoothstep(viewBlend) > 0.85;
    const offset = new THREE.Vector3(ext * 0.52, ext * 0.38, ext * 0.72);
    const minCamDist = wb ? Math.max(46, controls.minDistance * 1.08) : Math.max(16, controls.minDistance * 1.05);
    if (offset.length() < minCamDist) offset.multiplyScalar(minCamDist / offset.length());
    cam3dPos.copy(cam3dTarget).add(offset);

    morphInspectActive = false;
    controls.autoRotate = false;
    autoRotateAnchorUuid = null;
    cameraFitTween = {
      wallSec0: morphWallSec(),
      dur: REDUCED_MOTION ? 0.01 : 0.52,
      cam0: camera.position.clone(),
      tgt0: controls.target.clone(),
      cam1: cam3dPos.clone(),
      tgt1: cam3dTarget.clone(),
    };
  }

  function morphTooltipAlsoHtml(key, currentWordId) {
    const list = morphemeRegistry[key];
    if (!list || list.length < 2) return "";
    const ids = [...new Set(list.map((x) => x.wordId))].filter((id) => id !== currentWordId);
    if (!ids.length) return "";
    const labels = ids.map((id) => WORDS.find((w) => w.id === id)?.label).filter(Boolean);
    if (!labels.length) return "";
    return `<p class="morph-node-tooltip__also"><strong>Also in:</strong> ${labels.map(morphEscapeHtml).join(", ")}</p>`;
  }

  function showMorphTooltip(mesh, clientX, clientY) {
    const tip = mesh?.userData?.morphTooltip;
    if (!tip) {
      hideMorphTooltip();
      return;
    }
    const also = tip.morphemeKey ? morphTooltipAlsoHtml(tip.morphemeKey, mesh.userData.wordId) : "";
    morphTooltipEl.innerHTML = `<div class="morph-node-tooltip__inner">
      <p class="morph-node-tooltip__word">${morphEscapeHtml(tip.wordLabel)}</p>
      <p class="morph-node-tooltip__head"><span class="morph-node-tooltip__cat">${morphEscapeHtml(tip.category)}</span> · <strong>${morphEscapeHtml(tip.morpheme)}</strong></p>
      <p class="morph-node-tooltip__gloss">${morphEscapeHtml(tip.gloss)}</p>
      ${also}</div>`;
    morphTooltipEl.classList.remove("morph-node-tooltip--hidden");
    morphTooltipEl.classList.toggle(
      "morph-node-tooltip--wb",
      Boolean(shellEl?.classList.contains("morphology-shell--wb"))
    );
    requestAnimationFrame(() => {
      const pad = 10;
      const rect = morphTooltipEl.getBoundingClientRect();
      let left = clientX + 14;
      let top = clientY + 14;
      if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
      if (top + rect.height > window.innerHeight - pad) top = clientY - rect.height - 12;
      if (left < pad) left = pad;
      if (top < pad) top = pad;
      morphTooltipEl.style.left = `${left}px`;
      morphTooltipEl.style.top = `${top}px`;
    });
  }

  morphHelpEl = document.getElementById("morph-help");
  const morphHelpBtn = document.getElementById("morph-help-btn");
  function openMorphHelp() {
    if (!morphHelpEl) return;
    morphHelpEl.classList.remove("morph-help--hidden");
    morphHelpEl.querySelector(".morph-help__close")?.focus();
  }
  closeMorphHelp = () => {
    morphHelpEl?.classList.add("morph-help--hidden");
    morphHelpBtn?.focus();
  };
  if (morphHelpEl) {
    morphHelpEl.querySelector(".morph-help__backdrop")?.addEventListener("click", closeMorphHelp);
    morphHelpEl.querySelector(".morph-help__close")?.addEventListener("click", closeMorphHelp);
  }
  morphHelpBtn?.addEventListener("click", () => {
    if (!morphHelpEl) return;
    if (morphHelpEl.classList.contains("morph-help--hidden")) openMorphHelp();
    else closeMorphHelp();
  });

  const curriculumEl = document.getElementById("morph-curriculum");
  if (curriculumEl) {
    curriculumEl.value = ACTIVE_CURRICULUM_KEY;
    curriculumEl.addEventListener("change", () => {
      const v = curriculumEl.value;
      if (v !== "elementary" && v !== "middle" && v !== "high") return;
      try {
        localStorage.setItem("morphCurriculum", v);
        const url = new URL(window.location.href);
        url.searchParams.set("set", v);
        window.history.replaceState(null, "", url.toString());
      } catch (_) {
        /* ignore */
      }
      window.location.reload();
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
      if (
        (vk().startsWith("Garden") || vk().startsWith("Master")) &&
        viewBlend < 0.06 &&
        !transition
      ) {
        if (introDone) {
          if (isGardenScope()) syncCam3dToOverview();
          else if (selectEl) syncCam3dToWord(selectEl.value);
          startCameraFit();
        } else if (vk().startsWith("Garden")) {
          flyToActiveView();
        }
      }
    });
    applyScopeVisibility();
    fillDetailFromSelect();
    flyToOverview();
  } else {
    flyToWord(firstWordId);
  }

  const fsBtn = document.getElementById("morph-btn-fs");
  const fsTarget = shellEl || host;

  function morphPickMeshAt(clientX, clientY) {
    if (!controls.enabled) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const meshes = [];
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      if (!g?.visible) continue;
      meshes.push(...g.userData.meshes);
    }
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    return /** @type {THREE.Mesh} */ (hit.object);
  }

  function morphHandleDoublePick(clientX, clientY, shiftKey = false) {
    const mesh = morphPickMeshAt(clientX, clientY);
    if (!mesh) return;
    const u = smoothstep(viewBlend);
    if (shiftKey && u < 0.12) {
      mesh.getWorldPosition(_orbitDblClickTarget);
      controls.target.copy(_orbitDblClickTarget);
      morphInspectActive = false;
      if (autoRotateAnchorUuid === mesh.uuid && controls.autoRotate) {
        controls.autoRotate = false;
        autoRotateAnchorUuid = null;
      } else {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.75;
        autoRotateAnchorUuid = mesh.uuid;
      }
      morphFocusMesh = mesh;
      morphFocusT0 = clock.elapsedTime;
      controls.update();
      return;
    }
    morphFitCameraToWordTreeNode(mesh);
    morphFocusMesh = mesh;
    morphFocusT0 = clock.elapsedTime;
    controls.update();
  }

  function morphHandleSinglePick(clientX, clientY) {
    const mesh = morphPickMeshAt(clientX, clientY);
    if (!mesh) {
      morphInspectActive = false;
      return;
    }
    const u = smoothstep(viewBlend);
    mesh.getWorldPosition(morphInspectTargetVec);
    morphInspectActive = true;
    morphFocusMesh = mesh;
    morphFocusT0 = clock.elapsedTime;
    if (u < 0.12) {
      controls.target.lerp(morphInspectTargetVec, 0.22);
    } else {
      controls.target.lerp(morphInspectTargetVec, 0.18);
    }
    controls.update();
  }

  renderer.domElement.addEventListener("click", (ev) => {
    if (!controls.enabled) return;
    if (ev.detail === 2) {
      if (morphClickTimer != null) window.clearTimeout(morphClickTimer);
      morphClickTimer = null;
      morphHandleDoublePick(ev.clientX, ev.clientY, ev.shiftKey);
      return;
    }
    if (ev.detail !== 1) return;
    if (morphClickTimer != null) window.clearTimeout(morphClickTimer);
    morphClickTimer = window.setTimeout(() => {
      morphClickTimer = null;
      morphHandleSinglePick(ev.clientX, ev.clientY);
    }, 300);
  });

  let morphTapLastT = 0;
  let morphTapX = 0;
  let morphTapY = 0;
  renderer.domElement.addEventListener(
    "touchend",
    (ev) => {
      if (!controls.enabled || ev.changedTouches.length !== 1) return;
      const t = ev.changedTouches[0];
      const now = performance.now();
      const dx = t.clientX - morphTapX;
      const dy = t.clientY - morphTapY;
      if (now - morphTapLastT < 320 && dx * dx + dy * dy < 900) {
        ev.preventDefault();
        morphHandleDoublePick(t.clientX, t.clientY);
        morphTapLastT = 0;
        return;
      }
      morphTapLastT = now;
      morphTapX = t.clientX;
      morphTapY = t.clientY;
    },
    { passive: false }
  );

  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (!introDone || !controls.enabled) return;
    morphHoverLastX = ev.clientX;
    morphHoverLastY = ev.clientY;
    if (morphHoverRaf != null) return;
    morphHoverRaf = requestAnimationFrame(() => {
      morphHoverRaf = null;
      const m = morphPickMeshAt(morphHoverLastX, morphHoverLastY);
      morphHoverMesh = m;
      renderer.domElement.style.cursor = m ? "pointer" : "";
      if (m) showMorphTooltip(m, morphHoverLastX, morphHoverLastY);
      else hideMorphTooltip();
    });
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    morphHoverMesh = null;
    hideMorphTooltip();
    renderer.domElement.style.cursor = "";
  });

  function morphToggleAutoRotateFromKeyboard() {
    const u = smoothstep(viewBlend);
    if (u >= 0.12) return;
    if (controls.autoRotate && autoRotateAnchorUuid) {
      controls.autoRotate = false;
      autoRotateAnchorUuid = null;
      return;
    }
    const mesh = morphFocusMesh;
    if (!mesh?.userData?.wordId) return;
    mesh.getWorldPosition(morphInspectTargetVec);
    controls.target.copy(morphInspectTargetVec);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.75;
    autoRotateAnchorUuid = mesh.uuid;
    controls.update();
  }

  function morphOnKeydown(ev) {
    if (!introDone) return;
    if (ev.key === "Escape" && morphHelpEl && !morphHelpEl.classList.contains("morph-help--hidden")) {
      closeMorphHelp();
      ev.preventDefault();
      return;
    }
    const ae = document.activeElement;
    const tag = ae?.tagName;
    const inField =
      tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || ae?.isContentEditable;
    if (morphFlyKeyCodes.has(ev.code) && smoothstep(viewBlend) < 0.12 && !inField) {
      morphKeysDown.add(ev.code);
      if (ev.key === "ArrowUp" || ev.key === "ArrowDown" || ev.key === "ArrowLeft" || ev.key === "ArrowRight")
        ev.preventDefault();
    }
    if (inField) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === "f") {
      if (
        (vk().startsWith("Garden") || vk().startsWith("Master")) &&
        viewBlend < 0.06 &&
        !transition
      ) {
        if (isGardenScope()) syncCam3dToOverview();
        else if (selectEl) syncCam3dToWord(selectEl.value);
        startCameraFit();
      }
      return;
    }
    if (k === "r") {
      morphResetCameraToMode();
      return;
    }
    if (ev.code === "Space") {
      ev.preventDefault();
      morphToggleAutoRotateFromKeyboard();
    }
  }
  window.addEventListener("keydown", morphOnKeydown);

  function morphOnKeyup(ev) {
    morphKeysDown.delete(ev.code);
  }
  window.addEventListener("keyup", morphOnKeyup);
  window.addEventListener("blur", () => morphKeysDown.clear());

  const btnArrGarden = document.getElementById("morph-btn-arr-garden");
  const btnArrMaster = document.getElementById("morph-btn-arr-master");
  const btnSurf3d = document.getElementById("morph-btn-surf-3d");
  const btnSurfWb = document.getElementById("morph-btn-surf-wb");

  function setViewButtons() {
    const k = transition?.toKey ?? viewKey;
    if (btnArrGarden) {
      btnArrGarden.classList.toggle("morph-view-btn--active", k.startsWith("Garden"));
      btnArrGarden.setAttribute("aria-pressed", k.startsWith("Garden").toString());
    }
    if (btnArrMaster) {
      btnArrMaster.classList.toggle("morph-view-btn--active", k.startsWith("Master"));
      btnArrMaster.setAttribute("aria-pressed", k.startsWith("Master").toString());
    }
    if (btnSurf3d) {
      btnSurf3d.classList.toggle("morph-view-btn--active", k.endsWith("3d"));
      btnSurf3d.setAttribute("aria-pressed", k.endsWith("3d").toString());
    }
    if (btnSurfWb) {
      btnSurfWb.classList.toggle("morph-view-btn--active", k.endsWith("Wb"));
      btnSurfWb.setAttribute("aria-pressed", k.endsWith("Wb").toString());
    }
  }

  function camerasForTransitionEnd(/** @type {string} */ key) {
    if (key.endsWith("Wb")) {
      return { cam: WB_DEFAULT_CAM.clone(), tgt: WB_DEFAULT_TGT.clone() };
    }
    if (key.startsWith("Master")) {
      computeMasterCamera();
      return { cam: cam3dMaster.clone(), tgt: cam3dTargetMaster.clone() };
    }
    flyToActiveView();
    return { cam: cam3dPos.clone(), tgt: cam3dTarget.clone() };
  }

  function transitionToKey(/** @type {string} */ toKey) {
    if (transition) return;
    cameraFitTween = null;
    if (toKey === viewKey && Math.abs(viewBlend - blendForViewKey(toKey)) < 0.02) return;

    controls.autoRotate = false;
    autoRotateAnchorUuid = null;

    const cam0 = camera.position.clone();
    const tgt0 = controls.target.clone();
    const end = camerasForTransitionEnd(toKey);

    transition = {
      wallSec0: morphWallSec(),
      fromKey: viewKey,
      toKey,
      cam0,
      tgt0,
      cam1: end.cam,
      tgt1: end.tgt,
    };
    applyScopeVisibility();
    fillDetailFromSelect();
    setViewButtons();
  }

  btnArrGarden?.addEventListener("click", () => {
    const wb = vk().endsWith("Wb");
    transitionToKey(wb ? "GardenWb" : "Garden3d");
  });
  btnArrMaster?.addEventListener("click", () => {
    const wb = vk().endsWith("Wb");
    transitionToKey(wb ? "MasterWb" : "Master3d");
  });
  btnSurf3d?.addEventListener("click", () => {
    const m = vk().startsWith("Master");
    transitionToKey(m ? "Master3d" : "Garden3d");
  });
  btnSurfWb?.addEventListener("click", () => {
    const m = vk().startsWith("Master");
    transitionToKey(m ? "MasterWb" : "GardenWb");
  });

  function applyVisualTheme(
    blend,
    layoutEase = 1,
    layoutKeyFrom = viewKey,
    layoutKeyTo = viewKey
  ) {
    const u = smoothstep(blend);
    scene.background.copy(bg3d).lerp(bg2d, u);

    grid.visible = u < 0.35;
    ambient3d.intensity = 0.38 * (1 - u);
    key3d.intensity = 1.1 * (1 - u);
    rim3d.intensity = 0.85 * (1 - u);
    fill3d.intensity = 0.5 * (1 - u);
    ambient2d.visible = u > 0.2;
    key2d.visible = u > 0.2;

    host.classList.toggle("morph-canvas-host--wb", u > 0.88);
    if (shellEl) shellEl.classList.toggle("morphology-shell--wb", u > 0.88);

    if (bridges.userData) bridges.userData.arc3d = u < 0.42;

    const masterWeight =
      masterWtKey(layoutKeyFrom) * (1 - layoutEase) + masterWtKey(layoutKeyTo) * layoutEase;
    const bridgeOpacity = masterWeight * 0.85 + (1 - masterWeight) * gardenBridgeOpacity;
    const isolate3d =
      selectEl &&
      selectEl.value !== GARDEN_SELECT &&
      u < 0.38 &&
      masterWeight < 0.45;
    bridges.children.forEach((line) => {
      if (line.material) line.material.opacity = isolate3d ? 0 : bridgeOpacity;
      line.visible = (!isolate3d && u < 0.92) || masterWeight > 0.08;
    });
    bridges.visible = bridges.children.some((ln) => ln.visible);
    gardenHints.visible = isolate3d && u < 0.26;

    const le = Math.max(0, Math.min(1, layoutEase));
    for (const w of WORDS) {
      const g = wordGroups[w.id];
      if (!g) continue;
      g.position.lerpVectors(posForViewKey(w, layoutKeyFrom), posForViewKey(w, layoutKeyTo), le);

      const swayMul = (1 - u) * (1 - masterWeight * 0.92);
      const sway = swayMul * Math.sin(clock.elapsedTime * 0.1 + w.pos3d.x * 0.02) * 0.045;
      g.rotation.y = sway;

      const dim = 0.08 * u;
      const tNow = clock.elapsedTime;
      for (const mesh of g.userData.meshes) {
        const m = mesh.material;
        m.metalness = 0.5 * (1 - u) + 0.12 * u;
        m.roughness = 0.35 * (1 - u) + 0.55 * u;
        m.emissiveIntensity = 0.09 * (1 - u) + 0.035 * u;
        if (mesh.userData.baseEmissive)
          m.emissive.copy(mesh.userData.baseEmissive).multiplyScalar(1 - dim);

        const shell = mesh.userData.shell;
        const sm = shell?.material;
        if (sm && "transmission" in sm) {
          const isRoot = !!mesh.userData.shellIsRoot;
          const baseGarden = isRoot ? 0.24 : 0.185;
          const baseWb = isRoot ? 0.13 : 0.09;
          let op = baseGarden * (1 - u) + baseWb * u;
          let trans = 0.85 * (1 - u) + 0.34 * u;
          let thick = 0.22 * (1 - u) + 0.11 * u;
          const orbitHi = autoRotateAnchorUuid === mesh.uuid;
          const clickAge = morphFocusMesh === mesh ? tNow - morphFocusT0 : 999;
          const clickHi = morphFocusMesh === mesh && clickAge < 0.4 && !orbitHi;
          const clickPulse = clickHi ? 1 - smoothstep(clickAge / 0.34) : 0;
          if (orbitHi) op += 0.14;
          else op += 0.12 * clickPulse;
          if (morphHoverMesh === mesh) op += 0.06;
          sm.opacity = Math.min(0.95, op);
          sm.transmission = trans;
          sm.thickness = thick;
          const glow = orbitHi ? 0.11 : 0.09 * clickPulse;
          if (mesh.userData.baseEmissive && glow > 0.002) {
            sm.emissive.copy(mesh.userData.baseEmissive);
            sm.emissiveIntensity = glow;
          } else {
            sm.emissiveIntensity = 0;
          }
        }
      }
      const line3 = 0x33ddaa;
      const line2 = 0x1a4d44;
      const lc = new THREE.Color(line3).lerp(new THREE.Color(line2), u);
      for (const line of g.userData.lines) {
        line.material.color.copy(lc);
        line.material.opacity = 0.88 * (1 - u) + 0.95 * u;
      }
    }

    refreshControlsForViewMode(blend, masterWeight);
  }

  /* Intro overlay — letters branch into words + mini morpheme trees, then 3D settle (once per session) */
  /** @type {HTMLDivElement | null} */
  let introOverlay = null;
  const introLetters = "MORPHOLOGY".split("");
  const introLex = INTRO_OVERLAY_LEXEMES;

  function buildIntroOverlayHtml() {
    const cells = introLetters
      .map((ch, i) => {
        const row = introLex[i];
        const word = row ? morphIntroEsc(row.word) : "";
        const parts =
          row?.parts
            .map(
              (p, j) =>
                `<span class="morph-intro-typo__mor" style="--mj:${j}"><span class="morph-intro-typo__mor-inner">${morphIntroEsc(p)}</span></span>`
            )
            .join("") ?? "";
        const vine = row && row.parts.length ? `<span class="morph-intro-typo__vine" aria-hidden="true"></span>` : "";
        const tree =
          row && row.parts.length
            ? `<div class="morph-intro-typo__tree" aria-hidden="true">${vine}<div class="morph-intro-typo__parts">${parts}</div></div>`
            : "";
        const wordEl = row
          ? `<span class="morph-intro-typo__word" style="--morph-i:${i}">${word}</span>${tree}`
          : "";
        return `<span class="morph-intro-typo__cell" style="--morph-i:${i}"><span class="morph-intro-typo__ch">${morphIntroEsc(ch)}</span><span class="morph-intro-typo__twig" aria-hidden="true"></span>${wordEl}</span>`;
      })
      .join("");
    return `
    <div class="morph-intro-typo" aria-hidden="true">
      <div class="morph-intro-typo__letters">
        ${cells}
      </div>
      <p class="morph-intro-typo__sub">The Analysis of Words · Ch. 4</p>
    </div>
  `;
  }

  if (!runIntroCinematic) {
    finishIntroGroups();
    flyToActiveView();
    camera.position.copy(cam3dPos);
    controls.target.copy(cam3dTarget);
    controls.enabled = true;
    controls.update();
  }

  let introDone = !runIntroCinematic;
  let introT = 0;

  let introSpinAngle = 0;
  const introSettle = {
    captured: false,
    fromPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
  };

  if (runIntroCinematic) {
    introOverlay = document.createElement("div");
    introOverlay.className = "morph-intro morph-intro--typo";
    introOverlay.innerHTML = buildIntroOverlayHtml();
    const skipBtn = document.createElement("button");
    skipBtn.type = "button";
    skipBtn.className = "morph-skip";
    skipBtn.textContent = "Skip intro";
    introOverlay.appendChild(skipBtn);
    host.appendChild(introOverlay);
    skipBtn.addEventListener("click", endIntro);
  }

  function endIntro() {
    if (introDone) return;
    morphIntroMarkPlayed();
    introDone = true;
    if (introOverlay) {
      introOverlay.style.opacity = "0";
      introOverlay.style.pointerEvents = "none";
      window.setTimeout(() => {
        introOverlay?.remove();
        introOverlay = null;
      }, 380);
    }
    finishIntroGroups();
    flyToActiveView();
    camera.position.copy(cam3dPos);
    controls.target.copy(cam3dTarget);
    controls.enabled = true;
    controls.update();
  }

  setViewButtons();

  const introTmp0 = new THREE.Vector3();
  const introTmp1 = new THREE.Vector3();
  const lodWorld = new THREE.Vector3();

  function resizeCanvasToHost() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  window.addEventListener("resize", resizeCanvasToHost);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resizeCanvasToHost).observe(host);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeCanvasToHost);
  }

  /** iOS / many mobile browsers: no element fullscreen — use fixed “immersive” shell instead */
  let morphImmersiveCss = false;

  function getFullscreenElement() {
    const d = document;
    return (
      d.fullscreenElement ||
      /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (d).webkitFullscreenElement ||
      null
    );
  }

  function requestFullscreenApi(/** @type {HTMLElement} */ el) {
    if (typeof el.requestFullscreen === "function") return el.requestFullscreen();
    const wk =
      /** @type {HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }} */ (el).webkitRequestFullscreen;
    if (typeof wk === "function") return wk.call(el);
    return Promise.reject(new Error("fullscreen"));
  }

  function exitFullscreenApi() {
    const d = document;
    if (typeof d.exitFullscreen === "function") return d.exitFullscreen();
    const wk =
      /** @type {Document & { webkitExitFullscreen?: () => Promise<void> }} */ (d).webkitExitFullscreen;
    if (typeof wk === "function") return wk.call(d);
    return Promise.resolve();
  }

  function setMorphImmersiveCss(on) {
    morphImmersiveCss = on;
    const root = document.documentElement;
    if (fsTarget) fsTarget.classList.toggle("morphology-shell--immersive", on);
    root.classList.toggle("morph-immersive-open", on);
    requestAnimationFrame(() => resizeCanvasToHost());
  }

  function isMorphImmersive() {
    return Boolean(getFullscreenElement() || morphImmersiveCss);
  }

  const MORPH_ICON_FS_OPEN = "🖥️";
  const MORPH_ICON_FS_CLOSE = "❌";

  function syncFsButton() {
    if (!fsBtn) return;
    const on = isMorphImmersive();
    fsBtn.textContent = on ? MORPH_ICON_FS_CLOSE : MORPH_ICON_FS_OPEN;
    fsBtn.setAttribute("aria-pressed", on ? "true" : "false");
    fsBtn.title = on ? "Exit full screen" : "Full screen (or fill screen on mobile)";
    fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Enter full screen");
  }

  async function toggleMorphImmersive() {
    if (isMorphImmersive()) {
      if (getFullscreenElement()) await exitFullscreenApi().catch(() => {});
      setMorphImmersiveCss(false);
      syncFsButton();
      resizeCanvasToHost();
      return;
    }
    const el = /** @type {HTMLElement} */ (fsTarget);
    const canApi =
      typeof el.requestFullscreen === "function" ||
      typeof /** @type {HTMLElement & { webkitRequestFullscreen?: unknown }} */ (el).webkitRequestFullscreen ===
        "function";
    if (canApi) {
      try {
        await requestFullscreenApi(el);
        syncFsButton();
        window.scrollTo(0, 0);
        resizeCanvasToHost();
        return;
      } catch {
        /* Mobile Safari often rejects non-video fullscreen — fall through */
      }
    }
    setMorphImmersiveCss(true);
    syncFsButton();
    window.scrollTo(0, 0);
  }

  if (fsBtn && fsTarget) {
    fsBtn.addEventListener("click", () => void toggleMorphImmersive());
    const onFsEvent = () => {
      if (!getFullscreenElement()) setMorphImmersiveCss(false);
      syncFsButton();
      resizeCanvasToHost();
    };
    document.addEventListener("fullscreenchange", onFsEvent);
    document.addEventListener("webkitfullscreenchange", onFsEvent);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && morphImmersiveCss) {
        setMorphImmersiveCss(false);
        syncFsButton();
        resizeCanvasToHost();
      }
    });
    syncFsButton();
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.064);
    introT += dt;

    if (!introDone && runIntroCinematic) {
      const t = introT;
      if (t < TYPO_LETTER_SEC) {
        const drift = Math.min(1, t / TYPO_LETTER_SEC);
        camera.position.lerpVectors(introStartPos, cam3dPos, drift * 0.26);
        controls.target.lerpVectors(SINGULARITY, sceneCenter, drift * 0.2);
        for (const w of WORDS) {
          for (const line of wordGroups[w.id].userData.lines) {
            updateInternalTreeLine(line);
          }
        }
        const fade = smoothstep((t - TYPO_LETTER_SEC * 0.5) / (TYPO_LETTER_SEC * 0.42));
        if (introOverlay) introOverlay.style.opacity = String(1 - fade * 0.25);
      } else {
        const t2 = t - TYPO_LETTER_SEC;
        const k = Math.min(1, t2 / TYPO_SETTLE_SEC);
        const e = easeOutCubic(k);
        if (introOverlay)
          introOverlay.style.opacity = String(Math.max(0, 0.75 - smoothstep((t2 - 0.15) / 1.85)));
        if (!introSettle.captured) {
          introSettle.captured = true;
          introSettle.fromPos.copy(camera.position);
          introSettle.fromTarget.copy(controls.target);
          flyToActiveView();
        }
        for (const w of WORDS) {
          const g = wordGroups[w.id];
          g.position.lerpVectors(SINGULARITY, w.pos3d, e);
          g.scale.setScalar(0.06 + 0.94 * e);
          for (const line of g.userData.lines) {
            if (line.material) line.material.opacity = 0.72 * e;
            updateInternalTreeLine(line);
          }
        }
        camera.position.lerpVectors(introSettle.fromPos, cam3dPos, e);
        controls.target.lerpVectors(introSettle.fromTarget, cam3dTarget, e);
        const bloomBridge = smoothstep((k - 0.12) / 0.5);
        bridges.visible = bloomBridge > 0.03;
        bridges.children.forEach((line) => {
          if (line.material) line.material.opacity = 0.62 * bloomBridge;
        });
        grid.visible = k > 0.05;
        if (k >= 1) endIntro();
      }
    } else if (!introDone && !REDUCED_MOTION && !USE_TYPO_INTRO) {
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

    let layoutEase = 1;
    let layoutKeyFrom = viewKey;
    let layoutKeyTo = viewKey;
    if (transition) {
      const elapsed = morphWallSec() - transition.wallSec0;
      const k =
        TRANSITION_SEC > 1e-6 ? Math.min(1, elapsed / TRANSITION_SEC) : 1;
      const e = smoothstep(Math.min(k, 1));
      layoutEase = e;
      layoutKeyFrom = transition.fromKey;
      layoutKeyTo = transition.toKey;
      const bf = blendForViewKey(transition.fromKey);
      const bt = blendForViewKey(transition.toKey);
      viewBlend = bf + (bt - bf) * e;
      camera.position.lerpVectors(transition.cam0, transition.cam1, e);
      controls.target.lerpVectors(transition.tgt0, transition.tgt1, e);
      const ended =
        elapsed >= TRANSITION_SEC - 1e-6 || k >= 1 - 1e-9 || !Number.isFinite(elapsed);
      if (ended) {
        viewBlend = blendForViewKey(transition.toKey);
        layoutEase = 1;
        layoutKeyFrom = transition.toKey;
        layoutKeyTo = transition.toKey;
        viewKey = transition.toKey;
        camera.position.copy(transition.cam1);
        controls.target.copy(transition.tgt1);
        transition = null;
        setViewButtons();
        const ue = smoothstep(viewBlend);
        if (ue > 0.9) {
          wbZoomLimitsActive = true;
          controls.minDistance = 40;
          controls.maxDistance = 520;
        } else {
          wbZoomLimitsActive = false;
          controls.minDistance = 8;
          controls.maxDistance = 300;
        }
      }
    }

    if (!transition && cameraFitTween) {
      const elapsedF = morphWallSec() - cameraFitTween.wallSec0;
      const d = Math.max(1e-5, cameraFitTween.dur);
      const ck = Math.min(1, elapsedF / d);
      const ce = easeOutCubic(ck);
      camera.position.lerpVectors(cameraFitTween.cam0, cameraFitTween.cam1, ce);
      controls.target.lerpVectors(cameraFitTween.tgt0, cameraFitTween.tgt1, ce);
      if (ck >= 1 || elapsedF >= cameraFitTween.dur - 1e-8) {
        camera.position.copy(cameraFitTween.cam1);
        controls.target.copy(cameraFitTween.tgt1);
        cameraFitTween = null;
      }
    }

    if (introDone) applyVisualTheme(viewBlend, layoutEase, layoutKeyFrom, layoutKeyTo);

    if (introDone && morphInspectActive && !transition && !cameraFitTween) {
      controls.target.lerp(morphInspectTargetVec, 0.11);
    }

    if (
      introDone &&
      morphKeysDown.size > 0 &&
      smoothstep(viewBlend) < 0.12 &&
      !transition
    ) {
      morphApplyFlyCamera(dt);
    }

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
            if (els.pos && Math.abs(prev.p - 1) > LOD_OPACITY_EPS) {
              els.pos.style.opacity = "1";
              prev.p = 1;
            }
            if (els.word && Math.abs(prev.w - 1) > LOD_OPACITY_EPS) {
              els.word.style.opacity = "1";
              prev.w = 1;
            }
            if (els.gloss && prev.g !== 0) {
              els.gloss.style.opacity = "0";
              prev.g = 0;
            }
            const s0 = lab.userData.lodScale0 ?? 1;
            lab.scale.setScalar(s0 * 1.02);
          }
        }
      } else {
        const camP = camera.position;
        const focusT = morphFocusMesh ? clock.elapsedTime - morphFocusT0 : 100;
        const focusPulse = focusT < 0.33 ? 1 - smoothstep(focusT / 0.3) : 0;
        const focusWordId = morphFocusMesh?.userData?.wordId ?? null;
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          if (!grp?.visible) continue;
          for (const mesh of grp.userData.meshes) {
            const lab = mesh.userData.label;
            const els = lab?.userData?.lodEls;
            const prev = lab?.userData?.lodPrev;
            if (!els || !prev) continue;
            const isApex = !!lab.userData?.isRoot;
            mesh.getWorldPosition(lodWorld);
            const d = camP.distanceTo(lodWorld);
            _morphCamDir.subVectors(camP, controls.target).normalize();
            _morphToNode.subVectors(lodWorld, controls.target).normalize();
            const facing = _morphCamDir.dot(_morphToNode);
            const backMul = facing < -0.12 && d > 46 ? 0.55 + 0.45 * smoothstep((d - 46) / 42) : 1;
            const sMul =
              focusWordId &&
              mesh.userData.wordId === focusWordId &&
              mesh !== morphFocusMesh &&
              focusT < 0.38
                ? 1 - 0.26 * focusPulse
                : 1;
            const pFar = isApex ? 96 : 50;
            const pSpan = isApex ? 72 : 58;
            const wFar = isApex ? 142 : 88;
            const wSpan = isApex ? 72 : 58;
            const pA0 = Math.max(0, Math.min(1, 1 - smoothstep((d - pFar) / pSpan)));
            const wA0 = Math.max(0, Math.min(1, 1 - smoothstep((d - wFar) / wSpan)));
            const pA = pA0 * backMul * sMul;
            const wA = wA0 * backMul * sMul;
            if (els.gloss) {
              if (Math.abs(0 - prev.g) > LOD_OPACITY_EPS) {
                els.gloss.style.opacity = "0";
                prev.g = 0;
              }
            }
            if (els.pos && Math.abs(pA - prev.p) > LOD_OPACITY_EPS) {
              els.pos.style.opacity = String(pA);
              prev.p = pA;
            }
            if (els.word && Math.abs(wA - prev.w) > LOD_OPACITY_EPS) {
              els.word.style.opacity = String(wA);
              prev.w = wA;
            }
            const distScale = THREE.MathUtils.clamp(
              1.1 - 0.38 * smoothstep((d - (isApex ? 32 : 22)) / (isApex ? 112 : 96)),
              isApex ? 0.78 : 0.72,
              1.1
            );
            const focusLabBoost =
              morphFocusMesh === mesh && focusT < 0.32
                ? 1 + 0.12 * (1 - smoothstep(focusT / 0.3))
                : 1;
            const s0 = lab.userData.lodScale0 ?? 1;
            lab.scale.setScalar(s0 * distScale * focusLabBoost);
          }
        }
      }
    }

    // Layout transition (Garden/Master × 3D/WB): camera is fully scripted — disable orbit so damping
    // does not overwrite transforms. Brief camera-fit tweens leave controls ON (otherwise many sessions
    // lost input parity if ticks fall behind — whiteboard stays dead).
    const scriptingLayoutOnly = !!transition;
    controls.enableDamping = !!(introDone && !scriptingLayoutOnly && !cameraFitTween);
    controls.enabled = !!(introDone && !scriptingLayoutOnly);

    controls.update();
    if (introDone && bridges.visible) updateBridgeLines(bridges, viewBlend);
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

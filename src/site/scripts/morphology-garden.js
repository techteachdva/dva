/**
 * Morphology Garden — 3D + animated whiteboard view, shared morpheme bridges.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const TRANSITION_SEC = REDUCED_MOTION ? 0.01 : 1.35;

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
];

const COLS = 4;
const GAP_X = 40;
const GAP_Z = 36;

function assignGrid2d() {
  const rows = Math.ceil(WORDS.length / COLS);
  WORDS.forEach((w, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    w.pos3d = new THREE.Vector3(w.position[0], w.position[1], w.position[2]);
    w.pos2d = new THREE.Vector3(
      (col - (COLS - 1) / 2) * GAP_X,
      -10,
      (row - (rows - 1) / 2) * GAP_Z
    );
  });
}

function layoutSubtree(node, depth, xCenter, spread) {
  if (!node.children || node.children.length === 0) {
    return { width: spread, positions: [{ node, x: xCenter, y: -depth * 3.35, z: 0 }] };
  }
  const childSpread = spread / node.children.length;
  const allPos = [{ node, x: xCenter, y: -depth * 3.35, z: 0 }];
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

function makeLabel(text, sub, isRoot) {
  const div = document.createElement("div");
  div.className = "morph-lab";
  const w = document.createElement("div");
  w.className = "morph-lab__word";
  w.textContent = text;
  const g = document.createElement("div");
  g.className = "morph-lab__gloss";
  g.textContent = sub || "";
  div.appendChild(w);
  div.appendChild(g);
  const obj = new CSS2DObject(div);
  obj.userData.isRoot = isRoot;
  return obj;
}

function buildWordGroup(word) {
  const group = new THREE.Group();
  group.userData.wordId = word.id;
  group.userData.meshes = [];
  group.userData.lines = [];

  const spread = 13;
  const { positions } = layoutSubtree(word.tree, 0, 0, spread);
  const meshes = new Map();

  for (const p of positions) {
    const { node, x, y, z } = p;
    const isRoot = node === word.tree;
    const r = isRoot ? 0.78 : node.morphemeKey ? 0.55 : 0.48;
    const hue = node.morphemeKey
      ? node.morphemeKey.startsWith("pfx:")
        ? 0.56
        : node.morphemeKey.startsWith("sfx:")
          ? 0.82
          : 0.14
      : 0.7;
    const col = new THREE.Color().setHSL(hue, 0.72, 0.52);
    const mesh = sphere(r, col);
    mesh.position.set(x, y, z);
    mesh.userData.morphemeKey = node.morphemeKey || null;
    mesh.userData.wordId = word.id;
    group.add(mesh);
    meshes.set(node, mesh);
    group.userData.meshes.push(mesh);
    if (node.morphemeKey) registerMorpheme(node.morphemeKey, mesh, word.id);

    const label = makeLabel(node.text, node.gloss || "", isRoot);
    const lift = r + (isRoot ? 0.55 : 0.42);
    label.position.set(x, y - lift, z);
    group.add(label);
  }

  for (const p of positions) {
    const { node } = p;
    if (!node.children || !node.children.length) continue;
    const parentMesh = meshes.get(node);
    for (const c of node.children) {
      const childMesh = meshes.get(c);
      if (parentMesh && childMesh) {
        const line = edgeLine(parentMesh.position.clone(), childMesh.position.clone(), 0x55ffcc, 0.9);
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
  const v3a = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  bridges.children.forEach((line) => {
    if (!line.userData.a || !line.userData.b) return;
    line.userData.a.getWorldPosition(v3a);
    line.userData.b.getWorldPosition(v3b);
    line.geometry.setFromPoints([v3a, v3b]);
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

const SINGULARITY = new THREE.Vector3(0, -8, 0);
/** Bloom → one smooth 360° pass → settle (no oscillating radius / targets) */
const INTRO_T_GROW = 2.85;
const INTRO_T_ORBIT = 10.25;
const INTRO_T_SETTLE = 1.75;
const INTRO_ORBIT_RADIUS = 64;
const INTRO_ORBIT_HEIGHT = 24;
const INTRO_SPIN_TURNS = 0.75;

function init(host, detailEl, selectEl, shellEl) {
  assignGrid2d();
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
  controls.dampingFactor = 0.07;
  controls.minDistance = 10;
  controls.maxDistance = 220;
  controls.target.copy(cam3dTarget);
  controls.enabled = false;

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

  const sceneCenter = new THREE.Vector3();
  for (const w of WORDS) sceneCenter.add(w.pos3d);
  sceneCenter.multiplyScalar(1 / WORDS.length);

  for (const w of WORDS) {
    const g = wordGroups[w.id];
    g.position.copy(SINGULARITY);
    g.scale.setScalar(0.012);
    g.rotation.y = 0;
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
    }
    bridges.visible = true;
    bridges.children.forEach((line) => {
      if (line.material) line.material.opacity = 0.62;
    });
    grid.visible = true;
  }

  function flyToWord(id) {
    const g = wordGroups[id];
    if (!g) return;
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    focusCenter.copy(c);
    cam3dTarget.copy(c);
    cam3dPos.copy(c).add(new THREE.Vector3(18, 16, 36));
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

  const firstWordId = WORDS[0].id;
  if (selectEl) {
    selectEl.innerHTML = WORDS.map((w) => `<option value="${w.id}">${w.label}</option>`).join("");
    selectEl.addEventListener("change", () => {
      fillDetail(selectEl.value);
      flyToWord(selectEl.value);
    });
    fillDetail(selectEl.value || firstWordId);
    flyToWord(selectEl.value || firstWordId);
  } else {
    flyToWord(firstWordId);
  }

  let viewTarget = 0;
  let viewBlend = 0;
  let transition = null;

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
    const next = to2d ? 1 : 0;
    if (next === viewTarget && transition === null && Math.abs(viewBlend - next) < 0.02) return;
    transition = {
      from: viewBlend,
      to: next,
      t0: clock.elapsedTime,
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
    bridges.children.forEach((line) => {
      if (line.material) line.material.opacity = bridgeOpacity;
    });

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

    const cam2dPos = focusCenter.clone().add(new THREE.Vector3(0, 18, 104));
    const cam2dTarget = focusCenter.clone();
    camera.position.lerpVectors(cam3dPos, cam2dPos, u);
    controls.target.lerpVectors(cam3dTarget, cam2dTarget, u);

    controls.enableRotate = u < 0.75;
    camera.fov = 48 + 3 * u;
    camera.updateProjectionMatrix();
  }

  /* Intro overlay */
  const intro = document.createElement("div");
  intro.className = "morph-intro";
  intro.innerHTML = `
    <div class="morph-intro-grid" aria-hidden="true"></div>
    <div class="morph-intro-title">Morphology</div>
    <div class="morph-intro-sub">The Analysis of Words · Ch. 4</div>
    <div class="morph-intro-tag">● Word trees · 3D &amp; whiteboard ●</div>
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
    flyToWord(WORDS[0].id);
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
    flyToWord(selectEl?.value || firstWordId);
    camera.position.copy(cam3dPos);
    controls.target.copy(cam3dTarget);
    controls.enabled = true;
    controls.update();
  }

  skipBtn.addEventListener("click", endIntro);

  setViewButtons();

  window.addEventListener("resize", () => {
    camera.aspect = host.clientWidth / host.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    labelRenderer.setSize(host.clientWidth, host.clientHeight);
  });

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    introT += dt;

    if (!introDone && !REDUCED_MOTION) {
      if (introT < INTRO_T_GROW) {
        const g = Math.min(1, introT / INTRO_T_GROW);
        const growE = easeOutCubic(g);
        const posE = easeOutCubic(g);

        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          grp.position.lerpVectors(SINGULARITY, w.pos3d, posE);
          grp.scale.setScalar(0.012 + 0.988 * growE);
          grp.rotation.y = 0;
        }

        const bloomBridge = smoothstep((g - 0.22) / 0.55);
        bridges.visible = bloomBridge > 0.03;
        bridges.children.forEach((line) => {
          if (line.material) line.material.opacity = 0.62 * bloomBridge;
        });
        grid.visible = g > 0.08;

        const pull = easeInOutCubic(g);
        const orbitEntry = new THREE.Vector3(
          sceneCenter.x + INTRO_ORBIT_RADIUS * 0.92,
          sceneCenter.y + INTRO_ORBIT_HEIGHT + 18,
          sceneCenter.z + INTRO_ORBIT_RADIUS * 0.92
        );
        camera.position.lerpVectors(introStartPos, orbitEntry, pull);
        controls.target.lerpVectors(SINGULARITY.clone(), sceneCenter.clone(), pull);
      } else if (introT < INTRO_T_GROW + INTRO_T_ORBIT) {
        const orbitElapsed = introT - INTRO_T_GROW;
        const u = Math.min(1, orbitElapsed / INTRO_T_ORBIT);
        const phi = easeInOutCubic(u) * Math.PI * 2;

        introSpinAngle = phi * INTRO_SPIN_TURNS;
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          const phase = w.pos3d.x * 0.002 + w.pos3d.z * 0.0015;
          grp.rotation.y = introSpinAngle + phase * 0.08;
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
        const settleElapsed = introT - INTRO_T_GROW - INTRO_T_ORBIT;
        const se = Math.min(1, settleElapsed / INTRO_T_SETTLE);
        const spinDamp = 1 - easeOutCubic(se);
        for (const w of WORDS) {
          const grp = wordGroups[w.id];
          const phase = w.pos3d.x * 0.002 + w.pos3d.z * 0.0015;
          grp.rotation.y = (introSpinAngle + phase * 0.08) * spinDamp;
        }

        if (!introSettle.captured) {
          introSettle.captured = true;
          introSettle.fromPos.copy(camera.position);
          introSettle.fromTarget.copy(controls.target);
          flyToWord(selectEl?.value || firstWordId);
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
      viewBlend = transition.from + (transition.to - transition.from) * e;
      if (k >= 1) {
        viewBlend = transition.to;
        transition = null;
      }
    }

    if (introDone) applyVisualTheme(viewBlend);

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

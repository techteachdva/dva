/**
 * Morphology Garden — flat 2-D explorer for word morphology.
 *
 * Three modes:
 *   • Word     — one word's tree (single tree centered).
 *   • Morpheme — every word in the bank that contains a chosen morpheme,
 *                laid out on a grid with magenta links between matching morphemes.
 *   • Compare  — exactly two word trees side-by-side with shared-morpheme links.
 *
 * Only the selected tree(s) are on screen. The camera is a single orthographic
 * rig that always frames the visible bounding box at the largest safe zoom.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import {
  AFFIX_ORIGIN_HINT,
  configureLessonWordLookup,
  renderMorphLessonHtml,
  renderMorphDualLessonHtml,
} from "./morphology-lessons-data.js";
import { MORPHOLOGY_WORD_LIST } from "./morphology-words-data.js";
import { MORPHEME_CATALOG } from "./morphology-morpheme-catalog.js";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** @type {{ open: () => void; close: () => void; isOpen: () => boolean } | null} */
let morphTutorialCtl = null;

const MORPH_SELECT_PREFIX = "__morph__:";

const TREE_DEPTH_STEP = 6.15;
const TREE_LAYOUT_RADIUS0 = 13.5;

const WORDS = JSON.parse(JSON.stringify(MORPHOLOGY_WORD_LIST));

/** @type {Record<string, Array<{mesh: THREE.Mesh, wordId: string}>>} */
const morphemeRegistry = {};

/* ----------------------------------------------------------------------- */
/*  Helpers                                                                */
/* ----------------------------------------------------------------------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectMorphemeKeys(node, /** @type {Set<string>} */ out) {
  if (!node) return;
  if (node.morphemeKey) out.add(node.morphemeKey);
  for (const c of node.children || []) collectMorphemeKeys(c, out);
}

/** Lemma ids whose tree JSON contains `key`. */
function wordIdsForMorphemeKey(key) {
  const out = [];
  for (const w of WORDS) {
    const ks = new Set();
    collectMorphemeKeys(w.tree, ks);
    if (ks.has(key)) out.push(w.id);
  }
  return out;
}

/** All morpheme keys in the bank, sorted prefix → root → lex → suffix. */
function allMorphemeKeysInBank() {
  /** @type {Set<string>} */
  const set = new Set();
  for (const w of WORDS) collectMorphemeKeys(w.tree, set);
  const arr = [...set];
  const order = { "pfx:": 0, "root:": 1, "lex:": 2, "sfx:": 3 };
  arr.sort((a, b) => {
    const ka = order[a.match(/^[a-z]+:/)?.[0]] ?? 9;
    const kb = order[b.match(/^[a-z]+:/)?.[0]] ?? 9;
    if (ka !== kb) return ka - kb;
    return a.localeCompare(b);
  });
  return arr;
}

function morphemeKeyShort(k) {
  return k.replace(/^(pfx|sfx|root|lex):/, "");
}

/** Human-readable type label derived from the catalog key (catalog rows may also set `type` to override). */
function morphemeTypeLabel(key, /** @type {string=} */ override) {
  if (override) return override;
  if (typeof key !== "string") return "Morpheme";
  if (key.startsWith("pfx:")) return "Prefix";
  if (key.startsWith("sfx:")) return "Suffix";
  if (key.startsWith("root:")) return "Root";
  if (key.startsWith("lex:")) return "Lexeme";
  return "Morpheme";
}

/** Modifier string for badge styling (matches morph-chart__type--<slug>). */
function morphemeTypeSlug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function morphemeCatalogRow(key) {
  return MORPHEME_CATALOG.find((r) => r.key === key);
}

function registerMorpheme(key, mesh, wordId) {
  if (!key) return;
  if (!morphemeRegistry[key]) morphemeRegistry[key] = [];
  morphemeRegistry[key].push({ mesh, wordId });
}

/* ----------------------------------------------------------------------- */
/*  Tree builder                                                           */
/* ----------------------------------------------------------------------- */

function unaryBranchJitter(depth) {
  return Math.sin(depth * 1.37) * 0.28 + (((depth % 3) - 1) * 0.22);
}

/** Apex-up tree layout in XY — children fan into a downward wedge. */
function layoutSubtree(node, depth, x, y, wedgeStart, wedgeSize, radial) {
  const positions = [{ node, x, y, z: 0, depth }];
  const children = node.children || [];
  if (!children.length) return positions;

  const yChild = y - TREE_DEPTH_STEP;
  const n = children.length;
  const wedge = Math.max(wedgeSize, 0.45 + 0.28 * n);
  const rBase = radial * Math.max(0.48, Math.min(1.06, 0.62 / Math.sqrt(Math.max(n, 2))));
  const r = Math.max(4, Math.min(16, TREE_LAYOUT_RADIUS0 * rBase));

  for (let i = 0; i < n; i++) {
    const slice = wedge / Math.max(n, 1);
    const tLo = wedgeStart + i * slice;
    let theta = (tLo + slice * 0.5) % (Math.PI * 2);
    if (n === 1) theta = (wedgeStart + wedge * 0.5 + unaryBranchJitter(depth)) % (Math.PI * 2);
    const cx = x + Math.cos(theta) * r;
    positions.push(...layoutSubtree(children[i], depth + 1, cx, yChild, tLo, slice, radial * 0.96));
  }
  return positions;
}

function relaxPlanarTreePositions(positions, iterations = 36) {
  const orig = positions.map((p) => ({ x: p.x, y: p.y }));
  const minDist = 5.35;
  const alpha = 0.2;
  const anchor = 0.14;
  for (let iter = 0; iter < iterations; iter++) {
    const forces = positions.map(() => ({ fx: 0, fy: 0 }));
    for (let i = 0; i < positions.length; i++) {
      forces[i].fx += (orig[i].x - positions[i].x) * anchor;
      forces[i].fy += (orig[i].y - positions[i].y) * anchor;
    }
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        const depthBoost = a.depth === b.depth ? 0.85 : 0;
        const target = minDist + depthBoost;
        if (dist < target) {
          const push = (target - dist) * 0.52;
          dx /= dist;
          dy /= dist;
          forces[i].fx -= dx * push;
          forces[i].fy -= dy * push;
          forces[j].fx += dx * push;
          forces[j].fy += dy * push;
        }
      }
    }
    for (let i = 0; i < positions.length; i++) {
      positions[i].x += forces[i].fx * alpha;
      positions[i].y += forces[i].fy * alpha;
      if (!Number.isFinite(positions[i].x)) positions[i].x = orig[i].x;
      if (!Number.isFinite(positions[i].y)) positions[i].y = orig[i].y;
    }
  }
}

function sphereMesh(r, color) {
  const geo = new THREE.SphereGeometry(r, 28, 28);
  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness: 0.5,
    roughness: 0.35,
    emissive: color,
    emissiveIntensity: 0.09,
  });
  const m = new THREE.Mesh(geo, mat);
  m.userData.baseEmissive = color.clone();
  return m;
}

/** Glass halo around a morpheme node. */
function glassShell(innerR, baseColor, isRoot) {
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
  return shell;
}

function edgeLine(a, b, color = 0x55ffcc) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
  return new THREE.Line(geo, mat);
}

function glossAfterColon(gloss) {
  if (!gloss) return "";
  const i = gloss.indexOf(":");
  return (i < 0 ? gloss : gloss.slice(i + 1)).trim();
}

function categoryFromGloss(gloss) {
  if (!gloss) return "Word";
  const head = (gloss.indexOf(":") >= 0 ? gloss.slice(0, gloss.indexOf(":")) : gloss).trim().toLowerCase();
  if (head.startsWith("noun")) return "Noun";
  if (head.startsWith("adj")) return "Adjective";
  if (head.includes("verb") && !head.includes("adverb")) return "Verb";
  if (head.includes("adverb")) return "Adverb";
  if (head.includes("preposition")) return "Preposition";
  const w = head.split(/[\s/]+/)[0] || "Word";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function nodePosLabel(node, isRoot) {
  if (node.pos) return node.pos;
  if (isRoot) return categoryFromGloss(node.gloss);
  if (node.morphemeKey) {
    if (node.morphemeKey.startsWith("pfx:")) return "Prefix";
    if (node.morphemeKey.startsWith("sfx:")) return "Suffix";
    if (node.morphemeKey.startsWith("root:")) return "Root";
    if (node.morphemeKey.startsWith("lex:")) return "Lexeme";
  }
  const t = node.text || "";
  if (t.startsWith("-")) return "Suffix";
  if (t.endsWith("-")) return "Prefix";
  return "Stem";
}

function makeNodeLabel({ pos, text, isRoot }) {
  const div = document.createElement("div");
  div.className = "morph-lab morph-lab--orbital" + (isRoot ? " morph-lab--root morph-lab--apex" : "");
  if (pos) {
    const p = document.createElement("div");
    p.className = "morph-lab__pos";
    p.textContent = pos;
    div.appendChild(p);
  }
  const w = document.createElement("div");
  w.className = "morph-lab__word";
  w.textContent = text;
  div.appendChild(w);
  return new CSS2DObject(div);
}

function buildWordGroup(word) {
  const group = new THREE.Group();
  group.userData.wordId = word.id;
  group.userData.meshes = [];
  group.userData.lines = [];

  const positions = layoutSubtree(word.tree, 0, 0, 0, -Math.PI, Math.PI, 1);
  relaxPlanarTreePositions(positions);

  /** @type {Map<object, THREE.Mesh>} */
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
    }
    const col = new THREE.Color().setHSL(hue, 0.72, 0.52);

    const mesh = sphereMesh(r, col);
    mesh.position.set(x, y, z);
    mesh.userData.wordId = word.id;
    mesh.userData.morphemeKey = node.morphemeKey || null;
    mesh.userData.treeDepth = treeDepth;
    mesh.userData.tooltip = {
      morpheme: node.text,
      category: posLabel,
      gloss: glossAfterColon(node.gloss) || node.gloss || "",
      wordLabel: word.label,
    };

    const shell = glassShell(r, col, isRoot);
    mesh.add(shell);
    group.add(mesh);
    meshes.set(node, mesh);
    group.userData.meshes.push(mesh);
    if (node.morphemeKey) registerMorpheme(node.morphemeKey, mesh, word.id);

    const label = makeNodeLabel({ pos: posLabel, text: node.text, isRoot });
    label.position.set(x, y + r * (isRoot ? 0.45 : 0.38), z);
    group.add(label);
    mesh.userData.label = label;
  }

  for (const p of positions) {
    if (!p.node.children?.length) continue;
    const parent = meshes.get(p.node);
    for (const c of p.node.children) {
      const child = meshes.get(c);
      if (parent && child) {
        const line = edgeLine(parent.position.clone(), child.position.clone());
        line.userData.a = parent;
        line.userData.b = child;
        group.add(line);
        group.userData.lines.push(line);
      }
    }
  }

  return group;
}

/* ----------------------------------------------------------------------- */
/*  Bridges (magenta links between same-morpheme spheres in different      */
/*  visible word groups)                                                   */
/* ----------------------------------------------------------------------- */

function buildBridges(scene) {
  const group = new THREE.Group();
  group.name = "morph-bridges";
  const baseMat = new THREE.LineBasicMaterial({
    color: 0xff4dd4,
    transparent: true,
    opacity: 0.62,
  });
  for (const key of Object.keys(morphemeRegistry)) {
    const arr = morphemeRegistry[key];
    if (!arr || arr.length < 2) continue;
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[i].wordId === arr[j].wordId) continue;
        const line = new THREE.Line(new THREE.BufferGeometry(), baseMat.clone());
        line.userData.a = arr[i].mesh;
        line.userData.b = arr[j].mesh;
        line.userData.key = key;
        line.userData.wordA = arr[i].wordId;
        line.userData.wordB = arr[j].wordId;
        line.visible = false;
        group.add(line);
      }
    }
  }
  scene.add(group);
  return group;
}

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();

function updateBridgeGeometry(bridges) {
  for (const line of bridges.children) {
    if (!line.visible) continue;
    if (!line.userData.a || !line.userData.b) continue;
    line.userData.a.getWorldPosition(_vA);
    line.userData.b.getWorldPosition(_vB);
    line.geometry.setFromPoints([_vA, _vB]);
  }
}

function updateInternalTreeLine(line) {
  if (!line.userData.a || !line.userData.b || !line.geometry) return;
  line.geometry.setFromPoints([line.userData.a.position, line.userData.b.position]);
}

/* ----------------------------------------------------------------------- */
/*  Lesson HTML                                                            */
/* ----------------------------------------------------------------------- */

/**
 * Morpheme primer — renders the SWI-style mini-lesson for a single morpheme.
 * Sections render only when the underlying catalog field is present, so this scales
 * gracefully as authors add or remove pedagogical content per entry.
 *
 * Pedagogical structure (Bowers & Kirby, Structured Word Inquiry):
 *   1. Meaning first ("What it does")
 *   2. Etymology (where the morpheme came from)
 *   3. Structure ("Word sums" — explicit decomposition with + and →)
 *   4. Decoding strategy (student-facing heuristic)
 *   5. Spelling / phonology note (suffix-changing rules, assimilation, allomorphs)
 *   6. Bank words (live links to the word trees on the board)
 *   7. Examples beyond the bank
 *   8. Family — related / contrasting morphemes ("Compare with")
 *   9. Inquiry prompts ("Try this")
 *  10. Teaching tip (smart-board-ready classroom move)
 *  11. Wiktionary deep dive
 */
function morphemePrimerHtml(key, linkedWordIds) {
  const row = morphemeCatalogRow(key);
  const short = morphemeKeyShort(key);
  const typeLabel = morphemeTypeLabel(key, row?.type);
  const typeSlug = morphemeTypeSlug(typeLabel);

  const wikt = row?.wiktionary || row?.morpheme || short;
  const wiktUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(wikt)}`;

  const sections = [];

  sections.push(`<header class="morph-lesson__head">
      <h3 class="morph-lesson__h">
        <span class="morph-lesson__morpheme"><em translate="no">${escapeHtml(row?.morpheme ?? short)}</em></span>
        <span class="morph-chart__type morph-chart__type--${escapeHtml(typeSlug)}">${escapeHtml(typeLabel)}</span>
      </h3>
      ${row ? `<p class="morph-lesson__bracket-caption"><strong>Origin:</strong> ${escapeHtml(row.origin)}</p>` : ""}
    </header>`);

  if (row?.meaning) {
    sections.push(`<p class="morph-lesson__lead"><strong>What it does:</strong> ${escapeHtml(row.meaning)}.</p>`);
  }

  if (row?.etymology) {
    sections.push(`<p class="morph-lesson__etymology"><strong>Etymology:</strong> ${escapeHtml(row.etymology)}</p>`);
  }

  if (row?.wordSums?.length) {
    const items = row.wordSums.map((s) => `<li><code class="morph-wordsum">${escapeHtml(s)}</code></li>`).join("");
    sections.push(`<section class="morph-lesson__sec morph-lesson__sec--wordsums">
        <h4>Word sums — how it builds</h4>
        <ul class="morph-lesson__wordsums">${items}</ul>
      </section>`);
  }

  if (row?.decodingTip) {
    sections.push(`<section class="morph-lesson__sec morph-lesson__sec--decode">
        <h4>Decoding tip</h4>
        <p>${escapeHtml(row.decodingTip)}</p>
      </section>`);
  }

  if (row?.spellingNote) {
    sections.push(`<section class="morph-lesson__sec morph-lesson__sec--spelling">
        <h4>Spelling note</h4>
        <p>${escapeHtml(row.spellingNote)}</p>
      </section>`);
  }

  const labels = linkedWordIds
    .map((id) => WORDS.find((w) => w.id === id))
    .filter(Boolean)
    .map((w) => `<li><button class="morph-link-pick" data-morph-pick-word="${escapeHtml(w.id)}">${escapeHtml(w.label)}</button></li>`)
    .join("");
  sections.push(`<section class="morph-lesson__sec">
      <h4>Words on the board (${linkedWordIds.length})</h4>
      ${labels ? `<ul class="morph-lesson__ul morph-lesson__ul--picks">${labels}</ul>` : `<p>No words in this bank are tagged with this morpheme yet.</p>`}
      <p class="morph-lesson__meta">Click any word to switch to <strong>Word</strong> mode and load its tree + lesson.</p>
    </section>`);

  if (row?.outsideExamples?.length) {
    sections.push(`<section class="morph-lesson__sec">
        <h4>More examples beyond this bank</h4>
        <p>${row.outsideExamples.map(escapeHtml).join(", ")}</p>
      </section>`);
  }

  if (row?.confusedWith?.length) {
    const buttons = row.confusedWith
      .map((relKey) => {
        const r = morphemeCatalogRow(relKey);
        if (!r) return "";
        return `<li><button class="morph-link-pick morph-link-pick--key" data-morph-pick-key="${escapeHtml(relKey)}"><span translate="no">${escapeHtml(r.morpheme)}</span></button> <span class="morph-lesson__meta">${escapeHtml(r.meaning)}</span></li>`;
      })
      .filter(Boolean)
      .join("");
    if (buttons) {
      sections.push(`<section class="morph-lesson__sec morph-lesson__sec--family">
          <h4>Compare with</h4>
          <ul class="morph-lesson__ul morph-lesson__ul--family">${buttons}</ul>
          <p class="morph-lesson__meta">Click a morpheme to load its lesson side-by-side in <strong>Morpheme</strong> mode.</p>
        </section>`);
    }
  }

  if (row?.inquiryPrompts?.length) {
    const items = row.inquiryPrompts.map((p) => `<li>${escapeHtml(p)}</li>`).join("");
    sections.push(`<section class="morph-lesson__sec morph-lesson__sec--inquiry">
        <h4>Try this — student inquiry</h4>
        <ol class="morph-lesson__ul morph-lesson__ul--inquiry">${items}</ol>
      </section>`);
  }

  if (row?.teachingTip) {
    sections.push(`<section class="morph-lesson__sec morph-lesson__sec--teach">
        <h4>Teach it — 30-second classroom move</h4>
        <p>${escapeHtml(row.teachingTip)}</p>
      </section>`);
  }

  sections.push(`<p class="morph-lesson__meta">
      <a class="morph-chart__wikt" href="${escapeHtml(wiktUrl)}" target="_blank" rel="noreferrer noopener">Open <code translate="no">${escapeHtml(wikt)}</code> on Wiktionary &nearr;</a>
    </p>`);

  return `<div class="morph-lesson morph-lesson--single morph-lesson--morpheme">${sections.join("")}</div>`;
}

/* ----------------------------------------------------------------------- */
/*  Guided tour (student-facing; highlights page regions)                  */
/* ----------------------------------------------------------------------- */

const MORPH_TUTORIAL_STEPS = [
  {
    title: "Welcome to the word explorer",
    html: `<p>This page is a <strong>hands-on map</strong> of how English words are built. Long words are not random letters — they are often <strong>prefix + base + suffix</strong> (and sometimes two bases glued together).</p><p>Use this tour to learn where each tool lives. When a step mentions a part of the page, that part will <strong>light up</strong> so you cannot miss it.</p>`,
    highlights: ["#morph-page-intro"],
  },
  {
    title: "The big board",
    html: `<p>This is the <strong>drawing space</strong> for word trees. Each bubble is a morpheme (a meaningful chunk). Lines show how they connect.</p><p><strong>Drag</strong> with your finger or mouse to slide the board around. The page <strong>auto-fits</strong> the tree so you always see the whole picture — you do not need to zoom in and out.</p>`,
    highlights: ["#morph-canvas-host"],
  },
  {
    title: "Pick how you want to learn",
    html: `<p>Three buttons, three superpowers:</p><ul><li><strong>Word</strong> — study <em>one</em> word deeply.</li><li><strong>Morpheme</strong> — see <em>every word in the bank</em> that shares the same chunk (for example the same prefix or suffix).</li><li><strong>Compare</strong> — put <em>two</em> words side by side and spot what they share.</li></ul><p>Try all three — they are the fastest way to notice patterns.</p>`,
    highlights: [".morph-mode-toolbar"],
  },
  {
    title: "Menus that load the board",
    html: `<p>Under the three buttons you will see <strong>dropdowns</strong> that match the mode you picked.</p><p>In <strong>Word</strong> mode, pick any word from the list. In <strong>Morpheme</strong> mode, pick a morpheme to load every linked word. In <strong>Compare</strong> mode, pick word A and word B.</p>`,
    highlights: [".morph-pick-area"],
  },
  {
    title: "Quick reminder strip",
    html: `<p>This line is your <strong>cheat sheet</strong> for controls: panning, refitting the view, keyboard shortcuts, and what clicks do on the board.</p><p>If you forget a shortcut, glance here first.</p>`,
    highlights: ["#morph-hint"],
  },
  {
    title: "Mini-lesson card",
    html: `<p>Under the explorer (or <strong>beside</strong> it in full screen) you will find the <strong>mini-lesson</strong>. It explains the word or morpheme you selected — meaning, word sums, spelling tips, and questions you can actually discuss in class.</p><p>Use the <strong>A−</strong> <strong>A</strong> <strong>A+</strong> buttons to change text size if you want it bigger or smaller.</p>`,
    highlights: ["#morph-detail"],
  },
  {
    title: "Help, full screen, and lesson size",
    html: `<p>The <strong>❓ Help</strong> button opens a longer reference anytime (you can open it again after this tour).</p><p><strong>🖥️ Full screen</strong> is great for a projector or smart board: the board moves to one side and the lesson to the other so both stay readable.</p><p>When you go full screen, a <strong>Lesson</strong> text-size row appears in the bar too (same job as the A− / A / A+ buttons above the lesson card).</p>`,
    highlights: [".morph-ui-row--meta"],
  },
  {
    title: "Five big ideas (read at your pace)",
    html: `<p>Scroll down when you want reading that ties the chapter to what you see in the trees — morphemes vs syllables, roots and affixes, free and bound bases, and more.</p><p>There is no rush: you can come back to this section anytime.</p>`,
    highlights: ["#morph-highlights-section"],
  },
  {
    title: "Word bank chart",
    html: `<p>This table lists morphemes in the bank. Each row shows the <strong>Type</strong> (Prefix, Suffix, Root, or Lexeme), a plain-language meaning, which words use it here, and a link to Wiktionary if you want to go deeper.</p><p><strong>Click a morpheme</strong> in the first column to jump into <strong>Morpheme</strong> mode on the board. <strong>Click a word</strong> in the list to open <strong>Word</strong> mode.</p>`,
    highlights: ["#morph-chart-section"],
  },
  {
    title: "You are ready — here is what to try next",
    html: `<p><strong>Try this next:</strong></p><ol><li>Stay in <strong>Word</strong> mode and pick a word you use in science or social studies. Read its mini-lesson out loud with a partner.</li><li>Switch to <strong>Morpheme</strong> mode and pick a suffix you like (<strong>-tion</strong>, <strong>-ly</strong>, <strong>-less</strong>…). Count how many words light up on the board.</li><li>Click a bubble on the tree. If it appears in more than one word, the page will jump you into <strong>Morpheme</strong> mode automatically.</li><li>When you present or teach, use <strong>full screen</strong> so everyone can see both the tree and the lesson.</li></ol><p>Have fun digging — patterns are easier when you can <em>see</em> them.</p>`,
    highlights: [],
  },
];

/**
 * @param {{ shellEl: HTMLElement | null; helpEl: HTMLElement | null }} opts
 */
function installMorphTutorial(opts) {
  const { shellEl, helpEl } = opts;
  const root = document.getElementById("morph-tutorial");
  const stepEl = document.getElementById("morph-tutorial-step");
  const titleEl = document.getElementById("morph-tutorial-heading");
  const descEl = document.getElementById("morph-tutorial-desc");
  const btnBack = document.getElementById("morph-tutorial-back");
  const btnNext = document.getElementById("morph-tutorial-next");
  const btnSkip = document.getElementById("morph-tutorial-skip");
  const panel = document.getElementById("morph-tutorial-panel");
  const openHeader = document.getElementById("morph-tour-open-header");
  const openHelp = document.getElementById("morph-tour-open-help");

  if (!root || !stepEl || !titleEl || !descEl || !btnBack || !btnNext || !btnSkip || !panel) {
    return { open() {}, close() {}, isOpen: () => false };
  }

  let stepIndex = 0;
  /** @type {HTMLElement[]} */
  let highlighted = [];

  function clearHighlights() {
    for (const el of highlighted) el.classList.remove("morph-tutorial-highlight");
    highlighted = [];
    shellEl?.classList.remove("morphology-shell--tutorial");
  }

  function applyHighlights(/** @type {string[]} */ selectors) {
    clearHighlights();
    if (!selectors.length) return;
    shellEl?.classList.add("morphology-shell--tutorial");
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el instanceof HTMLElement) {
        el.classList.add("morph-tutorial-highlight");
        highlighted.push(el);
      }
    }
    const first = highlighted[0];
    if (first && !REDUCED_MOTION) {
      first.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
    } else if (first) {
      first.scrollIntoView({ block: "center", inline: "nearest" });
    }
  }

  function renderStep() {
    const step = MORPH_TUTORIAL_STEPS[stepIndex];
    const n = MORPH_TUTORIAL_STEPS.length;
    stepEl.textContent = `Step ${stepIndex + 1} of ${n}`;
    titleEl.textContent = step.title;
    descEl.innerHTML = step.html;
    applyHighlights(step.highlights || []);
    btnBack.disabled = stepIndex === 0;
    btnBack.hidden = stepIndex === 0;
    const last = stepIndex === n - 1;
    btnNext.textContent = last ? "Finish" : "Next";
    btnSkip.style.display = last ? "none" : "";
  }

  function open() {
    helpEl?.classList.add("morph-help--hidden");
    root.classList.remove("morph-tutorial--hidden");
    stepIndex = 0;
    renderStep();
    btnNext.focus();
  }

  function close() {
    clearHighlights();
    root.classList.add("morph-tutorial--hidden");
    document.getElementById("morph-help-btn")?.focus?.();
  }

  function isOpen() {
    return !root.classList.contains("morph-tutorial--hidden");
  }

  const helpBtn = document.getElementById("morph-help-btn");

  btnBack.addEventListener("click", () => {
    if (stepIndex > 0) {
      stepIndex -= 1;
      renderStep();
    }
  });
  btnNext.addEventListener("click", () => {
    if (stepIndex < MORPH_TUTORIAL_STEPS.length - 1) {
      stepIndex += 1;
      renderStep();
    } else {
      close();
    }
  });
  btnSkip.addEventListener("click", () => close());
  openHeader?.addEventListener("click", () => open());
  openHelp?.addEventListener("click", () => open());

  return { open, close, isOpen };
}

/* ----------------------------------------------------------------------- */
/*  Main                                                                   */
/* ----------------------------------------------------------------------- */

function init() {
  const host = document.getElementById("morph-canvas-host");
  const detailEl = /** @type {HTMLElement | null} */ (document.getElementById("morph-detail"));
  const lessonHtmlTarget = /** @type {HTMLElement | null} */ (document.getElementById("morph-detail-body"));
  const shellEl = /** @type {HTMLElement | null} */ (document.getElementById("morphology-shell"));
  if (!host) return;

  configureLessonWordLookup((id) => WORDS.find((w) => w.id === id)?.label || id);

  /* The board is whiteboard-themed by default — add the modifier classes so existing label styles apply. */
  host.classList.add("morph-canvas-host--wb");
  shellEl?.classList.add("morphology-shell--wb");

  /* ---- scene + cam --------------------------------------------------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f6fb);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(0.3, 1, 0.65);
  scene.add(key);

  const camera = new THREE.OrthographicCamera(-100, 100, 100, -100, 0.06, 800);
  camera.position.set(0, 0, 220);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(host.clientWidth, host.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  host.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.enableZoom = false;
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.14;
  controls.screenSpacePanning = true;

  /**
   * Toggle group visibility AND every CSS2D label inside.
   * `CSS2DRenderer` doesn't propagate parent visibility — when a group flips to invisible, its
   * `CSS2DObject` children keep their last-rendered DOM transform unless we hide them ourselves.
   */
  function setWordGroupVisible(/** @type {THREE.Group} */ g, /** @type {boolean} */ vis) {
    g.visible = vis;
    for (const child of g.children) {
      if (child.isCSS2DObject && child.element) {
        child.element.style.display = vis ? "" : "none";
      }
    }
  }

  /* ---- build all word groups + bridges (eagerly — small bank) -------- */
  /** @type {Record<string, THREE.Group>} */
  const wordGroups = {};
  for (const w of WORDS) {
    const g = buildWordGroup(w);
    setWordGroupVisible(g, false);
    /* Park hidden groups far offscreen so any one-frame CSS-label race never paints inside the camera. */
    g.position.set(1e6, 1e6, 0);
    g.updateMatrixWorld(true);
    scene.add(g);
    wordGroups[w.id] = g;
  }

  const bridges = buildBridges(scene);

  /* ---- mode state ---------------------------------------------------- */
  /** @type {"word" | "morpheme" | "compare"} */
  let mode = "word";
  /** @type {string | null} */ let selectedWordId = WORDS[0]?.id ?? null;
  /** @type {string | null} */ let selectedMorpheme = null;
  /** @type {string | null} */ let compareA = WORDS[0]?.id ?? null;
  /** @type {string | null} */ let compareB = WORDS[1]?.id ?? compareA;

  /* If compareA = compareB make them different */
  if (compareA === compareB && WORDS.length > 1) compareB = WORDS[1].id;

  /** Lemma ids visible right now (after layout). */
  let visibleIds = /** @type {string[]} */ ([]);

  /* ---- DOM (toolbar) ------------------------------------------------- */
  const btnWord = document.getElementById("morph-mode-word");
  const btnMorph = document.getElementById("morph-mode-morpheme");
  const btnCompare = document.getElementById("morph-mode-compare");
  const pickWordRow = document.getElementById("morph-pick-word");
  const pickMorphRow = document.getElementById("morph-pick-morpheme");
  const pickCompareRow = document.getElementById("morph-pick-compare");
  const wordSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("morph-word-select"));
  const morphSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById("morph-morpheme-select"));
  const compareASel = /** @type {HTMLSelectElement | null} */ (document.getElementById("morph-compare-a"));
  const compareBSel = /** @type {HTMLSelectElement | null} */ (document.getElementById("morph-compare-b"));
  const fsBtn = document.getElementById("morph-btn-fs");
  const helpBtn = document.getElementById("morph-help-btn");
  const helpEl = document.getElementById("morph-help");

  /* ---- populate selectors (alphabetical) ----------------------------- */
  const WORDS_ALPHA = [...WORDS].sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base", numeric: true })
  );
  function fillWordSelect(/** @type {HTMLSelectElement | null} */ sel) {
    if (!sel) return;
    sel.innerHTML = WORDS_ALPHA.map(
      (w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.label)}</option>`
    ).join("");
  }
  function fillMorphSelect(/** @type {HTMLSelectElement | null} */ sel) {
    if (!sel) return;
    const items = allMorphemeKeysInBank().map((k) => {
      const row = morphemeCatalogRow(k);
      const count = wordIdsForMorphemeKey(k).length;
      const text = row?.morpheme ?? morphemeKeyShort(k);
      const meaning = row?.meaning ?? "";
      const lbl = meaning ? `${text} — ${meaning} (${count})` : `${text} (${count})`;
      const sortKey = String(text).replace(/^[-]+/, "").toLocaleLowerCase();
      return { key: k, text, lbl, sortKey };
    });
    items.sort((a, b) => a.sortKey.localeCompare(b.sortKey, undefined, { sensitivity: "base", numeric: true }));
    sel.innerHTML = items
      .map((it) => {
        const v = `${MORPH_SELECT_PREFIX}${encodeURIComponent(it.key)}`;
        return `<option value="${escapeHtml(v)}">${escapeHtml(it.lbl)}</option>`;
      })
      .join("");
  }
  fillWordSelect(wordSelect);
  fillWordSelect(compareASel);
  fillWordSelect(compareBSel);
  fillMorphSelect(morphSelect);

  if (wordSelect && selectedWordId) wordSelect.value = selectedWordId;
  if (compareASel && compareA) compareASel.value = compareA;
  if (compareBSel && compareB) compareBSel.value = compareB;
  if (morphSelect) {
    /* Pre-pick a morpheme that has multiple words so Morpheme mode is interesting on first click. */
    const keys = allMorphemeKeysInBank().filter((k) => wordIdsForMorphemeKey(k).length >= 2);
    selectedMorpheme = keys[0] ?? allMorphemeKeysInBank()[0] ?? null;
    if (selectedMorpheme) morphSelect.value = `${MORPH_SELECT_PREFIX}${encodeURIComponent(selectedMorpheme)}`;
  }

  /* ---- camera frame -------------------------------------------------- */
  const _box = new THREE.Box3();
  const _size = new THREE.Vector3();
  const _center = new THREE.Vector3();

  function frameToVisible() {
    scene.updateMatrixWorld(true);
    _box.makeEmpty();
    let any = false;
    for (const id of visibleIds) {
      const g = wordGroups[id];
      if (!g) continue;
      const b = new THREE.Box3().setFromObject(g);
      if (!b.isEmpty()) {
        _box.union(b);
        any = true;
      }
    }
    if (!any) _box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(60, 40, 1));

    _box.getCenter(_center);
    _box.getSize(_size);

    const aspect = Math.max(host.clientWidth / Math.max(host.clientHeight, 1), 0.25);
    /* Padding minimal — labels need a tiny bit of vertical slack so apex POS doesn't get clipped. */
    const padX = 1.04;
    const padY = 1.08;
    const halfH = Math.max((_size.y * padY) / 2, (_size.x * padX) / (2 * aspect), 12);

    camera.left = -halfH * aspect;
    camera.right = halfH * aspect;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.near = 0.06;
    camera.far = 800;
    camera.zoom = 1;
    camera.position.set(_center.x, _center.y, _center.z + 200);
    camera.up.set(0, 1, 0);
    camera.lookAt(_center.x, _center.y, _center.z);
    controls.target.set(_center.x, _center.y, _center.z);
    camera.updateProjectionMatrix();
    controls.update();
  }

  /* ---- layout helpers ----------------------------------------------- */
  function placeAtOriginCentered(/** @type {THREE.Group} */ g) {
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    const c = b.getCenter(new THREE.Vector3());
    g.position.set(-c.x, -c.y, 0);
    g.updateMatrixWorld(true);
  }

  function gridColsFor(n) {
    if (n <= 1) return 1;
    if (n <= 3) return n;
    if (n <= 4) return 2;
    if (n <= 6) return 3;
    if (n <= 9) return 3;
    return Math.ceil(Math.sqrt(n));
  }

  function layoutGrid(/** @type {string[]} */ ids) {
    if (!ids.length) return;
    const items = ids.map((id) => {
      const g = wordGroups[id];
      g.position.set(0, 0, 0);
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      const size = b.getSize(new THREE.Vector3());
      const center = b.getCenter(new THREE.Vector3());
      return { id, g, w: size.x, h: size.y, cx: center.x, cy: center.y };
    });
    const cols = gridColsFor(ids.length);
    const rows = Math.ceil(ids.length / cols);
    const cellW = Math.max(...items.map((it) => it.w)) + 14;
    const cellH = Math.max(...items.map((it) => it.h)) + 16;
    items.forEach((it, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const cx = (c - (cols - 1) / 2) * cellW;
      const cy = ((rows - 1) / 2 - r) * cellH;
      it.g.position.set(cx - it.cx, cy - it.cy, 0);
      it.g.updateMatrixWorld(true);
    });
  }

  function layoutPair(/** @type {string} */ a, /** @type {string} */ b) {
    layoutGrid([a, b]);
  }

  /* ---- visibility ---------------------------------------------------- */
  function applyMode() {
    /* Hide everything (groups + labels), park hidden trees offscreen so they cannot ghost-render. */
    for (const id of Object.keys(wordGroups)) {
      const g = wordGroups[id];
      setWordGroupVisible(g, false);
      g.position.set(1e6, 1e6, 0);
      g.updateMatrixWorld(true);
    }
    for (const line of bridges.children) {
      line.visible = false;
      line.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }

    if (mode === "word") {
      visibleIds = selectedWordId ? [selectedWordId] : [];
    } else if (mode === "morpheme") {
      visibleIds = selectedMorpheme ? wordIdsForMorphemeKey(selectedMorpheme) : [];
    } else {
      const ids = [];
      if (compareA) ids.push(compareA);
      if (compareB && compareB !== compareA) ids.push(compareB);
      visibleIds = ids;
    }

    for (const id of visibleIds) {
      if (wordGroups[id]) setWordGroupVisible(wordGroups[id], true);
    }

    if (visibleIds.length === 1) placeAtOriginCentered(wordGroups[visibleIds[0]]);
    else if (visibleIds.length >= 2) layoutGrid(visibleIds);

    /* Bridges: show only those with BOTH endpoints in visibleIds.
       Morpheme mode further restricts to the chosen morpheme key. */
    const visSet = new Set(visibleIds);
    for (const line of bridges.children) {
      const ud = line.userData;
      if (!visSet.has(ud.wordA) || !visSet.has(ud.wordB)) continue;
      if (mode === "morpheme" && ud.key !== selectedMorpheme) continue;
      line.visible = true;
    }

    frameToVisible();
    updateBridgeGeometry(bridges);
    updateLessonPanel();
    updateToolbarUi();
  }

  /* ---- lesson panel -------------------------------------------------- */
  function updateLessonPanel() {
    if (!lessonHtmlTarget || !detailEl) return;
    detailEl.classList.add("morph-detail--word-focus");
    if (mode === "word" && selectedWordId) {
      const w = WORDS.find((x) => x.id === selectedWordId);
      if (w) lessonHtmlTarget.innerHTML = renderMorphLessonHtml(w, morphemeRegistry);
    } else if (mode === "morpheme" && selectedMorpheme) {
      lessonHtmlTarget.innerHTML = morphemePrimerHtml(selectedMorpheme, wordIdsForMorphemeKey(selectedMorpheme));
    } else if (mode === "compare" && compareA && compareB && compareA !== compareB) {
      const wa = WORDS.find((x) => x.id === compareA);
      const wb = WORDS.find((x) => x.id === compareB);
      if (wa && wb) lessonHtmlTarget.innerHTML = renderMorphDualLessonHtml(wa, wb, morphemeRegistry);
    } else {
      lessonHtmlTarget.innerHTML = `<p class="morph-lesson__lead">Pick a word, morpheme, or pair to load its lesson.</p>`;
    }
  }

  /* Lesson body delegates clicks for word picks (works for both morpheme primer and dual compare). */
  lessonHtmlTarget?.addEventListener("click", (ev) => {
    const t = /** @type {HTMLElement | null} */ (ev.target instanceof HTMLElement ? ev.target : null);
    if (!t) return;

    const wordBtn = t.closest?.("[data-morph-pick-word]");
    if (wordBtn instanceof HTMLElement) {
      const id = wordBtn.getAttribute("data-morph-pick-word");
      if (id && WORDS.some((w) => w.id === id)) {
        selectedWordId = id;
        if (wordSelect) wordSelect.value = id;
        setMode("word");
      }
      return;
    }

    /* "Compare with" buttons in the morpheme primer jump to that morpheme's lesson. */
    const keyBtn = t.closest?.("[data-morph-pick-key]");
    if (keyBtn instanceof HTMLElement) {
      const k = keyBtn.getAttribute("data-morph-pick-key");
      if (k) {
        selectedMorpheme = k;
        if (morphSelect) morphSelect.value = `${MORPH_SELECT_PREFIX}${encodeURIComponent(k)}`;
        setMode("morpheme");
      }
    }
  });

  /* ---- toolbar UI sync ----------------------------------------------- */
  function setRowVisible(el, visible) {
    if (!el) return;
    el.toggleAttribute("hidden", !visible);
    el.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function updateToolbarUi() {
    [btnWord, btnMorph, btnCompare].forEach((b, i) => {
      if (!b) return;
      const targetMode = ["word", "morpheme", "compare"][i];
      const active = mode === targetMode;
      b.classList.toggle("morph-mode-btn--active", active);
      b.setAttribute("aria-pressed", active.toString());
    });
    setRowVisible(pickWordRow, mode === "word");
    setRowVisible(pickMorphRow, mode === "morpheme");
    setRowVisible(pickCompareRow, mode === "compare");
  }

  function setMode(m) {
    mode = m;
    /* Auto-fix compare conflict so we always have two distinct words */
    if (mode === "compare" && compareA && compareA === compareB) {
      const alt = WORDS.find((w) => w.id !== compareA);
      if (alt) {
        compareB = alt.id;
        if (compareBSel) compareBSel.value = compareB;
      }
    }
    /* If morpheme has 0 visible bank words, fall back */
    if (mode === "morpheme" && (!selectedMorpheme || wordIdsForMorphemeKey(selectedMorpheme).length === 0)) {
      const fallback = allMorphemeKeysInBank().find((k) => wordIdsForMorphemeKey(k).length >= 1);
      selectedMorpheme = fallback ?? null;
      if (morphSelect && selectedMorpheme) morphSelect.value = `${MORPH_SELECT_PREFIX}${encodeURIComponent(selectedMorpheme)}`;
    }
    applyMode();
  }

  btnWord?.addEventListener("click", () => setMode("word"));
  btnMorph?.addEventListener("click", () => setMode("morpheme"));
  btnCompare?.addEventListener("click", () => setMode("compare"));

  wordSelect?.addEventListener("change", () => {
    selectedWordId = wordSelect.value || null;
    if (mode === "word") applyMode();
    else setMode("word");
  });
  morphSelect?.addEventListener("change", () => {
    const v = morphSelect.value || "";
    if (v.startsWith(MORPH_SELECT_PREFIX)) {
      try {
        selectedMorpheme = decodeURIComponent(v.slice(MORPH_SELECT_PREFIX.length));
      } catch {
        selectedMorpheme = null;
      }
    } else {
      selectedMorpheme = null;
    }
    if (mode === "morpheme") applyMode();
    else setMode("morpheme");
  });
  compareASel?.addEventListener("change", () => {
    compareA = compareASel.value || null;
    if (compareA && compareA === compareB && WORDS.length > 1) {
      const alt = WORDS.find((w) => w.id !== compareA);
      if (alt) {
        compareB = alt.id;
        if (compareBSel) compareBSel.value = compareB;
      }
    }
    if (mode === "compare") applyMode();
    else setMode("compare");
  });
  compareBSel?.addEventListener("change", () => {
    compareB = compareBSel.value || null;
    if (compareB && compareA === compareB && WORDS.length > 1) {
      const alt = WORDS.find((w) => w.id !== compareB);
      if (alt) {
        compareA = alt.id;
        if (compareASel) compareASel.value = compareA;
      }
    }
    if (mode === "compare") applyMode();
    else setMode("compare");
  });

  /* ---- hover tooltip ------------------------------------------------- */
  const tooltip = document.createElement("div");
  tooltip.className = "morph-node-tooltip morph-node-tooltip--hidden";
  tooltip.setAttribute("role", "tooltip");
  document.body.appendChild(tooltip);

  function hideTooltip() {
    tooltip.classList.add("morph-node-tooltip--hidden");
    tooltip.innerHTML = "";
  }

  function showTooltip(mesh, x, y) {
    const t = mesh.userData.tooltip;
    if (!t) return hideTooltip();
    tooltip.innerHTML = `<div class="morph-node-tooltip__inner">
      <div class="morph-node-tooltip__pos">${escapeHtml(t.category)}</div>
      <div class="morph-node-tooltip__text" translate="no">${escapeHtml(t.morpheme)}</div>
      ${t.gloss ? `<div class="morph-node-tooltip__gloss">${escapeHtml(t.gloss)}</div>` : ""}
      <div class="morph-node-tooltip__word">in <em>${escapeHtml(t.wordLabel)}</em></div>
    </div>`;
    tooltip.classList.remove("morph-node-tooltip--hidden");
    const pad = 12;
    const w = tooltip.offsetWidth || 220;
    const h = tooltip.offsetHeight || 80;
    let nx = x + pad;
    let ny = y + pad;
    if (nx + w > window.innerWidth - 4) nx = x - w - pad;
    if (ny + h > window.innerHeight - 4) ny = y - h - pad;
    tooltip.style.left = `${Math.max(4, nx)}px`;
    tooltip.style.top = `${Math.max(4, ny)}px`;
  }

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  if (raycaster.params.Line) raycaster.params.Line.threshold = 0.12;

  function pickMesh(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const candidates = [];
    for (const id of visibleIds) {
      const g = wordGroups[id];
      if (!g) continue;
      for (const m of g.userData.meshes) candidates.push(m);
    }
    const hits = raycaster.intersectObjects(candidates, false);
    return hits[0]?.object ?? null;
  }

  let hoverRaf = 0;
  let hoverX = 0;
  let hoverY = 0;
  renderer.domElement.addEventListener("pointermove", (ev) => {
    hoverX = ev.clientX;
    hoverY = ev.clientY;
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const m = pickMesh(hoverX, hoverY);
      renderer.domElement.style.cursor = m ? "pointer" : "";
      if (m) showTooltip(m, hoverX, hoverY);
      else hideTooltip();
    });
  });
  renderer.domElement.addEventListener("pointerleave", hideTooltip);

  /* Click a sphere → if it carries a morphemeKey, switch to Morpheme mode for that key.
     Otherwise (or for apex/lex of a compare word), do nothing fancy — single-tree picks
     happen via the lesson "Open in Word mode" links. */
  renderer.domElement.addEventListener("click", (ev) => {
    const m = pickMesh(ev.clientX, ev.clientY);
    if (!m) return;
    const key = m.userData.morphemeKey;
    if (key && wordIdsForMorphemeKey(key).length >= 2) {
      selectedMorpheme = key;
      if (morphSelect) morphSelect.value = `${MORPH_SELECT_PREFIX}${encodeURIComponent(key)}`;
      setMode("morpheme");
      return;
    }
    /* Apex sphere or single-occurrence morpheme — open the word in Word mode. */
    const wid = m.userData.wordId;
    if (wid) {
      selectedWordId = wid;
      if (wordSelect) wordSelect.value = wid;
      setMode("word");
    }
  });

  /* ---- keyboard ----------------------------------------------------- */
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLTextAreaElement) return;
    if (ev.key === "f" || ev.key === "F" || ev.key === "r" || ev.key === "R") {
      ev.preventDefault();
      applyMode();
    } else if (ev.key === "Escape") {
      if (morphTutorialCtl?.isOpen()) {
        ev.preventDefault();
        morphTutorialCtl.close();
      } else if (helpEl && !helpEl.classList.contains("morph-help--hidden")) {
        helpEl.classList.add("morph-help--hidden");
      }
    } else if (ev.key === "1") setMode("word");
    else if (ev.key === "2") setMode("morpheme");
    else if (ev.key === "3") setMode("compare");
  });

  /* Double-click anywhere on the canvas: refit. */
  renderer.domElement.addEventListener("dblclick", () => frameToVisible());

  /* ---- fullscreen ---------------------------------------------------- */
  function isFullscreen() {
    return !!(document.fullscreenElement || /** @type {any} */ (document).webkitFullscreenElement);
  }
  function setFsLabel() {
    if (!fsBtn) return;
    fsBtn.setAttribute("aria-pressed", isFullscreen().toString());
    fsBtn.title = isFullscreen() ? "Exit full screen" : "Full screen";
  }

  /* Save where #morph-detail lived in the DOM so we can restore it on fullscreen exit. */
  const detailHomeParent = detailEl?.parentElement ?? null;
  const detailHomeNext = detailEl?.nextElementSibling ?? null;

  /* Dock the lesson as a sibling of the canvas host so the shell becomes a 2-column grid:
     [ viewer | lesson ] with the toolbar panel spanning the bottom. */
  function dockDetailIntoShell() {
    if (!detailEl || !shellEl) return;
    if (detailEl.parentElement === shellEl) return;
    shellEl.appendChild(detailEl);
    detailEl.classList.add("morph-detail--viewer-dock");
  }
  function restoreDetailHome() {
    if (!detailEl) return;
    detailEl.classList.remove("morph-detail--viewer-dock");
    if (!detailHomeParent) return;
    if (detailEl.parentElement === detailHomeParent) return;
    if (detailHomeNext && detailHomeNext.parentElement === detailHomeParent) {
      detailHomeParent.insertBefore(detailEl, detailHomeNext);
    } else {
      detailHomeParent.appendChild(detailEl);
    }
  }

  fsBtn?.addEventListener("click", () => {
    const target = shellEl || host;
    if (!target) return;
    if (isFullscreen()) {
      const exit = document.exitFullscreen?.bind(document) ?? /** @type {any} */ (document).webkitExitFullscreen?.bind(document);
      exit?.();
    } else {
      const req = target.requestFullscreen?.bind(target) ?? /** @type {any} */ (target).webkitRequestFullscreen?.bind(target);
      req?.();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    setFsLabel();
    if (isFullscreen()) dockDetailIntoShell();
    else restoreDetailHome();
    setTimeout(resizeCanvasToHost, 60);
  });

  /* ---- help modal --------------------------------------------------- */
  helpBtn?.addEventListener("click", () => helpEl?.classList.toggle("morph-help--hidden"));
  helpEl?.querySelector(".morph-help__close")?.addEventListener("click", () => helpEl.classList.add("morph-help--hidden"));
  helpEl?.querySelector(".morph-help__backdrop")?.addEventListener("click", () => helpEl.classList.add("morph-help--hidden"));

  morphTutorialCtl = installMorphTutorial({ shellEl, helpEl });
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("tour") === "1" || q.get("tutorial") === "1") {
      requestAnimationFrame(() => morphTutorialCtl?.open());
    }
  } catch {
    /* ignore */
  }

  /* ---- lesson zoom -------------------------------------------------- */
  installLessonZoom(detailEl, shellEl);

  /* ---- morpheme chart ----------------------------------------------- */
  installMorphemeChart((id) => {
    selectedWordId = id;
    if (wordSelect) wordSelect.value = id;
    setMode("word");
    detailEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, (key) => {
    selectedMorpheme = key;
    if (morphSelect) morphSelect.value = `${MORPH_SELECT_PREFIX}${encodeURIComponent(key)}`;
    setMode("morpheme");
    detailEl?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  /* ---- resize ------------------------------------------------------- */
  function resizeCanvasToHost() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w <= 0 || h <= 0) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    frameToVisible();
  }
  window.addEventListener("resize", resizeCanvasToHost);
  if (typeof ResizeObserver !== "undefined") new ResizeObserver(resizeCanvasToHost).observe(host);

  /* ---- initial render ----------------------------------------------- */
  setFsLabel();
  setMode("word");

  /* ---- animate ------------------------------------------------------ */
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    /* Update bridge geometry only when there is at least one visible bridge. */
    let anyBridge = false;
    for (const line of bridges.children) {
      if (line.visible) {
        anyBridge = true;
        break;
      }
    }
    if (anyBridge) updateBridgeGeometry(bridges);
    /* Tree internal lines are static (children don't move post-build). */
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  animate();
}

/* ----------------------------------------------------------------------- */
/*  Mini-lesson text size                                                  */
/* ----------------------------------------------------------------------- */

function installLessonZoom(detailEl, shellEl) {
  if (!detailEl) return;
  const KEY = "morphLessonTextZoom";
  const MIN = 0.72;
  const MAX = 1.65;
  const STEP = 1.09;
  function read() {
    try {
      const s = localStorage.getItem(KEY);
      if (s == null) return 1;
      const n = parseFloat(s);
      return Number.isFinite(n) ? Math.max(MIN, Math.min(MAX, n)) : 1;
    } catch {
      return 1;
    }
  }
  let zoom = read();
  function apply(z) {
    zoom = Math.max(MIN, Math.min(MAX, z));
    detailEl.style.setProperty("--morph-lesson-zoom", String(zoom));
    try {
      localStorage.setItem(KEY, String(zoom));
    } catch {
      /* ignore */
    }
    sync();
  }
  function bump(f) {
    apply(zoom * f);
  }
  function sync() {
    const eps = 0.004;
    const atMin = zoom <= MIN + eps;
    const atMax = zoom >= MAX - eps;
    const near1 = Math.abs(zoom - 1) < 0.02;
    /** @param {string} id @param {"smaller"|"larger"|"reset"} kind */
    function btn(id, kind) {
      const el = document.getElementById(id);
      if (!(el instanceof HTMLButtonElement)) return;
      if (kind === "smaller") el.disabled = atMin;
      else if (kind === "larger") el.disabled = atMax;
      else el.disabled = near1;
    }
    btn("morph-lesson-text-smaller", "smaller");
    btn("morph-lesson-text-larger", "larger");
    btn("morph-lesson-text-reset", "reset");
    shellEl?.querySelectorAll("[data-morph-lesson-zoom]").forEach((node) => {
      if (!(node instanceof HTMLButtonElement)) return;
      const m = node.getAttribute("data-morph-lesson-zoom");
      if (m === "smaller") node.disabled = atMin;
      else if (m === "larger") node.disabled = atMax;
      else if (m === "reset") node.disabled = near1;
    });
  }
  document.getElementById("morph-lesson-text-smaller")?.addEventListener("click", () => bump(1 / STEP));
  document.getElementById("morph-lesson-text-larger")?.addEventListener("click", () => bump(STEP));
  document.getElementById("morph-lesson-text-reset")?.addEventListener("click", () => apply(1));
  shellEl?.querySelectorAll("[data-morph-lesson-zoom]").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const m = node.getAttribute("data-morph-lesson-zoom");
    node.addEventListener("click", () => {
      if (m === "smaller") bump(1 / STEP);
      else if (m === "larger") bump(STEP);
      else if (m === "reset") apply(1);
    });
  });
  window.addEventListener("keydown", (ev) => {
    if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement || ev.target instanceof HTMLTextAreaElement) return;
    if (ev.key === "[") bump(1 / STEP);
    else if (ev.key === "]") bump(STEP);
    else if (ev.altKey && (ev.key === "0" || ev.code === "Digit0" || ev.code === "Numpad0")) apply(1);
  });
  apply(zoom);
}

/* ----------------------------------------------------------------------- */
/*  Morpheme chart                                                         */
/* ----------------------------------------------------------------------- */

function installMorphemeChart(onPickWord, onPickKey) {
  const mount = /** @type {HTMLElement | null} */ (document.getElementById("morph-morpheme-chart"));
  if (!mount) return;

  /** @type {Map<string, { ids: string[] }>} */
  const keyToWords = new Map();
  for (const w of WORDS) {
    const ks = new Set();
    collectMorphemeKeys(w.tree, ks);
    for (const k of ks) {
      if (!keyToWords.has(k)) keyToWords.set(k, { ids: [] });
      keyToWords.get(k).ids.push(w.id);
    }
  }

  const rows = MORPHEME_CATALOG.map((r) => {
    const ids = [...new Set(keyToWords.get(r.key)?.ids ?? [])];
    const buttons = ids
      .map((id) => WORDS.find((w) => w.id === id))
      .filter(Boolean)
      .map((w) => `<li><button class="morph-chart__word" data-morph-pick-word="${escapeHtml(w.id)}">${escapeHtml(w.label)}</button></li>`)
      .join("");
    const wikt = r.wiktionary || r.morpheme;
    const wiktUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(wikt)}`;
    const typeLabel = morphemeTypeLabel(r.key, r.type);
    const typeSlug = morphemeTypeSlug(typeLabel);
    return `<tr>
      <td><button class="morph-chart__morpheme" data-morph-pick-key="${escapeHtml(r.key)}">${escapeHtml(r.morpheme)}</button></td>
      <td><span class="morph-chart__type morph-chart__type--${escapeHtml(typeSlug)}">${escapeHtml(typeLabel)}</span></td>
      <td>${escapeHtml(r.origin)}</td>
      <td>${escapeHtml(r.meaning)}</td>
      <td>${buttons ? `<ul class="morph-chart__words">${buttons}</ul>` : `<span class="morph-chart__muted">—</span>`}</td>
      <td>${r.outsideExamples?.length ? r.outsideExamples.map(escapeHtml).join(", ") : "—"}</td>
      <td><a class="morph-chart__wikt" href="${escapeHtml(wiktUrl)}" target="_blank" rel="noreferrer noopener">wikt:${escapeHtml(wikt)}</a></td>
    </tr>`;
  }).join("");

  mount.innerHTML = `<div class="morph-chart__wrap"><table class="morph-chart__table">
    <thead><tr><th>Morpheme</th><th>Type</th><th>Origin</th><th>Meaning</th><th>Words in this bank</th><th>Outside examples</th><th>Wiktionary</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  mount.addEventListener("click", (ev) => {
    const t = /** @type {HTMLElement | null} */ (ev.target instanceof HTMLElement ? ev.target : null);
    if (!t) return;
    const word = t.closest?.("[data-morph-pick-word]");
    if (word instanceof HTMLElement) {
      const id = word.getAttribute("data-morph-pick-word");
      if (id) onPickWord(id);
      return;
    }
    const morph = t.closest?.("[data-morph-pick-key]");
    if (morph instanceof HTMLElement) {
      const key = morph.getAttribute("data-morph-pick-key");
      if (key) onPickKey(key);
    }
  });
}

/* ----------------------------------------------------------------------- */
/*  Boot                                                                   */
/* ----------------------------------------------------------------------- */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

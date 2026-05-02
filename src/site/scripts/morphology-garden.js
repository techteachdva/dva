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

function morphemePrimerHtml(key, linkedWordIds) {
  const row = morphemeCatalogRow(key);
  const short = morphemeKeyShort(key);
  const labels = linkedWordIds
    .map((id) => WORDS.find((w) => w.id === id))
    .filter(Boolean)
    .map((w) => `<li><button class="morph-link-pick" data-morph-pick-word="${escapeHtml(w.id)}">${escapeHtml(w.label)}</button></li>`)
    .join("");

  const wikt = row?.wiktionary || row?.morpheme || short;
  const wiktUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(wikt)}`;
  const hint = AFFIX_ORIGIN_HINT[key];

  return `<div class="morph-lesson morph-lesson--single">
    <h3 class="morph-lesson__h">Morpheme: <em translate="no">${escapeHtml(row?.morpheme ?? short)}</em></h3>
    ${row ? `<p class="morph-lesson__lead"><strong>Origin:</strong> ${escapeHtml(row.origin)} · <strong>Meaning:</strong> ${escapeHtml(row.meaning)}</p>` : ""}
    ${hint ? `<p class="morph-lesson__lead">${hint}</p>` : ""}
    ${row?.outsideExamples?.length ? `<p class="morph-lesson__meta"><strong>More examples (outside this bank):</strong> ${row.outsideExamples.map(escapeHtml).join(", ")}</p>` : ""}
    <p class="morph-lesson__meta"><a class="morph-chart__wikt" href="${escapeHtml(wiktUrl)}" target="_blank" rel="noreferrer noopener">Open <code translate="no">${escapeHtml(wikt)}</code> on Wiktionary &nearr;</a></p>
    <section class="morph-lesson__sec"><h4>Words on the board (${linkedWordIds.length})</h4>
      ${labels ? `<ul class="morph-lesson__ul morph-lesson__ul--picks">${labels}</ul>` : `<p>No words in this bank tagged with this morpheme yet.</p>`}
      <p class="morph-lesson__meta">Click any word above to switch to <strong>Word</strong> mode and load its lesson.</p>
    </section>
  </div>`;
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

  /* ---- populate selectors ------------------------------------------- */
  function fillWordSelect(/** @type {HTMLSelectElement | null} */ sel) {
    if (!sel) return;
    sel.innerHTML = WORDS.map((w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.label)}</option>`).join("");
  }
  function fillMorphSelect(/** @type {HTMLSelectElement | null} */ sel) {
    if (!sel) return;
    const keys = allMorphemeKeysInBank();
    const opts = keys.map((k) => {
      const row = morphemeCatalogRow(k);
      const count = wordIdsForMorphemeKey(k).length;
      const lbl = row ? `${row.morpheme} — ${row.meaning} (${count})` : `${morphemeKeyShort(k)} (${count})`;
      const v = `${MORPH_SELECT_PREFIX}${encodeURIComponent(k)}`;
      return `<option value="${escapeHtml(v)}">${escapeHtml(lbl)}</option>`;
    });
    sel.innerHTML = opts.join("");
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
    const btn = t?.closest?.("[data-morph-pick-word]");
    if (btn instanceof HTMLElement) {
      const id = btn.getAttribute("data-morph-pick-word");
      if (id && WORDS.some((w) => w.id === id)) {
        selectedWordId = id;
        if (wordSelect) wordSelect.value = id;
        setMode("word");
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
      if (helpEl && !helpEl.classList.contains("morph-help--hidden")) {
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
    setTimeout(resizeCanvasToHost, 60);
  });

  /* ---- help modal --------------------------------------------------- */
  helpBtn?.addEventListener("click", () => helpEl?.classList.toggle("morph-help--hidden"));
  helpEl?.querySelector(".morph-help__close")?.addEventListener("click", () => helpEl.classList.add("morph-help--hidden"));
  helpEl?.querySelector(".morph-help__backdrop")?.addEventListener("click", () => helpEl.classList.add("morph-help--hidden"));

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
    return `<tr>
      <td><button class="morph-chart__morpheme" data-morph-pick-key="${escapeHtml(r.key)}">${escapeHtml(r.morpheme)}</button></td>
      <td>${escapeHtml(r.origin)}</td>
      <td>${escapeHtml(r.meaning)}</td>
      <td>${buttons ? `<ul class="morph-chart__words">${buttons}</ul>` : `<span class="morph-chart__muted">—</span>`}</td>
      <td>${r.outsideExamples?.length ? r.outsideExamples.map(escapeHtml).join(", ") : "—"}</td>
      <td><a class="morph-chart__wikt" href="${escapeHtml(wiktUrl)}" target="_blank" rel="noreferrer noopener">wikt:${escapeHtml(wikt)}</a></td>
    </tr>`;
  }).join("");

  mount.innerHTML = `<div class="morph-chart__wrap"><table class="morph-chart__table">
    <thead><tr><th>Morpheme</th><th>Origin</th><th>Meaning</th><th>Words in this bank</th><th>Outside examples</th><th>Wiktionary</th></tr></thead>
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

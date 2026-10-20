/**
 * CyberMorph's game loop and flow: places (the Hub, the four Rooms, Overclock Mode, the finale),
 * click-to-move and camera-relative keys, objects and what they do, room progress, the Rot meter,
 * the Secret Secretary Desk and the Lingo Room.
 *
 * Each Room is one big diorama split into zones by firewalls (see data/layout.js):
 *   zone 0  the mentor's lessons                → firewall G
 *   zone 1  Rotlings, the terminal, the chasm   → firewall F
 *   zone 2  LINK, the Unknown File, the core
 * (The Lingo Room has two zones: the classroom, then the computer lab.)
 */

import { $, el, shuffle, pick, wait, clamp, tween } from '../core/util.js';
import { THREE, R, debugStep, toScreen, initRenderer, fitRoom, zoomTo, zoomReset, snapCamera, setBackground, pickWorld, groundPoint, onUpdate, webglAvailable, setFollow, rotateView, zoomStep, resetView, viewYawGoal } from '../engine/renderer.js';
import { buildRoom } from '../engine/diorama.js';
import { STYLES, terminal, gate, port, linkNode, newWordConsole, core, compilerConsole, avatarBooth, arcadeCabinet, secretaryDesk, lexiconTree, morphProp, animateProp, treeBaseZone } from '../engine/props.js';
import { labelSprite } from '../engine/textures.js';
import { smartBoard, triangleDesks, printer3d, chromebookCart, createD20 } from '../engine/classroom.js';
import { createMorpher, createMentor, createRotling, createPickup } from '../engine/characters.js';
import { applySettings } from '../core/settings.js';
import { sfx, startMusic, unlockAudio, speak } from '../core/audio.js';
import * as store from '../core/save.js';
import { touch, dueIds } from '../core/mastery.js';
import * as session from '../core/session.js';
import { DISTRICTS, MAIN_ORDER, HUB_MAP, FINALE_POOLS, collectFakes } from '../data/world.js';
import { makeWave, makeFake, taughtBy, randomWord, allWords, isKnown } from './waves.js';
import { zoneOf, CORRIDOR, CHASM_COLS } from '../data/layout.js';
import { morph, MORPHEMES } from '../data/morphemes.js';
import { build } from '../compiler/wordsum.js';
import * as hud from '../ui/hud.js';
import { say, dialogueOpen } from '../ui/dialogue.js';
import * as screens from '../ui/screens.js';
import { panelOpen, openPanel } from '../panels/host.js';
import { openCompile } from '../panels/compile.js';
import { openDebug } from '../panels/debug.js';
import { openLink } from '../panels/link.js';
import { openNewWord } from '../panels/newword.js';
import { showLesson } from '../panels/lesson.js';
import { openDesk } from '../panels/desk.js';

const PARAMS = new URLSearchParams(location.search);
/** The teacher's link can set a session length (?mins=12) and a Google Form for exit-ticket codes (?form=…). */
const SESSION_MINS = Math.max(0, Math.min(60, parseInt(PARAMS.get('mins') || '0', 10) || 0));
const SESSION_FORM = /^https:\/\//.test(PARAMS.get('form') || '') ? PARAMS.get('form') : '';
const PRACTICE = (PARAMS.get('set') || '').split(',').map((s) => s.trim()).filter(Boolean).map((k) => (MORPHEMES[k] ? k : Object.values(MORPHEMES).find((m) => m.cat === k)?.id)).filter(Boolean);

const ARENA = (special) => [
  '##################',
  '#o..............o#',
  '#................#',
  '#....o......o....#',
  '#................#',
  `#@.......${special}.......#`,
  '#................#',
  '#....o......o....#',
  '#................#',
  '#o..............o#',
  special === 'C' ? '########H#########' : '##################',
];
const TIMED_MAP = ARENA('.');
const FINALE_MAP = ARENA('C');
const PORT_TARGET = { 1: 'anglo', 2: 'latin', 3: 'greek' };
const ROOM_PORT = { anglo: '1', latin: '2', greek: '3' };
const ORIGIN_COLOR = { anglo: 0xffb000, latin: 0xdfe8f5, greek: 0x38b6ff };
const MOVE_KEYS = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };

const G = {
  profile: null,
  place: 'title',
  room: null,
  player: null,
  mentor: null,
  rotlings: [],
  pickups: [],
  carried: [],
  props: [],
  rot: 0,
  rotSpawned: false,
  busy: false,
  pending: null,
  keys: [],
  timed: null,
  finale: null,
  tree: null,
  treeZone: null,
  titleSpin: false,
  t: 0,
};

// ── Boot ──────────────────────────────────────────────────────────

export async function boot() {
  applySettings();
  if (!webglAvailable()) {
    document.body.append(el('div', { class: 'screen' }, el('div', { class: 'sheet glass' }, el('h2', {}, 'CyberMorph needs WebGL 2'), el('p', {}, 'This browser could not start 3D graphics. Try Chrome on a Chromebook with hardware acceleration turned on (chrome://settings → System).'))));
    return;
  }
  // Canvas text (morpheme tiles, labels) needs Lexend loaded before it is drawn.
  try { await Promise.all(['400', '600', '800'].map((w) => document.fonts.load(`${w} 40px Lexend`))); } catch { /* fall back quietly */ }
  initRenderer($('stage'));
  onUpdate({ update });
  bindInput();
  $('btn-pause').addEventListener('click', () => openPause());
  $('btn-help').addEventListener('click', () => screens.howToScreen());
  bindCameraButtons();
  await showTitle();
  if (PARAMS.get('projector') === '1') projectorMode();
}

async function showTitle() {
  G.place = 'title';
  hud.showHud(false);
  await loadRoom(HUB_MAP, 'hub', { arrival: '@', noPlayer: true, makeObject: titleObject, flowers: true });
  G.room.setFlowers(40, 0.6);
  G.titleSpin = true;
  startMusic('hub');
  screens.titleScreen({
    onPlay: (p) => { store.setActive(p.id); playProfile(p); },
    onNew: () => newProfileFlow(),
  });
}

function titleObject(ch) {
  if (ch === 'L') { const t = lexiconTree(); t.scale.setScalar(1.6); G.tree = t; return { scenery: t }; }
  return null;
}

function newProfileFlow() {
  screens.avatarScreen({
    unlocked: [],
    onDone: (res) => {
      if (!res) { showTitle(); return; }
      const p = store.newProfile(res.name, res.avatar);
      startProfile(p, true);
    },
  });
}

/** Continue a save, unless this browser's timed session just ended (the teacher's cooldown). */
function playProfile(p) {
  const wait = SESSION_MINS ? session.cooldownLeft(p) : 0;
  if (!wait) { startProfile(p); return; }
  screens.sessionDoneScreen({
    profile: p,
    minutes: wait,
    onTicket: () => screens.exitTicketScreen({ profile: p, ticket: session.ticket(p), form: SESSION_FORM, onDone: () => showTitle() }),
    onBack: () => showTitle(),
  });
}

async function startProfile(p, fresh = false) {
  G.profile = p;
  session.beginSession(p, SESSION_MINS);
  G.sessionOver = false;
  G.titleSpin = false;
  unlockAudio();
  hud.showHud(true);
  hud.renderInventory(p);
  hud.renderLog(p);
  resetView();
  const place = p.place && DISTRICTS[p.place.id] ? p.place : { id: 'hub' };
  if (place.id === 'hub') await enterHub();
  else await enterRoom(place.id, '@');
  if (fresh) {
    await say('system', [
      `Welcome to the Lexinet, ${p.name}. You are a Morpher: a repair bot for words.`,
      'The Rot has broken our words into morphemes, the small parts that carry meaning. Rotlings made of nonsense are crawling everywhere.',
      'Click the floor to walk, or use W A S D. Click a machine or a person to use it. Q and E turn the camera, Z and X zoom.',
      'Start at the amber door labeled ANGLO-SAXON. It leads to the room where the oldest English lives.',
    ]);
  }
}

function projectorMode() {
  const all = Object.values(MORPHEMES).filter((m) => m.origin !== 'lingo').map((m) => m.id);
  document.documentElement.style.setProperty('--text-scale', '1.25');
  screens.closeAllScreens();
  const fake = { learned: all, mastery: {}, stats: { tasks: 0, firstTry: 0, compiled: 0, splits: 0, bits: 0 }, lexicon: [], madeUp: [], log: [] };
  G.busy = true;
  openCompile({ mode: 'free', profile: fake, title: 'PROJECTOR MODE · MORPH COMPILER' }).then(() => location.reload());
}

// ── Loading a room ────────────────────────────────────────────────

async function loadRoom(map, style, { arrival = '@', arrivalCell = null, noPlayer = false, makeObject = null, flowers = false, paint = [] } = {}) {
  const S = STYLES[style];
  $('fade').classList.add('on');
  await wait(G.room ? 220 : 120);
  if (G.room) {
    R.scene.remove(G.room.group);
    G.room.dispose();
  }
  G.rotlings.forEach((r) => R.scene.remove(r.entity.group));
  G.pickups.forEach((p) => R.scene.remove(p.entity.group));
  G.rotlings = [];
  G.pickups = [];
  G.props = [];
  G.mentor = null;
  G.tree = null;
  G.treeZone = null;
  G.die = null;
  if (G.player) R.scene.remove(G.player.entity.group);
  setBackground(S.bg);
  const room = buildRoom(map, style, { makeObject, flowers, paint });
  G.room = room;
  R.scene.add(room.group);
  fitRoom(room.W, room.H);
  zoomReset();
  const cell = arrivalCell || room.marks[arrival] || room.marks['@'] || { c: Math.floor(room.W / 2), r: Math.floor(room.H / 2) };
  if (!noPlayer) {
    if (!G.player) G.player = makePlayer();
    G.player.entity.setAvatar(G.profile.avatar);
    placePlayer(cell);
    R.scene.add(G.player.entity.group);
    setFollow(G.player.pos);
  } else setFollow(new THREE.Vector3());
  snapCamera();
  room.setCamera(R.camera.position);
  startMusic(S.music);
  $('fade').classList.remove('on');
  await room.animateIn(cell);
}

function makePlayer() {
  const entity = createMorpher(G.profile ? G.profile.avatar : { limbs: 'l-steel', torso: 't-red', head: 'h-steel', face: 'f-smile' });
  return { entity, c: 0, r: 0, path: [], pos: new THREE.Vector3(), stepT: 0 };
}

function placePlayer(cell) {
  const p = G.player;
  p.c = cell.c;
  p.r = cell.r;
  p.path = [];
  p.pos.copy(G.room.toWorld(cell.c, cell.r));
  p.entity.group.position.copy(p.pos);
}

const adjacent = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r) === 1;

// ── Input ─────────────────────────────────────────────────────────

function blocked() {
  return G.busy || panelOpen() || dialogueOpen() || screens.screenOpen() || G.place === 'title' || performance.now() < (R.swallowUntil || 0);
}

function bindInput() {
  R.renderer.domElement.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (blocked() || !G.room || !G.player) {
      G.lastIgnored = { busy: G.busy, panel: panelOpen(), dialogue: dialogueOpen(), screen: screens.screenOpen(), place: G.place };
      return;
    }
    const targets = [...G.room.objects.filter((o) => o.mesh && (o.use || o.info)).map((o) => o.mesh), ...G.rotlings.map((r) => r.entity.group)];
    const hits = pickWorld(e.clientX, e.clientY, targets);
    if (hits.length) {
      let n = hits[0].object;
      while (n && !n.userData.obj && !n.userData.rotling) n = n.parent;
      if (n && n.userData.rotling) { walkToUse({ rotling: n.userData.rotling }); return; }
      if (n && n.userData.obj) {
        const o = n.userData.obj;
        if (o.info) { showPropInfo(o); return; }
        if (o.instant) { o.use(); return; }
        walkToUse({ obj: o });
        return;
      }
    }
    const pt = groundPoint(e.clientX, e.clientY);
    if (!pt) return;
    const near = G.rotlings.find((r) => r.pos.distanceTo(pt) < 0.6);
    if (near) { walkToUse({ rotling: near }); return; }
    walkTo(G.room.toCell(pt), pt);
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (G.place === 'title' || panelOpen() || dialogueOpen() || screens.screenOpen()) return;
      e.preventDefault();
      openPause();
      return;
    }
    if (G.place === 'title' || !G.player) return;
    // Camera keys work whenever the world is visible.
    if (!panelOpen() && !screens.screenOpen()) {
      if (k === 'q' && !e.repeat) { cameraTurn(1); return; }
      if (k === 'e' && !e.repeat) { cameraTurn(-1); return; }
      if (k === 'z' && !e.repeat) { zoomStep(-1); hud.flashCamera('zoom-in'); return; }
      if (k === 'x' && !e.repeat) { zoomStep(1); hud.flashCamera('zoom-out'); return; }
      if (k === 'v' && !e.repeat) { resetView(); hud.flashCamera('view'); return; }
    }
    if (blocked()) return;
    if (k === 'h' && !e.repeat) { screens.howToScreen(); return; }
    if ((k === ' ' || k === 'enter') && !e.repeat) {
      const near = nearestInteractable();
      if (near) { e.preventDefault(); use(near); }
      return;
    }
    const dir = MOVE_KEYS[k];
    if (dir) {
      e.preventDefault();
      if (!G.keys.includes(dir)) G.keys.push(dir);
      if (!G.player.path.length) stepDir(screenToGrid(dir));
    }
  });
  window.addEventListener('keyup', (e) => {
    const dir = MOVE_KEYS[e.key.toLowerCase()];
    if (dir) G.keys = G.keys.filter((x) => x !== dir);
  });
  window.addEventListener('blur', () => { G.keys = []; });
}

function bindCameraButtons() {
  hud.onCamera((action) => {
    if (action === 'rotate-left') cameraTurn(1);
    else if (action === 'rotate-right') cameraTurn(-1);
    else if (action === 'zoom-in') zoomStep(-1);
    else if (action === 'zoom-out') zoomStep(1);
    else if (action === 'view') resetView();
  });
}

function cameraTurn(dir) {
  rotateView(dir);
  hud.flashCamera(dir > 0 ? 'rotate-left' : 'rotate-right');
}

/**
 * Map a screen direction to a grid step for the camera's current angle, so W always
 * walks "up the screen" however the view is turned. A tiny bias settles the 45° ties.
 */
function screenToGrid(dir) {
  const yaw = viewYawGoal() + 0.02;
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: -f.z, z: f.x };
  const want = { up: f, down: { x: -f.x, z: -f.z }, right, left: { x: -right.x, z: -right.z } }[dir];
  const options = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = options[0];
  let bestDot = -Infinity;
  for (const o of options) {
    const d = o[0] * want.x + o[1] * want.z;
    if (d > bestDot) { bestDot = d; best = o; }
  }
  return best;
}

function stepDir([dc, dr]) {
  const p = G.player;
  const n = { c: p.c + dc, r: p.r + dr };
  if (G.room.isWalkable(n.c, n.r)) { p.path = [n]; G.pending = null; }
  else {
    const obj = objectAt(n.c, n.r);
    if (obj && !obj.info) use({ obj });
  }
}

function objectAt(c, r) {
  return G.room.objects.find((x) => x.c === c && x.r === r && (x.use || x.info) && !x.walkable) || null;
}

/** Walk to a cell. A click on a blocked cell walks next to it; objects with a small click zone only open from that zone. */
function walkTo(cell, point = null) {
  const p = G.player;
  G.pending = null;
  if (!G.room.isWalkable(cell.c, cell.r)) {
    const o = objectAt(cell.c, cell.r);
    if (o && o.smallZone && point) {
      const centre = G.room.toWorld(o.c, o.r);
      if (Math.hypot(point.x - centre.x, point.z - centre.z) < o.smallZone) { walkToUse({ obj: o }); return; }
    } else if (o && !o.info) { walkToUse({ obj: o }); return; }
    const path = G.room.path({ c: p.c, r: p.r }, (c, r) => adjacent({ c, r }, cell));
    if (path) p.path = path;
    return;
  }
  const path = G.room.path({ c: p.c, r: p.r }, (c, r) => c === cell.c && r === cell.r);
  if (path) p.path = path;
}

function walkToUse(target) {
  const p = G.player;
  const tc = target.obj ? { c: target.obj.c, r: target.obj.r } : { c: target.rotling.c, r: target.rotling.r };
  if (target.obj && target.obj.walkable) { walkTo(tc); return; }
  if (adjacent(p, tc) || (p.c === tc.c && p.r === tc.r)) { use(target); return; }
  const path = G.room.path({ c: p.c, r: p.r }, (c, r) => adjacent({ c, r }, tc));
  if (!path) { hud.toast('Can\'t reach that from here yet.', 'warn'); return; }
  if (target.rotling) target.rotling.frozen = true;
  p.path = path;
  G.pending = target;
}

function nearestInteractable() {
  const p = G.player;
  const rot = G.rotlings.find((r) => adjacent(p, r) || (p.c === r.c && p.r === r.r));
  if (rot) return { rotling: rot };
  const obj = G.room.objects.find((o) => o.use && !o.walkable && adjacent(p, o));
  return obj ? { obj } : null;
}

async function use(target) {
  if (G.busy) return;
  G.pending = null;
  G.busy = true;
  hud.setContext(null);
  try {
    if (target.rotling) await (target.rotling.boss ? bossFight(target.rotling) : debugRotling(target.rotling));
    else if (target.obj && target.obj.use) {
      const o = target.obj;
      G.player.entity.group.rotation.y = Math.atan2(o.c - G.player.c, o.r - G.player.r);
      await o.use();
    }
  } catch (err) {
    console.error(err);
    hud.toast('Something glitched. Try again.', 'warn');
  } finally {
    G.busy = false;
    zoomReset();
    refreshObjective();
  }
}

/** Morpheme props: click one to hear and see how its name is built. */
function showPropInfo(o) {
  const p = o.prop;
  const parts = p.ids ? `${p.ids.map((id) => `${morph(id).text} (${morph(id).meaning})`).join(' + ')}` : p.note;
  hud.toast(`${p.word}: ${parts}`, 'gold');
  speak(p.word);
  sfx.click();
}

// ── Per-frame update ──────────────────────────────────────────────

function update(dt) {
  G.t += dt;
  if (G.titleSpin) R.rig.yawGoal += dt * 0.06;
  if (!G.room) return;
  G.room.setCamera(R.camera.position);
  G.room.update(dt);
  if (G.mentor) G.mentor.update(dt);
  G.pickups.forEach((p) => p.entity.update(dt));
  G.rotlings.forEach((r) => updateRotling(r, dt));
  G.props.forEach((o) => animateProp(o.mesh, G.t, dt));
  if (G.die) updateDie(dt);
  if (G.tree) G.tree.rotation.y += dt * 0.05;
  if (G.treeZone) G.treeZone.userData.pulse(G.t);
  if (!G.player) return;
  updatePlayer(dt);
  setFollow(G.player.pos);
  updatePropLabels();
  if (G.place === 'timed') updateTimed(dt);
  else updateRot(dt);
  if (!blocked()) updateContext();
}

function updatePlayer(dt) {
  const p = G.player;
  let moving = false;
  if (p.path.length) {
    const next = p.path[0];
    const target = G.room.toWorld(next.c, next.r);
    const d = target.clone().sub(p.pos);
    const dist = d.length();
    const speed = 4;
    if (dist < 0.02 || dist <= speed * dt) {
      p.pos.copy(target);
      p.c = next.c;
      p.r = next.r;
      p.path.shift();
      sfx.step();
      onEnterCell();
    } else {
      d.normalize();
      p.pos.addScaledVector(d, speed * dt);
      p.entity.group.rotation.y = Math.atan2(d.x, d.z);
    }
    moving = true;
  } else if (G.keys.length && !blocked()) {
    stepDir(screenToGrid(G.keys[G.keys.length - 1]));
  }
  p.entity.group.position.copy(p.pos);
  p.entity.update(dt, moving);
  if (!p.path.length && G.pending && !G.busy) {
    const t = G.pending;
    const tc = t.obj ? t.obj : t.rotling;
    if (adjacent(p, tc) || (p.c === tc.c && p.r === tc.r)) use(t);
    else if (t.rotling) walkToUse(t);
    else G.pending = null;
  }
}

function onEnterCell() {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    if (pk.c === p.c && pk.r === p.r) {
      R.scene.remove(pk.entity.group);
      G.pickups.splice(i, 1);
      G.carried.push(pk.id);
      sfx.pickup();
      hud.toast(`+ ${morph(pk.id).text}`, 'good');
      if (G.place === 'timed') G.timed.score += 15;
    }
  }
  const o = G.room.objects.find((x) => x.walkable && x.port && x.c === p.c && x.r === p.r);
  if (o && !G.busy) {
    p.path = [];
    G.busy = true;
    Promise.resolve(o.port()).finally(() => { G.busy = false; refreshObjective(); });
  }
}

function updateContext() {
  const near = nearestInteractable();
  if (!near) { hud.setContext(null); return; }
  const label = near.rotling ? 'DEBUG' : near.obj.label || 'USE';
  hud.setContext(label, () => use(near), 'SPACE');
}

/** Prop name tags appear when the Morpher walks close. */
function updatePropLabels() {
  const p = G.player;
  G.props.forEach((o) => {
    const near = Math.abs(o.c - p.c) + Math.abs(o.r - p.r) <= 3;
    o.tag.material.opacity += ((near ? 1 : 0) - o.tag.material.opacity) * 0.15;
    o.tag.visible = o.tag.material.opacity > 0.02;
  });
}

// ── Rotlings and pickups ──────────────────────────────────────────

function spawnRotling(item, cell, opts = {}) {
  const word = item.show || build(item.p).word;
  const entity = createRotling(word, { ...opts, golden: opts.golden || !!item.golden });
  const r = { item, entity, c: cell.c, r: cell.r, pos: G.room.toWorld(cell.c, cell.r), target: null, wait: Math.random() * 2, frozen: false, ...opts };
  entity.group.position.copy(r.pos);
  entity.group.traverse((n) => { n.userData.rotling = r; });
  R.scene.add(entity.group);
  G.rotlings.push(r);
  return r;
}

function roomZone(c) {
  const d = DISTRICTS[G.place];
  return d ? zoneOf(c, d.id !== 'lingo') : 0;
}

function updateRotling(r, dt) {
  r.entity.update(dt);
  if (r.boss) return;
  if (r.target) {
    const t = G.room.toWorld(r.target.c, r.target.r);
    const d = t.clone().sub(r.pos);
    if (d.length() < 0.03) { r.pos.copy(t); r.c = r.target.c; r.r = r.target.r; r.target = null; r.wait = 0.8 + Math.random() * 1.8; }
    else { d.normalize(); r.pos.addScaledVector(d, dt * 1.1); r.entity.group.rotation.y = Math.atan2(d.x, d.z); }
  } else if (!r.frozen && !G.busy) {
    r.wait -= dt;
    if (r.wait <= 0) {
      const home = roomZone(r.c);
      const options = G.room.neighbors(r.c, r.r).filter((n) => G.room.isWalkable(n.c, n.r) && !G.room.isPort(n.c, n.r)
        && roomZone(n.c) === home && G.room.cells[n.r][n.c] !== '~'
        && !(G.player && n.c === G.player.c && n.r === G.player.r) && !G.rotlings.some((o) => o !== r && o.c === n.c && o.r === n.r));
      if (options.length) r.target = pick(options);
      r.wait = 1 + Math.random() * 2;
    }
  }
  r.entity.group.position.copy(r.pos);
}

function removeRotling(r) {
  G.rotlings = G.rotlings.filter((x) => x !== r);
  const g = r.entity.group;
  tween(350, (k) => g.scale.setScalar(Math.max(0.001, 1 + k * 0.6 - k * k * 1.6)), () => R.scene.remove(g));
}

function dropPickups(ids, cell) {
  const spots = [cell, ...G.room.neighbors(cell.c, cell.r)].filter((n) => G.room.isWalkable(n.c, n.r) && !G.room.isPort(n.c, n.r));
  ids.forEach((id, i) => {
    const s = spots[i % spots.length] || cell;
    const entity = createPickup(id);
    entity.group.position.copy(G.room.toWorld(s.c, s.r));
    R.scene.add(entity.group);
    G.pickups.push({ id, c: s.c, r: s.r, entity });
  });
}

/** Banking: loose morphemes become safe (and count as review) when a task finishes. */
function bankCarried() {
  if (!G.carried.length || !G.profile) return;
  touch(G.profile, G.carried, true);
  G.profile.stats.bits += G.carried.length * 10;
  G.carried = [];
  store.save();
}

async function debugRotling(r) {
  r.frozen = true;
  zoomTo(r.pos.clone(), 0.55);
  const d = DISTRICTS[G.place];
  const realNote = G.place === 'lingo' ? 'Mr. Phil\'s rule: if people use it and understand it, it\'s a real word.' : null;
  const title = r.review ? 'REVIEW ROTLING · a morpheme you haven\'t used in a while'
    : r.item.golden ? 'GOLDEN ROTLING · a long word worth bonus bits'
      : r.ret ? 'ROT RETURN · a harder Rotling came back' : null;
  const res = await openDebug({ item: r.item, profile: G.profile, mode: 'rotling', realNote, title });
  r.frozen = false;
  if (G.place === 'timed') { timedResult(r, res); return; }
  if (!res.solved) {
    if (res.mistakes) { bumpBack(r); G.streak = 0; }
    return;
  }
  removeRotling(r);
  sfx.split();
  dropPickups(r.item.p.filter((id) => morph(id).type !== 'link'), { c: r.c, r: r.r });
  reward(r, res);
  if (r.review) { hud.toast('Review complete: morpheme restored', 'good'); return; }
  if (r.ret && !G.rotlings.some((x) => x.ret)) {
    G.profile.stats.bits += 40;
    store.save();
    hud.toast('Rot Return cleared! +40 bits', 'gold');
    refreshObjective();
    return;
  }
  if (d && r.index !== undefined) {
    const prog = store.dprog(G.profile, G.place);
    const list = prog.rotlings[1] || (prog.rotlings[1] = []);
    if (!list.includes(r.index)) list.push(r.index);
    G.rot = Math.max(0, G.rot - 18);
    store.save();
    if (!G.rotlings.some((x) => x.index !== undefined)) {
      hud.toast('Rotling zone clear!', 'good');
      prog.waveCleared = true;
      if (d.id === 'lingo') prog.done.rotlings1 = true;
      store.save();
    }
  }
}

/** Bonus bits: golden Rotlings, and a streak of clean first-try DEBUGs. */
function reward(r, res) {
  const st = G.profile.stats;
  if (r.item.golden) {
    st.bits += 50;
    hud.toast('GOLDEN ROTLING! +50 bits', 'gold');
  }
  G.streak = res.firstTry ? (G.streak || 0) + 1 : 0;
  if (G.streak >= 3) {
    const bonus = 5 * G.streak;
    st.bits += bonus;
    st.bestStreak = Math.max(st.bestStreak || 0, G.streak);
    if (!r.item.golden) hud.toast(`Clean streak ×${G.streak}! +${bonus} bits`, 'gold');
  }
  store.save();
}

function bumpBack(r) {
  const p = G.player;
  const away = G.room.neighbors(p.c, p.r).filter((n) => G.room.isWalkable(n.c, n.r) && !G.room.isPort(n.c, n.r)).sort((a, b) => (Math.hypot(b.c - r.c, b.r - r.r) - Math.hypot(a.c - r.c, a.r - r.r)));
  if (away.length) { p.path = [away[0]]; hud.toast('The Rotling shoves you back a step.', 'warn'); }
}

// ── The Rot meter ─────────────────────────────────────────────────

function updateRot(dt) {
  const d = DISTRICTS[G.place];
  const live = G.rotlings.filter((r) => !r.review).length;
  const inZone = !!(d && G.player && roomZone(G.player.c) === 1);
  const visible = !!(d && d.rotMeter && (live > 0 || G.rot > 0) && inZone);
  hud.setRot(visible, G.rot, G.carried.length);
  if (!visible || blocked()) return;
  G.rot = clamp(G.rot + dt * 0.33 * live, 0, 100);
  if (G.rot > 50 && !G.rotSpawned) {
    G.rotSpawned = true;
    const w = randomWord(new Set(G.profile.learned), G.place);
    const free = shuffle(G.room.find('.')).find((c) => roomZone(c.c) === 1 && (G.place === 'lingo' || c.c < CHASM_COLS[0]) && G.room.isWalkable(c.c, c.r) && !G.rotlings.some((o) => o.c === c.c && o.r === c.r));
    if (w && free) {
      spawnRotling({ p: w.ids }, free);
      sfx.rot();
      hud.toast('The Rot spreads! A new Rotling crawled in.', 'warn');
    }
  }
  if (G.rot >= 100) crash();
}

async function crash() {
  G.busy = true;
  sfx.crash();
  const fx = $('crash-fx');
  fx.classList.remove('on');
  void fx.offsetWidth;
  fx.classList.add('on');
  hud.toast('SYSTEM CRASH. Rebooting at the firewall…', 'warn');
  const spot = { c: G.player.c, r: G.player.r };
  if (G.carried.length) { dropPickups(G.carried, spot); G.carried = []; }
  G.profile.stats.crashes += 1;
  store.save();
  await wait(900);
  placePlayer(G.room.marks['&'] || G.room.marks['@']);
  G.rot = 30;
  G.busy = false;
  hud.toast('Your loose morphemes are where you crashed. Go get them.', 'gold');
}

// ── HUD helpers ───────────────────────────────────────────────────

function refreshObjective() {
  if (!G.profile || !G.room) return;
  hud.renderInventory(G.profile);
  hud.renderLog(G.profile);
  if (G.tree) G.tree.userData.setLeaves(G.profile.lexicon.length, leafOrigin);
  if (G.place === 'hub') G.room.setFlowers(6 + G.profile.lexicon.length, Math.min(1, G.profile.milestones.length / 6));
  hud.setObjective(objectiveText());
}

function leafOrigin(i) {
  const w = G.profile.lexicon[i];
  if (!w) return 4;
  const base = w.p.find((id) => MORPHEMES[id] && morph(id).type === 'base') || w.p[0];
  return { anglo: 0, latin: 1, greek: 2, lingo: 3 }[MORPHEMES[base] ? morph(base).origin : 'lingo'] ?? 4;
}

function objectiveText() {
  const p = G.profile;
  if (G.place === 'hub') {
    const next = MAIN_ORDER.find((d) => !(p.districts[d] && p.districts[d].cleared));
    const reviews = G.rotlings.filter((r) => r.review).length;
    if (reviews) return `${reviews} review Rotling${reviews > 1 ? 's' : ''} in the Hub: DEBUG them to restore fading morphemes.`;
    if (next) {
      const where = { anglo: 'the amber door labeled ANGLO-SAXON', latin: 'the grey door labeled LATIN', greek: 'the blue door labeled GREEK' }[next];
      const deskHint = p.clues.some(Boolean) && !p.deskOpen ? ' Your clue cards open something on the Secret Secretary Desk.' : '';
      return `Enter ${DISTRICTS[next].name} through ${where}.${deskHint}`;
    }
    if (!p.finale.beaten) return `All three keywords are yours. ${p.deskOpen ? '' : 'Try the Secret Secretary Desk, then '}Face the Rot through the green door labeled THE ROT.`;
    return p.deskOpen ? 'The Lexinet is restored. Try Overclock Mode, or build Made-up Words at the Morph Compiler.' : 'The Lexinet is restored. The Secret Secretary Desk is still locked…';
  }
  if (G.place === 'timed') return 'DEBUG as many Rotlings as you can before time runs out.';
  if (G.place === 'finale') return 'Click the Rot. Split its word, then compile it back clean.';
  const d = DISTRICTS[G.place];
  if (!d) return '';
  const prog = store.dprog(p, d.id);
  const done = prog.done;
  const last = d.rooms.length - 1;
  const back = G.rotlings.filter((x) => x.ret).length;
  if (prog.cleared && back) return `Rot Return: ${back} harder Rotling${back > 1 ? 's' : ''} came back. DEBUG them for bonus bits, or take the HUB door.`;
  if (prog.cleared) return 'Room clear! Take the HUB door back.';
  if (!done.mentor) return `Talk to ${d.mentor.name}.`;
  if (!done.gate0) return 'Click the glowing firewall to unlock it.';
  const live = G.rotlings.filter((x) => x.index !== undefined).length;
  if (live) return `DEBUG the Rotlings: ${live} left. Click one to start.`;
  if (d.rooms[1].terminal && !done.terminal1) return 'Use the terminal to build the bridge.';
  if (d.rooms[1].gate && !done.gate1) return 'Cross the bridge and unlock the second firewall.';
  if (!done[`link${last}`]) return 'Use the LINK node.';
  if (!done[`newword${last}`]) return 'Open the UNKNOWN FILE console.';
  return d.id === 'lingo' ? 'Finish the lesson at the Smart Board core.' : 'Restore the room core.';
}

// ── The Hub ───────────────────────────────────────────────────────

const cleared = (id) => !!(G.profile.districts[id] && G.profile.districts[id].cleared);
const portOpen = (id) => id === 'anglo' || cleared(MAIN_ORDER[MAIN_ORDER.indexOf(id) - 1]);

async function enterHub(fromPort = null) {
  G.place = 'hub';
  G.profile.place = { id: 'hub' };
  store.save();
  let arrivalCell = null;
  if (fromPort) {
    const H = HUB_MAP.length;
    const W = HUB_MAP[0].length;
    HUB_MAP.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== fromPort) return;
      arrivalCell = { c: c === 0 ? 1 : c === W - 1 ? W - 2 : c, r: r === 0 ? 1 : r === H - 1 ? H - 2 : r };
      if ('DOAX'.includes(fromPort)) arrivalCell = { c, r: r + 1 };
    }));
  }
  await loadRoom(HUB_MAP, 'hub', { arrivalCell, makeObject: hubObject, flowers: true });
  hud.setPlace('THE HUB');
  G.carried = [];
  spawnReviews();
  refreshObjective();
  if (fromPort && fromPort !== 'O') await showPatchNotes();
}

/** End-of-shift patch notes: a changelog for the Lexinet built from the words the player just compiled. */
async function showPatchNotes() {
  const p = G.profile;
  const patch = p.patch || (p.patch = { n: 0, at: 0 });
  const fresh = p.log.filter((e) => e.t > patch.at).reverse();
  if (!fresh.length) return;
  patch.n += 1;
  patch.at = Date.now();
  store.save();
  const words = [...new Set(fresh.map((e) => e.w))];
  const list = (ws) => (ws.length === 1 ? ws[0] : `${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}`);
  const panel = openPanel({ dim: 0.6 });
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'INSTALL PATCH ✔');
  panel.root.append(el('section', { class: 'glass lesson' },
    el('div', { class: 'kicker' }, `LEXINET PATCH NOTES · v1.${patch.n}`),
    el('h2', {}, `Patch 1.${patch.n}: ${p.name} restored ${list(words.slice(0, 4))}${words.length > 4 ? `, plus ${words.length - 4} more` : ''}.`),
    el('ul', { class: 'insp-list' }, fresh.slice(0, 10).map((e) => el('li', {}, el('b', {}, e.w), `: ${e.p.map((id) => morph(id).text).join(' + ')}`))),
    el('p', {}, `Known issues: the Rot. Words on your Lexicon Tree: ${p.lexicon.length}.`),
    el('div', { class: 'lesson-foot' }, el('span'), done)));
  sfx.unlock();
  await new Promise((res) => {
    const close = () => { panel.close(); res(); };
    done.addEventListener('click', close);
    panel.onKey((e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); close(); } });
    done.focus();
  });
}

function hubObject(ch, c, r) {
  const edgeAxis = r === 0 || r === HUB_MAP.length - 1 ? 'z' : 'x';
  if (PORT_TARGET[ch]) {
    const id = PORT_TARGET[ch];
    const open = portOpen(id);
    const mesh = port('hub', { color: ORIGIN_COLOR[id], label: open ? DISTRICTS[id].short.toUpperCase() : 'LOCKED', locked: !open, axis: edgeAxis });
    if (!open) return { mesh, label: 'LOCKED', use: async () => { sfx.bad(); hud.toast(`Clear ${DISTRICTS[MAIN_ORDER[MAIN_ORDER.indexOf(id) - 1]].name} first.`, 'warn'); } };
    return { mesh, walkable: true, port: () => enterRoom(id, '@') };
  }
  if (ch === '4') {
    const open = MAIN_ORDER.every(cleared);
    const mesh = port('rot', { color: 0x7dff3a, label: open ? 'THE ROT' : 'SEALED', locked: !open, axis: edgeAxis });
    if (!open) return { mesh, label: 'SEALED', use: async () => { sfx.bad(); hud.toast('Sealed. Clear all three rooms to face the Rot.', 'warn'); } };
    return { mesh, walkable: true, port: () => startFinale() };
  }
  if (ch === 'L') {
    // The tree itself never takes clicks: only the small glowing ring at its base does.
    const tree = lexiconTree();
    tree.scale.setScalar(1.6);
    G.tree = tree;
    const zone = treeBaseZone();
    G.treeZone = zone;
    return { mesh: zone, scenery: tree, label: 'VIEW TREE', smallZone: 0.45, use: () => screens.lexiconPanel(G.profile) };
  }
  if (ch === 'D') return { mesh: secretaryDesk(), label: 'OPEN', use: () => useDesk() };
  if (ch === 'A') return { mesh: avatarBooth('hub'), label: 'CUSTOMIZE', use: () => customize() };
  if (ch === 'O') {
    const open = G.profile.milestones.includes('anglo');
    const mesh = arcadeCabinet('OVERCLOCK', 0xff3df0, !open);
    return { mesh, label: open ? 'PLAY' : 'LOCKED', use: async () => { if (!open) { sfx.bad(); hud.toast('Overclock Mode unlocks when you clear the Anglo-Saxon Room.', 'warn'); return; } await startTimed(); } };
  }
  if (ch === 'X') {
    return { mesh: compilerConsole('hub'), label: 'COMPILE', use: async () => {
      if (!G.profile.learned.some((id) => morph(id).type === 'base')) { hud.toast('Learn some morphemes from Old Wynn first.', 'warn'); return; }
      zoomTo(G.room.toWorld(c, r), 0.6);
      await openCompile({ mode: 'free', profile: G.profile, onMadeUp: (w) => hud.toast(`Made-up Word saved: ${w}`, 'gold') });
    } };
  }
  return null;
}

function spawnReviews() {
  const due = dueIds(G.profile).filter((id) => morph(id).origin !== 'lingo');
  const focus = PRACTICE.length ? due.filter((id) => PRACTICE.includes(id)) : due;
  if (!focus.length) return;
  const learned = new Set(G.profile.learned);
  const words = allWords().filter((w) => w.ids.some((id) => focus.includes(id)) && isKnown(w.ids, learned));
  const picks = shuffle(words).slice(0, 3);
  const spots = shuffle(G.room.find('.').filter((c) => G.room.isWalkable(c.c, c.r)));
  // The third review may be a Rot fake, so the Hub still asks "real or Rot?".
  picks.forEach((w, i) => { if (spots[i]) spawnRotling((i === 2 && makeFake(w)) || { p: w.ids }, spots[i], { review: true }); });
  if (picks.length) hud.toast(`${picks.length} morpheme${picks.length > 1 ? 's are' : ' is'} fading. Review Rotlings appeared in the Hub.`, 'gold');
}

async function customize() {
  await new Promise((res) => {
    hud.showHud(false);
    screens.avatarScreen({ profile: G.profile, unlocked: G.profile.milestones, onDone: (r) => {
      if (r) { G.profile.avatar = r.avatar; store.save(); G.player.entity.setAvatar(r.avatar); }
      hud.showHud(true);
      res();
    } });
  });
}

async function useDesk() {
  const d = G.room.objects.find((o) => o.ch === 'D');
  zoomTo(G.room.toWorld(d.c, d.r).add(new THREE.Vector3(0, 0.8, 0)), 0.4);
  if (!G.profile.clues.some(Boolean) && !G.profile.deskOpen) {
    await say('system', ['An ornate desk with a golden plaque: SECRET SECRETARY DESK. Its drawer has three combination letter locks.', 'Each room\'s mentor holds one keyword. Collect all three.']);
  }
  const res = await openDesk({ profile: G.profile });
  if (res.opened && !G.profile.deskOpen) {
    G.profile.deskOpen = true;
    unlockMilestone('desk');
    store.save();
  }
  if (res.action === 'enter') await enterRoom('lingo', '@');
}

// ── The four Rooms ────────────────────────────────────────────────

/** Mr. Phil's d20: click it from anywhere to throw it around the teacher corner. */
function placeDie(d) {
  const z = d.d20;
  const a = G.room.toWorld(z.c0, z.r0);
  const b = G.room.toWorld(z.c1, z.r1);
  const obstacles = G.room.objects.filter((o) => o.mesh && roomZone(o.c) === 0 && o.ch !== 'H').map((o) => {
    const p = G.room.toWorld(o.c, o.r);
    return { x: p.x, z: p.z, r: 0.42 };
  });
  const die = createD20({ minX: a.x - 0.5, maxX: b.x + 0.5, minZ: a.z - 0.5, maxZ: b.z + 0.5, obstacles }, {
    onBounce: () => sfx.bounce(),
    onLand: (n) => dieLanded(n),
  });
  G.room.group.add(die.group);
  const o = { mesh: die.group, label: 'ROLL', instant: true, walkable: true, ch: 'd20', use: () => rollDie() };
  const cell = G.room.toCell(die.pos);
  o.c = cell.c; o.r = cell.r;
  die.group.traverse((n) => { n.userData.obj = o; });
  G.room.objects.push(o);
  G.die = die;
  G.dieObj = o;
}

function rollDie() {
  if (!G.die || !G.die.roll()) return;
  sfx.click();
  if (G.dieLabel) { G.room.group.remove(G.dieLabel); G.dieLabel = null; }
}

function updateDie(dt) {
  G.die.update(dt);
  const cell = G.room.toCell(G.die.pos);
  G.dieObj.c = cell.c; G.dieObj.r = cell.r;
  if (G.dieLabel) G.dieLabel.position.set(G.die.pos.x, 1.35, G.die.pos.z);
}

function dieLanded(n) {
  G.profile.stats.rolls = (G.profile.stats.rolls || 0) + 1;
  store.save();
  const crit = n === 20;
  const label = labelSprite(String(n), { color: '#ffffff', bg: crit ? 'rgba(201,148,20,0.95)' : 'rgba(24,168,58,0.95)', border: '#ffffff', height: 0.5 });
  label.position.set(G.die.pos.x, 1.35, G.die.pos.z);
  G.room.group.add(label);
  G.dieLabel = label;
  speak(String(n));
  if (crit) { sfx.crit(); hud.criticalHit(); } else { sfx.pickup(); hud.toast(`d20 rolled a ${n}${n === 1 ? '. Oof. A natural 1.' : '.'}`, n >= 15 ? 'good' : 'info'); }
  setTimeout(() => {
    if (G.dieLabel !== label) return;
    tween(500, (k) => { label.material.opacity = 1 - k; }, () => { G.room && G.room.group.remove(label); if (G.dieLabel === label) G.dieLabel = null; });
  }, 3000);
}

/**
 * The Rotling hall. The Lingo Room keeps its hand-written Rotlings; the three main rooms
 * draw a fresh random wave from the word bank (saved, so leaving and coming back keeps it).
 * A cleared room gets a Rot Return: a few harder Rotlings worth bonus bits.
 */
function spawnWave(d, prog) {
  const authored = d.rooms[1].rotlings || [];
  if (d.id !== 'lingo' && !prog.wave && !prog.waveCleared) {
    const killedOld = prog.rotlings[1] || [];
    if (prog.done.terminal1 || prog.cleared || (authored.length && killedOld.length >= authored.length)) prog.waveCleared = true;
    else {
      const learned = new Set([...taughtBy(d.id), ...G.profile.learned]);
      prog.wave = makeWave({ learned, origin: d.origin, size: d.id === 'anglo' ? 6 : 7 });
      prog.rotlings[1] = [];
    }
    store.save();
  }
  const items = d.id === 'lingo' ? authored : (prog.waveCleared ? [] : prog.wave || []);
  const killed = prog.rotlings[1] || [];
  const fixed = G.room.find('R');
  // Only the near side of the chasm: before the bridge, the far side can't be reached.
  const open = shuffle(G.room.find('.').filter((c) => roomZone(c.c) === 1 && (d.id === 'lingo' || c.c < CHASM_COLS[0]) && G.room.isWalkable(c.c, c.r) && !G.room.isPort(c.c, c.r) && G.room.cells[c.r][c.c] !== '~'));
  const freeCell = () => [...fixed, ...open].find((c) => !G.rotlings.some((o) => o.c === c.c && o.r === c.r));
  items.forEach((item, i) => {
    if (killed.includes(i)) return;
    const cell = freeCell();
    if (!cell) return;
    const rr = spawnRotling(item, cell);
    rr.index = i;
  });
  if (d.id !== 'lingo' && prog.cleared) {
    const wave = makeWave({ learned: new Set(G.profile.learned), origin: d.origin, size: 4, fakes: 0.5, minParts: 3, golden: 0.5 });
    let n = 0;
    wave.forEach((item) => { const cell = freeCell(); if (cell) { spawnRotling(item, cell, { ret: true }); n++; } });
    if (n) setTimeout(() => { hud.toast(`Rot Return! ${n} harder Rotlings crawled back into the hall.`, 'warn'); refreshObjective(); }, 900);
  }
}

async function enterRoom(id, arrival) {
  const d = DISTRICTS[id];
  G.place = id;
  G.rot = 0;
  G.rotSpawned = false;
  G.carried = [];
  G.profile.place = { id };
  const prog = store.dprog(G.profile, id);
  store.save();
  await loadRoom(d.map, id, { arrival, paint: d.paint || [], makeObject: (ch, c, r) => roomObject(d, ch, c, r) });
  if (d.d20) placeDie(d);
  if (prog.done.terminal1) G.room.formBridge(CORRIDOR, true);
  spawnWave(d, prog);
  hud.setPlace(d.name.toUpperCase());
  refreshObjective();
  if (!prog.introDone) {
    // Start the mentor once the door transition has released the game.
    const mentor = G.room.objects.find((o) => o.ch === 'M');
    setTimeout(() => { if (!G.busy && G.place === id) use({ obj: mentor }); }, 400);
  }
}

const CLASSROOM_MODELS = { cart: chromebookCart, printer3d };

function roomObject(d, ch, c, r) {
  const prog = store.dprog(G.profile, d.id);
  const style = d.id;
  const last = d.rooms.length - 1;
  if (d.props && d.props[ch]) {
    const prop = d.props[ch];
    const mesh = CLASSROOM_MODELS[prop.model] ? CLASSROOM_MODELS[prop.model]() : morphProp(prop.model, style);
    mesh.rotation.y = prop.rot ?? (c > d.map[0].length / 2 ? -Math.PI / 2 : Math.PI / 2);
    const tag = labelSprite(prop.ids ? prop.ids.map((id) => morph(id).text).join(' · ') : prop.word, { color: '#ffffff', bg: 'rgba(10,6,24,0.88)', border: '#ffd23f', height: 0.3 });
    tag.position.y = prop.tagY || 1.75;
    tag.material.opacity = 0;
    tag.visible = false;
    mesh.add(tag);
    const o = { mesh, info: true, prop, tag };
    G.props.push(o);
    return o;
  }
  switch (ch) {
    case 'M': {
      const m = createMentor(d.mentor.id);
      G.mentor = m;
      return { mesh: m.group, label: 'TALK', use: () => runMentor(d) };
    }
    case 'G':
    case 'F': {
      const gz = ch === 'G' ? 0 : 1;
      const mesh = gate(style);
      const open = !!prog.done[`gate${gz}`];
      mesh.userData.setOpen(open);
      const o = { mesh, label: 'UNLOCK', walkable: false, use: () => runGate(d, gz, o) };
      if (open) { o.walkable = true; o.use = null; o.label = null; }
      return o;
    }
    case 'T': return { mesh: terminal(style, 'BRIDGE'), label: 'USE', use: () => runTerminal(d) };
    case 'N': return { mesh: linkNode(style), label: 'LINK', use: () => runLink(d, last) };
    case 'W': return { mesh: newWordConsole(style), label: 'OPEN', use: () => runNewWord(d, last) };
    case 'C': {
      if (d.id === 'lingo') {
        // The Smart Board is the Lingo Room's core: it types the morpheme lesson on repeat.
        const mesh = smartBoard();
        return { mesh, label: 'FINISH', use: () => runCore(d, last), update: (dt) => mesh.userData.tick(G.t, dt) };
      }
      const mesh = core(style);
      return { mesh, label: d.id === 'lingo' ? 'FINISH' : 'RESTORE', use: () => runCore(d, last), update: (dt) => { mesh.userData.spin.rotation.y += dt; mesh.userData.rings[0].rotation.z += dt * 0.7; mesh.userData.rings[1].rotation.y += dt * 1.1; } };
    }
    case 'R': return { walkable: true };
    case 'Y': {
      // The long desks: scenery only (their tiles are blocked by the x tiles under them).
      const [ac, ar] = d.desks.anchor;
      return { scenery: triangleDesks(d.desks.corners.map(([cc, rr]) => [cc - ac, rr - ar])) };
    }
    case 'H': return { mesh: port(style, { label: 'HUB', axis: 'x', color: 0x00e5ff }), walkable: true, port: () => enterHub(d.id === 'lingo' ? 'D' : ROOM_PORT[d.id]) };
    default: return null;
  }
}

function poolFor(d) {
  const ids = [];
  d.mentorFlow.batches.forEach((b) => (b.teach || []).forEach((id) => ids.push(id)));
  d.rooms.forEach((r) => { if (r.terminal) ids.push(...(r.terminal.teach || [])); if (r.core) ids.push(...(r.core.teach || [])); });
  return ids;
}

async function teach(ids, tasks, note) {
  const fresh = (ids || []).filter((id) => !G.profile.learned.includes(id));
  if (!fresh.length) return;
  await showLesson({ ids: fresh, profile: G.profile, tasks, note });
  store.learn(G.profile, fresh);
  hud.renderInventory(G.profile);
}

const objPos = (ch, lift = 0) => { const o = G.room.objects.find((x) => x.ch === ch); return G.room.toWorld(o.c, o.r).add(new THREE.Vector3(0, lift, 0)); };

async function runMentor(d) {
  const prog = store.dprog(G.profile, d.id);
  const sp = d.mentor.id;
  zoomTo(objPos('M', 0.8), 0.5);
  if (!prog.introDone) {
    await say(sp, d.mentorFlow.intro);
    prog.introDone = true;
    store.save();
  }
  const batches = d.mentorFlow.batches;
  while (prog.batch < batches.length) {
    const b = batches[prog.batch];
    await teach(b.teach, b.tasks);
    if (b.say && !prog[`said${prog.batch}`]) { await say(sp, b.say); prog[`said${prog.batch}`] = true; }
    const res = await openCompile({
      mode: b.kind === 'unpack' ? 'unpack' : 'compile',
      tasks: b.tasks.slice(prog.batchTask || 0),
      profile: G.profile,
      pool: poolFor(d),
      onSolved: (t) => {
        prog.batchTask = (prog.batchTask || 0) + 1;
        if (b.kind === 'unpack') store.learn(G.profile, t.p);
        store.save();
      },
    });
    if (res.done < res.total) { refreshObjective(); return; }
    prog.batch += 1;
    prog.batchTask = 0;
    bankCarried();
    store.save();
  }
  if (!prog.done.mentor) {
    prog.done.mentor = true;
    store.save();
    await say(sp, d.mentorFlow.done);
  } else if (prog.cleared && d.keySlot >= 0) {
    const c = hud.clueText(G.profile, d.keySlot);
    await say(sp, [`Your keyword clue: the ${c.slotName} shared by ${c.words.join(', ')}. ${c.length} letters.`]);
  } else if (d.mentorFlow.chatter) {
    // Mr. Phil's small talk: the next line each visit, after any instruction still needed.
    const chat = d.mentorFlow.chatter;
    prog.chat = (prog.chat || 0) % chat.length;
    const lines = prog.done.gate0 ? [] : [...d.mentorFlow.repeat];
    lines.push(chat[prog.chat]);
    prog.chat += 1;
    store.save();
    await say(sp, lines);
  } else {
    await say(sp, d.mentorFlow.repeat);
  }
}

async function runGate(d, gz, obj) {
  const prog = store.dprog(G.profile, d.id);
  const g = d.rooms[gz].gate;
  const needOk = g.needs === 'mentor' ? prog.done.mentor : g.needs === 'terminal' ? prog.done.terminal1 : true;
  if (!needOk) { sfx.bad(); hud.toast(g.lockedMsg, 'warn'); return; }
  zoomTo(G.room.toWorld(obj.c, obj.r), 0.55);
  if (!prog[`gateSay${gz}`]) { await say(d.mentor.id === 'phil' ? 'phil' : 'system', g.say); prog[`gateSay${gz}`] = true; }
  const key = `gateTask${gz}`;
  const res = await openCompile({ mode: 'patch', tasks: g.tasks.slice(prog[key] || 0), profile: G.profile, pool: poolFor(d), onSolved: () => { prog[key] = (prog[key] || 0) + 1; store.save(); } });
  if (res.done < res.total) return;
  prog.done[`gate${gz}`] = true;
  store.save();
  bankCarried();
  obj.mesh.userData.setOpen(true);
  obj.walkable = true;
  obj.use = null;
  obj.label = null;
  G.room.setBlocked(obj.c, obj.r, false);
  sfx.gate();
  hud.toast('Firewall open!', 'good');
}

async function runTerminal(d) {
  const prog = store.dprog(G.profile, d.id);
  const t = d.rooms[1].terminal;
  if (G.rotlings.some((r) => r.index !== undefined)) { sfx.bad(); hud.toast(t.lockedMsg, 'warn'); return; }
  if (prog.done.terminal1) { hud.toast('The bridge is already up.'); return; }
  zoomTo(objPos('T'), 0.55);
  await teach(t.teach, t.tasks);
  if (!prog.termSay1) { await say('system', t.say); prog.termSay1 = true; }
  const res = await openCompile({ mode: 'compile', tasks: t.tasks.slice(prog.termTask1 || 0), profile: G.profile, pool: poolFor(d), onSolved: () => { prog.termTask1 = (prog.termTask1 || 0) + 1; store.save(); } });
  if (res.done < res.total) return;
  prog.done.terminal1 = true;
  store.save();
  bankCarried();
  G.room.formBridge(CORRIDOR);
  G.rot = 0;
  sfx.bridge();
  hud.toast('Data bridge online!', 'good');
}

async function runLink(d, zone) {
  const prog = store.dprog(G.profile, d.id);
  const link = d.rooms[zone].link;
  if (prog.done[`link${zone}`]) { hud.toast('Already linked. Nice tree.'); return; }
  zoomTo(objPos('N'), 0.55);
  if (!prog[`linkSay${zone}`]) { await say(d.id === 'lingo' ? 'phil' : 'system', link.say); prog[`linkSay${zone}`] = true; }
  const res = await openLink({ link, profile: G.profile });
  if (!res.solved) return;
  prog.done[`link${zone}`] = true;
  link.bases.forEach((b) => b.words.forEach((w) => { if (b.id) store.addLexicon(G.profile, w, [b.id]); }));
  store.save();
  hud.toast('Families linked!', 'good');
}

async function runNewWord(d, zone) {
  const prog = store.dprog(G.profile, d.id);
  const item = d.rooms[zone].newword;
  if (prog.done[`newword${zone}`]) { hud.toast(`Solved: ${item.w}.`); return; }
  zoomTo(objPos('W'), 0.55);
  if (item.teachFirst) await teach(item.teachFirst, [], 'Two new Greek pieces before the case.');
  const res = await openNewWord({ item, profile: G.profile });
  if (!res.solved) return;
  prog.done[`newword${zone}`] = true;
  if (d.id !== 'lingo') store.addLexicon(G.profile, item.w, item.p);
  store.save();
  hud.toast('Case closed!', 'good');
}

async function runCore(d, zone) {
  const prog = store.dprog(G.profile, d.id);
  const c = d.rooms[zone].core;
  if (prog.done[`core${zone}`]) { hud.toast('The core is already restored.'); return; }
  const missing = (c.needs || []).filter((k) => !prog.done[`${k}${zone}`] && !(k === 'rotlings' && !G.rotlings.some((r) => r.index !== undefined)));
  if (missing.length) { sfx.bad(); hud.toast(c.lockedMsg, 'warn'); return; }
  zoomTo(objPos('C', 0.6), 0.5);
  await teach(c.teach, c.tasks);
  if (!prog.coreSay) { await say(d.mentor.id === 'phil' ? 'phil' : 'system', c.say); prog.coreSay = true; }
  const key = `coreTask${zone}`;
  const res = await openCompile({ mode: c.kind === 'unpack' ? 'unpack' : 'compile', tasks: c.tasks.slice(prog[key] || 0), profile: G.profile, pool: poolFor(d), onSolved: (t) => { prog[key] = (prog[key] || 0) + 1; if (c.kind === 'unpack') store.learn(G.profile, t.p); store.save(); } });
  if (res.done < res.total) return;
  prog.done[`core${zone}`] = true;
  prog.cleared = true;
  store.save();
  bankCarried();
  sfx.unlock();
  await say(d.mentor.id, c.outro);
  if (d.keySlot >= 0) {
    G.profile.clues[d.keySlot] = true;
    const clue = hud.clueText(G.profile, d.keySlot);
    await say('system', [`KEYWORD ${d.keySlot + 1} RECEIVED. It is a ${clue.slotName} with ${clue.length} letters: the ${clue.slotName} shared by ${clue.words.join(', ')}.`, 'Clue cards live in the CLUES tab of your morphemes drawer. Something in the Hub is waiting for all three.']);
    hud.toast(`Keyword ${d.keySlot + 1} clue added to CLUES`, 'gold');
  }
  unlockMilestone(d.id);
  store.save();
}

function unlockMilestone(key) {
  if (store.addMilestone(G.profile, key)) hud.toast('New Morpher parts unlocked! Visit CUSTOMIZE in the Hub.', 'gold');
}

// ── Overclock Mode ────────────────────────────────────────────────

async function startTimed() {
  const origins = MAIN_ORDER.filter((d) => G.profile.milestones.includes(d));
  const learned = new Set(G.profile.learned);
  let words = allWords().filter((w) => origins.includes(w.origin) && isKnown(w.ids, learned));
  if (PRACTICE.length) { const f = words.filter((w) => w.ids.some((id) => PRACTICE.includes(id))); if (f.length >= 4) words = f; }
  const fakes = [...collectFakes().filter((f) => origins.includes(f.origin)), ...shuffle(words).slice(0, 60).map((w) => makeFake(w)).filter(Boolean)];
  G.place = 'timed';
  G.timed = { t: 120, score: 0, words: 0, first: 0, attempts: 0, streak: 0, bestStreak: 0, spawn: 0, pool: words, fakes, over: false };
  await loadRoom(TIMED_MAP, 'arcade', {});
  hud.setPlace('OVERCLOCK MODE');
  $('hud').append(el('div', { class: 'timer glass', id: 'timed-clock' }, '2:00'));
  refreshObjective();
  await say('system', ['OVERCLOCK MODE: 2 minutes. Rotlings pour in. DEBUG as many as you can.', 'First-try splits build a streak. Streaks multiply your score. Go!']);
}

function updateTimed(dt) {
  const T = G.timed;
  if (!T || T.over) return;
  if (!dialogueOpen() && !screens.screenOpen()) T.t -= dt;
  const clock = $('timed-clock');
  if (clock) { const s = Math.max(0, Math.ceil(T.t)); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}  ·  ${T.score}`; }
  T.spawn -= dt;
  if (T.spawn <= 0 && G.rotlings.length < 6 && !dialogueOpen()) {
    T.spawn = 3.2;
    const fake = T.fakes.length && Math.random() < 0.25;
    const item = fake ? pick(T.fakes) : { p: pick(T.pool).ids };
    const free = shuffle(G.room.find('.')).find((c) => G.room.isWalkable(c.c, c.r) && !(c.c === G.player.c && c.r === G.player.r) && !G.rotlings.some((r) => r.c === c.c && r.r === c.r));
    if (free) spawnRotling(item, free);
  }
  if (T.t <= 0 && !panelOpen()) endTimed();
}

function timedResult(r, res) {
  const T = G.timed;
  if (!T) return;
  T.attempts++;
  if (res.solved) {
    removeRotling(r);
    T.words++;
    if (res.firstTry) { T.first++; T.streak++; T.bestStreak = Math.max(T.bestStreak, T.streak); } else T.streak = 0;
    const pts = 100 + 20 * r.item.p.length + T.streak * 15;
    T.score += pts;
    hud.toast(`+${pts}${T.streak > 1 ? `  ×${T.streak} streak` : ''}`, 'good');
  } else T.streak = 0;
}

async function endTimed() {
  const T = G.timed;
  if (T.over) return;
  T.over = true;
  G.busy = true;
  const clock = $('timed-clock');
  if (clock) clock.remove();
  const result = { score: T.score, words: T.words, accuracy: T.attempts ? Math.round((T.first / T.attempts) * 100) : 0, bestStreak: T.bestStreak };
  const rank = store.addScore({ name: G.profile.name, score: result.score, words: result.words, t: Date.now() });
  sfx.unlock();
  screens.timedResultScreen({
    profile: G.profile, result, rank,
    onAgain: async () => { G.busy = false; await startTimed(); },
    onExit: async () => { G.busy = false; G.timed = null; await enterHub('O'); },
  });
}

// ── The finale ────────────────────────────────────────────────────

async function startFinale() {
  G.place = 'finale';
  G.finale = { stage: 0, words: FINALE_POOLS.map((pool) => pick(pool.words)) };
  await loadRoom(FINALE_MAP, 'rot', { makeObject: (ch, c, r) => {
    if (ch === 'H') return { mesh: port('rot', { label: 'RETREAT', axis: 'z', color: 0x00e5ff }), walkable: true, port: () => enterHub('4') };
    if (ch === 'C') { G.finale.cell = { c, r }; return null; }
    return null;
  } });
  spawnBoss();
  refreshObjective();
  await say('rot', ['So. The little Morpher who glues words back together.', 'I am the Rot. I am every word that never held. Split me if you can.']);
}

function spawnBoss() {
  const r = spawnRotling({ p: G.finale.words[G.finale.stage] }, G.finale.cell, { boss: true });
  r.boss = true;
  hud.setPlace(`THE ROT · ${FINALE_POOLS[G.finale.stage].label.toUpperCase()} FORM`, 3, G.finale.stage);
}

async function bossFight(r) {
  const ids = r.item.p;
  const word = build(ids).word;
  zoomTo(r.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0.6);
  const res = await openDebug({ item: r.item, profile: G.profile, mode: 'finale', title: `BOSS · ${FINALE_POOLS[G.finale.stage].label.toUpperCase()} FORM · split ${word.toUpperCase()}` });
  if (!res.solved) return;
  const comp = await openCompile({ mode: 'finale', tasks: [{ m: `Rebuild ${word.toUpperCase()}: ${ids.map((id) => morph(id).meaning).join(' + ')}`, p: ids }], profile: G.profile, pool: G.profile.learned });
  if (comp.done < 1) { hud.toast('The Rot re-forms. Try the compile again.', 'warn'); return; }
  removeRotling(r);
  sfx.crash();
  G.finale.stage += 1;
  if (G.finale.stage < 3) {
    await say('rot', [G.finale.stage === 1 ? 'Clever. But Latin roots run deeper.' : 'Enough! My last form is Greek, and it is LONG.']);
    spawnBoss();
    return;
  }
  G.profile.finale.beaten = true;
  unlockMilestone('finale');
  store.save();
  await say('rot', ['No… every piece… has meaning…']);
  hud.showHud(false);
  await new Promise((res2) => screens.endingScreen({ profile: G.profile, onDone: res2 }));
  hud.showHud(true);
  await enterHub('4');
}

// ── Pause ─────────────────────────────────────────────────────────

function openPause() {
  if (!G.profile || G.place === 'title') return;
  if (G.place === 'timed') {
    screens.confirmBox('End this Overclock Mode run now?', 'End run', 'Keep playing').then((yes) => { if (yes) G.timed.t = 0; });
    return;
  }
  screens.pauseScreen({
    profile: G.profile,
    onResume: () => {},
    onQuit: () => quitToTitle(),
    onLexicon: () => screens.lexiconPanel(G.profile),
    onAvatar: () => customize(),
    onEndSession: () => showExitTicket(false),
  });
}

// ── Class sessions: the teacher's timer and the exit ticket ───────

async function quitToTitle() {
  store.save();
  if (G.player) R.scene.remove(G.player.entity.group);
  G.player = null;
  G.profile = null;
  screens.closeAllScreens();
  await showTitle();
}

function showExitTicket(timeUp) {
  if (!G.profile) return;
  const ticket = session.endSession();
  G.sessionOver = true;
  $('session-clock').hidden = true;
  sfx.unlock();
  screens.exitTicketScreen({ profile: G.profile, ticket, form: SESSION_FORM, timeUp, onDone: () => quitToTitle() });
}

/** Once a second: the clock, a one-minute warning, and the exit ticket when time is up (never mid-task). */
setInterval(() => {
  const clock = $('session-clock');
  if (!G.profile || G.sessionOver || G.place === 'title') { clock.hidden = true; return; }
  const left = session.secondsLeft();
  if (left === null) { clock.hidden = true; return; }
  clock.hidden = false;
  clock.textContent = `⏱ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
  clock.classList.toggle('low', left <= 60);
  if (left === 60) hud.toast('One minute left. Finish the task you are on.', 'gold');
  if (left > 0) return;
  if (G.place === 'timed' && G.timed && !G.timed.over) { G.timed.t = 0; return; }
  if (panelOpen() || dialogueOpen() || screens.screenOpen() || G.busy) { clock.textContent = '⏱ Time! Finish this task'; return; }
  showExitTicket(true);
}, 1000);

// Playtest hooks (see dev/autoplay.js).
window.__cybermorph = G;
G.step = debugStep;
G.R = R;
G.toScreen = toScreen;
G.walkToUse = (t) => walkToUse(t);
G.walkTo = (c) => walkTo(c);
G.enterRoom = (id) => enterRoom(id, "@");
G.rollDie = () => rollDie();

export { G };

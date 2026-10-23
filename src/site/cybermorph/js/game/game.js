/**
 * CyberMorph's game loop and flow: places (the Hub, the four Rooms, Overclock Mode, the finale),
 * click-to-move and camera-relative keys, objects and what they do, room progress, the Rot meter,
 * the Secret Secretary Desk and the Lingo Room.
 *
 * Each Room is one big diorama split into zones by firewalls (see data/layout.js):
 *   zone 0  the mentor and the first levels     → firewall G
 *   zone 1  levels, Rotlings, the terminal      → firewall F
 *   zone 2  the last levels, LINK, the Unknown File, the core
 *
 * A level (data/levels.js) is a meal: EARN each morpheme at its glowing node by playing its
 * minigame (appetizer), BUILD the level's words on its dials (main course), then DEBUG Rotlings
 * made from those words (dessert). Each zone's levels must be cleared before its firewall opens.
 * (The Lingo Room has two zones: the classroom, then the computer lab.)
 */

import { $, el, shuffle, pick, wait, clamp, tween } from '../core/util.js';
import { THREE, R, debugStep, toScreen, initRenderer, fitRoom, zoomTo, zoomReset, snapCamera, setBackground, pickWorld, groundPoint, onUpdate, webglAvailable, setFollow, rotateView, zoomStep, resetView, viewYaw, setViewYaw, orbitBy, panBy, relaxPan } from '../engine/renderer.js';
import { buildRoom } from '../engine/diorama.js';
import { STYLES, cyl, glowMat, terminal, gate, port, linkNode, newWordConsole, core, compilerConsole, avatarBooth, arcadeCabinet, secretaryDesk, lexiconTree, morphProp, animateProp, treeBaseZone } from '../engine/props.js';
import { labelSprite } from '../engine/textures.js';
import { smartBoard, triangleDesks, printer3d, chromebookCart, createD20 } from '../engine/classroom.js';
import { createMorpher, createMentor, createRotling, createPickup } from '../engine/characters.js';
import { applySettings } from '../core/settings.js';
import { sfx, startMusic, unlockAudio, speak } from '../core/audio.js';
import * as store from '../core/save.js';
import { touch, dueIds } from '../core/mastery.js';
import * as session from '../core/session.js';
import { DISTRICTS, MAIN_ORDER, HUB_MAP, collectFakes, achievement, rewardsOf, DICTIONARY, EXTRA_LEVELS } from '../data/world.js';
import { makeWave, makeFake, fakeFor, dealCalls, rollCalls, taughtBy, randomWord, allWords, isKnown } from './waves.js';
import { buildDeck, rounds } from './ticket.js';
import { MM_LESSONS } from '../data/mm.js';
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
import { playMinigame } from '../minigames/harness.js';
import { LEVELS } from '../data/levels.js';
import { INTRO, LINES, EARNED, DONE, REPEAT } from '../data/levelLines.js';
import * as HUB from '../data/hubLines.js';
import { createNoam } from '../engine/noam.js';
import { initDevConsole } from '../dev/console.js';
import { FAMILIES, FAMILY_OF } from '../data/families.js';
import { runFight, skillPercents, overallPercent } from './finale/fight.js';

const PARAMS = new URLSearchParams(location.search);
/** The teacher's link can set a session length (?mins=12) and a Google Form for exit-ticket codes (?form=…). */
const SESSION_MINS = Math.max(0, Math.min(60, parseInt(PARAMS.get('mins') || '0', 10) || 0));
const SESSION_FORM = /^https:\/\//.test(PARAMS.get('form') || '') ? PARAMS.get('form') : '';
const PRACTICE_RAW = (PARAMS.get('set') || '').split(',').map((s) => s.trim()).filter(Boolean).map((k) => (MORPHEMES[k] ? k : Object.values(MORPHEMES).find((m) => m.cat === k)?.id)).filter(Boolean);
const PRACTICE = [...new Set(PRACTICE_RAW)];
/** The teacher's Exit Ticket link (?mode=ticket&set=…): a focused practice session on only the ticked morphemes. */
const TICKET_MODE = PARAMS.get('mode') === 'ticket' && PRACTICE.length > 0;
const TICKET_LESSONS = MM_LESSONS.filter((l) => l.ids.some((id) => PRACTICE.includes(id))).map((l) => l.label);

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
// Walking through a hub door keeps going the same way. The room turns so its door sits on the side you entered.
const ENTRY = {
  anglo: { roomYaw: Math.PI / 2, look: 0 },
  latin: { roomYaw: Math.PI, look: Math.PI / 2 },
  greek: { roomYaw: 0, look: -Math.PI / 2 },
};
const RETURN_LOOK = { 1: Math.PI, 2: -Math.PI / 2, 3: Math.PI / 2, 4: 0 };
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
    banner: TICKET_MODE ? `EXIT TICKET PRACTICE · Today: ${TICKET_LESSONS.join(', ')}` : null,
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
      screens.welcomeScreen({ name: p.name, onContinue: () => (TICKET_MODE ? startTicket(p) : startProfile(p, true)) });
    },
  });
}

/** Continue a save, unless this browser's timed session just ended (the teacher's cooldown). */
function playProfile(p) {
  const wait = SESSION_MINS ? session.cooldownLeft(p) : 0;
  if (!wait) { if (TICKET_MODE) startTicket(p); else startProfile(p); return; }
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
  session.setFocus(null);
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
  // A brand-new Morpher meets Noam in the Hub (hubStory). A returning one gets one line on the reset.
  if (p.migrated) {
    delete p.migrated;
    store.save();
    await say('system', [`Welcome back, ${p.name}. The Lexinet was rebuilt into levels, so every room starts fresh. Your Morpher kept its look and its achievements.`]);
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

async function loadRoom(map, style, { arrival = '@', arrivalCell = null, noPlayer = false, makeObject = null, flowers = false, paint = [], roomYaw = 0, lookYaw = null, insideDoor = false } = {}) {
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
  room.setYaw(roomYaw);
  G.room = room;
  R.scene.add(room.group);
  fitRoom(room.W, room.H);
  zoomReset();
  if (lookYaw != null) setViewYaw(lookYaw);
  const cell = insideDoor
    ? (room.insideDoor() || room.marks['@'])
    : (arrivalCell || room.marks[arrival] || room.marks['@'] || { c: Math.floor(room.W / 2), r: Math.floor(room.H / 2) });
  if (!noPlayer) {
    if (!G.player) G.player = makePlayer();
    G.player.entity.setAvatar(G.profile.avatar);
    placePlayer(cell);
    if (lookYaw != null) G.player.entity.group.rotation.y = Math.atan2(-Math.sin(lookYaw), -Math.cos(lookYaw));
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
  // A press on the world is a click (walk / use) unless it moves: then it drags the camera.
  // Left-drag orbits, right-drag (or Shift + drag) slides the view, the wheel zooms.
  const cv = R.renderer.domElement;
  let drag = null;
  cv.addEventListener('contextmenu', (e) => { if (G.room) e.preventDefault(); });
  cv.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (blocked() || !G.room || !G.player) {
      G.lastIgnored = { busy: G.busy, panel: panelOpen(), dialogue: dialogueOpen(), screen: screens.screenOpen(), place: G.place };
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, pan: e.button === 2 || e.shiftKey };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) drag.moved = true;
    if (!drag.moved) return;
    const dx = e.clientX - drag.lx;
    const dy = e.clientY - drag.ly;
    drag.lx = e.clientX;
    drag.ly = e.clientY;
    if (drag.pan) panBy(dx, dy); else orbitBy(dx, dy);
  });
  window.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.moved || d.pan || e.target !== cv) return;
    worldClick(e);
  });
  window.addEventListener('pointercancel', () => { drag = null; });
  let wheelAt = 0;
  cv.addEventListener('wheel', (e) => {
    if (blocked() || !G.room || G.place === 'title') return;
    e.preventDefault();
    if (performance.now() - wheelAt < 120) return;
    wheelAt = performance.now();
    zoomStep(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  function worldClick(e) {
    if (blocked() || !G.room || !G.player) return;
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
  }

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
      G.player.path = [];
      G.pending = null;
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
 * The held movement keys as a world direction, relative to the camera, so W always walks
 * "up the screen" however the view is turned. Two keys together walk diagonally.
 */
function heldDirection() {
  const yaw = viewYaw();
  const f = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: -f.z, z: f.x };
  let x = 0;
  let z = 0;
  G.keys.forEach((k) => {
    if (k === 'up') { x += f.x; z += f.z; }
    if (k === 'down') { x -= f.x; z -= f.z; }
    if (k === 'right') { x += right.x; z += right.z; }
    if (k === 'left') { x -= right.x; z -= right.z; }
  });
  const len = Math.hypot(x, z);
  return len < 0.01 ? null : { x: x / len, z: z / len };
}

const BODY = 0.28; // the Morpher's radius, in tiles, for sliding along walls
const freeAt = (x, z) => {
  const cell = G.room.toCell(new THREE.Vector3(x, 0, z));
  return G.room.isWalkable(cell.c, cell.r);
};
/** Can the Morpher's body stand here? Checks its centre and the four edges of its body. */
const bodyFree = (x, z) => freeAt(x, z) && freeAt(x + BODY, z) && freeAt(x - BODY, z) && freeAt(x, z + BODY) && freeAt(x, z - BODY);

/** Glide with the keys: each axis moves on its own, so walking into a wall slides along it. */
function glide(dir, dt) {
  const p = G.player;
  const step = 4.2 * dt;
  const nx = p.pos.x + dir.x * step;
  const nz = p.pos.z + dir.z * step;
  let moved = false;
  if (bodyFree(nx, p.pos.z)) { p.pos.x = nx; moved = true; }
  if (bodyFree(p.pos.x, nz)) { p.pos.z = nz; moved = true; }
  // Turn smoothly toward the way we're walking.
  const want = Math.atan2(dir.x, dir.z);
  const g = p.entity.group;
  let d = want - g.rotation.y;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  g.rotation.y += d * Math.min(1, dt * 14);
  const cell = G.room.toCell(p.pos);
  if (cell.c !== p.c || cell.r !== p.r) {
    p.c = cell.c;
    p.r = cell.r;
    sfx.step();
    onEnterCell();
  }
  if (!moved) {
    // Walking straight into something usable opens it, as stepping into it always did.
    const ahead = G.room.toCell(new THREE.Vector3(p.pos.x + dir.x * 0.7, 0, p.pos.z + dir.z * 0.7));
    const obj = objectAt(ahead.c, ahead.r);
    if (obj && !obj.info && adjacent(p, obj)) { G.keys = []; use({ obj }); }
  }
  return moved;
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
    if (target.rotling) await (target.rotling.boss ? bossFight() : debugRotling(target.rotling));
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
  const seen = G.profile.propsSeen || (G.profile.propsSeen = []);
  if (!seen.includes(p.word)) { seen.push(p.word); store.save(); }
  if (seen.length >= 12) achieve('curious');
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
    const dir = heldDirection();
    if (dir) moving = glide(dir, dt);
  }
  if (moving) relaxPan(dt);
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
  [...G.props, ...(G.nodes || []).filter((o) => o.tag)].forEach((o) => {
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
  if (r.dessert !== undefined) { await dessertDone(r); return; }
  if (r.ret && !G.rotlings.some((x) => x.ret)) {
    G.profile.stats.bits += 40;
    store.save();
    hud.toast('Rot Return cleared! +40 bits', 'gold');
    achieve('rotreturn');
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
    achieve('golden');
  }
  G.streak = res.firstTry ? (G.streak || 0) + 1 : 0;
  if (G.streak >= 3) {
    const bonus = 5 * G.streak;
    st.bits += bonus;
    st.bestStreak = Math.max(st.bestStreak || 0, G.streak);
    if (!r.item.golden) hud.toast(`Clean streak ×${G.streak}! +${bonus} bits`, 'gold');
  }
  if (G.streak >= 5) achieve('streak5');
  if (G.streak >= 10) achieve('streak10');
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
  if (G.tree) {
    if (G.gardenPreview && G.place === 'hub') G.tree.userData.setLeaves(300, (i) => i % 3, 1);
    else {
      const known = G.profile.learned.filter((id) => MORPHEMES[id] && morph(id).origin !== 'lingo').length;
      const frac = Math.min(1, known / ALL_MORPHEMES);
      G.tree.userData.setLeaves(Math.round(frac * 300), leafOrigin, frac);
    }
  }
  if (G.place === 'hub') {
    if (G.gardenPreview) {
      G.room.setFlowers(1000, 1);
      G.room.setUndergrowth(1000);
    } else {
      G.room.setFlowers(G.profile.lexicon.length, 1);
      G.room.setUndergrowth(extraFinds(G.profile));
    }
  }
  hud.setObjective(objectiveText());
}

function leafOrigin(i) {
  const ids = G.profile.learned.filter((id) => MORPHEMES[id] && morph(id).origin !== 'lingo');
  const id = ids[i % Math.max(1, ids.length)];
  if (!id) return 4;
  return { anglo: 0, latin: 1, greek: 2 }[morph(id).origin] ?? 4;
}

function extraFinds(p) {
  return Object.values(p.extra || {}).reduce((n, list) => n + list.length, 0);
}

function objectiveText() {
  const p = G.profile;
  if (G.place === 'hub') {
    const next = MAIN_ORDER.find((d) => !(p.districts[d] && p.districts[d].cleared));
    const reviews = G.rotlings.filter((r) => r.review).length;
    if (reviews) return `${reviews} review Rotling${reviews > 1 ? 's' : ''} in the Hub: DEBUG them to restore fading morphemes.`;
    if (!hubState().intro) return 'Talk to Noam Chomsky, the little professor in the red hat.';
    const labTip = !p.labUsed && hubState().lab ? ' Tip: try the WORD LAB to discover new words.' : '';
    if (next) {
      const where = { anglo: 'the amber door labeled ANGLO-SAXON', latin: 'the grey door labeled LATIN', greek: 'the blue door labeled GREEK' }[next];
      const deskHint = p.clues.some(Boolean) && !p.deskOpen ? ' Your clue cards open something on the Secret Secretary Desk.' : '';
      return `Enter ${DISTRICTS[next].name} through ${where}.${deskHint}${labTip}`;
    }
    if (!p.finale.beaten) return `All three keywords are yours. ${p.deskOpen ? '' : 'Try the Secret Secretary Desk, then '}Face the Rot's final test through the green door labeled THE ROT.`;
    return p.deskOpen ? 'The Lexinet is restored. Try Overclock Mode, or build Made-up Words at the Morph Compiler.' : 'The Lexinet is restored. The Secret Secretary Desk is still locked…';
  }
  if (G.place === 'timed') return 'DEBUG as many Rotlings as you can before time runs out.';
  if (G.place === 'ticket') {
    const t = G.ticket || { done: 0, first: 0 };
    return `Exit Ticket practice · ${t.done} done · ${t.first} right on the first try. Today: ${TICKET_LESSONS.join(', ')}.`;
  }
  if (G.place === 'finale') return G.profile.finale.checkpoint ? `Click the Rot to go on from phase ${G.profile.finale.checkpoint + 1} of the final test.` : 'Click the Rot to begin the final test: three phases, nine trials.';
  if (G.place === 'bossrush') return 'BOSS RUSH: the whole Final Test, scored, with mutations.';
  const d = DISTRICTS[G.place];
  if (!d) return '';
  const prog = store.dprog(p, d.id);
  const done = prog.done;
  const last = d.rooms.length - 1;
  const back = G.rotlings.filter((x) => x.ret).length;
  if (prog.cleared && back) return `Rot Return: ${back} harder Rotling${back > 1 ? 's' : ''} came back. DEBUG them for bonus bits, or take the HUB door.`;
  if (prog.cleared) return 'Room clear! Take the HUB door back.';
  if (!prog.introDone) return `Talk to ${d.mentor.name}.`;
  const lvText = levelObjective(d);
  if (lvText) return lvText;
  if (!done.mentor && !levelsOf(d)) return `Talk to ${d.mentor.name}.`;
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
// Aim a little below and in front of Noam, so he sits above the dialogue box.
const NOAM_SHOT = new THREE.Vector3(0, -0.5, 0.6);
/** Noam's story flags: intro, lab, desk, and one flag per scene already played. */
const hubState = () => G.profile.hub || (G.profile.hub = {});
const portOpen = (id) => (id === 'anglo' ? !!hubState().intro : cleared(MAIN_ORDER[MAIN_ORDER.indexOf(id) - 1]));

/** Swap a Hub object for a fresh build of it (a door unlocking, the Word Lab waking up). */
function rebuildHubObject(ch) {
  const old = G.room.objects.find((o) => o.ch === ch);
  if (!old) return null;
  const { c, r } = old;
  if (old.mesh) G.room.group.remove(old.mesh);
  G.room.objects.splice(G.room.objects.indexOf(old), 1);
  const o = hubObject(ch, c, r);
  if (!o) return null;
  Object.assign(o, { c, r, ch });
  if (o.mesh) {
    o.mesh.position.copy(G.room.toLocal(c, r));
    G.room.group.add(o.mesh);
    o.mesh.traverse((n) => { n.userData.obj = o; });
  }
  G.room.setBlocked(c, r, !o.walkable);
  G.room.objects.push(o);
  return o;
}

/** Point the camera at a Hub object, rebuild it (unlocked) with a click, and hold the shot. */
async function showUnlock(ch) {
  const o = G.room.objects.find((x) => x.ch === ch);
  if (!o) return;
  // Look down steeply so the Lexicon Tree in the middle of the Hub doesn't block the shot.
  const pitch = R.rig.pitch;
  R.rig.pitch = 1.05;
  zoomTo(G.room.toWorld(o.c, o.r).add(new THREE.Vector3(0, 0.8, 0)), 0.55);
  await wait(900);
  rebuildHubObject(ch);
  sfx.unlock();
  await wait(1500);
  R.rig.pitch = pitch;
}

/**
 * Noam's scenes, each played once, when the player arrives in the Hub (lines in data/hubLines.js):
 * the intro (which opens the Anglo-Saxon door), the Word Lab, each room's first morphemes and
 * its clearing, and finally the Secret Secretary Desk clicking open.
 */
async function hubStory() {
  const h = hubState();
  const p = G.profile;
  const noamObj = G.room.objects.find((o) => o.ch === 'M');
  if (!noamObj) return;
  const atNoam = () => zoomTo(G.room.toWorld(noamObj.c, noamObj.r).add(NOAM_SHOT), 0.42);
  const react = (k) => G.mentor && G.mentor.react && G.mentor.react(k);
  const scene = async (key, lines, mood = null) => {
    if (h[key]) return false;
    atNoam();
    if (mood) react(mood);
    await say('noam', lines);
    h[key] = true;
    store.save();
    return true;
  };
  const has = (origin) => p.learned.some((id) => MORPHEMES[id] && morph(id).origin === origin);
  G.busy = true;
  try {
    if (!h.intro) {
      atNoam();
      react('pleased');
      await say('noam', HUB.INTRO(p.name));
      h.intro = true;
      store.save();
      await showUnlock('1');
      atNoam();
      react('pleased');
      await say('noam', HUB.INTRO_AFTER);
      zoomReset();
      await say('system', ['Click the floor to walk, or hold W A S D. Drag the floor to turn the camera. Click a person or a machine to use it.']);
      return;
    }
    if (!h.lab && has('anglo')) {
      atNoam();
      react('pleased');
      await say('noam', HUB.LAB.slice(0, 1));
      h.lab = true;
      store.save();
      await showUnlock('X');
      atNoam();
      await say('noam', HUB.LAB.slice(1));
    }
    if (cleared('anglo')) await scene('clearedAnglo', HUB.CLEARED.anglo, 'pleased');
    if (has('latin')) await scene('saidLatin', HUB.LATIN, 'special');
    if (cleared('latin')) await scene('clearedLatin', HUB.CLEARED.latin, 'pleased');
    if (has('greek')) await scene('saidGreek', HUB.GREEK, 'special');
    if (cleared('greek') && !h.desk) {
      await scene('clearedGreek', HUB.CLEARED.greek);
      atNoam();
      react('pleased');
      await say('noam', HUB.DESK(p.name));
      h.desk = true;
      store.save();
      await showUnlock('D');
      atNoam();
      react('worried');
      await say('noam', HUB.DESK_AFTER);
    }
  } finally {
    G.busy = false;
    zoomReset();
    refreshObjective();
  }
}

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
  await loadRoom(HUB_MAP, 'hub', { arrivalCell, makeObject: hubObject, flowers: true, lookYaw: RETURN_LOOK[fromPort] });
  hud.setPlace('THE HUB');
  G.carried = [];
  spawnReviews();
  refreshObjective();
  // Broadcast the Word Lab once per session until the player has tried it.
  await hubStory();
  if (!G.profile.labUsed && !G.labNudged && hubState().lab) {
    G.labNudged = true;
    setTimeout(() => hud.toast('✨ Try the WORD LAB here in the Hub: build any word you like and discover new ones!', 'gold'), 1500);
  }
  if (fromPort && fromPort !== 'O') await showPatchNotes();
}

/** End-of-shift patch notes: a changelog for the Lexinet built from the words the player just built. */
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
  if (ch === 'M') {
    const noam = createNoam();
    G.mentor = noam;
    noam.group.rotation.y = -0.4; // facing the room, turned a little toward the door you arrive by
    return { mesh: noam.group, label: 'TALK', use: async () => {
      const o = G.room.objects.find((x) => x.ch === 'M');
      zoomTo(G.room.toWorld(o.c, o.r).add(NOAM_SHOT), 0.42);
      noam.react('pleased');
      await say('noam', HUB.TALK(G.profile, cleared));
    } };
  }
  if (ch === 'D') {
    if (!hubState().desk) {
      return { mesh: secretaryDesk(), label: 'LOCKED', use: async () => {
        sfx.bad();
        hud.toast('The Secret Secretary Desk is locked tight. Its letter locks won\'t even turn yet.', 'warn');
      } };
    }
    return { mesh: secretaryDesk(), label: 'OPEN', use: () => useDesk() };
  }
  if (ch === 'A') return { mesh: avatarBooth('hub'), label: 'CUSTOMIZE', use: () => customize() };
  if (ch === 'O') {
    const open = cleared('anglo');
    const mesh = arcadeCabinet('OVERCLOCK', 0xff3df0, !open);
    return { mesh, label: open ? 'PLAY' : 'LOCKED', use: async () => { if (!open) { sfx.bad(); hud.toast('Overclock Mode unlocks when you clear the Anglo-Saxon Room.', 'warn'); return; } await useOverclock(); } };
  }
  if (ch === 'X' && !hubState().lab) {
    // Locked until Noam "discovers" it, after the player brings back their first morphemes.
    return { mesh: compilerConsole('hub'), label: 'LOCKED', use: async () => {
      sfx.bad();
      hud.toast('A dark machine. It needs morphemes to run. Bring some back from the Anglo-Saxon Room.', 'warn');
    } };
  }
  if (ch === 'X') {
    // The WORD LAB: the free Morph Compiler, signposted so players go and play with it.
    const mesh = compilerConsole('hub');
    const sign = labelSprite('✨ WORD LAB · DISCOVER NEW WORDS', { color: '#ffffff', bg: 'rgba(160,20,140,0.92)', border: '#ffd23f', height: 0.5 });
    sign.position.y = 2.2;
    mesh.add(sign);
    let t = 0;
    return { mesh, label: 'WORD LAB', update: (dt) => { t += dt; sign.position.y = 2.2 + Math.sin(t * 2) * 0.08; },
      use: async () => {
        if (!G.profile.learned.some((id) => morph(id).type === 'base')) { hud.toast('Learn some morphemes from Old Wynn first.', 'warn'); return; }
        G.profile.labUsed = true;
        store.save();
        zoomTo(G.room.toWorld(c, r), 0.6);
        await openCompile({
          mode: 'free', profile: G.profile, title: 'WORD LAB · BUILD ANYTHING, DISCOVER NEW WORDS',
          onSolved: (_, r2) => { if (r2 && r2.fresh) hud.miniCelebrate(`New word discovered: ${r2.word}!`); },
          onMadeUp: (w, def) => hud.toast(`Made-up Word saved: ${w}${def ? ` (“${def}”)` : ''}`, 'gold'),
          onDiscover: (word, ids) => grantExtra(word, ids),
        });
        refreshObjective();
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
  picks.forEach((w, i) => { if (spots[i]) spawnRotling((i === 2 && makeFake(w, null, learned)) || { p: w.ids }, spots[i], { review: true }); });
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
  if (G.profile.stats.rolls >= 10) achieve('roll10');
  if (n === 1) achieve('nat1');
  if (crit) { sfx.crit(); hud.criticalHit(); setTimeout(() => achieve('crit'), 5600); } else { sfx.pickup(); hud.toast(`d20 rolled a ${n}${n === 1 ? '. Oof. A natural 1.' : '.'}`, n >= 15 ? 'good' : 'info'); }
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
  const entry = ENTRY[id];
  await loadRoom(d.map, id, { arrival, paint: d.paint || [], makeObject: (ch, c, r) => roomObject(d, ch, c, r), roomYaw: entry ? entry.roomYaw : 0, lookYaw: entry ? entry.look : null });
  if (d.d20) placeDie(d);
  if (prog.done.terminal1) G.room.formBridge(CORRIDOR, true);
  spawnWave(d, prog);
  G.nodes = [];
  spawnLevel(d);
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

// ── Levels: earn → build → debug ──────────────────────────────────

const levelsOf = (d) => LEVELS[d.id] || null;
/** Which zone a level is played in: about 40% in the mentor's zone, 35% in the Rotling zone, the rest by the core. */
function levelZone(i, n) {
  const a = Math.ceil(n * 0.4);
  const b = Math.ceil(n * 0.75);
  return i < a ? 0 : i < b ? 1 : 2;
}
function curLevel(d) {
  const L = levelsOf(d);
  const prog = store.dprog(G.profile, d.id);
  return L && (prog.level || 0) < L.length ? L[prog.level || 0] : null;
}
function zoneLevelsDone(d, z) {
  const L = levelsOf(d);
  if (!L) return true;
  const at = store.dprog(G.profile, d.id).level || 0;
  return L.every((_, i) => levelZone(i, L.length) !== z || i < at);
}
/** Minigame difficulty: gentle for the first two levels of a room, then normal, then hard from level 7. */
const levelTier = (i) => (i < 2 ? 0 : i < 6 ? 1 : 2);
function levelState(prog) {
  if (prog.level === undefined) prog.level = 0;
  if (!prog.lv) prog.lv = { phase: 'earn', earned: [], built: 0, faces: null, dessert: null, dessertDone: [], said: {} };
  return prog.lv;
}
const lineFor = (level, key) => (LINES[level.id] && LINES[level.id][key]) || null;

/** The level's objective line, or null when there is no level running here. */
function levelObjective(d) {
  const level = curLevel(d);
  if (!level) return null;
  const prog = store.dprog(G.profile, d.id);
  const lv = levelState(prog);
  const L = levelsOf(d);
  const head = `Level ${prog.level + 1} of ${L.length}`;
  const z = levelZone(prog.level, L.length);
  const here = G.player ? roomZone(G.player.c) : 0;
  const where = z > here ? (z === 1 ? ' Its morphemes are past the first firewall.' : ' Its morphemes are past the second firewall.') : '';
  if (lv.phase === 'earn') {
    const left = level.earn.length - lv.earned.length;
    return `${head}: walk to the ${left} glowing morpheme${left > 1 ? 's' : ''} and win each one's game.${where}`;
  }
  if (lv.phase === 'build') return `${head}: the dials are loaded. Use the BUILD console (${lv.built}/${buildTasks(level).length} words).`;
  const left = (lv.dessert || []).length - lv.dessertDone.length;
  return `${head}: DEBUG the ${left} Rotling${left > 1 ? 's' : ''} made from your words.`;
}

/** Up to five requests: the main course. */
const buildTasks = (level) => level.requests.slice(0, 5);

/** Cells for this level's nodes: open floor in the level's zone, spread apart, the same every visit. */
function nodeCells(d, i, count) {
  const L = levelsOf(d);
  const z = levelZone(i, L.length);
  let seed = [...L[i].id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const busy = (c) => G.room.objects.some((o) => Math.abs(o.c - c.c) <= 1 && Math.abs(o.r - c.r) <= 1 && !o.walkable);
  const cells = G.room.find('.').filter((c) => roomZone(c.c) === z && G.room.isWalkable(c.c, c.r) && !G.room.isPort(c.c, c.r)
    && G.room.cells[c.r][c.c] !== '~' && c.r !== CORRIDOR && c.r > 1 && c.r < G.room.H - 2 && !(z === 1 && d.id !== 'lingo' && c.c >= CHASM_COLS[0])
    && !busy(c));
  if (!cells.length) return [];
  const out = [cells[Math.floor(rnd() * cells.length)]];
  while (out.length < count && out.length < cells.length) {
    let best = null;
    let bestD = -1;
    for (const c of cells) {
      if (out.includes(c)) continue;
      const dmin = Math.min(...out.map((o) => Math.abs(o.c - c.c) + Math.abs(o.r - c.r))) + rnd() * 0.5;
      if (dmin > bestD) { bestD = dmin; best = c; }
    }
    out.push(best);
  }
  return out;
}

function addLevelObject(o, mesh, cell) {
  Object.assign(o, { c: cell.c, r: cell.r, mesh });
  mesh.position.copy(G.room.toLocal(cell.c, cell.r));
  mesh.traverse((n) => { n.userData.obj = o; });
  G.room.group.add(mesh);
  G.room.objects.push(o);
  G.room.setBlocked(cell.c, cell.r, true);
  G.nodes.push(o);
  return o;
}

function removeLevelObject(o) {
  G.room.group.remove(o.mesh);
  const i = G.room.objects.indexOf(o);
  if (i >= 0) G.room.objects.splice(i, 1);
  G.room.setBlocked(o.c, o.r, false);
  G.nodes = G.nodes.filter((x) => x !== o);
}

const NODE_COLOR = { anglo: 0xffb000, latin: 0xdfe8f5, greek: 0x38b6ff };

/** Put the current level into the room: its morpheme nodes, its BUILD console, or its Rotlings. */
function spawnLevel(d) {
  (G.nodes || []).slice().forEach(removeLevelObject);
  G.rotlings.filter((r) => r.dessert !== undefined).forEach(removeRotling);
  const level = curLevel(d);
  const prog = store.dprog(G.profile, d.id);
  if (!level || !prog.introDone) return;
  const lv = levelState(prog);
  const cells = nodeCells(d, prog.level, level.earn.length + 1);
  if (lv.phase === 'earn') {
    level.earn.forEach((id, k) => {
      if (lv.earned.includes(id) || !cells[k]) return;
      const fam = FAMILIES[FAMILY_OF[id]];
      const g = new THREE.Group();
      g.add(cyl(0.34, 0.16, glowMat(NODE_COLOR[d.id] || 0x2ef0ff, 0.9), 0, 0.08, 0));
      const tile = createPickup(id);
      tile.group.scale.setScalar(1.7);
      g.add(tile.group);
      const tag = labelSprite(fam ? `${morph(id).text} · ${fam.name}` : morph(id).text, { color: '#ffffff', bg: 'rgba(10,6,24,0.88)', border: '#2ef0ff', height: 0.26 });
      tag.position.y = 1.65;
      tag.material.opacity = 0;
      tag.visible = false;
      g.add(tag);
      addLevelObject({ label: 'EARN', node: id, tag, use: () => earnNode(d, id), update: (dt) => tile.update(dt) }, g, cells[k]);
    });
  } else if (lv.phase === 'build') {
    const mesh = compilerConsole(d.id);
    const tag = labelSprite('BUILD', { color: '#01121a', bg: 'rgba(46,240,255,0.95)', border: '#ffffff', height: 0.34 });
    tag.position.y = 1.9;
    mesh.add(tag);
    addLevelObject({ label: 'BUILD', use: () => runBuild(d) }, mesh, cells[0]);
  } else if (lv.phase === 'dessert') {
    (lv.dessert || []).forEach((item, k) => {
      if (lv.dessertDone.includes(k)) return;
      const cell = cells[k] || cells[0];
      if (cell) spawnRotling(item, cell, { dessert: k });
    });
  }
}

/** A level begins: the mentor sets it up and its morphemes light up around the room. */
async function startLevel(d) {
  const level = curLevel(d);
  if (!level) return;
  const prog = store.dprog(G.profile, d.id);
  const lv = levelState(prog);
  spawnLevel(d);
  refreshObjective();
  const open = lineFor(level, 'open');
  if (open && !lv.said.open) { lv.said.open = true; store.save(); await say(d.mentor.id, open); }
  hud.toast(`LEVEL ${prog.level + 1} · ${level.earn.length} morphemes to earn`, 'gold');
}

/** Talking to the mentor mid-level: where things stand, in their voice. */
async function mentorHint(d) {
  const level = curLevel(d);
  const lv = levelState(store.dprog(G.profile, d.id));
  const hint = lineFor(level, lv.phase === 'earn' ? 'open' : lv.phase) || [levelObjective(d)];
  await say(d.mentor.id, hint);
}

/** The appetizer: win a morpheme's minigame to earn it (and any sibling spellings riding with it). */
async function earnNode(d, id) {
  const prog = store.dprog(G.profile, d.id);
  const lv = levelState(prog);
  const level = curLevel(d);
  const o = G.nodes.find((n) => n.node === id);
  if (!level || !o) return;
  zoomTo(G.room.toWorld(o.c, o.r), 0.6);
  const res = await playMinigame(id, { tier: levelTier(prog.level) });
  if (!res.won) return;
  const ids = [id, ...((level.with || {})[id] || [])];
  const before = G.profile.learned.length;
  store.learn(G.profile, ids);
  touch(G.profile, ids, res.misses === 0);
  session.logAttempt(ids, res.misses === 0, { word: false });
  const after = G.profile.learned.length;
  if (Math.floor(after / 10) > Math.floor(before / 10)) hud.miniCelebrate(`🧩 ${Math.floor(after / 10) * 10} morphemes collected!`);
  lv.earned.push(id);
  store.save();
  removeLevelObject(o);
  sfx.pickup();
  hud.renderInventory(G.profile);
  hud.toast(ids.length > 1 ? `+ ${morph(id).text}, with ${ids.slice(1).map((x) => morph(x).text).join(', ')}: same meaning, different spelling` : `+ ${morph(id).text} earned`, 'good');
  if (G.mentor && G.mentor.react) G.mentor.react('pleased');
  refreshObjective();
  if (level.earn.every((x) => lv.earned.includes(x))) {
    lv.phase = 'build';
    store.save();
    spawnLevel(d);
    const line = lineFor(level, 'build');
    if (line) await say(d.mentor.id, line);
    await runBuild(d);
    return;
  }
  const quips = EARNED[d.id];
  if (quips && quips.length && lv.earned.length % 3 === 1) {
    prog.quip = ((prog.quip || 0) + 1) % quips.length;
    store.save();
    await say(d.mentor.id, [quips[prog.quip]]);
  }
}

/** The dials for a level: each dial holds its earned morphemes plus decoys up to six faces. */
function levelFaces(d, level) {
  const lv = levelState(store.dprog(G.profile, d.id));
  if (lv.faces) return lv.faces;
  const shapeIds = level.requests[0].p;
  let k = 0;
  lv.faces = shapeIds.map((pid) => {
    if (morph(pid).type === 'link') return [pid];
    const dial = level.dials[k++];
    const t = morph(dial[0]).type;
    const sameType = (id) => MORPHEMES[id] && morph(id).type === t && !dial.includes(id) && !dial.some((x) => morph(x).text === morph(id).text);
    const known = shuffle(G.profile.learned.filter(sameType));
    const pool = shuffle(poolFor(d).filter(sameType));
    const any = shuffle(Object.keys(MORPHEMES).filter((id) => sameType(id) && morph(id).origin === d.origin));
    const decoys = [...new Set([...known, ...pool, ...any])].filter((id) => !decoyBuilds(level, k - 1, id)).slice(0, Math.max(0, 6 - dial.length));
    return shuffle([...dial, ...decoys]);
  });
  store.save();
  return lv.faces;
}

/** A decoy face is rejected when it completes any real word with the authored faces on the other dials. */
function decoyBuilds(level, slot, decoy) {
  const shape = level.requests[0].p;
  const content = [];
  shape.forEach((id, i) => { if (morph(id).type !== 'link') content.push(i); });
  const walk = (i, ids) => {
    if (i === shape.length) {
      try { return DICTIONARY.has(build(ids).word); } catch { return false; }
    }
    if (morph(shape[i]).type === 'link') return walk(i + 1, ids.concat(shape[i]));
    const dialIdx = content.indexOf(i);
    const options = dialIdx === slot ? [decoy] : level.dials[dialIdx];
    return options.some((id) => walk(i + 1, ids.concat(id)));
  };
  return walk(0, []);
}

/** The main course: build the level's words on its dials. */
async function runBuild(d) {
  const prog = store.dprog(G.profile, d.id);
  const lv = levelState(prog);
  const level = curLevel(d);
  if (!level || lv.phase !== 'build') return;
  const o = G.nodes[0];
  if (o) zoomTo(G.room.toWorld(o.c, o.r), 0.55);
  const faces = levelFaces(d, level);
  const tasks = buildTasks(level).map((t) => ({ ...t, faces, extras: level.extra || [] }));
  const res = await openCompile({
    mode: 'compile', title: `LEVEL ${prog.level + 1} · BUILD THE WORD THAT MEANS`, tasks: tasks.slice(lv.built || 0), profile: G.profile, pool: poolFor(d),
    onSolved: () => { lv.built = (lv.built || 0) + 1; store.save(); refreshObjective(); },
    onDiscover: (word, ids) => grantExtra(word, ids),
  });
  if (res.done < res.total) { refreshObjective(); return; }
  bankCarried();
  serveDessert(d);
}

/** Dessert: Rotlings made from this level's words, one of them a Rot fake. */
function serveDessert(d) {
  const lv = levelState(store.dprog(G.profile, d.id));
  const level = curLevel(d);
  // Three of the level's words, each one's call drawn from the Rotling mix (always one real, one fake).
  const words = shuffle(level.requests.slice()).slice(0, 3).map((t) => ({ ids: t.p }));
  lv.dessert = dealCalls(words, rollCalls(words.length), new Set(G.profile.learned));
  lv.dessertDone = [];
  lv.phase = 'dessert';
  store.save();
  spawnLevel(d);
  refreshObjective();
  hud.toast(`Rotlings crawled out of your words! DEBUG ${lv.dessert.length} to clear the level.`, 'warn');
}

/** Dessert: a level Rotling was debugged. The last one clears the level. */
async function dessertDone(r) {
  const d = DISTRICTS[G.place];
  if (!d) return;
  const prog = store.dprog(G.profile, d.id);
  const lv = levelState(prog);
  if (!lv.dessertDone.includes(r.dessert)) lv.dessertDone.push(r.dessert);
  store.save();
  refreshObjective();
  if (lv.dessertDone.length < (lv.dessert || []).length) return;
  await completeLevel(d);
}

async function completeLevel(d) {
  const prog = store.dprog(G.profile, d.id);
  const level = curLevel(d);
  const L = levelsOf(d);
  sfx.unlock();
  const extra = level.extra || [];
  const found = new Set(((G.profile.extra || {})[level.id] || []).map((e) => e.w));
  const got = extra.filter((e) => found.has(e.w)).length;
  const how = extra.length
    ? `${level.words.length} words live on these dials. Extra Credit: ${got} of ${extra.length} (${extra.map((e) => e.w).join(', ')}).`
    : `${level.words.length} words live on these dials. Try them all in the Word Lab.`;
  hud.fanfare({ name: `Level ${prog.level + 1} clear`, how, rewards: [] });
  if (G.mentor && G.mentor.react) G.mentor.react('pleased');
  const clear = lineFor(level, 'clear');
  if (clear) await say(d.mentor.id, clear);
  const zoneBefore = levelZone(prog.level, L.length);
  prog.level = (prog.level || 0) + 1;
  prog.lv = null;
  store.save();
  if (prog.level >= L.length) {
    prog.done.mentor = true;
    store.save();
    await say(d.mentor.id, DONE[d.id] || d.mentorFlow.done);
  } else if (levelZone(prog.level, L.length) !== zoneBefore) {
    hud.toast(zoneBefore === 0 ? 'Zone clear! The firewall will open for you now.' : 'Zone clear! On to the next firewall.', 'good');
  }
  spawnLevel(d);
  refreshObjective();
  if (curLevel(d)) await startLevel(d);
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
  const before = G.profile.learned.length;
  store.learn(G.profile, fresh);
  const after = G.profile.learned.length;
  if (Math.floor(after / 10) > Math.floor(before / 10)) hud.miniCelebrate(`🧩 ${Math.floor(after / 10) * 10} morphemes collected!`);
  hud.renderInventory(G.profile);
}

const objPos = (ch, lift = 0) => { const o = G.room.objects.find((x) => x.ch === ch); return G.room.toWorld(o.c, o.r).add(new THREE.Vector3(0, lift, 0)); };

async function runMentor(d) {
  const prog = store.dprog(G.profile, d.id);
  const sp = d.mentor.id;
  zoomTo(objPos('M', 0.8), 0.5);
  if (!prog.introDone) {
    await say(sp, INTRO[d.id] || d.mentorFlow.intro);
    prog.introDone = true;
    store.save();
    if (levelsOf(d)) { await startLevel(d); return; }
  }
  if (levelsOf(d) && curLevel(d)) { await mentorHint(d); return; }
  if (levelsOf(d)) {
    // Every level is done: the mentor's closing lines, then the keyword clue or a reminder.
    if (!prog.done.mentor) { prog.done.mentor = true; store.save(); }
    if (prog.cleared && d.keySlot >= 0) {
      const c = hud.clueText(G.profile, d.keySlot);
      await say(sp, [`Your keyword clue: the ${c.slotName} shared by ${c.words.join(', ')}. ${c.length} letters.`]);
    } else await say(sp, REPEAT[d.id] || d.mentorFlow.repeat);
    return;
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
    prog.chatHeard = Math.max(prog.chatHeard || 0, prog.chat);
    store.save();
    await say(sp, lines);
    if (prog.chatHeard >= chat.length) achieve('mrphil');
  } else {
    await say(sp, d.mentorFlow.repeat);
  }
}

async function runGate(d, gz, obj) {
  const prog = store.dprog(G.profile, d.id);
  const g = d.rooms[gz].gate;
  const needOk = g.needs === 'mentor' ? (levelsOf(d) ? zoneLevelsDone(d, 0) : prog.done.mentor) : g.needs === 'terminal' ? prog.done.terminal1 : true;
  if (!needOk) { sfx.bad(); hud.toast(levelsOf(d) && g.needs === 'mentor' ? 'The firewall is sealed. Clear this zone\'s levels first.' : g.lockedMsg, 'warn'); return; }
  if (levelsOf(d) && !zoneLevelsDone(d, gz)) { sfx.bad(); hud.toast('The firewall is sealed. Clear this zone\'s levels first.', 'warn'); return; }
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
  if (levelsOf(d) && !zoneLevelsDone(d, 2)) { sfx.bad(); hud.toast('The core won\'t wake until this zone\'s levels are clear.', 'warn'); return; }
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

/** Earn an achievement (story milestones are achievements too) and announce the parts it unlocks. */
function unlockMilestone(key) {
  if (!G.profile || !store.addMilestone(G.profile, key)) return;
  const a = achievement(key);
  const parts = rewardsOf(key).map(({ part }) => `${part.icon ? `${part.icon} ` : ''}${part.name}`);
  sfx.unlock();
  hud.fanfare({ name: a ? a.name : 'Achievement', how: a ? a.how : '', rewards: parts.length ? [...parts, 'wear them at CUSTOMIZE in the Hub'] : [] });
}
const achieve = unlockMilestone;

/** A real word from a level's Extra Credit list. Mushrooms mark it now; the Lexicon waits for the set. */
function grantExtra(word, ids) {
  const hits = EXTRA_LEVELS.filter((L) => L.extra.some((e) => e.w === word));
  if (!hits.length) return false;
  let finished = false;
  let pending = false;
  for (const level of hits) {
    const before = new Set((G.profile.extra[level.id] || []).map((e) => e.w));
    const wasDone = level.extra.every((e) => before.has(e.w));
    store.noteExtra(G.profile, level.id, word, ids);
    const have = new Set((G.profile.extra[level.id] || []).map((e) => e.w));
    const nowDone = level.extra.every((e) => have.has(e.w));
    if (nowDone && !wasDone) {
      for (const e of level.extra) store.addLexicon(G.profile, e.w, e.p);
      unlockMilestone(`extra-${level.id}`);
      finished = true;
    } else if (!nowDone) pending = true;
  }
  if (EXTRA_LEVELS.length && EXTRA_LEVELS.every((L) => {
    const have = new Set((G.profile.extra[L.id] || []).map((e) => e.w));
    return L.extra.every((e) => have.has(e.w));
  })) unlockMilestone('extraAll');
  refreshObjective();
  if (finished || !pending) return 'done';
  return 'extra';
}
const ALL_MORPHEMES = Object.values(MORPHEMES).filter((m) => m.origin !== 'lingo').length;

/** Count-based achievements, checked every couple of seconds. */
setInterval(() => {
  const p = G.profile;
  if (!p) return;
  if (p.lexicon.length >= 50) achieve('lexicon50');
  if (p.lexicon.length >= 150) achieve('lexicon150');
  const known = p.learned.filter((id) => MORPHEMES[id] && morph(id).origin !== 'lingo').length;
  [[5, 'learned5'], [10, 'learned10'], [50, 'learned50'], [100, 'learned100'], [300, 'learned300']].forEach(([n, key]) => { if (known >= n) achieve(key); });
  if (known >= ALL_MORPHEMES) achieve('learnedAll');
  if (p.madeUp.length >= 3) achieve('madeup3');
  if (p.madeUp.length >= 5) achieve('madeup5');
  if (p.stats.firstTry >= 25) achieve('firsttry25');
  if (p.stats.crashes >= 1) achieve('crash');
}, 2000);

// ── Overclock Mode ────────────────────────────────────────────────

async function startTimed() {
  const origins = MAIN_ORDER.filter((d) => cleared(d));
  const learned = new Set(G.profile.learned);
  let words = allWords().filter((w) => origins.includes(w.origin) && isKnown(w.ids, learned));
  if (PRACTICE.length) { const f = words.filter((w) => w.ids.some((id) => PRACTICE.includes(id))); if (f.length >= 4) words = f; }
  const fakes = [...collectFakes().filter((f) => origins.includes(f.origin)), ...shuffle(words).slice(0, 60).map((w) => makeFake(w, null, learned)).filter(Boolean)];
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
  if (result.score >= 1000) achieve('overclock');
  const rank = store.addScore({ name: G.profile.name, score: result.score, words: result.words, t: Date.now() });
  sfx.unlock();
  screens.timedResultScreen({
    profile: G.profile, result, rank,
    onAgain: async () => { G.busy = false; await startTimed(); },
    onExit: async () => { G.busy = false; G.timed = null; await enterHub('O'); },
  });
}

// ── The finale: the Final Test (js/game/finale/) ──────────────────

/** The Rot's body in each phase: a shell, a swarm, its true form. */
const ROT_FORMS = [
  { word: 'THE ROT', scale: 1, minions: 0 },
  { word: 'THE SWARM', scale: 0.8, minions: 6 },
  { word: 'TRUE FORM', scale: 1.35, minions: 0 },
];

/**
 * The arena behind the Final Test. rush: Boss Rush from the Overclock cabinet (scored, mutated).
 * from: the dev console's { phase, beat } to start at; seed: replay a fight.
 */
async function startFinale({ rush = false, from = null, seed = undefined } = {}) {
  G.place = rush ? 'bossrush' : 'finale';
  G.finale = { rush, from, seed, boss: null, minions: [], form: 0 };
  await loadRoom(FINALE_MAP, 'rot', { insideDoor: true, roomYaw: Math.PI, lookYaw: Math.PI, makeObject: (ch, c, r) => {
    if (ch === 'H') return { mesh: port('rot', { label: 'RETREAT', axis: 'z', color: 0x00e5ff }), walkable: true, port: () => enterHub(rush ? 'O' : '4') };
    if (ch === 'C') { G.finale.cell = { c, r }; return null; }
    return null;
  } });
  G.place = rush ? 'bossrush' : 'finale';
  const fin = G.profile.finale;
  rotForm(rush ? 0 : Math.min(2, from ? from.phase : fin.checkpoint || 0));
  refreshObjective();
  if (rush || from) { await bossFight(); return; }
  if (!fin.met) {
    fin.met = true;
    store.save();
    await say('rot', ['So. The little Morpher who glues words back together.', 'I am the Rot, and this is your final test. Three forms, nine trials. Every piece you learned, I will ask for.', 'Click me when you are ready.']);
  } else await say('rot', [fin.checkpoint ? `Back again? My ${['', 'swarm', 'true form'][fin.checkpoint]} is waiting.` : 'Back again? Click me when you are ready.']);
}

/** Swap the Rot's body for a phase: its label, its size, and the swarm's minions. */
function rotForm(p) {
  const F = G.finale;
  F.form = p;
  if (F.boss) { R.scene.remove(F.boss.entity.group); G.rotlings = G.rotlings.filter((x) => x !== F.boss); }
  F.minions.forEach((m) => { R.scene.remove(m.entity.group); G.rotlings = G.rotlings.filter((x) => x !== m); });
  F.minions = [];
  const form = ROT_FORMS[p];
  const r = spawnRotling({ p: [], show: form.word.toLowerCase() }, F.cell, { boss: true });
  r.boss = true;
  r.entity.group.scale.setScalar(form.scale);
  r.base = form.scale;
  F.boss = r;
  const ring = G.room.neighbors(F.cell.c, F.cell.r).flatMap((n) => [n, ...G.room.neighbors(n.c, n.r)]);
  const spots = ring.filter((n, i) => G.room.isWalkable(n.c, n.r) && !(n.c === F.cell.c && n.r === F.cell.r) && ring.findIndex((x) => x.c === n.c && x.r === n.r) === i);
  shuffle(spots).slice(0, form.minions).forEach((cell) => {
    const m = spawnRotling({ p: [], show: pick(['rot', 'fake', 'flip', 'typo', 'null', 'glitch']) }, cell, { boss: true });
    m.boss = true;
    m.entity.group.scale.setScalar(0.55);
    F.minions.push(m);
  });
  hud.setPlace(F.rush ? 'BOSS RUSH' : `THE ROT · ${['SHELL', 'SWARM', 'TRUE FORM'][p]}`, 3, p);
}

/** The Rot flinches at a right answer; a cleared beat knocks a chunk off it. */
function rotHit(big) {
  const r = G.finale && G.finale.boss;
  if (!r) return;
  const g = r.entity.group;
  const base = r.base || 1;
  tween(big ? 420 : 260, (k) => g.scale.setScalar(base * (1 + Math.sin(k * Math.PI) * (big ? 0.22 : 0.1))));
  if (big) {
    const fx = $('crash-fx');
    fx.classList.remove('on');
    void fx.offsetWidth;
    fx.classList.add('on');
  }
}
/** A miss: the Rot lands a hit on the Morpher. */
function rotStrikes() {
  const fx = $('crash-fx');
  fx.classList.remove('miss');
  void fx.offsetWidth;
  fx.classList.add('miss');
}

async function bossFight() {
  const F = G.finale;
  const p = G.profile;
  const fin = p.finale;
  zoomTo(F.boss.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), 0.75);
  if (F.rush) startMusic('arcade');
  const out = await runFight({
    profile: p,
    rush: F.rush,
    seed: F.seed,
    from: F.from,
    hooks: {
      onPhase: (ph) => { rotForm(ph); if (ph === 2) startMusic('arcade'); },
      onHit: (big) => rotHit(big),
      onBeat: () => { rotHit(true); if (F.boss) F.boss.base *= 0.93; },
      onMiss: () => rotStrikes(),
      onRewrite: (ph) => rotForm(ph),
      onSave: () => store.save(),
    },
  });
  F.from = null;
  F.seed = undefined;
  zoomReset();
  if (out.retreat) {
    startMusic('rot');
    hud.toast(F.rush ? 'Boss Rush ended. That run was not scored.' : `You fell back. ${fin.checkpoint ? `Next time you start at phase ${fin.checkpoint + 1}.` : 'The Rot is waiting.'}`, 'warn');
    return;
  }
  // Won.
  const pct = overallPercent(out.results);
  const first = !fin.beaten;
  fin.runs = (fin.runs || 0) + 1;
  if (!F.rush) {
    const run = { pct, skills: skillPercents(out.results), seconds: out.seconds, misses: out.misses, rewrites: out.rewrites, t: Date.now() };
    fin.last = run;
    if (!fin.best || pct > fin.best.pct || (pct === fin.best.pct && out.seconds < fin.best.seconds)) fin.best = run;
    fin.beaten = true;
  }
  store.save();
  if (F.boss) removeRotling(F.boss);
  F.minions.forEach(removeRotling);
  F.boss = null;
  F.minions = [];
  sfx.crit();
  const rank = F.rush ? store.addBossScore({ name: p.name, score: out.score, pct, t: Date.now() }) : -1;
  await new Promise((res) => screens.finalResultsScreen({ profile: p, out, pct, rush: F.rush, rank, onDone: res }));
  if (!F.rush) unlockMilestone('finale');
  if (out.misses === 0) unlockMilestone('flawless');
  if (F.rush && out.score >= BOSS_RUSH_GOAL) unlockMilestone('bossrush');
  if (!F.rush && first) {
    hud.showHud(false);
    await new Promise((res) => screens.endingScreen({ profile: p, onDone: res }));
    hud.showHud(true);
  }
  await enterHub(F.rush ? 'O' : '4');
}
const BOSS_RUSH_GOAL = 3500;

/** The Overclock cabinet: Rotling Rush always; Boss Rush once the Rot is beaten. */
async function useOverclock() {
  if (!G.profile.finale.beaten) { await startTimed(); return; }
  const mode = await screens.overclockMenu();
  if (mode === 'rotlings') await startTimed();
  else if (mode === 'boss') await startFinale({ rush: true });
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
    onWarp: G.place === 'ticket' ? null : (s) => warpTo(s),
    // Warping mid-conversation would leave that scene waiting in the room being left.
    warpBlocked: G.busy || dialogueOpen() || panelOpen(),
  });
}

// ── Warp codes (pause menu; the codes are in core/warp.js) ────────

const levelIdsOf = (L) => L.flatMap((l) => [...l.earn, ...Object.values(l.with || {}).flat()]);
function learnIds(ids) {
  const before = G.profile.learned.length;
  store.learn(G.profile, ids.filter((id) => MORPHEMES[id]));
  hud.renderInventory(G.profile);
  return G.profile.learned.length - before;
}

/** Mark a room cleared: every level, firewall and the core done, its morphemes and keyword clue earned. No achievement. */
function fillRoom(id) {
  const d = DISTRICTS[id];
  const p = store.dprog(G.profile, id);
  const last = d.rooms.length - 1;
  p.introDone = true;
  p.level = (LEVELS[id] || []).length;
  p.lv = null;
  Object.assign(p.done, { mentor: true, gate0: true, terminal1: true, gate1: true, [`link${last}`]: true, [`newword${last}`]: true, [`core${last}`]: true });
  p.cleared = true;
  p.waveCleared = true;
  learnIds(levelIdsOf(LEVELS[id] || []));
  if (d.keySlot >= 0) G.profile.clues[d.keySlot] = true;
}

/** Put a room at the start of level i: the earlier levels' morphemes earned, the firewalls before it open. */
function setLevel(id, i) {
  const L = LEVELS[id];
  const p = store.dprog(G.profile, id);
  p.introDone = true;
  p.level = i;
  p.lv = null;
  p.cleared = false;
  learnIds(levelIdsOf(L.slice(0, i)));
  const z = levelZone(i, L.length);
  if (z >= 1) p.done.gate0 = true;
  if (z >= 2) { p.done.terminal1 = true; p.done.gate1 = true; p.waveCleared = true; }
}

/**
 * Send the Morpher to a warp code's section. Rooms before it are cleared (no achievements),
 * Noam's Hub scenes for them count as seen, and the target room restarts at the start or the level.
 */
async function warpTo(s) {
  const p = G.profile;
  const h = hubState();
  const CAP = { anglo: 'Anglo', latin: 'Latin', greek: 'Greek' };
  const main = MAIN_ORDER.includes(s.room);
  const upTo = main ? MAIN_ORDER.indexOf(s.room) : MAIN_ORDER.length;
  h.intro = true;
  MAIN_ORDER.slice(0, upTo).forEach((r) => {
    if (!cleared(r)) fillRoom(r);
    h[`cleared${CAP[r]}`] = true;
    if (r !== 'anglo') h[`said${CAP[r]}`] = true;
  });
  if (upTo > 0 || s.level > 0) h.lab = true;
  if (main && s.room !== 'anglo') h[`said${CAP[s.room]}`] = true;
  if (upTo === MAIN_ORDER.length) h.desk = true;
  if (main) {
    delete p.districts[s.room];
    if (s.level !== null) setLevel(s.room, s.level);
  }
  if (s.room === 'lingo') p.deskOpen = true;
  store.save();
  hud.renderInventory(p);
  screens.closeAllScreens();
  if (s.room === 'finale') await startFinale();
  else {
    await enterRoom(s.room, '@');
    if (s.level !== null) await startLevel(DISTRICTS[s.room]);
  }
  hud.toast(`Warped to ${s.label}`, 'gold');
}

// ── Exit Ticket practice ──────────────────────────────────────────

/**
 * The focused session behind the teacher's Exit Ticket link: today's morphemes on a lesson
 * card, then BUILD and DEBUG rounds built only from them, until the timer ends. Closing a
 * round asks whether to finish early. Then the exit ticket, as in any class session.
 */
async function startTicket(p) {
  G.profile = p;
  G.titleSpin = false;
  unlockAudio();
  session.beginSession(p, SESSION_MINS);
  session.setFocus(PRACTICE);
  G.sessionOver = false;
  hud.showHud(true);
  hud.renderInventory(p);
  hud.renderLog(p);
  resetView();
  G.place = 'ticket';
  await loadRoom(TIMED_MAP, 'arcade', {});
  G.place = 'ticket';
  hud.setPlace('EXIT TICKET PRACTICE');
  const deck = buildDeck(PRACTICE, p.learned);
  if (!deck.length) {
    hud.toast('No practice words for these lessons yet, so the full game is open instead.', 'warn');
    await startProfile(p);
    return;
  }
  G.ticket = { done: 0, first: 0 };
  refreshObjective();
  // The appetizer: earn up to six of today's new morphemes by playing their minigames.
  // The rest (and anything already earned) go on one card, so building starts within a few minutes.
  const fresh = PRACTICE.filter((id) => !p.learned.includes(id));
  for (const id of fresh.slice(0, 6)) {
    if (G.place !== 'ticket' || G.sessionOver) return;
    const res = await playMinigame(id, { tier: 1 });
    if (!res.won) break;
    store.learn(p, [id]);
    hud.renderInventory(p);
  }
  const rest = PRACTICE.filter((id) => !p.learned.includes(id));
  if (rest.length) await showLesson({ ids: rest.slice(0, 12), profile: p, title: 'MORE OF TODAY\'S MORPHEMES', note: 'Read each morpheme and its meaning. Then build with them until the timer ends.' });
  store.learn(p, PRACTICE);
  hud.renderInventory(p);
  const next = rounds(deck, new Set([...PRACTICE, ...p.learned]));
  while (G.place === 'ticket' && !G.sessionOver) {
    const left = session.secondsLeft();
    if (left !== null && left <= 0) break;
    const r = next();
    let solved = false;
    let firstTry = false;
    if (r.kind === 'compile') {
      const res = await openCompile({ mode: 'compile', tasks: [r.task], profile: p, pool: PRACTICE, title: 'EXIT TICKET · BUILD THE WORD THAT MEANS',
        onSolved: (_, info) => { firstTry = !!(info && info.firstTry); } });
      solved = res.done > 0;
    } else {
      const res = await openDebug({ item: r.item, profile: p, mode: 'rotling', title: 'EXIT TICKET · SPLIT IT, THEN CALL IT' });
      solved = res.solved;
      firstTry = res.firstTry;
    }
    if (G.place !== 'ticket' || G.sessionOver) return;
    if (!solved) {
      const stop = await screens.confirmBox('Finish practice now and get your exit ticket?', 'Get my exit ticket', 'Keep practising');
      if (stop) break;
      continue;
    }
    G.ticket.done += 1;
    if (firstTry) G.ticket.first += 1;
    refreshObjective();
  }
  if (G.place === 'ticket') showExitTicket((session.secondsLeft() ?? 1) <= 0);
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
  if (!G.profile || G.sessionOver) return;
  const ticket = session.endSession();
  G.sessionOver = true;
  achieve('session');
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
G.dieLanded = (n) => dieLanded(n);

export { G };

// ── Dev console (hidden: hold 1 + 0; see dev/console.js) ──────────────

function devApi() {
  const dp = (id) => store.dprog(G.profile, id);
  const levelIds = levelIdsOf;
  const clearRoom = (id) => {
    fillRoom(id);
    store.addMilestone(G.profile, id);
    store.save();
  };
  const famRows = () => Object.values(FAMILIES).flatMap((f) => (Array.isArray(f.members) ? f.members : Object.values(f.members).flat()).map((id) => [id, f.id]));
  return {
    G,
    /** Make sure a Morpher is loaded: the last one played, or a new "Dev" Morpher who has met Noam. */
    async ensure() {
      if (G.profile && G.place !== 'title') return;
      let p = store.active() || store.profiles().find((x) => x.name === 'Dev');
      if (!p) {
        if (!store.canAddProfile()) p = store.profiles()[0];
        else { p = store.newProfile('Dev', { limbs: 'l-steel', torso: 't-red', head: 'h-steel', face: 'f-smile' }); p.hub = { intro: true }; store.save(); }
      }
      store.setActive(p.id);
      screens.closeAllScreens();
      await startProfile(p);
    },
    profile: () => G.profile,
    levels: (id) => LEVELS[id] || [],
    morph: (id) => MORPHEMES[id],
    familyOf: (id) => FAMILY_OF[id] || 'generic',
    enterHub: () => enterHub(),
    /** Visual only. The save's leaves, flowers, and mushrooms come back with previewGarden(false). */
    previewGarden(on) {
      G.gardenPreview = !!on;
      refreshObjective();
      if (!on) { zoomReset(); resetView(); return; }
      const tree = G.room && G.room.objects.find((o) => o.ch === 'L');
      if (!tree) return;
      R.rig.pitch = 1.05;
      zoomTo(G.room.toWorld(tree.c, tree.r), 2.8);
    },
    enterRoom: (id) => enterRoom(id, '@'),
    /** Play the level's opening as the game would (mentor line, nodes, toast). */
    beginLevel: (id) => startLevel(DISTRICTS[id]),
    prepRoom(id) { hubState().intro = true; store.save(); },
    jumpLevel(id, i) {
      const L = LEVELS[id];
      if (!L) throw new Error(`${id} has no levels.`);
      MAIN_ORDER.slice(0, MAIN_ORDER.indexOf(id)).forEach((r) => { if (!cleared(r)) clearRoom(r); });
      const h = hubState();
      h.intro = true;
      h.lab = true;
      setLevel(id, i);
      store.save();
    },
    async setPhase(ph) {
      const d = DISTRICTS[G.place];
      if (!d || !LEVELS[d.id]) throw new Error('Go into a room with levels first (goto anglo).');
      const level = curLevel(d);
      if (!level) throw new Error('This room\'s levels are all done.');
      const prog = dp(d.id);
      const lv = levelState(prog);
      if (ph === 'earn') { lv.phase = 'earn'; lv.earned = []; lv.built = 0; spawnLevel(d); }
      else {
        learnIds([...level.earn, ...Object.values(level.with || {}).flat()]);
        lv.earned = [...level.earn];
        if (ph === 'build') { lv.phase = 'build'; lv.built = 0; spawnLevel(d); }
        else if (ph === 'dessert') { lv.built = buildTasks(level).length; serveDessert(d); }
        else if (ph === 'done') { G.rotlings.filter((r) => r.dessert !== undefined).forEach(removeRotling); await completeLevel(d); }
      }
      store.save();
      refreshObjective();
    },
    earn(args) {
      const what = (args[0] || '').toLowerCase();
      if (what === 'all') return learnIds(Object.keys(MORPHEMES).filter((id) => MORPHEMES[id].origin !== 'lingo'));
      if (LEVELS[what]) return learnIds(levelIds(LEVELS[what]));
      const bad = args.filter((id) => !MORPHEMES[id]);
      if (bad.length) throw new Error(`Not morphemes: ${bad.join(', ')}`);
      return learnIds(args);
    },
    unlock(what) {
      const h = hubState();
      h.intro = true;
      h.lab = true;
      if (what === 'all') {
        MAIN_ORDER.forEach(clearRoom);
        Object.assign(h, { desk: true, clearedAnglo: true, clearedLatin: true, clearedGreek: true, saidLatin: true, saidGreek: true });
      } else MAIN_ORDER.slice(0, MAIN_ORDER.indexOf(what)).forEach((r) => { if (!cleared(r)) clearRoom(r); });
      store.save();
    },
    clearRoom,
    reset(what) {
      const p = G.profile;
      if (what === 'hub') p.hub = {};
      else if (what === 'all') Object.assign(p, { hub: {}, districts: {}, learned: [], lexicon: [], log: [], clues: [false, false, false], deskOpen: false });
      else delete p.districts[what];
      store.save();
      hud.renderInventory(p);
    },
    playMinigame: (id, tier) => playMinigame(id, { tier }),
    gameList(which) {
      const rows = famRows();
      if (which === 'all') return rows.map(([id]) => id);
      if (which && FAMILIES[which]) return rows.filter(([, f]) => f === which).map(([id]) => id);
      if (which) return [];
      // One per family and per variant: Suffix shop and Everyday base by sub, the rest by distinct meaning.
      const out = [];
      Object.values(FAMILIES).forEach((f) => {
        if (!Array.isArray(f.members)) { Object.values(f.members).forEach((ids) => out.push(ids[0])); return; }
        const seen = new Set();
        f.members.forEach((id) => { const m = MORPHEMES[id].meaning; if (!seen.has(m)) { seen.add(m); out.push(id); } });
      });
      return out;
    },
    familyList() {
      return Object.values(FAMILIES).map((f) => {
        const n = (Array.isArray(f.members) ? f.members : Object.values(f.members).flat()).length;
        return `  ${f.id.padEnd(10)} ${f.name.padEnd(20)} ${String(n).padStart(3)}  ${f.game}`;
      }).join('\n');
    },
    async noam(scene) {
      const h = hubState();
      const anglo1 = levelIds((LEVELS.anglo || []).slice(0, 1));
      if (scene === 'intro') G.profile.hub = {};
      else if (scene === 'lab') { delete h.lab; if (!G.profile.learned.some((id) => morph(id).origin === 'anglo')) learnIds(anglo1); }
      else if (scene === 'latin') { delete h.saidLatin; learnIds(levelIds((LEVELS.latin || []).slice(0, 1))); }
      else if (scene === 'greek') { delete h.saidGreek; learnIds(levelIds((LEVELS.greek || []).slice(0, 1))); }
      else if (scene === 'cleared') { delete h.clearedAnglo; delete h.clearedLatin; delete h.clearedGreek; }
      else if (scene === 'desk') { MAIN_ORDER.forEach((r) => { if (!cleared(r)) clearRoom(r); }); delete h.desk; delete h.clearedGreek; }
      else if (scene !== 'talk') throw new Error('noam intro, lab, latin, greek, cleared, desk or talk');
      store.save();
      if (scene === 'talk') {
        if (G.place !== 'hub') await enterHub();
        await say('noam', HUB.TALK(G.profile, cleared));
        return;
      }
      await enterHub();
    },
    async openLab() {
      await openCompile({ mode: 'free', profile: G.profile, title: 'WORD LAB · BUILD ANYTHING, DISCOVER NEW WORDS', onDiscover: (word, ids) => grantExtra(word, ids) });
    },
    async openDesk() {
      if (G.place === 'hub' && G.room.objects.some((o) => o.ch === 'D')) { await useDesk(); return; }
      const res = await openDesk({ profile: G.profile });
      if (res.action === 'enter') await enterRoom('lingo', '@');
    },
    startFinale: () => startFinale(),
    /** The Final Test from any beat (phase and beat 0-based), with a seed to replay; every room is cleared first. */
    async startBoss({ phase = 0, beat = 0, seed, rush = false } = {}) {
      MAIN_ORDER.forEach((r) => { if (!cleared(r)) clearRoom(r); });
      await startFinale({ rush, seed, from: rush ? null : { phase, beat } });
    },
    startTimed: () => startTimed(),
    spawnRotling(kind) {
      if (!G.room || !G.player) throw new Error('Walk into a room or the Hub first.');
      if (!['real', 'misspelled', 'reversed', 'nonword'].includes(kind)) throw new Error('rotling real, misspelled, reversed or nonword');
      const learned = new Set(G.profile.learned);
      const words = shuffle(allWords().filter((w) => isKnown(w.ids, learned)));
      let item = null;
      for (const w of words.length ? words : shuffle(allWords())) {
        item = kind === 'real' ? { p: w.ids } : fakeFor({ ids: w.ids }, kind, null);
        if (item) break;
      }
      if (!item) throw new Error(`No ${kind} Rotling could be made.`);
      const p = G.player;
      const cell = G.room.neighbors(p.c, p.r).find((n) => G.room.isWalkable(n.c, n.r) && !G.rotlings.some((r) => r.c === n.c && r.r === n.r));
      if (!cell) throw new Error('No free tile next to you.');
      spawnRotling(item, cell);
      return `${item.show || build(item.p).word} (${item.fake || 'real'})`;
    },
  };
}
initDevConsole(devApi());

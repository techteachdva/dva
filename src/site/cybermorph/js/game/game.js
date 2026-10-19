/**
 * CyberMorph's game loop and flow: places (hub, districts, Overclock Mode, the finale),
 * click-to-move, objects and what they do, district progress, the Rot meter,
 * the Secret Secretary Desk and the Lingo District.
 */

import { $, el, shuffle, pick, wait, clamp, tween } from '../core/util.js';
import { THREE, R, debugStep, toScreen, initRenderer, fitRoom, zoomTo, zoomReset, snapCamera, setBackground, pickWorld, groundPoint, onUpdate, webglAvailable } from '../engine/renderer.js';
import { buildRoom } from '../engine/diorama.js';
import { STYLES, terminal, gate, port, linkNode, newWordConsole, core, compilerConsole, avatarBooth, arcadeCabinet, secretaryDesk, lexiconTree } from '../engine/props.js';
import { createMorpher, createMentor, createRotling, createPickup } from '../engine/characters.js';
import { settings, applySettings } from '../core/settings.js';
import { sfx, startMusic, unlockAudio, speak } from '../core/audio.js';
import * as store from '../core/save.js';
import { touch, dueIds } from '../core/mastery.js';
import { DISTRICTS, MAIN_ORDER, HUB_MAP, FINALE_POOLS, KEY_POOL, collectPartWords, collectFakes } from '../data/world.js';
import { morph, MORPHEMES } from '../data/morphemes.js';
import { build } from '../compiler/wordsum.js';
import * as hud from '../ui/hud.js';
import { say, dialogueOpen } from '../ui/dialogue.js';
import * as screens from '../ui/screens.js';
import { panelOpen } from '../panels/host.js';
import { openCompile } from '../panels/compile.js';
import { openDebug } from '../panels/debug.js';
import { openLink } from '../panels/link.js';
import { openNewWord } from '../panels/newword.js';
import { showLesson } from '../panels/lesson.js';
import { openDesk } from '../panels/desk.js';

const PARAMS = new URLSearchParams(location.search);
const PRACTICE = (PARAMS.get('set') || '').split(',').map((s) => s.trim()).filter(Boolean).map((k) => (MORPHEMES[k] ? k : Object.values(MORPHEMES).find((m) => m.cat === k)?.id)).filter(Boolean);

const TIMED_MAP = ['############', '#..........#', '#..o....o..#', '#..........#', '#....@.....#', '#..........#', '#..o....o..#', '#..........#', '############'];
const FINALE_MAP = ['############', '#o........o#', '#..........#', '#..........#', '#@...C.....#', '#..........#', '#..........#', '#o........o#', '#####H######'];
const PORT_TARGET = { 1: 'anglo', 2: 'latin', 3: 'greek' };
const DISTRICT_PORT = { anglo: '1', latin: '2', greek: '3' };
const ORIGIN_COLOR = { anglo: 0xffb000, latin: 0xdfe8f5, greek: 0x38b6ff };

const G = {
  profile: null,
  place: 'title',
  roomIndex: 0,
  room: null,
  player: null,
  mentor: null,
  rotlings: [],
  pickups: [],
  carried: [],
  rot: 0,
  rotSpawned: false,
  busy: false,
  pending: null,
  keys: new Set(),
  timed: null,
  finale: null,
  tree: null,
  titleSpin: false,
};

// ── Boot ──────────────────────────────────────────────────────────

export async function boot() {
  applySettings();
  if (!webglAvailable()) {
    document.body.append(el('div', { class: 'screen' }, el('div', { class: 'sheet glass' }, el('h2', {}, 'CyberMorph needs WebGL 2'), el('p', {}, 'This browser could not start 3D graphics. Try Chrome on a Chromebook with hardware acceleration turned on (chrome://settings → System).'))));
    return;
  }
  initRenderer($('stage'));
  onUpdate({ update });
  bindInput();
  $('btn-pause').addEventListener('click', () => openPause());
  $('btn-help').addEventListener('click', () => screens.howToScreen());
  await showTitle();
  if (PARAMS.get('projector') === '1') projectorMode();
}

async function showTitle() {
  G.place = 'title';
  hud.showHud(false);
  await loadRoom(HUB_MAP, 'hub', { arrival: '@', noPlayer: true });
  G.titleSpin = true;
  startMusic('hub');
  screens.titleScreen({
    onPlay: (p) => { store.setActive(p.id); startProfile(p); },
    onNew: () => newProfileFlow(),
  });
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

async function startProfile(p, fresh = false) {
  G.profile = p;
  G.titleSpin = false;
  unlockAudio();
  hud.showHud(true);
  hud.renderInventory(p);
  hud.renderLog(p);
  const place = p.place && DISTRICTS[p.place.id] ? p.place : { id: 'hub', room: 0 };
  if (place.id === 'hub') await enterHub();
  else await enterDistrict(place.id, place.room || 0, '@');
  if (fresh) {
    await say('system', [
      `Welcome to the Lexinet, ${p.name}. You are a Morpher: a repair bot for words.`,
      'The Rot has broken our words into morphemes, the small parts that carry meaning. Rotlings made of nonsense are crawling everywhere.',
      'Click the floor to walk. Click a machine or a person to use it.',
      'Start at the amber port labeled ANGLO-SAXON: the district where the oldest English lives.',
    ]);
  }
}

function projectorMode() {
  const all = Object.values(MORPHEMES).filter((m) => m.origin !== 'lingo').map((m) => m.id);
  document.documentElement.style.setProperty('--text-scale', '1.3');
  screens.closeAllScreens();
  const fake = { learned: all, mastery: {}, stats: { tasks: 0, firstTry: 0, compiled: 0, splits: 0, bits: 0 }, lexicon: [], madeUp: [], log: [] };
  G.busy = true;
  openCompile({ mode: 'free', profile: fake, title: 'PROJECTOR MODE · MORPH COMPILER' }).then(() => location.reload());
}

// ── Rooms ─────────────────────────────────────────────────────────

let roomUpdate = null;

async function loadRoom(map, style, { arrival = '@', arrivalCell = null, noPlayer = false, makeObject = null, slide = true } = {}) {
  const S = STYLES[style];
  $('fade').classList.add('on');
  await wait(slide && G.room ? 220 : 120);
  if (G.room) {
    R.scene.remove(G.room.group);
    G.room.dispose();
  }
  G.rotlings.forEach((r) => R.scene.remove(r.entity.group));
  G.pickups.forEach((p) => R.scene.remove(p.entity.group));
  G.rotlings = [];
  G.pickups = [];
  G.mentor = null;
  G.tree = null;
  if (G.player) R.scene.remove(G.player.entity.group);
  setBackground(S.bg);
  const room = buildRoom(map, style, { makeObject });
  G.room = room;
  R.scene.add(room.group);
  fitRoom(room.W, room.H);
  zoomReset();
  snapCamera();
  startMusic(S.music);

  let cell = arrivalCell || room.marks[arrival] || room.marks['@'] || { c: 1, r: Math.floor(room.H / 2) };
  if (!noPlayer) {
    if (!G.player) G.player = makePlayer();
    G.player.entity.setAvatar(G.profile.avatar);
    placePlayer(cell);
    R.scene.add(G.player.entity.group);
  }
  $('fade').classList.remove('on');
  await room.animateIn(cell);
}

function makePlayer() {
  const entity = createMorpher(G.profile ? G.profile.avatar : { limbs: 'l-steel', torso: 't-red', head: 'h-steel', face: 'f-smile' });
  return { entity, c: 0, r: 0, path: [], pos: new THREE.Vector3(), moving: false, stepT: 0 };
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
      G.lastIgnored = { busy: G.busy, panel: panelOpen(), dialogue: dialogueOpen(), screen: screens.screenOpen(), place: G.place, swallow: performance.now() < (R.swallowUntil || 0) };
      return;
    }
    const targets = [...G.room.objects.filter((o) => o.mesh && o.use).map((o) => o.mesh), ...G.rotlings.map((r) => r.entity.group)];
    const hits = pickWorld(e.clientX, e.clientY, targets);
    if (hits.length) {
      let n = hits[0].object;
      while (n && !n.userData.obj && !n.userData.rotling) n = n.parent;
      if (n && n.userData.rotling) { walkToUse({ rotling: n.userData.rotling }); return; }
      if (n && n.userData.obj) { walkToUse({ obj: n.userData.obj }); return; }
    }
    const pt = groundPoint(e.clientX, e.clientY);
    if (!pt) return;
    // A click on the floor right under a Rotling counts as clicking the Rotling.
    const near = G.rotlings.find((r) => r.pos.distanceTo(pt) < 0.6);
    if (near) { walkToUse({ rotling: near }); return; }
    const cell = G.room.toCell(pt);
    walkTo(cell);
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat && !['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') {
      if (G.place === 'title' || panelOpen() || dialogueOpen()) return;
      if (screens.screenOpen()) return;
      e.preventDefault();
      openPause();
      return;
    }
    if (blocked() || !G.player) return;
    if (k === 'h') { screens.howToScreen(); return; }
    if (k === 'e' || k === 'enter' || k === ' ') { const near = nearestInteractable(); if (near) { e.preventDefault(); use(near); } return; }
    const dir = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] }[k];
    if (dir) {
      e.preventDefault();
      G.keys.add(k);
      if (!G.player.path.length) stepDir(dir);
    }
  });
  window.addEventListener('keyup', (e) => G.keys.delete(e.key.toLowerCase()));
}

function stepDir([dc, dr]) {
  const p = G.player;
  const n = { c: p.c + dc, r: p.r + dr };
  if (G.room.isWalkable(n.c, n.r)) { p.path = [n]; G.pending = null; }
  else {
    const obj = objectAt(n.c, n.r);
    if (obj) use({ obj });
  }
}

function objectAt(c, r) {
  const o = G.room.objects.find((x) => x.c === c && x.r === r && x.use && !x.walkable);
  if (o) return o;
  return null;
}

function walkTo(cell) {
  const p = G.player;
  G.pending = null;
  if (!G.room.isWalkable(cell.c, cell.r)) {
    const o = objectAt(cell.c, cell.r);
    if (o) { walkToUse({ obj: o }); return; }
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
  if (!path) { hud.toast('Can\'t reach that from here.', 'warn'); return; }
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
      if (o.mesh) {
        const dx = o.c - G.player.c;
        const dz = o.r - G.player.r;
        G.player.entity.group.rotation.y = Math.atan2(dx, dz);
      }
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

// ── Per-frame update ──────────────────────────────────────────────

function update(dt) {
  if (G.titleSpin) R.rig.yaw += dt * 0.05;
  if (!G.room) return;
  G.room.update(dt);
  if (G.mentor) G.mentor.update(dt);
  G.pickups.forEach((p) => p.entity.update(dt));
  G.rotlings.forEach((r) => updateRotling(r, dt));
  if (G.tree) G.tree.rotation.y += dt * 0.08;
  if (!G.player) return;
  updatePlayer(dt);
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
    const speed = 3.8;
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
  } else if (G.keys.size && !blocked()) {
    const k = [...G.keys].pop();
    const dir = { w: [0, -1], arrowup: [0, -1], s: [0, 1], arrowdown: [0, 1], a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] }[k];
    if (dir) stepDir(dir);
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
  // Pickups.
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    if (pk.c === p.c && pk.r === p.r) {
      R.scene.remove(pk.entity.group);
      G.pickups.splice(i, 1);
      G.carried.push(pk.id);
      sfx.pickup();
      hud.toast(`+ ${morph(pk.id).text}`, 'good');
      if (G.place === 'timed') { G.timed.score += 15; }
    }
  }
  // Ports.
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
  hud.setContext(label, () => use(near), 'E');
}

// ── Rotlings and pickups ──────────────────────────────────────────

function spawnRotling(item, cell, opts = {}) {
  const word = item.show || build(item.p).word;
  const entity = createRotling(word, opts);
  const r = { item, entity, c: cell.c, r: cell.r, pos: G.room.toWorld(cell.c, cell.r), target: null, wait: Math.random() * 2, frozen: false, ...opts };
  entity.group.position.copy(r.pos);
  entity.group.traverse((n) => { n.userData.rotling = r; });
  R.scene.add(entity.group);
  G.rotlings.push(r);
  return r;
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
      const options = G.room.neighbors(r.c, r.r).filter((n) => G.room.isWalkable(n.c, n.r) && !G.room.isPort(n.c, n.r) && !(n.c === G.player.c && n.r === G.player.r) && !G.rotlings.some((o) => o !== r && o.c === n.c && o.r === n.r));
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
  const res = await openDebug({ item: r.item, profile: G.profile, mode: r.boss ? 'finale' : 'rotling', realNote, title: r.review ? 'REVIEW ROTLING · a morpheme you haven\'t used in a while' : null });
  r.frozen = false;
  if (G.place === 'timed') { timedResult(r, res); return; }
  if (!res.solved) {
    if (res.mistakes) bumpBack(r);
    return;
  }
  removeRotling(r);
  sfx.split();
  dropPickups(r.item.p.filter((id) => morph(id).type !== 'link'), { c: r.c, r: r.r });
  if (r.review) { hud.toast('Review complete: morpheme restored', 'good'); return; }
  if (d && r.index !== undefined) {
    const prog = store.dprog(G.profile, G.place);
    const list = prog.rotlings[G.roomIndex] || (prog.rotlings[G.roomIndex] = []);
    if (!list.includes(r.index)) list.push(r.index);
    G.rot = Math.max(0, G.rot - 18);
    store.save();
    const left = G.rotlings.filter((x) => !x.review && x.index !== undefined).length;
    if (left === 0) {
      hud.toast('Room clear! The terminal is free.', 'good');
      if (G.place === 'lingo') prog.done[`rotlings${G.roomIndex}`] = true;
    }
  }
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
  const visible = !!(d && d.rotMeter && G.room && (live > 0 || G.rot > 0) && G.roomIndex === 1);
  hud.setRot(visible, G.rot, G.carried.length);
  if (!visible || blocked()) return;
  G.rot = clamp(G.rot + dt * 0.33 * live, 0, 100);
  if (G.rot > 50 && !G.rotSpawned) {
    G.rotSpawned = true;
    const words = collectPartWords().filter((w) => w.origin === G.place);
    const w = pick(words);
    const free = shuffle(G.room.find('.')).find((c) => G.room.isWalkable(c.c, c.r));
    if (w && free) {
      const r = spawnRotling({ p: w.ids }, free, { review: false });
      r.index = undefined;
      r.extra = true;
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
  hud.toast('SYSTEM CRASH. Rebooting at the room entrance…', 'warn');
  const spot = { c: G.player.c, r: G.player.r };
  if (G.carried.length) { dropPickups(G.carried, spot); G.carried = []; }
  G.profile.stats.crashes += 1;
  store.save();
  await wait(900);
  placePlayer(G.room.marks['@']);
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
    if (reviews) return `${reviews} review Rotling${reviews > 1 ? 's' : ''} in the Core: DEBUG them to restore fading morphemes.`;
    if (next) {
      const where = { anglo: 'the amber port labeled ANGLO-SAXON', latin: 'the grey port labeled LATIN', greek: 'the blue port labeled GREEK' }[next];
      const deskHint = p.clues.some(Boolean) && !p.deskOpen ? ' Your clue cards open something on the Secret Secretary Desk.' : '';
      return `Enter ${DISTRICTS[next].name} through ${where}.${deskHint}`;
    }
    if (!p.finale.beaten) return `All three keywords are yours. ${p.deskOpen ? '' : 'Try the Secret Secretary Desk, then '}Face the Rot through the green port labeled THE ROT.`;
    return p.deskOpen ? 'The Lexinet is restored. Try Overclock Mode, or build Made-up Words at the Morph Compiler.' : 'The Lexinet is restored. The Secret Secretary Desk is still locked…';
  }
  if (G.place === 'timed') return 'DEBUG as many Rotlings as you can before time runs out.';
  if (G.place === 'finale') return 'Click the Rot. Split its word, then compile it back clean.';
  const d = DISTRICTS[G.place];
  if (!d) return '';
  const prog = store.dprog(p, d.id);
  const room = d.rooms[G.roomIndex];
  const done = prog.done;
  const r = G.roomIndex;
  if (prog.cleared && r === d.rooms.length - 1) return 'District clear! Take the CORE port back to the hub.';
  if (r === 0) {
    if (!done.mentor) return `Talk to ${d.mentor.name}.`;
    if (room.gate && !done.gate0) return 'Click the glowing firewall to unlock it.';
    return 'Walk through the NEXT port.';
  }
  const live = G.rotlings.filter((x) => x.index !== undefined).length;
  if (room.rotlings && live) return `DEBUG the Rotlings: ${live} left. Click one to start.`;
  if (room.terminal && !done[`terminal${r}`]) return 'Use the terminal to build the bridge.';
  if (room.gate && !done[`gate${r}`]) return 'Cross the bridge and click the glowing firewall to unlock it.';
  if (room.link && !done[`link${r}`]) return 'Use the LINK node.';
  if (room.newword && !done[`newword${r}`]) return 'Open the UNKNOWN FILE console.';
  if (room.core && !done[`core${r}`]) return d.id === 'lingo' ? 'Finish the lesson at the Smart Board core.' : 'Restore the District Core.';
  if (G.roomIndex < d.rooms.length - 1) return 'Walk through the NEXT port.';
  return 'Take the CORE port back to the hub.';
}

// ── Hub ───────────────────────────────────────────────────────────

const cleared = (id) => !!(G.profile.districts[id] && G.profile.districts[id].cleared);
const portOpen = (id) => id === 'anglo' || cleared(MAIN_ORDER[MAIN_ORDER.indexOf(id) - 1]);

async function enterHub(fromPort = null) {
  G.place = 'hub';
  G.roomIndex = 0;
  G.profile.place = { id: 'hub', room: 0 };
  store.save();
  let arrivalCell = null;
  const map = HUB_MAP;
  if (fromPort) {
    const H = map.length;
    const W = map[0].length;
    map.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== fromPort) return;
      arrivalCell = { c: c === 0 ? 1 : c === W - 1 ? W - 2 : c, r: r === 0 ? 1 : r === H - 1 ? H - 2 : r };
      if (fromPort === 'D') arrivalCell = { c, r: r + 1 };
    }));
  }
  await loadRoom(map, 'hub', { arrivalCell, makeObject: hubObject });
  hud.setPlace('THE CORE');
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
  const panel = (await import('../panels/host.js')).openPanel({ dim: 0.6 });
  const done = el('button', { class: 'btn btn-primary', type: 'button' }, 'INSTALL PATCH ✔');
  panel.root.append(el('section', { class: 'glass lesson' },
    el('div', { class: 'kicker' }, `LEXINET PATCH NOTES · v1.${patch.n}`),
    el('h2', {}, `Patch 1.${patch.n}: ${p.name} restored ${list(words.slice(0, 4))}${words.length > 4 ? `, plus ${words.length - 4} more` : ''}.`),
    el('ul', { class: 'insp-list' }, fresh.slice(0, 10).map((e) => el('li', {}, el('b', {}, e.w), `: ${e.p.map((id) => morph(id).text).join(' + ')}`))),
    el('p', { style: { color: 'var(--ink-dim)' } }, `Known issues: the Rot. Words on your Lexicon Tree: ${p.lexicon.length}.`),
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
    return { mesh, walkable: true, port: () => enterDistrict(id, 0, '@') };
  }
  if (ch === '4') {
    const open = MAIN_ORDER.every(cleared);
    const mesh = port('rot', { color: 0x7dff3a, label: open ? 'THE ROT' : 'SEALED', locked: !open, axis: edgeAxis });
    if (!open) return { mesh, label: 'SEALED', use: async () => { sfx.bad(); hud.toast('Sealed. Clear all three districts to face the Rot.', 'warn'); } };
    return { mesh, walkable: true, port: () => startFinale() };
  }
  if (ch === 'L') {
    const mesh = lexiconTree();
    G.tree = mesh;
    return { mesh, label: 'VIEW', use: () => screens.lexiconPanel(G.profile) };
  }
  if (ch === 'D') {
    const mesh = secretaryDesk();
    mesh.rotation.y = 0;
    return { mesh, label: 'OPEN', use: () => useDesk(mesh) };
  }
  if (ch === 'A') return { mesh: avatarBooth('hub'), label: 'CUSTOMIZE', use: () => customize() };
  if (ch === 'O') {
    const open = G.profile.milestones.includes('anglo');
    const mesh = arcadeCabinet('OVERCLOCK', 0xff3df0, !open);
    mesh.rotation.y = -Math.PI / 2;
    return { mesh, label: open ? 'PLAY' : 'LOCKED', use: async () => { if (!open) { sfx.bad(); hud.toast('Overclock Mode unlocks when you clear the Anglo-Saxon District.', 'warn'); return; } await startTimed(); } };
  }
  if (ch === 'X') {
    const mesh = compilerConsole('hub');
    return { mesh, label: 'COMPILE', use: async () => {
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
  const words = collectPartWords().filter((w) => w.ids.some((id) => focus.includes(id)) && w.ids.every((id) => G.profile.learned.includes(id)));
  const picks = shuffle(words).slice(0, 3);
  const spots = shuffle(G.room.find('.').filter((c) => G.room.isWalkable(c.c, c.r)));
  picks.forEach((w, i) => { if (spots[i]) spawnRotling({ p: w.ids }, spots[i], { review: true }); });
  if (picks.length) hud.toast(`${picks.length} morpheme${picks.length > 1 ? 's are' : ' is'} fading. Review Rotlings appeared in the Core.`, 'gold');
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

async function useDesk(mesh) {
  zoomTo(mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)), 0.38);
  if (!G.profile.clues.some(Boolean) && !G.profile.deskOpen) {
    await say('system', ['An ornate desk with a golden plaque: SECRET SECRETARY DESK. Its drawer has three combination letter locks.', 'Each district\'s mentor holds one keyword. Collect all three.']);
  }
  const res = await openDesk({ profile: G.profile });
  if (res.opened && !G.profile.deskOpen) {
    G.profile.deskOpen = true;
    unlockMilestone('desk');
    store.save();
  }
  if (res.action === 'enter') await enterDistrict('lingo', 0, '@');
}

// ── Districts ─────────────────────────────────────────────────────

async function enterDistrict(id, roomIndex, arrival) {
  const d = DISTRICTS[id];
  G.place = id;
  G.roomIndex = roomIndex;
  G.rot = 0;
  G.rotSpawned = false;
  G.carried = [];
  G.profile.place = { id, room: roomIndex };
  const prog = store.dprog(G.profile, id);
  store.save();
  const map = d.maps[roomIndex];
  await loadRoom(map, id, { arrival, makeObject: (ch, c, r) => districtObject(d, roomIndex, ch, c, r) });
  // Restore what is already done in this room.
  if (prog.done[`terminal${roomIndex}`]) G.room.formBridge(G.room.marks['@'].r, true);
  const room = d.rooms[roomIndex];
  if (room.rotlings) {
    const killed = prog.rotlings[roomIndex] || [];
    const spots = G.room.find('R');
    room.rotlings.forEach((item, i) => {
      if (killed.includes(i)) return;
      const spot = spots[i % spots.length];
      const rr = spawnRotling(item, spot);
      rr.index = i;
    });
  }
  hud.setPlace(d.name.toUpperCase(), d.maps.length, roomIndex);
  refreshObjective();
  if (roomIndex === 0 && !prog.introDone) {
    // Start the mentor once the port transition has released the game.
    const mentor = G.room.objects.find((o) => o.ch === 'M');
    setTimeout(() => { if (!G.busy && G.place === id) use({ obj: mentor }); }, 400);
  } else if (room.rotlings && G.rotlings.length && !prog[`rotSay${roomIndex}`]) {
    prog[`rotSay${roomIndex}`] = true;
    store.save();
    const sp = d.id === 'lingo' ? 'phil' : 'system';
    const lines = room.rotlingSay || (d.rotMeter
      ? ['Rotlings! Click one to DEBUG it: cut its word at the seams, then judge it, real word or Rot fake.', 'Watch the ROT meter. Rotlings left alone make it rise. If it fills, the room crashes and you reboot at the entrance.']
      : ['Rotlings! Click one to DEBUG it: cut its word at the seams, then judge it, real word or Rot fake.']);
    await say(sp, lines);
  }
}

function districtObject(d, ri, ch, c, r) {
  const prog = store.dprog(G.profile, d.id);
  const room = d.rooms[ri];
  const style = d.id;
  const H = d.maps[ri].length;
  const axis = r === 0 || r === H - 1 ? 'z' : 'x';
  switch (ch) {
    case 'M': {
      const m = createMentor(d.mentor.id);
      G.mentor = m;
      m.group.rotation.y = Math.PI / 4;
      return { mesh: m.group, label: 'TALK', use: () => runMentor(d) };
    }
    case 'G': {
      const mesh = gate(style);
      const open = !!prog.done[`gate${ri}`];
      mesh.userData.setOpen(open);
      const o = { mesh, label: 'UNLOCK', walkable: false, use: () => runGate(d, ri, o) };
      if (open) { o.walkable = true; o.use = null; o.label = null; }
      return o;
    }
    case 'T': return { mesh: terminal(style, 'BRIDGE'), label: 'USE', use: () => runTerminal(d, ri) };
    case 'N': return { mesh: linkNode(style), label: 'LINK', use: () => runLink(d, ri) };
    case 'W': return { mesh: newWordConsole(style), label: 'OPEN', use: () => runNewWord(d, ri) };
    case 'C': {
      const mesh = core(style);
      return { mesh, label: d.id === 'lingo' ? 'FINISH' : 'RESTORE', use: () => runCore(d, ri), update: (dt) => { mesh.userData.spin.rotation.y += dt; mesh.userData.rings[0].rotation.z += dt * 0.7; mesh.userData.rings[1].rotation.y += dt * 1.1; } };
    }
    case 'R': return { walkable: true };
    case 'E': return { mesh: port(style, { label: 'NEXT', axis }), walkable: true, port: () => enterDistrict(d.id, ri + 1, '@') };
    case 'B': return { mesh: port(style, { label: 'BACK', axis }), walkable: true, port: () => enterDistrict(d.id, ri - 1, '&') };
    case 'H': {
      const toHub = ri === 0 || prog.cleared;
      const mesh = port(style, { label: toHub ? 'CORE' : 'LOCKED', locked: !toHub, axis, color: 0x00e5ff });
      if (!toHub) return { mesh, label: 'LOCKED', use: async () => { sfx.bad(); hud.toast('This port opens when the district is clear.', 'warn'); } };
      return { mesh, walkable: true, port: () => enterHub(d.id === 'lingo' ? 'D' : DISTRICT_PORT[d.id]) };
    }
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

async function runMentor(d) {
  const prog = store.dprog(G.profile, d.id);
  const sp = d.mentor.id;
  if (G.mentor) zoomTo(G.room.toWorld(G.room.objects.find((o) => o.ch === 'M').c, G.room.objects.find((o) => o.ch === 'M').r).add(new THREE.Vector3(0, 0.8, 0)), 0.5);
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
    const start = prog.batchTask || 0;
    const tasks = b.tasks.slice(start);
    const res = await openCompile({
      mode: b.kind === 'unpack' ? 'unpack' : 'compile',
      tasks,
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
  } else {
    await say(sp, d.mentorFlow.repeat);
  }
}

async function runGate(d, ri, obj) {
  const prog = store.dprog(G.profile, d.id);
  const g = d.rooms[ri].gate;
  const needOk = g.needs === 'mentor' ? prog.done.mentor : g.needs === 'terminal' ? prog.done[`terminal${ri}`] : true;
  if (!needOk) { sfx.bad(); hud.toast(g.lockedMsg, 'warn'); return; }
  zoomTo(G.room.toWorld(obj.c, obj.r), 0.55);
  if (!prog[`gateSay${ri}`]) { await say(d.mentor.id === 'phil' ? 'phil' : 'system', g.say); prog[`gateSay${ri}`] = true; }
  const key = `gateTask${ri}`;
  const res = await openCompile({ mode: 'patch', tasks: g.tasks.slice(prog[key] || 0), profile: G.profile, pool: poolFor(d), onSolved: () => { prog[key] = (prog[key] || 0) + 1; store.save(); } });
  if (res.done < res.total) return;
  prog.done[`gate${ri}`] = true;
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

async function runTerminal(d, ri) {
  const prog = store.dprog(G.profile, d.id);
  const t = d.rooms[ri].terminal;
  if (G.rotlings.some((r) => r.index !== undefined)) { sfx.bad(); hud.toast(t.lockedMsg, 'warn'); return; }
  if (prog.done[`terminal${ri}`]) { hud.toast('The bridge is already up.'); return; }
  const tObj = G.room.objects.find((o) => o.ch === 'T');
  zoomTo(G.room.toWorld(tObj.c, tObj.r), 0.55);
  await teach(t.teach, t.tasks);
  if (!prog[`termSay${ri}`]) { await say('system', t.say); prog[`termSay${ri}`] = true; }
  const key = `termTask${ri}`;
  const res = await openCompile({ mode: 'compile', tasks: t.tasks.slice(prog[key] || 0), profile: G.profile, pool: poolFor(d), onSolved: () => { prog[key] = (prog[key] || 0) + 1; store.save(); } });
  if (res.done < res.total) return;
  prog.done[`terminal${ri}`] = true;
  store.save();
  bankCarried();
  G.room.formBridge(G.room.marks['@'].r);
  G.rot = 0;
  sfx.bridge();
  hud.toast('Data bridge online!', 'good');
}

async function runLink(d, ri) {
  const prog = store.dprog(G.profile, d.id);
  const link = d.rooms[ri].link;
  if (prog.done[`link${ri}`]) { hud.toast('Already linked. Nice tree.'); return; }
  const n = G.room.objects.find((o) => o.ch === 'N');
  zoomTo(G.room.toWorld(n.c, n.r), 0.55);
  if (!prog[`linkSay${ri}`]) { await say(d.id === 'lingo' ? 'phil' : 'system', link.say); prog[`linkSay${ri}`] = true; }
  const res = await openLink({ link, profile: G.profile });
  if (!res.solved) return;
  prog.done[`link${ri}`] = true;
  link.bases.forEach((b) => b.words.forEach((w) => { if (b.id) store.addLexicon(G.profile, w, [b.id]); }));
  store.save();
  hud.toast('Families linked!', 'good');
}

async function runNewWord(d, ri) {
  const prog = store.dprog(G.profile, d.id);
  const item = d.rooms[ri].newword;
  if (prog.done[`newword${ri}`]) { hud.toast(`Solved: ${item.w}.`); return; }
  const w = G.room.objects.find((o) => o.ch === 'W');
  zoomTo(G.room.toWorld(w.c, w.r), 0.55);
  if (item.teachFirst) await teach(item.teachFirst, [], 'Two new Greek pieces before the case.');
  const res = await openNewWord({ item, profile: G.profile });
  if (!res.solved) return;
  prog.done[`newword${ri}`] = true;
  if (d.id !== 'lingo') store.addLexicon(G.profile, item.w, item.p);
  store.save();
  hud.toast('Case closed!', 'good');
}

async function runCore(d, ri) {
  const prog = store.dprog(G.profile, d.id);
  const c = d.rooms[ri].core;
  if (prog.done[`core${ri}`]) { hud.toast('The core is already restored.'); return; }
  const missing = (c.needs || []).filter((k) => !prog.done[`${k}${ri}`] && !(k === 'rotlings' && !G.rotlings.some((r) => r.index !== undefined)));
  if (missing.length) { sfx.bad(); hud.toast(c.lockedMsg, 'warn'); return; }
  const cObj = G.room.objects.find((o) => o.ch === 'C');
  zoomTo(G.room.toWorld(cObj.c, cObj.r).add(new THREE.Vector3(0, 0.6, 0)), 0.5);
  await teach(c.teach, c.tasks);
  if (!prog.coreSay) { await say(d.mentor.id === 'phil' ? 'phil' : 'system', c.say); prog.coreSay = true; }
  const key = `coreTask${ri}`;
  const res = await openCompile({ mode: c.kind === 'unpack' ? 'unpack' : 'compile', tasks: c.tasks.slice(prog[key] || 0), profile: G.profile, pool: poolFor(d), onSolved: (t) => { prog[key] = (prog[key] || 0) + 1; if (c.kind === 'unpack') store.learn(G.profile, t.p); store.save(); } });
  if (res.done < res.total) return;
  prog.done[`core${ri}`] = true;
  prog.cleared = true;
  store.save();
  bankCarried();
  sfx.unlock();
  await say(d.mentor.id, c.outro);
  if (d.keySlot >= 0) {
    G.profile.clues[d.keySlot] = true;
    const clue = hud.clueText(G.profile, d.keySlot);
    await say('system', [`KEYWORD ${d.keySlot + 1} RECEIVED. It is a ${clue.slotName} with ${clue.length} letters: the ${clue.slotName} shared by ${clue.words.join(', ')}.`, 'Clue cards live in the CLUES tab of your inventory. Something in the Core is waiting for all three.']);
    hud.toast(`Keyword ${d.keySlot + 1} clue added to CLUES`, 'gold');
  }
  unlockMilestone(d.id);
  store.save();
  // Re-open the hub port in this room.
  const hObj = G.room.objects.find((o) => o.ch === 'H');
  if (hObj) {
    G.room.group.remove(hObj.mesh);
    const fresh = districtObject(d, ri, 'H', hObj.c, hObj.r);
    delete hObj.use; // the locked port's "not yet" handler
    delete hObj.label;
    Object.assign(hObj, fresh);
    hObj.mesh.position.copy(G.room.toWorld(hObj.c, hObj.r));
    hObj.mesh.traverse((n) => { n.userData.obj = hObj; });
    G.room.group.add(hObj.mesh);
    G.room.setBlocked(hObj.c, hObj.r, false);
  }
}

function unlockMilestone(key) {
  if (store.addMilestone(G.profile, key)) hud.toast('New Morpher parts unlocked! Visit CUSTOMIZE in the Core.', 'gold');
}

// ── Overclock Mode ────────────────────────────────────────────────────

async function startTimed() {
  const origins = MAIN_ORDER.filter((d) => G.profile.milestones.includes(d));
  let words = collectPartWords().filter((w) => origins.includes(w.origin));
  if (PRACTICE.length) { const f = words.filter((w) => w.ids.some((id) => PRACTICE.includes(id))); if (f.length >= 4) words = f; }
  const fakes = collectFakes().filter((f) => origins.includes(f.origin));
  G.place = 'timed';
  G.timed = { t: 120, score: 0, words: 0, first: 0, attempts: 0, streak: 0, bestStreak: 0, spawn: 0, pool: words, fakes, over: false };
  await loadRoom(TIMED_MAP, 'arcade', {});
  hud.setPlace('OVERCLOCK MODE');
  const timer = el('div', { class: 'timer glass', id: 'timed-clock' }, '2:00');
  $('hud').append(timer);
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
  const entry = { name: G.profile.name, score: result.score, words: result.words, t: Date.now() };
  const rank = store.addScore(entry);
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
  hud.setPlace('THE ROT', 3, 0);
  spawnBoss();
  refreshObjective();
  await say('rot', ['So. The little Morpher who glues words back together.', 'I am the Rot. I am every word that never held. Split me if you can.']);
}

function spawnBoss() {
  const ids = G.finale.words[G.finale.stage];
  const r = spawnRotling({ p: ids }, G.finale.cell, { boss: true });
  r.boss = true;
  r.entity.group.scale.setScalar(1);
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
    screens.confirmBox('End this Overclock Mode run now?', 'End run', 'Keep playing').then((yes) => { if (yes) { G.timed.t = 0; } });
    return;
  }
  screens.pauseScreen({
    profile: G.profile,
    onResume: () => {},
    onQuit: async () => { store.save(); G.player && R.scene.remove(G.player.entity.group); G.player = null; G.profile = null; screens.closeAllScreens(); await showTitle(); },
    onLexicon: () => screens.lexiconPanel(G.profile),
    onAvatar: () => customize(),
  });
}

// Debug hook for playtests: window.__cybermorph in the console.
window.__cybermorph = G;
G.step = debugStep;
G.R = R;
G.toScreen = toScreen;
G.walkToUse = (t) => walkToUse(t);
G.walkTo = (c) => walkTo(c);

export { G };

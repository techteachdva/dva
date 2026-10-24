/**
 * Tech Escape - entry point and game state machine.
 *
 * Boot order: renderer -> settings -> title screen. A run builds a fresh maze,
 * scatters the terminals, printer, exit, tables and loot, then hands control to
 * the update loop. Menus and minigames slow world time rather than freezing it,
 * which is what keeps a quiz tense.
 */

import * as THREE from '../vendor/three.module.js';

import {
  CELL, DIFFICULTY, COLORS, PLAYER, PICKUP, QUIZ, DECRYPT, PRINTER, CODE_PARTS, NOTIFY, MOBILE,
  resolveQuality,
} from './config.js';
import { clamp, makeRng, formatTime, guessDeviceIp } from './util.js';
import { input, touchUi } from './input.js?v=3.25';
import { audio } from './audio.js?v=3.10';
import { ui } from './ui.js?v=3.26';
import { Maze } from './world/maze.js?v=3.27';
import { Lab } from './world/lab.js?v=3.18';
import { planLabFurniture, placeLootSpot } from './world/layout.js';
import { TableSurfacePlanner } from './world/table-surface.js';
import { buildScatterProps } from './world/scatter.js';
import { pickPosterCells } from './world/map-poster.js';
import { Lighting } from './world/lighting.js?v=3.10';
import { Player } from './entities/player.js?v=3.15';
import { EnemyManager } from './entities/enemies.js?v=3.25';
import { PickupField } from './entities/pickups.js?v=3.25';
import { ThrowField } from './entities/throwables.js?v=3.25';
import { Inventory } from './entities/inventory.js';
import { disposeModels } from './entities/models.js?v=3.25';
import { Quiz } from './minigames/quiz.js?v=3.21';
import { Decrypt } from './minigames/memory.js';
import { TwoTruths } from './minigames/twoTruths.js?v=3.21';
import { TERMINALS, QUESTION_COUNT } from './data/questions.js?v=3.9.1';
import { drawTwoTruths, TWO_TRUTHS_COUNT } from './data/twoTruths.js?v=3.7';
import { drawForTerminal, idsOf } from './meta/quizpool.js?v=3.9.1';
import { saveStore } from './meta/save.js?v=3.9.1';
import { settings, flashGuard } from './meta/settings.js?v=3.21';
import { getLevel, layoutFor, runProfile } from './meta/levels.js';
import { sessionUi } from './meta/session-ui.js?v=3.26';
import { bindUi } from './meta/bind-ui.js?v=3.25';
import { debug, DEBUG_CODE } from './meta/debug.js';
import { computeRunScore } from './meta/score.js';
import { highscoresUi } from './meta/highscores-ui.js?v=3.26';
import { BootSequence, bootShouldRush } from './ui/boot.js?v=3.21';
import { ScopeOpening } from './ui/opening.js?v=3.12';
import { startPauseScope } from './ui/pause-rise.js?v=3.3';
import { createShatter, drawShatter } from './ui/death-shatter.js?v=3.27';
import { captions } from './ui/captions.js?v=3.25';
import { tutorial } from './ui/tutorial.js?v=3.26';
import { coach } from './ui/coach.js?v=3.26';
import { threatSector, threatPan } from './threat-direction.js';

function agentLabel() {
  const ua = navigator.userAgent || '';
  let browser = 'BROWSER';
  const chrome = ua.match(/Chrome\/(\d+)/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  if (/Edg\//.test(ua)) browser = 'EDGE';
  else if (chrome) browser = `CHROME ${chrome[1]}`;
  else if (firefox) browser = `FIREFOX ${firefox[1]}`;
  else if (/Safari\//.test(ua)) browser = 'SAFARI';
  if (/CrOS/i.test(ua)) return `${browser} CROS`;
  if (/Windows/i.test(ua)) return `${browser} WIN`;
  if (/Mac OS/i.test(ua)) return `${browser} MAC`;
  if (/Android/i.test(ua)) return `${browser} ANDROID`;
  return browser;
}

const MODE = {
  LOADING: 'loading',
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  QUIZ: 'quiz',
  DECRYPT: 'decrypt',
  NOTIFY: 'notify',
  PRINTER: 'printer',
  OVER: 'over',
  WIN: 'win',
};

const INTERACT_RANGE = 2.6;
const THROW_AIM_RANGE = 22;
const THROW_AIM_DOT = 0.68;
const FRAGMENT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

class Game {
  constructor() {
    this.mode = MODE.LOADING;
    this._halting = null;
    this._halt = 1;
    this._pauseTimers = [];
    this._stopPauseScope = null;
    this._dying = false;
    this._death = null;
    this._phoneRinging = false;
    this._phoneItem = null;
    this._phoneWait = 0;
    this._phoneBuzz = 0;
    this.levelIndex = 0;
    this._invUiRev = -1;
    this.settings = {
      sensitivity: 80,
      quality: 'medium',
      brightness: 130,
      muted: false,
      reduceFx: false,
      difficulty: 'normal',
    };

    this.clock = { last: 0, elapsed: 0 };
    this.world = null;
    this.expectUnlock = false;
    this.terminalCooldowns = [0, 0, 0, 0];

    this.quiz = new Quiz();
    this.decrypt = new Decrypt();
    this.notify = new TwoTruths();
    this._notifyTimer = null;
    this._notifyGap = 0;
    this._mouseFrame = null;
  }

  // ================================================================== boot

  async boot() {
    ui.init();
    settings.load();
    captions.init();
    saveStore.init();
    debug.init();
    this._loadSettings();

    const canvas = document.getElementById('scene');
    if (!this._initRenderer(canvas)) return;

    input.init(canvas);
    input.applyBinds(settings.get('binds'));
    touchUi.setPauseHook(() => {
      if (this.mode === MODE.PLAYING) this.pause();
    });
    sessionUi.bind(this);
    bindUi.init();
    highscoresUi.init();
    tutorial.init();
    coach.init();
    this.notify.bindDismiss();
    settings.onChange((k) => {
      if (k === 'binds') input.applyBinds(settings.get('binds'));
    });
    this._applySettings();

    this._bindUi();
    this._bindDebug();
    await this._bootSequence();
    ui.showScreen(null);

    sessionUi.noteReveal();
    await sessionUi.enterLobby();
    this._startLoop();
  }

  _initRenderer(canvas) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        powerPreference: 'default',
        alpha: false,
        stencil: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err) {
      ui.fatalError(
        'This browser could not start WebGL, which Tech Escape needs for 3D. '
        + `The browser reported: ${err?.message || err}`,
      );
      return false;
    }

    const gl = renderer.getContext();
    if (!gl) {
      ui.fatalError('WebGL is unavailable, so the 3D lab cannot be drawn.');
      return false;
    }

    renderer.setClearColor(COLORS.fog, 1);
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.NoToneMapping;
    this.renderer = renderer;

    // Reported on the title screen so a teacher can see what a device is using
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    this._rendererName = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).slice(0, 42)
      : 'WebGL';
    this._softwareRenderer = /swiftshader|llvmpipe|softpipe|basic render/i.test(this._rendererName);
    if (this._softwareRenderer) this.settings.quality = 'low';

    canvas.addEventListener('webglcontextlost', (ev) => {
      ev.preventDefault();
      this._contextLost = true;
      document.getElementById('gfx-stall')?.classList.remove('hidden');
      if (this.mode === MODE.PLAYING) this.pause();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this._contextLost = false;
      document.getElementById('gfx-stall')?.classList.add('hidden');
      this._recoverGraphics();
    });

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.08, 140);
    this.scene.add(this.camera);

    window.addEventListener('resize', () => this._resize());
    this._resize();
    return true;
  }

  _qualityNow() {
    const key = input.touchMode ? MOBILE.autoQuality : (this.settings.quality || 'medium');
    return resolveQuality(key, { software: !!this._softwareRenderer });
  }

  _applyTone(q) {
    if (!this.renderer) return;
    if (q.toneMapping === 'aces') {
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
    } else {
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1;
    }
    this.renderer.shadowMap.enabled = !!q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  /** Compile the lab, including the flashlight, before the player can press F. */
  async _prewarm(lighting, player) {
    const el = document.getElementById('gfx-warm');
    el?.classList.remove('hidden');
    const prev = lighting.flashlight.intensity;
    lighting.flashlight.intensity = 36;
    this.camera.position.copy(player.pos);
    this.camera.rotation.set(player.pitch || 0, player.yaw || 0, 0, 'YXZ');
    try {
      this.renderer.compile(this.scene, this.camera);
      for (let i = 0; i < 2; i++) {
        this.renderer.render(this.scene, this.camera);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    } catch (err) {
      console.warn('Shader prewarm failed', err);
    }
    lighting.flashlight.intensity = prev;
    lighting._flashLevel = 0;
    el?.classList.add('hidden');
  }

  _recoverGraphics() {
    if (!this.renderer) return;
    this._resize();
    this.scene.traverse((obj) => {
      if (obj.isInstancedMesh && obj.instanceMatrix) obj.instanceMatrix.needsUpdate = true;
      const mats = obj.material ? [].concat(obj.material) : [];
      for (const m of mats) {
        if (m.map) m.map.needsUpdate = true;
        m.needsUpdate = true;
      }
    });
    try { this.renderer.compile(this.scene, this.camera); } catch { /* restored next frame */ }
    if (this.world?.player) this.world.player._rememberSafe();
    ui.toast('Graphics came back. Click RESUME if the lab paused.', 'warn', 4200);
  }

  _resize() {
    if (!this.renderer) return;
    const q = this._qualityNow();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr) * q.scale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Oscilloscope, then the terminal log, then the lobby.
   * The WebGL renderer is already up. This sequence only draws the canvas
   * layer and reports what that renderer, and the machine, actually are.
   */
  async _bootSequence() {
    const forceFull = new URLSearchParams(location.search).get('opening') === 'full';
    const reduceMotion = !!settings.get('reduceMotion');
    const fast = forceFull ? false : bootShouldRush();
    const opening = new ScopeOpening({
      canvas: document.getElementById('opening-scope'),
      reduceMotion,
      reduceFlashing: !!settings.get('reduceFlashing'),
      fast,
      muted: !!settings.get('muted'),
      low: !!this._softwareRenderer,
    });
    const boot = new BootSequence({
      log: document.getElementById('boot-log'),
      fill: document.getElementById('load-fill'),
      skip: document.getElementById('boot-skip'),
    });
    boot.setOnSkip(() => opening.skip());
    boot.setOnLine(() => opening.blip());
    boot.arm();

    const stampsPromise = this._bootStamps();
    try {
      await opening.play();
      opening.beginLog();
      const stamps = await stampsPromise;
      if (!reduceMotion) await boot.holdCursor(fast ? 500 : 1100);
      const pace = reduceMotion
        ? { cps: 80, minSeconds: 3.2, maxSeconds: 8, dwellScale: 0.16 }
        : fast
          ? { cps: 96, minSeconds: 1.1, maxSeconds: 4.5, dwellScale: 0.08 }
          : { cps: 16, minSeconds: 0, maxSeconds: 40, dwellScale: 0.45 };
      await boot.run(this._bootStages(stamps), pace);
    } finally {
      opening.stop();
    }
  }

  async _bootStamps() {
    let ip = 'REDACTED';
    try {
      ip = await guessDeviceIp(1000);
    } catch { /* offline or blocked */ }
    const mem = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency || 0;
    return {
      display: `${window.innerWidth}x${window.innerHeight} @${(window.devicePixelRatio || 1).toFixed(2)}X`,
      gpu: String(this._rendererName || 'WEBGL').slice(0, 32).toUpperCase(),
      agent: agentLabel(),
      machine: `${cores || 'N/A'} CORES / ${mem ? `${mem} GB` : 'CLASSIFIED'}`,
      terminals: `${TERMINALS.length} OF ${TERMINALS.length}`,
      ip: String(ip || 'REDACTED').slice(0, 24),
      banks: `${QUESTION_COUNT} PROMPTS / ${TWO_TRUTHS_COUNT} SEL`,
      parts: `${CODE_PARTS} FRAGMENTS`,
    };
  }

  _bootStages(stamps) {
    const s = stamps;
    return [
      { text: 'DISPLAY', run: () => s.display },
      { text: 'GPU', run: () => s.gpu },
      { text: 'AGENT', run: () => s.agent },
      { text: 'MACHINE', run: () => s.machine },
      { text: 'RETICULATING SPLINES', run: () => 'OK' },
      { text: 'QUANTIMIZING THE INFINITE', run: () => '∞' },
      { text: 'CHROMEBOOKS AWAKE', run: () => s.terminals },
      { text: 'BRAINSTEM ID', run: () => s.ip },
      { text: 'PROMPT BANKS', run: () => s.banks },
      { text: 'EXIT CODE NEEDS', run: () => s.parts },
    ];
  }

  // ============================================================== settings

  _loadSettings() {
    this.settings.quality = settings.get('quality') || this.settings.quality;
    this.settings.brightness = settings.get('brightness') ?? this.settings.brightness;
    this.settings.muted = settings.get('muted') ?? this.settings.muted;
    this.settings.reduceFx = settings.get('reduceFx') ?? this.settings.reduceFx;
    this.settings.difficulty = settings.get('difficulty') || this.settings.difficulty;
    this.settings.sensitivity = Math.round(settings.activeSensitivity * 100);
  }

  _saveSettings() {
    settings.set('quality', this.settings.quality);
    settings.set('brightness', this.settings.brightness);
    settings.set('muted', this.settings.muted);
    settings.set('reduceFx', this.settings.reduceFx);
    settings.set('difficulty', this.settings.difficulty);
  }

  _applySettings() {
    this._loadSettings();
    input.sensitivity = this.settings.sensitivity;
    audio.applyVolumes(settings.values);
    audio.setMuted(this.settings.muted);
    document.body.classList.toggle('reduce-fx', this.settings.reduceFx);
    if (this.world) {
      const base = (this.settings.brightness / 100) * (this.world.level?.brightnessScale || 1);
      this.world.lighting.setBrightness(base * debug.brightnessMultiplier());
      this.world.player.reduceFx = this.settings.reduceFx;
      this.scene.fog.density = this._qualityNow().fogDensity;
      this._applyDebugPerks();
    }
    this._resize();
    sessionUi._syncSettingsForm?.();
  }

  _bindUi() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('pocket-phone', 'click', () => {
      if (this._phoneRinging) this._raisePhone();
    });

    on('btn-start', 'click', () => {
      audio.init();
      audio.uiClick();
      this.startRun();
    });

    on('btn-settings', 'click', () => {
      audio.uiClick();
      this._clearHaltVisual();
      document.getElementById('screen-pause')?.classList.add('is-menu');
      this._returnScreen = 'screen-title';
      ui.showScreen('screen-pause');
      document.getElementById('btn-quit').classList.add('hidden');
      document.querySelector('#screen-pause .panel-title').textContent = 'SETTINGS';
      sessionUi.showPauseTab('comfort');
    });

    on('btn-standards', 'click', () => {
      audio.uiClick();
      ui.showScreen('screen-standards');
    });
    on('btn-standards-close', 'click', () => {
      audio.uiClick();
      ui.showScreen('screen-title');
    });

    on('btn-resume', 'click', () => {
      audio.uiClick();
      if (this._returnScreen === 'screen-title') {
        ui.showScreen('screen-title');
        this._returnScreen = null;
        return;
      }
      this.resume();
    });

    on('btn-quit', 'click', () => {
      audio.uiClick();
      this.quitToTitle();
    });

    on('btn-retry', 'click', () => {
      audio.uiClick();
      highscoresUi.resetEndScreen();
      this.startRun();
    });
    on('btn-over-title', 'click', () => {
      audio.uiClick();
      this.quitToTitle();
    });
    on('btn-win-again', 'click', () => {
      audio.uiClick();
      highscoresUi.resetEndScreen();
      this.startRun();
    });
    on('btn-win-title', 'click', () => {
      audio.uiClick();
      this.quitToTitle();
    });

    on('printer-go', 'click', () => this._beginPrint());
    on('printer-close', 'click', () => this._closePrinter());

    // Global keys
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this._halting) {
          e.preventDefault();
          if (performance.now() - (this._haltAt || 0) > 450) this._finishPauseNow();
        } else if (this.mode === MODE.PLAYING) {
          e.preventDefault();
          this.pause();
        } else if (this.mode === MODE.PAUSED && this._returnScreen !== 'screen-title') {
          e.preventDefault();
          this.resume();
        } else if (this.mode === MODE.OVER) {
          e.preventDefault();
          if (this._death && !this._death.shown) this._death.t = 99;
          else ui.finishOverReadout();
        } else if (this.mode === MODE.PRINTER) {
          e.preventDefault();
          this._closePrinter();
        }
      }
      if (e.code === 'KeyM' && this.mode === MODE.PLAYING) {
        this.settings.muted = !this.settings.muted;
        audio.setMuted(this.settings.muted);
        this._saveSettings();
        this._applySettings();
        ui.toast(this.settings.muted ? 'Sound muted' : 'Sound on');
      }
      if (debug.enabled && this.mode === MODE.PLAYING) {
        if (e.code === 'Digit1') { e.preventDefault(); this._debugAwardAllPieces(); }
        if (e.code === 'Digit2') { e.preventDefault(); this._debugFinishPrinter(); }
        if (e.code === 'Digit3') { e.preventDefault(); this._debugGiveKey(); }
        if (e.code === 'Digit4') { e.preventDefault(); this._debugTeleportExit(); }
        if (e.code === 'Digit5') { e.preventDefault(); this._debugGodMode(); }
        if (e.code === 'Digit6') { e.preventDefault(); this._debugWin(); }
      }
    });

    document.getElementById('scene').addEventListener('pointerdown', () => {
      if (this.mode !== MODE.PLAYING) return;
      const canvas = document.getElementById('scene');
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    });

    input.onPointerLockChange = () => {};

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === MODE.PLAYING && input.locked) this.pause({ instant: true });
    });
  }

  // ============================================================ world build

  async startRun() {
    if (this._starting) return;
    this._clearDeath();
    this._starting = true;
    try {
      await this._startRunBody();
    } finally {
      this._starting = false;
    }
  }

  async _startRunBody() {
    this._sawFlash = false;
    this._flashBusy = false;
    this._teardownWorld();

    const level = getLevel(this.levelIndex);
    const diffKey = this.settings.difficulty || 'normal';
    const baseDiff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    const diff = runProfile(level, baseDiff, diffKey);
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0;
    const rng = makeRng(seed);

    const layout = layoutFor(level);
    let maze = new Maze(rng, layout);
    let attempts = 0;
    while (attempts++ < 24) {
      const open = maze.openCells();
      const [sx, sy] = open[0];
      if (maze.isFullyConnected(sx, sy)) break;
      maze = new Maze(rng, layout);
    }

    const lab = new Lab(this.scene, maze, rng, level);
    const open = maze.openCells();
    const used = new Set();
    const key = (c) => `${c[0]},${c[1]}`;
    const reserve = (cells) => cells.forEach((c) => used.add(key(c)));
    const freeCells = () => open.filter((c) => !used.has(key(c)));

    const laptopCells = maze.spreadCells(CODE_PARTS, [], level.terminalSeparation || 8);
    reserve(laptopCells);

    const printerCell = maze.spreadCells(1, laptopCells, 6)[0];
    reserve([printerCell]);

    const border = freeCells().filter(([x, y]) => (
      x <= 2 || y <= 2 || x >= maze.size - 3 || y >= maze.size - 3
    ));
    const outerExit = maze.outerWallExitCandidates().filter((e) => !used.has(key(e.cell)));
    const exitPick = outerExit.length ? rng.pick(outerExit) : null;
    const exitCell = exitPick?.cell
      ?? (border.length ? rng.pick(border) : rng.pick(freeCells()));
    const exitSide = exitPick?.side ?? null;
    reserve([exitCell]);

    const startPool = freeCells().filter(
      (c) => Math.hypot(c[0] - exitCell[0], c[1] - exitCell[1]) > maze.size * 0.45,
    );
    const startCell = startPool.length ? rng.pick(startPool) : rng.pick(freeCells());
    reserve([startCell]);

    lab.buildLaptops(laptopCells);
    lab.buildPrinter(printerCell);
    lab.buildExit(exitCell, exitSide);

    const posterCells = pickPosterCells(
      maze, rng,
      [startCell, ...laptopCells, printerCell, exitCell],
    );
    lab.installMapPosters(posterCells, {
      terminals: laptopCells,
      printer: printerCell,
      exit: exitCell,
    });

    const surfacePlanner = new TableSurfacePlanner(maze, rng);
    const furniture = planLabFurniture(
      maze, rng, open,
      [...laptopCells, printerCell, exitCell, startCell],
      level,
      surfacePlanner,
    );
    reserve(furniture.tableCells);
    reserve(furniture.propCells);
    furniture.chairCells.forEach((c) => used.add(key(c.cell)));

    lab.buildTables(furniture.tableCells);
    lab.buildChairs(furniture.chairCells);
    lab.buildProps(furniture.propCells);
    buildScatterProps(lab, furniture.scatter);

    const tableCells = furniture.tableCells;
    const propCells = furniture.propCells;

    const inventory = new Inventory();
    const pickups = new PickupField(this.scene, maze, rng);
    const throws = new ThrowField(this.scene, maze, rng);

    const lootTables = rng.shuffle([...furniture.tableCells]);
    const underLootPlaced = new Map();
    let lootTableIdx = 0;
    const spawnLoot = (kind, count) => {
      for (let i = 0; i < count; i++) {
        let placed = null;
        for (let attempt = 0; attempt < lootTables.length && !placed; attempt++) {
          const cell = lootTables[(lootTableIdx + attempt) % lootTables.length];
          placed = placeLootSpot(
            maze, rng, cell, furniture.chairCells, kind, underLootPlaced,
          );
          if (placed) lootTableIdx = (lootTableIdx + attempt + 1) % lootTables.length;
        }
        if (placed) pickups.spawn(kind, placed.cell, placed);
      }
    };
    spawnLoot('cheetos', diff.cheetos);
    spawnLoot('battery', diff.batteries);
    spawnLoot('soda', diff.sodas || 0);
    spawnLoot('antivirus', diff.antivirus || 0);

    const startBatteryMax = diff.startBatteryMaxDist ?? 2.5;
    const startBatteryCells = maze.openCells().filter(([x, y]) => {
      const d = Math.hypot(x - startCell[0], y - startCell[1]);
      return d >= 1 && d <= startBatteryMax;
    });
    if (startBatteryCells.length) {
      const bc = rng.pick(startBatteryCells);
      const bcCenter = maze.cellCenter(bc[0], bc[1]);
      pickups.spawn('battery', bc, {
        x: bcCenter.x,
        z: bcCenter.z,
        y: 0.38,
        underTable: false,
        onChair: false,
      });
    }

    const player = new Player(maze, lab, startCell, diff);
    player.reduceFx = this.settings.reduceFx;
    player.yaw = this._bestStartYaw(maze, startCell);
    lab.updateEmergencyArrows(player.pos, 0);

    const qRun = this._qualityNow();
    this._applyTone(qRun);
    if (qRun.shadows) {
      lab.group.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
    }
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy?.() || 1;
    lab.group.traverse((obj) => {
      const mats = obj.material ? [].concat(obj.material) : [];
      for (const mat of mats) {
        if (!mat.map) continue;
        mat.map.anisotropy = Math.min(qRun.anisotropy || 1, maxAniso);
      }
    });

    const lighting = new Lighting(this.scene, this.camera, qRun);
    lighting.setBrightness(
      (this.settings.brightness / 100) * (level.brightnessScale || 1) * debug.brightnessMultiplier(),
    );
    lighting.setFlashlight(player.flashlightOn);

    this._activeTerminalIndex = -1;

    this.scene.fog = new THREE.FogExp2(
      COLORS.fog,
      qRun.fogDensity * (level.fogScale || 1),
    );

    const enemies = new EnemyManager(this.scene, maze, rng, diff, lab.obstacles);
    enemies.spawnInitial(startCell);

    const fragments = [];
    for (let i = 0; i < CODE_PARTS; i++) {
      let f = '';
      for (let c = 0; c < 3; c++) f += rng.pick(FRAGMENT_CHARS.split(''));
      fragments.push(f);
    }

    const progress = saveStore.active;
    if (progress) progress.beginRun(this.levelIndex, this.settings.difficulty);

    this.world = {
      seed, rng, maze, lab, player, lighting, enemies, pickups, throws, inventory, diff,
      level, progress,
      fragments,
      earned: new Array(CODE_PARTS).fill(null),
      questionsAsked: 0,
      questionsRight: 0,
      questionsFirstTry: 0,
      decryptAttempts: 0,
      printing: false,
      printProgress: 0,
      printerDone: false,
      keyTaken: false,
      escaped: false,
      startTime: performance.now(),
      runTime: 0,
      tension: 0,
      terminalQuestions: [null, null, null, null],
    };

    this.terminalCooldowns = [0, 0, 0, 0];
    this._invUiRev = -1;
    this._notifyTimer = this._scheduleNotifyTimer();
    this._notifyGap = 0;

    ui.buildHealth(player.maxHealth);
    ui.setHealth(player.health);
    ui.setPieces(this.world.earned);
    ui.updateInventoryBar(inventory);
    ui.clearToasts();
    ui.setHudVisible(true);
    ui.hideAllScreens();
    ui.setObjective(`${level.codename}: find a glowing Chromebook`);
    ui.setDanger(false);
    input.showTouchUi(true);

    audio.init();
    audio.startAmbience();
    await this._prewarm(lighting, player);
    coach.beginRun();
    this._coachX = player.pos.x;
    this._coachZ = player.pos.z;

    this.mode = MODE.PLAYING;
    input.setEnabled(true);
    input.clearEdges();
    const playCanvas = document.getElementById('scene');
    if (playCanvas) {
      playCanvas.tabIndex = 0;
      playCanvas.focus({ preventScroll: true });
    }
    if (input.touchMode) {
      touchUi.requestFullscreen();
      ui.toast('Drag the right side to look. Stick moves. Tap FULL for fullscreen.', 'warn', 5200);
      setTimeout(() => {
        const hint = document.getElementById('touch-look-hint');
        if (hint) hint.classList.add('hidden');
      }, 9000);
    } else {
      ui.toast('Click the lab. WASD walks. Move the mouse to look.', 'warn', 4200);
    }

    ui.toast(`${level.name} — four terminals, four code pieces. Do not get cornered.`, 'warn', 4200);
    this._applyDebugPerks();
  }

  /** Points the player down the longest open run from their start cell. */
  _bestStartYaw(maze, cell) {
    const dirs = [
      { yaw: Math.PI, d: [0, 1] },
      { yaw: 0, d: [0, -1] },
      { yaw: -Math.PI / 2, d: [1, 0] },
      { yaw: Math.PI / 2, d: [-1, 0] },
    ];
    let best = dirs[0];
    let bestLen = -1;
    for (const dir of dirs) {
      let len = 0;
      let x = cell[0];
      let y = cell[1];
      while (maze.isOpen(x + dir.d[0], y + dir.d[1]) && len < 12) {
        x += dir.d[0];
        y += dir.d[1];
        len++;
      }
      if (len > bestLen) { bestLen = len; best = dir; }
    }
    return best.yaw;
  }

  _teardownWorld() {
    if (!this.world) return;
    this.world.enemies.dispose();
    this.world.pickups.dispose();
    this.world.throws?.dispose();
    this.world.lighting.dispose();
    this.world.lab.dispose();
    disposeModels();
    this.scene.fog = null;
    this.world = null;
  }

  // =============================================================== flow control

  pause(opts = {}) {
    if (this._phoneRinging || this._phoneLift) return;
    if (this.mode !== MODE.PLAYING) return;
    document.getElementById('scene')?.classList.remove('is-halting');
    document.getElementById('halt-veil')?.classList.remove('is-on');
    this._openPauseMenu({ whoosh: !opts.instant });
  }

  _openPauseMenu({ whoosh }) {
    this.mode = MODE.PAUSED;
    this._returnScreen = null;
    input.setEnabled(false);
    this.expectUnlock = true;
    input.releaseLock();
    document.getElementById('btn-quit')?.classList.remove('hidden');
    const title = document.querySelector('#screen-pause .panel-title');
    if (title) title.textContent = 'PAUSED';
    sessionUi.showPauseTab('play');
    const screen = document.getElementById('screen-pause');
    screen?.classList.remove('is-rising', 'is-risen', 'is-flicker');
    screen?.classList.add('is-menu');
    screen?.removeAttribute('aria-hidden');
    ui.showScreen('screen-pause');
    ui.setHudVisible(false);
    input.showTouchUi(false);
    debug.syncPanel();
    audio.setTension(0);
    audio.setMuffled(false);
    if (whoosh) {
      audio.init();
      audio.menuWhoosh();
    }
    document.getElementById('btn-resume')?.focus();
  }

  _beginPauseRise() {
    if (this._halting !== 'slow') return;
    this._halting = 'rise';
    this.mode = MODE.PAUSED;
    this._returnScreen = null;
    input.setEnabled(false);
    this.expectUnlock = true;
    input.releaseLock();
    document.getElementById('btn-quit')?.classList.remove('hidden');
    const title = document.querySelector('#screen-pause .panel-title');
    if (title) title.textContent = 'PAUSED';
    sessionUi.showPauseTab('play');
    const screen = document.getElementById('screen-pause');
    if (!screen) {
      this._openPauseMenu({ whoosh: true });
      return;
    }
    screen.classList.remove('is-menu', 'is-risen', 'is-flicker');
    screen.classList.add('is-rising');
    screen.setAttribute('aria-hidden', 'true');
    ui.showScreen('screen-pause');
    ui.setHudVisible(false);
    input.showTouchUi(false);
    debug.syncPanel();
    audio.setTension(0);
    audio.setMuffled(false);
    this._stopPauseScope?.();
    this._stopPauseScope = startPauseScope(document.getElementById('pause-scope'), {
      reduceFlashing: !!settings.get('reduceFlashing'),
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => screen.classList.add('is-risen'));
    });
    this._pauseTimers.push(window.setTimeout(() => this._flickPauseScope(), 2800));
    this._pauseTimers.push(window.setTimeout(() => this._revealPauseMenu(), 5200));
  }

  _flickPauseScope() {
    if (this._halting !== 'rise') return;
    const screen = document.getElementById('screen-pause');
    if (!settings.get('reduceFlashing')) screen?.classList.add('is-flicker');
    audio.init();
    audio.bootChirp();
  }

  _revealPauseMenu() {
    if (this._halting !== 'rise' && this.mode !== MODE.PAUSED) return;
    const screen = document.getElementById('screen-pause');
    screen?.classList.add('is-menu', 'is-risen');
    screen?.classList.remove('is-flicker');
    screen?.removeAttribute('aria-hidden');
    this._halting = null;
    this._stopPauseScope?.();
    this._stopPauseScope = null;
    document.getElementById('btn-resume')?.focus();
  }

  _finishPauseNow() {
    this._clearPauseTimers();
    this._stopPauseScope?.();
    this._stopPauseScope = null;
    this._halting = null;
    this._halt = 1;
    document.getElementById('scene')?.classList.add('is-halting');
    document.getElementById('halt-veil')?.classList.add('is-on');
    this._openPauseMenu({ whoosh: false });
  }

  _clearHaltVisual() {
    this._clearPauseTimers();
    this._stopPauseScope?.();
    this._stopPauseScope = null;
    this._halting = null;
    this._halt = 1;
    document.getElementById('scene')?.classList.remove('is-halting');
    document.getElementById('scene')?.style.removeProperty('filter');
    document.getElementById('halt-veil')?.classList.remove('is-on');
    const screen = document.getElementById('screen-pause');
    screen?.classList.remove('is-rising', 'is-risen', 'is-flicker', 'is-menu');
    screen?.removeAttribute('aria-hidden');
  }

  _clearPauseTimers() {
    for (const id of this._pauseTimers) window.clearTimeout(id);
    this._pauseTimers = [];
  }

  resume() {
    if (this.mode !== MODE.PAUSED) return;
    this._clearHaltVisual();
    this.mode = MODE.PLAYING;
    ui.hideAllScreens();
    ui.setHudVisible(true);
    input.setEnabled(true);
    input.clearEdges();
    input.showTouchUi(true);
    const canvas = document.getElementById('scene');
    if (canvas) canvas.focus({ preventScroll: true });
    this._applyDebugPerks();
  }

  quitToTitle() {
    this._clearDeath();
    this._clearHaltVisual();
    this._teardownWorld();
    audio.stopAmbience();
    audio.stopTitleMusic();
    audio.setMuffled(false);
    this.mode = MODE.TITLE;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    input.showTouchUi(false);
    ui.setHudVisible(false);
    ui.clearToasts();
    highscoresUi.resetEndScreen();
    sessionUi.renderTitleGreeting();
    sessionUi.renderLevelSelect();
    ui.showScreen('screen-title');
    audio.init();
    audio.startTitleMusic();
    tutorial.maybeShowOnLobby();
  }

  // ================================================================ main loop

  _startLoop() {
    const frame = (now) => {
      requestAnimationFrame(frame);
      const raw = (now - this.clock.last) / 1000;
      this.clock.last = now;
      if (this._contextLost) return;
      // A stall longer than a quarter second is a compile or a wake, not a step.
      // Integrating it used to shove the body through a wall on slow machines.
      const dt = !Number.isFinite(raw) || raw < 0 || raw > 0.25 ? 0 : Math.min(0.05, raw);
      this._tick(dt);
    };
    requestAnimationFrame(frame);
  }

  _terminalsFrozen() {
    return this._enemiesFrozen();
  }

  _enemiesFrozen() {
    const key = this.settings.difficulty;
    if (this.mode === MODE.QUIZ || this.mode === MODE.DECRYPT) {
      return (QUIZ.timeScaleByDifficulty[key] ?? QUIZ.timeScale) === 0;
    }
    if (this.mode === MODE.NOTIFY) {
      return (NOTIFY.timeScaleByDifficulty[key] ?? 0) === 0;
    }
    return false;
  }

  _minigameTimeScale() {
    const key = this.settings.difficulty;
    if (this.mode === MODE.QUIZ) {
      return QUIZ.timeScaleByDifficulty[key] ?? QUIZ.timeScale;
    }
    if (this.mode === MODE.DECRYPT) {
      return DECRYPT.timeScaleByDifficulty[key] ?? DECRYPT.timeScale;
    }
    if (this.mode === MODE.NOTIFY) {
      return NOTIFY.timeScaleByDifficulty[key] ?? 0;
    }
    if (this.mode === MODE.PRINTER) return 0.25;
    return 1;
  }

  _scheduleNotifyTimer() {
    const w = this.world;
    if (!w) return NOTIFY.minInterval;
    return w.rng.range(NOTIFY.minInterval, NOTIFY.maxInterval);
  }

  _tick(dt) {
    audio.updateMusic(dt);

    const w = this.world;
    if (!w) {
      if (this.renderer) this.renderer.render(this.scene, this.camera);
      return;
    }

    const inMinigame = this.mode === MODE.QUIZ || this.mode === MODE.DECRYPT
      || this.mode === MODE.NOTIFY;
    const controlsActive = this.mode === MODE.PLAYING;
    const worldRunning = this.mode === MODE.PLAYING || inMinigame || this.mode === MODE.PRINTER;
    const frozen = this._enemiesFrozen();

    if (worldRunning) {
      let scale = this._minigameTimeScale();
      if (this._halting === 'slow') {
        this._halt = Math.max(0, this._halt - dt * 0.62);
        scale *= Math.max(0.06, this._halt * this._halt);
        if (this._halt <= 0.02) this._beginPauseRise();
      }
      if (this._phoneRinging || this._phoneLift) {
        scale *= 0.4;
        if (this._phoneRinging) this._tickPhone(dt);
      }
      const wdt = dt * scale;
      w.runTime += wdt;

      w.enemies.setFrozen(frozen);

      if (controlsActive) {
        input.tickMouse(true, input.locked);
        this._mouseFrame = input.mouseActions();
        if (this._mouseFrame.crouch) input._edge.crouch = true;
      } else {
        input.tickMouse(false, false);
        this._mouseFrame = null;
      }

      if (controlsActive) w.player.applyLook();
      w.player.allowStaminaRegen = this._sodasSpent(w);
      w.player.update(wdt, controlsActive);

      const lures = w.throws?.lures || null;
      const ev = w.enemies.update(wdt, w.player, lures, w.inventory);
      w.player.burningVirus = ev.burning;
      this._handleCombat(ev, wdt);
      this._handleGlitch(ev);

      const throwEv = w.throws?.update(wdt, w.player, w.enemies) || null;
      this._handleThrows(throwEv);

      w.pickups.update(wdt);

      if (w.printing) this._updatePrint(wdt);

      this._updateTension(ev, wdt);
      this._updateHud(ev);

      if (controlsActive) {
        this._handleInteraction();
        this._handleInventory();
        this._tickNotify(dt);
      } else {
        ui.showInteract(null);
        ui.showHint(null);
      }

      if (this.quiz.open) {
        this.quiz.setThreat(ev.nearest < 4.5 && !frozen, frozen);
      }

      if (settings.get('soundCaptions')) {
        const heard = this._nearestSteps(w);
        if (heard && heard.dist < 18) captions.steps(heard.pos, w.player);
        else captions.hideSteps();
      } else {
        captions.hideSteps();
      }

      captions.update(dt);

      for (let t = 0; t < this.terminalCooldowns.length; t++) {
        if (this.terminalCooldowns[t] > 0) this.terminalCooldowns[t] -= wdt;
      }

      w.player.syncCamera(this.camera);
      w.lab.updateMapPosters(w.player.pos);
      w.lighting.setFlashlight(w.player.flashlightOn);
      w.lighting.reduceFlashing = settings.get('reduceFlashing');
      const arrows = w.lab.updateEmergencyArrows(w.player.pos, wdt);
      if (arrows?.revealed) coach.arrowsWoke();
      const moved = Math.hypot(
        w.player.pos.x - (this._coachX ?? w.player.pos.x),
        w.player.pos.z - (this._coachZ ?? w.player.pos.z),
      );
      this._coachX = w.player.pos.x;
      this._coachZ = w.player.pos.z;
      if (controlsActive) coach.update(w, wdt, moved);
      w.lab.updateTerminalHighlights(w.player);
      w.lighting.update(
        dt,
        w.player.pos,
        this._collectGlows(),
        w.player.batteryPct,
        { crouching: w.player.crouching, onTable: w.player.onTable },
      );

      if (!w.player.alive && this.mode !== MODE.OVER) this._gameOver(ev);
    }

    input.clearEdges();
    if (this._dying) this._stepDeath(dt);
    if (w) ui.tickInventory(dt);
    this.renderer.render(this.scene, this.camera);
    if (this._death?.freezeNext) this._freezeDeathFrame();
  }

  _nearestSteps(w) {
    const p = w.player;
    let best = null;
    let dist = Infinity;
    const lists = [w.enemies?.mice, w.enemies?.viruses];
    for (const list of lists) {
      if (!list) continue;
      for (const enemy of list) {
        if (!enemy || enemy.dead || !enemy.hunting || !enemy.pos) continue;
        const d = Math.hypot(enemy.pos.x - p.pos.x, enemy.pos.z - p.pos.z);
        if (d < dist) {
          dist = d;
          best = enemy;
        }
      }
    }
    return best ? { pos: best.pos, dist } : null;
  }

  _collectGlows() {
    const w = this.world;
    const out = w.lab.glowSources.slice();
    for (const g of w.enemies.glowSources) out.push(g);
    for (const g of w.pickups.glowSources) out.push(g);
    if (w.throws) for (const g of w.throws.glowSources) out.push(g);
    return out;
  }

  // ================================================================== systems

  _handleCombat(ev, dt) {
    const w = this.world;
    if (ev.damage > 0) {
      const applied = w.player.takeDamage(ev.damage * w.diff.damageScale);
      if (applied) {
        if (ev.attackFrom) {
          const sector = threatSector(
            w.player, ev.attackFrom.x, ev.attackFrom.z, ev.attackFrom.y,
          );
          const pan = threatPan(w.player, ev.attackFrom.x, ev.attackFrom.z);
          ui.flashDirectionalDamage(sector);
          audio.hurtDirectional(pan);
        } else {
          ui.flashDamage();
          audio.hurt();
        }
        ui.setHealth(w.player.health);
        if (ev.batteryDrain) {
          w.player.battery = clamp(w.player.battery - ev.batteryDrain, 0, PLAYER.batteryMax);
          if (w.player.battery <= 0) w.player.cellDead = true;
          ui.toast('A virus chewed through your battery!', 'bad', 2000);
        } else {
          ui.toast('The mice got a bite in! Find hot cheetos.', 'bad', 2000);
        }
        // Being hit while at a laptop kicks you out of the terminal
        if (this.mode === MODE.QUIZ) {
          this.quiz.close();
          this._exitMinigameToPlaying();
          ui.toast('Knocked away from the Chromebook!', 'bad');
        } else if (this.mode === MODE.DECRYPT) {
          this.decrypt.close();
          this._exitMinigameToPlaying();
          ui.toast('Decryption interrupted!', 'bad');
        } else if (this.mode === MODE.NOTIFY) {
          this.notify.close();
          this._exitMinigameToPlaying();
          ui.toast('Notification dismissed — read it later in the Study Guide.', 'warn');
        }
      }
    }

    if (ev.pullFromHide) {
      w.player.wantCrouch = false;
      w.player.crouching = false;
      w.player.hidden = false;
      ui.toast('A phisher yanked you out from under the desk!', 'bad', 2200);
    }
    if (ev.stole) {
      ui.updateInventoryBar(w.inventory);
      ui.toast(`A phisher stole your ${ev.stole}!`, 'bad', 2200);
    }
  }

  /** Screen-space payoff when the beam finally breaks a virus. */
  _handleGlitch(ev) {
    if (!ev.glitched) return;
    const reduced = this.settings.reduceFx || settings.get('reduceFlashing');
    if (!reduced || flashGuard.request()) {
      ui.glitchBurst(reduced);
    }
    if (!this._taughtGlitch) {
      this._taughtGlitch = true;
      ui.toast('It glitched out! The light hurts them - but it drains your battery.', 'good', 4200);
    } else {
      ui.toast('Virus glitched away. It will be back.', 'good', 1800);
    }
  }

  _handleThrows(ev) {
    if (!ev) return;
    const w = this.world;
    if (ev.popped > 0) {
      w.player.stats.micePopped += ev.popped;
      w.progress?.notePop();
      ui.toast(
        ev.popped === 1 ? 'Mouse down. A thrown bag ends one.' : `${ev.popped} mice down. The bags ended them.`,
        'good', 2200,
      );
    }
    if (ev.virusKilled > 0) {
      w.player.stats.virusesKilled += ev.virusKilled;
      w.progress?.noteVirusKill();
      ui.toast('Virus deleted permanently.', 'good', 2800);
    }
    if (ev.exploded && ev.shake > 0.2) {
      ui.toast('Cheese dust everywhere.', 'warn', 1400);
    }
    for (const drop of ev.dropped || []) {
      w.pickups.spawn(drop.kind, drop.cell, drop.pos);
    }
  }

  _handlePickups(got) {
    const w = this.world;
    if (got.taken?.length) {
      audio.stashSparkle();
      for (const kind of got.taken) {
        if (kind === 'cheetos') ui.toast('Hot cheetos. C to eat, E to throw.', 'good', 2200);
        else if (kind === 'soda') ui.toast('V67 soda. V to drink.', 'good', 2000);
        else if (kind === 'battery') {
          ui.toast(
            w.player.cellDead
              ? 'Battery pocketed. Press B to change the cell.'
              : 'Battery pocketed. B loads it when the beam dies.',
            'good',
            2200,
          );
        }
        else if (kind === 'antivirus') ui.toast('Norgin anti-virus. Press N to shoot a virus.', 'good', 2800);
      }
      ui.updateInventoryBar(w.inventory);
      this._invUiRev = w.inventory.revision;
    }
    if (got.batteries) {
      ui.toast('Fresh battery. The dark just got smaller.', 'good', 1700);
    }
    if (got.full) {
      this._wastedCooldown = (this._wastedCooldown || 0) - 1;
      if (this._wastedCooldown <= 0) {
        this._wastedCooldown = 180;
        ui.toast('Hands full or already topped up — leave it for later.', 'warn', 1600);
      }
    }
  }

  _handleInventory() {
    const w = this.world;
    const inv = w.inventory;
    if (inv.revision !== this._invUiRev) {
      ui.updateInventoryBar(inv);
      this._invUiRev = inv.revision;
    }

    if (input.pressed('cycleItem')) {
      inv.cycle(1);
      ui.updateInventoryBar(inv);
      const info = inv.info();
      if (info) ui.toast(info.label, '', 900);
    }

    const mf = this._mouseFrame;
    if (mf?.wheel) {
      inv.cycle(mf.wheel > 0 ? 1 : -1);
      ui.updateInventoryBar(inv);
      const info = inv.info();
      if (info) ui.toast(info.label, '', 900);
    }

    if (input.pressed('reloadBattery') && !this._using) {
      if (w.player.cellDead && inv.has('battery')) this._beginBatteryReload();
      else if (!inv.has('battery')) ui.toast('No spare battery.', 'warn', 1200);
      else ui.toast('That cell still has charge.', 'warn', 1200);
    }

    if (input.pressed('eatCheetos') && !this._using) {
      if (w.player.health < w.player.maxHealth && inv.has('cheetos')) this._beginHeal();
      else if (!inv.has('cheetos')) ui.toast('No hot cheetos.', 'warn', 1200);
      else ui.toast('Health is already full.', 'warn', 1200);
    }

    if (input.pressed('drinkSoda') && !this._using) {
      if (inv.has('soda')) this._beginDrink();
      else ui.toast('No V67 soda.', 'warn', 1200);
    }

    if (input.pressed('throw') || (mf?.primary && !this._mousePrimaryUsed)) {
      this._throwCheetos();
    }
    if (input.pressed('shootAntivirus')) {
      this._shootNorgin();
    }
  }

  /** True when the crosshair is on a living virus within throw range. */
  _aimingAtVirus(w) {
    const p = w.player;
    const fwd = p.forward();
    const px = p.pos.x;
    const pz = p.pos.z;
    for (const v of w.enemies.viruses) {
      if (v.dead) continue;
      const dx = v.pos.x - px;
      const dz = v.pos.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > THROW_AIM_RANGE) continue;
      const dot = dist < 0.01 ? 1 : (dx / dist) * fwd.x + (dz / dist) * fwd.z;
      if (dot >= THROW_AIM_DOT) return true;
    }
    return false;
  }

  /**
   * Pick cheetos vs anti-virus from what the player is looking at, not the
   * highlighted inventory slot — which is what caused disc throws to fire bags.
   */
  _resolveThrowKind(w) {
    const inv = w.inventory;
    const atVirus = this._aimingAtVirus(w);

    if (atVirus) {
      if (inv.has('antivirus')) return { kind: 'antivirus' };
      return {
        kind: null,
        msg: 'You are aiming at a virus — you need an anti-virus disc, not cheetos.',
      };
    }

    if (inv.has('cheetos')) return { kind: 'cheetos' };
    if (inv.has('antivirus')) return { kind: 'antivirus' };
    return { kind: null, msg: 'Nothing to throw.' };
  }

  _throwCheetos() {
    this._launchItem('cheetos', 'No hot cheetos to throw.', 'Bag thrown. Mice will smell it.');
  }

  _shootNorgin() {
    this._launchItem('antivirus', 'No Norgin anti-virus.', 'Norgin fired.');
  }

  _launchItem(kind, emptyMsg, doneMsg) {
    const w = this.world;
    const inv = w?.inventory;
    if (!inv || !inv.has(kind)) {
      audio.deny();
      ui.toast(emptyMsg, 'warn', 1400);
      return;
    }
    if (!inv.remove(kind)) {
      audio.deny();
      return;
    }
    const dir = w.player.forward();
    const thrown = w.throws.throwItem(kind, w.player.eyePos, dir);
    if (!thrown) {
      inv.add(kind, 1);
      audio.deny();
      return;
    }
    w.player.stats.itemsThrown++;
    ui.updateInventoryBar(inv);
    ui.toast(doneMsg, 'good', 1600);
  }

  _beginBatteryReload() {
    const w = this.world;
    if (!w || this._reloading || !w.player.cellDead) return;
    if (!w.inventory.remove('battery')) return;
    this._reloading = true;
    this._using = true;
    ui.setUsePrompt('');
    ui.updateInventoryBar(w.inventory);
    this._invUiRev = w.inventory.revision;
    ui.playBatteryReload(settings.get('reduceMotion'), () => {
      const player = this.world?.player;
      this._reloading = false;
      this._using = false;
      if (!player) return;
      player.battery = PLAYER.batteryMax;
      player.cellDead = false;
      player.flashlightOn = true;
      audio.flashlightClick();
      ui.toast('Cell seated. The beam is back.', 'good', 1600);
    });
  }

  _beginHeal() {
    const w = this.world;
    if (!w || this._using) return;
    if (w.player.health >= w.player.maxHealth) return;
    if (!w.inventory.remove('cheetos')) return;
    this._using = true;
    ui.setUsePrompt('');
    ui.updateInventoryBar(w.inventory);
    this._invUiRev = w.inventory.revision;
    ui.playItemUse('cheetos', settings.get('reduceMotion'), () => {
      const player = this.world?.player;
      this._using = false;
      if (!player) return;
      player.heal(1);
      ui.setHealth(player.health);
      ui.toast('One bag. One point of health back.', 'good', 1400);
    });
  }

  _beginDrink() {
    const w = this.world;
    if (!w || this._using) return;
    if (!w.inventory.remove('soda')) return;
    this._using = true;
    ui.setUsePrompt('');
    ui.updateInventoryBar(w.inventory);
    this._invUiRev = w.inventory.revision;
    ui.playItemUse('soda', settings.get('reduceMotion'), () => {
      const player = this.world?.player;
      this._using = false;
      if (!player) return;
      player.drinkSoda();
      ui.toast('Can empty. Stamina is full.', 'good', 1400);
    });
  }

  /** Stamina only recovers once no soda is left on the floor or in the pocket. */
  _sodasSpent(w) {
    const onFloor = w.pickups?.items?.some((it) => it.kind === 'soda' && !it.taken);
    return !onFloor && w.inventory.count('soda') === 0;
  }

  _updateTension(ev, dt) {
    const w = this.world;
    const near = clamp(1 - ev.nearest / 22, 0, 1);
    const hunted = ev.hunters > 0 ? 0.45 : 0;
    const hurt = w.player.health <= 1 ? 0.3 : 0;
    const target = clamp(near * 0.7 + hunted + hurt, 0, 1);
    w.tension += (target - w.tension) * (1 - Math.pow(0.02, dt));
    audio.setTension(w.tension);

    // Heartbeat rises with danger and with injury
    const urgency = clamp(
      (w.player.health <= 1 ? 0.55 : 0) + (ev.hunters > 0 ? near * 0.8 : near * 0.25),
      0, 1,
    );
    audio.updateHeartbeat(dt, urgency > 0.25 ? urgency : 0);
  }

  _updateHud(ev) {
    const w = this.world;
    const p = w.player;
    w.lab.updateTerminalHighlights(p);
    ui.setStamina(p.staminaPct, p.exhausted > 0);
    ui.setBattery(p.batteryPct, p.flashlightOn, ev.burning);
    ui.setHiddenIndicator(p.hidden);
    ui.setCrouched(p.crouching, p.hidden);
    ui.setDanger(ev.hunters > 0 && !p.hidden && ev.nearest < (p.onTable ? 9 : 7));
    if (ev.hunters > 0 && ev.nearest < (p.onTable ? 6 : 4.5) && !p.hidden && !this._dangerSting) {
      this._dangerSting = true;
      audio.nearMiss();
    }
    if (!ev.hunters || ev.nearest > 8) this._dangerSting = false;
    ui.setObjective(this._objectiveText());
    audio.setMuffled(p.hidden);

    if (w.inventory && w.inventory.revision !== this._invUiRev) {
      ui.updateInventoryBar(w.inventory);
      this._invUiRev = w.inventory.revision;
    }
    const canReload = p.cellDead && w.inventory.has('battery') && !this._using;
    const canHeal = p.health < p.maxHealth && w.inventory.has('cheetos') && !this._using;
    const canDrink = p.stamina <= 0 && w.inventory.has('soda') && !this._using;
    const prompts = [];
    if (canReload) prompts.push('CHANGE BATTERY: B');
    if (canHeal) prompts.push('EAT HOT CHEETOS: C');
    if (canDrink) prompts.push('DRINK V67 SODA: V');
    if (w.inventory.has('antivirus') && this._aimingAtVirus(w)) prompts.push('SHOOT NORGIN: N');
    ui.setUsePrompt(prompts.join('   '));
    if (p.cellDead && !w.inventory.has('battery') && !this._toldDry) {
      this._toldDry = true;
      ui.toast('The beam is dry. Find a battery.', 'warn', 1800);
    }
    if (!p.cellDead) this._toldDry = false;

    // Announce hiding the first time it happens so the mechanic lands
    if (p.hidden && !this._wasHidden) {
      if (!this._taughtHide) {
        this._taughtHide = true;
        ui.toast('HIDDEN. Stay under here until they lose interest.', 'good', 3200);
      }
      audio.hide();
    }
    this._wasHidden = p.hidden;

    // Trying to stand with a desk overhead
    if (p.stuckUnder && !this._warnedHeadroom) {
      this._warnedHeadroom = true;
      ui.toast('No headroom - crawl out before you stand up.', 'warn', 2200);
    }
    if (!p.stuckUnder) this._warnedHeadroom = false;
  }

  _objectiveText() {
    const w = this.world;
    const found = w.earned.filter(Boolean).length;
    if (w.escaped) return 'You are out.';
    if (w.keyTaken) return 'Use the key on the EXIT door';
    if (w.printerDone) return 'Grab the key from the printer bed';
    if (w.printing) return `SURVIVE THE PRINT - ${Math.round(w.printProgress * 100)}%`;
    if (found >= CODE_PARTS) return 'Code complete! Reach the 3D printer';
    return `Log in to the Chromebooks - ${found} / ${CODE_PARTS} code pieces`;
  }

  // ============================================================== interaction

  /** Finds what the player is looking at and handles the E key. */
  _handleInteraction() {
    const w = this.world;
    const p = w.player;
    const px = p.pos.x;
    const pz = p.pos.z;
    const interactRange = input.touchMode ? MOBILE.interactRange : INTERACT_RANGE;

    const fwd = p.forward();
    let best = null;
    let bestScore = -Infinity;

    const consider = (target, label, action, enabled = true, maxDist = interactRange, use3d = false) => {
      const dx = target.x - px;
      const dz = target.z - pz;
      let dist;
      if (use3d) {
        const ty = target.y ?? p.pos.y;
        const dy = p.pos.y - ty;
        dist = Math.hypot(dx, dy, dz);
      } else {
        dist = Math.hypot(dx, dz);
      }
      if (dist > maxDist) return;
      const dot = dist < 0.001 ? 1 : (dx / dist) * fwd.x + (dz / dist) * fwd.z;
      if (dot < 0.1) return;
      const score = dot * 2 - dist * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { label, action, enabled };
      }
    };

    for (const item of w.pickups.items) {
      if (item.taken || !w.pickups.canGrab(p, item)) continue;
      consider(
        item.pos,
        w.pickups.labelFor(item.kind),
        () => {
          const got = w.pickups.collectOne(item, p, w.inventory);
          if (got) this._handlePickups(got);
        },
        true,
        PICKUP.grabRange,
        true,
      );
    }

    for (const lp of w.lab.laptops) {
      if (lp.solved) continue;
      const cd = this.terminalCooldowns[lp.index];
      consider(
        lp,
        cd > 0
          ? `Terminal ${lp.index + 1} rebooting (${Math.ceil(cd)}s)`
          : `Log in to Terminal ${lp.index + 1}`,
        () => this._openTerminal(lp.index),
        cd <= 0,
      );
    }

    const printer = w.lab.printer;
    if (printer && !w.keyTaken) {
      if (w.printerDone) {
        consider(printer, 'Take the printed key', () => this._takeKey());
      } else if (w.printing) {
        consider(printer, `Printing... ${Math.round(w.printProgress * 100)}%`, null, false);
      } else {
        const found = w.earned.filter(Boolean).length;
        const ready = found >= CODE_PARTS;
        consider(
          printer,
          ready ? 'Enter the code' : `Printer locked - ${found} / ${CODE_PARTS} code`,
          ready ? () => this._openPrinter() : null,
          ready,
        );
      }
    }

    const exit = w.lab.exit;
    if (exit) {
      consider(
        exit,
        w.keyTaken ? 'UNLOCK THE DOOR AND ESCAPE' : 'Locked - you need a printed key',
        w.keyTaken ? () => this._escape() : null,
        w.keyTaken,
      );
    }

    ui.showInteract(best ? best.label : null);

    // Hiding is no longer a button press: it is the result of crouching under a
    // desk. When nothing is interactable, hint at the nearest desk instead.
    if (!best) {
      if (p.hidden) ui.showHint('Crawl out and stand when it is clear');
      else if (p.onTable) ui.showHint('Exposed on the desk — walk off the edge to drop down');
      else if (p.inTableCrawlGrace) {
        ui.showHint('Desk overhead — keep moving or press C to crawl under');
      } else if (p.crouching && p.underTable()) ui.showHint('Hidden');
      else if (p.tableNearby()) {
        ui.showHint(p.crouching
          ? 'Crawl under the glowing desk — loot waits underneath'
          : 'Space to climb up, Z to crawl under and grab loot');
      } else ui.showHint(null);
    } else {
      ui.showHint(null);
    }

    const mf = this._mouseFrame;
    this._mousePrimaryUsed = false;

    if ((input.pressed('interact') || input.pressed('throw') || mf?.primary) && best) {
      this._mousePrimaryUsed = !!mf?.primary;
      if (best.enabled && best.action) best.action();
      else audio.deny();
    }

    if (input.pressed('light') && !this._flashBusy) {
      if (p.flashlightOn) {
        p.toggleFlashlight();
        ui.playFlashDraw('off');
      } else if (p.battery <= 0) {
        audio.deny();
        ui.toast('The beam is dry. Find a battery.', 'warn', 1600);
      } else {
        const first = !this._sawFlash;
        this._sawFlash = true;
        const reduce = settings.get('reduceMotion');
        if (reduce) {
          p.flashlightOn = true;
          audio.flashlightClick();
        } else {
          this._flashBusy = true;
          ui.playFlashDraw(first ? 'intro' : 'on', () => {
            this._flashBusy = false;
            if (!p.alive || this.mode !== MODE.PLAYING) return;
            p.flashlightOn = true;
            audio.flashlightClick();
          });
        }
      }
    }
  }

  /** Count down to the next SEL notification ping. */
  _tickNotify(dt) {
    const w = this.world;
    if (!w || this.notify.open) return;
    if (w.runTime < NOTIFY.minRunSeconds) return;

    if (this._notifyGap > 0) {
      this._notifyGap -= dt;
      return;
    }

    this._notifyTimer = (this._notifyTimer ?? this._scheduleNotifyTimer()) - dt;
    if (this._notifyTimer <= 0) this._armPhone();
  }

  _armPhone() {
    const w = this.world;
    if (!w || this.notify.open || this._phoneRinging) return;
    const exclude = w.progress?.excludeIds?.() || null;
    const item = drawTwoTruths(w.rng, exclude);
    if (!item) return;
    w.progress?.noteServed?.([item.id]);
    this._phoneItem = item;
    this._phoneRinging = true;
    this._phoneWait = 0;
    this._phoneBuzz = 0.85;
    audio.init();
    audio.phonePing(0);
    captions.say('Phone', { type: 'ui' });
    const phone = document.getElementById('pocket-phone');
    phone?.classList.add('is-ringing');
    phone?.classList.remove('hidden', 'is-raised');
    this.expectUnlock = true;
    input.releaseLock();
  }

  _tickPhone(dt) {
    this._phoneWait += dt;
    this._phoneBuzz -= dt;
    if (this._phoneBuzz > 0) return;
    const urgency = Math.min(1, this._phoneWait / 14);
    const gap = settings.get('reduceFlashing') ? 1.35 : (1.15 - urgency * 0.7);
    this._phoneBuzz = gap;
    audio.phonePing(settings.get('reduceFlashing') ? Math.min(0.45, urgency) : urgency);
  }

  _raisePhone() {
    if (!this._phoneRinging || !this._phoneItem) return;
    const phone = document.getElementById('pocket-phone');
    if (!phone || phone.classList.contains('is-raised')) return;
    const rect = phone.getBoundingClientRect();
    const dx = (window.innerWidth / 2) - (rect.left + rect.width / 2);
    const dy = (window.innerHeight / 2) - (rect.top + rect.height / 2);
    phone.style.setProperty('--tx', `${dx}px`);
    phone.style.setProperty('--ty', `${dy}px`);
    phone.classList.remove('is-ringing');
    phone.classList.add('is-raised');
    this._phoneRinging = false;
    this._phoneLift = true;
    const item = this._phoneItem;
    if (settings.get('reduceMotion')) {
      this._phoneLift = false;
      phone.classList.add('hidden');
      phone.classList.remove('is-raised');
      this._openNotify(item);
      return;
    }
    let done = false;
    const finish = (ev) => {
      if (done) return;
      if (ev && ev.propertyName && ev.propertyName !== 'transform') return;
      done = true;
      phone.removeEventListener('transitionend', finish);
      this._phoneLift = false;
      phone.classList.add('hidden');
      phone.classList.remove('is-raised');
      phone.style.removeProperty('--tx');
      phone.style.removeProperty('--ty');
      this._openNotify(item);
    };
    phone.addEventListener('transitionend', finish);
    window.setTimeout(() => finish(), 900);
  }

  _openNotify(ready) {
    const w = this.world;
    if (!w || this.notify.open) return;
    const item = ready || this._phoneItem;
    if (!item) return;
    this._phoneItem = null;

    this.mode = MODE.NOTIFY;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);
    ui.showScreen('screen-notify');
    document.getElementById('screen-notify')?.classList.add('is-from-hand');
    debug.syncMinigameButtons();

    this.notify.start(item, {
      onAnswer: (right, q, picked) => {
        w.questionsAsked++;
        if (right) {
          w.questionsRight++;
          w.questionsFirstTry++;
        } else this._makeNoise(QUIZ.wrongAnswerNoise * 0.65);

        const meta = w.progress?.recordAnswer?.(q, right, picked, 'sel');
        if (meta?.revealed) {
          ui.toast('Study Guide unlocked a SEL answer!', 'good', 2800);
        }
      },
      onComplete: (passed) => {
        this._notifyGap = NOTIFY.minGapSeconds;
        this._notifyTimer = this._scheduleNotifyTimer();
        this._exitMinigameToPlaying();
        if (passed) {
          ui.toast('Notification cleared. Back to the lab.', 'good', 2200);
        }
      },
    });
  }

  // ================================================================ terminals

  _openTerminal(index) {
    const w = this.world;
    if (w.lab.laptops[index].solved) return;

    this._activeTerminalIndex = index;

    const exclude = w.progress?.excludeIds?.() || null;
    const questions = drawForTerminal(index, QUIZ.questionsPerLaptop, w.rng, {
      excludeIds: exclude,
      difficulty: this.settings.difficulty,
    });
    w.terminalQuestions[index] = questions;
    w.progress?.noteServed?.(idsOf(questions));

    this.mode = MODE.QUIZ;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);
    ui.showScreen('screen-quiz');
    const frozen = this._terminalsFrozen();
    this.quiz.setThreat(false, frozen);
    debug.syncMinigameButtons();
    audio.terminalOpen();

    this.quiz.start(index, questions, {
      onAnswer: (right, q, picked) => {
        w.questionsAsked++;
        if (right) {
          w.questionsRight++;
          w.questionsFirstTry++;
          w.player.addBattery(34);
          for (const m of w.enemies.mice) m.calm = 8;
          ui.toast('First try. Beam refilled. The mice lose you.', 'good', 2600);
        } else this._makeNoise(QUIZ.wrongAnswerNoise);

        const meta = w.progress?.recordAnswer?.(q, right, picked, index);
        if (meta?.revealed) {
          ui.toast('Study Guide unlocked an answer!', 'good', 2800);
        }
      },
      onComplete: (passed, correct, total) => {
        if (passed) {
          this._openDecrypt(index, correct, total);
        } else {
          this.terminalCooldowns[index] = QUIZ.failLockout;
          w.enemies.setGlobalAlert(w.diff.failAlertSeconds ?? QUIZ.failAlertSeconds);
          this._exitMinigameToPlaying();
          audio.terminalDenied();
          ui.toast(
            `ACCESS DENIED — only ${correct} of ${total} credentials accepted on first try. `
            + `Terminal locked ${QUIZ.failLockout}s. Enemies alerted!`,
            'bad', 5200,
          );
        }
      },
      onBail: () => {
        this._exitMinigameToPlaying();
        ui.toast('You backed away from the Chromebook.', 'warn');
      },
    });
  }

  _openDecrypt(index, correct, total) {
    const w = this.world;
    this._activeTerminalIndex = index;
    this.mode = MODE.DECRYPT;
    ui.showScreen('screen-decrypt');
    debug.syncMinigameButtons();

    this.decrypt.start(w.fragments[index], w.diff.decryptScans, {
      onComplete: (success, attempts) => {
        w.decryptAttempts += attempts;
        if (success) this._awardPiece(index, correct, total);
        else {
          this.terminalCooldowns[index] = 16;
          this._exitMinigameToPlaying();
          ui.toast('Decryption failed. The fragment re-scrambled.', 'bad', 3600);
        }
      },
      onBail: () => {
        this.terminalCooldowns[index] = 8;
        this._exitMinigameToPlaying();
        ui.toast('Decryption aborted.', 'warn');
      },
      onMiss: (left) => {
        if (left === 1) ui.toast('One scan left!', 'bad', 1500);
      },
    });
  }

  _awardPiece(index, correct, total) {
    const w = this.world;
    w.earned[index] = w.fragments[index];
    w.lab.markLaptopSolved(index, w.fragments[index]);
    ui.setPieces(w.earned);
    audio.codePiece();
    ui.fxBloom('good');

    const found = w.earned.filter(Boolean).length;
    w.lab.updatePrinterPanel(found);

    this._exitMinigameToPlaying();

    ui.toast(
      `CODE PIECE ${found}/${CODE_PARTS} SECURED: ${w.fragments[index]}`,
      'good', 3600,
    );

    // The lab reacts to your progress
    const [pcx, pcy] = w.maze.worldToCell(w.player.pos.x, w.player.pos.z);
    if (!w.diff.noEnemies) {
      w.enemies.escalate([pcx, pcy]);
    }

    if (found >= CODE_PARTS) {
      w.lab.setPrinterUnlocked(true);
      ui.toast('ALL FOUR PIECES! The 3D printer just woke up.', 'good', 5000);
    } else if (!w.diff.noEnemies) {
      ui.toast('Something heard that. It is coming.', 'warn', 3000);
    }
  }

  /** Returns from a menu or minigame to gameplay, restoring mouse capture. */
  _exitMinigameToPlaying() {
    this.mode = MODE.PLAYING;
    this._phoneRinging = false;
    const phone = document.getElementById('pocket-phone');
    phone?.classList.remove('is-ringing', 'is-raised');
    ui.hideAllScreens();
    ui.setHudVisible(true);
    input.setEnabled(true);
    input.clearEdges();
    input.showTouchUi(true);
    const canvas = document.getElementById('scene');
    if (canvas) canvas.focus({ preventScroll: true });
  }

  /** Loud events pull nearby hunters toward the player. */
  _makeNoise(radius) {
    const w = this.world;
    for (const m of w.enemies.mice) {
      const d = Math.hypot(m.pos.x - w.player.pos.x, m.pos.z - w.player.pos.z);
      if (d < radius) {
        m.state = 1;
        m.lastKnown = { x: w.player.pos.x, z: w.player.pos.z };
        m.searchTimer = 5;
      }
    }
  }

  // ================================================================== printer

  _openPrinter() {
    const w = this.world;
    this.mode = MODE.PRINTER;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);

    const host = document.getElementById('printer-code');
    host.innerHTML = w.earned
      .map((f) => `<div class="pcode-part${f ? ' is-filled' : ''}">${f || '???'}</div>`)
      .join('');

    const status = document.getElementById('printer-status');
    const ready = w.earned.every(Boolean);
    status.className = `printer-status ${ready ? 'is-ready' : 'is-locked'}`;
    status.textContent = ready
      ? 'Full decryption key accepted. Printing takes about 14 seconds, and the lab WILL notice. Stay alive.'
      : 'Missing code pieces. Find the remaining Chromebooks.';

    document.getElementById('printer-go').classList.toggle('hidden', !ready);
    document.getElementById('printer-progress').classList.add('hidden');
    ui.showScreen('screen-printer');
  }

  _closePrinter() {
    if (this.mode !== MODE.PRINTER) return;
    audio.uiClick();
    this._exitMinigameToPlaying();
  }

  _beginPrint() {
    const w = this.world;
    if (w.printing || w.printerDone) return;
    audio.uiClick();
    audio.printerStart();

    w.printing = true;
    w.printProgress = 0;
    this._printSoundTimer = 0;

    const [pcx, pcy] = w.maze.worldToCell(w.player.pos.x, w.player.pos.z);
    if (!w.diff.noEnemies) {
      w.enemies.startSwarm([pcx, pcy]);
    }

    this._exitMinigameToPlaying();
    if (w.diff.noEnemies) {
      ui.toast('Printing your exit key...', 'good', 4000);
    } else {
      ui.toast('PRINTING! Everything in the lab just turned toward you.', 'bad', 5000);
    }
  }

  _updatePrint(dt) {
    const w = this.world;
    w.printProgress = clamp(w.printProgress + dt / PRINTER.printSeconds, 0, 1);
    w.lab.updatePrinterPanel(4, true, w.printProgress);

    // Print head sweeps back and forth
    const head = w.lab.printer.head;
    head.position.x = Math.sin(w.runTime * 6) * 0.55;
    head.position.z = Math.cos(w.runTime * 2.4) * 0.35;
    head.position.y = 0.62 + w.printProgress * 0.5;

    this._printSoundTimer -= dt;
    if (this._printSoundTimer <= 0) {
      this._printSoundTimer = 0.16;
      const d = Math.hypot(w.player.pos.x - w.lab.printer.x, w.player.pos.z - w.lab.printer.z);
      if (d < 14) audio.printerStep();
    }

    if (w.printProgress >= 1) {
      w.printing = false;
      w.printerDone = true;
      w.enemies.endSwarm();
      w.lab.spawnKey();
      w.lab.updatePrinterPanel(4);
      audio.keyReady();
      ui.toast('THE KEY IS PRINTED. Take it!', 'good', 4000);
    }
  }

  _takeKey() {
    const w = this.world;
    if (w.keyTaken) return;
    w.keyTaken = true;
    w.player.hasKey = true;
    w.lab.removeKeyMesh();
    audio.keyReady();
    ui.toast('KEY IN HAND. Use it on the EXIT door.', 'good', 4200);
  }

  // ================================================================ end states

  _escape() {
    const w = this.world;
    if (w.escaped) return;
    if (!w.keyTaken) return;
    w.lab.openExitDoor();
    w.escaped = true;
    this.mode = MODE.WIN;
    audio.doorOpen();
    ui.fxBloom('win');
    setTimeout(() => audio.victory(), 500);
    audio.stopAmbience();
    audio.setMuffled(false);

    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);
    ui.clearToasts();

    const asked = w.questionsAsked || 1;
    const acc = Math.round((w.questionsRight / asked) * 100);
    const time = formatTime(w.runTime);

    const found = w.earned.filter(Boolean).length;
    const scoreResult = computeRunScore(w, true);

    const delta = w.progress?.finishRun?.({
      escaped: true,
      seconds: w.runTime,
      pieces: found,
      levelId: w.level?.id,
      difficulty: this.settings.difficulty,
      stats: w.player.stats,
    }) || null;

    ui.showVictory({
      stats: [
        { label: 'RUN SCORE', value: scoreResult.score, tone: 'good' },
        { label: 'ESCAPE TIME', value: time, tone: 'good' },
        { label: 'FLOOR', value: w.level?.codename || 'LEVEL' },
        { label: 'QUESTIONS RIGHT', value: `${w.questionsRight}/${w.questionsAsked}` },
        { label: 'ACCURACY', value: `${acc}%`, tone: acc >= 80 ? 'good' : '' },
        { label: 'SNACKS EATEN', value: w.player.stats.cheetosEaten },
        { label: 'HITS TAKEN', value: w.player.stats.damageTaken, tone: w.player.stats.damageTaken === 0 ? 'good' : 'bad' },
        { label: 'DIFFICULTY', value: w.diff.label },
      ],
      report: [
        `<strong>${w.level?.name || 'The lab'}:</strong> ${w.level?.flavor || ''}`,
        `<strong>Design process:</strong> you worked a real DEFINE - PREPARE - TRY - REFLECT cycle to get out.`,
        `<strong>Code pieces decrypted:</strong> ${found} of ${CODE_PARTS}, using ${w.decryptAttempts} card flips.`,
        `<strong>Accuracy:</strong> ${acc}% on ${w.questionsAsked} questions across all four terminals.`,
        delta?.unlocked?.length
          ? `<strong>Unlocked:</strong> ${delta.unlocked.map((i) => getLevel(i).name).join(', ')}`
          : '',
        acc >= 80
          ? '<strong>Next challenge:</strong> try SYSTEM CRASH difficulty, or beat your escape time.'
          : '<strong>Next challenge:</strong> read each explanation before you hit CONTINUE, then run it again.',
      ].filter(Boolean),
    });

    sessionUi.renderLevelSelect();
    highscoresUi.presentEndScreen(scoreResult);
  }

  _gameOver() {
    if (this._dying) return;
    const w = this.world;
    if (!w) return;
    this._dying = true;
    this._phoneRinging = false;
    this._phoneLift = false;
    document.getElementById('pocket-phone')?.classList.remove('is-ringing', 'is-raised');
    this.mode = MODE.OVER;
    audio.jumpscare();
    setTimeout(() => audio.defeat(), 400);
    audio.stopAmbience();
    audio.setMuffled(false);
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);
    ui.clearToasts();
    input.showTouchUi(false);
    w.player.flashlightOn = false;
    w.lighting?.setFlashlight(false);

    const found = w.earned.filter(Boolean).length;
    const asked = w.questionsAsked || 0;
    const acc = asked ? Math.round((w.questionsRight / asked) * 100) : 0;
    const tips = [
      'Tables are safety. Duck under one and the mice lose you completely.',
      'The flashlight pushes viruses away but pulls mice toward you. Choose per hallway.',
      'Sprinting is loud. Walking is quiet. Crouching is almost silent.',
      'Grab every battery you see, even at full charge you will want the next one.',
      'You only need 2 of 3 questions right at a terminal. Read the explanations.',
    ];
    const delta = w.progress?.finishRun?.({
      escaped: false,
      seconds: w.runTime,
      pieces: found,
      levelId: w.level?.id,
      difficulty: this.settings.difficulty,
      stats: w.player.stats,
    }) || null;
    const scoreResult = computeRunScore(w, false);
    const progLines = [];
    if (delta?.mastered) progLines.push(`+${delta.mastered} mastered in Study Guide`);
    if (delta?.revealed) progLines.push(`+${delta.revealed} answers revealed`);
    if (delta?.micePopped) progLines.push(`${delta.micePopped} mice popped`);
    const flavor = found >= CODE_PARTS
      ? 'You had the whole code. The printer was right there. The dark got there first.'
      : 'The lab goes quiet. Somewhere, four Chromebooks are still glowing, still waiting.';
    const tip = tips[Math.floor(Math.random() * tips.length)];
    const pad = (label, value) => {
      const head = `> ${label} `;
      const tail = ` ${value}`;
      const width = 42;
      const dots = Math.max(2, width - head.length - tail.length);
      return head.length + tail.length >= width ? `${head}${tail}` : head + '.'.repeat(dots) + tail;
    };
    const readout = [
      'SYSTEM FAILURE',
      '',
      flavor,
      '',
      pad('RUN SCORE', String(scoreResult.score)),
      pad('CODE PIECES', `${found}/${CODE_PARTS}`),
      pad('FLOOR', w.level?.codename || 'LEVEL'),
      pad('SURVIVED', formatTime(w.runTime)),
      pad('QUESTIONS', asked ? `${w.questionsRight}/${asked}` : '0/0'),
      pad('ACCURACY', `${acc}%`),
      ...(progLines.length ? ['', progLines.join('  ·  ')] : []),
      '',
      `TIP  ${tip}`,
    ];

    this._death = {
      t: 0,
      y0: w.player.pos.y,
      pitch0: w.player.pitch,
      floorY: w.player.onTable ? 1.02 : 0.22,
      shown: false,
      payload: {
        title: 'SYSTEM FAILURE',
        flavor,
        stats: [
          { label: 'RUN SCORE', value: scoreResult.score },
          { label: 'CODE PIECES', value: `${found}/${CODE_PARTS}`, tone: found >= CODE_PARTS ? 'good' : 'bad' },
          { label: 'FLOOR', value: w.level?.codename || 'LEVEL' },
          { label: 'SURVIVED', value: formatTime(w.runTime) },
          { label: 'QUESTIONS RIGHT', value: `${w.questionsRight}/${w.questionsAsked}` },
          { label: 'ACCURACY', value: `${acc}%` },
          ...(progLines.length ? [{ label: 'THIS RUN', value: progLines.join(' · '), tone: 'good' }] : []),
        ],
        tip: `TIP: ${tip}`,
        readout,
        scoreResult,
      },
    };
  }

  _stepDeath(dt) {
    const d = this._death;
    const w = this.world;
    if (!d || d.shown || !w) return;
    if (d.shatter) {
      const canvas = document.getElementById('death-shatter');
      if (canvas && drawShatter(d.shatter, canvas, dt)) this._presentDeath();
      return;
    }
    d.t += dt;
    const reduce = !!settings.get('reduceMotion');
    const fall = reduce ? 0.28 : 1.7;
    const u = Math.min(1, d.t / fall);
    const grav = u * u;
    const p = w.player;
    p.pos.y = d.y0 + (d.floorY - d.y0) * grav;
    p.pitch = d.pitch0 + (-1.22 - d.pitch0) * grav;
    p.syncCamera(this.camera);
    this.camera.rotation.z = grav * 0.48;
    const scene = document.getElementById('scene');
    if (!reduce && u > 0.2) scene?.classList.add('is-dying');
    if (reduce) {
      if (d.t >= fall + 0.35) this._presentDeath();
      return;
    }
    if (u >= 0.88) d.freezeNext = true;
  }

  _freezeDeathFrame() {
    const d = this._death;
    if (!d || d.shatter) return;
    d.freezeNext = false;
    document.getElementById('scene')?.classList.remove('is-dying');
    const dest = document.getElementById('death-shatter');
    if (!dest) {
      this._presentDeath();
      return;
    }
    const rect = dest.parentElement?.getBoundingClientRect();
    dest.width = Math.max(2, Math.floor(rect?.width || 640));
    dest.height = Math.max(2, Math.floor(rect?.height || 360));
    dest.classList.add('is-on');
    let snap = null;
    try { snap = this._blurredStill(); } catch { snap = null; }
    if (!snap) snap = this._plainStill();
    d.shatter = createShatter(snap, 10, 6);
    drawShatter(d.shatter, dest, 0.016);
  }

  _blurredStill() {
    const w = 320;
    const h = 180;
    const rt = new THREE.WebGLRenderTarget(w, h);
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.camera);
    const buf = new Uint8Array(w * h * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    this.renderer.setRenderTarget(null);
    rt.dispose();
    const raw = document.createElement('canvas');
    raw.width = w;
    raw.height = h;
    const img = raw.getContext('2d').createImageData(w, h);
    for (let y = 0; y < h; y++) {
      img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    }
    raw.getContext('2d').putImageData(img, 0, 0);
    const blur = document.createElement('canvas');
    blur.width = w;
    blur.height = h;
    const b = blur.getContext('2d');
    b.filter = 'blur(5px)';
    b.drawImage(raw, 0, 0);
    return blur;
  }

  _plainStill() {
    const c = document.createElement('canvas');
    c.width = 320;
    c.height = 180;
    const g = c.getContext('2d');
    g.fillStyle = '#04110c';
    g.fillRect(0, 0, 320, 180);
    g.fillStyle = '#163222';
    for (let y = 0; y < 180; y += 10) g.fillRect(0, y, 320, 2);
    return c;
  }

  _presentDeath() {
    const d = this._death;
    if (!d || d.shown) return;
    d.shown = true;
    document.getElementById('scene')?.classList.remove('is-dying');
    document.getElementById('death-shatter')?.classList.remove('is-on');
    const veil = document.getElementById('death-veil');
    if (veil) {
      veil.classList.remove('is-blink');
      veil.classList.add('is-black');
      veil.style.opacity = '1';
    }
    ui.showGameOver(d.payload);
    highscoresUi.presentEndScreen(d.payload.scoreResult);
  }

  _clearDeath() {
    this._dying = false;
    this._death = null;
    ui.finishOverReadout();
    document.getElementById('scene')?.classList.remove('is-dying');
    document.getElementById('death-shatter')?.classList.remove('is-on');
    const veil = document.getElementById('death-veil');
    if (veil) {
      veil.classList.remove('is-blink', 'is-black');
      veil.style.opacity = '0';
    }
  }

  // ============================================================== playtest debug

  _bindDebug() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('debug-unlock-btn', 'click', () => {
      const inputEl = document.getElementById('debug-code');
      const code = inputEl?.value ?? '';
      if (debug.tryUnlock(code)) {
        audio.uiClick();
        debug.syncPanel();
        ui.toast('Playtest cheats unlocked.', 'good', 2800);
      } else {
        audio.deny();
        ui.toast(`Wrong code. Hint: ${DEBUG_CODE}`, 'warn', 2200);
      }
    });

    on('debug-pieces', 'click', () => {
      audio.uiClick();
      this._debugAwardAllPieces();
      this.resume();
    });
    on('debug-print', 'click', () => {
      audio.uiClick();
      this._debugFinishPrinter();
      this.resume();
    });
    on('debug-key', 'click', () => {
      audio.uiClick();
      this._debugGiveKey();
      this.resume();
    });
    on('debug-exit', 'click', () => {
      audio.uiClick();
      this._debugTeleportExit();
      this.resume();
    });
    on('debug-heal', 'click', () => {
      audio.uiClick();
      this._debugGodMode();
      this.resume();
    });
    on('debug-win', 'click', () => {
      audio.uiClick();
      this._debugWin();
    });
    on('debug-disable', 'click', () => {
      audio.uiClick();
      debug.disable();
      debug.syncPanel();
      if (this.world) this._applyDebugPerks(true);
      ui.toast('Playtest cheats disabled.', 'warn');
    });

    on('debug-flag-bright', 'change', (e) => {
      debug.fullBright = e.target.checked;
      debug._saveFlags();
      if (this.world) this._applyDebugPerks();
    });
    on('debug-flag-invuln', 'change', (e) => {
      debug.invincible = e.target.checked;
      debug._saveFlags();
      if (this.world) this._applyDebugPerks();
    });
    on('debug-flag-skip', 'change', (e) => {
      debug.skipMinigames = e.target.checked;
      debug._saveFlags();
      debug.syncMinigameButtons();
    });

    on('debug-skip-quiz', 'click', () => {
      audio.uiClick();
      this.quiz.debugSkipAll();
    });
    on('debug-skip-decrypt', 'click', () => {
      audio.uiClick();
      this.decrypt.debugSkip();
    });
    on('debug-skip-notify', 'click', () => {
      audio.uiClick();
      this.notify.debugSkip();
    });

    debug.syncPanel();
  }

  _applyDebugPerks(revert = false) {
    const w = this.world;
    if (!w) return;

    if (!debug.enabled || revert) {
      if (w.player) w.player.debugGod = false;
      const base = (this.settings.brightness / 100) * (w.level?.brightnessScale || 1);
      w.lighting.setBrightness(base);
      return;
    }

    if (debug.invincible) {
      w.player.debugGod = true;
      w.player.health = w.player.maxHealth;
      ui.setHealth(w.player.health);
    } else {
      w.player.debugGod = false;
    }

    if (debug.fullBright) {
      const base = (this.settings.brightness / 100) * (w.level?.brightnessScale || 1);
      w.lighting.setBrightness(base * debug.brightnessMultiplier());
      w.player.flashlightOn = true;
      w.lighting.setFlashlight(true);
      w.player.battery = PLAYER.batteryMax;
    } else {
      const base = (this.settings.brightness / 100) * (w.level?.brightnessScale || 1);
      w.lighting.setBrightness(base);
    }
  }

  _debugAwardAllPieces() {
    const w = this.world;
    if (!w) return;
    for (let i = 0; i < CODE_PARTS; i++) {
      w.earned[i] = w.fragments[i];
      w.lab.markLaptopSolved(i, w.fragments[i]);
    }
    ui.setPieces(w.earned);
    w.lab.setPrinterUnlocked(true);
    w.lab.updatePrinterPanel(CODE_PARTS);
    ui.toast('DEBUG: all four code pieces awarded.', 'good', 2400);
  }

  _debugFinishPrinter() {
    this._debugAwardAllPieces();
    const w = this.world;
    if (!w) return;
    w.printing = false;
    w.printerDone = true;
    w.enemies.endSwarm?.();
    w.lab.spawnKey();
    w.lab.updatePrinterPanel(CODE_PARTS);
    ui.toast('DEBUG: key printed on the bed.', 'good', 2400);
  }

  _debugGiveKey() {
    this._debugFinishPrinter();
    if (!this.world?.keyTaken) this._takeKey();
  }

  _debugTeleportExit() {
    const w = this.world;
    const exit = w?.lab?.exit;
    if (!exit) return;
    const [cx, cy] = exit.cell;
    const px = w.maze.cellToWorldX(cx);
    const pz = w.maze.cellToWorldZ(cy);
    w.player.pos.x = px;
    w.player.pos.z = pz;
    w.player.vel.x = 0;
    w.player.vel.z = 0;
  }

  _debugGodMode() {
    debug.invincible = true;
    debug._saveFlags();
    this._applyDebugPerks();
    ui.toast('DEBUG: invincibility on.', 'good', 2000);
  }

  _debugWin() {
    if (!this.world) return;
    if (!this.world.keyTaken) this._debugGiveKey();
    if (this.mode === MODE.PAUSED) this.resume();
    this._escape();
  }
}

/* -------------------------------------------------------------------------- */

const game = new Game();
game.boot().catch((err) => {
  console.error('[Tech Escape] boot failed', err);
  ui.init();
  ui.fatalError(`Something broke while starting up: ${err?.message || err}`);
});

// Exposed for debugging from the console during class demos
window.TechEscape = game;

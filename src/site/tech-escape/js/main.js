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
  CELL, QUALITY, DIFFICULTY, COLORS, PLAYER, PICKUP, QUIZ, DECRYPT, PRINTER, CODE_PARTS, NOTIFY, MOBILE,
} from './config.js';
import { clamp, makeRng, formatTime, guessDeviceIp } from './util.js';
import { input, touchUi } from './input.js';
import { audio } from './audio.js';
import { ui } from './ui.js';
import { Maze } from './world/maze.js';
import { Lab } from './world/lab.js';
import { planLabFurniture, placeLootSpot } from './world/layout.js';
import { TableSurfacePlanner } from './world/table-surface.js';
import { buildScatterProps } from './world/scatter.js';
import { pickPosterCells } from './world/map-poster.js';
import { Lighting } from './world/lighting.js';
import { Player } from './entities/player.js';
import { EnemyManager } from './entities/enemies.js';
import { PickupField } from './entities/pickups.js';
import { ThrowField } from './entities/throwables.js';
import { Inventory } from './entities/inventory.js';
import { disposeModels } from './entities/models.js';
import { Quiz } from './minigames/quiz.js';
import { Decrypt } from './minigames/memory.js';
import { TwoTruths } from './minigames/twoTruths.js';
import { TERMINALS, QUESTION_COUNT } from './data/questions.js';
import { drawTwoTruths, TWO_TRUTHS_COUNT } from './data/twoTruths.js';
import { drawForTerminal, idsOf } from './meta/quizpool.js';
import { saveStore } from './meta/save.js';
import { settings, flashGuard } from './meta/settings.js';
import { getLevel, layoutFor, runProfile } from './meta/levels.js';
import { sessionUi } from './meta/session-ui.js';
import { bindUi } from './meta/bind-ui.js';
import { debug, DEBUG_CODE } from './meta/debug.js';
import { computeRunScore } from './meta/score.js';
import { highscoresUi } from './meta/highscores-ui.js';
import { BootSequence } from './ui/boot.js';
import { captions } from './ui/captions.js';
import { tutorial } from './ui/tutorial.js';
import { threatSector, threatPan } from './threat-direction.js';

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
    this.notify.bindDismiss();
    settings.onChange((k) => {
      if (k === 'binds') input.applyBinds(settings.get('binds'));
    });
    this._applySettings();

    this._bindUi();
    this._bindDebug();
    await this._bootSequence();
    ui.showScreen(null);

    await sessionUi.enterLobby();
    this._startLoop();
  }

  _initRenderer(canvas) {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: QUALITY[this.settings.quality].antialias,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false,
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

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.08, 140);
    this.scene.add(this.camera);

    window.addEventListener('resize', () => this._resize());
    this._resize();
    return true;
  }

  _resize() {
    if (!this.renderer) return;
    const qKey = input.touchMode ? MOBILE.autoQuality : this.settings.quality;
    const q = QUALITY[qKey] || QUALITY.medium;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr) * q.scale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  /**
   * The startup log. Five lines, each one reporting the result of work that
   * genuinely just happened, and the last one printing the code format the player
   * is about to spend the run collecting - so reading it is worth doing.
   *
   * Pacing, skipping and the 10 second ceiling all live in BootSequence.
   */
  async _bootSequence() {
    const boot = new BootSequence({
      log: document.getElementById('boot-log'),
      fill: document.getElementById('load-fill'),
      skip: document.getElementById('boot-skip'),
    });

    await boot.run([
      {
        text: 'NIGHT SHIFT MONITOR ONLINE',
        run: () => this._rendererName.slice(0, 18).toUpperCase(),
      },
      {
        text: 'RETICULATING SPLINES',
        run: () => 'OK',
      },
      {
        text: 'DOOR LOCKS ENGAGED, LIGHTS OFF',
        run: () => 'CONFIRMED',
      },
      {
        text: 'QUANTIMIZING THE INFINITE',
        run: () => '∞',
      },
      {
        text: 'CHROMEBOOKS AWAKE',
        run: () => `${TERMINALS.length} OF ${TERMINALS.length}`,
      },
      {
        text: 'DOWNLOADING YOUR UNIQUE BRAINSTEM ID',
        run: async () => guessDeviceIp(),
      },
      {
        text: 'PROMPT BANK',
        run: () => `${QUESTION_COUNT} READY`,
      },
      {
        text: 'SEL TEXT BANK',
        run: () => `${TWO_TRUTHS_COUNT} READY`,
      },
      {
        // The one line that is worth reading twice
        text: 'EXIT CODE NEEDS',
        run: () => `${CODE_PARTS} FRAGMENTS`,
      },
    ]);
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
      const qKey = input.touchMode ? MOBILE.autoQuality : this.settings.quality;
      this.scene.fog.density = QUALITY[qKey]?.fogDensity ?? QUALITY.medium.fogDensity;
      this._applyDebugPerks();
    }
    this._resize();
    sessionUi._syncSettingsForm?.();
  }

  _bindUi() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('btn-start', 'click', () => {
      audio.init();
      audio.uiClick();
      this.startRun();
    });

    on('btn-settings', 'click', () => {
      audio.uiClick();
      this._returnScreen = 'screen-title';
      ui.showScreen('screen-pause');
      document.getElementById('btn-quit').classList.add('hidden');
      document.querySelector('#screen-pause .panel-title').textContent = 'SETTINGS';
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
        if (this.mode === MODE.PLAYING) {
          e.preventDefault();
          this.pause();
        } else if (this.mode === MODE.PAUSED && this._returnScreen !== 'screen-title') {
          e.preventDefault();
          this.resume();
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

    // Clicking the canvas re-grabs the mouse
    document.getElementById('scene').addEventListener('click', () => {
      if (this.mode === MODE.PLAYING && !input.locked && !input.touchMode) input.requestLock();
    });

    // Losing pointer lock mid-game means the player alt-tabbed or hit Esc (desktop only)
    input.onPointerLockChange = (locked) => {
      if (input.touchMode) return;
      if (!locked && this.mode === MODE.PLAYING && !this.expectUnlock) this.pause();
      this.expectUnlock = false;
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === MODE.PLAYING) this.pause();
    });
  }

  // ============================================================ world build

  startRun() {
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

    const startBatteryCells = maze.openCells().filter(([x, y]) => {
      const d = Math.hypot(x - startCell[0], y - startCell[1]);
      return d >= 1 && d <= 2.5;
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
    lab.updateEmergencyArrows(player.pos);

    const lighting = new Lighting(this.scene, this.camera, QUALITY[this.settings.quality]);
    lighting.setBrightness(
      (this.settings.brightness / 100) * (level.brightnessScale || 1) * debug.brightnessMultiplier(),
    );
    lighting.setFlashlight(player.flashlightOn);

    this._activeTerminalIndex = -1;

    this.scene.fog = new THREE.FogExp2(
      COLORS.fog,
      QUALITY[this.settings.quality].fogDensity * (level.fogScale || 1),
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

    this.mode = MODE.PLAYING;
    input.setEnabled(true);
    input.clearEdges();
    if (input.touchMode) {
      touchUi.requestFullscreen();
      ui.toast('Drag the right side to look. Stick moves. Tap FULL for fullscreen.', 'warn', 5200);
      setTimeout(() => {
        const hint = document.getElementById('touch-look-hint');
        if (hint) hint.classList.add('hidden');
      }, 9000);
    } else {
      input.requestLock();
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

  pause() {
    if (this.mode !== MODE.PLAYING) return;
    this.mode = MODE.PAUSED;
    this._returnScreen = null;
    input.setEnabled(false);
    this.expectUnlock = true;
    input.releaseLock();
    document.getElementById('btn-quit').classList.remove('hidden');
    document.querySelector('#screen-pause .panel-title').textContent = 'PAUSED';
    ui.showScreen('screen-pause');
    ui.setHudVisible(false);
    input.showTouchUi(false);
    debug.syncPanel();
    audio.menuWhoosh();
    audio.setTension(0);
    audio.setMuffled(false);
  }

  resume() {
    if (this.mode !== MODE.PAUSED) return;
    this.mode = MODE.PLAYING;
    ui.hideAllScreens();
    ui.setHudVisible(true);
    input.setEnabled(true);
    input.clearEdges();
    input.showTouchUi(true);
    if (!input.touchMode) input.requestLock();
    this._applyDebugPerks();
  }

  quitToTitle() {
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
      const dt = Math.min(0.05, (now - this.clock.last) / 1000 || 0);
      this.clock.last = now;
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
      const scale = this._minigameTimeScale();
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

      if (settings.get('soundCaptions') && ev.hunters > 0 && ev.nearest < 18) {
        const p = w.player;
        const hunter = w.enemies.mice.find((m) => !m.dead && m.hunting)
          || w.enemies.viruses.find((v) => !v.dead && v.hunting);
        if (hunter) {
          captions.fromWorld('Footsteps', hunter.pos, p, { type: 'enemy' });
        }
      }

      captions.update(dt);

      for (let t = 0; t < this.terminalCooldowns.length; t++) {
        if (this.terminalCooldowns[t] > 0) this.terminalCooldowns[t] -= wdt;
      }

      w.player.syncCamera(this.camera);
      w.lab.updateMapPosters(w.player.pos);
      w.lighting.setFlashlight(w.player.flashlightOn);
      w.lighting.reduceFlashing = settings.get('reduceFlashing');
      w.lab.updateEmergencyArrows(w.player.pos);
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
    this.renderer.render(this.scene, this.camera);
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
        ev.popped === 1 ? 'One mouse popped!' : `${ev.popped} mice popped!`,
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
        if (kind === 'cheetos') ui.toast('Hot cheetos picked up. R to eat, E to throw.', 'good', 2200);
        else if (kind === 'soda') ui.toast('Soda can picked up. Q to select, R to drink.', 'good', 2000);
        else if (kind === 'antivirus') ui.toast('Anti-virus disc! Aim at a virus and press E.', 'good', 2800);
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

    if (input.pressed('eatCheetos') || mf?.eat) {
      if (inv.selected === 'soda' && inv.has('soda')) {
        if (inv.remove('soda') && w.player.drinkSoda()) {
          ui.updateInventoryBar(inv);
          ui.toast('Soda boost! Stamina refilled.', 'good');
        }
      } else if (inv.has('cheetos')) {
        if (w.player.health >= w.player.maxHealth) {
          ui.toast('Snack bar full — throw a bag to lure mice.', 'warn');
        } else if (inv.remove('cheetos') && w.player.heal(PICKUP.cheetosHeal)) {
          ui.setHealth(w.player.health);
          ui.updateInventoryBar(inv);
          ui.toast('Hot cheetos! Snack energy restored.', 'good');
        }
      } else if (inv.has('soda') && inv.remove('soda') && w.player.drinkSoda()) {
        ui.updateInventoryBar(inv);
        ui.toast('Soda boost! Stamina refilled.', 'good');
      } else {
        ui.toast('No hot cheetos to eat.', 'warn', 1200);
      }
    }

    if (input.pressed('throw') || (mf?.primary && !this._mousePrimaryUsed)) {
      this._throwAimedItem();
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

  _throwAimedItem() {
    const w = this.world;
    const inv = w.inventory;
    const pick = this._resolveThrowKind(w);
    if (!pick.kind) {
      audio.deny();
      if (pick.msg) ui.toast(pick.msg, 'warn', 2200);
      return;
    }
    if (!inv.remove(pick.kind)) {
      audio.deny();
      return;
    }
    const dir = w.player.forward();
    const thrown = w.throws.throwItem(pick.kind, w.player.eyePos, dir);
    if (!thrown) {
      inv.add(pick.kind, 1);
      audio.deny();
      return;
    }
    w.player.stats.itemsThrown++;
    ui.updateInventoryBar(inv);
    ui.toast(
      pick.kind === 'cheetos'
        ? 'Bag thrown — mice will smell it.'
        : 'Disc thrown at the virus!',
      'good', 1600,
    );
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
          : 'Space to climb up, C to crawl under and grab loot');
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

    if (input.pressed('light') || mf?.light) p.toggleFlashlight();
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
    if (this._notifyTimer <= 0) this._openNotify();
  }

  _openNotify() {
    const w = this.world;
    if (!w || this.notify.open) return;

    const exclude = w.progress?.excludeIds?.() || null;
    const item = drawTwoTruths(w.rng, exclude);
    if (!item) return;

    w.progress?.noteServed?.([item.id]);

    this.mode = MODE.NOTIFY;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);
    ui.showScreen('screen-notify');
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
          w.enemies.setGlobalAlert(QUIZ.failAlertSeconds);
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
    ui.hideAllScreens();
    ui.setHudVisible(true);
    input.setEnabled(true);
    input.clearEdges();
    input.showTouchUi(true);
    if (!input.touchMode) input.requestLock();
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

  _gameOver(ev) {
    const w = this.world;
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

    const found = w.earned.filter(Boolean).length;
    const asked = w.questionsAsked || 1;
    const acc = Math.round((w.questionsRight / asked) * 100);

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

    ui.showGameOver({
      title: 'SYSTEM FAILURE',
      flavor: found >= CODE_PARTS
        ? 'You had the whole code. The printer was right there. The dark got there first.'
        : 'The lab goes quiet. Somewhere, four Chromebooks are still glowing, still waiting.',
      stats: [
        { label: 'RUN SCORE', value: scoreResult.score },
        { label: 'CODE PIECES', value: `${found}/${CODE_PARTS}`, tone: found >= CODE_PARTS ? 'good' : 'bad' },
        { label: 'FLOOR', value: w.level?.codename || 'LEVEL' },
        { label: 'SURVIVED', value: formatTime(w.runTime) },
        { label: 'QUESTIONS RIGHT', value: `${w.questionsRight}/${w.questionsAsked}` },
        { label: 'ACCURACY', value: `${acc}%` },
        ...(progLines.length ? [{ label: 'THIS RUN', value: progLines.join(' · '), tone: 'good' }] : []),
      ],
      tip: `TIP: ${tips[Math.floor(Math.random() * tips.length)]}`,
    });
    highscoresUi.presentEndScreen(scoreResult);
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

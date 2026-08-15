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
  CELL, QUALITY, DIFFICULTY, COLORS, PLAYER, PICKUP, QUIZ, DECRYPT, PRINTER, CODE_PARTS,
} from './config.js';
import { clamp, makeRng, formatTime } from './util.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { ui } from './ui.js';
import { Maze } from './world/maze.js';
import { Lab } from './world/lab.js';
import { Lighting } from './world/lighting.js';
import { Player } from './entities/player.js';
import { EnemyManager } from './entities/enemies.js';
import { PickupField } from './entities/pickups.js';
import { ThrowField } from './entities/throwables.js';
import { Inventory } from './entities/inventory.js';
import { disposeModels } from './entities/models.js';
import { Quiz } from './minigames/quiz.js';
import { Decrypt } from './minigames/memory.js';
import { TERMINALS, QUESTION_COUNT } from './data/questions.js';
import { drawForTerminal, idsOf } from './meta/quizpool.js';
import { saveStore } from './meta/save.js';
import { settings, flashGuard } from './meta/settings.js';
import { getLevel, layoutFor, runProfile } from './meta/levels.js';
import { sessionUi } from './meta/session-ui.js';
import { bindUi } from './meta/bind-ui.js';
import { BootSequence } from './ui/boot.js';
import { captions } from './ui/captions.js';

const MODE = {
  LOADING: 'loading',
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  QUIZ: 'quiz',
  DECRYPT: 'decrypt',
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
  }

  // ================================================================== boot

  async boot() {
    ui.init();
    settings.load();
    captions.init();
    saveStore.init();
    this._loadSettings();

    const canvas = document.getElementById('scene');
    if (!this._initRenderer(canvas)) return;

    input.init(canvas);
    input.applyBinds(settings.get('binds'));
    sessionUi.bind(this);
    bindUi.init();
    settings.onChange((k) => {
      if (k === 'binds') {
        input.applyBinds(settings.get('binds'));
        ui.updateControlLegend();
      }
    });
    this._applySettings();

    this._bindUi();
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
    const q = QUALITY[this.settings.quality];
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
        text: 'DOOR LOCKS ENGAGED, LIGHTS OFF',
        run: () => 'CONFIRMED',
      },
      {
        text: 'CHROMEBOOKS AWAKE',
        run: () => `${TERMINALS.length} OF ${TERMINALS.length}`,
      },
      {
        text: 'PROMPT BANK',
        run: () => `${QUESTION_COUNT} READY`,
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
    audio.setMuted(this.settings.muted);
    document.body.classList.toggle('reduce-fx', this.settings.reduceFx);
    if (this.world) {
      this.world.lighting.setBrightness(this.settings.brightness / 100);
      this.world.player.reduceFx = this.settings.reduceFx;
      this.scene.fog.density = QUALITY[this.settings.quality].fogDensity;
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
      this.startRun();
    });
    on('btn-over-title', 'click', () => {
      audio.uiClick();
      this.quitToTitle();
    });
    on('btn-win-again', 'click', () => {
      audio.uiClick();
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
    });

    // Clicking the canvas re-grabs the mouse
    document.getElementById('scene').addEventListener('click', () => {
      if (this.mode === MODE.PLAYING && !input.locked) input.requestLock();
    });

    // Losing pointer lock mid-game means the player alt-tabbed or hit Esc
    input.onPointerLockChange = (locked) => {
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
    const baseDiff = DIFFICULTY[this.settings.difficulty];
    const diff = runProfile(level, baseDiff);
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0;
    const rng = makeRng(seed);

    const layout = layoutFor(level);
    let maze = new Maze(rng, layout);
    let attempts = 0;
    while (attempts++ < 10) {
      const open = maze.openCells();
      const [sx, sy] = open[0];
      if (maze.isFullyConnected(sx, sy)) break;
      maze = new Maze(rng, layout);
    }

    const lab = new Lab(this.scene, maze, rng);
    const open = maze.openCells();
    const used = new Set();
    const key = (c) => `${c[0]},${c[1]}`;
    const reserve = (cells) => cells.forEach((c) => used.add(key(c)));
    const freeCells = () => open.filter((c) => !used.has(key(c)));

    const laptopCells = maze.spreadCells(CODE_PARTS, [], level.terminalSeparation || 7);
    reserve(laptopCells);

    const printerCell = maze.spreadCells(1, laptopCells, 6)[0];
    reserve([printerCell]);

    const border = freeCells().filter(([x, y]) => (
      x <= 2 || y <= 2 || x >= maze.size - 3 || y >= maze.size - 3
    ));
    const exitCell = border.length ? rng.pick(border) : rng.pick(freeCells());
    reserve([exitCell]);

    const startPool = freeCells().filter(
      (c) => Math.hypot(c[0] - exitCell[0], c[1] - exitCell[1]) > maze.size * 0.45,
    );
    const startCell = startPool.length ? rng.pick(startPool) : rng.pick(freeCells());
    reserve([startCell]);

    lab.buildLaptops(laptopCells);
    lab.buildPrinter(printerCell);
    lab.buildExit(exitCell);

    const tableCells = rng.shuffle(freeCells()).slice(0, Math.round(open.length * (level.tableDensity || 0.22)));
    reserve(tableCells);
    lab.buildTables(tableCells);

    const propCells = rng.shuffle(freeCells()).slice(0, Math.round(open.length * (level.propDensity || 0.1)));
    reserve(propCells);
    lab.buildProps(propCells);

    const inventory = new Inventory();
    const pickups = new PickupField(this.scene, maze, rng);
    const throws = new ThrowField(this.scene, maze, rng);

    const propSet = new Set(propCells.map(key));
    const lootCells = rng.shuffle(open.filter(
      (c) => key(c) !== key(startCell) && !propSet.has(key(c)),
    ));
    let li = 0;
    for (let i = 0; i < diff.cheetos; i++) {
      pickups.spawn('cheetos', lootCells[li++ % lootCells.length]);
    }
    for (let i = 0; i < diff.batteries; i++) {
      pickups.spawn('battery', lootCells[li++ % lootCells.length]);
    }
    for (let i = 0; i < (diff.sodas || 0); i++) {
      pickups.spawn('soda', lootCells[li++ % lootCells.length]);
    }
    for (let i = 0; i < (diff.antivirus || 0); i++) {
      pickups.spawn('antivirus', lootCells[li++ % lootCells.length]);
    }

    const player = new Player(maze, lab, startCell, diff);
    player.reduceFx = this.settings.reduceFx;
    player.yaw = this._bestStartYaw(maze, startCell);

    const lighting = new Lighting(this.scene, this.camera, QUALITY[this.settings.quality]);
    lighting.setBrightness((this.settings.brightness / 100) * (level.brightnessScale || 1));

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
    input.requestLock();

    ui.toast(`${level.name} — four terminals, four code pieces. Do not get cornered.`, 'warn', 4200);
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
    input.requestLock();
  }

  quitToTitle() {
    this._teardownWorld();
    audio.stopAmbience();
    audio.setMuffled(false);
    this.mode = MODE.TITLE;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    input.showTouchUi(false);
    ui.setHudVisible(false);
    ui.clearToasts();
    sessionUi.renderTitleGreeting();
    sessionUi.renderLevelSelect();
    ui.showScreen('screen-title');
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
    const key = this.settings.difficulty;
    const map = QUIZ.timeScaleByDifficulty;
    return (this.mode === MODE.QUIZ || this.mode === MODE.DECRYPT)
      && map[key] === 0;
  }

  _minigameTimeScale() {
    const key = this.settings.difficulty;
    if (this.mode === MODE.QUIZ) {
      return QUIZ.timeScaleByDifficulty[key] ?? QUIZ.timeScale;
    }
    if (this.mode === MODE.DECRYPT) {
      return DECRYPT.timeScaleByDifficulty[key] ?? DECRYPT.timeScale;
    }
    if (this.mode === MODE.PRINTER) return 0.25;
    return 1;
  }

  _tick(dt) {
    const w = this.world;
    if (!w) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const inMinigame = this.mode === MODE.QUIZ || this.mode === MODE.DECRYPT;
    const controlsActive = this.mode === MODE.PLAYING;
    const worldRunning = this.mode === MODE.PLAYING || inMinigame || this.mode === MODE.PRINTER;
    const frozen = this._terminalsFrozen();

    if (worldRunning) {
      const scale = this._minigameTimeScale();
      const wdt = dt * scale;
      w.runTime += wdt;

      w.enemies.setFrozen(frozen);

      if (controlsActive) w.player.applyLook();
      w.player.update(wdt, controlsActive);

      const lures = w.throws?.lures || null;
      const ev = w.enemies.update(wdt, w.player, lures);
      w.player.burningVirus = ev.burning;
      this._handleCombat(ev, wdt);
      this._handleGlitch(ev);

      const throwEv = w.throws?.update(wdt, w.player, w.enemies) || null;
      this._handleThrows(throwEv);

      const got = w.pickups.update(wdt, w.player, w.inventory);
      this._handlePickups(got);

      if (w.printing) this._updatePrint(wdt);

      this._updateTension(ev, wdt);
      this._updateHud(ev);

      if (controlsActive) {
        this._handleInteraction();
        this._handleInventory();
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
      w.lighting.setFlashlight(w.player.flashlightOn);
      w.lighting.update(
        dt,
        w.player.pos,
        this._collectGlows(),
        w.player.batteryPct,
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
        ui.flashDamage();
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
        }
      }
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
      w.progress?.notePop();
      ui.toast(
        ev.popped === 1 ? 'One mouse popped!' : `${ev.popped} mice popped!`,
        'good', 2200,
      );
    }
    if (ev.virusKilled > 0) {
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

    if (input.pressed('eatCheetos')) {
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

    if (input.pressed('throw')) {
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
    ui.setStamina(p.staminaPct, p.exhausted > 0);
    ui.setBattery(p.batteryPct, p.flashlightOn, ev.burning);
    ui.setHiddenIndicator(p.hidden);
    ui.setCrouched(p.crouching, p.hidden);
    ui.setDanger(ev.hunters > 0 && ev.nearest < 7 && !p.hidden);
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
    if (w.keyTaken) return 'RUN! Get to the EXIT door';
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

    const fwd = p.forward();
    let best = null;
    let bestScore = -Infinity;

    const consider = (target, label, action, enabled = true) => {
      const dx = target.x - px;
      const dz = target.z - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > INTERACT_RANGE) return;
      const dot = dist < 0.001 ? 1 : (dx / dist) * fwd.x + (dz / dist) * fwd.z;
      if (dot < 0.1) return;
      const score = dot * 2 - dist * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = { label, action, enabled };
      }
    };

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
      else if (p.crouching && p.underTable()) ui.showHint('Hidden');
      else if (p.tableNearby()) {
        ui.showHint(p.crouching
          ? 'Crawl under the glowing desk'
          : 'Press C to crouch and crawl under');
      } else ui.showHint(null);
    } else {
      ui.showHint(null);
    }

    if (input.pressed('interact') && best) {
      if (best.enabled && best.action) best.action();
      else audio.deny();
    }

    if (input.pressed('light')) p.toggleFlashlight();
  }

  // ================================================================ terminals

  _openTerminal(index) {
    const w = this.world;
    if (w.lab.laptops[index].solved) return;

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

    this.quiz.start(index, questions, {
      onAnswer: (right, q, picked) => {
        w.questionsAsked++;
        if (right) w.questionsRight++;
        else this._makeNoise(QUIZ.wrongAnswerNoise);

        const meta = w.progress?.recordAnswer?.(q, right, picked, index);
        if (meta?.revealed) {
          ui.toast('Study Guide unlocked an answer!', 'good', 2800);
        }
      },
      onComplete: (passed, correct, total) => {
        if (passed) {
          this._openDecrypt(index, correct, total);
        } else {
          this.terminalCooldowns[index] = 22;
          this._exitMinigameToPlaying();
          ui.toast(
            `ACCESS DENIED - ${correct} of ${total} correct. This terminal reboots in 22s.`,
            'bad', 4200,
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
    this.mode = MODE.DECRYPT;
    ui.showScreen('screen-decrypt');

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

    const found = w.earned.filter(Boolean).length;
    w.lab.updatePrinterPanel(found);

    this._exitMinigameToPlaying();

    ui.toast(
      `CODE PIECE ${found}/${CODE_PARTS} SECURED: ${w.fragments[index]}`,
      'good', 3600,
    );

    // The lab reacts to your progress
    const [pcx, pcy] = w.maze.worldToCell(w.player.pos.x, w.player.pos.z);
    w.enemies.escalate([pcx, pcy]);

    if (found >= CODE_PARTS) {
      w.lab.setPrinterUnlocked(true);
      ui.toast('ALL FOUR PIECES! The 3D printer just woke up.', 'good', 5000);
    } else {
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
    // Called from a click handler, so this counts as a user gesture
    input.requestLock();
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
    w.enemies.startSwarm([pcx, pcy]);

    this._exitMinigameToPlaying();
    ui.toast('PRINTING! Everything in the lab just turned toward you.', 'bad', 5000);
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
    w.lab.openExitDoor();
    audio.keyReady();
    ui.toast('KEY IN HAND. The exit is unlocked - RUN.', 'good', 4200);
  }

  // ================================================================ end states

  _escape() {
    const w = this.world;
    if (w.escaped) return;
    w.escaped = true;
    this.mode = MODE.WIN;
    audio.doorOpen();
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
        { label: 'CODE PIECES', value: `${found}/${CODE_PARTS}`, tone: found >= CODE_PARTS ? 'good' : 'bad' },
        { label: 'FLOOR', value: w.level?.codename || 'LEVEL' },
        { label: 'SURVIVED', value: formatTime(w.runTime) },
        { label: 'QUESTIONS RIGHT', value: `${w.questionsRight}/${w.questionsAsked}` },
        { label: 'ACCURACY', value: `${acc}%` },
        ...(progLines.length ? [{ label: 'THIS RUN', value: progLines.join(' · '), tone: 'good' }] : []),
      ],
      tip: `TIP: ${tips[Math.floor(Math.random() * tips.length)]}`,
    });
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

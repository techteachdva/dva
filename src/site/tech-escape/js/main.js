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
  CELL, QUALITY, DIFFICULTY, COLORS, PLAYER, QUIZ, DECRYPT, PRINTER, CODE_PARTS,
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
import { Quiz } from './minigames/quiz.js';
import { Decrypt } from './minigames/memory.js';
import { drawQuestions, TERMINALS, QUESTION_COUNT } from './data/questions.js';

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
const FRAGMENT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SETTINGS_KEY = 'techescape.settings.v1';

class Game {
  constructor() {
    this.mode = MODE.LOADING;
    this.settings = {
      sensitivity: 100,
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
    this._loadSettings();

    const canvas = document.getElementById('scene');
    if (!this._initRenderer(canvas)) return;

    input.init(canvas);
    input.sensitivity = this.settings.sensitivity;

    this._bindUi();
    this._applySettings();

    await this._bootSequence();

    this.mode = MODE.TITLE;
    ui.showScreen('screen-title');
    ui.setPerfNote(`${QUESTION_COUNT} questions loaded - renderer: ${this._rendererName}`);
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

  async _bootSequence() {
    const lines = [
      'DVA TECH LAB - NIGHT SHIFT MONITOR',
      'checking door locks ............ LOCKED',
      'checking overhead lights ....... OFFLINE',
      'counting chromebooks ........... 4 AWAKE',
      'scanning for movement .......... [REDACTED]',
      'good luck.',
    ];
    const shown = [];
    for (let i = 0; i < lines.length; i++) {
      shown.push(lines[i]);
      ui.bootLog(shown);
      ui.setLoadProgress((i + 1) / lines.length);
      await new Promise((r) => setTimeout(r, i === lines.length - 1 ? 420 : 190));
    }
  }

  // ============================================================== settings

  _loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) Object.assign(this.settings, JSON.parse(raw));
    } catch (e) { /* first run, or storage blocked by policy */ }
  }

  _saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) { /* storage blocked; settings just will not persist */ }
  }

  _applySettings() {
    input.sensitivity = this.settings.sensitivity;
    audio.setMuted(this.settings.muted);
    document.body.classList.toggle('reduce-fx', this.settings.reduceFx);
    if (this.world) {
      this.world.lighting.setBrightness(this.settings.brightness / 100);
      this.world.player.reduceFx = this.settings.reduceFx;
      this.scene.fog.density = QUALITY[this.settings.quality].fogDensity;
    }
    this._resize();

    const el = {
      sens: document.getElementById('set-sens'),
      quality: document.getElementById('set-quality'),
      bright: document.getElementById('set-bright'),
      mute: document.getElementById('set-mute'),
      shake: document.getElementById('set-shake'),
    };
    el.sens.value = this.settings.sensitivity;
    el.quality.value = this.settings.quality;
    el.bright.value = this.settings.brightness;
    el.mute.checked = this.settings.muted;
    el.shake.checked = this.settings.reduceFx;
    document.getElementById('out-sens').textContent = this.settings.sensitivity;
    document.getElementById('out-bright').textContent = `${this.settings.brightness}%`;

    for (const btn of document.querySelectorAll('.diff-btn')) {
      btn.classList.toggle('is-selected', btn.dataset.diff === this.settings.difficulty);
    }
  }

  _bindUi() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('btn-start', 'click', () => {
      audio.init();
      audio.uiClick();
      this.startRun();
    });

    for (const btn of document.querySelectorAll('.diff-btn')) {
      btn.addEventListener('click', () => {
        audio.init();
        audio.uiClick();
        this.settings.difficulty = btn.dataset.diff;
        this._saveSettings();
        this._applySettings();
      });
    }

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

    // Settings inputs
    const sens = document.getElementById('set-sens');
    sens.addEventListener('input', () => {
      this.settings.sensitivity = Number(sens.value);
      document.getElementById('out-sens').textContent = sens.value;
      input.sensitivity = this.settings.sensitivity;
      this._saveSettings();
    });

    const quality = document.getElementById('set-quality');
    quality.addEventListener('change', () => {
      this.settings.quality = quality.value;
      this._saveSettings();
      this._applySettings();
      ui.toast('Graphics quality changed. Restart a run for full effect.', 'warn');
    });

    const bright = document.getElementById('set-bright');
    bright.addEventListener('input', () => {
      this.settings.brightness = Number(bright.value);
      document.getElementById('out-bright').textContent = `${bright.value}%`;
      if (this.world) this.world.lighting.setBrightness(this.settings.brightness / 100);
      this._saveSettings();
    });

    const mute = document.getElementById('set-mute');
    mute.addEventListener('change', () => {
      this.settings.muted = mute.checked;
      audio.setMuted(mute.checked);
      this._saveSettings();
    });

    const shake = document.getElementById('set-shake');
    shake.addEventListener('change', () => {
      this.settings.reduceFx = shake.checked;
      document.body.classList.toggle('reduce-fx', shake.checked);
      if (this.world) this.world.player.reduceFx = shake.checked;
      this._saveSettings();
    });

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

    const diff = DIFFICULTY[this.settings.difficulty];
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffff)) >>> 0;
    const rng = makeRng(seed);

    // Regenerate until the layout is fully walkable
    let maze = new Maze(rng);
    let attempts = 0;
    while (attempts++ < 10) {
      const open = maze.openCells();
      const [sx, sy] = open[0];
      if (maze.isFullyConnected(sx, sy)) break;
      maze = new Maze(rng);
    }

    const lab = new Lab(this.scene, maze, rng);
    const open = maze.openCells();
    const used = new Set();
    const key = (c) => `${c[0]},${c[1]}`;
    const reserve = (cells) => cells.forEach((c) => used.add(key(c)));
    const freeCells = () => open.filter((c) => !used.has(key(c)));

    // Four terminals spread as far apart as the layout allows
    const laptopCells = maze.spreadCells(CODE_PARTS, [], 7);
    reserve(laptopCells);

    // Printer sits away from the terminals so the last run is a real journey
    const printerCell = maze.spreadCells(1, laptopCells, 6)[0];
    reserve([printerCell]);

    // Exit hugs the outer wall
    const border = freeCells().filter(([x, y]) => (
      x <= 2 || y <= 2 || x >= maze.size - 3 || y >= maze.size - 3
    ));
    const exitCell = border.length
      ? rng.pick(border)
      : rng.pick(freeCells());
    reserve([exitCell]);

    // The player starts far from the exit, so escaping means crossing the lab
    const startPool = freeCells().filter(
      (c) => Math.hypot(c[0] - exitCell[0], c[1] - exitCell[1]) > maze.size * 0.45,
    );
    const startCell = startPool.length ? rng.pick(startPool) : rng.pick(freeCells());
    reserve([startCell]);

    lab.buildLaptops(laptopCells);
    lab.buildPrinter(printerCell);
    lab.buildExit(exitCell);

    // Tables to hide under: plenty, and never on top of a terminal
    const tableCells = rng.shuffle(freeCells()).slice(0, Math.round(open.length * 0.22));
    reserve(tableCells);
    lab.buildTables(tableCells);

    const propCells = rng.shuffle(freeCells()).slice(0, Math.round(open.length * 0.1));
    reserve(propCells);
    lab.buildProps(propCells);

    const pickups = new PickupField(this.scene, maze, rng);
    // Props are solid floor to ceiling, so loot inside one would be unreachable.
    // Table cells are fair game - crawling in for a battery is a good decision.
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

    const player = new Player(maze, lab, startCell, diff);
    player.reduceFx = this.settings.reduceFx;
    // Start facing whichever direction has floor in front of you
    player.yaw = this._bestStartYaw(maze, startCell);

    const lighting = new Lighting(this.scene, this.camera, QUALITY[this.settings.quality]);
    lighting.setBrightness(this.settings.brightness / 100);

    this.scene.fog = new THREE.FogExp2(COLORS.fog, QUALITY[this.settings.quality].fogDensity);

    const enemies = new EnemyManager(this.scene, maze, rng, diff, lab.obstacles);
    enemies.spawnInitial(startCell);

    // Each terminal guards a three character slice of the door code
    const fragments = [];
    for (let i = 0; i < CODE_PARTS; i++) {
      let f = '';
      for (let c = 0; c < 3; c++) f += rng.pick(FRAGMENT_CHARS.split(''));
      fragments.push(f);
    }

    this.world = {
      seed, rng, maze, lab, player, lighting, enemies, pickups, diff,
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

    ui.buildHealth(player.maxHealth);
    ui.setHealth(player.health);
    ui.setPieces(this.world.earned);
    ui.clearToasts();
    ui.setHudVisible(true);
    ui.hideAllScreens();
    ui.setObjective('Find a glowing Chromebook');
    ui.setDanger(false);
    input.showTouchUi(true);

    audio.init();
    audio.startAmbience();

    this.mode = MODE.PLAYING;
    input.setEnabled(true);
    input.clearEdges();
    input.requestLock();

    ui.toast('Four terminals. Four code pieces. Do not get cornered.', 'warn', 4200);
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
    this.world.lighting.dispose();
    this.world.lab.dispose();
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

  _tick(dt) {
    const w = this.world;
    if (!w) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const inMinigame = this.mode === MODE.QUIZ || this.mode === MODE.DECRYPT;
    const controlsActive = this.mode === MODE.PLAYING;
    const worldRunning = this.mode === MODE.PLAYING || inMinigame || this.mode === MODE.PRINTER;

    if (worldRunning) {
      // Minigames slow the lab instead of pausing it
      let scale = 1;
      if (this.mode === MODE.QUIZ) scale = QUIZ.timeScale;
      else if (this.mode === MODE.DECRYPT) scale = DECRYPT.timeScale;
      else if (this.mode === MODE.PRINTER) scale = 0.25;

      const wdt = dt * scale;
      w.runTime += wdt;

      if (controlsActive) w.player.applyLook();
      w.player.update(wdt, controlsActive);

      const ev = w.enemies.update(wdt, w.player);
      // Burning a virus costs extra battery; applied from next frame, which is
      // imperceptible and keeps the update order simple
      w.player.burningVirus = ev.burning;
      this._handleCombat(ev, wdt);
      this._handleGlitch(ev);

      const got = w.pickups.update(wdt, w.player);
      this._handlePickups(got);

      if (w.printing) this._updatePrint(wdt);

      this._updateTension(ev, wdt);
      this._updateHud(ev);

      if (controlsActive) {
        this._handleInteraction();
      } else {
        // A minigame is up: do not leave world prompts sitting behind the panel
        ui.showInteract(null);
        ui.showHint(null);
      }
      if (this.quiz.open) this.quiz.setThreat(ev.nearest < 4.5);

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
    // Rebuilt each frame because enemies and loot come and go
    const out = w.lab.glowSources.slice();
    for (const g of w.enemies.glowSources) out.push(g);
    for (const g of w.pickups.glowSources) out.push(g);
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
    ui.glitchBurst(this.settings.reduceFx);
    if (!this._taughtGlitch) {
      this._taughtGlitch = true;
      ui.toast('It glitched out! The light hurts them - but it drains your battery.', 'good', 4200);
    } else {
      ui.toast('Virus glitched away. It will be back.', 'good', 1800);
    }
  }

  _handlePickups(got) {
    const w = this.world;
    if (got.cheetos) {
      ui.setHealth(w.player.health);
      ui.toast('Hot cheetos! Snack energy restored.', 'good', 1700);
    }
    if (got.batteries) {
      ui.toast('Fresh battery. The dark just got smaller.', 'good', 1700);
    }
    // Standing on an item you cannot use would otherwise spam a toast per frame
    if (got.wasted) {
      this._wastedCooldown = (this._wastedCooldown || 0) - 1;
      if (this._wastedCooldown <= 0) {
        this._wastedCooldown = 180;
        ui.toast('Already topped up - leave it here for later.', 'warn', 1600);
      }
    }
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

    if (input.pressed('use') && best) {
      if (best.enabled && best.action) best.action();
      else audio.deny();
    }

    if (input.pressed('light')) p.toggleFlashlight();
  }

  // ================================================================ terminals

  _openTerminal(index) {
    const w = this.world;
    if (w.lab.laptops[index].solved) return;

    // Redraw questions each attempt so a retry is not the same three questions
    const questions = drawQuestions(index, QUIZ.questionsPerLaptop, w.rng);
    w.terminalQuestions[index] = questions;

    this.mode = MODE.QUIZ;
    this.expectUnlock = true;
    input.releaseLock();
    input.setEnabled(false);
    ui.setHudVisible(false);
    ui.showScreen('screen-quiz');
    this.quiz.setThreat(false);

    this.quiz.start(index, questions, {
      onAnswer: (right) => {
        w.questionsAsked++;
        if (right) w.questionsRight++;
        else {
          // A wrong answer is a noise event: the lab hears the error chime
          this._makeNoise(QUIZ.wrongAnswerNoise);
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

    ui.showVictory({
      stats: [
        { label: 'ESCAPE TIME', value: time, tone: 'good' },
        { label: 'QUESTIONS RIGHT', value: `${w.questionsRight}/${w.questionsAsked}` },
        { label: 'ACCURACY', value: `${acc}%`, tone: acc >= 80 ? 'good' : '' },
        { label: 'SNACKS EATEN', value: w.player.stats.cheetosEaten },
        { label: 'HITS TAKEN', value: w.player.stats.damageTaken, tone: w.player.stats.damageTaken === 0 ? 'good' : 'bad' },
        { label: 'DIFFICULTY', value: w.diff.label },
      ],
      report: [
        `<strong>Design process:</strong> you worked a real DEFINE - PREPARE - TRY - REFLECT cycle to get out.`,
        `<strong>Code pieces decrypted:</strong> ${w.earned.filter(Boolean).length} of ${CODE_PARTS}, using ${w.decryptAttempts} card flips.`,
        `<strong>Accuracy:</strong> ${acc}% on ${w.questionsAsked} questions across all four terminals.`,
        acc >= 80
          ? '<strong>Next challenge:</strong> try SYSTEM CRASH difficulty, or beat your escape time.'
          : '<strong>Next challenge:</strong> read each explanation before you hit CONTINUE, then run it again.',
      ],
    });
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

    ui.showGameOver({
      title: 'SYSTEM FAILURE',
      flavor: found >= CODE_PARTS
        ? 'You had the whole code. The printer was right there. The dark got there first.'
        : 'The lab goes quiet. Somewhere, four Chromebooks are still glowing, still waiting.',
      stats: [
        { label: 'CODE PIECES', value: `${found}/${CODE_PARTS}`, tone: found >= CODE_PARTS ? 'good' : 'bad' },
        { label: 'SURVIVED', value: formatTime(w.runTime) },
        { label: 'QUESTIONS RIGHT', value: `${w.questionsRight}/${w.questionsAsked}` },
        { label: 'ACCURACY', value: `${acc}%` },
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

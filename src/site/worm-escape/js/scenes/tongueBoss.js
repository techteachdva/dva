import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, drawBar,
  drawHero, drawDropShadow,
  ParticleSystem, screenShake, shade, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { ENEMIES } from "../content/enemies.js";
import { rand, randInt, pick } from "../engine/rng.js";
import {
  applyDamage, matchupMultiplier, matchupLabel,
  applyTamerKillGrowth,
  recordDirectHpHit, recordDirectArmorHit,
  activePlasmMode, plasmElementMult,
} from "../content/player.js";
import {
  pointInRect,
  columnIndexFromX,
  stepTowardIndex,
} from "../engine/pointer.js";
import { VictoryScene } from "./victory.js";
import { GameOverScene } from "./gameover.js";
import { NestWormScene } from "./endlessNest.js";
import { EndlessCrashScene } from "./endlessCrash.js";
import {
  pickTwoDistinctPotionKeys,
  POTION_DRINK_CD_SEC,
  tickManaPotionMiniGame,
  drawManaPotionModal,
} from "../engine/manaPotion.js";
import { applyOutboundStrikeDice } from "../engine/strikeDamageMods.js";
import {
  endlessDangerMult,
  healPlayerBetweenEndlessLoops,
  resolveEndlessPalette,
} from "../content/endlessStyle.js";
import { runEnemyHpMult, runIncomingDamageMult } from "../content/gameBalance.js";

// =====================================================================
//  v0.15 FINAL BOSS - The Worm's MAW (whack-a-tooth)
// =====================================================================
// To escape the worm the adventurer must knock out all FIVE bottom
// teeth at the same time. It's whack-a-mole under pressure:
//
//   - 5 PLAYER COLUMNS (the same 5 lanes used in the climb).
//   - 5 BOTTOM TEETH sit above the player across those columns. They
//     are mini-bosses with ~90 HP each. Your basic attack strikes the
//     tooth in your CURRENT lane. Multi-lane weapons (Bile Whip) also
//     hit the immediate neighbors. Specials follow their weapon's own
//     multi-lane rules.
//   - 5 TOP TEETH hang from the roof of the maw. Periodically ONE
//     top tooth glows red (lane-targeted telegraph ~1s) and then
//     CHOMPS DOWN on that column. If the player is in that lane AND
//     unbraced, they take a heavy hit. Brace halves it (perfect-brace
//     window = counter-strike on the bottom tooth in that lane).
//     Move out of the lane entirely = no damage at all.
//   - A knocked-out bottom tooth stays down for 60 seconds, then pops
//     back up at 50% HP. The whole escape is the challenge of timing
//     your damage so all 5 are down simultaneously.
//
// Keybinds (shared with CombatScene):
//   [A] / [ArrowLeft]   move one column left
//   [D] / [ArrowRight]  move one column right
//   [Q] / [1]           Gene Bolt — hits tooth in lane (Plasmids) / primary attack
//   [E] / [2]           Cycle FIRE↔SHOCK↔CRYO on Plasmids / otherwise special strike
//   [R] / [3]           Mana vial (same mini-game as sphincter fights)
//   [X]                 Dodge twitch  (lane hop + tiny MP gain + brief i-frame)
//   [F] / [4]           Brace      (mitigates chomp; perfect = counter)
//   [P] / [Esc]         Pause
// =====================================================================

const COLS_X = [W * 0.22, W * 0.36, W * 0.50, W * 0.64, W * 0.78];
const NUM_COLS = COLS_X.length;

/** Offset top fangs so they descend into the gaps between bottom molars (visual only). */
const LANE_PITCH = COLS_X[1] - COLS_X[0];
function topFangDrawX(col) {
  return COLS_X[col] + LANE_PITCH * 0.5;
}

/** Hero stand slightly left of each bottom molar — matches how top teeth hang over gaps so lane reads cleanly. */
function heroStandX(col) {
  return COLS_X[col] - LANE_PITCH * 0.2;
}

// Vertical anchors for the teeth / hero.
const TOP_TOOTH_Y    = 110;     // where the top teeth hang from (root)
const TOP_TOOTH_TIP  = 250;     // where a top tooth's TIP sits at rest
const TOP_CHOMP_Y    = 520;     // how far down a chomping top tooth reaches
const BOTTOM_TOOTH_Y = 610;     // where bottom teeth emerge from the gum
const BOTTOM_TOOTH_TIP = 470;   // where a healthy bottom tooth's tip reaches
const HERO_Y         = H - 140;

// Tuning (difficulty pass "climactic"):
const TOOTH_HP_MAX        = 90;     // each bottom tooth's health pool
const TOOTH_RESPAWN_SECS  = 60;     // how long a knocked-out tooth stays down
const TOOTH_RESPAWN_FRAC  = 0.5;    // comes back at 50% HP
const CHOMP_TELEGRAPH_MIN = 0.95;    // slightly tighter telegraphs in the finale
const CHOMP_COOLDOWN_MIN  = 1.55;
const CHOMP_COOLDOWN_MAX  = 3.05;
const CHOMP_DMG_RANGE     = [16, 26];
const PERFECT_BRACE_WINDOW = 0.4;   // seconds before impact where brace = counter

export class MawBossScene {
  constructor(chamberIdx) {
    this.chamberIdx = chamberIdx;
    this.chamber = CHAMBERS[chamberIdx];
    const ed = ENEMIES[this.chamber.guardian] || ENEMIES.wormMaw || {};
    this.enemyName = ed.name || "THE WORM'S MAW";
    this.flavorIntro = ed.flavorIntro || "Five fangs stand between you and daylight.";
    this.flavorWin = ed.flavorDeath || "The lower jaw collapses. DAYLIGHT FLOODS IN!";

    // 5 bottom teeth - each is an independent mini-boss.
    this.bottomTeeth = [];
    for (let i = 0; i < NUM_COLS; i++) {
      this.bottomTeeth.push({
        col: i,
        hp: TOOTH_HP_MAX,
        hpMax: TOOTH_HP_MAX,
        hpDisplay: TOOTH_HP_MAX,
        knockedOut: false,
        knockedT: 0,
        respawnIn: 0,
        flashT: 0,
        shakeT: 0,
        // Visual wobble - helps sell it as "alive".
        wobble: Math.random() * Math.PI * 2,
      });
    }

    /** Chomp damage ranges — scaled in enter() during Endless tiers. */
    this.endlessChompLo = [CHOMP_DMG_RANGE[0], CHOMP_DMG_RANGE[1]];
    this.endlessChompHi = [CHOMP_DMG_RANGE[1], CHOMP_DMG_RANGE[1] + 14];

    // 5 top teeth - the aggressors. They don't HP-track; they only
    // attack. A given top tooth tracks its own chomp animation state.
    this.topTeeth = [];
    for (let i = 0; i < NUM_COLS; i++) {
      this.topTeeth.push({
        col: i,
        // 0 = resting, 1 = fully chomped down.
        chomp: 0,
        // Non-null means "telegraphing a chomp that will fire in X seconds".
        telegraph: null,
        // Post-chomp recovery so it doesn't instantly re-chomp.
        cooldown: 0,
        flashT: 0,
      });
    }

    // Player lane state (starts middle).
    this.col = Math.floor(NUM_COLS / 2);
    this.laneSwapT = 0;  // delay gate for movement
    this.heroBob = 0;
    this.hitFlash = 0;
    this.braceTime = 0;
    this.perfectBraceReady = false;
    this.perfectFlashT = 0;
    this.dodgeIFrameT = 0;
    this.dodgeFlashT = 0;

    /** Mana vials — aligned with CombatScene semantics. */
    this.potionState = null;
    this.potionDrinkCooldown = 0;

    // Scripted boss patterns (wave / pincer / feint) fire on this cadence when idle.
    this.bossPattern = null; // null | { kind, ... }
    this.nextPatternIn = rand(8, 15);

    // Chomp scheduler: time until we pick a top tooth to telegraph.
    this.nextChompIn = rand(1.8, 2.6);
    // Big "slam" is a rarer full-row bite where ALL top teeth chomp
    // together. You can only survive with a brace.
    this.nextSlamIn = rand(22, 32);
    this.slamTelegraph = null; // null or seconds-to-slam

    this.patternPauseSlamUntil = null; // slam timing soft-gate during scripted patterns

    this.t = 0;
    this.anim = 0;
    this.done = false;
    this.phase = "intro";
    this.introT = 0;
    this.winHoldT = 0;
    this.paused = false;

    this.particles = new ParticleSystem();
    this.floaters = [];
    this.bloodDecals = [];
    this.log = [];

    this.game = null;

    this.matchupMult = 1;
    this.matchupLabel = null;
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 4) this.log.shift();
  }

  tryEnterManaPotion(p) {
    if (this.phase !== "fight" || this.done) return;
    if (this.potionState) return;
    if (this.potionDrinkCooldown > 0) {
      SFX.deny();
      this.pushLog(`Mana vial recharging (${this.potionDrinkCooldown.toFixed(1)}s).`);
      return;
    }
    if (p.mana >= p.manaMax) {
      SFX.deny();
      this.pushLog("Mana already full!");
      return;
    }
    const [corkKey, pourKey] = pickTwoDistinctPotionKeys();
    this.potionState = {
      corkKey,
      pourKey,
      phase: "cork",
      corkPop: false,
      tilt: 0,
      liquid: 1,
      timeLeft: POTION_MINIGAME_TIME_SEC,
      hintFlash: 0,
    };
    this.pushLog("POP the cork — tilt with the pour key!");
    SFX.confirm();
  }

  endManaPotionSuccess(p) {
    p.mana = p.manaMax;
    this.potionDrinkCooldown = POTION_DRINK_CD_SEC;
    this.potionState = null;
    this.pushLog("Liquid lightning — mana SURGES!");
    SFX.jump();
  }

  endManaPotionFail() {
    this.potionDrinkCooldown = 9;
    this.potionState = null;
    this.pushLog("Phial shattered— try again shortly.");
    SFX.deny();
  }

  doDodgeTwitch(p) {
    if ((p.dodgeRollCooldown || 0) > 0) {
      SFX.deny();
      this.pushLog("Dodge needs a heartbeat to recover.");
      return;
    }
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.col = Math.max(0, Math.min(NUM_COLS - 1, this.col + dir));
    p.mana = Math.min(p.manaMax, p.mana + 3);
    p.dodgeRollCooldown = 1.22;
    this.dodgeIFrameT = 0.14;
    this.dodgeFlashT = 0.45;
    SFX.dodge();
    this.pushLog(dir < 0
      ? "You twitch LEFT (+3 MP)."
      : "You twitch RIGHT (+3 MP).");
  }

  enter(game) {
    this.game = game;
    const p = game.player;
    // Teeth are BONE - every hit against them is matched by the weapon's
    // vs-teeth matchup if present. Hammer does great work here. Frost
    // wand (weakVs teeth) gets a glancing tag.
    const mult = matchupMultiplier(p.loadoutId, "teeth");
    const lbl = matchupLabel(mult);
    this.matchupMult = mult;
    this.matchupLabel = lbl;

    this.pushLog("The maw CLAMPS around you! Five molars bar your path.");
    this.pushLog(this.flavorIntro);
    if (lbl) {
      this.pushLog(lbl.text === "DEVASTATING!"
        ? `Your ${p.loadout.name} is PERFECT for cracking bone!`
        : `Your ${p.loadout.name} feels ${lbl.text.toLowerCase()} against enamel...`);
    }

    const edm = game.endlessMode ? endlessDangerMult(game) : 1;
    const hpBal = runEnemyHpMult(game);
    const toothMult = edm * hpBal;
    if (toothMult !== 1) {
      for (const tooth of this.bottomTeeth) {
        const nh = Math.round(tooth.hp * toothMult);
        tooth.hp = nh;
        tooth.hpMax = nh;
        tooth.hpDisplay = nh;
      }
    }
    if (edm > 1) {
      this.endlessChompLo = [
        Math.round(CHOMP_DMG_RANGE[0] * edm),
        Math.round(CHOMP_DMG_RANGE[1] * edm),
      ];
      this.endlessChompHi = [
        Math.round(CHOMP_DMG_RANGE[1] * edm),
        Math.round((CHOMP_DMG_RANGE[1] + 14) * edm),
      ];
    }
  }

  // ======================== UPDATE ========================
  update(dt, game) {
    if (this.done) return;
    if (game.input.wasPressed("p", "Escape")) {
      // Don't pause mid vial cork/pour — same frame would freeze timers and paint PAUSED above the modal.
      if (!(this.phase === "fight" && this.potionState)) {
        this.paused = !this.paused;
        SFX.click();
      }
    }
    if (this.paused) return;

    this.t += dt;
    this.anim += dt * 4;
    const p = game.player;
    if (p.score) p.score.timeSpent += dt;
    if (typeof game.invulnerable === "boolean") p.invulnerable = game.invulnerable;

    if (this.phase === "intro") {
      this.introT += dt;
      if (this.introT > 1.8) {
        this.phase = "fight";
        this.pushLog("Knock out all 5 bottom teeth AT ONCE to escape!");
      }
    }

    if (this.phase === "fight") {
      this.updateCooldowns(dt, p);
      if (this.potionDrinkCooldown > 0) {
        this.potionDrinkCooldown = Math.max(0, this.potionDrinkCooldown - dt);
      }
      if (this.potionState) {
        if (!this.paused) {
          tickManaPotionMiniGame(
            this.potionState,
            dt,
            game.input,
            () => this.endManaPotionSuccess(p),
            () => this.endManaPotionFail(),
          );
        }
      } else {
        this.updateTeeth(dt, p);
        this.updateChomps(dt, p, game);
        this.handleInput(dt, game);
        this.checkWinCondition(game);
      }
    }

    if (this.phase === "win") {
      this.winHoldT += dt;
      if (this.winHoldT > 2.6 && !this.done) {
        this.done = true;
        if (p.score) p.score.bossesDefeated = (p.score.bossesDefeated || 0) + 1;
        SFX.victory();
        if (game.endlessMode && game.wormTier === 6) {
          healPlayerBetweenEndlessLoops(p);
          game.victoryAbruptReveal = true;
          game.scenes.replace(new EndlessCrashScene(), game);
          return;
        }
        if (game.endlessMode) {
          game.wormTier += 1;
          healPlayerBetweenEndlessLoops(p);
          game.chamberIndex = 0;
          game.scenes.replace(new NestWormScene(), game);
          return;
        }
        game.scenes.replace(new VictoryScene(), game);
        return;
      }
    }

    // Timers tick down regardless of phase.
    if (this.braceTime > 0) this.braceTime = Math.max(0, this.braceTime - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.perfectFlashT > 0) this.perfectFlashT = Math.max(0, this.perfectFlashT - dt);
    if (this.dodgeIFrameT > 0) this.dodgeIFrameT = Math.max(0, this.dodgeIFrameT - dt);
    if (this.dodgeFlashT > 0) this.dodgeFlashT = Math.max(0, this.dodgeFlashT - dt);
    if (this.laneSwapT > 0) this.laneSwapT = Math.max(0, this.laneSwapT - dt);

    // Floaters.
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 40 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.particles.update(dt);

    this.heroBob += dt * 2.5;

    if (p.hp <= 0 && !this.done) {
      this.done = true;
      SFX.die();
      game.scenes.replace(
        new GameOverScene("The maw snapped shut. You are the worm's supper."),
        game,
      );
    }
  }

  updateCooldowns(dt, p) {
    if (p.cooldowns.attack > 0)  p.cooldowns.attack  = Math.max(0, p.cooldowns.attack  - dt);
    if (p.cooldowns.special > 0) p.cooldowns.special = Math.max(0, p.cooldowns.special - dt);
    if ((p.dodgeRollCooldown || 0) > 0) {
      p.dodgeRollCooldown = Math.max(0, p.dodgeRollCooldown - dt);
    }
  }

  updateTeeth(dt, p) {
    for (const t of this.bottomTeeth) {
      t.wobble += dt * 2.5;
      t.flashT = Math.max(0, t.flashT - dt);
      t.shakeT = Math.max(0, t.shakeT - dt);
      // v0.16 Tooth DoT (BLEED / POISON from weapon on-hit effects).
      // Drips % of max-hp damage every second while the timer holds.
      if (!t.knockedOut && (t.dotT || 0) > 0 && (t.dotDps || 0) > 0) {
        t.hp = Math.max(0, t.hp - t.dotDps * dt);
        t.dotT -= dt;
        if (Math.random() < dt * 5) {
          this.particles.burst(
            COLS_X[t.col] + rand(-12, 12),
            BOTTOM_TOOTH_TIP - 20 + rand(-14, 14),
            "#ff6a6a", 2, 60, 0.4,
          );
        }
        if (t.hp === 0) this.knockOutTooth(t, p);
      }
      // HP bar lerp toward real HP.
      t.hpDisplay += (t.hp - t.hpDisplay) * Math.min(1, dt * 6);

      if (t.knockedOut) {
        t.respawnIn -= dt;
        if (t.respawnIn <= 0) {
          // The tooth SHOOTS back up at 50% HP.
          const respawnHp = Math.round(t.hpMax * TOOTH_RESPAWN_FRAC);
          t.hp = respawnHp;
          t.hpDisplay = respawnHp;
          t.knockedOut = false;
          t.flashT = 0.6;
          t.shakeT = 0.5;
          t.dotT = 0; t.dotDps = 0; t.bleedStacks = 0;
          this.pushLog(`COLUMN ${t.col + 1}: the molar ERUPTS back up at 50% HP!`);
          SFX.thud();
          screenShake(6, 0.2);
          this.particles.burst(
            COLS_X[t.col], BOTTOM_TOOTH_Y - 40, "#ffd966", 26, 220, 0.6,
          );
        }
      }
    }

    // Top teeth animation - fade chomp back to 0 if past the strike.
    for (const tt of this.topTeeth) {
      tt.flashT = Math.max(0, tt.flashT - dt);
      if (tt.cooldown > 0) tt.cooldown = Math.max(0, tt.cooldown - dt);

      if (tt.telegraph !== null) {
        if (tt.feintBuddy != null && !tt.feintSwapped && tt.telegraph <= 0.42) {
          const buddyIdx = tt.feintBuddy;
          tt.feintSwapped = true;
          tt.telegraph = null;
          tt.feintBuddy = null;
          tt.cooldown = 0.55;
          const buddy = this.topTeeth[buddyIdx];
          if (buddy && buddy.telegraph === null && buddy.cooldown <= 0) {
            buddy.telegraph = 0.39;
            buddy.flashT = 0.5;
            buddy.feintBuddy = null;
            this.pushLog("FEINT — the flash was a lure! SNAP on the neighbor column!");
            SFX.click();
          }
          continue;
        }
        tt.telegraph -= dt;
        // Approach the chomp - pre-dip visual before the actual strike.
        tt.chomp = Math.max(tt.chomp, 0.15 + 0.10 * Math.sin(this.anim * 14));
      } else if (tt.chomp > 0) {
        // Retract.
        tt.chomp = Math.max(0, tt.chomp - dt * 3.5);
      }
    }
  }

  // The boss's attack logic: picks top teeth to telegraph and chomp.
  updateChomps(dt, p, game) {
    const downCount = this.bottomTeeth.filter((t) => t.knockedOut).length;
    const cadenceMul = Math.max(0.55, 1 - 0.13 * downCount);

    this.tryScheduleBossPattern(dt, cadenceMul);
    this.tickBossPattern(dt, cadenceMul, p);

    if (!this.bossPattern) {
      this.nextChompIn -= dt;
      if (this.nextChompIn <= 0 && this.slamTelegraph === null) {
        this.startChomp();
        this.nextChompIn = rand(CHOMP_COOLDOWN_MIN, CHOMP_COOLDOWN_MAX) * cadenceMul;
      }
    }

    this.nextSlamIn -= dt;
    if (
      this.nextSlamIn <= 0
      && this.slamTelegraph === null
      && !this.bossPattern
      && !(this.patternPauseSlamUntil && this.t < this.patternPauseSlamUntil)
    ) {
      this.startFullSlam();
      this.nextSlamIn = rand(24, 36) * cadenceMul;
    }

    if (this.slamTelegraph !== null) {
      this.slamTelegraph -= dt;
      for (const tt of this.topTeeth) {
        tt.chomp = Math.max(tt.chomp, 0.3 + 0.15 * Math.sin(this.anim * 16));
      }
      if (this.slamTelegraph <= 0) {
        this.resolveFullSlam(p);
        this.slamTelegraph = null;
      }
    }

    // Resolve telegraphed single chomps that ran out their timer.
    for (const tt of this.topTeeth) {
      if (tt.telegraph !== null && tt.telegraph <= 0) {
        this.resolveChomp(tt, p);
      }
    }
  }

  endBossPattern(cadenceMul) {
    this.bossPattern = null;
    this.nextChompIn = rand(CHOMP_COOLDOWN_MIN, CHOMP_COOLDOWN_MAX) * cadenceMul;
    this.patternPauseSlamUntil = null;
    this.nextPatternIn = rand(11, 22);
  }

  tryScheduleBossPattern(dt, cadenceMul) {
    if (
      this.bossPattern
      || this.slamTelegraph !== null
      || this.phase !== "fight"
    ) {
      return;
    }
    this.nextPatternIn -= dt;
    if (this.nextPatternIn > 0) return;
    const kinds = ["wave", "wave", "pincer", "feint"]; // heavier wave weight
    const kind = kinds[randInt(0, kinds.length - 1)];
    if (kind === "wave") this.beginWaveBossPattern(cadenceMul);
    else if (kind === "pincer") this.beginPincerBossPattern(cadenceMul);
    else this.beginFeintBossPattern(cadenceMul);

    const bp = this.bossPattern;
    if (bp) {
      bp.startedAt = this.t;
      bp.cadMul = cadenceMul;
      this.patternPauseSlamUntil = this.t + 24;
      this.pushLog(kind === "wave"
        ? "The maw RIDGES — a snapping wave along the arches!"
        : kind === "pincer"
        ? "THREE FANGS at once — pincered from BOTH ends!"
        : "Something glimmers… was that a FEINT?");
    }
  }

  tickBossPattern(dt, cadenceMul, p) {
    const bp = this.bossPattern;
    if (!bp) return;

    if (bp.kind === "wave") {
      if (bp.pending) return;

      bp.wait -= dt;
      if (bp.wait > 0) return;

      const ei = bp.emitIndex ?? 0;
      if (ei >= bp.sequence.length) {
        this.endBossPattern(bp.cadMul ?? cadenceMul);
        return;
      }

      const col = bp.sequence[ei];
      const tt = this.topTeeth[col];
      if (tt.telegraph !== null || tt.cooldown > 0.05 || tt.chomp > 0.08) {
        bp.wait += 0.03;
        return;
      }

      tt.telegraph = 0.48;
      tt.flashT = 0.35;
      bp.pending = true;
      bp.wait = 999;
      SFX.click();
      return;
    }

    if (bp.kind === "pincer" || bp.kind === "feint") {
      const stale = bp.createdAt !== undefined && this.t - bp.createdAt > 18;
      if (stale && !bp.pending) this.endBossPattern(bp.cadMul ?? cadenceMul);
    }
  }

  resolveChompPatternHooks(tt, cadMul) {
    const bp = this.bossPattern;
    if (!bp) return;

    if (bp.kind === "wave") {
      bp.pending = false;
      bp.wait = 0.07;
      bp.emitIndex = (bp.emitIndex ?? 0) + 1;
      const ei = bp.emitIndex ?? 0;
      if (ei >= bp.sequence.length) this.endBossPattern(bp.cadMul ?? cadMul);
      return;
    }

    if (bp.kind === "pincer") {
      const col = tt.col;
      if (bp.cols && bp.cols.includes(col)) {
        bp.left = (bp.left ?? 0) - 1;
      }
      if (bp.left !== undefined && bp.left <= 0) this.endBossPattern(bp.cadMul ?? cadMul);
      return;
    }

    if (bp.kind === "feint") {
      const col = tt.col;
      if (!bp.resolved && col === bp.real) {
        bp.resolved = true;
        this.endBossPattern(bp.cadMul ?? cadMul);
      }
    }
  }

  beginWaveBossPattern(cadenceMul) {
    const sequence = [];
    for (let i = 0; i < NUM_COLS; i++) sequence.push(i);
    for (let i = NUM_COLS - 2; i >= 0; i--) sequence.push(i);

    this.bossPattern = {
      kind: "wave",
      sequence,
      emitIndex: 0,
      wait: 0.42,
      pending: false,
      cadMul: cadenceMul,
    };
  }

  beginPincerBossPattern(cadenceMul) {
    const cols = [0, 2, 4];
    for (const c of cols) {
      const tt = this.topTeeth[c];
      if (tt.telegraph !== null || tt.cooldown > 0) {
        tt.cooldown = Math.max(tt.cooldown, 0); // unblock if wedged — rare
      }
      tt.telegraph = 1.12;
      tt.flashT = 0.42;
    }
    this.bossPattern = {
      kind: "pincer",
      left: cols.length,
      cols,
      pending: false,
      createdAt: this.t,
      cadMul: cadenceMul,
    };
    SFX.thud();
  }

  beginFeintBossPattern(cadenceMul) {
    let fake = randInt(0, NUM_COLS - 1);
    let real = randInt(0, NUM_COLS - 1);
    let guard = 0;
    while (real === fake && guard++ < 12) real = randInt(0, NUM_COLS - 1);

    const fakeTT = this.topTeeth[fake];
    fakeTT.feintBuddy = real;
    fakeTT.feintSwapped = false;
    fakeTT.telegraph = 1.12;

    this.bossPattern = {
      kind: "feint",
      fake,
      real,
      resolved: false,
      pending: false,
      createdAt: this.t,
      cadMul: cadenceMul,
    };
  }

  startChomp() {
    if (this.bossPattern) return;
    // Pick any top tooth not already mid-telegraph / mid-chomp.
    const eligible = this.topTeeth.filter(t => t.telegraph === null && t.cooldown <= 0);
    if (eligible.length === 0) return;
    const tt = pick(eligible);
    if (!tt) return;
    tt.telegraph = CHOMP_TELEGRAPH_MIN;
    tt.flashT = 0.25;
    SFX.click();
  }

  startFullSlam() {
    if (this.bossPattern) return;
    this.slamTelegraph = 1.6; // longer telegraph - this one is survivable only by bracing
    for (const tt of this.topTeeth) tt.flashT = 0.35;
    this.pushLog("!!! THE WHOLE MAW IS CLOSING - BRACE [F/4] !!!");
    SFX.thud();
  }

  resolveChomp(tt, p) {
    const cadMul = this.bossPattern?.cadMul ?? 1;

    const inLane = this.col === tt.col && this.dodgeIFrameT <= 0;
    tt.chomp = 1.0;
    tt.telegraph = null;
    tt.cooldown = 0.9;
    screenShake(8, 0.25);
    if (SFX.crunch) SFX.crunch(); else SFX.thud();
    this.particles.burst(
      topFangDrawX(tt.col), TOP_CHOMP_Y - 20, "#ffd0d4", 22, 260, 0.55,
    );

    this.resolveChompPatternHooks(tt, cadMul);

    if (!inLane) {
      this.pushLog(`A top tooth chomps column ${tt.col + 1} - you sidestepped it.`);
      return;
    }

    // In-lane - resolve with brace mitigation + perfect brace counter.
    const rawDmg = randInt(this.endlessChompLo[0], this.endlessChompLo[1]);
    const braced = this.braceTime > 0;
    let finalDmg = rawDmg;
    if (braced) finalDmg = Math.max(1, Math.round(rawDmg * 0.5));
    // Perfect brace: if the brace was started within PERFECT_BRACE_WINDOW
    // of this impact, it's a counter. (this.perfectBraceReady is set when
    // the player braces while a chomp is imminent.)
    const hadCounter = this.perfectBraceReady;
    if (hadCounter) {
      finalDmg = Math.max(1, Math.round(rawDmg * 0.25));
      this.perfectBraceReady = false;
      this.perfectFlashT = 0.9;
      if (p.score) p.score.counterStrikes++;
      // Counter: strike the bottom tooth in the SAME lane.
      this.counterStrike(tt.col, p);
    }

    this.applyHitToPlayer(finalDmg, p);
    const tag = hadCounter ? "PERFECT GUARD!" : braced ? "BRACED." : "UNBRACED!";
    this.pushLog(`${tag} Column ${tt.col + 1} chomp hits for ${finalDmg}.`);

    this.floaters.push({
      x: heroStandX(tt.col) + rand(-16, 16),
      y: HERO_Y - 20,
      vy: -70, life: 1.0, max: 1.0,
      text: `-${finalDmg}`, size: hadCounter ? 26 : 22,
      color: hadCounter ? "#ffd966" : braced ? "#c9e0ff" : "#ff6060",
    });
  }

  resolveFullSlam(p) {
    for (const tt of this.topTeeth) {
      tt.chomp = 1.0;
      tt.cooldown = 1.2;
    }
    screenShake(14, 0.45);
    SFX.thud();
    this.particles.burst(W / 2, TOP_CHOMP_Y, "#ffd0d4", 60, 360, 0.9);

    if (this.dodgeIFrameT > 0) {
      this.pushLog("You DODGE under the full-maw slam!");
      return;
    }

    const rawDmg = randInt(this.endlessChompHi[0], this.endlessChompHi[1]);
    const braced = this.braceTime > 0;
    const hadCounter = this.perfectBraceReady;
    let finalDmg = rawDmg;
    if (hadCounter) {
      finalDmg = Math.max(1, Math.round(rawDmg * 0.3));
      this.perfectBraceReady = false;
      this.perfectFlashT = 1.1;
      if (p.score) p.score.counterStrikes++;
      // Counter-strike hits EVERY active bottom tooth.
      for (let i = 0; i < NUM_COLS; i++) this.counterStrike(i, p);
      this.pushLog(`PERFECT GUARD on the full-slam! Lightning shoots through every fang!`);
    } else if (braced) {
      finalDmg = Math.max(1, Math.round(rawDmg * 0.45));
      this.pushLog(`Braced the MAW SLAM - ${finalDmg} dmg bleeds through.`);
    } else {
      this.pushLog(`!! THE MAW SLAMMED YOU FOR ${finalDmg} !!`);
    }
    this.applyHitToPlayer(finalDmg, p);
  }

  // When a perfect-brace triggers, it also deals a bolt of damage
  // to the bottom tooth in that column (if one is standing).
  counterStrike(col, p) {
    const tooth = this.bottomTeeth[col];
    if (!tooth || tooth.knockedOut) return;
    const dmg = 20 + randInt(0, 12);
    this.dealToTooth(tooth, dmg, "Counter-strike!", "counter", p);
  }

  applyHitToPlayer(amount, p) {
    if (p.invulnerable) return;
    const pm = p.pactMods || {};
    const cheatM = runIncomingDamageMult(this.game);
    const scaled = Math.max(1, Math.round(amount * (pm.incomingDmgMult || 1) * cheatM));
    applyDamage(p, scaled);
    this.hitFlash = Math.max(this.hitFlash, 0.35);
  }

  handleInput(dt, game) {
    if (this.potionState) return;
    const p = game.player;
    const mx = game.input.mouseX, my = game.input.mouseY;

    const barY = H - 86, barH = 68;
    const nCard = 4;
    const cardW = (W - 48 - 24 * (nCard - 1)) / nCard;
    const logY = H - 86 - 72 - 6;
    const pPanelH = p.armorMax > 0 ? 116 : 88;

    if (game.input.wasPressed("Mouse0")) {
      for (let i = 0; i < nCard; i++) {
        const x = 24 + i * (cardW + 24);
        if (pointInRect(mx, my, x, barY, cardW, barH)) {
          this.execute(i, p, game);
          return;
        }
      }
      if (pointInRect(mx, my, 24, logY, W - 48, 72)) return;
      if (pointInRect(mx, my, 18, 18, 300, pPanelH)) return;
      if (pointInRect(mx, my, W - 338, 18, 320, 102)) return;
      if (my < 130) return;
      if (this.laneSwapT <= 0) {
        const target = columnIndexFromX(mx, COLS_X);
        const step = stepTowardIndex(this.col, target);
        if (step !== 0) {
          this.col += step;
          this.laneSwapT = p.laneSwapCd || 0.08;
          SFX.click();
        }
      }
      return;
    }

    // Lane movement (discrete-press only; hopCooldown gates repeat).
    const moveCd = p.laneSwapCd || 0.08;
    if (this.laneSwapT <= 0) {
      if (game.input.wasPressed("ArrowLeft", "a") && this.col > 0) {
        this.col -= 1;
        this.laneSwapT = moveCd;
        SFX.click();
      } else if (game.input.wasPressed("ArrowRight", "d") && this.col < NUM_COLS - 1) {
        this.col += 1;
        this.laneSwapT = moveCd;
        SFX.click();
      }
    }

    // Attacks.
    if      (game.input.wasPressed("q", "Q", "1")) this.execute(0, p, game);
    else if (game.input.wasPressed("e", "E", "2")) this.execute(1, p, game);
    else if (game.input.wasPressed("r", "R", "3")) this.execute(2, p, game);
    else if (game.input.wasPressed("f", "F", "4")) this.execute(3, p, game);
    else if (game.input.wasPressed("x", "X")) this.doDodgeTwitch(p);
  }

  execute(idx, p) {
    const l = p.loadout;
    const pm = p.pactMods || {};
    switch (idx) {
      case 0: {
        if (p.loadoutId === "plasmids" && l.attack?.plasmBolt && l.plasmModes?.length) {
          const mode = activePlasmMode(l, p.plasmModeIndex ?? 0);
          if (!mode) break;
          const manaCost = mode.manaCost + (p.manaCostBonus || 0);
          if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${mode.boltName} is recharging...`); break; }
          if (p.mana < manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); break; }
          p.mana -= manaCost;
          p.cooldowns.attack = mode.cooldown * (pm.attackCdMult || 1);
          const boltMove = {
            name: mode.boltName,
            dmg: mode.dmg,
            sfx: mode.sfx || "cast",
            multiLane: false,
            lifestealPct: 0,
            poisonPct: 0,
            poisonTime: 0,
          };
          this.strikeCurrentLane(boltMove, "attack", p, { plasmElement: mode.plasmElement });
          break;
        }

        const manaCost = l.attack.manaCost + (p.manaCostBonus || 0);
        if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${l.attack.name} is recharging...`); return; }
        if (p.mana < manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= manaCost;
        p.cooldowns.attack = l.attack.cooldown * (pm.attackCdMult || 1);
        this.strikeCurrentLane(l.attack, "attack", p);
        break;
      }
      case 1: {
        if (p.loadoutId === "plasmids" && l.special?.plasmCycle && l.plasmModes?.length) {
          if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is on cooldown...`); break; }
          p.plasmModeIndex = (((p.plasmModeIndex || 0) + 1) % l.plasmModes.length);
          const nm = activePlasmMode(l, p.plasmModeIndex);
          p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
          this.pushLog(`Gene → ${nm?.label ?? "?"} • next Q bolt: ${nm?.boltName ?? "?"}`);
          SFX.click();
          break;
        }

        const manaCost = l.special.manaCost + (p.manaCostBonus || 0);
        if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is recharging...`); return; }
        if (p.mana < manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= manaCost;
        // v0.16 RUSTY CHAINSAW misfire: refund half the mana, halve the
        // cooldown, abort the strike. Pure RNG, exactly as designed.
        if (l.special.misfireChance && Math.random() < l.special.misfireChance) {
          p.mana = Math.min(p.manaMax, p.mana + Math.floor(manaCost / 2));
          p.cooldowns.special = (l.special.cooldown * 0.5) * (pm.specialCdMult || 1);
          this.pushLog(`${l.special.name} sputters and dies. (try again)`);
          SFX.deny();
          break;
        }
        p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
        this.strikeCurrentLane(l.special, "special", p);
        break;
      }
      case 2: {
        this.tryEnterManaPotion(p);
        break;
      }
      case 3: {
        // Brace. Perfect-brace = any chomp/slam that lands within
        // PERFECT_BRACE_WINDOW seconds counts as counter-strike.
        this.braceTime = 1.2;
        // Does ANY top-tooth chomp (or slam) strike within the perfect window?
        const imminent = this.topTeeth.some(
          t => t.telegraph !== null && t.telegraph <= PERFECT_BRACE_WINDOW,
        ) || (this.slamTelegraph !== null && this.slamTelegraph <= PERFECT_BRACE_WINDOW + 0.15);
        if (imminent) {
          this.perfectBraceReady = true;
          this.perfectFlashT = 0.7;
          if (p.score) p.score.perfectBraces++;
          this.pushLog("PERFECT BRACE! Counter-strike queued.");
          SFX.confirm();
          screenShake(3, 0.1);
        } else {
          this.pushLog("You BRACE. Next chomp hurts half as much.");
          SFX.confirm();
        }
        break;
      }
    }
  }

  // Apply a weapon strike to the bottom tooth in the player's lane.
  // Multi-lane weapons (Bile Whip) additionally hit the immediate
  // neighbors for a fractional splash (matches combat pacing).
  strikeCurrentLane(move, kind, p, extras = {}) {
    const mult = this.matchupMult || 1;
    const pm = p.pactMods || {};
    const dmgMult = (pm.dmgMult || 1) *
      (kind === "special" ? (pm.specialDmgMult || 1) : (pm.attackDmgMult || 1));
    const isCrit = Math.random() < (pm.critChance || 0);
    const critMult = isCrit ? 1.6 : 1;
    const elemMult = extras.plasmElement ? plasmElementMult(extras.plasmElement, "teeth") : 1;
    const raw = randInt(move.dmg[0], move.dmg[1]);
    const diced = applyOutboundStrikeDice(raw, pm);
    const centerDmg = Math.max(1, Math.round(diced * mult * dmgMult * critMult * elemMult));

    const centerTooth = this.bottomTeeth[this.col];
    if (!centerTooth) return;
    if (centerTooth.knockedOut) {
      // Still play the sound but log that there's nothing to hit.
      this.pushLog(`Column ${this.col + 1}'s molar is already down!`);
      SFX.deny();
      return;
    }

    SFX[move.sfx] ? SFX[move.sfx]() : SFX.hit();
    const tag = isCrit ? "CRITICAL!" : (mult > 1 ? (this.matchupLabel?.text || "") : "");
    this.dealToTooth(centerTooth, centerDmg, `${tag} ${move.name}!`.trim(), kind, p);
    const riot = typeof move.riotSelfHp === "number" ? move.riotSelfHp : 0;
    if (riot > 0 && !p.invulnerable) {
      applyDamage(p, riot, { countHitScore: false });
      this.pushLog(`Shout tears your throat — ${riot} HP.`);
    }

    let totalDealt = centerDmg;
    const multiSplashFrac = typeof move.multiLaneSplashFrac === "number"
      ? move.multiLaneSplashFrac
      : 0.38;
    // Multi-lane weapons sweep adjacent teeth for splash damage.
    if (move.multiLane) {
      const spread = [-1, 1];
      for (const dx of spread) {
        const nc = this.col + dx;
        if (nc < 0 || nc >= NUM_COLS) continue;
        const nt = this.bottomTeeth[nc];
        if (!nt || nt.knockedOut) continue;
        const splash = Math.max(1, Math.round(centerDmg * multiSplashFrac));
        this.dealToTooth(nt, splash, `Splash lash!`, kind, p);
        totalDealt += splash;
      }
    }

    // v0.16 LIFESTEAL (Cursed Scythe). Heal a slice of the total damage
    // dealt this swing. Surfaces a green floater near the hero so the
    // mechanic is visible in the chaos of the maw.
    const ls = move.lifestealPct || 0;
    if (ls > 0) {
      const heal = Math.max(1, Math.round(totalDealt * ls));
      const before = p.hp;
      p.hp = Math.min(p.hpMax, p.hp + heal);
      const actual = p.hp - before;
      if (actual > 0) {
        this.floaters.push({
          x: heroStandX(this.col) + rand(-10, 10),
          y: 600,
          vy: -50, life: 1.2, max: 1.2,
          text: `+${actual}`, size: 18,
          color: "#7fffa0",
        });
      }
    }

    // v0.16 Per-attack BLEED / POISON: applies a stacking DoT on the tooth
    // we hit. Reuses the existing tooth.dotT / tooth.dotDps fields if the
    // tooth has them; otherwise initializes them. Visualization is a quick
    // crimson particle puff every tick.
    const pPct  = move.poisonPct  || 0;
    const pTime = move.poisonTime || 0;
    if (pPct > 0 && pTime > 0) {
      const targets = [centerTooth];
      if (move.multiLane) {
        for (const dx of [-1, 1]) {
          const nc = this.col + dx;
          if (nc >= 0 && nc < NUM_COLS && this.bottomTeeth[nc] && !this.bottomTeeth[nc].knockedOut) {
            targets.push(this.bottomTeeth[nc]);
          }
        }
      }
      const lbl = move.dotLabel || "POISON";
      for (const t of targets) {
        if (lbl === "BLEED") {
          const bs = Math.min(3, (t.bleedStacks || 0) + 1);
          t.bleedStacks = bs;
          t.dotT = Math.max(t.dotT || 0, pTime);
          t.dotDps = (pPct * t.hpMax * bs) / 3;
          t.dotLabel = "BLEED";
        } else {
          t.dotT = Math.max(t.dotT || 0, pTime);
          t.dotDps = Math.max(t.dotDps || 0, pPct * t.hpMax);
          t.dotLabel = lbl;
        }
      }
    }
  }

  // Deal damage to a specific bottom tooth.
  dealToTooth(tooth, dmg, label, kind, p) {
    tooth.hp = Math.max(0, tooth.hp - dmg);
    tooth.flashT = 0.35;
    tooth.shakeT = 0.3;
    this.particles.burst(
      COLS_X[tooth.col] + rand(-10, 10),
      BOTTOM_TOOTH_TIP + rand(-20, 20),
      "#fff4d6", 14, 180, 0.45,
    );
    this.floaters.push({
      x: COLS_X[tooth.col] + rand(-16, 16),
      y: BOTTOM_TOOTH_TIP - 20,
      vy: -80, life: 0.9, max: 0.9,
      text: `-${dmg}`, size: kind === "counter" ? 26 : 22,
      color: kind === "counter" ? "#ffd966" : "#f6ecd0",
    });
    this.bloodDecals.push({
      x: COLS_X[tooth.col] + rand(-22, 22),
      y: BOTTOM_TOOTH_TIP + rand(-14, 14),
      r: rand(4, 9),
      alpha: rand(0.5, 0.85),
    });
    if (this.bloodDecals.length > 48) {
      this.bloodDecals.splice(0, this.bloodDecals.length - 48);
    }
    this.pushLog(`${label} Tooth ${tooth.col + 1} takes ${dmg}. (${Math.ceil(tooth.hp)}/${tooth.hpMax})`);

    if (tooth.hp <= 0 && !tooth.knockedOut) {
      this.knockOutTooth(tooth, p);
    }
  }

  knockOutTooth(tooth, p) {
    if (p) applyTamerKillGrowth(p);
    tooth.knockedOut = true;
    tooth.knockedT = 0;
    tooth.respawnIn = TOOTH_RESPAWN_SECS;
    SFX.thud();
    screenShake(10, 0.3);
    this.particles.burst(
      COLS_X[tooth.col], BOTTOM_TOOTH_TIP, "#ff4040", 36, 280, 0.8,
    );
    this.particles.burst(
      COLS_X[tooth.col], BOTTOM_TOOTH_TIP, "#f6ecd0", 22, 220, 0.6,
    );
    this.pushLog(`MOLAR ${tooth.col + 1} SHATTERED! (${TOOTH_RESPAWN_SECS}s until it regrows)`);
  }

  checkWinCondition(game) {
    const allDown = this.bottomTeeth.every(t => t.knockedOut);
    if (allDown) {
      this.phase = "win";
      this.pushLog("ALL FIVE MOLARS ARE DOWN! ESCAPE NOW!");
      screenShake(18, 0.5);
      this.particles.burst(W / 2, BOTTOM_TOOTH_TIP, "#ffd966", 80, 360, 1.2);
      SFX.confirm();
    }
  }

  // ======================== RENDER ========================
  render(ctx, game) {
    const ch = this.chamber;
    const pal = resolveEndlessPalette(game, ch.palette, ch.wormTint);
    drawFleshBackground(ctx, this.t, pal.wormTint * 1.05, pal.palette);
    drawVeins(ctx, this.t, this.chamberIdx + 11);

    // Distant daylight through any knocked-out gaps. Done before teeth so
    // teeth occlude where they're still standing.
    this.drawDaylight(ctx);

    // Lane columns (subtle glow per lane so the grid reads).
    this.drawLaneGuides(ctx);

    // Teeth rows.
    this.drawTopTeeth(ctx);
    this.drawBottomTeeth(ctx);

    // Blood decals sit on the gum line.
    this.drawBloodDecals(ctx);

    // Hero.
    this.drawHero(ctx, game);

    // Particles + floaters.
    this.particles.render(ctx);
    for (const f of this.floaters) {
      const a = Math.max(0, Math.min(1, f.life / f.max));
      ctx.save();
      ctx.globalAlpha = a;
      drawText(ctx, f.text, f.x, f.y, {
        size: f.size, color: f.color, align: "center",
        bold: true, glow: f.color, baseline: "middle",
      });
      ctx.restore();
    }

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(194, 26, 26, ${this.hitFlash})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Banners / HUD.
    if (this.phase === "intro") {
      const alpha = Math.min(1, this.introT * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawBanner(ctx, "THE WORM'S MAW", W / 2, 60, 44, COLORS.bile, COLORS.blood);
      drawBanner(ctx, this.enemyName, W / 2, 108, 22, COLORS.bone, COLORS.worm);
      ctx.restore();
    }

    if (this.phase === "win") {
      drawBanner(ctx, "THE JAW FALLS OPEN!", W / 2, 60, 46, COLORS.bile, COLORS.blood);
      drawBanner(ctx, "YOU LEAP FREE!", W / 2, 108, 24, COLORS.bone, COLORS.worm);
    }

    // Slam telegraph band - full-width red pulse.
    if (this.slamTelegraph !== null) {
      const k = 1 - Math.max(0, this.slamTelegraph) / 1.6;
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(this.anim * 9));
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(255, 60, 60, ${0.35 + k * 0.5})`);
      g.addColorStop(0.5, `rgba(255, 60, 60, 0.05)`);
      g.addColorStop(1, `rgba(255, 60, 60, ${0.35 + k * 0.5})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      drawText(ctx, `!! FULL-MAW SLAM - BRACE [F/4] !!`, W / 2, 160, {
        size: 26, color: "#ffbaba", align: "center", bold: true,
        glow: "#c21a1a", maxWidth: W - 80,
      });
    }

    if (this.perfectFlashT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.5 * this.perfectFlashT;
      ctx.fillStyle = COLORS.gold || "#ffd966";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    this.drawHUD(ctx, game);
    this.drawContextHint(ctx, game);
    this.drawLog(ctx);

    if (this.potionState) {
      drawManaPotionModal(ctx, this.potionState, COLORS, game.player);
    }

    if (this.paused) {
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(0, 0, W, H);
      drawBanner(ctx, "PAUSED", W / 2, H / 2 - 18, 52, COLORS.bone, COLORS.blood);
      drawText(ctx, "[P] or [ESC] to resume", W / 2, H / 2 + 34, {
        size: 18, color: COLORS.boneDim, align: "center",
      });
    }
  }

  drawDaylight(ctx) {
    // If any bottom tooth is knocked out, paint a soft daylight gradient
    // in that column to sell the "escape hole" progress visually.
    for (const t of this.bottomTeeth) {
      if (!t.knockedOut) continue;
      const cx = COLS_X[t.col];
      const g = ctx.createRadialGradient(cx, BOTTOM_TOOTH_Y, 10, cx, BOTTOM_TOOTH_Y, 140);
      g.addColorStop(0, "rgba(255, 236, 170, 0.85)");
      g.addColorStop(1, "rgba(255, 236, 170, 0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, BOTTOM_TOOTH_Y, 140, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawLaneGuides(ctx) {
    ctx.save();
    for (let i = 0; i < NUM_COLS; i++) {
      const x = COLS_X[i];
      const active = i === this.col;
      ctx.strokeStyle = active ? "rgba(255, 200, 120, 0.35)" : "rgba(0, 0, 0, 0.18)";
      ctx.lineWidth = active ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x, H - 40);
      ctx.stroke();
    }
    // Stance spline: slight left offset — lines up mentally with descending top fangs.
    const hx = heroStandX(this.col);
    ctx.strokeStyle = "rgba(255, 235, 190, 0.55)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(hx, 160);
    ctx.lineTo(hx, H - 88);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  drawTopTeeth(ctx) {
    for (const tt of this.topTeeth) this.drawOneTopTooth(ctx, tt);
  }

  drawOneTopTooth(ctx, tt) {
    const x = topFangDrawX(tt.col);
    const baseY = TOP_TOOTH_Y;
    // Tip descends from TOP_TOOTH_TIP (rest) toward TOP_CHOMP_Y at chomp=1.
    const tipY = TOP_TOOTH_TIP + (TOP_CHOMP_Y - TOP_TOOTH_TIP) * tt.chomp;
    const halfW = 52;

    // Warning glow if telegraphing.
    if (tt.telegraph !== null) {
      const pulse = 0.5 + 0.5 * Math.sin(this.anim * 20);
      ctx.save();
      ctx.fillStyle = `rgba(255, 40, 40, ${0.25 + 0.35 * pulse})`;
      ctx.beginPath();
      ctx.moveTo(x - halfW - 10, baseY - 10);
      ctx.lineTo(x + halfW + 10, baseY - 10);
      ctx.lineTo(x + 10, tipY + 20);
      ctx.lineTo(x - 10, tipY + 20);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Gum base (dark red slab the tooth hangs from).
    ctx.save();
    ctx.fillStyle = shade(COLORS.blood || "#a12030", 0.6);
    ctx.beginPath();
    ctx.moveTo(x - halfW - 18, baseY - 40);
    ctx.lineTo(x + halfW + 18, baseY - 40);
    ctx.lineTo(x + halfW + 10, baseY + 20);
    ctx.lineTo(x - halfW - 10, baseY + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // The tooth itself (tapered fang).
    const flash = tt.flashT;
    const toothCol = flash > 0 ? "#ffe9a6" : "#f7efd0";
    const shadowCol = shade(toothCol, 0.72);

    ctx.save();
    // Shadow / outline
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.moveTo(x - halfW + 4, baseY + 4);
    ctx.lineTo(x + halfW + 4, baseY + 4);
    ctx.lineTo(x + 6, tipY + 4);
    ctx.lineTo(x - 6, tipY + 4);
    ctx.closePath();
    ctx.fill();

    // Main tooth body - gradient from root to tip.
    const g = ctx.createLinearGradient(x, baseY, x, tipY);
    g.addColorStop(0, toothCol);
    g.addColorStop(0.5, shade(toothCol, 0.9));
    g.addColorStop(1, shade(toothCol, 0.78));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - halfW, baseY);
    ctx.lineTo(x + halfW, baseY);
    ctx.lineTo(x + 4, tipY);
    ctx.lineTo(x - 4, tipY);
    ctx.closePath();
    ctx.fill();

    // Highlight stripe
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - halfW * 0.4, baseY + 20);
    ctx.lineTo(x - 2, tipY - 10);
    ctx.stroke();

    // Cracks during chomp animation
    if (tt.chomp > 0.1) {
      ctx.strokeStyle = shadowCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 20, baseY + 30);
      ctx.lineTo(x - 6, baseY + 80);
      ctx.moveTo(x + 14, baseY + 38);
      ctx.lineTo(x + 2, baseY + 90);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBottomTeeth(ctx) {
    for (const t of this.bottomTeeth) this.drawOneBottomTooth(ctx, t);
  }

  drawOneBottomTooth(ctx, t) {
    const x = COLS_X[t.col];
    const halfW = 58;

    // Gum (at the bottom).
    ctx.save();
    ctx.fillStyle = shade(COLORS.blood || "#a12030", 0.55);
    ctx.beginPath();
    ctx.moveTo(x - halfW - 22, BOTTOM_TOOTH_Y + 40);
    ctx.lineTo(x + halfW + 22, BOTTOM_TOOTH_Y + 40);
    ctx.lineTo(x + halfW + 10, BOTTOM_TOOTH_Y - 20);
    ctx.lineTo(x - halfW - 10, BOTTOM_TOOTH_Y - 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (t.knockedOut) {
      // Draw the empty socket - dark blood cavity with a little daylight
      // shining through (daylight gradient drawn earlier).
      ctx.save();
      ctx.fillStyle = "rgba(20, 0, 8, 0.9)";
      ctx.beginPath();
      ctx.ellipse(x, BOTTOM_TOOTH_Y - 4, halfW - 4, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Countdown label so the player knows when it regrows.
      const pct = Math.max(0, t.respawnIn) / TOOTH_RESPAWN_SECS;
      const seconds = Math.ceil(Math.max(0, t.respawnIn));
      drawText(ctx, `${seconds}s`, x, BOTTOM_TOOTH_Y - 4, {
        size: 16, color: "#ffd966", align: "center", baseline: "middle", bold: true,
      });
      // Thin ring filling up.
      ctx.save();
      ctx.strokeStyle = "rgba(255, 217, 102, 0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      const r = halfW - 2;
      ctx.arc(x, BOTTOM_TOOTH_Y - 4,
        r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct));
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Alive tooth - taper upward.
    const shakeX = t.shakeT > 0 ? Math.sin(this.anim * 40) * 3 : 0;
    const tipY = BOTTOM_TOOTH_TIP + Math.sin(t.wobble) * 1.5;
    const flash = t.flashT;
    const toothCol = flash > 0 ? "#ffe9a6" : "#efe4c2";

    ctx.save();
    ctx.translate(shakeX, 0);
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.moveTo(x - halfW + 4, BOTTOM_TOOTH_Y + 4);
    ctx.lineTo(x + halfW + 4, BOTTOM_TOOTH_Y + 4);
    ctx.lineTo(x + 8, tipY + 4);
    ctx.lineTo(x - 8, tipY + 4);
    ctx.closePath();
    ctx.fill();

    // Body
    const g = ctx.createLinearGradient(x, BOTTOM_TOOTH_Y, x, tipY);
    g.addColorStop(0, shade(toothCol, 0.78));
    g.addColorStop(0.5, shade(toothCol, 0.92));
    g.addColorStop(1, toothCol);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - halfW, BOTTOM_TOOTH_Y);
    ctx.lineTo(x + halfW, BOTTOM_TOOTH_Y);
    ctx.lineTo(x + 8, tipY);
    ctx.lineTo(x - 8, tipY);
    ctx.closePath();
    ctx.fill();

    // Highlight
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - halfW * 0.35, BOTTOM_TOOTH_Y - 18);
    ctx.lineTo(x - 6, tipY + 14);
    ctx.stroke();

    // Damage cracks scale with damage ratio.
    const dmgPct = 1 - t.hpDisplay / t.hpMax;
    if (dmgPct > 0.2) {
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - 10, BOTTOM_TOOTH_Y - 6);
      ctx.lineTo(x, tipY + 30);
      ctx.moveTo(x + 14, BOTTOM_TOOTH_Y - 2);
      ctx.lineTo(x + 4, tipY + 20);
      ctx.stroke();
    }
    if (dmgPct > 0.55) {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - 22, BOTTOM_TOOTH_Y + 14);
      ctx.lineTo(x - 8, tipY + 10);
      ctx.moveTo(x + 22, BOTTOM_TOOTH_Y + 10);
      ctx.lineTo(x + 8, tipY + 14);
      ctx.stroke();
    }
    ctx.restore();

    // HP bar above the tooth.
    const barW = 120;
    const barX = x - barW / 2;
    const barY = BOTTOM_TOOTH_TIP - 40;
    drawBar(ctx, barX, barY, barW, 10, t.hpDisplay / t.hpMax, {
      fill: "#ff7a8a",
      label: `${Math.ceil(t.hpDisplay)}/${t.hpMax}`,
      labelColor: "#111",
    });

    // "Lane" number badge near tip for quick-reference.
    drawText(ctx, String(t.col + 1), x, tipY - 18, {
      size: 14, color: "#111", align: "center", bold: true,
      outline: true, outlineColor: "rgba(255,220,170,0.95)",
    });
  }

  drawBloodDecals(ctx) {
    ctx.save();
    for (const d of this.bloodDecals) {
      ctx.fillStyle = `rgba(120, 10, 20, ${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHero(ctx, game) {
    const p = game.player;
    const x = heroStandX(this.col);
    const y = HERO_Y + Math.sin(this.heroBob) * 2;

    drawDropShadow(ctx, x, y + 26, 30, 10, 0.55);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2.4, 2.4);
    drawHero(ctx, 0, 0, 1, this.anim, p?.buildId || "swift", p?.synergyId);
    ctx.restore();

    // Brace halo
    if (this.braceTime > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(this.anim * 12);
      ctx.strokeStyle = "#c9e0ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y + 4, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Dodge i-frames - cyan after-image.
    if (this.dodgeFlashT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.35 * this.dodgeFlashT;
      ctx.fillStyle = "#7fe3ff";
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 24, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHUD(ctx, game) {
    const p = game.player;
    // Player HP / MP / (Armor) panel in the top-left.
    const pW = 300;
    const pH = p.armorMax > 0 ? 116 : 88;
    const pX = 18, pY = 18;
    drawPanel(ctx, pX, pY, pW, pH);
    drawText(ctx, p.name || "HERO", pX + 14, pY + 10, {
      size: 14, color: COLORS.bone, bold: true, maxWidth: pW - 28,
    });
    drawBar(ctx, pX + 14, pY + 32, pW - 28, 16, p.hp / p.hpMax, {
      fill: COLORS.blood, label: `HP  ${Math.ceil(p.hp)}/${p.hpMax}`,
    });
    drawBar(ctx, pX + 14, pY + 54, pW - 28, 14, p.mana / p.manaMax, {
      fill: COLORS.mana, label: `MP  ${Math.ceil(p.mana)}/${p.manaMax}`,
    });
    if (p.armorMax > 0) {
      drawBar(ctx, pX + 14, pY + 74, pW - 28, 14, p.armor / p.armorMax, {
        fill: "#c0c4cc",
        label: `ARM ${Math.ceil(p.armor)}/${p.armorMax}`,
        labelColor: "#111",
      });
    }

    // Boss status panel in top-right: count of molars still up +
    // countdown to the next chomp.
    const bW = 320;
    const bH = 102;
    const bX = W - bW - 18;
    const bY = 18;
    drawPanel(ctx, bX, bY, bW, bH);
    drawText(ctx, this.enemyName, bX + 14, bY + 10, {
      size: 14, color: COLORS.bile, bold: true, maxWidth: bW - 28,
    });
    const standing = this.bottomTeeth.filter(t => !t.knockedOut).length;
    const downNow  = NUM_COLS - standing;
    drawText(ctx, `MOLARS STANDING  ${standing} / ${NUM_COLS}`,
      bX + 14, bY + 32, { size: 14, color: COLORS.bone });
    drawText(ctx, `KNOCKED OUT      ${downNow} / ${NUM_COLS}`,
      bX + 14, bY + 50, {
        size: 14,
        color: downNow === NUM_COLS ? "#bfff00" : COLORS.bone,
        bold: downNow === NUM_COLS,
      });
    // Next-chomp indicator (shortest telegraph remaining, else slam).
    let nextStr = "READY";
    let nextColor = COLORS.boneDim;
    const teleSorted = this.topTeeth
      .filter(t => t.telegraph !== null)
      .map(t => t.telegraph).sort((a, b) => a - b);
    if (this.slamTelegraph !== null) {
      nextStr = `FULL-MAW SLAM in ${this.slamTelegraph.toFixed(1)}s`;
      nextColor = "#ff6060";
    } else if (teleSorted.length > 0) {
      nextStr = `CHOMP in ${teleSorted[0].toFixed(1)}s`;
      nextColor = "#ff9a6a";
    }
    drawText(ctx, nextStr, bX + 14, bY + 72, {
      size: 13, color: nextColor, bold: true, maxWidth: bW - 28,
    });

    // Action row at the bottom.
    this.drawActionBar(ctx, game);
  }

  drawActionBar(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    const pam = p.pactMods?.attackCdMult || 1;
    const psm = p.pactMods?.specialCdMult || 1;
    const plMode = p.loadoutId === "plasmids" ? activePlasmMode(l, p.plasmModeIndex ?? 0) : null;
    const mb = (p.manaCostBonus || 0);
    const potCd = this.potionDrinkCooldown > 0;
    const vialCdStr = potCd ? `${this.potionDrinkCooldown.toFixed(1)}s` : "READY";

    const items = plMode
      ? [
        {
          key: "Q/1",
          name: String(plMode.boltName ?? "Bolt").slice(0, 22),
          info: `${plMode.dmg[0]}–${plMode.dmg[1]} · ${plMode.manaCost + mb} MP`,
          cd: p.cooldowns.attack,
          cdMax: plMode.cooldown * pam,
        },
        {
          key: "E/2",
          name: l.special?.name ?? "Cycle",
          info: `Next: ${plMode.label} · tap to rotate mode`,
          cd: p.cooldowns.special,
          cdMax: (l.special?.cooldown || 0) * psm,
        },
        {
          key: "R/3",
          name: "Mana Vial",
          info: potCd ? `Recharging ${vialCdStr}` : "Pop cork · pour (full MP)",
          cd: potCd ? this.potionDrinkCooldown : 0,
          cdMax: potCd ? POTION_DRINK_CD_SEC : 0,
        },
        {
          key: "F/4",
          name: "Brace",
          info: "Halve chomp · perfect = counter",
          cd: 0,
          cdMax: 0,
        },
      ]
      : [
        { key: "Q/1", name: l.attack.name,  info: `${l.attack.dmg[0]}–${l.attack.dmg[1]} · ${l.attack.manaCost + mb} MP`,
          cd: p.cooldowns.attack,  cdMax: l.attack.cooldown * pam },
        { key: "E/2", name: l.special.name, info: `${l.special.dmg[0]}–${l.special.dmg[1]} · ${l.special.manaCost + mb} MP`,
          cd: p.cooldowns.special, cdMax: l.special.cooldown * psm },
        {
          key: "R/3",
          name: "Mana Vial",
          info: potCd ? `Recharging ${vialCdStr}` : "Pop cork · pour (full MP)",
          cd: potCd ? this.potionDrinkCooldown : 0,
          cdMax: potCd ? POTION_DRINK_CD_SEC : 0,
        },
        {
          key: "F/4",
          name: "Brace",
          info: "Halve chomp · perfect = counter",
          cd: 0,
          cdMax: 0,
        },
      ];
    const barY = H - 86;
    const barH = 68;
    const cardW = (W - 48 - 24 * (items.length - 1)) / items.length;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const x = 24 + i * (cardW + 24);
      ctx.save();
      roundRect(ctx, x, barY, cardW, barH, 10);
      ctx.fillStyle = "rgba(10, 0, 20, 0.72)";
      ctx.fill();
      ctx.strokeStyle = it.cd > 0 ? COLORS.boneDim : COLORS.bile;
      ctx.lineWidth = 2;
      roundRect(ctx, x + 0.5, barY + 0.5, cardW - 1, barH - 1, 10);
      ctx.stroke();
      ctx.restore();
      drawText(ctx, it.key, x + 12, barY + 8, {
        size: 13, color: COLORS.bile, bold: true, maxWidth: cardW - 24,
      });
      const nameMax = cardW - 24 - (it.cdMax > 0 ? 84 : 0);
      drawText(ctx, it.name, x + 12, barY + 26, {
        size: 15, color: it.cd > 0 ? COLORS.boneDim : COLORS.bone, bold: true,
        maxWidth: nameMax,
      });
      drawText(ctx, it.info, x + 12, barY + 48, {
        size: 12, color: COLORS.boneDim, maxWidth: nameMax,
      });
      if (it.cdMax > 0) {
        const pct = 1 - it.cd / it.cdMax;
        drawBar(ctx, x + cardW - 80, barY + 48, 68, 8, pct, {
          fill: it.cd > 0 ? "#8a9aff" : "#bfff00",
          label: it.cd > 0 ? it.cd.toFixed(1) + "s" : "READY",
          labelColor: it.cd > 0 ? "#fff" : "#111",
        });
      }
    }
  }

  drawContextHint(ctx, game) {
    const p = game.player;
    // Small smart hint just under the HUD. Tells the player what to do NOW.
    const downNow = this.bottomTeeth.filter(t => t.knockedOut).length;
    let msg = "";
    let color = COLORS.bone;

    const imminentChomp = this.topTeeth.find(
      t => t.telegraph !== null && t.telegraph <= PERFECT_BRACE_WINDOW + 0.4
    );
    if (this.slamTelegraph !== null) {
      msg = "FULL-MAW SLAM - BRACE [F/4] NOW!";
      color = "#ff9a9a";
    } else if (imminentChomp) {
      if (this.col === imminentChomp.col) {
        msg = `Column ${imminentChomp.col + 1} chomp INCOMING - move [A/D] or BRACE [F/4]!`;
        color = "#ff9a9a";
      } else {
        msg = `Column ${imminentChomp.col + 1} is about to chomp - stay out of that lane.`;
        color = "#ffd0b0";
      }
    } else if (downNow === NUM_COLS - 1) {
      msg = "One more tooth! Drop it fast - the others can regrow!";
      color = "#bfff00";
    } else if (downNow >= 1) {
      msg = `${downNow}/${NUM_COLS} molars down. Keep the pressure on every lane!`;
      color = "#e6f0a0";
    } else {
      msg = p.loadoutId === "plasmids"
        ? "Move [A/D]; [Q/1] Gene Bolt · [E/2] cycle element · [R/3] mana vial · [X] dodge twitch."
        : "Move [A/D]; swing [Q/1] / [E/2] · [R/3] mana vial · [X] dodge.";
      color = COLORS.bone;
    }

    const hw = 820;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    roundRect(ctx, W / 2 - hw / 2, 138, hw, 30, 8);
    ctx.fill();
    ctx.restore();
    drawText(ctx, msg, W / 2, 153, {
      size: 15, color, align: "center", baseline: "middle", bold: true,
      maxWidth: hw - 24,
    });
  }

  drawLog(ctx) {
    // Thin log strip just above the action bar.
    const w = W - 48, h = 72;
    const x = 24, y = H - 86 - h - 6;
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.restore();
    const lines = this.log.slice(-4);
    for (let i = 0; i < lines.length; i++) {
      drawText(ctx, lines[i], x + 12, y + 10 + i * 14, {
        size: 12, color: i === lines.length - 1 ? COLORS.bone : COLORS.boneDim,
        maxWidth: w - 24,
      });
    }
    // Footer help strip - compact.
    drawText(ctx,
      "[A/D] lanes · bottom cards · [R/3] mana vial · [X] dodge · [P] pause",
      x + 12, y + h - 16, {
        size: 12, color: COLORS.boneDim, maxWidth: w - 28,
      });
  }
}

// Preserve the old import name so existing routing (climb.js, intro.js)
// works without churn. The file is named tongueBoss.js for historical
// reasons; the scene class itself has been renamed.
export { MawBossScene as TongueBossScene };

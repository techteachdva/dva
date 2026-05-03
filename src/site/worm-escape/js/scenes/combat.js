import {
  W, H, COLORS,
  drawBackdropCached, drawText, drawBanner, drawPanel, drawBar,
  drawHero, drawSphere, drawPlate, drawDropShadow,
  ParticleSystem, screenShake, shade, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { ENEMIES } from "../content/enemies.js";
import { rollElite, applyElite } from "../content/elites.js";
import { pick, rand, randInt } from "../engine/rng.js";
import {
  pointInRect,
  columnIndexFromX,
  stepTowardIndex,
} from "../engine/pointer.js";
import {
  applyDamage, matchupMultiplier, matchupLabel, recordDirectHpHit, recordDirectArmorHit,
  applyTamerKillGrowth,
  plasmElementMult, activePlasmMode,
} from "../content/player.js";
import { TransitionScene } from "./transition.js";
import { PactScene } from "./pact.js";
import { GameOverScene } from "./gameover.js";
import {
  pickTwoDistinctPotionKeys,
  POTION_DRINK_CD_SEC,
  POTION_MINIGAME_TIME_SEC,
  tickManaPotionMiniGame,
  drawManaPotionModal,
} from "../engine/manaPotion.js";
import { applyOutboundStrikeDice } from "../engine/strikeDamageMods.js";
import { sillyMirrorCol5, sillySwappedHorizontalLaneDelta } from "../engine/sillyPactInput.js";
import {
  endlessDangerMult,
  endlessEnemyCssFilter,
  resolveEndlessPalette,
} from "../content/endlessStyle.js";
import { runEnemyHpMult, runIncomingDamageMult } from "../content/gameBalance.js";
import { visualMods } from "../engine/visualMods.js";
import { recordPinkFloydTrail } from "../engine/pinkFloydVfx.js";

/** Five tactical columns — guardian and player must align to land strikes (unless weapon skips lanes). */
const NUM_COMBAT_LANES = 5;
const LAST_COMBAT_LANE = NUM_COMBAT_LANES - 1;
const LANES = [W * 0.14, W * 0.32, W * 0.5, W * 0.68, W * 0.86];
const GUARDIAN_LANE_NAMES = ["FAR LEFT", "LEFT", "CENTER", "RIGHT", "FAR RIGHT"];
const FLOOR_Y = 620;
const HERO_Y = 600;

/** Bottom action strip + floating log layout (fullscreen-safe touch targets ~120px tall). */
const ACTION_BAR_TOP = H - 128;
const ACTION_BAR_H = 128;
const ACTION_PAD_X = 10;
const ACTION_GAP = 8;
/** Compact combat log: top-center strip only — never overlays lane guardians (arena ~cy 340). */
const LOG_DISPLAY_LINES = 3;
const LOG_LINE_MAX_CHARS = 78;

function truncateLogLine(s, maxChars = LOG_LINE_MAX_CHARS) {
  const str = String(s ?? "");
  if (str.length <= maxChars) return str;
  return str.slice(0, Math.max(0, maxChars - 1)) + "…";
}

/** RGB complement for bubblegum twin HP bar / accents (#rrggbb only). */
function complementHexColor(hex) {
  if (typeof hex !== "string" || !hex.startsWith("#")) return hex;
  const n = hex.slice(1);
  if (n.length !== 6) return hex;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if ([r, g, b].some((x) => Number.isNaN(x))) return hex;
  return `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
}

/** Canvas filter stack for bubblegum fight 2 — complementary hues vs the normal sprite. */
const BUBBLE_TWIN_ENEMY_FILTER = "hue-rotate(180deg) saturate(1.42) contrast(1.06)";

// Per-chamber damage multiplier applied to every source of damage the
// PLAYER receives (acid gouts, melee hits, heavy slams, combo jabs).
// Stomach baseline, Gullet +45%. Same curve as climb hazards.
const CHAMBER_DMG_SCALE = [1.0, 1.18, 1.32, 1.45];

// Weighted pool of enemy moves. Heavy and Combo are rarer than Jab to keep
// the cadence readable; during enrage the pool shifts to favor heavy/combo.
// `jab`  - single lane-targeted strike, brace halves, dodge to other lane helps.
// `heavy`- full-arena slam, LANE DODGE DOES NOTHING, only brace saves you.
// `combo`- triple quick strike (3 hits, 0.42s apart), each halved by brace
//          (so you basically have to time brace so it covers the last 2+).

export class CombatScene {
  constructor(chamberIdx, opts = {}) {
    this.chamberIdx = chamberIdx;
    /** Bubblegum cheat: guardian fight 1 of 2 in the same valve */
    this.bubbleFightIndex = opts.bubbleFightIndex ?? 1;
    /** Bubblegum fight 2: inverted color pass on the guardian sprite + UI accents. */
    this.bubblePaletteInvert = !!opts.bubblePaletteInvert;
    this.chamber = CHAMBERS[chamberIdx];
    const ed = ENEMIES[this.chamber.guardian];
    const hp = Math.floor(ed.hp * (1 + chamberIdx * 0.15));
    // Deep-copy damage ranges so applyElite can mutate safely.
    this.enemy = {
      ...ed, hp, hpMax: hp,
      attackDmg: ed.attackDmg ? [...ed.attackDmg] : undefined,
      heavyDmg:  ed.heavyDmg  ? [...ed.heavyDmg]  : undefined,
      stunT: 0,
    };
    // Elite roll - if the chamber promotes the guardian to an Elite, wrap
    // it with the stat bumps and a twist. Elite state is read all over
    // update()/dealToEnemy() below.
    const elite = rollElite(chamberIdx);
    if (elite) {
      applyElite(this.enemy, elite.twistId);
      this.eliteKill = true;
      this.eliteTwist = elite.twistId;
      this.eliteGoutTimer = rand(2.0, 3.2);
    }
    // Display HP lerps toward this.enemy.hp for a satisfying tick-down.
    this.enemyHpDisplay = hp;
    // Persistent blood decals painted on the enemy as they take damage.
    // Each: { x, y, r, alpha } in enemy-local space.
    this.bloodDecals = [];
    // Floating damage numbers (spawned on hit, drift up, fade).
    this.floaters = [];

    this.t = 0;
    this.lane = 2;
    this.heroX = LANES[2];
    this.targetX = LANES[2];
    this.anim = 0;
    this.laneCd = 0;

    this.gouts = [];
    this.telegraphs = [];
    this.goutsTimer = 1.5;

    this.menuIdx = 0;
    this.turnLocked = 0;
    this.log = [];
    this.pushLog("A " + this.enemy.name + " guards the sphincter!");
    this.pushLog(this.enemy.flavorIntro);
    // Surface the weapon matchup so the player can plan. This is the key
    // "weapons feel impactful" hook: pick the right tool or pay for it.
    // We read the loadout at enter() since player isn't attached yet.

    this.particles = new ParticleSystem();
    this.hitFlash = 0;
    this.enemyFlash = 0;
    this.enemyShake = 0;

    // Enemy move state machine.
    // Three move types now exist: "jab" (current behavior), "heavy" (slow
    // unavoidable slam, brace-only), and "combo" (3-hit quick flurry).
    this.enemyTurnTimer = rand(2.6, 3.4);
    this.enemyTellTime = 0;
    this.enemyTelling = false;
    this.enemyMoveType = "jab";
    // Combo sequencing: once a combo resolves the tell, 3 hits land in a row.
    this.comboHitsLeft = 0;
    this.comboHitTimer = 0;

    // Guardian occupies a tactical column; it shuffles to force repositioning.
    this.enemyLane = randInt(0, LAST_COMBAT_LANE);
    this.enemyLaneTimer = rand(5, 11);
    this.enemyAttackLane = 2;

    // Enrage state - triggers at enemy.hp < hpMax * enrageAt. Kicks off
    // tighter cadence, optional paired acid gouts, and +damage.
    this.enraged = false;
    this.enrageFlashT = 0;

    // BRACE mechanic.
    // `braceTime` = seconds remaining of passive damage reduction.
    // `perfectBraceReady` = set when the player braces within the last 0.5s
    // of an enemy tell. Grants a 50% damage counter on the NEXT attack.
    this.braceTime = 0;
    this.perfectBraceReady = false;
    this.perfectFlashT = 0;

    this.phase = "intro";
    this.introT = 0;
    this.winTimer = 0;
    /** Bubblegum: interstitial after fight 1 before loading the hue-twisted twin. */
    this.bubbleDoubleT = 0;
    this.paused = false;
    this.done = false;

    if (this.bubbleFightIndex === 2 && this.bubblePaletteInvert) {
      this.phase = "fight";
      this.introT = 0;
      this.pushLog("A twisted twin spills out — palette flipped, malice intact.");
    }

    // v0.12 Hex staff mark stack (0-3). Builds on attack hits; special
    // detonates them for a big per-mark damage bonus.
    this.hexMarks = 0;

    // Poison visual flash - pulses briefly every time poison is refreshed.
    this.poisonFlashT = 0;

    // Elite twist state (eliteKill / eliteTwist set above if the roll hit).
    if (this.eliteKill === undefined) this.eliteKill = false;
    if (this.eliteTwist === undefined) this.eliteTwist = null;
    if (this.eliteGoutTimer === undefined) this.eliteGoutTimer = 0;
    this.eliteAuraT = 0;
    // Hex-eyed elite: cumulative tell-time reduction (stacks with heavy slams).
    this.hexEyedShorten = 0;
    // Bloated elite: death explosion already occurred.
    this.bloatedExploded = false;
    // Shield-broken flash timer (one-shot visual for Shielded elites).
    this.shieldBrokenT = 0;

    /** @type {null|{ corkKey:string, pourKey:string, phase:string, corkPop:boolean, tilt:number, liquid:number, timeLeft:number, hintFlash:number }} */
    this.potionState = null;
    /** Seconds until another mana potion can be started */
    this.potionDrinkCooldown = 0;
  }

  painMult(game) {
    const base = CHAMBER_DMG_SCALE[this.chamberIdx] || 1;
    const e = game?.endlessMode ? endlessDangerMult(game) : 1;
    const cheatM = runIncomingDamageMult(game);
    return base * e * cheatM;
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 10) this.log.shift();
  }

  tryEnterManaPotion(p) {
    if (this.phase !== "fight" || this.enemy.hp <= 0) return;
    if (this.potionState) return;
    if (this.potionDrinkCooldown > 0) {
      SFX.deny();
      this.pushLog(`Another mana vial in ${this.potionDrinkCooldown.toFixed(1)}s...`);
      return;
    }
    // Do not block when MP is full: resetChamber() tops mana before most boss
    // fights, so denying here made vials appear broken. Mini-game still runs;
    // success refills to max (no-op if already full).
    const [corkKey, pourKey] = pickTwoDistinctPotionKeys();
    const mm = Number(p.manaMax) || 0;
    const mp = Number(p.mana) || 0;
    const alreadyFull = mm > 0 && mp >= mm - 1e-9;
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
    this.pushLog(
      alreadyFull
        ? "POP the cork — MP brimming; pour to steady your hands!"
        : "POP the cork — then POUR!",
    );
    SFX.confirm();
  }

  endManaPotionSuccess(p) {
    p.mana = p.manaMax;
    this.potionDrinkCooldown = POTION_DRINK_CD_SEC;
    this.potionState = null;
    this.pushLog("Cold blue tonic hits — mana surges!");
    SFX.jump();
    this.turnLocked = 0.28;
    this.hitFlash = 0;
  }

  endManaPotionFail() {
    this.potionDrinkCooldown = 9;
    this.potionState = null;
    this.pushLog("The vial slips — mana lost!");
    SFX.deny();
    this.turnLocked = 0.2;
  }


  /** Four touch rows for Attack 1 — Attack 2 — Potion — Brace (canvas space). */
  actionButtonRects() {
    const top = ACTION_BAR_TOP + 14;
    const innerH = ACTION_BAR_H - 26;
    const usableW = W - ACTION_PAD_X * 2 - ACTION_GAP * 3;
    const btnW = usableW / 4;
    const rects = [];
    for (let i = 0; i < 4; i++) {
      const x = ACTION_PAD_X + i * (btnW + ACTION_GAP);
      rects.push({ x, y: top, w: btnW, h: innerH });
    }
    return rects;
  }

  enter(game) {
    const p = game.player;
    const mult = matchupMultiplier(p.loadoutId, this.enemy.art);
    const lbl = matchupLabel(mult);
    this.matchupMult = mult;
    this.matchupLabel = lbl;
    if (lbl) {
      if (mult > 1) {
        this.pushLog(`Your ${p.loadout.name} looks ${lbl.text} against it!`);
      } else {
        this.pushLog(`Your ${p.loadout.name} feels ${lbl.text.toLowerCase()} here...`);
      }
    } else {
      this.pushLog(`Your ${p.loadout.name} matches up evenly. Fight smart.`);
    }
    if (this.eliteKill) {
      this.pushLog(`!! ELITE [${this.eliteTwist}] - this one is different.`);
    }
    if (p.synergyTitle) {
      this.pushLog(`SYNERGY ACTIVE: ${p.synergyTitle}`);
    }

    const hpBal = runEnemyHpMult(game);
    if (hpBal !== 1) {
      const nhBal = Math.max(1, Math.round(this.enemy.hp * hpBal));
      this.enemy.hp = nhBal;
      this.enemy.hpMax = nhBal;
      this.enemyHpDisplay = nhBal;
    }

    if (game.endlessMode) {
      const m = endlessDangerMult(game);
      const nh = Math.round(this.enemy.hp * m);
      this.enemy.hp = nh;
      this.enemy.hpMax = nh;
      this.enemyHpDisplay = nh;
      const sr = (r) => (!r ? r : [
        Math.max(1, Math.round(r[0] * m)),
        Math.max(1, Math.round(r[1] * m)),
      ]);
      if (this.enemy.attackDmg) this.enemy.attackDmg = sr(this.enemy.attackDmg);
      if (this.enemy.heavyDmg) this.enemy.heavyDmg = sr(this.enemy.heavyDmg);
    }
  }

  update(dt, game) {
    if (this.done) return;
    const p = game.player;

    const vialOpen = this.phase === "fight" && !!this.potionState;

    if (game.input.wasPressed("p", "Escape")) {
      if (!vialOpen) {
        this.paused = !this.paused;
        SFX.click();
      }
    }

    if (vialOpen) {
      tickManaPotionMiniGame(
        this.potionState,
        dt,
        game.input,
        () => this.endManaPotionSuccess(game.player),
        () => this.endManaPotionFail(),
      );
    }

    this.tryOpenManaVialInputWhilePaused(game);

    if (this.paused) return;

    if (this.phase === "bubbleDouble") {
      this.bubbleDoubleT -= dt;
      this.t += dt;
      this.anim += dt * 4;
      this.particles.update(dt);
      if (this.bubbleDoubleT <= 0) {
        game.scenes.replace(
          new CombatScene(this.chamberIdx, {
            bubbleFightIndex: 2,
            bubblePaletteInvert: true,
          }),
          game,
        );
      }
      return;
    }

    this.t += dt;
    this.anim += dt * 4;
    if (typeof game.invulnerable === "boolean") p.invulnerable = game.invulnerable;
    if (p.score) p.score.timeSpent += dt;

    // Lane lerp
    const lerpSpeed = p.buildId === "swift" ? 18 : 11;
    this.heroX += (this.targetX - this.heroX) * Math.min(1, dt * lerpSpeed);
    if (game.pinkFloydMode && (this.phase === "fight" || this.phase === "win")) {
      recordPinkFloydTrail(game, this.heroX, HERO_Y);
    }

    // Lane swapping (cooldown by build).
    // v0.10 INPUT FIX: wasPressed for one-lane-per-keystroke. A tap moves
    // exactly one lane; holding the key does NOT slide across all three.
    this.laneCd -= dt;
    if (!this.potionState && this.laneCd <= 0 && this.phase === "fight") {
      let movedLane = false;
      const revH = !!(p.pactMods && p.pactMods.sillyMirrorH);
      const hop = sillySwappedHorizontalLaneDelta(game.input, this.lane, LAST_COMBAT_LANE, revH);
      if (hop === -1) {
        this.lane--;
        movedLane = true;
      } else if (hop === 1) {
        this.lane++;
        movedLane = true;
      } else if (game.input.wasPressed("Mouse0")) {
        const mx = game.input.mouseX, my = game.input.mouseY;
        if (!this.hitCombatBlockingUi(mx, my)) {
          let targetLane = columnIndexFromX(mx, LANES);
          if (revH) targetLane = sillyMirrorCol5(targetLane);
          const step = stepTowardIndex(this.lane, targetLane);
          if (step !== 0) {
            this.lane += step;
            movedLane = true;
          }
        }
      }
      if (movedLane) {
        this.targetX = LANES[this.lane];
        this.laneCd = p.laneSwapCd;
        SFX.dodge();
      }
    }

    // Acid timer keeps ticking in combat too, and the corrosion itself
    // scales with chamber difficulty. Corrosion tracks into totalHpLost
    // but NOT hitsTaken (it's a continuous tick, not a distinct hit).
    const corrScale = this.painMult(game);
    if (!this.potionState && !p.invulnerable) {
      p.acidTimer -= dt * p.acidResist;
      if (p.acidTimer <= 0) {
        if (p.armor > 0) {
          const lost = Math.min(p.armor, 4 * corrScale * dt);
          p.armor = Math.max(0, p.armor - lost);
          recordDirectArmorHit(p, lost, { countAsHit: false });
        } else {
          const lost = 2 * corrScale * dt;
          p.hp -= lost;
          recordDirectHpHit(p, lost, { countAsHit: false });
          this.hitFlash = Math.max(this.hitFlash, 0.15);
        }
      }
    }
    if (this.phase === "intro") {
      this.introT += dt;
      if (this.introT > 1.6) this.phase = "fight";
    }

    if (this.phase === "fight") {
      this.updateCooldowns(dt, p);
      if (!this.potionState) {
        this.updateEnemyLaneShuffle(dt);
        this.tickTurretDPS(dt, p);
        this.tickChainShred(dt, p);
        if (this.enemy.stunT > 0) this.enemy.stunT -= dt;
        this.updateAcidGouts(dt, p, game);
        this.updateEnemyMelee(dt, p, game);
        this.handleMenu(dt, game);
      }
    }
    if (this.braceTime > 0 && !this.potionState) this.braceTime -= dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.enemyFlash > 0) this.enemyFlash = Math.max(0, this.enemyFlash - dt);
    if (this.enemyShake > 0) this.enemyShake -= dt;
    if (this.enrageFlashT > 0) this.enrageFlashT = Math.max(0, this.enrageFlashT - dt);
    if (this.perfectFlashT > 0) this.perfectFlashT = Math.max(0, this.perfectFlashT - dt);
    if (this.poisonFlashT > 0) this.poisonFlashT = Math.max(0, this.poisonFlashT - dt);
    if (this.shieldBrokenT > 0) this.shieldBrokenT = Math.max(0, this.shieldBrokenT - dt);
    this.eliteAuraT += dt;

    // Poison tick - drip damage-over-time from VIPER / HEX-EYED attacks.
    // Does NOT trigger on-kill effects (unlike a direct hit). Cosmetic
    // poison bubbles every ~0.3s while active.
    if (!this.potionState && this.enemy.hp > 0 && (this.enemy.poisonT || 0) > 0) {
      const dps = this.enemy.poisonDps || 0;
      this.enemy.hp = Math.max(0, this.enemy.hp - dps * dt);
      this.enemy.poisonT -= dt;
      const rot = this.enemy.poisonLabel === "ROT";
      const col = rot ? "#d060ff" : "#9bff80";
      if (Math.random() < dt * 6) {
        this.particles.burst(
          W / 2 + rand(-40, 40),
          FLOOR_Y - 220 + rand(-30, 30),
          col,
          rot ? 5 : 3,
          rot ? 120 : 80,
          0.45,
        );
      }
    }

    // Fanged elite: extra acid gouts outside the normal cadence.
    if (!this.potionState && this.eliteTwist === "FANGED" && this.phase === "fight") {
      this.eliteGoutTimer -= dt;
      if (this.eliteGoutTimer <= 0) {
        this.eliteGoutTimer = rand(3.2, 4.6);
        const lane = randInt(0, LAST_COMBAT_LANE);
        this.telegraphs.push({ lane, t: 0, wait: p.dodgeWindow + 0.05 });
      }
    }

    // Enrage trigger: one-shot state change when HP falls below threshold.
    if (!this.enraged && !this.potionState && this.enemy.hp > 0
        && this.enemy.hp < this.enemy.hpMax * (this.enemy.enrageAt || 0.5)) {
      this.enraged = true;
      this.enrageFlashT = 1.4;
      this.pushLog(`!! ${this.enemy.name} IS ENRAGED !!`);
      SFX.thud();
      screenShake(14, 0.4);
      this.particles.burst(W / 2, FLOOR_Y - 200, "#ff3030", 40, 320, 0.9);
    }

    // Shielded Elite: once per fight at the threshold, raise a shield that
    // drops damage to 1 and requires 3 perfect-brace hits to break. After
    // shieldDuration seconds it drops automatically.
    if (this.eliteTwist === "SHIELDED" && !this.potionState && !this.enemy.shieldUsed
        && this.enemy.hp < this.enemy.hpMax * (this.enemy.shieldTriggerFrac || 0.75)) {
      this.enemy.shielded = true;
      this.enemy.shieldUsed = true;
      this.enemy.shieldCooldown = this.enemy.shieldDuration || 6;
      this.enemy.shieldHitsLeft = 3;
      this.pushLog(`!! SHIELD RAISED - PERFECT BRACE x3 TO BREAK !!`);
      SFX.thud();
      this.particles.burst(W / 2, FLOOR_Y - 200, "#9adaff", 40, 320, 0.9);
    }
    if (this.enemy.shielded && !this.potionState) {
      this.enemy.shieldCooldown -= dt;
      if (this.enemy.shieldCooldown <= 0) {
        this.enemy.shielded = false;
        this.pushLog("The shield fades.");
      }
    }

    // Smooth HP bar tick-down (lerp toward true HP for chewy feedback).
    const hpLerp = Math.min(1, dt * 5.5);
    this.enemyHpDisplay += (this.enemy.hp - this.enemyHpDisplay) * hpLerp;

    // Damage floaters drift up and fade.
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 40 * dt; // slight deceleration
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);

    this.particles.update(dt);

    if (p.hp <= 0) {
      this.done = true;
      SFX.die();
      game.scenes.replace(new GameOverScene("The guardian got its meal."), game);
      return;
    }

    if (this.enemy.hp <= 0 && this.phase === "fight") {
      this.phase = "win";
      SFX.victory();
      this.pushLog(this.enemy.flavorDeath);
      screenShake(10, 0.3);
      this.particles.burst(W / 2, FLOOR_Y - 200, COLORS.bile, 50, 350, 1.0);

      // Blood Tithe pact: heal on kill.
      const pmKill = p.pactMods || {};
      if (pmKill.lifestealOnKill > 0) {
        const heal = pmKill.lifestealOnKill;
        const healed = Math.min(heal, p.hpMax - p.hp);
        p.hp = Math.min(p.hpMax, p.hp + heal);
        if (healed > 0) this.pushLog(`BLOOD TITHE: +${Math.ceil(healed)} HP stolen.`);
      }

      applyTamerKillGrowth(p);

      // Bloated elite: death explosion. Brace just before killing blow to halve it.
      if (this.eliteTwist === "BLOATED" && !this.bloatedExploded) {
        this.bloatedExploded = true;
        const raw = this.braceTime > 0 ? 10 : 25;
        const dmg = Math.round(raw * this.painMult(game));
        const { hpTaken, armorTaken } = applyDamage(p, dmg);
        screenShake(22, 0.55);
        this.particles.burst(W / 2, FLOOR_Y - 200, "#ff6a30", 70, 420, 1.1);
        this.pushLog(this.braceTime > 0
          ? `BLOATED BURST (braced) - lose ${Math.ceil(hpTaken)} HP, ${Math.ceil(armorTaken)} ARM`
          : `!! BLOATED BURST !! - lose ${Math.ceil(hpTaken)} HP, ${Math.ceil(armorTaken)} ARM`);
      }

      // Score: chamber + boss credit. Elite kills count separately.
      if (p.score) {
        p.score.bossesDefeated++;
        p.score.chambersCleared++;
        if (this.eliteKill) p.score.elitesKilled = (p.score.elitesKilled || 0) + 1;
      }
      this.winTimer = 2.2;
    }
    if (this.phase === "win") {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        const ch = CHAMBERS[this.chamberIdx];
        const bubbleHere =
          !!(game.bubblegumMode && !ch?.isMaw && ch?.guardian);
        if (bubbleHere && this.bubbleFightIndex === 1) {
          this.phase = "bubbleDouble";
          this.bubbleDoubleT = 2.85;
          screenShake(12, 0.35);
          SFX.hit();
          this.pushLog("DOUBLE TROUBLE!");
          return;
        }

        this.done = true;
        // v0.12 route: Combat -> Pact picker -> Transition -> next Climb.
        // Bubblegum: second guardian same valve (hue-twisted twin), then four 3-card pact seals (no Elite 4-spread bonus).
        // Elite kills grant a 4-card choice as a spoil when Bubblegum is off.
        /** @type {{ eliteReward: boolean, bubbleSequential?: number }} */
        const pactOpts = { eliteReward: !!this.eliteKill };
        if (bubbleHere && this.bubbleFightIndex >= 2) {
          pactOpts.bubbleSequential = 4;
          pactOpts.eliteReward = false;
        }
        game.scenes.replace(new PactScene(this.chamberIdx, pactOpts), game);
      }
    }
  }

  updateCooldowns(dt, p) {
    p.cooldowns.attack  = Math.max(0, p.cooldowns.attack  - dt);
    p.cooldowns.special = Math.max(0, p.cooldowns.special - dt);
    if (p.cooldowns.tertiary != null) p.cooldowns.tertiary = Math.max(0, p.cooldowns.tertiary - dt);
    if (p.dodgeRollCooldown > 0) p.dodgeRollCooldown = Math.max(0, p.dodgeRollCooldown - dt);
    if (this.potionDrinkCooldown > 0) this.potionDrinkCooldown = Math.max(0, this.potionDrinkCooldown - dt);
  }

  updateEnemyLaneShuffle(dt) {
    if (this.phase !== "fight" || this.enemy.hp <= 0) return;
    this.enemyLaneTimer -= dt;
    if (this.enemyLaneTimer > 0) return;
    let nl = this.enemyLane;
    for (let tries = 0; tries < 7 && nl === this.enemyLane; tries++) {
      nl = randInt(0, LAST_COMBAT_LANE);
    }
    this.enemyLane = nl;
    this.enemyLaneTimer = rand(4.2, 10.5);
    const lab = GUARDIAN_LANE_NAMES[this.enemyLane];
    this.pushLog(`The guardian surges into the ${lab} lane — match it to strike true!`);
    SFX.dodge();
  }

  tickTurretDPS(dt, p) {
    if (!p.turretFleet || !p.turretSpec) return;
    const fleet = p.turretFleet;
    const interval = p.turretSpec.interval || 0.5;
    const mag = p.turretMagicMult ?? 1;
    const summoner = p.synergyId === "turretSummoner";

    for (let i = fleet.length - 1; i >= 0; i--) {
      const tu = fleet[i];
      if ((tu.buildLeft || 0) > 0) {
        tu.buildLeft -= dt;
        if (tu.buildLeft <= 0) {
          tu.online = true;
          tu.nextPulse = 0.15;
          if (summoner) tu.fireLeft = 3;
          this.pushLog(`SENTRY ONLINE [lane ${tu.lane + 1}] — fire!`);
          SFX.confirm();
        }
        continue;
      }
      if (!tu.online) continue;

      if (summoner) {
        tu.fireLeft = Math.max(0, (tu.fireLeft || 0) - dt);
        if ((tu.fireLeft || 0) <= 0) {
          this.pushLog("Sentry battery exhausted.");
          fleet.splice(i, 1);
          continue;
        }
      }

      tu.nextPulse = (tu.nextPulse || 0) - dt;
      if (tu.nextPulse > 0) continue;
      tu.nextPulse = interval;

      const dmgR = tu.dmgRange || p.turretSpec.dmgRange;
      const burst = randInt(dmgR[0], dmgR[1]) * mag;
      this.dealToEnemy(
        Math.max(3, burst),
        "SENTRY BOLT",
        "cast",
        p,
        { kind: "special", skipLaneCheck: true },
      );
    }
  }

  /**
   * Deploy a wrench sentry into the current column. Returns false if no hardpoints left.
   */
  tryEnqueueSentryDeploy(p, { buildTime, dmgRange, logLine, sound = "confirm" }) {
    if (!p.turretFleet || !p.turretSpec) return false;
    const cap = Math.max(1, p.turretFleetMax || 1);
    if (p.turretFleet.length >= cap) return false;
    p.turretFleet.push({
      buildLeft: buildTime,
      online: false,
      nextPulse: 0,
      dmgRange,
      lane: this.lane,
    });
    this.pushLog(logLine || "SENTRY ASSEMBLING...");
    const play = sound === false ? null : (SFX[sound] ? SFX[sound] : SFX.confirm);
    if (play) play();
    return true;
  }

  tickChainShred(dt, p) {
    const dps = p.chainSwordDps || 0;
    if (!dps || this.phase !== "fight" || this.enemy.hp <= 0) return;
    if (this.lane !== this.enemyLane) return;

    this.chainPulseT = (this.chainPulseT || 0) + dt;
    if (this.chainPulseT < 0.16) return;
    const pulses = Math.floor(this.chainPulseT / 0.16);
    this.chainPulseT -= pulses * 0.16;
    const amt = pulses * (dps * 0.16) * (((p.pactMods && p.pactMods.dmgMult) || 1));

    const chunk = Math.max(4, Math.floor(amt));
    this.dealToEnemy(chunk, "CHAIN TEETH", "slash", p, {
      kind: "attack",
      skipLaneCheck: true,
      chainShredBurst: true,
    });
    this.chainLogTimer = (this.chainLogTimer || 0) + dt * pulses;
    if (this.chainLogTimer > 2.4) {
      this.chainLogTimer = 0;
      this.pushLog("Chainsword teeth chew into the flank!");
    }
  }

  updateAcidGouts(dt, p, game) {
    this.goutsTimer -= dt;
    if (this.goutsTimer <= 0) {
      let [mn, mx] = this.enemy.acidInterval;
      // Enraged: tighten the cadence aggressively.
      if (this.enraged) { mn *= 0.65; mx *= 0.65; }
      this.goutsTimer = rand(mn, mx);
      const lane = randInt(0, LAST_COMBAT_LANE);
      this.telegraphs.push({ lane, t: 0, wait: p.dodgeWindow + 0.15 });
      // Paired gout: at low HP the enemy sometimes fires TWO at once in
      // different lanes so the player has to pick AND commit.
      if (this.enraged && Math.random() < 0.45) {
        let other = lane;
        for (let t = 0; t < 12 && other === lane; t++) {
          other = randInt(0, LAST_COMBAT_LANE);
        }
        this.telegraphs.push({ lane: other, t: 0, wait: p.dodgeWindow + 0.15 });
      }
    }
    for (const tg of this.telegraphs) tg.t += dt;
    this.telegraphs = this.telegraphs.filter((tg) => {
      if (tg.t >= tg.wait) {
        this.gouts.push({ x: LANES[tg.lane], y: 0, vy: 520, lane: tg.lane });
        return false;
      }
      return true;
    });

    for (const g of this.gouts) g.y += g.vy * dt;

    const scale = this.painMult(game);
    const enrageBonus = this.enraged ? 1.2 : 1;
    for (const g of this.gouts) {
      if (g._hit) continue;
      if (g.y >= FLOOR_Y - 30) {
        g._hit = true;
        if (g.lane === this.lane) {
          // v0.9: base gout damage up from 16 -> 20, and braced 8 -> 11.
          const raw = this.braceTime > 0 ? 11 : 20;
          const dmg = Math.round(raw * scale * enrageBonus);
          const { armorTaken, hpTaken } = applyDamage(p, dmg);
          this.hitFlash = 0.35;
          SFX.acid();
          screenShake(8, 0.22);
          this.particles.burst(g.x, FLOOR_Y - 30, COLORS.bile, 22, 240, 0.65);
          if (this.braceTime > 0) {
            this.pushLog(`You BRACE - acid hisses off your guard (-${Math.ceil(hpTaken || armorTaken)})`);
          } else if (armorTaken > 0 && hpTaken === 0) {
            this.pushLog(`SPLASH! Armor soaks it (-${Math.ceil(armorTaken)} ARM)`);
          } else {
            this.pushLog(`ACID SPLAT! (-${Math.ceil(hpTaken)} HP)`);
          }
        } else {
          SFX.thud();
          this.particles.burst(g.x, FLOOR_Y - 30, COLORS.bileDark, 14, 190, 0.5);
        }
      }
    }
    this.gouts = this.gouts.filter((g) => !g._hit && g.y < FLOOR_Y + 30);
  }

  // Pick the next enemy move based on phase. Weights shift in enrage.
  planEnemyMove() {
    const r = Math.random();
    if (this.enraged) {
      if (r < 0.35) return "heavy";
      if (r < 0.65) return "combo";
      return "jab";
    }
    if (r < 0.18) return "heavy";
    if (r < 0.38) return "combo";
    return "jab";
  }

  // Apply a single melee hit from the current move type. `hitDmg` is the
  // already-rolled raw number. Handles brace, perfect-brace, logging.
  landEnemyMelee(p, rawDmg, moveType, game) {
    const scale = this.painMult(game);
    const enrageBonus = this.enraged ? 1.2 : 1;
    let dmg = Math.round(rawDmg * scale * enrageBonus);
    let braceNote = "";
    const laneLab = GUARDIAN_LANE_NAMES;

    // Lane-targeted melee (jab + combo strokes) miss if you're not occupying the threatened column.
    if (moveType !== "heavy") {
      if (this.lane !== this.enemyAttackLane) {
        this.pushLog(`${laneLab[this.enemyAttackLane]} strike SWISHES wide — wrong lane.`);
        SFX.thud();
        screenShake(3, 0.08);
        return;
      }
    }

    if (this.braceTime > 0) {
      dmg = Math.floor(dmg * 0.35);
      braceNote = "(BRACED) ";
    }
    const { armorTaken, hpTaken } = applyDamage(p, dmg);
    // Heavy slams get a harder visual impact because they're the "no dodge" move.
    this.hitFlash = moveType === "heavy" ? 0.7 : 0.4;
    if (moveType === "heavy") {
      this.particles.burst(this.heroX, HERO_Y - 20, "#ff8020", 32, 320, 0.8);
    }
    SFX.hit();
    screenShake(moveType === "heavy" ? 16 : 10, moveType === "heavy" ? 0.45 : 0.3);
    const flavorPick = pick(this.enemy.flavorHit || []);
    const flavorLine =
      flavorPick ?? "Pain explodes across you!";
    let line = braceNote + flavorLine;
    if (moveType === "heavy") line = braceNote + "HEAVY SLAM! " + line;
    line += ` (-${Math.ceil(hpTaken)} HP${armorTaken ? `, -${Math.ceil(armorTaken)} ARM` : ""})`;
    this.pushLog(line);
  }

  updateEnemyMelee(dt, p, game) {
    if ((this.enemy.stunT || 0) > 0) return;
    if ((this.enemy.slowT || 0) > 0) {
      this.enemy.slowT = Math.max(0, this.enemy.slowT - dt);
    }
    const slow = (this.enemy.slowT || 0) > 0 ? (this.enemy.slowMul || 0.55) : 1;

    // --- Combo sequence in progress ---
    if (this.comboHitsLeft > 0) {
      this.comboHitTimer -= dt * slow;
      if (this.comboHitTimer <= 0) {
        const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]) * 0.55;
        this.landEnemyMelee(p, raw, "combo", game);
        this.comboHitsLeft--;
        this.comboHitTimer = 0.42;
        if (this.comboHitsLeft === 0) {
          // Done. Small breather before next turn plan.
          this.enemyTurnTimer = rand(2.2, 3.0) * (this.enraged ? 0.7 : 1);
        }
      }
      return;
    }

    // --- Tell in progress ---
    if (this.enemyTelling) {
      this.enemyTellTime -= dt * slow;
      if (this.enemyTellTime <= 0) {
        // Tell ends -> move resolves.
        const move = this.enemyMoveType;
        if (move === "heavy") {
          // Heavy slam ignores lane-dodging entirely.
          const raw = randInt(this.enemy.heavyDmg[0], this.enemy.heavyDmg[1]);
          this.landEnemyMelee(p, raw, "heavy", game);
          this.enemyTurnTimer = rand(3.2, 4.2) * (this.enraged ? 0.7 : 1);
        } else if (move === "combo") {
          // Start triple strike - first hit lands immediately, next ones via
          // the comboHitsLeft loop above.
          const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]) * 0.55;
          this.landEnemyMelee(p, raw, "combo", game);
          this.comboHitsLeft = 2;
          this.comboHitTimer = 0.42;
        } else {
          const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]);
          this.landEnemyMelee(p, raw, "jab", game);
          this.enemyTurnTimer = rand(2.6, 3.4) * (this.enraged ? 0.7 : 1);
        }
        this.enemyTelling = false;
      }
      return;
    }

    // --- Between turns: countdown and pick next move ---
    this.enemyTurnTimer -= dt * slow;
    if (this.enemyTurnTimer <= 0) {
      const move = this.planEnemyMove();
      this.enemyMoveType = move;
      this.enemyTelling = true;
      // Heavy slams have longer wind-up (you have more warning, but no lane-dodge).
      // Jab/combo scale with dodge window.
      // Pact (Worm's Eye) adds bonus seconds to the heavy telegraph; the
      // Hex-Eyed Elite accumulates NEGATIVE seconds as its own twist.
      const pm = p.pactMods || {};
      const heavyBonus = (pm.heavyTellBonus || 0);
      if (move === "heavy") {
        this.enemyTellTime = 1.6 + p.dodgeWindow * 0.6 + heavyBonus - this.hexEyedShorten;
        if (this.eliteTwist === "HEX-EYED") {
          this.hexEyedShorten = Math.min(1.0, this.hexEyedShorten + 0.2);
        }
        this.pushLog(this.enemy.flavorHeavy || `${this.enemy.name} winds up a HEAVY slam! BRACE (F)!`);
      } else if (move === "combo") {
        this.enemyTellTime = 0.8 + p.dodgeWindow * 0.6;
        this.enemyAttackLane = randInt(0, LAST_COMBAT_LANE);
        const L = GUARDIAN_LANE_NAMES[this.enemyAttackLane];
        this.pushLog(this.enemy.flavorCombo ||
          `${this.enemy.name} coils for THREE cuts along the ${L} column — DODGE or BRACE!`);
      } else {
        this.enemyTellTime = 0.9 + p.dodgeWindow * 0.8;
        this.enemyAttackLane = randInt(0, LAST_COMBAT_LANE);
        const L = GUARDIAN_LANE_NAMES[this.enemyAttackLane];
        this.pushLog(`${this.enemy.name} hunts the ${L} column! (${L}: slide to match or brace.)`);
      }
      this.enemyTellTime = Math.max(0.3, this.enemyTellTime);
    }
  }

  hitCombatBlockingUi(mx, my) {
    if (this.potionState) return true;
    if (my < 116 || my >= ACTION_BAR_TOP) return true;
    if (pointInRect(mx, my, 16, 16, 260, 110)) return true;
    const enemyRows =
      1 +
      (this.matchupLabel ? 1 : 0) +
      (this.eliteKill ? 1 : 0) +
      (this.enraged ? 1 : 0);
    const enemyPanelH = 56 + Math.max(0, enemyRows - 1) * 16;
    if (pointInRect(mx, my, W - 280, 16, 264, enemyPanelH + 6)) return true;
    return false;
  }

  /**
   * Boss fights: handleMenu is skipped while paused, so [R]/[3]/mana button
   * must still open the vial. Clears pause when a vial actually opens.
   */
  tryOpenManaVialInputWhilePaused(game) {
    if (this.phase !== "fight" || this.enemy.hp <= 0) return;
    if (this.potionState || this.potionDrinkCooldown > 0) return;
    const p = game.player;
    const manaPulse =
      game.input.wasPressed("3", "r")
      || game.input.wasCodePressed("Digit3", "Numpad3", "KeyR");
    let clickedMana = false;
    if (game.input.wasPressed("Mouse0")) {
      const pr = this.actionButtonRects()[2];
      const mx = game.input.mouseX;
      const my = game.input.mouseY;
      if (pointInRect(mx, my, pr.x, pr.y, pr.w, pr.h)) clickedMana = true;
    }
    if (!manaPulse && !clickedMana) return;
    this.tryEnterManaPotion(p);
    if (this.potionState) this.paused = false;
  }

  handleMenu(dt, game) {
    const p = game.player;

    const rects = this.actionButtonRects();
    const mx = game.input.mouseX, my = game.input.mouseY;
    let clickedPotion = false;
    if (game.input.wasPressed("Mouse0")) {
      const pr = rects[2];
      if (pointInRect(mx, my, pr.x, pr.y, pr.w, pr.h)) clickedPotion = true;
    }
    const manaPulse =
      game.input.wasPressed("3", "r")
      || game.input.wasCodePressed("Digit3", "Numpad3", "KeyR");
    const wantManaPotion = manaPulse || clickedPotion;

    // Even during turn-lock you can slam [R]/[3] (or tap the mana button) to clutch-drink.
    if (this.turnLocked > 0) {
      this.turnLocked -= dt;
      if (wantManaPotion) this.tryEnterManaPotion(p);
      return;
    }

    if (game.input.wasPressed("ArrowUp", "w")) { this.menuIdx = (this.menuIdx + 3) % 4; SFX.click(); }
    if (game.input.wasPressed("ArrowDown", "s")) { this.menuIdx = (this.menuIdx + 1) % 4; SFX.click(); }

    const choose = (idx) => { this.menuIdx = idx; this.execute(idx, p, game); };

    if (game.input.wasPressed("Mouse0")) {
      for (let i = 0; i < 4; i++) {
        const r = rects[i];
        if (pointInRect(mx, my, r.x, r.y, r.w, r.h)) {
          choose(i);
          return;
        }
      }
    }

    // v0.13: Q/E/R/F are alternate keybinds for the four actions. This
    // matches the new TongueBossScene layout and keeps your hand on the
    // left-hand home row while the right hand works the mouse.
    if      (game.input.wasPressed("1", "q")) choose(0);
    else if (game.input.wasPressed("2", "e")) choose(1);
    else if (manaPulse) choose(2);
    else if (game.input.wasPressed("4", "f")) choose(3);
    else if (game.input.wasPressed(" ", "Space", "Enter")) choose(this.menuIdx);
  }

  execute(idx, p, game) {
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
          const dmg = randInt(mode.dmg[0], mode.dmg[1]);
          const opts = {
            kind: "attack",
            hexMark: false,
            multiLane: false,
            movePoisonPct: p.synergyId === "grimReaper" ? 0 : 0,
            movePoisonTime: 0,
            dotLabel: "POISON",
            lifestealPct: 0,
            plasmElement: mode.plasmElement,
          };
          this.dealToEnemy(dmg, mode.boltName, mode.sfx || "cast", p, opts);
          if (mode.shockStun) {
            this.enemy.stunT = Math.max(this.enemy.stunT || 0, mode.shockStun || 2.5);
          }
          if (mode.plasmElement === "cryo" || mode.slowMul) {
            this.enemy.slowMul = mode.slowMul || 0.45;
            this.enemy.slowT = Math.max(this.enemy.slowT || 0, mode.slowT || 1.5);
          }
          this.turnLocked = 0.45;
          break;
        }

        // v0.16 Wizard: every attack costs an extra few MP on top of base.
        const manaCost = l.attack.manaCost + (p.manaCostBonus || 0);
        if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${l.attack.name} is recharging...`); return; }
        if (p.mana < manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= manaCost;
        // Pact modifier: Patient Blade slows attack cooldown; Glass Fangs... no, special.
        p.cooldowns.attack = l.attack.cooldown * (pm.attackCdMult || 1);
        const dmg = randInt(l.attack.dmg[0], l.attack.dmg[1]);
        // v0.12 BILE WHIP: "Triple Lash" is a multi-lane attack. Fires 3
        // damage events at modest damage each with staggered floating numbers
        // so the player sees three hits land. HEX STAFF: its attack puts
        // down a mark instead of big damage - handled in dealToEnemy.
        const opts = {
          kind: "attack",
          multiLane: !!l.attack.multiLane,
          multiLaneLanes: l.attack.multiLaneLanes,
          multiLanePerLaneScale: l.attack.multiLanePerLaneScale,
          hexMark: !!l.attack.hexMark,
          movePoisonPct: p.synergyId === "grimReaper"
            ? 0
            : (l.attack.poisonPct || 0),
          movePoisonTime: p.synergyId === "grimReaper"
            ? 0
            : (l.attack.poisonTime || 0),
          dotLabel: l.attack.dotLabel || "POISON",
          lifestealPct: l.attack.lifestealPct || 0,
          plasmElement: l.attack.plasmElement || undefined,
        };
        this.dealToEnemy(dmg, l.attack.name, l.attack.sfx, p, opts);
        if (p.synergyId === "turretSummoner" && l.special?.sentryBuild && p.turretFleet) {
          const ts = p.turretSpec || {};
          const baseBt = ts.buildTime ?? l.special.buildTime ?? 3;
          const roll = Math.random();
          if (roll < 0.34) {
            this.tryEnqueueSentryDeploy(p, {
              buildTime: Math.max(1.35, baseBt * 0.55),
              dmgRange: [...(ts.dmgRange || l.special.sentryDmg || [9, 14])],
              logLine: "Arc-wrench harmonics — spare sentry kit spools up!",
              sound: "grab",
            });
          }
        }
        this.turnLocked = 0.28;
        break;
      }
      case 1: {
        if (p.loadoutId === "plasmids" && l.special?.plasmCycle && l.plasmModes?.length) {
          if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is on cooldown...`); break; }
          p.plasmModeIndex = (((p.plasmModeIndex || 0) + 1) % l.plasmModes.length);
          const nm = activePlasmMode(l, p.plasmModeIndex);
          p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
          this.pushLog(`Gene mode → ${nm?.label ?? "?"} — next bolt Q: ${nm?.boltName ?? "?"}`);
          SFX.click();
          this.turnLocked = 0.12;
          break;
        }

        const manaCost = l.special.manaCost + (p.manaCostBonus || 0);
        if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is recharging...`); return; }
        if (p.mana < manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        // Engineer wrench: sentry deploy — consumes special; no melee strike.
        if (l.special.sentryBuild && p.turretFleet) {
          const ts = p.turretSpec || {};
          const bt = ts.buildTime ?? l.special.buildTime ?? 3;
          const dmgR = [...(ts.dmgRange || l.special.sentryDmg || [9, 14])];
          const ok = this.tryEnqueueSentryDeploy(p, {
            buildTime: bt,
            dmgRange: dmgR,
            logLine: "TURRET ASSEMBLING...",
          });
          if (!ok) {
            SFX.deny();
            this.pushLog("No free turret hardpoints — wait for batteries to expire.");
            return;
          }
          p.mana -= manaCost;
          p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
          this.turnLocked = 0.35;
          break;
        }
        p.mana -= manaCost;
        // v0.16 RUSTY CHAINSAW:
        if (l.special.misfireChance && Math.random() < l.special.misfireChance) {
          p.mana = Math.min(p.manaMax, p.mana + Math.floor(manaCost / 2));
          p.cooldowns.special = (l.special.cooldown * 0.5) * (pm.specialCdMult || 1);
          this.pushLog(`${l.special.name} sputters and dies. (try again)`);
          SFX.deny();
          this.turnLocked = 0.25;
          break;
        }
        p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
        const dmg = randInt(l.special.dmg[0], l.special.dmg[1]);
        const opts = {
          kind: "special",
          multiLane: !!l.special.multiLane,
          multiLaneLanes: l.special.multiLaneLanes,
          multiLanePerLaneScale: l.special.multiLanePerLaneScale,
          hexDetonate: !!l.special.hexDetonate,
          movePoisonPct: p.synergyId === "grimReaper"
            ? 0
            : (l.special.poisonPct || 0),
          movePoisonTime: p.synergyId === "grimReaper"
            ? 0
            : (l.special.poisonTime || 0),
          dotLabel: l.special.dotLabel || "POISON",
          lifestealPct: l.special.lifestealPct || 0,
          plasmElement: l.special.plasmElement || undefined,
        };
        this.dealToEnemy(dmg, l.special.name, l.special.sfx, p, opts);
        const riot = typeof l.special.riotSelfHp === "number" ? l.special.riotSelfHp : 0;
        if (riot > 0 && !p.invulnerable) {
          applyDamage(p, riot, { countHitScore: false });
          this.pushLog(`Amplifier screams back — −${riot} HP (riot feedback).`);
        }
        if (l.special.shockStun) this.enemy.stunT = Math.max(this.enemy.stunT || 0, l.special.shockStun || 2.5);
        this.turnLocked = 0.45;
        break;
      }
      case 2:
        this.tryEnterManaPotion(p);
        break;
      case 3: {
        this.braceTime = 1.8;
        // Perfect Brace: if you hit BRACE within the last 0.5s of an enemy
        // tell (or during a combo sequence), you queue up a +50% damage
        // counter on your NEXT attack. Reward for reading the tell.
        const perfectWindow = 0.5;
        const tellEnding = this.enemyTelling && this.enemyTellTime <= perfectWindow;
        const inCombo = this.comboHitsLeft > 0;
        if (tellEnding || inCombo) {
          this.perfectBraceReady = true;
          this.perfectFlashT = 0.9;
          if (p.score) p.score.perfectBraces++;
          this.pushLog("PERFECT GUARD! Counter-attack is ready (+50% next hit)!");
          SFX.victory();
          screenShake(4, 0.15);
          this.particles.burst(this.heroX, HERO_Y - 30, "#ffd966", 22, 240, 0.6);
        } else {
          this.pushLog("You BRACE. Incoming pain is reduced.");
          SFX.confirm();
        }
        this.turnLocked = 0.2;
        break;
      }
    }
  }

  // Compute the final damage amount for ONE hit event, taking pact mods,
  // weapon matchup, perfect brace, hex marks, execute threshold, and random
  // crit into account. Returns { dmg, isCrit, executed }.
  rollHitDamage(rawDmg, {
    kind = "attack",
    consumeMarks = false,
    counterOn = false,
    hitMult: hitMultPass,
  } = {}, p = null) {
    const pm = (p && p.pactMods) || {};
    const mult = typeof hitMultPass === "number" ? hitMultPass : (this.matchupMult || 1);
    let base = typeof rawDmg === "number" ? rawDmg : 0;
    base = applyOutboundStrikeDice(Math.round(base), pm);
    const counterMult = counterOn ? (pm.counterMult || 1.5) : 1;
    const kindMult = kind === "special"
      ? (pm.specialDmgMult || 1)
      : (pm.attackDmgMult || 1);
    const dmgMult = pm.dmgMult || 1;
    const hpFrac = this.enemy.hp / Math.max(1, this.enemy.hpMax || 1);
    const execOn = !!(pm.executeThreshold && hpFrac <= pm.executeThreshold);
    const execMult = execOn ? (pm.executeBonus || 1) : 1;
    let isCrit = (pm.critChance || 0) > 0 && Math.random() < (pm.critChance || 0);
    let critMult = isCrit ? 1.6 : 1;
    if (critMult >= 1.5 && p?.synergyId === "scout" && Math.random() < 0.5) {
      critMult *= 2;
      isCrit = true;
    }
    let markMult = 1;
    if (this.hexMarks > 0) {
      markMult = 1 + (consumeMarks ? this.hexMarks * 0.6 : Math.min(this.hexMarks, 1) * 0.2);
    }
    const dmg = Math.max(1, Math.round(
      base * mult * counterMult * kindMult * dmgMult * execMult * critMult * markMult,
    ));
    return { dmg, isCrit, execOn, consumedMarks: consumeMarks ? this.hexMarks : 0 };
  }

  dealToEnemy(rawDmg, name, sfx, p = null, opts = {}) {
    const multiLane = !!opts.multiLane;
    const hexMark   = !!opts.hexMark;
    const hexDet    = !!opts.hexDetonate;
    let hitMult = this.matchupMult;
    if (opts.plasmElement) hitMult = plasmElementMult(opts.plasmElement, this.enemy.art);
    // v0.16 per-attack on-hit effects. Wired through to applyHit/applyOnHitEffects.
    const fxCtx = {
      movePoisonPct:  opts.movePoisonPct  || 0,
      movePoisonTime: opts.movePoisonTime || 0,
      dotLabel:       opts.dotLabel       || "POISON",
      lifestealPct:   opts.lifestealPct   || 0,
    };

    const hadCounter = this.perfectBraceReady;
    const fight = this.phase === "fight";
    const skipLane = !!opts.skipLaneCheck;

    // Must share a column with the guardian unless skipLaneCheck (sentries) or
    // multiLane covers the guardian's lane. Wrong lane = no damage, hex, or DOT.
    if (fight && !skipLane && this.enemy && this.enemy.hp > 0) {
      if (multiLane) {
        const lanesHit = opts.multiLaneLanes ?? [0, 2, 4];
        if (!lanesHit.includes(this.enemyLane)) {
          const lab = GUARDIAN_LANE_NAMES[this.enemyLane];
          const reach = lanesHit.map((ix) => GUARDIAN_LANE_NAMES[ix]).join(" · ");
          this.pushLog(`${name} finds no target — guardian is ${lab}; this swing only reaches ${reach}.`);
          SFX.deny();
          return;
        }
      } else if (this.lane !== this.enemyLane) {
        this.pushLog(
          `${name} swishes wide — slide to the ${GUARDIAN_LANE_NAMES[this.enemyLane]} column to connect.`,
        );
        SFX.deny();
        return;
      }
    }

    // Confirmed hit: consume perfect-brace counter (lane check passed).
    this.perfectBraceReady = false;
    if (hadCounter && p && p.score) p.score.counterStrikes++;

    // --- Multi-lane (weapon declares multiLane + multiLaneLanes) ---
    // Only runs when guardian stands in one of those lanes (checked above).
    // Collapse into one damage roll so total potency matches prior multi-roll tuning.
    if (multiLane) {
      const lanesHit = opts.multiLaneLanes ?? [0, 2, 4];
      const perLaneScale =
        typeof opts.multiLanePerLaneScale === "number"
          ? opts.multiLanePerLaneScale
          : 1 / 3;
      const totalScaledRaw = Math.max(
        1,
        Math.round(rawDmg * perLaneScale * lanesHit.length),
      );
      const { dmg, isCrit, execOn } = this.rollHitDamage(totalScaledRaw, {
        kind: opts.kind, counterOn: hadCounter, hitMult,
      }, p);
      this.applyHit(dmg, {
        name,
        sfx,
        p,
        hadCounter,
        isCrit,
        execOn,
        lane: 0,
        laneX: LANES[this.enemyLane],
        lifestealPct: fxCtx.lifestealPct,
      });
      this.applyOnHitEffects(p, { hexMark, hexDet, ...fxCtx });
      SFX[sfx] ? SFX[sfx]() : SFX.hit();
      return;
    }

    let dmgPayload = rawDmg;
    // --- Default single-lane hit ---
    const { dmg, isCrit, execOn, consumedMarks } = this.rollHitDamage(dmgPayload, {
      kind: opts.kind, consumeMarks: hexDet, counterOn: hadCounter,
      hitMult,
    }, p);
    this.applyHit(dmg, { name, sfx, p, hadCounter, isCrit, execOn, consumedMarks,
      lifestealPct: fxCtx.lifestealPct,
      suppressLog: !!opts.chainShredBurst });
    if (!opts.chainShredBurst) {
      this.applyOnHitEffects(p, { hexMark, hexDet, ...fxCtx });
      SFX[sfx] ? SFX[sfx]() : SFX.hit();
    } else if (Math.random() < 0.18) {
      SFX.slash();
    }
  }

  // Centralized "a damage number actually lands" path. Handles enemy HP,
  // log line, shake, particles, floater, blood decals, shield-break counter.
  applyHit(dmg, { name, hadCounter, isCrit, execOn, consumedMarks, lane, laneX, p, lifestealPct = 0, suppressLog = false }) {
    const mult = this.matchupMult || 1;
    const lbl = this.matchupLabel;
    // --- Shielded elite: damage is clamped to 1 while shield is up, but
    // each brace-counter lands a hit point toward breaking the shield.
    let finalDmg = dmg;
    if (this.enemy.shielded) {
      if (hadCounter) this.enemy.shieldHitsLeft = Math.max(0, (this.enemy.shieldHitsLeft ?? 3) - 1);
      finalDmg = 1;
      if ((this.enemy.shieldHitsLeft ?? 3) <= 0) {
        this.enemy.shielded = false;
        this.enemy.shieldBrokenT = 0.9;
        this.pushLog("The shield SHATTERS!");
        screenShake(16, 0.5);
        this.particles.burst(W / 2, FLOOR_Y - 200, "#fff2a0", 44, 340, 0.9);
      }
    }
    this.enemy.hp = Math.max(0, this.enemy.hp - finalDmg);

    this.enemyFlash = hadCounter ? 0.5 : (isCrit ? 0.5 : 0.3);
    this.enemyShake = hadCounter ? 0.55 : (mult > 1 || isCrit ? 0.4 : 0.22);

    // Log line with all flavor tags.
    let line = `${name}! ${this.enemy.name} takes ${finalDmg} damage.`;
    if (hadCounter) line = `COUNTER-STRIKE! ${line}`;
    else if (isCrit) line = `PATIENT CUT! ${line}`;
    else if (execOn) line = `EXECUTE! ${line}`;
    else if (consumedMarks > 0) line = `HEX DETONATE (${consumedMarks} marks)! ${line}`;
    else if (lbl && mult > 1) line = `${lbl.text} ${line}`;
    else if (lbl)             line = `${line} (${lbl.text})`;
    if (!suppressLog) {
      this.pushLog(line);
    }

    // Feedback
    screenShake((suppressLog && !isCrit) ? 3 : mult > 1 ? 9 : 5, suppressLog ? 0.06 : 0.15);
    const burstColor = isCrit ? "#ff40c0"
      : (mult > 1 ? "#ffd966" : (mult < 1 ? "#8a9aff" : COLORS.blood));
    const burstScale = suppressLog ? 0.45 : 1;
    this.particles.burst(laneX ?? W / 2, FLOOR_Y - 200, burstColor,
      (mult > 1 ? 28 : 16) * burstScale,
      (mult > 1 ? 280 : 220) * burstScale,
      0.55,
    );

    // Floating damage number (each lane gets its own spot).
    if (!suppressLog || Math.random() < 0.2) {
      this.floaters.push({
      x: (laneX ?? W / 2) + rand(-30, 30),
      y: FLOOR_Y - 240 + (lane ? lane * 6 : 0),
      vy: -70,
      life: 1.1, max: 1.1,
      text: isCrit ? `-${finalDmg}!` : `-${finalDmg}`,
      color: isCrit ? "#ff40c0"
        : (mult > 1 ? "#ffd966" : (mult < 1 ? "#8a9aff" : "#ffffff")),
      size: mult > 1 || isCrit ? 28 : 22,
      });
    }

    // Blood decal cluster.
    const count = mult > 1 || isCrit ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this.bloodDecals.push({
        x: rand(-85, 85),
        y: rand(-80, 70),
        r: rand(4, 10) + (mult > 1 || isCrit ? rand(2, 6) : 0),
        alpha: rand(0.55, 0.85),
      });
    }
    if (this.bloodDecals.length > 42) {
      this.bloodDecals.splice(0, this.bloodDecals.length - 42);
    }

    // v0.16 LIFESTEAL (Cursed Scythe). Heal a percentage of the damage just
    // dealt. Only counts on damage that actually got through (so shield-clamped
    // 1-dmg hits still drip a tiny heal). Floats a green "+N" over the hero.
    if (lifestealPct > 0 && p && finalDmg > 0) {
      const heal = Math.max(1, Math.round(finalDmg * lifestealPct));
      const before = p.hp;
      p.hp = Math.min(p.hpMax, p.hp + heal);
      const actualHeal = p.hp - before;
      if (actualHeal > 0) {
        this.floaters.push({
          x: this.heroX + rand(-12, 12),
          y: HERO_Y - 70,
          vy: -55,
          life: 1.2, max: 1.2,
          text: `+${actualHeal}`,
          color: "#7fffa0",
          size: 18,
        });
      }
    }
  }

  // Post-hit side effects: poison (VIPER / HEX-EYED pact), hex marks, hex
  // detonate (consumes marks). Called once per attack regardless of multi-lane.
  applyOnHitEffects(p, { hexMark, hexDet, movePoisonPct = 0, movePoisonTime = 0, dotLabel = "POISON" }) {
    const pm = (p && p.pactMods) || {};
    let mpExtra = movePoisonPct || 0;
    if (p.synergyDecay && p.synergyId !== "grimReaper") mpExtra *= 2.65;
    const poisonPct  = Math.max(pm.poisonPct  ?? 0, mpExtra);
    const poisonTime = Math.max(pm.poisonTime ?? 0, movePoisonTime);
    if (poisonPct > 0 && poisonTime > 0) {
      this.enemy.poisonT = Math.max(this.enemy.poisonT || 0, poisonTime);
      if (dotLabel === "BLEED") {
        const bs = Math.min(3, (this.enemy.bleedStacks || 0) + 1);
        this.enemy.bleedStacks = bs;
        this.enemy.poisonDps = (poisonPct * this.enemy.hpMax * bs) / 3;
        this.enemy.poisonLabel = dotLabel;
        this.poisonFlashT = 0.65;
      } else {
        this.enemy.poisonDps = Math.max(this.enemy.poisonDps || 0,
          poisonPct * this.enemy.hpMax);
        this.enemy.poisonLabel = dotLabel;
        this.poisonFlashT = 0.6;
      }
    }
    if (p.synergyId === "grimReaper") {
      const rf = 0.072;
      this.enemy.poisonLabel = "ROT";
      this.enemy.poisonT = Math.max(this.enemy.poisonT || 0, 8);
      this.enemy.poisonDps = Math.max(this.enemy.poisonDps || 0, rf * this.enemy.hpMax);
      this.poisonFlashT = Math.max(this.poisonFlashT || 0, 0.75);
    }
    if (hexMark) {
      this.hexMarks = Math.min((this.hexMarks || 0) + 1, 3);
      this.pushLog(`HEX MARK placed (${this.hexMarks}/3)`);
    }
    if (hexDet) {
      this.hexMarks = 0;
    }
  }

  // ================== RENDER ==================
  render(ctx, game) {
    const p = game.player;
    const ch = this.chamber;

    const pal = resolveEndlessPalette(game, ch.palette, ch.wormTint);
    drawBackdropCached(ctx, this.t, this.t, pal.wormTint * 1.05, pal.palette, this.chamberIdx + 5);

    this.drawSphincter(ctx);
    this.drawEnemy(ctx, game);
    this.drawLanes(ctx);

    for (const tg of this.telegraphs) this.drawTelegraph(ctx, tg);
    for (const g of this.gouts) this.drawGout(ctx, g);

    // Hero
    ctx.save();
    ctx.translate(this.heroX, HERO_Y);
    ctx.scale(2.8, 2.8);
    drawHero(ctx, 0, 0, 1, this.anim, p.buildId, p.synergyId);
    if (this.braceTime > 0) {
      ctx.strokeStyle = "rgba(255, 217, 102, 0.8)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.stroke();
      // Soft glow
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = "rgba(255,217,102,0.4)";
      ctx.stroke();
    }
    ctx.restore();

    this.particles.render(ctx);

    // Floating damage numbers
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

    if (this.phase === "intro") {
      const alpha = Math.min(1, this.introT * 2);
      ctx.globalAlpha = alpha;
      drawBanner(ctx, "SPHINCTER GUARDIAN", W / 2, 120, 36, COLORS.bile, COLORS.blood);
      drawBanner(ctx, this.enemy.name, W / 2, 168, 24, COLORS.bone, COLORS.worm);
      ctx.globalAlpha = 1;
    }
    if (this.phase === "win") {
      drawBanner(ctx, "VICTORY!", W / 2, 120, 46, COLORS.bile, COLORS.blood);
      drawBanner(ctx, "THE SPHINCTER UNCLENCHES...", W / 2, 168, 20, COLORS.bone, COLORS.worm);
    }

    this.drawUI(ctx, game);

    if (this.phase === "bubbleDouble") {
      const dim = 0.42 + 0.18 * Math.sin(this.t * 6);
      ctx.fillStyle = `rgba(8, 0, 18, ${dim})`;
      ctx.fillRect(0, 0, W, H);
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
      const glowHue = (this.t * 140) % 360;
      drawBanner(ctx, "DOUBLE TROUBLE", W / 2, H / 2 - 52, 56, `hsl(${glowHue}, 92%, 62%)`, COLORS.blood);
      drawText(ctx, "A hue-twisted twin forces the ring…", W / 2, H / 2 + 28, {
        size: 20,
        color: `rgba(255, 245, 255, ${0.75 + pulse * 0.2})`,
        align: "center",
        bold: true,
        glow: `hsl(${(glowHue + 40) % 360}, 80%, 70%)`,
        maxWidth: W - 80,
      });
    }
    if (this.paused) this.drawPause(ctx);
    if (this.potionState) this.drawPotionMiniGame(ctx, game);
  }

  /** Modal pop-cork → tilt-pour minigame; combat input is routed here while active. */
  drawPotionMiniGame(ctx, game) {
    drawManaPotionModal(ctx, this.potionState, COLORS, game.player);
  }

  drawSphincter(ctx) {
    // Deep 3D-ish sphincter door with heavy shading.
    const cx = W / 2, cy = 340;
    const pulse = 1 + Math.sin(this.t * 2) * 0.03;
    const rOut = 240 * pulse;
    const rIn  = 180 * pulse;

    // Depth haloes behind
    for (let i = 6; i > 0; i--) {
      ctx.fillStyle = `rgba(20, 5, 28, 0.12)`;
      ctx.beginPath();
      ctx.arc(cx, cy, rOut + i * 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer ring segments with highlight/shadow
    const segs = 14;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2 - Math.PI / 2;
      const a1 = a0 + (Math.PI * 2) / segs - 0.03;
      ctx.beginPath();
      ctx.arc(cx, cy, rOut, a0, a1);
      ctx.arc(cx, cy, rIn, a1, a0, true);
      ctx.closePath();
      // Per-segment shading from light direction (top-left)
      const midA = (a0 + a1) / 2;
      const nx = Math.cos(midA);
      const ny = Math.sin(midA);
      const lightDot = -(nx * -0.7 + ny * -0.7) / Math.SQRT2; // -1 lit, +1 dark
      const brightness = 0.6 - lightDot * 0.35;
      const grd = ctx.createRadialGradient(cx, cy, rIn, cx, cy, rOut);
      grd.addColorStop(0, shade(COLORS.worm, brightness + 0.15));
      grd.addColorStop(1, shade(COLORS.worm, brightness - 0.2));
      ctx.fillStyle = grd;
      ctx.fill();
      // Segment outline
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Glossy highlight arc on the upper-left of the ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, (rOut + rIn) / 2, Math.PI * 1.15, Math.PI * 1.6);
    ctx.strokeStyle = "rgba(255, 220, 240, 0.55)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255,220,240,0.8)";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();

    // Wet rim
    ctx.strokeStyle = "rgba(255, 200, 220, 0.45)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, 0, Math.PI * 2);
    ctx.stroke();

    // Dark throat (deep gradient)
    const throatG = ctx.createRadialGradient(cx - 20, cy - 20, 20, cx, cy, rIn);
    throatG.addColorStop(0, "rgba(60,20,70,0.95)");
    throatG.addColorStop(0.5, "rgba(15,5,25,1)");
    throatG.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = throatG;
    ctx.beginPath();
    ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
    ctx.fill();

    // Inner wet sheen
    ctx.strokeStyle = "rgba(120, 40, 140, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawEnemy(ctx, game) {
    const cx = LANES[this.enemyLane ?? 2];
    const cy = 340;
    const sx = this.enemyShake > 0 ? (Math.random() - 0.5) * 6 : 0;
    const sy = this.enemyShake > 0 ? (Math.random() - 0.5) * 4 : 0;
    ctx.save();
    // Drop shadow on virtual floor behind enemy
    drawDropShadow(ctx, cx, cy + 150, 120, 16, 0.5);
    // v0.12 Elite aura: pulsing gold halo ring (or twist-colored) behind
    // the enemy sprite. Draw BEFORE translating for the sprite so it sits
    // centered around the enemy at origin.
    if (this.eliteKill) {
      const pulse = 0.55 + 0.45 * Math.sin(this.eliteAuraT * 3);
      const col = this.enemy.eliteColor || COLORS.gold;
      ctx.save();
      ctx.translate(cx + sx, cy + sy);
      ctx.shadowColor = col;
      ctx.shadowBlur = 30;
      ctx.strokeStyle = `rgba(255, 217, 102, ${0.35 + pulse * 0.35})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 150 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 240, 180, ${0.2 + pulse * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 172 + pulse * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.translate(cx + sx, cy + sy);
    const ef = game && endlessEnemyCssFilter(game);
    const twinF = this.bubblePaletteInvert ? BUBBLE_TWIN_ENEMY_FILTER : "";
    const filterParts = [ef, twinF].filter(Boolean);
    ctx.filter = filterParts.length ? filterParts.join(" ") : "none";
    if (this.enemyFlash > 0) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 26;
    }
    // Shielded phase overlay: blue rippling dome.
    if (this.enemy.shielded) {
      ctx.save();
      const pulse = 0.55 + 0.45 * Math.sin(this.t * 10);
      ctx.strokeStyle = `rgba(154, 218, 255, ${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = "#9adaff";
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(0, 0, 120 + pulse * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    switch (this.enemy.art) {
      case "tentacle": this.drawTentacle(ctx); break;
      case "teeth":    this.drawToothBeast(ctx); break;
      case "zombie":   this.drawZombie(ctx); break;
      case "flesh":    this.drawFleshHorror(ctx); break;
      case "bile":     this.drawBileElemental(ctx); break;
    }

    // --- Progressive blood / wound overlay ---
    // Individual decals painted at hit locations.
    this.drawBloodDecals(ctx);
    // Global "bloody sheen" that intensifies as the enemy's HP drops.
    // Non-bile enemies get a wet crimson wash; bile gets a sickly darkening.
    const hpFrac = Math.max(0, this.enemy.hp / this.enemy.hpMax);
    const wound = 1 - hpFrac;
    if (wound > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 130);
      const tint = this.enemy.art === "bile"
        ? `rgba(120, 70, 40, ${0.2 + wound * 0.5})`
        : `rgba(200, 30, 30, ${0.15 + wound * 0.55})`;
      g.addColorStop(0, tint);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // At very low HP, add rhythmic blood drips falling off the body.
    if (wound > 0.55 && this.enemy.art !== "bile") {
      const drips = 4;
      for (let i = 0; i < drips; i++) {
        const phase = (this.t * 0.9 + i * 0.7) % 1;
        const x = Math.sin(i * 3.1) * 70;
        const y = 40 + phase * 120;
        const alpha = Math.max(0, 1 - phase);
        ctx.fillStyle = `rgba(180, 15, 15, ${alpha * 0.85})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 3, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawBloodDecals(ctx) {
    if (!this.bloodDecals || !this.bloodDecals.length) return;
    ctx.save();
    for (const d of this.bloodDecals) {
      // Dark outer splash
      ctx.fillStyle = `rgba(90, 10, 10, ${d.alpha})`;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bright core
      ctx.fillStyle = `rgba(190, 20, 20, ${d.alpha})`;
      ctx.beginPath();
      ctx.ellipse(d.x - 1, d.y - 1, d.r * 0.6, d.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tiny wet specular
      ctx.fillStyle = `rgba(255,170,170,${d.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, Math.max(1, d.r * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTentacle(ctx) {
    const t = this.t;
    ctx.save();
    ctx.translate(0, -20);
    const segments = 14;
    // Segment discs from base to tip, drawn back-to-front for depth
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const f = i / segments;
      const x = Math.sin(t * 2 + f * 4) * (30 + f * 30);
      const y = 160 - f * 200;
      const r = 26 - f * 14;
      points.push({ x, y, r });
    }
    // Shadow trail first
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.arc(p.x + 3, p.y + 4, p.r, 0, Math.PI * 2); ctx.fill();
    }
    // Body segments
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      drawSphere(ctx, p.x, p.y, p.r, shade(COLORS.worm, 1.05), {
        highlight: "rgba(255,200,230,0.55)",
        rim: "rgba(180, 80, 200, 0.6)",
        outline: "rgba(0,0,0,0.55)",
      });
    }
    // Suction cups on alternating sides
    for (let i = 2; i < points.length - 1; i += 2) {
      const a = points[i];
      const b = points[i - 1];
      const nx = a.y - b.y, ny = -(a.x - b.x);
      const len = Math.hypot(nx, ny) || 1;
      const ux = nx / len, uy = ny / len;
      const off = a.r * 0.65;
      drawSphere(ctx, a.x + ux * off, a.y + uy * off, a.r * 0.22, "#ffd0e0",
        { highlight: "rgba(255,255,255,0.9)", outline: "rgba(0,0,0,0.5)" });
      drawSphere(ctx, a.x - ux * off, a.y - uy * off, a.r * 0.22, "#ffd0e0",
        { highlight: "rgba(255,255,255,0.9)", outline: "rgba(0,0,0,0.5)" });
    }
    // Eye at tip
    const tip = points[points.length - 1];
    drawSphere(ctx, tip.x, tip.y, 14, "#fff",
      { highlight: "rgba(255,255,255,1)", outline: "rgba(0,0,0,0.8)" });
    drawSphere(ctx, tip.x, tip.y, 8, COLORS.blood,
      { highlight: "rgba(255,120,120,0.9)", outline: "rgba(0,0,0,0.6)" });
    // Pupil that tracks hero
    const dx = (this.heroX - (W / 2 + tip.x)) * 0.02;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(tip.x + dx, tip.y + 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Pupil specular
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(tip.x + dx - 1.2, tip.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawToothBeast(ctx) {
    const t = this.t;
    ctx.save();
    // Big globular body with shading
    drawSphere(ctx, 0, 0, 100, "#4a2040", {
      highlight: "rgba(180,90,200,0.7)",
      rim: "rgba(200,100,220,0.5)",
      outline: "rgba(0,0,0,0.7)",
    });
    // Gaping maw (depth)
    const open = 0.3 + 0.3 * Math.sin(t * 5);
    ctx.save();
    ctx.fillStyle = "#1a0010";
    ctx.beginPath();
    ctx.ellipse(0, 0, 78, 28 + open * 34, 0, 0, Math.PI * 2);
    ctx.fill();
    // Maw throat shading
    const throatG = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
    throatG.addColorStop(0, "rgba(80, 20, 30, 1)");
    throatG.addColorStop(1, "rgba(0, 0, 0, 1)");
    ctx.fillStyle = throatG;
    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 24 + open * 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Teeth ring
    const teeth = 18;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const hx = Math.cos(a) * 78;
      const hy = Math.sin(a) * (28 + open * 34);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(a + Math.PI / 2);
      const gg = ctx.createLinearGradient(-6, -12, 6, 12);
      gg.addColorStop(0, "#fff");
      gg.addColorStop(0.6, "#f6ecd0");
      gg.addColorStop(1, "#7a6a3a");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(6, 10);
      ctx.lineTo(-6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    // Glowing red eyes on top
    drawSphere(ctx, -34, -64, 10, COLORS.blood, { highlight: "rgba(255,170,170,1)", rim: "rgba(255,80,80,0.9)" });
    drawSphere(ctx,  34, -64, 10, COLORS.blood, { highlight: "rgba(255,170,170,1)", rim: "rgba(255,80,80,0.9)" });
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.arc(-32, -63, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 36, -63, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawZombie(ctx) {
    const t = this.t;
    ctx.save();
    ctx.translate(0, -20);
    const sway = Math.sin(t * 3) * 4;
    // Shadow behind
    drawDropShadow(ctx, 0, 110, 40, 8, 0.5);

    // Legs (cel-shaded plates)
    drawPlate(ctx, -22, 62, 16, 44 + sway, 3, "#4a6a2a");
    drawPlate(ctx,   6, 62, 16, 44 - sway, 3, "#4a6a2a");
    // Feet
    drawPlate(ctx, -24, 100 + sway, 20, 8, 2, "#2a3a0a");
    drawPlate(ctx,   4, 100 - sway, 20, 8, 2, "#2a3a0a");

    // Torso
    drawPlate(ctx, -36, -12, 72, 78, 8, "#6ea34a");
    // Rib shading
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-22, 2 + i * 14);
      ctx.lineTo(22, 2 + i * 14);
      ctx.stroke();
    }
    // Gory wound
    ctx.fillStyle = "#4a0a0a";
    ctx.beginPath();
    ctx.ellipse(-8, 22, 10, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.blood;
    ctx.beginPath();
    ctx.ellipse(-8, 22, 6, 3, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Arms
    drawPlate(ctx, -52, -2, 14, 44, 3, "#6ea34a");
    drawPlate(ctx,  38, -2, 14, 44, 3, "#6ea34a");
    // Claws
    ctx.fillStyle = "#1a2a0a";
    ctx.beginPath();
    ctx.moveTo(-52, 40); ctx.lineTo(-56, 50); ctx.lineTo(-46, 44);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(52, 40); ctx.lineTo(56, 50); ctx.lineTo(46, 44);
    ctx.closePath(); ctx.fill();

    // Head (sphere)
    drawSphere(ctx, 0, -34, 24, "#8cbf5c", {
      highlight: "rgba(220, 255, 180, 0.8)",
      rim: "rgba(150,220,90,0.6)",
      outline: "rgba(0,0,0,0.7)",
    });
    // Dead eyes
    drawSphere(ctx, -9, -36, 5, "#fff", { highlight: null, outline: "rgba(0,0,0,0.6)" });
    drawSphere(ctx,  9, -36, 5, "#fff", { highlight: null, outline: "rgba(0,0,0,0.6)" });
    ctx.fillStyle = "#1a0a0a";
    ctx.beginPath(); ctx.arc(-9, -36, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 9, -36, 2, 0, Math.PI * 2); ctx.fill();
    // Drool with wobble
    const droolLen = 10 + Math.sin(t * 5) * 3;
    ctx.fillStyle = COLORS.bile;
    ctx.fillRect(-1.5, -22, 3, droolLen);
    ctx.fillStyle = COLORS.bileGlow;
    ctx.beginPath();
    ctx.arc(0, -22 + droolLen + 2, 2, 0, Math.PI * 2);
    ctx.fill();
    // Stitches / snarl
    ctx.strokeStyle = "#1a0a0a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -24); ctx.lineTo(-4, -22);
    ctx.moveTo(-2, -24); ctx.lineTo(2, -22);
    ctx.moveTo(4, -24); ctx.lineTo(7, -22);
    ctx.stroke();
    ctx.restore();
  }

  drawFleshHorror(ctx) {
    const t = this.t;
    ctx.save();
    drawDropShadow(ctx, 0, 100, 100, 14, 0.55);

    // Outer lobes (depth)
    const lobes = 7;
    const outerPath = () => {
      ctx.beginPath();
      for (let i = 0; i <= lobes * 12; i++) {
        const f = i / (lobes * 12);
        const a = f * Math.PI * 2;
        const r = 95 + Math.sin(a * lobes + t * 2) * 18 + Math.sin(t * 4 + i) * 4;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r * 0.85;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };
    // Backing
    outerPath();
    const g = ctx.createRadialGradient(-30, -20, 10, 0, 0, 110);
    g.addColorStop(0, "#c04050");
    g.addColorStop(0.6, "#8a2030");
    g.addColorStop(1, "#3a0010");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner pulsing heart-blob
    const innerR = 55 + Math.sin(t * 4) * 5;
    drawSphere(ctx, 0, 0, innerR, "#c04050", {
      highlight: "rgba(255,200,210,0.7)",
      rim: "rgba(255,90,120,0.6)",
      outline: "rgba(0,0,0,0.6)",
    });

    // Scattered eyes
    const eyes = [[-30, -20, 8], [20, -28, 6], [-10, 16, 7], [38, 12, 6], [-38, 28, 5], [0, 38, 5]];
    for (const [ex, ey, er] of eyes) {
      drawSphere(ctx, ex, ey, er, "#fff", { highlight: "rgba(255,255,255,1)", outline: "rgba(0,0,0,0.65)" });
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(ex + Math.sin(t * 2 + ex) * 2, ey + Math.cos(t * 2 + ey) * 2, er * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Whipping tongue
    ctx.save();
    ctx.strokeStyle = "#e04060";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    const tx = Math.sin(t * 6) * 50;
    ctx.moveTo(0, 55);
    ctx.quadraticCurveTo(tx * 0.5, 80, tx, 105);
    ctx.stroke();
    // Tongue highlight
    ctx.strokeStyle = "rgba(255,180,200,0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  drawBileElemental(ctx) {
    const t = this.t;
    ctx.save();
    drawDropShadow(ctx, 0, 100, 100, 14, 0.55);

    // Outer translucent blob
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const pts = 32;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = 90 + Math.sin(t * 4 + i) * 10 + Math.cos(t * 2 + i * 0.5) * 7;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * 0.95;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const og = ctx.createRadialGradient(-30, -20, 10, 0, 0, 100);
    og.addColorStop(0, "rgba(215,255,155,0.95)");
    og.addColorStop(0.5, "rgba(155,255,102,0.9)");
    og.addColorStop(1, "rgba(40,110,20,0.95)");
    ctx.fillStyle = og;
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 110, 20, 0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Inner bright core
    const ig = ctx.createRadialGradient(0, 0, 10, 0, 0, 80);
    ig.addColorStop(0, "rgba(255,255,220,0.9)");
    ig.addColorStop(0.6, "rgba(215,255,155,0.4)");
    ig.addColorStop(1, "rgba(100,200,60,0)");
    ctx.fillStyle = ig;
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.fill();

    // Bubbles inside
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t;
      const rr = 30 + (i % 3) * 18;
      const bx = Math.cos(a) * rr;
      const by = Math.sin(a) * rr * 0.7;
      drawSphere(ctx, bx, by, 3 + (i % 3), "rgba(220,255,170,0.8)",
        { highlight: "rgba(255,255,255,1)", outline: null });
    }

    // Eyes
    drawSphere(ctx, -22, -12, 10, "#e8ffd0", { highlight: "rgba(255,255,255,0.9)", outline: "rgba(20,40,0,0.7)" });
    drawSphere(ctx,  22, -12, 10, "#e8ffd0", { highlight: "rgba(255,255,255,0.9)", outline: "rgba(20,40,0,0.7)" });
    ctx.fillStyle = "#1a2a0a";
    const pdx = (this.heroX - W / 2) * 0.02;
    ctx.beginPath(); ctx.arc(-22 + pdx, -11, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 22 + pdx, -11, 4, 0, Math.PI * 2); ctx.fill();

    // Evil grin
    ctx.strokeStyle = "#1a2a0a";
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-28, 22);
    ctx.quadraticCurveTo(0, 46, 28, 22);
    ctx.stroke();
    // Teeth in grin
    for (let i = -2; i <= 2; i++) {
      const tx = i * 9;
      const ty = 36 - Math.abs(i) * 3;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(tx - 3, ty - 5);
      ctx.lineTo(tx + 3, ty - 5);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawLanes(ctx) {
    ctx.save();
    // Floor with depth gradient
    const g = ctx.createLinearGradient(0, FLOOR_Y - 20, 0, H);
    g.addColorStop(0, shade(COLORS.wormDeep, 0.9));
    g.addColorStop(0.4, shade(COLORS.wormDeep, 0.55));
    g.addColorStop(1, shade(COLORS.wormDeep, 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // Floor bile sheen
    for (let i = 0; i < 18; i++) {
      const x = (i * 97 + this.t * 30) % W;
      const y = FLOOR_Y + 20 + (i % 3) * 12;
      ctx.fillStyle = "rgba(155, 255, 102, 0.12)";
      ctx.beginPath();
      ctx.ellipse(x, y, 16, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rim
    ctx.strokeStyle = "rgba(155,255,102,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();

    // Lane markers
    for (let i = 0; i < NUM_COMBAT_LANES; i++) {
      const active = i === this.lane;
      drawSphere(ctx, LANES[i], H - 40, active ? 9 : 5,
        active ? COLORS.bile : "rgba(180,180,180,0.3)",
        { highlight: active ? "rgba(255,255,255,0.9)" : null, rim: active ? COLORS.bileGlow : null });
    }
    ctx.restore();
  }

  drawTelegraph(ctx, tg) {
    const x = LANES[tg.lane];
    const frac = tg.t / tg.wait;
    const alpha = 0.45 + 0.25 * Math.sin(this.t * 18);
    ctx.save();
    const g = ctx.createLinearGradient(x, 0, x, FLOOR_Y);
    g.addColorStop(0, `rgba(155, 255, 102, ${alpha * 0.85})`);
    g.addColorStop(1, "rgba(155, 255, 102, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, 0, 44, FLOOR_Y);
    // Target X
    ctx.strokeStyle = `rgba(155, 255, 102, ${0.6 + 0.4 * Math.sin(this.t * 20)})`;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 20, FLOOR_Y - 30); ctx.lineTo(x + 20, FLOOR_Y);
    ctx.moveTo(x + 20, FLOOR_Y - 30); ctx.lineTo(x - 20, FLOOR_Y);
    ctx.stroke();
    // Progress arc
    ctx.strokeStyle = "#bfff00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, FLOOR_Y - 15, 26, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawGout(ctx, g) {
    ctx.save();
    // Trail
    const grd = ctx.createLinearGradient(g.x, g.y - 60, g.x, g.y);
    grd.addColorStop(0, "rgba(155,255,102,0)");
    grd.addColorStop(1, "rgba(155,255,102,0.75)");
    ctx.fillStyle = grd;
    ctx.fillRect(g.x - 8, g.y - 70, 16, 70);
    // Drop head (volumetric)
    drawSphere(ctx, g.x, g.y, 14, COLORS.bile, {
      highlight: "rgba(255,255,220,0.95)",
      rim: "rgba(220,255,120,0.85)",
      outline: "rgba(40, 110, 20, 0.7)",
    });
    ctx.restore();
  }

  drawUI(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    const pad = 16;

    // Top-left: player bars
    drawBar(ctx, pad, pad,      260, 20, p.hp / p.hpMax, {
      fill: COLORS.blood, label: `HP  ${Math.ceil(p.hp)}/${p.hpMax}`,
    });
    drawBar(ctx, pad, pad + 26, 260, 20, p.mana / p.manaMax, {
      fill: COLORS.mana, label: `MP  ${Math.ceil(p.mana)}/${p.manaMax}`,
    });
    if (p.armorMax > 0) {
      drawBar(ctx, pad, pad + 52, 260, 20, p.armor / p.armorMax, {
        fill: "#c0c4cc", label: `ARM ${Math.ceil(p.armor)}/${p.armorMax}`, labelColor: "#111",
      });
    }
    const tY = p.armorMax > 0 ? pad + 78 : pad + 52;
    drawBar(ctx, pad, tY, 260, 20, Math.max(0, p.acidTimer) / p.acidTimerMax, {
      fill: COLORS.bile,
      label: p.acidTimer > 0 ? `ACID TIMER ${Math.ceil(p.acidTimer)}s` : "CORRODING!",
      labelColor: "#111",
    });

    if (p.synergyTitle) {
      ctx.save();
      ctx.fillStyle = "rgba(40, 26, 54, 0.55)";
      roundRect(ctx, pad, tY + 28, 260, 24, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 210, 140, 0.45)";
      ctx.lineWidth = 1.2;
      roundRect(ctx, pad, tY + 28, 260, 24, 8);
      ctx.stroke();
      drawText(ctx, p.synergyTitle, pad + 130, tY + 40, {
        size: 12, color: "#ffe6b0", align: "center", bold: true,
        glow: "#ffd080", maxWidth: 252,
      });
      ctx.restore();
    }

    // Narrow top-center log (after player corner UI) — short lines, does not cover the five lanes.
    this.drawLog(ctx);

    // Top-right: enemy HP. v0.14 layout - panel grows taller when there
    // are extra badge rows (elite twist, enraged, matchup) so no two
    // rows ever overlap.
    const enemyPanelRows =
      1 /* name+HP */ +
      (this.matchupLabel ? 1 : 0) +
      (this.eliteKill ? 1 : 0) +
      (this.enraged ? 1 : 0);
    const enemyPanelH = 56 + Math.max(0, enemyPanelRows - 1) * 16;
    drawPanel(ctx, W - 280, pad, 264, enemyPanelH);
    const twinTag = this.bubblePaletteInvert ? " (TWIN)" : "";
    drawText(ctx, this.enemy.name + twinTag, W - 148, pad + 16, {
      size: 16,
      color: this.bubblePaletteInvert ? "#ffb0f8" : (this.eliteKill ? COLORS.gold : COLORS.bile),
      align: "center", bold: true,
      glow: this.bubblePaletteInvert ? "#ff6ad6" : (this.eliteKill ? COLORS.gold : null),
      maxWidth: 248,
    });
    // HP bar right below the name.
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemy.hp / this.enemy.hpMax, {
      fill: "#4a1010",
      label: null,
    });
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemyHpDisplay / this.enemy.hpMax, {
      fill: this.bubblePaletteInvert ? complementHexColor(this.enemy.color) : this.enemy.color,
      label: `${Math.ceil(this.enemyHpDisplay)} / ${this.enemy.hpMax}`,
      labelColor: "#111",
    });
    // Stacked badge rows (each 16px tall, never overlapping each other).
    let badgeY = pad + 56;
    if (this.matchupLabel) {
      drawText(ctx, this.matchupLabel.text, W - 148, badgeY, {
        size: 11, color: this.matchupLabel.color, align: "center", bold: true,
        maxWidth: 248,
      });
      badgeY += 16;
    }
    if (this.eliteKill) {
      const twColor = this.enemy.eliteColor || COLORS.gold;
      drawText(ctx, `[ ${this.eliteTwist} ]`, W - 148, badgeY, {
        size: 11, color: twColor, align: "center", bold: true, glow: twColor,
        maxWidth: 248,
      });
      badgeY += 16;
    }
    if (this.enraged) {
      const pulseE = 0.5 + 0.5 * Math.sin(this.t * 6);
      drawText(ctx, "[ENRAGED]", W - 148, badgeY, {
        size: 11, color: `rgba(255, ${80 + pulseE * 100}, 80, 1)`,
        align: "center", bold: true, glow: "#ff2020",
        maxWidth: 248,
      });
    }

    // Bottom action bar — large touch lanes (handleMenu picks via actionButtonRects)
    this.drawMenu(ctx, game);

    // Enemy melee telegraph banner - styled differently per move type so
    // the player learns to read the tell at a glance.
    if (this.enemyTelling || this.comboHitsLeft > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 20);
      const move = this.enemyMoveType;
      let bg, glow, text;
      if (move === "heavy") {
        bg = `rgba(255, 120, 20, ${0.35 + pulse * 0.45})`;
        glow = "#ff8020";
        text = "!! HEAVY SLAM - LANE DODGE WON'T SAVE YOU - BRACE (F/4) !!";
      } else if (move === "combo") {
        bg = `rgba(255, 220, 60, ${0.3 + pulse * 0.45})`;
        glow = "#ffd966";
        text = this.comboHitsLeft > 0
          ? `>>> TRIPLE STRIKE ${3 - this.comboHitsLeft}/3 - BRACE NOW (F/4) <<<`
          : "!!! TRIPLE STRIKE INCOMING - BRACE (F/4) !!!";
      } else {
        bg = `rgba(255, 60, 60, ${0.3 + pulse * 0.4})`;
        glow = "#ff2020";
        text = "! INCOMING STRIKE - PRESS F/4 TO BRACE !";
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 130, W, 28);
      drawText(ctx, text, W / 2, 144, {
        size: 17, color: "#fff", align: "center", bold: true, glow, baseline: "middle",
        maxWidth: W - 40,
      });
    }

    // Enrage flash (below compact combat log strip so glyphs do not paint over it).
    if (this.enrageFlashT > 0) {
      const a = Math.min(1, this.enrageFlashT / 1.4);
      ctx.save();
      ctx.globalAlpha = a;
      drawBanner(ctx, "ENRAGED!", W / 2, 108, 36, "#ff5050", "#400010");
      ctx.restore();
    }

    // Perfect-brace flash indicator.
    if (this.perfectBraceReady || this.perfectFlashT > 0) {
      const a = this.perfectBraceReady ? 1 : Math.min(1, this.perfectFlashT / 0.9);
      ctx.save();
      ctx.globalAlpha = a;
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 10);
      drawText(ctx, this.perfectBraceReady ? ">> COUNTER READY <<" : "PERFECT GUARD!",
        W / 2, 200, {
          size: 22, color: `rgba(255, 217, 102, ${0.8 + pulse * 0.2})`,
          align: "center", bold: true, glow: "#ffd966",
        });
      ctx.restore();
    }

    // v0.10 UX: action badge + context hint + help bar
    this.drawActionBadge(ctx, game);
    this.drawContextHint(ctx, game);
    this.drawHelperStrip(ctx);
  }

  /** One line above bottom action buttons (keyboard + lane hint). */
  drawHelperStrip(ctx) {
    drawText(ctx,
      "Pause [P]  · lanes [A]/[D] · Q/E/R/F combat row · Plasmids: Q Gene Bolt · E cycles element",
      W / 2, ACTION_BAR_TOP - 14, {
        size: 13, color: COLORS.boneDim, align: "center", baseline: "bottom",
        maxWidth: W - 24,
      });
  }

  // Top-center action badge so new players can see at a glance what state
  // they're in: attacking-ready, on cooldown, braced, counter-ready, etc.
  drawActionBadge(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    let text, color, glow;
    if (this.perfectBraceReady) {
      text = "COUNTER READY!"; color = "#ffd966"; glow = "#d6a020";
    } else if (this.braceTime > 0) {
      text = `BRACING (${this.braceTime.toFixed(1)}s)`; color = "#ffd966"; glow = "#8a5000";
    } else if (this.comboHitsLeft > 0) {
      text = "COMBO INCOMING!"; color = "#ffdc3c"; glow = "#a06800";
    } else if (this.enemyTelling) {
      text = "ENEMY WINDING UP!"; color = "#ff9070"; glow = "#ff4030";
    } else {
      const boltMc = activePlasmMode(l, p.plasmModeIndex ?? 0)?.manaCost ?? 0;
      const atkMcLine = l.attack.manaCost + (p.manaCostBonus || 0);
      const mpLine = p.loadoutId === "plasmids"
        ? boltMc + (p.manaCostBonus || 0)
        : atkMcLine;
      if (p.mana < mpLine) {
        text = "OUT OF MP — MANA VIAL [R / 3]"; color = "#62aaff"; glow = "#143c80";
      } else if (p.cooldowns.attack <= 0 || p.cooldowns.special <= 0) {
        text = "YOUR TURN - ATTACK!"; color = "#b5f05a"; glow = "#2a6a00";
      } else {
        text = "ON COOLDOWN — MANA VIAL / BRACE"; color = "#7fc0ff"; glow = "#1a4080";
      }
    }
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 6);
    ctx.save();
    drawText(ctx, text, W / 2, 110, {
      size: 18, color, align: "center", bold: true, glow, baseline: "middle",
    });
    ctx.strokeStyle = `rgba(255,255,255,${0.18 + pulse * 0.18})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 90, 122); ctx.lineTo(W / 2 + 90, 122);
    ctx.stroke();
    ctx.restore();
  }

  // Flashing tactical hint telling the player WHAT TO DO NOW. Appears below
  // the existing red tell banner so both readouts reinforce each other.
  drawContextHint(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    let hint = null;

    if (this.enemyTelling) {
      if (this.enemyMoveType === "heavy") {
        hint = { text: "[F/4] BRACE - dodging won't help this one!", color: "#ffd0b0" };
      } else if (this.enemyMoveType === "combo") {
        const L = GUARDIAN_LANE_NAMES[this.enemyAttackLane];
        hint = {
          text: `COMBO scours the ${L} column — move OFF it or [F/4] brace!`,
          color: "#fff0a0",
        };
      } else {
        const L = GUARDIAN_LANE_NAMES[this.enemyAttackLane];
        hint = {
          text: `Hit lines up on ${L} — dodge to another column or [F/4] brace!`,
          color: "#ffc0c0",
        };
      }
    } else if (this.comboHitsLeft > 0) {
      hint = { text: `[F/4] BRACE NOW - ${this.comboHitsLeft} hit(s) left!`, color: "#fff0a0" };
    } else if (this.perfectBraceReady) {
      hint = { text: "Press [Q/1] or [E/2] to CASH IN your counter!", color: "#ffd966" };
    } else if (this.telegraphs.some((tg) => tg.lane === this.lane && tg.t >= tg.wait - 0.45)) {
      hint = { text: "ACID LANDING ON YOU - [A]/[D] dodge!", color: "#bfff00" };
    } else if (p.hpMax > 0 && p.hp / p.hpMax < 0.35) {
      hint = { text: "Low HP! [R/3] mana vial  ·  [F/4] brace", color: "#ffa0a0" };
    } else if (
      p.loadoutId === "plasmids"
      && p.mana < ((activePlasmMode(l, p.plasmModeIndex ?? 0)?.manaCost ?? 0) + (p.manaCostBonus || 0))
    ) {
      hint = {
        text: "Out of MP for Gene Bolt — [R/3] vial  ·  [E/2] cycles element mode",
        color: "#7fc0ff",
      };
    } else if (
      p.cooldowns.attack <= 0 &&
      (p.loadoutId === "plasmids" || p.mana >= l.attack.manaCost + (p.manaCostBonus || 0))
    ) {
      const pm = activePlasmMode(l, p.plasmModeIndex ?? 0);
      hint = {
        text:
          p.loadoutId === "plasmids"
            ? `[Q/1] ${pm ? `${pm.label}: ${pm.boltName}` : "Gene Bolt"}  ·  [E/2] cycle mode  ·  lanes`
            : `[Q/1] ${l.attack.name}  ·  [E/2] ${l.special.name}  ·  lanes [A]/[D]`,
        color: "#c8ffc0",
      };
      if (l.cryoThird && p.loadoutId !== "plasmids") hint.text += "  ·  [T] Cryo";
    } else if (p.loadoutId !== "plasmids" && p.mana < l.attack.manaCost + (p.manaCostBonus || 0)) {
      hint = { text: "Out of MP! [R/3] Drink Mana Vial — pop cork, then tilt & pour!", color: "#7fc0ff" };
    }
    if (!hint) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
    ctx.save();
    ctx.globalAlpha = 0.8 + pulse * 0.2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    const hw = 820, hh = 32;
    roundRect(ctx, W / 2 - hw / 2, 170, hw, hh, 6);
    ctx.fill();
    drawText(ctx, hint.text, W / 2, 186, {
      size: 16, color: hint.color, align: "center",
      bold: true, glow: hint.color, baseline: "middle",
      maxWidth: hw - 24,
    });
    ctx.restore();
  }

  drawMenu(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    const plMode =
      p.loadoutId === "plasmids" ? activePlasmMode(l, p.plasmModeIndex ?? 0) : null;
    const rects = this.actionButtonRects();
    const pm = p.pactMods || {};
    const mcb = (p.manaCostBonus || 0);
    const atkMc = l.attack.manaCost + mcb;
    const specMc = l.special.manaCost + mcb;
    const cryo = (l.cryoThird && p.loadoutId !== "plasmids") ? l.cryoThird : null;
    const cryoCd = cryo ? (p.cooldowns.tertiary || 0) : 0;
    const potCd = this.potionDrinkCooldown > 0;
    const cryoMeta = cryo
      ? `Cryo [T]: ${cryoCd > 0 ? cryoCd.toFixed(1) + "s" : "READY"} · `
      : "";
    const vialCdStr = potCd ? `${this.potionDrinkCooldown.toFixed(1)}s` : "READY";

    drawPanel(ctx, 0, ACTION_BAR_TOP, W, ACTION_BAR_H);
    ctx.fillStyle = "rgba(12, 4, 16, 0.5)";
    ctx.fillRect(0, ACTION_BAR_TOP, W, ACTION_BAR_H);

    /** @type {object[]} */
    let defs;
    if (plMode) {
      const boltMc = plMode.manaCost + mcb;
      defs = [
        {
          headline: "GENE BOLT",
          sub: plMode.boltName,
          meta: `${plMode.dmg[0]}–${plMode.dmg[1]} dmg · ${boltMc} MP · Q/1`,
          locked: p.cooldowns.attack > 0 || p.mana < boltMc,
          cd: p.cooldowns.attack,
          cdMax: plMode.cooldown * (pm.attackCdMult || 1),
        },
        {
          headline: "CYCLE MODE",
          sub: l.special.name,
          meta: "Rotates FIRE → SHOCK → CRYO · E/2",
          locked: p.cooldowns.special > 0,
          cd: p.cooldowns.special,
          cdMax: l.special.cooldown * (pm.specialCdMult || 1),
        },
        {
          headline: "MANA VIAL",
          sub: "Pop cork · tilt pour (full refill)",
          meta: `${cryoMeta}Vial refill: ${vialCdStr}`,
          locked: !!this.potionState || potCd,
          cd: potCd ? this.potionDrinkCooldown : 0,
          cdMax: potCd ? POTION_DRINK_CD_SEC : 0,
        },
        {
          headline: "BRACE",
          sub: "Mitigate / perfect guard",
          meta: "Late timing → counter bonus on next hit",
          locked: false,
          cd: 0,
          cdMax: 0,
        },
      ];
    } else {
      defs = [
        {
          headline: "ATTACK 1",
          sub: l.attack.name,
          meta: `${l.attack.dmg[0]}–${l.attack.dmg[1]} dmg · ${atkMc} MP`,
          locked: p.cooldowns.attack > 0 || p.mana < atkMc,
          cd: p.cooldowns.attack,
          cdMax: l.attack.cooldown * (pm.attackCdMult || 1),
        },
        {
          headline: "ATTACK 2",
          sub: l.special.name,
          meta: `${l.special.dmg[0]}–${l.special.dmg[1]} dmg · ${specMc} MP`,
          locked: p.cooldowns.special > 0 || p.mana < specMc,
          cd: p.cooldowns.special,
          cdMax: l.special.cooldown * (pm.specialCdMult || 1),
        },
        {
          headline: "MANA VIAL",
          sub: "Pop cork · tilt pour (full refill)",
          meta: `${cryoMeta}Vial refill: ${vialCdStr}`,
          locked: !!this.potionState || potCd,
          cd: potCd ? this.potionDrinkCooldown : 0,
          cdMax: potCd ? POTION_DRINK_CD_SEC : 0,
        },
        {
          headline: "BRACE",
          sub: "Mitigate / perfect guard",
          meta: "Late timing → counter bonus on next hit",
          locked: false,
          cd: 0,
          cdMax: 0,
        },
      ];
    }

    for (let i = 0; i < 4; i++) {
      const r = rects[i];
      const def = defs[i];
      const sel = i === this.menuIdx;
      const cx = r.x + r.w / 2;
      ctx.save();
      roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10);
      ctx.fillStyle = def.locked
        ? "rgba(38, 38, 44, 0.9)"
        : sel
          ? "rgba(55, 85, 38, 0.55)"
          : "rgba(26, 14, 30, 0.92)";
      ctx.fill();
      ctx.strokeStyle = sel ? COLORS.bile : "rgba(255,255,255,0.22)";
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.stroke();

      const headCol = def.locked ? COLORS.boneDim : COLORS.bile;
      drawText(ctx, def.headline, cx, r.y + 22, {
        size: 20, color: headCol, align: "center", bold: true, baseline: "middle",
      });
      drawText(ctx, def.sub, cx, r.y + 50, {
        size: 14,
        color: def.locked ? "#666" : COLORS.bone,
        align: "center",
        bold: true,
        baseline: "middle",
        maxWidth: r.w - 14,
      });
      drawText(ctx, def.meta, cx, r.y + 78, {
        size: 11, color: COLORS.boneDim, align: "center", baseline: "middle",
        maxWidth: r.w - 12,
      });
      if (def.cdMax > 0) {
        const ready = def.cd <= 0;
        const denom = def.cdMax;
        drawBar(ctx, r.x + 12, r.y + r.h - 28, r.w - 24, 14, ready ? 1 : Math.max(0, 1 - def.cd / denom), {
          fill: ready ? COLORS.bile : "#5a6a7a",
          label: ready ? "READY" : `${def.cd.toFixed(1)}s`,
          labelColor: "#111",
        });
      }
      if (game.pinkFloydMode) {
        const hue = ((visualMods.t * 26 + i * 72) % 360);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `hsl(${hue}, 92%, 72%)`;
        ctx.lineWidth = 3.2;
        roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 10);
        ctx.stroke();
        ctx.strokeStyle = `hsl(${(hue + 140) % 360}, 95%, 68%)`;
        ctx.lineWidth = 2;
        roundRect(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 8);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  drawLog(ctx) {
    // Height fits 3 single-line rows (drawText ellipsis) under the heading without clipping.
    const lh = 80;
    const lw = Math.min(620, Math.floor(W * 0.484));
    const x = (W - lw) >> 1;
    const y = 4;
    drawPanel(ctx, x, y, lw, lh);
    drawText(ctx, "COMBAT LOG", x + 10, y + 16, {
      size: 10, color: COLORS.bile, bold: true, baseline: "middle",
    });
    const lineGap = 14;
    const bodyTop = y + 34;
    const maxLines =
      this.log.length === 0 ? 0 : Math.min(LOG_DISPLAY_LINES, this.log.length);
    const slice =
      maxLines <= 0
        ? []
        : this.log.slice(-maxLines).map((line) => truncateLogLine(line));
    slice.forEach((line, i) => {
      drawText(ctx, line, x + 10, bodyTop + i * lineGap, {
        size: 11,
        color: COLORS.bone,
        baseline: "top",
        maxWidth: lw - 20,
      });
    });
  }

  drawPause(ctx) {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    drawBanner(ctx, "PAUSED", W / 2, H / 2 - 20, 48, COLORS.bile, COLORS.blood);
    drawText(ctx, "Press P or ESC to resume", W / 2, H / 2 + 30, {
      size: 18, color: COLORS.bone, align: "center",
    });
  }
}

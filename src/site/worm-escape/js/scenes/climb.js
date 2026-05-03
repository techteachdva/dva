import {
  W, H, COLORS,
  drawBackdropCached, drawAcid, drawText, drawPanel, drawBar, drawBanner,
  drawHero, drawSphere, drawPlate, drawDropShadow, ParticleSystem, screenShake, shade,
  roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { randInt, rand, pick } from "../engine/rng.js";
import {
  pointInRect,
  columnIndexFromX,
  stepTowardIndex,
} from "../engine/pointer.js";
import {
  applyDamage, recordDirectHpHit, recordDirectArmorHit, clampPlayerResources,
} from "../content/player.js";
import { sillyMirrorCol5, sillySwappedHorizontalLaneDelta } from "../engine/sillyPactInput.js";
import {
  endlessDangerMult,
  resolveEndlessPalette,
} from "../content/endlessStyle.js";
import { CombatScene } from "./combat.js";
import { TongueBossScene } from "./tongueBoss.js";
import { GameOverScene } from "./gameover.js";
import { runBileRiseMult, runIncomingDamageMult } from "../content/gameBalance.js";
import { recordPinkFloydTrail } from "../engine/pinkFloydVfx.js";

// Five hand-hold columns on the veiny wall. Hero is fixed in screen Y;
// the wall scrolls. Bile rises from the bottom of the screen in absolute pixels.
//
// Columns are spread across the middle 60% of the screen so hopping between
// the outer columns takes real time even for Swiftfoot.

const COLS_X = [W * 0.22, W * 0.36, W * 0.50, W * 0.64, W * 0.78];
const NUM_COLS = COLS_X.length;
const HERO_Y = H - 180;              // hero fixed 180 px above bottom
const HERO_DEATH_Y = HERO_Y + 28;    // bile touches this Y -> submerged

// Falling objects are split into two categories:
//
//   HAZARDS (telegraphed in red) want you OUT of their column:
//     - rock         : classic armor-absorb hit (armor soak applies).
//                      Swift eats the brunt; Iron shrugs most of it.
//     - bone/tooth/  : legacy worm-gunk (same family as rock - armor-absorb).
//       goblin
//     - dagger/sword : sharp pierce; bypasses armor and cuts straight into HP.
//     - mace         : slams armor DIRECTLY. If armor is 0, it STUNS you for
//                      ~1.3s and also knocks HP a bit. Brutal if you're Swift.
//     - meat         : wet splat. Ignored if you have armor (just bounces off).
//                      Hurts a little if you have no armor.
//
//   POWER-UPS (telegraphed in gold) want you INTO their column:
//     - feather      : feather of flying — instant upward boost.
//     - burger       : cheeseburger — heals HP.
//     - ring         : ring of armor — grants armor.
//     - manaFlask    : condensed mana — restores a chunk of MP.
//
// `weight` is the random pick weight within its category. `rarity` on power-ups
// further tilts picks within the power-up pool (ring is especially rare).
// Per-chamber damage multiplier - every source of damage (debris, bile, acid)
// passes through this so the deeper you are in the worm, the nastier every
// hit becomes. Chamber 0 = baseline, chamber 3 = +45%.
const CHAMBER_DMG_SCALE = [1.0, 1.18, 1.32, 1.45];

// v0.9: damage numbers bumped across the board (~1.4x) AFTER scaling is
// applied, so the game actually threatens both builds. Combined with
// CHAMBER_DMG_SCALE, a mace hit in the Gullet lands at ~35 armor damage.
const DEBRIS_KINDS = [
  // --- HAZARDS ---
  { kind: "rock",   color: "#555",       sizeR: [12, 20], dmg: 34, damageType: "armor-absorb", weight: 18 },
  { kind: "bone",   color: COLORS.bone,  sizeR: [10, 18], dmg: 28, damageType: "armor-absorb", weight: 14 },
  { kind: "tooth",  color: "#f6ecd0",    sizeR: [8, 14],  dmg: 25, damageType: "armor-absorb", weight: 12 },
  { kind: "goblin", color: "#6ea34a",    sizeR: [14, 22], dmg: 30, damageType: "armor-absorb", weight: 10 },
  { kind: "dagger", color: "#cfd4dc",    sizeR: [10, 14], dmg: 20, damageType: "pierce",       weight: 14 },
  { kind: "sword",  color: "#e0e4ec",    sizeR: [16, 22], dmg: 30, damageType: "pierce",       weight: 10 },
  { kind: "mace",   color: "#9aa0ac",    sizeR: [14, 20], dmg: 24, damageType: "armor-direct", weight: 10, stun: 1.4 },
  { kind: "meat",   color: "#a82232",    sizeR: [14, 22], dmg: 16, damageType: "flesh-only",   weight: 12 },
];

// Power-ups are picked from a separate pool so we can tune rarity independently.
// Inside this pool, ring of armor is especially rare (weight 2 vs 15/12) so
// it's worth chasing but still shows up maybe once or twice per run.
const POWERUPS = [
  { kind: "feather", color: "#eaf6ff", sizeR: [14, 14], damageType: "power", effect: "boost", boost: 220, weight: 15 },
  { kind: "burger",  color: "#ffbb55", sizeR: [15, 15], damageType: "power", effect: "heal",  heal:  30,  weight: 11 },
  { kind: "manaFlask", color: "#5ec8ff", sizeR: [12, 14], damageType: "power", effect: "manaFrac", frac: 0.42, weight: 9 },
  { kind: "ring",    color: "#ffd966", sizeR: [12, 12], damageType: "power", effect: "armor", armor: 50, weight: 2,  glow: true },
];

export class ClimbScene {
  constructor(chamberIdx) {
    this.chamberIdx = chamberIdx;
    this.chamber = CHAMBERS[chamberIdx];
    this.t = 0;
    this.progress = 0;
    const startCol = Math.floor(NUM_COLS / 2);
    this.col = startCol;
    this.targetX = COLS_X[startCol];
    this.heroX = COLS_X[startCol];
    this.hopCooldown = 0;
    this.anim = 0;

    this.debris = [];
    this.telegraphs = [];
    this.debrisTimer = 1.2;

    // Bile: rises in pixels from the BOTTOM of the screen.
    // bileY = H - bileHeight. Starts exactly at H (invisible, 0 height).
    this.bileHeight = 0;

    // Bile-submersion grace mechanic: while the bile surface is above
    // HERO_DEATH_Y, this timer counts up. Armor absorbs the bite for
    // 1 second per point of armor; afterward HP drains. Swift (0 armor)
    // basically has a 0.5s grace window from splash-damage immunity.
    this.submerged = false;
    this.submergeFlashT = 0;
    this.drownT = 0; // seconds submerged after armor ran out

    // Stun timer - set by the mace hitting an un-armored hero. While > 0
    // the climber cannot climb up or hop columns. Bile keeps rising.
    this.stunT = 0;

    // Ring of Armor visual/feedback pulse (short flash after pickup).
    this.ringPulseT = 0;

    this.particles = new ParticleSystem();
    this.flash = 0;
    this.toast = null;
    this.toastTime = 0;
    this.paused = false;
    this.done = false;
    // v0.12 hitless chamber tracking: any damage taken flips this off.
    // Surfaced to the scoreboard + saves the Gullet-hitless unlock flag.
    this.hitlessChamber = true;
  }

  enter(game) {
    const p = game.player;
    p.chamberIndex = this.chamberIdx;
    p.acidTimer = this.chamber.acidTimer;
    p.acidTimerMax = this.chamber.acidTimer;
    this.showToast("ENTER: " + this.chamber.name, 2.0);
    SFX.confirm();
    // v0.12 Ring Forger pact: start this chamber with a free Ring of Armor.
    // Consumes the one-shot flag so the bonus doesn't carry into chamber 3.
    if (p.pactMods && p.pactMods.freeRingPending) {
      p.pactMods.freeRingPending = false;
      p.armorMax = Math.max(p.armorMax, 50);
      p.armor = Math.min(p.armorMax, p.armor + 50);
      if (p.armorSoak <= 0) p.armorSoak = 0.5;
      this.ringPulseT = 1.2;
      this.showToast("RING FORGER: Free Ring of Armor conjured!", 2.2);
      if (p.score) { p.score.powerUpsCollected++; p.score.ringsCollected++; }
    }

    // Silly pact: BILE EXPRESS — fire on next climb entry (HP/MP clamped for combat handoff).
    const pm0 = p.pactMods;
    if (pm0 && pm0.sillyBileShortcutPending) {
      const r = pm0.sillyBileShortcutRank || 1;
      pm0.sillyBileShortcutPending = false;
      pm0.sillyBileShortcutRank = 0;
      this.hitlessChamber = false;
      const ch = this.chamber;
      if (r >= 3) {
        p.mana = 0;
        p.hpMax = Math.max(1, Math.floor(p.hpMax * 0.5));
        p.hp = Math.min(p.hp, p.hpMax);
        this.showToast("BILE EXPRESS III — you skipped the climb. The worm took its cut.", 3.2);
        clampPlayerResources(p);
        if (ch.isMaw || ch.guardian === "wormMaw" || ch.guardian === "wormTongue") {
          game.scenes.replace(new TongueBossScene(this.chamberIdx), game);
        } else {
          const bub = game.bubblegumMode ? { bubbleFightIndex: 1 } : {};
          game.scenes.replace(new CombatScene(this.chamberIdx, bub), game);
        }
        return;
      }
      if (r === 2) {
        p.mana = Math.floor(p.mana * 0.22);
        p.hpMax = Math.max(1, Math.floor(p.hpMax * 0.78));
        p.hp = Math.min(p.hp, p.hpMax);
        this.progress = ch.climbHeight * 0.88;
        this.showToast("BILE EXPRESS II — most of the wall melts away. You paid dearly.", 2.8);
      } else {
        p.mana = Math.floor(p.mana * 0.62);
        p.hpMax = Math.max(1, Math.floor(p.hpMax * 0.94));
        p.hp = Math.min(p.hp, p.hpMax);
        this.progress = ch.climbHeight * 0.42;
        this.showToast("BILE EXPRESS I — a greasy hop up the meat.", 2.4);
      }
      clampPlayerResources(p);
    }
  }

  // v0.12 small helper so every damage branch flips the hitless flag in
  // exactly one place. `points` is informational only for later use.
  markHit(_points = 1) {
    this.hitlessChamber = false;
  }

  showToast(text, time) {
    this.toast = text;
    this.toastTime = time;
  }

  hitClimbBlockingUi(mx, my) {
    if (my > H - 34) return true;
    if (mx < 290 && my < 130) return true;
    const rW = 320, rX = W - 16 - rW;
    if (pointInRect(mx, my, rX, 16, rW, 100)) return true;
    if (pointInRect(mx, my, W / 2 - 400, 72, 800, 54)) return true;
    return false;
  }

  update(dt, game) {
    if (this.done) return;

    // Pause toggle
    if (game.input.wasPressed("p", "Escape")) {
      this.paused = !this.paused;
      SFX.click();
    }
    if (this.paused) return;

    this.t += dt;
    const p = game.player;
    const ch = this.chamber;
    const cheatPain = runIncomingDamageMult(game);
    if (typeof game.invulnerable === "boolean") p.invulnerable = game.invulnerable;
    if (p.score) p.score.timeSpent += dt;

    // Decrement timers that gate the climber each frame.
    if (this.stunT > 0) this.stunT -= dt;
    if (this.ringPulseT > 0) this.ringPulseT -= dt;
    const stunned = this.stunT > 0;

    // --- Input: hop between columns (now 5 columns, 0..NUM_COLS-1) ---
    // v0.10 INPUT FIX: use wasPressed (one-shot per keystroke) instead of
    // isDown so a single tap moves EXACTLY one column. Holding the key
    // no longer tears across multiple columns at once. hopCooldown is
    // kept as a small anti-spam gate tied to build flavor (Iron is chunky).
    this.hopCooldown -= dt;
    const mx = game.input.mouseX, my = game.input.mouseY;
    if (!stunned && this.hopCooldown <= 0) {
      let hop = 0;
      const revH = !!(p.pactMods && p.pactMods.sillyMirrorH);
      hop = sillySwappedHorizontalLaneDelta(game.input, this.col, NUM_COLS - 1, revH);
      if (hop === 0 && game.input.wasPressed("Mouse0")) {
        if (!this.hitClimbBlockingUi(mx, my)) {
          const arenaTop = 96;
          if (my >= arenaTop && my < H - 36) {
            let target = columnIndexFromX(mx, COLS_X);
            if (revH) target = sillyMirrorCol5(target);
            hop = stepTowardIndex(this.col, target);
          }
        }
      }
      if (hop !== 0 && this.col + hop >= 0 && this.col + hop < NUM_COLS) {
        this.col += hop;
        this.targetX = COLS_X[this.col];
        this.hopCooldown = p.hopCooldown;
        SFX.grab();
      }
    }
    // Smooth lerp hero X - Swift snaps faster than Iron
    const lerpSpeed = p.buildId === "swift" ? 16 : 10;
    this.heroX += (this.targetX - this.heroX) * Math.min(1, dt * lerpSpeed);
    if (game.pinkFloydMode) recordPinkFloydTrail(game, this.heroX, HERO_Y);

    // --- Climb up (blocked while stunned) ---
    const climbBase = 200 * p.climbSpeed;
    const slipRate = 28;
    const revV = !!(p.pactMods && p.pactMods.sillyMirrorV);
    const mouseUp = game.input.isDown("Mouse0") && my < HERO_Y && !this.hitClimbBlockingUi(mx, my);
    const mouseBrace = game.input.isDown("Mouse0") && my >= HERO_Y + 42 && !this.hitClimbBlockingUi(mx, my);
    const keyClimb = revV
      ? game.input.isDown("ArrowDown", "s")
      : game.input.isDown("ArrowUp", "w");
    const keyBrace = revV
      ? game.input.isDown("ArrowUp", "w")
      : game.input.isDown("ArrowDown", "s");
    const climbHeld = keyClimb || (revV ? mouseBrace : mouseUp);
    const braceHeld = keyBrace || (revV ? mouseUp : mouseBrace);
    if (stunned) {
      // While stunned we slip a bit - captures the "dazed and sliding" feel.
      this.progress = Math.max(0, this.progress - slipRate * 0.8 * dt);
    } else if (climbHeld) {
      this.progress += climbBase * dt;
    } else if (braceHeld) {
      // brace: hold position (no slip, no climb)
    } else {
      this.progress -= slipRate * dt;
      if (this.progress < 0) this.progress = 0;
    }

    // --- Bile rises ---
    // Pact modifier: Tide Watcher slows bile, Ring Forger speeds it up.
    const bileMult = (p.pactMods && p.pactMods.bileRiseMult) || 1;
    const bileRiseMul = game.endlessMode ? endlessDangerMult(game) : 1;
    const cheatBile = runBileRiseMult(game);
    this.bileHeight += ch.bileRiseRate * bileMult * bileRiseMul * cheatBile * dt;

    // --- Acid timer (atmospheric corrosion, even above bile) ---
    if (!p.invulnerable) {
      p.acidTimer -= dt * p.acidResist;
      if (p.acidTimer <= 0) {
        if (p.armor > 0) {
          p.armor = Math.max(0, p.armor - 5 * cheatPain * dt);
          this.markHit();
        } else {
          p.hp -= 3 * cheatPain * dt;
          this.flash = Math.max(this.flash, 0.15);
          this.markHit();
        }
      }
    }

    // --- Bile submersion (used to be instant death) ---
    // Armor acts as a bile-survival buffer: it corrodes at 1pt/sec while
    // submerged. Once armor is gone, HP drains fast. Swift has 0 armor,
    // so they get almost no grace; Iron (60 armor) gets ~60s of buffer,
    // which is plenty of time to claw their way up above the surface.
    const bileTopY = H - this.bileHeight;
    const wasSubmerged = this.submerged;
    this.submerged = bileTopY <= HERO_DEATH_Y;
    if (this.submerged) {
      this.submergeFlashT += dt;
      if (!wasSubmerged) {
        SFX.acid();
        screenShake(6, 0.2);
        this.showToast(
          p.armor > 0
            ? `SUBMERGED! Armor buying you ~${Math.ceil(p.armor)}s of grace.`
            : "SUBMERGED! No armor - GET OUT NOW!",
          2.0
        );
      }
      if (!p.invulnerable) {
        if (p.armor > 0) {
          p.armor = Math.max(0, p.armor - cheatPain * dt); // scaled bile armor chew
          this.markHit();
          // Occasional armor-fizz particles + red-tint flash pulse
          this.flash = Math.max(this.flash, 0.12 + Math.sin(this.t * 12) * 0.04);
          if (Math.random() < 0.4) {
            this.particles.burst(
              this.heroX + rand(-14, 14),
              HERO_Y + 6,
              "#ffe08a", 4, 70, 0.4,
            );
          }
        } else {
          this.drownT += dt;
          const ed = game.endlessMode ? endlessDangerMult(game) : 1;
          const bileDmg = (p.bileHpDrain || 24)
            * (CHAMBER_DMG_SCALE[this.chamberIdx] || 1) * ed * cheatPain * dt;
          p.hp -= bileDmg;
          recordDirectHpHit(p, bileDmg, { countAsHit: false });
          this.flash = Math.max(this.flash, 0.35);
          this.markHit();
          if (Math.random() < 0.5) {
            this.particles.burst(
              this.heroX + rand(-16, 16),
              HERO_Y + 6,
              COLORS.blood, 6, 140, 0.45,
            );
          }
        }
      }
      // Panic bubbles
      if (Math.random() < 0.6) {
        this.particles.emit({
          x: this.heroX + rand(-22, 22),
          y: HERO_Y + rand(0, 18),
          vx: rand(-20, 20), vy: rand(-120, -50),
          life: 0.6, max: 0.6, size: 2 + Math.random() * 2,
          color: "rgba(220,255,170,0.9)", gravity: -30,
        });
      }
    } else {
      this.submergeFlashT = 0;
    }

    // --- Debris telegraphs + spawns (5 columns, per-chamber density) ---
    this.debrisTimer -= dt;
    if (this.debrisTimer <= 0) {
      const [tMin, tMax] = ch.debrisInterval;
      // Pact modifier: Tide Watcher raises the interval (slower debris).
      const rateMult = (p.pactMods && p.pactMods.debrisRateMult) || 1;
      const voidM = (p.voidDebrisIntervalMult ?? 1);
      this.debrisTimer = rand(tMin * rateMult * voidM, tMax * rateMult * voidM);
      // Base spawn count per cycle scales with the chamber.
      const baseCount = ch.spawnCount || 1;
      const usedCols = [];
      const pm = p.pactMods || null;
      for (let i = 0; i < baseCount; i++) {
        this.spawnTelegraph(ch, usedCols, pm, game);
        usedCols.push(this._lastSpawnedCol);
      }
      if (Math.random() < 0.115) this.spawnTelegraph(ch, usedCols, pm, game);

      // Optional bonus spawn when multiDebrisChance rolls true.
      if (Math.random() < (ch.multiDebrisChance || 0)) {
        this.spawnTelegraph(ch, usedCols, pm, game);
      }
    }
    for (const tg of this.telegraphs) tg.t += dt;
    this.telegraphs = this.telegraphs.filter((tg) => {
      if (tg.t >= tg.wait) {
        const r = rand(tg.kind.sizeR[0], tg.kind.sizeR[1]);
        this.debris.push({
          x: COLS_X[tg.col] + rand(-14, 14),
          y: -r, vy: tg.speed, r,
          kind: tg.kind, rot: rand(0, Math.PI * 2), vrot: rand(-6, 6),
        });
        return false;
      }
      return true;
    });

    // Move debris + collisions
    for (const d of this.debris) { d.y += d.vy * dt; d.rot += d.vrot * dt; }
    const heroBox = { x: this.heroX - 18, y: HERO_Y - 32, w: 36, h: 54 };
    for (const d of this.debris) {
      if (d._hit) continue;
      const cx = Math.max(heroBox.x, Math.min(d.x, heroBox.x + heroBox.w));
      const cy = Math.max(heroBox.y, Math.min(d.y, heroBox.y + heroBox.h));
      const dx = d.x - cx, dy = d.y - cy;
      if (dx * dx + dy * dy < d.r * d.r) {
        d._hit = true;
        this.handleDebrisHit(game, d);
      }
    }
    this.debris = this.debris.filter((d) => !d._hit && d.y < H + 40);

    this.particles.update(dt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    if (this.toastTime > 0) this.toastTime -= dt;

    if (p.hp <= 0) {
      const msg = this.submerged
        ? (p.armorMax > 0
            ? "Armor gave way. The bile finished the job. SPLORCH."
            : "The bile rose. You did not. SPLORCH.")
        : "Your wounds overwhelm you. The worm belches contentedly.";
      screenShake(18, 0.5);
      SFX.die();
      this.die(game, msg);
      return;
    }

    // Win
    if (this.progress >= ch.climbHeight) {
      this.done = true;
      SFX.confirm();
      // v0.12 hitless-chamber bookkeeping. Bile Whip unlock depends on the
      // specific Gullet (chamber 0) flag.
      if (this.hitlessChamber && p.score) {
        p.score.hitlessChambers++;
        if (this.chamberIdx === 0) p.score.gullethitless = true;
      }
      // Final chamber routes to the Maw boss (5-tooth whack-a-mole,
      // exported from tongueBoss.js as TongueBossScene for continuity).
      if (ch.isMaw || ch.guardian === "wormMaw" || ch.guardian === "wormTongue") {
        game.scenes.replace(new TongueBossScene(this.chamberIdx), game);
      } else {
        const bub = game.bubblegumMode
          ? { bubbleFightIndex: 1 }
          : {};
        game.scenes.replace(new CombatScene(this.chamberIdx, bub), game);
      }
      return;
    }

    const climbingAnim = climbHeld;
    this.anim += dt * (climbingAnim ? 10 : 3);
  }

  // Pick a column, preferring ones not in `avoidCols` (array of col ints
  // already used this cycle). Falls back to any column if every column is
  // already used.
  pickColumn(avoidCols) {
    const base = [];
    for (let i = 0; i < NUM_COLS; i++) {
      if (!avoidCols || !avoidCols.includes(i)) base.push(i);
    }
    let pool = base.length ? base : [...Array(NUM_COLS).keys()];
    if (Math.random() < 0.3) {
      const wantOdd = Math.random() < 0.5;
      const filt = pool.filter((c) => (c % 2 === (wantOdd ? 1 : 0)));
      if (filt.length) pool = filt;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Weighted pick from a list of items that have a numeric `weight`.
  weightedPick(items) {
    let total = 0;
    for (const it of items) total += it.weight || 1;
    let r = Math.random() * total;
    for (const it of items) {
      r -= it.weight || 1;
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  // Spawn one telegraph. `avoidCols` is an optional array of columns already
  // spoken for this cycle so we spread the spawns out naturally.
  spawnTelegraph(ch, avoidCols = [], pactMods = null, game = null) {
    const col = this.pickColumn(avoidCols);
    this._lastSpawnedCol = col;

    const puMult = (pactMods && pactMods.powerUpRateMult) || 1;
    const basePu = (ch.powerUpRarity || 0) * puMult;

    const cappedPu = Math.min(0.95, basePu);
    const rollPower = game?.jillyMode
      ? Math.random() < (1 - cappedPu)
      : Math.random() < cappedPu;
    const kind = rollPower
      ? this.weightedPick(POWERUPS)
      : this.weightedPick(DEBRIS_KINDS);
    const telePower = kind.damageType === "power";

    this.telegraphs.push({
      col,
      t: 0,
      wait: rand(0.88, 1.35),
      kind,
      speed: ch.debrisSpeed * rand(0.9, 1.3),
      power: telePower,
    });
  }

  handleDebrisHit(game, d) {
    const p = game.player;
    const kind = d.kind;
    const cheatPain = runIncomingDamageMult(game);
    const isPowerPickup = kind.damageType === "power";

    if (isPowerPickup) {
      const pu = kind;
      switch (pu.effect) {
        case "boost": {
          // Feather of flying: instant upward boost in climb progress.
          const boost = pu.boost || 200;
          this.progress += boost;
          this.showToast("+FEATHER OF FLYING! Whoosh!", 1.4);
          SFX.confirm();
          if (p.score) p.score.powerUpsCollected++;
          this.particles.burst(d.x, d.y, "#eaf6ff", 28, 260, 0.7);
          // Trail of feathers up the screen
          for (let i = 0; i < 10; i++) {
            this.particles.emit({
              x: this.heroX + rand(-14, 14),
              y: HERO_Y + rand(-10, 20),
              vx: rand(-30, 30), vy: rand(-320, -200),
              life: 0.9, max: 0.9, size: 3,
              color: "rgba(240,250,255,0.95)", gravity: -40,
            });
          }
          break;
        }
        case "heal": {
          // Feed Frenzy pact: +burgerBonusHp on top of the base heal.
          const bonus = (p.pactMods && p.pactMods.burgerBonusHp) || 0;
          const totalHeal = (pu.heal || 30) + bonus;
          const healed = Math.min(totalHeal, p.hpMax - p.hp);
          p.hp = Math.min(p.hpMax, p.hp + totalHeal);
          this.showToast(`+CHEESEBURGER! (+${Math.ceil(healed)} HP)`, 1.4);
          SFX.confirm();
          if (p.score) p.score.powerUpsCollected++;
          this.particles.burst(d.x, d.y, "#ffbb55", 22, 220, 0.55);
          break;
        }
        case "manaFrac": {
          const frac = typeof pu.frac === "number" ? pu.frac : 0.42;
          const add = Math.max(8, Math.round(p.manaMax * frac));
          const before = p.mana;
          p.mana = Math.min(p.manaMax, p.mana + add);
          const got = p.mana - before;
          this.showToast(`+Mana flask (+${got} MP)`, 1.35);
          SFX.confirm();
          if (p.score) p.score.powerUpsCollected++;
          this.particles.burst(d.x, d.y, "#5ec8ff", 24, 240, 0.65);
          break;
        }
        case "armor": {
          // Ring of armor: grants a 50 point armor shield.
          const grant = pu.armor || 50;
          p.armorMax = Math.max(p.armorMax, grant);
          p.armor = Math.min(p.armorMax, p.armor + grant);
          if (p.armorSoak <= 0) p.armorSoak = 0.5;
          this.ringPulseT = 1.2;
          this.showToast("+RING OF ARMOR! Glowing protection!", 1.8);
          SFX.victory();
          if (p.score) { p.score.powerUpsCollected++; p.score.ringsCollected++; }
          screenShake(6, 0.2);
          this.particles.burst(d.x, d.y, "#ffd966", 36, 320, 0.9);
          break;
        }
      }
      return;
    }

    const hz = kind;
    if (p.invulnerable && hz.damageType !== "power") return;

    // --- Hazards: resolve by damage type ---
    // Apply per-chamber scaling so the Gullet hits ~45% harder than the Stomach.
    // Feed Frenzy pact multiplies incoming debris on top of that (wyrm/dragon too).
    const endlessM = game.endlessMode ? endlessDangerMult(game) : 1;
    const scale = (CHAMBER_DMG_SCALE[this.chamberIdx] || 1) * endlessM * cheatPain;
    const debrisMult = (p.pactMods && p.pactMods.debrisDmgMult) || 1;
    const dmg = Math.round((hz.dmg || 0) * scale * debrisMult);
    // Any hazard contact flips hitless off.
    this.markHit();
    let armorTaken = 0, hpTaken = 0;
    let partColor = COLORS.blood;
    let shake = 10;

    switch (hz.damageType) {
      case "armor-absorb": {
        // Tank pips eat a whole hit first (Iron's "free soak" perk).
        if (p.tankHitsLeft > 0) {
          p.tankHitsLeft--;
          if (p.score) p.score.hitsTaken++;
          this.showToast(`IRONHIDE soaks it! (${p.tankHitsLeft} tanks left)`, 1.4);
          SFX.thud();
          screenShake(6, 0.18);
          this.particles.burst(d.x, d.y, "#ffd966", 14, 180, 0.45);
          this.progress = Math.max(0, this.progress - 40);
          return;
        }
        const r = applyDamage(p, dmg);
        armorTaken = r.armorTaken; hpTaken = r.hpTaken;
        partColor = armorTaken > 0 ? "#ffcc55" : COLORS.blood;
        if (armorTaken > 0 && hpTaken === 0) {
          this.showToast(`Armor holds! (-${Math.ceil(armorTaken)} ARM)`, 1.0);
        }
        break;
      }
      case "pierce": {
        // Dagger / sword: bypass armor, hit HP directly.
        hpTaken = Math.min(p.hp, dmg);
        p.hp = Math.max(0, p.hp - dmg);
        recordDirectHpHit(p, hpTaken);
        partColor = COLORS.blood;
        shake = 12;
        this.showToast(`${hz.kind.toUpperCase()} STAB! (-${Math.ceil(hpTaken)} HP)`, 1.1);
        break;
      }
      case "armor-direct": {
        // Mace: damages armor directly. If no armor, STUNS and hits HP a bit.
        if (p.armor > 0) {
          const eaten = Math.min(p.armor, dmg);
          p.armor -= eaten;
          armorTaken = eaten;
          recordDirectArmorHit(p, eaten);
          partColor = "#d4d8e0";
          this.showToast(`MACE CLANG! (-${Math.ceil(eaten)} ARM)`, 1.1);
        } else {
          this.stunT = Math.max(this.stunT, hz.stun || 1.3);
          const bonusHp = Math.floor(dmg * 0.4);
          hpTaken = Math.min(p.hp, bonusHp);
          p.hp = Math.max(0, p.hp - bonusHp);
          recordDirectHpHit(p, hpTaken);
          partColor = "#d4d8e0";
          shake = 14;
          this.showToast(`MACE BONK! STUNNED!`, 1.6);
          SFX.thud();
        }
        break;
      }
      case "flesh-only": {
        if (p.armor > 0) {
          this.showToast(`SPLAT! The meat slides off your armor.`, 1.0);
          partColor = "#a82232";
          shake = 4;
          this.particles.burst(d.x, d.y, "#a82232", 20, 180, 0.55);
          this.progress = Math.max(0, this.progress - 20);
          return;
        } else {
          hpTaken = Math.min(p.hp, dmg);
          p.hp = Math.max(0, p.hp - dmg);
          recordDirectHpHit(p, hpTaken);
          partColor = "#c21a1a";
          this.showToast(`MEAT SPLAT! (-${Math.ceil(hpTaken)} HP)`, 1.0);
        }
        break;
      }
      default: {
        // Fallback to legacy behavior.
        const r = applyDamage(p, dmg);
        armorTaken = r.armorTaken; hpTaken = r.hpTaken;
        break;
      }
    }

    SFX.hit();
    screenShake(shake, 0.22);
    this.flash = 0.35;
    this.particles.burst(d.x, d.y, partColor, 16, 200, 0.5);
    this.progress = Math.max(0, this.progress - 60);
  }

  die(game, reason) {
    this.done = true;
    game.scenes.replace(new GameOverScene(reason), game);
  }

  // ================= RENDER =================
  render(ctx, game) {
    const p = game.player;
    const ch = this.chamber;

    const pal = resolveEndlessPalette(game, ch.palette, ch.wormTint);
    const tBg = this.t + this.progress * 0.002;
    drawBackdropCached(ctx, tBg, tBg, pal.wormTint, pal.palette, this.chamberIdx + 1);

    this.drawWall(ctx);
    // v0.13 final chamber: frame the climb with massive fangs drooling
    // from the sides. Decorative only - doesn't affect gameplay.
    if (ch.isMaw) this.drawMawFangs(ctx);

    // Debris (behind hero)
    for (const d of this.debris) this.drawDebris(ctx, d);

    // Hero
    ctx.save();
    ctx.translate(this.heroX, HERO_Y);
    ctx.scale(2.8, 2.8);
    drawHero(ctx, 0, 0, 1, this.anim, p.buildId, p.synergyId);
    ctx.restore();

    // Ring-of-armor equip pulse (brief golden ring bursting outward).
    if (this.ringPulseT > 0) {
      const a = Math.max(0, this.ringPulseT / 1.2);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 217, 102, ${a})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "#ffd966";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(this.heroX, HERO_Y, 40 + (1 - a) * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stun stars spinning over the hero's head.
    if (this.stunT > 0) {
      ctx.save();
      const cx = this.heroX, cy = HERO_Y - 90;
      for (let i = 0; i < 4; i++) {
        const a = this.t * 4 + (i / 4) * Math.PI * 2;
        const sx = cx + Math.cos(a) * 22;
        const sy = cy + Math.sin(a) * 6;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(a);
        ctx.fillStyle = "#ffd966";
        ctx.shadowColor = "#ffea9a";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 === 0 ? 7 : 3;
          ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // Telegraphs (on top)
    for (const tg of this.telegraphs) this.drawTelegraph(ctx, tg);

    // Bile at bottom (absolute height from bottom)
    const bileFrac = this.bileHeight / H;
    drawAcid(ctx, this.t, Math.max(0, Math.min(1, bileFrac)));

    // Particles on top
    this.particles.render(ctx);

    // Damage flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(194, 26, 26, ${this.flash})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawUI(ctx, game);

    if (this.paused) this.drawPause(ctx);
  }

  // v0.13 THE MAW decoration: massive fangs hanging from the left and
  // right edges of the canvas, pointed inward. Drawn AFTER the wall so
  // they sit on top but OUTSIDE the active climb area (teeth are placed
  // in the leftmost and rightmost 8% of the screen only). Some fangs
  // drool saliva that drips downward over time.
  drawMawFangs(ctx) {
    const t = this.t;
    ctx.save();

    const drawFang = (x, y, w, h, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // Gum / shadow
      ctx.fillStyle = "#4a0a18";
      ctx.beginPath();
      ctx.moveTo(-w * 0.8, 0);
      ctx.lineTo(w * 0.8, 0);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      // Ivory body
      const g = ctx.createLinearGradient(-w, 0, w, h);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, "#f6e9c4");
      g.addColorStop(1, "#8a7238");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-w * 0.6, 2);
      ctx.lineTo(w * 0.6, 2);
      ctx.lineTo(0, h - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Specular highlight
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.2, h * 0.25, w * 0.12, h * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // Blood smear
      ctx.fillStyle = "rgba(140, 10, 10, 0.5)";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.6, w * 0.25, h * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Left column - fangs pointing RIGHT.
    const left = 0;
    const rowCount = 6;
    for (let i = 0; i < rowCount; i++) {
      const f = (i + 0.5) / rowCount;
      const y = f * H;
      const w = 38 + Math.sin(i * 11.3) * 6;
      const h = 110 + Math.sin(i * 7.7) * 22 + (i % 2 === 0 ? 12 : 0);
      drawFang(left, y, w, h, Math.PI * 1.5);
    }
    // Right column - fangs pointing LEFT.
    for (let i = 0; i < rowCount; i++) {
      const f = (i + 0.5) / rowCount;
      const y = f * H;
      const w = 38 + Math.sin(i * 9.1) * 6;
      const h = 112 + Math.sin(i * 5.7) * 20;
      drawFang(W, y, w, h, Math.PI * 0.5);
    }

    // Drool drops falling from a few fangs.
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const baseX = side < 0 ? 130 : W - 130;
      const phase = (t * 0.35 + i * 0.37) % 1;
      const y = (i / 8) * H + phase * 90 - 20;
      const a = Math.max(0, 1 - phase * 1.2);
      ctx.fillStyle = `rgba(200, 240, 180, ${a * 0.55})`;
      ctx.beginPath();
      ctx.ellipse(baseX, y, 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 230, ${a * 0.75})`;
      ctx.beginPath();
      ctx.arc(baseX - 1, y - 2, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawWall(ctx) {
    // Fleshy hand-holds in three scrolling columns with volumetric shading.
    const scroll = this.progress * 0.7;
    ctx.save();
    for (let ci = 0; ci < NUM_COLS; ci++) {
      const x = COLS_X[ci];
      // Column guide (subtle cylinder shading)
      const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
      g.addColorStop(0, "rgba(210,130,240,0.05)");
      g.addColorStop(0.5, "rgba(210,130,240,0.12)");
      g.addColorStop(1, "rgba(0,0,0,0.08)");
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, 0, 80, H);

      // Lumpy hand-holds
      for (let j = -1; j < 22; j++) {
        const gy = (j * 85 + (scroll % 85));
        const cy = gy;
        if (cy < -30 || cy > H + 30) continue;
        // Cast shadow on wall
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.ellipse(x + 5, cy + 7, 30, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        // Lump body - volumetric
        const grd = ctx.createRadialGradient(x - 8, cy - 7, 2, x, cy, 30);
        grd.addColorStop(0, shade(COLORS.wormHi, 1.0));
        grd.addColorStop(0.5, shade(COLORS.wormLight, 0.95));
        grd.addColorStop(1, shade(COLORS.worm, 0.55));
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(x, cy, 30, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        // Specular highlight
        ctx.fillStyle = "rgba(255,220,255,0.45)";
        ctx.beginPath();
        ctx.ellipse(x - 10, cy - 5, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Rim light on opposite side
        ctx.fillStyle = "rgba(220, 120, 230, 0.35)";
        ctx.beginPath();
        ctx.ellipse(x + 12, cy + 3, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Outline
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(x, cy, 30, 14, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawDebris(ctx, d) {
    const haloPick = d.kind.damageType === "power";
    ctx.save();
    // Shadow (skip for power-ups so they feel airy / floaty)
    if (!haloPick) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(d.x + 2, d.y + 4, d.r * 0.9, d.r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Power-ups get an aurora halo so the eye is drawn to them.
      const glowPulse = 0.75 + 0.25 * Math.sin(this.t * 6 + d.x);
      const glowColor = d.kind.kind === "ring"  ? "rgba(255, 217, 102, "
                       : d.kind.kind === "burger" ? "rgba(255, 187, 85, "
                       : d.kind.kind === "manaFlask" ? "rgba(140, 210, 255, "
                       : "rgba(200, 230, 255, ";
      const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, d.r * 3.2);
      g.addColorStop(0, glowColor + (0.6 * glowPulse) + ")");
      g.addColorStop(1, glowColor + "0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);

    switch (d.kind.kind) {
      case "bone":    this.drawBone(ctx, d); break;
      case "tooth":   this.drawTooth(ctx, d); break;
      case "goblin":  this.drawGoblinHead(ctx, d); break;
      case "rock":    this.drawRock(ctx, d); break;
      case "dagger":  this.drawDagger(ctx, d); break;
      case "sword":   this.drawSword(ctx, d); break;
      case "mace":    this.drawMace(ctx, d); break;
      case "meat":    this.drawMeat(ctx, d); break;
      case "feather": this.drawFeather(ctx, d); break;
      case "burger":  this.drawBurger(ctx, d); break;
      case "manaFlask": this.drawManaFlask(ctx, d); break;
      case "ring":    this.drawRingOfArmor(ctx, d); break;
      default:        this.drawRock(ctx, d);
    }
    ctx.restore();
  }

  // ---- Individual item renderers (all drawn at origin, rotated by d.rot) ----

  drawBone(ctx, d) {
    ctx.fillStyle = shade(d.kind.color, 0.8);
    ctx.fillRect(-d.r, -3, d.r * 2, 6);
    ctx.fillStyle = d.kind.color;
    ctx.fillRect(-d.r + 1, -2.5, d.r * 2 - 2, 3);
    ctx.fillStyle = shade(d.kind.color, 0.6);
    ctx.beginPath();
    ctx.arc(-d.r, 0, 5, 0, Math.PI * 2);
    ctx.arc(d.r, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = d.kind.color;
    ctx.beginPath();
    ctx.arc(-d.r - 1, -1, 3, 0, Math.PI * 2);
    ctx.arc(d.r - 1, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawTooth(ctx, d) {
    const g = ctx.createLinearGradient(-d.r, -d.r, d.r, d.r);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.6, d.kind.color);
    g.addColorStop(1, "#7a6a3a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -d.r);
    ctx.lineTo(d.r * 0.7, d.r);
    ctx.lineTo(-d.r * 0.7, d.r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-d.r * 0.6, d.r - 1);
    ctx.lineTo(0, -d.r + 2);
    ctx.stroke();
  }

  drawGoblinHead(ctx, d) {
    const g = ctx.createRadialGradient(-d.r * 0.3, -d.r * 0.3, 2, 0, 0, d.r);
    g.addColorStop(0, "#8cbf5c");
    g.addColorStop(0.7, d.kind.color);
    g.addColorStop(1, "#2a3a0a");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(-5, -4, 4, 3);
    ctx.fillRect(1, -4, 4, 3);
    ctx.fillStyle = "#fff";
    ctx.fillRect(-5, -4, 1, 1);
    ctx.fillRect(1, -4, 1, 1);
    ctx.strokeStyle = "#1a0a0a";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-5, 3); ctx.lineTo(5, 5); ctx.stroke();
    ctx.fillStyle = COLORS.bile;
    ctx.fillRect(-1, d.r - 2, 2, 5);
  }

  drawRock(ctx, d) {
    const g = ctx.createRadialGradient(-d.r * 0.4, -d.r * 0.4, 2, 0, 0, d.r);
    g.addColorStop(0, "#aaa");
    g.addColorStop(0.7, "#555");
    g.addColorStop(1, "#222");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-d.r, 0);
    ctx.lineTo(-d.r * 0.5, -d.r);
    ctx.lineTo(d.r * 0.5, -d.r * 0.8);
    ctx.lineTo(d.r, d.r * 0.2);
    ctx.lineTo(0, d.r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Crack line
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-d.r * 0.3, -d.r * 0.4);
    ctx.lineTo(d.r * 0.2, d.r * 0.3);
    ctx.stroke();
  }

  drawDagger(ctx, d) {
    // Long thin blade pointing "down" (toward +y in local space, since items
    // are rotating freely anyway).
    const g = ctx.createLinearGradient(-4, -d.r, 4, d.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#cfd4dc");
    g.addColorStop(1, "#5a5f6a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, d.r + 4);
    ctx.lineTo(3, -d.r * 0.2);
    ctx.lineTo(0, -d.r * 0.3);
    ctx.lineTo(-3, -d.r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Crossguard
    ctx.fillStyle = "#b38244";
    ctx.fillRect(-6, -d.r * 0.35, 12, 3);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeRect(-6, -d.r * 0.35, 12, 3);
    // Grip
    ctx.fillStyle = "#3a1f0f";
    ctx.fillRect(-2, -d.r * 0.35 - 8, 4, 8);
  }

  drawSword(ctx, d) {
    // Bigger blade w/ fuller line.
    const g = ctx.createLinearGradient(-5, -d.r, 5, d.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.45, "#e8ecf2");
    g.addColorStop(1, "#6f747f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, d.r + 6);
    ctx.lineTo(5, -d.r * 0.2);
    ctx.lineTo(0, -d.r * 0.35);
    ctx.lineTo(-5, -d.r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Fuller
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -d.r * 0.15); ctx.lineTo(0, d.r);
    ctx.stroke();
    // Crossguard
    ctx.fillStyle = "#b38244";
    ctx.fillRect(-10, -d.r * 0.45, 20, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeRect(-10, -d.r * 0.45, 20, 4);
    // Grip + pommel
    ctx.fillStyle = "#3a1f0f";
    ctx.fillRect(-3, -d.r * 0.45 - 10, 6, 10);
    ctx.fillStyle = "#ffd966";
    ctx.beginPath(); ctx.arc(0, -d.r * 0.45 - 12, 3, 0, Math.PI * 2); ctx.fill();
  }

  drawMace(ctx, d) {
    // Heavy spiked ball + shaft
    ctx.fillStyle = "#3a1f0f";
    ctx.fillRect(-2, 0, 4, d.r + 8);
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeRect(-2, 0, 4, d.r + 8);
    // Ball
    drawSphere(ctx, 0, -2, d.r * 0.7, "#9aa0ac", {
      highlight: "rgba(255,255,255,0.75)",
      rim: "rgba(220,220,240,0.4)",
      outline: "rgba(0,0,0,0.7)",
    });
    // Spikes
    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const sx = Math.cos(a) * (d.r * 0.7);
      const sy = -2 + Math.sin(a) * (d.r * 0.7);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = "#c0c4cc";
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(3, 2);
      ctx.lineTo(-3, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawMeat(ctx, d) {
    // Wobbly gory blob
    const g = ctx.createRadialGradient(-d.r * 0.3, -d.r * 0.3, 2, 0, 0, d.r);
    g.addColorStop(0, "#e24050");
    g.addColorStop(0.6, "#a82232");
    g.addColorStop(1, "#4a0010");
    ctx.fillStyle = g;
    ctx.beginPath();
    const lobes = 7;
    for (let i = 0; i <= lobes * 6; i++) {
      const f = i / (lobes * 6);
      const a = f * Math.PI * 2;
      const r = d.r * (0.9 + Math.sin(a * lobes + this.t * 2) * 0.1);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Bone nub poking out
    ctx.fillStyle = "#efe6c8";
    ctx.fillRect(-2, -d.r + 1, 4, 4);
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeRect(-2, -d.r + 1, 4, 4);
    // Wet highlight
    ctx.fillStyle = "rgba(255,180,180,0.5)";
    ctx.beginPath();
    ctx.ellipse(-d.r * 0.3, -d.r * 0.3, d.r * 0.3, d.r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFeather(ctx, d) {
    // Feather shape, white with blue-ish tip, curved quill.
    ctx.save();
    const g = ctx.createLinearGradient(0, -d.r, 0, d.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.6, "#cfe8ff");
    g.addColorStop(1, "#6fa9d6");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -d.r - 4);
    ctx.quadraticCurveTo(d.r * 0.8, -d.r * 0.2, 0, d.r + 2);
    ctx.quadraticCurveTo(-d.r * 0.8, -d.r * 0.2, 0, -d.r - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(80,120,180,0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Spine (quill)
    ctx.strokeStyle = "rgba(60,80,110,0.9)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -d.r - 4); ctx.lineTo(0, d.r + 2);
    ctx.stroke();
    // Barbs
    ctx.strokeStyle = "rgba(140,180,220,0.7)";
    ctx.lineWidth = 0.7;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 2.2);
      ctx.lineTo((i > 0 ? -1 : 1) * (d.r * 0.7 - Math.abs(i) * 0.6), i * 2.2 + 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawBurger(ctx, d) {
    // Stacked cheeseburger: bottom bun, patty, cheese, lettuce, top bun w/ seeds.
    const R = d.r;
    // Bottom bun
    ctx.fillStyle = "#c98a3c";
    ctx.beginPath();
    ctx.ellipse(0, R * 0.75, R, R * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1; ctx.stroke();
    // Patty
    ctx.fillStyle = "#5a2a10";
    ctx.fillRect(-R * 0.95, R * 0.35, R * 1.9, R * 0.4);
    ctx.strokeRect(-R * 0.95, R * 0.35, R * 1.9, R * 0.4);
    // Cheese (drippy)
    ctx.fillStyle = "#ffd24a";
    ctx.beginPath();
    ctx.moveTo(-R, R * 0.3);
    ctx.lineTo(R, R * 0.3);
    ctx.lineTo(R * 0.9, R * 0.45);
    ctx.lineTo(R * 0.6, R * 0.32);
    ctx.lineTo(R * 0.3, R * 0.5);
    ctx.lineTo(0,      R * 0.32);
    ctx.lineTo(-R * 0.3, R * 0.5);
    ctx.lineTo(-R * 0.6, R * 0.32);
    ctx.lineTo(-R * 0.9, R * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 0.8; ctx.stroke();
    // Lettuce ruffle
    ctx.fillStyle = "#6cbf4a";
    ctx.beginPath();
    ctx.moveTo(-R, R * 0.2);
    for (let i = 0; i <= 8; i++) {
      const x = -R + (i / 8) * R * 2;
      const y = R * 0.2 - (i % 2 === 0 ? 3 : 0);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(R, R * 0.3);
    ctx.lineTo(-R, R * 0.3);
    ctx.closePath();
    ctx.fill();
    // Top bun
    const bg = ctx.createRadialGradient(-R * 0.4, -R * 0.3, 2, 0, -R * 0.1, R);
    bg.addColorStop(0, "#ffd48a");
    bg.addColorStop(0.5, "#e0a04a");
    bg.addColorStop(1, "#8a4a1a");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.15, R, R * 0.8, 0, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 1; ctx.stroke();
    // Sesame seeds
    ctx.fillStyle = "#fff6c0";
    for (const [sx, sy] of [[-R*0.5, -R*0.5], [-R*0.1, -R*0.65], [R*0.3, -R*0.55], [R*0.55, -R*0.3]]) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, 2, 1, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawManaFlask(ctx, d) {
    const R = d.r;
    ctx.save();
    ctx.fillStyle = shade(d.kind.color, 0.85);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.2;
    roundRect(ctx, -R * 0.55, -R * 1.1, R * 1.1, R * 1.8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(180, 230, 255, 0.75)";
    ctx.beginPath();
    ctx.ellipse(0, R * 0.15, R * 0.35, R * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a5a2a";
    ctx.fillRect(-R * 0.2, -R * 1.18, R * 0.4, R * 0.16);
    ctx.restore();
  }

  drawRingOfArmor(ctx, d) {
    // Glowing golden ring with inset jewel.
    const R = d.r;
    ctx.save();
    // Outer glow (layered)
    for (let k = 4; k >= 1; k--) {
      ctx.fillStyle = `rgba(255, 217, 102, ${0.06 * k})`;
      ctx.beginPath();
      ctx.arc(0, 0, R * (1.2 + k * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    // Ring body
    ctx.strokeStyle = "#ffd966";
    ctx.lineWidth = R * 0.32;
    ctx.shadowColor = "#ffea9a";
    ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(0, 2, R * 0.85, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Highlight rim
    ctx.strokeStyle = "rgba(255, 250, 210, 0.9)";
    ctx.lineWidth = R * 0.12;
    ctx.beginPath(); ctx.arc(0, 2, R * 0.95, Math.PI * 1.1, Math.PI * 1.7);
    ctx.stroke();
    // Inset crimson jewel
    drawSphere(ctx, 0, -R * 0.75, R * 0.35, "#c21a1a", {
      highlight: "rgba(255,180,180,1)",
      rim: "rgba(255,80,80,0.8)",
      outline: "rgba(60,0,0,0.8)",
    });
    // Shadow underline
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 2, R * 0.85, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // ---- Telegraph: red for hazards, gold/glow for power-ups ----
  drawTelegraph(ctx, tg) {
    const x = COLS_X[tg.col];
    const frac = tg.t / tg.wait;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 24);
    const isPower = tg.power;
    const col1 = isPower ? "rgba(255, 217, 102," : "rgba(255, 70, 70,";
    const glow = isPower ? "#ffd966" : "#ff3030";
    const icon = isPower ? "+" : "!";

    ctx.save();
    const grd = ctx.createLinearGradient(x, 0, x, 150);
    grd.addColorStop(0, `${col1} ${0.6 + pulse * 0.3})`);
    grd.addColorStop(1, `${col1} 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x - 34, 0);
    ctx.lineTo(x + 34, 0);
    ctx.lineTo(x + 54, 150);
    ctx.lineTo(x - 54, 150);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, x, 36 + Math.sin(this.t * 30) * 2);

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, 36, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawUI(ctx, game) {
    const p = game.player;
    const ch = this.chamber;
    const pad = 16;

    // Top-left: HP / Mana / Armor / Acid-timer
    drawBar(ctx, pad, pad,        260, 20, p.hp / p.hpMax, {
      fill: COLORS.blood, label: `HP  ${Math.ceil(p.hp)}/${p.hpMax}`,
    });
    drawBar(ctx, pad, pad + 26,   260, 20, p.mana / p.manaMax, {
      fill: COLORS.mana,  label: `MP  ${Math.ceil(p.mana)}/${p.manaMax}`,
    });
    if (p.armorMax > 0) {
      drawBar(ctx, pad, pad + 52, 260, 20, p.armor / p.armorMax, {
        fill: "#c0c4cc", label: `ARM ${Math.ceil(p.armor)}/${p.armorMax}`, labelColor: "#111",
      });
    }
    const tY = p.armorMax > 0 ? pad + 78 : pad + 52;
    drawBar(ctx, pad, tY, 260, 20, Math.max(0, p.acidTimer) / p.acidTimerMax, {
      fill: COLORS.bile,
      label: p.acidTimer > 0
        ? `ACID TIMER ${Math.ceil(p.acidTimer)}s`
        : "ACID: CORRODING!",
      labelColor: "#111",
    });

    // Tank-hit pips
    if (p.tankHitsMax > 0) {
      for (let i = 0; i < p.tankHitsMax; i++) {
        const px = pad + i * 16;
        const py = tY + 28;
        ctx.fillStyle = i < p.tankHitsLeft ? COLORS.gold : "rgba(233,220,193,0.25)";
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px + 6, py + 6, 6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      drawText(ctx, "TANK", pad + p.tankHitsMax * 16 + 6, tY + 34, {
        size: 11, color: COLORS.boneDim,
      });
    }

    // Top-right: chamber + climb progress
    const rW = 320;
    const rX = W - pad - rW;
    drawPanel(ctx, rX, pad, rW, 80);
    drawText(ctx, ch.name, rX + rW / 2, pad + 14, {
      size: 16, color: COLORS.bile, align: "center", bold: true,
      maxWidth: rW - 16,
    });
    drawText(ctx, ch.tagline, rX + rW / 2, pad + 36, {
      size: 12, color: COLORS.boneDim, align: "center",
      maxWidth: rW - 16,
    });
    const pct = Math.min(1, this.progress / ch.climbHeight);
    drawBar(ctx, rX + 12, pad + 54, rW - 24, 16, pct, {
      fill: COLORS.gold, label: `CLIMB ${Math.round(pct * 100)}%`, labelColor: "#111",
    });

    // Column indicator (bottom center)
    this.drawColumnIndicator(ctx);

    // --- v0.10 UX: action badge + contextual flashing hint + help bar ---
    this.drawActionBadge(ctx, game);
    this.drawContextHint(ctx, game);
    this.drawHelpBar(ctx, game);

    // Toast
    if (this.toast && this.toastTime > 0) {
      const a = Math.min(1, this.toastTime * 1.2);
      ctx.globalAlpha = a;
      drawBanner(ctx, this.toast, W / 2, 130, 28, COLORS.bile, COLORS.blood);
      ctx.globalAlpha = 1;
    }
  }

  // Shows what the hero is CURRENTLY doing so new players can see at a glance
  // whether their input is registering ("CLIMBING!" vs "SLIPPING...").
  drawActionBadge(ctx, game) {
    const p = game.player;
    const mx = game.input.mouseX, my = game.input.mouseY;
    const uiBlock = this.hitClimbBlockingUi(mx, my);
    const mouseUp = game.input.isDown("Mouse0") && my < HERO_Y && !uiBlock;
    const mouseDn = game.input.isDown("Mouse0") && my >= HERO_Y + 42 && !uiBlock;
    const revV = !!(p.pactMods && p.pactMods.sillyMirrorV);
    const keyClimb = revV ? game.input.isDown("ArrowDown", "s") : game.input.isDown("ArrowUp", "w");
    const keyBrace = revV ? game.input.isDown("ArrowUp", "w") : game.input.isDown("ArrowDown", "s");
    const climbHeld = keyClimb || (revV ? mouseDn : mouseUp);
    const braceHeld = keyBrace || (revV ? mouseUp : mouseDn);
    let text, color, glow;
    if (this.stunT > 0) {
      text = "STUNNED!"; color = "#ff9070"; glow = "#ff4030";
    } else if (this.submerged) {
      text = "SUBMERGED!"; color = "#bfff00"; glow = "#2a6a00";
    } else if (climbHeld) {
      text = "CLIMBING UP!"; color = "#b5f05a"; glow = "#2a6a00";
    } else if (braceHeld) {
      text = "BRACING"; color = "#ffd966"; glow = "#8a5000";
    } else {
      text = "SLIPPING..."; color = "#ff9a9a"; glow = "#600000";
    }
    const pulse = 0.75 + 0.25 * Math.sin(this.t * 6);
    ctx.save();
    const x = W / 2, y = 86;
    drawText(ctx, text, x, y, {
      size: 20, color, align: "center", bold: true, glow, baseline: "middle",
    });
    // Underline as a visual anchor
    ctx.strokeStyle = `rgba(255,255,255,${0.2 + pulse * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 80, y + 14); ctx.lineTo(x + 80, y + 14);
    ctx.stroke();
    ctx.restore();
  }

  // Flashing, context-aware message above the player telling them what to
  // actually do right now. The key UX fix - new players kept asking "what
  // do I do?"; now the game just tells them.
  drawContextHint(ctx, game) {
    const p = game.player;
    const ch = this.chamber;
    // Figure out the situation and pick one hint.
    let hint = null;

    // Priority 1: life-threatening states.
    if (this.submerged) {
      hint = { text: "!! DROWNING IN BILE - HOLD [UP] TO CLIMB !!", color: "#ffff80", bg: "rgba(140,20,20,0.75)" };
    } else if (this.stunT > 0) {
      hint = { text: "STUNNED - wait it out, then climb!", color: "#ffd966", bg: "rgba(110,60,10,0.65)" };
    } else {
      // Priority 2: imminent threats/opportunities in nearby telegraphs.
      const imminent = this.telegraphs.find((tg) => tg.t >= tg.wait - 0.75);
      if (imminent) {
        if (imminent.power) {
          if (imminent.col === this.col) {
            hint = { text: "+ POWER-UP LANDING HERE - STAY PUT! +", color: "#fff6b0", bg: "rgba(120,90,0,0.7)" };
          } else {
            const arrow = imminent.col < this.col ? "< LEFT" : "RIGHT >";
            hint = { text: `+ POWER-UP COMING - HOP ${arrow} +`, color: "#fff6b0", bg: "rgba(120,90,0,0.7)" };
          }
        } else if (imminent.col === this.col) {
          hint = { text: "! HAZARD IN YOUR LANE - DODGE [LEFT] OR [RIGHT] !", color: "#ffb0b0", bg: "rgba(140,20,20,0.75)" };
        }
      }
      // Priority 3: gentle prompts based on progress.
      if (!hint) {
        const bileNearby = this.bileHeight > H - HERO_Y - 200;
        if (this.progress < 30 && this.t > 0.8) {
          hint = { text: "HOLD [UP] / [W] TO CLIMB THE WALL", color: "#bfff00", bg: "rgba(20,50,10,0.7)" };
        } else if (bileNearby) {
          hint = { text: "BILE RISING FAST - KEEP CLIMBING!", color: "#bfff00", bg: "rgba(40,70,10,0.7)" };
        }
      }
    }
    if (!hint) return;
    // Render: pulsing pill at top center, above toast line.
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
    ctx.save();
    ctx.globalAlpha = 0.82 + pulse * 0.18;
    ctx.fillStyle = hint.bg;
    const hw = 760, hh = 34;
    roundRect(ctx, W / 2 - hw / 2, 172, hw, hh, 6);
    ctx.fill();
    drawText(ctx, hint.text, W / 2, 189, {
      size: 17, color: hint.color, align: "center",
      bold: true, glow: hint.color, baseline: "middle",
      maxWidth: hw - 24,
    });
    ctx.restore();
  }

  // Persistent control-scheme bar at the very bottom of the screen.
  drawHelpBar(ctx, game) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, H - 30, W, 30);
    const pm = game?.player?.pactMods;
    let line = "[UP/W] / click above hero & hold to climb   [A]/[D] lanes or click under hero   [DOWN/S] brace   [P] Pause";
    if (pm?.sillyMirrorV) {
      line = "[WORM MIRROR] Vertical + horizontal inputs flipped — read the wall, not the legend.   [P] Pause";
    } else if (pm?.sillyMirrorH) {
      line = "[WORM MIRROR] [A]/[D] & mouse lanes flipped — climb/brace unchanged.   [P] Pause";
    }
    drawText(ctx, line, W / 2, H - 15, {
      size: 13, color: COLORS.bone, align: "center", baseline: "middle", bold: true,
      maxWidth: W - 40,
    });
    ctx.restore();
  }

  drawColumnIndicator(ctx) {
    const y = H - 54;
    const gap = 30;
    const span = gap * (NUM_COLS - 1);
    for (let i = 0; i < NUM_COLS; i++) {
      const x = W / 2 - span / 2 + i * gap;
      const active = i === this.col;
      drawSphere(ctx, x, y, active ? 9 : 5, active ? COLORS.bile : "#4a4a55",
        { highlight: active ? "rgba(255,255,255,0.9)" : null, rim: active ? COLORS.bileGlow : null });
    }
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

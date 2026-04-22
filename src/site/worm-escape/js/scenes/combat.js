import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, drawBar,
  drawHero, drawSphere, drawPlate, drawDropShadow,
  ParticleSystem, screenShake, shade, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { ENEMIES } from "../content/enemies.js";
import { rollElite, applyElite } from "../content/elites.js";
import { pick, rand, randInt } from "../engine/rng.js";
import { applyDamage, matchupMultiplier, matchupLabel, recordDirectHpHit, recordDirectArmorHit } from "../content/player.js";
import { TransitionScene } from "./transition.js";
import { PactScene } from "./pact.js";
import { GameOverScene } from "./gameover.js";

const LANES = [W * 0.33, W * 0.5, W * 0.67];
const FLOOR_Y = 620;
const HERO_Y = 600;

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
  constructor(chamberIdx) {
    this.chamberIdx = chamberIdx;
    this.chamber = CHAMBERS[chamberIdx];
    const ed = ENEMIES[this.chamber.guardian];
    const hp = Math.floor(ed.hp * (1 + chamberIdx * 0.15));
    // Deep-copy damage ranges so applyElite can mutate safely.
    this.enemy = {
      ...ed, hp, hpMax: hp,
      attackDmg: ed.attackDmg ? [...ed.attackDmg] : undefined,
      heavyDmg:  ed.heavyDmg  ? [...ed.heavyDmg]  : undefined,
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
    this.lane = 1;
    this.heroX = LANES[1];
    this.targetX = LANES[1];
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
    this.paused = false;
    this.done = false;

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
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 4) this.log.shift();
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
  }

  update(dt, game) {
    if (this.done) return;

    if (game.input.wasPressed("p", "Escape")) {
      this.paused = !this.paused;
      SFX.click();
    }
    if (this.paused) return;

    this.t += dt;
    this.anim += dt * 4;
    const p = game.player;
    if (p.score) p.score.timeSpent += dt;

    // Lane lerp
    const lerpSpeed = p.buildId === "swift" ? 18 : 11;
    this.heroX += (this.targetX - this.heroX) * Math.min(1, dt * lerpSpeed);

    // Lane swapping (cooldown by build).
    // v0.10 INPUT FIX: wasPressed for one-lane-per-keystroke. A tap moves
    // exactly one lane; holding the key does NOT slide across all three.
    this.laneCd -= dt;
    if (this.laneCd <= 0) {
      if (game.input.wasPressed("ArrowLeft", "a") && this.lane > 0) {
        this.lane--;
        this.targetX = LANES[this.lane];
        this.laneCd = p.laneSwapCd;
        SFX.dodge();
      } else if (game.input.wasPressed("ArrowRight", "d") && this.lane < 2) {
        this.lane++;
        this.targetX = LANES[this.lane];
        this.laneCd = p.laneSwapCd;
        SFX.dodge();
      }
    }

    // Acid timer keeps ticking in combat too, and the corrosion itself
    // scales with chamber difficulty. Corrosion tracks into totalHpLost
    // but NOT hitsTaken (it's a continuous tick, not a distinct hit).
    const corrScale = CHAMBER_DMG_SCALE[this.chamberIdx] || 1;
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

    if (this.phase === "intro") {
      this.introT += dt;
      if (this.introT > 1.6) this.phase = "fight";
    }

    if (this.phase === "fight") {
      this.updateCooldowns(dt, p);
      this.updateAcidGouts(dt, p);
      this.updateEnemyMelee(dt, p);
      this.handleMenu(dt, game);
    }

    if (this.braceTime > 0) this.braceTime -= dt;
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
    if (this.enemy.hp > 0 && (this.enemy.poisonT || 0) > 0) {
      const dps = this.enemy.poisonDps || 0;
      this.enemy.hp = Math.max(0, this.enemy.hp - dps * dt);
      this.enemy.poisonT -= dt;
      if (Math.random() < dt * 6) {
        this.particles.burst(
          W / 2 + rand(-40, 40),
          FLOOR_Y - 220 + rand(-30, 30),
          "#9bff80", 3, 80, 0.45,
        );
      }
    }

    // Fanged elite: extra acid gouts outside the normal cadence.
    if (this.eliteTwist === "FANGED" && this.phase === "fight") {
      this.eliteGoutTimer -= dt;
      if (this.eliteGoutTimer <= 0) {
        this.eliteGoutTimer = rand(3.2, 4.6);
        const lane = randInt(0, 2);
        this.telegraphs.push({ lane, t: 0, wait: p.dodgeWindow + 0.05 });
      }
    }

    // Enrage trigger: one-shot state change when HP falls below threshold.
    if (!this.enraged && this.enemy.hp > 0
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
    if (this.eliteTwist === "SHIELDED" && !this.enemy.shieldUsed
        && this.enemy.hp < this.enemy.hpMax * (this.enemy.shieldTriggerFrac || 0.75)) {
      this.enemy.shielded = true;
      this.enemy.shieldUsed = true;
      this.enemy.shieldCooldown = this.enemy.shieldDuration || 6;
      this.enemy.shieldHitsLeft = 3;
      this.pushLog(`!! SHIELD RAISED - PERFECT BRACE x3 TO BREAK !!`);
      SFX.thud();
      this.particles.burst(W / 2, FLOOR_Y - 200, "#9adaff", 40, 320, 0.9);
    }
    if (this.enemy.shielded) {
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

      // Bloated elite: death explosion. Brace just before killing blow to halve it.
      if (this.eliteTwist === "BLOATED" && !this.bloatedExploded) {
        this.bloatedExploded = true;
        const raw = this.braceTime > 0 ? 10 : 25;
        const dmg = Math.round(raw * (CHAMBER_DMG_SCALE[this.chamberIdx] || 1));
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
        this.done = true;
        // v0.12 route: Combat -> Pact picker -> Transition -> next Climb.
        // Elite kills grant a 4-card choice as a spoil.
        game.scenes.replace(
          new PactScene(this.chamberIdx, { eliteReward: !!this.eliteKill }),
          game,
        );
      }
    }
  }

  updateCooldowns(dt, p) {
    p.cooldowns.attack  = Math.max(0, p.cooldowns.attack  - dt);
    p.cooldowns.special = Math.max(0, p.cooldowns.special - dt);
  }

  updateAcidGouts(dt, p) {
    this.goutsTimer -= dt;
    if (this.goutsTimer <= 0) {
      let [mn, mx] = this.enemy.acidInterval;
      // Enraged: tighten the cadence aggressively.
      if (this.enraged) { mn *= 0.65; mx *= 0.65; }
      this.goutsTimer = rand(mn, mx);
      const lane = randInt(0, 2);
      this.telegraphs.push({ lane, t: 0, wait: p.dodgeWindow + 0.15 });
      // Paired gout: at low HP the enemy sometimes fires TWO at once in
      // different lanes so the player has to pick AND commit.
      if (this.enraged && Math.random() < 0.45) {
        let other = (lane + 1 + randInt(0, 1)) % 3;
        if (other === lane) other = (other + 1) % 3;
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

    const scale = CHAMBER_DMG_SCALE[this.chamberIdx] || 1;
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
  landEnemyMelee(p, rawDmg, moveType) {
    const scale = CHAMBER_DMG_SCALE[this.chamberIdx] || 1;
    const enrageBonus = this.enraged ? 1.2 : 1;
    let dmg = Math.round(rawDmg * scale * enrageBonus);
    let braceNote = "";
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
    let line = braceNote + pick(this.enemy.flavorHit);
    if (moveType === "heavy") line = braceNote + "HEAVY SLAM! " + line;
    line += ` (-${Math.ceil(hpTaken)} HP${armorTaken ? `, -${Math.ceil(armorTaken)} ARM` : ""})`;
    this.pushLog(line);
  }

  updateEnemyMelee(dt, p) {
    // --- Combo sequence in progress ---
    if (this.comboHitsLeft > 0) {
      this.comboHitTimer -= dt;
      if (this.comboHitTimer <= 0) {
        const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]) * 0.55;
        this.landEnemyMelee(p, raw, "combo");
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
      this.enemyTellTime -= dt;
      if (this.enemyTellTime <= 0) {
        // Tell ends -> move resolves.
        const move = this.enemyMoveType;
        if (move === "heavy") {
          // Heavy slam ignores lane-dodging entirely.
          const raw = randInt(this.enemy.heavyDmg[0], this.enemy.heavyDmg[1]);
          this.landEnemyMelee(p, raw, "heavy");
          this.enemyTurnTimer = rand(3.2, 4.2) * (this.enraged ? 0.7 : 1);
        } else if (move === "combo") {
          // Start triple strike - first hit lands immediately, next ones via
          // the comboHitsLeft loop above.
          const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]) * 0.55;
          this.landEnemyMelee(p, raw, "combo");
          this.comboHitsLeft = 2;
          this.comboHitTimer = 0.42;
        } else {
          const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]);
          this.landEnemyMelee(p, raw, "jab");
          this.enemyTurnTimer = rand(2.6, 3.4) * (this.enraged ? 0.7 : 1);
        }
        this.enemyTelling = false;
      }
      return;
    }

    // --- Between turns: countdown and pick next move ---
    this.enemyTurnTimer -= dt;
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
        this.pushLog(this.enemy.flavorCombo || `${this.enemy.name} readies a TRIPLE STRIKE! BRACE (F)!`);
      } else {
        this.enemyTellTime = 0.9 + p.dodgeWindow * 0.8;
        this.pushLog(this.enemy.name + " winds up a strike! BRACE (F)!");
      }
      this.enemyTellTime = Math.max(0.3, this.enemyTellTime);
    }
  }

  handleMenu(dt, game) {
    if (this.turnLocked > 0) {
      this.turnLocked -= dt;
      return;
    }
    const p = game.player;

    if (game.input.wasPressed("ArrowUp", "w")) { this.menuIdx = (this.menuIdx + 3) % 4; SFX.click(); }
    if (game.input.wasPressed("ArrowDown", "s")) { this.menuIdx = (this.menuIdx + 1) % 4; SFX.click(); }

    const choose = (idx) => { this.menuIdx = idx; this.execute(idx, p, game); };

    // v0.13: Q/E/R/F are alternate keybinds for the four actions. This
    // matches the new TongueBossScene layout and keeps your hand on the
    // left-hand home row while the right hand works the mouse.
    if      (game.input.wasPressed("1", "q")) choose(0);
    else if (game.input.wasPressed("2", "e")) choose(1);
    else if (game.input.wasPressed("3", "r")) choose(2);
    else if (game.input.wasPressed("4", "f")) choose(3);
    else if (game.input.wasPressed(" ", "Space", "Enter")) choose(this.menuIdx);
  }

  execute(idx, p, game) {
    const l = p.loadout;
    const pm = p.pactMods || {};
    switch (idx) {
      case 0: {
        if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${l.attack.name} is recharging...`); return; }
        if (p.mana < l.attack.manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= l.attack.manaCost;
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
          hexMark: !!l.attack.hexMark,
        };
        this.dealToEnemy(dmg, l.attack.name, l.attack.sfx, p, opts);
        this.turnLocked = 0.28;
        break;
      }
      case 1: {
        if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is recharging...`); return; }
        if (p.mana < l.special.manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= l.special.manaCost;
        p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
        const dmg = randInt(l.special.dmg[0], l.special.dmg[1]);
        const opts = {
          kind: "special",
          multiLane: !!l.special.multiLane,
          hexDetonate: !!l.special.hexDetonate,
        };
        this.dealToEnemy(dmg, l.special.name, l.special.sfx, p, opts);
        this.turnLocked = 0.45;
        break;
      }
      case 2: {
        p.mana = Math.min(p.manaMax, p.mana + 8);
        this.pushLog("You roll! Caught your breath (+8 MP).");
        SFX.dodge();
        this.turnLocked = 0.22;
        break;
      }
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
  rollHitDamage(rawDmg, { kind = "attack", consumeMarks = false, counterOn = false } = {}, p = null) {
    const pm = (p && p.pactMods) || {};
    const mult = this.matchupMult || 1;
    const counterMult = counterOn ? (pm.counterMult || 1.5) : 1;
    // Basic / special slant
    const kindMult = kind === "special"
      ? (pm.specialDmgMult || 1)
      : (pm.attackDmgMult || 1);
    const dmgMult = pm.dmgMult || 1;
    // Execute bonus - below HP threshold, damage spikes.
    const hpFrac = this.enemy.hp / this.enemy.hpMax;
    const execOn = pm.executeThreshold && hpFrac <= pm.executeThreshold;
    const execMult = execOn ? (pm.executeBonus || 1) : 1;
    // Random crit from pacts (devastating multiplier treated like matchup).
    const isCrit = (pm.critChance || 0) > 0 && Math.random() < (pm.critChance || 0);
    const critMult = isCrit ? 1.6 : 1;
    // Hex marks: the HEX STAFF special detonates all current marks for a
    // +20% burst per mark (then clears them). Attacks only CONSUME marks
    // (consume up to 3 of them into a +20%/each buff on the current hit).
    let markMult = 1;
    if (this.hexMarks > 0) {
      markMult = 1 + (consumeMarks ? this.hexMarks * 0.6 : Math.min(this.hexMarks, 1) * 0.2);
    }
    const dmg = Math.max(1, Math.round(
      rawDmg * mult * counterMult * kindMult * dmgMult * execMult * critMult * markMult,
    ));
    return { dmg, isCrit, execOn, consumedMarks: consumeMarks ? this.hexMarks : 0 };
  }

  dealToEnemy(rawDmg, name, sfx, p = null, opts = {}) {
    const multiLane = !!opts.multiLane;
    const hexMark   = !!opts.hexMark;
    const hexDet    = !!opts.hexDetonate;

    const hadCounter = this.perfectBraceReady;
    this.perfectBraceReady = false;
    if (hadCounter && p && p.score) p.score.counterStrikes++;

    // --- Multi-lane (BILE WHIP) ---
    // Fire three separate damage events at reduced damage each. The total is
    // balanced similar to a single hit but triggers 3 marks / 3 shield breaks
    // / 3 poison stacks - very strong against SHIELDED elites.
    if (multiLane) {
      const LANE_OFFS = [-160, 0, 160];
      let firstRoll = true;
      for (let i = 0; i < LANE_OFFS.length; i++) {
        const { dmg, isCrit, execOn } = this.rollHitDamage(rawDmg, {
          kind: opts.kind, counterOn: firstRoll && hadCounter,
        }, p);
        firstRoll = false;
        this.applyHit(dmg, {
          name: i === 0 ? name : `${name} (lane ${i + 1})`,
          sfx,
          p,
          hadCounter: i === 0 && hadCounter,
          isCrit, execOn,
          lane: i,
          laneX: W / 2 + LANE_OFFS[i],
        });
        // Each lane arms a shield-break event against shielded elites.
        if (this.enemy && this.enemy.shielded) this.enemy.perfectBraceHits = 0;
      }
      this.applyOnHitEffects(p, { hexMark, hexDet });
      SFX[sfx] ? SFX[sfx]() : SFX.hit();
      return;
    }

    // --- Hex staff detonate: consume all marks as a big single hit. ---
    // --- Default single-lane hit ---
    const { dmg, isCrit, execOn, consumedMarks } = this.rollHitDamage(rawDmg, {
      kind: opts.kind, consumeMarks: hexDet, counterOn: hadCounter,
    }, p);
    this.applyHit(dmg, { name, sfx, p, hadCounter, isCrit, execOn, consumedMarks });
    this.applyOnHitEffects(p, { hexMark, hexDet });
    SFX[sfx] ? SFX[sfx]() : SFX.hit();
  }

  // Centralized "a damage number actually lands" path. Handles enemy HP,
  // log line, shake, particles, floater, blood decals, shield-break counter.
  applyHit(dmg, { name, hadCounter, isCrit, execOn, consumedMarks, lane, laneX, p }) {
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
    this.pushLog(line);

    // Feedback
    screenShake(mult > 1 ? 9 : 5, 0.15);
    const burstColor = isCrit ? "#ff40c0"
      : (mult > 1 ? "#ffd966" : (mult < 1 ? "#8a9aff" : COLORS.blood));
    this.particles.burst(laneX ?? W / 2, FLOOR_Y - 200, burstColor,
      mult > 1 ? 28 : 16, mult > 1 ? 280 : 220, 0.55);

    // Floating damage number (each lane gets its own spot).
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
  }

  // Post-hit side effects: poison (VIPER / HEX-EYED pact), hex marks, hex
  // detonate (consumes marks). Called once per attack regardless of multi-lane.
  applyOnHitEffects(p, { hexMark, hexDet }) {
    const pm = (p && p.pactMods) || {};
    const poisonPct  = pm.poisonPct  ?? 0;
    const poisonTime = pm.poisonTime ?? 0;
    if (poisonPct > 0 && poisonTime > 0) {
      // Refresh duration on stack; damage does not stack.
      this.enemy.poisonT = Math.max(this.enemy.poisonT || 0, poisonTime);
      this.enemy.poisonDps = Math.max(this.enemy.poisonDps || 0,
        poisonPct * this.enemy.hpMax);
      this.poisonFlashT = 0.6;
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

    drawFleshBackground(ctx, this.t, ch.wormTint * 1.05, ch.palette);
    drawVeins(ctx, this.t, this.chamberIdx + 5);

    this.drawSphincter(ctx);
    this.drawEnemy(ctx);
    this.drawLanes(ctx);

    for (const tg of this.telegraphs) this.drawTelegraph(ctx, tg);
    for (const g of this.gouts) this.drawGout(ctx, g);

    // Hero
    ctx.save();
    ctx.translate(this.heroX, HERO_Y);
    ctx.scale(2.8, 2.8);
    drawHero(ctx, 0, 0, 1, this.anim, p.buildId);
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
    if (this.paused) this.drawPause(ctx);
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

  drawEnemy(ctx) {
    const cx = W / 2;
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
    for (let i = 0; i < 3; i++) {
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
    drawText(ctx, this.enemy.name, W - 148, pad + 16, {
      size: 16, color: this.eliteKill ? COLORS.gold : COLORS.bile,
      align: "center", bold: true,
      glow: this.eliteKill ? COLORS.gold : null,
      maxWidth: 248,
    });
    // HP bar right below the name.
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemy.hp / this.enemy.hpMax, {
      fill: "#4a1010",
      label: null,
    });
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemyHpDisplay / this.enemy.hpMax, {
      fill: this.enemy.color,
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

    // Bottom menu + log
    this.drawMenu(ctx, game);
    this.drawLog(ctx);

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

    // Enrage flash across the top of the screen.
    if (this.enrageFlashT > 0) {
      const a = Math.min(1, this.enrageFlashT / 1.4);
      ctx.save();
      ctx.globalAlpha = a;
      drawBanner(ctx, "ENRAGED!", W / 2, 90, 36, "#ff5050", "#400010");
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
    } else if (p.cooldowns.attack <= 0 || p.cooldowns.special <= 0) {
      text = "YOUR TURN - ATTACK!"; color = "#b5f05a"; glow = "#2a6a00";
    } else {
      text = "ON COOLDOWN - DODGE / BRACE"; color = "#7fc0ff"; glow = "#1a4080";
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
        hint = { text: "[F/4] BRACE to cover all three hits!", color: "#fff0a0" };
      } else {
        hint = { text: "[A]/[D] to dodge lanes OR [F/4] BRACE", color: "#ffc0c0" };
      }
    } else if (this.comboHitsLeft > 0) {
      hint = { text: `[F/4] BRACE NOW - ${this.comboHitsLeft} hit(s) left!`, color: "#fff0a0" };
    } else if (this.perfectBraceReady) {
      hint = { text: "Press [Q/1] or [E/2] to CASH IN your counter!", color: "#ffd966" };
    } else if (this.telegraphs.some((tg) => tg.lane === this.lane && tg.t >= tg.wait - 0.45)) {
      hint = { text: "ACID LANDING ON YOU - [A]/[D] dodge!", color: "#bfff00" };
    } else if (p.hp / p.hpMax < 0.35) {
      hint = { text: "Low HP! [R/3] Dodge for MP, [F/4] Brace for safety", color: "#ffa0a0" };
    } else if (p.cooldowns.attack <= 0 && p.mana >= l.attack.manaCost) {
      hint = { text: `[Q/1] ${l.attack.name}  -  [E/2] ${l.special.name}  -  dodge with [A]/[D]`, color: "#c8ffc0" };
    } else if (p.mana < l.attack.manaCost) {
      hint = { text: "Out of MP! Press [R/3] Dodge Roll to recover.", color: "#7fc0ff" };
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
    const x = 16, y = H - 190;
    const w = 560, h = 174;
    drawPanel(ctx, x, y, w, h);
    drawText(ctx, "ACTIONS", x + 14, y + 12, { size: 13, color: COLORS.boneDim });

    const items = [
      { key: "Q/1", name: l.attack.name,
        info: `DMG ${l.attack.dmg[0]}-${l.attack.dmg[1]}  MP ${l.attack.manaCost}`,
        cd: p.cooldowns.attack,
        locked: p.cooldowns.attack > 0 || p.mana < l.attack.manaCost,
        cdMax: l.attack.cooldown,
      },
      { key: "E/2", name: l.special.name,
        info: `DMG ${l.special.dmg[0]}-${l.special.dmg[1]}  MP ${l.special.manaCost}`,
        cd: p.cooldowns.special,
        locked: p.cooldowns.special > 0 || p.mana < l.special.manaCost,
        cdMax: l.special.cooldown,
      },
      { key: "R/3", name: "Dodge Roll", info: "+8 MP, reposition", cd: 0, locked: false, cdMax: 0 },
      { key: "F/4", name: "Brace",      info: "Reduce next hit. Time it late for +50% counter!", cd: 0, locked: false, cdMax: 0 },
    ];

    items.forEach((it, i) => {
      const row = y + 38 + i * 30;
      const selected = i === this.menuIdx;
      if (selected) {
        ctx.fillStyle = "rgba(155, 255, 102, 0.14)";
        ctx.fillRect(x + 4, row - 5, w - 8, 28);
        // Accent left edge
        ctx.fillStyle = COLORS.bile;
        ctx.fillRect(x + 4, row - 5, 3, 28);
      }
      const col = it.locked ? COLORS.boneDim : (selected ? COLORS.bile : COLORS.bone);
      // Reserve space for the cooldown bar (90px) when it exists, plus
      // padding, so the info column truncates cleanly instead of spilling
      // into the bar.
      const cdReserve = it.cdMax > 0 ? 110 : 16;
      const nameMax = 240 - 74 - 6;
      const infoMax = w - 240 - cdReserve;
      drawText(ctx, `[${it.key}]`, x + 14, row, { size: 13, color: col, bold: true });
      drawText(ctx, it.name,      x + 74, row, {
        size: 14, color: col, bold: selected, maxWidth: nameMax,
      });
      drawText(ctx, it.info,      x + 240, row, {
        size: 12, color: COLORS.boneDim, maxWidth: infoMax,
      });
      // Cooldown bar (if applicable)
      if (it.cdMax > 0) {
        const bw = 90;
        const bx = x + w - bw - 14;
        drawBar(ctx, bx, row - 2, bw, 14, it.cd > 0 ? 1 - it.cd / it.cdMax : 1, {
          fill: it.cd > 0 ? "#5a6a7a" : COLORS.bile,
          label: it.cd > 0 ? `${it.cd.toFixed(1)}s` : "READY",
          labelColor: "#111",
        });
      }
    });
  }

  drawLog(ctx) {
    const x = W - 576, y = H - 190;
    const w = 560, h = 174;
    drawPanel(ctx, x, y, w, h);
    drawText(ctx, "COMBAT LOG", x + 14, y + 12, { size: 13, color: COLORS.boneDim });
    this.log.forEach((line, i) => {
      drawText(ctx, line, x + 14, y + 40 + i * 26, {
        size: 13, color: COLORS.bone,
        maxWidth: w - 28,
      });
    });
    // v0.14 legibility: help string trimmed to fit inside the 560-wide
    // panel so it never runs off the bottom-right of the screen.
    drawText(ctx,
      "[Q/1] Attack  [E/2] Special  [R/3] Dodge  [F/4] Brace  -  [A]/[D] Lane  [P] Pause",
      x + 14, y + h - 22,
      { size: 12, color: COLORS.bone, maxWidth: w - 28 });
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

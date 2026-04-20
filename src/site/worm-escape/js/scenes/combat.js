import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, drawBar,
  drawHero, drawSphere, drawPlate, drawDropShadow,
  ParticleSystem, screenShake, shade, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { ENEMIES } from "../content/enemies.js";
import { pick, rand, randInt } from "../engine/rng.js";
import { applyDamage, matchupMultiplier, matchupLabel } from "../content/player.js";
import { TransitionScene } from "./transition.js";
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
    this.enemy = { ...ed, hp, hpMax: hp };
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

    // Lane lerp
    const lerpSpeed = p.buildId === "swift" ? 18 : 11;
    this.heroX += (this.targetX - this.heroX) * Math.min(1, dt * lerpSpeed);

    // Lane swapping (cooldown by build)
    this.laneCd -= dt;
    if (this.laneCd <= 0) {
      if (game.input.isDown("ArrowLeft", "a") && this.lane > 0) {
        this.lane--;
        this.targetX = LANES[this.lane];
        this.laneCd = p.laneSwapCd;
        SFX.dodge();
      } else if (game.input.isDown("ArrowRight", "d") && this.lane < 2) {
        this.lane++;
        this.targetX = LANES[this.lane];
        this.laneCd = p.laneSwapCd;
        SFX.dodge();
      }
    }

    // Acid timer keeps ticking in combat too, and the corrosion itself
    // scales with chamber difficulty.
    const corrScale = CHAMBER_DMG_SCALE[this.chamberIdx] || 1;
    p.acidTimer -= dt * p.acidResist;
    if (p.acidTimer <= 0) {
      if (p.armor > 0) p.armor = Math.max(0, p.armor - 4 * corrScale * dt);
      else { p.hp -= 2 * corrScale * dt; this.hitFlash = Math.max(this.hitFlash, 0.15); }
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
      this.winTimer = 2.2;
    }
    if (this.phase === "win") {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        this.done = true;
        game.scenes.replace(new TransitionScene(this.chamberIdx), game);
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
      if (move === "heavy") {
        this.enemyTellTime = 1.6 + p.dodgeWindow * 0.6;
        this.pushLog(this.enemy.flavorHeavy || `${this.enemy.name} winds up a HEAVY slam! BRACE (4)!`);
      } else if (move === "combo") {
        this.enemyTellTime = 0.8 + p.dodgeWindow * 0.6;
        this.pushLog(this.enemy.flavorCombo || `${this.enemy.name} readies a TRIPLE STRIKE! BRACE (4)!`);
      } else {
        this.enemyTellTime = 0.9 + p.dodgeWindow * 0.8;
        this.pushLog(this.enemy.name + " winds up a strike! BRACE (4)!");
      }
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

    if (game.input.wasPressed("1")) choose(0);
    else if (game.input.wasPressed("2")) choose(1);
    else if (game.input.wasPressed("3")) choose(2);
    else if (game.input.wasPressed("4")) choose(3);
    else if (game.input.wasPressed(" ", "Space", "Enter")) choose(this.menuIdx);
  }

  execute(idx, p, game) {
    const l = p.loadout;
    switch (idx) {
      case 0: {
        if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${l.attack.name} is recharging...`); return; }
        if (p.mana < l.attack.manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= l.attack.manaCost;
        p.cooldowns.attack = l.attack.cooldown;
        const dmg = randInt(l.attack.dmg[0], l.attack.dmg[1]);
        this.dealToEnemy(dmg, l.attack.name, l.attack.sfx);
        this.turnLocked = 0.28;
        break;
      }
      case 1: {
        if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is recharging...`); return; }
        if (p.mana < l.special.manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= l.special.manaCost;
        p.cooldowns.special = l.special.cooldown;
        const dmg = randInt(l.special.dmg[0], l.special.dmg[1]);
        this.dealToEnemy(dmg, l.special.name, l.special.sfx);
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

  dealToEnemy(rawDmg, name, sfx) {
    // Weapon matchup amplifies or deflates damage.
    const mult = this.matchupMult || 1;
    // Perfect Brace counter: 50% bonus on the attack that follows a perfect brace.
    const counterBonus = this.perfectBraceReady ? 1.5 : 1;
    const dmg = Math.max(1, Math.round(rawDmg * mult * counterBonus));
    const lbl = this.matchupLabel;
    const hadCounter = this.perfectBraceReady;
    this.perfectBraceReady = false;

    this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
    this.enemyFlash = hadCounter ? 0.5 : 0.3;
    this.enemyShake = hadCounter ? 0.55 : (mult > 1 ? 0.4 : 0.22);

    // Log w/ matchup tag and counter tag.
    let line = `${name}! ${this.enemy.name} takes ${dmg} damage.`;
    if (hadCounter)       line = `COUNTER-STRIKE! ${line}`;
    else if (lbl && mult > 1) line = `${lbl.text} ${line}`;
    else if (lbl)             line = `${line} (${lbl.text})`;
    this.pushLog(line);

    // Screen / particle feedback scales with matchup.
    screenShake(mult > 1 ? 9 : 5, 0.15);
    const burstColor = mult > 1 ? "#ffd966" : (mult < 1 ? "#8a9aff" : COLORS.blood);
    this.particles.burst(W / 2, FLOOR_Y - 200, burstColor,
      mult > 1 ? 28 : 16, mult > 1 ? 280 : 220, 0.55);

    // Floating damage number.
    this.floaters.push({
      x: W / 2 + rand(-60, 60),
      y: FLOOR_Y - 240,
      vy: -70,
      life: 1.1, max: 1.1,
      text: `-${dmg}`,
      color: mult > 1 ? "#ffd966" : (mult < 1 ? "#8a9aff" : "#ffffff"),
      size: mult > 1 ? 28 : 22,
    });

    // Blood decal: 2-3 spots per hit, more on super-effective hits.
    // Positioned in enemy-local space (centered on drawEnemy origin at W/2, 340).
    const count = mult > 1 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this.bloodDecals.push({
        x: rand(-85, 85),
        y: rand(-80, 70),
        r: rand(4, 10) + (mult > 1 ? rand(2, 6) : 0),
        alpha: rand(0.55, 0.85),
      });
    }
    if (this.bloodDecals.length > 42) {
      this.bloodDecals.splice(0, this.bloodDecals.length - 42);
    }

    SFX[sfx] ? SFX[sfx]() : SFX.hit();
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
    ctx.translate(cx + sx, cy + sy);
    if (this.enemyFlash > 0) {
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 26;
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

    // Top-right: enemy HP
    drawPanel(ctx, W - 280, pad, 264, 60);
    drawText(ctx, this.enemy.name, W - 148, pad + 16, {
      size: 16, color: COLORS.bile, align: "center", bold: true,
    });
    // Background bar uses the slowly-lerping display HP for a satisfying
    // tick-down. Underneath we paint a darker "real" HP so the player can
    // still tell that damage was registered instantly.
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemy.hp / this.enemy.hpMax, {
      fill: "#4a1010",
      label: null,
    });
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemyHpDisplay / this.enemy.hpMax, {
      fill: this.enemy.color,
      label: `${Math.ceil(this.enemyHpDisplay)} / ${this.enemy.hpMax}`,
      labelColor: "#111",
    });
    // Matchup tag under the enemy name
    if (this.matchupLabel) {
      drawText(ctx, this.matchupLabel.text, W - 148, pad + 56, {
        size: 11, color: this.matchupLabel.color, align: "center", bold: true,
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
        text = "!! HEAVY SLAM - LANE DODGE WON'T SAVE YOU - BRACE (4) !!";
      } else if (move === "combo") {
        bg = `rgba(255, 220, 60, ${0.3 + pulse * 0.45})`;
        glow = "#ffd966";
        text = this.comboHitsLeft > 0
          ? `>>> TRIPLE STRIKE ${3 - this.comboHitsLeft}/3 - BRACE NOW (4) <<<`
          : "!!! TRIPLE STRIKE INCOMING - BRACE (4) !!!";
      } else {
        bg = `rgba(255, 60, 60, ${0.3 + pulse * 0.4})`;
        glow = "#ff2020";
        text = "! INCOMING STRIKE - PRESS 4 TO BRACE !";
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 130, W, 28);
      drawText(ctx, text, W / 2, 144, {
        size: 17, color: "#fff", align: "center", bold: true, glow, baseline: "middle",
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

    // Persistent "ENRAGED" badge next to enemy name once triggered.
    if (this.enraged) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
      drawText(ctx, "[ENRAGED]", W - 148, pad + 70, {
        size: 11, color: `rgba(255, ${80 + pulse * 100}, 80, 1)`,
        align: "center", bold: true, glow: "#ff2020",
      });
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
  }

  drawMenu(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    const x = 16, y = H - 190;
    const w = 560, h = 174;
    drawPanel(ctx, x, y, w, h);
    drawText(ctx, "ACTIONS", x + 14, y + 12, { size: 13, color: COLORS.boneDim });

    const items = [
      { key: "1", name: l.attack.name,
        info: `DMG ${l.attack.dmg[0]}-${l.attack.dmg[1]}  MP ${l.attack.manaCost}`,
        cd: p.cooldowns.attack,
        locked: p.cooldowns.attack > 0 || p.mana < l.attack.manaCost,
        cdMax: l.attack.cooldown,
      },
      { key: "2", name: l.special.name,
        info: `DMG ${l.special.dmg[0]}-${l.special.dmg[1]}  MP ${l.special.manaCost}`,
        cd: p.cooldowns.special,
        locked: p.cooldowns.special > 0 || p.mana < l.special.manaCost,
        cdMax: l.special.cooldown,
      },
      { key: "3", name: "Dodge Roll", info: "+8 MP, reposition", cd: 0, locked: false, cdMax: 0 },
      { key: "4", name: "Brace",      info: "Reduce next hit. Time it late for +50% counter!", cd: 0, locked: false, cdMax: 0 },
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
      drawText(ctx, `[${it.key}]`, x + 14, row, { size: 14, color: col, bold: true });
      drawText(ctx, it.name,      x + 54, row, { size: 14, color: col, bold: selected });
      drawText(ctx, it.info,      x + 230, row, { size: 11, color: COLORS.boneDim });
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
      });
    });
    drawText(ctx, "1-4 actions   A/D dodge lanes   P/ESC pause", x + 14, y + h - 22, {
      size: 11, color: COLORS.boneDim,
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

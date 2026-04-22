import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawText, drawBanner, drawPanel, drawBar,
  drawHero, drawSphere, drawDropShadow,
  ParticleSystem, screenShake, shade, roundRect,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { ENEMIES } from "../content/enemies.js";
import { pick, rand, randInt } from "../engine/rng.js";
import {
  applyDamage, matchupMultiplier, matchupLabel,
  recordDirectHpHit, recordDirectArmorHit,
} from "../content/player.js";
import { VictoryScene } from "./victory.js";
import { GameOverScene } from "./gameover.js";

// =====================================================================
//  v0.13 FINAL BOSS - The Worm's Tongue (aim-reticle puzzle)
// =====================================================================
// Instead of lane-dodging, the player steers a MOUSE RETICLE. To land
// an attack, the reticle must be inside the green TARGET ZONE - a
// circle that drifts around the tongue tip. Every few seconds a RED
// LASH ZONE appears at a random point on screen; if the reticle is
// still inside it when the warning timer expires, the player eats a
// tongue slap (brace mitigates). Clear the tongue's huge HP pool
// before the chamber's dedicated acid-timer runs out.
//
// Keybinds (this scene AND CombatScene share the new alias set):
//   [Q] / [1]  Attack
//   [E] / [2]  Special
//   [R] / [3]  Dodge  (recovers MP + briefly snaps aim to safe edge)
//   [F] / [4]  Brace  (halves the next tongue lash; perfect-brace bonus)
//   [MOUSE]    Move the reticle.
//   Clicking anywhere is equivalent to pressing [Q] (basic attack).
// =====================================================================

const FLOOR_Y = 620;
// Where the tongue's root sits (its mouth base). Centered horizontally.
const TONGUE_ROOT = { x: W / 2, y: 470 };
// Default tongue-tip rest position above the root.
const TONGUE_TIP  = { x: W / 2, y: 280 };

// Damage scale for the final chamber. The tongue is already huge in HP
// and everything hurts - keep its damage just below the Gullet ceiling
// so a skilled player can bring it down before dying.
const CHAMBER_DMG_SCALE = 1.45;

export class TongueBossScene {
  constructor(chamberIdx) {
    this.chamberIdx = chamberIdx;
    this.chamber = CHAMBERS[chamberIdx];
    const ed = ENEMIES[this.chamber.guardian];
    // Boss HP is fixed (doesn't scale with chamberIdx beyond its own spec).
    const hp = ed.hp;
    this.enemy = {
      ...ed, hp, hpMax: hp,
      attackDmg: [...ed.attackDmg],
      heavyDmg:  [...ed.heavyDmg],
    };
    this.enemyHpDisplay = hp;

    this.t = 0;
    this.anim = 0;
    this.done = false;

    // --- Reticle state ---
    // Mouse position is streamed into reticleX/Y from game.input.mouse*.
    // Initial position: dead-center so the first frame isn't at (0,0).
    this.reticleX = W / 2;
    this.reticleY = TONGUE_TIP.y;
    this.reticleTrail = [];
    this.recentlyLocked = false;    // flipped each frame for UI pulse

    // --- Target zone (green aim-lock circle that drifts) ---
    this.zone = {
      x: TONGUE_TIP.x,
      y: TONGUE_TIP.y,
      r: 110,
      // Smooth wandering velocities recomputed every ~1.2s.
      vx: 0, vy: 0,
      nextDriftT: 0,
    };

    // --- Lash zones (red warning circles the player must flee) ---
    this.lashes = [];
    this.lashTimer = rand(3.2, 4.4);
    // "Heavy" tongue attack that ignores aim position - full-screen
    // telegraph, only brace helps. Fires less frequently than lashes.
    this.heavyTimer = rand(8.0, 11.0);
    this.heavyTelling = false;
    this.heavyTellTime = 0;

    // --- Player combat state (shared vocabulary with CombatScene) ---
    this.hitFlash = 0;
    this.enemyFlash = 0;
    this.enemyShake = 0;
    this.braceTime = 0;
    this.perfectBraceReady = false;
    this.perfectFlashT = 0;
    this.missFlashT = 0;
    this.lockFlashT = 0;
    this.dodgeFlashT = 0;
    this.turnLocked = 0;

    // --- Tongue wobble ---
    // The tongue tip is a spring-damper toward tipTarget - lashes
    // temporarily repoint tipTarget to a lash location for the strike
    // animation, then snap back.
    this.tipTarget = { x: TONGUE_TIP.x, y: TONGUE_TIP.y };
    this.tipPos    = { x: TONGUE_TIP.x, y: TONGUE_TIP.y };
    this.tipVel    = { x: 0, y: 0 };

    // --- Enrage (used for UI + cadence tightening) ---
    this.enraged = false;
    this.enrageFlashT = 0;

    // --- Log + banners ---
    this.log = [];
    this.phase = "intro";
    this.introT = 0;
    this.winTimer = 0;
    this.paused = false;
    this.particles = new ParticleSystem();
    this.floaters = [];
    this.bloodDecals = [];

    this.pushLog("The MAW opens. Daylight pours in.");
    this.pushLog(this.enemy.flavorIntro);

    // Cached click-to-attack input (action 0).
    this._attackBuffer = false;
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 4) this.log.shift();
  }

  enter(game) {
    const p = game.player;
    const mult = matchupMultiplier(p.loadoutId, "tongue");
    const lbl = matchupLabel(mult);
    this.matchupMult = mult;
    this.matchupLabel = lbl;
    if (lbl) {
      if (mult > 1) {
        this.pushLog(`Your ${p.loadout.name} looks ${lbl.text} against the tongue!`);
      } else {
        this.pushLog(`Your ${p.loadout.name} feels ${lbl.text.toLowerCase()} here...`);
      }
    } else {
      this.pushLog(`Your ${p.loadout.name} matches up evenly. Aim carefully.`);
    }
  }

  // --- Helpers ---

  reticleInZone() {
    const dx = this.reticleX - this.zone.x;
    const dy = this.reticleY - this.zone.y;
    return dx * dx + dy * dy <= this.zone.r * this.zone.r;
  }

  // Is the reticle currently inside the red region of ANY lash?
  reticleInAnyLash() {
    for (const L of this.lashes) {
      if (L.fired) continue;
      const dx = this.reticleX - L.x;
      const dy = this.reticleY - L.y;
      if (dx * dx + dy * dy <= L.r * L.r) return true;
    }
    return false;
  }

  // ================== UPDATE ==================
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

    // Stream mouse into reticle (clamped to canvas).
    const m = game.input;
    if (typeof m.mouseX === "number") {
      this.reticleX = Math.max(0, Math.min(W, m.mouseX));
      this.reticleY = Math.max(0, Math.min(H, m.mouseY));
    }
    // Trail for the reticle so it leaves a soft comet-tail.
    this.reticleTrail.push({ x: this.reticleX, y: this.reticleY, t: 0 });
    if (this.reticleTrail.length > 14) this.reticleTrail.shift();
    for (const r of this.reticleTrail) r.t += dt;

    // Acid timer keeps ticking (same as combat).
    p.acidTimer -= dt * p.acidResist;
    if (p.acidTimer <= 0) {
      if (p.armor > 0) {
        const lost = Math.min(p.armor, 4 * CHAMBER_DMG_SCALE * dt);
        p.armor = Math.max(0, p.armor - lost);
        recordDirectArmorHit(p, lost, { countAsHit: false });
      } else {
        const lost = 2 * CHAMBER_DMG_SCALE * dt;
        p.hp -= lost;
        recordDirectHpHit(p, lost, { countAsHit: false });
        this.hitFlash = Math.max(this.hitFlash, 0.15);
      }
    }

    if (this.phase === "intro") {
      this.introT += dt;
      if (this.introT > 1.8) this.phase = "fight";
    }

    if (this.phase === "fight") {
      this.updateCooldowns(dt, p);
      this.updateZone(dt);
      this.updateTongueTip(dt);
      this.updateLashes(dt, p);
      this.updateHeavy(dt, p);
      this.handleInput(dt, game);
    }

    if (this.braceTime > 0) this.braceTime -= dt;
    if (this.hitFlash > 0)   this.hitFlash   = Math.max(0, this.hitFlash - dt);
    if (this.enemyFlash > 0) this.enemyFlash = Math.max(0, this.enemyFlash - dt);
    if (this.enemyShake > 0) this.enemyShake -= dt;
    if (this.enrageFlashT > 0) this.enrageFlashT = Math.max(0, this.enrageFlashT - dt);
    if (this.perfectFlashT > 0) this.perfectFlashT = Math.max(0, this.perfectFlashT - dt);
    if (this.missFlashT > 0)    this.missFlashT    = Math.max(0, this.missFlashT - dt);
    if (this.lockFlashT > 0)    this.lockFlashT    = Math.max(0, this.lockFlashT - dt);
    if (this.dodgeFlashT > 0)   this.dodgeFlashT   = Math.max(0, this.dodgeFlashT - dt);

    // HP bar tick-down.
    const hpLerp = Math.min(1, dt * 5.5);
    this.enemyHpDisplay += (this.enemy.hp - this.enemyHpDisplay) * hpLerp;

    // Floaters.
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy += 40 * dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.particles.update(dt);

    // Enrage trigger.
    if (!this.enraged && this.enemy.hp > 0
        && this.enemy.hp < this.enemy.hpMax * (this.enemy.enrageAt || 0.4)) {
      this.enraged = true;
      this.enrageFlashT = 1.4;
      this.pushLog("!! THE TONGUE SNARLS - IT'S ENRAGED !!");
      SFX.thud();
      screenShake(14, 0.4);
      this.particles.burst(W / 2, TONGUE_ROOT.y - 60, "#ff3060", 40, 320, 0.9);
      // Enrage immediately shrinks the zone and quickens its drift.
      this.zone.r = 85;
    }

    if (p.hp <= 0) {
      this.done = true;
      SFX.die();
      game.scenes.replace(new GameOverScene("The tongue flicked you down its own throat."), game);
      return;
    }

    if (this.enemy.hp <= 0 && this.phase === "fight") {
      this.phase = "win";
      SFX.victory();
      this.pushLog(this.enemy.flavorDeath);
      screenShake(14, 0.5);
      this.particles.burst(TONGUE_ROOT.x, TONGUE_ROOT.y - 80, COLORS.bile, 70, 400, 1.2);
      if (p.score) {
        p.score.bossesDefeated++;
        p.score.chambersCleared++;
      }
      this.winTimer = 2.6;
    }
    if (this.phase === "win") {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        this.done = true;
        // Final boss: skip pacts + transition, go straight to victory.
        game.scenes.replace(new VictoryScene(), game);
      }
    }
  }

  updateCooldowns(dt, p) {
    p.cooldowns.attack  = Math.max(0, p.cooldowns.attack  - dt);
    p.cooldowns.special = Math.max(0, p.cooldowns.special - dt);
  }

  updateZone(dt) {
    // Drift the aim zone using a wandering vector that resets every ~1.2s.
    this.zone.nextDriftT -= dt;
    if (this.zone.nextDriftT <= 0) {
      this.zone.nextDriftT = rand(0.9, 1.4);
      const speedBase = this.enraged ? 95 : 60;
      const a = rand(0, Math.PI * 2);
      this.zone.vx = Math.cos(a) * speedBase;
      this.zone.vy = Math.sin(a) * speedBase * 0.7;
    }
    this.zone.x += this.zone.vx * dt;
    this.zone.y += this.zone.vy * dt;
    // Keep zone near the upper half of the screen (where the tongue is).
    const boundL = 240, boundR = W - 240, boundT = 140, boundB = 520;
    if (this.zone.x < boundL) { this.zone.x = boundL; this.zone.vx = Math.abs(this.zone.vx); }
    if (this.zone.x > boundR) { this.zone.x = boundR; this.zone.vx = -Math.abs(this.zone.vx); }
    if (this.zone.y < boundT) { this.zone.y = boundT; this.zone.vy = Math.abs(this.zone.vy); }
    if (this.zone.y > boundB) { this.zone.y = boundB; this.zone.vy = -Math.abs(this.zone.vy); }
  }

  // Spring tongue tip position toward its current target (either its
  // rest position or the latest lash-strike location).
  updateTongueTip(dt) {
    const k = 14, c = 6;
    const ax = (this.tipTarget.x - this.tipPos.x) * k - this.tipVel.x * c;
    const ay = (this.tipTarget.y - this.tipPos.y) * k - this.tipVel.y * c;
    this.tipVel.x += ax * dt;
    this.tipVel.y += ay * dt;
    this.tipPos.x += this.tipVel.x * dt;
    this.tipPos.y += this.tipVel.y * dt;
    // Slowly pull target back to rest when no lash is active.
    if (this.lashes.every((L) => L.fired || L.t < 0.4)) {
      this.tipTarget.x += (TONGUE_TIP.x - this.tipTarget.x) * dt * 2;
      this.tipTarget.y += (TONGUE_TIP.y - this.tipTarget.y) * dt * 2;
    }
  }

  updateLashes(dt, p) {
    this.lashTimer -= dt;
    if (this.lashTimer <= 0) {
      const cadence = this.enraged ? [1.6, 2.6] : [2.8, 4.0];
      this.lashTimer = rand(cadence[0], cadence[1]);
      this.spawnLash(p);
    }

    for (const L of this.lashes) {
      L.t += dt;
      if (!L.fired && L.t >= L.wait) {
        L.fired = true;
        this.resolveLash(L, p);
      }
    }
    this.lashes = this.lashes.filter((L) => !L.fired || L.t < L.wait + 0.6);
  }

  spawnLash(p) {
    // Lash tries to land NEAR the current reticle so you HAVE to move.
    // It biases 60% "where you're aiming" and 40% random, so you can't
    // just always stare at the green zone and expect safety.
    const biasReticle = Math.random() < 0.6;
    const x = biasReticle
      ? this.reticleX + rand(-60, 60)
      : rand(260, W - 260);
    const y = biasReticle
      ? this.reticleY + rand(-40, 40)
      : rand(200, 520);
    const r = this.enraged ? rand(120, 150) : rand(130, 170);
    const wait = (this.enraged ? 0.9 : 1.25) + p.dodgeWindow * 0.3;
    this.lashes.push({ x, y, r, t: 0, wait, fired: false });
    // Move tongue tip toward the lash - it's charging up.
    this.tipTarget.x = x;
    this.tipTarget.y = y - 20;
  }

  resolveLash(L, p) {
    // Snap the tongue tip to the lash at the moment of impact.
    this.tipTarget.x = L.x;
    this.tipTarget.y = L.y;
    this.tipVel.x *= 0.2; this.tipVel.y *= 0.2;
    const dx = this.reticleX - L.x, dy = this.reticleY - L.y;
    const inside = dx * dx + dy * dy <= L.r * L.r;
    if (!inside) {
      this.pushLog("You juke the tongue - it slaps empty air!");
      this.particles.burst(L.x, L.y, "#ffc0c8", 14, 180, 0.5);
      SFX.dodge();
      return;
    }
    // Hit. Brace halves; perfect-brace readies counter.
    const raw = randInt(this.enemy.attackDmg[0], this.enemy.attackDmg[1]);
    let dmg = Math.round(raw * CHAMBER_DMG_SCALE * (this.enraged ? 1.2 : 1));
    let braceNote = "";
    if (this.braceTime > 0) {
      dmg = Math.floor(dmg * 0.35);
      braceNote = "(BRACED) ";
    }
    const { armorTaken, hpTaken } = applyDamage(p, dmg);
    this.hitFlash = 0.5;
    SFX.hit();
    screenShake(12, 0.35);
    this.particles.burst(L.x, L.y, "#ff6b8a", 28, 260, 0.7);
    const line = braceNote + pick(this.enemy.flavorHit)
      + ` (-${Math.ceil(hpTaken)} HP${armorTaken ? `, -${Math.ceil(armorTaken)} ARM` : ""})`;
    this.pushLog(line);
  }

  updateHeavy(dt, p) {
    if (this.heavyTelling) {
      this.heavyTellTime -= dt;
      if (this.heavyTellTime <= 0) {
        this.heavyTelling = false;
        const raw = randInt(this.enemy.heavyDmg[0], this.enemy.heavyDmg[1]);
        let dmg = Math.round(raw * CHAMBER_DMG_SCALE * (this.enraged ? 1.2 : 1));
        let braced = false;
        if (this.braceTime > 0) { dmg = Math.floor(dmg * 0.35); braced = true; }
        const { armorTaken, hpTaken } = applyDamage(p, dmg);
        this.hitFlash = 0.8;
        SFX.thud();
        screenShake(20, 0.55);
        this.particles.burst(W / 2, TONGUE_ROOT.y - 60, "#ff8040", 42, 380, 0.9);
        const prefix = braced ? "(BRACED) HEAVY CURL! " : "HEAVY CURL! ";
        this.pushLog(prefix + (this.enemy.flavorHeavy || "The tongue batters you!")
          + ` (-${Math.ceil(hpTaken)} HP${armorTaken ? `, -${Math.ceil(armorTaken)} ARM` : ""})`);
        this.heavyTimer = rand(this.enraged ? 5.5 : 9.0, this.enraged ? 8.0 : 12.0);
      }
      return;
    }
    this.heavyTimer -= dt;
    if (this.heavyTimer <= 0) {
      this.heavyTelling = true;
      this.heavyTellTime = (this.enraged ? 1.4 : 2.0) + p.dodgeWindow * 0.3;
      this.pushLog(this.enemy.flavorHeavy || "The tongue COILS BACK - BRACE!");
    }
  }

  handleInput(dt, game) {
    if (this.turnLocked > 0) { this.turnLocked -= dt; return; }
    const p = game.player;

    // Click anywhere = attack (action 0). Buffered so mousedown doesn't
    // require a companion keypress.
    if (game.input.wasPressed("Mouse0")) this.execute(0, p, game);

    // Keyboard actions. BOTH the new QERF aliases and the legacy 1-4.
    if      (game.input.wasPressed("q", "1")) this.execute(0, p, game);
    else if (game.input.wasPressed("e", "2")) this.execute(1, p, game);
    else if (game.input.wasPressed("r", "3")) this.execute(2, p, game);
    else if (game.input.wasPressed("f", "4")) this.execute(3, p, game);
  }

  execute(idx, p, game) {
    const l = p.loadout;
    const pm = p.pactMods || {};
    switch (idx) {
      case 0: {
        if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${l.attack.name} is recharging...`); return; }
        if (p.mana < l.attack.manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        if (!this.reticleInZone()) { this.missShot(l.attack.name); return; }
        p.mana -= l.attack.manaCost;
        p.cooldowns.attack = l.attack.cooldown * (pm.attackCdMult || 1);
        const raw = randInt(l.attack.dmg[0], l.attack.dmg[1]);
        this.landShot(raw, l.attack.name, l.attack.sfx, p, "attack");
        this.turnLocked = 0.22;
        break;
      }
      case 1: {
        if (p.cooldowns.special > 0) { SFX.deny(); this.pushLog(`${l.special.name} is recharging...`); return; }
        if (p.mana < l.special.manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        if (!this.reticleInZone()) { this.missShot(l.special.name); return; }
        p.mana -= l.special.manaCost;
        p.cooldowns.special = l.special.cooldown * (pm.specialCdMult || 1);
        const raw = randInt(l.special.dmg[0], l.special.dmg[1]);
        this.landShot(raw, l.special.name, l.special.sfx, p, "special");
        this.turnLocked = 0.38;
        break;
      }
      case 2: {
        // Dodge roll - +MP + briefly paints a short safe-trail on the reticle.
        p.mana = Math.min(p.manaMax, p.mana + 8);
        this.pushLog("You ROLL through the maw (+8 MP).");
        SFX.dodge();
        this.dodgeFlashT = 0.6;
        this.turnLocked = 0.22;
        break;
      }
      case 3: {
        this.braceTime = 1.8;
        const perfectWindow = 0.5;
        const tellEnding = this.heavyTelling && this.heavyTellTime <= perfectWindow;
        const lashSoon   = this.lashes.some((L) => !L.fired && L.wait - L.t <= 0.35);
        if (tellEnding || lashSoon) {
          this.perfectBraceReady = true;
          this.perfectFlashT = 0.9;
          if (p.score) p.score.perfectBraces++;
          this.pushLog("PERFECT GUARD! Counter-attack queued (+50% next hit)!");
          SFX.victory();
          screenShake(4, 0.15);
          this.particles.burst(this.reticleX, this.reticleY, "#ffd966", 22, 240, 0.6);
        } else {
          this.pushLog("You BRACE. Next lash hurts less.");
          SFX.confirm();
        }
        this.turnLocked = 0.2;
        break;
      }
    }
  }

  missShot(name) {
    this.pushLog(`MISS! ${name} needs a LOCK (reticle inside circle).`);
    this.missFlashT = 0.4;
    SFX.deny();
    this.particles.burst(this.reticleX, this.reticleY, "#ff5050", 10, 140, 0.35);
  }

  // Apply an in-zone hit to the tongue.
  landShot(rawDmg, name, sfx, p, kind) {
    const pm = p.pactMods || {};
    const mult = this.matchupMult || 1;
    const hadCounter = this.perfectBraceReady;
    this.perfectBraceReady = false;
    if (hadCounter && p.score) p.score.counterStrikes++;

    const counterMult = hadCounter ? (pm.counterMult || 1.5) : 1;
    const kindMult = kind === "special"
      ? (pm.specialDmgMult || 1)
      : (pm.attackDmgMult || 1);
    const dmgMult = pm.dmgMult || 1;
    const isCrit = (pm.critChance || 0) > 0 && Math.random() < (pm.critChance || 0);
    const critMult = isCrit ? 1.6 : 1;
    // Aim-lock bonus: a pinpoint shot (reticle within 30% of zone center)
    // gets an extra 25% for rewarding precise aim.
    const dx = this.reticleX - this.zone.x;
    const dy = this.reticleY - this.zone.y;
    const nearness = Math.sqrt(dx * dx + dy * dy) / Math.max(1, this.zone.r);
    const bullseye = nearness < 0.3;
    const bullseyeMult = bullseye ? 1.25 : 1;

    const dmg = Math.max(1, Math.round(
      rawDmg * mult * counterMult * kindMult * dmgMult * critMult * bullseyeMult,
    ));
    this.enemy.hp = Math.max(0, this.enemy.hp - dmg);
    this.enemyFlash = hadCounter ? 0.55 : (isCrit ? 0.5 : 0.35);
    this.enemyShake = hadCounter ? 0.55 : (mult > 1 || isCrit ? 0.4 : 0.22);
    this.lockFlashT = 0.4;
    SFX[sfx] ? SFX[sfx]() : SFX.hit();
    screenShake(mult > 1 ? 9 : 5, 0.15);

    let line = `${name}! The tongue takes ${dmg}.`;
    if (hadCounter) line = `COUNTER-STRIKE! ${line}`;
    else if (isCrit) line = `CRITICAL! ${line}`;
    else if (bullseye) line = `BULLSEYE! ${line}`;
    else if (this.matchupLabel && mult > 1) line = `${this.matchupLabel.text} ${line}`;
    this.pushLog(line);

    const burstColor = isCrit ? "#ff40c0"
      : hadCounter ? "#ffd966"
      : bullseye ? "#b5f05a"
      : (mult > 1 ? "#ffd966" : "#ff80a0");
    this.particles.burst(this.reticleX, this.reticleY, burstColor,
      mult > 1 || isCrit || bullseye ? 30 : 18,
      mult > 1 || isCrit ? 280 : 220,
      0.6);

    this.floaters.push({
      x: this.reticleX + rand(-30, 30),
      y: this.reticleY - 18,
      vy: -70,
      life: 1.1, max: 1.1,
      text: isCrit ? `-${dmg}!` : `-${dmg}`,
      color: isCrit ? "#ff40c0"
        : bullseye ? "#b5f05a"
        : (mult > 1 ? "#ffd966" : "#ffffff"),
      size: mult > 1 || isCrit || bullseye ? 28 : 22,
    });

    // Blood decals at the tongue tip.
    const count = isCrit || bullseye ? 3 : 2;
    for (let i = 0; i < count; i++) {
      this.bloodDecals.push({
        x: this.tipPos.x + rand(-60, 60),
        y: this.tipPos.y + rand(-40, 30),
        r: rand(4, 10),
        alpha: rand(0.55, 0.85),
      });
    }
    if (this.bloodDecals.length > 46) {
      this.bloodDecals.splice(0, this.bloodDecals.length - 46);
    }
  }

  // ================== RENDER ==================
  render(ctx, game) {
    const ch = this.chamber;
    drawFleshBackground(ctx, this.t, ch.wormTint * 1.05, ch.palette);
    drawVeins(ctx, this.t, this.chamberIdx + 11);

    // Teeth ring around the edge of the canvas.
    this.drawTeethRing(ctx);
    // Dark throat / central maw opening.
    this.drawThroat(ctx);
    // Tongue body.
    this.drawTongue(ctx);
    // Aim zone (green lock circle).
    this.drawAimZone(ctx);
    // Lash warnings.
    for (const L of this.lashes) this.drawLash(ctx, L);
    // Particles, floaters.
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
    // Blood decals at the tongue tip area (world space).
    this.drawBloodDecals(ctx);
    // Reticle (mouse).
    this.drawReticle(ctx);

    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(194, 26, 26, ${this.hitFlash})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.phase === "intro") {
      const alpha = Math.min(1, this.introT * 2);
      ctx.globalAlpha = alpha;
      drawBanner(ctx, "THE WORM'S MAW", W / 2, 120, 44, COLORS.bile, COLORS.blood);
      drawBanner(ctx, this.enemy.name, W / 2, 168, 26, COLORS.bone, COLORS.worm);
      ctx.globalAlpha = 1;
    }
    if (this.phase === "win") {
      drawBanner(ctx, "THE MAW GAPES OPEN!", W / 2, 120, 46, COLORS.bile, COLORS.blood);
      drawBanner(ctx, "YOU LEAP FREE!", W / 2, 168, 24, COLORS.bone, COLORS.worm);
    }

    this.drawUI(ctx, game);
    if (this.paused) this.drawPause(ctx);
  }

  // --- Layered worm mouth effects ---

  drawTeethRing(ctx) {
    // Teeth are drawn as triangles along all four edges, pointing inward.
    // Slight random-but-stable jitter so the ring isn't mechanically perfect.
    ctx.save();
    const t = this.t;
    const drawTooth = (x, y, w, h, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      // Shadow / gum base
      ctx.fillStyle = "#3a0810";
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, 0);
      ctx.lineTo(w * 0.7, 0);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      // Tooth body (ivory gradient)
      const gg = ctx.createLinearGradient(-w, 0, w, h);
      gg.addColorStop(0, "#ffffff");
      gg.addColorStop(0.55, "#f6e9c4");
      gg.addColorStop(1, "#8a7238");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(-w * 0.55, 2);
      ctx.lineTo(w * 0.55, 2);
      ctx.lineTo(0, h - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Blood smear on some teeth
      ctx.fillStyle = "rgba(140, 10, 10, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.5, w * 0.25, h * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // Top row - fangs pointing DOWN.
    const topCount = 18;
    for (let i = 0; i < topCount; i++) {
      const f = (i + 0.5) / topCount;
      const x = f * W;
      const jitter = Math.sin(i * 37.1) * 5 + Math.sin(t * 0.6 + i) * 1.5;
      const w = 34 + Math.sin(i * 11.3) * 6;
      const h = 78 + Math.sin(i * 9.7) * 14 + (i % 3 === 0 ? 18 : 0);
      drawTooth(x + jitter, 0, w, h, 0);
    }
    // Bottom row - fangs pointing UP.
    const botCount = 18;
    for (let i = 0; i < botCount; i++) {
      const f = (i + 0.5) / botCount;
      const x = f * W;
      const jitter = Math.sin(i * 29.5) * 6;
      const w = 32 + Math.sin(i * 17.1) * 5;
      const h = 72 + Math.sin(i * 7.3) * 16 + (i % 4 === 0 ? 14 : 0);
      drawTooth(x + jitter, H, w, h, Math.PI);
    }
    // Left row - pointing RIGHT.
    const sideCount = 10;
    for (let i = 0; i < sideCount; i++) {
      const f = (i + 0.5) / sideCount;
      const y = f * H;
      const w = 28 + Math.sin(i * 5) * 4;
      const h = 72 + Math.sin(i * 3.1) * 10;
      drawTooth(0, y, w, h, Math.PI * 1.5);
    }
    // Right row - pointing LEFT.
    for (let i = 0; i < sideCount; i++) {
      const f = (i + 0.5) / sideCount;
      const y = f * H;
      const w = 28 + Math.sin(i * 6.1) * 4;
      const h = 72 + Math.sin(i * 4.1) * 10;
      drawTooth(W, y, w, h, Math.PI * 0.5);
    }

    // Vignette darkening toward the teeth so the center pops.
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25,
      W / 2, H / 2, Math.max(W, H) * 0.65);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(10,0,14,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  drawThroat(ctx) {
    // Dark hole behind the tongue, pulsing with the heartbeat.
    const cx = TONGUE_ROOT.x, cy = TONGUE_ROOT.y;
    const pulse = 1 + Math.sin(this.t * 2.3) * 0.04;
    const rOut = 190 * pulse;
    const rIn  = 130 * pulse;
    const g = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy, rOut);
    g.addColorStop(0, "#2a050a");
    g.addColorStop(0.55, "#100208");
    g.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rOut, rOut * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(80, 10, 30, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rIn, rIn * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Saliva strands glistening across the opening.
    ctx.strokeStyle = "rgba(240, 200, 220, 0.35)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const xa = cx - rIn * 0.8 + (i / 4) * rIn * 1.6;
      ctx.moveTo(xa, cy - rIn * 0.7);
      ctx.quadraticCurveTo(xa + Math.sin(this.t * 2 + i) * 8, cy - 10, xa + rIn * 0.05, cy + rIn * 0.75);
      ctx.stroke();
    }
  }

  drawTongue(ctx) {
    // Serpentine tongue from the root up to tipPos, drawn as layered
    // bulging ellipses with a bright pink gradient.
    const root = TONGUE_ROOT;
    const tip  = this.tipPos;
    const t = this.t;
    // Spine path - quadratic curve with a wobble through the middle.
    const mx = (root.x + tip.x) / 2 + Math.sin(t * 2.4) * 30;
    const my = (root.y + tip.y) / 2 + 20;

    // Segment discs along the spine
    const SEG = 18;
    const pts = [];
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      // Quadratic Bezier
      const bx = (1 - u) * (1 - u) * root.x + 2 * (1 - u) * u * mx + u * u * tip.x;
      const by = (1 - u) * (1 - u) * root.y + 2 * (1 - u) * u * my + u * u * tip.y;
      // Thickness tapers toward the tip.
      const r = 58 - 44 * u + Math.sin(t * 4 + i) * 2;
      pts.push({ x: bx, y: by, r });
    }
    // Shadow layer
    for (const p of pts) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(p.x + 4, p.y + 6, p.r, p.r * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Body layer
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 3, p.x, p.y, p.r);
      g.addColorStop(0, "#ffc3ce");
      g.addColorStop(0.6, "#e06a84");
      g.addColorStop(1, "#8a1e38");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Centerline groove (signature tongue detail)
    ctx.save();
    ctx.strokeStyle = "rgba(90, 10, 30, 0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(root.x, root.y);
    ctx.quadraticCurveTo(mx, my, tip.x, tip.y);
    ctx.stroke();
    // Wet highlight along the left/top of the tongue.
    ctx.strokeStyle = "rgba(255, 225, 230, 0.55)";
    ctx.lineWidth = 5;
    ctx.shadowColor = "rgba(255,255,255,0.45)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(root.x - 20, root.y - 14);
    ctx.quadraticCurveTo(mx - 20, my - 14, tip.x - 8, tip.y - 8);
    ctx.stroke();
    ctx.restore();

    // Bulbous tongue tip with a slightly forked shape.
    ctx.save();
    ctx.translate(tip.x, tip.y);
    const forkAngle = Math.atan2(tip.y - my, tip.x - mx);
    ctx.rotate(forkAngle);
    ctx.fillStyle = "#e06a84";
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    // Small forked split
    ctx.strokeStyle = "rgba(80, 10, 30, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(28, -6);
    ctx.moveTo(12, 0);
    ctx.lineTo(28, 6);
    ctx.stroke();
    // Tip highlight
    ctx.fillStyle = "rgba(255, 220, 230, 0.9)";
    ctx.beginPath();
    ctx.ellipse(-6, -6, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Flash white when we were just hit.
    if (this.enemyFlash > 0) {
      ctx.globalAlpha = this.enemyFlash * 1.4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBloodDecals(ctx) {
    if (!this.bloodDecals.length) return;
    ctx.save();
    for (const d of this.bloodDecals) {
      ctx.fillStyle = `rgba(90, 10, 10, ${d.alpha})`;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(190, 20, 20, ${d.alpha})`;
      ctx.beginPath();
      ctx.ellipse(d.x - 1, d.y - 1, d.r * 0.6, d.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawAimZone(ctx) {
    const z = this.zone;
    const inZone = this.reticleInZone();
    const pulse = 0.55 + 0.45 * Math.sin(this.t * 7);
    ctx.save();
    // Fill (very subtle)
    ctx.fillStyle = inZone
      ? `rgba(120, 255, 120, ${0.18 + pulse * 0.08})`
      : `rgba(120, 255, 120, ${0.08 + pulse * 0.05})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.fill();
    // Outer glow ring
    ctx.strokeStyle = inZone
      ? `rgba(180, 255, 160, ${0.8 + pulse * 0.2})`
      : `rgba(150, 220, 150, ${0.55 + pulse * 0.3})`;
    ctx.lineWidth = inZone ? 4 : 3;
    ctx.shadowColor = inZone ? "#b5f05a" : "#7fc080";
    ctx.shadowBlur = inZone ? 22 : 12;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.stroke();
    // Inner target dot
    ctx.fillStyle = inZone ? "#b5f05a" : "rgba(180, 220, 180, 0.9)";
    ctx.beginPath();
    ctx.arc(z.x, z.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Orbit ticks (rotating dashes so the motion of the zone reads clearly)
    ctx.strokeStyle = `rgba(180, 255, 180, ${0.4 + pulse * 0.25})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.t * 0.8;
      const x0 = z.x + Math.cos(a) * (z.r + 6);
      const y0 = z.y + Math.sin(a) * (z.r + 6);
      const x1 = z.x + Math.cos(a) * (z.r + 14);
      const y1 = z.y + Math.sin(a) * (z.r + 14);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLash(ctx, L) {
    if (L.fired) return;
    const frac = Math.min(1, L.t / L.wait);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 18);
    ctx.save();
    // Fill
    ctx.fillStyle = `rgba(255, 40, 60, ${0.18 + frac * 0.25})`;
    ctx.beginPath();
    ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = `rgba(255, 80, 100, ${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff4060";
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2);
    ctx.stroke();
    // Progress arc
    ctx.strokeStyle = "#ffd0d8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(L.x, L.y, L.r + 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
    // "LASH" label
    drawText(ctx, "LASH!", L.x, L.y, {
      size: 18, color: "#fff", align: "center", bold: true,
      glow: "#ff4060", baseline: "middle",
    });
    ctx.restore();
  }

  drawReticle(ctx) {
    const x = this.reticleX, y = this.reticleY;
    const inZone = this.reticleInZone();
    const inLash = this.reticleInAnyLash();
    const col = inLash ? "#ff4060"
      : inZone ? "#b5f05a"
      : "#e9dcc1";
    // Trail
    ctx.save();
    for (let i = 0; i < this.reticleTrail.length; i++) {
      const r = this.reticleTrail[i];
      const a = (i / this.reticleTrail.length) * 0.35;
      ctx.fillStyle = `rgba(180, 220, 180, ${a})`;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    if (this.dodgeFlashT > 0) {
      ctx.shadowColor = "#9adaff";
      ctx.shadowBlur = 22;
    }
    // Miss flash - red ring
    if (this.missFlashT > 0) {
      const a = this.missFlashT / 0.4;
      ctx.strokeStyle = `rgba(255, 60, 80, ${a})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Lock flash - bright green ring
    if (this.lockFlashT > 0) {
      const a = this.lockFlashT / 0.4;
      ctx.strokeStyle = `rgba(180, 255, 120, ${a})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "#b5f05a";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, 32, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();
    // Inner crosshair
    ctx.beginPath();
    ctx.moveTo(x - 24, y); ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 6, y);  ctx.lineTo(x + 24, y);
    ctx.moveTo(x, y - 24); ctx.lineTo(x, y - 6);
    ctx.moveTo(x, y + 6);  ctx.lineTo(x, y + 24);
    ctx.stroke();
    // Center dot
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ================== UI ==================
  drawUI(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    const pad = 16;

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

    // Tongue HP
    drawPanel(ctx, W - 280, pad, 264, 64);
    drawText(ctx, this.enemy.name, W - 148, pad + 16, {
      size: 16, color: "#ff9cb0", align: "center", bold: true, glow: "#ff3060",
    });
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemy.hp / this.enemy.hpMax, {
      fill: "#4a1010", label: null,
    });
    drawBar(ctx, W - 270, pad + 34, 244, 18, this.enemyHpDisplay / this.enemy.hpMax, {
      fill: this.enemy.color,
      label: `${Math.ceil(this.enemyHpDisplay)} / ${this.enemy.hpMax}`,
      labelColor: "#111",
    });
    if (this.matchupLabel) {
      drawText(ctx, this.matchupLabel.text, W - 148, pad + 56, {
        size: 11, color: this.matchupLabel.color, align: "center", bold: true,
      });
    }

    // Action rail + combat log
    this.drawActions(ctx, game);
    this.drawLog(ctx);

    // "LOCKED" / "UNLOCKED" aim status centered at top
    const inZone = this.reticleInZone();
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 10);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const sw = 220, sh = 30;
    roundRect(ctx, W / 2 - sw / 2, 90, sw, sh, 8);
    ctx.fill();
    drawText(ctx, inZone ? "-- AIM LOCKED --" : "-- AIM UNLOCKED --",
      W / 2, 105, {
      size: 16, color: inZone ? `rgba(181, 240, 90, ${0.8 + pulse * 0.2})` : "#ff9090",
      align: "center", bold: true, glow: inZone ? "#b5f05a" : "#ff3060",
      baseline: "middle",
    });
    ctx.restore();

    if (this.heavyTelling) {
      const pp = 0.5 + 0.5 * Math.sin(this.t * 18);
      ctx.fillStyle = `rgba(255, 120, 20, ${0.35 + pp * 0.45})`;
      ctx.fillRect(0, 130, W, 28);
      drawText(ctx, "!! HEAVY CURL - AIM CAN'T SAVE YOU - [F] BRACE !!",
        W / 2, 144, {
          size: 17, color: "#fff", align: "center", bold: true,
          glow: "#ff8020", baseline: "middle",
      });
    }

    if (this.enrageFlashT > 0) {
      const a = Math.min(1, this.enrageFlashT / 1.4);
      ctx.save(); ctx.globalAlpha = a;
      drawBanner(ctx, "ENRAGED!", W / 2, 60, 36, "#ff5050", "#400010");
      ctx.restore();
    }

    if (this.perfectBraceReady || this.perfectFlashT > 0) {
      const a = this.perfectBraceReady ? 1 : Math.min(1, this.perfectFlashT / 0.9);
      ctx.save(); ctx.globalAlpha = a;
      const pulse2 = 0.5 + 0.5 * Math.sin(this.t * 10);
      drawText(ctx, this.perfectBraceReady ? ">> COUNTER READY <<" : "PERFECT GUARD!",
        W / 2, 210, {
          size: 22, color: `rgba(255, 217, 102, ${0.8 + pulse2 * 0.2})`,
          align: "center", bold: true, glow: "#ffd966",
        });
      ctx.restore();
    }

    // Context hint below the LOCK status
    this.drawContextHint(ctx, game);
  }

  drawActions(ctx, game) {
    const p = game.player;
    const l = p.loadout;
    const x = 16, y = H - 190;
    const w = 560, h = 174;
    drawPanel(ctx, x, y, w, h);
    drawText(ctx, "ACTIONS (mouse to aim)", x + 14, y + 12, {
      size: 13, color: COLORS.boneDim,
    });

    const items = [
      { keys: "Q / 1", name: l.attack.name,
        info: `DMG ${l.attack.dmg[0]}-${l.attack.dmg[1]}  MP ${l.attack.manaCost}  (needs LOCK)`,
        cd: p.cooldowns.attack, cdMax: l.attack.cooldown,
        locked: p.cooldowns.attack > 0 || p.mana < l.attack.manaCost,
      },
      { keys: "E / 2", name: l.special.name,
        info: `DMG ${l.special.dmg[0]}-${l.special.dmg[1]}  MP ${l.special.manaCost}  (needs LOCK)`,
        cd: p.cooldowns.special, cdMax: l.special.cooldown,
        locked: p.cooldowns.special > 0 || p.mana < l.special.manaCost,
      },
      { keys: "R / 3", name: "Dodge Roll", info: "+8 MP", cd: 0, cdMax: 0, locked: false },
      { keys: "F / 4", name: "Brace",      info: "Halves next lash; time late for counter!",
        cd: 0, cdMax: 0, locked: false },
    ];

    items.forEach((it, i) => {
      const row = y + 38 + i * 30;
      const col = it.locked ? COLORS.boneDim : COLORS.bone;
      drawText(ctx, `[${it.keys}]`, x + 14, row, { size: 13, color: col, bold: true });
      drawText(ctx, it.name,        x + 96, row, { size: 14, color: col });
      drawText(ctx, it.info,        x + 240, row, { size: 11, color: COLORS.boneDim });
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
    drawText(ctx, "MAW LOG", x + 14, y + 12, { size: 13, color: COLORS.boneDim });
    this.log.forEach((line, i) => {
      drawText(ctx, line, x + 14, y + 40 + i * 26, {
        size: 13, color: COLORS.bone,
      });
    });
    drawText(ctx,
      "[MOUSE] aim   [Q/1] attack   [E/2] special   [R/3] dodge   [F/4] brace   [P/ESC] pause",
      x + 14, y + h - 22, { size: 11, color: COLORS.bone });
  }

  drawContextHint(ctx, game) {
    const inZone = this.reticleInZone();
    const inLash = this.reticleInAnyLash();
    let hint = null;
    if (this.heavyTelling) {
      hint = { text: "[F] BRACE - heavy curl incoming, aim won't save you!", color: "#ffd0b0" };
    } else if (inLash) {
      hint = { text: "!! RED ZONE - MOVE AIM OR BRACE [F] !!", color: "#ffb0b0" };
    } else if (!inZone) {
      hint = { text: "MOVE MOUSE into the GREEN CIRCLE to lock on.", color: "#d0ffd0" };
    } else {
      hint = { text: "LOCKED! [Q] attack or [E] special - click also fires.", color: "#b5f05a" };
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 7);
    ctx.save();
    ctx.globalAlpha = 0.8 + pulse * 0.2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    const hw = 700, hh = 30;
    roundRect(ctx, W / 2 - hw / 2, 170, hw, hh, 6);
    ctx.fill();
    drawText(ctx, hint.text, W / 2, 185, {
      size: 16, color: hint.color, align: "center",
      bold: true, glow: hint.color, baseline: "middle",
    });
    ctx.restore();
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

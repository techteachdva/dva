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
  recordDirectHpHit, recordDirectArmorHit,
} from "../content/player.js";
import { VictoryScene } from "./victory.js";
import { GameOverScene } from "./gameover.js";

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
//   [Q] / [1]           Attack  (tooth in current lane, +neighbors if weapon multi-lane)
//   [E] / [2]           Special
//   [R] / [3]           Dodge roll  (brief i-frame + MP gain)
//   [F] / [4]           Brace      (mitigates chomp; perfect = counter)
//   [P] / [Esc]         Pause
// =====================================================================

const COLS_X = [W * 0.22, W * 0.36, W * 0.50, W * 0.64, W * 0.78];
const NUM_COLS = COLS_X.length;

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
const CHOMP_TELEGRAPH_MIN = 1.1;    // seconds between "uhoh" flash and slam
const CHOMP_COOLDOWN_MIN  = 2.2;    // fast-cycle minimum time between chomps
const CHOMP_COOLDOWN_MAX  = 3.6;    // baseline time between chomps
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

    // Chomp scheduler: time until we pick a top tooth to telegraph.
    this.nextChompIn = rand(1.8, 2.6);
    // Big "slam" is a rarer full-row bite where ALL top teeth chomp
    // together. You can only survive with a brace.
    this.nextSlamIn = rand(22, 32);
    this.slamTelegraph = null; // null or seconds-to-slam

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

    this.matchupMult = 1;
    this.matchupLabel = null;
  }

  pushLog(line) {
    this.log.push(line);
    if (this.log.length > 4) this.log.shift();
  }

  enter(game) {
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
  }

  // ======================== UPDATE ========================
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

    if (this.phase === "intro") {
      this.introT += dt;
      if (this.introT > 1.8) {
        this.phase = "fight";
        this.pushLog("Knock out all 5 bottom teeth AT ONCE to escape!");
      }
    }

    if (this.phase === "fight") {
      this.updateCooldowns(dt, p);
      this.updateTeeth(dt);
      this.updateChomps(dt, p, game);
      this.handleInput(dt, game);
      this.checkWinCondition(game);
    }

    if (this.phase === "win") {
      this.winHoldT += dt;
      if (this.winHoldT > 2.6 && !this.done) {
        this.done = true;
        if (p.score) p.score.bossesDefeated = (p.score.bossesDefeated || 0) + 1;
        SFX.victory();
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
  }

  updateTeeth(dt) {
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
        if (t.hp === 0) this.knockOutTooth(t);
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
          t.dotT = 0; t.dotDps = 0;
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
    // Cadence tightens as more bottom teeth get knocked out. With 0 down
    // the fight is breezy; with 3-4 down it is a panic.
    const downCount = this.bottomTeeth.filter(t => t.knockedOut).length;
    const cadenceMul = Math.max(0.55, 1 - 0.13 * downCount);

    // Single-lane chomp scheduling.
    this.nextChompIn -= dt;
    if (this.nextChompIn <= 0 && this.slamTelegraph === null) {
      this.startChomp();
      this.nextChompIn = rand(CHOMP_COOLDOWN_MIN, CHOMP_COOLDOWN_MAX) * cadenceMul;
    }

    // Full-row slam (less frequent, more devastating).
    this.nextSlamIn -= dt;
    if (this.nextSlamIn <= 0 && this.slamTelegraph === null) {
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

  startChomp() {
    // Pick any top tooth not already mid-telegraph / mid-chomp.
    const eligible = this.topTeeth.filter(t => t.telegraph === null && t.cooldown <= 0);
    if (eligible.length === 0) return;
    const tt = pick(eligible);
    tt.telegraph = CHOMP_TELEGRAPH_MIN;
    tt.flashT = 0.25;
    SFX.click();
  }

  startFullSlam() {
    this.slamTelegraph = 1.6; // longer telegraph - this one is survivable only by bracing
    for (const tt of this.topTeeth) tt.flashT = 0.35;
    this.pushLog("!!! THE WHOLE MAW IS CLOSING - BRACE [F/4] !!!");
    SFX.thud();
  }

  resolveChomp(tt, p) {
    const inLane = this.col === tt.col && this.dodgeIFrameT <= 0;
    tt.chomp = 1.0;
    tt.telegraph = null;
    tt.cooldown = 0.9;
    screenShake(8, 0.25);
    if (SFX.crunch) SFX.crunch(); else SFX.thud();
    this.particles.burst(
      COLS_X[tt.col], TOP_CHOMP_Y - 20, "#ffd0d4", 22, 260, 0.55,
    );

    if (!inLane) {
      this.pushLog(`A top tooth chomps column ${tt.col + 1} - you sidestepped it.`);
      return;
    }

    // In-lane - resolve with brace mitigation + perfect brace counter.
    const rawDmg = randInt(CHOMP_DMG_RANGE[0], CHOMP_DMG_RANGE[1]);
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
      x: COLS_X[tt.col] + rand(-16, 16),
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

    const rawDmg = randInt(CHOMP_DMG_RANGE[1], CHOMP_DMG_RANGE[1] + 14);
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
    const pm = p.pactMods || {};
    const scaled = Math.max(1, Math.round(amount * (pm.incomingDmgMult || 1)));
    applyDamage(p, scaled);
    this.hitFlash = Math.max(this.hitFlash, 0.35);
  }

  handleInput(dt, game) {
    const p = game.player;

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
    else if (game.input.wasPressed("Mouse0"))      this.execute(0, p, game);
  }

  execute(idx, p) {
    const l = p.loadout;
    const pm = p.pactMods || {};
    switch (idx) {
      case 0: {
        // v0.16 Wizard pays +manaCostBonus on every weapon use.
        const manaCost = l.attack.manaCost + (p.manaCostBonus || 0);
        if (p.cooldowns.attack > 0) { SFX.deny(); this.pushLog(`${l.attack.name} is recharging...`); return; }
        if (p.mana < manaCost) { SFX.deny(); this.pushLog("Not enough mana!"); return; }
        p.mana -= manaCost;
        p.cooldowns.attack = l.attack.cooldown * (pm.attackCdMult || 1);
        this.strikeCurrentLane(l.attack, "attack", p);
        break;
      }
      case 1: {
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
        // Dodge roll - short i-frames + MP gain. Great panic button when
        // you can't reach a safer lane in time.
        p.mana = Math.min(p.manaMax, p.mana + 8);
        this.dodgeIFrameT = 0.35;
        this.dodgeFlashT = 0.5;
        SFX.dodge();
        this.pushLog("You ROLL between the fangs (+8 MP, brief i-frames).");
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
  // neighbors for 50% of the damage.
  strikeCurrentLane(move, kind, p) {
    const mult = this.matchupMult || 1;
    const pm = p.pactMods || {};
    const dmgMult = (pm.dmgMult || 1) *
      (kind === "special" ? (pm.specialDmgMult || 1) : (pm.attackDmgMult || 1));
    const isCrit = Math.random() < (pm.critChance || 0);
    const critMult = isCrit ? 1.6 : 1;
    const raw = randInt(move.dmg[0], move.dmg[1]);
    const centerDmg = Math.max(1, Math.round(raw * mult * dmgMult * critMult));

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

    let totalDealt = centerDmg;
    // Multi-lane weapons sweep adjacent teeth for half damage.
    if (move.multiLane) {
      const spread = [-1, 1];
      for (const dx of spread) {
        const nc = this.col + dx;
        if (nc < 0 || nc >= NUM_COLS) continue;
        const nt = this.bottomTeeth[nc];
        if (!nt || nt.knockedOut) continue;
        const splash = Math.max(1, Math.round(centerDmg * 0.5));
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
          x: COLS_X[this.col] + rand(-10, 10),
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
      for (const t of targets) {
        t.dotT = Math.max(t.dotT || 0, pTime);
        t.dotDps = Math.max(t.dotDps || 0, pPct * t.hpMax);
        t.dotLabel = move.dotLabel || "BLEED";
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
    drawFleshBackground(ctx, this.t, ch.wormTint * 1.05, ch.palette);
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
    this.drawContextHint(ctx);
    this.drawLog(ctx);

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
    ctx.restore();
  }

  drawTopTeeth(ctx) {
    for (const tt of this.topTeeth) this.drawOneTopTooth(ctx, tt);
  }

  drawOneTopTooth(ctx, tt) {
    const x = COLS_X[tt.col];
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
    const x = COLS_X[this.col];
    const y = HERO_Y + Math.sin(this.heroBob) * 2;

    drawDropShadow(ctx, x, y + 26, 30, 10, 0.55);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2.4, 2.4);
    drawHero(ctx, 0, 0, 1, this.anim, p?.buildId || "swift");
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
    const items = [
      { key: "Q/1", name: l.attack.name,  info: `DMG ${l.attack.dmg[0]}-${l.attack.dmg[1]}  MP ${l.attack.manaCost + (p.manaCostBonus || 0)}`,
        cd: p.cooldowns.attack,  cdMax: l.attack.cooldown * (p.pactMods?.attackCdMult || 1) },
      { key: "E/2", name: l.special.name, info: `DMG ${l.special.dmg[0]}-${l.special.dmg[1]}  MP ${l.special.manaCost + (p.manaCostBonus || 0)}`,
        cd: p.cooldowns.special, cdMax: l.special.cooldown * (p.pactMods?.specialCdMult || 1) },
      { key: "R/3", name: "Dodge",  info: "+MP, brief i-frames",       cd: 0, cdMax: 0 },
      { key: "F/4", name: "Brace",  info: "halve next chomp",           cd: 0, cdMax: 0 },
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

  drawContextHint(ctx) {
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
      msg = "Move [A/D], swing [Q/1] or [E/2] at the tooth in your lane.";
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
      "[A/D] Move   [Q/1] Attack   [E/2] Special   [R/3] Dodge   [F/4] Brace   [P] Pause",
      x + 12, y + h - 16, {
        size: 12, color: COLORS.boneDim, maxWidth: w - 28,
      });
  }
}

// Preserve the old import name so existing routing (climb.js, intro.js)
// works without churn. The file is named tongueBoss.js for historical
// reasons; the scene class itself has been renamed.
export { MawBossScene as TongueBossScene };

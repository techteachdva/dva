import {
  W, H, COLORS,
  drawFleshBackground, drawVeins, drawAcid, drawText, drawPanel, drawBar, drawBanner,
  drawHero, drawSphere, drawPlate, drawDropShadow, ParticleSystem, screenShake, shade,
} from "../engine/render.js";
import { SFX } from "../engine/audio.js";
import { CHAMBERS } from "../content/chambers.js";
import { randInt, rand, pick } from "../engine/rng.js";
import { applyDamage } from "../content/player.js";
import { CombatScene } from "./combat.js";
import { GameOverScene } from "./gameover.js";

// Three hand-hold columns on the veiny wall. Hero is fixed in screen Y;
// the wall scrolls. Bile rises from the bottom of the screen in absolute pixels.

const COLS_X = [W * 0.33, W * 0.5, W * 0.67];
const HERO_Y = H - 180;              // hero fixed 180 px above bottom
const HERO_DEATH_Y = HERO_Y + 28;    // bile touches this Y -> death

const DEBRIS_KINDS = [
  { kind: "bone",   color: COLORS.bone,    sizeR: [10, 18], dmg: 20 },
  { kind: "tooth",  color: "#f6ecd0",      sizeR: [8, 14],  dmg: 18 },
  { kind: "goblin", color: "#6ea34a",      sizeR: [14, 22], dmg: 22 },
  { kind: "rock",   color: "#555",         sizeR: [12, 20], dmg: 25 },
];

export class ClimbScene {
  constructor(chamberIdx) {
    this.chamberIdx = chamberIdx;
    this.chamber = CHAMBERS[chamberIdx];
    this.t = 0;
    this.progress = 0;
    this.col = 1;
    this.targetX = COLS_X[1];
    this.heroX = COLS_X[1];
    this.hopCooldown = 0;
    this.anim = 0;

    this.debris = [];
    this.telegraphs = [];
    this.debrisTimer = 1.2;

    // Bile: rises in pixels from the BOTTOM of the screen.
    // bileY = H - bileHeight. Starts exactly at H (invisible, 0 height).
    this.bileHeight = 0;

    this.particles = new ParticleSystem();
    this.flash = 0;
    this.toast = null;
    this.toastTime = 0;
    this.paused = false;
    this.done = false;
  }

  enter(game) {
    const p = game.player;
    p.chamberIndex = this.chamberIdx;
    p.acidTimer = this.chamber.acidTimer;
    p.acidTimerMax = this.chamber.acidTimer;
    this.showToast("ENTER: " + this.chamber.name, 2.0);
    SFX.confirm();
  }

  showToast(text, time) {
    this.toast = text;
    this.toastTime = time;
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

    // --- Input: hop between columns ---
    this.hopCooldown -= dt;
    if (this.hopCooldown <= 0) {
      if (game.input.isDown("ArrowLeft", "a") && this.col > 0) {
        this.col--;
        this.targetX = COLS_X[this.col];
        this.hopCooldown = p.hopCooldown;
        SFX.grab();
      } else if (game.input.isDown("ArrowRight", "d") && this.col < 2) {
        this.col++;
        this.targetX = COLS_X[this.col];
        this.hopCooldown = p.hopCooldown;
        SFX.grab();
      }
    }
    // Smooth lerp hero X - Swift snaps faster than Iron
    const lerpSpeed = p.buildId === "swift" ? 16 : 10;
    this.heroX += (this.targetX - this.heroX) * Math.min(1, dt * lerpSpeed);

    // --- Climb up ---
    const climbBase = 200 * p.climbSpeed; // px/sec while holding UP (200 * 1.45 swift, 200 * 0.95 iron)
    const slipRate = 28;
    if (game.input.isDown("ArrowUp", "w")) {
      this.progress += climbBase * dt;
    } else if (game.input.isDown("ArrowDown", "s")) {
      // brace: hold position (no slip, no climb)
    } else {
      this.progress -= slipRate * dt;
      if (this.progress < 0) this.progress = 0;
    }

    // --- Bile rises ---
    this.bileHeight += ch.bileRiseRate * dt;

    // --- Acid timer (atmospheric corrosion, even above bile) ---
    p.acidTimer -= dt * p.acidResist;
    if (p.acidTimer <= 0) {
      if (p.armor > 0) {
        p.armor = Math.max(0, p.armor - 5 * dt);
      } else {
        p.hp -= 3 * dt;
        this.flash = Math.max(this.flash, 0.15);
      }
    }

    // --- Death by bile ---
    const bileTopY = H - this.bileHeight;
    if (bileTopY <= HERO_DEATH_Y) {
      p.hp = 0;
      screenShake(18, 0.5);
      SFX.die();
      this.die(game, "The bile rose. You did not. SPLORCH.");
      return;
    }

    // --- Debris telegraphs + spawns ---
    this.debrisTimer -= dt;
    if (this.debrisTimer <= 0) {
      const [tMin, tMax] = ch.debrisInterval;
      this.debrisTimer = rand(tMin, tMax);
      const col = randInt(0, 2);
      const kind = pick(DEBRIS_KINDS);
      this.telegraphs.push({
        col, t: 0, wait: 1.1, kind,
        speed: ch.debrisSpeed * rand(0.9, 1.3),
      });
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
      this.die(game, "Your wounds overwhelm you. The worm belches contentedly.");
      return;
    }

    // Win
    if (this.progress >= ch.climbHeight) {
      this.done = true;
      SFX.confirm();
      game.scenes.replace(new CombatScene(this.chamberIdx), game);
      return;
    }

    this.anim += dt * (game.input.isDown("ArrowUp", "w") ? 10 : 3);
  }

  handleDebrisHit(game, d) {
    const p = game.player;
    if (p.tankHitsLeft > 0) {
      p.tankHitsLeft--;
      this.showToast(`IRONHIDE soaks it! (${p.tankHitsLeft} tanks left)`, 1.4);
      SFX.thud();
      screenShake(6, 0.18);
      this.particles.burst(d.x, d.y, "#ffd966", 14, 180, 0.45);
      return;
    }
    const { armorTaken, hpTaken } = applyDamage(p, d.kind.dmg);
    SFX.hit();
    screenShake(10, 0.22);
    this.flash = 0.35;
    this.particles.burst(d.x, d.y, armorTaken > 0 ? "#ffcc55" : COLORS.blood, 16, 200, 0.5);
    this.progress = Math.max(0, this.progress - 60); // slight knockback slip
    if (armorTaken > 0 && hpTaken === 0) {
      this.showToast(`Armor holds! (-${Math.ceil(armorTaken)} ARM)`, 1.0);
    }
  }

  die(game, reason) {
    this.done = true;
    game.scenes.replace(new GameOverScene(reason), game);
  }

  // ================= RENDER =================
  render(ctx, game) {
    const p = game.player;
    const ch = this.chamber;

    drawFleshBackground(ctx, this.t + this.progress * 0.002, ch.wormTint);
    drawVeins(ctx, this.t + this.progress * 0.002, this.chamberIdx + 1);

    this.drawWall(ctx);

    // Debris (behind hero)
    for (const d of this.debris) this.drawDebris(ctx, d);

    // Hero
    ctx.save();
    ctx.translate(this.heroX, HERO_Y);
    ctx.scale(2.8, 2.8);
    drawHero(ctx, 0, 0, 1, this.anim, p.buildId);
    ctx.restore();

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

  drawWall(ctx) {
    // Fleshy hand-holds in three scrolling columns with volumetric shading.
    const scroll = this.progress * 0.7;
    ctx.save();
    for (let ci = 0; ci < 3; ci++) {
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
    ctx.save();
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(d.x + 2, d.y + 4, d.r * 0.9, d.r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    if (d.kind.kind === "bone") {
      // Bone with cel-shading
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
    } else if (d.kind.kind === "tooth") {
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
      // Bright edge highlight
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-d.r * 0.6, d.r - 1);
      ctx.lineTo(0, -d.r + 2);
      ctx.stroke();
    } else if (d.kind.kind === "goblin") {
      // Zombie goblin head with volumetric shading
      const g = ctx.createRadialGradient(-d.r * 0.3, -d.r * 0.3, 2, 0, 0, d.r);
      g.addColorStop(0, "#8cbf5c");
      g.addColorStop(0.7, d.kind.color);
      g.addColorStop(1, "#2a3a0a");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a0a0a";
      ctx.fillRect(-5, -4, 4, 3);
      ctx.fillRect(1, -4, 4, 3);
      ctx.fillStyle = "#fff";
      ctx.fillRect(-5, -4, 1, 1);
      ctx.fillRect(1, -4, 1, 1);
      ctx.strokeStyle = "#1a0a0a";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-5, 3); ctx.lineTo(5, 5);
      ctx.stroke();
      // Drool
      ctx.fillStyle = COLORS.bile;
      ctx.fillRect(-1, d.r - 2, 2, 5);
    } else {
      // Rock
      const g = ctx.createRadialGradient(-d.r * 0.4, -d.r * 0.4, 2, 0, 0, d.r);
      g.addColorStop(0, "#888");
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
    }
    ctx.restore();
  }

  drawTelegraph(ctx, tg) {
    const x = COLS_X[tg.col];
    const frac = tg.t / tg.wait;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 24);
    ctx.save();
    const grd = ctx.createLinearGradient(x, 0, x, 150);
    grd.addColorStop(0, `rgba(255, 70, 70, ${0.6 + pulse * 0.3})`);
    grd.addColorStop(1, "rgba(255, 70, 70, 0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x - 34, 0);
    ctx.lineTo(x + 34, 0);
    ctx.lineTo(x + 54, 150);
    ctx.lineTo(x - 54, 150);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#ff3030";
    ctx.shadowBlur = 14;
    ctx.font = "bold 32px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", x, 36 + Math.sin(this.t * 30) * 2);

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
    const rX = W - pad - 300;
    drawPanel(ctx, rX, pad, 300, 80);
    drawText(ctx, ch.name, rX + 150, pad + 16, {
      size: 16, color: COLORS.bile, align: "center", bold: true,
    });
    drawText(ctx, ch.tagline, rX + 150, pad + 38, {
      size: 11, color: COLORS.boneDim, align: "center",
    });
    const pct = Math.min(1, this.progress / ch.climbHeight);
    drawBar(ctx, rX + 12, pad + 54, 276, 16, pct, {
      fill: COLORS.gold, label: `CLIMB ${Math.round(pct * 100)}%`, labelColor: "#111",
    });

    // Column indicator (bottom center)
    this.drawColumnIndicator(ctx);

    // Help
    drawText(ctx, "UP climb   LEFT/RIGHT hop columns   DOWN brace   P/ESC pause", W / 2, H - 20, {
      size: 12, color: COLORS.boneDim, align: "center",
    });

    // Toast
    if (this.toast && this.toastTime > 0) {
      const a = Math.min(1, this.toastTime * 1.2);
      ctx.globalAlpha = a;
      drawBanner(ctx, this.toast, W / 2, 130, 28, COLORS.bile, COLORS.blood);
      ctx.globalAlpha = 1;
    }
  }

  drawColumnIndicator(ctx) {
    const y = H - 54;
    for (let i = 0; i < 3; i++) {
      const x = W / 2 - 34 + i * 34;
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

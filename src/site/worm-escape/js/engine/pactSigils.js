/**
 * Per-pact arcade sigils + palette for Pact picker & Codex pact rows.
 * Each pact gets a distinct silhouette + color story.
 */

const DEF = {
  primary: "#9bff66",
  secondary: "#1a0a22",
  glow: "#d7ff9b",
  border: "#ffd966",
  sigil: "sigilStar",
};

/** @type {Record<string, { primary: string, secondary: string, glow: string, border: string, sigil: string }>} */
export const PACT_CARD_VISUAL = {
  pact_of_vipers: { primary: "#5cff7a", secondary: "#0a2810", glow: "#b8ffc8", border: "#2e8b3e", sigil: "fangs" },
  patient_blade: { primary: "#c8e0ff", secondary: "#101828", glow: "#ffffff", border: "#6aa0ff", sigil: "crossedBlades" },
  perfectionist: { primary: "#ffd966", secondary: "#281808", glow: "#fff4cc", border: "#ff9933", sigil: "bullseye" },
  glass_fangs: { primary: "#88ddff", secondary: "#081820", glow: "#e0ffff", border: "#44aacc", sigil: "crackBolt" },
  feather_cloak: { primary: "#a8e8ff", secondary: "#0a1820", glow: "#ffffff", border: "#66c8ff", sigil: "feather" },
  iron_gizzard: { primary: "#c4b8a8", secondary: "#1a1510", glow: "#eee6dc", border: "#8a7a68", sigil: "gizzard" },
  bile_tongue: { primary: "#9bff66", secondary: "#1a3008", glow: "#d7ff9b", border: "#5a8c22", sigil: "drip" },
  marathon_lungs: { primary: "#ff9ec8", secondary: "#200818", glow: "#ffd0e8", border: "#cc5599", sigil: "lungs" },
  tide_watcher: { primary: "#66c8ff", secondary: "#061828", glow: "#b8ecff", border: "#2288cc", sigil: "waves" },
  ring_forger: { primary: "#ffd966", secondary: "#201808", glow: "#fff8c8", border: "#cc9900", sigil: "ringHammer" },
  stone_skin: { primary: "#a89888", secondary: "#12100c", glow: "#dcd0c4", border: "#6a5a4a", sigil: "facetStone" },
  hollow_husk: { primary: "#c8b0ff", secondary: "#140818", glow: "#ece4ff", border: "#8866cc", sigil: "hollowEye" },
  blood_tithe: { primary: "#c21a1a", secondary: "#200808", glow: "#ff6060", border: "#ff4444", sigil: "bloodChalice" },
  hex_eyed: { primary: "#aa66ff", secondary: "#120818", glow: "#e0c8ff", border: "#7722cc", sigil: "hexSpiral" },
  feed_frenzy: { primary: "#ff9944", secondary: "#201004", glow: "#ffcc88", border: "#cc6622", sigil: "burgerBurst" },
  glass_gauntlets: { primary: "#dde8ff", secondary: "#0c1018", glow: "#ffffff", border: "#8899bb", sigil: "shatterFist" },
  worms_eye: { primary: "#88ffcc", secondary: "#081814", glow: "#ccffee", border: "#44aa88", sigil: "wormEye" },
  enders_rite: { primary: "#ff8866", secondary: "#200c08", glow: "#ffccaa", border: "#cc4422", sigil: "skullSlash" },
  fast_hands: { primary: "#ffff66", secondary: "#181808", glow: "#ffffcc", border: "#cccc22", sigil: "speedZig" },
  all_in_red: { primary: "#e02020", secondary: "#180404", glow: "#ff8888", border: "#ff3333", sigil: "chipRed" },
  all_in_black: { primary: "#1a1a1a", secondary: "#000000", glow: "#666666", border: "#333333", sigil: "spadeBlack" },
  split_fifty_fifty: { primary: "#c0c0ff", secondary: "#101018", glow: "#ffffff", border: "#8888cc", sigil: "coinFlip" },
  silly_bile_express: { primary: "#66ffee", secondary: "#042018", glow: "#ccffff", border: "#22bbaa", sigil: "rocketSkip" },
  silly_jitterbug_lease: { primary: "#ff66dd", secondary: "#180818", glow: "#ffccee", border: "#cc22aa", sigil: "lightningBoot" },
  silly_worm_mirror: { primary: "#aaaaff", secondary: "#080818", glow: "#ddddff", border: "#6666cc", sigil: "mirrorSplit" },
};

export function getPactCardVisual(id) {
  return PACT_CARD_VISUAL[id] || { ...DEF, sigil: "sigilStar" };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {string} pactId
 * @param {number} t — scene time for subtle motion
 * @param {{ scale?: number, selected?: boolean }} opts
 */
export function drawPactSigil(ctx, cx, cy, pactId, t, opts = {}) {
  const s = opts.scale ?? 1;
  const v = getPactCardVisual(pactId);
  const pulse = 0.85 + 0.15 * Math.sin(t * 3.2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha *= pulse;

  const draw = SIGIL_DRAW[v.sigil] || SIGIL_DRAW.sigilStar;
  draw(ctx, v, t, !!opts.selected);

  ctx.restore();
}

/** @type {Record<string, function(CanvasRenderingContext2D, any, number, boolean): void>} */
const SIGIL_DRAW = {
  fangs(ctx, v, t, sel) {
    ctx.strokeStyle = v.primary;
    ctx.fillStyle = v.glow;
    ctx.lineWidth = sel ? 3.2 : 2.4;
    for (const sx of [-14, 14]) {
      ctx.beginPath();
      ctx.moveTo(sx, 22);
      ctx.lineTo(sx - 8, -18);
      ctx.lineTo(sx + 2, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },
  crossedBlades(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate((i === 0 ? -0.45 : 0.45));
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(0, 26);
      ctx.stroke();
      ctx.restore();
    }
  },
  bullseye(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 2;
    for (let r = 28; r >= 8; r -= 10) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = v.primary;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  },
  crackBolt(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-6, -28);
    ctx.lineTo(4, -4);
    ctx.lineTo(-2, -2);
    ctx.lineTo(10, 28);
    ctx.lineTo(0, 4);
    ctx.lineTo(6, 2);
    ctx.lineTo(-10, -28);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.lineTo(18, 14);
    ctx.stroke();
  },
  feather(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.border;
    ctx.fillStyle = v.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.quadraticCurveTo(22, -8, 8, 28);
    ctx.quadraticCurveTo(0, 12, -8, 28);
    ctx.quadraticCurveTo(-22, -8, 0, -30);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(0, 24);
    ctx.stroke();
  },
  gizzard(ctx, v, _t, _sel) {
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 4, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = v.secondary;
    ctx.beginPath();
    ctx.arc(0, 4, 12, 0.2, Math.PI * 2 - 0.2);
    ctx.stroke();
  },
  drip(ctx, v, _t, _sel) {
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.bezierCurveTo(22, -10, 22, 18, 0, 34);
    ctx.bezierCurveTo(-22, 18, -22, -10, 0, -32);
    ctx.fill();
    ctx.stroke();
  },
  lungs(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.fillStyle = "rgba(255,160,200,0.25)";
    ctx.lineWidth = 2.5;
    for (const ox of [-12, 12]) {
      ctx.beginPath();
      ctx.ellipse(ox, 0, 14, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 18);
    ctx.stroke();
  },
  waves(ctx, v, t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const y = -16 + i * 14 + Math.sin(t * 2 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(-32, y);
      for (let x = -32; x <= 32; x += 16) {
        ctx.quadraticCurveTo(x + 8, y + (i % 2 ? 8 : -8), x + 16, y);
      }
      ctx.stroke();
    }
  },
  ringHammer(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -6, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 8);
    ctx.lineTo(26, 28);
    ctx.stroke();
  },
  facetStone(ctx, v, _t, _sel) {
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const r = k % 2 ? 26 : 18;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
  hollowEye(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = v.secondary;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = v.glow;
    ctx.beginPath();
    ctx.arc(-4, -2, 4, 0, Math.PI * 2);
    ctx.fill();
  },
  bloodChalice(ctx, v, _t, _sel) {
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = "#ffaaaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-16, 24);
    ctx.lineTo(-12, -8);
    ctx.quadraticCurveTo(-12, -28, 0, -32);
    ctx.quadraticCurveTo(12, -28, 12, -8);
    ctx.lineTo(16, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#4a0000";
    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  hexSpiral(ctx, v, t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let a = t * 1.4;
    for (let i = 0; i < 48; i++) {
      const r = 4 + i * 0.55;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      a += 0.42;
    }
    ctx.stroke();
  },
  burgerBurst(ctx, v, _t, _sel) {
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 2;
    const bx = -22;
    const by = -8;
    const bw = 44;
    const bh = 18;
    const br = 6;
    ctx.beginPath();
    ctx.moveTo(bx + br, by);
    ctx.lineTo(bx + bw - br, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
    ctx.lineTo(bx + bw, by + bh - br);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
    ctx.lineTo(bx + br, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
    ctx.lineTo(bx, by + br);
    ctx.quadraticCurveTo(bx, by, bx + br, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.strokeStyle = v.glow;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * 28, Math.sin(a) * 18);
      ctx.stroke();
    }
  },
  shatterFist(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-18, 20);
    ctx.lineTo(-8, -24);
    ctx.lineTo(8, -18);
    ctx.lineTo(18, 22);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.moveTo(-6, -10);
    ctx.lineTo(10, 4);
    ctx.stroke();
  },
  wormEye(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0.3, Math.PI * 2 - 0.3);
    ctx.stroke();
    ctx.fillStyle = v.secondary;
    ctx.beginPath();
    ctx.ellipse(4, 0, 8, 14, 0.4, 0, Math.PI * 2);
    ctx.fill();
  },
  skullSlash(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -4, 16, 0.25, Math.PI * 2 - 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, 4);
    ctx.quadraticCurveTo(0, 22, 8, 4);
    ctx.stroke();
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, 26);
    ctx.lineTo(26, -26);
    ctx.stroke();
  },
  speedZig(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-28, 18);
    ctx.lineTo(-8, -18);
    ctx.lineTo(8, 18);
    ctx.lineTo(28, -18);
    ctx.stroke();
  },
  chipRed(ctx, v, _t, _sel) {
    ctx.save();
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = v.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff0e0";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("R", 0, 1);
    ctx.restore();
  },
  spadeBlack(ctx, v, _t, _sel) {
    ctx.fillStyle = "#2a2a2a";
    ctx.strokeStyle = v.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.bezierCurveTo(18, -10, 18, 8, 0, 26);
    ctx.bezierCurveTo(-18, 8, -18, -10, 0, -22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(0, 26);
    ctx.lineTo(-8, 40);
    ctx.lineTo(8, 40);
    ctx.closePath();
    ctx.fill();
  },
  coinFlip(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = v.border;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(0, 18);
    ctx.stroke();
    ctx.fillStyle = v.glow;
    ctx.beginPath();
    ctx.arc(-10, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 6, 5, 0, Math.PI * 2);
    ctx.fill();
  },
  rocketSkip(ctx, v, _t, _sel) {
    ctx.fillStyle = v.primary;
    ctx.strokeStyle = v.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-16, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-16, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = v.glow;
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-14, 0);
    ctx.stroke();
  },
  lightningBoot(ctx, v, t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2.5;
    const w = 8 + Math.sin(t * 8) * 2;
    ctx.strokeRect(-18, 8, 36, w);
    ctx.beginPath();
    ctx.moveTo(-6, -28);
    ctx.lineTo(2, -4);
    ctx.lineTo(-4, -4);
    ctx.lineTo(8, 28);
    ctx.stroke();
  },
  mirrorSplit(ctx, v, _t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(0, 30);
    ctx.stroke();
    ctx.fillStyle = "rgba(180,180,255,0.2)";
    ctx.fillRect(-26, -28, 24, 56);
    ctx.fillRect(2, -28, 24, 56);
    ctx.strokeRect(-26, -28, 24, 56);
    ctx.strokeRect(2, -28, 24, 56);
  },
  sigilStar(ctx, v, t, _sel) {
    ctx.strokeStyle = v.primary;
    ctx.lineWidth = 2;
    const r = 22 + Math.sin(t * 4) * 2;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  },
};

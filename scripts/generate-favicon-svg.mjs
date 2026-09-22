import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../src/site/favicon.svg");

const cx = 256;
const cy = 256;

function spiral(startAngle, turns = 2.35, steps = 240, r0 = 68, r1 = 238) {
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * Math.pow(t, 0.88);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    d += (i === 0 ? "M" : " L") + x.toFixed(2) + "," + y.toFixed(2);
  }
  return d;
}

function hash(i) {
  return ((i * 9301 + 49297) % 233280) / 233280;
}

const armAngle = -Math.PI / 2 - 0.22;
const arm1 = spiral(armAngle);
const arm2 = spiral(armAngle + Math.PI);

const dust = [];
for (const sa of [armAngle, armAngle + Math.PI]) {
  for (let i = 0; i < 38; i++) {
    const t = 0.06 + (i / 37) * 0.92;
    const a = sa + t * 2.35 * Math.PI * 2;
    const r = 68 + (238 - 68) * Math.pow(t, 0.88);
    const j = hash(i * 17 + Math.round(sa * 100));
    const k = hash(i * 29 + 3);
    dust.push({
      x: cx + (r + (j - 0.5) * 16) * Math.cos(a) + (k - 0.5) * 4,
      y: cy + (r + (j - 0.5) * 16) * Math.sin(a) + (hash(i * 41) - 0.5) * 4,
      s: 1 + hash(i * 31 + 1) * 2.2,
      o: 0.45 + hash(i) * 0.55,
    });
  }
}

for (let i = 0; i < 48; i++) {
  const a = hash(i * 3) * Math.PI * 2;
  const r = 85 + hash(i * 5) * 145;
  if (r < 58) continue;
  dust.push({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
    s: 0.8 + hash(i * 7) * 1.6,
    o: 0.3 + hash(i * 11) * 0.55,
  });
}

const dustCircles = dust
  .map(
    (d) =>
      `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="${d.s.toFixed(2)}" opacity="${d.o.toFixed(2)}"/>`
  )
  .join("\n      ");

const fontStack =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, Liberation Mono, monospace";

// Vertical binary column: outer digits fade, center digits large and crisp (no glow smear).
const stream = "001011010110";
const streamMid = (stream.length - 1) / 2;
const streamTexts = stream
  .split("")
  .map((ch, i) => {
    const yy = 102 + i * 23;
    const dist = Math.abs(i - streamMid);
    const t = 1 - dist / streamMid;
    const sz = 17 + t * 30;
    const op = 0.5 + t * 0.5;
    const isCore = t > 0.45;
    const fill = isCore ? "#ffffff" : "#67e8f9";
    const weight = isCore ? "900" : "700";
    const stroke = isCore ? ' stroke="#0284c7" stroke-width="1.8"' : ' stroke="#0c4a6e" stroke-width="1.1"';
    const paint = ' paint-order="stroke fill"';
    return `<text x="${cx}" y="${yy.toFixed(1)}" font-size="${sz.toFixed(1)}" font-weight="${weight}" fill="${fill}" opacity="${op.toFixed(2)}"${stroke}${paint}>${ch}</text>`;
  })
  .join("\n      ");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Galaxy binary black hole logo">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="72%">
      <stop offset="0%" stop-color="#160a28"/>
      <stop offset="100%" stop-color="#05020a"/>
    </radialGradient>
    <linearGradient id="armGrad" gradientUnits="userSpaceOnUse" x1="96" y1="96" x2="416" y2="416">
      <stop offset="0%" stop-color="#e879f9"/>
      <stop offset="28%" stop-color="#a855f7"/>
      <stop offset="52%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
    <linearGradient id="armGrad2" gradientUnits="userSpaceOnUse" x1="416" y1="96" x2="96" y2="416">
      <stop offset="0%" stop-color="#e879f9"/>
      <stop offset="28%" stop-color="#a855f7"/>
      <stop offset="52%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
    <mask id="armMask">
      <rect width="512" height="512" fill="white"/>
      <circle cx="${cx}" cy="${cy}" r="82" fill="black"/>
    </mask>
    <filter id="nebula" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="nebulaSoft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="11"/>
    </filter>
    <filter id="binaryStar" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="1.1" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="starTwinkle" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="1.1"/>
    </filter>
    <clipPath id="frame"><rect width="512" height="512"/></clipPath>
  </defs>

  <g clip-path="url(#frame)">
    <rect width="512" height="512" fill="url(#bg)"/>

    <g mask="url(#armMask)" opacity="0.62" filter="url(#nebulaSoft)">
      <path d="${arm1}" fill="none" stroke="#9333ea" stroke-width="48" stroke-linecap="round"/>
      <path d="${arm2}" fill="none" stroke="#9333ea" stroke-width="48" stroke-linecap="round"/>
      <path d="${arm1}" fill="none" stroke="#0ea5e9" stroke-width="34" stroke-linecap="round" opacity="0.75"/>
      <path d="${arm2}" fill="none" stroke="#0ea5e9" stroke-width="34" stroke-linecap="round" opacity="0.75"/>
    </g>

    <g mask="url(#armMask)" fill="none" stroke-linecap="round" filter="url(#nebula)">
      <path d="${arm1}" stroke="url(#armGrad)" stroke-width="26" opacity="0.88"/>
      <path d="${arm2}" stroke="url(#armGrad2)" stroke-width="26" opacity="0.88"/>
      <path d="${arm1}" stroke="#bae6fd" stroke-width="6.5" opacity="0.42"/>
      <path d="${arm2}" stroke="#bae6fd" stroke-width="6.5" opacity="0.42"/>
      <path d="${arm1}" stroke="#f5d0fe" stroke-width="11" opacity="0.38"/>
      <path d="${arm2}" stroke="#f5d0fe" stroke-width="11" opacity="0.38"/>
    </g>

    <g fill="#ffffff" filter="url(#starTwinkle)">
      ${dustCircles}
    </g>

    <!-- Event horizon behind the middle of the binary column -->
    <circle cx="${cx}" cy="${cy}" r="48" fill="#000000"/>

    <g font-family="${fontStack}" text-anchor="middle">
      ${streamTexts}
    </g>

    <circle cx="${cx}" cy="${cy}" r="6" fill="#000000"/>
  </g>
</svg>
`;

fs.writeFileSync(outPath, svg);
console.log("Wrote", outPath);

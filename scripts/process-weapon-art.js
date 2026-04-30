/**
 * One-shot: convert worm-escape root weapon PNG uploads (flat white BG) to
 * transparent PNGs under src/site/worm-escape/img/weapons/{loadoutId}.png
 *
 * Run from repo root: node scripts/process-weapon-art.js
 */
"use strict";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../src/site/worm-escape");
const OUT_DIR = path.join(ROOT, "img/weapons");
/** Channels must all be ≥ this to become transparent (tune if halos remain). */
const WHITE_MIN = 242;
const TARGET_HEIGHT = 220;

const INPUTS = [
  ["blunderbuss.png", "blunderbuss.png"],
  ["chainsaw.png", "rustyChainsaw.png"],
  ["cursed scythe.png", "cursedScythe.png"],
  ["engineer wrench.png", "engineerWrench.png"],
  ["folding chair.png", "chair.png"],
  ["gnarled club.png", "club.png"],
];

async function processOne(srcRelative, destName) {
  const src = path.join(ROOT, srcRelative);
  if (!fs.existsSync(src)) {
    console.warn("SKIP missing:", srcRelative);
    return;
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let { data, info } = await sharp(src)
    .resize({
      height: TARGET_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (channels !== 4) {
    throw new Error(`Expected RGBA after ensureAlpha, got ${channels}ch`);
  }
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r >= WHITE_MIN && g >= WHITE_MIN && b >= WHITE_MIN) {
      data[i + 3] = 0;
    }
  }

  const dest = path.join(OUT_DIR, destName);
  await sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toFile(dest);
  console.log("Wrote", path.relative(process.cwd(), dest));
}

(async () => {
  for (const [srcRel, dest] of INPUTS) {
    await processOne(srcRel, dest);
  }
})();

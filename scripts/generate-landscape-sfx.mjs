#!/usr/bin/env node
/** Generate unique placeholder landscape SFX as WAV (no ffmpeg required). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(REPO, "src/site/somnia/audio/landscapes");
const JSON_OUT = path.join(REPO, "src/site/somnia/data/landscape-sfx.json");
const SAMPLE_RATE = 44100;

const RECIPES = {
  bed: { freq: 196, dur: 1.6, vol: 0.35, slide: -20 },
  city: { freq: 440, dur: 0.9, vol: 0.22, slide: 80, harmonics: [2, 0.15] },
  forest: { freq: 165, dur: 2.0, vol: 0.3, slide: 30, harmonics: [3, 0.12] },
  house: { freq: 220, dur: 1.4, vol: 0.28, slide: 0 },
  road: { freq: 130, dur: 1.2, vol: 0.2, slide: 60 },
  sky: { freq: 880, dur: 1.8, vol: 0.25, slide: -120 },
  suburbia: { freq: 330, dur: 1.1, vol: 0.24, slide: 15 },
  lava: { freq: 95, dur: 1.5, vol: 0.32, slide: 40, harmonics: [2, 0.2] },
  "black-void": { freq: 55, dur: 2.2, vol: 0.38, slide: -10 },
  "field-of-broken-glass": { freq: 2400, dur: 0.7, vol: 0.18, slide: -400 },
  "the-attic": { freq: 310, dur: 1.3, vol: 0.26, slide: -25 },
  "the-basement": { freq: 82, dur: 1.9, vol: 0.34, slide: 0 },
  desert: { freq: 147, dur: 2.1, vol: 0.27, slide: 8 },
  "endless-hallway": { freq: 370, dur: 1.6, vol: 0.22, slide: 0, echo: 0.22 },
  "the-party": { freq: 523, dur: 0.85, vol: 0.26, slide: 140 },
  awards: { freq: 659, dur: 1.0, vol: 0.3, slide: 90 },
  "sea-of-teeth": { freq: 180, dur: 1.1, vol: 0.28, slide: -50 },
  "endless-ocean": { freq: 110, dur: 2.4, vol: 0.3, slide: 12 },
  "candy-mountain": { freq: 784, dur: 0.95, vol: 0.27, slide: 60 },
  "naked-classroom": { freq: 420, dur: 0.65, vol: 0.2, slide: -80 },
  "tranquil-grove": { freq: 262, dur: 2.0, vol: 0.26, slide: 20 },
  "day-in-the-life": { freq: 392, dur: 1.2, vol: 0.24, slide: 0 },
  insanity: { freq: 666, dur: 0.8, vol: 0.24, slide: 200 },
  "inner-sanctum": { freq: 174, dur: 2.2, vol: 0.32, slide: -15 },
  "silver-mist": { freq: 988, dur: 1.7, vol: 0.22, slide: -60 },
  wasteland: { freq: 73, dur: 2.3, vol: 0.36, slide: -5, noise: 0.06 },
};

function envelope(t, dur) {
  const a = Math.min(1, t / 0.08);
  const r = Math.min(1, Math.max(0, (dur - t) / 0.35));
  return a * r;
}

function sampleAt(t, recipe) {
  const { freq, dur, vol, slide = 0, harmonics, noise = 0, echo = 0 } = recipe;
  const f = freq + (slide * t) / dur;
  let s = Math.sin(2 * Math.PI * f * t) * vol * envelope(t, dur);
  if (harmonics) {
    const [mult, amp] = harmonics;
    s += Math.sin(2 * Math.PI * f * mult * t) * vol * amp * envelope(t, dur);
  }
  if (noise) {
    s += (Math.random() * 2 - 1) * noise * envelope(t, dur);
  }
  if (echo) {
    const delay = 0.18;
    if (t > delay) {
      s += sampleCore(t - delay, recipe, false) * echo;
    }
  }
  return Math.max(-1, Math.min(1, s));
}

function sampleCore(t, recipe, withEcho = true) {
  const r = withEcho ? recipe : { ...recipe, echo: 0 };
  return sampleAt(t, r);
}

function writeWav(filePath, recipe) {
  const samples = Math.floor(recipe.dur * SAMPLE_RATE);
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i += 1) {
    const t = i / SAMPLE_RATE;
    const v = sampleAt(t, recipe);
    buf.writeInt16LE(Math.round(v * 32767 * 0.85), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mapping = {};
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const file = `audio/landscapes/${id}.wav`;
    writeWav(path.join(REPO, "src/site/somnia", file), recipe);
    mapping[id] = {
      file,
      label: id.replace(/-/g, " "),
      license: "CC0 placeholder (procedural) — replace with your own sample",
    };
    console.log(`Generated ${id}.wav`);
  }
  fs.writeFileSync(JSON_OUT, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(REPO, JSON_OUT)}`);
}

main();

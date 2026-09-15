#!/usr/bin/env node
/**
 * Trim landscape stings to brief clips with fade in/out (requires ffmpeg).
 * Run: node scripts/trim-landscape-sfx.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../src/site/somnia/audio/landscapes");
const MAX_SEC = 2.6;
const FADE_IN = 0.12;
const FADE_OUT = 0.5;
const FADE_OUT_START = Math.max(FADE_IN + 0.05, MAX_SEC - FADE_OUT);

let ffmpeg = "ffmpeg";
try {
  const mod = await import("@ffmpeg-installer/ffmpeg");
  ffmpeg = mod.default?.path || mod.path;
} catch {
  /* use system ffmpeg */
}

const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".mp3"));

for (const file of files) {
  const src = path.join(OUT_DIR, file);
  const tmp = path.join(OUT_DIR, `_trim-${file}`);
  const result = spawnSync(ffmpeg, [
    "-y", "-i", src,
    "-t", String(MAX_SEC),
    "-af", `afade=t=in:st=0:d=${FADE_IN},afade=t=out:st=${FADE_OUT_START}:d=${FADE_OUT}`,
    "-ar", "44100", "-ac", "1", "-b:a", "96k",
    tmp,
  ], { stdio: "pipe" });
  if (result.status !== 0) {
    console.error("FAIL", file, result.stderr?.toString().slice(0, 200));
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    continue;
  }
  fs.renameSync(tmp, src);
  console.log("OK", file, fs.statSync(src).size);
}

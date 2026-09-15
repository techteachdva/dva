#!/usr/bin/env node
/**
 * Rebuild landscape-sfx.json from pixabay-landscape-cdn.json + files on disk.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO, "src/site/somnia/audio/landscapes");
const SOURCES_PATH = path.join(__dirname, "pixabay-landscape-cdn.json");
const MANIFEST_PATH = path.join(REPO, "src/site/somnia/data/landscape-sfx.json");

const sources = JSON.parse(fs.readFileSync(SOURCES_PATH, "utf8"));
const manifest = {};

for (const [id, meta] of Object.entries(sources)) {
  const mp3 = path.join(OUT_DIR, `${id}.mp3`);
  const wav = path.join(OUT_DIR, `${id}.wav`);
  const useMp3 = fs.existsSync(mp3);
  const useWav = fs.existsSync(wav);
  if (!useMp3 && !useWav) {
    console.warn(`MISSING audio for ${id}`);
    continue;
  }
  const ext = useMp3 ? "mp3" : "wav";
  const sourceUrl = meta.sourceUrl || meta.pageUrl;
  manifest[id] = {
    file: `audio/landscapes/${id}.${ext}`,
    label: id.replace(/-/g, " "),
    title: meta.title,
    artist: meta.artist,
    artistUrl: meta.artistUrl,
    sourceUrl,
    license: useMp3 ? "Pixabay Content License" : "Pixabay Content License (fallback: procedural placeholder)",
  };
}

fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${manifest.length || Object.keys(manifest).length} entries to ${MANIFEST_PATH}`);

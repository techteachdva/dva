/**
 * Compress raster assets dropped in public/ or web_static/ into WebP and AVIF.
 * Audio files are copied through (sharp does not encode audio).
 * Outputs land in dist/assets/<source-root>/… and are skipped when already fresh.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOTS = ["public", "web_static"];
const OUT_ROOT = path.join(root, "dist", "assets");
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff", ".bmp"]);
const AUDIO_EXT = new Set([".mp3", ".ogg", ".wav", ".m4a", ".aac", ".flac"]);

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile()) out.push(abs);
  }
}

function isFresh(src, dest) {
  if (!fs.existsSync(dest)) return false;
  return fs.statSync(dest).mtimeMs >= fs.statSync(src).mtimeMs;
}

async function writeImage(src, destBase) {
  const webp = `${destBase}.webp`;
  const avif = `${destBase}.avif`;
  const ext = path.extname(src).toLowerCase();
  const animated = ext === ".gif";
  if (!isFresh(src, webp)) {
    await sharp(src, { animated }).rotate().webp({ quality: 72, effort: 4 }).toFile(webp);
  }
  if (!isFresh(src, avif)) {
    await sharp(src, { animated: false }).rotate().avif({ quality: 48, effort: 4 }).toFile(avif);
  }
  return { webp: path.relative(root, webp).replaceAll("\\", "/"), avif: path.relative(root, avif).replaceAll("\\", "/") };
}

function copyAudio(src, dest) {
  if (isFresh(src, dest)) return;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export async function optimizeGameAssets() {
  const manifest = { images: [], audio: [], skipped: [] };
  for (const sourceRoot of SOURCE_ROOTS) {
    const absRoot = path.join(root, sourceRoot);
    const files = [];
    walk(absRoot, files);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const rel = path.relative(absRoot, file);
      const destBase = path.join(OUT_ROOT, sourceRoot, rel).replace(new RegExp(`${ext}$`, "i"), "");
      try {
        if (IMAGE_EXT.has(ext)) {
          fs.mkdirSync(path.dirname(destBase), { recursive: true });
          const written = await writeImage(file, destBase);
          manifest.images.push({ source: path.relative(root, file).replaceAll("\\", "/"), ...written });
        } else if (AUDIO_EXT.has(ext)) {
          const dest = path.join(OUT_ROOT, sourceRoot, rel);
          copyAudio(file, dest);
          manifest.audio.push({
            source: path.relative(root, file).replaceAll("\\", "/"),
            output: path.relative(root, dest).replaceAll("\\", "/"),
            note: "copied; sharp does not transcode audio",
          });
        }
      } catch (err) {
        manifest.skipped.push({
          source: path.relative(root, file).replaceAll("\\", "/"),
          error: err?.message || String(err),
        });
      }
    }
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const result = await optimizeGameAssets();
  console.log(
    `[assets] ${result.images.length} image(s), ${result.audio.length} audio file(s), ${result.skipped.length} skipped`
  );
  if (result.skipped.length) {
    for (const item of result.skipped) console.warn(`  ${item.source}: ${item.error}`);
    process.exitCode = 1;
  }
}

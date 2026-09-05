#!/usr/bin/env node
/**
 * Copy generated Somnia art from Cursor assets into the repo.
 * Run after image generation batches complete.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const ASSETS = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".cursor",
  "projects",
  "c-Users-phili-Desktop-coding-projects-dva",
  "assets"
);
const SOMNIA = path.join(REPO, "src/site/somnia/images");

function copyPattern(prefix, destDir, stripPrefix) {
  if (!fs.existsSync(ASSETS)) {
    console.warn(`Assets folder not found: ${ASSETS}`);
    return 0;
  }
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of fs.readdirSync(ASSETS)) {
    if (!file.startsWith(prefix) || !file.endsWith(".png")) continue;
    const id = file.slice(stripPrefix.length).replace(/\.png$/, "");
    const dest = path.join(destDir, `${id}.png`);
    fs.copyFileSync(path.join(ASSETS, file), dest);
    count += 1;
  }
  return count;
}

const landscapes = copyPattern("landscape-", path.join(SOMNIA, "landscapes"), "landscape-".length);
const dreambeasts = copyPattern("dreambeast-", path.join(SOMNIA, "dreambeasts"), "dreambeast-".length);

console.log(`Copied ${landscapes} landscapes, ${dreambeasts} dreambeasts to ${SOMNIA}`);

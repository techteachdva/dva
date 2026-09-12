#!/usr/bin/env node
/**
 * Copy generated mindstream event art from Cursor assets into the repo as .webp.
 * Expected asset filenames: mindstream-{suit}-{id}.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const ASSETS = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".cursor",
  "projects",
  "c-Users-phili-Desktop-coding-projects-dva",
  "assets"
);
const SOMNIA = path.join(REPO, "src/site/somnia/images/cards/mindstream");

function toWebp() {
  execSync("python scripts/convert-mindstream-png-to-webp.py", {
    cwd: REPO,
    stdio: "inherit",
  });
}

function main() {
  if (!fs.existsSync(ASSETS)) {
    console.error(`Assets folder not found: ${ASSETS}`);
    process.exit(1);
  }
  const count = fs.readdirSync(ASSETS).filter((f) => /^mindstream-/.test(f)).length;
  if (!count) {
    console.log("No mindstream-*.png assets found.");
    return;
  }
  toWebp();
  console.log(`Installed ${count} mindstream images`);
}

main();

#!/usr/bin/env node
/** Verify Somnia JSON image paths exist on disk. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "../src/site/somnia");

function loadJson(name) {
  const p = path.join(ROOT, "data", `${name}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function flatten(data, key) {
  if (Array.isArray(data)) return data;
  if (key && data[key]) return Object.values(data[key]).flat();
  return Object.values(data).flat();
}

const checks = [
  ["dreams", loadJson("dreams")],
  ["dreambeasts", loadJson("dreambeasts")],
  ["objects", loadJson("objects")],
  ["landscapes", loadJson("landscapes").filter((l) => !l.hidden)],
  ["archetypes", loadJson("archetypes")],
  ["dreamers", loadJson("dreamers")],
];

const missing = [];
const large = [];

for (const [cat, items] of checks) {
  for (const item of items) {
    for (const field of ["image", "wastelandImage"]) {
      const rel = item[field];
      if (!rel) continue;
      const fp = path.join(ROOT, rel);
      if (!fs.existsSync(fp)) {
        missing.push({ cat, id: item.id, field, path: rel });
      } else {
        const size = fs.statSync(fp).size;
        if (size > 900_000) large.push({ cat, id: item.id, path: rel, kb: Math.round(size / 1024) });
      }
    }
  }
}

const mindstream = loadJson("mindstream");
const msFlat = flatten(mindstream);
const msMissing = msFlat.filter((c) => c.image && !fs.existsSync(path.join(ROOT, c.image)));

const msUtility = ["lucidity", "elasticity", "willpower"].flatMap((suit) => [
  { id: `power-token-${suit}`, image: `images/cards/mindstream/${suit}/power-token.png` },
  { id: `draw-dream-${suit}`, image: `images/cards/mindstream/${suit}/draw-dream.png` },
]);
const utilMissing = msUtility.filter((c) => !fs.existsSync(path.join(ROOT, c.image)));

console.log("=== Somnia asset audit ===");
console.log(`Missing referenced images: ${missing.length}`);
missing.forEach((m) => console.log(`  [${m.cat}] ${m.id} ${m.field}: ${m.path}`));
console.log(`Mindstream images missing (expected): ${msMissing.length}/${msFlat.length}`);
msMissing.slice(0, 20).forEach((c) => console.log(`  ${c.id}: ${c.image}`));
console.log(`Mindstream utility missing: ${utilMissing.length}/6`);
utilMissing.forEach((c) => console.log(`  ${c.id}: ${c.image}`));
console.log(`Large images (>900KB): ${large.length}`);
large.slice(0, 15).forEach((m) => console.log(`  [${m.cat}] ${m.id}: ${m.kb}KB`));

const dirs = ["dreams", "dreambeasts", "objects", "landscapes", "archetypes", "dreamers"];
console.log("\nOn-disk counts:");
dirs.forEach((d) => {
  const dp = path.join(ROOT, "images", d);
  const n = fs.existsSync(dp) ? fs.readdirSync(dp).filter((f) => /\.(png|jpg|webp)$/i.test(f)).length : 0;
  console.log(`  ${d}: ${n}`);
});

process.exit(missing.length > 0 ? 1 : 0);

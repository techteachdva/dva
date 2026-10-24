/**
 * Split the Morphology Garden bank into tier JSON chunks.
 *
 * Source of the generated trees: scripts/morphology-authoring/
 * Shipped files (what the browser loads):
 *   src/site/scripts/data/morphology/words/tier{1,2,3}.json
 *   src/site/scripts/data/morphology/catalog/tier{1,2,3}.json
 *   src/site/scripts/data/morphology/manifest.json
 *
 * Existing JSON is left alone unless you pass --write, or a chunk is missing.
 * --write rebuilds every chunk from the authoring modules and overwrites edits
 * in the JSON files.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MORPHOLOGY_WORD_LIST } from "./morphology-authoring/morphology-words-data.js";
import { MORPHEME_CATALOG } from "./morphology-authoring/morphology-morpheme-catalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src", "site", "scripts", "data", "morphology");
const TIERS = ["tier1", "tier2", "tier3"];
const RANK = { tier1: 1, tier2: 2, tier3: 3 };
const force = process.argv.includes("--write");

function collectKeys(node, out) {
  if (!node) return;
  if (typeof node.morphemeKey === "string" && node.morphemeKey) out.add(node.morphemeKey);
  const children = node.children;
  if (Array.isArray(children)) for (const child of children) collectKeys(child, out);
}

function wordTier(word) {
  return TIERS.includes(word?.tier) ? word.tier : "tier2";
}

function emptyBuckets() {
  return { tier1: [], tier2: [], tier3: [] };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const manifestPath = path.join(outDir, "manifest.json");
const required = [
  manifestPath,
  ...TIERS.flatMap((tier) => [
    path.join(outDir, "words", `${tier}.json`),
    path.join(outDir, "catalog", `${tier}.json`),
  ]),
];
const missing = required.filter((file) => !fs.existsSync(file));
if (!force && missing.length === 0) {
  console.log("morphology tier chunks already present (npm run build:morphology to regenerate)");
  process.exit(0);
}

const wordKeys = MORPHOLOGY_WORD_LIST.map((word, index) => {
  const keys = new Set();
  collectKeys(word.tree, keys);
  return { word, index, keys: [...keys], tier: wordTier(word) };
});

const keyTier = new Map();
for (const entry of wordKeys) {
  for (const key of entry.keys) {
    const prev = keyTier.get(key);
    if (!prev || RANK[entry.tier] < RANK[prev]) keyTier.set(key, entry.tier);
  }
}

const wordsByTier = emptyBuckets();
for (const entry of wordKeys) {
  wordsByTier[entry.tier].push({ ...entry.word, _order: entry.index });
}

const catalogByTier = emptyBuckets();
MORPHEME_CATALOG.forEach((row, index) => {
  const tier = keyTier.get(row.key) || "tier3";
  catalogByTier[tier].push({ ...row, _order: index });
});

const morphemes = MORPHEME_CATALOG.map((row) => ({
  key: row.key,
  morpheme: row.morpheme,
  meaning: row.meaning,
  tier: keyTier.get(row.key) || "tier3",
  wordIds: wordKeys.filter((entry) => entry.keys.includes(row.key)).map((entry) => entry.word.id),
}));

const manifest = {
  version: 1,
  tiers: TIERS,
  counts: {
    words: Object.fromEntries(TIERS.map((tier) => [tier, wordsByTier[tier].length])),
    catalog: Object.fromEntries(TIERS.map((tier) => [tier, catalogByTier[tier].length])),
  },
  words: wordKeys.map((entry) => ({
    id: entry.word.id,
    label: entry.word.label,
    tier: entry.tier,
    focusMorpheme: entry.word.focusMorpheme || "",
    keys: entry.keys,
  })),
  morphemes,
};

for (const tier of TIERS) {
  writeJson(path.join(outDir, "words", `${tier}.json`), wordsByTier[tier]);
  writeJson(path.join(outDir, "catalog", `${tier}.json`), catalogByTier[tier]);
}
writeJson(manifestPath, manifest);

const wordCount = TIERS.reduce((sum, tier) => sum + wordsByTier[tier].length, 0);
const catalogCount = TIERS.reduce((sum, tier) => sum + catalogByTier[tier].length, 0);
console.log(
  `morphology tiers: ${wordCount} words (${TIERS.map((tier) => `${tier}=${wordsByTier[tier].length}`).join(", ")}), ${catalogCount} morphemes`
);
if (wordCount !== MORPHOLOGY_WORD_LIST.length || catalogCount !== MORPHEME_CATALOG.length) {
  console.error("tier split dropped records");
  process.exit(1);
}

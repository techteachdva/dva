#!/usr/bin/env node
/**
 * Morphology Garden — word bank morpheme audit.
 *
 * Walks every lemma tree in MORPHEME_CATALOG-expanded MORPHOLOGY_WORD_LIST and reports:
 *   - morphemeKey values used on the board that are missing from MORPHEME_CATALOG
 *   - catalog rows referenced by the bank whose `meaning` field is empty (chart / lessons)
 *   - nodes whose gloss is only a generic placeholder or the literal "stem" (stub residue)
 *
 * Usage (from repo root):
 *   node scripts/audit-morphology-bank.mjs
 *   npm run audit:morphology
 *
 * Exit code 1 if any ERROR exists (missing pfx/sfx/root catalog key, UNUSED_CATALOG_KEY,
 * or empty `meaning` on a catalog row that is used by the bank). WARNINGS (lex:* not in catalog,
 * "stem" glosses, etc.) do not change the exit code.
 *
 *   node scripts/audit-morphology-bank.mjs --lenient
 *
 * --lenient  Always exit 0 (use locally when you only want the printed report).
 */

import { MORPHOLOGY_WORD_LIST } from "../src/site/scripts/morphology-words-data.js";
import { MORPHEME_CATALOG } from "../src/site/scripts/morphology-morpheme-catalog.js";

const lenient = process.argv.includes("--lenient") || process.env.MORPH_AUDIT_LENIENT === "1";

const catalogByKey = new Map(MORPHEME_CATALOG.map((r) => [r.key, r]));

/** @param {any} node */
function walkTree(node, wordId, out) {
  if (!node) return;
  const k = typeof node.morphemeKey === "string" ? node.morphemeKey : "";
  const gloss = typeof node.gloss === "string" ? node.gloss.trim() : "";
  const text = typeof node.text === "string" ? node.text : "";
  if (k) out.push({ wordId, key: k, gloss, text });
  const ch = node.children;
  if (Array.isArray(ch)) for (const c of ch) walkTree(c, wordId, out);
}

/** Every segment node (for stem / gloss quality, including nodes without morphemeKey). */
function walkTreeSegments(node, wordId, out) {
  if (!node) return;
  const gloss = typeof node.gloss === "string" ? node.gloss.trim() : "";
  const text = typeof node.text === "string" ? node.text : "";
  const k = typeof node.morphemeKey === "string" ? node.morphemeKey : "";
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  if (text || gloss) out.push({ wordId, key: k, gloss, text, leaf: !hasChildren });
  if (Array.isArray(node.children)) for (const c of node.children) walkTreeSegments(c, wordId, out);
}

const nodes = [];
const segments = [];
for (const w of MORPHOLOGY_WORD_LIST) {
  walkTree(w.tree, w.id, nodes);
  walkTreeSegments(w.tree, w.id, segments);
}

const usedKeys = new Set(nodes.map((n) => n.key));

/** Catalog keys never attached to any tree node (strict bank ↔ catalog parity). */
const unusedCatalogKeys = [...catalogByKey.keys()].filter((k) => !usedKeys.has(k)).sort();

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];

// --- Keys in trees but not in catalog
const missingByKey = new Map();
for (const n of nodes) {
  if (!catalogByKey.has(n.key)) missingByKey.set(n.key, (missingByKey.get(n.key) || 0) + 1);
}
const missingLex = [];
const missingOther = [];
for (const k of [...missingByKey.keys()].sort()) {
  if (k.startsWith("lex:")) missingLex.push(k);
  else missingOther.push(k);
}
if (missingOther.length) {
  for (const k of missingOther) {
    errors.push(`MISSING_CATALOG: ${k} (${missingByKey.get(k)} node(s)) — add a MORPHEME_CATALOG row or fix morphemeKey in trees`);
  }
}
if (missingLex.length) {
  for (const k of missingLex) {
    warnings.push(
      `LEX_NOT_IN_CATALOG: ${k} (${missingByKey.get(k)} node(s)) — expected for most free bases; meanings come from tree gloss / LEX_GLOSS_SUPPLEMENT / lex:care-style catalog rows`
    );
  }
}

for (const k of unusedCatalogKeys) {
  errors.push(`UNUSED_CATALOG_KEY: ${k} — no word-bank tree uses this MORPHEME_CATALOG row; add outsideExamples / fix morphCatalogStubTree or curate a lemma`);
}

// --- Used catalog rows with empty meaning
for (const k of usedKeys) {
  const row = catalogByKey.get(k);
  if (!row) continue;
  const m = row.meaning != null ? String(row.meaning).trim() : "";
  if (!m) {
    errors.push(`EMPTY_MEANING: catalog key ${k} is used in the word bank but has no \`meaning\` field`);
  }
}

// --- Weak node glosses (diagram / stub quality)
/* "stem" is reported separately (often stub residue, sometimes without morphemeKey). */
const genericExact = /^(prefix|suffix|root|bound base|free base)$/i;
const genericPrefix = /^(prefix:|suffix:)\s*$/i;
let stemCount = 0;
let genericCount = 0;
const stemSamples = [];
const genericSamples = [];

for (const n of nodes) {
  const g = n.gloss;
  if (genericExact.test(g) || genericPrefix.test(g)) {
    genericCount++;
    if (genericSamples.length < 12 && !genericSamples.some((s) => s.wordId === n.wordId && s.key === n.key && s.text === n.text)) {
      genericSamples.push({ wordId: n.wordId, key: n.key, text: n.text, gloss: g });
    }
  }
}
for (const s of segments) {
  if (s.gloss === "stem") {
    stemCount++;
    if (stemSamples.length < 12 && !stemSamples.some((x) => x.wordId === s.wordId && x.text === s.text)) {
      stemSamples.push({ wordId: s.wordId, key: s.key || "(no key)", text: s.text, gloss: s.gloss });
    }
  }
}
if (stemCount > 0) {
  warnings.push(`STEM_GLOSS: ${stemCount} node(s) use gloss "stem" (usually auto-stub residue) — curate or improve morphCatalogStubTree`);
  for (const s of stemSamples) {
    warnings.push(`  sample: ${s.wordId} → ${JSON.stringify(s.text)} key=${s.key}`);
  }
}
if (genericCount > 0) {
  warnings.push(`GENERIC_GLOSS: ${genericCount} node(s) use a one-word placeholder gloss`);
  for (const s of genericSamples) {
    warnings.push(`  sample: ${s.wordId} → ${JSON.stringify(s.text)} key=${s.key} gloss=${JSON.stringify(s.gloss)}`);
  }
}

// --- Summary counts
console.log("Morphology word bank audit");
console.log("==========================");
console.log(`Lemmas: ${MORPHOLOGY_WORD_LIST.length}`);
console.log(`Catalog rows: ${MORPHEME_CATALOG.length}`);
console.log(`Tree nodes with morphemeKey: ${nodes.length}`);
console.log(`Distinct morphemeKey values: ${usedKeys.size}`);
console.log(`Unused catalog keys: ${unusedCatalogKeys.length}`);
console.log("");

if (errors.length) {
  console.log(`ERRORS (${errors.length})`);
  console.log("-".repeat(40));
  for (const e of errors) console.log(e);
  console.log("");
}

if (warnings.length) {
  console.log(`WARNINGS (${warnings.length})`);
  console.log("-".repeat(40));
  for (const w of warnings) console.log(w);
  console.log("");
}

if (!errors.length && !warnings.length) {
  console.log("No errors or warnings.");
}

const exitCode = lenient ? 0 : errors.length ? 1 : 0;
if (!lenient && errors.length) {
  console.log("Exit 1 due to errors. Pass --lenient for exit 0 while fixing.");
}
process.exit(exitCode);

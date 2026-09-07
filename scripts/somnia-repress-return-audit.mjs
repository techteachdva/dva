#!/usr/bin/env node
/**
 * Audits Repress vs Return effects across Somnia card data.
 * Run: node scripts/somnia-repress-return-audit.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "site", "somnia", "data");
const jsDir = path.join(__dirname, "..", "src", "site", "somnia", "js");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), "utf8"));
}

const entries = [];

function classify(text, source, name, extra = {}) {
  if (!text) return;
  const lower = text.toLowerCase();
  const hasReturn = /\breturn\b/.test(lower);
  const hasRepress = /\brepress\b/.test(lower);
  if (!hasReturn && !hasRepress) return;

  let returnCards = 0;
  let repressCards = 0;
  let notes = [];

  const returnMatch = lower.match(/return\s*(?:dreamers\+|persona\+|personae\+|\+)?(\d+)/);
  if (returnMatch) returnCards += parseInt(returnMatch[1], 10);
  const returnPer = lower.match(/return\s+(\d+)\s+card/);
  if (returnPer) returnCards += parseInt(returnPer[1], 10);
  if (/return\s+\d+\s+repressed/.test(lower)) {
    const m = lower.match(/return\s+(\d+)\s+repressed/);
    if (m) returnCards += parseInt(m[1], 10);
  }
  if (/return\s+1\s+card\s+per\s+persona/.test(lower)) {
    returnCards = 4;
    notes.push("scaled: 1×4p");
  }
  if (/return\s+1\s+card\s+from/.test(lower) && !returnMatch) returnCards += 1;
  if (/return\s+2\s+cards?/.test(lower) && !returnMatch) returnCards += 2;
  if (/return\s+3\s+cards?/.test(lower) && !returnMatch) returnCards += 3;
  if (/return\s+4\s+cards?/.test(lower) && !returnMatch) returnCards += 4;
  if (/return\s+8/.test(lower)) returnCards += 8;

  const repressMatch = lower.match(/repress\s*(?:dreamers\+|top\s+)?(\d+)/);
  if (repressMatch) repressCards += parseInt(repressMatch[1], 10);
  if (/repress\s+this/.test(lower)) repressCards += 1;
  if (/repress\s+1\s+psyche/.test(lower)) repressCards += 1;
  if (/repress\s+top\s+(\d+)/.test(lower)) {
    const m = lower.match(/repress\s+top\s+(\d+)/);
    repressCards += parseInt(m[1], 10);
  }
  if (/repress\s+all/.test(lower)) {
    repressCards += 3;
    notes.push("variable: all");
  }
  if (/repress\s+active\s+encounters/.test(lower)) {
    repressCards += 2;
    notes.push("variable: encounters");
  }

  entries.push({
    source,
    name,
    text: text.slice(0, 120),
    return: hasReturn,
    repress: hasRepress,
    returnEst: returnCards,
    repressEst: repressCards,
    notes: notes.join("; "),
    ...extra,
  });
}

// Objects
readJson("objects").forEach((o) => {
  classify(o.text, "Object", o.name, { suit: o.suit, id: o.id });
  if (o.tags?.some((t) => t.startsWith("stick"))) {
    classify("Set: Return Dreamers+3 Cards.", "Object Set", `${o.name} (Stick set)`, { suit: o.suit });
  }
  if (o.tags?.some((t) => t.startsWith("body"))) {
    classify("Set: Return Dreamers+5 cards.", "Object Set", `${o.name} (Body set)`, { suit: o.suit });
  }
  if (o.tags?.some((t) => t.startsWith("chess"))) {
    classify("Set: Return Persona+2 Cards.", "Object Set", `${o.name} (Chess set)`, { suit: o.suit });
  }
});

// Dreams
readJson("dreams").forEach((d) => classify(d.text, "Dream", d.name, { id: d.id }));

// Mindstream events
const mindstream = readJson("mindstream");
Object.entries(mindstream).forEach(([suit, events]) => {
  events.forEach((e) => classify(e.text, `Mindstream (${suit})`, e.name, { id: e.id }));
});

// Dreambeasts
readJson("dreambeasts").forEach((b) => {
  classify(b.effect, "Dreambeast Effect", b.name, { suit: b.suit });
  classify(b.fail, "Dreambeast Fail", b.name, { suit: b.suit });
  if (b.rejectReward) classify(b.rejectReward, "Dreambeast Reject", b.name, { suit: b.suit });
});

// Landscapes
const landscapeActions = {
  "return-2": "Return 2 cards.",
  "return-psyche": "Return 1 Psyche from Subconscious.",
  "return-object": "Return 1 Object from Subconscious.",
  "return-event": "Return 1 Event from Subconscious.",
};
readJson("landscapes").forEach((l) => {
  if (landscapeActions[l.uniqueAction]) {
    classify(landscapeActions[l.uniqueAction], "Landscape", l.name, { id: l.id });
  }
});

// Archetypes
readJson("archetypes").forEach((a) => {
  classify(a.power, "Archetype Power", a.name, { id: a.id });
});

// Wild psyche (rules.js)
classify(
  "After playing Wild Psyche, Repress Wild plus top card of each Mindstream deck.",
  "Psyche Deck",
  "Wild Psyche (×6)",
  { instances: 6, repressEst: 4 },
);

// Verify object suits
const objects = readJson("objects");
const suitCounts = { lucidity: 0, elasticity: 0, willpower: 0 };
const expected = {
  elasticity: ["row-boat", "hourglass", "conch-shell", "rope", "marble-grid", "mobius-crystal", "raven-claw", "severed-torso", "brass-emerald-bracelet", "bag-of-teeth", "the-bottom-stick", "severed-legs", "water", "air", "the-all", "the-nothing-elasticity"],
  lucidity: ["candle", "mirror", "rabbits-foot", "possibility-polyhedral", "ivory-pawn", "psychic-owl", "severed-head", "flower", "tear-of-moon", "egg", "red-apple", "golden-ruby-necklace", "the-middle-stick", "earth", "the-all-seeing-eye", "the-nothing-lucidity"],
  willpower: ["knife", "crystal-bell", "tooth-saber", "skeleton-key", "monkey-paw", "ebony-pawn", "hammer", "severed-arms", "beating-heart", "silver-sapphire-ring", "coins", "the-one", "the-top-stick", "spark-of-sun", "fire", "the-nothing-willpower"],
};

objects.forEach((o) => {
  if (o.suit) suitCounts[o.suit] += 1;
});

const suitErrors = [];
Object.entries(expected).forEach(([suit, ids]) => {
  const actual = objects.filter((o) => o.suit === suit).map((o) => o.id).sort();
  const want = [...ids].sort();
  if (JSON.stringify(actual) !== JSON.stringify(want)) {
    suitErrors.push({ suit, missing: want.filter((id) => !actual.includes(id)), extra: actual.filter((id) => !want.includes(id)) });
  }
});

const returnOnly = entries.filter((e) => e.return && !e.repress);
const repressOnly = entries.filter((e) => e.repress && !e.return);
const both = entries.filter((e) => e.return && e.repress);

const totals = entries.reduce(
  (acc, e) => {
    acc.returnCards += e.returnEst || (e.return ? 1 : 0);
    acc.repressCards += e.repressEst || (e.repress ? 1 : 0);
    if (e.return) acc.returnEffects += 1;
    if (e.repress) acc.repressEffects += 1;
    return acc;
  },
  { returnEffects: 0, repressEffects: 0, returnCards: 0, repressCards: 0 },
);

const report = {
  generatedAt: new Date().toISOString(),
  objectSuitCounts: suitCounts,
  suitValidation: suitErrors.length ? { ok: false, errors: suitErrors } : { ok: true },
  nothingVariants: objects.filter((o) => o.id.startsWith("the-nothing")).map((o) => ({ id: o.id, suit: o.suit })),
  summary: {
    totalEffectsTagged: entries.length,
    returnOnly: returnOnly.length,
    repressOnly: repressOnly.length,
    both: both.length,
    ratioReturnToRepress: totals.repressEffects
      ? (totals.returnEffects / totals.repressEffects).toFixed(2)
      : "∞",
    estimatedCardVolume: totals,
  },
  bySource: {},
  entries,
};

for (const e of entries) {
  report.bySource[e.source] = report.bySource[e.source] || { return: 0, repress: 0 };
  if (e.return) report.bySource[e.source].return += 1;
  if (e.repress) report.bySource[e.source].repress += 1;
}

const outPath = path.join(__dirname, "somnia-repress-return-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log("=== Somnia Repress / Return Audit ===\n");
console.log("Object suits per Mindstream deck:", suitCounts);
console.log("Suit validation:", suitErrors.length ? "FAIL" : "OK");
if (suitErrors.length) console.log(JSON.stringify(suitErrors, null, 2));
console.log("\nThe Nothing variants:", report.nothingVariants.map((n) => `${n.suit} (${n.id})`).join(", "));
console.log("\nEffect counts:");
console.log(`  Return-only: ${returnOnly.length}`);
console.log(`  Repress-only: ${repressOnly.length}`);
console.log(`  Both:         ${both.length}`);
console.log(`  Return/Repress ratio: ${report.summary.ratioReturnToRepress}`);
console.log("\nBy source:");
Object.entries(report.bySource)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([src, counts]) => {
    console.log(`  ${src}: ${counts.return} return · ${counts.repress} repress`);
  });
console.log(`\nFull report: ${outPath}`);

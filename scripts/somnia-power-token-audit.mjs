#!/usr/bin/env node
/**
 * Audits all Power Token gain sources in Somnia data + code.
 * Run: node scripts/somnia-power-token-audit.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "site", "somnia", "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), "utf8"));
}

const sources = [];

function add(category, name, amount, notes, instances = 1) {
  sources.push({ category, name, amount, notes, instances, totalTokens: amount * instances });
}

add("Session", "Game start", 2, "Per Dreamer at round 1", 1);
add("Session", "Death respawn", 2, "Per Dreamer returning after death", 1);

add("Psyche Deck", "Power Surge", 2, "6 cards in 57-card deck; resolve on draw", 6);

add("Mindstream Deck", "Power Token card", 2, "6 per suit × 3 suits = 18 dedicated cards", 18);

const mindstream = readJson("mindstream");
Object.values(mindstream).flat().forEach((ev) => {
  if (!ev.text || !/power token/i.test(ev.text)) return;
  let amount = 1;
  const m = ev.text.match(/(\d+)\s*Power Token/i);
  if (m) amount = parseInt(m[1], 10);
  add("Mindstream Event", ev.name, amount, ev.text);
});

const beasts = readJson("dreambeasts");
beasts.filter((b) => b.rejectEffect?.type === "gain-power").forEach((b) => {
  add("Dreambeast Reject", b.name, b.rejectEffect.count || 1, b.rejectReward || "");
});

readJson("landscapes").filter((l) => l.uniqueAction === "take-power").forEach((l) => {
  add("Landscape Action", l.name, 1, "Meet unique action: take 1 from pool");
});

readJson("objects").forEach((o) => {
  if (!/power token/i.test(o.text || "")) return;
  const m = (o.text || "").match(/(\d+)\s*Power Token/i);
  add("Object", o.name, m ? parseInt(m[1], 10) : 1, o.text);
});

const sinks = [
  { name: "Dreamer Power", cost: 1, frequency: "Each Meet, per Dreamer" },
  { name: "Archetype Quest", cost: 1, frequency: "×2 per Archetype acquired" },
  { name: "Archetype Power", cost: 1, frequency: "Meet, per acquired power used" },
  { name: "Coin flip spread", cost: 1, frequency: "Meet, +1 or +2 to spread" },
  { name: "Activate Persistent", cost: 1, frequency: "Meet" },
  { name: "Death avoidance", cost: "1–2", frequency: "When Psyche hits 0" },
];

const byCategory = {};
sources.forEach((s) => {
  if (!byCategory[s.category]) byCategory[s.category] = { items: [], maxOnce: 0 };
  byCategory[s.category].items.push(s);
  byCategory[s.category].maxOnce += s.totalTokens;
});

const report = {
  poolCap: 24,
  gainSources: sources,
  gainByCategory: byCategory,
  spendSinks: sinks,
  summary: {
    psychePowerCardMax: 12,
    mindstreamDedicatedCardMax: 36,
    mindstreamEventTypes: Object.values(mindstream).flat().filter((e) => /power token/i.test(e.text || "")).length,
    dreambeastRejectPower: beasts.filter((b) => b.rejectEffect?.type === "gain-power").length,
    landscapeTakePower: readJson("landscapes").filter((l) => l.uniqueAction === "take-power").length,
  },
};

const outPath = path.join(__dirname, "somnia-power-token-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
console.log("Wrote", outPath);

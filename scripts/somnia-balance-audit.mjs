#!/usr/bin/env node
/**
 * Rough tone audit: dreams + mindstream events (boon vs hazard).
 * Target mix ~33% boon / 66% hazard in session draws (see data.js weights).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src/site/somnia");
const dreams = JSON.parse(fs.readFileSync(path.join(root, "data/dreams.json"), "utf8"));
const mindstream = JSON.parse(fs.readFileSync(path.join(root, "data/mindstream.json"), "utf8"));

const DREAM_BOON_IDS = new Set([
  "quiet", "recovery", "well-being", "heroism", "transformation", "travel", "wanderlust",
]);
const EVENT_BOON_IDS = new Set([
  "centering", "friendship", "flashing-lights", "i-know-this-place", "harmonic-resonance",
  "sacred-geometry", "clear-as-crystal", "into-the-next",
]);

const regular = dreams.filter((d) => d.type === "dream");
let boonCopies = 0;
let hazardCopies = 0;
regular.forEach((d) => {
  const c = d.copies || 1;
  if (DREAM_BOON_IDS.has(d.id)) boonCopies += c;
  else hazardCopies += c;
});
const dreamTotal = boonCopies + hazardCopies;

const suits = ["lucidity", "elasticity", "willpower"];
let evtBoon = 0;
let evtHazard = 0;
suits.forEach((suit) => {
  (mindstream[suit] || []).forEach((e) => {
    if (EVENT_BOON_IDS.has(e.id)) evtBoon += 1;
    else evtHazard += 1;
  });
});
const evtTotal = evtBoon + evtHazard;

console.log(JSON.stringify({
  dreamPool: {
    boonCopies,
    hazardCopies,
    total: dreamTotal,
    hazardPct: Math.round((hazardCopies / dreamTotal) * 100),
    targetHazardPct: 66,
  },
  mindstreamEventsUnique: {
    boon: evtBoon,
    hazard: evtHazard,
    total: evtTotal,
    hazardPct: Math.round((evtHazard / evtTotal) * 100),
  },
  sessionDreamCounts: { daydream: 11, nap: 14, deep: 18 },
  note: "Session mix uses weighted pick in buildDreamDeck / buildMindstreamDecks (~66% hazard).",
}, null, 2));

#!/usr/bin/env node
import fs from "fs";
import zlib from "zlib";

const b64 = process.argv[2];
if (!b64) {
  console.error("Usage: node scripts/analyze-somnia-save.mjs <base64-gzip>");
  process.exit(1);
}

const buf = Buffer.from(b64.trim(), "base64");
const raw = zlib.gunzipSync(buf).toString("utf8");
const payload = JSON.parse(raw);
const g = payload.game || payload;

function names(cards) {
  return (cards || []).map((c) => `${c.name || c.id}${c.boss ? " (boss)" : ""}${c.type ? ` [${c.type}]` : ""}`);
}

const dreamDiscard = g.dreamDiscard || [];
const subBeasts = g.subconscious?.dreambeasts || [];
const boardBosses = [];
(g.board || []).forEach((t) => {
  (t.encounters || []).forEach((e) => {
    if (e.boss || ["leviathan", "cerberus", "double"].includes(e.id)) {
      boardBosses.push(`${e.name} @ ${t.id}`);
    }
  });
});

const report = {
  round: g.round,
  phase: g.phaseIndex,
  phaseName: ["Reveal", "Explore", "Meet"][g.phaseIndex],
  activeArchetype: g.activeArchetype?.name,
  archetypeQuests: g.activeArchetype?.quests,
  questProgress: g.activeArchetype?.questProgress,
  dreamDrawn: g.dreamDrawn,
  landscapePick: g.landscapePick,
  pendingEffectChoice: g.pendingEffectChoice
    ? { cardId: g.pendingEffectChoice.cardId, title: g.pendingEffectChoice.title, ui: g.pendingEffectChoice.ui }
    : null,
  pendingObjectFollowup: g.pendingObjectFollowup,
  forcedAccept: g.forcedAccept,
  dreamDiscard: names(dreamDiscard),
  leviathanInDreamDiscard: dreamDiscard.filter((c) => c.id === "leviathan" || c.name === "Leviathan"),
  subconsciousDreambeasts: names(subBeasts),
  leviathanInSubconscious: subBeasts.filter((c) => c.id === "leviathan" || c.name === "Leviathan"),
  boardBosses,
  dreamDeckTop5: (g.dreamDeck || []).slice(0, 5).map((c) => c.name),
  players: (g.players || []).map((p) => ({
    name: p.name,
    dreamer: p.dreamer?.name,
    landscapeId: p.landscapeId,
    powerTokens: p.powerTokens,
    alive: p.alive,
  })),
};

console.log(JSON.stringify(report, null, 2));

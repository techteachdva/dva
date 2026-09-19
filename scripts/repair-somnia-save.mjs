#!/usr/bin/env node
/** Apply boss-discard repair to a gzip base64 save; print repaired base64 + summary. */
import fs from "fs";
import zlib from "zlib";

const BOSS_IDS = new Set(["cerberus", "double", "leviathan"]);

function isBossDreamCard(card) {
  if (!card) return false;
  return !!(card.boss || card.type === "boss-dream" || BOSS_IDS.has(card.id));
}

function bossOnBoard(state, card) {
  return (state.board || []).some((t) =>
    (t.encounters || []).some(
      (e) => e.id === card.id || e.refId === card.id
    )
  );
}

function normalizeSubconscious(sub) {
  if (!sub) return { psyche: [], dreambeasts: [], objects: [], other: [], mindstream: { lucidity: [], elasticity: [], willpower: [] } };
  if (!sub.dreambeasts) sub.dreambeasts = [];
  return sub;
}

function repair(state) {
  state.subconscious = normalizeSubconscious(state.subconscious);
  const kept = [];
  const moved = [];
  for (const card of state.dreamDiscard || []) {
    if (isBossDreamCard(card) && !bossOnBoard(state, card)) {
      state.subconscious.dreambeasts.push({ ...card, type: "dreambeast", boss: true });
      moved.push(card.name || card.id);
    } else {
      kept.push(card);
    }
  }
  state.dreamDiscard = kept;
  return moved;
}

const input = process.argv[2] || fs.readFileSync(new URL("./user-save.b64", import.meta.url), "utf8");
const wrapper = JSON.parse(zlib.gunzipSync(Buffer.from(input.trim(), "base64")).toString("utf8"));
const game = wrapper.game || wrapper;
const moved = repair(game);
const outText = JSON.stringify(wrapper);
const outB64 = zlib.gzipSync(Buffer.from(outText, "utf8")).toString("base64");

console.log("Moved to subconscious dreambeasts:", moved);
console.log(
  "Subconscious beasts:",
  (game.subconscious.dreambeasts || []).map((c) => c.name)
);
console.log(
  "Dream discard bosses remaining:",
  (game.dreamDiscard || []).filter(isBossDreamCard).map((c) => c.name)
);
console.log("\n--- repaired stateData (gzip base64) ---\n");
console.log(outB64);

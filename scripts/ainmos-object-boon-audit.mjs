/**
 * Ainmos Object and Boon audit.
 *
 * Plays every Object and every Boon power in six table setups (a normal Meet,
 * an empty hand, no beasts, only The Bed, a Boss on the board, an empty
 * Subconscious), answers every follow-up choice the way the sim bot would, and
 * reports crashes, choices that never resolve, and effects that changed nothing.
 * Boon passives and rule Boons run whole sim nights with the Boon held from the start.
 *
 *   node scripts/ainmos-object-boon-audit.mjs            (writes scripts/ainmos-audit-report.json)
 */

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import * as sim from "./ainmos-bot-sim.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS = join(__dirname, "../src/site/ainmos/js");
const archetypesMod = await import(pathToFileURL(join(JS, "dreamers/archetypes.js")).href);
const { DATA, helpers, playGame, resolveOnePending, stateMod, gameMod, boonMod, objectsMod, placeFromVault } = sim;
const { createInitialState, addEncounterOnLandscape } = stateMod;

const OBJECTS = DATA.objects;
const SCENARIOS = ["normal", "empty-hand", "no-beasts", "bed-only", "boss", "empty-sub"];
const PENDING_CAP = 80;

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** A Meet in progress on a small dream, shaped by the scenario. */
function table(scenario, seed) {
  const dreamer = DATA.dreamers[seed.length % DATA.dreamers.length];
  const state = createInitialState(DATA, { lengthKey: "nap", seed, selectedDreamers: [dreamer], boardMode: "freeform" });
  const player = state.players[0];
  state.pendingMindstreamChoice = null;
  state.pendingDreamChoice = null;
  state.resolutionQueue = [];
  state.pendingRepress = null;
  if (scenario !== "bed-only") {
    state.landscapePick = { mode: "reveal", remaining: 6, picked: [] };
    for (let i = 0; i < 6; i += 1) {
      try { placeFromVault(state); } catch { break; }
      if (!state.landscapePick) break;
    }
    state.landscapePick = null;
  }
  state.phaseIndex = 2;
  state.dreamDrawn = true;
  state.revealLandscapeUsed = true;
  state.exploreActivated = true;
  state.meetActionBudget = 6;
  state.meetActionsUsed = 0;
  player.powerTokens = 2;
  const outer = state.board.filter((t) => t.revealed && !t.wasteland && t.id !== "bed");
  if (outer[0]) player.landscapeId = outer[0].id;
  state.selectedLandscapeId = player.landscapeId;
  const beasts = DATA.dreambeasts.filter((b) => !b.boss);
  if (scenario !== "no-beasts") {
    addEncounterOnLandscape(state, player.landscapeId, { ...beasts[0], type: "dreambeast", accept: 4, reject: 4, repress: 4, instanceId: uid("enc") });
    const far = outer[2] || state.board.find((t) => t.id === "bed");
    addEncounterOnLandscape(state, far.id, { ...beasts[1], type: "dreambeast", accept: 5, reject: 5, repress: 5, instanceId: uid("enc") });
  }
  if (scenario === "boss") {
    const turtle = DATA.dreambeasts.find((b) => b.id === "winged-turtle");
    addEncounterOnLandscape(state, player.landscapeId, { ...turtle, type: "dreambeast", boss: true, accept: 1, reject: 1, repress: 1, stack: [1, 2, 3], stackIndex: 0, instanceId: uid("boss") });
  }
  if (scenario === "empty-hand") player.hand = [];
  if (scenario !== "empty-sub") {
    // A few cards in the Subconscious so Return and Remember have something to find.
    const moved = state.psycheDeck.splice(0, 4);
    moved.forEach((card) => state.subconscious.psyche?.push?.(card));
  }
  state.activeEncounter = null;
  return { state, player };
}

/** Everything an effect could plausibly touch, minus the log. */
function fingerprint(state) {
  const p = state.players[0];
  return JSON.stringify({
    hand: (p.hand || []).map((c) => c.instanceId).sort(),
    objects: (p.objects || []).map((c) => c.instanceId).sort(),
    persistent: (p.persistent || []).map((c) => c.instanceId).sort(),
    tokens: p.powerTokens,
    where: p.landscapeId,
    board: state.board.map((t) => `${t.id}@${t.q},${t.r}:${t.revealed ? 1 : 0}${t.wasteland ? "w" : ""}[${(t.encounters || []).map((e) => e.instanceId).join("|")}]`).sort(),
    decks: {
      psyche: state.psycheDeck.length,
      psycheTop: state.psycheDeck.slice(0, 3).map((c) => c.instanceId),
      discard: (state.psycheDiscard || []).length,
      mind: Object.fromEntries(Object.entries(state.mindstreamDecks).map(([k, v]) => [k, v.slice(0, 3).map((c) => c.instanceId).join(",") + `#${v.length}`])),
      dream: state.dreamDeck.slice(0, 3).map((c) => c.instanceId),
      tiles: (state.landscapeTileDeck || []).length,
    },
    sub: JSON.stringify(state.subconscious).length,
    forms: state.formLevels,
    mini: state.minisDefeated,
    bosses: state.bossesDefeated,
    free: state.freeInsights,
    nextFight: state.nextFightDice,
    hollow: state.hollowDreams,
    spared: state.duskSparedRound,
    vault: (state.landscapeVault || []).map((c) => c.id),
    returning: (state.beastsToReturn || []).length,
    pick: state.landscapePick ? state.landscapePick.mode : null,
    acquired: state.acquiredPoints,
    status: state.status,
    deaths: state.deathClock,
    meetUsed: state.meetActionsUsed,
  });
}

function pendingKeys(state) {
  return Object.keys(state).filter((k) => (k.startsWith("pending") && !["pendingDreamQueue", "pendingPowerBonus", "pendingPowerBonusTokens", "pendingBeastMill"].includes(k) && state[k] && !(Array.isArray(state[k]) && !state[k].length))
    || (k === "landscapePick" && state[k])
    || (k === "beastsToReturn" && state[k]?.length));
}

/** Answer follow-ups until the table is quiet; report what got stuck. */
function settle(state) {
  let steps = 0;
  let last = "";
  let same = 0;
  while (pendingKeys(state).length && steps < PENDING_CAP) {
    const sig = pendingKeys(state).join(",") + fingerprint(state);
    same = sig === last ? same + 1 : 0;
    last = sig;
    if (same > 6) return { stuck: pendingKeys(state).join(",") };
    if (!resolveOnePending(state)) return { stuck: pendingKeys(state).join(",") };
    steps += 1;
  }
  return pendingKeys(state).length ? { stuck: pendingKeys(state).join(",") } : { steps };
}

function auditObject(obj) {
  const rows = {};
  for (const scenario of SCENARIOS) {
    const { state, player } = table(scenario, `audit-${obj.id}-${scenario}`);
    const card = { ...obj, type: "object", instanceId: uid("obj") };
    if (obj.subtype === "persistent") player.persistent.push(card);
    else player.objects.push(card);
    const before = fingerprint(state);
    let result = "ok";
    let detail = "";
    try {
      const played = gameMod.playObject(state, card.instanceId);
      const settled = settle(state);
      if (settled.stuck) { result = "stuck"; detail = settled.stuck; }
      const after = fingerprint(state);
      const sameExceptCard = before === after
        || JSON.stringify({ ...JSON.parse(after), objects: null, persistent: null, meetUsed: null }) === JSON.stringify({ ...JSON.parse(before), objects: null, persistent: null, meetUsed: null });
      if (result === "ok" && sameExceptCard) { result = "no-effect"; detail = (state.log || [])[0] || (played ? "" : "playObject returned nothing"); }
    } catch (err) {
      result = "error";
      detail = `${err.message} @ ${(err.stack || "").split("\n")[1]?.trim()}`;
    }
    rows[scenario] = detail ? `${result}: ${detail}` : result;
  }
  return rows;
}

function boonList() {
  const archetypes = (DATA.archetypes || []).map((a) => ({ id: `archetype:${a.id}`, kind: "archetype", name: a.name, archetype: a, power: a.power, passive: a.passive }));
  const extras = boonMod.BOON_EXTRAS.map((e) => ({ id: e.id, kind: e.kind, name: e.name, archetype: e.kind === "power" ? { id: e.id, name: e.name, power: e.power } : null, power: e.power, passive: e.kind === "rule" ? e.text : null }));
  return [...archetypes, ...extras];
}

function auditBoonPower(boon) {
  const rows = {};
  for (const scenario of SCENARIOS) {
    const { state, player } = table(scenario, `audit-boon-${boon.id}-${scenario}`);
    state.boons = [boon];
    const before = fingerprint(state);
    let result = "ok";
    let detail = "";
    try {
      const used = archetypesMod.useArchetypePower(state, boon.archetype, player, helpers);
      const settled = settle(state);
      if (settled.stuck) { result = "stuck"; detail = settled.stuck; }
      const after = fingerprint(state);
      const tokensOnly = JSON.stringify({ ...JSON.parse(after), tokens: null }) === JSON.stringify({ ...JSON.parse(before), tokens: null });
      if (result === "ok" && (before === after || tokensOnly)) { result = "no-effect"; detail = (state.log || [])[0] || (used === false ? "refused" : ""); }
    } catch (err) {
      result = "error";
      detail = `${err.message} @ ${(err.stack || "").split("\n")[1]?.trim()}`;
    }
    rows[scenario] = detail ? `${result}: ${detail}` : result;
  }
  return rows;
}

function auditBoonPassive(boon) {
  let errors = 0;
  let wins = 0;
  const games = 6;
  const samples = [];
  for (let i = 0; i < games; i += 1) {
    const row = playGame("daydream", 900 + i, (state) => {
      state.boons = [boon];
      if (boon.id === "wider-vault") state.vaultSize = 4;
      if (boon.id === "deep-pockets") state.objectLimit = 7;
    });
    if (row.error) { errors += 1; if (samples.length < 2) samples.push(row.error); }
    if (row.won) wins += 1;
  }
  return { games, errors, wins, samples };
}

let problems = 0;
const report = { objects: {}, boonPowers: {}, boonPassives: {} };
for (const obj of OBJECTS) report.objects[`${obj.id} (${obj.subtype})`] = auditObject(obj);
for (const boon of boonList()) {
  if (boon.archetype?.power) report.boonPowers[boon.name] = auditBoonPower(boon);
  else report.boonPassives[boon.name] = auditBoonPassive(boon);
}

/* ---- Focused rule checks ------------------------------------------------------------------- */
const checks = {};
function check(name, fn) {
  try { checks[name] = fn() ? "ok" : "FAILED"; } catch (err) { checks[name] = `error: ${err.message}`; }
}

// Each set completes when its last piece arrives, Acquires an Archetype, and Represses the set.
for (const [tag, need] of Object.entries({ body: 5, element: 4, jewelry: 3, stick: 3 })) {
  check(`set:${tag}`, () => {
    const { state, player } = table("normal", `set-${tag}`);
    const pieces = OBJECTS.filter((o) => o.tags?.includes(tag)).map((o) => ({ ...o, type: "object", instanceId: uid("obj") }));
    if (pieces.length < need) return false;
    pieces.slice(0, need - 1).forEach((o) => player.persistent.push(o));
    const before = state.acquiredPoints;
    const last = pieces[need - 1];
    player.objects.push(last);
    gameMod.playObject(state, last.instanceId);
    settle(state);
    const left = [...player.persistent, ...player.objects].filter((o) => o.tags?.includes(tag)).length;
    return state.acquiredPoints > before && left === 0;
  });
}
// The last piece bought from the shop also completes a set at once.
check("set:from-shop", () => {
  const { state, player } = table("normal", "set-shop");
  const sticks = OBJECTS.filter((o) => o.tags?.includes("stick")).map((o) => ({ ...o, type: "object", instanceId: uid("obj") }));
  sticks.slice(0, 2).forEach((o) => player.persistent.push(o));
  const before = state.acquiredPoints;
  objectsMod.onObjectDrawn(state, player, sticks[2], helpers);
  settle(state);
  return state.acquiredPoints > before;
});
// A returned Dreambeast lands on the board, never in a hand.
check("return:beast-to-board", () => {
  const { state, player } = table("no-beasts", "return-beast");
  const beast = { ...DATA.dreambeasts.find((b) => b.id === "jackalope"), type: "dreambeast", instanceId: uid("enc") };
  sim.subconscious.repressCard(state, beast);
  sim.subconscious.finalizeReturn(state, [beast]);
  settle(state);
  const onBoard = state.board.some((t) => (t.encounters || []).some((e) => e.id === "jackalope"));
  const inHand = player.hand.some((c) => c.id === "jackalope" || c.isDreambeastPsyche);
  return onBoard && !inHand;
});
// Every beast steps toward you at the start of Explore.
check("chase:explore-start", () => {
  const { state, player } = table("normal", "chase");
  const far = state.board.find((t) => t.revealed && !t.wasteland && (t.encounters || []).length && t.id !== player.landscapeId);
  if (!far) return false;
  const meetPhase = sim.stateMod;
  state.phaseIndex = 0;
  state.exploreActivated = false;
  const before = JSON.stringify(state.board.map((t) => (t.encounters || []).map((e) => e.instanceId)));
  sim.stateMod.advancePhase(state);
  const after = JSON.stringify(state.board.map((t) => (t.encounters || []).map((e) => e.instanceId)));
  return before !== after;
});
// Passive Objects refuse activation and spend nothing.
check("passive:no-activation", () => {
  const { state, player } = table("normal", "passive");
  const torso = { ...OBJECTS.find((o) => o.id === "severed-torso"), type: "object", instanceId: uid("obj") };
  player.persistent.push(torso);
  const used = state.meetActionsUsed;
  const played = gameMod.playObject(state, torso.instanceId);
  return !played && state.meetActionsUsed === used;
});
// Tooth-Saber on a Boss is a real win: the Boss counts as beaten and a Boon is offered.
check("tooth-saber:boss", () => {
  const { state, player } = table("no-beasts", "saber-boss");
  const shadows = DATA.dreambeasts.find((b) => b.id === "shadows");
  stateMod.addEncounterOnLandscape(state, player.landscapeId, { ...shadows, type: "dreambeast", boss: true, accept: 2, reject: 2, repress: 2, instanceId: uid("boss") });
  player.hand = Array.from({ length: 4 }, (_, i) => ({ id: `p${i}`, type: "psyche", suit: "willpower", value: 3, instanceId: uid("psy") }));
  const saber = { ...OBJECTS.find((o) => o.id === "tooth-saber"), type: "object", instanceId: uid("obj") };
  player.objects.push(saber);
  gameMod.playObject(state, saber.instanceId);
  settle(state);
  return (state.bossesDefeated || []).includes("shadows") && !player.hand.some((c) => c.isDreambeastPsyche);
});
// The All-Seeing Eye resolves the moment it is drawn and asks for 2 free placements.
check("eye:on-draw", () => {
  const { state, player } = table("normal", "eye");
  const eye = { ...OBJECTS.find((o) => o.id === "the-all-seeing-eye"), type: "object", instanceId: uid("obj") };
  const placed = state.board.length;
  objectsMod.onObjectDrawn(state, player, eye, helpers);
  settle(state);
  return state.board.length > placed;
});
report.checks = checks;
console.log("== Rule checks");
Object.entries(checks).forEach(([n, v]) => { if (v !== "ok") problems += 1; console.log(`${n.padEnd(24)} ${v}`); });

const out = join(__dirname, "ainmos-audit-report.json");
writeFileSync(out, JSON.stringify(report, null, 2));

const flag = (rows) => Object.entries(rows).filter(([, v]) => v !== "ok");
console.log("== Objects");
for (const [name, rows] of Object.entries(report.objects)) {
  const bad = flag(rows);
  if (!bad.length) continue;
  problems += bad.filter(([, v]) => !v.startsWith("no-effect")).length;
  console.log(`${name}`);
  bad.forEach(([s, v]) => console.log(`   ${s.padEnd(11)} ${v.slice(0, 170)}`));
}
console.log("== Boon powers");
for (const [name, rows] of Object.entries(report.boonPowers)) {
  const bad = flag(rows);
  if (!bad.length) continue;
  problems += bad.filter(([, v]) => !v.startsWith("no-effect")).length;
  console.log(`${name}`);
  bad.forEach(([s, v]) => console.log(`   ${s.padEnd(11)} ${v.slice(0, 170)}`));
}
console.log("== Boon passives (6 Daydreams each)");
for (const [name, r] of Object.entries(report.boonPassives)) {
  if (r.errors) problems += r.errors;
  console.log(`${name.padEnd(14)} errors ${r.errors}  wins ${r.wins}/${r.games}${r.samples.length ? `  ${r.samples[0].slice(0, 120)}` : ""}`);
}
console.log(`\n${problems} hard problems (errors/stuck). Wrote ${out}`);

/**
 * Somnia dev command toolkit — playtest mechanics without full playthroughs.
 * Enable: play.html?dev=1  or  /dev on  then press ` (backtick) to toggle console.
 */

import { uid, PHASES } from "./data.js";
import {
  activePlayer,
  headPlayer,
  addLog,
  landscapeById,
  revealLandscapeTile,
  drawPsycheForPlayer,
  setEncounterOnLandscape,
  acquireArchetype,
  handleDreamerDeath,
  getPhase,
} from "./state.js";
import { spawnEncounterOnLandscape, drawMindstreamCard } from "./game.js";
import { resolveCardEffect, createEffectHelpers } from "./effects.js";
import { resolveOnAcquire } from "./archetypes.js";
import { narrate } from "./narrator.js";
import {
  dreambeastToHandCard,
  repressCard,
  requestReturnCards,
  enqueueRepressObjects,
  enqueueRepressFromHand,
  listSubconsciousCards,
  subconsciousCount,
} from "./subconscious.js";
import {
  beginRevealPicking,
  triggerBedFinalRecurrence,
  requestForgetLandscapes,
  forgettableTiles,
  revealableTiles,
  cancelLandscapePick,
} from "./landscapes.js";

const DEV_KEY = "somnia.dev";

export function isDevMode() {
  try {
    if (sessionStorage.getItem(DEV_KEY) === "1") return true;
    if (new URLSearchParams(window.location.search).get("dev") === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function enableDevMode() {
  try {
    sessionStorage.setItem(DEV_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function disableDevMode() {
  try {
    sessionStorage.removeItem(DEV_KEY);
  } catch {
    /* ignore */
  }
}

function findById(list, token) {
  if (!token) return null;
  const lower = token.toLowerCase();
  return list.find((item) => item.id === lower)
    || list.find((item) => item.id.startsWith(lower))
    || list.find((item) => item.name?.toLowerCase().includes(lower));
}

function playerAt(state, token) {
  if (token == null || token === "") return activePlayer(state);
  const idx = parseInt(token, 10);
  if (!Number.isNaN(idx)) return state.players[idx] || activePlayer(state);
  return state.players.find((p) => p.id === token || p.name.toLowerCase().includes(token.toLowerCase()))
    || activePlayer(state);
}

function clearPickers(state) {
  state.pendingRepress = null;
  state.pendingReturn = null;
  state.resolutionQueue = [];
  state.landscapePick = null;
  state.tradeMode = false;
  state.trade = null;
  cancelLandscapePick(state);
}

function effectHelpers() {
  return {
    ...createEffectHelpers(spawnEncounterOnLandscape),
    drawObjects: null,
  };
}

function ok(message, lines = []) {
  return { ok: true, message, lines };
}

function fail(message) {
  return { ok: false, message };
}

function statusLines(state) {
  const p = activePlayer(state);
  return [
    `Phase: ${getPhase(state)} (index ${state.phaseIndex}) · Round ${state.round}`,
    `Status: ${state.status} · Points ${state.acquiredPoints}/${state.goalPoints}`,
    `Active: ${p.name} · Head: ${headPlayer(state).name}`,
    `Hand: ${p.hand.length} psyche · Objects: ${p.objects?.length || 0} · Power: ${p.powerTokens}`,
    `Meet: ${state.meetActionsUsed}/${state.meetActionBudget} · Explore moves: ${state.exploreMovesLeft}`,
    `Encounter: ${state.activeEncounter?.name || "none"} @ ${state.activeEncounterLandscapeId || "—"}`,
    `Dream drawn: ${state.dreamDrawn} · Decks: dream ${state.dreamDeck.length}, psyche ${state.psycheDeck.length}, beast ${state.dreambeastDeck.length}`,
    `Subconscious: ${subconsciousCount(state.subconscious)} cards`,
    `Pickers: repress=${!!state.pendingRepress} return=${!!state.pendingReturn} map=${state.landscapePick?.mode || "none"}`,
    `Final recurrence: ${state.finalRecurrence}`,
  ];
}

const COMMANDS = {
  help: {
    usage: "help [command]",
    desc: "List commands or show one command's usage.",
    run: (state, args, ctx) => {
      const q = args[0]?.toLowerCase();
      if (q) {
        const cmd = COMMANDS[q];
        if (!cmd) return fail(`Unknown command: ${q}`);
        return ok(`${q}: ${cmd.desc}\n  Usage: ${cmd.usage}`);
      }
      const groups = {
        Meta: ["help", "status", "clear", "dev"],
        Phase: ["phase", "advance", "round"],
        Cards: ["dream", "dreams", "psyche", "object", "objects", "beast-hand", "mindstream", "fill-sub"],
        Encounter: ["spawn", "beasts", "meet-budget", "explore-moves", "encounter-clear"],
        Map: ["reveal", "forget", "tile", "landscapes", "reveal-all", "wasteland-all", "bed-final", "final"],
        Subconscious: ["return", "repress"],
        Player: ["player", "head", "move", "power", "points", "kill"],
        Progress: ["quest", "acquire", "archetype", "win", "lose"],
        Scenarios: ["scenario", "scenarios"],
      };
      const lines = ["Somnia dev commands (prefix optional: / or >)", ""];
      Object.entries(groups).forEach(([group, names]) => {
        lines.push(`[${group}]`);
        names.forEach((name) => {
          const c = COMMANDS[name];
          if (c) lines.push(`  ${name.padEnd(14)} ${c.desc}`);
        });
        lines.push("");
      });
      lines.push("Toggle console: ` (backtick) · Enable: ?dev=1 or /dev on");
      return ok(lines.join("\n"), lines);
    },
  },

  status: {
    usage: "status",
    desc: "Print current game state summary.",
    run: (state) => ok(statusLines(state).join("\n"), statusLines(state)),
  },

  clear: {
    usage: "clear",
    desc: "Clear pending pickers (repress, return, map, trade).",
    run: (state) => {
      clearPickers(state);
      return ok("Cleared all pending pickers and trade mode.");
    },
  },

  dev: {
    usage: "dev on|off",
    desc: "Enable or disable dev mode persistence.",
    run: (_state, args) => {
      if (args[0] === "off") {
        disableDevMode();
        return ok("Dev mode disabled (reload without ?dev=1 to hide console).");
      }
      enableDevMode();
      return ok("Dev mode enabled for this session.");
    },
  },

  phase: {
    usage: "phase reveal|explore|meet",
    desc: "Jump to a phase (resets phase flags).",
    run: (state, args) => {
      const name = (args[0] || "").toLowerCase();
      const idx = PHASES.findIndex((p) => p.toLowerCase() === name);
      if (idx < 0) return fail(`Phase must be: ${PHASES.join(", ")}`);
      state.phaseIndex = idx;
      state.exploreActivated = false;
      state.exploreMovesLeft = 0;
      state.meetActionBudget = 0;
      state.meetActionsUsed = 0;
      state.revealLandscapeUsed = false;
      state.dreamDrawn = false;
      clearPickers(state);
      return ok(`Jumped to ${PHASES[idx]} phase.`);
    },
  },

  advance: {
    usage: "advance",
    aliases: ["next"],
    desc: "Advance to the next phase (same as End Round on Meet).",
    run: (state, _args, ctx) => {
      ctx.endPhase();
      return ok(`Advanced to ${getPhase(state)} phase.`);
    },
  },

  round: {
    usage: "round <n>",
    desc: "Set round number.",
    run: (state, args) => {
      const n = parseInt(args[0], 10);
      if (Number.isNaN(n) || n < 1) return fail("Usage: round <positive number>");
      state.round = n;
      return ok(`Round set to ${n}.`);
    },
  },

  dreams: {
    usage: "dreams",
    desc: "List dream card ids.",
    run: (_s, _a, ctx) => {
      const ids = ctx.gameData.dreams.map((d) => `${d.id} (${d.type})`).join(", ");
      return ok(ids);
    },
  },

  dream: {
    usage: "dream <id>|draw",
    desc: "Resolve a specific dream effect, or draw from the Dream deck.",
    run: (state, args, ctx) => {
      if (args[0] === "draw") {
        const head = headPlayer(state);
        state.activePlayerIndex = state.players.indexOf(head);
        const card = state.dreamDeck.shift();
        if (!card) return fail("Dream deck empty.");
        state.activeDream = card;
        state.dreamDrawn = true;
        state.dreamDiscard = state.dreamDiscard || [];
        state.dreamDiscard.push(card);
        resolveCardEffect(state, card, head, effectHelpers());
        narrate(state, `[dev] Dream: ${card.name}`, card.text || "");
        return ok(`Drew and resolved: ${card.name}`);
      }
      const template = findById(ctx.gameData.dreams, args[0]);
      if (!template) return fail(`Dream not found: ${args[0]}. Try /dreams`);
      const card = { ...template, instanceId: uid("dream-dev") };
      state.activeDream = card;
      state.dreamDrawn = true;
      resolveCardEffect(state, card, activePlayer(state), effectHelpers());
      narrate(state, `[dev] Dream: ${card.name}`, card.text || "");
      return ok(`Resolved dream: ${card.name}`);
    },
  },

  psyche: {
    usage: "psyche <suit> <value> [count] [playerIndex]",
    desc: "Add Psyche cards to a player's hand.",
    run: (state, args) => {
      const suit = args[0]?.toLowerCase();
      const value = parseInt(args[1], 10);
      const count = parseInt(args[2], 10) || 1;
      const player = playerAt(state, args[3]);
      if (!["lucidity", "elasticity", "willpower"].includes(suit)) {
        return fail("Suit: lucidity | elasticity | willpower");
      }
      if (Number.isNaN(value) || value < 1) return fail("Value must be 1–6");
      for (let i = 0; i < count; i += 1) {
        player.hand.push({
          id: `${suit}-${value}`,
          type: "psyche",
          suit,
          value,
          name: `${suit} ${value}`,
          instanceId: uid("psyche-dev"),
        });
      }
      return ok(`Gave ${count}× ${suit} ${value} to ${player.name}.`);
    },
  },

  objects: {
    usage: "objects",
    desc: "List object ids.",
    run: (_s, _a, ctx) => ok(ctx.gameData.objects.map((o) => o.id).join(", ")),
  },

  object: {
    usage: "object <id> [playerIndex]",
    desc: "Give an Object to a player's hand.",
    run: (state, args, ctx) => {
      const template = findById(ctx.gameData.objects, args[0]);
      if (!template) return fail(`Object not found: ${args[0]}`);
      const player = playerAt(state, args[1]);
      const card = { ...template, instanceId: uid("obj-dev") };
      player.objects = player.objects || [];
      player.objects.push(card);
      return ok(`Gave ${card.name} to ${player.name}.`);
    },
  },

  "beast-hand": {
    usage: "beast-hand <id> [playerIndex]",
    desc: "Add an accepted Dreambeast (3 Psyche) to hand.",
    run: (state, args, ctx) => {
      const template = findById(ctx.gameData.dreambeasts, args[0]);
      if (!template) return fail(`Dreambeast not found: ${args[0]}`);
      const player = playerAt(state, args[1]);
      const card = dreambeastToHandCard({ ...template, instanceId: uid("beast-dev") });
      player.hand.push(card);
      return ok(`Gave accepted ${template.name} (3 ${template.suit}) to ${player.name}.`);
    },
  },

  beasts: {
    usage: "beasts",
    desc: "List dreambeast ids.",
    run: (_s, _a, ctx) => ok(ctx.gameData.dreambeasts.map((b) => b.id).join(", ")),
  },

  spawn: {
    usage: "spawn <beast-id> [landscape-id]",
    desc: "Place an Encounter on a Landscape (default: active player's tile).",
    run: (state, args, ctx) => {
      const template = findById(ctx.gameData.dreambeasts, args[0]);
      if (!template) return fail(`Beast not found: ${args[0]}`);
      const player = activePlayer(state);
      const landId = args[1] || player.landscapeId || "bed";
      const tile = landscapeById(state, landId);
      if (!tile) return fail(`Landscape not found: ${landId}`);
      const enc = { ...template, type: "dreambeast", instanceId: uid("enc-dev") };
      setEncounterOnLandscape(state, landId, enc);
      state.phaseIndex = 2;
      state.meetActionBudget = Math.max(state.meetActionBudget, 3);
      state.meetActionsUsed = 0;
      narrate(state, `[dev] Spawned ${enc.name}`, `On ${tile.name}. Meet phase ready with 3 actions.`);
      return ok(`Spawned ${enc.name} on ${tile.name}. Meet budget set to 3.`);
    },
  },

  "meet-budget": {
    usage: "meet-budget <n>",
    desc: "Set shared Meet action budget (and switch to Meet phase).",
    run: (state, args) => {
      const n = parseInt(args[0], 10);
      if (Number.isNaN(n) || n < 0) return fail("Usage: meet-budget <n>");
      state.phaseIndex = 2;
      state.meetActionBudget = n;
      state.meetActionsUsed = 0;
      state.lastMeetAction = null;
      return ok(`Meet phase · budget ${n}.`);
    },
  },

  "explore-moves": {
    usage: "explore-moves <n>",
    desc: "Set Explore moves remaining (and switch to Explore phase).",
    run: (state, args) => {
      const n = parseInt(args[0], 10);
      if (Number.isNaN(n) || n < 0) return fail("Usage: explore-moves <n>");
      state.phaseIndex = 1;
      state.exploreActivated = true;
      state.exploreMovesLeft = n;
      return ok(`Explore phase · ${n} moves.`);
    },
  },

  "encounter-clear": {
    usage: "encounter-clear",
    desc: "Remove active Encounter from the board.",
    run: (state) => {
      const id = state.activeEncounterLandscapeId;
      if (id) {
        const tile = landscapeById(state, id);
        if (tile) tile.encounter = null;
      }
      state.activeEncounter = null;
      state.activeEncounterLandscapeId = null;
      return ok("Encounter cleared.");
    },
  },

  reveal: {
    usage: "reveal <budget>",
    desc: "Start map reveal picking (click cyan hexes).",
    run: (state, args) => {
      const n = parseInt(args[0], 10) || 3;
      state.phaseIndex = 0;
      state.revealLandscapeUsed = false;
      beginRevealPicking(state, n);
      return ok(`Reveal pick mode · budget ${n}. Click cyan tiles.`);
    },
  },

  forget: {
    usage: "forget <count>",
    desc: "Start Forget picking (click red hexes).",
    run: (state, args) => {
      const n = parseInt(args[0], 10) || 1;
      requestForgetLandscapes(state, n);
      return ok(`Forget pick mode · choose ${n} tile(s).`);
    },
  },

  landscapes: {
    usage: "landscapes",
    desc: "List landscape ids and reveal state.",
    run: (state) => {
      const lines = state.board.map((t) => {
        const face = t.revealed && !t.wasteland ? "active" : "wasteland";
        return `${t.id} (${t.name}) @ (${t.q},${t.r}) · ${face}`;
      });
      return ok(lines.join("\n"), lines);
    },
  },

  tile: {
    usage: "tile <landscape-id> reveal|forget|wasteland",
    desc: "Directly change a tile without picking UI.",
    run: (state, args) => {
      const tile = landscapeById(state, args[0]);
      if (!tile) return fail(`Tile not found: ${args[0]}`);
      const action = args[1]?.toLowerCase();
      if (action === "reveal") {
        revealLandscapeTile(state, tile);
        tile.revealed = true;
        tile.wasteland = false;
        return ok(`${tile.name} revealed.`);
      }
      if (action === "forget" || action === "wasteland") {
        requestForgetLandscapes(state, 1);
        if (state.landscapePick) {
          state.landscapePick = null;
        }
        tile.revealed = false;
        tile.wasteland = true;
        return ok(`${tile.name} is now Wasteland.`);
      }
      return fail("Action: reveal | forget | wasteland");
    },
  },

  "reveal-all": {
    usage: "reveal-all",
    desc: "Reveal every hidden pool Landscape.",
    run: (state) => {
      let n = 0;
      revealableTiles(state).forEach((t) => {
        revealLandscapeTile(state, t);
        n += 1;
      });
      return ok(`Revealed ${n} tile(s).`);
    },
  },

  "wasteland-all": {
    usage: "wasteland-all",
    desc: "Forget all non-Bed Landscapes (tests Bed flip trigger).",
    run: (state) => {
      forgettableTiles(state).forEach((t) => {
        t.revealed = false;
        t.wasteland = true;
      });
      return ok("All outer Landscapes set to Wasteland. Use /forget 1 to trigger Bed flip.");
    },
  },

  "bed-final": {
    usage: "bed-final",
    desc: "Flip The Bed and start Final Recurrence.",
    run: (state) => {
      triggerBedFinalRecurrence(state, "[dev] Forced Final Recurrence.");
      return ok("Final Recurrence started.");
    },
  },

  final: {
    usage: "final",
    aliases: ["final-recurrence"],
    desc: "Alias for bed-final.",
    run: (state, args, ctx) => COMMANDS["bed-final"].run(state, args, ctx),
  },

  return: {
    usage: "return <count> [playerIndex]",
    desc: "Open Return picker from Subconscious.",
    run: (state, args) => {
      const n = parseInt(args[0], 10) || 1;
      const player = playerAt(state, args[1]);
      const result = requestReturnCards(state, n, player);
      if (result?.pending) return ok(`Return picker open · choose ${result.count} card(s).`);
      if (result.length) return ok(`Auto-returned ${result.length} card(s).`);
      return fail("Subconscious empty — use /fill-sub first.");
    },
  },

  repress: {
    usage: "repress objects|hand <count> [playerIndex]",
    desc: "Open Repress picker for Objects or Psyche hand.",
    run: (state, args) => {
      const target = args[0]?.toLowerCase();
      const n = parseInt(args[1], 10) || 1;
      const player = playerAt(state, args[2]);
      if (target === "objects" || target === "object") {
        enqueueRepressObjects(state, player, n, { reason: `[dev] Repress ${n} Object(s).` });
        return ok(`Repress objects picker · ${n} for ${player.name}.`);
      }
      if (target === "hand" || target === "psyche") {
        enqueueRepressFromHand(state, player, n, { reason: `[dev] Repress ${n} Psyche.` });
        return ok(`Repress hand picker · ${n} for ${player.name}.`);
      }
      return fail("Usage: repress objects|hand <count>");
    },
  },

  "fill-sub": {
    usage: "fill-sub",
    desc: "Add sample Psyche, Object, and Mindstream cards to Subconscious.",
    run: (state, _args, ctx) => {
      const psyche = { type: "psyche", suit: "lucidity", value: 3, name: "Lucidity 3", instanceId: uid("sub") };
      const obj = { ...ctx.gameData.objects[0], instanceId: uid("sub") };
      const ms = { ...ctx.gameData.mindstream.lucidity[0], instanceId: uid("sub") };
      repressCard(state, psyche);
      repressCard(state, obj);
      repressCard(state, ms);
      return ok(`Subconscious now has ${subconsciousCount(state.subconscious)} cards (sample psyche, object, mindstream).`);
    },
  },

  player: {
    usage: "player <index>",
    desc: "Focus active Dreamer by index (0-based).",
    run: (state, args) => {
      const idx = parseInt(args[0], 10);
      if (Number.isNaN(idx) || !state.players[idx]) return fail(`Player index 0–${state.players.length - 1}`);
      state.activePlayerIndex = idx;
      return ok(`Active player: ${state.players[idx].name}.`);
    },
  },

  head: {
    usage: "head <index>",
    desc: "Set Head Dreamer by index.",
    run: (state, args) => {
      const idx = parseInt(args[0], 10);
      if (Number.isNaN(idx) || !state.players[idx]) return fail(`Player index 0–${state.players.length - 1}`);
      state.players.forEach((p) => { p.isHead = false; });
      state.players[idx].isHead = true;
      return ok(`Head Dreamer: ${state.players[idx].name}.`);
    },
  },

  move: {
    usage: "move <landscape-id>",
    desc: "Move active player to a Landscape.",
    run: (state, args) => {
      const tile = landscapeById(state, args[0]);
      if (!tile) return fail(`Landscape not found: ${args[0]}`);
      activePlayer(state).landscapeId = tile.id;
      state.selectedLandscapeId = tile.id;
      return ok(`Moved to ${tile.name}.`);
    },
  },

  power: {
    usage: "power <n> [playerIndex]",
    desc: "Set Power tokens.",
    run: (state, args) => {
      const n = parseInt(args[0], 10);
      const player = playerAt(state, args[1]);
      if (Number.isNaN(n)) return fail("Usage: power <n>");
      player.powerTokens = n;
      return ok(`${player.name} power = ${n}.`);
    },
  },

  points: {
    usage: "points <n>",
    desc: "Set acquired Archetype points.",
    run: (state, args) => {
      const n = parseInt(args[0], 10);
      if (Number.isNaN(n)) return fail("Usage: points <n>");
      state.acquiredPoints = n;
      return ok(`Acquired points = ${n}.`);
    },
  },

  kill: {
    usage: "kill [playerIndex]",
    desc: "Trigger dreamer death (0 Psyche simulation).",
    run: (state, args) => {
      const player = playerAt(state, args[0]);
      player.hand = [];
      handleDreamerDeath(state, player);
      return ok(`${player.name} lost to the Dreamscape — respawn flow triggered if dreamers remain.`);
    },
  },

  quest: {
    usage: "quest 0|1|both",
    desc: "Mark quest(s) complete on active Archetype (no validation).",
    run: (state, args) => {
      const arch = state.activeArchetype;
      if (!arch) return fail("No active Archetype.");
      const which = args[0] || "both";
      if (which === "both" || which === "0") arch.questProgress[0] = true;
      if (which === "both" || which === "1") arch.questProgress[1] = true;
      return ok(`Quests: ${arch.questProgress.map((d, i) => `${i}:${d ? "done" : "open"}`).join(", ")}`);
    },
  },

  acquire: {
    usage: "acquire",
    desc: "Force-acquire active Archetype for active player.",
    run: (state, args, ctx) => {
      const player = activePlayer(state);
      if (state.activeArchetype) {
        state.activeArchetype.questProgress = [true, true];
      }
      player.powerTokens = Math.max(player.powerTokens, 1);
      acquireArchetype(state, player, (s, arch, p) => {
        resolveOnAcquire(s, arch, p, effectHelpers());
      });
      return ok(`Acquire attempted. Points: ${state.acquiredPoints}.`);
    },
  },

  archetype: {
    usage: "archetype <id>",
    desc: "Set active Archetype from deck or data.",
    run: (state, args, ctx) => {
      const template = findById(ctx.gameData.archetypes, args[0]);
      if (!template) return fail(`Archetype not found: ${args[0]}`);
      state.activeArchetype = { ...template, instanceId: uid("arch-dev"), questProgress: [false, false] };
      return ok(`Active Archetype: ${template.name}.`);
    },
  },

  mindstream: {
    usage: "mindstream <suit> draw",
    desc: "Draw and resolve a Mindstream card (Meet phase).",
    run: (state, args) => {
      const suit = args[0]?.toLowerCase();
      if (!["lucidity", "elasticity", "willpower"].includes(suit)) {
        return fail("Suit: lucidity | elasticity | willpower");
      }
      state.phaseIndex = 2;
      state.meetActionBudget = Math.max(state.meetActionBudget, 1);
      const card = drawMindstreamCard(state, suit);
      if (!card) return fail(`No ${suit} Mindstream cards.`);
      return ok(`Resolved Mindstream: ${card.name}`);
    },
  },

  win: {
    usage: "win",
    desc: "Set game status to won.",
    run: (state) => {
      state.status = "won";
      return ok("Victory triggered.");
    },
  },

  lose: {
    usage: "lose",
    desc: "Set game status to lost.",
    run: (state) => {
      state.status = "lost";
      return ok("Defeat triggered.");
    },
  },

  scenarios: {
    usage: "scenarios",
    desc: "List named test scenarios.",
    run: () => ok([
      "betrayal — objects + run Betrayal dream",
      "meet — spawn werewolf, Meet budget 3",
      "return — fill Subconscious + Return picker",
      "repress — objects + repress picker",
      "reveal — Reveal phase pick mode",
      "forget — Forget pick + optional bed flip",
      "final — trigger Final Recurrence",
    ].join("\n")),
  },

  scenario: {
    usage: "scenario <name>",
    desc: "Run a preset playtest setup.",
    run: (state, args, ctx) => {
      const name = args[0]?.toLowerCase();
      const run = SCENARIOS[name];
      if (!run) return fail(`Unknown scenario. Try: ${Object.keys(SCENARIOS).join(", ")}`);
      const lines = run(state, ctx);
      return ok(`Scenario "${name}" loaded.`, lines);
    },
  },
};

const SCENARIOS = {
  betrayal(state, ctx) {
    const p = activePlayer(state);
    ctx.gameData.objects.slice(0, 4).forEach((o) => {
      p.objects.push({ ...o, instanceId: uid("obj-sc") });
    });
    COMMANDS.dream.run(state, ["betrayal"], ctx);
    return ["Gave 4 Objects", "Triggered Betrayal dream — repress picker should open"];
  },

  meet(state, ctx) {
    COMMANDS.spawn.run(state, ["werewolf"], ctx);
    COMMANDS.psyche.run(state, ["willpower", "3", "2"], ctx);
    return ["Spawned Werewolf", "Gave Willpower 3×2", "Select Psyche + Accept/Repress in UI"];
  },

  return(state, ctx) {
    COMMANDS["fill-sub"].run(state, [], ctx);
    COMMANDS.return.run(state, ["2"], ctx);
    return ["Filled Subconscious", "Opened Return picker for 2 cards"];
  },

  repress(state, ctx) {
    COMMANDS.object.run(state, ["knife"], ctx);
    COMMANDS.object.run(state, ["mirror"], ctx);
    COMMANDS.repress.run(state, ["objects", "2"], ctx);
    return ["Gave 2 Objects", "Opened repress objects picker"];
  },

  reveal(state, ctx) {
    COMMANDS.phase.run(state, ["reveal"], ctx);
    COMMANDS.psyche.run(state, ["lucidity", "2", "2"], ctx);
    COMMANDS.reveal.run(state, ["4"], ctx);
    return ["Reveal phase", "Lucidity cards added", "Reveal pick mode · 4 clicks"];
  },

  forget(state, ctx) {
    COMMANDS.forget.run(state, ["2"], ctx);
    return ["Forget pick mode for 2 tiles"];
  },

  final(state, ctx) {
    COMMANDS["bed-final"].run(state, [], ctx);
    return ["Final Recurrence started"];
  },
};

// Register aliases
Object.entries(COMMANDS).forEach(([name, cmd]) => {
  (cmd.aliases || []).forEach((alias) => {
    COMMANDS[alias] = cmd;
  });
});

export function parseDevInput(raw) {
  const line = raw.trim().replace(/^[/>]/, "").trim();
  if (!line) return { cmd: "", args: [] };
  const parts = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === " ") {
      if (cur) parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) parts.push(cur);
  const cmd = parts[0]?.toLowerCase() || "";
  const args = parts.slice(1);
  return { cmd, args };
}

export function executeDevCommand(state, line, ctx) {
  const { cmd, args } = parseDevInput(line);
  if (!cmd) return fail("Empty command. Try /help");

  const handler = COMMANDS[cmd];
  if (!handler) return fail(`Unknown command: ${cmd}. Type /help`);

  try {
    const result = handler.run(state, args, ctx);
    addLog(state, `[dev] ${result.message.split("\n")[0]}`);
    return result;
  } catch (err) {
    return fail(`Error: ${err.message}`);
  }
}

export function getDevCommandList() {
  return Object.keys(COMMANDS).filter((k) => !COMMANDS[k].aliases).sort();
}

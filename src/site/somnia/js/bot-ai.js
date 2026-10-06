/**
 * Shared Somnia bot helpers + in-browser spectator runner.
 * Used by the winrate sim (Node) and the `ai watch` / `ai start` dev commands.
 */
import {
  getPhase,
  activePlayer,
  landscapeById,
  allEncountersOnBoard,
  avoidDreamerDeath,
  acceptDreamerDeath,
  respawnDreamer,
} from "./state.js";
import {
  phaseOpeningActive,
  phaseSuitForOpening,
  bestPhaseContributor,
  projectedPhaseBudget,
  totalStat,
  cardCountsAsSuit,
  isWildPsyche,
  canUsePhasePowerToken,
} from "./rules.js";
import { psycheHandCount } from "./psyche.js";
import {
  listSubconsciousCards,
  isDreambeastPsycheCard,
  subconsciousCount,
  pickReturnCard,
  pickRepressCard,
  confirmRepressStep,
} from "./subconscious.js";
import { activeQuestLandscapeIds } from "./quests.js";
import { handLimitForPlayer, resolveNothingChoice } from "./objects.js";
import { revealableTiles, forgettableTiles, cancelLandscapePick } from "./landscapes.js";
import { getEventResolution } from "./event-resolutions.js";
import { resolveMindstreamChoice, canPayEventGood } from "./mindstream-choices.js";
import { hasAffectedLandscapes } from "./event-landscapes.js";
import { getLegalMoveTargets, hexDistance } from "./hex.js";
import { getLandscapeActionChoices } from "./landscape-actions.js";
import { resolveDreamChoice, advanceDreamQueue } from "./dream-choices.js";
import { resolveEffectChoice } from "./effect-choices.js";
import { resolveObjectChoice, resumeObjectEffect } from "./object-effects.js";
import {
  resolveDreamerPowerChoice,
  resolveDreamerPowerDeckPick,
  resolveDreamerPowerHandPick,
  handleDreamerPowerTilePick,
} from "./dreamer-powers.js";
import { isLeviathanCard } from "./dreambeasts.js";
import { isDiceBattleOpen, cancelDiceBattle } from "./dice-battle.js";

function alive(state) {
  return (state.players || []).filter((p) => p.alive);
}

function teamTokens(state) {
  return alive(state).reduce((s, p) => s + (p.powerTokens || 0), 0);
}

function unmarkedQuests(state) {
  const arch = state.activeArchetype;
  if (!arch?.questProgress) return 0;
  return arch.questProgress.filter((done) => !done).length;
}

/**
 * Choose a Mindstream / Dream fullscreen option. Returns choice id.
 */
export function pickMindstreamChoice(state, skill = "skilled") {
  const pending = state.pendingMindstreamChoice;
  if (!pending) return null;
  const player = state.players.find((p) => p.id === pending.playerId) || activePlayer(state);
  const card = pending.card;
  const choices = (pending.choices || []).map((c) => c.id);
  const has = (id) => choices.includes(id);
  const sloppy = skill === "sloppy";

  if (pending.kind === "event") {
    const resolution = getEventResolution(card?.refId || card?.id);
    const landscapesOk = hasAffectedLandscapes(state, card) || !(card?.landscapes?.length);
    if (
      has("good")
      && resolution
      && landscapesOk
      && canPayEventGood(state, player, resolution)
      && (!sloppy || Math.random() < 0.7)
    ) {
      return "good";
    }
    return has("bad") ? "bad" : choices[0] || null;
  }

  if (pending.kind === "object") {
    const room = handLimitForPlayer(state, player) - psycheHandCount(player);
    if (has("discard") && (room >= 2 || psycheHandCount(player) < 3) && (!sloppy || Math.random() < 0.55)) {
      return "discard";
    }
    return has("take") ? "take" : choices[0] || null;
  }

  if (pending.kind === "dreambeast") {
    const hand = psycheHandCount(player);
    const canAccept = (player.hand || []).some((c) => c.type !== "psyche-power" && c.type !== "psyche-dreambeast");
    const needMeet = unmarkedQuests(state) > 0 || !!state.finalRecurrence;
    // Accept when we have a real hand; flee thin hands; repress only as last resort.
    if (has("accept") && canAccept && hand >= (sloppy ? 2 : 3) && (needMeet || hand >= 4 || !sloppy)) {
      return "accept";
    }
    if (has("flee") && (hand < 3 || sloppy || !canAccept)) return "flee";
    if (has("accept") && canAccept) return "accept";
    if (has("flee")) return "flee";
    if (has("repress")) return "repress";
    return choices[0] || null;
  }

  if (pending.kind === "power-token") {
    const needTokens = unmarkedQuests(state) > teamTokens(state);
    const canReturn = subconsciousCount(state.subconscious) >= 1;
    // Prefer tokens when quests need marking; otherwise return if Subconscious is rich.
    if (has("take") && (needTokens || !canReturn || sloppy || teamTokens(state) < 2)) return "take";
    if (has("return") && canReturn && subconsciousCount(state.subconscious) >= 3) return "return";
    if (has("take")) return "take";
    if (has("return") && canReturn) return "return";
    return choices[0] || null;
  }

  if (pending.kind === "dream") {
    // Good only when the table can clearly afford it; otherwise take free Bad.
    if (has("good") && !sloppy && teamTokens(state) >= 2 && psycheHandCount(player) >= 4) return "good";
    return has("bad") ? "bad" : (has("good") ? "good" : choices[0] || null);
  }

  return choices[0] || null;
}

export function describeMindstreamPick(state, choiceId) {
  const pending = state.pendingMindstreamChoice;
  if (!pending) return "Mindstream choice";
  const label = (pending.choices || []).find((c) => c.id === choiceId)?.label || choiceId;
  return `${pending.kind}: ${pending.card?.name || "card"} → ${label}`;
}

/** Resolve pending Mindstream choice if present. Returns thought string or null. */
export function botResolveMindstream(state, skill, helpers = {}) {
  if (!state.pendingMindstreamChoice) return null;
  let choiceId = pickMindstreamChoice(state, skill);
  if (!choiceId) {
    state.pendingMindstreamChoice = null;
    return "Mindstream: skip stuck choice";
  }
  const thought = describeMindstreamPick(state, choiceId);
  let ok = resolveMindstreamChoice(state, choiceId, helpers);
  // If Good failed (can't pay), force the free Bad / Flee path.
  if (!ok && state.pendingMindstreamChoice) {
    const pending = state.pendingMindstreamChoice;
    const fallback = (pending.choices || []).map((c) => c.id)
      .find((id) => id === "bad" || id === "flee" || id === "discard" || id === "repress" || id === "take");
    if (fallback && fallback !== choiceId) {
      ok = resolveMindstreamChoice(state, fallback, helpers);
      if (ok) return `${thought} (fell back to ${fallback})`;
    }
    state.pendingMindstreamChoice = null;
    return `${thought} (cleared stuck choice)`;
  }
  return thought;
}

export function botSelectOpener(state, skill = "skilled") {
  if (!phaseOpeningActive(state)) return null;
  const phase = getPhase(state);
  const suit = phaseSuitForOpening(phase);
  if (!suit) return null;

  const best = bestPhaseContributor(state);
  const ranked = [...alive(state)].sort((a, b) => {
    const sa = totalStat(a, suit, state);
    const sb = totalStat(b, suit, state);
    const ha = (a.hand || []).filter((c) => cardCountsAsSuit(c, suit, state) || isWildPsyche(c)).length;
    const hb = (b.hand || []).filter((c) => cardCountsAsSuit(c, suit, state) || isWildPsyche(c)).length;
    const handSafe = (p) => (psycheHandCount(p) >= 3 ? 8 : psycheHandCount(p) <= 1 ? -20 : 0);
    return (sb + hb * 3 + handSafe(b)) - (sa + ha * 3 + handSafe(a));
  });

  const prefer = skill === "sloppy" && Math.random() < 0.35
    ? ranked[Math.floor(Math.random() * Math.min(3, ranked.length))]
    : (best && ranked.includes(best) ? best : ranked[0]);

  if (!prefer) return null;

  const cards = (prefer.hand || []).filter((c) => (
    c.type !== "psyche-power"
    && !isDreambeastPsycheCard(c)
    && (cardCountsAsSuit(c, suit, state) || isWildPsyche(c))
  )).sort((a, b) => (a.value || 0) - (b.value || 0));

  if (cards.length) {
    state.selectedHand = [cards[0].instanceId];
    state.phaseTokenAsPsyche = null;
    state.activePlayerIndex = state.players.indexOf(prefer);
    return {
      player: prefer,
      via: "psyche",
      card: cards[0],
      budget: projectedPhaseBudget(state, prefer),
      phase,
      suit,
    };
  }

  if (canUsePhasePowerToken(state, prefer) || (prefer.powerTokens || 0) >= 1) {
    state.selectedHand = [];
    state.phaseTokenAsPsyche = prefer.id;
    state.activePlayerIndex = state.players.indexOf(prefer);
    return {
      player: prefer,
      via: "token",
      budget: projectedPhaseBudget(state, prefer),
      phase,
      suit,
    };
  }

  return null;
}

export function botThoughtOpener(pick) {
  if (!pick) return "No opener available";
  const via = pick.via === "token" ? "1 Power Token" : `${pick.card?.name || "Psyche"}`;
  return `${pick.player.name} opens ${pick.phase} with ${via} → ${pick.budget} for team`;
}

function spectatorDest(state, player) {
  if (state.acquiredPoints >= state.goalPoints && !state.finalRecurrence) return "bed";
  if (state.finalRecurrence) {
    // Prefer a final tile where this Dreamer already holds opposing Psyche.
    const finals = state.board.filter((t) => t.finalArchetype && !t.finalArchetype.defeated);
    const ranked = finals.map((tile) => {
      const opp = { lucidity: "willpower", willpower: "elasticity", elasticity: "lucidity" }[tile.finalArchetype.suit];
      const oppCards = (player.hand || []).filter((c) => c.suit === opp).length;
      return { id: tile.id, score: oppCards * 5 + psycheHandCount(player) };
    }).sort((a, b) => b.score - a.score);
    return ranked[0]?.id || "bed";
  }
  const quests = activeQuestLandscapeIds(state);
  const withBeast = quests.find((id) => {
    const t = landscapeById(state, id);
    return t?.revealed && !t.wasteland && (t.encounters?.length || t.encounter);
  });
  if (withBeast) return withBeast;
  const revealed = quests.find((id) => {
    const t = landscapeById(state, id);
    return t?.revealed && !t.wasteland;
  });
  if (revealed) return revealed;
  if (teamTokens(state) < unmarkedQuests(state)) {
    const power = ["awards", "candy-mountain"].find((id) => {
      const t = landscapeById(state, id);
      return t?.revealed && !t.wasteland;
    });
    if (power) return power;
  }
  if (psycheHandCount(player) < 4) return "bed";
  return player.landscapeId || "bed";
}

function spectatorStepToward(state, player, destId) {
  const dest = landscapeById(state, destId);
  const start = landscapeById(state, player.landscapeId);
  const legal = getLegalMoveTargets(state, player);
  if (!legal.length) return null;
  if (legal.some((t) => t.id === destId)) return destId;
  if (!start || !dest) return legal[0]?.id || null;
  return [...legal].sort((a, b) => hexDistance(a, dest) - hexDistance(b, dest))[0]?.id || null;
}

function cheapestPay(player, encounter, accept) {
  const suit = accept ? (encounter?.suit || null) : (encounter?.rejectSuit || encounter?.suit || null);
  const hand = player?.hand || [];
  const normals = hand.filter((c) => (
    c.type !== "psyche-power"
    && c.type !== "psyche-dreambeast"
    && !isWildPsyche(c)
    && (!suit || c.suit === suit)
  ));
  const wilds = hand.filter((c) => isWildPsyche(c));
  const pool = normals.length ? normals : wilds;
  return [...pool].sort((a, b) => (a.value || 0) - (b.value || 0))[0] || null;
}

function resolveSpectatorPendings(state, skill, helpers) {
  let guard = 40;
  let acted = false;
  while (guard-- > 0) {
    if (state.pendingMindstreamChoice) {
      botResolveMindstream(state, skill, helpers);
      acted = true;
      continue;
    }
    if (state.pendingMindstreamMeet) {
      const pending = state.pendingMindstreamMeet;
      const mode = pending.preferredMode === "reject" ? "reject" : "accept";
      if (helpers.prepareMindstreamMeet) {
        helpers.prepareMindstreamMeet(state, {
          mode,
          landscapeId: pending.landscapeId,
          playerId: pending.playerId,
          instant: true,
          meetEncounterFn: helpers.meetEncounter,
        });
      } else if (helpers.meetEncounter) {
        helpers.meetEncounter(state, mode, { freeMeet: true, fromMindstreamDraw: true, instant: true });
        state.pendingMindstreamMeet = null;
      }
      state.botSpectatorThought = `Mindstream Meet: ${mode}`;
      acted = true;
      continue;
    }
    if (state.pendingObjectChoice) {
      const pending = state.pendingObjectChoice;
      const enabled = (pending.choices || []).filter((c) => !c.disabled);
      const id = enabled[0]?.id || (pending.cards || [])[0]?.instanceId;
      if (id) resolveObjectChoice(state, id, helpers);
      else state.pendingObjectChoice = null;
      acted = true;
      continue;
    }
    if (state.pendingObjectFollowup && !state.landscapePick) {
      resumeObjectEffect(state, helpers);
      acted = true;
      continue;
    }
    if (state.landscapePick?.mode === "forget") {
      const tile = forgettableTiles(state)[0];
      if (!tile) {
        cancelLandscapePick(state);
        break;
      }
      helpers.handleBoardTileClick?.(state, tile.id);
      acted = true;
      continue;
    }
    if (state.pendingDeathChoice) {
      const player = state.players.find((p) => p.id === state.pendingDeathChoice.playerId);
      const cost = state.pendingDeathChoice.cost || 1;
      if ((player?.powerTokens || 0) >= cost) avoidDreamerDeath(state);
      else acceptDreamerDeath(state);
      acted = true;
      continue;
    }
    if (state.pendingRespawn) {
      const next = (state.availableDreamers || [])[0];
      if (next) respawnDreamer(state, state.pendingRespawn, next.id);
      else state.pendingRespawn = null;
      acted = true;
      continue;
    }
    if (state.pendingReturn) {
      const cards = listSubconsciousCards(state);
      const card = cards.find((c) => !state.pendingReturn.picked.some((p) => p.instanceId === c.instanceId));
      if (!card) {
        state.pendingReturn = null;
        break;
      }
      pickReturnCard(state, card.instanceId);
      acted = true;
      continue;
    }
    if (state.pendingRepress) {
      const pending = state.pendingRepress;
      if (pending.confirmEmpty) {
        confirmRepressStep(state);
        acted = true;
        continue;
      }
      const player = state.players.find((p) => p.id === pending.playerId) || alive(state)[0];
      const pool = pending.source === "objects" ? (player?.objects || []) : (player?.hand || []);
      const card = pool.find((c) => !pending.picked.some((p) => p.instanceId === c.instanceId));
      if (!card) {
        confirmRepressStep(state);
        acted = true;
        continue;
      }
      pickRepressCard(state, card.instanceId);
      acted = true;
      continue;
    }
    if (state.pendingNothingChoice) {
      resolveNothingChoice(state, "token");
      acted = true;
      continue;
    }
    if (state.pendingDreamChoice) {
      const choices = (state.pendingDreamChoice.choices || []).filter((c) => !c.disabled);
      resolveDreamChoice(state, choices[0]?.id || "confirm", helpers);
      advanceDreamQueue?.(state);
      acted = true;
      continue;
    }
    if (state.pendingEffectChoice) {
      const choices = (state.pendingEffectChoice.choices || []).filter((c) => !c.disabled);
      resolveEffectChoice(state, choices[0]?.id || "confirm", helpers);
      acted = true;
      continue;
    }
    if (state.pendingDreamerPower) {
      const pending = state.pendingDreamerPower;
      if (pending.step === "choice" && pending.choices?.length) {
        resolveDreamerPowerChoice(state, pending.choices[0].id);
      } else if (pending.step === "deck") {
        resolveDreamerPowerDeckPick(state, pending.deckIds?.[0] || "psyche");
      } else if (pending.step === "hand") {
        const card = (pending.cards || [])[0];
        if (card) resolveDreamerPowerHandPick(state, card.instanceId);
        else state.pendingDreamerPower = null;
      } else if (pending.step === "tile" || pending.step === "reveal-landscape") {
        const tile = revealableTiles(state)[0] || state.board.find((t) => t.revealed);
        if (tile) handleDreamerPowerTilePick(state, tile.id);
        else state.pendingDreamerPower = null;
      } else {
        state.pendingDreamerPower = null;
      }
      acted = true;
      continue;
    }
    break;
  }
  return acted;
}

/**
 * Lightweight spectator controller. Drive with start/stop/step from the dev console.
 */
export function createSpectatorBot({
  getState,
  renderAll,
  skill = "skilled",
  stepMs = 700,
  onThought = () => {},
  api = {},
} = {}) {
  let timer = null;
  let running = false;
  let steps = 0;
  const maxSteps = 4000;

  function think(msg) {
    onThought(msg);
    const state = getState();
    if (state) {
      state.botSpectatorThought = msg;
      state.log = state.log || [];
      state.log.push(`[AI] ${msg}`);
      if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
    }
  }

  function stop() {
    running = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const banner = document.getElementById("ai-thought-banner");
    if (banner) banner.classList.add("hidden");
    think("AI spectator stopped.");
    renderAll?.();
  }

  function schedule() {
    if (!running) return;
    timer = setTimeout(() => {
      try {
        stepOnce();
      } catch (err) {
        think(`AI error: ${err.message}`);
        stop();
        return;
      }
      if (running) schedule();
    }, Math.max(120, stepMs));
  }

  function stepOnce() {
    const state = getState();
    if (!state || state.status !== "playing") {
      think(state?.status === "won" ? "AI: game won." : "AI: game over.");
      stop();
      return false;
    }
    if (++steps > maxSteps) {
      think("AI: step cap reached.");
      stop();
      return false;
    }

    if (isDiceBattleOpen() || state.diceBattle) {
      think("Waiting for dice battle…");
      cancelDiceBattle();
      state.diceBattle = null;
      renderAll?.();
      return true;
    }

    const helpers = {
      ...(api.getEffectHelpers?.() || {}),
      bot: true,
      syncDice: true,
      instant: true,
      handleBoardTileClick: api.handleBoardTileClick,
      meetEncounter: (s, mode, opts = {}) => api.meetEncounter?.(s, mode, { ...opts, instant: true }),
      prepareMindstreamMeet: (s, opts = {}) => prepareMindstreamMeet(s, {
        ...opts,
        instant: true,
        meetEncounterFn: (st, mode, o) => api.meetEncounter?.(st, mode, { ...o, instant: true }),
      }),
    };

    if (resolveSpectatorPendings(state, skill, helpers)) {
      think(state.botSpectatorThought || "Resolved pending choice");
      renderAll?.();
      return true;
    }

    const phase = getPhase(state);

    if (phase === "Reveal" && !state.dreamDrawn) {
      think("Draw & resolve Dream");
      api.drawDreamCard?.(state);
      renderAll?.();
      return true;
    }

    if (phaseOpeningActive(state)) {
      const pick = botSelectOpener(state, skill);
      if (pick) {
        think(botThoughtOpener(pick));
        if (phase === "Reveal") api.revealLandscape?.(state);
        else if (phase === "Explore") api.activateExplore?.(state);
        else if (phase === "Meet") api.gainMeetActions?.(state);
        renderAll?.();
        return true;
      }
    }

    if (state.landscapePick?.mode === "reveal" || state.landscapePick?.mode === "reveal-deck-tops") {
      const tiles = revealableTiles(state);
      const quests = new Set(activeQuestLandscapeIds(state));
      const tile = tiles.find((t) => quests.has(t.id))
        || tiles.find((t) => ["awards", "candy-mountain", "lava"].includes(t.id))
        || tiles[0];
      if (tile) {
        think(`Reveal ${tile.name}`);
        api.handleBoardTileClick?.(state, tile.id);
      } else {
        think("No tiles left — cancel reveal pick");
        cancelLandscapePick(state);
      }
      renderAll?.();
      return true;
    }

    if (phase === "Explore" && state.exploreActivated && (state.exploreMovesLeft || 0) > 0) {
      const holder = state.meetPassHolderId
        ? state.players.find((p) => p.id === state.meetPassHolderId)
        : activePlayer(state);
      if (holder) {
        state.activePlayerIndex = Math.max(0, state.players.indexOf(holder));
        const dest = spectatorDest(state, holder);
        if (dest !== holder.landscapeId) {
          const step = spectatorStepToward(state, holder, dest);
          if (step && step !== holder.landscapeId) {
            think(`${holder.name} moves toward ${landscapeById(state, dest)?.name || dest}`);
            api.moveDreamer?.(state, step);
            renderAll?.();
            return true;
          }
        }
        if (api.passMeetToken && state.meetPassHolderId) {
          think(`${holder.name} passes Explore turn`);
          api.passMeetToken(state);
          renderAll?.();
          return true;
        }
      }
    }

    if (phase === "Meet" && (state.meetActionBudget || 0) > 0
      && state.meetActionsUsed < state.meetActionBudget) {
      const holder = state.meetPassHolderId
        ? state.players.find((p) => p.id === state.meetPassHolderId)
        : activePlayer(state);
      if (holder) state.activePlayerIndex = Math.max(0, state.players.indexOf(holder));

      // Meet beasts on the holder's tile first
      if (holder) {
        const tile = landscapeById(state, holder.landscapeId);
        const enc = tile?.encounters?.[0] || tile?.encounter;
        if (enc && api.meetEncounter) {
          const leviathan = isLeviathanCard(enc);
          const acceptCard = leviathan ? null : cheapestPay(holder, enc, true);
          const rejectCard = cheapestPay(holder, enc, false);
          const mode = (!leviathan && acceptCard && psycheHandCount(holder) >= 3) ? "accept"
            : rejectCard ? "reject"
              : acceptCard ? "accept" : null;
          const card = mode === "accept" ? acceptCard : rejectCard;
          if (mode && card) {
            state.selectedLandscapeId = tile.id;
            state.activeEncounter = enc;
            state.activeEncounterLandscapeId = tile.id;
            state.selectedHand = [card.instanceId];
            think(`${holder.name} ${mode}s ${enc.name}`);
            api.meetEncounter(state, mode, { instant: true });
            renderAll?.();
            return true;
          }
        }

        // Landscape actions
        if (tile?.revealed && !tile.wasteland) {
          const choices = getLandscapeActionChoices(tile);
          const want = ["take-power", "draw-3-psyche", "draw-1-psyche", "draw-mindstream", "spawn-dreambeast"]
            .find((id) => choices.some((c) => c.id === id));
          if (want && api.performLandscapeAction) {
            state.selectedLandscapeId = tile.id;
            const before = state.meetActionsUsed;
            api.performLandscapeAction(state, want);
            if (state.meetActionsUsed > before) {
              think(`${holder.name} uses ${want} on ${tile.name}`);
              renderAll?.();
              return true;
            }
          }
        }
      }

      if (api.handleQuestComplete && state.activeArchetype) {
        const before = state.acquiredPoints;
        api.handleQuestComplete(state, 0);
        if (state.acquiredPoints !== before || state.activeArchetype?.questProgress?.some(Boolean)) {
          think("Commit quest progress");
          renderAll?.();
          return true;
        }
      }

      if (api.passMeetToken && state.meetPassHolderId) {
        think(`${holder?.name || "Dreamer"} passes Meet turn`);
        api.passMeetToken(state);
        renderAll?.();
        return true;
      }
    }

    think(`Advance from ${phase}`);
    api.endPhase?.(state);
    renderAll?.();
    return true;
  }

  return {
    start(opts = {}) {
      if (opts.skill) skill = opts.skill;
      if (opts.stepMs != null) stepMs = opts.stepMs;
      steps = 0;
      running = true;
      think(`AI spectator running (${skill}, ${stepMs}ms/step). Type /ai stop to halt.`);
      renderAll?.();
      schedule();
      return true;
    },
    stop,
    step() {
      return stepOnce();
    },
    isRunning: () => running,
    getSkill: () => skill,
    setSkill: (next) => { skill = next; },
    setStepMs: (ms) => { stepMs = ms; },
  };
}

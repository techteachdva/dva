import { stepAutoplay } from "./autoplay.js";
import { chooseBoon } from "../dreamers/boons.js";
import { closeLostFound } from "../shop/lost-found.js";
import { isBlockingGameChoice } from "../core/state.js";
/**
 * Shared Ainmos bot helpers + in-browser spectator runner.
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
} from "../core/state.js";
import {
  phaseOpeningActive,
  phaseSuitForOpening,
  bestPhaseContributor,
  projectedPhaseBudget,
  totalStat,
  cardCountsAsSuit,
  isWildPsyche,
  canUsePhasePowerToken,
} from "../core/rules.js";
import { psycheHandCount } from "../cards/psyche.js";
import { undefeatedFinalArchetypes } from "../dreamers/final-recurrence-rules.js";
import {
  listSubconsciousCards,
  isDreambeastPsycheCard,
  subconsciousCount,
  pickReturnCard,
  pickRepressCard,
  confirmRepressStep,
} from "../dreamers/subconscious.js";
import { activeQuestLandscapeIds } from "../dreamers/quests.js";
import {
  mindRunway, wantsRemember, pickRememberChoice, pickReturnInstance, pickHandLoss,
  rememberObject, rememberObjectReady, memoryTiles, memoryTileOpen, bestRowArchetype, readyArchetype,
  LOW_RUNWAY, handSurplus,
} from "./bot-policy.js";
import { focusRowArchetype } from "../core/state.js";
import { handLimitForPlayer, resolveNothingChoice } from "../effects/objects.js";
import { revealableTiles, forgettableTiles, cancelLandscapePick, pendingPlacementCard } from "../board/landscapes.js";
import { isFreeformBoard, vaultCards, placementSlots } from "../board/dreamscape-vault.js";
import { getEventResolution } from "../effects/event-resolutions.js";
import { resolveMindstreamChoice, assessDreamGood } from "../cards/mindstream-choices.js";
import { getDreamResolution } from "../cards/dream-resolutions.js";
import { dreamReplayOptions, replayChosenDream } from "../cards/dream-replay.js";
import { hasAffectedLandscapes } from "../board/event-landscapes.js";
import { getLegalMoveTargets, hexDistance } from "../core/hex.js";
import { getLandscapeActionChoices } from "../board/landscape-actions.js";
import { resolveDreamChoice, advanceDreamQueue } from "../cards/dream-choices.js";
import { resolveEffectChoice } from "../effects/effect-choices.js";
import { resolveObjectChoice, resumeObjectEffect } from "../effects/object-effects.js";
import {
  resolveDreamerPowerChoice,
  resolveDreamerPowerDeckPick,
  resolveDreamerPowerHandPick,
  handleDreamerPowerTilePick,
} from "../dreamers/dreamer-powers.js";
import { isDiceBattleOpen, cancelDiceBattle } from "../encounters/dice-battle.js";

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

  // An Archetype's Event: Bright when it can be paid (a sloppy bot sometimes skips it).
  if (pending.kind === "archetype-event") {
    const good = (pending.choices || []).find((c) => c.id === "good" && !c.disabled);
    return good && (!sloppy || Math.random() < 0.6) ? "good" : "bad";
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
    if (has("accept") && canAccept && hand >= (sloppy ? 2 : 3) && (needMeet || hand >= 4 || !sloppy)) {
      return "accept";
    }
    if (has("accept") && canAccept) return "accept";
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
    const resolution = getDreamResolution(card?.refId || card?.id);
    const bright = resolution ? assessDreamGood(state, player, resolution) : { ok: false };
    if (has("good") && bright.ok && resolution) {
      if (
        resolution.bad?.effect === "repressObjects"
        && !((player.objects?.length || 0) + (player.persistent?.length || 0))
      ) {
        return has("bad") ? "bad" : choices[0] || null;
      }
      const toll = resolution.good.toll;
      const hand = psycheHandCount(player);
      const disaster = [
        "spawnEncountersOnDreamers",
        "forgetLandscapes",
        "meetOnlyThisRound",
        "discardDream",
        "discardPsycheAll",
        "repressPsycheAll",
      ].includes(resolution.bad?.effect);
      const surplus = toll?.kind === "forget"
        ? true
        : hand >= (toll?.count || 1) + 2;
      if (disaster && (!sloppy || Math.random() < 0.75)) return "good";
      if (surplus && (!sloppy || Math.random() < 0.5)) return "good";
    }
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
  if (!state.finalRecurrence && (state.subconscious?.psyche || []).length > 0 && !rememberObject(player, "persistent")
    && (mindRunway(state) <= LOW_RUNWAY || handSurplus(player) >= 2)) {
    const here = landscapeById(state, player.landscapeId);
    const tiles = memoryTiles(state);
    const near = here ? [...tiles].sort((a, b) => hexDistance(here, a) - hexDistance(here, b))[0] : tiles[0];
    if (near) return near.id;
  }
  if (state.finalRecurrence) {
    // Prefer a final tile where this Dreamer already holds opposing Psyche.
    const finals = state.board.filter((t) => undefeatedFinalArchetypes(t).length);
    const ranked = finals.map((tile) => {
      const suit = undefeatedFinalArchetypes(tile)[0]?.suit;
      const suitCards = (player.hand || []).filter((c) => c.suit === suit || c.suit === "wild").length;
      return { id: tile.id, score: suitCards * 5 + psycheHandCount(player) };
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
    if (state.pendingDreamReplay) {
      const card = dreamReplayOptions(state)[0];
      if (card) replayChosenDream(state, card, helpers);
      state.pendingDreamReplay = null;
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
      const id = pickReturnInstance(state, state.pendingReturn.picked || []);
      if (!id) {
        state.pendingReturn = null;
        break;
      }
      pickReturnCard(state, id);
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
      const card = pending.source === "objects"
        ? pool.find((c) => !pending.picked.some((p) => p.instanceId === c.instanceId))
        : pickHandLoss(player, pending);
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
      const remember = pickRememberChoice(state, state.pendingEffectChoice);
      const choices = (state.pendingEffectChoice.choices || []).filter((c) => !c.disabled);
      resolveEffectChoice(state, remember || choices[0]?.id || "confirm", helpers);
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

  const memo = {};

  /** What the Ainmos bot just did, in a few words for the thought banner. */
  function describe(state, did, before) {
    const phase = getPhase(state);
    if (did === "acquire" || (state.acquiredPoints || 0) > before.points) return "Acquire the Archetype";
    if (did === "shop") return "Shop the Lost & Found, then leave";
    if (did === "boon") return "Take a Boon";
    if (did === "endPhase") return `Done with ${before.phase}`;
    if (isDiceBattleOpen()) return "Roll the dice";
    if (state.landscapePick) return "Place a Landscape from the Vault";
    if (phase === "Explore" && state.exploreActivated) return "Walk the dream";
    return state.botSpectatorThought || `${phase}: ${did}`;
  }

  /**
   * Ainmos 0.26: the spectator plays the smart bot's policy (js/dev/autoplay.js),
   * the same one the bot sim measures, with real animated dice. It waits while a
   * dice battle is on screen instead of skipping it.
   */
  function stepOnce() {
    const state = getState();
    if (!state || state.status !== "playing") {
      think(state?.status === "won" ? "AI: you wake up." : "AI: game over.");
      stop();
      return false;
    }
    if (isDiceBattleOpen() || state.diceBattle) return true;
    if (++steps > maxSteps) {
      think("AI: step cap reached.");
      stop();
      return false;
    }
    const before = { points: state.acquiredPoints || 0, phase: getPhase(state) };
    const did = stepAutoplay(state, memo);
    think(describe(state, did, before));
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

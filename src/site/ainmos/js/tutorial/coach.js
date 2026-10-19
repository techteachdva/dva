/**
 * Ainmos First Night guide: a step-by-step companion, never a lock.
 *
 * A guided night is a real Daydream. Every render the guide reads the table
 * and the screen in front of the player and answers one question: what do I
 * do now, and why? Each step names the action, points at the control, and the
 * first time a rule matters it explains that rule in a line or two. The guide
 * walks the first two Cycles, then steps back.
 */

import { getPhase, encounterOnLandscape } from "../core/state.js";
import { cyclePosition } from "../core/cycle.js";
import { hexDistance } from "../core/hex.js";
import { SUIT_LABELS } from "../core/rules.js";
import { boardArchetypes } from "../dreamers/archetype-board.js";
import { bestForm } from "../cards/dream-forms.js";

/** The guide walks this many Cycles, then says goodbye. */
const GUIDED_CYCLES = 2;

function me(state) {
  return (state.players || []).find((p) => p.alive) || state.players?.[0] || null;
}

function tileOf(state, id) {
  return (state.board || []).find((t) => t.id === id) || null;
}

function selectedSpread(state) {
  const ids = new Set(state.selectedHand || []);
  return (state.players || []).flatMap((p) => (p.hand || []).filter((c) => ids.has(c.instanceId)));
}

function standingBeasts(state) {
  const out = [];
  (state.board || []).forEach((tile) => (tile.encounters || []).forEach((enc) => {
    if (enc) out.push({ tile, enc });
  }));
  return out;
}

function nearestArchetype(state) {
  const here = tileOf(state, me(state)?.landscapeId);
  const all = boardArchetypes(state);
  if (!all.length) return null;
  if (!here) return { ...all[0], dist: null };
  return all
    .map((entry) => ({ ...entry, dist: hexDistance(here, entry.tile) }))
    .sort((a, b) => a.dist - b.dist)[0];
}

function goalLine(state) {
  const goal = state.scoringGoalPoints || state.goalPoints || 3;
  const have = state.acquiredPoints || 0;
  return `★ ${have}/${goal} Archetypes`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/* ---------------------------------------------------------------------------
 * Each step: { id, title, text, why?, target? }
 *   text   what to do now (always shown)
 *   why    the rule behind it, shown the first time this step appears
 *   target a CSS selector for the control to light up
 * ------------------------------------------------------------------------- */

function cycleScreenStep(state) {
  const pos = cyclePosition(state);
  if (pos.cycle <= 1) {
    return {
      id: "cycle-1",
      title: "Your first Cycle",
      text: "A Cycle is 3 Dreams. Each Dream is Reveal, Explore, Meet. Press Begin Cycle 1.",
      why: "Dream 1: survive. Dream 2: a Dreambeast. Dream 3: call an Archetype. Acquire Archetypes to win.",
      target: "#cycle-screen .lf-continue",
    };
  }
  return {
    id: "cycle-n",
    title: `Cycle ${pos.cycle}`,
    text: `Same rhythm, stronger Dreambeast. Press Begin Cycle ${pos.cycle}.`,
    why: "Dreambeasts grow each Cycle. Lost & Found buys matter more.",
    target: "#cycle-screen .lf-continue",
  };
}

function dreamStep(state) {
  const pos = cyclePosition(state);
  const first = pos.cycle === 1 && pos.dream === 1;
  return {
    id: first ? "dream-first" : `dream-${pos.dream}`,
    title: pos.dream === 2 ? "A Dream, and a Dreambeast" : pos.dream === 3 ? "A Dream, then an Archetype" : "Every Dream hurts",
    text: "Read the Dream, then press its button.",
    why: first
      ? "Your Psyche deck is the Waking Mind (Mind, top bar). Repress sends Psyche to the Subconscious; Return brings it back. If the Mind runs dry, you lose."
      : pos.dream === 2
        ? "Next, the Cycle's Dreambeast lands."
        : "Next, you call an Archetype.",
    target: "#utility-modal .ms-choice-btn",
  };
}

function archetypeEventStep(ctx = {}) {
  return {
    id: "arch-event",
    title: "Bright or Dim?",
    text: ctx.brightLocked
      ? "Bright needs a Landscape shown at the top in play. Choose Dim, then pick your spread."
      : "Choose Bright or Dim, then pick your spread.",
    target: ctx.brightLocked ? "#utility-modal .ms-choice-btn--bad" : "",
    why: "Bright costs Psyche; each point buys a small edge. Dim is free with one drawback.",
  };
}

const OPENER_SUIT = { Reveal: ["blue", "Lucidity"], Explore: ["gold", "Elasticity"], Meet: ["red", "Willpower"] };

/** No card of the phase's suit: a Power Token opens it instead, or Skip. */
function noCardStep(state, phase) {
  const tokens = me(state)?.powerTokens || 0;
  const [color, suit] = OPENER_SUIT[phase] || ["", ""];
  return {
    id: `open-nocard-${phase}`,
    title: `${phase}: no ${(OPENER_SUIT[phase] || ["", "card"])[1]} card`,
    text: `No ${color} ${suit} card. Press Take Free, or Skip if your ${suit} is 0.`,
    why: "Stats are free Actions. Power Tokens only activate powers.",
    target: "#btn-spread-opener",
  };
}

function openerStep(state, ctx = {}) {
  const phase = getPhase(state);
  const pos = cyclePosition(state);
  if (ctx.openerUsable === 0) return noCardStep(state, phase);
  if (phase === "Reveal") {
    return {
      id: "open-reveal",
      title: "Phase 1 · Reveal",
      text: "Lucidity = free Reveal Actions. Press Take Free, or add a blue card first.",
      why: "Each Reveal Action places a Landscape. Unused bought Actions become Glimmer ✧.",
      target: "#btn-spread-opener",
    };
  }
  if (phase === "Explore") {
    const near = nearestArchetype(state);
    const beasts = standingBeasts(state);
    let plan = "Nothing to chase yet.";
    if (near) plan = `${near.arch.name} is on ${near.tile.name}${near.dist != null ? `, ${plural(near.dist, "step")} away` : ""}. Walk onto it.`;
    else if (beasts.length) {
      const hereId = me(state)?.landscapeId;
      const withMe = beasts.find(({ tile }) => tile.id === hereId);
      plan = withMe
        ? `${withMe.enc.name} is here. Stay to fight, or leave.`
        : `${beasts[0].enc.name} chases you. Fight it or keep away.`;
    }
    return {
      id: "open-explore",
      title: "Phase 2 · Explore",
      text: `Elasticity = free steps. Press Take Free, or add a gold card. ${plan}`,
      why: "Unused bought steps become Glimmer ✧.",
      target: "#btn-spread-opener",
    };
  }
  const hereTile = tileOf(state, me(state)?.landscapeId);
  const archHere = hereTile && (hereTile.finalArchetypes || []).some((a) => a && !a.defeated);
  const beastHere = hereTile && encounterOnLandscape(state, hereTile.id);
  if (archHere || beastHere) {
    return {
      id: "open-meet-target",
      title: "Phase 3 · Meet",
      text: `Something waits on ${hereTile.name}. Willpower = free Meet Actions. Press Take Free, or add a red card.`,
      why: "A fight or a Landscape action costs 1. Unused bought Actions become Glimmer ✧.",
      target: "#btn-spread-opener",
    };
  }
  return {
    id: pos.cycle === 1 && pos.dream === 1 ? "open-meet-empty-first" : "open-meet-empty",
    title: "Phase 3 · Meet",
    text: "Nothing here, but your Landscape has 2 actions: Call a Dreambeast, or its own. Take Free to use them, or Skip.",
    why: "Only bought Actions become Glimmer ✧.",
    target: "#btn-spread-opener",
  };
}

function vaultStep(state) {
  const left = state.landscapePick?.remaining || 0;
  return {
    id: "vault",
    title: "Build the dream",
    text: `Choose a Landscape, then tap a glowing hex. ${left} left. Press Done when finished.`,
    why: "★ marks an Archetype's home. Place it near you so the Archetype appears close.",
  };
}

function lostFoundStep() {
  return {
    id: "lost-found",
    title: "The Lost & Found",
    text: "Buy one thing, or nothing. Into the Dream draws 3 Psyche.",
    why: "Glimmer ✧ pays first, then Psyche. Psyche is your health: don't overspend.",
    target: "#lost-found .lf-continue",
  };
}

function archetypeChoiceStep(state) {
  const goal = state.scoringGoalPoints || state.goalPoints || 3;
  return {
    id: "arch-choice",
    title: "Call an Archetype",
    text: "Choose 1 of 3. It appears on its home, near you.",
    why: `Acquire ${goal} to wake. It moves 1 after each Meet: reach it in Explore.`,
  };
}

function diceStep() {
  return {
    id: "dice",
    title: "The dice decide",
    text: "Each side rolls dice. 5s and 6s hit.",
    why: "More hits wins; ties go to you. Cards, stat and Forms add dice.",
  };
}

function tableStep(state, ctx = {}) {
  const phase = getPhase(state);
  const pos = cyclePosition(state);
  const here = tileOf(state, me(state)?.landscapeId);

  if (phase === "Reveal" && state.landscapePick?.mode === "reveal") {
    const left = state.landscapePick.remaining || 0;
    if (state.landscapePick.flipCard || state.landscapePick.vaultIndex != null) {
      return {
        id: "place",
        title: "Place it",
        text: "Tap a glowing hex.",
        why: "Landscapes must touch the dream.",
      };
    }
    return {
      id: "reveal-table",
      title: "Build the dream",
      text: `Pick a Landscape, then tap a glowing hex. ${left} left.`,
      target: "#dreamscape-vault",
    };
  }

  if (phase === "Reveal") {
    return {
      id: "reveal-done",
      title: "Dream built",
      text: "Press Next: Explore (top right).",
      target: "#btn-next-phase",
    };
  }

  if (phase === "Explore") {
    const left = state.exploreMovesLeft || 0;
    if (state.exploreActivated && left > 0) {
      const near = nearestArchetype(state);
      const goal = near
        ? (near.dist === 0
          ? `You're with ${near.arch.name}. Stay and Meet it.`
          : `Head for ${near.arch.name} on ${near.tile.name}.`)
        : "Walk to a Landscape you want to use.";
      return {
        id: "explore-walk",
        title: "Walk the dream",
        text: `Tap a glowing Landscape. ${plural(left, "step")} left. ${goal}`,
        why: "Archetypes move after Meet; Dreambeasts chase at Explore.",
      };
    }
    return {
      id: "explore-done",
      title: "Done walking",
      text: "Press Next: Meet (top right).",
      target: "#btn-next-phase",
    };
  }

  // Meet
  const fight = state.archetypeFight;
  if (fight) {
    const spread = selectedSpread(state);
    const form = spread.length ? bestForm(state, spread) : null;
    const odds = String(ctx.fightLabel || "").match(/(\d+)\s*d6\s*vs\s*(\d+)/i);
    const dice = odds ? Number(odds[1]) : 0;
    const power = odds ? Number(odds[2]) : 12;
    const kind = !state.guidedFirstArchetypeDone ? " Your first Archetype fight is kind." : "";
    const short = dice && dice < power
      ? ` ${dice} dice vs ${power}. Stack Forms for more.`
      : "";
    return {
      id: form ? "fight-ready" : "fight-pick",
      title: form ? "Fight!" : "Pick a spread",
      text: form
        ? `That makes a Form. Press Fight.${short}${kind}`
        : "Tap 1–3 Psyche that make a Form, like a pair (Echo).",
      why: "Card values, your stat and the Form become dice vs Power 12.",
      target: form ? ".spread-fight-btn" : ".rail-forms",
    };
  }
  const archHere = here && boardArchetypes(state).find(({ tile }) => tile.id === here.id);
  const beastHere = here && encounterOnLandscape(state, here.id);
  const actionsLeft = Math.max(0, (state.meetActionBudget || 0) - (state.meetActionsUsed || 0));
  if (archHere && actionsLeft > 0) {
    return {
      id: "meet-arch",
      title: `Meet ${archHere.arch.name}`,
      text: `Tap ${here.name}, then Meet ${archHere.arch.name}.`,
      why: "Win: +1 Archetype, +1 Power Token, its power.",
      target: ".radial-menu-item[data-tutorial-action=\"faceArchetype\"]",
    };
  }
  if (beastHere && actionsLeft > 0) {
    const suit = SUIT_LABELS[beastHere.suit] || "its suit";
    return {
      id: "meet-beast",
      title: `Face ${beastHere.name}`,
      text: `Tap 1–3 Psyche (a ${suit} card adds your ${suit}), then Accept.`,
      why: "Win: 2 Power Tokens or an Object. Its Ward weakens one Form. Left standing, it Represses 2 each dusk.",
      target: (state.selectedHand || []).length ? ".spread-fight-btn" : "",
    };
  }
  const beasts = standingBeasts(state);
  return {
    id: pos.dream === 1 && pos.cycle === 1 ? "meet-empty-first" : "meet-empty",
    title: "End the round",
    text: actionsLeft > 0
      ? "Nothing to fight. Tap your Landscape to use an action, or press End Round."
      : "Press End Round (top right).",
    why: beasts.length
      ? "At dusk each standing Dreambeast Represses 2."
      : "Then dawn: draw 4 Psyche. Unused bought Actions become Glimmer ✧.",
    target: "#btn-next-phase",
  };
}

/** The step for what is on screen right now, or null when the guide should stay quiet. */
export function currentCoachHint(state, ctx = {}) {
  if (!isGuided(state) || state.status !== "playing") return null;
  if (ctx.gate) return null;
  let step = null;
  if (ctx.dice) step = diceStep();
  else if (ctx.cycleScreen) step = cycleScreenStep(state);
  else if (ctx.lostFound) step = lostFoundStep();
  else if (ctx.archetypeChoice || state.pendingArchetypeChoice) step = archetypeChoiceStep(state);
  else if (state.pendingMindstreamChoice?.kind === "archetype-event") step = archetypeEventStep(ctx);
  else if (state.pendingMindstreamChoice?.kind === "dream") step = dreamStep(state);
  else if (ctx.vaultScreen) step = vaultStep(state);
  else if (ctx.opener) step = openerStep(state, ctx);
  else if (ctx.otherModal) step = null;
  else step = tableStep(state, ctx);
  if (!step) return null;
  const seen = new Set(state.coachSeen || []);
  return { ...step, goal: goalLine(state), showWhy: !!step.why && !seen.has(step.id) };
}

export function isGuided(state) {
  return !!state?.guided && !state?.guidedDone;
}

/** Mark a step as seen: next time it shows only the "do this" line. */
export function dismissCoachHint(state, id) {
  if (!id) return;
  state.coachSeen = [...new Set([...(state.coachSeen || []), id])];
}

export function hideCoach(state) {
  state.coachHidden = true;
}

export function showCoach(state) {
  state.coachHidden = false;
}

/** The guide walks the first Cycles; returns true the moment it steps back. */
export function maybeEndGuidance(state) {
  if (!state?.guided || state.guidedDone) return false;
  const pos = cyclePosition(state);
  const done = pos.cycle > GUIDED_CYCLES || (state.acquiredPoints || 0) >= 2 || state.status !== "playing";
  if (!done) return false;
  state.guidedDone = true;
  return true;
}

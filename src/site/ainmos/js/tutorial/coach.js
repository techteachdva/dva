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
  return `Wake: Acquire ${goal} Archetypes · ${have} of ${goal}`;
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
      text: "This is the map of a Cycle: three Dreams, each played as Reveal, Explore, Meet. Read it, then press Begin Cycle 1.",
      why: "Dream 1 is a Dream to survive. Dream 2 brings this Cycle's Dreambeast. Dream 3 lets you call an Archetype, and Acquiring Archetypes is how you win.",
      target: "#cycle-screen .lf-continue",
    };
  }
  return {
    id: "cycle-n",
    title: `Cycle ${pos.cycle}`,
    text: `Same rhythm, a stronger Dreambeast. Press Begin Cycle ${pos.cycle} when you're ready.`,
    why: "Each Cycle's Dreambeast climbs in Power, so Objects and Insights from the Lost & Found matter more as the night goes on.",
    target: "#cycle-screen .lf-continue",
  };
}

function dreamStep(state) {
  const pos = cyclePosition(state);
  const first = pos.cycle === 1 && pos.dream === 1;
  return {
    id: first ? "dream-first" : `dream-${pos.dream}`,
    title: pos.dream === 2 ? "A Dream, and a Dreambeast" : pos.dream === 3 ? "A Dream, then an Archetype" : "Every Dream hurts",
    text: "Read what this Dream does, then press its big glowing button to endure it.",
    why: first
      ? "Your Psyche deck is the Waking Mind (the Mind counter at the top). Only Psyche is ever Repressed: it moves into the Subconscious, where 12 already wait. Return brings Psyche back, and you choose which. If the Waking Mind runs dry, you wake in a fright and lose."
      : pos.dream === 2
        ? "After this Dream, the Cycle's Dreambeast lands on a Landscape of its suit."
        : "After this Dream you choose which Archetype to call.",
    target: "#utility-modal .ms-choice-btn",
  };
}

function archetypeEventStep(ctx = {}) {
  return {
    id: "arch-event",
    title: "Bright or Dim?",
    text: ctx.brightLocked
      ? "Every Archetype Meet opens with one of its Events. Bright is locked this time: it needs one of the Landscapes shown at the top placed in the dream. Choose Dim, then pick your spread."
      : "Every Archetype Meet opens with one of its Events. Choose a side, then pick your spread.",
    target: ctx.brightLocked ? "#utility-modal .ms-choice-btn--bad" : "",
    why: "Bright costs Psyche you choose, and each point you pay buys one small thing: a die, a Return, a draw. Dim is free but puts one drawback on the fight. Low on Psyche? Dim is a fine choice.",
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
    text: `No ${color} ${suit} card in hand. Press Take free to use your ${suit} as free Actions. If your ${suit} is 0, Skip.`,
    why: "Your stats are free Actions every phase. Power Tokens only activate powers: your Dreamer's, and each Archetype's you Acquire.",
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
      text: "Your Lucidity is free Reveal Actions. Press Take free, or pick a blue Lucidity card first to add its value.",
      why: "Your Lucidity is your free Reveal Actions every Dream (each places a Landscape). Want more? A Lucidity card adds its value, and any bought Actions you leave unused become Glimmer ✧ for the Lost & Found.",
      target: "#btn-spread-opener",
    };
  }
  if (phase === "Explore") {
    const near = nearestArchetype(state);
    const beasts = standingBeasts(state);
    let plan = "Nothing to chase yet: a short walk is fine.";
    if (near) plan = `${near.arch.name} stands on ${near.tile.name}${near.dist != null ? `, ${plural(near.dist, "step")} away` : ""}. It holds still until Meet ends, so walk onto it now.`;
    else if (beasts.length) {
      const hereId = me(state)?.landscapeId;
      const withMe = beasts.find(({ tile }) => tile.id === hereId);
      plan = withMe
        ? `${withMe.enc.name} shares your Landscape. Stay to fight it in Meet, or walk away from it.`
        : `${beasts[0].enc.name} chases you. Walk to it if you want the fight, or keep your distance.`;
    }
    return {
      id: "open-explore",
      title: "Phase 2 · Explore",
      text: `Your Elasticity is free steps. Press Take free, or pick a gold Elasticity card first to add its value. ${plan}`,
      why: "Your Elasticity is your free steps. An Elasticity card adds its value; bought steps you don't take become Glimmer ✧.",
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
      text: `Something waits on ${hereTile.name}. Your Willpower is free Meet Actions: press Take free, or pick a red Willpower card first to add its value.`,
      why: "Your Willpower is your free Meet Actions; a Willpower card adds its value. A fight, an Archetype Meet, and each of a Landscape's two actions cost 1. Bought leftovers become Glimmer ✧.",
      target: "#btn-spread-opener",
    };
  }
  return {
    id: pos.cycle === 1 && pos.dream === 1 ? "open-meet-empty-first" : "open-meet-empty",
    title: "Phase 3 · Meet",
    text: "No Dreambeast or Archetype here, but your Landscape still has two actions: Call a Dreambeast to fight for 2 Power Tokens or an Object, or its own action. Take your free Meet Actions to use them, or Skip.",
    why: "Free Actions cost nothing. Only Meet Actions you pay a card for become Glimmer ✧ if you leave them unused.",
    target: "#btn-spread-opener",
  };
}

function vaultStep(state) {
  const left = state.landscapePick?.remaining || 0;
  return {
    id: "vault",
    title: "Build the dream",
    text: `Choose a Landscape, then tap a glowing hex next to the dream to place it. ${left} Reveal Action${left === 1 ? "" : "s"} left. Press Done placing when you're happy.`,
    why: "★ marks a home of an Archetype you may call this Cycle. Place those near The Bed and your Archetype can appear close by. Each Landscape also has an action you can use in Meet.",
  };
}

function lostFoundStep() {
  return {
    id: "lost-found",
    title: "The Lost & Found",
    text: "The Lost & Found closes every Dream. Your hand is shown, so you know what a price costs you. Buy one thing, or nothing. Into the Dream draws 3 Psyche for the next round.",
    why: "Objects help all night. The Insight levels up a Dream Form. Glimmer ✧ pays first; you pay the rest in Psyche of the item's suit, and Psyche is your health, so don't overspend.",
    target: "#lost-found .lf-continue",
  };
}

function archetypeChoiceStep(state) {
  const goal = state.scoringGoalPoints || state.goalPoints || 3;
  return {
    id: "arch-choice",
    title: "Call an Archetype",
    text: "Choose 1 of 3. It appears on one of its two home Landscapes, as close to you as it can.",
    why: `Archetypes are how you wake: Acquire ${goal} of them. Each one slips 1 Landscape away as Meet ends, so walk onto it during Explore and Meet it.`,
  };
}

function diceStep() {
  return {
    id: "dice",
    title: "The dice decide",
    text: "Each side rolls its Power in six-sided dice. Every 5 or 6 is a success.",
    why: "More successes wins, and ties go to you. Bigger cards, your stat, a Dream Form, and Power Tokens all add dice.",
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
        text: "Tap a glowing hex next to the dream to set the Landscape down.",
        why: "Landscapes must touch the dream. Where you put them is your map for the rest of the night.",
      };
    }
    return {
      id: "reveal-table",
      title: "Build the dream",
      text: `Pick a Landscape in the Dreamscape panel, then tap a glowing hex. ${left} Reveal Action${left === 1 ? "" : "s"} left.`,
      target: "#dreamscape-vault",
    };
  }

  if (phase === "Reveal") {
    return {
      id: "reveal-done",
      title: "Dream built",
      text: "Press Next: Explore (top right) when you're ready to walk.",
      target: "#btn-next-phase",
    };
  }

  if (phase === "Explore") {
    const left = state.exploreMovesLeft || 0;
    if (state.exploreActivated && left > 0) {
      const near = nearestArchetype(state);
      const goal = near
        ? (near.dist === 0
          ? `You're with ${near.arch.name}. Stay put and Meet it next phase.`
          : `Head for ${near.arch.name} on ${near.tile.name}.`)
        : "Walk toward Landscapes whose actions you want to use in Meet.";
      return {
        id: "explore-walk",
        title: "Walk the dream",
        text: `Tap a glowing Landscape next to you to step there. ${plural(left, "step")} left. ${goal}`,
        why: "Dreambeasts chased you as Explore began. Archetypes hold still until Meet ends, then slip 1 Landscape away.",
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
    const kind = !state.guidedFirstArchetypeDone ? " The dream is kind to your first Archetype fight." : "";
    const short = dice && dice < power
      ? ` You roll ${dice} dice against its ${power}. More dice wins more often: stack Dream Forms in one spread for more.`
      : "";
    return {
      id: form ? "fight-ready" : "fight-pick",
      title: form ? "Fight!" : "Pick a spread",
      text: form
        ? `That spread makes a Dream Form. Press Fight under your spread.${short}${kind}`
        : "Tap 1 to 3 Psyche in your hand that make a Dream Form, like two cards of the same value (an Echo).",
      why: "The Dream Forms list on the left shows every Form. Your cards' values, your stat, and the Form become dice against the Archetype's Power 12.",
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
      text: `Tap ${here.name} on the board, then choose Meet ${archHere.arch.name} in the ring of buttons around it.`,
      why: "Meeting costs 1 action. Win the fight and the Archetype is Acquired: +1 toward waking, +1 Power Token, and its power is yours.",
      target: ".radial-menu-item[data-tutorial-action=\"faceArchetype\"]",
    };
  }
  if (beastHere && actionsLeft > 0) {
    const suit = SUIT_LABELS[beastHere.suit] || "its suit";
    return {
      id: "meet-beast",
      title: `Face ${beastHere.name}`,
      text: `Tap 1 to 3 Psyche in your hand (any suit; a ${suit} card adds your ${suit} stat), then press Accept under your spread.`,
      why: "Any suit can fight it. Beat its Power and you Accept it: it leaves the board and you take 2 Power Tokens or an Object of its suit. Its Ward blunts one Dream Form. Aim for a few more dice than its Power. A standing Dreambeast Represses 1 Psyche from your Waking Mind every dusk.",
      target: (state.selectedHand || []).length ? ".spread-fight-btn" : "",
    };
  }
  const beasts = standingBeasts(state);
  return {
    id: pos.dream === 1 && pos.cycle === 1 ? "meet-empty-first" : "meet-empty",
    title: "End the round",
    text: actionsLeft > 0
      ? "Nothing to fight here. Use one of your Landscape's two actions (tap the Landscape): Call a Dreambeast to fight for a reward, or its own action. Or press End Round (top right) and bank the rest as Glimmer."
      : "Press End Round (top right).",
    why: beasts.length
      ? `At dusk each standing Dreambeast Represses 1 from your Waking Mind. Then the next Dream begins.`
      : "Dusk comes, then dawn: you draw 4 Psyche and the next Dream begins. Unspent bought actions become Glimmer ✧.",
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

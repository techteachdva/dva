/**
 * Ainmos Guided First Cycle: light hints instead of a scripted tutorial.
 *
 * A guided night is a real Daydream. Each hint shows once, the first time its
 * moment happens, and never blocks a click. When the first Archetype is
 * Acquired the training wheels come off: hints stop and the night goes on.
 */

import { getPhase } from "../core/state.js";
import { isFreeformBoard, vaultCards } from "../board/dreamscape-vault.js";
import { bestForm } from "../cards/dream-forms.js";

function next(state) {
  const plan = state.nightPlan || [];
  const inDeck = new Set((state.dreamDeck || []).map((c) => c.instanceId));
  return plan.find((p) => inDeck.has(p.instanceId)) || null;
}

function selectedSpread(state) {
  const ids = new Set(state.selectedHand || []);
  return state.players.flatMap((p) => (p.hand || []).filter((c) => ids.has(c.instanceId)));
}

/** Hints in priority order. `when` reads the table; each shows once. */
const HINTS = [
  {
    id: "welcome",
    title: "Welcome to Ainmos",
    text: "One goal: Acquire Archetypes. Each Cycle is 3 Dreams: a Dream to survive, a Dreambeast that lands, and an Archetype you choose. Every Dream hurts; endure it, then spend Lucidity to build the dream around The Bed.",
    when: (s) => s.round === 1 && (s.board || []).length <= 1,
  },
  {
    id: "vault",
    title: "Build the dream",
    text: "Pick a Landscape in the Dreamscape Vault, then tap a glowing hex that touches the dream. A ★ marks the home of an Archetype you may call soon: place it, and that Archetype can appear there.",
    when: (s) => isFreeformBoard(s) && s.landscapePick?.mode === "reveal" && !s.landscapePick.flipCard,
  },
  {
    id: "beast",
    title: "A Dreambeast lands",
    text: "Dream 2 of each Cycle brings a Dreambeast to a Landscape of its suit. It chases you each Explore and bleeds 1 Psyche every dusk it stands. Beat it on its Landscape, or outrun it.",
    when: (s) => (s.board || []).some((t) => (t.encounters || []).some((e) => e?.boss)),
  },
  {
    id: "choose-archetype",
    title: "Call an Archetype",
    text: "Choose 1 of 3. It appears on one of its two home Landscapes (a placed one, if you can) and slips 1 Landscape away from you each Explore.",
    when: (s) => !!s.pendingArchetypeChoice,
  },
  {
    id: "explore",
    title: "Walk the dream",
    text: "Explore moves you one Landscape a step. Archetypes flee, Dreambeasts chase. Head for an Archetype; Wasteland costs a Psyche.",
    when: (s) => getPhase(s) === "Explore",
  },
  {
    id: "meet-arch",
    title: "Meet the Archetype",
    text: "On its Landscape in Meet, tap the Archetype and choose Meet: its Event comes first. Bright helps (it costs Psyche), Dim hurts. Then pick 1 to 3 Psyche that make a Dream Form, like two of one value, and fight Power 12.",
    when: (s) => getPhase(s) === "Meet" && (s.board || []).some((t) => (t.finalArchetypes || []).some((a) => !a.defeated) && s.players.some((p) => p.alive && p.landscapeId === t.id)),
  },
  {
    id: "form",
    title: "A Dream Form",
    text: "That spread makes a Dream Form: it rolls extra dice, and an Archetype fight needs one. Form Objects and Insights make a Form stronger all night.",
    when: (s) => !!bestForm(s, selectedSpread(s)),
  },
  {
    id: "glimmer-earn",
    title: "Nothing is wasted: Glimmer",
    text: "Every Reveal, step, or Meet action you leave unspent becomes Glimmer ✧ when the phase ends. Watch the Glimmer counter at the top. You spend it in the Lost & Found at the start of the next round.",
    when: (s) => (s.glimmer || 0) > 0 && !s.lostFound?.open,
  },
  {
    id: "glimmer-preview",
    title: "Leftovers become Glimmer",
    text: "The phase chip shows what you have left. End the phase with some unspent and each one turns into 1 Glimmer ✧ for the shop.",
    when: (s) => (getPhase(s) === "Explore" && s.exploreActivated && (s.exploreMovesLeft || 0) > 0)
      || (getPhase(s) === "Meet" && (s.meetActionBudget || 0) > (s.meetActionsUsed || 0)),
  },
  {
    id: "shop",
    title: "The Lost & Found",
    text: "Your Glimmer ✧ pays first: each one covers 1 of any price, any suit. The rest you pay in Psyche of the item's suit (the Insight takes any suit). 3 Glimmer looks again. Psyche is also your health, so spend it with care.",
    when: (s) => !!s.lostFound?.open,
  },
];

export function isGuided(state) {
  return !!state?.guided && !state?.guidedDone;
}

/** The next unseen hint for this moment, or null. */
export function currentCoachHint(state) {
  if (!isGuided(state) || state.coachHidden) return null;
  const seen = new Set(state.coachSeen || []);
  return HINTS.find((hint) => !seen.has(hint.id) && safeWhen(hint, state)) || null;
}

function safeWhen(hint, state) {
  try {
    return !!hint.when(state);
  } catch {
    return false;
  }
}

export function dismissCoachHint(state, id) {
  state.coachSeen = [...new Set([...(state.coachSeen || []), id])];
}

export function hideCoach(state) {
  state.coachHidden = true;
}

/** The Turtle has fallen: training wheels off. Returns true the moment it happens. */
export function maybeEndGuidance(state) {
  if (!state?.guided || state.guidedDone) return false;
  if (!((state.acquiredPoints || 0) > 0)) return false;
  state.guidedDone = true;
  return true;
}

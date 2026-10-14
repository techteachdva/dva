/**
 * Ainmos Guided First Ante: light hints instead of a scripted tutorial.
 *
 * A guided night is a real Daydream. Each hint shows once, the first time its
 * moment happens, and never blocks a click. When the Winged Turtle falls the
 * training wheels come off: hints stop and the night goes on.
 */

import { getPhase } from "../core/state.js";
import { isFreeformBoard, vaultCards } from "../board/dreamscape-vault.js";
import { activeQuestLandscapeIds } from "../dreamers/quests.js";
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
    text: "A night is a run of Antes: a Dream, a Dream with a Mini-Boss, then a Boss. The Night Bar across the top shows them all. Every Dream hurts; endure it, then spend Lucidity to build the dream around The Bed.",
    when: (s) => s.round === 1 && (s.board || []).length <= 1,
  },
  {
    id: "vault",
    title: "Build the dream",
    text: "Pick a Landscape in the Dreamscape Vault, then tap a glowing hex that touches the dream. Each Lucidity places one. Refreshing the Vault costs 1 more each time this round.",
    when: (s) => isFreeformBoard(s) && s.landscapePick?.mode === "reveal" && !s.landscapePick.flipCard,
  },
  {
    id: "leftover",
    title: "Nothing is wasted",
    text: "Every Reveal, step, or Meet action you leave unspent draws 1 Psyche, passed around the table when the phase ends.",
    when: (s) => (getPhase(s) === "Explore" && s.exploreActivated && (s.exploreMovesLeft || 0) > 0)
      || (getPhase(s) === "Meet" && (s.meetActionBudget || 0) > (s.meetActionsUsed || 0)),
  },
  {
    id: "quest-tile",
    title: "A quest Landscape",
    text: "A tile in the Vault is named on a face-up Archetype's quest. Place it, then draw Mindstream or meet a Dreambeast there.",
    when: (s) => {
      const quests = new Set(activeQuestLandscapeIds(s));
      return vaultCards(s).some((c) => quests.has(c.id));
    },
  },
  {
    id: "explore",
    title: "Walk the dream",
    text: "Explore moves you one step at a time. Head for the beasts: each one standing at dusk bleeds your Waking Mind. Wasteland costs a Psyche.",
    when: (s) => getPhase(s) === "Explore",
  },
  {
    id: "meet",
    title: "Meet",
    text: "Fight the Dreambeast on your hex with 1 to 3 Psyche. Aim for its Power + 2; ties go to you. You can fight again as long as you have actions.",
    when: (s) => getPhase(s) === "Meet",
  },
  {
    id: "form",
    title: "A Dream Form",
    text: "That spread makes a Dream Form and rolls an extra die. Form Objects and Insights make a Form stronger for the whole night.",
    when: (s) => !!bestForm(s, selectedSpread(s)),
  },
  {
    id: "bed",
    title: "The Bed does not heal",
    text: "The Bed Dreams Onward: flip the top tile of the deck and place it, or put it back. Rest comes at dawn after each Boss.",
    when: (s) => getPhase(s) === "Meet" && s.players.some((p) => p.alive && p.landscapeId === "bed"),
  },
  {
    id: "shop",
    title: "The Lost & Found",
    text: "Objects cost Psyche value of their own suit; the Insight takes any suit. Psyche is also your health. Spend it, but not all of it.",
    when: (s) => !!s.lostFound?.open,
  },
  {
    id: "boss-ahead",
    title: "The Boss is next",
    text: "The next Dream is the Winged Turtle: three stacked fights, Power 1, then 2, then 3. Hover a Boss on the Night Bar to read its twist.",
    when: (s) => next(s)?.boss && !s.dreamDrawn,
  },
  {
    id: "mini-boss",
    title: "A Mini-Boss rises",
    text: "The Ante's second Dream brings a Mini-Boss to The Bed. It is weaker than the Boss, but it bleeds you every dusk it stands. Beat it while it is close.",
    when: (s) => (s.board || []).some((t) => (t.encounters || []).some((e) => e?.miniBoss)),
  },
  {
    id: "boss-arrived",
    title: "A Boss has woken",
    text: "Bosses land on a random Landscape and stalk toward you each Meet. Each bends one rule while it stands. Defeat it to clear the Ante and choose a Boon.",
    when: (s) => (s.board || []).some((t) => (t.encounters || []).some((e) => e?.boss)),
  },
  {
    id: "boon",
    title: "Choose a Boon",
    text: "Boons are Archetype powers and passives you keep all night. Archetype cards themselves give points.",
    when: (s) => !!s.pendingBoonDraft,
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
  if (!(state.bossesDefeated || []).includes("winged-turtle")) return false;
  state.guidedDone = true;
  return true;
}

/**
 * Every Dreambeast bends one rule (0.30). The ten ladder Bosses keep their
 * twists in boss-ladder.js / boss-twists.js; this file gives the other
 * Dreambeasts one each, plus the shared hooks the engine calls.
 *
 * No imports from state.js on purpose (rules.js and subconscious.js read it).
 *
 * Kinds:
 *   dice -N            your fight rolls N fewer dice
 *   dice-unless-suit   −2 dice unless your spread holds its suit
 *   cap N              your spread holds at most N cards
 *   power-per-missing  +1 Power per suit your spread lacks
 *   ties               ties go to the beast
 *   dusk-*             at dusk while it stands
 *   loss-*             when you lose a fight to it
 *   stand-*            while it stands anywhere
 *   hop                hops 1 hex at the start of each Meet
 */

import { ladderEntry } from "./boss-ladder.js";

export const BEAST_TWISTS = Object.freeze({
  "winged-turtle": { twist: "Shell", twistText: "Your fight rolls 1 fewer die.", kind: "dice", n: 1 },
  werewolf: { twist: "Full moon", twistText: "At dusk, gains +1 Power (up to 11).", kind: "dusk-grow", n: 1 },
  automaton: { twist: "Clockwork", twistText: "Fight it with 2 Psyche at most.", kind: "cap", n: 2 },
  guardian: { twist: "Halt", twistText: "While it stands: 1 fewer Meet Action.", kind: "stand-phase", phase: "Meet", n: 1 },
  merperson: { twist: "Siren song", twistText: "At dusk, Repress 1 Psyche from your hand.", kind: "dusk-repress-hand", n: 1 },
  "trash-gremlin": { twist: "Hoard", twistText: "At dusk, Discard 1 Object from your hand.", kind: "dusk-object-hand", n: 1 },
  nixie: { twist: "Drown", twistText: "At dusk, Forget a Landscape next to it.", kind: "dusk-forget-near", n: 1 },
  unicorn: { twist: "Pure heart", twistText: "−2 dice unless your spread holds Elasticity.", kind: "dice-unless-suit", n: 2 },
  "black-dog": { twist: "Omen", twistText: "At dusk, Repress 1 more from the Waking Mind.", kind: "dusk-mill", n: 1 },
  basilisk: { twist: "Stone gaze", twistText: "While it stands: no Dreamer Power.", kind: "stand-no-power" },
  chimera: { twist: "Three heads", twistText: "+1 Power for each suit your spread lacks.", kind: "power-per-missing", n: 1 },
  gorgon: { twist: "Gaze", twistText: "Your fight rolls 2 fewer dice.", kind: "dice", n: 2 },
  sandman: { twist: "Drowsy", twistText: "While it stands: 1 fewer Reveal Action.", kind: "stand-phase", phase: "Reveal", n: 1 },
  sincubus: { twist: "Kiss", twistText: "Lose to it: Repress 2 Psyche from your hand.", kind: "loss-repress-hand", n: 2 },
  mandrake: { twist: "Scream", twistText: "At dusk, Forget a Landscape next to it.", kind: "dusk-forget-near", n: 1 },
  "goofus-bird": { twist: "Backwards", twistText: "Ties go to it.", kind: "ties" },
  watcher: { twist: "Witness", twistText: "At dusk, lose 2 Glimmer.", kind: "dusk-glimmer", n: 2 },
  oni: { twist: "Club", twistText: "Lose to it: Discard 1 Object in play.", kind: "loss-object", n: 1 },
  minotaur: { twist: "Maze", twistText: "While it stands: 1 fewer Explore step.", kind: "stand-phase", phase: "Explore", n: 1 },
  "ghost-light": { twist: "Haunt", twistText: "While it stands: nothing Returns.", kind: "stand-no-return" },
  vampyre: { twist: "Drain", twistText: "At dusk, lose 1 Power Token.", kind: "dusk-token", n: 1 },
  pooka: { twist: "Trickster", twistText: "Hops 1 hex at the start of each Meet.", kind: "hop", n: 1 },
  "cheshire-cat": { twist: "Vanish", twistText: "Lose to it: it slips to a random Landscape.", kind: "loss-teleport" },
  "masked-figure": { twist: "Masquerade", twistText: "At dusk, Discard 1 random Psyche from your hand.", kind: "dusk-discard-hand", n: 1 },
});

const SUITS = ["lucidity", "elasticity", "willpower"];

function beastId(encounter) {
  return encounter?.refId || encounter?.id || "";
}

/** This beast's own twist entry (ordinary beasts and the Winged Turtle), or null. */
export function beastTwist(encounter) {
  if (!encounter || encounter.megaTier || encounter.type === "archetype") return null;
  return BEAST_TWISTS[beastId(encounter)] || null;
}

/** The rule this beast bends, for display: { twist, twistText }. Ladder Bosses first. */
export function twistInfo(card) {
  if (!card) return null;
  if (card.megaTier && card.twistText) return { twist: card.twist, twistText: card.twistText };
  const id = beastId(card);
  const rung = ladderEntry(id);
  if (rung?.twistText && id !== "winged-turtle") return { twist: rung.twist, twistText: rung.twistText };
  return BEAST_TWISTS[id] || null;
}

function tileBeasts(tile) {
  if (!tile) return [];
  if (Array.isArray(tile.encounters) && tile.encounters.length) return tile.encounters.filter(Boolean);
  return tile.encounter ? [tile.encounter] : [];
}

/** Every Dreambeast standing on the board with this twist kind: [{ tile, encounter, twist }]. */
export function standingTwists(state, kind) {
  const out = [];
  (state?.board || []).forEach((tile) => {
    tileBeasts(tile).forEach((encounter) => {
      const twist = beastTwist(encounter);
      if (twist && (!kind || twist.kind === kind)) out.push({ tile, encounter, twist });
    });
  });
  return out;
}

// ---- Fights --------------------------------------------------------------

function spreadSuits(cards = []) {
  const suits = new Set();
  cards.forEach((c) => {
    if (c?.isWild || c?.suit === "wild") SUITS.forEach((s) => suits.add(s));
    else if (c?.suit) suits.add(c.suit);
  });
  return suits;
}

/** Dice the twist takes from (or gives to) your fight. */
export function twistDiceMod(encounter, cards = []) {
  const t = beastTwist(encounter);
  if (!t) return 0;
  if (t.kind === "dice") return -t.n;
  if (t.kind === "dice-unless-suit") return spreadSuits(cards).has(encounter.suit) ? 0 : -t.n;
  return 0;
}

/** Power the twist adds to the beast for this spread. */
export function twistPowerMod(encounter, cards = []) {
  const t = beastTwist(encounter);
  if (!t || t.kind !== "power-per-missing") return 0;
  const have = spreadSuits(cards);
  return SUITS.filter((s) => !have.has(s)).length * t.n;
}

/** Most Psyche the twist lets you play against it, or null. */
export function twistSpreadCap(encounter) {
  const t = beastTwist(encounter);
  return t?.kind === "cap" ? t.n : null;
}

export function twistTiesToBeast(encounter) {
  return beastTwist(encounter)?.kind === "ties";
}

// ---- While it stands ---------------------------------------------------------

/** Phase Actions the standing beasts take away. */
export function twistPhasePenalty(state, phase) {
  return standingTwists(state, "stand-phase")
    .filter(({ twist }) => twist.phase === phase)
    .reduce((sum, { twist }) => sum + twist.n, 0);
}

export function twistBlocksReturn(state) {
  const found = standingTwists(state, "stand-no-return")[0];
  return found ? `${found.encounter.name} haunts the Subconscious. Nothing Returns while it stands.` : "";
}

export function twistBlocksDreamerPower(state) {
  const found = standingTwists(state, "stand-no-power")[0];
  return found ? `${found.encounter.name}'s gaze holds you. No Dreamer Power while it stands.` : "";
}

/** Extra Psyche the dusk mill takes for standing beasts with an Omen. */
export function twistDuskMill(state) {
  return standingTwists(state, "dusk-mill").reduce((sum, { twist }) => sum + twist.n, 0);
}

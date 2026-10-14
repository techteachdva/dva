/**
 * Ainmos Boss Boons.
 *
 * In Ainmos an Archetype card is points and quests only. Its power (or its
 * passive, for Sage, Magician, and Warrior) lives in the Boon deck. Each time
 * a ladder Boss falls, the table drafts 1 of 3 Boons for the rest of the night.
 *
 * Extra Boons:
 *   Study         1 Power Token: raise 1 Dream Form a level, once per round
 *   Wider Vault   the Dreamscape Vault shows 4 Landscapes
 *   Deep Pockets  each Dreamer can hold 1 more Object, up to 10 (may repeat)
 */

import { addLog } from "../core/state.js";
import { logMoment } from "../core/narrator.js";
import { random } from "../core/rng.js";
import { refillVault } from "../board/dreamscape-vault.js";
import { OBJECT_LIMIT, OBJECT_LIMIT_MAX } from "../shop/lost-found.js";

export const BOON_EXTRAS = Object.freeze([
  {
    id: "study",
    name: "Study",
    kind: "power",
    power: "Raise 1 Dream Form a level. Once per round.",
    glyph: "❂",
  },
  {
    id: "wider-vault",
    name: "Wider Vault",
    kind: "rule",
    text: "The Dreamscape Vault shows 4 Landscapes.",
    glyph: "◈",
  },
  {
    id: "deep-pockets",
    name: "Deep Pockets",
    kind: "rule",
    text: "Each Dreamer can hold 1 more Object (up to 10).",
    glyph: "✦",
    repeatable: true,
  },
]);

const BOON_DRAFT_SIZE = 3;

/** Every Boon the table has taken, oldest first. */
export function takenBoons(state) {
  return Array.isArray(state?.boons) ? state.boons : [];
}

/** Archetype Boons the table holds, shaped like the Archetype cards they came from. */
export function boonArchetypes(state) {
  return takenBoons(state).filter((b) => b.archetype).map((b) => b.archetype);
}

export function hasBoon(state, id) {
  return takenBoons(state).some((b) => b.id === id);
}

function boonFromArchetype(arch) {
  return {
    id: `archetype:${arch.id}`,
    kind: "archetype",
    name: arch.name,
    image: arch.image,
    suit: arch.suit,
    text: arch.passive ? `Passive: ${arch.passive}.` : `1 Power Token, any phase: ${arch.power}`,
    archetype: arch,
  };
}

function boonFromExtra(extra) {
  return {
    id: extra.id,
    kind: extra.kind,
    name: extra.name,
    glyph: extra.glyph,
    text: extra.kind === "power" ? `1 Power Token: ${extra.power}` : extra.text,
    repeatable: !!extra.repeatable,
    archetype: extra.kind === "power" ? { id: extra.id, name: extra.name, power: extra.power } : null,
  };
}

/** Boons still on offer: untaken Archetypes and extras, plus Deep Pockets until the cap. */
export function boonPool(state) {
  const taken = new Set(takenBoons(state).map((b) => b.id));
  const archetypes = (state.boonCatalog || []).map(boonFromArchetype).filter((b) => !taken.has(b.id));
  const extras = BOON_EXTRAS.map(boonFromExtra).filter((b) => {
    if (b.id === "deep-pockets") return (state.objectLimit || OBJECT_LIMIT) < OBJECT_LIMIT_MAX;
    return !taken.has(b.id);
  });
  return [...archetypes, ...extras];
}

function shuffleCopy(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** After a ladder Boss falls: offer 3 Boons. */
export function offerBoonDraft(state, bossName = "the Boss") {
  if (!state || state.status !== "playing") return false;
  const options = shuffleCopy(boonPool(state)).slice(0, BOON_DRAFT_SIZE);
  if (!options.length) return false;
  state.pendingBoonDraft = { bossName, options };
  return true;
}

/** Take one Boon from the open draft. */
export function chooseBoon(state, boonId) {
  const draft = state?.pendingBoonDraft;
  const boon = draft?.options?.find((b) => b.id === boonId);
  if (!boon) return false;
  state.pendingBoonDraft = null;
  state.boons = [...takenBoons(state), boon];
  if (boon.id === "wider-vault") {
    state.vaultSize = 4;
    refillVault(state);
  }
  if (boon.id === "deep-pockets") {
    state.objectLimit = Math.min(OBJECT_LIMIT_MAX, (state.objectLimit || OBJECT_LIMIT) + 1);
  }
  logMoment(state, `Boon from ${draft.bossName}: ${boon.name}. ${boon.text}`);
  addLog(state, `The table takes the Boon ${boon.name}.`);
  return true;
}

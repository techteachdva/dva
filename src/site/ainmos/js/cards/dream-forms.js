/**
 * Ainmos Dream Forms and Psyche upgrades.
 *
 * Dream Forms are spread patterns, like poker hands. A spread counts as one
 * Form: whichever earns the most dice. Every Form starts at +1 die (level 1)
 * and gains +1 die per level. Form Objects level them up.
 *
 * Psyche upgrades ride on a card for the whole night, through deck, hand,
 * discard, and Subconscious. A card holds one upgrade at most. A different
 * upgrade replaces it; the same upgrade again does nothing and is not spent.
 */

import { random } from "../core/rng.js";

const SUITS = ["lucidity", "elasticity", "willpower"];

export const DREAM_FORMS = Object.freeze([
  { id: "echo", name: "Echo", pattern: "Two cards of the same value", objectId: "mirror" },
  { id: "ladder", name: "Ladder", pattern: "Three values in a row", objectId: "rope" },
  { id: "chord", name: "Chord", pattern: "Three cards of one suit", objectId: "conch-shell" },
  { id: "trinity", name: "Trinity", pattern: "One card of each suit", objectId: "spark-of-sun" },
  { id: "trifecta", name: "Trifecta", pattern: "Three of a kind", objectId: "monkey-paw" },
  { id: "unity", name: "Unity", pattern: "Three 1s", objectId: "egg" },
]);

/** Order Forms are listed in when they tie on dice: rarer first. */
const FORM_PRIORITY = ["unity", "trifecta", "trinity", "chord", "ladder", "echo"];

export const PSYCHE_UPGRADES = Object.freeze({
  chaotic: { id: "chaotic", name: "Chaotic", price: 3, text: "Its value is a d6, rolled each time it is drawn." },
  vivid: { id: "vivid", name: "Vivid", price: 4, text: "It also counts as a second suit." },
  lucid: { id: "lucid", name: "Lucid", price: 5, text: "It counts as any suit and keeps its value." },
  recurring: { id: "recurring", name: "Recurring", price: 6, text: "After a spread, win or lose, it returns to your hand." },
});

export const FORM_LEVEL_PRICE = 3;
/** Ainmos 0.25: a Form tops out at +24 dice. */
export const MAX_FORM_LEVEL = 24;

export function formById(id) {
  return DREAM_FORMS.find((f) => f.id === id) || null;
}

export function formLevel(state, id) {
  return Math.min(MAX_FORM_LEVEL, Math.max(1, state?.formLevels?.[id] || 1));
}

export function formMaxed(state, id) {
  return formLevel(state, id) >= MAX_FORM_LEVEL;
}

/** Dice a Form adds: +1 at level 1, +1 per level after. */
export function formDice(state, id) {
  return formLevel(state, id);
}

export function levelUpForm(state, id, by = 1) {
  if (!formById(id)) return 0;
  if (!state.formLevels) state.formLevels = {};
  state.formLevels[id] = Math.min(MAX_FORM_LEVEL, formLevel(state, id) + by);
  return state.formLevels[id];
}

/** Suits a Psyche card counts as, upgrades included. */
export function psycheSuitsOf(card) {
  if (!card) return [];
  if (card.wild || String(card.id || "").startsWith("wild-") || card.upgrade === "lucid") return [...SUITS];
  const suits = card.suit ? [card.suit] : [];
  if (card.upgrade === "vivid" && card.vividSuit && !suits.includes(card.vividSuit)) suits.push(card.vividSuit);
  return suits;
}

function formValue(card) {
  if (card.wild || String(card.id || "").startsWith("wild-")) return 5;
  return Number(card.value) || 0;
}

function isFormCard(card) {
  return card
    && card.type !== "psyche-power"
    && card.type !== "object"
    && !card.isDreambeastPsyche
    && card.type !== "psyche-dreambeast";
}

/** Can the cards take one suit each, all three different? */
function coversThreeSuits(cards) {
  const options = cards.map(psycheSuitsOf);
  const [a, b, c] = options;
  if (!a || !b || !c) return false;
  return a.some((x) => b.some((y) => y !== x && c.some((z) => z !== x && z !== y)));
}

/** Every Form these cards make (allies and Power cards never count). */
export function matchingForms(cards) {
  const spread = (cards || []).filter(isFormCard);
  const found = [];
  const values = spread.map(formValue);
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const most = Math.max(0, ...counts.values());
  if (most >= 2) found.push("echo");
  if (spread.length === 3) {
    if (most === 3) found.push("trifecta");
    if (values.every((v) => v === 1)) found.push("unity");
    const sorted = [...values].sort((x, y) => x - y);
    if (sorted[1] === sorted[0] + 1 && sorted[2] === sorted[1] + 1) found.push("ladder");
    const shared = SUITS.filter((s) => spread.every((card) => psycheSuitsOf(card).includes(s)));
    if (shared.length) found.push("chord");
    if (coversThreeSuits(spread)) found.push("trinity");
  }
  return found;
}

/**
 * Ainmos 0.27.1: Dream Forms stack. A spread scores EVERY Form it makes, so
 * 1-2-3 in three different suits is a Ladder and a Trinity and adds both.
 * A Dreambeast's ward ({ formId, amount }) takes dice off its one Form only.
 * Returns the combined result (null when no Form): dice and blocked are totals,
 * name joins the Forms ("Trinity + Ladder"), forms lists each one, and id/level
 * are the strongest Form's.
 */
export function bestForm(state, cards, { ward = null } = {}) {
  const blocked = state?.blockedForms;
  let found = matchingForms(cards);
  if (blocked === "all") return null;
  if (Array.isArray(blocked) && blocked.length) {
    found = found.filter((id) => !blocked.includes(id));
  }
  if (!found.length) return null;
  const forms = found
    .map((id) => {
      const full = formDice(state, id);
      const blocked = ward && (ward.formId === id || ward.formId === "all") ? Math.min(full, ward.amount || 0) : 0;
      return { id, name: formById(id).name, dice: full - blocked, fullDice: full, blocked, level: formLevel(state, id) };
    })
    .sort((a, b) => b.dice - a.dice || FORM_PRIORITY.indexOf(a.id) - FORM_PRIORITY.indexOf(b.id));
  const top = forms[0];
  return {
    id: top.id,
    level: top.level,
    name: forms.map((f) => f.name).join(" + "),
    dice: forms.reduce((n, f) => n + f.dice, 0),
    fullDice: forms.reduce((n, f) => n + f.fullDice, 0),
    blocked: forms.reduce((n, f) => n + f.blocked, 0),
    forms,
  };
}

/**
 * Put an upgrade on a Psyche card.
 * Returns { ok, spent, message }. The same upgrade twice is refused and not spent.
 */
export function applyPsycheUpgrade(card, upgrade, { vividSuit = null } = {}) {
  const def = PSYCHE_UPGRADES[upgrade];
  if (!def || !isFormCard(card) || card.wild || String(card.id || "").startsWith("wild-")) {
    return { ok: false, spent: false, message: "Only a plain Psyche card can take an upgrade." };
  }
  if (card.upgrade === upgrade) {
    return { ok: false, spent: false, message: `${card.name} is already ${def.name}. Nothing changes, and the upgrade is kept.` };
  }
  const replaced = card.upgrade ? PSYCHE_UPGRADES[card.upgrade]?.name : null;
  if (card.upgrade === "chaotic" && card.baseValue != null) card.value = card.baseValue;
  delete card.vividSuit;
  card.upgrade = upgrade;
  if (upgrade === "chaotic") {
    if (card.baseValue == null) card.baseValue = card.value;
    rollChaoticValue(card);
  }
  if (upgrade === "vivid") {
    card.vividSuit = vividSuit && vividSuit !== card.suit
      ? vividSuit
      : SUITS.find((s) => s !== card.suit);
  }
  return {
    ok: true,
    spent: true,
    message: replaced
      ? `${card.name} is now ${def.name}. ${replaced} fades.`
      : `${card.name} is now ${def.name}.`,
  };
}

/** Chaotic cards roll a fresh value (1–6) every time they are drawn. */
export function rollChaoticValue(card) {
  if (card?.upgrade !== "chaotic") return card?.value;
  if (card.baseValue == null) card.baseValue = card.value;
  card.value = 1 + Math.floor(random() * 6);
  return card.value;
}

export function upgradeLabel(card) {
  if (!card?.upgrade) return "";
  const def = PSYCHE_UPGRADES[card.upgrade];
  if (!def) return "";
  if (card.upgrade === "vivid" && card.vividSuit) {
    return `${def.name} (also ${card.vividSuit.charAt(0).toUpperCase()}${card.vividSuit.slice(1)})`;
  }
  return def.name;
}

/**
 * Ainmos 0.27.2: Archetype Events, read straight from data/archetype-events.json.
 *
 * Every home Landscape has 2 Events, so each Archetype draws from 4. An Event
 * offers Bright (pay Psyche, gain one small thing per point paid) or Dim (free,
 * one drawback in the coming fight). The rules text, the payment filter, and
 * the fight modifiers all come from the same data, so the words always match
 * what happens.
 *
 * Bright costs one of:
 *   { suit, count }  N Psyche of a suit, any value   → worth N
 *   { suit, min }    1 Psyche of a suit worth min+   → worth min
 *   { value }        1 Psyche of exactly that value  → worth value
 * Wild Psyche count as 5 of any suit.
 *
 * Each point buys one "thing": +1 die, −1 Power, Return 1, Draw 2 Psyche,
 * Reveal 1 Landscape, Draw 1 Object, or +1 card in the spread. Two-point
 * things: No Form needed, or a lost spread comes back to hand.
 */

import { isWildPsyche, psycheMatchesSuit } from "../cards/psyche.js";

export const ARCHETYPE_EVENT_POWER = 12;

const SUIT_NAMES = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

/** What one unit of each Bright effect is worth, in points of Psyche. */
const EFFECT_WORTH = {
  dice: 1,
  weaken: 1,
  wide: 1,
  return: 1,
  draw: 0.5, // Draw 2 Psyche is one thing.
  reveal: 1,
  object: 1,
  keep: 2,
  noForm: 2,
};

const DIM_EFFECTS = {
  stronger: { mods: { power: 2 }, text: (name) => `${name} is Power ${ARCHETYPE_EVENT_POWER + 2}` },
  fog: { mods: { dice: -2 }, text: () => "−2 dice" },
  narrow: { mods: { cap: 2 }, text: () => "Max 2 Psyche" },
  noStat: { mods: { noStat: true }, text: () => "Stats add nothing" },
  strict: { mods: { formNeed: "three" }, text: () => "Needs a three-card Form" },
  costly: { mods: { loseRepress: 2 }, text: () => "Lose: Repress 2" },
};

function plural(n, one, many) {
  return n === 1 ? one : many;
}

function suitName(suit) {
  return SUIT_NAMES[suit] || "Wild";
}

/** Points of Psyche a Bright cost asks for. */
export function brightCostPoints(cost = {}) {
  if (cost.count) return cost.count;
  if (cost.min) return cost.min;
  if (cost.value) return cost.value;
  return 0;
}

/** Points a Bright side's effects are worth. Should equal its cost. */
export function brightEffectWorth(effects = {}) {
  return Object.entries(effects).reduce((sum, [key, n]) => {
    const units = n === true ? 1 : Number(n) || 0;
    return sum + units * (EFFECT_WORTH[key] || 0);
  }, 0);
}

/** "Pay 2 Lucidity Psyche", "Pay a Willpower Psyche worth 3+", "Pay a Psyche worth exactly 2". */
export function brightCostText(cost = {}) {
  if (cost.count) return `Pay ${cost.count} ${suitName(cost.suit)}`;
  if (cost.min) return `Pay a ${suitName(cost.suit)} ${cost.min}+`;
  if (cost.value) return `Pay any ${cost.value}`;
  return "Free";
}

/** The hand filter a Bright payment uses (the discard picker and the bot share it). */
export function brightCostFilter(cost = {}) {
  const filter = { payablePsyche: true };
  if (cost.suit) filter.suit = cost.suit;
  if (cost.min) filter.minValue = cost.min;
  if (cost.value) filter.value = cost.value;
  return filter;
}

function psycheValue(card) {
  return isWildPsyche(card) ? 5 : (Number(card?.value) || 0);
}

/** Does this card pay toward this Bright cost? */
export function cardPaysBright(card, cost = {}) {
  if (!card || card.type !== "psyche") return false;
  if (cost.suit && !psycheMatchesSuit(card, cost.suit)) return false;
  if (cost.min && psycheValue(card) < cost.min) return false;
  if (cost.value && psycheValue(card) !== cost.value) return false;
  return true;
}

export function brightPayableCards(player, cost = {}) {
  return (player?.hand || []).filter((card) => cardPaysBright(card, cost));
}

/** How many cards the payment takes. */
export function brightCardCount(cost = {}) {
  return cost.count || 1;
}

export function canPayBright(player, cost = {}) {
  return brightPayableCards(player, cost).length >= brightCardCount(cost);
}

/** Each Bright effect as its own short line, in a fixed order. */
export function brightEffectLines(effects = {}, archName = "The Archetype") {
  const lines = [];
  const n = (key) => (effects[key] === true ? 1 : Number(effects[key]) || 0);
  if (n("dice")) lines.push(`+${n("dice")} ${plural(n("dice"), "die", "dice")}`);
  if (n("weaken")) lines.push(`${archName} is Power ${ARCHETYPE_EVENT_POWER - n("weaken")}`);
  if (n("wide")) lines.push(`Up to ${3 + n("wide")} Psyche`);
  if (n("noForm")) lines.push("No Form needed");
  if (n("keep")) lines.push("Lose: keep your spread");
  if (n("draw")) lines.push(`Draw ${n("draw")} Psyche`);
  if (n("return")) lines.push(`Return ${n("return")} Psyche`);
  if (n("reveal")) lines.push(`Reveal ${n("reveal")} ${plural(n("reveal"), "Landscape", "Landscapes")}`);
  if (n("object")) lines.push(`Draw ${n("object")} ${plural(n("object"), "Object", "Objects")}`);
  return lines;
}

/** The fight modifiers a Bright side sets. */
export function brightFightMods(effects = {}) {
  const mods = {};
  if (effects.dice) mods.dice = effects.dice;
  if (effects.weaken) mods.power = -effects.weaken;
  if (effects.wide) mods.cap = 3 + effects.wide;
  if (effects.noForm) mods.formNeed = "none";
  if (effects.keep) mods.keepOnLoss = true;
  return mods;
}

export function dimSide(event, archName = "The Archetype") {
  const spec = DIM_EFFECTS[event?.dim?.effect] || DIM_EFFECTS.fog;
  return { label: event?.dim?.label || "Dim", hint: spec.text(archName), mods: { ...spec.mods } };
}

export function brightSide(event, archName = "The Archetype") {
  const bright = event?.bright || {};
  const lines = brightEffectLines(bright.effects, archName);
  const { dice, weaken, wide, noForm, keep } = bright.effects || {};
  const fightLines = brightEffectLines({ dice, weaken, wide, noForm, keep }, archName);
  return {
    label: bright.label || "Bright",
    cost: bright.cost || {},
    costText: brightCostText(bright.cost),
    effects: { ...(bright.effects || {}) },
    lines,
    hint: lines.join(" · "),
    fightHint: fightLines.join(" · ") || "The fight stands as it is",
    mods: brightFightMods(bright.effects),
  };
}

/** Every Event whose Bright is worth more or less than it costs (for checks). */
export function unbalancedEvents(events = []) {
  return events
    .map((e) => ({ id: e.id, cost: brightCostPoints(e.bright?.cost), worth: brightEffectWorth(e.bright?.effects) }))
    .filter((row) => row.cost !== row.worth);
}

/** The night's Event catalog: every Archetype Event, tied to its one Landscape. */
export function buildArchetypeEventCatalog(data) {
  return (data?.["archetype-events"] || [])
    .map((event) => ({ ...event, type: "event", landscapes: [event.landscape] }));
}

/** A save from before 0.27.2 holds the old Mindstream Events: swap in the new ones. */
export function refreshArchetypeEventCatalog(state, data) {
  if (!state || !data?.["archetype-events"]) return false;
  const catalog = state.eventCatalog || [];
  if (catalog.length && catalog.every((event) => event.bright)) return false;
  state.eventCatalog = buildArchetypeEventCatalog(data);
  state.archetypeEventDecks = {};
  return true;
}

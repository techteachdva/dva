/**
 * Ainmos: the Lost & Found.
 *
 * Between rounds the table finds three Objects from one shared Object deck,
 * plus one Insight: a Dream Form level or a Psyche upgrade.
 *
 * Objects cost 1–5 Psyche value in their own suit. Insights cost 3–6 Psyche
 * value of any suit. Psyche is health and money at once, so every purchase is
 * a real choice. Overpaying is lost. A reroll costs 1 Power Token.
 *
 * Each Dreamer may hold OBJECT_LIMIT Objects (in hand and in play together).
 */

import { addLog } from "../core/state.js";
import { random } from "../core/rng.js";
import { drawObjectCard, ensureObjectPiles } from "../cards/mindstream-supply.js";
import { psycheMatchesSuit, isWildPsyche } from "../cards/psyche.js";
import {
  DREAM_FORMS,
  FORM_LEVEL_PRICE,
  PSYCHE_UPGRADES,
  applyPsycheUpgrade,
  formById,
  levelUpForm,
} from "../cards/dream-forms.js";

export const LOST_FOUND_SLOTS = 3;
export const OBJECT_LIMIT = 6;
export const OBJECT_LIMIT_MAX = 10;
export const REROLL_TOKEN_COST = 1;

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

export function objectLimit(state) {
  return Math.min(OBJECT_LIMIT_MAX, state?.objectLimit || OBJECT_LIMIT);
}

export function objectCount(player) {
  return (player?.objects?.length || 0) + (player?.persistent?.length || 0);
}

export function objectPrice(card) {
  return Math.max(1, Number(card?.price) || 2);
}

/** One shared Object deck (see drawObjectCard). */
function drawSharedObject(state) {
  return drawObjectCard(state);
}

function returnObjectToBottom(state, card) {
  if (!card) return;
  ensureObjectPiles(state);
  const suit = card.suit || card.mindstreamSuit;
  if (state.objectDecks[suit]) state.objectDecks[suit].push(card);
}

function rollInsight() {
  if (random() < 0.5) {
    const form = DREAM_FORMS[Math.floor(random() * DREAM_FORMS.length)];
    return { kind: "form", formId: form.id, price: FORM_LEVEL_PRICE };
  }
  const ids = Object.keys(PSYCHE_UPGRADES);
  const upgrade = ids[Math.floor(random() * ids.length)];
  return { kind: "upgrade", upgrade, price: PSYCHE_UPGRADES[upgrade].price };
}

export function insightTitle(insight) {
  if (!insight) return "";
  if (insight.kind === "form") return `${formById(insight.formId)?.name || "Form"} +1 level`;
  return `${PSYCHE_UPGRADES[insight.upgrade]?.name || "Upgrade"} upgrade`;
}

export function insightText(insight) {
  if (!insight) return "";
  if (insight.kind === "form") {
    const form = formById(insight.formId);
    return `${form?.name}: ${form?.pattern}. Its spreads roll 1 more die.`;
  }
  return PSYCHE_UPGRADES[insight.upgrade]?.text || "";
}

export function isLostFoundOpen(state) {
  return !!state?.lostFound?.open;
}

/** Open the Lost & Found for this round: deal 3 Objects and 1 Insight. */
export function openLostFound(state) {
  if (!state || state.tutorialMode) return false;
  if (state.lostFound?.open) return true;
  const objects = [];
  for (let i = 0; i < LOST_FOUND_SLOTS; i += 1) {
    const card = drawSharedObject(state);
    if (card) objects.push(card);
  }
  state.lostFound = {
    open: true,
    round: state.round,
    objects,
    insight: rollInsight(),
    rerolls: 0,
    buyerId: state.players.find((p) => p.alive)?.id || null,
  };
  return true;
}

/** Close the Lost & Found. Unbought Objects go under the deck. */
export function closeLostFound(state) {
  const shop = state?.lostFound;
  if (!shop?.open) return false;
  (shop.objects || []).forEach((card) => card && returnObjectToBottom(state, card));
  state.lostFound = { ...shop, open: false, objects: [], insight: null };
  return true;
}

export function setLostFoundBuyer(state, playerId) {
  if (!state?.lostFound?.open) return false;
  const player = state.players.find((p) => p.id === playerId && p.alive);
  if (!player) return false;
  state.lostFound.buyerId = player.id;
  return true;
}

export function lostFoundBuyer(state) {
  const id = state?.lostFound?.buyerId;
  return state.players.find((p) => p.id === id && p.alive) || state.players.find((p) => p.alive) || null;
}

function payable(card) {
  return card && card.type === "psyche" && !card.isDreambeastPsyche && card.type !== "psyche-power";
}

function payValue(card) {
  return isWildPsyche(card) ? 5 : (Number(card.value) || 0);
}

/**
 * The cheapest cards from this hand that cover the price.
 * Least overpay first, then fewest cards, then plain cards before Wild or upgraded ones.
 */
export function paymentFor(player, price, { suit = null, excludeIds = [] } = {}) {
  const pool = (player?.hand || [])
    .filter(payable)
    .filter((c) => !excludeIds.includes(c.instanceId))
    .filter((c) => !suit || psycheMatchesSuit(c, suit))
    .slice(0, 12);
  let best = null;
  const n = pool.length;
  for (let mask = 1; mask < (1 << n); mask += 1) {
    const cards = [];
    let total = 0;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) {
        cards.push(pool[i]);
        total += payValue(pool[i]);
      }
    }
    if (total < price) continue;
    const precious = cards.reduce((sum, c) => sum + (isWildPsyche(c) ? 2 : 0) + (c.upgrade ? 3 : 0), 0);
    const score = [total - price, precious, cards.length];
    if (!best || score[0] < best.score[0]
      || (score[0] === best.score[0] && (score[1] < best.score[1]
        || (score[1] === best.score[1] && score[2] < best.score[2])))) {
      best = { cards, total, score };
    }
  }
  return best ? { cards: best.cards, total: best.total, overpay: best.total - price } : null;
}

function spendPayment(state, player, cards) {
  const ids = new Set(cards.map((c) => c.instanceId));
  player.hand = player.hand.filter((c) => !ids.has(c.instanceId));
  state.psycheDiscard = [...(state.psycheDiscard || []), ...cards];
  state.runStats = state.runStats || {};
  state.runStats.psycheSpentShopping = (state.runStats.psycheSpentShopping || 0) + cards.length;
}

/** Why this Object cannot be bought right now, or "" when it can. */
export function objectBlockReason(state, player, card) {
  if (!card) return "That shelf is empty.";
  if (!player) return "Choose a Dreamer to buy.";
  if (objectCount(player) >= objectLimit(state)) {
    return `${player.name} already holds ${objectLimit(state)} Objects. Play or discard one first.`;
  }
  if (!paymentFor(player, objectPrice(card), { suit: card.suit })) {
    return `${player.name} needs ${objectPrice(card)} ${SUIT_NAME[card.suit] || ""} Psyche value.`;
  }
  return "";
}

/** Buy Object `index`. `giveObject(state, player, card)` places it (hand, or Must Play). */
export function buyLostFoundObject(state, index, giveObject) {
  const shop = state?.lostFound;
  const player = lostFoundBuyer(state);
  const card = shop?.objects?.[index];
  const reason = objectBlockReason(state, player, card);
  if (reason) return { ok: false, reason };
  const pay = paymentFor(player, objectPrice(card), { suit: card.suit });
  spendPayment(state, player, pay.cards);
  shop.objects.splice(index, 1);
  addLog(state, `${player.name} finds ${card.name} in the Lost & Found for ${pay.cards.map((c) => c.name).join(" + ")}.`);
  state.runStats = state.runStats || {};
  state.runStats.objectsBought = (state.runStats.objectsBought || 0) + 1;
  giveObject?.(state, player, card);
  return { ok: true, card, paid: pay.cards };
}

/** Free Insights earned by Accepting beasts. One covers the Insight on offer, whatever it rolls to. */
export function freeInsightCount(state) {
  return Math.max(0, state?.freeInsights || 0);
}

/** What the Insight costs right now: nothing while a free one is owed. */
export function insightCost(state) {
  const insight = state?.lostFound?.insight;
  if (!insight) return 0;
  return freeInsightCount(state) > 0 ? 0 : insight.price;
}

export function insightBlockReason(state, player, { targetId = null } = {}) {
  const insight = state?.lostFound?.insight;
  if (!insight) return "The Insight is gone for this round.";
  if (!player) return "Choose a Dreamer to buy.";
  const exclude = targetId ? [targetId] : [];
  if (insight.kind === "upgrade") {
    const eligible = (player.hand || []).filter((c) => payable(c) && !isWildPsyche(c) && c.upgrade !== insight.upgrade);
    if (!eligible.length) return `${player.name} has no plain Psyche to take this upgrade.`;
  }
  if (insightCost(state) > 0 && !paymentFor(player, insight.price, { excludeIds: exclude })) {
    return `${player.name} needs ${insight.price} Psyche value of any suit${insight.kind === "upgrade" ? ", besides the card being upgraded" : ""}.`;
  }
  return "";
}

/** Pay for the Insight: spend a free one if owed, otherwise the cheapest cards. */
function payForInsight(state, player, excludeIds = []) {
  if (insightCost(state) === 0) {
    state.freeInsights = freeInsightCount(state) - 1;
    return true;
  }
  const pay = paymentFor(player, state.lostFound.insight.price, { excludeIds });
  if (!pay) return false;
  spendPayment(state, player, pay.cards);
  return true;
}

/** Cards in the buyer's hand that could take the offered upgrade. */
export function upgradeTargets(state, player) {
  const insight = state?.lostFound?.insight;
  if (insight?.kind !== "upgrade" || !player) return [];
  return (player.hand || []).filter((c) => payable(c) && !isWildPsyche(c) && c.upgrade !== insight.upgrade);
}

/** Buy the Insight. Upgrades need a target card (and, for Vivid, a second suit). */
export function buyLostFoundInsight(state, { targetId = null, vividSuit = null } = {}) {
  const shop = state?.lostFound;
  const player = lostFoundBuyer(state);
  const insight = shop?.insight;
  const reason = insightBlockReason(state, player, { targetId });
  if (reason) return { ok: false, reason };
  if (insight.kind === "upgrade") {
    const target = (player.hand || []).find((c) => c.instanceId === targetId);
    if (!target) return { ok: false, reason: "Choose the Psyche card to upgrade." };
    const result = applyPsycheUpgrade(target, insight.upgrade, { vividSuit });
    if (!result.ok) return { ok: false, reason: result.message };
    payForInsight(state, player, [targetId]);
    shop.insight = null;
    addLog(state, `${player.name} gains an Insight: ${result.message}`);
    return { ok: true, message: result.message };
  }
  payForInsight(state, player);
  const level = levelUpForm(state, insight.formId);
  shop.insight = null;
  const name = formById(insight.formId)?.name;
  addLog(state, `${player.name} gains an Insight: ${name} rises to level ${level}.`);
  return { ok: true, message: `${name} rises to level ${level}.` };
}

/** Spend 1 Power Token to redeal the shelves and the Insight. */
export function rerollLostFound(state, spendTokens) {
  const shop = state?.lostFound;
  const player = lostFoundBuyer(state);
  if (!shop?.open || !player) return { ok: false, reason: "The Lost & Found is closed." };
  if ((player.powerTokens || 0) < REROLL_TOKEN_COST) {
    return { ok: false, reason: `${player.name} needs ${REROLL_TOKEN_COST} Power Token to look again.` };
  }
  spendTokens?.(state, player, REROLL_TOKEN_COST);
  (shop.objects || []).forEach((card) => returnObjectToBottom(state, card));
  shop.objects = [];
  for (let i = 0; i < LOST_FOUND_SLOTS; i += 1) {
    const card = drawSharedObject(state);
    if (card) shop.objects.push(card);
  }
  shop.insight = rollInsight();
  shop.rerolls = (shop.rerolls || 0) + 1;
  state.runStats = state.runStats || {};
  state.runStats.rerolls = (state.runStats.rerolls || 0) + 1;
  addLog(state, `${player.name} spends a Power Token. The Lost & Found shifts.`);
  return { ok: true };
}

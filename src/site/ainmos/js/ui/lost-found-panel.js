import { isBlockingGameChoice } from "../core/state.js";
/**
 * The Lost & Found window (Ainmos shop at the end of every Dream).
 *
 * Three Objects on the shelves, one Insight, a reroll, and the way back into
 * the dream. Every blocked button says why and what you could do instead.
 */

import {
  isLostFoundOpen,
  lostFoundBuyer,
  objectPrice,
  objectBlockReason,
  paymentFor,
  insightBlockReason,
  insightCost,
  freeInsightCount,
  insightTitle,
  insightText,
  upgradeTargets,
  objectCount,
  objectLimit,
  REROLL_TOKEN_COST,
  REROLL_GLIMMER_COST,
  glimmerHeld,
  glimmerFor,
  rerollPayment,
} from "../shop/lost-found.js";
import { PSYCHE_UPGRADES } from "../cards/dream-forms.js";
import { isWildPsyche, psycheCardValue } from "../cards/psyche.js";
import { DREAM_DRAW } from "../core/data.js";

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };
const SUITS = ["lucidity", "elasticity", "willpower"];

/** Local choices while buying an upgrade. */
const pick = { targetId: null, vividSuit: null, picking: false };
let lastKey = "";

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function kindLabel(card) {
  if (card.levelsForm) return "Dream Form";
  if (card.subtype === "persistent") return "Persistent";
  if (card.subtype === "must-play") return "Must Play";
  return "Instant";
}

function payLine(cards) {
  return cards.map((c) => (c.wild || String(c.id || "").startsWith("wild-") ? "Wild 5" : `${SUIT_NAME[c.suit] || ""} ${c.value}`)).join(" + ");
}

/** A price tag; with Glimmer it shows the old price struck through and what is left to pay. */
function priceTag(price, glim, title, extra = "") {
  if (!glim) {
    return `<span class="lf-price ${extra}" title="${esc(title)}"><b>${price}</b><i class="lf-pip" aria-hidden="true"></i></span>`;
  }
  const rest = price - glim;
  return `<span class="lf-price ${extra} lf-price-glimmer" title="${esc(title)}, ${glim} paid by Glimmer"><s>${price}</s><b>${rest}</b><i class="lf-pip" aria-hidden="true"></i><em>−${glim}✧</em></span>`;
}

function payLabel(glim, cards) {
  return [glim ? `${glim}✧ Glimmer` : "", cards.length ? payLine(cards) : ""].filter(Boolean).join(" + ") || "nothing";
}

/** 0.26.2: your hand, right in the shop, so you know what each price really costs you. */
function handHtml(state, buyer) {
  const cards = (buyer?.hand || []).filter((c) => c.type === "psyche" || isWildPsyche(c));
  const bySuit = SUITS.map((suit) => `<span class="lf-hand-sum suit-${suit}">${SUIT_NAME[suit]} ${cards.filter((c) => !isWildPsyche(c) && c.suit === suit).reduce((n, c) => n + psycheCardValue(c), 0)}</span>`).join("");
  const wild = cards.filter(isWildPsyche).length;
  const chips = cards
    .slice()
    .sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || psycheCardValue(a) - psycheCardValue(b))
    .map((c) => {
      const suit = isWildPsyche(c) ? "wild" : c.suit;
      return `<span class="lf-hand-card suit-${esc(suit)}" title="${esc(c.name || "")}"><b>${psycheCardValue(c)}</b><i>${isWildPsyche(c) ? "Wild" : esc(SUIT_NAME[c.suit] || "")}</i></span>`;
    }).join("");
  return `
    <div class="lf-hand" aria-label="Your hand">
      <p class="lf-hand-head"><strong>Your hand · ${cards.length} Psyche</strong> ${bySuit}${wild ? `<span class="lf-hand-sum suit-wild">${wild} Wild</span>` : ""}<span class="lf-hand-next">Leaving draws ${DREAM_DRAW} for the next round.</span></p>
      <div class="lf-hand-row">${chips || `<span class="lf-hand-empty">No Psyche in hand.</span>`}</div>
    </div>`;
}

function buyerHtml(state, buyer) {
  return state.players.filter((p) => p.alive).map((p) => `
    <button type="button" class="lf-buyer${p.id === buyer?.id ? " is-active" : ""}" data-lf-buyer="${esc(p.id)}" aria-pressed="${p.id === buyer?.id}">
      <span class="lf-buyer-face" style="background-image:url('${esc(p.dreamer?.image)}')"></span>
      <span class="lf-buyer-name">${esc(p.name)}</span>
      <span class="lf-buyer-meta">${(p.hand || []).length} Psyche · ${objectCount(p)}/${objectLimit(state)} Objects · ${p.powerTokens || 0}⚡ · ${glimmerHeld(state)}✧</span>
    </button>`).join("");
}

function objectHtml(state, buyer, card, index) {
  const price = objectPrice(card);
  const glim = glimmerFor(state, price);
  const reason = objectBlockReason(state, buyer, card);
  const pay = reason ? null : paymentFor(buyer, price - glim, { suit: card.suit });
  const full = objectCount(buyer) >= objectLimit(state);
  return `
    <article class="lf-item suit-${esc(card.suit)}">
      <div class="lf-item-art" style="background-image:url('${esc(card.image)}')"></div>
      ${priceTag(price, glim, `${price} ${SUIT_NAME[card.suit]} Psyche value`)}
      <h4 class="lf-item-name">${esc(card.name)}</h4>
      <p class="lf-item-kind">${card.setSearch ? "Your Set's missing piece · " : ""}${kindLabel(card)} ·${SUIT_NAME[card.suit] || ""}</p>
      <p class="lf-item-text">${esc(card.text)}</p>
      <div class="lf-item-foot">
        ${reason
          ? `<p class="lf-why">${esc(reason)}</p>`
          : `<p class="lf-pay">Pay ${esc(payLabel(glim, pay.cards))}${pay.overpay ? ` <span class="lf-over">(${pay.overpay} lost)</span>` : ""}${full ? ` <span class="lf-over">· then let one Object go</span>` : ""}</p>`}
        <button type="button" class="lf-btn lf-buy" data-lf-buy="${index}" ${reason ? "aria-disabled=\"true\"" : ""}>Take it</button>
      </div>
    </article>`;
}

function insightHtml(state, buyer) {
  const insight = state.lostFound?.insight;
  if (!insight) {
    return `<article class="lf-item lf-insight is-gone"><p class="lf-empty">The Insight has been taken this round.</p></article>`;
  }
  const isUpgrade = insight.kind === "upgrade";
  const reason = insightBlockReason(state, buyer, { targetId: pick.targetId });
  let picker = "";
  if (isUpgrade && pick.picking) {
    const targets = upgradeTargets(state, buyer);
    picker = `
      <div class="lf-picker" role="group" aria-label="Choose a Psyche card to upgrade">
        <p class="lf-picker-title">Which card?</p>
        <div class="lf-chips">${targets.map((c) => `
          <button type="button" class="lf-chip suit-${esc(c.suit)}${c.instanceId === pick.targetId ? " is-active" : ""}" data-lf-target="${esc(c.instanceId)}">
            ${c.value}<small>${esc(SUIT_NAME[c.suit] || "")}${c.upgrade ? ` · ${esc(PSYCHE_UPGRADES[c.upgrade]?.name || "")}` : ""}</small>
          </button>`).join("")}</div>
        ${insight.upgrade === "vivid" && pick.targetId ? `
          <p class="lf-picker-title">Its second suit</p>
          <div class="lf-chips">${SUITS.filter((s) => s !== buyer.hand.find((c) => c.instanceId === pick.targetId)?.suit).map((s) => `
            <button type="button" class="lf-chip suit-${s}${pick.vividSuit === s ? " is-active" : ""}" data-lf-vivid="${s}">${SUIT_NAME[s]}</button>`).join("")}</div>` : ""}
      </div>`;
  }
  const ready = !reason && (!isUpgrade || (pick.targetId && (insight.upgrade !== "vivid" || pick.vividSuit)));
  const free = insightCost(state) === 0;
  const glim = free ? 0 : glimmerFor(state, insight.price);
  const pay = !reason && !free ? paymentFor(buyer, insight.price - glim, { excludeIds: pick.targetId ? [pick.targetId] : [] }) : null;
  return `
    <article class="lf-item lf-insight">
      <div class="lf-insight-sigil" aria-hidden="true">${isUpgrade ? "✧" : "❂"}</div>
      ${free
        ? `<span class="lf-price lf-price-free" title="Free: earned by Accepting a beast"><b>Free</b></span>`
        : priceTag(insight.price, glim, `${insight.price} Psyche value of any suit`, "lf-price-any")}
      <h4 class="lf-item-name">${esc(insightTitle(insight))}</h4>
      <p class="lf-item-kind">Insight · any suit</p>
      <p class="lf-item-text">${esc(insightText(insight))}</p>
      ${picker}
      <div class="lf-item-foot">
        ${reason
          ? `<p class="lf-why">${esc(reason)}</p>`
          : free
            ? `<p class="lf-pay">Free · you Accepted a beast${freeInsightCount(state) > 1 ? ` (${freeInsightCount(state)} owed)` : ""}</p>`
            : pay ? `<p class="lf-pay">Pay ${esc(payLabel(glim, pay.cards))}${pay.overpay ? ` <span class="lf-over">(${pay.overpay} lost)</span>` : ""}</p>` : ""}
        ${isUpgrade && !pick.picking && !reason
          ? `<button type="button" class="lf-btn" data-lf-pick="1">Choose a card</button>`
          : `<button type="button" class="lf-btn lf-buy" data-lf-insight="1" ${ready ? "" : "aria-disabled=\"true\""}>Learn it</button>`}
      </div>
    </article>`;
}

/**
 * @param {object} state
 * @param {{ onBuy, onInsight, onReroll, onBuyer, onClose, onBlocked }} handlers
 */
export function renderLostFound(state, handlers = {}) {
  const host = document.getElementById("lost-found");
  if (!host) return;
  if (!isLostFoundOpen(state)) {
    host.hidden = true;
    host.innerHTML = "";
    lastKey = "";
    pick.targetId = null;
    pick.vividSuit = null;
    pick.picking = false;
    document.body.classList.remove("lost-found-open");
    return;
  }
  // A choice the table must make first (a Repress, a death, an Object limit) comes before shopping.
  if (isBlockingGameChoice(state)) {
    host.hidden = true;
    document.body.classList.remove("lost-found-open");
    lastKey = "";
    return;
  }
  const shop = state.lostFound;
  const buyer = lostFoundBuyer(state);
  const key = JSON.stringify([
    shop.objects.map((o) => o.instanceId),
    shop.insight,
    buyer?.id,
    buyer?.hand?.map((c) => c.instanceId),
    buyer?.powerTokens,
    state.glimmer,
    objectCount(buyer),
    pick,
  ]);
  host.hidden = false;
  document.body.classList.add("lost-found-open");
  if (key === lastKey) return;
  lastKey = key;

  const rerollHow = rerollPayment(state, buyer);
  const rerollBlocked = rerollHow
    ? ""
    : `Looking again takes ${REROLL_GLIMMER_COST}✧ Glimmer or ${REROLL_TOKEN_COST} Power Token.`;
  const rerollLabel = rerollHow === "token" ? `Look again · ${REROLL_TOKEN_COST}⚡` : `Look again · ${REROLL_GLIMMER_COST}✧`;

  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window" role="dialog" aria-modal="true" aria-labelledby="lf-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="lf-title" class="lf-title">Lost &amp; Found</h3>
        <span class="lf-round">End of Dream ${Math.max(1, (state.round || 2) - 1)}</span>
      </header>
      <p class="lf-whisper">Things you forgot you had.${glimmerHeld(state) ? ` <span class="lf-glimmer">${glimmerHeld(state)}✧ Glimmer pays first</span>` : ` <span class="lf-glimmer is-empty">Leave paid-for Reveals, steps, or Meet actions unused to bank Glimmer ✧</span>`}</p>
      <div class="lf-buyers" role="group" aria-label="Who reaches in?">${buyerHtml(state, buyer)}</div>
      ${handHtml(state, buyer)}
      <div class="lf-shelf">
        ${shop.objects.length
          ? shop.objects.map((card, index) => objectHtml(state, buyer, card, index)).join("")
          : `<p class="lf-empty">The shelves are bare.</p>`}
        ${insightHtml(state, buyer)}
      </div>
      <footer class="lf-foot">
        <button type="button" class="lf-btn lf-reroll" data-lf-reroll="1" ${rerollBlocked ? "aria-disabled=\"true\"" : ""} title="${esc(rerollBlocked || "See different things.")}">${rerollLabel}</button>
        <button type="button" class="lf-btn lf-continue" data-lf-close="1">Into the Dream →</button>
      </footer>
    </section>`;

  const blocked = (el) => el.getAttribute("aria-disabled") === "true";
  host.querySelectorAll("[data-lf-buyer]").forEach((el) => el.addEventListener("click", () => {
    pick.targetId = null;
    pick.vividSuit = null;
    pick.picking = false;
    handlers.onBuyer?.(el.dataset.lfBuyer);
  }));
  host.querySelectorAll("[data-lf-buy]").forEach((el) => el.addEventListener("click", () => {
    if (blocked(el)) {
      handlers.onBlocked?.(el.closest(".lf-item")?.querySelector(".lf-why")?.textContent || "");
      return;
    }
    handlers.onBuy?.(Number(el.dataset.lfBuy));
  }));
  host.querySelector("[data-lf-pick]")?.addEventListener("click", () => {
    pick.picking = true;
    lastKey = "";
    handlers.onRefresh?.();
  });
  host.querySelectorAll("[data-lf-target]").forEach((el) => el.addEventListener("click", () => {
    pick.targetId = el.dataset.lfTarget;
    pick.vividSuit = null;
    lastKey = "";
    handlers.onRefresh?.();
  }));
  host.querySelectorAll("[data-lf-vivid]").forEach((el) => el.addEventListener("click", () => {
    pick.vividSuit = el.dataset.lfVivid;
    lastKey = "";
    handlers.onRefresh?.();
  }));
  host.querySelector("[data-lf-insight]")?.addEventListener("click", (event) => {
    if (blocked(event.currentTarget)) {
      handlers.onBlocked?.(host.querySelector(".lf-insight .lf-why")?.textContent || "Choose a card first.");
      return;
    }
    const choice = { targetId: pick.targetId, vividSuit: pick.vividSuit };
    pick.targetId = null;
    pick.vividSuit = null;
    pick.picking = false;
    handlers.onInsight?.(choice);
  });
  host.querySelector("[data-lf-reroll]")?.addEventListener("click", (event) => {
    if (blocked(event.currentTarget)) {
      handlers.onBlocked?.(event.currentTarget.title);
      return;
    }
    handlers.onReroll?.();
  });
  host.querySelector("[data-lf-close]")?.addEventListener("click", () => handlers.onClose?.());
}

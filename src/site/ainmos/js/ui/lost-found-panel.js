import { isBlockingGameChoice } from "../core/state.js";
/**
 * The Lost & Found window (Ainmos shop between rounds).
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
} from "../shop/lost-found.js";
import { PSYCHE_UPGRADES } from "../cards/dream-forms.js";

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

function buyerHtml(state, buyer) {
  return state.players.filter((p) => p.alive).map((p) => `
    <button type="button" class="lf-buyer${p.id === buyer?.id ? " is-active" : ""}" data-lf-buyer="${esc(p.id)}" aria-pressed="${p.id === buyer?.id}">
      <span class="lf-buyer-face" style="background-image:url('${esc(p.dreamer?.image)}')"></span>
      <span class="lf-buyer-name">${esc(p.name)}</span>
      <span class="lf-buyer-meta">${(p.hand || []).length} Psyche · ${objectCount(p)}/${objectLimit(state)} Objects · ${p.powerTokens || 0}⚡</span>
    </button>`).join("");
}

function objectHtml(state, buyer, card, index) {
  const price = objectPrice(card);
  const reason = objectBlockReason(state, buyer, card);
  const pay = reason ? null : paymentFor(buyer, price, { suit: card.suit });
  return `
    <article class="lf-item suit-${esc(card.suit)}">
      <div class="lf-item-art" style="background-image:url('${esc(card.image)}')"></div>
      <span class="lf-price" title="${price} ${SUIT_NAME[card.suit]} Psyche value"><b>${price}</b><i class="lf-pip" aria-hidden="true"></i></span>
      <h4 class="lf-item-name">${esc(card.name)}</h4>
      <p class="lf-item-kind">${kindLabel(card)} · ${SUIT_NAME[card.suit] || ""}</p>
      <p class="lf-item-text">${esc(card.text)}</p>
      <div class="lf-item-foot">
        ${reason
          ? `<p class="lf-why">${esc(reason)}</p>`
          : `<p class="lf-pay">Pay ${esc(payLine(pay.cards))}${pay.overpay ? ` <span class="lf-over">(${pay.overpay} lost)</span>` : ""}</p>`}
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
  const pay = !reason && !free ? paymentFor(buyer, insight.price, { excludeIds: pick.targetId ? [pick.targetId] : [] }) : null;
  return `
    <article class="lf-item lf-insight">
      <div class="lf-insight-sigil" aria-hidden="true">${isUpgrade ? "✧" : "❂"}</div>
      ${free
        ? `<span class="lf-price lf-price-free" title="Free: earned by Accepting a beast"><b>Free</b></span>`
        : `<span class="lf-price lf-price-any" title="${insight.price} Psyche value of any suit"><b>${insight.price}</b><i class="lf-pip" aria-hidden="true"></i></span>`}
      <h4 class="lf-item-name">${esc(insightTitle(insight))}</h4>
      <p class="lf-item-kind">Insight · any suit</p>
      <p class="lf-item-text">${esc(insightText(insight))}</p>
      ${picker}
      <div class="lf-item-foot">
        ${reason
          ? `<p class="lf-why">${esc(reason)}</p>`
          : free
            ? `<p class="lf-pay">Free · you Accepted a beast${freeInsightCount(state) > 1 ? ` (${freeInsightCount(state)} owed)` : ""}</p>`
            : pay ? `<p class="lf-pay">Pay ${esc(payLine(pay.cards))}${pay.overpay ? ` <span class="lf-over">(${pay.overpay} lost)</span>` : ""}</p>` : ""}
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
    objectCount(buyer),
    pick,
  ]);
  host.hidden = false;
  document.body.classList.add("lost-found-open");
  if (key === lastKey) return;
  lastKey = key;

  const rerollBlocked = (buyer?.powerTokens || 0) < REROLL_TOKEN_COST
    ? `${buyer?.name || "This Dreamer"} needs ${REROLL_TOKEN_COST} Power Token to look again.`
    : "";

  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window" role="dialog" aria-modal="true" aria-labelledby="lf-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="lf-title" class="lf-title">Lost &amp; Found</h3>
        <span class="lf-round">Between rounds ${Math.max(1, (state.round || 2) - 1)} and ${state.round || 2}</span>
      </header>
      <p class="lf-whisper">Things you forgot you had.</p>
      <div class="lf-buyers" role="group" aria-label="Who reaches in?">${buyerHtml(state, buyer)}</div>
      <div class="lf-shelf">
        ${shop.objects.length
          ? shop.objects.map((card, index) => objectHtml(state, buyer, card, index)).join("")
          : `<p class="lf-empty">The shelves are bare.</p>`}
        ${insightHtml(state, buyer)}
      </div>
      <footer class="lf-foot">
        <button type="button" class="lf-btn lf-reroll" data-lf-reroll="1" ${rerollBlocked ? "aria-disabled=\"true\"" : ""} title="${esc(rerollBlocked || "Spend 1 Power Token to see different things.")}">Look again · ${REROLL_TOKEN_COST}⚡</button>
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

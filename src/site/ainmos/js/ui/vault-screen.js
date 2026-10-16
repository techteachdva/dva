/**
 * The Dreamscape Vault, full screen.
 *
 * During Reveal the Vault is the decision, so it gets the whole screen, in the
 * same window as the Lost & Found: three Landscapes, big, with what each one
 * does and whether a quest wants it. Choosing one fades the window away to
 * the board's glowing slots; after the placement it fades back for the next.
 * "View the dream" steps out to look at the board without choosing.
 */

import { isBlockingGameChoice } from "../core/state.js";
import { isFreeformBoard, vaultCards, tileDeckCount, vaultRefreshCost } from "../board/dreamscape-vault.js";
import { LANDSCAPE_ACTION_DEFS } from "../board/landscape-actions.js";
import { glimmerIfUnused, phaseTopUpCards } from "../core/game.js";
import { unusedGlimmerText } from "../core/cycle.js";
/** Landscapes that are homes of the Archetypes the next Archetype Dream will offer. */
function upcomingHomes(state) {
  const map = new Map();
  (state.archetypeDeck || []).slice(0, 3).forEach((arch) => (arch.landscapes || []).forEach((id) => map.set(id, arch.name)));
  return map;
}

const SUIT_NAME = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

let lastKey = "";
/** After each placement the board gets a beat to show the tile landing. */
const LAND_BEAT_MS = 750;
let lastPlaced = -1;
let holdUntil = 0;
/** Stepped out to look at the board; cleared when the placement count changes. */
let peek = { on: false, remaining: -1, round: -1 };

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function absolute(src) {
  return src ? new URL(src, document.baseURI).href : "";
}

/** Placing from the Vault with Lucidity (or for free), and no tile chosen yet. */
export function vaultScreenWanted(state) {
  if (!state || state.status !== "playing" || !isFreeformBoard(state)) return false;
  const pick = state.landscapePick;
  if (pick?.mode !== "reveal" || pick.excessOnly || pick.flipCard) return false;
  if ((pick.remaining || 0) < 1 || pick.vaultIndex != null) return false;
  if (!vaultCards(state).length) return false;
  // The placement itself counts as a blocking choice; anything else on top of it wins.
  if (state.lostFound?.open || isBlockingGameChoice({ ...state, landscapePick: null })) return false;
  return true;
}

/** Leave the window to look at the board. It returns after the next placement. */
export function peekVaultScreen(state) {
  peek = { on: true, remaining: state.landscapePick?.remaining ?? -1, round: state.round };
}

export function isVaultScreenPeeking(state) {
  if (!peek.on) return false;
  if (peek.round !== state.round || peek.remaining !== (state.landscapePick?.remaining ?? -1)) {
    peek.on = false;
    return false;
  }
  return true;
}

export function resumeVaultScreen() {
  peek.on = false;
}

function cardHtml(card, index, questIds) {
  const action = LANDSCAPE_ACTION_DEFS[card.uniqueAction || card.landscapeActions?.[0]] || null;
  const home = questIds.get(card.id);
  const quest = !!home;
  return `
    <article class="lf-item vs-item suit-${esc(card.suit || "none")}${quest ? " is-quest" : ""}">
      <div class="vs-hex" style="background-image:url('${esc(absolute(card.image))}')"></div>
      ${quest ? `<span class="vs-quest" title="The ${esc(home)} can appear here when it is called">★ ${esc(home)}'s home</span>` : ""}
      <h4 class="lf-item-name">${esc(card.name)}</h4>
      <p class="lf-item-kind">${esc(SUIT_NAME[card.suit] || "Landscape")} Landscape</p>
      ${action ? `<p class="lf-item-text"><strong>${esc(action.label)}.</strong> ${esc(action.description)} <span class="vs-call">Or Call ${card.suit === "elasticity" ? "an" : "a"} ${esc(SUIT_NAME[card.suit] || "")} Dreambeast.</span></p>` : ""}
      <div class="lf-item-foot">
        <button type="button" class="lf-btn lf-buy vs-pick" data-vs-pick="${index}">Dream it</button>
      </div>
    </article>`;
}

/**
 * @param {object} state
 * @param {{ onSelect:(i:number)=>void, onRefresh:()=>void, onDone:()=>void, onPeek:()=>void, onBlocked:(why:string)=>void }} handlers
 */
export function renderVaultScreen(state, handlers = {}) {
  const host = document.getElementById("vault-screen");
  if (!host) return;
  const placed = state?.runStats?.landscapesPlaced || 0;
  if (lastPlaced >= 0 && placed > lastPlaced) {
    holdUntil = Date.now() + LAND_BEAT_MS;
    window.setTimeout(() => handlers.onPeek?.(), LAND_BEAT_MS + 20);
  }
  lastPlaced = placed;
  const show = vaultScreenWanted(state) && !isVaultScreenPeeking(state) && Date.now() >= holdUntil;
  document.body.classList.toggle("vault-screen-open", show);
  if (!show) {
    if (!host.hidden) {
      host.classList.add("is-leaving");
      window.setTimeout(() => {
        if (!document.body.classList.contains("vault-screen-open")) {
          host.hidden = true;
          host.classList.remove("is-leaving");
          host.innerHTML = "";
        }
      }, 260);
    }
    lastKey = "";
    return;
  }

  const pick = state.landscapePick;
  const cards = vaultCards(state);
  const deck = tileDeckCount(state);
  const cost = vaultRefreshCost(state);
  const remaining = pick.remaining || 0;
  const free = !!pick.freeReveal;
  const questIds = upcomingHomes(state);
  // 0.26: opened on free Reveals? You may still spend one Lucidity, once, for +its value.
  const topUps = [...new Map(phaseTopUpCards(state).map((c) => [c.value, c])).values()].sort((a, b) => a.value - b.value);
  const key = [cards.map((c) => c.id).join(","), deck, cost, remaining, free, [...questIds.keys()].join(","), topUps.map((c) => c.value).join(",")].join("|");
  host.hidden = false;
  host.classList.remove("is-leaving");
  if (key === lastKey) return;
  lastKey = key;

  const refreshBlocked = free
    ? "Free placements cannot pay for a refresh."
    : !deck
      ? "The tile deck is empty."
      : remaining < cost
        ? `Refreshing costs ${cost} Lucidity; ${remaining} left.`
        : "";
  const noun = free ? "free placement" : "Lucidity";

  host.innerHTML = `
    <div class="lf-veil" aria-hidden="true"></div>
    <section class="lf-window vs-window" role="dialog" aria-modal="true" aria-labelledby="vs-title">
      <header class="lf-titlebar">
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <h3 id="vs-title" class="lf-title">Dreamscape Vault</h3>
        <span class="lf-round">${deck} asleep in the deck</span>
      </header>
      <p class="lf-whisper">What does the dream become next?</p>
      <div class="vs-budget" aria-live="polite">${free
        ? `<b>${remaining}</b> ${noun}${remaining !== 1 ? "s" : ""} left`
        : `<b>${remaining}</b> Reveal Action${remaining === 1 ? "" : "s"} left · ${unusedGlimmerText(glimmerIfUnused(state, remaining))}`}</div>
      ${topUps.length ? `<div class="vs-topup"><span>Want more? Spend 1 Lucidity:</span>${topUps.map((c) => `<button type="button" class="lf-btn vs-topup-btn" data-vs-topup="${esc(c.instanceId)}" title="Spend ${esc(c.name || "this Lucidity")} for +${c.value} Reveal Actions. Bought Reveals left unused become Glimmer ✧.">+${c.value}</button>`).join("")}</div>` : ""}
      <div class="lf-shelf vs-shelf">${cards.map((card, index) => cardHtml(card, index, questIds)).join("")}</div>
      <footer class="lf-foot">
        <button type="button" class="lf-btn" data-vs-peek="1">View the dream</button>
        <button type="button" class="lf-btn lf-reroll" data-vs-refresh="1" ${refreshBlocked ? "aria-disabled=\"true\"" : ""} title="${esc(refreshBlocked || `Redeal the Vault. Each refresh this round costs 1 more.`)}">Refresh · ${cost}✧</button>
        <button type="button" class="lf-btn lf-continue" data-vs-done="1" title="Stop placing. Each Reveal you paid for and left unused becomes 1 Glimmer ✧ for the Lost &amp; Found.">Done placing →</button>
      </footer>
    </section>`;

  // The whole card is the button: easy to hit with a thumb or a cursor.
  host.querySelectorAll(".vs-item").forEach((item) => item.addEventListener("click", () => {
    const btn = item.querySelector("[data-vs-pick]");
    if (btn) handlers.onSelect?.(Number(btn.dataset.vsPick));
  }));
  host.querySelector("[data-vs-refresh]")?.addEventListener("click", (event) => {
    if (event.currentTarget.getAttribute("aria-disabled") === "true") {
      handlers.onBlocked?.(event.currentTarget.title);
      return;
    }
    handlers.onRefresh?.();
  });
  host.querySelector("[data-vs-peek]")?.addEventListener("click", () => {
    peekVaultScreen(state);
    handlers.onPeek?.();
  });
  host.querySelector("[data-vs-done]")?.addEventListener("click", () => handlers.onDone?.());
  host.querySelectorAll("[data-vs-topup]").forEach((btn) => btn.addEventListener("click", () => {
    handlers.onTopUp?.(btn.dataset.vsTopup);
  }));
}

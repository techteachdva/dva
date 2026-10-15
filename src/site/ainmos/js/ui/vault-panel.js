/**
 * Dreamscape Vault panel (Freeform Board).
 *
 * A floating dream-window on the table: three face-up Landscapes, the tile
 * deck count, and the Refresh button with its rising cost. During The Bed's
 * Dream Onward it shows the single flipped tile and a "Put it back" choice.
 */

import {
  isFreeformBoard,
  vaultCards,
  tileDeckCount,
  vaultRefreshCost,
} from "../board/dreamscape-vault.js";
import { pendingPlacementCard } from "../board/landscapes.js";
import { LANDSCAPE_ACTION_DEFS } from "../board/landscape-actions.js";

const SUIT_LABEL = { lucidity: "Lucidity", elasticity: "Elasticity", willpower: "Willpower" };

let lastKey = "";

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function actionLabel(card) {
  const id = card?.uniqueAction || card?.landscapeActions?.[0];
  if (!id) return "";
  return LANDSCAPE_ACTION_DEFS[id]?.label || "";
}

function vaultMode(state) {
  const pick = state.landscapePick;
  if (pick?.mode === "reveal" && pick.flipCard) return "flip";
  if (pick?.mode === "reveal" && !pick.excessOnly && (pick.remaining || 0) > 0) {
    return pick.freeReveal ? "free" : "buy";
  }
  return "rest";
}

function tileHtml(card, { index = -1, selected = false, live = false, flip = false } = {}) {
  const suit = card.suit || "none";
  const action = actionLabel(card);
  const label = `${card.name}${card.suit ? `, ${SUIT_LABEL[card.suit]}` : ""}${action ? `. ${action}` : ""}`;
  return `
    <button type="button"
      class="vault-tile suit-${suit}${selected ? " is-selected" : ""}${live ? " is-live" : ""}${flip ? " is-flip" : ""}"
      ${index >= 0 ? `data-vault-index="${index}"` : ""}
      ${live ? "" : "disabled"}
      aria-pressed="${selected ? "true" : "false"}"
      aria-label="${escapeHtml(label)}">
      <span class="vault-tile-hex" style="background-image:url('${escapeHtml(card.image)}')"></span>
      <span class="vault-tile-glint" aria-hidden="true"></span>
      <span class="vault-tile-name">${escapeHtml(card.name)}</span>
      <span class="vault-tile-meta"><i class="vault-suit-pip" aria-hidden="true"></i>${escapeHtml(action || SUIT_LABEL[card.suit] || "")}</span>
    </button>`;
}

/**
 * @param {object} state
 * @param {{ onSelect:(index:number)=>void, onRefresh:()=>void, onBury:()=>void }} handlers
 */
export function renderDreamscapeVault(state, handlers = {}) {
  const host = document.getElementById("dreamscape-vault");
  if (!host) return;
  if (!state || !isFreeformBoard(state)) {
    host.hidden = true;
    host.innerHTML = "";
    lastKey = "";
    document.body.classList.remove("freeform-board");
    return;
  }
  document.body.classList.add("freeform-board");

  const mode = vaultMode(state);
  const pick = state.landscapePick;
  const cards = vaultCards(state);
  const deck = tileDeckCount(state);
  const cost = vaultRefreshCost(state);
  const chosen = pendingPlacementCard(state);
  const remaining = pick?.remaining || 0;
  const key = [
    mode,
    cards.map((c) => c.id).join(","),
    deck,
    cost,
    chosen?.id || "",
    remaining,
    pick?.flipCard?.id || "",
  ].join("|");
  host.hidden = false;
  host.dataset.mode = mode;
  if (key === lastKey) return;
  lastKey = key;

  const live = mode === "buy" || mode === "free";
  let body = "";
  let footer = "";
  let whisper = "";

  if (mode === "flip") {
    const card = pick.flipCard;
    whisper = "The Bed dreams onward…";
    body = `<div class="vault-tiles vault-tiles-single">${tileHtml(card, { selected: true, flip: true })}</div>`;
    footer = `
      <p class="vault-hint">Tap a glowing hex to place it, free.</p>
      <button type="button" class="vault-btn vault-btn-bury" data-vault-action="bury">Put it back</button>`;
  } else {
    if (!cards.length) {
      whisper = "Every Landscape has surfaced.";
      body = `<p class="vault-empty">The Vault is empty.</p>`;
    } else {
      whisper = mode === "rest"
        ? "Waiting to be dreamed"
        : chosen ? `Place ${chosen.name}` : "Choose a Landscape";
      body = `<div class="vault-tiles">${cards.map((card, index) => tileHtml(card, {
        index,
        live,
        selected: live && chosen?.id === card.id,
      })).join("")}</div>`;
    }
    const refreshBlocked = mode !== "buy"
      ? "Refresh while you spend Lucidity in Reveal."
      : !deck
        ? "The tile deck is empty."
        : remaining < cost
          ? `Refreshing costs ${cost} Lucidity. ${remaining} left.`
          : "";
    footer = mode === "rest" ? "" : `
      ${live ? `<p class="vault-hint">${mode === "free" ? `${remaining} free placement${remaining === 1 ? "" : "s"}` : `${remaining} Lucidity left`}</p>` : ""}
      <button type="button" class="vault-btn vault-btn-refresh" data-vault-action="refresh"
        ${refreshBlocked ? "aria-disabled=\"true\"" : ""}
        title="${escapeHtml(refreshBlocked || `Redeal the Vault for ${cost} Lucidity. Each refresh this round costs 1 more.`)}">
        <span>Refresh</span><span class="vault-cost" aria-label="${cost} Lucidity">${cost}<i aria-hidden="true">✧</i></span>
      </button>
      ${refreshBlocked && mode === "buy" ? `<p class="vault-why">${escapeHtml(refreshBlocked)}</p>` : ""}`;
  }

  host.innerHTML = `
    <div class="vault-window" role="region" aria-label="Dreamscape Vault">
      <div class="vault-titlebar" data-float-handle>
        <span class="vault-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="vault-title">Dreamscape Vault</span>
        <span class="vault-deck" title="Landscapes asleep in the tile deck">${deck}<i aria-hidden="true">◇</i></span>
        <button type="button" class="aw-min" data-float-min aria-label="Minimize the Vault">–</button>
      </div>
      <p class="vault-whisper">${escapeHtml(whisper)}</p>
      ${body}
      <div class="vault-footer">${footer}</div>
    </div>`;

  host.querySelectorAll("[data-vault-index]").forEach((el) => {
    el.addEventListener("click", () => handlers.onSelect?.(Number(el.dataset.vaultIndex)));
  });
  host.querySelector("[data-vault-action='refresh']")?.addEventListener("click", (event) => {
    if (event.currentTarget.getAttribute("aria-disabled") === "true") {
      handlers.onBlocked?.(event.currentTarget.title);
      return;
    }
    handlers.onRefresh?.();
  });
  host.querySelector("[data-vault-action='bury']")?.addEventListener("click", () => handlers.onBury?.());
}

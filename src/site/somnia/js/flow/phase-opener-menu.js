/**
 * Fullscreen phase-opener: pick which Dreamer opens Reveal / Explore / Meet and with which card.
 * Shows every living Dreamer's hand so the table can switch focus without hunting chips.
 */
import { getPhase, activePlayer, isBlockingGameChoice } from "../core/state.js";
import {
  phaseOpeningActive,
  phaseSuitForOpening,
  phaseTokenValue,
  canUsePhasePowerToken,
  findPhaseContributor,
  bestPhaseContributor,
  projectedPhaseBudget,
  totalStat,
  SUIT_LABELS,
  cardCountsAsSuit,
  isWildPsyche,
  suitIconHtml,
} from "../core/rules.js";
import { isDreambeastPsycheCard } from "../dreamers/subconscious.js";
import { renderCard, hideUtilityModal, isUtilityModalMinimized } from "../ui/ui.js";

let openerMenuOpen = false;
let openerParked = false;
let parkedPhaseKey = null;
let openerHandlers = null;
let openerRenderAll = null;

function phaseSpendSuit(state) {
  return phaseSuitForOpening(getPhase(state));
}

function isOpenerCard(card, state) {
  if (!card || card.type === "psyche-power" || isDreambeastPsycheCard(card)) return false;
  const suit = phaseSpendSuit(state);
  if (!suit) return false;
  return cardCountsAsSuit(card, suit, state) || isWildPsyche(card);
}

function openerTitle(phase, suitLabel) {
  if (phase === "Reveal") return `Who opens Reveal?`;
  if (phase === "Explore") return `Who opens Explore?`;
  if (phase === "Meet") return `Who opens Meet?`;
  return `Who opens this phase?`;
}

function openerLead(phase, suitLabel) {
  const token = `A Power Token opens as 1 + that Dreamer's ${suitLabel}. Skip Phase leaves without spending.`;
  if (phase === "Reveal") {
    return `Spend 1 ${suitLabel} Psyche, or 1 Power Token. Card value (or 1) plus Lucidity is how many Landscapes the team may reveal. ${token}`;
  }
  if (phase === "Explore") {
    return `Spend 1 ${suitLabel} Psyche, or 1 Power Token. Card value (or 1) plus Elasticity is the team's shared moves. ${token}`;
  }
  return `Spend 1 ${suitLabel} Psyche, or 1 Power Token. Card value (or 1) plus Willpower is the team's shared Meet actions. ${token}`;
}

function confirmLabel(phase) {
  if (phase === "Reveal") return "Open Reveal";
  if (phase === "Explore") return "Open Explore";
  return "Open Meet";
}

function confirmKind(phase) {
  if (phase === "Reveal") return "revealLandscape";
  if (phase === "Explore") return "spendElasticity";
  return "gainMeetActions";
}

function runOpener(state) {
  const phase = getPhase(state);
  const handlers = openerHandlers;
  if (!handlers) return;
  if (phase === "Reveal") handlers.revealLandscape?.();
  else if (phase === "Explore") handlers.activateExplore?.();
  else if (phase === "Meet") handlers.gainMeetActions?.();
}

function selectOpenerCard(state, player, card) {
  if (!isOpenerCard(card, state)) return;
  state.selectedHand = [card.instanceId];
  state.phaseTokenAsPsyche = null;
  const idx = state.players.findIndex((p) => p.id === player.id);
  if (idx >= 0) state.activePlayerIndex = idx;
  openerRenderAll?.();
}

function selectOpenerToken(state, player) {
  if (!canUsePhasePowerToken(state, player) && state.phaseTokenAsPsyche !== player.id) return;
  state.selectedHand = [];
  if (state.phaseTokenAsPsyche === player.id) {
    state.phaseTokenAsPsyche = null;
  } else {
    state.phaseTokenAsPsyche = player.id;
    const idx = state.players.findIndex((p) => p.id === player.id);
    if (idx >= 0) state.activePlayerIndex = idx;
  }
  openerRenderAll?.();
}

function focusDreamerRow(state, player) {
  const idx = state.players.findIndex((p) => p.id === player.id);
  if (idx >= 0) state.activePlayerIndex = idx;
  openerRenderAll?.();
}

function phaseParkKey(state) {
  return `${state?.round ?? 0}:${state?.phaseIndex ?? 0}`;
}

export function isPhaseOpenerMenuOpen() {
  return openerMenuOpen;
}

export function isPhaseOpenerParked() {
  return openerParked;
}

export function resetPhaseOpenerChrome() {
  openerMenuOpen = false;
  openerParked = false;
  parkedPhaseKey = null;
  hideOpenerReturnDock();
}

function showOpenerReturnDock(state) {
  if (isUtilityModalMinimized()) return;
  const dock = document.getElementById("utility-choice-dock");
  const label = document.getElementById("utility-choice-dock-label");
  const btn = document.getElementById("utility-choice-restore");
  if (!dock) return;
  dock.dataset.dock = "phase-opener";
  dock.classList.remove("hidden");
  const phase = getPhase(state);
  if (label) label.textContent = `${phase} opener is waiting`;
  if (btn) btn.textContent = "Return to opener";
}

function hideOpenerReturnDock() {
  const dock = document.getElementById("utility-choice-dock");
  if (!dock || dock.dataset.dock !== "phase-opener") return;
  dock.dataset.dock = "";
  dock.classList.add("hidden");
  const btn = document.getElementById("utility-choice-restore");
  if (btn) btn.textContent = "Resume choice";
}

/** Leave the opener up, but let the table see the board. The dock brings it back. */
export function parkPhaseOpenerMenu(state) {
  openerParked = true;
  parkedPhaseKey = phaseParkKey(state);
  openerMenuOpen = false;
  showOpenerReturnDock(state);
  hideUtilityModal(true);
}

export function restorePhaseOpenerMenu() {
  openerParked = false;
  parkedPhaseKey = null;
  hideOpenerReturnDock();
}

export function closePhaseOpenerMenu({ hideModal = true } = {}) {
  if (!openerMenuOpen) return;
  openerMenuOpen = false;
  // When a blocking choice (Repress / Return / Mindstream) is about to claim the
  // utility modal, skip hide — otherwise we flash-dismiss the required picker.
  if (hideModal) hideUtilityModal(true);
}

export function shouldShowPhaseOpenerMenu(state) {
  if (!state || state.status !== "playing") return false;
  if (!phaseOpeningActive(state)) return false;
  // Meet-start tax / Dream effects often open Repress while the phase is still
  // "unopened". Never cover those pickers with the opener menu.
  if (isBlockingGameChoice(state)) return false;
  if (state.tutorialMode && !state.tutorialFlags?.phaseOpenerMenu) {
    // Tutorial keeps the classic hand + spread tray unless flagged.
    return false;
  }
  const phase = getPhase(state);
  if (phase === "Reveal" && !state.dreamDrawn) return false;
  if (phase === "Explore" && state.freeExploreNextRound) return false;
  if (state.seedFlags?.rem) {
    if (phase === "Reveal" && !state.remFree?.reveal && !state.revealLandscapeUsed) return false;
    if (phase === "Explore" && !state.remFree?.explore && !state.exploreActivated) return false;
    if (phase === "Meet" && !state.remFree?.meet && !(state.meetActionBudget > 0)) return false;
  }
  return true;
}

/**
 * @param {object} state
 * @param {{ revealLandscape?: Function, activateExplore?: Function, gainMeetActions?: Function }} handlers
 * @param {Function} renderAll
 * @param {{ force?: boolean }} [opts]
 */
export function showPhaseOpenerMenu(state, handlers, renderAll, opts = {}) {
  if (!shouldShowPhaseOpenerMenu(state) && !opts.force) {
    if (openerMenuOpen) closePhaseOpenerMenu();
    return false;
  }

  openerHandlers = handlers;
  openerRenderAll = renderAll;

  const modal = document.getElementById("utility-modal");
  const content = modal?.querySelector(".utility-content");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body || !content) return false;

  const phase = getPhase(state);
  const suit = phaseSpendSuit(state);
  const suitLabel = SUIT_LABELS[suit] || "Psyche";
  const best = bestPhaseContributor(state);
  const contributor = findPhaseContributor(state);
  const kind = confirmKind(phase);
  const canConfirm = !!contributor && projectedPhaseBudget(state, contributor) >= 1;
  const projected = contributor ? projectedPhaseBudget(state, contributor) : 0;

  content.classList.remove(
    "rules-reference-modal",
    "info-hub-modal",
    "dreamer-detail-modal",
    "ms-choice-modal-wrap",
  );
  content.classList.add("fullscreen-browser", "phase-opener-modal-wrap");

  const closeBtn = modal.querySelector(".utility-close");
  if (closeBtn) {
    closeBtn.hidden = false;
    closeBtn.setAttribute("aria-label", "View board");
    closeBtn.title = "View the board. Return to opener brings this menu back.";
  }

  const alive = (state.players || []).filter((p) => p.alive);
  const rows = alive.map((player) => {
    const isBest = best?.id === player.id;
    const isFocus = activePlayer(state)?.id === player.id;
    const isOpener = contributor?.id === player.id;
    const bonus = totalStat(player, suit, state);
    const ifSpend = projectedPhaseBudget(state, player);
    const tokenOn = state.phaseTokenAsPsyche === player.id;
    const tokenOk = canUsePhasePowerToken(state, player) || tokenOn;

    return `
      <section class="phase-opener-dreamer${isFocus ? " is-focus" : ""}${isOpener ? " is-opener" : ""}${isBest ? " is-best" : ""}" data-player-id="${player.id}">
        <header class="phase-opener-dreamer-head">
          <button type="button" class="phase-opener-focus-btn" data-focus-id="${player.id}" aria-pressed="${isFocus}">
            <img src="${player.dreamer?.image || ""}" alt="" class="phase-opener-avatar" />
            <span class="phase-opener-name">${player.name}${player.isHead ? " ★" : ""}</span>
          </button>
          <div class="phase-opener-meta">
            <span class="phase-opener-stat">${suitIconHtml(suit, { size: 12 })} +${bonus}</span>
            <span class="phase-opener-budget">→ ${ifSpend}</span>
            ${isBest ? `<span class="phase-opener-badge">Best</span>` : ""}
            ${isOpener ? `<span class="phase-opener-badge opener">Opening</span>` : ""}
          </div>
          <button type="button" class="btn btn-sm phase-opener-token${tokenOn ? " on" : ""}" data-token-id="${player.id}" ${tokenOk ? "" : "disabled"} title="Spend 1 Power Token as 1 + ${suitLabel} ${bonus}">
            ${tokenOn ? `Token · 1+${bonus}` : `Token · 1+${bonus} (${player.powerTokens || 0})`}
          </button>
        </header>
        <div class="phase-opener-hands">
          <div class="phase-opener-hand-row" data-hand-for="${player.id}"></div>
        </div>
      </section>
    `;
  }).join("");

  body.innerHTML = `
    <div id="phase-opener-menu" class="phase-opener-menu" data-phase="${phase}" data-suit="${suit || ""}" data-count="${alive.length}">
      <header class="phase-opener-header fullscreen-browser-header">
        <p class="phase-opener-kicker">${suitIconHtml(suit, { size: 16 })} ${suitLabel}</p>
        <h2>${openerTitle(phase, suitLabel)}</h2>
        <p class="fullscreen-browser-lead">${openerLead(phase, suitLabel)}</p>
      </header>
      <div class="phase-opener-grid fullscreen-browser-body" data-count="${alive.length}">${rows}</div>
      <footer class="phase-opener-footer">
        <div class="phase-opener-summary" aria-live="polite">
          ${contributor
            ? `<strong>${contributor.name}</strong> opens with ${phaseTokenValue(state, contributor) ? `1 Power Token (1 + ${suitLabel} ${totalStat(contributor, suit, state)})` : "1 Psyche"} → <strong>${projected}</strong> for the team`
            : `Spend a matching ${suitLabel} card, a Power Token (1 + that Dreamer's ${suitLabel}), or skip.`}
        </div>
        <div class="phase-opener-actions">
          <button type="button" id="btn-view-board" class="btn btn-phase-opener-skip">View board</button>
          ${state.tutorialMode ? "" : `<button type="button" id="btn-skip-phase" class="btn btn-phase-opener-skip">Skip Phase</button>`}
          <button type="button" id="btn-spread-opener" class="btn primary btn-phase-opener-confirm tint-${phase === "Reveal" ? "reveal" : phase === "Explore" ? "explore" : "meet"}" data-tutorial-action="${kind}" ${canConfirm ? "" : "disabled"}>
            ${confirmLabel(phase)}${canConfirm ? ` (${projected})` : ""}
          </button>
        </div>
      </footer>
    </div>
  `;

  alive.forEach((player) => {
    const handEl = body.querySelector(`[data-hand-for="${player.id}"]`);
    if (!handEl) return;
    const suited = (player.hand || []).filter((c) => isOpenerCard(c, state));
    const other = (player.hand || []).filter((c) => !isOpenerCard(c, state));

    if (!suited.length && !other.length) {
      handEl.innerHTML = `<p class="phase-opener-empty">Empty hand</p>`;
      return;
    }
    if (!suited.length) {
      const note = document.createElement("p");
      note.className = "phase-opener-empty";
      note.textContent = `No ${suitLabel}`;
      handEl.appendChild(note);
    }
    suited.forEach((card) => {
      const selected = state.selectedHand.includes(card.instanceId);
      handEl.appendChild(renderCard(card, {
        mini: true,
        selected,
        playerId: player.id,
        onClick: () => selectOpenerCard(state, player, card),
      }));
    });
    other.forEach((card) => {
      handEl.appendChild(renderCard(card, {
        mini: true,
        dense: true,
        playerId: player.id,
        onClick: () => focusDreamerRow(state, player),
      }));
    });
  });

  body.querySelectorAll("[data-focus-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const player = state.players.find((p) => p.id === btn.getAttribute("data-focus-id"));
      if (player) focusDreamerRow(state, player);
    });
  });

  body.querySelectorAll("[data-token-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const player = state.players.find((p) => p.id === btn.getAttribute("data-token-id"));
      if (player) selectOpenerToken(state, player);
    });
  });

  body.querySelector("#btn-view-board")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    parkPhaseOpenerMenu(state);
    openerRenderAll?.();
  });

  body.querySelector("#btn-spread-opener")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canConfirm) return;
    runOpener(state);
    openerParked = false;
    parkedPhaseKey = null;
    openerMenuOpen = false;
    hideOpenerReturnDock();
    hideUtilityModal(true);
    openerRenderAll?.();
  });

  body.querySelector("#btn-skip-phase")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openerParked = false;
    parkedPhaseKey = null;
    openerMenuOpen = false;
    hideOpenerReturnDock();
    hideUtilityModal(true);
    openerHandlers?.skipPhase?.();
  });

  openerMenuOpen = true;
  modal.classList.remove("hidden", "utility-modal-minimized");
  document.body.classList.add("utility-modal-open");
  return true;
}

/** Keep the menu in sync during phase opening; close it once the phase is unlocked. */
export function syncPhaseOpenerMenu(state, handlers, renderAll) {
  const key = phaseParkKey(state);
  if (openerParked && parkedPhaseKey !== key) {
    openerParked = false;
    parkedPhaseKey = null;
  }

  if (shouldShowPhaseOpenerMenu(state) && openerParked) {
    openerHandlers = handlers;
    openerRenderAll = renderAll;
    if (openerMenuOpen) closePhaseOpenerMenu({ hideModal: !isUtilityModalMinimized() });
    showOpenerReturnDock(state);
    return false;
  }

  hideOpenerReturnDock();
  if (shouldShowPhaseOpenerMenu(state)) {
    showPhaseOpenerMenu(state, handlers, renderAll);
    return true;
  }
  openerParked = false;
  parkedPhaseKey = null;
  if (openerMenuOpen) {
    // Blocking pickers own the utility modal — release the opener flag only.
    closePhaseOpenerMenu({ hideModal: !isBlockingGameChoice(state) });
  }
  return false;
}

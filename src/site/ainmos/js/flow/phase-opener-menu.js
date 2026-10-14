/**
 * Ainmos phase opener: one full screen per phase. Your hand, big; the cards
 * that can open the phase are lit; a live preview says what the spend buys.
 */
import { getPhase, isBlockingGameChoice } from "../core/state.js";
import {
  phaseOpeningActive,
  phaseSuitForOpening,
  canUsePhasePowerToken,
  findPhaseContributor,
  projectedPhaseBudget,
  totalStat,
  SUIT_LABELS,
  cardCountsAsSuit,
  isWildPsyche,
  suitIconHtml,
} from "../core/rules.js";
import { isDreambeastPsycheCard } from "../dreamers/subconscious.js";
import { renderCard, hideUtilityModal, isUtilityModalMinimized } from "../ui/ui.js";
import {
  isInteractiveTutorialActive,
  isTutorialActionAllowed,
  tutorialActionBlocked,
  tutorialOpenerCardOk,
  tutorialOpenerConfirmOk,
} from "../tutorial/tutorial-mode.js";

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

function openerTitle(phase) {
  if (phase === "Reveal") return "Build the dream";
  if (phase === "Explore") return "Walk the dream";
  if (phase === "Meet") return "Meet what waits";
  return "Open the phase";
}

function openerLead(phase, suitLabel) {
  if (phase === "Reveal") return `Spend 1 ${suitLabel}. Its value plus your Lucidity places that many Landscapes from the Vault.`;
  if (phase === "Explore") return `Spend 1 ${suitLabel}. Its value plus your Elasticity is how many steps you take.`;
  return `Spend 1 ${suitLabel}. Its value plus your Willpower is how many Meet actions you get: fights, draws, Landscape actions.`;
}

/** What one point of the phase budget buys, for the live preview. */
function budgetUnit(phase, n) {
  if (phase === "Reveal") return n === 1 ? "Landscape" : "Landscapes";
  if (phase === "Explore") return n === 1 ? "step" : "steps";
  return n === 1 ? "action" : "actions";
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
  if (isInteractiveTutorialActive(state) && !tutorialOpenerConfirmOk(state)) {
    tutorialActionBlocked(state);
    return;
  }
  const phase = getPhase(state);
  const handlers = openerHandlers;
  if (!handlers) return;
  if (phase === "Reveal") handlers.revealLandscape?.();
  else if (phase === "Explore") handlers.activateExplore?.();
  else if (phase === "Meet") handlers.gainMeetActions?.();
}

function selectOpenerCard(state, player, card) {
  if (!isOpenerCard(card, state)) return;
  if (isInteractiveTutorialActive(state) && !tutorialOpenerCardOk(state, player, card)) {
    tutorialActionBlocked(state);
    return;
  }
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
  // Ainmos is solo: the opener is always the one living Dreamer.
  const player = alive[0];
  const bonus = player ? totalStat(player, suit, state) : 0;
  const tokenOn = !!player && state.phaseTokenAsPsyche === player.id;
  const tokenOk = !!player && (canUsePhasePowerToken(state, player) || tokenOn);
  const tint = phase === "Reveal" ? "reveal" : phase === "Explore" ? "explore" : "meet";
  const hasOpenerCard = !!player && (player.hand || []).some((c) => isOpenerCard(c, state));
  const idleNote = hasOpenerCard
    ? `pick a ${suitLabel} card`
    : (tokenOk ? `no ${suitLabel}: use a Power Token or Skip` : `no ${suitLabel} in hand: Skip`);

  body.innerHTML = `
    <div id="phase-opener-menu" class="phase-opener-menu phase-opener-solo" data-phase="${phase}" data-suit="${suit || ""}" data-count="1">
      <header class="phase-opener-header fullscreen-browser-header">
        <p class="phase-opener-kicker">${suitIconHtml(suit, { size: 16 })} ${phase} · ${suitLabel}</p>
        <h2>${openerTitle(phase)}</h2>
        <p class="fullscreen-browser-lead">${openerLead(phase, suitLabel)}</p>
      </header>
      <div class="phase-opener-solo-stage fullscreen-browser-body">
        <div class="phase-opener-preview${canConfirm ? " is-ready" : ""}" aria-live="polite">
          <span class="phase-opener-preview-num">${canConfirm ? projected : "—"}</span>
          <span class="phase-opener-preview-unit">${canConfirm ? budgetUnit(phase, projected) : idleNote}</span>
          <span class="phase-opener-preview-stat">${suitIconHtml(suit, { size: 12 })} ${suitLabel} +${bonus}</span>
        </div>
        <div class="phase-opener-hand-row phase-opener-solo-hand" data-hand-for="${player?.id || ""}"></div>
      </div>
      <footer class="phase-opener-footer">
        <div class="phase-opener-actions">
          <button type="button" id="btn-view-board" class="btn btn-phase-opener-skip">View board</button>
          <button type="button" id="btn-skip-phase" class="btn btn-phase-opener-skip">Skip</button>
          <button type="button" class="btn btn-phase-opener-skip phase-opener-token${tokenOn ? " on" : ""}" data-token-id="${player?.id || ""}" ${tokenOk ? "" : "disabled"} title="Spend 1 Power Token as 1 + ${suitLabel} ${bonus}">
            Power Token · ${player?.powerTokens || 0}
          </button>
          <button type="button" id="btn-spread-opener" class="btn primary btn-phase-opener-confirm tint-${tint}" data-tutorial-action="${kind}" ${canConfirm ? "" : "disabled"}>
            ${confirmLabel(phase)}
          </button>
        </div>
      </footer>
    </div>
  `;

  const handEl = body.querySelector(".phase-opener-solo-hand");
  if (player && handEl) {
    const hand = (player.hand || []).filter((c) => c.type !== "psyche-power");
    if (!hand.length) handEl.innerHTML = `<p class="phase-opener-empty">Your hand is empty.</p>`;
    hand.forEach((card) => {
      const usable = isOpenerCard(card, state);
      const el = renderCard(card, {
        selected: usable && state.selectedHand.includes(card.instanceId),
        playerId: player.id,
        onClick: usable ? () => selectOpenerCard(state, player, card) : undefined,
      });
      el.classList.add(usable ? "opener-usable" : "opener-unusable");
      handEl.appendChild(el);
    });
  }

  body.querySelectorAll("[data-token-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
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
    if (isInteractiveTutorialActive(state) && !isTutorialActionAllowed(state, "advancePhase")) {
      tutorialActionBlocked(state);
      return;
    }
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
    // Hand and Object costs are chosen on the table, so the opener must get
    // out of the way. Other blocking choices still own this modal.
    const repressOnTable = !!state.pendingRepress
      && !state.pendingDeathChoice
      && !state.pendingMindstreamChoice
      && !state.pendingNothingChoice;
    closePhaseOpenerMenu({ hideModal: repressOnTable || !isBlockingGameChoice(state) });
  }
  return false;
}

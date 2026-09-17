import { getPhase, activePlayer, headPlayer, tileEncounters, encounterKey } from "./state.js";
import {
  coopMeetPlayTotal,
  meetPsycheActor,
  meetPsychePlayTotal,
  allSelectedCards,
  spreadPsycheCount,
  allyPsycheCount,
  meetBonusBreakdown,
  SUIT_LABELS,
  suitIconHtml,
  dreamerStatsHtml,
  isWildPsyche,
  bestPhaseContributor,
  statForPhaseBudget,
  totalStat,
  phaseOpeningActive,
  phaseSuitForOpening,
  cardCountsAsSuit,
  projectedPhaseBudget,
  findPhaseContributor,
  encounterPlayTotal,
  encounterPayHint,
  currentMeetEncounter,
} from "./rules.js";
import { countBoardDreambeasts, timelineTollPreview } from "./phase-skip.js";
import {
  DREAMER_KIND_AFFINITY,
  beastKindLabel,
  dreamerPrimarySuit,
  encounterAcceptSummary,
  encounterRejectSummary,
  encounterRejectCost,
} from "./dreambeasts.js";
import { handLimitForPlayer, handRoomForPsycheDraw } from "./objects.js";
import { psycheHandCount, alliesInHand, psycheCardsInHand, allyHandCount, allyHandLimitForPlayer, effectivePsycheHealth, MAX_ALLIES_IN_HAND, MAX_PSYCHE_IN_HAND, psycheCardValue } from "./psyche.js";
import { getQuestStatus, activeQuestLandscapeIds } from "./quests.js";
import { effectiveDreamerStat } from "./archetype-stats.js";
import { hexToPixel, boardPixelBounds } from "./hex.js";
import {
  subconsciousCount,
  subconsciousPilesForUI,
  isDreambeastPsycheCard,
  toggleReturnPick,
  completeReturnSelection,
} from "./subconscious.js";
import {
  TUTORIAL_SECTIONS,
  classifyPhaseAction,
  getTutorialSpotlightSelector,
  getTutorialStepTargetSelectors,
  getTutorialRevealTargetId,
  tutorialPhaseActionSelector,
} from "./tutorial-mode.js";
import { getNarratorView, listPhaseActionHints } from "./narrator.js";
import {
  getCurrentObjective,
  rulesReferenceHtml,
  RULES_TAB_FEED,
  RULES_TAB_INTRO,
  RULES_TAB_DETAILS,
  getDreamerChipTooltip,
} from "./guide.js";
import {
  burstSparklesAtElement,
  consumePhasePulse,
  consumeRevealedTiles,
  consumeForgottenTiles,
  consumeDreamFeedNudge,
  tileFlipElapsedMs,
} from "./fx.js";
import { BOSS_DREAM_DECK_SLOTS } from "./data.js";
import { consumeBoardClickSuppression, getBoardZoom } from "./board-zoom.js";
import { getMomentHistory, flashMoment } from "./moment-overlay.js";
import { isBeastTokenHidden, isDreamerTokenHidden } from "./board-fx.js";
import { powerTokensInPool, MAX_POWER_TOKEN_POOL } from "./power-tokens.js";
import {
  eventLandscapeIds,
  describeEventResolution,
  formatNameList,
  landscapeImageForId,
  revealedLandscapeIds,
} from "./event-landscapes.js";
import { getLandscapeActionSummary } from "./landscape-actions.js";

let uiRenderState = null;

export function bindUiRenderState(state) {
  uiRenderState = state;
}

function suitClass(suit) {
  return suit ? `suit-${suit}` : "";
}

function cardTypeClass(card) {
  if (card.type === "dreamer") return "dreamer";
  if (card.type === "dream" || card.type === "final" || card.type === "boss-dream") return "dream";
  if (card.type === "dreambeast" || card.boss || card.type === "psyche-dreambeast") {
    const kind = card.beastKind === "fantasy" ? "beast-fantasy" : card.beastKind === "nightmare" ? "beast-nightmare" : "";
    return ["dreambeast", kind].filter(Boolean).join(" ");
  }
  if (card.type === "object") return "object";
  if (card.type === "event" || card.type === "power-token" || card.type === "draw-dream") {
    return card.suit || "event";
  }
  return card.suit || card.type || "";
}

function dreambeastCostMeta(card) {
  if (card.accept == null) return "";
  const reject = card.reject ?? card.repress;
  const rejectSuit = card.rejectSuit ? suitIconHtml(card.rejectSuit, { size: 10 }) : "";
  const acceptSuit = card.suit ? suitIconHtml(card.suit, { size: 10 }) : "";
  const acceptGain = card.suit ? ` → 3 ${SUIT_LABELS[card.suit]}` : "";
  const rejectGain = card.rejectReward ? ` → ${card.rejectReward}` : "";
  const acceptTitle = encounterPayHint(card, true);
  const rejectTitle = encounterPayHint(card, false);
  return `<span class="meta dreambeast-costs"><span title="${acceptTitle}">A${card.accept}${acceptGain} ${acceptSuit}</span><span title="${rejectTitle}">R${reject}${rejectGain} ${rejectSuit}</span></span>`;
}

function isDreambeastCard(card) {
  return card?.type === "dreambeast" || card?.boss || card?.type === "psyche-dreambeast";
}

function createArtElement(card) {
  const art = document.createElement("div");
  art.className = "art";

  if (card.image) {
    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    img.loading = "lazy";
    img.decoding = "async";
    img.className = "card-art-sharp";
    img.addEventListener("error", () => {
      img.remove();
      art.classList.add("art-fallback");
      art.dataset.name = card.name;
      art.style.background = `linear-gradient(135deg, ${suitGradient(card)}, #151228)`;
    });
    art.appendChild(img);
  } else {
    art.classList.add("art-fallback");
    art.dataset.name = card.name;
    art.style.background = `linear-gradient(135deg, ${suitGradient(card)}, #151228)`;
  }

  return art;
}

function attachCardMeta(el, card, playerId = null) {
  if (card?.instanceId) el.dataset.instanceId = card.instanceId;
  if (playerId) el.dataset.playerId = playerId;
  return el;
}

function landscapeNameForId(id, board = []) {
  const tile = board.find((t) => t.id === id);
  return tile?.name || id.replace(/-/g, " ");
}

function createEventLandscapeIconRow(card, board = null) {
  const ids = eventLandscapeIds(card);
  if (!ids.length) return null;

  const tiles = board || uiRenderState?.board || [];
  const revealed = revealedLandscapeIds(tiles);
  const active = ids.some((id) => revealed.has(id));

  const row = document.createElement("div");
  row.className = [
    "event-landscape-icons",
    "needs-landscapes",
    active ? "event-active" : "event-inactive",
  ].join(" ");

  const hint = document.createElement("span");
  hint.className = "event-landscape-hint";
  hint.textContent = active
    ? "Event fires"
    : "Needs a listed Landscape Revealed or this Event is discarded unused";
  row.appendChild(hint);

  const chips = document.createElement("div");
  chips.className = "event-landscape-chips";

  ids.forEach((id) => {
    const chip = document.createElement("span");
    const isRevealed = revealed.has(id);
    chip.className = `event-landscape-icon${isRevealed ? " revealed" : ""}`;
    chip.title = `${landscapeNameForId(id, tiles)}${isRevealed ? " (Revealed)" : " (Hidden)"}`;
    const img = document.createElement("img");
    img.src = landscapeImageForId(id, tiles);
    img.alt = landscapeNameForId(id, tiles);
    img.loading = "lazy";
    chip.appendChild(img);
    chips.appendChild(chip);
  });

  row.appendChild(chips);
  return row;
}

function renderPsycheDreambeastCard(card, { selected, onClick, mini, dense, entering, playerId }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "game-card",
    "psyche-card",
    "psyche-dreambeast",
    "dreambeast",
    card.beastKind === "fantasy" ? "beast-fantasy" : card.beastKind === "nightmare" ? "beast-nightmare" : "",
    card.suit,
    dense ? "hand-dense" : "",
    selected ? "selected" : "",
    entering ? "card-enter" : "",
    mini ? "mini" : "",
  ].filter(Boolean).join(" ");

  const symbol = suitIconHtml(card.suit, { size: mini ? 14 : 18 });
  const label = SUIT_LABELS[card.suit] || card.suit;

  el.innerHTML = `
    <span class="psyche-value">3</span>
    <span class="psyche-suit ${suitClass(card.suit)}">${symbol}</span>
    <span class="psyche-dreambeast-badge" title="Accepted Dreambeast">⚔</span>
    <span class="psyche-label">${card.name.split(" ")[0]}</span>
  `;

  if (card.image) {
    const art = document.createElement("div");
    art.className = "psyche-dreambeast-thumb";
    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    art.appendChild(img);
    el.appendChild(art);
  }

  if (onClick) el.addEventListener("click", onClick);
  return attachCardMeta(el, card, playerId);
}

function renderPsycheCard(card, { selected, suggested, onClick, mini, dense, entering, playerId }) {
  if (isDreambeastPsycheCard(card)) {
    return renderPsycheDreambeastCard(card, { selected, suggested, onClick, mini, dense, entering, playerId });
  }
  if (card.type === "psyche-power") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = [
      "game-card",
      "psyche-card",
      "psyche-power",
      dense ? "hand-dense" : "",
      selected ? "selected" : "",
      suggested ? "phase-suggested" : "",
      entering ? "card-enter" : "",
      mini ? "mini" : "",
    ].filter(Boolean).join(" ");
    el.innerHTML = `
      <span class="psyche-holo psyche-holo-gold" aria-hidden="true"></span>
      <span class="psyche-quanta psyche-quanta-gold" aria-hidden="true"></span>
      <span class="psyche-sparkle" aria-hidden="true"></span>
      <span class="psyche-value">⚡</span>
      <span class="psyche-suit">+${card.powerTokens ?? 1}</span>
      <span class="psyche-label">Power</span>
    `;
    if (onClick) el.addEventListener("click", onClick);
    return attachCardMeta(el, card, playerId);
  }
  const el = document.createElement("button");
  el.type = "button";
  const isWild = isWildPsyche(card);
  el.className = [
    "game-card",
    "psyche-card",
    isWild ? "wild" : card.suit,
    dense ? "hand-dense" : "",
    selected ? "selected" : "",
    suggested ? "phase-suggested" : "",
    entering ? "card-enter" : "",
    mini ? "mini" : "",
  ].filter(Boolean).join(" ");

  if (isWild) {
    el.innerHTML = `
      <span class="psyche-holo psyche-holo-wild" aria-hidden="true"></span>
      <span class="psyche-quanta" aria-hidden="true"></span>
      <span class="psyche-value">5</span>
      <span class="psyche-suit wild-gradient" title="Wild — any suit">★</span>
      <span class="psyche-label">Wild</span>
    `;
  } else {
    const symbol = suitIconHtml(card.suit, { size: mini ? 14 : 18 });
    const label = SUIT_LABELS[card.suit] || card.suit;
    el.innerHTML = `
      <span class="psyche-holo psyche-holo-${card.suit}" aria-hidden="true"></span>
      <span class="psyche-quanta psyche-quanta-${card.suit}" aria-hidden="true"></span>
      <span class="psyche-value">${card.value}</span>
      <span class="psyche-suit ${suitClass(card.suit)}">${symbol}</span>
      <span class="psyche-label">${label}</span>
    `;
  }

  if (onClick) el.addEventListener("click", onClick);
  return attachCardMeta(el, card, playerId);
}

function formatHandPsycheLine(state, player) {
  const limit = handLimitForPlayer(state, player);
  const psyche = psycheHandCount(player);
  const allies = allyHandCount(player);
  const allyLimit = allyHandLimitForPlayer(state, player);
  const total = effectivePsycheHealth(player);

  if (allies && psyche === 0) {
    return `${total} health (${allies}/${allyLimit} allies)`;
  }
  if (allies) {
    return `${total} health · ${psyche}/${limit} Psyche · ${allies}/${allyLimit} allies`;
  }
  return `${psyche}/${limit} Psyche`;
}

function handStatsHtml(state, player) {
  return `
    <span class="hand-stats-suits">
      <span class="stat suit-lucidity" title="Lucidity">${suitIconHtml("lucidity", { size: 12 })}${player.dreamer.lucidity}</span>
      <span class="stat suit-elasticity" title="Elasticity">${suitIconHtml("elasticity", { size: 12 })}${player.dreamer.elasticity}</span>
      <span class="stat suit-willpower" title="Willpower">${suitIconHtml("willpower", { size: 12 })}${player.dreamer.willpower}</span>
    </span>
    · ${formatHandPsycheLine(state, player)}
  `;
}

const HAND_MAIN_SLOTS = MAX_PSYCHE_IN_HAND;
const HAND_SPILL_SLOTS = MAX_ALLIES_IN_HAND;

function splitHandCards(player) {
  const main = psycheCardsInHand(player).slice(0, HAND_MAIN_SLOTS);
  const spill = alliesInHand(player).slice(0, HAND_SPILL_SLOTS);
  return { main, spill };
}

function appendHandCard(container, card, options) {
  const el = renderCard(card, {
    ...options,
    suggested: options.suggested ?? false,
  });
  if (options.entering) {
    el.style.setProperty("--deal-i", String(options.dealIndex ?? 0));
  }
  if (!options.onClick) {
    el.classList.add("hand-inactive");
    el.disabled = true;
  }
  container.appendChild(el);
  return el;
}

/**
 * Single-row active Dreamer hand — main slots (left) + dense spillover (right).
 */
export function renderActiveDreamerHand(state, onCardClick, {
  title = null,
  statsHtml = null,
  statsText = null,
  newCardIds = null,
  canClickCard = () => true,
  suggestCard = () => false,
  emptyText = "Empty hand",
} = {}) {
  const handRoot = document.getElementById("hand");
  const primary = document.getElementById("hand-primary");
  const spillover = document.getElementById("hand-spillover");
  const stats = document.getElementById("hand-stats");
  const titleEl = document.getElementById("hand-title");
  const player = activePlayer(state);

  if (!handRoot || !primary || !spillover) return;

  handRoot.dataset.playerId = player.id;
  primary.innerHTML = "";
  spillover.innerHTML = "";
  handRoot.classList.remove("coop-mode");

  const phaseSpend = Boolean(title?.includes("Spend"));
  if (titleEl) titleEl.textContent = phaseSpend ? "Spend Psyche" : "Psyche Hand";
  if (stats) {
    const playerLabel = `${player.name}${player.isHead ? " ★" : ""}`;
    if (statsHtml) {
      stats.innerHTML = `<span class="hand-stats-player">${playerLabel}</span> ${statsHtml}`;
    } else if (statsText) {
      stats.textContent = statsText;
      stats.title = `${playerLabel} · ${statsText}`;
    } else {
      stats.innerHTML = `<span class="hand-stats-player">${playerLabel}</span> · ${handStatsHtml(state, player)}`;
    }
  }

  const fresh = newCardIds || new Set();
  const { main, spill } = splitHandCards(player);

  if (!main.length && !spill.length) {
    primary.textContent = emptyText;
    primary.classList.add("empty");
    spillover.classList.add("hidden");
    return;
  }

  primary.classList.remove("empty");
  primary.innerHTML = "";
  if (!main.length) {
    primary.classList.add("empty");
    const note = document.createElement("span");
    note.className = "hand-primary-empty-note";
    note.textContent = "No Psyche cards";
    primary.appendChild(note);
  } else {
    primary.classList.remove("empty");
  }

  main.forEach((card, index) => {
    const clickable = canClickCard(card, player);
    appendHandCard(primary, card, {
      selected: state.selectedHand.includes(card.instanceId)
        || state.trade?.offerPsycheIds?.includes(card.instanceId),
      suggested: suggestCard(card, player),
      entering: fresh.has(card.instanceId),
      dealIndex: index,
      playerId: player.id,
      onClick: clickable ? () => onCardClick(card, player) : undefined,
    });
  });

  if (spill.length) {
    spillover.classList.remove("hidden");
    spillover.dataset.count = String(spill.length);
    spill.forEach((card, index) => {
      const clickable = canClickCard(card, player);
      appendHandCard(spillover, card, {
        selected: state.selectedHand.includes(card.instanceId)
          || state.trade?.offerPsycheIds?.includes(card.instanceId),
        suggested: suggestCard(card, player),
        entering: fresh.has(card.instanceId),
        dealIndex: index,
        playerId: player.id,
        dense: true,
        onClick: clickable ? () => onCardClick(card, player) : undefined,
      });
    });
  } else {
    spillover.classList.add("hidden");
  }
}

/** Sparkle link when the focused Dreamer changes — chip ↔ hand panel. */
export function playDreamerHandSparkle(fromPlayerId, toPlayerId) {
  if (!toPlayerId || fromPlayerId === toPlayerId) return;

  const chip = document.querySelector(`.player-chip[data-player-id="${toPlayerId}"]`);
  const handRoot = document.getElementById("hand");
  const handSection = handRoot?.closest(".hand-section");

  if (chip) burstSparklesAtElement(chip, 10, "#f0c96a");
  if (handRoot) {
    handRoot.classList.remove("hand-switch-sparkle");
    void handRoot.offsetWidth;
    handRoot.classList.add("hand-switch-sparkle");
    window.setTimeout(() => handRoot.classList.remove("hand-switch-sparkle"), 520);
    burstSparklesAtElement(handRoot, 14, "#c9a0ff");
  }
  if (handSection) {
    handSection.classList.add("hand-section-focus");
    window.setTimeout(() => handSection.classList.remove("hand-section-focus"), 520);
  }

  if (chip && handRoot && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const from = chip.getBoundingClientRect();
    const to = handRoot.getBoundingClientRect();
    const flyer = document.createElement("span");
    flyer.className = "hand-link-sparkle";
    flyer.textContent = "✦";
    flyer.style.left = `${from.left + from.width / 2}px`;
    flyer.style.top = `${from.top + from.height / 2}px`;
    document.body.appendChild(flyer);
    const dx = to.left + 40 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    flyer.animate([
      { transform: "translate(0, 0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55}px) scale(1.2)`, opacity: 0.9 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: 0 },
    ], { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }).onfinish = () => flyer.remove();
  }
}

let radialMenuRoot = null;

function onRadialMenuKey(event) {
  if (event.key === "Escape") hideRadialMenu();
}

export function hideRadialMenu() {
  if (!radialMenuRoot) return;
  document.removeEventListener("keydown", onRadialMenuKey, true);
  radialMenuRoot.remove();
  radialMenuRoot = null;
}

export const hidePowerTokenRadial = hideRadialMenu;

function paintRadialMenu(anchorEl, options, onPick, { ariaLabel = "Actions" } = {}) {
  if (!anchorEl?.isConnected || !options?.length) return;

  const rect = anchorEl.getBoundingClientRect();
  if (!rect.width && !rect.height && rect.left === 0 && rect.top === 0) return;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const layer = document.createElement("div");
  layer.className = "power-token-radial-layer radial-menu-layer";
  layer.setAttribute("role", "menu");
  layer.setAttribute("aria-label", ariaLabel);

  const scrim = document.createElement("button");
  scrim.type = "button";
  scrim.className = "power-token-radial-scrim radial-menu-scrim";
  scrim.setAttribute("aria-label", "Close menu");
  scrim.tabIndex = -1;
  scrim.addEventListener("click", hideRadialMenu);
  layer.appendChild(scrim);

  const menu = document.createElement("div");
  menu.className = "power-token-radial-menu radial-menu";

  const count = options.length;
  const radius = Math.min(148, Math.max(92, 76 + count * 11));
  const startAngle = -Math.PI / 2;
  options.forEach((opt, index) => {
    const angle = startAngle + (2 * Math.PI * index) / count;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    const pad = 72;
    const px = Math.min(window.innerWidth - pad, Math.max(pad, cx + dx));
    const py = Math.min(window.innerHeight - pad, Math.max(pad, cy + dy));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `power-token-radial-item radial-menu-item${opt.disabled ? "" : " ready"}${opt.primary ? " radial-primary" : ""}`;
    btn.setAttribute("role", "menuitem");
    if (opt.kind) btn.dataset.tutorialAction = opt.kind;
    btn.textContent = opt.label;
    btn.title = opt.hint || opt.label;
    btn.disabled = !!opt.disabled;
    btn.style.setProperty("--px", `${px}px`);
    btn.style.setProperty("--py", `${py}px`);
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (opt.disabled) return;
      hideRadialMenu();
      onPick?.(opt);
    });
    menu.appendChild(btn);
  });

  layer.appendChild(menu);
  document.body.appendChild(layer);
  radialMenuRoot = layer;
  layer.classList.add("open");
  document.addEventListener("keydown", onRadialMenuKey, true);
  if (document.body.classList.contains("tutorial-mode-active")) {
    refreshTutorialSpotlight();
  }
}

/** Open after board pan/zoom re-layout (anchor may be replaced in the DOM). */
export function showRadialMenu(anchorEl, options, onPick, { ariaLabel = "Actions", resolveAnchor = null } = {}) {
  hideRadialMenu();
  if (!options?.length) return;

  const open = () => {
    const el = resolveAnchor?.() || anchorEl;
    paintRadialMenu(el, options, onPick, { ariaLabel });
  };

  if (resolveAnchor) {
    requestAnimationFrame(() => requestAnimationFrame(open));
    return;
  }

  open();
}

export function showPowerTokenRadial(anchorEl, options, onPick) {
  showRadialMenu(anchorEl, options, onPick, { ariaLabel: "Spend a Power Token" });
}

export function renderPowerTokens(state, { onTokenClick } = {}) {
  const tokensEl = document.getElementById("power-tokens");
  const statsEl = document.getElementById("power-token-stats");
  const bonusBtn = document.getElementById("btn-power-bonus");
  const undoBtn = document.getElementById("btn-power-bonus-undo");
  const bonusPending = document.getElementById("power-bonus-pending");
  if (!tokensEl) return;

  const player = activePlayer(state);
  const held = player?.powerTokens || 0;
  const pool = powerTokensInPool(state);
  const isMeet = getPhase(state) === "Meet";
  const pending = state.pendingPowerBonus || 0;
  const refundable = state.pendingPowerBonusTokens || 0;
  const chipCount = tokensEl.querySelectorAll(".power-token-chip").length;
  const hasEmptyMessage = Boolean(tokensEl.querySelector(".power-tokens-empty"));
  const domMode = chipCount > 0 ? "chips" : (hasEmptyMessage ? "empty" : "none");
  const targetMode = held > 0 ? "chips" : "empty";
  const rebuildChips = domMode !== targetMode || chipCount !== held;

  if (statsEl) {
    const pendingNote = pending ? `<span class="power-token-pending">+${pending} spread bonus</span>` : "";
    statsEl.innerHTML = `<span class="power-token-held">${held} held</span><span class="power-token-pool">${pool}/${MAX_POWER_TOKEN_POOL} in pool</span>${pendingNote}`;
    statsEl.title = "Click a token to spend it on a quest, +1 spread, or 1 Psyche for the phase opener";
  }

  if (bonusBtn) {
    const canStack = isMeet && held >= 1;
    bonusBtn.disabled = !canStack;
    bonusBtn.classList.toggle("hidden", !isMeet);
    bonusBtn.textContent = pending > 0 ? `+1 Spread (now +${pending})` : "+1 to Spread";
  }

  if (undoBtn) {
    const canUndo = isMeet && refundable > 0;
    undoBtn.disabled = !canUndo;
    undoBtn.classList.toggle("hidden", !isMeet);
    undoBtn.textContent = refundable > 0 ? `-1 Spread (now +${pending})` : "-1 Spread";
  }

  if (bonusPending) {
    if (pending > 0 && isMeet) {
      bonusPending.classList.remove("hidden");
      bonusPending.textContent = refundable
        ? `Psyche spread bonus +${pending} from Power Tokens (stacking). Use -1 to undo a token.`
        : `Psyche spread bonus +${pending}.`;
    } else {
      bonusPending.classList.add("hidden");
      bonusPending.textContent = "";
    }
  }

  if (!rebuildChips) return;

  hidePowerTokenRadial();
  tokensEl.innerHTML = "";
  if (!held) {
    const empty = document.createElement("p");
    empty.className = "power-tokens-empty";
    empty.textContent = isMeet
      ? "No tokens yet. Draw Power Psyche, Mindstream, or Meet rewards."
      : "No tokens held. Click a token to spend it when you have one.";
    tokensEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < held; i += 1) {
    const token = document.createElement("button");
    token.type = "button";
    token.className = "power-token-chip";
    token.title = "Click to spend this Power Token";
    token.setAttribute("aria-label", "Power token. Click for spend options.");
    token.textContent = "⚡";
    token.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onTokenClick?.(token);
    });
    tokensEl.appendChild(token);
  }
}

function suitGradient(card) {
  const colors = {
    lucidity: "#1a4080",
    elasticity: "#6a5010",
    willpower: "#6a1818",
    dreambeast: "#3a1a2a",
    object: "#2a2a4a",
  };
  const key = card.suit || card.type;
  return colors[key] || "#2a2248";
}

export function renderCard(card, options = {}) {
  const {
    portrait = false,
    mini = false,
    dense = false,
    selected = false,
    suggested = false,
    onClick,
    entering = false,
    playerId = null,
  } = options;

  if ((card.type === "psyche" || card.type === "psyche-power") && !portrait) {
    return renderPsycheCard(card, { selected, suggested, onClick, mini, dense, entering, playerId });
  }
  if (isDreambeastPsycheCard(card) && !portrait) {
    return renderPsycheDreambeastCard(card, { selected, suggested, onClick, mini, dense, entering, playerId });
  }

  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "game-card",
    cardTypeClass(card),
    portrait ? "portrait" : "",
    dense ? "hand-dense" : "",
    selected ? "selected" : "",
    entering ? "card-enter" : "",
  ].filter(Boolean).join(" ");

  const value = card.value != null ? `<span class="value">${card.value}</span>` : "";
  const acceptRepress = card.accept != null
    ? dreambeastCostMeta(card)
    : "";
  const points = card.points != null ? `<span class="meta"><span>${card.points} pts</span></span>` : "";
  const showSuitMeta = card.suit && card.type !== "dreamer" && card.type !== "psyche";
  const kindMeta = card.beastKind
    ? `<span class="meta beast-kind-label beast-kind-${card.beastKind}">${beastKindLabel(card.beastKind)}</span>`
    : "";
  const suit = showSuitMeta
    ? `<span class="meta"><span class="${suitClass(card.suit)}">${SUIT_LABELS[card.suit] || card.suit}</span></span>`
    : "";
  const subtype = card.subtype ? `<span class="meta"><span>${card.subtype}</span></span>` : "";
  const dreamMeta = isDreamCard(card)
    ? `<span class="meta dream-kind-label">${dreamCardKindLabel(card)}</span>`
    : "";
  const dreamTeaser = isDreamCard(card) && dreamCardEffectText(card)
    ? `<p class="dream-card-teaser">${dreamCardEffectText(card)}</p>`
    : "";

  const art = createArtElement(card);

  if (card.type === "dreamer" && portrait) {
    el.appendChild(art);
    if (onClick) el.addEventListener("click", onClick);
    return attachCardMeta(el, card, playerId);
  }

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <div class="title">${card.name}</div>
    ${acceptRepress || points || kindMeta || suit || subtype || dreamMeta}
    ${dreamTeaser}
  `;

  if (value) el.innerHTML = value;
  el.appendChild(art);
  el.appendChild(body);

  if (card.type === "event") {
    const icons = createEventLandscapeIconRow(card, options.board);
    if (icons) el.appendChild(icons);
    el.classList.add("event-card");
  }

  if (mini) {
    el.style.width = "72px";
    el.style.minHeight = "96px";
  }

  if (onClick) el.addEventListener("click", onClick);
  return attachCardMeta(el, card, playerId);
}

function isDreamCard(card) {
  return card?.type === "dream" || card?.type === "final" || card?.type === "boss-dream";
}

function dreamCardEffectText(card) {
  return card.text || card.effect || "";
}

function dreamCardKindLabel(card) {
  if (card.type === "boss-dream" || card.boss) return "Boss Dream";
  if (card.type === "final") return "Final Recurrence";
  return "Dream";
}

function appendDreamModalDetail(detail, card) {
  const kind = document.createElement("p");
  kind.className = "dream-kind-banner";
  kind.innerHTML = `<strong>${dreamCardKindLabel(card)}</strong>`;
  detail.appendChild(kind);

  if (card.flavor) {
    const flavor = document.createElement("blockquote");
    flavor.className = "modal-flavor";
    flavor.textContent = card.flavor;
    detail.appendChild(flavor);
  }

  const effectText = dreamCardEffectText(card);
  if (effectText) {
    const effect = document.createElement("p");
    effect.className = "modal-effect dream-effect";
    effect.innerHTML = `<strong>Effect:</strong> ${effectText}`;
    detail.appendChild(effect);
  }

  if (card.bottomPinned) {
    const note = document.createElement("p");
    note.className = "dream-meta-note";
    note.textContent = "Pinned to the bottom of the Final Recurrence deck.";
    detail.appendChild(note);
  }
}

function appendDreambeastModalDetail(detail, card) {
  const rejectCost = encounterRejectCost(card);
  const rejectSuit = card.rejectSuit ? ` ${suitIconHtml(card.rejectSuit, { size: 14 })}` : "";
  const acceptSuit = card.suit ? ` ${suitIconHtml(card.suit, { size: 14 })}` : "";

  if (card.flavor) {
    const flavor = document.createElement("blockquote");
    flavor.className = "modal-flavor";
    flavor.textContent = card.flavor;
    detail.appendChild(flavor);
  }

  const costs = document.createElement("div");
  costs.className = "dreambeast-cost-breakdown";
  costs.innerHTML = `
    <div class="dreambeast-cost-row accept">
      <strong>Accept ${card.accept}${acceptSuit}</strong>
      <span>${encounterPayHint(card, true)}</span>
      <span>${encounterAcceptSummary(card)}</span>
    </div>
    <div class="dreambeast-cost-row reject">
      <strong>Reject ${rejectCost}${rejectSuit}</strong>
      <span>${encounterPayHint(card, false)}</span>
      <span>${encounterRejectSummary(card)}</span>
    </div>
  `;
  detail.appendChild(costs);

  if (card.effect) {
    const effect = document.createElement("p");
    effect.className = "modal-effect";
    effect.innerHTML = `<strong>Effect:</strong> ${card.effect}`;
    detail.appendChild(effect);
  }

  if (card.fail) {
    const fail = document.createElement("p");
    fail.className = "modal-fail";
    fail.innerHTML = `<strong>Fail:</strong> ${card.fail}`;
    detail.appendChild(fail);
  }

  if (card.beastKind) {
    const kind = document.createElement("p");
    kind.innerHTML = `<strong>Kind:</strong> ${beastKindLabel(card.beastKind)}`;
    detail.appendChild(kind);
  }
}

export function showModal(card) {
  const modal = document.getElementById("card-modal");
  const modalContent = modal?.querySelector(".modal-content");
  const container = document.getElementById("modal-card");
  container.innerHTML = "";
  modalContent?.classList.toggle("dreambeast-detail-modal", isDreambeastCard(card));
  modalContent?.classList.toggle("dream-detail-modal", isDreamCard(card) && !isDreambeastCard(card));

  if (card.type === "psyche" || card.type === "psyche-power") {
    const detail = document.createElement("div");
    detail.className = "modal-detail psyche-modal";
    if (isDreambeastPsycheCard(card)) {
      detail.innerHTML = `
        ${card.image ? `<img src="${card.image}" alt="${card.name}" class="modal-art">` : ""}
        <h2>${card.name}</h2>
        <p>Accepted Dreambeast — counts as <strong>3 ${SUIT_LABELS[card.suit]} Psyche</strong> when pooled in Meet. When spent, it is Repressed to the Subconscious.</p>
        ${card.effect ? `<p><strong>Accept effect:</strong> ${card.effect}</p>` : ""}
      `;
    } else if (isWildPsyche(card)) {
      detail.innerHTML = `
        <div class="psyche-modal-face wild">
          <span class="psyche-value large">5</span>
          <span class="psyche-suit large wild-gradient">★</span>
        </div>
        <h2>Wild Psyche</h2>
        <p>Counts as <strong>5 Psyche of any suit</strong> when played. After playing, Repress this card plus the top card of each Mindstream deck.</p>
      `;
    } else if (card.type === "psyche-power") {
      detail.innerHTML = `
        <div class="psyche-modal-face psyche-power">
          <span class="psyche-value large">⚡</span>
          <span class="psyche-suit large">+${card.powerTokens ?? 1}</span>
        </div>
        <h2>${card.name}</h2>
        <p>Click to play at any time, in any phase: take <strong>${card.powerTokens ?? 1} Power Token${(card.powerTokens ?? 1) === 1 ? "" : "s"}</strong>, then discard this card.</p>
      `;
    } else {
      detail.innerHTML = `
        <div class="psyche-modal-face ${card.suit}">
          <span class="psyche-value large">${card.value}</span>
          <span class="psyche-suit large ${suitClass(card.suit)}">${suitIconHtml(card.suit, { size: 40 })}</span>
        </div>
        <h2>${SUIT_LABELS[card.suit]} ${card.value}</h2>
        <p>Psyche card — used for Reveal (${SUIT_LABELS.lucidity}), Explore (${SUIT_LABELS.elasticity}), and Meet (${SUIT_LABELS.willpower}) phases.</p>
      `;
    }
    container.appendChild(detail);
    modal.classList.remove("hidden");
    document.body.classList.add("card-detail-open");
    return;
  }

  const detail = document.createElement("div");
  detail.className = "modal-detail";

  if (card.image) {
    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    img.className = "modal-art";
    img.addEventListener("error", () => {
      img.remove();
      const fallback = document.createElement("div");
      fallback.className = "modal-art-fallback";
      fallback.textContent = card.name;
      fallback.style.background = `linear-gradient(135deg, ${suitGradient(card)}, #151228)`;
      detail.insertBefore(fallback, detail.firstChild);
    });
    detail.appendChild(img);
  } else {
    const fallback = document.createElement("div");
    fallback.className = "modal-art-fallback";
    fallback.textContent = card.name;
    fallback.style.background = `linear-gradient(135deg, ${suitGradient(card)}, #151228)`;
    detail.appendChild(fallback);
  }

  const title = document.createElement("h2");
  title.textContent = card.name;
  detail.appendChild(title);

  if (card.type === "event") {
    const info = uiRenderState
      ? describeEventResolution(uiRenderState, card)
      : { needed: eventLandscapeIds(card), activeNames: [], wasted: Boolean(card.eventWasted), discardPile: "Mindstream discard pile" };
    const wasted = Boolean(card.eventWasted || info.wasted);
    const active = !wasted && info.activeNames?.length;

    const banner = document.createElement("div");
    banner.className = `event-resolution-banner${wasted ? " wasted" : active ? " resolves" : ""}`;
    if (wasted) {
      banner.innerHTML = `
        <strong>Discarded unused</strong>
        <span>None of this Event's Landscapes are Revealed${info.needed?.length ? ` (${formatNameList(info.needed)})` : ""}. No effect happens. The card is placed in the ${info.discardPile}.</span>
      `;
    } else if (active) {
      banner.innerHTML = `
        <strong>Resolves</strong>
        <span>${formatNameList(info.activeNames)} ${info.activeNames.length === 1 ? "is" : "are"} Revealed, so this Event fires. After it resolves it is discarded to the ${info.discardPile}.</span>
      `;
    } else {
      banner.innerHTML = `
        <strong>Needs a Revealed Landscape</strong>
        <span>This Event only fires if any listed Landscape is Revealed. Otherwise it is discarded unused to the ${info.discardPile}.</span>
      `;
    }
    detail.appendChild(banner);

    if (card.effectTop) {
      const top = document.createElement("p");
      top.className = `event-effect-top${wasted ? " inactive" : " active"}`;
      top.innerHTML = `<strong>Effect:</strong> ${card.effectTop}`;
      detail.appendChild(top);
    }
    if (card.effectBottom) {
      const bottom = document.createElement("p");
      bottom.className = `event-effect-bottom${wasted ? " inactive" : " active"}`;
      bottom.innerHTML = `<strong>Also:</strong> ${card.effectBottom}`;
      detail.appendChild(bottom);
    }
    const icons = createEventLandscapeIconRow(card);
    if (icons) {
      icons.classList.add("event-landscape-icons--modal");
      detail.appendChild(icons);
    }
    if (!card.effectTop && !card.effectBottom) {
      const description = card.text || card.flavor || card.effect;
      if (description) {
        const p = document.createElement("p");
        p.textContent = description;
        detail.appendChild(p);
      }
    }
  } else if (isDreambeastCard(card)) {
    appendDreambeastModalDetail(detail, card);
  } else if (isDreamCard(card)) {
    appendDreamModalDetail(detail, card);
  } else {
  const fields = [
    ["Type", card.type || card.suit || "—"],
    ["Subtype", card.subtype],
    ["Points", card.points],
    ["Value", card.value],
    ["Ability", card.ability || card.power || card.passive],
  ];

  if (card.flavor) fields.push(["Flavor", card.flavor]);
  const effectText = dreamCardEffectText(card);
  if (effectText && effectText !== card.flavor) fields.push(["Effect", effectText]);

  fields.forEach(([label, value]) => {
    if (value == null || value === "") return;
    const p = document.createElement("p");
    p.innerHTML = `<strong>${label}:</strong> ${value}`;
    detail.appendChild(p);
  });

  if (card.quests) {
    const ul = document.createElement("ul");
    ul.className = "quest-list";
    card.quests.forEach((q, i) => {
      const li = document.createElement("li");
      li.textContent = q;
      if (card.questProgress?.[i]) li.classList.add("done");
      ul.appendChild(li);
    });
    const h = document.createElement("p");
    h.innerHTML = "<strong>Quests:</strong>";
    detail.appendChild(h);
    detail.appendChild(ul);
  }

  if (card.lucidity != null) {
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `
      <span class="stat-pill suit-lucidity">${suitIconHtml("lucidity", { size: 12 })}Lucidity +${card.lucidity}</span>
      <span class="stat-pill suit-elasticity">${suitIconHtml("elasticity", { size: 12 })}Elasticity +${card.elasticity}</span>
      <span class="stat-pill suit-willpower">${suitIconHtml("willpower", { size: 12 })}Willpower +${card.willpower}</span>
    `;
    detail.appendChild(row);
  }
  }

  container.appendChild(detail);
  modal.classList.remove("hidden");
  document.body.classList.add("card-detail-open");
}

export function hideModal() {
  const modal = document.getElementById("card-modal");
  modal?.classList.add("hidden");
  modal?.querySelector(".modal-content")?.classList.remove(
    "dreambeast-detail-modal",
    "dream-detail-modal",
    "card-inspect-carousel",
  );
  document.body.classList.remove("card-detail-open");
}

const CARD_CHOICE_HINT = "Left-click a card to select it · Right-click any card for a full-size preview with details.";

function cardChoiceKey(card) {
  return card?.instanceId || card?.id;
}

function prepareCardChoiceModal() {
  const modal = document.getElementById("utility-modal");
  const content = modal?.querySelector(".utility-content");
  content?.classList.remove(
    "fullscreen-browser",
    "landscape-detail-modal",
    "dreamer-detail-modal",
    "phase-skip-modal",
    "rules-reference-modal",
  );
  content?.classList.add("card-choice-modal-wrap");
  document.body.classList.add("utility-modal-open");
  modal?.classList.remove("hidden", "utility-modal-minimized");
  utilityModalMinimized = false;
  syncUtilityChoiceDock();
  wireChoiceMinimizeButton(document.getElementById("utility-modal-body"));
}

function openCardInspectCarousel(cards, startIndex = 0) {
  if (!cards?.length) return;
  let index = Math.max(0, Math.min(startIndex, cards.length - 1));
  const modal = document.getElementById("card-modal");
  const content = modal?.querySelector(".modal-content");
  if (!modal || !content) return;

  let nav = content.querySelector(".card-inspect-nav");
  const renderInspect = () => {
    showModal(cards[index]);
    content.classList.add("card-inspect-carousel");
    nav.querySelector(".card-inspect-counter").textContent = `${index + 1} / ${cards.length}`;
    const prevBtn = nav.querySelector(".card-inspect-prev");
    const nextBtn = nav.querySelector(".card-inspect-next");
    if (prevBtn) prevBtn.disabled = index <= 0;
    if (nextBtn) nextBtn.disabled = index >= cards.length - 1;
  };

  if (!nav) {
    nav = document.createElement("div");
    nav.className = "card-inspect-nav";
    nav.innerHTML = `
      <button type="button" class="card-inspect-prev" aria-label="Previous card">‹</button>
      <span class="card-inspect-counter" aria-live="polite"></span>
      <button type="button" class="card-inspect-next" aria-label="Next card">›</button>
      <p class="card-inspect-hint">Browsing options in this choice</p>
    `;
    content.insertBefore(nav, content.firstChild);
    nav.querySelector(".card-inspect-prev")?.addEventListener("click", () => {
      if (index > 0) {
        index -= 1;
        renderInspect();
      }
    });
    nav.querySelector(".card-inspect-next")?.addEventListener("click", () => {
      if (index < cards.length - 1) {
        index += 1;
        renderInspect();
      }
    });
  }

  renderInspect();
}

function mountChoicePickerCard(row, card, { cards, selected, orderIndex, disabled, onSelect }) {
  const wrap = document.createElement("div");
  wrap.className = "card-choice-wrap";
  wrap.dataset.cardId = cardChoiceKey(card);
  const el = renderCard(card, { portrait: true, selected: !!selected });
  el.classList.add("card-choice-card");
  if (disabled) el.classList.add("is-disabled");
  if (orderIndex != null) {
    const badge = document.createElement("span");
    badge.className = "card-choice-order";
    badge.textContent = String(orderIndex + 1);
    wrap.appendChild(badge);
  }
  wrap.appendChild(el);
  el.addEventListener("click", (event) => {
    event.preventDefault();
    if (disabled) return;
    onSelect?.(card);
  });
  el.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const idx = cards.findIndex((c) => cardChoiceKey(c) === cardChoiceKey(card));
    openCardInspectCarousel(cards, idx >= 0 ? idx : 0);
  });
  row.appendChild(wrap);
  return wrap;
}

function cardChoiceShellHtml({ title, message, statusText = "", showConfirm = true, confirmLabel = "Confirm", showCancel = false }) {
  return `
    <div class="card-choice-picker">
      <h2>${title || "Choose a card"}</h2>
      ${message ? `<p class="card-choice-message">${message}</p>` : ""}
      <p class="card-choice-hint">${CARD_CHOICE_HINT}</p>
      <div class="card-choice-row"></div>
      <p class="card-choice-status">${statusText}</p>
      <div class="utility-actions card-choice-actions">
        <button type="button" class="btn btn-minimize-choice" id="utility-minimize-btn">Minimize — view board</button>
        ${showCancel ? '<button type="button" class="btn" id="card-choice-cancel">Cancel</button>' : ""}
        ${showConfirm ? `<button type="button" class="btn primary" id="card-choice-confirm" disabled>${confirmLabel}</button>` : ""}
      </div>
    </div>
  `;
}

function wireChoiceMinimizeButton(root) {
  root?.querySelector("#utility-minimize-btn")?.addEventListener("click", () => minimizeUtilityModal());
}

let utilityModalRequired = false;
let utilityModalMinimized = false;
let utilityModalRequiredLabel = "Required choice";

export function isUtilityModalMinimized() {
  return utilityModalMinimized;
}

export function setUtilityModalRequired(required, label = "Required choice") {
  utilityModalRequired = !!required;
  utilityModalRequiredLabel = label || "Required choice";
  const modal = document.getElementById("utility-modal");
  modal?.classList.toggle("utility-modal-required", utilityModalRequired);
  const closeBtn = modal?.querySelector(".utility-close");
  if (closeBtn) closeBtn.hidden = utilityModalRequired;
  syncUtilityChoiceDock();
  if (!utilityModalRequired) {
    utilityModalMinimized = false;
    modal?.classList.remove("utility-modal-minimized");
  }
  const modalOpen = !modal?.classList.contains("hidden");
  if (utilityModalRequired && modalOpen) ensureChoiceMinimizeChrome();
}

export function minimizeUtilityModal() {
  if (!utilityModalRequired) {
    hideUtilityModal(true);
    return;
  }
  utilityModalMinimized = true;
  document.getElementById("utility-modal")?.classList.add("utility-modal-minimized");
  document.body.classList.remove("utility-modal-open");
  syncUtilityChoiceDock();
}

export function restoreUtilityModal() {
  if (!utilityModalRequired) return;
  utilityModalMinimized = false;
  document.getElementById("utility-modal")?.classList.remove("utility-modal-minimized");
  document.body.classList.add("utility-modal-open");
  syncUtilityChoiceDock();
}

export function handleUtilityModalDismiss() {
  if (utilityModalRequired) {
    minimizeUtilityModal();
    return;
  }
  hideUtilityModal(true);
}

function syncUtilityChoiceDock() {
  const dock = document.getElementById("utility-choice-dock");
  const label = document.getElementById("utility-choice-dock-label");
  if (!dock) return;
  const show = utilityModalRequired && utilityModalMinimized;
  dock.classList.toggle("hidden", !show);
  if (label) label.textContent = `${utilityModalRequiredLabel} — paused (board visible)`;
}

function ensureChoiceMinimizeChrome() {
  const body = document.getElementById("utility-modal-body");
  if (!body || body.querySelector("#utility-minimize-btn")) return;
  const row = body.querySelector(".utility-actions, .card-choice-actions, .phase-skip-choices");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-minimize-choice";
  btn.id = "utility-minimize-btn";
  btn.textContent = "Minimize — view board";
  btn.addEventListener("click", () => minimizeUtilityModal());
  if (row) row.prepend(btn);
  else {
    const wrap = document.createElement("div");
    wrap.className = "utility-actions card-choice-actions";
    wrap.appendChild(btn);
    body.appendChild(wrap);
  }
}

/** Hex layout scale — circumradius in pixel math (larger = bigger map). */
const HEX_BASE = 58;
const HEX_MIN = 44;
/** ~1024px source art / sqrt(3) — keeps landscape faces sharp when zoomed in. */
const HEX_MAX_NATIVE = 640;

function fitHexSize(state) {
  const viewport = document.getElementById("board-viewport");
  if (!viewport) return 100;

  const pad = 10;
  const maxW = Math.max(160, viewport.clientWidth - pad);
  const maxH = Math.max(160, viewport.clientHeight - pad);
  const bounds = boardPixelBounds(state, HEX_BASE);
  const fit = Math.min(maxW / bounds.width, maxH / bounds.height);
  const base = Math.max(HEX_MIN, Math.floor(HEX_BASE * fit));
  const zoomed = Math.floor(base * getBoardZoom());
  return Math.min(HEX_MAX_NATIVE, Math.max(HEX_MIN, zoomed));
}

export function renderBoard(
  state,
  onSelectLandscape,
  legalMoveIds = [],
  pickHighlights = {},
  onInspectLandscape = null,
  boardOptions = {},
) {
  const board = document.getElementById("hex-board");
  board.innerHTML = "";

  const size = fitHexSize(state);
  const scale = size / HEX_BASE;
  board.style.setProperty("--hex-scale", String(scale));
  board.style.setProperty("--hex-size", `${size}px`);
  const bounds = boardPixelBounds(state, size);
  board.style.position = "relative";
  board.style.width = `${bounds.width}px`;
  board.style.height = `${bounds.height}px`;
  board.style.margin = "0 auto";

  const legalSet = new Set(legalMoveIds);
  const revealSet = new Set(pickHighlights.reveal || []);
  const forgetSet = new Set(pickHighlights.forget || []);
  const chooseSet = new Set(pickHighlights.choose || []);
  const questHighlightSet = new Set(activeQuestLandscapeIds(state));
  const justRevealed = new Set(consumeRevealedTiles());
  const justForgotten = new Set(consumeForgottenTiles());
  const tutorialRevealId = getTutorialRevealTargetId(state);

  state.board.forEach((tile) => {
    const { x, y } = hexToPixel(tile.q, tile.r, size);
    const el = document.createElement("button");
    el.type = "button";
    el.dataset.tileId = tile.id;
    const isBedFinal = tile.center && tile.finalRecurrenceSide;
    const showFace = tile.revealed && !tile.wasteland;
    const encounters = tileEncounters(tile);
    const isSelected = state.selectedLandscapeId === tile.id;
    const pickRevealHidden = revealSet.has(tile.id) && !showFace;
    const tutorialRevealTarget = tutorialRevealId === tile.id && !showFace;
    el.className = [
      "hex-tile",
      tile.center ? "center" : "",
      tile.wasteland || !tile.revealed ? "wasteland" : "",
      !tile.revealed && !tile.center ? "face-down" : "",
      showFace ? "face-up" : "",
      isBedFinal ? "bed-final" : "",
      isSelected ? "selected" : "",
      isSelected && encounters.length ? "selected-encounter" : "",
      encounters.length ? "has-encounter" : "",
      questHighlightSet.has(tile.id) ? "quest-highlight" : "",
      legalSet.has(tile.id) ? "movable" : "",
      revealSet.has(tile.id) ? "pick-reveal" : "",
      tutorialRevealTarget ? "tutorial-reveal-target" : "",
      forgetSet.has(tile.id) ? "pick-forget" : "",
      chooseSet.has(tile.id) ? "pick-choose" : "",
      justRevealed.has(tile.id) ? "just-revealed" : "",
      justForgotten.has(tile.id) ? "just-forgotten" : "",
      tile.suit ? `suit-${tile.suit}` : "",
    ].filter(Boolean).join(" ");

    el.style.left = `${x + bounds.offsetX}px`;
    el.style.top = `${y + bounds.offsetY}px`;
    el.style.zIndex = String(
      (tutorialRevealTarget || revealSet.has(tile.id) || legalSet.has(tile.id) ? 4000 : 1000)
      + Math.round(y + bounds.offsetY)
    );
    if (justRevealed.has(tile.id) || justForgotten.has(tile.id)) {
      el.style.setProperty("--hex-flip-elapsed", `${-tileFlipElapsedMs(tile.id)}ms`);
    }

    const wastelandSrc = tile.wastelandImage || "images/landscapes/wasteland.webp";
    let faceImage = "";
    if (isBedFinal) {
      faceImage = "url('images/dreams/final-recurrence.webp')";
    } else if (showFace && tile.image) {
      faceImage = `url('${tile.image}')`;
    } else {
      faceImage = `url('${wastelandSrc}')`;
    }
    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flippingOver = !reduceMotion && justRevealed.has(tile.id) && showFace && !!tile.image;
    const flippingBack = !reduceMotion && justForgotten.has(tile.id) && !!tile.image;
    const backImage = flippingBack ? `url('${tile.image}')` : `url('${wastelandSrc}')`;
    const frontImage = flippingBack ? `url('${wastelandSrc}')` : faceImage;
    const faceHtml = (flippingOver || flippingBack)
      ? `<div class="hex-flip" aria-hidden="true"><div class="hex-flip-inner"><div class="hex-face hex-face-hd hex-flip-back" style="background-image: ${backImage}"></div><div class="hex-face hex-face-hd hex-flip-front" style="background-image: ${frontImage}"></div></div></div>`
      : `<div class="hex-face hex-face-hd" style="background-image: ${faceImage}"></div>`;

    const isWastelandFace = tile.wasteland || !tile.revealed;
    const mistHtml = isWastelandFace
      ? `<div class="hex-mist hex-mist-wasteland-a" aria-hidden="true"></div><div class="hex-mist hex-mist-wasteland-b" aria-hidden="true"></div><div class="hex-mist hex-mist-wasteland-c" aria-hidden="true"></div>`
      : showFace
        ? `<div class="hex-mist hex-mist-a" aria-hidden="true"></div><div class="hex-mist hex-mist-b" aria-hidden="true"></div>`
        : "";

    const occupants = state.players.filter((p) => p.landscapeId === tile.id && p.alive);
    const finalArch = tile.finalArchetype;
    const encounterMark = encounters.length ? "⚔".repeat(Math.min(encounters.length, 3)) : "";
    const finalMark = finalArch && !finalArch.defeated ? "★" : "";
    const namedWasteland = tutorialRevealTarget || pickRevealHidden;
    const displayName = isBedFinal
      ? "The Bed — Final Recurrence"
      : tutorialRevealTarget
        ? tile.name
        : showFace
          ? tile.name
          : "Wasteland";
    const suitLabel = tutorialRevealTarget
      ? "click to reveal"
      : showFace
        ? (tile.suit || "neutral")
        : "hidden";
    el.setAttribute(
      "aria-label",
      tutorialRevealTarget
        ? `Wasteland. Click to reveal ${tile.name}`
        : pickRevealHidden
          ? "Wasteland. Click to reveal this Landscape."
          : showFace
            ? `${tile.name}${tile.suit ? `, ${tile.suit}` : ""}`
            : "Wasteland, hidden Landscape"
    );
    const revealCueHtml = namedWasteland
      ? `<div class="hex-reveal-cue" aria-hidden="true">Reveal</div>`
      : "";

    const occupantTokens = [];
    occupants.forEach((p) => {
      if (!p.dreamer?.image) return;
      const hidden = isDreamerTokenHidden(p.id);
      const arriving = hidden ? " is-arriving is-departing" : "";
      occupantTokens.push(
        `<img class="hex-occupant-token hex-occupant-dreamer${arriving}" data-dreamer-id="${p.id}" src="${p.dreamer.image}" alt="${p.dreamer.name}" title="${p.name} — click for actions" decoding="async" draggable="false" onerror="this.remove()">`
      );
    });
    encounters.forEach((encounter, encIndex) => {
      if (!encounter?.image) return;
      const encKey = encounterKey(encounter);
      const arriving = encKey && isBeastTokenHidden(encKey) ? " is-arriving" : "";
      const offset = encIndex > 0 ? ` style="--beast-stack: ${encIndex}"` : "";
      occupantTokens.push(
        `<img class="hex-occupant-token hex-occupant-beast${arriving}" data-encounter-key="${encKey}"${offset} src="${encounter.image}" alt="${encounter.name}" title="${encounter.name} — Accept, Reject, or View" decoding="async" draggable="false" onerror="this.remove()">`
      );
    });
    const occupantsHtml = occupantTokens.length
      ? `<div class="hex-occupants" aria-hidden="true">${occupantTokens.join("")}</div>`
      : "";

    el.innerHTML = `
      ${faceHtml}
      <div class="hex-overlay"></div>
      ${mistHtml}
      ${occupantsHtml}
      ${revealCueHtml}
      <div class="name">${displayName}</div>
      <div class="suit">${suitLabel}</div>
      <div class="tokens">${occupants.map((p) => p.dreamer.name.split(" ").pop()).join(" · ")} ${encounterMark}${encounters.length ? ` ${encounters.map((e) => e.name.split(" ")[0]).join(" · ")}` : ""}${finalMark}${finalArch && !finalArch.defeated ? ` ${finalArch.name.split(" ")[0]}` : ""}</div>
    `;

    el.addEventListener("click", (event) => {
      if (consumeBoardClickSuppression()) return;
      const dreamerEl = event.target.closest(".hex-occupant-dreamer");
      if (dreamerEl?.dataset.dreamerId) {
        event.stopPropagation();
        boardOptions.onDreamerTokenClick?.(dreamerEl.dataset.dreamerId, tile.id, dreamerEl);
        return;
      }
      const beastEl = event.target.closest(".hex-occupant-beast");
      if (beastEl?.dataset.encounterKey) {
        const enc = encounters.find((e) => encounterKey(e) === beastEl.dataset.encounterKey);
        if (enc) {
          event.stopPropagation();
          boardOptions.onBeastTokenClick?.(enc, tile.id, beastEl);
          return;
        }
      }
      onSelectLandscape(tile.id);
    });
    if (tutorialRevealTarget) {
      el.title = `Click to reveal ${tile.name}`;
    }
    if (onInspectLandscape) {
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onInspectLandscape(tile.id);
      });
      if (!tutorialRevealTarget) {
        el.title = "Click landscape to interact · Dreamer or Dreambeast opens action menu · right-click landscape for overview";
      }
    }
    board.appendChild(el);
  });
}

export function renderPlayers(state, onSelectPlayer) {
  const dock = document.getElementById("player-list");
  const dropdown = document.getElementById("dreamers-dropdown-list");
  hideDreamerDetailTooltip();
  hideDreamerDetailOverlay();
  if (dock) dock.innerHTML = "";
  if (dropdown) dropdown.innerHTML = "";

  const phaseOpening = phaseOpeningActive(state);
  const suggestedSpender = phaseOpening ? bestPhaseContributor(state) : null;
  const meetPhase = getPhase(state) === "Meet" && state.meetActionBudget > 0;
  const sceneTileId = meetPhase ? state.selectedLandscapeId : null;

  state.players.forEach((player, index) => {
    const appendChip = (list, compact) => {
      if (!list) return;
      const chip = document.createElement("button");
      chip.type = "button";
      const tradeTarget = state.tradeMode && state.trade?.step === "pick-partner";
      const isActive = index === state.activePlayerIndex;
      const isSuggestedSpender = phaseOpening
        && player.alive
        && suggestedSpender?.id === player.id;
      const onScene = sceneTileId && player.alive && player.landscapeId === sceneTileId;
      chip.className = [
        "player-chip",
        isActive ? "active" : "",
        !player.alive ? "dead" : "",
        tradeTarget ? "trade-target" : "",
        isSuggestedSpender ? "phase-suggested" : "",
        onScene ? "on-scene" : "",
      ].filter(Boolean).join(" ");
      const ariaHint = getDreamerChipTooltip(state, player, index);
      chip.dataset.playerId = player.id;
      chip.setAttribute("aria-label", `${player.name}. ${ariaHint}`);
      chip.innerHTML = `
        <img src="${player.dreamer.image}" alt="" onerror="this.style.display='none'">
        <div class="info">
          <div class="name">${player.name}${player.isHead ? " ★" : ""}${isSuggestedSpender ? " ☆" : ""}${onScene ? " ●" : ""}${!player.alive ? " (lost)" : ""}</div>
          ${compact ? "" : dreamerStatsHtml(player.dreamer)}
          <div class="sub">${player.powerTokens} power · ${formatHandPsycheLine(state, player)} · ${player.deathCount || 0}/5 deaths · ${player.objects.length} obj · ${player.persistent?.length || 0} persistent</div>
        </div>
      `;

      const showTooltip = () => {
        const focusHint = !isActive && player.alive
          ? "Click to focus this Dreamer"
          : tradeTarget
            ? "Click to trade with this Dreamer"
            : undefined;
        if (compact) {
          showDreamerDetailTooltip(player.dreamer, chip, { player, focusHint, state });
        } else {
          showDreamerDetailOverlay(player.dreamer, { player, focusHint, state });
        }
      };

      const hideTooltip = () => {
        if (compact) hideDreamerDetailTooltip();
        else hideDreamerDetailOverlay();
      };

      chip.addEventListener("mouseenter", showTooltip);
      chip.addEventListener("mouseleave", hideTooltip);
      chip.addEventListener("focusin", showTooltip);
      chip.addEventListener("focusout", (event) => {
        if (!chip.contains(event.relatedTarget)) hideTooltip();
      });
      chip.addEventListener("click", () => {
        hideDreamerDetailTooltip();
        onSelectPlayer(index);
      });
      list.appendChild(chip);
    };

    appendChip(dock, true);
    appendChip(dropdown, false);
  });
}

export function renderObjects(state, onCardClick) {
  const container = document.getElementById("player-objects");
  const persistentEl = document.getElementById("player-persistent");
  if (!container) return;
  const player = activePlayer(state);
  container.innerHTML = "";
  if (persistentEl) persistentEl.innerHTML = "";

  if (!player.objects.length) {
    container.textContent = "No Objects in hand.";
  } else {
    player.objects.forEach((card) => {
      container.appendChild(renderCard(card, {
        mini: true,
        onClick: () => onCardClick(card, "hand"),
      }));
    });
  }

  if (persistentEl) {
    if (!player.persistent?.length) {
      persistentEl.textContent = "No Persistent Objects in play.";
    } else {
      player.persistent.forEach((card) => {
        persistentEl.appendChild(renderCard(card, {
          mini: true,
          onClick: () => onCardClick(card, "persistent"),
        }));
      });
    }
  }
}

export function renderHand(state, onCardClick, newCardIds = null) {
  const player = activePlayer(state);
  renderActiveDreamerHand(state, onCardClick, {
    newCardIds,
    title: `${player.name}${player.isHead ? " ★" : ""} — Psyche Hand`,
    statsHtml: handStatsHtml(state, player),
  });
}

function phaseSpendSuit(state) {
  const phase = getPhase(state);
  return phaseSuitForOpening(phase);
}

function isPhaseSpendPsycheCard(card, state) {
  if (card.type === "psyche-power" || isDreambeastPsycheCard(card)) return false;
  const suit = phaseSpendSuit(state);
  if (!suit) return false;
  return cardCountsAsSuit(card, suit, state);
}

export function renderPhaseSpendHands(state, onCardClick) {
  const phase = getPhase(state);
  const suit = phaseSpendSuit(state);
  const suitLabel = SUIT_LABELS[suit];
  const player = activePlayer(state);
  const best = bestPhaseContributor(state);
  const statKey = statForPhaseBudget(phase, state);
  const isBest = best?.id === player.id;
  const contributor = findPhaseContributor(state);
  const projected = projectedPhaseBudget(state, player);
  const opener = contributor
    ? `Opening as ${contributor.name} (+${totalStat(contributor, statKey, state)} ${suitLabel}) → ${projectedPhaseBudget(state, contributor)} for team`
    : null;
  const budgetNote = contributor?.id === player.id && projected > 0
    ? ` → ${projected} for team`
    : isBest
      ? ` (up to ${projectedPhaseBudget(state, player)} if you spend)`
      : "";

  renderActiveDreamerHand(state, onCardClick, {
    title: `${player.name} — Spend ${suitLabel}`,
    statsText: opener
      || (isBest
        ? `Best ${suitLabel} bonus (+${totalStat(player, statKey, state)})${budgetNote} · select 1–2 highlighted cards`
        : best
          ? `Tip: ${best.name} has +${totalStat(best, statKey, state)} ${suitLabel} — click their chip · highlighted cards count`
          : `Select 1–2 ${suitLabel} or Wild cards · click a Dreamer chip to switch hands`),
    canClickCard: (card) => card.type === "psyche-power" || isPhaseSpendPsycheCard(card, state),
    suggestCard: (card) => isPhaseSpendPsycheCard(card, state),
  });
}

export function renderMeetPoolGuide(state) {
  const el = document.getElementById("meet-pool-guide");
  if (!el) return;
  const phase = getPhase(state);
  const tile = state.board.find((t) => t.id === state.selectedLandscapeId);
  const enc = tileEncounters(tile)[0] || currentMeetEncounter(state).encounter;
  if (phase !== "Meet" || !state.meetActionBudget || !enc) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  const poolCount = spreadPsycheCount(state);
  const acceptTotal = encounterPlayTotal(state, { accept: true });
  const rejectTotal = encounterPlayTotal(state, { accept: false });
  const bonus = state.pendingPowerBonus || 0;
  const anchor = state.anchorMeetSpreadBonus || 0;
  const acceptCost = enc.accept;
  const rejectCost = encounterRejectCost(enc);
  const actor = meetPsycheActor(state);
  const acceptOk = acceptTotal >= acceptCost;
  const rejectOk = rejectTotal >= rejectCost;
  el.classList.remove("hidden");
  el.innerHTML = `
    <strong>Meet pool:</strong>
    Select <strong>1–3 Psyche</strong> from ${actor?.name || "the Dreamer on this Encounter"}'s hand.
    ${encounterPayHint(enc, true)} ${encounterPayHint(enc, false)}
    ${bonus ? ` · <strong>+${bonus}</strong> from Power Token spread` : ""}
    ${anchor ? ` · <strong>+${anchor}</strong> Hold the Line` : ""}
    · current <strong>${poolCount}/3</strong> cards
    <span class="meet-pool-targets">
      <span class="${acceptOk ? "meet-pool-ready" : ""}">Accept ${acceptTotal}/${acceptCost}</span>
      <span class="${rejectOk ? "meet-pool-ready" : ""}">Reject ${rejectTotal}/${rejectCost}</span>
    </span>
  `;
}

export function renderCoopMeetHands(state, onCardClick) {
  const player = activePlayer(state);
  const meetActor = meetPsycheActor(state);
  const poolCount = spreadPsycheCount(state);
  const allyCount = allyPsycheCount(state);
  const poolTotal = meetPsychePlayTotal(state);
  const bonus = meetBonusBreakdown(state);
  const bonusText = bonus.total ? ` · +${bonus.total} Dreamer (${bonus.parts.join(", ")})` : "";
  const pending = state.pendingPowerBonus ? ` · +${state.pendingPowerBonus} bonus pending` : "";
  const isActor = meetActor?.id === player.id;
  renderMeetPoolGuide(state);

  renderActiveDreamerHand(state, onCardClick, {
    title: `${player.name} — Meet Hand`,
    statsText: meetActor
      ? (isActor
        ? `Pool ${poolCount}/3 Psyche${allyCount ? ` + ${allyCount} ally` : ""} = ${poolTotal} total${bonusText}${pending} · double-click to inspect`
        : `Only ${meetActor.name} on the Encounter may add to the pool · click their chip or board token`)
      : "Click a Dreamer on an Encounter Landscape · pool 1–3 Psyche (+ Power spread bonus) to Accept or Reject",
    canClickCard: (card) => card.type === "psyche-power" || !meetActor || isActor,
  });
}

const DECK_LABELS = {
  dream: "💤 Dream",
  psyche: "🃏 Psyche",
  archetype: "👤 Archetype",
  "mindstream-lucidity": "◉ Mindstream Lucidity",
  "mindstream-elasticity": "⇄ Mindstream Elasticity",
  "mindstream-willpower": "✊ Mindstream Willpower",
};

function discardPileForDeck(state, deckId) {
  switch (deckId) {
    case "dream": return state.dreamDiscard || [];
    case "psyche": return state.psycheDiscard || [];
    case "archetype": return [];
    case "mindstream-lucidity": return state.mindstreamDiscard?.lucidity || [];
    case "mindstream-elasticity": return state.mindstreamDiscard?.elasticity || [];
    case "mindstream-willpower": return state.mindstreamDiscard?.willpower || [];
    default: return [];
  }
}

export function showRevealedTopsModal(state, deckId, onCardClick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const label = DECK_LABELS[deckId] || deckId;
  const pile = state.revealedDeckTops?.[deckId] || [];
  body.innerHTML = `
    <h2>${label} — Revealed top</h2>
    <p class="graveyard-total">${pile.length} card${pile.length === 1 ? "" : "s"} currently revealed by a power</p>
    <div id="peek-browse" class="mini-card-row"></div>
  `;
  const container = body.querySelector("#peek-browse");
  if (!pile.length) {
    container.innerHTML = "<p>No revealed top cards. Draw or flip a power to peek.</p>";
  } else {
    pile.forEach((card) => {
      container.appendChild(renderCard(card, {
        mini: true,
        onClick: () => onCardClick(card),
      }));
    });
  }
  modal.classList.remove("hidden");
}

export function showDiscardPileModal(state, deckId, onCardClick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const label = DECK_LABELS[deckId] || deckId;
  const pile = [...discardPileForDeck(state, deckId)].reverse();
  body.innerHTML = `
    <h2>${label} — Discard</h2>
    <p class="graveyard-total">${pile.length} card${pile.length === 1 ? "" : "s"} face-up in discard</p>
    <div id="discard-browse" class="mini-card-row"></div>
  `;
  const container = body.querySelector("#discard-browse");
  if (!pile.length) {
    container.innerHTML = "<p>Discard pile is empty.</p>";
  } else {
    pile.forEach((card) => {
      container.appendChild(renderCard(card, {
        mini: true,
        onClick: () => onCardClick(card),
      }));
    });
  }
  modal.classList.remove("hidden");
}

function drawPileForDeck(state, deckId) {
  switch (deckId) {
    case "dream": return state.dreamDeck || [];
    case "psyche": return state.psycheDeck || [];
    case "mindstream-lucidity": return state.mindstreamDecks?.lucidity || [];
    case "mindstream-elasticity": return state.mindstreamDecks?.elasticity || [];
    case "mindstream-willpower": return state.mindstreamDecks?.willpower || [];
    default: return [];
  }
}

function deckFaceCard(card, { onClick } = {}) {
  if (!card) {
    const empty = document.createElement("div");
    empty.className = "deck-discard-empty";
    empty.textContent = "—";
    empty.setAttribute("aria-hidden", "true");
    return empty;
  }
  const isPsyche = card.type === "psyche"
    || card.type === "psyche-power"
    || isDreambeastPsycheCard(card);
  const el = isPsyche
    ? renderPsycheCard(card, { mini: true, onClick })
    : renderCard(card, { mini: true, onClick });
  el.classList.add("deck-discard-top-card");
  el.title = card.name || "Card";
  return el;
}

function fillRectStack(container, count, variant = "draw") {
  container.replaceChildren();
  container.style.setProperty("--stack-count", String(count));
  if (!count) {
    container.classList.add("is-empty");
    return;
  }
  container.classList.remove("is-empty");
  for (let i = 0; i < count; i += 1) {
    const rect = document.createElement("span");
    rect.className = `deck-rect deck-rect-${variant}`;
    rect.style.setProperty("--stack-i", String(i));
    container.appendChild(rect);
  }
}

function appendPeekCards(parent, cards, onViewPeek, deckId) {
  if (!cards.length) return;
  const peekWrap = document.createElement("div");
  peekWrap.className = "deck-peek-cards";
  cards.forEach((card, index) => {
    const face = deckFaceCard(card, {
      onClick: onViewPeek ? () => onViewPeek(deckId) : null,
    });
    face.classList.add("deck-peek-card");
    face.style.setProperty("--peek-i", String(index));
    face.title = `Revealed top: ${card.name}`;
    peekWrap.appendChild(face);
  });
  parent.appendChild(peekWrap);
}

const DECK_COLUMN_DEFS = [
  { id: "dream", label: "Dream", emoji: "💤", kind: "dream" },
  { id: "psyche", label: "Psyche", emoji: "🃏", kind: "psyche" },
  { id: "mindstream-lucidity", label: "Mindstream", sub: "Lucidity", emoji: "◉", suit: "lucidity", kind: "mindstream" },
  { id: "mindstream-elasticity", label: "Mindstream", sub: "Elasticity", emoji: "⇄", suit: "elasticity", kind: "mindstream" },
  { id: "mindstream-willpower", label: "Mindstream", sub: "Willpower", emoji: "✊", suit: "willpower", kind: "mindstream" },
];

let lastDeckColumnKey = "";

export function resetDeckColumnRender() {
  lastDeckColumnKey = "";
}

export function syncDeckColumnFit() {
  const column = document.getElementById("deck-column");
  if (!column || !column.childElementCount) return;

  const rowCount = column.childElementCount;
  const colH = column.clientHeight || column.getBoundingClientRect().height;
  const rowH = colH / rowCount;
  const cap = Math.max(10, Math.min(32, rowH * 0.24));
  const base = Math.max(14, Math.min(30, rowH * 0.34));
  const faceH = Math.max(34, Math.min(76, rowH * 0.54));
  const faceW = Math.max(26, Math.min(56, faceH * 0.72));

  column.style.setProperty("--deck-stack-cap", `${cap}px`);
  column.style.setProperty("--deck-stack-base", `${base}px`);
  column.style.setProperty("--deck-face-h", `${faceH}px`);
  column.style.setProperty("--deck-face-w", `${faceW}px`);
}

function deckColumnSignature(state) {
  const parts = DECK_COLUMN_DEFS.map((deck) => {
    const draw = drawPileForDeck(state, deck.id);
    const discard = discardPileForDeck(state, deck.id);
    const peek = state.revealedDeckTops?.[deck.id] || [];
    const topDiscard = discard.length ? discard[discard.length - 1] : null;
    return [
      deck.id,
      draw.length,
      discard.length,
      topDiscard?.instanceId || topDiscard?.id || "",
      peek.map((c) => c.instanceId || c.id).join(","),
    ].join(":");
  });
  parts.push(state.activeDream?.instanceId || state.activeDream?.id || "");
  return parts.join("|");
}

export function renderDecks(state, onViewDiscard, onViewPeek = null) {
  const column = document.getElementById("deck-column");
  if (!column) return;

  const sig = deckColumnSignature(state);
  if (sig !== lastDeckColumnKey || column.childElementCount === 0) {
    lastDeckColumnKey = sig;
    column.innerHTML = "";

    DECK_COLUMN_DEFS.forEach((deck) => {
      const drawCount = drawPileForDeck(state, deck.id).length;
      const discardPile = discardPileForDeck(state, deck.id);
      const discardCount = discardPile.length;
      const topDiscard = discardCount ? discardPile[discardCount - 1] : null;
      const peeked = state.revealedDeckTops?.[deck.id] || [];
      const blockDiscard = deck.id.startsWith("mindstream-") && state.tradeMode;

      const row = document.createElement("article");
    row.className = [
      "deck-rail-row",
      deck.suit ? `suit-${deck.suit}` : `kind-${deck.kind}`,
      peeked.length ? "has-peek" : "",
      topDiscard ? "has-discard" : "",
    ].filter(Boolean).join(" ");
    row.dataset.deckId = deck.id;

    const head = document.createElement("header");
    head.className = "deck-rail-head";
    const label = document.createElement("span");
    label.className = "deck-rail-label";
    label.innerHTML = deck.sub
      ? `${deck.emoji} ${deck.label} <span class="deck-rail-sub">${deck.sub}</span>`
      : `${deck.emoji} ${deck.label}`;
    const meta = document.createElement("span");
    meta.className = "deck-rail-meta";
    meta.textContent = `${drawCount} · ${discardCount} disc`;
    head.append(label, meta);
    row.appendChild(head);

    const piles = document.createElement("div");
    piles.className = "deck-rail-piles";

    const drawZone = document.createElement("div");
    drawZone.className = "deck-rail-draw";
    drawZone.dataset.deckId = deck.id;
    drawZone.title = `${drawCount} card${drawCount === 1 ? "" : "s"} in draw pile`;
    const drawRects = document.createElement("div");
    drawRects.className = "deck-rect-stack deck-rect-stack-draw";
    fillRectStack(drawRects, drawCount, "draw");
    drawZone.appendChild(drawRects);
    appendPeekCards(drawZone, peeked, onViewPeek, deck.id);
    piles.appendChild(drawZone);

    const sep = document.createElement("span");
    sep.className = "deck-rail-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = "⇄";
    piles.appendChild(sep);

    const discardZone = document.createElement("div");
    discardZone.className = "deck-rail-discard";
    discardZone.title = discardCount
      ? (blockDiscard ? "Discard hidden during trade" : "Click top card to browse discard pile")
      : "Discard pile is empty";
    const discardRects = document.createElement("div");
    discardRects.className = "deck-rect-stack deck-rect-stack-discard";
    const discardUnder = Math.max(0, discardCount - (topDiscard ? 1 : 0));
    fillRectStack(discardRects, discardUnder, "discard");
    discardZone.style.setProperty("--stack-count", String(discardUnder));
    discardZone.appendChild(discardRects);

    if (topDiscard && !blockDiscard) {
      const face = deckFaceCard(topDiscard, {
        onClick: () => onViewDiscard(deck.id),
      });
      if (deck.id === "dream") {
        face.classList.add("deck-last-dream");
        if (state.activeDream
          && (state.activeDream.instanceId === topDiscard.instanceId
            || state.activeDream.id === topDiscard.id)) {
          const badge = document.createElement("span");
          badge.className = "deck-last-dream-badge";
          badge.textContent = "Last Dream";
          discardZone.appendChild(badge);
        }
      }
      discardZone.appendChild(face);
    } else if (!topDiscard) {
      discardZone.appendChild(deckFaceCard(null));
    } else {
      const blocked = document.createElement("div");
      blocked.className = "deck-discard-blocked";
      blocked.textContent = "Trade";
      blocked.title = "Discard hidden during trade";
      discardZone.appendChild(blocked);
    }

    piles.appendChild(discardZone);
    row.appendChild(piles);
    column.appendChild(row);
  });
  }

  requestAnimationFrame(() => {
    syncDeckColumnFit();
    requestAnimationFrame(syncDeckColumnFit);
  });
}

export function renderSubconsciousButton(state) {
  const btn = document.getElementById("btn-header-subconscious");
  if (!btn) return;

  const count = subconsciousCount(state.subconscious);
  const pending = state.pendingReturn || state.pendingRepress;
  const label = count > 0 ? `☠ Subconscious (${count})` : "☠ Subconscious";
  btn.textContent = label;
  btn.classList.toggle("subconscious-pending", !!pending);
  btn.title = pending
    ? "Return or Repress pending — browse The Subconscious"
    : count > 0
      ? `${count} repressed card${count === 1 ? "" : "s"} face-up — browse The Subconscious`
      : "Browse The Subconscious (empty)";
}

function renderQuestProgressList(statuses) {
  const ul = document.createElement("ul");
  ul.className = "quest-list compact quest-progress-list";
  statuses.forEach((q) => {
    const li = document.createElement("li");
    li.className = [q.done ? "done" : "", q.ready ? "ready" : ""].filter(Boolean).join(" ");
    const bar = document.createElement("span");
    bar.className = "quest-progress";
    bar.setAttribute("aria-label", `Quest ${q.index + 1}: ${q.conditionMet ? "condition met" : "in progress"}, ${q.tokenSpent ? "marked" : "not marked"}`);
    bar.innerHTML = `
      <span class="quest-seg ${q.conditionMet ? "met" : ""}" title="Condition met"></span>
      <span class="quest-seg ${q.tokenSpent ? "done" : ""}" title="Power token spent"></span>
    `;
    li.innerHTML = `<span class="quest-text">${q.index + 1}. ${q.text}</span>`;
    li.appendChild(bar);
    if (q.ready) {
      const mark = document.createElement("span");
      mark.className = "quest-ready-mark";
      mark.textContent = " · ready";
      li.appendChild(mark);
    }
    ul.appendChild(li);
  });
  return ul;
}

export function renderActiveSlots(state, onCardClick) {
  const archetypeSlot = document.getElementById("active-archetype");
  const encounterSlot = document.getElementById("active-encounter");
  const acquired = document.getElementById("acquired-archetypes");

  archetypeSlot.innerHTML = "";
  encounterSlot.innerHTML = "";
  acquired.innerHTML = "";

  if (state.persistentArchetypes?.length) {
    const kept = document.createElement("div");
    kept.className = "kept-archetypes hidden";
    archetypeSlot.appendChild(kept);
  }

  if (state.activeArchetype) {
    const card = { ...state.activeArchetype };
    const statuses = getQuestStatus(state, card);
    const tokensOn = card.powerTokensOnArchetype || 0;
    archetypeSlot.appendChild(renderCard(card, {
      portrait: true,
      onClick: () => onCardClick(card),
    }));
    if (statuses.length) {
      archetypeSlot.appendChild(renderQuestProgressList(statuses));
      const tokens = document.createElement("p");
      tokens.className = "archetype-tokens";
      tokens.textContent = `${tokensOn}/2 Power Tokens on Archetype`;
      archetypeSlot.appendChild(tokens);
    }
  } else {
    archetypeSlot.textContent = "No active Archetype.";
  }

  const selectedTile = state.board.find((t) => t.id === state.selectedLandscapeId);
  const tileEncounter = selectedTile?.encounter || null;
  encounterSlot.classList.toggle("scene-linked", !!tileEncounter);
  if (tileEncounter) {
    if (selectedTile?.name) {
      const scene = document.createElement("p");
      scene.className = "encounter-scene-label";
      scene.textContent = `On ${selectedTile.name}`;
      encounterSlot.appendChild(scene);
    }
    encounterSlot.appendChild(renderCard(tileEncounter, {
      onClick: () => onCardClick(tileEncounter),
    }));
  } else {
    const tileName = selectedTile?.revealed ? selectedTile.name : "selected tile";
    const meetPhase = getPhase(state) === "Meet";
    const empty = document.createElement("p");
    empty.className = "encounter-empty";
    empty.textContent = meetPhase
      ? `No encounter on ${tileName}. Select a Landscape with a Dreambeast.`
      : `No encounter on ${tileName}.`;
    encounterSlot.appendChild(empty);
  }

  const allAcquired = state.players.flatMap((p) => p.acquiredArchetypes);
  allAcquired.forEach((card) => {
    acquired.appendChild(renderCard(card, {
      mini: true,
      onClick: () => onCardClick(card),
    }));
  });
}

function dreamsUrgencyClass(count) {
  if (count <= 4) return "hud-urgent-critical";
  if (count <= 8) return "hud-urgent-warn";
  return "";
}

function phaseBudgetChipLabel(state) {
  const phase = getPhase(state);
  if (phase === "Reveal") {
    if (!state.dreamDrawn) return null;
    if (state.landscapePick?.mode === "choose") return "Choose a hex";
    if (state.landscapePick?.mode === "reveal" && state.landscapePick.remaining > 0) {
      return `${state.landscapePick.remaining} reveal${state.landscapePick.remaining === 1 ? "" : "s"}`;
    }
    if (phaseOpeningActive(state)) return "Spend Lucidity";
    return null;
  }
  if (phase === "Explore") {
    if (!state.exploreActivated) return phaseOpeningActive(state) ? "Spend Elasticity" : null;
    return `${state.exploreMovesLeft} move${state.exploreMovesLeft === 1 ? "" : "s"}`;
  }
  if (phase === "Meet") {
    if (!state.meetActionBudget) return phaseOpeningActive(state) ? "Spend Willpower" : null;
    return `${state.meetActionsUsed}/${state.meetActionBudget} actions`;
  }
  return null;
}

function renderCoopBanner(state) {
  const el = document.getElementById("coop-play-banner");
  if (!el) return;
  el.classList.add("hidden");
  el.textContent = "";
}

export function renderHud(state, hint = "") {
  const goalEl = document.getElementById("hud-goal");
  const goalBar = document.getElementById("hud-goal-bar");
  const pointsEl = document.getElementById("hud-points");
  const dreamsEl = document.getElementById("hud-dreams");
  const dreamsWrap = document.querySelector(".hud-dreams-wrap");
  const beastsWrap = document.getElementById("hud-beasts-wrap");
  const beastsEl = document.getElementById("hud-beasts");

  if (state.finalRecurrence) {
    const left = state.finalArchetypes?.filter((a) => !a.defeated).length || 0;
    if (goalEl) goalEl.textContent = `Final: ${left} left`;
    if (goalBar) goalBar.style.width = "0%";
  } else {
    const goal = state.goalPoints || 0;
    const pts = state.acquiredPoints || 0;
    if (goalEl) goalEl.textContent = `${pts}/${goal} pts`;
    if (goalBar) {
      const pct = goal > 0 ? Math.min(100, Math.round((pts / goal) * 100)) : 0;
      goalBar.style.width = `${pct}%`;
    }
  }

  if (pointsEl) pointsEl.textContent = String(state.acquiredPoints);

  const dreamsLeft = state.dreamDeck.length;
  if (dreamsEl) dreamsEl.textContent = String(dreamsLeft);
  if (dreamsWrap) {
    dreamsWrap.classList.remove("hud-urgent-critical", "hud-urgent-warn");
    const urgency = dreamsUrgencyClass(dreamsLeft);
    if (urgency) dreamsWrap.classList.add(urgency);
  }

  const beastCount = countBoardDreambeasts(state);
  if (beastsWrap && beastsEl) {
    if (beastCount > 0) {
      beastsWrap.classList.remove("hidden");
      beastsEl.textContent = String(beastCount);
      beastsWrap.title = `${beastCount} roaming Dreambeast${beastCount === 1 ? "" : "s"} on the map`;
    } else {
      beastsWrap.classList.add("hidden");
      beastsEl.textContent = "0";
    }
  }

  document.getElementById("hud-round").textContent = String(state.round);
  const bossRounds = BOSS_DREAM_DECK_SLOTS.map((slot) => slot + 1);
  const bossEl = document.getElementById("hud-boss-rounds");
  if (bossEl) {
    bossEl.innerHTML = bossRounds.map((round) => {
      const cls = state.round > round ? "passed" : state.round === round ? "now" : "upcoming";
      return `<span class="hud-boss-tick ${cls}" title="Boss Dream round ${round}">☠</span>`;
    }).join("");
    bossEl.setAttribute("aria-label", `Boss dream rounds: ${bossRounds.join(", ")}`);
    bossEl.removeAttribute("aria-hidden");
  }
  const feedBtn = document.getElementById("btn-dream-feed");
  if (feedBtn && consumeDreamFeedNudge()) {
    feedBtn.classList.add("dream-feed-nudge");
    window.setTimeout(() => feedBtn.classList.remove("dream-feed-nudge"), 3200);
  }

  flashQuestReadyMoments(state);

  const banner = document.getElementById("phase-banner");
  if (banner) banner.textContent = "";

  renderCoopBanner(state);

  const table = document.getElementById("table-surface");
  if (table) {
    table.classList.remove("table-wash-lucidity", "table-wash-elasticity", "table-wash-willpower");
    const phase = getPhase(state);
    const wash = phase === "Reveal"
      ? "table-wash-lucidity"
      : phase === "Explore"
        ? "table-wash-elasticity"
        : "table-wash-willpower";
    table.classList.add(wash);
  }
}

const PHASES = ["Reveal", "Explore", "Meet"];

export function renderPhaseStepper(state) {
  const el = document.getElementById("phase-stepper");
  if (!el) return;
  const current = getPhase(state);
  const pulse = consumePhasePulse();
  const budgetChip = phaseBudgetChipLabel(state);
  el.className = pulse ? "phase-stepper phase-pulse" : "phase-stepper";
  el.innerHTML = PHASES.map((phase, i) => {
    const active = phase === current;
    const done = PHASES.indexOf(current) > i;
    const suit = phase === "Reveal" ? "lucidity" : phase === "Explore" ? "elasticity" : "willpower";
    const cls = ["step", active ? "active" : "", done ? "done" : ""].filter(Boolean).join(" ");
    const arrow = i < PHASES.length - 1 ? '<span class="step-arrow">→</span>' : "";
    const chip = active && budgetChip
      ? `<span class="step-budget">${budgetChip}</span>`
      : "";
    return `
      <div class="${cls}" data-phase="${phase}">
        <span class="step-icon suit-${suit}">${suitIconHtml(suit, { size: 14 })}</span>
        <span class="step-label">${phase}</span>
        ${chip}
      </div>${arrow}
    `;
  }).join("");
}

function formatGuideStep(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

export function renderGuidePanel(state, actions = []) {
  const el = document.getElementById("guide-panel");
  if (!el) return;
  const hideGuide = !state
    || (state.tutorialMode && !state.tutorialComplete)
    || state.status !== "playing";
  const obj = hideGuide ? null : getCurrentObjective(state);
  if (!obj) {
    el.innerHTML = "";
    el.classList.add("hidden");
    el.setAttribute("hidden", "");
    return;
  }
  el.classList.remove("hidden");
  el.removeAttribute("hidden");

  const stepsHtml = obj.steps
    .map((s, i) => `<li class="${i === 0 ? "current" : ""}">${formatGuideStep(s)}</li>`)
    .join("");
  const tip = obj.tip ? `<p class="guide-tip">${obj.tip}</p>` : "";
  const actionHints = listPhaseActionHints(state, actions);
  const actionsHtml = actionHints.length
    ? `<div class="guide-actions"><h4>Available now</h4><ul>${actionHints.map((h) => `<li>${formatGuideStep(h)}</li>`).join("")}</ul></div>`
    : "";

  const suitKey = obj.suit || null;
  const suitHeader = suitKey
    ? `<span class="guide-icon">${suitIconHtml(suitKey, { size: 16 })}</span>`
    : "";

  el.innerHTML = `
    <div class="guide-header${suitKey ? ` suit-${suitKey}` : ""}">
      ${suitHeader}
      <span class="guide-title">${obj.title}</span>
      <span class="guide-phase-tag">${obj.phase} Phase</span>
    </div>
    <ol class="guide-steps">${stepsHtml}</ol>
    ${tip}
    ${actionsHtml}
  `;
}

export function renderNarratorPanel(_state) {
  // Narrator content is shown in the Dream Feed modal (v14).
}

function buildDreamFeedHtml(state) {
  if (!state) {
    return "<p class=\"dream-feed-empty\">Start a game to see the dream feed.</p>";
  }
  const view = getNarratorView(state);
  const consequences = view.consequences?.length
    ? `<ul class="dream-feed-consequences">${view.consequences.map((c) => `<li>${c}</li>`).join("")}</ul>`
    : "";
  const logLines = (state.log || [])
    .map((line) => `<div class="dream-feed-log-line">${line}</div>`)
    .join("");
  return `
    <div class="dream-feed-page">
      <section class="dream-feed-now">
        <h3 class="dream-feed-label">What just happened</h3>
        <h2 class="dream-feed-title">${view.title}</h2>
        <p class="dream-feed-detail">${view.detail}</p>
        ${consequences}
      </section>
      <section class="dream-feed-log">
        <h3 class="dream-feed-label">Play-by-play</h3>
        <div class="dream-feed-log-scroll">${logLines || "<p class=\"dream-feed-empty\">No events yet this dream.</p>"}</div>
      </section>
    </div>
  `;
}

export function renderPhaseAdvanceBar() {
  // Advance button is rendered inside #phase-actions via renderPhaseActions.
}

const ACTION_SECTIONS = {
  main: "Phase",
  encounter: "Encounter",
  actions: "Landscape",
  progress: "Power",
};

const ACTION_DOCK_ROWS = [
  { id: "phase", sections: ["main"] },
  { id: "scene", sections: ["encounter", "actions"] },
  { id: "power", sections: ["progress"] },
];

function createActionButton(action) {
  const btn = document.createElement("button");
  btn.type = "button";
  const classes = ["btn", "action-dock-btn"];
  if (action.primary) classes.push("primary");
  if (!action.disabled) classes.push("btn-ready");
  if (action.disabled && action.hint) classes.push("action-disabled-hint");
  btn.className = classes.join(" ");
  btn.textContent = action.label;
  btn.title = action.hint || action.label;
  btn.disabled = !!action.disabled;
  if (action.section) btn.dataset.section = action.section;
  const tutorialAction = classifyPhaseAction(action);
  if (tutorialAction && tutorialAction !== "other") {
    btn.dataset.tutorialAction = tutorialAction;
  }
  btn.addEventListener("click", action.onClick);
  return btn;
}

function createAdvanceButton(advanceAction) {
  const wrap = document.createElement("div");
  wrap.className = "action-dock-advance";
  wrap.id = "phase-advance-bar";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btn-advance-phase";
  btn.className = `btn btn-advance action-dock-btn primary${advanceAction.disabled ? "" : " btn-ready"}`;
  btn.textContent = advanceAction.label;
  btn.disabled = !!advanceAction.disabled;
  btn.title = advanceAction.hint || "Advance to the next phase when your group is ready";
  btn.addEventListener("click", advanceAction.onClick);
  wrap.appendChild(btn);
  return wrap;
}

export function renderPhaseActions(actions, advanceAction = null, state = null) {
  const container = document.getElementById("phase-actions");
  if (!container) return;

  container.innerHTML = "";
  container.className = "phase-actions action-dock";

  if (state && getPhase(state) === "Meet") {
    const toll = timelineTollPreview(state);
    if (toll) {
      const note = document.createElement("p");
      note.className = "timeline-toll-preview";
      if (toll.unpaid > 0) {
        note.textContent =
          `Timeline toll: ${toll.beastCount} beast${toll.beastCount === 1 ? "" : "s"} — up to ${toll.paid} token${toll.paid === 1 ? "" : "s"}, else ${toll.unpaid} Dream${toll.unpaid === 1 ? "" : "s"} fray at round end`;
      } else {
        note.textContent =
          `Timeline toll: ${toll.beastCount} beast${toll.beastCount === 1 ? "" : "s"} — team can pay ${toll.paid} token${toll.paid === 1 ? "" : "s"}`;
      }
      container.appendChild(note);
    }
  }

  const grouped = {};
  actions.forEach((action) => {
    if (action.hidden || action.advance) return;
    const section = ACTION_SECTIONS[action.section] ? action.section : "main";
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(action);
  });

  const strip = document.createElement("div");
  strip.className = "action-dock-strip";

  ACTION_DOCK_ROWS.forEach((rowDef) => {
    const row = document.createElement("div");
    row.className = `action-dock-row action-dock-row-${rowDef.id}`;
    let used = false;

    rowDef.sections.forEach((section) => {
      const items = grouped[section] || [];
      const isPhase = section === "main";
      if (!items.length && !(isPhase && advanceAction)) return;

      const group = document.createElement("section");
      group.className = `action-group action-group-${section}`;
      if (isPhase) group.classList.add("action-section-primary");
      group.setAttribute("aria-label", ACTION_SECTIONS[section]);

      const heading = document.createElement("span");
      heading.className = "action-group-label";
      heading.textContent = ACTION_SECTIONS[section];
      group.appendChild(heading);

      const buttons = document.createElement("div");
      buttons.className = "action-group-btns";
      items.forEach((action) => {
        buttons.appendChild(createActionButton(action));
      });
      if (isPhase && advanceAction) {
        buttons.appendChild(createAdvanceButton(advanceAction));
      }
      group.appendChild(buttons);
      row.appendChild(group);
      used = true;
    });

    if (used) strip.appendChild(row);
  });

  if (strip.children.length) {
    container.appendChild(strip);
  } else {
    container.innerHTML = "<p class=\"action-dock-empty\">No actions available right now.</p>";
  }
}

function bindRulesReferenceTabs(root) {
  root.querySelectorAll("[data-rules-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.rulesTab;
      root.querySelectorAll("[data-rules-tab]").forEach((b) => {
        b.classList.toggle("active", b.dataset.rulesTab === tab);
      });
      root.querySelectorAll("[data-rules-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.rulesPanel === tab);
      });
      if (tab === RULES_TAB_FEED && uiRenderState) {
        const feedPanel = root.querySelector('[data-rules-panel="feed"]');
        if (feedPanel) feedPanel.innerHTML = buildDreamFeedHtml(uiRenderState);
      }
    });
  });
}

export function showRulesReferenceModal(activeTab = RULES_TAB_INTRO, state = null) {
  const modal = document.getElementById("utility-modal");
  const content = modal?.querySelector(".utility-content");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;
  content?.classList.remove("fullscreen-browser");
  content?.classList.add("rules-reference-modal");
  const feedHtml = state ? buildDreamFeedHtml(state) : undefined;
  body.innerHTML = `<div class="rules-modal">${rulesReferenceHtml(activeTab, { feedHtml })}</div>`;
  bindRulesReferenceTabs(body);
  modal.classList.remove("hidden");
}

export function showDreamFeedModal(state, activeTab = RULES_TAB_FEED) {
  showRulesReferenceModal(activeTab, state);
}

export function showRulesModal(state = null) {
  showRulesReferenceModal(RULES_TAB_DETAILS, state);
}

export function showOverviewModal(state = null) {
  showRulesReferenceModal(RULES_TAB_INTRO, state);
}

function formatMomentHistoryTime(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function buildMomentHistoryHtml() {
  const entries = getMomentHistory();
  if (!entries.length) {
    return "<p class=\"dream-feed-empty\">No dream moments yet — they'll appear here as play unfolds.</p>";
  }
  return entries.map((entry) => `
    <article class="moment-history-entry">
      <time datetime="${new Date(entry.at).toISOString()}">${formatMomentHistoryTime(entry.at)}</time>
      <p>${entry.message}</p>
    </article>
  `).join("");
}

export function showMomentHistoryModal() {
  const modal = document.getElementById("utility-modal");
  const content = modal?.querySelector(".utility-content");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;
  content?.classList.remove("fullscreen-browser", "rules-reference-modal");
  body.innerHTML = `
    <div class="moment-history-page">
      <h3 class="dream-feed-label">Dream moments</h3>
      <p class="moment-history-hint">Brief flashes from the dreamscape — newest first.</p>
      <div class="moment-history-scroll">${buildMomentHistoryHtml()}</div>
    </div>
  `;
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");
}

const questReadyFlashed = new Set();

export function resetQuestReadyFlashes() {
  questReadyFlashed.clear();
}

function flashQuestReadyMoments(state) {
  const arch = state.activeArchetype;
  if (!arch) return;
  getQuestStatus(state, arch).forEach((q) => {
    if (!q.ready) return;
    const key = `${arch.id}:${q.index}`;
    if (questReadyFlashed.has(key)) return;
    questReadyFlashed.add(key);
    flashMoment(`Quest ready — spend 1 Power Token: ${q.text}`);
  });
}

export function renderLog(state) {
  const log = document.getElementById("log");
  if (!log) return;
  log.innerHTML = state.log.map((line) => `<div>${line}</div>`).join("");
}

export function renderDreamerPicker(dreamers, selectedIds, onToggle, options = {}) {
  const picker = document.getElementById("dreamer-picker");
  if (!picker) return;
  hideDreamerDetailTooltip();
  picker.innerHTML = "";

  const playerCount = options.playerCount ?? selectedIds.length;
  const recommendedIds = new Set(options.recommendedIds || []);

  dreamers.forEach((dreamer) => {
    const slotIndex = selectedIds.indexOf(dreamer.id);
    const selected = slotIndex >= 0;
    const wrapper = document.createElement("div");
    wrapper.className = `dreamer-pick${selected ? " selected" : ""}${recommendedIds.has(dreamer.id) ? " recommended" : ""}`;
    wrapper.tabIndex = 0;
    const card = renderCard(
      { ...dreamer, type: "dreamer" },
      {
        portrait: true,
        selected,
      }
    );
    const selectDreamer = () => {
      hideDreamerDetailTooltip();
      onToggle(dreamer.id);
    };
    const stats = document.createElement("div");
    stats.className = "dreamer-pick-stats";
    stats.innerHTML = `<div class="dreamer-pick-name">${dreamer.name}</div>${dreamerStatsHtml(dreamer)}`;
    wrapper.appendChild(card);
    wrapper.appendChild(stats);
    if (recommendedIds.has(dreamer.id) && !selected) {
      const rec = document.createElement("div");
      rec.className = "dreamer-pick-recommended";
      rec.textContent = "Recommended";
      wrapper.appendChild(rec);
    }
    if (selected) {
      const badge = document.createElement("div");
      badge.className = "dreamer-pick-slot";
      badge.textContent = `Player ${slotIndex + 1}`;
      wrapper.appendChild(badge);
    }

    const showTooltip = () => {
      const nextSlot = selectedIds.length < playerCount ? selectedIds.length + 1 : null;
      showDreamerDetailTooltip(dreamer, wrapper, {
        playerSlot: selected ? slotIndex + 1 : undefined,
        setupHint: !selected && nextSlot ? `Click to assign Player ${nextSlot}` : undefined,
        partyFull: !selected && !nextSlot,
      });
    };

    wrapper.addEventListener("mouseenter", showTooltip);
    wrapper.addEventListener("mouseleave", hideDreamerDetailTooltip);
    wrapper.addEventListener("focusin", showTooltip);
    wrapper.addEventListener("focusout", (event) => {
      if (!wrapper.contains(event.relatedTarget)) hideDreamerDetailTooltip();
    });
    wrapper.addEventListener("click", selectDreamer);
    wrapper.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectDreamer();
      }
    });

    picker.appendChild(wrapper);
  });
}

export function renderSetupIntro() {
  const legend = document.getElementById("setup-phase-legend");
  if (!legend) return;
  legend.innerHTML = `
    <div class="round-step suit-lucidity">${suitIconHtml("lucidity", { size: 22 })} <strong>Reveal</strong><span>Draw Dream · reveal Landscapes</span></div>
    <div class="round-step suit-elasticity">${suitIconHtml("elasticity", { size: 22 })} <strong>Explore</strong><span>Spend Elasticity · move on the map</span></div>
    <div class="round-step suit-willpower">${suitIconHtml("willpower", { size: 22 })} <strong>Meet</strong><span>Gain actions · face Encounters</span></div>
  `;
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  const inGame = id === "screen-game";
  document.body.classList.toggle("in-game", inGame);
  const hud = document.getElementById("hud");
  if (hud) hud.classList.toggle("hidden", !inGame);
  document.getElementById("header-actions")?.classList.toggle("hidden", !inGame);
}

export function showEndScreen(won, message, scoreResult = null) {
  showScreen("screen-end");
  document.getElementById("end-title").textContent = won ? "You Wake Up!" : "Trapped Forever";
  document.getElementById("end-message").textContent = message;
  document.getElementById("btn-start-daydream")?.classList.add("hidden");

  const breakdownEl = document.getElementById("end-score-breakdown");
  const leaderboardEl = document.getElementById("end-leaderboard");
  if (won && scoreResult?.breakdown) {
    const b = scoreResult.breakdown;
    breakdownEl.classList.remove("hidden");
    breakdownEl.innerHTML = `
      <h3>Final Score: ${b.total}</h3>
      <ul class="score-breakdown-list">
        <li>Archetype goal: <strong>${b.archetypePoints}</strong></li>
        <li>Psyche in hands: <strong>${b.psyche}</strong></li>
        <li>Objects: <strong>${b.objects}</strong></li>
        <li>Power Tokens: <strong>${b.tokens}</strong></li>
        <li>Accepted allies: <strong>${b.allies}</strong></li>
        <li>Dreams remaining: <strong>${b.dreams}</strong></li>
      </ul>
    `;
    leaderboardEl?.classList.remove("hidden");
  } else {
    breakdownEl?.classList.add("hidden");
    leaderboardEl?.classList.add("hidden");
  }
}

export function showLandscapeActionPicker(tile, choices, onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const buttons = choices.map((choice) => `
    <button type="button" class="btn landscape-action-pick" data-action="${choice.id}">
      <strong>${choice.label}</strong>
      <span class="landscape-action-desc">${choice.description || ""}</span>
    </button>
  `).join("");

  body.innerHTML = `
    <h2>Landscape Action — ${tile.name}</h2>
    <p>Choose one action (spends 1 Meet action):</p>
    <div class="utility-actions landscape-action-choices">${buttons}</div>
  `;

  body.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      hideUtilityModal(true);
      onPick(btn.dataset.action);
    });
  });
  modal.classList.remove("hidden");
}

export function showDreamerPowerChoice(ui, onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const buttons = (ui.choices || []).map((choice) => `
    <button type="button" class="btn dreamer-power-pick" data-choice="${choice.id}"${choice.disabled ? " disabled" : ""}>
      <strong>${choice.label}</strong>
      ${choice.hint ? `<span class="landscape-action-desc">${choice.hint}</span>` : ""}
    </button>
  `).join("");
  body.innerHTML = `
    <div class="dreamer-power-modal">
      <h2>${ui.title || "Dreamer Power"}</h2>
      <p>${ui.message || ""}</p>
      <div class="utility-actions landscape-action-choices">${buttons}</div>
    </div>
  `;
  modal.querySelector(".utility-content")?.classList.add("dreamer-power-modal-wrap");
  body.querySelectorAll("[data-choice]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      modal.querySelector(".utility-content")?.classList.remove("dreamer-power-modal-wrap");
      hideUtilityModal(true);
      onPick(btn.dataset.choice);
    });
  });
  modal.classList.remove("hidden");
}

export function showObjectCardPicker(ui, onPick) {
  const body = document.getElementById("utility-modal-body");
  const cards = ui.cards || [];
  let selectedId = null;

  body.innerHTML = cardChoiceShellHtml({
    title: ui.title || "Choose a card",
    message: ui.message || "",
    statusText: "Select a card, then Confirm.",
    confirmLabel: "Confirm choice",
  });
  prepareCardChoiceModal();

  const row = body.querySelector(".card-choice-row");
  const confirmBtn = body.querySelector("#card-choice-confirm");
  const statusEl = body.querySelector(".card-choice-status");

  const refresh = () => {
    row.querySelectorAll(".card-choice-wrap").forEach((wrap) => {
      const selected = wrap.dataset.cardId === selectedId;
      wrap.querySelector(".game-card")?.classList.toggle("selected", selected);
    });
    const picked = cards.find((c) => cardChoiceKey(c) === selectedId);
    confirmBtn.disabled = !selectedId;
    statusEl.textContent = picked
      ? `Selected: ${picked.name}`
      : "Select a card, then Confirm.";
  };

  cards.forEach((card) => {
    mountChoicePickerCard(row, card, {
      cards,
      onSelect: () => {
        selectedId = cardChoiceKey(card);
        refresh();
      },
    });
  });
  refresh();

  confirmBtn?.addEventListener("click", () => {
    if (!selectedId) return;
    hideModal();
    hideUtilityModal(true);
    onPick(selectedId);
  });
}

export function showObjectReorderPicker(ui, onPick) {
  const body = document.getElementById("utility-modal-body");
  const cards = ui.top || [];
  const order = ui.order || [];
  const picked = new Set(order.map((c) => cardChoiceKey(c)));
  const total = cards.length;

  body.innerHTML = cardChoiceShellHtml({
    title: ui.title || "Reorder",
    message: ui.message || "",
    statusText: `Pick cards in the new top order (${order.length}/${total}).`,
    showConfirm: false,
  });
  prepareCardChoiceModal();

  const row = body.querySelector(".card-choice-row");
  const statusEl = body.querySelector(".card-choice-status");

  const refresh = () => {
    const currentOrder = ui.order || [];
    const pickedNow = new Set(currentOrder.map((c) => cardChoiceKey(c)));
    row.querySelectorAll(".card-choice-wrap").forEach((wrap) => {
      const id = wrap.dataset.cardId;
      const orderIndex = currentOrder.findIndex((c) => cardChoiceKey(c) === id);
      const badge = wrap.querySelector(".card-choice-order");
      if (badge) {
        badge.textContent = orderIndex >= 0 ? String(orderIndex + 1) : "";
        badge.classList.toggle("hidden", orderIndex < 0);
      }
      wrap.querySelector(".game-card")?.classList.toggle("selected", pickedNow.has(id));
      wrap.classList.toggle("is-picked", pickedNow.has(id));
    });
    statusEl.textContent = order.length >= total
      ? "Order complete."
      : `Pick cards in the new top order (${order.length}/${total}).`;
  };

  cards.forEach((card) => {
    const id = cardChoiceKey(card);
    const orderIndex = order.findIndex((c) => cardChoiceKey(c) === id);
    mountChoicePickerCard(row, card, {
      cards,
      selected: picked.has(id),
      orderIndex: orderIndex >= 0 ? orderIndex : null,
      disabled: picked.has(id),
      onSelect: () => {
        if (picked.has(id)) return;
        onPick(id);
      },
    });
  });
  refresh();
}

export function showObjectSpendPicker(ui, onToggle, onConfirm) {
  const body = document.getElementById("utility-modal-body");
  const cards = ui.cards || [];

  body.innerHTML = cardChoiceShellHtml({
    title: ui.title || "Spend Psyche",
    message: ui.message || "",
    statusText: "Select cards to spend, then Confirm.",
    confirmLabel: "Confirm selection",
  });
  prepareCardChoiceModal();

  const row = body.querySelector(".card-choice-row");
  const confirmBtn = body.querySelector("#card-choice-confirm");
  const statusEl = body.querySelector(".card-choice-status");

  const spendTotals = () => {
    const selected = new Set(ui.order || []);
    const countMode = ui.needCount != null;
    const total = countMode
      ? selected.size
      : cards.filter((c) => selected.has(c.instanceId)).reduce((sum, c) => sum + psycheCardValue(c), 0);
    const need = countMode ? ui.needCount : (ui.need || 0);
    const overMax = ui.maxCount != null && selected.size > ui.maxCount;
    return { selected, total, need, overMax };
  };

  const refresh = () => {
    const { selected, total, need, overMax } = spendTotals();
    row.querySelectorAll(".card-choice-wrap").forEach((wrap) => {
      const id = wrap.dataset.cardId;
      wrap.querySelector(".game-card")?.classList.toggle("selected", selected.has(id));
    });
    const cap = ui.maxCount ?? need;
    statusEl.textContent = need || ui.maxCount != null
      ? `Selected ${total} / ${cap}`
      : `Selected ${total} Psyche`;
    confirmBtn.disabled = total < need || overMax;
  };

  cards.forEach((card) => {
    mountChoicePickerCard(row, card, {
      cards,
      onSelect: () => {
        onToggle(card.instanceId);
        refresh();
      },
    });
  });
  refresh();

  confirmBtn?.addEventListener("click", () => {
    const { total, need, overMax } = spendTotals();
    if (total < need || overMax) return;
    hideModal();
    hideUtilityModal(true);
    onConfirm();
  });
}

export function showDreamerPowerDeckPicker(ui, onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `
    <div class="dreamer-power-modal">
      <h2>${ui.title || "Choose a Deck"}</h2>
      <p>${ui.message || "Flip and show the top card:"}</p>
      <div class="utility-actions mindstream-pick">
        <button type="button" class="btn" data-deck="psyche">Psyche Deck</button>
        <button type="button" class="btn" data-deck="dream">Dream Deck</button>
        <button type="button" class="btn" data-deck="archetype">Archetype Deck</button>
        <button type="button" class="btn suit-lucidity" data-deck="mindstream-lucidity">${suitIconHtml("lucidity", { size: 14 })} Lucidity Mindstream</button>
        <button type="button" class="btn suit-elasticity" data-deck="mindstream-elasticity">${suitIconHtml("elasticity", { size: 14 })} Elasticity Mindstream</button>
        <button type="button" class="btn suit-willpower" data-deck="mindstream-willpower">${suitIconHtml("willpower", { size: 14 })} Willpower Mindstream</button>
      </div>
    </div>
  `;
  modal.querySelector(".utility-content")?.classList.add("dreamer-power-modal-wrap");
  body.querySelectorAll("[data-deck]").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.querySelector(".utility-content")?.classList.remove("dreamer-power-modal-wrap");
      hideUtilityModal(true);
      onPick(btn.dataset.deck);
    });
  });
  modal.classList.remove("hidden");
}

export function showDeckFlipPicker(onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `
    <h2>Flip Top 3</h2>
    <p>Choose a deck to flip the top 3 cards:</p>
    <div class="utility-actions mindstream-pick">
      <button type="button" class="btn" data-deck="psyche">Psyche Deck</button>
      <button type="button" class="btn" data-deck="dream">Dream Deck</button>
      <button type="button" class="btn suit-lucidity" data-deck="mindstream-lucidity">${suitIconHtml("lucidity", { size: 14 })} Lucidity Mindstream</button>
      <button type="button" class="btn suit-elasticity" data-deck="mindstream-elasticity">${suitIconHtml("elasticity", { size: 14 })} Elasticity Mindstream</button>
      <button type="button" class="btn suit-willpower" data-deck="mindstream-willpower">${suitIconHtml("willpower", { size: 14 })} Willpower Mindstream</button>
    </div>
  `;
  body.querySelectorAll("[data-deck]").forEach((btn) => {
    btn.addEventListener("click", () => {
      hideUtilityModal(true);
      onPick(btn.dataset.deck);
    });
  });
  modal.classList.remove("hidden");
}

export function showMindstreamPicker(onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `
    <h2>Draw Mindstream</h2>
    <p>Choose a suit deck:</p>
    <div class="utility-actions mindstream-pick">
      <button type="button" class="btn suit-lucidity" data-suit="lucidity">${suitIconHtml("lucidity", { size: 14 })} Lucidity</button>
      <button type="button" class="btn suit-elasticity" data-suit="elasticity">${suitIconHtml("elasticity", { size: 14 })} Elasticity</button>
      <button type="button" class="btn suit-willpower" data-suit="willpower">${suitIconHtml("willpower", { size: 14 })} Willpower</button>
    </div>
  `;
  body.querySelectorAll("[data-suit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      hideUtilityModal(true);
      onPick(btn.dataset.suit);
    });
  });
  modal.classList.remove("hidden");
}

export function showTradeControls(state, onConfirm, onCancel) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const partner = state.players.find((p) => p.id === state.trade?.partnerId);
  const offerCount = state.trade?.offerPsycheIds?.length || 0;
  body.innerHTML = `
    <h2>Trade with ${partner?.name || "…"}</h2>
    <p>Select up to 3 Psyche cards from your hand to offer, then confirm.</p>
    <p><strong>Offering:</strong> ${offerCount} card(s)</p>
    <div class="utility-actions">
      <button type="button" class="btn primary" id="trade-confirm">Confirm Trade</button>
      <button type="button" class="btn" id="trade-cancel">Cancel</button>
    </div>
  `;
  body.querySelector("#trade-confirm").addEventListener("click", () => {
    hideUtilityModal(true);
    onConfirm();
  });
  body.querySelector("#trade-cancel").addEventListener("click", () => {
    hideUtilityModal(true);
    onCancel();
  });
  modal.classList.remove("hidden");
}

export function showNothingChoiceModal(state, onToken, onRepress) {
  const pending = state.pendingNothingChoice;
  if (!pending) return;

  const count = state.players.filter((p) => p.alive).length + 6;
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");

  body.innerHTML = `
    <div class="nothing-choice-modal">
      <h2>The Nothing</h2>
      <p class="death-choice-lead">Must resolve immediately when drawn.</p>
      <div class="utility-actions landscape-action-choices">
        <button type="button" class="btn primary" id="nothing-choice-token">
          Lose 1 Power Token
        </button>
        <button type="button" class="btn" id="nothing-choice-repress">
          Repress Dreamers+6 (${count}) Psyche from top of Psyche deck
        </button>
      </div>
    </div>
  `;

  body.querySelector("#nothing-choice-token")?.addEventListener("click", () => {
    hideUtilityModal(true);
    onToken?.();
  });
  body.querySelector("#nothing-choice-repress")?.addEventListener("click", () => {
    hideUtilityModal(true);
    onRepress?.();
  });
  modal.classList.remove("hidden");
}

export function showDeathChoiceModal(state, onAvoid, onAccept) {
  const pending = state.pendingDeathChoice;
  if (!pending) return;

  const player = state.players.find((p) => p.id === pending.playerId);
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const deaths = player?.deathCount || 0;

  body.innerHTML = `
    <div class="death-choice-modal">
      <h2>${player?.name || "Dreamer"} has no Psyche</h2>
      <p>Deaths this game: <strong>${deaths} / 5</strong></p>
      <p class="death-choice-lead">Spend Power Tokens to draw 1 Psyche and stay alive, or accept death and return to The Bed.</p>
      <div class="utility-actions landscape-action-choices">
        <button type="button" class="btn primary" id="death-choice-avoid">
          Spend ${pending.cost} Power Token${pending.cost === 1 ? "" : "s"} — draw 1 Psyche
        </button>
        <button type="button" class="btn" id="death-choice-accept">
          Accept death (lose objects &amp; Power, respawn with fewer Psyche)
        </button>
      </div>
    </div>
  `;

  body.querySelector("#death-choice-avoid")?.addEventListener("click", () => {
    hideUtilityModal(true);
    onAvoid?.();
  });
  body.querySelector("#death-choice-accept")?.addEventListener("click", () => {
    hideUtilityModal(true);
    onAccept?.();
  });
  modal.classList.remove("hidden");
}

export function showRespawnPicker(dreamers, onPick) {
  const body = document.getElementById("utility-modal-body");
  let selectedId = null;
  const cards = dreamers.map((dreamer) => ({ ...dreamer, type: "dreamer" }));

  body.innerHTML = cardChoiceShellHtml({
    title: "Choose a New Dreamer",
    message: "A Dreamer was lost. Pick an unused Dreamer to continue on The Bed.",
    statusText: "Select a Dreamer, then Confirm.",
    confirmLabel: "Confirm Dreamer",
  });
  prepareCardChoiceModal();

  const row = body.querySelector(".card-choice-row");
  const confirmBtn = body.querySelector("#card-choice-confirm");
  const statusEl = body.querySelector(".card-choice-status");

  const refresh = () => {
    row.querySelectorAll(".card-choice-wrap").forEach((wrap) => {
      wrap.querySelector(".game-card")?.classList.toggle("selected", wrap.dataset.cardId === selectedId);
    });
    const picked = dreamers.find((d) => d.id === selectedId);
    confirmBtn.disabled = !selectedId;
    statusEl.textContent = picked ? `Selected: ${picked.name}` : "Select a Dreamer, then Confirm.";
  };

  cards.forEach((card) => {
    mountChoicePickerCard(row, card, {
      cards,
      onSelect: () => {
        selectedId = card.id;
        refresh();
      },
    });
    const label = document.createElement("div");
    label.className = "card-choice-caption";
    label.textContent = card.name;
    row.lastElementChild?.appendChild(label);
  });
  refresh();

  confirmBtn?.addEventListener("click", () => {
    if (!selectedId) return;
    hideModal();
    hideUtilityModal(true);
    onPick(selectedId);
  });
}

export function showSubconsciousPicker(state, { onConfirm, onSkip } = {}) {
  const body = document.getElementById("utility-modal-body");
  const pending = state.pendingReturn;
  const need = pending?.remaining || 0;

  body.innerHTML = `
    <div class="card-choice-picker card-choice-picker-wide">
      <h2>Return from Subconscious</h2>
      <p class="card-choice-message">${pending?.reason || `Choose up to ${need} card(s) to Return to discard piles.`}</p>
      <p class="card-choice-hint">${CARD_CHOICE_HINT}</p>
      <div id="subconscious-piles" class="subconscious-piles card-choice-piles"></div>
      <p class="card-choice-status">Selected 0 / ${need}</p>
      <div class="utility-actions card-choice-actions">
        <button type="button" class="btn" id="return-skip">Return selected &amp; skip rest</button>
        <button type="button" class="btn primary" id="card-choice-confirm" disabled>Confirm Return</button>
      </div>
    </div>
  `;
  prepareCardChoiceModal();

  const container = body.querySelector("#subconscious-piles");
  const confirmBtn = body.querySelector("#card-choice-confirm");
  const statusEl = body.querySelector(".card-choice-status");
  const piles = subconsciousPilesForUI(state);
  const allCards = piles.flatMap((pile) => pile.cards);

  const refresh = () => {
    const picked = pending?.picked || [];
    container.querySelectorAll(".card-choice-wrap").forEach((wrap) => {
      const id = wrap.dataset.cardId;
      wrap.querySelector(".game-card")?.classList.toggle(
        "selected",
        picked.some((c) => c.instanceId === id),
      );
    });
    statusEl.textContent = `Selected ${picked.length} / ${need}`;
    confirmBtn.disabled = picked.length === 0;
  };

  if (!piles.length) {
    container.innerHTML = "<p class='resolution-empty'>The Subconscious is empty — nothing to Return.</p>";
    confirmBtn.disabled = true;
  } else {
    piles.forEach((pile) => {
      const section = document.createElement("div");
      section.className = "subconscious-pile";
      section.innerHTML = `<h4>${pile.icon || ""} ${pile.label} (${pile.cards.length})</h4>`;
      const row = document.createElement("div");
      row.className = "card-choice-row";
      pile.cards.forEach((card) => {
        mountChoicePickerCard(row, card, {
          cards: allCards,
          selected: pending?.picked.some((c) => c.instanceId === card.instanceId),
          onSelect: () => {
            toggleReturnPick(state, card.instanceId);
            refresh();
          },
        });
      });
      section.appendChild(row);
      container.appendChild(section);
    });
    refresh();
  }

  confirmBtn?.addEventListener("click", () => {
    hideModal();
    hideUtilityModal(true);
    completeReturnSelection(state);
    onConfirm?.();
  });
  body.querySelector("#return-skip")?.addEventListener("click", () => {
    hideModal();
    hideUtilityModal(true);
    onSkip?.();
  });
}

export function showRepressPicker(state, onPick, onConfirm) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const pending = state.pendingRepress;
  if (!pending) return;

  const collective = !!pending.collective;
  const player = collective ? null : state.players.find((p) => p.id === pending.playerId);
  const playerName = collective ? "All Dreamers" : (player?.name || "Dreamer");
  const sourceLabel = pending.source === "objects" ? "Objects" : "Psyche cards";
  const pool = collective
    ? state.players.filter((p) => p.alive).flatMap((p) => p.hand || [])
    : (pending.source === "objects" ? (player?.objects || []) : (player?.hand || []));
  const picked = pending.picked.length;
  const needed = pending.remaining;
  const isEmpty = pending.confirmEmpty;

  let instruction;
  if (isEmpty && needed <= 0) {
    instruction = "No cards to Repress for this effect.";
  } else if (isEmpty && pool.length === 0) {
    instruction = `No ${sourceLabel} available to Repress (${needed} required).`;
  } else {
    instruction = collective
      ? `Choose ${needed - picked} more Psyche from any hand (${picked}/${needed} selected).`
      : `Choose ${needed - picked} more ${sourceLabel} to Repress (${picked}/${needed} selected).`;
  }

  body.innerHTML = `
    <div class="card-choice-picker card-choice-picker-wide">
      <h2>Repress to Subconscious</h2>
      <p class="card-choice-message">${pending.reason || instruction}</p>
      <p class="resolution-player">${playerName}</p>
      <p class="resolution-instruction">${instruction}</p>
      <p class="card-choice-hint">${CARD_CHOICE_HINT}</p>
      <div id="repress-pool" class="subconscious-piles card-choice-piles"></div>
      <p class="card-choice-status">${picked}/${needed} repressed</p>
      <div class="utility-actions card-choice-actions">
        <button type="button" class="btn primary" id="repress-confirm">${isEmpty || pool.length === 0 ? "Continue" : picked >= needed ? "Done" : "Continue with selected"}</button>
      </div>
    </div>
  `;
  prepareCardChoiceModal();

  const container = body.querySelector("#repress-pool");
  const allCards = collective
    ? state.players.filter((p) => p.alive).flatMap((p) => p.hand || [])
    : pool;

  if (!pool.length) {
    container.innerHTML = "<p class='resolution-empty'>Nothing in hand to choose — click Continue.</p>";
  } else if (!isEmpty) {
    if (collective) {
      state.players.filter((p) => p.alive).forEach((p) => {
        if (!p.hand?.length) return;
        const section = document.createElement("div");
        section.className = "repress-player-section";
        section.innerHTML = `<h4>${p.name}</h4>`;
        const row = document.createElement("div");
        row.className = "card-choice-row";
        p.hand.forEach((card) => {
          mountChoicePickerCard(row, card, {
            cards: allCards,
            selected: pending.picked.some((c) => c.instanceId === card.instanceId),
            onSelect: () => onPick(card.instanceId),
          });
        });
        section.appendChild(row);
        container.appendChild(section);
      });
    } else {
      const row = document.createElement("div");
      row.className = "card-choice-row";
      pool.forEach((card) => {
        mountChoicePickerCard(row, card, {
          cards: allCards,
          selected: pending.picked.some((c) => c.instanceId === card.instanceId),
          onSelect: () => onPick(card.instanceId),
        });
      });
      container.appendChild(row);
    }
  }

  body.querySelector("#repress-confirm").addEventListener("click", () => {
    hideUtilityModal(true);
    onConfirm();
  });

  modal.classList.remove("hidden");
}

export function showSubconsciousBrowse(state, onCardClick) {
  const modal = document.getElementById("utility-modal");
  const content = modal?.querySelector(".utility-content");
  const body = document.getElementById("utility-modal-body");
  const count = subconsciousCount(state.subconscious);
  content?.classList.remove("rules-reference-modal", "dreamer-detail-modal");
  content?.classList.add("fullscreen-browser");
  body.innerHTML = `
    <header class="fullscreen-browser-header">
      <h2>☠ The Subconscious</h2>
      <p class="fullscreen-browser-lead">Face-up graveyard — all Repressed cards. Choose cards here when an effect lets you <strong>Return</strong> cards to play.</p>
      <p class="graveyard-total">${count} card${count === 1 ? "" : "s"} total</p>
    </header>
    <div id="subconscious-browse" class="subconscious-piles fullscreen-browser-body"></div>
  `;
  const container = body.querySelector("#subconscious-browse");
  subconsciousPilesForUI(state).forEach((pile) => {
    const section = document.createElement("div");
    section.className = "subconscious-pile gallery-pile";
    section.innerHTML = `<h4>${pile.label} <span class="gallery-pile-count">(${pile.cards.length})</span></h4>`;
    const row = document.createElement("div");
    row.className = "gallery-card-row";
    pile.cards.forEach((card) => {
      row.appendChild(renderCard(card, {
        dense: true,
        onClick: () => onCardClick(card),
      }));
    });
    section.appendChild(row);
    container.appendChild(section);
  });
  if (!container.children.length) {
    container.innerHTML = "<p class=\"dream-feed-empty\">Empty — no repressed cards.</p>";
  }
  modal.classList.remove("hidden");
}

export function hideUtilityModal(force = false) {
  if (utilityModalRequired && !force) {
    minimizeUtilityModal();
    return;
  }
  const modal = document.getElementById("utility-modal");
  modal?.classList.add("hidden");
  modal?.classList.remove("utility-modal-minimized", "utility-modal-required");
  document.body.classList.remove("utility-modal-open");
  utilityModalRequired = false;
  utilityModalMinimized = false;
  hideModal();
  syncUtilityChoiceDock();
  modal?.querySelector(".utility-content")?.classList.remove(
    "landscape-detail-modal",
    "dreamer-detail-modal",
    "dreamer-power-modal-wrap",
    "phase-skip-modal",
    "rules-reference-modal",
    "fullscreen-browser",
    "card-choice-modal-wrap",
    "somnia-changelog-modal-wrap",
  );
  const closeBtn = modal?.querySelector(".utility-close");
  if (closeBtn) closeBtn.hidden = false;
}

function formatDreamerFlavor(text) {
  if (!text) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function dreamerDetailStatsHtml(dreamer, state = null) {
  const lucidity = effectiveDreamerStat(state, dreamer, "lucidity");
  const elasticity = effectiveDreamerStat(state, dreamer, "elasticity");
  const willpower = effectiveDreamerStat(state, dreamer, "willpower");
  return `
    <div class="dreamer-detail-stats">
      <div class="dreamer-detail-stat suit-lucidity">
        ${suitIconHtml("lucidity", { size: 16 })}
        <span class="dreamer-detail-stat-label">${SUIT_LABELS.lucidity}</span>
        <strong>${lucidity}</strong>
      </div>
      <div class="dreamer-detail-stat suit-elasticity">
        ${suitIconHtml("elasticity", { size: 16 })}
        <span class="dreamer-detail-stat-label">${SUIT_LABELS.elasticity}</span>
        <strong>${elasticity}</strong>
      </div>
      <div class="dreamer-detail-stat suit-willpower">
        ${suitIconHtml("willpower", { size: 16 })}
        <span class="dreamer-detail-stat-label">${SUIT_LABELS.willpower}</span>
        <strong>${willpower}</strong>
      </div>
    </div>
  `;
}

function buildDreamerDetailHtml(dreamer, options = {}) {
  const { player, partySelected, playerSlot, setupHint, partyFull, focusHint } = options;
  const flavor = formatDreamerFlavor(dreamer.flavor || "");

  let statusLine = "";
  if (player) {
    const head = player.isHead ? "Head Dreamer ★ · " : "";
    const life = player.alive ? "Active" : "Lost in the Dream";
    const tokens = player.powerTokens ?? 0;
    const tokenLabel = tokens === 1 ? "Power Token" : "Power Tokens";
    statusLine = `<p class="dreamer-detail-status">${head}${life} · ${tokens} ${tokenLabel} held</p>`;
    if (focusHint) {
      statusLine += `<p class="dreamer-detail-status dreamer-detail-focus-hint">${focusHint}</p>`;
    }
  } else if (playerSlot) {
    statusLine = `<p class="dreamer-detail-status">Selected · Player ${playerSlot}</p>`;
  } else if (setupHint) {
    statusLine = `<p class="dreamer-detail-status">${setupHint}</p>`;
  } else if (partyFull) {
    statusLine = `<p class="dreamer-detail-status">Party full — click a selected Dreamer to remove</p>`;
  } else if (partySelected !== undefined) {
    statusLine = `<p class="dreamer-detail-status">${partySelected ? "Selected for this game" : "Not selected"}</p>`;
  }

  const affinity = DREAMER_KIND_AFFINITY[dreamer.id];
  const affinityLine = affinity
    ? `<p class="dreamer-detail-affinity">Meet bonus: +1 Psyche vs ${beastKindLabel(affinity)} Dreambeasts · +1 when ${SUIT_LABELS[dreamerPrimarySuit(dreamer)]} matches the Dreambeast's suit</p>`
    : "";

  const bodyHtml = `
    <div class="dreamer-detail-body">
      <h2>${dreamer.name}</h2>
      ${flavor ? `<blockquote class="dreamer-detail-flavor">${flavor}</blockquote>` : ""}
      ${statusLine}
      ${affinityLine}
      ${dreamerDetailStatsHtml(dreamer, options.state || null)}
      <div class="dreamer-detail-power">
        <div class="dreamer-detail-power-label">Dreamer Power</div>
        <p class="dreamer-detail-power-cost">Costs 1 Power Token</p>
        <p class="dreamer-detail-power-text">${dreamer.power}</p>
      </div>
    </div>
  `;

  if (options.textOnly) {
    return bodyHtml;
  }

  return `
    <div class="dreamer-detail">
      <div class="dreamer-detail-art-wrap">
        <img class="dreamer-detail-art" src="${dreamer.image}" alt="${dreamer.name}">
      </div>
      ${bodyHtml}
    </div>
  `;
}

let dreamerTooltipEl = null;
let dreamerTooltipAnchor = null;

function ensureDreamerDetailTooltip() {
  if (dreamerTooltipEl) return dreamerTooltipEl;
  dreamerTooltipEl = document.createElement("div");
  dreamerTooltipEl.id = "dreamer-detail-tooltip";
  dreamerTooltipEl.className = "dreamer-detail-tooltip hidden";
  dreamerTooltipEl.setAttribute("role", "tooltip");
  document.body.appendChild(dreamerTooltipEl);
  window.addEventListener("scroll", repositionDreamerDetailTooltip, true);
  window.addEventListener("resize", repositionDreamerDetailTooltip);
  return dreamerTooltipEl;
}

function repositionDreamerDetailTooltip() {
  if (!dreamerTooltipEl || dreamerTooltipEl.classList.contains("hidden") || !dreamerTooltipAnchor) return;
  positionDreamerDetailTooltip(dreamerTooltipEl, dreamerTooltipAnchor);
}

function positionDreamerDetailTooltip(tooltip, anchor) {
  const rect = anchor.getBoundingClientRect();
  const margin = 12;
  const tooltipRect = tooltip.getBoundingClientRect();
  const preferRight = rect.left < window.innerWidth * 0.45;
  let left = preferRight ? rect.right + margin : rect.left - tooltipRect.width - margin;
  let top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);

  if (preferRight && left + tooltipRect.width > window.innerWidth - margin) {
    left = rect.left - tooltipRect.width - margin;
  } else if (!preferRight && left < margin) {
    left = rect.right + margin;
  }
  if (top + tooltipRect.height > window.innerHeight - margin) {
    top = window.innerHeight - tooltipRect.height - margin;
  }
  if (top < margin) {
    top = margin;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

export function showDreamerDetailTooltip(dreamer, anchorEl, options = {}) {
  if (!dreamer || !anchorEl) return;
  const el = ensureDreamerDetailTooltip();
  dreamerTooltipAnchor = anchorEl;
  el.innerHTML = buildDreamerDetailHtml(dreamer, options);
  el.classList.remove("hidden");
  requestAnimationFrame(() => {
    positionDreamerDetailTooltip(el, anchorEl);
    requestAnimationFrame(() => positionDreamerDetailTooltip(el, anchorEl));
  });
}

export function hideDreamerDetailTooltip() {
  dreamerTooltipAnchor = null;
  dreamerTooltipEl?.classList.add("hidden");
}

let dreamerOverlayEl = null;

function ensureDreamerDetailOverlay() {
  if (dreamerOverlayEl) return dreamerOverlayEl;
  dreamerOverlayEl = document.createElement("div");
  dreamerOverlayEl.id = "dreamer-detail-overlay";
  dreamerOverlayEl.className = "dreamer-detail-overlay hidden";
  dreamerOverlayEl.setAttribute("role", "dialog");
  dreamerOverlayEl.setAttribute("aria-modal", "true");
  document.body.appendChild(dreamerOverlayEl);
  return dreamerOverlayEl;
}

export function showDreamerDetailOverlay(dreamer, options = {}) {
  if (!dreamer) return;
  hideDreamerDetailTooltip();
  const overlay = ensureDreamerDetailOverlay();
  overlay.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "dreamer-overlay-shell";

  const left = document.createElement("div");
  left.className = "dreamer-overlay-left";
  const artWrap = document.createElement("div");
  artWrap.className = "dreamer-overlay-art-wrap";
  const art = document.createElement("img");
  art.className = "dreamer-overlay-art";
  art.src = dreamer.image;
  art.alt = dreamer.name;
  artWrap.appendChild(art);
  left.appendChild(artWrap);

  const handWrap = document.createElement("div");
  handWrap.className = "dreamer-overlay-hand";
  const handTitle = document.createElement("h4");
  handTitle.textContent = "Psyche Hand";
  handWrap.appendChild(handTitle);
  const handRow = document.createElement("div");
  handRow.className = "dreamer-overlay-hand-cards";
  const player = options.player;
  if (player?.hand?.length) {
    player.hand.forEach((card) => {
      handRow.appendChild(renderCard(card, { dense: true, playerId: player.id }));
    });
  } else {
    handRow.innerHTML = "<p class=\"dream-feed-empty\">No Psyche in hand.</p>";
  }
  handWrap.appendChild(handRow);
  left.appendChild(handWrap);

  const right = document.createElement("div");
  right.className = "dreamer-overlay-right";
  right.innerHTML = buildDreamerDetailHtml(dreamer, { ...options, textOnly: true });

  shell.appendChild(left);
  shell.appendChild(right);
  overlay.appendChild(shell);
  overlay.classList.remove("hidden");
}

export function hideDreamerDetailOverlay() {
  dreamerOverlayEl?.classList.add("hidden");
}

export function showDreamerDetail(dreamer, options = {}) {
  if (!dreamer) return;

  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = buildDreamerDetailHtml(dreamer, options);
  modal.querySelector(".utility-content")?.classList.add("dreamer-detail-modal");
  modal.classList.remove("hidden");
}

function bindUtilityModalActions(body, { onCancel } = {}) {
  const modal = document.getElementById("utility-modal");
  const backdrop = modal?.querySelector(".utility-backdrop");
  const closeBtn = modal?.querySelector(".utility-close");
  const cancel = () => {
    if (utilityModalRequired) {
      minimizeUtilityModal();
      return;
    }
    hideUtilityModal(true);
    onCancel?.();
  };
  backdrop?.addEventListener("click", cancel, { once: true });
  closeBtn?.addEventListener("click", cancel, { once: true });
}

export function showPhaseSkipConfirm({ title, message, confirmLabel = "Continue", onConfirm, onCancel }) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `
    <div class="phase-skip-confirm">
      <h2>${title}</h2>
      <p>${message}</p>
      <div class="utility-actions">
        <button type="button" class="btn" id="phase-skip-cancel">Stay</button>
        <button type="button" class="btn primary" id="phase-skip-confirm">${confirmLabel}</button>
      </div>
    </div>
  `;
  modal.querySelector(".utility-content")?.classList.add("phase-skip-modal");
  body.querySelector("#phase-skip-cancel").addEventListener("click", () => {
    hideUtilityModal(true);
    onCancel?.();
  });
  body.querySelector("#phase-skip-confirm").addEventListener("click", () => {
    hideUtilityModal(true);
    onConfirm?.();
  });
  bindUtilityModalActions(body, { onCancel });
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");
}

export function showMeetDreambeastSkipConfirm({
  beastCount,
  roster = "",
  onRepressSouls,
  onConsumeTimeline,
  onCancel,
}) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const n = beastCount;
  body.innerHTML = `
    <div class="phase-skip-confirm meet-beast-skip">
      <h2>Dreambeasts remain</h2>
      <p>You're ending <strong>Meet</strong> without spending <strong>Willpower</strong> for shared actions.</p>
      <p><strong>${n} Dreambeast${n === 1 ? "" : "s"}</strong> still roam the Dreamscape${roster}. They hunger — pay the toll or they will <strong>consume the Timeline</strong> or <strong>consume your souls</strong>.</p>
      <div class="utility-actions phase-skip-choices">
        <button type="button" class="btn" id="meet-skip-cancel">Stay in Meet</button>
        <button type="button" class="btn" id="meet-skip-repress">Repress ${n} Psyche</button>
        <button type="button" class="btn primary" id="meet-skip-discard">Discard ${n} Dreams</button>
      </div>
    </div>
  `;
  modal.querySelector(".utility-content")?.classList.add("phase-skip-modal");
  body.querySelector("#meet-skip-cancel").addEventListener("click", () => {
    hideUtilityModal(true);
    onCancel?.();
  });
  body.querySelector("#meet-skip-repress").addEventListener("click", () => {
    hideUtilityModal(true);
    onRepressSouls?.();
  });
  body.querySelector("#meet-skip-discard").addEventListener("click", () => {
    hideUtilityModal(true);
    onConsumeTimeline?.();
  });
  bindUtilityModalActions(body, { onCancel });
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");
}

function mountLandscapeOccupantCard(container, card, caption, detailHtml = "") {
  const wrap = document.createElement("div");
  wrap.className = "landscape-detail-occupant-card landscape-detail-occupant-showcase";
  const el = renderCard(card, { portrait: true });
  el.tabIndex = -1;
  wrap.appendChild(el);
  if (caption) {
    const cap = document.createElement("div");
    cap.className = "landscape-detail-occupant-caption";
    cap.textContent = caption;
    wrap.appendChild(cap);
  }
  if (detailHtml) {
    const detail = document.createElement("div");
    detail.className = "landscape-detail-occupant-detail";
    detail.innerHTML = detailHtml;
    wrap.appendChild(detail);
  }
  container.appendChild(wrap);
}

function mountLandscapeOccupantColumn(container, label, entries) {
  const labelEl = document.createElement("div");
  labelEl.className = "landscape-detail-side-label";
  labelEl.textContent = label;
  container.appendChild(labelEl);

  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "landscape-detail-side-empty";
    empty.textContent = "None";
    container.appendChild(empty);
    return;
  }

  entries.forEach(({ card, caption, detailHtml }) => mountLandscapeOccupantCard(container, card, caption, detailHtml));
}

export function showLandscapeDetail(state, tileId) {
  const tile = state.board.find((t) => t.id === tileId);
  if (!tile) return;

  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const isBedFinal = tile.center && tile.finalRecurrenceSide;
  const showFace = tile.revealed && !tile.wasteland;
  const imageUrl = isBedFinal
    ? "images/dreams/final-recurrence.webp"
    : showFace && tile.image
      ? tile.image
      : tile.wastelandImage || "images/landscapes/wasteland.webp";

  const displayName = isBedFinal
    ? "The Bed — Final Recurrence"
    : showFace
      ? tile.name
      : "Wasteland";

  const suitLabel = showFace
    ? (tile.suit ? `${suitIconHtml(tile.suit, { size: 16 })} ${SUIT_LABELS[tile.suit]}` : "None (The Bed)")
    : "Hidden";

  const actions = getLandscapeActionSummary(tile);
  const actionRows = actions.length
    ? actions.map((action) => `
        <div class="landscape-detail-action">
          <div class="landscape-detail-action-label">Action ${action.letter}</div>
          <strong>${action.label}</strong>
          <p>${action.description || ""}</p>
        </div>
      `).join("")
    : `<p class="landscape-detail-muted">${showFace ? "No Meet actions available on this tile." : "Reveal this Landscape to see its actions."}</p>`;

  const dreamers = state.players.filter((p) => p.alive && p.landscapeId === tile.id);
  const dreamerEntries = dreamers.map((player) => ({
    card: { ...player.dreamer, type: "dreamer" },
    caption: `${player.name}${player.isHead ? " ★" : ""}`,
    detailHtml: `${dreamerStatsHtml(player.dreamer)}<div class="landscape-detail-occupant-meta">${(player.hand || []).length} Psyche · ${player.powerTokens || 0} Power</div>`,
  }));

  const beastEntries = [];
  tileEncounters(tile).forEach((enc) => {
    const rejectCost = encounterRejectCost(enc);
    const rejectSuit = enc.rejectSuit ? suitIconHtml(enc.rejectSuit, { size: 12 }) : "";
    const acceptSuit = enc.suit ? suitIconHtml(enc.suit, { size: 12 }) : "";
    beastEntries.push({
      card: { ...enc, type: enc.type || "dreambeast" },
      caption: enc.name,
      detailHtml: `
        <div class="landscape-detail-beast-cost accept"><strong>A${enc.accept}</strong> ${acceptSuit}<span>${encounterPayHint(enc, true)}</span></div>
        <div class="landscape-detail-beast-cost reject"><strong>R${rejectCost}</strong> ${rejectSuit}<span>${encounterPayHint(enc, false)}</span></div>
        ${enc.effect ? `<div class="landscape-detail-beast-effect"><strong>Effect:</strong> ${enc.effect}</div>` : ""}
        ${enc.flavor ? `<div class="landscape-detail-beast-flavor">${enc.flavor}</div>` : ""}
      `,
    });
  });
  if (tile.finalArchetype && !tile.finalArchetype.defeated) {
    const arch = tile.finalArchetype;
    beastEntries.push({
      card: { ...arch, type: "dreambeast" },
      caption: `${arch.name} (Archetype)`,
      detailHtml: `<div class="landscape-detail-beast-effect">Remaining Archetype on this Landscape.</div>`,
    });
  }

  body.innerHTML = "";
  const root = document.createElement("div");
  root.className = "landscape-detail";

  const stage = document.createElement("div");
  stage.className = "landscape-detail-stage";

  const dreamersCol = document.createElement("div");
  dreamersCol.className = "landscape-detail-dreamers";
  mountLandscapeOccupantColumn(dreamersCol, "Dreamers", dreamerEntries);

  const artWrap = document.createElement("div");
  artWrap.className = "landscape-detail-art-wrap";
  const art = document.createElement("img");
  art.className = "landscape-detail-art";
  art.src = imageUrl;
  art.alt = displayName;
  artWrap.appendChild(art);

  const beastsCol = document.createElement("div");
  beastsCol.className = "landscape-detail-beasts";
  mountLandscapeOccupantColumn(beastsCol, "Dreambeasts", beastEntries);

  stage.appendChild(dreamersCol);
  stage.appendChild(artWrap);
  stage.appendChild(beastsCol);
  root.appendChild(stage);

  const detailBody = document.createElement("div");
  detailBody.className = "landscape-detail-body";
  detailBody.innerHTML = `
    <h2>${displayName}</h2>
    <p class="landscape-detail-suit"><strong>Suit:</strong> ${suitLabel}</p>
    <div class="landscape-detail-actions">${actionRows}</div>
  `;
  root.appendChild(detailBody);
  body.appendChild(root);
  const shell = modal.querySelector(".utility-content");
  shell?.classList.remove(
    "fullscreen-browser",
    "dreamer-detail-modal",
    "dreamer-power-modal-wrap",
    "phase-skip-modal",
    "rules-reference-modal",
  );
  shell?.classList.add("landscape-detail-modal");
  modal.classList.remove("hidden");
  document.body.classList.add("utility-modal-open");
}

let tutorialHighlightEl = null;
let tutorialHighlightEls = [];
let tutorialSpotlightEls = [];
let tutorialSpotlightEl = null;
let tutorialSparkleLayer = null;
let tutorialSpotlightTracker = null;
let tutorialScrollBound = false;
let activeTutorialStep = null;
let lastUtilityModalSpotlightState = false;
const TUTORIAL_CONTINUE_DELAY_MS = 1800;
let tutorialContinueTimer = null;
let tutorialDelayState = null;

function clearTutorialContinueTimer() {
  if (!tutorialContinueTimer) return;
  clearInterval(tutorialContinueTimer);
  tutorialContinueTimer = null;
  tutorialDelayState = null;
}

function tutorialContinueLabel(stepIndex, total) {
  return stepIndex >= total - 1 ? "Finish" : "Continue";
}

function setTutorialProgress(stepIndex, total, roundLabel = null) {
  const progressEl = document.getElementById("tutorial-progress");
  const fillEl = document.getElementById("tutorial-progress-fill");
  const barEl = document.getElementById("tutorial-progress-bar");
  if (stepIndex == null || !total) return;
  const roundPart = roundLabel ? `Round ${roundLabel} · ` : "";
  if (progressEl) progressEl.textContent = `${roundPart}Step ${stepIndex + 1} / ${total}`;
  const pct = Math.round(((stepIndex + 1) / total) * 100);
  if (fillEl) fillEl.style.width = `${pct}%`;
  if (barEl) {
    barEl.setAttribute("aria-valuenow", String(stepIndex + 1));
    barEl.setAttribute("aria-valuemax", String(total));
    barEl.setAttribute("aria-valuemin", "1");
    barEl.setAttribute("aria-label", `Tutorial step ${stepIndex + 1} of ${total}`);
  }
}

function applyTutorialContinueDelay(btn, waiting, label) {
  const stateKey = `${waiting}:${label}`;
  if (
    tutorialContinueTimer
    && tutorialDelayState?.btn === btn
    && tutorialDelayState?.stateKey === stateKey
  ) {
    return;
  }

  clearTutorialContinueTimer();
  if (!btn) return;

  tutorialDelayState = { btn, stateKey };

  if (waiting) {
    btn.disabled = true;
    btn.textContent = label;
    return;
  }

  btn.disabled = true;
  const deadline = Date.now() + TUTORIAL_CONTINUE_DELAY_MS;
  const tick = () => {
    const leftMs = deadline - Date.now();
    if (leftMs > 0) {
      const leftSec = Math.max(1, Math.ceil(leftMs / 1000));
      btn.textContent = `${label} (${leftSec}s)`;
      btn.disabled = true;
      return;
    }
    btn.textContent = label;
    btn.disabled = false;
    clearTutorialContinueTimer();
  };

  tick();
  tutorialContinueTimer = setInterval(tick, 200);
}

function bindTutorialScrollRefresh() {
  if (tutorialScrollBound) return;
  tutorialScrollBound = true;
  document.getElementById("hand-bar")?.addEventListener("scroll", () => positionTutorialSpotlight(), { passive: true });
  window.addEventListener("resize", () => positionTutorialSpotlight(), { passive: true });
}

const SPARKLE_COUNT = 32;
const SPARKLE_JUMP_MS = 720;

function getStepTargetSelectors(step) {
  return getTutorialStepTargetSelectors(step);
}

const TUTORIAL_BOTTOM_SELECTORS = new Set([
  "#hand-bar", "#phase-actions", "#table-footer", "#dreamer-dock", "#player-list",
  "#btn-advance-phase", "#phase-advance-bar",
]);
const TUTORIAL_TOP_SELECTORS = new Set(["#phase-stepper", "#narrator-panel"]);
const TUTORIAL_BOARD_SELECTORS = new Set(["#board-viewport", "#hex-board", "#player-list", "#dreamer-dock"]);

function isUtilityModalOpen() {
  const modal = document.getElementById("utility-modal");
  return modal && !modal.classList.contains("hidden");
}

function getUtilityModalSpotlightEl() {
  return document.querySelector("#utility-modal .utility-content");
}

export function getSpotlightSelector(step) {
  return getTutorialSpotlightSelector(step, { utilityModalOpen: isUtilityModalOpen() });
}

function resolveTutorialElements(step) {
  return getStepTargetSelectors(step)
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
}

function resolvePrimarySpotlightElement(step) {
  const beat = step?.spotlightBeat;

  if (beat?.kind === "dreamerSelect" && beat.playerId) {
    return document.querySelector(`.hex-occupant-dreamer[data-dreamer-id="${beat.playerId}"]`)
      || document.querySelector(`.player-chip[data-player-id="${beat.playerId}"]`);
  }

  if (beat?.kind === "meetAccept") {
    return document.querySelector('.radial-menu-item.ready[data-tutorial-action="meetAccept"]')
      || document.querySelector(`${tutorialPhaseActionSelector("meetAccept")}:not(:disabled)`)
      || document.querySelector(tutorialPhaseActionSelector("meetAccept"))
      || document.querySelector('.hex-tile[data-tile-id="house"] .hex-occupant-beast');
  }

  if (beat?.kind === "drawDream"
    || beat?.kind === "revealLandscape"
    || beat?.kind === "spendElasticity"
    || beat?.kind === "gainMeetActions"
    || beat?.kind === "completeQuest0"
    || beat?.kind === "completeQuest1"
    || beat?.kind === "landscapeActionA") {
    const kind = beat.kind === "landscapeActionA" ? "landscapeActionA" : beat.kind;
    return document.querySelector(`${tutorialPhaseActionSelector(kind)}:not(:disabled)`)
      || document.querySelector(tutorialPhaseActionSelector(kind));
  }

  const spotlightSel = getSpotlightSelector(step);
  if (!spotlightSel) return null;

  if (spotlightSel.includes(",")) {
    for (const sel of spotlightSel.split(",").map((part) => part.trim())) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  return document.querySelector(spotlightSel);
}

function resolveSpotlightElements(step) {
  const el = resolvePrimarySpotlightElement(step);
  if (el) return [el];
  const beat = step?.spotlightBeat;
  if (beat?.kind && beat.kind !== "dreamerSelect") {
    return [];
  }
  return resolveTutorialElements(step);
}

function inferTutorialCardDock(step) {
  if (step?.cardDock) return step.cardDock;
  if (isUtilityModalOpen()) return "top";
  const selectors = getStepTargetSelectors(step);
  const spotlight = getSpotlightSelector(step);

  if (TUTORIAL_BOTTOM_SELECTORS.has(spotlight) || selectors.some((s) => TUTORIAL_BOTTOM_SELECTORS.has(s))) {
    return "top";
  }
  if (TUTORIAL_BOARD_SELECTORS.has(spotlight) || selectors.includes("#board-viewport")) {
    return "top";
  }
  if (TUTORIAL_TOP_SELECTORS.has(spotlight)) {
    return "bottom";
  }
  return "bottom";
}

const TUTORIAL_WINDOW_STORAGE_KEY = "somnia_tutorial_window_v2";
const TUTORIAL_WINDOW_MIN_WIDTH = 320;
const TUTORIAL_WINDOW_MIN_HEIGHT = 180;
const TUTORIAL_WINDOW_MARGIN = 12;

let tutorialWindowChromeReady = false;
let tutorialWindowState = null;
let tutorialWindowDrag = null;
let tutorialWindowResize = null;

function loadTutorialWindowState() {
  try {
    const raw = localStorage.getItem(TUTORIAL_WINDOW_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;
    if (!saved.userResized) saved.height = null;
    return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function saveTutorialWindowState() {
  if (!tutorialWindowState) return;
  try {
    localStorage.setItem(TUTORIAL_WINDOW_STORAGE_KEY, JSON.stringify(tutorialWindowState));
  } catch {
    /* ignore */
  }
}

function defaultTutorialWindowState() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(720, Math.max(420, Math.round(vw * 0.38)));
  return {
    left: TUTORIAL_WINDOW_MARGIN,
    top: TUTORIAL_WINDOW_MARGIN + 64,
    width,
    height: null,
    minimized: false,
    userPositioned: false,
    userResized: false,
  };
}

function clampTutorialWindowToViewport() {
  if (!tutorialWindowState) return;
  const card = document.getElementById("tutorial-card");
  if (!card) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const rect = card.getBoundingClientRect();
  const w = tutorialWindowState.width || rect.width;
  const h = tutorialWindowState.height || rect.height;

  tutorialWindowState.width = Math.min(
    Math.max(w, TUTORIAL_WINDOW_MIN_WIDTH),
    vw - TUTORIAL_WINDOW_MARGIN * 2,
  );

  if (tutorialWindowState.height != null) {
    tutorialWindowState.height = Math.min(
      Math.max(tutorialWindowState.height, TUTORIAL_WINDOW_MIN_HEIGHT),
      vh - TUTORIAL_WINDOW_MARGIN * 2,
    );
  }

  const maxLeft = vw - tutorialWindowState.width - TUTORIAL_WINDOW_MARGIN;
  const maxTop = vh - (tutorialWindowState.height || rect.height) - TUTORIAL_WINDOW_MARGIN;
  tutorialWindowState.left = Math.min(
    Math.max(tutorialWindowState.left, TUTORIAL_WINDOW_MARGIN),
    maxLeft,
  );
  tutorialWindowState.top = Math.min(
    Math.max(tutorialWindowState.top, TUTORIAL_WINDOW_MARGIN),
    maxTop,
  );
}

function measureTutorialBarHeight() {
  const header = document.getElementById("tutorial-card-header");
  return Math.max(40, Math.ceil(header?.getBoundingClientRect().height || 40));
}

function updateTutorialHeaderLabel(step, stepIndex, total, roundLabel = null) {
  const label = document.getElementById("tutorial-card-drag-label");
  if (!label) return;
  if (!step) {
    label.textContent = "Tutorial Guide";
    label.title = "";
    return;
  }
  const roundPart = roundLabel ? `Round ${roundLabel} · ` : "";
  const progress = stepIndex != null && total ? `Step ${stepIndex + 1}/${total} · ` : "";
  const shortTitle = step.title.length > 36 ? `${step.title.slice(0, 34)}…` : step.title;
  if (tutorialWindowState?.minimized) {
    label.textContent = `${progress}${shortTitle}`;
  } else {
    label.textContent = "Tutorial Guide";
  }
  label.title = `${roundPart}${step.title}`;
}

function applyTutorialWindowGeometry() {
  const card = document.getElementById("tutorial-card");
  if (!card || !tutorialWindowState) return;

  card.classList.toggle("tutorial-minimized", !!tutorialWindowState.minimized);
  card.setAttribute("aria-expanded", tutorialWindowState.minimized ? "false" : "true");

  card.style.left = `${tutorialWindowState.left}px`;
  card.style.top = `${tutorialWindowState.top}px`;
  card.style.bottom = "auto";
  card.style.right = "auto";

  const minimizeBtn = document.getElementById("tutorial-minimize");
  const expandBtn = document.getElementById("tutorial-expand");
  const resizeHandle = document.getElementById("tutorial-resize-handle");
  minimizeBtn?.classList.toggle("hidden", !!tutorialWindowState.minimized);
  expandBtn?.classList.toggle("hidden", !tutorialWindowState.minimized);
  resizeHandle?.classList.toggle("hidden", !!tutorialWindowState.minimized);

  if (tutorialWindowState.minimized) {
    const barHeight = measureTutorialBarHeight();
    card.style.width = `${tutorialWindowState.width}px`;
    card.style.height = `${barHeight}px`;
    card.style.minHeight = `${barHeight}px`;
    card.style.maxHeight = `${barHeight}px`;
    card.classList.remove("tutorial-card-sized");
    return;
  }

  card.style.minHeight = "";
  card.style.maxHeight = "";
  card.style.width = `${tutorialWindowState.width}px`;

  if (tutorialWindowState.userResized && tutorialWindowState.height != null) {
    card.style.height = `${tutorialWindowState.height}px`;
    card.classList.add("tutorial-card-sized");
  } else {
    card.style.height = "auto";
    card.classList.remove("tutorial-card-sized");
  }
}

function ensureTutorialWindowState() {
  if (!tutorialWindowState) {
    tutorialWindowState = loadTutorialWindowState() || defaultTutorialWindowState();
  }
  if (!tutorialWindowState.userResized) tutorialWindowState.height = null;
  clampTutorialWindowToViewport();
  applyTutorialWindowGeometry();
}

function setTutorialMinimized(minimized) {
  ensureTutorialWindowState();
  if (!tutorialWindowState) return;

  if (minimized && !tutorialWindowState.minimized) {
    const card = document.getElementById("tutorial-card");
    const rect = card?.getBoundingClientRect();
    tutorialWindowState.savedWidth = tutorialWindowState.width;
    tutorialWindowState.savedHeight = tutorialWindowState.height;
    const barWidth = Math.min(
      Math.max(280, Math.round((rect?.width || tutorialWindowState.width) * 0.55)),
      420,
    );
    tutorialWindowState.width = barWidth;
  } else if (!minimized && tutorialWindowState.minimized) {
    if (tutorialWindowState.savedWidth != null) {
      tutorialWindowState.width = tutorialWindowState.savedWidth;
    }
    if (tutorialWindowState.savedHeight != null) {
      tutorialWindowState.height = tutorialWindowState.savedHeight;
    }
  }

  tutorialWindowState.minimized = minimized;
  saveTutorialWindowState();
  applyTutorialWindowGeometry();

  if (activeTutorialStep) {
    const progressText = document.getElementById("tutorial-progress")?.textContent || "";
    const roundLabel = progressText.match(/Round (\d+)/)?.[1] || null;
    const progressMatch = progressText.match(/Step (\d+) \/ (\d+)/);
    const stepIndex = progressMatch ? parseInt(progressMatch[1], 10) - 1 : null;
    const total = progressMatch ? parseInt(progressMatch[2], 10) : null;
    updateTutorialHeaderLabel(activeTutorialStep, stepIndex, total, roundLabel);
  } else {
    updateTutorialHeaderLabel(null);
  }
}

function onTutorialWindowPointerMove(e) {
  const card = document.getElementById("tutorial-card");
  if (!card) return;

  if (tutorialWindowDrag) {
    const dx = e.clientX - tutorialWindowDrag.startX;
    const dy = e.clientY - tutorialWindowDrag.startY;
    tutorialWindowState.left = tutorialWindowDrag.origLeft + dx;
    tutorialWindowState.top = tutorialWindowDrag.origTop + dy;
    tutorialWindowState.userPositioned = true;
    clampTutorialWindowToViewport();
    applyTutorialWindowGeometry();
  }

  if (tutorialWindowResize) {
    const dx = e.clientX - tutorialWindowResize.startX;
    const dy = e.clientY - tutorialWindowResize.startY;
    tutorialWindowState.width = tutorialWindowResize.origWidth + dx;
    tutorialWindowState.height = tutorialWindowResize.origHeight + dy;
    tutorialWindowState.userResized = true;
    tutorialWindowState.userPositioned = true;
    clampTutorialWindowToViewport();
    applyTutorialWindowGeometry();
  }
}

function endTutorialWindowPointer() {
  if (!tutorialWindowDrag && !tutorialWindowResize) return;
  const card = document.getElementById("tutorial-card");
  card?.classList.remove("is-dragging", "is-resizing");
  if (tutorialWindowDrag || tutorialWindowResize) {
    saveTutorialWindowState();
  }
  tutorialWindowDrag = null;
  tutorialWindowResize = null;
}

function rectsOverlap(a, b, pad = 12) {
  if (!a || !b) return false;
  return !(
    a.right + pad < b.left
    || a.left - pad > b.right
    || a.bottom + pad < b.top
    || a.top - pad > b.bottom
  );
}

function isAdvanceButtonTutorialStep(step) {
  const selectors = getStepTargetSelectors(step);
  const spotlight = getSpotlightSelector(step);
  return spotlight === "#btn-advance-phase"
    || selectors.includes("#btn-advance-phase")
    || selectors.includes("#phase-advance-bar");
}

function suggestTutorialWindowPosition(step) {
  if (!tutorialWindowState) return;
  const card = document.getElementById("tutorial-card");
  if (!card) return;

  const spotlightRect = getTutorialSpotlightRect();
  const mustClearAdvance = isAdvanceButtonTutorialStep(step);
  if (tutorialWindowState.userPositioned && !mustClearAdvance) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  tutorialWindowState.width = Math.min(
    Math.max(tutorialWindowState.width, TUTORIAL_WINDOW_MIN_WIDTH),
    Math.round(vw * 0.36),
    560,
  );

  const reservedBottom = mustClearAdvance ? Math.round(vh * 0.42) : 0;
  const maxCardH = Math.max(
    TUTORIAL_WINDOW_MIN_HEIGHT,
    vh - TUTORIAL_WINDOW_MARGIN * 2 - reservedBottom,
  );
  if (mustClearAdvance && tutorialWindowState.height != null) {
    tutorialWindowState.height = Math.min(tutorialWindowState.height, maxCardH);
  }

  applyTutorialWindowGeometry();

  const measured = card.getBoundingClientRect();
  let cardH = tutorialWindowState.height || measured.height || 280;
  if (mustClearAdvance && cardH > maxCardH) {
    tutorialWindowState.height = maxCardH;
    applyTutorialWindowGeometry();
    cardH = maxCardH;
  }
  const cardW = tutorialWindowState.width;
  const topY = TUTORIAL_WINDOW_MARGIN + 8;
  const bottomY = Math.max(TUTORIAL_WINDOW_MARGIN, vh - cardH - TUTORIAL_WINDOW_MARGIN);
  const leftX = TUTORIAL_WINDOW_MARGIN;
  const rightX = Math.max(TUTORIAL_WINDOW_MARGIN, vw - cardW - TUTORIAL_WINDOW_MARGIN);
  const midY = Math.max(topY, Math.round((vh - cardH) / 2));
  const dock = inferTutorialCardDock(step);

  const candidates = dock === "top" || mustClearAdvance
    ? [
      { left: leftX, top: topY },
      { left: rightX, top: topY },
      { left: leftX, top: midY },
    ]
    : [
      { left: leftX, top: midY },
      { left: leftX, top: topY },
      { left: rightX, top: topY },
      { left: leftX, top: bottomY },
    ];

  const pick = candidates.find((pos) => {
    const box = {
      left: pos.left,
      top: pos.top,
      right: pos.left + cardW,
      bottom: pos.top + cardH,
    };
    return !rectsOverlap(box, spotlightRect, 18);
  }) || candidates[0];

  if (tutorialWindowState.userPositioned) {
    const current = {
      left: tutorialWindowState.left,
      top: tutorialWindowState.top,
      right: tutorialWindowState.left + cardW,
      bottom: tutorialWindowState.top + cardH,
    };
    if (!rectsOverlap(current, spotlightRect, 18)) return;
  }

  tutorialWindowState.left = pick.left;
  tutorialWindowState.top = pick.top;
  clampTutorialWindowToViewport();
  applyTutorialWindowGeometry();
  if (mustClearAdvance) {
    card.style.maxHeight = `${maxCardH}px`;
  }
}

function ensureTutorialWindowChrome() {
  if (tutorialWindowChromeReady) return;
  tutorialWindowChromeReady = true;

  const header = document.getElementById("tutorial-card-header");
  const resizeHandle = document.getElementById("tutorial-resize-handle");
  const minimizeBtn = document.getElementById("tutorial-minimize");
  const expandBtn = document.getElementById("tutorial-expand");
  const card = document.getElementById("tutorial-card");

  header?.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    ensureTutorialWindowState();
    const rect = card.getBoundingClientRect();
    tutorialWindowDrag = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: rect.left,
      origTop: rect.top,
    };
    card.classList.add("is-dragging");
    header.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  header?.addEventListener("pointermove", onTutorialWindowPointerMove);
  header?.addEventListener("pointerup", endTutorialWindowPointer);
  header?.addEventListener("pointercancel", endTutorialWindowPointer);

  resizeHandle?.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ensureTutorialWindowState();
    if (tutorialWindowState.minimized) return;
    const rect = card.getBoundingClientRect();
    tutorialWindowState.height = rect.height;
    tutorialWindowState.userResized = true;
    tutorialWindowResize = {
      startX: e.clientX,
      startY: e.clientY,
      origWidth: rect.width,
      origHeight: rect.height,
    };
    card.classList.add("is-resizing");
    resizeHandle.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });

  resizeHandle?.addEventListener("pointermove", onTutorialWindowPointerMove);
  resizeHandle?.addEventListener("pointerup", endTutorialWindowPointer);
  resizeHandle?.addEventListener("pointercancel", endTutorialWindowPointer);

  minimizeBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setTutorialMinimized(true);
  });

  expandBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    setTutorialMinimized(false);
  });

  window.addEventListener("resize", () => {
    if (!tutorialWindowState) return;
    clampTutorialWindowToViewport();
    applyTutorialWindowGeometry();
  });
}

function positionTutorialCard(step) {
  ensureTutorialWindowChrome();
  ensureTutorialWindowState();
  if (step) suggestTutorialWindowPosition(step);
}

function populateTutorialJumpMenu(stepIndex, onJump) {
  const select = document.getElementById("tutorial-jump");
  if (!select) return;
  select.innerHTML = TUTORIAL_SECTIONS.map((section) =>
    `<option value="${section.stepIndex}">${section.label}</option>`).join("");
  const active = TUTORIAL_SECTIONS.find((s) => s.stepIndex === stepIndex)
    || [...TUTORIAL_SECTIONS].reverse().find((s) => s.stepIndex <= stepIndex)
    || TUTORIAL_SECTIONS[0];
  select.value = String(active.stepIndex);
  select.onchange = () => {
    const target = parseInt(select.value, 10);
    if (!Number.isNaN(target) && target !== stepIndex) onJump?.(target);
    else select.value = String(active.stepIndex);
  };
}

export function ensureTutorialStepTargetsVisible(step) {
  const selectors = getStepTargetSelectors(step);
  const spotlight = getSpotlightSelector(step);
  if (
    selectors.some((s) => s === "#btn-advance-phase" || s === "#phase-advance-bar")
    || spotlight === "#btn-advance-phase"
  ) {
    document.getElementById("btn-advance-phase")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  if (selectors.some((s) => s === "#player-list" || s === "#dreamer-dock")) {
    document.getElementById("dreamer-dock")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function unionElementRects(elements) {
  if (!elements.length) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  elements.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) return;
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  if (!Number.isFinite(left)) return null;
  return {
    left,
    top,
    width: Math.max(right - left, 48),
    height: Math.max(bottom - top, 48),
    right,
    bottom,
  };
}

function ensureTutorialSparkleLayer() {
  if (tutorialSparkleLayer) return tutorialSparkleLayer;

  tutorialSparkleLayer = document.createElement("div");
  tutorialSparkleLayer.id = "tutorial-sparkle-layer";
  tutorialSparkleLayer.className = "tutorial-sparkle-layer";
  tutorialSparkleLayer.setAttribute("aria-hidden", "true");

  tutorialSpotlightEl = document.createElement("div");
  tutorialSpotlightEl.className = "tutorial-spotlight hidden";
  tutorialSpotlightEl.innerHTML = `
    <div class="tutorial-spotlight-glow"></div>
    <div class="tutorial-spotlight-glow tutorial-spotlight-glow-alt"></div>
    <div class="tutorial-spotlight-ring"></div>
    <div class="tutorial-spotlight-sparkles"></div>
  `;
  tutorialSpotlightEl.style.setProperty("--sparkle-count", String(SPARKLE_COUNT));
  const sparkleHost = tutorialSpotlightEl.querySelector(".tutorial-spotlight-sparkles");
  for (let i = 0; i < SPARKLE_COUNT; i += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "tutorial-sparkle";
    sparkle.style.setProperty("--sparkle-i", String(i));
    sparkle.innerHTML = `
      <span class="tutorial-sparkle-rays" aria-hidden="true"></span>
      <span class="tutorial-sparkle-star" aria-hidden="true">✦</span>
    `;
    sparkleHost.appendChild(sparkle);
  }

  const flyer = document.createElement("div");
  flyer.id = "tutorial-flyer";
  flyer.className = "tutorial-flyer hidden";
  flyer.innerHTML = `
    <span class="tutorial-flyer-trail"></span>
    <span class="tutorial-flyer-core">✦</span>
  `;

  tutorialSparkleLayer.append(tutorialSpotlightEl, flyer);
  document.body.appendChild(tutorialSparkleLayer);
  return tutorialSparkleLayer;
}

function rectCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function bezierPoint(t, p0, p1, p2) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function stopTutorialSpotlightTracker() {
  if (tutorialSpotlightTracker) {
    tutorialSpotlightTracker.disconnect();
    tutorialSpotlightTracker = null;
  }
  window.removeEventListener("resize", positionTutorialSpotlight);
  window.removeEventListener("scroll", positionTutorialSpotlight, true);
}

function positionTutorialSpotlight() {
  if (!tutorialSpotlightEl) return;
  const elements = tutorialSpotlightEls.length
    ? tutorialSpotlightEls
    : (tutorialHighlightEls.length
      ? tutorialHighlightEls
      : (tutorialHighlightEl ? [tutorialHighlightEl] : []));
  if (!elements.length) return;

  const union = unionElementRects(elements);
  if (!union) return;

  const pad = 12;
  tutorialSpotlightEl.style.left = `${union.left - pad}px`;
  tutorialSpotlightEl.style.top = `${union.top - pad}px`;
  tutorialSpotlightEl.style.width = `${Math.max(union.width + pad * 2, 56)}px`;
  tutorialSpotlightEl.style.height = `${Math.max(union.height + pad * 2, 56)}px`;
  const orbit = Math.max(union.width, union.height) / 2 + pad + 8;
  tutorialSpotlightEl.style.setProperty("--orbit-r", `${orbit}px`);
}

function startTutorialSpotlightTracker() {
  stopTutorialSpotlightTracker();
  const elements = tutorialSpotlightEls.length
    ? tutorialSpotlightEls
    : (tutorialHighlightEls.length
      ? tutorialHighlightEls
      : (tutorialHighlightEl ? [tutorialHighlightEl] : []));
  if (!elements.length) return;
  positionTutorialSpotlight();
  if (typeof ResizeObserver !== "undefined") {
    tutorialSpotlightTracker = new ResizeObserver(() => positionTutorialSpotlight());
    elements.forEach((el) => {
      tutorialSpotlightTracker.observe(el);
    });
  }
  window.addEventListener("resize", positionTutorialSpotlight);
  window.addEventListener("scroll", positionTutorialSpotlight, true);
}

export function refreshTutorialSpotlight() {
  const modalOpen = isUtilityModalOpen();
  if (activeTutorialStep && modalOpen !== lastUtilityModalSpotlightState) {
    applyTutorialHighlight(activeTutorialStep, { animateIn: false });
  }
  lastUtilityModalSpotlightState = modalOpen;
  positionTutorialSpotlight();
}

export function getTutorialSpotlightRect() {
  const elements = tutorialSpotlightEls.length
    ? tutorialSpotlightEls
    : (tutorialHighlightEls.length
      ? tutorialHighlightEls
      : (tutorialHighlightEl ? [tutorialHighlightEl] : []));
  const union = unionElementRects(elements);
  if (union) {
    return {
      left: union.left,
      top: union.top,
      width: union.width,
      height: union.height,
      right: union.right,
      bottom: union.bottom,
    };
  }
  if (tutorialSpotlightEl && !tutorialSpotlightEl.classList.contains("hidden")) {
    return tutorialSpotlightEl.getBoundingClientRect();
  }
  return null;
}

export function applyTutorialHighlight(stepOrTarget, { animateIn = true } = {}) {
  ensureTutorialSparkleLayer();
  clearTutorialHighlight({ keepLayer: true });

  const step = typeof stepOrTarget === "object" && stepOrTarget !== null && !stepOrTarget.nodeType
    ? stepOrTarget
    : null;
  const targets = step
    ? resolveTutorialElements(step)
    : (stepOrTarget ? [stepOrTarget].flat().filter(Boolean) : []);
  const spotlightTargets = step
    ? resolveSpotlightElements(step)
    : targets;
  const highlightTargets = isUtilityModalOpen()
    ? []
    : (spotlightTargets.length ? spotlightTargets : targets);

  if (step) ensureTutorialStepTargetsVisible(step);

  if (!spotlightTargets.length && !highlightTargets.length) {
    tutorialSpotlightEls = [];
    tutorialSpotlightEl?.classList.add("hidden");
    stopTutorialSpotlightTracker();
    return;
  }

  highlightTargets.forEach((el) => el.classList.add("tutorial-highlight"));
  tutorialHighlightEls = highlightTargets;
  tutorialHighlightEl = highlightTargets[0] || null;
  tutorialSpotlightEls = spotlightTargets.length ? spotlightTargets : highlightTargets;
  tutorialSpotlightEl.classList.remove("hidden", "tutorial-spotlight-arriving");
  bindTutorialScrollRefresh();
  positionTutorialSpotlight();
  startTutorialSpotlightTracker();
  if (step) positionTutorialCard(step);

  if (animateIn) {
    tutorialSpotlightEl.classList.add("tutorial-spotlight-arriving");
    window.setTimeout(() => {
      tutorialSpotlightEl?.classList.remove("tutorial-spotlight-arriving");
    }, 520);
  }

  const scrollEl = tutorialSpotlightEls[0] || highlightTargets[0];
  if (scrollEl) {
    scrollEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function animateTutorialSparkleJump(fromRect, step, onComplete) {
  ensureTutorialSparkleLayer();
  const flyer = document.getElementById("tutorial-flyer");
  const targets = step ? resolveTutorialElements(step) : [];
  const spotlightTargets = step ? resolveSpotlightElements(step) : targets;
  const toTarget = spotlightTargets[0] || targets[0] || null;
  if (!flyer || !toTarget) {
    applyTutorialHighlight(step || toTarget, { animateIn: true });
    onComplete?.();
    return;
  }

  if (step) ensureTutorialStepTargetsVisible(step);

  const union = unionElementRects(spotlightTargets.length ? spotlightTargets : targets);
  const toRect = union || toTarget.getBoundingClientRect();
  const from = rectCenter(fromRect);
  const to = rectCenter(toRect);
  const arcLift = Math.min(220, Math.max(72, Math.abs(to.x - from.x) * 0.22 + Math.abs(to.y - from.y) * 0.12));
  const control = {
    x: (from.x + to.x) / 2,
    y: Math.min(from.y, to.y) - arcLift,
  };

  tutorialSpotlightEl.classList.add("tutorial-spotlight-traveling");
  flyer.classList.remove("hidden");
  flyer.classList.add("tutorial-flyer-active");

  const start = performance.now();

  const frame = (now) => {
    const raw = Math.min(1, (now - start) / SPARKLE_JUMP_MS);
    const eased = 1 - Math.pow(1 - raw, 3);
    const point = bezierPoint(eased, from, control, to);
    const scale = 0.85 + Math.sin(eased * Math.PI) * 0.55;
    flyer.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${scale})`;

    if (raw < 1) {
      requestAnimationFrame(frame);
      return;
    }

    flyer.classList.remove("tutorial-flyer-active");
    flyer.classList.add("hidden");
    applyTutorialHighlight(step, { animateIn: true });
    tutorialSpotlightEl.classList.remove("tutorial-spotlight-traveling");
    onComplete?.();
  };

  requestAnimationFrame(frame);
}

function clearTutorialHighlight({ keepLayer = false } = {}) {
  tutorialHighlightEls.forEach((el) => el.classList.remove("tutorial-highlight"));
  tutorialHighlightEls = [];
  tutorialSpotlightEls = [];
  if (tutorialHighlightEl) {
    tutorialHighlightEl.classList.remove("tutorial-highlight");
    tutorialHighlightEl = null;
  }
  if (!keepLayer) {
    tutorialSpotlightEl?.classList.add("hidden");
    document.getElementById("tutorial-flyer")?.classList.add("hidden");
    stopTutorialSpotlightTracker();
  }
}

export function updateTutorialStepUI({
  step,
  stepIndex,
  total,
  canAdvance,
  roundLabel = null,
  objective = "",
}) {
  const overlay = document.getElementById("tutorial-overlay");
  if (!overlay || overlay.classList.contains("hidden")) return;

  const waiting = step?.until && !canAdvance;
  const nextBtn = document.getElementById("tutorial-next");
  const label = tutorialContinueLabel(stepIndex, total);
  applyTutorialContinueDelay(nextBtn, waiting, label);

  const backBtn = document.getElementById("tutorial-back");
  if (backBtn) backBtn.disabled = stepIndex <= 0;

  const card = overlay.querySelector(".tutorial-card");
  card?.classList.toggle("tutorial-waiting", waiting);

  let hintEl = card?.querySelector(".tutorial-next-hint");
  if (!hintEl && card) {
    hintEl = document.createElement("p");
    hintEl.className = "tutorial-next-hint";
    card.querySelector("p")?.after(hintEl);
  }
  if (hintEl) {
    hintEl.innerHTML = waiting && objective
      ? `<strong>Objective:</strong> ${objective}`
      : (objective && !step?.until
        ? `<strong>Tip:</strong> ${objective}`
        : (canAdvance && step?.until ? "Objective complete — press Continue." : ""));
  }

  if (step && stepIndex != null && total) {
    setTutorialProgress(stepIndex, total, roundLabel);
  }
  if (step) {
    updateTutorialHeaderLabel(step, stepIndex, total, roundLabel);
    positionTutorialCard(step);
    applyTutorialHighlight(step, { animateIn: false });
  } else {
    applyTutorialWindowGeometry();
  }
}

export function showTutorialStep(step, stepIndex, total, {
  onNext,
  onSkip,
  onBack,
  onJump,
  canAdvance = true,
  roundLabel = null,
  fromRect = null,
  objective = "",
}) {
  const overlay = document.getElementById("tutorial-overlay");
  if (!overlay) return;

  activeTutorialStep = step;
  const waiting = step.until && !canAdvance;
  document.getElementById("tutorial-title").textContent = step.title;
  document.getElementById("tutorial-body").textContent = step.body;
  setTutorialProgress(stepIndex, total, roundLabel);
  const nextBtn = document.getElementById("tutorial-next");
  const backBtn = document.getElementById("tutorial-back");
  const label = tutorialContinueLabel(stepIndex, total);

  const card = overlay.querySelector(".tutorial-card");
  card?.classList.toggle("tutorial-waiting", waiting);
  let hintEl = card?.querySelector(".tutorial-next-hint");
  if (!hintEl && card) {
    hintEl = document.createElement("p");
    hintEl.className = "tutorial-next-hint";
    card.querySelector("p")?.after(hintEl);
  }
  if (hintEl) {
    hintEl.innerHTML = waiting && objective
      ? `<strong>Objective:</strong> ${objective}`
      : (objective && !step.until
        ? `<strong>Tip:</strong> ${objective}`
        : (canAdvance && step.until ? "Objective complete." : ""));
  }

  populateTutorialJumpMenu(stepIndex, onJump);
  updateTutorialHeaderLabel(step, stepIndex, total, roundLabel);

  clearTutorialHighlight({ keepLayer: !!fromRect });
  ensureTutorialStepTargetsVisible(step);
  const targets = resolveTutorialElements(step);

  if (fromRect && targets.length && fromRect.width > 0 && fromRect.height > 0) {
    animateTutorialSparkleJump(fromRect, step);
  } else {
    applyTutorialHighlight(step, { animateIn: true });
  }

  const skipBtn = document.getElementById("tutorial-skip");
  const backdrop = overlay.querySelector(".tutorial-backdrop");

  const cleanup = () => {
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    skipBtn?.replaceWith(skipBtn.cloneNode(true));
    backBtn?.replaceWith(backBtn.cloneNode(true));
    backdrop?.replaceWith(backdrop.cloneNode(true));
  };

  cleanup();
  const freshNext = document.getElementById("tutorial-next");
  const freshSkip = document.getElementById("tutorial-skip");
  const freshBack = document.getElementById("tutorial-back");

  if (freshBack) freshBack.disabled = stepIndex <= 0;
  applyTutorialContinueDelay(freshNext, waiting, label);

  freshNext.addEventListener("click", () => {
    if (freshNext.disabled) return;
    clearTutorialContinueTimer();
    onNext?.();
  });
  freshSkip.addEventListener("click", onSkip);
  freshBack?.addEventListener("click", () => {
    if (freshBack.disabled) return;
    clearTutorialContinueTimer();
    onBack?.();
  });

  overlay.classList.remove("hidden");
  positionTutorialCard(step);
}

export function hideTutorial() {
  activeTutorialStep = null;
  lastUtilityModalSpotlightState = false;
  clearTutorialContinueTimer();
  clearTutorialHighlight();
  document.getElementById("tutorial-sparkle-layer")?.remove();
  tutorialSparkleLayer = null;
  tutorialSpotlightEl = null;
  document.getElementById("tutorial-overlay")?.classList.add("hidden");
}

export function showTutorialBrief(html, onBegin) {
  const modal = document.getElementById("tutorial-brief");
  const body = document.getElementById("tutorial-brief-body");
  const beginBtn = document.getElementById("tutorial-brief-begin");
  if (!modal || !body || !beginBtn) {
    onBegin?.();
    return;
  }
  body.innerHTML = html;
  modal.classList.remove("hidden");
  const handler = () => {
    beginBtn.removeEventListener("click", handler);
    modal.classList.add("hidden");
    onBegin?.();
  };
  beginBtn.addEventListener("click", handler);
}

export function hideTutorialBrief() {
  document.getElementById("tutorial-brief")?.classList.add("hidden");
}

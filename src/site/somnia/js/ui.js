import { getPhase, activePlayer, headPlayer } from "./state.js";
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
} from "./rules.js";
import { DREAMER_KIND_AFFINITY, beastKindLabel, dreamerPrimarySuit } from "./dreambeasts.js";
import { handLimitForPlayer, handRoomForPsycheDraw } from "./objects.js";
import { psycheHandCount, alliesInHand, psycheCardsInHand, allyHandCount, allyHandLimitForPlayer, effectivePsycheHealth, MAX_ALLIES_IN_HAND, MAX_PSYCHE_IN_HAND } from "./psyche.js";
import { getQuestStatus } from "./quests.js";
import { effectiveDreamerStat } from "./archetype-stats.js";
import { hexToPixel, boardPixelBounds } from "./hex.js";
import { subconsciousCount, subconsciousPilesForUI, isDreambeastPsycheCard } from "./subconscious.js";
import { getNarratorView, listPhaseActionHints } from "./narrator.js";
import {
  getCurrentObjective,
  rulesReferenceHtml,
  RULES_TAB_INTRO,
  RULES_TAB_DETAILS,
  getDreamerChipTooltip,
} from "./guide.js";
import {
  burstSparklesAtElement,
  consumePhasePulse,
  consumeRevealedTiles,
  consumeForgottenTiles,
} from "./fx.js";
import { consumeBoardClickSuppression } from "./board-zoom.js";
import { powerTokensInPool, MAX_POWER_TOKEN_POOL } from "./power-tokens.js";
import {
  eventLandscapeIds,
  hasAffectedLandscapes,
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
  return `<span class="meta dreambeast-costs"><span title="Accept">A${card.accept} ${acceptSuit}</span><span title="Reject">J${reject} ${rejectSuit}</span></span>`;
}

function createArtElement(card) {
  const art = document.createElement("div");
  art.className = "art";

  if (card.image) {
    const img = document.createElement("img");
    img.src = card.image;
    img.alt = card.name;
    img.loading = "lazy";
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
  const bottomActive = card.effectBottom && ids.some((id) => revealed.has(id));

  const row = document.createElement("div");
  row.className = [
    "event-landscape-icons",
    card.effectBottom ? "has-bottom-effect" : "",
    bottomActive ? "bottom-active" : "",
  ].filter(Boolean).join(" ");

  if (card.effectBottom) {
    const hint = document.createElement("span");
    hint.className = "event-landscape-hint";
    hint.textContent = bottomActive
      ? "Bottom effect active"
      : "Reveal any landscape below on the board";
    row.appendChild(hint);
  }

  const chips = document.createElement("div");
  chips.className = "event-landscape-chips";

  ids.forEach((id) => {
    const chip = document.createElement("span");
    const isRevealed = revealed.has(id);
    chip.className = `event-landscape-icon${isRevealed ? " revealed" : ""}`;
    chip.title = `${landscapeNameForId(id, tiles)}${isRevealed ? " — Revealed" : " — Hidden"}`;
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

function renderPsycheCard(card, { selected, onClick, mini, dense, entering, playerId }) {
  if (isDreambeastPsycheCard(card)) {
    return renderPsycheDreambeastCard(card, { selected, onClick, mini, dense, entering, playerId });
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
      entering ? "card-enter" : "",
      mini ? "mini" : "",
    ].filter(Boolean).join(" ");
    el.innerHTML = `
      <span class="psyche-value">⚡</span>
      <span class="psyche-suit">+${card.powerTokens || 2}</span>
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
    entering ? "card-enter" : "",
    mini ? "mini" : "",
  ].filter(Boolean).join(" ");

  if (isWild) {
    el.innerHTML = `
      <span class="psyche-value">5</span>
      <span class="psyche-suit wild-gradient" title="Wild — any suit">★</span>
      <span class="psyche-label">Wild</span>
    `;
  } else {
    const symbol = suitIconHtml(card.suit, { size: mini ? 14 : 18 });
    const label = SUIT_LABELS[card.suit] || card.suit;
    el.innerHTML = `
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
  const el = renderCard(card, options);
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

  const displayTitle = title || `${player.name}${player.isHead ? " ★" : ""} — Psyche Hand`;
  if (titleEl) titleEl.textContent = displayTitle;
  if (stats) {
    if (statsHtml) stats.innerHTML = statsHtml;
    else if (statsText) stats.textContent = statsText;
    else stats.innerHTML = handStatsHtml(state, player);
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

export function renderPowerTokens(state) {
  const tokensEl = document.getElementById("power-tokens");
  const statsEl = document.getElementById("power-token-stats");
  const bonusBtn = document.getElementById("btn-power-bonus");
  const bonusPending = document.getElementById("power-bonus-pending");
  if (!tokensEl) return;

  const player = activePlayer(state);
  const held = player.powerTokens || 0;
  const pool = powerTokensInPool(state);
  const isMeet = getPhase(state) === "Meet";
  const pending = state.pendingPowerBonus || 0;

  if (statsEl) {
    const pendingNote = pending ? ` · +${pending} spread bonus` : "";
    statsEl.textContent = `${held} held · ${pool}/${MAX_POWER_TOKEN_POOL} in pool${pendingNote}`;
    statsEl.title = "Spend on Dreamer powers, Archetype quests, coin flips, and Object activations";
  }

  if (bonusBtn) {
    bonusBtn.disabled = !isMeet || held < 1 || pending > 0;
    bonusBtn.classList.toggle("hidden", !isMeet);
    bonusBtn.textContent = pending > 0 ? `Spread bonus: +${pending}` : "Flip coin (+1 or +2 Spread)";
  }

  if (bonusPending) {
    if (pending > 0 && isMeet) {
      bonusPending.classList.remove("hidden");
      bonusPending.textContent = `Next Psyche spread gets +${pending} from your coin flip.`;
    } else {
      bonusPending.classList.add("hidden");
      bonusPending.textContent = "";
    }
  }

  tokensEl.innerHTML = "";
  if (!held) {
    const empty = document.createElement("p");
    empty.className = "power-tokens-empty";
    empty.textContent = isMeet
      ? "No tokens yet — draw Power Psyche, Mindstream, or Meet rewards."
      : "No tokens held.";
    tokensEl.appendChild(empty);
    return;
  }

  for (let i = 0; i < held; i += 1) {
    const token = document.createElement("span");
    token.className = "power-token-chip";
    token.title = `${player.name}'s Power Token`;
    token.setAttribute("aria-label", "Power token");
    token.textContent = "⚡";
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
    onClick,
    entering = false,
    playerId = null,
  } = options;

  if ((card.type === "psyche" || card.type === "psyche-power") && !portrait) {
    return renderPsycheCard(card, { selected, onClick, mini, dense, entering, playerId });
  }
  if (isDreambeastPsycheCard(card) && !portrait) {
    return renderPsycheDreambeastCard(card, { selected, onClick, mini, dense, entering, playerId });
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
    ${acceptRepress || points || kindMeta || suit || subtype}
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

export function showModal(card) {
  const modal = document.getElementById("card-modal");
  const container = document.getElementById("modal-card");
  container.innerHTML = "";

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
          <span class="psyche-suit large">+${card.powerTokens || 2}</span>
        </div>
        <h2>${card.name}</h2>
        <p>When drawn: take <strong>${card.powerTokens || 2} Power Tokens</strong>, then discard this card.</p>
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
    if (card.effectTop) {
      const top = document.createElement("p");
      top.className = "event-effect-top";
      top.innerHTML = `<strong>Always:</strong> ${card.effectTop}`;
      detail.appendChild(top);
    }
    if (card.effectBottom) {
      const bottomActive = uiRenderState ? hasAffectedLandscapes(uiRenderState, card) : false;
      const bottom = document.createElement("p");
      bottom.className = `event-effect-bottom${bottomActive ? " active" : " inactive"}`;
      bottom.innerHTML = `<strong>If any Affected Landscape is Revealed:</strong> ${card.effectBottom}`;
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
  } else {
  const fields = [
    ["Type", card.type || card.suit || "—"],
    ["Subtype", card.subtype],
    ["Points", card.points],
    ["Value", card.value],
    ["Accept", card.accept],
    ["Reject", card.reject ?? card.repress],
    ["Fail", card.fail],
    ["Ability", card.ability || card.power || card.passive],
  ];

  const description = card.text || card.flavor || card.effect;
  if (description) {
    fields.push(["Text", description]);
  }

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
  document.getElementById("card-modal").classList.add("hidden");
  document.body.classList.remove("card-detail-open");
}

/** Hex layout scale — half-width in pixel math (larger = bigger map). */
const HEX_BASE = 58;
const HEX_MIN = 72;
const HEX_MAX = 220;

function fitHexSize(state) {
  const viewport = document.getElementById("board-viewport");
  if (!viewport) return 100;

  const pad = 24;
  const maxW = Math.max(120, viewport.clientWidth - pad);
  const maxH = Math.max(120, viewport.clientHeight - pad);
  const bounds = boardPixelBounds(state, HEX_BASE);
  const fit = Math.min(maxW / bounds.width, maxH / bounds.height, 3.2);
  return Math.max(HEX_MIN, Math.min(HEX_MAX, Math.floor(HEX_BASE * fit)));
}

export function renderBoard(state, onSelectLandscape, legalMoveIds = [], pickHighlights = {}, onInspectLandscape = null) {
  const board = document.getElementById("hex-board");
  board.innerHTML = "";

  const size = fitHexSize(state);
  const scale = size / HEX_BASE;
  board.style.setProperty("--hex-scale", String(scale));
  const bounds = boardPixelBounds(state, size);
  board.style.position = "relative";
  board.style.width = `${bounds.width}px`;
  board.style.height = `${bounds.height}px`;
  board.style.margin = "0 auto";

  const legalSet = new Set(legalMoveIds);
  const revealSet = new Set(pickHighlights.reveal || []);
  const forgetSet = new Set(pickHighlights.forget || []);
  const justRevealed = new Set(consumeRevealedTiles());
  const justForgotten = new Set(consumeForgottenTiles());

  state.board.forEach((tile) => {
    const { x, y } = hexToPixel(tile.q, tile.r, size);
    const el = document.createElement("button");
    el.type = "button";
    el.dataset.tileId = tile.id;
    const isBedFinal = tile.center && tile.finalRecurrenceSide;
    const showFace = tile.revealed && !tile.wasteland;
    el.className = [
      "hex-tile",
      tile.center ? "center" : "",
      tile.wasteland || !tile.revealed ? "wasteland" : "",
      !tile.revealed && !tile.center ? "face-down" : "",
      showFace ? "face-up" : "",
      isBedFinal ? "bed-final" : "",
      state.selectedLandscapeId === tile.id ? "selected" : "",
      legalSet.has(tile.id) ? "movable" : "",
      revealSet.has(tile.id) ? "pick-reveal" : "",
      forgetSet.has(tile.id) ? "pick-forget" : "",
      justRevealed.has(tile.id) ? "just-revealed" : "",
      justForgotten.has(tile.id) ? "just-forgotten" : "",
      tile.suit ? `suit-${tile.suit}` : "",
    ].filter(Boolean).join(" ");

    el.style.left = `${x + bounds.offsetX}px`;
    el.style.top = `${y + bounds.offsetY}px`;

    if (isBedFinal) {
      el.style.backgroundImage = "url('images/dreams/final-recurrence.png')";
    } else if (showFace && tile.image) {
      el.style.backgroundImage = `url('${tile.image}')`;
    } else {
      const wl = tile.wastelandImage || "images/landscapes/wasteland.png";
      el.style.backgroundImage = `url('${wl}')`;
    }

    const occupants = state.players.filter((p) => p.landscapeId === tile.id && p.alive);
    const encounter = tile.encounter;
    const finalArch = tile.finalArchetype;
    const encounterMark = encounter ? "⚔" : "";
    const finalMark = finalArch && !finalArch.defeated ? "★" : "";
    const displayName = isBedFinal
      ? "The Bed — Final Recurrence"
      : showFace
        ? tile.name
        : "Wasteland";

    const occupantTokens = [];
    occupants.forEach((p) => {
      if (!p.dreamer?.image) return;
      occupantTokens.push(
        `<img class="hex-occupant-token hex-occupant-dreamer" src="${p.dreamer.image}" alt="" title="${p.dreamer.name}" onerror="this.remove()">`
      );
    });
    if (encounter?.image) {
      occupantTokens.push(
        `<img class="hex-occupant-token hex-occupant-beast" src="${encounter.image}" alt="" title="${encounter.name}" onerror="this.remove()">`
      );
    }
    const occupantsHtml = occupantTokens.length
      ? `<div class="hex-occupants" aria-hidden="true">${occupantTokens.join("")}</div>`
      : "";

    el.innerHTML = `
      <div class="hex-overlay"></div>
      ${occupantsHtml}
      <div class="name">${displayName}</div>
      <div class="suit">${showFace ? (tile.suit || "neutral") : "hidden"}</div>
      <div class="tokens">${occupants.map((p) => p.dreamer.name.split(" ").pop()).join(" · ")} ${encounterMark}${encounter ? ` ${encounter.name.split(" ")[0]}` : ""}${finalMark}${finalArch && !finalArch.defeated ? ` ${finalArch.name.split(" ")[0]}` : ""}</div>
    `;

    el.addEventListener("click", () => {
      if (consumeBoardClickSuppression()) return;
      onSelectLandscape(tile.id);
    });
    if (onInspectLandscape) {
      el.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onInspectLandscape(tile.id);
      });
      el.title = "Left-click to select · right-click for details";
    }
    board.appendChild(el);
  });
}

export function renderPlayers(state, onSelectPlayer) {
  const list = document.getElementById("player-list");
  if (!list) return;
  hideDreamerDetailTooltip();
  list.innerHTML = "";

  state.players.forEach((player, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    const tradeTarget = state.tradeMode && state.trade?.step === "pick-partner";
    const isActive = index === state.activePlayerIndex;
    chip.className = [
      "player-chip",
      isActive ? "active" : "",
      !player.alive ? "dead" : "",
      tradeTarget ? "trade-target" : "",
    ].filter(Boolean).join(" ");
    const ariaHint = getDreamerChipTooltip(state, player, index);
    chip.dataset.playerId = player.id;
    chip.setAttribute("aria-label", `${player.name}. ${ariaHint}`);
    chip.innerHTML = `
      <img src="${player.dreamer.image}" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="name">${player.name}${player.isHead ? " ★" : ""}${!player.alive ? " (lost)" : ""}</div>
        ${dreamerStatsHtml(player.dreamer)}
        <div class="sub">${player.powerTokens} power · ${formatHandPsycheLine(state, player)} · ${player.deathCount || 0}/5 deaths · ${player.objects.length} obj · ${player.persistent?.length || 0} persistent</div>
      </div>
    `;

    const showTooltip = () => {
      const focusHint = !isActive && player.alive
        ? "Click to focus this Dreamer"
        : tradeTarget
          ? "Click to trade with this Dreamer"
          : undefined;
      showDreamerDetailTooltip(player.dreamer, chip, { player, focusHint, state });
    };

    chip.addEventListener("mouseenter", showTooltip);
    chip.addEventListener("mouseleave", hideDreamerDetailTooltip);
    chip.addEventListener("focusin", showTooltip);
    chip.addEventListener("focusout", (event) => {
      if (!chip.contains(event.relatedTarget)) hideDreamerDetailTooltip();
    });
    chip.addEventListener("click", () => {
      hideDreamerDetailTooltip();
      onSelectPlayer(index);
    });
    list.appendChild(chip);
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

export function renderPhaseSpendHands(state, onCardClick) {
  const phase = getPhase(state);
  const suit = phase === "Reveal" ? "lucidity" : phase === "Explore" ? "elasticity" : "willpower";
  const suitLabel = SUIT_LABELS[suit];
  const player = activePlayer(state);
  const best = bestPhaseContributor(state);
  const statKey = statForPhaseBudget(phase, state);
  const isBest = best?.id === player.id;

  renderActiveDreamerHand(state, onCardClick, {
    title: `${player.name} — Spend ${suitLabel}`,
    statsText: isBest
      ? `Best ${suitLabel} bonus (+${totalStat(player, statKey)}) · select 1–2 cards · click another Dreamer to switch hands`
      : best
        ? `Tip: ${best.name} has +${totalStat(best, statKey)} ${suitLabel} · select 1–2 suited cards`
        : `Select 1–2 ${suitLabel} cards · click a Dreamer chip to switch hands`,
    canClickCard: (card) => card.suit === suit || isWildPsyche(card),
  });
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

  renderActiveDreamerHand(state, onCardClick, {
    title: `${player.name} — Meet Hand`,
    statsText: meetActor
      ? (isActor
        ? `${poolCount}/3 spread${allyCount ? ` + ${allyCount} ally` : ""} · total ${poolTotal}${bonusText}${pending} · you may spend Psyche`
        : `Only ${meetActor.name} on the Encounter Landscape may spend Psyche · switch to them with their chip`)
      : "Stand on a Landscape with an Encounter to Meet · click Dreamer chips to switch hands",
    canClickCard: () => !meetActor || isActor,
  });
}

export function renderDecks(state, onDeckClick) {
  const tray = document.getElementById("deck-tray");
  tray.innerHTML = "";

  const coreDecks = [
    { id: "dream", label: "💤 Dream", count: state.dreamDeck.length },
    { id: "psyche", label: "🃏 Psyche", count: state.psycheDeck.length },
    { id: "archetype", label: "👤 Archetype", count: state.archetypeDeck.length },
  ];

  const mindstreamDecks = [
    { id: "mindstream-lucidity", label: "◉ Mindstream", short: "Lucidity", count: state.mindstreamDecks.lucidity.length, suit: "lucidity" },
    { id: "mindstream-elasticity", label: "⇄ Mindstream", short: "Elasticity", count: state.mindstreamDecks.elasticity.length, suit: "elasticity" },
    { id: "mindstream-willpower", label: "✊ Mindstream", short: "Willpower", count: state.mindstreamDecks.willpower.length, suit: "willpower" },
  ];

  const footerDecks = [
    { id: "subconscious", label: "☠ Subconscious", count: subconsciousCount(state.subconscious) },
  ];

  const appendDeck = (deck) => {
    const el = document.createElement("button");
    el.type = "button";
    const isGraveyard = deck.id === "subconscious";
    el.className = [
      "deck-pile",
      deck.suit ? `suit-${deck.suit}` : "",
      isGraveyard && deck.count > 0 ? "graveyard-active" : "",
    ].filter(Boolean).join(" ");
    const labelText = deck.short
      ? `<span class="deck-label-main">${deck.label}</span><span class="deck-label-sub">${deck.short}</span>`
      : `<span class="deck-label-main">${deck.label}</span>`;
    el.dataset.deckId = deck.id;
    el.innerHTML = `${labelText}<strong class="deck-count">${deck.count}</strong>`;
    el.addEventListener("click", () => onDeckClick(deck.id));
    tray.appendChild(el);
  };

  coreDecks.forEach(appendDeck);

  const section = document.createElement("div");
  section.className = "deck-section-label";
  section.textContent = "Mindstream — Events · Beasts · Objects · Tokens · +Dream";
  tray.appendChild(section);

  mindstreamDecks.forEach(appendDeck);
  footerDecks.forEach(appendDeck);
}

export function renderSubconsciousGraveyard(state, onBrowse) {
  const el = document.getElementById("subconscious-graveyard");
  if (!el) return;

  const count = subconsciousCount(state.subconscious);
  const piles = subconsciousPilesForUI(state);
  el.innerHTML = "";

  const header = document.createElement("div");
  header.className = "graveyard-header";
  header.innerHTML = `
    <span class="graveyard-icon">☠</span>
    <span class="graveyard-count">${count} card${count === 1 ? "" : "s"}</span>
    <button type="button" class="btn btn-sm graveyard-browse">Browse all</button>
  `;
  header.querySelector(".graveyard-browse").addEventListener("click", onBrowse);
  el.appendChild(header);

  if (!count) {
    const empty = document.createElement("p");
    empty.className = "graveyard-empty";
    empty.textContent = "Empty — Repressed cards appear here face-up.";
    el.appendChild(empty);
    return;
  }

  const preview = document.createElement("div");
  preview.className = "graveyard-preview";
  piles.forEach((pile) => {
    const chip = document.createElement("div");
    chip.className = "graveyard-pile-chip";
    chip.innerHTML = `<span>${pile.icon || ""} ${pile.label}</span><strong>${pile.cards.length}</strong>`;
    preview.appendChild(chip);
  });
  el.appendChild(preview);

  const recent = document.createElement("div");
  recent.className = "graveyard-recent mini-card-row";
  const all = piles.flatMap((p) => p.cards);
  all.slice(-6).forEach((card) => {
    recent.appendChild(renderCard(card, {
      mini: true,
      onClick: () => onBrowse(),
    }));
  });
  el.appendChild(recent);
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
    const questHtml = statuses.length
      ? `<ul class="quest-list compact">${statuses.map((q) => {
          const cls = q.done ? "done" : (q.ready ? "ready" : "");
          const mark = q.done ? " ✓" : (q.ready ? " · ready" : "");
          return `<li class="${cls}">${q.index + 1}. ${q.text}${mark}</li>`;
        }).join("")}</ul><p class="archetype-tokens">${tokensOn}/2 Power Tokens on Archetype</p>`
      : "";
    archetypeSlot.appendChild(renderCard(card, {
      portrait: true,
      onClick: () => onCardClick(card),
    }));
    if (questHtml) {
      const q = document.createElement("div");
      q.innerHTML = questHtml;
      archetypeSlot.appendChild(q);
    }
  } else {
    archetypeSlot.textContent = "No active Archetype.";
  }

  if (state.activeEncounter) {
    encounterSlot.appendChild(renderCard(state.activeEncounter, {
      onClick: () => onCardClick(state.activeEncounter),
    }));
  } else if (state.activeDream) {
    encounterSlot.appendChild(renderCard(state.activeDream, {
      onClick: () => onCardClick(state.activeDream),
    }));
  } else {
    encounterSlot.textContent = "No active Encounter.";
  }

  const allAcquired = state.players.flatMap((p) => p.acquiredArchetypes);
  allAcquired.forEach((card) => {
    acquired.appendChild(renderCard(card, {
      mini: true,
      onClick: () => onCardClick(card),
    }));
  });
}

export function renderHud(state, hint = "") {
  const goalText = state.finalRecurrence
    ? `Final: ${state.finalArchetypes?.filter((a) => !a.defeated).length || 0} left`
    : `${state.goalPoints} pts`;
  document.getElementById("hud-goal").textContent = goalText;
  document.getElementById("hud-points").textContent = String(state.acquiredPoints);
  document.getElementById("hud-dreams").textContent = String(state.dreamDeck.length);
  document.getElementById("hud-round").textContent = String(state.round);
  document.getElementById("hud-phase").textContent = getPhase(state);
  const head = headPlayer(state);
  const meetInfo = state.meetActionBudget
    ? ` · ${state.meetActionsUsed}/${state.meetActionBudget} actions`
    : state.exploreMovesLeft
      ? ` · ${state.exploreMovesLeft} moves`
      : "";
  const bonus = state.pendingPowerBonus ? ` · +${state.pendingPowerBonus} pending` : "";
  const tutorialTag = state.tutorialMode ? " · Tutorial" : "";
  document.getElementById("phase-banner").textContent =
    `Round ${state.round} · ${head.name} is Head ★${meetInfo}${bonus}${tutorialTag}${hint ? ` · ${hint}` : ""}`;
}

const PHASES = ["Reveal", "Explore", "Meet"];

export function renderPhaseStepper(state) {
  const el = document.getElementById("phase-stepper");
  if (!el) return;
  const current = getPhase(state);
  const pulse = consumePhasePulse();
  el.className = pulse ? "phase-stepper phase-pulse" : "phase-stepper";
  el.innerHTML = PHASES.map((phase, i) => {
    const active = phase === current;
    const done = PHASES.indexOf(current) > i;
    const suit = phase === "Reveal" ? "lucidity" : phase === "Explore" ? "elasticity" : "willpower";
    const cls = ["step", active ? "active" : "", done ? "done" : ""].filter(Boolean).join(" ");
    const arrow = i < PHASES.length - 1 ? '<span class="step-arrow">→</span>' : "";
    return `
      <div class="${cls}" data-phase="${phase}">
        <span class="step-icon suit-${suit}">${suitIconHtml(suit, { size: 14 })}</span>
        <span class="step-label">${phase}</span>
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
  const obj = getCurrentObjective(state);
  if (!obj) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");

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

export function renderNarratorPanel(state) {
  const el = document.getElementById("narrator-panel");
  if (!el) return;
  const view = getNarratorView(state);
  const consequences = view.consequences?.length
    ? `<ul class="narrator-consequences">${view.consequences.map((c) => `<li>${c}</li>`).join("")}</ul>`
    : "";
  el.innerHTML = `
    <div class="narrator-label">What just happened</div>
    <h3 class="narrator-title">${view.title}</h3>
    <p class="narrator-detail">${view.detail}</p>
    ${consequences}
  `;
}

export function renderPhaseAdvanceBar(advanceAction) {
  const bar = document.getElementById("phase-advance-bar");
  const btn = document.getElementById("btn-advance-phase");
  if (!bar || !btn) return;

  if (!advanceAction) {
    bar.classList.add("hidden");
    return;
  }

  bar.classList.remove("hidden");
  btn.textContent = advanceAction.label;
  btn.disabled = !!advanceAction.disabled;
  btn.title = advanceAction.hint || "Advance to the next phase when your group is ready";
  btn.onclick = advanceAction.onClick;
}

const ACTION_SECTIONS = {
  main: "Do this now",
  encounter: "Encounter",
  phase: "Continue",
  actions: "More actions",
  progress: "Archetype & power",
  round: "Round",
};

function createActionButton(action) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `btn ${action.primary ? "primary" : ""}`;
  btn.textContent = action.label;
  btn.title = action.hint || "";
  btn.disabled = !!action.disabled;
  btn.addEventListener("click", action.onClick);
  return btn;
}

let moreActionsOpen = false;

export function renderPhaseActions(actions) {
  const container = document.getElementById("phase-actions");
  if (!container) return;

  const previousDetails = container.querySelector("details.action-more");
  if (previousDetails) {
    moreActionsOpen = previousDetails.open;
  }

  container.innerHTML = "";

  const grouped = {};
  actions.forEach((action) => {
    if (action.hidden) return;
    const section = action.section || "main";
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(action);
  });

  const primarySections = ["main", "encounter"];
  const secondarySections = ["actions", "progress"];

  primarySections.forEach((section) => {
    const items = grouped[section];
    if (!items?.length) return;
    const row = document.createElement("div");
    row.className = "action-section action-section-primary";
    if (section !== "main" && ACTION_SECTIONS[section]) {
      const label = document.createElement("span");
      label.className = "action-section-label";
      label.textContent = ACTION_SECTIONS[section];
      row.appendChild(label);
    }
    const btns = document.createElement("div");
    btns.className = "action-buttons";
    items.forEach((a) => btns.appendChild(createActionButton(a)));
    row.appendChild(btns);
    container.appendChild(row);
  });

  const secondaryItems = secondarySections.flatMap((s) => grouped[s] || []);
  if (secondaryItems.length) {
    const details = document.createElement("details");
    details.className = "action-more";
    details.open = moreActionsOpen;
    details.addEventListener("toggle", () => {
      moreActionsOpen = details.open;
    });
    const summary = document.createElement("summary");
    summary.className = "btn";
    summary.textContent = `More actions (${secondaryItems.length})`;
    details.appendChild(summary);
    const inner = document.createElement("div");
    inner.className = "action-more-inner";
    secondarySections.forEach((section) => {
      const items = grouped[section];
      if (!items?.length) return;
      const group = document.createElement("div");
      group.className = "action-section";
      const label = document.createElement("span");
      label.className = "action-section-label";
      label.textContent = ACTION_SECTIONS[section];
      group.appendChild(label);
      const btns = document.createElement("div");
      btns.className = "action-buttons";
      items.forEach((a) => btns.appendChild(createActionButton(a)));
      group.appendChild(btns);
      inner.appendChild(group);
    });
    details.appendChild(inner);
    container.appendChild(details);
  } else {
    moreActionsOpen = false;
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
    });
  });
}

export function showRulesReferenceModal(activeTab = RULES_TAB_INTRO) {
  const modal = document.getElementById("utility-modal");
  const content = modal?.querySelector(".utility-content");
  const body = document.getElementById("utility-modal-body");
  if (!modal || !body) return;
  content?.classList.add("rules-reference-modal");
  body.innerHTML = `<div class="rules-modal">${rulesReferenceHtml(activeTab)}</div>`;
  bindRulesReferenceTabs(body);
  modal.classList.remove("hidden");
}

export function showRulesModal() {
  showRulesReferenceModal(RULES_TAB_DETAILS);
}

export function showOverviewModal() {
  showRulesReferenceModal(RULES_TAB_INTRO);
}

export function renderLog(state) {
  const log = document.getElementById("log");
  log.innerHTML = state.log.map((line) => `<div>${line}</div>`).join("");
}

export function renderDreamerPicker(dreamers, selectedIds, onToggle, options = {}) {
  const picker = document.getElementById("dreamer-picker");
  if (!picker) return;
  hideDreamerDetailTooltip();
  picker.innerHTML = "";

  const playerCount = options.playerCount ?? selectedIds.length;

  dreamers.forEach((dreamer) => {
    const slotIndex = selectedIds.indexOf(dreamer.id);
    const selected = slotIndex >= 0;
    const wrapper = document.createElement("div");
    wrapper.className = `dreamer-pick ${selected ? "selected" : ""}`;
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
  const intro = document.querySelector("#screen-setup .intro");
  if (!intro) return;
  intro.innerHTML = `
    <p class="setup-lead">You are Dreamers trapped in a collapsing Dreamscape. Work together to earn Archetype points before the Dream Deck runs out.</p>
    <div class="setup-round-flow">
      <div class="round-step suit-lucidity">${suitIconHtml("lucidity", { size: 18 })} <strong>Reveal</strong><span>Draw Dream · reveal Landscapes</span></div>
      <div class="round-step suit-elasticity">${suitIconHtml("elasticity", { size: 18 })} <strong>Explore</strong><span>Spend Elasticity · move on the map</span></div>
      <div class="round-step suit-willpower">${suitIconHtml("willpower", { size: 18 })} <strong>Meet</strong><span>Gain actions · face Encounters</span></div>
    </div>
    <p class="setup-tip">New to Somnia? Try <strong>Tutorial Mode</strong> for a guided 5-round lesson, or read <strong>Game Overview</strong> for the full rules.</p>
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
      hideUtilityModal();
      onPick(btn.dataset.action);
    });
  });
  modal.classList.remove("hidden");
}

export function showDreamerPowerChoice(ui, onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const buttons = (ui.choices || []).map((choice) => `
    <button type="button" class="btn dreamer-power-pick" data-choice="${choice.id}">
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
    btn.addEventListener("click", () => {
      modal.querySelector(".utility-content")?.classList.remove("dreamer-power-modal-wrap");
      hideUtilityModal();
      onPick(btn.dataset.choice);
    });
  });
  modal.classList.remove("hidden");
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
      hideUtilityModal();
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
      hideUtilityModal();
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
      hideUtilityModal();
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
    hideUtilityModal();
    onConfirm();
  });
  body.querySelector("#trade-cancel").addEventListener("click", () => {
    hideUtilityModal();
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
    hideUtilityModal();
    onToken?.();
  });
  body.querySelector("#nothing-choice-repress")?.addEventListener("click", () => {
    hideUtilityModal();
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
    hideUtilityModal();
    onAvoid?.();
  });
  body.querySelector("#death-choice-accept")?.addEventListener("click", () => {
    hideUtilityModal();
    onAccept?.();
  });
  modal.classList.remove("hidden");
}

export function showRespawnPicker(dreamers, onPick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `
    <h2>Choose a New Dreamer</h2>
    <p>A Dreamer was lost. Pick an unused Dreamer to continue on The Bed.</p>
    <div class="card-grid picker" id="respawn-picker"></div>
  `;
  const picker = body.querySelector("#respawn-picker");
  dreamers.forEach((dreamer) => {
    const card = renderCard({ ...dreamer, type: "dreamer" }, {
      portrait: true,
      onClick: () => {
        hideUtilityModal();
        onPick(dreamer.id);
      },
    });
    const label = document.createElement("div");
    label.className = "dreamer-pick-name";
    label.textContent = dreamer.name;
    const wrap = document.createElement("div");
    wrap.className = "dreamer-pick";
    wrap.appendChild(card);
    wrap.appendChild(label);
    picker.appendChild(wrap);
  });
  modal.classList.remove("hidden");
}

export function showSubconsciousPicker(state, onPick, onDone) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const pending = state.pendingReturn;
  const remaining = pending ? pending.remaining - pending.picked.length : 0;

  body.innerHTML = `
    <h2>Return from Subconscious</h2>
    <p class="resolution-reason">${pending?.reason || `Choose ${remaining} card(s) to Return to discard piles.`}</p>
    <div id="subconscious-piles" class="subconscious-piles"></div>
    <div class="utility-actions">
      <button type="button" class="btn" id="return-skip">Skip remaining</button>
    </div>
  `;

  const container = body.querySelector("#subconscious-piles");
  const piles = subconsciousPilesForUI(state);
  if (!piles.length) {
    container.innerHTML = "<p class='resolution-empty'>The Subconscious is empty — nothing to Return.</p>";
  } else {
    piles.forEach((pile) => {
      const section = document.createElement("div");
      section.className = "subconscious-pile";
      section.innerHTML = `<h4>${pile.icon || ""} ${pile.label} (${pile.cards.length})</h4>`;
      const row = document.createElement("div");
      row.className = "mini-card-row";
      pile.cards.forEach((card) => {
        const picked = pending?.picked.some((c) => c.instanceId === card.instanceId);
        row.appendChild(renderCard(card, {
          mini: true,
          selected: picked,
          onClick: () => onPick(card.instanceId),
        }));
      });
      section.appendChild(row);
      container.appendChild(section);
    });
  }

  body.querySelector("#return-skip")?.addEventListener("click", () => {
    hideUtilityModal();
    onDone();
  });

  modal.classList.remove("hidden");
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
    <h2>Repress to Subconscious</h2>
    <p class="resolution-reason">${pending.reason || instruction}</p>
    <p class="resolution-player">${playerName}</p>
    <p class="resolution-instruction">${instruction}</p>
    <div id="repress-pool" class="subconscious-piles"></div>
    <div class="utility-actions">
      <button type="button" class="btn primary" id="repress-confirm">${isEmpty || pool.length === 0 ? "Continue" : picked >= needed ? "Done" : "Continue with selected"}</button>
    </div>
  `;

  const container = body.querySelector("#repress-pool");
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
        row.className = "mini-card-row";
        p.hand.forEach((card) => {
          const selected = pending.picked.some((c) => c.instanceId === card.instanceId);
          row.appendChild(renderCard(card, {
            mini: true,
            selected,
            onClick: () => onPick(card.instanceId),
          }));
        });
        section.appendChild(row);
        container.appendChild(section);
      });
    } else {
      const row = document.createElement("div");
      row.className = "mini-card-row";
      pool.forEach((card) => {
        const selected = pending.picked.some((c) => c.instanceId === card.instanceId);
        row.appendChild(renderCard(card, {
          mini: true,
          selected,
          onClick: () => onPick(card.instanceId),
        }));
      });
      container.appendChild(row);
    }
  }

  body.querySelector("#repress-confirm").addEventListener("click", () => {
    hideUtilityModal();
    onConfirm();
  });

  modal.classList.remove("hidden");
}

export function showSubconsciousBrowse(state, onCardClick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const count = subconsciousCount(state.subconscious);
  body.innerHTML = `
    <h2>☠ The Subconscious</h2>
    <p>Face-up graveyard — all Repressed cards. Choose cards here when an effect lets you <strong>Return</strong> cards to play.</p>
    <p class="graveyard-total">${count} card${count === 1 ? "" : "s"} total</p>
    <div id="subconscious-browse" class="subconscious-piles"></div>
  `;
  const container = body.querySelector("#subconscious-browse");
  subconsciousPilesForUI(state).forEach((pile) => {
    const section = document.createElement("div");
    section.className = "subconscious-pile";
    section.innerHTML = `<h4>${pile.label}</h4>`;
    const row = document.createElement("div");
    row.className = "mini-card-row";
    pile.cards.forEach((card) => {
      row.appendChild(renderCard(card, {
        mini: true,
        onClick: () => onCardClick(card),
      }));
    });
    section.appendChild(row);
    container.appendChild(section);
  });
  if (!container.children.length) {
    container.innerHTML = "<p>Empty — no repressed cards.</p>";
  }
  modal.classList.remove("hidden");
}

export function hideUtilityModal() {
  const modal = document.getElementById("utility-modal");
  modal.classList.add("hidden");
  document.body.classList.remove("utility-modal-open");
  modal.querySelector(".utility-content")?.classList.remove("landscape-detail-modal");
  modal.querySelector(".utility-content")?.classList.remove("dreamer-detail-modal");
  modal.querySelector(".utility-content")?.classList.remove("dreamer-power-modal-wrap");
  modal.querySelector(".utility-content")?.classList.remove("phase-skip-modal");
  modal.querySelector(".utility-content")?.classList.remove("rules-reference-modal");
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

  return `
    <div class="dreamer-detail">
      <div class="dreamer-detail-art-wrap">
        <img class="dreamer-detail-art" src="${dreamer.image}" alt="${dreamer.name}">
      </div>
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
    hideUtilityModal();
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
    hideUtilityModal();
    onCancel?.();
  });
  body.querySelector("#phase-skip-confirm").addEventListener("click", () => {
    hideUtilityModal();
    onConfirm?.();
  });
  bindUtilityModalActions(body, { onCancel });
  modal.classList.remove("hidden");
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
    hideUtilityModal();
    onCancel?.();
  });
  body.querySelector("#meet-skip-repress").addEventListener("click", () => {
    hideUtilityModal();
    onRepressSouls?.();
  });
  body.querySelector("#meet-skip-discard").addEventListener("click", () => {
    hideUtilityModal();
    onConsumeTimeline?.();
  });
  bindUtilityModalActions(body, { onCancel });
  modal.classList.remove("hidden");
}

export function showLandscapeDetail(state, tileId) {
  const tile = state.board.find((t) => t.id === tileId);
  if (!tile) return;

  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  const isBedFinal = tile.center && tile.finalRecurrenceSide;
  const showFace = tile.revealed && !tile.wasteland;
  const imageUrl = isBedFinal
    ? "images/dreams/final-recurrence.png"
    : showFace && tile.image
      ? tile.image
      : tile.wastelandImage || "images/landscapes/wasteland.png";

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
  const occupants = [];
  dreamers.forEach((p) => occupants.push(`Dreamer: ${p.name}`));
  if (tile.encounter) occupants.push(`Dreambeast: ${tile.encounter.name}`);
  if (tile.finalArchetype && !tile.finalArchetype.defeated) {
    occupants.push(`Remaining Archetype: ${tile.finalArchetype.name}`);
  }
  const occupantText = occupants.length ? occupants.join("<br>") : "Unoccupied";

  body.innerHTML = `
    <div class="landscape-detail">
      <div class="landscape-detail-art-wrap">
        <img class="landscape-detail-art" src="${imageUrl}" alt="${displayName}">
      </div>
      <div class="landscape-detail-body">
        <h2>${displayName}</h2>
        <p class="landscape-detail-suit"><strong>Suit:</strong> ${suitLabel}</p>
        <div class="landscape-detail-actions">${actionRows}</div>
        <div class="landscape-detail-occupants">
          <strong>Occupied by</strong>
          <p>${occupantText}</p>
        </div>
      </div>
    </div>
  `;
  modal.querySelector(".utility-content")?.classList.add("landscape-detail-modal");
  modal.classList.remove("hidden");
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
  document.getElementById("table-chrome")?.addEventListener("scroll", () => positionTutorialSpotlight(), { passive: true });
  window.addEventListener("resize", () => positionTutorialSpotlight(), { passive: true });
}

const SPARKLE_COUNT = 28;
const SPARKLE_JUMP_MS = 720;

function getStepTargetSelectors(step) {
  if (!step) return [];
  if (Array.isArray(step.targets) && step.targets.length) return step.targets;
  if (step.target) return [step.target];
  return [];
}

const TUTORIAL_BOTTOM_SELECTORS = new Set(["#hand-bar", "#phase-actions", "#table-footer"]);
const TUTORIAL_TOP_SELECTORS = new Set(["#btn-advance-phase", "#phase-advance-bar", "#phase-stepper", "#narrator-panel"]);
const TUTORIAL_BOARD_SELECTORS = new Set(["#board-viewport", "#hex-board", "#player-list"]);

function isUtilityModalOpen() {
  const modal = document.getElementById("utility-modal");
  return modal && !modal.classList.contains("hidden");
}

function getUtilityModalSpotlightEl() {
  return document.querySelector("#utility-modal .utility-content");
}

function getSpotlightSelector(step) {
  if (!step) return null;
  if (isUtilityModalOpen()) return "#utility-modal .utility-content";
  if (step.spotlight) return step.spotlight;
  const selectors = getStepTargetSelectors(step);
  if (selectors.includes("#btn-advance-phase")) return "#btn-advance-phase";
  if (selectors.includes("#phase-advance-bar") && !selectors.includes("#board-viewport")) {
    return "#btn-advance-phase";
  }
  if (selectors.includes("#phase-actions")) return "#phase-actions";
  if (selectors.length === 1) return selectors[0];
  const focused = selectors.find((s) => !TUTORIAL_BOARD_SELECTORS.has(s) && s !== "#board-viewport");
  return focused || selectors[0];
}

function resolveTutorialElements(step) {
  return getStepTargetSelectors(step)
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
}

function resolveSpotlightElements(step) {
  const spotlightSel = getSpotlightSelector(step);
  if (spotlightSel) {
    const el = document.querySelector(spotlightSel);
    if (el) return [el];
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
  if (spotlight === "#btn-advance-phase" || selectors.includes("#phase-advance-bar")) {
    return "bottom";
  }
  if (TUTORIAL_BOARD_SELECTORS.has(spotlight) || selectors.includes("#board-viewport")) {
    return "top";
  }
  if (TUTORIAL_TOP_SELECTORS.has(spotlight)) {
    return "bottom";
  }
  return "bottom";
}

function positionTutorialCard(step) {
  const overlay = document.getElementById("tutorial-overlay");
  if (!overlay) return;
  const dock = inferTutorialCardDock(step);
  overlay.classList.remove("tutorial-dock-top", "tutorial-dock-bottom", "tutorial-dock-left");
  overlay.classList.add(`tutorial-dock-${dock}`);
}

export function ensureTutorialStepTargetsVisible(step) {
  const selectors = getStepTargetSelectors(step);
  const spotlight = getSpotlightSelector(step);
  if (
    selectors.some((s) => s === "#btn-advance-phase" || s === "#phase-advance-bar")
    || spotlight === "#btn-advance-phase"
  ) {
    document.getElementById("phase-advance-bar")?.classList.remove("hidden");
  }
  if (selectors.some((s) => s === "#guide-panel" || s === "#guide-panel-wrap")) {
    document.getElementById("guide-panel-wrap")?.classList.remove("collapsed");
    document.getElementById("btn-toggle-guide")?.setAttribute("aria-expanded", "true");
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

function applyTutorialHighlight(stepOrTarget, { animateIn = true } = {}) {
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
  const highlightTargets = isUtilityModalOpen() ? [] : targets;

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
    const inChrome = scrollEl.closest("#table-chrome");
    if (!inChrome || scrollEl.id === "btn-advance-phase") {
      scrollEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
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
    const roundPart = roundLabel ? `Round ${roundLabel} · ` : "";
    document.getElementById("tutorial-progress").textContent = `${roundPart}Step ${stepIndex + 1} / ${total}`;
  }
  if (step) {
    positionTutorialCard(step);
    refreshTutorialSpotlight();
  }
}

export function showTutorialStep(step, stepIndex, total, {
  onNext,
  onSkip,
  onBack,
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
  const roundPart = roundLabel ? `Round ${roundLabel} · ` : "";
  document.getElementById("tutorial-progress").textContent = `${roundPart}Step ${stepIndex + 1} / ${total}`;
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
        : (canAdvance && step.until ? "Objective complete — press Continue." : ""));
  }

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

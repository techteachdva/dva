import { getPhase, activePlayer, headPlayer } from "./state.js";
import {
  coopMeetPlayTotal,
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
import { psycheHandCount, alliesInHand, effectivePsycheHealth } from "./psyche.js";
import { getQuestStatus } from "./quests.js";
import { effectiveDreamerStat } from "./archetype-stats.js";
import { hexToPixel, boardPixelBounds } from "./hex.js";
import { subconsciousCount, subconsciousPilesForUI, isDreambeastPsycheCard } from "./subconscious.js";
import { getNarratorView, listPhaseActionHints } from "./narrator.js";
import { getCurrentObjective, rulesHtml, overviewHtml, getDreamerChipTooltip } from "./guide.js";
import { consumePhasePulse, consumeRevealedTiles, consumeForgottenTiles } from "./fx.js";
import { consumeBoardClickSuppression } from "./board-zoom.js";
import { powerTokensInPool, MAX_POWER_TOKEN_POOL } from "./power-tokens.js";
import {
  eventLandscapeIds,
  hasAffectedLandscapes,
  landscapeImageForId,
  revealedLandscapeIds,
} from "./event-landscapes.js";

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

function renderPsycheDreambeastCard(card, { selected, onClick, mini, entering, playerId }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "game-card",
    "psyche-card",
    "psyche-dreambeast",
    "dreambeast",
    card.beastKind === "fantasy" ? "beast-fantasy" : card.beastKind === "nightmare" ? "beast-nightmare" : "",
    card.suit,
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

function renderPsycheCard(card, { selected, onClick, mini, entering, playerId }) {
  if (isDreambeastPsycheCard(card)) {
    return renderPsycheDreambeastCard(card, { selected, onClick, mini, entering, playerId });
  }
  if (card.type === "psyche-power") {
    const el = document.createElement("button");
    el.type = "button";
    el.className = [
      "game-card",
      "psyche-card",
      "psyche-power",
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
  const allies = alliesInHand(player).length;
  const total = effectivePsycheHealth(player);

  if (allies && psyche === 0) {
    return `${total} psyche (${allies} ${allies === 1 ? "ally" : "allies"})`;
  }
  if (allies) {
    return `${total} psyche (${psyche}/${limit} + ${allies} ${allies === 1 ? "ally" : "allies"})`;
  }
  return `${psyche}/${limit} psyche`;
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
    selected = false,
    onClick,
    entering = false,
    playerId = null,
  } = options;

  if ((card.type === "psyche" || card.type === "psyche-power") && !portrait) {
    return renderPsycheCard(card, { selected, onClick, mini, entering, playerId });
  }
  if (isDreambeastPsycheCard(card) && !portrait) {
    return renderPsycheDreambeastCard(card, { selected, onClick, mini, entering, playerId });
  }

  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "game-card",
    cardTypeClass(card),
    portrait ? "portrait" : "",
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
}

export function hideModal() {
  document.getElementById("card-modal").classList.add("hidden");
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

export function renderBoard(state, onSelectLandscape, legalMoveIds = [], pickHighlights = {}) {
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

    el.innerHTML = `
      <div class="hex-overlay"></div>
      <div class="name">${displayName}</div>
      <div class="suit">${showFace ? (tile.suit || "neutral") : "hidden"}</div>
      <div class="tokens">${occupants.map((p) => p.dreamer.name.split(" ").pop()).join(" · ")} ${encounterMark}${encounter ? ` ${encounter.name.split(" ")[0]}` : ""}${finalMark}${finalArch && !finalArch.defeated ? ` ${finalArch.name.split(" ")[0]}` : ""}</div>
    `;

    el.addEventListener("click", () => {
      if (consumeBoardClickSuppression()) return;
      onSelectLandscape(tile.id);
    });
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
  const hand = document.getElementById("hand");
  const stats = document.getElementById("hand-stats");
  const title = document.getElementById("hand-title");
  const player = activePlayer(state);
  hand.innerHTML = "";
  hand.classList.remove("coop-mode");
  if (title) title.textContent = "Your Psyche Hand";
  stats.innerHTML = handStatsHtml(state, player);

  const fresh = newCardIds || new Set();
  player.hand.forEach((card, index) => {
    const el = renderCard(card, {
      selected: state.selectedHand.includes(card.instanceId)
        || state.trade?.offerPsycheIds?.includes(card.instanceId),
      entering: fresh.has(card.instanceId),
      playerId: player.id,
      onClick: () => onCardClick(card, player),
    });
    if (fresh.has(card.instanceId)) {
      el.style.setProperty("--deal-i", String(index));
    }
    hand.appendChild(el);
  });
}

export function renderPhaseSpendHands(state, onCardClick) {
  const hand = document.getElementById("hand");
  const stats = document.getElementById("hand-stats");
  const title = document.getElementById("hand-title");
  const phase = getPhase(state);
  const suit = phase === "Reveal" ? "lucidity" : phase === "Explore" ? "elasticity" : "willpower";
  const suitLabel = SUIT_LABELS[suit];
  const best = bestPhaseContributor(state);
  const statKey = statForPhaseBudget(phase, state);

  hand.innerHTML = "";
  hand.classList.add("coop-mode");
  if (title) title.textContent = `Spend ${suitLabel} — one Dreamer sets the team budget`;
  if (stats) {
    stats.textContent = best
      ? `Tip: ${best.name} has the best ${suitLabel} bonus (+${totalStat(best, statKey)}) — have them play 1–2 cards`
      : `Select 1–2 ${suitLabel} cards from one Dreamer's row`;
  }

  state.players.filter((p) => p.alive).forEach((player, index) => {
    const row = document.createElement("div");
    const isBest = best?.id === player.id;
    row.dataset.playerId = player.id;
    row.className = [
      "coop-hand-row",
      "phase-spend-row",
      isBest ? "best-spender" : "",
      index === state.activePlayerIndex ? "focused" : "",
    ].filter(Boolean).join(" ");

    const label = document.createElement("div");
    label.className = "coop-hand-label";
    label.textContent = `${player.name}${player.isHead ? " ★" : ""} · +${totalStat(player, statKey)} ${suitLabel}${isBest ? " · best bonus" : ""}`;
    row.appendChild(label);

    const cards = document.createElement("div");
    cards.className = "coop-hand-cards";
    if (!player.hand.length) {
      cards.textContent = "Empty hand";
      cards.classList.add("empty");
    } else {
      player.hand.forEach((card) => {
        const canPick = card.suit === suit || isWildPsyche(card);
        cards.appendChild(renderCard(card, {
          selected: state.selectedHand.includes(card.instanceId),
          mini: true,
          playerId: player.id,
          onClick: canPick ? () => onCardClick(card, player) : undefined,
        }));
      });
    }
    row.appendChild(cards);
    hand.appendChild(row);
  });
}

export function renderCoopMeetHands(state, onCardClick) {
  const hand = document.getElementById("hand");
  const stats = document.getElementById("hand-stats");
  const title = document.getElementById("hand-title");
  hand.innerHTML = "";

  const poolCount = spreadPsycheCount(state);
  const allyCount = allyPsycheCount(state);
  const poolTotal = coopMeetPlayTotal(state);
  const bonus = meetBonusBreakdown(state);
  const bonusText = bonus.total ? ` · +${bonus.total} Dreamer (${bonus.parts.join(", ")})` : "";
  const pending = state.pendingPowerBonus ? ` · +${state.pendingPowerBonus} bonus pending` : "";
  if (title) title.textContent = "Cooperative Psyche Pool";
  stats.textContent = `${poolCount}/3 spread${allyCount ? ` + ${allyCount} ally` : ""} · total ${poolTotal}${bonusText}${pending} · click any Dreamer's Psyche`;
  hand.classList.add("coop-mode");

  state.players.filter((p) => p.alive).forEach((player, index) => {
    const row = document.createElement("div");
    row.dataset.playerId = player.id;
    row.className = [
      "coop-hand-row",
      index === state.activePlayerIndex ? "focused" : "",
    ].filter(Boolean).join(" ");

    const label = document.createElement("div");
    label.className = "coop-hand-label";
    label.textContent = `${player.name}${player.isHead ? " ★" : ""} · ${player.hand.length} cards`;
    row.appendChild(label);

    const cards = document.createElement("div");
    cards.className = "coop-hand-cards";
    if (!player.hand.length) {
      cards.textContent = "Empty hand";
      cards.classList.add("empty");
    } else {
      player.hand.forEach((card) => {
        cards.appendChild(renderCard(card, {
          selected: state.selectedHand.includes(card.instanceId),
          playerId: player.id,
          onClick: () => onCardClick(card, player),
        }));
      });
    }
    row.appendChild(cards);
    hand.appendChild(row);
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

export function showRulesModal() {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `<div class="rules-modal">${rulesHtml()}</div>`;
  modal.classList.remove("hidden");
}

export function showOverviewModal() {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = overviewHtml();
  modal.classList.remove("hidden");
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
    <p class="setup-tip">New to Somnia? Try <strong>Tutorial Mode</strong> for a guided 5-round lesson, read the <strong>Game Overview</strong>, or open <strong>How to Play</strong>.</p>
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
  modal.querySelector(".utility-content")?.classList.remove("landscape-detail-modal");
  modal.querySelector(".utility-content")?.classList.remove("dreamer-detail-modal");
  modal.querySelector(".utility-content")?.classList.remove("dreamer-power-modal-wrap");
  modal.querySelector(".utility-content")?.classList.remove("phase-skip-modal");
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
let tutorialSpotlightEl = null;
let tutorialSparkleLayer = null;
let tutorialSpotlightTracker = null;

const SPARKLE_COUNT = 14;
const SPARKLE_JUMP_MS = 720;

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
    <div class="tutorial-spotlight-ring"></div>
    <div class="tutorial-spotlight-sparkles"></div>
  `;
  const sparkleHost = tutorialSpotlightEl.querySelector(".tutorial-spotlight-sparkles");
  for (let i = 0; i < SPARKLE_COUNT; i += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "tutorial-sparkle";
    sparkle.style.setProperty("--sparkle-i", String(i));
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
  if (!tutorialSpotlightEl || !tutorialHighlightEl) return;
  const rect = tutorialHighlightEl.getBoundingClientRect();
  const pad = 10;
  tutorialSpotlightEl.style.left = `${rect.left - pad}px`;
  tutorialSpotlightEl.style.top = `${rect.top - pad}px`;
  tutorialSpotlightEl.style.width = `${Math.max(rect.width + pad * 2, 48)}px`;
  tutorialSpotlightEl.style.height = `${Math.max(rect.height + pad * 2, 48)}px`;
  const orbit = Math.max(rect.width, rect.height) / 2 + pad + 4;
  tutorialSpotlightEl.style.setProperty("--orbit-r", `${orbit}px`);
}

function startTutorialSpotlightTracker() {
  stopTutorialSpotlightTracker();
  if (!tutorialHighlightEl) return;
  positionTutorialSpotlight();
  if (typeof ResizeObserver !== "undefined") {
    tutorialSpotlightTracker = new ResizeObserver(() => positionTutorialSpotlight());
    tutorialSpotlightTracker.observe(tutorialHighlightEl);
    if (tutorialHighlightEl.parentElement) {
      tutorialSpotlightTracker.observe(tutorialHighlightEl.parentElement);
    }
  }
  window.addEventListener("resize", positionTutorialSpotlight);
  window.addEventListener("scroll", positionTutorialSpotlight, true);
}

export function refreshTutorialSpotlight() {
  positionTutorialSpotlight();
}

export function getTutorialSpotlightRect() {
  if (tutorialHighlightEl) {
    return tutorialHighlightEl.getBoundingClientRect();
  }
  if (tutorialSpotlightEl && !tutorialSpotlightEl.classList.contains("hidden")) {
    return tutorialSpotlightEl.getBoundingClientRect();
  }
  return null;
}

function applyTutorialHighlight(target, { animateIn = true } = {}) {
  ensureTutorialSparkleLayer();
  clearTutorialHighlight({ keepLayer: true });

  if (!target) {
    tutorialSpotlightEl?.classList.add("hidden");
    stopTutorialSpotlightTracker();
    return;
  }

  target.classList.add("tutorial-highlight");
  tutorialHighlightEl = target;
  tutorialSpotlightEl.classList.remove("hidden", "tutorial-spotlight-arriving");
  positionTutorialSpotlight();
  startTutorialSpotlightTracker();

  if (animateIn) {
    tutorialSpotlightEl.classList.add("tutorial-spotlight-arriving");
    window.setTimeout(() => {
      tutorialSpotlightEl?.classList.remove("tutorial-spotlight-arriving");
    }, 480);
  }

  target.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function animateTutorialSparkleJump(fromRect, toTarget, onComplete) {
  ensureTutorialSparkleLayer();
  const flyer = document.getElementById("tutorial-flyer");
  if (!flyer || !toTarget) {
    applyTutorialHighlight(toTarget, { animateIn: true });
    onComplete?.();
    return;
  }

  const toRect = toTarget.getBoundingClientRect();
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
    applyTutorialHighlight(toTarget, { animateIn: true });
    tutorialSpotlightEl.classList.remove("tutorial-spotlight-traveling");
    onComplete?.();
  };

  requestAnimationFrame(frame);
}

function clearTutorialHighlight({ keepLayer = false } = {}) {
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

export function showTutorialStep(step, stepIndex, total, {
  onNext,
  onSkip,
  canAdvance = true,
  roundLabel = null,
  fromRect = null,
}) {
  const overlay = document.getElementById("tutorial-overlay");
  if (!overlay) return;

  const waiting = step.until && !canAdvance;
  document.getElementById("tutorial-title").textContent = step.title;
  document.getElementById("tutorial-body").textContent = step.body;
  const roundPart = roundLabel ? `Round ${roundLabel} · ` : "";
  document.getElementById("tutorial-progress").textContent = `${roundPart}Step ${stepIndex + 1} / ${total}`;
  const nextBtn = document.getElementById("tutorial-next");
  nextBtn.textContent = stepIndex >= total - 1 ? "Finish" : "Continue";
  nextBtn.disabled = waiting;

  const card = overlay.querySelector(".tutorial-card");
  card?.classList.toggle("tutorial-waiting", waiting);
  let hintEl = card?.querySelector(".tutorial-next-hint");
  if (!hintEl && card) {
    hintEl = document.createElement("p");
    hintEl.className = "tutorial-next-hint";
    card.querySelector("p")?.after(hintEl);
  }
  if (hintEl) {
    hintEl.textContent = waiting
      ? "Complete the highlighted action to continue."
      : "";
  }

  clearTutorialHighlight({ keepLayer: !!fromRect });
  const target = step.target ? document.querySelector(step.target) : null;

  if (fromRect && target && fromRect.width > 0 && fromRect.height > 0) {
    animateTutorialSparkleJump(fromRect, target);
  } else {
    applyTutorialHighlight(target, { animateIn: true });
  }

  const skipBtn = document.getElementById("tutorial-skip");
  const backdrop = overlay.querySelector(".tutorial-backdrop");

  const cleanup = () => {
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    skipBtn?.replaceWith(skipBtn.cloneNode(true));
    backdrop?.replaceWith(backdrop.cloneNode(true));
  };

  cleanup();
  const freshNext = document.getElementById("tutorial-next");
  const freshSkip = document.getElementById("tutorial-skip");
  const freshBackdrop = overlay.querySelector(".tutorial-backdrop");

  freshNext.addEventListener("click", () => {
    if (freshNext.disabled) return;
    onNext?.();
  });
  freshSkip.addEventListener("click", onSkip);
  freshBackdrop?.addEventListener("click", onSkip);

  overlay.classList.remove("hidden");
}

export function hideTutorial() {
  clearTutorialHighlight();
  document.getElementById("tutorial-sparkle-layer")?.remove();
  tutorialSparkleLayer = null;
  tutorialSpotlightEl = null;
  document.getElementById("tutorial-overlay")?.classList.add("hidden");
}

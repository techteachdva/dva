import { getPhase, activePlayer, headPlayer } from "./state.js";
import {
  coopMeetPlayTotal,
  allSelectedCards,
  SUIT_LABELS,
  suitIconHtml,
  dreamerStatsHtml,
} from "./rules.js";
import { handLimitForPlayer } from "./objects.js";
import { getQuestStatus } from "./quests.js";
import { hexToPixel, boardPixelBounds } from "./hex.js";
import { subconsciousCount, subconsciousPilesForUI } from "./subconscious.js";
import { getCurrentObjective, rulesHtml, overviewHtml, getDreamerChipTooltip } from "./guide.js";

function suitClass(suit) {
  return suit ? `suit-${suit}` : "";
}

function cardTypeClass(card) {
  if (card.type === "dreamer") return "dreamer";
  if (card.type === "dreambeast" || card.boss) return "dreambeast";
  if (card.type === "object") return "object";
  if (card.type === "event") return card.suit || "event";
  return card.suit || card.type || "";
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

function renderPsycheCard(card, { selected, onClick, mini }) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "game-card",
    "psyche-card",
    card.suit,
    selected ? "selected" : "",
    mini ? "mini" : "",
  ].filter(Boolean).join(" ");

  const symbol = suitIconHtml(card.suit, { size: mini ? 14 : 18 });
  const label = SUIT_LABELS[card.suit] || card.suit;

  el.innerHTML = `
    <span class="psyche-value">${card.value}</span>
    <span class="psyche-suit ${suitClass(card.suit)}">${symbol}</span>
    <span class="psyche-label">${label}</span>
  `;

  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function handStatsHtml(state, player) {
  const limit = handLimitForPlayer(state, player);
  return `
    <span class="hand-stats-suits">
      <span class="stat suit-lucidity" title="Lucidity">${suitIconHtml("lucidity", { size: 12 })}${player.dreamer.lucidity}</span>
      <span class="stat suit-elasticity" title="Elasticity">${suitIconHtml("elasticity", { size: 12 })}${player.dreamer.elasticity}</span>
      <span class="stat suit-willpower" title="Willpower">${suitIconHtml("willpower", { size: 12 })}${player.dreamer.willpower}</span>
    </span>
    · ${player.hand.length}/${limit} · ${player.powerTokens} power
  `;
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
  const { portrait = false, mini = false, selected = false, onClick } = options;

  if (card.type === "psyche" && !portrait) {
    return renderPsycheCard(card, { selected, onClick, mini });
  }

  const el = document.createElement("button");
  el.type = "button";
  el.className = [
    "game-card",
    cardTypeClass(card),
    portrait ? "portrait" : "",
    selected ? "selected" : "",
  ].filter(Boolean).join(" ");

  const value = card.value != null ? `<span class="value">${card.value}</span>` : "";
  const acceptRepress = card.accept != null
    ? `<span class="meta"><span>A${card.accept}/R${card.repress}</span></span>`
    : "";
  const points = card.points != null ? `<span class="meta"><span>${card.points} pts</span></span>` : "";
  const showSuitMeta = card.suit && card.type !== "dreamer" && card.type !== "psyche";
  const suit = showSuitMeta
    ? `<span class="meta"><span class="${suitClass(card.suit)}">${SUIT_LABELS[card.suit] || card.suit}</span></span>`
    : "";
  const subtype = card.subtype ? `<span class="meta"><span>${card.subtype}</span></span>` : "";

  const art = createArtElement(card);

  if (card.type === "dreamer" && portrait) {
    el.appendChild(art);
    if (onClick) el.addEventListener("click", onClick);
    return el;
  }

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = `
    <div class="title">${card.name}</div>
    ${acceptRepress || points || suit || subtype}
  `;

  if (value) el.innerHTML = value;
  el.appendChild(art);
  el.appendChild(body);

  if (mini) {
    el.style.width = "72px";
    el.style.minHeight = "96px";
  }

  if (onClick) el.addEventListener("click", onClick);
  return el;
}

export function showModal(card) {
  const modal = document.getElementById("card-modal");
  const container = document.getElementById("modal-card");
  container.innerHTML = "";

  if (card.type === "psyche") {
    const detail = document.createElement("div");
    detail.className = "modal-detail psyche-modal";
    detail.innerHTML = `
      <div class="psyche-modal-face ${card.suit}">
        <span class="psyche-value large">${card.value}</span>
        <span class="psyche-suit large ${suitClass(card.suit)}">${suitIconHtml(card.suit, { size: 40 })}</span>
      </div>
      <h2>${SUIT_LABELS[card.suit]} ${card.value}</h2>
      <p>Psyche card — used for Reveal (${SUIT_LABELS.lucidity}), Explore (${SUIT_LABELS.elasticity}), and Meet (${SUIT_LABELS.willpower}) phases.</p>
    `;
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

  const fields = [
    ["Type", card.type || card.suit || "—"],
    ["Subtype", card.subtype],
    ["Points", card.points],
    ["Value", card.value],
    ["Accept", card.accept],
    ["Repress", card.repress],
    ["Fail", card.fail],
    ["Ability", card.ability || card.power],
    ["Effect", card.effect],
    ["Text", card.text || card.flavor],
  ];

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

  container.appendChild(detail);
  modal.classList.remove("hidden");
}

export function hideModal() {
  document.getElementById("card-modal").classList.add("hidden");
}

export function renderBoard(state, onSelectLandscape, legalMoveIds = []) {
  const board = document.getElementById("hex-board");
  board.innerHTML = "";

  const size = 58;
  const bounds = boardPixelBounds(state, size);
  board.style.position = "relative";
  board.style.width = `${bounds.width}px`;
  board.style.height = `${bounds.height}px`;
  board.style.margin = "0 auto";

  const legalSet = new Set(legalMoveIds);

  state.board.forEach((tile) => {
    const { x, y } = hexToPixel(tile.q, tile.r, size);
    const el = document.createElement("button");
    el.type = "button";
    el.className = [
      "hex-tile",
      tile.center ? "center" : "",
      tile.wasteland ? "wasteland" : "",
      !tile.revealed ? "hidden-tile" : "",
      state.selectedLandscapeId === tile.id ? "selected" : "",
      legalSet.has(tile.id) ? "movable" : "",
      tile.suit ? `suit-${tile.suit}` : "",
    ].filter(Boolean).join(" ");

    el.style.left = `${x + bounds.offsetX}px`;
    el.style.top = `${y + bounds.offsetY}px`;

    if (tile.revealed && tile.image) {
      el.style.backgroundImage = `url('${tile.image}')`;
    } else if (!tile.revealed) {
      const wl = tile.wastelandImage || "images/landscapes/wasteland.png";
      el.style.backgroundImage = `url('${wl}')`;
    }

    const occupants = state.players.filter((p) => p.landscapeId === tile.id && p.alive);
    const encounter = tile.encounter;
    const finalArch = tile.finalArchetype;
    const encounterMark = encounter ? "⚔" : "";
    const finalMark = finalArch && !finalArch.defeated ? "★" : "";

    el.innerHTML = `
      <div class="hex-overlay"></div>
      <div class="name">${tile.revealed ? tile.name : "???"}</div>
      <div class="suit">${tile.revealed ? (tile.suit || "neutral") : "hidden"}</div>
      <div class="tokens">${occupants.map((p) => p.dreamer.name.split(" ").pop()).join(" · ")} ${encounterMark}${encounter ? ` ${encounter.name.split(" ")[0]}` : ""}${finalMark}${finalArch && !finalArch.defeated ? ` ${finalArch.name.split(" ")[0]}` : ""}</div>
    `;

    el.addEventListener("click", () => onSelectLandscape(tile.id));
    board.appendChild(el);
  });
}

export function renderPlayers(state, onSelectPlayer) {
  const list = document.getElementById("player-list");
  list.innerHTML = "";

  state.players.forEach((player, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    const tradeTarget = state.tradeMode && state.trade?.step === "pick-partner";
    chip.className = [
      "player-chip",
      index === state.activePlayerIndex ? "active" : "",
      !player.alive ? "dead" : "",
      tradeTarget ? "trade-target" : "",
    ].filter(Boolean).join(" ");
    const tooltip = getDreamerChipTooltip(state, player, index);
    chip.dataset.tooltip = tooltip;
    chip.title = tooltip;
    chip.setAttribute("aria-label", `${player.name}. ${tooltip}`);
    chip.innerHTML = `
      <img src="${player.dreamer.image}" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="name">${player.name}${player.isHead ? " ★" : ""}${!player.alive ? " (lost)" : ""}</div>
        ${dreamerStatsHtml(player.dreamer)}
        <div class="sub">${player.powerTokens} power · ${player.hand.length}/${handLimitForPlayer(state, player)} psyche · ${player.objects.length} obj · ${player.persistent?.length || 0} persistent</div>
      </div>
    `;
    chip.addEventListener("click", () => onSelectPlayer(index));
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

export function renderHand(state, onCardClick) {
  const hand = document.getElementById("hand");
  const stats = document.getElementById("hand-stats");
  const title = document.getElementById("hand-title");
  const player = activePlayer(state);
  hand.innerHTML = "";
  hand.classList.remove("coop-mode");
  if (title) title.textContent = "Your Psyche Hand";
  stats.innerHTML = handStatsHtml(state, player);

  player.hand.forEach((card) => {
    const el = renderCard(card, {
      selected: state.selectedHand.includes(card.instanceId)
        || state.trade?.offerPsycheIds?.includes(card.instanceId),
      onClick: () => onCardClick(card, player),
    });
    hand.appendChild(el);
  });
}

export function renderCoopMeetHands(state, onCardClick) {
  const hand = document.getElementById("hand");
  const stats = document.getElementById("hand-stats");
  const title = document.getElementById("hand-title");
  hand.innerHTML = "";

  const poolCount = allSelectedCards(state).length;
  const poolTotal = coopMeetPlayTotal(state);
  const bonus = state.pendingPowerBonus ? ` · +${state.pendingPowerBonus} bonus pending` : "";
  if (title) title.textContent = "Cooperative Psyche Pool";
  stats.textContent = `${poolCount}/3 cards · total ${poolTotal}${bonus} · click any Dreamer's Psyche`;
  hand.classList.add("coop-mode");

  state.players.filter((p) => p.alive).forEach((player, index) => {
    const row = document.createElement("div");
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

  const decks = [
    { id: "dream", label: "Dream", count: state.dreamDeck.length },
    { id: "psyche", label: "Psyche", count: state.psycheDeck.length },
    { id: "archetype", label: "Archetype", count: state.archetypeDeck.length },
    { id: "dreambeast", label: "Dreambeasts", count: state.dreambeastDeck.length },
    { id: "object", label: "Objects", count: state.objectDeck.length },
    { id: "mindstream-lucidity", label: "Mindstream Lucidity", count: state.mindstreamDecks.lucidity.length, suit: "lucidity" },
    { id: "mindstream-elasticity", label: "Mindstream Elasticity", count: state.mindstreamDecks.elasticity.length, suit: "elasticity" },
    { id: "mindstream-willpower", label: "Mindstream Willpower", count: state.mindstreamDecks.willpower.length, suit: "willpower" },
    { id: "subconscious", label: "Subconscious", count: subconsciousCount(state.subconscious) },
  ];

  decks.forEach((deck) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `deck-pile ${deck.suit ? `suit-${deck.suit}` : ""}`;
    const suitMark = deck.suit ? `${suitIconHtml(deck.suit, { size: 12 })} ` : "";
    el.innerHTML = `<span>${suitMark}${deck.label}</span><strong>${deck.count}</strong>`;
    el.addEventListener("click", () => onDeckClick(deck.id));
    tray.appendChild(el);
  });
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
    kept.className = "kept-archetypes";
    kept.innerHTML = `<h4>In Play</h4><div class="mini-card-row">${state.persistentArchetypes.map((a) =>
      `<span class="kept-arch">${a.name} (+1 Persistent)</span>`).join("")}</div>`;
    archetypeSlot.appendChild(kept);
  }

  if (state.activeArchetype) {
    const card = { ...state.activeArchetype };
    const statuses = getQuestStatus(state, card);
    const questHtml = statuses.length
      ? `<ul class="quest-list compact">${statuses.map((q) =>
          `<li class="${q.done ? "done" : ""}">${q.index + 1}. ${q.text}${q.done ? " ✓" : ""}</li>`).join("")}</ul>`
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
  document.getElementById("phase-banner").textContent =
    `Round ${state.round} · ${head.name} is Head ★${meetInfo}${bonus}${hint ? ` · ${hint}` : ""}`;
}

const PHASES = ["Reveal", "Explore", "Meet"];

export function renderPhaseStepper(state) {
  const el = document.getElementById("phase-stepper");
  if (!el) return;
  const current = getPhase(state);
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

export function renderGuidePanel(state) {
  const el = document.getElementById("guide-panel");
  if (!el) return;
  const obj = getCurrentObjective(state);
  if (!obj) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  const steps = obj.steps.map((s) => `<li>${formatGuideStep(s)}</li>`).join("");
  const tip = obj.tip ? `<p class="guide-tip">💡 ${obj.tip}</p>` : "";
  el.innerHTML = `
    <div class="guide-header suit-${obj.suit || "lucidity"}">
      <span class="guide-icon">${suitIconHtml(obj.suit || "lucidity", { size: 16 })}</span>
      <span class="guide-title">${obj.title}</span>
      <span class="guide-phase">${obj.phase}</span>
    </div>
    <ol class="guide-steps">${steps}</ol>
    ${tip}
  `;
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

export function renderPhaseActions(actions) {
  const container = document.getElementById("phase-actions");
  if (!container) return;
  container.innerHTML = "";

  const grouped = {};
  actions.forEach((action) => {
    const section = action.section || "main";
    if (!grouped[section]) grouped[section] = [];
    grouped[section].push(action);
  });

  const primarySections = ["main", "encounter", "phase", "round"];
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

export function renderDreamerPicker(dreamers, selectedIds, onToggle) {
  const picker = document.getElementById("dreamer-picker");
  picker.innerHTML = "";

  dreamers.forEach((dreamer) => {
    const selected = selectedIds.includes(dreamer.id);
    const wrapper = document.createElement("div");
    wrapper.className = `dreamer-pick ${selected ? "selected" : ""}`;
    const card = renderCard(
      { ...dreamer, type: "dreamer" },
      {
        portrait: true,
        selected,
        onClick: () => onToggle(dreamer.id),
      }
    );
    const stats = document.createElement("div");
    stats.className = "dreamer-pick-stats";
    stats.innerHTML = `<div class="dreamer-pick-name">${dreamer.name}</div>${dreamerStatsHtml(dreamer)}`;
    wrapper.appendChild(card);
    wrapper.appendChild(stats);
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
    <p class="setup-tip">New to Somnia? Read the <strong>Game Overview</strong>, open <strong>How to Play</strong>, or try the <strong>Tutorial</strong> below.</p>
  `;
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  const inGame = id === "screen-game";
  document.getElementById("hud").classList.toggle("hidden", !inGame);
  document.getElementById("header-actions")?.classList.toggle("hidden", !inGame);
}

export function showEndScreen(won, message) {
  showScreen("screen-end");
  document.getElementById("end-title").textContent = won ? "You Wake Up!" : "Trapped Forever";
  document.getElementById("end-message").textContent = message;
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
    <p>Choose ${remaining} card(s) to Return to discard piles.</p>
    <div id="subconscious-piles" class="subconscious-piles"></div>
    <div class="utility-actions">
      <button type="button" class="btn" id="return-skip">Skip remaining</button>
    </div>
  `;

  const container = body.querySelector("#subconscious-piles");
  subconsciousPilesForUI(state).forEach((pile) => {
    const section = document.createElement("div");
    section.className = "subconscious-pile";
    section.innerHTML = `<h4>${pile.label} (${pile.cards.length})</h4>`;
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

  body.querySelector("#return-skip")?.addEventListener("click", () => {
    hideUtilityModal();
    onDone();
  });

  modal.classList.remove("hidden");
}

export function showSubconsciousBrowse(state, onCardClick) {
  const modal = document.getElementById("utility-modal");
  const body = document.getElementById("utility-modal-body");
  body.innerHTML = `
    <h2>The Subconscious</h2>
    <p>Face-up repressed cards (searchable when Returning).</p>
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
  document.getElementById("utility-modal").classList.add("hidden");
}

let tutorialHighlightEl = null;

function clearTutorialHighlight() {
  if (tutorialHighlightEl) {
    tutorialHighlightEl.classList.remove("tutorial-highlight");
    tutorialHighlightEl = null;
  }
}

export function showTutorialStep(step, stepIndex, total, { onNext, onSkip }) {
  const overlay = document.getElementById("tutorial-overlay");
  if (!overlay) return;

  document.getElementById("tutorial-title").textContent = step.title;
  document.getElementById("tutorial-body").textContent = step.body;
  document.getElementById("tutorial-progress").textContent = `${stepIndex + 1} / ${total}`;
  document.getElementById("tutorial-next").textContent = stepIndex >= total - 1 ? "Done" : "Next";

  clearTutorialHighlight();
  if (step.target) {
    const target = document.querySelector(step.target);
    if (target) {
      target.classList.add("tutorial-highlight");
      tutorialHighlightEl = target;
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  const nextBtn = document.getElementById("tutorial-next");
  const skipBtn = document.getElementById("tutorial-skip");
  const backdrop = overlay.querySelector(".tutorial-backdrop");

  const cleanup = () => {
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    skipBtn.replaceWith(skipBtn.cloneNode(true));
    backdrop?.replaceWith(backdrop.cloneNode(true));
  };

  cleanup();
  const freshNext = document.getElementById("tutorial-next");
  const freshSkip = document.getElementById("tutorial-skip");
  const freshBackdrop = overlay.querySelector(".tutorial-backdrop");

  freshNext.addEventListener("click", onNext);
  freshSkip.addEventListener("click", onSkip);
  freshBackdrop?.addEventListener("click", onSkip);

  overlay.classList.remove("hidden");
}

export function hideTutorial() {
  clearTutorialHighlight();
  document.getElementById("tutorial-overlay")?.classList.add("hidden");
}

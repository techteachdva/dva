import { getPhase, activePlayer, headPlayer } from "./state.js";
import { coopMeetPlayTotal, allSelectedCards } from "./rules.js";
import { handLimitForPlayer } from "./objects.js";
import { SUIT_SYMBOLS, SUIT_LABELS } from "./rules.js";
import { getQuestStatus } from "./quests.js";
import { hexToPixel, boardPixelBounds } from "./hex.js";
import { subconsciousCount, subconsciousPilesForUI } from "./subconscious.js";

function suitClass(suit) {
  return suit ? `suit-${suit}` : "";
}

function cardTypeClass(card) {
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

  const symbol = SUIT_SYMBOLS[card.suit] || "";
  const label = SUIT_LABELS[card.suit] || card.suit;

  el.innerHTML = `
    <span class="psyche-value">${card.value}</span>
    <span class="psyche-suit ${suitClass(card.suit)}">${symbol}</span>
    <span class="psyche-label">${label}</span>
  `;

  if (onClick) el.addEventListener("click", onClick);
  return el;
}

function dreamerStatsHtml(dreamer) {
  return `
    <div class="dreamer-stats">
      <span class="stat suit-lucidity" title="Lucidity">◆${dreamer.lucidity}</span>
      <span class="stat suit-elasticity" title="Elasticity">◇${dreamer.elasticity}</span>
      <span class="stat suit-willpower" title="Willpower">▲${dreamer.willpower}</span>
    </div>
  `;
}

function suitGradient(card) {
  const colors = {
    lucidity: "#1a3a5c",
    elasticity: "#1a4a3a",
    willpower: "#4a2a1a",
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
  const suit = card.suit ? `<span class="meta"><span class="${suitClass(card.suit)}">${card.suit}</span></span>` : "";
  const subtype = card.subtype ? `<span class="meta"><span>${card.subtype}</span></span>` : "";

  const art = createArtElement(card);
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
        <span class="psyche-suit large ${suitClass(card.suit)}">${SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <h2>${SUIT_LABELS[card.suit]} ${card.value}</h2>
      <p>Psyche card — used for Reveal (◆), Explore (◇), and Meet (▲) phases.</p>
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
      <span class="stat-pill suit-lucidity">Lucidity +${card.lucidity}</span>
      <span class="stat-pill suit-elasticity">Elasticity +${card.elasticity}</span>
      <span class="stat-pill suit-willpower">Willpower +${card.willpower}</span>
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
  const limit = handLimitForPlayer(state, player);
  if (title) title.textContent = "Your Psyche Hand";
  stats.textContent = `◆${player.dreamer.lucidity} ◇${player.dreamer.elasticity} ▲${player.dreamer.willpower} · ${player.hand.length}/${limit} · ${player.powerTokens} power`;

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
    { id: "mindstream-lucidity", label: "Mindstream ◆", count: state.mindstreamDecks.lucidity.length, suit: "lucidity" },
    { id: "mindstream-elasticity", label: "Mindstream ◇", count: state.mindstreamDecks.elasticity.length, suit: "elasticity" },
    { id: "mindstream-willpower", label: "Mindstream ▲", count: state.mindstreamDecks.willpower.length, suit: "willpower" },
    { id: "subconscious", label: "Subconscious", count: subconsciousCount(state.subconscious) },
  ];

  decks.forEach((deck) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `deck-pile ${deck.suit ? `suit-${deck.suit}` : ""}`;
    el.innerHTML = `<span>${deck.label}</span><strong>${deck.count}</strong>`;
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
  const meetInfo = state.meetActionBudget
    ? ` · ${state.meetActionsUsed}/${state.meetActionBudget} actions`
    : state.exploreMovesLeft
      ? ` · ${state.exploreMovesLeft} moves`
      : "";
  const bonus = state.pendingPowerBonus ? ` · +${state.pendingPowerBonus} pending` : "";
  document.getElementById("phase-banner").textContent =
    `${getPhase(state)} — ${headPlayer(state).name} is Head${meetInfo}${bonus}${hint ? ` · ${hint}` : ""}`;
}

export function renderLog(state) {
  const log = document.getElementById("log");
  log.innerHTML = state.log.map((line) => `<div>${line}</div>`).join("");
}

export function renderPhaseActions(actions) {
  const container = document.getElementById("phase-actions");
  container.innerHTML = "";
  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${action.primary ? "primary" : ""}`;
    btn.textContent = action.label;
    btn.disabled = !!action.disabled;
    btn.addEventListener("click", action.onClick);
    container.appendChild(btn);
  });
}

export function renderDreamerPicker(dreamers, selectedIds, onToggle) {
  const picker = document.getElementById("dreamer-picker");
  picker.innerHTML = "";

  dreamers.forEach((dreamer) => {
    const selected = selectedIds.includes(dreamer.id);
    const wrapper = document.createElement("div");
    wrapper.className = `dreamer-pick ${selected ? "selected" : ""}`;
    const card = renderCard(
      { ...dreamer, suit: "lucidity" },
      {
        portrait: true,
        selected,
        onClick: () => onToggle(dreamer.id),
      }
    );
    const stats = document.createElement("div");
    stats.className = "dreamer-pick-stats";
    stats.innerHTML = dreamerStatsHtml(dreamer);
    wrapper.appendChild(card);
    wrapper.appendChild(stats);
    picker.appendChild(wrapper);
  });
}

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === id);
  });
  document.getElementById("hud").classList.toggle("hidden", id !== "screen-game");
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
    <div class="utility-actions">
      <button type="button" class="btn" data-suit="lucidity">◆ Lucidity</button>
      <button type="button" class="btn" data-suit="elasticity">◇ Elasticity</button>
      <button type="button" class="btn" data-suit="willpower">▲ Willpower</button>
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
    const card = renderCard({ ...dreamer, suit: "lucidity" }, {
      portrait: true,
      onClick: () => {
        hideUtilityModal();
        onPick(dreamer.id);
      },
    });
    picker.appendChild(card);
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

import { getPhase, activePlayer, headPlayer } from "./state.js";

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

export function renderBoard(state, onSelectLandscape) {
  const board = document.getElementById("hex-board");
  board.innerHTML = "";

  state.board.forEach((tile) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = [
      "hex-tile",
      tile.center ? "center" : "",
      tile.wasteland ? "wasteland" : "",
      !tile.revealed ? "hidden-tile" : "",
      state.selectedLandscapeId === tile.id ? "selected" : "",
      tile.suit ? `suit-${tile.suit}` : "",
    ].filter(Boolean).join(" ");

    if (tile.revealed && tile.image) {
      el.style.backgroundImage = `url('${tile.image}')`;
    } else if (!tile.revealed) {
      const wl = tile.wastelandImage || "images/landscapes/wasteland.png";
      el.style.backgroundImage = `url('${wl}')`;
    }

    const occupants = state.players.filter((p) => p.landscapeId === tile.id && p.alive);
    const encounter = tile.encounter;
    const encounterMark = encounter ? "⚔" : "";

    el.innerHTML = `
      <div class="hex-overlay"></div>
      <div class="name">${tile.revealed ? tile.name : "???"}</div>
      <div class="suit">${tile.revealed ? (tile.suit || "neutral") : "hidden"}</div>
      <div class="tokens">${occupants.map((p) => p.dreamer.name.split(" ").pop()).join(" · ")} ${encounterMark}${encounter ? ` ${encounter.name.split(" ")[0]}` : ""}</div>
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
    chip.className = `player-chip ${index === state.activePlayerIndex ? "active" : ""}`;
    chip.innerHTML = `
      <img src="${player.dreamer.image}" alt="" onerror="this.style.display='none'">
      <div class="info">
        <div class="name">${player.name}${player.isHead ? " ★" : ""}</div>
        <div class="sub">${player.powerTokens} power · ${player.hand.length} psyche · ${player.objects.length} obj</div>
      </div>
    `;
    chip.addEventListener("click", () => onSelectPlayer(index));
    list.appendChild(chip);
  });
}

export function renderObjects(state, onCardClick) {
  const container = document.getElementById("player-objects");
  if (!container) return;
  container.innerHTML = "";
  const player = activePlayer(state);

  if (!player.objects.length) {
    container.textContent = "No Objects held.";
    return;
  }

  player.objects.forEach((card) => {
    container.appendChild(renderCard(card, {
      mini: true,
      onClick: () => onCardClick(card),
    }));
  });
}

export function renderHand(state, onCardClick) {
  const hand = document.getElementById("hand");
  const stats = document.getElementById("hand-stats");
  const player = activePlayer(state);
  hand.innerHTML = "";
  stats.textContent = `${player.hand.length}/10 cards · ${player.powerTokens} power · ${player.objects.length} objects`;

  player.hand.forEach((card) => {
    const el = renderCard(card, {
      selected: state.selectedHand.includes(card.instanceId),
      onClick: () => onCardClick(card),
    });
    hand.appendChild(el);
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
    { id: "subconscious", label: "Subconscious", count: state.subconscious.length },
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

  if (state.activeArchetype) {
    const card = { ...state.activeArchetype };
    archetypeSlot.appendChild(renderCard(card, {
      portrait: true,
      onClick: () => onCardClick(card),
    }));
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

export function renderHud(state) {
  document.getElementById("hud-goal").textContent = `${state.goalPoints} pts`;
  document.getElementById("hud-points").textContent = String(state.acquiredPoints);
  document.getElementById("hud-dreams").textContent = String(state.dreamDeck.length);
  document.getElementById("hud-round").textContent = String(state.round);
  document.getElementById("hud-phase").textContent = getPhase(state);
  const meetInfo = state.meetActionLimit
    ? ` · ${state.meetActions}/${state.meetActionLimit} actions`
    : "";
  document.getElementById("phase-banner").textContent =
    `${getPhase(state)} Phase — ${headPlayer(state).name} is Head Dreamer${meetInfo}`;
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
    const card = renderCard(
      { ...dreamer, suit: "lucidity" },
      {
        portrait: true,
        selected,
        onClick: () => onToggle(dreamer.id),
      }
    );
    picker.appendChild(card);
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

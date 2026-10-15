/**
 * Phones: the Psyche hand lives in a drawer. The bottom strip shows a Hand
 * button with the count per suit; tap it and the whole hand slides up at a
 * readable size. The board keeps the rest of the screen. The drawer opens by
 * itself when a fight asks for a spread, and closes when the dice roll.
 */

let lastFightKey = "";
let bound = false;

function isPhone() {
  return document.documentElement?.dataset?.form === "phone";
}

function setOpen(open) {
  document.body.classList.toggle("hand-drawer-open", !!open);
  const btn = document.getElementById("hand-drawer-btn");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}

export function isHandDrawerOpen() {
  return document.body.classList.contains("hand-drawer-open");
}

function ensureChrome() {
  const bar = document.getElementById("hand-bar");
  const section = bar?.querySelector(".psyche-hand-section");
  if (!bar || !section) return null;
  let btn = document.getElementById("hand-drawer-btn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "hand-drawer-btn";
    btn.className = "hand-drawer-btn";
    btn.setAttribute("aria-controls", "hand-primary");
    btn.setAttribute("aria-expanded", "false");
    bar.appendChild(btn);
  }
  let close = section.querySelector(".hand-drawer-close");
  if (!close) {
    close = document.createElement("button");
    close.type = "button";
    close.className = "hand-drawer-close";
    close.setAttribute("aria-label", "Close your hand");
    close.textContent = "Done";
    section.appendChild(close);
  }
  if (!bound) {
    bound = true;
    btn.addEventListener("click", () => setOpen(!isHandDrawerOpen()));
    close.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isHandDrawerOpen() && isPhone()) {
        setOpen(false);
        event.stopPropagation();
      }
    }, true);
  }
  return btn;
}

const SUIT_DOT = { lucidity: "#5f9dff", elasticity: "#ffd25e", willpower: "#ff7a6e" };

export function renderHandDrawer(state) {
  if (typeof document === "undefined") return;
  if (!isPhone() || !state || state.status !== "playing") {
    setOpen(false);
    return;
  }
  const btn = ensureChrome();
  if (!btn) return;
  const me = (state.players || []).find((p) => p.alive) || state.players?.[0];
  const hand = me?.hand || [];
  const count = { lucidity: 0, elasticity: 0, willpower: 0 };
  hand.forEach((c) => { if (count[c.suit] != null) count[c.suit] += 1; });
  const selected = (state.selectedHand || []).length;
  const dots = Object.entries(count)
    .map(([suit, n]) => `<span class="hd-suit" style="--dot:${SUIT_DOT[suit]}">${n}</span>`)
    .join("");
  const html = `<span class="hd-label">Hand</span><span class="hd-count">${hand.length}</span><span class="hd-suits">${dots}</span>${selected ? `<span class="hd-picked">${selected} picked</span>` : ""}`;
  if (btn.dataset.html !== html) {
    btn.dataset.html = html;
    btn.innerHTML = html;
    btn.setAttribute("aria-label", `Your hand: ${hand.length} Psyche. Tap to ${isHandDrawerOpen() ? "close" : "open"}.`);
  }
  // A fight wants a spread: bring the hand up. The roll puts it away.
  const fightKey = state.archetypeFight ? `${state.archetypeFight.archId}:${state.round}` : "";
  if (fightKey && fightKey !== lastFightKey && !state.diceBattle) setOpen(true);
  if (state.diceBattle && isHandDrawerOpen()) setOpen(false);
  lastFightKey = fightKey;
  btn.classList.toggle("is-wanted", !!fightKey && !selected);
}

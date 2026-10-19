/**
 * The First Night guide card: what to do now, the rule behind it, and a glow
 * on the control to use. It never blocks a click and never covers the thing it
 * points at: on the table it sits in the left rail's free space, beside a menu
 * it docks to the left edge, and on a phone it folds into a small pill.
 */

import { currentCoachHint, dismissCoachHint, hideCoach, showCoach, isGuided } from "../tutorial/coach.js";
import { isPhaseOpenerMenuOpen, isPhaseOpenerParked } from "../flow/phase-opener-menu.js";

let lastKey = "";
let lastStepId = "";
let lastTargets = [];
let resizeBound = false;
let lastArgs = null;
/** Phones: the card is open when a new step arrives, folded once read. */
let compactOpen = true;
let foldTimer = null;
/** Phones fold the card into its pill after a short read, unless the player is reading the why. */
const COMPACT_FOLD_MS = 8000;

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

function shown(el) {
  if (!el || el.hidden) return false;
  if (el.classList.contains("hidden")) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.05;
}

/** What is on screen right now, read from the page. */
function screenContext(state) {
  const body = document.body;
  const gate = body.classList.contains("opening-cinematic-pending")
    || shown(document.getElementById("fullscreen-prompt"));
  const utility = document.getElementById("utility-modal");
  const utilityOpen = shown(utility) && !utility.classList.contains("utility-modal-minimized");
  const opener = isPhaseOpenerMenuOpen() && !isPhaseOpenerParked() && utilityOpen;
  const msChoice = !!state.pendingMindstreamChoice;
  return {
    gate,
    cycleScreen: shown(document.getElementById("cycle-screen")),
    vaultScreen: shown(document.getElementById("vault-screen")),
    lostFound: shown(document.getElementById("lost-found")),
    archetypeChoice: shown(document.getElementById("archetype-choice")),
    dice: !!state.diceBattle || shown(document.getElementById("dice-battle-stage")),
    opener,
    otherModal: (utilityOpen && !opener && !msChoice) || shown(document.getElementById("card-modal")),
    artScreen: msChoice && utilityOpen,
    brightLocked: !!document.querySelector("#utility-modal .ms-choice-btn--good:disabled"),
    fightLabel: document.querySelector(".spread-fight-btn")?.textContent || "",
    openerUsable: opener ? document.querySelectorAll(".phase-opener-solo-hand .opener-usable").length : -1,
  };
}

function compactForm() {
  const form = document.documentElement.dataset.form;
  return form === "phone" || form === "tablet" || window.innerWidth < 1100 || window.innerHeight < 600;
}

function clearTargets() {
  lastTargets.forEach((el) => el.classList.remove("guide-target"));
  lastTargets = [];
}

function lightTargets(selector) {
  clearTargets();
  if (!selector) return;
  let found = [];
  try {
    found = [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length).slice(0, 3);
  } catch {
    found = [];
  }
  found.forEach((el) => el.classList.add("guide-target"));
  lastTargets = found;
}

/** Free vertical space inside the left rail, between its sections, if any is big enough. */
function railGap(minHeight) {
  const rail = document.querySelector("#screen-game #sidebar-right");
  if (!rail || !rail.getClientRects().length) return null;
  const railRect = rail.getBoundingClientRect();
  if (railRect.width < 220) return null;
  const powers = rail.querySelector(".rail-powers");
  const forms = rail.querySelector(".rail-forms");
  if (!powers || !forms) return null;
  const used = [...powers.children].filter((el) => el.getClientRects().length);
  const contentBottom = used.length ? Math.max(...used.map((el) => el.getBoundingClientRect().bottom)) : powers.getBoundingClientRect().top;
  const top = contentBottom + 10;
  const bottom = forms.getBoundingClientRect().top - 10;
  if (bottom - top < minHeight) return null;
  return { left: railRect.left + 10, width: railRect.width - 20, top, bottom };
}

function isPhone() {
  return document.documentElement.dataset.form === "phone";
}

/** Phones (0.31): the guide's strip pushes menus down by its own height, so it covers nothing. */
function clearStrip() {
  document.body.classList.remove("guide-strip");
  document.documentElement.style.removeProperty("--guide-strip-h");
}

function placeStrip(host, overMenu = true) {
  host.classList.add("is-strip");
  // On the table the strip hangs under the command bar and pushes nothing.
  if (!overMenu) {
    host.classList.add("is-under-bar");
    return;
  }
  document.body.classList.add("guide-strip");
  const h = Math.ceil(host.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--guide-strip-h", `${h + 6}px`);
}

/** Phones on the table: the card waits in the free column right of the board, above Next. */
function placeSide(host) {
  const vw = window.innerWidth;
  const board = document.getElementById("hex-board")?.getBoundingClientRect();
  const bar = document.querySelector(".top-bar.play-top-bar")?.getBoundingClientRect();
  const arch = document.getElementById("archetype-window");
  const archRect = arch && !arch.hidden && arch.getClientRects().length ? arch.getBoundingClientRect() : null;
  const next = document.getElementById("btn-next-phase");
  const nextRect = next && !next.hidden && next.getClientRects().length ? next.getBoundingClientRect() : null;
  const safeRight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sa-r")) || 0;
  const right = vw - 8 - safeRight;
  const left = Math.max((board?.right || vw * 0.62) + 8, right - 300);
  const top = Math.max(archRect ? archRect.bottom + 6 : 0, bar ? bar.bottom + 6 : 54);
  const bottom = nextRect ? nextRect.top - 6 : window.innerHeight - 60;
  if (right - left < 180 || bottom - top < 96) return false;
  host.classList.add("is-side");
  host.style.left = `${Math.round(left)}px`;
  host.style.top = `${Math.round(top)}px`;
  host.style.width = `${Math.round(right - left)}px`;
  host.style.setProperty("--side-max-h", `${Math.round(bottom - top)}px`);
  // A card taller than the gap would clip its buttons: it takes the top strip instead.
  const card = host.firstElementChild;
  if (card && card.scrollHeight > bottom - top + 1) {
    host.classList.remove("is-side");
    host.style.cssText = "";
    return false;
  }
  return true;
}

function place(host, ctx, minimized) {
  const card = host.firstElementChild;
  host.style.cssText = "";
  host.className = "coach-hint";
  document.body.classList.remove("guide-docked");
  clearStrip();
  if (!card) return;
  const menuUp = ctx.cycleScreen || ctx.vaultScreen || ctx.lostFound || ctx.archetypeChoice || ctx.opener || ctx.dice
    || document.querySelector("#utility-modal.ms-choice-modal:not(.hidden)");
  if (compactForm()) {
    host.classList.add("is-compact");
    if (isPhone()) {
      const drawerUp = document.body.classList.contains("hand-drawer-open")
        || [...document.querySelectorAll(".spread-fight-btn")].some((el) => el.getClientRects().length);
      if (menuUp) placeStrip(host);
      else if (drawerUp || !placeSide(host)) placeStrip(host, false);
      return;
    }
    // Phones (0.28): the card docks bottom-right over the empty end of the hand bar, and
    // moves to the top whenever the bottom holds what the guide is pointing at.
    const spreadUp = [...document.querySelectorAll(".spread-fight-btn")].some((el) => el.getClientRects().length);
    if (menuUp || spreadUp || document.body.classList.contains("hand-drawer-open")) host.classList.add("is-top");
    if (menuUp) host.classList.add("is-over-menu");
    return;
  }
  if (ctx.artScreen) {
    // Dream and Event screens put their choices mid-height: the guide waits in the corner.
    host.classList.add("is-docked", "is-low");
    return;
  }
  if (menuUp) {
    host.classList.add("is-docked");
    if (!minimized) document.body.classList.add("guide-docked");
    return;
  }
  const height = card.getBoundingClientRect().height || 180;
  const gap = minimized ? null : railGap(height);
  if (gap) {
    host.classList.add("is-rail");
    host.style.left = `${Math.round(gap.left)}px`;
    host.style.top = `${Math.round(gap.top + Math.max(0, (gap.bottom - gap.top - height) / 2))}px`;
    host.style.width = `${Math.round(gap.width)}px`;
    return;
  }
  host.classList.add("is-corner");
  const rail = document.querySelector("#screen-game #sidebar-right");
  const railRight = rail?.getClientRects().length ? rail.getBoundingClientRect().right : 0;
  host.style.left = `${Math.round(railRight + 14)}px`;
}

function cardHtml(hint, compact = false) {
  const why = !hint.why ? "" : compact
    ? `<details class="coach-why-fold"${hint.showWhy ? "" : ""}><summary>Why?</summary><p class="coach-why">${esc(hint.why)}</p></details>`
    : hint.showWhy ? `<p class="coach-why">${esc(hint.why)}</p>` : "";
  return `
    <div class="coach-card" role="status" aria-live="polite">
      <div class="coach-head">
        <span class="coach-spark" aria-hidden="true">✧</span>
        <span class="coach-goal">${esc(hint.goal)}</span>
        <button type="button" class="coach-min" data-coach-min aria-label="Fold the guide" title="Fold the guide">–</button>
      </div>
      <p class="coach-title">${esc(hint.title)}</p>
      <p class="coach-text">${esc(hint.text)}</p>
      ${why}
      <div class="coach-actions">
        ${hint.showWhy && !compact ? `<button type="button" class="coach-btn" data-coach-ok>Got it</button>` : ""}
        <button type="button" class="coach-btn coach-btn-quiet" data-coach-hide>Guide off</button>
      </div>
    </div>`;
}

function pillHtml(hint) {
  return `<button type="button" class="coach-pill" data-coach-open aria-label="Open the guide: ${esc(hint?.title || "")}">
      <span class="coach-spark" aria-hidden="true">✧</span><span>${esc(hint?.title || "Guide")}</span>
    </button>`;
}

function farewellHtml() {
  return `
    <div class="coach-card coach-farewell" role="status" aria-live="polite">
      <div class="coach-head"><span class="coach-spark" aria-hidden="true">✧</span><span class="coach-goal">First Night</span></div>
      <p class="coach-title">You know the night now</p>
      <p class="coach-text">Reveal builds, Explore walks, Meet acts. Survive the Dreams, outlast the Dreambeasts, and Acquire Archetypes until you wake. The guide steps back here.</p>
      <p class="coach-why">Forgot a rule? The ? button in the top bar has all of them.</p>
      <div class="coach-actions"><button type="button" class="coach-btn" data-coach-bye>Into the night</button></div>
    </div>`;
}

function bind(host, state, hint, onChange) {
  host.querySelector("[data-coach-ok]")?.addEventListener("click", () => {
    dismissCoachHint(state, hint.id);
    if (compactForm()) compactOpen = false;
    lastKey = "";
    onChange?.();
  });
  host.querySelector("[data-coach-hide]")?.addEventListener("click", () => {
    hideCoach(state);
    state.coachOff = true;
    lastKey = "";
    onChange?.();
  });
  host.querySelector("[data-coach-min]")?.addEventListener("click", () => {
    if (compactForm()) compactOpen = false;
    else hideCoach(state);
    lastKey = "";
    onChange?.();
  });
  host.querySelector("[data-coach-open]")?.addEventListener("click", () => {
    compactOpen = true;
    showCoach(state);
    lastKey = "";
    onChange?.();
  });
  host.querySelector("[data-coach-bye]")?.addEventListener("click", () => {
    state.coachFarewellSeen = true;
    lastKey = "";
    onChange?.();
  });
}

function hideHost(host) {
  host.hidden = true;
  host.innerHTML = "";
  host.className = "coach-hint";
  host.style.cssText = "";
  document.body.classList.remove("guide-docked");
  clearStrip();
  clearTargets();
  lastKey = "";
}

export function renderCoach(state, { onChange } = {}) {
  const host = document.getElementById("coach-hint");
  if (!host) return;
  lastArgs = { state, onChange };
  if (!resizeBound) {
    resizeBound = true;
    const again = () => { if (lastArgs) renderCoach(lastArgs.state, { onChange: lastArgs.onChange }); };
    window.addEventListener("resize", () => { lastKey = ""; again(); });
    // Menus open and close outside the main render; a light tick keeps the guide in step.
    setInterval(() => { if (lastArgs?.state?.guided && !document.hidden) again(); }, 450);
  }
  if (!state?.guided || state.coachOff) {
    hideHost(host);
    return;
  }
  const ctx = screenContext(state);

  // The goodbye card, once, when the guide steps back.
  if (!isGuided(state)) {
    if (state.coachFarewellSeen || ctx.gate || state.status !== "playing") {
      hideHost(host);
      return;
    }
    const key = "farewell";
    host.hidden = false;
    if (key !== lastKey) {
      lastKey = key;
      host.innerHTML = farewellHtml();
      bind(host, state, null, onChange);
    }
    clearTargets();
    place(host, ctx, false);
    return;
  }

  const hint = currentCoachHint(state, ctx);
  if (!hint) {
    hideHost(host);
    return;
  }
  // A new step: the last one has been read, so it shrinks to its one line next time.
  const compact = compactForm();
  if (hint.id !== lastStepId) {
    if (lastStepId) dismissCoachHint(state, lastStepId);
    lastStepId = hint.id;
    compactOpen = true;
    window.clearTimeout(foldTimer);
    if (compact) {
      foldTimer = window.setTimeout(() => {
        if (host.querySelector(".coach-why-fold[open]")) return;
        compactOpen = false;
        lastKey = "";
        if (lastArgs) renderCoach(lastArgs.state, { onChange: lastArgs.onChange });
      }, COMPACT_FOLD_MS);
    }
  }
  const drawerOpen = document.body.classList.contains("hand-drawer-open");
  const minimized = compact ? (!compactOpen || drawerOpen) : !!state.coachHidden;
  host.hidden = false;
  const key = JSON.stringify([hint.id, hint.title, hint.text, hint.goal, hint.showWhy, minimized, compact, drawerOpen]);
  if (key !== lastKey) {
    lastKey = key;
    host.innerHTML = minimized ? pillHtml(hint) : cardHtml(hint, compact);
    bind(host, state, hint, onChange);
  }
  lightTargets(minimized ? null : hint.target);
  place(host, ctx, minimized);
  if (minimized) host.classList.add("is-min");
}

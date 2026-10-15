/**
 * Menus hand off to each other without the table flashing through.
 * When a menu closes, a dim layer holds the dark for a moment; if the next
 * menu opens in that time it fades in over the dark, not over a bright table.
 */

const HOLD_MS = 450;
const SETTLE_MS = 600;

let bridge = null;
let root = null;
let wasOpen = false;
let held = false;
let holdTimer = 0;
let settleTimer = 0;
let queued = false;

function modalOpen(id) {
  const modal = document.getElementById(id);
  return !!modal && !modal.hidden && !modal.classList.contains("hidden");
}

function menuOpen() {
  for (const host of root.querySelectorAll(".lost-found")) {
    if (host.hidden || host.classList.contains("is-leaving")) continue;
    if (host.querySelector(".lf-veil")) return true;
  }
  return modalOpen("utility-modal") || modalOpen("card-modal");
}

/** Only touch a class when it changes: a no-op classList write still re-fires the observer. */
function setClass(el, name, on) {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}

function show() {
  clearTimeout(settleTimer);
  settleTimer = 0;
  held = true;
  setClass(bridge, "is-held", true);
  setClass(root, "menu-bridge-lift", modalOpen("card-modal"));
}

function release() {
  clearTimeout(holdTimer);
  clearTimeout(settleTimer);
  settleTimer = 0;
  held = false;
  setClass(bridge, "is-held", false);
}

function check() {
  queued = false;
  const open = menuOpen();
  if (open && held) {
    // The next menu arrived on the dark: let it fade in, then lift the bridge.
    clearTimeout(holdTimer);
    setClass(root, "menu-bridge-lift", modalOpen("card-modal"));
    if (!settleTimer) settleTimer = window.setTimeout(release, SETTLE_MS);
  } else if (!open && wasOpen) {
    // A menu just closed: hold the dark in case another follows.
    show();
    clearTimeout(holdTimer);
    holdTimer = window.setTimeout(() => {
      if (!menuOpen()) release();
    }, HOLD_MS);
  }
  if (!open && !held) setClass(root, "menu-bridge-lift", false);
  wasOpen = open;
}

/**
 * A click inside a menu rebuilds its window. Only the first paint fades in;
 * a rebuild of a menu that is already open shows at once, so it never blinks.
 */
function settleRebuilds(records) {
  for (const record of records) {
    const host = record.target;
    if (record.type !== "childList" || !host.classList?.contains("lost-found")) continue;
    const hadVeil = [...record.removedNodes].some((n) => n.classList?.contains("lf-veil"));
    const hasVeil = [...record.addedNodes].some((n) => n.classList?.contains("lf-veil"));
    if (hadVeil || hasVeil) setClass(host, "lf-settled", hadVeil && hasVeil);
  }
}

export function initMenuBridge(container = document.querySelector(".play-window")) {
  if (!container || bridge) return;
  root = container;
  bridge = document.createElement("div");
  bridge.className = "menu-bridge";
  bridge.setAttribute("aria-hidden", "true");
  root.appendChild(bridge);
  wasOpen = menuOpen();
  new MutationObserver((records) => {
    settleRebuilds(records);
    if (queued) return;
    queued = true;
    queueMicrotask(check);
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
}

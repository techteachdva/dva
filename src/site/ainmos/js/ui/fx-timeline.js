/**
 * One beat at a time (0.30). Card flights, the dusk toll, the set spiral and
 * the Dreamscape fanfare each mark the table busy for as long as they play.
 * While it is busy, a menu that is just opening waits (invisible, untouchable),
 * then fades in once the cards have landed. Menus already open stay put.
 */

const MAX_HOLD_MS = 6000;
const GAP_MS = 140;
const MENU_SELECTOR = ".lost-found:not([hidden]), #utility-modal:not(.hidden), #card-modal:not(.hidden)";

let busyUntil = 0;
let timer = 0;
let startedAt = 0;

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function hasDom() {
  return typeof document !== "undefined" && !!document.body;
}

function release() {
  timer = 0;
  if (!hasDom()) return;
  const left = busyUntil - now();
  if (left > 0 && now() - startedAt < MAX_HOLD_MS) {
    timer = window.setTimeout(release, left + GAP_MS);
    return;
  }
  busyUntil = 0;
  document.body.classList.remove("fx-beat");
  document.querySelectorAll("[data-fx-keep]").forEach((el) => el.removeAttribute("data-fx-keep"));
  // Menus that waited fade in now, as their own beat.
  document.querySelectorAll(MENU_SELECTOR).forEach((el) => {
    if (!el.classList.contains("fx-beat-waited")) return;
    el.classList.remove("fx-beat-waited");
    el.classList.remove("fx-beat-reveal");
    void el.offsetWidth;
    el.classList.add("fx-beat-reveal");
    window.setTimeout(() => el.classList.remove("fx-beat-reveal"), 420);
  });
}

/** The table is busy with an animation for the next `ms`. */
export function markFxBusy(ms) {
  if (!hasDom() || !(ms > 0)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  const t = now();
  if (!document.body.classList.contains("fx-beat")) {
    startedAt = t;
    // Whatever menu is already open keeps showing; only new ones wait.
    document.querySelectorAll(MENU_SELECTOR).forEach((el) => el.setAttribute("data-fx-keep", ""));
    document.body.classList.add("fx-beat");
  }
  busyUntil = Math.max(busyUntil, t + ms);
  if (!timer) timer = window.setTimeout(release, busyUntil - t + GAP_MS);
}

/** Note menus that opened while the table was busy, so they fade in on release. */
export function noteWaitingMenus() {
  if (!hasDom() || !document.body.classList.contains("fx-beat")) return;
  // A kept menu that closed gives up its place: if it reopens now, it waits too.
  document.querySelectorAll("[data-fx-keep]").forEach((el) => {
    if (el.hidden || el.classList.contains("hidden")) el.removeAttribute("data-fx-keep");
  });
  document.querySelectorAll(MENU_SELECTOR).forEach((el) => {
    if (!el.hasAttribute("data-fx-keep")) el.classList.add("fx-beat-waited");
  });
}

export function fxBusy() {
  return hasDom() && document.body.classList.contains("fx-beat");
}

/** Resolve once every queued beat has played. */
export function whenFxSettled() {
  return new Promise((resolve) => {
    const check = () => (fxBusy() ? window.setTimeout(check, 80) : resolve());
    check();
  });
}

/**
 * A big menu is open (Cycle screen, Archetype choice, a Dream or choice window).
 * Card flights wait until it closes, so they never streak across it. The Lost &
 * Found and the Vault stay live: what you do there flies at once.
 */
const HOLDING_MENUS = ".dusk-toll, .set-spiral, .dream-whole, .dream-fold-banner, .beast-mill, #cycle-screen:not([hidden]), #boon-draft:not([hidden]), #archetype-choice:not([hidden]), #set-archetype:not([hidden]), #utility-modal:not(.hidden):not(.utility-modal-minimized), #card-modal:not(.hidden)";

export function menuHoldsFlights() {
  if (!hasDom()) return false;
  return !!document.querySelector(HOLDING_MENUS);
}

let flushTimer = 0;
/** Poll lightly until the menu closes, then run the queued flights. */
export function retryWhenMenusClose(run) {
  if (flushTimer || !hasDom()) return;
  const tick = () => {
    if (menuHoldsFlights()) {
      flushTimer = window.setTimeout(tick, 160);
      return;
    }
    flushTimer = 0;
    // Let the closing menu fade before the flights start.
    window.setTimeout(run, 220);
  };
  flushTimer = window.setTimeout(tick, 160);
}

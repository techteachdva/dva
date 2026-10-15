/**
 * Objects and Persistent Objects sit in horizontal strips under the board.
 * Swipe or drag them, turn the mouse wheel over them, or tap the big ‹ ›
 * buttons in their headers. The buttons dim at either end.
 */

const STRIP_IDS = ["player-objects", "player-persistent"];
let bound = false;

function strip(id) {
  return document.getElementById(id);
}

/** Dim a strip's buttons at its ends, and hide them when everything already fits. */
function syncButtons(id) {
  const el = strip(id);
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  const overflow = max > 4;
  document.querySelectorAll(`[data-scroll-target="${id}"]`).forEach((btn) => {
    const dir = Number(btn.dataset.scrollDir);
    btn.hidden = !overflow;
    btn.disabled = !overflow || (dir < 0 ? el.scrollLeft <= 2 : el.scrollLeft >= max - 2);
  });
}

/** Re-check every strip; call after the hand bar re-renders. */
export function refreshKeepsakeScrollers() {
  STRIP_IDS.forEach(syncButtons);
}

export function initKeepsakeScrollers() {
  if (bound) return;
  bound = true;
  document.addEventListener("click", (event) => {
    const btn = event.target.closest?.("[data-scroll-target]");
    if (!btn) return;
    const el = strip(btn.dataset.scrollTarget);
    if (!el) return;
    // Page by most of what is visible, so a tap always shows something new.
    el.scrollBy({ left: Number(btn.dataset.scrollDir) * Math.max(120, el.clientWidth * 0.8), behavior: "smooth" });
  });
  STRIP_IDS.forEach((id) => {
    const el = strip(id);
    if (!el) return;
    el.addEventListener("scroll", () => syncButtons(id), { passive: true });
    // A vertical wheel over a sideways strip scrolls it sideways.
    el.addEventListener("wheel", (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += event.deltaY;
      event.preventDefault();
    }, { passive: false });
  });
  window.addEventListener("resize", refreshKeepsakeScrollers);
  refreshKeepsakeScrollers();
}

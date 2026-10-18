/**
 * Ainmos 0.28: phone table chrome.
 *
 * Phones hide the night track to give the board its height back. Tapping the Cycle
 * chip in the command bar peeks it open below the bar; tapping anywhere else closes it.
 */

function isPhone() {
  return document.documentElement.dataset.form === "phone";
}

function setPeek(open) {
  document.body.classList.toggle("night-peek", !!open);
  const chip = document.getElementById("hud-cycle");
  chip?.setAttribute("aria-expanded", open ? "true" : "false");
}

/** A swipe shelf (Lost & Found, Vault) loses its edge fade once its last item is in view. */
function markShelfEnd(shelf) {
  const end = shelf.scrollLeft + shelf.clientWidth >= shelf.scrollWidth - 4;
  shelf.classList.toggle("is-scrolled-end", end);
}

function watchShelves() {
  document.addEventListener("scroll", (event) => {
    const el = event.target;
    if (el instanceof Element && el.classList.contains("lf-shelf")) markShelfEnd(el);
  }, { capture: true, passive: true });
  // New shelves render fitted already when they hold few items.
  new MutationObserver(() => {
    document.querySelectorAll(".lf-shelf").forEach(markShelfEnd);
  }).observe(document.body, { childList: true, subtree: true });
}

export function initMobileChrome() {
  watchShelves();
  const chip = document.getElementById("hud-cycle");
  if (!chip || chip.dataset.mobileBound) return;
  chip.dataset.mobileBound = "1";
  chip.setAttribute("role", "button");
  chip.setAttribute("tabindex", "0");
  chip.setAttribute("aria-controls", "night-strip");
  chip.setAttribute("aria-expanded", "false");
  const toggle = (event) => {
    if (!isPhone()) return;
    event.stopPropagation();
    setPeek(!document.body.classList.contains("night-peek"));
  };
  chip.addEventListener("click", toggle);
  chip.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") toggle(event);
  });
  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("night-peek")) return;
    if (event.target.closest("#night-strip, #hud-cycle")) return;
    setPeek(false);
  });
  window.addEventListener("somnia:capabilities", () => { if (!isPhone()) setPeek(false); });
}

/**
 * Ainmos: keep one-row bars on one screen.
 *
 * The top bar holds the brand, phase stepper, HUD, stats, and buttons in one
 * row. On a narrower window (a 1366px laptop) that row is wider than the
 * screen and the Pause and Subconscious buttons slide off the edge. This
 * measures the row and, only when it overflows, scales its pieces down just
 * enough to fit. Wide screens are untouched.
 */

const BARS = [".top-bar.play-top-bar"];
const MIN_FIT = 0.62;

function fitBar(bar) {
  const kids = [...bar.children].filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed");
  kids.forEach((el) => { el.style.zoom = ""; });
  // Phones and tablets have bars designed to fit (css/ainmos-mobile.css): never shrink one below a thumb.
  const form = document.documentElement.dataset.form;
  if (form === "phone" || form === "tablet") return;
  const avail = bar.clientWidth;
  const need = bar.scrollWidth;
  if (!avail || need <= avail + 1) return;
  // Gaps and padding don't scale, so step down until the row truly fits.
  let fit = Math.max(MIN_FIT, Math.floor((avail / need) * 1000) / 1000 - 0.005);
  for (let i = 0; i < 6; i += 1) {
    kids.forEach((el) => { el.style.zoom = String(fit); });
    if (bar.scrollWidth <= avail + 1 || fit <= MIN_FIT) break;
    fit = Math.max(MIN_FIT, fit - 0.02);
  }
}

let queued = false;
function fitAll() {
  queued = false;
  BARS.forEach((sel) => document.querySelectorAll(sel).forEach(fitBar));
}

export function scheduleFitBars() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(fitAll);
}

export function initFitBars() {
  window.addEventListener("resize", scheduleFitBars);
  if (typeof MutationObserver !== "undefined") {
    BARS.forEach((sel) => document.querySelectorAll(sel).forEach((bar) => {
      new MutationObserver(scheduleFitBars).observe(bar, { childList: true, subtree: true, characterData: true });
      // Showing the bar again (after a full-screen menu) changes its size: fit then too.
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(scheduleFitBars).observe(bar);
    }));
  }
  scheduleFitBars();
}

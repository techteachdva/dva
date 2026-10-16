/**
 * Ainmos 0.25: the ending nobody is meant to see. Beat
 * L3V1@+H@N D3$TR0Y3R 0F DR3@M$ and the dream crashes: the screen glitches,
 * drops to a blue screen of death, and a terminal types the same sentence
 * over and over (at least 100 lines). Tap or press a key to hurry it; once it
 * is done, "Wake up" leads on to the end screen.
 */

export const BSOD_LINE = "You dreamed a dream within a dream about a dreamer within a dream dreaming about a dream of a dreamer in a dream living a dream about a dream.";
export const BSOD_LINES = 108;

const GLITCH_MS = 1700;

let active = null;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

export function isBsodOpen() {
  return !!active;
}

/** Run the crash. `onDone` fires when the player chooses to wake. */
export function showBsod({ onDone } = {}) {
  if (typeof document === "undefined" || active) return;
  const body = document.body;
  body.classList.add("bsod-glitching");
  const host = document.createElement("div");
  host.id = "bsod";
  host.className = "bsod is-glitch";
  host.setAttribute("role", "alertdialog");
  host.setAttribute("aria-label", "The dream has crashed");
  host.innerHTML = `
    <div class="bsod-glitch" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="bsod-screen">
      <p class="bsod-face" aria-hidden="true">:(</p>
      <p class="bsod-head">Your dream ran into a problem and needs to restart. We're just collecting some dreams, and then we'll restart for you.</p>
      <p class="bsod-code">STOP CODE: DREAMER_WITHIN_A_DREAM (0x0000AINMOS)<br>What failed: L3V1@+H@N_D3$TR0Y3R_0F_DR3@M$.sys</p>
      <pre class="bsod-term" aria-live="off"></pre>
      <div class="bsod-foot">
        <span class="bsod-progress">0% complete</span>
        <button type="button" class="bsod-wake" hidden>Wake up</button>
      </div>
    </div>`;
  document.body.appendChild(host);
  const term = host.querySelector(".bsod-term");
  const progress = host.querySelector(".bsod-progress");
  const wake = host.querySelector(".bsod-wake");

  const full = Array.from({ length: BSOD_LINES }, (_, i) => `C:\\DREAM\\${String(i + 1).padStart(3, "0")}> ${BSOD_LINE}`).join("\n");
  let shown = 0;
  let frame = 0;
  let lastLines = 0;
  const state = { host, done: false, timers: [] };
  active = state;

  const finish = () => {
    if (state.done) return;
    state.done = true;
    term.textContent = full;
    term.scrollTop = term.scrollHeight;
    progress.textContent = "100% complete";
    wake.hidden = false;
    wake.focus({ preventScroll: true });
  };

  const type = () => {
    if (state.done) return;
    // About 20 seconds for the whole crash; faster as the lines pile up.
    const step = 6 + Math.floor(shown / 900);
    shown = Math.min(full.length, shown + step);
    term.textContent = `${full.slice(0, shown)}▌`;
    const lines = full.slice(0, shown).split("\n").length;
    if (lines !== lastLines) {
      lastLines = lines;
      term.scrollTop = term.scrollHeight;
      progress.textContent = `${Math.min(99, Math.floor((shown / full.length) * 100))}% complete`;
    }
    if (shown >= full.length) finish();
    else frame = requestAnimationFrame(type);
  };

  const hurry = (event) => {
    if (event?.target === wake) return;
    if (!state.done && host.classList.contains("is-blue")) finish();
  };

  const toBlue = () => {
    body.classList.remove("bsod-glitching");
    host.classList.remove("is-glitch");
    host.classList.add("is-blue");
    if (reducedMotion()) finish();
    else frame = requestAnimationFrame(type);
  };

  host.addEventListener("pointerdown", hurry);
  const onKey = (event) => {
    if (event.key === "Enter" && state.done) {
      wake.click();
      return;
    }
    hurry(event);
  };
  window.addEventListener("keydown", onKey);

  wake.addEventListener("click", () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("keydown", onKey);
    state.timers.forEach((t) => clearTimeout(t));
    host.classList.add("is-leaving");
    state.timers.push(setTimeout(() => {
      host.remove();
      active = null;
      onDone?.();
    }, 420));
  });

  state.timers.push(setTimeout(toBlue, reducedMotion() ? 120 : GLITCH_MS));
}

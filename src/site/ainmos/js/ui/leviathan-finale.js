/**
 * Ainmos 0.27.1: the last fight's ending. Felling L3V1@+H@N D3$TR0Y3R 0F DR3@M$
 * (or the LEVIATHAN seed) plays an impossible dice fight: two walls of dice,
 * "99d6" against "99d6", counters that stop making sense, then the dice burst
 * out of their window and pour across the whole screen while the dream glitches
 * apart. When it is done, `onDone` runs (the blue screen follows).
 *
 * Purely visual: nothing here touches the game state.
 */

const FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const POOL = 33;
const SPILL = 140;
const CORRUPT = ["99", "98", "9̷9̴", "NaN", "∞", "-1", "0x63", "undefined", "99.0000001", "ERR"];

let running = false;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function dieEl(side) {
  const el = document.createElement("span");
  el.className = `lf2-die lf2-${side}`;
  el.textContent = pick(FACES);
  return el;
}

export function isLeviathanFinaleRunning() {
  return running;
}

/**
 * Play the finale. `dreamer` names the left side. Calls onDone when it ends.
 * Reduced motion gets a short, still version.
 */
export function playLeviathanFinale({ dreamer = "You", onDone } = {}) {
  if (typeof document === "undefined" || running) {
    onDone?.();
    return;
  }
  running = true;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const host = document.createElement("div");
  host.id = "leviathan-finale";
  host.className = "lf2";
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", "An impossible dice fight breaks the dream");
  host.innerHTML = `
    <div class="lf2-veil"></div>
    <div class="lf2-window">
      <div class="lf2-side lf2-left">
        <p class="lf2-name"></p>
        <p class="lf2-count"><b data-n="left">0</b> successes · <span>99d6 Power</span></p>
        <div class="lf2-tray" data-tray="left"></div>
      </div>
      <div class="lf2-mid"><p class="lf2-vs">vs</p><p class="lf2-score" data-score>Rolling…</p></div>
      <div class="lf2-side lf2-right">
        <p class="lf2-name">L3V1@+H@N D3$TR0Y3R 0F DR3@M$</p>
        <p class="lf2-count"><b data-n="right">0</b> successes · <span>99d6 Power</span></p>
        <div class="lf2-tray" data-tray="right"></div>
      </div>
    </div>
    <div class="lf2-tears" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>`;
  host.querySelector(".lf2-left .lf2-name").textContent = dreamer;
  document.body.appendChild(host);
  document.body.classList.add("lf2-running");

  const win = host.querySelector(".lf2-window");
  const trays = { left: host.querySelector('[data-tray="left"]'), right: host.querySelector('[data-tray="right"]') };
  const counts = { left: host.querySelector('[data-n="left"]'), right: host.querySelector('[data-n="right"]') };
  const score = host.querySelector("[data-score]");

  const finish = () => {
    timers.forEach((t) => clearTimeout(t));
    document.body.classList.remove("lf2-running", "lf2-glitch", "lf2-tearing");
    host.classList.add("is-gone");
    setTimeout(() => {
      host.remove();
      running = false;
      onDone?.();
    }, 250);
  };

  if (reducedMotion()) {
    score.textContent = "99 – 99";
    later(2200, finish);
    return;
  }

  // 1. Two walls of dice tumble in, faster and faster.
  const dice = [];
  for (let i = 0; i < POOL; i += 1) {
    ["left", "right"].forEach((side) => {
      const el = dieEl(side);
      el.style.animationDelay = `${Math.random() * 600}ms`;
      trays[side].appendChild(el);
      dice.push(el);
    });
  }
  let tick = 0;
  const roll = setInterval(() => {
    tick += 1;
    dice.forEach((el) => { el.textContent = pick(FACES); });
    const l = Math.min(99, Math.floor(tick * 1.7 + Math.random() * 3));
    const r = Math.min(99, Math.floor(tick * 1.7 + Math.random() * 3));
    counts.left.textContent = String(l);
    counts.right.textContent = String(r);
    score.textContent = `${l} – ${r}`;
  }, 70);
  timers.push(roll);

  // 2. The numbers stop making sense; the window starts to shake.
  later(2600, () => {
    win.classList.add("is-shaking");
    document.body.classList.add("lf2-glitch");
    const corrupt = setInterval(() => {
      counts.left.textContent = pick(CORRUPT);
      counts.right.textContent = pick(CORRUPT);
      score.textContent = `${pick(CORRUPT)} – ${pick(CORRUPT)}`;
    }, 90);
    timers.push(corrupt);
    later(1500, () => clearInterval(corrupt));
  });

  // 3. The dice burst out of the window and spill across the whole screen.
  later(4100, () => {
    clearInterval(roll);
    score.textContent = "NaN – NaN";
    win.classList.add("is-bursting");
    const layer = document.createElement("div");
    layer.className = "lf2-spill";
    host.appendChild(layer);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const origins = dice.map((el) => el.getBoundingClientRect());
    for (let i = 0; i < SPILL; i += 1) {
      const from = origins[i % origins.length];
      const el = dieEl(i % 2 ? "left" : "right");
      el.classList.add("is-free");
      el.style.left = `${from.left}px`;
      el.style.top = `${from.top}px`;
      layer.appendChild(el);
      // Fly out in every direction, bounce once, then fall off the bottom of the screen.
      const dx = (Math.random() - 0.5) * w * 1.4;
      const up = -(Math.random() * h * 0.55 + 80);
      const land = h - from.top + 120 + Math.random() * 200;
      const spin = (Math.random() - 0.5) * 2160;
      const size = 0.7 + Math.random() * 1.9;
      el.animate([
        { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${up}px) rotate(${spin * 0.5}deg) scale(${size})`, opacity: 1, offset: 0.35 },
        { transform: `translate(${dx * 0.85}px, ${land * 0.72}px) rotate(${spin * 0.8}deg) scale(${size})`, opacity: 1, offset: 0.7 },
        { transform: `translate(${dx}px, ${land}px) rotate(${spin}deg) scale(${size})`, opacity: 0.85 },
      ], { duration: 1800 + Math.random() * 1400, delay: Math.random() * 450, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" });
    }
    dice.forEach((el) => { el.style.visibility = "hidden"; });
  });

  // 4. The dream tears: slices of the screen slip sideways, colors split.
  later(5200, () => document.body.classList.add("lf2-tearing"));
  later(6100, () => win.classList.add("is-gone"));
  later(7600, finish);
}

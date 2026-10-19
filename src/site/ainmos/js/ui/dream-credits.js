/**
 * The story of the night, as end credits (0.30). The reel rises slowly from
 * the bottom of the screen; each slot word glows in its own colour (beasts red,
 * Archetypes gold, Landscapes mint, Forms violet, numbers white-hot).
 * Click or Space speeds it up, Esc or Skip ends it. Reduced Motion gets a
 * plain scrolling page instead.
 */

import { buildDreamStory } from "../meta/dream-story.js";

const READ_PX_PER_SEC = 34;
let open = false;

function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
}

export function isDreamCreditsOpen() {
  return open;
}

function lineHtml(line) {
  const inner = line.parts.map((p) => (p.kind
    ? `<span class="dc-var dc-${esc(p.kind)}">${esc(p.text)}</span>`
    : esc(p.text))).join("");
  switch (line.kind) {
    case "title": {
      const text = line.parts.map((p) => p.text).join("");
      const at = text.indexOf("Ainmos");
      if (at < 0) return `<h2 class="dc-title">${inner}</h2>`;
      const letters = [..."AINMOS"].map((ch, i) => `<span class="dc-letter" data-i="${i}">${ch}</span>`).join("");
      return `<h2 class="dc-title has-anagram">${esc(text.slice(0, at))}<span class="dc-anagram" aria-label="Ainmos">${letters}</span>${esc(text.slice(at + 6))}</h2>`;
    }
    case "head": return `<h3 class="dc-head">${inner}</h3>`;
    case "quote": return `<p class="dc-quote">${inner}</p>`;
    case "gap": return `<div class="dc-gap" aria-hidden="true"></div>`;
    default: return `<p class="dc-line">${inner}</p>`;
  }
}

/**
 * AINMOS → SOMNIA. The word is its own mirror, so every letter crosses to the
 * other side: each one lifts, blurs, swims across on its own arc, and settles.
 */
function morphAnagram(word) {
  if (!word || word.dataset.morphed) return;
  word.dataset.morphed = "1";
  const letters = [...word.querySelectorAll(".dc-letter")];
  const widths = letters.map((el) => el.getBoundingClientRect().width);
  const lefts = [];
  widths.reduce((x, w, i) => { lefts[i] = x; return x + w; }, 0);
  // SOMNIA is AINMOS reversed: the letter at i ends at slot (5 - i).
  const order = letters.map((_, i) => 5 - i);
  const sorted = [...letters.keys()].sort((a, b) => order[a] - order[b]);
  const targets = [];
  sorted.reduce((x, i) => { targets[i] = x; return x + widths[i]; }, 0);
  letters.forEach((el, i) => {
    const dx = targets[i] - lefts[i];
    const lift = (i % 2 ? 1 : -1) * (18 + Math.abs(dx) * 0.18);
    el.animate([
      { transform: "translate(0, 0) scale(1) rotate(0deg)", filter: "blur(0)", offset: 0 },
      { transform: `translate(${dx * 0.15}px, ${lift * 0.6}px) scale(1.25, 0.8) rotate(${-lift * 0.4}deg)`, filter: "blur(2px)", offset: 0.25 },
      { transform: `translate(${dx * 0.55}px, ${lift}px) scale(0.85, 1.3) rotate(${lift * 0.5}deg)`, filter: "blur(4px)", offset: 0.55 },
      { transform: `translate(${dx * 0.92}px, ${-lift * 0.25}px) scale(1.1, 0.95) rotate(${-lift * 0.15}deg)`, filter: "blur(1px)", offset: 0.82 },
      { transform: `translate(${dx}px, 0) scale(1) rotate(0deg)`, filter: "blur(0)", offset: 1 },
    ], { duration: 2600, delay: 80 * i, easing: "cubic-bezier(0.45, 0, 0.25, 1)", fill: "forwards" });
  });
  word.classList.add("is-morphing");
  window.setTimeout(() => {
    word.classList.remove("is-morphing");
    word.classList.add("is-somnia");
    word.setAttribute("aria-label", "Somnia");
  }, 3100);
}

/** @returns {Promise<void>} resolves when the credits end or are skipped. */
export function showDreamCredits(state, breakdown = null) {
  if (typeof document === "undefined") return Promise.resolve();
  const lines = buildDreamStory(state, breakdown);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  open = true;
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = `dream-credits${reduced ? " is-static" : ""}${state?.endlessTriumph ? " is-triumph" : ""}`;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "The story of your dream");
    root.innerHTML = `
      <div class="dc-sky" aria-hidden="true"></div>
      <div class="dc-crawl"><div class="dc-reel">${lines.map(lineHtml).join("")}</div></div>
      <div class="dc-controls">
        <span class="dc-hint">Click to hurry</span>
        <button type="button" class="lf-btn dc-skip">Skip</button>
      </div>`;
    document.body.appendChild(root);
    const crawl = root.querySelector(".dc-crawl");
    const reel = root.querySelector(".dc-reel");
    let y = 0;
    let speed = 1;
    let last = 0;
    let raf = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      root.classList.add("is-out");
      window.setTimeout(() => {
        root.remove();
        open = false;
        resolve();
      }, 700);
    };
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); finish(); }
      else if (event.key === " " || event.key === "Enter") { event.preventDefault(); speed = speed > 1 ? 1 : 4; }
    };
    document.addEventListener("keydown", onKey, true);
    root.querySelector(".dc-skip").addEventListener("click", (event) => { event.stopPropagation(); finish(); });

    if (reduced) {
      const word = reel.querySelector(".dc-anagram");
      if (word) window.setTimeout(() => { word.textContent = "SOMNIA"; word.setAttribute("aria-label", "Somnia"); }, 1500);
      root.querySelector(".dc-hint").textContent = "Scroll to read";
      root.querySelector(".dc-skip").textContent = "Done";
      return;
    }
    crawl.addEventListener("pointerdown", () => { speed = 4; });
    crawl.addEventListener("pointerup", () => { speed = 1; });
    crawl.addEventListener("pointerleave", () => { speed = 1; });

    const items = [...reel.querySelectorAll(".dc-line, .dc-head, .dc-quote, .dc-title")];
    const anagram = reel.querySelector(".dc-anagram");
    const start = crawl.clientHeight;
    y = start;
    const step = (t) => {
      if (!last) last = t;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      y -= READ_PX_PER_SEC * speed * dt;
      reel.style.transform = `translate3d(0, ${y}px, 0)`;
      // Lines glow as they pass the reading band in the middle.
      const mid = crawl.getBoundingClientRect().top + crawl.clientHeight * 0.55;
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        el.classList.toggle("is-near", Math.abs(r.top + r.height / 2 - mid) < crawl.clientHeight * 0.32);
      });
      // Once the title is in the reading band, Ainmos dreams itself back into Somnia.
      if (anagram && !anagram.dataset.morphed && anagram.closest(".dc-title")?.classList.contains("is-near")) {
        anagram.dataset.morphed = "pending";
        window.setTimeout(() => { delete anagram.dataset.morphed; morphAnagram(anagram); }, 1400);
      }
      if (y < -reel.scrollHeight - 40) {
        window.setTimeout(finish, 600);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
}

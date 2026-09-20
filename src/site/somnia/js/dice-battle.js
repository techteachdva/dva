/**
 * Dreambeast dice battle — Accept/Reject resolution (Somnia 28.0).
 * Each side rolls Nd6; 5–6 is a success. Most successes wins. Ties favor the beast.
 * Dreamer Power can underpay beast Power; pools up to 22d6.
 */
import { playSfx } from "./audio.js";

const SUCCESS_MIN = 5;
const MAX_SHOWN = 22;
const TUMBLE_MS = 920;
const STAGGER_MS = 42;
const RESULT_HOLD_MS = 4800;

let activeBattle = null;

export function isDiceBattleOpen() {
  return !!activeBattle;
}

function reducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

function clampDice(n) {
  return Math.max(1, Math.min(36, Math.floor(Number(n) || 1)));
}

export function rollD6(count) {
  const n = clampDice(count);
  const faces = [];
  for (let i = 0; i < n; i += 1) faces.push(1 + Math.floor(Math.random() * 6));
  return faces;
}

export function countSuccesses(faces) {
  return faces.filter((v) => v >= SUCCESS_MIN).length;
}

function pipMask(value) {
  // 3x3 grid: TL TM TR / ML MM MR / BL BM BR
  const map = {
    1: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    2: [1, 0, 0, 0, 0, 0, 0, 0, 1],
    3: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    4: [1, 0, 1, 0, 0, 0, 1, 0, 1],
    5: [1, 0, 1, 0, 1, 0, 1, 0, 1],
    6: [1, 0, 1, 1, 0, 1, 1, 0, 1],
  };
  return map[value] || map[1];
}

function faceHtml(value) {
  const pips = pipMask(value).map((on, i) => `<span class="die-pip ${on ? "on" : ""}" data-i="${i}"></span>`).join("");
  return `<div class="die-face face-${value}" data-face="${value}">${pips}</div>`;
}

function dieHtml(side, index) {
  const faces = [1, 2, 3, 4, 5, 6].map((v) => faceHtml(v)).join("");
  return `<div class="battle-die-slot"><div class="battle-die-scene"><div class="battle-die ${side}-die" data-die-index="${index}" aria-hidden="true">${faces}</div></div></div>`;
}

function settleTransform(value) {
  switch (value) {
    case 1: return "rotateX(-18deg) rotateY(22deg)";
    case 2: return "rotateX(-18deg) rotateY(-68deg)";
    case 3: return "rotateX(-108deg) rotateY(22deg)";
    case 4: return "rotateX(72deg) rotateY(22deg)";
    case 5: return "rotateX(-18deg) rotateY(112deg)";
    case 6: return "rotateX(-18deg) rotateY(202deg)";
    default: return "rotateX(-18deg) rotateY(22deg)";
  }
}

function randomTumble() {
  const x = 360 + Math.floor(Math.random() * 3) * 360;
  const y = 360 + Math.floor(Math.random() * 3) * 360;
  const z = 12 + Math.floor(Math.random() * 18);
  return `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
}

function ensureStage() {
  let stage = document.getElementById("dice-battle-stage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "dice-battle-stage";
    stage.className = "dice-battle-stage";
    stage.setAttribute("role", "dialog");
    stage.setAttribute("aria-modal", "true");
    stage.setAttribute("aria-label", "Dreambeast dice battle");
  }
  if (stage.parentElement !== document.body) {
    document.body.appendChild(stage);
  }
  return stage;
}

function clearStage(stage) {
  stage.className = "dice-battle-stage";
  stage.innerHTML = "";
  stage.hidden = true;
}

/**
 * @param {{
 *   dreamerName: string,
 *   beastName: string,
 *   dreamerDice: number,
 *   beastDice: number,
 *   forceWinner?: "dreamer"|"beast"|null,
 *   instant?: boolean,
 *   onComplete: (result: { dreamerWins: boolean, dreamerSuccesses: number, beastSuccesses: number, dreamerFaces: number[], beastFaces: number[] }) => void,
 * }} opts
 */
export function playDiceBattle(opts) {
  const {
    dreamerName = "Dreamer",
    beastName = "Dreambeast",
    dreamerDice,
    beastDice,
    forceWinner = null,
    instant = false,
    hold = false,
    onComplete,
  } = opts || {};

  const dCount = clampDice(dreamerDice);
  const bCount = clampDice(beastDice);
  let dreamerFaces = rollD6(dCount);
  let beastFaces = rollD6(bCount);

  if (forceWinner === "dreamer") {
    let guard = 12;
    while (countSuccesses(dreamerFaces) <= countSuccesses(beastFaces) && guard-- > 0) {
      dreamerFaces = rollD6(dCount);
      beastFaces = rollD6(bCount);
    }
    if (countSuccesses(dreamerFaces) <= countSuccesses(beastFaces)) {
      dreamerFaces = dreamerFaces.map(() => 6);
      beastFaces = beastFaces.map(() => 1);
    }
  } else if (forceWinner === "beast") {
    let guard = 12;
    while (countSuccesses(dreamerFaces) > countSuccesses(beastFaces) && guard-- > 0) {
      dreamerFaces = rollD6(dCount);
      beastFaces = rollD6(bCount);
    }
  }

  const dreamerSuccesses = countSuccesses(dreamerFaces);
  const beastSuccesses = countSuccesses(beastFaces);
  const dreamerWins = dreamerSuccesses > beastSuccesses;
  const result = { dreamerWins, dreamerSuccesses, beastSuccesses, dreamerFaces, beastFaces };

  const finish = () => {
    activeBattle = null;
    const stage = document.getElementById("dice-battle-stage");
    if (stage) clearStage(stage);
    onComplete?.(result);
  };

  if (instant || typeof document === "undefined") {
    finish();
    return result;
  }

  const stage = ensureStage();
  if (activeBattle?.timer) window.clearTimeout(activeBattle.timer);
  activeBattle = { result, timer: null };

  const shownD = Math.min(dCount, MAX_SHOWN);
  const shownB = Math.min(bCount, MAX_SHOWN);
  const totalDice = shownD + shownB;
  const size = totalDice >= 30 ? 32 : totalDice >= 22 ? 38 : totalDice > 14 ? 46 : 56;

  stage.hidden = false;
  stage.style.setProperty("--die-size", `${size}px`);
  stage.style.setProperty("--die-half", `${size / 2}px`);
  stage.style.setProperty("--die-gap", totalDice > 18 ? "0.32rem" : "0.55rem");
  stage.innerHTML = `
    <div class="dice-battle-veil"></div>
    <div class="dice-battle-table">
      <div class="dice-battle-pool dreamer-pool">
        <p class="dice-battle-label">${escapeHtml(dreamerName)}</p>
        <p class="dice-battle-count"><span data-score="dreamer">0</span> successes <span class="dice-battle-pool-size">${dCount}d6 Power</span></p>
        <div class="dice-battle-tray" data-tray="dreamer">
          ${Array.from({ length: shownD }, (_, i) => dieHtml("dreamer", i)).join("")}
        </div>
      </div>
      <div class="dice-battle-center">
        <p class="dice-battle-vs">vs</p>
        <p class="dice-battle-compare" data-compare>Rolling…</p>
      </div>
      <div class="dice-battle-pool beast-pool">
        <p class="dice-battle-label">${escapeHtml(beastName)}</p>
        <p class="dice-battle-count"><span data-score="beast">0</span> successes <span class="dice-battle-pool-size">${bCount}d6 Power</span></p>
        <div class="dice-battle-tray" data-tray="beast">
          ${Array.from({ length: shownB }, (_, i) => dieHtml("beast", i)).join("")}
        </div>
      </div>
    </div>
    <p class="dice-battle-banner" data-banner hidden></p>
  `;

  playSfx("dice-roll");

  const dreamerDiceEls = [...stage.querySelectorAll(".dreamer-die")];
  const beastDiceEls = [...stage.querySelectorAll(".beast-die")];
  const scoreD = stage.querySelector("[data-score=dreamer]");
  const scoreB = stage.querySelector("[data-score=beast]");
  const compare = stage.querySelector("[data-compare]");
  const banner = stage.querySelector("[data-banner]");

  const quiet = reducedMotion();
  const tumbleMs = quiet ? 80 : TUMBLE_MS;

  const landDie = (el, face, delay, onLand) => {
    el.style.transform = randomTumble();
    window.setTimeout(() => {
      el.classList.add("settled");
      el.style.transform = settleTransform(face);
      if (face >= SUCCESS_MIN) el.classList.add("success");
      onLand?.();
    }, delay + tumbleMs);
  };

  let landedD = 0;
  let landedB = 0;
  const shownDreamerFaces = dreamerFaces.slice(0, shownD);
  const shownBeastFaces = beastFaces.slice(0, shownB);

  const updateScores = () => {
    const dHits = countSuccesses(shownDreamerFaces.slice(0, landedD));
    const bHits = countSuccesses(shownBeastFaces.slice(0, landedB));
    if (scoreD) scoreD.textContent = String(dHits);
    if (scoreB) scoreB.textContent = String(bHits);
    if (compare) compare.textContent = `${dHits} – ${bHits}`;
  };

  dreamerDiceEls.forEach((el, i) => {
    landDie(el, shownDreamerFaces[i], i * STAGGER_MS, () => {
      landedD += 1;
      updateScores();
    });
  });
  beastDiceEls.forEach((el, i) => {
    landDie(el, shownBeastFaces[i], 80 + i * STAGGER_MS, () => {
      landedB += 1;
      updateScores();
    });
  });

  const lastDelay = Math.max(
    shownD * STAGGER_MS,
    80 + shownB * STAGGER_MS,
  ) + tumbleMs + 180;

  activeBattle.timer = window.setTimeout(() => {
    if (scoreD) scoreD.textContent = String(dreamerSuccesses);
    if (scoreB) scoreB.textContent = String(beastSuccesses);
    if (compare) compare.textContent = `${dreamerSuccesses} – ${beastSuccesses}`;
    stage.classList.add(dreamerWins ? "winner-dreamer" : "winner-beast");
    if (banner) {
      banner.hidden = false;
      banner.textContent = dreamerWins
        ? `${dreamerName} wins the encounter!`
        : `${beastName} holds the Landscape!`;
    }
    playSfx(dreamerWins ? "dice-win" : "dice-lose");
    const dismiss = () => {
      if (!activeBattle) return;
      if (activeBattle.timer) window.clearTimeout(activeBattle.timer);
      stage.removeEventListener("click", dismiss);
      finish();
    };
    stage.addEventListener("click", dismiss);
    if (!hold) {
      activeBattle.timer = window.setTimeout(dismiss, quiet ? 900 : RESULT_HOLD_MS);
    }
  }, lastDelay);

  return result;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

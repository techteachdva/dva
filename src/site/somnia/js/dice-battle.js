/**
 * Dreambeast dice battle — Accept/Reject resolution (Somnia 28.0).
 * Each side rolls Nd6; 5–6 is a success. Most successes wins. Ties favor the beast.
 * Dice spin freely, then brake onto a face. 5s and 6s light up.
 */
import { playSfx } from "./audio.js";
import { playHaptic } from "./fx.js";

const SUCCESS_MIN = 5;
const MAX_SHOWN = 22;
const SPIN_MS = 780;
const SETTLE_MS = 460;
const RESULT_HOLD_MS = 4200;
const CAM_X = -24;
const CAM_Y = 32;

const FACE_ROT = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

let activeBattle = null;

export function isDiceBattleOpen() {
  return !!activeBattle;
}

/** Force-close any in-flight dice UI (bots / Node sim recovery). */
export function cancelDiceBattle() {
  cancelBattleAnims();
  const stage = typeof document !== "undefined" ? document.getElementById("dice-battle-stage") : null;
  if (stage) clearStage(stage);
  if (typeof document !== "undefined") document.body?.classList?.remove("dice-rolling");
  activeBattle = null;
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

function staggerMs(total) {
  if (total >= 30) return 10;
  if (total >= 16) return 14;
  return 18;
}

function pose(x, y, z = 0) {
  return `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
}

function dieHtml(side, index) {
  const faces = [1, 2, 3, 4, 5, 6]
    .map((v) => `<div class="die-face face-${v}" data-face="${v}"></div>`)
    .join("");
  return `<div class="battle-die-slot" data-die-slot="${index}"><div class="battle-die-scene"><div class="battle-die ${side}-die" data-die-index="${index}" aria-hidden="true">${faces}</div></div></div>`;
}

function settlePose(face, spinX, spinY) {
  const rot = FACE_ROT[face] || FACE_ROT[1];
  return pose(CAM_X + rot.x + spinX, CAM_Y + rot.y + spinY, 0);
}

function startPose() {
  return pose(
    CAM_X + (Math.random() - 0.5) * 80,
    CAM_Y + (Math.random() - 0.5) * 80,
    (Math.random() - 0.5) * 40,
  );
}

function cancelBattleAnims() {
  activeBattle?.anims?.forEach((anim) => {
    try { anim.cancel(); } catch { /* ignore */ }
  });
  if (activeBattle?.timer) window.clearTimeout(activeBattle.timer);
  if (activeBattle?.raf) window.cancelAnimationFrame(activeBattle.raf);
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
  cancelBattleAnims();
  document.body.classList.remove("dice-rolling");
  stage.className = "dice-battle-stage";
  stage.innerHTML = "";
  stage.hidden = true;
}

function markSuccess(el, face) {
  const slot = el.closest(".battle-die-slot");
  el.classList.add("success", "settled");
  slot?.classList.add("success", "landing");
  el.querySelector(`.die-face[data-face="${face}"]`)?.classList.add("hit");
}

function finishDiePose(el, end, face, onLand) {
  el.style.transform = end;
  el.classList.remove("rolling");
  el.style.willChange = "";
  if (face >= SUCCESS_MIN) markSuccess(el, face);
  else {
    el.classList.add("settled");
    el.closest(".battle-die-slot")?.classList.add("landing");
  }
  onLand?.();
}

function rollOneDie(el, face, delay, quiet, onLand, spinScale = 1) {
  const rot = FACE_ROT[face] || FACE_ROT[1];
  const spinX = (2 + Math.floor(Math.random() * 2)) * 360;
  const spinY = (3 + Math.floor(Math.random() * 2)) * 360;
  const from = startPose();
  const mid = pose(
    CAM_X + rot.x + spinX * 0.7,
    CAM_Y + rot.y + spinY * 0.7,
    16 + Math.random() * 10,
  );
  const end = settlePose(face, spinX, spinY);

  el.style.transform = from;
  el.classList.add("rolling");
  el.style.willChange = "transform";

  if (quiet) {
    finishDiePose(el, end, face, onLand);
    return;
  }

  const spin = el.animate(
    [{ transform: from }, { transform: mid }],
    {
      duration: Math.round(SPIN_MS * spinScale),
      delay,
      easing: "linear",
      fill: "forwards",
    },
  );
  activeBattle?.anims?.push(spin);

  spin.finished.then(() => {
    if (!activeBattle) return;
    try { spin.commitStyles(); } catch { /* ignore */ }
    try { spin.cancel(); } catch { /* ignore */ }
    const settle = el.animate(
      [{ transform: mid }, { transform: end }],
      {
        duration: Math.round(SETTLE_MS * (spinScale > 1 ? 1.35 : 1)),
        easing: "cubic-bezier(0.12, 1.35, 0.2, 1)",
        fill: "forwards",
      },
    );
    activeBattle?.anims?.push(settle);
    return settle.finished.then(() => {
      try { settle.commitStyles(); } catch { /* ignore */ }
      try { settle.cancel(); } catch { /* ignore */ }
    });
  }).then(() => {
    if (!activeBattle) return;
    finishDiePose(el, end, face, onLand);
  }).catch(() => {
    /* cancelled */
  });
}

/**
 * @param {{
 *   dreamerName: string,
 *   beastName: string,
 *   dreamerDice: number,
 *   beastDice: number,
 *   forceWinner?: "dreamer"|"beast"|null,
 *   instant?: boolean,
 *   hold?: boolean,
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
    minBeastLead = 0,
    instant = false,
    hold = false,
    allowPostRollToken = false,
    postRollLead = "",
    onPostRoll = null,
    onComplete,
  } = opts || {};

  const dCount = clampDice(dreamerDice);
  const bCount = clampDice(beastDice);
  let dreamerFaces = rollD6(dCount);
  let beastFaces = rollD6(bCount);
  let postRollSpent = false;

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

  if (minBeastLead > 0) {
    let guard = 16;
    while (countSuccesses(beastFaces) < countSuccesses(dreamerFaces) + minBeastLead && guard-- > 0) {
      const miss = beastFaces.findIndex((face) => face < 5);
      if (miss >= 0) beastFaces[miss] = 6;
      else {
        const hit = dreamerFaces.findIndex((face) => face >= 5);
        if (hit >= 0) dreamerFaces[hit] = 1;
        else break;
      }
    }
  }

  let dreamerSuccesses = countSuccesses(dreamerFaces);
  let beastSuccesses = countSuccesses(beastFaces);
  let dreamerWins = dreamerSuccesses > beastSuccesses;
  const result = () => ({
    dreamerWins,
    dreamerSuccesses,
    beastSuccesses,
    dreamerFaces,
    beastFaces,
  });

  const finish = () => {
    const stage = typeof document !== "undefined" ? document.getElementById("dice-battle-stage") : null;
    if (stage) clearStage(stage);
    activeBattle = null;
    onComplete?.(result());
  };

  const forceInstant = instant
    || typeof document === "undefined"
    || !!globalThis.__SOMNIA_INSTANT_DICE__;
  if (forceInstant) {
    finish();
    return result();
  }

  const stage = ensureStage();
  cancelBattleAnims();
  activeBattle = { result: result(), timer: null, anims: [] };

  const shownD = Math.min(dCount, MAX_SHOWN);
  const shownB = Math.min(bCount, MAX_SHOWN);
  const totalDice = shownD + shownB;
  const size = totalDice >= 30 ? 34 : totalDice >= 22 ? 40 : totalDice > 14 ? 48 : 58;

  stage.hidden = false;
  stage.style.setProperty("--die-size", `${size}px`);
  stage.style.setProperty("--die-half", `${size / 2}px`);
  stage.style.setProperty("--die-gap", totalDice > 18 ? "0.38rem" : "0.62rem");
  document.body.classList.add("dice-rolling");
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
  const stagger = staggerMs(totalDice);
  const close = Math.abs(countSuccesses(dreamerFaces) - countSuccesses(beastFaces)) <= 1;
  if (close) stage.classList.add("dice-close");

  const diePlan = (index, count, base) => {
    const late = close && count > 1 && index >= count - 2;
    const delay = base + index * stagger * (late ? 2.35 : 1);
    const spinScale = late ? 1.55 : 1;
    const settleScale = late ? 1.35 : 1;
    return {
      delay,
      spinScale,
      end: delay + Math.round(SPIN_MS * spinScale + SETTLE_MS * settleScale),
    };
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

  const onDieLand = (face, bump) => {
    bump();
    updateScores();
    playSfx("dice-tick", { face, success: face >= SUCCESS_MIN });
    if (face >= SUCCESS_MIN) playHaptic("die");
  };

  dreamerDiceEls.forEach((el, i) => {
    const plan = diePlan(i, shownD, 0);
    rollOneDie(el, shownDreamerFaces[i], plan.delay, quiet, () => {
      onDieLand(shownDreamerFaces[i], () => { landedD += 1; });
    }, plan.spinScale);
  });
  beastDiceEls.forEach((el, i) => {
    const plan = diePlan(i, shownB, 28);
    rollOneDie(el, shownBeastFaces[i], plan.delay, quiet, () => {
      onDieLand(shownBeastFaces[i], () => { landedB += 1; });
    }, plan.spinScale);
  });

  const lastDelay = quiet ? 40 : Math.max(
    shownD ? diePlan(shownD - 1, shownD, 0).end : 0,
    shownB ? diePlan(shownB - 1, shownB, 28).end : 0,
  ) + 80;

  const recount = () => {
    dreamerSuccesses = countSuccesses(dreamerFaces);
    beastSuccesses = countSuccesses(beastFaces);
    dreamerWins = dreamerSuccesses > beastSuccesses;
    if (activeBattle) activeBattle.result = result();
    if (scoreD) scoreD.textContent = String(dreamerSuccesses);
    if (scoreB) scoreB.textContent = String(beastSuccesses);
    if (compare) compare.textContent = `${dreamerSuccesses} – ${beastSuccesses}`;
  };

  const presentWinner = () => {
    if (!activeBattle) return;
    stage.querySelector(".dice-post-roll")?.remove();
    recount();
    document.body.classList.remove("dice-rolling");
    stage.classList.remove("winner-dreamer", "winner-beast");
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
      stage.removeEventListener("click", dismiss);
      finish();
    };
    stage.addEventListener("click", dismiss);
    if (!hold) {
      activeBattle.timer = window.setTimeout(dismiss, quiet ? 800 : RESULT_HOLD_MS);
    }
  };

  const showPostRoll = () => {
    const beastHit = beastSuccesses > 0;
    if (postRollSpent || !allowPostRollToken || typeof onPostRoll !== "function" || !beastHit) {
      presentWinner();
      return;
    }
    const row = document.createElement("div");
    row.className = "dice-post-roll";
    row.innerHTML = `
      <p>${escapeHtml(postRollLead) || "Spend 1 Power Token, once. Ties still favor the beast if you stand."}</p>
      <div class="dice-post-roll-actions">
        <button type="button" class="btn" data-post="subtract">Subtract 1 beast success</button>
        <button type="button" class="btn primary" data-post="stand">Stand</button>
      </div>
    `;
    stage.querySelector(".dice-battle-table")?.after(row);
    row.addEventListener("click", (event) => event.stopPropagation());
    document.dispatchEvent(new CustomEvent("somnia-dice-post-roll"));
    row.querySelectorAll("[data-post]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.getAttribute("data-post");
        if (kind === "stand") {
          presentWinner();
          return;
        }
        if (postRollSpent || !onPostRoll("subtract")) return;
        postRollSpent = true;
        const index = beastFaces.findIndex((face) => face >= SUCCESS_MIN);
        if (index >= 0) {
          beastFaces[index] = 1;
          const die = beastDiceEls[index];
          die?.classList.remove("success");
          die?.querySelector(".die-face.hit")?.classList.remove("hit");
          const slot = die?.closest(".battle-die-slot");
          slot?.classList.remove("success");
          slot?.classList.add("plucked");
          playHaptic("repress");
        }
        recount();
        presentWinner();
      });
    });
  };

  activeBattle.timer = window.setTimeout(() => {
    recount();
    document.body.classList.remove("dice-rolling");
    showPostRoll();
  }, lastDelay);

  return result();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

import { burstSparkles } from "./fx.js";

let celebrationActive = false;
let celebrationTimer = null;

function spawnConfetti() {
  const layer = document.getElementById("victory-fx");
  if (!layer) return;
  const colors = ["#f0c96a", "#c9a0ff", "#6dffb0", "#ff6b9d", "#4ad4ff", "#ffffff"];
  for (let i = 0; i < 48; i += 1) {
    const piece = document.createElement("span");
    piece.className = "victory-confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 2}s`;
    piece.style.animationDuration = `${2.5 + Math.random() * 2}s`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 6000);
  }
}

function spawnStars() {
  const layer = document.getElementById("victory-fx");
  if (!layer) return;
  for (let i = 0; i < 24; i += 1) {
    const star = document.createElement("span");
    star.className = "victory-star";
    star.textContent = "✦";
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.animationDelay = `${Math.random() * 3}s`;
    layer.appendChild(star);
  }
}

export function startVictoryCelebration() {
  celebrationActive = true;
  document.body.classList.add("victory-celebrating");
  const layer = document.getElementById("victory-fx");
  if (layer) layer.innerHTML = "";
  spawnStars();
  spawnConfetti();
  if (celebrationTimer) clearInterval(celebrationTimer);
  celebrationTimer = setInterval(() => {
    if (!celebrationActive) return;
    spawnConfetti();
    const w = window.innerWidth;
    const h = window.innerHeight;
    burstSparkles(w * 0.2 + Math.random() * w * 0.6, h * 0.15 + Math.random() * h * 0.4, 8, "#f0c96a");
    burstSparkles(w * 0.1 + Math.random() * w * 0.8, h * 0.2 + Math.random() * h * 0.5, 6, "#c9a0ff");
  }, 1400);
}

export function stopVictoryCelebration() {
  celebrationActive = false;
  document.body.classList.remove("victory-celebrating");
  if (celebrationTimer) {
    clearInterval(celebrationTimer);
    celebrationTimer = null;
  }
}

export function isVictoryCelebrating() {
  return celebrationActive;
}

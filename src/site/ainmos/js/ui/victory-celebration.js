import { burstSparkles } from "./fx.js";

let celebrationActive = false;
let celebrationTimer = null;

function spawnConfetti() {
  const layer = document.getElementById("victory-fx");
  if (!layer) return;
  const colors = ["#ff4d6d", "#ff8a3d", "#ffe14a", "#5dff8a", "#4ad4ff", "#9b6bff", "#ffffff"];
  for (let i = 0; i < 64; i += 1) {
    const piece = document.createElement("span");
    piece.className = "victory-confetti victory-sprinkle";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 1.4}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 2.4}s`;
    piece.style.setProperty("--sprinkle-x", `${(Math.random() - 0.5) * 80}px`);
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 6000);
  }
}

function spawnAsh() {
  const layer = document.getElementById("victory-fx");
  if (!layer) return;
  for (let i = 0; i < 42; i += 1) {
    const spark = document.createElement("span");
    spark.className = "loss-spark";
    spark.style.left = `${Math.random() * 100}%`;
    spark.style.animationDelay = `${Math.random() * 2.2}s`;
    spark.style.animationDuration = `${2.4 + Math.random() * 2.8}s`;
    spark.style.setProperty("--spark-x", `${(Math.random() - 0.5) * 48}px`);
    layer.appendChild(spark);
    setTimeout(() => spark.remove(), 6400);
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
  document.body.classList.remove("end-nightmare", "final-recurrence-active", "loss-nightmare");
  document.body.classList.add("victory-celebrating");
  const backdrop = document.getElementById("final-nightmare-backdrop");
  if (backdrop) backdrop.style.opacity = "0";
  const layer = document.getElementById("victory-fx");
  if (layer) {
    layer.innerHTML = "";
    const aurora = document.createElement("div");
    aurora.className = "victory-aurora";
    aurora.setAttribute("aria-hidden", "true");
    layer.appendChild(aurora);
  }
  spawnStars();
  spawnConfetti();
  if (celebrationTimer) clearInterval(celebrationTimer);
  celebrationTimer = setInterval(() => {
    if (!celebrationActive) return;
    spawnConfetti();
    const w = window.innerWidth;
    const h = window.innerHeight;
    burstSparkles(w * 0.2 + Math.random() * w * 0.6, h * 0.15 + Math.random() * h * 0.4, 10, "#f0c96a");
    burstSparkles(w * 0.1 + Math.random() * w * 0.8, h * 0.2 + Math.random() * h * 0.5, 8, "#c9a0ff");
    burstSparkles(w * 0.15 + Math.random() * w * 0.7, h * 0.25 + Math.random() * h * 0.45, 6, "#6dffb0");
  }, 1200);
}

export function startLossNightmare() {
  celebrationActive = true;
  document.body.classList.remove("victory-celebrating");
  document.body.classList.add("end-nightmare");
  const backdrop = document.getElementById("final-nightmare-backdrop");
  if (backdrop) backdrop.style.opacity = "1";
  const layer = document.getElementById("victory-fx");
  if (layer) layer.innerHTML = "";
  spawnAsh();
  if (celebrationTimer) clearInterval(celebrationTimer);
  celebrationTimer = setInterval(() => {
    if (!celebrationActive) return;
    spawnAsh();
  }, 1400);
}

export function stopVictoryCelebration() {
  celebrationActive = false;
  document.body.classList.remove("victory-celebrating", "end-nightmare");
  const backdrop = document.getElementById("final-nightmare-backdrop");
  if (backdrop && !document.body.classList.contains("final-recurrence-active")) {
    backdrop.style.opacity = "0";
  }
  if (celebrationTimer) {
    clearInterval(celebrationTimer);
    celebrationTimer = null;
  }
  const layer = document.getElementById("victory-fx");
  if (layer) layer.innerHTML = "";
}

export function isVictoryCelebrating() {
  return celebrationActive;
}

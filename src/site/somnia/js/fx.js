let revealedTiles = new Set();
let phasePulse = false;

export function initFxLayer() {
  if (document.getElementById("fx-layer")) return;
  const layer = document.createElement("div");
  layer.id = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  document.body.appendChild(layer);
}

export function markTileRevealed(id) {
  if (id) revealedTiles.add(id);
}

export function consumeRevealedTiles() {
  const tiles = [...revealedTiles];
  revealedTiles.clear();
  return tiles;
}

export function markPhasePulse() {
  phasePulse = true;
}

export function consumePhasePulse() {
  const pulse = phasePulse;
  phasePulse = false;
  return pulse;
}

export function burstSparkles(x, y, count = 10, color = "#c9a0ff") {
  const layer = document.getElementById("fx-layer");
  if (!layer) return;

  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("span");
    el.className = "fx-sparkle";
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = 28 + Math.random() * 52;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty("--sx", `${Math.cos(angle) * dist}px`);
    el.style.setProperty("--sy", `${Math.sin(angle) * dist}px`);
    el.style.background = color;
    el.style.boxShadow = `0 0 8px ${color}, 0 0 14px rgba(123, 92, 255, 0.8)`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
}

export function burstSparklesAtElement(el, count = 10, color = "#c9a0ff") {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  burstSparkles(rect.left + rect.width / 2, rect.top + rect.height / 2, count, color);
}

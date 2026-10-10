#!/usr/bin/env node
/**
 * Local physical-prototype PDFs for Somnia.
 * Writes print/*.pdf (gitignored) plus scratch HTML in print/_html/.
 *
 *   npm run print:somnia
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import { getDreamResolution } from "../src/site/somnia/js/cards/dream-resolutions.js";
import { getEventResolution } from "../src/site/somnia/js/effects/event-resolutions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const SOMNIA = path.join(REPO, "src/site/somnia");
const DATA = path.join(SOMNIA, "data");
const PRINT = path.join(REPO, "print");
const HTML_DIR = path.join(PRINT, "_html");
const VERSION = "38.6";

const SUIT_LABELS = {
  lucidity: "Lucidity",
  elasticity: "Elasticity",
  willpower: "Willpower",
};
const SUIT_COLORS = {
  lucidity: "#4a9eff",
  elasticity: "#f0c830",
  willpower: "#e84848",
};
const LANDSCAPE_ACTIONS = {
  "draw-mindstream": {
    label: "Draw Mindstream",
    description: "Draw 1 card from this Landscape's matching Mindstream. Repeatable while Meet actions remain.",
  },
  "spawn-dreambeast": {
    label: "Spawn Dreambeast",
    description: "Cycle a Mindstream until a Dreambeast, place it on a matching-suit Landscape, discard the rest of that suit, reshuffle.",
  },
  "swap-psyche": { label: "Swap 2 Psyche", description: "Swap Psyche cards between two Dreamers." },
  "move-2-dreamers-1": { label: "Move 2 Dreamers", description: "Move 2 Dreamers 1 Landscape in any direction." },
  "swap-landscapes": { label: "Swap Landscapes", description: "Swap the positions of 2 Landscapes." },
  "move-1-dreamer-2": { label: "Move 1 Dreamer", description: "Move 1 Dreamer 2 Landscapes in any direction." },
  "move-2-dreambeasts-1": { label: "Move 2 Dreambeasts", description: "Move 2 Dreambeasts 1 Landscape in any direction." },
  "all-toward-bed": { label: "Toward Bed", description: "All Dreamers move 1 Landscape toward The Bed." },
  "swap-archetypes": { label: "Swap Archetypes", description: "Swap the Active Archetype with the next in the deck." },
  "take-power": { label: "Take Power", description: "Take 1 Power Token (US quarter) from the pool." },
  "swap-dreambeasts": { label: "Swap Dreambeasts", description: "Swap 2 active Dreambeasts between Landscapes." },
  "draw-2-keep-1": { label: "Draw 2, Keep 1", description: "Draw 2 from any deck; keep 1 and discard the other." },
  "draw-any-mindstream": { label: "Draw Any Mindstream", description: "Draw 1 card from any Mindstream." },
  "return-2": { label: "Return 2 Cards", description: "Return 2 cards from the Subconscious to their discard piles." },
  "flip-top-3": { label: "Flip Top 3", description: "Flip the top 3 cards of any deck." },
  "cycle-psyche": { label: "Cycle Psyche", description: "Discard a Psyche card, then draw Psyche equal to its value." },
  "return-psyche": { label: "Return Psyche", description: "Return 1 Psyche from the Subconscious." },
  "replay-dream": { label: "Replay Dream", description: "Take the last discarded Dream and resolve it again." },
  "return-1": { label: "Return 1 Card", description: "Return 1 card from the Subconscious." },
  "return-event": { label: "Return Event", description: "Return 1 Event from the Subconscious." },
  "return-object": { label: "Return Object", description: "Return 1 Object from the Subconscious." },
  "draw-3-psyche": { label: "Draw 3 Psyche", description: "Draw 3 Psyche from the Psyche deck. Once per Dreamer this Meet." },
  "peek-then-move-1": { label: "Peek, then Move 1", description: "Glimpse one adjacent forgotten Landscape, then move 1 step." },
  "draw-psyche-equal-to-elasticity": { label: "Draw your Elasticity", description: "Draw Psyche equal to your Elasticity." },
  "move-1-dreamer-1": { label: "Move 1 Step", description: "Move 1 Dreamer 1 Landscape." },
  "draw-1-psyche": { label: "Draw 1 Psyche", description: "Draw 1 Psyche card." },
};
const DREAMER_PASSIVES = {
  "the-rested": "Once a round, free: draw 1 Psyche at round end if you opened no phase.",
  "the-visionary": "Once a round, free: peek the first leftover Mindstream flip. It stays facedown.",
  "the-runner": "Once a round, free: your first Explore step costs no team move.",
  "the-hunter": "Once a round, free: after your first battle, you may shove that beast 1 hex if it stays.",
  "the-immovable": "Once a round, free: ignore 1 Meet-tax card.",
  "the-weaver": "Once per Meet, free: swap 1 Psyche with an adjacent Dreamer.",
};
const MINDSTREAM_COMPOSITION = {
  dreambeasts: 10,
  events: 35,
  powerToken: 8,
  drawDream: 3,
};
const PSYCHE_DISTRIBUTION = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 };
const PSYCHE_WILD = 6;
const PSYCHE_POWER = 0;

function choiceLines(resolution) {
  if (!resolution?.good && !resolution?.bad) return "";
  const good = resolution.good;
  const bad = resolution.bad;
  const toll = good?.toll
    ? ` Costs a ${good.toll.kind === "psyche" ? "Psyche discard" : good.toll.kind === "repress" ? "Repress" : "Forgotten Landscape"}${good.toll.count > 1 ? ` ×${good.toll.count}` : ""}.`
    : "";
  const gate = good?.gate?.label ? ` Opens only if: ${good.gate.label}.` : "";
  return `<p><strong>Good / Bright:</strong> ${esc(good?.label || "—")}. ${esc(good?.hint || "")}${esc(toll)}${esc(gate)}</p>
    <p><strong>Bad / Dim:</strong> ${esc(bad?.label || "—")}. ${esc(bad?.hint || "Free.")}</p>`;
}

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), "utf8"));
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fileUrl(absOrRel) {
  const abs = path.isAbsolute(absOrRel) ? absOrRel : path.join(SOMNIA, absOrRel.replace(/^\.\//, ""));
  if (!fs.existsSync(abs)) return "";
  return pathToFileURL(abs).href;
}

function preparePrintArt() {
  const destRoot = path.join(HTML_DIR, "img");
  fs.mkdirSync(destRoot, { recursive: true });
  const srcRoot = path.join(SOMNIA, "images");
  const py = `
from pathlib import Path
from PIL import Image
src_root = Path(${JSON.stringify(srcRoot)})
dst_root = Path(${JSON.stringify(destRoot)})
MAX = 900
count = 0
for p in src_root.rglob("*"):
    if p.suffix.lower() not in {".webp", ".png", ".jpg", ".jpeg"}:
        continue
    rel = p.relative_to(src_root)
    out = (dst_root / rel).with_suffix(".jpg")
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and out.stat().st_mtime >= p.stat().st_mtime and out.stat().st_size > 8000:
        continue
    im = Image.open(p)
    if im.mode != "RGB":
        im = im.convert("RGB")
    im.thumbnail((MAX, MAX))
    im.save(out, "JPEG", quality=82, optimize=True)
    count += 1
print(count)
`;
  const result = spawnSync("py", ["-3", "-c", py], { encoding: "utf8" });
  if (result.status !== 0) {
    console.warn("Pillow resize skipped:", result.stderr || result.stdout);
    return false;
  }
  console.log(`Prepared print JPEGs (${String(result.stdout || "").trim()} updated).`);
  return true;
}

function artUrl(rel) {
  if (!rel) return "";
  const stripped = rel.replace(/^images\//, "").replace(/\.(webp|png|jpe?g)$/i, ".jpg");
  const dest = path.join(HTML_DIR, "img", stripped);
  if (fs.existsSync(dest)) return fileUrl(dest);
  return fileUrl(rel);
}

function pickPool(items, count) {
  if (!items.length || count <= 0) return [];
  const pool = [];
  for (let i = 0; i < count; i += 1) pool.push(items[i % items.length]);
  return pool;
}

function dreambeastsForSuit(dreambeasts, suit) {
  const suited = dreambeasts.filter((b) => !b.boss && b.suit === suit);
  const perKind = Math.floor(MINDSTREAM_COMPOSITION.dreambeasts / 2);
  const fantasy = suited.filter((b) => b.beastKind === "fantasy");
  const nightmare = suited.filter((b) => b.beastKind === "nightmare");
  const pool = [
    ...pickPool(fantasy.length ? fantasy : suited, perKind),
    ...pickPool(nightmare.length ? nightmare : suited, perKind),
  ];
  if (pool.length >= MINDSTREAM_COMPOSITION.dreambeasts) {
    return pool.slice(0, MINDSTREAM_COMPOSITION.dreambeasts);
  }
  const fallback = dreambeasts.filter((b) => !b.boss);
  return pickPool([...pool, ...fallback.filter((b) => !pool.includes(b))], MINDSTREAM_COMPOSITION.dreambeasts);
}

function objectsForSuit(objects, suit) {
  return objects.filter((obj) => obj.suit === suit);
}

function uniqBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countBy(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function suitChip(suit) {
  if (!suit) return "";
  const color = SUIT_COLORS[suit] || "#c9a0ff";
  return `<span class="chip" style="background:${color}">${esc(SUIT_LABELS[suit] || suit)}</span>`;
}

const SHARED_CSS = `
  :root {
    --ink: #1a1428;
    --muted: #5c5478;
    --paper: #f7f2e8;
    --panel: #fffdf8;
    --line: #2a2438;
    --accent: #6b4cff;
    --lucidity: #4a9eff;
    --elasticity: #c9a018;
    --willpower: #c43030;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: white;
    color: var(--ink);
    font-family: Palatino, "Palatino Linotype", "Book Antiqua", Georgia, serif;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  @page { size: letter; margin: 0.36in; }
  h1, h2, h3 { font-family: Palatino, Georgia, serif; page-break-after: avoid; }
  h1 { font-size: 20pt; margin: 0 0 0.2em; letter-spacing: 0.04em; }
  h2 { font-size: 16pt; margin: 1.1em 0 0.35em; border-bottom: 1.5px solid var(--ink); padding-bottom: 0.12em; }
  h3 { font-size: 12.5pt; margin: 0.9em 0 0.25em; }
  p, li { font-size: 10.5pt; line-height: 1.38; }
  .kicker { text-transform: uppercase; letter-spacing: 0.16em; font-size: 9pt; color: var(--muted); margin: 0 0 0.4em; }
  .lead { font-size: 12pt; }
  .cover {
    min-height: 7.6in;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
  }
  .cover-art {
    width: 100%;
    max-height: 6.4in;
    object-fit: contain;
    border: 2px solid var(--ink);
  }
  .meta { color: var(--muted); font-size: 10pt; }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7in; }
  ul.tight li { margin: 0.12em 0; }
  .callout {
    border: 1.5px solid var(--ink);
    padding: 0.55em 0.7em;
    background: #efe8ff;
    margin: 0.7em 0;
  }
  .page-break { page-break-before: always; break-before: page; }
  h2, h3, table, .callout { page-break-inside: avoid; break-inside: avoid; }
  .meta { page-break-before: avoid; break-before: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 0.4em 0 0.8em; }
  th, td { border: 1px solid #c9c0d8; padding: 0.28em 0.4em; text-align: left; vertical-align: top; }
  th { background: #eee8f8; }
  .hex-map {
    width: 7.2in;
    height: 6.6in;
    margin: 0.15in auto 0;
    position: relative;
    page-break-before: always;
    break-before: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .map-hex {
    position: absolute;
    width: 0.82in;
    height: 0.94in;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    background: #ddd6ee;
    border: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 6.5pt;
    text-align: center;
    line-height: 1.1;
    padding: 0.12in;
  }
  .map-hex.bed { background: #f0c96a; font-weight: 700; }
  .map-hex.ring1 { background: #c9deff; }
  .sheet-label {
    page-break-before: always;
    break-before: page;
    font-size: 11pt;
    font-weight: 700;
    margin: 0 0 0.18in;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .sheet-label-first { page-break-before: auto; break-before: auto; }
  .card-grid {
    font-size: 0;
    text-align: center;
  }
  .pnpcard {
    display: inline-block;
    vertical-align: top;
    font-size: 10pt;
    width: 2.48in;
    height: 3.47in;
    margin: 0 0.04in 0.08in;
    border: 0.7pt dashed #222;
    overflow: hidden;
    position: relative;
    background: #120f22;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .pnpcard .art {
    position: absolute;
    inset: 0;
    background: #120f22;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pnpcard .art img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
  }
  .pnpcard .art-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16pt;
    font-weight: 700;
    text-align: center;
    padding: 0.12in;
  }
  .pnpcard .banner {
    position: relative;
    z-index: 2;
    font-size: 6.2pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.06in 0.08in 0.04in;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    gap: 0.08in;
    background: rgba(247, 242, 232, 0.94);
  }
  .pnpcard .text {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    max-height: 54%;
    overflow: hidden;
    padding: 0.16in 0.08in 0.05in;
    background: linear-gradient(180deg, rgba(255,253,248,0) 0%, rgba(255,253,248,0.94) 0.16in, rgba(255,253,248,0.97) 28%);
  }
  .pnpcard h4 {
    margin: 0 0 0.04em;
    font-size: 9pt;
    line-height: 1.15;
  }
  .pnpcard .body,
  .pnpcard .body p {
    margin: 0 0 0.12em;
    font-size: 6.4pt;
    line-height: 1.22;
  }
  .pnpcard .foot {
    font-size: 6pt;
    padding: 0.02in 0 0;
    color: #444;
    display: flex;
    justify-content: space-between;
    gap: 0.08in;
  }
  .chip {
    display: inline-block;
    color: #111;
    border-radius: 999px;
    padding: 0 0.18em;
    font-size: 6pt;
    font-weight: 700;
  }
  .hex-grid {
    font-size: 0;
    text-align: center;
  }
  .hex-tile {
    display: inline-block;
    vertical-align: top;
    font-size: 10pt;
    width: 3.28in;
    margin: 0 0.08in 0.1in;
    break-inside: avoid;
    page-break-inside: avoid;
    text-align: left;
  }
  .hex-art {
    position: relative;
    width: 3.28in;
    height: 3.28in;
    background: #1a1408;
  }
  .hex-art img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    display: block;
  }
  .hex-cut {
    position: absolute;
    top: 8.5%;
    bottom: 8.5%;
    left: 13.5%;
    right: 13.5%;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    outline: 0.8pt dashed #111;
    outline-offset: -1px;
    pointer-events: none;
  }
  .hex-caption {
    margin-top: 0.06in;
    background: rgba(255,252,245,0.96);
    border: 0.4pt solid #d8d0c4;
    padding: 0.07in 0.1in;
    font-size: 7pt;
    line-height: 1.2;
  }
  .hex-caption strong { display: block; font-size: 9pt; }
  .print-note { font-size: 8.5pt; color: var(--muted); margin: 0 0 0.2in; }
  .card-tray {
    page-break-before: always;
    break-before: page;
  }
  .card-tray-grid {
    display: grid;
    grid-template-columns: repeat(3, 2.35in);
    gap: 0.18in 0.2in;
    justify-content: center;
    margin-top: 0.2in;
  }
  .card-tray-slot {
    border: 0.8pt dashed #222;
    padding: 0.08in;
    background: #fffdf8;
  }
  .card-tray-slot img {
    width: 2.15in;
    height: 3.01in;
    object-fit: contain;
    display: block;
    background: #120f22;
  }
  .card-tray-slot strong {
    display: block;
    font-size: 9pt;
    margin: 0.06in 0 0.02in;
  }
  .card-tray-slot span {
    font-size: 7pt;
    color: #444;
  }
`;

function cardHtml({
  kind,
  name,
  art,
  bannerLeft,
  bannerRight,
  body,
  footLeft,
  footRight,
  artClass = "",
  artColor = "",
}) {
  const url = artUrl(art);
  const artInner = url
    ? `<img src="${url}" alt="${esc(name)}" />`
    : `<div class="art-fallback" style="background:${artColor || "#2a2438"}">${esc(name)}</div>`;
  return `<article class="pnpcard">
    <div class="art ${artClass}">${artInner}</div>
    <div class="banner"><span>${esc(bannerLeft || kind)}</span><span>${bannerRight || ""}</span></div>
    <div class="text">
      <h4>${esc(name)}</h4>
      <div class="body">${body || ""}</div>
      <div class="foot"><span>${footLeft || ""}</span><span>${footRight || ""}</span></div>
    </div>
  </article>`;
}

function section(title, cards, { first = false } = {}) {
  if (!cards.length) return "";
  const labelClass = first ? "sheet-label sheet-label-first" : "sheet-label";
  return `<div class="${labelClass}">${esc(title)} — ${cards.length} cutouts</div><div class="card-grid">${cards.join("")}</div>`;
}

function hexHtml(tile, { back = false } = {}) {
  const url = artUrl(back ? (tile.wastelandImage || "images/landscapes/wasteland.webp") : tile.image);
  const suit = tile.suit ? SUIT_LABELS[tile.suit] : "None";
  const unique = tile.uniqueAction ? LANDSCAPE_ACTIONS[tile.uniqueAction] : null;
  const bedA = tile.landscapeActions?.[0] ? LANDSCAPE_ACTIONS[tile.landscapeActions[0]] : null;
  const bedB = tile.landscapeActions?.[1] ? LANDSCAPE_ACTIONS[tile.landscapeActions[1]] : null;
  const actionA = tile.suit
    ? `A: Draw ${suit} Mindstream (repeatable)`
    : (bedA ? `A: ${bedA.label} (once per Dreamer this Meet)` : "");
  const actionB = unique
    ? `B: ${unique.label} (once per table this Meet)`
    : (bedB ? `B: ${bedB.label}` : "");
  const caption = back
    ? `<strong>Wasteland</strong>Back of ${esc(tile.name)}. Forgotten / unrevealed.`
    : `<strong>${esc(tile.name)}</strong>${suitChip(tile.suit)}${actionA ? `<br>${esc(actionA)}` : ""}${actionB ? `<br>${esc(actionB)}` : ""}`;
  return `<div class="hex-tile">
    <div class="hex-art">
      ${url ? `<img src="${url}" alt="${esc(back ? "Wasteland" : tile.name)}" />` : ""}
      <div class="hex-cut"></div>
    </div>
    <div class="hex-caption">${caption}</div>
  </div>`;
}

function hexToPixel(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}

function mapDiagram(landscapes) {
  const slots = [
    { q: 0, r: 0, id: "bed" },
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
  ];
  const ring2 = [];
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  let q = dirs[4][0] * 2;
  let r = dirs[4][1] * 2;
  for (let i = 0; i < 6; i += 1) {
    for (let step = 0; step < 2; step += 1) {
      ring2.push({ q, r });
      q += dirs[i][0];
      r += dirs[i][1];
    }
  }
  const corners = [
    { q: 3, r: 0 }, { q: 3, r: -3 }, { q: 0, r: -3 },
    { q: -3, r: 0 }, { q: -3, r: 3 }, { q: 0, r: 3 },
  ];
  const all = [
    ...slots.map((s, i) => ({ ...s, ring: s.id === "bed" ? 0 : 1, label: s.id === "bed" ? "The Bed" : `R1 ${i}` })),
    ...ring2.map((s, i) => ({ ...s, ring: 2, label: `Pool ${i + 1}` })),
    ...corners.map((s, i) => ({ ...s, ring: 3, label: `Corner ${i + 1}` })),
  ];
  const size = 28;
  const pts = all.map((s) => ({ ...s, ...hexToPixel(s.q, s.r, size) }));
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  const w = maxX - minX + 80;
  const h = maxY - minY + 90;
  const hexes = pts.map((p) => {
    const cls = p.id === "bed" ? "bed" : p.ring === 1 ? "ring1" : "";
    const left = ((p.x - minX + 40) / w) * 100;
    const top = ((p.y - minY + 40) / h) * 100;
    return `<div class="map-hex ${cls}" style="left:${left}%;top:${top}%;transform:translate(-50%,-50%)">${esc(p.label)}</div>`;
  }).join("");
  return `<div class="hex-map" style="height:${(h / w) * 7.2}in">${hexes}</div>
    <p class="print-note">25 hexes: The Bed at center (gold), 6 ring-1 neighbors start as the only possible opening Reveals, 12 ring-2 + 6 ring-3 corners are the shuffled pool. All 25 Landscapes are shuffled; Bed is placed face-up; exactly one Landscape touching The Bed starts Revealed.</p>
    <p class="print-note">Playable Landscapes in this set: ${landscapes.filter((l) => !l.hidden).map((l) => l.name).join(", ")}.</p>`;
}

function rulesHtml(data) {
  const { dreamers, archetypes, landscapes, dreambeasts, dreams, objects, mindstream } = data;
  const playable = landscapes.filter((l) => !l.hidden);
  const boxArt = artUrl("images/somnia-box-art.jpg");
  const eventCount = ["lucidity", "elasticity", "willpower"]
    .map((s) => (mindstream[s] || []).length)
    .join(" / ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Somnia ${VERSION} — Rules Bible &amp; Setup</title>
<style>${SHARED_CSS}</style>
</head>
<body>
  <section class="cover">
    <div>
      <p class="kicker">Physical prototype · Somnia v ${VERSION} · The Opening Die</p>
      <h1>Somnia</h1>
      <p class="lead">A cooperative dream-escape. Dreamers trapped in a collapsing Dreamscape earn Archetype points and wake on The Bed before the Dream Deck runs out.</p>
    </div>
    ${boxArt ? `<img class="cover-art" src="${boxArt}" alt="Somnia box art" />` : ""}
    <div class="meta">
      <p>Rules bible and table setup for cardstock playtesting. Cutouts are in the companion PDFs. Power Tokens = US quarters.</p>
      <p>This document matches digital Somnia ${VERSION}. Round 1 draws a Dream and rolls 1d6 before play. Even resolves Good (Bright). Odd resolves Bad (Dim). Power Token cards are Mindstream only. Do not upload these prototype PDFs with the website.</p>
    </div>
  </section>

  <h2>How you win and lose</h2>
  <div class="cols">
    <div>
      <h3>Win</h3>
      <p>Complete both quests on the Active Archetype, spend <strong>1 Power Token (quarter) per quest</strong>, then Acquire it for 1–3 points. Repeat to your goal:</p>
      <ul class="tight">
        <li>Daydream — 8 points · 11 regular Dreams</li>
        <li>Nap — 12 points · 14 regular Dreams</li>
        <li>Deep Sleep — 24 points · 18 regular Dreams (every Archetype)</li>
      </ul>
      <p>When you have enough points, <strong>every living Dreamer must stand on The Bed</strong> to escape.</p>
    </div>
    <div>
      <h3>Lose</h3>
      <ul class="tight">
        <li>The Dream Deck empties before you reach the goal</li>
        <li>The Psyche deck and its discard are both empty</li>
        <li>Any Mindstream suit is entirely Repressed (none left in that deck, its discard, or in play)</li>
        <li>Any Dreamer dies a fifth time</li>
        <li>In Final Recurrence, Dreams run out while remaining Archetypes still stand</li>
      </ul>
    </div>
  </div>

  <h2>Components (print + quarters)</h2>
  <table>
    <thead><tr><th>Piece</th><th>Count</th><th>Notes</th></tr></thead>
    <tbody>
      <tr><td>Landscape hexes</td><td>${playable.length}</td><td>Faces in the cutout PDF. Glue Wasteland backs to the 24 outer tiles. The Bed never forgets.</td></tr>
      <tr><td>Dreamer cards</td><td>${dreamers.length}</td><td>${dreamers.map((d) => d.name).join(", ")}</td></tr>
      <tr><td>Archetypes</td><td>${archetypes.length}</td><td>Shuffle; reveal one Active Archetype.</td></tr>
      <tr><td>Psyche</td><td>57</td><td>17 per suit (six 1s, five 2s, then 3 / 2 / 1), 6 Wild (value 5, any suit). No Power Surge cards. Hand limit 10, allies included.</td></tr>
      <tr><td>Pass Token</td><td>1</td><td>Any small marker. It moves around the table during Meet.</td></tr>
      <tr><td>Dreams</td><td>${dreams.filter((d) => d.type === "dream").length} unique + copies · 10 Final · 3 bosses</td><td>Build the length you chose; bosses go in slots for Reveal rounds 3 / 6 / 9.</td></tr>
      <tr><td>Dreambeasts</td><td>${dreambeasts.length} unique</td><td>Bosses Cerberus, Double, Leviathan. 10 copies per Mindstream suit from non-boss beasts.</td></tr>
      <tr><td>Objects</td><td>${objects.length}</td><td>One copy of each Object in the deck of its suit. Accepting a Dreambeast draws the top card of that suit.</td></tr>
      <tr><td>Mindstream Events</td><td>${eventCount} (L/E/W)</td><td>35 Events + 8 Power Token cards + 3 Draw Dream cards per suit, plus 10 beasts, for 56 cards each. Objects are separate decks.</td></tr>
      <tr><td>Power Tokens</td><td>US quarters, pool cap 24</td><td>Do not print coins. Start with 1 quarter per Dreamer.</td></tr>
    </tbody>
  </table>
  <div class="callout">
    <strong>Power Tokens = US quarters</strong> (about 0.955" / 24.26 mm). Keep a spare dish of up to 24. Spent quarters return to the dish. Only Mindstream Power Token cards grant a quarter from a draw: take 1, or Return one Subconscious card for each Dreamer. They are not the tokens themselves. Dreams, Events, Landscape actions, and powers can still grant quarters.
  </div>

  <h2 class="page-break">Setup</h2>
  <ol>
    <li>Choose length: Daydream 8 / Nap 12 / Deep Sleep 24. That sets the regular Dream count (11 / 14 / 18).</li>
    <li>Each player picks a Dreamer card. Seat 2–6. Give each Dreamer <strong>5 Psyche</strong> and <strong>1 quarter</strong>.</li>
    <li>Shuffle all 25 Landscapes. Place <strong>The Bed face-up</strong> in the center. Deal the remaining hexes into the 24 outer slots (6 touching The Bed, then ring 2, then 6 corners).</li>
    <li>Flip <strong>exactly one</strong> Landscape that touches The Bed face-up. All other outer hexes stay Wasteland-side up (forgotten).</li>
    <li>Build three 56-card Mindstream decks (Lucidity / Elasticity / Willpower) from the cutouts, and three Object decks of one copy per suited Object. Keep discards separate; empty draw piles reshuffle their discard.</li>
    <li>Shuffle Archetypes; reveal the top as the Active Archetype. Shuffle Psyche. Build the Dream deck for your length, insert the three boss Dreams at rounds 3/6/9, then the Final Recurrence packet (The Final Recurrence, eight effect cards, You Never Wake Up on the bottom).</li>
    <li>Put leftover quarters in a dish (the Power pool, cap 24). Place repressed piles nearby as the Subconscious (Psyche, Dreambeasts, Mindstream by suit, Objects). Return effects put cards back on the matching discard.</li>
    <li>The first Head Dreamer is any agreed player (★). Head rotates clockwise at round end. Set the Pass Token aside until Meet.</li>
  </ol>
  ${mapDiagram(playable)}

  <h2>R.E.M. — every round</h2>
  <p>There is no turn order inside a phase. Talk, then act. Phases always run <strong>Reveal → Explore → Meet</strong>. One Dreamer spends <strong>1 suited Psyche</strong> (or 1 quarter as 1 suited Psyche) to open the phase. Budget = that card’s value + that Dreamer’s matching stat, including Object and Acquired Archetype bonuses. The same Dreamer cannot open the next phase this round unless they are alone, or nobody else can pay the suit.</p>
  <h3>Reveal — Lucidity</h3>
  <ul>
    <li><strong>Round 1, before Reveal:</strong> draw the top Dream and roll 1d6. Even resolves its Good / Bright path. Odd resolves its Bad / Dim path. The die is the choice, so nobody pays Bright's usual toll and nobody is asked. Then open on Reveal. Each Dreamer already has 5 Psyche.</li>
    <li><strong>Later rounds:</strong> the Head Dreamer (★) draws and resolves 1 Dream. Bright costs a Repress, a discarded Psyche, or a Forgotten Landscape, and it opens only when that Dream's condition is met. Dim is free. Draw the Dream and spend Lucidity in either order. Each living Dreamer draws 2 Psyche at the start of Reveal.</li>
    <li>One Dreamer spends 1 Lucidity. Flip that many Wasteland hexes face-up.</li>
    <li>When every Landscape is Revealed, leftover Reveals flip the next facedown card of a Mindstream. Flipped cards stay face-up on that pile.</li>
  </ul>
  <h3>Explore — Elasticity (Mirror Mirror)</h3>
  <ul>
    <li>One Dreamer spends 1 Elasticity. The budget is a shared pile of steps for the whole team. You need not spend every step.</li>
    <li>After that spend, walking locks to the map. Each step is <strong>one adjacent revealed hex</strong>. Only those neighboring Landscapes are legal. A Dreamer or beast standing on a hex is that hex: the token does not swallow the step.</li>
    <li>Name who walks, then take one legal step. Repeat until the budget is gone. The Runner’s first step each round is free.</li>
    <li>Stepping onto a Wasteland discards 1 Psyche and can kill. Forgotten hexes are not steps.</li>
    <li><strong>2 unused steps</strong> may peek the next Dream. Leave it on top, or bury it just ahead of Final Recurrence. Otherwise leftovers are forfeited when you leave Explore.</li>
    <li>The table may undo the last step (the digital Map Back).</li>
  </ul>
  <h3>Meet — Willpower</h3>
  <ul>
    <li><strong>Start:</strong> each Dreamer Represses 1 Psyche from hand per Dreambeast on their hex or an adjacent hex. Dreamers farther away pay nothing. Beasts stay on the map. The Immovable ignores 1 tax card once this round.</li>
    <li>One Dreamer spends 1 Willpower for shared Meet actions.</li>
    <li><strong>Pass Token:</strong> it starts with a living Dreamer who did not open Meet (the Head, if the Head was not the opener; otherwise the next Dreamer clockwise). That Dreamer takes one Meet action or passes. Passing, or taking the action, moves the token clockwise. A Dreamer who dies drops it. The table may still end Meet early.</li>
    <li>Spend the action budget on Encounters and Landscape actions. <strong>Draw Mindstream</strong> is repeatable. Each unique Landscape action is <strong>once for the whole table</strong> this Meet. <strong>The Bed’s Draw 3</strong> is once per Dreamer this Meet.</li>
    <li>Only the Dreamer standing on a hex may Meet its Encounter and pool Psyche (up to 3 cards; allies are extra and do not count toward the 3). Need at least 1 card of the required suit.</li>
    <li>Accept and Reject are dice battles. Beast Power is how many d6 it rolls. Recommended Dreamer Power is beast Power + 2; you may play less. Your dice are the Psyche played (Nightmare/Fantasy and suit bonuses included) plus the matching Dreamer stat, +1d6 if your Fantasy/Nightmare type matches, +1d6 if your primary suit matches the beast, and +1d6 per Power Token on the spread (max 3). A 5 or 6 is a success. Most successes win. Ties favor the beast. Jewelry and stick Objects add +1 each; a body tag doubles the highest card.</li>
    <li><strong>After the dice land,</strong> if you hold a quarter, spend 1 once to subtract 1 beast success, or stand. Ties still favor the beast if you stand.</li>
    <li><strong>Win — Accept:</strong> the beast joins that hand as a 3-value ally. <strong>Win — Reject:</strong> same cost, other suit; the beast goes to the Subconscious and you resolve its reward. <strong>Lose:</strong> the Psyche and quarters in the play are spent, the beast stays, and its Fail cost still hits at the end of Meet.</li>
    <li><strong>Free during Meet</strong> (they do not spend the action budget): trade up to 3 Psyche with a Dreamer on the same hex or next door; place up to 3 quarters for +1d6 each on a spread; play an Instant Object (then Repress it); activate a Persistent Object (1 quarter); use a Dreamer or Archetype Power (1 quarter); mark a completed quest (1 quarter).</li>
    <li><strong>2 unused actions</strong> may Return 1 Dreambeast from the Subconscious to its Mindstream discard. You may do this again. Otherwise leftovers are forfeited.</li>
    <li><strong>End:</strong> Forget 1 random Landscape per remaining beast, then each remaining beast’s Fail cost in spawn order. Beasts stay until Accepted or Rejected. Forgetting a tile turns it Wasteland, Represses its Encounter, and the Dreamers standing there lose 1 Psyche to the Subconscious. The Bed cannot be forgotten. If every outer tile is Wasteland, Final Recurrence begins.</li>
  </ul>
  <p>When a phase budget is spent — or the table agrees to skip leftovers — advance to the next phase. Skipping does not spend Psyche, so a skipped Explore has nothing to peek. Dreamer powers do not change the phase by themselves. Head rotates clockwise at round end.</p>

  <h2>Hands, objects, and circulation</h2>
  <ul>
    <li>Max <strong>10 cards</strong> in hand, allies included (+2 with Persistent Severed Torso). Overflow goes to the Psyche discard.</li>
    <li><strong>Wild</strong> (value 5) counts as any suit. When spent, Repress that card to the Subconscious.</li>
    <li>The Psyche deck has no Power Token cards. A Mindstream Power Token card is a choice: <strong>Take 1 quarter</strong>, or <strong>Return one Subconscious card for each Dreamer</strong> at the table.</li>
    <li><strong>Instant</strong> Objects are free during Meet, then Repressed. <strong>Persistent</strong> Objects stay in play and activate for 1 quarter. <strong>Must-play</strong> Objects resolve on draw, then Repress.</li>
    <li>Spent allies are Repressed. Spent Psyche goes to the discard, unless it is Wild or an ally.</li>
    <li>Spawn a Dreambeast: cycle the chosen Mindstream from the top until a beast appears, place it (on a matching-suit Landscape when the effect asks you to choose; otherwise on the acting Dreamer’s Landscape), <strong>discard the rest of that suit</strong>, then reshuffle the discard into a new draw pile. Ebony Pawn spawns a Nightmare; Ivory Pawn a Fantasy. Bosses spawn on The Bed.</li>
    <li>Empty Mindstream or Psyche discards reshuffle into a new draw pile. If a Mindstream suit has nothing left in its deck, discard, or in play, you lose immediately. If the Psyche deck and discard are both empty, you lose immediately.</li>
  </ul>

  <h2>Quests, death, bosses, Final Recurrence</h2>
  <ul>
    <li>Quests name Landscapes. A forgotten tile does not move the quest to another hex of the same suit.</li>
    <li>Mark a completed quest for 1 quarter, any phase. Mark both, then Acquire for 1–3 points. Quintessential Archetypes (Sage, Magician, Warrior) grant a passive stat bonus only. Their Psyche quest needs one Dreamer holding 10 Psyche. Other Archetype powers cost 1 quarter in any phase and do not spend a Meet action.</li>
    <li>A Dreamer with <strong>no Psyche and no allies</strong> dies immediately. Repress the top card of each Mindstream. Objects go to Mindstream discards. Quarters return to the dish. They respawn on <strong>The Bed</strong> with 4 / 3 / 2 / 1 Psyche by death count and <strong>no new quarters</strong>. The Bed’s Draw 3 is available as normal. The <strong>fifth death</strong> of any Dreamer ends the game at once.</li>
    <li><strong>Cerberus, Double, and Leviathan</strong> are Power 11. Their Dreams spawn them on The Bed, usually on Reveal rounds 3, 6, and 9.</li>
    <li>Final Recurrence starts when that card is drawn, or when every outer Landscape is forgotten. Goal points reset. Remaining Archetypes become map Encounters. Defeat each with a Meet action and <strong>at least 15</strong> pooled Psyche from all Dreamers, including one card of the opposing suit, or sacrifice acquired Archetypes 1:1. The last card is always <strong>You Never Wake Up</strong>.</li>
  </ul>

  <h2>Dreamer passives and powers</h2>
  <p>Each passive is free. Each paid power costs <strong>1 quarter</strong>, works in any phase, and does not spend the Meet action budget.</p>
  <table>
    <thead><tr><th>Dreamer</th><th>L / E / W</th><th>Passive</th><th>Power</th></tr></thead>
    <tbody>
      ${dreamers.map((d) => `<tr><td>${esc(d.name)}</td><td>${d.lucidity} / ${d.elasticity} / ${d.willpower}</td><td>${esc(DREAMER_PASSIVES[d.id] || "—")}</td><td>${esc(d.power)}</td></tr>`).join("")}
    </tbody>
  </table>

  <h2>Archetypes</h2>
  <table>
    <thead><tr><th>Name</th><th>Pts</th><th>Quests</th><th>Passive / Power</th></tr></thead>
    <tbody>
      ${archetypes.map((a) => `<tr><td>${esc(a.name)}</td><td>${a.points}</td><td>${esc((a.quests || []).join(" · "))}</td><td>${esc([a.passive, a.power].filter(Boolean).join(" / ") || "—")}</td></tr>`).join("")}
    </tbody>
  </table>

  <p class="meta">Somnia v ${VERSION} physical prototype, Mirror Mirror rules. Companion files: card and Landscape cutouts. Artwork and mechanics from the digital game.</p>

  ${cardTrayHtml()}
</body>
</html>`;
}

function cardTrayHtml() {
  const slots = [
    { label: "Psyche", note: "Stack the Psyche deck on this back.", art: "images/backs/psyche.webp" },
    { label: "Archetypes", note: "Stack unused Archetypes here.", art: "images/backs/archetype.webp" },
    { label: "Dreams", note: "Dream deck — official wordmark.", art: "images/somnia-logo.png" },
    { label: "Lucidity Mindstream", note: "Blue. Place that 56-card pile here.", art: "images/backs/mindstream-lucidity.webp" },
    { label: "Elasticity Mindstream", note: "Yellow. Place that 56-card pile here.", art: "images/backs/mindstream-elasticity.webp" },
    { label: "Willpower Mindstream", note: "Red. Place that 56-card pile here.", art: "images/backs/mindstream-willpower.webp" },
  ].map((slot) => {
    const src = artUrl(slot.art);
    return `<div class="card-tray-slot">
      ${src ? `<img src="${src}" alt="${esc(slot.label)} back" />` : ""}
      <strong>${esc(slot.label)}</strong>
      <span>${esc(slot.note)}</span>
    </div>`;
  }).join("");
  return `<section class="card-tray">
    <h2>Card tray — deck backs</h2>
    <p class="print-note">Print this page as a table mat. Set each finished deck on its back so stacks stay together. These are the same backs used in digital Somnia ${VERSION}.</p>
    <div class="card-tray-grid">${slots}</div>
  </section>`;
}

function cutoutsHtml(data) {
  const { dreamers, archetypes, landscapes, dreambeasts, dreams, objects, mindstream, psyche } = data;
  const playable = landscapes.filter((l) => !l.hidden);
  const wasteland = landscapes.find((l) => l.id === "wasteland") || {
    name: "Wasteland",
    image: "images/landscapes/wasteland.webp",
  };

  const psycheCards = [];
  (psyche.suits || ["lucidity", "elasticity", "willpower"]).forEach((suit) => {
    Object.entries(psyche.distribution || PSYCHE_DISTRIBUTION).forEach(([value, copies]) => {
      for (let i = 0; i < copies; i += 1) {
        psycheCards.push(cardHtml({
          kind: "Psyche",
          name: `${SUIT_LABELS[suit]} ${value}`,
          bannerLeft: "Psyche",
          bannerRight: suitChip(suit),
          body: `<p>Play 1 of this suit to open that phase. Value ${esc(value)} + that Dreamer’s matching stat (Objects and acquired Archetypes included) is the shared team budget. Hand limit 10.</p>`,
          footLeft: `Copy ${i + 1} of ${copies}`,
          footRight: SUIT_LABELS[suit],
          artColor: SUIT_COLORS[suit],
        }));
      }
    });
  });
  for (let i = 0; i < (psyche.wildCount ?? PSYCHE_WILD); i += 1) {
    psycheCards.push(cardHtml({
      kind: "Psyche",
      name: "Wild Psyche",
      bannerLeft: "Wild",
      bannerRight: "Any suit · 5",
      body: "<p>Any suit, value 5. When spent, Repress this card to the Subconscious.</p>",
      footLeft: `Copy ${i + 1} of ${psyche.wildCount ?? PSYCHE_WILD}`,
      artColor: "#9b7cff",
    }));
  }
  for (let i = 0; i < (psyche.powerTokenCount ?? PSYCHE_POWER); i += 1) {
    psycheCards.push(cardHtml({
      kind: "Power Surge",
      name: "Power Surge",
      bannerLeft: "Psyche",
      bannerRight: "+1 quarter",
      body: "<p>Yellowish-purple. Play anytime, any phase: take 1 Power Token (US quarter) from the dish, then discard this card.</p>",
      footLeft: `Copy ${i + 1} of ${psyche.powerTokenCount ?? PSYCHE_POWER}`,
      artColor: "#c9a0ff",
    }));
  }

  const dreamerCards = dreamers.map((d) => cardHtml({
    kind: "Dreamer",
    name: d.name,
    art: d.image,
    bannerLeft: "Dreamer",
    bannerRight: `L${d.lucidity} E${d.elasticity} W${d.willpower}`,
    body: `<p>${esc(d.flavor || "")}</p><p><strong>Passive:</strong> ${esc(DREAMER_PASSIVES[d.id] || "")}</p><p><strong>Power (1 quarter, any phase; does not spend a Meet action):</strong> ${esc(d.power)}</p>`,
    footLeft: "Player identity",
  }));

  const archCards = archetypes.map((a) => cardHtml({
    kind: "Archetype",
    name: a.name,
    art: a.image,
    bannerLeft: "Archetype",
    bannerRight: `${a.points} pts ${suitChip(a.suit)}`,
    body: `<p><strong>Quests:</strong> ${esc((a.quests || []).join(" · "))}</p>
      ${a.passive ? `<p><strong>Passive:</strong> ${esc(a.passive)}</p>` : ""}
      ${a.power ? `<p><strong>Power (1 quarter, any phase; does not spend a Meet action):</strong> ${esc(a.power)}</p>` : "<p>Quintessential — passive stat bonus only. Psyche quest is one Dreamer holding 10 Psyche.</p>"}`,
    footLeft: "1 quarter per quest mark",
  }));

  const dreamCards = [];
  dreams.forEach((d) => {
    const copies = d.copies || 1;
    const paths = choiceLines(getDreamResolution(d.id));
    for (let i = 0; i < copies; i += 1) {
      dreamCards.push(cardHtml({
        kind: d.type === "final" ? "Final Recurrence" : "Dream",
        name: d.name,
        art: d.image,
        bannerLeft: d.type === "final" ? "Final" : "Dream",
        bannerRight: copies > 1 ? `${i + 1}/${copies}` : "",
        body: paths || `<p>${esc(d.text || d.effect || "")}</p>`,
        footLeft: d.type === "final" ? "Endgame packet" : "Round 1: die. Later: Head draws 1 / round",
      }));
    }
  });

  const beastCards = [];
  const msBeastIds = [];
  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    dreambeastsForSuit(dreambeasts, suit).forEach((b) => msBeastIds.push(`${suit}:${b.id}`));
  });
  const beastMsCount = countBy(msBeastIds, (id) => id.split(":")[1]);
  dreambeasts.forEach((b) => {
    const extras = beastMsCount.get(b.id) || 0;
    const copies = Math.max(1, extras);
    for (let i = 0; i < copies; i += 1) {
      beastCards.push(cardHtml({
        kind: b.boss ? "Boss Dreambeast" : "Dreambeast",
        name: b.name,
        art: b.image,
        bannerLeft: b.boss ? "Boss" : (b.beastKind || "Dreambeast"),
        bannerRight: `${suitChip(b.suit)} A${b.accept} / R${b.reject}`,
        body: `<p>${esc(b.flavor || "")}</p>
          <p><strong>Accept ${b.accept}:</strong> ${esc(b.effect || "Ally in hand, value 3.")}</p>
          <p><strong>Repress ${b.reject} (${SUIT_LABELS[b.rejectSuit] || b.rejectSuit || "suit"}):</strong> ${esc(b.rejectReward || "")}</p>
          <p><strong>Fail:</strong> ${esc(b.fail || "")}</p>`,
        footLeft: b.boss ? "Spawns on The Bed" : `Mindstream copy ${i + 1}/${copies}`,
      }));
    }
  });

  const objectCards = objects.map((o) => cardHtml({
    kind: "Object",
    name: o.name,
    art: o.image,
    bannerLeft: o.subtype || "Object",
    bannerRight: suitChip(o.suit),
    body: `<p>${esc(o.text)}</p>${o.subtype === "must-play" ? "" : "<p><strong>Good:</strong> Take the Object.</p><p><strong>Bad:</strong> Discard it and draw 3 Psyche.</p>"}`,
    footLeft: (o.tags || []).join(" · "),
    footRight: SUIT_LABELS[o.suit] || "",
  }));

  const eventCards = [];
  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    (mindstream[suit] || []).forEach((evt) => {
      const paths = choiceLines(getEventResolution(evt.id));
      eventCards.push(cardHtml({
        kind: "Event",
        name: evt.name,
        art: evt.image,
        bannerLeft: "Mindstream Event",
        bannerRight: suitChip(suit),
        body: paths || `<p>${esc(evt.text)}</p>`,
        footLeft: SUIT_LABELS[suit],
      }));
    });
  });

  const tokenGrantCards = [];
  const drawDreamCards = [];
  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    for (let i = 1; i <= MINDSTREAM_COMPOSITION.powerToken; i += 1) {
      tokenGrantCards.push(cardHtml({
        kind: "Mindstream",
        name: "Power Token",
        art: `images/cards/mindstream/${suit}/power-token.webp`,
        bannerLeft: "Mindstream",
        bannerRight: suitChip(suit),
        body: "<p><strong>Good:</strong> Take 1 Power Token (US quarter) from the dish.</p><p><strong>Bad:</strong> Return one card from the Subconscious for each Dreamer at the table.</p>",
        footLeft: `${i} of ${MINDSTREAM_COMPOSITION.powerToken}`,
      }));
    }
    for (let i = 1; i <= MINDSTREAM_COMPOSITION.drawDream; i += 1) {
      drawDreamCards.push(cardHtml({
        kind: "Mindstream",
        name: "Draw 1 Additional Dream",
        art: `images/cards/mindstream/${suit}/draw-dream.webp`,
        bannerLeft: "Mindstream",
        bannerRight: suitChip(suit),
        body: "<p>Draw and resolve an additional Dream as if it were the start of the round.</p>",
        footLeft: `${i} of ${MINDSTREAM_COMPOSITION.drawDream}`,
      }));
    }
  });

  const hexFaces = playable.map((tile) => hexHtml(tile));
  const hexBacks = playable
    .filter((tile) => tile.id !== "bed")
    .map((tile) => hexHtml({ ...tile, wastelandImage: wasteland.image || tile.wastelandImage }, { back: true }));

  const wrap = (title, inner) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Somnia ${VERSION} — ${esc(title)}</title>
<style>${SHARED_CSS}</style>
</head>
<body>
  <p class="kicker">Somnia v ${VERSION} · print on US Letter cardstock · actual size · cut on dashed lines</p>
  <h1>${esc(title)}</h1>
  <p class="print-note">Poker-ish cards are 2.48" × 3.47". Artwork prints in full (nothing cropped). Hex art is the full square; cut the inner dashed hex. Power Tokens are US quarters — not printed here. Sleeve or glue Wasteland backs to the 24 outer Landscapes. The Bed has no forgotten back.</p>
  ${inner}
</body>
</html>`;

  return [
    {
      slug: "Cutouts-Identity-Psyche-Dreams",
      html: wrap("Dreamers, Archetypes, Psyche & Dreams", [
        section("Dreamers", dreamerCards, { first: true }),
        section("Archetypes", archCards),
        section("Psyche", psycheCards),
        section("Dreams & Final Recurrence", dreamCards),
      ].join("\n")),
    },
    {
      slug: "Cutouts-Beasts-Objects",
      html: wrap("Dreambeasts & Objects", [
        section("Dreambeasts", beastCards, { first: true }),
        section("Objects", objectCards),
      ].join("\n")),
    },
    {
      slug: "Cutouts-Mindstream",
      html: wrap("Mindstream Events, Power & Draw Dream", [
        section("Mindstream Events", eventCards, { first: true }),
        section("Mindstream Power Token cards (grant a quarter)", tokenGrantCards),
        section("Mindstream Draw Dream cards", drawDreamCards),
      ].join("\n")),
    },
    {
      slug: "Cutouts-Landscapes",
      html: wrap("Landscape hexes", `
  <div class="sheet-label sheet-label-first">Landscape hex faces — ${hexFaces.length} tiles</div>
  <div class="hex-grid">${hexFaces.join("")}</div>
  <div class="sheet-label">Wasteland backs — ${hexBacks.length} (glue to outer tiles)</div>
  <div class="hex-grid">${hexBacks.join("")}</div>`),
    },
  ];
}

async function launchBrowser(chromium) {
  const attempts = [{ channel: "chrome" }, { channel: "msedge" }, {}];
  let lastError = null;
  for (const opts of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function htmlToPdf(chromium, htmlPath, pdfPath) {
  const browser = await launchBrowser(chromium);
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 180000 });
    await page.evaluate(async () => {
      const imgs = [...document.images];
      await Promise.all(imgs.map((img) => {
        if (img.complete) return null;
        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      }));
    });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      printBackground: true,
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const data = {
    dreamers: loadJson("dreamers"),
    archetypes: loadJson("archetypes"),
    landscapes: loadJson("landscapes"),
    dreambeasts: loadJson("dreambeasts"),
    dreams: loadJson("dreams"),
    objects: loadJson("objects"),
    mindstream: loadJson("mindstream"),
    psyche: loadJson("psyche"),
  };

  fs.mkdirSync(HTML_DIR, { recursive: true });
  fs.mkdirSync(PRINT, { recursive: true });
  preparePrintArt();

  const rulesPath = path.join(HTML_DIR, "rules-setup.html");
  fs.writeFileSync(rulesPath, rulesHtml(data));
  const cutDocs = cutoutsHtml(data);
  cutDocs.forEach((doc) => {
    fs.writeFileSync(path.join(HTML_DIR, `${doc.slug}.html`), doc.html);
  });

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Playwright is required. From the repo root: npm install");
    process.exit(1);
  }

  const written = [];
  const rulesPdf = path.join(PRINT, `Somnia-${VERSION}-Rules-and-Setup.pdf`);
  console.log("Rendering rules + setup PDF…");
  await htmlToPdf(chromium, rulesPath, rulesPdf);
  written.push(rulesPdf);

  for (const doc of cutDocs) {
    const pdfPath = path.join(PRINT, `Somnia-${VERSION}-${doc.slug}.pdf`);
    console.log(`Rendering ${path.basename(pdfPath)}…`);
    await htmlToPdf(chromium, path.join(HTML_DIR, `${doc.slug}.html`), pdfPath);
    written.push(pdfPath);
  }

  const stats = written.map((p) => {
    const mb = (fs.statSync(p).size / (1024 * 1024)).toFixed(1);
    return `${path.relative(REPO, p)} (${mb} MB)`;
  });
  console.log(`Wrote:\n  ${stats.join("\n  ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

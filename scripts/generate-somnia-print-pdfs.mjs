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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const SOMNIA = path.join(REPO, "src/site/somnia");
const DATA = path.join(SOMNIA, "data");
const PRINT = path.join(REPO, "print");
const HTML_DIR = path.join(PRINT, "_html");
const VERSION = "23.1";

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
    description: "Draw 1 card from this Landscape's matching Mindstream. Repeatable.",
  },
  "spawn-dreambeast": {
    label: "Spawn Dreambeast",
    description: "Cycle a Mindstream until a Dreambeast, place it, mill the rest of that suit, reshuffle.",
  },
  "swap-psyche": { label: "Swap 2 Psyche", description: "Swap Psyche cards between two Dreamers." },
  "move-2-dreamers-1": { label: "Move 2 Dreamers", description: "Move 2 Dreamers 1 Landscape." },
  "swap-landscapes": { label: "Swap Landscapes", description: "Swap the positions of 2 Landscapes." },
  "move-1-dreamer-2": { label: "Move 1 Dreamer", description: "Move 1 Dreamer 2 Landscapes." },
  "move-2-dreambeasts-1": { label: "Move 2 Dreambeasts", description: "Move 2 Dreambeasts 1 Landscape." },
  "all-toward-bed": { label: "Toward Bed", description: "All Dreamers move 1 Landscape toward The Bed." },
  "swap-archetypes": { label: "Swap Archetypes", description: "Swap the Active Archetype with the next in the deck." },
  "take-power": { label: "Take Power", description: "Take 1 Power Token (US quarter) from the pool." },
  "swap-dreambeasts": { label: "Swap Dreambeasts", description: "Swap 2 active Dreambeasts between Landscapes." },
  "draw-2-keep-1": { label: "Draw 2, Keep 1", description: "Draw 2 from any deck; keep 1 and discard the other." },
  "draw-any-mindstream": { label: "Draw Any Mindstream", description: "Draw 1 card from any Mindstream." },
  "return-2": { label: "Return 2 Cards", description: "Return 2 cards from the Subconscious." },
  "flip-top-3": { label: "Flip Top 3", description: "Flip the top 3 cards of any deck." },
  "cycle-psyche": { label: "Cycle Psyche", description: "Discard a Psyche card, then draw Psyche equal to its value." },
  "return-psyche": { label: "Return Psyche", description: "Return 1 Psyche from the Subconscious." },
  "power-draw-psyche": { label: "Power for Psyche", description: "Discard 1 Power Token, then Draw 3 Psyche." },
  "replay-dream": { label: "Replay Dream", description: "Take the last discarded Dream and resolve it again." },
  "return-1": { label: "Return 1 Card", description: "Return 1 card from the Subconscious." },
  "return-event": { label: "Return Event", description: "Return 1 Event from the Subconscious." },
  "return-object": { label: "Return Object", description: "Return 1 Object from the Subconscious." },
  "draw-3-psyche": { label: "Draw 3 Psyche", description: "Draw 3 Psyche from the Psyche deck." },
  "bed-spend-10-draw-3": {
    label: "Spend 10 Psyche → Draw 3",
    description: "Spend Psyche totaling 10, then Draw 3 Psyche.",
  },
};
const MINDSTREAM_COMPOSITION = {
  dreambeasts: 10,
  objects: 16,
  events: 35,
  powerToken: 6,
  drawDream: 3,
};
const PSYCHE_DISTRIBUTION = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
const PSYCHE_WILD = 6;
const PSYCHE_POWER = 6;

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
MAX = 560
count = 0
for p in src_root.rglob("*"):
    if p.suffix.lower() not in {".webp", ".png", ".jpg", ".jpeg"}:
        continue
    rel = p.relative_to(src_root)
    out = (dst_root / rel).with_suffix(".jpg")
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and out.stat().st_mtime >= p.stat().st_mtime:
        continue
    im = Image.open(p)
    if im.mode != "RGB":
        im = im.convert("RGB")
    im.thumbnail((MAX, MAX))
    im.save(out, "JPEG", quality=70, optimize=True)
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
  return pickPool(objects.filter((obj) => obj.suit === suit), MINDSTREAM_COMPOSITION.objects);
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
  }
  @page { size: letter; margin: 0.42in 0.48in; }
  h1, h2, h3 { font-family: Palatino, Georgia, serif; page-break-after: avoid; }
  h1 { font-size: 26pt; margin: 0 0 0.35em; letter-spacing: 0.04em; }
  h2 { font-size: 16pt; margin: 1.1em 0 0.35em; border-bottom: 1.5px solid var(--ink); padding-bottom: 0.12em; }
  h3 { font-size: 12.5pt; margin: 0.9em 0 0.25em; }
  p, li { font-size: 10.5pt; line-height: 1.38; }
  .kicker { text-transform: uppercase; letter-spacing: 0.16em; font-size: 9pt; color: var(--muted); margin: 0 0 0.4em; }
  .lead { font-size: 12pt; }
  .cover {
    min-height: 9.6in;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
  }
  .cover-art {
    width: 100%;
    max-height: 6.4in;
    object-fit: cover;
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
  .page-break { page-break-before: always; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 0.4em 0 0.8em; }
  th, td { border: 1px solid #c9c0d8; padding: 0.28em 0.4em; text-align: left; vertical-align: top; }
  th { background: #eee8f8; }
  .hex-map {
    width: 7.2in;
    height: 6.6in;
    margin: 0.4in auto 0;
    position: relative;
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
    font-size: 11pt;
    font-weight: 700;
    margin: 0 0 0.25in;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .sheet-label:first-child { page-break-before: auto; }
  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 2.48in);
    grid-auto-rows: 3.47in;
    gap: 0.08in;
    justify-content: center;
  }
  .pnpcard {
    width: 2.48in;
    height: 3.47in;
    border: 0.7pt dashed #222;
    overflow: hidden;
    position: relative;
    background: var(--panel);
    display: flex;
    flex-direction: column;
  }
  .pnpcard .banner {
    font-size: 6.2pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 0.07in 0.08in 0.04in;
    font-weight: 700;
    display: flex;
    justify-content: space-between;
    gap: 0.08in;
  }
  .pnpcard .art {
    height: 1.42in;
    background: #1a1730 center/cover no-repeat;
    border-top: 0.5pt solid #222;
    border-bottom: 0.5pt solid #222;
    flex: 0 0 1.42in;
  }
  .pnpcard .art.missing {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14pt;
    font-weight: 700;
  }
  .pnpcard h4 {
    margin: 0.06in 0.08in 0.02in;
    font-size: 9.4pt;
    line-height: 1.15;
  }
  .pnpcard .body {
    margin: 0 0.08in;
    font-size: 6.6pt;
    line-height: 1.25;
    flex: 1;
  }
  .pnpcard .foot {
    font-size: 6pt;
    padding: 0.04in 0.08in 0.06in;
    color: #444;
    display: flex;
    justify-content: space-between;
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
    display: grid;
    grid-template-columns: repeat(2, 3.45in);
    grid-auto-rows: 3.28in;
    gap: 0.12in 0.18in;
    justify-content: center;
  }
  .hex-tile {
    width: 3.2in;
    height: 3.2in;
    margin: 0 auto;
    position: relative;
  }
  .hex-shape {
    width: 3.2in;
    height: 2.78in;
    margin: 0.2in auto 0;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    background: #222 center/cover no-repeat;
    position: relative;
  }
  .hex-outline {
    position: absolute;
    inset: 0.12in 0.02in 0.12in;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    box-shadow: inset 0 0 0 1.2pt #111;
    pointer-events: none;
  }
  .hex-cut {
    position: absolute;
    inset: 0.08in 0;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    outline: 0.8pt dashed #111;
    outline-offset: -1px;
    pointer-events: none;
  }
  .hex-caption {
    position: absolute;
    left: 0.42in;
    right: 0.42in;
    bottom: 0.38in;
    background: rgba(255,252,245,0.92);
    padding: 0.08in 0.1in;
    font-size: 7pt;
    line-height: 1.2;
  }
  .hex-caption strong { display: block; font-size: 9pt; }
  .print-note { font-size: 8.5pt; color: var(--muted); margin: 0 0 0.2in; }
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
  const artStyle = url
    ? `style="background-image:url('${url}')"`
    : `style="background:${artColor || "#2a2438"}"`;
  return `
  <article class="pnpcard">
    <div class="banner"><span>${esc(bannerLeft || kind)}</span><span>${bannerRight || ""}</span></div>
    <div class="art ${url ? "" : "missing"} ${artClass}" ${artStyle}>${url ? "" : esc(name)}</div>
    <h4>${esc(name)}</h4>
    <div class="body">${body || ""}</div>
    <div class="foot"><span>${footLeft || ""}</span><span>${footRight || ""}</span></div>
  </article>`;
}

function section(title, cards) {
  if (!cards.length) return "";
  return `<div class="sheet-label">${esc(title)} — ${cards.length} cutouts</div><div class="card-grid">${cards.join("")}</div>`;
}

function hexHtml(tile, { back = false } = {}) {
  const url = artUrl(back ? (tile.wastelandImage || "images/landscapes/wasteland.webp") : tile.image);
  const suit = tile.suit ? SUIT_LABELS[tile.suit] : "None";
  const unique = tile.uniqueAction ? LANDSCAPE_ACTIONS[tile.uniqueAction] : null;
  const bedA = tile.landscapeActions?.[0] ? LANDSCAPE_ACTIONS[tile.landscapeActions[0]] : null;
  const bedB = tile.landscapeActions?.[1] ? LANDSCAPE_ACTIONS[tile.landscapeActions[1]] : null;
  const actionA = tile.suit ? `A: Draw ${suit} Mindstream (repeatable)` : (bedA ? `A: ${bedA.label}` : "");
  const actionB = unique ? `B: ${unique.label}` : (bedB ? `B: ${bedB.label}` : "");
  const caption = back
    ? `<strong>Wasteland</strong>Back of ${esc(tile.name)}. Forgotten / unrevealed.`
    : `<strong>${esc(tile.name)}</strong>${suitChip(tile.suit)}${actionA ? `<br>${esc(actionA)}` : ""}${actionB ? `<br>${esc(actionB)}` : ""}`;
  return `
  <div class="hex-tile">
    <div class="hex-shape" style="${url ? `background-image:url('${url}')` : "background:#333"}"></div>
    <div class="hex-cut"></div>
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
      <p class="kicker">Physical prototype · Somnia v ${VERSION}</p>
      <h1>Somnia</h1>
      <p class="lead">A cooperative dream-escape. Dreamers trapped in a collapsing Dreamscape earn Archetype points and wake on The Bed before the Dream Deck runs out.</p>
    </div>
    ${boxArt ? `<img class="cover-art" src="${boxArt}" alt="Somnia box art" />` : ""}
    <div class="meta">
      <p>Rules bible and table setup for cardstock playtesting. Cutouts are in the companion PDF. Power Tokens = US quarters.</p>
      <p>This document matches digital Somnia ${VERSION}. Do not upload these prototype PDFs with the website.</p>
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
        <li>Any Mindstream suit is entirely Repressed (none left in that deck, its discard, or in play)</li>
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
      <tr><td>Psyche</td><td>57</td><td>15 per suit (values 1–5), 6 Wild (value 5), 6 Power Surge.</td></tr>
      <tr><td>Dreams</td><td>${dreams.filter((d) => d.type === "dream").length} unique + copies · 10 Final · 3 bosses</td><td>Build the length you chose; bosses go in slots for Reveal rounds 3 / 6 / 9.</td></tr>
      <tr><td>Dreambeasts</td><td>${dreambeasts.length} unique</td><td>Bosses Cerberus, Double, Leviathan. 10 copies per Mindstream suit from non-boss beasts.</td></tr>
      <tr><td>Objects</td><td>${objects.length}</td><td>16 per suit in each Mindstream.</td></tr>
      <tr><td>Mindstream Events</td><td>${eventCount} (L/E/W)</td><td>35 Events + 6 Power Token cards + 3 Draw Dream cards per suit, plus beasts and objects, for 70 cards each.</td></tr>
      <tr><td>Power Tokens</td><td>US quarters, pool cap 24</td><td>Do not print coins. Start with 1 quarter per Dreamer.</td></tr>
    </tbody>
  </table>
  <div class="callout">
    <strong>Power Tokens = US quarters</strong> (about 0.955" / 24.26 mm). Keep a spare dish of up to 24. Spent quarters return to the dish. Power Surge cards and Mindstream “Power Token” cards grant a quarter from the dish — they are not the tokens themselves.
  </div>

  <h2 class="page-break">Setup</h2>
  <ol>
    <li>Choose length: Daydream 8 / Nap 12 / Deep Sleep 24. That sets the regular Dream count (11 / 14 / 18).</li>
    <li>Each player picks a Dreamer card. Seat 2–6. Give each Dreamer <strong>5 Psyche</strong> and <strong>1 quarter</strong>.</li>
    <li>Shuffle all 25 Landscapes. Place <strong>The Bed face-up</strong> in the center. Deal the remaining hexes into the 24 outer slots (6 touching The Bed, then ring 2, then 6 corners).</li>
    <li>Flip <strong>exactly one</strong> Landscape that touches The Bed face-up. All other outer hexes stay Wasteland-side up (forgotten).</li>
    <li>Build three 70-card Mindstream decks (Lucidity / Elasticity / Willpower) from the cutouts. Keep discards separate; empty draw piles reshuffle their discard.</li>
    <li>Shuffle Archetypes; reveal the top as the Active Archetype. Shuffle Psyche. Build the Dream deck for your length, insert the three boss Dreams at rounds 3/6/9, then the Final Recurrence packet (The Final Recurrence, eight effect cards, You Never Wake Up on the bottom).</li>
    <li>Put leftover quarters in a dish (the Power pool, cap 24). Place Objects, extra beasts, and repressed piles as the Subconscious nearby.</li>
    <li>The first Head Dreamer is any agreed player (★). Head rotates clockwise at round end.</li>
  </ol>
  ${mapDiagram(playable)}

  <h2 class="page-break">R.E.M. — every round</h2>
  <p>There is no turn order inside a phase. Talk, then act. One Dreamer spends <strong>1 suited Psyche</strong> (or 1 quarter as 1 suited Psyche) to open the phase. Budget = that card’s value + that Dreamer’s matching stat, including Object and Acquired Archetype bonuses.</p>
  <h3>Reveal — Lucidity</h3>
  <ul>
    <li>Head Dreamer draws and resolves 1 Dream. Round 2+: each living Dreamer also draws 2 Psyche at the start of Reveal.</li>
    <li>One Dreamer spends 1 Lucidity. Click/flip that many Wasteland hexes face-up.</li>
    <li>When every Landscape is Revealed, Return Dreamers+3 from the Subconscious.</li>
  </ul>
  <h3>Explore — Elasticity</h3>
  <ul>
    <li>One Dreamer spends 1 Elasticity for shared team moves. You need not spend every move.</li>
    <li>Entering Wasteland discards 1 Psyche (can kill).</li>
  </ul>
  <h3>Meet — Willpower</h3>
  <ul>
    <li><strong>Meet tax:</strong> at the start of Meet, for every Dreambeast on the board, each Dreamer Represses 1 Psyche and the table Forgets 1 Landscape.</li>
    <li>One Dreamer spends 1 Willpower for shared Meet actions.</li>
    <li><strong>Draw Mindstream</strong> is repeatable. Each unique Landscape action is once per Dreamer this Meet. Archetype Powers cost 1 Meet action + 1 quarter.</li>
    <li>Only the Dreamer standing on a hex may Meet its Encounter (up to 3 Psyche). Accept keeps the beast as a 3-value ally (Accept ≥ 10 draws an Object). Repress sends it to the Subconscious and pays the Reject reward. Instant Objects Repress when used. Spent allies Repress.</li>
    <li>Unresolved Encounters fail at Meet end. Each beast still on the map then costs 1 quarter (Timeline hunger) or discards 1 Dream if unpaid.</li>
  </ul>
  <p>When a phase budget is spent — or you agree to skip leftovers — advance with a <strong>Next Phase</strong> marker (the digital game uses a circular button at the top-right of the map). Dreamer action menus do not change phase.</p>

  <h2>Spawning, mill, and circulation</h2>
  <ul>
    <li>Spawn a Dreambeast: cycle the chosen Mindstream from the top until a beast appears, put it on a Landscape, <strong>discard the rest of that suit</strong>, then reshuffle the discard into a new draw pile.</li>
    <li>Ebony Pawn spawns a Nightmare; Ivory Pawn a Fantasy. Bosses spawn on The Bed.</li>
    <li>Empty Mindstream discard reshuffles. If a suit has no cards left in its Mindstream, discard, or in play (board / allies / objects), you lose immediately.</li>
  </ul>

  <h2>Quests, death, Final Recurrence</h2>
  <ul>
    <li>Mark a completed quest for 1 quarter, any phase. Mark both to Acquire.</li>
    <li>Power Surge (yellowish-purple Psyche) may be spent any phase for 1 quarter.</li>
    <li>At 0 Psyche: spend quarters (cost = max(1, floor(alive/2))) to draw 1 and live, or die: Repress top of each Mindstream, lose Objects/Persistent/Power, return to The Bed with 4/3/2/1 Psyche by death count, gain 2 quarters, resolve an Additional Dream. Fifth death is permanent.</li>
    <li>Final Recurrence starts when that card is drawn or every outer Landscape is forgotten. Remaining Archetypes become map Encounters: defeat with a Meet action, ≥ 15 pooled Psyche including the opposing suit, or sacrifice acquired Archetypes 1:1. Last card is You Never Wake Up.</li>
  </ul>

  <h2>Dreamer powers (1 quarter, any phase)</h2>
  <table>
    <thead><tr><th>Dreamer</th><th>L / E / W</th><th>Power</th></tr></thead>
    <tbody>
      ${dreamers.map((d) => `<tr><td>${esc(d.name)}</td><td>${d.lucidity} / ${d.elasticity} / ${d.willpower}</td><td>${esc(d.power)}</td></tr>`).join("")}
    </tbody>
  </table>

  <h2>Archetypes</h2>
  <table>
    <thead><tr><th>Name</th><th>Pts</th><th>Quests</th><th>Passive / Power</th></tr></thead>
    <tbody>
      ${archetypes.map((a) => `<tr><td>${esc(a.name)}</td><td>${a.points}</td><td>${esc((a.quests || []).join(" · "))}</td><td>${esc([a.passive, a.power].filter(Boolean).join(" / ") || "—")}</td></tr>`).join("")}
    </tbody>
  </table>

  <p class="meta">Somnia v ${VERSION} physical prototype. Companion file: Card and Landscape cutouts. Artwork and mechanics from the digital game.</p>
</body>
</html>`;
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
          body: `<p>Play 1 suited Psyche to open a phase. Value ${esc(value)} + matching Dreamer stat (and Object / Acquired Archetype bonuses) is the team budget.</p>`,
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
      body: "<p>Counts as any suit, value 5. When spent, also Repress the top card of each Mindstream deck.</p>",
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
    body: `<p>${esc(d.flavor || "")}</p><p><strong>Power (1 quarter, any phase):</strong> ${esc(d.power)}</p>`,
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
      ${a.power ? `<p><strong>Power (1 Meet action + 1 quarter):</strong> ${esc(a.power)}</p>` : "<p>Quintessential — no activatable power. Psyche quest is one Dreamer holding 10 Psyche.</p>"}`,
    footLeft: "1 quarter per quest mark",
  }));

  const dreamCards = [];
  dreams.forEach((d) => {
    const copies = d.copies || 1;
    for (let i = 0; i < copies; i += 1) {
      dreamCards.push(cardHtml({
        kind: d.type === "final" ? "Final Recurrence" : "Dream",
        name: d.name,
        art: d.image,
        bannerLeft: d.type === "final" ? "Final" : "Dream",
        bannerRight: copies > 1 ? `${i + 1}/${copies}` : "",
        body: `<p>${esc(d.text)}</p>`,
        footLeft: d.type === "final" ? "Endgame packet" : "Head Dreamer draws 1 / round",
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
    body: `<p>${esc(o.text)}</p>`,
    footLeft: (o.tags || []).join(" · "),
    footRight: SUIT_LABELS[o.suit] || "",
  }));

  const eventCards = [];
  ["lucidity", "elasticity", "willpower"].forEach((suit) => {
    (mindstream[suit] || []).forEach((evt) => {
      eventCards.push(cardHtml({
        kind: "Event",
        name: evt.name,
        art: evt.image,
        bannerLeft: "Mindstream Event",
        bannerRight: suitChip(suit),
        body: `<p>${esc(evt.text)}</p>`,
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
        body: "<p>Take 1 Power Token (US quarter) from the dish.</p>",
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
  <p class="print-note">Poker-ish cards are 2.48" × 3.47". Hexes are ~3" flat-to-flat. Power Tokens are US quarters — not printed here. Sleeve or glue Wasteland backs to the 24 outer Landscapes. The Bed has no forgotten back.</p>
  ${inner}
</body>
</html>`;

  return [
    {
      slug: "Cutouts-Identity-Psyche-Dreams",
      html: wrap("Dreamers, Archetypes, Psyche & Dreams", [
        section("Dreamers", dreamerCards),
        section("Archetypes", archCards),
        section("Psyche", psycheCards),
        section("Dreams & Final Recurrence", dreamCards),
      ].join("\n")),
    },
    {
      slug: "Cutouts-Beasts-Objects",
      html: wrap("Dreambeasts & Objects", [
        section("Dreambeasts", beastCards),
        section("Objects", objectCards),
      ].join("\n")),
    },
    {
      slug: "Cutouts-Mindstream",
      html: wrap("Mindstream Events, Power & Draw Dream", [
        section("Mindstream Events", eventCards),
        section("Mindstream Power Token cards (grant a quarter)", tokenGrantCards),
        section("Mindstream Draw Dream cards", drawDreamCards),
      ].join("\n")),
    },
    {
      slug: "Cutouts-Landscapes",
      html: wrap("Landscape hexes", `
  <div class="sheet-label">Landscape hex faces — ${hexFaces.length} tiles</div>
  <p class="print-note">Cut the outer dashed hex. Action A is Draw Mindstream (repeatable). Action B is the unique once-per-Dreamer Meet action.</p>
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
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load", timeout: 120000 });
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

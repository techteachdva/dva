/**
 * Builds teacher-review HTML + PDF for Tech Escape SEL notifications
 * (Two Truths and a Lie text messages).
 *
 * Usage: node scripts/build-sel-two-truths-review.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_URL = pathToFileURL(
  join(ROOT, "src/site/tech-escape/js/data/twoTruths.js"),
).href;

const { TWO_TRUTHS, SEL_TOPIC, TWO_TRUTHS_COUNT } = await import(DATA_URL);

const OUT_DIR = join(ROOT, "src/site/tech-escape/docs");
const HTML_PATH = join(OUT_DIR, "SEL-Two-Truths-Teacher-Review.html");
const PDF_PATH = join(OUT_DIR, "SEL-Two-Truths-Teacher-Review.pdf");

mkdirSync(OUT_DIR, { recursive: true });

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const dcCount = TWO_TRUTHS.filter((q) => q.topic === "Digital Citizenship").length;
const selCount = TWO_TRUTHS.filter((q) => q.topic === "Social Emotional Learning").length;
const date = new Date().toISOString().slice(0, 10);

const cards = TWO_TRUTHS.map((item, idx) => {
  const labels = ["A", "B", "C"];
  const stmts = item.statements.map((text, i) => {
    const isLie = i === item.lieIndex;
    return `
      <li class="stmt ${isLie ? "is-lie" : "is-truth"}">
        <span class="stmt-label">${labels[i]}</span>
        <span class="stmt-text">${esc(text)}</span>
        <span class="stmt-tag">${isLie ? "LIE" : "TRUTH"}</span>
      </li>`;
  }).join("");

  return `
    <article class="card" id="${esc(item.id)}">
      <header class="card-head">
        <div class="card-num">${idx + 1} of ${TWO_TRUTHS_COUNT}</div>
        <div class="card-id">${esc(item.id)}</div>
        <div class="card-topic">${esc(item.topic)}</div>
      </header>
      <div class="sender">${esc(item.sender)}</div>
      <p class="preview">${esc(item.preview)}</p>
      <p class="prompt">Which one is the lie? (In the game, students pick without seeing labels.)</p>
      <ul class="statements">${stmts}</ul>
      <div class="why">
        <strong>Why the lie is wrong</strong>
        <p>${esc(item.why)}</p>
      </div>
      <div class="notes">
        <strong>Teacher notes / suggested edits</strong>
        <div class="notes-box"></div>
      </div>
    </article>`;
}).join("");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Tech Escape — SEL Two Truths &amp; One Lie (Teacher Review)</title>
<style>
  @page {
    size: letter;
    margin: 0.65in 0.7in;
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    font-size: 15pt;
    line-height: 1.45;
    color: #111;
    background: #fff;
    margin: 0;
  }
  .cover {
    page-break-after: always;
    padding: 0.5in 0 1in;
  }
  .cover h1 {
    font-size: 32pt;
    line-height: 1.15;
    margin: 0 0 0.35in;
    color: #0d2847;
  }
  .cover .sub {
    font-size: 20pt;
    color: #2a5a8a;
    margin-bottom: 0.5in;
  }
  .cover p {
    font-size: 16pt;
    max-width: 7in;
    margin: 0.2in 0;
  }
  .cover ul {
    font-size: 16pt;
    margin: 0.25in 0;
    padding-left: 0.35in;
  }
  .cover .meta {
    margin-top: 0.6in;
    font-size: 13pt;
    color: #444;
  }
  .legend {
    border: 2px solid #ccc;
    border-radius: 10px;
    padding: 0.25in 0.35in;
    margin: 0.4in 0;
    font-size: 14pt;
  }
  .legend strong { display: block; margin-bottom: 0.1in; }
  .card {
    page-break-after: always;
    padding-bottom: 0.35in;
  }
  .card:last-child { page-break-after: auto; }
  .card-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15in 0.35in;
    align-items: baseline;
    margin-bottom: 0.15in;
    border-bottom: 3px solid #0d2847;
    padding-bottom: 0.12in;
  }
  .card-num {
    font-size: 14pt;
    font-weight: 700;
    color: #555;
  }
  .card-id {
    font-size: 18pt;
    font-weight: 800;
    color: #0d2847;
    font-family: Consolas, monospace;
  }
  .card-topic {
    font-size: 14pt;
    font-weight: 600;
    color: #2a5a8a;
    flex: 1;
  }
  .sender {
    font-size: 22pt;
    font-weight: 700;
    margin: 0.12in 0 0.08in;
  }
  .preview {
    font-size: 18pt;
    font-weight: 600;
    margin: 0 0 0.2in;
    color: #222;
  }
  .prompt {
    font-size: 13pt;
    color: #555;
    margin: 0 0 0.15in;
  }
  .statements {
    list-style: none;
    margin: 0 0 0.25in;
    padding: 0;
  }
  .stmt {
    display: grid;
    grid-template-columns: 0.45in 1fr auto;
    gap: 0.12in 0.2in;
    align-items: start;
    padding: 0.18in 0.2in;
    margin-bottom: 0.12in;
    border-radius: 8px;
    border: 2px solid #ddd;
    font-size: 17pt;
  }
  .stmt.is-truth {
    background: #eef8f0;
    border-color: #3d8f5a;
  }
  .stmt.is-lie {
    background: #fdeeee;
    border-color: #c44;
  }
  .stmt-label {
    font-weight: 800;
    font-size: 18pt;
    color: #0d2847;
  }
  .stmt-text { font-weight: 500; }
  .stmt-tag {
    font-size: 11pt;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 0.06in 0.12in;
    border-radius: 4px;
    white-space: nowrap;
  }
  .is-truth .stmt-tag {
    background: #3d8f5a;
    color: #fff;
  }
  .is-lie .stmt-tag {
    background: #b33;
    color: #fff;
  }
  .why {
    font-size: 15pt;
    background: #f4f7fb;
    border-left: 5px solid #2a5a8a;
    padding: 0.18in 0.22in;
    margin-bottom: 0.2in;
  }
  .why strong {
    display: block;
    font-size: 14pt;
    margin-bottom: 0.08in;
    color: #2a5a8a;
  }
  .why p { margin: 0; }
  .notes strong {
    display: block;
    font-size: 14pt;
    margin-bottom: 0.08in;
    color: #444;
  }
  .notes-box {
    min-height: 0.9in;
    border: 2px dashed #aaa;
    border-radius: 8px;
    background: #fafafa;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <section class="cover">
    <h1>Tech Escape — SEL Notifications</h1>
    <p class="sub">Two Truths &amp; One Lie — Teacher Review Packet</p>
    <p>
      These are the <strong>text-message style notifications</strong> that pop up during
      <em>Tech Escape</em> while students explore the haunted computer lab.
      Each scenario has <strong>two true statements and one lie</strong>.
      Students must spot the lie before the timer runs out.
    </p>
    <ul>
      <li><strong>${TWO_TRUTHS_COUNT}</strong> scenarios total</li>
      <li><strong>${dcCount}</strong> Digital Citizenship</li>
      <li><strong>${selCount}</strong> Social Emotional Learning</li>
    </ul>
    <div class="legend">
      <strong>How to use this packet</strong>
      Each page shows the <span style="color:#3d8f5a;font-weight:700">TRUTH</span> and
      <span style="color:#b33;font-weight:700">LIE</span> labels for review only —
      students do not see these in the game.
      Use the notes box to suggest edits, replacements, or new scenarios.
      Return feedback to Mr. Phil to update the game bank.
    </div>
    <p class="meta">
      Source: <code>src/site/tech-escape/js/data/twoTruths.js</code><br />
      Generated: ${date} · DVA Media Arts &amp; Tech
    </p>
  </section>
  ${cards}
</body>
</html>`;

writeFileSync(HTML_PATH, html, "utf8");
console.log(`Wrote ${HTML_PATH}`);

const chromePaths = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const chrome = chromePaths.find((p) => existsSync(p));
if (!chrome) {
  console.warn("Chrome not found — open the HTML file and Print → Save as PDF.");
  process.exit(0);
}

const fileUrl = pathToFileURL(HTML_PATH).href;
const result = spawnSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--allow-file-access-from-files",
    `--print-to-pdf=${PDF_PATH}`,
    "--no-pdf-header-footer",
    fileUrl,
  ],
  { encoding: "utf8", timeout: 120000 },
);

if (result.status !== 0) {
  console.error("Chrome PDF failed:", result.stderr || result.stdout);
  process.exit(1);
}

console.log(`Wrote ${PDF_PATH}`);

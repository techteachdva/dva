#!/usr/bin/env node
/**
 * Build Kahoot .xlsx + printable host guide from questions.json
 * Run: node build.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "questions.json"), "utf8"));

const rows = data.questions.map((q) => ({
  Question: q.question.slice(0, 95),
  "Answer 1": q.answers[0].slice(0, 60),
  "Answer 2": q.answers[1].slice(0, 60),
  "Answer 3": q.answers[2].slice(0, 60),
  "Answer 4": q.answers[3].slice(0, 60),
  "Time limit (seconds)": q.time,
  "Correct answer(s)": q.correct,
  "Image link": q.image,
}));

const ws = XLSX.utils.json_to_sheet(rows, {
  header: [
    "Question",
    "Answer 1",
    "Answer 2",
    "Answer 3",
    "Answer 4",
    "Time limit (seconds)",
    "Correct answer(s)",
    "Image link",
  ],
});
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Quiz");
XLSX.writeFile(wb, join(__dirname, "curt-birthday-movies-kahoot.xlsx"));

// TSV fallback
const tsvHeader = Object.keys(rows[0]).join("\t");
const tsvBody = rows.map((r) => Object.values(r).join("\t")).join("\n");
writeFileSync(join(__dirname, "curt-birthday-movies-kahoot.tsv"), tsvHeader + "\n" + tsvBody);

// Host guide HTML
const categoryCounts = {};
data.questions.forEach((q) => {
  categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
});

const cards = data.questions
  .map(
    (q) => `
    <article class="card">
      <div class="card-top">
        <span class="num">#${q.id}</span>
        <span class="cat">${q.category}</span>
        <span class="time">${q.time}s</span>
      </div>
      <div class="card-body">
        <img src="${q.image}" alt="Movie poster for question ${q.id}" loading="lazy" />
        <div class="card-text">
          <h2>${escapeHtml(q.question)}</h2>
          <ol class="answers">
            ${q.answers
              .map(
                (a, i) =>
                  `<li class="${i + 1 === q.correct ? "correct" : ""}">${escapeHtml(a)}${i + 1 === q.correct ? " ✓" : ""}</li>`
              )
              .join("")}
          </ol>
        </div>
      </div>
    </article>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Curt's Birthday Movie Kahoot — Host Guide</title>
  <style>
    :root {
      --bg: #0d0a12;
      --card: #16121f;
      --border: rgba(255,255,255,.1);
      --text: #f3eef8;
      --muted: #9d93ab;
      --accent: #e11d48;
      --gold: #fbbf24;
      --green: #4ade80;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    .hero {
      padding: 40px 24px;
      text-align: center;
      background: linear-gradient(180deg, rgba(225,29,72,.15), transparent);
      border-bottom: 1px solid var(--border);
    }
    .hero h1 {
      font-size: clamp(2rem, 6vw, 3rem);
      margin: 0 0 8px;
      letter-spacing: .04em;
    }
    .hero p { color: var(--muted); max-width: 640px; margin: 0 auto; }
    .stats {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;
      margin-top: 20px;
    }
    .stat {
      padding: 6px 12px; border: 1px solid var(--border); border-radius: 999px;
      font-size: .8rem; color: var(--gold);
    }
    .grid {
      max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px;
      display: grid; gap: 20px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--card);
      overflow: hidden;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .card-top {
      display: flex; gap: 10px; align-items: center;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
      font-size: .75rem; text-transform: uppercase; letter-spacing: .12em;
    }
    .num { color: var(--accent); font-weight: 700; }
    .cat { color: var(--muted); flex: 1; }
    .time { color: var(--gold); }
    .card-body {
      display: grid; grid-template-columns: 120px 1fr; gap: 16px;
      padding: 14px;
    }
    .card-body img {
      width: 120px; height: 180px; object-fit: cover; border-radius: 4px;
      border: 1px solid var(--border);
    }
    .card-text h2 {
      font-size: 1.05rem; margin: 0 0 12px; line-height: 1.35;
    }
    .answers { margin: 0; padding-left: 1.2rem; }
    .answers li { margin: 4px 0; color: var(--muted); }
    .answers li.correct { color: var(--green); font-weight: 700; }
    .print-note {
      max-width: 1100px; margin: 0 auto; padding: 0 16px 24px;
      color: var(--muted); font-size: .9rem;
    }
    @media (max-width: 640px) {
      .card-body { grid-template-columns: 1fr; }
      .card-body img { width: 100%; height: auto; max-height: 280px; }
    }
    @media print {
      body { background: #fff; color: #000; }
      .hero { background: none; }
      .card { border-color: #ccc; background: #fff; }
      .answers li { color: #333; }
      .answers li.correct { color: #0a6b0a; }
      .print-note { display: none; }
    }
  </style>
</head>
<body>
  <header class="hero">
    <h1>Curt's Birthday Movie Kahoot</h1>
    <p>50 blockbuster trivia questions (1990s–2026) · classic horror + modern hits · host answer key with posters</p>
    <div class="stats">
      <span class="stat">50 questions</span>
      ${Object.entries(categoryCounts)
        .map(([k, v]) => `<span class="stat">${v} ${k}</span>`)
        .join("")}
    </div>
  </header>
  <p class="print-note">Print to PDF: Ctrl+P → Save as PDF. Images are Wikipedia poster thumbnails for party reference.</p>
  <main class="grid">${cards}</main>
</body>
</html>`;

writeFileSync(join(__dirname, "host-guide.html"), html);

console.log("Built:");
console.log("  curt-birthday-movies-kahoot.xlsx");
console.log("  curt-birthday-movies-kahoot.tsv");
console.log("  host-guide.html");

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Export the ITEM Diagnostic question bank to JSON for the spreadsheet builder.
 * Source of truth: src/site/tech-escape/js/data/questions.js
 * Run: node scripts/export-item-question-bank.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const questionsPath = path.join(root, "src/site/tech-escape/js/data/questions.js");
const standardsPath = path.join(root, "src/site/scripts/writeflow-item-standards.js");
const outPath = path.join(root, "scripts/.item-question-bank.json");

const { ALL_QUESTIONS } = await import(pathToFileURL(questionsPath).href);

const TERMINAL = {
  DES: { key: "design", name: "Design Lab", topic: "The Design Process" },
  SYS: { key: "systems", name: "Network Closet", topic: "Computing Systems & Networks" },
  DAT: { key: "data", name: "Data Vault", topic: "Data, AI & Digital Citizenship" },
  COD: { key: "code", name: "Code Bay", topic: "Algorithms & Programming" },
};

const LEVEL = {
  1: "1 · Approachable",
  2: "2 · Core",
  3: "3 · Challenging",
};

const DIAGNOSTIC_CODES = new Set([
  "8.1.2.3", "8.1.3.1", "8.1.3.2", "8.1.3.3", "8.1.3.4",
  "8.1.4.2", "8.1.4.3", "8.1.5.1", "8.1.5.2",
  "8.2.1.1", "8.2.1.2", "8.2.1.3", "8.2.2.1", "8.2.2.2", "8.2.2.3", "8.2.2.4",
  "8.3.1.1", "8.3.1.2", "8.3.1.3", "8.3.2.1", "8.3.3.1", "8.3.3.2", "8.3.3.3", "8.3.4.2",
]);

function parseStandards(text) {
  const start = text.indexOf("const ITEM_2025_STANDARDS = [");
  const end = text.indexOf("\n  ];", start);
  const block = text.slice(start, end);
  const standards = {};
  const chunks = block.split(/\n    \{/).slice(1);
  for (const chunk of chunks) {
    const pick = (key) => {
      const m = chunk.match(new RegExp(`${key}:\\s*"((?:\\\\.|[^"\\\\])*)"`));
      return m ? m[1].replace(/\\"/g, '"') : "";
    };
    const code = pick("code");
    if (!code) continue;
    standards[code] = {
      code,
      strand: pick("strand"),
      benchmark: pick("benchmark"),
      shortTitle: pick("shortTitle"),
      anchor: pick("anchorStandard"),
    };
  }
  return standards;
}

const standards = parseStandards(fs.readFileSync(standardsPath, "utf8"));

function parseStd(std) {
  const raw = String(std || "");
  const [primary, secondary = ""] = raw.split("|").map((s) => s.trim());
  const item = primary.match(/^ITEM\s+([\d.]+)\s*-\s*(.*)$/);
  if (item) {
    return { code: item[1], label: item[2].trim(), secondary, family: "ITEM" };
  }
  const other = primary.match(/^([A-Za-z]+)\s+([\w.-]+)\s*-\s*(.*)$/);
  if (other) {
    return {
      code: `${other[1]} ${other[2]}`,
      label: other[3].trim(),
      secondary: secondary || "Not an ITEM code. Kept in Tech Escape; not drawn on the diagnostic.",
      family: other[1],
    };
  }
  return { code: "", label: primary, secondary, family: "" };
}

const questions = ALL_QUESTIONS.map((q, index) => {
  const prefix = String(q.id || "").slice(0, 3);
  const terminal = TERMINAL[prefix] || { key: "general", name: "General", topic: "General" };
  const parsed = parseStd(q.std);
  const catalog = standards[parsed.code] || null;
  const correct = Array.isArray(q.correct) ? q.correct : [];
  return {
    order: index + 1,
    id: q.id,
    terminal: terminal.name,
    topic: terminal.topic,
    code: parsed.code,
    standard: catalog?.shortTitle || parsed.label,
    strand: catalog?.strand || (parsed.family && parsed.family !== "ITEM" ? `${parsed.family} reference, outside the ITEM draw` : ""),
    benchmark: catalog?.benchmark || "",
    anchor: catalog?.anchor || "",
    level: LEVEL[q.level ?? 2] || "2 · Core",
    levelNum: q.level ?? 2,
    type: correct.length > 1 ? "Select all that apply" : "One answer",
    question: q.q,
    options: q.a,
    correct,
    why: q.why,
    secondary: parsed.secondary,
    inDiagnostic: DIAGNOSTIC_CODES.has(parsed.code),
  };
});

fs.writeFileSync(outPath, JSON.stringify({ questions, standards }, null, 2));
console.log(`Exported ${questions.length} questions to ${path.relative(root, outPath)}`);

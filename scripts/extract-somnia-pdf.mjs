#!/usr/bin/env node
/**
 * Somnia PDF extraction stub
 *
 * Maps card zones in "Somnia 11 Print Ready.pdf" to output image paths.
 * Full extraction requires a PDF library (e.g. pdf-lib, pdfjs-dist, or sharp + poppler).
 *
 * Usage (future):
 *   node scripts/extract-somnia-pdf.mjs --pdf "path/to/Somnia 11 Print Ready.pdf"
 *   node scripts/extract-somnia-pdf.mjs --list          # print page mapping only
 *   node scripts/extract-somnia-pdf.mjs --deck landscapes
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, "../src/site/somnia/data/card-manifest.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const PAGE_NOTES = {
  sourcePdf: manifest.sourcePdf,
  version: manifest.version,
  notes: manifest.notes,
  sections: {
    dreambeasts: { pages: "7, 11–13", bosses: "page 7 (Cerberus, Double, Leviathan)" },
    mindstream: { pages: "8–10", suits: ["lucidity", "elasticity", "willpower"] },
    objects: { pages: "14–17, 30–33, 45–48" },
    landscapes: { pages: "61–73" },
    psyche: { pages: "49–60 (approx, 3 copies per card)" },
    archetypes: { pages: "74–85" },
    dreamers: { pages: "1–6" },
    dreams: { pages: "18–29" },
  },
};

function listMapping() {
  console.log("# Somnia PDF Page Mapping\n");
  console.log(`Source: ${PAGE_NOTES.sourcePdf}`);
  console.log(`Notes: ${PAGE_NOTES.notes}\n`);

  for (const [section, info] of Object.entries(PAGE_NOTES.sections)) {
    console.log(`## ${section}`);
    if (typeof info === "object") {
      Object.entries(info).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    }
    console.log();
  }

  for (const [deck, cards] of Object.entries(manifest)) {
    if (deck === "version" || deck === "sourcePdf" || deck === "notes") continue;
    const entries = Object.entries(cards);
    if (!entries.length) continue;
    console.log(`## ${deck} (${entries.length} entries)`);
    entries.slice(0, 5).forEach(([id, meta]) => {
      console.log(`  ${id}: page ${meta.page} → ${meta.image}`);
    });
    if (entries.length > 5) console.log(`  ... and ${entries.length - 5} more`);
    console.log();
  }
}

const args = process.argv.slice(2);
if (args.includes("--list") || args.length === 0) {
  listMapping();
  console.log("Full PDF crop extraction not implemented. Install pdf-lib or use external tooling.");
  process.exit(0);
}

if (args.includes("--help")) {
  console.log(`
Somnia PDF extraction stub

  --list              Print page mapping from card-manifest.json (default)
  --pdf <path>        [not implemented] Crop cards from PDF
  --deck <name>       [not implemented] Extract one deck only

Manifest: ${manifestPath}
`);
  process.exit(0);
}

console.error("PDF extraction not yet implemented. Run with --list to see page mapping.");
process.exit(1);

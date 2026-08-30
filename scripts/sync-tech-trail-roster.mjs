import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rosterPath = path.join(root, "api/tech-trail/class-roster.json");
const tsvPath = path.join(root, "api/tech-trail/class-roster-import.tsv");
const gsPath = path.join(root, "google-apps-script/tech-trail-backend.gs");

const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));

const rosterRows = [];
for (const [classroom, names] of Object.entries(roster.classrooms || {})) {
  for (const name of names) {
    const username = String(name || "").trim();
    if (!username) continue;
    rosterRows.push([classroom, username, "TRUE"]);
  }
}

const tsv = ["classroom\tusername\tactive", ...rosterRows.map((r) => r.join("\t"))].join("\n");
fs.writeFileSync(tsvPath, tsv);
console.log(`Wrote ${path.relative(root, tsvPath)} (${rosterRows.length} roster rows)`);

const marker = "/** Auto-generated from api/tech-trail/class-roster.json";
const embedBlock = `${marker} — run: npm run sync:tech-trail-roster */\nconst CLASS_ROSTER_EMBED = ${JSON.stringify(roster.classrooms, null, 2)};`;

let gs = fs.readFileSync(gsPath, "utf8");
const replaced = gs.replace(
  /\/\*\* Auto-generated from api\/tech-trail\/class-roster\.json[\s\S]*?\*\/\s*const CLASS_ROSTER_EMBED = \{[\s\S]*?\};/,
  embedBlock
);

if (replaced === gs) {
  console.warn("sync-tech-trail-roster: CLASS_ROSTER_EMBED block not found — add it to tech-trail-backend.gs");
} else {
  fs.writeFileSync(gsPath, replaced);
  console.log(`Updated ${path.relative(root, gsPath)}`);
}

if (rosterRows.length === 0) {
  console.log("Add student names under each classroom in class-roster.json, then re-run sync.");
} else {
  console.log("Import roster: open ClassRosters sheet tab → File → Import → upload class-roster-import.tsv");
}

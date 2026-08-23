import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const teachersPath = path.join(root, "api/writeflow/approved-teachers.json");
const rosterPath = path.join(root, "api/writeflow/student-roster.json");
const authGsPath = path.join(root, "google-apps-script/writeflow-auth.gs");

const teachers = JSON.parse(fs.readFileSync(teachersPath, "utf8"));
const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));

const marker = "/** Auto-generated from api/writeflow/approved-teachers.json";
const embedBlock = `${marker} — run: npm run sync:writeflow-auth */\nconst APPROVED_TEACHER_EMAILS_EMBED = ${JSON.stringify(teachers.emails, null, 2)};`;

let authGs = fs.readFileSync(authGsPath, "utf8");
const replaced = authGs.replace(
  /\/\*\* Auto-generated from api\/writeflow\/approved-teachers\.json[\s\S]*?\*\/\s*const APPROVED_TEACHER_EMAILS_EMBED = \[[\s\S]*?\];/,
  embedBlock
);

if (replaced === authGs) {
  console.warn("sync-writeflow-auth: APPROVED_TEACHER_EMAILS_EMBED block not found — update writeflow-auth.gs manually");
} else {
  fs.writeFileSync(authGsPath, replaced);
  console.log(`Updated ${path.relative(root, authGsPath)} (${teachers.emails.length} teacher emails)`);
}

const rosterRows = [];
for (const [classroom, names] of Object.entries(roster.classrooms || {})) {
  for (const name of names) {
    const username = String(name || "").trim();
    if (!username) continue;
    rosterRows.push([classroom, username, "TRUE"]);
  }
}

const tsvPath = path.join(root, "api/writeflow/student-roster-import.tsv");
const tsv = ["classroom\tusername\tactive", ...rosterRows.map((r) => r.join("\t"))].join("\n");
fs.writeFileSync(tsvPath, tsv);
console.log(`Wrote ${path.relative(root, tsvPath)} (${rosterRows.length} roster rows)`);

if (rosterRows.length === 0) {
  console.log("Student roster JSON has no names yet — add first name + last initial under each classroom, then re-run sync.");
} else {
  console.log("Import roster: open StudentRoster sheet → File → Import → upload student-roster-import.tsv");
}

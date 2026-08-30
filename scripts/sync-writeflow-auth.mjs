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

const rosterMarker = "/** Auto-generated from api/writeflow/student-roster.json";
const rosterEmbedBlock = `${rosterMarker} — run: npm run sync:writeflow-auth */\nconst STUDENT_ROSTER_EMBED = ${JSON.stringify(roster.classrooms || {}, null, 2)};`;

let rosterReplaced = authGs.replace(
  /\/\*\* Auto-generated from api\/writeflow\/student-roster\.json[\s\S]*?\*\/\s*const STUDENT_ROSTER_EMBED = \{[\s\S]*?\};/,
  rosterEmbedBlock
);

if (rosterReplaced === authGs) {
  const anchor = authGs.indexOf("const APPROVED_TEACHER_EMAILS_EMBED = [");
  const end = authGs.indexOf("];", anchor);
  if (anchor >= 0 && end >= 0) {
    rosterReplaced =
      authGs.slice(0, end + 3) + "\n\n" + rosterEmbedBlock + authGs.slice(end + 3);
    fs.writeFileSync(authGsPath, rosterReplaced);
    console.log(`Inserted STUDENT_ROSTER_EMBED in ${path.relative(root, authGsPath)}`);
  } else {
    console.warn("sync-writeflow-auth: STUDENT_ROSTER_EMBED block not found — update writeflow-auth.gs manually");
  }
} else {
  fs.writeFileSync(authGsPath, rosterReplaced);
  console.log(`Updated STUDENT_ROSTER_EMBED in ${path.relative(root, authGsPath)}`);
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
const tsv = ["classroom\tusername\tactive\tpassword", ...rosterRows.map((r) => r.join("\t") + "\t")].join("\n");
fs.writeFileSync(tsvPath, tsv);
console.log(`Wrote ${path.relative(root, tsvPath)} (${rosterRows.length} roster rows)`);

if (rosterRows.length === 0) {
  console.log("Student roster JSON has no names yet — add first name + last initial under each classroom, then re-run sync.");
} else {
  console.log("Import roster: open StudentRoster sheet → File → Import → upload student-roster-import.tsv");
}

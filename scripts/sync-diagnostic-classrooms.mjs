import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const classesPath = path.join(root, "api/diagnostic-writing/classes.json");
const codesPath = path.join(root, "api/diagnostic-writing/classroom-codes.json");
const classes = JSON.parse(fs.readFileSync(classesPath, "utf8"));
const codes = JSON.parse(fs.readFileSync(codesPath, "utf8"));

const marker = "/** Auto-generated from api/diagnostic-writing/classes.json";
const gsBlock = `${marker} — run: npm run sync:classrooms */\nconst VALID_CLASSROOMS = ${JSON.stringify(classes, null, 2)};`;

const classroomsJs = `${marker} — run: npm run sync:classrooms */
export const VALID_CLASSROOMS = ${JSON.stringify(classes, null, 2)};

export const CLASSROOM_CODES = ${JSON.stringify(codes, null, 2)};

const APOSTROPHE_RE = /[\\u2018\\u2019\\u201B\\u2032]/g;

export function normalizeClassroom(value) {
  return String(value || "").trim().replace(APOSTROPHE_RE, "'");
}

/** Returns the canonical classroom name from classes.json, or "" if invalid. */
export function resolveClassroom(value) {
  const norm = normalizeClassroom(value);
  if (!norm) return "";
  for (const classroom of VALID_CLASSROOMS) {
    if (normalizeClassroom(classroom) === norm) return classroom;
  }
  return "";
}

export function normalizeClassCode(value) {
  return String(value || "").trim().toLowerCase().replace(/\\s+/g, "");
}

export function verifyClassroomCode(classroom, code) {
  const resolved = resolveClassroom(classroom);
  if (!resolved) return false;
  const expected = CLASSROOM_CODES[resolved];
  if (!expected) return false;
  return normalizeClassCode(code) === normalizeClassCode(expected);
}

export function isValidClassroom(value) {
  return Boolean(resolveClassroom(value));
}
`;

const targets = [
  path.join(root, "google-apps-script/diagnostic-writing-backend.gs"),
];

for (const file of targets) {
  let content = fs.readFileSync(file, "utf8");
  const replaced = content.replace(
    /\/\*\* (?:Keep in sync with api\/diagnostic-writing\/classes\.json|Auto-generated from api\/diagnostic-writing\/classes\.json)[\s\S]*?\*\/\s*const VALID_CLASSROOMS = \[[\s\S]*?\];/,
    gsBlock
  );
  if (replaced === content) {
    console.warn(`sync-diagnostic-classrooms: VALID_CLASSROOMS block not found in ${path.relative(root, file)}`);
    continue;
  }
  fs.writeFileSync(file, replaced);
  console.log(`Updated ${path.relative(root, file)} (${classes.length} classrooms)`);
}

fs.writeFileSync(path.join(root, "api/diagnostic-writing/classrooms.js"), classroomsJs);
console.log(`Updated api/diagnostic-writing/classrooms.js (${classes.length} classrooms)`);

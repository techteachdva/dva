import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const classesPath = path.join(root, "api/diagnostic-writing/classes.json");
const classes = JSON.parse(fs.readFileSync(classesPath, "utf8"));

const marker = "/** Auto-generated from api/diagnostic-writing/classes.json";
const block = `${marker} — run: npm run sync:classrooms */\nconst VALID_CLASSROOMS = ${JSON.stringify(classes, null, 2)};`;

const targets = [
  path.join(root, "google-apps-script/diagnostic-writing-backend.gs"),
];

for (const file of targets) {
  let content = fs.readFileSync(file, "utf8");
  const replaced = content.replace(
    /\/\*\* (?:Keep in sync with api\/diagnostic-writing\/classes\.json|Auto-generated from api\/diagnostic-writing\/classes\.json)[\s\S]*?\*\/\s*const VALID_CLASSROOMS = \[[\s\S]*?\];/,
    block
  );
  if (replaced === content) {
    console.warn(`sync-diagnostic-classrooms: VALID_CLASSROOMS block not found in ${path.relative(root, file)}`);
    continue;
  }
  fs.writeFileSync(file, replaced);
  console.log(`Updated ${path.relative(root, file)} (${classes.length} classrooms)`);
}

#!/usr/bin/env node
/**
 * Ensures every Object in objects.json has a runtime effect path.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const objects = JSON.parse(
  fs.readFileSync(path.join(REPO, "src/site/somnia/data/objects.json"), "utf8"),
);

const oe = await import(pathToFileURL(path.join(REPO, "src/site/somnia/js/object-effects.js")).href);

const PERSISTENT_HANDLED = new Set([
  "row-boat", "hourglass", "conch-shell", "rope",
  "mobius-crystal", "skeleton-key", "monkey-paw",
  "water", "air", "earth", "fire",
  "severed-torso", "severed-head", "severed-legs", "severed-arms", "beating-heart",
  "brass-emerald-bracelet", "golden-ruby-necklace", "silver-sapphire-ring",
  "the-bottom-stick", "the-middle-stick", "the-top-stick",
]);

const failures = [];

for (const obj of objects) {
  if (obj.subtype === "must-play") {
    if (obj.id.startsWith("the-nothing") || obj.id === "the-all-seeing-eye") continue;
    failures.push({ id: obj.id, msg: "must-play missing handler" });
    continue;
  }
  if (obj.subtype === "persistent") {
    if (!PERSISTENT_HANDLED.has(obj.id)) {
      failures.push({ id: obj.id, msg: "persistent not in activatePersistent map" });
    }
    continue;
  }
  if (obj.subtype === "instant" && !oe.OBJECT_EFFECTS[obj.id]) {
    failures.push({ id: obj.id, msg: "instant missing OBJECT_EFFECTS entry" });
  }
}

const out = {
  pass: failures.length === 0,
  objectCount: objects.length,
  effectKeys: Object.keys(oe.OBJECT_EFFECTS).length,
  failures,
};

console.log(JSON.stringify(out, null, 2));
process.exit(failures.length ? 1 : 0);

/**
 * Smoke-test GTG story graph, map aliases, and minigame/phrase coverage.
 * Run: npm run validate:tech-trail
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "src/site/scripts");

function loadWindowExport(file, exportName) {
  const code = fs.readFileSync(path.join(scriptsDir, file), "utf8");
  const sandbox = { window: {}, console };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.window[exportName];
}

const storyMod = loadWindowExport("tech-trail-story.js", "TechTrailStory");
const visualsMod = loadWindowExport("tech-trail-visuals.js", "TechTrailVisuals");
const minigamesMod = loadWindowExport("tech-trail-minigames.js", "TechTrailMinigames");
const phrasesMod = loadWindowExport("tech-trail-room-phrases.js", "TechTrailRoomPhrases");

const STORY = storyMod?.STORY || {};
const MAP_ROOMS = visualsMod?.MAP_ROOMS || {};
const ROOM_GAMES = minigamesMod?.ROOM_GAMES || {};
const ROOM_PHRASES = phrasesMod?.ROOM_PHRASES || {};
const mapRoomForNode = visualsMod?.mapRoomForNode;

const storyKeys = new Set(Object.keys(STORY));
const mapRoomIds = new Set(Object.keys(MAP_ROOMS));
const errors = [];
const warnings = [];

function collectNextRefs(node) {
  const refs = [];
  for (const choice of node.choices || []) {
    if (choice.next) refs.push(choice.next);
  }
  if (node.typingChallenge?.next) refs.push(node.typingChallenge.next);
  return refs;
}

for (const [nodeId, node] of Object.entries(STORY)) {
  for (const next of collectNextRefs(node)) {
    if (!storyKeys.has(next)) {
      errors.push(`Dangling next "${next}" from node "${nodeId}"`);
    }
  }
}

for (const roomId of mapRoomIds) {
  if (roomId === "start") continue;
  if (!ROOM_GAMES[roomId]) warnings.push(`MAP_ROOMS "${roomId}" has no minigame`);
  if (!ROOM_PHRASES[roomId]) warnings.push(`MAP_ROOMS "${roomId}" has no phrase pack`);
}

for (const roomId of Object.keys(ROOM_GAMES)) {
  if (!mapRoomIds.has(roomId)) {
    errors.push(`ROOM_GAMES "${roomId}" is not in MAP_ROOMS`);
  }
}

if (typeof mapRoomForNode === "function") {
  for (const nodeId of storyKeys) {
    const mapped = mapRoomForNode(nodeId);
    if (!mapped?.id) {
      warnings.push(`Node "${nodeId}" did not map to a room`);
    }
  }
}

if (!STORY.guide_deep) errors.push("Missing guide_deep story node");
if (!STORY.guide_deep_win) errors.push("Missing guide_deep_win story node");

console.log(`Story nodes: ${storyKeys.size}`);
console.log(`Map rooms: ${mapRoomIds.size}`);
console.log(`Minigames: ${Object.keys(ROOM_GAMES).length}`);
console.log(`Phrase rooms: ${Object.keys(ROOM_PHRASES).length}`);

if (warnings.length) {
  console.warn(`\n${warnings.length} warning(s):`);
  warnings.slice(0, 20).forEach((w) => console.warn(`  - ${w}`));
  if (warnings.length > 20) console.warn(`  ... and ${warnings.length - 20} more`);
}

if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log("\nGTG story graph validation passed.");

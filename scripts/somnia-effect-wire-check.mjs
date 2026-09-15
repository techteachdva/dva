import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const beasts = JSON.parse(readFileSync(join(root, "src/site/somnia/data/dreambeasts.json"), "utf8"));
const events = JSON.parse(readFileSync(join(root, "src/site/somnia/data/mindstream.json"), "utf8"));
const objects = JSON.parse(readFileSync(join(root, "src/site/somnia/data/objects.json"), "utf8"));
const dreambeastsJs = readFileSync(join(root, "src/site/somnia/js/dreambeasts.js"), "utf8");
const mindstreamJs = readFileSync(join(root, "src/site/somnia/js/mindstream.js"), "utf8")
  + readFileSync(join(root, "src/site/somnia/js/mindstream-extra.js"), "utf8");
const objectJs = readFileSync(join(root, "src/site/somnia/js/object-effects.js"), "utf8")
  + readFileSync(join(root, "src/site/somnia/js/objects.js"), "utf8");
const gameJs = readFileSync(join(root, "src/site/somnia/js/game.js"), "utf8");

const problems = [];

if (!gameJs.includes("applyAcceptEffect(")) problems.push("game.js does not call applyAcceptEffect");
if (!gameJs.includes("pendingEffectChoice")) problems.push("game.js does not block on pendingEffectChoice");

function beastMapWired(source, id) {
  return source.includes(`${id}:`) || source.includes(`"${id}"`);
}

for (const beast of beasts) {
  if (!beastMapWired(dreambeastsJs, beast.id)) {
    problems.push(`Dreambeast ${beast.id} missing accept/fail map entry`);
  }
  if (beast.rejectEffect && !dreambeastsJs.includes(`case "${beast.rejectEffect.type}"`)) {
    problems.push(`Reject type ${beast.rejectEffect.type} (${beast.id}) has no switch case`);
  }
}

const eventIds = [...events.lucidity, ...events.elasticity, ...events.willpower].map((c) => c.id);
for (const id of eventIds) {
  if (!mindstreamJs.includes(`"${id}"`) && !mindstreamJs.includes(`${id}:`)) {
    problems.push(`Event ${id} has no handler key`);
  }
}

for (const obj of objects) {
  const id = obj.id;
  const wired = objectJs.includes(`"${id}"`) || objectJs.includes(`${id}:`)
    || objectJs.includes("the-nothing") && id.startsWith("the-nothing")
    || ["severed-torso", "severed-legs", "severed-head", "severed-arms", "beating-heart",
      "the-bottom-stick", "the-middle-stick", "the-top-stick",
      "brass-emerald-bracelet", "golden-ruby-necklace", "silver-sapphire-ring",
      "the-all-seeing-eye"].includes(id);
  if (!wired) problems.push(`Object ${id} may not be wired`);
}

console.log(JSON.stringify({
  beasts: beasts.length,
  events: eventIds.length,
  objects: objects.length,
  problems,
}, null, 2));
if (problems.length) process.exit(1);

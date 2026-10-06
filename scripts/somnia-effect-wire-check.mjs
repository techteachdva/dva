import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT_RESOLUTIONS } from "../src/site/somnia/js/event-resolutions.js";
import { DREAM_RESOLUTIONS } from "../src/site/somnia/js/dream-resolutions.js";
import { resolutionSideSteps } from "../src/site/somnia/js/resolution-effects.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];

function stepsOf(side) {
  return resolutionSideSteps(side).map((step) => step.effect);
}

function verbsInHint(hint) {
  const text = String(hint || "").toLowerCase();
  const verbs = [];
  if (/all draw|all dreamers draw/.test(text)) verbs.push("drawPsycheAll");
  else if (/\bdraw\b/.test(text)) verbs.push("drawPsyche", "drawPsycheAll", "drawPsycheAndPT", "drawPsycheAndReturn", "drawObject");
  if (/\breturn\b/.test(text)) verbs.push("returnCards", "returnCardsAll", "returnAndPT", "drawPsycheAndReturn");
  if (/\bpt\b|power token/.test(text)) verbs.push("grantPT", "drawPsycheAndPT", "returnAndPT");
  if (/\bmove\b/.test(text)) verbs.push("moveToNamed");
  if (/free meet/.test(text)) verbs.push("freeMeetAction");
  if (/\breveal\b/.test(text)) verbs.push("revealLandscapes");
  if (/\bforget\b/.test(text)) verbs.push("forgetLandscapes");
  if (/repress top/.test(text)) verbs.push("repressTopPsycheDeck", "repressTopMindstream");
  if (/object or psyche/.test(text)) verbs.push("discardObjectOrPsyche");
  else if (/\bdiscard\b/.test(text) && !/\bobject\b/.test(text)) {
    verbs.push("discardPsyche", "discardPsycheAll", "discardHighestPsyche", "discardSuitPsyche", "discardDream", "discardObjectOrPsyche");
  }
  if (/\bspawn\b/.test(text)) verbs.push("spawnEncounter", "spawnEncountersOnDreamers");
  if (/skip the next explore/.test(text)) verbs.push("skipNextExplore");
  if (/meet is your only/.test(text)) verbs.push("meetOnlyThisRound");
  return verbs;
}

function auditTable(name, table) {
  for (const [id, spec] of Object.entries(table)) {
    for (const sideName of ["good", "bad"]) {
      const side = spec[sideName];
      if (!side) {
        problems.push(`${name} ${id} missing ${sideName}`);
        continue;
      }
      const steps = stepsOf(side);
      if (!steps.length) problems.push(`${name} ${id} ${sideName} has no steps`);
      const hint = side.hint || "";
      if (hint.includes(";") && (!side.steps || side.steps.length < 2)) {
        problems.push(`${name} ${id} ${sideName} hint has two verbs but fewer than two steps: "${hint}"`);
      }
      const needed = verbsInHint(hint);
      if (needed.length && !needed.some((verb) => steps.includes(verb))) {
        problems.push(`${name} ${id} ${sideName} hint "${hint}" not covered by steps [${steps.join(", ")}]`);
      }
    }
  }
}

auditTable("event", EVENT_RESOLUTIONS);
auditTable("dream", DREAM_RESOLUTIONS);

const resolutionJs = readFileSync(join(root, "src/site/somnia/js/resolution-effects.js"), "utf8");
if (resolutionJs.includes("state.skipNextExplore =")) {
  problems.push("skipNextExplore still writes state.skipNextExplore");
}
if (!resolutionJs.includes("state.skipExploreNextRound = true")) {
  problems.push("skipNextExplore does not set skipExploreNextRound");
}
if (resolutionJs.includes("state.meetOnlyThisRound =")) {
  problems.push("meetOnlyThisRound still writes state.meetOnlyThisRound");
}
if (!resolutionJs.includes("state.meetOnlyRound = true")) {
  problems.push("meetOnlyThisRound does not set meetOnlyRound");
}

console.log(JSON.stringify({
  events: Object.keys(EVENT_RESOLUTIONS).length,
  dreams: Object.keys(DREAM_RESOLUTIONS).length,
  problems,
}, null, 2));
if (problems.length) process.exit(1);

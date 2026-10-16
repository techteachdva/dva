/**
 * Ainmos seed hunt: plays Cycle 1 (three Dreams) with the smart bot for many
 * seeds and lists the ones that make a good first Cycle to show:
 * the Cycle's Dreambeast falls in Dream 2 and an Archetype is Acquired by the
 * end of Dream 3. Seeds replay exactly (dice follow the seed since 0.26.1).
 *
 *   node scripts/ainmos-seed-hunt.mjs [count] [dreamerId|all] [length]
 */
import { pathToFileURL } from "url";
import { resolve, join } from "path";

const sim = await import(pathToFileURL(resolve("scripts/ainmos-bot-sim.mjs")).href);
const { DATA, stateMod } = sim;
const JS = resolve("src/site/ainmos/js");
const autoplay = await import(pathToFileURL(join(JS, "dev/autoplay.js")).href);

const COUNT = Number(process.argv[2]) || 300;
const WHO = process.argv[3] || "all";
const LENGTH = process.argv[4] || "daydream";
const dreamers = DATA.dreamers.filter((d) => !d.hidden && (WHO === "all" || d.id === WHO));

/** Play until the end of Cycle 1 (round 4 begins) and note what happened when. */
export function playCycleOne(seed, dreamer) {
  const state = stateMod.createInitialState(DATA, { lengthKey: LENGTH, seed, selectedDreamers: [dreamer], boardMode: "freeform" });
  const memo = {};
  const events = { beastRound: null, archRound: null, deaths: 0, fightsWon: 0, fightsLost: 0, steps: 0 };
  let guard = 3000;
  while (state.status === "playing" && state.round <= 3 && guard-- > 0) {
    autoplay.stepAutoplay(state, memo);
    events.steps += 1;
    if (events.beastRound == null && (state.bossesDefeated || []).length) events.beastRound = state.round;
    if (events.archRound == null && (state.acquiredPoints || 0) > 0) events.archRound = state.round;
  }
  events.deaths = state.deathClock || 0;
  events.fightsWon = state.runStats?.fightsWon || 0;
  events.fightsLost = state.runStats?.fightsLost || 0;
  events.status = state.status;
  events.hand = state.players[0]?.hand?.length || 0;
  return events;
}

const hits = [];
for (let i = 0; i < COUNT; i += 1) {
  const seed = `WAKE${String(i).padStart(4, "0")}`;
  for (const dreamer of dreamers) {
    const e = playCycleOne(seed, dreamer);
    const good = e.beastRound === 2 && e.archRound != null && e.archRound <= 3 && e.deaths === 0;
    if (good) hits.push({ seed, dreamer: dreamer.id, ...e });
  }
}
// Most drama first: a lost fight along the way, then fewer steps (a tighter video).
hits.sort((a, b) => (b.fightsLost > 0) - (a.fightsLost > 0) || a.steps - b.steps);
console.log(`${hits.length} good seeds out of ${COUNT * dreamers.length}`);
hits.slice(0, 25).forEach((h) => console.log(JSON.stringify(h)));

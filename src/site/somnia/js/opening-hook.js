/** Opening call to adventure. One template, slots filled from the live table.
 *  Phrase picks are hashed from the seed so a dream stays stable and another seed can differ.
 */

import { adjacentTiles } from "./hex.js";
import { PSYCHE_STARTING_HAND } from "./data.js";
import { MAX_PSYCHE_IN_HAND } from "./psyche.js";

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];

function numberWord(n) {
  return NUMBER_WORDS[n] || String(n);
}

function hashString(str) {
  let h = 2166136261;
  const text = String(str || "");
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hookKey(state) {
  return `${state?.seed || ""}|${state?.gameId || ""}|${state?.tutorialMode ? "tutorial" : "play"}`;
}

function pick(list, state, salt) {
  if (!list.length) return "";
  return list[hashString(`${hookKey(state)}|${salt}`) % list.length];
}

function archetypeCall(name) {
  const clean = String(name || "an Archetype").trim();
  if (/^(the|an|a)\s/i.test(clean)) return clean;
  return `the ${clean}`;
}

/** One revealed Landscape beside The Bed. Same dream, same name. */
export function openingNeighborLandscape(state) {
  const bed = state?.board?.find((tile) => tile.center || tile.id === "bed");
  const beside = bed
    ? adjacentTiles(state, bed.id).filter((tile) => tile.revealed && !tile.wasteland && !tile.center)
    : [];
  const pool = beside.length
    ? beside
    : (state?.board || []).filter((tile) => tile.revealed && !tile.wasteland && !tile.center);
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return sorted[hashString(`${hookKey(state)}|neighbor`) % sorted.length];
}

function friendsClause(state) {
  const dreamers = (state?.players || [])
    .filter((player) => player.alive !== false)
    .map((player) => player.dreamer?.name || player.name)
    .filter(Boolean);
  const count = dreamers.length;
  if (count === 1) {
    return pick([
      `with ${dreamers[0]} beside you, a friend under a different face`,
      "surrounded by the feeling of friends, though they go by different faces",
    ], state, "friends");
  }
  if (count === 2) {
    return pick([
      `with ${dreamers[0]} and ${dreamers[1]} beside you, friends under different faces`,
      "surrounded by friends, though they go by different faces",
    ], state, "friends");
  }
  if (count > 2) {
    return pick([
      `among ${numberWord(count)} friends who go by different faces`,
      `with ${dreamers[0]} and ${dreamers[1]} beside you, and more friends under different faces`,
      "surrounded by friends, though they go by different faces",
    ], state, "friends");
  }
  return "surrounded by friends, though they go by different faces";
}

/** The wake story. Starting fingertips are the opening Psyche deal (5). The longing is a full hand (10). */
export function openingHookText(state) {
  const call = archetypeCall(state?.activeArchetype?.name);
  const neighbor = openingNeighborLandscape(state);
  const place = neighbor?.name || "a Landscape just next door";
  const fingers = numberWord(PSYCHE_STARTING_HAND);
  const fullHands = numberWord(MAX_PSYCHE_IN_HAND);
  const song = pick([
    "It sings to you and begs you to answer, far away and yet at your fingertips.",
    "The song is a question, and your hands already know the reply.",
    "It calls from far away, close enough that the answer sits in your hands.",
  ], state, "song");
  const waste = pick([
    "They stand, waiting in darkness, begging to be conquered by your sight.",
    "Each one waits like a closed eye, begging for your sight.",
    "They lean in from the dark, patient, ready to be taken by your sight.",
  ], state, "waste");

  return [
    `You wake within a place you've never been, with a feeling like you've never left, ${friendsClause(state)}. Somewhere in this dream an Archetype is waiting. Capture it. Stand together on The Bed. Wake before the deck of nights runs out.`,
    "You clear the sand from your eyes, and you see you are dreaming, somehow connected to each other's minds and souls.",
    `In the distance you hear the call of ${call}, though you know not how you know its song. ${song}`,
    `Speaking of your hands, you have glowing fingertips of color, ${fingers} of them lit as you wake. You feel you could be unstoppable with both full hands of ${fullHands} fingers lit.`,
    `You hear the sounds of ${place} calling to you next door.`,
    `All around you are darkened endless Wastelands. You could flip the script and light them up with your hands. ${waste}`,
    "You look to your friends, and the stage is yours to play at.",
  ].join(" ");
}

const shownKeys = new Set();

/** Full-screen wake, after the board entrance. Tutorial keeps this story on its own slide. */
export function showOpeningHook(state) {
  if (!state || state.tutorialMode || state.openingHookSeen) return;
  const key = state.gameId || state.seed || "game";
  if (shownKeys.has(key)) return;
  shownKeys.add(key);
  state.openingHookSeen = true;

  const existing = document.getElementById("opening-hook");
  existing?.remove();

  const root = document.createElement("div");
  root.id = "opening-hook";
  root.className = "opening-hook";
  root.style.zIndex = "11200";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "opening-hook-title");

  const card = document.createElement("div");
  card.className = "opening-hook-card";

  const title = document.createElement("h2");
  title.id = "opening-hook-title";
  title.textContent = "You are dreaming";

  const body = document.createElement("p");
  body.id = "opening-hook-body";
  body.className = "opening-hook-body";
  const story = openingHookText(state).trim();
  body.textContent = story || "You wake dreaming. An Archetype is calling, and a Landscape beside The Bed is waiting.";

  const actions = document.createElement("div");
  actions.className = "opening-hook-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn primary opening-hook-dismiss";
  button.textContent = "The stage is yours";

  let gone = false;
  const dismiss = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (gone) return;
    gone = true;
    root.remove();
  };
  root.addEventListener("click", dismiss);
  button.addEventListener("click", dismiss);
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " " || event.key === "Escape") dismiss(event);
  });

  actions.appendChild(button);
  card.append(title, body, actions);
  root.appendChild(card);
  document.body.appendChild(root);
  button.focus({ preventScroll: true });
}

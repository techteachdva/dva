/** Opening call to adventure. One template, slots filled from the live table.
 *  Phrase picks are hashed from the seed so a dream stays stable and another seed can differ.
 */

import { adjacentTiles } from "../core/hex.js";
import { PSYCHE_STARTING_HAND } from "../core/data.js";
import { MAX_PSYCHE_IN_HAND } from "../cards/psyche.js";

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

function dreamerNames(state) {
  return (state?.players || [])
    .filter((player) => player.alive !== false)
    .map((player) => player.dreamer?.name || player.name)
    .filter(Boolean);
}

function plain(text) {
  return { text, variable: false };
}

function variable(text, kind) {
  return { text, variable: true, kind };
}

function nameList(names) {
  if (!names.length) return [plain("friends under different faces")];
  if (names.length === 1) return [variable(names[0], "Dreamer")];
  if (names.length === 2) return [variable(names[0], "Dreamer"), plain(" and "), variable(names[1], "Dreamer")];
  const parts = [];
  names.forEach((name, index) => {
    if (index > 0) parts.push(plain(index === names.length - 1 ? ", and " : ", "));
    parts.push(variable(name, "Dreamer"));
  });
  return parts;
}

function sentenceLines(sentence) {
  return String(sentence || "")
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => [plain(line)]);
}

function openingDreamLines(state) {
  const omen = state?.openingOmen;
  if (!omen?.name) return [];
  if (omen.side === "boss") {
    return [
      [plain("Before anyone can speak, a boss Dream is already awake.")],
      [variable(omen.name, "Dream"), plain(" stands on The Bed.")],
    ];
  }
  const lines = [
    [plain("The Dream "), variable(omen.name, "Dream"), plain(" is already on the table.")],
    [plain("Read it. Bright if its condition is met. Otherwise Dim.")],
  ];
  return lines;
}

/** Credit lines. Variable spans are Dreamer names, the first Landscape, the Archetype, and the opening Dream. */
export function openingHookLines(state) {
  const names = dreamerNames(state);
  const call = archetypeCall(state?.activeArchetype?.name);
  const neighbor = openingNeighborLandscape(state);
  const place = neighbor?.name || "a Landscape just next door";
  const placeIsVariable = !!neighbor?.name;
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
  const company = names.length
    ? [plain("with "), ...nameList(names), plain(" beside you, friends under different faces.")]
    : [plain("surrounded by friends, though they go by different faces.")];

  return [
    [plain("You wake within a place you've never been,")],
    [plain("with a feeling like you've never left,")],
    company,
    [plain("Somewhere in this dream an Archetype is waiting.")],
    [plain("Capture it.")],
    [plain("Stand together on The Bed.")],
    [plain("Wake before the deck of nights runs out.")],
    [plain("You clear the sand from your eyes,")],
    [plain("and you see you are dreaming,")],
    [plain("somehow connected to each other's minds and souls.")],
    [plain("In the distance you hear the call of "), variable(call, "Archetype"), plain(",")],
    [plain("though you know not how you know its song.")],
    ...sentenceLines(song),
    [plain("Speaking of your hands,")],
    [plain("you have glowing fingertips of color,")],
    [plain(`${fingers} of them lit as you wake.`)],
    [plain("You feel you could be unstoppable")],
    [plain(`with both full hands of ${fullHands} fingers lit.`)],
    [
      plain("You hear the sounds of "),
      placeIsVariable ? variable(place, "Landscape") : plain(place),
      plain(" calling to you next door."),
    ],
    [plain("All around you are darkened endless Wastelands.")],
    [plain("You could flip the script and light them up with your hands.")],
    ...sentenceLines(waste),
    [plain("You look to your friends,")],
    ...openingDreamLines(state),
    [plain("and the stage is yours to play at.")],
  ];
}

function lineText(parts) {
  return parts.map((part) => part.text).join("");
}

/** The wake story. Starting fingertips are the opening Psyche deal (5). The longing is a full hand (10). */
export function openingHookText(state) {
  return openingHookLines(state).map(lineText).join(" ");
}

function fitOpeningReel(reel, crawl) {
  const styles = getComputedStyle(reel);
  const pad = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const max = Math.max(280, crawl.clientWidth - pad - 8);
  let size = Math.min(30, Math.max(18, crawl.clientWidth / 58));
  const widest = () => Math.max(0, ...[...reel.children].map((el) => el.scrollWidth));
  reel.style.fontSize = `${size}px`;
  let guard = 24;
  while (widest() > max && size > 15 && guard > 0) {
    size -= 1;
    guard -= 1;
    reel.style.fontSize = `${size}px`;
  }
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

  const crawl = document.createElement("div");
  crawl.className = "opening-hook-crawl";
  const reel = document.createElement("div");
  reel.className = "opening-hook-reel";
  reel.id = "opening-hook-body";
  const lines = openingHookLines(state);
  lines.forEach((parts) => {
    const line = document.createElement("p");
    line.className = "opening-hook-line";
    parts.forEach((part) => {
      if (!part.text) return;
      const node = document.createElement("span");
      node.className = part.variable ? "opening-hook-var" : "opening-hook-word";
      if (part.kind) {
        node.dataset.kind = part.kind;
        node.title = part.kind;
      }
      node.textContent = part.text;
      line.appendChild(node);
    });
    reel.appendChild(line);
  });
  const seconds = Math.max(19, Math.round((lines.length * 2.15) / 1.5));
  reel.style.animationDuration = `${seconds}s`;
  crawl.appendChild(reel);
  requestAnimationFrame(() => {
    fitOpeningReel(reel, crawl);
    const anim = reel.getAnimations()[0];
    if (!anim) return;
    crawl.addEventListener("wheel", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const duration = Number(anim.effect?.getComputedTiming?.().duration) || seconds * 1000;
      const delta = event.deltaY * 8;
      anim.currentTime = Math.min(duration, Math.max(0, (anim.currentTime || 0) + delta));
    }, { passive: false });
  });

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
  card.append(title, crawl, actions);
  root.appendChild(card);
  document.body.appendChild(root);
  button.focus({ preventScroll: true });
}

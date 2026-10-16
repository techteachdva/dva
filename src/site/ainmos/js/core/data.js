import { ladderForLength, bossDreamCard, DREAMS_PER_ANTE, BOSS_LADDER, miniBossPower } from "../encounters/boss-ladder.js";
import { random } from "./rng.js";
import { getEventResolution } from "../effects/event-resolutions.js";
import { getDreamResolution } from "../cards/dream-resolutions.js";

function resolutionCopy(resolution, fallback = "") {
  if (!resolution) return fallback;
  const lines = [];
  if (resolution.good?.hint) lines.push(`Bright: ${resolution.good.hint}.`);
  if (resolution.bad?.hint) lines.push(`Dim: ${resolution.bad.hint}.`);
  return lines.length ? lines.join(" ") : fallback;
}

export async function loadGameData() {
  const files = [
    "dreamers",
    "archetypes",
    "landscapes",
    "dreambeasts",
    "dreams",
    "psyche",
    "mindstream",
    "event-landscapes",
    "objects",
  ];
  const data = {};

  await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      data[name] = await res.json();
    })
  );

  data.mindstream = enrichMindstreamEvents(data.mindstream, data["event-landscapes"] || {});
  data.dreams = (data.dreams || []).map((dream) => ({
    ...dream,
    text: resolutionCopy(getDreamResolution(dream.id), dream.text || dream.effect || ""),
  }));
  return data;
}

function enrichMindstreamEvents(mindstream, catalog) {
  const out = { lucidity: [], elasticity: [], willpower: [] };
  MINDSTREAM_SUITS.forEach((suit) => {
    out[suit] = (mindstream[suit] || []).map((evt) => {
      const extra = catalog[evt.id] || {};
      const landscapes = extra.landscapes ?? evt.landscapes ?? [];
      const effectTop = extra.effectTop ?? evt.effectTop;
      const effectBottom = extra.effectBottom ?? evt.effectBottom;
      const text = resolutionCopy(getEventResolution(evt.id), evt.text || "");
      return { ...evt, landscapes, effectTop, effectBottom, text };
    });
  });
  return out;
}

/** Ainmos: a night is Cycles. Each Cycle is 2 Dreams, then a Boss Dream. */
export const LENGTHS = {
  // Ainmos: the goal is a count of Archetypes. Each Cycle offers one, with a Cycle to spare.
  daydream: { label: "Daydream", points: 3, soloPoints: 3, antes: 3, dreams: 3 },
  nap: { label: "Nap", points: 6, soloPoints: 6, antes: 7, dreams: 7 },
  deep: { label: "Deep Sleep", points: 12, soloPoints: 12, antes: 15, dreams: 15 },
};

/** ~33% boon / 66% hazard in weighted session draws. */
export const DREAM_BOON_IDS = new Set([
  "quiet",
  "recovery",
  "well-being",
  "heroism",
  "transformation",
  "travel",
  "wanderlust",
]);

export const MINDSTREAM_EVENT_BOON_IDS = new Set([
  "centering",
  "friendship",
  "flashing-lights",
  "i-know-this-place",
  "harmonic-resonance",
  "sacred-geometry",
  "clear-as-crystal",
  "into-the-next",
]);

const HAZARD_DRAW_RATIO = 0.66;

function pickWeightedUnique(items, count, isHazard) {
  if (!items.length || count <= 0) return [];
  const hazards = shuffle(items.filter((item) => isHazard(item)));
  const boons = shuffle(items.filter((item) => !isHazard(item)));
  const hazardTarget = Math.min(hazards.length, Math.round(count * HAZARD_DRAW_RATIO));
  let picked = [
    ...hazards.slice(0, hazardTarget),
    ...boons.slice(0, Math.min(boons.length, count - hazardTarget)),
  ];
  const pool = shuffle([...hazards, ...boons]);
  let i = 0;
  while (picked.length < count && pool.length) {
    picked.push(pool[i % pool.length]);
    i += 1;
  }
  return shuffle(picked.slice(0, count));
}

/** Deck insert indices (0-based) — bosses appear on Reveal rounds 3, 6, and 9. */
/** Deck index of each Cycle's Boss Dream (the 3rd, 6th, 9th… card). */
export const BOSS_DREAM_DECK_SLOTS = Array.from({ length: 10 }, (_, i) => i * 3 + 2);

export const PHASES = ["Reveal", "Explore", "Meet"];

export const SUIT_COLORS = {
  lucidity: "lucidity",
  elasticity: "elasticity",
  willpower: "willpower",
};

const MINDSTREAM_SUITS = ["lucidity", "elasticity", "willpower"];

/** Canonical Mindstream deck: 56 cards per suit. Objects live in their own suited decks. */
export const MINDSTREAM_COMPOSITION = {
  dreambeasts: 0,
  events: 35,
  powerToken: 8,
  drawDream: 0,
};

/** Events that call up a Dreambeast stay out of Ainmos Mindstream: beasts come on the Dream Deck timer. */
const SPAWNING_EVENT_TEXT = /\bspawn\b|draw 2 (dreambeasts|encounters)/i;
export const MINDSTREAM_DECK_SIZE = Object.values(MINDSTREAM_COMPOSITION).reduce((sum, n) => sum + n, 0);

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ainmos 0.23 Psyche deck: 72 suited + 6 Wild = 78. Seven 1s, six 2s, five 3s,
 * four 4s, two 5s per suit. Twelve start the night in the Subconscious, so the
 * Waking Mind opens about where the old 66-card deck did.
 */
export const PSYCHE_DISTRIBUTION = { 1: 7, 2: 6, 3: 5, 4: 4, 5: 2 };
/** Psyche Repressed into the Subconscious before the first Dream. */
export const SUBCONSCIOUS_START = 12;
export const PSYCHE_WILD_COUNT = 6;
export const PSYCHE_POWER_TOKEN_COUNT = 0;
export const PSYCHE_POWER_GRANT = 1;
/** Ainmos 0.25: six to start (and to wake on The Bed with), since each round draws only 2. */
export const PSYCHE_STARTING_HAND = 6;
/** Ainmos: Psyche Draw as every Dream begins. */
/** Ainmos 0.25: every round opens with 2 Psyche drawn. */
export const DREAM_DRAW = 2;
export const PSYCHE_HAND_LIMIT = 10;
export const PSYCHE_DECK_SIZE =
  (Object.values(PSYCHE_DISTRIBUTION).reduce((sum, n) => sum + n, 0) * 3)
  + PSYCHE_WILD_COUNT
  + PSYCHE_POWER_TOKEN_COUNT;

/** Eight low Psyche cards for each Dreamer after the second, so a full table does not drink a two-Dreamer deck. */
export const EXTRA_PSYCHE_PER_DREAMER = 8;

export function extraPsycheCount(playerCount) {
  return Math.max(0, (playerCount || 0) - 2) * EXTRA_PSYCHE_PER_DREAMER;
}

export function makeExtraPsycheCards(playerCount) {
  const suits = ["lucidity", "elasticity", "willpower"];
  const cards = [];
  const total = extraPsycheCount(playerCount);
  for (let i = 0; i < total; i += 1) {
    const suit = suits[i % suits.length];
    const value = i % 2 === 0 ? 1 : 2;
    const label = suit.charAt(0).toUpperCase() + suit.slice(1);
    cards.push({
      id: `${suit}-${value}`,
      type: "psyche",
      suit,
      value,
      name: `${label} ${value}`,
      instanceId: uid("psyche"),
    });
  }
  return cards;
}

export function goalPointsForTable(lengthKey, playerCount) {
  const length = LENGTHS[lengthKey] || LENGTHS.daydream;
  if (playerCount === 1 && length.soloPoints) return length.soloPoints;
  return length.points;
}

export function buildPsycheDeck(psycheConfig = {}) {
  const suits = psycheConfig.suits || ["lucidity", "elasticity", "willpower"];
  const distribution = psycheConfig.distribution || PSYCHE_DISTRIBUTION;
  const wildCount = psycheConfig.wildCount ?? PSYCHE_WILD_COUNT;
  const powerCount = psycheConfig.powerTokenCount ?? PSYCHE_POWER_TOKEN_COUNT;

  const deck = [];
  suits.forEach((suit) => {
    Object.entries(distribution).forEach(([value, copies]) => {
      const num = parseInt(value, 10);
      for (let copy = 0; copy < copies; copy += 1) {
        deck.push({
          id: `${suit}-${num}`,
          type: "psyche",
          suit,
          value: num,
          name: `${suit.charAt(0).toUpperCase()}${suit.slice(1)} ${num}`,
          instanceId: uid("psyche"),
        });
      }
    });
  });

  for (let i = 0; i < wildCount; i += 1) {
    deck.push({
      id: `wild-${i + 1}`,
      type: "psyche",
      wild: true,
      suit: null,
      value: 5,
      name: "Wild Psyche",
      text: "Counts as 5 of any suit.",
      instanceId: uid("psyche"),
    });
  }

  for (let i = 0; i < powerCount; i += 1) {
    deck.push({
      id: `psyche-power-${i + 1}`,
      type: "psyche-power",
      suit: null,
      value: 0,
      powerTokens: PSYCHE_POWER_GRANT,
      name: "Power Surge",
      text: "Play anytime, any phase: gain 1 Power Token, then discard.",
      instanceId: uid("psyche"),
    });
  }

  return shuffle(deck);
}

function mindstreamDreambeastCard(beast, suit) {
  return {
    id: `ms-${suit}-${beast.id}`,
    refId: beast.id,
    name: beast.name,
    type: "dreambeast",
    beastKind: beast.beastKind,
    suit,
    mindstreamSuit: suit,
    image: beast.image,
    flavor: beast.flavor,
    accept: beast.accept,
    reject: beast.reject ?? beast.repress,
    repress: beast.repress ?? beast.reject,
    rejectSuit: beast.rejectSuit,
    rejectReward: beast.rejectReward,
    rejectEffect: beast.rejectEffect,
    fail: beast.fail,
    effect: beast.effect,
    boss: beast.boss,
    text: beast.flavor,
    instanceId: uid("mind"),
  };
}

function mindstreamEventCard(event, suit) {
  return {
    ...event,
    type: "event",
    suit,
    mindstreamSuit: suit,
    instanceId: uid("mind"),
  };
}

function powerTokenCard(suit, index) {
  return {
    id: `power-token-${suit}-${index}`,
    name: "Power Token",
    type: "power-token",
    suit,
    mindstreamSuit: suit,
    powerTokens: 1,
    text: "Return 1 Psyche from the Subconscious.",
    image: `images/cards/mindstream/${suit}/power-token.webp`,
    instanceId: uid("mind"),
  };
}

function drawDreamCard(suit, index) {
  return {
    id: `draw-dream-${suit}-${index}`,
    name: "Draw 1 Additional Dream Card",
    type: "draw-dream",
    suit,
    mindstreamSuit: suit,
    text: "Draw and resolve an additional Dream Card as if it were the start of the round.",
    image: `images/cards/mindstream/${suit}/draw-dream.webp`,
    instanceId: uid("mind"),
  };
}

function pickPool(items, count) {
  if (!items.length || count <= 0) return [];
  const pool = [];
  for (let i = 0; i < count; i += 1) {
    pool.push(items[i % items.length]);
  }
  return pool;
}

function dreambeastsForSuit(dreambeasts, suit) {
  const suited = dreambeasts.filter((b) => !b.boss && b.suit === suit);
  const perKind = Math.floor(MINDSTREAM_COMPOSITION.dreambeasts / 2);
  const fantasy = suited.filter((b) => b.beastKind === "fantasy");
  const nightmare = suited.filter((b) => b.beastKind === "nightmare");
  const pool = [
    ...pickPool(fantasy.length ? fantasy : suited, perKind),
    ...pickPool(nightmare.length ? nightmare : suited, perKind),
  ];
  if (pool.length >= MINDSTREAM_COMPOSITION.dreambeasts) {
    return pool.slice(0, MINDSTREAM_COMPOSITION.dreambeasts);
  }
  const fallback = dreambeasts.filter((b) => !b.boss);
  return pickPool([...pool, ...fallback.filter((b) => !pool.includes(b))], MINDSTREAM_COMPOSITION.dreambeasts);
}

/**
 * Build 56-card Mindstream decks: 10 Dreambeasts, 35 Events,
 * 8 Power Token cards, 3 Draw Additional Dream cards per suit.
 */
export function buildMindstreamDecks(mindstreamData, dreambeasts = []) {
  const decks = { lucidity: [], elasticity: [], willpower: [] };

  MINDSTREAM_SUITS.forEach((suit) => {
    const deck = [];
    const events = mindstreamData[suit] || [];

    dreambeastsForSuit(dreambeasts, suit).forEach((beast) => {
      deck.push(mindstreamDreambeastCard(beast, suit));
    });

    const calmEvents = events.filter((evt) => !SPAWNING_EVENT_TEXT.test(evt.text || ""));
    pickWeightedUnique(
      calmEvents,
      Math.min(MINDSTREAM_COMPOSITION.events, calmEvents.length),
      (evt) => !MINDSTREAM_EVENT_BOON_IDS.has(evt.id),
    ).forEach((evt) => {
      deck.push(mindstreamEventCard(evt, suit));
    });

    for (let i = 1; i <= MINDSTREAM_COMPOSITION.powerToken; i += 1) {
      deck.push(powerTokenCard(suit, i));
    }

    for (let i = 1; i <= MINDSTREAM_COMPOSITION.drawDream; i += 1) {
      deck.push(drawDreamCard(suit, i));
    }

    decks[suit] = shuffle(deck);
  });

  return decks;
}

/** One copy of every Object of each suit. Accepting a Dreambeast draws from its suit. */
/** The Chess set calls up Dreambeasts; in Ainmos they only arrive on the Dream Deck timer. */
const SPAWNING_OBJECT_IDS = new Set(["ivory-pawn", "ebony-pawn", "marble-grid"]);

export function buildObjectDecks(objects = []) {
  const decks = { lucidity: [], elasticity: [], willpower: [] };
  MINDSTREAM_SUITS.forEach((suit) => {
    decks[suit] = shuffle(
      objects.filter((obj) => obj.suit === suit && !SPAWNING_OBJECT_IDS.has(obj.id)).map((obj) => ({
        ...obj,
        type: "object",
        suit,
        mindstreamSuit: suit,
        instanceId: uid("obj"),
      })),
    );
  });
  return decks;
}

export function buildObjectDeck(objects, copies = 1) {
  const deck = [];
  objects.forEach((card) => {
    for (let i = 0; i < copies; i += 1) {
      deck.push({ ...card, instanceId: uid("obj") });
    }
  });
  return shuffle(deck);
}

/** Expand regular dreams (honoring `copies`, e.g. Quiet ×5) into a 30-card pool. */
export function expandDreamPool(dreams) {
  const pool = [];
  dreams.filter((d) => d.type === "dream").forEach((dream) => {
    const copies = dream.copies || 1;
    for (let i = 0; i < copies; i += 1) {
      pool.push({ ...dream, instanceId: uid("dream") });
    }
  });
  return pool;
}

/**
 * Build session Dream deck from the full 30-card regular pool plus 10 Final Recurrence cards.
 * `sessionCount` is how many regular dreams to include (14 / 17 / 21 by game length).
 */
export function buildDreamDeck(dreams, sessionCount) {
  const expanded = expandDreamPool(dreams);
  const uniqueDreams = [];
  const seen = new Set();
  expanded.forEach((card) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    uniqueDreams.push(card);
  });
  const pickedTemplates = pickWeightedUnique(
    uniqueDreams,
    Math.min(sessionCount, uniqueDreams.length),
    (d) => !DREAM_BOON_IDS.has(d.id),
  );
  // Ainmos has no Final Recurrence: the last Boss Dream ends the night.
  return pickedTemplates.map((d) => ({ ...d, instanceId: uid("dream") }));
}

const LADDER_IDS = new Set(BOSS_LADDER.map((entry) => entry.id));

/** Every Dreambeast that is not a rung of the Boss ladder: Mini-Bosses and the Nightmare pool. */
export function ordinaryDreambeasts(dreambeasts = []) {
  return dreambeasts.filter((b) => !b.boss && !LADDER_IDS.has(b.id));
}

/** A Mini-Boss: an ordinary Dreambeast, its Power set by the Cycle it guards. */
export function miniBossCard(beast, ante) {
  const power = miniBossPower(ante);
  return {
    ...beast,
    type: "dreambeast",
    miniBoss: true,
    ante,
    accept: power,
    reject: power,
    repress: power,
    instanceId: uid("mini"),
  };
}

/** The Archetype Dream: the third Dream of every Cycle. Drawing it offers 1 of 3 Archetypes. */
export function archetypeDreamCard(ante) {
  return {
    id: "archetype-dream",
    type: "archetype-dream",
    name: "An Archetype Stirs",
    text: "Choose 1 of 3 Archetypes. It appears on one of its two Landscapes.",
    image: "images/archetypes/archetype-sage.webp",
    ante,
    instanceId: uid("archdream"),
  };
}

/**
 * Lay the night out as Cycles of three Dreams:
 *   1. a Dream card (it hurts; survive it),
 *   2. the Cycle's Dreambeast, landing on a Landscape of its suit,
 *   3. an Archetype Dream: choose 1 of 3 Archetypes to appear.
 * The Dreambeasts climb the Boss ladder; a night longer than the ladder adds
 * Power 12 Nightmares. Returns the night and the Nightmare pool.
 */
export function insertBossDreams(deck, dreambeasts, lengthKey = "daydream") {
  const cycles = (LENGTHS[lengthKey] || LENGTHS.daydream).antes;
  const ladder = BOSS_LADDER;
  const minis = shuffle(ordinaryDreambeasts(dreambeasts));
  const night = [];
  for (let c = 0; c < cycles; c += 1) {
    const ante = c + 1;
    if (deck[c]) night.push(deck[c]);
    const entry = ladder[c];
    const beast = entry && dreambeasts.find((b) => b.id === entry.id);
    if (beast) night.push(bossDreamCard(beast, entry, uid));
    else if (minis.length) {
      const extra = { ...miniBossCard(minis.shift(), ante), accept: 12, reject: 12, repress: 12 };
      night.push({ ...extra, type: "boss-dream", boss: true, nightmare: true, ante, instanceId: uid("boss") });
    }
    night.push(archetypeDreamCard(ante));
  }
  night.nightmarePool = minis;
  return night;
}

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

export const LENGTHS = {
  daydream: { label: "Daydream", points: 8, soloPoints: 4, dreams: 11 },
  nap: { label: "Nap", points: 12, soloPoints: 6, dreams: 14 },
  deep: { label: "Deep Sleep", points: 24, soloPoints: 12, dreams: 18 },
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
export const BOSS_DREAM_DECK_SLOTS = [2, 5, 8];

export const PHASES = ["Reveal", "Explore", "Meet"];

export const SUIT_COLORS = {
  lucidity: "lucidity",
  elasticity: "elasticity",
  willpower: "willpower",
};

const MINDSTREAM_SUITS = ["lucidity", "elasticity", "willpower"];

/** Canonical Mindstream deck: 72 cards per suit. */
export const MINDSTREAM_COMPOSITION = {
  dreambeasts: 10,
  objects: 16,
  events: 35,
  powerToken: 8,
  drawDream: 3,
};
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

/** Canonical Psyche deck: 60 suited + 6 Wild = 66. Six 1s, five 2s, four 3s, three 4s, two 5s per suit. */
export const PSYCHE_DISTRIBUTION = { 1: 6, 2: 5, 3: 4, 4: 3, 5: 2 };
export const PSYCHE_WILD_COUNT = 6;
export const PSYCHE_POWER_TOKEN_COUNT = 0;
export const PSYCHE_POWER_GRANT = 1;
export const PSYCHE_STARTING_HAND = 5;
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
    text: beast.effect || beast.flavor,
    instanceId: uid("mind"),
  };
}

function mindstreamObjectCard(obj, suit) {
  const cardSuit = obj.suit || suit;
  return {
    id: `ms-${suit}-${obj.id}`,
    refId: obj.id,
    name: obj.name,
    type: "object",
    suit: cardSuit,
    mindstreamSuit: suit,
    subtype: obj.subtype,
    tags: obj.tags,
    image: obj.image,
    text: obj.text,
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
    text: "Take 1 Power Token, or Return one card from the Subconscious for each Dreamer.",
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

function objectsForSuit(objects, suit) {
  const assigned = objects.filter((obj) => obj.suit === suit);
  if (!assigned.length) {
    throw new Error(`No objects assigned to Mindstream suit: ${suit}`);
  }
  return pickPool(assigned, MINDSTREAM_COMPOSITION.objects);
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
 * Build 72-card Mindstream decks: 10 Dreambeasts, 16 Objects, 35 Events,
 * 8 Power Token cards, 3 Draw Additional Dream cards per suit.
 */
export function buildMindstreamDecks(mindstreamData, dreambeasts = [], objects = []) {
  const decks = { lucidity: [], elasticity: [], willpower: [] };

  MINDSTREAM_SUITS.forEach((suit) => {
    const deck = [];
    const events = mindstreamData[suit] || [];

    dreambeastsForSuit(dreambeasts, suit).forEach((beast) => {
      deck.push(mindstreamDreambeastCard(beast, suit));
    });

    objectsForSuit(objects, suit).forEach((obj) => {
      deck.push(mindstreamObjectCard(obj, suit));
    });

    pickWeightedUnique(
      events,
      MINDSTREAM_COMPOSITION.events,
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
  const picked = pickedTemplates.map((d) => ({ ...d, instanceId: uid("dream") }));

  const finals = dreams.filter((d) => d.type === "final");
  const neverWake = finals.find((d) => d.id === "you-never-wake");
  const startCard = finals.find((d) => d.id === "final-recurrence");
  const effectFinals = shuffle(
    finals.filter((d) => d.id !== "you-never-wake" && d.id !== "final-recurrence"),
  ).map((d) => ({ ...d, instanceId: uid("dream") }));

  return [
    ...picked,
    ...(startCard ? [{ ...startCard, instanceId: uid("dream") }] : []),
    ...effectFinals,
    ...(neverWake ? [{ ...neverWake, instanceId: uid("dream") }] : []),
  ];
}

export function insertBossDreams(deck, dreambeasts) {
  const bosses = ["cerberus", "double", "leviathan"]
    .map((id) => dreambeasts.find((b) => b.id === id))
    .filter(Boolean)
    .map((b) => ({ ...b, type: "boss-dream", instanceId: uid("boss"), awake: b.id === "leviathan" ? false : undefined }));

  const copy = [...deck];
  bosses.forEach((boss, index) => {
    const slots = BOSS_DREAM_DECK_SLOTS;
    if (slots[index] <= copy.length) copy.splice(slots[index], 0, boss);
  });
  return copy;
}

export async function loadGameData() {
  const files = [
    "dreamers",
    "archetypes",
    "landscapes",
    "dreambeasts",
    "dreams",
    "psyche",
    "mindstream",
    "objects",
    "card-manifest",
  ];
  const data = {};

  await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      data[name] = await res.json();
    })
  );

  return data;
}

export const LENGTHS = {
  daydream: { label: "Daydream", points: 12, dreams: 16 },
  nap: { label: "Nap", points: 18, dreams: 20 },
  deep: { label: "Deep Sleep", points: 24, dreams: 24 },
};

export const PHASES = ["Reveal", "Explore", "Meet"];

export const SUIT_COLORS = {
  lucidity: "lucidity",
  elasticity: "elasticity",
  willpower: "willpower",
};

const MINDSTREAM_SUITS = ["lucidity", "elasticity", "willpower"];

/** Canonical Mindstream deck: 70 cards per suit. */
export const MINDSTREAM_COMPOSITION = {
  dreambeasts: 10,
  objects: 16,
  events: 35,
  powerToken: 6,
  drawDream: 3,
};

export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Canonical Psyche deck: 45 suited (5×1, 4×2, 3×3, 2×4, 1×5 per suit) + 6 Wild = 51. */
export const PSYCHE_DISTRIBUTION = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
export const PSYCHE_WILD_COUNT = 6;
export const PSYCHE_STARTING_HAND = 5;
export const PSYCHE_HAND_LIMIT = 10;

export function buildPsycheDeck(psycheConfig = {}) {
  const suits = psycheConfig.suits || ["lucidity", "elasticity", "willpower"];
  const distribution = psycheConfig.distribution || PSYCHE_DISTRIBUTION;
  const wildCount = psycheConfig.wildCount ?? PSYCHE_WILD_COUNT;

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
    suit,
    mindstreamSuit: suit,
    image: beast.image,
    flavor: beast.flavor,
    accept: beast.accept,
    repress: beast.repress,
    fail: beast.fail,
    effect: beast.effect,
    text: beast.effect || beast.flavor,
    instanceId: uid("mind"),
  };
}

function mindstreamObjectCard(obj, suit) {
  return {
    id: `ms-${suit}-${obj.id}`,
    refId: obj.id,
    name: obj.name,
    type: "object",
    suit,
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
    powerTokens: 2,
    text: "Take 2 Power Tokens.",
    image: `images/cards/mindstream/${suit}/power-token.png`,
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
    image: `images/cards/mindstream/${suit}/draw-dream.png`,
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
  const suitIndex = MINDSTREAM_SUITS.indexOf(suit);
  const assigned = objects.filter((_, i) => i % MINDSTREAM_SUITS.length === suitIndex);
  return pickPool(assigned.length ? assigned : objects, MINDSTREAM_COMPOSITION.objects);
}

function dreambeastsForSuit(dreambeasts, suit) {
  const suited = dreambeasts.filter((b) => !b.boss && b.suit === suit);
  const fallback = dreambeasts.filter((b) => !b.boss);
  const pool = suited.length >= MINDSTREAM_COMPOSITION.dreambeasts
    ? suited
    : [...suited, ...fallback.filter((b) => !suited.includes(b))];
  return pickPool(pool, MINDSTREAM_COMPOSITION.dreambeasts);
}

/**
 * Build 70-card Mindstream decks: 10 Dreambeasts, 16 Objects, 35 Events,
 * 6 Power Token cards, 3 Draw Additional Dream cards per suit.
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

    pickPool(events, MINDSTREAM_COMPOSITION.events).forEach((evt) => {
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
 * `sessionCount` is how many regular dreams to include (16 / 20 / 24 by game length).
 */
export function buildDreamDeck(dreams, sessionCount) {
  const regularPool = shuffle(expandDreamPool(dreams));
  const picked = regularPool.slice(0, Math.min(sessionCount, regularPool.length));

  const finals = dreams.filter((d) => d.type === "final");
  const neverWake = finals.find((d) => d.id === "you-never-wake");
  const otherFinals = shuffle(finals.filter((d) => d.id !== "you-never-wake"));

  return [...picked, ...otherFinals, ...(neverWake ? [{ ...neverWake, instanceId: uid("dream") }] : [])];
}

export function insertBossDreams(deck, dreambeasts) {
  const bosses = ["cerberus", "double", "leviathan"]
    .map((id) => dreambeasts.find((b) => b.id === id))
    .filter(Boolean)
    .map((b) => ({ ...b, type: "boss-dream" }));

  const copy = [...deck];
  const slots = [2, 5, 8];
  bosses.forEach((boss, index) => {
    if (slots[index] <= copy.length) copy.splice(slots[index], 0, boss);
  });
  return copy;
}

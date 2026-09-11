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
    "card-manifest",
  ];
  const data = {};

  await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      data[name] = await res.json();
    })
  );

  data.mindstream = enrichMindstreamEvents(data.mindstream, data["event-landscapes"] || {});
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
      let text = evt.text;
      if (effectTop && effectBottom) {
        text = `${effectTop}\n\n— If any Affected Landscape is Revealed —\n${effectBottom}`;
      } else if (effectTop) {
        text = effectTop;
      }
      return { ...evt, landscapes, effectTop, effectBottom, text };
    });
  });
  return out;
}

export const LENGTHS = {
  daydream: { label: "Daydream", points: 12, dreams: 14 },
  nap: { label: "Nap", points: 18, dreams: 17 },
  deep: { label: "Deep Sleep", points: 24, dreams: 21 },
};

/** Deck insert indices (0-based) — bosses appear on Reveal rounds 3, 6, and 9. */
export const BOSS_DREAM_DECK_SLOTS = [2, 5, 8];

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

/** Canonical Psyche deck: 45 suited + 6 Wild + 6 Power = 57. */
export const PSYCHE_DISTRIBUTION = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
export const PSYCHE_WILD_COUNT = 6;
export const PSYCHE_POWER_TOKEN_COUNT = 6;
export const PSYCHE_POWER_GRANT = 1;
export const PSYCHE_STARTING_HAND = 5;
export const PSYCHE_HAND_LIMIT = 10;

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
      text: "Draw 1 Power Token. Then Discard.",
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
    powerTokens: 2,
    text: "Take 2 Power Tokens.",
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
 * `sessionCount` is how many regular dreams to include (14 / 17 / 21 by game length).
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
  bosses.forEach((boss, index) => {
    const slots = BOSS_DREAM_DECK_SLOTS;
    if (slots[index] <= copy.length) copy.splice(slots[index], 0, boss);
  });
  return copy;
}

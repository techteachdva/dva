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

export function buildPsycheDeck(psycheConfig) {
  const config = psycheConfig.copiesPerValue
    ? psycheConfig
    : { minValue: 1, maxValue: 6, copiesPerValue: 3, suits: ["lucidity", "elasticity", "willpower"] };

  const deck = [];
  config.suits.forEach((suit) => {
    for (let value = config.minValue; value <= config.maxValue; value += 1) {
      for (let copy = 0; copy < config.copiesPerValue; copy += 1) {
        deck.push({
          id: `${suit}-${value}`,
          type: "psyche",
          suit,
          value,
          name: `${suit.charAt(0).toUpperCase()}${suit.slice(1)} ${value}`,
          instanceId: uid("psyche"),
        });
      }
    }
  });
  return shuffle(deck);
}

export function buildMindstreamDecks(mindstreamData, copies = 2) {
  const decks = { lucidity: [], elasticity: [], willpower: [] };
  Object.entries(mindstreamData).forEach(([suit, cards]) => {
    cards.forEach((card) => {
      for (let i = 0; i < copies; i += 1) {
        decks[suit].push({ ...card, instanceId: uid("mind") });
      }
    });
  });
  Object.keys(decks).forEach((suit) => {
    decks[suit] = shuffle(decks[suit]);
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

export function buildDreamDeck(dreams, count) {
  const regular = dreams.filter((d) => d.type === "dream");
  const finals = dreams.filter((d) => d.type === "final" && d.id !== "you-never-wake");
  const picked = shuffle(regular).slice(0, count);
  return [...picked, ...shuffle(finals)];
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


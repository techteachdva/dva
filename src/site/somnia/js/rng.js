/**
 * Seeded randomness for Somnia.
 *
 * A seed string reproduces the exact same board layout and deck shuffles.
 * Game IDs double as seeds: a Game ID like "DESERT-7Q2M" names the first
 * Landscape revealed at the start of play, and its 4-character suffix is
 * the actual seed — so sharing a Game ID shares the whole dream.
 *
 * Special keyword seeds unlock rule-bending runs (see SPECIAL_SEEDS).
 */

/** xmur3 string hash → 32-bit seed. */
function hashSeedString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG — tiny, fast, deterministic. */
function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let activeRng = null;
let activeSeed = null;

/** Special keyword seeds → flag key stored on state.seedFlags. */
export const SPECIAL_SEEDS = {
  SOMNIA: "somnia",
  DMZEMO: "dmzemo",
  SPARK: "spark",
  FANTASY: "fantasy",
  NIGHTMARE: "nightmare",
  REM: "rem",
};

export const SPECIAL_SEED_DESCRIPTIONS = {
  somnia: "Lucid start — ring 1 begins Revealed and every Dreamer starts with 2 Power Tokens.",
  dmzemo: "Holographic dream — every card wears a shimmering holo foil.",
  spark: "Spark start — every Dreamer starts with 2 Power Tokens.",
  fantasy: "Fantasy stacked — Fantasy Dreambeasts rise to the top of the Mindstream decks.",
  nightmare: "Nightmare stacked — Nightmare Dreambeasts rise to the top of the Mindstream decks.",
  rem: "REM cycle — each round, the team gets 1 free Reveal, 1 free Explore, and 1 free Meet action before spending Psyche.",
};

const SEED_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Mint a fresh 4-character seed suffix (unguessable need not apply). */
export function mintSeedSuffix() {
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += SEED_ALPHABET[Math.floor(Math.random() * SEED_ALPHABET.length)];
  }
  return out;
}

/**
 * Normalize raw user input into a seed string.
 * - Case-insensitive; whitespace stripped.
 * - Exact special keywords (SOMNIA, REM, …) stay whole.
 * - A Game ID ending in "-SEED" (4–24 alphanumerics) seeds from that suffix,
 *   which is what makes a shared Game ID reproduce its dream.
 * - Custom seeds are stripped to alphanumerics (no hyphens), so they can
 *   always ride as the suffix of their own Game ID.
 */
export function normalizeSeedInput(raw) {
  const cleaned = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  if (SPECIAL_SEEDS[cleaned]) return cleaned;
  const gameIdMatch = cleaned.match(/-([A-Z0-9]{4,24})$/);
  if (gameIdMatch) return gameIdMatch[1];
  return cleaned.replace(/[^A-Z0-9]/g, "").slice(0, 24) || null;
}

export function specialSeedFlag(seed) {
  return SPECIAL_SEEDS[String(seed || "").toUpperCase()] || null;
}

export function specialSeedLabel(seed) {
  const flag = specialSeedFlag(seed);
  return flag ? SPECIAL_SEED_DESCRIPTIONS[flag] : null;
}

/** Build the display Game ID from the opening Landscape and the seed. */
export function buildGameId(landscapeName, seed) {
  const slug = String(landscapeName || "DREAM")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "DREAM";
  return `${slug}-${seed}`;
}

/** Point the gameplay RNG at a seed (null/"" restores Math.random). */
export function seedRandomness(seed) {
  activeSeed = seed || null;
  activeRng = seed ? mulberry32(hashSeedString(String(seed))) : null;
  return activeSeed;
}

export function clearRandomnessSeed() {
  activeSeed = null;
  activeRng = null;
}

export function currentSeed() {
  return activeSeed;
}

/** Drop-in Math.random replacement for gameplay shuffles and picks. */
export function random() {
  return activeRng ? activeRng() : Math.random();
}

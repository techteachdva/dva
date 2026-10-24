/**
 * On-demand Morphology Garden bank.
 *
 * Tier chunks are discrete JSON files. Callers import a tier only when a word
 * or morpheme in that tier is about to be shown. The full catalog is not
 * evaluated at module initialization.
 *
 *   words:   ./data/morphology/words/tier1.json | tier2.json | tier3.json
 *   catalog: ./data/morphology/catalog/tier1.json | tier2.json | tier3.json
 *   index:   ./data/morphology/manifest.json
 */

export const TIERS = ["tier1", "tier2", "tier3"];

/** Words whose tier JSON has been fetched. Mutated as tiers arrive. */
export const WORDS = [];

/** Catalog rows whose tier JSON has been fetched. Mutated as tiers arrive. */
export const MORPHEME_CATALOG = [];

const jsonCache = new Map();
/** @type {Map<string, Promise<void>>} */
const wordTierTasks = new Map();
/** @type {Map<string, Promise<void>>} */
const catalogTierTasks = new Map();

const WORD_LOADERS = {
  tier1: () => import("./data/morphology/words/tier1.json", { with: { type: "json" } }),
  tier2: () => import("./data/morphology/words/tier2.json", { with: { type: "json" } }),
  tier3: () => import("./data/morphology/words/tier3.json", { with: { type: "json" } }),
};

const CATALOG_LOADERS = {
  tier1: () => import("./data/morphology/catalog/tier1.json", { with: { type: "json" } }),
  tier2: () => import("./data/morphology/catalog/tier2.json", { with: { type: "json" } }),
  tier3: () => import("./data/morphology/catalog/tier3.json", { with: { type: "json" } }),
};

function assertTier(tier) {
  if (!TIERS.includes(tier)) throw new Error(`Unknown morphology tier: ${tier}`);
}

function unwrapModule(mod) {
  if (mod && typeof mod === "object" && "default" in mod) return mod.default;
  return mod;
}

async function readJsonUrl(url) {
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(url, "utf8"));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Morphology asset ${url.pathname} returned ${res.status}`);
  return res.json();
}

async function loadJson(cacheKey, loader, relativePath) {
  if (jsonCache.has(cacheKey)) return jsonCache.get(cacheKey);
  const pending = (async () => {
    try {
      return unwrapModule(await loader());
    } catch {
      return readJsonUrl(new URL(relativePath, import.meta.url));
    }
  })();
  jsonCache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (err) {
    jsonCache.delete(cacheKey);
    throw err;
  }
}

export function loadMorphologyManifest() {
  return loadJson(
    "manifest",
    () => import("./data/morphology/manifest.json", { with: { type: "json" } }),
    "./data/morphology/manifest.json"
  );
}

export function loadWordTier(tier) {
  assertTier(tier);
  return loadJson(`words:${tier}`, WORD_LOADERS[tier], `./data/morphology/words/${tier}.json`);
}

export function loadCatalogTier(tier) {
  assertTier(tier);
  return loadJson(`catalog:${tier}`, CATALOG_LOADERS[tier], `./data/morphology/catalog/${tier}.json`);
}

function ingest(target, rows) {
  const seen = new Set(target.map((row) => row.id || row.key));
  for (const row of rows || []) {
    const id = row.id || row.key;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const clone = typeof structuredClone === "function" ? structuredClone(row) : JSON.parse(JSON.stringify(row));
    target.push(clone);
  }
  target.sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
}

export function ensureWordTiers(tiers) {
  const tasks = [];
  for (const tier of tiers) {
    assertTier(tier);
    if (!wordTierTasks.has(tier)) {
      wordTierTasks.set(
        tier,
        loadWordTier(tier)
          .then((rows) => {
            ingest(WORDS, rows);
          })
          .catch((err) => {
            wordTierTasks.delete(tier);
            throw err;
          })
      );
    }
    tasks.push(wordTierTasks.get(tier));
  }
  return Promise.all(tasks);
}

export function ensureCatalogTiers(tiers) {
  const tasks = [];
  for (const tier of tiers) {
    assertTier(tier);
    if (!catalogTierTasks.has(tier)) {
      catalogTierTasks.set(
        tier,
        loadCatalogTier(tier)
          .then((rows) => {
            ingest(MORPHEME_CATALOG, rows);
          })
          .catch((err) => {
            catalogTierTasks.delete(tier);
            throw err;
          })
      );
    }
    tasks.push(catalogTierTasks.get(tier));
  }
  return Promise.all(tasks);
}

/**
 * Fetch only the word tiers (and the catalog tiers those words cite)
 * required by the given lemma ids.
 * @param {{ words: Array<{id:string,tier:string,keys?:string[]}>, morphemes: Array<{key:string,tier:string}> }} manifest
 * @param {string[]} ids
 */
export async function ensureWordsByIds(manifest, ids) {
  const want = new Set(ids.filter(Boolean));
  const wordTiers = new Set();
  const catalogTiers = new Set();
  const morphemeTier = new Map((manifest.morphemes || []).map((row) => [row.key, row.tier]));
  for (const meta of manifest.words || []) {
    if (!want.has(meta.id)) continue;
    if (TIERS.includes(meta.tier)) wordTiers.add(meta.tier);
    for (const key of meta.keys || []) {
      const tier = morphemeTier.get(key);
      if (TIERS.includes(tier)) catalogTiers.add(tier);
    }
  }
  await Promise.all([ensureWordTiers([...wordTiers]), ensureCatalogTiers([...catalogTiers])]);
}

export async function ensureAllTiers() {
  await Promise.all([ensureWordTiers(TIERS), ensureCatalogTiers(TIERS)]);
}

/** Node audits and other full-bank tools. Loads every tier. */
export async function loadMorphologyWordList() {
  await ensureWordTiers(TIERS);
  return WORDS;
}

export async function loadMorphemeCatalog() {
  await ensureCatalogTiers(TIERS);
  return MORPHEME_CATALOG;
}

/**
 * Morpheme chart intake.
 *
 * Chart rows are split by the earliest word tier that uses each morpheme:
 *   data/morphology/catalog/tier1.json
 *   data/morphology/catalog/tier2.json
 *   data/morphology/catalog/tier3.json
 *
 * The page loads a tier when a lesson needs it. `loadMorphemeCatalog()` is the
 * full-bank path used by Node audits.
 */
export {
  MORPHEME_CATALOG,
  loadCatalogTier,
  ensureCatalogTiers,
  loadMorphemeCatalog,
} from "./morphology-bank.js";

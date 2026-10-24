/**
 * Morphology word bank intake.
 *
 * Lemma trees are split by Beck tier and loaded on demand:
 *   data/morphology/words/tier1.json
 *   data/morphology/words/tier2.json
 *   data/morphology/words/tier3.json
 *
 * Edit those JSON files for lesson copy. The generator that first built the
 * outside-example trees lives in scripts/morphology-authoring/ and is not
 * imported by the page. Refresh the chunks with `npm run build:morphology`.
 */
export {
  WORDS,
  loadWordTier,
  ensureWordTiers,
  ensureWordsByIds,
  loadMorphologyWordList,
} from "./morphology-bank.js";

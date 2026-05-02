/**
 * Morpheme catalog for the bottom chart on /morphology/.
 *
 * This file is meant to be edited by hand:
 * - `origin`: broad source family (Greek / Latin / Anglo-Saxon / French / Mixed / Unknown)
 * - `meaning`: classroom-usable gloss
 * - `outsideExamples`: a few examples NOT in the word bank (helps you extend the lesson)
 * - `wiktionary`: the page title to link to (defaults to `morpheme` if omitted)
 * - `type` (optional): override the auto-derived type label shown in the chart's "Type" column
 *   ("Prefix", "Suffix", "Root", "Lexeme", or any custom string e.g. "Combining form").
 *   If omitted, the column is derived from the `key` prefix (`pfx:` → Prefix, `sfx:` → Suffix,
 *   `root:` → Root, `lex:` → Lexeme).
 *
 * `key` MUST match the `morphemeKey` used in word trees (e.g. "pfx:un-", "sfx:-ed", "root:port").
 */

/** @typedef {{ key: string, morpheme: string, origin: string, meaning: string, outsideExamples: string[], wiktionary?: string, type?: string }} MorphemeCatalogRow */

/** @type {MorphemeCatalogRow[]} */
export const MORPHEME_CATALOG = [
  // --- Suffixes ---
  { key: "sfx:-s", morpheme: "-s, -es", origin: "Anglo-Saxon (Germanic)", meaning: "plural nouns; 3rd-person singular verbs", outsideExamples: ["boxes", "dishes", "watches"], wiktionary: "-s" },
  { key: "sfx:-ed", morpheme: "-ed", origin: "Anglo-Saxon (Germanic)", meaning: "past tense / past participle (regular verbs)", outsideExamples: ["walked", "laughed", "wanted"], wiktionary: "-ed" },
  { key: "sfx:-ing", morpheme: "-ing", origin: "Anglo-Saxon (Germanic)", meaning: "ongoing action; activity noun; participle", outsideExamples: ["swimming", "reading", "boiling"], wiktionary: "-ing" },
  { key: "sfx:-ly", morpheme: "-ly", origin: "Anglo-Saxon (Germanic)", meaning: "forms many adverbs (in a ___ way)", outsideExamples: ["carefully", "slowly", "quietly"], wiktionary: "-ly" },
  { key: "sfx:-er", morpheme: "-er / -or", origin: "Mixed (Germanic + Latin/French)", meaning: "person/thing that does an action; also comparative on adjectives", outsideExamples: ["actor", "runner", "creator"], wiktionary: "-er" },
  { key: "sfx:-tion", morpheme: "-ion, -tion", origin: "Latin (via French)", meaning: "turns stems into nouns for act/process/result", outsideExamples: ["decision", "instruction", "reaction"], wiktionary: "-tion" },
  { key: "sfx:-al", morpheme: "-al", origin: "Latin (via French)", meaning: "relating to; like; connected to", outsideExamples: ["cultural", "personal", "regional"], wiktionary: "-al" },
  { key: "sfx:-y", morpheme: "-y", origin: "Anglo-Saxon (Germanic)", meaning: "adjective: full of / like / characterized by", outsideExamples: ["muddy", "rainy", "windy"], wiktionary: "-y" },
  { key: "sfx:-ness", morpheme: "-ness", origin: "Anglo-Saxon (Germanic)", meaning: "state/quality noun (being ___)", outsideExamples: ["kindness", "darkness", "readiness"], wiktionary: "-ness" },
  { key: "sfx:-ment", morpheme: "-ment", origin: "Latin (via French)", meaning: "noun: result/process/state of", outsideExamples: ["development", "agreement", "measurement"], wiktionary: "-ment" },
  { key: "sfx:-able", morpheme: "-able, -ible", origin: "Latin (via French)", meaning: "able to be ___ed; capable of", outsideExamples: ["flexible", "possible", "valuable"], wiktionary: "-able" },
  { key: "sfx:-ful", morpheme: "-ful", origin: "Anglo-Saxon (Germanic)", meaning: "full of; having", outsideExamples: ["hopeful", "helpful", "colorful"], wiktionary: "-ful" },
  { key: "sfx:-less", morpheme: "-less", origin: "Anglo-Saxon (Germanic)", meaning: "without", outsideExamples: ["careless", "endless", "tasteless"], wiktionary: "-less" },

  // --- Prefixes ---
  { key: "pfx:un-", morpheme: "un-", origin: "Anglo-Saxon (Germanic)", meaning: "not; reverse", outsideExamples: ["unfair", "unlock", "unclear"], wiktionary: "un-" },
  { key: "pfx:re-", morpheme: "re-", origin: "Latin", meaning: "again; back", outsideExamples: ["rewrite", "rebuild", "return"], wiktionary: "re-" },
  { key: "pfx:in-", morpheme: "in-, im-, il-, ir- (not)", origin: "Latin", meaning: "not; without (negation)", outsideExamples: ["impossible", "irregular", "illegal"], wiktionary: "in-" },
  { key: "pfx:dis-", morpheme: "dis-, dif-", origin: "Latin (via French)", meaning: "apart; not; reverse; undo", outsideExamples: ["disagree", "difficult", "different"], wiktionary: "dis-" },
  { key: "pfx:non-", morpheme: "non-", origin: "Latin", meaning: "not; the opposite of", outsideExamples: ["nonfiction", "nonstop", "nonprofit"], wiktionary: "non-" },
  { key: "pfx:in-toward", morpheme: "in-, im- (in/into)", origin: "Latin", meaning: "in; into; toward", outsideExamples: ["insert", "inject", "import"], wiktionary: "in-" },
  { key: "pfx:over-", morpheme: "over-", origin: "Anglo-Saxon (Germanic)", meaning: "over; too much; above", outsideExamples: ["overheat", "overreact", "overconfident"], wiktionary: "over-" },
  { key: "pfx:mis-", morpheme: "mis-", origin: "Anglo-Saxon (Germanic)", meaning: "wrongly; badly", outsideExamples: ["mislead", "misprint", "mistake"], wiktionary: "mis-" },
  { key: "pfx:sub-", morpheme: "sub-", origin: "Latin", meaning: "under; below", outsideExamples: ["submarine", "submerge", "subzero"], wiktionary: "sub-" },
  { key: "pfx:pre-", morpheme: "pre-", origin: "Latin", meaning: "before", outsideExamples: ["predict", "prepare", "prehistoric"], wiktionary: "pre-" },
  { key: "pfx:inter-", morpheme: "inter-", origin: "Latin", meaning: "between; among", outsideExamples: ["interact", "interrupt", "intersect"], wiktionary: "inter-" },
  { key: "pfx:fore-", morpheme: "fore-", origin: "Anglo-Saxon (Germanic)", meaning: "before; ahead", outsideExamples: ["foreshadow", "foreword", "forewarn"], wiktionary: "fore-" },
  { key: "pfx:de-", morpheme: "de-", origin: "Latin", meaning: "down; off; reverse; remove", outsideExamples: ["defrost", "deactivate", "deflate"], wiktionary: "de-" },
  { key: "pfx:trans-", morpheme: "trans-", origin: "Latin", meaning: "across; through", outsideExamples: ["translate", "transform", "transmit"], wiktionary: "trans-" },
  { key: "pfx:anti-", morpheme: "anti-", origin: "Greek", meaning: "against; opposite", outsideExamples: ["antibiotic", "antivirus", "antisocial"], wiktionary: "anti-" },
  { key: "pfx:mid-", morpheme: "mid-", origin: "Anglo-Saxon (Germanic)", meaning: "middle", outsideExamples: ["midterm", "midday", "midpoint"], wiktionary: "mid-" },
  { key: "pfx:con-", morpheme: "con-", origin: "Latin", meaning: "with; together", outsideExamples: ["combine", "connect", "converge"], wiktionary: "con-" },
  { key: "pfx:ad-", morpheme: "ad-", origin: "Latin", meaning: "to; toward", outsideExamples: ["adhere", "attract", "approach"], wiktionary: "ad-" },
  { key: "pfx:ex-", morpheme: "ex-, e-, ef-", origin: "Latin", meaning: "out; away; former", outsideExamples: ["export", "eject", "exclude"], wiktionary: "ex-" },

  // --- Roots / stems ---
  { key: "root:form", morpheme: "form", origin: "Latin", meaning: "shape; form", outsideExamples: ["transform", "uniform", "reform"] },
  { key: "root:port", morpheme: "port", origin: "Latin", meaning: "carry", outsideExamples: ["portable", "import", "transport"] },
  { key: "root:rupt", morpheme: "rupt", origin: "Latin", meaning: "break", outsideExamples: ["erupt", "corrupt", "disrupt"] },
  { key: "root:tract", morpheme: "tract", origin: "Latin", meaning: "pull; draw", outsideExamples: ["traction", "distract", "contract"] },
  { key: "root:scrib", morpheme: "scrib", origin: "Latin", meaning: "write", outsideExamples: ["script", "scribble", "manuscript"] },
  { key: "root:spect", morpheme: "spect / spec / spic", origin: "Latin", meaning: "look; see", outsideExamples: ["spectator", "perspective", "suspicious"] },
  { key: "root:struct", morpheme: "struct / stru", origin: "Latin", meaning: "build", outsideExamples: ["structure", "instruct", "destroy"] },
  { key: "root:dict", morpheme: "dict / dic", origin: "Latin", meaning: "say; speak", outsideExamples: ["predict", "dictionary", "dictate"] },
  { key: "root:fer", morpheme: "fer", origin: "Latin", meaning: "carry; bring", outsideExamples: ["transfer", "offer", "prefer"] },
  { key: "root:mit", morpheme: "mit / miss", origin: "Latin", meaning: "send", outsideExamples: ["submit", "mission", "emit"] },
  { key: "root:duct", morpheme: "duct / duc / duce", origin: "Latin", meaning: "lead", outsideExamples: ["produce", "reduce", "aqueduct"] },
  { key: "root:fect", morpheme: "fact / fac / fect / fic", origin: "Latin", meaning: "make; do", outsideExamples: ["factory", "manufacture", "fiction"] },
  { key: "root:tain", morpheme: "ten / tain / tin", origin: "Latin", meaning: "hold; keep", outsideExamples: ["contain", "sustain", "detain"] },
  { key: "root:vis", morpheme: "vis / vid", origin: "Latin", meaning: "see", outsideExamples: ["video", "evidence", "revise"] },
  { key: "root:ceive", morpheme: "cap / ceive / cept / cip", origin: "Latin", meaning: "take; catch", outsideExamples: ["accept", "intercept", "deceive"] },
  { key: "root:sist", morpheme: "sta / sist / stat / stit", origin: "Latin", meaning: "stand", outsideExamples: ["station", "constant", "substitute"] },
  { key: "root:posit", morpheme: "pos / pon", origin: "Latin", meaning: "place; put", outsideExamples: ["compose", "deposit", "opposite"] },
  { key: "root:ply", morpheme: "plic / ply", origin: "Latin", meaning: "fold; bend", outsideExamples: ["complicated", "multiply", "replica"] },

  // --- Greek combining forms ---
  { key: "root:graph", morpheme: "graph, gram", origin: "Greek", meaning: "write; draw; record", outsideExamples: ["photograph", "paragraph", "diagram"], wiktionary: "-graph" },
  { key: "sfx:-logy", morpheme: "-logy", origin: "Greek", meaning: "study of; science of", outsideExamples: ["geology", "psychology", "zoology"], wiktionary: "-logy" },
];


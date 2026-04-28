/**
 * Mini-lessons for morphology garden (isolated word view). Structured teaching notes keyed by word id.
 * @typedef {{ segment: string, origin?: string, note?: string }} EtymoPart
 */

/** Typical affix/register hints for keys that recur across lessons (not exhaustive linguistics certification). */
export const AFFIX_ORIGIN_HINT = {
  "pfx:in-": "Latin <em>in-</em> ‘not / without’ (also spelled <em>il-, im-, ir-</em> before certain letters).",
  "pfx:re-": "Latin <em>re-</em> ‘again; back’. Productive across Latinate STEM vocabulary.",
  "pfx:un-": "Germanic <em>un-</em> ‘not’ — attaches to Germanic stems (compare Latin <em>in-</em> below).",
  "pfx:de-": "Latin <em>de-</em> ‘away; reversal; reversal of state’ in many scholarly words.",
  "pfx:pre-": "Latin <em>præ-</em> (English <em>pre-</em>) ‘before’.",
  "pfx:trans-": "Latin <em>trans-</em> ‘across; through’.",
  "sfx:-tion": "French / Latin feminine abstract suffix <strong>-tion</strong> naming an act, result, or state (cf. textbook Table 4.2). Usually stacks <em>outside</em> derivation that built a stem.",
  "sfx:-ation": "Abstract noun suffix <strong>-ation</strong> (compare <em>-tion</em>) — very common in academic nouns.",
  "sfx:-ment": "French <em>-ment</em> abstract nominalizer (Table 4.2).",
  "sfx:-al": "Relational / adjectival <strong>-al</strong> ‘pertaining to’ (Table 4.2).",
  "sfx:-ous": "Adjectival <strong>-ous</strong> from Latin <em>-ōsus</em> (full of; having the quality of).",
  "sfx:-able": "Capacity / possibility <strong>-able</strong> ‘able to be’ (Table 4.2).",
  "sfx:-ize": "Verb-forming <strong>-ize</strong> (also <em>-ise</em>) — ‘make; treat as; convert to’.",
  "sfx:-ity": "Abstract noun <strong>-ity</strong> from adjective stems (compare <em>odd → oddity</em>).",
  "sfx:-er": "Agent / instrument <strong>-er</strong> (who/what does X) — highly productive in English.",
  "sfx:-ful": "Adjectival <strong>-ful</strong> ‘full of; characterized by’.",
  "sfx:-less": "Privative <strong>-less</strong> ‘without’ — Germanic layer.",
};

/**
 * @type {Record<string, { summary: string, etymology?: EtymoPart[], formation?: string, tense?: string, embedded?: { text: string, note: string }[], spelling?: { from: string, to: string, note: string }[] }>}
 */
export const MORPH_DEEP_NOTES = {
  presentation: {
    summary:
      "Academic noun built on <em>present</em> + abstract <strong>-ation</strong>. The stem is already abstract (not a free modern word in the same sense), but the morpheme stack is typical of Latinate word-formation in school registers.",
    etymology: [
      { segment: "pre-", origin: "Latin <em>præ-</em> ‘before’." },
      { segment: "sent", origin: "Bound stem ‘feel / place’ (cf. <em>consent, sentence</em>)." },
      { segment: "-ation", origin: "Abstract nominalizer (see Table 4.2)." },
    ],
    formation:
      "Derivational chain: affix + stem → stem is further embedded before the outer suffix. This is <strong>layering</strong>, not inflection for tense.",
    tense: "No inflectional tense here — the whole word is a noun naming an event or product of presenting.",
  },
  hallway: {
    summary:
      "A clear <strong>compound</strong>: two free morphemes (§4.6). The right-hand element often sets the basic word class (path-like noun).",
    etymology: [
      { segment: "hall", origin: "Old English <em>heall</em> ‘large covered space’." },
      { segment: "way", origin: "Old English <em>weg</em> ‘path’ — still a free word." },
    ],
    embedded: [
      { text: "hall", note: "Also occurs as a whole word." },
      { text: "way", note: "Same — students can ‘hear’ both parts." },
    ],
    tense: "Nominal — no verbal tense; plural would be inflectional <em>-s</em> on the whole compound if needed.",
  },
  final: {
    summary:
      "Classic pattern: <strong>bound root</strong> + Latinate adjectival <strong>-al</strong>. The root is not a stand-alone modern English word.",
    etymology: [
      { segment: "fin-", origin: "Latin <em>finis</em> family — ‘end, limit’ (cf. <em>finite, finish</em>)." },
      { segment: "-al", origin: "Relational suffix (Table 4.2)." },
    ],
    tense: "Adjective — compare adverb <em>finally</em> built with another layer (not on this tree).",
  },
  sourdough: {
    summary: "Compound of two content morphemes (§4.6). Stress and spelling are one word; meaning is compositional.",
    etymology: [
      { segment: "sour", origin: "Germanic adjective stem." },
      { segment: "dough", origin: "Old English <em>dāg</em> — still recognizable." },
    ],
    embedded: [
      { text: "sour", note: "Free adjective." },
      { text: "dough", note: "Free noun." },
    ],
  },
  before: {
    summary:
      "Often taught as a unit in reading, but analyzable as <strong>be-</strong> + <strong>fore</strong> for morphology class. Closed-class function word historically; analysis helps pattern-spotting with <em>fore-</em> in other words.",
    etymology: [
      { segment: "be-", origin: "Prefix-like element in several fossilized forms." },
      { segment: "fore", origin: "‘Front; ahead’ — compare <em>forethought, foreshadow</em>." },
    ],
  },
  rainbow: {
    summary: "Transparent compound: content + content; useful for stress / compound vs phrase contrast in connected speech.",
    etymology: [
      { segment: "rain", origin: "Germanic noun." },
      { segment: "bow", origin: "‘Curve, arc’ — polyseme with ‘weapon’ sense." },
    ],
    embedded: [
      { text: "rain", note: "Free morpheme." },
      { text: "bow", note: "Homograph with other senses — spelling unifies surface form." },
    ],
  },
  inhospitable: {
    summary:
      "Layers: negative prefix + stem built on <em>hospital</em> + adjectival <strong>-able</strong>. Good for discussing <strong>allomorphs</strong> of negation (il-, im-, in-, ir-).",
    etymology: [
      { segment: "in-", origin: "Latin negative ‘not’ (Table 4.2)." },
      { segment: "-able", origin: "‘Capable of being’ — derivational (Table 4.2)." },
    ],
    tense: "Adjective — not inflected for tense; compare related word family <em>hospital, hospitality, hospitalize</em>.",
  },
  demarcation: {
    summary:
      "Nominalization of a verb-like stem with <strong>-ation</strong>. The bound root <em>marc-</em> relates to Latin <em>margo</em> ‘border’ — English <em>mark</em> is cognate but not a simple cut here.",
    etymology: [
      { segment: "de-", origin: "Latin ‘away; reversal’ in this stem’s history." },
      { segment: "marc-", origin: "Stem ‘boundary’ (learners know <em>mark</em> — teach cognate idea, not identity)." },
      { segment: "-ation", origin: "Abstract noun (Table 4.2)." },
    ],
    spelling: [
      {
        from: "mark",
        to: "marc",
        note: "Latinate stem spelling in <em>demarcation</em> vs everyday Germanic <em>mark</em> — same historical family, different layer.",
      },
    ],
  },
  dehumanization: {
    summary:
      "Heavy Latinate stack: <em>de-</em> + stem + multiple derivational suffixes — useful for spotting how academic nouns lengthen without adding inflection.",
    etymology: [
      { segment: "de-", origin: "Latin prefix ‘reverse; remove’ in many abstracts." },
      { segment: "-ize", origin: "Verbalizer (process not shown as its own subtree here)." },
      { segment: "-ation", origin: "Noun-of-process / result suffix." },
    ],
    tense: "Noun — outer edges are derivational layers; tense would attach outside if this were verbalized differently.",
  },
  resistance: {
    summary:
      "Noun from verb stem + <strong>-ance</strong> (compare <em>-ence</em>). The root <em>sist</em> ‘stand’ recurs across Latinate vocab.",
    etymology: [
      { segment: "re-", origin: "Again / back prefix (Latinate)." },
      { segment: "sist", origin: "Bound root ‘stand’ (persist, consist)." },
      { segment: "-ance", origin: "Abstract nominalizer pairing with stems in <em>-ant/-ence</em> patterns." },
    ],
  },
  revolution: {
    summary:
      "Latinate noun: verb stem rolled into noun with <strong>-tion</strong>. Pair with texts on nominalization for history/social studies.",
    etymology: [
      { segment: "re-", origin: "‘Again/back’ Latinate prefix." },
      { segment: "volu", origin: "Root ‘roll, turn’ (volume, evolve)." },
      { segment: "-tion", origin: "Abstract nominalizer." },
    ],
  },
  "unlockable-a": {
    summary:
      "Bracket reading A: prefix scopes over <strong>lockable</strong> → ‘not able to be locked.’ Classic scope puzzle for morphology class.",
    embedded: [{ text: "lock", note: "Smaller stem inside <em>lockable</em> — still audible." }],
    tense: "Adjective — compare how <em>-able</em> builds adjective stems before further prefixing.",
  },
  "unlockable-b": {
    summary:
      "Same surface string, different brackets: unlock + able → ‘able to be unlocked.’ Compare consciously with Unlockable-a in §4 readings.",
    tense: "Adjective built from prefixed verb stem + <strong>-able</strong> — derivation, not tense inflection.",
  },
  belief: {
    summary:
      "<strong>Noun stems</strong> from related verb stems in English historical morphology — teach contrasts with (<em>believe · believed · belief</em>).",
    etymology: [
      {
        segment: "belief",
        origin: "Historically tied to the <em>believe</em> stem cluster + noun-forming patterns (stem vowel differs from verb surface form).",
      },
    ],
  },
  believe: {
    summary: "Free verb morphologically simpler in this dataset — contrasts with noun <em>belief</em> for stem alternation conversations.",
    tense: "<strong>Tense</strong> is inflectional (<em>-s, -ed, -ing</em>) on this verb stem, outside the derivational word-formation illustrated in the noun tree variants.",
  },
  endure: {
    summary:
      "<em>en-</em> prefix + stem — discuss productive vs fossilized prefixes; contrast with noun <em>endurance</em> in neighboring lessons.",
    etymology: [
      { segment: "en-", origin: "Prefix seen in transitive/causative formations in Romance/Latinate strata." },
    ],
    tense: "Verb — inflection attaches at the boundary: endure / endures / enduring / endured.",
  },
  enable: {
    summary: "<strong>en-</strong> + adjective/adjective-shaped stem verbalized — discuss ‘make able’ parallels (<em>enrich, enlarge</em>).",
    etymology: [{ segment: "en-", origin: "Causativizing/emphatic prefix in this word family." }],
    tense: "Verb stem — tense with regular inflections.",
  },
  freedom: {
    summary: "<strong>Germanic derivation</strong>: adjective + abstract <strong>-dom</strong> (‘state, realm’ similar to kingdom, wisdom). Useful for Anglo-Saxon layer examples.",
    etymology: [
      { segment: "free", origin: "Germanic root — still transparent." },
      { segment: "-dom", origin: "Germanic noun-forming (‘statehood’)." },
    ],
    embedded: [{ text: "free", note: "Adjective/free morpheme inside the derivation." }],
  },
  wisdom: {
    summary: "<strong>know</strong>-family stem vowel variation + Germanic nominalizer <strong>-dom</strong> — compare noun <em>wise</em> family.",
    etymology: [
      { segment: "wis", origin: "Stem related to adj. <em>wise</em>." },
      { segment: "-dom", origin: "Abstract nominalizer (-dom)." },
    ],
    spelling: [{ from: "wise", to: "wis", note: "Stem allomorph before <em>-dom</em> — teach as pattern, not random." }],
  },
  kingdom: {
    summary: "Compound-like derivative: base + <strong>-dom</strong>. Right-hand head patterns as with other <em>-dom</em> nouns.",
    etymology: [
      { segment: "king", origin: "Germanic free noun." },
      { segment: "-dom", origin: "Abstract nominalizer." },
    ],
    embedded: [{ text: "king", note: "Free morpheme inside the derivation." }],
  },
  wiser: {
    summary:
      "<strong>-er</strong> attaches to gradable adjective base — comparative <strong>morphological inflection</strong> versus periphrastic <em>more wise</em> (register).",
    tense: "Shows comparison (inflectional category in English adjectives/adverbs for many one-syllable items).",
  },
  unwise: {
    summary: "<strong>un-</strong> productive on Germanic stems — contrasts with Latinate negatives in richer classroom pairings.",
    etymology: [{ segment: "un-", origin: AFFIX_ORIGIN_HINT["pfx:un-"] }],
    tense: "Adjective comparative/superlative pair with wise/wiser.",
  },
  constitution: {
    summary:
      "Dense Latinate layering with <strong>-tion</strong>; connect civics vocab to ‘how something is constituted’ vs daily ‘constitution’. ",
    etymology: [
      { segment: "con-", origin: "Latin ‘with; together’ in this stem formation." },
      { segment: "stit", origin: "Root ‘place, stand’ (institute)." },
      { segment: "-tion", origin: "Abstract nominal suffix." },
    ],
  },
  convince: {
    summary: "Stem + verbal ending — discuss <em>convince / conviction</em> family for derivational relationships across POS.",
    tense: "Verb — tense and agreement are inflectional at the word edge.",
  },
  finisher: {
    summary: "<strong>finish</strong> + agentive <strong>-er</strong> — transparent agent/instrument noun formation.",
    embedded: [{ text: "finish", note: "Verb stem appears whole before suffix." }],
  },
  teacher: {
    summary: "<strong>teach</strong> + agentive <strong>-er</strong> — textbook example of derivation creating noun from verb stem.",
    embedded: [{ text: "teach", note: "Free verb shrunk to stem before vowel lengthening/teach-er pattern." }],
    tense: "Derivative noun — plurality with regular <em>-s</em>.",
  },
  unhappy: {
    summary:
      "<strong>un-</strong> attaches to lexical adjectives productively (<em>happy</em>). Contrast analytic negation (‘not happy’) in rhetoric lessons.",
    etymology: [{ segment: "un-", origin: AFFIX_ORIGIN_HINT["pfx:un-"] }],
    embedded: [{ text: "happy", note: "Free adjective carries main lexical meaning." }],
  },
  baseball: {
    summary: "<strong>Noun+noun compound</strong> naming an object/category (§4.6). Discuss stress vs phrase <em>base ball</em> if time allows.",
    embedded: [
      { text: "base", note: "Content morpheme — polyseme with other senses." },
      { text: "ball", note: "Content morpheme." },
    ],
  },
  toothbrush: {
    summary: "<strong>Tooth</strong> + <strong>brush</strong> — right-hand noun often denotes the object subclass (tool for teeth). Compound stress rule worth a listening mini-task.",
    embedded: [{ text: "tooth", note: "Allomorph plural <em>teeth</em> contrasts with unchanged compound plural <em>toothbrushes</em> — inflection attaches to whole compound." }],
  },
  national: {
    summary: "<strong>nation</strong> relational adjective with <strong>-al</strong> — model for geography/social-studies vocab.",
    etymology: [{ segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] }],
  },
  careful: {
    summary: "<strong>care</strong> + <strong>-ful</strong> adjectival (‘full of care’) — contrasts with careless using <strong>-less</strong> in a contrasting mini-pair.",
  },
  readable: {
    summary:
      "<strong>read</strong> + <strong>-able</strong> — readability / able-to-be-read — pair with morphology of <strong>root allomorph</strong> in <em>-ible</em> cousins if desired.",
    etymology: [{ segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] }],
  },
  preview: {
    summary: "<strong>pre-</strong> + <strong>view</strong> — mostly transparent for STEM/media contexts; discuss productive <em>pre-</em> with other bases.",
    etymology: [{ segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] }],
  },
  invisible: {
    summary:
      "Negative + stem + adjectival endings — overlaps with morphology of <strong>in-/im-/il-/ir-</strong> (Table 4.2).",
    etymology: [
      { segment: "in-", origin: "Latin negative aligning with assimilated forms elsewhere." },
      { segment: "-ible", origin: "Allomorph cousin of <strong>-able</strong> after certain stems." },
    ],
  },
  predict: {
    summary: "<strong>pre-</strong> ‘before’ + <strong>dict</strong> ‘say’ — families like <em>dictionary, contradiction</em> illuminate the bound root.",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "dict", origin: "Latin ‘say, speak’ root (bound in English)." },
    ],
  },
  transport: {
    summary: "<strong>trans-</strong> across + bound root meaning ‘carry’ — excellent science/STEM cognate (<em>portable, export</em>).",
    etymology: [
      { segment: "trans-", origin: AFFIX_ORIGIN_HINT["pfx:trans-"] },
      { segment: "port", origin: "Latin ‘carry’ — compare <em>portage, import</em>." },
    ],
  },
};

/**
 * @param {object} w — word record from Morphology Garden
 * @param {Record<string, { mesh?: unknown; wordId: string }[]>} morphemeRegistry
 */
export function renderMorphLessonHtml(w, morphemeRegistry) {
  const deep = MORPH_DEEP_NOTES[w.id];
  const parts = [];
  parts.push(`<div class="morph-lesson">`);
  parts.push(`<h3 class="morph-lesson__h">Mini-lesson: <em>${w.label}</em></h3>`);

  parts.push(`<div class="morph-lesson__bracket">${w.bracket}</div>`);

  if (deep?.summary) {
    parts.push(`<p class="morph-lesson__lead">${deep.summary}</p>`);
  } else if (w.note) {
    parts.push(`<p class="morph-lesson__lead">${stripPara(w.note)}</p>`);
  }

  if (deep?.formation) {
    parts.push(`<section class="morph-lesson__sec"><h4>Structure &amp; derivation</h4><p>${deep.formation}</p></section>`);
  }

  if (deep?.etymology?.length) {
    parts.push(`<section class="morph-lesson__sec"><h4>Etymology cues</h4><ul class="morph-lesson__ul">`);
    for (const e of deep.etymology) {
      parts.push(`<li><strong>${escapeHtml(e.segment)}</strong> — ${e.origin || ""}`);
      if (e.note) parts.push(` <span class="morph-lesson__note">${escapeHtml(e.note)}</span>`);
      parts.push(`</li>`);
    }
    parts.push(`</ul></section>`);
  }

  if (deep?.spelling?.length) {
    parts.push(`<section class="morph-lesson__sec morph-lesson__sec--callout"><h4>Spelling / stem shift</h4><ul>`);
    for (const s of deep.spelling) {
      parts.push(
        `<li><code>${escapeHtml(s.from)}</code> → <code>${escapeHtml(s.to)}</code> — ${escapeHtml(s.note)}</li>`
      );
    }
    parts.push(`</ul></section>`);
  }

  if (deep?.embedded?.length) {
    parts.push(`<section class="morph-lesson__sec"><h4>Smaller words inside</h4><ul>`);
    for (const emb of deep.embedded) {
      parts.push(`<li><strong>${escapeHtml(emb.text)}</strong> — ${escapeHtml(emb.note)}</li>`);
    }
    parts.push(`</ul></section>`);
  }

  if (deep?.tense) {
    parts.push(`<section class="morph-lesson__sec"><h4>Inflection &amp; word-class</h4><p>${deep.tense}</p></section>`);
  }

  /** Cross-word morphemes (shared keys) — teaching hook */
  const keys = [];
  walkKeys(w.tree, keys);
  const uniqKeys = [...new Set(keys)].filter(Boolean);
  const sharedBullets = [];
  for (const k of uniqKeys) {
    const reg = morphemeRegistry[k];
    if (!reg || reg.length < 2) continue;
    const others = [...new Set(reg.map((x) => x.wordId))]
      .filter((id) => id !== w.id)
      .map((id) => WORDS_LOOKUP_LABEL(id))
      .filter(Boolean);
    if (!others.length) continue;
    const shortKey = k.replace(/^(pfx|sfx|root|lex):/, "");
    sharedBullets.push(
      `<li>The morpheme <strong>${escapeHtml(shortKey)}</strong> also appears in: ${others.map((x) => `<em>${escapeHtml(x)}</em>`).join(", ")}.</li>`
    );
  }
  if (sharedBullets.length) {
    parts.push(
      `<section class="morph-lesson__sec"><h4>Links to other words in this set</h4><ul class="morph-lesson__ul">${sharedBullets.join("")}</ul></section>`
    );
  }

  parts.push(`</div>`);
  return parts.join("");
}

/** @type {(id: string) => string} */
let WORDS_LOOKUP_LABEL = () => "";

export function configureLessonWordLookup(fn) {
  WORDS_LOOKUP_LABEL = fn;
}

function stripPara(htmlish) {
  return String(htmlish).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function walkKeys(node, out) {
  if (node.morphemeKey) out.push(node.morphemeKey);
  for (const c of node.children || []) walkKeys(c, out);
}


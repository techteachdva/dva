/**
 * Mini-lessons for Morphology Garden — written for students (about grades 6–10): say what the pieces mean,
 * why the word is built that way, and how that helps reading and spelling—not presenter jargon.
 * @typedef {{ segment: string, origin?: string, note?: string }} EtymoPart
 */

/** Plain-language glosses for morpheme tags used in lesson lists. */
export const AFFIX_ORIGIN_HINT = {
  "pfx:in-":
    '<strong>in-</strong> (and <strong>im-, il-, ir-</strong> before certain letters): adds “not” or “without.” Examples: <em>illegal, impossible, irregular</em>.',
  "pfx:re-":
    '<strong>re-</strong>: “again,” or sometimes “back” or “against.” Examples: <em>rewrite, rethink, resist</em>.',
  "pfx:un-":
    '<strong>un-</strong>: “not” or “reverse.” Common on everyday words: <em>unhappy, unzip</em>. Not the same family as Latin-type <strong>in-</strong>.',
  "pfx:de-": '<strong>de-</strong>: often “remove,” “reverse,” or “down.” Example: <em>decode</em>.',
  "pfx:pre-": '<strong>pre-</strong>: “before.” Examples: <em>preview, predict</em>.',
  "pfx:trans-": '<strong>trans-</strong>: “across” or “through.” Examples: <em>transport, translate</em>.',
  "sfx:-tion":
    '<strong>-tion / -ation</strong>: turns a verb-ish stem into a noun naming an act, process, or result. Example: <em>inform → information</em>.',
  "sfx:-ation": '<strong>-ation</strong>: same job as <strong>-tion</strong>—noun built from a stem.',
  "sfx:-ment": '<strong>-ment</strong>: noun suffix—“the result or product of ___ing.” Example: <em>develop → development</em>.',
  "sfx:-al": '<strong>-al</strong>: “related to” or “like a ___.” Example: <em>nation → national</em>.',
  "sfx:-ous": '<strong>-ous</strong>: “full of” or “having lots of ___.” Example: <em>dangerous</em>.',
  "sfx:-able":
    '<strong>-able</strong>: “can be ___ed” or “capable of being ___ed.” Example: <em>read → readable</em>.',
  "sfx:-ize": '<strong>-ize</strong>: turns a word into a verb meaning “make into” or “treat as.” Example: <em>hospital → hospitalize</em>.',
  "sfx:-ity": '<strong>-ity</strong>: turns many adjectives into abstract nouns. Example: <em>sincere → sincerity</em>.',
  "sfx:-er":
    '<strong>-er</strong>: two big jobs—(1) “more ___” on short adjectives (<em>wiser</em>), or (2) “person or thing that ___s” (<em>teacher</em>). Use sentence grammar to tell which.',
  "sfx:-ful": '<strong>-ful</strong>: “full of” or “having.” Example: <em>careful</em>.',
  "sfx:-less": '<strong>-less</strong>: “without.” Example: <em>hopeless</em>.',
  "sfx:-dom":
    '<strong>-dom</strong>: turns a word into a noun about a state or realm. Examples: <em>freedom, kingdom</em>.',
};

/**
 * @type {Record<string, { summary: string, etymology?: EtymoPart[], formation?: string, tense?: string, embedded?: { text: string, note: string }[], spelling?: { from: string, to: string, note: string }[] }>}
 */
export const MORPH_DEEP_NOTES = {
  presentation: {
    summary:
      "<strong>What you learn:</strong> A <em>presentation</em> is the act of showing or handing something over (like slides or a report). The word builds from <strong>pre-</strong> “before” + a stem related to “put/send” + <strong>-ation</strong>, which turns it into a noun for an event or thing.",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "sent", origin: "Stem related to “put” or “send”—same family as <em>consent</em> and <em>sentence</em>." },
      { segment: "-ation", origin: AFFIX_ORIGIN_HINT["sfx:-ation"] },
    ],
    tense: "Here it’s a <strong>noun</strong> (the presentation). Don’t confuse that with the verb <em>she presents</em>, where <strong>-s</strong> is added on the outside.",
  },
  hallway: {
    summary:
      "<strong>What you learn:</strong> A compound word: <strong>hall</strong> + <strong>way</strong>. Both parts are normal English words; pressed together they mean a passage or corridor—not “a hall’s method,” but one idea: a path-like hall.",
    etymology: [
      { segment: "hall", origin: "Large indoor space." },
      { segment: "way", origin: "Path or route." },
    ],
    embedded: [
      { text: "hall", note: "You can say <em>hall</em> on its own." },
      { text: "way", note: "The second part names what kind of path it is." },
    ],
  },
  final: {
    summary:
      "<strong>What you learn:</strong> <strong>Final</strong> means “last” or “deciding.” <strong>Fin-</strong> carries “end” or “limit” (think <em>finish</em>), and <strong>-al</strong> makes an adjective: “about an end or limit.”",
    etymology: [
      { segment: "fin-", origin: "Root idea of “end” or “limit”—related to <em>finish</em>." },
      { segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] },
    ],
    tense: "An adjective (final exam, final score). Not the same as the noun <em>finale</em>, which is about a last performance.",
  },
  sourdough: {
    summary:
      "<strong>What you learn:</strong> Another compound: <strong>sour</strong> + <strong>dough</strong>. The meaning is literally in the pieces—tangy dough used as starter for bread.",
    etymology: [
      { segment: "sour", origin: "The taste." },
      { segment: "dough", origin: "The moist flour mixture." },
    ],
    embedded: [
      { text: "sour", note: "Adjective you already use." },
      { text: "dough", note: "The head noun: what kind of dough? Sour dough." },
    ],
  },
  before: {
    summary:
      "<strong>What you learn:</strong> An older English pattern: <strong>be-</strong> + <strong>fore</strong> “in front / ahead.” That “ahead” idea still shows up in <em>foreshadow</em> and <em>forecast</em>.",
    etymology: [
      { segment: "be-", origin: "Old prefix that shows up in words like <em>because</em> and <em>before</em>." },
      { segment: "fore", origin: "Ahead or in front—compare <em>forehead</em>." },
    ],
  },
  rainbow: {
    summary:
      "<strong>What you learn:</strong> <strong>Rain</strong> + <strong>bow</strong> (arc). It names an arc of colors in the sky after rain—the second part is “bow” like a curved shape, not necessarily a hair ribbon.",
    etymology: [
      { segment: "rain", origin: "Water falling from clouds." },
      { segment: "bow", origin: "Here: a curved band or arc." },
    ],
    embedded: [
      { text: "rain", note: "First part narrows the meaning." },
      { text: "bow", note: "Second part: what kind of arc—rain-shaped." },
    ],
  },
  inhospitable: {
    summary:
      "<strong>What you learn:</strong> “Not welcoming.” The word ties to <em>hospital</em> / <em>hospitality</em> (hosting a guest). <strong>in-</strong> = “not,” and <strong>-able</strong> = “able to be ___ed”—here, able to be hosted or treated as a guest.",
    etymology: [
      { segment: "in-", origin: AFFIX_ORIGIN_HINT["pfx:in-"] },
      { segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] },
    ],
    tense: "An adjective. You can say a place or a person is inhospitable.",
  },
  demarcation: {
    summary:
      "<strong>What you learn:</strong> A line or boundary that separates two areas or ideas. <strong>de-</strong> often signals “off” or “down,” the middle echoes <em>mark</em>, and <strong>-ation</strong> makes a noun for the act or result of marking a boundary.",
    etymology: [
      { segment: "de-", origin: AFFIX_ORIGIN_HINT["pfx:de-"] },
      { segment: "mark/marc-", origin: "Related to marking a line—think <em>mark</em> as in “make a mark.”" },
      { segment: "-ation", origin: AFFIX_ORIGIN_HINT["sfx:-ation"] },
    ],
    spelling: [
      {
        from: "mark",
        to: "marc-",
        note: "English keeps the ‘k’ sound but uses a Latinate spelling <strong>marc-</strong> inside words like this—not random; it’s a pattern you’ll see in formal vocabulary.",
      },
    ],
  },
  dehumanization: {
    summary:
      "<strong>What you learn:</strong> The process of stripping away someone’s full humanity or treating them as less than human. Built as: <strong>de-</strong> (remove or reverse) + <strong>human</strong> + <strong>-ize</strong> (make into) + <strong>-ation</strong> (noun for a process).",
    etymology: [
      { segment: "de-", origin: AFFIX_ORIGIN_HINT["pfx:de-"] },
      { segment: "-ize", origin: AFFIX_ORIGIN_HINT["sfx:-ize"] },
      { segment: "-ation", origin: AFFIX_ORIGIN_HINT["sfx:-ation"] },
    ],
    tense: "A noun naming a process. Compare to a past-tense verb like <em>They were dehumanized</em>—different job in the sentence.",
  },
  resistance: {
    summary:
      "<strong>What you learn:</strong> Pushing back or refusing to go along. Morpheme-wise: <strong>re-</strong> “back / against” + <strong>sist</strong> “stand” (as in <em>insist</em>) + <strong>-ance</strong>, a noun ending for a state or quality.",
    etymology: [
      { segment: "re-", origin: AFFIX_ORIGIN_HINT["pfx:re-"] },
      { segment: "sist", origin: 'Stem meaning “stand”—same family as <em>insist</em> and <em>consist</em>.' },
      { segment: "-ance", origin: 'Noun suffix for an abstract state—similar role to <strong>-tion</strong> in other words.' },
    ],
  },
  revolution: {
    summary:
      "<strong>What you learn:</strong> A big change or a full turn—history books use it for overthrowing a system; science uses it for something revolving. Same pieces: <strong>re-</strong> + root about rolling/turning + <strong>-tion</strong> noun.",
    etymology: [
      { segment: "re-", origin: AFFIX_ORIGIN_HINT["pfx:re-"] },
      { segment: "volu", origin: "Root idea of roll or turn—related to words like <em>revolve</em>." },
      { segment: "-tion", origin: AFFIX_ORIGIN_HINT["sfx:-tion"] },
    ],
  },
  "unlockable-a": {
    summary:
      "<strong>What you learn:</strong> This reading means “<strong>not</strong> able to be locked”—the <strong>un-</strong> attaches to the whole adjective <em>lockable</em>, not to the bare verb <em>lock</em>. So: not (lockable).",
    embedded: [{ text: "lock", note: "Still visible inside <em>lockable</em>." }],
    tense: "Adjective. Say it in plain English: “You can’t lock it” matches this bracketing.",
    formation:
      "Brackets: <strong>[ un [ lock-able ] ]</strong>. The negative wraps the whole “able to be locked” idea.",
  },
  "unlockable-b": {
    summary:
      "<strong>What you learn:</strong> Same spelling as the other tree, but a different structure: “able to be <strong>unlocked</strong>.” Here <strong>-able</strong> hooks onto <strong>unlock</strong> first: possible to open what was locked.",
    tense: "Adjective. Ask: “Can someone unlock it?”—that question fits this structure better than the other reading.",
    formation: "Brackets: <strong>[ [ un-lock ] able ]</strong>. Compare to the other <em>unlockable</em> tree: English allows both meanings; brackets show which one you mean.",
  },
  belief: {
    summary:
      "<strong>What you learn:</strong> The noun for what you hold to be true. It doesn’t break cleanly into modern everyday chunks like “be + lief”; pair it with the verb <strong>believe</strong> and notice the vowel shift—that pairing helps spelling.",
    etymology: [{ segment: "be- / lief", origin: 'Old English leftovers bundled together—remember it next to <em>believe</em>, not as separate mini-words.' }],
  },
  believe: {
    summary:
      "<strong>What you learn:</strong> To accept something as true. Morphology lines up with <strong>belief</strong>; English keeps related words sounding similar but spells them differently.",
    tense: "Verb—add <strong>-s, -ed, -ing</strong> on the outside for tense (<em>believes, believed, believing</em>).",
  },
  endure: {
    summary:
      "<strong>What you learn:</strong> To last through something hard. <strong>En-</strong> acts like “in” or “make,” and the stem links to “hard” / lasting—same root flavor as <em>durable</em>.",
    etymology: [
      { segment: "en-", origin: 'Prefix that shows up on verbs like <em>enable</em> and <em>enrich</em>.' },
      { segment: "dure", origin: 'Stem about hardness or lasting—compare <em>durable</em>.' },
    ],
    tense: "Verb—endings like <strong>-ed</strong> and <strong>-ing</strong> attach outside the stem bundle.",
  },
  enable: {
    summary:
      "<strong>What you learn:</strong> To make something possible or to switch something on. Built like “make able”: <strong>en-</strong> + <strong>able</strong>. Contrast <strong>disable</strong>—same core, opposite prefix.",
    etymology: [
      { segment: "en-", origin: 'Often turns adjectives or nouns into verbs (enable, enrich).' },
      { segment: "able", origin: 'Same “can / capable” idea as in <em>ability</em>; opposite vibe to <em>disable</em>.' },
    ],
    tense: "Verb (<em>This enables…</em>).",
  },
  freedom: {
    summary:
      "<strong>What you learn:</strong> The state of being free. <strong>-dom</strong> builds nouns for states or realms from another word—here, from <strong>free</strong>.",
    etymology: [
      { segment: "free", origin: "Means “not controlled” or “no cost,” depending on context." },
      { segment: "-dom", origin: AFFIX_ORIGIN_HINT["sfx:-dom"] },
    ],
    embedded: [{ text: "free", note: "You still say <em>free</em> alone." }],
  },
  wisdom: {
    summary:
      "<strong>What you learn:</strong> Deep good judgment or knowledge. Same suffix as <strong>freedom</strong>: <strong>-dom</strong> names a quality or state. The vowel shortens from <em>wise</em> before <strong>-dom</strong>.",
    etymology: [
      { segment: "wis", origin: "Related to <em>wise</em>; spelling trims before the suffix." },
      { segment: "-dom", origin: AFFIX_ORIGIN_HINT["sfx:-dom"] },
    ],
    spelling: [{ from: "wise", to: "wis-", note: "English often shortens the vowel before <strong>-dom</strong>—not random; it’s a pattern." }],
  },
  kingdom: {
    summary:
      "<strong>What you learn:</strong> A country ruled by a king or queen, or any realm. <strong>King</strong> + <strong>-dom</strong> (state/realm noun)—same suffix family as <strong>freedom</strong>.",
    etymology: [
      { segment: "king", origin: "Ruler." },
      { segment: "-dom", origin: "Builds a noun for a realm or condition." },
    ],
    embedded: [{ text: "king", note: "Free-standing word before <strong>-dom</strong> glues on." }],
  },
  wiser: {
    summary:
      "<strong>What you learn:</strong> “More wise.” Here <strong>-er</strong> marks comparison—not “a person who wise,” but “more than before.” Compare <strong>teacher</strong>, where <strong>-er</strong> means “one who teaches.”",
    tense: "Comparative adjective: wise → wiser → wisest.",
  },
  unwise: {
    summary:
      "<strong>What you learn:</strong> Not wise—a poor choice or judgment. <strong>Un-</strong> negates the adjective <strong>wise</strong>.",
    etymology: [{ segment: "un-", origin: AFFIX_ORIGIN_HINT["pfx:un-"] }],
    tense: "Adjective—you can grade it: more unwise / most unwise (or switch to “less wise”).",
  },
  constitution: {
    summary:
      "<strong>What you learn:</strong> Can mean the founding rules of a country or how something is physically built. Pieces: <strong>con-</strong> “together” + stem about setting up + <strong>-tion</strong> noun.",
    etymology: [
      { segment: "con-", origin: "Together or completely—same opening flavor as <em>connect</em>." },
      { segment: "stitut", origin: "About setting up or placing—think <em>institute</em>." },
      { segment: "-tion", origin: AFFIX_ORIGIN_HINT["sfx:-tion"] },
    ],
  },
  convince: {
    summary:
      "<strong>What you learn:</strong> To persuade someone by argument. The pieces suggest “win completely together”—prefix <strong>con-</strong> + stem related to conquering or overcoming.",
    etymology: [
      { segment: "con-", origin: "Together / completely—similar opening to other Latin-style words." },
      { segment: "vince", origin: "Stem about conquering or overcoming—you rarely see it alone in modern English." },
    ],
    tense: "Verb—add <strong>-s / -ed</strong> on the outside when you conjugate.",
  },
  finisher: {
    summary:
      "<strong>What you learn:</strong> Someone or something that finishes (e.g. a race). <strong>-er</strong> here means “doer,” not “more”: finish + er.",
    embedded: [{ text: "finish", note: "Verb stem before <strong>-er</strong>." }],
  },
  teacher: {
    summary:
      "<strong>What you learn:</strong> A person who teaches. Same <strong>-er</strong> pattern as <strong>finisher</strong>: verb stem + <strong>-er</strong> = “one who ___s.”",
    embedded: [{ text: "teach", note: "Verb stem; add <strong>-er</strong> for the job title." }],
    tense: "Plural: <strong>teachers</strong>—the <strong>-s</strong> goes on the whole word.",
  },
  unhappy: {
    summary:
      "<strong>What you learn:</strong> Not happy. <strong>Un-</strong> flips the adjective—same prefix family as <strong>unkind</strong>, not the Latin <strong>in-</strong>.",
    etymology: [{ segment: "un-", origin: AFFIX_ORIGIN_HINT["pfx:un-"] }],
    embedded: [{ text: "happy", note: "Core meaning; <strong>un-</strong> negates it." }],
  },
  baseball: {
    summary:
      "<strong>What you learn:</strong> Compound noun: <strong>base</strong> + <strong>ball</strong>. Two everyday words stuck together name one thing—the stress sounds different from saying “a base ball” as separate words.",
    embedded: [
      { text: "base", note: "Field sense here." },
      { text: "ball", note: "Second part names the kind of ball." },
    ],
  },
  toothbrush: {
    summary:
      "<strong>What you learn:</strong> <strong>Tooth</strong> + <strong>brush</strong>. Odd plural: we say <em>toothbrushes</em> (add <strong>-es</strong> to the whole word), not “teethbrushes,” because the compound is one unit.",
    embedded: [
      {
        text: "tooth",
        note: "Stays singular inside the compound even when you own several brushes.",
      },
      { text: "brush", note: "The tool head." },
    ],
  },
  national: {
    summary:
      "<strong>What you learn:</strong> About a whole country or people. <strong>Nation</strong> + <strong>-al</strong> (“relating to”).",
    etymology: [{ segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] }],
  },
  careful: {
    summary:
      "<strong>What you learn:</strong> Full of care or paying attention. <strong>Care</strong> + <strong>-ful</strong> (“full of”). Opposite vibe: <strong>careless</strong> uses <strong>-less</strong> (“without”).",
    etymology: [
      { segment: "care", origin: "Noun or verb you already know." },
      { segment: "-ful", origin: AFFIX_ORIGIN_HINT["sfx:-ful"] },
    ],
  },
  readable: {
    summary:
      "<strong>What you learn:</strong> Easy enough to read—handwriting, fonts, or text on a screen. <strong>Read</strong> + <strong>-able</strong> (“can be read”).",
    etymology: [
      { segment: "read", origin: "Verb stem." },
      { segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] },
    ],
  },
  preview: {
    summary:
      "<strong>What you learn:</strong> To see or show something early—a trailer, a sample chapter, a sneak peek. <strong>Pre-</strong> “before” + <strong>view</strong> “see.”",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "view", origin: "See or look—still a word on its own." },
    ],
  },
  invisible: {
    summary:
      "<strong>What you learn:</strong> Cannot be seen. <strong>in-</strong> “not” + stem related to sight + <strong>-ible</strong> (same job as <strong>-able</strong> after certain stems).",
    etymology: [
      { segment: "in-", origin: AFFIX_ORIGIN_HINT["pfx:in-"] },
      { segment: "-ible", origin: "Same kind of ending as <strong>-able</strong>: “able to be ___ed.”" },
    ],
  },
  predict: {
    summary:
      "<strong>What you learn:</strong> Say what will happen before it happens. <strong>Pre-</strong> “before” + <strong>dict</strong> “say” (same root flavor as <em>dictionary</em> or <em>verdict</em>).",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "dict", origin: 'Stem meaning “say” or “tell.”' },
    ],
  },
  transport: {
    summary:
      "<strong>What you learn:</strong> Carry people or things across a distance—verb or noun. <strong>Trans-</strong> “across” + <strong>port</strong> “carry” (same <em>port</em> as <strong>portable</strong>).",
    etymology: [
      { segment: "trans-", origin: AFFIX_ORIGIN_HINT["pfx:trans-"] },
      { segment: "port", origin: 'Carry—think import / export / portable.' },
    ],
  },
  teaching: {
    summary:
      "<strong>What you learn:</strong> The activity or profession of teaching—or the present participle of <strong>teach</strong>. <strong>-ing</strong> can name an action (<em>Teaching is hard</em>) or mark an ongoing verb (<em>She is teaching</em>).",
    etymology: [
      { segment: "teach", origin: "Verb stem—same family as <strong>teacher</strong>." },
      { segment: "-ing", origin: "Either builds a noun from the verb or marks progressive tense." },
    ],
    tense: "Notice sentence job: noun phrase vs ongoing verb.",
  },
  playful: {
    summary:
      "<strong>What you learn:</strong> Full of play or joking around. <strong>Play</strong> + <strong>-ful</strong> (“full of”).",
    etymology: [
      { segment: "play", origin: "Noun or verb for games or light joking." },
      { segment: "-ful", origin: AFFIX_ORIGIN_HINT["sfx:-ful"] },
    ],
  },
  snowball: {
    summary:
      "<strong>What you learn:</strong> Like <strong>baseball</strong>: <strong>snow</strong> + <strong>ball</strong>. First part narrows meaning—what kind of ball? Snow.",
    embedded: [
      { text: "snow", note: "Modifier." },
      { text: "ball", note: "Head: ball made of snow." },
    ],
  },
  disable: {
    summary:
      "<strong>What you learn:</strong> Turn off or take away ability—often for tools or access (same contrast as <strong>enable</strong>). <strong>dis-</strong> “not / opposite” + <strong>able</strong> stem.",
    etymology: [
      { segment: "dis-", origin: "Opposite or removal—common on Latin-based stems." },
      { segment: "able", origin: "Same core as <em>ability</em>; opposite prefix from <em>enable</em>." },
    ],
  },
  nationalism: {
    summary:
      "<strong>What you learn:</strong> Strong loyalty to one’s own nation, or the belief that your nation should come first. Built in layers: <strong>nation</strong> → <strong>national</strong> → <strong>nationalism</strong> with <strong>-ism</strong> (belief system or movement).",
    etymology: [
      { segment: "nation", origin: "A people or country." },
      { segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] },
      { segment: "-ism", origin: 'Noun ending for an ideology or movement.' },
    ],
    formation: "Each suffix wraps the bigger bundle: nation → national → nationalism.",
  },
  international: {
    summary:
      "<strong>What you learn:</strong> Between or among nations—cross-border. <strong>inter-</strong> “among” + <strong>nation</strong> + <strong>-al</strong>.",
    etymology: [
      { segment: "inter-", origin: "Between or among—think internet, interact." },
      { segment: "nation / -al", origin: 'Same pieces as <em>national</em> and <em>nationalism</em>.' },
    ],
  },
  portable: {
    summary:
      "<strong>What you learn:</strong> Able to be carried—laptops, chargers, folding chairs. <strong>Port</strong> “carry” + <strong>-able</strong> (“can be ___ed”).",
    etymology: [
      { segment: "port", origin: 'Carry—same root as <em>transport</em> and <em>import</em>.' },
      { segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] },
    ],
  },
  reuse: {
    summary:
      "<strong>What you learn:</strong> Use again. <strong>Re-</strong> “again” + <strong>use</strong>—straightforward build.",
    etymology: [
      { segment: "re-", origin: AFFIX_ORIGIN_HINT["pfx:re-"] },
      { segment: "use", origin: "Verb you already know alone." },
    ],
  },
  illegal: {
    summary:
      "<strong>What you learn:</strong> Against the law. The negative prefix matches the next letter: before <strong>l</strong> it spells <strong>il-</strong> instead of <strong>in-</strong>—same “not” meaning as <strong>impossible</strong> or <strong>irregular</strong>.",
    etymology: [
      { segment: "il-", origin: AFFIX_ORIGIN_HINT["pfx:in-"] },
      { segment: "legal", origin: 'About the law.' },
    ],
    formation: "Pattern: <strong>il-</strong> + legal—it’s grammar of spelling, not a different meaning from other <strong>in-</strong> negatives.",
  },
};

/**
 * @param {object} w
 * @param {Record<string, { mesh?: unknown; wordId: string }[]>} morphemeRegistry
 */
function morphLessonPieces(w, morphemeRegistry) {
  const deep = MORPH_DEEP_NOTES[w.id];
  const pieces = [];

  const headParts = [];
  headParts.push(`<h3 class="morph-lesson__h"><em>${w.label}</em> — how it breaks apart</h3>`);
  headParts.push(`<p class="morph-lesson__bracket-caption">How the pieces nest (outer brackets = bigger meaning units):</p>`);
  headParts.push(`<div class="morph-lesson__bracket" translate="no">${w.bracket}</div>`);
  if (deep?.summary) headParts.push(`<p class="morph-lesson__lead">${deep.summary}</p>`);
  else if (w.note) headParts.push(`<p class="morph-lesson__lead">${stripPara(w.note)}</p>`);
  pieces.push(headParts.join(""));

  if (deep?.formation) {
    pieces.push(
      `<section class="morph-lesson__sec"><h4>Why the nesting matters</h4><p>${deep.formation}</p></section>`
    );
  }

  if (deep?.etymology?.length) {
    let b =
      `<section class="morph-lesson__sec"><h4>What each piece means</h4><ul class="morph-lesson__ul">`;
    for (const e of deep.etymology) {
      b += `<li><strong>${escapeHtml(e.segment)}</strong> — ${e.origin || ""}`;
      if (e.note) b += ` <span class="morph-lesson__note">${escapeHtml(e.note)}</span>`;
      b += `</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.spelling?.length) {
    let b = `<section class="morph-lesson__sec morph-lesson__sec--callout"><h4>Spelling tip</h4><ul>`;
    for (const s of deep.spelling) {
      b += `<li><code>${escapeHtml(s.from)}</code> → <code>${escapeHtml(s.to)}</code> — ${escapeHtml(s.note)}</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.embedded?.length) {
    let b =
      `<section class="morph-lesson__sec"><h4>Smaller words inside this word</h4><ul>`;
    for (const emb of deep.embedded) {
      b += `<li><strong>${escapeHtml(emb.text)}</strong> — ${escapeHtml(emb.note)}</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.tense) {
    pieces.push(`<section class="morph-lesson__sec"><h4>What kind of word is this?</h4><p>${deep.tense}</p></section>`);
  }

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
      `<li>The piece <strong>${escapeHtml(shortKey)}</strong> also appears in: ${others.map((x) => `<em>${escapeHtml(x)}</em>`).join(", ")} (same word list).</li>`
    );
  }
  if (sharedBullets.length) {
    pieces.push(
      `<section class="morph-lesson__sec morph-lesson__sec--web"><h4>Same piece in other words (in this list)</h4><ul class="morph-lesson__ul">${sharedBullets.join(
        ""
      )}</ul><p class="morph-lesson__meta">Follow the pink links on the diagram to jump between words that share a chunk.</p></section>`
    );
  }

  return pieces;
}

/**
 * @param {object} w — word record from Morphology Garden
 * @param {Record<string, { mesh?: unknown; wordId: string }[]>} morphemeRegistry
 */
export function renderMorphLessonHtml(w, morphemeRegistry) {
  const pieces = morphLessonPieces(w, morphemeRegistry);
  if (!pieces.length) return "";

  if (pieces.length === 1) {
    return `<div class="morph-lesson morph-lesson--single">${pieces[0]}</div>`;
  }

  const mid = Math.ceil(pieces.length / 2);
  const leftInner = `<div class="morph-lesson-wing morph-lesson-wing--left">${pieces.slice(0, mid).join("")}</div>`;
  const rightInner = `<div class="morph-lesson-wing morph-lesson-wing--right">${pieces.slice(mid).join("")}</div>`;
  return `<div class="morph-detail-lesson morph-detail-lesson--flank">${leftInner}${rightInner}</div>`;
}

/**
 * Combined mini-lesson for dual compare layout: centred on overlapping morpheme keys between two lemmas.
 * @param {object} wa
 * @param {object} wb
 * @param {Record<string, { mesh?: unknown; wordId: string }[]>} morphemeRegistry
 */
export function renderMorphDualLessonHtml(wa, wb, morphemeRegistry) {
  const ka = [];
  walkKeys(wa.tree, ka);
  const kb = [];
  walkKeys(wb.tree, kb);
  const kbSet = new Set(kb);
  const sharedKeys = [...new Set(ka)].filter(Boolean).filter((k) => kbSet.has(k));
  sharedKeys.sort();

  let html =
    `<div class="morph-lesson morph-lesson--dual"><h3 class="morph-lesson__h">Comparing ` +
    `<em>${escapeHtml(wa.label)}</em> &amp; <em>${escapeHtml(wb.label)}</em></h3>`;

  if (!sharedKeys.length) {
    html +=
      `<p class="morph-lesson__lead">These two words don’t share a labelled chunk in this vocabulary list. If you still see pink lines between spheres on the diagram, those show links the view draws between shared pieces.</p></div>`;
    return html;
  }

  html += `<p class="morph-lesson__lead">Below are pieces that show up on <em>both</em> trees. Pink arcs on the diagram connect matching chunks so you can see one morpheme doing similar work in two words.</p>`;
  html += `<section class="morph-lesson__sec morph-lesson__sec--overlap"><h4>What both words share</h4><ul class="morph-lesson__ul">`;

  for (const key of sharedKeys) {
    const shortKey = key.replace(/^(pfx|sfx|root|lex):/, "");
    let glossHtml = AFFIX_ORIGIN_HINT[key];
    if (!glossHtml) {
      glossHtml = `This piece <strong>${escapeHtml(shortKey)}</strong> is tagged on both words—hover the diagram for glosses and see how the meaning fits each tree.`;
    }
    const reg = morphemeRegistry[key];
    const regOthers = reg
      ? [...new Set(reg.map((x) => x.wordId))]
          .filter((id) => id !== wa.id && id !== wb.id)
          .map((id) => WORDS_LOOKUP_LABEL(id))
          .filter(Boolean)
      : [];
    const sibling =
      regOthers.length > 0 ?
        `<span class="morph-lesson__meta"> Also tagged in other loaded words: ${regOthers.map((x) => `<em>${escapeHtml(x)}</em>`).join(", ")}.</span>` :
        "";
    html += `<li>${glossHtml}${sibling}</li>`;
  }
  html += `</ul></section></div>`;
  return html;
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

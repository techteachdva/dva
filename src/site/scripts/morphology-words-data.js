/**
 * Morphology Garden — unified lemma list (one primary example word per morpheme lesson).
 *
 * Edit judgments here:
 * - `tier`: "tier1" | "tier2" | "tier3" (Beck-style — shown in the mini-lesson; change anytime)
 * - `deep.summary` / `deep.etymology`: instructional copy for the built-in lesson renderer
 * - `tree` / `bracket` / `morphemeKey` tags: diagram + pink “same chunk” links across words
 */

/** @typedef {"tier1"|"tier2"|"tier3"} MorphTier */

/**
 * @param {number} count
 * @param {number} radius
 * @returns {[number, number, number][]}
 */
function morphRingPositions(count, radius = 54) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    out.push([Math.round(Math.cos(a) * radius * 10) / 10, 0, Math.round(Math.sin(a) * radius * 10) / 10]);
  }
  return out;
}

/** Morpheme-focused lemmas (display order: suffixes, prefixes, roots, Greek combining forms). */
const _MORPHOLOGY_WORDS_RAW = /** @type {const} */ ([
  // --- Suffixes ---
  {
    id: "sfx-s-es",
    label: "Cats",
    tier: /** @type {MorphTier} */ ("tier1"),
    focusMorpheme: "-s / -es (regular plurals)",
    bracket: "[cat + -s]",
    note: "<strong>Exit ticket:</strong> Name one noun that takes <strong>-es</strong> after <strong>x</strong>, <strong>s</strong>, <strong>ch</strong>, or <strong>sh</strong> (like <em>boxes</em> or <em>dishes</em>).",
    tree: {
      text: "cats",
      gloss: "noun: more than one cat",
      children: [
        { text: "cat", gloss: "free morpheme: animal", morphemeKey: "lex:cat", children: [] },
        { text: "-s", gloss: "suffix: plural / third-person singular present", morphemeKey: "sfx:-s", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> English often marks “more than one” by adding a sound spelled <strong>-s</strong> or <strong>-es</strong>. Think of <strong>-es</strong> as the spelling you reach for when plain <strong>-s</strong> would feel clumsy after certain endings (like <em>boxes</em>, <em>classes</em>).",
      etymology: [
        { segment: "cat", origin: "The noun you start from." },
        { segment: "-s", origin: "Inflectional ending—does a grammar job (plural or verb agreement), not a “new word family” like Latin prefixes." },
      ],
      tense: "Here <strong>-s</strong> marks plural nouns. The same letters can mark verb agreement (<em>She runs</em>)—sentence context tells you which job.",
    },
  },
  {
    id: "sfx-ed",
    label: "Jumped",
    tier: "tier1",
    focusMorpheme: "-ed (past tense / past participle)",
    bracket: "[jump + -ed]",
    note: "<strong>Exit ticket:</strong> Say the word aloud: does <strong>-ed</strong> come out as /t/, /d/, or an extra syllable /ɪd/?",
    tree: {
      text: "jumped",
      gloss: "verb: did a jump; past time",
      children: [
        { text: "jump", gloss: "free morpheme: spring upward", morphemeKey: "lex:jump", children: [] },
        { text: "-ed", gloss: "suffix: past tense / past participle", morphemeKey: "sfx:-ed", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-ed</strong> usually signals “already happened” or “finished action,” though English also uses other past forms (<em>went, sang</em>). When it attaches to a regular verb like <em>jump</em>, you get a predictable past form.",
      etymology: [
        { segment: "jump", origin: "Verb stem." },
        { segment: "-ed", origin: "Inflectional suffix—time/aspect glue on verbs." },
      ],
      tense: "Past tense / participle family. Compare irregular pasts for contrast (<em>jumped</em> vs <em>ran</em>).",
    },
  },
  {
    id: "sfx-ing",
    label: "Running",
    tier: "tier1",
    focusMorpheme: "-ing",
    bracket: "[run + -ing]",
    note: "<strong>Exit ticket:</strong> Give a sentence using <em>running</em> as a noun (<em>Running helps…</em>) and one using it as part of a progressive verb.",
    tree: {
      text: "running",
      gloss: "verb/noun: the action of run; ongoing action",
      children: [
        { text: "run", gloss: "verb stem: move fast", morphemeKey: "lex:run", children: [] },
        { text: "-ing", gloss: "suffix: gerund/participle/progressive", morphemeKey: "sfx:-ing", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-ing</strong> shows up in several grammar roles—ongoing action (<em>is running</em>), a noun-like activity (<em>Running is fun</em>), and adjective-like uses (<em>running water</em>). Same spelling; sentence job differs.",
      tense: "Ask “Is this naming an activity, marking ongoing time, or modifying a noun?”",
    },
  },
  {
    id: "sfx-ly",
    label: "Quickly",
    tier: "tier1",
    focusMorpheme: "-ly",
    bracket: "[quick + -ly]",
    note: "<strong>Exit ticket:</strong> Turn <em>happy</em> into an adverb with <strong>-ly</strong>. What happens to the <strong>y</strong>?",
    tree: {
      text: "quickly",
      gloss: "adverb: in a quick manner",
      children: [
        { text: "quick", gloss: "adjective stem: fast", morphemeKey: "lex:quick", children: [] },
        { text: "-ly", gloss: "suffix: manner adverb", morphemeKey: "sfx:-ly", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> Many English adverbs are built by adding <strong>-ly</strong> to an adjective—often meaning “in a ___ way.” Watch friendly exceptions (<em>fast</em> can be adjective or adverb without <strong>-ly</strong>).",
      etymology: [
        { segment: "quick", origin: "Adjective base." },
        { segment: "-ly", origin: "Turns many adjectives into manner adverbs." },
      ],
    },
  },
  {
    id: "sfx-er-or",
    label: "Teacher",
    tier: "tier1",
    focusMorpheme: "-er / -or (agent nouns; compare with comparative -er)",
    bracket: "[teach + -er]",
    note: "<strong>Exit ticket:</strong> Name another word where <strong>-er</strong> means “a person who ___s,” and one where <strong>-or</strong> does the same job (<em>actor, elevator</em> patterns).",
    tree: {
      text: "teacher",
      gloss: "noun: one who teaches",
      children: [
        { text: "teach", gloss: "verb stem", morphemeKey: "lex:teach", children: [] },
        { text: "-er", gloss: "suffix: one who; thing that", morphemeKey: "sfx:-er", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> Here <strong>-er</strong> builds a noun for a role or doer: “someone who teaches.” Don’t confuse that with comparative <strong>-er</strong> (<em>faster</em>)—sentence context and the base word’s part of speech usually make it obvious.",
      etymology: [
        { segment: "teach", origin: "Verb stem." },
        { segment: "-er", origin: "Agentive suffix—person or thing tied to an action." },
      ],
      formation: "Parallel pattern with <strong>-or</strong> after Latin stems (<em>actor, supervisor</em>)—same “doer” idea, different spelling history.",
    },
  },
  {
    id: "sfx-ion",
    label: "Action",
    tier: "tier2",
    focusMorpheme: "-ion / -tion (nominalization)",
    bracket: "[act + -ion]",
    note: "<strong>Exit ticket:</strong> What verb hides inside <em>action</em>?",
    tree: {
      text: "action",
      gloss: "noun: something done; deed",
      children: [
        { text: "act", gloss: "stem: do", morphemeKey: "root:act", children: [] },
        { text: "-ion", gloss: "suffix: act/result noun", morphemeKey: "sfx:-tion", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-tion / -ion</strong> often turns a verb-like stem into a noun naming an act, process, or result—compare “act” vs “action.” Spelling varies (<em>decide → decision</em>) but the pattern is common in academic vocabulary.",
      etymology: [
        { segment: "act", origin: 'Stem meaning “do”—same family as the verb <em>act</em>.' },
        { segment: "-ion", origin: "Builds abstract nouns from many Latinate stems." },
      ],
    },
  },
  {
    id: "sfx-al",
    label: "National",
    tier: "tier2",
    focusMorpheme: "-al",
    bracket: "[nation + -al]",
    note: "<strong>Exit ticket:</strong> Use <em>national</em> in a sentence as an adjective describing something tied to a whole country.",
    tree: {
      text: "national",
      gloss: "adjective: of a nation",
      children: [
        { text: "nation", gloss: "noun stem: country / people", morphemeKey: "lex:nation", children: [] },
        { text: "-al", gloss: "suffix: relating to", morphemeKey: "sfx:-al", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-al</strong> frequently makes adjectives meaning “related to ___.” Here it turns <em>nation</em> into “about a nation.” You’ll see the same ending on many school-book adjectives (<em>cultural, logical</em>).",
      etymology: [
        { segment: "nation", origin: "Core noun." },
        { segment: "-al", origin: '“Pertaining to”—compare other <strong>-al</strong> adjectives you know.' },
      ],
    },
  },
  {
    id: "sfx-y",
    label: "Cloudy",
    tier: "tier1",
    focusMorpheme: "-y (adjective ‘full of / like’)",
    bracket: "[cloud + -y]",
    note: "<strong>Exit ticket:</strong> What does <strong>-y</strong> add to the noun <em>cloud</em> here—not plural <strong>-ies</strong>, but adjective meaning?",
    tree: {
      text: "cloudy",
      gloss: "adjective: full of clouds; gray sky",
      children: [
        { text: "cloud", gloss: "noun stem", morphemeKey: "lex:cloud", children: [] },
        { text: "-y", gloss: "suffix: having / like / characterized by", morphemeKey: "sfx:-y", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> This <strong>-y</strong> builds an adjective from a noun: “cloud-like / having clouds.” Don’t mix this up with plural spellings like <em>clouds</em>—grammar and pronunciation tell them apart.",
      tense: "Adjective—compare noun <em>cloud</em> vs adjective <em>cloudy</em>.",
    },
  },
  {
    id: "sfx-ness",
    label: "Happiness",
    tier: "tier2",
    focusMorpheme: "-ness",
    bracket: "[[happy → happi] + -ness]",
    note: "<strong>Exit ticket:</strong> Why does the vowel spelling shift before <strong>-ness</strong> (<em>happy → happiness</em>)?",
    tree: {
      text: "happiness",
      gloss: "noun: state of being happy",
      children: [
        {
          text: "happy",
          gloss: "adjective stem (spelling adjusts)",
          morphemeKey: "lex:happy",
          children: [],
        },
        { text: "-ness", gloss: "suffix: state or quality noun", morphemeKey: "sfx:-ness", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-ness</strong> turns many adjectives into abstract nouns naming a state or quality: “being ___.” English often shortens or adjusts the last consonants/vowels of the adjective first (<em>happy → happi-</em>)—that bump is a spelling pattern worth collecting, not guessing randomly.",
      spelling: [
        {
          from: "happy",
          to: "happi-",
          note: "The <strong>y</strong> drops before vowel-initial <strong>-ness</strong>—similar idea to other suffix joins.",
        },
      ],
    },
  },
  {
    id: "sfx-ment",
    label: "Movement",
    tier: "tier2",
    focusMorpheme: "-ment",
    bracket: "[move + -ment]",
    note: "<strong>Exit ticket:</strong> Name another <strong>-ment</strong> noun built from a verb you use in science class.",
    tree: {
      text: "movement",
      gloss: "noun: act of moving",
      children: [
        { text: "move", gloss: "verb stem", morphemeKey: "lex:move", children: [] },
        { text: "-ment", gloss: "suffix: result/process noun", morphemeKey: "sfx:-ment", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-ment</strong> builds nouns—often “the result or process of ___ing.” Compare verb <em>move</em> with noun <em>movement</em>. You’ll meet this suffix constantly in history and science readings.",
      etymology: [
        { segment: "move", origin: "Verb stem." },
        { segment: "-ment", origin: 'Nominalizing suffix—pairs with many Latinate verb bases.' },
      ],
    },
  },
  {
    id: "sfx-able-ible",
    label: "Readable",
    tier: "tier2",
    focusMorpheme: "-able / -ible",
    bracket: "[read + -able]",
    note: "<strong>Exit ticket:</strong> Say <em>readable</em> in plain kid English (“can be ___ed”). Then try <em>visible</em>: same suffix job with a Latinate stem.",
    tree: {
      text: "readable",
      gloss: "adjective: able to be read",
      children: [
        { text: "read", gloss: "verb stem", morphemeKey: "lex:read", children: [] },
        { text: "-able", gloss: "suffix: able to be ___ed", morphemeKey: "sfx:-able", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-able</strong> (and its cousin <strong>-ible</strong> after certain stems) builds adjectives meaning “can be ___ed” or “worthy of being ___ed.” Same logic behind <em>visible</em>, even when the stem isn’t an everyday English verb by itself.",
      formation: "Teachable rule of thumb: if you can paraphrase with “can be …,” you’re probably in <strong>-able / -ible</strong> territory.",
    },
  },
  {
    id: "sfx-ful",
    label: "Careful",
    tier: "tier1",
    focusMorpheme: "-ful",
    bracket: "[care + -ful]",
    note: "<strong>Exit ticket:</strong> Pair <strong>-ful</strong> with <strong>-less</strong>: what’s the difference between <em>hopeful</em> and <em>hopeless</em>?",
    tree: {
      text: "careful",
      gloss: "adjective: full of care; cautious",
      children: [
        { text: "care", gloss: "noun/verb stem", morphemeKey: "lex:care", children: [] },
        { text: "-ful", gloss: "suffix: full of; having", morphemeKey: "sfx:-ful", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-ful</strong> makes adjectives meaning “full of” or “having.” It clarifies tone—<em>careful</em> is “having care,” not “without care.”",
      etymology: [
        { segment: "care", origin: "Core meaning: attention / concern." },
        { segment: "-ful", origin: '“Full of” — opposite vibe from <strong>-less</strong> in many pairs.' },
      ],
    },
  },
  {
    id: "sfx-less",
    label: "Hopeless",
    tier: "tier2",
    focusMorpheme: "-less",
    bracket: "[hope + -less]",
    note: "<strong>Exit ticket:</strong> Explain <em>hopeless</em> without using “less”—what does it say about hope?",
    tree: {
      text: "hopeless",
      gloss: "adjective: without hope",
      children: [
        { text: "hope", gloss: "noun/verb stem", morphemeKey: "lex:hope", children: [] },
        { text: "-less", gloss: "suffix: without", morphemeKey: "sfx:-less", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-less</strong> builds “without ___.” Contrast with <strong>-ful</strong> on the same base when possible (<em>hopeful / hopeless</em>)—meaning flips in a teachable way.",
      tense: "Adjective describing a state or outlook.",
    },
  },

  // --- Prefixes ---
  {
    id: "pfx-un",
    label: "Unhappy",
    tier: "tier1",
    focusMorpheme: "un-",
    bracket: "[un- + happy]",
    note: "<strong>Exit ticket:</strong> Why is <em>unhappy</em> usually taught with native Germanic bases, while “not + Latin stem” often uses <strong>in- / im-</strong> instead?",
    tree: {
      text: "unhappy",
      gloss: "adjective: not happy",
      children: [
        { text: "un-", gloss: "prefix: not; reverse", morphemeKey: "pfx:un-", children: [] },
        { text: "happy", gloss: "adjective: glad", morphemeKey: "lex:happy", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>un-</strong> often negates or reverses short, everyday bases (<em>unfair, unzip</em>). It’s a different “not” family than Latinate <strong>in-</strong>, but the reading strategy is similar: strip the prefix and read the base.",
      etymology: [{ segment: "un-", origin: 'Negation / reversal—listen for bases that feel like everyday English.' }],
    },
  },
  {
    id: "pfx-re",
    label: "Reuse",
    tier: "tier1",
    focusMorpheme: "re-",
    bracket: "[re- + use]",
    note: "<strong>Exit ticket:</strong> When does <strong>re-</strong> mean “again,” and when does it feel more like “back” (<em>return, reflect</em>)?",
    tree: {
      text: "reuse",
      gloss: "verb: use again",
      children: [
        { text: "re-", gloss: "prefix: again; back", morphemeKey: "pfx:re-", children: [] },
        { text: "use", gloss: "verb: employ", morphemeKey: "lex:use", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>re-</strong> usually signals repetition or doing something back/again—reading science and history, you’ll see it constantly on verbs (<em>rebuild, review</em>).",
      etymology: [
        { segment: "re-", origin: "Again / back—exact nuance comes from the base verb." },
        { segment: "use", origin: "Free morpheme base." },
      ],
    },
  },
  {
    id: "pfx-in-not",
    label: "Invisible",
    tier: "tier2",
    focusMorpheme: "in-, im-, il-, ir- (not)",
    bracket: "[in- + vis + -ible]",
    note: "<strong>Exit ticket:</strong> Match the assimilated prefix to the first letter of the base in <em>illegal, impossible, irregular</em>.",
    tree: {
      text: "invisible",
      gloss: "adjective: cannot be seen",
      children: [
        { text: "in-", gloss: "prefix: not (here, before vowel)", morphemeKey: "pfx:in-", children: [] },
        { text: "vis", gloss: "stem: see", morphemeKey: "root:vis", children: [] },
        { text: "-ible", gloss: "suffix: able to be ___ed", morphemeKey: "sfx:-ible", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> This is the “not” family of <strong>in-</strong> (with spellings <strong>im-, il-, ir-</strong> to match the next consonant). It negates what the base says—here, “not visible.”",
      formation: "Compare to separate lesson on <strong>in-</strong> meaning “in / on / toward” — spelling overlaps, meaning differs; context decides.",
    },
  },
  {
    id: "pfx-dis",
    label: "Disconnect",
    tier: "tier2",
    focusMorpheme: "dis- / dif-",
    bracket: "[dis- + connect]",
    note: "<strong>Exit ticket:</strong> Find a word where the Latin prefix surfaces as <strong>dif-</strong> (difference family) and say what the base means.",
    tree: {
      text: "disconnect",
      gloss: "verb: undo a connection",
      children: [
        { text: "dis-", gloss: "prefix: apart; negate; reverse", morphemeKey: "pfx:dis-", children: [] },
        { text: "connect", gloss: "verb: join", morphemeKey: "lex:connect", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>dis-</strong> often marks reversal or separation (<em>disagree, disappear</em>). The <strong>dif-</strong> shape shows up before <strong>f</strong> in some Latin builds (<em>different, difficulty</em>)—same broad family of “apart / not.”",
      etymology: [{ segment: "dis-", origin: "Apart / negation / undoing—sense depends on the base verb." }],
    },
  },
  {
    id: "pfx-non",
    label: "Nonsense",
    tier: "tier2",
    focusMorpheme: "non-",
    bracket: "[non- + sense]",
    note: "<strong>Exit ticket:</strong> How is <strong>non-</strong> different from <strong>un-</strong> in tone—scientific labels (<em>nonfiction</em>) vs everyday negation?",
    tree: {
      text: "nonsense",
      gloss: "noun: something absurd; not sensible",
      children: [
        { text: "non-", gloss: "prefix: not", morphemeKey: "pfx:non-", children: [] },
        { text: "sense", gloss: "noun: meaning; feeling", morphemeKey: "lex:sense", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>non-</strong> builds “not / other than” on nouns and adjectives—common in school genres (<em>nonfiction, nonprofit</em>). It often feels more technical than everyday <strong>un-</strong>.",
      tense: "Here <em>nonsense</em> is a noun naming “no-meaning talk.”",
    },
  },
  {
    id: "pfx-in-toward",
    label: "Import",
    tier: "tier2",
    focusMorpheme: "in-, im- (in / on / toward)",
    bracket: "[im- + port]",
    note: "<strong>Exit ticket:</strong> Contrast “not” <strong>in-</strong> with this “in/into” sense—what does <em>import</em> literally suggest about movement?",
    tree: {
      text: "import",
      gloss: "verb/noun: bring in (goods or ideas)",
      children: [
        { text: "im-", gloss: "prefix: in; into (assimilated before p)", morphemeKey: "pfx:in-toward", children: [] },
        { text: "port", gloss: "stem: carry", morphemeKey: "root:port", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> This is the “into / toward” family—not negation. <strong>Import</strong> is literally “carry in.” Same letters as negation <strong>in-</strong> in other words, so you must read base meaning + context.",
      formation: "Keep two mental boxes: <strong>in- = not</strong> vs <strong>in- = in/into</strong> — spelling alone won’t separate them.",
    },
  },
  {
    id: "pfx-over",
    label: "Overlook",
    tier: "tier1",
    focusMorpheme: "over-",
    bracket: "[over + look]",
    note: "<strong>Exit ticket:</strong> <em>Overlook</em> can mean “look down on from above” or “fail to notice”—how does context pick the meaning?",
    tree: {
      text: "overlook",
      gloss: "verb: look over; miss seeing",
      children: [
        { text: "over", gloss: "prefix: above; too much", morphemeKey: "pfx:over-", children: [] },
        { text: "look", gloss: "verb: see", morphemeKey: "lex:look", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Over-</strong> can be literal “above” (<em>overhead</em>) or “too much / excess” (<em>overreact</em>). That’s why some <strong>over-</strong> words have two plausible readings until context pins them down.",
      tense: "Verb—pay attention to idiomatic meanings in reading class.",
    },
  },
  {
    id: "pfx-mis",
    label: "Misunderstand",
    tier: "tier2",
    focusMorpheme: "mis-",
    bracket: "[mis- + understand]",
    note: "<strong>Exit ticket:</strong> Build another <strong>mis-</strong> word and say what went wrong in the meaning (“badly / wrongly”).",
    tree: {
      text: "misunderstand",
      gloss: "verb: understand wrongly",
      children: [
        { text: "mis-", gloss: "prefix: wrongly; badly", morphemeKey: "pfx:mis-", children: [] },
        { text: "understand", gloss: "verb: grasp meaning", morphemeKey: "lex:understand", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Mis-</strong> marks error or bad execution (<em>misprint, mislead</em>). It’s not “not” exactly—it’s “wrongly.”",
      etymology: [{ segment: "mis-", origin: "Wrong / astray—pairs well with classroom talk about misconceptions." }],
    },
  },
  {
    id: "pfx-sub",
    label: "Subway",
    tier: "tier1",
    focusMorpheme: "sub-",
    bracket: "[sub- + way]",
    note: "<strong>Exit ticket:</strong> Where do you find another <strong>sub-</strong> word that means “under” literally (<em>submarine</em>)?",
    tree: {
      text: "subway",
      gloss: "noun: underground train route",
      children: [
        { text: "sub-", gloss: "prefix: under; below", morphemeKey: "pfx:sub-", children: [] },
        { text: "way", gloss: "noun: path", morphemeKey: "lex:way", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Sub-</strong> usually signals “under” or “below rank” (<em>subtract, submarine</em>). In compounds like <em>subway</em>, it tightens what kind of route it is.",
      embedded: [
        { text: "sub-", note: "Think physically under or hierarchically below." },
        { text: "way", note: "Head noun: path or route." },
      ],
    },
  },
  {
    id: "pfx-pre",
    label: "Preview",
    tier: "tier2",
    focusMorpheme: "pre-",
    bracket: "[pre- + view]",
    note: "<strong>Exit ticket:</strong> Name something you <em>preview</em> before a test or trip.",
    tree: {
      text: "preview",
      gloss: "noun/verb: look beforehand",
      children: [
        { text: "pre-", gloss: "prefix: before", morphemeKey: "pfx:pre-", children: [] },
        { text: "view", gloss: "see", morphemeKey: "lex:view", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Pre-</strong> sets time early—before the main event (<em>predict, prepare</em>). Pair it mentally with <strong>post-</strong> (“after”) when you meet opposites in texts.",
      etymology: [
        { segment: "pre-", origin: "Before — time/order prefix." },
        { segment: "view", origin: "See / look." },
      ],
    },
  },
  {
    id: "pfx-inter",
    label: "International",
    tier: "tier2",
    focusMorpheme: "inter-",
    bracket: "[inter + nation + -al]",
    note: "<strong>Exit ticket:</strong> What does <strong>inter-</strong> add compared to plain <em>national</em>?",
    tree: {
      text: "international",
      gloss: "adjective: between nations; worldwide",
      children: [
        { text: "inter-", gloss: "prefix: between; among", morphemeKey: "pfx:inter-", children: [] },
        {
          text: "-al",
          gloss: "suffix: relating to",
          morphemeKey: "sfx:-al",
          children: [{ text: "nation", gloss: "people/country stem", morphemeKey: "lex:nation", children: [] }],
        },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Inter-</strong> signals “between / among” (<em>interact, intersect</em>). Here it widens <em>national</em> to cross-border relations.",
      formation: "Nested layers: nation → national → international — each suffix wraps the bigger bundle.",
    },
  },
  {
    id: "pfx-fore",
    label: "Forecast",
    tier: "tier2",
    focusMorpheme: "fore-",
    bracket: "[fore- + cast]",
    note: "<strong>Exit ticket:</strong> Connect <strong>fore-</strong> to everyday “before” words (<em>before, forward</em>).",
    tree: {
      text: "forecast",
      gloss: "verb/noun: predict (weather, outcomes)",
      children: [
        { text: "fore-", gloss: "prefix: before; ahead", morphemeKey: "pfx:fore-", children: [] },
        { text: "cast", gloss: "stem: throw / arrange", morphemeKey: "lex:cast", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Fore-</strong> points ahead in time or position (<em>foreshadow, forward</em>). <em>Forecast</em> is “throw/cast the outcome ahead of time” in a metaphor English keeps alive in weather talk.",
      tense: "Can be verb or noun depending on sentence.",
    },
  },
  {
    id: "pfx-de",
    label: "Decode",
    tier: "tier2",
    focusMorpheme: "de-",
    bracket: "[de- + code]",
    note: "<strong>Exit ticket:</strong> When does <strong>de-</strong> mean “remove / reverse” vs “down / away”? Compare <em>decode</em> and <em>deflate</em>.",
    tree: {
      text: "decode",
      gloss: "verb: undo coding; figure out",
      children: [
        { text: "de-", gloss: "prefix: reverse; down", morphemeKey: "pfx:de-", children: [] },
        { text: "code", gloss: "noun/verb: cipher; system", morphemeKey: "lex:code", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>De-</strong> often reverses an action or pulls something “off/down” (<em>defrost, deactivate</em>). In reading class, <em>decode</em> names the flip side of <em>encode</em>.",
      etymology: [{ segment: "de-", origin: "Reversal / removal — sense depends on the base." }],
    },
  },
  {
    id: "pfx-trans",
    label: "Transport",
    tier: "tier2",
    focusMorpheme: "trans-",
    bracket: "[trans- + port]",
    note: "<strong>Exit ticket:</strong> List two other <strong>trans-</strong> words that mean “across” in science or social studies.",
    tree: {
      text: "transport",
      gloss: "verb/noun: carry across",
      children: [
        { text: "trans-", gloss: "prefix: across; through", morphemeKey: "pfx:trans-", children: [] },
        { text: "port", gloss: "stem: carry", morphemeKey: "root:port", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Trans-</strong> marks crossing—space (<em>transport</em>), boundaries (<em>translate</em>), or states (<em>transform</em>). The stable anchor is “movement across.”",
      etymology: [
        { segment: "trans-", origin: "Across / through." },
        { segment: "port", origin: 'Carry — same root thread as <em>import, portable</em>.' },
      ],
    },
  },
  {
    id: "pfx-anti",
    label: "Antifreeze",
    tier: "tier2",
    focusMorpheme: "anti-",
    bracket: "[anti- + freeze]",
    note: "<strong>Exit ticket:</strong> How does <strong>anti-</strong> differ from <strong>non-</strong> in attitude (<em>antivirus</em> vs <em>nonstick</em>)?",
    tree: {
      text: "antifreeze",
      gloss: "noun: chemical that lowers freezing point",
      children: [
        { text: "anti-", gloss: "prefix: against", morphemeKey: "pfx:anti-", children: [] },
        { text: "freeze", gloss: "verb stem: turn to ice", morphemeKey: "lex:freeze", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Anti-</strong> sets up opposition—against a thing or process (<em>antibiotic, anticlockwise</em>). In compounds it tightens what kind of substance or force you mean.",
      tense: "Noun in science/chemistry contexts; stress pattern helps listening comprehension.",
    },
  },
  {
    id: "pfx-mid",
    label: "Midnight",
    tier: "tier1",
    focusMorpheme: "mid-",
    bracket: "[mid- + night]",
    note: "<strong>Exit ticket:</strong> Why is <em>midnight</em> “the middle of the night” but clock time can disagree with astronomy?",
    tree: {
      text: "midnight",
      gloss: "noun: middle of the night; 12:00 a.m.",
      children: [
        { text: "mid-", gloss: "prefix: middle", morphemeKey: "pfx:mid-", children: [] },
        { text: "night", gloss: "noun: night time", morphemeKey: "lex:night", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Mid-</strong> picks the middle of something (<em>midday, midterm</em>). Transparent compounds help spelling—you hear both chunks.",
      embedded: [
        { text: "mid-", note: "Locates you halfway through the named span." },
        { text: "night", note: "Head noun naming the span." },
      ],
    },
  },
  {
    id: "pfx-con",
    label: "Connect",
    tier: "tier2",
    focusMorpheme: "con-",
    bracket: "[con- + nect]",
    note: "<strong>Exit ticket:</strong> What does “with / together” add to the stem in <em>connect</em> compared to <em>nect</em> alone (not a standalone English word)?",
    tree: {
      text: "connect",
      gloss: "verb: join together",
      children: [
        { text: "con-", gloss: "prefix: with; together", morphemeKey: "pfx:con-", children: [] },
        { text: "nect", gloss: "stem: bind", morphemeKey: "root:nect", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Con-</strong> (also <strong>com-, col-, cor-</strong> before certain letters) often means “with” or “together.” Here it names joining with something else.",
      formation: "Assimilated spelling matches the next consonant—same prefix family, easier pronunciation.",
    },
  },
  {
    id: "pfx-ad",
    label: "Advance",
    tier: "tier2",
    focusMorpheme: "ad-",
    bracket: "[ad- + vance]",
    note: "<strong>Exit ticket:</strong> Where else do you see <strong>ad-</strong> shortened or assimilated (<em>approach, assign</em>)?",
    tree: {
      text: "advance",
      gloss: "verb/noun: move forward",
      children: [
        { text: "ad-", gloss: "prefix: to; toward", morphemeKey: "pfx:ad-", children: [] },
        { text: "vance", gloss: "stem: go before", morphemeKey: "root:vanc", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> Latin <strong>ad-</strong> often means “to / toward,” with spellings like <strong>ac-, af-, al-</strong> before certain letters. In school texts it shows up on formal verbs (<em>adhere, attract</em>).",
      tense: "Verb/noun shift—sentence role matters.",
    },
  },
  {
    id: "pfx-ex",
    label: "Exit",
    tier: "tier1",
    focusMorpheme: "ex-, e-, ef-",
    bracket: "[ex- + it]",
    note: "<strong>Exit ticket:</strong> Find <strong>eject</strong> or <strong>efface</strong> and explain how the prefix shortened before the stem.",
    tree: {
      text: "exit",
      gloss: "noun/verb: way out; leave",
      children: [
        { text: "ex-", gloss: "prefix: out", morphemeKey: "pfx:ex-", children: [] },
        { text: "it", gloss: "stem: go", morphemeKey: "root:it-go", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Ex-</strong> (and shapes like <strong>e-, ef-</strong>) often marks “out” or “former” (<em>exit, exclude</em>). Pair it mentally with <strong>ad-/in-</strong> “toward/in” when you contrast words.",
      etymology: [{ segment: "ex-", origin: "Out — leaving or outside position." }],
    },
  },

  // --- Roots ---
  {
    id: "root-form",
    label: "Inform",
    tier: "tier2",
    focusMorpheme: "form",
    bracket: "[in- + form]",
    note: "<strong>Exit ticket:</strong> List another word where <strong>form</strong> means “shape” (<em>transform, uniform</em>).",
    tree: {
      text: "inform",
      gloss: "verb: tell; shape knowledge",
      children: [
        { text: "in-", gloss: "prefix: in; into", morphemeKey: "pfx:in-toward", children: [] },
        { text: "form", gloss: "stem: shape", morphemeKey: "root:form", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> The bound stem <strong>form</strong> carries “shape.” Here the metaphor is “put shape into someone’s mind”—tell them. Related words reuse the same stem (<em>transform, reform</em>).",
      etymology: [{ segment: "form", origin: "Shape / structure — not usually a free morpheme in these Latinate builds." }],
    },
  },
  {
    id: "root-port",
    label: "Export",
    tier: "tier2",
    focusMorpheme: "port (carry)",
    bracket: "[ex- + port]",
    note: "<strong>Exit ticket:</strong> Compare <em>import</em> and <em>export</em> using “carry in/out.”",
    tree: {
      text: "export",
      gloss: "verb/noun: send goods out",
      children: [
        { text: "ex-", gloss: "prefix: out", morphemeKey: "pfx:ex-", children: [] },
        { text: "port", gloss: "stem: carry", morphemeKey: "root:port", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>port</strong> = carry. Economics and geography reuse it constantly (<em>import, portable, transport</em>). Spotting it speeds decoding of long textbook words.",
      etymology: [{ segment: "port", origin: 'Carry — stable meaning across many compounds.' }],
    },
  },
  {
    id: "root-rupt",
    label: "Interrupt",
    tier: "tier2",
    focusMorpheme: "rupt (break)",
    bracket: "[inter + rupt]",
    note: "<strong>Exit ticket:</strong> What does <em>corrupt</em> mean if <strong>rupt</strong> is “break”?",
    tree: {
      text: "interrupt",
      gloss: "verb: break into; stop flow",
      children: [
        { text: "inter-", gloss: "between", morphemeKey: "pfx:inter-", children: [] },
        { text: "rupt", gloss: "stem: break", morphemeKey: "root:rupt", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Rupt</strong> signals breaking—same stem as <em>erupt, corrupt</em>. <em>Interrupt</em> is “break between” someone’s speech or focus.",
      etymology: [{ segment: "rupt", origin: "Break / burst." }],
    },
  },
  {
    id: "root-tract",
    label: "Attract",
    tier: "tier2",
    focusMorpheme: "tract (draw, pull)",
    bracket: "[at- + tract]",
    note: "<strong>Exit ticket:</strong> Where else do you see <strong>tract</strong> meaning pull (<em>tractor, traction</em>)?",
    tree: {
      text: "attract",
      gloss: "verb: draw toward",
      children: [
        { text: "at-", gloss: "prefix: to (assimilated ad-)", morphemeKey: "pfx:ad-", children: [] },
        { text: "tract", gloss: "stem: draw", morphemeKey: "root:tract", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Tract</strong> = draw/pull. Physical and metaphor uses overlap (<em>attract attention</em>). Hook this stem to machinery words (<em>tractor</em>) for memory.",
      etymology: [{ segment: "tract", origin: "Draw / drag." }],
    },
  },
  {
    id: "root-scrib",
    label: "Describe",
    tier: "tier2",
    focusMorpheme: "scrib / script (write)",
    bracket: "[de- + scrib + -e]",
    note: "<strong>Exit ticket:</strong> Link <em>description</em> and <em>manuscript</em> to writing meanings.",
    tree: {
      text: "describe",
      gloss: "verb: write/tell about",
      children: [
        { text: "de-", gloss: "prefix: down", morphemeKey: "pfx:de-", children: [] },
        { text: "scrib", gloss: "stem: write", morphemeKey: "root:scrib", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> The scrib/script family names writing—<em>describe</em> literally “writes down” what something is like. Related nouns use <strong>-tion</strong> (<em>description</em>).",
      tense: "Verb — classroom staple for evidence-based writing.",
    },
  },
  {
    id: "root-spect",
    label: "Inspect",
    tier: "tier2",
    focusMorpheme: "spect / spec / spic (look)",
    bracket: "[in- + spect]",
    note: "<strong>Exit ticket:</strong> Collect three words that mean “looking” with this root (<em>spectator, suspicious</em>).",
    tree: {
      text: "inspect",
      gloss: "verb: look into; examine",
      children: [
        { text: "in-", gloss: "prefix: into", morphemeKey: "pfx:in-toward", children: [] },
        { text: "spect", gloss: "stem: look", morphemeKey: "root:spect", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Spect/spec</strong> = look/watch—same spine as <em>spectacle, suspicious, perspective</em>. Prefix tells you how the looking aims.",
      etymology: [{ segment: "spect", origin: "Look / see." }],
    },
  },
  {
    id: "root-struct",
    label: "Construct",
    tier: "tier2",
    focusMorpheme: "struct / stru (build)",
    bracket: "[con- + struct]",
    note: "<strong>Exit ticket:</strong> What noun names the building process (<em>construction</em>)?",
    tree: {
      text: "construct",
      gloss: "verb: build together",
      children: [
        { text: "con-", gloss: "together", morphemeKey: "pfx:con-", children: [] },
        { text: "struct", gloss: "stem: build", morphemeKey: "root:struct", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Struct/stru</strong> names building—think structure, instruct, destroy (literally “un-build”). Science and history readings pile these words together.",
      etymology: [{ segment: "struct", origin: "Build / pile." }],
    },
  },
  {
    id: "root-dict",
    label: "Verdict",
    tier: "tier3",
    focusMorpheme: "dict / dic (say, speak)",
    bracket: "[ver + dict]",
    note: "<strong>Exit ticket:</strong> Connect <em>dictionary</em> and <em>predict</em> to “say.”",
    tree: {
      text: "verdict",
      gloss: "noun: spoken judgment",
      children: [
        { text: "ver", gloss: "stem: truth", morphemeKey: "root:ver", children: [] },
        { text: "dict", gloss: "stem: say", morphemeKey: "root:dict", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Dict</strong> carries “say/tell”—dictionary (sayings of words), verdict (true saying). Pair with prefixes to steer meaning (<em>predict = say beforehand</em>).",
      tense: "Legal/civic contexts often—tier lifts because of register.",
    },
  },
  {
    id: "root-fer",
    label: "Refer",
    tier: "tier2",
    focusMorpheme: "fer (carry, bear)",
    bracket: "[re- + fer]",
    note: "<strong>Exit ticket:</strong> How does <em>refer</em> connect to carrying an idea “back” to something?",
    tree: {
      text: "refer",
      gloss: "verb: point back to; mention",
      children: [
        { text: "re-", gloss: "again; back", morphemeKey: "pfx:re-", children: [] },
        { text: "fer", gloss: "stem: carry", morphemeKey: "root:fer", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Fer</strong> carries/bears—same spine as <em>transfer, fertile</em>. <em>Refer</em> is “carry attention back” to a source.",
      etymology: [{ segment: "fer", origin: "Carry / bear." }],
    },
  },
  {
    id: "root-mit",
    label: "Transmit",
    tier: "tier2",
    focusMorpheme: "mit / miss (send)",
    bracket: "[trans- + mit]",
    note: "<strong>Exit ticket:</strong> Compare <em>mission</em> (something sent) with <em>submit</em> (send under).",
    tree: {
      text: "transmit",
      gloss: "verb: send across",
      children: [
        { text: "trans-", gloss: "across", morphemeKey: "pfx:trans-", children: [] },
        { text: "mit", gloss: "stem: send", morphemeKey: "root:mit", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Mit/miss</strong> = send—think mission, missile, submit. Science words reuse it for signals (<em>transmit light</em>).",
      etymology: [{ segment: "mit", origin: "Send." }],
    },
  },
  {
    id: "root-duct",
    label: "Conduct",
    tier: "tier2",
    focusMorpheme: "duct / duc / duce (lead)",
    bracket: "[con- + duct]",
    note: "<strong>Exit ticket:</strong> Where does a science teacher use <em>conduct</em> as “lead” vs “behavior”?",
    tree: {
      text: "conduct",
      gloss: "verb/noun: lead; behavior",
      children: [
        { text: "con-", gloss: "together", morphemeKey: "pfx:con-", children: [] },
        { text: "duct", gloss: "stem: lead", morphemeKey: "root:duct", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Duc/duct</strong> = lead—same spine as <em>produce, reduce</em>. Context toggles between leading electricity/music and leading oneself (behavior).",
      tense: "Noun vs verb stress differs in speech—good listening practice.",
    },
  },
  {
    id: "root-fact",
    label: "Perfect",
    tier: "tier2",
    focusMorpheme: "fact / fac / fect / fic (make, do)",
    bracket: "[per + fect]",
    note: "<strong>Exit ticket:</strong> Explain why <em>perfect</em> feels like “made all the way through.”",
    tree: {
      text: "perfect",
      gloss: "adjective: complete; flawless",
      children: [
        { text: "per-", gloss: "through; thoroughly", morphemeKey: "pfx:per-", children: [] },
        { text: "fect", gloss: "stem: make", morphemeKey: "root:fect", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Fac/fect/fic</strong> names making/doing—factory, manufacture, fiction. <em>Perfect</em> is “thoroughly made / finished.”",
      formation: "Many advanced adjectives hide this stem behind vowel shifts—collect families instead of memorizing alone.",
    },
  },
  {
    id: "root-ten",
    label: "Maintain",
    tier: "tier2",
    focusMorpheme: "ten / tain / tin (hold)",
    bracket: "[main + tain]",
    note: "<strong>Exit ticket:</strong> Link <em>contain</em>, <em>sustain</em>, and <em>tenant</em> to holding.",
    tree: {
      text: "maintain",
      gloss: "verb: keep up; hold steady",
      children: [
        { text: "main", gloss: "prefix-like first element (hand)", morphemeKey: "lex:main-hand", children: [] },
        { text: "tain", gloss: "stem: hold", morphemeKey: "root:tain", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Tain/ten/tin</strong> holds—contain, sustain, maintenance. If you know “hold,” you can hang more textbook verbs on the stem.",
      spelling: [
        {
          from: "maintain",
          to: "main + tain",
          note: "Not spelled like “main street” + random ending—the second chunk is the bound stem “hold.”",
        },
      ],
    },
  },
  {
    id: "root-vis",
    label: "Television",
    tier: "tier1",
    focusMorpheme: "vis / vid (see)",
    bracket: "[tele + vis + -ion]",
    note: "<strong>Exit ticket:</strong> Split another word with <strong>vid</strong> (<em>video, evidence</em>).",
    tree: {
      text: "television",
      gloss: "noun: far-seeing device / medium",
      children: [
        { text: "tele", gloss: "combining form: far", morphemeKey: "root:tele", children: [] },
        { text: "vis", gloss: "stem: see", morphemeKey: "root:vis", children: [] },
        { text: "-ion", gloss: "noun suffix", morphemeKey: "sfx:-tion", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Vis/vid</strong> = see—evidence, video, vision. <em>Television</em> literally “far seeing,” though etymology is more layered than the classroom shortcut.",
      tense: "Count noun in everyday speech.",
    },
  },
  {
    id: "root-cap",
    label: "Receive",
    tier: "tier2",
    focusMorpheme: "cap / ceive (take, catch)",
    bracket: "[re- + ceive]",
    note: "<strong>Exit ticket:</strong> Compare <em>accept</em> and <em>except</em>—don’t mix spellings or meanings.",
    tree: {
      text: "receive",
      gloss: "verb: take in; get",
      children: [
        { text: "re-", gloss: "back", morphemeKey: "pfx:re-", children: [] },
        { text: "ceive", gloss: "stem: take", morphemeKey: "root:ceive", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> The <strong>ceive/cept</strong> family is “take/catch”—receive, accept, except (different prefixes steer meaning). Spelling groups belong together for study cards.",
      formation: "Collect minimal pairs with different prefixes on the same stem.",
    },
  },
  {
    id: "root-sta",
    label: "Assistant",
    tier: "tier2",
    focusMorpheme: "sta / sist / stat / stit (stand)",
    bracket: "[as- + sist + -ant]",
    note: "<strong>Exit ticket:</strong> Who “stands by” to help in a classroom or lab?",
    tree: {
      text: "assistant",
      gloss: "noun: helper; person who assists",
      children: [
        { text: "as-", gloss: "prefix: to (ad-)", morphemeKey: "pfx:ad-", children: [] },
        { text: "sist", gloss: "stem: stand", morphemeKey: "root:sist", children: [] },
        { text: "-ant", gloss: "suffix: person connected to", morphemeKey: "sfx:-ant", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Sist/stat/stit</strong> stands—assist (stand to), consist, station. An <em>assistant</em> “stands by” to help.",
      tense: "Person noun—compare science roles (<em>lab assistant</em>).",
    },
  },
  {
    id: "root-pos",
    label: "Position",
    tier: "tier2",
    focusMorpheme: "pos / pon (place, put)",
    bracket: "[posit + -ion]",
    note: "<strong>Exit ticket:</strong> Connect <em>compose</em> and <em>deposit</em> to “place.”",
    tree: {
      text: "position",
      gloss: "noun: place; stance",
      children: [
        { text: "posit", gloss: "stem: place", morphemeKey: "root:posit", children: [] },
        { text: "-ion", gloss: "noun suffix", morphemeKey: "sfx:-tion", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Pon/pos/posit</strong> places things—position, compose (place together), opposition (place against). Social studies and science reuse this stem.",
      etymology: [{ segment: "posit", origin: "Place / put — bound stem inside many classroom words." }],
    },
  },
  {
    id: "root-plic",
    label: "Apply",
    tier: "tier2",
    focusMorpheme: "plic / ply (fold, bend)",
    bracket: "[ap- + ply]",
    note: "<strong>Exit ticket:</strong> What’s folded toward what in <em>application</em> (idea → form)?",
    tree: {
      text: "apply",
      gloss: "verb: put on; request; use",
      children: [
        { text: "ap-", gloss: "to (ad-)", morphemeKey: "pfx:ad-", children: [] },
        { text: "ply", gloss: "stem: fold", morphemeKey: "root:ply", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>Plic/ply</strong> folds—apply (fold toward), complicated (folded together). Abstract but high payoff once students collect the family.",
      tense: "Verb with several sentence frames—reading class uses ‘apply evidence.’",
    },
  },

  // --- Greek combining forms ---
  {
    id: "gcf-graph",
    label: "Biography",
    tier: "tier2",
    focusMorpheme: "graph / gram (write, draw)",
    bracket: "[bio + graph + -y]",
    note: "<strong>Exit ticket:</strong> Find another <strong>graph</strong> word in math or science class (<em>paragraph, photograph</em>).",
    tree: {
      text: "biography",
      gloss: "noun: written life story",
      children: [
        { text: "bio", gloss: "combining: life", morphemeKey: "root:bio", children: [] },
        { text: "graph", gloss: "combining: write", morphemeKey: "root:graph", children: [] },
        { text: "-y", gloss: "noun ending (abstract noun)", morphemeKey: "sfx:-y-noun", children: [] },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> Greek <strong>graph/gram</strong> writes or records—photograph, grammar, diagram. <em>Biography</em> writes a life.",
      tense: "Abstract noun—common in history/ELA.",
    },
  },
  {
    id: "gcf-logy",
    label: "Biology",
    tier: "tier2",
    focusMorpheme: "logy (study of)",
    bracket: "[bio + -logy]",
    note: "<strong>Exit ticket:</strong> Name two school subjects ending in <strong>-ology</strong>.",
    tree: {
      text: "biology",
      gloss: "noun: study of life",
      children: [
        {
          text: "-logy",
          gloss: "suffix: study of",
          morphemeKey: "sfx:-logy",
          children: [{ text: "bio", gloss: "life", morphemeKey: "root:bio", children: [] }],
        },
      ],
    },
    deep: {
      summary:
        "<strong>What you learn:</strong> <strong>-logy</strong> names a discipline—literally “words/study of ___.” Science courses stack these (<em>geology, psychology</em>).",
      etymology: [
        { segment: "bio", origin: "Life." },
        { segment: "-logy", origin: "Study / science of — recognizable ending on course titles." },
      ],
    },
  },
]);

const _positions = morphRingPositions(_MORPHOLOGY_WORDS_RAW.length);
export const MORPHOLOGY_WORD_LIST = _MORPHOLOGY_WORDS_RAW.map((w, i) => ({
  ...w,
  position: /** @type {[number, number, number]} */ (_positions[i]),
}));

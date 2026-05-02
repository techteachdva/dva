/**
 * Mini-lessons for Morphology Garden — written for grades 6–10 and demo teaching from a panel or smart board.
 * Tone: rigorous ideas, plain words, hooks first (Visual Thesaurus–style branching, minus their proprietary UX).
 * @typedef {{ segment: string, origin?: string, note?: string }} EtymoPart
 */

/** Short crib for recurring affixes / suffixes referenced in lesson bullets. */
export const AFFIX_ORIGIN_HINT = {
  "pfx:in-":
    '<strong>in-</strong> (often <strong>im-, il-, ir-</strong>): “not / without”—spelling swaps to kiss the next consonant (<em>illegal, impossible, irregular</em>).',
  "pfx:re-": '<strong>re-</strong>: “again” or “back / against”—hear it in <em>rewrite, rethink, resist</em>.',
  "pfx:un-": '<strong>un-</strong>: “undo” or “not”—likes Germanic stems (<em>unhappy, unzip</em>). Different flavor from Latin-ish <strong>in-</strong>.',
  "pfx:de-": '<strong>de-</strong>: often “reverse, remove, down”—shows up on school-book verbs and nouns alike.',
  "pfx:pre-": '<strong>pre-</strong>: “before” (<em>preset, preview, predict</em>).',
  "pfx:trans-": '<strong>trans-</strong>: “across, through”—think <em>translate, transplant</em>.',
  "sfx:-tion":
    '<strong>-tion / -ation</strong>: noun jacket for “act, outcome, thing that happens”—stacks onto stems that already behaved like verbs.',
  "sfx:-ation": '<strong>-ation</strong>: same family as <strong>-tion</strong>; very productive in textbook English.',
  "sfx:-ment": '<strong>-ment</strong>: turns verbs into nouns—“result of ___ing” (<em>development</em>).',
  "sfx:-al": '<strong>-al</strong>: “relating to” (<em>nation → national</em>).',
  "sfx:-ous": '<strong>-ous</strong>: “full of / tending to”—adjective maker (<em>dangerous</em>).',
  "sfx:-able": '<strong>-able</strong>: “capable of being ___ed”—hear echoes of “able” inside the word (<em>breakable</em>).',
  "sfx:-ize": '<strong>-ize</strong>: verb maker—“cause to become / treat like” (<em>hospital → hospitalize</em>).',
  "sfx:-ity": '<strong>-ity</strong>: abstract noun jacket on adjectives (<em>sincere → sincerity</em>).',
  "sfx:-er": '<strong>-er</strong>: either “comparison” (<em>bigger</em>) or “doer thing” (<em>teacher</em>)—students learn to infer from grammar.',
  "sfx:-ful": '<strong>-ful</strong>: “full of / tending toward” (<em>playful</em>).',
  "sfx:-less": '<strong>-less</strong>: Germanic chip meaning “without” (<em>hopeless</em>).',
  "sfx:-dom":
    '<strong>-dom</strong>: state or realm—turns nouns/adjectives into “condition / territory” nouns (<em>freedom, kingdom</em>).',
};

/**
 * @type {Record<string, { summary: string, etymology?: EtymoPart[], formation?: string, tense?: string, embedded?: { text: string, note: string }[], spelling?: { from: string, to: string, note: string }[] }>}
 */
export const MORPH_DEEP_NOTES = {
  presentation: {
    summary:
      "You’re unpacking a TED-talk noun: Latin-style pieces snap together (<strong>pre- ‘before’ + sent/stem + -ation noun coat</strong>) to name showing or handing something over. Invite students to act it—<em>I’ll pre‑sent (= put before)</em> my slides.",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "sent", origin: "Bound stem—“put/feel/send” energy you also hear compressed in <em>consent, sentence</em>." },
      { segment: "-ation", origin: AFFIX_ORIGIN_HINT["sfx:-ation"] },
    ],
    tense: "<strong>Type</strong> noun. <strong>Not</strong> an -ed tense stack—students contrast with verbs they already know (“she presents”).",
  },
  hallway: {
    summary:
      "Straight-up compound (<strong>hall + way</strong>): two bricks you’d still say alone. Teach stress as one footprint, meaning as “hall-shaped path”—great on a smart board tracing each brick’s glow.",
    etymology: [
      { segment: "hall", origin: "Older English noun for broad indoor space—not fancy." },
      { segment: "way", origin: "Path/track—students already own this word." },
    ],
    embedded: [
      { text: "hall", note: "Students can chant it aloud on its own." },
      { text: "way", note: "Head noun vibes: keeps the “path-ish” noun class." },
    ],
  },
  final: {
    summary:
      "Looks short, behaves scholastic—<strong>fin-</strong> “end/limit” is glued to relational <strong>-al</strong> ‘relating to limits.’ Invite “fin-ish / fin-ish line” echo so the bound root sticks.",
    etymology: [
      { segment: "fin-", origin: "Latin ‘end/limit’ family—paired with verbs like <em>finish</em> in kid talk." },
      { segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] },
    ],
    tense: "Adjective—not the same beast as noun <em>finale</em>; talk about endings in stories/sports timers.",
  },
  sourdough: {
    summary:
      "<strong>sour</strong> + <strong>dough</strong>: kitchen vocabulary that still screams its recipe. Taste-test analogy: morphology is reading the nutritional label sideways.",
    etymology: [
      { segment: "sour", origin: "Simple adjective—they name the tang." },
      { segment: "dough", origin: "Noun—they name the goo." },
    ],
    embedded: [
      { text: "sour", note: "Open-class content word." },
      { text: "dough", note: "Head noun—you’re naming a dough-ball type." },
    ],
  },
  before: {
    summary:
      "Function-word lesson: fluent readers rarely slow down, BUT you can spotlight <strong>be-</strong> + <strong>fore</strong> ‘ahead’ exactly like peeling <em>foreshadow, forecast</em> later.",
    etymology: [
      { segment: "be-", origin: "Fossil prefix slot—paired with verbs/adverbs in clusters (<em>become</em>)." },
      { segment: "fore", origin: "‘Front / ahead’—compare <em>forehead</em> if they giggle responsibly." },
    ],
  },
  rainbow: {
    summary:
      "Compound candy: meteorology + arc geometry. Hover each bubble on board to show meanings composing—students draw their own arcs while narrating chunks.",
    etymology: [
      { segment: "rain", origin: "Water cycle vocab—everyone owns it." },
      { segment: "bow", origin: 'Curve—not the hair ribbon unless you riff on polysemy ("shoot a rainbow").' },
    ],
    embedded: [
      { text: "rain", note: "Left modifier tightening which bow." },
      { text: "bow", note: "Right-head naming the geometric family." },
    ],
  },
  inhospitable: {
    summary:
      "NEG + stem + possibility suffix: Latin-flavored negatives shift spellings (<strong>in-, il-, ir-, im-</strong>). Ask “Where’s the host?” (<em>hospit-al-ity</em>) so <strong>-able</strong> snaps on as “able to be hosted.”",
    etymology: [
      { segment: "in-", origin: AFFIX_ORIGIN_HINT["pfx:in-"] },
      { segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] },
    ],
    tense: "Adjective—pair with humane geography examples (weather vs people).",
  },
  demarcation: {
    summary:
      "Abstract civics/engineering noun: <strong>de-</strong> peels back / marks off + stem echoing borders + noun coat <strong>-ation</strong>. Smart-board move—sketch dotted lines while narrating prefixes.",
    etymology: [
      { segment: "de-", origin: AFFIX_ORIGIN_HINT["pfx:de-"] },
      { segment: "mark/marc-", origin: "Stem about marks—students know <em>mark</em> as cognate-ish cousin." },
      { segment: "-ation", origin: AFFIX_ORIGIN_HINT["sfx:-ation"] },
    ],
    spelling: [
      {
        from: "mark",
        to: "marc-",
        note: 'Latinate spine vs everyday <em>mark</em>: same ancestry, different spelling costume—celebrate predictable pattern, no shame.',
      },
    ],
  },
  dehumanization: {
    summary:
      "Dense stack ripe for pacing with arrows on board: rip away humanity (<strong>de-</strong>) verbified (<strong>-ize</strong>), then nouned (<strong>-ation</strong>) for the concept name. Emotional truth + grammatical clarity can coexist.",
    etymology: [
      { segment: "de-", origin: AFFIX_ORIGIN_HINT["pfx:de-"] },
      { segment: "-ize", origin: AFFIX_ORIGIN_HINT["sfx:-ize"] },
      { segment: "-ation", origin: AFFIX_ORIGIN_HINT["sfx:-ation"] },
    ],
    tense: "Noun labeling a process—that’s distinct from tossing <strong>-ed</strong> onto a storyline verb.",
  },
  resistance: {
    summary:
      "<strong>re- ‘back/against’ + sist ‘stand’ + -ance ‘state’</strong>—literal “standing back pushes.” History class hook: resisting policy vs resisting friction.",
    etymology: [
      { segment: "re-", origin: AFFIX_ORIGIN_HINT["pfx:re-"] },
      { segment: "sist", origin: 'Bound root—“stand”; cousin to <em>insist</em>, <em>consist</em>.' },
      { segment: "-ance", origin: 'Abstract noun cloak—students map to <strong>-tion</strong> nouns mentally.' },
    ],
  },
  revolution: {
    summary:
      "Spin + overturn energy: Latin root about rolling returns with noun coat <strong>-tion</strong>. Works for science orbit talk or civic “revolution”—same core idea of cyclic turn.",
    etymology: [
      { segment: "re-", origin: AFFIX_ORIGIN_HINT["pfx:re-"] },
      { segment: "volu", origin: 'Rolling / volume family—movement imagery helps.' },
      { segment: "-tion", origin: AFFIX_ORIGIN_HINT["sfx:-tion"] },
    ],
  },
  "unlockable-a": {
    summary:
      "Ambiguity grenade 🎓: <strong>un- scopes over lockable → ‘not capable of being locked’</strong>. Write brackets BIG on smart board—the tree already shows layering truth.",
    embedded: [{ text: "lock", note: 'Inner chunk still visible inside <em>lockable</em>.' }],
    tense: "Adjective; compare conversational paraphrases (“you can’t lock it”) vs morphology brackets.",
    formation:
      "[un [lock-able]]—the negative hugs the finished adjective, not just the naked verb stem.",
  },
  "unlockable-b": {
    summary:
      "Same letters, DIFFERENT story: outer <strong>-able</strong> latches onto the verb phrase <strong>unlock</strong> ⇒ ‘possible to unlock.’ Puzzle race: teammates defend each bracket on whiteboards.",
    tense: 'Adjective; hook: “Can you unlock it?” sentences vs “Is it unlocked-able?” clumsiness—they feel the mismatch.',
    formation: "[ [un-lock] able ] versus unlockable-A—celebrate English’s commitment to ambiguity.",
  },
  belief: {
    summary:
      "Noun partner to <strong>believe</strong>; fossil <strong>be-</strong> + bound stem—not pieced from modern freebies. Invite kids to memorize the family rhyme “i before e except seize belief weirdness…” only if science teacher approves 😉.",
    etymology: [{ segment: "be- / lief", origin: 'Ancient stem cluster—students focus on <em>cousin verbs</em> instead of brute forcing Old English trivia.' }],
  },
  believe: {
    summary:
      "Verb stem parallels <em>belief</em>; teach morphology + spelling friends together—same neighborhood, tweaked vowels.",
    tense: '<strong>Add -s / -ed / -ing</strong> outside for grammar time—derivative core stays intact.',
  },
  endure: {
    summary:
      "<strong>en- ‘in/into/make’</strong> + <strong>dure ‘hard lasting’</strong> → “stretch through toughness.” Tie to perseverance language without sounding like a pamphlet.",
    etymology: [
      { segment: "en-", origin: 'Energetic prefix—paired with verbs like <em>enable</em> elsewhere in this tray.' },
      { segment: "dure", origin: '<em>Durable</em> adjective echoes the same hardness root.' },
    ],
    tense: "Finite verb endings ride on outer edge—the inner pieces stay stable.",
  },
  enable: {
    summary:
      "Literally-ish “make able”—prefix + adjective lump that English treats as verb fuel. Classroom beat: disability rights frame vs gamer “enable cheats.” Same morphemes, humane discussion.",
    etymology: [
      { segment: "en-", origin: "<strong>En-</strong> verb forge—paired with stamina vibe in “endure/enrich/enlist.”" },
      { segment: "able", origin: "-able clan—compare <em>disable</em> for dramatic flip tone." },
    ],
    tense: "Verb—you’ll hear third-person -s regularly.",
  },
  freedom: {
    summary:
      "<strong>-dom</strong> turns content words into “realm / condition” nouns (<em>kings, wisdom crowds</em>). Emotional hook + grammatical hook share one slide.",
    etymology: [
      { segment: "free", origin: "Kid-owned adjective + political meaning layers." },
      { segment: "-dom", origin: "Germanic abstract noun hoodie—celebrate trio with sibling words below." },
    ],
    embedded: [{ text: "free", note: "Still say it solo in conversation." }],
  },
  wisdom: {
    summary:
      "Same <strong>-dom</strong> factory; vowel trims before suffix—shows English sandpaper smoothing stems before gluing endings.",
    etymology: [
      { segment: "wis", origin: "<em>Wise</em> family shaved for suffix comfort." },
      { segment: "-dom", origin: AFFIX_ORIGIN_HINT["sfx:-dom"] },
    ],
    spelling: [{ from: "wise", to: "wis-", note: "Predictable squeeze before <strong>-dom</strong>—not random memorization fodder alone." }],
  },
  kingdom: {
    summary:
      "Concrete crown + realm suffix = geography-friendly noun students already picture from fantasy maps.",
    etymology: [
      { segment: "king", origin: "Straight noun." },
      { segment: "-dom", origin: "Abstract realm suffix parallels <em>freedom</em> rhythm." },
    ],
    embedded: [{ text: "king", note: "Free noun pre-glue." }],
  },
  wiser: {
    summary:
      "Two meanings of spelled <strong>-er</strong>: here comparative adjective—“more wise.” Pair with noun agents (<em>teacher</em>) to train ear vs eye.",
    tense: "Comparative adjective—not the agentive derivation path.",
  },
  unwise: {
    summary:
      "Germanic prefix <strong>un-</strong> snaps on graded adjectives—students stack antonym poetry (<em>unwise remarks</em>) fast.",
    etymology: [{ segment: "un-", origin: AFFIX_ORIGIN_HINT["pfx:un-"] }],
    tense: "Gradable—plays with comparative/superlative talk.",
  },
  constitution: {
    summary:
      "Civics + science body talk share this mold: prefix <strong>con- together</strong> + <strong>stitut establish</strong> + noun cloak <strong>-tion</strong>—establishing makeup or founding paper.",
    etymology: [
      { segment: "con-", origin: "With-together shading (Latin-ish)—opening chunk parallel to convince." },
      { segment: "stitut", origin: "Place-set stem—students can link institute / institution aloud." },
      { segment: "-tion", origin: AFFIX_ORIGIN_HINT["sfx:-tion"] },
    ],
  },
  convince: {
    summary:
      "Win-over verb: Latin-ish prefix plus bound stem—conquer with argument. Role-play mini trial; label morphemes on sticky notes dragged on smart glass.",
    etymology: [
      { segment: "con-", origin: "Together intensity—paired with noun cousin <em>constitution</em> only in vibe, morphemes still separable lesson." },
      { segment: "vince", origin: "Conquer-overcome stem—rarely appears solo in casual English anymore." },
    ],
    tense: "Verb endings -s/-ed predictable—focus morphology on derivation first.",
  },
  finisher: {
    summary:
      "Doing suffix <strong>-er</strong>: “thing/person finishing.” Sports shout-outs land instantly—students narrate championships using the same chunking.",
    embedded: [{ text: "finish", note: 'Verb plastered cleanly before suffix.' }],
  },
  teacher: {
    summary:
      "Hero word of the lesson plan: noun-of-doer glued to daily profession—pair selfies with morphology labels for smiles + rigor.",
    embedded: [{ text: "teach", note: "Verb stripped to stem before hoodie <strong>-er</strong>." }],
    tense: "Pluralize whole word with <strong>-s</strong>—inner pieces stay snug.",
  },
  unhappy: {
    summary:
      "<strong>Un-</strong> + vibe adjective—“not joyful.” Emotional literacy + morphology share one breath—invite gentle tone when discussing classmates’ moods.",
    etymology: [{ segment: "un-", origin: AFFIX_ORIGIN_HINT["pfx:un-"] }],
    embedded: [{ text: "happy", note: 'Head of meaning—students supply antonym sentences quickly.' }],
  },
  baseball: {
    summary:
      "Sports compound noun—two everyday nouns weld; stress pattern differs from noun phrase aloud (smart-board karaoke optional).",
    embedded: [
      { text: "base", note: "Diamond terminology hook." },
      { text: "ball", note: 'Right-hand head—“ball-ness” dominates category.' },
    ],
  },
  toothbrush: {
    summary:
      "Hygiene compound; plural lesson bonus: plural marker lands on WHOLE toothbrush (<strong>two toothbrushes</strong>) even though plural <em>teeth</em> exists alone.",
    embedded: [
      {
        text: "tooth",
        note: "Compound glue keeps singular tooth inside—students love this weirdness.",
      },
      { text: "brush", note: 'Tool noun head.' },
    ],
  },
  national: {
    summary:
      "<strong>nation + -al</strong> ⇒ “about a nation”—social studies cartography minute on same slide as tree.",
    etymology: [{ segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] }],
  },
  careful: {
    summary:
      "<strong>-ful</strong> “full of” rides on noun <em>care</em>; contrast roadmap with sibling <strong>-less careless</strong> for instant symmetry drawing.",
    etymology: [
      { segment: "care", origin: 'Everyday noun/verb—they supply sentences.' },
      { segment: "-ful", origin: AFFIX_ORIGIN_HINT["sfx:-ful"] },
    ],
  },
  readable: {
    summary:
      "Legibility handshake: readable handwriting / readable graphs—students test each other’s fonts while chanting <strong>-able</strong>.",
    etymology: [
      { segment: "read", origin: 'Verb root still feels alive.' },
      { segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] },
    ],
  },
  preview: {
    summary:
      "<strong>pre- peek</strong>—media literacy gold: trailers, skim-reading, hypotheses before demos.",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "view", origin: "Still a solo word—“see remotely” echoes." },
    ],
  },
  invisible: {
    summary:
      "Negative + SEE stem + <strong>-ible</strong> buddy of <strong>-able</strong>—fantasy + science goggles moment (IR cameras, wavelengths).",
    etymology: [
      { segment: "in-", origin: AFFIX_ORIGIN_HINT["pfx:in-"] },
      { segment: "-ible", origin: "Variant coat after stems like <strong>vis</strong>—“capable-of-being-X’d.”" },
    ],
  },
  predict: {
    summary:
      "Literally “say beforehand”—forecast vocabulary for math graphs + story foreshadowing. Latin root echoes in dictionary / verdict talk.",
    etymology: [
      { segment: "pre-", origin: AFFIX_ORIGIN_HINT["pfx:pre-"] },
      { segment: "dict", origin: '“Say/tell”—link to bilingual kids who hear <em>diction</em> in music playlists.' },
    ],
  },
  transport: {
    summary:
      "STEM mobility verb/noun duo: haul across pathways—pairs with noun <em>portable</em> in tray for reinforcement.",
    etymology: [
      { segment: "trans-", origin: AFFIX_ORIGIN_HINT["pfx:trans-"] },
      { segment: "port", origin: 'Carrier root—students map shipping icons mentally.' },
    ],
  },
  teaching: {
    summary:
      "<strong>-ing</strong> can name the activity/job itself—verb stem still audible. Classroom meta: dissect the word ABOUT teaching WHILE teaching. Very on brand.",
    etymology: [
      { segment: "teach", origin: '<em>Teacher</em> sibling—same orchard, different branching.' },
      { segment: "-ing", origin: 'Nominal/participial chameleon suffix—mention sentence jobs lightly.' },
    ],
    tense: "Different box from conjugated verbs in sentences—helps separate inflection chatter from derivation.",
  },
  playful: {
    summary:
      "Adjective hoodie <strong>-ful</strong> on playground noun <strong>play</strong>—“full of play.” Pair with earnest discussion of recess policy for giggles.",
    etymology: [
      { segment: "play", origin: "<em>Noun verb fun zone</em>." },
      { segment: "-ful", origin: AFFIX_ORIGIN_HINT["sfx:-ful"] },
    ],
  },
  snowball: {
    summary:
      "Winter compound echoes <em>baseball</em> scaffold—students invent silly compounds live (<em>snow-phone??</em>) to feel headedness humorously.",
    embedded: [
      { text: "snow", note: "Modifier narrowing which ball archetype." },
      { text: "ball", note: "<em>Balls</em> category head." },
    ],
  },
  disable: {
    summary:
      "Flip of <strong>enable</strong> mood—Latinate-ish <strong>dis- away/not</strong> + same <strong>able</strong> stem silhouette. Accessible tech empathy convo optional but recommended.",
    etymology: [
      { segment: "dis-", origin: "Apart / negate shading—loves Latinate STEM bases." },
      { segment: "able", origin: 'Same stem shape as noun adjective hybrids students already map.' },
    ],
  },
  nationalism: {
    summary:
      "Layer cake: nation → relational adjective → ideology noun <strong>-ism</strong>; draw stair steps horizontally on panel for literal stair metaphor.",
    etymology: [
      { segment: "nation", origin: "People / country noun base reused in nationalism / national / international slides." },
      { segment: "-al", origin: AFFIX_ORIGIN_HINT["sfx:-al"] },
      { segment: "-ism", origin: '“Belief movement / worldview” hoodie—paired gently with citizenship ethics talk.' },
    ],
    formation: "Outward stacking—each layer names a richer concept while keeping inner chunks audible.",
  },
  international: {
    summary:
      "<strong>inter- among + national relating-to-nations</strong>—global competency buzzword unpacked honestly: pattern practice + cultural humility.",
    etymology: [
      { segment: "inter-", origin: "Between / mutual shading—paired with sporty intermission memory hook." },
      { segment: "nation / -al", origin: '<em>Nationalism / national</em> scaffold pieces visible again.' },
    ],
  },
  portable: {
    summary:
      "Carry-able adjectives power maker spaces / device policies—students lift imaginary laptops while chanting <strong>port-able</strong>.",
    etymology: [
      { segment: "port", origin: 'Carrier root reunited with Greek/Latin voyaging vocabulary (<em>import</em> preview).' },
      { segment: "-able", origin: AFFIX_ORIGIN_HINT["sfx:-able"] },
    ],
  },
  reuse: {
    summary:
      "Eco-friendly Germanic verb + classy <strong>re-again</strong> prefix—climate club poster word with transparent math (use count).",
    etymology: [
      { segment: "re-", origin: AFFIX_ORIGIN_HINT["pfx:re-"] },
      { segment: "use", origin: "Still boldly free morpheme." },
    ],
  },
  illegal: {
    summary:
      "Assimilated negation hugs <strong>legal</strong> after <strong>l</strong>—spelling conspiracy students decode as pattern literacy, NOT shame.",
    etymology: [
      { segment: "il-", origin: AFFIX_ORIGIN_HINT["pfx:in-"] },
      { segment: "legal", origin: 'Courtroom adjective noun students hear on streaming court shows.' },
    ],
    formation: "Prefix consonant politely matches next sound—anchors spelling pattern drills.",
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
  headParts.push(`<h3 class="morph-lesson__h">Explorer map · <em>${w.label}</em></h3>`);
  headParts.push(`<p class="morph-lesson__bracket-caption">Bracket read (how the chunks nest):</p>`);
  headParts.push(`<div class="morph-lesson__bracket" translate="no">${w.bracket}</div>`);
  if (deep?.summary) headParts.push(`<p class="morph-lesson__lead">${deep.summary}</p>`);
  else if (w.note) headParts.push(`<p class="morph-lesson__lead">${stripPara(w.note)}</p>`);
  pieces.push(headParts.join(""));

  if (deep?.formation) {
    pieces.push(
      `<section class="morph-lesson__sec"><h4>Why the bracket shape matters</h4><p>${deep.formation}</p></section>`
    );
  }

  if (deep?.etymology?.length) {
    let b =
      `<section class="morph-lesson__sec"><h4>Chunk meanings (memory hooks)</h4><ul class="morph-lesson__ul">`;
    for (const e of deep.etymology) {
      b += `<li><strong>${escapeHtml(e.segment)}</strong> — ${e.origin || ""}`;
      if (e.note) b += ` <span class="morph-lesson__note">${escapeHtml(e.note)}</span>`;
      b += `</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.spelling?.length) {
    let b = `<section class="morph-lesson__sec morph-lesson__sec--callout"><h4>Spelling anchor</h4><ul>`;
    for (const s of deep.spelling) {
      b += `<li><code>${escapeHtml(s.from)}</code> → <code>${escapeHtml(s.to)}</code> — ${escapeHtml(s.note)}</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.embedded?.length) {
    let b =
      `<section class="morph-lesson__sec"><h4>Smaller windows you already say aloud</h4><ul>`;
    for (const emb of deep.embedded) {
      b += `<li><strong>${escapeHtml(emb.text)}</strong> — ${escapeHtml(emb.note)}</li>`;
    }
    b += `</ul></section>`;
    pieces.push(b);
  }

  if (deep?.tense) {
    pieces.push(`<section class="morph-lesson__sec"><h4>Word-class / endings (quick grammar compass)</h4><p>${deep.tense}</p></section>`);
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
      `<li><strong>${escapeHtml(shortKey)}</strong> also rides along with: ${others.map((x) => `<em>${escapeHtml(x)}</em>`).join(", ")} in this vocabulary tray.</li>`
    );
  }
  if (sharedBullets.length) {
    pieces.push(
      `<section class="morph-lesson__sec morph-lesson__sec--web"><h4>Neighboring branches (same morpheme, other words loaded here)</h4><ul class="morph-lesson__ul">${sharedBullets.join(
        ""
      )}</ul><p class="morph-lesson__meta">Similar to hopping related nodes on a branching thesaurus map—stay inside the magenta links on the board to explore.</p></section>`
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

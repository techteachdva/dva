/**
 * Morpheme catalog for the bottom chart on /morphology/.
 *
 * Built around evidence-based morphology pedagogy (Structured Word Inquiry — Bowers & Kirby, 2010;
 * Goodwin & Ahn, 2013): meaning first, then structure (via word sums), then connections (family
 * members + contrasting morphemes), then phonology (suffix-changing rules), with explicit inquiry
 * prompts that turn each entry into a short investigation.
 *
 * Authoring fields:
 * - `key` (required): MUST match the `morphemeKey` used in word trees ("pfx:un-", "sfx:-ed", "root:port").
 * - `morpheme`: surface form for display (allow alternate shapes like "-er / -or").
 * - `type` (optional): override the auto-derived type label ("Prefix", "Suffix", "Root", "Lexeme",
 *   or any custom string e.g. "Combining form"). If omitted, derived from the `key` prefix.
 * - `origin`: broad source family (Greek / Latin / Anglo-Saxon / French / Mixed / Unknown).
 * - `meaning`: classroom-usable gloss in one short clause.
 * - `etymology` (optional): one-sentence historical origin story for the curious teacher / older learner.
 * - `wordSums` (optional): 2–4 word sums that make the structure explicit. Use `+` between morphemes,
 *   `→` for the result, and parentheses for elided letters (e.g. "hope + ing → hop(e) + ing → hoping").
 *   Keep at least one example IN the bank if possible — students see the pattern AND the live tree.
 * - `decodingTip` (optional): student-facing strategy ("If you see X, ask Y") — 1–2 sentences.
 * - `spellingNote` (optional): the suffix-changing / assimilation / grapheme rule for this morpheme.
 * - `teachingTip` (optional): one classroom move teachers can run on a smart board in 30–60 seconds.
 * - `inquiryPrompts` (optional): 2–3 open student questions that match SWI's "Four Questions" spirit.
 * - `confusedWith` (optional): array of other catalog `key`s — surfaces a "Compare with" panel that
 *   lets students hop directly to the related morpheme's lesson.
 * - `outsideExamples`: a few extra examples NOT in the word bank (extends the lesson).
 * - `wiktionary`: page title to link (defaults to `morpheme` if omitted).
 *
 * Add or revise entries here without touching the renderer — every field renders only if present.
 */

/** @typedef {{
 *   key: string,
 *   morpheme: string,
 *   origin: string,
 *   meaning: string,
 *   outsideExamples: string[],
 *   wiktionary?: string,
 *   type?: string,
 *   etymology?: string,
 *   wordSums?: string[],
 *   decodingTip?: string,
 *   spellingNote?: string,
 *   teachingTip?: string,
 *   inquiryPrompts?: string[],
 *   confusedWith?: string[]
 * }} MorphemeCatalogRow */

/** @type {MorphemeCatalogRow[]} */
export const MORPHEME_CATALOG = [
  // --- Suffixes ---
  {
    key: "sfx:-s",
    morpheme: "-s, -es",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "plural nouns; 3rd-person singular present verbs",
    etymology: "Inherited from Old English plural -as / -es; the same family that gave German its -en plurals.",
    wordSums: [
      "cat + s → cats",
      "box + es → boxes",
      "baby + es → babi + es → babies (consonant + y → i before -es)",
      "she + run + s → she runs (verb agreement with one subject)",
    ],
    decodingTip:
      "Add -es when the base ends in s, x, z, ch, or sh — the extra e gives you a syllable to pronounce. After consonant + y, change y to i and add -es.",
    spellingNote:
      "One morpheme, three sounds: /s/ after voiceless (cats), /z/ after voiced (dogs), /ɪz/ after sibilants (boxes). The spelling stays predictable; the sound rides on the previous letter.",
    teachingTip:
      "Sort 12 mixed plurals on the board: students decide -s vs -es and explain why. The pronunciation pattern emerges from the spelling rule.",
    inquiryPrompts: [
      "Why does box need -es but cat takes only -s? Try saying both pronunciations — which sounds more natural?",
      "Is the -s in 'she runs' the same morpheme as the -s in 'two cats'? How do you know?",
    ],
    outsideExamples: ["boxes", "dishes", "watches", "babies"],
    wiktionary: "-s",
  },
  {
    key: "sfx:-ed",
    morpheme: "-ed",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "past tense / past participle on regular ('weak') verbs",
    etymology: "From Old English -ode / -ede, used on weak verbs since before the year 1000.",
    wordSums: [
      "walk + ed → walked",
      "want + ed → wanted",
      "stop + p + ed → stopped (CVC: double the final consonant)",
      "hope + ed → hop(e) + ed → hoped (drop silent e)",
    ],
    decodingTip:
      "Whenever you see -ed at the end of a verb, the action already happened. The spelling stays -ed even though the sound shifts: /t/ in walked, /d/ in played, /ɪd/ in wanted.",
    spellingNote:
      "Three suffix-changing rules: doubling on stressed CVC bases (stop → stopped), drop-e on silent-e bases (hope → hoped), y→i on consonant + y (cry → cried).",
    teachingTip:
      "Read three -ed verbs aloud and have students hold up 1, 2, or 3 fingers for /t/, /d/, or /ɪd/. The morpheme is consistent; the sound rides on what came before.",
    inquiryPrompts: [
      "Why do we double the p in stopped but not the k in walked?",
      "If '-ed' is one morpheme, why does it sound different in 'jumped' vs 'wanted'?",
      "Find a verb where -ed sounds like /d/ — what's true about its final letter?",
    ],
    outsideExamples: ["walked", "laughed", "wanted", "stopped"],
    wiktionary: "-ed",
  },
  {
    key: "sfx:-ing",
    morpheme: "-ing",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "ongoing action; activity noun (gerund); participle adjective",
    etymology: "Old English -ing, originally a noun-forming suffix; took over the present participle role from earlier -ende around 1200.",
    wordSums: [
      "read + ing → reading",
      "swim + m + ing → swimming (CVC: double the final consonant)",
      "make + ing → mak(e) + ing → making (drop silent e)",
    ],
    decodingTip:
      "An -ing word can do three jobs: verb (She is running), noun (Running is hard), or adjective (running shoes). Look at the sentence to decide its job.",
    spellingNote:
      "Same suffix-changing rules as -ed: double final consonant on CVC bases (stop → stopping), drop silent e (hope → hoping). y stays put: cry → crying.",
    teachingTip:
      "Project three sentences using the same -ing word in different jobs. Students label each as verb / noun / adjective. The shape stays; the syntax changes.",
    inquiryPrompts: [
      "When does 'running' act like a noun? When does it act like a verb? Use the same word in three different sentences.",
      "Why do we write swimming with two m's but reading with just one d?",
    ],
    outsideExamples: ["swimming", "reading", "running", "making"],
    wiktionary: "-ing",
  },
  {
    key: "sfx:-ly",
    morpheme: "-ly",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "forms many adverbs (\"in a ___ way\"); occasionally adjectives",
    etymology: "From Old English -lic 'having the form of', shortened to -ly; the same root as German -lich.",
    wordSums: [
      "quick + ly → quickly",
      "happy + ly → happi + ly → happily (consonant + y → i)",
      "true + ly → tru(e) + ly → truly (drop silent e — exception)",
    ],
    decodingTip:
      "-ly usually turns an adjective into an adverb meaning 'in a ___ way' (quick → quickly). It can also turn a noun into an adjective (friend → friendly, day → daily) — context tells you which.",
    spellingNote:
      "Consonant + y → change y to i first (happy → happily). Silent e usually stays (sincere → sincerely) except in a few words: truly, duly, wholly.",
    teachingTip:
      "Write a sentence with a missing word: 'She spoke ___.' Offer quick / quickly. Students explain why only quickly fits — the slot demands an adverb.",
    inquiryPrompts: [
      "Why is 'friendly' an adjective, not an adverb?",
      "What changes when you swap an adjective for its -ly form in a sentence?",
    ],
    outsideExamples: ["carefully", "slowly", "quietly", "happily"],
    wiktionary: "-ly",
  },
  {
    key: "sfx:-er",
    morpheme: "-er / -or",
    origin: "Mixed (Germanic + Latin/French)",
    meaning: "person/thing that does an action (agent); also \"more\" on short adjectives (comparative)",
    etymology: "Two senses, two histories: agent -er is Old English -ere; comparative -er is also Old English. Latin -or (actor, creator) entered through Norman French.",
    wordSums: [
      "teach + er → teacher (one who teaches)",
      "wise + er → wis(e) + er → wiser (more wise — drop silent e)",
      "run + n + er → runner (CVC: double the consonant)",
      "act + or → actor (Latin verb takes -or)",
    ],
    decodingTip:
      "On a verb, -er names the doer: teach → teacher. On a short adjective, -er means 'more': wise → wiser. The grammar of the base tells you which job.",
    spellingNote:
      "Drop silent e (bake → baker), double CVC consonants (run → runner). -or attaches to many Latin-origin verbs (act, create, edit) where -er would feel wrong.",
    teachingTip:
      "Build a T-chart: 'doer' on one side, 'more ___' on the other. Toss out 10 -er words. Students sort and justify with a paraphrase.",
    inquiryPrompts: [
      "Is 'faster' the same morpheme as 'runner'? How do you know?",
      "Why creator with -or but teacher with -er? Trace the language each verb came from.",
    ],
    outsideExamples: ["actor", "runner", "creator", "wiser"],
    wiktionary: "-er",
  },
  {
    key: "sfx:-tion",
    morpheme: "-ion, -tion",
    origin: "Latin (via French)",
    meaning: "noun-maker on verbs — names the act, process, or result",
    etymology: "From Latin -tiō / -tiōnem, a noun-forming suffix on verbs; entered English through Norman French (action, vision).",
    wordSums: [
      "act + ion → action",
      "inform + ation → information",
      "decide + sion → deci(de) + sion → decision (Latin verb stem alternation)",
      "construct + ion → construction",
    ],
    decodingTip:
      "When -tion lands on a verb-shape, it names the act, process, or result of doing it: inform → information ('the act / result of informing').",
    spellingNote:
      "Spelled -ation after a clear vowel-final stem (information), -tion after most stems (action), -sion after stems ending in d / s / se (decision, conclusion, confusion).",
    teachingTip:
      "Pair-up game: give students a verb (decide, react, construct), they write the -tion noun, then a sentence using both forms.",
    inquiryPrompts: [
      "Why is it 'decision' (-sion) but 'action' (-tion)? Look at the Latin verb stems.",
      "What changes about a sentence when you swap 'inform' for 'information'?",
    ],
    confusedWith: ["sfx:-ment", "sfx:-ness", "sfx:-al"],
    outsideExamples: ["decision", "instruction", "reaction", "construction"],
    wiktionary: "-tion",
  },
  {
    key: "sfx:-al",
    morpheme: "-al",
    origin: "Latin (via French)",
    meaning: "adjective-maker — \"relating to\" or \"characterized by\"",
    etymology: "From Latin -ālis 'belonging to'; entered English directly and through French (cultural, parental, regional).",
    wordSums: [
      "nation + al → national",
      "person + al → personal",
      "music + al → musical",
    ],
    decodingTip:
      "-al turns a noun into an adjective meaning 'relating to' or 'of': nation → national 'of the nation'.",
    teachingTip:
      "Show 5 noun→adjective pairs (culture/cultural, magic/magical). Students paraphrase each as 'relating to ___' to expose the morpheme's job.",
    inquiryPrompts: [
      "Why doesn't every noun take -al? What blocks it?",
      "Compare 'a personal letter' and 'a person'. What is the morphological difference doing for the meaning?",
    ],
    confusedWith: ["sfx:-ous", "sfx:-y", "sfx:-ful"],
    outsideExamples: ["cultural", "personal", "regional", "magical"],
    wiktionary: "-al",
  },
  {
    key: "sfx:-y",
    morpheme: "-y",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "adjective-maker — \"full of / like / characterized by\"",
    etymology: "Old English -ig 'having, characterized by'; same source as German -ig.",
    wordSums: [
      "mud + y → mud + d + y → muddy (CVC: double the consonant)",
      "rain + y → rainy",
      "fun + y → fun + n + y → funny",
    ],
    decodingTip:
      "-y is the everyday way to say 'full of' or 'like ___': sun + y → sunny ('full of sun'); cloud + y → cloudy ('full of clouds').",
    spellingNote:
      "Short-vowel CVC bases double the final consonant: mud → muddy, fun → funny. Silent e usually drops: shine → shiny.",
    teachingTip:
      "30-second brainstorm: list nouns that take -y to make adjectives. Then sort by which doubled the consonant.",
    inquiryPrompts: [
      "What's the difference between 'rainy' (-y) and 'rain's' (apostrophe + s)? Different morphemes — how can you tell them apart?",
      "Why do we double the d in muddy?",
    ],
    confusedWith: ["sfx:-ous", "sfx:-al", "sfx:-ful"],
    outsideExamples: ["muddy", "rainy", "windy", "sunny"],
    wiktionary: "-y",
  },
  {
    key: "sfx:-ness",
    morpheme: "-ness",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "abstract noun-maker — \"the state or quality of being ___\"",
    etymology: "Old English -nes / -nis 'state, quality'; combines freely with adjectives.",
    wordSums: [
      "kind + ness → kindness",
      "happy + ness → happi + ness → happiness (consonant + y → i)",
      "ready + ness → readi + ness → readiness",
    ],
    decodingTip:
      "-ness turns an adjective into an abstract noun naming the state of being that adjective: kind → kindness ('the state of being kind').",
    spellingNote:
      "Consonant + y bases change y to i: happy → happiness. Most other adjectives just add -ness with no spelling change: dark → darkness, sad → sadness.",
    teachingTip:
      "Pair adjectives and -ness nouns on a T-chart. Notice how the noun lets you talk about the quality itself, not just describe with it.",
    inquiryPrompts: [
      "Why does 'happiness' have an i but 'kindness' has an e?",
      "Could you say 'fastness' or 'quickness'? Why does one sound natural and the other not?",
    ],
    confusedWith: ["sfx:-ity", "sfx:-ment", "sfx:-tion"],
    outsideExamples: ["kindness", "darkness", "readiness", "happiness"],
    wiktionary: "-ness",
  },
  {
    key: "sfx:-ment",
    morpheme: "-ment",
    origin: "Latin (via French)",
    meaning: "noun-maker on verbs — names the result, process, or product",
    etymology: "From Latin -mentum 'a means or result'; entered through French (jugement, ornement).",
    wordSums: [
      "develop + ment → development",
      "agree + ment → agreement",
      "argue + ment → argu(e) + ment → argument (drop silent e — exception)",
    ],
    decodingTip:
      "-ment lands on a verb to name the process or product of that action: develop → development, agree → agreement.",
    spellingNote:
      "Silent e usually stays before -ment (placement, statement, retirement). Argument is the famous exception — the e drops.",
    teachingTip:
      "Verb-to-noun matching cards: ten verbs, students attach -ment and use each in a sentence. Spot the argument exception.",
    inquiryPrompts: [
      "Why 'argument' and not 'arguement'?",
      "Compare 'development' (-ment) and 'developed' (-ed). Both come from develop — what makes them different?",
    ],
    confusedWith: ["sfx:-tion", "sfx:-ness"],
    outsideExamples: ["development", "agreement", "measurement", "argument"],
    wiktionary: "-ment",
  },
  {
    key: "sfx:-able",
    morpheme: "-able, -ible",
    origin: "Latin (via French)",
    meaning: "adjective-maker — \"able to be ___ed\" / \"capable of\"",
    etymology: "From Latin -ābilis 'able to be'; -able attaches to native English verbs, -ible to Latin verb stems (visible, audible, edible).",
    wordSums: [
      "read + able → readable",
      "love + able → lov(e) + able → lovable (drop silent e)",
      "vis + ible → visible (Latin stem takes -ible)",
      "notice + able → noticeable (e stays — preserves soft c)",
    ],
    decodingTip:
      "When you see -able / -ible, ask: 'Can it be ___ed?' readable = 'can be read'. The substitution test confirms the meaning.",
    spellingNote:
      "Drop silent e before -able when the base is plain (love → lovable). KEEP e to preserve a soft c or g (notice → noticeable, change → changeable). Stems of Latin origin take -ible (visible, audible).",
    teachingTip:
      "Substitution test: replace 'X-able' with 'can be X-ed' in a sentence. If it works, the suffix is doing its job.",
    inquiryPrompts: [
      "Why 'visible' (with -ible) but 'readable' (with -able)? Look up where 'vis' comes from.",
      "Make up an unfamiliar -able word and try it in a sentence. Did it 'work'? Why or why not?",
    ],
    confusedWith: ["sfx:-y", "sfx:-al", "sfx:-ful"],
    outsideExamples: ["flexible", "possible", "valuable", "noticeable"],
    wiktionary: "-able",
  },
  {
    key: "sfx:-ful",
    morpheme: "-ful",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "adjective-maker — \"full of\" or \"having\"",
    etymology: "Old English -full 'full', shortened to -ful in compounds; the same word as the adjective full.",
    wordSums: [
      "hope + ful → hopeful",
      "help + ful → helpful",
      "beauty + ful → beauti + ful → beautiful (consonant + y → i)",
    ],
    decodingTip:
      "-ful means 'full of' or 'having': careful = 'full of care', helpful = 'full of help'.",
    spellingNote:
      "Always one l in -ful, never two — even though the word 'full' has two. Cup + ful = cupful, not cupfull.",
    teachingTip:
      "Rewrite each '-ful' word as 'full of ___' and check the meaning still fits. This makes the suffix's contribution visible.",
    inquiryPrompts: [
      "What's the difference between 'careful' and 'care-free'? How do the suffixes flip the meaning?",
      "Could 'thoughtful' have been 'thoughty'? Why might English have chosen -ful?",
    ],
    confusedWith: ["sfx:-less", "sfx:-y", "sfx:-al"],
    outsideExamples: ["hopeful", "helpful", "colorful", "beautiful"],
    wiktionary: "-ful",
  },
  {
    key: "sfx:-less",
    morpheme: "-less",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "adjective-maker — \"without\"",
    etymology: "Old English -leas 'free from, lacking'; same root as the verb 'lose'.",
    wordSums: [
      "care + less → careless",
      "end + less → endless",
      "use + less → useless",
    ],
    decodingTip:
      "-less is the negative twin of -ful: -less = 'without', -ful = 'full of'. fearless ↔ fearful; careless ↔ careful.",
    teachingTip:
      "Pair-flip game: read a word with -less, students give the -ful version (and vice versa). Discuss which words have both, which only one.",
    inquiryPrompts: [
      "Why does 'priceless' mean 'extremely valuable' but 'worthless' mean 'no value'? Same suffix, opposite outcomes — why?",
      "Make pairs: hopeful / hopeless, careful / careless. Use each in a sentence — what tone does each carry?",
    ],
    confusedWith: ["sfx:-ful", "pfx:un-", "pfx:in-"],
    outsideExamples: ["careless", "endless", "tasteless", "priceless"],
    wiktionary: "-less",
  },

  // --- Prefixes ---
  {
    key: "pfx:un-",
    morpheme: "un-",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "\"not\" (on adjectives) or \"reverse the action\" (on verbs)",
    etymology: "Old English un- 'not'; one of English's most productive everyday prefixes.",
    wordSums: [
      "un + happy → unhappy (not happy)",
      "un + lock → unlock (reverse the action of locking)",
      "un + lock + able → unlockable",
      "un + happy + ness → unhappiness",
    ],
    decodingTip:
      "un- has two flavors: 'not' on adjectives (unhappy = not happy) and 'reverse the action' on verbs (unlock = the opposite of lock).",
    teachingTip:
      "Sort un- words on the board into 'not + adjective' and 'reverse + verb'. Students notice the same prefix doing two different jobs.",
    inquiryPrompts: [
      "Is 'unhappy' the same kind of un- as 'unlock'? Why or why not?",
      "Is 'unhappiness' one morpheme or three? Build the word sum and label each piece.",
    ],
    confusedWith: ["pfx:in-", "pfx:non-", "pfx:dis-", "sfx:-less"],
    outsideExamples: ["unfair", "unlock", "unclear", "unhappiness"],
    wiktionary: "un-",
  },
  {
    key: "pfx:re-",
    morpheme: "re-",
    origin: "Latin",
    meaning: "\"again\" or \"back\"",
    etymology: "From Latin re- 'back, again'; one of English's most productive academic prefixes.",
    wordSums: [
      "re + write → rewrite (write again)",
      "re + view → review (view again — look back over)",
      "re + view + ed → reviewed",
      "re + turn → return (turn back)",
    ],
    decodingTip:
      "re- usually means 'again' (rewrite = write again) or 'back' (return = turn back). When in doubt, try 'again' first.",
    teachingTip:
      "Word-family fishing: name a verb (build), students call out re- words (rebuild) and explain whether 're-' means 'again' or 'back'.",
    inquiryPrompts: [
      "Is 'review' = 're + view' meaning 'see again'? Does that fit how we use the word?",
      "Find a re- word where 'again' doesn't quite fit. What's happening there?",
    ],
    outsideExamples: ["rewrite", "rebuild", "return", "review"],
    wiktionary: "re-",
  },
  {
    key: "pfx:in-",
    morpheme: "in-, im-, il-, ir- (not)",
    origin: "Latin",
    meaning: "negation — \"not / without\" (Latin family)",
    etymology: "From Latin in- 'not'; assimilates to im- before p/b/m, il- before l, ir- before r — same morpheme, four shapes.",
    wordSums: [
      "in + active → inactive",
      "in + possible → im + possible → impossible",
      "in + legal → il + legal → illegal",
      "in + regular → ir + regular → irregular",
    ],
    decodingTip:
      "Latin in- = 'not' (different from English un-). It changes shape to match the next letter — but it's still one morpheme.",
    spellingNote:
      "Assimilation rule: in- → im- before p/b/m; → il- before l; → ir- before r; stays in- elsewhere. The doubled letter (illegal, irregular) is the giveaway.",
    teachingTip:
      "Show four words side-by-side: inactive, impossible, illegal, irregular. Students hypothesize the spelling rule, then test it on new bases.",
    inquiryPrompts: [
      "Why 'impossible' (im-) instead of 'inpossible'? Say each aloud — which is easier to pronounce?",
      "Is 'illegal' one morpheme + base, or two morphemes + base? Build the word sum.",
    ],
    confusedWith: ["pfx:un-", "pfx:non-", "pfx:dis-", "pfx:in-toward"],
    outsideExamples: ["impossible", "irregular", "illegal", "inactive"],
    wiktionary: "in-",
  },
  {
    key: "pfx:dis-",
    morpheme: "dis-, dif-",
    origin: "Latin (via French)",
    meaning: "\"apart\", \"not\", or \"reverse / undo\"",
    etymology: "From Latin dis- 'apart, away, not'; entered English directly and through French (différent, difficile).",
    wordSums: [
      "dis + agree → disagree (not agree)",
      "dis + connect → disconnect (undo the connection)",
      "dis + tract → distract (pull apart)",
      "dis + appear → disappear",
    ],
    decodingTip:
      "dis- often means 'apart' (distract = pull apart), 'not' (disagree = not agree), or 'undo' (disconnect = undo a connection).",
    teachingTip:
      "Three-column chart: apart / not / undo. Two examples each. Students add a fourth example to each column.",
    inquiryPrompts: [
      "Is 'disrupt' 'apart + break' or 'not + break'? Which fits how we actually use it?",
      "Why is 'disagree' 'not + agree' but 'distract' 'pull + apart'? Same prefix, different jobs — what's going on?",
    ],
    confusedWith: ["pfx:un-", "pfx:in-", "pfx:non-", "pfx:de-"],
    outsideExamples: ["disagree", "different", "disrupt", "disappear"],
    wiktionary: "dis-",
  },
  {
    key: "pfx:non-",
    morpheme: "non-",
    origin: "Latin",
    meaning: "neutral negation — \"not\" with no extra flavor",
    etymology: "From Latin nōn 'not'; the most neutral negation prefix in English.",
    wordSums: [
      "non + fiction → nonfiction (not fiction)",
      "non + stop → nonstop",
      "non + profit → nonprofit",
    ],
    decodingTip:
      "non- is the cleanest 'not' — no extra flavor. nonfiction = 'not fiction'. 'unfiction' or 'infiction' would feel wrong.",
    teachingTip:
      "Compare un- / in- / non-: which would you use to negate 'fiction', 'sense', 'profit'? Most negated nouns prefer non-.",
    inquiryPrompts: [
      "Why 'nonfiction' but not 'unfiction'?",
      "When do English speakers reach for non- instead of un- or in-? Make a hypothesis and test it on five new words.",
    ],
    confusedWith: ["pfx:un-", "pfx:in-", "pfx:dis-"],
    outsideExamples: ["nonfiction", "nonstop", "nonprofit", "nonsense"],
    wiktionary: "non-",
  },
  {
    key: "pfx:in-toward",
    morpheme: "in-, im- (in/into)",
    origin: "Latin",
    meaning: "directional — \"in\", \"into\", or \"toward\" (NOT the negative in-)",
    etymology: "From Latin in 'in, into, on, toward'; spelled the same as the negative in- but a different morpheme with a different meaning.",
    wordSums: [
      "in + ject → inject (throw in)",
      "in + sert → insert (put in)",
      "in + port → im + port → import (in → im before p)",
    ],
    decodingTip:
      "Two prefixes share the in- spelling: 'not' (inactive) and 'in/into' (inject). Context tells you which: inject sends something IN; inactive means NOT active.",
    teachingTip:
      "Two-column sort: 12 in- words on cards. Students decide 'not' vs 'into' for each and justify with a one-line paraphrase.",
    inquiryPrompts: [
      "Are 'invisible' (not + visible) and 'inject' (into + throw) the same prefix? Why or why not?",
      "What test could you use to tell the two in-'s apart?",
    ],
    confusedWith: ["pfx:in-", "pfx:ex-", "pfx:trans-"],
    outsideExamples: ["insert", "inject", "import", "include"],
    wiktionary: "in-",
  },
  {
    key: "pfx:over-",
    morpheme: "over-",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "\"too much\", \"above\", or \"across\"",
    etymology: "Old English ofer 'above, beyond, too much'; the same word as the adverb 'over'.",
    wordSums: [
      "over + heat → overheat",
      "over + react → overreact",
      "over + confident → overconfident",
    ],
    decodingTip:
      "over- usually means 'too much' (overeat) or 'above / across' (overpass). Listen for the tone — over- often signals criticism: she overreacts.",
    teachingTip:
      "List 8 over- words. Students rate each as positive, neutral, or negative tone. Most over- words skew critical — discuss why.",
    inquiryPrompts: [
      "Is 'overheat' 'heat too much' or 'heat above'? Could be both — does it matter?",
      "Why does 'overconfident' sound like a flaw?",
    ],
    confusedWith: ["pfx:sub-", "pfx:mid-", "pfx:fore-"],
    outsideExamples: ["overheat", "overreact", "overconfident", "overpass"],
    wiktionary: "over-",
  },
  {
    key: "pfx:mis-",
    morpheme: "mis-",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "\"wrongly\" or \"badly\"",
    etymology: "Old English mis- 'wrongly, badly'; some entries (mistake, misuse) entered through Old Norse.",
    wordSums: [
      "mis + lead → mislead (lead wrongly)",
      "mis + spell → misspell (double s preserved across the boundary)",
      "mis + understand → misunderstand",
    ],
    decodingTip:
      "mis- = wrongly or badly. mislead = lead wrongly; mistake = take wrongly; misjudge = judge wrongly.",
    spellingNote:
      "When the base starts with the same letter as the prefix's ending, both letters stay (misspell, misshape, misstate). Don't drop one to look 'cleaner'.",
    teachingTip:
      "Rewrite five 'mis-' words as 'verb + wrongly' (mislead = lead wrongly). Students check whether each paraphrase fits the actual meaning.",
    inquiryPrompts: [
      "Is 'misfortune' 'wrong fortune' or 'bad fortune'? Both? Discuss.",
      "Why 'misspell' with two s's, but 'misuse' with one s?",
    ],
    confusedWith: ["pfx:dis-", "pfx:un-"],
    outsideExamples: ["mislead", "misprint", "mistake", "misspell"],
    wiktionary: "mis-",
  },
  {
    key: "pfx:sub-",
    morpheme: "sub-",
    origin: "Latin",
    meaning: "\"under\" or \"below\" (literal or figurative)",
    etymology: "From Latin sub 'under, below'; common in academic and scientific words.",
    wordSums: [
      "sub + marine → submarine (under + sea)",
      "sub + merge → submerge (push under)",
      "sub + zero → subzero (below zero)",
    ],
    decodingTip:
      "sub- means 'under' physically (submarine) or 'less than' figuratively (subzero, substandard).",
    teachingTip:
      "Two columns — physical 'under' vs figurative 'less than'. Students sort 8 sub- words and explain each placement.",
    inquiryPrompts: [
      "Is sub- in 'subway' literal (the train is below ground) or figurative? Both?",
      "Why 'submerge' with sub- but 'immerse' with im-? Different prefixes, similar idea — compare the imagery.",
    ],
    confusedWith: ["pfx:over-", "pfx:de-"],
    outsideExamples: ["submarine", "submerge", "subzero", "subway"],
    wiktionary: "sub-",
  },
  {
    key: "pfx:pre-",
    morpheme: "pre-",
    origin: "Latin",
    meaning: "\"before\" — in time or position",
    etymology: "From Latin prae- 'before, in front of'; widely used in academic English.",
    wordSums: [
      "pre + view → preview (see beforehand)",
      "pre + dict → predict (say before)",
      "pre + heat → preheat (heat ahead of time)",
    ],
    decodingTip:
      "pre- = before, in time or position. preview = see beforehand; preheat = heat ahead of time; prefix = fix before the base.",
    teachingTip:
      "Replace pre- with 'before' in five words: previewing → 'viewing before', predicting → 'saying before'. Notice how the morpheme carries the time meaning.",
    inquiryPrompts: [
      "Is 'prepare' really 'pre + pare'? What does 'pare' mean? Look it up.",
      "Why 'prefer' with pre- but 'defer' with de-? Both end in -fer.",
    ],
    confusedWith: ["pfx:fore-"],
    outsideExamples: ["predict", "prepare", "prehistoric", "preview"],
    wiktionary: "pre-",
  },
  {
    key: "pfx:inter-",
    morpheme: "inter-",
    origin: "Latin",
    meaning: "\"between\" or \"among\"",
    etymology: "From Latin inter 'between, among'; gives us networking words across modern English.",
    wordSums: [
      "inter + act → interact (act between)",
      "inter + rupt → interrupt (break between)",
      "inter + sect → intersect (cut between)",
    ],
    decodingTip:
      "inter- means 'between' or 'among'. interact = act between people; intersect = cut between two paths; intermix = mix among.",
    teachingTip:
      "Word-web on the board: inter- in the center. Students brainstorm 10 words. Then circle which 'between' is implied — between people, places, times?",
    inquiryPrompts: [
      "Is 'the internet' really an 'inter- + net'? Whose 'between' does it bridge?",
      "Compare 'interact' and 'intersect': same prefix — what changes from one to the other?",
    ],
    confusedWith: ["pfx:trans-"],
    outsideExamples: ["interact", "interrupt", "intersect", "internet"],
    wiktionary: "inter-",
  },
  {
    key: "pfx:fore-",
    morpheme: "fore-",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "\"before\" or \"ahead\" (Anglo-Saxon counterpart to Latin pre-)",
    etymology: "Old English fore- 'before, in front'; the everyday counterpart to Latin pre-.",
    wordSums: [
      "fore + word → foreword (a word before the book)",
      "fore + shadow → foreshadow (hint ahead)",
      "fore + warn → forewarn (warn ahead)",
    ],
    decodingTip:
      "fore- is the Anglo-Saxon 'before': foreword = a 'word before' the book; forecast = throw ahead of time.",
    teachingTip:
      "Latin / Anglo pair-up: predict / foretell, preview / foresee. Same idea, two language sources. Discuss when English keeps both versions.",
    inquiryPrompts: [
      "What's the difference between a 'foreword' and a 'forward'? Same letters in different order — how does each morpheme work?",
      "Why does 'foreword' feel old-fashioned compared to 'preview'?",
    ],
    confusedWith: ["pfx:pre-"],
    outsideExamples: ["foreshadow", "foreword", "forewarn", "forecast"],
    wiktionary: "fore-",
  },
  {
    key: "pfx:de-",
    morpheme: "de-",
    origin: "Latin",
    meaning: "\"down\", \"off\", \"away\", or \"reverse / remove\"",
    etymology: "From Latin de- 'down, off, away, reverse'; gives us many academic and scientific words.",
    wordSums: [
      "de + frost → defrost (remove frost)",
      "de + activate → deactivate (reverse activation)",
      "de + flate → deflate (let air down / out)",
    ],
    decodingTip:
      "de- often signals 'remove' or 'reverse': defrost = remove frost; deactivate = reverse activation; descend = climb down.",
    teachingTip:
      "Pair de- words with their roots: deactivate ↔ activate, defrost ↔ frost. Students explain how de- 'undoes' each one.",
    inquiryPrompts: [
      "Is de- in 'destroy' still 'remove'? Trace destroy back to Latin destruere.",
      "Why 'defrost' with de- but 'unfreeze' with un-? Two prefixes, similar jobs — when does English prefer each?",
    ],
    confusedWith: ["pfx:dis-", "pfx:un-", "pfx:sub-"],
    outsideExamples: ["defrost", "deactivate", "deflate", "descend"],
    wiktionary: "de-",
  },
  {
    key: "pfx:trans-",
    morpheme: "trans-",
    origin: "Latin",
    meaning: "\"across\", \"through\", or \"beyond\"",
    etymology: "From Latin trans 'across, through, beyond'; one of the most generative academic prefixes.",
    wordSums: [
      "trans + late → translate (carry across languages)",
      "trans + form → transform (change across shapes)",
      "trans + mit → transmit (send across)",
    ],
    decodingTip:
      "trans- = across or through. translate = carry across languages; transmit = send across distance; transparent = light goes through.",
    teachingTip:
      "Show three trans- words. Ask: 'across what?' Students identify the implicit 'space' the prefix is crossing — language, time, shape, distance.",
    inquiryPrompts: [
      "Is 'transgender' 'across genders'? How does the morpheme work in modern coinages?",
      "Compare 'transport', 'transmit', 'translate': same prefix — what's the pattern across all three?",
    ],
    confusedWith: ["pfx:inter-", "pfx:ex-"],
    outsideExamples: ["translate", "transform", "transmit", "transport"],
    wiktionary: "trans-",
  },
  {
    key: "pfx:anti-",
    morpheme: "anti-",
    origin: "Greek",
    meaning: "\"against\" or \"opposite\"",
    etymology: "From Greek anti 'against, opposite'; common in modern coinages (antibiotic, antivirus, antibody).",
    wordSums: [
      "anti + biotic → antibiotic (against life — kills harmful bacteria)",
      "anti + virus → antivirus",
      "anti + social → antisocial",
    ],
    decodingTip:
      "anti- = against. anti- words usually name something that opposes or counteracts. antifreeze = against freezing.",
    teachingTip:
      "Modern coinage hunt: students list 5 anti- words from current life (antivirus, antibody, antiwar). Notice how anti- keeps generating new vocabulary.",
    inquiryPrompts: [
      "What's the difference between 'antisocial' and 'unsocial'? Both involve 'not social' — but the tone differs. Why?",
      "Why anti- (Greek) for medical / political words but un- (Anglo-Saxon) for everyday ones?",
    ],
    confusedWith: ["pfx:non-", "pfx:un-"],
    outsideExamples: ["antibiotic", "antivirus", "antisocial", "antifreeze"],
    wiktionary: "anti-",
  },
  {
    key: "pfx:mid-",
    morpheme: "mid-",
    origin: "Anglo-Saxon (Germanic)",
    meaning: "\"middle\"",
    etymology: "Old English mid- 'middle'; the same source as the noun 'middle'.",
    wordSums: [
      "mid + term → midterm (middle of the term)",
      "mid + day → midday (middle of the day)",
      "mid + point → midpoint",
    ],
    decodingTip:
      "mid- = middle. midterm = middle of the term; midnight = middle of the night; midwest = middle west of the country.",
    teachingTip:
      "Spatial vs temporal: midpoint (space), midnight (time), midwest (region). Students sort 6 mid- words by the kind of 'middle' they name.",
    inquiryPrompts: [
      "Why 'midnight' but 'middle of the night'? When do we use the morpheme vs the full phrase?",
    ],
    outsideExamples: ["midterm", "midday", "midpoint", "midnight"],
    wiktionary: "mid-",
  },
  {
    key: "pfx:con-",
    morpheme: "con-",
    origin: "Latin",
    meaning: "\"with\" or \"together\"",
    etymology: "From Latin com / con 'with, together'; assimilates to com- before b/p/m, col- before l, cor- before r.",
    wordSums: [
      "con + nect → connect (tie together)",
      "con + verge → converge (come together)",
      "con + bine → com + bine → combine (con → com before b)",
      "con + lect → col + lect → collect (con → col before l)",
    ],
    decodingTip:
      "con- / com- / col- / cor- all mean 'with, together'. converge = come together; connect = tie together; combine = bring with.",
    spellingNote:
      "Assimilation: com- before b/p/m, col- before l, cor- before r, con- elsewhere. The doubled consonant (collect, correct) is a clue to the hidden con-.",
    teachingTip:
      "Show 6 words: combine, connect, collect, correct, contend, compress. Students hypothesize the assimilation rule from the spelling, then check it.",
    inquiryPrompts: [
      "Why 'combine' with com- but 'connect' with con-? What rule predicts this?",
      "How is 'collect' (col-) related to 'connect' (con-)? Same prefix, different shape — why?",
    ],
    confusedWith: ["pfx:in-toward", "pfx:ad-"],
    outsideExamples: ["combine", "connect", "converge", "collect"],
    wiktionary: "con-",
  },
  {
    key: "pfx:ad-",
    morpheme: "ad-",
    origin: "Latin",
    meaning: "\"to\" or \"toward\"",
    etymology: "From Latin ad 'to, toward'; assimilates aggressively (ac-, af-, ag-, ap-, at-, etc.) to match the next consonant.",
    wordSums: [
      "ad + here → adhere",
      "ad + tract → at + tract → attract (ad → at before t)",
      "ad + proach → ap + proach → approach (ad → ap before p)",
    ],
    decodingTip:
      "ad- means 'toward'. The doubled consonant in attract / appeal / aggregate is the assimilated ad- still doing its job.",
    spellingNote:
      "ad- assimilates to almost any following consonant: ac-, af-, ag-, al-, an-, ap-, ar-, as-, at-. Most doubled consonants at the start of a Latinate word are assimilated ad-.",
    teachingTip:
      "Doubled-consonant detective: write 6 words like attract, appeal, accept, aggregate. Students identify the hidden ad- and the original Latin verb.",
    inquiryPrompts: [
      "Is the double t in 'attract' one morpheme or two? Build the word sum.",
      "Why 'admit' (single d) but 'appoint' (double p)? What changed?",
    ],
    confusedWith: ["pfx:con-", "pfx:in-toward"],
    outsideExamples: ["adhere", "attract", "approach", "accept"],
    wiktionary: "ad-",
  },
  {
    key: "pfx:ex-",
    morpheme: "ex-, e-, ef-",
    origin: "Latin",
    meaning: "\"out\", \"away\", or \"former\"",
    etymology: "From Latin ex 'out, away from'; the same root as the word 'exit'.",
    wordSums: [
      "ex + port → export (carry out)",
      "ex + ject → e + ject → eject (ex → e before some consonants)",
      "ex + clude → exclude (shut out)",
    ],
    decodingTip:
      "ex- = out. export = carry out; eject = throw out; exclude = shut out. Pairs nicely with in-: import / export, include / exclude.",
    teachingTip:
      "Pair-up: include / exclude, import / export, internal / external. Students explain how the in / ex pair organizes the meaning.",
    inquiryPrompts: [
      "Is the ex- in 'ex-president' the same prefix as the ex- in 'export'? When did 'former' become a meaning?",
      "Eject vs exit: both have ex- — what's the verb stem doing in each?",
    ],
    confusedWith: ["pfx:in-toward", "pfx:de-"],
    outsideExamples: ["export", "eject", "exclude", "exit"],
    wiktionary: "ex-",
  },

  // --- Roots / stems ---
  {
    key: "root:form",
    morpheme: "form",
    origin: "Latin",
    meaning: "shape; form",
    etymology: "From Latin forma 'shape, figure, image'.",
    wordSums: [
      "form + al → formal",
      "in + form + al → informal",
      "trans + form → transform",
      "uni + form → uniform",
    ],
    decodingTip:
      "form is a 'free base' — it stands alone as a word AND carries 'shape' into many academic words: information, conformity, deformity all build on it.",
    teachingTip:
      "Build a matrix with 'form' in the center: prefixes (in-, re-, trans-, uni-, de-) on the left, suffixes (-al, -ation, -less) on the right. Students generate 8 words.",
    inquiryPrompts: [
      "What does 'information' have to do with form? Trace the meaning: 'shape' → 'shaping someone's ideas' → 'data'.",
      "Are 'deform' and 'reform' opposites? Build word sums for both and see.",
    ],
    outsideExamples: ["transform", "uniform", "reform", "information"],
  },
  {
    key: "root:port",
    morpheme: "port",
    origin: "Latin",
    meaning: "carry",
    etymology: "From Latin portāre 'to carry'; the family also includes English 'port' (harbor) — a place to carry goods in and out.",
    wordSums: [
      "port + able → portable (can be carried)",
      "trans + port → transport (carry across)",
      "im + port → import (carry in)",
      "ex + port → export (carry out)",
    ],
    decodingTip:
      "port = carry. Whenever you see port-, ask: 'who's carrying what?' Importing carries goods in; exporting carries them out; transport carries across.",
    teachingTip:
      "Direction matrix: in- (import), ex- (export), trans- (transport), de- (deport), re- (report), sup- (support — carry from below). Students fill in meanings.",
    inquiryPrompts: [
      "What does 'reporting' have to do with carrying? Trace the metaphor.",
      "Why is a portable charger called portable? Build the word sum.",
    ],
    confusedWith: ["root:fer", "root:duct"],
    outsideExamples: ["portable", "import", "transport", "report"],
  },
  {
    key: "root:rupt",
    morpheme: "rupt",
    origin: "Latin",
    meaning: "break; burst",
    etymology: "From Latin rumpere / ruptus 'to break, burst'.",
    wordSums: [
      "e + rupt → erupt (break out)",
      "inter + rupt → interrupt (break in between)",
      "dis + rupt → disrupt (break apart)",
      "rupt + ure → rupture",
    ],
    decodingTip:
      "rupt = break. Volcanoes erupt (break out); interruptions break in between speakers; eruptions are sudden breakings.",
    teachingTip:
      "Sentence-action match: 'The volcano ___ed' (erupt), 'She ___ed me' (interrupt), 'The plan was ___ed' (disrupt). Students choose the right rupt word and justify.",
    inquiryPrompts: [
      "Bankrupt = bank + rupt. What 'breaks' there? (Hint: think Italian banks in the 1500s.)",
      "How are 'erupt' and 'interrupt' related? Same root — what changes between them?",
    ],
    confusedWith: ["root:struct", "root:scrib"],
    outsideExamples: ["erupt", "corrupt", "disrupt", "rupture"],
  },
  {
    key: "root:tract",
    morpheme: "tract",
    origin: "Latin",
    meaning: "pull; draw",
    etymology: "From Latin trahere / tractus 'to pull, draw'.",
    wordSums: [
      "tract + or → tractor (one that pulls)",
      "at + tract → attract (pull toward)",
      "dis + tract → distract (pull apart)",
      "ex + tract → extract (pull out)",
    ],
    decodingTip:
      "tract = pull, draw. Magnets attract (pull toward); distractions pull your attention apart; tractors pull plows; subtractions pull from below.",
    teachingTip:
      "Direction-of-pull matrix: at- (toward), dis- (apart), ex- (out), sub- (under), pro- (forward), re- (back). Students predict the meaning of each tract word from the prefix alone.",
    inquiryPrompts: [
      "What is a contract literally 'pulling together'? (Hint: parties to an agreement.)",
      "Why is a tractor called a tractor — what does it pull?",
    ],
    confusedWith: ["root:duct", "root:port"],
    outsideExamples: ["traction", "distract", "contract", "extract"],
  },
  {
    key: "root:scrib",
    morpheme: "scrib / script",
    origin: "Latin",
    meaning: "write; scratch",
    etymology: "From Latin scribere / scriptus 'to write, scratch'.",
    wordSums: [
      "scrib + ble → scribble",
      "in + scrib + e → inscribe",
      "de + script + ion → description",
      "manu + script → manuscript (hand + written)",
    ],
    decodingTip:
      "scrib / script = write. Whenever you see these letters, look for the 'writing' meaning: prescription = something written before; manuscript = written by hand; subscribe = sign your name under.",
    spellingNote:
      "scrib in verb forms (describe, inscribe, subscribe), script in nouns and past forms (description, manuscript, scripture). Same morpheme — alternation traces back to Latin scribere / scriptus.",
    teachingTip:
      "Two-form matrix: scrib (verbs) vs script (nouns / past forms). Students discover the pattern by sorting 8 words.",
    inquiryPrompts: [
      "Why does 'describe' become 'description' (b → p)? Look at the Latin participle scriptus.",
      "Is a 'subscription' literally 'something written under'? Trace it through history.",
    ],
    confusedWith: ["root:graph", "root:dict"],
    outsideExamples: ["script", "scribble", "manuscript", "description"],
  },
  {
    key: "root:spect",
    morpheme: "spect / spec / spic",
    origin: "Latin",
    meaning: "look; see",
    etymology: "From Latin specere / spectus 'to look at, see'.",
    wordSums: [
      "spect + ator → spectator (one who looks)",
      "in + spect → inspect (look into)",
      "per + spect + ive → perspective (look through)",
      "sus + pic + ious → suspicious (looking under = mistrusting)",
    ],
    decodingTip:
      "spect / spec / spic = look, see. spectators look on; inspectors look in; perspective is a way of looking; suspicion is looking from underneath.",
    spellingNote:
      "Three forms: spect (spectator, inspect), spec (specimen, special), spic (suspicious, conspicuous). Same root — Latin verb stems alternate.",
    teachingTip:
      "'Who looks where?' chart: respect (look back), inspect (look in), prospect (look forward), retrospect (look back). Direction = prefix; looking = root.",
    inquiryPrompts: [
      "Why does 'suspicious' have spic instead of spect? Look up the Latin verb forms.",
      "Is 'respect' literally 'looking back at someone'? How does that become 'honoring them'?",
    ],
    confusedWith: ["root:vis", "root:dict"],
    outsideExamples: ["spectator", "perspective", "suspicious", "inspect"],
  },
  {
    key: "root:struct",
    morpheme: "struct / stru",
    origin: "Latin",
    meaning: "build; pile up",
    etymology: "From Latin struere / structus 'to build, pile up'.",
    wordSums: [
      "struct + ure → structure",
      "in + struct → instruct (build into someone)",
      "con + struct → construct (build together)",
      "de + stru + ct + ion → destruction (un-building)",
    ],
    decodingTip:
      "struct = build. Construction builds together; instruction builds knowledge into a learner; destruction un-builds; infrastructure is the underlying buildup.",
    teachingTip:
      "Verb-of-building matrix: con- (together), de- (un-), in- (into), re- (again). Students explain how the prefix shapes the building action.",
    inquiryPrompts: [
      "How is teaching the same as 'building knowledge'? Trace 'instruct' from in + struct.",
      "Why does 'destroy' lose the t? Look at the French → English path.",
    ],
    confusedWith: ["root:rupt", "root:form"],
    outsideExamples: ["structure", "instruct", "construction", "destroy"],
  },
  {
    key: "root:dict",
    morpheme: "dict / dic",
    origin: "Latin",
    meaning: "say; speak",
    etymology: "From Latin dīcere / dictus 'to say, speak'.",
    wordSums: [
      "dict + ion + ary → dictionary (book of sayings)",
      "pre + dict → predict (say before)",
      "contra + dict → contradict (speak against)",
      "dict + ate → dictate",
    ],
    decodingTip:
      "dict = say, speak. Dictionaries collect sayings; predictions say what's coming; contradictions speak against; verdicts say the truth.",
    teachingTip:
      "Verbal-act matrix: pre- (before), contra- (against), e- (out), in- (in/into). Each prefix tells you what kind of saying.",
    inquiryPrompts: [
      "What does a verdict 'say true' (ver + dict)? How is that a court judgment?",
      "If 'predict' = say before, what's the difference between predicting and forecasting?",
    ],
    confusedWith: ["root:scrib", "root:fer"],
    outsideExamples: ["predict", "dictionary", "dictate", "contradict"],
  },
  {
    key: "root:fer",
    morpheme: "fer",
    origin: "Latin",
    meaning: "carry; bear; bring",
    etymology: "From Latin ferre 'to bear, carry'; one of the most productive Latin roots in English.",
    wordSums: [
      "trans + fer → transfer (carry across)",
      "of + fer → offer (carry to)",
      "pre + fer → prefer (carry before / in front)",
      "re + fer → refer (carry back)",
    ],
    decodingTip:
      "fer = carry, bear. Transfer carries something across; refer carries you back to a source; offer carries something toward someone; prefer carries one option in front.",
    spellingNote:
      "Verbs ending in -fer often double the r before suffixes: refer → referring, prefer → preferred. (CVC + stress-on-final-syllable rule.)",
    teachingTip:
      "fer matrix with prefixes: trans-, re-, pre-, of-, con-, in-. Students brainstorm 8 fer words and group them by direction.",
    inquiryPrompts: [
      "What's being 'carried' in a job offer? Money? Trust? An invitation?",
      "Why does 'refer' double the r in 'referring'? Suffix-changing rule kicks in — find it.",
    ],
    confusedWith: ["root:port", "root:duct"],
    outsideExamples: ["transfer", "offer", "prefer", "refer"],
  },
  {
    key: "root:mit",
    morpheme: "mit / miss",
    origin: "Latin",
    meaning: "send; let go",
    etymology: "From Latin mittere / missus 'to send, let go'.",
    wordSums: [
      "sub + mit → submit (send under)",
      "mis + sion → mission (a sending)",
      "trans + mit → transmit (send across)",
      "e + mit → emit (send out)",
    ],
    decodingTip:
      "mit / miss = send. Missiles are sent; missions are sendings; submitting sends something to authority; transmitting sends across distance.",
    spellingNote:
      "Two-shape root: mit in verbs (submit, transmit), miss in nouns and past forms (mission, dismissed, permission).",
    teachingTip:
      "Two-shape matrix: mit (verbs) vs miss (nouns and past). Students articulate when each form is used by sorting 8 words.",
    inquiryPrompts: [
      "How is 'omitting' (leaving out) related to sending? What's being 'sent away'?",
      "Compare 'permit' (verb) and 'permission' (noun). One root, two shapes — why?",
    ],
    confusedWith: ["root:fer", "root:port"],
    outsideExamples: ["submit", "mission", "emit", "transmit"],
  },
  {
    key: "root:duct",
    morpheme: "duct / duc / duce",
    origin: "Latin",
    meaning: "lead",
    etymology: "From Latin dūcere / ductus 'to lead'.",
    wordSums: [
      "pro + duce → produce (lead forward)",
      "re + duce → reduce (lead back)",
      "duct + ion → induction",
      "aque + duct → aqueduct (water-leader)",
    ],
    decodingTip:
      "duct / duc / duce = lead. Leaders lead; conductors lead orchestras; ducts lead air or water through walls; aqueducts lead water across valleys.",
    teachingTip:
      "Direction-of-leadership matrix: pro- (forward), re- (back), in- (into), con- (together), de- (down). Students predict each duce / duct word's meaning.",
    inquiryPrompts: [
      "Why is 'reduce' lead-back? What gets diminished when you lead something back?",
      "How is an aqueduct related to a duke? Same root — what's leading what?",
    ],
    confusedWith: ["root:fer", "root:tract", "root:port"],
    outsideExamples: ["produce", "reduce", "aqueduct", "conduct"],
  },
  {
    key: "root:fect",
    morpheme: "fact / fac / fect / fic",
    origin: "Latin",
    meaning: "make; do",
    etymology: "From Latin facere / factus 'to make, do'; one of the most productive Latin roots in English.",
    wordSums: [
      "fact + ory → factory (place that makes)",
      "manu + fact + ure → manufacture (make by hand)",
      "fic + tion → fiction (a making)",
      "per + fect → perfect (made through / completed)",
    ],
    decodingTip:
      "fact / fac / fect / fic = make, do. Factories make products; fiction is something made up; perfection is making something complete; effects are what's made by causes.",
    spellingNote:
      "Same morpheme, four shapes: fact (factory), fac (manufacture), fect (perfect), fic (fiction). The vowel shift mirrors Latin verb stems.",
    teachingTip:
      "Pattern detective: list factory, fiction, perfect, manufacture, effect, defect. Students underline the shifting root form and group by spelling.",
    inquiryPrompts: [
      "A 'fact' is supposedly real, but the morpheme means 'made'. How did the meaning shift?",
      "What's being 'made' when something is artificial?",
    ],
    confusedWith: ["root:struct", "root:form"],
    outsideExamples: ["factory", "manufacture", "fiction", "perfect"],
  },
  {
    key: "root:tain",
    morpheme: "ten / tain / tin",
    origin: "Latin",
    meaning: "hold; keep",
    etymology: "From Latin tenēre 'to hold'; entered English through Old French tenir.",
    wordSums: [
      "con + tain → contain (hold together)",
      "main + tain → maintain (keep + hold)",
      "re + tain → retain (hold back)",
      "ten + ant → tenant (one who holds)",
    ],
    decodingTip:
      "tain / ten = hold, keep. Containers hold contents; tenants hold a place; what you maintain you keep going; detained means held back.",
    teachingTip:
      "Word-family build: list 8 -tain words (contain, retain, maintain, sustain, detain, attain, obtain, pertain). Students give a 'who/what is held?' answer for each.",
    inquiryPrompts: [
      "Is a tournament a kind of holding? Trace the etymology.",
      "What does the IRS retain? What does a teacher detain? Build a sentence for each.",
    ],
    confusedWith: ["root:port", "root:posit"],
    outsideExamples: ["contain", "sustain", "detain", "retain"],
  },
  {
    key: "root:vis",
    morpheme: "vis / vid",
    origin: "Latin",
    meaning: "see",
    etymology: "From Latin vidēre / visus 'to see'; the same family as visual.",
    wordSums: [
      "vis + ion → vision",
      "vis + ible → visible",
      "tele + vis + ion → television (far + see + noun)",
      "e + vid + ence → evidence (out + seeing = visible proof)",
    ],
    decodingTip:
      "vis / vid = see. Visions are seen; videos play moving sights; evidence is what you can see and verify; supervisors see from above.",
    teachingTip:
      "Greek tele- + Latin vis- = television. Show 5 mixed-origin words (television, automobile, microscope). Discuss why English happily mixes language sources.",
    inquiryPrompts: [
      "Is 'supervise' 'see from above'? Trace super + vise.",
      "How are 'video' and 'visit' related? Both contain vid / vis — what's the connection?",
    ],
    confusedWith: ["root:spect"],
    outsideExamples: ["video", "evidence", "revise", "vision"],
  },
  {
    key: "root:ceive",
    morpheme: "cap / ceive / cept / cip",
    origin: "Latin",
    meaning: "take; catch; seize",
    etymology: "From Latin capere / captus 'to take, seize'; one of the trickiest roots because it shape-shifts across borrowings.",
    wordSums: [
      "re + ceive → receive (take back)",
      "ac + cept → accept (take toward)",
      "in + ter + cept → intercept (take between)",
      "par + tic + ip + ate → participate (take + part)",
    ],
    decodingTip:
      "cap / ceive / cept / cip = take, catch. Receiving takes; capturing takes by force; participating takes part; deceiving takes someone in.",
    spellingNote:
      "Four allomorphs: cap (capture), ceive (receive), cept (reception), cip (participate). The form depends on the path of borrowing — French gave us -ceive, direct Latin gave us -cept.",
    teachingTip:
      "Four-shape detective: cap, ceive, cept, cip. Students find one example of each in the catalog and trace the verb stem to Latin capere.",
    inquiryPrompts: [
      "Why 'receive' (-ceive) but 'reception' (-cept)? What rule changes the shape?",
      "Is 'captivating' 'taking captive'? Trace the metaphor.",
    ],
    confusedWith: ["root:tract", "root:fer"],
    outsideExamples: ["accept", "intercept", "deceive", "participate"],
  },
  {
    key: "root:sist",
    morpheme: "sta / sist / stat / stit",
    origin: "Latin",
    meaning: "stand",
    etymology: "From Latin stāre / status 'to stand'; the root of stand, stay, and status.",
    wordSums: [
      "con + sist → consist (stand together)",
      "in + sist → insist (stand on)",
      "sta + tion → station (a standing place)",
      "sub + sti + tute → substitute (stand under in place)",
    ],
    decodingTip:
      "sta / sist / stat / stit = stand. Stations are standing places; statues stand; insistence is standing firmly on a point; consistency stands together over time.",
    teachingTip:
      "'Standing where?' matrix: con- (together), in- (on), per- (through), re- (back), sub- (under). Students fit each prefix to a sist / sta / stit word.",
    inquiryPrompts: [
      "What does it mean to 'stand for' something? How does that relate to 'substitute'?",
      "Why is 'constant' from this root? What's standing firm?",
    ],
    confusedWith: ["root:posit", "root:tain"],
    outsideExamples: ["station", "constant", "substitute", "insist"],
  },
  {
    key: "root:posit",
    morpheme: "pos / pon / posit",
    origin: "Latin",
    meaning: "place; put",
    etymology: "From Latin pōnere / positus 'to place, put'.",
    wordSums: [
      "com + pose → compose (put together)",
      "de + posit → deposit (put down)",
      "op + posit + e → opposite (placed against)",
      "pro + pose → propose (put forward)",
    ],
    decodingTip:
      "pos / pon / posit = place, put. Compositions put pieces together; deposits put money down; positions are places; propositions put ideas forward.",
    teachingTip:
      "Verb-of-placement matrix: com- (together), de- (down), op- (against), pre- (before), re- (back), sup- (under). Students fill in 6 verbs.",
    inquiryPrompts: [
      "What does a postponed event have in common with a positioned chess piece? Same root, very different uses.",
      "Why 'opposite' (-posit) but 'oppose' (-pose)? Two related words, different shapes — why?",
    ],
    confusedWith: ["root:sist", "root:struct"],
    outsideExamples: ["compose", "deposit", "opposite", "propose"],
  },
  {
    key: "root:ply",
    morpheme: "plic / ply",
    origin: "Latin",
    meaning: "fold; bend",
    etymology: "From Latin plicāre / plicātus 'to fold, bend'.",
    wordSums: [
      "multi + ply → multiply (many folds)",
      "com + plic + ate → complicate (fold together)",
      "re + plic + a → replica (fold back)",
      "ap + ply → apply (fold toward)",
    ],
    decodingTip:
      "plic / ply = fold. Multiplying makes many folds; complications are folded-together situations; replicas are folds-back of the original; applying folds toward someone.",
    teachingTip:
      "Folding metaphor: how does ap + plic = 'fold toward' become 'apply for a job'? Students articulate the metaphor's leap.",
    inquiryPrompts: [
      "Why does 'duplicate' mean 'two folds'? Trace the metaphor of doubling.",
      "How is 'implicit' (folded in) the opposite of 'explicit' (folded out)?",
    ],
    confusedWith: ["root:fect", "root:struct"],
    outsideExamples: ["complicated", "multiply", "replica", "imply"],
  },

  // --- Greek combining forms ---
  {
    key: "root:graph",
    morpheme: "graph / gram",
    origin: "Greek",
    meaning: "write; draw; record",
    etymology: "From Greek graphein 'to write, scratch, draw'; one of the most productive Greek combining forms in English.",
    wordSums: [
      "photo + graph → photograph (light + write)",
      "para + graph → paragraph (beside + write)",
      "auto + graph → autograph (self + write)",
      "tele + gram → telegram (far + writing)",
    ],
    decodingTip:
      "graph / gram = write, draw, record. Anything that records or draws likely has graph: telegraph, monograph, geography ('writing about earth').",
    teachingTip:
      "Combining-form sandbox: write photo-, geo-, bio-, auto- on the board. Pair each with -graph or -gram. Discuss the resulting compounds and meanings.",
    inquiryPrompts: [
      "Why is a telegram a -gram but a telegraph a -graph? What's the difference?",
      "What does 'graphic design' have to do with writing?",
    ],
    confusedWith: ["root:scrib", "sfx:-logy"],
    outsideExamples: ["photograph", "paragraph", "diagram", "telegram"],
    wiktionary: "-graph",
  },
  {
    key: "sfx:-logy",
    morpheme: "-logy",
    origin: "Greek",
    type: "Combining form",
    meaning: "study of; science of",
    etymology: "From Greek logos 'word, study, reason'; the suffix that names a field of study.",
    wordSums: [
      "bio + logy → biology (study of life)",
      "geo + logy → geology (study of earth)",
      "psycho + logy → psychology (study of the mind)",
      "etymo + logy → etymology (study of true / original meaning)",
    ],
    decodingTip:
      "-logy = study of, science of. Whenever you see -logy, ask: 'study of what?' Biology = bios (life) + logy (study).",
    teachingTip:
      "Combining-form match-up: bio, geo, psycho, zoo, etymo, anthropo. Students pair each with -logy and gloss as 'study of ___'.",
    inquiryPrompts: [
      "Etymology means 'study of true / original meaning' — etymos + logos. How does that fit what we're doing right now in this lesson?",
      "Why isn't there a 'mathematilogy'? What governs which fields take -logy and which don't?",
    ],
    confusedWith: ["root:graph"],
    outsideExamples: ["geology", "psychology", "zoology", "etymology"],
    wiktionary: "-logy",
  },
];

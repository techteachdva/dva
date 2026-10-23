# CyberMorph: The Final Test (boss plan) and the Rotling mix audit

Build: CyberMorph 1.4.2. Source of truth: `js/game/game.js` (startFinale, spawnBoss, bossFight, startTimed), `js/game/waves.js` (makeFake, makeWave), `js/data/world.js` (FINALE_POOLS), the panels in `js/panels/`. Rotling numbers come from running the real generators in Node (200 runs of every level's dessert and every room's hall wave). Not checked: how real students split their calls in the DEBUG panel; there is no telemetry for that yet.

**Status: Part 2 (the Rotling mix) is implemented, not yet committed. Part 3 (the boss) is plan only.**

Part 2 as built: five offline misspelling kinds (twin, overrule, greek, seam, and a fifth, **vowel**: a hard-to-hear vowel in a root, added because six Latin and Greek levels had no misspellable word), `MIX` / `rollCalls` / `dealCalls` in `waves.js`, dessert dealt from the bag, and `scripts/audit-cybermorph-rotlings.mjs`. Measured over 200 runs: dessert 40.0 / 29.3 / 19.6 / 11.1 and halls 40.0 / 29.0 / 20.8 / 10.3 (real / misspelled / not a word / reversed).

**Pillar.** The Rot is the final exam. Three phases, three beats each, nine different ways to show you can read a word by its parts: what the pieces mean, how words are spelled and built, and how to crack a word you have never seen.

---

## Part 1: What is wrong now

### The boss

- The whole fight is the same verb three times: split a word, then rebuild it (`bossFight`). Phase 1 and 2 are just shorter versions of phase 3, so they never feel like bosses.
- **Nothing can go wrong.** A wrong split shoves you back, a failed build says "try again", and both retry until right. The fight cannot be lost, so it cannot test anything.
- Randomness is one `pick()` per phase from 5–6 words (`FINALE_POOLS`). A second run is the same fight with a different word.
- The rebuild hands you the answer. Its request lists every piece's meaning in order (`ids.map(meaning).join(' + ')`), and the pool is the player's whole `learned` list, **including Lingo morphemes**, which the boss is not supposed to use.
- It only tests 2 of the 6 skills the game teaches: splitting, and composition from a recipe. It never tests meanings, spelling, word families, suffix function, or reading an unfamiliar word.

### The Rotlings

The real mix, from 200 simulated runs:

| Where | Real | Misspelled (rule skipped + link dropped) | Not a word | Reversed |
| --- | --- | --- | --- | --- |
| Level dessert (29 levels, the Rotlings players meet most) | **66.7%** | 5.1% | 6.1% | 22.2% |
| Rotling halls | **73.0%** | 14.0% | 2.7% | 10.3% |

You're right on both counts. Here is why, in the code:

1. **Dessert is two real words and one fake** (`serveDessert`: `slice(0, 2)` real plus one `makeFake`). Calling "real" every time gets 67% right.
2. **The misspelled kind only exists when a spelling rule fires.** `joint` needs `build(ids).steps.length`, and most level words are `care + ful` style with no rule. Only 23 Anglo-Saxon, 49 Latin and 15 Greek bank words trigger one.
3. **So the fallback is reversed.** In `makeWave` a word with no rule gets rank 2, which asks `makeFake` for `order` first (`waves.js:159–164`).
4. **"Not a word" is held back on purpose.** It goes to the end of the list 70% of the time (`waves.js:83`), and the learned-pieces filter shrinks it further. 1,652 non-word fakes are pre-built, and almost none reach the screen.

---

## Part 2: The Rotling fix (do this first; beat 4 of the boss depends on it)

### 2.1 More ways to misspell
Add three new misspelling generators beside `joint` and `link`. Each one is a spelling fact about morphemes, so the "why" line teaches something:

| Kind | What the Rot does | Examples | Why line |
| --- | --- | --- | --- |
| `twin` | Swaps a suffix for its look- or sound-alike twin | carefull, visable, differance, assistent, actor→acter, divison | "-ful has one L when it is a suffix." "vis takes -ible." |
| `overrule` | Applies a spelling rule where it doesn't belong | helpping, carful, hopful, playied | "Double the consonant only after one short vowel + one consonant." |
| `greek` | Spells a Greek piece the everyday way | fotograph, sinonym, kronology, sycology | "Greek ph, y, ch and ps keep their Greek spelling." |

Guard: like `nonwords.js`, build the list offline with a script and check it against a full English word list. A "misspelling" must never be a real word.

### 2.2 Choose the kind first, then find a word that can make it
Replace the rank-preference loop (`makeWave`) and the 30% non-word gate with a **target mix**. Draw each Rotling's kind from a weighted bag, then pick a word that can produce that kind:

| | Real | Misspelled (all five kinds) | Not a word | Reversed |
| --- | --- | --- | --- | --- |
| Target | 40% | 30% | 20% | 10% |

No one call should be worth more than about 40%. Reversed drops to 10% because it is the easiest call (`lysoft`).

### 2.3 Dessert gets a bag, not a recipe
Three Rotlings per level, kinds drawn from the same bag, with **at least one real and at least one fake**. If it were always one of each kind, players would count instead of reading.

### 2.4 An audit that stops it drifting back
Add `scripts/audit-cybermorph-rotlings.mjs` (the sim used for the table above). It prints the mix for dessert, halls, Rot Return and Overclock, and fails if any kind is more than 5 points off target or any room can't make a kind with its learned pieces.

**Test it.** Rerun the audit and see the table land on target. Then play three Latin levels: you should meet a misspelled or non-word Rotling in most desserts.

---

## Part 3: The Final Test

### 3.1 How you can lose (the spine)
- **Integrity: 4 pips per phase**, refilled at each new phase.
- In the boss only, **a wrong first answer costs a pip and the item is replaced by a fresh draw.** The explanation still shows, so the feedback rule holds (every attempt gets an explanation), but you can't click through the options until one works. This one change turns the fight from a puzzle you can't fail into a test.
- **0 pips: "The Rot rewrites the phase."** That phase restarts with new draws. Earlier phases stay beaten, as checkpoints, and there is no game over. Failure costs time and a fresh set of questions (house style: failure is drama, death is fair).
- **Chosen failure: SCAN.** Spend 1 pip to reveal one piece's meaning, or which seam is wrong. The player decides when a hint is worth it.
- **Tuning math** (binomial, about 12 items per phase). Chance of passing a phase on the first try at a given first-try accuracy:

| First-try accuracy | 3 pips | 4 pips |
| --- | --- | --- |
| 70% | 25% | 49% |
| 80% | 56% | 79% |
| 85% | 74% | 91% |
| 90% | 89% | 97% |

  Start at 4 pips. A student near the game's own first-try rate clears each phase in one to two tries. A student clicking at random (about 33%) almost never does. `profile.stats.firstTry / tasks` already gives each student's baseline to compare against.

### 3.2 The nine beats
Every pool is filtered to `origin ∈ {anglo, latin, greek}`. Every draw comes from morphemes the player has earned. The beat order is fixed so difficulty climbs; the content and the twist are random.

**PHASE 1: THE SHELL. Know the pieces.** The Rot is armored in morpheme tiles, and each beat strips a layer off.

| # | Beat | The player… | Skill | Randomness |
| --- | --- | --- | --- | --- |
| 1 | **Meaning Volley** | Tiles fly off the Rot one at a time. Pick each one's meaning from 3 before it lands. | Morpheme meaning | 6 tiles, 2 per origin, weighted toward the player's weakest or fading morphemes (`mastery.js` glow). Distractors share the tile's type. 1 run in 3 rolls *Bleached*: the origin colors are hidden. |
| 2 | **Twin Roots** | Wire 4 Greek or Latin tiles to the Anglo-Saxon or Latin tile with the same meaning (graph↔scribe, scope↔spect, hydro↔aqua, poly↔multi, phob↔fear, auto↔self). One extra tile is a false friend. | Connections across origins | 4 pairs from a pairs table built by gloss overlap and checked by hand. The false friend is random. |
| 3 | **Shape Shift** | The Rot breaks a sentence. Turn the ending ring until the word fits (construct → construction). | What a suffix does to a word | Sentences from every room's patch and firewall tasks, plus bank words that take two different suffixes. |

**PHASE 2: THE SWARM. Know the words.** The Rot bursts into a swarm.

| # | Beat | The player… | Skill | Randomness |
| --- | --- | --- | --- | --- |
| 4 | **Swarm Debug** | Six Rotlings crawl toward the Morpher in real time. Clicking one freezes the swarm while you split it and make the call. | Real vs. Rot, all four calls | The Part 2 bag, with every kind guaranteed at least once. One 4-piece golden Lieutenant. |
| 5 | **Spell Strike** | A word sum appears (hope + ing =) and the player **types** the word. | Spelling rules, produced rather than recognized | 4 sums: drop-e, double, y→i, and assimilation or linking o. One sum changes nothing, so applying a rule every time fails. Drawn from the 87 rule words. |
| 6 | **Family Web** | One base sits in the middle. Hang its family words and bin the look-alikes (the LINK panel). | Word families | 1 of the 91 bases with 3+ family words. 4 family words and 2 look-alikes. |

**PHASE 3: THE TRUE FORM. Read the unknown.**

| # | Beat | The player… | Skill | Randomness |
| --- | --- | --- | --- | --- |
| 7 | **Meaning Forge** | 3 meanings, one per origin. Build each on free rings that hold every earned Academic English morpheme. **The recipe is not shown.** | Composition from meaning | 3+ part bank words, preferring ones not in the player's Lexicon. The rings include decoys. |
| 8 | **Word Detective** | 2 words the player has never built. Split each, read the pieces, choose its meaning from 3 (the Unknown File routine). | Analyzing an unfamiliar word | Bank words not in `profile.lexicon`. Distractors are meanings of words that share a piece. |
| 9 | **The Giant Word** | One monster word, in four strikes: cut every seam as the arena collapses, tag each piece's meaning, choose the word's meaning, then rebuild it. | Everything at once | From a pool of 6–8 giants, Triskaidekaphobia among them. Seams, meaning distractors and ring decoys are all random. |

Giant-word candidates already in the bank (5 parts): triskaidekaphobia, autobiographical, chronological, technological, psychological. Author 2–3 more that use Latin and Anglo-Saxon pieces (for example **un + pre + dict + able + ly**, **mis + under + stand + ing**), so the final blow isn't always Greek. Keep Triskaidekaphobia as the first-run final word: it's your signature and its pieces (tris, kai, deka) are earned in Greek levels 4–6.

### 3.3 Making it feel like a boss
- **The Rot changes shape each phase:** a shell of the player's own morpheme tiles, then a swarm, then a towering true form made of the giant word's letters. Each beat visibly cracks it.
- **Two bars on screen:** the Rot's (3 segments per phase) and the Morpher's integrity pips.
- **One short taunt per beat, and nothing longer.** Dialogue now has a read-lock, so lines must stay brief to keep the fight moving.
- **Music:** a new stinger and layer each phase (`audio.js`, `music.js`).
- **Beat 4 is the set piece:** the swarm moving in real time is the one place the arena itself is the threat.

### 3.4 After the fight: the report
At the end the screen shows **Test Results**: first-try % for Meanings (beats 1, 9), Connections (2, 6), Spelling (4, 5), Composition (7, 9), Analysis (8, 9), plus Suffix function (3).
- Save the best run to `profile.finale.best`.
- Show it in Progress Reports and the printed report.
- Add it to the exit-ticket code, so Mr. Phil gets a real end-of-unit morphology score.

### 3.5 Replay: Boss Rush in Overclock
- Beating the Rot unlocks **BOSS RUSH** on the Overclock cabinet: the full nine beats, scored on time, pips left and first-try %, with its own browser top 10 (next to `SCORES`).
- From the second run on, each phase also rolls one **Rot Mutation**: *Bleached* (origin colors hidden), *Haste* (shorter timers), *Mirror* (the swarm has more reversed and twin fakes), or *Fog* (Forge meanings hidden until hovered).
- The first fight never mutates, so it stays fair. Repeat fights can't be memorized.

### 3.6 Code shape
- `js/game/finale/fight.js`: the state machine (phase, beat, pips, checkpoint, seed). It replaces `startFinale`, `spawnBoss` and `bossFight`.
- `js/game/finale/beats/*.js`: one file per beat. Each exports `{ id, phase, skill, draw(profile, rnd), run(content, ctx) }`.
  - `draw` is pure (no DOM), so Node can audit it.
  - `run` reuses the panels where one fits: compile (patch, compile), debug, link, newword.
  - New UI only for Volley, Twin Roots, Spell Strike and the Giant Word.
- **A seeded RNG per fight.** The dev console gets `boss seed <n>`, `boss beat <1–9>` and `boss pips <n>`.
- `scripts/audit-cybermorph-finale.mjs` draws 1,000 fights and checks that:
  - no pool runs dry;
  - no Lingo morpheme appears;
  - every built word passes the spelling engine;
  - two fights rarely share more than 3 items (overlap rate printed).
- Fix the Lingo leak whatever happens: the finale compile pool must filter `learned` by origin.

### 3.7 Ripples
- `FINALE_POOLS` becomes the giant-word pool only. `collectWords` still adds its words to `DICTIONARY` (`world.js:267`), so keep that call.
- Objective text (`game.js:864`), the How to Play card, Noam's DESK_AFTER line and the ending screen all describe the old fight.
- The `finale` achievement stays as is. Add one for a flawless run (no pips lost) and one for Boss Rush.
- The warp code for the finale still works; it just lands in the new fight.
- `dev/autoplay.js` will need a way through the new beats if Bot runs are expected to reach the ending.

---

## Order of work
1. **The Rotling mix:** generators, the bag, dessert, and the audit. Small, independent, and something every level feels at once.
2. **The fight spine:** the state machine, pips, phase restart, seeded RNG, dev commands. Bring the existing panel-based beats over first: 3 Shape Shift, 4 Swarm (without real time at first), 6 Family Web, 7 Forge, 8 Detective.
3. **The new UIs:** 1 Volley, 2 Twin Roots, 5 Spell Strike, 9 Giant Word.
4. **The show:** Rot forms, bars, music, taunts, Swarm in real time.
5. **The aftermath:** Test Results, report and exit-ticket fields, Boss Rush, mutations.

## Keep (this is crunch)
- **Triskaidekaphobia as the final word**, with its pieces earned in the Greek levels. It's a test you were secretly prepared for.
- **The always-shown explanation** (van der Kleij). The boss changes what a miss costs, not whether you learn from it.
- **The seam count is always shown in DEBUG**, so splitting tests morphology, not guessing.
- **The spin-up and SAFE_CLICKS on the BUILD rings.** Composition beats should still never show the answer one tap away.

## Next playtest
Watch three students who cleared all three rooms go through phase 1 only. Does a lost pip feel fair, and does "the Rot rewrites the phase" make them lean in or give up?

# CyberMorph plan — Levels, Characters, Polish (1.3 → 1.5)

Plan approved by Phil, 20 Oct 2026, with the edits in decisions 8–13.

**Status (20 Oct 2026).** 1.3.0 Plain Controls is built. 1.4.0 is in progress: the level engine (`js/game/game.js`, levels section), 29 generated levels (`scripts/build-cybermorph-levels.mjs` → `js/data/levels.js`), the minigame harness with a fallback game (`js/minigames/harness.js`, `generic.js`), the fresh-start save, Exit Ticket minigames, and the one dialogue rewrite (`js/data/levelLines.js`). Still open: the 20 family minigames and the mentor portraits (separate sessions). Neither is pushed live.

**What the generator found.** Two-dial levels with 5+ real words are rarer than planned, so a second pass accepts 4 words on two dials (3 on three). Sibling spellings (fac with fact, pos/pose/pon with pone) are earned on one node: same meaning, different clothes. `bene` has no 3 × 3 word set in the bank, so it is earned as an extra node in Latin level 1 rather than heading its own level. That breaks decision 11 for one morpheme. Fix by adding bene words (benefit, benefactor, benevolent) to the bank.

**Source of truth.** The engine at `b3c273e3` (Exit Ticket mode): `js/game/game.js` (`runMentor`, `teach`, `updatePlayer`), `js/panels/compile.js`, `js/compiler/drum.js`, `js/panels/lesson.js`, `js/ui/dialogue.js`, `js/engine/characters.js` (`createMentor`), `js/engine/renderer.js` (camera rig), `js/game/waves.js`, and the district data in `js/data/anglo.js`, `latin.js`, `greek.js`, `lingo.js`. Student feedback is from the playtest on 20 Oct 2026.

**Not checked.** I have not reproduced the "error bug" one student mentioned, and I have no screenshots of the "text too big / overlapping" reports beyond the drum screenshot Phil attached. Both go in Phase A as a reproduce-first sweep.

## Decisions (locked with Phil, 20 Oct 2026)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Minigames | **About 10 meaning-family templates** that every morpheme reskins, **plus bespoke showcase minigames** for the headline bases of each district. |
| 2 | Prefixes | **Alternate level types.** Base + suffix levels (3 × 3), prefix + base levels (3 × 3), and later three-dial levels. The third dial is the difficulty ramp. |
| 3 | Class time | **Short minigames everywhere.** Each is capped at 30–45 s. Exit Ticket mode uses the same levels. |
| 4 | Movement | **Smooth movement and a drag camera.** The grid stays underneath. |
| 5 | Mentors | **Expressive 2D portraits with moods, plus 3D gestures in the room.** |
| 6 | Saves | **Fresh start.** New save key. Old saves are archived, and cosmetics carry over. |
| 7 | Rotlings | **Rotling types ship with the overhaul**, as the level's obstacles. |
| 8 | The verb | **BUILD** replaces COMPILE on the button, in the menus and in Exit Ticket text. The button reads **BUILD ⏎** and is keyed to Enter. |
| 9 | Releases | **1.4 and 1.5 merge.** Dialogue is rewritten once, for the level structure. |
| 10 | Slow building | **Every compiler opens with an animation.** The dials assemble morpheme by morpheme, then spin like a slot machine and stop. The stop is **never** on the answer and never within two clicks of it on any dial. |
| 11 | Coverage | **Every morpheme in the bank belongs to a minigame family.** The ten big families cover most of them. Up to six single-morpheme families are allowed for the leftovers, and each gets its own dedicated level. Nothing feels thin. |
| 12 | The meal | **Minigames are the appetizer, building is the main course, Rotlings are dessert.** Every level is served in that order. |
| 13 | Firewalls | **Firewall gates must read as gates at a glance.** The Anglo-Saxon `firewall` prop is replaced by a `desktop` prop, so there is only one kind of firewall in the game. |

---

## What the students said, sorted

| Theme | Count | Quotes (short) | Where it lives in the code |
| --- | --- | --- | --- |
| Repetitive | 4 of 10 | "it gets repetitive", "very repetitive and got boring very quickly" | Every batch is the same loop: a lesson card, then 4–8 identical requests (`runMentor`, game.js:1120). All three districts use one room template: gate / Rotling hall + terminal + gate / link + case + core. |
| Basic, cheap, "made with AI" | 3 | "kinda basic", "plain", "felt like a game made with ai and in one night… add character" | The dialogue portrait is one letter (`SPEAKERS` in dialogue.js:9). The mentors are 6–10 primitives each (`createMentor`). The lines announce personality instead of showing it (see Fix 2). |
| No choice | 1 | "no choice 1 after the other" | Batches run in a fixed order, and so do their tasks. |
| Too easy / unclear | 1 | "make it harder", "make the directions more clear" | Request 1 shows the answer's pieces on 4–5 option rings with no pressure. The controls hint is one dim line (compile.js:196). |
| Movement and camera | 1 | "movement is more blocky", "can't move the screen" | Tile-by-tile pathing at speed 4 with 4-way input (`updatePlayer`, game.js:463). The camera turns in 45° steps with 7 fixed zooms (renderer.js:18–21) and has no drag. |
| Text bugs | 2 | "text too big or… overlapping", "I can't see" | The attached screenshot: on a long ring, faces at grazing angles draw as squeezed, scrambled text strips (`createDrum`, drum.js; virtual rings with N = 8). |

The batch sizes explain "repetitive" in numbers. A batch is one lesson card that teaches all its morphemes at once, followed by its requests:

| District | Morphemes taught per card | Requests per batch |
| --- | --- | --- |
| Anglo-Saxon | 7, 12, 10, 15 | 4, 5, 4, 8 |
| Latin | 10, 8, 9, 15, **19**, 14 | 6, 6, 7, 8, 8, 7 |
| Greek | 8, 6, 6, 9, 13 | 6, 6, 4, 7, 7 |

Latin batch 5 puts 19 morphemes on one card and then asks 8 look-alike questions. That card is a wall, and the 8 questions are a treadmill. Phil's level idea fixes both.

---

## The pillar (unchanged, sharpened)

**Compile a word, and the network changes.** It now runs on two loops:

- **Earn it.** Each morpheme is a 30–45 s minigame where *you do what the morpheme means*. You carry the cargo for `port`, crack the wall for `rupt`, spot the hidden glitch for `spect`.
- **Spend it.** Once six morphemes are earned, they sit on two dials, and you answer requests by spinning and pressing ENTER.

In one line: *do the meaning, then build the word.*

---

## The fixes, ranked by impact ÷ cost

### 1. Levels: earn six morphemes, then build with them
- **Problem.** One lesson card dumps 6–19 morphemes, then 4–8 requests use the same rings and feedback (`runMentor`, game.js:1120–1145). Nothing changes inside a batch, and nothing escalates. "1/8" in the request box reads as a counter to grind, not a level.
- **Fix.** Each mentor batch becomes one or more **levels** of about six morphemes. A level has four beats:
  1. **Opener.** Two or three mentor lines that set a small stake ("Theo's dish is pointing at the ground again").
  2. **Earn.** Six glowing **morpheme nodes** sit around the room zone. Walk to any one, in **any order**, to play its minigame. A win drops the morpheme tile, which flies onto its dial, and ends on a single line: *"You carried it across. port = carry."* Order is free, which answers "no choice one after the other".
  3. **Build.** The earned pieces are now on two dials: 3 bases × 3 suffixes, or 3 prefixes × 3 bases on prefix levels. The level asks 5 requests. Combinations that aren't requested still count: a real word goes to the Lexicon, and a structurally legal one becomes a Made-up Word.
  4. **Clear.** The level's door, bridge or firewall opens. The existing gates, terminals and cores become level clears instead of separate errands.
- **Set rule.** Each level's 3 × 3 must build at least 5 real words out of its 9 combinations, so the requests never run dry. An audit script checks this against `BANK` and `DICTIONARY`.
- **Guessing math.** With 9 combinations, random spinning finds a requested word in 5 ENTERs on average ((9 + 1) / 2). That is cheap from level 4 on. So the ramp adds a fourth decoy on one dial (4 × 3 = 12 combinations, 6.5 tries on average), and later the third dial (2 × 3 × 3 = 18, 9.5 tries). Reading the meaning has to be faster than brute force, and by mid-district it is.
- **Difficulty ramp inside a district.** Levels 1–2: two dials, no obstacle. Level 3: the first Rotling obstacle (Fix 5). Level 4+: a decoy morpheme on one dial. Late levels: three dials, and two obstacle kinds at once. Each obstacle is introduced alone before it is combined. Minigames scale too (Fix 3).
- **Alignment.** Where possible, a level is one Morpheme Magic lesson (`mm.js` already maps morphemes to lessons). The teacher's weekly rhythm then maps onto levels: teach Monday, and play that lesson's level Tuesday to Thursday.
- **Why.** Meier's "interesting decisions" and Wright's layered loops. The earn → spend shape is a resource loop (earn a part, spend it to build), which gives the request phase a reason to exist. Building Blocks STR-08 (Scenario/Mission/Campaign): the same system, re-dressed per mission, with mastery unlocking harder missions and no new rules to learn.
- **Ripples.** `runMentor` is rewritten around levels. Batch data is re-sliced: Anglo 44 → about 7 levels, Latin 75 → about 12, Greek 42 → about 7, for about 26 levels in total. Terminal and core morphemes fold into those levels. Lingo keeps its own shape (its words aren't earned pieces). `poolFor`, `taughtBy` (waves.js), How to Play, the teacher guide's lesson map, and the Exit Ticket session builder (`startTicket`, game.js:1435) all read batches and must read levels.
- **Test it.** In playtest, do students choose different node orders? Count retries per request by level. A rising first-try rate on levels 1–3 that dips on level 4 means the ramp is landing.

### 2. Mentors with faces and voices that aren't a narrator's
- **Problem.** The mentors describe their own personalities instead of showing them. Theo: *"I name every satellite with Greek parts, and I am never happy with the names."* Aurelia's progress lines all use one formula: *"Log restored: 'port' means to carry…"* Most lines are a rule explanation in a textbook voice (*"Greek words often have two bases, not one."*). The portrait is one glyph (`ƿ`, `A`, `Θ`), and the 3D mentors only bob and spin (characters.js:274–320). That is exactly what "made with AI in one night" means: tidy, correct and unattributed.
- **Fix (art).** Each mentor gets an illustrated portrait (SVG, drawn in code, no image assets) with **five moods**: neutral, pleased, worried, a character mood (Wynn: grumpy; Aurelia: glitching; Theo: starstruck; Mr. Phil: d20 grin), and a reaction to Rot. The portrait lip-flaps while text types. Each line in the data can set a mood: `['worried', 'The eclipse is in four minutes.']`. In the room, each mentor gets idle gestures and level reactions: Wynn kicks the *Unbreakable* cabinet and it flickers on; Aurelia's laurel stutters and relights as a memory returns; Theo's dish swings to point at the player when he's excited.
- **Fix (writing).** A full dialogue rewrite under these rules:
  - **Show the want, never state the trait.** Theo doesn't say he's never happy with names. He renames a satellite three times in one line.
  - **One running bit per mentor**, paid off over the district. Wynn's count never comes out right. Aurelia's sentences have literal gaps where her roots were (*"I remember the ___port… no. Gone."*), and each root the player earns fills a gap in her old lines. Theo's countdown to the eclipse moves with each level.
  - **React to what the player just did.** Openers and level clears quote the student's own words from that level ("*Transportable.* You built that. I'm naming a satellite after it.").
  - **Rules are taught by the minigame, not in lines.** No line explains a rule the next 30 seconds will show. Spelling-joint and linking-o explanations stay in compiler feedback, where they already work.
  - **Remove the tells:** "X detected" openers, colon formulas ("Log restored:"), triplets, quirks stated outright, and em dashes. Vary sentence length. Two to three lines per beat, at most.
  - I draft, and **Phil does a read-aloud pass on every line**. Mr. Phil's lines are his to write or approve. Nothing ships as "AI-voiced" without Phil reading it aloud.
- **Why.** Phil's own rule: three-dimensional characters with wants, quirks and secrets. The Millers: the world explains itself, so a character shows a rule by doing, not lecturing.
- **Ripples.** `say()` gains moods and portraits (dialogue.js). Every `say:` array in the four district files changes. The Lingo chatter rotation keeps its structure. The `speakDialogue` TTS setting is unaffected.
- **Test it.** Ask three students: "Describe Theo in three words." If the answers match the brief (frantic, punny, kind), it landed.

### 3. Minigames: ten meaning families plus showcase stars
- **Problem.** Today a morpheme's meaning is one line on a card (lesson.js:28–36). Nothing in play makes `port` *feel* like carrying.
- **Fix.** About ten templates, each built for a meaning family and skinned per morpheme (its word, its gloss, its color, its origin's material). Each has three difficulty knobs (speed, distractors, Rot interference) set by its place in the level ramp.

| # | Family | Morphemes (examples) | The minigame |
| --- | --- | --- | --- |
| 1 | **Move it** | port, fer, mit/miss, ject, tract, duct/duc, pel | Move a data packet across a gap. The verb changes the control: *carry* = hold and walk, *throw* = aim and release, *pull* = tug in rhythm, *lead* = guide a line of sprites. |
| 2 | **Break & cut** | rupt, sect, frag, tom | Hit the wall at its crack before the Rot seals it. |
| 3 | **Look & show** | spect, vis/vid, scope, photo, phan | Spot the glitch in a scene. *scope* zooms, *photo* needs a light source. |
| 4 | **Say & write** | dict, graph/gram, scrib/script, log, phon, voc | Echo a beat or trace a line. Sound-based for say-words, and drawing-based for write-words. |
| 5 | **Build & make** | struct, fact/fect/fic, form | Stack falling blocks into a shape. |
| 6 | **Hold, take, stand** | ten/tain, cap/cept/ceive, sist/stat | Catch the pieces and keep a balance. |
| 7 | **Not & against** | un, in, dis, anti, contra, de, mis | **Flip it:** the scene shows X, and you invert it (lights on → off, tie → untie). |
| 8 | **How many, how big** | mono, bi, tri, multi, micro, mega, poly | Sort and count under time. |
| 9 | **Where & when** | pre, post, fore, sub, super, inter, trans, ex, in-(into), mid, under, over | Place the piece *before / under / between / across* a moving marker. |
| 10 | **Suffix shop** | -ness/-tion/-ment/-ity, -ful/-less/-able/-ous, -ly, -er/-or/-ist | A conveyor belt: words roll in, and you stamp them into the right job (thing / describer / how / person). *-less* removes, *-ful* fills. |
| — | **Everyday base** | help, play, kind, home… (Anglo free bases) | A 5-second catch. These are words students already know, so they don't need a full game. |

- **Coverage (decision 11).** Every morpheme in `MORPHEMES` (392, Lingo aside) gets a `family` field in a new `js/data/families.js`. An audit script fails if any morpheme has no family. The ten families above take most of them. Morphemes that fit none (for example `bio` life, `therm` heat, `chron` time, `hydro` water) are grouped into new families first (Life & Body, Elements, Time), and only true leftovers become **single-morpheme families**, at most six, each with its own dedicated level. The audit reports how many morphemes each family holds, so no family is a one-trick game played 60 times.
- **The meal (decision 12).** Minigames are the appetizer: short, varied, and over before they wear out. Building on the dials is the main course and takes the most time. Rotlings are dessert: the reward at the end of a level, where students debug the fakes built from that level's own morphemes.
- **Showcase stars (bespoke).** One per headline base, about 6 per district: Anglo `un`, `less/ful`, `over`; Latin `port`, `rupt`, `struct`, `spect`, `dict`, `tract`; Greek `graph`, `scope`, `therm`, `chron`, `phon`, `bio`. Each is a full set piece of up to 60 s. They ship after the templates (Phase D), so the levels work without them.
- **The guard rail.** The design plan's own warning applies: memory games "teach the card, not the word." So every minigame must make **the meaning the rule of play**: you win `port` by carrying, and `-less` by removing. Every minigame ends on its word sum and gloss. If you can win a minigame without engaging the meaning, it's cut.
- **Failure.** Missing a minigame retries it straight away, with an easier knob after two misses. Nothing is lost. (Feed then poke: soft push-back stays the rule.)
- **Why.** Embodied meaning is a stronger retrieval cue than a gloss line, and variety at the minigame level fixes repetition without changing the build loop. Meier: one interface for building, with variety in what feeds it.
- **Ripples.** A new `js/minigames/` folder with one module per template, sharing a small harness (timer, knobs, win/miss, gloss card). Mastery (`touch`) fires on a minigame win too. Session logging (`logAttempt`) records minigame misses by family, so the teacher's mistakes table can show them.
- **Test it.** An exit-ticket meaning question after a level: is the minigame group's gloss accuracy as good as or better than lesson-card players'? The ticket data already records per-morpheme results.

#### Family coverage
The map is in `js/data/families.js` (`FAMILIES`, `FAMILY_OF`, `SUB_OF`). Run `node scripts/audit-cybermorph-families.mjs` to check it. The audit exits 1 if any non-Lingo morpheme has no family or two families, if there are more than six singles, or if a family over 60 has no subs of 25 or fewer. Today it passes: **332 of 332** non-Lingo morphemes are covered (Anglo 148, Latin 112, Greek 72; the 392 total includes 60 Lingo pieces). There are 20 families, and 4 of them are singles.

| Family | Count | Anglo / Latin / Greek | Sample |
| --- | --- | --- | --- |
| Move it | 13 | 0 / 12 / 1 | port fer ject mit miss tract duct mot kine |
| Break & cut *(single)* | 1 | 0 / 1 / 0 | rupt |
| Look & show | 10 | 0 / 8 / 2 | spect spec vis vid scope photo cover |
| Say & write | 13 | 0 / 6 / 7 | dict log phon aud onym script graph gram |
| Build & make | 8 | 0 / 7 / 1 | struct fact fect fic act techn |
| Hold, take, stand | 21 | 0 / 20 / 1 | ten tain cap cept sist stat pos pon the |
| Not & against | 9 | 2 / 6 / 1 | un in non dis de mis anti contra ob |
| How many, how big | 11 | 0 / 2 / 9 | mono bi tri deka multi poly micro mega meter |
| Where & when | 23 | 5 / 13 / 5 | over under sub super inter trans pre post tele chron |
| Suffix shop | 51 | 18 / 24 / 9 | subs: thing 18, describer 18, how 2, person 5, verb 3, ending 5 |
| Everyday base | 123 | 123 / 0 / 0 | subs: nature 20, place 10, people 10, things 18, moves 14, doing 22, feelings 15, describer 14 |
| Shape shifter | 7 | 0 / 3 / 4 | form morph gon cycl sphere plic ply |
| Join up | 7 | 0 / 3 / 4 | con syn kai homo soci o i |
| Life & body | 8 | 0 / 2 / 6 | bio gen cardi derm neur ped manu zoo |
| Elements | 10 | 0 / 1 / 9 | hydro aqua therm geo atmo astro cosm eco phys |
| Mind & feeling | 7 | 0 / 2 / 5 | psych phil phob path soph cred sense |
| People & rule | 7 | 0 / 0 / 7 | demo cracy crat arch nom anthrop hero |
| Again & back *(single)* | 1 | 0 / 1 / 0 | re |
| Good deed *(single)* | 1 | 0 / 1 / 0 | bene |
| Self *(single)* | 1 | 0 / 0 / 1 | auto |

**Judgment calls.**
- **Everyday base is 123, over 60.** I kept every Anglo free base here, as the table above plans, because they are words students already know. The plan for variety is its eight subs. Each is its own catch scene with at most 22 words (sky and sea, toybox, playground…), and each catch lasts about 5 seconds, so a level's worth is under two minutes. Anglo words that share a Latin or Greek meaning (`see`, `stand`, `write`, `build`, `hold`) stay here rather than in Look, Hold or Build, but a level can pair them as a contrast (*see* → *spect*).
- **Break & cut has only `rupt`.** The bank has no `sect`, `frag` or `tom`, so the family is counted as a single. Its template could take `sect`/`frag` later without a new game.
- **Time didn't reach four.** `chron` joined **Where & when**, whose when-words (`pre`, `fore`, `post`) already play on a timeline. `pre`/`post`/`fore`/`mid` stay there, as the table above lists them.
- **`re` is a single.** "Again; back" is neither a position nor a not. It's also the second prefix Morpheme Magic teaches, so it earns its own level (rewind and replay).
- **`bene` and `auto` are singles.** No cluster of 4+ shares "good" or "self". (`mis` stays in Not & against, as planned.)
- **Linking vowels `o` and `i` went to Join up.** They mean nothing alone, but their job is to join, which is the family's rule.
- **Put-words (`pos`, `pon`, `pose`, `posit`, Greek `the`) went to Hold, take, stand** as its "set it in place" control, not to Build.
- **Fold (`plic`, `ply`) and `cycl`, `gon`, `sphere`** joined `form` and `morph` in a new **Shape shifter** family instead of Build & make, because their meaning is a shape you bend into, not parts you stack.
- **`hyper`/`hypo`** are Where & when (above / below), to match `over`/`under`, rather than How big. **`ob`** ("against; toward") is Not & against. **`cover`** (to hide) is Look & show as its reverse, and **`sense`** is Mind & feeling, not Look. **`aud`** (hear) is Say & write's by-ear mode. **`liver`** (hand over) is Move it.
- **Suffix shop gained two subs** beyond the five jobs: **verb** (`en`, `ate`, `ize`: to make; to become) and **ending**, which holds plural and tense plus `est` ("the most"). `ant`/`ent` sit in **person** (servant, student), though they often make describers.

### 4. BUILD, visible keys, a slot-machine spin-up, and the drum text bug
- **Problem.** The button says COMPILE (compile.js:113). Enter already works (compile.js:506), but the only hint is a dim one-line footer (compile.js:196). The screenshot shows the left ring's off-axis faces rendering as squeezed, scrambled strips.
- **Fix.**
  - The button reads **BUILD ⏎**, with a keycap glyph, and Enter presses it. The sum line's "? press COMPILE" becomes "? press BUILD". The verb in menus and Exit Ticket text becomes **BUILD** (BUILD and DEBUG rounds). Debug, Patch and Link keep their names.
  - **The spin-up (decision 10).** Every compiler opens the same way. The console powers on, then each ring drops into place one morpheme at a time, left to right, with a click and its gloss. Then all rings spin together like a slot machine and stop one after another, left to right. Controls unlock only when the last ring stops. The stop is chosen, not random: on every ring that has a right answer, the stop is at least **3 clicks** from it in both directions, so the word is never shown and never one tap away. A ring with fewer than 6 options can't satisfy that, so the stop goes to the farthest face from the answer (opposite on a 4- or 5-face ring), and the plan's 3 × 3 dials get at least 6 faces from decoys. The spin-up repeats between requests (shorter, about 1.5 s). It skips only under the Reduced motion setting, and even then the stop rule holds.
  - **Why slow down?** Spinning fast to the answer is the brute-force path. The spin-up gives two or three seconds of looking at every piece and its meaning before the first tap, and the stop rule makes every answer at least three deliberate clicks per ring.
  - **Arrow keycaps on the drum.** The focused ring gets a bright outline with ▲ / ▼ keycaps above and below it, and ◀ ▶ keycaps sit at the drum's ends. On a student's first three requests the keycaps pulse once. After that they stay visible but quiet.
  - **The drum fix.** Fade each face by its angle to the camera, so faces past about 50° fade to the dark core color, and stop alpha-testing squeezed text at grazing angles. Check with a 30-option free-build ring.
- **Why.** "Make the directions more clear" plus Phil's own ask. A control students can't see doesn't exist.
- **Ripples.** How to Play text, the welcome screen, the teacher guide, the `autoplay.js` dev bot (button text), and `sw.js` cache bump.
- **Test it.** Watch for five minutes: does any student press Enter without being told?

### 5. Rotling types as level obstacles
- **Problem.** Every Rotling looks the same and is fixed the same way, by clicking the seams (debug.js). The data already has four kinds of fake: `joint`, `order`, `link`, `spelling` (waves.js header). Students asked for exactly this: "different rotling types with different things wrong with them and different minigames to fix them."
- **Fix.** Each fake kind becomes a creature with its own look and its own fix:

| Rotling | What's wrong | Its look | The fix |
| --- | --- | --- | --- |
| **Jointbug** | a spelling rule skipped (`hopeing`, `stoped`) | a bug with a cracked shell where the joint is | find the bad joint, then pick the repair (drop e / double / y→i) |
| **Flipper** | pieces in the wrong order (`lessfear`) | a two-headed bug walking backwards | swap the pieces into order |
| **Gapling** | a linking o dropped (`thermmeter`) | a bug with a hole in its middle | slot the o in |
| **Mimic** | a look-alike morpheme swapped (`-able`/`-ible`, `inter`/`intra`) | a copycat of a friendly sprite, slightly wrong | spot the impostor piece. Uses `confusedWith`. |

  In the build phase they act as **obstacles**: a Jointbug jams one dial until it's debugged, a Flipper swaps two morphemes on a dial, and a Mimic slips a look-alike onto a dial. Each obstacle is introduced alone, in its own level, with one mentor line, and later levels combine them.
- **Why.** Feed, then poke. Obstacles you learn to manage over time is Phil's own brief. It reuses data that already exists (`fake` kinds, `confusedWith`).
- **Ripples.** waves.js (Mimic is a new fake kind), debug.js (four fix flows), characters.js (four Rotling bodies), and the teacher mistakes table (it already logs by kind).
- **Test it.** Does the Jointbug dial jam cut repeat joint errors on the next level? The session log can count this.

### 6. Smooth movement and a drag camera
- **Problem.** WASD steps tile by tile, in four directions (`stepDir` / `updatePlayer`, game.js:463–490). The camera turns only in 45° steps, with seven fixed zooms and no drag (renderer.js:18–21).
- **Fix.** The player keeps a continuous position and collides against blocked cells one axis at a time, so walking along a wall slides instead of stopping. Diagonals work. `p.c / p.r` are derived from the position, so every adjacency check still works. Click-to-walk keeps grid pathing. Camera: left-drag on empty floor orbits freely, right-drag or two-finger drag pans (clamped to the room), the mouse wheel zooms, and ZOOMS gains a wider step (about 2.0) so the whole room fits. Q/E, Z/X and VIEW still work.
- **Why.** Feel is the first thing a middle schooler judges. This is cheap, contained and visible.
- **Ripples.** `onEnterCell` must fire when the derived cell changes. Rotling bump-back and `adjacent()` use cells (fine). The click-to-walk pending-use logic (game.js:492) stays.
- **Test it.** In playtest, nobody uses the word "blocky".

### 7. Firewalls that read as firewalls
- **Problem.** The Anglo-Saxon Room has a `firewall` *prop* (`fire + wall`, anglo.js prop `b`) beside the real firewall *gates*. Students see two firewalls, and only one is a door.
- **Fix.** Replace the prop with a **desktop** (`desk + top`), with a small desk-and-monitor model. Rebuild the gates so they read at a glance: a full-height wall of flame-coloured light bars across the corridor, a padlock icon with the label FIREWALL above it, and a pulse when the player is near. When the gate opens, the bars drop into the floor. The word `firewall` stays in the terminal task as a meaning request, because the gate now *is* its picture.
- **Ripples.** anglo.js props, `props.js` (new `desktop` model, gate model), the `fire` + `wall` morphemes stay taught (the terminal still uses them).

### 8. Fresh start and polish sweep
- **Fresh start.** A new save key (`cybermorph.v2`). The old save is copied to `cybermorph.v1.archive`, and cosmetics and unlocked parts carry over. A one-line notice on the title screen: "CyberMorph has levels now. Your Morpher kept its look."
- **Text sweep.** Every panel is checked at 1366 × 768 and at 125% browser zoom: lesson grid, compile tray, How to Play, patch notes. Any overflow is fixed with clamp-based sizes. This is where "text too big / overlapping" and "I can't see" get reproduced and fixed.

---

## Phases and versions

| Version | Title | Contents | Size |
| --- | --- | --- | --- |
| **1.3.0** | Plain Controls | Fix 4 (BUILD, keycaps, the slot-machine spin-up, drum bug), Fix 6 (movement, camera), Fix 7 (firewall gates, desktop prop), the text sweep from Fix 8 | medium; can ship before the next class |
| **1.4.0** | Faces, Voices and Levels | Fix 1, Fix 2 and Fix 3: the level engine, families covering every morpheme, ~10 templates plus single-morpheme families, ~26+ levels, portraits, moods and 3D gestures, the one dialogue rewrite written for levels, the fresh-start save, Exit Ticket on levels | large |
| **1.5.0** | Rot Zoo | Fix 5 (four Rotling types as dessert and as obstacles), plus the showcase-star minigames | medium-large |

---

**Keep — this is crunch.**
- **One compiler for every verb.** The minigames feed it, and it doesn't get replaced.
- **Feedback that blames the machine**, with retry until right and first try recorded quietly (compile.js header).
- **Showing only the chosen pieces until ENTER**, so the spelling joint stays a reveal.
- **Made-up Words.** On 3 × 3 dials they become *more* common and more fun, so keep the save prompt.
- **The Secret Secretary Desk** and the three keyword clues.
- **Exit Ticket logging by lesson and mistake kind.** It is the evidence for whether minigames teach.

**Next playtest.** After one level of Latin, ask: "What does *port* mean, and how do you know?" If students answer with what they *did* in the minigame ("you carry stuff"), the earn loop is teaching. If they quote the gloss card, it's decoration.

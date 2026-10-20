# CyberMorph design plan — 0.0

Plan only. Nothing here has been implemented.

**Source of truth for this plan.** I read the Tech Escape and Somnia/Ainmos source and docs in this repo: `src/site/tech-escape/README.md`, `CHANGELOG.md`, `js/minigames/quiz.js` and the `index.html` HUD; `src/site/somnia/index.html` and `js/` module map; and `research/ainmos-mobile-layout-research.md`. I also read the existing Morphology Garden: `src/site/morphology/index.njk`, `scripts/morphology-morpheme-catalog.js`, `scripts/morphology-words-data.js` and `scripts/audit-morphology-bank.mjs`. The research sources are listed at the end.

**Not checked.** I could not open these, so any claim about their contents is secondhand:
- the full text of the 2024 Colenbrander meta-analysis (paywalled), so I have its abstract findings but not its moderator analysis;
- Morpheme Magic's internal lesson routine (the publisher pages give its scope, not its steps);
- the full Kieffer & Lesaux (2007) article.

## Decisions (locked with Phil, 19 Oct 2026)

| # | Question | Decision |
| --- | --- | --- |
| 1 | Title | **CyberMorph** |
| 2 | Theme | **A full cyber reskin.** The three layers of English are three districts of a computer network. |
| 3 | Camera | **A 3D diorama.** Simple to display, easy to code, and intuitive for casual players, paralax effects with 3D elements that make the diorama view pop. |
| 4 | Grades | **6–8** |
| 5 | Device | **Chromebook first.** Phones don't matter. Everything must work within a school Chromebook's limits. |
| 6 | Stakes | **Soft push-back** from district 2 on. You never lose knowledge or words. |
| 7 | Spanish cognates | **A setting, off by default** (plus a teacher link flag). |
| 8 | Data | **Fork a copy** of the Morphology Garden data into the game. |
| 9 | Names | **Plain names.** Districts are named by origin (Anglo-Saxon, Latin, Greek, Lingo). The pieces are called **morphemes**, never "chips". The villain is **the Rot**, its creatures are **Rotlings**, and the pressure gauge is the **Rot meter**. "Beta Words" became **Made-up Words**. The verbs COMPILE / DEBUG / PATCH / LINK stay. |
| 10 | Lingo District | **Hidden in plain sight** on the hub: the **Secret Secretary Desk**, locked by three keywords earned at the end of the three main districts (Part 2, "The Secret Secretary Desk"). |
| 11 | Lingo mentor | **Mr. Phil**, at the Smart Board in his own CS classroom. |
| 12 | Lingo content | All four kinds: reductions and contractions, clippings and blends, compounds and phrases, old affixes on new bases. |
| 13 | Saves | **Browser only.** `localStorage`, no save codes, no server, no online leaderboard. |
| 14 | Arcade page | **Console + cartridge rack.** An 80s console up top, cartridge spines in a rack below, and a slot-in animation before a game opens. |
| 15 | Build | **The whole game with starter content**, on a `cybermorph` branch. |

---

## The pillar

**Compile a word, and the network changes.** The player assembles real English words from morphemes in a 3D diorama of a computer world. Meaning comes first, then structure, then family. Every morpheme shows what it means. Every word compiled shows its word sum. Every word belongs to a family you can see grow.

In one line: *4 layers, 4 districts, one compiler.*

---

## Part 1 — What the research says

### Morpheme Magic

Morpheme Magic (95 Percent Group, Deb Glaser, 3rd edition) is a **teacher-led lesson program, not a game**. It has 52 lessons in four strands: **suffixes, prefixes, roots, and Greek combining forms**. It is for grades 4–12 and takes about 20 minutes a day. It comes with wall cards, slides, printable student pages, and a criterion assessment in every lesson. The publisher's free sample is Suffix Lesson 5, on **-er / -or**.

What the game takes from it:
- **The four strands as the content spine.** The game's districts follow the same order of strands.
- **A daily 10–15 minute shift.** The game is the practice partner for a 20-minute lesson, not a replacement for it.
- **No copying.** The game never reproduces Morpheme Magic's lessons, cards or wording. A teacher picks which morphemes to practice (Part 6), so the game fits Morpheme Magic, SWI, or anything else a school teaches.

### Other morpheme tools

| Tool | What it is | What to take | What to avoid |
| --- | --- | --- | --- |
| **SWI word matrix + word sums** (Bowers; Ramsden's Mini Matrix-Maker / Word Microscope) | Prefixes in the left column, the base in the middle, suffixes on the right. You read left to right, take one piece per column, and may not skip a column. Word sums show the build: `re + port + er → reporter`. | **The compiler *is* a matrix**, with the same rules. Word sums appear on every compile. | Nothing. This is the core. |
| **Monster, P.I.** (Goodwin, Vanderbilt / FCRR / FSU, funded by IES) | A middle-school assessment game with a story mode. You build a monster in a Monster Shop. | Proof that a story wrapper and avatar customization work for middle-school morphology. | Its task details are not public, so don't claim to match it. |
| **Word Explorer** (Stanford LDT master's project, 2022) | A web game for grades 3–6. You build words from bases and affixes and link them to meaning. | It confirms the build-a-word verb. | It has no published outcome data, and it is pitched younger than 6–8. |
| **WordBuild** (Dynamic Literacy) | An online program that adapts to the student, with a short video on each week's affix. | One short, explicit intro for each new morpheme. | — |
| **Teach Starter, This Reading Mama, Twinkl, Spelfabet** | Printable bingo, blackout, memory, Go Fish and four-in-a-row games. | Sorting and matching are cheap ways to practice. | Matching alone is recognition, not building. Pure memory-card games teach the card, not the word. |

**The gap.** None of these is a 3D world where words do things, and none is aimed at middle schoolers who want something that looks like a real game. That gap is the opening.

### Pedagogy: the evidence and what it means for the design

| Finding | Source | Design rule |
| --- | --- | --- |
| Morphology instruction has small-to-moderate positive effects. They are **largest on tasks that work on morphemes inside words**, smallest on passage comprehension. It works better **combined with other literacy instruction**. | Bowers, Kirby & Deacon 2010 (22 studies) | Make compiling and debugging words the core verbs. Pair every morpheme with its sound (TTS) and spelling. Don't promise comprehension gains. |
| Overall d ≈ 0.33 for children with literacy difficulties. Morphological awareness and vocabulary ≈ 0.40, spelling ≈ 0.20. | Goodwin & Ahn 2010 (17 studies); update 2013, d ≈ 0.32 | Struggling readers benefit too, so design for them first: no timers by default, TTS, dyslexia-friendly type. |
| Effects are bigger on **trained words than untrained words**. **Spelling** transfers to untrained words, but **reading does not**. There was no clear effect on comprehension. | Colenbrander et al. 2024, *Educ. Psych. Review* 36:119 (28 studies, 177 effects) | Build transfer in on purpose. **Unknown Files** are new words made of known pieces, and students must work out what they mean. **Firewall locks** put words in sentences. |
| Teach morphology as a **strategy**: notice you don't know a word, split it, infer the meaning, check it against context. It may help English learners most, taught alongside cognates. | Kieffer & Lesaux 2007 | The **Word Detective** routine does exactly this. Spanish cognates are a setting (Decision 7). |
| The explicit routine: teach the spelling, sound and meaning, show it in words and sentences, build with old and new pieces, then keep reviewing. | Windward summary of explicit morphology teaching | Each new morpheme gets a 20-second intro from a mentor, then guided compiling, then compiling on your own, then spaced review. |
| English has three layers: **Anglo-Saxon → Latin → Greek**. Teach them in that order. | Henry, *Unlocking Literacy*; Henry 2017/2019 | The three layers become three districts (Part 2). For grades 6–8 the Anglo-Saxon district is a short warm-up, and the weight goes to Latin and Greek. |
| **Elaborated feedback** (explain why) beats right/wrong. | van der Kleij et al. 2015, already applied in Tech Escape `quiz.js` | Every compile explains itself, including correct ones. Students retry until right. First-try results are recorded quietly. |
| Retrieval, spacing and interleaving beat massed practice. | Roediger & Karpicke 2006; Cepeda et al. 2006; Rohrer & Taylor 2007 (standard findings, not re-checked here) | A Leitner-style mastery level per morpheme. Review shows up in the game world as morphemes losing mastery. Look-alike morphemes (from the catalog's `confusedWith`) are mixed together on purpose. |

---

## Part 2 — The game

### In one paragraph

You are a new **Morpher**, a small customizable repair bot, on **The Lexinet**, the network that stores every word. At its core runs the **Lexicon Tree**, a glowing fractal data tree whose leaves are words. A corruption called **the Rot** has shattered words into loose **morphemes** and spawns **Rotlings**: buggy creatures made of nonsense. You work through three districts, one for each layer of English, and a fourth secret one for the English you already speak. In each you collect morphemes, compile real words at the **Morph Compiler**, debug Rotlings back into clean pieces, and hang every word you make on its family branch of the Lexicon Tree. Your words open firewalls, bridge data gaps and reboot the district mentors.

### The world: three layers, three districts, and a secret fourth

| District | Layer | Look | Morpheme style | Teaches (grades 6–8 weighting) | Spelling joints |
| --- | --- | --- | --- | --- | --- |
| **The Anglo-Saxon District** (start, short) | Anglo-Saxon | A retro 8-bit terminal town: amber phosphor screens, chunky cables, arcade cabinets. | **amber CRT glass** | Quick review of `-s/-es -ed -ing -er -est -ful -less -ness -ly -y`, `un- re- mis- over- fore-`, compounds (`key + board`, `fire + wall`). 1–2 shifts. | drop e (`hop(e) + ing`), double the consonant (`run + n + ing`), y → i (`happ(y→i) + ness`) |
| **The Latin District** | Latin (and Latin via French) | A data center built like a Roman forum: white server racks as columns, aqueduct-style cable runs, marble-white light. | **grey marble** | `port rupt struct spect dict tract ject form scrib/script mit/miss duct fer vis/vid cede/ceed` · `in-/im-/il-/ir- inter- sub- trans- de- ex- con-/com- pre- dis- ad- contra-` · `-tion -able/-ible -ive -ment -or -ity -ous -ence/-ance` | prefix assimilation (`in + mobile → immobile`, `ad + tract → attract`), `-able` vs `-ible`, `-tion` vs `-sion` |
| **The Greek District** | Greek | A satellite dish and star tracker in orbit, with holograms and blue starlight. | **holographic blue** | `bio geo graph/gram phon photo tele micro scope logy therm auto meter chron hydro psych demo crat` | the linking `o`, stress shifts (PHO-to-graph → pho-TOG-ra-phy), `ph` / `ch` / `y` spellings |
| **The Lingo District** | Conversational Middle School English | A clean computer science classroom, computers and desks and a Smart Board on the left.| **white lined paper** | Teaches threads and connections between common everyday phrases that students use and the morphemes from previous lessons and new multisyllabic words. This District should teach students that morphemes are everywhere and they use them all the time, and unlocking their meaning unlocks new worlds of words to them. | Show how slang is often modified/morphed/truncated English |

Academic words for grades 6–8 come from science and social studies on purpose: `transportation`, `interruption`, `photosynthesis`, `thermometer`, `democracy`, `chronological`.

**The hub** is the Core. Each base you meet grows a branch of the Lexicon Tree, and each word you compile hangs a glowing leaf on it. It reuses the Morphology Garden's tree idea (`morphology-garden.js` already draws trees in three.js).

The morpheme style is the layer, so a word's origin is visible without a label. (The Millers: the world explains itself.)

### Characters: mentors with wants

Following Phil's rule, no mentor is called "The Teacher." All three are programs with a personality.

- **Old Wynn**, an early maintenance program in the Anglo-Saxon District. (Wynn, ƿ, is a lost Old English letter.) She talks in short, plain words. She wants to reboot her arcade cabinet, the *Unbreakable*, before the district shuts down. Quirk: she counts everything aloud with `-s` and `-es`.
- **Aurelia Cache**, the Latin District's archive AI. The Rot corrupted her memory, so she is literally missing her roots, and each root you return restores a line of her log. **Secret:** she released the Rot herself on accident by compiling a word that exploded. That sets up Made-up Words (below).
- **Theo Parsec**, the Greek District's satellite operator. He names every satellite with Greek compounds and is never happy with them. He wants to finish his star map before the eclipse cuts the uplink.

- **Mr. Phil**, in the Lingo District. He is himself, at the Smart Board in his computer science classroom. He connects each everyday word back to the morphemes students learned in the three main districts.

The player's **Morpher** can be customized (chassis, colour, face screen) with parts unlocked by compiling. Monster, P.I. shows that avatar customization works for this age. Customization and unlocking customizations is a strong design choice for middle-schoolers.

### The Secret Secretary Desk (how the Lingo District unlocks)

- **Hidden in plain sight.** An ornate secretary desk stands in the hub from the first visit, with a golden plaque on its desktop that reads **Secret Secretary Desk**. Clicking it zooms in on a locked drawer with **three combination letter locks**. Players learn about it early and wonder about it all game.
- **Three keywords, three districts.** Finishing each main district reveals one keyword, a single morpheme, in its mentor's last line and on a clue card added to the inventory:
  - the Anglo-Saxon District gives the **prefix**;
  - the Latin District gives the **base**;
  - the Greek District gives the **suffix**.
- **A new puzzle every run.** The three keywords are drawn at random when a save is created, from a pool of three-morpheme words, so every browser run has its own key. Examples: `bene + fic + ial → beneficial`, `in + scrip + tion → inscription`, `un + tie + ed → untied` (tie's `e` drops), `re + act + ion → reaction`, `dis + rupt + ive → disruptive`, `pre + dict + able → predictable`, `trans + port + er → transporter`.
- **Each lock spells one morpheme.** Each lock has letter wheels for its morpheme's length. When all three are right, the morphemes slide together, the spelling joint animates, and the full **key word** is built and spoken. Then the drawer opens into the Lingo District.
- **Fair clues.** The clue cards say what each keyword *is* (prefix, base, suffix) and what it *means*. A player who forgets one can return to its mentor, who repeats it.

### The Lingo District (Mr. Phil's classroom)

**Pillar:** morphemes are everywhere, including in the words students already use, and knowing them opens new words.

Every Lingo word gets a card with five lines:
1. **The word** as students say it.
2. **What it means.**
3. **Its morphemes**, as a word sum that shows the change: `fix + ing + to → fixin' to → finna`.
4. **How it changed**: reduction, contraction, clipping, blend, compound, conversion, or new meaning.
5. **Where it comes from** (AAVE, Southern US English, internet and gaming, or general English) and one line that links it to an academic word with the same morpheme.

**The respect note.** Every dialect has rules. AAVE is a full, rule-governed variety of English, and slang is not "wrong English". It is English doing what English has always done: reshaping morphemes. *Finna* gets its own spotlight: it comes from *fixing to*. Linguists call one form that carries several morphemes (`fix + -ing + to`) a portmanteau morph, and here that form was then worn down in speech to *finna*. It means "about to".

| Process | Starter words |
| --- | --- |
| **Reductions and contractions** | finna (fix + ing + to), gonna (go + ing + to), wanna (want + to), gotta (got + to), aight (all + right), 'sup (what + is + up), y'all (you + all), let's (let + us), ain't |
| **Clippings and blends** | sus (suspicious), rizz (charisma), bro (brother), fam (family), vibe (vibration); situationship (situation + relationship), frenemy (friend + enemy), brunch (breakfast + lunch) |
| **Compounds and phrases** | crash out (crash + out), glow-up (glow + up), lowkey / highkey (low + key), no cap, let's go!, hey (one free morpheme, no parts) |
| **Old affixes, new bases** | cooked (cook + ed, now "doomed"), goated (G.O.A.T. + ed), ghosted (ghost + ed, noun → verb), unbothered (un + bother + ed), rewatchable (re + watch + able), bet (an old word with a new meaning) |

The verbs work the same here. COMPILE builds `un + bother + ed`. DEBUG splits `situationship`. PATCH fits *"I'm ___ to leave"* → `finna`. LINK hangs `sus` on the same branch as `suspicious` and `suspect`. Before release, a teacher reviews the word list for anything inappropriate at their school.

### The four verbs, one interface

Meier's Covert Action rule: two games inside one game fight each other. So there is **one interface**, the morpheme and the matrix, used for four verbs.

| Verb | Morphological skill | What the player does |
| --- | --- | --- |
| **COMPILE** | putting a word together from its meaning | A mentor or a firewall asks for a meaning: *"able to be carried from one place to another."* You turn the compiler rings to `trans + port + able` and hit Compile. |
| **DEBUG** | taking a word apart | A Rotling crawls up wearing a word, like mispelled `interruption` or the nonsense `unhopeing`. Click the seams to cut it into morphemes. A real word breaks clean, drops its morphemes and becomes a friendly helper sprite. A nonsense word shows the bad joint and dissolves into its component morphemes. |
| **PATCH** | suffix grammar in a sentence | A firewall lock reads *"The volcano is still ___."* You turn the suffix ring on `act` until `active` fits. Other locks ask for `action`, `actively` or `react`. |
| **LINK** | which words are related | At the Lexicon Tree, hang words on their base's branch. Some are false friends: `corner` is not `corn + er`, and `report` is not `rep + ort`. Catching one gives a satisfying sparkle spark. |

Every verb uses the same morphemes and the same word-sum readout. A student who learns one has learned the controls for all four. They should be able to learn the entire base mechanics and GUI of the game in 2 minutes or less.

### The Morph Compiler (the 3D centerpiece)

The compiler is a **3D drum of rotating rings** on a terminal console, like a cryptex rebuilt as hardware.

- **Columns, left to right:** prefix ring(s), the base core (fixed, set by the request or picked from your inventory), and suffix ring(s). This follows Ramsden's matrix rule: one piece per column, and no skipping a column.
- **Shape is the rule.** Prefix morphemes have a connector pin on the right. Suffix morphemes have a socket on the left. Base morphemes are square cores. Morphemes only seat in their own column, so the structure is learned by touch. This is the same non-colour channel idea as Tech Escape's `SLOT_SHAPES`.
- **Live meaning.** Under each ring the gloss updates as you turn it (`trans-` *across*, `port` *carry*, `-able` *can be*). Under the whole drum, the word sum prints like a compile log: `trans + port + able → transportable`.
- **Joints are animated.** When a spelling rule fires, the compiler shows it: the `e` of `hope` is ejected as a little spark before `-ing` seats. The rule is shown, not just stated.
- **Literal vs today's meaning.** A compiled word shows two lines: *Root sense: carry back.* *Today: a person who brings back the news.* This is honest about meaning drift, which SWI cares about.
- **Compile to commit.** Commit is a two-step action (the big Compile button), with the 350 ms open lockout from Tech Escape `quiz.js`. The word is spoken on every compile.
- **Made-up Words (the "No, but you could…" rule).** If you compile a word that is legal in structure but not in the dictionary, such as `unsad`, the compiler doesn't say "wrong." It says *"That word isn't in the Lexicon yet. Save it as a made-up word?"* It goes into your Made-up Words list with its built meaning (*not sad*). Beta words don't count toward requests, but they are a safe, playful use of morphology. Aurelia's secret makes them a story beat: she pushed a made-up word into the core and it broke, so the Made-up Words list also teaches the line between *possible* and *real*.

**Controls (casual-first).**
- Click the ▲ / ▼ arrows above and below a ring, or scroll over it. The keyboard alternative is ← / → to pick a ring and ↑ / ↓ to turn it.
- Click the big Compile button, or press Enter. Click 🔊 or press R to hear it.
- There is no dragging, right-clicking or holding anywhere, so it works on every Chromebook trackpad and touchscreen.

### Loops on three time scales

Meier's "one more turn": something is always about to pay off and this keeps momentum with the player moving forward.

| Scale | Length | Loop | Payoff |
| --- | --- | --- | --- |
| **Moment** | 20–40 s | read a meaning → turn the rings → compile → read the feedback | the word builds in 3D, a word sum, its sound |
| **Errand** | 3–5 min | go to a mentor or firewall → 3–5 requests → debug the Rotlings blocking the path | a firewall opens, a data bridge forms, a mentor speaks |
| **Shift** | 10–15 min | one daily session: new morphemes from a mentor, errands, a review run, one Unknown File | morphemes regain mastery, Lexicon leaves, end-of-shift patch notes |
| **Campaign** | weeks | Anglo-Saxon (1–2 shifts) → Latin (~5–6) → Greek (~4–5), with the Lingo District found along the way | a district cleared of Rot, the Lexicon Tree lights up, the finale |

**End-of-shift patch notes** borrow from Ainmos 0.30 Dream Tales and from Phil's own changelogs. They are a short, generated release note that uses **the words you compiled today** in sentences about the network: *"Patch 1.3: Interrupted uplink restored. Theo called the new satellite transportable."* It is the reading-in-context step for free.

### The learning engine

- **Mastery levels (Leitner 0–4) per morpheme**, shown in the world as **morpheme mastery**: dim → lit → gold.
- **Losing mastery is spacing.** Morphemes you haven't used lose mastery over days (1, 3, 7, 14-day gaps by level). Low-mastery morphemes turn up in Rotlings or requests, and using one restores it. Forgetting is shown as a place to go back to, not a red bar.
- **Interleave the look-alikes.** The catalog's `confusedWith` field (102 rows) drives mixed sets: `-er/-or`, `in-` (not) vs `in-` (into), `-able/-ible`, `inter-/intra-`, `-tion/-sion`.
- **Unknown Files for transfer.** Each shift gives one unfamiliar word built only from mastered pieces (`transportable`, `interruption`). The player must debug it and pick its meaning. This targets the weak reading transfer that Colenbrander found.
- **Word Detective (the Kieffer & Lesaux strategy)** comes up when a sentence has a word you haven't met: (1) flag the word you don't know, (2) split it, (3) say what each piece means, (4) check the sentence. The four steps sit on screen as a small fixed card.
- **Feedback rules** come from Tech Escape `quiz.js`, unchanged. An explanation on every attempt. Retry until right, with first try recorded quietly. Wrong answers blame the machine: *"Compile error: the joint won't hold"* or *"The firewall rejects that format."* The words quiz, test, score and grade never appear.

### Failure and stakes (Decision 6: soft push-back)

Feed information, then poke for understanding, but not too much.

- **Anglo-Saxon has no failure state.** It is a safe first shop.
- **From the Latin District on, the Rot level is a meter you can see** (TRN-13 Time Track). Rotlings left alone push it up. At 100% the district **crashes**: you reboot at the last save terminal, and your loose, uncompiled morphemes drop where you stood. They stay there, glowing, and you can pick them up again. Failure costs time and mild irritation, never knowledge or words.
- **Overclock Mode** (optional, unlocked after Anglo-Saxon) adds a timer, more Rotlings and a final score. It is opt-in, for students who want pressure. Do not bother with a digital leaderboard functionality. Players can easily save a screenshot of their final score and submit this to the teacher for proof of doing the activity and the score of the game.
- Debugging a Rotling wrong doesn't hurt you. It bumps you back one tile and the explanation appears.

### Mechanisms (Building Blocks codes, from the code index; the PDF is not in `research/`)

| Code | Where |
| --- | --- |
| SET-02 Tile-Laying | morphemes seating in matrix columns |
| SET-01 Set Valuation | Lexicon families pay more when complete (all the known `port` words) |
| ECO-15 Contracts | mentor and firewall requests |
| ACT-15 Gating and Unlocking | firewalls open with words, and districts open with mastery |
| ACT-16 Tech Trees | the Lexicon Tree itself: bases → words → families |
| TRN-13 Time Track | the Rot meter |
| TRN-07 Real-Time | Overclock Mode only |
| STR-08 Campaign | Anglo-Saxon → Latin → Greek → Lingo|

The book's PDF wasn't found at the path `bb_lookup.py` expects, so these codes come from the skill's index only. Read the entries before relying on any pitfall.

---

## Part 3 — Layout, camera and GUI

### The diorama camera (Decision 3)

- **Each area is one diorama:** a self-contained 3D room on a tile grid (about 12×12 tiles), seen from a fixed three-quarter view above. Think of a cutaway model on a table. Think of isometric perspective videogames.
- **Perspective camera with a narrow field of view** (about 30°), so it reads almost like a flat 2D board but keeps real depth and lighting. The camera never needs the player to steer it.
- **Gentle parallax:** the diorama tilts a few degrees toward the mouse. It is cheap and makes the 3D obvious. It turns off with Reduced motion.
- **Click to move.** Click a tile and the Morpher walks there along a grid path (A* on the tile grid). Click a thing to walk to it and use it. WASD and arrows also work for students who want them.
- **Moving between areas:** walk through a glowing port at the diorama's edge. The camera does a short slide to the next diorama, and the next room builds itself in, tile by tile. This is a cheap, impressive 3D moment that also hides loading.
- **Zoom on focus.** Opening the compiler, a Rotling, or a firewall lock zooms the camera onto that object while the room dims. Closing zooms back. No separate 2D screens are needed: the panels sit *in* the diorama.

**What makes it pop (the 3D on top of a flat-feeling view):**
- morphemes are real 3D objects that float, spin slowly and glow by mastery;
- the compiler drum is a real 3D model whose rings visibly turn and click;
- Rotlings are 3D creatures whose bodies are built from their word's letters, and debugging splits them in 3D along your cuts;
- leaves pop onto the Lexicon Tree in the hub with a burst of light;
- emissive "neon" edges on everything interactive, so clickable things read at a glance and with high contrast.

### Reuse from Tech Escape and Somnia

| From | Reuse |
| --- | --- |
| **Tech Escape** | A vendored `three.module.js`, with no build step and no network, so it runs on a locked-down school network. HUD regions: a top objective card, a top row of slots (the code pieces become **word slots**), an interact prompt, a caption stack, a toast stack. Screens for first run, profile and settings. Floor arrows toward the current goal. `quiz.js` feedback rules. The Google Sheets high-score proxy. Study Guide export. Its whole neon tech-lab palette carries over to the cyber theme. |
| **Somnia / Ainmos** | Glass panels (`glass.css`), zones instead of floating windows, and the main button bottom-right. Rare or dangerous controls (pause, quit) go top-right. Big click targets. The background ignores clicks while a panel is open. Animations take turns with menus. An in-game changelog. Seed codes for set scenarios (useful for teachers). A text-size option. |

### The screen (Chromebook landscape, 1366×768 as the design size)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Request]             [ trans ][ port ][ able ]  word slots [⏸][⚙]│
│  "able to be carried                                      Rot ▮▮▯│
│   from place to place"                                          │
│                                                                 │
│            ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲                 [Compile │
│           ╱   3D DIORAMA (fixed view)  ╲                  log ▸] │
│          ╱    click a tile to move      ╲                       │
│          ╲    click a thing to use it   ╱                       │
│           ╲____________________________╱                        │
│                                                                 │
│ ┌ Inventory ───────────────────────────┐                ┌──────┐│
│ │ PREFIX  trans  re  un  inter         │   captions     │COMPILE││
│ │ BASE    port  rupt  act              │                │  ⚙   ││
│ │ SUFFIX  able  er  tion  ive          │                └──────┘│
│ └──────────────────────────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

- **Top-left:** the request, written as a meaning. Click 🔊 to hear it.
- **Top-center:** word slots that fill as you compile.
- **Top-right:** pause and settings, and the Rot meter from district 2 on.
- **Bottom-left:** inventory, mini morphemes grouped in three rows by type (like Somnia's hand).
- **Bottom-right:** one big context button: COMPILE, DEBUG, PATCH, LINK or TALK.
- **Right edge:** the compile log, collapsible like the Ainmos Vault column. It lists recent word sums.

Minimum supported view: **1280×720 at 100% browser zoom**, and still usable at 125%, because many students zoom.

---

## Part 4 — Chromebook compatibility (Decision 5)

Phones are out of scope. Chromebooks are the target, and these are their real limits:

| Constraint | What CyberMorph does |
| --- | --- |
| **Low-end hardware** (Celeron / MediaTek class, 4 GB RAM, integrated GPU) | Budget: ≤ 100 draw calls, ≤ 100k triangles on screen, one diorama loaded at a time, no real-time shadows (baked or blob shadows), DPR capped at 1.25, a 30 fps floor, instanced morphemes. An auto Low setting if the first 3 seconds run under 30 fps. |
| **Small screens** (1366×768 and 1280×720 are common) | The HUD layout above is designed at 1366×768. Text is never under 16 px at 100% zoom. |
| **Trackpads** | Nothing needs right-click, drag, hover or a double-click. Every hover tooltip also opens on click. Scrolling over a ring turns it. |
| **Chromebook keyboard** (top-row keys replace F1–F12, no Delete or Home) | Only letters, arrows, Space, Enter, Esc and Tab. |
| **Touchscreen and tablet-mode Chromebooks** | Every control is a tap target ≥ 44 px, and click-to-move already works by touch. No separate touch layout. |
| **Managed school network** (blocked CDNs, filtered sites) | Everything is self-hosted: three.js vendored, fonts local, no external calls at all. |
| **Offline or flaky Wi-Fi** | A service worker caches the game after the first load (Somnia's `sw.js` pattern). It plays fully offline. |
| **Saves** | **Browser only (Phil, 19 Oct 2026).** One `localStorage` save per profile, written on every change and on `pagehide`. No save codes, no server, no class export. Shared or guest Chromebooks that wipe storage on sign-out lose the save. That trade is accepted for simplicity. |
| **Audio** (classrooms are loud, headphones vary) | Every spoken line is also captioned. ChromeOS has built-in `speechSynthesis` voices. Pick the first local en-US voice and test on a managed device. |
| **WebGL** | three.js needs WebGL2, which current ChromeOS supports. If `getContext('webgl2')` fails, show a plain message instead of a blank screen. |

---

## Part 5 — 3D art direction

- **Low-poly neon:** flat-shaded meshes, emissive edges, a dark background per district (amber, grey, blue, and white light). Baked ambient light.
- **Words in 3D:** morpheme faces get text from `CanvasTexture`, cached per morpheme. Floating Rotling words use CSS2D labels for crisp text (the Garden already uses `CSS2DRenderer`).
- **Juice that teaches:** the ejected-`e` spark, a doubled consonant snapping in, the y → i morph, and leaves popping onto the Lexicon Tree. Every effect shows a rule. None is only decoration.
- **Audio:** `speechSynthesis` for every morpheme and word, short synth sounds for ring clicks and compiles. Reuse Tech Escape's `audio.js` pattern and its music approach. Recorded mentor voices voiced by Mr. Phil are a stretch goal.

---

## Part 6 — Content and data (Decision 8: fork)

### The fork

Copy the Garden's two data files into the game:

- `scripts/morphology-morpheme-catalog.js` → `cybermorph/js/data/catalog.js`
- `scripts/morphology-words-data.js` → `cybermorph/js/data/words.js`

Put the source commit hash and date in a header comment on each copy. From then on, the game's copies are edited on their own. The Garden is untouched.

**The cost of forking:** fixes in one copy won't reach the other. Mitigation: `scripts/audit-cybermorph-bank.mjs` prints any morpheme key whose `meaning` differs between the two copies, as a report, never as an error. Then drift is something you look at, not something that surprises you.

What the fork starts with: about 220 morpheme rows (24 suffix, 21 prefix, 63 root, 112 lexeme keys) with `meaning`, `origin`, `wordSums`, `spellingNote`, `decodingTip`, `confusedWith` and `outsideExamples`, and about 337 words with morpheme trees and Beck tiers.

### New content needed

| Need | Count to start | Notes |
| --- | --- | --- |
| **Greek catalog rows** missing today: `phon photo micro scope therm auto meter chron hydro demo crat`, plus `-est`, a separate `-or` row, `-sion`, `-ance/-ence` and `cede/ceed` | ~18 rows | Only in the fork. |
| **Matrices** (base → legal prefix/suffix chains, with the resulting words) | Anglo-Saxon ~6 bases, Latin ~14, Greek ~12 | Generate a first pass from the word trees, then check by hand. |
| **Requests** (a meaning prompt → target word) | Anglo-Saxon ~25, Latin ~70, Greek ~60 | Plain-language meanings. Tier 2 and grades 6–8 science and social studies words first. |
| **Fakes** (bad joint, wrong order, false family) with a one-line reason each | ~25 per district | e.g. `hopeing`, `ableport`, `corn + er ≠ corner` |
| **Firewall locks** (sentence + base + the right suffix) | ~30 per district | Each needs one clearly right fit. |
| **Unknown Files** | ~20 per district | Must use only pieces taught earlier in that district. |
| **Spelling-joint engine** | 1 module | drop e, double the consonant, y → i, prefix assimilation. Unit tests from the catalog's `wordSums`. |
| **Student Lingo** | 1 whole District | Need to use actually used slang and lingo. Some examples are "bet", "aight", "sup", "hey", "crash-out", "cooked", "finna", and "let's go!".

**New audit script:** `scripts/audit-cybermorph-bank.mjs` checks that every request's target can be built from that district's matrix, that every Unknown File uses only earlier pieces, that every fake gives a reason, and that every word sum round-trips through the joint engine.

---

## Part 7 — Teacher tools

- **Practice picker.** A teacher link like `?set=sfx:-er,sfx:-or,pfx:re-` (catalog keys, not publisher names) narrows a shift to this week's morphemes, whatever program the class follows.
- **No class code and no server.** Everything stays in the browser.
- **Cognates.** `?cognates=es` turns on Spanish cognates for the class (Decision 7). Students can also turn it on in Settings.
- **Study Guide / report.** First-try rate per morpheme, low-mastery (due) morphemes, fakes missed, and Unknown Files solved. It prints from the browser. Students can screenshot it with their final score.
- **Projector mode.** One compiler, big type, no diorama. For whole-class word building on a smart board. It is the same compiler with no new code path.

---

## Part 8 — Accessibility

- TTS on every piece, word, request and caption. Captions are always on for mentor speech.
- A font choice (the default, Lexend, or OpenDyslexic, all self-hosted) and text size A− / A / A+, like the Garden.
- Morpheme type is shown by shape and colour, and district by morpheme style, so colour is never the only cue.
- No timers outside Overclock Mode. Reduced motion turns off parallax, camera slides and particles.
- Full keyboard play. Focus traps in panels (Somnia's `dialog-a11y.js`).

---

## Part 9 — Architecture and file map

Same shape as Tech Escape: plain ES modules, no build, three.js vendored.

```
src/site/cybermorph/
  index.html            title, first run, profile, settings screens + HUD
  styles.css  glass.css
  manifest.webmanifest  sw.js         offline cache for Chromebooks
  vendor/three.module.js              copy from tech-escape/vendor
  js/main.js  config.js  audio.js  util.js
  js/world/    diorama.js (tile grid, camera, parallax, transitions)  pathfind.js
               old-code.js  server-forum.js  orbital-array.js  core-hub.js  lexicon-tree.js
  js/entities/ morpher.js  mentor.js  rotling.js  morpheme.js  lock.js
  js/compiler/ drum.js (3D rings)  wordsum.js (joint engine)  beta-words.js
  js/learn/    mastery.js (Leitner + fade)  scheduler.js (interleave, Unknown Files)  detective.js
  js/data/     catalog.js  words.js  (forked from scripts/morphology-*.js)
               old-code.js  server-forum.js  orbital-array.js  (requests, locks, fakes, unknown files)
  js/meta/     save.js (localStorage only)  settings.js  highscores.js  report.js  changelog.js
  js/ui/       hud.js  inventory.js  panels.js  captions.js  tutorial.js
  js/input/    pointer.js  keyboard.js
scripts/audit-cybermorph-bank.mjs
scripts/cybermorph-joint-tests.mjs
```

Wire it into `.eleventy.js` as a passthrough copy, as for `/tech-escape/`. Add the game card to the "Games Mr. Phil has made" page.

---

## Part 10 — Build order

Each version is a playable checkpoint. Wright's rule: build the toy before the game.

| Version | Name | What ships | Done when |
| --- | --- | --- | --- |
| **0.1** | The Toy | The compiler drum alone on a console. Turn rings over the Anglo-Saxon morphemes, compile, hear the word, see the word sum, see joints animate. Made-up Words. | A student plays with it for 5 minutes with no goal and asks what else it can make. |
| **0.2** | Boot Up | One Anglo-Saxon diorama: click-to-move, Old Wynn, COMPILE requests, inventory HUD, browser save. | A new student finishes three errands with no help from the teacher. |
| **0.3** | Rotlings | DEBUG, fakes, end-of-shift patch notes. | Fake debugs are right on first try ≥ 70% by the third shift. |
| **0.4** | The Core | The hub, the Lexicon Tree, LINK, mastery glow and fade, a daily shift, diorama-to-diorama transitions. | On day 2, students see low-mastery morphemes and go to restore them. |
| **0.5** | Latin District | Aurelia, Latin roots, prefix assimilation, PATCH locks, the Rot meter and crash/reboot. | The joint tests pass, and a crash feels fair in a playtest. |
| **0.6** | Greek District | Theo, Greek forms, stress-shift audio, Unknown Files, Word Detective. | Meaning picks on Unknown Files are above chance on untrained words. |
| **0.7** | Teacher's Desk | Practice picker, cognates flag, printable report, projector mode. | One teacher runs a full week with it. |
| **0.8** | Chromebook Lab | The Part 4 checklist on real hardware: a low-end Chromebook, 1366×768, a touchscreen model, a managed account, offline play. | 30 fps on the slowest school Chromebook, and saves survive closing and reopening Chrome. |
| **1.0** | CyberMorph | Overclock Mode with a browser-only high-score table, changelog, art pass. | — |

**Size check.** Tech Escape is about 17,700 lines of JS. The diorama is simpler than Tech Escape's maze and first-person controller, so plan for about 9–12k lines here, plus content files.

---

## Resolved (Phil, 19 Oct 2026)

1. **Avatar parts.** Before play starts, players build their Morpher from **4 starting options in each of four categories**: Arms & Legs, Torso, Head, and Face. Clearing a district, opening the Secret Secretary Desk and beating the finale each unlock more colours and textures.
2. **Leaderboard.** Overclock Mode only, saved in the browser. No Google Sheet. A final-score screen is laid out for a clean screenshot to hand to the teacher.
3. **Finale.** The Rot is a **3-stage boss**, one word per origin, each picked at random from a pool:
   - **Greek:** triskaidekaphobia = `tris + kai + deka + phob + ia` (5 morphemes; it is only 4 if `phobia` counts as one piece), plus pool words like `photo + syn + the + sis`, `chron + o + log + ic + al`, `bio + graph + y`, `tele + scop + ic`, `psych + o + log + ist`.
   - **Latin:** indestructible = `in + de + struct + ible`, plus `inter + rupt + ion`, `trans + port + ation`, `in + vis + ible`, `pre + dict + able`, `contra + dict + ion`.
   - **Anglo-Saxon:** unhelpfulness = `un + help + ful + ness`, plus `un + friend + ly + ness` (y → i), `fore + see + able` (a Latin suffix on Anglo-Saxon pieces), `over + whelm + ing`, `mis + under + stand + ing`, `care + less + ness`.
   - The player DEBUGs each stage by splitting the boss word at every seam, then COMPILEs it back together clean.

## Next playtest (for 0.1)

**Do students turn the rings to see what happens before they're asked to?** If the compiler isn't fun to play with on its own, no diorama around it will fix that.

---

## Sources (Please include these in the game itself under "Inspirations")

- 95 Percent Group, *Morpheme Magic*: [product page](https://www.95percentgroup.com/products/morpheme-magic/) · [3rd ed. sample](https://www.95percentgroup.com/morpheme-magic-3e-sample-unlock/) · [XanEdu listing](https://www.xanedu.com/catalog-product-details/morpheme-magic-lessons-to-build-morphological-awareness-for-grades-4-12?hsLang=en)
- Bowers, Kirby & Deacon (2010), *Review of Educational Research* 80(2): [SAGE](https://journals.sagepub.com/doi/10.3102/0034654309359353)
- Goodwin & Ahn (2010), *Annals of Dyslexia*: [PDF](https://researchgate.net/profile/Amanda-Goodwin-2/publication/46010226_A_meta-analysis_of_morphological_interventions_Effects_on_literacy_achievement_of_children_with_literacy_difficulties/links/02e7e53208c8340c90000000/A-meta-analysis-of-morphological-interventions-Effects-on-literacy-achievement-of-children-with-literacy-difficulties.pdf) · [ASHA summary](https://apps.asha.org/EvidenceMaps/Articles/ArticleSummary/93cb3843-8a27-4b52-887b-32781be13e92)
- Colenbrander et al. (2024), *Educational Psychology Review* 36:119: [Springer](https://link.springer.com/article/10.1007/s10648-024-09953-3) · [ACU record](https://acuresearchbank.acu.edu.au/item/912vy/the-effects-of-morphological-instruction-on-literacy-outcomes-for-children-in-english-speaking-countries-a-systematic-review-and-meta-analysis)
- Kieffer & Lesaux (2007), *The Reading Teacher* 61(2): [Harvard GSE](https://www.gse.harvard.edu/news/uk/10/07/making-words-add) · [Windward summary](https://www.thewindwardschool.org/institute-blogs/morphology-the-building-blocks-of-literacy/) · [EdWeek](https://www.edweek.org/teaching-learning/what-is-morphology-should-teachers-include-it-in-reading-instruction/2023/11)
- Henry, layers of English: [Perspectives, "Morphemes Matter"](https://www.onlinedigeditions.com/article/Morphemes+Matter%3A+A+Framework+for+Instruction/2757855/398575/article.html) · [MTSU Dyslexia Center](https://dyslexia.mtsu.edu/morphology/)
- Structured Word Inquiry and matrices: [Wikipedia](https://en.wikipedia.org/wiki/Structured_word_inquiry) · [Ramsden, Word Microscope matrices](https://neilramsden.co.uk/microscope/introduction/matrices.html) · [Mini Matrix-Maker](https://neilramsden.co.uk/spelling/matrix)
- Vanderbilt Word Detectives / Monster, P.I.: [project](https://my.vanderbilt.edu/worddetectives/) · [game](https://monsterpi.ventrislearning.com/game)
- Word Explorer (Stanford LDT): [project page](https://ed.stanford.edu/ldt/students/projects/word-explorer-0)
- WordBuild (Dynamic Literacy): [review](https://cathyduffyreviews.com/homeschool-reviews-core-curricula/spelling-vocabulary/vocabulary-resources/wordbuild-vocabulary-development-system)
- Classroom games: [Teach Starter morphology games](https://www2.teachstarter.com/us/teaching-resource-collection/morphology/games/) · [This Reading Mama](https://thisreadingmama.com/?p=73337) · [Spelfabet Go Fish](https://www.spelfabet.com.au/?p=163236) · [Twinkl Morphology Memory](https://www.twinkl.com/resource/morphology-memory-au-l-1626255641)
- In repo: `research/ainmos-mobile-layout-research.md`, `src/site/tech-escape/README.md`, `src/site/tech-escape/js/minigames/quiz.js`, `src/site/scripts/morphology-morpheme-catalog.js`

---

## As built — 1.0.0 (19 Oct 2026)

Branch `cybermorph`. Plays at `/cybermorph/` (passthrough copy in `.eleventy.js`). Content audit: `node scripts/audit-cybermorph-bank.mjs` (159 built checks, 0 errors).

### What shipped

- **The whole loop.** Title, profiles (up to 6 per browser) → avatar builder → the Core (hub) → the Anglo-Saxon, Latin and Greek Districts (3 rooms each) → the Secret Secretary Desk → the Lingo District (2 rooms) → the 3-stage Rot finale → ending credits with the Inspirations list.
- **Four verbs, one interface.** COMPILE (the 3D Morph Compiler drum), DEBUG (cut seams, then judge real vs Rot), PATCH (firewall locks: turn the ending ring), LINK (family branches and look-alikes). Lingo adds UNPACK (compile the pieces a slang word came from, then watch the change chain) and a translation firewall.
- **Learning engine.** Leitner mastery per morpheme with glow tiers and fading; fading morphemes spawn review Rotlings in the Core; first try recorded quietly; elaborated feedback on every attempt; Unknown File consoles run the Word Detective routine; spelling-joint animations for drop-e, e-merge, y→i, doubling and prefix assimilation.
- **Stakes.** The Anglo-Saxon District is failure-free. The Rot meter (Latin and Greek Rotling halls) crashes the room at 100%: reboot at the entrance, loose morphemes drop where you stood. Debugging wrong shoves you back a tile.
- **Extras.** Overclock Mode (2-minute arcade run, browser-only top 10, screenshot-ready score card), the free Morph Compiler console with Made-up Words, Lexicon Tree leaves (one per word, coloured by origin), end-of-shift Lexinet patch notes, progress report (printable), avatar unlocks per milestone.
- **Teacher links.** `?set=er,or` (game ids or catalog keys) focuses review and Overclock on those morphemes; `?cognates=es` turns on Spanish cognates; `?projector=1` opens a big-type free compiler with every morpheme.
- **Chromebook.** No build, three.js r169 vendored, no network calls, Lambert materials only, pixel ratio ≤ 1.25 with an automatic drop under 30 fps, browser-only saves written on change and on `pagehide`, offline service worker on https.
- **Games page.** `/games/` is now an 80s arcade: synthwave background, a cartridge console with a slot, screen and EJECT button, and a rack of eleven cartridges in six shell shapes. Picking one flies it into the slot and opens the game in a new tab (`src/site/scripts/arcade-console.js`). CyberMorph has its own cartridge (three interlocking prefix/base/suffix tiles).

### Departures from the plan, and why

- **No separate "fork" of the word list.** Only the catalog is forked (`js/data/catalog.js`); the game's words live in the district files, which are what the audit checks. The Garden's `morphology-words-data.js` had nothing the game needed.
- **The camera is a fixed three-quarter perspective at a narrow FOV** rather than a true orthographic camera, so the parallax tilt reads as 3D.
- **Mr. Phil is drawn as his own teacher avatar** (a screen head with teacher specs and a MR. PHIL tag) rather than a guess at his real appearance.
- **Rotlings don't block movement**, so a student can never be trapped by one.

### Playtest tooling

- `src/site/cybermorph/dev/autoplay.js` drives the game through its real buttons (`await import('/cybermorph/dev/autoplay.js')`). The game exposes `window.__cybermorph` for it.
- `scripts/serve-nocache.py` serves `src/site` without stale ES-module caching.

### Still open

1. Real-Chromebook check (the Part 4 table) on the slowest school model.
2. Teacher review of the Lingo word list for each school.
3. Mr. Phil's recorded voice lines (stretch goal).
4. ~~Untracked Granny note breaking the Eleventy build~~ (deleted in the 1.1 cleanup).


---

## Polish pass — 1.1.0 (19 Oct 2026)

Requested by Phil after the 1.0 launch.

- **Rooms, not Districts.** Each origin's three small rooms merged into one big room, about three times the old floor (24×14 tiles), split into zones by firewalls: lesson zone → Rotling zone and data chasm → core zone. The Lingo Room is a classroom plus a computer lab. The hub is now **the Hub** (20×14). Built from `js/data/layout.js`, so every room shares one navigable shape.
- **Morpheme props.** Every room is dressed with objects named by its own morphemes: keyboard, firewall, laptop, network, rainbow, windmill (Anglo-Saxon); dictionary, structure, tractor, projector, aqueduct, transporter, inscription (Latin); telescope, microscope, telephone, thermometer, globe, chronometer, camera (Greek); backpack, G.O.A.T. trophy, vibe lamp, brunch tray, no-cap hat hook, glow-up mirror (Lingo). Walk close to see the morpheme tag; click to hear and read the word sum.
- **Storybook camera.** Lower angle (about 29° above the floor) that follows the Morpher. Q/E turn the camera in 45° steps, Z/X zoom in seven steps, VIEW (V) resets. On-screen buttons in the bottom corners (rotate + zoom in on the left, zoom out + rotate on the right). Outer walls on the camera's side sink so the room stays visible from every angle.
- **Keys follow the camera.** W/A/S/D and the arrows walk up/left/down/right *on screen* at every angle. Interact moved to SPACE/ENTER so E can rotate.
- **Readable everywhere.** Lexend only (self-hosted, SIL OFL), 19px base, nothing under ~17px, near-opaque panels, larger buttons, prompts, ring labels, dialogue and menus. The inventory and word log became slide-out drawers so the room fills the screen.
- **Hub tree.** Branches no longer take clicks. Only a small pulsing ring at the trunk's base opens the Lexicon. Flowers line the Hub's edges and grow as the player progresses.
- **BeepBox music.** Seven long loops (about 2–4 minutes each), one theme per place, composed by `scripts/compose-cybermorph-music.mjs` and played with the vendored BeepBox player (MIT). Open any song in the BeepBox editor to tweak it:

  - The Core: Leaves of Light (3:46 loop): https://www.beepbox.co/#9n40sbk2l00e0_t14a3g0_j0_r1i0o5442T0v3u00f10u2q11382d09w0h6E11jT7v3u07f0q112h2d08HYq800000000000h8I8E0T8v3u08f0qw103d9ax140W7E0T0v2u00f10u2q011d49w0h0E0b0000000000000000000221x0Eoe84yxoMqe7A0000000000yi9B2FoKocCzpMWufE00000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY0p2bbFeDEp1Fo5FqCxAl9BQ4AtajnEYkV19vhnisvgb_4dbNazN2D9XbkQJjM2inQZxbYGKPN2zT0zOv5egb-HZgb_4dbN8R_4asA00000FdtgkV5lFlqk5HlWlmBjHkWBuJlFlqluJnFlqleJjihIGGXaqGWtaG2waqGWtaCGSCGKDiKIwqqGWtWCWOCGKDoKIJFGHFQHbbGqGWtaCS0FGHFFbTRZlCNpntHmSRWRBt-VtntHmRRWRttuVnnvPlRBBdlteRlntjlnjFmmSQRlQWlJtZdlteVrptjlnjFmlSkRlQWldltdlteRjnvjlnjSlCBtFkWluJjGlWlmBjHlWRmBlFlWRuBlFkWR81uDjP5U8bngobrJSKjFXbFPtLmLrJHKXqG1VJXtqWXmTrJPbFPtLmLrJHKXqGXCTJRHHJrtKTcKDdSZqZKSKXJGHKruWSHgbqXOTfGDeLcrqHncGDaLXrKTmKKRJSXsOWsTrRHSXqXKSGKVJXHqJ-SKYJPWFPHP6SGRPaFOH-SXJRHHJrtKTcKDdSZqZKSKXJGHK05dQZPsMbaJr1dzmRJjoRJroSdqCRWOjnGV31eqMjCIHCITDc4VjfVPeV3fUIMfyPfV3fUGMfyb0-bIHAIDLJXkRJrsSdqCU-IALhKmMvDc8esMvDI_yH23yH23DI_OCVTyP1ebI4V3eUGMfyb0-bIHAIDPXuRdrmTdzm
  - Anglo-Saxon Room: Amber Hearth (3:28 loop): https://www.beepbox.co/#9n40sbk9l00e0_t1aa3g0_j0_r1i0o5442T0v3u00f10u2q8112d47w0h0E0T7v2u07f0q112h2d08HYq800000000000h8I8E0T5v3u05f0qw3022d9aHU70U0000000000h2E0T0v2u00f10u2q011d28w1h0E0b0000000000000000000221x0Eoe84yxoMqe7A0000000000yi9B2FoKocCzpMWufE00000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY0p2dGFduwALEAGjzU0nPniqZd9BTAAszIOZ9vj8QYxhO5mhb-qCLBupsErexP5vC1vVxPvdkDjRFHVnyT5XuVR5LHxvdvpYWVXpYminR-VuEtlR7y4RYLNPzJDgb-XZMb_c2fyvl9HVvrtnJw0000596WxGGWGGGY4x964GGGHO2O-5GGGHTHX8iGGGLgwVaKGGGLkwXEiGGGLoHGIGGGHQarXGGGGZ2-KKGGGLqJKLGGGHO2O-5GGGHTHX8iGGGLgwVaKGGGLkwXEiGGGLoHGIGGGHQarXGGGGZ21HIIIIIRboaSKKKLmIHHHHHHRHbXXbbbdi0LLKIIITbHUeKKKLbHqUeKKKLbGXEeKKKKARSRuhmrRuNjFmq5CFlFlQAraC1KHHHHSbo63HHHHOO-K2HHHHOWKW3HHHHRE62HHHHHRbbUaKKKLsIIIJIIIRbXrqWWWZqKhIGGGHQ8e-WGGGLgHKHGGGHQbXrGGGGZ2ShLGGGHSHrEiGGGL8b9a5GGGHTHX8iGGGLAaJWPqHSataPgIRaJaI0KjFTwLp485AeFFLmTGqHRuDjJllKrldmQSXHtRddWSZjluKllmVJkRrjrKJTkQTHrRdlWVllrCRjDntKrRdBkVvrr8tRKtTd_kQTHlRdSqTtjjuJLkRnHBllKrlettSVLkSljBZJJ_trDtPvRddWRtjtCJTkQTHrRdlWVllrCRg0FKDKowpdGo9Hp9Hq6FIqCNHr6JjqZ19HQYFwLdpTdpLepT8pTbo9PmlPSvPSvPmrOCvNlwDbpv5C1YVwvm1KrmFwCJJqRdNZ19uZOS47eofPmrPS3YZDYoC3YZD-l7cYlp_cpTaobNpwDbpv5C1YVwvBwrCRGo9HrmI
  - Latin Room: Marble Chorale (3:00 loop): https://www.beepbox.co/#9n40sbk5l00e0_t10a2g0_j0_r1i0o5442T0v3u00f10u2q9122b2d48w1h1E0T7v3u07f0q112h2d08HYq800000000000h8I8E0T5v3u05f0qw102d99H-Iq88000000000h0E0T0v2u00f10u2q011d49w0h0E0b0000000000000000000221x0Eoe84yxo0o06w0000000000sf84ihcElb5P00O0d000000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY0p2a2BWi-3FFduwALwuiOqjzW59HQ4BY3SR9BQAAt74-9iZ9vpjWBM3UBGq4LUKTN3zuiOv4eUTeUXbqX2nYgn-8srUBGq0000001ipr23QGtaDiwtaD8GZqLmFRaZaDiFQGJaDmHRGZqCALqkMeJlrGmmWlduFr1rBlmklRX5lJ96QKGwWWZaC-KKLiFKIIIQbHGWWZaCWOOP8bb8aKLoKwoa1ITbro62IVG2IRaEbkGKRbXtiGPsFISbbtGGHJGJqDiGQbtaPoFOiHmFQHdaDiFQGJaDqHRGZqA0KjzTw_qG3nFNXl0mVoeKlmSUxlepDsTnuKrRdlsVlprBXHBlJKtlepDsTnuKrRdlsVlprBXHBlJKtlepDsTnuJJTHCTHBrRJllHBZjtlcztJBqRtjlnelmSVuWVlrrDRjCpTdRTHrtWVJWVmZrllqVvkTljvtJBqRtjlnelmSVuWVlrrDRjCpTdRTE0FKfKotAC1qS3qSJHr6JHqSNHqRdBRACnjP62YNDsNwDepnfo7PCtP6tNpwvbpv5ClOS1YZDYZCs0o9PS1Znrmir6JwCJHkSXmikETdogsRw_eogsZDYkogsZDYZD-m9O7OS2YomlOS2Yno9PSpM1wDfo7Vnrmir6JwCJH0
  - Greek Room: Star Map (3:39 loop): https://www.beepbox.co/#9n40sbk4l00e0_t16a3g0_j0_r1i0o5442T0v3u00f10u2q11382d09w0h6E11jT7v3u07f0q112h2d08HYq800000000000h8I8E0T8v3u08f0qw103d9ax140W7E0T0v3u00f10u2q011d49w0h0E0b0000000000000000000221x0Eoe84yxoMqe7A0000000000yi9B2FoKocCzpMWufE00000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY0p2dWFcKwAzw4CLjitfgCKARWajbF98U7pXjkthYgFbV18XcLisvjdv8ZiWHpBWi-GyHBadazAasCnVtdfcku8srI-UjnOf4KeSvmeZZiB-tltUVhduLRrHdCnZQnRsFhF6LO5ejbYMLEVyw00000EES45lnjlnjFg450QRlQWk1tvjlnjAlJQ5jlnjJg5Y1jlnjInmMtdlteZttvjlnjEmmgtdlteBrnpjlnjFnmTQRlQWk1tvjlnjAlJQ5jlnjJg5Y1jlnjInmMtdlteZttvjlnjEmmgtdlteRnlvlllnKmlgtllluVn8TRlllW5sxvlllnEglAblllnAlYztlllnGlTmllllXlZBZlllt5HIaJaPiwcyHRHdi1Sbd2GyzpnSTRlllW5BQ5lllnEnilRllluhnTMBllluNv9glllluVlv2llllXRRRZllluFlt2llllXltA1jlnjKllMddlteV0lnkRlQWk1ntjlnjFlgk7jlnjAlY3rjlnjEmlSkRlQXlc5vjlnjOleBpFg6hlWRCFvImq5g1sDjT1uLjFWw0wnb0RAuVPvTTdSDeXKsHqqHFOKPDb_m_KsTZZPtFPKXDaSCGWsHIVO_RLXDd_vsTqsXKVOJFOWHndOTdW-q_LnbHTf_XqIKTdLCGGsHtRO_RLXDd_vsTqsXKVOJFOWHndOTdW-q_LnbHTf_XqIKTdLCGGsHtRO_RLXDd_vsTqsXKVOJE0kTjTc0QIeObmMboQdjiSdzmSdyCRW2jnxemPemO-qMnCc4VPaVXdVXfUyMfCITDI_DI_Bc4VH1esPesPKORJbqSdruSarzW2iZ6Vr1KmO-sMxVX23DI_yP1-cb23OGVDCc5VX1esMfBc4VH1esPesPLcJriSJzmTJw
  - Lingo Room: Study Hall (3:07 loop): https://www.beepbox.co/#9n41sbk0l00e0_t1ia3g0_j0_r1i0o5442T7v3u07f0q0311d08H-h000000000000h8IbE0T7v3u07f0q0311d08H-h000000000000h8IbE0T5v3u05f0qw3022d9aHU70U0000000000h2E0T0v2u00f10u2q011d28w1h0E0T2v4u02f0q011d05w1E11ib0000000000000000000221x0Eoe84yxoMqe7A0000000000yi9B2FoKocCzpMWufE00000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY00000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK0p2m1FduwALEwqjzWhviqZ19vh1twnZxIlZwnZhr5fo5Z9QZ3gFbW43P4LUyq-hipt197hIuVkVcLVTCJyDIy_IdyTI2_H2EX24N7OyVDpZOTJ3T0LQ6nZNdv8ZgWzoZObYynYFw000059uEaoeLbaWWZqKK0SE6KXqHHHSaWWZOSOXkGILTHbXdWKKLmHHLSHWXJGKKLoHHHTbrbJiGO-AztmTmllllXRtRBllluNvlnlllnGnmSllllX5tJJllluxnnnlllnInmnllllX5lQ7lllniqXyTkFQGtiPkFRatqLgGF8SRRtRllluRppplllnElRTRlllXlBRRllluVppplllnImmmllllXltJRllluFrp2RlllQBXy-WXuLIHSHbGZiSWLqJIIRGWWZGKWXsKGwuYKSGtaDkJRatiDmHQaw2ZeDmbMMCGG1qX0JJ1PCWXJIKXrbXBOteTuetvmRlmJtZrrSsTntJBTrpvsVtUVRZrllqRTRJLpPttSSntJBZPBTzCXmJSXznRqRXSdJTHntSSVTeteKrKURlmdtZrrSsTntJBTrpvsVtUVKRHtKURZmJuZzrtWRTtJKtPDjHCXKdllznvmSZDdRTrptSSnTenu02CWuVxSio5HodAmJHrmRHqSRJqRdHRACLjPm2YVDYNwDepn4m1Ylo7P6tNhwvfp_eo7PSvNlCsio7NpDsxDtFJrmNHo9LqRdNZp9u_PC4ffogsVx1PSvNhx1NxogsZD-m5P_fo9N5wvfo7NlCsio7NpDsxDuqrmRIqS2rSJhhJyd4Hpjw17ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7ABfa4uikVh7AB80
  - The Rot: Slow Static (3:22 loop): https://www.beepbox.co/#9n40sbk2l00e0_t1ca3g0_j0_r1i0o5442T0v3u00f10u2q9122b2d48w1h1E0T0v3u00f10u2q11382d09w0h6E11jT8v3u08f0qw103d9ax140W7E0T0v2u00f10u2q011d28w1h0E0b0000000000000000000221x0Eoe84yxoMqe7A0000000000yi9B2FoKocCzpMWufE00000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY0p2eAFbW4yARWpuAU-1Fdu0kkBY2FOqjbF98WtCAWuBOl7CBejWAALGYMB-rhjUFhUgrTzAR-8ZEeQJzTiL9B_o7ektZjA-BC1i_J6G2X2zPELYqB_09vjUFhUg5_x1dvoZEe-S000002yz8kOttlllujlRmllllU5lp2RlllW49tnlllnEgltJllluZtp1RlllW5JttllluF1TMJllluxntnlllnJlRmllllU5lp2llllW47tnlllnEgltJllluZtp1RlllW5JttllluF1TMJllluNjtvvpppABZQ7nnnnHmlMdBBBCZvnt0mmmqA5trnnnnJmTgttttunmngltttulgdtY5pppKgdQ5jlnjARlltdlteglSgldlteBpvrjlnjFkMdJdlteZjr0QRlQWldRBdltext1gtdlteBrnpnnnnJmmmnmmmp9jr0RRRRWRA7nnnnnHlMdRBBBCZlt0RRRRWRtZttttuFr1gttttuVtrvlllnwllY9lllnElTglllluVnvplllnEmOc7lllnJmTgJllluhgtkblllnw5Az1llllQmKswsAGTGZaHiFRGtaDgK0bAWuUbRWtf9TtK0RjlorBk3HDnHllJesRnjCntKtldlYVltHDnHllJesRnjCntKtldlYVltHDnHllJesVBVHDtjBnndTprBxqSXHtue00lHCtjydTrDRjluKlnqVRWRlrjDepuqVTkVlRPtSmVoeJKWTnzw05qVDkUztSVZkRnHBlSKtuJlmQVM0FKDKopAS5qS3r6gqSFJrmJJr6RjqZp9HQYFwDepT8o9PCtPS1Yio9P61YRCYho7NpBsho7NtBsko9PmvOC2tNJpdKqS2r6VjsvminETbogsZwT4S47fp_56475m3Yo647Dnfshp_61Bsho9Nwpn562sRDYFwDD6RASVHo9Irw
  - Overclock (2:10 loop): https://www.beepbox.co/#9n41sbk7l00e0_t1Sa3g0_j0_r1i0o5442T0v3u00f10u2q011d06w2h0E0T0v3u00f10u2q011d06w2h0E0T5v4u05f0qw3022d9aHU70U0000000000h2E0T0v2u00f10u2q011d28w1h0E0T2v4u02f0q011d05w1E11ib0000000000000000000221x0Eoe84yxoMqe7A0000000000yi9B2FoKocCzpMWufE00000000000000000000wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK088642xwUwia5z1EUug8AypgGmbC39ESseDzW0000000000gEAqhaCjG5aFmImHBX1yOpJ6HpKU0wwoga63y18Emc6zxV0yi9B2FoKocCzpMWufE4a96AiFAWxiGlH5GVuMoICrhGSrK7bFSYuLDY0221x0Eoe84yxoMqe7A298CkaByVwOqdD3FU-wgEAqhaCjG5aFmImHBX1yOpJ6HpKUsKDrNW-vM0p2vJFdu39bWaGjzV4nPniqZ59BQ4AtmPinQF7cB_amwALAqjFW4LOaqv4ac2EYSFOvsKVSvlJbkVHCb_vy-q-NWxRmPHkuolpn8lVcLV-nZ-nQtxhK6LUVjA-F4uhXZFqw00001hhA8eGKKKKLci2woeKKKLuGwHGWWWZqK-KKKKLmwGWWWWWYIIwrEaOOPiFIwHHbbdGG--KKKLqwGXWWWWZOW--KKKLuGwHGWWWZqK-KKKKLmwGWWWWWYIIwrEaOOPiFIwHHbbdGG--KKKLqLKLGGGHTHHXWGGGZ2WKKGGGLqJArWGGGZyOhKGGGHS8iiLGGGHSaWHqGGGZi-OSGGGLgwHaWWWWZG2KLHHHHTGEaWKKKLmHLHHHHHREaKKKKKLbb86W2IIIQGr8aWOOPqGLLHHHHSGF6-GGGLsLLLGGGHS8iSWGGGLgwWWWGGGZ2KhHGGGHT8aGWGGGLkGHLGGGHSbX8eGGGLoKKLHHHHSbHXWWWWZqKWKKKKLuwHHWWWWZW2HKHHHHTbUa-KKKLuIIJHHHHRaHHqWWWWbnbgmV1qRSBjFmr5mxpGkw5OteY7X8x0JIxdlqRtiZeDuLJqGHDcLmTGrcVJDCGJqKFPHXmGGVPbRJWCPerpVGHmHGsW-RGGKsOZrtRJTmGIruRJ2FITSSXqpNGWCPZrpVGHmHGsW-RGGKsOZrtRJTmGIruRJ-CPvrrJFD6HGrfRJDCGJqKFPHXmGGVPbQ0kTjTcgcCRd3kRc2RJrmRd3kRdqCRWOjnFVr1uoPuqPuiOuqPuqPuoMjBILBILCITDcPyjcVXfVjeVPeXbmSJjgRdjmFKfH9bTuoMwVHeVHdVb9VHdVHdVP23PrDKmMjDIXz6Pe9cPDI_BcXDcXPbmSJjgRdjmF5A0G9nxq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5V8n95E5E5OhsAmwmwnAxsAmwmwn95Ohq1q1ui5Ohq1q1sAn95E5E5

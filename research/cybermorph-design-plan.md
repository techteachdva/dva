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
| 3 | Camera | **A 3D diorama.** Simple, easy and intuitive for casual players, with 3D elements that make the diorama view pop. |
| 4 | Grades | **6–8** |
| 5 | Device | **Chromebook first.** Phones don't matter. Everything must work within a school Chromebook's limits. |
| 6 | Stakes | **Soft push-back** from district 2 on. You never lose knowledge or words. |
| 7 | Spanish cognates | **A setting, off by default** (plus a teacher link flag). |
| 8 | Data | **Fork a copy** of the Morphology Garden data into the game. |

---

## The pillar

**Compile a word, and the network changes.** The player assembles real English words from morpheme chips in a 3D diorama of a computer world. Meaning comes first, then structure, then family. Every chip shows what it means. Every word compiled shows its word sum. Every word belongs to a family you can see grow.

In one line: *three layers, three districts, one compiler.*

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
| Retrieval, spacing and interleaving beat massed practice. | Roediger & Karpicke 2006; Cepeda et al. 2006; Rohrer & Taylor 2007 (standard findings, not re-checked here) | A Leitner-style mastery level per morpheme. Review shows up in the game world as chips losing charge. Look-alike morphemes (from the catalog's `confusedWith`) are mixed together on purpose. |

---

## Part 2 — The game

### In one paragraph

You are a new **Morph Tech**, a small customizable repair bot, on the **Lexinet**, the network that stores every word. At its core runs the **Lexicon Tree**, a glowing data tree whose leaves are words. A corruption called **the Glitch** has shattered words into loose **morph chips** and spawns **Glitchlings**: buggy creatures made of broken or fake words. You work through three districts, one for each layer of English. In each you collect chips, compile real words at the **Morph Compiler**, debug Glitchlings back into clean pieces, and hang every word you make on its family branch of the Lexicon Tree. Your words open firewalls, bridge data gaps and reboot the district mentors.

### The world: three layers, three districts

| District | Layer | Look | Chip style | Teaches (grades 6–8 weighting) | Spelling joints |
| --- | --- | --- | --- | --- | --- |
| **Old Code** (start, short) | Anglo-Saxon | A retro 8-bit terminal town: amber phosphor screens, chunky cables, arcade cabinets. | **amber CRT glass** | Quick review of `-s/-es -ed -ing -er -est -ful -less -ness -ly -y`, `un- re- mis- over- fore-`, compounds (`key + board`, `fire + wall`). 1–2 shifts. | drop e (`hop(e) + ing`), double the consonant (`run + n + ing`), y → i (`happ(y→i) + ness`) |
| **Server Forum** | Latin (and Latin via French) | A data center built like a Roman forum: white server racks as columns, aqueduct-style cable runs, marble-white light. | **white ceramic** | `port rupt struct spect dict tract ject form scrib/script mit/miss duct fer vis/vid cede/ceed` · `in-/im-/il-/ir- inter- sub- trans- de- ex- con-/com- pre- dis- ad- contra-` · `-tion -able/-ible -ive -ment -or -ity -ous -ence/-ance` | prefix assimilation (`in + mobile → immobile`, `ad + tract → attract`), `-able` vs `-ible`, `-tion` vs `-sion` |
| **Orbital Array** | Greek | A satellite dish and star tracker in orbit, with holograms and blue starlight. | **holographic blue** | `bio geo graph/gram phon photo tele micro scope logy therm auto meter chron hydro psych demo crat` | the linking `o`, stress shifts (PHO-to-graph → pho-TOG-ra-phy), `ph` / `ch` / `y` spellings |

Academic words for grades 6–8 come from science and social studies on purpose: `transportation`, `interruption`, `photosynthesis`, `thermometer`, `democracy`, `chronological`.

**The hub** is the Core. Each base you meet grows a branch of the Lexicon Tree, and each word you compile hangs a glowing leaf on it. It reuses the Morphology Garden's tree idea (`morphology-garden.js` already draws trees in three.js).

The chip style is the layer, so a word's origin is visible without a label. (The Millers: the world explains itself.)

### Characters: mentors with wants

Following Phil's rule, no mentor is called "The Teacher." All three are programs or bots with a personality.

- **Old Wynn**, an early maintenance bot in Old Code. (Wynn, ƿ, is a lost Old English letter.) She talks in short, plain words. She wants to reboot her arcade cabinet, the *Unbreakable*, before the district shuts down. Quirk: she counts everything aloud with `-s` and `-es`.
- **Aurelia Cache**, the Server Forum's archive AI. The Glitch corrupted her memory, so she is literally missing her roots, and each root you return restores a line of her log. **Secret:** she released the Glitch herself by compiling a word that wouldn't hold. That sets up Beta Words (below).
- **Theo Parsec**, the Orbital Array's satellite operator. He names every satellite with Greek compounds and is never happy with them. He wants to finish his star map before the eclipse cuts the uplink.

The player's **Morph Tech** can be customized (chassis, colour, face screen) with parts unlocked by compiling. Monster, P.I. shows that avatar customization works for this age.

### The four verbs, one interface

Meier's Covert Action rule: two games inside one game fight each other. So there is **one interface**, the morph chip and the matrix, used for four verbs.

| Verb | Morphological skill | What the player does |
| --- | --- | --- |
| **COMPILE** | putting a word together from its meaning | A mentor or a firewall asks for a meaning: *"able to be carried from one place to another."* You turn the compiler rings to `trans + port + able` and hit Compile. |
| **DEBUG** | taking a word apart | A Glitchling crawls up wearing a word, like `interruption` or the fake `unhopeing`. Click the seams to cut it into morphemes. A real word breaks clean, drops its chips and becomes a friendly helper sprite. A fake shows the bad joint and dissolves. |
| **PATCH** | suffix grammar in a sentence | A firewall lock reads *"The volcano is still ___."* You turn the suffix ring on `act` until `active` fits. Other locks ask for `action`, `actively` or `react`. |
| **LINK** | which words are related | At the Lexicon Tree, hang words on their base's branch. Some are false friends: `corner` is not `corn + er`, and `report` is not `rep + ort`. Catching one gives a bonus leaf. |

Every verb uses the same chips and the same word-sum readout. A student who learns one has learned the controls for all four.

### The Morph Compiler (the 3D centerpiece)

The compiler is a **3D drum of rotating rings** on a terminal console, like a cryptex rebuilt as hardware.

- **Columns, left to right:** prefix ring(s), the base core (fixed, set by the request or picked from your inventory), and suffix ring(s). This follows Ramsden's matrix rule: one piece per column, and no skipping a column.
- **Shape is the rule.** Prefix chips have a connector pin on the right. Suffix chips have a socket on the left. Base chips are square cores. Chips only seat in their own column, so the structure is learned by touch. This is the same non-colour channel idea as Tech Escape's `SLOT_SHAPES`.
- **Live meaning.** Under each ring the gloss updates as you turn it (`trans-` *across*, `port` *carry*, `-able` *can be*). Under the whole drum, the word sum prints like a compile log: `trans + port + able → transportable`.
- **Joints are animated.** When a spelling rule fires, the compiler shows it: the `e` of `hope` is ejected as a little spark before `-ing` seats. The rule is shown, not just stated.
- **Literal vs today's meaning.** A compiled word shows two lines: *Root sense: carry back.* *Today: a person who brings back the news.* This is honest about meaning drift, which SWI cares about.
- **Compile to commit.** Commit is a two-step action (the big Compile button), with the 350 ms open lockout from Tech Escape `quiz.js`. The word is spoken on every compile.
- **Beta Words (the "No, but you could…" rule).** If you compile a word that is legal in structure but not in the dictionary, such as `unsad`, the compiler doesn't say "wrong." It says *"That word isn't in the Lexicon yet. Save it as a beta word?"* It goes into your Beta folder with its built meaning (*not sad*). Beta words don't count toward requests, but they are a safe, playful use of morphology. Aurelia's secret makes them a story beat: she pushed a beta word into the core and it broke, so the Beta folder also teaches the line between *possible* and *real*.

**Controls (casual-first).**
- Click the ▲ / ▼ arrows above and below a ring, or scroll over it. The keyboard alternative is ← / → to pick a ring and ↑ / ↓ to turn it.
- Click the big Compile button, or press Enter. Click 🔊 or press R to hear it.
- There is no dragging, right-clicking or holding anywhere, so it works on every Chromebook trackpad and touchscreen.

### Loops on three time scales

Meier's "one more turn": something is always about to pay off.

| Scale | Length | Loop | Payoff |
| --- | --- | --- | --- |
| **Moment** | 20–40 s | read a meaning → turn the rings → compile → read the feedback | the word builds in 3D, a word sum, its sound |
| **Errand** | 3–5 min | go to a mentor or firewall → 3–5 requests → debug the Glitchlings blocking the path | a firewall opens, a data bridge forms, a mentor speaks |
| **Shift** | 10–15 min | one daily session: new morphemes from a mentor, errands, a review run, one Unknown File | chips recharge, Lexicon leaves, end-of-shift patch notes |
| **Campaign** | weeks | Old Code (1–2 shifts) → Server Forum (~5–6) → Orbital Array (~4–5) | a district cleared of Glitch, the Lexicon Tree lights up, the finale |

**End-of-shift patch notes** borrow from Ainmos 0.30 Dream Tales and from Phil's own changelogs. They are a short, generated release note that uses **the words you compiled today** in sentences about the network: *"Patch 1.3: Interrupted uplink restored. Theo called the new satellite transportable."* It is the reading-in-context step for free.

### The learning engine

- **Mastery levels (Leitner 0–4) per morpheme**, shown in the world as **chip charge**: dim → lit → gold.
- **Losing charge is spacing.** Chips you haven't used lose charge over days (1, 3, 7, 14-day gaps by level). Low-charge chips turn up in Glitchlings or requests, and using one recharges it. Forgetting is shown as a place to go back to, not a red bar.
- **Interleave the look-alikes.** The catalog's `confusedWith` field (102 rows) drives mixed sets: `-er/-or`, `in-` (not) vs `in-` (into), `-able/-ible`, `inter-/intra-`, `-tion/-sion`.
- **Unknown Files for transfer.** Each shift gives one unfamiliar word built only from mastered pieces (`transportable`, `interruption`). The player must debug it and pick its meaning. This targets the weak reading transfer that Colenbrander found.
- **Word Detective (the Kieffer & Lesaux strategy)** comes up when a sentence has a word you haven't met: (1) flag the word you don't know, (2) split it, (3) say what each piece means, (4) check the sentence. The four steps sit on screen as a small fixed card.
- **Feedback rules** come from Tech Escape `quiz.js`, unchanged. An explanation on every attempt. Retry until right, with first try recorded quietly. Wrong answers blame the machine: *"Compile error: the joint won't hold"* or *"The firewall rejects that format."* The words quiz, test, score and grade never appear.

### Failure and stakes (Decision 6: soft push-back)

Feed, then poke, but not too much.

- **Old Code has no failure state.** It is a safe first shop.
- **From the Server Forum on, the Glitch level is a meter you can see** (TRN-13 Time Track). Glitchlings left alone push it up. At 100% the district **crashes**: you reboot at the last save terminal, and your loose, uncompiled chips drop where you stood. They stay there, glowing, and you can pick them up again. Failure costs a walk, never knowledge or words.
- **Overclock Mode** (optional, unlocked after Old Code) adds a timer, more Glitchlings and a leaderboard score. It is opt-in, for students who want pressure.
- Debugging a Glitchling wrong doesn't hurt you. It bumps you back one tile and the explanation appears.

### Mechanisms (Building Blocks codes, from the code index; the PDF is not in `research/`)

| Code | Where |
| --- | --- |
| SET-02 Tile-Laying | chips seating in matrix columns |
| SET-01 Set Valuation | Lexicon families pay more when complete (all the known `port` words) |
| ECO-15 Contracts | mentor and firewall requests |
| ACT-15 Gating and Unlocking | firewalls open with words, and districts open with mastery |
| ACT-16 Tech Trees | the Lexicon Tree itself: bases → words → families |
| TRN-13 Time Track | the Glitch meter |
| TRN-07 Real-Time | Overclock Mode only |
| STR-08 Campaign | Old Code → Server Forum → Orbital Array |

The book's PDF wasn't found at the path `bb_lookup.py` expects, so these codes come from the skill's index only. Read the entries before relying on any pitfall.

---

## Part 3 — Layout, camera and GUI

### The diorama camera (Decision 3)

- **Each area is one diorama:** a self-contained 3D room on a tile grid (about 12×12 tiles), seen from a fixed three-quarter view above. Think of a cutaway model on a table.
- **Perspective camera with a narrow field of view** (about 30°), so it reads almost like a flat 2D board but keeps real depth and lighting. The camera never needs the player to steer it.
- **Gentle parallax:** the diorama tilts a few degrees toward the mouse. It is cheap and makes the 3D obvious. It turns off with Reduced motion.
- **Click to move.** Click a tile and the Morph Tech walks there along a grid path (A* on the tile grid). Click a thing to walk to it and use it. WASD and arrows also work for students who want them.
- **Moving between areas:** walk through a glowing port at the diorama's edge. The camera does a short slide to the next diorama, and the next room builds itself in, tile by tile. This is a cheap, impressive 3D moment that also hides loading.
- **Zoom on focus.** Opening the compiler, a Glitchling or a firewall lock zooms the camera onto that object while the room dims. Closing zooms back. No separate 2D screens are needed: the panels sit *in* the diorama.

**What makes it pop (the 3D on top of a flat-feeling view):**
- chips are real 3D objects that float, spin slowly and glow by charge;
- the compiler drum is a real 3D model whose rings visibly turn and click;
- Glitchlings are 3D creatures whose bodies are built from their word's letters, and debugging splits them in 3D along your cuts;
- leaves pop onto the Lexicon Tree in the hub with a burst of light;
- emissive "neon" edges on everything interactive, so clickable things read at a glance.

### Reuse from Tech Escape and Somnia

| From | Reuse |
| --- | --- |
| **Tech Escape** | A vendored `three.module.js`, with no build step and no network, so it runs on a locked-down school network. HUD regions: a top objective card, a top row of slots (the code pieces become **word slots**), an interact prompt, a caption stack, a toast stack. Screens for first run, profile and settings. Floor arrows toward the current goal. `quiz.js` feedback rules. The Google Sheets high-score proxy. Study Guide export. Its whole neon tech-lab palette carries over to the cyber theme. |
| **Somnia / Ainmos** | Glass panels (`glass.css`), zones instead of floating windows, and the main button bottom-right. Rare or dangerous controls (pause, quit) go top-right. Big click targets. The background ignores clicks while a panel is open. Animations take turns with menus. An in-game changelog. Seed codes for set scenarios (useful for teachers). A text-size option. |

### The screen (Chromebook landscape, 1366×768 as the design size)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Request]             [ trans ][ port ][ able ]  word slots [⏸][⚙]│
│  "able to be carried                                    Glitch ▮▮▯│
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
- **Top-right:** pause and settings, and the Glitch meter from district 2 on.
- **Bottom-left:** inventory, mini chips grouped in three rows by type (like Somnia's hand).
- **Bottom-right:** one big context button: COMPILE, DEBUG, PATCH, LINK or TALK.
- **Right edge:** the compile log, collapsible like the Ainmos Vault column. It lists recent word sums.

Minimum supported view: **1280×720 at 100% browser zoom**, and still usable at 125%, because many students zoom.

---

## Part 4 — Chromebook compatibility (Decision 5)

Phones are out of scope. Chromebooks are the target, and these are their real limits:

| Constraint | What CyberMorph does |
| --- | --- |
| **Low-end hardware** (Celeron / MediaTek class, 4 GB RAM, integrated GPU) | Budget: ≤ 100 draw calls, ≤ 100k triangles on screen, one diorama loaded at a time, no real-time shadows (baked or blob shadows), DPR capped at 1.25, a 30 fps floor, instanced chips. An auto Low setting if the first 3 seconds run under 30 fps. |
| **Small screens** (1366×768 and 1280×720 are common) | The HUD layout above is designed at 1366×768. Text is never under 16 px at 100% zoom. |
| **Trackpads** | Nothing needs right-click, drag, hover or a double-click. Every hover tooltip also opens on click. Scrolling over a ring turns it. |
| **Chromebook keyboard** (top-row keys replace F1–F12, no Delete or Home) | Only letters, arrows, Space, Enter, Esc and Tab. |
| **Touchscreen and tablet-mode Chromebooks** | Every control is a tap target ≥ 44 px, and click-to-move already works by touch. No separate touch layout. |
| **Managed school network** (blocked CDNs, filtered sites) | Everything is self-hosted: three.js vendored, fonts local, no external calls except the optional leaderboard. |
| **Offline or flaky Wi-Fi** | A service worker caches the game after the first load (Somnia's `sw.js` pattern). It plays fully offline. |
| **Saves** (shared or guest Chromebooks can wipe local storage on sign-out) | Save to `localStorage` per profile, *and* show a short **save code** at the end of each shift that a student can type back in on any Chromebook. Teachers can also export class saves. |
| **Audio** (classrooms are loud, headphones vary) | Every spoken line is also captioned. ChromeOS has built-in `speechSynthesis` voices. Pick the first local en-US voice and test on a managed device. |
| **WebGL** | three.js needs WebGL2, which current ChromeOS supports. If `getContext('webgl2')` fails, show a plain message instead of a blank screen. |

---

## Part 5 — 3D art direction

- **Low-poly neon:** flat-shaded meshes, emissive edges, a dark background per district (amber, white and blue light). Baked ambient light.
- **Words in 3D:** chip faces get text from `CanvasTexture`, cached per morpheme. Floating Glitchling words use CSS2D labels for crisp text (the Garden already uses `CSS2DRenderer`).
- **Juice that teaches:** the ejected-`e` spark, a doubled consonant snapping in, the y → i morph, and leaves popping onto the Lexicon Tree. Every effect shows a rule. None is only decoration.
- **Audio:** `speechSynthesis` for every morpheme and word, short synth sounds for ring clicks and compiles. Reuse Tech Escape's `audio.js` pattern and its music approach. Recorded mentor voices are a stretch goal.

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
| **Matrices** (base → legal prefix/suffix chains, with the resulting words) | Old Code ~6 bases, Forum ~14, Array ~12 | Generate a first pass from the word trees, then check by hand. |
| **Requests** (a meaning prompt → target word) | Old Code ~25, Forum ~70, Array ~60 | Plain-language meanings. Tier 2 and grades 6–8 science and social studies words first. |
| **Fakes** (bad joint, wrong order, false family) with a one-line reason each | ~25 per district | e.g. `hopeing`, `ableport`, `corn + er ≠ corner` |
| **Firewall locks** (sentence + base + the right suffix) | ~30 per district | Each needs one clearly right fit. |
| **Unknown Files** | ~20 per district | Must use only pieces taught earlier in that district. |
| **Spelling-joint engine** | 1 module | drop e, double the consonant, y → i, prefix assimilation. Unit tests from the catalog's `wordSums`. |

**New audit script:** `scripts/audit-cybermorph-bank.mjs` checks that every request's target can be built from that district's matrix, that every Unknown File uses only earlier pieces, that every fake gives a reason, and that every word sum round-trips through the joint engine.

---

## Part 7 — Teacher tools

- **Practice picker.** A teacher link like `?set=sfx:-er,sfx:-or,pfx:re-` (catalog keys, not publisher names) narrows a shift to this week's morphemes, whatever program the class follows.
- **Class code.** `?class=` tags saves and the optional leaderboard, as Tech Escape does.
- **Cognates.** `?cognates=es` turns on Spanish cognates for the class (Decision 7). Students can also turn it on in Settings.
- **Study Guide / report.** First-try rate per morpheme, low-charge (due) chips, fakes missed, and Unknown Files solved. It prints and exports as CSV. Data stays on the Chromebook unless a class code is set.
- **Projector mode.** One compiler, big type, no diorama. For whole-class word building on a smart board. It is the same compiler with no new code path.

---

## Part 8 — Accessibility

- TTS on every piece, word, request and caption. Captions are always on for mentor speech.
- A font choice (the default, Lexend, or OpenDyslexic, all self-hosted) and text size A− / A / A+, like the Garden.
- Chip type is shown by shape and colour, and district by chip style, so colour is never the only cue.
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
  js/entities/ morph-tech.js  mentor.js  glitchling.js  chip.js  firewall.js
  js/compiler/ drum.js (3D rings)  wordsum.js (joint engine)  beta-words.js
  js/learn/    mastery.js (Leitner + charge)  scheduler.js (interleave, Unknown Files)  detective.js
  js/data/     catalog.js  words.js  (forked from scripts/morphology-*.js)
               old-code.js  server-forum.js  orbital-array.js  (requests, locks, fakes, unknown files)
  js/meta/     save.js (localStorage + save codes)  settings.js  highscores.js  report.js  changelog.js
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
| **0.1** | The Toy | The compiler drum alone on a console. Turn rings over the Old Code morphemes, compile, hear the word, see the word sum, see joints animate. Beta Words. | A student plays with it for 5 minutes with no goal and asks what else it can make. |
| **0.2** | Boot Up | One Old Code diorama: click-to-move, Old Wynn, COMPILE requests, inventory HUD, save + save code. | A new student finishes three errands with no help from the teacher. |
| **0.3** | Glitchlings | DEBUG, fakes, end-of-shift patch notes. | Fake debugs are right on first try ≥ 70% by the third shift. |
| **0.4** | The Core | The hub, the Lexicon Tree, LINK, chip charge and fade, a daily shift, diorama-to-diorama transitions. | On day 2, students see low-charge chips and go to recharge them. |
| **0.5** | Server Forum | Aurelia, Latin roots, prefix assimilation, PATCH locks, the Glitch meter and crash/reboot. | The joint tests pass, and a crash feels fair in a playtest. |
| **0.6** | Orbital Array | Theo, Greek forms, stress-shift audio, Unknown Files, Word Detective. | Meaning picks on Unknown Files are above chance on untrained words. |
| **0.7** | Teacher's Desk | Practice picker, class code, cognates flag, report export, projector mode. | One teacher runs a full week with it. |
| **0.8** | Chromebook Lab | The Part 4 checklist on real hardware: a low-end Chromebook, 1366×768, a touchscreen model, a managed account, offline play. | 30 fps on the slowest school Chromebook, and a save survives a sign-out via save code. |
| **1.0** | CyberMorph | Overclock Mode, leaderboard, finale, changelog, art pass. | — |

**Size check.** Tech Escape is about 17,700 lines of JS. The diorama is simpler than Tech Escape's maze and first-person controller, so plan for about 9–12k lines here, plus content files.

---

## Still open

None of these block 0.1.

1. **Avatar parts.** How much customization, and does it unlock through play or is it all open from the start?
2. **Leaderboard.** Overclock Mode only, or also a calm "words compiled this week" class board?
3. **Finale.** What the Glitch is at the end: a boss that is one huge fake word to debug, or Aurelia's broken beta word that you must finally compile correctly.

## Next playtest (for 0.1)

**Do students turn the rings to see what happens before they're asked to?** If the compiler isn't fun to play with on its own, no diorama around it will fix that.

---

## Sources

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

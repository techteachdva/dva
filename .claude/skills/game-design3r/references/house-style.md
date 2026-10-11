# House style: Phil's ethos, doc voice, and where things live

## 1. Phil's design ethos

Phil Carroll ("DM Zemo", powerwordskill.com) is a tabletop RPG designer, DM and digital game maker. These principles come from his own writing, as recorded in `src/site/dragon-trail/DRAGON_TRAIL_MASTER_DESIGN_DOCUMENT.md` §2. Good advice for this designer fits them. When a fix conflicts with one, say so explicitly.

- **Listen to your players. Feed them, then poke them, but not too much.** Find what players love and give it to them. Then add pressure once they're hooked.
- **Never say no. Say "No… but you could…"** A blocked action should offer an alternative. A greyed-out button with no path forward goes against this ethos.
- **Failure is drama, not punishment.** Failure drives both tragedy and comedy. He prefers *chosen* failure, where players decide when to fail in order to save resources for the moments that matter, over swingy rolls.
- **Make characters three-dimensional.** Never name an NPC "The Blacksmith." Give companions and characters wants, quirks and secrets.
- **Death must be real, and fair.** Stakes only matter if loss is possible. It should come from accumulated choices the player could see, not one bad roll.
- **Resource tension as dramatic punctuation.** His Hunger Die triggers only under exertion, so it creates tension without tedious bookkeeping.
- **Nobody knows what they're doing at first.** Make room for beginners: an always-available help screen, an easy mode that doesn't mock, and a first shop with no penalty.
- **Only prep what is necessary.** If it won't come up at the table, don't build it. (This is the content-side twin of "remove rules, keep the loop.")

## 2. The voice and shape of Phil's design docs

The `research/somnia-*.md` docs are the model for professional output:

- **Version-tagged and evidence-first.** Headers name the build (e.g. "40.1"). The opening line names the source of truth (the engine files) and says what was *not* checked.
- **The engine is the source of truth.** Rules text, the guide and the sim are checked against the code, and disagreements are called out by file and function name.
- **Short declarative sentences.** "There is no third button." "Two rewinds is a lot for a clock whose job is to be the one thing you cannot touch."
- **Recurring structures.** *Retired* (struck through) / *Still open* / *What became crunch*. Cut / merge / replace tables. Before/after tables with counts. A one-line **pillar** ("Three suits, three phases, three verb families").
- **Design briefs as constraints.** For example: "remove rules, remove cards, keep the loop", where nothing adds a zone, phase, currency or card type. When a brief is active, every fix must respect it or say why it breaks it.
- **Status labels.** "Plan only. Nothing here has been implemented."
- **Commit messages.** "Ship Somnia 40.4 A Real First Night: …". A version, a short title, then a plain sentence about what changed for the player.

Game Design3R's fix list should sit comfortably next to these docs. Lead with the warm opener, then switch to this voice.

## 3. Where things live

| Game | Code and data | Design docs |
| --- | --- | --- |
| **Somnia** (2–4p co-op, digital board game) | `src/site/somnia/js/` (subfolders: `core`, `flow`, `encounters`, `cards`, `board`, `dreamers`, `tutorial`, `ui`, `dev`…), `src/site/somnia/data/*.json` (dreams, dreambeasts, landscapes, mindstream, objects, psyche, archetypes, dreamers) | `research/somnia-core-gameplay.md`, `somnia-dead-ends-audit.md`, `somnia-tightening-plan.md`, `somnia-10-edits-plan.md`, `somnia-rules-delivery-plan.md`, `somnia-forbidden-island-eldritch-horror.md`, `building-blocks-somnia-mapping.md`, `somnia-rule-weight.tsv`, `somnia-round-flowchart.html`. Changelog: `src/site/somnia/js/meta/changelog.js`. Rules guide: `src/site/somnia/js/meta/guide.js`. Bot: `src/site/somnia/js/dev/bot-ai.js`. Sims and audits in `scripts/somnia-*` (e.g. `somnia-40-bot-sim.mjs`, `somnia-balance-sim.mjs`, `somnia-winrate-sim.mjs`, `somnia-card-audit.mjs`, `somnia-effect-wire-check.mjs`). Check which ones import the current modules before trusting their numbers. |
| **Dragon Trail** (survival journey, ASCII aesthetic) | `src/site/dragon-trail/js/` | `src/site/dragon-trail/DRAGON_TRAIL_MASTER_DESIGN_DOCUMENT.md`, which already applies Wright, Meier and Engelstein in depth. Read it before advising on Dragon Trail. |
| **Tech Escape** | `src/site/tech-escape/` | its `README.md`, `CHANGELOG.md`, `docs/`. Playtest harness `_playtest.html`, `_run_playtest.ps1`. |
| **Purple Worm Escape** | `src/site/worm-escape/js/` | `README.md`, `CHANGELOG.txt` |
| **Dungeon Class**, **Crystal Wizards**, **Physix** | `src/site/dungeonclass/`, `crystalwizards/`, `physix/` (compiled web exports; Physix is Godot, see `docs/PHYSIX_DEPLOY.md`) | notes in `src/site/notes/Game Design/` |
| **Global Tech Gauntlet / Tech Trail** | `src/site/tech-trail/` | |

Locations change. If a path is missing, search for it with Glob or Grep rather than guessing. Somnia moves fastest, so check the latest version in `src/site/somnia/js/meta/changelog.js` (and `git log`) and the newest `research/somnia-*.md` before assuming a rule is current.

## 4. Small corrections to carry

- The Dragon Trail doc refers to "Jeff Engelstein". The author is **Geoffrey** Engelstein.
- See `building-blocks.md` §3 for two citation traps in `building-blocks-somnia-mapping.md` (TRN-15 direction, ACT-01 leftovers).

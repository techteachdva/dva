# Ainmos design plan — 0.8

Source of truth: the Ainmos engine under `src/site/ainmos/js/` and its data in `src/site/ainmos/data/`. Ainmos is a parallel fork of Somnia 42.0. Somnia keeps developing on its own; neither game imports the other's code. Ainmos shares only Somnia's art, audio, fonts, and movie (Eleventy passthrough, and `scripts/ainmos-dev-server.mjs` locally).

Balance numbers here come from `scripts/ainmos-bot-sim.mjs`, which is Somnia's Bot 41 policy pointed at Ainmos. That bot does not shop, does not choose Boons with intent, and does not plan for Bosses. Treat its win rates as a smoke test, not as balance.

**Pillar.** Build the dream, then the dream sends its beast. A night is Antes of two Dreams and a Boss; what carries between Antes is your Archetype points, Objects, Forms, upgrades, and Boons.

## Decisions (locked with Phil, 14 Oct 2026)

| # | Decision |
| --- | --- |
| D1 | Boss ladder suits: Baku and Bogey swap, so every night length meets all three suits. |
| D2 | Antes: Daydream 4, Nap 7, Deep Sleep 10. |
| D3 | Wake = the final Boss defeated **and** the Archetype goal met. |
| D4 | Somnia 41.3 replaced Wendigo with the Devourer; old saves were allowed to break. |
| D5 | Ainmos on its own branch until the reset loop (A3) works; Somnia and Ainmos develop separately. |
| D6 | The ten Boss twists as listed below. |
| D7 | The Lost & Found has 3 Objects and 1 Insight. Objects 1–5 in their suit; Insight 3–6 in any suit; a Form level is 3. |
| D8 | Somnia gets a Fixed / Freeform Board option, and The Bed stops drawing 3 in both games. |
| D9 | The Somnia intro movie stays. Ainmos gets its own cinematic (script in `research/ainmos-cinematic-script.md`). |
| D10 | Six Dream Forms, four Psyche upgrades, and Archetype powers as Boss Boons. |
| — | The Psyche deck never grows or shrinks; cards only move by Repress and Return. |
| — | Chaotic rolls on draw. Unity (three 1s) is its own Form; the higher Form counts. |
| — | The Dreamscape resets only at the start of the round after the Vault and tile deck run dry. |
| — | Vault refresh: 1 Lucidity, +1 for each refresh already made **this round**. |
| — | Ante dawn heal: draw 3 (after the discard reshuffles into the Waking Mind). |
| — | 6 Objects per Dreamer; the Deep Pockets Boon raises it to 10. |

## The night

| Rung | Boss | Suit | Power | Twist |
| --- | --- | --- | --- | --- |
| 10 | Winged Turtle | W | 2·3·4 | Three stacked fights |
| 9 | Shadows | W | 7 | Lucidity Landscape actions go dark |
| 8 | Jackalope | E | 7 | Hops 2 hexes each Meet |
| 7 | Baku | L | 8 | Eats the next Dream at dusk |
| 6 | Mindless | E | 9 | Your stats add nothing |
| 5 | Devourer | W | 9 | Eats an Object in play at dusk |
| 4 | Bogey | E | 10 | The Bed's action is shut; sleeping there costs 1 Psyche |
| 3 | Cerberus | W | 11 | No one enters or leaves The Bed |
| 2 | Double | E | 11 | Gains your matching stat |
| 1 | Leviathan | L | 12 | Forgets the farthest edge at dusk |

Engine: `js/encounters/boss-ladder.js` (data), `js/encounters/boss-twists.js` (rules).

## Round

Reveal (Vault placement) → Explore → Meet → dusk → Lost & Found. Dreams: 31 (Final Recurrence, You Never Wake Up, Theta, and Alpha cut; Delta, Beta, Circadia, Somnambulance, Homeostasis, and Pineal Purge folded in). Named-Landscape Dims reach tiles still in the Vault and set them aside until the reset.

## Progression

- Dream Forms and upgrades: `js/cards/dream-forms.js`. Form Objects: Mirror (Echo), Rope (Ladder), Conch Shell (Chord), Spark of Sun (Trinity), Monkey Paw (Trifecta), Egg (Unity).
- Lost & Found: `js/shop/lost-found.js`, `js/ui/lost-found-panel.js`. Prices live in `data/objects.json` (`price`).
- Boons: `js/dreamers/boons.js`. Archetype cards are points and quests only.

## Score

Archetype points ×2 + each Boss's climb (11 − rung) + best spread Power + 20 to wake + 1 per Object, token, and ally + the small-table bonus. Psyche in hand does not score. `js/core/scoring.js`, `js/ui/run-summary.js`.

## Still open

- Bot policy: shopping, Boon choice, Boss planning, and Form building (A9). Until then, sim win rates are not balance.
- Object limit test: run the sim at a fixed 6 and a fixed 10.
- Resonance (an adjacency bonus for shapes) is held back until a playtest shows players ignore board shape.
- The Ainmos cinematic needs production.

## Next playtest

At dawn after a Boss, does the draw of 3 feel like a reward the table earned, or like the one moment that decides whether the next Ante is survivable?

## 0.10 Solo Night (2026-10-14)

Phil's calls after playing 0.9, now locked:

- **Solo only.** One Dreamer per run, chosen at the menu. Goals use the solo points (4 / 6 / 12). In Meet, fights and Draw Mindstream repeat while actions last; each Landscape's unique action is still once per Meet.
- **Dreambeasts on the Dream Deck timer.** Ante = Dream, Dream + Mini-Boss (an ordinary beast, Power 2/4/4/5/6/6/7/8/8/9 by Ante, rises on The Bed), Boss Dream (lands on a random placed non-Wasteland Landscape; The Bed only if nothing else is placed). The non-Mini ordinary beasts form the Nightmare pool for the few Dreams whose Dim spawns.
- **Mindstream = Events + Power Tokens.** No beasts, no Draw-a-Dream cards, no spawning Events. Chess Objects are out of the shop. City and Lava move Dreambeasts instead of spawning them.
- **Dreams are always bad.** No Bright side; the Dim effect resolves on a one-button screen.
- **Power −1** across the ladder (Turtle 1/2/3 … Leviathan 11) and **ties go to the Dreamer** (Power+2 is ~75%, was ~54%).
- **The Long Night.** An empty Dream Deck no longer loses. Each dusk Represses 2 × (Long Night rounds) extra from the Waking Mind.

Bot sim (crude solo bot, 40 per length, two runs): Daydream 42–45%, Nap 22–37%, Deep Sleep 12–20%; 0 errors, 0 step caps. Most bot losses are an unmet Archetype goal (the bot hunts beasts over quests).

## 0.25 Endless Dreams (2026-10-16)

Phil's calls, now locked:

- **Any suit fights a Dreambeast.** A card of the beast's suit only adds the matching stat. Each Dreambeast instead **wards one Dream Form**: that Form loses 1 to 5 dice (by printed Power: 4 → 1, 11+ → 5). The spread then counts as its best Form after the Ward.
- **Dreambeasts grow with the Cycle**: printed Power + the Cycle number they arrive in. Archetypes stay Power 12 and need a Form.
- **Taps:** start 2 Power Tokens; an Accepted beast pays 2 tokens or an Object of its suit; an Archetype pays 1. Cap 6. **Sinks:** phase openers, +1 die per token in fights (max 3), Archetype and Dreamer powers, Look Again.
- **Psyche:** draw 2 each round, 5 at the dawn between Cycles, hand and respawn 6. Each Dreambeast still standing at dusk Represses 1 from the Waking Mind; Archetypes never mill.
- **Calling an Archetype needs a revealed home.** If none of the three offered has one, Repress 1 Psyche from hand to search the Landscape deck for the first missing home and place it on a random hex.
- **Endless Mode** after waking: the ladder continues, then Mindstream beasts; once every Archetype is Acquired each Cycle closes with a Leviathan: Leviathan+ 13, Leviathan_x 14, LeviaTHAN 16, L3V1@+H@N 20, L3V1@+H@N D3$TR0Y3R 0F DR3@M$ 99 (fixed Power, Ward 5, the last wards every Form). Felling the last plays the blue-screen ending.
- Forms cap at +24. The final Cycle brightens instead of warning.

Bot sim (smart bot, 40 per length): Daydream 57%, Nap 55%, Deep 0%; careless bot 0% everywhere. Token flow per night: tokens earned ≈ tokens spent, almost none lost to the cap. Psyche Repressed 45–65 vs Returned 13–33 per night; the Waking Mind is the clock.

## 0.26 Waking Hands (2026-10-16)

Phil's calls, now locked:

- **Stats are free base Actions.** Each phase opens with Actions equal to the matching stat (Lucidity → Reveal, Elasticity → Explore, Willpower → Meet), plus Objects that add to that phase. One spend on top, once per phase: 1 suited Psyche adds its value, 1 Power Token adds 1. It can come with the opener or later in the phase if you opened free (`phaseBaseActions`/`phaseSpendValue` in `js/core/rules.js`, `topUpPhaseActions` in `js/core/game.js`). Free Actions are used first; only bought Actions bank Glimmer (`state.phaseBought`, `glimmerIfUnused`).
- **Winged Turtle** is a plain Power 3 beast (plus the Cycle). The turtle stack is gone.
- **Death** discards Objects and the hand, keeps Power Tokens, and always shows the "You die... and wake back up on The Bed" notice naming what was lost.
- **Set search** (`js/effects/set-search.js`): once you hold a piece, the Lost & Found's first shelf is a missing piece, a beaten beast can pay one, and The One Mimics one (a copy that turns back into The One on Discard). Sets count distinct pieces.
- Psyche retuned for the free Actions: draw 1 per Dream (was 2), 4 at dawn (was 5).

Bot sim (smart bot 400 per length): Daydream 57%, Nap 57%, Deep 4% (0.25 measured 60% / 52% / 0%). Without the draw retune the free Actions alone made it 87% / 79% / 40%. Careless bot (200): 2% / 0% / 0%. Deaths per night fell (1.6 / 2.9 / 4.4, was 2.9 / 3.7 / 5.1). 0 errors, 0 step caps. The sim's bot opens free unless its free Actions fall short of what it wants and it holds 5+ Psyche. The bot still never shops or takes Objects, so Set search is covered by scenario checks, not the sim.

## 0.26.1 One Power (2026-10-16)

Phil's calls, now locked:

- **A Dreamer is three stats and one Power.** No passives, no hidden fight bonuses (Fantasy/Nightmare affinity and the suit-match +1 are gone). Each Power costs 1 Power Token and works only in the phase of the Dreamer's best stat (`DREAMER_POWER_PHASE` in `js/dreamers/dreamer-powers.js`): Visionary Second Sight (+2 free placements), Rested Lucid Rest (each Landscape placed this Reveal draws 1, up to 3), Runner Dash (+3 steps), Hunter Lure (every beast moves up to 2 toward or away from you), Immovable Hold the Line (+2 dice every fight this Meet), Weaver Reweave (discard up to 3, draw that many +1).
- **Seeds replay exactly.** Dice, Vault reinsertions and Landscape-action picks use the seeded RNG (`js/core/rng.js`, which also has a `globalThis.__ainmosRngTrace` debug hook).
- **One bot.** The smart bot's policy lives in `js/dev/autoplay.js`; the Node sim and the in-browser spectator both run it, and it now uses Dreamer Powers. The sim prepares data with the game's own `prepareGameData`, so it builds the same Mindstream decks the game does. `scripts/ainmos-seed-hunt.mjs` finds seeds with a strong first Cycle.

Bot sim (smart bot, 600 per length): Daydream 60%, Nap 52%, Deep 5%. Per Dreamer on Daydream: Weaver 89%, Immovable 79%, Rested 64%, Runner 56%, Hunter 52%, Visionary 21%. The spread predates this change (0.26 showed the same shape): with free Actions, Willpower 2 means two free fights every Dream. Still open.

## 0.26.2 Full Hands (2026-10-16)

Phil's calls, now locked:

- **Draw 3 Psyche at the start of every round** (`DREAM_DRAW`). It's the game's essential tap: never lower it to balance difficulty. Dawn still adds 4.
- **The Lost & Found closes every Dream**, before the next round's draw (`roundDrawPending` → `finishRoundOpening` on close), and shows your hand.

Bot sim (smart bot, 600 per length): Daydream 98%, Nap 94%, Deep 49%; careless bot near 0%. Phil is judging difficulty by playing before any rebalance.

## Difficulty targets (locked with Phil, 2026-10-16)

Measured with the smart bot (`node scripts/ainmos-bot-sim.mjs --per 500`), which stands in for a proficient player:

| Difficulty | Target win rate | Asks of you |
| --- | --- | --- |
| Daydream (Easy) | 70–80% | 3 Archetypes in 3 Cycles |
| Nap (Medium) | 50–60% | 6 Archetypes in 7 Cycles |
| Deep Sleep (Hard) | 25–33% | all 12 Archetypes in 15 Cycles |

Difficulty creeps up steeply: each step asks you to do and survive more (twice the Archetypes, about twice the Cycles, stronger Dreambeasts up the ladder), and waking from Deep Sleep with all 12 opens Endless Mode's enhanced Leviathans. The goal is that casual players can get proficient and still reach Endless.

**The dial is the Psyche deck** (`PSYCHE_DECK_BY_LENGTH` in `js/core/data.js`): each length has its own composition, so the odds move without touching any other system. Test a composition with `AINMOS_PSYCHE="1:9,2:6,3:2,4:1/w2" AINMOS_LENGTHS=daydream node scripts/ainmos-bot-sim.mjs --per 500`. What the 0.27 tuning found: more 1s and 2s (more weak draws) makes the game harder; a smaller deck alone does not. Deep Sleep's length already makes it hard, so its deck is the kindest of the three.

## Scenario seed codes (0.27)

Type one in the menu's Seed box (case doesn't matter). The seed preview names it.

| Code | Effect |
| --- | --- |
| OOPS | Every suited Psyche card is a 1; Wilds unchanged |
| JILLY | The Dream begins Whole: every Landscape is placed face up (the Whole fanfare plays, and it folds at the next Dream) |
| ROWAN | Ordinary Dream cards do nothing; a Dreambeast rises on a random Landscape at the start of every round (the Cycle's Dreambeast and Archetype Dreams still come) |
| LEMON | All 12 Archetypes are already yours; the night is Endless Mode from the start, each Cycle closing with the next enhanced Leviathan |
| BUBBLEGUM | Every suited Psyche card carries a random upgrade (Chaotic, Vivid, Lucid, Recurring); Wilds can't take one |
| SOMNIAINMOS | Every Dreamer's stats are +1 (no stat is 0) |
| LEVIATHAN | Skips to the very end: the impossible dice fight, the crash, the blue screen (no score) |

Older codes still work: SOMNIA, DMZEMO, SPARK, FANTASY, NIGHTMARE, REM. Code: `SPECIAL_SEEDS` in `js/core/rng.js`, effects in `createInitialState` (`applyPsycheSeedCodes`, `beginLemonNight`), `drawDreamCard` (`rowanSpawn`) and `effectiveDreamerStat`.

## 0.27.1 Stacking Forms, power-only tokens, the true ending (2026-10-16)

Phil's calls, now locked:

- **Dream Forms stack.** A spread scores every Form it makes (`bestForm` in `js/cards/dream-forms.js` returns the sum, with `forms` listing each). 1-2-3 in three suits = Ladder + Trinity; three 1s of one suit = Unity + Trifecta + Chord + Echo. A ward trims only its own Form.
- **Power Tokens only activate powers** (Dreamer and Archetype). No more +1 fight dice, no token-opened phases, no token reroll in the Lost & Found (Glimmer only).
- **The Destroyer of Dreams** shows Power 99 / "99d6" but rolls 30d6 (`rollPower`). Felling it plays `js/ui/leviathan-finale.js` (an impossible fight, then the dice burst across the screen and the dream tears), then the blue screen, whose crash report saves the high score as **NaN** (`NAN_SCORE` = 999999999 with `breakdown.nan`, always shown as "NaN"; no backend change needed).
- **LEVIATHAN seed** plays that ending straight away (no score recorded).
- Decks re-tuned for the above: Daydream 11/6/2/1/0 + 2 Wilds (73%), Nap 12/6/2/1/0 + 1 Wild (57%), Deep 9/6/3/2/1 + 3 Wilds (32%).

## 0.27.2 Clear Events (2026-10-17)

- Archetype Events live in `data/archetype-events.json` (rules in `js/dreamers/archetype-events.js`). 48 Events: exactly 2 per home Landscape, so every Archetype draws from 4. Each Event has one Landscape, a flavor line that matches its art, a Bright, and a Dim. The old Mindstream Events are no longer drawn.
- Bright cost is one of: N Psyche of a suit (worth N), 1 Psyche of a suit worth min+ (worth min), or 1 Psyche of an exact value, any suit (worth that value). Wild counts as 5 of any suit. The player picks the cards (discard picker with a card filter).
- Each point buys one thing: +1 die, −1 Power, +1 spread card, Return 1 (player picks), Draw 2 Psyche, Reveal 1 Landscape, Draw 1 Object. No Form needed and keep-spread-on-loss are worth 2. `unbalancedEvents()` checks cost = worth.
- Dim is one drawback: Power 14, −2 dice, cap 2, no stats, three-card Form, or Repress 2 on a loss.
- Bright is still open only while its Landscape is placed.
- Smart bot (150/length): Daydream 71%, Nap 53%, Deep 26% (0.27.1 was 75/57/33), all inside the targets. Browser check: `scripts/ainmos-0272-events-check.mjs`.

## 0.30 Dream Tales (2026-10-18)

Phil's calls, now locked:

- **Sets are used by choice.** Completing a set announces it once; a Use button sits beside Objects (`readyObjectSets`/`useObjectSet` in `js/effects/object-effects.js`). The picker shows all 12 Archetypes as pills with their power on hover (`js/ui/set-archetype-screen.js`); only those still in the deck can be picked. A used set goes to `state.spentSets`, shows in the Subconscious viewer as "Used Sets", and never returns. The pieces spiral into a shadow that lights into the Archetype (`js/ui/set-spiral.js`).
- **Jewelry matches suit colour:** Silver Sapphire Ring = Lucidity, Golden Ruby Necklace = Willpower, Yellow Diamond Bracelet (new art `art/objects/yellow-diamond-bracelet.webp`, hue-shifted from the Brass Emerald) = Elasticity.
- **Power curve:** `cycleGrowth` = +1 every 4 Cycles; ordinary beasts cap at 11, the ladder Leviathan at 12, Endless Leviathans stay fixed 13+ (`js/encounters/beast-wards.js`). Deep Sleep keeps the Leviathan for Cycle 15, with ordinary Nightmares (Mini-Boss Power) filling Cycles 10–14 (`insertBossDreams`).
- **Every Dreambeast has a twist** (`js/encounters/beast-twists.js` for the 23 ordinary beasts + Winged Turtle "Shell"; ladder Bosses keep theirs). Hooks: fight dice/power/cap/ties, phase Actions while standing, no Returns, no Dreamer Power, dusk effects, loss effects, Meet-start hops (`applyBeastTwistsAtDusk`/`applyBeastTwistOnLoss` in `boss-twists.js`).
- **Pressure:** dusk Represses 2 per standing beast (`DUSK_REPRESS_PER_BEAST`), played as its own cinematic (`js/ui/dusk-toll.js`). Losing a beast fight Forgets a Landscape (one the beast names if placed, else a random unoccupied edge; `forgetOnLostFight` in game.js). Random spawns prefer a tile of the beast's suit.
- **The Dream is Whole:** placing every Landscape (vault + deck empty, none set aside) pays +2 Power Tokens and Return 4 once per Dreamscape (`checkDreamscapeWhole` in landscapes.js); the fold at the next round animates (`js/ui/dreamscape-whole.js`). JILLY now starts the night Whole (no longer makes every Psyche a 4).
- **One beat at a time** (`js/ui/fx-timeline.js`): card flights mark the table busy; menus opening mid-flight wait and fade in; flights wait while a big menu is open (Lost & Found and Vault stay live); the dusk toll and Whole fanfare wait for cards in the air.
- **Hand sort** buttons (suit then value / value then suit).
- **Story:** `js/meta/chronicle.js` records the night (`state.chronicle`) and writes mad-lib play-by-play lines with glowing slots (`pbp-*` classes); `js/meta/dream-story.js` builds ~3 pages of end credits from it (falls back to runStats/acquiredArchetypes for older saves); `js/ui/dream-credits.js` rolls them on every win before the end screen ("Read the Dream" replays). Endless triumph closes with the lines about the dream someone else dreamed first.
- Checks: `scripts/ainmos-030-check.mjs` (features, Playwright), `scripts/ainmos-030-story-check.mjs` (bot plays a night in the browser, saves the story text).
- Retune: Nap deck 11/6/3/1/0 + 2 Wilds (was 12/6/2/1/0 + 1). Smart bot, 400 per length: Daydream 75.3%, Nap 56.3%, Deep 29.3%; 0 errors, 0 step caps.
- Phil's own 0.29.1 Deep Sleep save (The Immovable, cloud save "DM Z"): 12/12 Archetypes by Round 26 (Cycle 10 of 15, five Cycles spare), 11–10 in fights, 2 deaths, Subconscious empty at the end; two Archetypes came from sets. That ease drove the 0.30 pressure changes.

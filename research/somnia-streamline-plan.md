# Somnia streamline plan — 41.0

Status: **shipped as Somnia 41.0.** The approved plan is below, unchanged. What was built, where it departs from the plan, and the measured results are in **As built** at the end.

Source of truth: the 40.4 engine (`core/state.js`, `core/game.js`, `core/rules.js`, `encounters/meet-phase.js`, `dreamers/subconscious.js`, `dreamers/quests.js`, `board/landscape-actions.js`, `cards/mindstream-choices.js`, `effects/effects.js`, `dev/bot-ai.js`) and `data/*.json`. Evidence comes from `scripts/somnia-40-bot-sim.mjs` run against 40.4. Variants were run on engine copies outside the repo. The bot plays worse than a person, so treat its rates as loose. The structural findings do not depend on its skill.

Companions: `somnia-dead-ends-audit.md`, `somnia-tightening-plan.md` (§3.1 is adopted below), `somnia-rules-delivery-plan.md`.

## The pillar

> Wake up before you forget yourself.

The Waking Mind (the Psyche Deck and its discard) is what you are losing. Dreambeasts left standing are what take it. **Remember** is how you win it back. Archetypes are who you become on the way out. Every rule in 41.0 either serves that sentence or is cut.

## Evidence (40.4, Nap, bot)

| | 2 Dreamers | 3 | 4 |
| --- | --- | --- | --- |
| Win rate | 0.8% | 1.2% | 0.8% |
| Losses that are "Psyche Deck exhausted" | 100% | 100% | 100% |
| Games with 0 Archetype points | 69% | 66% | 65% |
| Final Recurrence won | 0 / 330 | 0 / 316 | 0 / 339 |

- **The mill is the clock.** 91% of Psyche sent to the Subconscious comes from the round-end tax (`applyRoundResourceTax`, `meet-phase.js:149`), about 30 cards in the main game and 4–7 in Final Recurrence.
- **Hands are full when the table loses.** At loss, hands average 19.5 / 29.4 / 39.7 cards at 2 / 3 / 4 Dreamers, which is the hand limit of 10 each. The loss check (`state.js:1173`) reads only the deck and discard.
- **One Archetype at a time bricks scoring.** When the first Active Archetype is Warrior, Magician, or Sage, 91–95% of games score 0. Even the best opener, Orphan, scores 0 in 45%. The only way to change target is The Party's `swap-archetypes`.
- **Final Recurrence opens with ~11.5 Power 12 Archetypes.** Each fight is about 53% with a full hand's best three cards and a +2 stat. Each Archetype also mills 1 per round.
- **Tested variants** (400 games per table):

| Variant | Win rate (2 / 3 / 4) | 0-point games | Where losses went |
| --- | --- | --- | --- |
| 40.4 | 0.8 / 1.2 / 0.8% | 65–69% | Psyche exhausted |
| A. Final Recurrence summons 1 Archetype per Dreamer | 1.8 / 1.5 / 0.5% | 66–68% | Mostly Psyche, some Dream Deck |
| B. Halve the mill | 0.0 / 2.2 / 0.0% | 65–70% | Psyche exhausted |
| A + B | 1.2 / 1.2 / 1.8% | 65–70% | Dream Deck (Final Recurrence never ends) |
| C. 4-pointers to the bottom of the Archetype deck | 0.8 / 0.8 / 1.5% | **54–61%** | Psyche exhausted |

  No single knob fixes it. Scoring is the binding constraint, the mill decides *which* clock ends a stalled game, and Final Recurrence can't be won where it sits. That is why 41.0 changes all three, and teaches Remember as the counter-play.

- **Return is scattered and mostly random.** 29 of 105 Events mention Return, mostly behind stat gates, "if it matches," "higher or lower," or "per Affected Landscape." 9 of 48 Objects do, and all but Monkey Paw are one-shot Instants. 7 Dreams do (Paradox is being cut). 5 Landscapes do, split across Lucidity and Willpower. The bot never seeks a Return, and when one fires it Returns the first card listed (`bot-ai.js:389`).

## Part 1 — The six edits

### 1. Chase one of three dreams

**Change.** Replace `state.activeArchetype` with `state.archetypeRow`: 3 face-up Archetypes. Quest progress is tracked per Archetype. Acquire whichever one has both quests true, and refill from the deck. Sage, Magician, and Warrior are shuffled into the bottom half of the Archetype deck, so they surface after the first boss. Retire `swap-archetypes`: The Party takes `move-2-dreamers-1` under §4.

**Why.** VIC-11 Completing Targets, UNC-10 Variable Setup, and Meier's interesting decisions: "which dream does this map give us?" is a choice. Today the setup makes that choice for you.

**Touches.** `core/state.js` (setup, `acquireArchetype`, `beginFinalRecurrence`), `dreamers/quests.js` (`isQuestConditionMet` per Archetype), `core/game.js:824-832` (the quest buttons), the Archetype panel UI, `tutorial/tutorial-mode.js` (pins Innocent into the row), save migration, and the bot `tryAcquire`.

**Target.** 0-point games under 30% in the sim.

### 2. Show the clock that kills you

**Change.** Call the Psyche Deck and its discard the **Waking Mind**. A top-bar counter beside the Dream Deck shows `Mind 23 · −3 at dusk`. Each Dreambeast on the board (and each Remaining Archetype during Final Recurrence) wears a −1 badge. Delete the Mindstream-suit loss (`goneMindstreamSuit` in `checkDefeat`), which never fired in about 6,000 sim games.

Three losses remain to teach:
1. The Waking Mind runs dry.
2. The sixth death.
3. The Dream Deck ends the night.

**Why.** VIC-10 Exhausting Resources works in Pandemic because the player deck is visible. Meier: explain the setback before it lands.

**Touches.** Top bar, `meet-phase.js:149` narration, `checkDefeat`, glossary (Psyche Deck → Waking Mind), guide losses section, score screen.

### 3. Final Recurrence is three rounds at The Bed

**Change.** `beginFinalRecurrence` summons **one Archetype per living Dreamer**, cheapest first from the row and then the deck, and all of them stand on The Bed. The table has **3 rounds**: win every fight and you wake. Each standing Archetype still mills 1 at dusk. If Final Recurrence is still under 20% in the sim after Part 2, cut it, and let the Dream Deck ending be the loss.

**Why.** VIC-16 Finale: short, clear stakes, a climax rather than a wall. Variant A showed that capping the count alone is not enough, because Archetypes spread across the map and the night runs out first.

**Touches.** `beginFinalRecurrence`, `placeFinalArchetype`, the end-of-night Dream count becomes a round counter, the score screen, and the bot's Final Recurrence branch.

**Target.** Final Recurrence won 20–40% when reached.

### 4. Let the suit teach the rule

**Repress is a printed cycle.** Lucidity represses Willpower, Willpower represses Elasticity, and Elasticity represses Lucidity. Rewrite `rejectSuit` on all 33 beasts in `data/dreambeasts.json`, and show the cycle on the fight panel and the beast card.

**Landscape families.** Each suit's Landscapes do one family of verbs, adopted from the tightening plan §3.1 and adjusted so that Return lives only on Lucidity:

| Suit | Family | Tiles and action |
| --- | --- | --- |
| Lucidity | Sight & Memory | Tranquil Grove, Silver Mist, Day in the Life, Black Void: **Remember 2**. Sky, Desert, The Attic: `flip-top-3`. Scary Classroom: `draw-2-keep-1`. Field of Broken Glass: `swap-landscapes`. Awards: `take-power` (the one cross-suit prize) |
| Elasticity | Motion | Road, Endless Hallway: `move-2-dreamers-1`. Endless Ocean, Candy Mountain: `move-1-dreamer-2`. The Party: `move-2-dreamers-1`. Forest: `draw-any-mindstream` |
| Willpower | Fight & Body | City, Lava: `spawn-dreambeast`. The Basement, Sea of Teeth: `move-2-dreambeasts-1`. House, Insanity: `cycle-psyche`. Suburbia, Inner Sanctum: `take-power` |

Retired actions: `swap-psyche`, `all-toward-bed`, `swap-dreambeasts`, `return-1`, `return-2`, `return-psyche`, `return-object`, `return-event`, `replay-dream`, `swap-archetypes`, `peek-then-move-1`, `draw-1-psyche`, `draw-psyche-equal-to-elasticity`.

**Why.** RES-07 Rock, Paper, Scissors. Millers: read the rule off the component. Crawford: 24 names for about 9 verbs hide the game.

**Touches.** `data/dreambeasts.json`, `data/landscapes.json`, `board/landscape-actions.js` (delete the retired cases and add `remember-2`), guide line 636, the tile tooltips, and the Archetype quests that name Landscapes (unchanged names, new actions).

### 5. A Bright you can earn

**Change.** When an Event's named Landscape is Wasteland, Bright offers **"Dream it open: +1 Lucidity."** Pay Bright's cost plus 1 Lucidity Psyche, Reveal that Landscape (the player picks if the Event names two), and resolve Bright. Delete the Bright shrink (`scaleEventCount`), so Bright pays what it prints.

**Why.** "No… but you could…" Today a fresh map shuts Bright about 95% of the time, which is TRN-16 Lose a Turn in costume.

**Touches.** `cards/mindstream-choices.js` (`canPayEventGood`, `eventGoodCardsNeeded`, the `resolveMindstreamChoice` guard), the Bright labels, and the tutorial line about Dim.

### 6. Sweep the dead ends

**Change.**
- Delete Paradox (`dreams.json`, 2 files), `flipLeviathan` (4 files), and `skipNextExplore` (3 files).
- Fix `guide.js:557` ("either order"). The engine requires the Dream first.
- Fix `guide.js:636`: Repress now uses the cycle.
- Remove Flee and Reject from the glossary.
- Fix the invalid byte in `data/mindstream.json`. Portal to Another World has a Windows-1252 dash, which the browser shows as a replacement character.

**Target.** `somnia-effect-wire-check.mjs` passes, and greps come back empty.

## Part 2 — Remember: Return you can count on

Proposed as a more elegant shape for the Return request. Same sources you asked for (Objects, Bright Dreams, Bright Events), one verb, printed numbers, and a cost in Psyche.

### The rule

> **Remember N.** Discard up to N Psyche from your hand. Return that many cards plus 1 from the Subconscious to their discard piles.

- Remember 1 = discard 1, Return 2. Remember 2 = discard 2, Return 3.
- You choose which Subconscious cards come back. A Returned Psyche goes to the Psyche discard, so **each one is +1 Waking Mind**, and the counter ticks up.
- Discarding 0 still Returns 1. A table with an empty hand can still Remember a little.
- It replaces every "Return N", "Return cards up to…", and "Return 1 per Affected Landscape" in the data. Filtered Returns (Object, Event, Dreambeast) keep their filter.

**Why this shape.** It turns the full hands the sim found at the loss into the Mind the table needs. It's the "spend Psyche to Return" you asked for, as one sentence. It reuses the existing `requestReturnCards` picker. Finally, Remember sits in Lucidity, the suit already called Sight & Memory, so the suit predicts the verb.

### Where Remember comes from (recognizable taps)

| Tap | What | Reliability |
| --- | --- | --- |
| **Memory tiles** | 4 Lucidity Landscapes: Remember 2, once per table per Meet each | On the map, visible, can be walked to |
| **Objects** | Every current Return Object becomes **Persistent: 1 Meet action, Remember 1** (Candle, Mirror, Psychic Owl, Flower, Hammer, Tear of the Moon, Spark of Sun, Monkey Paw, The All). Add Remember 1 as the Persistent tap on 4 more Lucidity Objects, for 13 of 48 in total, most of them Lucidity | Accepting a Lucidity beast draws a Lucidity Object, so you know where they come from |
| **Bright Dreams** | Loss, Recovery, Circadia, Pineal Purge: "Bright: Remember 2". Misplaced keeps its Object filter | Printed, fixed |
| **Bright Events** | About 12 Lucidity Events become "Bright: Remember 1–3", with fixed numbers and no "if it matches" or "higher or lower". The stat-gated Return Events become fixed Remember. Willpower and Elasticity Return Events become their own family's verbs | Printed, fixed, and Bright is earnable under edit 5 |
| **Full hand** | A leftover action with a full hand Remembers 0 (Returns 1) instead of drawing nothing | Always on |
| **Archetype powers** | Innocent: Remember 3. Fool: Remember Dreamers+1. Creator, Ruler, and Lover keep their filtered Returns | Once Acquired |

Return leaves: Willpower tiles (House, Insanity, Inner Sanctum), random Event riders, and the clear-Subconscious Dream replay. That last one is the second rewind the audit flagged (§2), so it's cut, and clearing the Subconscious becomes simply good.

### Remember in the tutorial

The 40.4 tutorial already walks a two-Dreamer night. Add one beat after the first dusk mill, when the counter shows `Mind −1`. Walk to Tranquil Grove, Remember 2 by discarding a spare Willpower 1 and a Lucidity 1, and Return three cards. The counter goes up by 3. One sentence: "Remembering is how you win back your mind."

## Part 3 — Bot 41: the Mind-keeper

The spectator bot (`dev/bot-ai.js`) and the sim's bot (`scripts/somnia-40-bot-sim.mjs`) are separate policies that drift. 41.0 moves the policy into one module, `js/dev/bot-policy.js`, which both import, and the sim becomes `somnia-41-bot-sim.mjs`.

### What the bot computes each decision

- **Mind** = Psyche deck + Psyche discard.
- **Dusk** = Dreambeasts on the board, or standing Archetypes during Final Recurrence.
- **Runway** = Mind ÷ max(1, Dusk + the expected Dim Repress), in rounds.
- **Surplus** = hand size − 6. Cards above 6 are fuel, not safety.

### Priorities

1. **Runway ≤ 3:** Remember first.
   - Reveal a Memory tile if none is face up.
   - Walk the Dreamer with the most surplus toward the nearest Memory tile.
   - Activate Remember Objects (1 Meet action each).
   - Choose Bright-Remember over other Brights.
2. **Surplus > 0 with a tap in reach:** Remember with the surplus, even when runway is fine. Spend the lowest-value cards of suits no near-term quest or fight needs.
3. **Picking what comes back:** Psyche, highest value first. Then Objects that complete a set. Then Events. Dreambeasts last, because a Returned beast goes back into the Mindstream deck.
4. **Clear beasts by dusk:** fight the beast whose removal saves the most runway per card spent, before taking Draw Mindstream.
5. **Archetypes:** chase the row Archetype with the fewest missing quest steps whose named Landscapes are still revealable.
6. **Final Recurrence:** pool toward Power + 2 on the cheapest Archetype first, and add token dice when the gap is 1–2.

### Bot acceptance

In 600 games per table at Nap:
- Bot 41 Returns at least 15 Psyche per game.
- No more than 60% of losses are "Waking Mind runs dry."
- The win rate is at least 10× the 40.4 baseline.

The sim report records Remember sources (tile, Object, Bright, full hand) and runway at dusk.

## Order of work

1. **Edit 6, then 2.** The sweep and the counter. Cheap, no balance risk, and the counter gives Remember something to move.
2. **Remember (Part 2), with edit 4's Landscape families.** Same data files and the same tiles.
3. **Edits 1 and 3.** The Archetype row and the new Final Recurrence.
4. **Edit 5.** The earnable Bright.
5. **Bot 41 and the 41 sim.** Run baseline, then each step cumulatively, and record the numbers in this file.
6. **Release.** Guide, glossary, and tutorial pass; `SOMNIA_VERSION = "41.0"`; the changelog entry; and the sw.js cache bump.

## Keep — this is crunch

- Leftover actions draw Psyche, and with a full hand they now Remember.
- One Power on each beast, for both Accept and Repress.
- The dice fight with a 1–3 card spread and token dice before the roll.
- The dusk mill, now visible, with a counter-play.
- The shared Death Clock and free Acquire.
- The whole table Reveals, then Explores, then Meets. That is Interleaved in the book's terms (TRN-15).

## Next playtest

By round 2, can the table say which dream it is chasing and how many rounds of mind it has left? And does anyone walk to a Memory tile on purpose?

---

## As built — 41.0

### What shipped

| Edit | Built | Files |
| --- | --- | --- |
| 1 Archetype row | 3 face-up; Acquire any ready one; refill; 4-pointers shuffled into the bottom half; The Party moves Dreamers; row chips in the Archetype panel | `core/state.js` (row helpers, `acquireArchetype`, `completeQuest`), `dreamers/quests.js` (`rowArchetypes`), `ui/ui.js`, `tutorial/tutorial-mode.js` (row of one), `dev/dev-commands.js` |
| 2 Waking Mind | Top-bar `Mind N · −D at dusk` with warn/critical tint; −1 badge on every standing beast and Final Recurrence Archetype; Mindstream-suit loss deleted | `encounters/meet-phase.js` (`wakingMindCount`, `duskMillCount`), `ui/ui.js`, `play.html`, `css/game.css`, `core/state.js` |
| 3 Final Recurrence | **Two** cheapest Archetypes, all on The Bed, 3 rounds (`FINAL_RECURRENCE_ROUNDS`, `FINAL_RECURRENCE_ARCHETYPES`) | `core/state.js`, `ui/ui.js` |
| 4 Suit teaches the rule | Repress cycle in data (33 beasts, 11 per suit) and `REPRESS_CYCLE`; Landscape families per §4 table | `data/dreambeasts.json`, `core/rules.js`, `data/landscapes.json`, `board/landscape-actions.js` |
| 5 Earnable Bright | "Dream it open": Bright's cost + 1 Lucidity reveals the first named Wasteland Landscape, then Bright; `scaleEventCount` returns the printed number | `cards/mindstream-choices.js`, `board/event-landscapes.js` |
| 6 Sweep | Paradox, `flipLeviathan`, `skipNextExplore` gone (Travel/Wanderlust/Trapped Dims now Forget 1 / Repress 1 from hand / Repress 2 from the Mind); guide "either order" and "opposing suit" fixed; Flee and Reject glossary entries removed; 10 bad bytes in `mindstream.json` and 10 replacement chars in `event-landscapes.json` fixed; the Power Token radial's dead "Activate Object" button removed | many |
| Remember | `effects/remember.js`; Memory tiles (`remember-2`); 12 Persistent Remember Objects; 34 Event Brights and 4 Dream Brights; Innocent / Fool; clear-Subconscious replay cut | `effects/remember.js`, `effects/resolution-effects.js`, `effects/object-effects.js`, `data/objects.json`, `effects/event-resolutions.js`, `cards/dream-resolutions.js`, `dreamers/archetypes.js`, `dreamers/subconscious.js` |
| Bot 41 | `dev/bot-policy.js` shared by the spectator (`dev/bot-ai.js`) and `scripts/somnia-41-bot-sim.mjs` | — |
| Teaching | Guide, Primer, Glossary (Dusk, Memory Landscape, Remember, Waking Mind added); changelog 41.0; version labels; `sw.js` cache names and precache list | `meta/*.js`, `index.html`, `play.html`, `sw.js` |

### Departures from the plan, and why

- **Final Recurrence summons two, not one per Dreamer.** One per Dreamer won 40% / 16% / 4% of Final Recurrences at 2 / 3 / 4 Dreamers. Two won 28% / 35% / 29%, inside the 20–40% target at every table size, and it's one sentence to teach. Power 10 and 4 rounds were also tested and scaled worse with table size.
- **The full-hand Remember was built, measured, and removed.** It became the largest source of Returns (21–29 cards a game), cost no Psyche, and was not a tap. That works against "Return comes from recognizable taps" and "spend Psyche to Return". Full-hand leftovers spend and draw nothing, as in 40.4.
- **Return Brights on every suit became Remember, not only Lucidity.** Returns stay where players have learned to find them on cards. Suit purity is enforced on the map, where the tiles are.
- **Remember keeps the old ceiling.** "Return N" became "Remember N−1", so the most you can Return is unchanged, but now you pay Psyche for it. Dream Brights already charge a Psyche toll, so they pay at the Remember rate instead: Loss is discard 4 Willpower → Return 5, Recovery 2 → 3, Circadia 3 → 4, Pineal Purge 4 → 5.
- **12 Remember Objects, not 13:** the five old Lucidity Return Objects plus Egg, Red Apple, Possibility Polyhedral, then Hammer, Spark of Sun, Monkey Paw, and The All. Flower and The All Remember 2.
- **Dream it open reveals the first named Landscape** rather than asking the player to pick one.
- **Two engine fixes the bot exposed.** Unique tile actions were locked per action id, so one Remember 2 locked all four Memory tiles. They are now once per table *on that tile*. A Persistent Object tap spent the Dreamer's once-per-Meet fight key, so tapping an Object blocked that Dreamer's Meet. Object taps now use their own key (`MEET_ACTIONS.OBJECT`), once per Object per Meet.
- **No new tutorial beat.** The Remember lesson is in the Primer, Guide, and Glossary. The scripted tutorial is unchanged, apart from keeping its row to the Innocent.

### Results (Bot 41, Nap, 300 games per table, `scripts/somnia-41-bot-report.json`)

| | 2 Dreamers | 3 | 4 |
| --- | --- | --- | --- |
| Win rate (40.4 bot on 40.4 → 41.0) | 0.8% → **44.0%** | 1.2% → **54.7%** | 0.8% → **45.0%** |
| Games with 0 points | 69% → 3% | 66% → 3% | 65% → 2% |
| Archetypes Acquired | 0.48 → 3.69 | 0.55 → 3.83 | 0.55 → 3.60 |
| Final Recurrence won | 0 / 330 → 74 / 238 | 0 / 316 → 92 / 219 | 0 / 339 → 79 / 232 |
| Psyche Returned per game | — | 25.9 (Memory tiles ≈ 19, Bright ≈ 1.6, Objects ≈ 2.5) | — |
| Losses: Mind ran dry / Final Recurrence timeout | 6 / 162 | 13 / 122 | 13 / 151 |
| Errors / step caps | 0 / 0 | 0 / 0 | 0 / 0 |

Bot acceptance (§Part 3): Psyche Returned ≥ 15 ✓. Win rate ≥ 10× baseline ✓. Mind-empty ≤ 60% of losses ✓ (it is 4–10%).

**Read this with care.** A competent bot now wins about half its games, and the Mind rarely runs dry once a table Remembers on purpose. Expect skilled human tables to win more often than that. If live play feels easy, the cleanest knobs, in order:
1. Remember returns k instead of k+1.
2. Memory tiles Remember 1.
3. Final Recurrence Power 12 → 13.

The 40.4 → 41.0 comparison changes the bot as well as the rules. The 40.4 bot never Remembered.

### Verification

- 16 focused engine checks (Dream it open, row, Final Recurrence, Remember arithmetic, Repress cycle): all pass.
- `scripts/somnia-effect-wire-check.mjs` (updated for Remember): no new issues versus 40.4. The 19 remaining flags were inherited from 40.4.
- Live browser play on a local server: the menu Primer, Mind counter, row chips, Memory-tile Remember 2 prompt, discard picker, Return picker, and the Meet action spend all work.
- Not runnable: five audit scripts (`tutorial-*`, `final-recurrence-audit`, `somnia-balance-sim`) import pre-restructure paths (`js/data.js`) and failed before 41.0 too.
- Found, not changed: `js/app/pwa.js` registers `../sw.js` from `js/app/`, which 404s, so the offline worker has not registered since the folder restructure.


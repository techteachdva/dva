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

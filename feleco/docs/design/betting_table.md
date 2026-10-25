# Feature Spec: The Betting Table ("Ecosystem Roulette")

Status: v0.3 (implemented) · 2026-10-25 · Owner: Philip

> **v0.3: what shipped, and how it differs from the sections below.**
> - **Layout:** desktops, laptops and iPads show the **whole table on one screen**. It is three panels (Who rules, Named creatures, Specials) on one board, scaled to fit.
>   - Only phones held upright use the swipeable pages.
>   - Portrait phones get a 720×1280 canvas so the text stays readable.
> - **Few words on the felt.** Details live in hover cards on desktop (creature art, what wins, a likelihood bar, an example payout). A **How to bet** guide covers mobile.
>   - Until the first coin is placed, a ghost coin keeps arcing from the pot onto the felt to show what to do.
> - **Named creatures:** one male and one female of each species, one of them a tough or special kind. That makes 16 bets, under the cap of 18. The spawned creatures carry the same sex and kind.
> - **Cut to fit:** **Elder** was cut because it overlapped Lives. **Doomed** became **Dies early**: the creature dies in the first half of the run, so it isn't a near-certain bet.
> - **Upset:** now "one of the three long shots ends the biggest crowd".
> - **Payouts:** every multiplier is rounded **down** from fair odds minus the 5% edge, with short odds in 0.05 steps. Bets likelier than 90% aren't offered. No bet pays better than fair.
> - **Days:** all run lengths and ages are in days of sun and moon (see `day_night_cycle.md`). Lifespans come from `Clock.LIFESPAN_DAYS`.
> - **Results:** they fit on one screen without scrolling, with a card per bet and a line naming the biggest crowd at the end.
> - **Name filter:** creature names pass a classroom-safe filter (`NameGenerator.is_clean`).

> **v0.2 decisions (from Philip):**
> - **Dominance = population.** Faction and guild bets resolve on the largest *living headcount* at the end of the run, not biomass and not days ruled.
> - **Fish are bettable**, through a dedicated 4-box **Flood Toll** bet (§5.1).
> - **Betting during a run is allowed** (§5.3).
> - **Some bets pay out mid-run** the moment they are achieved (§5.2).
> - The table includes **highly conditional, lucrative prop bets** (§5.4).
> - **Mobile and tablet first-class.** On phones and iPads the table becomes swipeable pages with tap-to-place coins (§3.1).
Related: `docs/DESIGN.md` §7 (Game Loop & Betting), `docs/GAMEIFICATION_PLAN.md` ("Betting Game Mechanics")

## 1. Summary
A casino-style betting screen that appears before **every** run: Sandbox, Campaign and Challenge. You take glowing gold EP coins from a pot in the bottom-right corner and drag them onto betting boxes. Each box shows a creature's sprite. Bets work like roulette:
- **Inside bets** are on single named creatures, the table's "numbers".
- **Outside bets** are on factions, guilds and duels.
- **Special bets** cover extinctions and survival milestones.

Payouts scale with how likely the outcome is, not the flat +10 / +5 EP the game pays today.

### Goals
- Make the moment before a run feel tense and full of choices, like a roulette table.
- Use one betting flow in every mode. Campaign currently has no side bet.
- Turn EP into a stake you risk, not only a reward you collect.
- Show off the game's art: sprites, not abstract icons.

### Non-goals (v1)
- Cancelling a bet once the run has started. You can add new bets mid-run, but you can't withdraw placed ones.
- Multiplayer or shared tables.
- Real-money mechanics of any kind.

## 2. Where it sits in the flow
```
main_menu → (setup_board | campaign_setup | challenge_setup) → betting_table → world.tscn → resolution_screen
```
- **Setup screens** keep their world settings: counts, map, season, era and challenge rules.
- **Champion and side bet move to the table.**
  - Remove the champion picker and side-bet list from `setup_board.gd` (`_build_side_bet`, `_on_side_bet`, `_champion`).
  - In `campaign_setup.gd`, the faction pick stays as a **world** choice that sets the favoured faction's spawn counts. Betting on that faction is no longer automatic.
- **The table receives the roster** that will actually spawn (`gc.spawn_roster`, or a roster generated for campaign and challenge), so every inside bet names a real creature.

## 3. Layout (1280x720, `canvas_items` stretch)
```
┌──────────────────────────────────────────────────────────────────────────┐
│  ECOSYSTEM ROULETTE · Era 3 · 90 days · Table limit 60 EP       [Back]   │
├──────────────────────────────────────────────────────────────────────────┤
│  INSIDE — creatures (one box per named creature, 2 per species)          │
│  [sheep:Dolly][sheep:Bram][wolf:Ash][wolf:Fen][human:Ida][human:Oto] ... │
│   each box: sprite · name · ⏳ odds · stack of coins · ☠/♥ toggle         │
├──────────────────────────────────────────────────────────────────────────┤
│  OUTSIDE — factions                                                     │
│  [Sheep][Wolves][Humans][Falcons][Robins][Boar][Rabbits][Worms][Fungi]   │
│  GUILDS             [ GRAZERS ]  [ PREDATORS ]  [ DECOMPOSERS ]          │
│  DUEL               [ FALCON  ◀ vs ▶  ROBIN ]                            │
├───────────────────────────────────────────────┬──────────────────────────┤
│  SPECIALS                                     │  BET SLIP   │  ⬤ POT    │
│  [Extinction: pick species ▾] [Survive to N]  │  4 bets     │  ⬤⬤⬤ 37 EP│
│  [Total wipeout] [Boom: pop ≥ 2× start]       │  [Undo][Clear][Repeat]   │
│                                               │  [ START RUN ▶ ]         │
└───────────────────────────────────────────────┴──────────────────────────┘
```

### 3.1 Mobile and tablet layout (swipe pages)
The table switches to page mode when **either** of these is true:
- the viewport is narrower than 1000 px after stretch, or taller than it is wide;
- `DisplayServer.is_touchscreen_available()` is true.

In page mode:
- The felt is a horizontal `ScrollContainer` of full-width **pages**, one bet group per page:
  1. Factions & Guilds
  2. Creatures (inside bets)
  3. Fish & Flood
  4. Specials & Props
- **Swiping** left or right snaps to the nearest page with a 0.25 s ease-out tween. There is also a dot indicator, and arrow buttons for players who prefer them.
- The **pot, the bet slip and START** sit in a fixed bottom dock that stays visible on every page. The pot is in the bottom-right corner, within easy reach of the right thumb.
- **Placing coins by tap:**
  - Tap the pot to choose a chip size: 1, 5, or All. The pot glows with the current size.
  - Tap a box to drop a chip of that size on it.
  - Long-press a box (0.45 s) to take its coins back.
  - Dragging still works but is never required.
- **Size and spacing:** every touch target is at least 64 px tall, and boxes have 12 px gutters. Body text is never smaller than 18 px.
- **Safe areas:** the root margin respects `DisplayServer.get_display_safe_area()` so the notch and home bar don't cover anything.

### Palette (from `FelecoUi` constants in `scripts/ui/feleco_ui.gd`)
| Element | Token |
|---|---|
| Felt background | `MOSS`, with a `CARD` inner panel and a subtle noise or vignette |
| Box borders and dividers | `LINE` (1px), and `GOLD` (2px) on hover or drop target |
| Box fill | `GLASS` |
| Text | `CREAM` for titles, `MIST` for odds and secondary text |
| Coins and highlights | `GOLD`, with a `GOLD_DEEP` rim |
| "Dies" / extinction boxes | `CLAY` tint |
| "Survives" / boom boxes | `LEAF` tint |

Faction boxes take a stripe colour from the species colours already in `simulation_hud.gd` (count labels around lines 132–143, king-of-hill bars around lines 454–458). These should move into one shared `FelecoUi.SPECIES_COLOR` dictionary.

### Art: sprites, not SVG icons (hard requirement)
The current species icons in `assets/icons/<species>.svg` don't look enough like the creatures. **They must not appear on the table, and should be retired everywhere they stand in for a creature.**

- **Option A (preferred): use the real sprites.**
  - Load `assets/sprites/<species>.png`, or the region for that species in the atlas baked by `scripts/visuals/sprite_generator.gd`.
  - Add a helper `FelecoUi.species_texture(species, size) -> Texture2D`. It returns an `AtlasTexture` or a cropped `ImageTexture` with nearest or linear filtering to match how the world renders.
  - Draw it on a soft round "chip" backplate with a `shadow.png` underlay so it reads well at 48–96px.
- **Option B (fallback): redraw the SVG set** so each one matches its sprite's silhouette and colours. Apply this only to species that have no sprite.
- **Mushroom/decomposer art:** `mushroom.png`, and `mycelium.png` as the guild badge.

Places that currently use the species SVGs and need to switch to `species_texture()`:
- `scripts/ui/setup_board.gd:204` (`_species_icons[species]`)
- `scripts/ui/campaign_setup.gd:38-39` (faction buttons)
- `scripts/ui/challenge_setup.gd:94-95` (roster icons)

Non-species icons (shop, start, crown, survive, die, map, rain and so on) stay as SVGs.

## 4. Interaction: chips and drag-and-drop
Built on Godot's Control drag API: `_get_drag_data`, `_can_drop_data`, `_drop_data` and `set_drag_preview`.

| Input | Result |
|---|---|
| Click the pot | Pick up **1** coin; the cursor carries a glowing coin |
| Click the pot again, or scroll up while holding | Add 1 to the carried stack (number badge on the cursor) |
| Shift-click the pot | Pick up **5** |
| Ctrl-click the pot | Pick up **all** coins, up to the table limit |
| Drag from the pot | Start dragging the current stack (default 1) |
| Drop on a box | Place the stack; coins snap onto that box's pile with a clink and a gold particle burst (`FXManager`) |
| Drop on an invalid spot or press Esc | Coins fly back to the pot |
| Right-click a box | Take back 1 coin; Shift+right-click takes back all |
| Drag from a box | Move its coins to another box |
| Undo / Clear / Repeat | Undo the last placement / return everything / re-place last run's bets if affordable |

Touch (Mobile renderer):
- Tap the pot to pick up 1. Tap the pot again to increase the stack.
- Tap a box to place. Long-press a box to remove coins.

### Coin look
- A 32px gold disc with an emissive pulse: a tween on `modulate` between 1.0 and 1.25, period 1.6s.
- An optional `CanvasItem` shader adds a rim glow.
- Stacks show up to 5 coins offset by 3px; above 5 they show a ×N badge.
- The pot is a woven basket or pot of coins with an EP count. Coins shown in the pot = `min(EP, 30)`.

### Commit rule
- EP is **reserved** while you place bets and **deducted** when you press START RUN.
- Backing out of the table returns all reserved coins.
- START is disabled until at least 1 coin is placed. A "Watch only" link starts the run with no bets.

## 5. Bet catalogue

Payouts are given as `return = stake × M`, which includes the stake. Every multiplier comes from **estimated probability** `p`:

```
M = max(1.2, floor_to_0.5( (1 - EDGE) / p ))      EDGE = 0.05
```
`p` comes from a table of odds simulated offline (§7). The numbers below are **v1 placeholders** for a 90-day run with default counts.

| # | Bet | Roulette analogue | Wins if… | Placeholder p | M |
|---|---|---|---|---|---|
| 1 | **Faction** (9 boxes) | Straight up | The faction is the dominant faction at the end (current `winner` logic in `resolution_screen`) | ~1/6 to 1/12 per faction | 5–11× |
| 2 | **Guild: Grazers** | Dozen | The dominant faction is sheep, rabbit or boar | ~0.40 | 2.5× |
| 3 | **Guild: Predators** | Dozen | The dominant faction is wolf, human or falcon | ~0.35 | 2.5× |
| 4 | **Guild: Decomposers** | Dozen | The dominant faction is worm or mushroom | ~0.15 | 6× |
| 5 | **Bird duel** | Red/black | The chosen bird (falcon or robin) has more living individuals at the end; a tie goes to the house | ~0.48 | 2× |
| 6 | **Extinction: X** | Column | Species X reaches 0 alive at **any** point during the run | per species, see §6 | 1.5–20× |
| 7 | **Total wipeout** | 0 / 00 | Any 3 species are extinct at the same time | ~0.03 | 30× |
| 8 | **Boom: X** | — | Species X reaches at least 2× its starting count at any point | per species | 2–8× |
| 9 | **Survivor: name** | Single number | That named creature is alive at the end of the run | per species and length, §6 | 1.2–50× |
| 10 | **Doomed: name** | Single number (inverse) | That named creature is dead at the end | 1 − p(survivor) | 1.2–5× |
| 11 | **Survive to day N** | Split | That named creature is alive on day N, chosen at 25/50/75% of the run | per species | scaled |

**Dominance means population.**
- **Faction bets:** win if the faction has the largest living headcount at the end. A tie goes to the house.
- **Guild bets:** win if the guild has the largest **combined** headcount at the end.
  - **Grazers:** sheep, rabbits, boars.
  - **Predators:** wolves, humans, falcons.
  - **Decomposers:** worms, plus fruiting mushrooms counted at ½ each so a mushroom flush doesn't swamp the result.
  - **Robins and fish** are not in any guild. They are the house "0" for guild bets.

**Odds model (implemented in v0.2).** Until the offline odds table in §7 exists, `p` comes from a strength-weighted share of the current headcount:
- `p_i ∝ (count_i × strength_i)^1.3`.
- The prior strengths live in `BetBook.STRENGTH`.
- The multiplier is `(1 − 0.05) / p`, clamped to between 1.2× and 60×.
- **Live bets use the same model on the live counts**, so odds move with the valley.

### 5.1 Fish: the Flood Toll (4 boxes)
"How many fish die after the floods recede?" The count is cumulative over the whole run. A fish counts if it dies while stranded on dry land after a flood falls back, whether it suffocates or something eats it there.

| Box | Wins when the toll reaches | Placeholder M |
|---|---|---|
| 20+ | 20 | 2.5× |
| 30+ | 30 | 4× |
| 40+ | 40 | 7× |
| 50+ | 50 | 12× |

- These are **live-settled**: the box pays the moment the counter crosses its line.
- **Natural floods** make the bet live even if the player never presses Flood:
  - every 2 days in **Spring**, there is an 8% chance of a flood, with at least 12 days between floods;
  - every 2 days in **Autumn**, the chance is 3%.
- The player's Flood power can push the toll up deliberately; that's part of the fun.

### 5.2 Live-settled bets (win during the run)
These bets pay `stake × M` **the moment** they are achieved. When that happens:
- a gold toast appears and coins fly to the pot;
- the win is added to the chronicle;
- EP is credited immediately.

Live-settled bets:
- Extinction: X
- Boom: X
- Total wipeout
- Flood Toll (all 4 boxes)
- Survive to day N
- Phoenix (props)
- Doomed (it pays when the creature dies)

Bets that resolve only at the end are Faction, Guild, Duel, Survivor, Lone Survivor and Upset.

### 5.3 Betting during a run
- A **Bets** button in the HUD dock pauses the valley and opens the same table as an overlay. On mobile it is a full-screen sheet.
- Odds are re-priced from the live counts.
- There is a **late-bet tax**: `M_live = M × (1 − 0.5 × progress)`, where progress = day / run length. The value is floored at 1.1×.
- Bets that are already decided (an extinction that has happened, a creature that has died, a Flood Toll line already crossed) are locked.
- Coins are spent as soon as you press **Place bets**.

### 5.4 Prop bets (highly conditional, lucrative)
| Prop | Wins if… | M |
|---|---|---|
| **Phoenix: X** | X goes extinct **and later** climbs back to its starting count, through migration or breeding | 25× |
| **Lone Survivor: X** | The run ends with **exactly one** X alive | 15× |
| **Upset** | The faction that **started smallest** ends with the largest population | 12× |
| **Flood & Feast** | Flood Toll ≥ 30 **and** falcons are the largest faction at the end | 30× |
| **Elder: name** | That named creature lives past 1.25× its species' base lifespan (§6), so 12-month runs only | 40× |

Props are only shown when they are possible. For example, Elder is hidden for any species whose cap is shorter than the run.

Faction ID mapping uses `_bet_to_plural()` in `resolution_screen.gd`.

## 6. Survival feasibility: can anything live the whole year?
The figures below come from `scripts/agents/*.gd` and `markov_agent.gd::_age_and_die()`:
- **A year is 360 sim days** (`SEASONS` in `simulation_director.gd`, `DAYS_PER_SECOND = 1.0`).
- **Effective lifespan** = `_lifespan × (1 + bonus)`, where the bonus = energy gained × 0.03, capped at **+50%**.
- **Old-age death** can't happen before **75%** of effective lifespan. After that, a hazard applies: `1 − exp(−clock·mult/τ)` with `τ = 25%` of effective lifespan, and `mult` between 0.1 and 5 depending on condition. Death is **certain at 2.5×** effective lifespan.
- Health ≤ 0 (combat or starvation) kills a creature at any age.

| Species | Base lifespan | Max effective (×1.5) | Hard cap (×2.5) | Can it reach day 360? | Can it reach day 90? |
|---|---|---|---|---|---|
| human | 120 | 180 | **450** | Yes, if well fed and in top condition | Very likely |
| falcon | 90 | 135 | 337 | **No** | Likely |
| mushroom | 90 | — (dies at `_age ≥ _lifespan`) | 90 | No | Borderline |
| boar | 85 | 127 | 318 | No | Likely |
| sheep | 80 | 120 | 300 | No | Likely if not eaten |
| wolf | 75 | 112 | 281 | No | Likely |
| robin | 70 | 105 | 262 | No | Fair |
| worm | 45 | 67 | 168 | No | Unlikely |
| fish | 40 | 60 | 150 | No | Unlikely |
| rabbit | 35 | 52 | 131 | No | Very unlikely |

**Finding:** under the current rules **only humans can survive a full 12-month run**, and even they need the full energy bonus plus a low hazard multiplier to stay alive past day 135 until day 360. Your guess was that "humans, birds and wolves have better odds". For long runs that holds only for humans. Falcons and wolves lead the next tier for medium runs (90 days). Robins are below sheep and boar.

**Design rules that follow:**
1. **Survivor bets are only offered when `p ≥ 0.02`** for that species and run length. A run whose length passes the species' 2.5× hard cap (`2.5 × 1.5 × lifespan`) shows the box greyed out with "Can't survive this long".
2. In 12-month runs, use **Survive to day N** as the main single-creature bet. Its N is clamped to within each species' hard cap.
3. **Elder tuning (optional, for later):** to make full-year survivor bets possible for more species, add a per-species `elder_factor`. For example, wolf and falcon at 1.4× would put their hard cap near 393 and 472. This needs a balance pass (§7) and would change ecosystem dynamics, so it is not part of v1.
4. Newborns are never eligible for bets. Bets apply only to the named roster that exists at day 0.

## 7. Odds model
- **Offline:** a headless batch of N = 200 runs per (mode × length × count preset) logs:
  - who was dominant, minimum population per species, peak population per species, and the survival curve per species.
  - Output: `data/odds_table.json`.
- **At runtime:** the table looks up `p` from the closest preset and adjusts for the current counts with a simple log-odds shift by count ratio.
- If no data exists, it falls back to the placeholder p values in §5.
- The table shows odds to the player as **"×M"** on each box. A Foresight upgrade (already in the shop) also shows the underlying %.

## 8. Economy guardrails
| Rule | Value (v1) |
|---|---|
| Minimum to start | 1 coin, or Watch-only |
| Max per box | 20 coins |
| Table limit (total stake) | Sandbox 30 · Campaign `20 + era*10` · Challenge `15 + level*5` |
| Bankrupt floor | If EP < 3 when the table opens, the player gets 3 "house" coins that are free but can't be cashed out; their winnings pay normally |
| Mode bonuses | Campaign `era*5` and Challenge `level*10*streak` (current) are still paid on top. They are not staked |

Interaction with upgrades in `greenhouse_shop.gd`:
- **Shepherd's Blessing:** currently +15% population for the bet species. It becomes "+15% population for the species with the most coins on its faction box".
- **Side Eye** (exists only as a comment): becomes +10 to the table limit.
- **Foresight I/II:** show the probability % (I) or the 30-day trend arrow (II) on boxes.

## 9. Data and code integration
- **`GameConfig`** (`scripts/autoloads/game_config.gd`):
  - Add `bets: Array[Dictionary]`. Each entry is `{type, target, stake, multiplier, meta}`.
  - Keep `player_bet` and `side_bet_entity` filled for backward compatibility: they take the faction with the largest stake and the first survivor bet.
  - Add `last_bets` for the Repeat button. Save it in `save_meta()`.
- **New scene** `scenes/ui/betting_table.tscn` + `scripts/ui/betting_table.gd`, styled with `FelecoUi.build_screen()` and `dress_menu()`.
  - Sub-controls: `BetBox` (drop target), `CoinPot` (drag source), `CoinStack` (visual).
- **`simulation_director.gd`:**
  - Track `min_pop[species]` and `peak_pop[species]`, and emit `species_extinct(species, day)` the first time a count hits 0. The extinction and boom bets need this.
  - Record when bet creatures die (`death_day`) for Survive-to-N.
- **`resolution_screen.gd`:** replace `_calculate_ep_gain()` with `_settle_bets()`. It:
  - loops over `gc.bets` and pays `stake × M` for each win;
  - shows a row per bet (sprite, bet, ✓/✗, payout) with coins flying into the pot;
  - then adds the mode bonus as today.
- **Setup screens:** each one routes to `betting_table.tscn` instead of `world.tscn`.

## 10. Feedback and juice
- Hovering a box highlights it in gold and shows a tooltip with the creature's stats (reuse the setup_board tooltip).
- On drop: a coin clink (pitch rises with the stack size) and a small particle burst.
- START RUN: the roulette-style ball becomes a seed that rolls across the felt into the world transition.
- During the run, the HUD shows small chip markers on bet creatures and factions, extending `_setup_side_bet_marker()` to support several bets.
- On resolution, winning boxes light up in sequence like a slot payout.

## 11. Acceptance criteria
- The table appears before Sandbox, Campaign and Challenge runs. Esc or Back returns to the setup screen with EP intact.
- Coins can be placed on every box type by mouse (1, 5, all, or a drag stack) and by touch. Undo, Clear and Repeat work.
- **No species SVG icon appears on the table.** Every creature box shows a sprite.
- Survivor boxes that are impossible for the chosen run length are greyed out with the reason shown.
- Payout = stake × displayed multiplier, settled correctly for all 11 bet types (unit test per type, using a fake director).
- EP can't go negative. The bankrupt floor works.

## 12. Open questions
Resolved in v0.2: mid-run betting (yes, §5.3), fish (Flood Toll, §5.1), dominance (population).

**Still open:**
1. The campaign and challenge *progression* winner still uses "days ruled". Should it switch to end population too, to match the table?
4. **Elder tuning (§6.3):** do we want more species to have a real chance at a full year, or is "only humans can last" a feature that makes the human survivor bet the table's long shot?
5. **Campaign:** should the faction you pick for the world give a small odds discount or bonus on that faction's box?
6. **Odds transparency:** show × only, or % by default?
7. **Duel generalisation:** should we add more duels (Wolf vs Human, Sheep vs Boar) as a rotating "featured duel"?

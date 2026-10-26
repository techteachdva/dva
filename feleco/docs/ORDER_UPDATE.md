# Feleco 3.0 — The Order Update

Developer map of the systems that shipped after `docs/DESIGN.md` (v1) and `docs/design/betting_table.md` (the 2.3 roulette spec). Player-facing notes live in `scripts/ui/changelog.gd` (`FelecoChangelog`, version 3.0). This page is the code path.

A run is one year. The player bets on which **link of the food web** ends fullest, then watches the valley. Gold marks energy moving through that web. A golden creature can be taken in hand for a Rampage, which earns Greenhouse upgrades.

## Food-web groups

`SpeciesDB` (`scripts/ecs/species_db.gd`) is the registry. Groups, in `SpeciesDB.GROUPS`:

| Group | Members (singular id) |
|---|---|
| producer | scored from grass, trees, and bushes, not from a creature row |
| herbivore | sheep, rabbit, deer, goat |
| omnivore | human, boar, robin, bear |
| carnivore | wolf, falcon, lion |
| decomposer | worm, mushroom, beetle |
| river | fish (census only; fish are not one of the five Order groups) |

`id` is the node group and the scene name (`deer`, `lion`). `plural` is the census and bet key (`deer`, `lions`). `SpeciesDB.id_for("wolves")` returns `wolf`. `SpeciesDB.one("lion")` returns `mountain lion`.

The five creatures added in 3.0 are `SpeciesDB.NEW_SPECIES`: deer, goat, bear, lion, beetle. Each row is marked `"new": true` and carries `cap`, `hold`, `migrants`, `days`, `start`, a four-season `[metabolism, breeding]` table, a day/night row, and sprite size. Older species still have hand-written spawn paths in `SimulationDirector`; their rows are names, colours, and groups only.

### Adding a 3.0-style species

1. Add a row to `SpeciesDB.ROWS` and append the id to `NEW_SPECIES`.
2. Add `scripts/agents/<id>.gd` extending `CritterAgent`, and `scenes/<id>.tscn`. `_configure()` sets `diet`, `prey`, and `threats`. Diet entries are tried in order.
3. The director loads `res://scenes/<id>.tscn` into `_extra[id]` (`scene`, `NodePool`, `active`) for every `NEW_SPECIES` id. `spawn_offspring(id, parent, pos)` is the generic birth.
4. Copy `hold` into `SimulationDirector.HOLD_CAPACITY` under the **plural** key. `get_group_scores()` reads that dictionary and falls back to `10.0`. It does not read `SpeciesDB` `hold`.
5. Migration already includes every `NEW_SPECIES` plural. Founder count comes from `MIGRANT_COUNTS`, then `SpeciesDB` `migrants`, then `2`. Extinct species wait `MIGRATION_WAIT_DAYS` (12) before a `MIGRATION_CHANCE` (0.3) roll, then lock out for 45 days.
6. Goats are the exception at spawn: they start at `valley.random_pass_mouth()`, not on the meadow.
7. Add a Field Guide card and web node (below). `Roles.KINDS` is optional; species missing from it never roll a tough or special ability.

`CritterAgent` states are Forage, Chase, Flee, Herd, and Sleep. Winter sleep (`winter_sleep`, bears) forces Sleep for the whole winter. Chase only starts while `energy < hunt_below` and a prey tag is in the vision cone. Herd is a drift state, separate from the herd bonus on `MarkovAgent`.

## How full a group is

`SimulationDirector.get_group_scores()` is what The Order ranks. It is fill, not head count, so a mushroom bloom cannot outvote three wolves.

- Each animal contributes `count / hold`. Hold is `HOLD_CAPACITY[plural]`, or `MUSHROOM_HOLD` (40) for mushrooms. The group score is the mean over every member of the group, and a missing species counts as 0.
- Producers are `producer_count() / PRODUCER_HOLD` (`PRODUCER_HOLD` is 220). `producer_count()` sums grass density divided by 8, plus 3 per tree and 1.5 per bush.
- `get_group_counts()` is the head-count cousin used by lesson cards. It is not the bet.

`BetTracker` snapshots `group_score`, `group_peak`, `group_start`, and `group_extinct` (a group key becomes true when a species that started above 0 hits 0).

## The Order table

`scripts/ui/betting_table.gd` builds offers with `BetBook.catalogue3`. `BetBook.catalogue` / `judge` remain for the 2.3 bet types. `BetTracker` picks with `BetBook.is_v3`.

`catalogue3` arguments: current group scores, the starter roster, run length in days, day so far, a `BetTracker` snapshot (or `{}`), the Challenge scenario's featured bet, and the player's ranking of the five groups.

| Type id prefix | Resolves | When |
|---|---|---|
| `top:<group>` | that group is the fullest | end of run |
| `order:exact` | all five groups finish in the ranked order | end of run |
| `order:top3` | the first three of that ranking | end of run |
| `starter` (`survivor:` + name\|species) | that named starter is still alive on its `by_day` | that day, or end |
| `gextinct:<group>` | the group loses a species | as soon as it happens |
| `gboom:<group>` | group peak ≥ 2× its start fill | as soon as it happens |
| `drought`, `flood:30`, `golden`, `goldloop` | drought, 30+ flood-toll fish, 10 golden finds, gold reaches a decomposer | as soon as it happens |
| `scenario:<id>` | the scenario's own bet, judged by `ChallengeScenarios.judge` | depends on kind |

Odds:

- Group weights are `(0.3 + current fill) * GROUP_STRENGTH`. Strengths are placeholders (`producer` 1.2 … `carnivore` 0.6) until an offline odds table exists.
- `top` probability is that weight over the sum of weights, times 0.95.
- Exact order and top three use Plackett-Luce (`BetBook.order_p`) on the player's ranking. The default ranking is the weight order.
- `mult_for` is fair odds minus a 5% edge (`EDGE`), rounded down. Bets with `p > 0.9` are not offered. Multipliers stay inside 1.05 … 60.
- Moving a group up calls `_rank_up`, which reprices only `order:exact` and `order:top3`.
- Mid-run, the Bets button rebuilds the catalogue from live scores and ages, then multiplies every payout by `live_mult`. Re-ranking keeps that late-bet cut. The slip says odds lock when the coin is placed. A decided bet shows "Already happened" and is not offered again.

Starters (`STARTERS = 3`):

- `ROSTER_SPECIES` is the animal list without fish or mushrooms. Disabled species are skipped. Three different species are shuffled in.
- `BetBook.roll_starter` rolls health, speed, and appetite in 0.75 … 1.25 and picks the `TRAITS` row that best matches (a stat must clear 1.0 by more than 0.08, or the trait is Ordinary).
- The line they must live to is about 80% of `Clock.LIFESPAN_DAYS` (or the species `days` field), capped by the days left in the run.
- Survival odds scale `survive_p` by health and speed up and appetite down.
- On spawn, the first creature of that species receives the roster name. `_apply_roster_identities` then divides out the random founder genome and writes the rolled one, so the creature on the felt is the one in the valley.

Setup screens clear `spawn_roster` before the table. The table keeps an existing roster, so a second visit does not roll new starters.

## Challenge scenarios

`ChallengeScenarios.LIST` is seven scripted years. `apply(gc, id)` resets the valley to a fixed roster, then writes `disabled_species`, `golden_mult`, and producer counts. `events_for` turns `at` (0 … 1 of the year) into a day. The director runs them from `_step_scenario`: `kill_group`, `drought`. `blocks_migration` stops a `group:<g>_migrants` entry from walking back in. `group:<g>` without that suffix is removed from the start and listed in `disabled_species`.

| Id | Bend | Featured bet |
|---|---|---|
| `thin_soil` | producers × 0.35 | an herbivore species dies out |
| `grazers_vanish` | herbivore migrants blocked; all herbivores die at 8% of the year | a carnivore species dies out |
| `no_hunters` | carnivores disabled | herbivores double |
| `empty_village` | humans disabled | producers end fullest |
| `dry_summer` | drought forced at 30% of the year; the director copies `drought_chance` 0 from the scenario setup so a second drought is not rolled | fish drop below 5 |
| `decomposer_strike` | decomposers disabled | producers end last |
| `golden_year` | `golden_mult` 10 | 25 golden finds |

`judge` returns 1 won, -1 lost, 0 still open. `group_top` and `group_last` wait until the run ends. The resolution recap is `ChallengeScenarios.recap` (boomed then crashed, grew, shrank, collapsed, held steady).

## Gold

`MarkovAgent.golden` is 0 … 1. Eating a golden plant sets it near 1 (`make_golden`). A kill or a carcass passes on about 0.7 or 0.8 of what the prey carried (`devour`, `CombatSystem`, `corpse.gd`). While golden, metabolism drops and health ticks up. It fades at `GOLD_FADE` (0.02 per life-second).

Sources:

- Grass: `GrassLayer.GOLDEN_SEED_CHANCE` is 0.0015, times `golden_mult`. `GOLDEN_CAP` (0.05) keeps golden cells under 1 in 20. Golden seed rarely breeds true (5% in `_pollinate`).
- Apples 2% (`Tree.GOLDEN_APPLE_CHANCE`), berries 3%.
- Green Thumb multiplies `golden_mult` by 1.5 on top of the scenario multiplier. The cap still holds.

`SimulationDirector.gold_links` counts each `source>eater` hop and chronicles the first one. `BetTracker` sets `gold_soil` when any link's eater is in the decomposer group. `golden_finds` counts plant finds, not every hop.

## Rampage and Greenhouse upgrades

Follow a creature with `golden > 0.05` and the follow card shows Rampage (`scripts/ui/follow_panel.gd`). `start_rampage` fails if the creature is already rampaging or the gold is spent.

- Steering is `rampage_steer` (WASD, arrows, or a held touch point). Speed is `RAMPAGE_SPEED` (7.5).
- Gold drains in real seconds: `RAMPAGE_DRAIN + RAMPAGE_RAMP * elapsed` (0.06 + 0.008 per second). It ends at gold ≤ 0.02 or at `RAMPAGE_MAX` (20 s). A full load lasts about 10 s.
- Every 0.3 s it devours one nearby non-kin creature inside 2.4 m. Devouring a golden prey does **not** refill the bar. Kills do not add gold.
- The creature ticks every frame while rampaging. The director's stagger skips it.
- `GameConfig.RAMPAGE_GOAL` is 8. Meeting it calls `unlock_next_upgrade()`, which sets the next false entry in `UPGRADE_ORDER` and saves meta.

Earn order: `rain_dance`, `foresight_i`, `long_days`, `green_thumb`, `side_eye`, `time_dilation`, `cloning_vat`.

| Id | Effect in code |
|---|---|
| `rain_dance` | `apply_upgrades()` adds one Rain charge at the start of a run |
| `foresight_i` | setup screen shows a predator / prey / neutral line |
| `long_days` | `day_share()` returns 2/3 |
| `green_thumb` | golden plant multiplier × 1.5 |
| `side_eye` | table limit + 10 (`BetBook.table_limit`) |
| `time_dilation` | `time_limit += 1` day |
| `cloning_vat` | one mid-run respawn if `player_bet`'s species hits 0 |

Powerups are separate and cost Eco Points, one charge each (`greenhouse_shop.gd`): Bloom, Stampede, Call Kin, Feast, Rot Rain, Rain, Drought, Flood, Eclipse. The five link powers are `trigger_bloom`, `trigger_stampede`, `trigger_predator_call`, `trigger_feast`, `trigger_rot_rain` in `simulation_director.gd`. Weather powers (rain, famine, drought, flood) multiply metabolism and breeding through `POWER_EFFECTS` for the species listed there; unlisted species stay at 1.

## Genetics

`Genetics` (`scripts/ecs/genetics.gd`). Three stats around 1.0: health, speed, appetite. Traits: Hardy, Sure-footed, Frugal (good); Sickly, Slow, Glutton (bad).

- Founders and migrants with no parent genome get `random_genome()` (each stat 0.9 … 1.1, 20% chance of one random trait). Spores are skipped.
- A baby crosses the parent with the nearest other-sex neighbour inside 10 m. No mate means the parent is used twice.
- Stats blend with `MUTATION` noise (σ 0.05) and clamp to 0.6 … 1.4.
- Trait pass rates are `[one parent, both]` = good `[0.35, 0.75]`, bad `[0.30, 0.55]`. Each birth also rolls `NEW_BAD` 0.08 and `NEW_GOOD` 0.04.
- `expressed` adds the trait deltas and clamps to 0.5 … 1.6. `apply` multiplies current health, every speed property in `SPEED_PROPS`, and `metabolism_rate`.

Starter genomes replace that random founder genome after the first `apply`. See `_apply_roster_identities`.

## Rules page (Field Guide)

`scripts/ui/field_guide.gd` is the Rules screen and the loading-screen map. It draws `NODES` in five rows (`WEB_ROWS`), arrows from `EDGES` (`graze`, `forage`, `hunt`, `decay`), and a card from `INFO` when a creature is clicked.

Zoom: `focus_species` tweens the web panel to `ZOOM_SCALE` (1.7) around `ZOOM_SPOT`. Empty species, Esc, or a click on open felt zooms back out. The rig is the same 2D creature shader as the valley, so the cards walk in place.

The guide is hand-written. Diets that the simulation actually uses are `CritterAgent._configure` (and the older species scripts). A card can name a kind the simulation does not roll.

## Kinds, and what is only paint

`Roles` (`scripts/ecs/roles.gd`) covers the pre-3.0 species. `roll` returns none when `KINDS` has no entry. Tough: health × 1.6 (capped at 100), metabolism × 0.75, damage × 1.3, lifespan × 1.35, cap 10 per species. Special: health × 1.2, lifespan × 1.15, cap 4. Humans use the old builder / wizard rates and only roll them for settlement-born offspring.

Deer, goat, bear, lion, and beetle "kinds" in the Field Guide (White Hart, Ghost Cat, Scarab, and the rest) are sprite styles in `sprite_generator.gd`. `SpeciesDB` `style` picks the painted sheet. They do not grant `Roles` abilities.

## Sprites between thinks

Agents think on a stagger (`STAGGER_FRAMES` 6, and slower when the registry is large). `AgentData` stores `prev_pos`, `shown`, and `interval`. `VisualProxyManager` glides the sprite across one think. A gap longer than the creature could have run in that think (a spawn, a hut door) is drawn as a jump, so the sprite does not slide across the map.

## Pitfalls

- **Champion is still `player_bet`.** Default is `"sheep"`. `_champion_species` uses the first starter only when `player_bet` is empty. Challenge setup clears it. Campaign sets the campaign faction. The table's start path updates `player_bet` only from a `faction:` stake, and `catalogue3` does not sell those. Sandbox Call Kin, Heal, and the Cloning Vat therefore follow Sheep unless something else changed the bet.
- **Foresight ignores the new species.** The setup line sums wolves, humans, and falcons as predators, and sheep, robins, worms, and rabbits as prey. Deer, goats, lions, bears, and beetles are absent from that string.
- **Two odds models.** `GROUP_STRENGTH` and the 2.3 `STRENGTH` / `FRAGILITY` tables are both placeholders. Do not retune one and expect the other screen to move. The live screen is `catalogue3`.
- **Hold is duplicated.** Changing `SpeciesDB` `hold` does not change Order scores until `HOLD_CAPACITY` matches.
- **Field Guide edges can drift** from `diet` / `prey` / `EDGES`. Update both when a creature's menu changes.
- **Rampage gold only goes down.** A golden meal during a rampage is discarded. Tuning `devour` without that keep will make the minigame unlosable.
- **`shots.gd` still calls `BetBook.catalogue`.** It is a dev shot, not the shipping table.

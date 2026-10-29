# Feleco Development History

## Phase 1 — Foundational Ecology (Pre-Session)
- Markov state machine base class (`markov_agent.gd`) with configurable transitions.
- Cellular automata layers: Grass, Rot, Mycelium.
- Primitive 3D meshes (capsules, boxes) for all agents.
- Spatial hash and presence grid for O(1) agent queries.
- Scent network graph for predator/prey signaling.
- Betting system: main bet + side bet on named entities.
- Campaign mode, Challenge mode, Sandbox mode, and The Greenhouse shop.
- Basic simulation HUD with population counters and tickertape events.

## Phase 2 — Visual Decoupling & Performance
- **MultiMesh billboard sprites** replaced primitive blobs.
  - `VisualProxyManager` handles one draw call per species.
  - `SpriteGenerator` procedurally draws 64x64 silhouettes at runtime.
  - Billboards always face camera; unshaded + alpha scissor for crisp edges.
- Staggered agent ticking (`STAGGER_FRAMES = 6`) to spread CPU load across frames.
- Flat `AgentData` ECS registry synced to visuals every frame.
- Node pools (`NodePool`) pre-warmed at startup to reduce `instantiate()` overhead.

## Phase 3 — New Species & Behaviors
- **Rabbit** added as a fast grazer.
  - Speed 4.5, flee 7.0, short lifespan (15 days).
  - Flee from falcons and humans.
  - Integrated into spawn pools, UI counts, campaign/challenge modes, and betting.
- **Falcon & Robin** replaced the stale monolithic `Bird` class.
  - Falcon: aerial hunter that dives on robins and rabbits.
  - Robin: small flyer that eats worms/seeds, circles trees, spreads vegetation.
- **Boar** added as a neutral/forager.
  - Charges threats in groups, flees when alone.
  - Forages mushrooms and apples.

## Phase 4 — Human Settlement Alliances
- Humans build shelters with unique `_settlement_id`.
- Settlement ID inherited by offspring born near shelters.
- Humans from different settlements fight each other instead of cooperating.
- `_adopt_settlement()` fixes prevented crashes from Vector3 being treated as a node.

## Phase 5 — Grass Lifecycle & Realism
- Grass now has a 4-stage lifecycle: **seed → sprout → tall → dead**.
  - Seeds (inedible, yellowish) mature to sprouts after 6 days.
  - Sprouts (bright green, short) mature to tall after 6 days.
  - Tall grass (tallest, green-to-brown gradient) senesces to dead after 45 days or high density.
  - Dead grass (brown stubble) rots away to bare soil after 12 days.
- **Seasonal effects:** Winter rapidly kills tall grass (`winter_kill_step`).
- **Spring surge:** seeds/sprouts near tall neighbors get 2.5x growth boost.
- **Patchy diffusion:** sparse grass stays put; dense clumps spread.
- **Soil exhaustion:** overgrazing depletes nutrients; recovery only when total grass < 400.
- Nutrient cycling: grass consumes nutrients to grow; rot and mycelium replenish them.

## Phase 6 — Corpse Decomposition Ecosystem
- Corpse decay time reduced from **45s to 8s** to prevent pile-up.
- Hard cap of **25 corpses**; oldest removed when exceeded.
- Shared static mesh/material to eliminate per-corpse draw-call bloat.
- Corpses now decompose into:
  - **Rot** layer base deposit.
  - **Mushroom spore** (25% chance).
  - **Fertile grass** (60% chance): boosts density + nutrients, resets to sprout stage.
  - **Tree seed** (8% chance): can spawn a new tree from a buried carcass.

## Phase 7 — UI & UX Polish
- **Setup board** wrapped in `ScrollContainer` so the Input panel no longer shunts content off-screen.
- **Bet dropdown** cleaned: worms/mushrooms removed as bettable factions.
- **Simulation HUD** updated:
  - Bet label reads from `GameConfig` on `_ready()` instead of defaulting to "Sheep".
  - Side bet label added under `TopRight` panel.
  - 3D gold ring marker pulses above the side-bet agent and tracks them.
  - Rabbit count label added.
- **Rules text** in main menu rewritten from a dense 80-line wall into a concise, categorized guide (Goal, Seasons, World, Prey, Predators, Humans, Neutrals, Tips).
- **Resolution screen** final counts now include rabbits.

## Phase 8 — Stability & Bug Fixes
- **Infinite freeze in `spawn_corpse()`:** `while queue_free()` loop deferred removal forever. Replaced with bounded `for` loop + explicit `remove_child()`.
- **`!is_inside_tree()` crash:** Added guards in `get_nearby_agents()` and `get_nearby_agents_fast()` before accessing `global_position`.
- **Null instance in `_tick_agents()`:** Added `is_inside_tree()` checks before ticking agents and spores.
- **Callable bound to freed instance:** Hardened `markov_agent._physics_process` to validate the Callable object before calling.
- **Human `queue_free()` on robins/rabbits:** Replaced instant deletion with proper `CombatSystem.resolve_attack()` so corpses, particles, and events fire correctly.
- **`mushroom` group redundancy:** Spores used both `"mushroom"` and `"spore"` groups. Consolidated to `"spore"` everywhere to reduce dual-group confusion.
- **Stale `bird.gd` / `bird.tscn` deleted:** Falcon and Robin made the old Bird class obsolete.
- **`total_agents` calculation** in `_generate_spawn_positions()` was missing `cfg_rabbits` in Random Scatter; fixed.
- **Corner Clusters preset** was missing rabbit spawn positions; fixed.

## Phase 9 — Sex, Variants & Settlement-Centric Civilization
- **Sex/Gender system added to all reproducing species.**
  - `MarkovAgent` rolls `"male"` or `"female"` in `_ready()` (skipped for asexual mushroom spores).
  - All `_try_reproduce()` methods now require `partner.sex != self.sex`.
  - Prevents same-sex reproduction; desperation thresholds still apply when population is low.
- **Settlement-centric spawning for humans.**
  - Offspring now spawn near the parent's `_settlement_center` with a small random offset instead of appearing at the parent's feet.
  - If the parent is unsettled, fallback to legacy parent-position spawn.
- **Human variant system: Wizard & Builder.**
  - **Wizard** (5% chance for settlement-born, 0% otherwise):
	- Lower damage (8), higher lifespan (80), health capped at 80.
	- `Channel` state casts random nature magic every 4s: grow trees (30%), surge grass (25%), force apple bloom (20%), spawn mushroom spore (15%), or bless nearby humans with +50% damage for 20s (10%).
	- Unique sprite: pointed hat, staff glow, purple robe.
  - **Builder** (15% in-shelter, 5% outside):
	- Normal damage (10), lifespan 65.
	- `Build` state prioritizes planting trees, building shelters, and harvesting wood.
	- Unique sprite: hard hat, hammer silhouette, overalls.
  - Architecture is forward-looking: `_apply_variant(v)` + `HumanVariantConfig`-style inline stat blocks make adding Fairies etc. straightforward.
- **VisualProxyManager updated for variant rendering.**
  - Groups instances by `data.variant` first, then `data.species`, so wizards/builders get unique `MultiMeshInstance3D` proxies while still being counted as humans for population.
  - `SPECIES_CONFIG` expanded with `"wizard"` and `"builder"` entries.
  - `SpriteGenerator._draw_wizard()` and `_draw_builder()` produce distinct procedural silhouettes.
- **Tickertape completely rewritten with high-fantasy narrative.**
  - BIRTH_POOLS, DEATH_POOLS, KILL_POOLS, WOUND_POOLS, SETTLEMENT_POOL, EXTINCTION_POOL, OVERPOPULATION_POOL per species.
  - Messages are randomized, flavorful, and personalized with `NameGenerator` names.
  - Variant-aware birth messages for wizards and builders.
- **NameGenerator expanded** with `_wizard_names` (Merlin, Gandalf, etc.) and `_builder_names` (Bob, Hammerman, etc.).
- **Simulation HUD improvements:**
  - `WizardCount` and `BuilderCount` labels added to `TopLeft/VBox`.
  - `_on_pop_changed()` updates wizard/builder counts from `population_changed` signals.
  - Pause-mode hover tooltip shows species, name, state, health/energy/age, and variant-aware rules text.
- **Camera input during pause** — `camera_controller.gd` set to `PROCESS_MODE_ALWAYS` so WASD and right-click orbit work while paused.
- **Resolution screen** final counts now include wizards and builders.

## Phase 10 — Probabilistic Lifecycle & Population Boom
- **Exponential death curve replaces hard lifespan cutoff.**
  - `MarkovAgent._age_and_die()` now uses `P(death) = 1 - exp(-t / tau)` where `tau = 25%` of effective lifespan.
  - Grace period until 75% of lifespan; death probability rises smoothly after that.
  - Hard failsafe at 2.5x effective lifespan.
- **Eating extends lifespan.**
  - Every energy gain adds `+3%` of that gain as `_lifespan_bonus`, capped at 50% of base lifespan.
  - Health and energy modulate death clock speed: low stats accelerate death; high stats pause/reverse it.
- **All species lifespans increased significantly** (base `MarkovAgent` from 40→80):
  - Sheep 45→80, Wolf 40→75, Human 60→120, Falcon 50→90, Robin 40→70, Boar 50→85, Rabbit 15→35, Worm 20→45.
  - Wizard 80→140, Builder 65→110.
- **Removed hard age/die blocks from species scripts.**
  - Robin, Boar, Falcon, Rabbit, Worm previously had their own `_age >= _lifespan` hard cutoffs in `_physics_process` that overrode the probabilistic system.
- **Age variance at spawn.**
  - `_apply_phenotype_variance()` now assigns random ages (`randf() * lifespan * 0.5`) to founders and migration spawns, preventing synchronized mass die-offs.
- **Local overpopulation thresholds raised 3-4x.**
  - Sheep: >3 → >12, Wolf: no local penalty, Human: >6 → >15, Falcon: >3 → >8, Robin: >4 → >10, Boar: >4 → >10, Rabbit: >8 → >12, Worm: >5 → >10.
  - Global overpopulation penalties also kicked in much later (e.g., sheep >50 → >150).
- **Reproduction costs and cooldowns reduced ~30%.**
  - All 8 species: threshold and cost lowered, cooldowns shortened.
  - Rabbits and worms now have desperation mechanics (previously missing).
  - Partner search radii increased by ~50%.
- **Headless starting populations raised** for better default balance.
- **Pause-mode tooltip fixes.**
  - Hover radius increased from 4.0 to 12.0 units; now uses 2D ground-plane distance (ignores Y).
  - Added fallback camera search, explicit tooltip Panel/RichTextLabel sizes, and `_input` mouse-motion handler for more responsive updates.

## Known Architectural Notes
- `FELECO_ANALYSIS.md` contains a deep-dive performance audit from an earlier review.
- `_update_presence_grid()` is called every frame inside `tick()` (the analysis worried it was missing, but it is present).
- Grass still does 9 full-grid passes per tick; fusion into fewer loops is the next logical optimization.
- Mycelium layer remains invisible (no visual overlay yet).
- Scent network is functional but trails are not rendered.

---
*Last updated: 2026-06-25*

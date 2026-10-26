# Feleco — Ecology Simulation RPG
## Design Document v1.0

> **Current code is Feleco 3.0.** This file is the original four-agent design (low-poly meshes, biomass betting, Gillespie clocks). Architecture, betting, gold, Rampage, genetics, scenarios, and the rules page are in [ORDER_UPDATE.md](ORDER_UPDATE.md). The 2.3 roulette spec is [design/betting_table.md](design/betting_table.md).

### 1. Design Philosophy (Will Wright’s Dynamics)

Wright’s framework defines three topologies implemented explicitly:

- **Agents:** Autonomous entities (Sheep, Wolf, Human, Mushroom spore) with internal state, memory, and goals.
- **Networks:** Dynamic graphs. Scent trails (pheromone decay), pack/herd memberships, vision cones, mycelial underground connections.
- **Layers:** 2D cellular automata (CA) grids: Tall Grass density, Soil Nutrients, Rot/Decay, and Moisture. Layers grow, propagate, and are read by Agents.

The game is a possibility-space generator. The player configures initial population counts and layout, then starts the simulation and bets on the dominant faction.

### 2. Entity Taxonomy & Meshes

All visuals are low-poly, flat-shaded.

| Entity | Type | Mesh Notes |
|--------|------|------------|
| **Tall Grass** | Layer (CA) + visual billboards | Low-poly blade clusters; height maps to CA density. |
| **Sheep** | Agent (Herbivore / Prey) | Low-poly cube body; stub legs; grazing animation state. |
| **Wolf** | Agent (Carnivore / Predator) | Low-poly canine; pack color tint; stalking gait. |
| **Human** | Agent (Apex / Social) | Low-poly ranger aesthetic; weapon toggle mesh on hunt. |
| **Mushroom** | Agent (Spore) + Layer (Mycelium) | Translucent low-poly cap; underground hyphae drawn faint. |

### 3. Cellular Automata Layers

- **Grass Layer:** Each cell has float `density [0,1]`. Logistic propagation. Sheep eating reduces density.
- **Rot Layer:** Agent dies → deposits `corpse_value` into Rot grid. Decays over time.
- **Mycelium Layer:** Spread rule: high Rot + adjacent Mycelium → expansion. Spawns fruiting bodies when local Mycelium > threshold.
- **Moisture Layer:** Simple diffusion; influences Grass regrowth speed.

### 4. Markov Chain State Machines (MSM)

Each Agent runs a Markov State Machine. States are discrete; transitions are probabilistic and depend on local stimuli.

**Wolf MSM States:** `{ Wander, Stalk, Chase, Eat, Sleep, Flee }`
- Transition matrix `P_wolf`; rows sum to 1.0.
- Modulated by Network inputs: `hunger_drive`, `human_threat` (≥3 humans spikes Flee), `sheep_nearby` (spikes Chase).
- Priority fallback: If `Chase` fails for N seconds, forced `Wander`.

**Sheep MSM States:** `{ Graze, Walk, Flee, Reproduce, Idle }`
- `Graze` probability increases on high Grass density.
- `Flee` triggered by scent/vision detection of Wolf.
- `Reproduce` only from `Graze` if energy > threshold and mate nearby.

**Human MSM States:** `{ Gather, Hunt, Travel, Defend, Flee, Rest }`
- `Hunt`: party size ≥ 3 AND wolf detected.
- `Defend`: wolf pack ≥ 2 and no allies nearby.
- Lone humans avoid wolves (`Flee` override).

**Mushroom Spore Agent States:** `{ Drift, Anchor, Fruit, Die }`
- `Drift` on wind vector field.
- `Anchor` on high Rot.
- `Fruit` when local mycelium dominates.

Transitions use **Gillespie-style stochastic timing**: draw next transition time from exponential distribution with rate λ = sum(transition_rates), then pick next state via roulette-wheel selection.

### 5. Interaction Logic & Priority Rules

| Attacker | Prey/Target | Condition | Outcome |
|----------|-------------|-----------|---------|
| **Wolf** | Sheep | Always prioritizes. Wolves always target sheep over humans if sheep scent exists. | Kill → Corpse |
| **Wolf** | Human | If human is **alone** AND no sheep nearby. Pack size ≥ 2 raises success chance. | Injury/Kill → Corpse |
| **Human** | Wolf | If human **party size ≥ 3** AND in `Hunt` state. | Kill → Corpse |
| **Human** | Wolf | If human party < 3, forced transition to `Flee`. | Escape attempt |
| **Sheep** | Grass | Eats from Grass layer. | Energy++ |
| **Mushroom** | Corpse | Mycelium absorbs Rot. Outcompetes Grass in high-Rot cells. | Spore production |

Corpse Lifecycle: Die → Corpse spawned → Rot layer accumulates → Mushroom Mycelium spreads → Fruiting bodies rise.

### 6. Networks (Propagation)

- **Scent Network:** Agents emit decaying scent nodes. Sheep emit "fear". Wolves emit "predator". Agents sample local graph nodes.
- **Vision Network:** Cone raycasts, updated every N frames. Feed into MSM transition modifiers.
- **Pack Network:** Wolves within radius R auto-link. Share target info and coordinate chase.
- **Mycelial Network:** Underground graph connecting mushroom nodes; allows nutrient allocation.

### 7. Game Loop & Betting System

1. **Setup Phase:** Player places initial counts on a 3D terrain board. Top-down/isometric camera.
2. **Bet Phase:** Player selects Dominant Faction Prediction (Wolves, Sheep, Humans, Mushrooms, Grass).
3. **Simulate Phase:** Time advances. Agents run MSMs, layers update CA ticks, networks diffuse. Speed controls (1x, 2x, 5x).
4. **Resolution Phase:** Winner declared by biomass/population dominance after time limit or stabilization.

### 8. Technical Architecture (Godot 4)

- **Language:** GDScript (strict typing).
- **Scene Tree:**
  - `World` (Node3D)
	- `Terrain` (MeshInstance3D + CA Grids as custom resources)
	- `LayerManagers` (Node holding CA simulators)
	- `NetworkManager` (Node holding scent/mycelium graphs)
	- `Agents` (Node3D grouping all agents)
	- `CorpseManager`
- **Key Scripts:**
  - `ca_layer.gd` — Base class for cellular automata grids.
  - `markov_agent.gd` — Base class for all agents with MSM logic.
  - `entity_sheep.gd`, `entity_wolf.gd`, `entity_human.gd`, `entity_mushroom.gd`
  - `network_graph.gd` — Sparse adjacency list.
  - `simulation_director.gd` — Orchestrates setup, betting, tick loop.
- **Meshes:** Built from `ArrayMesh` primitives in Godot (procedural low-poly).

### 9. Immediate Build Milestones

1. Initialize Godot 4 project in `Feleco/`.
2. Build `MarkovAgent` base class with configurable state matrices and Gillespie clock.
3. Build `CALayer` base with diffusion and growth rules.
4. Create procedural low-poly meshes for Sheep/Wolf/Human/Mushroom/Grass.
5. Implement Wolf vs Sheep chase with scent network.
6. Implement corpse → rot → mushroom dominance chain.
7. Build betting UI and setup board.

# What Is Feleco?

**Feleco** is a living ecosystem simulator that doubles as a betting game. You watch ten species — sheep, wolves, humans, rabbits, falcons, robins, boars, worms, mushrooms, and trees — interact on a single patch of land, and you place a wager on which one will be the most populous when time runs out. Species hunt, graze, flee, reproduce, build settlements, and die, all driven by code rather than pre-written scripts. The result is an emergent, unpredictable story every run.

## The Simulation Layer

At its heart, Feleco is a **multi-agent system**. Each creature is an independent "agent" that senses its surroundings and makes its own decisions. Sheep graze grass and flee from wolves. Wolves hunt in packs. Falcons patrol the sky and dive on robins. Humans chop trees, build shelters, and fight inter-settlement wars. Boars charge threats when grouped, but flee alone. All of this behavior is not hand-animated; it emerges from simple rules running inside each agent every frame.

The world itself is alive. Grass grows through a **four-stage lifecycle** — seed, sprout, tall, and dead — spreading via diffusion, responding to seasons, nutrients, and overgrazing. A hidden **rot** layer and **mycelium** layer drive decomposition and nutrient cycling. Corpses decay into rot, mushroom spores, fertile grass, and occasionally tree seeds. Everything feeds back into everything else.

## The Game Layer

Feleco wraps this simulation in three game modes:

- **Sandbox**: Set any starting populations, choose your bet species, and watch.
- **Campaign**: Pick a faction and advance through ten "eras." Each victory unlocks permanent health, speed, and lifespan boosts for your chosen species that carry into future runs.
- **Challenge**: Procedurally generated levels with skewed starting populations. You must read the board and guess which species has the hidden advantage.

You can also place a **side bet** on a specific named individual to survive or die, and spend **Eco Points** in *The Greenhouse* shop for permanent upgrades like a cloning vat that revives your bet species once if it goes extinct mid-run. Five consumable powerups — Rain, Predator Call, Heal, Famine, and Meteor — let you nudge the simulation in real time.

---

## How It Works Under the Hood

Feleco is built in **Godot 4** using **GDScript**. Here is how the major systems fit together.

### Markov State Machines: The "Brain" of Every Creature

Every agent inherits from a base class called `MarkovAgent`. Rather than using hard-coded `if-then` chains, each species defines a set of **states** — for example, a sheep has `Graze`, `Flee`, and `Reproduce` states, while a human has `Gather`, `Hunt`, `Travel`, `Channel` (wizard magic), and `Build` (builder construction).

Each frame, the agent runs `_get_transition_modifiers()`, which returns a probability score for each possible next state based on what it currently sees — nearby threats, food, mates, or settlement proximity. The agent then probabilistically picks its next state. This is a **Markov chain**: the future state depends only on the present state and the current sensory input, not on the distant past. The result is behavior that feels organic and reactive rather than robotic.

### The Flat Data Registry: Rendering Thousands of Agents Cheaply

Because Feleco can run with hundreds of agents at once, it avoids the usual Godot pattern of making every agent a full node with its own mesh and draw call. Instead, it uses a hybrid **Entity-Component-System** approach:

- The `SimulationDirector` maintains a flat `Array[AgentData]` — a lightweight data record for every living thing containing only position, velocity, health, energy, species, variant, and state.
- The actual 3D nodes (collision shapes, scripts) exist only in the physics world.
- A `VisualProxyManager` reads the flat registry once per frame and updates **MultiMeshInstance3D** objects — one per species (plus variants like wizards and builders). Each MultiMesh renders every member of that species in a single GPU draw call.
- Sprites are generated procedurally at runtime (64x64 silhouettes) and rendered as camera-facing billboards with alpha scissoring. This means Feleco can show 300+ distinct-looking creatures with roughly the same GPU cost as showing ten.

### Cellular Automata: The Ground Beneath Their Feet

The terrain is not a texture; it is a computational grid. `GrassLayer` runs nine full-grid passes per tick:

1. **Growth** — logistic-growth formula with nutrient, season, and spring-surge modifiers.
2. **Diffusion** — dense clumps spread to neighbors; sparse patches stay put.
3. **Lifecycle** — seeds mature to sprouts after 6 days, sprouts to tall grass after 6 more.
4. **Senescence** — tall grass dies after 45 days or under crowding, becoming rot.
5. **Winter kill** — cold seasons rapidly destroy mature grass.
6. **Mycelium suppression** — mushroom networks poison grass.
7. **Nutrient cycling** — rot and mycelium replenish soil, which fuels new growth.
8. **Pollination** — occasional long-range seed scatter.
9. **Visual sync** — only dirty cells update their MultiMesh transforms.

This creates realistic boom-and-bust grass dynamics that directly determine whether grazers thrive or starve.

### Probabilistic Life and Death

Agents do not die the moment they hit a fixed age. Instead, Feleco uses an **exponential death curve** (an Euler curve): after a juvenile grace period lasting 75% of their lifespan, a "death clock" starts. The probability of dying each tick follows `P(death) = 1 - exp(-t / tau)`, where `tau` is 25% of the agent's effective lifespan. Eating extends lifespan by converting energy gains into a `_lifespan_bonus` capped at 50% of base lifespan. Meanwhile, low health and starvation accelerate the clock, while excellent health can pause it. This eliminates the synchronized mass die-offs that plagued earlier versions and gives every creature a unique lifespan.

### Sex, Variants, and Settlements

All reproducing agents have a binary **sex** (`male`/`female`). Reproduction requires an opposite-sex partner within range, both above an energy threshold, and off cooldown. When populations crash below 15, a **desperation mechanic** halves the energy requirement and removes cooldowns.

Humans are special. They found **settlements** (shelters with unique IDs), and offspring born inside a settlement spawn near its center rather than at the parent's feet. Settlement-born humans have a 5% chance of becoming a **Wizard** (channels nature magic — grows trees, surges grass, blesses allies) or a 15% chance of becoming a **Builder** (plants trees, builds shelters, harvests wood). Both variants get unique sprites and behaviors while still counting as humans for population scoring.

### Summary

Feleco is a **high-performance, emergent ecosystem** disguised as a betting game. Its architecture — Markov state machines for behavior, a flat ECS registry for scale, MultiMesh billboards for rendering, and cellular automata for the environment — lets hundreds of independent agents interact in real time. Every run writes a different story, and the code is built to make that story surprising.


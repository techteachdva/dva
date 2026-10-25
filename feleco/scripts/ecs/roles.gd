class_name Roles
extends RefCounted

# Every species has three kinds: the common type, a tough type that is
# hardier and does something that keeps its kin alive, and a rare special
# type with a gift. Roles are rolled for founders and inherited (sometimes)
# by offspring. Abilities run from MarkovAgent's tick every few seconds.

const NONE: String = ""
const TOUGH: String = "tough"
const SPECIAL: String = "special"

# variant id, display name, one-line lore. Humans keep their old ids so the
# rest of the game (counts, tickertape) still recognises builders and wizards.
const KINDS: Dictionary = {
	"sheep": {
		"tough": ["highlander", "Highlander", "Shaggy and horned. Headbutts wolves and boars away from the flock."],
		"special": ["goldfleece", "Golden Fleece", "Sows grass wherever it grazes and keeps the flock fed and calm."],
	},
	"wolf": {
		"tough": ["alpha", "Alpha", "Scarred and heavy. Shares its kills and mends the pack."],
		"special": ["moonhowler", "Moon Howler", "Its howl rallies the pack and scatters herds into the open."],
	},
	"boar": {
		"tough": ["tusker", "Tusker", "Iron hide, huge tusks. Gores any hunter that comes near the sounder."],
		"special": ["truffler", "Truffler", "Roots truffles out of rot and feeds the whole sounder."],
	},
	"falcon": {
		"tough": ["gyrfalcon", "Gyrfalcon", "Big and pale. Feeds the hungriest falcon in the aerie."],
		"special": ["skyseer", "Sky Seer", "Spots fish from far off and shares the catch."],
	},
	"robin": {
		"tough": ["thrush", "Mistle Thrush", "Mobs falcons until they flee the flock."],
		"special": ["bluebird", "Bluebird", "Its song feeds the flock and scatters seeds for new grass and trees."],
	},
	"worm": {
		"tough": ["nightcrawler", "Nightcrawler", "Tills the soil so grass grows richer above the colony."],
		"special": ["glowworm", "Glowworm", "Turns rot into food and lights the tunnels for new worms."],
	},
	"rabbit": {
		"tough": ["hare", "Hare", "Long-legged lookout. Thumps the alarm so the warren bolts early."],
		"special": ["moonrabbit", "Moon Rabbit", "Digs warrens where rabbits heal and breed."],
	},
	"fish": {
		"tough": ["sturgeon", "Sturgeon", "Armoured bottom-feeder. Cleans rot from the riverbed."],
		"special": ["koi", "Golden Koi", "Blesses the shoal; fish near it spawn more often."],
	},
	"human": {
		"tough": ["builder", "Builder", "Hardy. Fells trees and raises shelters for the settlement."],
		"special": ["wizard", "Wizard", "Conjures rain, cleanses rot, and feeds magic mushrooms to the village."],
	},
}

static func role_of_variant(species: String, v: String) -> String:
	var kinds: Dictionary = KINDS.get(species, {})
	for role: String in kinds.keys():
		if kinds[role][0] == v:
			return role
	return NONE

static func display_name(species: String, role: String) -> String:
	if role.is_empty() or not KINDS.has(species):
		return species.capitalize()
	return KINDS[species][role][1]

static func lore(species: String, role: String) -> String:
	if role.is_empty() or not KINDS.has(species):
		return ""
	return KINDS[species][role][2]

# Each species plays the year like a civilization with its own road to the valley.
const STRATEGIES: Dictionary = {
	"sheep": ["The Flock", "Safety in numbers. Big herds blunt wolf attacks; spring lambing floods the meadow. Famine is their ruin."],
	"rabbit": ["The Warren", "Outbreed every loss. Summer swarms and refuges keep them alive; floods drown their burrows."],
	"wolf": ["The Pack", "Patience and winter. Packs thrive when grazers weaken, so famine and snow are their seasons."],
	"boar": ["The Sounder", "Endure, then gorge. Autumn mast fattens them and a charging sounder fears nothing."],
	"falcon": ["The Eyrie", "Rule from the sky in summer. Dive on rabbits and stranded fish; rain blinds the hunt."],
	"robin": ["The Chorus", "Nest early and sing loud. Spring and rain bring worms to the surface; winter is lethal."],
	"worm": ["The Undergrowth", "Inherit the dead. Rain, rot and mycelium feed them; floods drown the soil."],
	"fish": ["The Shoal", "Ride the water. Floods spawn booms, but the receding river leaves the careless on dry land."],
	"human": ["The Tribes", "Build, farm and war. Huts hold the valley, wizards bless the harvest, and schisms turn kin into rivals."],
}

static func strategy(species: String) -> Array:
	return STRATEGIES.get(species, ["", ""])

static func role_index(role: String) -> int:
	return 1 if role == TOUGH else 2 if role == SPECIAL else 0

# Pick a role. Offspring lean toward their parent's kind; specials are capped
# so a lucky run can't flood the valley with them.
static func roll(sim: SimulationDirector, species: String, parent: Node, sheltered: bool = false) -> String:
	if not KINDS.has(species):
		return NONE
	var tough_p: float = 0.16
	var special_p: float = 0.07
	if parent != null:
		tough_p = 0.12
		special_p = 0.05
		var pr: Variant = parent.get("role")
		if pr == TOUGH:
			tough_p = 0.4
		elif pr == SPECIAL:
			special_p = 0.25
	if species == "human" and parent != null:
		tough_p = 0.15 if sheltered else 0.05
		special_p = 0.06 if sheltered else 0.02
	var r := randf()
	if r < special_p and _count(sim, species, SPECIAL) < 4:
		return SPECIAL
	if r < special_p + tough_p and _count(sim, species, TOUGH) < 10:
		return TOUGH
	return NONE

static func _count(sim: SimulationDirector, species: String, role: String) -> int:
	if sim == null:
		return 0
	var n: int = 0
	for data: AgentData in sim._agent_registry:
		if data.species == species and data.role == role:
			n += 1
	return n

# Make the creature its kind: tags, stats, art. Tough types live longer,
# burn less, hit harder and shrug off some killing blows (CombatSystem).
static func apply(agent, species: String, role: String) -> void:
	if role.is_empty() or not KINDS.has(species):
		return
	agent.role = role
	agent.variant = KINDS[species][role][0]
	if agent.has_method("_apply_variant"):
		agent._apply_variant(agent.variant)
	var h: Variant = agent.get("health")
	if role == TOUGH:
		if h != null:
			agent.health = minf(float(h) * 1.6, 100.0)
		if agent.get("metabolism_rate") != null:
			agent.metabolism_rate *= 0.75
		if agent.get("damage") != null:
			agent.damage *= 1.3
		agent._lifespan *= 1.35
	else:
		if h != null:
			agent.health = minf(float(h) * 1.2, 100.0)
		agent._lifespan *= 1.15
	var data: AgentData = agent._data
	if data != null:
		data.variant = agent.variant
		data.role = role
		data.lifespan = agent._lifespan

# ------------------------------------------------------------------
# Abilities
# ------------------------------------------------------------------
const PERIOD: Dictionary = {
	"sheep": [1.5, 3.0], "wolf": [2.0, 8.0], "boar": [1.5, 3.0], "falcon": [3.0, 5.0],
	"robin": [2.0, 4.0], "worm": [3.0, 4.0], "rabbit": [1.0, 5.0], "fish": [3.0, 5.0],
}

static func tick(agent: MarkovAgent, species: String, delta: float) -> void:
	if species == "human" or not PERIOD.has(species):
		return
	agent._role_timer -= delta
	if agent._role_timer > 0.0:
		return
	var periods: Array = PERIOD[species]
	agent._role_timer = periods[0] if agent.role == TOUGH else periods[1]
	var sim: SimulationDirector = agent.director
	if sim == null:
		return
	var p: Vector3 = agent.global_position
	var ag = agent
	match species + ":" + agent.role:
		"sheep:tough":
			var foe := _nearest(sim, p, 7.0, ["wolf", "boar"])
			if foe != null:
				_hurt(foe, 12.0)
				_scare(foe, p)
				_say(p, "Headbutt!", Color(0.95, 0.9, 0.75))
		"sheep:special":
			for i: int in 3:
				var at := p + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))
				sim.grass.add_density_at_world(at, 0.2)
			_feed(sim, p, 6.0, "sheep", 6.0, 4.0, agent)
			FXManager.spawn_heal_particles(p)
		"wolf:tough":
			_feed(sim, p, 8.0, "wolf", 0.0, 5.0, agent)
			if ag.energy > 60.0:
				var hungry = _hungriest(sim, p, 10.0, "wolf", agent)
				if hungry != null:
					ag.energy -= 8.0
					hungry.energy = minf(hungry.energy + 8.0, 100.0)
					_say(p, "Shares the kill", Color(0.86, 0.6, 0.5))
		"wolf:special":
			_feed(sim, p, 14.0, "wolf", 10.0, 0.0, agent)
			for prey: String in ["sheep", "rabbit"]:
				for n in _near(sim, p, 12.0, prey):
					if n is MarkovAgent and (n as MarkovAgent)._states.has("Flee"):
						(n as MarkovAgent).set_state("Flee")
			_say(p, "Awooo!", Color(0.65, 0.8, 1.0))
		"boar:tough":
			var foe := _nearest(sim, p, 6.0, ["wolf", "human"])
			if foe != null:
				_hurt(foe, 18.0)
				_scare(foe, p)
				_say(p, "Gored!", Color(0.9, 0.5, 0.35))
			_feed(sim, p, 6.0, "boar", 0.0, 3.0, agent)
		"boar:special":
			if sim.rot != null and sim.rot.get_density_at_world(p) > 0.05:
				_scale_layer(sim.rot, p, 4.0, 0.6)
				_feed(sim, p, 8.0, "boar", 8.0, 0.0, null)
				if randf() < 0.3:
					sim.spawn_mushroom_spore(agent, p + Vector3(randf_range(-2, 2), 0, randf_range(-2, 2)))
				_say(p, "Truffle!", Color(0.9, 0.75, 0.4))
		"falcon:tough":
			if ag.energy > 55.0:
				var hungry = _hungriest(sim, p, 18.0, "falcon", agent)
				if hungry != null:
					ag.energy -= 10.0
					hungry.energy = minf(hungry.energy + 10.0, 100.0)
					_say(hungry.global_position, "Fed", Color(0.85, 0.88, 0.95))
		"falcon:special":
			if sim.try_eat_fish(p, 6.0):
				ag.energy = minf(ag.energy + 10.0, 100.0)
				var shared: int = 0
				for n in _near(sim, p, 18.0, "falcon"):
					if n != agent and shared < 2 and n.get("energy") != null:
						n.energy = minf(n.energy + 10.0, 100.0)
						shared += 1
				_say(p, "Keen eye!", Color(0.95, 0.82, 0.35))
		"robin:tough":
			var foe := _nearest(sim, p, 8.0, ["falcon"])
			if foe != null:
				_hurt(foe, 6.0)
				_scare(foe, p)
				_feed(sim, p, 8.0, "robin", 0.0, 4.0, agent)
				_say(p, "Mobbed!", Color(0.85, 0.7, 0.55))
		"robin:special":
			for n in _near(sim, p, 10.0, "robin"):
				if n.get("energy") != null:
					n.energy = minf(n.energy + 6.0, 100.0)
				if n.get("_repro_cooldown") != null:
					n._repro_cooldown -= 3.0
			sim.grass.add_density_at_world(p + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3)), 0.15)
			if randf() < 0.2:
				sim.try_plant_tree_seed(p, "robin")
			_say(p, "~ song ~", Color(0.6, 0.78, 1.0))
		"worm:tough":
			_till(sim, p, 0.15)
			_feed(sim, p, 4.0, "worm", 0.0, 3.0, agent)
		"worm:special":
			if sim.rot != null:
				_scale_layer(sim.rot, p, 4.0, 0.5)
			_till(sim, p, 0.1)
			_feed(sim, p, 6.0, "worm", 6.0, 0.0, agent)
			if randf() < 0.1 and sim._active_worms.size() < 20:
				sim.spawn_worm_offspring(agent, p)
		"rabbit:tough":
			var foe := _nearest(sim, p, 10.0, ["falcon", "human", "wolf"])
			if foe != null:
				for n in _near(sim, p, 10.0, "rabbit"):
					if n is MarkovAgent:
						var r := n as MarkovAgent
						r._flee_boost_timer = 2.0
						r._flee_boost_mult = 1.5
						if r._states.has("Flee"):
							r.set_state("Flee")
				_say(p, "Thump!", Color(0.9, 0.8, 0.6))
		"rabbit:special":
			_feed(sim, p, 6.0, "rabbit", 5.0, 8.0, null)
			for n in _near(sim, p, 6.0, "rabbit"):
				if n.get("_repro_cooldown") != null:
					n._repro_cooldown -= 2.0
			_say(p, "Warren dug", Color(0.92, 0.92, 1.0))
		"fish:tough":
			if sim.rot != null and sim.rot.get_density_at_world(p) > 0.02:
				_scale_layer(sim.rot, p, 3.0, 0.5)
				ag.energy = minf(ag.energy + 6.0, 100.0)
			_feed(sim, p, 6.0, "fish", 0.0, 3.0, agent)
		"fish:special":
			_feed(sim, p, 8.0, "fish", 8.0, 0.0, null)
			for n in _near(sim, p, 8.0, "fish"):
				if n.get("_repro_cooldown") != null:
					n._repro_cooldown -= 3.0
			if randf() < 0.15 and sim._active_fish.size() < 30:
				sim.spawn_fish_offspring(agent, p)
			_say(p, "Koi blessing", Color(1.0, 0.7, 0.35))

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
static func _near(sim: SimulationDirector, p: Vector3, radius: float, group: String) -> Array:
	var out: Array = []
	out.assign(sim.get_nearby_agents(p, radius, group))
	return out

static func _nearest(sim: SimulationDirector, p: Vector3, radius: float, groups: Array) -> Node3D:
	var best: Node3D = null
	var best_d: float = radius * radius
	for g: String in groups:
		for n in _near(sim, p, radius, g):
			var d: float = n.global_position.distance_squared_to(p)
			if d < best_d:
				best_d = d
				best = n
	return best

static func _hungriest(sim: SimulationDirector, p: Vector3, radius: float, group: String, skip: Node) -> Node3D:
	var best: Node3D = null
	var low: float = 45.0
	for n in _near(sim, p, radius, group):
		if n == skip or n.get("energy") == null:
			continue
		if n.energy < low:
			low = n.energy
			best = n
	return best

static func _feed(sim: SimulationDirector, p: Vector3, radius: float, group: String, energy: float, health: float, skip: Node) -> void:
	for n in _near(sim, p, radius, group):
		if n == skip:
			continue
		if energy > 0.0 and n.get("energy") != null:
			n.energy = minf(n.energy + energy, 100.0)
		if health > 0.0 and n.get("health") != null:
			n.health = minf(n.health + health, 100.0)

static func _hurt(target, amount: float) -> void:
	if target.get("health") != null:
		target.health = maxf(target.health - amount, 0.0)
		FXManager.spawn_combat_particles(target.global_position)

static func _scare(target: Node, from: Vector3) -> void:
	if not target is MarkovAgent:
		return
	var m := target as MarkovAgent
	var away := m.global_position - from
	away.y = 0.0
	if away.length_squared() > 0.01:
		m.velocity = away.normalized() * 6.0
	if m._states.has("Flee"):
		m.set_state("Flee")

static func _say(p: Vector3, text: String, color: Color) -> void:
	FXManager.show_floating_text(p + Vector3.UP * 2.2, text, color)

# Multiply a CA layer's cells within radius by factor (rot clean-up).
static func _scale_layer(layer: CALayer, p: Vector3, radius: float, factor: float) -> void:
	var c := layer.world_to_grid(p)
	var r: int = int(ceil(radius / layer.cell_size))
	for gz: int in range(maxi(c.y - r, 0), mini(c.y + r + 1, layer.grid_height)):
		for gx: int in range(maxi(c.x - r, 0), mini(c.x + r + 1, layer.grid_width)):
			var i: int = gz * layer.grid_width + gx
			layer._grid[i] *= factor

# Enrich the soil under and around p.
static func _till(sim: SimulationDirector, p: Vector3, amount: float) -> void:
	if sim.grass == null:
		return
	var g := sim.grass
	var c := g.world_to_grid(p)
	for gz: int in range(maxi(c.y - 1, 0), mini(c.y + 2, g.grid_height)):
		for gx: int in range(maxi(c.x - 1, 0), mini(c.x + 2, g.grid_width)):
			var i: int = gz * g.grid_width + gx
			g._nutrients[i] = clampf(g._nutrients[i] + amount, 0.0, GrassLayer.NUTRIENT_MAX)

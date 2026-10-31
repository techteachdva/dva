class_name SeasonalSprite
extends CritterAgent

# The four Seasonal Sprites. They arrive at mid-season, attack everything that
# is not their own kind, spread fast and die young. Each reshapes the valley
# as it walks, and a claimed sprite can be driven and use its signature power.

const SIGHT: float = 9.0
const REACH: float = 1.5
const BITE_EVERY: float = 0.7
# Real seconds between the walking powers.
const POWER_EVERY: float = 6.0
const SPREAD_EVERY: float = 1.4
const MAX_ALIVE: int = 14
# A band spreads until this far through its season, and is gone by the next mark.
const SPREAD_UNTIL: float = 0.75
const GONE_BY: float = 0.97
# What a Sprite turns into as its season ends.
const BECOMES: Array[String] = ["sheep", "rabbit", "deer", "goat", "mouse", "boar", "robin", "wolf"]
const SNOW_RANGE: float = 11.0
const SNOW_EVERY: float = 0.8
const STARFRUIT_CHANCE: float = 0.05
const CLAIMED_LIFE: float = 3.0

@export var sprite_kind: String = "fairy"

var _bite_cd: float = 0.0
var _power_cd: float = 1.0
var _spread_cd: float = 0.0
var _throw_cd: float = 0.0
var _foe: Node3D = null
var _foe_cd: float = 0.0
var _claimed: bool = false
var _born_in: String = ""

func _configure() -> void:
	species = sprite_kind
	species_id = sprite_kind
	walk_speed = 3.2
	run_speed = 4.6
	metabolism_rate = 0.0
	health = 14.0
	damage = 2.0
	energy = 50.0
	prey = []
	threats = []
	death_color = SeasonBook.color(sprite_kind)
	corpse_energy = 0.0

func _get_transition_modifiers() -> Dictionary:
	return {}

func _try_reproduce(_delta: float) -> void:
	pass

func _metabolise(_delta: float) -> void:
	if health <= 0.0:
		die()

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	if is_queued_for_deletion() or director == null:
		return
	if _born_in.is_empty():
		_born_in = _sim().get_season()
	if not _claimed and (_sim().get_season_progress() >= GONE_BY or _sim().get_season() != _born_in):
		_transform()
		return
	var life: float = delta * Clock.LIFE_PACE
	_bite_cd -= life
	_power_cd -= delta
	_throw_cd -= delta
	_spread_cd -= life
	_foe_cd -= delta
	if _foe_cd <= 0.0:
		_foe_cd = 0.4
		_foe = _nearest_foe()
	if not player_drive:
		_hunt()
	_strike()
	if _power_cd <= 0.0:
		_power_cd = POWER_EVERY
		walk_power()
	if _spread_cd <= 0.0 and not player_drive:
		_spread_cd = SPREAD_EVERY
		_spread()

func _on_tick_forage(_delta: float) -> void:
	pass

func _nearest_foe() -> Node3D:
	var sim := _sim()
	var best: Node3D = null
	var best_d: float = SIGHT * SIGHT
	for n: Node3D in sim.get_nearby_agents(global_position, SIGHT):
		if n == self or not is_instance_valid(n) or not n is MarkovAgent or n is SeasonalSprite:
			continue
		if n.get("species_id") == "mushroom" or n.get("indoors") == true:
			continue
		var d: float = n.global_position.distance_squared_to(global_position)
		if d < best_d:
			best_d = d
			best = n
	return best

func _hunt() -> void:
	if _foe == null or not is_instance_valid(_foe):
		if velocity.length_squared() < 0.1:
			velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed
		return
	var to: Vector3 = _foe.global_position - global_position
	to.y = 0.0
	var stop: float = SNOW_RANGE * 0.7 if sprite_kind == "snowman" else 0.0
	velocity = Vector3.ZERO if to.length() < stop else to.normalized() * run_speed

func _strike() -> void:
	if _foe == null or not is_instance_valid(_foe):
		return
	var d: float = global_position.distance_to(_foe.global_position)
	if sprite_kind == "snowman":
		if d <= SNOW_RANGE and _throw_cd <= 0.0:
			_throw_cd = SNOW_EVERY
			throw_snowball(_foe)
		return
	if d <= REACH and _bite_cd <= 0.0:
		_bite_cd = BITE_EVERY
		SeasonBook.hurt(_foe, damage)
		FXManager.spawn_combat_particles(_foe.global_position + Vector3.UP)

func throw_snowball(at: Node3D) -> void:
	var ball := Snowball.new()
	ball.target = at
	ball.from = global_position + Vector3.UP * 1.6
	get_parent().add_child(ball)

func _spread() -> void:
	var sim := _sim()
	if sim.get_species_count(species) >= MAX_ALIVE or sim.get_season_progress() > SPREAD_UNTIL or randf() > 0.55:
		return
	var off := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 2.0
	sim.spawn_offspring(species, self, global_position + off)

# What it does simply by walking through the valley.
func walk_power() -> void:
	var sim := _sim()
	var at: Vector3 = global_position
	match sprite_kind:
		"fairy":
			match randi() % 3:
				0: _mushroom_circle(sim, at)
				1:
					var star: bool = randf() < STARFRUIT_CHANCE
					var bush: Node = sim.plant_bush(at + _scatter(3.0), true)
					if star and bush != null:
						bush.add_child(StarBush.new())
				2: sim.try_plant_tree_seed(at + _scatter(3.0), "sprite")
		"sunfolk":
			_grow_around(sim, at, 2)
			_compost(sim, at)
		"scarecrow":
			_wither(sim, at, 2.6)

func _scatter(r: float) -> Vector3:
	return Vector3(randf_range(-r, r), 0.0, randf_range(-r, r))

func _mushroom_circle(sim: SimulationDirector, at: Vector3) -> void:
	for i: int in 7:
		sim.spawn_mushroom_spore(self, at + Vector3.FORWARD.rotated(Vector3.UP, TAU * i / 7.0) * 2.6)

func _grow_around(sim: SimulationDirector, at: Vector3, reach: int) -> void:
	if sim.grass == null:
		return
	for x: int in range(-reach, reach + 1):
		for z: int in range(-reach, reach + 1):
			sim.grass.grow_at(at + Vector3(x, 0.0, z), 0.5)

# Sunflowerfolk turn any corpse they touch into a tree seed at once.
func _compost(sim: SimulationDirector, at: Vector3) -> void:
	var body := sim.find_nearest_corpse(at, 2.0)
	if body == null:
		return
	body.queue_free()
	sim.try_plant_tree_seed(body.global_position, "sprite")
	FXManager.spawn_birth_particles(body.global_position, Color(0.95, 0.8, 0.2))

# Jack-o'-lanterns blight every plant they touch; fruit falls straight to rot.
func _wither(sim: SimulationDirector, at: Vector3, reach: float) -> void:
	if sim.grass != null:
		for x: int in range(-2, 3):
			for z: int in range(-2, 3):
				sim.grass.consume_density(at + Vector3(x, 0.0, z), 1.0)
	for tag: String in ["apple", "berry"]:
		for n: Node in get_tree().get_nodes_in_group(tag):
			var fruit := n as Node3D
			if fruit != null and fruit.global_position.distance_to(at) < reach and not fruit.is_queued_for_deletion():
				sim.rot.add_density_at_world(fruit.global_position, 1.0)
				fruit.queue_free()
	for tag: String in ["tree", "bush"]:
		for n: Node in get_tree().get_nodes_in_group(tag):
			var plant := n as Node3D
			if plant != null and plant.global_position.distance_to(at) < reach and not plant.is_queued_for_deletion():
				sim.rot.add_density_at_world(plant.global_position, 2.0)
				FXManager.spawn_death_particles(plant.global_position + Vector3.UP, Color(0.4, 0.25, 0.1))
				plant.queue_free()

# The season ends and the magic lets go: a puff, and an ordinary creature.
func _transform() -> void:
	var sim := _sim()
	FXManager.spawn_birth_particles(global_position + Vector3.UP, death_color)
	sim.spawn_offspring(BECOMES.pick_random(), self, global_position)
	queue_free()

# Space, while you drive a claimed sprite.
func signature_power() -> void:
	var sim := _sim()
	var at: Vector3 = global_position
	match sprite_kind:
		"fairy":
			_mushroom_circle(sim, at)
			var bush: Node = sim.plant_bush(at + _scatter(3.0), true)
			if bush != null and randf() < STARFRUIT_CHANCE:
				bush.add_child(StarBush.new())
			sim.try_plant_tree_seed(at + _scatter(4.0), "sprite")
		"sunfolk":
			_grow_around(sim, at, 5)
			_compost(sim, at)
		"scarecrow":
			_wither(sim, at, 6.0)
		"snowman":
			for n: Node3D in sim.get_nearby_agents(at, SNOW_RANGE):
				if n != self and n is MarkovAgent and not n is SeasonalSprite:
					throw_snowball(n)

func claimed() -> void:
	_claimed = true
	_lifespan *= CLAIMED_LIFE
	health *= 2.0

func die() -> void:
	if gold_shield() or is_queued_for_deletion():
		return
	var sim := _sim()
	if sim != null:
		sim.agent_died.emit(species, global_position)
	FXManager.spawn_death_particles(global_position, death_color)
	FXManager.report_death(species)
	queue_free()

class_name Fish
extends MarkovAgent

@export var swim_speed: float = 2.4
@export var metabolism_rate: float = 0.35
@export var repro_threshold: float = 22.0
@export var repro_cost: float = 8.0

var health: float = 18.0
var energy: float = 30.0
var _repro_cooldown: float = 0.0
var _lateral: float = 0.0
const RIVER_CAPACITY: int = 48
# Distance along the river and heading (+1 downriver, -1 upriver).
var _s: float = -1.0
var _dir: float = 1.0
# Decided once per visit to a copse: swim out of the valley, or turn back.
var _copse_choice: int = 0
const TURN_PER_SEC: float = 0.05
const LEAVE_CHANCE: float = 0.3
# Sideways offset in metres. It follows the water's width except while a
# flood is falling, so fish out on the floodplain get left behind.
var _lat_abs: float = 0.0
var stranded: bool = false
# Under winter ice the fish are drawn pale and still.
const ICE_TINT := Color(0.7, 0.85, 1.0)

func _frozen() -> bool:
	var sim: SimulationDirector = director
	return sim != null and sim.river_frozen

# Called by the director when falling flood water leaves this fish on land.
func strand() -> void:
	stranded = true
	set_state("Stranded")

func _ready() -> void:
	add_to_group("fish")
	_aquatic = true
	_lifespan = Clock.lifespan("fish")
	_lateral = randf_range(-0.6, 0.6)
	_register_states()
	super._ready()
	set_state("Swim")

func _register_states() -> void:
	_register_state("Swim", _on_enter_swim, _on_tick_swim, _on_exit_swim)
	_register_state("Stranded", Callable(), _on_tick_stranded, Callable())
	_current_state = "Swim"

# Flapping on dry land: no swimming, slowly suffocating, easy pickings.
func _on_tick_stranded(delta: float) -> void:
	velocity = Vector3.ZERO
	if _frozen():
		return
	health -= 2.5 * delta

func _on_enter_swim() -> void:
	pass

func _on_tick_swim(delta: float) -> void:
	if _frozen():
		return
	_eat_river_worm()
	_eat_riverweed()
	_eat_drifting_food()
	if randf() < delta * 0.15:
		_lateral = randf_range(-0.8, 0.8)

func _on_exit_swim() -> void:
	pass

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	if health <= 0.0:
		die()

func _swim_tick(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.valley == null or sim.valley.river == null:
		return
	var river: River = sim.valley.river
	if _data != null:
		if _frozen():
			_data.tint = ICE_TINT
		elif _data.tint == ICE_TINT:
			_data.tint = Color.WHITE
	if _frozen():
		# Frozen in under the ice: they hang still and wait for the thaw.
		velocity = Vector3.ZERO
		return
	if stranded:
		global_position.y = sim.ground_height(global_position.x, global_position.z)
		return
	var span: float = river.length()
	if _s < 0.0:
		_s = river.nearest_s(global_position.x, global_position.z)
		_dir = 1.0 if randf() > 0.5 else -1.0
	# Up and down the river, now and then turning back.
	if randf() < delta * TURN_PER_SEC:
		_dir = -_dir
	_s += _dir * swim_speed * delta
	var in_copse: bool = _s < river.copse_s.x or _s > river.copse_s.y
	if in_copse:
		if _copse_choice == 0:
			_copse_choice = 1 if randf() < LEAVE_CHANCE else -1
		var heading_out: bool = (_s < river.copse_s.x and _dir < 0.0) or (_s > river.copse_s.y and _dir > 0.0)
		if _copse_choice < 0 and heading_out:
			_dir = -_dir
		elif _copse_choice > 0 and (_s <= river.copse_s.x - 18.0 or _s >= river.copse_s.y + 18.0):
			# Out past the pines and away (the river runs on far into the peaks).
			sim.fish_left_valley(self, _s < river.copse_s.x)
			return
	else:
		_copse_choice = 0
	_s = clampf(_s, 0.0, span)
	var along: Vector3 = river.point_at(_s)
	var tangent: Vector3 = river.tangent_at(_s)
	if not sim.flood_receding():
		_lat_abs = _lateral * river.half_width()
	var side := Vector3(-tangent.z, 0.0, tangent.x) * _lat_abs
	var goal: Vector3 = along + side
	global_position = global_position.lerp(goal, clampf(delta * 3.0, 0.0, 1.0))
	# Fish left on dry ground by a falling flood suffocate.
	if not in_copse and not river.covers_world(global_position.x, global_position.z):
		health -= 6.0 * delta
	global_position.y = along.y + 0.05
	velocity = tangent * _dir * swim_speed

# Fish don't graze grass or moss, but fruit that falls or rolls into the
# water is fair game, and a flood washes them over the fungal mat, where
# they nibble the mycelium out of the drowned soil.
func _eat_drifting_food() -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.valley == null or sim.valley.river == null:
		return
	var river: River = sim.valley.river
	for fruit: Node3D in [sim.find_nearest_apple(global_position, 2.6), sim.find_nearest_berry(global_position, 2.6)]:
		if fruit != null and fruit.has_method("eat") and river.covers_world(fruit.global_position.x, fruit.global_position.z):
			energy = clampf(energy + fruit.eat(self) * 0.6, 0.0, 100.0)
			health = clampf(health + 3.0, 0.0, 40.0)
			return
	if sim.flood_level() > 0.1 and sim.mycelium != null:
		var m: float = sim.mycelium.consume_density(global_position, 0.04)
		if m > 0.0:
			energy = clampf(energy + m * 60.0, 0.0, 100.0)

func _eat_riverweed() -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.riverweeds == null:
		return
	var bite: float = sim.riverweeds.bite(global_position, 0.18)
	if bite > 0.0:
		energy = clampf(energy + bite * 22.0, 0.0, 100.0)

func _eat_river_worm() -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.valley == null or sim.valley.river == null:
		return
	var worm := sim.find_nearest_worm(global_position, 2.6)
	if worm == null or not sim.valley.river.covers_world(worm.global_position.x, worm.global_position.z):
		# Beetles that wander down the bank are snapped up from the shallows.
		worm = null
		for b in sim.get_nearby_agents(global_position, 2.6, "beetle"):
			if is_instance_valid(b):
				worm = b
				break
	if worm == null:
		return
	var quiet: bool = worm.get("gold_latent") == true
	if worm.has_method("die"):
		worm.die()
	if quiet:
		make_golden(1.0, worm.get("species_id"))
	energy += 16.0
	energy = clampf(energy, 0.0, 100.0)
	health += 4.0
	health = clampf(health, 0.0, 40.0)

func _metabolise(delta: float) -> void:
	var sim: SimulationDirector = director
	var wet := false
	if sim != null and sim.valley != null and sim.valley.river != null:
		wet = sim.valley.river.covers_world(global_position.x, global_position.z)
	if _frozen():
		# Cold and still under the ice: they barely burn anything.
		energy = maxf(energy - metabolism_rate * 0.15 * delta, 5.0)
		return
	if wet:
		energy += 1.4 * delta
	energy -= metabolism_rate * delta
	energy = clampf(energy, 0.0, 100.0)
	if energy <= 0.0:
		health -= 2.0 * delta

func _try_reproduce(delta: float) -> void:
	if stranded or _frozen():
		return
	_repro_cooldown -= delta
	if _repro_cooldown > 0.0 or energy < repro_threshold:
		return
	var sim: SimulationDirector = director
	if sim == null:
		return
	# The river only holds so many; spawning thins out as it fills.
	var shoal: int = sim._active_fish.size()
	if shoal >= RIVER_CAPACITY or randf() < float(shoal) / RIVER_CAPACITY * 0.7:
		_repro_cooldown = 2.0
		return
	var mate: Node3D = null
	for other in sim._active_fish:
		if other == self or not is_instance_valid(other) or other.sex == sex:
			continue
		if global_position.distance_squared_to(other.global_position) < 36.0:
			mate = other
			break
	if mate == null:
		return
	energy -= repro_cost
	_repro_cooldown = 3.5
	# A spawning, not a birth: fish lay far bigger broods than anything else
	# in the valley, and more when the river is empty (4.7).
	var brood: int = randi_range(3, 6) + (3 if shoal < RIVER_CAPACITY / 3 else 0)
	for k: int in mini(brood, RIVER_CAPACITY - shoal):
		sim.spawn_fish_offspring(self, global_position + Vector3(randf_range(-1.0, 1.0), 0.0, randf_range(-1.0, 1.0)))

func die() -> void:
	if gold_shield():
		return
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		var dry: bool = stranded
		if not dry and sim.valley != null and sim.valley.river != null:
			dry = not sim.valley.river.covers_world(global_position.x, global_position.z)
		if dry:
			sim.note_flood_fish_death()
		sim.spawn_corpse(global_position, 0.4, "fish", golden)
		sim.agent_died.emit("fish", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.3, 0.65, 0.85))
	queue_free()

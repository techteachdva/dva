class_name MarkovAgent
extends Node3D

signal state_changed(old_state: String, new_state: String)

@export var move_speed: float = 3.0
@export var turn_speed: float = 5.0

var velocity: Vector3 = Vector3.ZERO

var _states: Dictionary = {}
var _current_state: String = ""
var _state_time: float = 0.0
var _min_state_time: float = 0.25
var _aerial: bool = false
var _aquatic: bool = false
var _attack_cooldown: float = 0.0
var _flee_boost_timer: float = 0.0
var _flee_boost_mult: float = 1.0
var _juvenile_timer: float = 3.0
var _data: AgentData = null
var display_name: String = ""
var sex: String = ""
var variant: String = ""
var _age: float = 0.0
var _lifespan: float = 80.0
var _lifespan_bonus: float = 0.0
var _death_clock: float = 0.0
var _last_energy: float = -1.0
var _vision_cone: VisionCone = null
const _NO_MODS: Dictionary = {"__none__": true}

@onready var director: SimulationDirector = _find_director()

func _find_director() -> SimulationDirector:
	var node := get_parent()
	while node != null:
		if node is SimulationDirector:
			return node as SimulationDirector
		node = node.get_parent()
	return null

func _ready() -> void:
	_register_states()
	assert(not _current_state.is_empty(), "MarkovAgent: initial state must be set in _register_states")
	set_physics_process(false)
	_vision_cone = get_node_or_null("VisionCone") as VisionCone
	# _age and _lifespan are declared here for subclass use in _metabolise and _try_reproduce
	_age = _age
	_lifespan = _lifespan
	# Generate a species-specific display name for tickertape
	var species: String = ""
	if is_in_group("wolf"): species = "wolf"
	elif is_in_group("sheep"): species = "sheep"
	elif is_in_group("human"): species = "human"
	elif is_in_group("boar"): species = "boar"
	elif is_in_group("falcon"): species = "falcon"
	elif is_in_group("robin"): species = "robin"
	elif is_in_group("worm"): species = "worm"
	elif is_in_group("fish"): species = "fish"
	elif is_in_group("spore"): species = "mushroom"
	if not species.is_empty():
		display_name = NameGenerator.generate(species)
	# Spores reproduce asexually; everyone else gets a sex
	if not is_in_group("spore"):
		sex = "female" if randf() > 0.5 else "male"

func _register_states() -> void:
	pass

func _register_state(state_name: String, on_enter: Callable, on_tick: Callable, on_exit: Callable) -> void:
	_states[state_name] = {
		"on_enter": on_enter,
		"on_tick": on_tick,
		"on_exit": on_exit,
	}

func set_state(next: String) -> void:
	assert(_states.has(next), "MarkovAgent: invalid state name '%s'" % next)
	if next == _current_state:
		return
	if _current_state != "" and _states[_current_state]["on_exit"].is_valid():
		_states[_current_state]["on_exit"].call()
	var old := _current_state
	_current_state = next
	_state_time = 0.0
	if _states[_current_state]["on_enter"].is_valid():
		_states[_current_state]["on_enter"].call()
	state_changed.emit(old, _current_state)

func current_state() -> String:
	return _current_state

func _physics_process(delta: float) -> void:
	_state_time += delta
	_attack_cooldown = maxf(_attack_cooldown - delta, 0.0)
	_flee_boost_timer = maxf(_flee_boost_timer - delta, 0.0)
	_juvenile_timer = maxf(_juvenile_timer - delta, 0.0)
	var entry: Variant = _states.get(_current_state)
	if entry != null:
		var on_tick: Callable = entry["on_tick"]
		if on_tick.is_valid():
			on_tick.call(delta)
	_movement_tick(delta)
	_evaluate_transitions(delta)
	# Unified lifecycle: subclasses override these methods
	var sim: SimulationDirector = director
	var metab_mult: float = 1.0 if sim == null else sim.get_metabolism_mult()
	_metabolise(delta * metab_mult)
	_try_reproduce(delta)
	# Lifespan extension: eating and energy gains extend life
	var cur_energy: Variant = get("energy")
	if cur_energy != null and _last_energy >= 0.0 and cur_energy > _last_energy:
		var gained: float = float(cur_energy) - _last_energy
		_lifespan_bonus += gained * 0.03
		_lifespan_bonus = clampf(_lifespan_bonus, 0.0, _lifespan * 0.5)
	_last_energy = cur_energy if cur_energy != null else -1.0
	_age_and_die(delta)
	# Sync ECS data record
	if _data != null:
		_data.pos = global_position
		_data.vel = velocity
		_data.sync_msec = Time.get_ticks_msec()
		_data.state = _current_state
		var cur_health: Variant = get("health")
		if cur_health != null:
			_data.health = cur_health
		cur_energy = get("energy")
		if cur_energy != null:
			_data.energy = cur_energy
		_data.age = _age

func _metabolise(_delta: float) -> void:
	pass

func _try_reproduce(_delta: float) -> void:
	pass

func get_flee_speed(base: float) -> float:
	if _flee_boost_timer > 0.0:
		return base * _flee_boost_mult
	return base

func _movement_tick(delta: float) -> void:
	if _aquatic:
		if has_method("_swim_tick"):
			call("_swim_tick", delta)
		return
	if not _aerial:
		velocity.y = 0.0
		# Soft boundary steering to keep agents on the map
		var boundary: float = 45.0
		var steer: float = 5.0
		if global_position.x > boundary:
			velocity.x -= steer
		elif global_position.x < -boundary:
			velocity.x += steer
		if global_position.z > boundary:
			velocity.z -= steer
		elif global_position.z < -boundary:
			velocity.z += steer
	# Batch separation via crowding field (no per-agent spatial queries)
	if velocity.length_squared() > 0.01:
		var sim: SimulationDirector = director
		if sim != null:
			velocity += sim.get_crowding_vector(global_position)
	if velocity.length_squared() > 0.001:
		global_position += velocity * delta
	if not _aerial:
		var ground_y := 0.0
		var ground_sim: SimulationDirector = director
		if ground_sim != null:
			ground_y = ground_sim.ground_height(global_position.x, global_position.z)
		global_position.y = ground_y
		global_position.x = clampf(global_position.x, -50.0, 50.0)
		global_position.z = clampf(global_position.z, -50.0, 50.0)
		if ground_sim != null and ground_sim.valley != null and ground_sim.valley.river != null and ground_sim.valley.river.is_near(global_position.x, global_position.z):
			var wet: Dictionary = ground_sim.valley.river.sample(global_position.x, global_position.z)
			if wet.in_water and float(wet.distance) < ground_sim.valley.river.half_width() * 0.62:
				var bank: Vector3 = wet.closest
				var away := Vector3(global_position.x - bank.x, 0.0, global_position.z - bank.z)
				if away.length_squared() > 0.01:
					velocity += away.normalized() * 7.0

func _get_transition_modifiers() -> Dictionary:
	return {}

# Pass the modifiers already computed this tick so they are not built twice.
# Picks a registered state with probability proportional to its modifier.
func _pick_next_state(mods: Dictionary = _NO_MODS) -> String:
	if mods == _NO_MODS:
		mods = _get_transition_modifiers()
	var total := 0.0
	for k: String in mods:
		if _states.has(k):
			total += clampf(mods[k], 0.0, 1.0)
	if total <= 0.0:
		return _current_state
	var pick := randf() * total
	for k: String in mods:
		if not _states.has(k):
			continue
		var p: float = clampf(mods[k], 0.0, 1.0)
		if p > 0.0:
			pick -= p
			if pick <= 0.0:
				return k
	return _current_state

func _evaluate_transitions(_delta: float) -> void:
	var mods := _get_transition_modifiers()
	var emergent: String = ""
	var em_prob: float = 0.0
	for k: String in mods.keys():
		if mods[k] > em_prob:
			em_prob = mods[k]
			emergent = k
	# Instant interrupt for life-threatening transitions
	if em_prob >= 0.8 and emergent != _current_state:
		set_state(emergent)
		return
	if _state_time < _min_state_time:
		return
	var next := _pick_next_state(mods)
	if next != _current_state:
		set_state(next)

# Flocking: steer toward same-species members
func _cohesion_vector(group_tag: String, radius: float, strength: float) -> Vector3:
	var sim: SimulationDirector = director
	if sim == null:
		return Vector3.ZERO
	var nearby := sim.get_nearby_agents(global_position, radius, group_tag)
	var center := Vector3.ZERO
	var count := 0
	for node in nearby:
		if node == self:
			continue
		if not node is Node3D:
			continue
		center += node.global_position
		count += 1
	if count <= 0:
		return Vector3.ZERO
	center /= float(count)
	var dir := (center - global_position).normalized()
	return dir * strength

func _bind_agent_data(data: AgentData) -> void:
	_data = data

# Probabilistic lifespan with exponential death curve (Euler curve).
# Eating extends lifespan bonus. Health/energy modulate death clock speed.
func _age_and_die(delta: float) -> void:
	_age += delta
	var effective_lifespan: float = _lifespan + _lifespan_bonus
	# Phase 1: juvenile grace period — no death chance
	if _age < effective_lifespan * 0.75:
		_death_clock = 0.0
		return
	# Phase 2: exponential death probability beyond 75% of lifespan
	_death_clock += delta
	var health: float = get("health") if get("health") != null else 50.0
	var energy: float = get("energy") if get("energy") != null else 50.0
	# Starvation and injury accelerate the death clock
	var clock_mult: float = 1.0
	if health < 30.0:
		clock_mult += 1.5
	if energy < 10.0:
		clock_mult += 2.0
	# Good health and fullness can pause or even slightly reverse the clock
	if health > 80.0 and energy > 60.0:
		clock_mult -= 0.3
	if health > 90.0 and energy > 80.0:
		clock_mult -= 0.3
	clock_mult = clampf(clock_mult, 0.1, 5.0)
	var scaled_clock: float = _death_clock * clock_mult
	# Exponential death probability: P(death) = 1 - exp(-t / tau)
	# tau = 25% of effective lifespan. At t=tau, P=63%. At t=2*tau, P=86%.
	var tau: float = effective_lifespan * 0.25
	var death_prob: float = 1.0 - exp(-scaled_clock / tau)
	if randf() < death_prob:
		if has_method("die"):
			call("die")
		return
	# Hard failsafe: if age exceeds 2.5x effective lifespan, guaranteed death
	if _age >= effective_lifespan * 2.5:
		if has_method("die"):
			call("die")
		return
	# Instant death from zero health (combat, starvation)
	if health <= 0.0:
		if has_method("die"):
			call("die")

func _get_var(var_name: String) -> Variant:
	if get(var_name) != null:
		return get(var_name)
	return null

func _set_var(var_name: String, value: Variant) -> void:
	set(var_name, value)

# Seek target position
func _seek_vector(target_pos: Vector3, strength: float) -> Vector3:
	var dir := (target_pos - global_position).normalized()
	return dir * strength

class_name MarkovAgent
extends Node3D

signal state_changed(old_state: String, new_state: String)

@export var move_speed: float = 3.0
@export var turn_speed: float = 5.0

var velocity: Vector3 = Vector3.ZERO
var _move_pace: float = 1.0
# Herding: 0 alone or on the edge of a group, up to 1 in the middle of a
# dense one. Creatures drift toward their own kind, and the ones in the
# middle get small bonuses (see HERD_* and CombatSystem).
var herd: float = 0.0
var _herd_pull: Vector3 = Vector3.ZERO
var _herd_timer: float = randf()
const HERD_RADIUS: float = 9.0
const HERD_CORE: float = 4.5
const HERD_FLEE: float = 0.2      # prey run up to 20% faster from the middle
const HERD_HUNGER: float = 0.1    # everyone in the middle gets hungry 10% slower
const HERD_HEAL: float = 0.4      # and mends a little
const URGENT_STATES: Array[String] = ["Flee", "Chase", "Dive", "Charge", "Raid", "Stranded", "Sleep"]

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
# "", "tough" or "special" (see Roles).
var role: String = ""
var species_id: String = ""
var _role_timer: float = 2.0
var _age: float = 0.0
var _lifespan: float = 80.0
var _lifespan_bonus: float = 0.0
var _death_clock: float = 0.0
var _last_energy: float = -1.0
var _vision_cone: VisionCone = null
const _NO_MODS: Dictionary = {"__none__": true}
const BOUNDARY_SOFT: float = 38.0
const BOUNDARY_HARD: float = 44.0

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
	elif is_in_group("rabbit"): species = "rabbit"
	species_id = species
	# Spores reproduce asexually; everyone else gets a sex, then a name to suit.
	if not is_in_group("spore"):
		sex = "female" if randf() > 0.5 else "male"
	if not species.is_empty():
		display_name = NameGenerator.generate(species, sex)

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
	# Two speeds: bodies move in real time, but everything ecological (eating,
	# fighting, hunting, abilities, hunger, breeding, ageing) runs on life
	# time, Clock.LIFE_PACE slower, so a day holds a calm, readable story.
	var life: float = delta * Clock.LIFE_PACE
	_state_time += delta
	_attack_cooldown = maxf(_attack_cooldown - life, 0.0)
	_flee_boost_timer = maxf(_flee_boost_timer - delta, 0.0)
	_juvenile_timer = maxf(_juvenile_timer - life, 0.0)
	var entry: Variant = _states.get(_current_state)
	if entry != null:
		var on_tick: Callable = entry["on_tick"]
		if on_tick.is_valid():
			on_tick.call(life)
	_herd_timer -= delta
	if _herd_timer <= 0.0:
		_herd_timer = 1.0 + randf() * 0.3
		_update_herd()
	_movement_tick(delta)
	_evaluate_transitions(delta)
	if not role.is_empty():
		Roles.tick(self, species_id, life)
	# Unified lifecycle: subclasses override these methods. Life (hunger,
	# breeding, ageing) runs at Clock.LIFE_PACE; movement above stays real-time.
	var sim: SimulationDirector = director
	var metab_mult: float = 1.0 if sim == null else sim.season_metabolism(species_id) * sim.tune(species_id, "hunger")
	metab_mult *= 1.0 - HERD_HUNGER * herd
	if herd > 0.0 and get("health") != null:
		set("health", minf(float(get("health")) + HERD_HEAL * herd * life, 100.0))
	_metabolise(life * metab_mult)
	# Out of season, breeding stalls; in season it comes round faster.
	var breed: float = 1.0 if sim == null else sim.season_breeding(species_id) * sim.tune(species_id, "birth")
	if breed >= 1.0:
		_try_reproduce(life * breed)
	elif randf() < breed:
		_try_reproduce(life / maxf(breed, 0.05) * 0.5)
	# Lifespan extension: eating and energy gains extend life
	var cur_energy: Variant = get("energy")
	if cur_energy != null and _last_energy >= 0.0 and cur_energy > _last_energy:
		var gained: float = float(cur_energy) - _last_energy
		_lifespan_bonus += gained * 0.03
		_lifespan_bonus = clampf(_lifespan_bonus, 0.0, _lifespan * 0.5)
	_last_energy = cur_energy if cur_energy != null else -1.0
	_age_and_die(life)
	# Sync ECS data record
	if _data != null:
		var clock_now: float = AgentData.clock
		_data.interval = clampf(clock_now - _data.sync_time, 0.016, 1.0)
		_data.prev_pos = _data.shown if _data.has_shown else global_position
		_data.pos = global_position
		# What the creature actually moves at (day/night and tuning included), so
		# the sprite glides along its real path instead of overshooting and snapping.
		_data.vel = velocity * _move_pace
		_data.sync_msec = Time.get_ticks_msec()
		_data.sync_time = AgentData.clock
		_data.state = _current_state
		var cur_health: Variant = get("health")
		if cur_health != null:
			_data.health = cur_health
		cur_energy = get("energy")
		if cur_energy != null:
			_data.energy = cur_energy
		_data.age = _age

# Looks at its own kind within HERD_RADIUS: how close it is to their middle
# and how packed the middle is. Edge-dwellers score near zero.
func _update_herd() -> void:
	var sim: SimulationDirector = director
	if sim == null or species_id.is_empty() or species_id == "mushroom":
		herd = 0.0
		_herd_pull = Vector3.ZERO
		return
	var strength: float = sim.tune(species_id, "herd")
	var kin := sim.get_nearby_agents(global_position, HERD_RADIUS, species_id)
	var centre := Vector3.ZERO
	var n: int = 0
	var core: int = 0
	for k in kin:
		if k == self:
			continue
		centre += k.global_position
		n += 1
		if k.global_position.distance_squared_to(global_position) <= HERD_CORE * HERD_CORE:
			core += 1
	if n < 2:
		herd = 0.0
		_herd_pull = Vector3.ZERO
		return
	centre /= float(n)
	var to_centre := Vector3(centre.x - global_position.x, 0.0, centre.z - global_position.z)
	var off: float = to_centre.length()
	var middle: float = 1.0 - clampf(off / 5.0, 0.0, 1.0)
	var packed: float = clampf(float(core) / 4.0, 0.0, 1.0)
	herd = clampf(middle * packed * strength, 0.0, 1.0)
	# A gentle pull back toward the group, stronger the further out.
	_herd_pull = to_centre.normalized() * clampf((off - 2.0) * 0.25, 0.0, 1.2) * strength if off > 2.0 else Vector3.ZERO

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
		# Soft round boundary: the meadow ends at the valley floor and only
		# the foot of the slopes is walkable.
		var r: float = Vector2(global_position.x, global_position.z).length()
		if r > BOUNDARY_SOFT:
			var inward := Vector3(-global_position.x, 0.0, -global_position.z) / r
			velocity += inward * 5.0 * (1.0 + (r - BOUNDARY_SOFT) * 0.5)
	# Batch separation via crowding field (no per-agent spatial queries)
	if velocity.length_squared() > 0.01:
		var sim: SimulationDirector = director
		if sim != null:
			velocity += sim.get_crowding_vector(global_position)
		# Magnetism toward their own kind, unless something urgent is happening.
		if not URGENT_STATES.has(_current_state):
			velocity += _herd_pull
	if velocity.length_squared() > 0.001:
		# Day and night set the pace: sleepers barely shuffle, hunters prowl.
		var pace: float = 1.0
		var dn_sim: SimulationDirector = director
		if dn_sim != null and not species_id.is_empty():
			pace = dn_sim.daynight_mult(species_id, 0) * dn_sim.tune(species_id, "speed")
			if _current_state == "Flee":
				pace *= 1.0 + HERD_FLEE * herd
		_move_pace = pace
		global_position += velocity * delta * pace
	if not _aerial:
		var ground_y := 0.0
		var ground_sim: SimulationDirector = director
		if ground_sim != null:
			ground_y = ground_sim.ground_height(global_position.x, global_position.z)
		var flat := Vector2(global_position.x, global_position.z)
		if flat.length() > BOUNDARY_HARD:
			flat = flat.normalized() * BOUNDARY_HARD
			global_position.x = flat.x
			global_position.z = flat.y
			if ground_sim != null:
				ground_y = ground_sim.ground_height(flat.x, flat.y)
		global_position.y = ground_y
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
	# Starvation and wounds kill at any age (young animals used to linger
	# at negative health because the check sat behind the juvenile grace).
	var hp: Variant = get("health")
	if hp != null and float(hp) <= 0.0:
		if has_method("die"):
			call("die")
		return
	# Tuning Lab "death": above 1 they age out sooner, below 1 they live longer.
	var death_mult: float = 1.0
	var tsim: SimulationDirector = director
	if tsim != null:
		death_mult = maxf(tsim.tune(species_id, "death"), 0.05)
	var effective_lifespan: float = (_lifespan + _lifespan_bonus) / death_mult
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

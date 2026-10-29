class_name Falcon
extends MarkovAgent

@export var patrol_speed: float = 5.0
@export var dive_speed: float = 10.0
@export var metabolism_rate: float = 1.5
@export var repro_threshold: float = 35.0
@export var repro_cost: float = 15.0

var health: float = 50.0
var damage: float = 30.0
var energy: float = 60.0
var _repro_cooldown: float = 0.0
var _patrol_target: Vector3 = Vector3.ZERO
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0
var _eat_timer: float = 0.0

func _ready() -> void:
	add_to_group("falcon")
	_aerial = true
	_lifespan = 90.0
	_register_states()
	super._ready()
	set_state("Patrol")
	_pick_patrol_target()

func _register_states() -> void:
	_register_state("Patrol", _on_enter_patrol, _on_tick_patrol, _on_exit_patrol)
	_register_state("Dive", _on_enter_dive, _on_tick_dive, _on_exit_dive)
	_register_state("Eat", _on_enter_eat, _on_tick_eat, _on_exit_eat)
	_current_state = "Patrol"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods
	var robins := vision.get_visible_by_tag("robin")
	var rabbits := vision.get_visible_by_tag("rabbit")
	var sim: SimulationDirector = director
	var fish_near: bool = sim != null and sim.find_nearest_fish(global_position, 22.0) != null
	if robins.size() > 0 or rabbits.size() > 0 or fish_near:
		mods["Dive"] = 1.0  # instant interrupt
	else:
		if energy < 25.0:
			mods["Eat"] = clampf(mods.get("Eat", 0.0) + 0.3, 0.0, 1.0)
	return mods

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	_evaluate_transitions(delta)
	_metabolise(delta)
	_try_reproduce(delta)
	var sim: SimulationDirector = director
	if sim != null:
		_local_cache_timer -= delta
		if _local_cache_timer <= 0.0:
			_local_cache_timer = 0.5
			_cached_local_count = sim.get_nearby_agents(global_position, 8.0, "falcon").size()
		var local_falcons: int = _cached_local_count
		if local_falcons > 8:
			energy -= float(local_falcons - 8) * 0.6 * delta
		var total_falcons: int = sim.get_falcon_count()
		if total_falcons > 60:
			energy -= (total_falcons - 60) / 40.0 * 1.2 * delta
	if health <= 0.0:
		die()
	# Keep altitude, but a dive may reach the river
	var floor_y: float = 1.1 if _current_state == "Dive" else 6.0
	if global_position.y < floor_y:
		global_position.y = floor_y + randf() * 0.4
	elif global_position.y > 18.0:
		global_position.y = 18.0 - randf() * 2.0

func _metabolise(delta: float) -> void:
	energy -= metabolism_rate * delta
	if energy <= 0.0:
		health -= 4.0 * delta
		energy = 0.0

func _try_reproduce(delta: float) -> void:
	_repro_cooldown -= delta
	if _repro_cooldown > 0.0:
		return
	if energy < repro_threshold:
		return
	# Desperation repopulation: when population < 10, reproduction becomes easier
	var desperation_threshold: float = repro_threshold
	var desperation_cost: float = repro_cost
	var desperation_cooldown: float = 0.0
	var sim: SimulationDirector = director
	if sim != null:
		var total_count: int = sim.get_falcon_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -1.0  # reduces effective cooldown by 1s
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown  # apply cooldown reduction
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 10.0, "falcon").size()
	if count <= 4:
		pass
	elif count <= 9:
		if randf() > 0.5:
			return
	elif count <= 16:
		if randf() > 0.2:
			return
	else:
		return
	for node in sim.get_nearby_agents(global_position, 10.0, "falcon"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_falcon: Falcon = node as Falcon
		if other_falcon.energy >= desperation_threshold and other_falcon._repro_cooldown <= 0.0 and other_falcon.sex != sex:
			energy -= desperation_cost
			other_falcon.energy -= desperation_cost * 0.5
			other_falcon._repro_cooldown = 6.0
			_repro_cooldown = 6.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 2.0
			sim.spawn_falcon_offspring(self, global_position + offset)
			return

func _pick_patrol_target() -> void:
	_patrol_target = global_position + Vector3((randf() - 0.5) * 20.0, 0.0, (randf() - 0.5) * 20.0)
	_patrol_target.x = clampf(_patrol_target.x, -45.0, 45.0)
	_patrol_target.z = clampf(_patrol_target.z, -45.0, 45.0)

func _on_enter_patrol() -> void:
	_pick_patrol_target()
	_eat_timer = 0.0

func _on_tick_patrol(_delta: float) -> void:
	if global_position.distance_to(_patrol_target) < 2.0:
		_pick_patrol_target()
	var dir := (_patrol_target - global_position).normalized()
	# Flock with falcons
	var cohesion := _cohesion_vector("falcon", 15.0, 0.3)
	if cohesion != Vector3.ZERO:
		dir = (dir + cohesion).normalized()
	velocity = dir * patrol_speed

func _on_exit_patrol() -> void:
	pass

func _on_enter_dive() -> void:
	pass

func _on_tick_dive(delta: float) -> void:
	var target: Node3D = null
	var vision: VisionCone = _vision_cone
	if vision != null:
		var robins := vision.get_visible_by_tag("robin")
		var rabbits := vision.get_visible_by_tag("rabbit")
		if robins.size() > 0 and is_instance_valid(robins[0]):
			target = robins[0]
		elif rabbits.size() > 0 and is_instance_valid(rabbits[0]):
			target = rabbits[0]
	if target == null:
		var sim: SimulationDirector = director
		if sim != null:
			target = sim.find_nearest_fish(global_position, 22.0)
	if target != null and is_instance_valid(target):
		var dir := (target.global_position - global_position).normalized()
		velocity = dir * dive_speed
		var bite: float = 2.8 if target.is_in_group("fish") else 2.0
		if global_position.distance_to(target.global_position) < bite and target is MarkovAgent:
			if CombatSystem.resolve_attack(self, target as MarkovAgent):
				energy += 15.0
				energy = clampf(energy, 0.0, 100.0)
				set_state("Eat")
	else:
		velocity = velocity.move_toward(Vector3.ZERO, delta * 2.0)

func _on_exit_dive() -> void:
	pass

func _on_enter_eat() -> void:
	_eat_timer = 3.0
	velocity = Vector3.ZERO

func _on_tick_eat(delta: float) -> void:
	_eat_timer -= delta
	energy += 2.0 * delta
	energy = clampf(energy, 0.0, 100.0)
	if _eat_timer <= 0.0:
		set_state("Patrol")

func _on_exit_eat() -> void:
	pass

func die() -> void:
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 1.0)
		sim.agent_died.emit("falcon", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.95, 0.95, 0.95))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.95, 0.95, 0.8))
	FXManager.report_death("falcon")
	queue_free()

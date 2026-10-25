class_name Rabbit
extends MarkovAgent

@export var walk_speed: float = 4.5
@export var flee_speed: float = 7.0
@export var metabolism_rate: float = 0.4
@export var repro_threshold: float = 12.0
@export var repro_cost: float = 3.0

var health: float = 8.0
var energy: float = 15.0
var _repro_cooldown: float = 0.0
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0

func _ready() -> void:
	add_to_group("rabbit")
	_register_states()
	super._ready()
	_lifespan = Clock.lifespan("rabbit")
	set_state("Graze")

func _register_states() -> void:
	_register_state("Graze", _on_enter_graze, _on_tick_graze, _on_exit_graze)
	_register_state("Flee", _on_enter_flee, _on_tick_flee, _on_exit_flee)
	_current_state = "Graze"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var sim: SimulationDirector = director
	if sim == null:
		return mods
	var vision: VisionCone = _vision_cone
	if vision != null:
		var threat := false
		for tag: String in ["human", "falcon", "wolf"]:
			for t: Node3D in vision.get_visible_by_tag(tag):
				# Only bolt when the hunter is close enough to matter.
				if is_instance_valid(t) and t.global_position.distance_squared_to(global_position) < 81.0:
					threat = true
					break
			if threat:
				break
		if threat:
			mods["Flee"] = 0.9
		else:
			# Danger gone: back to the grass.
			mods["Graze"] = 0.7
	return mods

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	var sim: SimulationDirector = director
	if sim != null:
		_local_cache_timer -= delta
		if _local_cache_timer <= 0.0:
			_local_cache_timer = 0.5
			_cached_local_count = sim.get_nearby_agents(global_position, 5.0, "rabbit").size()
		var local_rabbits: int = _cached_local_count
		if local_rabbits > 10:
			health -= float(local_rabbits - 10) * 0.5 * delta
		var total_rabbits: int = sim.get_rabbit_count()
		if total_rabbits > 60:
			energy -= (total_rabbits - 60) / 30.0 * 1.0 * delta
	if health <= 0.0:
		die()

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
	# Desperation repopulation: when population < 15, reproduction becomes easier
	var desperation_threshold: float = repro_threshold
	var desperation_cost: float = repro_cost
	var desperation_cooldown: float = 0.0
	var sim: SimulationDirector = director
	if sim != null:
		var total_count: int = sim.get_rabbit_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -1.5
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 8.0, "rabbit").size()
	if count <= 4:
		pass
	elif count <= 8:
		if randf() > 0.5:
			return
	elif count <= 14:
		if randf() > 0.2:
			return
	else:
		return
	for node in sim.get_nearby_agents(global_position, 6.0, "rabbit"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_rabbit: Rabbit = node as Rabbit
		if other_rabbit.energy >= desperation_threshold and other_rabbit._repro_cooldown <= 0.0 and other_rabbit.sex != sex:
			energy -= desperation_cost
			other_rabbit.energy -= desperation_cost * 0.5
			other_rabbit._repro_cooldown = 3.0
			_repro_cooldown = 3.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.0
			sim.spawn_rabbit_offspring(self, global_position + offset)
			return

func _on_enter_graze() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed

func _on_tick_graze(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	# Eat grass
	if sim.grass != null:
		var consumed := sim.grass.consume_density(global_position, delta * 0.5)
		if consumed > 0.0:
			energy += consumed * 8.0
			energy = clampf(energy, 0.0, 100.0)
			return
	# Seek apples
	var nearest_apple := sim.find_nearest_apple(global_position, 6.0)
	if nearest_apple != null and global_position.distance_squared_to(nearest_apple.global_position) < 2.0:
		if nearest_apple.has_method("eat"):
			energy += nearest_apple.eat() * 0.5
			energy = clampf(energy, 0.0, 100.0)
			return
	# Random drift with grass bias
	if randf() < 0.1:
		velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed

func _on_exit_graze() -> void:
	pass

func _on_enter_flee() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * flee_speed

func _on_tick_flee(_delta: float) -> void:
	var sim: SimulationDirector = director
	var threat: Node3D = null
	var vision: VisionCone = _vision_cone
	if vision != null:
		threat = vision.closest_visible("human")
		if threat == null:
			threat = vision.closest_visible("falcon")
	if threat != null and is_instance_valid(threat):
		var away := (global_position - threat.global_position).normalized()
		velocity = away * flee_speed
	else:
		if velocity.length() < flee_speed:
			velocity = velocity.normalized() * flee_speed

func _on_exit_flee() -> void:
	pass

func die() -> void:
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 0.3, "rabbit")
		sim.agent_died.emit("rabbit", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.78, 0.6, 0.42))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.9, 0.7, 0.5))
	FXManager.report_death("rabbit")
	queue_free()

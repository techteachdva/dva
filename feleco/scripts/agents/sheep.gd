class_name Sheep
extends MarkovAgent

@export var graze_rate: float = 0.3
@export var flee_speed: float = 5.0
@export var walk_speed: float = 2.0
@export var metabolism_rate: float = 1.3
@export var repro_threshold: float = 18.0
@export var repro_cost: float = 9.0

var health: float = 25.0
var energy: float = 32.0
var grazing_target: Vector3 = Vector3.ZERO
var _repro_cooldown: float = 0.0
var _diet_boost: float = 0.0
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0
var _scent_query_timer: float = 0.0
var _cached_predator_scent: bool = false
var _food_query_timer: float = 0.0
var _cached_apple: Node3D = null
var _cached_mushroom: Node3D = null

func _ready() -> void:
	add_to_group("sheep")
	_register_states()
	super._ready()
	_lifespan = Clock.lifespan("sheep")
	set_state("Idle")

func _register_states() -> void:
	_register_state("Idle", _on_enter_idle, _on_tick_idle, _on_exit_idle)
	_register_state("Walk", _on_enter_walk, _on_tick_walk, _on_exit_walk)
	_register_state("Graze", _on_enter_graze, _on_tick_graze, _on_exit_graze)
	_register_state("Flee", _on_enter_flee, _on_tick_flee, _on_exit_flee)
	_current_state = "Idle"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var sim: SimulationDirector = director
	if sim == null:
		return mods

	var predator_scent_detected := _cached_predator_scent
	if predator_scent_detected:
		mods["Flee"] = clampf(mods.get("Flee", 0.0) + 0.5, 0.0, 1.0)

	var vision: VisionCone = _vision_cone
	var wolves: Array[Node3D] = []
	var boars: Array[Node3D] = []
	if vision != null:
		wolves = vision.get_visible_by_tag("wolf")
		if wolves.size() > 0:
			mods["Flee"] = clampf(mods.get("Flee", 0.0) + 0.8, 0.0, 1.0)
		boars = vision.get_visible_by_tag("boar")
		if boars.size() > 0:
			mods["Flee"] = clampf(mods.get("Flee", 0.0) + 0.6, 0.0, 1.0)

	var grass_density := 0.0
	if sim.grass != null:
		grass_density = sim.grass.edible_at_world(global_position)

	if sim.grass != null and not predator_scent_detected and wolves.size() == 0 and boars.size() == 0:
		if grass_density > 0.3:
			mods["Graze"] = 1.0  # dominant: stay and eat
		elif grass_density > 0.1:
			mods["Graze"] = clampf(mods.get("Graze", 0.0) + 0.5, 0.0, 1.0)

	if _current_state == "Graze" and sim.grass != null and grass_density < 0.1:
		mods["Walk"] = 1.0

	# Mate-seeking: only wander if no good food here
	if not predator_scent_detected and wolves.size() == 0 and boars.size() == 0 and energy > 40.0 and grass_density <= 0.3:
		mods["Walk"] = clampf(mods.get("Walk", 0.0) + 0.3, 0.0, 1.0)

	return mods

func _physics_process(delta: float) -> void:
	var sim: SimulationDirector = director
	_scent_query_timer -= delta
	if _scent_query_timer <= 0.0:
		_scent_query_timer = 0.3
		if sim != null:
			var nearby := sim.scent_network.query_nearby(global_position, 8.0)
			_cached_predator_scent = false
			for entry: Dictionary in nearby:
				# Only wolves and boars smell like danger.
				if entry["weight"] > 0.3 and entry.get("kind", "") == "predator":
					_cached_predator_scent = true
					break
	_food_query_timer -= delta
	if _food_query_timer <= 0.0:
		_food_query_timer = 0.25
		if sim != null:
			_cached_apple = sim.find_nearest_apple(global_position)
			_cached_mushroom = sim.find_nearest_mushroom(global_position)

	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	# Wounded sheep immediately bolt
	if _flee_boost_timer > 0.0 and _current_state != "Flee":
		set_state("Flee")
	_diet_boost -= delta
	if _diet_boost < 0.0:
		_diet_boost = 0.0
	# Overcrowding stress: ANY dense cluster kills sheep
	if sim != null:
		_local_cache_timer -= delta
		if _local_cache_timer <= 0.0:
			_local_cache_timer = 0.5
			_cached_local_count = sim.get_nearby_agents(global_position, 6.0, "sheep").size()
		var local_sheep: int = _cached_local_count
		if local_sheep > 16:
			var severity: float = float(local_sheep - 16) * 1.5
			health -= severity * delta
			energy -= severity * 0.4 * delta
		# Global overpopulation: kicks in much later
		var total_sheep: int = sim.get_sheep_count()
		if total_sheep > 150:
			var excess: float = (total_sheep - 150) / 100.0
			energy -= excess * 2.0 * delta
			if total_sheep > 250:
				var severe: float = (total_sheep - 250) / 100.0
				health -= severe * 4.0 * delta
				energy -= severe * 1.5 * delta
				if total_sheep > 150:
					var critical: float = (total_sheep - 150) / 50.0
					health -= critical * 15.0 * delta
					energy -= critical * 6.0 * delta

func _metabolise(delta: float) -> void:
	var rate := metabolism_rate * 0.5 if _juvenile_timer > 0.0 else metabolism_rate
	energy -= rate * delta
	if energy <= 0.0:
		health -= 6.0 * delta
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
		var total_count: int = sim.get_sheep_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -2.5  # almost instant reproduction when desperate
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown  # apply cooldown reduction
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 10.0, "sheep").size()
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
	for node in sim.get_nearby_agents(global_position, 8.0, "sheep"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_sheep: Sheep = node as Sheep
		if other_sheep.energy >= desperation_threshold and other_sheep._repro_cooldown <= 0.0 and other_sheep.sex != sex:
			energy -= desperation_cost
			other_sheep.energy -= desperation_cost * 0.5
			other_sheep._repro_cooldown = 5.0
			_repro_cooldown = 5.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.5
			sim.spawn_sheep_offspring(self, global_position + offset)
			return


func _on_enter_idle() -> void:
	velocity = Vector3.ZERO

func _on_tick_idle(_delta: float) -> void:
	pass

func _on_exit_idle() -> void:
	pass

func _on_enter_walk() -> void:
	var sim: SimulationDirector = director
	var dir := _compute_sheep_wander_dir(sim)
	velocity = dir * walk_speed

func _on_tick_walk(_delta: float) -> void:
	var sim: SimulationDirector = director
	var dir := _compute_sheep_wander_dir(sim)
	if dir != Vector3.ZERO:
		velocity = velocity.lerp(dir * walk_speed, 0.05)

func _compute_sheep_wander_dir(sim: SimulationDirector) -> Vector3:
	var dir := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized()
	if sim == null:
		return dir
	# Smart grass-seeking: scan 5x5 local grid for best tall grass
	if sim.grass != null:
		var g := sim.grass.world_to_grid(global_position)
		var best_density := -1.0
		var best_gx := g.x
		var best_gz := g.y
		for ox: int in range(-2, 3):
			for oz: int in range(-2, 3):
				var gx := clampi(g.x + ox, 0, sim.grass.grid_width - 1)
				var gz := clampi(g.y + oz, 0, sim.grass.grid_height - 1)
				var idx := gz * sim.grass.grid_width + gx
				var density: float = sim.grass._grid[idx]
				var stage: int = int(sim.grass._cell_stage[idx])
				var score := density * (2.0 if stage >= 2 else 1.0 if stage == 1 else 0.0)
				if score > best_density:
					best_density = score
					best_gx = gx
					best_gz = gz
		if best_density > 0.05:
			var best_pos := sim.grass.grid_to_world(best_gx, best_gz)
			dir += (best_pos - global_position).normalized() * 1.2
	# Flock with sheep
	dir += _cohesion_vector("sheep", 10.0, 0.6)
	return dir.normalized() if dir.length() > 0.0 else dir

func _on_exit_walk() -> void:
	pass

func _on_enter_graze() -> void:
	grazing_target = global_position
	velocity = Vector3.ZERO

func _on_tick_graze(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return

	# Eat apples first (premium food)
	var nearest_apple := _cached_apple
	if nearest_apple != null and is_instance_valid(nearest_apple) and global_position.distance_squared_to(nearest_apple.global_position) < 2.0:
		if nearest_apple.has_method("eat"):
			energy += nearest_apple.eat()
			energy = clampf(energy, 0.0, 100.0)
			_diet_boost = 10.0
			health += 5.0
			health = clampf(health, 0.0, 100.0)
			sim.try_plant_tree_seed(global_position, "sheep")
			FXManager.spawn_heal_particles(global_position)
			FXManager.show_floating_text(global_position + Vector3.UP, "+" + str(int(energy)), Color(0.3, 0.9, 0.3))
		return

	# Eat mushrooms
	var nearest_mushroom := _cached_mushroom
	if nearest_mushroom != null and is_instance_valid(nearest_mushroom) and global_position.distance_squared_to(nearest_mushroom.global_position) < 4.0:
		nearest_mushroom.die()
		energy += 25.0
		energy = clampf(energy, 0.0, 100.0)
		_diet_boost = 10.0
		return

	if sim.grass != null:
		var grass_density := sim.grass.edible_at_world(global_position)
		if grass_density < 0.05:
			set_state("Walk")
			return
		var consumed := sim.grass.consume_density(global_position, delta * graze_rate)
		if consumed > 0.0:
			energy += consumed * 12.0
			energy = clampf(energy, 0.0, 100.0)
			health += 1.0
			health = clampf(health, 0.0, 100.0)
			# Small diet boost from quality grass primes reproduction
			if consumed >= 0.005:
				_diet_boost = maxf(_diet_boost, 2.0)
				FXManager.spawn_graze_particles(global_position)
				FXManager.show_floating_text(global_position + Vector3.UP, "+" + str(int(consumed * 10.0)), Color(0.2, 0.8, 0.2))

func _on_exit_graze() -> void:
	pass

func _on_enter_flee() -> void:
	var emitter: ScentEmitter = get_node_or_null("ScentEmitter") as ScentEmitter
	if emitter != null:
		emitter.emit_scent(0.8)
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * get_flee_speed(flee_speed)

func _on_tick_flee(_delta: float) -> void:
	var threat: Node3D = null
	var vision: VisionCone = _vision_cone
	if vision != null:
		threat = vision.closest_visible("wolf")
		if threat == null:
			threat = vision.closest_visible("boar")
	if threat != null and is_instance_valid(threat):
		var away := (global_position - threat.global_position).normalized()
		velocity = away * get_flee_speed(flee_speed)
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
		sim.spawn_corpse(global_position, 0.8, "sheep")
		sim.agent_died.emit("sheep", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.95, 0.95, 0.95))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.6, 0.6, 0.6))
	FXManager.report_death("sheep")
	queue_free()

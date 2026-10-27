class_name Robin
extends MarkovAgent

@export var fly_speed: float = 5.0
@export var walk_speed: float = 2.5
@export var flee_speed: float = 5.5
@export var metabolism_rate: float = 0.8
@export var repro_threshold: float = 24.0
@export var repro_cost: float = 5.0

var health: float = 35.0
var damage: float = 5.0
var energy: float = 50.0
var _repro_cooldown: float = 0.0
var _is_grounded: bool = false
var _landing_target: Vector3 = Vector3.ZERO
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0
var _collision_shape: CollisionShape3D = null
var _mesh_body: MeshInstance3D = null
var _mesh_head: MeshInstance3D = null

func _ready() -> void:
	add_to_group("robin")
	_lifespan = Clock.lifespan("robin")
	_register_states()
	super._ready()
	set_state("Fly")
	_take_off()

func _register_states() -> void:
	_register_state("Fly", _on_enter_fly, _on_tick_fly, _on_exit_fly)
	_register_state("Land", _on_enter_land, _on_tick_land, _on_exit_land)
	_register_state("Forage", _on_enter_forage, _on_tick_forage, _on_exit_forage)
	_register_state("Flee", _on_enter_flee, _on_tick_flee, _on_exit_flee)
	_register_state("Mate", _on_enter_mate, _on_tick_mate, _on_exit_mate)
	_current_state = "Fly"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods

	var falcons := vision.get_visible_by_tag("falcon")
	var wolves := vision.get_visible_by_tag("wolf")
	var humans := vision.get_visible_by_tag("human")
	var boars := vision.get_visible_by_tag("boar")

	# A falcon circling far off is no reason to stop feeding; one close is.
	var falcon_close := false
	for f: Node3D in falcons:
		if is_instance_valid(f) and f.global_position.distance_squared_to(global_position) < 100.0:
			falcon_close = true
			break
	var threat_present := falcon_close or (_is_grounded and (wolves.size() > 0 or humans.size() > 0 or boars.size() > 0))

	if threat_present:
		mods["Flee"] = 1.0
	else:
		if _is_grounded:
			if energy < 20.0:
				mods["Forage"] = clampf(mods.get("Forage", 0.0) + 0.6, 0.0, 1.0)
			else:
				mods["Forage"] = clampf(mods.get("Forage", 0.0) + 0.3, 0.0, 1.0)
			if energy >= repro_threshold and _repro_cooldown <= 0.0:
				mods["Mate"] = clampf(mods.get("Mate", 0.0) + 0.4, 0.0, 1.0)
		else:
			if energy < 30.0:
				mods["Land"] = clampf(mods.get("Land", 0.0) + 0.5, 0.0, 1.0)
			else:
				mods["Fly"] = clampf(mods.get("Fly", 0.0) + 0.2, 0.0, 1.0)

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
			_cached_local_count = sim.get_nearby_agents(global_position, 6.0, "robin").size()
		var local_robins: int = _cached_local_count
		if local_robins > 10:
			health -= float(local_robins - 10) * 1.0 * delta
		var total_robins: int = sim.get_robin_count()
		if total_robins > 80:
			energy -= (total_robins - 80) / 40.0 * 1.5 * delta
	if health <= 0.0:
		die()
	# Keep altitude when flying, allow descent during landing
	if not _is_grounded and _current_state != "Land":
		if global_position.y < 2.0:
			global_position.y = 2.0 + randf() * 1.5
		elif global_position.y > 10.0:
			global_position.y = 10.0 - randf() * 1.5

func _metabolise(delta: float) -> void:
	energy -= metabolism_rate * delta
	if energy <= 0.0:
		health -= 6.0 * delta
		energy = 0.0

func _take_off() -> void:
	_is_grounded = false
	_aerial = true
	if _collision_shape != null:
		_collision_shape.disabled = true

func _land_at(target_pos: Vector3) -> void:
	_landing_target = target_pos
	_is_grounded = false
	_aerial = true

func _finish_landing() -> void:
	_is_grounded = true
	_aerial = false
	if _collision_shape != null:
		_collision_shape.disabled = false
	var sim: SimulationDirector = director
	global_position.y = 0.0 if sim == null else sim.ground_height(global_position.x, global_position.z)

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
		var total_count: int = sim.get_robin_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -1.0
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 10.0, "robin").size()
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
	for node in sim.get_nearby_agents(global_position, 6.0, "robin"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_robin: Robin = node as Robin
		if other_robin.energy >= desperation_threshold and other_robin._repro_cooldown <= 0.0 and other_robin.sex != sex:
			energy -= desperation_cost
			other_robin.energy -= desperation_cost * 0.5
			other_robin._repro_cooldown = 1.5
			_repro_cooldown = 1.5
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.5
			sim.spawn_robin_offspring(self, global_position + offset)
			return

func _on_enter_fly() -> void:
	_take_off()
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * fly_speed

func _on_tick_fly(_delta: float) -> void:
	# Random wandering flight, turning home once out over the slopes.
	var out: float = Vector2(global_position.x, global_position.z).length()
	if out > ValleyTerrain.FLOOR_RADIUS + 2.0:
		velocity = Vector3(-global_position.x, 0.0, -global_position.z).normalized() * fly_speed
		return
	if randf() < 0.02:
		velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * fly_speed
	# Flock with robins
	var cohesion := _cohesion_vector("robin", 10.0, 0.4)
	if cohesion != Vector3.ZERO:
		velocity = velocity.lerp(velocity.normalized() * fly_speed + cohesion, 0.05)

func _on_exit_fly() -> void:
	pass

func _on_enter_land() -> void:
	var sim: SimulationDirector = director
	var target := Vector3.ZERO
	if sim != null:
		var worms := sim.get_nearby_agents(global_position, 12.0, "worm")
		var best: Node3D = null
		var best_dist: float = 10000.0
		for w in worms:
			if not is_instance_valid(w):
				continue
			var d: float = global_position.distance_squared_to(w.global_position)
			if d < best_dist:
				best_dist = d
				best = w
		if best != null:
			target = best.global_position
	if target == Vector3.ZERO:
		target = global_position + Vector3((randf() - 0.5) * 8.0, 0.0, (randf() - 0.5) * 8.0)
	# Robins come down on the meadow, not up on the rocks.
	var flat := Vector2(target.x, target.z)
	if flat.length() > ValleyTerrain.FLOOR_RADIUS:
		flat = flat.normalized() * (ValleyTerrain.FLOOR_RADIUS - 2.0)
		target = Vector3(flat.x, target.y, flat.y)
	_land_at(target)

func _on_tick_land(_delta: float) -> void:
	if _landing_target != Vector3.ZERO:
		var dir := (_landing_target - global_position).normalized()
		velocity = dir * fly_speed
		if global_position.distance_to(_landing_target) < 1.5 and not _is_grounded:
			_finish_landing()
			_landing_target = Vector3.ZERO
			set_state("Forage")

func _on_exit_land() -> void:
	_landing_target = Vector3.ZERO

func _on_enter_forage() -> void:
	velocity = Vector3.ZERO

func _on_tick_forage(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	# Eat worms
	var worms := sim.get_nearby_agents(global_position, 2.0, "worm")
	for w in worms:
		if not is_instance_valid(w):
			continue
		if w.global_position.distance_to(global_position) <= 1.0:
			if w.has_method("die"):
				w.die()
			else:
				w.queue_free()
			energy += 12.0
			health += 5.0
			health = clampf(health, 0.0, 100.0)
			energy = clampf(energy, 0.0, 100.0)
			return
	# Berries are a robin's favourite fruit.
	var berry := sim.find_nearest_berry(global_position, 2.5)
	if berry != null and berry.has_method("eat") and global_position.distance_squared_to(berry.global_position) < 2.0:
		energy = clampf(energy + berry.eat(self), 0.0, 100.0)
		health = clampf(health + 3.0, 0.0, 100.0)
		return
	# Eat apples
	var trees_node := sim.get_node_or_null("Trees")
	if trees_node != null:
		var nearest_apple = null
		var best_dist_sq := 9.0
		for child in trees_node.get_children():
			if not child is Node3D:
				continue
			var n3d := child as Node3D
			for sub in n3d.get_children():
				if not is_instance_valid(sub):
					continue
				if sub.is_in_group("apple"):
					var d_sq := global_position.distance_squared_to(sub.global_position)
					if d_sq < best_dist_sq:
						best_dist_sq = d_sq
						nearest_apple = sub
		if nearest_apple != null and best_dist_sq < 2.0 and nearest_apple.has_method("eat"):
			energy += nearest_apple.eat(self)
			energy = clampf(energy, 0.0, 100.0)
			health += 3.0
			health = clampf(health, 0.0, 100.0)
			return
	# Eat mushrooms
	var nearest_mushroom := sim.find_nearest_mushroom(global_position)
	if nearest_mushroom != null and global_position.distance_squared_to(nearest_mushroom.global_position) < 2.25:
		devour(nearest_mushroom)
		energy += 8.0
		energy = clampf(energy, 0.0, 100.0)
		return
	# Eat grass
	if sim.grass != null:
		var consumed := sim.grass.consume_density(global_position, delta * 0.5, self)
		if consumed > 0.0:
			energy += consumed * 8.0
			energy = clampf(energy, 0.0, 100.0)
			health += 2.0
			health = clampf(health, 0.0, 100.0)
			return
	# Last resort: a clumsy grab at a fish in the shallows. Robins are poor
	# fishers next to falcons, so most tries miss, and they try only hungry.
	if energy < 35.0 and randf() < 0.4 and sim.try_eat_fish(global_position, 2.5):
		energy = clampf(energy + 14.0, 0.0, 100.0)
		return
	# If nothing here, take off
	if energy > 25.0:
		set_state("Fly")

func _on_exit_forage() -> void:
	pass

func _on_enter_flee() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * get_flee_speed(flee_speed)

func _on_tick_flee(_delta: float) -> void:
	var vision: VisionCone = _vision_cone
	var threat: Node3D = null
	if vision != null:
		threat = vision.closest_visible("falcon")
		if threat == null:
			threat = vision.closest_visible("wolf")
		if threat == null:
			threat = vision.closest_visible("human")
		if threat == null:
			threat = vision.closest_visible("boar")
	if threat != null and is_instance_valid(threat):
		var away := (global_position - threat.global_position).normalized()
		velocity = away * get_flee_speed(flee_speed)
		if _is_grounded and threat.is_in_group("falcon"):
			_take_off()
	else:
		if velocity.length() < flee_speed:
			velocity = velocity.normalized() * flee_speed

func _on_exit_flee() -> void:
	pass

func _on_enter_mate() -> void:
	velocity = Vector3.ZERO

func _on_tick_mate(_delta: float) -> void:
	pass

func _on_exit_mate() -> void:
	pass

func die() -> void:
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 0.5, "robin", golden)
		sim.agent_died.emit("robin", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.9, 0.2, 0.2))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.6, 0.8, 1.0))
	FXManager.report_death("robin")
	queue_free()

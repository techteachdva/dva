class_name Wolf
extends MarkovAgent

@export var chase_speed: float = 6.0
@export var wander_speed: float = 2.5
@export var eat_heal_rate: float = 5.0
@export var metabolism_rate: float = 0.9
@export var repro_threshold: float = 32.0
@export var repro_cost: float = 18.0

var health: float = 80.0
var damage: float = 25.0
var energy: float = 60.0
var _eat_timer: float = 0.0
# Carcass energy one mouthful takes (a carcass holds 0.2-1.5).
const CORPSE_BITE: float = 0.6
var _repro_cooldown: float = 0.0
var _kill_spawn_cooldown: float = 0.0
var _waypoints: Array = []
var _waypoint_index: int = 0
var _pack_cache_timer: float = 0.0
var _cached_pack_mult: float = 1.0

func _ready() -> void:
	add_to_group("wolf")
	_register_states()
	super._ready()
	_lifespan = Clock.lifespan("wolf")
	set_state("Wander")

func _register_states() -> void:
	_register_state("Wander", _on_enter_wander, _on_tick_wander, _on_exit_wander)
	_register_state("Chase", _on_enter_chase, _on_tick_chase, _on_exit_chase)
	_register_state("Sleep", _on_enter_sleep, _on_tick_sleep, _on_exit_sleep)
	_register_state("Eat", _on_enter_eat, _on_tick_eat, _on_exit_eat)
	_register_state("Flee", _on_enter_flee, _on_tick_flee, _on_exit_flee)
	_register_state("Scavenge", _on_enter_scavenge, _on_tick_scavenge, _on_exit_scavenge)
	_current_state = "Wander"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}

	var emitter: ScentEmitter = get_node_or_null("ScentEmitter") as ScentEmitter
	if emitter != null:
		emitter.emit_scent(1.0)

	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods

	var sim: SimulationDirector = director

	var sheep := vision.get_visible_by_tag("sheep")
	var humans := vision.get_visible_by_tag("human")
	var exposed_humans: Array[Node3D] = []
	if sim != null:
		for h: Node3D in humans:
			if not is_instance_valid(h):
				continue
			if not sim.is_position_in_shelter(h.global_position):
				exposed_humans.append(h)

	var robins := vision.get_visible_by_tag("robin")
	var exposed_robins: Array[Node3D] = []
	for r: Node3D in robins:
		if not is_instance_valid(r):
			continue
		var is_grounded = r.get("_is_grounded")
		if is_grounded != null and is_grounded == true:
			exposed_robins.append(r)

	var boars := vision.get_visible_by_tag("boar")
	var total_sheep: int = sim.get_sheep_count() if sim != null else 0

	var rabbits := vision.get_visible_by_tag("rabbit")
	# Deer and goats count as big game alongside rabbits.
	if not EraBook.lost():
		rabbits.append_array(vision.get_visible_by_tag("deer"))
	rabbits.append_array(vision.get_visible_by_tag("goat"))
	# Mice are a snack between bigger meals.
	rabbits.append_array(vision.get_visible_by_tag("mouse"))
	if sheep.size() > 0:
		if true or total_sheep > 0:
			mods["Chase"] = 1.0  # instant interrupt: hungry wolves pounce immediately
			mods["Wander"] = 0.0
			mods["Sleep"] = 0.0
		else:
			mods["Chase"] = clampf(mods.get("Chase", 0.0) + 0.5, 0.0, 1.0)
	elif rabbits.size() > 0 and energy < 70.0:
		mods["Chase"] = 0.85
	elif sim != null and sim.find_nearest_fish(global_position, 14.0) != null:
		mods["Chase"] = 0.75
	elif exposed_robins.size() > 0 or boars.size() > 0:
		mods["Chase"] = clampf(mods.get("Chase", 0.0) + 0.85, 0.0, 1.0)
	elif exposed_humans.size() > 0:
		var human_count := 0
		if sim != null:
			for h: Node3D in sim.get_nearby_agents(global_position, 5.0, "human"):
				if not sim.is_position_in_shelter(h.global_position):
					human_count += 1
		if human_count >= 2:
			mods["Flee"] = clampf(mods.get("Flee", 0.0) + 0.4, 0.0, 1.0)
		else:
			mods["Chase"] = clampf(mods.get("Chase", 0.0) + 0.2, 0.0, 1.0)
	else:
		if energy < 35.0:
			mods["Chase"] = clampf(mods.get("Chase", 0.0) + 0.3, 0.0, 1.0)
		elif energy < 25.0:
			mods["Sleep"] = clampf(mods.get("Sleep", 0.0) + 0.5, 0.0, 1.0)

	# Desperate scavenging when starving and no prey
	if energy < 20.0 and mods.get("Chase", 0.0) < 0.5:
		mods["Scavenge"] = 0.85

	return mods

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	_kill_spawn_cooldown -= delta
	_pack_cache_timer -= delta

func _metabolise(delta: float) -> void:
	energy -= metabolism_rate * delta
	if energy <= 0.0:
		health -= 8.0 * delta
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
		var total_count: int = sim.get_wolf_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -2.5
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown  # apply cooldown reduction
	# No hard carrying capacity — populations free to boom and bust
	var count := sim.get_nearby_agents(global_position, 10.0, "wolf").size()
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
	for node in sim.get_nearby_agents(global_position, 8.0, "wolf"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_wolf: Wolf = node as Wolf
		if other_wolf.energy >= desperation_threshold and other_wolf._repro_cooldown <= 0.0 and other_wolf.sex != sex:
			energy -= desperation_cost
			other_wolf.energy -= desperation_cost * 0.5
			other_wolf._repro_cooldown = 3.0
			_repro_cooldown = 3.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.5
			sim.spawn_wolf_offspring(self, global_position + offset)
			return

func _on_enter_wander() -> void:
	_generate_triangle_waypoints()
	_velocity_to_next_waypoint()

func _generate_triangle_waypoints() -> void:
	var size: float = 8.0 + randf() * 12.0
	var center := global_position
	_waypoints = [
		center + Vector3(size, 0.0, 0.0),
		center + Vector3(-size * 0.5, 0.0, size * 0.866),
		center + Vector3(-size * 0.5, 0.0, -size * 0.866),
	]
	_waypoint_index = 0

func _velocity_to_next_waypoint() -> void:
	if _waypoints.size() == 0:
		velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * wander_speed
		return
	var target: Vector3 = _waypoints[_waypoint_index]
	var dir := (target - global_position).normalized()
	var pack_mult: float = _get_pack_multiplier()
	velocity = dir * wander_speed * pack_mult

func _on_tick_wander(_delta: float) -> void:
	if _waypoints.size() > 0:
		var target: Vector3 = _waypoints[_waypoint_index]
		if global_position.distance_to(target) < 1.5:
			_waypoint_index = (_waypoint_index + 1) % _waypoints.size()
			_velocity_to_next_waypoint()
	# Flocking with wolves — strong pack cohesion
	var cohesion := _cohesion_vector("wolf", 15.0, 0.8)
	if cohesion != Vector3.ZERO:
		velocity = velocity.lerp(velocity.normalized() * wander_speed + cohesion, 0.08)

func _on_exit_wander() -> void:
	_waypoints.clear()

func _on_enter_chase() -> void:
	pass

func _on_tick_chase(delta: float) -> void:
	var vision: VisionCone = _vision_cone
	var sim: SimulationDirector = director
	var target: Node3D = null
	# Vision cone first
	if vision != null:
		var sheep_list := vision.get_visible_by_tag("sheep")
		var rabbit_list := vision.get_visible_by_tag("rabbit")
		if not EraBook.lost():
			rabbit_list.append_array(vision.get_visible_by_tag("deer"))
		rabbit_list.append_array(vision.get_visible_by_tag("goat"))
		if sheep_list.size() > 0 and is_instance_valid(sheep_list[0]):
			target = sheep_list[0]
		elif rabbit_list.size() > 0 and is_instance_valid(rabbit_list[0]):
			target = rabbit_list[0]
		else:
			var robin_list := vision.get_visible_by_tag("robin")
			for r: Node3D in robin_list:
				if not is_instance_valid(r):
					continue
				var is_grounded = r.get("_is_grounded")
				if is_grounded != null and is_grounded == true:
					target = r
					break
			if target == null:
				var boar_list := vision.get_visible_by_tag("boar")
				if boar_list.size() > 0 and is_instance_valid(boar_list[0]):
					target = boar_list[0]
			if target == null:
				var human_list := vision.get_visible_by_tag("human")
				for h: Node3D in human_list:
					if not is_instance_valid(h):
						continue
					if sim == null or not sim.is_position_in_shelter(h.global_position):
						target = h
						break
	# Spatial hash fallback for sheep when vision fails
	if target == null and sim != null:
		target = sim.find_nearest_fish(global_position, 10.0)
	if target == null and sim != null:
		var nearby_sheep := sim.get_nearby_agents(global_position, 20.0, "sheep")
		var best_dist := INF
		for s: Node3D in nearby_sheep:
			if not is_instance_valid(s):
				continue
			var d := global_position.distance_squared_to(s.global_position)
			if d < best_dist:
				best_dist = d
				target = s
	if target != null and is_instance_valid(target):
		var dir := (target.global_position - global_position).normalized()
		velocity = dir * chase_speed * _get_pack_multiplier()
		var bite: float = 2.2 if target.is_in_group("fish") else 1.2
		if global_position.distance_to(target.global_position) < bite and target is MarkovAgent:
			if CombatSystem.resolve_attack(self, target as MarkovAgent):
				FXManager.spawn_combat_particles(global_position)
				# Energy comes from eating, not the kill itself
				if target.has_method("die"):
					target.die()
				set_state("Eat")
	else:
		velocity = velocity.move_toward(Vector3.ZERO, delta * 2.0)

func _on_exit_chase() -> void:
	pass

func _on_enter_sleep() -> void:
	velocity = Vector3.ZERO

func _on_tick_sleep(delta: float) -> void:
	# Sleep slows hunger; it doesn't feed a wolf. Only meat does.
	energy += metabolism_rate * 0.5 * delta
	energy = clampf(energy, 0.0, 100.0)
	if energy >= 50.0:
		set_state("Wander")

func _on_exit_sleep() -> void:
	pass

func _on_enter_eat() -> void:
	_eat_timer = 8.0
	velocity = Vector3.ZERO

func _on_tick_eat(delta: float) -> void:
	_eat_timer -= delta
	var sim: SimulationDirector = director
	if sim != null:
		for child in sim.get_node("Corpses").get_children():
			if not is_instance_valid(child) or not child is Node3D:
				continue
			var n3d := child as Node3D
			if n3d.has_method("scavenge") and n3d.can_scavenge() and n3d.global_position.distance_to(global_position) <= 2.0:
				# A full bite is the old whole-carcass meal; scraps give less.
				var bite: float = clampf(n3d.scavenge(CORPSE_BITE, self) / CORPSE_BITE, 0.0, 1.0)
				health += eat_heal_rate * 4.0 * bite
				health = clampf(health, 0.0, 100.0)
				energy += 30.0 * bite
				energy = clampf(energy, 0.0, 100.0)
				FXManager.spawn_heal_particles(global_position)
				FXManager.show_floating_text(global_position + Vector3.UP, "+" + str(int(energy)), Color(0.3, 0.9, 0.3))
				break
	if _eat_timer <= 0.0:
		set_state("Wander")

func _on_exit_eat() -> void:
	pass

func _on_enter_flee() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * chase_speed

func _on_tick_flee(_delta: float) -> void:
	var vision: VisionCone = _vision_cone
	if vision != null:
		var threat: Node3D = vision.closest_visible("human")
		if threat != null and is_instance_valid(threat):
			var away := (global_position - threat.global_position).normalized()
			velocity = away * chase_speed

func _on_exit_flee() -> void:
	pass

func _on_enter_scavenge() -> void:
	velocity = Vector3.ZERO

func _on_tick_scavenge(_delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		set_state("Wander")
		return
	# Search for corpses first
	var nearest_corpse: Node3D = null
	var best_dist: float = 25.0
	for child in sim.get_node("Corpses").get_children():
		if not is_instance_valid(child) or not child is Node3D:
			continue
		var n3d := child as Node3D
		# Picked-over carcasses are left to the decomposers.
		if not n3d.has_method("scavenge") or not n3d.can_scavenge():
			continue
		var d: float = global_position.distance_to(n3d.global_position)
		if d < best_dist:
			best_dist = d
			nearest_corpse = n3d
	if nearest_corpse != null:
		if best_dist < 2.0:
			var bite: float = clampf(nearest_corpse.scavenge(CORPSE_BITE, self) / CORPSE_BITE, 0.0, 1.0)
			energy += 15.0 * bite
			energy = clampf(energy, 0.0, 100.0)
			health += 5.0 * bite
			health = clampf(health, 0.0, 100.0)
			if energy >= 30.0:
				set_state("Wander")
			return
		else:
			var dir := (nearest_corpse.global_position - global_position).normalized()
			velocity = dir * wander_speed
			return
	# No corpses: search for worms
	var nearest_worm: Node3D = sim.find_nearest_worm(global_position)
	if nearest_worm != null and global_position.distance_to(nearest_worm.global_position) < 15.0:
		if global_position.distance_to(nearest_worm.global_position) < 1.5:
			if nearest_worm.has_method("die"):
				devour(nearest_worm)
			else:
				nearest_worm.queue_free()
			energy += 8.0
			energy = clampf(energy, 0.0, 100.0)
			if energy >= 25.0:
				set_state("Wander")
			return
		else:
			var dir := (nearest_worm.global_position - global_position).normalized()
			velocity = dir * wander_speed
			return
	# Nothing found: drift randomly
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * wander_speed

func _on_exit_scavenge() -> void:
	pass

func _get_pack_multiplier() -> float:
	if _pack_cache_timer > 0.0:
		return _cached_pack_mult
	var sim: SimulationDirector = director
	if sim == null:
		return 1.0
	var pack: int = sim.wolf_pack_size_check(self)
	if pack >= 2:
		_cached_pack_mult = 1.3
	elif pack >= 1:
		_cached_pack_mult = 1.15
	else:
		_cached_pack_mult = 1.0
	return _cached_pack_mult

func die() -> void:
	if gold_shield():
		return
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 1.2, "wolf", golden)
		sim.agent_died.emit("wolf", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.8, 0.1, 0.1))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.9, 0.3, 0.3))
	FXManager.report_death("wolf")
	queue_free()

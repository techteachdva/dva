class_name Boar
extends MarkovAgent

@export var walk_speed: float = 3.0
@export var charge_speed: float = 6.0
@export var flee_speed: float = 5.0
@export var metabolism_rate: float = 1.3
@export var repro_threshold: float = 28.0
@export var repro_cost: float = 16.0

var health: float = 90.0
var damage: float = 25.0
var energy: float = 70.0
var _repro_cooldown: float = 0.0
var _charge_target: Node3D = null
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0

func _ready() -> void:
	add_to_group("boar")
	_register_states()
	super._ready()
	_lifespan = Clock.lifespan("boar")
	set_state("Forage")

func _register_states() -> void:
	_register_state("Forage", _on_enter_forage, _on_tick_forage, _on_exit_forage)
	_register_state("Group", _on_enter_group, _on_tick_group, _on_exit_group)
	_register_state("Charge", _on_enter_charge, _on_tick_charge, _on_exit_charge)
	_register_state("Flee", _on_enter_flee, _on_tick_flee, _on_exit_flee)
	_current_state = "Forage"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods

	var wolves := vision.get_visible_by_tag("wolf")
	var humans := vision.get_visible_by_tag("human")

	var sim: SimulationDirector = director
	var nearby_boars: int = 0
	var nearby_humans: int = 0
	if sim != null:
		nearby_boars = sim.get_presence_count(global_position, 8.0, "boar") - 1
		nearby_humans = sim.get_presence_count(global_position, 8.0, "human")

	if wolves.size() > 0:
		if nearby_boars >= 2:
			mods["Charge"] = clampf(mods.get("Charge", 0.0) + 0.6, 0.0, 1.0)
		else:
			mods["Flee"] = clampf(mods.get("Flee", 0.0) + 0.7, 0.0, 1.0)
	elif humans.size() > 0:
		# Defensive charge: only attack small human groups when in large boar pack
		if nearby_boars >= 4 and nearby_humans <= 2:
			mods["Charge"] = clampf(mods.get("Charge", 0.0) + 0.5, 0.0, 1.0)
		elif nearby_boars >= 2:
			mods["Group"] = clampf(mods.get("Group", 0.0) + 0.4, 0.0, 1.0)
		else:
			mods["Flee"] = clampf(mods.get("Flee", 0.0) + 0.5, 0.0, 1.0)
	else:
		# Hungry boars run down small game: rabbits in the open.
		if energy < 45.0 and not vision.get_visible_by_tag("rabbit").is_empty():
			mods["Charge"] = 0.6
		elif energy < 25.0:
			mods["Forage"] = clampf(mods.get("Forage", 0.0) + 0.5, 0.0, 1.0)
		else:
			mods["Group"] = clampf(mods.get("Group", 0.0) + 0.3, 0.0, 1.0)

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
			_cached_local_count = sim.get_nearby_agents(global_position, 7.0, "boar").size()
		var local_boars: int = _cached_local_count
		if local_boars > 10:
			health -= float(local_boars - 10) * 0.9 * delta
		var total_boars: int = sim.get_boar_count()
		if total_boars > 40:
			energy -= (total_boars - 40) / 40.0 * 1.5 * delta
			if total_boars > 120:
				health -= (total_boars - 120) / 40.0 * 3.0 * delta
	if health <= 0.0:
		die()

func _metabolise(delta: float) -> void:
	energy -= metabolism_rate * delta
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
		var total_count: int = sim.get_boar_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -1.0
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 10.0, "boar").size()
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
	for node in sim.get_nearby_agents(global_position, 8.0, "boar"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_boar: Boar = node as Boar
		if other_boar.energy >= desperation_threshold and other_boar._repro_cooldown <= 0.0 and other_boar.sex != sex:
			energy -= desperation_cost
			other_boar.energy -= desperation_cost * 0.5
			other_boar._repro_cooldown = 3.0
			_repro_cooldown = 3.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.5
			sim.spawn_boar_offspring(self, global_position + offset)
			return

func _on_enter_forage() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed

func _on_tick_forage(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	# Opportunistic mushroom munch
	var near_mushroom := sim.find_nearest_mushroom(global_position, 3.0)
	if near_mushroom != null and global_position.distance_squared_to(near_mushroom.global_position) < 2.25:
		devour(near_mushroom)
		energy += 25.0
		energy = clampf(energy, 0.0, 100.0)
		velocity = Vector3.ZERO
		return
	# Eat apples
	var nearest_apple := sim.find_nearest_apple(global_position)
	if nearest_apple != null and global_position.distance_squared_to(nearest_apple.global_position) < 2.0 and nearest_apple.has_method("eat"):
		energy += nearest_apple.eat(self)
		energy = clampf(energy, 0.0, 100.0)
		sim.try_plant_tree_seed(global_position, "boar")
		velocity = Vector3.ZERO
		return
	# Eat mushrooms
	var nearest_mushroom := sim.find_nearest_mushroom(global_position)
	if nearest_mushroom != null and global_position.distance_squared_to(nearest_mushroom.global_position) < 2.0:
		devour(nearest_mushroom)
		energy += 25.0
		energy = clampf(energy, 0.0, 100.0)
		velocity = Vector3.ZERO
		return
	# Eat worms
	var nearest_worm := sim.find_nearest_worm(global_position)
	if nearest_worm != null and global_position.distance_to(nearest_worm.global_position) <= 1.5:
		if nearest_worm.has_method("die"):
			devour(nearest_worm)
		else:
			nearest_worm.queue_free()
		energy += 10.0
		energy = clampf(energy, 0.0, 100.0)
		velocity = Vector3.ZERO
		return
	# Berries, and the moss on the trunks.
	var browsed: float = sim.browse(self, delta)
	if browsed > 0.0:
		energy = clampf(energy + browsed, 0.0, 100.0)
		velocity = Vector3.ZERO
		return
	# A hungry boar wades into the shallows after fish.
	if energy < 50.0:
		if sim.try_eat_fish(global_position, 2.2):
			energy = clampf(energy + 15.0, 0.0, 100.0)
			velocity = Vector3.ZERO
			return
		var fish := sim.find_nearest_fish(global_position, 8.0)
		if fish != null:
			velocity = (fish.global_position - global_position).normalized() * walk_speed
			return
	# Eat grass
	if sim.grass != null:
		var consumed := sim.grass.consume_density(global_position, delta * 0.6, self)
		if consumed > 0.0:
			energy += consumed * 12.0 * sim.producer_value("grass")
			energy = clampf(energy, 0.0, 100.0)
			velocity = Vector3.ZERO
			return
		# Seek denser grass
		var g_pos := sim.grass.grid_to_world(
			int(clamp(sim.grass.world_to_grid(global_position).x + (randi() % 7 - 3), 0, sim.grass.grid_width - 1)),
			int(clamp(sim.grass.world_to_grid(global_position).y + (randi() % 7 - 3), 0, sim.grass.grid_height - 1))
		)
		var g_density := sim.grass.get_density_at_world(g_pos)
		if g_density > 0.2:
			var dir := (g_pos - global_position).normalized()
			velocity = dir * walk_speed
			return
	velocity = velocity.move_toward(Vector3.ZERO, delta * 1.0)

func _on_exit_forage() -> void:
	pass

func _on_enter_group() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed

func _on_tick_group(_delta: float) -> void:
	var cohesion := _cohesion_vector("boar", 12.0, 0.5)
	if cohesion != Vector3.ZERO:
		velocity = cohesion.normalized() * walk_speed
	else:
		velocity = velocity.normalized() * walk_speed

func _on_exit_group() -> void:
	pass

func _on_enter_charge() -> void:
	_charge_target = null
	var vision: VisionCone = _vision_cone
	if vision == null:
		return
	var wolves := vision.get_visible_by_tag("wolf")
	var humans := vision.get_visible_by_tag("human")
	if wolves.size() > 0 and is_instance_valid(wolves[0]):
		_charge_target = wolves[0]
	elif humans.size() > 0 and is_instance_valid(humans[0]):
		_charge_target = humans[0]
	else:
		_charge_target = vision.closest_visible("rabbit")

func _on_tick_charge(delta: float) -> void:
	if _charge_target != null and is_instance_valid(_charge_target):
		var dir := (_charge_target.global_position - global_position).normalized()
		velocity = dir * charge_speed
		if global_position.distance_to(_charge_target.global_position) < 2.0 and _charge_target is MarkovAgent:
			if CombatSystem.resolve_attack(self, _charge_target as MarkovAgent):
				FXManager.spawn_combat_particles(global_position)
				# Defensive attacks on humans yield no energy; predatory attacks on wolves do
				if not _charge_target.is_in_group("human"):
					energy += 20.0
					energy = clampf(energy, 0.0, 100.0)
				set_state("Forage")
	else:
		velocity = velocity.move_toward(Vector3.ZERO, delta * 2.0)

func _on_exit_charge() -> void:
	_charge_target = null

func _on_enter_flee() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * flee_speed

func _on_tick_flee(_delta: float) -> void:
	var vision: VisionCone = _vision_cone
	var threat: Node3D = null
	if vision != null:
		threat = vision.closest_visible("wolf")
		if threat == null:
			threat = vision.closest_visible("human")
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
		sim.spawn_corpse(global_position, 1.5, "boar", golden)
		sim.agent_died.emit("boar", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.5, 0.3, 0.2))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.8, 0.6, 0.4))
	FXManager.report_death("boar")
	queue_free()

class_name Worm
extends MarkovAgent

@export var crawl_speed: float = 1.0
@export var metabolism_rate: float = 0.3
@export var repro_threshold: float = 12.0
@export var repro_cost: float = 4.0

var health: float = 10.0
var energy: float = 20.0
var _repro_cooldown: float = 0.0
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0
var _water: Dictionary = {}
var _water_timer: float = 0.0

func _ready() -> void:
	add_to_group("worm")
	_lifespan = Clock.lifespan("worm")
	_register_states()
	super._ready()
	set_state("Crawl")

func _register_states() -> void:
	_register_state("Crawl", _on_enter_crawl, _on_tick_crawl, _on_exit_crawl)
	_register_state("Eat", _on_enter_eat, _on_tick_eat, _on_exit_eat)
	_current_state = "Crawl"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var sim: SimulationDirector = director
	if sim == null:
		return mods
	var spore_near := false
	for node in sim.get_nearby_agents(global_position, 3.0, "mushroom"):
		if not is_instance_valid(node):
			continue
		spore_near = true
		break
	if spore_near:
		mods["Eat"] = clampf(mods.get("Eat", 0.0) + 0.7, 0.0, 1.0)
	else:
		mods["Crawl"] = clampf(mods.get("Crawl", 0.0) + 0.2, 0.0, 1.0)
	return mods

func _physics_process(delta: float) -> void:
	# The base tick already runs transitions, metabolism and reproduction.
	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	var sim: SimulationDirector = director
	if sim != null:
		# Worms in a mycelium mat feed from it.
		if sim.mycelium != null:
			var myc: float = sim.mycelium.get_density_at_world(global_position)
			if myc > 0.05:
				energy = minf(energy + myc * 3.0 * delta, 100.0)
				health = minf(health + myc * 1.0 * delta, 20.0)
		_local_cache_timer -= delta
		if _local_cache_timer <= 0.0:
			_local_cache_timer = 0.5
			_cached_local_count = sim.get_nearby_agents(global_position, 5.0, "worm").size()
		var local_worms: int = _cached_local_count
		if local_worms > 10:
			health -= float(local_worms - 10) * 0.6 * delta
		var total_worms: int = sim.get_worm_count()
		if total_worms > 100:
			energy -= (total_worms - 100) / 50.0 * 1.0 * delta
	if health <= 0.0:
		die()

func _metabolise(delta: float) -> void:
	energy -= metabolism_rate * delta
	if energy <= 0.0:
		health -= 3.0 * delta
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
		var total_count: int = sim.get_worm_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -2.0
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 10.0, "worm").size()
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
	for node in sim.get_nearby_agents(global_position, 5.0, "worm"):
		if node == self or not is_instance_valid(node):
			continue
		if not node is Node3D:
			continue
		var other_worm: Worm = node as Worm
		if other_worm.energy >= desperation_threshold and other_worm._repro_cooldown <= 0.0 and other_worm.sex != sex:
			energy -= desperation_cost
			other_worm.energy -= desperation_cost * 0.5
			other_worm._repro_cooldown = 4.0
			_repro_cooldown = 4.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.0
			sim.spawn_worm_offspring(self, global_position + offset)
			return

func _on_enter_crawl() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * crawl_speed

func _on_tick_crawl(_delta: float) -> void:
	# Slow random drift with bias toward corpses and mushrooms
	var sim: SimulationDirector = director
	var seek := Vector3.ZERO
	if sim != null:
		# Worms smell carrion from far off and crawl to it.
		var nearest_corpse := sim.smell_corpse(global_position)
		if nearest_corpse != null:
			var best_dist := global_position.distance_squared_to(nearest_corpse.global_position)
			if best_dist < 100.0:
				seek = (nearest_corpse.global_position - global_position).normalized() * crawl_speed * 0.5
			else:
				seek = (nearest_corpse.global_position - global_position).normalized() * crawl_speed * 0.2
			# Proliferate around corpses
			if best_dist < 16.0 and randf() < 0.05:
				var nearby_count := sim.get_nearby_agents(global_position, 10.0, "worm").size()
				var allow := false
				if nearby_count <= 4:
					allow = true
				elif nearby_count <= 9:
					allow = randf() <= 0.5
				elif nearby_count <= 16:
					allow = randf() <= 0.2
				if allow:
					var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.0
					sim.spawn_worm_offspring(self, global_position + offset)
	if sim != null and sim.valley != null and sim.valley.river != null:
		# Worms crawl about a metre a second, so the nearest bank only needs
		# re-finding a couple of times a second.
		_water_timer -= _delta
		if _water_timer <= 0.0 or _water.is_empty():
			_water_timer = 0.4
			_water = sim.valley.river.sample(global_position.x, global_position.z)
		var water: Dictionary = _water
		var dist: float = float(water.distance)
		if dist < 14.0:
			var bank: Vector3 = water.closest
			var pull := (bank - global_position)
			pull.y = 0.0
			if pull.length_squared() > 0.01:
				var strength: float = 0.35 if dist > sim.valley.river.half_width() else 0.15
				velocity = velocity.lerp(pull.normalized() * crawl_speed, strength)
			if water.in_water:
				velocity *= 0.45
	if seek != Vector3.ZERO:
		velocity = velocity.lerp(seek, 0.1)
	if randf() < 0.05:
		velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * crawl_speed

func _on_exit_crawl() -> void:
	pass

func _on_enter_eat() -> void:
	velocity = Vector3.ZERO

func _on_tick_eat(_delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	var ate := false
	# Eat mushroom spores
	var nearest_mushroom := sim.find_nearest_mushroom(global_position, 3.0)
	if nearest_mushroom != null and global_position.distance_squared_to(nearest_mushroom.global_position) < 2.25:
		devour(nearest_mushroom)
		energy += 15.0
		energy = clampf(energy, 0.0, 100.0)
		ate = true
	# Eat corpses directly
	if not ate:
		var nearest_corpse := sim.find_nearest_corpse(global_position, 3.0)
		if nearest_corpse != null and nearest_corpse.has_method("absorb_energy") and nearest_corpse.global_position.distance_to(global_position) <= 1.5:
			var drained: float = nearest_corpse.absorb_energy(0.5, self)
			if drained > 0.0:
				energy += 10.0
				energy = clampf(energy, 0.0, 100.0)
				ate = true
	# After eating or failing, return to crawl if no spores
	if _state_time > 1.0:
		set_state("Crawl")

func _on_exit_eat() -> void:
	pass

func die() -> void:
	if gold_shield():
		return
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 0.2, "worm", golden)
		sim.agent_died.emit("worm", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.2, 0.8, 0.3))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.5, 1.0, 0.5))
	FXManager.report_death("worm")
	queue_free()

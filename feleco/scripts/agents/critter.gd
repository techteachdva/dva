class_name CritterAgent
extends MarkovAgent

# Shared body for the 3.0 creatures. Each species script only fills in its
# numbers and lists in _configure(): what it eats, what it hunts, what it
# runs from. Diet entries are tried in order, so put the favourite first.
#   grass, moss, berry, apple, mushroom, fish, corpse, rot

var species: String = ""
@export var walk_speed: float = 2.5
@export var run_speed: float = 5.0
@export var metabolism_rate: float = 1.0
@export var repro_threshold: float = 25.0
@export var repro_cost: float = 12.0

var health: float = 60.0
var damage: float = 10.0
var energy: float = 50.0
var diet: Array[String] = []
var prey: Array[String] = []
var threats: Array[String] = []
var grass_gain: float = 10.0
var corpse_energy: float = 1.0
var herds: bool = false
# Bears den up when the snow comes: barely moving, barely eating.
var winter_sleep: bool = false
# Hunts only when hungry (below this energy).
var hunt_below: float = 70.0
var death_color: Color = Color(0.6, 0.5, 0.4)

var _repro_cooldown: float = 0.0
var _target: Node3D = null
var _food_timer: float = 0.0

func _configure() -> void:
	pass

func _ready() -> void:
	_configure()
	add_to_group(species)
	_register_states()
	super._ready()
	_lifespan = Clock.lifespan(species)
	set_state("Forage")

func _register_states() -> void:
	_register_state("Forage", _on_enter_forage, _on_tick_forage, func() -> void: pass)
	_register_state("Chase", _on_enter_chase, _on_tick_chase, func() -> void: _target = null)
	_register_state("Flee", func() -> void: pass, _on_tick_flee, func() -> void: pass)
	_register_state("Herd", _on_enter_forage, _on_tick_herd, func() -> void: pass)
	_register_state("Sleep", func() -> void: velocity = Vector3.ZERO, _on_tick_sleep, func() -> void: pass)
	_current_state = "Forage"

func _sim() -> SimulationDirector:
	return director as SimulationDirector

func _sleeping_season() -> bool:
	var sim := _sim()
	return winter_sleep and sim != null and sim.get_season() == "Winter"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	if _sleeping_season():
		mods["Sleep"] = 1.0
		return mods
	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods
	for t: String in threats:
		if not vision.get_visible_by_tag(t).is_empty():
			mods["Flee"] = 0.85
			return mods
	if energy < hunt_below:
		for p: String in prey:
			if p != "fish" and not vision.get_visible_by_tag(p).is_empty():
				mods["Chase"] = 0.7
				return mods
	if herds and energy > 40.0:
		mods["Herd"] = 0.3
	else:
		mods["Forage"] = 0.4
	return mods

func _metabolise(delta: float) -> void:
	var rate: float = metabolism_rate * (0.15 if _current_state == "Sleep" else 1.0)
	energy -= rate * delta
	if energy <= 0.0:
		energy = 0.0
		health -= 5.0 * delta
	if health <= 0.0:
		die()

func _try_reproduce(delta: float) -> void:
	_repro_cooldown -= delta
	var sim := _sim()
	if _repro_cooldown > 0.0 or sim == null or _current_state == "Sleep":
		return
	var threshold: float = repro_threshold
	var cost: float = repro_cost
	if sim.get_species_count(species) < 6:
		threshold *= 0.6
		cost *= 0.6
	if energy < threshold or randf() > sim.logistic_reproduction_factor(species):
		return
	for node in sim.get_nearby_agents(global_position, 8.0, species):
		if node == self or not is_instance_valid(node) or not node is CritterAgent:
			continue
		var mate := node as CritterAgent
		if mate.sex != sex and mate.energy >= threshold * 0.8 and mate._repro_cooldown <= 0.0:
			energy -= cost
			mate.energy -= cost * 0.5
			_repro_cooldown = 4.0
			mate._repro_cooldown = 4.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.5
			sim.spawn_offspring(species, self, global_position + offset)
			return

func _feed(amount: float) -> void:
	energy = clampf(energy + amount, 0.0, 100.0)

# One bite of the first food on the diet within reach. True if it ate.
func _eat_nearby(delta: float) -> bool:
	var sim := _sim()
	if sim == null:
		return false
	for food: String in diet:
		match food:
			"grass":
				if sim.grass != null:
					var got: Vector2 = sim.grass.consume_food(global_position, delta * 0.5, self)
					if got.x > 0.0:
						_feed(got.x * grass_gain * got.y)
						return true
			"moss":
				var tree := sim.find_nearest_tree(global_position)
				if tree != null and tree.has_method("eat_moss") and global_position.distance_squared_to(tree.global_position) < 9.0:
					var m: float = tree.eat_moss(delta * 0.4, self)
					if m > 0.0:
						_feed(m * 30.0)
						return true
			"berry", "apple":
				var fruit: Node3D = sim.find_nearest_berry(global_position) if food == "berry" else sim.find_nearest_apple(global_position)
				if fruit != null and fruit.has_method("eat") and global_position.distance_squared_to(fruit.global_position) < 2.5:
					_feed(fruit.eat(self))
					return true
			"mushroom":
				var m := sim.find_nearest_mushroom(global_position, 3.0)
				if m != null and global_position.distance_squared_to(m.global_position) < 2.25:
					devour(m)
					_feed(20.0)
					return true
			"fish":
				if sim.try_eat_fish(global_position, 2.5):
					_feed(18.0)
					return true
			"corpse":
				var c := sim.find_nearest_corpse(global_position, 2.0)
				if c != null and c.has_method("absorb_energy"):
					# Decomposers take the reserved scraps; scavengers only the meat.
					var took: float = c.absorb_energy(delta * 0.5, self) if SpeciesDB.group_of(species) == "decomposer" else (c.scavenge(delta * 0.5, self) if c.has_method("scavenge") else 0.0)
					if took > 0.0:
						_feed(took * 25.0)
						return true
			"rot":
				if sim.rot != null:
					var r: float = sim.rot.consume_density(global_position, delta * 0.3)
					if r > 0.0:
						_feed(r * 15.0)
						return true
	return false

# Somewhere worth walking to for the first food on the diet, or null.
func _find_food() -> Variant:
	var sim := _sim()
	if sim == null:
		return null
	for food: String in diet:
		match food:
			"grass":
				if sim.grass != null:
					var g := sim.grass.world_to_grid(global_position)
					var p := sim.grass.grid_to_world(clampi(g.x + randi_range(-3, 3), 0, sim.grass.grid_width - 1), clampi(g.y + randi_range(-3, 3), 0, sim.grass.grid_height - 1))
					if sim.grass.get_density_at_world(p) > 0.25:
						return p
			"moss":
				var t := sim.find_nearest_tree(global_position)
				if t != null and t.get("moss") != null and float(t.moss) > 0.1:
					return t.global_position
			"berry":
				var b := sim.find_nearest_berry(global_position, 14.0)
				if b != null:
					return b.global_position
			"apple":
				var a := sim.find_nearest_apple(global_position, 14.0)
				if a != null:
					return a.global_position
			"mushroom":
				var m := sim.find_nearest_mushroom(global_position, 14.0)
				if m != null:
					return m.global_position
			"fish":
				var f := sim.find_nearest_fish(global_position, 18.0)
				if f != null:
					return f.global_position
			"corpse":
				var c := sim.find_nearest_corpse(global_position, 14.0)
				if c != null:
					return c.global_position
			"rot":
				if sim.rot != null:
					var rg := sim.rot.world_to_grid(global_position)
					var rp := sim.rot.grid_to_world(clampi(rg.x + randi_range(-3, 3), 0, sim.rot.grid_width - 1), clampi(rg.y + randi_range(-3, 3), 0, sim.rot.grid_height - 1))
					if sim.rot.get_density_at_world(rp) > 0.1:
						return rp
	return null

func _on_enter_forage() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed

func _on_tick_forage(delta: float) -> void:
	if _eat_nearby(delta):
		velocity = Vector3.ZERO
		return
	_food_timer -= delta
	if _food_timer <= 0.0:
		_food_timer = 0.6
		var spot: Variant = _find_food()
		if spot != null:
			var to: Vector3 = (spot as Vector3) - global_position
			to.y = 0.0
			if to.length_squared() > 0.01:
				velocity = to.normalized() * walk_speed
				return
		if velocity.length_squared() < 0.1:
			velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * walk_speed

func _on_tick_herd(delta: float) -> void:
	if _eat_nearby(delta):
		velocity = Vector3.ZERO
		return
	var pull := _cohesion_vector(species, 12.0, 0.5)
	velocity = (pull.normalized() if pull != Vector3.ZERO else velocity.normalized()) * walk_speed

func _on_enter_chase() -> void:
	_target = null
	if _vision_cone == null:
		return
	for p: String in prey:
		if p == "fish":
			continue
		var t := _vision_cone.closest_visible(p)
		if t != null:
			_target = t
			return

func _on_tick_chase(delta: float) -> void:
	if _target == null or not is_instance_valid(_target) or not _target.is_inside_tree():
		set_state("Forage")
		return
	var to := _target.global_position - global_position
	to.y = 0.0
	velocity = to.normalized() * run_speed
	if to.length() < 2.0 and _target is MarkovAgent:
		if CombatSystem.resolve_attack(self, _target as MarkovAgent):
			FXManager.spawn_combat_particles(global_position)
			# The kill leaves a carcass; the meal is the first bite of it.
			_feed(25.0)
			set_state("Forage")
	energy -= 0.6 * delta

func _on_tick_flee(_delta: float) -> void:
	var threat: Node3D = null
	if _vision_cone != null:
		for t: String in threats:
			threat = _vision_cone.closest_visible(t)
			if threat != null:
				break
	if threat != null:
		var away := global_position - threat.global_position
		away.y = 0.0
		velocity = away.normalized() * run_speed
	elif velocity.length() < run_speed:
		velocity = velocity.normalized() * run_speed

func _on_tick_sleep(_delta: float) -> void:
	velocity = Vector3.ZERO
	if not _sleeping_season():
		set_state("Forage")

func die() -> void:
	if is_queued_for_deletion():
		return
	var sim := _sim()
	if sim != null:
		sim.spawn_corpse(global_position, corpse_energy, species, golden)
		sim.agent_died.emit(species, global_position)
	FXManager.spawn_death_particles(global_position, death_color)
	FXManager.show_floating_text(global_position + Vector3.UP, "X", death_color.lightened(0.2))
	FXManager.report_death(species)
	queue_free()

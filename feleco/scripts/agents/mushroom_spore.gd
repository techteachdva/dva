class_name MushroomSpore
extends MarkovAgent

@export var drift_speed: float = 4.0
@export var drift_downward: float = 1.5
@export var anchor_duration: float = 0.5

var _anchor_timer: float = 0.0
var _mesh_instance: MeshInstance3D
var _cap_instance: MeshInstance3D
var _glow_instance: MeshInstance3D
var _feed_acc: float = 0.0
var _drift_seek_timer: float = 0.0
var _fruit_t: float = 0.0

func _ready() -> void:
	add_to_group("spore")
	velocity = Vector3.ZERO
	_aerial = true
	_lifespan = Clock.lifespan("mushroom")
	_register_states()
	super._ready()
	set_state("Drift")

func _register_states() -> void:
	_register_state("Drift", _on_enter_drift, _on_tick_drift, _on_exit_drift)
	_register_state("Anchor", _on_enter_anchor, _on_tick_anchor, _on_exit_anchor)
	_register_state("Fruit", _on_enter_fruit, _on_tick_fruit, _on_exit_fruit)
	_register_state("Die", _on_enter_die, _on_tick_die, _on_exit_die)
	_current_state = "Drift"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var sim: SimulationDirector = director
	if sim == null:
		return mods
	match _current_state:
		"Drift":
			var rot_density := director.rot.get_density_at_world(global_position)
			if rot_density > 0.05:
				mods["Anchor"] = 0.8
		"Anchor":
			mods["Fruit"] = 0.0
			if _anchor_timer >= anchor_duration:
				mods["Fruit"] = 1.0
		"Fruit":
			var fruit_rot_density := sim.rot.get_density_at_world(global_position)
			var spore_count := sim._active_spores.size()
			# Local overcrowding death
			var nearby_spores := sim.get_nearby_agents(global_position, 5.0, "mushroom").size()
			if nearby_spores >= 25:
				mods["Die"] = 1.0
			elif nearby_spores >= 15:
				mods["Die"] = clampf(mods.get("Die", 0.0) + 0.8, 0.0, 1.0)
			elif nearby_spores >= 8:
				mods["Die"] = clampf(mods.get("Die", 0.0) + 0.3, 0.0, 1.0)
			# Global hard cap
			if spore_count > 400:
				mods["Die"] = clampf(mods.get("Die", 0.0) + 1.0, 0.0, 1.0)
			elif spore_count > 200:
				mods["Die"] = clampf(mods.get("Die", 0.0) + 0.5, 0.0, 1.0)

			if fruit_rot_density <= 0.0 and mods.get("Die", 0.0) < 1.0:
				mods["Die"] = 1.0
	return mods

# Fruiting spreads spores and feeds the mycelium. This used to run inside
# _get_transition_modifiers, which is evaluated about four times per think
# at five thinks a second, so the rates here are those twenty rolls a second
# made independent of how often the director lets a spore think.
const FRUIT_ROLLS_PER_SEC: float = 20.0

func _fruit_spread(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.rot == null:
		return
	var fruit_rot_density := sim.rot.get_density_at_world(global_position)
	if fruit_rot_density <= 0.0:
		return
	var spore_count := sim._active_spores.size()
	var spawn_prob := 0.0
	if spore_count < 80:
		spawn_prob = fruit_rot_density * 1.2
	elif spore_count < 200:
		spawn_prob = fruit_rot_density * 0.3
	# Autumn and rain bring a flush of mushrooms; the rest of the year they are scarce.
	spawn_prob *= sim.fungal_factor()
	var rolls: float = FRUIT_ROLLS_PER_SEC * delta
	var whole: int = int(rolls)
	if randf() < rolls - float(whole):
		whole += 1
	for i: int in whole:
		if randf() < spawn_prob:
			var spread_dir := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 4.0
			sim.spawn_mushroom_spore(self, global_position + spread_dir)
	if sim.mycelium != null:
		sim.mycelium.add_density_at_world(global_position, fruit_rot_density * 0.05 * rolls * sim.fungal_factor())

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	if _age >= _lifespan:
		die()
	# Feed on corpses while in Fruit state
	if _current_state == "Fruit":
		# The cap pushes up out of the soil over a few days instead of popping in.
		_fruit_t += delta
		if _data != null:
			_data.timers["grow"] = _fruit_t
		# Out of season, caps wither within a few weeks.
		var sim: SimulationDirector = director
		if sim != null:
			var ff: float = sim.fungal_factor()
			if ff < 0.5 and randf() < (1.0 - ff) * 0.04 * delta:
				die()
				return
		_fruit_spread(delta)
		_feed_acc += delta
		if _feed_acc >= 0.5:
			_feed_on_corpses(_feed_acc)
			_feed_acc = 0.0

func _feed_on_corpses(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	var spore_count := sim._active_spores.size()
	if spore_count > 500:
		return
	var nearest_corpse := sim.find_nearest_corpse(global_position, 6.0)
	if nearest_corpse != null and nearest_corpse.has_method("absorb_energy"):
		var drained: float = nearest_corpse.absorb_energy(delta * 0.8, self)
		if drained > 0.0:
			var spawn_chance := 0.0
			if spore_count <= 20:
				spawn_chance = 0.5
			elif spore_count <= 60:
				spawn_chance = 0.15
			elif spore_count <= 150:
				spawn_chance = 0.05
			if randf() < clampf(drained * 3.0, 0.0, 1.0) * spawn_chance:
				var spread_dir := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 4.0
				sim.spawn_mushroom_spore(self, global_position + spread_dir)

# Spores and fruiting bodies are drawn by VisualProxyManager.
# A spore is not a creature: it is blown by the wind for a moment, then
# settles on the grass and stays put (rooting if it lands on rot).
var _airtime: float = 0.0

func _on_enter_drift() -> void:
	# Seconds aloft (life time): a short ride on the breeze.
	_airtime = randf_range(0.3, 0.7)

func _on_tick_drift(delta: float) -> void:
	var sim: SimulationDirector = director
	if _airtime <= 0.0:
		velocity = Vector3.ZERO
		return
	_airtime -= delta * Clock.LIFE_PACE
	var push := Vector3.ZERO
	if sim != null:
		push = sim.wind()
		# The stink of carrion tilts the ride a little, nothing more.
		var c := sim.smell_corpse(global_position)
		if c != null:
			var to := c.global_position - global_position
			to.y = 0.0
			push += to.normalized() * 0.6
	velocity = Vector3(push.x, 0.0, push.z)
	# Easing down at the end of the ride.
	if _airtime <= 0.0:
		velocity = Vector3.ZERO
	global_position += velocity * delta
	var flat := Vector2(global_position.x, global_position.z)
	if flat.length() > ValleyTerrain.FLOOR_RADIUS - 3.0:
		flat = flat.normalized() * (ValleyTerrain.FLOOR_RADIUS - 3.0)
		global_position.x = flat.x
		global_position.z = flat.y
	if sim != null:
		global_position.y = sim.ground_height(global_position.x, global_position.z)

func _on_exit_drift() -> void:
	pass

func _on_enter_anchor() -> void:
	_anchor_timer = 0.0
	velocity = Vector3.ZERO
	var sim: SimulationDirector = director
	if sim != null:
		global_position.y = sim.ground_height(global_position.x, global_position.z)

func _on_tick_anchor(delta: float) -> void:
	_anchor_timer += delta

func _on_exit_anchor() -> void:
	pass

func _on_enter_fruit() -> void:
	_fruit_t = 0.0
	var sim: SimulationDirector = director
	if sim != null:
		global_position.y = sim.ground_height(global_position.x, global_position.z)
	var emitter := ScentEmitter.new()
	emitter.scent_strength = 0.6
	emitter.scent_decay_rate = 0.2
	emitter.name = "MyceliumScent"
	add_child(emitter)

func _on_tick_fruit(_delta: float) -> void:
	pass

func _on_exit_fruit() -> void:
	pass

func _on_enter_die() -> void:
	if _mesh_instance != null:
		_mesh_instance.queue_free()
	if _cap_instance != null:
		_cap_instance.queue_free()
	if _glow_instance != null:
		_glow_instance.queue_free()
	queue_free()

func _on_tick_die(_delta: float) -> void:
	pass

func _on_exit_die() -> void:
	pass

func die() -> void:
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.rot.add_density_at_world(global_position, 1.5)
		var roll := randf()
		if roll < 0.05 and sim.can_plant_tree():
			# Rare tree seed from decomposition
			var tree = load("res://scenes/tree.tscn").instantiate()
			sim.get_node("Trees").add_child(tree)
			tree.global_position = sim.tree_spot(global_position + Vector3((randf() - 0.5) * 2.0, 0.0, (randf() - 0.5) * 2.0))
			sim._snap_to_ground(tree)
			if tree.has_method("set_stage"):
				tree.set_stage(0)
		elif roll < 0.15:
			# Boost grass at this location
			if sim.grass != null:
				sim.grass.add_density_at_world(global_position, 0.3)
	if _mesh_instance != null:
		_mesh_instance.queue_free()
	if _cap_instance != null:
		_cap_instance.queue_free()
	if _glow_instance != null:
		_glow_instance.queue_free()
	queue_free()

# Spores move only on the wind (see _on_tick_drift); no walking, herding or
# crowd shoves like a creature.
func _movement_tick(_delta: float) -> void:
	pass

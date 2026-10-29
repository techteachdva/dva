class_name Falcon
extends MarkovAgent

@export var patrol_speed: float = 5.0
@export var dive_speed: float = 12.0
@export var metabolism_rate: float = 1.1
@export var repro_threshold: float = 30.0
@export var repro_cost: float = 15.0

var health: float = 50.0
var damage: float = 30.0
var energy: float = 60.0
var _repro_cooldown: float = 0.0
var _patrol_target: Vector3 = Vector3.ZERO
var _local_cache_timer: float = 0.0
var _cached_local_count: int = 0
var _eat_timer: float = 0.0
# Territory (4.7): falcons are lone apex hunters. Each holds a fixed patch of
# sky (TERRITORY_R around its centre), patrols and perches inside it, and
# fights any same-sex falcon that trespasses; the winner holds or takes the
# patch, the loser flies off to claim free ground. Mates may share. Patches
# never grow, so the falcons settle into spread-out pockets.
const TERRITORY_R: float = 19.0
var territory_center: Vector3 = Vector3.ZERO
var _territory_timer: float = 0.0
var _fight_cd: float = 0.0

func _ready() -> void:
	add_to_group("falcon")
	_aerial = true
	_lifespan = Clock.lifespan("falcon")
	_register_states()
	super._ready()
	set_state("Patrol")
	territory_center = Vector3(global_position.x, 0.0, global_position.z)
	# Hatchlings and newcomers look for unclaimed sky.
	_fight_cd = 20.0
	_claim_free_territory.call_deferred()
	_pick_patrol_target()

func _register_states() -> void:
	_register_state("Patrol", _on_enter_patrol, _on_tick_patrol, _on_exit_patrol)
	_register_state("Dive", _on_enter_dive, _on_tick_dive, _on_exit_dive)
	_register_state("Eat", _on_enter_eat, _on_tick_eat, _on_exit_eat)
	_register_state("Perch", _on_enter_perch, _on_tick_perch, _on_exit_perch)
	_current_state = "Patrol"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods
	var sim: SimulationDirector = director
	# From up high a falcon sees all around it, not just ahead: once hungry it
	# stoops on anything small in range.
	# A perched falcon only leaves its tree for prey once it's hungry.
	var hunt_at: float = 60.0 if _current_state == "Perch" else 85.0
	var prey: Node3D = _spot_prey() if energy < hunt_at else null
	var fish_near: bool = energy < hunt_at and sim != null and sim.find_nearest_fish(global_position, 16.0) != null
	if prey != null or fish_near:
		mods["Dive"] = 1.0  # instant interrupt
	elif _current_state == "Perch":
		mods["Perch"] = 1.0
	elif energy > 45.0 and _perch_rest <= 0.0 and randf() < 0.05:
		# Well fed: drop onto a treetop for a while and watch the meadow.
		mods["Perch"] = 0.9
	else:
		if energy < 25.0:
			mods["Eat"] = clampf(mods.get("Eat", 0.0) + 0.3, 0.0, 1.0)
	return mods

func _physics_process(delta: float) -> void:
	_perch_rest = maxf(_perch_rest - delta, 0.0)
	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	var sim: SimulationDirector = director
	_fight_cd = maxf(_fight_cd - delta, 0.0)
	_territory_timer -= delta
	if sim != null and _territory_timer <= 0.0:
		_territory_timer = 1.0
		_guard_territory(sim)
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
	# Patrol inside the territory, never beyond it.
	var a: float = randf() * TAU
	_patrol_target = territory_center + Vector3(cos(a), 0.0, sin(a)) * TERRITORY_R * sqrt(randf())

# Any same-sex falcon over our patch is a challenger.
func _guard_territory(sim: SimulationDirector) -> void:
	if _fight_cd > 0.0 or health <= 0.0:
		return
	for n in sim.get_nearby_agents(territory_center, TERRITORY_R, "falcon"):
		if n == self or not n is Falcon or not is_instance_valid(n):
			continue
		var rival := n as Falcon
		if rival.sex != sex or rival._fight_cd > 0.0 or rival.health <= 0.0:
			continue
		_fight(rival, sim)
		return

func _fight(rival: Falcon, sim: SimulationDirector) -> void:
	_fight_cd = 8.0
	rival._fight_cd = 8.0
	var mid: Vector3 = (global_position + rival.global_position) * 0.5
	FXManager.spawn_combat_particles(mid)
	FXManager.show_floating_text(mid + Vector3.UP, "Talons!", Color(1.0, 0.7, 0.3))
	# The stronger, better-fed bird usually wins; the holder fights a bit harder.
	var mine: float = (health + energy * 0.5) * randf_range(0.7, 1.3) * 1.1
	var theirs: float = (rival.health + rival.energy * 0.5) * randf_range(0.7, 1.3)
	var winner: Falcon = self if mine >= theirs else rival
	var loser: Falcon = rival if winner == self else self
	loser.health -= randf_range(8.0, 18.0)
	winner.health -= randf_range(2.0, 6.0)
	if winner == rival:
		# The challenger takes this patch.
		rival.territory_center = territory_center
	if not loser._claim_free_territory():
		# No free sky anywhere: the loser leaves over the peaks. This is what
		# holds the falcons at a stable number of territories.
		loser._emigrate()
		return
	loser._patrol_target = loser.territory_center
	if randf() < 0.25:
		sim.chronicle.emit("%s drives %s out of its hunting grounds." % [winner.display_name, loser.display_name])

# Move our centre to the best free spot in falcon country: as far as we can
# find from every other falcon's patch (at least two territories away).
func _claim_free_territory() -> bool:
	var sim: SimulationDirector = director
	if sim == null or not is_inside_tree():
		return true
	var others: Array = []
	for f in get_tree().get_nodes_in_group("falcon"):
		if f != self and f is Falcon and is_instance_valid(f):
			others.append((f as Falcon).territory_center)
	var crowded := func(c: Vector3) -> float:
		var near: float = INF
		for o: Vector3 in others:
			near = minf(near, Vector2(c.x - o.x, c.z - o.z).length())
		return near
	if crowded.call(territory_center) >= TERRITORY_R * 2.0:
		return true
	var best: Vector3 = territory_center
	var best_gap: float = crowded.call(territory_center)
	for i: int in 24:
		var p: Vector3 = Biomes.random_point("falcon", sim)
		var gap: float = crowded.call(p)
		if gap > best_gap:
			best_gap = gap
			best = Vector3(p.x, 0.0, p.z)
		if gap >= TERRITORY_R * 2.0:
			break
	territory_center = best
	return best_gap >= TERRITORY_R

func _emigrate() -> void:
	var sim: SimulationDirector = director
	if sim != null and randf() < 0.3:
		sim.chronicle.emit("%s finds no sky of its own and flies off over the peaks." % display_name)
	FXManager.show_floating_text(global_position + Vector3.UP, "Leaves", Color(0.85, 0.85, 0.75))
	if sim != null:
		sim.agent_died.emit("falcon", global_position)
	queue_free()
	# Patrol over the valley, never out over the peaks.
	var flat := Vector2(_patrol_target.x, _patrol_target.z)
	if flat.length() > ValleyTerrain.WALK_RADIUS - 6.0:
		flat = flat.normalized() * (ValleyTerrain.WALK_RADIUS - 6.0)
	_patrol_target.x = flat.x
	_patrol_target.z = flat.y

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
	_dive_target = null

# Perching: fly to a grown tree and sit on its crown for a while.
var _perch_tree: Node3D = null
var _perch_left: float = 0.0
# Seconds before it will perch again.
var _perch_rest: float = 0.0

func _on_enter_perch() -> void:
	var sim: SimulationDirector = director
	_perch_tree = null
	if sim != null:
		var t := sim.find_nearest_tree(global_position, 30.0)
		if t != null and t.get("_stage") == 2 and not bool(t.get("bush")) and t.has_method("crown_top"):
			_perch_tree = t
	_perch_left = randf_range(8.0, 16.0)
	if _perch_tree == null:
		_perch_rest = 6.0
		set_state("Patrol")

func _on_tick_perch(delta: float) -> void:
	if _perch_tree == null or not is_instance_valid(_perch_tree):
		set_state("Patrol")
		return
	var to := _perch_tree.global_position - global_position
	to.y = 0.0
	if to.length() > 0.6:
		velocity = to.normalized() * patrol_speed
		if _data != null:
			_data.perch_y = -1.0
		return
	velocity = Vector3.ZERO
	if _data != null:
		_data.perch_y = _perch_tree.crown_top()
	# Perched time runs on the life clock like everything else here.
	_perch_left -= delta / Clock.LIFE_PACE
	if _perch_left <= 0.0:
		set_state("Patrol")

func _on_exit_perch() -> void:
	_perch_rest = randf_range(20.0, 40.0)
	if _data != null:
		_data.perch_y = -1.0

const PREY: Array[String] = ["rabbit", "mouse", "robin", "beetle", "worm"]
const SPOT_RANGE: float = 20.0
var _dive_target: Node3D = null

# The nearest small creature in range: rabbits on open ground are the
# staple, robins and beetles and surfaced worms will do.
func _spot_prey() -> Node3D:
	var sim: SimulationDirector = director
	if sim == null:
		return null
	var best: Node3D = null
	var best_d: float = SPOT_RANGE * SPOT_RANGE
	for n in sim.get_nearby_agents(global_position, SPOT_RANGE):
		if n == self or not is_instance_valid(n) or not n is MarkovAgent:
			continue
		if not PREY.has((n as MarkovAgent).species_id) or n.get("indoors") == true:
			continue
		var d: float = Vector2(n.global_position.x - global_position.x, n.global_position.z - global_position.z).length_squared()
		if (n as MarkovAgent).species_id == "rabbit":
			d *= 0.6
		if d < best_d:
			best_d = d
			best = n
	return best

func _on_tick_dive(delta: float) -> void:
	if _dive_target == null or not is_instance_valid(_dive_target) or not _dive_target.is_inside_tree():
		_dive_target = _spot_prey()
	var target: Node3D = _dive_target
	if target == null:
		var sim: SimulationDirector = director
		if sim != null:
			target = sim.find_nearest_fish(global_position, 14.0)
	if target != null and is_instance_valid(target):
		var dir := (target.global_position - global_position).normalized()
		velocity = dir * dive_speed
		var bite: float = 3.0 if target.is_in_group("fish") else 2.6
		var flat := Vector2(target.global_position.x - global_position.x, target.global_position.z - global_position.z)
		if flat.length() < bite and target is MarkovAgent:
			if CombatSystem.resolve_attack(self, target as MarkovAgent):
				energy += 15.0
				energy = clampf(energy, 0.0, 100.0)
				set_state("Eat")
	else:
		# Lost it: climb back up and keep looking.
		set_state("Patrol")

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
	if gold_shield():
		return
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 1.0, "falcon", golden)
		sim.agent_died.emit("falcon", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.95, 0.95, 0.95))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.95, 0.95, 0.8))
	FXManager.report_death("falcon")
	queue_free()

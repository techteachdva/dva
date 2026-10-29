class_name Human
extends MarkovAgent

@export var hunt_speed: float = 4.0
@export var travel_speed: float = 3.0
@export var flee_speed: float = 5.0
@export var rest_regen: float = 2.0
@export var metabolism_rate: float = 0.9
@export var repro_threshold: float = 26.0
@export var repro_cost: float = 18.0

var health: float = 70.0
var damage: float = 12.0
var energy: float = 70.0
var _repro_cooldown: float = 0.0
var wood: int = 0
var _rect_waypoints: Array = []
var _rect_waypoint_index: int = 0
var _settlement_center: Vector3 = Vector3.ZERO
var _settlement_id: int = 0
var _settle_timer: float = 0.0
var _shelter_protection_timer: float = 0.0
var _channel_timer: float = 0.0
var _blessed_timer: float = 0.0
# Wizards carry magic mushrooms back to feed the village.
var magic_mushrooms: int = 0
var _mushroom_target: Node3D = null
# Set by the director when the tribe sends this villager on a raid.
var _raid_target: Vector3 = Vector3.ZERO
# Home and sleep. A villager's bed is in `home` (one of four in a hut).
# At night they walk home and go indoors: out of sight, safe from hunters,
# hungry at a third of the rate. With no bed they sleep rough and wake cranky.
var home: Node3D = null
var indoors: bool = false
var _slept_rough: bool = false
var cranky: float = 0.0
var _raid_clock: float = 0.0

func _apply_variant(v: String) -> void:
	variant = v
	match variant:
		"wizard":
			damage = 8.0
			_lifespan = Clock.lifespan("human") * 1.17
			health = minf(health, 80.0)
		"builder":
			damage = 10.0
			_lifespan = Clock.lifespan("human") * 0.92

func _set_blessed(duration: float) -> void:
	_blessed_timer = duration

func _is_blessed() -> bool:
	return _blessed_timer > 0.0

func _ready() -> void:
	add_to_group("human")
	_register_states()
	super._ready()
	_lifespan = Clock.lifespan("human")
	set_state("Gather")
	_adopt_settlement()

func _register_states() -> void:
	_register_state("Gather", _on_enter_gather, _on_tick_gather, _on_exit_gather)
	_register_state("Hunt", _on_enter_hunt, _on_tick_hunt, _on_exit_hunt)
	_register_state("Travel", _on_enter_travel, _on_tick_travel, _on_exit_travel)
	_register_state("Defend", _on_enter_defend, _on_tick_defend, _on_exit_defend)
	_register_state("Flee", _on_enter_flee, _on_tick_flee, _on_exit_flee)
	_register_state("Rest", _on_enter_rest, _on_tick_rest, _on_exit_rest)
	_register_state("Channel", _on_enter_channel, _on_tick_channel, _on_exit_channel)
	_register_state("Build", _on_enter_build, _on_tick_build, _on_exit_build)
	_register_state("Raid", _on_enter_raid, _on_tick_raid, _on_exit_raid)
	_register_state("Sleep", _on_enter_sleep, _on_tick_sleep, _on_exit_sleep)
	_current_state = "Gather"

func _get_transition_modifiers() -> Dictionary:
	var mods: Dictionary = {}
	var vision: VisionCone = _vision_cone
	if vision == null:
		return mods

	var wolves := vision.get_visible_by_tag("wolf")
	var boars := vision.get_visible_by_tag("boar")
	var sim: SimulationDirector = director
	var party_size: int = 0
	if sim != null:
		party_size = sim.human_party_size_check(self)

	var threatened := wolves.size() > 0 or boars.size() > 0
	var protected := _shelter_protection_timer > 0.0
	# Night: everyone heads to bed unless something is on their heels.
	# Once asleep they stay down until morning proper (no waking at dusk).
	if sim != null and sim.night() > (0.35 if _current_state == "Sleep" else 0.6) and (not threatened or indoors):
		mods["Sleep"] = 0.8
		return mods

	if threatened and not protected:
		if party_size >= 3:
			mods["Hunt"] = clampf(mods.get("Hunt", 0.0) + 0.6, 0.0, 1.0)
		else:
			mods["Flee"] = 0.85  # urgent flight, interrupt any state
	elif threatened and protected:
		# Inside shelter protection: stay calm but alert
		mods["Gather"] = clampf(mods.get("Gather", 0.0) + 0.2, 0.0, 1.0)
	else:
		if party_size >= 2:
			mods["Travel"] = clampf(mods.get("Travel", 0.0) + 0.3, 0.0, 1.0)
			mods["Gather"] = clampf(mods.get("Gather", 0.0) + 0.3, 0.0, 1.0)
		else:
			# Hurt but fed: rest. Hungry: go find food (resting doesn't feed anyone).
			if health < 40.0 and energy > 35.0:
				mods["Rest"] = clampf(mods.get("Rest", 0.0) + 0.5, 0.0, 1.0)
			else:
				mods["Gather"] = clampf(mods.get("Gather", 0.0) + (0.6 if energy < 50.0 else 0.2), 0.0, 1.0)

	# Stay near settlement unless hungry or threatened
	var hungry := energy < 50.0
	if _settlement_center != Vector3.ZERO:
		var dist_to_home := global_position.distance_to(_settlement_center)
		if dist_to_home > 15.0:
			mods["Travel"] = clampf(mods.get("Travel", 0.0) + 0.8, 0.0, 1.0)
		elif dist_to_home > 10.0 and not hungry:
			mods["Travel"] = clampf(mods.get("Travel", 0.0) + 0.5, 0.0, 1.0)
		elif dist_to_home > 6.0 and not hungry and not threatened:
			mods["Gather"] = clampf(mods.get("Gather", 0.0) + 0.2, 0.0, 1.0)

	# A raid order overrides the daily round (but not running from wolves).
	if _raid_target != Vector3.ZERO and not (threatened and not protected and party_size < 3):
		mods["Raid"] = 0.95
		return mods
	# Variant-specific state transitions
	if not threatened:
		# A golden villager has every gift: wizard, builder and farmer at once.
		var gifted: bool = golden > 0.05
		if (variant == "wizard" or gifted) and energy >= 30.0:
			mods["Channel"] = clampf(mods.get("Channel", 0.0) + 0.25, 0.0, 1.0)
		if (variant == "builder" or gifted) and wood >= 1 and _settlement_center != Vector3.ZERO:
			mods["Build"] = clampf(mods.get("Build", 0.0) + 0.35, 0.0, 1.0)

	var emitter: ScentEmitter = get_node_or_null("ScentEmitter") as ScentEmitter
	if emitter != null:
		emitter.emit_scent(0.3)

	return mods

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	# Everything below is life, not movement: it runs at Clock.LIFE_PACE.
	delta *= Clock.LIFE_PACE
	# Update shelter protection timer
	var sim: SimulationDirector = director
	if sim != null and _settlement_center != Vector3.ZERO:
		if global_position.distance_to(_settlement_center) <= 5.0:
			_shelter_protection_timer = 12.0
	_shelter_protection_timer = maxf(_shelter_protection_timer - delta, 0.0)
	_blessed_timer = maxf(_blessed_timer - delta, 0.0)
	cranky = maxf(cranky - delta * 0.02, 0.0)
	_channel_timer = maxf(_channel_timer - delta, 0.0)
	# Overpopulation stress when settlements get too large
	if sim != null:
		var local_humans := sim.get_nearby_agents(global_position, 12.0, "human").size()
		if local_humans > 15:
			energy -= metabolism_rate * 0.5 * delta
			health -= 1.0 * delta
		elif local_humans > 8:
			energy -= metabolism_rate * 0.25 * delta
		# Global human overpopulation
		var total_humans: int = sim.get_human_count()
		if total_humans > 60:
			var excess: float = (total_humans - 60) / 40.0
			energy -= excess * 1.5 * delta
			if total_humans > 120:
				var severe: float = (total_humans - 120) / 40.0
				health -= severe * 3.0 * delta
				energy -= severe * 1.0 * delta
	_settle_timer -= delta
	if _settlement_center == Vector3.ZERO and _settle_timer <= 0.0:
		_settle_timer = 2.0
		_adopt_settlement()
	if _settle_timer <= 0.0:
		_settle_timer = 1.0
		_try_build_shelter()

func _metabolise(delta: float) -> void:
	# A villager fed a wizard's mushroom works on half the food. Asleep in a
	# bed they burn a third; sleeping rough in the cold burns half again.
	var rate: float = 0.5 if _is_blessed() else 1.0
	if indoors:
		rate *= 0.3
	elif _current_state == "Sleep":
		rate *= 1.1
	energy -= metabolism_rate * delta * rate
	if energy <= 0.0:
		health -= 5.0 * delta
		energy = 0.0

func _try_reproduce(delta: float) -> void:
	_repro_cooldown -= delta
	if _repro_cooldown > 0.0:
		return
	# Babies come from homes: a couple sharing a hut at night. Only a tribe
	# with no huts at all still pairs off in the open (or it could never start).
	var home_sim: SimulationDirector = director
	if home_sim != null and (_settlement_id > 0 and not home_sim.tribe_huts(_settlement_id).is_empty()):
		if indoors:
			_try_reproduce_at_home()
			return
		# By day a couple can still pair off, but less often than at home.
		if home_sim.is_night() or randf() > 0.4:
			return
	if energy < repro_threshold:
		return
	# Desperation repopulation: when population < 10, reproduction becomes easier
	var desperation_threshold: float = repro_threshold
	var desperation_cost: float = repro_cost
	var desperation_cooldown: float = 0.0
	if _is_blessed():
		desperation_threshold *= 0.75
	var sim: SimulationDirector = director
	if sim != null:
		var total_count: int = sim.get_human_count()
		if total_count < 15:
			desperation_threshold = repro_threshold * 0.5
			desperation_cost = repro_cost * 0.5
			desperation_cooldown = -1.0
	if energy < desperation_threshold:
		return
	_repro_cooldown += desperation_cooldown
	if sim == null:
		return
	var count := sim.get_nearby_agents(global_position, 10.0, "human").size()
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
	for h in sim.get_nearby_humans(global_position, 8.0):
		if h == self:
			continue
		if h.energy >= desperation_threshold and h.sex != sex:
			energy -= desperation_cost
			h.energy -= desperation_cost * 0.5
			_repro_cooldown = 2.0
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 1.5
			sim.spawn_human_offspring(self, global_position + offset)
			return

func _try_reproduce_at_home() -> void:
	if not indoors or home == null or not is_instance_valid(home) or energy < repro_threshold * 0.8:
		return
	var sim: SimulationDirector = director
	if sim.get_human_count() > 90:
		return
	for h in sim.hut_residents(home):
		if h == self or not h.indoors or h.sex == sex or h.energy < repro_threshold * 0.8:
			continue
		# A chance each night, not a certainty: about one in three couples.
		_repro_cooldown = 4.0
		if randf() > 0.35:
			return
		energy -= repro_cost
		h.energy -= repro_cost * 0.5
		var door: Vector3 = home.global_position + Vector3(0, 0, 2.2)
		sim.spawn_human_offspring(self, door)
		return

func _on_enter_sleep() -> void:
	velocity = Vector3.ZERO
	var sim: SimulationDirector = director
	if sim != null and (home == null or not is_instance_valid(home)):
		home = sim.claim_hut(self)
	_slept_rough = home == null

func _on_tick_sleep(delta: float) -> void:
	if home != null and is_instance_valid(home):
		var door: Vector3 = home.global_position + Vector3(0, 0, 2.0)
		var to: Vector3 = door - global_position
		to.y = 0.0
		if indoors:
			velocity = Vector3.ZERO
			health = minf(health + rest_regen * delta * 0.5, 100.0)
		elif to.length() < 1.2:
			indoors = true
			velocity = Vector3.ZERO
		else:
			velocity = to.normalized() * travel_speed
		return
	# No bed: curl up where they are, near the village if they have one.
	_slept_rough = true
	velocity = Vector3.ZERO

func _on_exit_sleep() -> void:
	if indoors and home != null and is_instance_valid(home):
		global_position = home.global_position + Vector3(randf_range(-1.0, 1.0), 0, 2.2)
		var gs: SimulationDirector = director
		if gs != null:
			global_position.y = gs.ground_height(global_position.x, global_position.z)
	indoors = false
	if _slept_rough:
		_slept_rough = false
		cranky = 1.0
		energy = maxf(0.0, energy - 6.0)
		FXManager.show_floating_text(global_position + Vector3.UP * 2.0, "Cranky!", Color(0.86, 0.55, 0.4))

func _try_build_shelter() -> void:
	if not is_inside_tree():
		return
	if wood <= 0:
		return
	var sim: SimulationDirector = director
	if sim == null:
		return
	var nearby_humans := sim.get_nearby_humans(global_position, 8.0).size()
	if nearby_humans < 1:
		return
	var build_pos := _settlement_center if _settlement_center != Vector3.ZERO else global_position
	if sim.is_position_in_shelter(build_pos, 10.0):
		return
	wood -= 1
	var new_sid: int = sim.build_shelter(build_pos, _settlement_id)
	if _settlement_center == Vector3.ZERO:
		_settlement_center = build_pos
		_settlement_id = new_sid

func _adopt_settlement() -> void:
	if _settlement_center != Vector3.ZERO:
		return
	var sim: SimulationDirector = director
	if sim == null:
		return
	# Adopt from nearest shelter
	for shelter in sim._active_shelters:
		if is_instance_valid(shelter) and shelter.global_position.distance_to(global_position) <= 25.0:
			_settlement_center = shelter.global_position
			var sid = shelter.get_meta("settlement_id", 0)
			if sid is int and sid > 0:
				_settlement_id = sid
			return
	# Adopt from nearest human with a settlement
	var nearest_human_node = null
	var nearest_dist := 10000.0
	for h in sim.get_node("Agents").get_children():
		if not is_instance_valid(h) or h == self:
			continue
		if not h is Node3D:
			continue
		if not h.is_in_group("human"):
			continue
		var center = h.get("_settlement_center")
		if center != null and center is Vector3 and center != Vector3.ZERO:
			var d: float = h.global_position.distance_to(global_position)
			if d < nearest_dist:
				nearest_dist = d
				nearest_human_node = h
	if nearest_human_node != null and nearest_dist <= 15.0:
		_settlement_center = nearest_human_node.get("_settlement_center")
		var h_sid = nearest_human_node.get("_settlement_id")
		if h_sid != null and h_sid is int and h_sid > 0:
			_settlement_id = h_sid
		return
	# Do NOT default to own position — remain unattached until a shelter is built nearby

func _on_enter_gather() -> void:
	pass

func _on_tick_gather(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	# Single consolidated nearby-agent query: filter by group in one pass
	var nearby := sim.get_nearby_agents(global_position, 15.0)
	var nearest_wolf: Node3D = null
	var nearest_boar_defense: Node3D = null
	var nearest_sheep: Node3D = null
	var nearest_sheep_hungry: Node3D = null
	var nearest_robin: Node3D = null
	var nearest_boar_hunt: Node3D = null
	var nearest_rabbit: Node3D = null
	var best_wolf_dist_sq := 9.0
	var best_boar_def_dist_sq := 9.0
	var best_sheep_dist_sq := 10000.0
	var best_sheep_hungry_dist_sq := 144.0
	var best_robin_dist_sq := 10000.0
	var best_boar_hunt_dist_sq := 10000.0
	var best_rabbit_dist_sq := 10000.0
	for node in nearby:
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var n3d := node as Node3D
		var dist_sq := global_position.distance_squared_to(n3d.global_position)
		if node.is_in_group("wolf") and dist_sq < best_wolf_dist_sq:
			best_wolf_dist_sq = dist_sq
			nearest_wolf = n3d
		elif node.is_in_group("boar") and dist_sq < best_boar_def_dist_sq:
			best_boar_def_dist_sq = dist_sq
			nearest_boar_defense = n3d
		elif node.is_in_group("sheep"):
			if dist_sq < best_sheep_dist_sq:
				best_sheep_dist_sq = dist_sq
				nearest_sheep = n3d
			if dist_sq < best_sheep_hungry_dist_sq:
				best_sheep_hungry_dist_sq = dist_sq
				nearest_sheep_hungry = n3d
		elif node.is_in_group("robin"):
			var is_grounded = node.get("_is_grounded")
			if is_grounded != null and is_grounded == true and dist_sq < best_robin_dist_sq:
				best_robin_dist_sq = dist_sq
				nearest_robin = n3d
		elif node.is_in_group("boar") and dist_sq < best_boar_hunt_dist_sq:
			best_boar_hunt_dist_sq = dist_sq
			nearest_boar_hunt = n3d
		elif node.is_in_group("rabbit") and dist_sq < best_rabbit_dist_sq:
			best_rabbit_dist_sq = dist_sq
			nearest_rabbit = n3d

	# Opportunistic defense against wolves and boars (closest threats first)
	if nearest_wolf != null and best_wolf_dist_sq <= 6.25 and nearest_wolf is MarkovAgent:
		if CombatSystem.resolve_attack(self, nearest_wolf as MarkovAgent):
			energy += 15.0
			energy = clampf(energy, 0.0, 100.0)
			velocity = Vector3.ZERO
			return
	if nearest_boar_defense != null and best_boar_def_dist_sq <= 6.25 and nearest_boar_defense is MarkovAgent:
		if CombatSystem.resolve_attack(self, nearest_boar_defense as MarkovAgent):
			energy += 15.0
			energy = clampf(energy, 0.0, 100.0)
			velocity = Vector3.ZERO
			return

	# Inter-settlement combat: attack humans from different settlements
	if _settlement_id > 0:
		for node in nearby:
			if not is_instance_valid(node) or node == self:
				continue
			if not node.is_in_group("human"):
				continue
			var other_sid = node.get("_settlement_id")
			if other_sid != null and other_sid is int and other_sid > 0 and other_sid != _settlement_id:
				if node is MarkovAgent and global_position.distance_squared_to(node.global_position) < 9.0:
					if CombatSystem.resolve_attack(self, node as MarkovAgent):
						energy += 10.0
						energy = clampf(energy, 0.0, 100.0)
						velocity = Vector3.ZERO
						return
	# Opportunistic mushroom snack
	var near_mushroom := sim.find_nearest_mushroom(global_position, 2.5)
	if near_mushroom != null and global_position.distance_squared_to(near_mushroom.global_position) < 2.25:
		devour(near_mushroom)
		energy += 20.0
		energy = clampf(energy, 0.0, 100.0)
		velocity = Vector3.ZERO
		# Cultivation: humans spread mushroom spores after eating
		if randf() < 0.4:
			sim.spawn_mushroom_spore(self, global_position + Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0))
		return

	var seek_dir := Vector3.ZERO
	var seek_priority := 0.0
	var hungry := energy < 50.0

	# Hunt sheep first when hungry (use the already-filtered nearest)
	if hungry and nearest_sheep_hungry != null:
		if best_sheep_hungry_dist_sq < 4.0:
			if nearest_sheep_hungry is MarkovAgent and CombatSystem.resolve_attack(self, nearest_sheep_hungry as MarkovAgent):
				FXManager.spawn_combat_particles(global_position)
				energy += 15.0
				energy = clampf(energy, 0.0, 100.0)
				velocity = Vector3.ZERO
				return
		else:
			seek_dir = (nearest_sheep_hungry.global_position - global_position).normalized()
			seek_priority = 4.0

	var nearest_fish := sim.find_nearest_fish(global_position, 12.0)
	if nearest_fish != null:
		var fish_dist := global_position.distance_squared_to(nearest_fish.global_position)
		if fish_dist < 5.8:
			if sim.try_eat_fish(global_position, 2.4):
				energy += 16.0
				energy = clampf(energy, 0.0, 100.0)
				velocity = Vector3.ZERO
				return
		elif fish_dist < 100.0 and seek_priority < 3.6:
			seek_dir = (nearest_fish.global_position - global_position).normalized()
			seek_priority = 3.6

	# Harvest trees for wood
	if seek_priority < 3.0:
		var nearest_tree := sim.find_nearest_tree(global_position)
		if nearest_tree != null:
			var best_dist_sq := global_position.distance_squared_to(nearest_tree.global_position)
			if best_dist_sq < 3.0:
				if nearest_tree.harvest():
					wood += 2 if _is_blessed() else 1
					energy -= 2.0
					energy = clampf(energy, 0.0, 100.0)
					if randf() < 0.5 and sim.can_plant_tree():
						var tree = load("res://scenes/tree.tscn").instantiate()
						sim.get_node("Trees").add_child(tree)
						tree.global_position = sim.tree_spot(global_position + Vector3((randf() - 0.5) * 6.0, 0.0, (randf() - 0.5) * 6.0))
						sim._snap_to_ground(tree)
						if tree.has_method("set_stage"):
							tree.set_stage(0)
					if _settlement_center == Vector3.ZERO:
						_settlement_center = global_position
				velocity = Vector3.ZERO
				return
			else:
				seek_dir = (nearest_tree.global_position - global_position).normalized()
				seek_priority = 1.5
	# Eat apples
	if seek_priority < 2.0:
		var nearest_apple := sim.find_nearest_apple(global_position)
		if nearest_apple != null:
			var best_dist_sq := global_position.distance_squared_to(nearest_apple.global_position)
			if best_dist_sq < 2.0 and nearest_apple.has_method("eat"):
				energy += nearest_apple.eat(self) * 0.6
				energy = clampf(energy, 0.0, 100.0)
				sim.try_plant_tree_seed(global_position, "human")
				health += 3.0
				health = clampf(health, 0.0, 100.0)
				velocity = Vector3.ZERO
				return
			else:
				seek_dir = (nearest_apple.global_position - global_position).normalized()
				seek_priority = 2.0
	# Hunt sheep, robins, or boars for meat (non-hungry fallback) — reuse consolidated query results
	if seek_priority < 2.5:
		if nearest_sheep != null and best_sheep_dist_sq < 6.25:
			if nearest_sheep is MarkovAgent and CombatSystem.resolve_attack(self, nearest_sheep as MarkovAgent):
				FXManager.spawn_combat_particles(global_position)
				energy += 15.0
				energy = clampf(energy, 0.0, 100.0)
				velocity = Vector3.ZERO
				return
		else:
			if nearest_sheep != null:
				seek_dir = (nearest_sheep.global_position - global_position).normalized()
				seek_priority = 2.5
		if nearest_robin != null and best_robin_dist_sq < 16.0:
			if nearest_robin is MarkovAgent and CombatSystem.resolve_attack(self, nearest_robin as MarkovAgent):
					FXManager.spawn_combat_particles(global_position)
					energy += 12.0
					energy = clampf(energy, 0.0, 100.0)
					velocity = Vector3.ZERO
					return
			energy += 12.0
			energy = clampf(energy, 0.0, 100.0)
			velocity = Vector3.ZERO
			return
		elif nearest_robin != null and seek_priority < 2.5:
			seek_dir = (nearest_robin.global_position - global_position).normalized()
			seek_priority = 2.5
		if nearest_rabbit != null and best_rabbit_dist_sq < 9.0:
			if nearest_rabbit is MarkovAgent and CombatSystem.resolve_attack(self, nearest_rabbit as MarkovAgent):
					FXManager.spawn_combat_particles(global_position)
					energy += 10.0
					energy = clampf(energy, 0.0, 100.0)
					velocity = Vector3.ZERO
					return
			energy += 10.0
			energy = clampf(energy, 0.0, 100.0)
			velocity = Vector3.ZERO
			return
		elif nearest_rabbit != null and seek_priority < 2.5:
			seek_dir = (nearest_rabbit.global_position - global_position).normalized()
			seek_priority = 2.5
		if nearest_boar_hunt != null and best_boar_hunt_dist_sq < 6.25 and seek_priority < 2.5:
			if CombatSystem.resolve_attack(self, nearest_boar_hunt):
				FXManager.spawn_combat_particles(global_position)
				energy += 15.0
				energy = clampf(energy, 0.0, 100.0)
				velocity = Vector3.ZERO
				return
		elif nearest_boar_hunt != null and seek_priority < 2.5:
			seek_dir = (nearest_boar_hunt.global_position - global_position).normalized()
			seek_priority = 2.5
	# Eat mushrooms
	if seek_priority < 2.0:
		var nearest_mushroom := sim.find_nearest_mushroom(global_position)
		if nearest_mushroom != null:
			var best_dist_sq := global_position.distance_squared_to(nearest_mushroom.global_position)
			if best_dist_sq < 3.0:
				devour(nearest_mushroom)
				energy += 20.0
				energy = clampf(energy, 0.0, 100.0)
				velocity = Vector3.ZERO
				# Cultivation: spread spores after eating
				if randf() < 0.4:
					sim.spawn_mushroom_spore(self, global_position + Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0))
				return
			else:
				seek_dir = (nearest_mushroom.global_position - global_position).normalized()
				seek_priority = 2.0
	# Forage grass
	if seek_priority < 1.0:
		if sim.grass != null:
			var consumed := sim.grass.consume_density(global_position, delta * 0.4, self)
			if consumed > 0.0:
				# Fields near the village are tended crops; wild grass is poor fare.
				var farmed: bool = golden > 0.05 or (_settlement_center != Vector3.ZERO and global_position.distance_to(_settlement_center) < 12.0)
				energy += consumed * (12.0 if farmed else 6.0)
				energy = clampf(energy, 0.0, 100.0)
				velocity = Vector3.ZERO
				# Cultivation: spread grass seeds to nearby bare patches
				if randf() < 0.35:
					var spread_pos := global_position + Vector3((randf() - 0.5) * 6.0, 0.0, (randf() - 0.5) * 6.0)
					sim.grass.add_density_at_world(spread_pos, 0.15)
				return
			var g_pos := sim.grass.grid_to_world(
				int(clamp(sim.grass.world_to_grid(global_position).x + (randi() % 7 - 3), 0, sim.grass.grid_width - 1)),
				int(clamp(sim.grass.world_to_grid(global_position).y + (randi() % 7 - 3), 0, sim.grass.grid_height - 1))
			)
			var g_density := sim.grass.get_density_at_world(g_pos)
			if g_density > 0.2:
				seek_dir = (g_pos - global_position).normalized()
				seek_priority = 1.0
	# Active cultivation when well-fed near settlement
	if seek_priority < 0.5 and _settlement_center != Vector3.ZERO and energy > 50.0:
		var dist_to_home := global_position.distance_to(_settlement_center)
		if dist_to_home < 8.0 and randf() < 0.15 * delta:
			# Plant a tree seed near settlement
			sim.try_plant_tree_seed(global_position + Vector3((randf() - 0.5) * 4.0, 0.0, (randf() - 0.5) * 4.0), "human")
			energy -= 2.0
			energy = clampf(energy, 0.0, 100.0)
	# Move toward best food, or return to settlement
	if seek_dir != Vector3.ZERO:
		velocity = seek_dir * travel_speed * 0.7
	else:
		if _settlement_center != Vector3.ZERO:
			var home_dir := (_settlement_center - global_position).normalized()
			velocity = home_dir * travel_speed * 0.4
		else:
			velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * travel_speed * 0.4

func _on_exit_gather() -> void:
	pass

func _on_enter_hunt() -> void:
	_update_weapon_visibility(true)

func _on_tick_hunt(delta: float) -> void:
	var vision: VisionCone = _vision_cone
	if vision == null:
		return
	var target: Node3D = vision.closest_visible("wolf")
	if target == null:
		target = vision.closest_visible("boar")
	if target != null and is_instance_valid(target):
		var dir := (target.global_position - global_position).normalized()
		velocity = dir * hunt_speed
		if global_position.distance_to(target.global_position) <= 2.0 and target is MarkovAgent:
			if CombatSystem.resolve_attack(self, target as MarkovAgent):
				FXManager.spawn_combat_particles(global_position)
				_update_weapon_visibility(false)
				set_state("Gather")
	else:
		velocity = velocity.move_toward(Vector3.ZERO, delta * 2.0)

func _on_exit_hunt() -> void:
	_update_weapon_visibility(false)

func _generate_rectangle_waypoints() -> void:
	var w: float = 4.0 + randf() * 6.0
	var h: float = 4.0 + randf() * 6.0
	var center := _settlement_center if _settlement_center != Vector3.ZERO else global_position
	_rect_waypoints = [
		center + Vector3(w, 0.0, h),
		center + Vector3(w, 0.0, -h),
		center + Vector3(-w, 0.0, -h),
		center + Vector3(-w, 0.0, h),
	]
	_rect_waypoint_index = 0

func _velocity_to_next_rect_waypoint() -> void:
	if _rect_waypoints.size() == 0:
		velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * travel_speed
		return
	var target: Vector3 = _rect_waypoints[_rect_waypoint_index]
	var dir := (target - global_position).normalized()
	velocity = dir * travel_speed

func _on_enter_travel() -> void:
	_generate_rectangle_waypoints()
	_velocity_to_next_rect_waypoint()

func _on_tick_travel(_delta: float) -> void:
	if _rect_waypoints.size() > 0:
		var target: Vector3 = _rect_waypoints[_rect_waypoint_index]
		if global_position.distance_to(target) < 1.5:
			_rect_waypoint_index = (_rect_waypoint_index + 1) % _rect_waypoints.size()
			_velocity_to_next_rect_waypoint()
	# Flocking with humans
	var cohesion := _cohesion_vector("human", 10.0, 0.5)
	if cohesion != Vector3.ZERO:
		velocity = velocity.lerp(velocity.normalized() * travel_speed + cohesion, 0.05)

func _on_exit_travel() -> void:
	_rect_waypoints.clear()

func _on_enter_defend() -> void:
	_update_weapon_visibility(true)
	velocity = Vector3.ZERO

func _on_tick_defend(_delta: float) -> void:
	pass

func _on_exit_defend() -> void:
	_update_weapon_visibility(false)

func _on_enter_flee() -> void:
	velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * get_flee_speed(flee_speed)

func _on_tick_flee(_delta: float) -> void:
	var vision: VisionCone = _vision_cone
	var threat: Node3D = null
	if vision != null:
		threat = vision.closest_visible("wolf")
		if threat == null:
			threat = vision.closest_visible("boar")
	if threat != null and is_instance_valid(threat):
		var away := (global_position - threat.global_position).normalized()
		# Flee toward settlement if protected or one exists
		if _settlement_center != Vector3.ZERO:
			var to_shelter := (_settlement_center - global_position).normalized()
			away = (away + to_shelter * 1.5).normalized()
		velocity = away * get_flee_speed(flee_speed)
	elif _settlement_center != Vector3.ZERO:
		var to_shelter := (_settlement_center - global_position).normalized()
		velocity = to_shelter * get_flee_speed(flee_speed)

func _on_exit_flee() -> void:
	pass

func _on_enter_rest() -> void:
	velocity = Vector3.ZERO

func _on_tick_rest(delta: float) -> void:
	health += rest_regen * delta
	health = clampf(health, 0.0, 100.0)
	# Rest halves hunger; food still has to be found.
	energy += metabolism_rate * 0.5 * delta
	energy = clampf(energy, 0.0, 100.0)

func _on_exit_rest() -> void:
	pass

func _on_enter_channel() -> void:
	velocity = Vector3.ZERO

# The wizard's round: feed the village if carrying mushrooms, cleanse rot,
# conjure rain over thin fields, otherwise go picking magic mushrooms.
func _on_tick_channel(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	if _mushroom_target != null and is_instance_valid(_mushroom_target) and _mushroom_target.is_inside_tree():
		if global_position.distance_squared_to(_mushroom_target.global_position) < 2.5:
			devour(_mushroom_target)
			_mushroom_target = null
			magic_mushrooms += 1
			velocity = Vector3.ZERO
			FXManager.show_floating_text(global_position + Vector3.UP * 2.2, "Magic mushroom", Color(0.82, 0.55, 1.0))
		else:
			velocity = (_mushroom_target.global_position - global_position).normalized() * travel_speed * 0.8
		return
	_mushroom_target = null
	velocity = Vector3.ZERO
	_channel_timer -= delta
	if _channel_timer > 0.0:
		return
	_channel_timer = 4.0
	var home := _settlement_center if _settlement_center != Vector3.ZERO else global_position
	var cast := ""
	if magic_mushrooms > 0:
		var fed: int = 0
		for node in sim.get_nearby_humans(global_position, 10.0):
			if node == self or fed >= 4:
				continue
			node._set_blessed(30.0)
			node.energy = minf(node.energy + 10.0, 100.0)
			fed += 1
		if fed > 0:
			magic_mushrooms -= 1
			cast = "feast"
			FXManager.show_dramatic_text(global_position + Vector3.UP * 2.0, "Mushroom Feast!", Color(0.85, 0.6, 1.0))
	if cast.is_empty() and sim.rot != null and sim.rot.get_density_at_world(global_position) > 0.3:
		Roles._scale_layer(sim.rot, global_position, 6.0, 0.3)
		Roles._till(sim, global_position, 0.1)
		cast = "cleanse"
		FXManager.show_dramatic_text(global_position + Vector3.UP * 2.0, "Rot Cleansed!", Color(0.7, 0.95, 0.75))
	if cast.is_empty() and sim.grass != null and sim.grass.get_density_at_world(home) < 0.35:
		for i: int in 8:
			sim.grass.add_density_at_world(home + Vector3(randf_range(-7, 7), 0.0, randf_range(-7, 7)), 0.25)
		if sim.weather != null:
			sim.weather.rain(2.0)
		cast = "rain"
		FXManager.show_dramatic_text(global_position + Vector3.UP * 2.0, "Conjured Rain!", Color(0.55, 0.78, 1.0))
	if cast.is_empty() and magic_mushrooms < 3:
		var m := sim.find_nearest_mushroom(global_position, 18.0)
		if m != null:
			_mushroom_target = m
			return
	if cast.is_empty():
		var nearest_tree := sim.find_nearest_tree(global_position)
		if randf() < 0.5:
			sim.try_plant_tree_seed(global_position, "human")
			FXManager.show_dramatic_text(global_position + Vector3.UP * 2.0, "Verdant Growth!", Color(0.2, 0.9, 0.3))
		elif nearest_tree != null and nearest_tree.has_method("_spawn_apple") and not nearest_tree._tips.is_empty():
			nearest_tree._spawn_apple(nearest_tree._tips.pick_random())
			FXManager.show_dramatic_text(global_position + Vector3.UP * 2.0, "Apple Bloom!", Color(0.9, 0.4, 0.1))
	energy -= 4.0
	energy = clampf(energy, 0.0, 100.0)
	if energy < 20.0:
		set_state("Gather")

func _on_exit_channel() -> void:
	pass

func _on_enter_build() -> void:
	velocity = Vector3.ZERO

func _on_tick_build(_delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null:
		return
	# Prioritize planting trees
	if wood > 0 and randf() < 0.3:
		wood -= 1
		sim.try_plant_tree_seed(global_position, "human")
		FXManager.show_floating_text(global_position + Vector3.UP, "+Tree", Color(0.3, 0.8, 0.2))
		return
	# Build shelter if none nearby
	if wood > 0:
		var build_pos := _settlement_center if _settlement_center != Vector3.ZERO else global_position
		if not sim.is_position_in_shelter(build_pos, 10.0):
			wood -= 1
			var new_sid := sim.build_shelter(build_pos, _settlement_id)
			if _settlement_center == Vector3.ZERO:
				_settlement_center = build_pos
				_settlement_id = new_sid
			FXManager.show_floating_text(global_position + Vector3.UP, "+Shelter", Color(0.8, 0.6, 0.3))
			return
		# A growing tribe raises more huts around its centre (one per four people).
		if _settlement_id > 0 and sim.homeless_in_tribe(_settlement_id) > 0:
			var ang: float = randf() * TAU
			var spot := sim.dry_land(_settlement_center + Vector3(cos(ang), 0.0, sin(ang)) * randf_range(4.0, 9.0), 3.0)
			if not sim.is_position_in_shelter(spot, 3.0):
				wood -= 1
				sim.build_shelter(spot, _settlement_id)
				FXManager.show_floating_text(global_position + Vector3.UP, "+Hut", Color(0.8, 0.6, 0.3))
				return
	# Harvest trees for more wood
	var nearest_tree := sim.find_nearest_tree(global_position)
	if nearest_tree != null:
		var dist_sq := global_position.distance_squared_to(nearest_tree.global_position)
		if dist_sq < 3.0:
			if nearest_tree.harvest():
				wood += 2
				energy -= 2.0
				energy = clampf(energy, 0.0, 100.0)
				if _settlement_center == Vector3.ZERO:
					_settlement_center = global_position
			velocity = Vector3.ZERO
			return
		else:
			velocity = (nearest_tree.global_position - global_position).normalized() * travel_speed * 0.6
			return
	set_state("Gather")

func _on_exit_build() -> void:
	pass

# March on the rival village, fight whoever defends it, burn a hut if none do.
func _on_enter_raid() -> void:
	_raid_clock = 0.0
	_update_weapon_visibility(true)

func _on_tick_raid(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null or _raid_target == Vector3.ZERO:
		set_state("Gather")
		return
	_raid_clock += delta
	# Raids give up after a while; the survivors walk home.
	if _raid_clock > 25.0:
		_raid_target = Vector3.ZERO
		set_state("Travel")
		return
	var to_target := _raid_target - global_position
	to_target.y = 0.0
	if to_target.length() > 6.0:
		velocity = to_target.normalized() * hunt_speed
		return
	var foe: Node3D = null
	var best: float = 100.0
	for n in sim.get_nearby_agents(global_position, 10.0, "human"):
		var sid = n.get("_settlement_id")
		if n == self or sid == null or int(sid) == _settlement_id or int(sid) <= 0:
			continue
		var d: float = global_position.distance_squared_to(n.global_position)
		if d < best:
			best = d
			foe = n
	if foe != null:
		velocity = (foe.global_position - global_position).normalized() * hunt_speed
		if best < 6.25 and foe is MarkovAgent and CombatSystem.resolve_attack(self, foe as MarkovAgent):
			energy = minf(energy + 10.0, 100.0)
		return
	# Undefended: burn it, take what food there is, go home.
	if sim.raze_hut_near(_raid_target, _settlement_id):
		energy = minf(energy + 20.0, 100.0)
	_raid_target = Vector3.ZERO
	set_state("Travel")

func _on_exit_raid() -> void:
	_update_weapon_visibility(false)

func _update_weapon_visibility(show_it: bool) -> void:
	var weapon := get_node_or_null("WeaponMesh")
	if weapon != null and weapon is MeshInstance3D:
		weapon.visible = show_it

func die() -> void:
	if is_queued_for_deletion():
		return
	var sim: SimulationDirector = director
	if sim != null:
		sim.release_hut(self, home)
		sim.spawn_corpse(global_position, 1.0, "human", golden)
		sim.agent_died.emit("human", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.9, 0.7, 0.5))
	FXManager.show_floating_text(global_position + Vector3.UP, "X", Color(0.9, 0.8, 0.6))
	FXManager.report_death("human")
	queue_free()

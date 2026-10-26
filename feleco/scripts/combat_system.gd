class_name CombatSystem
extends RefCounted

static func _infer_species(node: Node) -> String:
	if node.is_in_group("wolf"): return "wolf"
	if node.is_in_group("sheep"): return "sheep"
	if node.is_in_group("human"): return "human"
	if node.is_in_group("boar"): return "boar"
	if node.is_in_group("falcon"): return "falcon"
	if node.is_in_group("robin"): return "robin"
	if node.is_in_group("worm"): return "worm"
	if node.is_in_group("rabbit"): return "rabbit"
	if node.is_in_group("fish"): return "fish"
	if node.is_in_group("spore"): return "mushroom"
	for id: String in SpeciesDB.NEW_SPECIES:
		if node.is_in_group(id): return id
	return "unknown"

# Chance a strike kills outright (attacker>target). A miss still wounds.
# Prey that can dodge, dive or scatter make hunters work for each meal.
const HUNT: Dictionary = {
	"falcon>robin": 0.35, "falcon>rabbit": 0.5, "falcon>fish": 0.45,
	"wolf>rabbit": 0.5, "wolf>robin": 0.5, "wolf>boar": 0.35, "wolf>fish": 0.3,
	"human>rabbit": 0.4, "human>boar": 0.35, "human>human": 0.15,
	"boar>wolf": 0.3, "boar>human": 0.3,
	# 3.0: mountain lions ambush alone; bears fish and dig out rabbits.
	"lion>rabbit": 0.55, "lion>robin": 0.4, "lion>sheep": 0.45, "lion>deer": 0.4, "lion>goat": 0.35, "lion>fish": 0.3,
	"bear>rabbit": 0.35, "bear>fish": 0.45, "bear>wolf": 0.3, "bear>lion": 0.25,
	"wolf>deer": 0.35, "wolf>goat": 0.3, "wolf>beetle": 0.6,
	"falcon>beetle": 0.6, "robin>beetle": 0.7, "robin>fish": 0.2,
	"human>deer": 0.35, "human>goat": 0.35, "human>bear": 0.2, "human>lion": 0.2,
	"fish>beetle": 0.6,
}

static func resolve_attack(attacker, target) -> bool:
	# Cooldown gate
	var attacker_cd: float = attacker.get("_attack_cooldown")
	if attacker_cd == null:
		attacker_cd = 0.0
	var target_cd: float = target.get("_attack_cooldown")
	if target_cd == null:
		target_cd = 0.0
	if attacker_cd > 0.0 or target_cd > 0.0:
		return false
	# Tuning Lab "hunt": below 1 more attacks miss outright, above 1 they hit harder.
	var hunt_mult: float = 1.0
	var tune_sim = attacker.get("director")
	if tune_sim != null and tune_sim.has_method("tune"):
		hunt_mult = float(tune_sim.tune(String(attacker.get("species_id")), "hunt"))
	if hunt_mult < 1.0 and randf() > hunt_mult:
		return false
	# Herds protect the middle: an attack on a creature deep in its group
	# often fails, and a hunter fighting from the middle of its pack hits harder.
	var t_herd = target.get("herd")
	if t_herd != null and randf() < 0.25 * float(t_herd):
		return false
	var a_herd = attacker.get("herd")
	if a_herd != null:
		hunt_mult *= 1.0 + 0.2 * float(a_herd)
	# Nobody gets dragged out of bed: villagers indoors can't be attacked.
	if target.get("indoors") == true:
		return false
	# Lantern Night: the lit villages and their sheep are off the menu.
	var lantern_sim = attacker.get("director")
	if lantern_sim != null and lantern_sim.has_method("lantern_safe") and target is Node3D and lantern_sim.lantern_safe(target):
		return false

	var base_damage = attacker.get("damage")
	if base_damage == null:
		base_damage = 0.0
	var damage: float = base_damage * (1.0 + randf() * 0.2) * maxf(hunt_mult, 1.0)
	var attacker_is_wolf: bool = attacker.is_in_group("wolf")
	var attacker_is_human: bool = attacker.is_in_group("human")
	var target_is_sheep: bool = target.is_in_group("sheep")
	var target_is_wolf: bool = target.is_in_group("wolf")
	var target_is_human: bool = target.is_in_group("human")

	var kill: bool = false
	var wound_damage: float = 0.0

	var hunt_key: String = _infer_species(attacker) + ">" + _infer_species(target)
	var season_dir: SimulationDirector = attacker.get("director")
	var winter: bool = season_dir != null and season_dir.get_season() == "Winter"
	if attacker_is_wolf and target_is_sheep:
		# A tight flock protects its own; winter wolves are hungrier and bolder.
		var flock: int = 0
		if season_dir != null:
			flock = season_dir.get_nearby_agents(target.global_position, 5.0, "sheep").size()
		var p: float = 0.45 if flock < 4 else 0.28
		if winter:
			p += 0.12
		if randf() <= p:
			kill = true
		else:
			wound_damage = damage * 0.3
	elif HUNT.has(hunt_key):
		var p2: float = HUNT[hunt_key] + (0.1 if winter and attacker_is_wolf else 0.0)
		if randf() <= p2:
			kill = true
		else:
			wound_damage = damage * 0.25
	elif attacker_is_human and target_is_wolf:
		var party_size: int = 1
		var director: SimulationDirector = attacker.director
		if director != null:
			party_size = director.human_party_size_check(attacker)
		party_size = maxi(party_size, 1)
		var kill_prob: float = clampf(float(party_size) / 3.0, 0.3, 1.0)
		if randf() <= kill_prob:
			kill = true
	elif attacker_is_wolf and target_is_human:
		var pack_size: int = 1
		var director: SimulationDirector = attacker.director
		if director != null:
			pack_size = 1 + director.get_presence_count(attacker.global_position, 8.0, "wolves")
		var kill_prob: float = clampf(float(pack_size) * 0.35, 0.0, 1.0)
		if randf() <= kill_prob:
			kill = true
		else:
			wound_damage = damage * 0.3
	else:
		var target_health = target.get("health")
		if target_health == null:
			target_health = 0.0
		if attacker_is_human and target_is_sheep:
			if randf() <= 0.25:
				kill = true
			else:
				wound_damage = damage * 0.3
		elif attacker_is_human and target.is_in_group("robin"):
			if randf() <= 0.25:
				kill = true
			else:
				wound_damage = damage * 0.3
		elif damage >= target_health:
			kill = true
		else:
			wound_damage = damage

	# The last few of a species are hard to find and finish.
	if kill and season_dir != null and randf() > season_dir.refuge(_infer_species(target)):
		kill = false
		wound_damage = damage * 0.25
	# Tough kinds shrug off some killing blows.
	if kill and target.get("role") == "tough" and randf() < 0.35:
		kill = false
		wound_damage = damage * 0.3
		FXManager.show_floating_text(target.global_position + Vector3.UP * 2.0, "Shrugs it off", Color(0.9, 0.85, 0.7))

	var sim: SimulationDirector = attacker.director if attacker.get("director") != null else null
	var attacker_species: String = _infer_species(attacker)
	var target_species: String = _infer_species(target)
	var pos: Vector3 = target.global_position if target is Node3D else Vector3.ZERO

	if kill:
		attacker._attack_cooldown = 1.0
		# A golden kill passes most of its gold up to the hunter.
		var tg = target.get("golden")
		if tg != null and float(tg) > 0.0 and attacker.has_method("make_golden"):
			attacker.make_golden(float(tg) * 0.7, _infer_species(target))
		var th = target.get("health")
		if th != null:
			target.health = 0.0
		FXManager.spawn_combat_particles(target.global_position if target is Node3D else Vector3.ZERO)
		FXManager.show_floating_text(target.global_position if target is Node3D else Vector3.ZERO, str(int(damage)), Color(0.9, 0.1, 0.1), true)
		if sim != null:
			sim.combat_event.emit(attacker_species, target_species, pos, true)
		# Drop them now. Waiting for the victim's next think let gold or herd
		# mending run first and erase the kill. die() ignores a second call.
		if target.has_method("die"):
			target.die()
		return true
	else:
		if wound_damage > 0.0:
			var th = target.get("health")
			if th != null:
				target.health = maxf(th - wound_damage, 0.0)
			FXManager.spawn_combat_particles(target.global_position if target is Node3D else Vector3.ZERO)
			FXManager.show_floating_text(target.global_position if target is Node3D else Vector3.ZERO, str(int(wound_damage)), Color(0.9, 0.5, 0.1))
			target._attack_cooldown = 0.5
			# Prey escape burst: wounded animals sprint away
			target._flee_boost_timer = 1.5
			target._flee_boost_mult = 1.6
			if sim != null:
				sim.combat_event.emit(attacker_species, target_species, pos, false)
		attacker._attack_cooldown = 0.5
		return false

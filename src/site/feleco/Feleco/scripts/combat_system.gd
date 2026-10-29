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
	if node.is_in_group("spore"): return "mushroom"
	return "unknown"

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

	var base_damage = attacker.get("damage")
	if base_damage == null:
		base_damage = 0.0
	var damage: float = base_damage * (1.0 + randf() * 0.2)
	var attacker_is_wolf: bool = attacker.is_in_group("wolf")
	var attacker_is_human: bool = attacker.is_in_group("human")
	var target_is_sheep: bool = target.is_in_group("sheep")
	var target_is_wolf: bool = target.is_in_group("wolf")
	var target_is_human: bool = target.is_in_group("human")

	var kill: bool = false
	var wound_damage: float = 0.0

	if attacker_is_wolf and target_is_sheep:
		if randf() <= 0.55:
			kill = true
		else:
			wound_damage = damage * 0.3
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

	var sim: SimulationDirector = attacker.director if attacker.get("director") != null else null
	var attacker_species: String = _infer_species(attacker)
	var target_species: String = _infer_species(target)
	var pos: Vector3 = target.global_position if target is Node3D else Vector3.ZERO

	if kill:
		attacker._attack_cooldown = 1.0
		var th = target.get("health")
		if th != null:
			target.health = 0.0
		FXManager.spawn_combat_particles(target.global_position if target is Node3D else Vector3.ZERO)
		FXManager.show_floating_text(target.global_position if target is Node3D else Vector3.ZERO, str(int(damage)), Color(0.9, 0.1, 0.1), true)
		if sim != null:
			sim.combat_event.emit(attacker_species, target_species, pos, true)
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

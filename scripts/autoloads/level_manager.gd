extends Node

const SAVE_FILE: String = "user://physix_save.dat"

# World definitions — each world introduces a new physics concept
# SIX theme: 6 worlds × 6 levels = 36 main levels
const WORLDS: Dictionary = {
	1: { "name": "Beginner's Slope",   "levels": 6, "color": Color(0.20, 0.78, 0.35), "unlock_stars": 0,  "concept": "Gravity & Motion" },
	2: { "name": "Friction Falls",     "levels": 6, "color": Color(0.20, 0.55, 0.90), "unlock_stars": 6,  "concept": "Friction & Momentum" },
	3: { "name": "Gravity Gulch",      "levels": 6, "color": Color(0.90, 0.60, 0.10), "unlock_stars": 18, "concept": "Variable Gravity" },
	4: { "name": "Momentum Mountain",  "levels": 6, "color": Color(0.80, 0.15, 0.15), "unlock_stars": 36, "concept": "Collisions & Energy" },
	5: { "name": "Quantum Peaks",      "levels": 6, "color": Color(0.70, 0.10, 0.90), "unlock_stars": 54, "concept": "Wind & Fluid Dynamics" },
	6: { "name": "The Sixth Force",    "levels": 6, "color": Color(0.10, 0.80, 0.85), "unlock_stars": 72, "concept": "Magnetism & Polarity" },
}

const BONUS_LEVELS: Dictionary = {
	1: { "name": "Bonus: Hexa-Rush",         "reward_coins": 10, "reward_lives": 1 },
	2: { "name": "Bonus: Friction Hex",      "reward_coins": 15, "reward_lives": 1 },
	3: { "name": "Bonus: Grav-6",            "reward_coins": 20, "reward_lives": 1 },
	4: { "name": "Bonus: Bumper Hexagon",    "reward_coins": 25, "reward_lives": 1 },
	5: { "name": "Bonus: Wind Tunnel 6",     "reward_coins": 30, "reward_lives": 2 },
	6: { "name": "Bonus: The Ultimate Hex",  "reward_coins": 36, "reward_lives": 2 },
}

const SECRET_LEVELS: Dictionary = {
	1: { "name": "Secret Gauntlet S-1", "reward_coins": 50, "reward_lives": 3 },
	2: { "name": "Secret Gauntlet S-2", "reward_coins": 60, "reward_lives": 3 },
}

func is_secret_unlocked() -> bool:
	return save_data.get("secret_unlocked", false)

func unlock_secret() -> void:
	save_data["secret_unlocked"] = true
	save_progress()

func is_secret_level(world: int, level: int) -> bool:
	return world == 0 and level >= 1 and level <= 2

func get_secret_scene_path(world: int, level: int) -> String:
	return "res://scenes/levels/secret/secret_%d_%d.tscn" % [world, level]

var save_data: Dictionary = {}

signal level_unlocked(world: int, level: int)
signal world_unlocked(world: int)

func _ready() -> void:
	load_progress()

func get_world_data(world: int) -> Dictionary:
	return WORLDS.get(world, {})

func is_level_unlocked(world: int, level: int) -> bool:
	if world == 1 and level == 1:
		return true
	if is_secret_level(world, level):
		return is_secret_unlocked()
	return save_data.get("unlocked", {}).get(_key(world, level), false)

func is_world_unlocked(world: int) -> bool:
	if world == 1:
		return true
	# To unlock a world, every level in the previous world must have at least 2 stars
	var prev_world: int = world - 1
	if not WORLDS.has(prev_world):
		return false
	var world_data: Dictionary = WORLDS[prev_world]
	var level_count: int = world_data.get("levels", 6)
	for lvl: int in range(1, level_count + 1):
		if get_level_stars(prev_world, lvl) < 2:
			return false
	return true

func get_level_stars(world: int, level: int) -> int:
	return save_data.get("stars", {}).get(_key(world, level), 0)

func get_level_rank(world: int, level: int) -> String:
	return save_data.get("ranks", {}).get(_key(world, level), "")

func get_best_time(world: int, level: int) -> float:
	return save_data.get("best_times", {}).get(_key(world, level), INF)

func set_best_time(world: int, level: int, time: float) -> bool:
	var key := _key(world, level)
	var prev: float = save_data.get("best_times", {}).get(key, INF)
	if time < prev:
		save_data.get_or_add("best_times", {})[key] = time
		save_progress()
		return true
	return false

func is_bonus_completed(world: int) -> bool:
	return save_data.get("bonuses", {}).get(world, false)

func complete_bonus(world: int) -> void:
	if is_bonus_completed(world):
		return
	save_data.get_or_add("bonuses", {})[world] = true
	var rewards: Dictionary = BONUS_LEVELS.get(world, {})
	var coin_reward: int = rewards.get("reward_coins", 0)
	var life_reward: int = rewards.get("reward_lives", 0)
	for _i: int in range(coin_reward):
		GameManager.add_coin()
	for _i: int in range(life_reward):
		GameManager.add_life()
	save_progress()

func get_level_scene_path(world: int, level: int) -> String:
	return "res://scenes/levels/world_%d/level_%d_%d.tscn" % [world, world, level]

func get_bonus_scene_path(world: int) -> String:
	return "res://scenes/levels/bonus/bonus_%d.tscn" % world

func complete_level(world: int, level: int, stars: int, rank: String = "") -> void:
	var prev_stars: int = get_level_stars(world, level)
	if stars > prev_stars:
		save_data.get_or_add("stars", {})[_key(world, level)] = stars
		GameManager.total_stars += stars - prev_stars

	var prev_rank: String = get_level_rank(world, level)
	var rank_order := ["F", "D", "C", "B", "A", "S", "S+"]
	var prev_idx := rank_order.find(prev_rank)
	var new_idx := rank_order.find(rank)
	if new_idx > prev_idx:
		save_data.get_or_add("ranks", {})[_key(world, level)] = rank

	# Unlock the next level or next world
	var world_data: Dictionary = WORLDS.get(world, {})
	var next_level: int = level + 1
	if next_level <= world_data.get("levels", 0):
		_unlock(world, next_level)
	else:
		var next_world: int = world + 1
		if WORLDS.has(next_world) and is_world_unlocked(next_world):
			_unlock(next_world, 1)
			world_unlocked.emit(next_world)

	save_progress()

func reset_progress() -> void:
	save_data = {}
	_unlock(1, 1)
	# Preserve shop purchases across resets? No — full reset clears everything.
	save_progress()

func save_progress() -> void:
	var file := FileAccess.open(SAVE_FILE, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save_data))

func load_progress() -> void:
	if FileAccess.file_exists(SAVE_FILE):
		var file := FileAccess.open(SAVE_FILE, FileAccess.READ)
		if file:
			var text := file.get_as_text()
			if not text.is_empty():
				var parsed: Variant = JSON.parse_string(text)
				if parsed is Dictionary:
					save_data = parsed
				else:
					# Corrupted save — back it up and start fresh
					push_warning("Save file corrupted; backing up and resetting.")
					DirAccess.rename_absolute(SAVE_FILE, SAVE_FILE + ".backup")
	_unlock(1, 1)

func _unlock(world: int, level: int) -> void:
	var key := _key(world, level)
	if not save_data.get("unlocked", {}).get(key, false):
		save_data.get_or_add("unlocked", {})[key] = true
		level_unlocked.emit(world, level)

# ── Shop helpers ──────────────────────────────────────────────────────────────

func has_shop_item(item_id: String) -> bool:
	return save_data.get("shop_items", {}).get(item_id, false)

func buy_shop_item(item_id: String) -> void:
	save_data.get_or_add("shop_items", {})[item_id] = true
	save_progress()

func get_equipped_skin() -> String:
	return save_data.get("equipped_skin", "")

func equip_skin(skin_id: String) -> void:
	save_data["equipped_skin"] = skin_id
	save_progress()

func get_equipped_theme() -> String:
	return save_data.get("equipped_theme", "")

func equip_theme(theme_id: String) -> void:
	save_data["equipped_theme"] = theme_id
	save_progress()

func get_equipped_material() -> String:
	return save_data.get("equipped_material", "")

func equip_material(mat_id: String) -> void:
	save_data["equipped_material"] = mat_id
	save_progress()

func get_equipped_music() -> String:
	return save_data.get("equipped_music", "")

func equip_music(track_id: String) -> void:
	save_data["equipped_music"] = track_id
	save_progress()

func is_music_unlocked(track: String) -> bool:
	return save_data.get("unlocked_music", {}).get(track, false)

func unlock_music(track: String) -> void:
	save_data.get_or_add("unlocked_music", {})[track] = true
	save_progress()

func get_music_mode() -> String:
	return save_data.get("music_mode", "default")

func set_music_mode(mode: String) -> void:
	save_data["music_mode"] = mode
	save_progress()

func is_music_loop_enabled() -> bool:
	return save_data.get("music_loop", true)

func set_music_loop_enabled(enabled: bool) -> void:
	save_data["music_loop"] = enabled
	save_progress()

func get_buff_count(buff_id: String) -> int:
	return save_data.get("buffs", {}).get(buff_id, 0)

func add_buff(buff_id: String, amount: int = 1) -> void:
	var current: int = get_buff_count(buff_id)
	save_data.get_or_add("buffs", {})[buff_id] = current + amount
	save_progress()

func consume_buff(buff_id: String) -> bool:
	var current: int = get_buff_count(buff_id)
	if current > 0:
		save_data.get_or_add("buffs", {})[buff_id] = current - 1
		save_progress()
		return true
	return false

func _key(world: int, level: int) -> String:
	return "%d-%d" % [world, level]

# ── Coin persistence ──────────────────────────────────────────────────────────

func is_coin_collected(world: int, level: int, coin_index: int) -> bool:
	var key := "%d-%d-%d" % [world, level, coin_index]
	return save_data.get("coins_collected", {}).get(key, false)

func collect_coin(world: int, level: int, coin_index: int) -> void:
	var key := "%d-%d-%d" % [world, level, coin_index]
	save_data.get_or_add("coins_collected", {})[key] = true
	save_progress()

func get_level_collected_coins(world: int, level: int) -> int:
	var count := 0
	for key: String in save_data.get("coins_collected", {}).keys():
		var parts: PackedStringArray = key.split("-")
		if parts.size() == 3:
			if int(parts[0]) == world and int(parts[1]) == level:
				count += 1
	return count

func get_total_collected_coins() -> int:
	return save_data.get("coins_collected", {}).size()

# ── Medals ────────────────────────────────────────────────────────────────────

func award_medal(world: int, level: int, medal_id: String) -> void:
	var key := "%s-%s" % [_key(world, level), medal_id]
	if not save_data.get("medals", {}).get(key, false):
		save_data.get_or_add("medals", {})[key] = true
		save_progress()

func has_medal(world: int, level: int, medal_id: String) -> bool:
	var key := "%s-%s" % [_key(world, level), medal_id]
	return save_data.get("medals", {}).get(key, false)

func get_level_medals(world: int, level: int) -> Array[String]:
	var result: Array[String] = []
	var prefix := _key(world, level) + "-"
	for key: String in save_data.get("medals", {}).keys():
		if key.begins_with(prefix):
			result.append(key.substr(prefix.length()))
	return result

# ── Settings persistence ──────────────────────────────────────────────────────

func get_setting(key: String, default: Variant = null) -> Variant:
	return save_data.get("settings", {}).get(key, default)

func set_setting(key: String, value: Variant) -> void:
	save_data.get_or_add("settings", {})[key] = value
	save_progress()

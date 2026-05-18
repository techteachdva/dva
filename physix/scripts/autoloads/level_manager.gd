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
signal music_unlocked(track_id: String)

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

const WORLD_KEY_COSTS: Dictionary = {
	2: 50, 3: 60, 4: 70, 5: 80, 6: 100,
}

func is_world_unlocked(world: int) -> bool:
	if world == 1:
		return true
	if save_data.get("world_key_unlocks", {}).get(str(world), false):
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

func get_next_locked_world() -> int:
	for world: int in range(2, 7):
		if not is_world_unlocked(world):
			return world
	return -1

func get_world_key_cost(world: int) -> int:
	return int(WORLD_KEY_COSTS.get(world, 100))

func unlock_world_with_key(world: int) -> void:
	if world < 2 or world > 6:
		return
	save_data.get_or_add("world_key_unlocks", {})[str(world)] = true
	_unlock(world, 1)
	save_progress()
	world_unlocked.emit(world)

func get_level_stars(world: int, level: int) -> int:
	return save_data.get("stars", {}).get(_key(world, level), 0)

func get_level_rank(world: int, level: int) -> String:
	return save_data.get("ranks", {}).get(_key(world, level), "")

func get_best_time(world: int, level: int) -> float:
	return save_data.get("best_times", {}).get(_key(world, level), INF)

func format_time_display(seconds: float, empty_label: String = "") -> String:
	if seconds >= INF or seconds < 0.0:
		return empty_label
	@warning_ignore("integer_division")
	var minutes := int(seconds) / 60
	var secs := int(seconds) % 60
	return "%d:%02d" % [minutes, secs]

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
	if get_node_or_null("/root/GameManager") != null:
		GameManager.total_stars = recalculate_total_stars()

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
	init_new_session()
	reset_facts_queue()
	save_progress()

func reset_facts_queue() -> void:
	save_data.erase("facts_queue")

func pop_next_fact() -> String:
	var facts: Array[String] = GameplayFacts.ALL_FACTS
	if facts.is_empty():
		return ""
	var queue: Array = save_data.get("facts_queue", [])
	if queue.is_empty():
		queue = _new_shuffled_fact_queue(facts.size())
	var idx: int = int(queue.pop_front())
	save_data["facts_queue"] = queue
	save_progress()
	return facts[idx]

func _new_shuffled_fact_queue(count: int) -> Array:
	var queue: Array = []
	for i: int in range(count):
		queue.append(i)
	queue.shuffle()
	return queue

func init_new_session() -> void:
	save_data["player_coins"] = 0
	save_data["player_lives"] = 3
	save_data["session_game_over"] = false
	apply_session_to_game_manager()

func ensure_session_defaults() -> void:
	if not save_data.has("player_lives"):
		save_data["player_coins"] = int(save_data.get("player_coins", 0))
		save_data["player_lives"] = 3
	if not save_data.has("session_game_over"):
		save_data["session_game_over"] = false
	apply_session_to_game_manager()

func recalculate_total_stars() -> int:
	var total := 0
	for level_key: String in save_data.get("stars", {}).keys():
		total += int(save_data["stars"][level_key])
	return total

func apply_session_to_game_manager() -> void:
	if get_node_or_null("/root/GameManager") == null:
		return
	GameManager.coins = int(save_data.get("player_coins", 0))
	GameManager.lives = int(save_data.get("player_lives", 3))
	GameManager.total_stars = recalculate_total_stars()
	GameManager.coins_changed.emit(GameManager.coins)
	GameManager.lives_changed.emit(GameManager.lives)

func sync_session_from_game_manager() -> void:
	if get_node_or_null("/root/GameManager") == null:
		return
	save_data["player_coins"] = GameManager.coins
	save_data["player_lives"] = GameManager.lives

func is_session_game_over() -> bool:
	return bool(save_data.get("session_game_over", false))

func set_session_game_over(over: bool) -> void:
	save_data["session_game_over"] = over
	sync_session_from_game_manager()
	save_progress()

func clear_session_game_over() -> void:
	if save_data.get("session_game_over", false):
		save_data["session_game_over"] = false
		sync_session_from_game_manager()
		save_progress()

func save_progress() -> void:
	sync_session_from_game_manager()
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
	_migrate_music_unlocks()
	_unlock(1, 1)
	ensure_session_defaults()

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
	var raw: String = save_data.get("equipped_music", "")
	if raw.is_empty():
		return ""
	return music_track_id(raw)

func equip_music(track_or_shop_id: String) -> void:
	save_data["equipped_music"] = music_track_id(track_or_shop_id)
	save_progress()

## Shop IDs use `music_chill`; music menu / AudioManager use `chill`.
func music_track_id(track_or_shop_id: String) -> String:
	if track_or_shop_id.is_empty():
		return ""
	if track_or_shop_id.begins_with("music_"):
		return track_or_shop_id.substr(6)
	return track_or_shop_id

func is_music_unlocked(track_or_shop_id: String) -> bool:
	var track := music_track_id(track_or_shop_id)
	var unlocked: Dictionary = save_data.get("unlocked_music", {})
	if unlocked.get(track, false):
		return true
	if unlocked.get(track_or_shop_id, false):
		return true
	return has_shop_item(track_or_shop_id) or has_shop_item("music_%s" % track)

func unlock_music(track_or_shop_id: String) -> void:
	var track := music_track_id(track_or_shop_id)
	save_data.get_or_add("unlocked_music", {})[track] = true
	if track_or_shop_id.begins_with("music_"):
		save_data["unlocked_music"].erase(track_or_shop_id)
	var shop_id := track_or_shop_id if track_or_shop_id.begins_with("music_") else "music_%s" % track
	save_data.get_or_add("shop_items", {})[shop_id] = true
	save_progress()
	music_unlocked.emit(track)

func _migrate_music_unlocks() -> void:
	var unlocked: Dictionary = save_data.get("unlocked_music", {})
	var changed := false
	var legacy_keys: Array[String] = []
	for key: String in unlocked.keys():
		if key.begins_with("music_"):
			legacy_keys.append(key)
	for key: String in legacy_keys:
		var track := music_track_id(key)
		if unlocked.get(key, false) and not unlocked.get(track, false):
			unlocked[track] = true
		unlocked.erase(key)
		changed = true
	if changed:
		save_data["unlocked_music"] = unlocked
	var equipped: String = save_data.get("equipped_music", "")
	if equipped.begins_with("music_"):
		save_data["equipped_music"] = music_track_id(equipped)
		changed = true
	if changed:
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

# ── Settings persistence ──────────────────────────────────────────────────────

func get_setting(key: String, default: Variant = null) -> Variant:
	return save_data.get("settings", {}).get(key, default)

func set_setting(key: String, value: Variant) -> void:
	save_data.get_or_add("settings", {})[key] = value
	save_progress()

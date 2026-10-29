extends Node

func _ready() -> void:
	if not OS.has_feature("web"):
		return
	var viewport := get_viewport()
	if viewport == null:
		return
	# 3D draws into a smaller buffer. Menus stay at the canvas size.
	viewport.scaling_3d_scale = 0.75
	viewport.msaa_3d = Viewport.MSAA_DISABLED
	viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	viewport.use_taa = false

var sheep_count: int = 10
var wolf_count: int = 10
var human_count: int = 10
var spore_count: int = 10
var player_bet: String = "sheep"
var grass_density: float = 0.5
var time_limit: float = 120.0
var time_setting: String = "3 Months"
var falcon_count: int = 10
var robin_count: int = 10
var boar_count: int = 10
var worm_count: int = 10
var rabbit_count: int = 10
var fish_count: int = 12
var tree_count: int = 10
var map_preset: String = "Random Scatter"

# Event log persists across scenes for results screen review
var event_log: Array[String] = []

# Side bet: player bets on a specific named entity to survive or die
var side_bet_entity: Dictionary = {}  # {name, species, bet_type} where bet_type is "survive" or "die"
var side_bet_result: String = ""  # "won", "lost", or ""

# Starting roster generated in setup board, used to name spawned agents
var spawn_roster: Array[Dictionary] = []

# === Roguelike Meta-Progression ===
var eco_points: int = 0

# Current run mode: "sandbox", "campaign", or "challenge"
var current_mode: String = "sandbox"

# Campaign progress
var campaign_faction: String = ""
var campaign_era: int = 0  # 0-9, 10 = completed
var campaign_traits: Dictionary = {}  # "sheep" -> {"health_boost": true}, etc.

# Challenge progress
var challenge_level: int = 0  # 0 = not started
var challenge_best_streak: int = 0
var challenge_current_streak: int = 0

# Owned permanent upgrades from The Greenhouse shop
# Keys match upgrade IDs (e.g., "foresight_i", "rain_dance", etc.)
var owned_upgrades: Dictionary = {}

# Consumable powerups held for the next run (loaded before simulation)
# Keys: "rain", "predator_call", "heal", "famine", "meteor"
var powerup_inventory: Dictionary = {}

# Session-to-session persistence helper
func save_meta() -> void:
	# Save roguelike progress to a file so it survives game restarts
	var data: Dictionary = {
		"eco_points": eco_points,
		"campaign_faction": campaign_faction,
		"campaign_era": campaign_era,
		"campaign_traits": campaign_traits,
		"challenge_level": challenge_level,
		"challenge_best_streak": challenge_best_streak,
		"owned_upgrades": owned_upgrades,
		"powerup_inventory": powerup_inventory,
	}
	var json := JSON.stringify(data)
	var file := FileAccess.open("user://feleco_meta.save", FileAccess.WRITE)
	if file != null:
		file.store_string(json)
		file.close()

func load_meta() -> void:
	if not FileAccess.file_exists("user://feleco_meta.save"):
		return
	var file := FileAccess.open("user://feleco_meta.save", FileAccess.READ)
	if file == null:
		return
	var json: String = file.get_as_text()
	file.close()
	var parsed = JSON.parse_string(json)
	if parsed is Dictionary:
		var d: Dictionary = parsed
		eco_points = d.get("eco_points", 0)
		campaign_faction = d.get("campaign_faction", "")
		campaign_era = d.get("campaign_era", 0)
		campaign_traits = d.get("campaign_traits", {}) if d.get("campaign_traits") is Dictionary else {}
		challenge_level = d.get("challenge_level", 0)
		challenge_best_streak = d.get("challenge_best_streak", 0)
		owned_upgrades = d.get("owned_upgrades", {}) if d.get("owned_upgrades") is Dictionary else {}
		powerup_inventory = d.get("powerup_inventory", {}) if d.get("powerup_inventory") is Dictionary else {}

func reset_run_state() -> void:
	# Called when entering the main menu or starting a new run
	# Clears per-run data but preserves meta-progression
	event_log.clear()
	side_bet_entity.clear()
	side_bet_result = ""
	spawn_roster.clear()
	current_mode = "sandbox"

func award_eco_points(amount: int) -> void:
	eco_points += amount
	save_meta()

func spend_eco_points(amount: int) -> bool:
	if eco_points < amount:
		return false
	eco_points -= amount
	save_meta()
	return true

func apply_upgrades() -> void:
	# Shepherd's Blessing: +15% population for bet species
	if owned_upgrades.get("shepherds_blessing", false):
		match player_bet.to_lower():
			"sheep": sheep_count = int(sheep_count * 1.15)
			"wolves": wolf_count = int(wolf_count * 1.15)
			"wolf": wolf_count = int(wolf_count * 1.15)
			"humans": human_count = int(human_count * 1.15)
			"human": human_count = int(human_count * 1.15)
			"falcons": falcon_count = int(falcon_count * 1.15)
			"falcon": falcon_count = int(falcon_count * 1.15)
			"robins": robin_count = int(robin_count * 1.15)
			"robin": robin_count = int(robin_count * 1.15)
			"boars": boar_count = int(boar_count * 1.15)
			"boar": boar_count = int(boar_count * 1.15)
			"rabbits": rabbit_count = int(rabbit_count * 1.15)
			"rabbit": rabbit_count = int(rabbit_count * 1.15)
			"worms": worm_count = int(worm_count * 1.15)
			"worm": worm_count = int(worm_count * 1.15)
			"fish": fish_count = int(fish_count * 1.15)

	# Time Dilation: +10% time limit
	if owned_upgrades.get("time_dilation", false):
		time_limit *= 1.1

	# Rain Dance: start with 1 free Rain powerup
	if owned_upgrades.get("rain_dance", false):
		powerup_inventory["rain"] = powerup_inventory.get("rain", 0) + 1

	# Cloning Vat: not applied here; handled in SimulationDirector by respawning extinct species
	# Foresight I/II: UI-only upgrades, handled in setup board
	# Side Eye: allows 2 side bets (UI handled in setup board)

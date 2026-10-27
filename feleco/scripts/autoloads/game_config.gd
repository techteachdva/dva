extends Node

func _ready() -> void:
	# Phones held upright get a portrait canvas, so menus stay readable
	# instead of shrinking a 1280-wide landscape layout onto a narrow screen.
	get_window().size_changed.connect(_fit_orientation)
	_fit_orientation()
	if not OS.has_feature("web"):
		return
	var viewport := get_viewport()
	if viewport == null:
		return
	viewport.msaa_3d = Viewport.MSAA_DISABLED
	viewport.screen_space_aa = Viewport.SCREEN_SPACE_AA_DISABLED
	viewport.use_taa = false
	get_window().size_changed.connect(_fit_3d_budget)
	_fit_3d_budget()

# The page renders at the screen's full pixel density (allow_hidpi), so menus
# and text are sharp on phones. The 3D valley gets a pixel budget instead:
# on a 3x phone screen it draws at a fraction of full density and is
# upscaled, which keeps it smooth while still far crisper than before.
const PIXELS_3D_MOBILE: float = 1_300_000.0
const PIXELS_3D_DESKTOP: float = 2_400_000.0

func _fit_3d_budget() -> void:
	var viewport := get_viewport()
	var px: Vector2i = get_window().size
	if viewport == null or px.x <= 0 or px.y <= 0:
		return
	var mobile: bool = OS.has_feature("web_android") or OS.has_feature("web_ios") or DisplayServer.is_touchscreen_available()
	var budget: float = PIXELS_3D_MOBILE if mobile else PIXELS_3D_DESKTOP
	viewport.scaling_3d_scale = clampf(sqrt(budget / float(px.x * px.y)), 0.45, 1.0)

func _fit_orientation() -> void:
	var win := get_window()
	var portrait: bool = win.size.y > win.size.x
	var want := Vector2i(720, 1280) if portrait else Vector2i(1280, 720)
	if win.content_scale_size != want:
		win.content_scale_size = want

# F11 or Alt+Enter toggles fullscreen anywhere in the game.
func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key == null or not key.pressed or key.echo:
		return
	if key.keycode == KEY_F11 or (key.keycode == KEY_ENTER and key.alt_pressed):
		toggle_fullscreen()
		get_viewport().set_input_as_handled()

func toggle_fullscreen() -> void:
	var mode := DisplayServer.window_get_mode()
	var full: bool = mode == DisplayServer.WINDOW_MODE_FULLSCREEN or mode == DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)

var sheep_count: int = 10
var wolf_count: int = 10
var human_count: int = 10
var spore_count: int = 10
var player_bet: String = "sheep"
var grass_density: float = 0.5
# Run length in sun-and-moon days (see Clock.RUNS).
var time_limit: float = Clock.STANDARD_DAYS
var time_setting: String = "Standard"
var falcon_count: int = 10
var robin_count: int = 10
var boar_count: int = 10
var worm_count: int = 10
var rabbit_count: int = 10
var fish_count: int = 8
# 3.0 species, by id (see SpeciesDB.NEW_SPECIES). Missing ids use the registry start count.
var extra_counts: Dictionary = {}
var bush_count: int = 5
# Species ids left out of the run entirely (Sandbox switches, Challenge scenarios).
var disabled_species: Array = []
# Golden grass, fruit and moss chance multiplier (Golden Year, Green Thumb).
var golden_mult: float = 1.0
# The Challenge scenario being played ("" outside Challenge mode).
var scenario_id: String = ""
# The opening film plays once, on first launch.
var intro_seen: bool = false
# Campaign game records: {"golf": {"1": "A", ...}, "brawl": {...}}.
var records: Dictionary = {}

func record(game: String, key: String) -> Variant:
	return (records.get(game, {}) as Dictionary).get(key, null)

func set_record(game: String, key: String, value: Variant) -> void:
	if not records.has(game):
		records[game] = {}
	records[game][key] = value
	save_meta()

# Link boons: winning a food-web game lends its link a little strength in
# the Valley campaign. Carnivore champions make every carnivore hardier,
# clans that ruled Valley Dominion make omnivores live longer, race golds
# make herbivores quicker, and strong seedlings give the valley more trees
# and a richer meadow. Derived from the records each time; never saved.
# group -> {"health"/"speed"/"lifespan": mult, "trees": int, "grass": float, "text": String}.
func link_boons() -> Dictionary:
	var out: Dictionary = {}
	var brawl: Dictionary = records.get("brawl", {})
	if not brawl.is_empty():
		var best: int = 0
		for v in brawl.values():
			var i: int = ["cub", "hunter", "dire"].find(String(v))
			best = maxi(best, i if i >= 0 else 1)
		var mult: float = [1.05, 1.1, 1.15][best]
		out["carnivore"] = {"health": mult, "text": "Carnivores start with %d%% more health" % int(round((mult - 1.0) * 100.0))}
	var dom: Dictionary = records.get("dominion", {})
	if not dom.is_empty():
		var mult: float = 1.0 + 0.05 * mini(dom.size(), 4)
		out["omnivore"] = {"lifespan": mult, "text": "Omnivores live %d%% longer" % int(round((mult - 1.0) * 100.0))}
	var golds: int = 0
	for v in (records.get("race", {}) as Dictionary).values():
		if String(v) == "Gold":
			golds += 1
	if golds > 0:
		out["herbivore"] = {"speed": 1.0 + 0.02 * golds, "text": "Herbivores run %d%% faster" % (2 * golds)}
	var strong: int = 0
	for v in (records.get("golf", {}) as Dictionary).values():
		if String(v) in ["A", "S"]:
			strong += 1
	if strong > 0:
		out["producer"] = {"trees": (strong + 1) / 2, "grass": 0.02 * strong, "text": "The valley starts with %d more tree%s and a richer meadow" % [(strong + 1) / 2, "" if (strong + 1) / 2 == 1 else "s"]}
	return out

# The first-run welcome card and starter goals have been seen.
var tutorial_done: bool = false
# Upgrades are earned, not bought: each Rampage won (RAMPAGE_GOAL kills before
# the gold runs out) unlocks the next one in this order.
const UPGRADE_ORDER: Array[String] = ["rain_dance", "foresight_i", "long_days", "green_thumb", "side_eye", "time_dilation", "cloning_vat"]
const RAMPAGE_GOAL: int = 12

# Returns the id unlocked, or "" when every upgrade is already earned.
func unlock_next_upgrade() -> String:
	for id: String in UPGRADE_ORDER:
		if not owned_upgrades.get(id, false):
			owned_upgrades[id] = true
			save_meta()
			return id
	return ""
var tree_count: int = 10
var map_preset: String = "Random Scatter"

# Event log persists across scenes for results screen review
var event_log: Array[String] = []

# Side bet: player bets on a specific named entity to survive or die
var side_bet_entity: Dictionary = {}  # {name, species, bet_type} where bet_type is "survive" or "die"
var side_bet_result: String = ""  # "won", "lost", or ""

# Ecosystem Roulette: every bet on this run (see BetBook), and the last
# run's bets for the table's Repeat button.
var bets: Array[Dictionary] = []
var last_bets: Array[Dictionary] = []

# Tuning Lab: per-species multipliers the player sets by hand (1.0 = the
# game's default). species -> {birth, death, hunger, speed, capacity}.
# See scripts/ui/tuning_lab.gd. Saved with the meta save.
const TUNING_KEYS: Array[String] = ["birth", "death", "hunger", "speed", "hunt", "capacity"]
var tuning: Dictionary = {}

func tune(species: String, key: String) -> float:
	var row: Dictionary = tuning.get(species, {})
	return float(row.get(key, 1.0))

func is_tuned() -> bool:
	for sp: String in tuning.keys():
		for k: String in tuning[sp].keys():
			if not is_equal_approx(float(tuning[sp][k]), 1.0):
				return true
	return false

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
		"intro_seen": intro_seen,
		"tutorial_done": tutorial_done,
		"records": records,
		"powerup_inventory": powerup_inventory,
		"last_bets": last_bets,
		"tuning": tuning,
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
		intro_seen = bool(d.get("intro_seen", false))
		tutorial_done = bool(d.get("tutorial_done", false))
		records = d.get("records", {}) if d.get("records") is Dictionary else {}
		powerup_inventory = d.get("powerup_inventory", {}) if d.get("powerup_inventory") is Dictionary else {}
		tuning = d.get("tuning", {}) if d.get("tuning") is Dictionary else {}
		last_bets.clear()
		if d.get("last_bets") is Array:
			for b in d["last_bets"]:
				if b is Dictionary:
					last_bets.append(b)

func reset_run_state() -> void:
	# Called when entering the main menu or starting a new run
	# Clears per-run data but preserves meta-progression
	event_log.clear()
	side_bet_entity.clear()
	side_bet_result = ""
	spawn_roster.clear()
	bets.clear()
	current_mode = "sandbox"

func award_eco_points(amount: int) -> void:
	eco_points += amount
	save_meta()

# Places a bet: the stake leaves the pot now; a win pays stake x mult.
func place_bet(bet: Dictionary, stake: int) -> bool:
	if stake <= 0 or not spend_eco_points(stake):
		return false
	var b := bet.duplicate(true)
	b["stake"] = stake
	b["state"] = "open"
	b["payout"] = 0
	bets.append(b)
	return true

func staked_total() -> int:
	var t: int = 0
	for b: Dictionary in bets:
		t += int(b.get("stake", 0))
	return t

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

	# Time Dilation: one more day in every run.
	if owned_upgrades.get("time_dilation", false):
		time_limit += 1.0

	# Rain Dance: start with 1 free Rain powerup
	if owned_upgrades.get("rain_dance", false):
		powerup_inventory["rain"] = powerup_inventory.get("rain", 0) + 1

	# Cloning Vat: not applied here; handled in SimulationDirector by respawning extinct species
	# Foresight I/II: UI-only upgrades, handled in setup board
	# Side Eye: allows 2 side bets (UI handled in setup board)

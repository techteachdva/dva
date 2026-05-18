extends Node

# TestHarness — automated level testing for all 36 base + 6 bonus levels.
# Usage: call TestHarness.start_test_run() from anywhere.
# Results are printed to the console and saved to user://test_results.json.

const RESULTS_FILE := "user://test_results.json"
const LEVEL_TIMEOUT_SEC: float = 90.0

var _current_world: int = 1
var _current_level: int = 1
var _is_bonus: bool = false
var _results: Array[Dictionary] = []
var _running: bool = false
var _bot: Node = null
var _level_node: Node = null
var _start_time: float = 0.0
var _max_level: int = 6
var _timeout_timer: Timer = null

func start_test_run() -> void:
	if _running:
		push_warning("TestHarness: already running")
		return
	_running = true
	_results.clear()
	_current_world = 1
	_current_level = 1
	_is_bonus = false
	GameManager.reset_for_new_game()
	GameManager.lives = 99  # give the bot plenty of lives
	if _timeout_timer == null:
		_timeout_timer = Timer.new()
		_timeout_timer.one_shot = true
		_timeout_timer.timeout.connect(_on_level_timeout)
		add_child(_timeout_timer)
	print("═══ TEST HARNESS STARTED ═══")
	_load_next_level()

func _load_next_level() -> void:
	if not _running:
		return

	var level_key: String = _level_key()
	print("\n▶ Loading level %s..." % level_key)

	# Reset per-level stats so each level is tested independently
	GameManager.level_deaths = 0
	GameManager.level_coins = 0
	GameManager.level_hoops_passed = 0
	GameManager.level_obstacles_cleared = 0
	GameManager.level_total_obstacles = 0

	# Unload previous
	if _level_node != null and is_instance_valid(_level_node):
		_level_node.queue_free()
		_level_node = null

	# Load via Main if available, otherwise direct
	if Main.instance != null:
		if _is_bonus:
			Main.instance.load_bonus_level(_current_world)
		else:
			Main.instance.load_level(_current_world, _current_level)
	else:
		var path: String = LevelManager.get_level_scene_path(_current_world, _current_level)
		var packed: PackedScene = load(path)
		if packed == null:
			print("  X FAILED TO LOAD: %s" % path)
			_advance()
			return
		_level_node = packed.instantiate()
		get_tree().current_scene.add_child(_level_node)

	# Wait for level to initialise (physics + one full frame)
	await get_tree().physics_frame
	await get_tree().process_frame

	# Find the GameLevel node
	var game_level: Node = null
	var world: Node = null
	if Main.instance != null:
		world = Main.instance.world
	else:
		world = get_tree().current_scene
	for child: Node in world.get_children():
		if child.has_signal("level_completed"):
			game_level = child
			break

	if game_level == null:
		print("  X GameLevel node not found")
		_advance()
		return

	# Store reference so disconnect works even when Main.instance reloads
	_level_node = game_level
	if not game_level.level_completed.is_connected(_on_level_completed):
		game_level.level_completed.connect(_on_level_completed.bind(game_level))
	if not game_level.level_failed.is_connected(_on_level_failed):
		game_level.level_failed.connect(_on_level_failed.bind(game_level))

	# Find player and attach bot
	var player: Node = null
	for node: Node in game_level.get_tree().get_nodes_in_group("player"):
		player = node
		break

	if player != null:
		var bot_scene := load("res://scripts/bot_controller.gd") as Script
		if bot_scene != null:
			# Remove any existing bot first
			var old_bot := player.get_node_or_null("BotController")
			if old_bot != null:
				old_bot.queue_free()
			_bot = Node.new()
			_bot.set_script(bot_scene)
			_bot.name = "BotController"
			player.add_child(_bot)
			print("  Bot attached to player")
		else:
			print("  ! Could not load bot script")
	else:
		print("  ! Player not found, level will run without bot")

	_start_time = Time.get_ticks_msec()
	_timeout_timer.start(LEVEL_TIMEOUT_SEC)

func _on_level_timeout() -> void:
	var elapsed: float = (Time.get_ticks_msec() - _start_time) / 1000.0
	var key: String = _level_key()
	var result := {
		"level": key,
		"status": "timeout",
		"stars": 0,
		"time": elapsed,
		"deaths": GameManager.level_deaths,
		"coins": GameManager.level_coins,
		"total_coins": GameManager.level_total_coins,
	}
	_results.append(result)
	print("  [TIME] TIMEOUT — %s | %.1fs | deaths=%d" % [key, elapsed, GameManager.level_deaths])
	if _level_node != null and is_instance_valid(_level_node):
		_disconnect_level(_level_node)
	_advance()

func _on_level_completed(_stars: int, _time: float, game_level: Node) -> void:
	if _timeout_timer != null:
		_timeout_timer.stop()
	var elapsed: float = (Time.get_ticks_msec() - _start_time) / 1000.0
	var stars: int = _stars
	var key: String = _level_key()
	var result := {
		"level": key,
		"status": "completed",
		"stars": stars,
		"time": elapsed,
		"deaths": GameManager.level_deaths,
		"coins": GameManager.level_coins,
		"total_coins": GameManager.level_total_coins,
	}
	_results.append(result)
	print("  OK COMPLETED — %s | %d* | %.1fs | deaths=%d" % [key, stars, elapsed, GameManager.level_deaths])
	_disconnect_level(game_level)
	_advance()

func _on_level_failed(game_level: Node) -> void:
	if _timeout_timer != null:
		_timeout_timer.stop()
	var elapsed: float = (Time.get_ticks_msec() - _start_time) / 1000.0
	var key: String = _level_key()
	var result := {
		"level": key,
		"status": "failed",
		"stars": 0,
		"time": elapsed,
		"deaths": GameManager.level_deaths,
		"coins": GameManager.level_coins,
		"total_coins": GameManager.level_total_coins,
	}
	_results.append(result)
	print("  X FAILED — %s | %.1fs | deaths=%d" % [key, elapsed, GameManager.level_deaths])
	_disconnect_level(game_level)
	_advance()

func _disconnect_level(game_level: Node) -> void:
	if game_level == null or not is_instance_valid(game_level):
		return
	if game_level.has_signal("level_completed") and game_level.level_completed.is_connected(_on_level_completed):
		game_level.level_completed.disconnect(_on_level_completed)
	if game_level.has_signal("level_failed") and game_level.level_failed.is_connected(_on_level_failed):
		game_level.level_failed.disconnect(_on_level_failed)
	if _bot != null and is_instance_valid(_bot):
		_bot.stop()
		_bot.queue_free()
		_bot = null

func _level_key() -> String:
	if _is_bonus:
		return "B-%d" % _current_world
	return "%d-%d" % [_current_world, _current_level]

func _advance() -> void:
	if not _running:
		return

	if _is_bonus:
		# Finished bonus for this world, move to next world
		_current_world += 1
		_current_level = 1
		_is_bonus = false
	else:
		_current_level += 1
		if _current_level > _max_level:
			# Move to bonus, then next world
			_is_bonus = true

	if _current_world > 6:
		_finish_run()
		return

	# Small delay between levels to let physics settle
	await get_tree().create_timer(1.0).timeout
	_load_next_level()

func _finish_run() -> void:
	_running = false
	print("\n═══ TEST HARNESS COMPLETE ═══")
	var total: int = _results.size()
	var passed: int = 0
	var total_deaths: int = 0
	for r: Dictionary in _results:
		if r["status"] == "completed":
			passed += 1
		total_deaths += r.get("deaths", 0)
	print("Results: %d/%d levels passed | %d total deaths" % [passed, total, total_deaths])
	print("\nDetailed Results:")
	for r: Dictionary in _results:
		var icon: String = "OK" if r["status"] == "completed" else "X"
		print("  %s %s | %d* | %.1fs | deaths=%d" % [icon, r["level"], r.get("stars", 0), r.get("time", 0.0), r.get("deaths", 0)])

	# Save JSON
	var json := JSON.stringify({"results": _results, "passed": passed, "total": total, "deaths": total_deaths}, "\t")
	var file := FileAccess.open(RESULTS_FILE, FileAccess.WRITE)
	if file:
		file.store_string(json)
		file.close()
		print("\nResults saved to: %s" % RESULTS_FILE)
	else:
		push_error("TestHarness: failed to write results file")

	# Return to world map
	if Main.instance != null:
		Main.instance.load_world_map()

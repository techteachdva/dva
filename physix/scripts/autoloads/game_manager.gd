extends Node

# Global game state
var current_world: int = 1
var current_level: int = 1
var score: int = 0
var lives: int = 3
var coins: int = 0
var total_stars: int = 0

# Per-level tracking
var level_start_time: float = 0.0
var level_coins: int = 0
var level_total_coins: int = 0
var level_total_obstacles: int = 0
var level_obstacles_cleared: int = 0
var level_deaths: int = 0

# Speed tracking for star ratings
var level_speed_sum: float = 0.0
var level_speed_samples: int = 0

# Checkpoints & level run stats
var checkpoint_used: bool = false
var perfect_path_eligible: bool = true

signal score_changed(new_score: int)
signal lives_changed(new_lives: int)
signal coins_changed(new_coins: int)
signal game_over()

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS

var level_total_hoops: int = 0
var level_hoops_passed: int = 0

func start_level() -> void:
	level_start_time = Time.get_ticks_msec() / 1000.0
	level_coins = 0
	level_total_coins = 0
	level_total_obstacles = 0
	level_obstacles_cleared = 0
	level_deaths = 0
	level_speed_sum = 0.0
	level_speed_samples = 0
	checkpoint_used = false
	perfect_path_eligible = true
	level_total_hoops = 0
	level_hoops_passed = 0

func set_total_hoops(total: int) -> void:
	level_total_hoops = total

func pass_hoop() -> void:
	level_hoops_passed += 1

func clear_active_buffs() -> void:
	active_buffs.clear()

func add_active_buff(buff_id: String) -> void:
	active_buffs[buff_id] = true

var active_buffs: Dictionary = {}

# Temporary storage for editor test-play levels
var editor_test_data: Dictionary = {}

# Restores level editor state after Test play
var editor_restore_pending: bool = false
var editor_saved_session: Dictionary = {}

func add_score(points: int) -> void:
	score += points
	score_changed.emit(score)

func add_coin() -> void:
	coins += 1
	level_coins += 1
	coins_changed.emit(coins)
	if coins % 100 == 0:
		add_life()
	_sync_session_save()

func add_life() -> void:
	lives += 1
	lives_changed.emit(lives)
	if get_node_or_null("/root/LevelManager") != null:
		LevelManager.clear_session_game_over()
	_sync_session_save()

func spend_coins(amount: int) -> bool:
	if coins >= amount:
		coins -= amount
		coins_changed.emit(coins)
		_sync_session_save()
		return true
	return false

func lose_life() -> void:
	lives -= 1
	level_deaths += 1
	lives_changed.emit(lives)
	perfect_path_eligible = false
	_sync_session_save()
	if lives <= 0:
		if get_node_or_null("/root/LevelManager") != null:
			LevelManager.set_session_game_over(true)
		game_over.emit()

func try_spend_life_for_retry() -> bool:
	if lives <= 0:
		if get_node_or_null("/root/LevelManager") != null:
			LevelManager.set_session_game_over(true)
		game_over.emit()
		return false
	lives -= 1
	lives_changed.emit(lives)
	_sync_session_save()
	if lives <= 0 and get_node_or_null("/root/LevelManager") != null:
		LevelManager.set_session_game_over(true)
	return true

func _sync_session_save() -> void:
	if get_node_or_null("/root/LevelManager") != null:
		LevelManager.sync_session_from_game_manager()

func obstacle_cleared() -> void:
	level_obstacles_cleared += 1
	add_score(50)

func get_level_elapsed_time() -> float:
	return Time.get_ticks_msec() / 1000.0 - level_start_time

func add_speed_sample(speed: float) -> void:
	level_speed_sum += speed
	level_speed_samples += 1

func get_avg_speed() -> float:
	if level_speed_samples == 0:
		return 0.0
	return level_speed_sum / float(level_speed_samples)

func calculate_star_rating() -> int:
	var total_hoops := level_total_hoops
	var passed := level_hoops_passed
	if total_hoops <= 0:
		return 1
	if passed >= total_hoops:
		return 3
	var two_thirds := maxi(int(ceil(float(total_hoops) * 2.0 / 3.0)), 1)
	if passed >= two_thirds:
		return 2
	return 1

func calculate_rank(time: float, coins_collected: int, total_coins: int, obstacles: int, total_obstacles: int, deaths: int, par_time: float) -> String:
	# Ranks: F, D, C, B, A, S, S+
	var coin_ratio: float = float(coins_collected) / maxf(float(total_coins), 1.0)
	var obstacle_ratio: float = float(obstacles) / maxf(float(total_obstacles), 1.0)
	var time_ratio: float = time / maxf(par_time, 1.0)

	if deaths > 2 or time_ratio > 3.0:
		return "F"
	if deaths > 1 or time_ratio > 2.0 or coin_ratio < 0.2:
		return "D"
	if time_ratio > 1.5 or coin_ratio < 0.4 or obstacle_ratio < 0.3:
		return "C"
	if time_ratio > 1.2 or coin_ratio < 0.6 or obstacle_ratio < 0.5:
		return "B"
	if time_ratio > 1.0 or coin_ratio < 0.8 or obstacle_ratio < 0.8 or deaths > 0:
		return "A"
	if coin_ratio < 1.0 or obstacle_ratio < 1.0 or time_ratio > 0.85:
		return "S"
	return "S+"

func reset_for_new_game() -> void:
	current_world = 1
	current_level = 1
	score = 0
	lives = 3
	coins = 0
	total_stars = 0

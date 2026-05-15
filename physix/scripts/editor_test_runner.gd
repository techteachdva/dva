extends Node3D

# Temporary test-play scene that loads a level from editor JSON data.
# Returns to the editor when the player finishes or presses Escape.

@onready var hud: CanvasLayer = $HUD

var _player: RigidBody3D
var _elapsed: float = 0.0
var _running: bool = false
var _return_to_editor: bool = true
var _start_pos: Vector3 = Vector3(0, 1.5, 0)
var _test_camera: Camera3D
var _timer_lbl: Label
var _speed_bar: ProgressBar

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_timer = Timer.new()
	_timer.one_shot = true
	add_child(_timer)
	# Build level from editor data
	if GameManager.editor_test_data.is_empty():
		push_error("No editor test data found!")
		_return_to_origin()
		return

	LevelSerializer.import_level(GameManager.editor_test_data, self)

	# Find player start position
	var start_node: Node = _find_node_recursive(self, "PlayerStart")
	if start_node != null:
		_start_pos = start_node.global_position
	else:
		_start_pos = Vector3(0, 1.5, 0)

	# Add a player
	var player_scene := load("res://scenes/player/player.tscn") as PackedScene
	_player = player_scene.instantiate()
	_player.transform.origin = _start_pos
	add_child(_player)

	# Find finish zone and hook it up
	var finish: Node = _find_node_recursive(self, "FinishZone")
	if finish is Area3D:
		finish.body_entered.connect(_on_finish_entered)

	# Hook up player
	_player.died.connect(_on_player_died)

	# Count coins and obstacles
	GameManager.start_level()
	GameManager.level_total_coins = _count_coins()
	GameManager.level_total_obstacles = get_tree().get_nodes_in_group("obstacles").size()
	_connect_coins()

	# Camera follow
	_test_camera = Camera3D.new()
	_test_camera.name = "TestCamera"
	_test_camera.fov = 75.0
	_test_camera.current = true
	add_child(_test_camera)

	# HUD setup
	_setup_hud()

	# Countdown
	hud.get_node("CountdownLabel").visible = true
	_timer.start(1.0)
	await _timer.timeout
	if not is_inside_tree():
		return
	hud.get_node("CountdownLabel").text = "2"
	_timer.start(1.0)
	await _timer.timeout
	if not is_inside_tree():
		return
	hud.get_node("CountdownLabel").text = "1"
	_timer.start(1.0)
	await _timer.timeout
	if not is_inside_tree():
		return
	hud.get_node("CountdownLabel").visible = false
	_running = true


func _physics_process(delta: float) -> void:
	if not _running:
		return
	_elapsed += delta
	GameManager.add_speed_sample(_player.linear_velocity.length())
	_update_hud()
	# Camera follow
	if _test_camera:
		var target  := _player.global_position + Vector3(0, 5.5, 14)
		var look_target := _player.global_position + Vector3(0, 0.5, -22)
		_test_camera.global_position = _test_camera.global_position.lerp(target, 9.0 * delta)
		_test_camera.look_at(look_target, Vector3.UP)


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		_return_to_editor = true
		_return_to_origin()


func _on_finish_entered(body: Node3D) -> void:
	if body != _player or not _running:
		return
	_running = false
	var total_coins := GameManager.level_total_coins
	var stars := GameManager.calculate_star_rating(
		_elapsed, GameManager.level_coins, total_coins,
		GameManager.level_obstacles_cleared, GameManager.level_deaths,
		GameManager.editor_test_data.get("pt", 45.0),
		_player.max_forward_speed
	)
	var rank := GameManager.calculate_rank(
		_elapsed, GameManager.level_coins, total_coins,
		GameManager.level_obstacles_cleared, GameManager.level_total_obstacles,
		GameManager.level_deaths, GameManager.editor_test_data.get("pt", 45.0)
	)

	# Medals
	var medals: Array[String] = []
	if GameManager.level_deaths == 0:
		medals.append("First Try")
	if GameManager.level_coins >= total_coins and GameManager.level_obstacles_cleared >= GameManager.level_total_obstacles and _elapsed <= GameManager.editor_test_data.get("pt", 45.0) and GameManager.level_deaths == 0:
		medals.append("Perfect Path")
	if GameManager.get_avg_speed() >= _player.max_forward_speed * 0.75:
		medals.append("Speed Demon")

	_show_results(stars, rank, medals)
	_timer.start(3.0)
	await _timer.timeout
	_return_to_origin()


var _respawning: bool = false
var _timer: Timer

func _exit_tree() -> void:
	if _timer != null:
		_timer.stop()

func _on_player_died() -> void:
	if not _running or _respawning:
		return
	GameManager.lose_life()
	if GameManager.lives <= 0:
		_running = false
		_show_results(0, "F")
		_timer.start(2.0)
		await _timer.timeout
		_return_to_origin()
	else:
		# Respawn
		_respawning = true
		_timer.start(1.0)
		await _timer.timeout
		_respawning = false
		_player.set_deferred("global_position", _start_pos)
		_player.set_deferred("linear_velocity", Vector3.ZERO)
		_player.set_deferred("angular_velocity", Vector3.ZERO)

func _return_to_origin() -> void:
	if GameManager.get_meta("_custom_level", false):
		Main.instance.load_main_menu()
	else:
		Main.instance.load_level_editor()


func _count_coins() -> int:
	var coins_node: Node = _find_node_recursive(self, "Coins")
	if coins_node == null:
		return 0
	var count := 0
	for child: Node in coins_node.get_children():
		if child is Area3D:
			count += 1
	return count


func _connect_coins() -> void:
	var coins_node: Node = _find_node_recursive(self, "Coins")
	if coins_node == null:
		return
	for child: Node in coins_node.get_children():
		if child is Area3D:
			child.add_to_group("coins")
			child.body_entered.connect(_on_coin_collected.bind(child))


func _on_coin_collected(body: Node3D, coin: Area3D) -> void:
	if body != _player or not coin.visible:
		return
	coin.visible = false
	coin.set_deferred("monitoring", false)
	GameManager.add_coin()
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("coin")


func _find_node_recursive(root: Node, name_: String) -> Node:
	if root.name == name_:
		return root
	for child: Node in root.get_children():
		var found: Node = _find_node_recursive(child, name_)
		if found != null:
			return found
	return null


func _setup_hud() -> void:
	var top := HBoxContainer.new()
	top.name = "TopBar"
	top.anchor_right = 1.0
	top.offset_bottom = 48
	hud.add_child(top)

	_timer_lbl = Label.new()
	_timer_lbl.name = "TimerLabel"
	_timer_lbl.text = "00:00.00"
	top.add_child(_timer_lbl)

	_speed_bar = ProgressBar.new()
	_speed_bar.name = "SpeedBar"
	_speed_bar.anchor_top = 1.0
	_speed_bar.anchor_bottom = 1.0
	_speed_bar.anchor_right = 1.0
	_speed_bar.offset_top = -18
	hud.add_child(_speed_bar)

	var countdown := Label.new()
	countdown.name = "CountdownLabel"
	countdown.anchor_left = 0.5
	countdown.anchor_right = 0.5
	countdown.anchor_top = 0.4
	countdown.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	countdown.add_theme_font_size_override("font_size", 72)
	countdown.text = "3"
	hud.add_child(countdown)


func _update_hud() -> void:
	@warning_ignore("integer_division")
	var m := int(_elapsed) / 60
	var s := int(_elapsed) % 60
	var c := int(fmod(_elapsed, 1.0) * 100)
	if _timer_lbl:
		_timer_lbl.text = "%02d:%02d.%02d" % [m, s, c]
	if _speed_bar:
		_speed_bar.value = clampf((_player.linear_velocity.length() / _player.max_forward_speed) * 100.0, 0.0, 100.0)


func _show_results(stars: int, rank: String, medals: Array[String] = []) -> void:
	var panel := Panel.new()
	panel.name = "ResultPanel"
	panel.anchor_left = 0.3
	panel.anchor_right = 0.7
	panel.anchor_top = 0.3
	panel.anchor_bottom = 0.7
	hud.add_child(panel)

	var title := Label.new()
	title.anchor_left = 0.5
	title.anchor_right = 0.5
	title.anchor_top = 0.1
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 36)
	title.text = "LEVEL COMPLETE!" if stars > 0 else "GAME OVER"
	panel.add_child(title)

	var stars_lbl := Label.new()
	stars_lbl.anchor_left = 0.5
	stars_lbl.anchor_right = 0.5
	stars_lbl.anchor_top = 0.35
	stars_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stars_lbl.add_theme_font_size_override("font_size", 52)
	stars_lbl.text = "★".repeat(stars) + "☆".repeat(3 - stars)
	panel.add_child(stars_lbl)

	var rank_lbl := Label.new()
	rank_lbl.anchor_left = 0.5
	rank_lbl.anchor_right = 0.5
	rank_lbl.anchor_top = 0.55
	rank_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rank_lbl.add_theme_font_size_override("font_size", 28)
	rank_lbl.text = "Rank: %s" % rank
	panel.add_child(rank_lbl)

	if not medals.is_empty():
		var medals_lbl := Label.new()
		medals_lbl.anchor_left = 0.5
		medals_lbl.anchor_right = 0.5
		medals_lbl.anchor_top = 0.7
		medals_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		medals_lbl.add_theme_font_size_override("font_size", 22)
		medals_lbl.text = "Medals earned: %s" % ", ".join(medals)
		panel.add_child(medals_lbl)

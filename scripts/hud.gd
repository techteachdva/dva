extends CanvasLayer

signal level_complete_action(action: String)
signal pause_action(action: String)

@onready var score_lbl:       Label       = $TopBar/ScoreLabel
@onready var timer_lbl:       Label       = $TopBar/TimerLabel
@onready var lives_lbl:       Label       = $TopBar/LivesLabel
@onready var coins_lbl:       Label       = $TopBar/CoinsLabel
@onready var speed_bar:       ProgressBar = $SpeedBar
@onready var combo_lbl:       Label       = $ComboLabel
@onready var intro_panel:     Panel       = $IntroPanel
@onready var intro_text:      Label       = $IntroPanel/IntroText
@onready var pause_panel:     Control     = $PausePanel
@onready var complete_panel:  Control     = $CompletePanel
@onready var game_over_panel: Control     = $GameOverPanel

var _complete_buttons: Array[Button] = []

var combo_count: int   = 0
var combo_timer: float = 0.0
const COMBO_WINDOW: float = 3.0

const MPS_TO_FPS: float = 3.28084
var _speed_lbl: Label

var _tutorial_panel: Panel
var _tutorial_lbl: Label
var _tutorial_timer: Timer

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameManager.score_changed.connect(update_score)
	GameManager.lives_changed.connect(update_lives)
	GameManager.coins_changed.connect(update_coins)
	update_score(GameManager.score)
	update_lives(GameManager.lives)
	update_coins(GameManager.coins)
	combo_lbl.visible    = false
	intro_panel.visible  = false
	pause_panel.visible  = false
	complete_panel.visible  = false
	game_over_panel.visible = false
	_ensure_pause_buttons()
	_build_tutorial_ui()
	_ensure_hoops_label()
	_ensure_debug_button()
	_ensure_speed_label()

func _ensure_speed_label() -> void:
	_speed_lbl = Label.new()
	_speed_lbl.name = "SpeedLabel"
	_speed_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_speed_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_speed_lbl.add_theme_font_size_override("font_size", 18)
	# Position the label centred over the speed bar
	_speed_lbl.anchor_left = speed_bar.anchor_left
	_speed_lbl.anchor_right = speed_bar.anchor_right
	_speed_lbl.anchor_top = speed_bar.anchor_top
	_speed_lbl.anchor_bottom = speed_bar.anchor_bottom
	_speed_lbl.offset_left = speed_bar.offset_left
	_speed_lbl.offset_right = speed_bar.offset_right
	_speed_lbl.offset_top = speed_bar.offset_top
	_speed_lbl.offset_bottom = speed_bar.offset_bottom
	add_child(_speed_lbl)
	# Hide the built-in percentage text; the label will show ft/s
	speed_bar.show_percentage = false

func _ensure_debug_button() -> void:
	# Dev/Prod separation: dev tools only visible inside the Godot editor.
	# Exported builds (web, desktop, mobile) never show bot/ghost debug UI.
	if not OS.has_feature("editor"):
		return
	var btn := get_node_or_null("DebugBotBtn") as Button
	if btn != null:
		return
	btn = Button.new()
	btn.name = "DebugBotBtn"
	btn.anchor_left = 1.0
	btn.anchor_right = 1.0
	btn.anchor_top = 0.0
	btn.offset_left = -110
	btn.offset_right = -10
	btn.offset_top = 50
	btn.offset_bottom = 78
	btn.text = "Run Bot Test"
	btn.add_theme_font_size_override("font_size", 14)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.1, 0.1, 0.75)
	style.corner_radius_top_left = 6
	style.corner_radius_top_right = 6
	style.corner_radius_bottom_left = 6
	style.corner_radius_bottom_right = 6
	btn.add_theme_stylebox_override("normal", style)
	btn.pressed.connect(_on_debug_bot_pressed)
	add_child(btn)

	var analyze_btn := Button.new()
	analyze_btn.name = "AnalyzeGhostBtn"
	analyze_btn.anchor_left = 1.0
	analyze_btn.anchor_right = 1.0
	analyze_btn.anchor_top = 0.0
	analyze_btn.offset_left = -110
	analyze_btn.offset_right = -10
	analyze_btn.offset_top = 82
	analyze_btn.offset_bottom = 110
	analyze_btn.text = "Analyze Ghost"
	analyze_btn.add_theme_font_size_override("font_size", 14)
	var ast := StyleBoxFlat.new()
	ast.bg_color = Color(0.1, 0.15, 0.1, 0.75)
	ast.corner_radius_top_left = 6
	ast.corner_radius_top_right = 6
	ast.corner_radius_bottom_left = 6
	ast.corner_radius_bottom_right = 6
	analyze_btn.add_theme_stylebox_override("normal", ast)
	analyze_btn.pressed.connect(_on_analyze_ghost_pressed)
	add_child(analyze_btn)

func _on_debug_bot_pressed() -> void:
	print("[HUD] Starting bot test harness...")
	TestHarness.start_test_run()

func _on_analyze_ghost_pressed() -> void:
	var world: int = GameManager.current_world
	var level: int = GameManager.current_level
	print("[HUD] Analyzing ghost for %d-%d..." % [world, level])
	GhostAnalyzer.analyze_and_redesign(world, level)

func _ensure_hoops_label() -> void:
	var bar: HBoxContainer = get_node_or_null("TopBar")
	if bar == null:
		return
	var lbl: Label = bar.get_node_or_null("HoopsLabel")
	if lbl == null:
		lbl = Label.new()
		lbl.name = "HoopsLabel"
		lbl.visible = false
		bar.add_child(lbl)

func _ensure_pause_buttons() -> void:
	var resume_btn := pause_panel.get_node_or_null("ResumeBtn") as Button
	if resume_btn == null:
		resume_btn = Button.new()
		resume_btn.name = "ResumeBtn"
		resume_btn.anchor_left = 0.5
		resume_btn.anchor_right = 0.5
		resume_btn.anchor_top = 0.40
		resume_btn.offset_left = -90
		resume_btn.offset_right = 90
		resume_btn.offset_bottom = 36
		resume_btn.add_theme_font_size_override("font_size", 20)
		resume_btn.text = "Resume"
		pause_panel.add_child(resume_btn)
	if not resume_btn.pressed.is_connected(_on_resume):
		resume_btn.pressed.connect(_on_resume)

	var retry_btn := pause_panel.get_node_or_null("RetryBtn") as Button
	if retry_btn == null:
		retry_btn = Button.new()
		retry_btn.name = "RetryBtn"
		retry_btn.anchor_left = 0.5
		retry_btn.anchor_right = 0.5
		retry_btn.anchor_top = 0.54
		retry_btn.offset_left = -90
		retry_btn.offset_right = 90
		retry_btn.offset_bottom = 36
		retry_btn.add_theme_font_size_override("font_size", 20)
		retry_btn.text = "↻  Retry"
		pause_panel.add_child(retry_btn)
	if not retry_btn.pressed.is_connected(_on_pause_retry):
		retry_btn.pressed.connect(_on_pause_retry)

	var return_btn := pause_panel.get_node_or_null("ReturnBtn") as Button
	if return_btn == null:
		return_btn = Button.new()
		return_btn.name = "ReturnBtn"
		return_btn.anchor_left = 0.5
		return_btn.anchor_right = 0.5
		return_btn.anchor_top = 0.68
		return_btn.offset_left = -90
		return_btn.offset_right = 90
		return_btn.offset_bottom = 36
		return_btn.add_theme_font_size_override("font_size", 18)
		return_btn.text = "↩  Return to World Map"
		pause_panel.add_child(return_btn)
	if not return_btn.pressed.is_connected(_on_return_to_world_map):
		return_btn.pressed.connect(_on_return_to_world_map)

func _on_pause_retry() -> void:
	get_tree().paused = false
	pause_panel.visible = false
	pause_action.emit("retry")


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		get_tree().paused = not get_tree().paused
		show_pause_menu(get_tree().paused)
		get_viewport().set_input_as_handled()

func _process(delta: float) -> void:
	if combo_count > 0:
		combo_timer -= delta
		if combo_timer <= 0.0:
			combo_count    = 0
			combo_lbl.visible = false

# ── Per-frame updates ─────────────────────────────────────────────────────────

func update_timer(elapsed: float) -> void:
	@warning_ignore("integer_division")
	var m := int(elapsed) / 60
	var s := int(elapsed) % 60
	var c := int(fmod(elapsed, 1.0) * 100)
	timer_lbl.text = "%02d:%02d.%02d" % [m, s, c]

func update_speed(speed: float, max_speed: float) -> void:
	var speed_fps: float = speed * MPS_TO_FPS
	var max_fps: float = max_speed * MPS_TO_FPS
	speed_bar.max_value = max_fps
	speed_bar.value = clampf(speed_fps, 0.0, max_fps)
	if _speed_lbl != null:
		_speed_lbl.text = "%d ft/s" % int(speed_fps)

# ── Signal callbacks ──────────────────────────────────────────────────────────

func update_score(val: int) -> void: score_lbl.text = "Score  %07d" % val
func update_lives(val: int) -> void: lives_lbl.text = "❤  x%d" % val
func update_coins(val: int) -> void: coins_lbl.text = "🪙  x%d" % val

func update_hoops(passed: int, total: int) -> void:
	var lbl: Label = get_node_or_null("TopBar/HoopsLabel")
	if lbl == null:
		return
	if total <= 0:
		lbl.visible = false
		return
	lbl.visible = true
	lbl.text = "🎯  %d/%d" % [passed, total]

# ── Combo ─────────────────────────────────────────────────────────────────────

func register_combo() -> void:
	combo_count  += 1
	combo_timer   = COMBO_WINDOW
	combo_lbl.text    = "COMBO  x%d!" % combo_count
	combo_lbl.visible = true
	GameManager.add_score(10 * combo_count)

# ── Overlays ──────────────────────────────────────────────────────────────────

func show_intro(text: String) -> void:
	intro_text.text    = "💡 " + text
	intro_panel.visible = true

func hide_intro() -> void:
	intro_panel.visible = false

func _build_tutorial_ui() -> void:
	_tutorial_panel = Panel.new()
	_tutorial_panel.name = "TutorialPanel"
	_tutorial_panel.anchor_left = 0.2
	_tutorial_panel.anchor_right = 0.8
	_tutorial_panel.anchor_top = 0.86
	_tutorial_panel.anchor_bottom = 0.95
	_tutorial_panel.visible = false
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.05, 0.08, 0.82)
	style.corner_radius_top_left = 8
	style.corner_radius_top_right = 8
	style.corner_radius_bottom_left = 8
	style.corner_radius_bottom_right = 8
	_tutorial_panel.add_theme_stylebox_override("panel", style)
	add_child(_tutorial_panel)

	_tutorial_lbl = Label.new()
	_tutorial_lbl.name = "TutorialLabel"
	_tutorial_lbl.anchor_left = 0.02
	_tutorial_lbl.anchor_right = 0.98
	_tutorial_lbl.anchor_top = 0.1
	_tutorial_lbl.anchor_bottom = 0.9
	_tutorial_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_tutorial_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_tutorial_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
	_tutorial_lbl.add_theme_font_size_override("font_size", 18)
	_tutorial_panel.add_child(_tutorial_lbl)

	_tutorial_timer = Timer.new()
	_tutorial_timer.name = "TutorialTimer"
	_tutorial_timer.one_shot = true
	_tutorial_timer.timeout.connect(_on_tutorial_timeout)
	add_child(_tutorial_timer)

func show_tutorial_hint(text: String, duration: float = 0.0) -> void:
	_tutorial_lbl.text = text
	_tutorial_panel.visible = true
	if duration > 0.0:
		_tutorial_timer.start(duration)

func hide_tutorial_hint() -> void:
	_tutorial_panel.visible = false
	if _tutorial_timer.is_stopped() == false:
		_tutorial_timer.stop()

func _on_tutorial_timeout() -> void:
	_tutorial_panel.visible = false

func show_pause_menu(paused: bool) -> void:
	pause_panel.visible = paused

func _on_resume() -> void:
	get_tree().paused = false
	pause_panel.visible = false

func _on_return_to_world_map() -> void:
	get_tree().paused = false
	Main.instance.load_world_map()

func show_level_complete(stars: int, time: float, rank: String = "", breakdown: String = "", medals: Array[String] = []) -> void:
	complete_panel.visible = true
	# Dark, semi-transparent panel style
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.04, 0.04, 0.08, 0.92)
	panel_style.border_color = Color(0.25, 0.25, 0.35)
	panel_style.border_width_top = 3
	panel_style.border_width_bottom = 3
	panel_style.border_width_left = 3
	panel_style.border_width_right = 3
	panel_style.corner_radius_top_left = 12
	panel_style.corner_radius_top_right = 12
	panel_style.corner_radius_bottom_left = 12
	panel_style.corner_radius_bottom_right = 12
	complete_panel.add_theme_stylebox_override("panel", panel_style)

	# Floating entrance animation
	complete_panel.modulate.a = 0.0
	complete_panel.position.y += 30
	var tw := create_tween().set_parallel()
	tw.tween_property(complete_panel, "modulate:a", 1.0, 0.3).set_ease(Tween.EASE_OUT)
	tw.tween_property(complete_panel, "position:y", complete_panel.position.y - 30, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)

	var title_text := "LEVEL COMPLETE!\nYou earned %d star%s!" % [stars, "" if stars == 1 else "s"]
	var title_lbl: Label = complete_panel.get_node("CompleteTitle")
	title_lbl.text = title_text
	title_lbl.add_theme_font_size_override("font_size", 36)
	complete_panel.get_node("StarsLabel").text = "★".repeat(stars) + "☆".repeat(3 - stars)
	@warning_ignore("integer_division")
	var m := int(time) / 60
	var s := int(time) % 60
	complete_panel.get_node("TimeLabel").text = "Time: %02d:%02d" % [m, s]
	var rank_lbl := complete_panel.get_node_or_null("RankLabel")
	if rank_lbl:
		if rank.is_empty():
			rank_lbl.visible = false
		else:
			rank_lbl.visible = true
			var praise := _rank_praise(rank)
			rank_lbl.text = "Rank: %s — %s" % [rank, praise]
	var breakdown_lbl := complete_panel.get_node_or_null("BreakdownLabel")
	if not breakdown_lbl:
		breakdown_lbl = Label.new()
		breakdown_lbl.name = "BreakdownLabel"
		breakdown_lbl.anchor_left = 0.1
		breakdown_lbl.anchor_right = 0.9
		breakdown_lbl.anchor_top = 0.54
		breakdown_lbl.anchor_bottom = 0.66
		breakdown_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		breakdown_lbl.vertical_alignment = VERTICAL_ALIGNMENT_TOP
		breakdown_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD
		breakdown_lbl.add_theme_font_size_override("font_size", 18)
		complete_panel.add_child(breakdown_lbl)
	breakdown_lbl.text = breakdown
	breakdown_lbl.visible = not breakdown.is_empty()

	# Medals display — styled badges
	_ensure_medals_display(medals)

	# Ensure action buttons exist
	_ensure_complete_buttons()
	for btn: Button in _complete_buttons:
		btn.visible = true

func _ensure_complete_buttons() -> void:
	if not _complete_buttons.is_empty():
		return
	var container := VBoxContainer.new()
	container.name = "CompleteButtons"
	container.anchor_left = 0.5
	container.anchor_right = 0.5
	container.anchor_top = 0.72
	container.anchor_bottom = 0.88
	container.offset_left = -110
	container.offset_right = 110
	container.offset_top = 0
	container.offset_bottom = 0
	container.alignment = BoxContainer.ALIGNMENT_CENTER
	container.add_theme_constant_override("separation", 8)
	complete_panel.add_child(container)

	var labels := ["↻  Retry", "🗺  World Map", "✕  Quit"]
	var actions: Array[String] = ["retry", "world_map", "quit"]
	for i: int in range(labels.size()):
		var btn := Button.new()
		btn.text = labels[i]
		btn.custom_minimum_size = Vector2(200, 44)
		btn.add_theme_font_size_override("font_size", 22)
		btn.add_theme_color_override("font_color", Color(0.95, 0.93, 1.0, 1.0))
		btn.add_theme_color_override("font_hover_color", Color(1.0, 0.65, 0.25, 1.0))
		var bg := StyleBoxFlat.new()
		bg.bg_color = Color(0.08, 0.06, 0.14, 0.9)
		bg.border_color = Color(0.35, 0.3, 0.45)
		bg.border_width_top = 2
		bg.border_width_bottom = 2
		bg.border_width_left = 2
		bg.border_width_right = 2
		bg.corner_radius_top_left = 8
		bg.corner_radius_top_right = 8
		bg.corner_radius_bottom_left = 8
		bg.corner_radius_bottom_right = 8
		btn.add_theme_stylebox_override("normal", bg)
		var bg_h := bg.duplicate()
		bg_h.bg_color = Color(0.12, 0.09, 0.2, 0.95)
		bg_h.border_color = Color(0.55, 0.45, 0.7)
		btn.add_theme_stylebox_override("hover", bg_h)
		var a := actions[i]
		btn.pressed.connect(func(): level_complete_action.emit(a))
		container.add_child(btn)
		_complete_buttons.append(btn)

func _ensure_medals_display(medals: Array[String]) -> void:
	var container := complete_panel.get_node_or_null("MedalsContainer") as HBoxContainer
	if container != null:
		container.visible = false
		for child: Node in container.get_children():
			child.queue_free()
	if medals.is_empty():
		return

	if container == null:
		container = HBoxContainer.new()
		container.name = "MedalsContainer"
		container.anchor_left = 0.5
		container.anchor_right = 0.5
		container.anchor_top = 0.68
		container.anchor_bottom = 0.72
		container.offset_left = -200
		container.offset_right = 200
		container.offset_top = 0
		container.offset_bottom = 0
		container.alignment = BoxContainer.ALIGNMENT_CENTER
		container.add_theme_constant_override("separation", 8)
		complete_panel.add_child(container)

	for medal: String in medals:
		var badge := Panel.new()
		badge.custom_minimum_size = Vector2(0, 28)
		var badge_style := StyleBoxFlat.new()
		match medal:
			"Fearless":
				badge_style.bg_color = Color(0.9, 0.25, 0.25, 0.9)
				badge_style.border_color = Color(1.0, 0.5, 0.5, 1.0)
			"First Try":
				badge_style.bg_color = Color(0.2, 0.7, 0.35, 0.9)
				badge_style.border_color = Color(0.4, 0.9, 0.5, 1.0)
			"Perfect Path":
				badge_style.bg_color = Color(0.9, 0.7, 0.15, 0.9)
				badge_style.border_color = Color(1.0, 0.9, 0.4, 1.0)
			"Speed Demon":
				badge_style.bg_color = Color(0.2, 0.5, 0.9, 0.9)
				badge_style.border_color = Color(0.5, 0.7, 1.0, 1.0)
			_:
				badge_style.bg_color = Color(0.5, 0.5, 0.5, 0.9)
				badge_style.border_color = Color(0.7, 0.7, 0.7, 1.0)
		badge_style.border_width_top = 2
		badge_style.border_width_bottom = 2
		badge_style.border_width_left = 2
		badge_style.border_width_right = 2
		badge_style.corner_radius_top_left = 6
		badge_style.corner_radius_top_right = 6
		badge_style.corner_radius_bottom_left = 6
		badge_style.corner_radius_bottom_right = 6
		badge.add_theme_stylebox_override("panel", badge_style)

		var lbl := Label.new()
		lbl.text = "🏅 " + medal
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		lbl.add_theme_font_size_override("font_size", 14)
		lbl.add_theme_color_override("font_color", Color(1.0, 1.0, 1.0, 1.0))
		badge.add_child(lbl)
		container.add_child(badge)

	container.visible = true

func _rank_praise(rank: String) -> String:
	match rank:
		"S+": return "Perfect run!"
		"S":  return "Amazing!"
		"A":  return "Great job!"
		"B":  return "Solid run!"
		"C":  return "Good effort!"
		"D":  return "Keep practicing!"
		"F":  return "You'll get it next time!"
	return ""

func show_game_over() -> void:
	game_over_panel.visible = true

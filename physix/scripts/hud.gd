extends CanvasLayer

signal level_complete_action(action: String)
signal pause_action(action: String)
signal game_over_action(action: String)

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
var _complete_star_icons: HBoxContainer
var _complete_run_time_lbl: Label
var _complete_best_time_lbl: Label
var _complete_new_fastest_lbl: Label

var _countdown_dim: ColorRect
var _countdown_lbl: Label
var _countdown_tween: Tween

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
	_ensure_countdown_ui()
	_setup_topbar_icons()

func _setup_topbar_icons() -> void:
	_insert_icon_before(lives_lbl, "heart")
	_insert_icon_before(coins_lbl, "coin")


func _insert_icon_before(label: Label, kind: String) -> void:
	var bar: Node = label.get_parent()
	if bar == null:
		return
	var icon := TextureRect.new()
	icon.name = "%sIcon" % label.name
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	UiIconLayout.configure_icon_rect(icon, kind, Vector2(22, 22))
	bar.add_child(icon)
	bar.move_child(icon, label.get_index())


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
		retry_btn.text = "Retry (−1 life)"
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
		return_btn.text = "Return to World Map"
		pause_panel.add_child(return_btn)
	if not return_btn.pressed.is_connected(_on_return_to_world_map):
		return_btn.pressed.connect(_on_return_to_world_map)

func _on_pause_retry() -> void:
	if GameManager.lives <= 1:
		_show_retry_warning()
		return
	get_tree().paused = false
	pause_panel.visible = false
	pause_action.emit("retry")

func _show_retry_warning() -> void:
	var dlg := Panel.new()
	dlg.name = "RetryWarningDialog"
	dlg.set_anchors_preset(Control.PRESET_CENTER)
	dlg.offset_left = -220
	dlg.offset_right = 220
	dlg.offset_top = -90
	dlg.offset_bottom = 90
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.04, 0.12, 0.96)
	style.border_color = Color(0.9, 0.2, 0.2, 0.95)
	style.border_width_left = 3
	style.border_width_right = 3
	style.border_width_top = 3
	style.border_width_bottom = 3
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	dlg.add_theme_stylebox_override("panel", style)
	add_child(dlg)

	var lbl := Label.new()
	lbl.anchor_left = 0.05
	lbl.anchor_right = 0.95
	lbl.anchor_top = 0.1
	lbl.anchor_bottom = 0.45
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lbl.add_theme_font_size_override("font_size", 22)
	lbl.add_theme_color_override("font_color", Color(1.0, 0.35, 0.35))
	lbl.text = "Only 1 Life Remaining!\nRetrying will end your run."
	dlg.add_child(lbl)

	var hbox := HBoxContainer.new()
	hbox.anchor_left = 0.1
	hbox.anchor_right = 0.9
	hbox.anchor_top = 0.55
	hbox.anchor_bottom = 0.88
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 16)
	dlg.add_child(hbox)

	var cancel_btn := Button.new()
	cancel_btn.text = "Cancel"
	cancel_btn.custom_minimum_size = Vector2(120, 40)
	cancel_btn.add_theme_font_size_override("font_size", 20)
	cancel_btn.pressed.connect(func() -> void:
		dlg.queue_free()
	)
	hbox.add_child(cancel_btn)

	var confirm_btn := Button.new()
	confirm_btn.text = "Retry Anyway"
	confirm_btn.custom_minimum_size = Vector2(160, 40)
	confirm_btn.add_theme_font_size_override("font_size", 20)
	confirm_btn.add_theme_color_override("font_color", Color(1.0, 0.4, 0.4))
	confirm_btn.pressed.connect(func() -> void:
		dlg.queue_free()
		get_tree().paused = false
		pause_panel.visible = false
		pause_action.emit("retry")
	)
	hbox.add_child(confirm_btn)

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
func update_lives(val: int) -> void: lives_lbl.text = "x%d" % val
func update_coins(val: int) -> void: coins_lbl.text = "x%d" % val

func update_hoops(passed: int, total: int) -> void:
	var lbl: Label = get_node_or_null("TopBar/HoopsLabel")
	if lbl == null:
		return
	if total <= 0:
		lbl.visible = false
		return
	lbl.visible = true
	lbl.text = "Chk %d/%d" % [passed, total]

# ── Combo ─────────────────────────────────────────────────────────────────────

func register_combo() -> void:
	combo_count  += 1
	combo_timer   = COMBO_WINDOW
	combo_lbl.text    = "COMBO  x%d!" % combo_count
	combo_lbl.visible = true
	GameManager.add_score(10 * combo_count)

# ── Overlays ──────────────────────────────────────────────────────────────────

func show_intro(text: String) -> void:
	intro_text.text    = "Tip: " + text
	intro_panel.visible = true

func hide_intro() -> void:
	intro_panel.visible = false

func _ensure_countdown_ui() -> void:
	if _countdown_lbl != null:
		return
	_countdown_dim = ColorRect.new()
	_countdown_dim.name = "CountdownDim"
	_countdown_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_countdown_dim.color = Color(0.02, 0.02, 0.06, 0.42)
	_countdown_dim.visible = false
	_countdown_dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_countdown_dim)

	_countdown_lbl = Label.new()
	_countdown_lbl.name = "CountdownLabel"
	_countdown_lbl.set_anchors_preset(Control.PRESET_CENTER)
	_countdown_lbl.offset_left = -280.0
	_countdown_lbl.offset_right = 280.0
	_countdown_lbl.offset_top = -90.0
	_countdown_lbl.offset_bottom = 90.0
	_countdown_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_countdown_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_countdown_lbl.add_theme_font_size_override("font_size", 108)
	_countdown_lbl.add_theme_color_override("font_color", Color(1.0, 0.96, 0.72))
	_countdown_lbl.add_theme_color_override("font_outline_color", Color(0.08, 0.04, 0.18))
	_countdown_lbl.add_theme_constant_override("outline_size", 14)
	_countdown_lbl.visible = false
	_countdown_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_countdown_lbl)

func run_start_countdown() -> void:
	_ensure_countdown_ui()
	_countdown_dim.visible = true
	_countdown_lbl.visible = true
	await get_tree().create_timer(0.35).timeout
	if not is_inside_tree():
		return
	var steps: Array[String] = ["3", "2", "1", "GO!"]
	for step: String in steps:
		var is_go := step == "GO!"
		await _show_countdown_step(step, is_go)
		if get_node_or_null("/root/AudioManager") != null:
			AudioManager.play_sfx("boost" if is_go else "menu_select")
		if is_go and get_node_or_null("/root/CameraShaker") != null:
			CameraShaker.shake(0.22, 0.38)
		var wait_sec := 0.65 if is_go else 0.92
		await get_tree().create_timer(wait_sec).timeout
		if not is_inside_tree():
			return
	_countdown_lbl.visible = false
	_countdown_dim.visible = false

func _show_countdown_step(text: String, is_go: bool) -> void:
	if _countdown_tween != null and _countdown_tween.is_valid():
		_countdown_tween.kill()
	_countdown_lbl.text = text
	var font_size := 132 if is_go else 108
	_countdown_lbl.add_theme_font_size_override("font_size", font_size)
	var col := Color(0.35, 1.0, 0.55) if is_go else Color(1.0, 0.96, 0.72)
	_countdown_lbl.add_theme_color_override("font_color", col)
	_countdown_lbl.modulate = Color(1, 1, 1, 0)
	_countdown_lbl.scale = Vector2(1.55, 1.55)
	await get_tree().process_frame
	_countdown_lbl.pivot_offset = _countdown_lbl.size * 0.5
	_countdown_tween = create_tween()
	_countdown_tween.set_parallel(true)
	_countdown_tween.tween_property(_countdown_lbl, "modulate:a", 1.0, 0.1)
	_countdown_tween.tween_property(_countdown_lbl, "scale", Vector2.ONE, 0.24)\
		.set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

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
	if get_node_or_null("/root/LevelManager") != null:
		LevelManager.save_progress()
	Main.instance.load_world_map()

func show_level_complete(
	stars: int,
	run_time: float,
	personal_best: float,
	rank: String = "",
	breakdown: String = "",
	is_new_fastest: bool = false,
	previous_best: float = INF,
	all_checkpoints: bool = false
) -> void:
	complete_panel.visible = true
	var medals_old := complete_panel.get_node_or_null("MedalsContainer")
	if medals_old:
		medals_old.queue_free()
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
	_layout_complete_label(title_lbl, 0.05, 0.14)
	_update_complete_stars(stars)
	_ensure_complete_time_labels()
	_update_complete_times(run_time, personal_best, is_new_fastest, previous_best, all_checkpoints)
	var time_lbl: Label = complete_panel.get_node_or_null("TimeLabel") as Label
	if time_lbl:
		time_lbl.visible = false
	var rank_lbl := complete_panel.get_node_or_null("RankLabel")
	if rank_lbl:
		if rank.is_empty():
			rank_lbl.visible = false
		else:
			rank_lbl.visible = true
			var praise := _rank_praise(rank)
			rank_lbl.text = "Rank: %s — %s" % [rank, praise]
			_layout_complete_label(rank_lbl, 0.56, 0.07)
	var breakdown_lbl := complete_panel.get_node_or_null("BreakdownLabel")
	if not breakdown_lbl:
		breakdown_lbl = Label.new()
		breakdown_lbl.name = "BreakdownLabel"
		breakdown_lbl.add_theme_font_size_override("font_size", 18)
		complete_panel.add_child(breakdown_lbl)
	_layout_complete_label(breakdown_lbl, 0.64, 0.10)
	breakdown_lbl.text = breakdown
	breakdown_lbl.visible = not breakdown.is_empty()

	# Ensure action buttons exist
	_ensure_complete_buttons()
	for btn: Button in _complete_buttons:
		btn.visible = true

func _ensure_complete_time_labels() -> void:
	if _complete_run_time_lbl == null:
		var legacy := complete_panel.get_node_or_null("TimeLabel") as Label
		if legacy != null:
			_complete_run_time_lbl = legacy
			_complete_run_time_lbl.name = "RunTimeLabel"
		else:
			_complete_run_time_lbl = Label.new()
			_complete_run_time_lbl.name = "RunTimeLabel"
			complete_panel.add_child(_complete_run_time_lbl)
	if _complete_best_time_lbl == null:
		_complete_best_time_lbl = complete_panel.get_node_or_null("BestTimeLabel") as Label
		if _complete_best_time_lbl == null:
			_complete_best_time_lbl = Label.new()
			_complete_best_time_lbl.name = "BestTimeLabel"
			complete_panel.add_child(_complete_best_time_lbl)
	if _complete_new_fastest_lbl == null:
		_complete_new_fastest_lbl = complete_panel.get_node_or_null("NewFastestLabel") as Label
		if _complete_new_fastest_lbl == null:
			_complete_new_fastest_lbl = Label.new()
			_complete_new_fastest_lbl.name = "NewFastestLabel"
			complete_panel.add_child(_complete_new_fastest_lbl)
	_complete_run_time_lbl.visible = true
	_complete_best_time_lbl.visible = true
	_layout_complete_label(_complete_run_time_lbl, 0.32, 0.07)
	_layout_complete_label(_complete_best_time_lbl, 0.40, 0.07)
	_layout_complete_label(_complete_new_fastest_lbl, 0.48, 0.07)
	_complete_run_time_lbl.add_theme_font_size_override("font_size", 24)
	_complete_best_time_lbl.add_theme_font_size_override("font_size", 22)
	_complete_new_fastest_lbl.add_theme_font_size_override("font_size", 26)

func _update_complete_times(
	run_time: float,
	personal_best: float,
	is_new_fastest: bool,
	previous_best: float,
	all_checkpoints: bool
) -> void:
	if _complete_run_time_lbl == null:
		return
	if all_checkpoints:
		_complete_run_time_lbl.visible = true
		_layout_complete_label(_complete_run_time_lbl, 0.32, 0.07)
		_complete_run_time_lbl.text = "This run:  %s" % LevelManager.format_time_display(run_time, "0:00")
		_complete_best_time_lbl.visible = true
		_layout_complete_label(_complete_best_time_lbl, 0.40, 0.07)
		_complete_best_time_lbl.text = "Personal best:  %s" % LevelManager.format_time_display(personal_best, "—")
		if is_new_fastest:
			_complete_new_fastest_lbl.visible = true
			_layout_complete_label(_complete_new_fastest_lbl, 0.48, 0.07)
			_complete_new_fastest_lbl.text = "New Fastest Time!"
			_complete_new_fastest_lbl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.2, 1.0))
			if previous_best < INF and previous_best > run_time:
				_complete_new_fastest_lbl.text = "New Fastest Time!  (was %s)" % LevelManager.format_time_display(previous_best)
		else:
			_complete_new_fastest_lbl.visible = false
			_complete_new_fastest_lbl.text = ""
	else:
		_complete_run_time_lbl.visible = false
		_complete_new_fastest_lbl.visible = false
		_complete_new_fastest_lbl.text = ""
		if personal_best < INF:
			_complete_best_time_lbl.visible = true
			_layout_complete_label(_complete_best_time_lbl, 0.34, 0.07)
			_complete_best_time_lbl.text = "Personal best:  %s" % LevelManager.format_time_display(personal_best)
		else:
			_complete_best_time_lbl.visible = false
			_complete_best_time_lbl.text = ""

func _layout_complete_label(lbl: Label, top_ratio: float, height_ratio: float) -> void:
	lbl.anchor_left = 0.06
	lbl.anchor_right = 0.94
	lbl.anchor_top = top_ratio
	lbl.anchor_bottom = top_ratio + height_ratio
	lbl.offset_left = 0.0
	lbl.offset_right = 0.0
	lbl.offset_top = 0.0
	lbl.offset_bottom = 0.0
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

func _ensure_complete_buttons() -> void:
	if not _complete_buttons.is_empty():
		return
	var container := VBoxContainer.new()
	container.name = "CompleteButtons"
	container.anchor_left = 0.5
	container.anchor_right = 0.5
	container.anchor_top = 0.76
	container.anchor_bottom = 0.92
	container.offset_left = -110
	container.offset_right = 110
	container.offset_top = 0
	container.offset_bottom = 0
	container.alignment = BoxContainer.ALIGNMENT_CENTER
	container.add_theme_constant_override("separation", 8)
	complete_panel.add_child(container)

	var labels := ["Retry", "World Map", "Quit"]
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

func _update_complete_stars(stars: int) -> void:
	var stars_lbl: Label = complete_panel.get_node_or_null("StarsLabel") as Label
	if stars_lbl:
		stars_lbl.visible = false
	if _complete_star_icons == null:
		_complete_star_icons = HBoxContainer.new()
		_complete_star_icons.name = "StarIcons"
		_complete_star_icons.alignment = BoxContainer.ALIGNMENT_CENTER
		_complete_star_icons.add_theme_constant_override("separation", 10)
		_complete_star_icons.anchor_left = 0.5
		_complete_star_icons.anchor_right = 0.5
		_complete_star_icons.anchor_top = 0.20
		_complete_star_icons.offset_left = -90.0
		_complete_star_icons.offset_right = 90.0
		_complete_star_icons.offset_top = 0.0
		_complete_star_icons.offset_bottom = 56.0
		complete_panel.add_child(_complete_star_icons)
		for _i: int in range(3):
			var icon := TextureRect.new()
			UiIconLayout.configure_icon_rect(icon, "star_empty", Vector2(48, 48))
			_complete_star_icons.add_child(icon)
	for i: int in range(_complete_star_icons.get_child_count()):
		var icon: TextureRect = _complete_star_icons.get_child(i) as TextureRect
		if icon == null:
			continue
		var earned: bool = i < stars
		icon.texture = GameIcons.get_texture("star" if earned else "star_empty")
		icon.modulate = Color.WHITE if earned else Color(0.45, 0.45, 0.5)


var _game_over_buttons: Array[Button] = []

func show_game_over() -> void:
	game_over_panel.visible = true
	_style_game_over_panel()
	_ensure_game_over_content()
	for btn: Button in _game_over_buttons:
		btn.visible = true

func _style_game_over_panel() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.04, 0.1, 0.94)
	style.border_color = Color(0.75, 0.2, 0.25, 0.95)
	style.border_width_left = 4
	style.border_width_right = 4
	style.border_width_top = 4
	style.border_width_bottom = 4
	style.corner_radius_top_left = 14
	style.corner_radius_top_right = 14
	style.corner_radius_bottom_left = 14
	style.corner_radius_bottom_right = 14
	game_over_panel.add_theme_stylebox_override("panel", style)

func _ensure_game_over_content() -> void:
	var title := game_over_panel.get_node_or_null("GameOverLabel") as Label
	if title:
		title.anchor_left = 0.08
		title.anchor_right = 0.92
		title.anchor_top = 0.12
		title.anchor_bottom = 0.28
		title.offset_left = 0.0
		title.offset_right = 0.0
		title.offset_top = 0.0
		title.offset_bottom = 0.0
		title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		title.text = "GAME OVER"
		title.add_theme_font_size_override("font_size", 40)
	var sub := game_over_panel.get_node_or_null("GameOverSubLabel") as Label
	if sub == null:
		sub = Label.new()
		sub.name = "GameOverSubLabel"
		game_over_panel.add_child(sub)
	sub.anchor_left = 0.08
	sub.anchor_right = 0.92
	sub.anchor_top = 0.28
	sub.anchor_bottom = 0.42
	sub.offset_left = 0.0
	sub.offset_right = 0.0
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.add_theme_font_size_override("font_size", 18)
	sub.text = "Out of lives. Visit the shop on the world map to buy more, then Continue from the main menu."
	if _game_over_buttons.is_empty():
		var container := VBoxContainer.new()
		container.name = "GameOverButtons"
		container.anchor_left = 0.15
		container.anchor_right = 0.85
		container.anchor_top = 0.48
		container.anchor_bottom = 0.88
		container.add_theme_constant_override("separation", 10)
		game_over_panel.add_child(container)
		var specs: Array = [
			["World Map & Shop", "world_map"],
			["Main Menu", "menu"],
		]
		for spec: Array in specs:
			var btn := Button.new()
			btn.text = spec[0]
			btn.custom_minimum_size = Vector2(0, 44)
			btn.add_theme_font_size_override("font_size", 20)
			var a: String = spec[1]
			btn.pressed.connect(func(): game_over_action.emit(a))
			container.add_child(btn)
			_game_over_buttons.append(btn)

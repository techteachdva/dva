extends Control

const VERSION := "0.4.0"

@onready var title_lbl:         Label  = $TitleLabel
@onready var title_static_lbl: Label  = $TitleLabelStatic
@onready var tagline_lbl:        Label  = $Center/VBox/TaglineLabel
@onready var play_btn:     Button = $Center/VBox/PlayBtn
@onready var continue_btn: Button = $Center/VBox/ContinueBtn
@onready var load_custom_btn: Button = $Center/VBox/LoadCustomBtn
@onready var editor_btn:   Button = $Center/VBox/EditorBtn
@onready var credits_btn:  Button = $Center/VBox/CreditsBtn
@onready var options_btn:  Button = $Center/VBox/OptionsBtn
@onready var quit_btn:     Button = $Center/VBox/QuitBtn
@onready var version_lbl:  Label  = $VersionLabel
var game_over_panel: Panel
@onready var credits_panel: Panel  = $CreditsPanel
@onready var credits_text: RichTextLabel = $CreditsPanel/Margin/VBox/Scroll/Text
@onready var credits_close: Button = $CreditsPanel/Margin/VBox/CloseBtn
@onready var center_menu: Control = $Center

var _cheat_buffer: String = ""

# Ordered list for top-to-bottom staggered reveal
var _menu_buttons: Array[Button] = []

func _ready() -> void:
	version_lbl.text        = "v" + VERSION
	continue_btn.visible    = FileAccess.file_exists(LevelManager.SAVE_FILE)

	# Wire signals
	play_btn.pressed.connect(_on_play)
	continue_btn.pressed.connect(_on_continue)
	load_custom_btn.pressed.connect(_on_custom_level)
	editor_btn.pressed.connect(_on_editor)
	credits_btn.pressed.connect(_on_credits)
	options_btn.pressed.connect(_on_options)
	quit_btn.pressed.connect(_on_quit)
	credits_close.pressed.connect(_on_credits_close)
	_ensure_game_over_panel()
	credits_text.meta_clicked.connect(_on_credits_link)

	# Build ordered button list for staggered animation
	_menu_buttons = [play_btn, continue_btn, load_custom_btn, editor_btn, credits_btn, options_btn, quit_btn]

	# Style every menu button consistently
	_style_buttons()
	_setup_credits_panel()

	if OS.has_feature("web"):
		mouse_filter = Control.MOUSE_FILTER_STOP
		gui_input.connect(_on_menu_gui_input)

	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.playback_mode = LevelManager.get_music_mode()
		AudioManager.loop_enabled = LevelManager.is_music_loop_enabled()
		AudioManager.single_track = LevelManager.get_equipped_music()
		AudioManager.play_music("menu")

	_animate_intro()


func _on_menu_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		_notify_web_audio_gesture()
	elif event is InputEventScreenTouch and event.pressed:
		_notify_web_audio_gesture()


func _notify_web_audio_gesture() -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.on_web_gesture()


# ── Button Styling (inverted against lava background) ─────────────────────────

func _style_buttons() -> void:
	for btn: Button in _menu_buttons:
		var tex: Texture2D = GameIcons.get_menu_texture(btn.name)
		if tex == null:
			var legacy_paths := {
				"PlayBtn": "res://assets/icons/play.png",
				"ContinueBtn": "res://assets/icons/continue.png",
				"LoadCustomBtn": "res://assets/icons/custom.png",
				"EditorBtn": "res://assets/icons/editor.png",
				"CreditsBtn": "res://assets/icons/credits.png",
				"OptionsBtn": "res://assets/icons/options.png",
				"QuitBtn": "res://assets/icons/quit.png",
			}
			var path: String = legacy_paths.get(btn.name, "")
			if not path.is_empty() and ResourceLoader.exists(path):
				tex = load(path) as Texture2D
		if tex:
			btn.icon = tex
			btn.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
			btn.expand_icon = true
		btn.custom_minimum_size = Vector2(320, 52)
		btn.add_theme_font_size_override("font_size", 28)
		# Text colors — bright, readable
		btn.add_theme_color_override("font_color", Color(0.95, 0.93, 1.0, 1.0))
		btn.add_theme_color_override("font_hover_color", Color(1.0, 0.65, 0.25, 1.0))
		btn.add_theme_color_override("font_pressed_color", Color(1.0, 1.0, 1.0, 1.0))
		btn.add_theme_color_override("font_disabled_color", Color(0.5, 0.5, 0.55, 0.5))
		# Background — dark, semi-transparent, inverted against bright lava blobs
		btn.add_theme_stylebox_override("normal",   _make_btn_style(Color(0.06, 0.04, 0.10, 0.88), Color(0.30, 0.25, 0.40)))
		btn.add_theme_stylebox_override("hover",    _make_btn_style(Color(0.10, 0.07, 0.16, 0.92), Color(0.55, 0.45, 0.70)))
		btn.add_theme_stylebox_override("pressed",  _make_btn_style(Color(0.04, 0.03, 0.07, 0.95), Color(0.20, 0.15, 0.30)))
		btn.add_theme_stylebox_override("disabled", _make_btn_style(Color(0.04, 0.03, 0.07, 0.50), Color(0.15, 0.12, 0.22)))
		btn.add_theme_stylebox_override("focus",    _make_btn_style(Color(0.08, 0.05, 0.14, 0.90), Color(0.70, 0.55, 0.90), 3))

func _make_btn_style(bg: Color, border: Color, border_width: int = 2) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.border_width_top    = border_width
	s.border_width_bottom = border_width
	s.border_width_left   = border_width
	s.border_width_right  = border_width
	s.corner_radius_top_left     = 8
	s.corner_radius_top_right    = 8
	s.corner_radius_bottom_left  = 8
	s.corner_radius_bottom_right = 8
	s.content_margin_left   = 14
	s.content_margin_right  = 14
	s.content_margin_top    = 8
	s.content_margin_bottom = 8
	return s


# ── Tween-based intro (top-to-bottom staggered fade, ≤2s total) ─────────────────

func _animate_intro() -> void:
	const INTRO_TOTAL := 2.0
	const BTN_FADE := 0.30

	modulate.a = 0.0
	var title_y := title_lbl.position.y
	title_lbl.position.y = title_y - 20.0
	tagline_lbl.modulate.a = 0.0
	for btn: Button in _menu_buttons:
		btn.modulate.a = 0.0

	var btn_count := _menu_buttons.size()
	var stagger := (INTRO_TOTAL - BTN_FADE) / maxf(1.0, float(btn_count - 1))

	var tw := create_tween().set_parallel(true)
	tw.tween_property(self, "modulate:a", 1.0, 0.35)
	tw.tween_property(title_lbl, "position:y", title_y, 0.42) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
	tw.tween_property(tagline_lbl, "modulate:a", 1.0, 0.35).set_delay(0.04)

	for i: int in range(btn_count):
		tw.tween_property(_menu_buttons[i], "modulate:a", 1.0, BTN_FADE) \
			.set_delay(0.06 + float(i) * stagger) \
			.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_SINE)

	var pulse := create_tween().set_loops()
	pulse.tween_property(title_lbl, "theme_override_font_sizes/font_size", 76, 0.65) \
		.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(title_lbl, "theme_override_font_sizes/font_size", 72, 0.65) \
		.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)


# ── Input / Actions ───────────────────────────────────────────────────────────

func _on_play() -> void:
	_play_menu_select()
	GameManager.reset_for_new_game()
	LevelManager.reset_progress()
	_fade_to(Main.instance.load_world_map)

func _on_continue() -> void:
	_play_menu_select()
	LevelManager.apply_session_to_game_manager()
	if LevelManager.is_session_game_over() or GameManager.lives <= 0:
		_show_game_over_panel()
		return
	_fade_to(Main.instance.load_world_map)

func _on_custom_level() -> void:
	_play_menu_select()
	_fade_to(Main.instance.load_custom_level_loader)

func _on_editor() -> void:
	_play_menu_select()
	_fade_to(Main.instance.load_level_editor)

func _on_credits() -> void:
	_play_menu_select()
	credits_text.text = CreditsContent.combined_bbcode()
	credits_text.fit_content = false
	center_menu.visible = false
	title_lbl.visible = false
	title_static_lbl.visible = false
	credits_panel.visible = true
	credits_panel.move_to_front()
	call_deferred("_layout_credits_text")

func _layout_credits_text() -> void:
	await get_tree().process_frame
	credits_text.fit_content = true
	var content_h: float = maxf(credits_text.get_content_height(), 120.0)
	credits_text.custom_minimum_size = Vector2(0.0, content_h)
	credits_text.fit_content = false

func _ensure_game_over_panel() -> void:
	game_over_panel = get_node_or_null("GameOverPanel") as Panel
	if game_over_panel != null:
		game_over_panel.visible = false
		return
	game_over_panel = Panel.new()
	game_over_panel.name = "GameOverPanel"
	game_over_panel.visible = false
	game_over_panel.anchor_left = 0.25
	game_over_panel.anchor_right = 0.75
	game_over_panel.anchor_top = 0.28
	game_over_panel.anchor_bottom = 0.72
	game_over_panel.z_index = 90
	add_child(game_over_panel)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.06, 0.05, 0.12, 0.96)
	style.border_color = Color(0.85, 0.25, 0.3, 0.95)
	style.border_width_left = 3
	style.border_width_top = 3
	style.border_width_right = 3
	style.border_width_bottom = 3
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	game_over_panel.add_theme_stylebox_override("panel", style)
	var title := Label.new()
	title.name = "TitleLabel"
	title.text = "GAME OVER"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.anchor_left = 0.08
	title.anchor_right = 0.92
	title.anchor_top = 0.1
	title.anchor_bottom = 0.28
	title.add_theme_font_size_override("font_size", 36)
	game_over_panel.add_child(title)
	var msg := Label.new()
	msg.name = "MessageLabel"
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	msg.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	msg.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	msg.anchor_left = 0.08
	msg.anchor_right = 0.92
	msg.anchor_top = 0.3
	msg.anchor_bottom = 0.52
	msg.add_theme_font_size_override("font_size", 17)
	game_over_panel.add_child(msg)
	var shop_btn_go := Button.new()
	shop_btn_go.name = "GoShopBtn"
	shop_btn_go.text = "World Map & Shop"
	shop_btn_go.anchor_left = 0.15
	shop_btn_go.anchor_right = 0.85
	shop_btn_go.anchor_top = 0.58
	shop_btn_go.offset_bottom = 44.0
	shop_btn_go.add_theme_font_size_override("font_size", 20)
	shop_btn_go.pressed.connect(_on_game_over_go_shop)
	game_over_panel.add_child(shop_btn_go)
	var dismiss := Button.new()
	dismiss.name = "DismissBtn"
	dismiss.text = "Stay on Menu"
	dismiss.anchor_left = 0.15
	dismiss.anchor_right = 0.85
	dismiss.anchor_top = 0.72
	dismiss.offset_bottom = 44.0
	dismiss.add_theme_font_size_override("font_size", 18)
	dismiss.pressed.connect(_on_game_over_dismiss)
	game_over_panel.add_child(dismiss)

func _setup_credits_panel() -> void:
	credits_panel.z_index = 100
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.1, 0.14, 0.96)
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.35, 0.55, 0.85, 0.9)
	credits_panel.add_theme_stylebox_override("panel", style)
	credits_text.add_theme_color_override("default_color", Color(0.92, 0.94, 0.98))
	credits_text.add_theme_color_override("font_selected_color", Color(0.55, 0.75, 1.0))
	credits_text.add_theme_color_override("font_outline_color", Color(0.05, 0.06, 0.08))
	credits_text.add_theme_constant_override("outline_size", 2)

func _on_options() -> void:
	_play_menu_select()
	var opts: Node = get_node_or_null("OptionsPanel")
	if opts == null:
		opts = preload("res://scripts/ui/options_panel.gd").new()
		opts.name = "OptionsPanel"
		opts.closed.connect(_on_options_closed)
		add_child(opts)
	opts.open()

func _on_options_closed() -> void:
	pass

func _on_quit() -> void:
	_play_menu_select()
	get_tree().quit()

func _fade_to(callback: Callable) -> void:
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.28)
	tw.tween_callback(callback)

func _show_game_over_panel() -> void:
	if game_over_panel == null:
		return
	game_over_panel.visible = true
	game_over_panel.move_to_front()
	var msg := game_over_panel.get_node_or_null("MessageLabel") as Label
	if msg:
		msg.text = "You have no lives left.\nBuy a life in the Shop (10 coins), then press Continue again."

func _on_game_over_go_shop() -> void:
	_play_menu_select()
	if game_over_panel:
		game_over_panel.visible = false
	GameManager.set_meta("open_shop_on_map", true)
	_fade_to(Main.instance.load_world_map)

func _on_game_over_dismiss() -> void:
	_play_menu_select()
	if game_over_panel:
		game_over_panel.visible = false

func _on_credits_close() -> void:
	_play_menu_select()
	credits_panel.visible = false
	center_menu.visible = true
	title_lbl.visible = true
	title_static_lbl.visible = true

func _html_to_bbcode(html: String) -> String:
	var re := RegEx.new()
	re.compile("<a href=\"([^\"]+)\">([^<]+)</a>")
	return re.sub(html, "[url=$1]$2[/url]", true)

func _on_credits_link(meta: Variant) -> void:
	if meta is String:
		OS.shell_open(meta)

func _play_menu_select() -> void:
	_notify_web_audio_gesture()
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("menu_select")


# ── Cheat codes ───────────────────────────────────────────────────────────────

func _input(event: InputEvent) -> void:
	if OS.has_feature("web"):
		if event is InputEventMouseButton and event.pressed:
			_notify_web_audio_gesture()
		elif event is InputEventScreenTouch and event.pressed:
			_notify_web_audio_gesture()
	if credits_panel.visible:
		if event.is_action_pressed("ui_cancel") or (event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE):
			_on_credits_close()
			return
	if event is InputEventKey and event.pressed and not event.echo:
		var ch := event.as_text().to_lower()
		if ch.length() == 1 and ch[0] >= 'a' and ch[0] <= 'z':
			_cheat_buffer += ch
			if _cheat_buffer.length() > 10:
				_cheat_buffer = _cheat_buffer.substr(_cheat_buffer.length() - 10)
			if _cheat_buffer.contains("jilly"):
				_unlock_all_levels()
				_cheat_buffer = ""
			elif _cheat_buffer.contains("coins"):
				_give_coins(100)
				_cheat_buffer = ""
			elif _cheat_buffer.contains("lives"):
				_give_lives(100)
				_cheat_buffer = ""

func _unlock_all_levels() -> void:
	for w: int in range(1, 7):
		for l: int in range(1, 7):
			LevelManager._unlock(w, l)
		LevelManager.save_data.get_or_add("bonuses", {})[w] = true
	LevelManager.unlock_secret()
	LevelManager.save_progress()
	continue_btn.visible = true
	_show_cheat_feedback("All levels unlocked! Secret world revealed!")

func _give_coins(amount: int) -> void:
	GameManager.coins += amount
	GameManager.coins_changed.emit(GameManager.coins)
	LevelManager.save_progress()
	_show_cheat_feedback("+%d coins!" % amount)

func _give_lives(amount: int) -> void:
	GameManager.lives += amount
	GameManager.lives_changed.emit(GameManager.lives)
	LevelManager.clear_session_game_over()
	LevelManager.save_progress()
	_show_cheat_feedback("+%d lives!" % amount)

func _show_cheat_feedback(text: String) -> void:
	var cheat_lbl := Label.new()
	cheat_lbl.text = text
	cheat_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cheat_lbl.add_theme_font_size_override("font_size", 28)
	cheat_lbl.position = Vector2(640, 680)
	add_child(cheat_lbl)
	var tw := create_tween()
	tw.tween_property(cheat_lbl, "modulate:a", 0.0, 2.0)
	tw.tween_callback(func(): cheat_lbl.queue_free())

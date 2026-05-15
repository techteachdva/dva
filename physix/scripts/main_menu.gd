extends Control

const VERSION := "0.3.0"

@onready var title_lbl:         Label  = $TitleLabel
@onready var title_static_lbl: Label  = $TitleLabelStatic
@onready var tagline_lbl:        Label  = $Center/VBox/TaglineLabel
@onready var play_btn:     Button = $Center/VBox/PlayBtn
@onready var continue_btn: Button = $Center/VBox/ContinueBtn
@onready var load_custom_btn: Button = $Center/VBox/LoadCustomBtn
@onready var editor_btn:   Button = $Center/VBox/EditorBtn
@onready var credits_btn:  Button = $Center/VBox/CreditsBtn
@onready var shop_btn:     Button = $Center/VBox/ShopBtn
	@onready var options_btn:  Button = $Center/VBox/OptionsBtn
@onready var quit_btn:     Button = $Center/VBox/QuitBtn
@onready var version_lbl:  Label  = $VersionLabel
@onready var credits_panel: Panel  = $CreditsPanel
@onready var credits_text: RichTextLabel = $CreditsPanel/Margin/VBox/Scroll/Text
@onready var credits_close: Button = $CreditsPanel/Margin/VBox/CloseBtn

var _cheat_buffer: String = ""

# Ordered list for top-to-bottom staggered reveal
var _menu_buttons: Array[Button] = []

func _ready() -> void:
	version_lbl.text        = "v" + VERSION
	continue_btn.visible    = FileAccess.file_exists(LevelManager.SAVE_FILE)

	# Load shop panel once (matches old _add_shop_button behavior)
	var shop_panel: Node = load("res://scenes/ui/shop_panel.tscn").instantiate()
	add_child(shop_panel)

	# Wire signals
	play_btn.pressed.connect(_on_play)
	continue_btn.pressed.connect(_on_continue)
	load_custom_btn.pressed.connect(_on_custom_level)
	editor_btn.pressed.connect(_on_editor)
	credits_btn.pressed.connect(_on_credits)
	shop_btn.pressed.connect(_on_shop)
	options_btn.pressed.connect(_on_options)
	quit_btn.pressed.connect(_on_quit)
	credits_close.pressed.connect(_on_credits_close)
	credits_text.meta_clicked.connect(_on_credits_link)

	# Build ordered button list for staggered animation
	_menu_buttons = [play_btn, continue_btn, load_custom_btn, editor_btn, credits_btn, shop_btn, options_btn, quit_btn]

	# Style every menu button consistently
	_style_buttons()

	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.playback_mode = LevelManager.get_music_mode()
		AudioManager.loop_enabled = LevelManager.is_music_loop_enabled()
		AudioManager.single_track = LevelManager.get_equipped_music()
		AudioManager.play_music("menu")

	_animate_intro()


# ── Button Styling (inverted against lava background) ─────────────────────────

func _style_buttons() -> void:
	var icons := {
		play_btn:       "▶  ",
		continue_btn:   "⏵  ",
		load_custom_btn:"📋  ",
		editor_btn:     "⚒  ",
		credits_btn:  "ⓘ  ",
		shop_btn:     "🛒  ",
		options_btn:  "⚙  ",
		quit_btn:     "✕  ",
	}
	for btn: Button in _menu_buttons:
		var prefix: String = icons.get(btn, "")
		if not btn.text.begins_with(prefix):
			btn.text = prefix + btn.text
		btn.custom_minimum_size = Vector2(320, 68)
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


# ── Tween-based intro (top-to-bottom staggered reveal) ────────────────────────

func _animate_intro() -> void:
	# Start invisible
	modulate.a = 0.0
	title_lbl.position.y -= 55
	tagline_lbl.modulate.a = 0.0
	for btn: Button in _menu_buttons:
		btn.modulate.a = 0.0

	var tw := create_tween().set_parallel(false)

	# 1. Fade in whole UI
	tw.tween_property(self, "modulate:a", 1.0, 0.175)

	# 2. Title drops with bounce
	tw.tween_property(title_lbl, "position:y", title_lbl.position.y + 55, 0.225) \
		.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BOUNCE)

	# 3. Tagline fades
	tw.tween_property(tagline_lbl, "modulate:a", 1.0, 0.125)

	# 4. Buttons roll out top-to-bottom with stagger (slide + rotate + fade)
	var base_delay := 0.075
	var stagger := 0.025
	for i: int in range(_menu_buttons.size()):
		var btn := _menu_buttons[i]
		btn.pivot_offset = btn.size * 0.5
		btn.position.x -= 50
		btn.rotation = -0.06
		tw.tween_property(btn, "position:x", btn.position.x + 50, 0.14) \
			.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK) \
			.set_delay(base_delay + i * stagger)
		tw.tween_property(btn, "rotation", 0.0, 0.14) \
			.set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK) \
			.set_delay(base_delay + i * stagger)
		tw.tween_property(btn, "modulate:a", 1.0, 0.11) \
			.set_delay(base_delay + i * stagger + 0.01)

	# 5. Gentle title pulse — only the animated label
	var pulse := create_tween().set_loops()
	pulse.tween_property(title_lbl, "theme_override_font_sizes/font_size", 76, 0.65) \
		.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)
	pulse.tween_property(title_lbl, "theme_override_font_sizes/font_size", 72, 0.65) \
		.set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_SINE)


# ── Input / Actions ───────────────────────────────────────────────────────────

func _on_play() -> void:
	_play_menu_select()
	LevelManager.reset_progress()
	GameManager.reset_for_new_game()
	_fade_to(Main.instance.load_world_map)

func _on_continue() -> void:
	_play_menu_select()
	_fade_to(Main.instance.load_world_map)

func _on_custom_level() -> void:
	_play_menu_select()
	_fade_to(Main.instance.load_custom_level_loader)

func _on_editor() -> void:
	_play_menu_select()
	_fade_to(Main.instance.load_level_editor)

func _on_credits() -> void:
	_play_menu_select()
	var lines: Array[String] = []
	var music_file := FileAccess.open("res://assets/sounds/music/music_credits.txt", FileAccess.READ)
	if music_file:
		lines.append(_html_to_bbcode(music_file.get_as_text()))
	else:
		lines.append("[b]Music Credits[/b]\nMusic credits file not found.")
	lines.append("\n")
	var sfx_file := FileAccess.open("res://assets/sounds/sfx/sfx_credits.txt", FileAccess.READ)
	if sfx_file:
		lines.append(_html_to_bbcode(sfx_file.get_as_text()))
	else:
		lines.append("[b]Sound Effects Credits[/b]\nSFX credits file not found.")
	credits_text.text = "\n".join(lines)
	credits_panel.visible = true

func _on_shop() -> void:
	_play_menu_select()
	var shop: Node = get_node_or_null("ShopPanel")
	if shop:
		shop.open()

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

func _on_credits_close() -> void:
	_play_menu_select()
	credits_panel.visible = false

func _html_to_bbcode(html: String) -> String:
	var re := RegEx.new()
	re.compile("<a href=\"([^\"]+)\">([^<]+)</a>")
	return re.sub(html, "[url=$1]$2[/url]", true)

func _on_credits_link(meta: Variant) -> void:
	if meta is String:
		OS.shell_open(meta)

func _play_menu_select() -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("menu_select")


# ── Cheat codes ───────────────────────────────────────────────────────────────

func _input(event: InputEvent) -> void:
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

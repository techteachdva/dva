extends Panel

# OptionsPanel — reusable settings overlay
# Instantiate under any CanvasLayer or Control node.

signal closed()
signal main_menu_requested()

var music_slider: HSlider
var sfx_slider: HSlider
var reduce_motion_chk: CheckBox
var fullscreen_chk: CheckBox
var show_fps_chk: CheckBox

func _ready() -> void:
	visible = false
	set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	anchor_left = 0.5
	anchor_top = 0.5
	anchor_right = 0.5
	anchor_bottom = 0.5
	offset_left = -210.0
	offset_top = -230.0
	offset_right = 210.0
	offset_bottom = 230.0
	custom_minimum_size = Vector2(420, 460)
	mouse_filter = Control.MOUSE_FILTER_STOP

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.10, 0.14, 1.0)
	style.corner_radius_top_left = 12
	style.corner_radius_top_right = 12
	style.corner_radius_bottom_left = 12
	style.corner_radius_bottom_right = 12
	style.border_width_left = 2
	style.border_width_top = 2
	style.border_width_right = 2
	style.border_width_bottom = 2
	style.border_color = Color(0.3, 0.5, 0.7, 0.8)
	add_theme_stylebox_override("panel", style)

	var vbox := VBoxContainer.new()
	vbox.name = "VBox"
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.offset_left = 20
	vbox.offset_top = 20
	vbox.offset_right = -20
	vbox.offset_bottom = -20
	add_child(vbox)

	var title := Label.new()
	title.text = "Options"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 26)
	vbox.add_child(title)
	vbox.add_child(HSeparator.new())

	# Music Volume
	var music_lbl := Label.new()
	music_lbl.text = "Music Volume"
	music_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(music_lbl)

	music_slider = HSlider.new()
	music_slider.min_value = 0.0
	music_slider.max_value = 1.0
	music_slider.step = 0.01
	music_slider.value = AudioManager.music_volume if get_node_or_null("/root/AudioManager") != null else 0.4
	music_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	music_slider.value_changed.connect(_on_music_changed)
	vbox.add_child(music_slider)

	# SFX Volume
	var sfx_lbl := Label.new()
	sfx_lbl.text = "SFX Volume"
	sfx_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vbox.add_child(sfx_lbl)

	sfx_slider = HSlider.new()
	sfx_slider.min_value = 0.0
	sfx_slider.max_value = 1.0
	sfx_slider.step = 0.01
	sfx_slider.value = AudioManager.sfx_volume if get_node_or_null("/root/AudioManager") != null else 0.4
	sfx_slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sfx_slider.value_changed.connect(_on_sfx_changed)
	vbox.add_child(sfx_slider)

	vbox.add_child(HSeparator.new())

	# Reduce Motion
	reduce_motion_chk = CheckBox.new()
	reduce_motion_chk.text = "Reduce Motion"
	reduce_motion_chk.tooltip_text = "Disables camera shake, screen flashes, animated shaders, and FOV surges for accessibility."
	reduce_motion_chk.button_pressed = _get_bool_setting("reduce_motion", false)
	reduce_motion_chk.toggled.connect(_on_reduce_motion_toggled)
	vbox.add_child(reduce_motion_chk)

	# Fullscreen
	fullscreen_chk = CheckBox.new()
	fullscreen_chk.text = "Fullscreen"
	fullscreen_chk.button_pressed = _get_bool_setting("fullscreen", false)
	fullscreen_chk.toggled.connect(_on_fullscreen_toggled)
	vbox.add_child(fullscreen_chk)

	# Show FPS
	show_fps_chk = CheckBox.new()
	show_fps_chk.text = "Show FPS Counter"
	show_fps_chk.button_pressed = _get_bool_setting("show_fps", false)
	show_fps_chk.toggled.connect(_on_show_fps_toggled)
	vbox.add_child(show_fps_chk)

	vbox.add_child(HSeparator.new())

	var menu_btn := Button.new()
	menu_btn.text = "Main Menu"
	menu_btn.pressed.connect(_on_main_menu)
	vbox.add_child(menu_btn)

	var close_btn := Button.new()
	close_btn.text = "Close"
	close_btn.pressed.connect(_on_close)
	vbox.add_child(close_btn)

	var quit_btn := Button.new()
	quit_btn.text = "Quit Game"
	quit_btn.pressed.connect(_on_quit)
	vbox.add_child(quit_btn)

	_style_checkbox(reduce_motion_chk)
	_style_checkbox(fullscreen_chk)
	_style_checkbox(show_fps_chk)
	_style_button(menu_btn)
	_style_button(close_btn)
	_style_button(quit_btn)

func open() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	anchor_left = 0.5
	anchor_top = 0.5
	anchor_right = 0.5
	anchor_bottom = 0.5
	offset_left = -210.0
	offset_top = -230.0
	offset_right = 210.0
	offset_bottom = 230.0
	visible = true
	# Refresh values from saved settings
	if get_node_or_null("/root/AudioManager") != null:
		music_slider.value = AudioManager.music_volume
		sfx_slider.value = AudioManager.sfx_volume
	reduce_motion_chk.button_pressed = _get_bool_setting("reduce_motion", false)
	fullscreen_chk.button_pressed = _get_bool_setting("fullscreen", false)
	show_fps_chk.button_pressed = _get_bool_setting("show_fps", false)
	modulate.a = 1.0

func _on_music_changed(value: float) -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.music_volume = value
	LevelManager.set_setting("music_volume", value)

func _on_sfx_changed(value: float) -> void:
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.sfx_volume = value
	LevelManager.set_setting("sfx_volume", value)

func _on_reduce_motion_toggled(enabled: bool) -> void:
	LevelManager.set_setting("reduce_motion", enabled)
	_apply_reduce_motion(enabled)

func _on_fullscreen_toggled(enabled: bool) -> void:
	LevelManager.set_setting("fullscreen", enabled)
	if OS.has_feature("web"):
		return
	if enabled:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	else:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)

func _on_show_fps_toggled(enabled: bool) -> void:
	LevelManager.set_setting("show_fps", enabled)
	var fps_label := get_node_or_null("/root/Main/GUI/FPSCounter")
	if fps_label != null:
		fps_label.visible = enabled

func _on_main_menu() -> void:
	visible = false
	modulate.a = 1.0
	main_menu_requested.emit()
	closed.emit()


func _on_close() -> void:
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.12)
	tw.tween_property(self, "visible", false, 0.0)
	closed.emit()

func _on_quit() -> void:
	get_tree().quit()

func _get_bool_setting(key: String, default: bool) -> bool:
	var val: Variant = LevelManager.get_setting(key)
	if val == null:
		return default
	return bool(val)

func _apply_reduce_motion(enabled: bool) -> void:
	# Swap menu/world-map background materials to static when enabled
	var dark := Color(0.06, 0.04, 0.10, 1.0)
	var main_menu_bg := get_node_or_null("/root/Main/World/MainMenu/Background")
	if main_menu_bg != null and main_menu_bg is ColorRect:
		if enabled:
			main_menu_bg.material = null
			main_menu_bg.color = dark
		else:
			main_menu_bg.color = Color(1, 1, 1, 1)
			var mat := ShaderMaterial.new()
			mat.shader = preload("res://assets/shaders/lava_lamp_2d.gdshader")
			mat.set_shader_parameter("base_color", Color(0.15, 0.08, 0.25, 1))
			mat.set_shader_parameter("speed", 0.18)
			mat.set_shader_parameter("rainbow_mode", true)
			main_menu_bg.material = mat
	var world_bg := get_node_or_null("/root/Main/World/WorldMap/BGLayer/RainbowBG")
	if world_bg != null and world_bg is ColorRect:
		if enabled:
			world_bg.material = null
			world_bg.color = dark
		else:
			world_bg.color = Color(1, 1, 1, 1)
			var mat := ShaderMaterial.new()
			mat.shader = preload("res://assets/shaders/lava_lamp_2d.gdshader")
			mat.set_shader_parameter("base_color", Color(0.15, 0.08, 0.25, 1))
			mat.set_shader_parameter("speed", 0.18)
			mat.set_shader_parameter("rainbow_mode", true)
			world_bg.material = mat

func _style_checkbox(chk: CheckBox) -> void:
	chk.add_theme_color_override("font_color", Color(0.95, 0.93, 1.0, 1.0))
	chk.add_theme_font_size_override("font_size", 18)

func _style_button(btn: Button) -> void:
	btn.custom_minimum_size = Vector2(200, 48)
	btn.add_theme_font_size_override("font_size", 20)
	btn.add_theme_color_override("font_color", Color(0.95, 0.93, 1.0, 1.0))
	btn.add_theme_color_override("font_hover_color", Color(1.0, 0.65, 0.25, 1.0))
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0.12, 0.14, 0.20, 1.0)
	s.border_color = Color(0.30, 0.25, 0.40)
	s.border_width_top = 2
	s.border_width_bottom = 2
	s.border_width_left = 2
	s.border_width_right = 2
	s.corner_radius_top_left = 8
	s.corner_radius_top_right = 8
	s.corner_radius_bottom_left = 8
	s.corner_radius_bottom_right = 8
	btn.add_theme_stylebox_override("normal", s)
	var sh := s.duplicate()
	sh.bg_color = Color(0.10, 0.07, 0.16, 0.92)
	sh.border_color = Color(0.55, 0.45, 0.70)
	btn.add_theme_stylebox_override("hover", sh)
	var sp := s.duplicate()
	sp.bg_color = Color(0.04, 0.03, 0.07, 0.95)
	sp.border_color = Color(0.20, 0.15, 0.30)
	btn.add_theme_stylebox_override("pressed", sp)

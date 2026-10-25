class_name TuningLab
extends Control

# Tuning Lab: a main-menu screen for playtesting the ecosystem by hand. Every
# species has six multipliers (1 = the game's default), each held between
# half and double. They are saved and apply to every run you start next,
# in any mode; the HUD shows a TUNED badge while any are active. Copy puts
# them on the clipboard as JSON to paste back as candidate defaults.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const SPECIES: Array[String] = ["sheep", "rabbit", "boar", "human", "wolf", "falcon", "robin", "fish", "worm", "mushroom"]
# key, column title, what it does.
const COLUMNS: Array = [
	["birth", "Birth", "How fast they breed. 2 = twice as often."],
	["death", "Ageing", "How fast they age out. 2 = they die of old age twice as soon; 0.5 = they live twice as long. Hunger and fights still kill."],
	["hunger", "Hunger", "How fast they get hungry. Higher = more starving, more hunting and grazing."],
	["speed", "Speed", "How fast they move."],
	["hunt", "Hunting", "Their attacks: below 1 more of them miss, above 1 they hit harder."],
	["capacity", "Crowding", "How many the valley holds before crowding thins them out. Higher = room for more."],
	["herd", "Herding", "How strongly they gather with their own kind, and how big the bonus is for those in the middle of a group."],
]
# Strict limits: every multiplier stays between half and double.
const MIN_LOG: float = -1.0
const MAX_LOG: float = 1.0

var _gc: Node
var _sliders: Dictionary = {}
var _status: Label

func _ready() -> void:
	_gc = get_node("/root/GameConfig")
	var frame := FelecoUiScript.build_screen(self, "Tuning Lab", _on_back)
	var body: HBoxContainer = frame["body"]
	var card := FelecoUiScript.card(body, "")
	var hint := FelecoUiScript.label("Set how each species lives, then play a run and watch what happens. 1 is the game's default; every setting stays between half and double. Your settings apply to every run until you reset them.", 15, FelecoUiScript.MIST)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(hint)
	var grid := GridContainer.new()
	grid.columns = 1 + COLUMNS.size()
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 4)
	card.add_child(grid)
	grid.add_child(Control.new())
	for c: Array in COLUMNS:
		var h := FelecoUiScript.heading(c[1], 16, FelecoUiScript.GOLD)
		h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		h.tooltip_text = c[2]
		h.mouse_filter = Control.MOUSE_FILTER_STOP
		h.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		grid.add_child(h)
	for sp: String in SPECIES:
		grid.add_child(_species_cell(sp))
		for c: Array in COLUMNS:
			grid.add_child(_slider_cell(sp, c[0], c[2]))

	var footer: HBoxContainer = frame["footer"]
	_status = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_status.custom_minimum_size = Vector2(380, 0)
	footer.add_child(_status)
	for spec: Array in [["Reset all", _reset_all, "GhostButton"], ["Copy settings", _copy, "TouchButton"], ["Play Sandbox", _play, "PrimaryButton"]]:
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = spec[2]
		b.custom_minimum_size = Vector2(190, 52)
		b.pressed.connect(spec[1])
		footer.add_child(b)
	FelecoUiScript.dress_menu(self)
	_update_status()

func _species_cell(sp: String) -> Control:
	var row := HBoxContainer.new()
	row.custom_minimum_size = Vector2(150, 40)
	row.add_theme_constant_override("separation", 8)
	var art := TextureRect.new()
	art.texture = FelecoUiScript.species_texture(sp)
	art.custom_minimum_size = Vector2(40, 36)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(art)
	var lbl := FelecoUiScript.heading(sp.capitalize(), 16, FelecoUiScript.CREAM)
	lbl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	row.add_child(lbl)
	return row

func _slider_cell(sp: String, key: String, tip: String) -> Control:
	var cell := HBoxContainer.new()
	cell.add_theme_constant_override("separation", 4)
	cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	# Log scale: the middle is the default, the ends are half and double.
	var s := HSlider.new()
	s.min_value = MIN_LOG
	s.max_value = MAX_LOG
	s.step = 0.05
	s.custom_minimum_size = Vector2(80, 32)
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	s.tooltip_text = "%s · %s\n%s\nDouble-click the number to reset." % [sp.capitalize(), key, tip]
	s.value = clampf(log(_gc.tune(sp, key)) / log(2.0), MIN_LOG, MAX_LOG)
	cell.add_child(s)
	var value := FelecoUiScript.label("", 14, FelecoUiScript.CREAM)
	value.custom_minimum_size = Vector2(46, 0)
	value.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	value.mouse_filter = Control.MOUSE_FILTER_STOP
	value.tooltip_text = "Double-click to reset to 1."
	value.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and (e as InputEventMouseButton).double_click:
			s.value = 0.0)
	cell.add_child(value)
	s.value_changed.connect(func(v: float) -> void: _apply(sp, key, v, value))
	_sliders["%s:%s" % [sp, key]] = s
	_show_value(value, _gc.tune(sp, key))
	return cell

func _apply(sp: String, key: String, v: float, label: Label) -> void:
	var m: float = snappedf(pow(2.0, v), 0.01)
	var row: Dictionary = _gc.tuning.get(sp, {})
	if is_equal_approx(m, 1.0):
		row.erase(key)
	else:
		row[key] = m
	if row.is_empty():
		_gc.tuning.erase(sp)
	else:
		_gc.tuning[sp] = row
	_show_value(label, m)
	_gc.save_meta()
	_update_status()

func _show_value(label: Label, m: float) -> void:
	label.text = "×%s" % String.num(m, 2)
	label.add_theme_color_override("font_color", FelecoUiScript.CREAM if is_equal_approx(m, 1.0) else FelecoUiScript.GOLD)

func _update_status() -> void:
	var n: int = 0
	for sp: String in _gc.tuning.keys():
		n += (_gc.tuning[sp] as Dictionary).size()
	_status.text = "Game defaults." if n == 0 else "%d setting%s changed." % [n, "" if n == 1 else "s"]

func _reset_all() -> void:
	for s: HSlider in _sliders.values():
		s.value = 0.0
	_gc.tuning.clear()
	_gc.save_meta()
	_update_status()

func _copy() -> void:
	DisplayServer.clipboard_set(JSON.stringify({"tuning": _gc.tuning}, "  "))
	_status.text = "Copied to the clipboard."

func _play() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn")

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

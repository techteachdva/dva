class_name TuningLab
extends Control

# Tuning Lab, opened from Rules. Each species has a portrait and four
# strengths. Lowkey, Mid, Mega and Giga set one stat, or the whole animal.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const SPECIES: Array[String] = [
	"sheep", "rabbit", "deer", "goat", "boar", "mouse",
	"human", "wolf", "lion", "bear", "falcon", "robin",
	"fish", "worm", "beetle", "mushroom",
]
const COLUMNS: Array = [
	["birth", "Birth", "How often they breed."],
	["death", "Ageing", "How soon old age takes them. Higher means a shorter life."],
	["hunger", "Hunger", "How fast they burn food, and so how hard they hunt and graze."],
	["speed", "Speed", "How fast they walk, run and fly."],
	["hunt", "Hunting", "Below Mid, more attacks miss. Above Mid, the hits land harder."],
	["capacity", "Crowding", "How many the valley holds before the crowd thins them."],
	["herd", "Herding", "How tightly they pack, and how much the middle of a group is protected."],
	["size", "Size", "How big they are drawn. Giga beasts fill the meadow."],
	["nerve", "Nerve", "How fast they flee when they are afraid."],
	["grit", "Grit", "How hard they are to finish off. Giga shrugs off killing blows."],
]
const TIERS: Array = [
	["Lowkey", 0.5],
	["Mid", 1.0],
	["Mega", 2.0],
	["Giga", 4.0],
]

var _gc: Node
var _status: Label

func _ready() -> void:
	_gc = get_node("/root/GameConfig")
	var frame := FelecoUiScript.build_screen(self, "Tuning Lab", _on_back)
	var body: HBoxContainer = frame["body"]
	var card := FelecoUiScript.card(body, "")
	var hint := FelecoUiScript.label("Four strengths for every species. Lowkey is half, Mid is the valley as written, Mega is double, Giga is four times. Set the whole animal, or one stat at a time. It applies to the next run.", 15, FelecoUiScript.MIST)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(hint)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 460)
	card.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 8)
	scroll.add_child(list)
	for sp: String in SPECIES:
		list.add_child(_species_card(sp))
	var footer: HBoxContainer = frame["footer"]
	_status = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_status.custom_minimum_size = Vector2(380, 0)
	# No room beside the buttons on a tall phone: it reads under the hint.
	if get_viewport_rect().size.x < 900.0:
		card.add_child(_status)
		card.move_child(_status, hint.get_index() + 1)
	else:
		footer.add_child(_status)
	for spec: Array in [["Reset all", _reset_all, "GhostButton"], ["Copy settings", _copy, "TouchButton"], ["Play Sandbox", _play, "PrimaryButton"]]:
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = spec[2]
		b.custom_minimum_size = Vector2(190 if get_viewport_rect().size.x >= 900.0 else 150, 52)
		b.pressed.connect(spec[1])
		footer.add_child(b)
	FelecoUiScript.dress_menu(self)
	_update_status()

func _species_card(sp: String) -> Control:
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.11, 0.09, 0.9)
	sb.set_corner_radius_all(12)
	sb.set_content_margin_all(10)
	card.add_theme_stylebox_override("panel", sb)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	card.add_child(row)
	var art := TextureRect.new()
	art.texture = FelecoUiScript.species_texture(sp)
	art.custom_minimum_size = Vector2(84, 84)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(art)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 4)
	row.add_child(col)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	col.add_child(head)
	var name := FelecoUiScript.heading(SpeciesDB.label(sp), 18, FelecoUiScript.CREAM)
	name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(name)
	for tier: Array in TIERS:
		head.add_child(_tier_button(sp, "", tier[0], float(tier[1]), "Every stat → %s" % tier[0]))
	for c: Array in COLUMNS:
		var line := HBoxContainer.new()
		line.add_theme_constant_override("separation", 6)
		col.add_child(line)
		var stat := FelecoUiScript.label(c[1], 14, FelecoUiScript.MIST)
		stat.custom_minimum_size = Vector2(90, 0)
		stat.tooltip_text = c[2]
		line.add_child(stat)
		for tier: Array in TIERS:
			line.add_child(_tier_button(sp, c[0], tier[0], float(tier[1]), c[2]))
	return card

func _tier_button(sp: String, key: String, title: String, mult: float, tip: String) -> Button:
	var b := Button.new()
	b.text = title
	b.tooltip_text = tip
	b.custom_minimum_size = Vector2(78, 28)
	var on: bool = _is_on(sp, key, mult)
	b.theme_type_variation = "PrimaryButton" if on else "GhostButton"
	b.pressed.connect(func() -> void:
		if key.is_empty():
			for c: Array in COLUMNS:
				_write(sp, c[0], mult)
		else:
			_write(sp, key, mult)
		_rebuild())
	return b

func _is_on(sp: String, key: String, mult: float) -> bool:
	if key.is_empty():
		for c: Array in COLUMNS:
			if not is_equal_approx(_gc.tune(sp, c[0]), mult):
				return false
		return true
	return is_equal_approx(_gc.tune(sp, key), mult)

func _write(sp: String, key: String, mult: float) -> void:
	var row: Dictionary = _gc.tuning.get(sp, {})
	if is_equal_approx(mult, 1.0):
		row.erase(key)
	else:
		row[key] = mult
	if row.is_empty():
		_gc.tuning.erase(sp)
	else:
		_gc.tuning[sp] = row

func _rebuild() -> void:
	_gc.save_meta()
	call_deferred("_rebuild_now")

func _rebuild_now() -> void:
	for child in get_children():
		child.free()
	_ready()

func _update_status() -> void:
	var n: int = 0
	for sp: String in _gc.tuning.keys():
		n += (_gc.tuning[sp] as Dictionary).size()
	_status.text = "Valley defaults." if n == 0 else "%d setting%s changed." % [n, "" if n == 1 else "s"]

func _reset_all() -> void:
	_gc.tuning.clear()
	_gc.save_meta()
	_rebuild()

func _copy() -> void:
	DisplayServer.clipboard_set(JSON.stringify({"tuning": _gc.tuning}, "  "))
	_status.text = "Copied to the clipboard."

func _play() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn")

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

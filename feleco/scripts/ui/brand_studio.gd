class_name BrandStudio
extends Control

# Zoom in on the creature you claimed and brand it with light or dark magic.
# Each body part keeps its own colour, hide, size and shape.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const RIG: Shader = preload("res://scripts/visuals/creature_sprite_2d.gdshader")

var agent: MarkovAgent
var _part: String = "head"
var _mat: ShaderMaterial
var _swatches: HBoxContainer

func _ready() -> void:
	if agent == null or agent._data == null:
		queue_free()
		return
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.03, 0.04, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)
	var data := agent._data
	if data.brand.is_empty():
		data.brand = BrandBook.fresh("light")
	BrandBook.ensure(data)
	_build()

func _build() -> void:
	var panel := Panel.new()
	panel.set_anchors_preset(Control.PRESET_CENTER)
	panel.offset_left = -460
	panel.offset_top = -290
	panel.offset_right = 460
	panel.offset_bottom = 290
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.09, 0.08, 0.96)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	panel.add_theme_stylebox_override("panel", sb)
	add_child(panel)
	var title := FelecoUiScript.heading("Brand %s" % agent.display_name, 28, FelecoUiScript.GOLD)
	title.position = Vector2(24, 16)
	panel.add_child(title)
	var schools := HBoxContainer.new()
	schools.position = Vector2(24, 58)
	schools.add_theme_constant_override("separation", 8)
	panel.add_child(schools)
	_school_button(schools, "Light magic", "light")
	_school_button(schools, "Dark magic", "dark")
	_portrait(panel)
	var parts := HBoxContainer.new()
	parts.position = Vector2(340, 110)
	parts.size = Vector2(560, 40)
	parts.add_theme_constant_override("separation", 4)
	panel.add_child(parts)
	for i: int in BrandBook.PARTS.size():
		var id: String = BrandBook.PARTS[i]
		var b := Button.new()
		b.text = BrandBook.PART_NAMES[i]
		b.toggle_mode = true
		b.button_pressed = id == _part
		b.theme_type_variation = "PrimaryButton" if id == _part else "GhostButton"
		b.pressed.connect(func() -> void:
			_part = id
			_build_tools(panel))
		parts.add_child(b)
	_build_tools(panel)
	var close := Button.new()
	close.text = "Done"
	close.theme_type_variation = "PrimaryButton"
	close.custom_minimum_size = Vector2(140, 44)
	close.position = Vector2(756, 496)
	close.pressed.connect(queue_free)
	panel.add_child(close)

func _school_button(row: HBoxContainer, label: String, school: String) -> void:
	var b := Button.new()
	b.text = label
	b.theme_type_variation = "PrimaryButton" if str(agent._data.brand.get("school", "")) == school else "GhostButton"
	b.pressed.connect(func() -> void:
		var data := agent._data
		data.brand = BrandBook.fresh(school)
		BrandBook.ensure(data)
		BrandBook.paint(data)
		_refresh())
	row.add_child(b)

func _portrait(panel: Panel) -> void:
	var holder := Control.new()
	holder.position = Vector2(24, 110)
	holder.size = Vector2(300, 360)
	panel.add_child(holder)
	var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(agent.species_id, {"size": Vector2(2, 2), "gait": 8.0, "style": 0})
	var mi := MeshInstance2D.new()
	mi.mesh = FieldGuide._grid_mesh()
	_mat = ShaderMaterial.new()
	_mat.shader = RIG
	var tex: Texture2D = SpriteGenerator.anim_texture_for(agent.species_id)
	_mat.set_shader_parameter("sprite", tex)
	_mat.set_shader_parameter("quad", cfg["size"])
	_mat.set_shader_parameter("style", int(cfg["style"]))
	_mat.set_shader_parameter("gait", float(cfg["gait"]) * 0.35)
	_mat.set_shader_parameter("px", 150.0)
	_mat.set_shader_parameter("texel", Vector2(1.0 / tex.get_width(), 1.0 / tex.get_height()))
	_mat.set_shader_parameter("grid", Vector2(SpriteGenerator.FRAMES, SpriteGenerator.CELLS))
	_mat.set_shader_parameter("motion", 0.15)
	_mat.set_shader_parameter("brand_tex", BrandBook.atlas())
	_mat.set_shader_parameter("brand_slot", float(agent._data.brand_slot))
	mi.material = _mat
	mi.position = holder.size * 0.5
	holder.add_child(mi)

func _build_tools(panel: Panel) -> void:
	var old := panel.get_node_or_null("Tools")
	if old != null:
		old.queue_free()
	var box := VBoxContainer.new()
	box.name = "Tools"
	box.position = Vector2(340, 170)
	box.size = Vector2(550, 300)
	box.add_theme_constant_override("separation", 10)
	panel.add_child(box)
	var part: Dictionary = agent._data.brand["parts"][_part]
	box.add_child(FelecoUiScript.heading(BrandBook.PART_NAMES[BrandBook.PARTS.find(_part)], 18, FelecoUiScript.CREAM))
	box.add_child(FelecoUiScript.label("Colour", 14, FelecoUiScript.MIST))
	var colors := HBoxContainer.new()
	colors.add_theme_constant_override("separation", 4)
	box.add_child(colors)
	for c: Color in [Color(0.95, 0.92, 0.8), Color(1, 0.85, 0.3), Color(0.55, 0.85, 1), Color(0.7, 0.4, 1), Color(0.15, 0.02, 0.05), Color(0.7, 0.08, 0.08), Color(0.2, 0.55, 0.25), Color(0.9, 0.9, 0.95)]:
		var sw := Button.new()
		sw.custom_minimum_size = Vector2(36, 32)
		var st := StyleBoxFlat.new()
		st.bg_color = c
		st.set_corner_radius_all(6)
		sw.add_theme_stylebox_override("normal", st)
		sw.add_theme_stylebox_override("hover", st)
		sw.add_theme_stylebox_override("pressed", st)
		sw.pressed.connect(func() -> void: _set_part("color", c))
		colors.add_child(sw)
	box.add_child(FelecoUiScript.label("Hide", 14, FelecoUiScript.MIST))
	box.add_child(_cycle(BrandBook.TEXTURES, int(part["texture"]), "texture"))
	box.add_child(FelecoUiScript.label("Size", 14, FelecoUiScript.MIST))
	var sizes := HBoxContainer.new()
	sizes.add_theme_constant_override("separation", 6)
	box.add_child(sizes)
	for spec: Array in [["Small", 0.15], ["Natural", 0.45], ["Grand", 0.7], ["Vast", 1.0]]:
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = "PrimaryButton" if is_equal_approx(float(part["size"]), float(spec[1])) else "GhostButton"
		b.pressed.connect(func() -> void: _set_part("size", float(spec[1])))
		sizes.add_child(b)
	box.add_child(FelecoUiScript.label("Shape", 14, FelecoUiScript.MIST))
	box.add_child(_cycle(BrandBook.SHAPES, int(part["shape"]), "shape"))

func _cycle(names: Array, index: int, key: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var prev := Button.new()
	prev.text = "<"
	prev.theme_type_variation = "GhostButton"
	prev.pressed.connect(func() -> void: _set_part(key, posmod(index - 1, names.size())))
	row.add_child(prev)
	var label := FelecoUiScript.heading(str(names[index]), 16, FelecoUiScript.GOLD)
	label.custom_minimum_size = Vector2(160, 0)
	row.add_child(label)
	var next := Button.new()
	next.text = ">"
	next.theme_type_variation = "GhostButton"
	next.pressed.connect(func() -> void: _set_part(key, posmod(index + 1, names.size())))
	row.add_child(next)
	return row

func _set_part(key: String, value: Variant) -> void:
	agent._data.brand["parts"][_part][key] = value
	BrandBook.paint(agent._data)
	_refresh()

func _refresh() -> void:
	if _mat != null:
		_mat.set_shader_parameter("brand_tex", BrandBook.atlas())
		_mat.set_shader_parameter("brand_slot", float(agent._data.brand_slot))
	var panel := get_child(1) as Panel
	if panel != null:
		_build_tools(panel)
		for b in panel.get_child(2).get_children():
			if b is Button:
				var btn := b as Button
				btn.theme_type_variation = "PrimaryButton" if str(agent._data.brand.get("school", "")) == ("light" if "Light" in btn.text else "dark") else "GhostButton"

class_name BrandStudio
extends Control

# Zoom in on the creature you claimed and make it yours. Parts: each body
# part keeps its own colour, hide, size and shape. Paint: draw straight on the
# creature with a brush, or colour over a whole part. The drawing lives on the
# creature's body (see BrandBook), so it walks with them on every frame.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const RIG: Shader = preload("res://scripts/visuals/creature_sprite_2d.gdshader")

const STAGE := Rect2(24, 104, 430, 460)
const BRUSHES: Array = [["Fine", 2.0], ["Medium", 5.0], ["Broad", 10.0]]
const COLORS: Array[Color] = [
	Color(0.95, 0.92, 0.8), Color(1, 0.85, 0.3), Color(0.55, 0.85, 1), Color(0.7, 0.4, 1),
	Color(0.15, 0.02, 0.05), Color(0.7, 0.08, 0.08), Color(0.2, 0.55, 0.25), Color(0.9, 0.9, 0.95),
]
const MORE_COLORS: Array[Color] = [
	Color(1, 1, 1), Color(0.05, 0.05, 0.06), Color(0.95, 0.5, 0.12), Color(0.95, 0.45, 0.65),
	Color(0.45, 0.28, 0.16), Color(0.1, 0.65, 0.65), Color(0.15, 0.3, 0.85), Color(0.6, 0.85, 0.2),
]
const UNDO_STEPS: int = 12

var agent: MarkovAgent
var _part: String = "head"
var _mode: String = "parts"
var _mat: ShaderMaterial
var _quad: Vector2 = Vector2(2, 2)
var _px: float = 100.0
# Paint state: the creature's tile as an image, its undo history, the brush.
var _canvas: Image
var _undo: Array[PackedByteArray] = []
var _brush_color: Color = Color(0.7, 0.08, 0.08)
var _brush_size: float = 5.0
var _erasing: bool = false
var _stroking: bool = false
var _last: Vector2 = Vector2.ZERO
var _dirty: bool = false

func _ready() -> void:
	if agent == null or agent._data == null:
		queue_free()
		return
	# A CanvasLayer child still reports a zero size in _ready. Anchors computed
	# then pin the whole studio to the top-left corner, off the screen.
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 40
	# Primary and Ghost buttons live in this theme; a HUD child doesn't inherit it.
	theme = FelecoUiScript.theme()
	call_deferred("_open")

func _open() -> void:
	if agent == null or not is_instance_valid(agent) or agent._data == null:
		queue_free()
		return
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.03, 0.04, 0.82)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(dim)
	var data := agent._data
	if data.brand.is_empty():
		data.brand = BrandBook.fresh("light")
	BrandBook.ensure(data)
	BrandBook.keep(data)
	_canvas = BrandBook.canvas(data)
	_build()
	resized.connect(_place)
	_place()

# Centred, and shrunk to fit a tall narrow phone screen.
func _place() -> void:
	var panel := get_node_or_null("StudioPanel") as Panel
	if panel == null:
		return
	var view: Vector2 = get_viewport_rect().size
	var k: float = minf(1.0, minf((view.x - 16.0) / panel.size.x, (view.y - 16.0) / panel.size.y))
	panel.scale = Vector2(k, k)
	panel.position = ((view - panel.size * k) * 0.5).floor()

func _build() -> void:
	var panel := Panel.new()
	panel.name = "StudioPanel"
	panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
	panel.size = Vector2(1040, 590)
	panel.clip_contents = true
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.09, 0.08)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	panel.add_theme_stylebox_override("panel", sb)
	add_child(panel)
	var title := FelecoUiScript.heading("Brand %s" % agent.display_name, 28, FelecoUiScript.GOLD)
	title.position = Vector2(24, 16)
	panel.add_child(title)
	var schools := HBoxContainer.new()
	schools.name = "Schools"
	schools.position = Vector2(24, 58)
	schools.add_theme_constant_override("separation", 8)
	panel.add_child(schools)
	_school_button(schools, "Light magic", "light")
	_school_button(schools, "Dark magic", "dark")
	var tabs := HBoxContainer.new()
	tabs.name = "Tabs"
	tabs.position = Vector2(470, 16)
	tabs.add_theme_constant_override("separation", 8)
	panel.add_child(tabs)
	for spec: Array in [["Body parts", "parts"], ["Paint", "paint"]]:
		var b := Button.new()
		b.text = spec[0]
		b.custom_minimum_size = Vector2(130, 44)
		b.pressed.connect(_set_mode.bind(spec[1]))
		tabs.add_child(b)
	_portrait(panel)
	var parts := HBoxContainer.new()
	parts.name = "Parts"
	parts.position = Vector2(470, 70)
	parts.size = Vector2(550, 40)
	parts.add_theme_constant_override("separation", 4)
	panel.add_child(parts)
	for i: int in BrandBook.PARTS.size():
		var id: String = BrandBook.PARTS[i]
		var b := Button.new()
		b.text = BrandBook.PART_NAMES[i]
		b.pressed.connect(_select_part.bind(id, parts, panel))
		parts.add_child(b)
	_build_tools(panel)
	var close := Button.new()
	close.name = "Done"
	close.text = "Done"
	close.theme_type_variation = "PrimaryButton"
	close.custom_minimum_size = Vector2(140, 44)
	close.position = Vector2(880, 530)
	close.pressed.connect(queue_free)
	panel.add_child(close)
	_refresh_buttons()

func _school_button(row: HBoxContainer, label: String, school: String) -> void:
	var b := Button.new()
	b.text = label
	b.theme_type_variation = "PrimaryButton" if str(agent._data.brand.get("school", "")) == school else "GhostButton"
	b.pressed.connect(func() -> void:
		var data := agent._data
		# A new palette for the parts; what you drew stays drawn.
		var drawn: Variant = data.brand.get("paint")
		data.brand = BrandBook.fresh(school)
		if drawn != null:
			data.brand["paint"] = drawn
		BrandBook.ensure(data)
		BrandBook.paint(data)
		_refresh())
	row.add_child(b)

func _portrait(panel: Panel) -> void:
	var holder := Control.new()
	holder.name = "Stage"
	holder.position = STAGE.position
	holder.size = STAGE.size
	holder.clip_contents = true
	holder.gui_input.connect(_on_stage_input)
	panel.add_child(holder)
	var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(agent.species_id, {"size": Vector2(2, 2), "gait": 8.0, "style": 0})
	var mi := MeshInstance2D.new()
	mi.mesh = FieldGuide._grid_mesh()
	_mat = ShaderMaterial.new()
	_mat.shader = RIG
	var tex: Texture2D = SpriteGenerator.anim_texture_for(agent.species_id)
	_mat.set_shader_parameter("sprite", tex)
	_quad = cfg["size"]
	_px = 420.0 / maxf(_quad.x, _quad.y)
	_mat.set_shader_parameter("quad", cfg["size"])
	_mat.set_shader_parameter("style", int(cfg["style"]))
	_mat.set_shader_parameter("px", _px)
	_mat.set_shader_parameter("texel", Vector2(1.0 / tex.get_width(), 1.0 / tex.get_height()))
	_mat.set_shader_parameter("grid", Vector2(SpriteGenerator.FRAMES, SpriteGenerator.CELLS))
	# The creature you claimed: its own kind and sex, not the plain male.
	var cell: int = Roles.role_index(agent._data.role) + (SpriteGenerator.COLS if agent._data.female else 0)
	_mat.set_shader_parameter("atlas_cell", float(cell))
	_mat.set_shader_parameter("brand_slot", float(agent._data.brand_slot))
	_mat.set_shader_parameter("gait", float(cfg["gait"]) * 0.35)
	mi.material = _mat
	mi.position = holder.size * 0.5
	holder.add_child(mi)
	_sync_stage()

# Painting needs a creature that holds still and sits exactly on the canvas.
func _sync_stage() -> void:
	if _mat == null:
		return
	var painting: bool = _mode == "paint"
	var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(agent.species_id, {"gait": 8.0})
	_mat.set_shader_parameter("force_frame", SpriteGenerator.F_STAND if painting else -1)
	_mat.set_shader_parameter("flat_body", 1.0 if painting else 0.0)
	_mat.set_shader_parameter("gait", 0.0 if painting else float(cfg["gait"]) * 0.35)
	_mat.set_shader_parameter("motion", 0.0 if painting else 0.15)
	_mat.set_shader_parameter("brand_tex", BrandBook.atlas())
	_mat.set_shader_parameter("paint_tex", BrandBook.paint_atlas())
	var stage := get_node_or_null("StudioPanel/Stage") as Control
	if stage != null:
		stage.mouse_default_cursor_shape = Control.CURSOR_CROSS if painting else Control.CURSOR_ARROW

func _set_mode(mode: String) -> void:
	_mode = mode
	_sync_stage()
	_rebuild_tools.call_deferred()

func _build_tools(panel: Panel) -> void:
	var old := panel.get_node_or_null("Tools")
	if old != null:
		old.free()
	var box := VBoxContainer.new()
	box.name = "Tools"
	box.position = Vector2(470, 122)
	box.size = Vector2(550, 400)
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	if _mode == "paint":
		_paint_tools(box)
	else:
		_part_tools(box)
	# Tools is rebuilt on every change and its wide rows reach Done's height:
	# without this they land on top of it and swallow the click.
	var done := panel.get_node_or_null("Done")
	if done != null:
		done.move_to_front()

func _part_tools(box: VBoxContainer) -> void:
	var part: Dictionary = agent._data.brand["parts"][_part]
	box.add_child(FelecoUiScript.heading(BrandBook.PART_NAMES[BrandBook.PARTS.find(_part)], 18, FelecoUiScript.CREAM))
	box.add_child(FelecoUiScript.label("Colour", 14, FelecoUiScript.MIST))
	box.add_child(_swatches(COLORS, part["color"], func(c: Color) -> void: _set_part("color", c)))
	box.add_child(FelecoUiScript.label("Hide", 14, FelecoUiScript.MIST))
	box.add_child(_cycle(BrandBook.TEXTURES, int(part["texture"]), "texture"))
	box.add_child(FelecoUiScript.label("Size", 14, FelecoUiScript.MIST))
	var sizes := HBoxContainer.new()
	sizes.add_theme_constant_override("separation", 6)
	box.add_child(sizes)
	var nearest: float = float(BrandBook.SIZES[0][1])
	for spec: Array in BrandBook.SIZES:
		if absf(float(spec[1]) - float(part["size"])) < absf(nearest - float(part["size"])):
			nearest = float(spec[1])
	for spec: Array in BrandBook.SIZES:
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = "PrimaryButton" if float(spec[1]) == nearest else "GhostButton"
		b.pressed.connect(_set_part.bind("size", float(spec[1])))
		sizes.add_child(b)
	box.add_child(FelecoUiScript.label("Shape", 14, FelecoUiScript.MIST))
	box.add_child(_cycle(BrandBook.SHAPES, int(part["shape"]), "shape"))

func _paint_tools(box: VBoxContainer) -> void:
	box.add_child(FelecoUiScript.label("Draw on the creature, or colour over a whole part.", 15, FelecoUiScript.CREAM))
	box.add_child(FelecoUiScript.label("Colour", 14, FelecoUiScript.MIST))
	box.add_child(_swatches(COLORS, _brush_color, _pick_brush_color))
	box.add_child(_swatches(MORE_COLORS, _brush_color, _pick_brush_color))
	box.add_child(FelecoUiScript.label("Brush", 14, FelecoUiScript.MIST))
	var sizes := HBoxContainer.new()
	sizes.add_theme_constant_override("separation", 6)
	box.add_child(sizes)
	for spec: Array in BRUSHES:
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = "PrimaryButton" if is_equal_approx(_brush_size, float(spec[1])) else "GhostButton"
		b.pressed.connect(func() -> void:
			_brush_size = float(spec[1])
			_rebuild_tools.call_deferred())
		sizes.add_child(b)
	var eraser := Button.new()
	eraser.text = "Eraser"
	eraser.theme_type_variation = "PrimaryButton" if _erasing else "GhostButton"
	eraser.pressed.connect(func() -> void:
		_erasing = not _erasing
		_rebuild_tools.call_deferred())
	sizes.add_child(eraser)
	var acts := HBoxContainer.new()
	acts.add_theme_constant_override("separation", 6)
	box.add_child(acts)
	var part_name: String = BrandBook.PART_NAMES[BrandBook.PARTS.find(_part)]
	for spec: Array in [["Colour over the %s" % part_name, _fill_part], ["Undo", _undo_stroke], ["Clear", _clear_paint]]:
		var b := Button.new()
		b.text = spec[0]
		b.theme_type_variation = "GhostButton"
		b.pressed.connect(spec[1])
		acts.add_child(b)
	box.add_child(FelecoUiScript.label("Pick a body part above to colour it over.", 13, FelecoUiScript.MIST))

func _swatches(list: Array[Color], chosen: Color, on_pick: Callable) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	for c: Color in list:
		var sw := Button.new()
		sw.custom_minimum_size = Vector2(36, 32)
		var st := StyleBoxFlat.new()
		st.bg_color = c
		st.set_corner_radius_all(6)
		if chosen.is_equal_approx(c):
			st.border_color = FelecoUiScript.GOLD
			st.set_border_width_all(3)
		sw.add_theme_stylebox_override("normal", st)
		sw.add_theme_stylebox_override("hover", st)
		sw.add_theme_stylebox_override("pressed", st)
		sw.pressed.connect(on_pick.bind(c))
		row.add_child(sw)
	return row

func _pick_brush_color(c: Color) -> void:
	_brush_color = c
	_erasing = false
	_rebuild_tools.call_deferred()

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

func _select_part(id: String, _parts: HBoxContainer, panel: Panel) -> void:
	_part = id
	_refresh_buttons()
	_build_tools(panel)

func _refresh_buttons() -> void:
	var parts := get_node_or_null("StudioPanel/Parts")
	if parts != null:
		for other: Node in parts.get_children():
			var on: bool = (other as Button).text == BrandBook.PART_NAMES[BrandBook.PARTS.find(_part)]
			(other as Button).theme_type_variation = "PrimaryButton" if on else "GhostButton"
	var tabs := get_node_or_null("StudioPanel/Tabs")
	if tabs != null:
		for b: Node in tabs.get_children():
			var on: bool = ((b as Button).text == "Paint") == (_mode == "paint")
			(b as Button).theme_type_variation = "PrimaryButton" if on else "GhostButton"

func _set_part(key: String, value: Variant) -> void:
	agent._data.brand["parts"][_part][key] = value
	BrandBook.paint(agent._data)
	_refresh()

func _refresh() -> void:
	if _mat != null:
		_mat.set_shader_parameter("brand_tex", BrandBook.atlas())
		_mat.set_shader_parameter("brand_slot", float(agent._data.brand_slot))
	# The colour button that called this still lives inside Tools. Freeing
	# that row in the same call would delete the button mid-signal.
	_rebuild_tools.call_deferred()

func _rebuild_tools() -> void:
	var panel := get_node_or_null("StudioPanel") as Panel
	if panel != null:
		_build_tools(panel)
		_refresh_buttons()
		var schools := panel.get_node_or_null("Schools")
		if schools != null:
			for b in schools.get_children():
				if b is Button:
					var btn := b as Button
					var want: String = "light" if "Light" in btn.text else "dark"
					btn.theme_type_variation = "PrimaryButton" if str(agent._data.brand.get("school", "")) == want else "GhostButton"

# ------------------------------------------------------------------
# Painting
# ------------------------------------------------------------------
func _on_stage_input(event: InputEvent) -> void:
	if _mode != "paint":
		return
	var mb := event as InputEventMouseButton
	if mb != null and mb.button_index == MOUSE_BUTTON_LEFT:
		if mb.pressed:
			_remember()
			_stroking = true
			_last = _to_canvas(mb.position)
			_stamp(_last)
		else:
			_stroking = false
		accept_event()
		return
	var mm := event as InputEventMouseMotion
	if mm != null and _stroking:
		var at: Vector2 = _to_canvas(mm.position)
		var steps: int = maxi(1, int(_last.distance_to(at) / maxf(_brush_size * 0.4, 1.0)))
		for i: int in range(1, steps + 1):
			_stamp(_last.lerp(at, float(i) / steps))
		_last = at
		accept_event()

# The stage's picture is the sprite's quad, centred: this is the mesh mapping
# in FieldGuide._grid_mesh and creature_sprite_2d run backwards.
func _to_canvas(at: Vector2) -> Vector2:
	var off: Vector2 = at - STAGE.size * 0.5
	var uv := Vector2(off.x / (_quad.x * _px) + 0.5, off.y / (_quad.y * _px) + 0.5)
	return uv * float(BrandBook.PAINT_TILE)

func _stamp(at: Vector2) -> void:
	var r: float = _brush_size
	var n: int = BrandBook.PAINT_TILE
	for y: int in range(maxi(0, int(at.y - r - 1.0)), mini(n, int(at.y + r + 2.0))):
		for x: int in range(maxi(0, int(at.x - r - 1.0)), mini(n, int(at.x + r + 2.0))):
			var d: float = Vector2(x + 0.5, y + 0.5).distance_to(at)
			var k: float = clampf(r + 0.5 - d, 0.0, 1.0)
			if k <= 0.0:
				continue
			var old: Color = _canvas.get_pixel(x, y)
			if _erasing:
				_canvas.set_pixel(x, y, Color(old.r, old.g, old.b, minf(old.a, 1.0 - k)))
			else:
				_canvas.set_pixel(x, y, Color(_brush_color.r, _brush_color.g, _brush_color.b, maxf(old.a, k)))
	_dirty = true

func _fill_part() -> void:
	_remember()
	var n: int = BrandBook.PAINT_TILE
	var want: int = BrandBook.PARTS.find(_part)
	for y: int in n:
		for x: int in n:
			if BrandBook.part_at((x + 0.5) / n, 1.0 - (y + 0.5) / n) == want:
				_canvas.set_pixel(x, y, _brush_color)
	_dirty = true

func _clear_paint() -> void:
	_remember()
	_canvas.fill(BrandBook.BLANK)
	_dirty = true

func _remember() -> void:
	_undo.append(_canvas.get_data())
	if _undo.size() > UNDO_STEPS:
		_undo.pop_front()

func _undo_stroke() -> void:
	if _undo.is_empty():
		return
	var n: int = BrandBook.PAINT_TILE
	_canvas = Image.create_from_data(n, n, false, Image.FORMAT_RGBA8, _undo.pop_back())
	_dirty = true

# At most once a frame, however fast the mouse moves.
func _process(_delta: float) -> void:
	if _dirty and _canvas != null and is_instance_valid(agent):
		_dirty = false
		BrandBook.set_canvas(agent._data, _canvas)
		if _mat != null:
			_mat.set_shader_parameter("paint_tex", BrandBook.paint_atlas())

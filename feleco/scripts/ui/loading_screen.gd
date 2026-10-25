extends Control

# The ecosystem poster covers the valley while it wakes. Play blows it away
# as dust: the poster is eaten grain by grain while each grain flies off.

const POSTER: Texture2D = preload("res://assets/ui/ecosystem_poster.png")
const DISSOLVE: Shader = preload("res://scripts/visuals/poster_dissolve.gdshader")
const DUST: Shader = preload("res://scripts/visuals/poster_dust.gdshader")
const GRID := Vector2i(192, 108)
const SPAN: float = 1.4
const LIFE: float = 1.3
const BG := Color(0.071, 0.098, 0.082)
const GOLD := Color(0.902, 0.765, 0.416)

var _sim: SimulationDirector = null
var _layer: CanvasLayer
var _root: Control
var _poster: TextureRect
var _guide: FieldGuide
var _status: Label
var _play: Button
var _ticker: TipTicker
var _ready_to_play: bool = false
var _gone: bool = false
var _dots: float = 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var args := OS.get_cmdline_user_args()
	if DisplayServer.get_name() == "headless" or ("--sim" in args) or (args.size() > 0 and not "--poster" in args):
		queue_free()
		return
	var world: Node3D = get_tree().current_scene.get_node_or_null("World")
	if world != null:
		_sim = world as SimulationDirector
	_layer = CanvasLayer.new()
	_layer.layer = 50
	add_child(_layer)
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_layer.add_child(_root)
	var bg := ColorRect.new()
	bg.name = "Backdrop"
	bg.color = BG
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.add_child(bg)
	_poster = TextureRect.new()
	_poster.texture = POSTER
	_poster.set_anchors_preset(Control.PRESET_FULL_RECT)
	_poster.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_poster.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	var mat := ShaderMaterial.new()
	mat.shader = DISSOLVE
	mat.set_shader_parameter("mask", _build_mask())
	mat.set_shader_parameter("span", SPAN)
	_poster.material = mat
	_root.add_child(_poster)
	# The living Field Guide replaces the baked poster (kept only as the
	# dissolve fallback when the guide can't be built).
	_guide = FieldGuide.new()
	_root.add_child(_guide)
	_poster.visible = false

	_status = Label.new()
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.add_theme_font_size_override("font_size", 20)
	_status.add_theme_color_override("font_color", GOLD)
	_status.add_theme_color_override("font_outline_color", BG)
	_status.add_theme_constant_override("outline_size", 6)
	_root.add_child(_status)

	_play = Button.new()
	_play.text = "Play"
	_play.focus_mode = Control.FOCUS_ALL
	_play.custom_minimum_size = Vector2(240, 60)
	_play.add_theme_font_size_override("font_size", 28)
	for state: String in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = GOLD if state != "pressed" else GOLD.darkened(0.15)
		if state == "hover":
			sb.bg_color = GOLD.lightened(0.12)
		sb.set_corner_radius_all(30)
		sb.shadow_color = Color(0.902, 0.765, 0.416, 0.45)
		sb.shadow_size = 18 if state == "hover" else 10
		if state == "focus":
			sb.draw_center = false
			sb.border_color = Color(1, 1, 1, 0.6)
			sb.set_border_width_all(2)
		_play.add_theme_stylebox_override(state, sb)
	for c: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		_play.add_theme_color_override(c, Color(0.1, 0.13, 0.1))
	_play.modulate.a = 0.0
	_play.visible = false
	_play.pressed.connect(_blow_away)
	_root.add_child(_play)
	_ticker = TipTicker.new()
	_root.add_child(_ticker)
	_root.resized.connect(_layout)
	_layout()

func _poster_rect() -> Rect2:
	var view: Vector2 = _root.size
	var tex: Vector2 = POSTER.get_size()
	var s: float = minf(view.x / tex.x, view.y / tex.y)
	var sz: Vector2 = tex * s
	return Rect2((view - sz) * 0.5, sz)

func _layout() -> void:
	if _guide != null:
		_guide.position = Vector2.ZERO
		_guide.size = _root.size if _root.size.x > 0.0 else get_viewport().get_visible_rect().size
	var r := _poster_rect()
	# Bottom right, in the free space under the Field Guide's sun-and-moon
	# panel, so it covers nothing in the food web.
	var at := r.position + Vector2(r.size.x * (0.82 if _guide != null else 0.5), r.size.y * (1036.0 / 1080.0))
	_play.position = at - _play.custom_minimum_size * 0.5
	_status.size = Vector2(600, 30)
	_status.position = at - Vector2(300, 48)
	_ticker.custom_minimum_size = Vector2(minf(900.0, r.size.x * 0.62), 0)
	_ticker.size = Vector2(_ticker.custom_minimum_size.x, 0)
	_ticker.position = Vector2(r.position.x + (r.size.x - _ticker.size.x) * 0.5, at.y - 2)

# Edges go first, with a ragged noisy front, so the dust peels off every side.
func _build_mask() -> ImageTexture:
	var img := Image.create(GRID.x, GRID.y, false, Image.FORMAT_R8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for y in GRID.y:
		for x in GRID.x:
			var u := (float(x) + 0.5) / GRID.x - 0.5
			var v := (float(y) + 0.5) / GRID.y - 0.5
			var edge: float = 1.0 - maxf(absf(u) * 2.0, absf(v) * 2.0)
			var blot: float = 0.5 + 0.5 * sin(u * 11.0 + v * 7.0) * cos(v * 13.0 - u * 5.0)
			var m: float = clampf(edge * 0.6 + blot * 0.18 + rng.randf() * 0.22, 0.0, 0.999)
			img.set_pixel(x, y, Color(m, 0, 0))
	_mask_img = img
	return ImageTexture.create_from_image(img)

var _mask_img: Image

func _process(delta: float) -> void:
	if _gone:
		return
	if not _ready_to_play:
		_dots += delta
		_status.text = "The valley is waking" + ".".repeat(1 + int(_dots * 2.0) % 3)
		if _sim != null and _sim._agent_registry.size() > 5:
			_ready_to_play = true
			get_tree().paused = true
			_status.visible = false
			_ticker.visible = false
			_play.visible = true
			_play.grab_focus()
			var tw := create_tween()
			tw.tween_property(_play, "modulate:a", 1.0, 0.5)
			tw.tween_property(_play, "scale", Vector2(1.04, 1.04), 0.9).set_trans(Tween.TRANS_SINE)
			_play.pivot_offset = _play.custom_minimum_size * 0.5

func _unhandled_input(event: InputEvent) -> void:
	if _ready_to_play and not _gone and event.is_action_pressed("ui_accept"):
		get_viewport().set_input_as_handled()
		_blow_away()

func _blow_away() -> void:
	if _gone:
		return
	_gone = true
	_play.disabled = true
	var fade := create_tween()
	fade.tween_property(_play, "modulate:a", 0.0, 0.25)
	if _guide != null:
		# The guide lifts and fades like a page turned toward the valley.
		get_tree().paused = false
		var bgr: ColorRect = _root.get_node("Backdrop")
		_guide.pivot_offset = _guide.size * 0.5
		var gt := create_tween().set_parallel(true)
		gt.tween_property(_guide, "modulate:a", 0.0, 0.7)
		gt.tween_property(_guide, "scale", Vector2(1.04, 1.04), 0.7).set_trans(Tween.TRANS_SINE)
		gt.tween_property(bgr, "color:a", 0.0, 0.7)
		gt.chain().tween_callback(queue_free)
		return
	_spawn_dust()
	get_tree().paused = false
	var bg: ColorRect = _root.get_node("Backdrop")
	var tw := create_tween().set_parallel(true)
	tw.tween_method(_set_t, 0.0, SPAN + LIFE, SPAN + LIFE)
	tw.tween_property(bg, "color:a", 0.0, SPAN * 0.9).set_delay(0.15)
	tw.chain().tween_callback(queue_free)

func _set_t(t: float) -> void:
	(_poster.material as ShaderMaterial).set_shader_parameter("t", t)
	if _dust != null:
		(_dust.material as ShaderMaterial).set_shader_parameter("t", t)

var _dust: MultiMeshInstance2D

func _spawn_dust() -> void:
	var r := _poster_rect()
	var colors: Image = POSTER.get_image()
	if colors.is_compressed():
		colors.decompress()
	colors.resize(GRID.x, GRID.y, Image.INTERPOLATE_BILINEAR)
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_2D
	mm.use_colors = true
	mm.use_custom_data = true
	mm.mesh = quad
	mm.instance_count = GRID.x * GRID.y
	var cell := r.size / Vector2(GRID)
	var rng := RandomNumberGenerator.new()
	var i: int = 0
	for y in GRID.y:
		for x in GRID.x:
			var origin := r.position + (Vector2(x, y) + Vector2(0.5, 0.5)) * cell
			mm.set_instance_transform_2d(i, Transform2D.IDENTITY)
			mm.set_instance_color(i, colors.get_pixel(x, y))
			mm.set_instance_custom_data(i, Color(_mask_img.get_pixel(x, y).r, rng.randf(), origin.x, origin.y))
			i += 1
	_dust = MultiMeshInstance2D.new()
	_dust.multimesh = mm
	var mat := ShaderMaterial.new()
	mat.shader = DUST
	mat.set_shader_parameter("span", SPAN)
	mat.set_shader_parameter("life", LIFE)
	mat.set_shader_parameter("grain", cell.x * 1.3)
	mat.set_shader_parameter("centre", r.position + r.size * 0.5)
	_dust.material = mat
	_root.add_child(_dust)

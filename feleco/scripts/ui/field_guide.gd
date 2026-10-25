class_name FieldGuide
extends Control

# The living infographic. It replaces the baked poster: the food web, the
# year and the day/night rhythm on one screen, with every creature drawn by
# the same jointed rig as in the valley so they trot, graze and flap in
# place. Hover (or tap) a creature for its card; the screen stays sparse
# because the details live in those cards.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const RIG_2D: Shader = preload("res://scripts/visuals/creature_sprite_2d.gdshader")
const DESIGN := Vector2(1280, 720)

# name, colour, role line, tooltip facts.
const INFO: Dictionary = {
	"human": ["Humans", Color(0.88, 0.68, 0.48), "builders & tribes", "Day folk. At night they go home to huts of four; couples in a hut may have a child. Sleeping rough makes them cranky. Hunt rabbits, boars and fish; forage mushrooms and grass seed.", "Builder (huts, timber) · Wizard (rain, magic mushrooms)"],
	"wolf": ["Wolves", Color(0.6, 0.63, 0.68), "night hunters", "Night creatures: faster and hungrier after dark. Hunt sheep, rabbits, boars and fish. Boars fight back.", "Alpha (shares kills) · Moon Howler (rallies the pack)"],
	"falcon": ["Falcons", Color(0.75, 0.54, 0.32), "aerial hunters", "Day hunters that roost at night. Dive on robins, rabbits and fish. Strongest in summer.", "Gyrfalcon (feeds the aerie) · Sky Seer (spots fish)"],
	"robin": ["Robins", Color(0.88, 0.42, 0.3), "songbirds", "Up with the dawn chorus, roosting at night. Eat worms, grass seed and apples. Never fish.", "Mistle Thrush (mobs falcons) · Bluebird (sows seeds)"],
	"fish": ["Fish", Color(0.42, 0.66, 0.86), "river shoal", "Most active at dawn and dusk. Eat worms in the current. Floods spread them out; when the water falls, stranded fish die (the Flood Toll).", "Sturgeon (cleans the riverbed) · Golden Koi (blesses the shoal)"],
	"rabbit": ["Rabbits", Color(0.79, 0.71, 0.56), "fast grazers", "Busiest at dawn and dusk, hidden in deep night. Breed fast, live short.", "Hare (lookout) · Moon Rabbit (healing warrens)"],
	"sheep": ["Sheep", Color(0.93, 0.92, 0.87), "flock grazers", "Graze by day, huddle and doze at night. Lambing peaks in spring.", "Highlander (headbutts hunters) · Golden Fleece (sows grass)"],
	"boar": ["Boars", Color(0.54, 0.38, 0.28), "foragers & brawlers", "Root at night, wallow by day. Eat grass, worms and mushrooms; charge wolves and humans.", "Tusker (gores hunters) · Truffler (feeds the sounder)"],
	"worm": ["Worms", Color(0.85, 0.53, 0.6), "decomposers", "Surface at night and in the rain. Turn rot into rich soil.", "Nightcrawler (tills soil) · Glowworm (lights the tunnels)"],
	"mushroom": ["Mushrooms", Color(0.77, 0.48, 0.84), "autumn & rain", "Fruit at night and glow. Sprout where mycelium is thick, feed on corpses.", ""],
	"grass": ["Grass", Color(0.56, 0.82, 0.54), "the meadow", "Grows fastest in spring and after rain; fed by corpses and the mycelium beneath it.", ""],
	"rot": ["Corpses & rot", Color(0.61, 0.48, 0.35), "every death", "Every body returns: it feeds the grass, the mycelium, worms and mushrooms.", ""],
	"mycelium": ["Mycelium", Color(0.85, 0.81, 0.72), "fungal threads", "The underground network: carries food to the grass and pushes up mushrooms.", ""],
}

# Food web: positions in the web panel (0..1), edges food -> eater.
const NODES: Dictionary = {
	"falcon": Vector2(0.2, 0.15), "human": Vector2(0.5, 0.15), "wolf": Vector2(0.8, 0.15),
	"robin": Vector2(0.1, 0.5), "fish": Vector2(0.3, 0.5), "rabbit": Vector2(0.5, 0.5), "sheep": Vector2(0.7, 0.5), "boar": Vector2(0.9, 0.5),
	"worm": Vector2(0.12, 0.85), "rot": Vector2(0.32, 0.85), "mycelium": Vector2(0.52, 0.85), "grass": Vector2(0.72, 0.85), "mushroom": Vector2(0.9, 0.85),
}
const EDGES: Array = [
	["grass", "sheep", "graze"], ["grass", "rabbit", "graze"], ["grass", "robin", "graze"], ["grass", "boar", "graze"],
	["mushroom", "boar", "forage"], ["mushroom", "human", "forage"], ["worm", "boar", "forage"],
	["rabbit", "falcon", "hunt"], ["robin", "falcon", "hunt"], ["fish", "falcon", "hunt"],
	["sheep", "wolf", "hunt"], ["rabbit", "wolf", "hunt"], ["boar", "wolf", "hunt"], ["fish", "wolf", "hunt"],
	["rabbit", "human", "hunt"], ["boar", "human", "hunt"], ["fish", "human", "hunt"],
	["worm", "robin", "hunt"], ["worm", "fish", "hunt"],
	["rot", "worm", "decay"], ["rot", "mycelium", "decay"], ["rot", "grass", "decay"],
	["mycelium", "grass", "decay"], ["mycelium", "mushroom", "decay"],
]
const EDGE_COLORS: Dictionary = {
	"hunt": Color(0.88, 0.4, 0.35), "graze": Color(0.56, 0.82, 0.54),
	"forage": Color(0.9, 0.75, 0.4), "decay": Color(0.7, 0.58, 0.44),
}
const DAY_SPECIES: Array[String] = ["sheep", "human", "falcon", "robin"]
const TWILIGHT_SPECIES: Array[String] = ["rabbit", "fish"]
const NIGHT_SPECIES: Array[String] = ["wolf", "boar", "worm", "mushroom"]

signal play_pressed

var show_play: bool = false
var _board: Control
var _web: Control
var _node_centers: Dictionary = {}
var _hover_key: String = ""
var _mats: Dictionary = {}
static var _mesh: ArrayMesh

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.color = Color(0.07, 0.1, 0.085)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg)
	_board = Control.new()
	_board.size = DESIGN
	add_child(_board)
	_build()
	resized.connect(_fit)
	_fit.call_deferred()

func _fit() -> void:
	# Hosts that can't anchor us (a CanvasLayer parent) may leave us unsized.
	if size.x <= 0.0 or size.y <= 0.0:
		size = get_viewport_rect().size
	var k: float = minf(size.x / DESIGN.x, size.y / DESIGN.y)
	_board.scale = Vector2(k, k)
	_board.position = ((size - DESIGN * k) * 0.5).floor()

func _panel(rect: Rect2, title: String) -> Control:
	var p := Panel.new()
	p.position = rect.position
	p.size = rect.size
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.13, 0.11, 0.85)
	sb.border_color = Color(0.902, 0.765, 0.416, 0.3)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(18)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_PASS
	_board.add_child(p)
	var t := FelecoUiScript.heading(title.to_upper(), 15, FelecoUiScript.GOLD)
	t.position = Vector2(18, 10)
	t.add_theme_constant_override("outline_size", 0)
	p.add_child(t)
	return p

func _build() -> void:
	var title := FelecoUiScript.heading("FELECO", 54, FelecoUiScript.GOLD)
	title.position = Vector2(36, 14)
	_board.add_child(title)
	var sub := FelecoUiScript.label("The living valley: who eats whom, and when each one wakes.", 17, FelecoUiScript.MIST)
	sub.position = Vector2(40, 80)
	_board.add_child(sub)
	var rule := FelecoUiScript.label("A run is one year in a handful of days, every day a sun and a moon.\nBet on the biggest crowd at the end, and on everything along the way.", 16, FelecoUiScript.CREAM)
	rule.position = Vector2(700, 26)
	rule.size = Vector2(546, 60)
	rule.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_board.add_child(rule)

	# The year: four seasons, each with what peaks in it.
	var year := _panel(Rect2(36, 118, 1208, 92), "A year in one run")
	var seasons: Array = [
		["Spring", Color(0.56, 0.82, 0.54), ["sheep", "robin", "fish"], "lambing · nesting · floods"],
		["Summer", Color(0.95, 0.78, 0.36), ["falcon", "rabbit"], "falcons hunt · rabbits swarm"],
		["Autumn", Color(0.88, 0.53, 0.3), ["boar", "mushroom", "human"], "mast · mushrooms · harvest"],
		["Winter", Color(0.66, 0.8, 0.93), ["wolf"], "packs grow bold"],
	]
	for i: int in seasons.size():
		var s: Array = seasons[i]
		var x: float = 18.0 + i * 297.0
		var band := ColorRect.new()
		band.color = Color(s[1].r, s[1].g, s[1].b, 0.22)
		band.position = Vector2(x, 36)
		band.size = Vector2(289, 46)
		band.mouse_filter = Control.MOUSE_FILTER_IGNORE
		year.add_child(band)
		var top := ColorRect.new()
		top.color = s[1]
		top.position = Vector2(x, 36)
		top.size = Vector2(289, 3)
		top.mouse_filter = Control.MOUSE_FILTER_IGNORE
		year.add_child(top)
		var name := FelecoUiScript.heading(s[0], 17, s[1])
		name.position = Vector2(x + 10, 42)
		year.add_child(name)
		var note := FelecoUiScript.label(s[3], 13, FelecoUiScript.MIST)
		note.position = Vector2(x + 10, 62)
		year.add_child(note)
		var sx: float = x + 283.0
		for sp: String in s[2]:
			sx -= 34.0
			_creature(year, sp, Vector2(sx, 60), 30.0)

	# The food web.
	_web = _panel(Rect2(36, 222, 800, 470), "Food web")
	var legend := HBoxContainer.new()
	legend.position = Vector2(470, 8)
	legend.add_theme_constant_override("separation", 14)
	_web.add_child(legend)
	for k: String in ["hunt", "graze", "forage", "decay"]:
		var l := FelecoUiScript.label("—  %s" % k, 13, EDGE_COLORS[k])
		legend.add_child(l)
	var area := Rect2(40, 40, 720, 400)
	for key: String in NODES.keys():
		var c: Vector2 = area.position + NODES[key] * area.size
		_node_centers[key] = c
		_web_node(key, c)
	_web.draw.connect(_draw_web)

	# Day and night.
	var dn := _panel(Rect2(852, 222, 392, 470), "Sun and moon")
	var line := FelecoUiScript.label("Each day is a minute of sun and moon at the standard 2x.", 13, FelecoUiScript.MIST)
	line.position = Vector2(18, 34)
	line.size = Vector2(356, 20)
	line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dn.add_child(line)
	_dn_row(dn, "BY DAY", "graze, build, soar; sleep at night", DAY_SPECIES, 70, Color(0.95, 0.85, 0.5))
	_dn_row(dn, "AT DAWN AND DUSK", "busiest in the half-light", TWILIGHT_SPECIES, 196, Color(0.9, 0.62, 0.45))
	_dn_row(dn, "BY NIGHT", "hunt, root and fruit in the dark", NIGHT_SPECIES, 322, Color(0.62, 0.7, 0.95))

	if show_play:
		var play := Button.new()
		play.text = "Enter the valley"
		play.theme_type_variation = "PrimaryButton"
		play.add_theme_font_override("font", FelecoUiScript.font("heading"))
		play.add_theme_font_size_override("font_size", 22)
		play.size = Vector2(280, 56)
		play.position = Vector2(DESIGN.x - 316, DESIGN.y - 2)
		play.pressed.connect(func() -> void: play_pressed.emit())
		_board.add_child(play)
	FelecoUiScript.dress_hud(self)

func _dn_row(parent: Control, title: String, note: String, species: Array[String], y: float, col: Color) -> void:
	var t := FelecoUiScript.heading(title, 15, col)
	t.position = Vector2(18, y)
	parent.add_child(t)
	var n := FelecoUiScript.label(note, 13, FelecoUiScript.MIST)
	n.position = Vector2(18, y + 20)
	parent.add_child(n)
	for i: int in species.size():
		_creature(parent, species[i], Vector2(56 + i * 88, y + 84), 60.0)

# A creature on screen: the 2D rig mesh plus an invisible hover target.
func _creature(parent: Control, species: String, center: Vector2, height: float) -> void:
	var holder := Hover.new()
	holder.guide = self
	holder.species = species
	holder.position = center - Vector2(height, height) * 0.5
	holder.size = Vector2(height, height)
	holder.mouse_filter = Control.MOUSE_FILTER_STOP
	holder.tooltip_text = species
	holder.set_meta("species", species)
	parent.add_child(holder)
	var key: String = "%s@%d" % [species, holder.get_instance_id()]
	if SpriteGenerator.SPECIES.has(species):
		var mi := MeshInstance2D.new()
		mi.mesh = _grid_mesh()
		var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(species, {"size": Vector2(2, 2), "gait": 8.0, "style": 0})
		var q: Vector2 = cfg["size"]
		var mat := ShaderMaterial.new()
		mat.shader = RIG_2D
		var tex: Texture2D = SpriteGenerator.texture_for(species)
		mat.set_shader_parameter("sprite", tex)
		mat.set_shader_parameter("quad", q)
		mat.set_shader_parameter("style", int(cfg["style"]))
		mat.set_shader_parameter("atlas_cell", 1.0 if species == "mushroom" else 0.0)
		mat.set_shader_parameter("creature_seed", randf() * 20.0)
		mat.set_shader_parameter("face_dir", 1.0 if randf() < 0.6 else -1.0)
		mat.set_shader_parameter("motion", 0.5 + randf() * 0.5)
		mat.set_shader_parameter("gait", float(cfg["gait"]) * 0.5)
		mat.set_shader_parameter("px", height / maxf(q.x, q.y))
		mat.set_shader_parameter("texel", Vector2(1.0 / tex.get_width(), 1.0 / tex.get_height()))
		mat.set_shader_parameter("grid", Vector2(SpriteGenerator.COLS, SpriteGenerator.ROWS))
		mi.material = mat
		mi.position = Vector2(height, height) * 0.5
		holder.add_child(mi)
		_mats[key] = mat
	else:
		if species == "rot":
			var rot := RotIcon.new()
			rot.set_anchors_preset(Control.PRESET_FULL_RECT)
			rot.mouse_filter = Control.MOUSE_FILTER_IGNORE
			holder.add_child(rot)
			holder.mouse_entered.connect(func() -> void: _set_hover(key, species, true))
			holder.mouse_exited.connect(func() -> void: _set_hover(key, species, false))
			return
		var tr := TextureRect.new()
		match species:
			"grass": tr.texture = load(SpriteGenerator.SPRITE_DIR + "tuft.png")
			_: tr.texture = load(SpriteGenerator.SPRITE_DIR + "mycelium.png")
		tr.set_anchors_preset(Control.PRESET_FULL_RECT)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		holder.add_child(tr)
	holder.mouse_entered.connect(func() -> void: _set_hover(key, species, true))
	holder.mouse_exited.connect(func() -> void: _set_hover(key, species, false))

func _web_node(key: String, c: Vector2) -> void:
	var disc := Panel.new()
	var info: Array = INFO[key]
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 1, 1, 0.05)
	sb.border_color = info[1]
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(40)
	sb.shadow_color = Color(info[1].r, info[1].g, info[1].b, 0.35)
	sb.shadow_size = 8
	disc.add_theme_stylebox_override("panel", sb)
	disc.position = c - Vector2(40, 40)
	disc.size = Vector2(80, 80)
	disc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_web.add_child(disc)
	_creature(_web, key, c, 64.0)
	var n := FelecoUiScript.heading(info[0], 15, FelecoUiScript.CREAM)
	n.position = c + Vector2(-60, 42)
	n.size = Vector2(120, 20)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_web.add_child(n)
	var r := FelecoUiScript.label(info[2], 12, FelecoUiScript.MIST)
	r.position = c + Vector2(-70, 60)
	r.size = Vector2(140, 16)
	r.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_web.add_child(r)

func _set_hover(key: String, species: String, on: bool) -> void:
	_hover_key = species if on else ""
	if _mats.has(key):
		(_mats[key] as ShaderMaterial).set_shader_parameter("hover", 1.0 if on else 0.0)
	_web.queue_redraw()

func _draw_web() -> void:
	# Arrows from food to eater; the hovered creature's links light up.
	for e: Array in EDGES:
		var a: Vector2 = _node_centers[e[0]]
		var b: Vector2 = _node_centers[e[1]]
		var col: Color = EDGE_COLORS[e[2]]
		var lit: bool = _hover_key.is_empty() or _hover_key == e[0] or _hover_key == e[1]
		col.a = 0.8 if lit and not _hover_key.is_empty() else (0.45 if lit else 0.08)
		var dir: Vector2 = (b - a).normalized()
		var p0: Vector2 = a + dir * 44.0
		var p1: Vector2 = b - dir * 46.0
		var mid: Vector2 = (p0 + p1) * 0.5 + Vector2(-dir.y, dir.x) * 18.0
		var pts := PackedVector2Array()
		for i: int in 17:
			var t: float = i / 16.0
			pts.append(p0.lerp(mid, t).lerp(mid.lerp(p1, t), t))
		_web.draw_polyline(pts, col, 2.5 if lit and not _hover_key.is_empty() else 1.6, true)
		var tip: Vector2 = pts[pts.size() - 1]
		var back: Vector2 = (pts[pts.size() - 1] - pts[pts.size() - 3]).normalized()
		var side := Vector2(-back.y, back.x)
		_web.draw_colored_polygon(PackedVector2Array([tip, tip - back * 10.0 + side * 5.0, tip - back * 10.0 - side * 5.0]), col)

# A creature card when hovering (Godot calls this on the hover target).
func _make_card(species: String) -> Control:
	var info: Array = INFO.get(species, [species, Color.WHITE, "", "", ""])
	var panel := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.1, 0.08, 0.97)
	sb.border_color = info[1]
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 12)
	panel.add_theme_stylebox_override("panel", sb)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	panel.add_child(col)
	col.add_child(FelecoUiScript.heading(info[0], 19, FelecoUiScript.GOLD))
	var eats: PackedStringArray = []
	var eaten: PackedStringArray = []
	for e: Array in EDGES:
		if e[1] == species:
			eats.append(String(INFO[e[0]][0]).to_lower())
		if e[0] == species:
			eaten.append(String(INFO[e[1]][0]).to_lower())
	var body := FelecoUiScript.label(info[3], 14, FelecoUiScript.CREAM)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(320, 0)
	col.add_child(body)
	if not eats.is_empty():
		col.add_child(FelecoUiScript.label("Eats: " + ", ".join(eats), 13, EDGE_COLORS["graze"]))
	if not eaten.is_empty():
		col.add_child(FelecoUiScript.label("Feeds: " + ", ".join(eaten), 13, EDGE_COLORS["hunt"]))
	if Clock.LIFESPAN_DAYS.has(species):
		col.add_child(FelecoUiScript.label("Lives about %s days" % String.num(Clock.LIFESPAN_DAYS[species], 1), 13, FelecoUiScript.MIST))
	if not String(info[4]).is_empty():
		var kinds := FelecoUiScript.label("Rare kinds: " + info[4], 13, FelecoUiScript.MIST)
		kinds.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		kinds.custom_minimum_size = Vector2(320, 0)
		col.add_child(kinds)
	return panel

# 12x12 grid in quad units (+y up), shared by every creature on the guide.
static func _grid_mesh() -> ArrayMesh:
	if _mesh != null:
		return _mesh
	var n: int = 12
	var verts := PackedVector2Array()
	var uvs := PackedVector2Array()
	var idx := PackedInt32Array()
	for j: int in n + 1:
		for i: int in n + 1:
			var u: float = float(i) / n
			var v: float = float(j) / n
			# The shader scales by the real quad size; here it is a unit quad
			# centred on the origin, so the rig sees -0.5..0.5 times quad.
			verts.append(Vector2(u - 0.5, 0.5 - v))
			uvs.append(Vector2(u, v))
	for j: int in n:
		for i: int in n:
			var a: int = j * (n + 1) + i
			idx.append_array([a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1])
	var arr: Array = []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = idx
	_mesh = ArrayMesh.new()
	_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return _mesh

# A creature's hover target: shows its card as the tooltip.
class Hover extends Control:
	var guide: FieldGuide
	var species: String = ""

	func _make_custom_tooltip(_for_text: String) -> Object:
		return guide._make_card(species)

# Corpses & rot: a mound of dark soil with old bones, a cap pushing up out of
# it, and two flies doing slow loops above. Drawn, so it animates.
class RotIcon extends Control:
	func _process(_delta: float) -> void:
		queue_redraw()

	func _draw() -> void:
		var w: float = size.x
		var h: float = size.y
		var base := Vector2(w * 0.5, h * 0.78)
		# Soil mound.
		var mound := PackedVector2Array()
		for i: int in 17:
			var a: float = PI + PI * i / 16.0
			mound.append(base + Vector2(cos(a) * w * 0.38, sin(a) * h * 0.2))
		draw_colored_polygon(mound, Color(0.33, 0.22, 0.14))
		draw_polyline(mound, Color(0.45, 0.32, 0.2), 2.0, true)
		# Crossed bones.
		var bone := Color(0.93, 0.9, 0.82)
		for s: float in [-1.0, 1.0]:
			var a := base + Vector2(-w * 0.2 * s, -h * 0.03)
			var b := base + Vector2(w * 0.16 * s, -h * 0.14)
			draw_line(a, b, bone, 3.5, true)
			draw_circle(a, 3.2, bone)
			draw_circle(b, 3.2, bone)
		# A mushroom pushing up.
		var stem := base + Vector2(w * 0.2, -h * 0.12)
		draw_rect(Rect2(stem - Vector2(2.5, 10), Vector2(5, 12)), Color(0.95, 0.92, 0.85))
		draw_circle(stem - Vector2(0, 11), 7.5, Color(0.85, 0.2, 0.18))
		draw_circle(stem + Vector2(-2.5, -13), 1.6, Color(1, 1, 1))
		draw_circle(stem + Vector2(2.5, -11), 1.3, Color(1, 1, 1))
		# Flies.
		var t: float = Time.get_ticks_msec() * 0.001
		for k: int in 2:
			var ph: float = t * (2.2 + k * 0.7) + k * 2.0
			var c := base + Vector2(cos(ph) * w * 0.18 - w * 0.05, -h * 0.42 + sin(ph * 1.7) * h * 0.08)
			draw_circle(c, 2.2, Color(0.12, 0.12, 0.12))
			draw_circle(c + Vector2(-2, -2), 1.6, Color(0.85, 0.9, 1.0, 0.6))

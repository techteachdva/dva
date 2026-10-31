class_name FieldGuide
extends Control

# The living infographic. It replaces the baked poster: the year and the
# food web on one screen, with every creature drawn by the same jointed rig
# as in the valley so they trot, graze and flap in place. The web starts
# zoomed out; click a creature and it zooms in on it and opens its card:
# what it eats, what eats it, when it is about, its season and its kinds.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const RIG_2D: Shader = preload("res://scripts/visuals/creature_sprite_2d.gdshader")
const DESIGN := Vector2(1280, 720)

# name, colour, role line, tooltip facts.
const INFO: Dictionary = {
	"human": ["Humans", Color(0.88, 0.68, 0.48), "cooks & tribes", "The widest diet: they cook fruit, fish, riverweed, mice, beetles, worms and big game at a hearth, then store it in the hut. They never eat kin, corpses, mycelium or moss. A mouse is quick; a bear takes most of a day. Wolves, bears and mountain lions can still kill a villager caught alone. Three together can drive a lion or a bear off. They never sleep in the river or its flood.", "Builder (huts, timber) · Wizard (rain, magic mushrooms)"],
	"wolf": ["Wolves", Color(0.6, 0.63, 0.68), "night hunters", "Night creatures: faster and hungrier after dark. They hunt sheep, rabbits, deer, goats, boars, mice and fish, and robins on the ground. When the hunt fails they scavenge carcasses and worms. Boars fight back. A villager indoors is safe.", "Alpha (shares kills) · Moon Howler (rallies the pack)"],
	"falcon": ["Falcons", Color(0.75, 0.54, 0.32), "aerial hunters", "Day hunters that roost at night. Each holds its own patch of sky. They dive on mice, rabbits, robins, beetles and worms, and stoop on fish. Strongest in summer. They nest in grown trees: fell the woods and the falcons dwindle.", "Gyrfalcon (feeds the aerie) · Sky Seer (spots fish)"],
	"robin": ["Robins", Color(0.88, 0.42, 0.3), "songbirds", "Up with the dawn chorus, roosting at night. They eat worms, berries, apples, mushrooms and grass. A hungry robin will try for a fish in the shallows, and usually miss. Falcons take them in the air. Wolves take them on the ground.", "Mistle Thrush (mobs falcons) · Bluebird (sows seeds)"],
	"fish": ["Fish", Color(0.42, 0.66, 0.86), "river shoal", "Most active at dawn and dusk. They eat worms, beetles and riverweed. Fruit that falls in the water is fair game, and a flood lets them nibble the mycelium. When the water falls, stranded fish die (the Flood Toll).", "Sturgeon (cleans the riverbed) · Golden Koi (blesses the shoal)"],
	"rabbit": ["Rabbits", Color(0.79, 0.71, 0.56), "fast grazers", "Busiest at dawn and dusk, hidden in deep night. Breed fast, live short.", "Hare (lookout) · Moon Rabbit (healing warrens)"],
	"sheep": ["Sheep", Color(0.93, 0.92, 0.87), "flock grazers", "Graze by day, huddle and doze at night. Lambing peaks in spring.", "Highlander (headbutts hunters) · Golden Fleece (sows grass)"],
	"boar": ["Boars", Color(0.54, 0.38, 0.28), "foragers & brawlers", "Root at night, wallow by day. Eat grass, worms and mushrooms; charge wolves and humans.", "Tusker (gores hunters) · Truffler (feeds the sounder)"],
	"worm": ["Worms", Color(0.85, 0.53, 0.6), "decomposers", "Surface at night and in the rain. Turn rot into rich soil.", "Nightcrawler (tills soil) · Glowworm (lights the tunnels)"],
	"mushroom": ["Mushrooms", Color(0.77, 0.48, 0.84), "autumn & rain", "Fruit at night and glow. Sprout where mycelium is thick, feed on corpses.", ""],
	"grass": ["Grass", Color(0.56, 0.82, 0.54), "the meadow", "Grows fastest in spring and after rain; fed by corpses and the mycelium beneath it.", ""],
	"rot": ["Corpses & rot", Color(0.61, 0.48, 0.35), "every death", "Every body returns. Worms, beetles and mushrooms take it apart. Hungry wolves, lions and bears scavenge the meat. What is left feeds the grass.", ""],
	"mycelium": ["Mycelium", Color(0.85, 0.81, 0.72), "fungal threads", "The underground network: carries food to the grass and pushes up mushrooms.", ""],
	"deer": ["Deer", Color(0.72, 0.5, 0.32), "wary browsers", "Herbivores. Graze, strip moss from the trees and raid berry bushes. Quick to bolt from lions, wolves and bears.", "Twelve-point (great rack) · White Hart (pale and rare)"],
	"goat": ["Mountain Goats", Color(0.9, 0.88, 0.82), "crag climbers", "Herbivores. Come down from the passes; hardy in the cold, they live on tough grass and moss.", "Old Billy (bearded) · Crag Climber (golden horns)"],
	"bear": ["Bears", Color(0.46, 0.3, 0.2), "big omnivores", "Omnivores, second only to humans. Fish, fruit, pinecones, riverweed, grass, mushrooms, corpses, rabbits and mice. They do not cook, and a lone villager is not safe from them. Sleep through winter.", "Grizzled (silver hump) · Moon Bear (pale crescent)"],
	"lion": ["Mountain Lions", Color(0.82, 0.62, 0.38), "lone ambushers", "Carnivores. Mice are the staple, then rabbits, deer, goats, sheep and robins. They take fish and scavenge carcasses. A lone villager is prey; three together are not. Wary of bears.", "Ghost Cat (pale) · Sun Cat (golden)"],
	"mouse": ["Mice", Color(0.62, 0.56, 0.5), "everywhere", "Omnivores. In every biome, day and night (busiest at night). They hunt beetles and worms, and nibble apples, berries, pinecones and pineapples. Lions, bears, falcons, wolves and villagers eat them.", "Dormouse (plump) · Snow Mouse (white)"],
	"pineapple": ["Pineapples", Color(0.86, 0.62, 0.16), "the strange fruit", "Producers. Never planted at the start: when a pinecone and an apple rot side by side, the seedlings can fuse into a pineapple tree (the first only on the plains). The richest food in the valley. Anyone who eats apples will eat one, and its seeds spread.", ""],
	"pinecone": ["Pinecones", Color(0.55, 0.38, 0.22), "mountain seeds", "Producers. Conifers on the mountain drop them. Boars, bears, goats, mice and villagers eat them.", ""],
	"beetle": ["Beetles", Color(0.3, 0.45, 0.35), "carrion beetles", "Decomposers. They strip the last scraps from carcasses and work rot into the soil. Mice, falcons, fish and villagers eat them.", "Stag (big jaws) · Scarab (golden shell)"],
	"berry": ["Berry bushes", Color(0.55, 0.3, 0.6), "low and tangled", "Producers. Small, branchy bushes heavy with berries; now and then a golden one.", ""],
	"moss": ["Moss", Color(0.36, 0.6, 0.3), "on the bark", "Producers. Creeps up the trees in spring, autumn and rain; shrivels in drought. Herbivores eat it. Humans do not, even cooked.", ""],
	"riverweed": ["Riverweed", Color(0.28, 0.62, 0.4), "kelp of the river", "Producers. Tangles of vine in the channel, like freshwater kelp. Fish, goats, deer and sheep graze it raw. Humans cook it.", ""],
	"apple": ["Apple trees", Color(0.85, 0.25, 0.2), "the orchard", "Producers. Apples drop when ripe and seed new trees. One in fifty is golden.", ""],
	"gold": ["Gold", Color(1.0, 0.82, 0.3), "follow the energy", "Eat a golden plant and you turn Gold for a day: nothing can hurt you until the gold is claimed. Click that creature to take the gold and start a rampage. Miss the moment and the gold hides inside, and passes to whoever eats them next, all the way back into the soil.", ""],
}

# Food web: positions in the web (0..1), edges food -> eater.
# 3.0: one row per link of the food web, hunters on top, soil at the bottom.
const NODES: Dictionary = {
	"falcon": Vector2(0.2, 0.08), "lion": Vector2(0.5, 0.08), "wolf": Vector2(0.8, 0.08),
	"human": Vector2(0.1, 0.3), "bear": Vector2(0.3, 0.3), "boar": Vector2(0.5, 0.3), "robin": Vector2(0.7, 0.3), "mouse": Vector2(0.9, 0.3),
	"rabbit": Vector2(0.1, 0.52), "deer": Vector2(0.3, 0.52), "goat": Vector2(0.5, 0.52), "sheep": Vector2(0.7, 0.52), "fish": Vector2(0.9, 0.52),
	"grass": Vector2(0.04, 0.73), "riverweed": Vector2(0.19, 0.73), "berry": Vector2(0.34, 0.73), "moss": Vector2(0.49, 0.73), "apple": Vector2(0.64, 0.73), "pineapple": Vector2(0.79, 0.73), "pinecone": Vector2(0.94, 0.73),
	"worm": Vector2(0.1, 0.93), "beetle": Vector2(0.3, 0.93), "mushroom": Vector2(0.5, 0.93), "rot": Vector2(0.7, 0.93), "mycelium": Vector2(0.9, 0.93),
}
const EDGES: Array = [
	["grass", "sheep", "graze"], ["grass", "rabbit", "graze"], ["grass", "deer", "graze"], ["grass", "goat", "graze"], ["grass", "boar", "graze"],
	["grass", "robin", "graze"], ["grass", "bear", "graze"], ["grass", "human", "forage"],
	["moss", "deer", "graze"], ["moss", "goat", "graze"], ["moss", "rabbit", "graze"], ["moss", "sheep", "graze"], ["moss", "boar", "graze"],
	["berry", "deer", "forage"], ["berry", "bear", "forage"], ["berry", "goat", "forage"], ["berry", "sheep", "forage"], ["berry", "rabbit", "forage"],
	["berry", "boar", "forage"], ["berry", "robin", "forage"], ["berry", "fish", "forage"], ["berry", "human", "forage"],
	["apple", "sheep", "forage"], ["apple", "bear", "forage"], ["apple", "boar", "forage"], ["apple", "robin", "forage"],
	["apple", "deer", "forage"], ["apple", "goat", "forage"], ["apple", "rabbit", "forage"], ["apple", "fish", "forage"], ["apple", "human", "forage"],
	["pineapple", "sheep", "forage"], ["pineapple", "bear", "forage"], ["pineapple", "boar", "forage"], ["pineapple", "robin", "forage"],
	["pineapple", "deer", "forage"], ["pineapple", "goat", "forage"], ["pineapple", "rabbit", "forage"], ["pineapple", "fish", "forage"],
	["pineapple", "mouse", "forage"], ["pineapple", "human", "forage"],
	["mushroom", "bear", "forage"], ["mushroom", "boar", "forage"], ["mushroom", "human", "forage"], ["mushroom", "sheep", "forage"], ["mushroom", "robin", "forage"],
	["rabbit", "falcon", "hunt"], ["robin", "falcon", "hunt"], ["fish", "falcon", "hunt"], ["beetle", "falcon", "hunt"], ["worm", "falcon", "hunt"],
	["sheep", "wolf", "hunt"], ["rabbit", "wolf", "hunt"], ["deer", "wolf", "hunt"], ["goat", "wolf", "hunt"], ["boar", "wolf", "hunt"],
	["fish", "wolf", "hunt"], ["robin", "wolf", "hunt"], ["worm", "wolf", "hunt"], ["human", "wolf", "hunt"],
	["deer", "lion", "hunt"], ["goat", "lion", "hunt"], ["sheep", "lion", "hunt"], ["rabbit", "lion", "hunt"], ["robin", "lion", "hunt"],
	["fish", "lion", "hunt"], ["human", "lion", "hunt"],
	["fish", "bear", "hunt"], ["rabbit", "bear", "hunt"], ["human", "bear", "hunt"],
	["rabbit", "boar", "hunt"], ["fish", "boar", "hunt"], ["fish", "robin", "hunt"], ["worm", "boar", "hunt"],
	["fish", "human", "hunt"], ["deer", "human", "hunt"], ["goat", "human", "hunt"], ["boar", "human", "hunt"],
	["lion", "human", "hunt"], ["bear", "human", "hunt"],
	["mouse", "human", "hunt"], ["beetle", "human", "hunt"], ["worm", "human", "hunt"],
	["rabbit", "human", "hunt"], ["sheep", "human", "hunt"], ["robin", "human", "hunt"],
	["worm", "fish", "hunt"], ["beetle", "fish", "hunt"], ["worm", "robin", "hunt"],
	["rot", "worm", "decay"], ["rot", "beetle", "decay"], ["rot", "mycelium", "decay"], ["rot", "grass", "decay"],
	["rot", "wolf", "decay"], ["rot", "lion", "decay"], ["rot", "bear", "decay"],
	["mycelium", "grass", "decay"], ["mycelium", "mushroom", "decay"], ["mycelium", "fish", "decay"],
	["beetle", "mouse", "hunt"], ["worm", "mouse", "hunt"], ["apple", "mouse", "forage"], ["berry", "mouse", "forage"], ["pinecone", "mouse", "forage"],
	["mouse", "lion", "hunt"], ["mouse", "bear", "hunt"], ["mouse", "falcon", "hunt"], ["mouse", "wolf", "hunt"],
	["pinecone", "boar", "forage"], ["pinecone", "bear", "forage"], ["pinecone", "goat", "forage"], ["pinecone", "human", "forage"],
	["riverweed", "fish", "graze"], ["riverweed", "goat", "graze"], ["riverweed", "deer", "graze"], ["riverweed", "sheep", "graze"], ["riverweed", "bear", "forage"], ["riverweed", "human", "forage"],
]
const EDGE_COLORS: Dictionary = {
	"hunt": Color(0.88, 0.4, 0.35), "graze": Color(0.56, 0.82, 0.54),
	"forage": Color(0.9, 0.75, 0.4), "decay": Color(0.7, 0.58, 0.44),
}
const DAY_SPECIES: Array[String] = ["sheep", "goat", "human", "falcon", "robin"]
const TWILIGHT_SPECIES: Array[String] = ["rabbit", "deer", "bear", "fish"]
const NIGHT_SPECIES: Array[String] = ["wolf", "lion", "boar", "worm", "beetle", "mushroom", "mouse"]

# Each creature's prime season and what it does then (the 3.0 creatures'
# breeding peaks come from SpeciesDB). Plants count too.
const PRIME: Dictionary = {
	"sheep": [0, "lambing"], "robin": [0, "nesting"], "fish": [0, "floods spread the shoal"],
	"deer": [0, "fawns"], "bear": [0, "cubs leave the den"], "lion": [0, "cubs"], "grass": [0, "the spring flush"],
	"falcon": [1, "hunt hardest"], "rabbit": [1, "swarm"], "beetle": [1, "grubs hatch"], "berry": [1, "fruit"],
	"boar": [2, "fatten on mast"], "mushroom": [2, "fruit after rain"], "human": [2, "harvest"],
	"worm": [2, "surface in the rains"], "apple": [2, "apples drop"], "moss": [3, "thickest on the winter bark"],
	"wolf": [3, "packs grow bold"], "goat": [3, "hardy in the cold"],
}
const SEASONS: Array = [
	["Spring", Color(0.56, 0.82, 0.54)], ["Summer", Color(0.95, 0.78, 0.36)],
	["Autumn", Color(0.88, 0.53, 0.3)], ["Winter", Color(0.66, 0.8, 0.93)],
]

# The web is drawn in rows, one per link of the food web (see NODES).
const WEB_AREA := Rect2(170, 50, 990, 410)
const WEB_ROWS: Array = [
	[0.08, "carnivore", "Carnivores"], [0.30, "omnivore", "Omnivores"], [0.52, "herbivore", "Herbivores"],
	[0.73, "producer", "Producers"], [0.93, "decomposer", "Decomposers"],
]
# Zoomed in, the chosen creature sits here (web-panel space) at this scale.
const ZOOM_SCALE: float = 1.7
const ZOOM_SPOT := Vector2(250, 260)

signal play_pressed

var show_play: bool = false
var _board: Control
var _web: Control
# The web itself (rows, arrows, creatures) lives in here so it can zoom.
var _content: Control
var _node_centers: Dictionary = {}
var _node_parts: Dictionary = {}
var _hover_key: String = ""
var _mats: Dictionary = {}
var _footer: HBoxContainer
# The creature the web is zoomed in on ("" = the whole web), and the one the
# zoom is anchored on while it eases back out.
var _focus: String = ""
var _anchor: String = ""
var _zoom: float = 0.0
var _zoom_tween: Tween
var _card: Control
var _hint: Label
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

# Buttons the host adds (Close, Tuning Lab) sit in the footer row, clear of the web.
func add_footer(btn: Control) -> void:
	_footer.add_child(btn)

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
	t.position = Vector2(18, 8)
	t.add_theme_constant_override("outline_size", 0)
	p.add_child(t)
	return p

func _build() -> void:
	# A thin title line, so the pictures get the room.
	var title := FelecoUiScript.heading("FELECO", 30, FelecoUiScript.GOLD)
	title.position = Vector2(36, 6)
	_board.add_child(title)
	var sub := FelecoUiScript.label("The living valley. A run is one year in a few days: bet on which link of the food web ends it fullest.", 15, FelecoUiScript.MIST)
	sub.position = Vector2(184, 16)
	sub.size = Vector2(1060, 22)
	sub.clip_text = true
	_board.add_child(sub)

	# The year: every creature in the season it comes into its own.
	var year := _panel(Rect2(36, 50, 1208, 106), "A year in one run")
	for i: int in SEASONS.size():
		var x: float = 14.0 + i * 297.0
		var col: Color = SEASONS[i][1]
		var band := ColorRect.new()
		band.color = Color(col.r, col.g, col.b, 0.16)
		band.position = Vector2(x, 32)
		band.size = Vector2(288, 66)
		band.mouse_filter = Control.MOUSE_FILTER_IGNORE
		year.add_child(band)
		var top := ColorRect.new()
		top.color = col
		top.position = Vector2(x, 32)
		top.size = Vector2(288, 3)
		top.mouse_filter = Control.MOUSE_FILTER_IGNORE
		year.add_child(top)
		var name := FelecoUiScript.heading(SEASONS[i][0], 15, col)
		name.position = Vector2(x + 8, 36)
		year.add_child(name)
		var members: Array = []
		for sp: String in PRIME.keys():
			if int(PRIME[sp][0]) == i:
				members.append(sp)
		var step: float = minf(44.0, 262.0 / maxf(1.0, members.size()))
		for k: int in members.size():
			_creature(year, members[k], Vector2(x + 26.0 + k * step, 76), 38.0)

	# The food web: the whole valley at a glance; click a creature to zoom in.
	_web = _panel(Rect2(36, 164, 1208, 494), "Food web")
	_web.clip_contents = true
	_content = Control.new()
	_content.size = _web.size
	_content.mouse_filter = Control.MOUSE_FILTER_PASS
	_content.gui_input.connect(_on_web_input)
	_web.add_child(_content)
	_web.move_child(_content, 0)
	# The title row stays clear of the zoomed web.
	var cap := Panel.new()
	var csb := StyleBoxFlat.new()
	csb.bg_color = Color(0.087, 0.125, 0.106)
	csb.corner_radius_top_left = 17
	csb.corner_radius_top_right = 17
	cap.add_theme_stylebox_override("panel", csb)
	cap.position = Vector2(1, 1)
	cap.size = Vector2(_web.size.x - 2, 32)
	cap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_web.add_child(cap)
	_web.move_child(cap, 1)
	var legend := HBoxContainer.new()
	legend.position = Vector2(540, 6)
	legend.size = Vector2(650, 20)
	legend.alignment = BoxContainer.ALIGNMENT_END
	legend.add_theme_constant_override("separation", 14)
	legend.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_web.add_child(legend)
	_hint = FelecoUiScript.label("Click a creature to zoom in on its rules.", 13, FelecoUiScript.MIST)
	legend.add_child(_hint)
	for k: String in ["hunt", "graze", "forage", "decay"]:
		legend.add_child(FelecoUiScript.label("—  %s" % k, 13, EDGE_COLORS[k]))
	for key: String in NODES.keys():
		var c: Vector2 = WEB_AREA.position + NODES[key] * WEB_AREA.size
		_node_centers[key] = c
		_web_node(key, c)
	_content.draw.connect(_draw_web)

	_footer = HBoxContainer.new()
	_footer.alignment = BoxContainer.ALIGNMENT_END
	_footer.add_theme_constant_override("separation", 14)
	_footer.position = Vector2(36, 664)
	_footer.size = Vector2(1208, 52)
	_board.add_child(_footer)
	var note := FelecoUiScript.label("Every day is a sun and a moon: each creature's card shows when it is about.", 13, FelecoUiScript.MIST)
	note.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	note.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_footer.add_child(note)

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

func _unhandled_input(event: InputEvent) -> void:
	if not _focus.is_empty() and event.is_action_pressed("ui_cancel"):
		focus_species("")
		get_viewport().set_input_as_handled()

func _on_web_input(event: InputEvent) -> void:
	# A click on the open web (not on a creature) zooms back out.
	var mb := event as InputEventMouseButton
	if mb != null and mb.pressed and not _focus.is_empty() and (mb.button_index == MOUSE_BUTTON_LEFT or mb.button_index == MOUSE_BUTTON_RIGHT):
		focus_species("")

# Zoom the web onto one creature and open its card ("" zooms back out).
func focus_species(species: String) -> void:
	if species == _focus or (not species.is_empty() and not NODES.has(species)):
		return
	_focus = species
	_hover_key = ""
	if _card != null:
		var old := _card
		var t := old.create_tween()
		t.tween_property(old, "modulate:a", 0.0, 0.15)
		t.tween_callback(old.queue_free)
		_card = null
	var zoom_to: float = 0.0
	if not species.is_empty():
		zoom_to = 1.0
		# Hopping straight from one creature to another: re-anchor smoothly.
		if not _anchor.is_empty() and _anchor != species and _zoom > 0.0:
			var from := _content.position
			var from_s: float = _content.scale.x
			_anchor = species
			_zoom_tween = create_tween()
			var dest: Vector2 = ZOOM_SPOT - (_node_centers[species] as Vector2) * ZOOM_SCALE
			_zoom_tween.set_parallel()
			_zoom_tween.tween_property(_content, "position", dest, 0.4).from(from).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
			_zoom_tween.tween_property(_content, "scale", Vector2(ZOOM_SCALE, ZOOM_SCALE), 0.4).from(Vector2(from_s, from_s))
			_zoom = 1.0
			zoom_to = -1.0
		else:
			_anchor = species
		_card = _detail_card(species)
		_card.modulate.a = 0.0
		var x: float = _card.position.x
		_card.position.x = x + 40.0
		var ct := _card.create_tween().set_parallel()
		ct.tween_property(_card, "modulate:a", 1.0, 0.3).set_delay(0.12)
		ct.tween_property(_card, "position:x", x, 0.35).set_delay(0.12).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	_hint.text = "Click the open web or press Esc to zoom out." if not species.is_empty() else "Click a creature to zoom in on its rules."
	if zoom_to >= 0.0:
		if _zoom_tween != null:
			_zoom_tween.kill()
		_zoom_tween = create_tween()
		_zoom_tween.tween_method(_apply_zoom, _zoom, zoom_to, 0.45).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_fade_nodes()
	_content.queue_redraw()

func _apply_zoom(z: float) -> void:
	_zoom = z
	if _anchor.is_empty():
		return
	var s: float = lerpf(1.0, ZOOM_SCALE, z)
	var c: Vector2 = _node_centers[_anchor]
	_content.scale = Vector2(s, s)
	_content.position = (ZOOM_SPOT - c * ZOOM_SCALE) * z
	_content.queue_redraw()
	if z <= 0.0 and _focus.is_empty():
		_anchor = ""

func _related(a: String, b: String) -> bool:
	if a == b:
		return true
	for e: Array in EDGES:
		if (e[0] == a and e[1] == b) or (e[1] == a and e[0] == b):
			return true
	return false

func _fade_nodes() -> void:
	for key: String in _node_parts.keys():
		var a: float = 1.0
		if not _focus.is_empty():
			a = 1.0 if key == _focus else (0.8 if _related(_focus, key) else 0.12)
		for part: CanvasItem in _node_parts[key]:
			part.create_tween().tween_property(part, "modulate:a", a, 0.3)

func _group_of(species: String) -> Array:
	var y: float = NODES[species].y
	for row: Array in WEB_ROWS:
		if absf(float(row[0]) - y) < 0.05:
			return row
	return WEB_ROWS[0]

# 0 by day, 1 at dawn and dusk, 2 by night, -1 all hours alike.
func _rhythm_of(species: String) -> int:
	if DAY_SPECIES.has(species):
		return 0
	if TWILIGHT_SPECIES.has(species):
		return 1
	if NIGHT_SPECIES.has(species):
		return 2
	return -1

# The zoomed-in card: everything the rules say about one creature.
func _detail_card(species: String) -> Control:
	var info: Array = INFO[species]
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.075, 0.97)
	sb.border_color = info[1]
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 16)
	card.add_theme_stylebox_override("panel", sb)
	card.position = Vector2(520, 36)
	card.size = Vector2(672, 446)
	card.custom_minimum_size = card.size
	card.mouse_filter = Control.MOUSE_FILTER_STOP
	_web.add_child(card)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	card.add_child(row)

	# Left: the creature itself, when it is about, its season.
	var left := VBoxContainer.new()
	left.custom_minimum_size = Vector2(176, 0)
	left.add_theme_constant_override("separation", 8)
	row.add_child(left)
	var stage := Control.new()
	stage.custom_minimum_size = Vector2(176, 150)
	left.add_child(stage)
	_creature(stage, species, Vector2(88, 76), 140.0)
	var dial := RhythmDial.new()
	dial.mode = _rhythm_of(species)
	dial.custom_minimum_size = Vector2(176, 76)
	left.add_child(dial)
	if PRIME.has(species):
		var sea: Array = SEASONS[int(PRIME[species][0])]
		left.add_child(FelecoUiScript.heading("PRIME SEASON", 12, FelecoUiScript.GOLD))
		var chip := FelecoUiScript.label("%s: %s" % [sea[0], PRIME[species][1]], 14, sea[1])
		chip.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		chip.custom_minimum_size = Vector2(176, 0)
		left.add_child(chip)

	# Right: the rules. Diets are long enough now that the card scrolls.
	var scroll := ScrollContainer.new()
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.custom_minimum_size = Vector2(440, 400)
	row.add_child(scroll)
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 6)
	scroll.add_child(right)
	right.add_child(FelecoUiScript.heading(info[0], 28, FelecoUiScript.GOLD))
	var grp: Array = _group_of(species)
	right.add_child(FelecoUiScript.label("%s · %s" % [String(grp[2]).trim_suffix("s"), info[2]], 14, (SpeciesDB.GROUP_COLOR[grp[1]] as Color).lightened(0.15)))
	var body := FelecoUiScript.label(info[3], 15, FelecoUiScript.CREAM)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(440, 0)
	right.add_child(body)
	var eats: Array = []
	var eaten: Array = []
	for e: Array in EDGES:
		if e[1] == species:
			eats.append(e[0])
		if e[0] == species:
			eaten.append(e[1])
	if not eats.is_empty():
		right.add_child(FelecoUiScript.heading("EATS", 13, EDGE_COLORS["graze"]))
		right.add_child(_chips(eats))
	if not eaten.is_empty():
		var hunted: bool = not (grp[1] in ["producer", "decomposer"])
		right.add_child(FelecoUiScript.heading("EATEN BY" if hunted else "FEEDS", 13, EDGE_COLORS["hunt"]))
		right.add_child(_chips(eaten))
	var facts: PackedStringArray = []
	if Clock.LIFESPAN_DAYS.has(species):
		facts.append("Lives about %s days" % String.num(Clock.LIFESPAN_DAYS[species], 1))
	if not String(info[4]).is_empty():
		facts.append("Rare kinds: " + info[4])
	if not facts.is_empty():
		var f := FelecoUiScript.label("\n".join(facts), 13, FelecoUiScript.MIST)
		f.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		f.custom_minimum_size = Vector2(440, 0)
		right.add_child(f)
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	right.add_child(spacer)
	var back := Button.new()
	back.text = "Whole food web"
	back.theme_type_variation = "GhostButton"
	back.size_flags_horizontal = Control.SIZE_SHRINK_END
	back.pressed.connect(func() -> void: focus_species(""))
	right.add_child(back)
	return card

# Little creatures (meals, hunters) under their names; click one to jump to it.
func _chips(list: Array) -> Control:
	var flow := HFlowContainer.new()
	flow.add_theme_constant_override("h_separation", 6)
	flow.add_theme_constant_override("v_separation", 4)
	for sp: String in list:
		var chip := VBoxContainer.new()
		chip.add_theme_constant_override("separation", 0)
		var pic := Control.new()
		pic.custom_minimum_size = Vector2(88, 38)
		chip.add_child(pic)
		_creature(pic, sp, Vector2(44, 19), 38.0)
		var l := FelecoUiScript.label(String(INFO[sp][0]), 11, FelecoUiScript.CREAM)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.custom_minimum_size = Vector2(88, 0)
		chip.add_child(l)
		flow.add_child(chip)
	return flow

# A creature on screen: the 2D rig mesh plus an invisible hover target.
func _creature(parent: Control, species: String, center: Vector2, height: float) -> Control:
	var holder := Hover.new()
	holder.guide = self
	holder.species = species
	holder.position = center - Vector2(height, height) * 0.5
	holder.size = Vector2(height, height)
	holder.mouse_filter = Control.MOUSE_FILTER_STOP
	holder.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	holder.tooltip_text = SpeciesDB.label(species)
	holder.set_meta("species", species)
	parent.add_child(holder)
	var key: String = "%s@%d" % [species, holder.get_instance_id()]
	holder.tree_exiting.connect(func() -> void: _mats.erase(key))
	if SpriteGenerator.SPECIES.has(species):
		var mi := MeshInstance2D.new()
		mi.mesh = _grid_mesh()
		var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(species, {"size": Vector2(2, 2), "gait": 8.0, "style": 0})
		var q: Vector2 = cfg["size"]
		var mat := ShaderMaterial.new()
		mat.shader = RIG_2D
		var tex: Texture2D = SpriteGenerator.anim_texture_for(species)
		mat.set_shader_parameter("sprite", tex)
		mat.set_shader_parameter("quad", q)
		mat.set_shader_parameter("style", int(cfg["style"]))
		mat.set_shader_parameter("atlas_cell", 1.0 if species == "mushroom" else 0.0)
		mat.set_shader_parameter("creature_seed", randf() * 20.0)
		mat.set_shader_parameter("face_dir", 1.0 if randf() < 0.6 else -1.0)
		mat.set_shader_parameter("motion", 0.5 + randf() * 0.5)
		mat.set_shader_parameter("gait", float(cfg["gait"]) * 0.5)
		mat.set_shader_parameter("pixel_on", 1.0 if EraBook.id() == "pixel" else 0.0)
		mat.set_shader_parameter("px", height / maxf(q.x, q.y))
		mat.set_shader_parameter("texel", Vector2(1.0 / tex.get_width(), 1.0 / tex.get_height()))
		mat.set_shader_parameter("grid", Vector2(SpriteGenerator.FRAMES, SpriteGenerator.CELLS))
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
		else:
			var tr := TextureRect.new()
			match species:
				"grass": tr.texture = load(SpriteGenerator.SPRITE_DIR + "tuft.png")
				"berry", "moss", "apple", "pinecone", "pineapple": tr.texture = load(SpriteGenerator.SPRITE_DIR + species + ".png")
				"riverweed": tr.texture = CookedFoodArt.icon("riverweed")
				_: tr.texture = load(SpriteGenerator.SPRITE_DIR + "mycelium.png")
			tr.set_anchors_preset(Control.PRESET_FULL_RECT)
			tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
			holder.add_child(tr)
	holder.mouse_entered.connect(func() -> void: _set_hover(key, species, true))
	holder.mouse_exited.connect(func() -> void: _set_hover(key, species, false))
	return holder

func _web_node(key: String, c: Vector2) -> void:
	var disc := Panel.new()
	var info: Array = INFO[key]
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.06, 0.05, 0.75)
	sb.border_color = info[1]
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(30)
	sb.shadow_color = Color(info[1].r, info[1].g, info[1].b, 0.3)
	sb.shadow_size = 6
	disc.add_theme_stylebox_override("panel", sb)
	disc.position = c - Vector2(28, 28)
	disc.size = Vector2(56, 56)
	disc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(disc)
	var holder := _creature(_content, key, c, 46.0)
	var n := FelecoUiScript.heading(info[0], 13, FelecoUiScript.CREAM)
	n.position = c + Vector2(-60, 28)
	n.size = Vector2(120, 18)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	n.add_theme_constant_override("outline_size", 4)
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_content.add_child(n)
	_node_parts[key] = [disc, holder, n]

func _set_hover(key: String, species: String, on: bool) -> void:
	_hover_key = species if on and _focus.is_empty() else ""
	if _mats.has(key):
		(_mats[key] as ShaderMaterial).set_shader_parameter("hover", 1.0 if on else 0.0)
	_content.queue_redraw()

func _draw_web() -> void:
	# Bands: one per link of the food web, labelled down the left side. They
	# fade back when the web is zoomed in on one creature.
	var font: Font = FelecoUiScript.font("heading")
	var fade: float = 1.0 - 0.7 * _zoom
	for row: Array in WEB_ROWS:
		var y: float = WEB_AREA.position.y + float(row[0]) * WEB_AREA.size.y
		var col: Color = SpeciesDB.GROUP_COLOR[row[1]]
		_content.draw_rect(Rect2(14, y - 38, WEB_AREA.end.x + 20, 76), Color(col.r, col.g, col.b, 0.07 * fade))
		_content.draw_rect(Rect2(14, y - 38, 4, 76), Color(col.r, col.g, col.b, 0.8 * fade))
		_content.draw_string(font, Vector2(28, y + 6), String(row[2]), HORIZONTAL_ALIGNMENT_LEFT, 120, 16, Color(col.lightened(0.15), fade))
	# Arrows from food to eater. Faint until you hover or zoom: then that
	# creature's meals and its hunters light up and everything else fades away.
	var key: String = _focus if not _focus.is_empty() else _hover_key
	for e: Array in EDGES:
		var a: Vector2 = _node_centers[e[0]]
		var b: Vector2 = _node_centers[e[1]]
		var col: Color = EDGE_COLORS[e[2]]
		var lit: bool = key.is_empty() or key == e[0] or key == e[1]
		col.a = 0.9 if lit and not key.is_empty() else (0.22 if lit else 0.04 * (1.0 - _zoom))
		var dir: Vector2 = (b - a).normalized()
		var p0: Vector2 = a + dir * 32.0
		var p1: Vector2 = b - dir * 34.0
		var mid: Vector2 = (p0 + p1) * 0.5 + Vector2(-dir.y, dir.x) * 18.0
		var pts := PackedVector2Array()
		for i: int in 17:
			var t: float = i / 16.0
			pts.append(p0.lerp(mid, t).lerp(mid.lerp(p1, t), t))
		_content.draw_polyline(pts, col, 3.0 if lit and not key.is_empty() else 1.3, true)
		var tip: Vector2 = pts[pts.size() - 1]
		var back: Vector2 = (pts[pts.size() - 1] - pts[pts.size() - 3]).normalized()
		var side := Vector2(-back.y, back.x)
		_content.draw_colored_polygon(PackedVector2Array([tip, tip - back * 10.0 + side * 5.0, tip - back * 10.0 - side * 5.0]), col)

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
	col.add_child(FelecoUiScript.label(info[2], 13, FelecoUiScript.MIST))
	if PRIME.has(species):
		var sea: Array = SEASONS[int(PRIME[species][0])]
		col.add_child(FelecoUiScript.label("%s: %s" % [sea[0], PRIME[species][1]], 13, sea[1]))
	if species != _focus:
		col.add_child(FelecoUiScript.label("Click for its full card.", 12, FelecoUiScript.CREAM))
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

# A creature's hover target: a short card as the tooltip; a click zooms the
# web onto it.
class Hover extends Control:
	var guide: FieldGuide
	var species: String = ""

	func _make_custom_tooltip(_for_text: String) -> Object:
		return guide._make_card(species)

	func _gui_input(event: InputEvent) -> void:
		var mb := event as InputEventMouseButton
		if mb != null and mb.pressed and mb.button_index == MOUSE_BUTTON_LEFT:
			guide.focus_species(species)
			accept_event()

# When a creature is about: one day from midnight to midnight, the hours it
# keeps lit and the rest dimmed, with the sun at noon and the moon at the ends.
class RhythmDial extends Control:
	var mode: int = -1

	func _draw() -> void:
		var w: float = size.x
		var font: Font = get_theme_default_font()
		draw_string(font, Vector2(0, 13), "WHEN IT'S ABOUT", HORIZONTAL_ALIGNMENT_CENTER, w, 12, Color(0.902, 0.765, 0.416))
		var bar := Rect2(4, 22, w - 8, 22)
		var steps: int = 48
		var night := Color(0.14, 0.18, 0.36)
		var day := Color(0.98, 0.86, 0.48)
		var dusk := Color(0.92, 0.5, 0.32)
		for i: int in steps:
			var h: float = (i + 0.5) / steps
			var sun: float = clampf(-cos(h * TAU) * 1.6, -1.0, 1.0)
			var c: Color = night.lerp(dusk, clampf(sun + 1.0, 0.0, 1.0)).lerp(day, clampf(sun, 0.0, 1.0))
			if not _active(h):
				c = c.darkened(0.65)
			var x: float = bar.position.x + bar.size.x * float(i) / steps
			draw_rect(Rect2(x, bar.position.y, bar.size.x / steps + 0.6, bar.size.y), c)
		draw_rect(bar, Color(0.9, 0.85, 0.7, 0.5), false, 1.0)
		var mid_y: float = bar.position.y + bar.size.y * 0.5
		draw_circle(Vector2(bar.position.x + bar.size.x * 0.5, mid_y), 5.5, Color(1.0, 0.96, 0.7))
		for x: float in [bar.position.x + 10.0, bar.end.x - 10.0]:
			draw_circle(Vector2(x, mid_y), 5.0, Color(0.92, 0.94, 1.0))
			draw_circle(Vector2(x + 2.4, mid_y - 1.6), 4.4, night if _active(0.0) else night.darkened(0.65))
		var text: String = ["Up by day", "Busiest at dawn and dusk", "Out by night", "Day and night alike"][mode if mode >= 0 else 3]
		draw_string(font, Vector2(0, 64), text, HORIZONTAL_ALIGNMENT_CENTER, w, 14, Color(0.93, 0.9, 0.82))

	func _active(h: float) -> bool:
		match mode:
			0: return h > 0.24 and h < 0.78
			1: return absf(h - 0.25) < 0.08 or absf(h - 0.77) < 0.08
			2: return h < 0.26 or h > 0.76
		return true

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

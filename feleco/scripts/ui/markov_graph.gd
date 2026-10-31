class_name MarkovGraph
extends Control

# The Field Guide's deep dive: one creature's Markov model as a state diagram.
# Creatures weigh their odds live from what they sense, so each arrow names
# what pushes the choice and its usual pull. Click anywhere to close.

const GRAZER: Array = [
	["Forage", "Flee", "predator seen 85%"], ["Flee", "Forage", "safe again"],
	["Forage", "Herd", "fed 30%"], ["Herd", "Forage", "hungry"],
	["Forage", "Sleep", "night"], ["Sleep", "Forage", "dawn"],
]
const HUNTER: Array = [
	["Forage", "Chase", "hungry, prey seen 70%"], ["Chase", "Forage", "prey lost"],
	["Chase", "Eat", "caught"], ["Eat", "Forage", "fed"],
	["Forage", "Sleep", "rest"], ["Sleep", "Forage", "wakes"],
	["Forage", "Flee", "bigger threat 85%"], ["Flee", "Forage", "safe again"],
]
const FLYER: Array = [
	["Patrol", "Dive", "prey spotted"], ["Dive", "Eat", "caught"], ["Dive", "Patrol", "missed"],
	["Eat", "Patrol", "fed"], ["Patrol", "Roost", "dusk"], ["Roost", "Patrol", "dawn"],
]
const SOIL: Array = [
	["Crawl", "Feed", "rot nearby"], ["Feed", "Crawl", "patch spent"],
	["Crawl", "Flee", "hunter near"], ["Flee", "Crawl", "safe again"],
]
const SWIMMER: Array = [
	["Swim", "Feed", "food in water"], ["Feed", "Swim", "fed"],
	["Swim", "Flee", "hunter above"], ["Flee", "Swim", "safe again"],
]
const PERSON: Array = [
	["Gather", "Cook", "food in hand"], ["Cook", "Eat", "meal ready"], ["Eat", "Gather", "fed"],
	["Gather", "Hunt", "hungry, game near"], ["Hunt", "Cook", "kill made"],
	["Gather", "Sleep", "night"], ["Sleep", "Gather", "dawn"],
	["Gather", "Flee", "danger"], ["Flee", "Gather", "safe again"],
]
const MODELS: Dictionary = {
	"sheep": GRAZER, "rabbit": GRAZER, "deer": GRAZER, "goat": GRAZER, "boar": GRAZER, "mouse": GRAZER,
	"wolf": HUNTER, "lion": HUNTER, "bear": HUNTER, "falcon": FLYER, "robin": FLYER,
	"worm": SOIL, "beetle": SOIL, "fish": SWIMMER, "human": PERSON,
}

var species: String = ""
var title: String = ""
var accent: Color = Color.WHITE
var _spots: Dictionary = {}

static func has_model(id: String) -> bool:
	return MODELS.has(id)

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		queue_free()
		accept_event()

func _layout() -> void:
	var names: Array = []
	for e: Array in MODELS[species]:
		for i: int in 2:
			if not names.has(e[i]):
				names.append(e[i])
	var centre: Vector2 = size * Vector2(0.5, 0.54)
	var radius: Vector2 = size * Vector2(0.32, 0.31)
	for i: int in names.size():
		_spots[names[i]] = centre + Vector2.from_angle(-PI * 0.5 + TAU * i / names.size()) * radius

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.03, 0.05, 0.04, 0.96))
	_layout()
	var font: Font = get_theme_default_font()
	draw_string(font, Vector2(24, 36), "%s: how they decide" % title, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, accent)
	draw_string(font, Vector2(24, size.y - 14), "Click anywhere to go back.", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.8, 0.78, 0.68))
	for e: Array in MODELS[species]:
		var a: Vector2 = _spots[e[0]]
		var b: Vector2 = _spots[e[1]]
		var way: Vector2 = (b - a).normalized()
		# Two-way links sit side by side instead of on top of each other.
		var side: Vector2 = way.orthogonal() * 10.0
		var from: Vector2 = a + way * 46.0 + side
		var to: Vector2 = b - way * 46.0 + side
		draw_line(from, to, accent.darkened(0.2), 2.5, true)
		draw_colored_polygon(PackedVector2Array([to, to - way * 13.0 + way.orthogonal() * 6.0, to - way * 13.0 - way.orthogonal() * 6.0]), accent)
		var mid: Vector2 = (from + to) * 0.5 + side * 1.6
		var w: float = font.get_string_size(str(e[2]), HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		draw_rect(Rect2(mid - Vector2(w * 0.5 + 4.0, 13.0), Vector2(w + 8.0, 18.0)), Color(0.03, 0.05, 0.04, 0.85))
		draw_string(font, mid - Vector2(w * 0.5, 0.0), str(e[2]), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.96, 0.93, 0.82))
	for key: String in _spots:
		var p: Vector2 = _spots[key]
		draw_circle(p, 44.0, Color(0.08, 0.12, 0.1))
		draw_arc(p, 44.0, 0.0, TAU, 48, accent, 3.0, true)
		var w2: float = font.get_string_size(key, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		draw_string(font, p + Vector2(-w2 * 0.5, 6.0), key, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color.WHITE)

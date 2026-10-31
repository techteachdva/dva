class_name MindPage
extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# One picture of the creature mind: Traits, Memories and Dreams flow into a
# creature's own Markov model, and the model becomes what it does. Click to close.

const BOXES: Array = [
	["TRAITS", "Born with them", "brave: flees less\ntimid: flees more\nkin: stays near family", Color(0.95, 0.65, 0.3), 150.0],
	["MEMORIES", "Up to 100 in the Vault", "Survived a chase?\nRemembers the safe spot\nand escapes faster", Color(0.45, 0.75, 1.0), 345.0],
	["DREAMS", "Seen while it sleeps", "A hidden wish. Help it\ncome true: level up,\nlive longer", Color(0.8, 0.6, 1.0), 540.0],
]
const BARS: Array = [["Forage", 0.55, 0.05], ["Flee", 0.3, 0.2], ["Herd", 0.25, 0.15], ["Sleep", 0.4, -0.1]]

var _font: Font

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 60
	_font = FelecoUiScript.font("heading")

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		queue_free()
		accept_event()

func _process(_delta: float) -> void:
	queue_redraw()

func _text(at: Vector2, s: String, px: int, col: Color) -> void:
	var y: float = at.y
	for line: String in s.split("\n"):
		draw_string(_font, Vector2(at.x, y), line, HORIZONTAL_ALIGNMENT_LEFT, -1, px, col)
		y += px * 1.3

func _draw() -> void:
	var k: float = size.x / 1280.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(k, size.y / 720.0))
	draw_rect(Rect2(0, 0, 1280, 720), Color(0.04, 0.06, 0.05, 0.98))
	_text(Vector2(40, 56), "How Traits, Memories and Dreams work", 34, FelecoUiScript.GOLD)
	_text(Vector2(40, 92), "Every creature starts with its species' model, then becomes itself.", 18, Color(0.9, 0.87, 0.75))
	var t: float = Time.get_ticks_msec() * 0.0006
	var model := Rect2(520, 150, 360, 450)
	for i: int in BOXES.size():
		var b: Array = BOXES[i]
		var r := Rect2(40, float(b[4]), 380, 170)
		var col: Color = b[3]
		draw_rect(r, Color(col, 0.13))
		draw_rect(r, col, false, 3.0)
		_text(r.position + Vector2(18, 34), b[0], 24, col)
		_text(r.position + Vector2(18, 60), b[1], 15, Color(0.82, 0.8, 0.7))
		_text(r.position + Vector2(18, 92), b[2], 17, Color.WHITE)
		var from: Vector2 = r.position + Vector2(r.size.x, 85)
		var to: Vector2 = Vector2(model.position.x, 240.0 + i * 120.0)
		draw_line(from, to, col, 4.0, true)
		for p: int in 3:
			draw_circle(from.lerp(to, fmod(t + p / 3.0 + i * 0.1, 1.0)), 7.0, col.lightened(0.3))
	draw_rect(model, Color(0.08, 0.12, 0.1))
	draw_rect(model, FelecoUiScript.GOLD, false, 3.0)
	_text(model.position + Vector2(20, 38), "ITS OWN MARKOV MODEL", 21, FelecoUiScript.GOLD)
	_text(model.position + Vector2(20, 64), "grey: species   gold: this creature", 15, Color(0.82, 0.8, 0.7))
	for i: int in BARS.size():
		var row: Array = BARS[i]
		var y: float = model.position.y + 100.0 + i * 82.0
		_text(Vector2(model.position.x + 20, y), row[0], 19, Color.WHITE)
		var base: float = float(row[1]) * 300.0
		var own: float = maxf(0.0, base + float(row[2]) * 300.0 * (0.7 + 0.3 * sin(t * 6.0 + i)))
		draw_rect(Rect2(model.position.x + 20, y + 12, own, 16), FelecoUiScript.GOLD)
		draw_rect(Rect2(model.position.x + 20, y + 12, base, 6), Color(0.55, 0.58, 0.55))
	draw_line(Vector2(880, 375), Vector2(950, 375), FelecoUiScript.GOLD, 5.0, true)
	draw_colored_polygon(PackedVector2Array([Vector2(950, 359), Vector2(978, 375), Vector2(950, 391)]), FelecoUiScript.GOLD)
	_text(Vector2(990, 250), "WHAT IT DOES", 22, FelecoUiScript.GOLD)
	_text(Vector2(990, 290), "Decides differently\nfrom its kin, and\nchanges as it lives.\n\nRead any creature's\nVault on its card.\nThen help its dream.", 18, Color.WHITE)
	_text(Vector2(40, 700), "Click anywhere to go back.", 15, Color(0.8, 0.78, 0.68))

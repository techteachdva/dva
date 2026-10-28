class_name RulesTour
extends Control

# The guided first look at the Rules (the Field Guide): a short, paced tour
# that dims the page and lights one part at a time, says how to read it, and
# hands over the mouse for a real click on a creature. Finishing it opens
# the Valley Simulation on the main menu.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

signal finished

var guide: FieldGuide
var _step: int = -1
var _hole := Rect2()
var _hole_goal := Rect2()
var _card: PanelContainer
var _title: Label
var _body: Label
var _next: Button
var _t: float = 0.0
var _waiting_click: bool = false
# The card eases to the best free spot each frame, until the player drags it.
var _card_goal := Vector2(-1, -1)
var _dragged: bool = false

# [title, words, highlight in the guide's design coordinates (or empty), wait for a creature click].
const STEPS: Array = [
	["The Rules, alive", "This page is the whole valley on one screen. Let's learn to read it. It takes a minute.", Rect2(), false],
	["A year in one run", "Every run is one year. Each season shows who is out and busiest: lambs in spring, falcons in summer, mushrooms in autumn, the hardy few in winter.", Rect2(36, 50, 1208, 106), false],
	["The food web", "Every creature sits on a level. Carnivores at the top, then omnivores and herbivores, with producers (plants) and decomposers at the bottom.", Rect2(36, 164, 1208, 494), false],
	["Read the levels", "These five rows are also what you BET on: which level ends the year fullest. Energy flows up; every death flows back down to the soil.", Rect2(40, 190, 150, 460), false],
	["Who eats whom", "The lines are meals. Red: hunts. Green: grazes. Orange: forages. Purple: decays. Follow a line to see who feeds whom.", Rect2(36, 164, 1208, 494), false],
	["Your turn", "Click any creature in the web. It zooms in and opens its rules.", Rect2(36, 164, 1208, 494), true],
	["That's how it works", "See? What it eats, what hunts it, when it's about, and its special kinds. Every creature has a card like this. Come back any time.", Rect2(), false],
	["The valley is open!", "You can read the valley now. The Valley Simulation is unlocked on the main menu. Bet on a level, then tip the valley your way.", Rect2(), false],
]

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 60
	theme = FelecoUiScript.theme()
	_card = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.97)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(18)
	_card.add_theme_stylebox_override("panel", sb)
	_card.custom_minimum_size = Vector2(460, 0)
	_card.mouse_default_cursor_shape = Control.CURSOR_MOVE
	_card.tooltip_text = "Drag me anywhere."
	_card.gui_input.connect(_drag_card)
	add_child(_card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	_card.add_child(col)
	_title = FelecoUiScript.heading("", 26, FelecoUiScript.GOLD)
	col.add_child(_title)
	_body = FelecoUiScript.label("", 17, FelecoUiScript.CREAM)
	_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body.custom_minimum_size = Vector2(420, 0)
	col.add_child(_body)
	_next = Button.new()
	_next.theme_type_variation = "PrimaryButton"
	_next.custom_minimum_size = Vector2(0, 48)
	_next.pressed.connect(_advance)
	col.add_child(_next)
	_advance()

func _design_to_screen(r: Rect2) -> Rect2:
	var xf: Transform2D = guide._board.get_global_transform_with_canvas()
	var a: Vector2 = xf * r.position
	var b: Vector2 = xf * r.end
	return Rect2(a, b - a)

func _advance() -> void:
	_step += 1
	if _step >= STEPS.size():
		Juice.sfx(self, "fanfare")
		finished.emit()
		queue_free()
		return
	var s: Array = STEPS[_step]
	_title.text = s[0]
	_body.text = s[1]
	_waiting_click = bool(s[3])
	_next.visible = not _waiting_click
	_next.text = "Next  (%d of %d)" % [_step + 1, STEPS.size()] if _step + 1 < STEPS.size() else "Open the valley!"
	var r: Rect2 = s[2]
	_hole_goal = Rect2() if r.size == Vector2.ZERO else _design_to_screen(r)
	if _hole.size == Vector2.ZERO:
		_hole = _hole_goal
	# During the click step, let the mouse through to the guide.
	mouse_filter = Control.MOUSE_FILTER_IGNORE if _waiting_click else Control.MOUSE_FILTER_STOP
	Juice.sfx(self, "pop", 1.0 + 0.05 * _step, -10.0)
	_dragged = false
	_card_goal = Vector2(-1, -1)

# The best spot for the card: the first of below, above, right, left of the
# lit part that fits on screen without covering it; else the screen corner
# farthest from it; centred when nothing is lit. Always fully on screen.
func _best_spot() -> Vector2:
	var vs: Vector2 = get_viewport_rect().size
	var cs: Vector2 = _card.size
	var m: float = 16.0
	var centred := ((vs - cs) * 0.5).floor()
	if _hole_goal.size == Vector2.ZERO:
		return centred
	var h := _hole_goal.grow(12)
	var cx: float = h.get_center().x - cs.x * 0.5
	var cy: float = h.get_center().y - cs.y * 0.5
	var options: Array[Vector2] = [
		Vector2(cx, h.end.y + 8), Vector2(cx, h.position.y - cs.y - 8),
		Vector2(h.end.x + 8, cy), Vector2(h.position.x - cs.x - 8, cy),
	]
	for o: Vector2 in options:
		var p := Vector2(clampf(o.x, m, vs.x - cs.x - m), clampf(o.y, m, vs.y - cs.y - m))
		var r := Rect2(p, cs)
		if p.x >= m - 0.5 and p.y >= m - 0.5 and not r.intersects(_hole_goal):
			return p
	# Nothing beside it fits (the lit part is most of the screen): the corner
	# farthest from its centre, so the card covers as little as possible.
	var best := Vector2(m, m)
	var far: float = -1.0
	for corner: Vector2 in [Vector2(m, m), Vector2(vs.x - cs.x - m, m), Vector2(m, vs.y - cs.y - m), Vector2(vs.x - cs.x - m, vs.y - cs.y - m)]:
		var d: float = (corner + cs * 0.5).distance_to(_hole_goal.get_center())
		if d > far:
			far = d
			best = corner
	return best

func _clamp_on_screen(p: Vector2) -> Vector2:
	var vs: Vector2 = get_viewport_rect().size
	return Vector2(clampf(p.x, 8.0, maxf(8.0, vs.x - _card.size.x - 8.0)), clampf(p.y, 8.0, maxf(8.0, vs.y - _card.size.y - 8.0)))

func _drag_card(event: InputEvent) -> void:
	var mm := event as InputEventMouseMotion
	if mm != null and mm.button_mask & MOUSE_BUTTON_MASK_LEFT:
		_dragged = true
		_card.position = _clamp_on_screen(_card.position + mm.relative)
		_card.accept_event()

func _process(delta: float) -> void:
	_t += delta
	var k: float = 1.0 - exp(-delta * 10.0)
	_hole = Rect2(_hole.position.lerp(_hole_goal.position, k), _hole.size.lerp(_hole_goal.size, k))
	# Keep the card readable: ease to the best spot (once its size is known),
	# unless the player has moved it; either way, never off screen.
	if _card.size.x > 1.0:
		if not _dragged:
			var goal: Vector2 = _best_spot()
			if _card_goal.x < 0.0:
				_card.position = goal
			_card_goal = goal
			_card.position = _card.position.lerp(goal, 1.0 - exp(-delta * 12.0))
		_card.position = _clamp_on_screen(_card.position)
	if _waiting_click and guide != null and not String(guide._focus).is_empty():
		_waiting_click = false
		Juice.sfx(self, "chime")
		await get_tree().create_timer(1.2).timeout
		_advance()
	queue_redraw()

func _draw() -> void:
	var dim := Color(0, 0, 0, 0.62 if not _waiting_click else 0.25)
	var vs: Vector2 = size
	if _hole_goal.size == Vector2.ZERO:
		draw_rect(Rect2(Vector2.ZERO, vs), dim)
		return
	var h := _hole.grow(8)
	draw_rect(Rect2(0, 0, vs.x, h.position.y), dim)
	draw_rect(Rect2(0, h.end.y, vs.x, vs.y - h.end.y), dim)
	draw_rect(Rect2(0, h.position.y, h.position.x, h.size.y), dim)
	draw_rect(Rect2(h.end.x, h.position.y, vs.x - h.end.x, h.size.y), dim)
	var pulse: float = 0.6 + 0.4 * sin(_t * 4.0)
	draw_rect(h, Color(1, 0.85, 0.3, pulse), false, 4.0)

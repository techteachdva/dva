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
	_place_card()

func _place_card() -> void:
	_card.reset_size()
	var vs: Vector2 = size
	var cs: Vector2 = _card.get_combined_minimum_size()
	var pos := Vector2((vs.x - cs.x) * 0.5, (vs.y - cs.y) * 0.5)
	if _hole_goal.size != Vector2.ZERO:
		# Beside the lit part: below it if there's room, else above, else bottom right.
		if _hole_goal.end.y + cs.y + 16 < vs.y:
			pos = Vector2(clampf(_hole_goal.get_center().x - cs.x * 0.5, 16, vs.x - cs.x - 16), _hole_goal.end.y + 12)
		elif _hole_goal.position.y - cs.y - 16 > 0:
			pos = Vector2(clampf(_hole_goal.get_center().x - cs.x * 0.5, 16, vs.x - cs.x - 16), _hole_goal.position.y - cs.y - 12)
		else:
			pos = Vector2(vs.x - cs.x - 24, vs.y - cs.y - 24)
	_card.position = pos

func _process(delta: float) -> void:
	_t += delta
	var k: float = 1.0 - exp(-delta * 10.0)
	_hole = Rect2(_hole.position.lerp(_hole_goal.position, k), _hole.size.lerp(_hole_goal.size, k))
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

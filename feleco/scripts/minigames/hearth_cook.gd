class_name HearthCook
extends Control

# A house's cooking game: pots heat on the fire. Click each while its ring is
# in the gold band. Done pots go to the home's store; late ones burn.

signal finished(meals: int)

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const POTS: int = 5
const TIME: float = 20.0
const GOOD_FROM: float = 0.7
const GOOD_TO: float = 0.9
const FOODS: Array[String] = ["Apple", "Fish", "Greens", "Mushroom", "Rabbit"]

var _heat: Array[float] = []
var _rate: Array[float] = []
var _left: float = TIME
var _meals: int = 0
var _burnt: int = 0
var _done: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	for i: int in POTS:
		_heat.append(randf_range(0.0, 0.4))
		_rate.append(randf_range(0.22, 0.42))

func _spot(i: int) -> Vector2:
	return Vector2(size.x * (i + 0.5) / POTS, size.y * 0.56)

func _process(delta: float) -> void:
	queue_redraw()
	if _done:
		return
	_left -= delta
	for i: int in POTS:
		_heat[i] += _rate[i] * delta
		if _heat[i] > 1.0:
			_burnt += 1
			_reset(i)
			Juice.sfx(self, "block", 0.6, -8.0)
	if _left <= 0.0:
		_done = true
		finished.emit(_meals)
		queue_free()

func _reset(i: int) -> void:
	_heat[i] = 0.0
	_rate[i] = randf_range(0.22, 0.42) + _meals * 0.012

func _gui_input(event: InputEvent) -> void:
	if not event is InputEventMouseButton or not (event as InputEventMouseButton).pressed:
		return
	var at: Vector2 = (event as InputEventMouseButton).position
	for i: int in POTS:
		if at.distance_to(_spot(i)) < 80.0:
			if _heat[i] >= GOOD_FROM and _heat[i] <= GOOD_TO:
				_meals += 1
				Juice.sfx(self, "power", 1.4, -8.0)
				_reset(i)
			accept_event()
			return

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.1, 0.06, 0.04, 0.97))
	var font: Font = FelecoUiScript.font("heading")
	draw_string(font, Vector2(size.x * 0.5 - 220.0, 80.0), "Lift each pot in the gold!", HORIZONTAL_ALIGNMENT_LEFT, -1, 36, FelecoUiScript.GOLD)
	draw_string(font, Vector2(40, size.y - 40), "Meals %d    Burnt %d    Time %d" % [_meals, _burnt, ceili(_left)], HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color.WHITE)
	for i: int in POTS:
		var c: Vector2 = _spot(i)
		var h: float = _heat[i]
		draw_arc(c, 76.0, -PI * 0.5 + TAU * GOOD_FROM, -PI * 0.5 + TAU * GOOD_TO, 24, FelecoUiScript.GOLD, 14.0, true)
		draw_arc(c, 76.0, -PI * 0.5, -PI * 0.5 + TAU * h, 48, Color(1.0, 0.5, 0.15), 6.0, true)
		draw_circle(c, 54.0, Color(0.2, 0.16, 0.14))
		draw_circle(c + Vector2(0, -6), 44.0, Color(0.5, 0.3, 0.14).lerp(Color(0.9, 0.6, 0.2), h))
		for k: int in 3:
			var t: float = Time.get_ticks_msec() * 0.002 + k * 2.0 + i
			draw_circle(c + Vector2(cos(t) * 22.0, -fmod(t * 20.0, 34.0)), 4.0 + k, Color(1, 1, 1, 0.3 * h))
		draw_string(font, c + Vector2(-44, 100), FOODS[i], HORIZONTAL_ALIGNMENT_CENTER, 88, 18, Color.WHITE)

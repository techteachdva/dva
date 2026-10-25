class_name TitleMorph
extends Control

# The main-menu title. It opens on the full Latin, "Felicitus Ecologia",
# then the letters outside F-e-l and E-c-o drift away and the six that are
# left slide together into the game's name, FelEco.

signal finished

const PHRASE: String = "Felicitus Ecologia"
const KEEP: Array[int] = [0, 1, 2, 10, 11, 12]
const HOLD: float = 1.1
const FADE: float = 0.7
const SLIDE: float = 0.8

var font_size: int = 60
var _font: Font
var _t: float = 0.0
var _from: Array[float] = []
var _to: Array[float] = []
var _widths: Array[float] = []
var _done: bool = false

func _ready() -> void:
	_font = FelecoUi.font("heading")
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_measure()
	resized.connect(queue_redraw)

func _measure() -> void:
	_from.clear()
	_to.clear()
	_widths.clear()
	var x: float = 0.0
	for i: int in PHRASE.length():
		var w: float = _font.get_string_size(PHRASE[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size).x
		_widths.append(w)
		_from.append(x)
		x += w
	var full: float = x
	var kept: float = 0.0
	for i: int in KEEP:
		kept += _widths[i]
	var gap: float = font_size * 0.06
	var tx: float = 0.0
	for i: int in PHRASE.length():
		_to.append(0.0)
	for i: int in KEEP:
		_to[i] = tx
		tx += _widths[i] + (gap if i == 2 else 0.0)
	# Both lines are centred on the control.
	var off_from: float = -full * 0.5
	var off_to: float = -(kept + gap) * 0.5
	for i: int in PHRASE.length():
		_from[i] += off_from
		_to[i] += off_to
	custom_minimum_size = Vector2(full, font_size * 1.3)

# Skip straight to the finished name (a click, or coming back to the menu).
func finish() -> void:
	_t = HOLD + FADE + SLIDE + 1.0

func _process(delta: float) -> void:
	_t += delta
	queue_redraw()
	if not _done and _t >= HOLD + FADE + SLIDE:
		_done = true
		finished.emit()
		set_process(false)

func _draw() -> void:
	var fade: float = clampf((_t - HOLD) / FADE, 0.0, 1.0)
	var slide: float = clampf((_t - HOLD - FADE * 0.6) / SLIDE, 0.0, 1.0)
	slide = slide * slide * (3.0 - 2.0 * slide)
	var intro: float = clampf(_t / 0.5, 0.0, 1.0)
	var cx: float = size.x * 0.5
	var base: float = size.y * 0.5 + _font.get_ascent(font_size) * 0.5 - _font.get_descent(font_size) * 0.5
	for i: int in PHRASE.length():
		var kept: bool = i in KEEP
		var a: float = intro if kept else intro * (1.0 - fade)
		if a <= 0.01:
			continue
		var x: float = lerpf(_from[i], _to[i], slide) if kept else _from[i]
		var y: float = base
		if not kept:
			# Dropped letters drift up like seed fluff as they go.
			y -= fade * font_size * 0.5 * (0.6 + 0.4 * sin(float(i) * 1.7))
		var col: Color = FelecoUi.CREAM
		if kept and i >= 10:
			col = FelecoUi.CREAM.lerp(FelecoUi.GOLD, slide)
		col.a = a
		draw_string(_font, Vector2(cx + x, y), PHRASE[i], HORIZONTAL_ALIGNMENT_LEFT, -1, font_size, col)

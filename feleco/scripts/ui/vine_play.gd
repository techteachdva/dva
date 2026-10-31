class_name VinePlay
extends Control

# The loading bar: a vine that creeps along, leafing as it goes. Full, it
# blooms into a PLAY button wrapped in branches.

signal play

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

var progress: float = 0.0
var _button: Button
var _open: float = 0.0

func _ready() -> void:
	_button = Button.new()
	_button.text = "PLAY"
	_button.flat = true
	_button.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_button.add_theme_font_override("font", FelecoUiScript.font("heading"))
	_button.add_theme_font_size_override("font_size", 40)
	_button.add_theme_color_override("font_color", Color(0.93, 1.0, 0.78))
	_button.add_theme_color_override("font_hover_color", Color.WHITE)
	_button.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	_button.visible = false
	_button.pressed.connect(func() -> void: play.emit())
	add_child(_button)

func _process(delta: float) -> void:
	if progress >= 1.0 and not _button.visible:
		_button.visible = true
		_button.grab_focus()
	if progress >= 1.0:
		_open = minf(_open + delta * 2.0, 1.0)
	queue_redraw()

func _strand(y: float, wave: float, phase: float, upto: float, col: Color, w: float) -> void:
	var pts := PackedVector2Array()
	for i: int in 61:
		var u: float = float(i) / 60.0
		if u > upto:
			break
		pts.append(Vector2(u * size.x, y + sin(u * 22.0 + phase) * wave))
	if pts.size() > 1:
		draw_polyline(pts, col, w, true)
	for i: int in range(0, pts.size(), 4):
		var side: float = 1.0 if i % 8 == 0 else -1.0
		var tip: Vector2 = pts[i] + Vector2(9.0, side * 11.0)
		draw_line(pts[i], tip, col, 2.0, true)
		draw_circle(tip, 4.0, Color(0.42, 0.78, 0.3))

func _draw() -> void:
	var mid: float = size.y * 0.5
	var top: float = lerpf(mid, 6.0, _open)
	var low: float = lerpf(mid, size.y - 6.0, _open)
	var bark := Color(0.27, 0.46, 0.17)
	var body := StyleBoxFlat.new()
	body.bg_color = Color(0.1, 0.27, 0.13, 0.95 * _open)
	body.set_corner_radius_all(30)
	if _open > 0.0:
		draw_style_box(body, Rect2(0, top, size.x, low - top))
	_strand(top, 4.0, 0.0, progress, bark, 4.0)
	_strand(low, 4.0, 1.7, progress, bark.lightened(0.15), 4.0)

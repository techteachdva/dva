class_name PopulationGraph
extends Control

var _data: Array[Dictionary] = []
var _species_colors: Dictionary = {
	"sheep": Color(0.95, 0.95, 0.95),
	"wolves": Color(0.8, 0.1, 0.1),
	"humans": Color(0.9, 0.7, 0.5),
	"falcons": Color(0.9, 0.7, 0.15),
	"robins": Color(0.2, 0.6, 0.85),
	"boars": Color(0.5, 0.3, 0.2),
	"worms": Color(0.2, 0.8, 0.3),
}
var _species_order: Array[String] = ["sheep", "wolves", "humans", "falcons", "robins", "boars", "worms"]
var _max_value: int = 1
var _max_time: float = 1.0

func set_history(data: Array[Dictionary]) -> void:
	_data = data.duplicate()
	_max_value = 1
	_max_time = 1.0
	for snap in _data:
		for sp in _species_order:
			_max_value = maxi(_max_value, snap.get(sp, 0) as int)
		_max_time = maxf(_max_time, snap.get("time", 0.0) as float)
	_max_value = maxi(_max_value, 1)
	queue_redraw()

func _draw() -> void:
	if _data.is_empty():
		return
	var margin: float = 40.0
	var graph_w: float = size.x - margin * 2.0
	var graph_h: float = size.y - margin * 2.0
	var origin := Vector2(margin, size.y - margin)

	# Background
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.06, 0.08), true)

	# Axis lines
	draw_line(origin, origin + Vector2(graph_w, 0.0), Color(0.4, 0.4, 0.4), 1.5, true)
	draw_line(origin, origin - Vector2(0.0, graph_h), Color(0.4, 0.4, 0.4), 1.5, true)

	# Y ticks and labels
	var y_ticks: int = 5
	for i in range(y_ticks + 1):
		var t: float = float(i) / float(y_ticks)
		var y_pos: float = origin.y - t * graph_h
		draw_line(Vector2(origin.x, y_pos), Vector2(origin.x + 5.0, y_pos), Color(0.4, 0.4, 0.4), 1.0, true)
		var val: int = int(round(t * _max_value))
		draw_string(get_theme_default_font(), Vector2(origin.x - 30.0, y_pos + 4.0), str(val), HORIZONTAL_ALIGNMENT_RIGHT, -1, 12, Color(0.6, 0.6, 0.6))

	# X ticks
	var x_ticks: int = min(_data.size() - 1, 8)
	if x_ticks < 1:
		x_ticks = 1
	for i in range(x_ticks + 1):
		var t: float = float(i) / float(x_ticks)
		var x_pos: float = origin.x + t * graph_w
		draw_line(Vector2(x_pos, origin.y), Vector2(x_pos, origin.y - 5.0), Color(0.4, 0.4, 0.4), 1.0, true)
		var time_label: String = "%.0fs" % (t * _max_time)
		draw_string(get_theme_default_font(), Vector2(x_pos - 10.0, origin.y + 18.0), time_label, HORIZONTAL_ALIGNMENT_CENTER, -1, 12, Color(0.6, 0.6, 0.6))

	# Draw species lines
	for sp in _species_order:
		var points: PackedVector2Array = PackedVector2Array()
		for j in range(_data.size()):
			var snap := _data[j]
			var t_x: float = 0.0
			if _max_time > 0.0:
				t_x = (snap.get("time", 0.0) as float) / _max_time
			var t_y: float = 0.0
			if _max_value > 0:
				t_y = float(snap.get(sp, 0) as int) / float(_max_value)
			var px := origin.x + t_x * graph_w
			var py := origin.y - t_y * graph_h
			points.append(Vector2(px, py))
		if points.size() >= 2:
			var col: Color = _species_colors.get(sp, Color.WHITE)
			draw_polyline(points, col, 2.0, true)

	# Legend
	var leg_x: float = size.x - margin - 80.0
	var leg_y: float = margin
	for sp in _species_order:
		var col: Color = _species_colors.get(sp, Color.WHITE)
		draw_line(Vector2(leg_x, leg_y), Vector2(leg_x + 16.0, leg_y), col, 2.5, true)
		draw_string(get_theme_default_font(), Vector2(leg_x + 22.0, leg_y + 4.0), sp.capitalize(), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, col)
		leg_y += 18.0

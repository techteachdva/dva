class_name PopulationGraph
extends Control

# Two charts from one history. The top is the bet: which food-web group was
# fullest through the year (that is who earned each day on the hill). The
# bottom is every species' head count, so a missing animal is visible.

var _data: Array[Dictionary] = []
var _species: Array[String] = []
var _max_heads: int = 1
var _max_score: float = 0.05
var _max_time: float = 1.0

func set_history(data: Array[Dictionary]) -> void:
	_data = data.duplicate()
	_species.clear()
	_max_heads = 1
	_max_score = 0.05
	_max_time = 1.0
	var seen: Dictionary = {}
	for snap in _data:
		_max_time = maxf(_max_time, float(snap.get("time", 0.0)))
		for k: String in snap.keys():
			if k == "time" or k.begins_with("rule:"):
				if k.begins_with("rule:"):
					_max_score = maxf(_max_score, float(snap[k]))
				continue
			seen[k] = true
			_max_heads = maxi(_max_heads, int(snap[k]))
	for sp: String in SpeciesDB.CENSUS:
		if seen.has(sp):
			_species.append(sp)
	for k: String in seen.keys():
		if not _species.has(k):
			_species.append(k)
	queue_redraw()

func _draw() -> void:
	if _data.is_empty():
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.08, 0.07), true)
	var gap: float = 28.0
	var top_h: float = size.y * 0.42
	_chart(Rect2(0, 0, size.x, top_h), "Who ruled", true)
	_chart(Rect2(0, top_h + gap, size.x, size.y - top_h - gap), "Every species", false)

func _chart(rect: Rect2, title: String, groups: bool) -> void:
	var font := get_theme_default_font()
	draw_string(font, rect.position + Vector2(8, 16), title, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.9, 0.78, 0.45))
	var margin_l: float = 36.0
	var margin_r: float = 118.0
	var margin_t: float = 26.0
	var margin_b: float = 22.0
	var origin := rect.position + Vector2(margin_l, rect.size.y - margin_b)
	var graph_w: float = maxf(rect.size.x - margin_l - margin_r, 20.0)
	var graph_h: float = maxf(rect.size.y - margin_t - margin_b, 20.0)
	draw_line(origin, origin + Vector2(graph_w, 0.0), Color(0.4, 0.45, 0.4), 1.5, true)
	draw_line(origin, origin - Vector2(0.0, graph_h), Color(0.4, 0.45, 0.4), 1.5, true)
	var keys: Array[String] = []
	if groups:
		for g: String in SpeciesDB.GROUPS:
			keys.append("rule:" + g)
	else:
		keys = _species
	var font_small := font
	for key: String in keys:
		var points := PackedVector2Array()
		for snap in _data:
			var t_x: float = float(snap.get("time", 0.0)) / _max_time
			var raw: float = float(snap.get(key, 0.0))
			var t_y: float = raw / (_max_score if groups else float(_max_heads))
			points.append(Vector2(origin.x + t_x * graph_w, origin.y - t_y * graph_h))
		if points.size() >= 2:
			draw_polyline(points, _color_of(key), 2.2 if groups else 1.6, true)
	var leg_x: float = origin.x + graph_w + 8.0
	var leg_y: float = origin.y - graph_h + 4.0
	for key: String in keys:
		var col: Color = _color_of(key)
		draw_line(Vector2(leg_x, leg_y), Vector2(leg_x + 12.0, leg_y), col, 2.5, true)
		draw_string(font_small, Vector2(leg_x + 16.0, leg_y + 4.0), _name_of(key), HORIZONTAL_ALIGNMENT_LEFT, 96.0, 12 if groups else 11, col)
		leg_y += 16.0 if groups else 13.0

func _color_of(key: String) -> Color:
	if key.begins_with("rule:"):
		return SpeciesDB.GROUP_COLOR.get(key.trim_prefix("rule:"), Color.WHITE)
	var id: String = SpeciesDB.id_for(key)
	var row: Dictionary = SpeciesDB.row(id)
	return row.get("color", Color(0.8, 0.8, 0.8))

func _name_of(key: String) -> String:
	if key.begins_with("rule:"):
		return SpeciesDB.GROUP_LABEL.get(key.trim_prefix("rule:"), key)
	return SpeciesDB.label(SpeciesDB.id_for(key))

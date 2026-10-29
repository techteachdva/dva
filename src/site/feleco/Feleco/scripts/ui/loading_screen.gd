extends Control

var _rings: Array[Dictionary] = []
var _sim: SimulationDirector = null
var _ready_to_hide: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var world: Node3D = get_tree().current_scene.get_node_or_null("World")
	if world != null:
		_sim = world as SimulationDirector
	# Build ring data for each species
	var species_colors: Array[Color] = [
		Color(0.8, 0.1, 0.1),   # wolf red
		Color(0.95, 0.95, 0.95), # sheep white
		Color(0.9, 0.7, 0.5),    # human tan
		Color(0.5, 0.3, 0.2),    # boar brown
		Color(0.2, 0.8, 0.3),    # worm green
		Color(0.2, 0.6, 0.85),   # robin blue
		Color(0.9, 0.7, 0.15),   # falcon gold
	]
	for i: int in range(species_colors.size()):
		_rings.append({
			"color": species_colors[i],
			"radius": 40.0 + i * 30.0,
			"speed": (1.0 if i % 2 == 0 else -1.0) * (0.3 + i * 0.08),
			"segments": 12 + i * 2,
			"thickness": 3.0 + i * 0.4,
			"angle": randf() * TAU,
		})
	queue_redraw()

func _process(delta: float) -> void:
	for ring: Dictionary in _rings:
		ring["angle"] += ring["speed"] * delta
	queue_redraw()
	# Auto-hide when simulation entities are spawned
	if not _ready_to_hide:
		if _sim != null:
			if _sim._agent_registry.size() > 5:
				_ready_to_hide = true
				var tween := create_tween()
				tween.tween_property(self, "modulate", Color.TRANSPARENT, 0.8)
				tween.tween_callback(queue_free)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.078, 0.102, 0.086, 1))
	var center := size * 0.5
	var ring_alpha: float = 0.9
	var max_radius: float = 0.0
	for ring: Dictionary in _rings:
		var r: float = ring["radius"]
		max_radius = maxf(max_radius, r)
		var segs: int = ring["segments"]
		var base_angle: float = ring["angle"]
		var col: Color = ring["color"]
		col.a = ring_alpha
		for s: int in range(segs):
			var a1: float = base_angle + (float(s) / segs) * TAU
			var a2: float = base_angle + (float(s + 0.7) / segs) * TAU
			draw_arc(center, r, a1, a2, 32, col, ring["thickness"], true)
	# Center dot
	draw_circle(center, 8.0, Color(0.6, 0.6, 0.6))
	# Title text
	var font := get_theme_default_font()
	if font != null:
		var ts := font.get_string_size("FELECO", HORIZONTAL_ALIGNMENT_CENTER, -1, 28)
		draw_string(font, center + Vector2(-ts.x * 0.5, max_radius + 50.0), "FELECO", HORIZONTAL_ALIGNMENT_CENTER, -1, 28, Color(0.957, 0.937, 0.894))
		ts = font.get_string_size("The valley is waking", HORIZONTAL_ALIGNMENT_CENTER, -1, 16)
		draw_string(font, center + Vector2(-ts.x * 0.5, max_radius + 78.0), "The valley is waking", HORIZONTAL_ALIGNMENT_CENTER, -1, 16, Color(0.902, 0.765, 0.416))

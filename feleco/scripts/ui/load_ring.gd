class_name LoadRing
extends Control

# The loading symbol: a hollow circle that a branching fractal grows to fill,
# with a progress arc round the rim. Set progress 0..1.

const SIZE: float = 96.0
const BRANCHES: int = 6
const DEPTH: int = 5

var progress: float = 0.0
var gold: Color = Color(0.902, 0.765, 0.416)

static func corner(parent: Control) -> LoadRing:
	var ring := LoadRing.new()
	ring.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	ring.offset_left = -SIZE - 24.0
	ring.offset_top = -SIZE - 24.0
	ring.offset_right = -24.0
	ring.offset_bottom = -24.0
	ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(ring)
	return ring

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var c := Vector2(SIZE, SIZE) * 0.5
	var r: float = SIZE * 0.5 - 4.0
	var p: float = clampf(progress, 0.0, 1.0)
	draw_circle(c, r, Color(0.03, 0.05, 0.04, 0.7))
	var turn: float = Time.get_ticks_msec() * 0.00025
	# One arm at a time, each growing limb by limb, until the circle is full.
	for i: int in BRANCHES:
		var share: float = clampf(p * BRANCHES - i, 0.0, 1.0)
		_branch(c, turn + TAU * i / BRANCHES, r * 0.42, DEPTH, share * DEPTH)
	draw_arc(c, r, 0.0, TAU, 64, Color(gold, 0.3), 2.0, true)
	draw_arc(c, r, -PI * 0.5, -PI * 0.5 + TAU * p, 64, gold, 4.0, true)

# Each level unlocks as progress passes it, and grows smoothly.
func _branch(from: Vector2, ang: float, length: float, depth: int, grow: float) -> void:
	if depth <= 0 or grow <= 0.0:
		return
	var to: Vector2 = from + Vector2.from_angle(ang) * length * clampf(grow, 0.0, 1.0)
	var col: Color = gold.lerp(Color.from_hsv(fmod(ang / TAU + 1.0, 1.0), 0.45, 1.0), 0.4)
	draw_line(from, to, col, 0.6 + depth * 0.4, true)
	_branch(to, ang - 0.6, length * 0.62, depth - 1, grow - 1.0)
	_branch(to, ang + 0.6, length * 0.62, depth - 1, grow - 1.0)

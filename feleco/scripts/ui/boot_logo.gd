class_name BootLogo
extends Control

# The FelEco logo as it loads: a circle of small Markov trees that grow, join,
# wither and regrow round a central tree whose branches spell FELECO. The wheel
# turns slowly and stops dead level at progress 1, every branch lit.

const LETTERS: Array = [
	[[[0, 2], [0, 0], [1, 0]], [[0, 1], [0.8, 1]]],
	[[[1, 0], [0, 0], [0, 2], [1, 2]], [[0, 1], [0.8, 1]]],
	[[[0, 0], [0, 2], [1, 2]]],
	[[[1, 0], [0, 0], [0, 2], [1, 2]], [[0, 1], [0.8, 1]]],
	[[[1, 0], [0, 0], [0, 2], [1, 2]]],
	[[[0, 0], [1, 0], [1, 2], [0, 2], [0, 0]]],
]
const TREES: int = 12
const TURNS: float = 0.3

var progress: float = 0.0
var gold: Color = Color(0.902, 0.765, 0.416)

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var c: Vector2 = size * 0.5
	var r: float = minf(size.x, size.y) * 0.5 - 6.0
	var p: float = clampf(progress, 0.0, 1.0)
	var eased: float = 1.0 - pow(1.0 - p, 3.0)
	var turn: float = (1.0 - eased) * TAU * TURNS
	draw_circle(c, r, Color(0.03, 0.05, 0.04, 0.85))
	var clock: float = Time.get_ticks_msec() * 0.0004
	for i: int in TREES:
		var a: float = turn + TAU * i / TREES
		var root: Vector2 = c + Vector2.from_angle(a) * r * 0.97
		# Each tree lives its own short life; loading wakes more of them.
		var life: float = fmod(clock + i * 0.37, 1.0)
		var grow: float = sin(life * PI) * minf(1.0, p * 2.0 + 0.2)
		_tree(root, a + PI, r * 0.3, 3, grow, Color.from_hsv(0.2 + i * 0.03, 0.4, 1.0, grow * 0.65))
		# A link to the next tree: states feeding one another.
		var next: Vector2 = c + Vector2.from_angle(a + TAU / TREES) * r * 0.74
		draw_line(c + Vector2.from_angle(a) * r * 0.74, next, Color(gold, 0.25 * grow), 1.5, true)
	draw_arc(c, r, 0.0, TAU, 96, Color(gold, 0.25), 2.0, true)
	draw_arc(c, r, -PI * 0.5, -PI * 0.5 + TAU * p, 96, gold, 4.0, true)
	_word(c, r, turn, p)

func _tree(from: Vector2, ang: float, length: float, depth: int, grow: float, col: Color) -> void:
	if depth <= 0 or grow <= 0.02:
		return
	var to: Vector2 = from + Vector2.from_angle(ang) * length * grow
	draw_line(from, to, col, 0.5 + depth * 0.4)
	_tree(to, ang - 0.55, length * 0.66, depth - 1, grow, col)
	_tree(to, ang + 0.55, length * 0.66, depth - 1, grow, col)

# FELECO is the tree: a trunk climbs from the rim to a limb, the letters grow
# from that limb stroke by stroke, and twigs fork all along them.
func _word(c: Vector2, r: float, turn: float, p: float) -> void:
	var cell: float = r * 0.19
	var gap: float = cell * 1.14
	var limb: float = cell * 1.5
	var strokes: Array = [[Vector2(0, r * 0.93), Vector2(0, limb)], [Vector2(-2.75 * gap, limb), Vector2(2.25 * gap, limb)]]
	# A stem from the limb up to the foot of each letter.
	for i: int in LETTERS.size():
		strokes.append([Vector2((i - 2.75) * gap, limb), Vector2((i - 2.75) * gap, cell)])
	for i: int in LETTERS.size():
		for s: Array in LETTERS[i]:
			var pts: Array = []
			for q: Array in s:
				pts.append(Vector2((i - 2.75 + float(q[0]) * 0.68) * gap, (float(q[1]) - 1.0) * cell))
			strokes.append(pts)
	var lit: float = p * strokes.size()
	for i: int in strokes.size():
		var a: float = clampf(lit - i, 0.0, 1.0)
		if a <= 0.0:
			continue
		var col := Color(1.0, 0.94, 0.72, a)
		var pts: Array = strokes[i]
		for k: int in pts.size() - 1:
			var from: Vector2 = c + (pts[k] as Vector2).rotated(turn)
			var to: Vector2 = c + (pts[k + 1] as Vector2).rotated(turn)
			draw_line(from, from.lerp(to, a), Color(gold, a * 0.3), 9.0, true)
			draw_line(from, from.lerp(to, a), col, 3.5, true)
			var along: float = (to - from).angle()
			for n: int in 3:
				var at: Vector2 = from.lerp(to, (n + 0.5) / 3.0 * a)
				var side: float = 1.0 if n % 2 == 0 else -1.0
				_tree(at, along + side * 0.8, cell * 0.13, 1, a, Color(0.75, 1.0, 0.6, a * 0.9))

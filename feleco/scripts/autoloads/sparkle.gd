extends CanvasLayer

# The spirit's touch: every click or tap, on the valley or a menu, leaves a
# brief ring and a scatter of gold-green sparks.

const SPARKS: int = 12
const LIFE: float = 0.6

var _board: Control
var _bursts: Array = []

func _ready() -> void:
	layer = 120
	process_mode = Node.PROCESS_MODE_ALWAYS
	_board = Control.new()
	_board.set_anchors_preset(Control.PRESET_FULL_RECT)
	_board.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_board.draw.connect(_paint)
	add_child(_board)

func _input(event: InputEvent) -> void:
	var at := Vector2.INF
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		at = (event as InputEventMouseButton).position
	elif event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed:
		at = (event as InputEventScreenTouch).position
	if at != Vector2.INF:
		_bursts.append([at, 0.0, randf() * TAU])

func _process(delta: float) -> void:
	for b: Array in _bursts:
		b[1] = float(b[1]) + delta
	_bursts = _bursts.filter(func(b: Array) -> bool: return float(b[1]) < LIFE)
	_board.queue_redraw()

func _paint() -> void:
	for b: Array in _bursts:
		var t: float = float(b[1]) / LIFE
		var fade: float = 1.0 - t
		_board.draw_arc(b[0], 8.0 + t * 44.0, 0.0, TAU, 32, Color(0.95, 0.9, 0.55, fade * 0.7), 2.0, true)
		for i: int in SPARKS:
			var a: float = float(b[2]) + TAU * i / SPARKS
			var at: Vector2 = (b[0] as Vector2) + Vector2.from_angle(a) * (10.0 + t * (40.0 + i % 3 * 14.0))
			var col: Color = Color(0.7, 1.0, 0.55, fade) if i % 2 == 0 else Color(1.0, 0.9, 0.5, fade)
			_board.draw_circle(at, 2.6 * fade + 0.6, col)

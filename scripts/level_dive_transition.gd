extends CanvasLayer

# LevelDiveTransition — gentle holographic splash when launching a level
# Usage: LevelDiveTransition.start(hex_screen_pos, hex_color, callback)

@onready var _rect: ColorRect = $ColorRect
@onready var _mat: ShaderMaterial = _rect.material as ShaderMaterial

var _is_active: bool = false
var _callback: Callable = Callable()

func _ready() -> void:
	layer = 200
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.visible = false
	if _mat != null:
		_mat.set_shader_parameter("progress", 0.0)

func start(hex_pos: Vector2, hex_color: Color, on_complete: Callable) -> void:
	if _is_active:
		return
	_is_active = true
	_callback = on_complete

	if _mat == null:
		_is_active = false
		if on_complete.is_valid():
			on_complete.call()
		return

	# Normalize hex position to 0-1 UV space
	var vp_size: Vector2 = get_viewport().get_visible_rect().size
	var uv_pos := Vector2(hex_pos.x / vp_size.x, hex_pos.y / vp_size.y)

	_mat.set_shader_parameter("hex_pos", uv_pos)
	_mat.set_shader_parameter("hex_color", Vector3(hex_color.r, hex_color.g, hex_color.b))
	_mat.set_shader_parameter("progress", 0.0)
	_mat.set_shader_parameter("time_scale", 0.8)

	_rect.visible = true

	# Phase 1: gentle expansion (0.0 -> 0.85) — 0.6s, soft ease-out
	var tw := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_method(_set_progress, 0.0, 0.85, 0.6)
	tw.chain().tween_callback(func():
		# Load level while screen is softly covered
		if _callback.is_valid():
			_callback.call()
	)
	# Phase 2: gentle fade out (0.85 -> 1.0) — 0.3s, quick dissolve
	tw.chain().tween_method(_set_progress, 0.85, 1.0, 0.3).set_ease(Tween.EASE_IN)
	tw.chain().tween_callback(func():
		_rect.visible = false
		_is_active = false
		_mat.set_shader_parameter("progress", 0.0)
	)

func _set_progress(v: float) -> void:
	if _mat != null:
		_mat.set_shader_parameter("progress", v)

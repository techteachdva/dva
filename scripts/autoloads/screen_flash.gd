extends CanvasLayer

# ScreenFlash — vignette-style edge flash for boost, damage, and hoop-pass feedback
# Usage: ScreenFlash.flash_boost(), ScreenFlash.flash_damage(), ScreenFlash.flash_hoop()

@onready var _rect: ColorRect = $ColorRect
@onready var _mat: ShaderMaterial = _rect.material as ShaderMaterial

func _ready() -> void:
	layer = 100
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	if _mat != null:
		_mat.set_shader_parameter("flash_color", Color(0.0, 0.0, 0.0, 0.0))
		_mat.set_shader_parameter("intensity", 0.0)

func flash(color: Color, duration: float, fade_in: float = 0.03) -> void:
	if get_node_or_null("/root/LevelManager") != null and LevelManager.get_setting("reduce_motion", false):
		return
	if _mat == null:
		return
	# Kill any running tween
	_mat.set_shader_parameter("flash_color", color)
	_mat.set_shader_parameter("intensity", color.a)
	var tw := create_tween().set_trans(Tween.TRANS_LINEAR)
	tw.tween_method(_set_intensity, color.a, 0.0, duration).set_delay(fade_in)

func _set_intensity(v: float) -> void:
	if _mat != null:
		_mat.set_shader_parameter("intensity", v)

func flash_boost() -> void:
	flash(Color(1.0, 1.0, 1.0, 0.35), 0.25)

func flash_damage() -> void:
	flash(Color(1.0, 0.15, 0.05, 0.45), 0.35)

func flash_hoop() -> void:
	flash(Color(0.1, 1.0, 0.3, 0.25), 0.20)

func flash_slam() -> void:
	flash(Color(0.9, 0.7, 1.0, 0.18), 0.14)

func flash_slam_impact() -> void:
	flash(Color(1.0, 0.95, 0.85, 0.15), 0.10)

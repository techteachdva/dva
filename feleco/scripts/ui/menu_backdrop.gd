class_name MenuBackdrop
extends Control

# The main menu's backdrop: four posters of the valley, one per season,
# staged in the real game (scripts/dev/menu_poster.gd). They hold, then
# cross-fade one into the next.

const BackdropShader: Shader = preload("res://scripts/ui/menu_backdrop.gdshader")
const HOLD: float = 7.0
const FADE: float = 2.5
const SEASONS: Array[String] = [
	"res://assets/ui/menu_spring.jpg", "res://assets/ui/menu_summer.jpg",
	"res://assets/ui/menu_autumn.jpg", "res://assets/ui/menu_winter.jpg",
]

var _layers: Array[TextureRect] = []
var _t: float = 0.0
var _index: int = 0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for i: int in SEASONS.size():
		var tr := TextureRect.new()
		tr.texture = load(SEASONS[i])
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		tr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var mat := ShaderMaterial.new()
		mat.shader = BackdropShader
		tr.material = mat
		add_child(tr)
		_layers.append(tr)
	for k: int in _layers.size():
		_layers[k].visible = k == _index

func _process(delta: float) -> void:
	_t += delta
	var next: int = (_index + 1) % _layers.size()
	if _t < HOLD:
		return
	var f: float = clampf((_t - HOLD) / FADE, 0.0, 1.0)
	# The next season sits underneath; the current one fades off it.
	move_child(_layers[_index], -1)
	_layers[next].visible = true
	(_layers[next].material as ShaderMaterial).set_shader_parameter("fade", 1.0)
	(_layers[_index].material as ShaderMaterial).set_shader_parameter("fade", 1.0 - f * f * (3.0 - 2.0 * f))
	if f >= 1.0:
		_layers[_index].visible = false
		_index = next
		_t = 0.0

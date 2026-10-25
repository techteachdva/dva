class_name FloatingText
extends Label

var _world_pos: Vector3 = Vector3.ZERO
var _camera: Camera3D = null
var _velocity: Vector2 = Vector2.ZERO
var _life: float = 1.5
var _elapsed: float = 0.0
var _started: bool = false
var _on_done: Callable = Callable()
var _is_dramatic: bool = false
var _shake_intensity: float = 0.0

func setup(world_pos: Vector3, label_text: String, color: Color, is_crit: bool = false) -> void:
	_world_pos = world_pos
	self.text = label_text
	modulate = color
	horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if is_crit:
		add_theme_font_size_override("font_size", 22)
	else:
		add_theme_font_size_override("font_size", 16)
	_velocity = Vector2((randf() - 0.5) * 60.0, -40.0)

func setup_dramatic(world_pos: Vector3, label_text: String, color: Color) -> void:
	_world_pos = world_pos
	self.text = label_text
	modulate = color
	horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_theme_font_size_override("font_size", 28)
	_velocity = Vector2((randf() - 0.5) * 40.0, -30.0)
	_is_dramatic = true
	_shake_intensity = 3.0
	_life = 2.5

func _find_camera() -> Camera3D:
	var root := get_tree().current_scene
	if root == null:
		return null
	var cam := root.get_node_or_null("Camera3D") as Camera3D
	if cam != null:
		return cam
	for child in root.get_children(true):
		if child is Camera3D:
			return child as Camera3D
	return null

func _ready() -> void:
	# Wait one frame for layout before showing
	call_deferred("_do_start")

func _do_start() -> void:
	_update_position()
	_started = true

func _process(delta: float) -> void:
	if not _started:
		return
	_elapsed += delta
	if _elapsed >= _life:
		if _on_done.is_valid():
			_on_done.call(self)
		else:
			queue_free()
		return
	position += _velocity * delta
	_velocity.x *= 0.98
	_velocity.y -= 20.0 * delta
	var alpha := 1.0 - (_elapsed / _life)
	modulate.a = alpha
	# Dramatic text shake/vibrate
	if _is_dramatic and _shake_intensity > 0.0:
		position += Vector2((randf() - 0.5) * _shake_intensity, (randf() - 0.5) * _shake_intensity)
		_shake_intensity = maxf(_shake_intensity - delta * 4.0, 0.0)
	_update_position()

func _update_position() -> void:
	if _camera == null or not is_instance_valid(_camera) or not _camera.is_inside_tree():
		_camera = _find_camera()
	if _camera == null or not _camera.is_inside_tree():
		return
	var screen_pos := _camera.unproject_position(_world_pos)
	position = screen_pos - (size * 0.5)

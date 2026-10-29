extends Camera3D

@export var move_speed: float = 25.0
@export var zoom_speed: float = 8.0
@export var mouse_sensitivity: float = 0.003

var _pitch: float = 0.0
var _yaw: float = 0.0
var _mouse_delta: Vector2 = Vector2.ZERO
var _scroll_delta: float = 0.0
var _right_held: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var euler := global_transform.basis.get_euler()
	_yaw = euler.y
	_pitch = euler.x

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_RIGHT:
			_right_held = event.pressed
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if _right_held else Input.MOUSE_MODE_VISIBLE
		elif event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_scroll_delta += 1.0
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_scroll_delta -= 1.0
	elif event is InputEventMouseMotion and _right_held:
		_mouse_delta += event.relative

func snap_top_down() -> void:
	global_position = Vector3(0.0, 80.0, 0.0)
	rotation = Vector3(-PI * 0.5, 0.0, 0.0)
	_pitch = -PI * 0.5
	_yaw = 0.0

func _process(delta: float) -> void:
	_yaw -= _mouse_delta.x * mouse_sensitivity
	_pitch -= _mouse_delta.y * mouse_sensitivity
	_pitch = clampf(_pitch, -PI * 0.49, PI * 0.49)
	_mouse_delta = Vector2.ZERO

	rotation = Vector3(_pitch, _yaw, 0.0)

	if _scroll_delta != 0.0:
		translate_object_local(Vector3.FORWARD * zoom_speed * _scroll_delta)
		_scroll_delta = 0.0

	var dir := Vector3.ZERO
	if Input.is_key_pressed(KEY_W):
		dir += Vector3.FORWARD
	if Input.is_key_pressed(KEY_S):
		dir += Vector3.BACK
	if Input.is_key_pressed(KEY_A):
		dir += Vector3.LEFT
	if Input.is_key_pressed(KEY_D):
		dir += Vector3.RIGHT
	if Input.is_key_pressed(KEY_Q):
		dir += Vector3.UP
	if Input.is_key_pressed(KEY_E):
		dir += Vector3.DOWN
	if dir != Vector3.ZERO:
		dir = dir.normalized()
		translate_object_local(dir * move_speed * delta)

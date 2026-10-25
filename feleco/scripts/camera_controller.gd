extends Camera3D

# Orbit rig around a point on the meadow. WASD/arrows pan, Q/E turn, scroll
# zooms, right-drag orbits, middle-drag pans. Everything eases toward its
# goal, runs on real time (unaffected by 2x/5x or pause) and can follow a
# creature.

@export var pan_speed: float = 38.0
@export var mouse_sensitivity: float = 0.005

const MIN_DIST: float = 10.0
const MAX_DIST: float = 120.0
const MIN_PITCH: float = deg_to_rad(-88.0)
const MAX_PITCH: float = deg_to_rad(-14.0)
const BOUND: float = 58.0
const EASE: float = 9.0

var target := Vector3(0.0, 0.0, 2.0)
var yaw: float = 0.0
var pitch: float = deg_to_rad(-40.0)
var distance: float = 64.0
var _goal_target := target
var _goal_yaw: float = yaw
var _goal_pitch: float = pitch
var _goal_distance: float = distance
var _right_held: bool = false
var _middle_held: bool = false
var _follow: Node3D = null
var _follow_last := Vector3.ZERO
var _last_usec: int = 0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group("camera")
	_apply()

func set_view(at: Vector3, p_yaw: float, p_pitch: float, p_distance: float, instant: bool = false) -> void:
	_goal_target = at
	_goal_yaw = p_yaw
	_goal_pitch = clampf(p_pitch, MIN_PITCH, MAX_PITCH)
	_goal_distance = clampf(p_distance, MIN_DIST, MAX_DIST)
	if instant:
		target = _goal_target
		yaw = _goal_yaw
		pitch = _goal_pitch
		distance = _goal_distance
		_apply()

func snap_top_down() -> void:
	_follow = null
	set_view(Vector3(0.0, 0.0, 0.0), 0.0, MIN_PITCH, 92.0)

func reset_view() -> void:
	_follow = null
	set_view(Vector3(0.0, 0.0, 2.0), 0.0, deg_to_rad(-40.0), 64.0)

func follow(node: Node3D) -> void:
	_follow = node
	if node != null and _goal_distance > 34.0:
		_goal_distance = 26.0

func following() -> Node3D:
	if _follow != null and not is_instance_valid(_follow):
		# The creature died: stay on its carcass, which spawns where it fell.
		_follow = _corpse_near(_follow_last)
	if _follow != null:
		_follow_last = _follow.global_position
	return _follow

func _corpse_near(at: Vector3) -> Node3D:
	var best: Node3D = null
	var best_d: float = 9.0
	for n: Node in get_tree().get_nodes_in_group("corpse"):
		var c := n as Node3D
		if c == null or c.is_queued_for_deletion():
			continue
		var d: float = Vector2(c.global_position.x - at.x, c.global_position.z - at.z).length_squared()
		if d < best_d:
			best_d = d
			best = c
	return best

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		match mb.button_index:
			MOUSE_BUTTON_RIGHT:
				_right_held = mb.pressed
				Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if _right_held else Input.MOUSE_MODE_VISIBLE
			MOUSE_BUTTON_MIDDLE:
				_middle_held = mb.pressed
			MOUSE_BUTTON_WHEEL_UP:
				if mb.pressed:
					_goal_distance = clampf(_goal_distance * 0.88, MIN_DIST, MAX_DIST)
			MOUSE_BUTTON_WHEEL_DOWN:
				if mb.pressed:
					_goal_distance = clampf(_goal_distance / 0.88, MIN_DIST, MAX_DIST)
	elif event is InputEventMouseMotion:
		var mm := event as InputEventMouseMotion
		if _right_held:
			_goal_yaw -= mm.relative.x * mouse_sensitivity
			_goal_pitch = clampf(_goal_pitch - mm.relative.y * mouse_sensitivity, MIN_PITCH, MAX_PITCH)
		elif _middle_held:
			_follow = null
			var k: float = _goal_distance * 0.0016
			_goal_target += (_flat_right() * -mm.relative.x + _flat_forward() * mm.relative.y) * k
	elif event is InputEventPanGesture:
		var pg := event as InputEventPanGesture
		_goal_distance = clampf(_goal_distance * (1.0 + pg.delta.y * 0.05), MIN_DIST, MAX_DIST)
	elif event is InputEventMagnifyGesture:
		var mg := event as InputEventMagnifyGesture
		_goal_distance = clampf(_goal_distance / mg.factor, MIN_DIST, MAX_DIST)

func _flat_forward() -> Vector3:
	return Vector3(-sin(_goal_yaw), 0.0, -cos(_goal_yaw))

func _flat_right() -> Vector3:
	return Vector3(cos(_goal_yaw), 0.0, -sin(_goal_yaw))

func _process(_delta: float) -> void:
	var now := Time.get_ticks_usec()
	var dt: float = 0.016 if _last_usec == 0 else clampf(float(now - _last_usec) / 1000000.0, 0.0, 0.1)
	_last_usec = now
	var typing := get_viewport().gui_get_focus_owner() is LineEdit
	var dir := Vector3.ZERO
	if not typing:
		if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
			dir += _flat_forward()
		if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
			dir -= _flat_forward()
		if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
			dir -= _flat_right()
		if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
			dir += _flat_right()
		if Input.is_key_pressed(KEY_Q):
			_goal_yaw += 1.6 * dt
		if Input.is_key_pressed(KEY_E):
			_goal_yaw -= 1.6 * dt
	if dir != Vector3.ZERO:
		_follow = null
		_goal_target += dir.normalized() * pan_speed * dt * clampf(_goal_distance / 60.0, 0.4, 1.6)
	var f := following()
	if f != null and f.is_inside_tree():
		# Track where the creature is drawn (its smoothed path), not its raw
		# position, which jumps between staggered thinks.
		var at: Vector3 = f.global_position
		var d = f.get("_data")
		if d != null and d.has_shown:
			at = d.shown
		_goal_target = Vector3(at.x, 0.0, at.z)
	var flat := Vector2(_goal_target.x, _goal_target.z)
	if flat.length() > BOUND:
		flat = flat.normalized() * BOUND
		_goal_target = Vector3(flat.x, 0.0, flat.y)
	var k: float = 1.0 - exp(-EASE * dt)
	target = target.lerp(_goal_target, k)
	yaw = lerpf(yaw, _goal_yaw, k)
	pitch = lerpf(pitch, _goal_pitch, k)
	distance = lerpf(distance, _goal_distance, k)
	_apply()

const CLEARANCE: float = 2.5
var _director: SimulationDirector = null

func _ground(x: float, z: float) -> float:
	if _director == null or not is_instance_valid(_director):
		var scene := get_tree().current_scene if is_inside_tree() else null
		_director = scene.get_node_or_null("World") as SimulationDirector if scene != null else null
	return 0.0 if _director == null else _director.ground_height(x, z)

func _apply() -> void:
	var focus := Vector3(target.x, _ground(target.x, target.z), target.z)
	var offset := Vector3(0.0, 0.0, distance).rotated(Vector3.RIGHT, pitch).rotated(Vector3.UP, yaw)
	var pos := focus + offset
	# Never dip below the terrain: rise over slopes, peaks and the river bank.
	var floor_y: float = _ground(pos.x, pos.z) + CLEARANCE
	var mid := focus.lerp(pos, 0.5)
	floor_y = maxf(floor_y, _ground(mid.x, mid.z) + CLEARANCE * 0.5)
	if pos.y < floor_y:
		pos.y = floor_y
	global_position = pos
	if pos.distance_squared_to(focus) > 0.01 and absf((focus - pos).normalized().y) < 0.999:
		look_at(focus, Vector3.UP)
	else:
		rotation = Vector3(pitch, yaw, 0.0)

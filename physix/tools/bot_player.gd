class_name BotPlayer
extends Node

# Automated gameplay bot for Physix smoke tests.
# Attaches to a GameLevel node and simulates inputs via Input.parse_input_event().

@export var duration: float = 60.0
@export var log_interval: float = 0.25

var _player: RigidBody3D
var _level: Node
var _elapsed: float = 0.0
var _log_timer: float = 0.0
var _log_file: FileAccess
var _finished: bool = false
var _intro_done: bool = false
var _jump_cooldown: float = 0.0
var _stuck_timer: float = 0.0
var _last_pos: Vector3

# Lookahead ray for gap detection
var _gap_ray: RayCast3D
var _fwd_ray: RayCast3D

func _ready() -> void:
	_level = get_parent()
	# Wait for the intro fact + countdown before taking control
	await get_tree().create_timer(4.0).timeout
	_intro_done = true
	_player = _level.get_node_or_null("Player")
	if _player == null:
		push_error("BotPlayer: No Player node found!")
		_finish("NO_PLAYER")
		return

	# Connect to level signals
	if _level.has_signal("level_completed"):
		_level.level_completed.connect(_on_level_completed)
	if _level.has_signal("level_failed"):
		_level.level_failed.connect(_on_level_failed)
	_player.died.connect(_on_player_died)

	# Setup lookahead rays
	_setup_rays()

	var log_path := _get_log_path()
	_log_file = FileAccess.open(log_path, FileAccess.WRITE)
	_log("BOT_START", "level=%s duration=%.1f" % [_level.name, duration])
	_last_pos = _player.global_position


func _setup_rays() -> void:
	_gap_ray = RayCast3D.new()
	_gap_ray.name = "BotGapRay"
	_gap_ray.target_position = Vector3(0.0, -8.0, -8.0)
	_gap_ray.collide_with_areas = false
	_gap_ray.enabled = true
	_player.add_child(_gap_ray)

	_fwd_ray = RayCast3D.new()
	_fwd_ray.name = "BotFwdRay"
	_fwd_ray.target_position = Vector3(0.0, -0.5, -6.0)
	_fwd_ray.collide_with_areas = false
	_fwd_ray.enabled = true
	_player.add_child(_fwd_ray)


func _get_log_path() -> String:
	for arg in OS.get_cmdline_args():
		if arg.begins_with("--bot-log="):
			return arg.substr(10)
	return ProjectSettings.globalize_path("user://bot_test_log.txt")


func _process(delta: float) -> void:
	if not _intro_done or _finished or _player == null:
		return

	_elapsed += delta
	_jump_cooldown = maxf(0.0, _jump_cooldown - delta)

	if _elapsed > duration:
		_finish("TIMEOUT")
		return

	# Stuck detection: if we haven't moved much in 3 seconds, bail
	var dist_moved := _last_pos.distance_to(_player.global_position)
	if dist_moved > 0.5:
		_stuck_timer = 0.0
		_last_pos = _player.global_position
	else:
		_stuck_timer += delta
		if _stuck_timer > 5.0:
			_finish("STUCK")
			return

	_decide_inputs(delta)

	_log_timer += delta
	if _log_timer >= log_interval:
		_log_timer = 0.0
		_log_state()


func _decide_inputs(delta: float) -> void:
	var pos := _player.global_position
	var vel := _player.linear_velocity
	var speed := vel.length()
	var on_ground: bool = _player.get("on_ground") if _player.get("on_ground") != null else false
	var max_speed: float = _player.get("max_forward_speed") if _player.get("max_forward_speed") != null else 24.0
	var max_jumps: int = _player.get("max_jumps") if _player.get("max_jumps") != null else 1
	var jump_count: int = _player.get("jump_count") if _player.get("jump_count") != null else 0

	# ── Steering: weighted sum of multiple goals ──
	var steer := 0.0
	var weights := 0.0

	# 1. Coin seeking
	var coin_force := _coin_steering(pos, vel)
	steer += coin_force * 1.2
	weights += 1.2

	# 2. Center / edge correction
	var edge_force := _edge_steering(pos)
	steer += edge_force * 1.5
	weights += 1.5

	# 3. Bumper avoidance
	var bumper_force := _bumper_steering(pos)
	steer += bumper_force * 2.0
	weights += 2.0

	# Normalize
	if weights > 0.0:
		steer = clampf(steer / weights, -1.0, 1.0)

	_send_action("steer_left", steer < 0, absf(steer))
	_send_action("steer_right", steer > 0, absf(steer))

	# ── Jump logic ──
	var should_jump := false

	# A) Gap ahead: ground ray says no track soon
	if _gap_ray and not _gap_ray.is_colliding() and on_ground and _jump_cooldown <= 0.0:
		should_jump = true
		_jump_cooldown = 0.5

	# B) Airborne and falling over a gap: double-jump
	if not on_ground and vel.y < -1.5 and jump_count < max_jumps and _jump_cooldown <= 0.0:
		should_jump = true
		_jump_cooldown = 0.3

	# C) Coin directly ahead but slightly elevated (rare in this game but helpful)
	var coin_ahead := _get_nearest_coin(pos, vel)
	if coin_ahead != null and on_ground and _jump_cooldown <= 0.0:
		var coin_local := _player.to_local(coin_ahead.global_position)
		if coin_local.y > 1.0 and coin_local.z < -2.0 and coin_local.z > -8.0:
			should_jump = true
			_jump_cooldown = 0.5

	if should_jump:
		_send_key(KEY_SPACE, true)
		_send_key(KEY_SPACE, false)

	# ── Speed control ──
	# Brake if going very fast and there are obstacles ahead, or track is narrow
	var braking := false
	var track_width := _estimate_track_width(pos)
	if speed > max_speed * 0.85 and track_width < 7.0 and on_ground:
		braking = true
	# Also brake if bumper is very close ahead
	var near_bumper := _get_nearest_bumper(pos)
	if near_bumper != null and on_ground:
		var b_local := _player.to_local(near_bumper.global_position)
		if b_local.z < -2.0 and b_local.z > -10.0 and speed > max_speed * 0.8:
			braking = true

	_send_action("brake", braking, 1.0)


# ── Steering helpers ──

func _coin_steering(pos: Vector3, vel: Vector3) -> float:
	var coin := _get_nearest_coin(pos, vel)
	if coin == null:
		return 0.0
	var to_coin := coin.global_position - pos
	var local := _player.to_local(coin.global_position)
	# Only chase coins that are ahead (z < 0 in local) and within 20 units
	if local.z > 3.0 or local.z < -20.0:
		return 0.0
	var desire := clampf(local.x / 4.0, -1.0, 1.0)
	return desire


func _get_nearest_coin(pos: Vector3, vel: Vector3) -> Node3D:
	var best: Node3D = null
	var best_score: float = 1e9
	for coin in get_tree().get_nodes_in_group("coins"):
		if not (coin is Area3D) or not coin.visible:
			continue
		var local := _player.to_local(coin.global_position)
		if local.z > 2.0:
			continue  # behind us
		var score := local.z * 0.3 + absf(local.x) * 0.2
		if score < best_score:
			best_score = score
			best = coin
	return best


func _edge_steering(pos: Vector3) -> float:
	var track_width := _estimate_track_width(pos)
	var half := track_width * 0.45
	if pos.x > half:
		return -1.0
	elif pos.x < -half:
		return 1.0
	else:
		# Soft center bias
		return -pos.x / half * 0.3


func _bumper_steering(pos: Vector3) -> float:
	var bumper := _get_nearest_bumper(pos)
	if bumper == null:
		return 0.0
	var local := _player.to_local(bumper.global_position)
	if local.z > 2.0 or local.z < -12.0:
		return 0.0
	# Steer away from bumper's x
	var away := -signf(local.x)
	var urgency := 1.0 - clampf(absf(local.z) / 12.0, 0.0, 1.0)
	return away * urgency


func _get_nearest_bumper(pos: Vector3) -> Node3D:
	var best: Node3D = null
	var best_dist: float = 1e9
	for node in get_tree().get_nodes_in_group("obstacles"):
		if not node.name.begins_with("Bumper"):
			continue
		var d := pos.distance_to(node.global_position)
		if d < best_dist:
			best_dist = d
			best = node
	return best


func _estimate_track_width(pos: Vector3) -> float:
	# Heuristic: get narrowest segment near our z position
	var track_root := _level.get_node_or_null("TrackRoot")
	if track_root == null:
		return 8.0
	var best_w: float = 10.0
	for child in track_root.get_children():
		if not child.name.begins_with("Seg_"):
			continue
		var z: float = (child as Node3D).global_position.z
		if absf(z - pos.z) < 15.0:
			for mesh in child.get_children():
				if mesh is MeshInstance3D and mesh.name == "SegMesh":
					var box: BoxMesh = mesh.mesh
					if box != null:
						best_w = minf(best_w, box.size.x)
	return best_w


# ── Input helpers ──

func _send_action(action: String, pressed: bool, strength: float = 1.0) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = pressed
	ev.strength = strength if pressed else 0.0
	Input.parse_input_event(ev)


func _send_key(keycode: int, pressed: bool) -> void:
	var ev := InputEventKey.new()
	ev.keycode = keycode
	ev.pressed = pressed
	Input.parse_input_event(ev)


# ── Logging ──

func _log_state() -> void:
	if _player == null:
		return
	var pos := _player.global_position
	var vel := _player.linear_velocity
	var on_ground: bool = _player.get("on_ground") if _player.get("on_ground") != null else false
	var coins: int = 0
	if Engine.has_singleton("GameManager"):
		coins = GameManager.level_coins if GameManager.get("level_coins") != null else 0
	_log("STATE", "t=%.2f pos=(%.2f,%.2f,%.2f) vel=%.2f ground=%s coins=%d" % [
		_elapsed, pos.x, pos.y, pos.z, vel.length(), on_ground, coins
	])


func _log(event: String, data: String) -> void:
	if _log_file:
		_log_file.store_line("[%s] %s: %s" % [Time.get_datetime_string_from_system(), event, data])


func _finish(reason: String) -> void:
	if _finished:
		return
	_finished = true
	_log("BOT_FINISH", "reason=%s elapsed=%.2f" % [reason, _elapsed])
	if _log_file:
		_log_file.close()
	get_tree().quit()


func _on_level_completed(stars: int, time: float) -> void:
	_finish("COMPLETED stars=%d time=%.2f" % [stars, time])


func _on_level_failed() -> void:
	_finish("FAILED")


func _on_player_died() -> void:
	_log("EVENT", "player_died")

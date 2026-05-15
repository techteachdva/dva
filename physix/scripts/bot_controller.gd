extends Node

# BotController v3.0 — Momentum Economics Validator
# Attach as a child of the Player node.
#
# Design-aligned testing per CLAUDE.md v2.1:
# - Validates speed profiles (gaps must be preceded by downhill/boost)
# - Detects momentum cycles (Build-Up → Release → Rest)
# - Tests checkpoint viability (respawn with enough speed to continue)
# - Breaks pots with momentum (speed ≥ 8 m/s, not just slam)
# - Measures flow state (boredom / flow / frustration / anxiety)
# - Reports structured JSON for iterative level refinement

@export var look_ahead: float = 22.0
@export var gap_detect_dist: float = 10.0
@export var steer_gain: float = 0.55
@export var replay_mode: bool = false
@export var record_mode: bool = false
@export var max_runs: int = 3  # test harness: how many runs
@export var validate_mode: bool = true  # collect metrics and report

var _player: RigidBody3D
var _track_segments: Array[StaticBody3D] = []
var _segment_meta: Array[Dictionary] = []
var _finish_pos: Vector3 = Vector3.ZERO
var _enabled: bool = false
var _jump_debounce: float = 0.0
var _jump_tap: bool = false
var _airborne_time: float = 0.0
var _slam_window: float = 0.0  # time we can still trigger slam

# ── Record / Replay ───────────────────────────────────────────────────────────
var _timeline: Array[Dictionary] = []
var _replay_index: int = 0
var _run_time: float = 0.0
var _run_best_time: float = INF
var _run_count: int = 0
var _run_successes: int = 0

# ── Surface detection ─────────────────────────────────────────────────────────
var _on_ice: bool = false
var _ice_timer: float = 0.0

# ── Validation Metrics (collected per run) ───────────────────────────────────
var _metrics: Dictionary = {}
var _speed_samples: Array[float] = []
var _death_positions: Array[Vector3] = []
var _checkpoint_respawn_times: Array[float] = []
var _pot_breaks: int = 0
var _spike_hits: int = 0
var _stuck_positions: Array[Vector3] = []
var _momentum_events: Array[Dictionary] = []  # {phase, z, speed}
var _gap_results: Array[Dictionary] = []  # {z, pre_speed, cleared}
var _hoop_clears: int = 0
var _total_hoops: int = 0
var _flow_state: String = "boredom"  # boredom|flow|frustration|anxiety
var _flow_time: Dictionary = {"boredom": 0.0, "flow": 0.0, "frustration": 0.0, "anxiety": 0.0}
var _obstacle_hits: Dictionary = {}  # {kind: count}

func _ready() -> void:
	_player = get_parent() as RigidBody3D
	if _player == null:
		push_error("BotController must be a child of a RigidBody3D (Player)")
		return
	await get_tree().create_timer(2.5).timeout
	_enabled = true
	_gather_track_info()
	_preprocess_segments()
	_total_hoops = get_tree().get_nodes_in_group("hoops").size()
	_connect_obstacle_signals()
	_connect_hoop_signals()
	if replay_mode and _timeline.is_empty():
		push_warning("Bot replay_mode enabled but no timeline loaded")

func _connect_obstacle_signals() -> void:
	for node in get_tree().get_nodes_in_group("obstacles"):
		if node.has_signal("obstacle_cleared"):
			if not node.obstacle_cleared.is_connected(_on_obstacle_cleared):
				node.obstacle_cleared.connect(_on_obstacle_cleared.bind(node))

func _connect_hoop_signals() -> void:
	for node in get_tree().get_nodes_in_group("hoops"):
		if node is Hoop:
			if not node.body_entered.is_connected(_on_hoop_body_entered):
				node.body_entered.connect(_on_hoop_body_entered)

func _on_obstacle_cleared(node: Node) -> void:
	if not validate_mode:
		return
	var kind: String = ""
	if node.has_method("get"):
		kind = node.get("obstacle_name")
	if kind == null or kind.is_empty():
		kind = node.name
	_obstacle_hits[kind] = _obstacle_hits.get(kind, 0) + 1
	# Specific tracking
	if node is SpikeTrap or node.name.begins_with("SpikeTrap"):
		_spike_hits += 1
	elif node.name.begins_with("BreakablePot"):
		_pot_breaks += 1

func _on_hoop_body_entered(body: Node3D) -> void:
	if body == _player:
		on_hoop_cleared()

func _gather_track_info() -> void:
	var root: Node = get_tree().current_scene
	if root == null:
		return
	_find_segments_recursive(root)
	_track_segments.sort_custom(func(a: Node, b: Node): return a.global_position.z > b.global_position.z)

func _find_segments_recursive(node: Node) -> void:
	if node is StaticBody3D and (node.name.begins_with("Seg_") or node.name == "MovingPlatform"):
		_track_segments.append(node)
	if node is Area3D and node.name == "FinishZone":
		_finish_pos = node.global_position
	for child: Node in node.get_children():
		_find_segments_recursive(child)

func _preprocess_segments() -> void:
	"""Build metadata for each segment: width, ice, ramp angle, gap ahead, y elevation."""
	for i: int in range(_track_segments.size()):
		var seg := _track_segments[i]
		var meta := _analyze_segment(seg)
		# Detect gap to next segment
		if i < _track_segments.size() - 1:
			var next := _track_segments[i + 1]
			var gap := seg.global_position.z - next.global_position.z
			var gap_size := absf(gap) - (_seg_meta_size(seg) + _seg_meta_size(next)) * 0.5
			meta["gap_to_next"] = gap_size
			meta["has_gap"] = gap_size > 2.0
			meta["next_y"] = next.global_position.y
		else:
			meta["gap_to_next"] = 0.0
			meta["has_gap"] = false
			meta["next_y"] = seg.global_position.y
		_segment_meta.append(meta)

func _analyze_segment(seg: StaticBody3D) -> Dictionary:
	var meta := {"ice": false, "width": 8.0, "ramp": 0.0, "y": seg.global_position.y}
	for child: Node in seg.get_children():
		if child is MeshInstance3D:
			if child.has_meta("mat_type") and child.get_meta("mat_type") == "ice":
				meta["ice"] = true
			var mesh: Mesh = child.mesh
			if mesh is BoxMesh:
				meta["width"] = mesh.size.x
		meta["ramp"] = seg.rotation.x
		meta["y"] = seg.global_position.y
	return meta

func _seg_meta_size(seg: StaticBody3D) -> float:
	for child: Node in seg.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			return child.mesh.size.z
	return 10.0

# ═══════════════════════════════════════════════════════════════════════════════
#  RECORD / REPLAY
# ═══════════════════════════════════════════════════════════════════════════════

func start_recording() -> void:
	_timeline.clear()
	record_mode = true
	replay_mode = false

func stop_recording() -> Array[Dictionary]:
	record_mode = false
	return _timeline.duplicate()

func load_timeline(tl: Array[Dictionary]) -> void:
	_timeline = tl.duplicate()
	_replay_index = 0
	replay_mode = true
	record_mode = false

func _record_input(t: float, steer: float, jump: bool, brake: bool) -> void:
	if _timeline.is_empty():
		_timeline.append({"t": t, "steer": steer, "jump": jump, "brake": brake})
		return
	var last := _timeline[-1]
	if absf(last["steer"] - steer) > 0.05 or last["jump"] != jump or last["brake"] != brake:
		_timeline.append({"t": t, "steer": steer, "jump": jump, "brake": brake})

func _replay_input(t: float) -> Dictionary:
	while _replay_index < _timeline.size() - 1 and _timeline[_replay_index + 1]["t"] <= t:
		_replay_index += 1
	if _replay_index < _timeline.size():
		return _timeline[_replay_index]
	return {"steer": 0.0, "jump": false, "brake": false}

# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN LOOP
# ═══════════════════════════════════════════════════════════════════════════════

func _physics_process(delta: float) -> void:
	if not _enabled or _player == null:
		return
	if _player.get("_dead") == true:
		return

	_run_time += delta
	_jump_debounce = maxf(0.0, _jump_debounce - delta)
	_ice_timer = maxf(0.0, _ice_timer - delta)
	_slam_window = maxf(0.0, _slam_window - delta)

	var pos: Vector3 = _player.global_position
	var vel: Vector3 = _player.linear_velocity
	var speed: float = vel.length()
	var on_ground: bool = _player.get("on_ground") if _player.get("on_ground") != null else true
	if on_ground:
		_airborne_time = 0.0
	else:
		_airborne_time += delta

	# Validation: record speed samples every frame
	if validate_mode and on_ground:
		_speed_samples.append(speed)
		_update_flow_state(delta, speed, pos)

	# Detect current surface
	_update_surface_state(pos)

	var steer: float = 0.0
	var jump: bool = false
	var brake: bool = false
	var slam: bool = false

	if replay_mode and not _timeline.is_empty():
		var replay := _replay_input(_run_time)
		steer = replay["steer"]
		jump = replay["jump"]
		brake = replay["brake"]
	else:
		# AI steering
		var target_x: float = _compute_target_x(pos)
		if target_x == INF:
			target_x = _finish_pos.x if _finish_pos != Vector3.ZERO else 0.0

		var dx: float = target_x - pos.x
		var effective_gain: float = steer_gain
		if _on_ice:
			effective_gain *= 0.35  # ice: much gentler steering
		effective_gain *= clampf(1.0 + absf(dx) * 0.15, 1.0, 2.2)
		var desired_vel_x: float = clampf(dx * effective_gain, -7.0, 7.0)
		steer = clampf((desired_vel_x - vel.x) * 0.45, -1.0, 1.0)
		if not on_ground:
			steer *= 1.3
		steer = clampf(steer, -1.0, 1.0)

		# Predictive jump using segment metadata + raycast fallback
		var jump_data: Dictionary = _predict_jump(pos, vel, target_x)
		var time_to_gap: float = jump_data.get("time_to_gap", 999.0)
		var should_jump: bool = jump_data["should_jump"] and time_to_gap > 0.0 and time_to_gap < 0.28
		# Ensure we have enough speed for the gap
		var required_speed: float = jump_data.get("required_speed", 0.0)
		if should_jump and speed < required_speed * 0.55:
			# Don't jump if too slow — try to build speed instead
			should_jump = false

		# Hoop-aware jump: mid/high hoops require clearing them in the air
		var hoop_jump_data: Dictionary = _predict_hoop_jump(pos, vel)
		if hoop_jump_data["should_jump"] and not should_jump:
			should_jump = true
			time_to_gap = hoop_jump_data.get("time_to_hoop", 999.0)

		jump = should_jump and on_ground and _jump_debounce == 0.0 and _airborne_time < 0.05
		if jump:
			_jump_debounce = 0.35
			if validate_mode:
				_gap_results.append({"z": pos.z, "pre_speed": speed, "cleared": false, "required": required_speed, "landed": false})

		# Auto-clear gaps when we land after a jump
		if validate_mode and on_ground and _airborne_time < 0.05 and not _gap_results.is_empty():
			for g in _gap_results:
				if not g["landed"] and pos.z < g["z"] - 2.0:
					g["landed"] = true
					g["cleared"] = true

		# Speed management: brake before sharp turns and narrow landings
		var off_target: bool = absf(dx) > 2.5
		var too_fast: bool = speed > 14.0
		var narrow_landing: bool = jump_data["landing_width"] < 7.0 and speed > 12.0
		brake = (off_target and too_fast) or narrow_landing

		# Slam: use when airborne and above ground with nearby enemies/pots
		if not on_ground and _slam_window <= 0.0 and _airborne_time > 0.15 and speed > 6.0:
			var has_target_below := _check_for_slam_target(pos)
			if has_target_below:
				slam = true
				_slam_window = 1.0  # cooldown

		# Pot targeting: at high speed, steer slightly toward pots for smash
		var pot_force := _pot_steering(pos, vel)
		if speed >= 8.0 and absf(pot_force) > 0.1:
			steer = clampf(steer + pot_force * 0.25, -1.0, 1.0)

	if record_mode:
		_record_input(_run_time, steer, jump, brake)

	# Apply inputs
	if steer < -0.12:
		Input.action_press("steer_left")
		Input.action_release("steer_right")
	elif steer > 0.12:
		Input.action_press("steer_right")
		Input.action_release("steer_left")
	else:
		Input.action_release("steer_left")
		Input.action_release("steer_right")

	if jump:
		Input.action_press("jump")
		_jump_tap = true
	elif _jump_tap:
		Input.action_release("jump")
		_jump_tap = false
	else:
		Input.action_release("jump")

	if brake:
		Input.action_press("brake")
	else:
		Input.action_release("brake")

	if slam:
		Input.action_press("brake")
	else:
		Input.action_release("brake")

# ═══════════════════════════════════════════════════════════════════════════════
#  PREDICTIVE SYSTEMS
# ═══════════════════════════════════════════════════════════════════════════════

func _update_surface_state(pos: Vector3) -> void:
	_on_ice = false
	for i: int in range(_track_segments.size()):
		var seg := _track_segments[i]
		var dz := seg.global_position.z - pos.z
		if absf(dz) < 6.0:
			if _segment_meta[i].get("ice", false):
				_on_ice = true
				_ice_timer = 0.2
				break
	if _ice_timer <= 0.0:
		_on_ice = false

func _compute_target_x(pos: Vector3) -> float:
	var weighted_x: float = 0.0
	var total_weight: float = 0.0
	for i: int in range(_track_segments.size()):
		var seg := _track_segments[i]
		var seg_pos: Vector3 = seg.global_position
		var dz := seg_pos.z - pos.z
		if dz < -look_ahead:
			continue
		var weight: float = 1.0 / (absf(dz) + 1.0)
		var width: float = _segment_meta[i].get("width", 8.0)
		if width < 7.0:
			weight *= 1.5
		weighted_x += seg_pos.x * weight
		total_weight += weight

	# Checkpoint / hoop seeking: strongly bias toward upcoming hoop x positions
	for node in get_tree().get_nodes_in_group("hoops"):
		if node is Hoop:
			var dz: float = node.global_position.z - pos.z
			if dz < -look_ahead or dz > 2.0:
				continue
			var dist: float = absf(dz) + 0.1
			var hoop_weight: float = 3.0 / dist  # strong bias, decays with distance
			weighted_x += node.global_position.x * hoop_weight
			total_weight += hoop_weight

	if total_weight > 0.0:
		return weighted_x / total_weight
	return INF

func _predict_jump(pos: Vector3, vel: Vector3, target_x: float) -> Dictionary:
	var result := {"should_jump": false, "landing_width": 20.0, "time_to_gap": 999.0, "required_speed": 0.0}
	var fwd_speed: float = maxf(absf(vel.z), 5.0)

	# 1. Segment-metadata prediction
	for i: int in range(_track_segments.size()):
		var seg := _track_segments[i]
		var seg_pos: Vector3 = seg.global_position
		var dz := seg_pos.z - pos.z
		if dz < -look_ahead:
			continue
		if _segment_meta[i].get("has_gap", false):
			var gap_z: float = seg_pos.z - _segment_meta[i].get("gap_to_next", 0.0) * 0.5
			var dist_to_gap: float = pos.z - gap_z
			if dist_to_gap > 0:
				result["time_to_gap"] = dist_to_gap / fwd_speed
				result["should_jump"] = true
				var gap_size: float = _segment_meta[i].get("gap_to_next", 0.0)
				result["required_speed"] = gap_size * 0.4 + 8.0  # heuristic
				if i + 1 < _track_segments.size():
					result["landing_width"] = _segment_meta[i + 1].get("width", 8.0)
				return result

	# 2. Raycast fallback
	var space_state := _player.get_world_3d().direct_space_state
	var from := pos + Vector3(0, 0.6, 0)
	var look_dist: float = clampf(fwd_speed * 0.4, 4.0, 16.0)
	var to_target := from + Vector3(target_x - pos.x, -2.5, -look_dist)
	var query := PhysicsRayQueryParameters3D.create(from, to_target)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	if space_state.intersect_ray(query).is_empty():
		var to_straight := from + Vector3(0, -2.5, -look_dist)
		var query2 := PhysicsRayQueryParameters3D.create(from, to_straight)
		query2.collide_with_areas = false
		query2.collide_with_bodies = true
		if space_state.intersect_ray(query2).is_empty():
			result["should_jump"] = true
			result["time_to_gap"] = look_dist / fwd_speed
			result["required_speed"] = look_dist * 0.4 + 8.0
			return result

	return result

func _predict_hoop_jump(pos: Vector3, vel: Vector3) -> Dictionary:
	"""Check for upcoming hoops that are above ground level and jump to clear them."""
	var result := {"should_jump": false, "time_to_hoop": 999.0}
	var fwd_speed: float = maxf(absf(vel.z), 3.0)
	for node in get_tree().get_nodes_in_group("hoops"):
		if node is Hoop and not node.passed:
			var hoop_pos: Vector3 = node.global_position
			var dz: float = hoop_pos.z - pos.z
			# Only look at hoops ahead of us, within lookahead distance
			if dz < -2.0 or dz > look_ahead:
				continue
			var dy: float = hoop_pos.y - pos.y
			# Ground hoops (dy <= 0.5) can be rolled through — no jump needed
			if dy <= 0.7:
				continue
			var time_to_hoop: float = absf(dz) / fwd_speed
			# Jump when we're 0.15–0.35 seconds away from the hoop
			if time_to_hoop > 0.0 and time_to_hoop < 0.35:
				result["should_jump"] = true
				result["time_to_hoop"] = time_to_hoop
				return result
	return result

func _check_for_slam_target(pos: Vector3) -> bool:
	"""Raycast downward to detect pots, bumpers, or enemies worth slamming."""
	var space_state := _player.get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(pos + Vector3.UP, pos + Vector3.DOWN * 6.0)
	query.collide_with_areas = true
	query.collide_with_bodies = false
	var result := space_state.intersect_ray(query)
	if not result.is_empty():
		var collider: Node = result.collider
		if collider != null and (collider.is_in_group("obstacles") or collider.name == "BreakablePot"):
			return true
	return false

func _pot_steering(pos: Vector3, vel: Vector3) -> float:
	"""If we're fast enough to break pots, steer toward the nearest one."""
	if vel.length() < 8.0:
		return 0.0
	var best: Node3D = null
	var best_score: float = 1e9
	for node in get_tree().get_nodes_in_group("obstacles"):
		if not node.is_in_group("obstacles"):
			continue
		if not node.name.begins_with("BreakablePot"):
			continue
		var local := _player.to_local(node.global_position)
		if local.z > 2.0 or local.z < -20.0:
			continue
		var score := absf(local.z) + absf(local.x) * 2.0
		if score < best_score:
			best_score = score
			best = node
	if best == null:
		return 0.0
	var local := _player.to_local(best.global_position)
	return clampf(local.x / 3.0, -1.0, 1.0)

# ═══════════════════════════════════════════════════════════════════════════════
#  FLOW STATE TRACKING
# ═══════════════════════════════════════════════════════════════════════════════

func _update_flow_state(delta: float, speed: float, pos: Vector3) -> void:
	# Classify current emotional state based on CLAUDE.md Flow Framework
	var prev := _flow_state
	var track_width := _get_current_track_width(pos)
	var near_obstacle := _get_nearest_obstacle_dist(pos) < 6.0
	var in_narrow := track_width <= 7.0
	var ramp := _get_current_ramp(pos)

	if in_narrow and near_obstacle and speed > 12.0:
		_flow_state = "anxiety"
	elif speed < 5.0 and (in_narrow or ramp > 1.0):
		_flow_state = "frustration"
	elif speed > 8.0 and not in_narrow and not near_obstacle:
		_flow_state = "flow"
	elif speed < 5.0 and not in_narrow and not near_obstacle:
		_flow_state = "boredom"

	_flow_time[_flow_state] += delta

	# Detect momentum cycle transitions using slope + speed
	# Thresholds tuned for slower physics (forward_push=4.5, speed_ramp_rate=0.45)
	if ramp > 0.3 and speed < 10.0:
		# Uphill build-up
		if _momentum_events.is_empty() or _momentum_events[-1]["phase"] != "build_up":
			_momentum_events.append({"phase": "build_up", "z": pos.z, "speed": speed, "ramp": ramp})
	elif ramp < -0.3 and speed > 8.0:
		# Downhill release
		if not _momentum_events.is_empty() and _momentum_events[-1]["phase"] == "build_up":
			_momentum_events.append({"phase": "release", "z": pos.z, "speed": speed, "ramp": ramp})

func _get_current_ramp(pos: Vector3) -> float:
	for i: int in range(_track_segments.size()):
		var dz := _track_segments[i].global_position.z - pos.z
		if absf(dz) < 6.0:
			return _segment_meta[i].get("ramp", 0.0)
	return 0.0

func _get_current_track_width(pos: Vector3) -> float:
	var best: float = 10.0
	for i: int in range(_track_segments.size()):
		var dz := _track_segments[i].global_position.z - pos.z
		if absf(dz) < 8.0:
			best = minf(best, _segment_meta[i].get("width", 10.0))
	return best

func _get_nearest_obstacle_dist(pos: Vector3) -> float:
	var best: float = 999.0
	for node in get_tree().get_nodes_in_group("obstacles"):
		if node is Area3D or node is StaticBody3D:
			best = minf(best, pos.distance_to(node.global_position))
	return best

# ═══════════════════════════════════════════════════════════════════════════════
#  TEST HARNESS API
# ═══════════════════════════════════════════════════════════════════════════════

func start_test_harness() -> void:
	"""Begin a multi-run test session. Call after level loads."""
	_run_count = 0
	_run_successes = 0
	_run_best_time = INF
	_run_time = 0.0
	max_runs = maxi(max_runs, 1)
	_reset_metrics()
	start_recording()

func _reset_metrics() -> void:
	_metrics = {}
	_speed_samples.clear()
	_death_positions.clear()
	_checkpoint_respawn_times.clear()
	_pot_breaks = 0
	_spike_hits = 0
	_stuck_positions.clear()
	_momentum_events.clear()
	_gap_results.clear()
	_hoop_clears = 0
	_flow_state = "boredom"
	_obstacle_hits.clear()
	for k in _flow_time.keys():
		_flow_time[k] = 0.0

func on_checkpoint_reached() -> void:
	if validate_mode:
		_checkpoint_respawn_times.append(_run_time)

func on_hoop_cleared() -> void:
	if validate_mode:
		_hoop_clears += 1

func on_pot_broken() -> void:
	if validate_mode:
		_pot_breaks += 1

func on_spike_hit() -> void:
	if validate_mode:
		_spike_hits += 1

func on_gap_cleared(z: float) -> void:
	if validate_mode:
		for g in _gap_results:
			if absf(g["z"] - z) < 5.0:
				g["cleared"] = true

func on_player_died(pos: Vector3) -> void:
	if validate_mode:
		_death_positions.append(pos)

func on_player_stuck(pos: Vector3) -> void:
	if validate_mode:
		_stuck_positions.append(pos)

func report_run_result(finished: bool, time_sec: float) -> void:
	"""Call from GameLevel when the bot finishes or dies."""
	_run_count += 1
	if finished:
		_run_successes += 1
		_run_best_time = minf(_run_best_time, time_sec)

	# Compile metrics for this run
	_metrics = _compile_metrics(finished, time_sec)
	_print_run_report(_run_count, finished, time_sec)

	if _run_count >= max_runs:
		stop_recording()
		_enabled = false
		_print_final_report()
	else:
		# Reset for next run
		_run_time = 0.0
		_timeline.clear()
		_replay_index = 0
		_reset_metrics()

func _compile_metrics(finished: bool, time_sec: float) -> Dictionary:
	var avg_speed: float = 0.0
	if not _speed_samples.is_empty():
		for s in _speed_samples:
			avg_speed += s
		avg_speed /= _speed_samples.size()

	var speed_cv: float = 0.0
	if _speed_samples.size() > 1:
		var mean := avg_speed
		var variance: float = 0.0
		for s in _speed_samples:
			var d := s - mean
			variance += d * d
		variance /= _speed_samples.size()
		if mean > 0.001:
			speed_cv = sqrt(variance) / mean

	var gap_success: int = 0
	var gap_total: int = _gap_results.size()
	for g in _gap_results:
		if g.get("cleared", false):
			gap_success += 1

	var momentum_cycles: int = 0
	var last_phase := ""
	for ev in _momentum_events:
		if ev["phase"] == "release" and last_phase == "build_up":
			momentum_cycles += 1
		last_phase = ev["phase"]

	return {
		"finished": finished,
		"time_sec": time_sec,
		"avg_speed": avg_speed,
		"speed_cv": speed_cv,
		"deaths": _death_positions.size(),
		"stuck_count": _stuck_positions.size(),
		"pot_breaks": _pot_breaks,
		"spike_hits": _spike_hits,
		"hoop_clears": _hoop_clears,
		"total_hoops": _total_hoops,
		"gap_success": gap_success,
		"gap_total": gap_total,
		"momentum_cycles": momentum_cycles,
		"flow_boredom": _flow_time.get("boredom", 0.0),
		"flow_flow": _flow_time.get("flow", 0.0),
		"flow_frustration": _flow_time.get("frustration", 0.0),
		"flow_anxiety": _flow_time.get("anxiety", 0.0),
		"death_positions": _death_positions,
		"momentum_events": _momentum_events,
		"speed_samples_count": _speed_samples.size(),
		"obstacle_hits": _obstacle_hits.duplicate(),
	}

func _print_run_report(run_idx: int, finished: bool, time_sec: float) -> void:
	print("=== Bot Run %d/%d ===" % [run_idx, max_runs])
	print("  Finished: %s | Time: %.2f" % [str(finished), time_sec])
	print("  Deaths: %d | Stuck: %d | Pots: %d | Spikes: %d | Hoops: %d/%d" % [
		_metrics.get("deaths", 0),
		_metrics.get("stuck_count", 0),
		_metrics.get("pot_breaks", 0),
		_metrics.get("spike_hits", 0),
		_metrics.get("hoop_clears", 0),
		_metrics.get("total_hoops", 0),
	])
	print("  Avg Speed: %.1f | Speed CV: %.2f | Gaps: %d/%d | Momentum Cycles: %d" % [
		_metrics.get("avg_speed", 0.0),
		_metrics.get("speed_cv", 0.0),
		_metrics.get("gap_success", 0),
		_metrics.get("gap_total", 0),
		_metrics.get("momentum_cycles", 0),
	])
	print("  Flow: boredom=%.1f flow=%.1f frustration=%.1f anxiety=%.1f" % [
		_metrics.get("flow_boredom", 0.0),
		_metrics.get("flow_flow", 0.0),
		_metrics.get("flow_frustration", 0.0),
		_metrics.get("flow_anxiety", 0.0),
	])
	var hits: Dictionary = _metrics.get("obstacle_hits", {})
	if not hits.is_empty():
		var parts: Array[String] = []
		for kind in hits.keys():
			parts.append("%s:%d" % [kind, hits[kind]])
		print("  Obstacles hit: %s" % ", ".join(parts))

func _print_final_report() -> void:
	print("\n========================================")
	print("=== Bot Test Final Report ===")
	print("Runs: %d | Successes: %d | Best Time: %.2f | Success Rate: %.0f%%" % [
		_run_count,
		_run_successes,
		_run_best_time if _run_best_time < INF else 0.0,
		float(_run_successes) / maxi(_run_count, 1) * 100.0,
	])
	# Validation checks against CLAUDE.md rules
	var issues: Array[String] = []
	if _metrics.get("gap_total", 0) > 0:
		var gap_rate := float(_metrics.get("gap_success", 0)) / float(_metrics.get("gap_total", 1))
		if gap_rate < 0.5:
			issues.append("gap_impossible")
	if _metrics.get("momentum_cycles", 0) < 2:
		issues.append("no_momentum_arc")
	if _metrics.get("flow_frustration", 0.0) > _metrics.get("flow_flow", 0.0) * 2.0:
		issues.append("too_frustrating")
	if _metrics.get("flow_anxiety", 0.0) > _run_time * 0.25:
		issues.append("too_anxious")
	if _metrics.get("stuck_count", 0) > 0:
		issues.append("bot_stuck")
	if _metrics.get("hoop_clears", 0) < _metrics.get("total_hoops", 6) * 0.5:
		issues.append("hoops_too_hard")

	if issues.is_empty():
		print("VALIDATION: PASS — No issues detected")
	else:
		print("VALIDATION: FAIL — Issues: %s" % ", ".join(issues))
	print("========================================\n")

	# Save JSON report for external analysis
	var report_path := "user://bot_report_%s.json" % Time.get_datetime_string_from_system().replace(":", "-")
	var file := FileAccess.open(report_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify({
			"runs": _run_count,
			"successes": _run_successes,
			"best_time": _run_best_time if _run_best_time < INF else -1.0,
			"metrics": _metrics,
			"issues": issues,
		}, "\t"))
		file.close()
		print("Report saved to: %s" % report_path)

func stop() -> void:
	_enabled = false
	Input.action_release("steer_left")
	Input.action_release("steer_right")
	Input.action_release("jump")
	Input.action_release("brake")

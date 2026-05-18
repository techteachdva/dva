extends Node3D

@export var level_name:   String = "Level"
@export var world_number: int    = 1
@export var level_number: int    = 1
@export var par_time:     float  = 45.0
@export var use_checkpoints: bool = true

var elapsed_time:   float   = 0.0
var is_running:     bool    = false
var checkpoint_pos: Vector3
var start_pos: Vector3

const CAM_BASE_FOV:       float   = 70.0
const CAM_MAX_FOV:        float   = 85.0
const CAM_BASE_OFFSET:    Vector3 = Vector3(0.0, 3.5, 14.0)
const CAM_MAX_OFFSET:     Vector3 = Vector3(0.0, 5.0, 20.0)
const CAM_BASE_LOOK:      Vector3 = Vector3(0.0, 0.0, -22.0)
const CAM_MAX_LOOK:       Vector3 = Vector3(0.0, 0.0, -35.0)
const CAM_SMOOTH:         float   = 9.0
const CAM_FOV_SMOOTH:     float   = 4.0

# Boost camera surge — temporary FOV spike and camera pullback
const BOOST_FOV_SURGE:    float   = 22.0
const BOOST_OFFSET_SURGE: Vector3 = Vector3(0.0, 0.0, -10.0)
const BOOST_LOOK_SURGE:   Vector3 = Vector3(0.0, 0.0, -18.0)
const BOOST_DECAY:        float   = 6.0

# Light speed surge — triggered when speed bar is nearly full
const LIGHT_FOV:          float   = 108.0
const LIGHT_OFFSET_SURGE: Vector3 = Vector3(0.0, 0.0, -14.0)
const LIGHT_LOOK_SURGE:   Vector3 = Vector3(0.0, 0.0, -28.0)
const LIGHT_ROLL_MAX:     float   = 0.12
const LIGHT_THRESHOLD:    float   = 0.92
const LIGHT_SMOOTH:       float   = 3.5

var _boost_surge: float = 0.0
var _light_speed: float = 0.0
var _smoothed_offset: Vector3 = CAM_BASE_OFFSET
var _smoothed_look: Vector3 = CAM_BASE_LOOK

@onready var player:        RigidBody3D = $Player
@onready var camera:        Camera3D    = $Camera3D
@onready var hud:           CanvasLayer = $HUD
var finish_zone:   Area3D      = null
@onready var respawn_timer: Timer       = $RespawnTimer

# Cached node lookups to avoid repeated recursive searches
var _coins_node: Node = null
var _coin_spin_meshes: Array[MeshInstance3D] = []

var _ghost_node: MeshInstance3D = null
var _coin_sparkle: GPUParticles3D = null
var _reduce_motion: bool = false

# Finale / sunset-roll state
var _in_finale: bool = false
var _finish_triggered: bool = false
var _finale_cam_pos: Vector3 = Vector3.ZERO
var _finale_look: Vector3 = Vector3.ZERO
var _finale_origin: Vector3 = Vector3.ZERO
var _finale_track_fwd: Vector3 = Vector3(0.0, 0.0, -1.0)
var _finale_track_up: Vector3 = Vector3.UP
var _track_root: Node3D = null
const FINALE_DURATION: float = 3.5
const FINALE_CAM_BACK: float = 16.0
const FINALE_CAM_UP: float = 5.5
const FINALE_LOOK_AHEAD: float = 380.0
const FINALE_PLANE_MARGIN: float = 10.0
const FINISH_LATERAL_RADIUS: float = 16.0

func _find_finish_zone() -> Area3D:
	var found := _find_node_recursive(self, "FinishZone")
	if found is Area3D:
		return found
	# Fallback: baked scenes may have renamed the Area3D, so look for
	# an Area3D containing a MeshInstance3D with finish metadata.
	for child: Node in _find_all_recursive(self):
		if child is Area3D:
			for sub: Node in child.get_children():
				if sub is MeshInstance3D and sub.get_meta("mat_type", "") == "finish":
					return child
	return null

signal level_completed(stars: int, time: float)
signal level_failed()

func _ready() -> void:
	start_pos = player.global_position
	checkpoint_pos = start_pos
	player.died.connect(_on_player_died)
	player.checkpoint_reached.connect(_on_checkpoint_reached)
	player.boosted.connect(_on_player_boosted)
	respawn_timer.timeout.connect(_on_respawn_timeout)
	GameManager.game_over.connect(_on_game_over)
	hud.pause_action.connect(_on_pause_action)
	# Snap camera to a sane starting position so it never starts far behind
	_smoothed_offset = CAM_BASE_OFFSET
	_smoothed_look = CAM_BASE_LOOK
	camera.global_position = start_pos + CAM_BASE_OFFSET
	camera.look_at(start_pos + CAM_BASE_LOOK, Vector3.UP)
	await get_tree().process_frame
	_track_root = get_node_or_null("TrackRoot") as Node3D
	finish_zone = _find_finish_zone()
	if finish_zone != null:
		if not finish_zone.body_entered.is_connected(_on_finish_entered):
			finish_zone.body_entered.connect(_on_finish_entered)
		finish_zone.monitoring = true
		finish_zone.collision_mask = 1
	_coins_node = _find_node_recursive(self, "Coins")
	_connect_coins()
	_cache_coin_spin_meshes()
	_setup_coin_sparkle()
	_reduce_motion = LevelManager.get_setting("reduce_motion", false)
	GameManager.start_level()
	_count_obstacles()
	_count_hoops()
	_spawn_catcher_rails()
	AudioManager.play_music("world_%d" % world_number)
	LevelVisuals.setup(self, world_number, _reduce_motion)
	# Re-apply track shaders after environment + material cache refresh
	preload("res://scripts/track_builder.gd")._apply_materials(self)
	_spawn_ghost()
	_show_physics_fact()
	_spawn_sky_sphere()

func _spawn_sky_sphere() -> void:
	var sky: Node = preload("res://scenes/sky_sphere.tscn").instantiate()
	sky.world_number = world_number
	sky.follow_target = player
	add_child(sky)

func _show_level_tutorial() -> void:
	_connect_tutorial_triggers()
	# Fallback tutorial hints for Level 1 of each world
	if level_number != 1:
		return
	var hint := ""
	match world_number:
		1:
			hint = "Welcome to Physix! Steer with LEFT/RIGHT, jump with SPACE. Collect every coin to earn 3 gold stars and unlock new worlds!"
		2:
			hint = "Friction Falls: once a glacier's highway, now a test of nerve. Ice patches remember every tremble — steer like you mean it."
		3:
			hint = "Gravity Gulch bends the rules. Purple = heavy, Cyan = light, Red = reverse, Yellow = zero G. Trust the fall."
		4:
			hint = "Momentum Mountain never stands still. Wind shoves, platforms drift, and hesitation is the only real enemy. Keep rolling."
		5:
			hint = "Quantum Peaks: every force you faced, gathered in one place. The mountain saved its best trick for last. Show it what you learned."
	if not hint.is_empty():
		hud.show_tutorial_hint(hint, 5.0)

func _connect_tutorial_triggers() -> void:
	for child: Node in get_children():
		_connect_tutorial_recursive(child)

func _connect_tutorial_recursive(node: Node) -> void:
	if node.has_signal("hint_triggered"):
		node.hint_triggered.connect(_on_tutorial_hint)
		node.hint_dismissed.connect(_on_tutorial_dismiss)
	for child: Node in node.get_children():
		_connect_tutorial_recursive(child)

func _on_tutorial_hint(text: String, duration: float) -> void:
	hud.show_tutorial_hint(text, duration)

func _on_tutorial_dismiss() -> void:
	hud.hide_tutorial_hint()

func _count_obstacles() -> void:
	GameManager.level_total_coins = _count_coins()
	GameManager.level_total_obstacles = get_tree().get_nodes_in_group("obstacles").size()

func _count_coins() -> int:
	if _coins_node == null:
		return 0
	var count := 0
	for child: Node in _coins_node.get_children():
		if child is Area3D:
			count += 1
	return count

func _count_hoops() -> void:
	var hoops := get_tree().get_nodes_in_group("hoops")
	var count := 0
	for hoop: Node in hoops:
		if hoop is Hoop:
			count += 1
	GameManager.set_total_hoops(count)

func _spawn_catcher_rails() -> void:
	# Invisible safety nets along track edges — segmented to avoid huge physics broadphase boxes.
	const HALF_WIDTH: float = 7.0
	const SEG_LEN: float = 80.0
	var track_root: Node = _find_node_recursive(self, "TrackRoot")
	if track_root == null:
		track_root = self
	var finish_z: float = finish_zone.global_position.z if finish_zone != null else start_pos.z - 200.0
	var track_len: float = clampf(absf(finish_z - start_pos.z) + 40.0, SEG_LEN, 480.0)
	var seg_count: int = maxi(int(ceilf(track_len / SEG_LEN)), 1)
	var mid_z: float = (start_pos.z + finish_z) * 0.5
	for side: int in [-1, 1]:
		var x_pos: float = side * (HALF_WIDTH + 0.8)
		for i: int in range(seg_count):
			var seg_z: float = mid_z - track_len * 0.5 + SEG_LEN * (float(i) + 0.5)
			var catcher := Area3D.new()
			catcher.name = "CatcherRail%s_%d" % ["L" if side == -1 else "R", i]
			catcher.position = Vector3(x_pos, -1.2, seg_z)
			catcher.gravity_space_override = Area3D.SPACE_OVERRIDE_DISABLED
			catcher.monitorable = false
			track_root.add_child(catcher)
			var shape := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(1.0, 4.0, SEG_LEN)
			shape.shape = box
			catcher.add_child(shape)
			catcher.body_entered.connect(_on_catcher_entered)

func _on_catcher_entered(body: Node3D) -> void:
	if body != player:
		return
	# Gentle redirect toward center with soft upward lift
	var push_x: float = -player.global_position.x * 0.8
	player.apply_central_impulse(Vector3(push_x, 3.5, 0.0))
	# Also kill lateral velocity to prevent repeated bounces
	player.linear_velocity.x *= 0.3


func _connect_coins() -> void:
	var coin_nodes: Array[Area3D] = []
	if _coins_node != null:
		for child: Node in _coins_node.get_children():
			if child is Area3D:
				coin_nodes.append(child)
	else:
		# Fallback: baked scenes may rename the Coins container, so
		# scan every descendant for Area3Ds whose name starts with "Coin".
		for child: Node in _find_all_recursive(self):
			if child is Area3D and child.name.begins_with("Coin"):
				coin_nodes.append(child)
	var idx := 0
	for coin: Area3D in coin_nodes:
		coin.add_to_group("coins")
		if level_number == 0:
			# Bonus levels: coins are one-time collectibles
			if LevelManager.is_coin_collected(world_number, level_number, idx):
				coin.visible = false
				coin.monitoring = false
			else:
				coin.body_entered.connect(_on_coin_collected.bind(coin, idx))
		else:
			# Main levels: coins respawn every run for easy grinding
			coin.visible = true
			coin.monitoring = true
			coin.body_entered.connect(_on_coin_collected.bind(coin, idx))
		idx += 1

func _find_node_recursive(root: Node, name_: String) -> Node:
	if root.name == name_:
		return root
	for child: Node in root.get_children():
		var found := _find_node_recursive(child, name_)
		if found != null:
			return found
	return null

func _find_all_recursive(root: Node) -> Array[Node]:
	var out: Array[Node] = [root]
	for child: Node in root.get_children():
		out.append_array(_find_all_recursive(child))
	return out

func _process(delta: float) -> void:
	_follow_camera(delta)
	_spin_coins(delta)
	if is_running and not _in_finale:
		_check_finish_plane_crossing()
	if is_running:
		elapsed_time += delta
		var steer := Input.get_axis("steer_left", "steer_right")
		var jumping := Input.is_action_pressed("jump")
		var braking := Input.is_action_pressed("brake")
		GhostManager.record_sample(
			player.global_position, player.global_basis.get_rotation_quaternion(),
			player.linear_velocity, steer, jumping, braking, player.is_dead(), delta
		)
		if _ghost_node != null:
			_ghost_node.update_time(elapsed_time)
		GameManager.add_speed_sample(player.linear_velocity.length())
		hud.update_timer(elapsed_time)
		hud.update_speed(player.linear_velocity.length(), player.max_forward_speed)
		hud.update_hoops(GameManager.level_hoops_passed, GameManager.level_total_hoops)

func _cache_coin_spin_meshes() -> void:
	_coin_spin_meshes.clear()
	var coin_nodes: Array[Node] = []
	if _coins_node != null:
		coin_nodes.assign(_coins_node.get_children())
	else:
		for child: Node in _find_all_recursive(self):
			if child is Area3D and child.name.begins_with("Coin"):
				coin_nodes.append(child)
	for child: Node in coin_nodes:
		if child is Area3D:
			for sub: Node in child.get_children():
				if sub is MeshInstance3D:
					_coin_spin_meshes.append(sub)
					break


func _spin_coins(delta: float) -> void:
	if _coin_spin_meshes.is_empty():
		return
	var spin := delta * 3.0
	for mesh: MeshInstance3D in _coin_spin_meshes:
		if is_instance_valid(mesh) and mesh.visible:
			mesh.rotate_y(spin)

func _follow_camera(delta: float) -> void:
	if _in_finale:
		# Sunset roll: behind the finish line, watching the ball roll down the runway
		_finale_look = _compute_finale_look()
		camera.fov = lerpf(camera.fov, 58.0, CAM_FOV_SMOOTH * delta)
		camera.global_position = camera.global_position.lerp(_finale_cam_pos, clampf(2.8 * delta, 0.0, 1.0))
		if camera.global_position.distance_squared_to(_finale_look) > 0.01:
			camera.look_at(_finale_look, _finale_track_up)
		return

	# Decay boost surge
	if _boost_surge > 0.0:
		_boost_surge = maxf(0.0, _boost_surge - BOOST_DECAY * delta)

	# Speed ratio: 0 = stopped, 1 = absolute max possible speed
	var fwd_speed := absf(player.linear_velocity.z)
	var max_possible: float = player.base_max_forward_speed * 1.6 * player._boost_mult
	var speed_ratio: float = clampf(fwd_speed / max_possible, 0.0, 1.0)
	# Non-linear curve: first 50% of max speed gets ~30% of the effect
	var curve: float = pow(speed_ratio, 1.7)

	# Light speed ramp: activates when speed bar is nearly full
	var light_target: float = 1.0 if speed_ratio >= LIGHT_THRESHOLD else 0.0
	_light_speed = lerpf(_light_speed, light_target, LIGHT_SMOOTH * delta)

	# Apply boost surge + light speed to FOV and camera offsets
	var surge_curve: float = pow(_boost_surge, 0.7)
	var light_curve: float = pow(_light_speed, 0.6)
	var target_fov: float = lerpf(CAM_BASE_FOV, CAM_MAX_FOV, curve)
	var target_offset := CAM_BASE_OFFSET.lerp(CAM_MAX_OFFSET, curve)
	var target_look := CAM_BASE_LOOK.lerp(CAM_MAX_LOOK, curve)
	if not _reduce_motion:
		target_fov += BOOST_FOV_SURGE * surge_curve
		# Light speed adds massive FOV zoom
		target_fov = lerpf(target_fov, LIGHT_FOV, light_curve)
		target_offset += BOOST_OFFSET_SURGE * surge_curve
		target_offset = target_offset.lerp(target_offset + LIGHT_OFFSET_SURGE, light_curve)
		target_look += BOOST_LOOK_SURGE * surge_curve
		target_look = target_look.lerp(target_look + LIGHT_LOOK_SURGE, light_curve)
	camera.fov = lerpf(camera.fov, target_fov, CAM_FOV_SMOOTH * delta)

	# Smooth offset independently so speed changes don't jolt the camera
	var offset_smooth_weight: float = clampf(3.2 * delta, 0.0, 1.0)
	_smoothed_offset = _smoothed_offset.lerp(target_offset, offset_smooth_weight)
	_smoothed_look = _smoothed_look.lerp(target_look, offset_smooth_weight)

	var target := player.global_position + _smoothed_offset
	var look_target := player.global_position + _smoothed_look
	# Camera position follow — slightly more responsive than offset smoothing
	var cam_weight: float = clampf(CAM_SMOOTH * delta, 0.0, 1.0)
	camera.global_position = camera.global_position.lerp(target, cam_weight)
	# Compose screenshake on top of follow position
	camera.global_position += CameraShaker.shake_offset
	# Guard look_at against singularity (camera too close to look target)
	if camera.global_position.distance_squared_to(look_target) > 0.01:
		camera.look_at(look_target, Vector3.UP)

func _spawn_ghost() -> void:
	if not GhostManager.has_ghost(world_number, level_number):
		return
	var g_data: Dictionary = GhostManager.load_ghost(world_number, level_number)
	var samples: Array[Dictionary] = []
	var raw: Variant = g_data.get("samples", [])
	if raw is Array:
		samples.assign(raw)
	if samples.is_empty():
		return
	var ghost := MeshInstance3D.new()
	ghost.name = "GhostBall"
	var mesh := SphereMesh.new()
	ghost.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.6, 1.0, 0.35)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.metallic = 0.4
	mat.roughness = 0.2
	mat.emission_enabled = true
	mat.emission = Color(0.1, 0.4, 0.9, 1.0)
	mat.emission_energy_multiplier = 1.2
	ghost.material_override = mat
	ghost.set_script(preload("res://scripts/ghost_ball.gd"))
	ghost.start_ghost(samples)
	add_child(ghost)
	_ghost_node = ghost

func _show_physics_fact() -> void:
	hud.show_intro(LevelManager.pop_next_fact())
	await hud.run_start_countdown()
	if not is_inside_tree():
		return
	hud.hide_intro()
	is_running = true
	GhostManager.start_recording()
	_show_level_tutorial()

func _track_forward_global() -> Vector3:
	if _track_root != null:
		var dir := -_track_root.global_transform.basis.z
		if dir.length_squared() > 0.0001:
			return dir.normalized()
	return Vector3(0.0, 0.0, -1.0)

func _track_up_global() -> Vector3:
	if _track_root != null:
		var up := _track_root.global_transform.basis.y
		if up.length_squared() > 0.0001:
			return up.normalized()
	return Vector3.UP

func _compute_finale_look() -> Vector3:
	# Down-track = where the ball rolls after the finish (into the runway / sunset).
	var horizon := _finale_origin + _finale_track_fwd * FINALE_LOOK_AHEAD
	var ball_lead := player.global_position + _finale_track_fwd * 18.0
	return ball_lead.lerp(horizon, 0.4)

func _setup_finale_camera() -> void:
	_finale_origin = finish_zone.global_position if finish_zone != null else player.global_position
	_finale_track_fwd = _track_forward_global()
	_finale_track_up = _track_up_global()
	# Camera sits just before the finish line (approach side), facing down-track.
	_finale_cam_pos = _finale_origin - _finale_track_fwd * FINALE_CAM_BACK + _finale_track_up * FINALE_CAM_UP
	_finale_look = _compute_finale_look()
	camera.global_position = _finale_cam_pos
	camera.look_at(_finale_look, _finale_track_up)

func _check_finish_plane_crossing() -> void:
	if _finish_triggered or _in_finale or finish_zone == null:
		return
	if _track_root == null:
		return
	var finish_local: Vector3 = _track_root.to_local(finish_zone.global_position)
	var player_local: Vector3 = _track_root.to_local(player.global_position)
	# Track forward is decreasing local Z (start near 0, finish negative).
	if player_local.z > finish_local.z + FINALE_PLANE_MARGIN:
		return
	var lateral := Vector2(player_local.x - finish_local.x, player_local.y - finish_local.y)
	if lateral.length() > FINISH_LATERAL_RADIUS:
		return
	_trigger_finish()

func _trigger_finish() -> void:
	if _finish_triggered or _in_finale or not is_running:
		return
	_on_finish_entered(player)

func _on_finish_entered(body: Node3D) -> void:
	if body != player or not is_running or _in_finale or _finish_triggered:
		return
	_finish_triggered = true
	is_running = false
	AudioManager.play_sfx("complete")
	GhostManager.stop_recording()

	# Sunset roll: lock camera; ball keeps physics and rolls down the runway
	_in_finale = true
	_setup_finale_camera()

	await get_tree().create_timer(FINALE_DURATION).timeout
	if not is_inside_tree():
		return

	# ── Calculate results after the dramatic roll ──
	var total_coins := GameManager.level_total_coins
	var stars := GameManager.calculate_star_rating()
	var rank := GameManager.calculate_rank(
		elapsed_time, GameManager.level_coins, total_coins,
		GameManager.level_obstacles_cleared, GameManager.level_total_obstacles, GameManager.level_deaths, par_time
	)

	# Report bot results
	var bot := _get_bot()
	if bot != null:
		bot.report_run_result(true, elapsed_time)

	var all_checkpoints := (
		GameManager.level_total_hoops <= 0
		or GameManager.level_hoops_passed >= GameManager.level_total_hoops
	)
	var previous_best := LevelManager.get_best_time(world_number, level_number)
	var personal_best := previous_best
	var is_new_fastest := false
	if all_checkpoints:
		is_new_fastest = LevelManager.set_best_time(world_number, level_number, elapsed_time)
		personal_best = LevelManager.get_best_time(world_number, level_number)
		if is_new_fastest:
			print("New fastest time for %d-%d: %.2f" % [world_number, level_number, elapsed_time])
			GhostManager.save_ghost(world_number, level_number, elapsed_time)
	LevelManager.complete_level(world_number, level_number, stars, rank)
	LevelManager.save_progress()
	if level_number == 0:
		LevelManager.complete_bonus(world_number)
	level_completed.emit(stars, elapsed_time)
	var breakdown := "Checkpoints: %d / %d" % [
		GameManager.level_hoops_passed, maxi(GameManager.level_total_hoops, 1)
	]
	if level_number == 0:
		breakdown += "\nCoins: %d / %d" % [GameManager.level_coins, maxi(total_coins, 1)]
	hud.show_level_complete(
		stars, elapsed_time, personal_best, rank, breakdown,
		is_new_fastest, previous_best, all_checkpoints
	)
	var action: String = await hud.level_complete_action
	match action:
		"retry":
			_restart_level(false)
		"world_map":
			Main.instance.load_world_map()
		"quit":
			get_tree().quit()

func _on_pause_action(action: String) -> void:
	match action:
		"retry":
			_restart_level(true)

func _restart_level(cost_life: bool = true) -> void:
	if cost_life:
		if not GameManager.try_spend_life_for_retry():
			return
	if world_number == 0:
		Main.instance.load_secret_level(world_number, level_number)
	elif level_number == 0:
		Main.instance.load_bonus_level(world_number)
	else:
		Main.instance.load_level(world_number, level_number)

func _on_player_boosted(_surge: float, _duration: float) -> void:
	_boost_surge = 1.0

func _on_player_died() -> void:
	if not is_running:
		return
	GhostManager.stop_recording()
	var bot := _get_bot()
	if bot != null:
		bot.on_player_died(player.global_position)
	is_running = false
	GameManager.lose_life()
	if GameManager.lives > 0:
		respawn_timer.start()

func _on_respawn_timeout() -> void:
	_reset_all_zones()
	player.reset_to(_get_respawn_pos())
	# Reset camera smoothing so it doesn't maintain a far offset after respawn
	_smoothed_offset = CAM_BASE_OFFSET
	_smoothed_look = CAM_BASE_LOOK
	camera.global_position = player.global_position + CAM_BASE_OFFSET
	is_running = true

func _reset_all_zones() -> void:
	for node: Node in get_tree().get_nodes_in_group("obstacles"):
		if node.has_method("_force_reset"):
			node._force_reset()

func _get_respawn_pos() -> Vector3:
	if use_checkpoints:
		var pos := checkpoint_pos
		# Raycast straight down to find the track surface so we never spawn
		# inside or below the floor. Also snap X to the segment centre in
		# case the checkpoint was placed off-track.
		var space_state := get_world_3d().direct_space_state
		var query := PhysicsRayQueryParameters3D.new()
		query.from = pos + Vector3.UP * 4.0
		query.to = pos + Vector3.DOWN * 10.0
		query.collision_mask = 1
		query.collide_with_areas = false
		var result := space_state.intersect_ray(query)
		if result.has("position"):
			var hit: Vector3 = result["position"]
			pos.y = hit.y + player.get_ball_radius() + 0.05
			var collider := result.get("collider", null) as Node3D
			if collider != null and collider.name.begins_with("Seg_"):
				pos.x = collider.position.x
		return pos
	return start_pos

func _on_checkpoint_reached(pos: Vector3) -> void:
	checkpoint_pos = pos
	if use_checkpoints and not GameManager.checkpoint_used:
		GameManager.checkpoint_used = true
	var bot := _get_bot()
	if bot != null:
		bot.on_checkpoint_reached()

func _get_bot() -> Node:
	var bot := player.get_node_or_null("BotController")
	if bot != null and bot.has_method("report_run_result"):
		return bot
	return null

func _on_game_over() -> void:
	is_running = false
	GhostManager.stop_recording()
	level_failed.emit()
	LevelManager.set_session_game_over(true)
	hud.show_game_over()
	AudioManager.stop_music()
	var action: String = await hud.game_over_action
	if not is_inside_tree():
		return
	match action:
		"world_map":
			Main.instance.load_world_map()
		_:
			Main.instance.load_main_menu()

func _on_coin_collected(body: Node3D, coin: Area3D, coin_index: int) -> void:
	if body != player or not coin.visible:
		return
	coin.visible = false
	if is_instance_valid(coin):
		coin.set_deferred("monitoring", false)
	GameManager.add_coin()
	LevelManager.collect_coin(world_number, level_number, coin_index)
	AudioManager.play_sfx("coin")
	_spawn_coin_sparkle(coin.global_position)

func _setup_coin_sparkle() -> void:
	_coin_sparkle = GPUParticles3D.new()
	_coin_sparkle.name = "CoinSparklePool"
	_coin_sparkle.amount = 10
	_coin_sparkle.lifetime = 0.35
	_coin_sparkle.one_shot = true
	_coin_sparkle.explosiveness = 0.9
	_coin_sparkle.emitting = false
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.15
	mat.direction = Vector3.UP
	mat.spread = 120.0
	mat.initial_velocity_min = 2.0
	mat.initial_velocity_max = 5.0
	mat.scale_min = 0.04
	mat.scale_max = 0.1
	mat.color = Color(1.0, 0.85, 0.1, 0.9)
	mat.gravity = Vector3(0.0, -8.0, 0.0)
	_coin_sparkle.process_material = mat
	var mesh := BoxMesh.new()
	mesh.size = Vector3(0.05, 0.05, 0.05)
	_coin_sparkle.draw_pass_1 = mesh
	add_child(_coin_sparkle)

func _spawn_coin_sparkle(pos: Vector3) -> void:
	if _coin_sparkle == null:
		return
	_coin_sparkle.global_position = pos
	_coin_sparkle.restart()
	_coin_sparkle.emitting = true

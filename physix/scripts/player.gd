extends RigidBody3D

# ── Tuning ────────────────────────────────────────────────────────────────────
@export var steer_force:       float = 38.0
@export var max_lateral_speed: float = 14.0
@export var jump_impulse:      float = 3.5
@export var jump_hold_force:   float = 60.0
@export var jump_hold_time_max: float = 0.10
@export var jump_max_velocity:  float = 10.5
@export var jump_release_mult:  float = 0.25
@export var jump_min_hold_time: float = 0.04
@export var jump_buffer_time:   float = 0.08
@export var forward_push:      float = 4.5
@export var max_forward_speed: float = 38.0
@export var coyote_time:       float = 0.12

# Gas pedal — throttle builds exponentially while W / Up is held
@export var throttle_rise_rate:  float = 3.8
@export var throttle_decay_rate: float = 2.6
@export var throttle_exponent: float = 2.15
@export var gas_force_scale:   float = 1.9
@export var ground_brake_drag: float = 4.2
@export var coast_drag_linear: float = 0.045
@export var coast_drag_quad:   float = 0.008
@export var coast_cap_decay:   float = 0.35

# Speed cap eases up with throttle (gas pedal), not passively over time
@export var speed_ramp_rate:   float = 0.45

# ── State ─────────────────────────────────────────────────────────────────────
var on_ground:    bool  = false
var jump_count:   int   = 0
var coyote_timer: float = 0.0
var _jump_held:    bool  = false
var _is_extending_jump: bool = false
var _jump_hold_timer: float = 0.0
var _jump_buffer_timer: float = 0.0
var max_jumps:  int   = 2

var base_max_forward_speed: float = 32.0
var base_forward_push:      float = 7.0
var speed_ramp_active:      bool  = true

var _dead: bool = false
var _gravity_tween: Tween = null
var _trail_mat: ParticleProcessMaterial = null
var _trail_speed_bucket: int = -1

# Boost state — temporary speed multiplier and camera surge trigger
var _boost_mult: float = 1.0
var _boost_timer: float = 0.0
var _throttle: float = 0.0

# Ice state — slippery, zippy, high-control surface
var _on_ice: bool = false
const ICE_STEER_MULT:     float = 1.7
const ICE_PUSH_MULT:      float = 1.45
const ICE_SPEED_MULT:     float = 1.25
const ICE_LATERAL_MULT:   float = 1.6
const ICE_DRAG_MULT:      float = 0.12
const ICE_FRICTION_THRESHOLD: float = 0.02

# Slam state machine — 4-phase AAA ground-pound
enum SlamState { NONE, WINDUP, DESCENT, IMPACT }
var _slam_state: SlamState = SlamState.NONE
var _slam_cooldown: float = 0.0
var _slam_windup_timer: float = 0.0
const SLAM_WINDUP:   float = 0.02
const SLAM_IMPULSE:  float = 24.0
const SLAM_BOUNCE:   float = 8.0
const SLAM_SUSTAIN:  float = 110.0
const BOOST_SPEED_MULT: float = 2.0
const BOOST_DURATION: float = 2.2

@onready var ball_mesh:           MeshInstance3D = $BallMesh
@onready var ground_ray:          RayCast3D      = $GroundRay
@onready var jump_particles:      GPUParticles3D = $JumpParticles
@onready var land_particles:      GPUParticles3D = $LandParticles
@onready var speed_trail:         GPUParticles3D = $SpeedTrail
@onready var slam_charge_parts:   GPUParticles3D = $SlamChargeParticles
@onready var slam_trail_parts:    GPUParticles3D = $SlamTrailParticles

signal died()
signal jumped()
signal landed()
signal checkpoint_reached(pos: Vector3)
signal reset()
signal boosted(surge: float, duration: float)

func _ready() -> void:
	add_to_group("player")
	contact_monitor       = true
	max_contacts_reported = 4
	can_sleep             = false
	gravity_scale         = 1.25
	ground_ray.add_exception(self)
	ground_ray.collide_with_areas = false
	base_max_forward_speed = max_forward_speed
	base_forward_push      = forward_push
	linear_velocity        = Vector3.ZERO
	angular_velocity       = Vector3.ZERO
	_apply_skin()
	_apply_material()
	if speed_trail != null and speed_trail.process_material is ParticleProcessMaterial:
		_trail_mat = speed_trail.process_material as ParticleProcessMaterial

func _apply_skin() -> void:
	var skin := LevelManager.get_equipped_skin()
	var mat := ball_mesh.material_override as StandardMaterial3D
	if mat == null:
		mat = ball_mesh.get_surface_override_material(0) as StandardMaterial3D
	if mat == null:
		return
	mat = mat.duplicate()
	ball_mesh.material_override = mat
	match skin:
		"skin_gold":
			mat.albedo_color = Color(1.0, 0.78, 0.05, 1.0)
			mat.emission     = Color(0.9, 0.65, 0.0, 1.0)
			mat.metallic     = 0.9
			mat.roughness    = 0.15
		"skin_neon":
			mat.albedo_color = Color(0.05, 0.95, 1.0, 1.0)
			mat.emission     = Color(0.0, 0.8, 0.9, 1.0)
			mat.metallic     = 0.3
			mat.roughness    = 0.1
		"skin_crystal":
			mat.albedo_color = Color(0.5, 0.75, 1.0, 0.65)
			mat.emission     = Color(0.3, 0.6, 1.0, 1.0)
			mat.metallic     = 0.1
			mat.roughness    = 0.02
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_:
			# Default orange ball
			mat.albedo_color = Color(1.0, 0.35, 0.0, 1.0)
			mat.emission     = Color(1.0, 0.2, 0.0, 1.0)
			mat.metallic     = 0.6
			mat.roughness    = 0.15

func _apply_material() -> void:
	var mat_id := LevelManager.get_equipped_material()
	if mat_id.is_empty():
		return
	var phys := PhysicsMaterial.new()
	match mat_id:
		"mat_rubber":
			phys.friction = 0.9
			phys.bounce   = 0.05
			mass          = 1.2
		"mat_metal":
			phys.friction = 0.35
			phys.bounce   = 0.15
			mass          = 2.0
		"mat_bouncy":
			phys.friction = 0.15
			phys.bounce   = 0.65
			mass          = 0.7
	physics_material_override = phys

func is_dead() -> bool:
	return _dead

func _in_level_finale() -> bool:
	var level := get_parent()
	return level != null and level.get("_in_finale") == true

func _should_freeze_physics() -> bool:
	var level := get_parent()
	if level == null:
		return false
	if level.get("_in_finale") == true:
		return false
	if level.get("is_running") != null:
		return not bool(level.is_running)
	return false

func _physics_process(delta: float) -> void:
	# Keep the ground ray pointing straight down regardless of ball rotation
	ground_ray.global_rotation = Vector3.ZERO
	ground_ray.force_raycast_update()

	if _should_freeze_physics():
		linear_velocity = Vector3.ZERO
		angular_velocity = Vector3.ZERO
		_throttle = 0.0
		return

	_update_ground(delta)
	_jump_buffer_timer = maxf(0.0, _jump_buffer_timer - delta)
	if not _in_level_finale():
		_handle_input()
	_update_throttle(delta)
	if _is_extending_jump:
		if _jump_held and linear_velocity.y > 0 and _jump_hold_timer < jump_hold_time_max:
			apply_central_force(Vector3(0.0, jump_hold_force, 0.0))
			if linear_velocity.y > jump_max_velocity:
				linear_velocity.y = jump_max_velocity
			_jump_hold_timer += delta
		else:
			_is_extending_jump = false
	_push_forward()
	_apply_lane_centering()
	_clamp_velocity()
	_spin_ball()
	_update_speed_trail()
	_death_check()
	# Air drag: gentle lateral damping so jumps still feel controllable
	if not on_ground:
		apply_central_force(Vector3(-linear_velocity.x * 0.6, 0.0, -linear_velocity.z * 0.3))
	# Boost decay
	if _boost_timer > 0.0:
		_boost_timer -= delta
		if _boost_timer <= 0.0:
			_boost_timer = 0.0
			_boost_mult = 1.0

	# Slam state machine
	match _slam_state:
		SlamState.WINDUP:
			_slam_windup_timer -= delta
			if _slam_windup_timer <= 0.0:
				_slam_state = SlamState.DESCENT
				# Rocket down
				if linear_velocity.y > 0.0:
					linear_velocity.y = 0.0
				apply_central_impulse(Vector3(0.0, -SLAM_IMPULSE, 0.0))
				slam_trail_parts.emitting = true
				# No stretch — ball stays round for snappy feel
		SlamState.DESCENT:
			# Cap slam descent velocity to prevent tunneling through thin floors
			if linear_velocity.y < -18.0:
				linear_velocity.y = -18.0
			# Proximity auto-impact: if ground is close, trigger impact immediately
			var space_state := get_world_3d().direct_space_state
			var query := PhysicsRayQueryParameters3D.create(global_position, global_position + Vector3.DOWN * 2.5)
			query.collide_with_areas = false
			query.exclude = [self.get_rid()]
			var result := space_state.intersect_ray(query)
			if not result.is_empty() and (global_position.y - result.position.y) < 1.2:
				_handle_slam_impact()
			elif not on_ground:
				apply_central_force(Vector3(0.0, -SLAM_SUSTAIN, 0.0))
			else:
				_handle_slam_impact()
		SlamState.IMPACT:
			# Impact is handled in _handle_slam_impact; state resets after tween
			pass

	# Slam cooldown
	if _slam_cooldown > 0.0:
		_slam_cooldown = maxf(0.0, _slam_cooldown - delta)

	# Gas raises the speed ceiling; releasing gas preserves momentum (cap never cuts speed instantly)
	if speed_ramp_active:
		var gas_cap: float = 1.0 + 0.55 * pow(_throttle, 1.35)
		var target_max: float = base_max_forward_speed * gas_cap * _boost_mult
		if _on_ice:
			target_max *= ICE_SPEED_MULT
		var ramp_rate: float = speed_ramp_rate * (0.35 + _throttle * 1.4)
		if _throttle > 0.04:
			max_forward_speed = move_toward(max_forward_speed, target_max, ramp_rate * delta * 2.2)
		else:
			var coast_dir := _forward_force_dir()
			var along_now: float = _forward_speed_along(coast_dir)
			var momentum_cap: float = maxf(base_max_forward_speed * _boost_mult, along_now)
			max_forward_speed = maxf(max_forward_speed, momentum_cap)
			max_forward_speed = move_toward(
				max_forward_speed,
				base_max_forward_speed * _boost_mult,
				coast_cap_decay * delta
			)
		forward_push = base_forward_push * (0.85 + 0.35 * _throttle) * _boost_mult

# ── Ground ────────────────────────────────────────────────────────────────────

func _update_ground(delta: float) -> void:
	var grounded := ground_ray.is_colliding()
	if grounded:
		_on_ice = _check_ice()
		if not on_ground:
			jump_count = 0
				# Slam impact: if we were slamming, explode off the ground
			if _slam_state == SlamState.DESCENT:
				_handle_slam_impact()
			else:
				# Buffered jump fires the instant we touch ground
				if _jump_buffer_timer > 0.0:
					_perform_jump()
					_jump_buffer_timer = 0.0
				land_particles.restart()
				CameraShaker.shake(0.10, 0.12)
				landed.emit()
				AudioManager.play_sfx("land")
		on_ground    = true
		coyote_timer = coyote_time
	else:
		on_ground    = false
		coyote_timer = maxf(0.0, coyote_timer - delta)
		_on_ice      = false

func _check_ice() -> bool:
	if not ground_ray.is_colliding():
		return false
	var collider := ground_ray.get_collider()
	if collider == null:
		return false
	if collider.physics_material_override != null:
		var mat: PhysicsMaterial = collider.physics_material_override
		return mat.friction < ICE_FRICTION_THRESHOLD
	return false

# ── Input ─────────────────────────────────────────────────────────────────────

func _perform_jump() -> void:
	global_position.y += 0.06
	linear_velocity.y = maxf(linear_velocity.y, jump_impulse)
	coyote_timer = 0.0
	jump_count  += 1
	_is_extending_jump = true
	_jump_hold_timer = 0.0
	jump_particles.restart()
	jumped.emit()
	AudioManager.play_sfx("jump")

func _handle_input() -> void:
	var dir := Input.get_axis("steer_left", "steer_right")
	if dir != 0.0:
		var force: float = steer_force
		if _on_ice:
			force *= ICE_STEER_MULT
		apply_central_force(Vector3(force * dir, 0.0, 0.0))

	# Slam: tap brake in the air (ground brake is handled in _push_forward)
	if Input.is_action_just_pressed("brake") and not on_ground and _slam_state == SlamState.NONE and _slam_cooldown <= 0.0:
		# Height guard: long raycast prevents slamming when too close to floor
		var space_state := get_world_3d().direct_space_state
		var query := PhysicsRayQueryParameters3D.create(global_position, global_position + Vector3.DOWN * 8.0)
		query.collide_with_areas = false
		query.exclude = [self.get_rid()]
		var result := space_state.intersect_ray(query)
		if result.is_empty() or (global_position.y - result.position.y) >= 1.0:
			_start_slam_windup()

	var was_holding := _jump_held
	var jump_held := Input.is_action_pressed("jump")
	var jump_now := Input.is_action_just_pressed("jump")
	_jump_held = jump_held

	# Buffer a jump press that lands while airborne
	if jump_now and not (coyote_timer > 0.0 or jump_count < max_jumps):
		_jump_buffer_timer = jump_buffer_time

	if jump_now or _jump_buffer_timer > 0.0:
		var can := coyote_timer > 0.0 or jump_count < max_jumps
		if can:
			_perform_jump()
			_jump_buffer_timer = 0.0

	# Early-release variable jump: only cut if the player tapped (very short hold)
	if was_holding and not jump_held and _is_extending_jump and linear_velocity.y > 0:
		if _jump_hold_timer < jump_min_hold_time:
			linear_velocity.y *= jump_release_mult
		_is_extending_jump = false

# ── Forward simulation ────────────────────────────────────────────────────────

func _is_accelerating() -> bool:
	return Input.is_action_pressed("accelerate")

func _update_throttle(delta: float) -> void:
	if _is_accelerating() and _slam_state == SlamState.NONE:
		var rise: float = 1.0 - exp(-throttle_rise_rate * delta)
		_throttle = lerpf(_throttle, 1.0, rise)
	else:
		var fall: float = 1.0 - exp(-throttle_decay_rate * delta)
		_throttle = lerpf(_throttle, 0.0, fall)

func _track_forward_dir() -> Vector3:
	var level := get_parent()
	if level != null:
		var track := level.get_node_or_null("TrackRoot") as Node3D
		if track != null:
			var dir := -track.global_transform.basis.z
			if dir.length_squared() > 0.0001:
				return dir.normalized()
	return Vector3(0.0, 0.0, -1.0)

func _forward_force_dir() -> Vector3:
	var force_dir := _track_forward_dir()
	if ground_ray.is_colliding():
		var normal: Vector3 = ground_ray.get_collision_normal()
		force_dir = (force_dir - normal * force_dir.dot(normal)).normalized()
	if force_dir.length_squared() < 0.0001:
		return _track_forward_dir()
	return force_dir

func _forward_speed_along(force_dir: Vector3) -> float:
	# Positive when rolling forward along the track (toward finish).
	return maxf(0.0, linear_velocity.dot(force_dir))

func _slope_push_multiplier() -> float:
	if not ground_ray.is_colliding():
		return 1.0
	var normal: Vector3 = ground_ray.get_collision_normal()
	var track_fwd := _track_forward_dir()
	var slope_boost := clampf(normal.dot(track_fwd) * 2.2, -0.40, 0.55)
	return 1.0 + slope_boost

func _push_forward() -> void:
	if _slam_state == SlamState.WINDUP or _slam_state == SlamState.DESCENT:
		return

	var force_dir := _forward_force_dir()

	# Sunset roll — keep rolling down the runway after the goal
	if _in_level_finale():
		var along_finale := _forward_speed_along(force_dir)
		if on_ground and along_finale < max_forward_speed * 0.85:
			apply_central_force(force_dir * forward_push * 1.1)
		return
	var along := _forward_speed_along(force_dir)
	var braking_on_ground := on_ground and Input.is_action_pressed("brake") and _slam_state == SlamState.NONE

	# Soft brake on the ground — gradual slowdown, no slam / no harsh reverse
	if braking_on_ground:
		apply_central_force(Vector3(-linear_velocity.x * 2.4, 0.0, 0.0))
		if along > 0.4:
			apply_central_force(-force_dir * along * ground_brake_drag)
		return

	# Gentle rolling resistance when coasting — ball keeps rolling, speed bleeds slowly
	if on_ground and _throttle < 0.05 and along > 0.35:
		var drag: float = coast_drag_linear + along * coast_drag_quad
		if _on_ice:
			drag *= ICE_DRAG_MULT
		apply_central_force(-force_dir * drag)

	# Gas pedal — exponential throttle curve
	if _throttle <= 0.01:
		return

	var gas: float = pow(_throttle, throttle_exponent)
	var push: float = forward_push * gas_force_scale * (0.12 + gas)
	push *= _slope_push_multiplier()
	if _on_ice:
		push *= ICE_PUSH_MULT
	var target_speed: float = max_forward_speed * (0.5 + 0.5 * gas)
	if _on_ice:
		target_speed *= ICE_SPEED_MULT
	if along < target_speed:
		apply_central_force(force_dir * push)

func _apply_lane_centering() -> void:
	# Disabled: lane centering removed to preserve player agency.
	# The player must manually steer to stay on the track.
	pass

func apply_speed_burst(strength: float, speed_mult: float = 1.85, duration: float = 2.0, lift_ratio: float = 0.22) -> void:
	var dir := _forward_force_dir()
	var impulse := dir * strength + Vector3.UP * strength * lift_ratio
	hit_boost(impulse, speed_mult, duration)

func hit_boost(impulse: Vector3, speed_mult: float = BOOST_SPEED_MULT, duration: float = BOOST_DURATION) -> void:
	apply_central_impulse(impulse)
	var dir := _forward_force_dir()
	var along: float = _forward_speed_along(dir)
	var impulse_along: float = maxf(0.0, impulse.dot(dir))
	var cap: float = max_forward_speed * speed_mult
	var target: float = clampf(maxf(along, impulse_along * 0.9) * 1.12, along, cap)
	if along < target:
		linear_velocity += dir * (target - along)
	_boost_mult = speed_mult
	_boost_timer = duration
	var surge: float = clampf(impulse.length() / 24.0, 0.55, 1.5)
	boosted.emit(surge, duration)
	AudioManager.play_sfx("boost")
	CameraShaker.shake(0.14, 0.2)
	ScreenFlash.flash_boost()

func _clamp_velocity() -> void:
	var lateral_cap: float = max_lateral_speed
	if _on_ice:
		lateral_cap *= ICE_LATERAL_MULT
	linear_velocity.x = clampf(linear_velocity.x, -lateral_cap, lateral_cap)
	var dir := _forward_force_dir()
	var along := _forward_speed_along(dir)
	var effective_max: float = max_forward_speed * _boost_mult
	if along > effective_max:
		linear_velocity -= dir * (along - effective_max)

# ── Visuals ───────────────────────────────────────────────────────────────────

func _spin_ball() -> void:
	ball_mesh.rotate_x(linear_velocity.z * -0.05)
	ball_mesh.rotate_z(linear_velocity.x * 0.05)

func _update_speed_trail() -> void:
	if speed_trail == null:
		return
	# Disable speed trail during slam phases
	if _slam_state == SlamState.WINDUP or _slam_state == SlamState.DESCENT:
		if speed_trail.emitting:
			speed_trail.emitting = false
		return
	var speed_ratio := clampf(absf(linear_velocity.z) / base_max_forward_speed, 0.0, 1.0)
	var should_emit := speed_ratio > 0.55 and on_ground
	if should_emit != speed_trail.emitting:
		speed_trail.emitting = should_emit
		if not should_emit:
			_trail_speed_bucket = -1
	if should_emit and _trail_mat != null:
		var bucket := int(speed_ratio * 10.0)
		if bucket != _trail_speed_bucket:
			_trail_speed_bucket = bucket
			var t := clampf((speed_ratio - 0.55) / 0.45, 0.0, 1.0)
			_trail_mat.color = Color(0.4 + t * 0.6, 0.9, 1.0, 0.3 + t * 0.3)
			_trail_mat.initial_velocity_min = 2.0 + t * 6.0
			_trail_mat.initial_velocity_max = 6.0 + t * 8.0

# ── Death ─────────────────────────────────────────────────────────────────────

const DEATH_Y := -50.0

func _death_check() -> void:
	if _dead or global_position.y >= DEATH_Y:
		return
	_dead = true
	AudioManager.play_sfx("death")
	CameraShaker.shake(0.25, 0.30)
	died.emit()

# ── External API ──────────────────────────────────────────────────────────────

func reach_checkpoint(pos: Vector3) -> void:
	checkpoint_reached.emit(pos)

func hit_spikes(_stun_duration: float) -> void:
	if _dead:
		return
	# Spikes punish speed rather than stopping you cold
	linear_velocity *= 0.35
	angular_velocity *= 0.35
	AudioManager.play_sfx("death")
	ScreenFlash.flash_damage()
	HitStop.freeze(0.08, 0.10)

func apply_physics_modifier(modifier: String, value: float) -> void:
	match modifier:
		"gravity_boost", "gravity_reduce", "gravity_reverse":
			if _gravity_tween != null:
				_gravity_tween.kill()
				_gravity_tween = null
			var target_scale: float = value
			if modifier == "gravity_reverse":
				target_scale = -absf(gravity_scale)
			_gravity_tween = create_tween().set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_QUAD)
			_gravity_tween.tween_property(self, "gravity_scale", target_scale, 0.3)
		"reset_gravity":
			if _gravity_tween != null:
				_gravity_tween.kill()
				_gravity_tween = null
			_gravity_tween = create_tween().set_ease(Tween.EASE_IN_OUT).set_trans(Tween.TRANS_QUAD)
			_gravity_tween.tween_property(self, "gravity_scale", 1.25, 0.3)
		"impulse_forward":
			apply_speed_burst(value, 1.85, 2.0, 0.2)
		"wind":
			apply_central_force(Vector3(value, 0.0, 0.0))

func get_ball_radius() -> float:
	var shape := $CollisionShape3D.shape as SphereShape3D
	if shape != null:
		return shape.radius
	return 0.5

# ── Slam System ───────────────────────────────────────────────────────────────

func _start_slam_windup() -> void:
	_slam_state = SlamState.WINDUP
	_slam_windup_timer = SLAM_WINDUP
	_slam_cooldown = 1.0
	# Cut upward velocity immediately
	if linear_velocity.y > 0.0:
		linear_velocity.y = 0.0
	# Charge particles — quick flash
	slam_charge_parts.restart()
	AudioManager.play_sfx("jump")

func _handle_slam_impact() -> void:
	_slam_state = SlamState.IMPACT
	jump_count = 0
	coyote_timer = coyote_time
	HitStop.freeze(0.02, 0.12)
	CameraShaker.shake(0.05, 0.08)
	ScreenFlash.flash_slam_impact()
	# Quick squash then snap back
	_tween_mesh_scale(Vector3(1.12, 0.78, 1.12), 0.03, Tween.TRANS_EXPO)
	# Bounce back up
	apply_central_impulse(Vector3(0.0, SLAM_BOUNCE, 0.0))
	# Particles
	jump_particles.restart()
	land_particles.restart()
	slam_trail_parts.emitting = false
	# Tiny shockwave
	if ground_ray.is_colliding():
		_spawn_shockwave(ground_ray.get_collision_point())
	# Instant snap back to round
	_tween_mesh_scale(Vector3(1.0, 1.0, 1.0), 0.05, Tween.TRANS_QUINT)
	_slam_state = SlamState.NONE
	landed.emit()
	AudioManager.play_sfx("jump")

func _tween_mesh_scale(target: Vector3, duration: float, trans: int = Tween.TRANS_BACK) -> void:
	if ball_mesh == null:
		return
	var tw := create_tween().set_ease(Tween.EASE_OUT).set_trans(trans)
	tw.tween_property(ball_mesh, "scale", target, duration)

func _spawn_shockwave(pos: Vector3) -> void:
	var ring := MeshInstance3D.new()
	ring.mesh = TorusMesh.new()
	ring.mesh.inner_radius = 0.2
	ring.mesh.outer_radius = 0.4
	ring.position = pos + Vector3.UP * 0.05
	ring.rotation.x = -PI * 0.5
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.9, 0.5, 0.8)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.8, 0.3, 1.0)
	mat.emission_energy_multiplier = 3.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = mat
	# Add to player's parent (the level) so the ring stays in world space
	var container: Node = get_parent() if get_parent() != null else self
	container.add_child(ring)
	# Expand and fade
	var tw := create_tween().set_parallel()
	tw.tween_property(ring, "scale", Vector3(2.0, 2.0, 1.0), 0.15).set_ease(Tween.EASE_OUT)
	tw.tween_property(mat, "albedo_color:a", 0.0, 0.12).set_delay(0.03)
	tw.tween_property(mat, "emission_energy_multiplier", 0.0, 0.12).set_delay(0.03)
	tw.chain().tween_callback(ring.queue_free)

func reset_to(pos: Vector3) -> void:
	reset.emit()
	global_position  = pos
	linear_velocity  = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	gravity_scale    = 1.25
	jump_count       = 0
	coyote_timer     = 0.0
	max_jumps        = 2
	_is_extending_jump = false
	_jump_hold_timer   = 0.0
	max_forward_speed = base_max_forward_speed
	forward_push      = base_forward_push
	_dead            = false
	_slam_state      = SlamState.NONE
	_slam_cooldown   = 0.0
	_slam_windup_timer = 0.0
	_throttle        = 0.0
	_boost_mult      = 1.0
	_boost_timer     = 0.0
	if ball_mesh != null:
		ball_mesh.scale = Vector3.ONE
	if slam_trail_parts != null:
		slam_trail_parts.emitting = false

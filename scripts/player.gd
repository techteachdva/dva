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

# Speed ramp: forward speed increases by this much per second while running
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

# Boost state — temporary speed multiplier and camera surge trigger
var _boost_mult: float = 1.0
var _boost_timer: float = 0.0

# Slam state machine — 4-phase AAA ground-pound
enum SlamState { NONE, WINDUP, DESCENT, IMPACT }
var _slam_state: SlamState = SlamState.NONE
var _slam_cooldown: float = 0.0
var _slam_windup_timer: float = 0.0
const SLAM_WINDUP:   float = 0.02
const SLAM_IMPULSE:  float = 24.0
const SLAM_BOUNCE:   float = 8.0
const SLAM_SUSTAIN:  float = 110.0
const BOOST_SPEED_MULT: float = 2.2
const BOOST_DURATION: float = 1.8

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
	_apply_skin()
	_apply_material()

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

var _stunned: bool = false
var _stun_timer: float = 0.0

func _physics_process(delta: float) -> void:
	if _stunned:
		_stun_timer -= delta
		if _stun_timer <= 0.0:
			_stunned = false
			if get_node_or_null("/root/CameraShaker") != null:
				CameraShaker.shake(0.22, 0.28)
			died.emit()
		return
	# Keep the ground ray pointing straight down regardless of ball rotation
	ground_ray.global_rotation = Vector3.ZERO
	ground_ray.force_raycast_update()
	_update_ground(delta)
	_jump_buffer_timer = maxf(0.0, _jump_buffer_timer - delta)
	_handle_input()
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

	# Speed ramp with exponential smoothing (Rolling Sky spring-inspired)
	if speed_ramp_active:
		var target_max: float = base_max_forward_speed * 1.6 * _boost_mult
		max_forward_speed = move_toward(max_forward_speed, target_max, speed_ramp_rate * delta * 2.0)
		forward_push      = move_toward(forward_push, base_forward_push * 1.15 * _boost_mult, speed_ramp_rate * delta * 0.4)

# ── Ground ────────────────────────────────────────────────────────────────────

func _update_ground(delta: float) -> void:
	var grounded := ground_ray.is_colliding()
	if grounded:
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
				if get_node_or_null("/root/CameraShaker") != null:
					CameraShaker.shake(0.10, 0.12)
				landed.emit()
				if get_node_or_null("/root/AudioManager") != null:
					AudioManager.play_sfx("land")
		on_ground    = true
		coyote_timer = coyote_time
	else:
		on_ground    = false
		coyote_timer = maxf(0.0, coyote_timer - delta)

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
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("jump")

func _handle_input() -> void:
	var dir := Input.get_axis("steer_left", "steer_right")
	if dir != 0.0:
		apply_central_force(Vector3(steer_force * dir, 0.0, 0.0))

	# Slam: press brake once while airborne and well above ground
	var slam_pressed := Input.is_action_just_pressed("brake")
	if slam_pressed and not on_ground and _slam_state == SlamState.NONE and _slam_cooldown <= 0.0:
		# Height guard: long raycast prevents slamming when too close to floor
		var space_state := get_world_3d().direct_space_state
		var query := PhysicsRayQueryParameters3D.create(global_position, global_position + Vector3.DOWN * 8.0)
		query.collide_with_areas = false
		query.exclude = [self.get_rid()]
		var result := space_state.intersect_ray(query)
		if result.is_empty() or (global_position.y - result.position.y) >= 1.0:
			_start_slam_windup()

	var was_holding := _jump_held
	var space_down := Input.is_key_pressed(KEY_SPACE)
	var up_down    := Input.is_key_pressed(KEY_UP)
	var action_held := Input.is_action_pressed("jump")
	var action_now := Input.is_action_just_pressed("jump")
	var jump_held  := action_held or space_down or up_down
	var jump_now   := action_now or ((space_down or up_down) and not was_holding)
	_jump_held = jump_held

	# Buffer a jump press that lands while airborne
	if action_now and not (coyote_timer > 0.0 or jump_count < max_jumps):
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

func _push_forward() -> void:
	# Slam is a dedicated vertical move — kill forward push so it feels like a ground-pound
	if _slam_state == SlamState.WINDUP or _slam_state == SlamState.DESCENT:
		return

	var brake_input := Input.is_action_pressed("brake") or Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN)
	var forward_input := Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP)
	var target_speed := max_forward_speed
	if brake_input:
		target_speed *= 0.35
		# Strong lateral friction + proper reverse drag for rapid braking
		if on_ground:
			apply_central_force(Vector3(-linear_velocity.x * 4.8, 0.0, 0.0))
			# Opposes forward motion (linear_velocity.z is negative when moving forward)
			if linear_velocity.z < 0.0:
				apply_central_force(Vector3(0.0, 0.0, -linear_velocity.z * 4.0))
			# Reverse: when nearly stopped, holding brake pushes backward slowly
			else:
				if linear_velocity.z >= -2.0:
					apply_central_force(Vector3(0.0, 0.0, forward_push * 0.45))

	var push := forward_push * (0.4 if brake_input else 1.0)
	if forward_input and not brake_input:
		push *= 1.35
	var force_dir := Vector3(0.0, 0.0, -1.0)

	# Slope-force compensation (from Slope/Trackmania research):
	# Project forward push onto the slope plane so the ball doesn't lose
	# momentum on uphill ramps or get pushed into the air on steep downhills.
	if ground_ray.is_colliding():
		var normal: Vector3 = ground_ray.get_collision_normal()
		force_dir = (force_dir - normal * force_dir.dot(normal)).normalized()
		# Downhill gravity assist: steeper downhill tilt = larger normal.z
		var slope_boost := clampf(normal.z * 2.2, -0.40, 0.55)
		push *= (1.0 + slope_boost)

	# Only add forward force if we're below the target speed along the slope
	var fwd_speed := -linear_velocity.dot(force_dir)
	if fwd_speed < target_speed:
		apply_central_force(force_dir * push)

func _apply_lane_centering() -> void:
	# Disabled: lane centering removed to preserve player agency.
	# The player must manually steer to stay on the track.
	pass

func hit_boost(impulse: Vector3, speed_mult: float = BOOST_SPEED_MULT, duration: float = BOOST_DURATION) -> void:
	apply_central_impulse(impulse)
	_boost_mult = speed_mult
	_boost_timer = duration
	boosted.emit(1.0, duration)
	if get_node_or_null("/root/ScreenFlash") != null:
		ScreenFlash.flash_boost()

func _clamp_velocity() -> void:
	linear_velocity.x = clampf(linear_velocity.x, -max_lateral_speed, max_lateral_speed)
	var effective_max: float = max_forward_speed * _boost_mult
	if linear_velocity.z < -effective_max:
		linear_velocity.z = -effective_max

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
	if should_emit:
		var mat := speed_trail.process_material as ParticleProcessMaterial
		if mat != null:
			var t := clampf((speed_ratio - 0.55) / 0.45, 0.0, 1.0)
			mat.color = Color(0.4 + t * 0.6, 0.9, 1.0, 0.3 + t * 0.3)
			mat.initial_velocity_min = 2.0 + t * 6.0
			mat.initial_velocity_max = 6.0 + t * 8.0

# ── Death ─────────────────────────────────────────────────────────────────────

const DEATH_Y := -50.0

func _death_check() -> void:
	if _dead or global_position.y >= DEATH_Y:
		return
	_dead = true
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("death")
	if get_node_or_null("/root/CameraShaker") != null:
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
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("death")
	if get_node_or_null("/root/ScreenFlash") != null:
		ScreenFlash.flash_damage()
		if get_node_or_null("/root/HitStop") != null:
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
			apply_central_impulse(Vector3(0.0, 0.0, -value))
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
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("jump")

func _handle_slam_impact() -> void:
	_slam_state = SlamState.IMPACT
	jump_count = 0
	coyote_timer = coyote_time
	# Micro impact freeze — barely perceptible
	if get_node_or_null("/root/HitStop") != null:
		HitStop.freeze(0.02, 0.12)
	# Tiny camera shake
	if get_node_or_null("/root/CameraShaker") != null:
		CameraShaker.shake(0.05, 0.08)
	# Barely-there flash
	if get_node_or_null("/root/ScreenFlash") != null:
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
	if get_node_or_null("/root/AudioManager") != null:
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
	_stunned         = false
	_stun_timer      = 0.0
	_dead            = false
	_slam_state      = SlamState.NONE
	_slam_cooldown   = 0.0
	_slam_windup_timer = 0.0
	if ball_mesh != null:
		ball_mesh.scale = Vector3.ONE
	if slam_trail_parts != null:
		slam_trail_parts.emitting = false

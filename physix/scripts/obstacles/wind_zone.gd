extends ObstacleBase
class_name WindZone

@export var wind_force:     float   = 14.0
@export var wind_direction: Vector3 = Vector3(1.0, 0.0, 0.0)
@export var gust_enabled:   bool    = true
@export var gust_interval:  float   = 2.5
@export var gust_strength:  float   = 15.0
@export var sway_speed:     float   = 0.8
@export var sway_amplitude: float   = 0.9

var player_inside: Node3D = null
var gust_timer:    float  = 0.0
var _player_ref_count: int = 0

var _sway_time: float = 0.0
var _particles: GPUParticles3D = null
var _process_mat: ParticleProcessMaterial = null

func _ready() -> void:
	super._ready()
	obstacle_name = "Wind Zone"
	one_shot      = false

	_particles = get_node_or_null("WindParticles")
	if _particles != null:
		_process_mat = ParticleProcessMaterial.new()
		_process_mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		_process_mat.emission_box_extents = Vector3(4.0, 1.5, 5.0)
		_process_mat.particle_flag_align_y = true
		_process_mat.direction = Vector3(1.0, 0.0, 0.0)
		_process_mat.spread = 5.0
		_process_mat.initial_velocity_min = 3.0
		_process_mat.initial_velocity_max = 7.0
		_process_mat.scale_min = 0.25
		_process_mat.scale_max = 0.7
		_process_mat.gravity = Vector3.ZERO
		_process_mat.color = Color(0.55, 0.88, 1.0, 0.6)

		var streak := BoxMesh.new()
		streak.size = Vector3(0.06, 0.06, 0.8)
		_particles.draw_pass_1 = streak
		_particles.process_material = _process_mat
		_particles.emitting = true

func _physics_process(delta: float) -> void:
	_sway_time += delta

	# Clean slow oscillation between left and right
	var sway := sin(_sway_time * sway_speed) * sway_amplitude

	var base_angle := atan2(wind_direction.x, wind_direction.z)
	var current_angle := base_angle + sway
	var current_dir := Vector3(sin(current_angle), 0.0, cos(current_angle)).normalized()

	# Update particles to blow along the current direction
	if _process_mat != null:
		_process_mat.direction = current_dir

	if player_inside == null:
		return

	player_inside.apply_central_force(current_dir * wind_force)
	if gust_enabled:
		gust_timer -= delta
		if gust_timer <= 0.0:
			gust_timer = gust_interval
			player_inside.apply_central_impulse(current_dir * gust_strength)

func _on_player_enter(player: Node3D) -> void:
	if _player_ref_count == 0:
		player_inside = player
		gust_timer    = gust_interval
	_player_ref_count += 1

func _on_player_exit(_player: Node3D) -> void:
	_player_ref_count = maxi(_player_ref_count - 1, 0)
	if _player_ref_count == 0:
		player_inside = null

func _force_reset() -> void:
	_player_ref_count = 0
	player_inside = null

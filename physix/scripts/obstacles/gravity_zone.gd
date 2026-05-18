extends ObstacleBase
class_name GravityZone

enum ZoneType { BOOST, REDUCE, REVERSE, ZERO }

@export var zone_type:          ZoneType = ZoneType.BOOST
@export var gravity_multiplier: float    = 3.5

const COLORS: Dictionary = {
	ZoneType.BOOST:   Color(1.0, 0.40, 0.10),
	ZoneType.REDUCE:  Color(0.20, 0.80, 1.0),
	ZoneType.REVERSE: Color(0.85, 0.20, 0.90),
	ZoneType.ZERO:    Color(0.90, 0.90, 0.20),
}
const LABELS: Dictionary = {
	ZoneType.BOOST:   "v HEAVY-G",
	ZoneType.REDUCE:  "^ LOW-G",
	ZoneType.REVERSE: "x2 ANTI-G",
	ZoneType.ZERO:    "O ZERO-G",
}

var _player_ref_count: int = 0
var _burst: GPUParticles3D = null
var _burst_mesh: SphereMesh = null

func _ready() -> void:
	super._ready()
	obstacle_name = "Gravity Zone"
	one_shot      = false
	# Tint the mesh so the player sees what kind of zone it is
	for child: Node in get_children():
		if child is MeshInstance3D:
			var mat := StandardMaterial3D.new()
			mat.albedo_color         = COLORS[zone_type]
			mat.albedo_color.a       = 0.12
			mat.transparency         = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.emission_enabled     = true
			mat.emission             = COLORS[zone_type]
			mat.emission_energy_multiplier = 1.5
			child.material_override  = mat
	_setup_burst()

func _setup_burst() -> void:
	_burst_mesh = SphereMesh.new()
	_burst_mesh.radius = 0.12
	_burst_mesh.height = 0.24
	_burst = GPUParticles3D.new()
	_burst.name = "ZoneBurst"
	_burst.emitting = false
	_burst.one_shot = true
	_burst.explosiveness = 1.0
	_burst.amount = 24
	_burst.lifetime = 0.6
	_burst.draw_pass_1 = _burst_mesh
	add_child(_burst)

func _on_player_enter(player: Node3D) -> void:
	if _player_ref_count == 0:
		var impulse := _entry_impulse(player)
		if impulse != Vector3.ZERO:
			player.apply_central_impulse(impulse)
		_spawn_burst(player.global_position)
		match zone_type:
			ZoneType.BOOST:   player.apply_physics_modifier("gravity_boost",   gravity_multiplier)
			ZoneType.REDUCE:  player.apply_physics_modifier("gravity_reduce",  1.0 / gravity_multiplier)
			ZoneType.REVERSE: player.apply_physics_modifier("gravity_reverse", 1.0)
			ZoneType.ZERO:    player.apply_physics_modifier("gravity_reduce",  0.0)
		AudioManager.play_sfx("jump")
	_player_ref_count += 1

func _on_player_exit(player: Node3D) -> void:
	_player_ref_count = maxi(_player_ref_count - 1, 0)
	if _player_ref_count == 0:
		player.apply_physics_modifier("reset_gravity", 1.0)
		_spawn_burst(player.global_position)

func _entry_impulse(_player: Node3D) -> Vector3:
	# Dramatic kick when entering a gravity zone
	match zone_type:
		ZoneType.BOOST:
			# Slam downward slightly
			return Vector3(0.0, -2.5, 0.0)
		ZoneType.REDUCE:
			# Float upward gently
			return Vector3(0.0, 2.0, 0.0)
		ZoneType.REVERSE:
			# Strong upward launch
			return Vector3(0.0, 6.0, 0.0)
		ZoneType.ZERO:
			# Gentle lift + forward push
			return Vector3(0.0, 3.0, -1.0)
	return Vector3.ZERO

func _spawn_burst(pos: Vector3) -> void:
	if _burst == null:
		return
	var mat := _burst.process_material as ParticleProcessMaterial
	if mat == null:
		mat = ParticleProcessMaterial.new()
		mat.direction = Vector3(0, 1, 0)
		mat.spread = 60.0
		mat.initial_velocity_min = 3.0
		mat.initial_velocity_max = 8.0
		mat.gravity = Vector3.ZERO
		_burst.process_material = mat
	mat.color = COLORS[zone_type]
	_burst.global_position = pos
	_burst.restart()
	_burst.emitting = true

func _force_reset() -> void:
	_player_ref_count = 0

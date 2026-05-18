extends ObstacleBase
class_name MagnetZone

enum MagnetType { ATTRACT, REPEL, SWITCH }

@export var magnet_type: MagnetType = MagnetType.ATTRACT
@export var strength:    float     = 20.0
@export var zone_length: float     = 60.0

const COLORS: Dictionary = {
	MagnetType.ATTRACT: Color(0.15, 0.35, 1.00),   # Deep blue
	MagnetType.REPEL:   Color(1.00, 0.15, 0.15),   # Bright red
	MagnetType.SWITCH:  Color(0.70, 0.10, 0.90),   # Purple
}

const FIELD_SHADER := preload("res://assets/shaders/magnetic_field.gdshader")

var _player_ref_count: int = 0
var _player_inside: Node3D = null
var _switch_timer: float = 0.0
var _switch_state: bool = true   # true = attract, false = repel

func _ready() -> void:
	super._ready()
	obstacle_name = "Magnet Zone"
	one_shot = false
	_switch_timer = 3.0
	_tint_mesh()
	_add_field_visual()

func _tint_mesh() -> void:
	var color: Color = COLORS[magnet_type]
	for child: Node in get_children():
		if child is MeshInstance3D:
			var mat := StandardMaterial3D.new()
			mat.albedo_color = color
			mat.emission_enabled = true
			mat.emission = color
			mat.emission_energy_multiplier = 1.5
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			mat.albedo_color.a = 0.35
			child.material_override = mat

func _add_field_visual() -> void:
	var width := 8.0
	var length := zone_length
	# Try to read actual collision shape size for accuracy
	for child: Node in get_children():
		if child is CollisionShape3D and child.shape is BoxShape3D:
			var box := child.shape as BoxShape3D
			width = box.size.x
			length = box.size.z
			break

	var mesh := MeshInstance3D.new()
	mesh.name = "FieldVisual"
	var plane := PlaneMesh.new()
	plane.size = Vector2(width, length)
	mesh.mesh = plane
	mesh.rotation.x = -PI / 2.0
	mesh.position.y = 0.08

	var mat := ShaderMaterial.new()
	mat.shader = FIELD_SHADER
	var col: Color = COLORS[magnet_type]
	mat.set_shader_parameter("ring_color", Color(col.r, col.g, col.b, 1.0))
	mesh.material_override = mat
	add_child(mesh)

func _physics_process(delta: float) -> void:
	if _player_inside == null:
		return
	var player: Node3D = _player_inside

	# Switch type alternates every 3 seconds
	if magnet_type == MagnetType.SWITCH:
		_switch_timer -= delta
		if _switch_timer <= 0.0:
			_switch_timer = 3.0
			_switch_state = not _switch_state

	var effective_attract: bool = true
	match magnet_type:
		MagnetType.ATTRACT: effective_attract = true
		MagnetType.REPEL:   effective_attract = false
		MagnetType.SWITCH:  effective_attract = _switch_state

	var to_center := (global_position - player.global_position)
	to_center.y = 0.0   # Keep force horizontal

	var dir := to_center.normalized()
	if not effective_attract:
		dir = -dir

	player.apply_central_force(dir * strength)

func _on_player_enter(player: Node3D) -> void:
	if _player_ref_count == 0:
		_player_inside = player
	_player_ref_count += 1

func _on_player_exit(_player: Node3D) -> void:
	_player_ref_count = maxi(_player_ref_count - 1, 0)
	if _player_ref_count == 0:
		_player_inside = null

func _force_reset() -> void:
	_player_ref_count = 0
	_player_inside = null

extends MeshInstance3D

@export var world_number: int = 1
@export var follow_target: Node3D = null

var _reduce_motion: bool = false

func _ready() -> void:
	_reduce_motion = LevelManager.get_setting("reduce_motion", false)
	var mat: ShaderMaterial = material_override as ShaderMaterial
	if mat == null:
		return
	LevelVisuals.configure_sky_material(mat, world_number, _reduce_motion)
	# Slightly lower poly on low-end / reduce-motion path
	if mesh is SphereMesh:
		var sphere := mesh as SphereMesh
		if _reduce_motion:
			sphere.radial_segments = 32
			sphere.rings = 16
		else:
			sphere.radial_segments = 48
			sphere.rings = 24

func _process(delta: float) -> void:
	if follow_target != null:
		global_position = follow_target.global_position
	if not _reduce_motion:
		rotate_y(delta * 0.015)

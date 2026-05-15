extends MeshInstance3D

const WORLD_COLORS := {
	1: Color(1.0, 0.55, 0.1),    # warm amber — beginner
	2: Color(0.2, 0.7, 1.0),      # ice blue
	3: Color(0.7, 0.2, 1.0),      # gravity purple
	4: Color(1.0, 0.2, 0.2),       # bumper red
	5: Color(0.2, 0.9, 0.6),      # wind teal
	6: Color(1.0, 0.9, 0.3),      # mastery gold
}

@export var world_number: int = 1
@export var follow_target: Node3D = null

func _ready() -> void:
	var mat: ShaderMaterial = material_override
	if mat == null:
		return
	var tint: Color = WORLD_COLORS.get(world_number, WORLD_COLORS[1])
	mat.set_shader_parameter("base_color", tint)

func _process(delta: float) -> void:
	if follow_target != null:
		global_position = follow_target.global_position
	# Slow independent rotation so lava blobs drift regardless of camera yaw
	if get_node_or_null("/root/LevelManager") != null and not LevelManager.get_setting("reduce_motion", false):
		rotate_y(delta * 0.015)

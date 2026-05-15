extends Area3D
class_name Checkpoint

var triggered: bool = false

@onready var flag_mesh: MeshInstance3D = $FlagMesh

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node3D) -> void:
	if triggered or not body.is_in_group("player"):
		return
	triggered = true
	if body.has_method("reach_checkpoint"):
		body.reach_checkpoint(global_position)
	GameManager.add_score(100)
	# Turn green when activated
	if flag_mesh:
		var mat := StandardMaterial3D.new()
		mat.albedo_color     = Color(0.1, 1.0, 0.3)
		mat.emission_enabled = true
		mat.emission         = Color(0.0, 0.8, 0.2)
		flag_mesh.material_override = mat

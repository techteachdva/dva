class_name Snowball
extends Node3D

# A thrown snowball: flies at its target and does exactly 1 damage.

const SPEED: float = 15.0
const DAMAGE: float = 1.0

var target: Node3D
var from: Vector3
var _aim: Vector3

func _ready() -> void:
	global_position = from
	var ball := MeshInstance3D.new()
	var mesh := SphereMesh.new()
	mesh.radius = 0.22
	mesh.height = 0.44
	ball.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.95, 0.98, 1.0)
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ball.material_override = mat
	add_child(ball)

func _process(delta: float) -> void:
	if target != null and is_instance_valid(target):
		_aim = target.global_position + Vector3.UP
	var to: Vector3 = _aim - global_position
	var step: float = SPEED * delta
	if to.length() <= step:
		if target != null and is_instance_valid(target):
			SeasonBook.hurt(target, DAMAGE)
			FXManager.show_floating_text(_aim, "-1", Color(0.75, 0.9, 1.0))
		queue_free()
		return
	global_position += to.normalized() * step

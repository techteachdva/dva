extends Area3D
class_name Hoop

enum HoopType { CHECKPOINT, BONUS }

@export var hoop_type: HoopType = HoopType.BONUS
@export var boost_strength: float = 28.0

var passed: bool = false

func _ready() -> void:
	add_to_group("hoops")
	body_entered.connect(_on_body_entered)
	if get_child_count() == 0:
		_build_visual()

func _build_visual() -> void:
	var shape := CollisionShape3D.new()
	shape.name = "HoopShape"
	var sphere := SphereShape3D.new()
	sphere.radius = 1.8
	shape.shape = sphere
	add_child(shape)

	var mesh := MeshInstance3D.new()
	mesh.name = "HoopMesh"
	var torus := TorusMesh.new()
	torus.inner_radius = 1.4
	torus.outer_radius = 1.8
	torus.ring_segments = 6
	mesh.mesh = torus
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 1.0, 0.2, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.0, 0.9, 0.0, 1.0)
	mat.emission_energy_multiplier = 2.0
	mesh.set_surface_override_material(0, mat)
	mesh.set_meta("mat_type", "checkpoint" if hoop_type == HoopType.CHECKPOINT else "boost")
	add_child(mesh)

func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if passed:
		return
	passed = true

	# All hoops give a significant forward speed boost
	if body.has_method("apply_physics_modifier"):
		body.apply_physics_modifier("impulse_forward", boost_strength)

	# Every hoop passed counts toward the 3-star requirement
	GameManager.pass_hoop()
	if hoop_type == HoopType.BONUS:
		GameManager.add_score(250)

	_flash()
	if get_node_or_null("/root/ScreenFlash") != null:
		ScreenFlash.flash_hoop()
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("coin")

func _flash() -> void:
	for child: Node in get_children():
		if child is MeshInstance3D:
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.2, 1.0, 0.2, 1.0)
			mat.emission_enabled = true
			mat.emission = Color(0.0, 0.9, 0.0, 1.0)
			mat.emission_energy_multiplier = 2.0
			child.material_override = mat

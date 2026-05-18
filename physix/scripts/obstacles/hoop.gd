extends Area3D
class_name Hoop

const HOOP_MAJOR_RADIUS := 1.8
const HOOP_MINOR_RADIUS := 0.225

@export var boost_strength: float = 28.0

var passed: bool = false

func _ready() -> void:
	add_to_group("hoops")
	body_entered.connect(_on_body_entered)
	if get_node_or_null("HoopMesh") == null:
		build_visuals()


func build_visuals() -> void:
	if get_node_or_null("HoopMesh") != null:
		return

	var shape := CollisionShape3D.new()
	shape.name = "HoopShape"
	var sphere := SphereShape3D.new()
	sphere.radius = HOOP_MAJOR_RADIUS
	shape.shape = sphere
	add_child(shape)

	var mesh := MeshInstance3D.new()
	mesh.name = "HoopMesh"
	mesh.mesh = build_hex_hoop_mesh(HOOP_MAJOR_RADIUS, HOOP_MINOR_RADIUS)
	mesh.set_meta("mat_type", "checkpoint")
	add_child(mesh)
	_apply_hoop_material(mesh)


func _apply_hoop_material(mesh_inst: MeshInstance3D) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 1.0, 0.2, 1.0)
	mat.emission = Color(0.0, 0.9, 0.0, 1.0)
	mat.emission_enabled = true
	mat.emission_energy_multiplier = 2.0
	mesh_inst.set_surface_override_material(0, mat)


static func build_hex_hoop_mesh(major_radius: float, minor_radius: float, ring_segments: int = 6, tube_segments: int = 8) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i: int in range(ring_segments):
		var theta0 := float(i) / float(ring_segments) * TAU
		var theta1 := float(i + 1) / float(ring_segments) * TAU
		for j: int in range(tube_segments):
			var phi0 := float(j) / float(tube_segments) * TAU
			var phi1 := float(j + 1) / float(tube_segments) * TAU
			var p00 := _torus_point(theta0, phi0, major_radius, minor_radius)
			var p10 := _torus_point(theta1, phi0, major_radius, minor_radius)
			var p11 := _torus_point(theta1, phi1, major_radius, minor_radius)
			var p01 := _torus_point(theta0, phi1, major_radius, minor_radius)

			st.set_normal((p00 - _torus_center(theta0, major_radius)).normalized())
			st.add_vertex(p00)
			st.set_normal((p10 - _torus_center(theta1, major_radius)).normalized())
			st.add_vertex(p10)
			st.set_normal((p11 - _torus_center(theta1, major_radius)).normalized())
			st.add_vertex(p11)

			st.set_normal((p00 - _torus_center(theta0, major_radius)).normalized())
			st.add_vertex(p00)
			st.set_normal((p11 - _torus_center(theta1, major_radius)).normalized())
			st.add_vertex(p11)
			st.set_normal((p01 - _torus_center(theta0, major_radius)).normalized())
			st.add_vertex(p01)
	var mesh := ArrayMesh.new()
	st.commit(mesh)
	return mesh


static func _torus_point(theta: float, phi: float, major: float, minor: float) -> Vector3:
	var rx := (major + minor * cos(phi)) * cos(theta)
	var ry := (major + minor * cos(phi)) * sin(theta)
	var rz := minor * sin(phi)
	return Vector3(rx, ry, rz)


static func _torus_center(theta: float, major: float) -> Vector3:
	return Vector3(major * cos(theta), major * sin(theta), 0.0)


func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if passed:
		return
	passed = true

	if body.has_method("apply_physics_modifier"):
		body.apply_physics_modifier("impulse_forward", boost_strength)

	GameManager.pass_hoop()
	if body.has_method("reach_checkpoint"):
		body.reach_checkpoint(global_position)
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("checkpoint")

	_flash()
	if get_node_or_null("/root/ScreenFlash") != null:
		ScreenFlash.flash_hoop()


func _flash() -> void:
	for child: Node in get_children():
		if child is MeshInstance3D:
			_apply_hoop_material(child)

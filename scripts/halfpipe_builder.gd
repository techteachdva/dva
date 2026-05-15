extends Node
class_name HalfpipeBuilder

# HalfpipeBuilder — procedural half-pipe segment generator for Physix
# A half-pipe is a semi-cylindrical trough: the ball sits at the bottom
# and rolls up/down the curved walls. Forward is -Z.

const TRACK_MAT_BUILDER := preload("res://scripts/track_builder.gd")

static func build_segment(radius: float, length: float, position: Vector3, parent: Node, arc_subdivisions: int = 24, len_subdivisions: int = 20) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = "Seg_Halfpipe"
	body.position = position
	parent.add_child(body)

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)

	for i in range(arc_subdivisions):
		var t0 := float(i) / arc_subdivisions
		var t1 := float(i + 1) / arc_subdivisions
		var theta0 := PI * t0
		var theta1 := PI * t1

		for j in range(len_subdivisions):
			var s0 := float(j) / len_subdivisions
			var s1 := float(j + 1) / len_subdivisions
			var z0 := -length * s0
			var z1 := -length * s1

			var p00 := _point(theta0, z0, radius)
			var p10 := _point(theta1, z0, radius)
			var p11 := _point(theta1, z1, radius)
			var p01 := _point(theta0, z1, radius)

			var n0 := _normal(theta0)
			var n1 := _normal(theta1)

			st.set_normal(n0)
			st.add_vertex(p00)
			st.set_normal(n1)
			st.add_vertex(p10)
			st.set_normal(n1)
			st.add_vertex(p11)

			st.set_normal(n0)
			st.add_vertex(p00)
			st.set_normal(n1)
			st.add_vertex(p11)
			st.set_normal(n0)
			st.add_vertex(p01)

	var mesh := st.commit()

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.set_meta("mat_type", "track")
	# Apply holographic track shader
	mesh_instance.material_override = TRACK_MAT_BUILDER.track_material()
	body.add_child(mesh_instance)

	# Trimesh collision for curved surface
	var collision := CollisionShape3D.new()
	var shape := ConcavePolygonShape3D.new()
	shape.set_faces(mesh.get_faces())
	collision.shape = shape
	body.add_child(collision)

	# Wall rails at theta=0 (right rim) and theta=PI (left rim)
	_add_rail(0.0, length, radius, body)
	_add_rail(PI, length, radius, body)

	return body

static func _point(theta: float, z: float, radius: float) -> Vector3:
	# Semi-circle cross-section: bottom at y=0, walls at y=radius
	var x := radius * cos(theta)
	var y := radius * (1.0 - sin(theta))
	return Vector3(x, y, z)

static func _normal(theta: float) -> Vector3:
	# Inward-facing normal
	var nx := -cos(theta)
	var ny := sin(theta)
	return Vector3(nx, ny, 0.0).normalized()

static func _add_rail(theta: float, length: float, radius: float, parent: Node) -> void:
	var rail := StaticBody3D.new()
	rail.name = "Rail"
	var p := _point(theta, -length * 0.5, radius)
	rail.position = Vector3(p.x, p.y + 0.6, p.z)
	parent.add_child(rail)

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(0.3, 2.5, length)
	shape.shape = box
	rail.add_child(shape)

	# Visual rail cap with holographic wall material
	var rail_mesh := MeshInstance3D.new()
	var rail_box := BoxMesh.new()
	rail_box.size = Vector3(0.3, 2.5, length)
	rail_mesh.mesh = rail_box
	rail_mesh.material_override = TRACK_MAT_BUILDER.wall_material()
	rail.add_child(rail_mesh)

# Convert a "wall fraction" (0.0=right wall top, 0.5=bottom, 1.0=left wall top)
# into world coordinates for a given segment
static func world_pos(theta_frac: float, z_frac: float, radius: float, seg_pos: Vector3, seg_length: float) -> Vector3:
	var theta := PI * theta_frac
	var z := -seg_length * z_frac
	var local := _point(theta, z, radius)
	return seg_pos + local

# Place a "lip" ring slightly below the rim for risk/reward wall riding
static func lip_pos(side: String, z_frac: float, radius: float, seg_pos: Vector3, seg_length: float) -> Vector3:
	var theta_frac := 0.08 if side == "right" else 0.92
	return world_pos(theta_frac, z_frac, radius, seg_pos, seg_length)

# Place a "high wall" ring about 2/3 up the wall
static func high_wall_pos(side: String, z_frac: float, radius: float, seg_pos: Vector3, seg_length: float) -> Vector3:
	var theta_frac := 0.18 if side == "right" else 0.82
	return world_pos(theta_frac, z_frac, radius, seg_pos, seg_length)

# Place a "mid wall" ring about 1/3 up the wall
static func mid_wall_pos(side: String, z_frac: float, radius: float, seg_pos: Vector3, seg_length: float) -> Vector3:
	var theta_frac := 0.30 if side == "right" else 0.70
	return world_pos(theta_frac, z_frac, radius, seg_pos, seg_length)

# Bottom center
static func bottom_pos(z_frac: float, radius: float, seg_pos: Vector3, seg_length: float) -> Vector3:
	return world_pos(0.5, z_frac, radius, seg_pos, seg_length)

extends Object
class_name TrackMeshBuilder

const _TRACK_BUILDER_SCRIPT := preload("res://scripts/track_builder.gd")


static func is_track_geometry_node(child: Node) -> bool:
	var n: String = child.name
	if n == "TrackBuilder" or n == "FinishZone" or n == "Runway" or n == "Floor":
		return true
	if child is StaticBody3D and n.begins_with("Seg_"):
		return true
	return false


static func build(params: Dictionary) -> Array[Dictionary]:
	var track_root: Node3D = params["track_root"]
	var level_root: Node3D = params["level_root"]
	var all_segs: Array = params["all_segments"]
	var selected_middle_index: int = int(params.get("selected_middle_index", -1))

	# Remove immediately — queue_free() leaves old segments for a frame and duplicates meshes on rapid rebuilds.
	var to_remove: Array[Node] = []
	for child: Node in track_root.get_children():
		if is_track_geometry_node(child):
			to_remove.append(child)
	for child: Node in to_remove:
		track_root.remove_child(child)
		child.free()

	var total_length := 0.0
	for seg: Variant in all_segs:
		if seg is Dictionary:
			total_length += float(seg.get("length", 20.0))
	track_root.transform.origin.z = -total_length / 2.0

	var current_z: float = 0.0
	var current_y: float = 0.0
	var last_seg_x: float = 0.0
	var index: int = 0
	var middle_idx: int = 0
	var anchors: Array[Dictionary] = []

	for seg_v: Variant in all_segs:
		var seg: Dictionary = seg_v if seg_v is Dictionary else {}
		var length: float = float(seg.get("length", 20.0))
		var width: float = float(seg.get("width", 8.0))
		var ramp: float = float(seg.get("ramp", 0.0))
		var bank: float = float(seg.get("bank", 0.0))
		var is_ice: bool = bool(seg.get("ice", false))
		var is_gap: bool = str(seg.get("type", "")) == "gap"
		var seg_type: String = str(seg.get("type", ""))
		var is_middle: bool = seg_type not in ["start_runway", "end_runway"]
		var cz := current_z - length / 2.0
		var seg_x: float = float(seg.get("x", 0.0))
		var seg_y: float = current_y + float(seg.get("y", 0.0))
		var center_y := seg_y + ramp * 0.5
		var ramp_angle := atan(ramp / length) if absf(ramp) > 0.01 else 0.0
		var bank_angle := deg_to_rad(bank)

		if is_gap:
			var gap_body := StaticBody3D.new()
			gap_body.name = "Seg_%d" % index
			gap_body.set_meta("gap_proxy", true)
			gap_body.position = Vector3(seg_x, center_y, cz)
			gap_body.rotation = Vector3(ramp_angle, 0, bank_angle)
			track_root.add_child(gap_body)
			gap_body.owner = level_root

			var gap_mesh := MeshInstance3D.new()
			gap_mesh.name = "SegMesh"
			var gap_box := BoxMesh.new()
			gap_box.size = Vector3(width, 0.25, length)
			gap_mesh.mesh = gap_box
			gap_mesh.set_meta("mat_type", "gap_proxy")
			var gap_mat := StandardMaterial3D.new()
			gap_mat.albedo_color = Color(0.45, 0.5, 0.65, 0.4)
			gap_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			gap_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
			gap_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			gap_mesh.material_override = gap_mat
			gap_body.add_child(gap_mesh)
			gap_mesh.owner = level_root

			var gap_col := CollisionShape3D.new()
			gap_col.name = "SegShape"
			var gap_shape := BoxShape3D.new()
			gap_shape.size = Vector3(width, 0.5, length)
			gap_col.shape = gap_shape
			gap_body.add_child(gap_col)
			gap_col.owner = level_root

			if is_middle and middle_idx == selected_middle_index:
				_attach_highlight(gap_body, width, length, level_root)
		elif not is_gap:
			var body := StaticBody3D.new()
			body.name = "Seg_%d" % index
			body.position = Vector3(seg_x, center_y, cz)
			body.rotation = Vector3(ramp_angle, 0, bank_angle)
			track_root.add_child(body)
			body.owner = level_root

			var mesh_inst := MeshInstance3D.new()
			mesh_inst.name = "SegMesh"
			var mesh := BoxMesh.new()
			mesh.size = Vector3(width, 0.4, length)
			mesh_inst.mesh = mesh
			mesh_inst.set_meta("mat_type", "ice" if is_ice else "track")
			body.add_child(mesh_inst)
			mesh_inst.owner = level_root

			var col := CollisionShape3D.new()
			col.name = "SegShape"
			var shape := BoxShape3D.new()
			shape.size = Vector3(width, 0.4, length)
			col.shape = shape
			body.add_child(col)
			col.owner = level_root

			if is_ice:
				var ice_mat := PhysicsMaterial.new()
				ice_mat.friction = 0.005
				ice_mat.bounce = 0.05
				body.physics_material_override = ice_mat

			var wh := 1.5
			for side: int in [-1, 1]:
				var wall := StaticBody3D.new()
				wall.name = "Wall_%s_%d" % ["L" if side == -1 else "R", index]
				wall.position = Vector3(side * (width * 0.5 + 0.15), wh * 0.5 + 0.2, 0)
				body.add_child(wall)
				wall.owner = level_root
				var wmesh := MeshInstance3D.new()
				var wbox := BoxMesh.new()
				wbox.size = Vector3(0.3, wh, length)
				wmesh.mesh = wbox
				wmesh.set_meta("mat_type", "wall")
				wall.add_child(wmesh)
				wmesh.owner = level_root
				var wcol := CollisionShape3D.new()
				var wshp := BoxShape3D.new()
				wshp.size = Vector3(0.3, wh, length)
				wcol.shape = wshp
				wall.add_child(wcol)
				wcol.owner = level_root

			if is_middle and middle_idx == selected_middle_index:
				_attach_highlight(body, width, length, level_root)

		if is_middle:
			anchors.append({
				"index": middle_idx,
				"local": Vector3(seg_x, seg_y, cz),
				"chain_y": seg_y,
			})
			middle_idx += 1

		current_z -= length
		current_y = seg_y + ramp
		last_seg_x = seg_x
		index += 1

	var finish := Area3D.new()
	finish.name = "FinishZone"
	finish.position = Vector3(
		last_seg_x,
		current_y + TrackConstants.FINISH_ZONE_HALF_HEIGHT,
		current_z,
	)
	track_root.add_child(finish)
	finish.owner = level_root
	var fshape := CollisionShape3D.new()
	var fbox := BoxShape3D.new()
	fbox.size = Vector3(16, 6.0, 20.0)
	fshape.shape = fbox
	finish.add_child(fshape)
	fshape.owner = level_root
	var fmesh := MeshInstance3D.new()
	var fbox_mesh := BoxMesh.new()
	fbox_mesh.size = Vector3(16, 6.0, 0.1)
	fmesh.mesh = fbox_mesh
	fmesh.set_meta("mat_type", "finish")
	finish.add_child(fmesh)
	fmesh.owner = level_root

	var builder: Node = track_root.get_node_or_null("TrackBuilder")
	if builder == null:
		builder = _TRACK_BUILDER_SCRIPT.new()
		builder.name = "TrackBuilder"
		track_root.add_child(builder)
	if builder.has_method("_apply_materials"):
		builder._apply_materials(track_root)

	return anchors


static func update_selection_highlight(track_root: Node3D, selected_middle_index: int, level_root: Node3D) -> void:
	for child: Node in track_root.get_children():
		if not (child is StaticBody3D) or not child.name.begins_with("Seg_"):
			continue
		var body: StaticBody3D = child as StaticBody3D
		var mid: int = EditorRaycast.middle_index_from_seg_body(body)
		var existing: Node = body.get_node_or_null("SegHighlight")
		if mid >= 0 and mid == selected_middle_index:
			if existing != null:
				continue
			var seg_width := 8.0
			var seg_length := 20.0
			var mesh_inst = body.get_node_or_null("SegMesh")
			if mesh_inst is MeshInstance3D and mesh_inst.mesh is BoxMesh:
				var box: BoxMesh = mesh_inst.mesh as BoxMesh
				seg_width = box.size.x
				seg_length = box.size.z
			_attach_highlight(body, seg_width, seg_length, level_root)
		elif existing != null:
			existing.queue_free()


static func _attach_highlight(body: StaticBody3D, width: float, length: float, level_root: Node3D) -> void:
	var hl := MeshInstance3D.new()
	hl.name = "SegHighlight"
	var box := BoxMesh.new()
	box.size = Vector3(width + 0.5, 0.5, length + 0.5)
	hl.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.82, 0.15, 0.4)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.7, 0.1)
	mat.emission_energy_multiplier = 2.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hl.material_override = mat
	hl.position = Vector3(0.0, 0.08, 0.0)
	body.add_child(hl)
	hl.owner = level_root

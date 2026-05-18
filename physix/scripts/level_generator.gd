@tool
extends Node3D

# Level Generator — builds tracks, walls, coins, obstacles from compact data.
# TrackRoot gets a slope rotation so gravity actually pulls the ball forward.
#
# Usage: attach to TrackRoot in a level scene. Reads world_number & level_number
# from the parent GameLevel node and builds everything in _ready().
# In the editor, use the "Build Track" button in the Inspector.

const TRACK_MAT := preload("res://scripts/track_builder.gd")

@warning_ignore("unused_private_class_variable")
@export_tool_button("Build Track") var _build_track_btn: Callable = _build_track

var _track_shape := BoxShape3D.new()
var _wall_shape  := BoxShape3D.new()
var _coin_shape  := SphereShape3D.new()
var _coin_mesh   := CylinderMesh.new()
var _coin_mat    := StandardMaterial3D.new()

func _ready() -> void:
	# Init shared shapes
	_track_shape.size = Vector3(8, 0.4, 10)
	_wall_shape.size  = Vector3(0.3, 1.5, 10)
	_coin_shape.radius = 1.2
	_coin_mesh.height = 0.08
	_coin_mesh.top_radius = 0.35
	_coin_mesh.bottom_radius = 0.35
	_coin_mat.albedo_color = Color(1.0, 0.78, 0.05, 1.0)
	_coin_mat.metallic = 0.85
	_coin_mat.roughness = 0.25
	_coin_mat.emission_enabled = true
	_coin_mat.emission = Color(1.0, 0.65, 0.0, 1.0)
	_coin_mat.emission_energy_multiplier = 1.5

	# Auto-detect baked children and skip regeneration
	var has_baked := false
	for child: Node in get_children():
		if child is StaticBody3D and child.name.begins_with("Seg_"):
			# Verify the segment actually has geometry/collision children;
			# empty placeholder nodes should trigger a full rebuild.
			for sub: Node in child.get_children():
				if sub is MeshInstance3D or sub is CollisionShape3D:
					has_baked = true
					break
			if has_baked:
				break
	if has_baked:
		_apply_materials_to_level(self)
		_build_start_wall()
		return

	var parent_level := get_parent()
	if parent_level == null:
		return
	var world: int = int(parent_level.get("world_number")) if parent_level.get("world_number") != null else 1
	var level: int = int(parent_level.get("level_number")) if parent_level.get("level_number") != null else 1
	var key: String
	if world == 0:
		key = "S-%d" % level
	else:
		key = "%d-%d" % [world, level]

	var layout := _load_level_data(key)
	if layout.is_empty() and level == 0 and world > 0:
		var bonus_world: int = int(parent_level.get("world_number")) if parent_level.get("world_number") != null else 1
		var bonus_key: String = "B-%d" % bonus_world
		layout = _load_level_data(bonus_key)

	if not layout.is_empty():
		_build_level(layout)

func _build_track() -> void:
	if not Engine.is_editor_hint():
		return
	# Immediate cleanup so names don't collide with queued frees
	while get_child_count() > 0:
		var child := get_child(0)
		remove_child(child)
		child.free()
	var parent_level := get_parent()
	if parent_level == null:
		return
	var world: int = int(parent_level.get("world_number")) if parent_level.get("world_number") != null else 1
	var level: int = int(parent_level.get("level_number")) if parent_level.get("level_number") != null else 1
	var key: String
	if world == 0:
		key = "S-%d" % level
	else:
		key = "%d-%d" % [world, level]
	var layout := _load_level_data(key)
	if layout.is_empty() and level == 0 and world > 0:
		var bonus_world: int = int(parent_level.get("world_number")) if parent_level.get("world_number") != null else 1
		var bonus_key: String = "B-%d" % bonus_world
		layout = _load_level_data(bonus_key)
	if not layout.is_empty():
		_build_level(layout)

func _load_level_data(key: String) -> Dictionary:
	var path := "res://levels/%s.json" % key
	if FileAccess.file_exists(path):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var parsed: Variant = JSON.parse_string(file.get_as_text())
			if parsed is Dictionary:
				return parsed
	push_warning("Level data not found: %s" % path)
	return {}

func _to_dict_array(arr: Array) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for item: Variant in arr:
		if item is Dictionary:
			out.append(item as Dictionary)
	return out

func _build_level(layout: Dictionary) -> void:
	# Clear old geometry immediately (free, not queue_free) so physics
	# raycasts in _build_hoop() don't hit stale collision from prior runs.
	while get_child_count() > 0:
		var child := get_child(0)
		remove_child(child)
		child.free()
	var slope: float = layout.get("slope", 10.0)
	self.rotation = Vector3(deg_to_rad(slope), 0, 0)
	_build_segments(_to_dict_array(layout.get("segments", [])))
	_build_coins(_to_dict_array(layout.get("coins", [])))
	_build_finish(layout.get("finish_z", -200.0))
	_build_obstacles(_to_dict_array(layout.get("obstacles", [])))
	_build_start_wall()
	_apply_materials_to_level(self)


func _apply_materials_to_level(node: Node) -> void:
	TRACK_MAT._apply_materials(node)

func _add_to_track(node: Node) -> void:
	add_child(node)
	if Engine.is_editor_hint() and get_tree() != null:
		node.owner = get_tree().edited_scene_root

func _build_segments(segments: Array[Dictionary]) -> void:
	var current_y: float = 0.0
	var prev_z1: float = INF
	for seg: Dictionary in segments:
		var z0: float = seg.get("z0", 0.0)
		var z1: float = seg.get("z1", -100.0)
		var w: float  = seg.get("w", 8.0)
		var x: float  = seg.get("x", 0.0)
		var is_ice: bool = seg.get("ice", false)
		var seg_y: float = seg.get("y", current_y)
		var ramp: float = seg.get("ramp", 0.0)
		var is_jump: bool = seg.get("jump", false)

		var length := absf(z1 - z0)
		var cz := (z0 + z1) * 0.5

		# Auto-correct landing platforms after gaps.
		var has_gap: bool = prev_z1 != INF and absf(z0 - prev_z1) > 0.5
		if has_gap and seg_y == 0.0 and absf(ramp) < 0.01 and absf(current_y) > 0.05:
			seg_y = current_y

		# For jumps, auto-ramp at start and end of segment.
		# Only override if no ramp was specified or ramp is flat/positive.
		# Respect designer-specified negative ramps (downhill launch pads).
		if is_jump and ramp >= 0:
			ramp = 2.5

		var is_ramp: bool = absf(ramp) > 0.01
		var ramp_angle: float = atan(ramp / length) if is_ramp else 0.0
		var center_y: float = seg_y if not is_ramp else seg_y + ramp * 0.5

		# Track segment body
		var body := StaticBody3D.new()
		body.name = "Seg_%d" % int(cz)
		body.position = Vector3(x, center_y, cz)
		if is_ramp:
			body.rotation = Vector3(ramp_angle, 0, 0)
		_add_to_track(body)

		# Mesh
		var mesh_inst := MeshInstance3D.new()
		mesh_inst.name = "SegMesh"
		var mesh := BoxMesh.new()
		mesh.size = Vector3(w, 0.4, length)
		mesh_inst.mesh = mesh
		mesh_inst.set_meta("mat_type", "track")
		if is_ice:
			mesh_inst.set_meta("mat_type", "ice")
		body.add_child(mesh_inst)

		# Collision
		var col := CollisionShape3D.new()
		col.name = "SegShape"
		var shape := _track_shape.duplicate()
		shape.size = Vector3(w, 0.4, length)
		col.shape = shape
		body.add_child(col)

		# Ice physics override
		if is_ice:
			var ice_mat := PhysicsMaterial.new()
			ice_mat.friction = 0.005
			ice_mat.bounce = 0.05
			body.physics_material_override = ice_mat

		# Walls — follow track rotation so they stay parallel to surface
		var wh := 1.5
		for side: int in [-1, 1]:
			var wall := StaticBody3D.new()
			wall.name = "Wall_%s_%d" % ["L" if side == -1 else "R", int(cz)]
			var wall_local_y: float = wh * 0.5 + 0.2
			wall.position = Vector3(side * (w * 0.5 + 0.15), wall_local_y, 0)
			wall.rotation = Vector3.ZERO
			body.add_child(wall)

			var wmesh := MeshInstance3D.new()
			var wbox := BoxMesh.new()
			wbox.size = Vector3(0.3, wh, length)
			wmesh.mesh = wbox
			wmesh.set_meta("mat_type", "wall")
			wall.add_child(wmesh)

			var wcol := CollisionShape3D.new()
			var wshp := _wall_shape.duplicate()
			wshp.size = Vector3(0.3, wh, length)
			wcol.shape = wshp
			wall.add_child(wcol)

		# Update current Y for next segment
		if is_jump:
			# Jump segments are launch pads before gaps.
			# The landing platform should be at approximately the same height
			# as the jump segment's start, not elevated by the ramp.
			current_y = seg_y
		elif is_ramp:
			current_y = seg_y + ramp
		else:
			current_y = seg_y
		prev_z1 = z1

func _build_coins(coins: Array[Dictionary]) -> void:
	var container := Node3D.new()
	container.name = "Coins"
	_add_to_track(container)

	for i: int in range(coins.size()):
		var c: Dictionary = coins[i]
		var z: float = c.get("z", -50.0)
		var x: float = c.get("x", 0.0)
		var y: float = c.get("y", 1.7)

		var coin := Area3D.new()
		coin.name = "Coin%d" % (i + 1)
		coin.position = Vector3(x, y, z)
		coin.monitoring = true
		container.add_child(coin)

		var mesh := MeshInstance3D.new()
		mesh.transform.basis = Basis.from_euler(Vector3(deg_to_rad(90), 0, 0))
		mesh.mesh = _coin_mesh
		mesh.set_surface_override_material(0, _coin_mat)
		coin.add_child(mesh)

		var col := CollisionShape3D.new()
		col.shape = _coin_shape
		coin.add_child(col)

func _build_finish(finish_z: float) -> void:
	var finish := Area3D.new()
	finish.name = "FinishZone"
	finish.position = Vector3(0, 3.0, finish_z)
	_add_to_track(finish)

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(16, 6.0, 20.0)
	shape.shape = box
	finish.add_child(shape)

	var mesh := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(16, 6.0, 0.1)
	mesh.mesh = box_mesh
	mesh.set_meta("mat_type", "finish")
	finish.add_child(mesh)
	_build_runway(finish_z)

func _build_runway(finish_z: float) -> void:
	# Continue the track past the finish — long runway for the sunset roll
	var runway_length: float = 600.0
	var z0: float = finish_z - 10.0
	var z1: float = z0 - runway_length
	var cz := (z0 + z1) * 0.5
	var body := StaticBody3D.new()
	body.name = "Seg_Runway"
	body.position = Vector3(0, 0, cz)
	_add_to_track(body)

	var mesh_inst := MeshInstance3D.new()
	mesh_inst.name = "RunwayMesh"
	var mesh := BoxMesh.new()
	mesh.size = Vector3(10, 0.4, runway_length)
	mesh_inst.mesh = mesh
	mesh_inst.set_meta("mat_type", "track")
	body.add_child(mesh_inst)

	var col := CollisionShape3D.new()
	var shape := _track_shape.duplicate()
	shape.size = Vector3(10, 0.4, runway_length)
	col.shape = shape
	body.add_child(col)

	# Walls on runway
	var wh := 1.5
	for side in [-1, 1]:
		var wall := StaticBody3D.new()
		wall.name = "Wall_Runway_%s" % ["L" if side == -1 else "R"]
		wall.position = Vector3(side * 5.15, wh * 0.5 + 0.2, 0)
		body.add_child(wall)
		var wmesh := MeshInstance3D.new()
		var wbox := BoxMesh.new()
		wbox.size = Vector3(0.3, wh, runway_length)
		wmesh.mesh = wbox
		wmesh.set_meta("mat_type", "wall")
		wall.add_child(wmesh)
		var wcol := CollisionShape3D.new()
		var wshp := _wall_shape.duplicate()
		wshp.size = Vector3(0.3, wh, runway_length)
		wcol.shape = wshp
		wall.add_child(wcol)

func _build_obstacles(obstacles: Array[Dictionary]) -> void:
	for obs: Dictionary in obstacles:
		var kind: String = obs.get("kind", "")
		var z: float = obs.get("z", 0.0)
		var x: float = obs.get("x", 0.0)
		var base_y: float = obs.get("seg_y", 0.0)
		match kind:
			"hoop":
				_build_hoop(z, x, obs.get("y", 2.5), obs.get("boost", 0.0))
			"speed_boost":
				_build_speed_boost(z, x, obs.get("strength", 14.0), false, base_y)
			"brake_pad":
				_build_speed_boost(z, x, obs.get("strength", 8.0), true, base_y)
			"gravity":
				_build_gravity_zone(z, x, obs.get("type", 1), obs.get("multiplier", 2.0), obs.get("length", 20.0))
			"wind":
				var wd: Array = obs.get("direction", [1, 0, 0])
				_build_wind_zone(z, x, obs.get("force", 15.0), Vector3(wd[0], wd[1], wd[2]), obs.get("length", 20.0))
			"move":
				var axis: Array = obs.get("axis", [0, 0, 1])
				_build_moving_platform(z, x, Vector3(axis[0], axis[1], axis[2]), obs.get("distance", 6.0), obs.get("speed", 3.0), base_y)
			"ice":
				_build_ice_patch(z, x, obs.get("length", 12.0), obs.get("width", 7.5), base_y)
			"magnet":
				_build_magnet(z, x, obs.get("magnet_type", "attract"), obs.get("strength", 8.0), obs.get("length", 10.0))
			"spike":
				_build_spike_trap(z, x, obs.get("width", 6.0), obs.get("length", 2.0), base_y)
			"bumper":
				_build_bumper(z, x, obs.get("force", 20.0), base_y)
			"pot":
				_build_breakable_pot(z, x, base_y)
func _build_breakable_pot(z: float, x: float, base_y: float = 0.0) -> void:
	var pot := preload("res://scenes/obstacles/breakable_pot.tscn").instantiate()
	pot.position = Vector3(x, base_y + 0.35, z)
	_add_to_track(pot)

func _build_bumper(z: float, x: float, force: float, base_y: float = 0.0) -> void:
	var bumper := preload("res://scenes/obstacles/bumper.tscn").instantiate()
	bumper.position = Vector3(x, base_y + 0.5, z)
	bumper.bump_force = force
	_add_to_track(bumper)

func _build_speed_boost(_z: float, _x: float, _strength: float, _is_brake: bool, _base_y: float = 0.0) -> void:
	# Speed boost obstacles are deprecated; hoops now provide all forward momentum.
	return

func _build_gravity_zone(z: float, x: float, zone_type: int, multiplier: float, length: float) -> void:
	var zone := preload("res://scenes/obstacles/gravity_zone.tscn").instantiate()
	zone.position = Vector3(x, 1.0, z)
	zone.zone_type = zone_type
	zone.gravity_multiplier = multiplier
	# Scale the zone mesh to match length
	for child: Node in zone.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size.z = length
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size.z = length
	_add_to_track(zone)

func _build_wind_zone(z: float, x: float, force: float, direction: Vector3, length: float) -> void:
	var zone := preload("res://scenes/obstacles/wind_zone.tscn").instantiate()
	zone.position = Vector3(x, 1.0, z)
	zone.wind_force = force
	zone.wind_direction = direction
	for child: Node in zone.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size.z = length
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size.z = length
	_add_to_track(zone)

func _build_moving_platform(z: float, x: float, axis: Vector3, dist: float, spd: float, base_y: float = 0.0) -> void:
	var plat := preload("res://scenes/obstacles/moving_platform.tscn").instantiate()
	plat.position = Vector3(x, base_y + 0.2, z)
	plat.move_axis = axis
	plat.move_distance = dist
	plat.move_speed = spd
	_add_to_track(plat)

func _build_ice_patch(z: float, x: float, length: float, width: float, base_y: float = 0.0) -> void:
	var ice := preload("res://scenes/obstacles/ice_patch.tscn").instantiate()
	ice.position = Vector3(x, base_y + 0.05, z)
	for child: Node in ice.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size = Vector3(width, 0.06, length)
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size = Vector3(width, 0.06, length)
	_add_to_track(ice)

func _build_magnet(z: float, x: float, mag_type: String, strength: float, length: float) -> void:
	var zone := preload("res://scenes/obstacles/magnet_zone.tscn").instantiate() as MagnetZone
	zone.name = "MagnetZone"
	zone.position = Vector3(x, 1.0, z)
	match mag_type:
		"repel":
			zone.magnet_type = MagnetZone.MagnetType.REPEL
		_:
			zone.magnet_type = MagnetZone.MagnetType.ATTRACT
	zone.strength = strength
	zone.zone_length = length
	_add_to_track(zone)
	for child: Node in zone.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size.z = length
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size.z = length

func _build_spike_trap(z: float, x: float, width: float, length: float, base_y: float = 0.0) -> void:
	var trap := SpikeTrap.new()
	trap.name = "SpikeTrap"
	trap.position = Vector3(x, base_y + 0.3, z)
	_add_to_track(trap)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(width, 0.6, length)
	shape.shape = box
	trap.add_child(shape)
	var mesh := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(width, 0.6, length)
	mesh.mesh = box_mesh
	mesh.set_meta("mat_type", "danger")
	trap.add_child(mesh)

func _build_start_wall() -> void:
	# Invisible wall right behind the start position prevents the ball from
	# rolling backward off the track edge before the countdown finishes.
	# Placed at z=+0.5 so it blocks the ball immediately; thick enough (1.0)
	# to catch physics tunneling at low speeds.
	var wall := StaticBody3D.new()
	wall.name = "StartWall"
	wall.position = Vector3(0.0, 2.0, 0.5)
	_add_to_track(wall)

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(16.0, 8.0, 1.0)
	shape.shape = box
	wall.add_child(shape)

func _build_torus_mesh(major_radius: float, minor_radius: float, ring_segments: int = 24, tube_segments: int = 8) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(ring_segments):
		var theta0 := float(i) / float(ring_segments) * TAU
		var theta1 := float(i + 1) / float(ring_segments) * TAU
		for j in range(tube_segments):
			var phi0 := float(j) / float(tube_segments) * TAU
			var phi1 := float(j + 1) / float(tube_segments) * TAU
			# Four corners of the current quad
			var p00 := _torus_point(theta0, phi0, major_radius, minor_radius)
			var p10 := _torus_point(theta1, phi0, major_radius, minor_radius)
			var p11 := _torus_point(theta1, phi1, major_radius, minor_radius)
			var p01 := _torus_point(theta0, phi1, major_radius, minor_radius)
			# Two triangles per quad
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

func _torus_point(theta: float, phi: float, major: float, minor: float) -> Vector3:
	# Ring lies in XY plane so player sees a circle when approaching along Z
	var rx := (major + minor * cos(phi)) * cos(theta)
	var ry := (major + minor * cos(phi)) * sin(theta)
	var rz := minor * sin(phi)
	return Vector3(rx, ry, rz)

func _torus_center(theta: float, major: float) -> Vector3:
	return Vector3(major * cos(theta), major * sin(theta), 0.0)

func _build_hoop(z: float, x: float, y: float, boost: float) -> void:
	var hoop := Hoop.new()
	hoop.name = "Hoop"
	var place_y: float = y
	var surface_y: float = _track_surface_y_at(Vector3(x, y, z))
	if surface_y > -500.0:
		place_y = maxf(y, surface_y + 0.35)
	hoop.position = Vector3(x, place_y, z)
	hoop.boost_strength = boost if boost > 0.0 else 28.0
	hoop.build_visuals()
	_add_to_track(hoop)


func _track_surface_y_at(world_pos: Vector3) -> float:
	var space := get_world_3d().direct_space_state
	if space == null:
		return -999.0
	var query := PhysicsRayQueryParameters3D.new()
	query.from = world_pos + Vector3(0, 40.0, 0)
	query.to = world_pos + Vector3(0, -40.0, 0)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	var hit := space.intersect_ray(query)
	if hit.is_empty():
		return -999.0
	return float(hit["position"].y)

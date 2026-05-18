import sys

path = "scripts/level_generator.gd"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Check if builder functions already exist
if "func _build_segments" in text:
    print("Builder functions already present. Skipping append.")
    sys.exit(0)

builder_code = '''

# ── Shared shapes ─────────────────────────────────────────────────────────────
var _track_shape := BoxShape3D.new()
var _wall_shape  := BoxShape3D.new()
var _coin_shape  := SphereShape3D.new()
var _coin_mesh   := CylinderMesh.new()
var _coin_mat    := StandardMaterial3D.new()

func _ready() -> void:
	_track_shape.size = Vector3(8, 0.4, 10)
	_wall_shape.size  = Vector3(0.3, 1.5, 10)
	_coin_shape.radius = 0.6
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
	for child in get_children():
		if child is StaticBody3D and child.name.begins_with("Seg_"):
			has_baked = true
			break
	if has_baked:
		_apply_materials_to_level(self)
		return

	var parent_level := get_parent()
	if parent_level == null:
		return
	var world: int = parent_level.get("world_number") if parent_level.get("world_number") != null else 1
	var level: int = parent_level.get("level_number") if parent_level.get("level_number") != null else 1
	var key: String = "%d-%d" % [world, level]
	if LEVELS.has(key):
		_build_level(LEVELS[key])
	elif key == "0-0":
		# Bonus level
		var bonus_key: String = "B-%d" % parent_level.get("world_number", 1)
		if LEVELS.has(bonus_key):
			_build_level(LEVELS[bonus_key])

func _build_level_in_editor() -> void:
	if Engine.is_editor_hint():
		_build_level(LEVELS.get("1-1", {}))

func _build_level(layout: Dictionary) -> void:
	# Clear old geometry except the generator node itself
	for child in get_children():
		child.queue_free()
	var slope: float = layout.get("slope", 10.0)
	self.rotation = Vector3(deg_to_rad(slope), 0, 0)
	_build_segments(layout.get("segments", []))
	_build_coins(layout.get("coins", []))
	_build_finish(layout.get("finish_z", -200.0))
	_build_obstacles(layout.get("obstacles", []))
	_apply_materials_to_level(self)

func _apply_materials_to_level(node: Node) -> void:
	TRACK_MAT._apply_materials(node)

func _build_segments(segments: Array) -> void:
	var current_y: float = 0.0
	var prev_z1: float = INF
	for seg in segments:
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
		add_child(body)

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
		for side in [-1, 1]:
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
		if is_ramp:
			current_y = seg_y + ramp
		else:
			current_y = seg_y
		prev_z1 = z1

func _build_coins(coins: Array) -> void:
	var container := Node3D.new()
	container.name = "Coins"
	add_child(container)

	for i in range(coins.size()):
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
	finish.position = Vector3(0, 2.0, finish_z)
	add_child(finish)

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(12, 4.0, 10.0)
	shape.shape = box
	finish.add_child(shape)

	var mesh := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(12, 4.0, 0.1)
	mesh.mesh = box_mesh
	mesh.set_meta("mat_type", "finish")
	finish.add_child(mesh)

func _build_obstacles(obstacles: Array) -> void:
	for obs in obstacles:
		var kind: String = obs.get("kind", "")
		var z: float = obs.get("z", 0.0)
		var x: float = obs.get("x", 0.0)
		match kind:
			"checkpoint":
				_build_checkpoint(z, x)
			"speed_boost":
				_build_speed_boost(z, x, obs.get("strength", 14.0), false)
			"brake_pad":
				_build_speed_boost(z, x, obs.get("strength", 8.0), true)
			"gravity":
				_build_gravity_zone(z, x, obs.get("type", 1), obs.get("multiplier", 2.0), obs.get("length", 20.0))
			"wind":
				var wd: Array = obs.get("direction", [1, 0, 0])
				_build_wind_zone(z, x, obs.get("force", 15.0), Vector3(wd[0], wd[1], wd[2]), obs.get("length", 20.0))
			"move":
				var axis: Array = obs.get("axis", [0, 0, 1])
				_build_moving_platform(z, x, Vector3(axis[0], axis[1], axis[2]), obs.get("distance", 6.0), obs.get("speed", 3.0))
			"ice":
				_build_ice_patch(z, x, obs.get("length", 12.0), obs.get("width", 7.5))
			"magnet":
				_build_magnet(z, x, obs.get("magnet_type", "attract"), obs.get("strength", 8.0), obs.get("length", 10.0))
			"spike":
				_build_spike_trap(z, x, obs.get("width", 6.0), obs.get("length", 2.0))
			"bumper":
				_build_bumper(z, x, obs.get("force", 20.0))
			"hoop":
				_build_hoop(z, x, obs.get("y", 2.5), obs.get("boost", 0.0))

func _build_checkpoint(z: float, x: float) -> void:
	var cp := preload("res://scenes/obstacles/checkpoint.tscn").instantiate()
	cp.position = Vector3(x, 1.0, z)
	add_child(cp)

func _build_bumper(z: float, x: float, force: float) -> void:
	var bumper := preload("res://scenes/obstacles/bumper.tscn").instantiate()
	bumper.position = Vector3(x, 0.5, z)
	bumper.bump_force = force
	add_child(bumper)

func _build_speed_boost(z: float, x: float, strength: float, is_brake: bool) -> void:
	var pad := preload("res://scenes/obstacles/speed_boost.tscn").instantiate()
	pad.position = Vector3(x, 0.1, z)
	pad.boost_strength = strength
	pad.is_brake_pad = is_brake
	add_child(pad)

func _build_gravity_zone(z: float, x: float, zone_type: int, multiplier: float, length: float) -> void:
	var zone := preload("res://scenes/obstacles/gravity_zone.tscn").instantiate()
	zone.position = Vector3(x, 1.0, z)
	zone.zone_type = zone_type
	zone.gravity_multiplier = multiplier
	# Scale the zone mesh to match length
	for child in zone.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size.z = length
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size.z = length
	add_child(zone)

func _build_wind_zone(z: float, x: float, force: float, direction: Vector3, length: float) -> void:
	var zone := preload("res://scenes/obstacles/wind_zone.tscn").instantiate()
	zone.position = Vector3(x, 1.0, z)
	zone.wind_force = force
	zone.wind_direction = direction
	for child in zone.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size.z = length
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size.z = length
	add_child(zone)

func _build_moving_platform(z: float, x: float, axis: Vector3, dist: float, spd: float) -> void:
	var plat := preload("res://scenes/obstacles/moving_platform.tscn").instantiate()
	plat.position = Vector3(x, 0.2, z)
	plat.move_axis = axis
	plat.move_distance = dist
	plat.move_speed = spd
	add_child(plat)

func _build_ice_patch(z: float, x: float, length: float, width: float) -> void:
	var ice := preload("res://scenes/obstacles/ice_patch.tscn").instantiate()
	ice.position = Vector3(x, 0.05, z)
	for child in ice.get_children():
		if child is MeshInstance3D and child.mesh is BoxMesh:
			child.mesh.size = Vector3(width, 0.06, length)
		if child is CollisionShape3D and child.shape is BoxShape3D:
			child.shape.size = Vector3(width, 0.06, length)
	add_child(ice)

func _build_magnet(z: float, x: float, mag_type: String, strength: float, length: float) -> void:
	# Inline magnet zone since there's no dedicated scene
	var zone := Area3D.new()
	zone.name = "MagnetZone"
	zone.position = Vector3(x, 1.0, z)
	zone.set_meta("magnet_type", mag_type)
	zone.set_meta("magnet_strength", strength)
	add_child(zone)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(8, 3, length)
	shape.shape = box
	zone.add_child(shape)

func _build_spike_trap(z: float, x: float, width: float, length: float) -> void:
	var trap := Area3D.new()
	trap.name = "SpikeTrap"
	trap.position = Vector3(x, 0.3, z)
	add_child(trap)
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

func _build_hoop(z: float, x: float, y: float, boost: float) -> void:
	var hoop := preload("res://scripts/obstacles/hoop.gd").new() as Hoop
	hoop.name = "Hoop"
	hoop.position = Vector3(x, y, z)
	hoop.boost_strength = boost if boost > 0.0 else 28.0
	add_child(hoop)
	var shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 1.2
	shape.shape = sphere
	hoop.add_child(shape)
	var mesh := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.2
	cyl.bottom_radius = 1.2
	cyl.height = 0.2
	mesh.mesh = cyl
	mesh.set_meta("mat_type", "checkpoint" if is_checkpoint else "boost")
	hoop.add_child(mesh)
'''

with open(path, "a", encoding="utf-8") as f:
    f.write(builder_code)

print("Appended builder functions to scripts/level_generator.gd")

extends "res://scripts/game_level.gd"

@export var track_length: float = 250.0
@export var coin_count: int = 30
@export var boost_count: int = 8

func _ready() -> void:
	level_number = 0
	var json_path := "res://levels/B-%d.json" % world_number
	if FileAccess.file_exists(json_path):
		# Hand-crafted JSON exists — let LevelGenerator on TrackRoot build it.
		# TrackRoot._ready() already ran (children first), so geometry is built.
		finish_zone = _find_finish_zone()
		super._ready()
		var track_root := $TrackRoot
		if track_root and track_root.has_method("_apply_materials_to_level"):
			track_root._apply_materials_to_level(track_root)
	else:
		# No JSON yet — fall back to old procedural generation
		_generate_bonus_track()
		finish_zone = _find_finish_zone()
		super._ready()
		var track_root := $TrackRoot
		if track_root and track_root.has_method("_apply_materials"):
			track_root._apply_materials(track_root)

func _generate_bonus_track() -> void:
	var track_root := $TrackRoot
	if track_root == null:
		track_root = Node3D.new()
		track_root.name = "TrackRoot"
		add_child(track_root)

	# Gentle slope for coin rush
	track_root.rotation_degrees = Vector3(-8.0, 0, 0)

	# Build a wavy track with hills instead of flat floor
	var seg_count := 10
	var seg_len := track_length / float(seg_count)
	var start_z := 0.0

	for i: int in range(seg_count):
		var t := float(i) / float(seg_count)
		var z0 := start_z - i * seg_len
		var z1 := z0 - seg_len
		var cz := (z0 + z1) * 0.5
		var w := 10.0

		# Elevation: sine wave hills
		var y0 := sin(t * PI * 2.0) * 1.5
		var y1 := sin((t + 1.0 / seg_count) * PI * 2.0) * 1.5
		var ramp := y1 - y0
		var ramp_angle := atan(ramp / seg_len)
		var center_y := y0 + ramp * 0.5

		# Floor segment
		var floor_body := StaticBody3D.new()
		floor_body.name = "FloorSeg%d" % i
		floor_body.position = Vector3(0, center_y, cz)
		floor_body.rotation = Vector3(ramp_angle, 0, 0)
		track_root.add_child(floor_body)

		var floor_mesh := MeshInstance3D.new()
		floor_mesh.name = "FloorMesh"
		var box_mesh := BoxMesh.new()
		box_mesh.size = Vector3(w, 0.4, seg_len)
		floor_mesh.mesh = box_mesh
		floor_mesh.set_meta("mat_type", "track")
		floor_body.add_child(floor_mesh)

		var floor_shape := CollisionShape3D.new()
		floor_shape.name = "FloorShape"
		var box_shape := BoxShape3D.new()
		box_shape.size = Vector3(w, 0.4, seg_len)
		floor_shape.shape = box_shape
		floor_body.add_child(floor_shape)

		# Walls
		for side: int in [-1, 1]:
			var wall_body := StaticBody3D.new()
			var wall_suffix := "L" if side == -1 else "R"
			wall_body.name = "Wall%s%d" % [wall_suffix, i]
			wall_body.position = Vector3(side * (w * 0.5 + 0.15), center_y + 0.95, cz)
			wall_body.rotation = Vector3(ramp_angle, 0, 0)
			track_root.add_child(wall_body)

			var wall_mesh := MeshInstance3D.new()
			wall_mesh.name = "WallMesh"
			var w_box := BoxMesh.new()
			w_box.size = Vector3(0.3, 1.5, seg_len)
			wall_mesh.mesh = w_box
			wall_mesh.set_meta("mat_type", "wall")
			wall_body.add_child(wall_mesh)

			var w_shape := CollisionShape3D.new()
			w_shape.name = "WallShape"
			var w_box_shape := BoxShape3D.new()
			w_box_shape.size = Vector3(0.3, 1.5, seg_len)
			w_shape.shape = w_box_shape
			wall_body.add_child(w_shape)

	# Coins placed along the track with slight X variation
	var coins_node := Node3D.new()
	coins_node.name = "Coins"
	track_root.add_child(coins_node)

	for i: int in range(coin_count):
		var t := float(i) / maxf(coin_count - 1, 1.0)
		var z := lerpf(-10.0, -(track_length - 10.0), t)
		var x := randf_range(-3.0, 3.0)
		# Height follows the track sine wave + coin offset
		var track_y := sin(t * PI * 2.0) * 1.5
		var y := track_y + 2.0

		var coin := Area3D.new()
		coin.name = "Coin%d" % (i + 1)
		coin.position = Vector3(x, y, z)
		coin.monitoring = true
		coins_node.add_child(coin)

		var c_mesh := MeshInstance3D.new()
		c_mesh.name = "MeshInstance3D"
		var c_cyl := CylinderMesh.new()
		c_cyl.height = 0.08
		c_cyl.top_radius = 0.35
		c_cyl.bottom_radius = 0.35
		c_mesh.mesh = c_cyl
		c_mesh.rotation = Vector3(PI / 2, 0, 0)
		var c_mat := StandardMaterial3D.new()
		c_mat.albedo_color = Color(1.0, 0.78, 0.05)
		c_mat.metallic = 0.85
		c_mat.roughness = 0.25
		c_mat.emission_enabled = true
		c_mat.emission = Color(1.0, 0.65, 0.0)
		c_mat.emission_energy_multiplier = 1.5
		c_mesh.material_override = c_mat
		coin.add_child(c_mesh)

		var c_shape := CollisionShape3D.new()
		var c_sphere := SphereShape3D.new()
		c_sphere.radius = 1.2
		c_shape.shape = c_sphere
		coin.add_child(c_shape)

		var c_light := OmniLight3D.new()
		c_light.light_color = Color(1.0, 0.75, 0.1)
		c_light.light_energy = 1.5
		c_light.omni_range = 3.0
		coin.add_child(c_light)

	# Boost pads — use actual scene for proper behavior
	var boost_scene := load("res://scenes/obstacles/speed_boost.tscn") as PackedScene
	for i: int in range(boost_count):
		var t := float(i + 1) / float(boost_count + 1)
		var z := lerpf(-15.0, -(track_length - 15.0), t)
		var track_y := sin(t * PI * 2.0) * 1.5

		if boost_scene:
			var boost: Node = boost_scene.instantiate()
			boost.name = "Boost%d" % (i + 1)
			boost.position = Vector3(0, track_y + 0.25, z)
			boost.set("boost_strength", 22.0)
			track_root.add_child(boost)
		else:
			# Fallback if scene missing
			var boost := Area3D.new()
			boost.name = "Boost%d" % (i + 1)
			boost.position = Vector3(0, track_y + 0.25, z)
			track_root.add_child(boost)

			var b_mesh := MeshInstance3D.new()
			var b_box := BoxMesh.new()
			b_box.size = Vector3(6.0, 0.05, 3.0)
			b_mesh.mesh = b_box
			b_mesh.set_meta("mat_type", "boost")
			boost.add_child(b_mesh)

			var b_shape := CollisionShape3D.new()
			var b_box_shape := BoxShape3D.new()
			b_box_shape.size = Vector3(6.0, 0.5, 3.0)
			b_shape.shape = b_box_shape
			boost.add_child(b_shape)

	# Finish zone
	var finish := Area3D.new()
	finish.name = "FinishZone"
	finish.monitoring = true
	finish.position = Vector3(0, 2.2, -(track_length - 6.0))
	track_root.add_child(finish)

	var f_shape := CollisionShape3D.new()
	var f_box := BoxShape3D.new()
	f_box.size = Vector3(8.0, 4.0, 10.0)
	f_shape.shape = f_box
	finish.add_child(f_shape)

	var f_mesh := MeshInstance3D.new()
	var f_box_mesh := BoxMesh.new()
	f_box_mesh.size = Vector3(8.0, 4.0, 0.1)
	f_mesh.mesh = f_box_mesh
	f_mesh.set_meta("mat_type", "finish")
	finish.add_child(f_mesh)

	# Player start
	player.position = Vector3(0, 1.5, 0)

extends Node3D

# Prototype Half-Pipe Level — World 6 Mastery Playground
# Self-contained, load directly in Godot (F6) to test wall-riding physics.

const PLAYER_SCENE := preload("res://scenes/player/player.tscn")
const SKY_SCENE := preload("res://scenes/sky_sphere.tscn")

const CAM_BASE_FOV: float = 70.0
const CAM_MAX_FOV: float = 85.0
const CAM_BASE_OFFSET := Vector3(0.0, 4.5, 12.0)
const CAM_MAX_OFFSET := Vector3(0.0, 6.0, 18.0)
const CAM_SMOOTH: float = 9.0
const CAM_FOV_SMOOTH: float = 4.0

var player: RigidBody3D = null
var camera: Camera3D = null

var _elapsed: float = 0.0
var _running: bool = false
var _seg_data: Array[Dictionary] = []

func _ready() -> void:
	# Lighting
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-40), deg_to_rad(25), 0)
	sun.shadow_enabled = true
	add_child(sun)

	# Camera
	camera = Camera3D.new()
	camera.fov = CAM_BASE_FOV
	camera.position = Vector3(0, 6, 12)
	add_child(camera)

	# Player
	player = PLAYER_SCENE.instantiate()
	player.position = Vector3(0, 1.0, 0)
	player.died.connect(_on_died)
	add_child(player)

	# Sky
	var sky: Node = SKY_SCENE.instantiate()
	sky.world_number = 6
	sky.follow_target = player
	add_child(sky)

	# Build half-pipe segments
	_build_track()

	# Apply materials to all built geometry
	TRACK_MAT._apply_materials(self)

	# Start
	await get_tree().create_timer(1.5).timeout
	_running = true

const TRACK_MAT := preload("res://scripts/track_builder.gd")

func _build_track() -> void:
	var z: float = 0.0

	# ── Segment 1: wide, gentle ──
	var r1 := 14.0
	var l1 := 60.0
	var p1 := Vector3(0, 0, z)
	HalfpipeBuilder.build_segment(r1, l1, p1, self)
	_seg_data.append({"pos": p1, "radius": r1, "length": l1})
	# Warmup: bottom + right mid-wall
	_place_hoop(HalfpipeBuilder.bottom_pos(0.20, r1, p1, l1), 24.0)
	_place_hoop(HalfpipeBuilder.mid_wall_pos("right", 0.55, r1, p1, l1), 28.0)
	# Lip coins
	_place_coin(HalfpipeBuilder.lip_pos("right", 0.35, r1, p1, l1))
	_place_coin(HalfpipeBuilder.lip_pos("left", 0.70, r1, p1, l1))
	z -= l1

	# ── Segment 2: narrower, steeper walls ──
	var r2 := 10.0
	var l2 := 50.0
	var p2 := Vector3(0, 0, z)
	HalfpipeBuilder.build_segment(r2, l2, p2, self)
	_seg_data.append({"pos": p2, "radius": r2, "length": l2})
	# Left mid-wall, right high-wall
	_place_hoop(HalfpipeBuilder.mid_wall_pos("left", 0.30, r2, p2, l2), 28.0)
	_place_hoop(HalfpipeBuilder.high_wall_pos("right", 0.65, r2, p2, l2), 32.0)
	_place_coin(HalfpipeBuilder.lip_pos("right", 0.45, r2, p2, l2))
	z -= l2

	# ── Segment 3: medium, breathing room then challenge ──
	var r3 := 12.0
	var l3 := 55.0
	var p3 := Vector3(0, 0, z)
	HalfpipeBuilder.build_segment(r3, l3, p3, self)
	_seg_data.append({"pos": p3, "radius": r3, "length": l3})
	# Bottom rest, left high-wall, right lip
	_place_hoop(HalfpipeBuilder.bottom_pos(0.20, r3, p3, l3), 28.0)
	_place_hoop(HalfpipeBuilder.high_wall_pos("left", 0.45, r3, p3, l3), 32.0)
	_place_hoop(HalfpipeBuilder.lip_pos("right", 0.75, r3, p3, l3), 36.0)
	_place_coin(HalfpipeBuilder.lip_pos("left", 0.35, r3, p3, l3))
	_place_coin(HalfpipeBuilder.lip_pos("right", 0.55, r3, p3, l3))
	z -= l3

	# ── Segment 4: tight, steep — the finale ──
	var r4 := 8.0
	var l4 := 45.0
	var p4 := Vector3(0, 0, z)
	HalfpipeBuilder.build_segment(r4, l4, p4, self)
	_seg_data.append({"pos": p4, "radius": r4, "length": l4})
	# Both lips — requires mastery of wall-riding at speed
	_place_hoop(HalfpipeBuilder.lip_pos("left", 0.30, r4, p4, l4), 36.0)
	_place_hoop(HalfpipeBuilder.lip_pos("right", 0.65, r4, p4, l4), 40.0)
	_place_coin(HalfpipeBuilder.lip_pos("left", 0.50, r4, p4, l4))
	z -= l4

	# Finish
	_build_finish(z)

func _place_hoop(pos: Vector3, boost: float) -> void:
	var hoop := preload("res://scripts/obstacles/hoop.gd").new() as Hoop
	hoop.name = "Hoop"
	hoop.position = pos
	hoop.boost_strength = boost
	add_child(hoop)
	var shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 1.8
	shape.shape = sphere
	hoop.add_child(shape)
	var mesh := MeshInstance3D.new()
	mesh.mesh = _build_hex_hoop_mesh(1.8, 0.225)
	mesh.set_meta("mat_type", "boost")
	hoop.add_child(mesh)

func _place_coin(pos: Vector3) -> void:
	var coin := Area3D.new()
	coin.name = "Coin"
	coin.position = pos
	add_child(coin)
	var shape := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.35
	shape.shape = sphere
	coin.add_child(shape)
	var mesh := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.height = 0.08
	cyl.top_radius = 0.35
	cyl.bottom_radius = 0.35
	mesh.mesh = cyl
	mesh.set_meta("mat_type", "coin")
	coin.add_child(mesh)
	coin.body_entered.connect(_on_coin_collected.bind(coin))

func _on_coin_collected(body: Node3D, coin: Area3D) -> void:
	if body != player or not coin.visible:
		return
	coin.visible = false
	coin.set_deferred("monitoring", false)
	if get_node_or_null("/root/AudioManager") != null:
		AudioManager.play_sfx("coin")
	# Small sparkle
	var particles := GPUParticles3D.new()
	particles.position = coin.global_position
	particles.amount = 8
	particles.lifetime = 0.3
	particles.one_shot = true
	particles.explosiveness = 0.9
	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	mat.emission_sphere_radius = 0.1
	mat.direction = Vector3.UP
	mat.spread = 120.0
	mat.initial_velocity_min = 1.5
	mat.initial_velocity_max = 4.0
	mat.scale_min = 0.03
	mat.scale_max = 0.08
	mat.color = Color(1.0, 0.85, 0.1, 0.9)
	mat.gravity = Vector3(0.0, -8.0, 0.0)
	particles.process_material = mat
	var box := BoxMesh.new()
	box.size = Vector3(0.04, 0.04, 0.04)
	particles.draw_pass_1 = box
	add_child(particles)
	particles.emitting = true
	var tw := create_tween()
	tw.tween_callback(particles.queue_free).set_delay(0.5)

func _build_finish(finish_z: float) -> void:
	var finish := Area3D.new()
	finish.name = "FinishZone"
	finish.position = Vector3(0, 3.0, finish_z)
	add_child(finish)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(16, 6.0, 20.0)
	shape.shape = box
	finish.add_child(shape)
	finish.body_entered.connect(_on_finish)

	# Runway
	var runway := StaticBody3D.new()
	runway.name = "Seg_Runway"
	runway.position = Vector3(0, 0, finish_z - 300.0)
	add_child(runway)
	var r_mesh := MeshInstance3D.new()
	var r_box := BoxMesh.new()
	r_box.size = Vector3(12, 0.4, 600)
	r_mesh.mesh = r_box
	r_mesh.set_meta("mat_type", "track")
	runway.add_child(r_mesh)
	var r_col := CollisionShape3D.new()
	var r_shape := BoxShape3D.new()
	r_shape.size = Vector3(12, 0.4, 600)
	r_col.shape = r_shape
	runway.add_child(r_col)

func _build_hex_hoop_mesh(major_radius: float, minor_radius: float, ring_segments: int = 6, tube_segments: int = 8) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(ring_segments):
		var theta0 := float(i) / ring_segments * TAU
		var theta1 := float(i + 1) / ring_segments * TAU
		for j in range(tube_segments):
			var phi0 := float(j) / tube_segments * TAU
			var phi1 := float(j + 1) / tube_segments * TAU
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
	return st.commit()

func _torus_point(theta: float, phi: float, major: float, minor: float) -> Vector3:
	var cx := major * cos(theta)
	var cy := major * sin(theta)
	return Vector3(
		cx + minor * cos(phi) * cos(theta),
		cy + minor * cos(phi) * sin(theta),
		minor * sin(phi)
	)

func _torus_center(theta: float, major: float) -> Vector3:
	return Vector3(major * cos(theta), major * sin(theta), 0.0)

func _process(delta: float) -> void:
	if player == null or camera == null:
		return
	if _running:
		_elapsed += delta
	_follow_camera(delta)

func _follow_camera(delta: float) -> void:
	var fwd_speed := absf(player.linear_velocity.z)
	var max_possible: float = player.max_forward_speed * 1.5
	var speed_ratio: float = clampf(fwd_speed / max_possible, 0.0, 1.0)
	var curve: float = pow(speed_ratio, 1.7)

	var target_fov: float = lerpf(CAM_BASE_FOV, CAM_MAX_FOV, curve)
	camera.fov = lerpf(camera.fov, target_fov, CAM_FOV_SMOOTH * delta)

	var offset := CAM_BASE_OFFSET.lerp(CAM_MAX_OFFSET, curve)
	var target := player.global_position + offset
	camera.global_position = camera.global_position.lerp(target, CAM_SMOOTH * delta)

	# Half-pipe bank: camera rolls based on player's lateral position
	var radius_estimate: float = 12.0
	var bank := clampf(-player.global_position.x / radius_estimate, -1.0, 1.0) * 0.25
	camera.rotation.z = lerpf(camera.rotation.z, bank, CAM_SMOOTH * delta * 0.5)

	var look_target := player.global_position + Vector3(0, 0, -22)
	if camera.global_position.distance_squared_to(look_target) > 0.01:
		camera.look_at(look_target, Vector3.UP)

func _on_died() -> void:
	player.global_position = Vector3(0, 1.0, 0)
	player.linear_velocity = Vector3.ZERO
	player.angular_velocity = Vector3.ZERO

func _on_finish(body: Node3D) -> void:
	if body != player:
		return
	_running = false
	print("Finish! Time: ", _elapsed)

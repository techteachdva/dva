extends Node3D

var _fall_speed: float = 3.0
# Local height of the meadow surface under this apple (set by the tree).
var rest_y: float = 0.26
var _vy: float = 0.0
var _bounced: bool = false
var _landed: bool = false
var _decay: float = 15.0
# After landing, fruit rolls (4.7): no physics, just a smooth glide to a
# resting spot pushed by the wind and the slope, then it settles.
var _rolled: bool = false
var _roll_from := Vector3.ZERO
var _roll_to := Vector3.ZERO
var _roll_t: float = 1.0
var _roll_len: float = 0.0
var _sim: SimulationDirector = null
# "apple", "berry", "pinecone" or "pineapple"; set by the plant before it drops. Golden ones are rare
# and worth three times as much.
var kind: String = "apple"
var golden: bool = false

func _ready() -> void:
	add_to_group(kind)
	# Pineapples are fruit to every apple eater.
	if kind == "pineapple":
		add_to_group("apple")
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	var r: float = 0.18 if kind == "berry" else (0.22 if kind == "pinecone" else (0.26 if kind == "pineapple" else 0.3))
	sphere.radius = r
	sphere.height = r * 2.0
	mesh.mesh = sphere
	if kind == "pinecone":
		# A real cone of scales (one mesh shared by every pinecone).
		# A solid brown egg for the core, the scales shingled over it.
		mesh.scale = Vector3(0.6, 1.5, 0.6)
		mesh.position.y = 0.12
		var scales := MeshInstance3D.new()
		scales.mesh = _pinecone_mesh()
		scales.scale = Vector3(1.7, 0.75, 1.7) / mesh.scale * Vector3(1.0, 1.0, 1.0)
		var sm := StandardMaterial3D.new()
		sm.vertex_color_use_as_albedo = true
		sm.cull_mode = BaseMaterial3D.CULL_DISABLED
		scales.material_override = sm
		mesh.add_child(scales)
	elif kind == "pineapple":
		mesh.scale = Vector3(1.0, 1.55, 1.0)
		# The spiky green crown.
		var crown := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.14
		cone.height = 0.34
		cone.radial_segments = 5
		cone.rings = 1
		crown.mesh = cone
		var cm := StandardMaterial3D.new()
		cm.albedo_color = Color(0.25, 0.55, 0.2)
		crown.material_override = cm
		crown.position = Vector3(0.0, r * 1.55 + 0.14, 0.0)
		add_child(crown)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.4, 0.15, 0.55) if kind == "berry" else Color(0.95, 0.1, 0.05)
	var skin: String = SpriteGenerator.SPRITE_DIR + ("berry_skin.png" if kind == "berry" else "apple_skin.png")
	if kind == "pinecone":
		mat.albedo_color = Color(0.36, 0.23, 0.12)
	elif kind == "pineapple":
		mat.albedo_color = Color(0.86, 0.62, 0.16)
	elif ResourceLoader.exists(skin) and not golden:
		mat.albedo_texture = load(skin)
		mat.albedo_color = Color.WHITE
	if golden:
		mat.albedo_color = Color(1.0, 0.82, 0.2)
		mat.emission_enabled = true
		mat.emission = Color(0.9, 0.7, 0.1)
		mat.emission_energy_multiplier = 0.6
	mesh.material_override = mat
	add_child(mesh)
	# Small collision shape for raycast detection
	var area := Area3D.new()
	var col := CollisionShape3D.new()
	var s := SphereShape3D.new()
	s.radius = 0.4
	col.shape = s
	area.add_child(col)
	area.collision_layer = 2
	area.collision_mask = 0
	add_child(area)

static var _cone_mesh: ArrayMesh

# Rows of pointed woody scales spiralling round a stem, widest a third of the
# way down and tapering to a point; scales tip outward and down like a pine's.
static func _pinecone_mesh() -> ArrayMesh:
	if _cone_mesh != null:
		return _cone_mesh
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rows: int = 8
	var per: int = 8
	var height: float = 0.55
	for r: int in rows:
		var t: float = float(r) / float(rows - 1)
		var y: float = height * 0.5 - t * height
		var rad: float = (0.07 + 0.13 * sin(clampf(t * 1.3, 0.05, 1.0) * PI)) * (1.0 - t * 0.35)
		var shade: Color = Color(0.56, 0.37, 0.19).lerp(Color(0.36, 0.22, 0.11), t)
		for k: int in per:
			var a: float = (float(k) + (0.5 if r % 2 == 1 else 0.0)) / float(per) * TAU
			var out := Vector3(cos(a), 0.0, sin(a))
			var side := Vector3(-sin(a), 0.0, cos(a))
			var base := Vector3(0.0, y + 0.03, 0.0)
			var w: float = rad * 0.85
			var tip: Vector3 = out * (rad + 0.03) + Vector3(0.0, y - 0.04, 0.0)
			var l: Vector3 = base + out * rad * 0.35 + side * w
			var rr: Vector3 = base + out * rad * 0.35 - side * w
			var back: Vector3 = base - out * 0.01
			var col: Color = shade.lightened(0.12) if k % 2 == 0 else shade
			for tri: Array in [[l, tip, rr], [l, back, tip], [rr, tip, back]]:
				var n: Vector3 = ((tri[1] - tri[0]) as Vector3).cross(tri[2] - tri[0]).normalized()
				for v: Vector3 in tri:
					st.set_color(col)
					st.set_normal(n)
					st.add_vertex(v)
	_cone_mesh = st.commit()
	return _cone_mesh

func _process(delta: float) -> void:
	if not _landed:
		# Falls, bounces once in the grass, settles on the surface.
		_vy -= 14.0 * delta
		position.y += _vy * delta
		if position.y <= rest_y:
			position.y = rest_y
			if not _bounced and _vy < -3.0:
				_bounced = true
				_vy = -_vy * 0.3
			else:
				_landed = true
				_start_roll()
	elif _roll_t < 1.0:
		_roll_t = minf(_roll_t + delta / maxf(_roll_len, 0.3), 1.0)
		var e: float = 1.0 - pow(1.0 - _roll_t, 3.0)
		var p: Vector3 = _roll_from.lerp(_roll_to, e)
		p.y = _sim.ground_height(p.x, p.z) + 0.26 if _sim != null else global_position.y
		global_position = p
		rotation.x += delta * 6.0 * (1.0 - e)
	else:
		_decay -= delta * Clock.LIFE_PACE
		if _decay <= 0.0:
			_spawn_seed()
			queue_free()

# Where it rolls: downhill on a slope, carried along by the wind, further for
# round fruit than for berries. Capped, so nothing tumbles off the map.
func _start_roll() -> void:
	if _rolled:
		return
	_rolled = true
	var n := get_parent()
	while n != null and not n is SimulationDirector:
		n = n.get_parent()
	_sim = n as SimulationDirector
	if _sim == null or not is_inside_tree():
		return
	var gp: Vector3 = global_position
	var dx: float = _sim.ground_height(gp.x + 1.0, gp.z) - _sim.ground_height(gp.x - 1.0, gp.z)
	var dz: float = _sim.ground_height(gp.x, gp.z + 1.0) - _sim.ground_height(gp.x, gp.z - 1.0)
	var downhill := Vector3(-dx, 0.0, -dz) * 0.5
	var w: Vector3 = _sim.wind.sample(gp) if _sim.wind != null else Vector3.ZERO
	var roll: float = {"berry": 0.4, "apple": 1.0, "pinecone": 1.4, "pineapple": 0.8}.get(kind, 1.0)
	var push: Vector3 = (downhill * 6.0 + w * 0.35) * roll * randf_range(0.6, 1.2)
	if not push.is_finite():
		return
	push = push.limit_length(9.0)
	if push.length() < 0.3:
		return
	_roll_from = gp
	_roll_to = gp + push
	var edge: float = ValleyTerrain.WALK_RADIUS - 4.0
	var flat := Vector2(_roll_to.x, _roll_to.z)
	if flat.length() > edge:
		flat = flat.normalized() * edge
		_roll_to = Vector3(flat.x, 0.0, flat.y)
	_roll_len = 0.6 + push.length() * 0.35
	_roll_t = 0.0

func _spawn_seed() -> void:
	if randf() > 0.35:
		return
	var node := get_parent()
	var sim = null
	while node != null:
		if node.has_method("spawn_trees"):
			sim = node
			break
		node = node.get_parent()
	if sim == null:
		return
	if kind == "berry":
		if sim.has_method("plant_bush"):
			sim.plant_bush(global_position)
		return
	if not sim.can_plant_tree():
		return
	# The seed is carried downwind before it takes root (see Wind).
	var land: Vector3 = sim.wind.seed_drift(global_position) if sim.get("wind") != null else global_position
	# Each seed grows its own kind; out of its home biome it rarely takes.
	var grows: String = sim.sprout_kind(kind, land)
	if grows == "":
		return
	var tree = load("res://scenes/tree.tscn").instantiate()
	tree.conifer = grows == "conifer"
	tree.pineapple = grows == "pineapple"
	sim.get_node("Trees").add_child(tree)
	tree.global_position = sim.tree_spot(land)
	if sim.has_method("_snap_to_ground"):
		sim._snap_to_ground(tree)
	if tree.has_method("set_stage"):
		tree.set_stage(0)

func eat(eater: Variant = null) -> float:
	queue_free()
	var counter := get_parent()
	while counter != null and not counter is SimulationDirector:
		counter = counter.get_parent()
	if counter != null:
		if kind == "berry":
			counter.berries_eaten += 1
		else:
			counter.apples_eaten += 1
	# Apples are uncommon but the richest meal a producer gives.
	# Pineapples are the richest food in the valley.
	var value: float = 18.0 if kind == "berry" else (26.0 if kind == "pinecone" else (80.0 if kind == "pineapple" else 45.0))
	if golden:
		if eater is Node and eater.has_method("make_golden"):
			eater.make_golden(1.0, kind)
		var who: String = str(eater.get("species_id")) if eater is Node else str(eater)
		var node := get_parent()
		while node != null and not node is SimulationDirector:
			node = node.get_parent()
		if node != null:
			node.golden_found.emit("golden " + kind, who, global_position)
		return value * 3.0
	return value

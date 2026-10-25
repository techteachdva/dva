extends Node3D

@export var apple_spawn_interval: float = 4.0
@export var apple_drop_height: float = 3.0

var _stage: int = 2  # 0=seed, 1=sapling, 2=tree
var _growth: float = 0.0
var _seed_grow_time: float = 15.0
var _sapling_grow_time: float = 25.0
var _spawn_timer: float = 0.0
var _apple_scene: PackedScene

var _lifespan: float = 180.0
var _dying: bool = false
var _death_timer: float = 0.0
var _arboreal: bool = false

var _trunk_mesh: MeshInstance3D
var _canopy_mesh: MeshInstance3D
var _canopies: Array[MeshInstance3D] = []
var _body: StaticBody3D
var _tone: int = 0
var _season: String = ""

# One set of meshes and materials for every tree in the valley.
static var _trunk: CylinderMesh
static var _blob: SphereMesh
static var _sprout: SphereMesh
static var _seed: SphereMesh
static var _sapling_stem: CylinderMesh
static var _bark: StandardMaterial3D
static var _seed_mat: StandardMaterial3D
static var _leaf_mats: Dictionary = {}

const LEAVES: Dictionary = {
	"Spring": [Color(0.4, 0.66, 0.26), Color(0.95, 0.7, 0.78), Color(0.34, 0.58, 0.24)],
	"Summer": [Color(0.24, 0.5, 0.18), Color(0.3, 0.56, 0.2), Color(0.2, 0.44, 0.17)],
	"Autumn": [Color(0.86, 0.48, 0.16), Color(0.74, 0.26, 0.14), Color(0.9, 0.7, 0.24)],
	"Winter": [Color(0.86, 0.9, 0.94), Color(0.78, 0.84, 0.9), Color(0.9, 0.93, 0.96)],
}

static func _shared() -> void:
	if _trunk != null:
		return
	_trunk = CylinderMesh.new()
	_trunk.height = 3.0
	_trunk.top_radius = 0.28
	_trunk.bottom_radius = 0.5
	_trunk.radial_segments = 7
	_trunk.rings = 1
	_blob = SphereMesh.new()
	_blob.radius = 1.0
	_blob.height = 1.7
	_blob.radial_segments = 9
	_blob.rings = 5
	_sprout = SphereMesh.new()
	_sprout.radius = 0.45
	_sprout.height = 0.7
	_sprout.radial_segments = 7
	_sprout.rings = 4
	_seed = SphereMesh.new()
	_seed.radius = 0.22
	_seed.height = 0.3
	_seed.radial_segments = 6
	_seed.rings = 3
	_sapling_stem = CylinderMesh.new()
	_sapling_stem.height = 1.4
	_sapling_stem.top_radius = 0.06
	_sapling_stem.bottom_radius = 0.12
	_sapling_stem.radial_segments = 5
	_sapling_stem.rings = 1
	_bark = StandardMaterial3D.new()
	_bark.albedo_color = Color(0.4, 0.27, 0.17)
	_bark.roughness = 1.0
	_seed_mat = StandardMaterial3D.new()
	_seed_mat.albedo_color = Color(0.52, 0.36, 0.18)
	for season: String in LEAVES.keys():
		var mats: Array[StandardMaterial3D] = []
		for c: Color in LEAVES[season]:
			var m := StandardMaterial3D.new()
			m.albedo_color = c
			m.roughness = 0.9
			mats.append(m)
		_leaf_mats[season] = mats

func _ready() -> void:
	add_to_group("tree")
	_apple_scene = load("res://scenes/apple.tscn")
	_tone = randi() % 3
	_season = _current_season()
	_setup_visuals()

func _current_season() -> String:
	var sim := get_parent().get_parent() if get_parent() != null else null
	if sim is SimulationDirector:
		return (sim as SimulationDirector).get_season()
	return "Spring"

func set_stage(stage: int) -> void:
	_stage = stage
	_growth = 0.0
	_setup_visuals()

# Called on the "tree" group when the season turns.
func apply_season(season: String) -> void:
	if season == _season:
		return
	_season = season
	_paint_leaves()

func _leaf(i: int) -> StandardMaterial3D:
	var mats: Array = _leaf_mats.get(_season, _leaf_mats["Summer"])
	return mats[(i + _tone) % mats.size()]

func _paint_leaves() -> void:
	for i: int in _canopies.size():
		var c := _canopies[i]
		if c == null or not is_instance_valid(c):
			continue
		c.material_override = _leaf(i)
		# Winter leaves only a dusting of snow on the crown.
		if _season == "Winter" and _stage == 2:
			c.visible = i == 0
			c.scale = c.get_meta("base_scale") * Vector3(0.85, 0.35, 0.85)
		else:
			c.visible = true
			c.scale = c.get_meta("base_scale")

func _add_canopy(mesh: Mesh, pos: Vector3, s: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.position = pos
	mi.scale = s
	mi.set_meta("base_scale", s)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	_canopies.append(mi)
	return mi

func _setup_visuals() -> void:
	_shared()
	for c in get_children():
		c.queue_free()
	_trunk_mesh = null
	_canopy_mesh = null
	_canopies.clear()
	_body = null

	match _stage:
		0:  # Seed
			var mesh := MeshInstance3D.new()
			mesh.mesh = _seed
			mesh.material_override = _seed_mat
			mesh.position.y = 0.1
			add_child(mesh)
		1:  # Sapling
			var mesh := MeshInstance3D.new()
			mesh.mesh = _sapling_stem
			mesh.material_override = _bark
			mesh.position.y = 0.7
			add_child(mesh)
			_add_canopy(_sprout, Vector3(0.0, 1.5, 0.0), Vector3.ONE)
			_add_canopy(_sprout, Vector3(0.25, 1.15, 0.1), Vector3.ONE * 0.6)
			_paint_leaves()
			# Small static body
			_body = StaticBody3D.new()
			var col := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(0.4, 1.5, 0.4)
			col.shape = box
			_body.add_child(col)
			_body.collision_layer = 1
			add_child(_body)
		2:  # Tree
			var size: float = randf_range(0.85, 1.2)
			_trunk_mesh = MeshInstance3D.new()
			_trunk_mesh.mesh = _trunk
			_trunk_mesh.material_override = _bark
			_trunk_mesh.position.y = 1.5 * size
			_trunk_mesh.scale = Vector3(size, size, size)
			_trunk_mesh.rotation.y = randf() * TAU
			add_child(_trunk_mesh)
			_canopy_mesh = _add_canopy(_blob, Vector3(0.0, 3.9, 0.0) * size, Vector3(2.0, 1.6, 2.0) * size)
			var spin: float = randf() * TAU
			for k: int in 3:
				var a: float = spin + float(k) * TAU / 3.0
				var r: float = randf_range(0.9, 1.3) * size
				var off := Vector3(cos(a) * r, randf_range(2.9, 3.5) * size, sin(a) * r)
				_add_canopy(_blob, off, Vector3.ONE * randf_range(1.15, 1.45) * size)
			_paint_leaves()

			_body = StaticBody3D.new()
			var col2 := CollisionShape3D.new()
			var box2 := BoxShape3D.new()
			box2.size = Vector3(3.0, 5.5, 3.0)
			col2.shape = box2
			_body.add_child(col2)
			_body.collision_layer = 1
			add_child(_body)

func _process(real_delta: float) -> void:
	# Trees live on the slow life clock, like everything else alive.
	var delta: float = real_delta * Clock.LIFE_PACE
	if _dying:
		_death_timer += delta
		if _death_timer >= 20.0:
			var parent = get_parent()
			if parent != null:
				var sim = parent.get_parent()
				if sim != null and sim is SimulationDirector:
					var sd := sim as SimulationDirector
					if sd.rot != null:
						sd.rot.add_density_at_world(global_position, 2.0)
			queue_free()
			return
		return
	match _stage:
		0:
			_growth += delta
			if _growth >= _seed_grow_time:
				set_stage(1)
		1:
			_growth += delta
			if _growth >= _sapling_grow_time:
				set_stage(2)
		2:
			_lifespan -= delta
			if _lifespan <= 0.0:
				_dying = true
				_death_timer = 0.0
				return
			_spawn_timer += delta
			if _spawn_timer >= apple_spawn_interval:
				_spawn_timer = 0.0
				_spawn_apple()

func _spawn_apple() -> void:
	if _apple_scene == null:
		return
	var apple = _apple_scene.instantiate()
	# Apples drop from the edge of the crown, not down the trunk, and come
	# to rest on top of the meadow wherever they land.
	var ang: float = randf() * TAU
	var r: float = randf_range(1.6, 3.2)
	var off := Vector3(cos(ang) * r, 0.0, sin(ang) * r)
	var ground: float = global_position.y
	var sim = get_parent().get_parent() if get_parent() != null else null
	if sim is SimulationDirector:
		ground = (sim as SimulationDirector).ground_height(global_position.x + off.x, global_position.z + off.z)
	apple.rest_y = ground - global_position.y + 0.26
	add_child(apple)
	apple.position = Vector3(off.x, apple_drop_height + randf() * 1.2, off.z)

func mark_arboreal() -> void:
	_arboreal = true

# Felling a grown tree yields timber and leaves a stump that sprouts again,
# so a wood keeps giving apples and wood if it isn't cut faster than it grows.
func harvest() -> bool:
	if _arboreal:
		return false
	if _stage != 2:
		return false
	_growth = 0.0
	set_stage(1)
	return true

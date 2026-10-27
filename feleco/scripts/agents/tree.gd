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
# A berry bush is this same plant kept low: a short, wide tangle of branches
# with berry clusters at the tips instead of apples.
@export var bush: bool = false
# Moss on the bark of grown trees (0..1). Grazers and browsers eat it.
# A rare tree grows star moss: a bright, very rich patch.
var moss: float = 0.0
var star_moss: bool = false
var _moss_shown: int = -1
const GOLDEN_APPLE_CHANCE: float = 0.02
const GOLDEN_BERRY_CHANCE: float = 0.03
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
static var _blob: Mesh
static var _sprout: SphereMesh
static var _seed: SphereMesh
static var _sapling_stem: CylinderMesh
static var _bark: StandardMaterial3D
static var _seed_mat: StandardMaterial3D
static var _leaf_mats: Dictionary = {}
static var _limb: CylinderMesh
static var _dot: SphereMesh
static var _leaf_mesh: Mesh
static var _dot_mat: StandardMaterial3D
static var _shade_quad: QuadMesh
static var _shade_mat: ShaderMaterial

# Every tree's ground shadow is one flat quad sharing this material, so the
# director swings them all with the sun by setting three uniforms.
static func set_sun(dir: Vector2, stretch: float, fade: float) -> void:
	if _shade_mat == null:
		return
	_shade_mat.set_shader_parameter("sun_dir", dir)
	_shade_mat.set_shader_parameter("stretch", stretch)
	_shade_mat.set_shader_parameter("fade", fade)

var _segments: Array = []  # [from, to, radius] of every branch
var _tips: Array[Vector3] = []
var _leaves: MultiMeshInstance3D
var _dress: MultiMeshInstance3D
var _rng := RandomNumberGenerator.new()
# Apples growing on the branches: [local position, age]. Each starts as a
# small green bud at a branch tip, swells and reddens, and drops when ripe.
var _fruit: Array = []
var _fruit_mm: MultiMeshInstance3D
const RIPEN_TICKS: float = 3.0  # spawn intervals from bud to drop
const MAX_FRUIT: int = 6
# Each producer has its season. Buds set through the growing months, but
# fruit only lets go once ripe: berries in summer, apples in autumn. In the
# season after, the last stragglers still drop; then the branches are bare.
const BUD_SEASONS: Dictionary = {"apple": ["Spring", "Summer", "Autumn"], "berry": ["Spring", "Summer"]}
const RIPE_SEASONS: Dictionary = {"apple": ["Autumn", "Winter"], "berry": ["Summer", "Autumn"]}
var _size: float = 1.0

# A faceted copy of a mesh (flat normals), to match the low-poly hills.
static func _faceted(mesh: Mesh) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.create_from(mesh, 0)
	st.deindex()
	st.generate_normals()
	return st.commit()

# Seasons. Grown trees are a branching skeleton (after CyberMorph's Lexicon
# Tree) with hundreds of small faceted leaves clustered at the branch tips.
# [leaf share kept, leaf colours, blossom share, apples per tree]
const SEASON_LOOK: Dictionary = {
	"Spring": [1.0, [Color(0.5, 0.74, 0.32), Color(0.42, 0.66, 0.28), Color(0.58, 0.78, 0.36)], 0.32, 0],
	"Summer": [1.0, [Color(0.24, 0.5, 0.18), Color(0.3, 0.56, 0.21), Color(0.19, 0.42, 0.16), Color(0.34, 0.6, 0.24)], 0.0, 10],
	"Autumn": [0.7, [Color(0.86, 0.5, 0.15), Color(0.74, 0.28, 0.12), Color(0.92, 0.72, 0.24), Color(0.55, 0.5, 0.2)], 0.0, 14],
	"Winter": [0.0, [Color(0.3, 0.4, 0.26)], 0.0, 0],
}
const BLOSSOM: Array = [Color(1.0, 0.98, 0.97), Color(0.98, 0.8, 0.88), Color(1.0, 0.9, 0.94), Color(0.96, 0.72, 0.84)]
# Saplings keep simple leaf balls, coloured by season.
const LEAVES: Dictionary = {
	"Spring": [Color(0.46, 0.7, 0.3), Color(0.4, 0.64, 0.27), Color(0.52, 0.74, 0.34)],
	"Summer": [Color(0.24, 0.5, 0.18), Color(0.29, 0.55, 0.2), Color(0.2, 0.44, 0.17)],
	"Autumn": [Color(0.84, 0.5, 0.17), Color(0.7, 0.3, 0.13), Color(0.88, 0.68, 0.24)],
	"Winter": [Color(0.42, 0.36, 0.26), Color(0.42, 0.36, 0.26), Color(0.42, 0.36, 0.26)],
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
	var blob := SphereMesh.new()
	blob.radius = 1.0
	blob.height = 1.7
	blob.radial_segments = 8
	blob.rings = 4
	_blob = _faceted(blob)
	_limb = CylinderMesh.new()
	_limb.height = 1.0
	_limb.top_radius = 0.72
	_limb.bottom_radius = 1.0
	_limb.radial_segments = 6
	_limb.rings = 1
	# A leaf: a flattened octahedron, faceted.
	var leaf := SphereMesh.new()
	leaf.radius = 1.0
	leaf.height = 2.0
	leaf.radial_segments = 4
	leaf.rings = 2
	_leaf_mesh = _faceted(leaf)
	_dot = SphereMesh.new()
	_dot.radius = 1.0
	_dot.height = 2.0
	_dot.radial_segments = 5
	_dot.rings = 3
	_shade_quad = QuadMesh.new()
	_shade_quad.size = Vector2(1.0, 1.0)
	_shade_quad.orientation = PlaneMesh.FACE_Y
	_shade_mat = ShaderMaterial.new()
	_shade_mat.shader = preload("res://scripts/agents/tree_shadow.gdshader")
	var shadow_tex := SpriteGenerator.SPRITE_DIR + "shadow.png"
	_shade_mat.set_shader_parameter("blob", load(shadow_tex) if ResourceLoader.exists(shadow_tex) else ImageTexture.create_from_image(SpriteGenerator.shadow_image()))
	_dot_mat = StandardMaterial3D.new()
	_dot_mat.vertex_color_use_as_albedo = true
	_dot_mat.roughness = 0.7
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
	var bark_tex := SpriteGenerator.SPRITE_DIR + "bark.png"
	if ResourceLoader.exists(bark_tex):
		# Baked furrowed bark, wrapped round every limb (triplanar: no seams).
		_bark.albedo_texture = load(bark_tex)
		_bark.albedo_color = Color(1.0, 0.95, 0.9)
		_bark.uv1_triplanar = true
		_bark.uv1_scale = Vector3(1.6, 1.6, 1.6)
	else:
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
	add_to_group("bush" if bush else "tree")
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
		# Winter strips the crown: only a few dark evergreen-ish tufts stay.
		if _season == "Winter" and _stage == 2:
			c.visible = i % 3 == 0
			c.scale = c.get_meta("base_scale") * 0.4
		else:
			c.visible = true
			c.scale = c.get_meta("base_scale")
	if _stage == 2:
		_dress_crown()

# Season dressing for a grown tree: leaves (and blossom) at the tips,
# apples hanging under them, or snow along the bare limbs.
func _dress_crown() -> void:
	if _leaves == null or _tips.is_empty():
		return
	var look: Array = SEASON_LOOK.get(_season, SEASON_LOOK["Summer"])
	_rng.seed = hash(get_instance_id())
	var per_tip: int = 5 if bush else 15
	var leaf_cols: Array = look[1]
	var keep: float = float(look[0])
	var xforms: Array[Transform3D] = []
	var cols: Array[Color] = []
	for tip: Vector3 in _tips:
		for k: int in per_tip:
			# Golden-angle spiral around the tip: a little cloud of leaves.
			var a: float = float(k) * 2.39996 + tip.x
			var y: float = 1.0 - 2.0 * (float(k) + 0.5) / float(per_tip)
			var rr: float = sqrt(1.0 - y * y)
			var dir := Vector3(cos(a) * rr, y * 0.8 + 0.2, sin(a) * rr)
			var p: Vector3 = tip + dir * _rng.randf_range(0.25, 0.78) * _size
			var keep_roll: float = _rng.randf()
			var bloom_roll: float = _rng.randf()
			var sz: float = _rng.randf_range(0.17, 0.25) * _size
			var basis := Basis(Vector3(_rng.randf_range(-1, 1), 1, _rng.randf_range(-1, 1)).normalized(), _rng.randf() * TAU)
			var tint: int = _rng.randi()
			var shade: float = _rng.randf_range(0.88, 1.08)
			if keep_roll > keep:
				continue
			if bloom_roll < float(look[2]):
				xforms.append(Transform3D(basis * Basis.from_scale(Vector3(sz * 0.6, sz * 0.5, sz * 0.6)), p + dir * 0.08))
				cols.append(BLOSSOM[tint % BLOSSOM.size()])
			else:
				xforms.append(Transform3D(basis * Basis.from_scale(Vector3(sz, sz * 0.4, sz * 0.7)), p))
				cols.append((leaf_cols[tint % leaf_cols.size()] as Color) * shade * (0.82 if dir.y < 0.0 else 1.0))
	var lm: MultiMesh = _leaves.multimesh
	lm.instance_count = xforms.size()
	for i: int in xforms.size():
		lm.set_instance_transform(i, xforms[i])
		lm.set_instance_color(i, cols[i])
	# Apples ripen from green to red under the leaves; winter snow lies on the limbs.
	var d_x: Array[Transform3D] = []
	var d_c: Array[Color] = []
	if _season == "Winter":
		for seg: Array in _segments:
			var f: Vector3 = seg[0]
			var t: Vector3 = seg[1]
			if (t - f).normalized().y > 0.9:
				continue
			for j: int in 2:
				var q: Vector3 = f.lerp(t, _rng.randf_range(0.2, 0.9)) + Vector3.UP * float(seg[2]) * 0.9
				var w: float = float(seg[2]) * 1.6 + 0.05
				d_x.append(Transform3D(Basis().scaled(Vector3(w, w * 0.45, w)), q))
				d_c.append(Color(0.95, 0.97, 1.0))
	# Moss: soft green pads low on the trunk and limbs, star moss in gold.
	var pads: int = int(round(moss * 10.0))
	_moss_shown = pads
	if not bush and pads > 0:
		for k: int in pads:
			var seg: Array = _segments[k % mini(_segments.size(), 6)]
			var q: Vector3 = (seg[0] as Vector3).lerp(seg[1], _rng.randf_range(0.1, 0.7))
			var side := Vector3(_rng.randf_range(-1, 1), 0.0, _rng.randf_range(-1, 1)).normalized() * float(seg[2]) * 0.9
			var w: float = float(seg[2]) * 0.9 + 0.08
			d_x.append(Transform3D(Basis().scaled(Vector3(w, w * 0.7, w)), q + side))
			d_c.append(Color(0.98, 0.85, 0.3) if star_moss and k % 3 == 0 else Color(0.3, 0.55, 0.22) * _rng.randf_range(0.85, 1.1))
	var dm: MultiMesh = _dress.multimesh
	dm.instance_count = d_x.size()
	for i: int in d_x.size():
		dm.set_instance_transform(i, d_x[i])
		dm.set_instance_color(i, d_c[i])

# One limb and its children: each fork splits into two or three, shorter,
# thinner and spreading, the trunk's lean carried up into the crown.
func _branch(from: Vector3, dir: Vector3, length: float, radius: float, depth: int) -> void:
	var to: Vector3 = from + dir * length
	_segments.append([from, to, radius])
	if depth == 0:
		_tips.append(to)
		return
	var n: int = 3 if depth % 2 == 0 else 2
	var spin: float = _rng.randf() * TAU
	for i: int in n:
		var a: float = spin + float(i) / float(n) * TAU + _rng.randf_range(-0.35, 0.35)
		var spread: float = 0.85 if depth >= 3 else 0.65
		var nd: Vector3 = (dir + Vector3(cos(a) * spread, 0.28, sin(a) * spread)).normalized()
		_branch(to, nd, length * _rng.randf_range(0.66, 0.78), radius * 0.62, depth - 1)

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
	_segments.clear()
	_tips.clear()
	_leaves = null
	_dress = null
	_fruit_mm = null
	_fruit.clear()
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
			_size = randf_range(0.85, 1.2)
			_rng.seed = hash(get_instance_id()) * 7
			_segments.clear()
			_tips.clear()
			var lean := Vector3(_rng.randf_range(-0.08, 0.08), 1.0, _rng.randf_range(-0.08, 0.08)).normalized()
			if bush:
				# Several low stems fanning out from the ground, two forks each.
				_size = randf_range(0.45, 0.6)
				for s: int in 4:
					var a: float = float(s) / 4.0 * TAU + _rng.randf_range(-0.4, 0.4)
					_branch(Vector3.ZERO, Vector3(cos(a) * 0.9, 0.7, sin(a) * 0.9).normalized(), 1.1 * _size, 0.12 * _size, 2)
			else:
				_branch(Vector3.ZERO, lean, 1.9 * _size, 0.34 * _size, 4)
				star_moss = _rng.randf() < minf(0.04 * _golden_mult(), 0.05)
			# All limbs merged into one mesh: one draw per tree.
			var st := SurfaceTool.new()
			for seg: Array in _segments:
				var f: Vector3 = seg[0]
				var t: Vector3 = seg[1]
				var seg_len: float = f.distance_to(t)
				var r: float = seg[2]
				var b := Basis(Quaternion(Vector3.UP, (t - f).normalized())) * Basis.from_scale(Vector3(r, seg_len * 1.04, r))
				st.append_from(_limb, 0, Transform3D(b, (f + t) * 0.5))
			_trunk_mesh = MeshInstance3D.new()
			_trunk_mesh.mesh = st.commit()
			_trunk_mesh.material_override = _bark
			add_child(_trunk_mesh)
			_leaves = MultiMeshInstance3D.new()
			var lmm := MultiMesh.new()
			lmm.transform_format = MultiMesh.TRANSFORM_3D
			lmm.use_colors = true
			lmm.mesh = _leaf_mesh
			_leaves.multimesh = lmm
			_leaves.material_override = _dot_mat
			add_child(_leaves)
			_fruit.clear()
			_fruit_mm = MultiMeshInstance3D.new()
			var fmm := MultiMesh.new()
			fmm.transform_format = MultiMesh.TRANSFORM_3D
			fmm.use_colors = true
			fmm.mesh = _dot
			_fruit_mm.multimesh = fmm
			_fruit_mm.material_override = _dot_mat
			_fruit_mm.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(_fruit_mm)
			# The tree's painted shadow, swung by the sun (see set_sun).
			var shade := MeshInstance3D.new()
			shade.mesh = _shade_quad
			shade.material_override = _shade_mat
			shade.position.y = 0.06
			shade.scale = Vector3(3.6, 1.0, 3.6) * _size
			shade.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			shade.extra_cull_margin = 8.0
			add_child(shade)
			_dress = MultiMeshInstance3D.new()
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.mesh = _dot
			_dress.multimesh = mm
			_dress.material_override = _dot_mat
			_dress.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(_dress)
			_paint_leaves()

			_body = StaticBody3D.new()
			var col2 := CollisionShape3D.new()
			var box2 := BoxShape3D.new()
			box2.size = Vector3(1.6, 1.2, 1.6) if bush else Vector3(3.0, 5.5, 3.0)
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
				_grow_fruit()
				_grow_moss()

# One spawn interval of orchard life: every apple on the branches ages, the
# ripe ones drop, and a new bud sets at a branch tip (none while the tree
# is bare in winter, but apples already set still ripen and fall).
func _grow_fruit() -> void:
	var kind: String = "berry" if bush else "apple"
	var ripe_now: bool = (RIPE_SEASONS[kind] as Array).has(_season)
	# A few at a time, so a tree feeds the valley through its season.
	var drops_left: int = 2 if bush else 1
	var kept: Array = []
	for f: Array in _fruit:
		f[1] = minf(f[1] + 1.0, RIPEN_TICKS)
		if f[1] >= RIPEN_TICKS and ripe_now and drops_left > 0:
			drops_left -= 1
			_spawn_apple(f[0])
		else:
			kept.append(f)
	_fruit = kept
	var cap: int = 10 if bush else MAX_FRUIT
	if (BUD_SEASONS[kind] as Array).has(_season) and _fruit.size() < cap and not _tips.is_empty():
		var tip: Vector3 = _tips[randi() % _tips.size()]
		var hang := Vector3(randf_range(-0.3, 0.3), -0.35, randf_range(-0.3, 0.3)) * _size
		_fruit.append([tip + hang, 0.0])
	_show_fruit()

func _golden_mult() -> float:
	var sim = get_parent().get_parent() if get_parent() != null else null
	return float(sim.golden_mult) if sim is SimulationDirector else 1.0

# Moss is the rarest producer. It creeps over the bark in the damp and is
# thickest (and ripest) in winter; it dies back in summer heat and drought.
func _grow_moss() -> void:
	if bush:
		return
	var sim = get_parent().get_parent() if get_parent() != null else null
	var wet: bool = sim is SimulationDirector and (sim as SimulationDirector).is_raining()
	var dry: bool = sim is SimulationDirector and (sim as SimulationDirector).is_drought()
	var rate: float = {"Spring": 0.02, "Summer": 0.005, "Autumn": 0.04, "Winter": 0.06}.get(_season, 0.03)
	if wet:
		rate *= 2.5
	if dry:
		rate = -0.05
	moss = clampf(moss + rate, 0.0, 1.0)
	if int(round(moss * 10.0)) != _moss_shown:
		_dress_crown()

# A browser's bite of moss. Returns what it got; star moss is worth five.
func eat_moss(amount: float, eater: Variant = null) -> float:
	if bush or _stage != 2 or moss <= 0.0:
		return 0.0
	var took: float = minf(moss, amount)
	moss -= took
	if int(round(moss * 10.0)) != _moss_shown:
		_dress_crown()
	if star_moss:
		var sim = get_parent().get_parent() if get_parent() != null else null
		if eater is Node and eater.has_method("make_golden"):
			eater.make_golden(1.0, "moss")
		if sim is SimulationDirector:
			sim.golden_found.emit("star moss", str(eater.get("species_id")) if eater is Node else "", global_position)
		return took * 5.0
	return took

func _show_fruit() -> void:
	if _fruit_mm == null:
		return
	var mm: MultiMesh = _fruit_mm.multimesh
	mm.instance_count = _fruit.size()
	for i: int in _fruit.size():
		var f: Array = _fruit[i]
		var ripe: float = clampf(float(f[1]) / (RIPEN_TICKS - 1.0), 0.0, 1.0)
		var r: float = lerpf(0.06, 0.19, ripe) * _size * (1.4 if bush else 1.0)
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(r, r * 0.95, r)), f[0] - Vector3(0, r, 0)))
		var ripe_col := Color(0.38, 0.16, 0.5) if bush else Color(0.88, 0.12, 0.08)
		mm.set_instance_color(i, Color(0.55, 0.72, 0.22).lerp(ripe_col, ripe))

# A ripe apple lets go of its branch and falls to the grass right below.
func _spawn_apple(at: Vector3) -> void:
	if _apple_scene == null:
		return
	var apple = _apple_scene.instantiate()
	var ground: float = global_position.y
	var sim = get_parent().get_parent() if get_parent() != null else null
	if sim is SimulationDirector:
		ground = (sim as SimulationDirector).ground_height(global_position.x + at.x, global_position.z + at.z)
	apple.rest_y = ground - global_position.y + 0.26
	apple.kind = "berry" if bush else "apple"
	if sim is SimulationDirector:
		if bush:
			(sim as SimulationDirector).berries_dropped += 1
		else:
			(sim as SimulationDirector).apples_dropped += 1
	# Never more than 1 in 20 fruit is golden, even in a Golden Year.
	apple.golden = randf() < minf((GOLDEN_BERRY_CHANCE if bush else GOLDEN_APPLE_CHANCE) * _golden_mult(), 0.05)
	add_child(apple)
	apple.position = at

func mark_arboreal() -> void:
	_arboreal = true

# Felling a grown tree yields timber and leaves a stump that sprouts again,
# so a wood keeps giving apples and wood if it isn't cut faster than it grows.
func harvest() -> bool:
	if _arboreal or bush:
		return false
	if _stage != 2:
		return false
	_growth = 0.0
	set_stage(1)
	return true

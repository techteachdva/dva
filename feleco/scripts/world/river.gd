class_name River
extends Node3D

# The valley's river (4.7): born high in the peaks on one side, it runs down
# its gorge through a pass, meanders across the meadow and leaves by the
# opposite pass. The course is new every run (which passes, how it bends) but
# always one clean, readable ribbon. Flood only changes the wet width.

const BASE_HALF_WIDTH: float = 2.7
# How far the channel sits below the meadow, so it has real banks.
const BED_LEVEL: float = -0.95
const CELL: float = 2.0

var flood_scale: float = 1.0
var _points: PackedVector3Array = PackedVector3Array()
var _wet: PackedByteArray = PackedByteArray()
# Cells close enough to the bed that a creature there might be in deep water.
# Lets walkers skip the per-segment sample() almost everywhere.
var _near: PackedByteArray = PackedByteArray()
var _grid_w: int = 64
var _grid_h: int = 64
var _grid_origin := Vector2(-64.0, -64.0)
var _grid_cell: float = CELL
var _mesh_instance: MeshInstance3D

func half_width() -> float:
	return BASE_HALF_WIDTH * flood_scale

# The bed runs past the meadow through both passes; the stretches beyond
# COPSE_RADIUS disappear into the boundary copses.
const REACH: float = 158.0
# The course, picked by plan_course() before the terrain is built so the
# terrain can carve the river's gorge.
var planned: bool = false
var _along := Vector2(0.0, 1.0)
var _across := Vector2(1.0, 0.0)
var _mean: Array = []  # [amplitude, cycles over the meadow, phase] x3

func plan_course(seed_value: int) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	# Through the north/south passes or the east/west ones, either way round.
	var axes: Array[Vector2] = [Vector2(0, 1), Vector2(0, -1), Vector2(1, 0), Vector2(-1, 0)]
	_along = axes[rng.randi() % 4]
	_across = Vector2(-_along.y, _along.x)
	# Long sweeping meanders and a slight wander. Tighter curves than this would
	# fold the channel over itself.
	_mean = [
		[rng.randf_range(6.5, 9.0), rng.randf_range(1.0, 1.2), rng.randf() * TAU],
		[rng.randf_range(1.5, 2.5), rng.randf_range(1.8, 2.2), rng.randf() * TAU],
		[rng.randf_range(0.2, 0.4), rng.randf_range(3.2, 3.8), rng.randf() * TAU],
	]
	planned = true

# (along, across) coordinates of a world point.
func to_course(x: float, z: float) -> Vector2:
	return Vector2(x * _along.x + z * _along.y, x * _across.x + z * _across.y)

func _bends(u: float) -> float:
	var t: float = (u + 34.0) / 68.0
	var w: float = 0.0
	for m: Array in _mean:
		w += sin(t * TAU * float(m[1]) + float(m[2])) * float(m[0])
	return w

# The centre line's sideways offset at a distance along the course: free to
# wander on the meadow, eased onto the pass line up through the gorges.
func course_offset(u: float) -> float:
	var pass_k: float = smoothstep(32.0, 58.0, absf(u))
	return _bends(u) * (1.0 - pass_k) + sin(u * 0.09) * 1.5 * pass_k

# How far a point is across from the bed (cheap: no path search), for carving.
func across_distance(x: float, z: float) -> float:
	var c := to_course(x, z)
	# Measured square to the channel, or the banks pinch in on the bends.
	var slope: float = course_offset(c.x + 0.5) - course_offset(c.x - 0.5)
	return absf(c.y - course_offset(c.x)) / sqrt(1.0 + slope * slope)

# The gorge floor along the course: the source end climbs into the peaks,
# the outflow end keeps falling, cutting a slot out through its pass.
func bed_height(u: float) -> float:
	if u < 0.0:
		return lerpf(BED_LEVEL, 11.0, smoothstep(ValleyTerrain.FLOOR_RADIUS, REACH, -u))
	return lerpf(BED_LEVEL, BED_LEVEL - 0.35, smoothstep(ValleyTerrain.FLOOR_RADIUS, REACH, u))
const COPSE_RADIUS: float = ValleyTerrain.FLOOR_RADIUS

# Smoothed course and running distance along it (fish swim by distance).
var _path := PackedVector3Array()
var _dist := PackedFloat32Array()
# Distances along the path where the river enters and leaves the meadow.
var copse_s := Vector2.ZERO

func generate(terrain: ValleyTerrain) -> void:
	if not planned:
		plan_course(randi())
	_points = PackedVector3Array()
	var steps := 150
	var last_y: float = INF
	for i: int in steps + 1:
		var u: float = lerpf(-REACH, REACH, float(i) / float(steps))
		var w: float = course_offset(u)
		var x: float = _along.x * u + _across.x * w
		var z: float = _along.y * u + _across.y * w
		# Water never runs uphill: each step is at most level with the last.
		var y: float = minf(terrain.surface_height(x, z) + 0.25, last_y)
		last_y = y
		_points.append(Vector3(x, y, z))
	_build_path()
	_rebuild_mesh()

func _build_path() -> void:
	_path = PackedVector3Array()
	var n: int = _points.size()
	for i: int in range(n - 1):
		var p0: Vector3 = _points[maxi(i - 1, 0)]
		var p1: Vector3 = _points[i]
		var p2: Vector3 = _points[i + 1]
		var p3: Vector3 = _points[mini(i + 2, n - 1)]
		for k: int in SUBDIV:
			var t: float = float(k) / float(SUBDIV)
			var t2: float = t * t
			var t3: float = t2 * t
			_path.append(0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t2 + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t3))
	_path.append(_points[n - 1])
	_dist = PackedFloat32Array()
	_dist.resize(_path.size())
	var total: float = 0.0
	copse_s = Vector2(-1.0, 0.0)
	for i: int in _path.size():
		if i > 0:
			total += _path[i].distance_to(_path[i - 1])
		_dist[i] = total
		var inside: bool = Vector2(_path[i].x, _path[i].z).length() < COPSE_RADIUS
		if inside:
			if copse_s.x < 0.0:
				copse_s.x = total
			copse_s.y = total

func length() -> float:
	return _dist[_dist.size() - 1] if _dist.size() > 0 else 0.0

func _segment(s: float) -> int:
	var lo: int = 0
	var hi: int = _dist.size() - 1
	while hi - lo > 1:
		var mid: int = (lo + hi) / 2
		if _dist[mid] <= s:
			lo = mid
		else:
			hi = mid
	return lo

const BED_DEPTH: float = 1.45

# A point on the bottom of the channel, under the clear water.
func bed_point(s: float) -> Vector3:
	var p := point_at(s)
	p.y -= BED_DEPTH
	return p

func point_at(s: float) -> Vector3:
	if _path.size() < 2:
		return Vector3.ZERO
	s = clampf(s, 0.0, length())
	var i: int = _segment(s)
	var span: float = maxf(_dist[i + 1] - _dist[i], 0.0001)
	return _path[i].lerp(_path[i + 1], (s - _dist[i]) / span)

func tangent_at(s: float) -> Vector3:
	if _path.size() < 2:
		return Vector3(0, 0, 1)
	var i: int = _segment(clampf(s, 0.0, length()))
	var t := _path[i + 1] - _path[i]
	t.y = 0.0
	return t.normalized() if t.length_squared() > 0.0001 else Vector3(0, 0, 1)

func nearest_s(x: float, z: float) -> float:
	var best: float = INF
	var best_s: float = 0.0
	for i: int in _path.size():
		var dx: float = _path[i].x - x
		var dz: float = _path[i].z - z
		var d: float = dx * dx + dz * dz
		if d < best:
			best = d
			best_s = _dist[i]
	return best_s

func bake(grass: CALayer) -> void:
	_grid_w = grass.grid_width
	_grid_h = grass.grid_height
	var o: Vector3 = grass.grid_to_world(0, 0)
	_grid_cell = grass.cell_size
	_grid_origin = Vector2(o.x, o.z)
	_wet.resize(_grid_w * _grid_h)
	_wet.fill(0)
	_near.resize(_grid_w * _grid_h)
	_near.fill(0)
	var reach: float = half_width()
	var near_reach: float = reach + CELL * 0.75
	# Each segment only marks the cells inside its own padded bounding box,
	# instead of every cell measuring its distance to every segment.
	var origin: Vector3 = grass.grid_to_world(0, 0)
	var cell: float = grass.cell_size
	var near_sq: float = near_reach * near_reach
	var reach_sq: float = reach * reach
	for i: int in range(maxi(_points.size() - 1, 0)):
		var a: Vector3 = _points[i]
		var b: Vector3 = _points[i + 1]
		var abx: float = b.x - a.x
		var abz: float = b.z - a.z
		var denom: float = abx * abx + abz * abz
		var gx0: int = maxi(int(floor((minf(a.x, b.x) - near_reach - origin.x) / cell)), 0)
		var gx1: int = mini(int(ceil((maxf(a.x, b.x) + near_reach - origin.x) / cell)), _grid_w - 1)
		var gz0: int = maxi(int(floor((minf(a.z, b.z) - near_reach - origin.z) / cell)), 0)
		var gz1: int = mini(int(ceil((maxf(a.z, b.z) + near_reach - origin.z) / cell)), _grid_h - 1)
		for gz: int in range(gz0, gz1 + 1):
			var pz: float = origin.z + float(gz) * cell
			for gx: int in range(gx0, gx1 + 1):
				var idx: int = gz * _grid_w + gx
				if _wet[idx] == 1:
					continue
				var px: float = origin.x + float(gx) * cell
				var u: float = 0.0 if denom < 0.0001 else clampf(((px - a.x) * abx + (pz - a.z) * abz) / denom, 0.0, 1.0)
				var dx: float = px - (a.x + abx * u)
				var dz: float = pz - (a.z + abz * u)
				var d_sq: float = dx * dx + dz * dz
				if d_sq <= near_sq:
					_near[idx] = 1
					if d_sq <= reach_sq:
						_wet[idx] = 1

func covers_world(x: float, z: float) -> bool:
	if _wet.is_empty():
		return _distance_to_bed(x, z) <= half_width()
	var gx: int = clampi(int(round((x - _grid_origin.x) / _grid_cell)), 0, _grid_w - 1)
	var gz: int = clampi(int(round((z - _grid_origin.y) / _grid_cell)), 0, _grid_h - 1)
	return _wet[gz * _grid_w + gx] == 1

func is_near(x: float, z: float) -> bool:
	if _near.is_empty():
		return true
	var gx: int = clampi(int(round((x - _grid_origin.x) / _grid_cell)), 0, _grid_w - 1)
	var gz: int = clampi(int(round((z - _grid_origin.y) / _grid_cell)), 0, _grid_h - 1)
	return _near[gz * _grid_w + gx] == 1

func sample(x: float, z: float) -> Dictionary:
	# Squared distances only, and the result vectors are built once at the end.
	var best_sq := INF
	var best_i: int = -1
	var best_u: float = 0.0
	for i: int in range(maxi(_points.size() - 1, 0)):
		var a: Vector3 = _points[i]
		var b: Vector3 = _points[i + 1]
		var abx: float = b.x - a.x
		var abz: float = b.z - a.z
		var denom: float = abx * abx + abz * abz
		var u: float = 0.0 if denom < 0.0001 else clampf(((x - a.x) * abx + (z - a.z) * abz) / denom, 0.0, 1.0)
		var dx: float = x - (a.x + abx * u)
		var dz: float = z - (a.z + abz * u)
		var d_sq: float = dx * dx + dz * dz
		if d_sq < best_sq:
			best_sq = d_sq
			best_i = i
			best_u = u
	var closest := Vector3.ZERO
	var tangent := Vector3(0.0, 0.0, 1.0)
	if best_i >= 0:
		var a: Vector3 = _points[best_i]
		var b: Vector3 = _points[best_i + 1]
		closest = a.lerp(b, best_u)
		var tang := Vector3(b.x - a.x, 0.0, b.z - a.z)
		if tang.length_squared() > 0.0001:
			tangent = tang.normalized()
	var best: float = sqrt(best_sq)
	return {
		"closest": closest,
		"tangent": tangent,
		"distance": best,
		"in_water": best <= half_width(),
	}

# A spot in the meadow stretch of the river (not inside the copses).
func random_point() -> Vector3:
	if _path.size() < 2:
		return Vector3.ZERO
	var s: float = randf_range(copse_s.x, copse_s.y)
	var tangent := tangent_at(s)
	var lateral := Vector3(-tangent.z, 0.0, tangent.x) * randf_range(-0.7, 0.7) * half_width()
	return point_at(s) + lateral

func set_flood(scale: float, grass: CALayer) -> void:
	flood_scale = scale
	_rebuild_mesh()
	if grass != null:
		bake(grass)

func _distance_to_bed(x: float, z: float) -> float:
	return float(sample(x, z).distance)

const RiverShader: Shader = preload("res://scripts/world/river.gdshader")
# The ribbon is wider than the water so its outer band can be the bank.
const BANK_SCALE: float = 1.3
const SUBDIV: int = 3
var _bed_instance: MeshInstance3D

func _rebuild_mesh() -> void:
	if _mesh_instance == null:
		_bed_instance = MeshInstance3D.new()
		_bed_instance.name = "RiverBed"
		_bed_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var bed_mat := StandardMaterial3D.new()
		bed_mat.vertex_color_use_as_albedo = true
		bed_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_bed_instance.material_override = bed_mat
		add_child(_bed_instance)
		_mesh_instance = MeshInstance3D.new()
		_mesh_instance.name = "RiverSurface"
		_mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var mat := ShaderMaterial.new()
		mat.shader = RiverShader
		mat.set_shader_parameter("water_edge", 1.0 / BANK_SCALE)
		_mesh_instance.material_override = mat
		add_child(_mesh_instance)
	if _path.size() < 2:
		return
	var mat := _mesh_instance.material_override as ShaderMaterial
	mat.set_shader_parameter("river_length", length())
	var width: float = half_width() * BANK_SCALE
	mat.set_shader_parameter("half_width", width)
	_mesh_instance.mesh = _surface_mesh(width, 0.2 + (flood_scale - 1.0) * 0.8)
	_bed_instance.mesh = _bed_mesh()

# Columns across the water: enough for the surface to bank round a bend.
const ACROSS: int = 8

# The surface, one row of columns per step along the smoothed course, so
# neighbouring rows share their edges (no sawtooth gaps).
func _surface_mesh(width: float, lift: float) -> ArrayMesh:
	var path := _path
	var n: int = path.size()
	var total: float = length()
	var tangents := PackedVector3Array()
	tangents.resize(n)
	for i: int in n:
		var t: Vector3 = path[mini(i + 3, n - 1)] - path[maxi(i - 3, 0)]
		t.y = 0.0
		tangents[i] = t.normalized() if t.length_squared() > 0.0001 else Vector3(0, 0, 1)
	# Curvature toward the +side of the course, a little smoothed.
	var raw := PackedFloat32Array()
	raw.resize(n)
	for i: int in n:
		var i0: int = maxi(i - 3, 0)
		var i1: int = mini(i + 3, n - 1)
		var span: float = maxf(_dist[i1] - _dist[i0], 0.01)
		var side := Vector3(-tangents[i].z, 0.0, tangents[i].x)
		raw[i] = side.dot(tangents[i1] - tangents[i0]) / span
	var verts := PackedVector3Array()
	var uvs := PackedVector2Array()
	var cols := PackedColorArray()
	var norms := PackedVector3Array()
	var idx := PackedInt32Array()
	var stride: int = ACROSS + 1
	for i: int in n:
		var k: float = 0.0
		var hits: int = 0
		for j: int in range(maxi(i - 6, 0), mini(i + 7, n)):
			k += raw[j]
			hits += 1
		k /= float(hits)
		var d: float = _dist[i]
		var p: Vector3 = path[i] + Vector3(0.0, lift, 0.0)
		# Pinch the ribbon to a point at both mouths so the last quads are not
		# a wide sheet of stretched water running off the map.
		var pinch: float = maxf(smoothstep(0.0, 28.0, d) * smoothstep(0.0, 28.0, total - d), 0.04)
		var side := Vector3(-tangents[i].z, 0.0, tangents[i].x)
		# The inside of a bend stops short of the bend's centre, so it can never fold.
		var w_l: float = width * pinch
		var w_r: float = width * pinch
		if absf(k) > 0.001:
			var limit: float = 0.85 / absf(k)
			if k > 0.0:
				w_l = minf(w_l, limit)
			else:
				w_r = minf(w_r, limit)
		var l: Vector3 = p + side * w_l
		var r: Vector3 = p - side * w_r
		# Steeper stretches run faster and break into white water.
		var a2: Vector3 = path[maxi(i - 1, 0)]
		var b2: Vector3 = path[mini(i + 1, n - 1)]
		var run: float = maxf(Vector2(b2.x - a2.x, b2.z - a2.z).length(), 0.01)
		var rapid: float = clampf((a2.y - b2.y) / run * 6.0, 0.0, 1.0)
		var bend: float = clampf(k * 4.0, -1.0, 1.0)
		var col := Color(rapid, bend * 0.5 + 0.5, tangents[i].x * 0.5 + 0.5, tangents[i].z * 0.5 + 0.5)
		for c: int in stride:
			var f: float = float(c) / float(ACROSS)
			var q: Vector3 = l.lerp(r, f)
			# Water piles up against the outside of a bend.
			q.y += (f * 2.0 - 1.0) * bend * 0.07 * (1.0 - absf(f * 2.0 - 1.0) * 0.5)
			verts.append(q)
			uvs.append(Vector2(f, d))
			cols.append(col)
			norms.append(Vector3.UP)
		if i > 0:
			for c: int in ACROSS:
				var a3: int = (i - 1) * stride + c
				var b3: int = i * stride + c
				idx.append_array([a3, b3, b3 + 1, a3, b3 + 1, a3 + 1])
	var arr: Array = []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_COLOR] = cols
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return mesh

# A trench under the sheet of water: shallow at the banks, deep in the middle.
func _bed_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cuts: Array[float] = [-1.0, -0.4, 0.0, 0.4, 1.0]
	var bowl: Array[float] = [0.1, 0.55, 1.0, 0.55, 0.1]
	var width: float = BASE_HALF_WIDTH * 0.92
	var prev: Array[Vector3] = []
	var total: float = length()
	var dist: float = 0.0
	for i: int in _path.size():
		var a: Vector3 = _path[maxi(i - 1, 0)]
		var b: Vector3 = _path[mini(i + 1, _path.size() - 1)]
		var tang := Vector3(b.x - a.x, 0.0, b.z - a.z)
		if tang.length_squared() < 0.0001:
			tang = Vector3(0, 0, 1)
		if i > 0:
			dist += _path[i].distance_to(_path[i - 1])
		var pinch: float = smoothstep(0.0, 28.0, dist) * smoothstep(0.0, 28.0, total - dist)
		var side := Vector3(-tang.z, 0.0, tang.x).normalized()
		var row: Array[Vector3] = []
		for k: int in cuts.size():
			var p: Vector3 = _path[i] + side * width * cuts[k] * maxf(pinch, 0.04)
			p.y -= BED_DEPTH * bowl[k]
			row.append(p)
		if not prev.is_empty():
			for k: int in cuts.size() - 1:
				var mid := 1.0 - absf(cuts[k])
				var col := Color(0.5, 0.46, 0.32).lerp(Color(0.1, 0.28, 0.26), mid)
				_bed_quad(st, prev[k], prev[k + 1], row[k + 1], row[k], col)
		if i % 16 == 0 and pinch > 0.4:
			var rock: Vector3 = row[2] + Vector3(0, 0.14, 0)
			_bed_quad(st, rock + Vector3(-0.12, 0, -0.12), rock + Vector3(0.12, 0, -0.12), rock + Vector3(0, 0.16, 0), rock + Vector3(0, 0.16, 0), Color(0.2, 0.26, 0.24))
		prev = row
	return st.commit()

func _bed_quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	st.set_color(col); st.add_vertex(a)
	st.set_color(col); st.add_vertex(b)
	st.set_color(col); st.add_vertex(c)
	st.set_color(col); st.add_vertex(a)
	st.set_color(col); st.add_vertex(c)
	st.set_color(col); st.add_vertex(d)

# Winter: the river (and any floodwater still out) freezes over.
func set_ice(level: float) -> void:
	if _mesh_instance != null:
		(_mesh_instance.material_override as ShaderMaterial).set_shader_parameter("ice", level)

# 0 = normal river, 1 = full flood: the water turns muddy and opaque.
func set_flood_tint(level: float) -> void:
	if _mesh_instance != null:
		(_mesh_instance.material_override as ShaderMaterial).set_shader_parameter("flood", level)

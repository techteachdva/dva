class_name River
extends Node3D

# A meander from the north pass to the south pass. The valley is lived-in
# because this water is here. Flood only changes the wet width; the bed stays.

const BASE_HALF_WIDTH: float = 2.7
const CELL: float = 2.0

var flood_scale: float = 1.0
var _points: PackedVector3Array = PackedVector3Array()
var _wet: PackedByteArray = PackedByteArray()
# Cells close enough to the bed that a creature there might be in deep water.
# Lets walkers skip the per-segment sample() almost everywhere.
var _near: PackedByteArray = PackedByteArray()
var _grid_w: int = 64
var _grid_h: int = 64
var _mesh_instance: MeshInstance3D

func half_width() -> float:
	return BASE_HALF_WIDTH * flood_scale

# The bed runs past the meadow through both passes; the stretches beyond
# COPSE_RADIUS disappear into the boundary copses.
const REACH: float = 60.0
const COPSE_RADIUS: float = 40.0

# Smoothed course and running distance along it (fish swim by distance).
var _path := PackedVector3Array()
var _dist := PackedFloat32Array()
# Distances along the path where the river enters and leaves the meadow.
var copse_s := Vector2.ZERO

func generate(terrain: ValleyTerrain) -> void:
	_points = PackedVector3Array()
	var steps := 80
	for i: int in steps + 1:
		var z: float = lerpf(-REACH, REACH, float(i) / float(steps))
		var t: float = (z + 34.0) / 68.0
		# Meander across the meadow, straightening out to run through the passes.
		var damp: float = 1.0 - smoothstep(30.0, 50.0, absf(z))
		var x: float = (sin(t * TAU * 1.35) * 9.0 + sin(t * TAU * 2.7 + 1.1) * 4.2) * damp
		var y: float = terrain.surface_height(x, z) + 0.25
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
	var gx: int = clampi(int(floor(x / CELL + float(_grid_w) * 0.5)), 0, _grid_w - 1)
	var gz: int = clampi(int(floor(z / CELL + float(_grid_h) * 0.5)), 0, _grid_h - 1)
	return _wet[gz * _grid_w + gx] == 1

func is_near(x: float, z: float) -> bool:
	if _near.is_empty():
		return true
	var gx: int = clampi(int(floor(x / CELL + float(_grid_w) * 0.5)), 0, _grid_w - 1)
	var gz: int = clampi(int(floor(z / CELL + float(_grid_h) * 0.5)), 0, _grid_h - 1)
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

func _rebuild_mesh() -> void:
	if _mesh_instance == null:
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
	# One side vector per vertex along the smoothed course, so neighbouring
	# segments share their edges (no sawtooth gaps).
	var path := _path
	(_mesh_instance.material_override as ShaderMaterial).set_shader_parameter("river_length", length())
	var width: float = half_width() * BANK_SCALE
	var lift: float = 0.08 + (flood_scale - 1.0) * 0.12
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var dist: float = 0.0
	var prev_l := Vector3.ZERO
	var prev_r := Vector3.ZERO
	var prev_d: float = 0.0
	for i: int in path.size():
		var a: Vector3 = path[maxi(i - 1, 0)]
		var b: Vector3 = path[mini(i + 1, path.size() - 1)]
		var tang := Vector3(b.x - a.x, 0.0, b.z - a.z)
		if tang.length_squared() < 0.0001:
			tang = Vector3(0, 0, 1)
		var side := Vector3(-tang.z, 0.0, tang.x).normalized() * width
		var p: Vector3 = path[i] + Vector3(0.0, lift, 0.0)
		if i > 0:
			dist += path[i].distance_to(path[i - 1])
		var l := p + side
		var r := p - side
		if i > 0:
			_quad(st, prev_l, prev_r, l, r, prev_d, dist)
		prev_l = l
		prev_r = r
		prev_d = dist
	_mesh_instance.mesh = st.commit()

# 0 = normal river, 1 = full flood: the water turns muddy and opaque.
func set_flood_tint(level: float) -> void:
	if _mesh_instance != null:
		(_mesh_instance.material_override as ShaderMaterial).set_shader_parameter("flood", level)

func _quad(st: SurfaceTool, al: Vector3, ar: Vector3, bl: Vector3, br: Vector3, va: float, vb: float) -> void:
	st.set_uv(Vector2(0.0, va)); st.add_vertex(al)
	st.set_uv(Vector2(0.0, vb)); st.add_vertex(bl)
	st.set_uv(Vector2(1.0, vb)); st.add_vertex(br)
	st.set_uv(Vector2(0.0, va)); st.add_vertex(al)
	st.set_uv(Vector2(1.0, vb)); st.add_vertex(br)
	st.set_uv(Vector2(1.0, va)); st.add_vertex(ar)

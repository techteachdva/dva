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

func generate(terrain: ValleyTerrain) -> void:
	_points = PackedVector3Array()
	var steps := 56
	for i: int in steps + 1:
		var t: float = float(i) / float(steps)
		var z: float = lerpf(-34.0, 34.0, t)
		var x: float = sin(t * TAU * 1.35) * 9.0 + sin(t * TAU * 2.7 + 1.1) * 4.2
		var radial := sqrt(x * x + z * z)
		if radial > 34.0:
			var scale: float = 34.0 / radial
			x *= scale
			z *= scale
		var y: float = terrain.height_at(x, z) + 0.2
		_points.append(Vector3(x, y, z))
	_rebuild_mesh()

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

func random_point() -> Vector3:
	if _points.is_empty():
		return Vector3.ZERO
	var i: int = randi() % _points.size()
	var p: Vector3 = _points[i]
	var side := 1.0 if randf() > 0.5 else -1.0
	var tangent := Vector3(0.0, 0.0, 1.0)
	if i + 1 < _points.size():
		tangent = (_points[i + 1] - p).normalized()
	var lateral := Vector3(-tangent.z, 0.0, tangent.x) * side * randf() * half_width() * 0.7
	return p + lateral

func set_flood(scale: float, grass: CALayer) -> void:
	flood_scale = scale
	_rebuild_mesh()
	if grass != null:
		bake(grass)

func _distance_to_bed(x: float, z: float) -> float:
	return float(sample(x, z).distance)

func _rebuild_mesh() -> void:
	if _mesh_instance == null:
		_mesh_instance = MeshInstance3D.new()
		_mesh_instance.name = "RiverSurface"
		_mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.18, 0.48, 0.72, 0.86)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.roughness = 0.18
		mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_mesh_instance.material_override = mat
		add_child(_mesh_instance)
	if _points.size() < 2:
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var width: float = half_width()
	var lift: float = 0.08 + (flood_scale - 1.0) * 0.12
	for i: int in range(_points.size() - 1):
		var a: Vector3 = _points[i]
		var b: Vector3 = _points[i + 1]
		var ab := Vector3(b.x - a.x, 0.0, b.z - a.z)
		if ab.length_squared() < 0.0001:
			continue
		var side := Vector3(-ab.z, 0.0, ab.x).normalized() * width
		var a_l := a + side + Vector3(0.0, lift, 0.0)
		var a_r := a - side + Vector3(0.0, lift, 0.0)
		var b_l := b + side + Vector3(0.0, lift, 0.0)
		var b_r := b - side + Vector3(0.0, lift, 0.0)
		var deep := Color(0.12, 0.38, 0.66, 0.9)
		var lip := Color(0.45, 0.72, 0.84, 0.55)
		_tri(st, a_l, b_l, b_r, deep, deep, lip)
		_tri(st, a_l, b_r, a_r, deep, lip, lip)
	_mesh_instance.mesh = st.commit()

func _tri(st: SurfaceTool, p0: Vector3, p1: Vector3, p2: Vector3, c0: Color, c1: Color, c2: Color) -> void:
	st.set_color(c0)
	st.add_vertex(p0)
	st.set_color(c1)
	st.add_vertex(p1)
	st.set_color(c2)
	st.add_vertex(p2)

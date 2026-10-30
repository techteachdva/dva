class_name Riverweeds
extends Node3D

# A producer that lives in the channel: tangles of viney weed, like
# freshwater kelp. Fish, goats, deer and sheep graze it. It grows back.

var _patches: Array[Dictionary] = []
var _mesh: ArrayMesh
var _mat: ShaderMaterial

func plant(river: River) -> void:
	name = "Riverweeds"
	_mesh = _kelp_mesh()
	_mat = _material()
	var s: float = river.copse_s.x
	while s < river.copse_s.y:
		if randf() < 0.78:
			var bed: Vector3 = river.bed_point(s)
			var side: Vector3 = river.tangent_at(s).cross(Vector3.UP)
			_add(bed + side * randf_range(-0.7, 0.7), randf() * TAU)
		s += 3.6

func tick(life_dt: float) -> void:
	for p: Dictionary in _patches:
		if float(p["biomass"]) < 1.0:
			p["biomass"] = minf(1.0, float(p["biomass"]) + 0.022 * life_dt)
			_show(p)

func nearby(pos: Vector3, radius: float) -> bool:
	return nearest(pos, radius) != Vector3.INF

func nearest(pos: Vector3, radius: float) -> Vector3:
	var best := Vector3.INF
	var best_d := radius * radius
	for p: Dictionary in _patches:
		if float(p["biomass"]) < 0.08:
			continue
		var at: Vector3 = p["pos"]
		var d := Vector2(at.x - pos.x, at.z - pos.z).length_squared()
		if d < best_d:
			best_d = d
			best = at
	return best

func bite(pos: Vector3, amount: float) -> float:
	var best: Dictionary = {}
	var best_d := 2.8 * 2.8
	for p: Dictionary in _patches:
		if float(p["biomass"]) < 0.08:
			continue
		var at: Vector3 = p["pos"]
		var d := Vector2(at.x - pos.x, at.z - pos.z).length_squared()
		if d < best_d:
			best_d = d
			best = p
	if best.is_empty():
		return 0.0
	var take := minf(float(best["biomass"]), amount)
	best["biomass"] = float(best["biomass"]) - take
	_show(best)
	return take

func _add(pos: Vector3, yaw: float) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = _mesh
	mi.material_override = _mat
	mi.position = pos
	mi.rotation.y = yaw
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var patch := {"pos": pos, "biomass": randf_range(0.7, 1.0), "mesh": mi}
	_patches.append(patch)
	_show(patch)

func _show(p: Dictionary) -> void:
	var mi := p["mesh"] as MeshInstance3D
	var b := float(p["biomass"])
	mi.visible = b > 0.05
	var s := clampf(0.4 + b * 0.7, 0.35, 1.2)
	mi.scale = Vector3(s, clampf(b, 0.12, 1.0), s)

func _kelp_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for n: int in 6:
		var phase := float(n) * 1.17
		var origin := Vector3(sin(phase) * 0.2, 0.0, cos(phase) * 0.16)
		var prev := origin
		var col := Color(0.1, 0.36, 0.28).lightened(float(n) * 0.035)
		for i: int in 8:
			var t := float(i + 1) / 8.0
			var next := origin + Vector3(sin(t * 5.2 + phase) * 0.18, t * 1.25, cos(t * 3.4 + phase) * 0.14)
			var side := Vector3(cos(phase), 0.0, sin(phase)) * (0.03 + 0.025 * sin(t * PI))
			_quad(st, prev - side, prev + side, next + side, next - side, col.lightened(t * 0.22))
			prev = next
	st.generate_normals()
	return st.commit()

func _material() -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = "shader_type spatial;\nrender_mode cull_disabled, unshaded, depth_draw_opaque, shadows_disabled;\nvarying float kh;\nvoid vertex(){\n\tkh = clamp(COLOR.g, 0.0, 1.0);\n\tfloat h = clamp(VERTEX.y, 0.0, 1.3);\n\tVERTEX.x += sin(TIME * 1.35 + VERTEX.z * 2.8) * 0.18 * h;\n\tVERTEX.z += cos(TIME * 1.05 + VERTEX.x * 2.2) * 0.12 * h;\n}\nvoid fragment(){\n\tALBEDO = mix(vec3(0.05, 0.22, 0.18), vec3(0.52, 0.78, 0.46), kh);\n\tALPHA = 0.88;\n}\n"
	var mat := ShaderMaterial.new()
	mat.shader = sh
	return mat

func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	st.set_color(col)
	st.add_vertex(a)
	st.set_color(col)
	st.add_vertex(b)
	st.set_color(col)
	st.add_vertex(c)

func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	_tri(st, a, b, c, col)
	_tri(st, a, c, d, col)

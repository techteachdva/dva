class_name ValleyTerrain
extends Node3D

# Pocket valley. The floor is the living meadow. Slopes and peaks are the
# rim: visible, walkable only at their feet, and reserved for a later patch
# where creatures travel up for rare resources. band_at() is that seam.

const FLOOR_RADIUS: float = 40.0
const RIM_RADIUS: float = 78.0
const MESH_SPAN: float = 180.0
const MESH_RES: int = 88
var _mesh_res: int = MESH_RES

const PASS_NAMES: PackedStringArray = ["North Pass", "East Pass", "South Pass", "West Pass"]

var _noise: FastNoiseLite
# Ridged noise carves the rim into separate craggy summits and gullies.
var _crag: FastNoiseLite
var river: River

func _ready() -> void:
	if OS.has_feature("web"):
		_mesh_res = 72
	_noise = FastNoiseLite.new()
	_noise.seed = 14021
	_noise.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	_noise.frequency = 0.02
	_noise.fractal_octaves = 3
	_crag = FastNoiseLite.new()
	_crag.seed = 7717
	_crag.noise_type = FastNoiseLite.TYPE_SIMPLEX
	_crag.frequency = 0.022
	_crag.fractal_type = FastNoiseLite.FRACTAL_RIDGED
	_crag.fractal_octaves = 4
	_crag.fractal_gain = 0.55
	_build_mesh()
	river = River.new()
	river.name = "River"
	add_child(river)
	river.generate(self)
	_plant_copses()
	_add_sky()

func height_at(x: float, z: float) -> float:
	var meadow: float = _noise.get_noise_2d(x, z) * 0.55
	var r: float = sqrt(x * x + z * z)
	if r <= FLOOR_RADIUS:
		return meadow
	var t: float = clampf((r - FLOOR_RADIUS) / (RIM_RADIUS - FLOOR_RADIUS), 0.0, 1.0)
	t = t * t * (3.0 - 2.0 * t)
	# Low saddles on the four passes (the cardinals); full mountains elsewhere.
	var a: float = fposmod(atan2(z, x), PI * 0.5)
	var from_pass: float = minf(a, PI * 0.5 - a)
	var range_mask: float = smoothstep(0.07, 0.42, from_pass)
	# Ridged noise in 0..1: sharp crests where it peaks, gullies between.
	var crag: float = clampf(_crag.get_noise_2d(x, z) * 0.5 + 0.5, 0.0, 1.0)
	var summit: float = 9.0 + crag * crag * 26.0 + _noise.get_noise_2d(x * 0.9, z * 0.9) * 3.0
	var crest: float = lerpf(4.5 + crag * 2.0, summit, range_mask)
	var h: float = lerpf(meadow, crest, t)
	if r > RIM_RADIUS:
		# Behind the rim the range keeps rising so the valley stays enclosed.
		var beyond: float = clampf((r - RIM_RADIUS) / 18.0, 0.0, 1.0)
		h = lerpf(h, crest * 1.1 + 5.0, beyond)
	return h

# Height of the drawn (faceted) surface. height_at() is the smooth field the
# mesh is sampled from; on the craggy slopes the two differ by metres, so
# anything that stands on the ground uses this one.
var _heights := PackedFloat32Array()
var _step: float = 1.0
var _origin: float = 0.0

func surface_height(x: float, z: float) -> float:
	var n: int = _mesh_res
	if _heights.size() != (n + 1) * (n + 1):
		return height_at(x, z)
	var gx: float = clampf((x - _origin) / _step, 0.0, float(n) - 0.001)
	var gz: float = clampf((z - _origin) / _step, 0.0, float(n) - 0.001)
	var ix: int = int(gx)
	var iz: int = int(gz)
	var fx: float = gx - ix
	var fz: float = gz - iz
	var row: int = iz * (n + 1) + ix
	var h00: float = _heights[row]
	var h10: float = _heights[row + 1]
	var h01: float = _heights[row + n + 1]
	var h11: float = _heights[row + n + 2]
	# Same diagonal split as _build_mesh: (00,10,11) and (00,11,01).
	if fx >= fz:
		return h00 + (h10 - h00) * fx + (h11 - h10) * fz
	return h00 + (h11 - h01) * fx + (h01 - h00) * fz

func band_at(x: float, z: float) -> String:
	var r2: float = x * x + z * z
	if r2 <= FLOOR_RADIUS * FLOOR_RADIUS:
		return "floor"
	if r2 <= RIM_RADIUS * RIM_RADIUS:
		return "slope"
	return "peak"

func is_floor(x: float, z: float) -> bool:
	return band_at(x, z) == "floor"

func random_pass_mouth() -> Dictionary:
	var i: int = randi() % PASS_NAMES.size()
	# North, East, South, West. North is -Z.
	var ang: float = -PI * 0.5 + float(i) * PI * 0.5
	var mouth_r: float = FLOOR_RADIUS - 3.0
	var x: float = cos(ang) * mouth_r
	var z: float = sin(ang) * mouth_r
	return {
		"name": PASS_NAMES[i],
		"position": Vector3(x, surface_height(x, z), z),
	}

func _build_mesh() -> void:
	# Heights are sampled once per grid corner; each triangle gets one flat
	# colour so the rim reads as faceted rock and snow rather than a smooth blob.
	var n: int = _mesh_res
	var step: float = MESH_SPAN / float(n)
	var origin: float = -MESH_SPAN * 0.5
	var heights := PackedFloat32Array()
	heights.resize((n + 1) * (n + 1))
	for iz: int in n + 1:
		for ix: int in n + 1:
			heights[iz * (n + 1) + ix] = height_at(origin + float(ix) * step, origin + float(iz) * step)
	_heights = heights
	_step = step
	_origin = origin
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for iz: int in n:
		for ix: int in n:
			var x0: float = origin + float(ix) * step
			var z0: float = origin + float(iz) * step
			var p00 := Vector3(x0, heights[iz * (n + 1) + ix], z0)
			var p10 := Vector3(x0 + step, heights[iz * (n + 1) + ix + 1], z0)
			var p01 := Vector3(x0, heights[(iz + 1) * (n + 1) + ix], z0 + step)
			var p11 := Vector3(x0 + step, heights[(iz + 1) * (n + 1) + ix + 1], z0 + step)
			_add_tri(st, p00, p10, p11)
			_add_tri(st, p00, p11, p01)
	st.generate_normals()
	var mesh := st.commit()
	var mi := MeshInstance3D.new()
	mi.name = "ValleyMesh"
	mi.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.94
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

func _add_tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	var normal := (c - a).cross(b - a).normalized()
	var centre := (a + b + c) / 3.0
	st.set_color(_color_at(centre.x, centre.z, centre.y, absf(normal.y)))
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)

func _color_at(x: float, z: float, h: float, flatness: float) -> Color:
	var r: float = sqrt(x * x + z * z)
	var soil := Color(0.32, 0.40, 0.20)
	var meadow := Color(0.46, 0.52, 0.24)
	if r <= FLOOR_RADIUS:
		var n: float = clampf(_noise.get_noise_2d(x * 1.7, z * 1.7) * 0.5 + 0.5, 0.0, 1.0)
		return soil.lerp(meadow, n)
	var foothill := Color(0.38, 0.45, 0.24)
	var rock_light := Color(0.52, 0.49, 0.45)
	var rock_dark := Color(0.34, 0.32, 0.31)
	var snow := Color(0.90, 0.92, 0.95)
	var jitter: float = _noise.get_noise_2d(x * 3.1, z * 3.1)
	# Steep faces are dark rock, ledges lighter; grass clings to gentle low slopes.
	var rock: Color = rock_dark.lerp(rock_light, clampf((flatness - 0.45) / 0.45 + jitter * 0.3, 0.0, 1.0))
	var grassy: float = clampf((7.0 - h) / 5.0, 0.0, 1.0) * clampf((flatness - 0.55) / 0.3, 0.0, 1.0)
	var c: Color = rock.lerp(foothill, grassy)
	# Snow settles on high, flattish facets; sheer faces stay bare.
	var snow_line: float = 16.0 + jitter * 3.0
	var snowy: float = clampf((h - snow_line) / 4.0, 0.0, 1.0) * clampf((flatness - 0.35) / 0.3, 0.0, 1.0)
	return c.lerp(snow, snowy)

# Dense stands of pines where the river leaves the meadow at both passes.
# They are the valley's boundary there: the water runs into them and out.
const COPSE_TREES: int = 60
var _cone_mat: StandardMaterial3D

func _plant_copses() -> void:
	var holder := Node3D.new()
	holder.name = "Copses"
	add_child(holder)
	var rng := RandomNumberGenerator.new()
	rng.seed = 991
	var trunks: Array[Transform3D] = []
	var cones: Array[Transform3D] = []
	var tints: Array[Color] = []
	var span: float = river.length()
	for end: int in 2:
		var placed: int = 0
		var tries: int = 0
		while placed < COPSE_TREES and tries < 2000:
			tries += 1
			var s: float = rng.randf_range(0.0, river.copse_s.x + 6.0) if end == 0 else rng.randf_range(river.copse_s.y - 6.0, span)
			var p := river.point_at(s)
			var t := river.tangent_at(s)
			var side := Vector3(-t.z, 0.0, t.x)
			var off: float = rng.randf_range(River.BASE_HALF_WIDTH * 1.9, 20.0) * (1.0 if rng.randf() > 0.5 else -1.0)
			var pos := p + side * off + t * rng.randf_range(-2.0, 2.0)
			var r: float = Vector2(pos.x, pos.z).length()
			if r < 37.0 or r > 62.0:
				continue
			pos.y = surface_height(pos.x, pos.z)
			var k: float = rng.randf_range(0.85, 1.45)
			trunks.append(Transform3D(Basis().scaled(Vector3(k, k, k)), pos + Vector3.UP * 0.8 * k))
			var tint := Color(0.2, 0.42, 0.24).lerp(Color(0.3, 0.5, 0.26), rng.randf())
			for tier: int in 3:
				var w: float = [1.0, 0.78, 0.55][tier] * k
				var h: float = [1.7, 2.9, 3.9][tier] * k
				cones.append(Transform3D(Basis().scaled(Vector3(w, k, w)), pos + Vector3.UP * h))
				tints.append(tint.lightened(0.06 * tier))
			placed += 1
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.18
	trunk_mesh.bottom_radius = 0.28
	trunk_mesh.height = 1.6
	trunk_mesh.radial_segments = 6
	trunk_mesh.rings = 1
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.36, 0.25, 0.17)
	_copse_multimesh(holder, "CopseTrunks", trunk_mesh, bark, trunks, [])
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 1.6
	cone.height = 2.4
	cone.radial_segments = 7
	cone.rings = 1
	_cone_mat = StandardMaterial3D.new()
	_cone_mat.vertex_color_use_as_albedo = true
	_cone_mat.roughness = 0.95
	_copse_multimesh(holder, "CopseNeedles", cone, _cone_mat, cones, tints)

func _copse_multimesh(holder: Node3D, node_name: String, mesh: Mesh, mat: Material, xforms: Array[Transform3D], tints: Array[Color]) -> void:
	var mmi := MultiMeshInstance3D.new()
	mmi.name = node_name
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i: int in xforms.size():
		mm.set_instance_transform(i, xforms[i])
		mm.set_instance_color(i, tints[i] if i < tints.size() else Color.WHITE)
	mmi.multimesh = mm
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	holder.add_child(mmi)

# Pines stay green; winter frosts them over.
func set_season(season: String) -> void:
	if _cone_mat != null:
		_cone_mat.albedo_color = Color(1.6, 1.65, 1.7) if season == "Winter" else Color.WHITE

func _add_sky() -> void:
	var world_env := WorldEnvironment.new()
	world_env.name = "ValleySky"
	var sky := Sky.new()
	var shader := Shader.new()
	shader.code = SKY_SHADER
	var sky_mat := ShaderMaterial.new()
	var code := SKY_SHADER
	if OS.has_feature("web"):
		code = code.replace("for (int i = 0; i < 5; i++)", "for (int i = 0; i < 2; i++)")
	shader.code = code
	sky_mat.shader = shader
	sky.sky_material = sky_mat
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.75, 0.8, 0.84)
	env.ambient_light_energy = 0.62
	# Fullscreen fog and a 5-octave sky shader dominate the web frame.
	# The browser build keeps the sky and drops the fog pass.
	env.fog_enabled = not OS.has_feature("web")
	env.fog_mode = Environment.FOG_MODE_EXPONENTIAL
	env.fog_light_color = Color(0.78, 0.84, 0.9)
	env.fog_density = 0.0011
	env.fog_height = 5.0
	env.fog_height_density = -0.09
	env.fog_aerial_perspective = 0.35
	world_env.environment = env
	add_child(world_env)

const SKY_SHADER := "shader_type sky;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.55;
	for (int i = 0; i < 5; i++) {
		v += a * noise(p);
		p = p * 2.02 + vec2(1.7, 9.2);
		a *= 0.5;
	}
	return v;
}

void sky() {
	float h = EYEDIR.y;
	float up = clamp(h * 0.5 + 0.5, 0.0, 1.0);
	vec3 horizon = vec3(0.64, 0.76, 0.88);
	vec3 zenith = vec3(0.27, 0.46, 0.76);
	vec3 col = mix(horizon, zenith, pow(up, 0.7));
	vec2 uv = EYEDIR.xz / max(h, 0.12);
	float n = fbm(uv * 0.42 + vec2(0.2, 0.15));
	float cloud = smoothstep(0.46, 0.74, n);
	cloud *= smoothstep(0.0, 0.22, h);
	col = mix(col, vec3(0.94, 0.95, 0.97), cloud * 0.88);
	COLOR = col;
}
"

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
		"position": Vector3(x, height_at(x, z), z),
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

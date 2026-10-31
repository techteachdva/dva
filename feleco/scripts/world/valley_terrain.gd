class_name ValleyTerrain
extends Node3D

# Pocket valley. The floor is the living meadow (plains and riverbank); the
# highlands and the lower slopes of the big peaks are the Mountain biome,
# walkable out to WALK_RADIUS. The summits beyond that stay the valley's wall.

const FLOOR_RADIUS: float = 46.0
# The highlands: the old rim, lower and fleshed out as a biome to explore.
const RIM_RADIUS: float = 84.0
# Into the peaks, not just up to their foot. At this radius the ground has
# already climbed the big-peak blend, so a goat standing here reads as mountain.
const WALK_RADIUS: float = 118.0
# The big peaks: the new periphery.
const PEAK_RADIUS: float = 136.0
const MESH_SPAN: float = 300.0
const MESH_RES: int = 132
var _mesh_res: int = MESH_RES

const PASS_NAMES: PackedStringArray = ["North Pass", "East Pass", "South Pass", "West Pass"]

var _noise: FastNoiseLite
# Ridged noise carves the rim into separate craggy summits and gullies.
var _crag: FastNoiseLite
var river: River

func _ready() -> void:
	if OS.has_feature("web"):
		_mesh_res = 104
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
	# The river's course comes first: the terrain carves its gorge.
	river = River.new()
	river.name = "River"
	river.plan_course(randi())
	_build_mesh()
	_build_far_range()
	add_child(river)
	river.generate(self)
	_plant_copses()
	_add_sky()

func height_at(x: float, z: float) -> float:
	var h: float = _height_raw(x, z)
	if river == null or not river.planned:
		return h
	# The river's channel: a shallow dip on the meadow, a gorge in the hills.
	var r: float = sqrt(x * x + z * z)
	var d: float = river.across_distance(x, z)
	var wall: float = River.BASE_HALF_WIDTH * 1.26
	var flare: float = lerpf(3.2, 14.0, smoothstep(FLOOR_RADIUS - 4.0, RIM_RADIUS, r))
	if d >= wall + flare:
		return h
	var k: float = 1.0 - smoothstep(wall, wall + flare, d)
	var bed: float = river.bed_height(river.to_course(x, z).x)
	return lerpf(h, minf(h, bed), k)

func _height_raw(x: float, z: float) -> float:
	var meadow: float = _noise.get_noise_2d(x, z) * 0.55
	var r: float = sqrt(x * x + z * z)
	if r <= FLOOR_RADIUS:
		return meadow
	# Low saddles on the four passes (the cardinals); full mountains elsewhere.
	var a: float = fposmod(atan2(z, x), PI * 0.5)
	var from_pass: float = minf(a, PI * 0.5 - a)
	var range_mask: float = smoothstep(0.07, 0.42, from_pass)
	# Ridged noise in 0..1: sharp crests where it peaks, gullies between.
	var crag: float = clampf(_crag.get_noise_2d(x, z) * 0.5 + 0.5, 0.0, 1.0)
	# The highlands: rolling, walkable ground with craggy knolls (the old rim,
	# smaller), climbing gently from the meadow.
	var t: float = clampf((r - FLOOR_RADIUS) / (RIM_RADIUS - FLOOR_RADIUS), 0.0, 1.0)
	t = t * t * (3.0 - 2.0 * t)
	var knoll: float = 4.0 + crag * crag * 7.0 + _noise.get_noise_2d(x * 0.9, z * 0.9) * 2.0
	var high: float = lerpf(3.0 + crag * 2.0, knoll, range_mask)
	var h: float = lerpf(meadow, high, t)
	if r > RIM_RADIUS:
		# The big peaks: the new wall of the valley, far taller than before.
		var t2: float = clampf((r - RIM_RADIUS) / (PEAK_RADIUS - RIM_RADIUS), 0.0, 1.0)
		t2 = t2 * t2 * (3.0 - 2.0 * t2)
		var summit: float = 22.0 + crag * crag * 48.0 + _noise.get_noise_2d(x * 0.6, z * 0.6) * 4.0
		var peak: float = lerpf(14.0 + crag * 6.0, summit, range_mask)
		h = lerpf(h, peak, t2)
		if r > PEAK_RADIUS:
			h = lerpf(h, peak * 1.1 + 6.0, clampf((r - PEAK_RADIUS) / 20.0, 0.0, 1.0))
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
	if r2 <= WALK_RADIUS * WALK_RADIUS:
		return "slope"
	return "peak"

func is_floor(x: float, z: float) -> bool:
	return band_at(x, z) == "floor"

func random_pass_mouth() -> Dictionary:
	var i: int = randi() % PASS_NAMES.size()
	# North, East, South, West. North is -Z.
	var ang: float = -PI * 0.5 + float(i) * PI * 0.5
	var mouth_r: float = WALK_RADIUS - 6.0
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

# ------------------------------------------------------------------
# The world beyond: ranges after ranges out to the horizon, so the valley is
# a pocket in a much larger land. Colour fades into the sky's haze with
# distance (aerial perspective baked into the mesh, so it works even where
# the fog pass is off), and the ground curves away like a small planet.
# ------------------------------------------------------------------
const FAR_RINGS: Array[float] = [146.0, 152.0, 162.0, 176.0, 194.0, 218.0, 250.0, 290.0, 340.0, 400.0, 470.0, 560.0, 670.0, 800.0, 950.0]
const FAR_SEGMENTS: int = 160
const PLANET_RADIUS: float = 4000.0
const HAZE := Color(0.66, 0.75, 0.84)

func far_height(x: float, z: float) -> float:
	var r: float = sqrt(x * x + z * z)
	var half: float = MESH_SPAN * 0.5
	# Under the valley mesh: tuck below it so the two never fight.
	if absf(x) <= half and absf(z) <= half:
		return height_at(x, z) - 1.5
	var near_h: float = height_at(x, z)
	var ridge: float = clampf(_crag.get_noise_2d(x * 0.18, z * 0.18) * 0.5 + 0.5, 0.0, 1.0)
	var swell: float = _noise.get_noise_2d(x * 0.05, z * 0.05)
	var far_h: float = 16.0 + ridge * ridge * 70.0 + swell * 22.0
	var t: float = clampf((r - 150.0) / 240.0, 0.0, 1.0)
	var h: float = lerpf(near_h, far_h, t * t * (3.0 - 2.0 * t))
	return h - r * r / (2.0 * PLANET_RADIUS)

func _build_far_range() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings: int = FAR_RINGS.size()
	var pts: Array = []
	for ri: int in rings:
		var row: Array = []
		var r: float = FAR_RINGS[ri]
		for si: int in FAR_SEGMENTS:
			var a: float = TAU * float(si) / FAR_SEGMENTS
			var x: float = cos(a) * r
			var z: float = sin(a) * r
			row.append(Vector3(x, far_height(x, z), z))
		pts.append(row)
	for ri: int in rings - 1:
		for si: int in FAR_SEGMENTS:
			var sj: int = (si + 1) % FAR_SEGMENTS
			var p00: Vector3 = pts[ri][si]
			var p01: Vector3 = pts[ri][sj]
			var p10: Vector3 = pts[ri + 1][si]
			var p11: Vector3 = pts[ri + 1][sj]
			_add_far_tri(st, p00, p10, p11)
			_add_far_tri(st, p00, p11, p01)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.name = "FarRange"
	mi.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1.0
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

func _add_far_tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3) -> void:
	var normal := (c - a).cross(b - a).normalized()
	var centre := (a + b + c) / 3.0
	var r: float = Vector2(centre.x, centre.z).length()
	# Same rock and snow as the rim, judged on height above the curve, then
	# washed toward the haze the further away it is.
	var lift: float = centre.y + r * r / (2.0 * PLANET_RADIUS)
	var col: Color = _color_at(centre.x, centre.z, lift * (0.75 if r > 200.0 else 1.0), absf(normal.y))
	var fade: float = clampf((r - 150.0) / 600.0, 0.0, 0.9)
	st.set_color(col.lerp(HAZE, sqrt(fade)))
	st.add_vertex(a)
	st.add_vertex(b)
	st.add_vertex(c)

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
	var n: float = clampf(_noise.get_noise_2d(x * 1.7, z * 1.7) * 0.5 + 0.5, 0.0, 1.0)
	var field: Color = soil.lerp(meadow, n)
	# The meadow runs up into the hills along the same ragged line as the
	# biomes (Biomes.mountain_edge), fading over several metres: no circle.
	var edge: float = Biomes.mountain_edge(x, z)
	var into_hills: float = smoothstep(edge - 5.0, edge + 7.0, r + _noise.get_noise_2d(x * 0.8, z * 0.8) * 4.0)
	if into_hills <= 0.0:
		return field
	var foothill := Color(0.38, 0.45, 0.24)
	var rock_light := Color(0.52, 0.49, 0.45)
	var rock_dark := Color(0.34, 0.32, 0.31)
	var snow := Color(0.90, 0.92, 0.95)
	var jitter: float = _noise.get_noise_2d(x * 3.1, z * 3.1)
	# Steep faces are dark rock, ledges lighter; grass clings to gentle low slopes.
	var rock: Color = rock_dark.lerp(rock_light, clampf((flatness - 0.45) / 0.45 + jitter * 0.3, 0.0, 1.0))
	# The highlands are alpine pasture between the rocks; the big peaks are bare.
	var grass_line: float = 13.0 if r <= RIM_RADIUS else 7.0
	var grassy: float = clampf((grass_line - h) / 5.0, 0.0, 1.0) * clampf((flatness - 0.5) / 0.3, 0.0, 1.0)
	var c: Color = rock.lerp(foothill, grassy)
	c = field.lerp(c, into_hills)
	# Snow settles on high, flattish facets; sheer faces stay bare.
	var snow_line: float = 22.0 + jitter * 3.0
	var snowy: float = clampf((h - snow_line) / 4.0, 0.0, 1.0) * clampf((flatness - 0.35) / 0.3, 0.0, 1.0)
	return c.lerp(snow, snowy)

# A short stand of fruitless apple trees where the river leaves the meadow
# at both passes. Just enough crown to hide the water running off the map.
const COPSE_TREES: int = 14
var _crown_mat: StandardMaterial3D

func _plant_copses() -> void:
	var holder := Node3D.new()
	holder.name = "Copses"
	add_child(holder)
	var rng := RandomNumberGenerator.new()
	rng.seed = 991
	var trunks: Array[Transform3D] = []
	var crowns: Array[Transform3D] = []
	var tints: Array[Color] = []
	var span: float = river.length()
	for end: int in 2:
		var placed: int = 0
		var tries: int = 0
		while placed < COPSE_TREES and tries < 2000:
			tries += 1
			var s: float = rng.randf_range(0.0, river.copse_s.x + 4.0) if end == 0 else rng.randf_range(river.copse_s.y - 4.0, span)
			var p := river.point_at(s)
			var t := river.tangent_at(s)
			var side := Vector3(-t.z, 0.0, t.x)
			var off: float = rng.randf_range(River.BASE_HALF_WIDTH * 1.8, 9.0) * (1.0 if rng.randf() > 0.5 else -1.0)
			var pos := p + side * off + t * rng.randf_range(-1.5, 1.5)
			if river.across_distance(pos.x, pos.z) < River.BASE_HALF_WIDTH * 1.5:
				continue
			var r: float = Vector2(pos.x, pos.z).length()
			if r < FLOOR_RADIUS - 2.0 or r > FLOOR_RADIUS + 16.0:
				continue
			pos.y = surface_height(pos.x, pos.z)
			var k: float = rng.randf_range(0.9, 1.35)
			trunks.append(Transform3D(Basis().scaled(Vector3(k, k * 1.15, k)), pos + Vector3.UP * 0.9 * k))
			var leaf := Color(0.34, 0.55, 0.22).lerp(Color(0.48, 0.62, 0.24), rng.randf())
			# A round crown, plus a smaller lump off to one side. No fruit.
			crowns.append(Transform3D(Basis().scaled(Vector3(1.35, 0.85, 1.35) * k), pos + Vector3.UP * 2.5 * k))
			tints.append(leaf)
			var lump := side.normalized() * 0.45 * k
			crowns.append(Transform3D(Basis().scaled(Vector3(0.85, 0.6, 0.85) * k), pos + lump + Vector3.UP * 2.15 * k))
			tints.append(leaf.lightened(0.08))
			placed += 1
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.16
	trunk_mesh.bottom_radius = 0.26
	trunk_mesh.height = 1.7
	trunk_mesh.radial_segments = 6
	trunk_mesh.rings = 1
	var bark := StandardMaterial3D.new()
	bark.albedo_color = Color(0.4, 0.28, 0.18)
	_copse_multimesh(holder, "CopseTrunks", trunk_mesh, bark, trunks, [])
	var crown := SphereMesh.new()
	crown.radius = 1.15
	crown.height = 2.1
	crown.radial_segments = 8
	crown.rings = 4
	_crown_mat = StandardMaterial3D.new()
	_crown_mat.vertex_color_use_as_albedo = true
	_crown_mat.roughness = 0.92
	_copse_multimesh(holder, "CopseCrowns", crown, _crown_mat, crowns, tints)

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

# Fruitless crowns thin and frost in winter; they never set fruit.
func set_season(season: String) -> void:
	if _crown_mat != null:
		_crown_mat.albedo_color = Color(0.72, 0.76, 0.78) if season == "Winter" else Color.WHITE

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
	# Distance fog plus a little height fog pooling in the low ground, so the
	# far ranges soften into the sky. The web build skips the costly aerial
	# perspective (sky sampling) but keeps the fog itself.
	env.fog_enabled = true
	# Depth fog: clear across the meadow, thickening past the rim so the far
	# ranges fade out, with a whisper of height fog in the low ground.
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_light_color = HAZE
	env.fog_density = 1.0
	env.fog_depth_begin = 80.0
	env.fog_depth_end = 820.0
	env.fog_depth_curve = 1.6
	env.fog_sky_affect = 0.0
	env.fog_height = 3.0
	env.fog_height_density = 0.004
	env.fog_aerial_perspective = 0.0 if OS.has_feature("web") else 0.4
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
	// A haze band where the land meets the sky, and haze below the horizon,
	// so the far ranges dissolve into distance instead of ending.
	vec3 haze = vec3(0.66, 0.75, 0.84);
	vec2 uv = EYEDIR.xz / max(h, 0.12);
	float n = fbm(uv * 0.42 + vec2(0.2, 0.15));
	float cloud = smoothstep(0.46, 0.74, n);
	cloud *= smoothstep(0.0, 0.22, h);
	col = mix(col, vec3(0.94, 0.95, 0.97), cloud * 0.88);
	col = mix(col, haze, smoothstep(0.12, -0.02, h));
	COLOR = col;
}
"

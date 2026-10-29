class_name CorpseModels
extends RefCounted

# 3D carcasses. Every species leaves its own skeleton (a sheep's ribs and
# short snout, a deer's antlers, a boar's tusks, a bird's wings, a fish's
# fan of fine bones...), built once from capsules and balls into one cached
# mesh per species. The pile of offal on top is the same mesh for everyone.
# Models lie flat along +X (head at +X), one unit long; Corpse scales them.

# legs: 4 quadruped, 2 biped/bird, 0 none. ribs: pairs. snout/tail: lengths.
# leg: leg length, thick: bone thickness, skull: skull size, extra: a feature.
const SPECS: Dictionary = {
	"sheep": {"body": "quad", "ribs": 5, "snout": 0.12, "tail": 0.1, "leg": 0.3, "skull": 1.0},
	"goat": {"body": "quad", "ribs": 5, "snout": 0.12, "tail": 0.06, "leg": 0.32, "skull": 1.0, "extra": "horns"},
	"deer": {"body": "quad", "ribs": 6, "snout": 0.16, "tail": 0.06, "leg": 0.42, "skull": 1.0, "extra": "antlers"},
	"wolf": {"body": "quad", "ribs": 6, "snout": 0.2, "tail": 0.35, "leg": 0.32, "skull": 1.0},
	"lion": {"body": "quad", "ribs": 6, "snout": 0.12, "tail": 0.45, "leg": 0.32, "skull": 1.2},
	"bear": {"body": "quad", "ribs": 6, "snout": 0.13, "tail": 0.04, "leg": 0.28, "skull": 1.4, "thick": 1.5},
	"boar": {"body": "quad", "ribs": 6, "snout": 0.2, "tail": 0.08, "leg": 0.22, "skull": 1.2, "thick": 1.2, "extra": "tusks"},
	"rabbit": {"body": "quad", "ribs": 4, "snout": 0.05, "tail": 0.03, "leg": 0.36, "skull": 0.9, "thick": 0.8},
	"human": {"body": "biped", "ribs": 5, "skull": 1.3},
	"falcon": {"body": "bird", "ribs": 4, "skull": 0.9, "extra": "hooked"},
	"robin": {"body": "bird", "ribs": 3, "skull": 1.0},
	"fish": {"body": "fish", "ribs": 9, "skull": 0.9},
	"beetle": {"body": "shell"},
	"mouse": {"body": "quad", "ribs": 3, "snout": 0.06, "tail": 0.4, "leg": 0.14, "skull": 0.6, "thick": 0.5},
}

const BONE_COLOR := Color(0.93, 0.9, 0.82)
const GOLD_COLOR := Color(1.0, 0.82, 0.32)

static var _capsule: CapsuleMesh
static var _ball: SphereMesh
static var _skeletons: Dictionary = {}
static var _offal: ArrayMesh
static var _bone_mat: StandardMaterial3D
static var _gold_mat: StandardMaterial3D
static var _offal_mat: StandardMaterial3D
static var _shell_mat: StandardMaterial3D

static func _init_parts() -> void:
	if _capsule != null:
		return
	_capsule = CapsuleMesh.new()
	_capsule.radius = 0.5
	_capsule.height = 2.0
	_capsule.radial_segments = 6
	_capsule.rings = 1
	_ball = SphereMesh.new()
	_ball.radius = 1.0
	_ball.height = 2.0
	_ball.radial_segments = 8
	_ball.rings = 4
	_bone_mat = StandardMaterial3D.new()
	_bone_mat.albedo_color = BONE_COLOR
	_bone_mat.roughness = 0.85
	_gold_mat = StandardMaterial3D.new()
	_gold_mat.albedo_color = GOLD_COLOR
	_gold_mat.metallic = 0.6
	_gold_mat.roughness = 0.35
	_offal_mat = StandardMaterial3D.new()
	_offal_mat.albedo_color = Color(0.48, 0.09, 0.1)
	_offal_mat.roughness = 0.3
	_shell_mat = StandardMaterial3D.new()
	_shell_mat.albedo_color = Color(0.16, 0.12, 0.1)
	_shell_mat.roughness = 0.4

static func bone_material(golden: bool) -> StandardMaterial3D:
	_init_parts()
	return _gold_mat if golden else _bone_mat

static func offal_material() -> StandardMaterial3D:
	_init_parts()
	return _offal_mat

static func shell_material() -> StandardMaterial3D:
	_init_parts()
	return _shell_mat

static func has_skeleton(species: String) -> bool:
	return SPECS.has(species)

static func is_shell(species: String) -> bool:
	return SPECS.has(species) and SPECS[species]["body"] == "shell"

# A bone (capsule) from a to b of radius r.
static func _bone(st: SurfaceTool, a: Vector3, b: Vector3, r: float) -> void:
	var d: Vector3 = b - a
	var l: float = d.length()
	if l < 0.001:
		return
	var y: Vector3 = d / l
	var x: Vector3 = y.cross(Vector3.UP if absf(y.y) < 0.95 else Vector3.RIGHT).normalized()
	var z: Vector3 = x.cross(y)
	# The capsule is 2 tall with radius 0.5: stretch it to the bone.
	# Drawn a touch chunky so the bones read from the camera height.
	r *= 1.6
	var basis := Basis(x * r * 2.0, y * maxf(l * 0.5, r), z * r * 2.0)
	st.append_from(_capsule, 0, Transform3D(basis, (a + b) * 0.5))

static func _blob(st: SurfaceTool, c: Vector3, radii: Vector3) -> void:
	st.append_from(_ball, 0, Transform3D(Basis.from_scale(radii), c))

static func skeleton(species: String) -> ArrayMesh:
	_init_parts()
	if _skeletons.has(species):
		return _skeletons[species]
	var spec: Dictionary = SPECS.get(species, SPECS["sheep"])
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	match String(spec["body"]):
		"quad":
			_quadruped(st, spec)
		"biped":
			_biped(st, spec)
		"bird":
			_bird(st, spec)
		"fish":
			_fish(st, spec)
		"shell":
			_shell(st)
	var mesh: ArrayMesh = st.commit()
	_skeletons[species] = mesh
	return mesh

static func _ribcage(st: SurfaceTool, x0: float, x1: float, n: int, h: float, w: float, r: float) -> void:
	for i: int in n:
		var x: float = lerpf(x0, x1, float(i) / maxf(n - 1, 1))
		# Ribs widest mid-chest, splayed flat on the ground either side.
		var span: float = w * (0.75 + 0.25 * sin(PI * float(i) / maxf(n - 1, 1)))
		for side: float in [-1.0, 1.0]:
			var mid := Vector3(x - 0.02, h * 0.8, side * span * 0.6)
			_bone(st, Vector3(x, h, 0.0), mid, r)
			_bone(st, mid, Vector3(x - 0.05, 0.03, side * span), r * 0.9)

static func _skull(st: SurfaceTool, at: Vector3, size: float, snout: float, thick: float) -> void:
	_blob(st, at, Vector3(0.11, 0.08, 0.08) * size)
	if snout > 0.0:
		_bone(st, at + Vector3(0.05 * size, -0.01, 0.0), at + Vector3(0.05 * size + snout, -0.03, 0.0), 0.035 * size * thick)
	# Eye sockets read as two dark-ish bumps; keep it to the jaw for clarity.
	_bone(st, at + Vector3(0.0, -0.05 * size, 0.0), at + Vector3(0.05 * size + snout * 0.8, -0.07 * size, 0.0), 0.018 * size)

static func _quadruped(st: SurfaceTool, spec: Dictionary) -> void:
	var t: float = float(spec.get("thick", 1.0))
	var r: float = 0.022 * t
	var h: float = 0.1
	var leg: float = float(spec.get("leg", 0.3))
	_bone(st, Vector3(-0.45, h, 0.0), Vector3(0.35, h, 0.0), r * 1.4)
	_ribcage(st, -0.15, 0.25, int(spec.get("ribs", 5)), h, 0.2 * t, r * 0.7)
	_blob(st, Vector3(-0.42, h, 0.0), Vector3(0.07, 0.04, 0.09) * t)
	_bone(st, Vector3(0.35, h, 0.0), Vector3(0.5, h + 0.02, 0.0), r * 1.2)
	var head := Vector3(0.58, h + 0.02, 0.0)
	_skull(st, head, float(spec.get("skull", 1.0)), float(spec.get("snout", 0.12)), t)
	# Four legs in two joints, kicked out stiff to one side.
	for hip: float in [-0.4, 0.3]:
		for side: float in [-1.0, 1.0]:
			var a := Vector3(hip, h, side * 0.06)
			var knee := a + Vector3(0.04, -0.05, side * leg * 0.55)
			var foot := knee + Vector3(-0.03, 0.0, side * leg * 0.5)
			_bone(st, a, knee, r)
			_bone(st, knee, foot, r * 0.8)
	var tail: float = float(spec.get("tail", 0.0))
	if tail > 0.0:
		var p := Vector3(-0.45, h, 0.0)
		for k: int in 3:
			var q := p + Vector3(-tail / 3.0, -0.02, tail * 0.12 * float(k))
			_bone(st, p, q, r * (0.7 - 0.15 * float(k)))
			p = q
	match String(spec.get("extra", "")):
		"antlers":
			for side: float in [-1.0, 1.0]:
				var base := head + Vector3(-0.03, 0.06, side * 0.05)
				var tip := base + Vector3(-0.12, 0.05, side * 0.25)
				_bone(st, base, tip, 0.016)
				_bone(st, base + (tip - base) * 0.4, base + (tip - base) * 0.4 + Vector3(0.08, 0.04, side * 0.06), 0.012)
				_bone(st, base + (tip - base) * 0.75, base + (tip - base) * 0.75 + Vector3(0.06, 0.03, side * 0.08), 0.011)
		"horns":
			for side: float in [-1.0, 1.0]:
				var base := head + Vector3(-0.02, 0.06, side * 0.04)
				var mid := base + Vector3(-0.1, 0.03, side * 0.08)
				_bone(st, base, mid, 0.02)
				_bone(st, mid, mid + Vector3(-0.02, -0.05, side * 0.06), 0.014)
		"tusks":
			for side: float in [-1.0, 1.0]:
				var base := head + Vector3(0.1, -0.04, side * 0.04)
				_bone(st, base, base + Vector3(0.07, 0.05, side * 0.04), 0.015)

static func _biped(st: SurfaceTool, spec: Dictionary) -> void:
	var r: float = 0.022
	var h: float = 0.08
	_bone(st, Vector3(-0.15, h, 0.0), Vector3(0.3, h, 0.0), r * 1.3)
	_ribcage(st, 0.1, 0.28, int(spec.get("ribs", 5)), h, 0.16, r * 0.7)
	_blob(st, Vector3(-0.17, h, 0.0), Vector3(0.06, 0.04, 0.1))
	var head := Vector3(0.43, h + 0.02, 0.0)
	_blob(st, head, Vector3(0.09, 0.08, 0.08) * float(spec.get("skull", 1.3)))
	_bone(st, head + Vector3(0.02, -0.06, 0.0), head + Vector3(0.08, -0.07, 0.0), 0.02)
	for side: float in [-1.0, 1.0]:
		# Arms out from the shoulders, legs down from the hips.
		var sh := Vector3(0.28, h, side * 0.12)
		var el := sh + Vector3(-0.12, -0.03, side * 0.12)
		_bone(st, Vector3(0.3, h, 0.0), sh, r * 0.8)
		_bone(st, sh, el, r * 0.8)
		_bone(st, el, el + Vector3(-0.14, -0.02, side * 0.02), r * 0.7)
		var hip := Vector3(-0.17, h, side * 0.06)
		var knee := hip + Vector3(-0.22, -0.03, side * 0.04)
		_bone(st, hip, knee, r)
		_bone(st, knee, knee + Vector3(-0.22, -0.01, side * 0.02), r * 0.9)

static func _bird(st: SurfaceTool, spec: Dictionary) -> void:
	var r: float = 0.02
	var h: float = 0.07
	_bone(st, Vector3(-0.25, h, 0.0), Vector3(0.2, h, 0.0), r * 1.2)
	# The keel: a bird's deep breastbone.
	_blob(st, Vector3(0.0, h - 0.02, 0.0), Vector3(0.14, 0.03, 0.06))
	_ribcage(st, -0.08, 0.12, int(spec.get("ribs", 4)), h, 0.1, r * 0.6)
	var head := Vector3(0.32, h + 0.02, 0.0)
	_bone(st, Vector3(0.2, h, 0.0), head, r)
	_blob(st, head, Vector3(0.07, 0.06, 0.06) * float(spec.get("skull", 1.0)))
	var beak_tip := head + Vector3(0.14, -0.02, 0.0)
	_bone(st, head + Vector3(0.05, 0.0, 0.0), beak_tip, 0.018)
	if spec.get("extra", "") == "hooked":
		_bone(st, beak_tip, beak_tip + Vector3(0.0, -0.04, 0.0), 0.014)
	for side: float in [-1.0, 1.0]:
		# Wings spread flat: arm, forearm and the long finger bones.
		var sh := Vector3(0.1, h, side * 0.05)
		var el := sh + Vector3(-0.05, -0.02, side * 0.25)
		var wr := el + Vector3(0.06, -0.01, side * 0.22)
		_bone(st, sh, el, r)
		_bone(st, el, wr, r * 0.8)
		_bone(st, wr, wr + Vector3(-0.08, 0.0, side * 0.2), r * 0.6)
		var hip := Vector3(-0.2, h, side * 0.04)
		_bone(st, hip, hip + Vector3(-0.12, -0.03, side * 0.08), r * 0.7)
		_bone(st, hip + Vector3(-0.12, -0.03, side * 0.08), hip + Vector3(-0.22, -0.04, side * 0.06), r * 0.5)
	# Tail fan.
	for k: int in 3:
		_bone(st, Vector3(-0.25, h, 0.0), Vector3(-0.42, 0.04, (float(k) - 1.0) * 0.07), r * 0.5)

static func _fish(st: SurfaceTool, spec: Dictionary) -> void:
	var r: float = 0.014
	var h: float = 0.05
	_bone(st, Vector3(-0.4, h, 0.0), Vector3(0.3, h, 0.0), r * 1.3)
	var n: int = int(spec.get("ribs", 9))
	for i: int in n:
		var x: float = lerpf(-0.3, 0.25, float(i) / float(n - 1))
		var len: float = 0.16 * sin(PI * (float(i) + 1.0) / float(n + 1))
		for side: float in [-1.0, 1.0]:
			_bone(st, Vector3(x, h, 0.0), Vector3(x - 0.04, 0.02, side * len), r * 0.5)
	_blob(st, Vector3(0.38, h, 0.0), Vector3(0.1, 0.05, 0.07) * float(spec.get("skull", 1.0)))
	for k: int in 4:
		_bone(st, Vector3(-0.4, h, 0.0), Vector3(-0.55, 0.03, (float(k) - 1.5) * 0.06), r * 0.5)

static func _shell(st: SurfaceTool) -> void:
	# Beetles leave their hard wing cases and a few legs.
	for side: float in [-1.0, 1.0]:
		_blob(st, Vector3(-0.05, 0.08, side * 0.12), Vector3(0.35, 0.07, 0.13))
	_blob(st, Vector3(0.33, 0.07, 0.0), Vector3(0.12, 0.06, 0.12))
	for i: int in 3:
		for side: float in [-1.0, 1.0]:
			var x: float = 0.15 - 0.17 * float(i)
			_bone(st, Vector3(x, 0.05, side * 0.2), Vector3(x - 0.08, 0.02, side * 0.42), 0.02)

# The heap of innards: the same for every creature, scaled to its size.
static func offal() -> ArrayMesh:
	_init_parts()
	if _offal != null:
		return _offal
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i: int in 7:
		var a: float = float(i) / 7.0 * TAU
		var d: float = 0.0 if i == 0 else rng.randf_range(0.08, 0.2)
		var c := Vector3(cos(a) * d * 1.4, 0.05, sin(a) * d)
		var s: float = rng.randf_range(0.08, 0.14) if i > 0 else 0.17
		_blob(st, c, Vector3(s * 1.3, s * 0.55, s))
	# A coil of gut over the top.
	for k: int in 6:
		var a0: float = float(k) * 1.1
		var a1: float = a0 + 1.1
		_bone(st, Vector3(cos(a0) * 0.12, 0.11, sin(a0) * 0.1), Vector3(cos(a1) * 0.12, 0.11, sin(a1) * 0.1), 0.035)
	_offal = st.commit()
	return _offal

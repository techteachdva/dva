class_name Starfruit
extends Node3D

# Rainbow Starfruit: born only from a meteor. The richest food in the valley,
# and every creature will run for it (see MarkovAgent's Rainbow condition).
# It flies out of the broken rock, then hovers and turns where it lands.

const Holo: Shader = preload("res://scripts/visuals/starfruit.gdshader")
const FLIGHT: float = 0.75
# Life-time units: it sits for two days if nothing finds it.
const SHELF_LIFE: float = Clock.BIO_PER_DAY * 2.0
const NUTRITION: float = 120.0

static var _mesh: ArrayMesh
static var _mat: ShaderMaterial

var _from: Vector3
var _to: Vector3
var _t: float = 0.0
var _life: float = SHELF_LIFE
var _body: MeshInstance3D
var _seed: float = 0.0
var taken: bool = false

func launch(from: Vector3, to: Vector3) -> void:
	_from = from
	_to = to

func _ready() -> void:
	add_to_group("starfruit")
	_seed = randf() * TAU
	global_position = _from
	_body = MeshInstance3D.new()
	_body.mesh = _star_mesh()
	if _mat == null:
		_mat = ShaderMaterial.new()
		_mat.shader = Holo
	_body.material_override = _mat
	_body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_body.scale = Vector3.ONE * 1.05
	add_child(_body)
	add_child(glow_quad(3.8, 0.8))

func _process(delta: float) -> void:
	_t += delta
	_life -= delta * Clock.LIFE_PACE
	if _life <= 0.0:
		queue_free()
		return
	_body.rotate_y(delta * 1.6)
	if _t < FLIGHT:
		var f: float = _t / FLIGHT
		var p: Vector3 = _from.lerp(_to, f)
		p.y += sin(f * PI) * 5.0
		global_position = p
		return
	global_position = _to + Vector3.UP * (0.55 + sin(_t * 2.4 + _seed) * 0.12)
	# Now and then a sparkle lifts off it.
	if fmod(_t + _seed, 1.3) < delta:
		FXManager.spawn_birth_particles(global_position, Color.from_hsv(randf(), 0.8, 1.0))

# A camera-facing pool of neon light, for anything Rainbow.
static func glow_quad(size: float, strength: float) -> MeshInstance3D:
	var quad := QuadMesh.new()
	quad.size = Vector2(size, size)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://scripts/visuals/neon_glow.gdshader")
	mat.set_shader_parameter("strength", strength)
	var m := MeshInstance3D.new()
	m.mesh = quad
	m.material_override = mat
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Nothing culls correctly once the vertex shader faces the camera.
	m.custom_aabb = AABB(Vector3.ONE * -size, Vector3.ONE * size * 2.0)
	return m

# True for the first eater; the fruit is gone.
func claim() -> bool:
	if taken or _t < FLIGHT:
		return false
	taken = true
	queue_free()
	return true

# A carambola: five ribs round an axis, pointed at both ends.
static func _star_mesh() -> ArrayMesh:
	if _mesh != null:
		return _mesh
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var ribs: int = 5
	var around: int = ribs * 2
	var bands: int = 8
	var rows: Array = []
	for j: int in bands + 1:
		var v: float = float(j) / float(bands)
		var y: float = lerpf(0.72, -0.72, v)
		var w: float = pow(sin(v * PI), 0.75)
		var row: Array[Vector3] = []
		for i: int in around:
			var a: float = TAU * float(i) / float(around)
			var r: float = (0.62 if i % 2 == 0 else 0.24) * w
			row.append(Vector3(cos(a) * r, y, sin(a) * r))
		rows.append(row)
	for j: int in bands:
		for i: int in around:
			var a: Vector3 = rows[j][i]
			var b: Vector3 = rows[j][(i + 1) % around]
			var c: Vector3 = rows[j + 1][(i + 1) % around]
			var d: Vector3 = rows[j + 1][i]
			for tri: Array in [[a, c, b], [a, d, c]]:
				var n: Vector3 = (tri[2] - tri[0]).cross(tri[1] - tri[0]).normalized()
				if n.length_squared() < 0.5:
					continue
				for p: Vector3 in tri:
					st.set_normal(n)
					st.add_vertex(p)
	_mesh = st.commit()
	return _mesh

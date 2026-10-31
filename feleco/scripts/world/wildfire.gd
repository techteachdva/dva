class_name Wildfire
extends Node3D

# Fire on the ground, cell by cell. It feeds on grass, jumps to anything that
# burns, and leaves ash. Rain and floods douse it and it cannot cross the
# river. Anything walking through burns; everything nearby runs. A hard cap
# keeps it from eating the whole valley.

const FlameShader: Shader = preload("res://scripts/visuals/flame.gdshader")
const CELL: float = 2.5
const LIFE: float = 5.0
const CATCH: float = 0.34
const MAX_CELLS: int = 90
const MAX_EVER: int = 420
const REACH: float = 2.6
const BURN_DAMAGE: float = 6.0
const FEAR_CELLS: int = 3

var sim: SimulationDirector
var _burning: Dictionary = {}
var _spent: Dictionary = {}
var _clock: float = 0.0
var _mesh: QuadMesh
var _mat: ShaderMaterial

func _ready() -> void:
	_mesh = QuadMesh.new()
	_mesh.size = Vector2(3.4, 4.2)
	_mat = ShaderMaterial.new()
	_mat.shader = FlameShader

func _key(p: Vector3) -> Vector2i:
	return Vector2i(floori(p.x / CELL), floori(p.z / CELL))

func ring(at: Vector3, radius: float) -> void:
	for i: int in 12:
		ignite(at + Vector3(cos(i * TAU / 12.0), 0.0, sin(i * TAU / 12.0)) * radius)

func _wet(p: Vector3) -> bool:
	return sim.valley != null and sim.valley.river != null and float(sim.valley.river.sample(p.x, p.z).distance) < River.BASE_HALF_WIDTH * 1.3

func ignite(p: Vector3) -> void:
	var k := _key(p)
	if _burning.has(k) or _spent.has(k) or _burning.size() >= MAX_CELLS or _spent.size() >= MAX_EVER or _wet(p):
		return
	var flame := MeshInstance3D.new()
	flame.mesh = _mesh
	flame.material_override = _mat
	add_child(flame)
	flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flame.global_position = Vector3(p.x + randf_range(-0.7, 0.7), sim.ground_height(p.x, p.z) + 2.0, p.z + randf_range(-0.7, 0.7))
	flame.scale = Vector3.ONE * randf_range(0.8, 1.25)
	_burning[k] = {"at": p, "left": LIFE, "node": flame}

func burning_count() -> int:
	return _burning.size()

# The way to run from any flame close by; zero when none is.
func away_from(p: Vector3) -> Vector3:
	if _burning.is_empty():
		return Vector3.ZERO
	var k := _key(p)
	var run := Vector3.ZERO
	for x: int in range(-FEAR_CELLS, FEAR_CELLS + 1):
		for z: int in range(-FEAR_CELLS, FEAR_CELLS + 1):
			var c: Variant = _burning.get(k + Vector2i(x, z))
			if c != null:
				var off: Vector3 = p - (c["at"] as Vector3)
				off.y = 0.0
				run += off.normalized() / maxf(off.length(), 0.5)
	return run.normalized() if run != Vector3.ZERO else Vector3.ZERO

func _process(delta: float) -> void:
	_clock -= delta
	if _clock > 0.0 or _burning.is_empty():
		return
	_clock = 0.5
	# Rain and rising water put it out fast.
	var doused: bool = sim.is_raining() or sim.flood_level() > 0.2
	for k: Vector2i in _burning.keys():
		var c: Dictionary = _burning[k]
		c["left"] = float(c["left"]) - (3.0 if doused else 0.5)
		var p: Vector3 = c["at"]
		var fuel: float = sim.grass.consume_density(p, 0.3) if sim.grass != null else 0.0
		_scorch(p)
		if not doused:
			for o: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				if randf() < CATCH * (1.0 if fuel > 0.0 else 0.35):
					ignite(p + Vector3(o.x, 0, o.y) * CELL)
		if float(c["left"]) <= 0.0:
			(c["node"] as Node).queue_free()
			_burning.erase(k)
			_spent[k] = true

func _scorch(p: Vector3) -> void:
	for tag: String in ["tree", "bush"]:
		for n: Node in get_tree().get_nodes_in_group(tag):
			if n is Node3D and (n as Node3D).global_position.distance_to(p) < REACH:
				sim.splinter(n, Color(0.12, 0.09, 0.07))
				for i: int in 3:
					ignite(p + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4)))
	var hut: Node3D = sim.hut_near(p, REACH + 1.0)
	if hut != null:
		sim.destroy_hut(hut)
	for a: Node3D in sim.get_nearby_agents(p, REACH):
		if a is MarkovAgent and a.get("indoors") != true:
			SeasonBook.hurt(a, BURN_DAMAGE)

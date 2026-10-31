class_name DesirePaths
extends Node3D

# Worn dirt tracks between homes. Each new house joins its nearest neighbours
# by a wandering, fractal route with side branches. Feet wear them darker,
# walkers on them move half again as fast, and humans take them home at night.
# A route over the river costs one tree and gets a plank bridge. When a home is
# razed, the tracks that served only it fade away.

const CELL: float = 2.0
const WIDTH: float = 0.75
const DEPTH: int = 4
const WANDER: float = 0.2
const SPEED: float = 1.5
const LINKS_PER_HOME: int = 2
const MAX_LEG: float = 90.0
const SIGHT: float = 9.0
const FRESH := Color(0.62, 0.5, 0.33)
const WORN := Color(0.22, 0.15, 0.1)
const STEPS_TO_WEAR: float = 14.0
const REFRESH: float = 4.0
const WET_REACH: float = River.BASE_HALF_WIDTH * 1.5
const DECK_LIFT: float = 0.45
const FLOOD_BREAK: float = 0.25
const REBUILD_SECS: float = 90.0
const REBUILD_TREES: int = 2
# About one route in three grows into a tree tunnel, up to a few in the valley.
# Each holds a limited store of sap: walkers heal from it until it runs dry.
const TUNNEL_CHANCE: float = 0.35
const TUNNEL_MAX: int = 3
const TUNNEL_SPACING: int = 2
const TUNNEL_SIDE: float = 3.2
const SAP_MAX: float = 120.0
const SAP_REGROW: float = 2.0
const SAP_BITE: float = 1.0
const CLEAR_REACH: float = 1.8
const HOME_CLEAR: float = 5.0
const MYCELIUM_SIDE: float = 2.4

var sim: SimulationDirector
var bridges: int = 0
var _homes: Array[Vector3] = []
var _routes: Array[Dictionary] = []
var _grid: Dictionary = {}
var _steps: Dictionary = {}
var _decks: Dictionary = {}
var _clock: float = REFRESH
var _wood: StandardMaterial3D

func _ready() -> void:
	_wood = StandardMaterial3D.new()
	_wood.albedo_color = Color(0.68, 0.48, 0.28)
	_wood.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX

func _key(p: Vector3) -> Vector2i:
	return Vector2i(floori(p.x / CELL), floori(p.z / CELL))

func on_path(p: Vector3) -> bool:
	return _grid.has(_key(p))

# The height of a bridge deck here, or NAN on open ground.
func deck_height(p: Vector3) -> float:
	return float(_decks.get(_key(p), NAN))

func step(p: Vector3) -> void:
	var k := _key(p)
	if _grid.has(k):
		_steps[k] = int(_steps.get(k, 0)) + 1

func route_count() -> int:
	return _routes.size()

func wear_of(i: int) -> float:
	return float(_routes[i]["wear"])

func _process(delta: float) -> void:
	_clock -= delta
	if _clock > 0.0:
		return
	_clock = REFRESH
	for r: Dictionary in _routes:
		if r.has("sap"):
			r["sap"] = minf(float(r["sap"]) + SAP_REGROW, SAP_MAX)
		_feed_mycelium(r)
		if float(r.get("broken", 0.0)) > 0.0:
			r["broken"] = float(r["broken"]) - REFRESH
			if float(r["broken"]) <= 0.0:
				_rebuild(r)
		var total: int = 0
		for k: Vector2i in r["keys"]:
			total += int(_steps.get(k, 0))
		r["wear"] = clampf(float(total) / (float((r["keys"] as Array).size()) * STEPS_TO_WEAR), 0.0, 1.0)
		(r["mat"] as StandardMaterial3D).albedo_color = FRESH.lerp(WORN, float(r["wear"]))

func add_home(at: Vector3) -> void:
	var near: Array[Vector3] = _homes.duplicate()
	near.sort_custom(func(a: Vector3, b: Vector3) -> bool: return a.distance_squared_to(at) < b.distance_squared_to(at))
	for i: int in mini(LINKS_PER_HOME, near.size()):
		if near[i].distance_to(at) <= MAX_LEG:
			var route: Array[Vector3] = _fractal(at, near[i], DEPTH)
			if _lay(route, at, near[i]):
				var mid: Vector3 = route[route.size() / 2]
				# A branch off the track, as feet find a shortcut.
				_lay(_fractal(mid, sim.dry_land(mid + (near[i] - at).rotated(Vector3.UP, 1.1).normalized() * 9.0), 2), at, near[i])
	_homes.append(at)

# Each bridge has a one in four chance of going with the flood.
func flood() -> void:
	for r: Dictionary in _routes:
		if r.has("boards") and is_instance_valid(r["boards"]) and (r["boards"] as Node3D).visible and randf() < FLOOD_BREAK:
			(r["boards"] as Node3D).visible = false
			r["broken"] = REBUILD_SECS
			for k: Vector2i in r["deck_keys"]:
				_decks.erase(k)
			sim.chronicle.emit("The flood tears a bridge away.")

# Back up, at twice the timber of the first one. No trees: try again later.
func _rebuild(r: Dictionary) -> void:
	var trees: Array = []
	for i: int in REBUILD_TREES:
		var t: Node3D = sim.find_nearest_tree((r["pts"] as Array)[0])
		if t == null or trees.has(t):
			r["broken"] = REBUILD_SECS
			return
		trees.append(t)
		t.remove_from_group("tree")
	for t: Node3D in trees:
		t.queue_free()
	(r["boards"] as Node3D).visible = true
	var keys: Dictionary = r["deck_keys"]
	for k: Vector2i in keys:
		_decks[k] = keys[k]

# Threads creep along both verges, never on the track itself.
func _feed_mycelium(r: Dictionary) -> void:
	if sim.mycelium == null or not sim.mycelium.has_method("add_density_at_world"):
		return
	var pts: Array = r["pts"]
	for i: int in range(0, pts.size() - 1, 2):
		var a: Vector3 = pts[i]
		var side: Vector3 = ((pts[i + 1] as Vector3) - a).cross(Vector3.UP).normalized() * MYCELIUM_SIDE
		sim.mycelium.add_density_at_world(a + side, 0.3)
		sim.mycelium.add_density_at_world(a - side, 0.3)

func _clear(route: Array[Vector3]) -> void:
	for tag: String in ["tree", "bush"]:
		for n: Node in get_tree().get_nodes_in_group(tag):
			var plant := n as Node3D
			if plant == null:
				continue
			for p: Vector3 in route:
				if plant.global_position.distance_to(p) < CLEAR_REACH:
					sim.splinter(plant, Color(0.42, 0.3, 0.18))
					break

func _plant_tunnel(entry: Dictionary, route: Array[Vector3]) -> void:
	entry["sap"] = SAP_MAX
	for i: int in range(1, route.size() - 1, TUNNEL_SPACING):
		var side: Vector3 = (route[i + 1] - route[i]).cross(Vector3.UP).normalized() * TUNNEL_SIDE
		sim.plant_bush(route[i] + side, true)
		sim.plant_bush(route[i] - side, true)

func tunnel_count() -> int:
	var n: int = 0
	for r: Dictionary in _routes:
		n += 1 if r.has("sap") else 0
	return n

func _tunnel_at(p: Vector3) -> Dictionary:
	if not on_path(p):
		return {}
	var k := _key(p)
	for r: Dictionary in _routes:
		if r.has("sap") and float(r["sap"]) > 0.0 and (r["keys"] as Array).has(k):
			return r
	return {}

# A bite of sap for a walker in a tunnel; 0 when it is dry or there is none.
func sip(p: Vector3) -> float:
	var r: Dictionary = _tunnel_at(p)
	if r.is_empty():
		return 0.0
	r["sap"] = float(r["sap"]) - SAP_BITE
	return SAP_BITE

# The middle of the nearest tunnel with sap, for the hungry and hurt who know.
func tunnel_near(p: Vector3) -> Vector3:
	var best := Vector3.INF
	var best_d: float = INF
	for r: Dictionary in _routes:
		if r.has("sap") and float(r["sap"]) > SAP_MAX * 0.2:
			var pts: Array = r["pts"]
			var mid: Vector3 = pts[pts.size() / 2]
			var d: float = mid.distance_squared_to(p)
			if d < best_d:
				best_d = d
				best = mid
	return best

# A razed home takes its tracks with it, fading out.
func remove_home(at: Vector3) -> void:
	_homes.erase(at)
	for r: Dictionary in _routes.duplicate():
		if (r["a"] as Vector3).is_equal_approx(at) or (r["b"] as Vector3).is_equal_approx(at):
			_routes.erase(r)
			for k: Vector2i in r["keys"]:
				var left: int = int(_grid.get(k, 1)) - 1
				if left <= 0:
					_grid.erase(k)
					_decks.erase(k)
				else:
					_grid[k] = left
			var node: Node3D = r["node"]
			var mat: StandardMaterial3D = r["mat"]
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			var tw := node.create_tween()
			tw.tween_property(mat, "albedo_color:a", 0.0, 3.0)
			tw.tween_callback(node.queue_free)

# Midpoint displacement: every leg bends to the side, then its halves do too.
func _fractal(a: Vector3, b: Vector3, depth: int) -> Array[Vector3]:
	if depth <= 0:
		return [a, b]
	var side: Vector3 = (b - a).cross(Vector3.UP).normalized()
	var mid: Vector3 = (a + b) * 0.5 + side * a.distance_to(b) * randf_range(-WANDER, WANDER)
	# Tracks bend round houses; they never run through one.
	for home: Vector3 in _homes:
		var off: Vector3 = mid - home
		off.y = 0.0
		if off.length() < HOME_CLEAR and off.length() > 0.01 and not home.is_equal_approx(a) and not home.is_equal_approx(b):
			mid = home + off.normalized() * HOME_CLEAR
	var left: Array[Vector3] = _fractal(a, mid, depth - 1)
	left.pop_back()
	left.append_array(_fractal(mid, b, depth - 1))
	return left

func _wet(p: Vector3) -> bool:
	return sim.valley != null and sim.valley.river != null and float(sim.valley.river.sample(p.x, p.z).distance) < WET_REACH

# False when the route needs a bridge and no tree is left to build it.
func _lay(route: Array[Vector3], home_a: Vector3, home_b: Vector3) -> bool:
	var crosses: bool = false
	for p: Vector3 in route:
		crosses = crosses or _wet(p)
	if crosses:
		var tree: Node3D = sim.find_nearest_tree(route[route.size() / 2])
		if tree == null:
			return false
		tree.queue_free()
		bridges += 1
	_clear(route)
	var dirt := SurfaceTool.new()
	dirt.begin(Mesh.PRIMITIVE_TRIANGLES)
	var deck := SurfaceTool.new()
	deck.begin(Mesh.PRIMITIVE_TRIANGLES)
	var keys: Array[Vector2i] = []
	var bank: float = sim.ground_height(route[0].x, route[0].z)
	var any_deck: bool = false
	var deck_keys: Dictionary = {}
	for i: int in route.size() - 1:
		var a: Vector3 = route[i]
		var b: Vector3 = route[i + 1]
		var side: Vector3 = (b - a).cross(Vector3.UP).normalized() * WIDTH
		var n: int = maxi(1, ceili(a.distance_to(b) / CELL))
		for k: int in n:
			var p: Vector3 = a.lerp(b, float(k) / n)
			var q: Vector3 = a.lerp(b, float(k + 1) / n)
			var key := _key(p)
			keys.append(key)
			_grid[key] = int(_grid.get(key, 0)) + 1
			var wet: bool = _wet(p) or _wet(q)
			if not wet:
				bank = sim.ground_height(p.x, p.z)
			else:
				_decks[key] = bank + DECK_LIFT
				deck_keys[key] = bank + DECK_LIFT
				any_deck = true
			var st: SurfaceTool = deck if wet else dirt
			var y0: float = bank + DECK_LIFT if wet else sim.ground_height(p.x, p.z) + 0.07
			var y1: float = bank + DECK_LIFT if wet else sim.ground_height(q.x, q.z) + 0.07
			var s: Vector3 = side
			var quad: Array[Vector3] = [_at(p - s, y0), _at(p + s, y0), _at(q + s, y1), _at(q - s, y1)]
			st.set_normal(Vector3.UP)
			for v: int in [0, 2, 1, 0, 3, 2]:
				st.add_vertex(quad[v])
	var holder := Node3D.new()
	add_child(holder)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = FRESH
	mat.roughness = 1.0
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var ground := MeshInstance3D.new()
	ground.mesh = dirt.commit()
	ground.material_override = mat
	holder.add_child(ground)
	var boards: MeshInstance3D = null
	if any_deck:
		boards = MeshInstance3D.new()
		boards.mesh = deck.commit()
		boards.material_override = _wood
		_wood.cull_mode = BaseMaterial3D.CULL_DISABLED
		holder.add_child(boards)
	var entry: Dictionary = {"pts": route, "keys": keys, "a": home_a, "b": home_b, "mat": mat, "node": holder, "wear": 0.0}
	if boards != null:
		entry["boards"] = boards
		entry["deck_keys"] = deck_keys
	if not crosses and tunnel_count() < TUNNEL_MAX and randf() < TUNNEL_CHANCE:
		_plant_tunnel(entry, route)
	_routes.append(entry)
	return true

func _at(p: Vector3, y: float) -> Vector3:
	return Vector3(p.x, y, p.z)

# The next spot along the track toward goal, or goal if no track is close.
func next_toward(from: Vector3, goal: Vector3) -> Vector3:
	var best: Array = []
	var best_d: float = SIGHT * SIGHT
	for r: Dictionary in _routes:
		var route: Array = r["pts"]
		for i: int in route.size():
			var d: float = (route[i] as Vector3).distance_squared_to(from)
			if d < best_d:
				best_d = d
				best = [route, i]
	if best.is_empty():
		return goal
	var r2: Array = best[0]
	var i2: int = best[1]
	var ahead: Vector3 = r2[mini(i2 + 2, r2.size() - 1)]
	var behind: Vector3 = r2[maxi(i2 - 2, 0)]
	var pick: Vector3 = ahead if ahead.distance_squared_to(goal) < behind.distance_squared_to(goal) else behind
	# Only worth it if the track actually gets it closer.
	return pick if pick.distance_squared_to(goal) < from.distance_squared_to(goal) else goal

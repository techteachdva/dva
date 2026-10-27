extends Node

# Dev-only automated playtest (not exported). Runs the valley through every
# season and reports glitches a player would see:
# godot --rendering-driver opengl3 --path . res://scenes/dev/playtest.tscn
#   bad numbers, creatures sunk into or floating off the ground, strays out
#   past the slopes, sleepers sliding about, trees in huts, the follow camera
#   inside the terrain or losing its creature, and how often falcons kill.

const SEASON_SECONDS: float = 40.0

var dir: SimulationDirector
var hud: Node
var issues: Dictionary = {}
var examples: Dictionary = {}
var falcon_kills: int = 0
var falcon_dives: int = 0
var falcon_perches: int = 0
var _last_state: Dictionary = {}
var _sleep_pos: Dictionary = {}

func _ready() -> void:
	_go.call_deferred()

func _flag(kind: String, detail: String) -> void:
	issues[kind] = int(issues.get(kind, 0)) + 1
	if not examples.has(kind):
		examples[kind] = detail

func _go() -> void:
	var w: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(w)
	get_tree().current_scene = w
	for i in 90:
		await get_tree().process_frame
	get_tree().paused = false
	dir = w.get_node("World")
	dir.cfg_time_limit = 1000.0
	var goals = get_tree().get_first_node_in_group("goals_panel")
	hud = goals.hud
	hud._director = dir
	goals.director = dir
	for c in hud.get_children():
		if c.name == "Welcome":
			c.queue_free()
	Engine.time_scale = 4.0
	for season in 4:
		print("PT season ", dir.get_season())
		var t: float = 0.0
		var follow_i: int = 0
		while t < SEASON_SECONDS:
			t += get_process_delta_time()
			await get_tree().process_frame
			_check_agents()
			_check_camera()
			if int(t / 6.0) != follow_i:
				follow_i = int(t / 6.0)
				_follow_someone(follow_i)
		_check_trees()
		_census()
		dir._season_day = dir.SEASON_LENGTH
		await get_tree().process_frame
	print("PT falcons: dives=%d kills=%d perches=%d" % [falcon_dives, falcon_kills, falcon_perches])
	for k: String in issues.keys():
		print("PT ISSUE %s x%d  e.g. %s" % [k, issues[k], examples[k]])
	if issues.is_empty():
		print("PT no issues")
	get_tree().quit()

func _census() -> void:
	var c := {}
	for d: AgentData in dir._agent_registry:
		c[d.species] = int(c.get(d.species, 0)) + 1
	print("PT census ", str(c).replace("\"", ""), " corpses=", dir.get_node("Corpses").get_child_count(), " frozen=", dir.river_frozen)

func _check_agents() -> void:
	for d: AgentData in dir._agent_registry:
		if d.node == null or not is_instance_valid(d.node):
			continue
		var n: Node3D = d.node
		var p: Vector3 = n.global_position
		if not p.is_finite():
			_flag("non-finite position", d.species)
			continue
		var r: float = Vector2(p.x, p.z).length()
		var aerial: bool = n.get("_aerial") == true
		var ground: float = dir.ground_height(p.x, p.z)
		if r > MarkovAgent.BOUNDARY_HARD + (8.0 if aerial else 1.5) and d.species != "fish":
			_flag("beyond the slopes", "%s r=%.1f state=%s aerial=%s y=%.1f inside=%s" % [d.species, r, d.state, aerial, p.y, n.is_inside_tree()])
		if not aerial and d.species != "fish" and (p.y < ground - 0.6 or p.y > ground + 2.0):
			_flag("off the ground", "%s y=%.2f ground=%.2f state=%s" % [d.species, p.y, ground, d.state])
		# Falcon kills: entering Eat straight from a Dive.
		var prev: String = _last_state.get(d, "")
		if d.species == "falcon" and d.state == "Eat" and prev == "Dive":
			falcon_kills += 1
		if d.species == "falcon" and d.state == "Dive" and prev != "Dive":
			falcon_dives += 1
		if d.species == "falcon" and d.state == "Perch" and prev != "Perch":
			falcon_perches += 1
		_last_state[d] = d.state
		# Sleepers must lie still (walking home to bed is fine).
		# Only those drawn lying down count (see VisualProxyManager).
		if d.state == "Sleep" and d.vel.length() < 0.3 and d.prev_pos.distance_squared_to(d.pos) <= 0.0025:
			if _sleep_pos.has(d) and Vector2(p.x - _sleep_pos[d].x, p.z - _sleep_pos[d].z).length() > 0.15:
				_flag("sleeper slid", "%s moved %.2f" % [d.species, Vector2(p.x - _sleep_pos[d].x, p.z - _sleep_pos[d].z).length()])
			_sleep_pos[d] = p
		else:
			_sleep_pos.erase(d)

func _follow_someone(i: int) -> void:
	var order := ["falcon", "robin", "fish", "sheep", "wolf", "human", "deer", "goat", "bear"]
	var want: String = order[i % order.size()]
	for d: AgentData in dir._agent_registry:
		if d.species == want and d.node is MarkovAgent:
			hud._start_follow(d.node)
			return

func _check_camera() -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var cp := cam.global_position
	if cp.y < dir.ground_height(cp.x, cp.z) + 0.5:
		_flag("camera under the terrain", str(cp))
	var f = cam.call("following") if cam.has_method("following") else null
	if f == null or not is_instance_valid(f):
		return
	var d: AgentData = f.get("_data")
	if d == null or not d.has_shown:
		return
	var at := Vector3(d.shown.x, d.drawn_mid_y, d.shown.z)
	if cam.is_position_behind(at) or not get_viewport().get_visible_rect().grow(-10).has_point(cam.unproject_position(at)):
		_flag("followed creature off screen", "%s at y=%.1f" % [d.species, d.drawn_mid_y])
		return
	# Terrain between the camera and the creature hides it.
	for k: int in range(1, 10):
		var q := cp.lerp(at, float(k) / 10.0)
		if q.y < dir.ground_height(q.x, q.z) - 0.2:
			_flag("followed creature hidden by terrain", "%s" % d.species)
			return

func _check_trees() -> void:
	for t in dir.get_node("Trees").get_children() + dir.get_node("Bushes").get_children():
		for s in dir._active_shelters:
			if is_instance_valid(s) and Vector2(t.global_position.x - s.global_position.x, t.global_position.z - s.global_position.z).length() < 3.0:
				_flag("tree in a hut", str(t.global_position))

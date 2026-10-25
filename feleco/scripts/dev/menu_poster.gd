extends Node

# Dev-only: stages the four main-menu posters (one per season) in the real
# valley. The live creatures are hidden and a cast is posed by hand along
# the river, each season with its own light and its own story:
#   Spring  lambing, fish running, a falcon stooping on a fish, blossom
#   Summer  a spear-fisher, a fish taking a worm, a migration, rabbit swarms
#   Autumn  the flood falling back: stranded fish, carcasses, worms, robins
#           on the worms, a hawk on the robins, mushrooms in the rot
#   Winter  wolves running down the flock across the snow
# Each render writes <season>.png and the screen-space hotspots the menu pulses.
#   godot --path . res://scenes/dev/shots.tscn -- --out=<dir> --scene=world --menuposter --window=1920x1080 --times=99

const LIGHT: Dictionary = {
	# daylight, sun colour, energy, saturation
	"Spring": [0.9, Color(1.0, 0.9, 0.76), 1.2, 1.15],
	"Summer": [1.0, Color(1.0, 0.97, 0.88), 1.35, 1.12],
	"Autumn": [0.62, Color(1.0, 0.68, 0.42), 1.35, 1.2],
	"Winter": [0.6, Color(0.82, 0.88, 1.0), 1.0, 0.95],
}

var out: String = ""
var _dir: SimulationDirector
var _river: River
var _vpm: VisualProxyManager
var _s0: float
var _cam: Camera3D
var _sun: DirectionalLight3D
var _env: Environment
var _cast: Dictionary = {}
var _spots: Array = []
var _fwd: Vector3
var _right: Vector3
var _c: Vector3
var _framers: Array[Node3D] = []

func setup() -> void:
	var scene := get_tree().current_scene
	_dir = scene.get_node_or_null("World") as SimulationDirector
	_river = _dir.valley.river
	_dir.process_mode = Node.PROCESS_MODE_DISABLED
	_dir._visual_proxy_manager.visible = false
	for n: Node in get_tree().get_nodes_in_group("corpse"):
		n.queue_free()
	_vpm = VisualProxyManager.new()
	scene.add_child(_vpm)
	await get_tree().process_frame
	_vpm.set_process(false)
	for m: ShaderMaterial in _vpm._materials.values():
		m.set_shader_parameter("rim", 0.0)
	_sun = scene.get_node_or_null("DirectionalLight3D") as DirectionalLight3D
	var env_node := _dir.valley.get_node_or_null("ValleySky") as WorldEnvironment
	if env_node != null:
		_env = env_node.environment
		_env.glow_enabled = true
		_env.glow_intensity = 0.6
		_env.glow_bloom = 0.08
		_env.adjustment_enabled = true
		_env.adjustment_contrast = 1.08
	_s0 = _river.length() * 0.5
	# Camera: the river runs across the picture, the near bank below.
	var t0: Vector3 = _river.tangent_at(_s0)
	_fwd = Vector3(-t0.z, 0.0, t0.x).normalized().rotated(Vector3.UP, deg_to_rad(20.0))
	_right = _fwd.cross(Vector3.UP).normalized()
	_c = _river.point_at(_s0)
	_cam = Camera3D.new()
	_cam.fov = 46.0
	scene.add_child(_cam)
	var eye: Vector3 = _c - _fwd * 25.0
	eye.y = _dir.ground_height(eye.x, eye.z) + 9.5
	var look: Vector3 = _c + _fwd * 6.0
	look.y = _dir.ground_height(look.x, look.z) + 1.0
	_cam.position = eye
	_cam.look_at(look, Vector3.UP)
	_cam.make_current()
	# Only trees right in front of the lens go; the rest frame the scene.
	for n: Node in scene.find_children("*", "Node3D", true, false):
		if n is GPUParticles3D or n is CPUParticles3D:
			(n as Node3D).visible = false
		elif n.is_in_group("tree") or n.is_in_group("apple"):
			var q: Vector3 = (n as Node3D).global_position - eye
			var depth: float = q.dot(_fwd)
			if (depth < 14.0 and absf(q.dot(_right)) < depth * 0.8):
				(n as Node3D).visible = false
	for n: Node in scene.find_children("*", "CanvasLayer", true, false):
		(n as CanvasLayer).visible = false

func season(name: String) -> void:
	_cast.clear()
	_spots.clear()
	_dir._current_season = name
	_dir._apply_season_mood(name, true)
	var look: Array = LIGHT[name]
	_dir.daylight = float(look[0])
	_dir._apply_daylight()
	if _sun != null:
		_sun.light_color = look[1]
		_sun.light_energy = float(look[2])
		_sun.shadow_enabled = true
	if _env != null:
		_env.adjustment_saturation = float(look[3])
	_dir._set_flood_scale(2.0 if name == "Autumn" else 1.35)
	var hw: float = _river.half_width()
	match name:
		"Spring":
			# Hero: a falcon stooping on a fish mid-river.
			_put("fish", 0.0, 1.0, {"water": true, "act": 3, "face": -1.0, "scale": 1.7})
			_put("falcon", 0.4, 1.0, {"air": 3.0, "act": 2, "face": -1.0, "scale": 2.1, "phase": 0.6, "snap": true})
			_spot(0.2, 1.0, 1.9, 1.0, 1.8)
			# Fish running upriver.
			for k: int in 4:
				_put("fish", -9.0 + k * 1.8, 3.0 + k * 0.4, {"water": true, "act": 0, "face": -1.0, "scale": 1.2, "motion": 1.0, "phase": k})
			_spot(-6.0, 3.6, 2.6, 0.6, 0.5)
			# Lambing: ewes and lambs on the near bank.
			for k: int in 5:
				_put("sheep", 5.0 + k * 1.5, 6.0 + (k % 2) * 1.3, {"act": 1 if k % 2 == 0 else 0, "face": -1.0, "scale": 1.5 if k % 2 == 0 else 0.95, "phase": k * 0.9})
			_spot(8.0, 6.5, 2.6, 0.7, 0.8)
			# Robins nesting, worms in the wet soil.
			_put("robin", -7.0, 7.0, {"act": 1, "face": 1.0, "scale": 1.7})
			_put("worm", -6.0, 7.2, {"act": 3, "face": -1.0, "scale": 1.5})
			_spot(-6.5, 7.0, 1.3, 0.8, 0.6)
			_put("rabbit", 1.5, 9.5, {"act": 1, "face": 1.0, "scale": 1.4})
		"Summer":
			# A spear-fisher on the bank and the fish he is after.
			_put("human", -2.0, 5.0, {"act": 2, "face": 1.0, "scale": 1.8})
			_put("fish", -0.4, 4.0, {"water": true, "act": 3, "face": 1.0, "scale": 1.6})
			_spot(-1.2, 4.6, 1.7, 1.0, 1.4)
			# A fish rising to a worm at the water's edge.
			_put("fish", 6.0, 2.0, {"water": true, "act": 1, "face": -1.0, "scale": 1.5})
			_put("worm", 6.8, 2.6, {"act": 3, "face": -1.0, "scale": 1.5})
			_spot(6.4, 2.3, 1.2, 0.8, 0.6)
			# Migration along the far bank.
			for k: int in 11:
				var sp: String = "boar" if k % 3 == 0 else "sheep"
				_put(sp, -14.0 + k * 2.4, -12.0 - sin(k * 0.7) * 1.0, {"act": 0, "face": 1.0, "scale": 1.35, "motion": 1.0, "phase": k * 1.1})
			_spot(-2.0, -12.0, 7.5, 0.6, 0.6)
			# Rabbits everywhere, a falcon overhead.
			for k: int in 5:
				_put("rabbit", 4.0 + k * 1.6, 7.5 + (k % 2) * 1.4, {"act": 1 if k % 2 else 3, "face": -1.0, "scale": 1.3, "phase": k, "motion": 0.0 if k % 2 else 1.0})
			_put("falcon", 8.0, 8.0, {"air": 4.6, "act": 0, "face": -1.0, "scale": 1.9})
			_spot(7.5, 8.0, 2.4, 0.8, 2.4)
		"Autumn":
			# The flood falling back: fish left flopping, the dead feeding the soil.
			_put("fish", -5.0, 5.5, {"act": 4, "face": 1.0, "scale": 1.5, "lift": 0.5})
			_put("fish", -3.4, 6.8, {"act": 4, "face": -1.0, "scale": 1.4, "lift": 0.25})
			_spot(-4.2, 6.0, 1.8, 0.9, 0.5)
			_corpse(1.0, 5.6, "fish")
			_corpse(2.4, 6.8, "fish")
			_put("worm", 1.4, 6.2, {"act": 1, "face": 1.0, "scale": 1.5})
			_put("worm", 2.8, 7.3, {"act": 1, "face": -1.0, "scale": 1.4})
			_put("mushroom", 3.6, 5.2, {"scale": 1.3, "cell": 1, "lift": 0.0})
			_put("mushroom", 0.0, 7.4, {"scale": 1.0, "cell": 2, "lift": 0.0})
			_spot(1.8, 6.3, 2.2, 0.8, 0.5)
			# Robins on the worms; a hawk dropping on the robins.
			_put("robin", 5.0, 6.6, {"act": 1, "face": -1.0, "scale": 1.7})
			_put("robin", 6.2, 5.0, {"act": 3, "face": 1.0, "scale": 1.6, "air": 0.9})
			_put("falcon", 6.4, 5.4, {"air": 3.6, "act": 2, "face": -1.0, "scale": 2.0, "cell": 1})
			_spot(5.8, 5.6, 2.0, 1.0, 2.0)
			# Boar rooting for the autumn mast under the trees.
			for k: int in 3:
				_put("boar", -12.0 + k * 1.8, -6.0 - k * 0.8, {"act": 1, "face": 1.0, "scale": 1.5, "phase": k})
			_spot(-10.5, -6.6, 2.4, 0.6, 0.8)
		"Winter":
			# Wolves running the flock down across the snow.
			for k: int in 7:
				_put("sheep", 2.0 + (k % 4) * 1.7, 4.0 + (k / 4) * 1.8 + (k % 2) * 0.5, {"act": 3, "face": 1.0, "scale": 1.5, "phase": k * 0.9, "motion": 1.0})
			_put("wolf", -3.0, 4.6, {"act": 2, "face": 1.0, "scale": 1.8, "motion": 1.0})
			_put("wolf", -5.0, 6.4, {"act": 2, "face": 1.0, "scale": 1.7, "cell": 3, "phase": 1.3, "motion": 1.0})
			_put("wolf", -6.4, 3.6, {"act": 0, "face": 1.0, "scale": 1.6, "phase": 2.1, "motion": 1.0})
			_spot(0.5, 5.0, 3.6, 1.0, 1.0)
			# A villager hurrying home; a falcon hunched over a kill.
			_put("human", -10.0, 8.0, {"act": 3, "face": -1.0, "scale": 1.7, "motion": 1.0})
			_put("falcon", 9.0, -4.0, {"act": 1, "face": -1.0, "scale": 1.7})
			_put("rabbit", 9.8, -4.2, {"act": 4, "face": 1.0, "scale": 1.2, "lift": 0.3})
			_spot(9.4, -4.0, 1.4, 0.7, 0.7)
	_flush()
	# Framing trees at the sides, dressed for the season.
	for t: Node3D in _framers:
		t.queue_free()
	_framers.clear()
	for spot: Vector2 in [Vector2(-12.0, 1.0), Vector2(13.0, -1.5), Vector2(-4.0, -9.0)]:
		var tree: Node3D = load("res://scenes/tree.tscn").instantiate()
		tree.set_process(false)
		get_tree().current_scene.add_child(tree)
		tree.global_position = _ground(spot.x, spot.y)
		tree._season = ""
		tree.apply_season(name)
		_framers.append(tree)
	# A tree standing between the lens and a highlighted moment steps aside.
	var view := Vector2(get_viewport().get_visible_rect().size)
	for t: Node in get_tree().get_nodes_in_group("tree"):
		var tn := t as Node3D
		if tn in _framers or _cam.is_position_behind(tn.global_position):
			continue
		var tp: Vector2 = _cam.unproject_position(tn.global_position + Vector3.UP * 3.0) / view
		# Nothing big and close to the lens either.
		var hide: bool = _cam.global_position.distance_to(tn.global_position) < 20.0
		for sp: Array in _spots:
			var sc: Vector2 = _cam.unproject_position(sp[0]) / view
			if tp.distance_to(sc) < 0.12 and _cam.global_position.distance_to(tn.global_position) < _cam.global_position.distance_to(sp[0]) + 2.0:
				hide = true
		tn.visible = not hide
	for i: int in 6:
		await get_tree().process_frame

func shoot(name: String) -> void:
	for n: Node in get_tree().root.find_children("*", "Label3D", true, false):
		(n as Node3D).visible = false
	await get_tree().process_frame
	var img: Image = get_viewport().get_texture().get_image()
	img.save_jpg(out + "/" + name.to_lower() + ".jpg", 0.88)
	var size := Vector2(get_viewport().get_visible_rect().size)
	var spots: Array = []
	for sp: Array in _spots:
		var c: Vector2 = _cam.unproject_position(sp[0]) / size
		var edge: Vector2 = _cam.unproject_position(sp[0] + _cam.global_basis.x * float(sp[1])) / size
		spots.append([snappedf(c.x, 0.001), snappedf(c.y, 0.001), snappedf(c.distance_to(edge), 0.001), sp[2]])
	print("SPOTS ", name, " ", JSON.stringify(spots))

func _ground(x: float, d: float, o: Dictionary = {}) -> Vector3:
	var p: Vector3 = _c + _right * x - _fwd * d
	var w: Vector3 = _river.point_at(_river.nearest_s(p.x, p.z))
	if o.get("water", false) or o.get("snap", false):
		# Out in the current, nearest that spot.
		var off: Vector3 = p - w
		off.y = 0.0
		var lim: float = _river.half_width() * 0.6
		p = w + (off.limit_length(lim) if off.length() > 0.01 else Vector3.ZERO)
	else:
		# Anything on foot stays on dry land, just clear of the water.
		var off2: Vector3 = p - w
		off2.y = 0.0
		var clear: float = _river.half_width() * 1.8 + 1.0
		if off2.length() < clear:
			p = w + (off2.normalized() if off2.length() > 0.01 else -_fwd) * clear
	p.y = _dir.ground_height(p.x, p.z)
	return p

func _spot(x: float, d: float, radius: float, strength: float, up: float) -> void:
	var p: Vector3 = _ground(x, d)
	p.y += up
	_spots.append([p, radius, strength])

func _corpse(x: float, d: float, species: String) -> void:
	_dir.spawn_corpse(_ground(x, d), 3.0, species)

func _put(species: String, x: float, d: float, o: Dictionary) -> void:
	var p: Vector3 = _ground(x, d, o)
	if o.get("water", false):
		p.y = _dir.valley.surface_height(p.x, p.z)
	var size: Vector2 = VisualProxyManager.SPECIES_CONFIG[species]["size"]
	var s: float = o.get("scale", 1.0)
	var lift: float = size.y * (0.5 - VisualProxyManager.FOOT_MARGIN) * s
	p.y += lift * float(o.get("lift", 1.0 if not o.get("water", false) else 0.45)) + float(o.get("air", 0.0))
	if not _cast.has(species):
		_cast[species] = []
	_cast[species].append([Transform3D(Basis().scaled(Vector3(s, s, s)), p), o])

func _flush() -> void:
	for species: String in _vpm._proxies.keys():
		var mm: MultiMesh = (_vpm._proxies[species] as MultiMeshInstance3D).multimesh
		var list: Array = _cast.get(species, [])
		mm.instance_count = list.size()
		for i: int in list.size():
			var o: Dictionary = list[i][1]
			mm.set_instance_transform(i, list[i][0])
			mm.set_instance_color(i, Color(1, 1, 1, float(o.get("act", 0)) / 15.0))
			var cell: float = float(o.get("cell", 0)) + fposmod(float(i) * 0.37, 0.95)
			mm.set_instance_custom_data(i, Color(o.get("face", 1.0), o.get("phase", 0.0), o.get("motion", 0.6 if int(o.get("act", 0)) == 3 else 0.2), cell))

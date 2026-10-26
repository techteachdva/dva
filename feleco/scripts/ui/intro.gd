extends Node

# The opening film, played in the real valley: one golden wheat, eaten and
# eaten again down the food chain, back into the soil and up as grass. One
# creature for each link, scripted (see MarkovAgent.stage_to), the camera
# hopping from prey to hunter to carcass to worm. Plays once on first launch;
# Skip, or the main menu's Intro button, at any time.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const WORLD: PackedScene = preload("res://scenes/world.tscn")

var _world: Node
var _dir: SimulationDirector
var _cam: Camera3D
var _caption: Label
var _title: Label
var _shade: ColorRect
var _done: bool = false
var _anchor: Vector3 = Vector3.ZERO
var _cast: Array[MarkovAgent] = []

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.reset_run_state()
	gc.current_mode = "intro"
	gc.scenario_id = ""
	# An empty valley: only the cast below will walk in it.
	gc.disabled_species.clear()
	for id: String in SpeciesDB.ROWS.keys():
		gc.disabled_species.append(id)
	gc.tree_count = 7
	gc.bush_count = 3
	gc.grass_density = 0.55
	gc.time_limit = 60.0
	gc.spawn_roster.clear()
	gc.bets.clear()
	_world = WORLD.instantiate()
	var loading: Node = _world.get_node_or_null("CanvasLayer/LoadingScreen")
	if loading != null:
		loading.get_parent().remove_child(loading)
		loading.free()
	add_child(_world)
	_dir = _world.get_node("World") as SimulationDirector
	_cam = _world.get_node("Camera3D") as Camera3D
	var hud: Node = _world.get_node_or_null("CanvasLayer/SimulationHUD")
	if hud != null:
		hud.set("visible", false)
		hud.process_mode = Node.PROCESS_MODE_DISABLED
	_build_overlay()
	_play.call_deferred()

func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 40
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	# Letterbox bars, for a film.
	for top: bool in [true, false]:
		var bar := ColorRect.new()
		bar.color = Color(0, 0, 0, 0.85)
		bar.anchor_right = 1.0
		bar.anchor_top = 0.0 if top else 1.0
		bar.anchor_bottom = 0.0 if top else 1.0
		bar.offset_top = 0.0 if top else -64.0
		bar.offset_bottom = 64.0 if top else 0.0
		bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		root.add_child(bar)
	_caption = FelecoUiScript.heading("", 30, FelecoUiScript.CREAM)
	_caption.anchor_left = 0.0
	_caption.anchor_right = 1.0
	_caption.anchor_top = 1.0
	_caption.anchor_bottom = 1.0
	_caption.offset_top = -150.0
	_caption.offset_bottom = -76.0
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_caption.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_caption.add_theme_constant_override("outline_size", 8)
	_caption.modulate.a = 0.0
	root.add_child(_caption)
	_title = FelecoUiScript.heading("FelEco", 96, FelecoUiScript.GOLD)
	_title.set_anchors_preset(Control.PRESET_CENTER)
	_title.offset_left = -400
	_title.offset_right = 400
	_title.offset_top = -80
	_title.offset_bottom = 80
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_title.add_theme_color_override("font_outline_color", Color(0.25, 0.15, 0.02, 0.9))
	_title.add_theme_constant_override("outline_size", 14)
	_title.modulate.a = 0.0
	root.add_child(_title)
	_shade = ColorRect.new()
	_shade.color = Color.BLACK
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(_shade)
	var skip := Button.new()
	skip.text = "Skip"
	skip.anchor_left = 1.0
	skip.anchor_right = 1.0
	skip.offset_left = -150
	skip.offset_right = -20
	skip.offset_top = 12
	skip.offset_bottom = 56
	skip.pressed.connect(_finish)
	root.add_child(skip)
	FelecoUiScript.dress_hud(layer)
	skip.theme_type_variation = "GhostButton"

# ------------------------------------------------------------------
# The film
# ------------------------------------------------------------------
func _play() -> void:
	for i: int in 30:
		await get_tree().process_frame
	_anchor = _dir.dry_land(Vector3(-6.0, 0.0, 8.0))
	_anchor.y = _dir.ground_height(_anchor.x, _anchor.z)
	_grow_gold(_anchor, 1, true)
	_view(_anchor + Vector3(0, 0, -6), 0.4, -0.55, 46.0, true)
	await _fade(0.0, 1.6)
	await _say("In the valley, every meal passes something on.", 3.0)
	if _done: return
	# 1. Golden wheat.
	_view(_anchor, 0.2, -0.45, 9.0)
	await _say("Sunlight and soil become a stem of golden wheat.", 3.2)
	if _done: return
	# 2. A rabbit eats it.
	var rabbit := _dir.spawn_scripted("rabbit", _anchor + Vector3(-10, 0, 1))
	_cast.append(rabbit)
	_follow(rabbit, 10.0)
	await _walk(rabbit, _anchor + Vector3(-0.8, 0, 0.2), 2.6, "Walk")
	await _hold(rabbit, 1.6, "Graze")
	if _done: return
	rabbit.make_golden(1.0, "grass")
	_dir.grass.consume_density(_anchor, 0.6)
	await _say("A rabbit eats it, and the gold passes into the rabbit.", 3.0)
	if _done: return
	# 3. A mountain lion takes the rabbit.
	await _walk(rabbit, _dir.dry_land(_anchor + Vector3(3, 0, 1)), 1.6, "Walk")
	var lion := _dir.spawn_scripted("lion", _dir.dry_land(_anchor + Vector3(-11, 0, 3)))
	_cast.append(lion)
	_follow(lion, 11.0)
	await _walk(lion, _dir.dry_land(_anchor + Vector3(-2, 0, 1)), 2.4, "Walk")
	await _walk(lion, rabbit.global_position, 0.8, "Chase")
	if _done: return
	FXManager.spawn_combat_particles(rabbit.global_position)
	lion.devour(rabbit)
	await _say("A mountain lion catches it. The gold climbs the food chain.", 3.2)
	if _done: return
	# 4. The hunter grows old.
	await _walk(lion, _dir.dry_land(_anchor + Vector3(4, 0, 4)), 2.2, "Walk")
	await _say("Seasons turn. Even the hunter grows old.", 2.4)
	await _hold(lion, 1.8, "Sleep")
	if _done: return
	var where: Vector3 = lion.global_position
	lion.die()
	var corpse: Node3D = _dir.get_node("Corpses").get_child(_dir.get_node("Corpses").get_child_count() - 1) as Node3D
	_view(where, 0.8, -0.6, 8.0)
	await _say("Its body falls, still golden, back to the earth.", 3.0)
	if _done: return
	# 5. The decomposers.
	var beetle := _dir.spawn_scripted("beetle", where + Vector3(-5, 0, 2))
	var worm := _dir.spawn_scripted("worm", where + Vector3(4, 0, 3))
	_cast.append_array([beetle, worm])
	_walk(worm, where + Vector3(0.9, 0, 0.4), 3.0, "Walk")
	await _walk(beetle, where + Vector3(-0.8, 0, 0.3), 3.0, "Walk")
	if _done: return
	if corpse != null and is_instance_valid(corpse):
		corpse.absorb_energy(0.1, beetle)
		corpse.absorb_energy(0.1, worm)
	_hold(worm, 2.4, "Eat")
	await _hold(beetle, 2.4, "Eat")
	await _say("Beetles and worms break it down, and the gold sinks into the soil.", 3.0)
	if _done: return
	# 6. A golden mushroom.
	if corpse != null and is_instance_valid(corpse):
		corpse.finish()
	var mushroom := _dir.spawn_scripted("mushroom", where)
	_cast.append(mushroom)
	mushroom.make_golden(1.0, "worm")
	mushroom.stage_to(where, "Fruit")
	_view(where, 0.4, -0.35, 6.0)
	await _say("A golden mushroom pushes up from the rot...", 2.8)
	if _done: return
	# 7. Back to grass: the loop closes.
	_grow_gold(where, 2, false)
	_view(where, 1.2, -0.5, 14.0)
	await _say("...and the gold grows back into the grass. The loop begins again.", 3.6)
	if _done: return
	_view(where, 1.8, -0.7, 40.0)
	var tw := create_tween()
	tw.tween_property(_caption, "modulate:a", 0.0, 0.6)
	tw.tween_property(_title, "modulate:a", 1.0, 1.0)
	await tw.finished
	await get_tree().create_timer(2.4).timeout
	_finish()

# Golden wheat around a spot: tall and ripe, a ring of it when `wide`.
func _grow_gold(at: Vector3, radius: int, wide: bool) -> void:
	var g: GrassLayer = _dir.grass
	var c := g.world_to_grid(at)
	for dz: int in range(-radius, radius + 1):
		for dx: int in range(-radius, radius + 1):
			if not wide and dx == 0 and dz == 0:
				continue
			var x: int = clampi(c.x + dx, 0, g.grid_width - 1)
			var z: int = clampi(c.y + dz, 0, g.grid_height - 1)
			var i: int = z * g.grid_width + x
			g._cell_kind[i] = GrassLayer.Kind.GOLDEN
			# Tall and ripe, but under the line where grass goes to seed and dies.
			g._grid[i] = g.max_density * 0.62
			g._cell_stage[i] = 2.0
			g._cell_age[i] = 0.0
			g._mark_dirty(i)
	g.flush_visuals()

func _walk(a: MarkovAgent, to: Vector3, secs: float, state: String) -> void:
	if a == null or not is_instance_valid(a):
		return
	var from: Vector3 = a.global_position
	to.y = _dir.ground_height(to.x, to.z)
	var t: float = 0.0
	while t < secs and not _done and is_instance_valid(a):
		t += get_process_delta_time()
		var p: Vector3 = from.lerp(to, smoothstep(0.0, 1.0, t / secs))
		p.y = _dir.ground_height(p.x, p.z)
		a.stage_to(p, state)
		await get_tree().process_frame

func _hold(a: MarkovAgent, secs: float, state: String) -> void:
	var t: float = 0.0
	while t < secs and not _done and is_instance_valid(a):
		t += get_process_delta_time()
		a.stage_to(a.global_position, state)
		await get_tree().process_frame

func _say(text: String, secs: float) -> void:
	if _done:
		return
	_caption.text = text
	var tw := create_tween()
	tw.tween_property(_caption, "modulate:a", 1.0, 0.4)
	tw.tween_interval(maxf(secs - 0.8, 0.2))
	tw.tween_property(_caption, "modulate:a", 0.0, 0.4)
	await tw.finished

func _fade(to: float, secs: float) -> void:
	var tw := create_tween()
	tw.tween_property(_shade, "color:a", to, secs)
	await tw.finished

func _view(at: Vector3, yaw: float, pitch: float, dist: float, instant: bool = false) -> void:
	if _cam.has_method("follow"):
		_cam.follow(null)
	if _cam.has_method("set_view"):
		_cam.set_view(Vector3(at.x, 0.0, at.z), yaw, pitch, dist, instant)

func _follow(a: Node3D, dist: float) -> void:
	if _cam.has_method("follow"):
		_cam.follow(a)
		_cam.set("_goal_distance", dist)
		_cam.set("_goal_pitch", -0.45)

func _finish() -> void:
	if _done:
		return
	_done = true
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.disabled_species.clear()
	gc.current_mode = "sandbox"
	gc.save_meta()
	var tw := create_tween()
	tw.tween_property(_shade, "color:a", 1.0, 0.6)
	await tw.finished
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

extends Node

# Dev-only: a meteor on a small crowd, without the film. Saves the fall, the
# impact, the open walnut, the crater, then tests Rainbow in action: a pack of
# Rainbow worms on a bear, and a Rainbow human and falcon among prey.
#   godot --path . res://scenes/dev/meteor_check.tscn -- <out dir>

var _fails: int = 0

func _ready() -> void:
	_run.call_deferred()

func _ok(what: String, cond: bool, detail: String = "") -> void:
	print(("OK " if cond else "FAIL ") + what + " " + detail)
	if not cond:
		_fails += 1

func _shot(out: String, name: String) -> void:
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, name])

func _crowd(dir: SimulationDirector, around: Vector3, id: String, n: int, free: bool = true) -> Array[MarkovAgent]:
	var list: Array[MarkovAgent] = []
	for i: int in n:
		var a := dir.spawn_scripted(id, dir.dry_land(around + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4))))
		if a != null:
			a.scripted = not free
			if free:
				a.set_state(a._current_state)
			list.append(a)
	return list

func _wait(tree: SceneTree, secs: float) -> void:
	var end: int = Time.get_ticks_msec() + int(secs * 1000.0)
	while Time.get_ticks_msec() < end:
		await tree.process_frame

func _run() -> void:
	var tree := get_tree()
	get_parent().remove_child(self)
	tree.root.add_child(self)
	tree.current_scene = null
	var out: String = OS.get_cmdline_user_args()[0]
	DirAccess.make_dir_recursive_absolute(out)
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.tutorial_done = true
	gc.current_mode = "sandbox"
	gc.disabled_species.clear()
	for id: String in SpeciesDB.ROWS.keys():
		gc.disabled_species.append(id)
	gc.tree_count = 2
	tree.change_scene_to_file("res://scenes/world.tscn")
	await tree.scene_changed
	var scene: Node = tree.current_scene
	for _i: int in 50:
		await tree.process_frame
	var ld := scene.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	var hud: Node = scene.find_child("SimulationHUD", true, false)
	if hud != null:
		hud.set("visible", false)
	tree.paused = false
	var dir := scene.get_node("World") as SimulationDirector
	dir.disabled_species.clear()
	var cam := scene.get_node("Camera3D") as Camera3D
	var spot: Vector3 = dir.dry_land(Vector3(0, 0, 4))
	var flock := _crowd(dir, spot, "sheep", 8)
	flock.append_array(_crowd(dir, spot, "rabbit", 4))
	flock.append_array(_crowd(dir, spot, "deer", 3))
	for _i: int in 5:
		await tree.process_frame
	var land: Vector3 = dir.trigger_meteor()
	cam.set_view(land, 0.5, -0.5, 24.0, true)
	var strike: MeteorStrike = null
	for c: Node in dir.get_children():
		if c is MeteorStrike:
			strike = c
	_ok("strike spawned", strike != null)
	for path: String in ["res://scripts/ui/intro.gd", "res://scripts/ui/greenhouse_shop.gd"]:
		_ok("compiles " + path, (load(path) as GDScript).can_instantiate())
	for at_t: float in [0.7, 1.1, 1.3, 2.6, 3.0, 3.5, 5.0]:
		while strike.get("_t") < at_t:
			await tree.process_frame
		_shot(out, "strike_%03d" % int(at_t * 100))
	_ok("fruit in the crater", dir.has_starfruit(), str(tree.get_nodes_in_group("starfruit").size()))
	var left: int = tree.get_nodes_in_group("starfruit").size()
	await _wait(tree, 6.0)
	var rainbows: int = 0
	var alive: Array[MarkovAgent] = []
	for a: MarkovAgent in flock:
		if is_instance_valid(a):
			alive.append(a)
			if a.is_rainbow():
				rainbows += 1
	_ok("some turned Rainbow", rainbows > 0, str(rainbows))
	_shot(out, "rainbow")
	if rainbows > 0:
		var r: MarkovAgent = null
		for a: MarkovAgent in alive:
			if a.is_rainbow():
				r = a
		_ok("health raised", r.rainbow_health >= 50.0, str(r.get("health")))
		var pose := dir.spawn_scripted("sheep", dir.dry_land(Vector3(-12, 0, 12)))
		var wolf := dir.spawn_scripted("wolf", pose.global_position + Vector3(2.4, 0, 0))
		var man := dir.spawn_scripted("human", pose.global_position + Vector3(-2.4, 0, 0))
		var plain := dir.spawn_scripted("sheep", pose.global_position + Vector3(0, 0, -2.6))
		for c: MarkovAgent in [pose, wolf, man]:
			c.eat_starfruit()
			c._data.rainbow = true
		cam.set_view(pose.global_position, 0.0, -0.22, 8.5, true)
		await _wait(tree, 0.5)
		_shot(out, "rainbow_close")
		print("rainbow data ", pose._data.rainbow, " ", plain._data.rainbow)
		cam.set_view(land, 0.5, -0.5, 16.0, true)
		await _wait(tree, 0.4)
		_shot(out, "crater")
	# Worms against a bear.
	var ring: Vector3 = dir.dry_land(Vector3(-14, 0, -10))
	var bear: MarkovAgent = _crowd(dir, ring, "bear", 1, false)[0]
	bear.global_position = ring
	var start: float = float(bear.get("health"))
	var worms := _crowd(dir, ring, "worm", 6)
	for w: MarkovAgent in worms:
		w.eat_starfruit()
	cam.set_view(ring, 0.5, -0.45, 14.0, true)
	await _wait(tree, 2.0)
	_shot(out, "worm_swarm")
	await _wait(tree, 6.0)
	_ok("worms brought down the bear", not is_instance_valid(bear) or float(bear.get("health")) < start * 0.5, str(start) + " -> " + (str(bear.get("health")) if is_instance_valid(bear) else "dead"))
	# A falcon and a human among prey.
	var field: Vector3 = dir.dry_land(Vector3(14, 0, -10))
	var prey := _crowd(dir, field, "sheep", 6, false)
	var human: MarkovAgent = _crowd(dir, field, "human", 1)[0]
	human.eat_starfruit()
	var fal: MarkovAgent = _crowd(dir, field, "falcon", 1)[0]
	fal.eat_starfruit()
	await _wait(tree, 5.0)
	var gone: int = 0
	for p: MarkovAgent in prey:
		if not is_instance_valid(p):
			gone += 1
	_ok("Rainbow hunters tore through the prey", gone >= 4, "%d of %d" % [gone, prey.size()])
	# The hunters from above would eat the pet: clear them away first.
	for d: AgentData in dir._agent_registry:
		if d.node is MarkovAgent:
			d.node.queue_free()
	await tree.process_frame
	# Aim the real button with real clicks, then drive a claimed creature to the fruit.
	dir.touches_left = 0
	gc.powerup_inventory["meteor"] = 1
	var hud2: Node = scene.find_child("SimulationHUD", true, false)
	hud2.visible = true
	cam.set_view(Vector3(-4, 0, -2), 0.2, -0.75, 40.0, true)
	await _wait(tree, 0.3)
	var aim: Vector3 = dir.dry_land(Vector3(-4, 0, -2))
	hud2.call("_trigger_meteor")
	_ok("aiming, nothing spent yet", hud2.get("_aiming") == true and int(gc.powerup_inventory["meteor"]) == 1)
	var pix: Vector2 = cam.unproject_position(aim)
	for pressed: bool in [true, false]:
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = pressed
		click.position = pix
		hud2._unhandled_input(click)
	await tree.process_frame
	var aimed: MeteorStrike = null
	for c: Node in dir.get_children():
		if c is MeteorStrike and float(c.get("_t")) < 1.0:
			aimed = c
	_ok("meteor fell where clicked", aimed != null and aimed.land.distance_to(aim) < 3.0, str(aim) + " vs " + (str(aimed.land) if aimed != null else "none"))
	_ok("spent on the click", int(gc.powerup_inventory["meteor"]) == 0)
	if aimed != null:
		var pet := _crowd(dir, aimed.land + Vector3(9, 0, 0), "goat", 1)[0]
		var hold_strike := aimed
		pet.tree_exiting.connect(func() -> void:
			print("PET leaves at t=", hold_strike.get("_t"), " pos ", pet.global_position, " land ", hold_strike.land, " health ", pet.get("health"), " energy ", pet.get("energy"), " state ", pet.current_state()))
		var goals: Node = scene.find_child("Goals", true, false)
		if goals != null:
			goals.adopt(pet)
		hud2.call("_start_follow", pet)
		await tree.process_frame
		await tree.process_frame
		var panel: FollowPanel = hud2.get("_follow_panel")
		await _wait(tree, 0.7)
		_ok("Take Control offered", panel._control_btn.visible)
		_shot(out, "offered")
		panel.set_process(false)
		panel._toggle_control()
		_ok("control taken", pet.player_drive and cam.get("locked") == true)
		_ok("view cleared", not panel.visible and panel._drive_bar != null)
		while aimed.get("_t") < 3.8:
			await tree.process_frame
		var end: int = Time.get_ticks_msec() + 6000
		while Time.get_ticks_msec() < end and is_instance_valid(pet) and not pet.is_rainbow():
			var fruit := dir.find_nearest_starfruit(pet.global_position, 40.0)
			if fruit != null:
				var way: Vector3 = fruit.global_position - pet.global_position
				way.y = 0.0
				pet.rampage_steer = way.normalized()
			await tree.process_frame
		if is_instance_valid(pet):
			var nf := dir.find_nearest_starfruit(pet.global_position, 60.0)
			print("PET pos ", pet.global_position, " state ", pet.current_state(), " vel ", pet.velocity, " steer ", pet.rampage_steer, " fruit ", nf.global_position if nf != null else null, " drive ", pet.player_drive, " scripted ", pet.scripted, " pm ", pet.process_mode, " health ", pet.get("health"))
		else:
			print("PET dead")
		_ok("driven to the fruit, Rainbow bright", is_instance_valid(pet) and pet.is_rainbow())
		_shot(out, "driven")
		await _wait(tree, 0.6)
		_shot(out, "driven")
		panel._release_control()
		_ok("control released", cam.get("locked") == false and panel.visible)
	print("METEOR FAILS ", _fails)
	tree.quit()

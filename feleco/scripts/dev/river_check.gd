extends Node

# Dev-only: photographs the river at its sharpest bend, close and far.
#   godot --path . res://scenes/dev/river_check.tscn -- <out dir>

func _ready() -> void:
	_run.call_deferred()

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
	var river: River = dir.valley.river
	var cam := scene.get_node("Camera3D") as Camera3D
	var best_s: float = 0.0
	var best_k: float = -1.0
	var s: float = river.copse_s.x + 6.0
	while s < river.copse_s.y - 6.0:
		var k: float = river.tangent_at(s - 2.0).angle_to(river.tangent_at(s + 2.0))
		if k > best_k:
			best_k = k
			best_s = s
		s += 1.0
	var at: Vector3 = river.point_at(best_s)
	if OS.get_cmdline_user_args().size() > 1:
		# Just the meteor: a falling, an impact and an after shot.
		for id: String in ["sheep", "rabbit", "deer"]:
			for i: int in 6:
				dir.spawn_scripted(id, dir.dry_land(Vector3(randf_range(-10, 10), 0, randf_range(-10, 10))))
		for _i: int in 5:
			await tree.process_frame
		var before: int = dir._agent_registry.size()
		var land: Vector3 = dir.trigger_meteor()
		cam.set_view(land, 0.5, -0.62, 30.0, true)
		var strike: MeteorStrike = null
		for c: Node in dir.get_children():
			if c is MeteorStrike:
				strike = c
		for at_t: float in [0.55, 0.95, 1.3, 2.2]:
			while strike.get("_t") < at_t:
				await tree.process_frame
			get_viewport().get_texture().get_image().save_png("%s/meteor_%d.png" % [out, int(at_t * 100)])
		print("METEOR land=", land, " creatures ", before, " -> ", dir._agent_registry.size())
		tree.quit()
		return
	print("BEND s=", best_s, " turn=", best_k)
	var views: Array = [["close", 0.3, -0.42, 13.0], ["low", 1.9, -0.26, 16.0], ["mid", 3.6, -0.6, 30.0], ["wide", 0.2, -0.9, 62.0]]
	for v: Array in views:
		cam.set_view(at, float(v[1]), float(v[2]), float(v[3]), true)
		for _i: int in 12:
			await tree.process_frame
		get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, v[0]])
	cam.set_view(at, 0.3, -0.5, 26.0, true)
	dir._set_flood_scale(2.0)
	river.set_flood_tint(0.8)
	for _i: int in 12:
		await tree.process_frame
	get_viewport().get_texture().get_image().save_png(out + "/flood.png")
	dir._set_flood_scale(1.0)
	river.set_flood_tint(0.0)
	river.set_ice(1.0)
	for _i: int in 12:
		await tree.process_frame
	get_viewport().get_texture().get_image().save_png(out + "/ice.png")
	print("DONE")
	tree.quit()

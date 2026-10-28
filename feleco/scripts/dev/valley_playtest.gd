extends SceneTree

# Dev playtest: starts Enter the Valley the way the menu does, runs it at
# speed and snapshots the screen and the state now and then.
#   godot --path . -s res://scripts/dev/valley_playtest.gd -- <out dir> [speed]

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	var out: String = args[0]
	var speed: float = float(args[1]) if args.size() > 1 else 4.0
	var gc: Node = root.get_node("GameConfig")
	gc.reset_run_state()
	gc.current_mode = "sandbox"
	gc.tutorial_done = true
	print("PLAY time_limit ", gc.time_limit, " days? ", gc.get("days") if gc.get("days") != null else "-")
	change_scene_to_file("res://scenes/world.tscn")
	await create_timer(4.0).timeout
	var shots: int = 0
	var t: float = 0.0
	while shots < 6:
		await create_timer(10.0).timeout
		t += 10.0
		Engine.time_scale = speed
		var dir: Node = current_scene.get_node_or_null("World") if current_scene != null else null
		if dir == null:
			print("PLAY scene now ", current_scene.name if current_scene != null else "none")
			root.get_texture().get_image().save_png(out + "/vp_end.png")
			break
		var counts: Dictionary = dir.get_creature_counts()
		print("PLAY t=%d day=%.1f counts=%s" % [t, dir.get_day(), str(counts)])
		root.get_texture().get_image().save_png(out + "/vp_%d.png" % shots)
		shots += 1
	Engine.time_scale = 1.0
	quit()

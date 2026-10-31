extends Node

# Dev-only: picks up a creature with the hand, in close-up, at each stage.
#   godot --path . res://scenes/dev/hand_check.tscn -- <out dir> [species,species]

func _ready() -> void:
	_run.call_deferred()

func _run() -> void:
	var tree := get_tree()
	get_parent().remove_child(self)
	tree.root.add_child(self)
	tree.current_scene = null
	var args := OS.get_cmdline_user_args()
	var out: String = args[0]
	var kinds: PackedStringArray = args[1].split(",") if args.size() > 1 else PackedStringArray(["sheep"])
	DirAccess.make_dir_recursive_absolute(out)
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.tutorial_done = true
	gc.current_mode = "main"
	tree.change_scene_to_file("res://scenes/world.tscn")
	await tree.scene_changed
	var scene: Node = tree.current_scene
	for _i: int in 50:
		await tree.process_frame
	var ld := scene.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	tree.paused = false
	for _i: int in 30:
		await tree.process_frame
	var hud: Node = scene.find_child("SimulationHUD", true, false)
	var dir := scene.get_node("World") as SimulationDirector
	var cam := scene.get_node("Camera3D") as Camera3D
	for kind: String in kinds:
		var who: MarkovAgent = null
		for d: AgentData in dir._agent_registry:
			if d.species == kind and d.node is MarkovAgent:
				who = d.node
				break
		if who == null:
			print("NONE ", kind)
			continue
		dir.process_mode = Node.PROCESS_MODE_DISABLED
		cam.follow(who)
		cam.set_view(who.global_position, 0.2, deg_to_rad(-24.0), 11.0, true)
		for c: Node in hud.get_children():
			if c is CanvasItem:
				(c as CanvasItem).visible = false
		await tree.process_frame
		hud.call("_lift_in_hand", who)
		var frames: Array[int] = [8, 24, 44, 72, 110]
		var at: int = 0
		for f: int in frames:
			while at < f:
				await tree.process_frame
				at += 1
			var panel: Node = hud.get_node_or_null("HandChoices")
			if panel != null:
				(panel as CanvasItem).visible = false
			await tree.process_frame
			get_viewport().get_texture().get_image().save_png("%s/%s_%d.png" % [out, kind, f])
		print("SHOT ", kind)
		var hand := scene.get_node_or_null("SpectralHand") as SpectralHand
		if hand != null:
			hand.put_down(func() -> void: pass)
		for _i: int in 80:
			await tree.process_frame
		var ch: Node = hud.get_node_or_null("HandChoices")
		if ch != null:
			ch.queue_free()
		hud.set("_hand_busy", false)
		await tree.process_frame
		print("DOWN ", kind, " hand gone=", scene.get_node_or_null("SpectralHand") == null)
	tree.quit()

extends Node

# Dev: grow a pineapple tree beside an apple and a conifer, drop fruit, snapshot.
#   godot --rendering-driver opengl3 --path . res://scenes/dev/pine_shot.tscn -- <out dir>

func _ready() -> void:
	_go.call_deferred()

func _go() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var w: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(w)
	get_tree().current_scene = w
	for i in 90:
		await get_tree().process_frame
	get_tree().paused = false
	for c in get_tree().root.find_children("Welcome", "", true, false):
		c.queue_free()
	var d: SimulationDirector = w.get_node("World")
	var at: Vector3 = d.dry_land(Vector3(20, 0, 10))
	var kinds := [["pineapple", Vector3(0, 0, 0)], ["conifer", Vector3(5, 0, 1)], ["apple", Vector3(-5, 0, 1)]]
	var trees: Array = []
	for k in kinds:
		var t = load("res://scenes/tree.tscn").instantiate()
		t.pineapple = k[0] == "pineapple"
		t.conifer = k[0] == "conifer"
		d.get_node("Trees").add_child(t)
		t.global_position = d.tree_spot(at + k[1])
		d._snap_to_ground(t)
		t.set_stage(2)
		trees.append(t)
	for t in trees:
		for i in 3:
			t._spawn_apple(Vector3(randf_range(-1, 1), 3.0, randf_range(-1, 1)))
	var cam = get_viewport().get_camera_3d()
	cam.set_view(at, 0.3, -0.35, 14.0, true)
	for i in 120:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(out + "/pine.png")
	cam.set_view(Vector3(0, 0, 0), 0.8, -0.9, 165.0, true)
	for i in 60:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(out + "/overview.png")
	var rv: River = d.valley.river
	var mid: Vector3 = rv.point_at(rv.length() * 0.5)
	cam.set_view(mid, 0.4, -0.45, 18.0, true)
	for i in 60:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(out + "/water.png")
	var src: Vector3 = rv.point_at(rv.length() * 0.2)
	cam.set_view(src, 0.4, -0.5, 40.0, true)
	for i in 60:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(out + "/gorge.png")
	for a in d._agent_registry:
		if a.species == "bear" and a.node != null:
			cam.set_view(a.node.global_position, 0.3, -0.35, 9.0, true)
			break
	for i in 60:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png(out + "/bear.png")
	# Bird rampage: a golden falcon steered at a flock of sheep must kill.
	for bird_id in ["falcon", "robin"]:
		var bird: MarkovAgent = null
		for a2 in d._agent_registry:
			if a2.species == bird_id and a2.node is MarkovAgent:
				bird = a2.node
				break
		if bird == null:
			continue
		var spot: Vector3 = d.dry_land(Vector3(-15, 0, -15))
		for k in 6:
			var sh := d.spawn_scripted("sheep", spot + Vector3(k * 1.5, 0, 0))
		bird.global_position = spot + Vector3(-3, 6, 0)
		bird.golden = 1.0
		bird.start_rampage()
		bird.rampage_steer = Vector3(1, 0, 0)
		for i in 120:
			await get_tree().process_frame
		print("SHOT rampage %s kills=%d y=%.1f" % [bird_id, bird.rampage_kills, bird.global_position.y])
		bird.end_rampage()
	var pine = d.get_tree().get_nodes_in_group("pineapple")
	print("SHOT pineapples on ground: ", pine.size())
	for p in pine:
		print("SHOT pineapple at ", p.global_position)
	get_tree().quit()

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
	var cones: Array = []
	for k in 3:
		var pc: Node3D = load("res://scripts/agents/apple.gd").new()
		pc.kind = ["pinecone", "apple", "pineapple"][k]
		pc.set("_landed", true)
		pc.set("_rolled", true)
		pc.set("_decay", 999.0)
		d.add_child(pc)
		var spot2: Vector3 = at + Vector3(-1.0 + k * 1.0, 0, 7)
		pc.global_position = Vector3(spot2.x, d.ground_height(spot2.x, spot2.z) + 0.26, spot2.z)
		cones.append(pc)
	if not cones.is_empty():
		cam.set_view((cones[1] as Node3D).global_position, 0.6, -0.3, 2.2, true)
		for i in 40:
			await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(out + "/cone.png")
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
	# Gold 4.7.1: unclaimed gold can't die; it times out into quiet gold,
	# which the eater picks up.
	var sheep: MarkovAgent = d.spawn_scripted("sheep", d.dry_land(Vector3(5, 0, 5)))
	sheep.scripted = false
	sheep.make_golden(1.0, "test")
	sheep.die()
	print("SHOT gold shield alive=", not sheep.is_queued_for_deletion(), " golden=", sheep.golden)
	sheep.gold_left = 0.01
	for i in 5:
		await get_tree().physics_frame
	print("SHOT gold expired golden=", sheep.golden, " latent=", sheep.gold_latent)
	var wolf: MarkovAgent = d.spawn_scripted("wolf", sheep.global_position)
	wolf.devour(sheep)
	print("SHOT wolf took quiet gold golden=", wolf.golden, " sheep dead=", sheep.is_queued_for_deletion())
	d.get_node("/root").get_node_or_null("x")
	wolf.claim_gold()
	print("SHOT claimed=", wolf.gold_claimed, " rampage=", wolf.start_rampage())
	wolf.end_rampage()
	# Menagerie: one of each, and a line passes to kin.
	var goals = get_tree().get_first_node_in_group("goals_panel")
	var picks: Dictionary = {}
	for a3 in d._agent_registry:
		if a3.species in ["sheep", "wolf", "deer"] and not picks.has(a3.species) and a3.node is MarkovAgent and a3.node.golden <= 0.05:
			picks[a3.species] = a3.node
	for sp in picks:
		goals.adopt(picks[sp])
	print("SHOT roster=", goals._roster.keys(), " focus=", goals.companion.species_id)
	var lost: MarkovAgent = goals._roster["wolf"]["agent"] if goals._roster.has("wolf") else null
	if lost != null:
		lost.die()
		for i in 120:
			await get_tree().process_frame
		var now = goals._roster.get("wolf", {}).get("agent")
		print("SHOT wolf line: heir=", now != null and now != lost and is_instance_valid(now), " roster=", goals._roster.keys())
	# Powers tray with icons, and Release 10.
	var hud = goals.hud if goals.hud != null else get_tree().root.find_child("SimulationHUD", true, false)
	var gc2 = get_node("/root/GameConfig")
	gc2.eco_points = 500
	if hud != null:
		hud._tray.visible = true
		for bn in hud.POWERUP_BUTTONS.keys():
			var bb: Button = hud._power_btn(bn)
			print("SHOT btn ", bn, " icon=", bb.icon, " size=", bb.size, " min=", bb.get_combined_minimum_size(), " clip=", bb.clip_text, " expand=", bb.expand_icon)
		hud._refresh_pack()
		hud._update_powerup_buttons()
		cam.set_view(Vector3.ZERO, 0.8, -0.8, 60.0, true)
		for i in 30:
			await get_tree().process_frame
		get_viewport().get_texture().get_image().save_png(out + "/tray.png")
		var before: int = d._agent_registry.size()
		if hud._director == null:
			hud._director = d
		hud._placing = "deer"
		hud._release_pack(Vector3(10, 0, 10))
		print("SHOT release added=", d._agent_registry.size() - before, " ep=", gc2.eco_points)
		hud._tray.visible = false
	var pine = d.get_tree().get_nodes_in_group("pineapple")
	print("SHOT pineapples on ground: ", pine.size())
	for p in pine:
		print("SHOT pineapple at ", p.global_position)
	get_tree().quit()

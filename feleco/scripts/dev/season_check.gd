extends Node

# Dev: run in the world scene's place to prove control and every Sprite event.
#   godot --path . res://scenes/dev/season_check.tscn

func _ready() -> void:
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child.call_deferred(world)
	await world.tree_entered
	get_tree().current_scene = world
	await get_tree().create_timer(4.0).timeout
	var sim: SimulationDirector = null
	for n: Node in world.find_children("*", "Node", true, false):
		if n is SimulationDirector:
			sim = n
	if world is SimulationDirector:
		sim = world
	if OS.get_cmdline_user_args().has("--fairy"):
		for c: Node in world.find_children("*", "CanvasLayer", true, false):
			(c as CanvasLayer).visible = false
		var f: Node3D = sim._spawn_extra("fairy", Vector3(0, 0, 8))
		sim._spawn_extra("sunfolk", Vector3(2, 0, 8))
		sim._spawn_extra("scarecrow", Vector3(-2, 0, 8))
		sim._spawn_extra("snowman", Vector3(0, 0, 10))
		var c2: Camera3D = world.get_node("Camera3D")
		c2.set_view(f.global_position, c2.yaw, c2.pitch, 12.0, true)
		await get_tree().create_timer(1.5).timeout
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[1])
		get_tree().quit()
		return
	var hand_for: MarkovAgent = get_tree().get_first_node_in_group("sheep")
	var hand := SpectralHand.new()
	world.add_child(hand)
	var cam: Camera3D = world.get_node_or_null("Camera3D")
	if cam != null:
		cam.follow(hand_for)
		cam.set_view(hand_for.global_position, cam.yaw, cam.pitch, 9.0)
	hand.lift(hand_for, func() -> void: pass)
	await get_tree().create_timer(3.2).timeout
	for c: Node in world.find_children("*", "CanvasLayer", true, false):
		(c as CanvasLayer).visible = false
	await get_tree().process_frame
	await get_tree().process_frame
	if OS.get_cmdline_user_args().has("--pinch"):
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[1])
		get_tree().quit()
		return
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0] if not OS.get_cmdline_user_args().is_empty() else "user://hand.png")
	hand.put_down(func() -> void: print("DROP OK"))
	await get_tree().create_timer(2.2).timeout
	print("YEAR ", sim.year_days(), " season days ", sim.year_days() / 4.0)
	for tag: String in ["sheep", "wolf", "falcon", "worm", "deer"]:
		var a: MarkovAgent = sim.find_nearest_in_group(Vector3.ZERO, tag, 500.0) if sim.has_method("find_nearest_in_group") else get_tree().get_first_node_in_group(tag)
		if a == null:
			continue
		a.set_driven(true)
		a.rampage_steer = Vector3.RIGHT
		var state := a.current_state()
		var was: Vector3 = a.global_position
		await get_tree().create_timer(1.0).timeout
		if is_instance_valid(a):
			print("DRIVE ", tag, " moved ", was.distance_to(a.global_position), " dx ", a.global_position.x - was.x, " state kept ", state == a.current_state())
			a.set_driven(false)
	for season: String in ["Spring", "Summer", "Autumn", "Winter"]:
		sim._current_season = season
		sim._seasonal_sprites_wake()
		var id: String = SeasonBook.EVENTS[season][0]
		print("WAKE ", season, " ", sim.get_species_count(id))
		await get_tree().create_timer(9.0).timeout
		print("AFTER ", id, " ", sim.get_species_count(id))
	for id: String in SeasonBook.SPRITES:
		var s: Node = get_tree().get_first_node_in_group(id)
		if s != null:
			s.signature_power()
	await get_tree().create_timer(1.0).timeout
	print("SEASON CHECK DONE")
	get_tree().quit()

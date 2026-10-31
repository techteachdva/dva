extends Node

# Dev: fire, Demi-Gods, house rules.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	var gc: Node = get_node("/root/GameConfig")
	gc.disabled_species.clear()
	gc.current_mode = "sandbox"
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(4.0, true, false, true).timeout
	var ld: Node = world.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	get_tree().paused = false
	var sim: SimulationDirector = world.get_node("World")
	sim.build_shelter(sim.dry_land(Vector3(-10, 0, 14)), 1)
	sim.build_shelter(sim.dry_land(Vector3(10, 0, 24)), 1)
	await get_tree().create_timer(0.6, true, false, true).timeout
	var h: MarkovAgent = get_tree().get_first_node_in_group("human")
	h.ascend()
	h.set("health", 50.0)
	h._age_and_die(10.0)
	print("DEMI hp after mending ", h.get("health"), " top ", h._hp_top)
	var at: Vector3 = sim.dry_land(Vector3(-20, 0, 20))
	sim.strike_lightning(at)
	print("FIRE start ", sim.fire.burning_count())
	await get_tree().create_timer(4.0, true, false, true).timeout
	print("FIRE after 4s ", sim.fire.burning_count())
	var cam: Camera3D = world.get_node("Camera3D")
	cam.set_view(at, cam.yaw, -0.6, 30.0, true)
	for c: Node in world.find_children("*", "CanvasLayer", true, false):
		(c as CanvasLayer).visible = false
	await get_tree().create_timer(1.0, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(out)
	sim.trigger_rain()
	await get_tree().create_timer(3.0, true, false, true).timeout
	print("FIRE after rain ", sim.fire.burning_count())
	sim.meteor_blast(h.global_position, 8.0)
	await get_tree().process_frame
	print("METEOR demigod gone ", not is_instance_valid(h) or h.is_queued_for_deletion())
	print("BOLT DONE")
	get_tree().quit()

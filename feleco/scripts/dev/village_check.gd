extends Node

# Dev: a look at huts, firepits, coolers and paths.
func _ready() -> void:
	await get_tree().process_frame
	var gc: Node = get_node("/root/GameConfig")
	gc.disabled_species.clear()
	gc.current_mode = "sandbox"
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(4.0, true, false, true).timeout
	var sim: SimulationDirector = world.get_node("World")
	for p: Vector3 in [Vector3(-10, 0, 14), Vector3(8, 0, 22), Vector3(-26, 0, 26), Vector3(16, 0, 40)]:
		sim.build_shelter(sim.dry_land(p), 1)
	await get_tree().create_timer(1.0, true, false, true).timeout
	for c: Node in world.find_children("*", "CanvasLayer", true, false):
		(c as CanvasLayer).visible = false
	var hut: Node3D = sim._active_shelters[0]
	hut.set_meta("pantry", {"apple": 6})
	sim._swell_cooler(hut)
	print("PATHS routes ", sim.paths._routes.size(), " cells ", sim.paths._grid.size(), " next ", sim.paths.next_toward(hut.global_position + Vector3(4, 0, 0), Vector3(16, 0, 40)))
	var cam: Camera3D = world.get_node("Camera3D")
	cam.set_view(Vector3(-4, 0, 22), cam.yaw, -0.75, 44.0, true)
	await get_tree().create_timer(1.5, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	print("VILLAGE DONE")
	get_tree().quit()

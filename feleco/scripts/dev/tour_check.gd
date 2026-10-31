extends Node

# Dev: the Food Web tour on a first run, timed, with a frame each few seconds.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	var gc: Node = get_node("/root/GameConfig")
	gc.tutorial_done = false
	gc.disabled_species.clear()
	gc.current_mode = "main"
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(5.0, true, false, true).timeout
	var ld: Node = world.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	get_tree().paused = false
	var hud: Node = world.find_child("SimulationHUD", true, false)
	hud._show_welcome()
	var t0: int = Time.get_ticks_msec()
	var n: int = 0
	await get_tree().create_timer(1.0, true, false, true).timeout
	while hud.get_node_or_null("FoodWebLayer") != null and hud.get_node("FoodWebLayer").find_children("*", "GuideTour", true, false).size() + int(hud.get_node("FoodWebLayer").get_child_count() > 3) > 0 and n < 12:
		await get_tree().create_timer(4.0, true, false, true).timeout
		get_viewport().get_texture().get_image().save_png("%s/t%02d.png" % [out, n])
		n += 1
		if gc.tutorial_done:
			break
	print("TOUR seconds ", (Time.get_ticks_msec() - t0) / 1000.0, " done ", gc.tutorial_done)
	get_tree().quit()

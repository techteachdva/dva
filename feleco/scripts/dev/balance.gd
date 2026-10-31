extends Node

# Dev: one Standard year at 3x, census every season.
func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	await get_tree().process_frame
	get_tree().current_scene = null
	gc.reset_run_state()
	gc.disabled_species.clear()
	gc.time_limit = 12.0
	gc.current_mode = "main"
	gc.intro_seen = true
	get_tree().change_scene_to_file("res://scenes/world.tscn")
	await get_tree().create_timer(6.0).timeout
	var sim: SimulationDirector = get_tree().current_scene.get_node("World")
	var ld: Node = get_tree().current_scene.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	Engine.time_scale = 3.0
	var next: float = 1.5
	while next < 12.0:
		get_tree().paused = false
		await get_tree().create_timer(1.0, true, false, true).timeout
		if sim.get_day() >= next:
			print("DAY ", next, " ", sim.get_creature_counts())
			next += 1.5
	get_tree().quit()

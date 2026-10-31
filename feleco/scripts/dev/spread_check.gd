extends Node

# Dev: how far creatures roam, cook pose, the house card and the cooking game.
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
	await get_tree().create_timer(1.0, true, false, true).timeout
	for t: int in 3:
		var total: float = 0.0
		var far: int = 0
		var n: int = 0
		for d: AgentData in sim._agent_registry:
			if d.node is MarkovAgent and d.species != "fish" and d.species != "mushroom":
				var r: float = Vector2(d.pos.x, d.pos.z).length()
				total += r
				far += 1 if r > 25.0 else 0
				n += 1
		print("SPREAD mean radius ", snappedf(total / maxi(n, 1), 0.1), " beyond25 ", far, " of ", n)
		await get_tree().create_timer(1.0, true, false, true).timeout
	var hud: Node = world.find_child("SimulationHUD", true, false)
	hud._director = sim
	gc.tutorial_done = true
	if hud.has_node("FoodWebLayer"):
		hud.get_node("FoodWebLayer").free()
	hud._open_house(sim._active_shelters[0])
	await get_tree().create_timer(0.5, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(out + "/house.png")
	var game := HearthCook.new()
	game._left = 1.5
	hud.get_node("HouseCard").add_child(game)
	await get_tree().create_timer(0.6, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(out + "/cook.png")
	print("SPREAD DONE")
	get_tree().quit()

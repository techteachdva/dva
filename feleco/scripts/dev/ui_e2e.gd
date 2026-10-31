extends Node

# Dev: the clicks a player makes. Menus, Food Web, Markov, claiming, Starfruit Bush.
#   godot --path . res://scenes/dev/ui_e2e.tscn -- <out dir>

var _out: String

func _shot(n: String) -> void:
	await get_tree().create_timer(0.8, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(_out + "/" + n + ".png")

func _press(root: Node, text: String) -> bool:
	for b: Node in root.find_children("*", "Button", true, false):
		if (b as Button).text.begins_with(text) and (b as Button).is_visible_in_tree():
			(b as Button).pressed.emit()
			return true
	return false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_out = OS.get_cmdline_user_args()[0]
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.lore_seen = true
	await get_tree().process_frame
	get_tree().current_scene = null
	var tree := get_tree()
	tree.change_scene_to_file("res://scenes/ui/main_menu.tscn")
	await tree.create_timer(2.0).timeout
	print("MENU valley ", _press(tree.current_scene, "The Valley"))
	await _shot("menu_lengths")
	print("MENU fast ", _press(tree.current_scene, "Fast"))
	await tree.create_timer(7.0).timeout
	print("IN WORLD ", tree.current_scene.name, " limit ", gc.time_limit, " mode ", gc.current_mode)
	if tree.current_scene.name == "LoreFilm":
		_press(tree.current_scene, "Skip")
		await tree.create_timer(0.6).timeout
		print("FILM card ", _press(tree.current_scene, "Begin the year"))
		await tree.create_timer(7.0).timeout
	tree.paused = false
	var ld: Node = tree.current_scene.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	var hud: Node = tree.current_scene.find_child("SimulationHUD", true, false)
	_press(hud, "Let's go")
	var sim: SimulationDirector = tree.current_scene.get_node("World")
	await tree.create_timer(1.0).timeout
	hud._open_food_web()
	print("WEB paused ", tree.paused)
	await tree.create_timer(1.0, true, false, true).timeout
	var guide: Node = hud.get_node("FoodWebLayer").find_child("FieldGuide", true, false)
	if guide == null:
		guide = hud.get_node("FoodWebLayer").get_child(1)
	await _shot("web")
	guide.focus_species("wolf")
	await _shot("card")
	guide.focus_species("wolf")
	await _shot("markov")
	print("BACK ", _press(hud, "Back to the Valley"))
	await tree.create_timer(0.5, true, false, true).timeout
	print("WEB closed paused ", tree.paused)
	tree.paused = false
	var goals: Node = tree.get_first_node_in_group("goals_panel")
	for id: String in SeasonBook.SPRITES:
		var s: Node = sim._spawn_extra(id, Vector3(float(randi() % 8), 0, 8))
		tree.paused = false
		await tree.create_timer(0.3).timeout
		print("DBG ", goals, " ", s, " ", s.species_id if s != null else "", " ", s is SeasonalSprite)
		goals.adopt(s)
		print("CLAIM ", id, " ach ", gc.record("achievement", id), " cursor ", Cosmetics.owns(gc, SeasonBook.SPRITES[id][1]), " tex ", Cosmetics.cursor_texture(SeasonBook.SPRITES[id][1]) != null)
		s.set_driven(true)
		s.signature_power()
		s.set_driven(false)
	var bush: Node = sim.plant_bush(Vector3(3, 0, 8), true)
	var sb := StarBush.new()
	bush.add_child(sb)
	sb._wait = 0.0
	sb._process(1.0)
	tree.paused = false
	print("BUSH ", bush, " fruit now ", tree.get_nodes_in_group("starfruit").size(), " wait ", sb._wait)
	await tree.create_timer(1.5).timeout
	print("STARFRUIT ", tree.get_nodes_in_group("starfruit").size())
	await _shot("sprites_claimed")
	tree.change_scene_to_file("res://scenes/ui/main_menu.tscn")
	await tree.create_timer(2.0).timeout
	print("MENU sim ", _press(tree.current_scene, "Simulation"))
	await _shot("menu_sim")
	print("SIM build ", _press(tree.current_scene, "Build a Valley"))
	await tree.create_timer(2.5).timeout
	print("SIM scene ", tree.current_scene.name)
	print("UI DONE")
	tree.quit()

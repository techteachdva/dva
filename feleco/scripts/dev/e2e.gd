extends Node

# Dev: end to end. Films, menu routes, then whole years in each look.
#   godot --path . res://scenes/dev/e2e.tscn

const YEARS: Array = [["valley", 12.0], ["pixel", 8.0], ["lost", 4.0]]

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	ProjectSettings.set_setting("physics/common/max_physics_steps_per_frame", 8)
	# Stay alive across scene changes: no longer the current scene.
	await get_tree().process_frame
	get_tree().current_scene = null
	await _film("res://scenes/ui/intro.tscn", "intro", "intro")
	await _film("res://scenes/ui/lore_film.tscn", "main", "valley film")
	await _film("res://scenes/ui/lore_film.tscn", "sandbox", "sim film")
	for scene: String in ["main_menu", "setup_board", "greenhouse_shop", "challenge_setup", "campaign_setup", "field_guide", "quest_board", "betting_table"]:
		get_tree().change_scene_to_file("res://scenes/ui/%s.tscn" % scene)
		await get_tree().create_timer(1.5).timeout
		print("SCREEN ", scene, " ", get_tree().current_scene != null)
	for y: Array in YEARS:
		gc.reset_run_state()
		gc.disabled_species.clear()
		gc.sprite_era = y[0]
		gc.time_limit = y[1]
		gc.current_mode = "main"
		gc.main_claim = false
		gc.lore_seen = true
		get_tree().change_scene_to_file("res://scenes/world.tscn")
		await get_tree().create_timer(6.0).timeout
		get_tree().paused = false
		var ld: Node = get_tree().current_scene.find_child("LoadingScreen", true, false) if get_tree().current_scene != null else null
		if ld != null:
			ld.queue_free()
		Engine.time_scale = 8.0
		var sim: SimulationDirector = get_tree().current_scene.get_node("World")
		var seen: Dictionary = {}
		sim.season_event.connect(func(t: String, _id: String) -> void: seen[t] = true)
		var t0: int = Time.get_ticks_msec()
		while is_instance_valid(sim) and sim.get_day() < y[1] - 0.2 and Time.get_ticks_msec() - t0 < (220000 if y[1] > 10.0 else 110000):
			get_tree().paused = false
			await get_tree().create_timer(1.0, true, false, true).timeout
		Engine.time_scale = 1.0
		print("YEAR ", y, " reached day ", sim.get_day() if is_instance_valid(sim) else -1, " events ", seen.size(), " fps ", Engine.get_frames_per_second(), " census ", sim.get_creature_counts() if is_instance_valid(sim) else {})
	print("E2E DONE")
	get_tree().quit()

func _film(path: String, mode: String, label: String) -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.current_mode = mode
	var t0: int = Time.get_ticks_msec()
	var tree := get_tree()
	var film: Node = load(path).instantiate()
	var old := tree.current_scene
	tree.root.add_child(film)
	tree.current_scene = film
	if old != null:
		old.queue_free()
	var cap: float = 110.0
	while Time.get_ticks_msec() - t0 < cap * 1000.0:
		await tree.create_timer(0.5).timeout
		if not is_instance_valid(film) or tree.current_scene != film or film.get("_choosing") == true:
			break
	print("FILM ", label, " ended by ", "scene" if not is_instance_valid(film) or tree.current_scene != film else "card", " seconds ", (Time.get_ticks_msec() - t0) / 1000.0)

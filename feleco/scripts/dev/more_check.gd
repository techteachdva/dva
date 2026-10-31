extends Node

# Dev: Vault window, sound playback through a real year's events, touch pad.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
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
	get_tree().paused = false
	var sfx: Node = get_node("/root/Sfx")
	for id: String in ["rain", "storm", "wind", "crickets", "frogs", "flood", "heat", "crash", "chime", "gong", "punch1", "fall", "splash", "bell", "sheep", "crow", "owl", "howl", "whistle"]:
		var s: AudioStream = sfx._stream(id)
		print("SND ", id, " ", snappedf(s.get_length(), 0.1) if s != null else "MISSING")
	for fn: String in ["trigger_rain", "trigger_drought", "trigger_flood", "trigger_gale", "trigger_eclipse"]:
		sim.call(fn)
		await get_tree().create_timer(1.2, true, false, true).timeout
		get_tree().paused = false
	var loud: Array = []
	for k: String in sfx._loops:
		var p: AudioStreamPlayer = sfx._loops[k]
		loud.append("%s:%s %d" % [k, p.playing, int(p.volume_db)])
	print("LOOPS ", loud)
	Engine.time_scale = 4.0
	await get_tree().create_timer(190.0, true, false, true).timeout
	Engine.time_scale = 1.0
	var asleep: Dictionary = {}
	for d: AgentData in sim._agent_registry:
		if d.node is MarkovAgent:
			var row: Array = asleep.get(d.species, [0, 0])
			row[1] += 1
			row[0] += 1 if d.node.current_state() == "Sleep" else 0
			asleep[d.species] = row
	print("NIGHT? ", sim.is_night(), " SLEEP ", asleep)
	var hud: Node = get_tree().current_scene.find_child("SimulationHUD", true, false)
	var a: MarkovAgent = get_tree().get_first_node_in_group("sheep")
	hud._start_follow(a)
	await get_tree().create_timer(0.8, true, false, true).timeout
	hud._follow_panel._show_vault()
	await get_tree().create_timer(0.8, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(out)
	print("MORE DONE")
	get_tree().quit()

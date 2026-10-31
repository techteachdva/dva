extends Node

# Dev: a real run, nothing placed. Where everything goes, what humans build,
# whether paths wear, then a wide river crossing and a raze.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	var gc: Node = get_node("/root/GameConfig")
	gc.disabled_species.clear()
	gc.time_limit = 12.0
	gc.current_mode = "sandbox"
	var world: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(world)
	get_tree().current_scene = world
	await get_tree().create_timer(4.0, true, false, true).timeout
	var ld: Node = world.find_child("LoadingScreen", true, false)
	if ld != null:
		ld.queue_free()
	var sim: SimulationDirector = world.get_node("World")
	Engine.time_scale = 4.0
	var t0: int = Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < 170000:
		get_tree().paused = false
		await get_tree().create_timer(1.0, true, false, true).timeout
	Engine.time_scale = 1.0
	print("DAY ", snappedf(sim.get_day(), 0.1))
	var by: Dictionary = {}
	for d: AgentData in sim._agent_registry:
		if d.node is MarkovAgent and d.species != "mushroom":
			var row: Array = by.get(d.species, [0, 0.0, {}])
			row[0] += 1
			row[1] += Vector2(d.pos.x, d.pos.z).length()
			row[2][int(fposmod(atan2(d.pos.z, d.pos.x), TAU) / (TAU / 4.0))] = true
			by[d.species] = row
	for sp: String in by:
		print("SP ", sp, " n ", by[sp][0], " radius ", snappedf(by[sp][1] / by[sp][0], 0.1), " quarters ", (by[sp][2] as Dictionary).size())
	var rs: Array = []
	for s: Variant in sim._active_shelters:
		rs.append(int(Vector2((s as Node3D).global_position.x, (s as Node3D).global_position.z).length()))
	print("HUTS ", rs)
	var w: float = 0.0
	if sim.paths != null:
		for i: int in sim.paths.route_count():
			w = maxf(w, sim.paths.wear_of(i))
		print("TUNNELS ", sim.paths.tunnel_count() if sim.paths != null else 0)
	print("ROUTES ", sim.paths.route_count(), " most worn ", snappedf(w, 0.01), " bridges ", sim.paths.bridges)
	var a: Vector3 = sim.dry_land(Vector3(0, 0, 34))
	var b: Vector3 = sim.dry_land(Vector3(0, 0, -34))
	var was: int = sim.paths.bridges if sim.paths != null else 0
	sim.build_shelter(a, 900)
	sim.build_shelter(b, 900)
	await get_tree().create_timer(1.0, true, false, true).timeout
	print("CROSSING bridges added ", sim.paths.bridges - was, " decks ", sim.paths._decks.size())
	var deck: Vector2i = sim.paths._decks.keys()[0] if not sim.paths._decks.is_empty() else Vector2i.ZERO
	for c: Node in world.find_children("*", "CanvasLayer", true, false):
		(c as CanvasLayer).visible = false
	var cam: Camera3D = world.get_node("Camera3D")
	cam.set_view(Vector3(deck.x * 2.0, 0, deck.y * 2.0), cam.yaw, -0.7, 26.0, true)
	await get_tree().create_timer(1.2, true, false, true).timeout
	get_viewport().get_texture().get_image().save_png(out)
	sim.trigger_flood()
	var hut_n: int = sim._active_shelters.size()
	var at: Vector3 = sim._active_shelters[0].global_position if hut_n > 0 else Vector3.ZERO
	sim.meteor_blast(at, 8.0)
	print("BLAST huts ", hut_n, " -> ", sim._active_shelters.size())
	var wander: int = 0
	for d: AgentData in sim._agent_registry:
		wander += 1 if d.node is MarkovAgent and d.node.current_state() == "Wanderlust" else 0
	print("WANDER now ", wander, " of ", sim._agent_registry.size())
	await get_tree().create_timer(0.5, true, false, true).timeout
	var before: int = sim.paths.route_count()
	if not sim._active_shelters.is_empty():
		sim.paths.remove_home(sim._active_shelters[sim._active_shelters.size() - 1].global_position)
	print("RAZE routes ", before, " -> ", sim.paths.route_count())
	print("SPREAD DONE")
	get_tree().quit()

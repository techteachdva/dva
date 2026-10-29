extends Node

# Dev: how far can the valley go? Fills it in even steps across every species
# up to 9999 creatures and measures frame time at each step.
#   godot --rendering-driver opengl3 --path . res://scenes/dev/limits_test.tscn -- <out dir>

const STEPS: Array[int] = [600, 1500, 3000, 5000, 7500, 9999]
const SPECIES: Array[String] = ["sheep", "rabbit", "deer", "goat", "wolf", "lion", "falcon", "human", "bear", "boar", "robin", "mouse", "worm", "beetle", "mushroom", "fish"]
const MEASURE_S: float = 6.0

var d: SimulationDirector

func _ready() -> void:
	_go.call_deferred()

func _go() -> void:
	var out: String = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else ""
	var w: Node = load("res://scenes/world.tscn").instantiate()
	get_tree().root.add_child(w)
	get_tree().current_scene = w
	for i in 90:
		await get_tree().process_frame
	get_tree().paused = false
	for c in get_tree().root.find_children("Welcome", "", true, false):
		c.queue_free()
	d = w.get_node("World")
	d.cfg_time_limit = 100000.0
	d.creature_ceiling = 10000
	var cam = get_viewport().get_camera_3d()
	cam.set_view(Vector3.ZERO, 0.8, -0.75, 120.0, true)
	await _measure("start")
	var i: int = 0
	for target: int in STEPS:
		var t0: int = Time.get_ticks_msec()
		while d._agent_registry.size() < target:
			for k in 50:
				var id: String = SPECIES[i % SPECIES.size()]
				i += 1
				var p: Vector3 = Biomes.random_point(id, d)
				var ag := d.spawn_scripted(id, p)
				if ag != null:
					ag.scripted = false
					ag.set_state(ag._current_state)
				if d._agent_registry.size() >= target:
					break
			await get_tree().process_frame
		print("LIM spawned to %d in %.1fs" % [target, (Time.get_ticks_msec() - t0) / 1000.0])
		await _measure(str(target))
		if out != "":
			get_viewport().get_texture().get_image().save_png("%s/limits_%d.png" % [out, target])
	# Let it run at the cap: does it hold, crash or stall?
	await _measure("hold-1")
	await _measure("hold-2")
	get_tree().quit()

func _measure(label: String) -> void:
	var frames: int = 0
	var worst: float = 0.0
	var t: float = 0.0
	var start: int = Time.get_ticks_usec()
	while t < MEASURE_S:
		var f0: int = Time.get_ticks_usec()
		await get_tree().process_frame
		var dt: float = (Time.get_ticks_usec() - f0) / 1000.0
		worst = maxf(worst, dt)
		t += dt / 1000.0
		frames += 1
	var avg: float = (Time.get_ticks_usec() - start) / 1000.0 / frames
	var counts := {}
	for a: AgentData in d._agent_registry:
		counts[a.species] = int(counts.get(a.species, 0)) + 1
	print("LIM %s agents=%d nodes=%d avg=%.1fms (%.0f fps) worst=%.0fms mem=%dMB draws=%d  %s" % [label, d._agent_registry.size(), Performance.get_monitor(Performance.OBJECT_NODE_COUNT), avg, 1000.0 / avg, worst, int(Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0), int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)), str(counts).replace("\"", "")])

extends Node

# Dev: splash, each Brawl level, and a live ragdoll.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	get_tree().current_scene = null
	var splash: Node = load("res://scenes/ui/splash.tscn").instantiate()
	splash.set_process(false)
	get_tree().root.add_child(splash)
	splash._ring.progress = 0.7
	splash._bar.value = 0.7
	await get_tree().create_timer(0.9).timeout
	get_viewport().get_texture().get_image().save_png(out + "/splash.png")
	splash.queue_free()
	for i: int in 3:
		var b: Node = load("res://scenes/minigames/predator_brawl.tscn").instantiate()
		b.demo = true
		get_tree().root.add_child(b)
		await get_tree().create_timer(0.3).timeout
		b._start_ladder("wolf")
		b._stage = i
		b._start_round()
		await get_tree().create_timer(3.2).timeout
		b._p2.hp = 1.0
		b._p1.state = "heavy"
		b._hit(b._p1, b._p2, 50.0, 500.0)
		await get_tree().create_timer(0.7).timeout
		get_viewport().get_texture().get_image().save_png(out + "/brawl%d.png" % i)
		b.queue_free()
		await get_tree().process_frame
	print("FX DONE")
	get_tree().quit()

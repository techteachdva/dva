extends Node

# Dev: a steady bot (level 0.5) against each difficulty, ten fast rounds each.
func _ready() -> void:
	await get_tree().process_frame
	get_tree().current_scene = null
	Engine.time_scale = 6.0
	for d: int in 3:
		var wins: int = 0
		for r: int in 10:
			var b: Node = load("res://scenes/minigames/predator_brawl.tscn").instantiate()
			b.demo = true
			get_tree().root.add_child(b)
			await get_tree().create_timer(0.2).timeout
			b._difficulty = d
			b._start_ladder(["wolf", "lion"][r % 2])
			b._p1.set_meta("level", 0.5)
			b._start_round()
			while b._mode != "roundover" and b._mode != "over":
				await get_tree().process_frame
				if b.has_node("HowToPlay"):
					b.get_node("HowToPlay").queue_free()
			wins += 1 if b._p1.hp >= b._p2.hp else 0
			b.queue_free()
			await get_tree().process_frame
		print("CAL difficulty ", d, " bot wins ", wins, " of 10")
	get_tree().quit()

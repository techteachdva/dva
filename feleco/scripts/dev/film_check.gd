extends Node

# Dev: one frame per line of each mode film.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	get_tree().current_scene = null
	for mode: String in ["main", "sandbox"]:
		get_node("/root/GameConfig").current_mode = mode
		var film: Node = load("res://scenes/ui/lore_film.tscn").instantiate()
		get_tree().root.add_child(film)
		get_tree().current_scene = film
		var last: String = ""
		var n: int = 0
		var hold: int = 0
		while film.get("_choosing") != true:
			hold += 1
			if film._caption.text == "" and hold % 3 == 0 and n >= 5:
				get_viewport().get_texture().get_image().save_png("%s/%s_end%d.png" % [out, mode, hold])
			await get_tree().create_timer(0.3).timeout
			if film._caption.text != last:
				last = film._caption.text
				await get_tree().create_timer(1.6).timeout
				get_viewport().get_texture().get_image().save_png("%s/%s%d.png" % [out, mode, n])
				n += 1
		print("FILM ", mode, " lines ", n)
		film.queue_free()
		await get_tree().process_frame
	print("FILMS DONE")
	get_tree().quit()

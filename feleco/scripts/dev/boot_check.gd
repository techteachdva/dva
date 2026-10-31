extends Node

# Dev: the boot logo mid-load and finished, and the menu's new buttons.
func _ready() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	await get_tree().process_frame
	get_tree().current_scene = null
	var s: Control = load("res://scenes/ui/splash.tscn").instantiate()
	get_tree().root.add_child(s)
	s.set_process(false)
	for p: float in [0.45, 1.0]:
		s._logo.progress = p
		s._vine.progress = p
		await get_tree().create_timer(0.5).timeout
		get_viewport().get_texture().get_image().save_png("%s/boot%d.png" % [out, int(p * 100)])
	s.queue_free()
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")
	await get_tree().create_timer(2.0).timeout
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = true
	e.position = Vector2(300, 300)
	get_node("/root/Sparkle")._input(e)
	await get_tree().create_timer(0.15).timeout
	get_viewport().get_texture().get_image().save_png(out + "/menu.png")
	get_tree().quit()

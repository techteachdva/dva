extends SceneTree

# Plays the opening and saves a frame whenever the caption changes.
#   godot --path . -s res://scripts/dev/intro_shots.gd -- <out dir>

var _out: String
var _last: String = ""

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	_out = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else "user://intro_shots"
	DirAccess.make_dir_recursive_absolute(_out)
	var gc: Node = root.get_node("GameConfig")
	gc.intro_seen = true
	Engine.time_scale = 3.0
	change_scene_to_file("res://scenes/ui/intro.tscn")
	var scene: Node = null
	for _i: int in 90:
		await process_frame
		scene = current_scene
		if scene != null and scene.scene_file_path == "res://scenes/ui/intro.tscn":
			break
	if scene == null or scene.scene_file_path != "res://scenes/ui/intro.tscn":
		print("SHOT intro never started ", current_scene)
		quit()
		return
	var n: int = 0
	var guard: float = 0.0
	while guard < 900.0:
		await process_frame
		guard += 1.0 / 60.0
		scene = current_scene
		if scene == null or scene.scene_file_path != "res://scenes/ui/intro.tscn":
			print("SHOT left intro at ", n)
			break
		var cap := _caption(scene)
		if cap != "" and cap != _last:
			_last = cap
			await create_timer(0.12, true, false, true).timeout
			var img := root.get_texture().get_image()
			var file := "%s/%02d.png" % [_out, n]
			img.save_png(file)
			print("SHOT ", n, " ", cap.substr(0, 80))
			n += 1
	print("SHOTS ", n)
	quit()

func _caption(scene: Node) -> String:
	var cap := scene.find_child("FilmCaption", true, false) as Label
	if cap == null or cap.modulate.a < 0.35:
		return ""
	return cap.text.strip_edges()

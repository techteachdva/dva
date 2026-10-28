extends SceneTree

# Dev: snapshots of the main screens, for design reviews.
#   godot --path . -s res://scripts/dev/screens_check.gd -- <out dir>

var _out: String

func _initialize() -> void:
	_run.call_deferred()

func _snap(name: String, wait: float = 1.5) -> void:
	await create_timer(wait, true, false, true).timeout
	root.get_texture().get_image().save_png(_out + "/" + name + ".png")
	print("SCREEN ", name)

func _run() -> void:
	_out = OS.get_cmdline_user_args()[0]
	var gc: Node = root.get_node("GameConfig")
	gc.tutorial_done = true
	for s: Array in [["menu", "res://scenes/ui/main_menu.tscn"], ["bets", "res://scenes/ui/betting_table.tscn"], ["shop", "res://scenes/ui/greenhouse_shop.tscn"]]:
		change_scene_to_file(s[1])
		await _snap(s[0], 3.0)
	# The rules page, opened the way the menu does.
	change_scene_to_file("res://scenes/ui/main_menu.tscn")
	await create_timer(2.0).timeout
	current_scene.call("_on_rules")
	await _snap("rules", 2.5)
	# The valley with the power tray open.
	gc.reset_run_state()
	gc.current_mode = "sandbox"
	change_scene_to_file("res://scenes/world.tscn")
	await create_timer(6.0).timeout
	var hud: Node = current_scene.find_child("SimulationHUD", true, false)
	if hud != null and hud.has_method("_toggle_powers"):
		hud.call("_toggle_powers")
	var tray: Node = current_scene.find_child("PowerTray", true, false)
	if tray != null:
		tray.set("visible", true)
	await _snap("powers", 1.5)
	quit()

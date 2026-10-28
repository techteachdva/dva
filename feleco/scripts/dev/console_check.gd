extends SceneTree

# Dev: drives the developer console through its commands and snapshots it.
# Back up user:// first (this unlocks dev mode and gives resources).
#   godot --path . -s res://scripts/dev/console_check.gd -- <out dir>

var _out: String

func _initialize() -> void:
	_run.call_deferred()

func _say(c: Node, line: String) -> void:
	c.call("_submit", line)
	await process_frame

func _run() -> void:
	_out = OS.get_cmdline_user_args()[0]
	var gc: Node = root.get_node("GameConfig")
	gc.intro_seen = true
	change_scene_to_file("res://scenes/ui/main_menu.tscn")
	await create_timer(2.0).timeout
	# The Credits link: open the popup and click DM Zemo.
	var about: Node = current_scene.find_child("Credits", true, false)
	print("CON credits label found: ", about != null)
	if about != null:
		(about as RichTextLabel).meta_clicked.emit("zemo")
	await create_timer(0.5).timeout
	var c: Node = root.get_node_or_null("DevConsole")
	print("CON console: ", c != null, " unlocked: ", gc.record("dev", "on"))
	for line: String in ["help", "ep 1000", "powers 3", "minigames win", "unlock all", "cosmetics all", "runs 2", "bets"]:
		await _say(c, line)
	root.get_texture().get_image().save_png(_out + "/con_menu.png")
	await _say(c, "scene valley")
	await create_timer(7.0).timeout
	c = root.get_node_or_null("DevConsole")
	for line: String in ["census", "spawn wolf 10", "gold sheep", "cast bloom", "touches 5", "fps", "hide grass", "hide creatures", "parts"]:
		await _say(c, line)
	await create_timer(1.0).timeout
	root.get_texture().get_image().save_png(_out + "/con_hidden.png")
	for line: String in ["show all", "day 2", "census", "speed 2", "end"]:
		await _say(c, line)
	await create_timer(3.0).timeout
	root.get_texture().get_image().save_png(_out + "/con_valley.png")
	var log: String = (c.get("_out") as RichTextLabel).get_parsed_text()
	print("CON log tail:\n", log.right(1800))
	quit()

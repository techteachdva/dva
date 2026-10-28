extends SceneTree

# Dev playtest of the Valley Saga: a short year, a dawn dilemma answered,
# the end screen, then Continue into year 2.
#   godot --path . -s res://scripts/dev/saga_playtest.gd -- <out dir>

var _out: String

func _initialize() -> void:
	_run.call_deferred()

func _shot(name: String) -> void:
	await process_frame
	await process_frame
	root.get_texture().get_image().save_png(_out + "/" + name + ".png")
	print("SAGA shot ", name)

func _run() -> void:
	_out = OS.get_cmdline_user_args()[0]
	var gc: Node = root.get_node("GameConfig")
	gc.reset_run_state()
	gc.current_mode = "sandbox"
	gc.tutorial_done = true
	gc.time_limit = 1.6
	gc.player_bet = "sheep"
	gc.set_record("saga", "state", {"year": 1, "met": [], "carry": false, "beaten": false})
	change_scene_to_file("res://scenes/world.tscn")
	await create_timer(5.0).timeout
	Engine.time_scale = 8.0
	await create_timer(1.0).timeout
	await _shot("saga_goals")
	# Wait for the dawn dilemma (it pauses the tree).
	var waited: float = 0.0
	while not paused and waited < 120.0:
		await create_timer(0.5, true, false, true).timeout
		waited += 0.5
	print("SAGA paused for dilemma: ", paused, " after ", waited, "s")
	Engine.time_scale = 1.0
	await _shot("saga_dilemma")
	var btns: Array = root.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.is_visible_in_tree() and (b.get_parent() is VBoxContainer) and b.get_parent().get_parent() is PanelContainer and b.get_parent().get_parent().get_parent() is ColorRect)
	print("SAGA dilemma buttons ", btns.map(func(b: Button) -> String: return b.text))
	if not btns.is_empty():
		(btns[0] as Button).pressed.emit()
	await create_timer(0.5).timeout
	print("SAGA paused after choice: ", paused)
	Engine.time_scale = 8.0
	waited = 0.0
	while current_scene != null and current_scene.find_child("NextLevel", true, false) == null and waited < 120.0:
		await create_timer(0.5, true, false, true).timeout
		waited += 0.5
	var nb: Button = current_scene.find_child("NextLevel", true, false) as Button
	while nb != null and not nb.is_visible_in_tree() and waited < 140.0:
		await create_timer(0.5, true, false, true).timeout
		waited += 0.5
	Engine.time_scale = 1.0
	await create_timer(0.6, true, false, true).timeout
	await _shot("saga_end")
	if nb == null:
		print("SAGA no end screen")
		quit()
		return
	print("SAGA next button: ", nb.text, " visible ", nb.is_visible_in_tree())
	print("SAGA state ", gc.record("saga", "state"))
	nb.pressed.emit()
	await create_timer(1.0).timeout
	print("SAGA after continue: scene ", current_scene.name if current_scene != null else "-", " state ", gc.record("saga", "state"), " sheep ", gc.sheep_count, " wolves ", gc.wolf_count)
	quit()

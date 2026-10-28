extends SceneTree

# Dev check: real mouse clicks on Valley Dominion, pushed through the
# viewport the way a player's clicks arrive.

func _initialize() -> void:
	_run.call_deferred()

func _click(at: Vector2) -> void:
	for pressed: bool in [true, false]:
		var e := InputEventMouseButton.new()
		e.button_index = MOUSE_BUTTON_LEFT
		e.pressed = pressed
		e.position = at
		e.global_position = at
		root.push_input(e)
		await process_frame

func _gclick(g: Control, at: Vector2) -> void:
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = true
	e.position = at
	g._gui_input(e)
	await process_frame

func _run() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var g: Control = (load("res://scenes/minigames/valley_dominion.tscn") as PackedScene).instantiate()
	root.add_child(g)
	await process_frame
	await process_frame
	print("CHECK children ", g.get_children().map(func(c: Node) -> String: return c.get_class() + ":" + c.name))
	for c: Node in g.get_children():
		if c is ColorRect:
			c.queue_free()
	await process_frame
	# Click the first clan's button like a player would.
	var btns: Array = g.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.text.begins_with("Lead the"))
	print("CHECK lead buttons ", btns.size())
	if btns.is_empty():
		quit()
		return
	var b: Button = btns[0]
	await _click(b.get_global_rect().get_center())
	if g._mode == "select":
		print("CHECK pushed click did not press the button; starting directly")
		g._start("human")
	await process_frame
	print("CHECK mode ", g._mode, " player ", g._player)
	await create_timer(0.5).timeout
	var home: Vector2i = g._tiles_of(g._player)[0]
	var at: Vector2 = g._cell_center(home)
	print("CHECK home ", home, " at ", at, " hovered ", root.gui_get_hovered_control())
	await _gclick(g, at)
	print("CHECK sel after click ", g._sel)
	var target: Vector2i = Vector2i(-1, -1)
	for n: Vector2i in g._targets(home, "human"):
		if g._owner[g._idx(n)] == "":
			target = n
			break
	await _gclick(g, g._cell_center(target))
	print("CHECK moved to ", target, " owner now ", g._owner[g._idx(target)], " moves left ", g._moves)
	await create_timer(0.3).timeout
	root.get_texture().get_image().save_png(out + "/dom_click.png")
	# What sits on top of the board at that point?
	var top: Control = null
	for c: Control in g.find_children("*", "Control", true, false):
		if c.is_visible_in_tree() and c.get_global_rect().has_point(at) and c.mouse_filter != Control.MOUSE_FILTER_IGNORE:
			top = c
			print("CHECK under point: ", c.get_class(), " ", c.name, " filter=", c.mouse_filter, " rect=", c.get_global_rect())
	quit()

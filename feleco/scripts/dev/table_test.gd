extends SceneTree

# Dev check for the betting table: godot --path . -s res://scripts/dev/table_test.gd
func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var gc: Node = root.get_node("GameConfig")
	gc.eco_points = 40
	gc.current_mode = "sandbox"
	gc.time_limit = 90.0
	gc.spawn_roster.clear()
	gc.bets.clear()
	var t := BettingTable.new()
	root.add_child(t)
	for i in 10:
		await process_frame
	var ok := true
	var box: Control = t._boxes["faction:wolves"]
	t.set_chip(5)
	t.add_coins(box)
	t.add_coins(box)
	ok = ok and t.coins_on("faction:wolves") == 10
	t._undo()
	ok = ok and t.coins_on("faction:wolves") == 5
	t.set_chip(10)
	for i in 5:
		t.add_coins(t._boxes["flood:20"])
	ok = ok and t.coins_on("flood:20") == 20  # max per box
	t.add_coins(t._boxes["extinct:robins"])
	ok = ok and t.pending_total() == 30  # table limit 30
	t.remove_coins(t._boxes["flood:20"], false)
	ok = ok and t.coins_on("flood:20") == 19
	print("placement ok=", ok, " pending=", t._pending)
	# Swipe: drag 300px left across the pager.
	var r: Rect2 = t._pager.get_global_rect()
	var start := r.get_center()
	var ev := InputEventMouseButton.new(); ev.button_index = MOUSE_BUTTON_LEFT; ev.pressed = true; ev.position = start
	t._input(ev)
	var mv := InputEventMouseMotion.new(); mv.position = start + Vector2(-400, 0)
	t._input(mv)
	var up := InputEventMouseButton.new(); up.button_index = MOUSE_BUTTON_LEFT; up.pressed = false; up.position = start + Vector2(-400, 0)
	t._input(up)
	print("pager rect=", r, " swiping flag cleared=", not t._swiping)
	print("swipe page=", t._page, " (expect 1)")
	t._commit()
	print("bets=", gc.bets.size(), " ep=", gc.eco_points, " (expect 3 bets, 11 EP)")
	# Judge a few bets against made-up worlds.
	var stats := {"flood_toll": 22, "extinct_day": {"robins": 30.0}, "peak": {}, "named_dead": {}, "named_age": {}}
	for b in gc.bets:
		print("  ", b["id"], " live=", BetBook.judge(b, {"wolves": 30, "sheep": 10}, stats, false), " final=", BetBook.judge(b, {"wolves": 30, "sheep": 10}, stats, true))
	quit()

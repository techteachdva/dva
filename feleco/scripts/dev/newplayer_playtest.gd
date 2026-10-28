extends SceneTree

# Dev: a brand-new player's first steps, on a wiped profile. Back up
# user:// first: this clears the records.
#   godot --path . -s res://scripts/dev/newplayer_playtest.gd -- <out dir> [--touch]

var _out: String

func _initialize() -> void:
	_run.call_deferred()

func _snap(name: String, wait: float = 1.2) -> void:
	await create_timer(wait, true, false, true).timeout
	root.get_texture().get_image().save_png(_out + "/" + name + ".png")
	print("NEW shot ", name)

func _visible_buttons() -> Array:
	return current_scene.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.is_visible_in_tree()).map(func(b: Button) -> String: return b.text)

func _run() -> void:
	_out = OS.get_cmdline_user_args()[0]
	var gc: Node = root.get_node("GameConfig")
	gc.records = {}
	gc.eco_points = 0
	gc.intro_seen = true
	gc.tutorial_done = true
	gc.set_record("unlock", "migrated", true)
	change_scene_to_file("res://scenes/ui/main_menu.tscn")
	await _snap("01_menu_fresh", 2.5)
	print("NEW menu buttons: ", _visible_buttons())
	current_scene.call("_on_rules")
	await create_timer(1.0).timeout
	var guide: Node = current_scene.find_child("FieldGuide", true, false)
	var tour: Node = guide.find_child("*", true, false) if guide != null else null
	for c: Node in guide.get_children():
		if c.get_class() == "Control" and c.get("guide") != null:
			tour = c
	await _snap("02_tour_step1", 0.5)
	tour.call("_advance")
	await _snap("03_tour_year", 0.8)
	tour.call("_advance")
	tour.call("_advance")
	await _snap("04_tour_levels", 0.8)
	tour.call("_advance")
	tour.call("_advance")
	await _snap("05_tour_click", 0.8)
	guide.set("_focus", "wolf")
	await create_timer(1.8).timeout
	await _snap("06_tour_after_click", 0.3)
	tour.call("_advance")
	tour.call("_advance")
	await create_timer(2.5).timeout
	await _snap("07_menu_unlocked", 1.5)
	print("NEW menu buttons after tour: ", _visible_buttons())
	print("NEW unlocked valley=", gc.unlocked("valley"), " greenhouse=", gc.unlocked("greenhouse"))
	# A first betting table: tier 0 with plans.
	gc.reset_run_state()
	gc.current_mode = "sandbox"
	gc.eco_points = 30
	change_scene_to_file("res://scenes/ui/betting_table.tscn")
	await _snap("08_bets_first", 2.5)
	var plan_btns: Array = current_scene.find_children("*", "Button", true, false).filter(func(b: Button) -> bool: return b.text == "Use this plan")
	print("NEW plans offered: ", plan_btns.size())
	if plan_btns.size() > 1:
		(plan_btns[1] as Button).pressed.emit()
	await _snap("09_bets_plan_used", 1.0)
	print("NEW pending after plan: ", current_scene.get("_pending"))
	# Third run: every tier.
	gc.set_record("progress", "runs", 2)
	change_scene_to_file("res://scenes/ui/betting_table.tscn")
	await _snap("10_bets_tier2", 2.5)
	change_scene_to_file("res://scenes/ui/greenhouse_shop.tscn")
	await _snap("11_greenhouse", 2.0)
	print("NEW challenge unlocked by visiting greenhouse: ", gc.unlocked("challenge"))
	change_scene_to_file("res://scenes/minigames/predator_brawl.tscn")
	await create_timer(1.5).timeout
	for c: Node in current_scene.get_children():
		if c is ColorRect:
			c.queue_free()
	current_scene.call("_start_ladder", "wolf")
	await _snap("12_brawl_touch", 3.0)
	change_scene_to_file("res://scenes/minigames/stampede_sprint.tscn")
	await create_timer(1.5).timeout
	for c: Node in current_scene.get_children():
		if c is ColorRect:
			c.queue_free()
	current_scene.call("_pick", "sheep")
	await _snap("13_race_touch", 4.0)
	quit()

extends SceneTree

# Dev check for the campaign games: drives each one through its main beats
# and saves screenshots. Run windowed:
#   godot --path . -s res://scripts/dev/campaign_check.gd -- <out dir>

var _out: String = ""

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	_out = args[0] if not args.is_empty() else "user://check"
	_run.call_deferred()

func _shot(name: String) -> void:
	await process_frame
	await process_frame
	root.get_texture().get_image().save_png(_out + "/" + name + ".png")
	print("CHECK shot ", name)

func _wait(secs: float) -> void:
	await create_timer(secs).timeout

func _game(path: String) -> Control:
	for c: Node in root.get_children():
		if c is Control:
			c.queue_free()
	await process_frame
	var g: Control = (load(path) as PackedScene).instantiate()
	root.add_child(g)
	await process_frame
	# Close a first-run how-to card if one opened.
	for c: Node in g.get_children():
		if c is ColorRect or (c is PanelContainer and c.z_index >= 50):
			c.queue_free()
	await process_frame
	return g

func _key(g: Control, ch: String) -> void:
	var e := InputEventKey.new()
	e.pressed = true
	e.unicode = ch.unicode_at(0)
	e.keycode = KEY_SPACE if ch == " " else OS.find_keycode_from_string(ch.to_upper())
	g._gui_input(e)

func _run() -> void:
	# --- Race
	var race: Control = await _game("res://scenes/minigames/stampede_sprint.tscn")
	race._pick("sheep")
	await _wait(3.4)
	race._race = 2
	race._pos[0] = race._length * 0.6
	race._next_prompt()
	var sp: int = race._prompt.find(" ")
	for i: int in (sp if sp > 0 else 3):
		_key(race, race._prompt.substr(race._typed, 1))
		await _wait(0.06)
	await _wait(0.2)
	await _shot("race_cursor")
	_key(race, "#")
	await _wait(0.05)
	await _shot("race_miss")
	# --- Golf
	var golf: Control = await _game("res://scenes/minigames/seed_golf.tscn")
	golf._start_level(1)
	await _wait(0.3)
	golf._dragging = true
	golf._drag_now = golf._seed + Vector2(-120, 60)
	await _shot("golf_aim")
	golf._dragging = false
	golf._putt(golf._seed + Vector2(-160, 40))
	await _wait(1.0)
	await _shot("golf_course")
	golf._seed = golf._lv["cup"] + Vector2(-5, 0)
	golf._vel = Vector2(20, 0)
	golf._rolling = true
	await _wait(1.6)
	golf._set_rain(true)
	await _wait(1.6)
	await _shot("golf_water")
	golf._set_rain(false)
	await _wait(1.5)
	print("CHECK golf phase ", golf._phase, " moves ", golf._moves_total)
	for d: Vector2i in [Vector2i(0, -1), Vector2i(0, -1), Vector2i(-1, 0), Vector2i(0, -1)]:
		golf._grow_to(golf._path[-1] + d)
		await _wait(0.15)
	await _shot("golf_grow")
	golf._finish()
	await _wait(1.0)
	await _shot("golf_grade")
	# --- Brawl
	var brawl: Control = await _game("res://scenes/minigames/predator_brawl.tscn")
	brawl._start_ladder("wolf")
	await _wait(2.5)
	var p1 = brawl._p1
	var p2 = brawl._p2
	p1.pos.x = p2.pos.x - 120.0
	p1.inputs = [["D", 0.0], ["D", 0.0]]
	brawl._control(p1, 0.0, false, false, false, true, false, 0.016)
	await _wait(0.16)
	await _shot("brawl_sweep")
	await _wait(0.6)
	p1.meter = 100.0
	await _wait(0.3)
	await _shot("brawl_ready")
	brawl._evolve(p1)
	await _wait(0.4)
	await _shot("brawl_evolve")
	await _wait(1.0)
	p1.hp = 20.0
	p2.hp = 90.0
	p1.dire = 0.0
	p1.pos.x = 200.0
	p2.pos.x = 900.0
	p2.set_meta("taunt_cd", 0.0)
	await _wait(1.2)
	print("CHECK brawl p2 state ", p2.state)
	await _shot("brawl_taunt")
	# --- Dominion
	var dom: Control = await _game("res://scenes/minigames/valley_dominion.tscn")
	dom._start("human")
	await _wait(0.6)
	await _shot("dominion_start")
	var home: Vector2i = dom._tiles_of("human")[0]
	dom._sel = home
	dom._refresh()
	await _wait(0.3)
	await _shot("dominion_select")
	print("CHECK done")
	quit()

extends Control

# Producer campaign: Seedling Golf. A seed's whole first season, in three
# parts on every hole:
#   1 PUTT   real minigolf: curved fairways, hills that roll the seed away,
#            bowls that pull it in, bumpers and ponds. Sink it in the cup.
#   2 WATER  hold to rain on the planted seed; let go in the green band.
#   3 GROW   a routing puzzle: grow the stalk cell by cell (up, left or
#            right, never back) from the soil to the sun around rocks.
#            Thorns cost two moves, dew gives three back, and sunbeams are
#            off the short route: the budget is tight (worked out exactly by
#            a solver), so reaching the sun AND the light takes planning.
# A good putt (par or better) and good watering each earn an extra move.
# The hole is graded S, A, B, C, D or F.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const FIELD := Vector2(1200, 640)
const SEED_R: float = 10.0
const HOLE_R: float = 17.0
const MAX_PULL: float = 220.0
const MAX_SPEED: float = 1000.0
# Fraction of speed kept per second while rolling.
const ROLL_DRAG: float = 0.45
# Hole conditions, rolled each attempt: [name, drag kept per second, wind].
const CONDITIONS: Array = [
	["Calm", 0.45, 0.0],
	["Windy", 0.45, 90.0],
	["Wet green (slow)", 0.3, 0.0],
	["Dry green (fast)", 0.6, 0.0],
]
# Rain clouds: [name, band low, band high, fill rate, moves in band, dew, thorns].
const CLOUDS: Array = [
	["Light rain", 0.5, 0.7, 0.3, 1, 0, 0],
	["Steady rain", 0.62, 0.82, 0.42, 1, 2, 0],
	["Storm", 0.76, 0.92, 0.65, 3, 0, 2],
]
# Root snips per hole: clear one rock next to the tip (1 move).
const SNIPS: Array[int] = [1, 1, 2, 2, 2, 2, 2, 2]
const SINK_SPEED: float = 380.0
# The grow grid.
const COLS: int = 9
const ROWS: int = 11
const DEW_BACK: int = 3
# The water band: let go between these.
const WATER_LO: float = 0.62
const WATER_HI: float = 0.82
const WATER_RATE: float = 0.42

# Hand-made holes, easy to hard, on a 1200 x 640 field.
# edge: the fairway outline (the seed banks off it); hills: [centre, radius,
# push] (push > 0 rolls the seed away, < 0 is a bowl that pulls it in);
# bumpers: [centre, radius]; ponds: [centre, radius]; spinners: [centre,
# length, turns per second] rotating bars. grid: the grow puzzle, top row
# first: '.' open, '#' rock, '*' sunbeam, '~' thorn (2 moves), '+' dew
# (gives 3 back), 'S' the seed. moves: the budget before bonuses.
const LEVELS: Array = [
	{
		"name": "First Sprout", "par": 2,
		"tee": Vector2(170, 320), "cup": Vector2(1030, 320),
		"edge": [Vector2(70, 170), Vector2(300, 110), Vector2(900, 110), Vector2(1130, 170), Vector2(1160, 320), Vector2(1130, 470), Vector2(900, 530), Vector2(300, 530), Vector2(70, 470), Vector2(40, 320)],
		"hills": [[Vector2(600, 320), 140.0, 420.0]],
		"bumpers": [], "ponds": [],
		"grid": [".........", ".#..#..#.", "+.*##~#.#", "#........", "..#.#.#..", "######...", "##..#.##.", "....#.#..", "#*.*...~.", "..~.##...", "....S...."], "moves": 21,
		"tip": "Drag BACK from the seed and let go. The hill in the middle rolls it aside: go around, or hit it hard!",
	},
	{
		"name": "Dogleg Dell", "par": 3,
		"tee": Vector2(150, 520), "cup": Vector2(1020, 150),
		"edge": [Vector2(60, 430), Vector2(700, 430), Vector2(820, 400), Vector2(880, 330), Vector2(900, 60), Vector2(1150, 60), Vector2(1150, 420), Vector2(1100, 560), Vector2(950, 610), Vector2(60, 610)],
		"hills": [[Vector2(1020, 330), 110.0, -260.0], [Vector2(520, 520), 90.0, 300.0]],
		"bumpers": [[Vector2(980, 500), 26.0]], "ponds": [],
		"grid": [".........", "..#...#.~", "....#..**", "....*.#..", ".#.#~.##.", "#.#...#.#", "#....#+..", "*..~.###.", "..###.~+.", "#.~.#.#..", "....S...."], "moves": 19,
		"tip": "Bank it off the curved wall round the corner. The bowl near the cup pulls the seed in.",
	},
	{
		"name": "Bowl Valley", "par": 3,
		"tee": Vector2(150, 320), "cup": Vector2(820, 320),
		"edge": [Vector2(60, 220), Vector2(260, 90), Vector2(600, 60), Vector2(940, 90), Vector2(1140, 220), Vector2(1170, 320), Vector2(1140, 420), Vector2(940, 550), Vector2(600, 580), Vector2(260, 550), Vector2(60, 420), Vector2(40, 320)],
		"hills": [[Vector2(820, 320), 170.0, -300.0], [Vector2(420, 200), 100.0, 340.0], [Vector2(420, 440), 100.0, 340.0]],
		"bumpers": [[Vector2(560, 320), 30.0]], "ponds": [[Vector2(1040, 320), 70.0]], "spinners": [[Vector2(640, 160), 150.0, 0.25]],
		"grid": [".........", "#..#.#.**", "#..##~#.#", "#.....~..", ".....*###", ".+#..##..", "#..#...##", ".#...#.##", "#.+#~#~#*", ".##.#~~##", "....S...."], "moves": 20,
		"tip": "The big bowl pulls the seed to the cup, but too hard and it rolls out into the pond behind!",
	},
	{
		"name": "Curvy Creek", "par": 4,
		"tee": Vector2(130, 540), "cup": Vector2(1070, 110),
		"edge": [Vector2(50, 460), Vector2(420, 440), Vector2(520, 380), Vector2(540, 260), Vector2(620, 150), Vector2(780, 60), Vector2(1150, 50), Vector2(1160, 200), Vector2(820, 220), Vector2(760, 300), Vector2(740, 430), Vector2(640, 560), Vector2(450, 615), Vector2(50, 615)],
		"hills": [[Vector2(650, 300), 80.0, 280.0], [Vector2(330, 530), 80.0, -200.0]],
		"bumpers": [[Vector2(900, 140), 24.0]], "ponds": [[Vector2(620, 470), 55.0], [Vector2(960, 110), 35.0]], "spinners": [[Vector2(640, 110), 130.0, -0.3]],
		"grid": [".........", ".~#...#.*", "#.#...#.#", "#...###.+", "#.*.~.*.#", "..#.###..", "#..##*+#.", "####.~.~~", "##..~.#..", "#.~###*##", "....S...."], "moves": 25,
		"tip": "An S-bend with a creek. Short, careful putts beat one big swing.",
	},
	{
		"name": "Mole Hills", "par": 4,
		"tee": Vector2(120, 560), "cup": Vector2(1080, 100),
		"edge": [Vector2(50, 60), Vector2(1150, 60), Vector2(1150, 610), Vector2(50, 610)],
		"hills": [[Vector2(360, 420), 90.0, 380.0], [Vector2(600, 300), 100.0, 380.0], [Vector2(840, 200), 90.0, 380.0], [Vector2(360, 160), 80.0, -220.0], [Vector2(860, 480), 90.0, -220.0], [Vector2(1080, 100), 90.0, -150.0]],
		"bumpers": [[Vector2(600, 520), 28.0], [Vector2(980, 300), 28.0], [Vector2(220, 300), 28.0]], "ponds": [[Vector2(1000, 520), 60.0]],
		"grid": [".........", "*..#.+.##", "~..~###..", "#*.~..#.*", ".####~..#", "#.+*~##.#", "####....#", ".~+..#...", ".......#.", "#~....##*", "....S...."], "moves": 21,
		"tip": "Mole hills everywhere! Read the slopes and use the bowls.",
	},
	{
		"name": "Volcano Rim", "par": 3,
		"tee": Vector2(150, 320), "cup": Vector2(920, 320),
		"edge": [Vector2(60, 200), Vector2(400, 120), Vector2(800, 70), Vector2(1100, 120), Vector2(1170, 320), Vector2(1100, 520), Vector2(800, 570), Vector2(400, 520), Vector2(60, 440)],
		"hills": [[Vector2(920, 320), 230.0, 520.0], [Vector2(920, 320), 80.0, -900.0], [Vector2(420, 200), 90.0, 300.0], [Vector2(420, 440), 90.0, 300.0]],
		"bumpers": [], "ponds": [[Vector2(640, 320), 50.0]], "spinners": [[Vector2(640, 320), 170.0, 0.3]],
		"grid": [".........", "*.#~..*#+", "#..#*+###", "#*#######", ".~..#####", "+.~~....#", "##..~~~#.", "..#.#..#.", "#####..*.", "##.###~.#", "....S...."], "moves": 22,
		"tip": "The cup sits in a crater on top of a hill. Too soft rolls back down; too hard flies over!",
	},
	{
		"name": "Twin Peaks", "par": 4,
		"tee": Vector2(130, 560), "cup": Vector2(1060, 110),
		"edge": [Vector2(50, 610), Vector2(50, 380), Vector2(320, 300), Vector2(380, 60), Vector2(1150, 60), Vector2(1150, 330), Vector2(820, 380), Vector2(760, 610)],
		"hills": [[Vector2(520, 230), 130.0, 460.0], [Vector2(800, 200), 130.0, 460.0], [Vector2(660, 330), 70.0, -300.0], [Vector2(1060, 110), 90.0, -260.0], [Vector2(300, 500), 100.0, 280.0]],
		"bumpers": [[Vector2(660, 120), 26.0], [Vector2(560, 500), 26.0]], "ponds": [[Vector2(980, 260), 45.0]], "spinners": [[Vector2(660, 480), 150.0, -0.35]],
		"grid": [".........", ".##**##.#", "####~~.#.", "#.#.##.~#", "###+##.#+", "....~#~#.", ".*+##.~##", "##**.....", ".#*.###~.", "##~#.###.", "....S...."], "moves": 23,
		"tip": "Thread the saddle between the two peaks. The little bowl in the pass is your friend.",
	},
	{
		"name": "Summit", "par": 5,
		"tee": Vector2(120, 570), "cup": Vector2(1080, 100),
		"edge": [Vector2(50, 610), Vector2(50, 420), Vector2(560, 420), Vector2(560, 300), Vector2(50, 300), Vector2(50, 60), Vector2(1150, 60), Vector2(1150, 200), Vector2(640, 200), Vector2(640, 330), Vector2(1150, 330), Vector2(1150, 610)],
		"hills": [[Vector2(820, 480), 110.0, 420.0], [Vector2(300, 180), 100.0, 420.0], [Vector2(1080, 100), 110.0, 380.0], [Vector2(1080, 100), 45.0, -900.0], [Vector2(600, 520), 70.0, -280.0]],
		"bumpers": [[Vector2(1000, 520), 26.0], [Vector2(150, 160), 26.0]], "ponds": [[Vector2(380, 520), 45.0], [Vector2(800, 120), 40.0]], "spinners": [[Vector2(980, 470), 140.0, 0.4], [Vector2(560, 130), 140.0, -0.4]],
		"grid": [".........", "#.#*#.##~", "*##.#~*.~", "#~##.###~", ".###*..+.", "..+##.~*+", "..#.#~#..", ".#....#~#", "...######", "*####..~.", "....S...."], "moves": 24,
		"tip": "The last climb: a switchback to a summit cup with a rim. Bank, time the spinners, then crest it.",
	},
]

enum Phase { PUTT, WATER, GROW, DONE }

var level_index: int = 0
var _lv: Dictionary = {}
var _phase: int = Phase.PUTT
var _seed: Vector2
var _vel: Vector2 = Vector2.ZERO
var _rolling: bool = false
var _last_rest: Vector2
var _strokes: int = 0
var _dragging: bool = false
var _drag_now: Vector2
var _trail: Array[Vector2] = []
var _sunk_t: float = -1.0
# Water.
var _water: float = 0.0
var _raining: bool = false
var _watered: bool = false
var _water_score: float = 0.0
var _cloud: int = 1
var _cond: Array = []
var _wind := Vector2.ZERO
var _snips: int = 0
var _cloud_btns: Array[Button] = []
# Grow.
var _grid: Array[String] = []
var _path: Array[Vector2i] = []
var _moves_left: int = 0
var _moves_total: int = 0
var _beams: int = 0
var _beams_total: int = 0
# Moves each step cost (thorns 2, dew gives some back), for undo.
var _step_costs: Array[int] = []
var _reached_sun: bool = false
var _tip_pop: float = 0.0
var _result: Dictionary = {}
var _result_t: float = 0.0
var _msg: String = ""
var _msg_t: float = 0.0
var _t: float = 0.0
var _hud: Label
var _phase_lbl: Label
var _buttons: HBoxContainer
var _action_btn: Button
var _undo_btn: Button
var _select: Control
var _fx := Juice.new()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	theme = FelecoUiScript.theme()
	_fx.font = FelecoUiScript.font("heading")
	_build_ui()
	_show_select()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "golf"):
		HowToPlay.show(self, "golf")

# --- Level select ---------------------------------------------------------

func _show_select() -> void:
	if _select != null:
		_select.queue_free()
	_buttons.visible = false
	_select = PanelContainer.new()
	_select.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_select)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 14)
	_select.add_child(col)
	var t := FelecoUiScript.heading("Seedling Golf", 44, FelecoUiScript.GOLD)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var sub := FelecoUiScript.label("Putt the seed into the cup, water it just right, then grow it up to the sun!", 20, FelecoUiScript.CREAM)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(sub)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	var center := CenterContainer.new()
	center.add_child(grid)
	col.add_child(center)
	var gc: Node = get_node_or_null("/root/GameConfig")
	for i: int in LEVELS.size():
		var best = gc.record("golf", str(i)) if gc != null else null
		var unlocked: bool = i == 0 or (gc != null and gc.record("golf", str(i - 1)) != null)
		var b := Button.new()
		b.custom_minimum_size = Vector2(300, 90)
		b.text = "%d. %s\n%s" % [i + 1, LEVELS[i]["name"], ("Best: " + str(best)) if best != null else ("Play" if unlocked else "Locked")]
		b.disabled = not unlocked
		b.theme_type_variation = "TouchButton"
		var idx := i
		b.pressed.connect(func() -> void:
			Juice.sfx(self, "click")
			_start_level(idx))
		grid.add_child(b)
	var back := Button.new()
	back.text = "Back to Mini-Games"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(220, 50)
	back.pressed.connect(_leave)
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "golf")
	bc.add_child(back)
	col.add_child(bc)

func _leave() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	if k.physical_keycode == KEY_ESCAPE:
		if _select != null:
			_leave()
		else:
			_show_select()

# --- In-level UI ----------------------------------------------------------

func _build_ui() -> void:
	var top := HBoxContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top.offset_left = 16
	top.offset_right = -16
	top.offset_top = 8
	add_child(top)
	_phase_lbl = FelecoUiScript.heading("", 24, FelecoUiScript.GOLD)
	top.add_child(_phase_lbl)
	_hud = FelecoUiScript.label("", 18, FelecoUiScript.CREAM)
	_hud.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_hud.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	top.add_child(_hud)
	_buttons = HBoxContainer.new()
	_buttons.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_buttons.offset_top = -60
	_buttons.offset_bottom = -8
	_buttons.offset_left = 16
	_buttons.offset_right = -16
	_buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	_buttons.add_theme_constant_override("separation", 10)
	add_child(_buttons)
	_undo_btn = Button.new()
	_undo_btn.text = "Undo"
	_undo_btn.custom_minimum_size = Vector2(110, 44)
	_undo_btn.pressed.connect(_undo)
	_buttons.add_child(_undo_btn)
	for ci: int in CLOUDS.size():
		var cb := Button.new()
		cb.text = CLOUDS[ci][0]
		cb.toggle_mode = true
		cb.custom_minimum_size = Vector2(140, 44)
		cb.tooltip_text = "Band %d-%d%%. In the band: +%d move%s%s%s." % [int(CLOUDS[ci][1] * 100), int(CLOUDS[ci][2] * 100), CLOUDS[ci][4], "" if CLOUDS[ci][4] == 1 else "s", ", %d dew" % CLOUDS[ci][5] if CLOUDS[ci][5] > 0 else "", ", but %d thorns" % CLOUDS[ci][6] if CLOUDS[ci][6] > 0 else ""]
		var idx := ci
		cb.pressed.connect(func() -> void:
			if _raining or _watered:
				return
			_cloud = idx
			Juice.sfx(self, "click")
			_refresh_ui())
		_buttons.add_child(cb)
		_cloud_btns.append(cb)
	_action_btn = Button.new()
	_action_btn.theme_type_variation = "PrimaryButton"
	_action_btn.custom_minimum_size = Vector2(190, 44)
	_action_btn.pressed.connect(_action)
	_buttons.add_child(_action_btn)
	var restart := Button.new()
	restart.text = "Restart"
	restart.theme_type_variation = "GhostButton"
	restart.custom_minimum_size = Vector2(110, 44)
	restart.pressed.connect(func() -> void: _start_level(level_index))
	_buttons.add_child(restart)
	var menu := Button.new()
	menu.text = "Holes"
	menu.theme_type_variation = "GhostButton"
	menu.custom_minimum_size = Vector2(110, 44)
	menu.pressed.connect(_show_select)
	_buttons.add_child(menu)

func _start_level(i: int) -> void:
	if _select != null:
		_select.queue_free()
		_select = null
	_buttons.visible = true
	level_index = i
	_lv = LEVELS[i]
	_phase = Phase.PUTT
	_seed = _lv["tee"]
	_last_rest = _seed
	_vel = Vector2.ZERO
	_rolling = false
	_strokes = 0
	_trail.clear()
	_sunk_t = -1.0
	_water = 0.0
	_raining = false
	_watered = false
	_water_score = 0.0
	_cloud = 1
	_cond = CONDITIONS[0] if i == 0 else CONDITIONS[randi() % CONDITIONS.size()]
	_wind = Vector2.from_angle(randf() * TAU) * float(_cond[2])
	_snips = SNIPS[mini(i, SNIPS.size() - 1)]
	_grid.assign(_lv["grid"])
	_path.clear()
	_beams = 0
	_beams_total = 0
	for row: String in _grid:
		_beams_total += row.count("*")
	_reached_sun = false
	_result = {}
	_say(String(_lv["tip"]), 6.0)
	grab_focus()
	_refresh_ui()

func _say(text: String, secs: float = 2.5) -> void:
	_msg = text
	_msg_t = secs

func _refresh_ui() -> void:
	match _phase:
		Phase.PUTT:
			_phase_lbl.text = "Hole %d: %s   1. PUTT" % [level_index + 1, _lv["name"]]
			_hud.text = "%s   Strokes %d   Par %d" % [_cond[0], _strokes, _lv["par"]]
		Phase.WATER:
			_phase_lbl.text = "2. WATER: hold the mouse (or Space), let go in the green"
			_hud.text = "%s   Water %d%%" % [CLOUDS[_cloud][0], int(_water * 100)]
		Phase.GROW:
			_phase_lbl.text = "3. GROW to the sun: click a glowing cell (or arrow keys)"
			_hud.text = "Moves %d   Snips %d   Sunbeams %d/%d   (thorns -2, dew +3)" % [_moves_left, _snips, _beams, _beams_total]
		Phase.DONE:
			_phase_lbl.text = "Grown!"
			_hud.text = ""
	for ci: int in _cloud_btns.size():
		_cloud_btns[ci].visible = _phase == Phase.WATER and not _watered
		_cloud_btns[ci].set_pressed_no_signal(ci == _cloud)
	_undo_btn.visible = _phase == Phase.GROW
	_undo_btn.disabled = _path.size() <= 1
	_action_btn.visible = _phase in [Phase.GROW, Phase.DONE]
	_action_btn.text = "Finish growing" if _phase == Phase.GROW else ("Next hole" if level_index + 1 < LEVELS.size() else "All holes")

func _action() -> void:
	Juice.sfx(self, "click")
	if _phase == Phase.GROW:
		_finish()
	elif _phase == Phase.DONE:
		if level_index + 1 < LEVELS.size():
			_start_level(level_index + 1)
		else:
			_show_select()

# --- Coordinates ----------------------------------------------------------

func _field_xform() -> Transform2D:
	var s: float = minf(size.x / FIELD.x, (size.y - 130.0) / FIELD.y)
	var off := Vector2((size.x - FIELD.x * s) * 0.5, 56.0 + (size.y - 130.0 - FIELD.y * s) * 0.5)
	return Transform2D(Vector2(s, 0), Vector2(0, s), off + _fx.offset())

func _to_field(screen: Vector2) -> Vector2:
	var t := _field_xform()
	return (screen - t.origin) / t.x.x

# The grow grid sits in the middle of the field.
const CELL: float = 54.0
func _grid_origin() -> Vector2:
	return Vector2((FIELD.x - COLS * CELL) * 0.5, (FIELD.y - ROWS * CELL) * 0.5 + 10.0)

func _cell_center(c: Vector2i) -> Vector2:
	return _grid_origin() + (Vector2(c) + Vector2(0.5, 0.5)) * CELL

func _cell_at(fp: Vector2) -> Vector2i:
	var g: Vector2 = (fp - _grid_origin()) / CELL
	return Vector2i(int(floor(g.x)), int(floor(g.y)))

# --- Input ----------------------------------------------------------------

func _gui_input(event: InputEvent) -> void:
	if _select != null or _lv.is_empty():
		return
	var mb := event as InputEventMouseButton
	if mb != null and mb.button_index == MOUSE_BUTTON_LEFT:
		var fp := _to_field(mb.position)
		match _phase:
			Phase.PUTT:
				if mb.pressed and not _rolling and fp.distance_to(_seed) < 80.0:
					_dragging = true
					_drag_now = fp
				elif not mb.pressed and _dragging:
					_dragging = false
					_putt(fp)
			Phase.WATER:
				_set_rain(mb.pressed)
			Phase.GROW:
				if mb.pressed:
					_grow_to(_cell_at(fp))
		accept_event()
	var mm := event as InputEventMouseMotion
	if mm != null and _dragging:
		_drag_now = _to_field(mm.position)

func _input(event: InputEvent) -> void:
	# Space rains too (held, like the mouse).
	var k := event as InputEventKey
	if k == null or k.echo or _select != null:
		return
	if k.physical_keycode == KEY_SPACE and _phase == Phase.WATER:
		_set_rain(k.pressed)
		get_viewport().set_input_as_handled()
	# Arrow keys or WASD grow the stalk (read here, before focus navigation).
	elif k.pressed and _phase == Phase.GROW:
		var dir := Vector2i.ZERO
		match k.physical_keycode:
			KEY_UP, KEY_W: dir = Vector2i(0, -1)
			KEY_LEFT, KEY_A: dir = Vector2i(-1, 0)
			KEY_RIGHT, KEY_D: dir = Vector2i(1, 0)
			KEY_BACKSPACE, KEY_Z: _undo()
		if dir != Vector2i.ZERO:
			_grow_to(_path[-1] + dir)
		if dir != Vector2i.ZERO or k.physical_keycode in [KEY_BACKSPACE, KEY_Z]:
			get_viewport().set_input_as_handled()

# --- 1. Putt --------------------------------------------------------------

func _putt(fp: Vector2) -> void:
	var pull: Vector2 = _seed - fp
	if pull.length() < 12.0:
		return
	var power: float = clampf(pull.length() / MAX_PULL, 0.0, 1.0)
	_vel = pull.normalized() * power * MAX_SPEED
	_rolling = true
	_strokes += 1
	_last_rest = _seed
	Juice.sfx(self, "whoosh", 0.8 + power * 0.6)
	_fx.dust(_seed, Color(0.7, 0.85, 0.55), 6 + int(power * 8))
	_refresh_ui()

func _process(delta: float) -> void:
	_t += delta
	_msg_t -= delta
	_tip_pop = maxf(_tip_pop - delta * 4.0, 0.0)
	_fx.update(delta)
	if _rolling:
		for k: int in 6:
			if not _rolling:
				break
			_step(delta / 6.0)
		_trail.append(_seed)
		if _trail.size() > 14:
			_trail.remove_at(0)
	elif not _trail.is_empty():
		_trail.remove_at(0)
	if _sunk_t >= 0.0:
		_sunk_t += delta
		if _sunk_t > 1.1:
			_sunk_t = -1.0
			_begin_water()
	if _phase == Phase.WATER and _raining and not _watered:
		_water = minf(_water + float(CLOUDS[_cloud][3]) * delta, 1.0)
		if randf() < delta * 30.0:
			_fx.drops(_lv["cup"] + Vector2(randf_range(-40, 40), -120), Color(0.55, 0.78, 1.0), 1)
		if fmod(_t, 0.12) < delta:
			Juice.sfx(self, "rain", 1.0, -16.0)
		if _water >= 1.0:
			_set_rain(false)
		_refresh_ui()
	if _result_t > 0.0:
		_result_t += delta
	queue_redraw()

func _step(dt: float) -> void:
	# Hills and bowls: a push away from (or toward) each centre, strongest
	# halfway down the slope.
	for h: Array in _lv["hills"]:
		var d: Vector2 = _seed - (h[0] as Vector2)
		var r: float = float(h[1])
		var dl: float = d.length()
		if dl < r and dl > 0.5:
			var k: float = sin(dl / r * PI)
			_vel += d / dl * float(h[2]) * k * dt
	_vel += _wind * dt
	_vel *= pow(float(_cond[1]) if not _cond.is_empty() else ROLL_DRAG, dt)
	var next: Vector2 = _seed + _vel * dt
	# The fairway's curved edge: bounce off whichever segment it touches.
	var edge: Array = _lv["edge"]
	for i: int in edge.size():
		var a: Vector2 = edge[i]
		var b: Vector2 = edge[(i + 1) % edge.size()]
		var q: Vector2 = Geometry2D.get_closest_point_to_segment(next, a, b)
		if next.distance_to(q) < SEED_R:
			var n: Vector2 = (next - q).normalized()
			if n == Vector2.ZERO:
				n = (b - a).orthogonal().normalized()
			if _vel.dot(n) < 0.0:
				_vel = _vel.bounce(n) * 0.78
				_bump(q, _vel.length())
			next = q + n * SEED_R
	if not Geometry2D.is_point_in_polygon(next, PackedVector2Array(edge)):
		next = _seed
		_vel = -_vel * 0.5
	for bp: Array in _lv["bumpers"]:
		var c: Vector2 = bp[0]
		var r: float = float(bp[1]) + SEED_R
		if next.distance_to(c) < r:
			var n := (next - c).normalized()
			# Bumpers kick back a little harder than they were hit.
			_vel = _vel.bounce(n) * 1.1
			next = c + n * r
			_bump(c + n * float(bp[1]), _vel.length())
			_fx.ring(c, Color(1, 0.9, 0.4), float(bp[1]) * 2.2)
	for sp: Array in _lv.get("spinners", []):
		var c: Vector2 = sp[0]
		var half: Vector2 = Vector2.from_angle(_t * TAU * float(sp[2])) * float(sp[1]) * 0.5
		var q: Vector2 = Geometry2D.get_closest_point_to_segment(next, c - half, c + half)
		if next.distance_to(q) < SEED_R + 5.0:
			var n: Vector2 = (next - q).normalized()
			if n == Vector2.ZERO:
				n = half.orthogonal().normalized()
			# The bar swats the seed along with its own swing.
			var swing: Vector2 = half.orthogonal().normalized() * TAU * float(sp[2]) * (q - c).length() * signf((q - c).dot(half))
			_vel = _vel.bounce(n) * 0.8 + swing * 0.6
			next = q + n * (SEED_R + 5.0)
			_bump(q, _vel.length())
	_seed = next
	var cup: Vector2 = _lv["cup"]
	var dc: float = _seed.distance_to(cup)
	if dc < HOLE_R:
		if _vel.length() < SINK_SPEED:
			_sink()
			return
		# Too fast: it lips over the cup and is nudged aside.
		_vel = _vel.rotated(randf_range(-0.3, 0.3)) * 0.85
	for pd: Array in _lv["ponds"]:
		if _seed.distance_to(pd[0]) < float(pd[1]) - 4.0:
			Juice.sfx(self, "splash")
			_fx.drops(_seed, Color(0.5, 0.75, 1.0), 16)
			_fx.ring(_seed, Color(0.6, 0.85, 1.0), 60.0)
			_say("Splash! Back where you hit from, +1 stroke.")
			_strokes += 1
			_seed = _last_rest
			_vel = Vector2.ZERO
			_rolling = false
			_refresh_ui()
			return
	if _vel.length() < 9.0:
		_vel = Vector2.ZERO
		_rolling = false
		if _strokes >= int(_lv["par"]) + 4:
			_say("Out of strokes! The wind carries the seed into the cup (+2).")
			_strokes += 2
			_seed = cup
			_sink()
			return
		_refresh_ui()

func _bump(at: Vector2, speed: float) -> void:
	if speed > 90.0:
		Juice.sfx(self, "bonk", clampf(speed / 500.0, 0.6, 1.5), -10.0 + clampf(speed / 100.0, 0.0, 6.0))
		_fx.burst(at, Color(1, 1, 0.8), 5, speed * 0.3, 3.0, 200.0)

func _sink() -> void:
	_rolling = false
	_vel = Vector2.ZERO
	_seed = _lv["cup"]
	_sunk_t = 0.0
	var par: int = int(_lv["par"])
	var word: String = "HOLE IN ONE!!" if _strokes == 1 else ("UNDER PAR!" if _strokes < par else ("PAR!" if _strokes == par else "In the cup!"))
	Juice.sfx(self, "sink")
	if _strokes <= par:
		Juice.sfx(self, "fanfare", 1.0, -8.0)
		_fx.confetti(_seed, 50)
	_fx.burst(_seed, Color(1, 0.85, 0.3), 24, 380.0)
	_fx.ring(_seed, Color(1, 0.9, 0.5), 90.0, 0.7)
	_fx.text(_seed + Vector2(0, -60), word, Color(1, 0.85, 0.3), 40)
	_fx.shake(0.35)
	_refresh_ui()

# --- 2. Water -------------------------------------------------------------

func _begin_water() -> void:
	_phase = Phase.WATER
	_say("Pick a cloud below, then hold to rain. Let go in the GREEN band. Storms give more moves but grow thorns!", 6.0)
	Juice.sfx(self, "pop")
	_refresh_ui()

func _set_rain(on: bool) -> void:
	if _watered or _phase != Phase.WATER:
		return
	if on and not _raining:
		_raining = true
		Juice.sfx(self, "swish")
	elif not on and _raining:
		_raining = false
		if _water < 0.05:
			return
		_watered = true
		var lo: float = float(CLOUDS[_cloud][1])
		var hi: float = float(CLOUDS[_cloud][2])
		var mid: float = (lo + hi) * 0.5
		var inside: bool = _water >= lo and _water <= hi
		_water_score = 1.0 if inside else clampf(1.0 - (absf(_water - mid) - (hi - lo) * 0.5) * 3.0, 0.0, 1.0)
		var cup: Vector2 = _lv["cup"]
		if inside:
			_fx.text(cup + Vector2(0, -90), "PERFECT WATERING!", Color(0.5, 1.0, 0.6), 34)
			_fx.burst(cup, Color(0.5, 0.85, 1.0), 20, 300.0)
			Juice.sfx(self, "chime")
		else:
			_fx.text(cup + Vector2(0, -90), "Too dry..." if _water < float(CLOUDS[_cloud][1]) else "Soggy!", Color(1, 0.75, 0.4), 30)
			Juice.sfx(self, "error")
		get_tree().create_timer(1.1).timeout.connect(_begin_grow)

# --- 3. Grow --------------------------------------------------------------

func _find_seed() -> Vector2i:
	for y: int in ROWS:
		var x: int = _grid[y].find("S")
		if x >= 0:
			return Vector2i(x, y)
	return Vector2i(COLS / 2, ROWS - 1)

func _open(c: Vector2i) -> bool:
	return c.x >= 0 and c.x < COLS and c.y >= 0 and c.y < ROWS and _grid[c.y][c.x] != "#"

func _begin_grow() -> void:
	_phase = Phase.GROW
	_path = [_find_seed()]
	var bonus: int = 0
	if _strokes <= int(_lv["par"]):
		bonus += 1
	var cl: Array = CLOUDS[_cloud]
	if _water_score >= 0.99:
		bonus += int(cl[4])
		_sprout("+", int(cl[5]))
		_sprout("~", int(cl[6]))
	elif _cloud == 2 and _water > float(cl[2]):
		_sprout("~", 1)
	_moves_total = int(_lv["moves"]) + bonus
	_step_costs.clear()
	_moves_left = _moves_total
	var why: String = ""
	if bonus > 0:
		why = "  (+%d from your putt and rain)" % bonus
	_say("Grow up to the SUN! %d moves%s. %d root snip%s: click a rock next to the tip to clear it." % [_moves_total, why, _snips, "" if _snips == 1 else "s"], 7.0)
	Juice.sfx(self, "grow")
	_refresh_ui()

# Rain changes the soil: dew from steady rain, thorns from a storm, on open
# cells in the middle rows.
func _sprout(ch: String, n: int) -> void:
	var spots: Array[Vector2i] = []
	for y: int in range(2, ROWS - 2):
		for x: int in COLS:
			if _grid[y][x] == ".":
				spots.append(Vector2i(x, y))
	spots.shuffle()
	for i: int in mini(n, spots.size()):
		var c: Vector2i = spots[i]
		_grid[c.y] = _grid[c.y].substr(0, c.x) + ch + _grid[c.y].substr(c.x + 1)

func _snippable(c: Vector2i) -> bool:
	if _snips <= 0 or _moves_left <= 0 or _reached_sun or _path.is_empty():
		return false
	if c.x < 0 or c.x >= COLS or c.y < 0 or c.y >= ROWS or _grid[c.y][c.x] != "#":
		return false
	var d: Vector2i = c - _path[-1]
	return d == Vector2i(0, -1) or d == Vector2i(-1, 0) or d == Vector2i(1, 0)

func _can_grow(c: Vector2i) -> bool:
	if _moves_left <= 0 or _reached_sun or _path.is_empty():
		return false
	var tip: Vector2i = _path[-1]
	var d: Vector2i = c - tip
	if not (d == Vector2i(0, -1) or d == Vector2i(-1, 0) or d == Vector2i(1, 0)):
		return false
	return _open(c) and not _path.has(c) and _moves_left >= _cost(c)

func _cost(c: Vector2i) -> int:
	return 2 if _grid[c.y][c.x] == "~" else 1

func _grow_to(c: Vector2i) -> void:
	if _phase != Phase.GROW:
		return
	if _snippable(c):
		_snips -= 1
		_moves_left -= 1
		_grid[c.y] = _grid[c.y].substr(0, c.x) + "." + _grid[c.y].substr(c.x + 1)
		var sa: Vector2 = _cell_center(c)
		Juice.sfx(self, "bighit", 1.3, -8.0)
		_fx.burst(sa, Color(0.6, 0.6, 0.62), 16, 260.0)
		_fx.text(sa + Vector2(0, -36), "SNIP!", Color(0.9, 0.9, 0.95), 24)
		_fx.shake(0.2)
		_refresh_ui()
		return
	if not _can_grow(c):
		if _moves_left > 0 and not _reached_sun:
			Juice.sfx(self, "error", 1.0, -10.0)
			_fx.shake(0.15)
		return
	_path.append(c)
	var spent: int = _cost(c)
	if _grid[c.y][c.x] == "+":
		spent -= DEW_BACK
	_step_costs.append(spent)
	_moves_left -= spent
	_tip_pop = 1.0
	var at: Vector2 = _cell_center(c)
	if _grid[c.y][c.x] == "~":
		Juice.sfx(self, "hit", 1.4, -10.0)
		_fx.text(at + Vector2(0, -36), "Thorns! -2", Color(1, 0.5, 0.4), 22)
		_fx.shake(0.15)
	elif _grid[c.y][c.x] == "+":
		Juice.sfx(self, "plink")
		_fx.drops(at, Color(0.6, 0.85, 1.0), 12)
		_fx.text(at + Vector2(0, -36), "Dew! +%d moves" % DEW_BACK, Color(0.6, 0.85, 1.0), 22)
	Juice.sfx(self, "grow", 1.0 + 0.08 * float(ROWS - c.y))
	_fx.burst(at, Color(0.5, 0.95, 0.4), 8, 160.0, 4.0, 100.0)
	if _grid[c.y][c.x] == "*":
		_beams += 1
		Juice.sfx(self, "coin")
		_fx.burst(at, Color(1, 0.9, 0.3), 18, 260.0)
		_fx.text(at + Vector2(0, -40), "SUNBEAM!", Color(1, 0.9, 0.3), 26)
	if c.y == 0:
		_reached_sun = true
		Juice.sfx(self, "fanfare")
		_fx.confetti(at, 70)
		_fx.flash(Color(1, 0.95, 0.6, 0.45))
		_fx.text(at + Vector2(0, 40), "REACHED THE SUN!", Color(1, 0.85, 0.2), 42)
		get_tree().create_timer(1.0).timeout.connect(_finish)
	elif not _any_move():
		_say("Out of moves!" if _moves_left <= 0 else "Stuck! Undo to try another way, or Finish.", 3.0)
		get_tree().create_timer(0.8).timeout.connect(_finish)
	_refresh_ui()

func _any_move() -> bool:
	var tip: Vector2i = _path[-1]
	for d: Vector2i in [Vector2i(0, -1), Vector2i(-1, 0), Vector2i(1, 0)]:
		if _can_grow(tip + d):
			return true
	return false

func _undo() -> void:
	if _phase != Phase.GROW or _path.size() <= 1 or _reached_sun:
		return
	var c: Vector2i = _path.pop_back()
	if _grid[c.y][c.x] == "*":
		_beams -= 1
	_moves_left += int(_step_costs.pop_back()) if not _step_costs.is_empty() else 1
	Juice.sfx(self, "swish", 0.8)
	_refresh_ui()

# --- Grade ----------------------------------------------------------------

func _finish() -> void:
	if _phase != Phase.GROW:
		return
	var par: int = int(_lv["par"])
	var putt: float = clampf(30.0 - 6.0 * maxf(_strokes - par, 0) + (4.0 if _strokes < par else 0.0), 0.0, 32.0)
	var water: float = 20.0 * _water_score
	var tip: Vector2i = _path[-1]
	var height: float = float(ROWS - 1 - tip.y) / float(ROWS - 1)
	var grow: float = 30.0 * height + (8.0 if _reached_sun else 0.0) + 12.0 * float(_beams) / maxf(_beams_total, 1)
	var score: float = clampf(putt + water + grow, 0.0, 100.0)
	var rank: String = "F"
	for r: Array in [[90.0, "S"], [80.0, "A"], [68.0, "B"], [55.0, "C"], [40.0, "D"]]:
		if score >= float(r[0]):
			rank = r[1]
			break
	_result = {"putt": putt, "water": water, "grow": grow, "score": score, "rank": rank}
	_phase = Phase.DONE
	_result_t = 0.01
	Juice.sfx(self, "fanfare" if rank in ["S", "A"] else ("chime" if rank in ["B", "C"] else "lose"))
	if rank == "S":
		_fx.confetti(FIELD * Vector2(0.5, 0.2), 120, 600.0)
		_fx.shake(0.5)
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		var order := "FDCBAS"
		var prev = gc.record("golf", str(level_index))
		if prev == null or order.find(rank) > order.find(String(prev)):
			gc.set_record("golf", str(level_index), rank)
		gc.award_eco_points(int(score / 5.0))
	_refresh_ui()

# --- Drawing --------------------------------------------------------------

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.07, 0.1, 0.08))
	if _lv.is_empty() or _select != null:
		return
	draw_set_transform_matrix(_field_xform())
	if _phase in [Phase.PUTT, Phase.WATER] or (_phase == Phase.DONE and _path.is_empty()):
		_draw_course()
	else:
		_draw_grow()
	_fx.draw(self)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_fx.draw_flash(self, Rect2(Vector2.ZERO, size))
	_draw_overlays()

func _draw_course() -> void:
	draw_rect(Rect2(Vector2.ZERO, FIELD), Color(0.2, 0.32, 0.17))
	var edge := PackedVector2Array(_lv["edge"])
	# Fairway with a thick wooden rail.
	draw_colored_polygon(edge, Color(0.38, 0.62, 0.3))
	var closed := edge.duplicate()
	closed.append(edge[0])
	draw_polyline(closed, Color(0.45, 0.3, 0.16), 14.0, true)
	draw_polyline(closed, Color(0.62, 0.44, 0.24), 7.0, true)
	# Hills and bowls as contour rings: light rings are hills, dark are bowls.
	for h: Array in _lv["hills"]:
		var c: Vector2 = h[0]
		var r: float = float(h[1])
		var up: bool = float(h[2]) > 0.0
		for k: int in 5:
			var rr: float = r * (1.0 - k * 0.19)
			draw_circle(c, rr, Color(1, 1, 0.85, 0.07) if up else Color(0, 0.1, 0, 0.1))
		for k: int in 3:
			draw_arc(c, r * (0.35 + k * 0.25), 0, TAU, 40, Color(1, 1, 1, 0.12) if up else Color(0, 0, 0, 0.18), 2.0)
		# Little arrows showing which way it rolls.
		for k: int in 6:
			var a: float = k * TAU / 6.0 + _t * 0.3
			var dirv := Vector2.from_angle(a) * (1.0 if up else -1.0)
			var p: Vector2 = c + Vector2.from_angle(a) * r * 0.6
			draw_line(p - dirv * 8, p + dirv * 8, Color(1, 1, 0.8, 0.35), 2.0)
			draw_line(p + dirv * 8, p + dirv * 2 + dirv.orthogonal() * 5, Color(1, 1, 0.8, 0.35), 2.0)
	for pd: Array in _lv["ponds"]:
		draw_circle(pd[0], float(pd[1]) + 4, Color(0.55, 0.45, 0.3))
		draw_circle(pd[0], float(pd[1]), Color(0.25, 0.5, 0.8))
		draw_circle(pd[0], float(pd[1]) * (0.6 + 0.08 * sin(_t * 2.0)), Color(0.35, 0.62, 0.9))
	for bp: Array in _lv["bumpers"]:
		draw_circle(bp[0], float(bp[1]) + 3, Color(0.4, 0.25, 0.1))
		draw_circle(bp[0], float(bp[1]), Color(0.85, 0.55, 0.25))
		draw_circle((bp[0] as Vector2) + Vector2(-6, -6), float(bp[1]) * 0.4, Color(1, 0.8, 0.5))
	for sp: Array in _lv.get("spinners", []):
		var c: Vector2 = sp[0]
		var half: Vector2 = Vector2.from_angle(_t * TAU * float(sp[2])) * float(sp[1]) * 0.5
		draw_line(c - half, c + half, Color(0.35, 0.22, 0.1), 16.0)
		draw_line(c - half, c + half, Color(0.85, 0.6, 0.3), 9.0)
		draw_circle(c, 12.0, Color(0.95, 0.8, 0.4))
	if _wind != Vector2.ZERO:
		var wc := Vector2(FIELD.x - 80, 50)
		var wd: Vector2 = _wind.normalized()
		draw_circle(wc, 30, Color(0, 0, 0, 0.3))
		draw_line(wc - wd * 22, wc + wd * 22, Color(1, 1, 1, 0.9), 4.0)
		draw_line(wc + wd * 22, wc + wd * 10 + wd.orthogonal() * 8, Color(1, 1, 1, 0.9), 4.0)
		draw_line(wc + wd * 22, wc + wd * 10 - wd.orthogonal() * 8, Color(1, 1, 1, 0.9), 4.0)
	# The cup and its flag.
	var cup: Vector2 = _lv["cup"]
	draw_circle(cup, HOLE_R + 5, Color(0.25, 0.17, 0.08))
	draw_circle(cup, HOLE_R, Color(0.05, 0.03, 0.02))
	var wave: float = sin(_t * 4.0) * 6.0
	draw_line(cup, cup + Vector2(0, -80), Color(0.95, 0.95, 0.9), 3.0)
	draw_colored_polygon(PackedVector2Array([cup + Vector2(0, -80), cup + Vector2(40, -70 + wave), cup + Vector2(0, -58)]), Color(1, 0.35, 0.3))
	# The seed and its motion trail.
	for i: int in _trail.size():
		var a: float = float(i) / maxf(_trail.size(), 1)
		draw_circle(_trail[i], SEED_R * a, Color(1, 1, 0.8, 0.25 * a))
	if _phase == Phase.PUTT:
		var sq: float = 1.0 + 0.15 * sin(_t * 6.0) if not _rolling else 1.0
		draw_circle(_seed + Vector2(3, 5), SEED_R, Color(0, 0, 0, 0.25))
		draw_set_transform_matrix(_field_xform() * Transform2D(0.0, Vector2(sq, 1.0 / sq), 0.0, _seed))
		draw_circle(Vector2.ZERO, SEED_R, Color(0.6, 0.4, 0.2))
		draw_circle(Vector2(-3, -3), SEED_R * 0.35, Color(1, 1, 1, 0.45))
		draw_set_transform_matrix(_field_xform())
		if not _rolling and not _dragging and _strokes == 0:
			draw_arc(_seed, 26.0 + 6.0 * sin(_t * 5.0), 0, TAU, 24, Color(1, 1, 0.7, 0.6), 2.0)
	if _dragging:
		_draw_aim()
	if _phase == Phase.WATER or (_sunk_t < 0.0 and _phase != Phase.PUTT):
		_draw_seedling(cup, 0.3 + 0.4 * _water)
	if _phase == Phase.WATER:
		_draw_water_meter(cup)

# A dotted path showing the flick, and a power bar.
func _draw_aim() -> void:
	var pull: Vector2 = _seed - _drag_now
	var power: float = clampf(pull.length() / MAX_PULL, 0.0, 1.0)
	var dirv := pull.normalized()
	var col := Color(0.5, 1.0, 0.4).lerp(Color(1.0, 0.35, 0.25), power)
	for k: int in 10:
		draw_circle(_seed + dirv * (24.0 + k * 26.0 * (0.4 + power * 1.4)), 5.0 - k * 0.35, Color(col.r, col.g, col.b, 0.9 - k * 0.08))
	draw_line(_seed, _seed - dirv * minf(pull.length(), MAX_PULL), Color(1, 1, 1, 0.35), 3.0)
	var bar := Rect2(_seed + Vector2(-40, 26), Vector2(80, 10))
	draw_rect(bar, Color(0, 0, 0, 0.5))
	draw_rect(Rect2(bar.position, Vector2(80 * power, 10)), col)

func _draw_water_meter(cup: Vector2) -> void:
	# The rain cloud over the cup.
	var cc: Vector2 = cup + Vector2(0, -150)
	var puff: float = 1.0 + (0.06 * sin(_t * 10.0) if _raining else 0.0)
	for o: Vector2 in [Vector2(-34, 6), Vector2(0, -10), Vector2(34, 6), Vector2(0, 14)]:
		draw_circle(cc + o * puff, 32 * puff, Color(0.7, 0.75, 0.85) if _raining else Color(0.88, 0.92, 0.96))
	if _raining:
		for k: int in 10:
			var x: float = cc.x + (k - 4.5) * 9.0
			var y: float = cc.y + 30.0 + fmod(_t * 420.0 + k * 37.0, 110.0)
			draw_line(Vector2(x, y), Vector2(x - 2, y + 12), Color(0.6, 0.8, 1.0, 0.85), 2.0)
	# The tall meter beside it, with its green band.
	var m := Rect2(cup + Vector2(110, -200), Vector2(34, 220))
	draw_rect(m, Color(0, 0, 0, 0.55))
	var band_lo: float = m.end.y - m.size.y * float(CLOUDS[_cloud][1])
	var band_hi: float = m.end.y - m.size.y * float(CLOUDS[_cloud][2])
	draw_rect(Rect2(m.position.x, band_hi, m.size.x, band_lo - band_hi), Color(0.3, 0.9, 0.35, 0.45))
	var fill: float = m.size.y * _water
	var wc := Color(0.4, 0.7, 1.0)
	if _water > float(CLOUDS[_cloud][2]):
		wc = Color(0.3, 0.45, 0.95)
	draw_rect(Rect2(m.position.x + 4, m.end.y - fill, m.size.x - 8, fill), wc)
	draw_rect(m, Color(1, 1, 1, 0.8), false, 2.0)
	var font := FelecoUiScript.font("heading")
	draw_string(font, Vector2(m.end.x + 8, band_hi + 18), "GOOD", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.5, 1, 0.5))

func _draw_seedling(at: Vector2, grow: float) -> void:
	var h: float = 40.0 * grow
	draw_line(at, at + Vector2(0, -h), Color(0.3, 0.65, 0.2), 4.0)
	draw_circle(at + Vector2(-8, -h), 7.0 * grow + 2.0, Color(0.45, 0.8, 0.3))
	draw_circle(at + Vector2(8, -h + 4), 7.0 * grow + 2.0, Color(0.45, 0.8, 0.3))

func _draw_grow() -> void:
	# Sky up top, soil at the bottom, the sun waiting above the grid.
	for k: int in 16:
		var y: float = FIELD.y * k / 16.0
		draw_rect(Rect2(0, y, FIELD.x, FIELD.y / 16.0 + 1), Color(0.45, 0.7, 0.95).lerp(Color(0.3, 0.55, 0.3), float(k) / 16.0))
	var o := _grid_origin()
	var sun := Vector2(FIELD.x * 0.5, o.y - 2.0)
	for k: int in 12:
		var a: float = k * TAU / 12.0 + _t * 0.4
		draw_line(sun + Vector2.from_angle(a) * 46, sun + Vector2.from_angle(a) * (70 + 8 * sin(_t * 3.0 + k)), Color(1, 0.85, 0.3, 0.8), 4.0)
	draw_circle(sun, 40, Color(1, 0.85, 0.25))
	draw_circle(sun, 30, Color(1, 0.95, 0.55))
	var tip: Vector2i = _path[-1] if not _path.is_empty() else Vector2i(-1, -1)
	for y: int in ROWS:
		for x: int in COLS:
			var c := Vector2i(x, y)
			var r := Rect2(o + Vector2(x, y) * CELL, Vector2(CELL, CELL)).grow(-3)
			var ch: String = _grid[y][x]
			draw_rect(r, Color(0.32, 0.22, 0.12, 0.55) if y == ROWS - 1 else Color(1, 1, 1, 0.08))
			if ch == "#":
				draw_circle(r.get_center(), CELL * 0.4, Color(0.42, 0.42, 0.46))
				if _phase == Phase.GROW and _snippable(c):
					draw_arc(r.get_center(), CELL * 0.44, 0, TAU, 20, Color(1, 0.6, 0.3, 0.6 + 0.4 * sin(_t * 7.0)), 3.0)
				draw_circle(r.get_center() + Vector2(-8, -8), CELL * 0.18, Color(0.6, 0.6, 0.62))
			elif ch == "~" and not _path.has(c):
				var tc: Vector2 = r.get_center()
				for k: int in 6:
					var a: float = k * TAU / 6.0
					draw_line(tc, tc + Vector2.from_angle(a) * CELL * 0.36, Color(0.55, 0.25, 0.3), 3.0)
				draw_circle(tc, CELL * 0.14, Color(0.7, 0.3, 0.35))
			elif ch == "+" and not _path.has(c):
				var dc: Vector2 = r.get_center() + Vector2(0, sin(_t * 3.0 + x) * 2.0)
				draw_circle(dc, CELL * 0.22, Color(0.55, 0.8, 1.0, 0.9))
				draw_circle(dc + Vector2(-4, -4), CELL * 0.07, Color(1, 1, 1, 0.8))
			elif ch == "*" and not _path.has(c):
				var pulse: float = 0.6 + 0.4 * sin(_t * 5.0 + x + y)
				draw_circle(r.get_center(), CELL * 0.28 * pulse + 6, Color(1, 0.9, 0.35, 0.55))
				draw_circle(r.get_center(), CELL * 0.14, Color(1, 0.97, 0.7))
			if y == 0:
				draw_rect(r, Color(1, 0.9, 0.4, 0.12))
			if _phase == Phase.GROW and _can_grow(c):
				var a: float = 0.35 + 0.25 * sin(_t * 7.0)
				draw_rect(r, Color(0.6, 1.0, 0.5, a))
				draw_rect(r, Color(0.7, 1.0, 0.6), false, 3.0)
	# The stalk: a thick vine through every cell, with leaves.
	if _path.size() >= 1:
		var pts := PackedVector2Array()
		pts.append(_cell_center(_path[0]) + Vector2(0, CELL * 0.45))
		for c: Vector2i in _path:
			pts.append(_cell_center(c))
		draw_polyline(pts, Color(0.18, 0.42, 0.14), 16.0, true)
		draw_polyline(pts, Color(0.35, 0.7, 0.25), 10.0, true)
		for i: int in range(1, pts.size()):
			var side: float = -1.0 if i % 2 == 0 else 1.0
			var mid: Vector2 = pts[i - 1].lerp(pts[i], 0.5)
			var sway: float = sin(_t * 2.5 + i) * 3.0
			draw_set_transform_matrix(_field_xform() * Transform2D(side * 0.6, Vector2(1.0, 0.55), 0.0, mid + Vector2(side * 14 + sway, 0)))
			draw_circle(Vector2.ZERO, 11.0, Color(0.45, 0.82, 0.32))
			draw_set_transform_matrix(_field_xform())
		var tp: Vector2 = _cell_center(tip)
		draw_circle(tp, 12.0 + 8.0 * _tip_pop, Color(0.55, 0.95, 0.4))
		draw_circle(tp + Vector2(-3, -4), 4.0, Color(1, 1, 1, 0.6))

func _draw_overlays() -> void:
	var font := FelecoUiScript.font("heading")
	if _msg_t > 0.0:
		var a: float = clampf(_msg_t, 0.0, 1.0)
		draw_string_outline(font, Vector2(0, size.y - 86), _msg, HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, 6, Color(0, 0, 0, 0.7 * a))
		draw_string(font, Vector2(0, size.y - 86), _msg, HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color(1, 0.97, 0.85, a))
	if not _result.is_empty() and _result_t > 0.4:
		var k: float = clampf((_result_t - 0.4) / 0.35, 0.0, 1.0)
		var box := Rect2(size.x * 0.5 - 270, size.y * 0.5 - 160, 540, 280)
		draw_rect(box, Color(0.06, 0.09, 0.07, 0.94 * k))
		draw_rect(box, FelecoUiScript.GOLD, false, 3.0)
		var rank: String = _result["rank"]
		var rc: Color = {"S": Color(1, 0.85, 0.2), "A": Color(0.6, 1, 0.5), "B": Color(0.6, 0.85, 1), "C": Color(0.9, 0.9, 0.9), "D": Color(1, 0.7, 0.4), "F": Color(1, 0.4, 0.4)}[rank]
		# The grade slams in big and settles.
		var slam: float = 1.0 + (1.0 - k) * 1.5
		draw_string(font, box.position + Vector2(0, 104), rank, HORIZONTAL_ALIGNMENT_CENTER, box.size.x, int(100 * slam), rc)
		draw_string(font, box.position + Vector2(0, 160), "Score %d" % int(_result["score"]), HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 28, Color.WHITE)
		draw_string(font, box.position + Vector2(0, 205), "Putt %d/32   Water %d/20   Grow %d/50" % [int(_result["putt"]), int(_result["water"]), int(_result["grow"])], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 19, FelecoUiScript.MIST)
		draw_string(font, box.position + Vector2(0, 245), "Strokes %d (par %d)   Sunbeams %d/%d   %s" % [_strokes, _lv["par"], _beams, _beams_total, "Reached the sun!" if _reached_sun else "Didn't reach the sun"], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 16, FelecoUiScript.GOLD)

extends Control

# Producer campaign: Seedling Golf. A seed has to find the best spot to grow:
# good soil, water and light. Each hole is a little meadow puzzle played in
# three phases, all with the same slingshot flick:
#   1 PUTT   flick the seed into a planting hole (or plant where it rests)
#   2 WATER  flick raindrops from the cloud so they roll to the seedling
#   3 LIGHT  trim the leafy canopy shading it (a few snips only)
# Then it grows, and the spot is ranked F to S. "Sense" overlays show where
# the light, water and soil are good, because the best hole is rarely the
# easiest one to reach.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const FIELD := Vector2(1200, 640)
const SEED_R: float = 9.0
const HOLE_R: float = 16.0
const MAX_PULL: float = 240.0
const MAX_SPEED: float = 900.0
# Fraction of speed kept per second while rolling.
const ROLL_DRAG: float = 0.42
const SINK_SPEED: float = 330.0

# Hand-made holes, easy to hard. Positions are field pixels (1200 x 640).
# soil: [pos, radius, quality]; puddles: water and a hazard; shade: canopy
# blobs [pos, radius]; slopes: [rect, push]; walls: rects; rocks: [pos, r].
const LEVELS: Array = [
	{
		"name": "First Sprout", "par": 2, "drops": 3, "snips": 1,
		"tee": Vector2(150, 320), "cloud": Vector2(120, 80),
		"holes": [Vector2(760, 320), Vector2(1000, 160)],
		"soil": [[Vector2(1000, 160), 150, 1.0], [Vector2(760, 320), 120, 0.55]],
		"puddles": [[Vector2(1080, 300), 60]],
		"shade": [[Vector2(760, 300), 110]],
		"rocks": [], "walls": [], "slopes": [],
		"tip": "Drag back from the seed and let go to flick it. Use Sense to see which hole is best.",
	},
	{
		"name": "Rocky Rise", "par": 3, "drops": 3, "snips": 2,
		"tee": Vector2(120, 520), "cloud": Vector2(1080, 80),
		"holes": [Vector2(600, 520), Vector2(980, 420), Vector2(560, 150)],
		"soil": [[Vector2(560, 150), 140, 0.95], [Vector2(980, 420), 120, 0.7], [Vector2(600, 520), 90, 0.4]],
		"puddles": [[Vector2(760, 170), 70]],
		"shade": [[Vector2(560, 120), 120], [Vector2(980, 460), 100]],
		"rocks": [[Vector2(380, 380), 50], [Vector2(560, 300), 40], [Vector2(780, 420), 45]],
		"walls": [], "slopes": [],
		"tip": "Rocks bounce the seed. Bank shots count!",
	},
	{
		"name": "Brook Bend", "par": 3, "drops": 4, "snips": 2,
		"tee": Vector2(110, 120), "cloud": Vector2(600, 60),
		"holes": [Vector2(420, 520), Vector2(1050, 540), Vector2(900, 160)],
		"soil": [[Vector2(1050, 540), 130, 1.0], [Vector2(900, 160), 120, 0.75], [Vector2(420, 520), 120, 0.6]],
		"puddles": [[Vector2(640, 330), 90], [Vector2(760, 420), 70]],
		"shade": [[Vector2(1050, 560), 90], [Vector2(420, 500), 130]],
		"rocks": [[Vector2(300, 320), 40]],
		"walls": [], "slopes": [[Rect2(700, 470, 260, 140), Vector2(-160, 0)]],
		"tip": "Puddles drown the seed (one stroke back). Slopes (arrows) push it along.",
	},
	{
		"name": "Sun or Rain", "par": 3, "drops": 3, "snips": 3,
		"tee": Vector2(600, 600), "cloud": Vector2(600, 60),
		"holes": [Vector2(180, 160), Vector2(1020, 160), Vector2(600, 300)],
		"soil": [[Vector2(180, 160), 130, 0.9], [Vector2(1020, 160), 130, 0.9], [Vector2(600, 300), 120, 0.5]],
		"puddles": [[Vector2(120, 330), 80]],
		"shade": [[Vector2(180, 140), 140], [Vector2(240, 220), 90], [Vector2(600, 260), 70]],
		"rocks": [[Vector2(420, 420), 50], [Vector2(780, 420), 50]],
		"walls": [Rect2(560, 360, 80, 20)], "slopes": [],
		"tip": "One hole is wet but shady, one sunny but dry. Water and snips can fix one of them...",
	},
	{
		"name": "Hedge Maze", "par": 4, "drops": 4, "snips": 2,
		"tee": Vector2(90, 560), "cloud": Vector2(1100, 560),
		"holes": [Vector2(1100, 90), Vector2(340, 110), Vector2(820, 560)],
		"soil": [[Vector2(1100, 90), 130, 1.0], [Vector2(340, 110), 110, 0.7], [Vector2(820, 560), 100, 0.5]],
		"puddles": [[Vector2(980, 300), 60]],
		"shade": [[Vector2(1100, 70), 80], [Vector2(340, 90), 120]],
		"rocks": [[Vector2(640, 320), 36]],
		"walls": [Rect2(240, 220, 20, 420), Rect2(480, 0, 20, 420), Rect2(720, 220, 20, 420), Rect2(960, 0, 20, 220)],
		"slopes": [[Rect2(500, 460, 220, 180), Vector2(180, 0)]],
		"tip": "Hedges block the way. Plan your path.",
	},
	{
		"name": "Windy Ridge", "par": 4, "drops": 4, "snips": 3, "wind": Vector2(70, -30),
		"tee": Vector2(100, 320), "cloud": Vector2(100, 70),
		"holes": [Vector2(1110, 320), Vector2(700, 110), Vector2(700, 540)],
		"soil": [[Vector2(1110, 320), 120, 1.0], [Vector2(700, 110), 110, 0.8], [Vector2(700, 540), 110, 0.8]],
		"puddles": [[Vector2(900, 320), 80], [Vector2(450, 560), 60]],
		"shade": [[Vector2(1110, 300), 110], [Vector2(700, 90), 100], [Vector2(680, 560), 100], [Vector2(1050, 400), 80]],
		"rocks": [[Vector2(400, 220), 44], [Vector2(400, 420), 44], [Vector2(800, 220), 40]],
		"walls": [], "slopes": [[Rect2(950, 150, 140, 340), Vector2(0, 140)]],
		"tip": "The wind (top right) bends every flick.",
	},
]

enum Phase { PUTT, WATER, LIGHT, DONE }

var level_index: int = 0
var _lv: Dictionary = {}
var _phase: int = Phase.PUTT
var _seed: Vector2
var _vel: Vector2 = Vector2.ZERO
var _rolling: bool = false
var _last_rest: Vector2
var _strokes: int = 0
var _planted_at: Vector2 = Vector2(-1, -1)
var _in_hole: bool = false
var _drops_left: int = 0
var _water_given: float = 0.0
var _snips_left: int = 0
var _shade: Array = []
var _dragging: bool = false
var _drag_from: Vector2
var _drag_now: Vector2
var _sense: String = ""
var _grow_t: float = -1.0
var _result: Dictionary = {}
var _msg: String = ""
var _msg_t: float = 0.0
var _splashes: Array = []
var _hud: Label
var _phase_lbl: Label
var _buttons: HBoxContainer
var _plant_btn: Button
var _grow_btn: Button
var _sense_btns: Dictionary = {}
var _select: Control

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	# The game's look without the menu backdrop (the course is drawn here).
	theme = FelecoUiScript.theme()
	_build_ui()
	_show_select()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "golf"):
		HowToPlay.show(self, "golf")

# --- Level select ---------------------------------------------------------

func _show_select() -> void:
	if _select != null:
		_select.queue_free()
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
	var sub := FelecoUiScript.label("You are a seed. Find the spot with the best light, water and soil, then grow!", 20, FelecoUiScript.CREAM)
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
		b.pressed.connect(func() -> void: _start_level(idx))
		grid.add_child(b)
	var back := Button.new()
	back.text = "Back"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(200, 50)
	back.pressed.connect(_leave)
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "golf")
	bc.add_child(back)
	col.add_child(bc)

func _leave() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

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
	_hud = FelecoUiScript.label("", 17, FelecoUiScript.CREAM)
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
	for s: Array in [["light", "Sense Light"], ["water", "Sense Water"], ["soil", "Sense Soil"]]:
		var b := Button.new()
		b.text = s[1]
		b.toggle_mode = true
		b.custom_minimum_size = Vector2(150, 44)
		var key: String = s[0]
		b.toggled.connect(func(on: bool) -> void:
			_sense = key if on else ""
			for k: String in _sense_btns.keys():
				if k != key:
					(_sense_btns[k] as Button).set_pressed_no_signal(false)
			queue_redraw())
		_buttons.add_child(b)
		_sense_btns[key] = b
	_plant_btn = Button.new()
	_plant_btn.text = "Plant here"
	_plant_btn.theme_type_variation = "PrimaryButton"
	_plant_btn.custom_minimum_size = Vector2(150, 44)
	_plant_btn.pressed.connect(func() -> void: _plant(_seed, false))
	_buttons.add_child(_plant_btn)
	_grow_btn = Button.new()
	_grow_btn.text = "Next"
	_grow_btn.theme_type_variation = "PrimaryButton"
	_grow_btn.custom_minimum_size = Vector2(150, 44)
	_grow_btn.pressed.connect(_next_phase)
	_buttons.add_child(_grow_btn)
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
	level_index = i
	_lv = LEVELS[i]
	_phase = Phase.PUTT
	_seed = _lv["tee"]
	_last_rest = _seed
	_vel = Vector2.ZERO
	_rolling = false
	_strokes = 0
	_planted_at = Vector2(-1, -1)
	_in_hole = false
	_drops_left = int(_lv["drops"])
	_water_given = 0.0
	_snips_left = int(_lv["snips"])
	_shade = []
	for sh: Array in _lv["shade"]:
		_shade.append([sh[0], float(sh[1])])
	_grow_t = -1.0
	_result = {}
	_splashes.clear()
	_say(String(_lv["tip"]), 6.0)
	_refresh_ui()

func _say(text: String, secs: float = 2.5) -> void:
	_msg = text
	_msg_t = secs

func _refresh_ui() -> void:
	match _phase:
		Phase.PUTT:
			_phase_lbl.text = "Hole %d: %s  -  1. Putt" % [level_index + 1, _lv["name"]]
			_hud.text = "Strokes %d  (par %d)" % [_strokes, _lv["par"]]
		Phase.WATER:
			_phase_lbl.text = "2. Water: flick raindrops from the cloud"
			_hud.text = "Drops left %d   Water %d%%" % [_drops_left, int(_water_at(_planted_at) * 100)]
		Phase.LIGHT:
			_phase_lbl.text = "3. Light: tap the leafy shade to trim it"
			_hud.text = "Snips left %d   Light %d%%" % [_snips_left, int(_light_at(_planted_at) * 100)]
		Phase.DONE:
			_phase_lbl.text = "Grown!"
			_hud.text = ""
	_plant_btn.visible = _phase == Phase.PUTT and not _rolling and _strokes > 0
	_grow_btn.visible = _phase == Phase.WATER or _phase == Phase.LIGHT or _phase == Phase.DONE
	_grow_btn.text = {Phase.WATER: "Done watering", Phase.LIGHT: "Grow!", Phase.DONE: "Next hole"}.get(_phase, "Next")

# --- The field: what makes a spot good ------------------------------------

func _soil_at(p: Vector2) -> float:
	var q: float = 0.25
	for s: Array in _lv["soil"]:
		var d: float = p.distance_to(s[0])
		if d < float(s[1]):
			q = maxf(q, float(s[2]) * (1.0 - 0.4 * d / float(s[1])))
	return clampf(q, 0.0, 1.0)

# Ground water from nearby puddles, plus what the player rained on it.
func _ground_water_at(p: Vector2) -> float:
	var w: float = 0.15
	for pd: Array in _lv["puddles"]:
		var d: float = maxf(p.distance_to(pd[0]) - float(pd[1]), 0.0)
		w = maxf(w, 0.6 * (1.0 - clampf(d / 220.0, 0.0, 1.0)))
	return w

func _water_at(p: Vector2) -> float:
	return clampf(_ground_water_at(p) + (_water_given if p == _planted_at else 0.0), 0.0, 1.0)

func _light_at(p: Vector2) -> float:
	var shade: float = 0.0
	for sh: Array in _shade:
		var d: float = p.distance_to(sh[0])
		var r: float = float(sh[1])
		if d < r:
			shade += 0.75 * (1.0 - d / r * 0.6)
	return clampf(1.0 - shade, 0.05, 1.0)

func _in_puddle(p: Vector2) -> bool:
	for pd: Array in _lv["puddles"]:
		if p.distance_to(pd[0]) < float(pd[1]) - 6.0:
			return true
	return false

# --- Input ----------------------------------------------------------------

func _to_field(screen: Vector2) -> Vector2:
	var t := _field_xform()
	return (screen - t.origin) / t.x.x

func _field_xform() -> Transform2D:
	var s: float = minf(size.x / FIELD.x, (size.y - 130.0) / FIELD.y)
	var off := Vector2((size.x - FIELD.x * s) * 0.5, 56.0 + (size.y - 130.0 - FIELD.y * s) * 0.5)
	return Transform2D(Vector2(s, 0), Vector2(0, s), off)

func _flick_origin() -> Vector2:
	return _seed if _phase == Phase.PUTT else _lv["cloud"]

func _gui_input(event: InputEvent) -> void:
	if _select != null or _lv.is_empty():
		return
	var mb := event as InputEventMouseButton
	if mb != null and mb.button_index == MOUSE_BUTTON_LEFT:
		var fp := _to_field(mb.position)
		if mb.pressed:
			if _phase == Phase.LIGHT:
				_try_snip(fp)
				return
			if (_phase == Phase.PUTT and not _rolling) or (_phase == Phase.WATER and _drops_left > 0 and not _rolling):
				if fp.distance_to(_flick_origin()) < 70.0:
					_dragging = true
					_drag_from = _flick_origin()
					_drag_now = fp
		elif _dragging:
			_dragging = false
			_release(fp)
		queue_redraw()
	var mm := event as InputEventMouseMotion
	if mm != null:
		if _dragging:
			_drag_now = _to_field(mm.position)
		queue_redraw()

func _release(fp: Vector2) -> void:
	var pull: Vector2 = _drag_from - fp
	if pull.length() < 12.0:
		return
	var power: float = clampf(pull.length() / MAX_PULL, 0.0, 1.0)
	_vel = pull.normalized() * power * MAX_SPEED
	_rolling = true
	if _phase == Phase.PUTT:
		_strokes += 1
		_last_rest = _seed
	else:
		_drops_left -= 1
		_seed = _lv["cloud"]
	_refresh_ui()

func _try_snip(fp: Vector2) -> void:
	if _snips_left <= 0:
		_say("No snips left. Press Grow!")
		return
	for sh: Array in _shade:
		if fp.distance_to(sh[0]) < float(sh[1]) and float(sh[1]) > 20.0:
			sh[1] = float(sh[1]) * 0.55
			_snips_left -= 1
			_say("Snip! More light gets through.", 1.5)
			_refresh_ui()
			return

# --- Physics --------------------------------------------------------------

func _process(delta: float) -> void:
	_msg_t -= delta
	for s: Array in _splashes:
		s[1] -= delta
	_splashes = _splashes.filter(func(s: Array) -> bool: return s[1] > 0.0)
	if _grow_t >= 0.0 and _grow_t < 1.0:
		_grow_t = minf(_grow_t + delta * 0.5, 1.0)
	if _rolling:
		for k: int in 4:
			if not _rolling:
				break
			_step(delta / 4.0)
	queue_redraw()

func _step(dt: float) -> void:
	var wind: Vector2 = _lv.get("wind", Vector2.ZERO)
	_vel += wind * dt
	for sl: Array in _lv["slopes"]:
		if (sl[0] as Rect2).has_point(_seed):
			_vel += (sl[1] as Vector2) * dt
	_vel *= pow(ROLL_DRAG, dt)
	var next: Vector2 = _seed + _vel * dt
	# Field edges.
	if next.x < SEED_R or next.x > FIELD.x - SEED_R:
		_vel.x = -_vel.x * 0.7
		next.x = clampf(next.x, SEED_R, FIELD.x - SEED_R)
	if next.y < SEED_R or next.y > FIELD.y - SEED_R:
		_vel.y = -_vel.y * 0.7
		next.y = clampf(next.y, SEED_R, FIELD.y - SEED_R)
	for rk: Array in _lv["rocks"]:
		var c: Vector2 = rk[0]
		var r: float = float(rk[1]) + SEED_R
		if next.distance_to(c) < r:
			var n := (next - c).normalized()
			_vel = _vel.bounce(n) * 0.8
			next = c + n * r
	for w: Rect2 in _lv["walls"]:
		var g := w.grow(SEED_R)
		if g.has_point(next):
			# Bounce off whichever face it came through.
			if _seed.x <= g.position.x or _seed.x >= g.end.x:
				_vel.x = -_vel.x * 0.7
			else:
				_vel.y = -_vel.y * 0.7
			next = _seed
	_seed = next
	if _phase == Phase.PUTT:
		for h: Vector2 in _lv["holes"]:
			if _seed.distance_to(h) < HOLE_R and _vel.length() < SINK_SPEED:
				_seed = h
				_plant(h, true)
				return
		if _in_puddle(_seed):
			_splashes.append([_seed, 0.8])
			_say("Splash! The seed washes back. +1 stroke.")
			_strokes += 1
			_seed = _last_rest
			_vel = Vector2.ZERO
			_rolling = false
			_refresh_ui()
			return
	else:
		# A raindrop soaks in when it slows down; near the seedling it counts.
		if _vel.length() < 40.0 or _in_puddle(_seed):
			var d: float = _seed.distance_to(_planted_at)
			var got: float = clampf(1.0 - d / 70.0, 0.0, 1.0) * 0.18
			_water_given += got
			_splashes.append([_seed, 0.8])
			_say(("Splish! +%d%% water" % int(got * 100)) if got > 0.0 else "Missed. The drop soaks into the grass.", 1.5)
			_rolling = false
			_vel = Vector2.ZERO
			_refresh_ui()
			return
	if _vel.length() < 8.0:
		_vel = Vector2.ZERO
		_rolling = false
		if _phase == Phase.PUTT and _strokes >= int(_lv["par"]) + 3:
			_say("Out of strokes: the seed takes root where it lies.")
			_plant(_seed, false)
		_refresh_ui()

func _plant(at: Vector2, in_hole: bool) -> void:
	_planted_at = at
	_in_hole = in_hole
	_rolling = false
	_vel = Vector2.ZERO
	_phase = Phase.WATER
	_say("Planted%s! Now water it." % (" in a hole" if in_hole else ""), 2.5)
	_refresh_ui()

func _next_phase() -> void:
	match _phase:
		Phase.WATER:
			_phase = Phase.LIGHT
		Phase.LIGHT:
			_finish()
		Phase.DONE:
			if level_index + 1 < LEVELS.size():
				_start_level(level_index + 1)
			else:
				_show_select()
			return
	_refresh_ui()

func _finish() -> void:
	var light: float = _light_at(_planted_at)
	var water: float = _water_at(_planted_at)
	var soil: float = _soil_at(_planted_at)
	if not _in_hole:
		soil *= 0.7
	# A plant is only as strong as its weakest need.
	var balance: float = minf(light, minf(water, soil))
	var score: float = 100.0 * (0.25 * light + 0.25 * water + 0.25 * soil + 0.25 * balance)
	score -= maxf(_strokes - int(_lv["par"]), 0) * 4.0
	score += _snips_left * 2.0 + _drops_left * 2.0
	score = clampf(score, 0.0, 100.0)
	var rank: String = "F"
	for r: Array in [[92.0, "S"], [82.0, "A"], [70.0, "B"], [58.0, "C"], [45.0, "D"]]:
		if score >= float(r[0]):
			rank = r[1]
			break
	_result = {"light": light, "water": water, "soil": soil, "score": score, "rank": rank}
	_phase = Phase.DONE
	_grow_t = 0.0
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
	draw_rect(Rect2(Vector2.ZERO, FIELD), Color(0.36, 0.56, 0.27))
	# Mown stripes.
	for i: int in 12:
		draw_rect(Rect2(i * 100, 0, 50, FIELD.y), Color(1, 1, 1, 0.025))
	for s: Array in _lv["soil"]:
		draw_circle(s[0], float(s[1]), Color(0.32, 0.22, 0.12, 0.25 + 0.35 * float(s[2])))
	for sl: Array in _lv["slopes"]:
		var r: Rect2 = sl[0]
		draw_rect(r, Color(0.9, 0.85, 0.5, 0.12))
		var push: Vector2 = (sl[1] as Vector2).normalized()
		for k: int in 3:
			var c := r.position + r.size * Vector2(0.25 + 0.25 * k, 0.5)
			draw_line(c - push * 18, c + push * 18, Color(1, 1, 0.8, 0.5), 3.0)
			draw_line(c + push * 18, c + push * 8 + push.orthogonal() * 8, Color(1, 1, 0.8, 0.5), 3.0)
	for pd: Array in _lv["puddles"]:
		draw_circle(pd[0], float(pd[1]), Color(0.25, 0.5, 0.8))
		draw_circle(pd[0], float(pd[1]) * 0.7, Color(0.35, 0.62, 0.9))
	for w: Rect2 in _lv["walls"]:
		draw_rect(w, Color(0.18, 0.36, 0.16))
		draw_rect(w.grow(-4), Color(0.24, 0.46, 0.2))
	for rk: Array in _lv["rocks"]:
		draw_circle(rk[0], float(rk[1]), Color(0.45, 0.45, 0.48))
		draw_circle((rk[0] as Vector2) + Vector2(-8, -8), float(rk[1]) * 0.55, Color(0.58, 0.58, 0.6))
	for h: Vector2 in _lv["holes"]:
		draw_circle(h, HOLE_R + 4, Color(0.2, 0.13, 0.07))
		draw_circle(h, HOLE_R, Color(0.08, 0.05, 0.03))
	if not _sense.is_empty():
		_draw_sense()
	# Leafy canopy shade, drawn last on the ground so it darkens what's under it.
	for sh: Array in _shade:
		draw_circle(sh[0], float(sh[1]), Color(0.05, 0.18, 0.06, 0.45))
		for k: int in 6:
			var a: float = k * TAU / 6.0
			draw_circle((sh[0] as Vector2) + Vector2(cos(a), sin(a)) * float(sh[1]) * 0.6, float(sh[1]) * 0.35, Color(0.12, 0.32, 0.12, 0.35))
	# The rain cloud.
	if _phase == Phase.WATER:
		var c: Vector2 = _lv["cloud"]
		for o: Vector2 in [Vector2(-26, 4), Vector2(0, -8), Vector2(26, 4), Vector2(0, 10)]:
			draw_circle(c + o, 26, Color(0.85, 0.9, 0.95))
	for s: Array in _splashes:
		draw_arc(s[0], 30.0 * (1.0 - float(s[1])) + 6.0, 0, TAU, 24, Color(0.6, 0.8, 1.0, float(s[1])), 3.0)
	# The planted seedling (or the rolling seed / raindrop).
	if _planted_at.x >= 0.0:
		_draw_sprout(_planted_at)
	if _phase == Phase.PUTT or (_phase == Phase.WATER and _rolling):
		var col := Color(0.55, 0.36, 0.18) if _phase == Phase.PUTT else Color(0.45, 0.7, 1.0)
		draw_circle(_seed + Vector2(3, 4), SEED_R, Color(0, 0, 0, 0.25))
		draw_circle(_seed, SEED_R, col)
		draw_circle(_seed + Vector2(-3, -3), SEED_R * 0.35, Color(1, 1, 1, 0.4))
	if _dragging:
		var pull: Vector2 = _drag_from - _drag_now
		var power: float = clampf(pull.length() / MAX_PULL, 0.0, 1.0)
		var dirv := pull.normalized()
		for k: int in 8:
			draw_circle(_drag_from + dirv * (20.0 + k * 22.0 * power * 1.6), 4.0, Color(1, 1, 0.8, 0.8 - k * 0.09))
		draw_line(_drag_from, _drag_from - dirv * pull.length() * 0.5, Color(1, 0.9, 0.5, 0.6), 3.0)
	var wind: Vector2 = _lv.get("wind", Vector2.ZERO)
	if wind != Vector2.ZERO:
		var wc := Vector2(FIELD.x - 70, 40)
		draw_line(wc - wind.normalized() * 30, wc + wind.normalized() * 30, Color(1, 1, 1, 0.8), 4.0)
		draw_circle(wc + wind.normalized() * 30, 6, Color(1, 1, 1, 0.8))
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_draw_overlays()

func _draw_sense() -> void:
	var step: float = 40.0
	for gy: int in int(FIELD.y / step):
		for gx: int in int(FIELD.x / step):
			var p := Vector2(gx + 0.5, gy + 0.5) * step
			var v: float = 0.0
			var col := Color.WHITE
			match _sense:
				"light":
					v = _light_at(p)
					col = Color(1.0, 0.92, 0.3)
				"water":
					v = _ground_water_at(p)
					col = Color(0.3, 0.6, 1.0)
				"soil":
					v = _soil_at(p)
					col = Color(0.75, 0.45, 0.2)
			draw_rect(Rect2(p - Vector2(step, step) * 0.5, Vector2(step, step)), Color(col.r, col.g, col.b, v * 0.55))

func _draw_sprout(at: Vector2) -> void:
	var grow: float = 0.25 if _grow_t < 0.0 else lerpf(0.25, 1.0, _grow_t)
	var vigor: float = 0.5 if _result.is_empty() else clampf(float(_result["score"]) / 100.0, 0.2, 1.0)
	var h: float = 60.0 * grow * (0.5 + vigor)
	draw_line(at, at + Vector2(0, -h), Color(0.3, 0.65, 0.2), 5.0)
	for k: int in int(2 + 4 * grow * vigor):
		var y: float = -h * (0.3 + 0.7 * float(k) / 6.0)
		var side: float = -1.0 if k % 2 == 0 else 1.0
		draw_circle(at + Vector2(side * 12.0, y), 9.0 * grow, Color(0.35 + 0.2 * vigor, 0.75, 0.25))
	if _grow_t >= 1.0 and vigor > 0.8:
		draw_circle(at + Vector2(0, -h - 8), 10.0, Color(1.0, 0.85, 0.3))

func _draw_overlays() -> void:
	var font := FelecoUiScript.font("heading")
	if _msg_t > 0.0:
		var a: float = clampf(_msg_t, 0.0, 1.0)
		draw_string(font, Vector2(0, size.y - 92), _msg, HORIZONTAL_ALIGNMENT_CENTER, size.x, 22, Color(1, 0.97, 0.85, a))
	# A live readout under the pointer while sensing.
	if not _sense.is_empty():
		var fp := _to_field(get_local_mouse_position())
		var txt := "Light %d%%   Water %d%%   Soil %d%%" % [int(_light_at(fp) * 100), int(_ground_water_at(fp) * 100), int(_soil_at(fp) * 100)]
		draw_string(font, get_local_mouse_position() + Vector2(16, -12), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 1, 1))
	if not _result.is_empty() and _grow_t >= 1.0:
		var box := Rect2(size.x * 0.5 - 260, size.y * 0.5 - 150, 520, 260)
		draw_rect(box, Color(0.06, 0.09, 0.07, 0.94))
		draw_rect(box, FelecoUiScript.GOLD, false, 3.0)
		var rank: String = _result["rank"]
		var rc: Color = {"S": Color(1, 0.85, 0.2), "A": Color(0.6, 1, 0.5), "B": Color(0.6, 0.85, 1), "C": Color(0.9, 0.9, 0.9), "D": Color(1, 0.7, 0.4), "F": Color(1, 0.4, 0.4)}[rank]
		draw_string(font, box.position + Vector2(0, 90), rank, HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 96, rc)
		draw_string(font, box.position + Vector2(0, 150), "Score %d" % int(_result["score"]), HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 26, Color.WHITE)
		draw_string(font, box.position + Vector2(0, 195), "Light %d%%   Water %d%%   Soil %d%%   Strokes %d (par %d)" % [int(_result["light"] * 100), int(_result["water"] * 100), int(_result["soil"] * 100), _strokes, _lv["par"]], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 17, FelecoUiScript.MIST)
		draw_string(font, box.position + Vector2(0, 230), "The weakest of the three holds a plant back.", HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 15, FelecoUiScript.GOLD)

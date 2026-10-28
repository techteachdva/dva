extends Control

# Decomposer Mini-Game: Mycelium Sweep. A circular minesweeper under the
# meadow. The soil is a radar of five rings (2, 4, 8, 16 and 32 cells); the
# mycelium starts in the centre and spreads outward one cell at a time, only
# into cells touching what it already holds. Each cell hides:
#   CORPSE  nutrients (+NP), and mushrooms fruit there
#   DIRT    safe, nothing to eat
#   ROCK    a strike (three and the mat dies back)
# Every revealed cell shows how many rocks touch it (its neighbours in the
# ring, the cell inward and the two cells outward), and small mushroom
# dots for the corpses nearby, so the player can deduce the safe way AND
# choose between playing safe and chasing nutrients. Every level is
# generated, then checked by a deduction solver, so the outer ring can always
# be reached by logic alone, no guessing. Reach the outer ring to clear the
# level; keep digging for more nutrients, or finish.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const VIEW := Vector2(1280, 720)
const CENTER := Vector2(560, 384)
const RINGS: Array[int] = [2, 4, 8, 16, 32]
# Ring edges, inner to outer radius.
const RADII: Array[float] = [0.0, 60.0, 118.0, 180.0, 246.0, 316.0]
const MAX_STRIKES: int = 3
# [name, rocks, corpses]. More rocks every level.
const LEVELS: Array = [
	["First Threads", 5, 9],
	["Root Run", 8, 9],
	["Stony Ground", 11, 10],
	["Under the Oak", 14, 10],
	["Boulder Field", 17, 11],
	["The Deep Loam", 20, 11],
]
const NP_CORPSE: int = 10
enum K { DIRT, CORPSE, ROCK }

# Cells are indexed ring by ring: ring r starts at OFFSET[r].
var _offset: Array[int] = []
var _kind: Array[int] = []
var _open: Array[bool] = []
var _flag: Array[bool] = []
var _grow_t: Array[float] = []
var _from: Array[int] = []
var _level: int = 0
var _strikes: int = 0
var _np: int = 0
var _reached: bool = false
var _mode: String = "select"
var _flag_mode: bool = false
var _hover: int = -1
var _t: float = 0.0
var _jx := Juice.new()
var _select: Control
var _bar: HBoxContainer
var _flag_btn: Button
var _finish_btn: Button
var _result: Dictionary = {}
var _msg: String = ""
var _msg_t: float = 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = FelecoUiScript.theme()
	focus_mode = Control.FOCUS_ALL
	mouse_filter = Control.MOUSE_FILTER_STOP
	_jx.font = FelecoUiScript.font("heading")
	var o: int = 0
	for n: int in RINGS:
		_offset.append(o)
		o += n
	_build_bar()
	_show_select()
	if not HowToPlay.seen(self, "sweep"):
		HowToPlay.show(self, "sweep")

# --- Board geometry -----------------------------------------------------------

func _count() -> int:
	return _offset[-1] + RINGS[-1]

func _ring_of(i: int) -> int:
	for r: int in range(RINGS.size() - 1, -1, -1):
		if i >= _offset[r]:
			return r
	return 0

func _cell(r: int, k: int) -> int:
	return _offset[r] + posmod(k, RINGS[r])

# Same-ring neighbours, the parent inward and the two children outward.
func _neighbors(i: int) -> Array[int]:
	var r: int = _ring_of(i)
	var k: int = i - _offset[r]
	var out: Array[int] = []
	if RINGS[r] > 2:
		out.append(_cell(r, k - 1))
		out.append(_cell(r, k + 1))
	else:
		out.append(_cell(r, k + 1))
	if r > 0:
		out.append(_cell(r - 1, k / 2))
	if r + 1 < RINGS.size():
		out.append(_cell(r + 1, k * 2))
		out.append(_cell(r + 1, k * 2 + 1))
	return out

func _rocks_near(i: int) -> int:
	var n: int = 0
	for j: int in _neighbors(i):
		if _kind[j] == K.ROCK:
			n += 1
	return n

func _corpses_near(i: int) -> int:
	var n: int = 0
	for j: int in _neighbors(i):
		if _kind[j] == K.CORPSE and not _open[j]:
			n += 1
	return n

# A cell can be dug if it touches the mat (an open, safe cell).
func _frontier(i: int) -> bool:
	if _open[i]:
		return false
	for j: int in _neighbors(i):
		if _open[j] and _kind[j] != K.ROCK:
			return true
	return false

func _cell_mid(i: int) -> Vector2:
	var r: int = _ring_of(i)
	var k: int = i - _offset[r]
	var a: float = (float(k) + 0.5) / RINGS[r] * TAU - PI * 0.5
	var rad: float = (RADII[r] + RADII[r + 1]) * 0.5 if r > 0 else 30.0
	return CENTER + Vector2.from_angle(a) * rad

func _cell_at(p: Vector2) -> int:
	var d: Vector2 = p - CENTER
	var dist: float = d.length()
	for r: int in RINGS.size():
		if dist >= RADII[r] and dist < RADII[r + 1]:
			var a: float = fposmod(d.angle() + PI * 0.5, TAU)
			return _cell(r, int(a / TAU * RINGS[r]))
	return -1

# --- Levels -------------------------------------------------------------------

func _start(level: int) -> void:
	_level = level
	if _select != null:
		_select.queue_free()
		_select = null
	_bar.visible = true
	_strikes = 0
	_np = 0
	_reached = false
	_result = {}
	_flag_mode = false
	_flag_btn.set_pressed_no_signal(false)
	# Generate layouts until the solver can reach the outer ring by logic alone.
	for attempt: int in 400:
		_deal(int(LEVELS[level][1]), int(LEVELS[level][2]))
		if _solvable():
			break
	var n: int = _count()
	_open.assign([])
	_flag.assign([])
	_grow_t.assign([])
	_from.assign([])
	for i: int in n:
		_open.append(false)
		_flag.append(false)
		_grow_t.append(0.0)
		_from.append(-1)
	# The mat starts in the centre: both halves are open.
	for i: int in RINGS[0]:
		_open[i] = true
		_grow_t[i] = 0.01
		if _kind[i] == K.CORPSE:
			_np += NP_CORPSE
	_mode = "play"
	_say("Dig outward! Numbers count the ROCKS touching a cell. Reach the outer ring.", 5.0)
	_refresh_bar()
	grab_focus()

func _deal(rocks: int, corpses: int) -> void:
	var n: int = _count()
	_kind.assign([])
	for i: int in n:
		_kind.append(K.DIRT)
	var spots: Array[int] = []
	for i: int in range(RINGS[0], n):
		spots.append(i)
	spots.shuffle()
	for i: int in rocks:
		_kind[spots[i]] = K.ROCK
	for i: int in range(rocks, rocks + corpses):
		_kind[spots[i]] = K.CORPSE
	# The centre is always safe.
	for i: int in RINGS[0]:
		if _kind[i] == K.ROCK:
			_kind[i] = K.DIRT

# Deduction only (single-cell and subset rules), from the open centre:
# can the mat reach the outer ring without a guess?
func _solvable() -> bool:
	var n: int = _count()
	var open: Array[bool] = []
	var rock: Array[bool] = []
	for i: int in n:
		open.append(i < RINGS[0])
		rock.append(false)
	var changed: bool = true
	while changed:
		changed = false
		var safe: Dictionary = {}
		var cons: Array = []
		for i: int in n:
			if not open[i]:
				continue
			var unknown: Array[int] = []
			var need: int = _rocks_near(i)
			for j: int in _neighbors(i):
				if rock[j]:
					need -= 1
				elif not open[j]:
					unknown.append(j)
			if unknown.is_empty():
				continue
			if need == 0:
				for j: int in unknown:
					safe[j] = true
			elif need == unknown.size():
				for j: int in unknown:
					if not rock[j]:
						rock[j] = true
						changed = true
			else:
				cons.append([unknown, need])
		# Subset rule: if A's unknowns sit inside B's, B's extra cells hold the difference.
		for a: Array in cons:
			for b: Array in cons:
				if a == b:
					continue
				var ua: Array = a[0]
				var ub: Array = b[0]
				if ua.size() >= ub.size() or not ua.all(func(x: int) -> bool: return ub.has(x)):
					continue
				var extra: Array = ub.filter(func(x: int) -> bool: return not ua.has(x))
				var diff: int = int(b[1]) - int(a[1])
				if diff == 0:
					for j: int in extra:
						safe[j] = true
				elif diff == extra.size():
					for j: int in extra:
						if not rock[j]:
							rock[j] = true
							changed = true
		for j: int in safe.keys():
			if not open[j] and not rock[j]:
				open[j] = true
				changed = true
				if _ring_of(j) == RINGS.size() - 1:
					return true
	return false

# --- Play ---------------------------------------------------------------------

func _gui_input(event: InputEvent) -> void:
	if _mode != "play":
		return
	var mm := event as InputEventMouseMotion
	if mm != null:
		_hover = _cell_at(_to_view(mm.position))
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed:
		return
	var i: int = _cell_at(_to_view(mb.position))
	if i < 0:
		return
	accept_event()
	if mb.button_index == MOUSE_BUTTON_RIGHT or (mb.button_index == MOUSE_BUTTON_LEFT and _flag_mode):
		if not _open[i]:
			_flag[i] = not _flag[i]
			Juice.sfx(self, "click")
		return
	if mb.button_index == MOUSE_BUTTON_LEFT:
		_dig(i)

func _dig(i: int) -> void:
	if _open[i] or _flag[i]:
		return
	if not _frontier(i):
		Juice.sfx(self, "error", 1.0, -12.0)
		_say("The mycelium can only spread to cells touching it.", 2.0)
		return
	_open[i] = true
	_grow_t[i] = 0.01
	for j: int in _neighbors(i):
		if _open[j] and _kind[j] != K.ROCK and _ring_of(j) <= _ring_of(i):
			_from[i] = j
			break
	var at: Vector2 = _cell_mid(i)
	match _kind[i]:
		K.ROCK:
			_strikes += 1
			Juice.sfx(self, "bighit")
			_jx.burst(at, Color(0.6, 0.6, 0.65), 20, 300.0)
			_jx.ring(at, Color(1, 0.4, 0.3), 70.0)
			_jx.text(at + Vector2(0, -30), "ROCK!  Strike %d" % _strikes, Color(1, 0.45, 0.35), 28)
			_jx.shake(0.45)
			_jx.flash(Color(1, 0.3, 0.2, 0.25))
			if _strikes >= MAX_STRIKES:
				_end(false)
				return
		K.CORPSE:
			_np += NP_CORPSE
			Juice.sfx(self, "coin")
			Juice.sfx(self, "grow", 1.2, -10.0)
			_jx.burst(at, Color(0.95, 0.85, 0.6), 16, 220.0, 4.0, 60.0)
			_jx.text(at + Vector2(0, -30), "+%d NP" % NP_CORPSE, Color(0.95, 0.9, 0.6), 26)
		_:
			Juice.sfx(self, "plink", 0.9 + 0.1 * _ring_of(i), -8.0)
			_jx.dust(at, Color(0.7, 0.6, 0.45), 6)
	if _kind[i] != K.ROCK and _ring_of(i) == RINGS.size() - 1 and not _reached:
		_reached = true
		Juice.sfx(self, "fanfare")
		_jx.confetti(at, 50)
		_jx.text(CENTER + Vector2(0, -RADII[-1] - 20), "REACHED THE EDGE! Level cleared", FelecoUiScript.GOLD, 34)
		_say("Cleared! Keep digging for nutrients, or press Finish.", 5.0)
	_refresh_bar()

func _end(won: bool) -> void:
	_mode = "done"
	var possible: int = int(LEVELS[_level][2]) * NP_CORPSE
	var frac: float = float(_np) / maxf(possible, 1.0)
	var grade: String = "F"
	if won:
		grade = "C"
		if frac >= 0.5:
			grade = "B"
		if frac >= 0.75 and _strikes <= 1:
			grade = "A"
		if frac >= 0.9 and _strikes == 0:
			grade = "S"
	_result = {"won": won, "grade": grade, "np": _np, "possible": possible}
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and won:
		var order := "FCBAS"
		var prev = gc.record("sweep", str(_level))
		if prev == null or order.find(grade) > order.find(String(prev)):
			gc.set_record("sweep", str(_level), grade)
		gc.award_eco_points(10 + _np / 5)
	if won:
		Juice.sfx(self, "fanfare" if grade in ["S", "A"] else "chime")
		if grade == "S":
			_jx.confetti(CENTER, 120, 600.0)
	else:
		Juice.sfx(self, "lose")
		# Show every rock once it's over.
		for i: int in _count():
			if _kind[i] == K.ROCK:
				_open[i] = true
	_refresh_bar()

func _say(text: String, secs: float = 2.5) -> void:
	_msg = text
	_msg_t = secs

func _process(delta: float) -> void:
	_t += delta
	_msg_t -= delta
	_jx.update(delta)
	for i: int in _grow_t.size():
		if _grow_t[i] > 0.0 and _grow_t[i] < 1.0:
			_grow_t[i] = minf(_grow_t[i] + delta * 2.2, 1.0)
	queue_redraw()

func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo:
		return
	if k.physical_keycode == KEY_ESCAPE:
		if _select != null:
			_leave()
		else:
			_show_select()
	elif k.physical_keycode == KEY_F and _mode == "play":
		_flag_mode = not _flag_mode
		_flag_btn.set_pressed_no_signal(_flag_mode)

# --- UI -----------------------------------------------------------------------

func _leave() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

func _build_bar() -> void:
	_bar = HBoxContainer.new()
	_bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_bar.offset_top = -60
	_bar.offset_bottom = -8
	_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	_bar.add_theme_constant_override("separation", 10)
	add_child(_bar)
	_flag_btn = Button.new()
	_flag_btn.text = "Flag mode (F)"
	_flag_btn.toggle_mode = true
	_flag_btn.tooltip_text = "Mark cells you think are rock. Right-click flags too."
	_flag_btn.custom_minimum_size = Vector2(170, 44)
	_flag_btn.toggled.connect(func(on: bool) -> void: _flag_mode = on)
	_bar.add_child(_flag_btn)
	_finish_btn = Button.new()
	_finish_btn.theme_type_variation = "PrimaryButton"
	_finish_btn.custom_minimum_size = Vector2(170, 44)
	_finish_btn.pressed.connect(func() -> void:
		if _mode == "play" and _reached:
			_end(true)
		elif _mode == "done":
			if bool(_result.get("won", false)) and _level + 1 < LEVELS.size():
				_start(_level + 1)
			else:
				_start(_level))
	_bar.add_child(_finish_btn)
	for b: Array in [["Restart", func() -> void: _start(_level)], ["Levels", _show_select]]:
		var btn := Button.new()
		btn.text = b[0]
		btn.theme_type_variation = "GhostButton"
		btn.custom_minimum_size = Vector2(120, 44)
		btn.pressed.connect(b[1])
		_bar.add_child(btn)

func _refresh_bar() -> void:
	_finish_btn.visible = (_mode == "play" and _reached) or _mode == "done"
	if _mode == "done":
		var won: bool = bool(_result.get("won", false))
		_finish_btn.text = "Next level" if won and _level + 1 < LEVELS.size() else ("Play again" if won else "Try again")
	else:
		_finish_btn.text = "Finish"
	_flag_btn.visible = _mode == "play"

func _show_select() -> void:
	_mode = "select"
	_bar.visible = false
	if _select != null:
		_select.queue_free()
	_select = PanelContainer.new()
	_select.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_select)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 14)
	_select.add_child(col)
	var t := FelecoUiScript.heading("Mycelium Sweep", 46, FelecoUiScript.GOLD)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var sub := FelecoUiScript.label("Grow your mycelium out from the centre. Numbers show how many ROCKS touch a cell. Find the corpses, dodge the rocks, reach the edge. Three rocks and you're out.", 19, FelecoUiScript.CREAM)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(900, 0)
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
		var best = gc.record("sweep", str(i)) if gc != null else null
		var unlocked: bool = i == 0 or (gc != null and gc.record("sweep", str(i - 1)) != null)
		var b := Button.new()
		b.custom_minimum_size = Vector2(300, 84)
		b.text = "%d. %s  (%d rocks)\n%s" % [i + 1, LEVELS[i][0], LEVELS[i][1], ("Best: " + str(best)) if best != null else ("Play" if unlocked else "Locked")]
		b.disabled = not unlocked
		b.theme_type_variation = "TouchButton"
		var idx := i
		b.pressed.connect(func() -> void:
			Juice.sfx(self, "click")
			_start(idx))
		grid.add_child(b)
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "sweep")
	var back := Button.new()
	back.text = "Back to Mini-Games"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(220, 48)
	back.pressed.connect(_leave)
	bc.add_child(back)
	col.add_child(bc)

# --- Drawing ------------------------------------------------------------------

func _xform() -> Transform2D:
	var s: float = minf(size.x / VIEW.x, size.y / VIEW.y)
	return Transform2D(Vector2(s, 0), Vector2(0, s), (size - VIEW * s) * 0.5 + _jx.offset())

func _to_view(p: Vector2) -> Vector2:
	var t := _xform()
	return (p - t.origin) / t.x.x

# A cell's wedge outline.
func _wedge(i: int, grow: float = 0.0) -> PackedVector2Array:
	var r: int = _ring_of(i)
	var k: int = i - _offset[r]
	var a0: float = float(k) / RINGS[r] * TAU - PI * 0.5
	var a1: float = float(k + 1) / RINGS[r] * TAU - PI * 0.5
	var r0: float = RADII[r] + 2.0 - grow
	var r1: float = RADII[r + 1] - 2.0 + grow
	var pts := PackedVector2Array()
	var steps: int = maxi(4, 48 / RINGS[r])
	for s: int in steps + 1:
		pts.append(CENTER + Vector2.from_angle(lerpf(a0, a1, float(s) / steps)) * r1)
	for s: int in range(steps, -1, -1):
		pts.append(CENTER + Vector2.from_angle(lerpf(a0, a1, float(s) / steps)) * maxf(r0, 0.0))
	return pts

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.05, 0.04))
	if _select != null or _kind.is_empty():
		return
	draw_set_transform_matrix(_xform())
	var font := FelecoUiScript.font("heading")
	# The soil disc, a radar of rings and spokes.
	draw_circle(CENTER, RADII[-1] + 14, Color(0.18, 0.13, 0.09))
	draw_circle(CENTER, RADII[-1], Color(0.24, 0.18, 0.12))
	for i: int in _count():
		var w := _wedge(i)
		if _open[i]:
			var col: Color = Color(0.3, 0.24, 0.16)
			if _kind[i] == K.ROCK:
				col = Color(0.33, 0.33, 0.36)
			elif _kind[i] == K.CORPSE:
				col = Color(0.36, 0.26, 0.16)
			draw_colored_polygon(w, col)
		else:
			var dark := Color(0.2, 0.15, 0.1)
			if _mode == "play" and _frontier(i):
				# The growing edge glows faintly; the hovered cell brightly.
				var g: float = 0.08 + 0.05 * sin(_t * 4.0 + i)
				dark = dark.lerp(Color(0.9, 0.9, 0.75), g + (0.18 if i == _hover else 0.0))
			draw_colored_polygon(w, dark)
		draw_polyline(w, Color(0.45, 0.62, 0.45, 0.22), 1.5, true)
	for r: int in range(1, RADII.size()):
		draw_arc(CENTER, RADII[r], 0, TAU, 96, Color(0.5, 0.8, 0.5, 0.3), 1.5)
	# The mycelium: white threads from each open cell back to where it grew from.
	for i: int in _count():
		if not _open[i] or _kind[i] == K.ROCK:
			continue
		var at: Vector2 = _cell_mid(i)
		var src: Vector2 = CENTER if _from[i] < 0 else _cell_mid(_from[i])
		var g: float = _grow_t[i]
		var tip: Vector2 = src.lerp(at, g)
		var mid: Vector2 = src.lerp(tip, 0.5) + (tip - src).orthogonal().normalized() * 8.0 * sin(i * 1.7)
		draw_polyline(PackedVector2Array([src, mid, tip]), Color(0.95, 0.94, 0.88, 0.85), 2.5, true)
		# Little side hyphae.
		for h: int in 3:
			var hp: Vector2 = src.lerp(tip, 0.3 + 0.25 * h)
			var hd: Vector2 = Vector2.from_angle(i * 2.3 + h * 1.9) * 12.0 * g
			draw_line(hp, hp + hd, Color(0.92, 0.9, 0.84, 0.5), 1.2, true)
	# Cell contents and numbers.
	for i: int in _count():
		var at: Vector2 = _cell_mid(i)
		var ring: int = _ring_of(i)
		var sz: float = [16.0, 15.0, 13.0, 11.0, 9.0][ring]
		if _open[i]:
			match _kind[i]:
				K.ROCK:
					draw_circle(at, sz, Color(0.5, 0.5, 0.54))
					draw_circle(at + Vector2(-sz * 0.3, -sz * 0.3), sz * 0.4, Color(0.66, 0.66, 0.7))
					draw_line(at + Vector2(-sz * 0.5, 0), at + Vector2(sz * 0.4, sz * 0.3), Color(0.25, 0.25, 0.28), 2.0)
				K.CORPSE:
					# Bones, and mushrooms fruiting on them.
					draw_line(at + Vector2(-sz, sz * 0.5), at + Vector2(sz, sz * 0.5), Color(0.92, 0.88, 0.78), 3.0)
					var g: float = _grow_t[i]
					for m: int in 2:
						var mp: Vector2 = at + Vector2((m - 0.5) * sz * 1.1, sz * 0.4)
						var hgt: float = sz * 1.1 * g
						draw_line(mp, mp + Vector2(0, -hgt), Color(0.95, 0.92, 0.85), 3.0)
						draw_circle(mp + Vector2(0, -hgt), sz * 0.55 * g, Color(0.85, 0.3, 0.25) if m == 0 else Color(0.9, 0.7, 0.35))
						draw_circle(mp + Vector2(-2, -hgt - 2), sz * 0.15 * g, Color(1, 1, 1, 0.8))
			if _kind[i] != K.ROCK:
				var n: int = _rocks_near(i)
				if n > 0:
					var nc: Color = [Color.WHITE, Color(0.55, 0.85, 1.0), Color(0.6, 1.0, 0.55), Color(1.0, 0.85, 0.35), Color(1.0, 0.55, 0.35), Color(1.0, 0.35, 0.4)][mini(n, 5)]
					var fs: int = int(sz * 1.9)
					draw_string_outline(font, at + Vector2(-30, fs * 0.36 - (sz * 0.6 if _kind[i] == K.CORPSE else 0.0)), str(n), HORIZONTAL_ALIGNMENT_CENTER, 60, fs, 5, Color(0, 0, 0, 0.85))
					draw_string(font, at + Vector2(-30, fs * 0.36 - (sz * 0.6 if _kind[i] == K.CORPSE else 0.0)), str(n), HORIZONTAL_ALIGNMENT_CENTER, 60, fs, nc)
				# Corpse scent: tiny mushroom dots for unopened corpses nearby.
				var c: int = _corpses_near(i)
				for d: int in c:
					draw_circle(at + Vector2((d - (c - 1) * 0.5) * 7.0, sz * 1.15), 3.0, Color(0.95, 0.8, 0.5, 0.9))
		elif _flag[i]:
			draw_line(at + Vector2(0, sz * 0.8), at + Vector2(0, -sz * 0.8), Color(0.9, 0.9, 0.85), 2.0)
			draw_colored_polygon(PackedVector2Array([at + Vector2(0, -sz * 0.8), at + Vector2(sz, -sz * 0.4), at + Vector2(0, 0)]), Color(1, 0.4, 0.3))
	_jx.draw(self)
	_draw_hud(font)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_jx.draw_flash(self, Rect2(Vector2.ZERO, size))

func _draw_hud(font: Font) -> void:
	var x: float = 940.0
	draw_string(font, Vector2(x, 70), "Level %d: %s" % [_level + 1, LEVELS[_level][0]], HORIZONTAL_ALIGNMENT_LEFT, 320, 26, FelecoUiScript.GOLD)
	draw_string(font, Vector2(x, 118), "Nutrients  %d NP" % _np, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(0.95, 0.9, 0.6))
	draw_string(font, Vector2(x, 160), "Strikes", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)
	for s: int in MAX_STRIKES:
		var c := Vector2(x + 110 + s * 36, 152)
		draw_circle(c, 13, Color(0, 0, 0, 0.4))
		draw_circle(c, 10, Color(1, 0.35, 0.3) if s < _strikes else Color(0.45, 0.75, 0.45))
	draw_string(font, Vector2(x, 200), "Rocks hidden: %d" % int(LEVELS[_level][1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, FelecoUiScript.MIST)
	var tips: Array[String] = ["Click a glowing cell next to your", "mycelium to grow into it.", "", "A number = rocks touching it", "(sides, inward, the two outward).", "Mushroom dots = corpses nearby.", "", "Right-click or F: flag a rock.", "Reach the outer ring to clear."]
	for k: int in tips.size():
		draw_string(font, Vector2(x, 250 + k * 26), tips[k], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1, 1, 1, 0.7))
	if _msg_t > 0.0:
		var a: float = clampf(_msg_t, 0.0, 1.0)
		draw_string_outline(font, Vector2(0, 40), _msg, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 22, 6, Color(0, 0, 0, 0.8 * a))
		draw_string(font, Vector2(0, 40), _msg, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 22, Color(1, 0.97, 0.85, a))
	if not _result.is_empty():
		var box := Rect2(CENTER - Vector2(200, 90), Vector2(400, 180))
		draw_rect(box, Color(0.06, 0.09, 0.07, 0.95))
		draw_rect(box, FelecoUiScript.GOLD, false, 3.0)
		var won: bool = _result["won"]
		draw_string(font, box.position + Vector2(0, 70), _result["grade"] if won else "The mat died back", HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 64 if won else 30, FelecoUiScript.GOLD if won else Color(1, 0.5, 0.4))
		draw_string(font, box.position + Vector2(0, 120), "%d of %d NP   Strikes %d" % [_result["np"], _result["possible"], _strikes], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 22, Color.WHITE)
		draw_string(font, box.position + Vector2(0, 155), "All corpses with no strikes = S", HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 16, FelecoUiScript.MIST)

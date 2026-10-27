extends Control

# Omnivore campaign: Valley Dominion. FelEco within FelEco: the valley as a
# board of tiles, four omnivore clans racing to hold the most of it before
# winter. Each turn every tile grows food by its terrain and the season,
# clans grow or starve on it, and you spend moves to spread into the wild
# or take tiles from rivals. Twelve turns (spring, summer, autumn); when
# winter comes, the clan holding the most tiles rules the valley.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const W: int = 14
const H: int = 9
const TURNS: int = 12
const MOVES: int = 3
enum T { MEADOW, FOREST, RIVER, ROCK }
const T_NAME: Array[String] = ["Meadow", "Forest", "River", "Rock"]
const T_COLOR: Array[Color] = [Color(0.45, 0.66, 0.32), Color(0.2, 0.42, 0.2), Color(0.3, 0.55, 0.82), Color(0.48, 0.47, 0.5)]
# Food per tile by season (spring, summer, autumn).
const FOOD: Array = [[3, 2, 1], [1, 3, 3], [2, 2, 2], [0, 0, 0]]

const CLANS: Dictionary = {
	"human": {"name": "Humans", "color": Color(0.95, 0.75, 0.3), "power": "Build Hut", "about": "Build Hut: a tile you hold gets +3 clan and is twice as hard to take."},
	"bear": {"name": "Bears", "color": Color(0.55, 0.36, 0.22), "power": "Maul", "about": "Maul: your next attack this turn hits 50% harder."},
	"boar": {"name": "Boars", "color": Color(0.85, 0.35, 0.3), "power": "Stampede", "about": "Stampede: two extra moves this turn."},
	"robin": {"name": "Robins", "color": Color(0.55, 0.75, 1.0), "power": "Seed Flight", "about": "Seed Flight: claim any empty tile up to 3 away."},
}
const CORNERS: Array = [Vector2i(1, 1), Vector2i(W - 2, H - 2), Vector2i(W - 2, 1), Vector2i(1, H - 2)]

var _terrain: Array = []
var _owner: Array = []
var _pop: Array = []
var _hut: Array = []
var _clans: Array[String] = []
var _player: String = ""
var _turn: int = 0
var _moves: int = 0
var _power_used: bool = false
var _maul: bool = false
var _seed_flight: bool = false
var _sel := Vector2i(-1, -1)
var _log: Array[String] = []
var _mode: String = "select"
var _select: Control
var _side: VBoxContainer
var _status: Label
var _log_lbl: Label
var _coach_lbl: Label
var _end_btn: Button
var _power_btn: Button
var _hover := Vector2i(-1, -1)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = FelecoUiScript.theme()
	_show_select()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "dominion"):
		HowToPlay.show(self, "dominion")

func _show_select() -> void:
	_mode = "select"
	if _select != null:
		_select.queue_free()
	_select = PanelContainer.new()
	_select.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_select)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 14)
	_select.add_child(col)
	var t := FelecoUiScript.heading("Valley Dominion", 48, FelecoUiScript.GOLD)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var sub := FelecoUiScript.label("Four omnivore clans. Twelve turns. Hold the most of the valley when winter comes.", 20, FelecoUiScript.CREAM)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(sub)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	col.add_child(row)
	var gc: Node = get_node_or_null("/root/GameConfig")
	for id: String in CLANS.keys():
		var c: Dictionary = CLANS[id]
		var card := VBoxContainer.new()
		card.custom_minimum_size = Vector2(260, 0)
		row.add_child(card)
		var pic := TextureRect.new()
		pic.texture = preload("res://scripts/minigames/predator_brawl.gd").portrait(id)
		pic.custom_minimum_size = Vector2(260, 140)
		pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		card.add_child(pic)
		var won = gc.record("dominion", id) if gc != null else null
		card.add_child(FelecoUiScript.heading(c["name"] + ("  (Ruled!)" if won != null else ""), 22, c["color"]))
		var about := FelecoUiScript.label(c["about"], 15, FelecoUiScript.MIST)
		about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		card.add_child(about)
		var b := Button.new()
		b.text = "Lead the %s" % c["name"]
		b.theme_type_variation = "PrimaryButton"
		b.custom_minimum_size = Vector2(0, 48)
		b.pressed.connect(func() -> void: _start(id))
		card.add_child(b)
	var how := FelecoUiScript.label("Click one of your tiles, then a tile next to it: half the clan moves there. Empty tiles are claimed; rival tiles are fought for.\nForests feed best in summer and autumn, meadows in spring. A clan with too little food starves.", 16, FelecoUiScript.CREAM)
	how.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(how)
	var back := Button.new()
	back.text = "Back"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(200, 48)
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn"))
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "dominion")
	bc.add_child(back)
	col.add_child(bc)

func _start(id: String) -> void:
	_select.queue_free()
	_select = null
	_player = id
	_clans = [id]
	for c: String in CLANS.keys():
		if c != id:
			_clans.append(c)
	_make_map()
	_turn = 0
	_log.clear()
	_build_side()
	_begin_turn()

# --- The board ------------------------------------------------------------

func _idx(p: Vector2i) -> int:
	return p.y * W + p.x

func _inside(p: Vector2i) -> bool:
	return p.x >= 0 and p.y >= 0 and p.x < W and p.y < H

func _make_map() -> void:
	_terrain = []
	_owner = []
	_pop = []
	_hut = []
	var noise := FastNoiseLite.new()
	noise.seed = randi()
	noise.frequency = 0.18
	for y: int in H:
		for x: int in W:
			var n: float = noise.get_noise_2d(x, y)
			var t: int = T.MEADOW
			if n > 0.25:
				t = T.FOREST
			elif n < -0.45:
				t = T.ROCK
			_terrain.append(t)
			_owner.append("")
			_pop.append(0)
			_hut.append(false)
	# A river winds down the middle.
	var rx: int = W / 2
	for y: int in H:
		_terrain[_idx(Vector2i(rx, y))] = T.RIVER
		if randf() < 0.4:
			rx = clampi(rx + (1 if randf() < 0.5 else -1), 4, W - 5)
			_terrain[_idx(Vector2i(rx, y))] = T.RIVER
	for i: int in _clans.size():
		var home: Vector2i = CORNERS[i]
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var p := home + Vector2i(dx, dy)
				if _inside(p) and _terrain[_idx(p)] == T.ROCK:
					_terrain[_idx(p)] = T.MEADOW
		_owner[_idx(home)] = _clans[i]
		_pop[_idx(home)] = 6
		_hut[_idx(home)] = true

func _season() -> int:
	return mini(_turn / 4, 2)

func _season_name() -> String:
	return ["Spring", "Summer", "Autumn", "Winter"][mini(_turn / 4, 3)]

func _neighbors(p: Vector2i) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		if _inside(p + d) and _terrain[_idx(p + d)] != T.ROCK:
			out.append(p + d)
	return out

func _tiles_of(c: String) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for y: int in H:
		for x: int in W:
			if _owner[y * W + x] == c:
				out.append(Vector2i(x, y))
	return out

# --- Moves ----------------------------------------------------------------

# Half the clan on `from` moves to `to`: claims it if empty, joins it if
# ours, fights for it if a rival's. Returns false if not allowed.
func _move(c: String, from: Vector2i, to: Vector2i, mult: float = 1.0) -> bool:
	var fi: int = _idx(from)
	var ti: int = _idx(to)
	if _owner[fi] != c or int(_pop[fi]) < 2:
		return false
	var going: int = int(_pop[fi]) / 2
	_pop[fi] = int(_pop[fi]) - going
	var name: String = CLANS[c]["name"]
	if _owner[ti] == "" or _owner[ti] == c:
		if _owner[ti] == "":
			_note("%s settle a %s." % [name, T_NAME[_terrain[ti]].to_lower()], c)
		_owner[ti] = c
		_pop[ti] = int(_pop[ti]) + going
		return true
	# A fight. Forests and huts help whoever holds them.
	var defend: float = float(_pop[ti]) * (1.3 if _terrain[ti] == T.FOREST else 1.0) * (2.0 if _hut[ti] else 1.0)
	var attack: float = float(going) * mult * randf_range(0.8, 1.25)
	var foe: String = CLANS[_owner[ti]]["name"]
	if attack > defend:
		_note("%s drive the %s off a tile!" % [name, foe], c)
		_owner[ti] = c
		_pop[ti] = maxi(int(round(attack - defend)), 1)
		_hut[ti] = false
	else:
		_note("The %s hold off the %s." % [foe, name], _owner[ti])
		_pop[ti] = maxi(int(round((defend - attack) / ((1.3 if _terrain[ti] == T.FOREST else 1.0) * (2.0 if _hut[ti] else 1.0)))), 1)
	return true

func _note(text: String, _c: String) -> void:
	_log.push_front(text)
	if _log.size() > 7:
		_log.pop_back()

# --- Turns ---------------------------------------------------------------

func _begin_turn() -> void:
	if _turn >= TURNS:
		_winter()
		return
	_moves = MOVES
	_power_used = false
	_maul = false
	_seed_flight = false
	if _turn % 4 == 0:
		_season_event()
	_mode = "play"
	_refresh()

func _season_event() -> void:
	match _season():
		0:
			_note("Spring melt: the river floods its banks.", "")
			for y: int in H:
				for x: int in W:
					var p := Vector2i(x, y)
					if _owner[_idx(p)] != "" and _near_river(p):
						_pop[_idx(p)] = maxi(int(_pop[_idx(p)]) - 1, 1)
		1:
			_note("Summer: the forests are full of berries.", "")
		2:
			_note("Autumn harvest: last chance to grow before winter!", "")

func _near_river(p: Vector2i) -> bool:
	for n: Vector2i in _neighbors(p) + [p]:
		if _terrain[_idx(n)] == T.RIVER:
			return true
	return false

func _end_turn() -> void:
	if _mode != "play":
		return
	for c: String in _clans:
		if c != _player:
			_ai_turn(c)
	_grow()
	_turn += 1
	_begin_turn()

# The inner simulation: every clan eats what its tiles grow; surplus
# grows the clan where the food is, a shortfall starves it.
func _grow() -> void:
	for c: String in _clans:
		var tiles := _tiles_of(c)
		var food: int = 0
		var mouths: int = 0
		for p: Vector2i in tiles:
			food += int(FOOD[_terrain[_idx(p)]][_season()]) + (1 if _hut[_idx(p)] else 0)
			mouths += int(_pop[_idx(p)])
		var surplus: int = food - mouths / 3
		if surplus > 0:
			tiles.sort_custom(func(a: Vector2i, b: Vector2i) -> bool: return int(FOOD[_terrain[_idx(a)]][_season()]) > int(FOOD[_terrain[_idx(b)]][_season()]))
			for k: int in mini(surplus, tiles.size() * 2):
				var p: Vector2i = tiles[k % tiles.size()]
				_pop[_idx(p)] = int(_pop[_idx(p)]) + 1
		elif surplus < 0 and not tiles.is_empty():
			for k: int in -surplus:
				var p: Vector2i = tiles[randi() % tiles.size()]
				_pop[_idx(p)] = int(_pop[_idx(p)]) - 1
				if int(_pop[_idx(p)]) <= 0:
					_owner[_idx(p)] = ""
					_pop[_idx(p)] = 0
					_hut[_idx(p)] = false
			_note("The %s go hungry." % CLANS[c]["name"], c)

# Rival clans: grab the best tile they can reach each move, preferring
# food, empty land, and weak neighbours.
func _ai_turn(c: String) -> void:
	var moves: int = MOVES + (2 if c == "boar" and randf() < 0.3 else 0)
	for m: int in moves:
		var best_score: float = -INF
		var best_from := Vector2i(-1, -1)
		var best_to := Vector2i(-1, -1)
		for p: Vector2i in _tiles_of(c):
			var have: int = int(_pop[_idx(p)])
			if have < 2:
				continue
			for n: Vector2i in _neighbors(p):
				var ni: int = _idx(n)
				var score: float = float(FOOD[_terrain[ni]][_season()]) + float(have) * 0.1
				if _owner[ni] == "":
					score += 3.0
				elif _owner[ni] == c:
					score = -1.0 if int(_pop[ni]) > have else 0.5
				else:
					score += 2.0 - float(_pop[ni]) / float(have / 2 + 1) * 3.0
				if score > best_score:
					best_score = score
					best_from = p
					best_to = n
		if best_from.x < 0 or best_score < 0.0:
			break
		_move(c, best_from, best_to, 1.5 if c == "bear" and m == 0 and randf() < 0.3 else 1.0)
	if c == "human" and randf() < 0.25:
		var mine := _tiles_of(c)
		if not mine.is_empty():
			var p: Vector2i = mine[randi() % mine.size()]
			_hut[_idx(p)] = true
			_pop[_idx(p)] = int(_pop[_idx(p)]) + 3

func _winter() -> void:
	_mode = "over"
	var counts: Array = []
	for c: String in _clans:
		counts.append([c, _tiles_of(c).size()])
	counts.sort_custom(func(a: Array, b: Array) -> bool: return int(a[1]) > int(b[1]))
	var won: bool = counts[0][0] == _player
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		if won:
			gc.set_record("dominion", _player, "ruled")
		gc.award_eco_points(120 if won else 20)
	var lines: Array[String] = []
	for i: int in counts.size():
		lines.append("%d. %s: %d tiles" % [i + 1, CLANS[counts[i][0]]["name"], counts[i][1]])
	_status.text = ("WINTER! The %s rule the valley! +120 EP\n" % CLANS[_player]["name"] if won else "Winter falls. The %s rule the valley this year.\n" % CLANS[counts[0][0]]["name"]) + "\n".join(lines)
	_end_btn.text = "Play again"
	_power_btn.visible = false
	queue_redraw()

# --- UI ----------------------------------------------------------------

func _build_side() -> void:
	if _side != null:
		_side.get_parent().queue_free()
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	panel.offset_left = -340
	panel.offset_top = 10
	panel.offset_bottom = -10
	panel.offset_right = -10
	add_child(panel)
	_side = VBoxContainer.new()
	_side.add_theme_constant_override("separation", 10)
	panel.add_child(_side)
	_coach_lbl = FelecoUiScript.label("", 18, FelecoUiScript.GOLD)
	_coach_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_side.add_child(_coach_lbl)
	_status = FelecoUiScript.label("", 17, FelecoUiScript.CREAM)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_side.add_child(_status)
	_power_btn = Button.new()
	_power_btn.theme_type_variation = "PrimaryButton"
	_power_btn.custom_minimum_size = Vector2(0, 46)
	_power_btn.pressed.connect(_use_power)
	_side.add_child(_power_btn)
	_end_btn = Button.new()
	_end_btn.text = "End turn"
	_end_btn.custom_minimum_size = Vector2(0, 46)
	_end_btn.pressed.connect(func() -> void:
		if _mode == "over":
			_show_select()
			_side.get_parent().queue_free()
			_side = null
		else:
			_end_turn())
	_side.add_child(_end_btn)
	_log_lbl = FelecoUiScript.label("", 14, FelecoUiScript.MIST)
	_log_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_side.add_child(_log_lbl)
	var quit := Button.new()
	quit.text = "Clans"
	quit.theme_type_variation = "GhostButton"
	quit.pressed.connect(func() -> void:
		_side.get_parent().queue_free()
		_side = null
		_show_select())
	_side.add_child(quit)

func _refresh() -> void:
	if _mode == "over" or _side == null:
		return
	var c: Dictionary = CLANS[_player]
	var counts := ""
	for k: String in _clans:
		counts += "%s %d   " % [CLANS[k]["name"], _tiles_of(k).size()]
	_status.text = "%s  -  turn %d of %d\nYou lead the %s. Moves left: %d\n\nTiles: %s" % [_season_name(), _turn + 1, TURNS, c["name"], _moves, counts]
	# The first two turns coach the player through a move, step by step.
	var coach: String = ""
	if _turn < 2:
		if _sel.x < 0:
			coach = "STEP 1: Click one of your tiles (your colour; your home has a hut)."
		elif _moves == MOVES:
			coach = "STEP 2: Click a tile with a yellow outline, right next to it. Half your clan moves there."
		elif _moves > 0:
			coach = "Nice! %d moves left. Keep spreading out, or press End turn." % _moves
		else:
			coach = "Out of moves. Press End turn: your clan eats, grows, and the rivals move."
	_coach_lbl.text = coach
	_coach_lbl.visible = not coach.is_empty()
	_power_btn.text = "%s%s" % [c["power"], " (used)" if _power_used else ""]
	_power_btn.disabled = _power_used
	_log_lbl.text = "\n".join(_log)
	queue_redraw()

func _use_power() -> void:
	if _power_used or _mode != "play":
		return
	_power_used = true
	match _player:
		"human":
			if _sel.x < 0 or _owner[_idx(_sel)] != _player:
				_note("Select one of your tiles first, then Build Hut.", _player)
				_power_used = false
			else:
				_hut[_idx(_sel)] = true
				_pop[_idx(_sel)] = int(_pop[_idx(_sel)]) + 3
				_note("A hut goes up.", _player)
		"bear":
			_maul = true
			_note("The bears are ready to maul.", _player)
		"boar":
			_moves += 2
			_note("Stampede! Two extra moves.", _player)
		"robin":
			_seed_flight = true
			_note("Seed Flight: click any empty tile up to 3 away from yours.", _player)
	_refresh()

func _board_rect() -> Rect2:
	var avail := Vector2(size.x - 370, size.y - 40)
	var cell: float = minf(avail.x / W, avail.y / H)
	return Rect2(Vector2(20, 20 + (avail.y - cell * H) * 0.5), Vector2(cell * W, cell * H))

func _cell_at(pos: Vector2) -> Vector2i:
	var r := _board_rect()
	if not r.has_point(pos):
		return Vector2i(-1, -1)
	var cell: float = r.size.x / W
	return Vector2i(int((pos.x - r.position.x) / cell), int((pos.y - r.position.y) / cell))

func _gui_input(event: InputEvent) -> void:
	if _mode != "play":
		return
	var mm := event as InputEventMouseMotion
	if mm != null:
		_hover = _cell_at(mm.position)
		queue_redraw()
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	var p := _cell_at(mb.position)
	if p.x < 0 or _terrain[_idx(p)] == T.ROCK:
		return
	if _seed_flight and _owner[_idx(p)] == "":
		for mine: Vector2i in _tiles_of(_player):
			if absi(mine.x - p.x) + absi(mine.y - p.y) <= 3 and int(_pop[_idx(mine)]) >= 2:
				_seed_flight = false
				_pop[_idx(mine)] = int(_pop[_idx(mine)]) - 1
				_owner[_idx(p)] = _player
				_pop[_idx(p)] = 2
				_note("Robins carry seed to a new tile.", _player)
				_refresh()
				return
	if _owner[_idx(p)] == _player and (_sel.x < 0 or not _neighbors(_sel).has(p)):
		_sel = p
		_refresh()
		return
	if _sel.x >= 0 and _neighbors(_sel).has(p) and _moves > 0:
		if _move(_player, _sel, p, 1.5 if _maul else 1.0):
			_moves -= 1
			if _maul and _owner[_idx(p)] != "":
				_maul = false
			_sel = p if _owner[_idx(p)] == _player else _sel
		_refresh()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.08, 0.07))
	if _terrain.is_empty() or _select != null:
		return
	var r := _board_rect()
	var cell: float = r.size.x / W
	var font := FelecoUiScript.font("heading")
	var winter: bool = _mode == "over"
	for y: int in H:
		for x: int in W:
			var p := Vector2i(x, y)
			var i: int = _idx(p)
			var rect := Rect2(r.position + Vector2(x, y) * cell, Vector2(cell, cell))
			var tc: Color = T_COLOR[_terrain[i]]
			if winter:
				tc = tc.lerp(Color(0.92, 0.95, 1.0), 0.6)
			draw_rect(rect.grow(-1), tc)
			if _terrain[i] == T.FOREST:
				for k: int in 3:
					draw_circle(rect.position + Vector2(0.25 + 0.25 * k, 0.4 + 0.15 * (k % 2)) * cell, cell * 0.15, tc.darkened(0.25))
			if _owner[i] != "":
				var cc: Color = CLANS[_owner[i]]["color"]
				draw_rect(rect.grow(-3), Color(cc.r, cc.g, cc.b, 0.45))
				draw_rect(rect.grow(-3), cc, false, 3.0)
				if _hut[i]:
					var hc := rect.position + Vector2(0.78, 0.28) * cell
					draw_colored_polygon(PackedVector2Array([hc + Vector2(-0.14, 0) * cell, hc + Vector2(0, -0.14) * cell, hc + Vector2(0.14, 0) * cell]), Color(0.45, 0.3, 0.15))
					draw_rect(Rect2(hc + Vector2(-0.1, 0) * cell, Vector2(0.2, 0.12) * cell), Color(0.75, 0.6, 0.4))
				draw_string(font, rect.position + Vector2(0, cell * 0.66), str(_pop[i]), HORIZONTAL_ALIGNMENT_CENTER, cell, int(cell * 0.4), Color.WHITE)
	if _sel.x >= 0:
		var sr := Rect2(r.position + Vector2(_sel) * cell, Vector2(cell, cell))
		draw_rect(sr, Color(1, 1, 1), false, 4.0)
		for n: Vector2i in _neighbors(_sel):
			draw_rect(Rect2(r.position + Vector2(n) * cell, Vector2(cell, cell)).grow(-6), Color(1, 1, 0.6, 0.6), false, 2.0)
	if _hover.x >= 0 and _mode == "play":
		var hi: int = _idx(_hover)
		var tip := "%s  food %d%s" % [T_NAME[_terrain[hi]], FOOD[_terrain[hi]][_season()], ("  -  %s %d" % [CLANS[_owner[hi]]["name"], _pop[hi]]) if _owner[hi] != "" else ""]
		draw_string(font, Vector2(r.position.x, r.end.y + 16), tip, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, FelecoUiScript.CREAM)

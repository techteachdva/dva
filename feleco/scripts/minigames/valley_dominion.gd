extends Control

# Omnivore campaign: Valley Dominion. FelEco within FelEco: the valley as a
# board of tiles, four omnivore clans spreading across it through spring,
# summer and autumn, then holding on through winter. Every tile has its own
# food (the green bar): it grows by terrain and season, and the clan living
# there eats it down. Eat more than it grows and the tile starves; move on
# before that and it recovers. Meadows feed in spring, forests in summer and
# autumn, and almost nothing grows in winter. After twelve turns the snow
# falls, every clan eats what it has stored, and the biggest clan still
# standing rules the valley. Spread wide in spring; gather in the forests by
# autumn; watch for the wolf pack that comes down from the passes.
#
# Clans (one power a turn, and a way of life):
#   Humans  Build Hut: +2 clan, stores extra food, twice as hard to take.
#   Bears   Maul: next attack hits 50% harder. Fish (+1 food by the river)
#           and sleep through winter in the forests (eat nothing).
#   Boars   Stampede: two extra moves. Root in meadows (+1 food there).
#   Robins  Seed Flight: claim any empty tile up to 3 away. Fly two tiles a
#           move, eat little, but are weak in a fight.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const Brawl = preload("res://scripts/minigames/predator_brawl.gd")

const W: int = 10
const H: int = 7
const TURNS: int = 12
const MOVES: int = 3
const WINTER_ROUNDS: int = 2
enum T { MEADOW, FOREST, RIVER, ROCK }
const T_NAME: Array[String] = ["Meadow", "Forest", "River", "Rock"]
const T_COLOR: Array[Color] = [Color(0.45, 0.66, 0.32), Color(0.2, 0.42, 0.2), Color(0.3, 0.55, 0.82), Color(0.48, 0.47, 0.5)]
# Food a tile grows each turn by season (spring, summer, autumn, winter),
# how much it can hold, and how many clan it can feed to grow.
const GROW: Array = [[3, 2, 1, 0], [1, 3, 3, 1], [2, 2, 2, 0], [0, 0, 0, 0]]
const FOOD_CAP: Array[int] = [8, 8, 6, 0]
const POP_CAP: Array[int] = [9, 8, 6, 0]
const HUT_STORE: int = 6
const HUT_ROOM: int = 3
const HUT_CLAN: int = 3
const SEASON_NAME: Array[String] = ["Spring", "Summer", "Autumn", "Winter"]
# Wolves come down from the passes late in summer.
const WOLF_TURN: int = 6
const WOLF_BITE: int = 2
const EP_BY_PLACE: Array[int] = [120, 60, 35, 20]

const CLANS: Dictionary = {
	"human": {"name": "Humans", "color": Color(0.95, 0.75, 0.3), "power": "Build Hut",
		"about": "Power: Build Hut (+3 clan, stores food, hard to take).",
		"way": "Huts farm +1 food, even in winter, and keep wolves out."},
	"bear": {"name": "Bears", "color": Color(0.55, 0.36, 0.22), "power": "Maul",
		"about": "Power: Maul (next attack hits twice as hard).",
		"way": "Tough. Fish by rivers; sleep through winter in forests."},
	"boar": {"name": "Boars", "color": Color(0.85, 0.35, 0.3), "power": "Stampede",
		"about": "Power: Stampede (next move charges two tiles).",
		"way": "Dig roots: meadows feed them +1 in autumn."},
	"robin": {"name": "Robins", "color": Color(0.55, 0.75, 1.0), "power": "Seed Flight",
		"about": "Power: Seed Flight (claim an empty tile up to 3 away).",
		"way": "Fly two tiles a move and spread fast, but fight weakly."},
}
const CORNERS: Array = [Vector2i(1, 1), Vector2i(W - 2, H - 2), Vector2i(W - 2, 1), Vector2i(1, H - 2)]

var _terrain: Array = []
var _owner: Array = []
var _pop: Array = []
var _hut: Array = []
var _food: Array = []
var _clans: Array[String] = []
var _player: String = ""
var _turn: int = 0
var _moves: int = 0
var _power_used: bool = false
var _maul: bool = false
var _seed_flight: bool = false
var _stampede: bool = false
var _drought: bool = false
var _wolf := Vector2i(-1, -1)
var _sel := Vector2i(-1, -1)
var _log: Array[String] = []
var _history: Dictionary = {}
var _mode: String = "select"
var _select: Control
var _side: VBoxContainer
var _status: Label
var _bars: VBoxContainer
var _log_lbl: Label
var _coach_lbl: Label
var _forecast_lbl: Label
var _end_btn: Button
var _power_btn: Button
var _hover := Vector2i(-1, -1)
var _banner: String = ""
var _banner_t: float = 0.0
var _fx: Array = []
var _winter_report: Array[String] = []
var _jx := Juice.new()
var _t: float = 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = FelecoUiScript.theme()
	_jx.font = FelecoUiScript.font("heading")
	_show_select()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "dominion"):
		HowToPlay.show(self, "dominion")

func _show_select() -> void:
	_mode = "select"
	if _side != null and is_instance_valid(_side):
		_side.get_parent().queue_free()
		_side = null
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
	var sub := FelecoUiScript.label("Four omnivore clans. Three seasons to spread and feed. Then winter: the biggest clan left standing rules the valley.", 19, FelecoUiScript.CREAM)
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
		card.custom_minimum_size = Vector2(270, 0)
		row.add_child(card)
		var pic := TextureRect.new()
		pic.texture = Brawl.portrait(id)
		pic.custom_minimum_size = Vector2(270, 130)
		pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		card.add_child(pic)
		var won = gc.record("dominion", id) if gc != null else null
		card.add_child(FelecoUiScript.heading(c["name"] + ("  (Ruled!)" if won != null else ""), 22, c["color"]))
		var about := FelecoUiScript.label("%s\n%s" % [c["about"], c["way"]], 14, FelecoUiScript.MIST)
		about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		about.custom_minimum_size = Vector2(0, 64)
		card.add_child(about)
		var b := Button.new()
		b.text = "Lead the %s" % c["name"]
		b.theme_type_variation = "PrimaryButton"
		b.custom_minimum_size = Vector2(0, 48)
		b.pressed.connect(func() -> void: _start(id))
		card.add_child(b)
	var how := FelecoUiScript.label("1. Click your tile, then a yellow tile: half your clan moves there.   2. Green bars are food: keep your clan where food is.   3. Before winter, fill the forests. Biggest clan after winter wins.", 16, FelecoUiScript.CREAM)
	how.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	how.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	how.custom_minimum_size = Vector2(1100, 0)
	col.add_child(how)
	var back := Button.new()
	back.text = "Back to Mini-Games"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(220, 48)
	back.pressed.connect(_quit_to_campaign)
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "dominion")
	bc.add_child(back)
	col.add_child(bc)
	queue_redraw()

func _quit_to_campaign() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

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
	_wolf = Vector2i(-1, -1)
	_drought = false
	_sel = Vector2i(-1, -1)
	_log.clear()
	_fx.clear()
	_winter_report.clear()
	_history = {}
	for c: String in _clans:
		_history[c] = [_clan_pop(c)]
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
	_food = []
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
			_food.append(0)
	# A river winds down the middle.
	var rx: int = W / 2
	for y: int in H:
		_terrain[_idx(Vector2i(rx, y))] = T.RIVER
		if randf() < 0.4:
			rx = clampi(rx + (1 if randf() < 0.5 else -1), 3, W - 4)
			_terrain[_idx(Vector2i(rx, y))] = T.RIVER
	for i: int in W * H:
		_food[i] = int(FOOD_CAP[_terrain[i]] * 0.6)
	for i: int in _clans.size():
		var home: Vector2i = CORNERS[i]
		# Every home starts on a meadow with a forest within reach.
		var has_forest: bool = false
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var p := home + Vector2i(dx, dy)
				if not _inside(p):
					continue
				if _terrain[_idx(p)] == T.ROCK or _terrain[_idx(p)] == T.RIVER:
					_terrain[_idx(p)] = T.MEADOW
				if _terrain[_idx(p)] == T.FOREST:
					has_forest = true
		_terrain[_idx(home)] = T.MEADOW
		if not has_forest:
			var fp := home + Vector2i(1 if home.x < W / 2 else -1, 1 if home.y < H / 2 else -1)
			_terrain[_idx(fp)] = T.FOREST
		_owner[_idx(home)] = _clans[i]
		_pop[_idx(home)] = 6
		_hut[_idx(home)] = true
		for dy: int in range(-1, 2):
			for dx: int in range(-1, 2):
				var p := home + Vector2i(dx, dy)
				if _inside(p):
					_food[_idx(p)] = FOOD_CAP[_terrain[_idx(p)]]

func _season() -> int:
	return mini(_turn / 4, 3)

func _season_name() -> String:
	return SEASON_NAME[_season()]

# What a tile grows this turn for the clan on it (passives and the drought).
func _grow_at(i: int, season: int, clan: String = "") -> int:
	var t: int = _terrain[i]
	var g: int = int(GROW[t][season])
	if clan.is_empty():
		clan = _owner[i]
	if _drought and season == 1 and t == T.MEADOW:
		g -= 1
	# Boars dig for roots in autumn, when the grass fails (the ground freezes in winter).
	if clan == "boar" and t == T.MEADOW and season == 2:
		g += 1
	if clan == "bear" and t == T.RIVER and season < 3:
		g += 2
	# Villagers farm around their huts, even under snow.
	if clan == "human" and _hut[i]:
		g += 1
	return maxi(g, 0)

func _food_cap(i: int) -> int:
	return int(FOOD_CAP[_terrain[i]]) + (HUT_STORE if _hut[i] else 0)

# How many clan a tile can feed to grow. A tile only holds so many nests;
# bears den deep in the forest.
func _pop_cap(i: int, clan: String = "") -> int:
	if clan.is_empty():
		clan = _owner[i]
	var cap: int = int(POP_CAP[_terrain[i]]) + (HUT_ROOM if _hut[i] else 0)
	if clan == "robin":
		cap -= 3
	elif clan == "bear" and _terrain[i] == T.FOREST:
		cap += 2
	return cap

# Mouths: a clan eats half its number a turn. Bears asleep in a winter
# forest eat nothing.
func _need(i: int, season: int) -> int:
	var c: String = _owner[i]
	var n: int = int(_pop[i])
	if c == "bear" and season == 3 and _terrain[i] == T.FOREST:
		return 0
	return int(ceil(float(n) / 2.0))

func _reach(c: String) -> int:
	return 2 if c == "robin" else 1

func _neighbors(p: Vector2i) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
		if _inside(p + d) and _terrain[_idx(p + d)] != T.ROCK:
			out.append(p + d)
	return out

# Where a clan on `p` can move: next door, two tiles for the flying robins,
# or two tiles in a straight line for a stampeding boar.
func _targets(p: Vector2i, c: String, charge: bool = false) -> Array[Vector2i]:
	var r: int = _reach(c)
	var out: Array[Vector2i] = _neighbors(p)
	if r == 2:
		for dy: int in range(-2, 3):
			for dx: int in range(-2, 3):
				var d: int = absi(dx) + absi(dy)
				if d != 2:
					continue
				var q := p + Vector2i(dx, dy)
				if _inside(q) and _terrain[_idx(q)] != T.ROCK:
					out.append(q)
	elif charge:
		for d: Vector2i in [Vector2i(2, 0), Vector2i(-2, 0), Vector2i(0, 2), Vector2i(0, -2)]:
			var q := p + d
			if _inside(q) and _terrain[_idx(q)] != T.ROCK and not out.has(q):
				out.append(q)
	return out

func _tiles_of(c: String) -> Array[Vector2i]:
	var out: Array[Vector2i] = []
	for y: int in H:
		for x: int in W:
			if _owner[y * W + x] == c:
				out.append(Vector2i(x, y))
	return out

func _clan_pop(c: String) -> int:
	var n: int = 0
	for p: Vector2i in _tiles_of(c):
		n += int(_pop[_idx(p)])
	return n

# --- Moves ----------------------------------------------------------------

# Forests and huts help whoever holds them; bears have thick hides.
func _defence(ti: int) -> float:
	return float(_pop[ti]) * (1.3 if _terrain[ti] == T.FOREST else 1.0) * (2.0 if _hut[ti] else 1.0) * (1.25 if _owner[ti] == "bear" else 1.0)

func _attack_of(c: String, going: int, mult: float) -> float:
	return float(going) * mult * (0.75 if c == "robin" else 1.0)

# Half the clan on `from` moves to `to`: claims it if empty, joins it if
# ours, fights for it if a rival's. Returns false if not allowed.
func _move(c: String, from: Vector2i, to: Vector2i, mult: float = 1.0) -> bool:
	var fi: int = _idx(from)
	var ti: int = _idx(to)
	if _owner[fi] != c or int(_pop[fi]) < 2 or _terrain[ti] == T.ROCK:
		return false
	var going: int = int(_pop[fi]) / 2
	_pop[fi] = int(_pop[fi]) - going
	var name: String = CLANS[c]["name"]
	var cell := _cell_center(to)
	if _owner[ti] == "" or _owner[ti] == c:
		if _owner[ti] == "":
			_note("%s settle a %s." % [name, T_NAME[_terrain[ti]].to_lower()], c)
		_owner[ti] = c
		_pop[ti] = int(_pop[ti]) + going
		_fx.append([cell, "+%d" % going, 0.9, CLANS[c]["color"]])
		return true
	# A fight. Forests and huts help whoever holds them.
	var defend: float = _defence(ti)
	var attack: float = _attack_of(c, going, mult) * randf_range(0.85, 1.2)
	var foe: String = CLANS[_owner[ti]]["name"]
	if attack > defend:
		_note("%s drive the %s off a tile!" % [name, foe], c)
		_owner[ti] = c
		_pop[ti] = maxi(int(round(attack - defend)), 1)
		_hut[ti] = false
		_fx.append([cell, "Taken!", 1.0, CLANS[c]["color"]])
	else:
		_note("The %s hold off the %s." % [foe, name], _owner[ti])
		var left: int = maxi(int(round((defend - attack) * float(_pop[ti]) / defend)), 1)
		_fx.append([cell, "Held!", 1.0, CLANS[_owner[ti]]["color"]])
		_pop[ti] = left
	return true

func _note(text: String, _c: String) -> void:
	_log.push_front(text)
	if _log.size() > 8:
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
	_stampede = false
	_sel = Vector2i(-1, -1)
	if _turn % 4 == 0:
		_season_event()
		_say(_season_name().to_upper(), 1.4)
		Juice.sfx(self, "chime")
		_jx.confetti(_board_rect().get_center() + Vector2(0, -60), 30, 260.0)
	if _turn == WOLF_TURN:
		_wolves_arrive()
		Juice.sfx(self, "taunt", 0.6)
		_jx.shake(0.4)
	_mode = "play"
	_refresh()

func _say(text: String, secs: float) -> void:
	_banner = text
	_banner_t = secs

func _season_event() -> void:
	match _season():
		0:
			_note("Spring melt: the river floods its banks. Silt feeds the shore.", "")
			for y: int in H:
				for x: int in W:
					var p := Vector2i(x, y)
					var i: int = _idx(p)
					if _near_river(p) and _terrain[i] != T.ROCK:
						_food[i] = mini(int(_food[i]) + 2, _food_cap(i))
						if _owner[i] != "":
							_pop[i] = maxi(int(_pop[i]) - 1, 1)
		1:
			_drought = randf() < 0.5
			if _drought:
				_note("Summer drought: the meadows bake. They grow one less all season.", "")
			else:
				_note("Summer: the forests are full of berries (+2 food).", "")
				for i: int in W * H:
					if _terrain[i] == T.FOREST:
						_food[i] = mini(int(_food[i]) + 2, _food_cap(i))
		2:
			_note("Autumn: apples fall in the forests (+2 food). Winter is four turns away!", "")
			for i: int in W * H:
				if _terrain[i] == T.FOREST:
					_food[i] = mini(int(_food[i]) + 2, _food_cap(i))

func _near_river(p: Vector2i) -> bool:
	for n: Vector2i in _neighbors(p) + [p]:
		if _terrain[_idx(n)] == T.RIVER:
			return true
	return false

func _end_turn() -> void:
	if _mode != "play":
		return
	Juice.sfx(self, "whoosh")
	for c: String in _clans:
		if c != _player:
			_ai_turn(c)
	_wolves_hunt()
	_feed(_season(), true)
	for c: String in _clans:
		(_history[c] as Array).append(_clan_pop(c))
	_turn += 1
	_begin_turn()

# The inner simulation: every tile grows food, then the clan on it eats.
# Plenty left over and the clan grows; too little and it starves.
func _feed(season: int, grow_pop: bool) -> void:
	var hungry: Dictionary = {}
	for i: int in W * H:
		if _terrain[i] == T.ROCK:
			continue
		var c: String = _owner[i]
		_food[i] = mini(int(_food[i]) + _grow_at(i, season, c), _food_cap(i))
		if c == "":
			continue
		var need: int = _need(i, season)
		if int(_food[i]) >= need:
			_food[i] = int(_food[i]) - need
			if grow_pop and int(_food[i]) >= need and int(_pop[i]) < _pop_cap(i):
				_pop[i] = int(_pop[i]) + 1
		else:
			var short: int = need - int(_food[i])
			_food[i] = 0
			_pop[i] = int(_pop[i]) - short
			hungry[c] = int(hungry.get(c, 0)) + short
			if int(_pop[i]) <= 0:
				_owner[i] = ""
				_pop[i] = 0
				_hut[i] = false
	for c: String in hungry.keys():
		_note("%d %s starve on bare tiles." % [hungry[c], CLANS[c]["name"].to_lower()], c)
		if c == _player and season < 3:
			for p: Vector2i in _tiles_of(c):
				if int(_food[_idx(p)]) == 0:
					_fx.append([_cell_center(p), "Hungry!", 1.2, Color(1, 0.5, 0.4)])

# --- The wolf pack ----------------------------------------------------------

func _wolves_arrive() -> void:
	var spots: Array[Vector2i] = []
	for x: int in W:
		for y: int in [0, H - 1]:
			var p := Vector2i(x, y)
			if _terrain[_idx(p)] != T.ROCK and _owner[_idx(p)] == "":
				spots.append(p)
	for y: int in H:
		for x: int in [0, W - 1]:
			var p := Vector2i(x, y)
			if _terrain[_idx(p)] != T.ROCK and _owner[_idx(p)] == "" and not spots.has(p):
				spots.append(p)
	if spots.is_empty():
		return
	_wolf = spots[randi() % spots.size()]
	_note("A wolf pack comes down from the passes! Huts keep them out.", "")
	_fx.append([_cell_center(_wolf), "Wolves!", 1.6, Color(1, 0.5, 0.4)])

# Each turn the wolves move one tile toward the nearest clan and pick off the
# smallest group next to them. A hut turns them away.
func _wolves_hunt() -> void:
	if _wolf.x < 0:
		return
	var prey: Vector2i = Vector2i(-1, -1)
	var best: int = 999
	for n: Vector2i in _neighbors(_wolf):
		var i: int = _idx(n)
		if _owner[i] != "" and not _hut[i] and int(_pop[i]) < best:
			best = int(_pop[i])
			prey = n
	if prey.x >= 0:
		var i: int = _idx(prey)
		var bite: int = mini(WOLF_BITE, int(_pop[i]))
		_pop[i] = int(_pop[i]) - bite
		_note("Wolves take %d %s." % [bite, CLANS[_owner[i]]["name"].to_lower()], _owner[i])
		_fx.append([_cell_center(prey), "-%d wolves!" % bite, 1.2, Color(1, 0.5, 0.4)])
		if int(_pop[i]) <= 0:
			_owner[i] = ""
			_pop[i] = 0
			_hut[i] = false
		_wolf = prey if _owner[i] == "" else _wolf
		return
	# Nothing to eat here: pad toward the nearest clan tile.
	var target: Vector2i = Vector2i(-1, -1)
	var dist: int = 999
	for y: int in H:
		for x: int in W:
			var i: int = y * W + x
			if _owner[i] != "" and not _hut[i]:
				var d: int = absi(x - _wolf.x) + absi(y - _wolf.y)
				if d < dist:
					dist = d
					target = Vector2i(x, y)
	if target.x < 0:
		return
	var step: Vector2i = _wolf
	var sd: int = dist
	for n: Vector2i in _neighbors(_wolf):
		if _owner[_idx(n)] != "":
			continue
		var d: int = absi(n.x - target.x) + absi(n.y - target.y)
		if d < sd:
			sd = d
			step = n
	_wolf = step

# --- Rival clans ----------------------------------------------------------

# Rivals weigh each move by the food where they're going (this season and
# the next), by how hungry the tile they're leaving is, and by whether a
# fight is worth it. Then they pick the best, mostly: one move in four they
# take one of the runners-up, so they can be outplayed.
func _score_move(c: String, from: Vector2i, to: Vector2i, mult: float) -> float:
	var fi: int = _idx(from)
	var ti: int = _idx(to)
	var have: int = int(_pop[fi])
	var going: int = have / 2
	var season: int = _season()
	var nxt: int = mini(season + 1, 3)
	var value: float = float(_grow_at(ti, season, c)) + 0.7 * float(_grow_at(ti, nxt, c)) + 0.25 * float(_food[ti])
	# Leaving a crowded or bare tile is good; splitting a small group is not.
	var need: int = int(ceil(float(have) / 2.0))
	var pressure: float = 1.5 if int(_food[fi]) + _grow_at(fi, season, c) < need * 2 else 0.0
	if have <= 3:
		pressure -= 1.0
	if _owner[ti] == "":
		var score: float = value + 2.0 + pressure
		if _wolf.x >= 0 and absi(to.x - _wolf.x) + absi(to.y - _wolf.y) <= 1:
			score -= 3.0
		return score
	if _owner[ti] == c:
		# Gather into forests before winter; otherwise don't shuffle.
		var winter_home: bool = season >= 2 and _terrain[ti] == T.FOREST and _terrain[fi] != T.FOREST
		if int(_pop[ti]) + going > _pop_cap(ti, c):
			return -2.0
		return (2.5 if winter_home else -0.5) + pressure
	var atk: float = _attack_of(c, going, mult)
	var def: float = _defence(ti)
	if atk > def * 1.15:
		return value + 3.0 + (atk - def) * 0.3
	return -4.0

func _ai_turn(c: String) -> void:
	# Powers first, like a player would: a hut on the biggest open tile, seed
	# to the best empty tile in reach. Maul and Stampede wait for a move.
	var power_left: bool = true
	match c:
		"human":
			var best_i: int = -1
			var best_pop: int = 2
			for p: Vector2i in _tiles_of(c):
				var i: int = _idx(p)
				if not _hut[i] and int(_pop[i]) > best_pop:
					best_pop = int(_pop[i])
					best_i = i
			if best_i >= 0:
				_hut[best_i] = true
				_pop[best_i] = int(_pop[best_i]) + HUT_CLAN
				_note("The humans raise a hut.", c)
				power_left = false
		"robin":
			var best_to := Vector2i(-1, -1)
			var best_from := Vector2i(-1, -1)
			var best_v: float = 1.5
			for p: Vector2i in _tiles_of(c):
				if int(_pop[p.y * W + p.x]) < 3:
					continue
				for dy: int in range(-3, 4):
					for dx: int in range(-3, 4):
						if absi(dx) + absi(dy) > 3 or (dx == 0 and dy == 0):
							continue
						var q := p + Vector2i(dx, dy)
						if not _inside(q) or _terrain[_idx(q)] == T.ROCK or _owner[_idx(q)] != "":
							continue
						var v: float = float(_grow_at(_idx(q), _season(), c)) + 0.7 * float(_grow_at(_idx(q), mini(_season() + 1, 3), c))
						if v > best_v:
							best_v = v
							best_to = q
							best_from = p
			if best_to.x >= 0:
				_pop[_idx(best_from)] = int(_pop[_idx(best_from)]) - 2
				_owner[_idx(best_to)] = c
				_pop[_idx(best_to)] = 2
				_note("Robins carry seed to a new tile.", c)
				power_left = false
	for m: int in MOVES:
		var options: Array = []
		var charge: bool = c == "boar" and power_left
		for p: Vector2i in _tiles_of(c):
			if int(_pop[_idx(p)]) < 2:
				continue
			for n: Vector2i in _targets(p, c, charge):
				var s: float = _score_move(c, p, n, 2.0 if (c == "bear" and power_left) else 1.0)
				if s > 0.0:
					options.append([s, p, n])
		if options.is_empty():
			break
		options.sort_custom(func(a: Array, b: Array) -> bool: return float(a[0]) > float(b[0]))
		var pick: Array = options[0]
		if options.size() > 1 and randf() < 0.25:
			pick = options[randi() % mini(options.size(), 3)]
		var to: Vector2i = pick[2]
		var from: Vector2i = pick[1]
		var mult: float = 1.0
		var rival: bool = _owner[_idx(to)] != "" and _owner[_idx(to)] != c
		if c == "bear" and rival and power_left:
			mult = 2.0
			power_left = false
		if charge and not _neighbors(from).has(to):
			power_left = false
		_move(c, from, to, mult)

# --- Winter ---------------------------------------------------------------

func _winter() -> void:
	_mode = "over"
	_say("WINTER", 2.0)
	Juice.sfx(self, "fanfare", 0.8)
	var before: Dictionary = {}
	for c: String in _clans:
		before[c] = _clan_pop(c)
	for r: int in WINTER_ROUNDS:
		_feed(3, false)
	for c: String in _clans:
		(_history[c] as Array).append(_clan_pop(c))
	_wolf = Vector2i(-1, -1)
	var counts: Array = []
	for c: String in _clans:
		counts.append([c, _clan_pop(c), _tiles_of(c).size(), int(before[c])])
	counts.sort_custom(func(a: Array, b: Array) -> bool:
		return int(a[1]) > int(b[1]) if int(a[1]) != int(b[1]) else int(a[2]) > int(b[2]))
	var place: int = 0
	for i: int in counts.size():
		if counts[i][0] == _player:
			place = i
	var won: bool = place == 0
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		if won:
			gc.set_record("dominion", _player, "ruled")
		gc.award_eco_points(EP_BY_PLACE[place])
	_winter_report.clear()
	for i: int in counts.size():
		var lost: int = int(counts[i][3]) - int(counts[i][1])
		_winter_report.append("%d. %s: %d survive the snow (%d lost), %d tiles" % [i + 1, CLANS[counts[i][0]]["name"], counts[i][1], lost, counts[i][2]])
	var head: String = ("WINTER! The %s rule the valley!  +%d EP" % [CLANS[_player]["name"], EP_BY_PLACE[0]]) if won else ("Winter falls. The %s rule the valley this year. You placed %s.  +%d EP" % [CLANS[counts[0][0]]["name"], ["1st", "2nd", "3rd", "4th"][place], EP_BY_PLACE[place]])
	_status.text = head + "\n" + "\n".join(_winter_report)
	_coach_lbl.visible = false
	_forecast_lbl.visible = false
	_end_btn.text = "Play again"
	_power_btn.visible = false
	for ch in _bars.get_children():
		ch.queue_free()
	queue_redraw()

# How many of the player's clan would starve if winter came now, so the
# tipping point is visible before it tips.
func _forecast() -> int:
	var lost: int = 0
	for p: Vector2i in _tiles_of(_player):
		var i: int = _idx(p)
		var food: int = int(_food[i])
		var pop: int = int(_pop[i])
		for r: int in WINTER_ROUNDS:
			food = mini(food + _grow_at(i, 3, _player), _food_cap(i))
			var need: int = 0 if (_player == "bear" and _terrain[i] == T.FOREST) else int(ceil(float(pop) / 2.0))
			if food >= need:
				food -= need
			else:
				var short: int = need - food
				food = 0
				pop = maxi(pop - short, 0)
				lost += short
	return lost

# --- UI ----------------------------------------------------------------

func _build_side() -> void:
	if _side != null and is_instance_valid(_side):
		_side.get_parent().queue_free()
	var panel := PanelContainer.new()
	panel.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	panel.offset_left = -350
	panel.offset_top = 10
	panel.offset_bottom = -10
	panel.offset_right = -10
	add_child(panel)
	_side = VBoxContainer.new()
	_side.add_theme_constant_override("separation", 8)
	panel.add_child(_side)
	_status = FelecoUiScript.label("", 16, FelecoUiScript.CREAM)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_side.add_child(_status)
	_bars = VBoxContainer.new()
	_bars.add_theme_constant_override("separation", 3)
	_side.add_child(_bars)
	_coach_lbl = FelecoUiScript.label("", 16, FelecoUiScript.GOLD)
	_coach_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_side.add_child(_coach_lbl)
	_forecast_lbl = FelecoUiScript.label("", 14, Color(0.8, 0.9, 1.0))
	_forecast_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_side.add_child(_forecast_lbl)
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
		else:
			_end_turn())
	_side.add_child(_end_btn)
	_log_lbl = FelecoUiScript.label("", 13, FelecoUiScript.MIST)
	_log_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_log_lbl.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_side.add_child(_log_lbl)
	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", 8)
	_side.add_child(foot)
	var quit := Button.new()
	quit.text = "Clans"
	quit.theme_type_variation = "GhostButton"
	quit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	quit.pressed.connect(_show_select)
	foot.add_child(quit)
	var back := Button.new()
	back.text = "Back to Mini-Games"
	back.theme_type_variation = "GhostButton"
	back.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	back.pressed.connect(_quit_to_campaign)
	foot.add_child(back)

func _refresh() -> void:
	if _mode == "over" or _side == null:
		return
	var c: Dictionary = CLANS[_player]
	var left: int = TURNS - _turn
	_status.text = "%s  -  turn %d of %d  -  winter in %d\nYou lead the %s.  Moves left: %d" % [_season_name(), _turn + 1, TURNS, left, c["name"], _moves]
	# Clan bars: who is biggest, and how many tiles each holds.
	for ch in _bars.get_children():
		ch.queue_free()
	var most: int = 1
	for k: String in _clans:
		most = maxi(most, _clan_pop(k))
	for k: String in _clans:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		_bars.add_child(row)
		var nm := FelecoUiScript.label(CLANS[k]["name"], 13, CLANS[k]["color"])
		nm.custom_minimum_size = Vector2(64, 0)
		row.add_child(nm)
		var bar := ProgressBar.new()
		bar.max_value = most
		bar.value = _clan_pop(k)
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(150, 12)
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var fill := StyleBoxFlat.new()
		fill.bg_color = CLANS[k]["color"]
		fill.set_corner_radius_all(4)
		bar.add_theme_stylebox_override("fill", fill)
		row.add_child(bar)
		row.add_child(FelecoUiScript.label("%d  (%d tiles)" % [_clan_pop(k), _tiles_of(k).size()], 13, FelecoUiScript.CREAM))
	# The season's lesson (the step-by-step coach is drawn over the board).
	var coach: String = ""
	if _turn == 0:
		coach = "Spring: meadows grow the most food. Spread out!"
	elif _turn == 4:
		coach = "Summer: forests grow 3 food a turn now, meadows only 2%s. Start claiming forest." % (" (1 in this drought)" if _drought else "")
	elif _turn == WOLF_TURN:
		coach = "Wolves! They bite the smallest group beside them each turn. Gather up, or build where they can't reach."
	elif _turn == 8:
		coach = "Autumn: meadows barely grow. Move your clan into forests and fill their food bars before the snow."
	elif _turn >= 10:
		coach = "Winter in %d turn%s. In winter almost nothing grows: each tile lives on what it has stored." % [left, "" if left == 1 else "s"]
	_coach_lbl.text = coach
	_coach_lbl.visible = not coach.is_empty()
	var lost: int = _forecast()
	_forecast_lbl.text = ("Winter check: all %d would survive." % _clan_pop(_player)) if lost == 0 else ("Winter check: %d of %d would starve." % [lost, _clan_pop(_player)])
	_forecast_lbl.visible = _turn >= 2
	_power_btn.text = "%s%s" % [c["power"], " (used)" if _power_used else ""]
	_power_btn.tooltip_text = c["about"]
	_power_btn.disabled = _power_used
	_log_lbl.text = "\n".join(_log.slice(maxi(_log.size() - 4, 0)))
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
			elif _hut[_idx(_sel)]:
				_note("That tile already has a hut. Pick another.", _player)
				_power_used = false
			else:
				_hut[_idx(_sel)] = true
				_pop[_idx(_sel)] = int(_pop[_idx(_sel)]) + HUT_CLAN
				_note("A hut goes up. It stores %d more food and keeps the wolves out." % HUT_STORE, _player)
				_fx.append([_cell_center(_sel), "Hut!", 1.0, CLANS[_player]["color"]])
		"bear":
			_maul = true
			_note("The bears are ready to maul: the next attack hits twice as hard.", _player)
		"boar":
			_stampede = true
			_note("Stampede! Your next move can charge two tiles in a straight line.", _player)
			_say("STAMPEDE!", 1.0)
		"robin":
			_seed_flight = true
			_note("Seed Flight: click any empty tile up to 3 away from a tile with 3 or more robins.", _player)
	_refresh()

func _board_rect() -> Rect2:
	var avail := Vector2(size.x - 380, size.y - 90)
	var cell: float = minf(avail.x / W, avail.y / H)
	return Rect2(Vector2(20, 50 + (avail.y - 30.0 - cell * H) * 0.5), Vector2(cell * W, cell * H))

func _cell_center(p: Vector2i) -> Vector2:
	var r := _board_rect()
	var cell: float = r.size.x / W
	return r.position + (Vector2(p) + Vector2(0.5, 0.5)) * cell

func _cell_at(pos: Vector2) -> Vector2i:
	var r := _board_rect()
	if not r.has_point(pos):
		return Vector2i(-1, -1)
	var cell: float = r.size.x / W
	return Vector2i(int((pos.x - r.position.x) / cell), int((pos.y - r.position.y) / cell))

func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo or k.physical_keycode != KEY_ESCAPE:
		return
	if _mode == "select":
		_quit_to_campaign()
	elif _mode == "play" and _sel.x >= 0:
		# First Esc only lets go of the tile, so a slip can't end the game.
		_sel = Vector2i(-1, -1)
		_refresh()
	else:
		_show_select()

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
			if absi(mine.x - p.x) + absi(mine.y - p.y) <= 3 and int(_pop[_idx(mine)]) >= 3:
				_seed_flight = false
				_pop[_idx(mine)] = int(_pop[_idx(mine)]) - 2
				_owner[_idx(p)] = _player
				_pop[_idx(p)] = 2
				_note("Robins carry seed to a new tile.", _player)
				_fx.append([_cell_center(p), "+2", 0.9, CLANS[_player]["color"]])
				_refresh()
				return
	# (A typed array can't take an untyped [] from a ternary: that threw on
	# every click with nothing selected, so the board ignored all clicks.)
	var legal: Array[Vector2i] = []
	if _sel.x >= 0:
		legal = _targets(_sel, _player, _stampede)
	if _owner[_idx(p)] == _player and (_sel.x < 0 or not legal.has(p) or p == _sel):
		Juice.sfx(self, "click")
		_sel = p
		_refresh()
		return
	if _sel.x >= 0 and legal.has(p) and _moves > 0:
		var was_rival: bool = _owner[_idx(p)] != "" and _owner[_idx(p)] != _player
		var charged: bool = _stampede and not _neighbors(_sel).has(p)
		var owner_before: String = _owner[_idx(p)]
		if _move(_player, _sel, p, 2.0 if _maul else 1.0):
			_moves -= 1
			var at: Vector2 = _cell_center(p)
			if was_rival and _owner[_idx(p)] == _player:
				Juice.sfx(self, "capture")
				Juice.sfx(self, "bighit", 1.0, -10.0)
				_jx.burst(at, CLANS[_player]["color"], 22, 300.0)
				_jx.ring(at, Color(1, 0.9, 0.5), 70.0)
				_jx.text(at + Vector2(0, -30), "CAPTURED!", Color(1, 0.85, 0.3), 26)
				_jx.shake(0.35)
			elif was_rival:
				Juice.sfx(self, "hit")
				_jx.burst(at, Color(1, 0.4, 0.3), 12, 220.0)
				_jx.text(at + Vector2(0, -30), "Driven back!", Color(1, 0.5, 0.4), 22)
				_jx.shake(0.2)
			elif owner_before == "":
				Juice.sfx(self, "pop")
				_jx.dust(at, CLANS[_player]["color"], 8)
				_jx.ring(at, CLANS[_player]["color"], 45.0)
			else:
				Juice.sfx(self, "march")
			# Maul is spent on the first fight, win or lose; a charge on the move.
			if _maul and was_rival:
				_maul = false
			if charged:
				_stampede = false
				_fx.append([_cell_center(p), "Charge!", 1.0, CLANS[_player]["color"]])
			# Follow the clan to its new tile; if the attack failed, stay put.
			if _owner[_idx(p)] == _player:
				_sel = p
			elif _owner[_idx(_sel)] != _player or int(_pop[_idx(_sel)]) < 2:
				_sel = Vector2i(-1, -1)
		_refresh()

func _process(delta: float) -> void:
	if _mode == "select":
		return
	_t += delta
	_jx.update(delta)
	# Always redraw while playing: tiles glow and the coach pulses.
	var dirty: bool = true
	_banner_t -= delta
	for f: Array in _fx:
		f[2] -= delta
		f[0] += Vector2(0, -28) * delta
	_fx = _fx.filter(func(f: Array) -> bool: return float(f[2]) > 0.0)
	if dirty:
		queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.06, 0.08, 0.07))
	if _terrain.is_empty() or _select != null:
		return
	var r := _board_rect()
	var cell: float = r.size.x / W
	var font := FelecoUiScript.font("heading")
	var winter: bool = _mode == "over"
	var season: int = _season() if not winter else 3
	for y: int in H:
		for x: int in W:
			var p := Vector2i(x, y)
			var i: int = _idx(p)
			var rect := Rect2(r.position + Vector2(x, y) * cell, Vector2(cell, cell))
			var tc: Color = T_COLOR[_terrain[i]]
			if winter:
				tc = tc.lerp(Color(0.92, 0.95, 1.0), 0.6)
			elif season == 2 and _terrain[i] == T.MEADOW:
				tc = tc.lerp(Color(0.75, 0.65, 0.3), 0.35)
			elif _drought and season == 1 and _terrain[i] == T.MEADOW:
				tc = tc.lerp(Color(0.8, 0.7, 0.35), 0.3)
			draw_rect(rect.grow(-1), tc)
			match _terrain[i]:
				T.FOREST:
					for k: int in 3:
						draw_circle(rect.position + Vector2(0.25 + 0.25 * k, 0.4 + 0.15 * (k % 2)) * cell, cell * 0.15, tc.darkened(0.25))
				T.RIVER:
					for k: int in 3:
						var yy: float = rect.position.y + (0.25 + 0.25 * k) * cell
						draw_line(Vector2(rect.position.x + cell * 0.15, yy), Vector2(rect.position.x + cell * 0.45, yy - cell * 0.05), Color(1, 1, 1, 0.3), 2.0)
						draw_line(Vector2(rect.position.x + cell * 0.55, yy + cell * 0.04), Vector2(rect.position.x + cell * 0.85, yy), Color(1, 1, 1, 0.3), 2.0)
				T.ROCK:
					for k: int in 3:
						draw_circle(rect.position + Vector2(0.3 + 0.2 * k, 0.35 + 0.25 * (k % 2)) * cell, cell * 0.08, tc.darkened(0.3))
			# The food bar: the heart of the game.
			if _terrain[i] != T.ROCK:
				var cap: int = _food_cap(i)
				var frac: float = float(_food[i]) / float(maxi(cap, 1))
				var bar := Rect2(rect.position + Vector2(cell * 0.1, cell * 0.86), Vector2(cell * 0.8, cell * 0.08))
				draw_rect(bar, Color(0, 0, 0, 0.45))
				draw_rect(Rect2(bar.position, Vector2(bar.size.x * frac, bar.size.y)), Color(0.95, 0.35, 0.25).lerp(Color(0.45, 0.9, 0.35), frac))
			if _owner[i] != "":
				var cc: Color = CLANS[_owner[i]]["color"]
				draw_rect(rect.grow(-3), Color(cc.r, cc.g, cc.b, 0.35))
				draw_rect(rect.grow(-3), cc, false, 3.0)
				# The clan itself, bigger the more live here.
				var tex: Texture2D = Brawl.portrait(_owner[i])
				var h: float = cell * lerpf(0.4, 0.72, clampf(float(_pop[i]) / 9.0, 0.0, 1.0))
				var w: float = h * float(tex.get_width()) / float(tex.get_height())
				var at := rect.position + Vector2(cell * 0.46, cell * 0.5)
				draw_texture_rect(tex, Rect2(at - Vector2(w * 0.5, h * 0.5), Vector2(w, h)), false)
				if _hut[i]:
					var hc := rect.position + Vector2(0.8, 0.26) * cell
					draw_colored_polygon(PackedVector2Array([hc + Vector2(-0.14, 0) * cell, hc + Vector2(0, -0.14) * cell, hc + Vector2(0.14, 0) * cell]), Color(0.45, 0.3, 0.15))
					draw_rect(Rect2(hc + Vector2(-0.1, 0) * cell, Vector2(0.2, 0.12) * cell), Color(0.75, 0.6, 0.4))
				var ps: String = str(_pop[i])
				draw_string_outline(font, rect.position + Vector2(cell * 0.06, cell * 0.36), ps, HORIZONTAL_ALIGNMENT_LEFT, -1, int(cell * 0.34), 5, Color(0, 0, 0, 0.8))
				draw_string(font, rect.position + Vector2(cell * 0.06, cell * 0.36), ps, HORIZONTAL_ALIGNMENT_LEFT, -1, int(cell * 0.34), Color.WHITE)
	# Your tiles that can move glow, so it's clear what to click.
	if _mode == "play" and _sel.x < 0 and _moves > 0:
		var g: float = 0.5 + 0.5 * sin(_t * 6.0)
		for mine: Vector2i in _tiles_of(_player):
			if int(_pop[_idx(mine)]) >= 2:
				var gr := Rect2(r.position + Vector2(mine) * cell, Vector2(cell, cell))
				draw_rect(gr.grow(-2), Color(1, 1, 0.6, 0.18 * g))
				draw_rect(gr.grow(-2), Color(1, 0.95, 0.4, 0.55 + 0.45 * g), false, 6.0)
	# The wolf pack.
	if _wolf.x >= 0 and not winter:
		var wr := Rect2(r.position + Vector2(_wolf) * cell, Vector2(cell, cell))
		var pulse: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.006)
		draw_rect(wr.grow(-2), Color(1, 0.3, 0.2, 0.25 + 0.2 * pulse), false, 3.0)
		var wt: Texture2D = Brawl.portrait("wolf")
		var wh: float = cell * 0.6
		var ww: float = wh * float(wt.get_width()) / float(wt.get_height())
		draw_texture_rect(wt, Rect2(wr.position + Vector2(cell * 0.5 - ww * 0.5, cell * 0.2), Vector2(ww, wh)), false)
	if _sel.x >= 0 and not winter:
		var sr := Rect2(r.position + Vector2(_sel) * cell, Vector2(cell, cell))
		draw_rect(sr, Color(1, 1, 1), false, 4.0)
		if int(_pop[_idx(_sel)]) >= 2:
			for n: Vector2i in _targets(_sel, _player, _stampede):
				var nr := Rect2(r.position + Vector2(n) * cell, Vector2(cell, cell)).grow(-6)
				var rival: bool = _owner[_idx(n)] != "" and _owner[_idx(n)] != _player
				draw_rect(nr, Color(1, 0.5, 0.4, 0.7) if rival else Color(1, 1, 0.6, 0.6), false, 2.0)
				if rival:
					var going: int = int(_pop[_idx(_sel)]) / 2
					var atk: float = _attack_of(_player, going, 2.0 if _maul else 1.0)
					var def: float = _defence(_idx(n))
					var odds: String = "%d vs %d" % [int(round(atk)), int(round(def))]
					draw_string_outline(font, nr.position + Vector2(0, nr.size.y * 0.78), odds, HORIZONTAL_ALIGNMENT_CENTER, nr.size.x, int(cell * 0.2), 4, Color(0, 0, 0, 0.8))
					draw_string(font, nr.position + Vector2(0, nr.size.y * 0.78), odds, HORIZONTAL_ALIGNMENT_CENTER, nr.size.x, int(cell * 0.2), Color(0.6, 1.0, 0.5) if atk > def * 1.1 else (Color(1, 0.95, 0.5) if atk > def * 0.9 else Color(1, 0.55, 0.45)))
		else:
			draw_string(font, Vector2(r.position.x, r.end.y + 36), "Only one here: a tile needs 2 or more to send half on.", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1, 0.8, 0.5))
	for f: Array in _fx:
		var a: float = clampf(float(f[2]), 0.0, 1.0)
		draw_string_outline(font, (f[0] as Vector2) - Vector2(80, 0), f[1], HORIZONTAL_ALIGNMENT_CENTER, 160, 22, 6, Color(0, 0, 0, a))
		draw_string(font, (f[0] as Vector2) - Vector2(80, 0), f[1], HORIZONTAL_ALIGNMENT_CENTER, 160, 22, Color(f[3], a))
	if _hover.x >= 0 and _mode == "play":
		var hi: int = _idx(_hover)
		var tip: String
		if _terrain[hi] == T.ROCK:
			tip = "Rock: nothing grows and nobody lives here."
		else:
			var who: String = ""
			if _owner[hi] != "":
				who = "   %s %d, eating %d a turn" % [CLANS[_owner[hi]]["name"], _pop[hi], _need(hi, season)]
			tip = "%s: food %d of %d, grows %d this %s%s%s" % [T_NAME[_terrain[hi]], _food[hi], _food_cap(hi), _grow_at(hi, season, _owner[hi] if _owner[hi] != "" else _player), _season_name().to_lower(), "  (hut)" if _hut[hi] else "", who]
		draw_string(font, Vector2(r.position.x, r.end.y + 18), tip, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, FelecoUiScript.CREAM)
	if _mode == "play":
		_draw_coach(r, font)
	draw_set_transform_matrix(Transform2D(0.0, _jx.offset()))
	_jx.draw(self)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	if winter:
		_draw_history(r, font)
	if _banner_t > 0.0:
		var a: float = clampf(_banner_t, 0.0, 1.0)
		draw_string_outline(font, Vector2(r.position.x, r.position.y + r.size.y * 0.5), _banner, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 84, 14, Color(0, 0, 0, 0.8 * a))
		draw_string(font, Vector2(r.position.x, r.position.y + r.size.y * 0.5), _banner, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, 84, Color(1, 0.95, 0.75, a))

# One big line over the board saying exactly what to do next.
func _draw_coach(r: Rect2, font: Font) -> void:
	var step: String
	if _seed_flight:
		step = "Seed Flight: click any empty tile up to 3 away."
	elif _moves <= 0:
		step = "Out of moves: press END TURN."
	elif _sel.x < 0:
		step = "Click one of your GLOWING tiles."
	elif int(_pop[_idx(_sel)]) < 2:
		step = "Only 1 here. Pick a tile with 2 or more."
	else:
		step = "Click a YELLOW tile: half your clan moves there. (%d move%s left)" % [_moves, "" if _moves == 1 else "s"]
	var a: float = 0.85 + 0.15 * sin(_t * 4.0)
	var box := Rect2(r.position.x, r.position.y - 4, r.size.x, 40)
	draw_rect(box, Color(0, 0, 0, 0.55))
	draw_string_outline(font, box.position + Vector2(0, 29), step, HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 24, 6, Color(0, 0, 0, 0.8))
	draw_string(font, box.position + Vector2(0, 29), step, HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 24, Color(1, 0.92, 0.5, a))

# The year's story: every clan's numbers, turn by turn, over the frozen board.
func _draw_history(r: Rect2, font: Font) -> void:
	var box := Rect2(r.position + r.size * Vector2(0.1, 0.12), r.size * Vector2(0.8, 0.76))
	draw_rect(box, Color(0.06, 0.09, 0.07, 0.9))
	draw_rect(box, FelecoUiScript.GOLD, false, 3.0)
	draw_string(font, box.position + Vector2(0, 32), "The year, clan by clan", HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 24, FelecoUiScript.GOLD)
	var plot := Rect2(box.position + Vector2(50, 50), box.size - Vector2(70, 90))
	var most: int = 1
	var n: int = 1
	for c: String in _clans:
		for v in _history[c]:
			most = maxi(most, int(v))
		n = maxi(n, (_history[c] as Array).size())
	for k: int in 4:
		var yy: float = plot.end.y - plot.size.y * k / 3.0
		draw_line(Vector2(plot.position.x, yy), Vector2(plot.end.x, yy), Color(1, 1, 1, 0.12), 1.0)
		draw_string(font, Vector2(plot.position.x - 44, yy + 5), str(int(most * k / 3.0)), HORIZONTAL_ALIGNMENT_RIGHT, 40, 13, FelecoUiScript.MIST)
	# Season bands.
	for s: int in 4:
		var x0: float = plot.position.x + plot.size.x * (s * 4.0) / maxf(n - 1, 1.0)
		var x1: float = plot.position.x + plot.size.x * minf((s + 1) * 4.0, n - 1) / maxf(n - 1, 1.0)
		if x0 < plot.end.x:
			draw_string(font, Vector2(x0, plot.end.y + 20), SEASON_NAME[s], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, FelecoUiScript.MIST)
			if s % 2 == 1:
				draw_rect(Rect2(x0, plot.position.y, x1 - x0, plot.size.y), Color(1, 1, 1, 0.04))
	for c: String in _clans:
		var h: Array = _history[c]
		var pts := PackedVector2Array()
		for k: int in h.size():
			pts.append(Vector2(plot.position.x + plot.size.x * k / maxf(n - 1, 1.0), plot.end.y - plot.size.y * float(h[k]) / float(most)))
		if pts.size() >= 2:
			draw_polyline(pts, CLANS[c]["color"], 4.0 if c == _player else 2.5, true)
		if not pts.is_empty():
			draw_circle(pts[pts.size() - 1], 6.0, CLANS[c]["color"])
			draw_string(font, pts[pts.size() - 1] + Vector2(10, 5), "%s %d" % [CLANS[c]["name"], h[h.size() - 1]], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, CLANS[c]["color"])

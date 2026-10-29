class_name ValleySaga
extends Node

# The Valley Saga: Enter the Valley as a five-year story you can beat.
#   Year goals  each year has one big goal, shown at the top of Goals. Meet
#               4 of the 5 and you have beaten FelEco.
#   Dilemmas    every dawn the valley pauses on a choice with two answers,
#               each changing the valley in a way you can see.
#   Quests      three short daily goals, refilled each dawn, worth EP.
# Progress lives in the records ("saga"): the year, which goals were met,
# and whether the next run carries this valley on (Continue).

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const YEARS_TO_WIN: int = 4
# [title, goal text, kind, amount].
const YEARS: Array = [
	["Year 1: Find Your Feet", "Your champion's group rules the most days", "champion_end", 0],
	["Year 2: Balance", "No species dies out this year", "no_extinct", 0],
	["Year 3: The Hungry Year", "A drought comes. Keep 8 species with 5 or more alive", "diverse", 8],
	["Year 4: The Golden Year", "Gold is everywhere: make 8 golden finds", "golden", 8],
	["Year 5: Crown of the Valley", "Your champion's group rules for 5 days or more", "rule_days", 5],
]
const SAGA_WIN_EP: int = 500
const YEAR_GOAL_EP: int = 120

var director: SimulationDirector
var hud: Node
var year: int = 1
var met: Array = []
var _extinct: int = 0
var _quests: Array = []
var _drought_done: bool = false
var _dilemma_layer: CanvasLayer
var _used: Dictionary = {}
var _last_night: bool = false

# --- Saved state ---------------------------------------------------------

static func state(gc: Node) -> Dictionary:
	var s = gc.record("saga", "state") if gc != null else null
	return (s as Dictionary).duplicate(true) if s is Dictionary else {"year": 1, "met": [], "carry": false, "beaten": false}

static func save_state(gc: Node, s: Dictionary) -> void:
	if gc != null:
		gc.set_record("saga", "state", s)

func _ready() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var s := state(gc)
	# A fresh Enter the Valley starts the saga over; Continue/Replay carry it.
	if not bool(s.get("carry", false)):
		s = {"year": 1, "met": [], "carry": false, "beaten": bool(s.get("beaten", false))}
	s["carry"] = false
	save_state(gc, s)
	year = clampi(int(s["year"]), 1, YEARS.size())
	met = s["met"]
	director.extinction_event.connect(func(_sp: String) -> void: _extinct += 1)
	director.combat_event.connect(_on_combat)
	director.golden_found.connect(func(_k: String, _e: String, _p: Vector3) -> void: _quest_hit("golden"))
	director.agent_born.connect(_on_born)
	director.rampage_result.connect(func(_w: String, _k: int, won: bool) -> void:
		if won:
			_quest_hit("rampage"))
	director.daypart_changed.connect(_on_daypart)
	if year == 4:
		director.golden_mult *= 3.0
	_new_quests()
	FXManager.show_dramatic_text(Vector3.ZERO, YEARS[year - 1][0].to_upper(), FelecoUiScript.GOLD)

func _champion() -> String:
	var gc: Node = get_node_or_null("/root/GameConfig")
	return String(gc.player_bet).to_lower() if gc != null else "sheep"

func _champion_plural() -> String:
	var c := _champion()
	return {"wolf": "wolves", "human": "humans", "falcon": "falcons", "robin": "robins", "boar": "boars", "worm": "worms", "rabbit": "rabbits"}.get(c, SpeciesDB.plural(c))

# --- The year goal ------------------------------------------------------------

# [progress 0..1, a short status line].
func year_progress() -> Array:
	var y: Array = YEARS[year - 1]
	var counts: Dictionary = director.get_creature_counts()
	match String(y[2]):
		"champion_end":
			var lead: String = director.ruling_group()
			var want: String = SpeciesDB.group_of(SpeciesDB.id_for(_champion_plural()))
			var ok: bool = lead == want and not lead.is_empty()
			var lead_name: String = SpeciesDB.GROUP_LABEL.get(lead, "nobody")
			return [1.0 if ok else 0.4, "Ruling now: %s" % lead_name]
		"no_extinct":
			return [0.0 if _extinct > 0 else 1.0, "Lost so far: %d species" % _extinct]
		"diverse":
			var n: int = 0
			for v in counts.values():
				if int(v) >= 5:
					n += 1
			return [clampf(float(n) / float(y[3]), 0.0, 1.0), "%d of %d species at 5+" % [n, int(y[3])]]
		"golden":
			return [clampf(float(director.golden_finds) / float(y[3]), 0.0, 1.0), "%d of %d golden finds" % [director.golden_finds, int(y[3])]]
		"rule_days":
			var grp: String = SpeciesDB.group_of(SpeciesDB.id_for(_champion_plural()))
			var d: float = float(director.control_days.get(grp, 0.0))
			return [clampf(d / float(y[3]), 0.0, 1.0), "%s ruled %.1f of %d days" % [SpeciesDB.GROUP_LABEL.get(grp, grp), d, int(y[3])]]
	return [0.0, ""]

func year_met() -> bool:
	return float(year_progress()[0]) >= 0.999

# Called by the end screen: records this year. Returns a summary dictionary.
func finish_year() -> Dictionary:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var ok: bool = year_met()
	met.append(ok)
	if ok and gc != null:
		gc.award_eco_points(YEAR_GOAL_EP)
	var count: int = met.count(true)
	var beaten: bool = false
	var over: bool = year >= YEARS.size()
	var s := state(gc)
	if over and count >= YEARS_TO_WIN:
		beaten = true
		if gc != null and not bool(s.get("beaten", false)):
			gc.award_eco_points(SAGA_WIN_EP)
	s = {"year": year, "met": met, "carry": false, "beaten": beaten or bool(s.get("beaten", false))}
	save_state(gc, s)
	return {"year": year, "title": YEARS[year - 1][0], "goal": YEARS[year - 1][1], "met": ok, "count": count, "over": over, "beaten": beaten}

# The end screen's Continue: next year, this valley's creatures carried on.
static func continue_saga(gc: Node, director: SimulationDirector, replay: bool) -> void:
	var s := state(gc)
	if not replay:
		if int(s["year"]) >= YEARS.size():
			s = {"year": 1, "met": [], "carry": true, "beaten": bool(s.get("beaten", false))}
		else:
			s["year"] = int(s["year"]) + 1
	elif (s["met"] as Array).size() >= int(s["year"]):
		# Replaying a year forgets its last result.
		(s["met"] as Array).pop_back()
	s["carry"] = true
	save_state(gc, s)
	if director == null or replay:
		return
	# The valley goes on: every species starts the new year as it ended the
	# last, give or take (two migrants wander back into an empty niche).
	var counts: Dictionary = director.get_creature_counts()
	var keep := func(plural: String, fallback: int) -> int:
		return clampi(int(counts.get(plural, fallback)), 2, 40)
	gc.sheep_count = keep.call("sheep", gc.sheep_count)
	gc.wolf_count = keep.call("wolves", gc.wolf_count)
	gc.human_count = keep.call("humans", gc.human_count)
	gc.falcon_count = keep.call("falcons", gc.falcon_count)
	gc.robin_count = keep.call("robins", gc.robin_count)
	gc.boar_count = keep.call("boars", gc.boar_count)
	gc.worm_count = keep.call("worms", gc.worm_count)
	gc.rabbit_count = keep.call("rabbits", gc.rabbit_count)
	gc.fish_count = keep.call("fish", gc.fish_count)
	for id: String in SpeciesDB.NEW_SPECIES:
		gc.extra_counts[id] = keep.call(SpeciesDB.plural(id), int(gc.extra_counts.get(id, 4)))

# --- Daily quests -------------------------------------------------------------

# [id, text, EP]
const QUEST_POOL: Array = [
	["hunt", "Watch a hunt end in a catch", 20],
	["golden", "Spot a golden find", 30],
	["power", "Use a power on the valley", 20],
	["birth", "See a %s born", 20],
	["rampage", "Win a golden rampage", 50],
	["card", "Open a creature's card", 10],
	["grow", "Grow your champion past %d", 40],
]

func _new_quests() -> void:
	_quests = _quests.filter(func(q: Dictionary) -> bool: return not q["done"])
	var pool: Array = QUEST_POOL.duplicate()
	pool.shuffle()
	for q: Array in pool:
		if _quests.size() >= 3:
			break
		if _quests.any(func(x: Dictionary) -> bool: return x["id"] == q[0]):
			continue
		var text: String = q[1]
		var target: int = 0
		if q[0] == "birth":
			text = text % SpeciesDB.one(_champion())
		elif q[0] == "grow":
			target = int(director.get_creature_counts().get(_champion_plural(), 0)) + 4
			text = text % target
		_quests.append({"id": q[0], "text": text, "ep": q[2], "done": false, "target": target})
	_refresh()

func _quest_hit(id: String) -> void:
	for q: Dictionary in _quests:
		if q["id"] == id and not q["done"]:
			q["done"] = true
			var gc: Node = get_node_or_null("/root/GameConfig")
			if gc != null:
				gc.award_eco_points(int(q["ep"]))
			FXManager.show_dramatic_text(Vector3.ZERO, "Quest done: %s  +%d EP" % [q["text"], q["ep"]], Color(0.62, 0.9, 0.5))
			_refresh()

func _on_combat(_a: String, _t: String, _p: Vector3, killed: bool) -> void:
	if killed:
		_quest_hit("hunt")

func _on_born(species: String, _p: Vector3, _v: String) -> void:
	if species == _champion():
		_quest_hit("birth")

func _process(_delta: float) -> void:
	if hud != null and int(hud.get("power_uses")) > 0:
		_quest_hit("power")
	if hud != null and hud.get("_follow_panel") != null and is_instance_valid(hud.get("_follow_panel")):
		_quest_hit("card")
	for q: Dictionary in _quests:
		if q["id"] == "grow" and not q["done"] and int(director.get_creature_counts().get(_champion_plural(), 0)) >= int(q["target"]):
			_quest_hit("grow")
	# The Hungry Year's drought.
	if year == 3 and not _drought_done and director.get_day() >= 3.0:
		_drought_done = true
		director.trigger_drought()

func quests() -> Array:
	return _quests

func _refresh() -> void:
	var gp: Node = get_tree().get_first_node_in_group("goals_panel")
	if gp != null and gp.has_method("refresh_saga"):
		gp.refresh_saga()

# --- Dawn dilemmas ------------------------------------------------------------

func _on_daypart(night: bool) -> void:
	var dawn: bool = _last_night and not night
	_last_night = night
	if not dawn or director.get_day() < 0.8:
		return
	_new_quests()
	_show_dilemma(_pick_dilemma())

func _count(plural: String) -> int:
	return int(director.get_creature_counts().get(plural, 0))

# The day's question, picked from what is really happening in the valley.
func _pick_dilemma() -> Dictionary:
	var c := _champion_plural()
	var options: Array = []
	var herb: int = _count("sheep") + _count("deer") + _count("goats") + _count("rabbits")
	var preds: int = _count("wolves") + _count("lions")
	if preds > herb * 0.6 and not _used.has("wolves"):
		options.append({"id": "wolves", "title": "The hunters are everywhere", "text": "There are %d hunters for %d grazers. The herds won't last." % [preds, herb],
			"a": ["Drive a third of the wolves into the hills", -15, func() -> void: _remove("wolf", 0.33)],
			"b": ["Nature's way: let them hunt", 10, func() -> void: pass]})
	if herb > 45 and not _used.has("herd"):
		options.append({"id": "herd", "title": "The meadow is overgrazed", "text": "%d grazers are stripping the grass bare." % herb,
			"a": ["Open the passes: 4 wolves come down", 10, func() -> void: _spawn("wolf", 4)],
			"b": ["Sow new grass everywhere", -20, func() -> void: _grass(0.35)]})
	if _count(c) < 6 and not _used.has("weak"):
		options.append({"id": "weak", "title": "Your champion is struggling", "text": "Only %d %s are left." % [_count(c), c],
			"a": ["Call 4 more %s home" % c, -25, func() -> void: _spawn(_champion(), 4)],
			"b": ["Trust them to pull through", 15, func() -> void: pass]})
	if not _used.has("gold"):
		options.append({"id": "gold", "title": "Golden grass sprouts!", "text": "A patch of golden grass glints in the meadow. Gold passes up the food web as it's eaten.",
			"a": ["Plant it near your %s" % c, 0, func() -> void: _gold_near(_champion())],
			"b": ["Sell it at market", 30, func() -> void: pass]})
	if not _used.has("visitors"):
		options.append({"id": "visitors", "title": "Travellers at the pass", "text": "Animals from the next valley ask to come in.",
			"a": ["Welcome 4 deer", 0, func() -> void: _spawn("deer", 4)],
			"b": ["Welcome 2 bears", 0, func() -> void: _spawn("bear", 2)]})
	if not _used.has("sick"):
		var big: String = BetBook.leader(director.get_creature_counts())
		if not big.is_empty() and _count(big) > 12:
			options.append({"id": "sick", "title": "A cough in the %s" % big, "text": "The biggest crowd in the valley is the first to fall ill.",
				"a": ["Quarantine: lose 3 now, stop the spread", 0, func() -> void: _remove_plural(big, 3)],
				"b": ["Let it run its course", 0, func() -> void: _remove_plural(big, int(_count(big) * 0.25))]})
	if not _used.has("rain"):
		options.append({"id": "rain", "title": "Dry skies", "text": "The grass is thirsty. A rain dance costs EP but greens the whole valley.",
			"a": ["Rain dance", -20, func() -> void: _grass(0.4)],
			"b": ["Save your EP", 0, func() -> void: pass]})
	if options.is_empty():
		_used.clear()
		return _pick_dilemma()
	var pick: Dictionary = options[0] if options.size() <= 2 else options[randi() % mini(options.size(), 3)]
	_used[pick["id"]] = true
	return pick

func _show_dilemma(d: Dictionary) -> void:
	if _dilemma_layer != null and is_instance_valid(_dilemma_layer):
		_dilemma_layer.queue_free()
	var gc: Node = get_node_or_null("/root/GameConfig")
	_dilemma_layer = CanvasLayer.new()
	_dilemma_layer.layer = 30
	_dilemma_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(_dilemma_layer)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_dilemma_layer.add_child(shade)
	shade.theme = FelecoUiScript.theme()
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.97)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(18)
	sb.set_content_margin_all(24)
	card.add_theme_stylebox_override("panel", sb)
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(620, 0)
	shade.add_child(card)
	HudWindow.movable(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	card.add_child(col)
	var day := FelecoUiScript.label("Dawn, day %d  -  the valley asks you" % int(director.get_day() + 1.0), 15, FelecoUiScript.MIST)
	col.add_child(day)
	col.add_child(FelecoUiScript.heading(d["title"], 30, FelecoUiScript.GOLD))
	var body := FelecoUiScript.label(d["text"], 18, FelecoUiScript.CREAM)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(body)
	for key: String in ["a", "b"]:
		var opt: Array = d[key]
		var ep: int = int(opt[1])
		var b := Button.new()
		b.text = "%s%s" % [opt[0], ("   (%+d EP)" % ep) if ep != 0 else ""]
		b.custom_minimum_size = Vector2(0, 54)
		b.theme_type_variation = "PrimaryButton" if key == "a" else ""
		b.disabled = ep < 0 and gc != null and int(gc.eco_points) < -ep
		b.pressed.connect(func() -> void:
			if gc != null and ep != 0:
				if ep > 0:
					gc.award_eco_points(ep)
				else:
					gc.spend_eco_points(-ep)
			(opt[2] as Callable).call()
			Juice.sfx(self, "chime")
			director.chronicle.emit("You chose: %s." % opt[0])
			_dilemma_layer.queue_free()
			get_tree().paused = false)
		col.add_child(b)
	get_tree().paused = true
	Juice.sfx(self, "pop")

# --- Effects ------------------------------------------------------------------

func _spawn(id: String, n: int) -> void:
	for i: int in n:
		var p := director.dry_land(Vector3(randf_range(-22, 22), 0, randf_range(-22, 22)))
		var a := director.spawn_scripted(id, p)
		if a != null:
			a.scripted = false
			a.set_state(a._current_state)
	FXManager.show_dramatic_text(Vector3.ZERO, "+%d %s" % [n, SpeciesDB.plural(id)], Color(0.6, 0.9, 0.5))

func _remove(id: String, frac: float) -> void:
	_remove_plural(SpeciesDB.plural(id), int(ceil(_count(SpeciesDB.plural(id)) * frac)))

func _remove_plural(plural: String, n: int) -> void:
	var gone: int = 0
	for data: AgentData in director._agent_registry.duplicate():
		if gone >= n:
			break
		if SpeciesDB.plural(data.species) == plural and data.node != null and is_instance_valid(data.node) and data.node.has_method("die"):
			data.node.die()
			gone += 1

func _grass(amount: float) -> void:
	for i: int in 80:
		director.grass.add_density_at_world(Vector3(randf_range(-28, 28), 0, randf_range(-28, 28)), amount)
	FXManager.show_dramatic_text(Vector3.ZERO, "The meadow greens!", Color(0.5, 0.9, 0.4))

func _gold_near(id: String) -> void:
	var at := Vector3.ZERO
	for data: AgentData in director._agent_registry:
		if data.species == id and data.node != null and is_instance_valid(data.node):
			at = (data.node as Node3D).global_position
			break
	for i: int in 6:
		director.grass.seed_golden(at + Vector3(randf_range(-4, 4), 0, randf_range(-4, 4)), 1.0)
	FXManager.show_dramatic_text(at + Vector3.UP * 2.0, "Golden grass!", FelecoUiScript.GOLD)

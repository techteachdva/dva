extends CanvasLayer

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

var _director: SimulationDirector = null
# Creatures the player has money on: {AgentData: ground ring}.
var _bet_rings: Dictionary = {}
var _side_bet_pulse: float = 0.0
var _shown_touches: int = -1

# 3.0: one power for each link of the food web, plus the weather.
const POWERUP_BUTTONS: Dictionary = {
	"Bloom": "bloom",
	"Stampede": "stampede",
	"Call": "predator_call",
	"Feast": "feast",
	"RotRain": "rot_rain",
	"Rain": "rain",
	"Drought": "drought",
	"Flood": "flood",
	"Eclipse": "eclipse",
	"Gale": "gale",
	"Meteor": "meteor",
}
# Scene buttons from before 3.0 that are no longer offered.
const RETIRED_BUTTONS: Array[String] = ["Heal", "Famine"]
const POWER_LABELS: Dictionary = {"Call": "Call Kin", "RotRain": "Rot Rain"}
# Every power has its own icon (assets/icons).
const POWER_ICONS: Dictionary = {
	"Bloom": "power_bloom", "Stampede": "power_stampede", "Call": "power_call", "Feast": "power_feast",
	"RotRain": "power_rot_rain", "Rain": "rain", "Drought": "power_drought", "Flood": "flood",
	"Eclipse": "power_eclipse", "Gale": "power_gale", "Meteor": "meteor",
}
# Release 10 (4.7.1): what a pack of ten costs. Apex hunters cost double.
const PACK_SIZE: int = 10
const PACK_COST: int = 30
const PACK_APEX: Array[String] = ["lion", "bear", "wolf", "falcon"]
const POWER_TIPS: Dictionary = {
	"Gale": "The wind howls for half a day from a random quarter: seeds fly far.",
	"Bloom": "Bloom (producers): the meadow, the woods and the moss all surge at once.",
	"Stampede": "Stampede (herbivores): the herds panic and scatter across the valley.",
	"Call": "Call Kin: a few more of your champion's kind arrive.",
	"Feast": "Feast (omnivores): every bear, boar, robin and villager eats its fill.",
	"RotRain": "Rot Rain (decomposers): the soil teems; mushrooms, worms and beetles surface.",
	"Rain": "Rain: grass surges for a day; worms and mushrooms love it, falcons hunt blind.",
	"Drought": "Drought: the meadow bakes and the moss shrivels for a day and a half.",
	"Flood": "Flood: the river rises for half a day. Fish left on dry land add to the Flood Toll.",
	"Eclipse": "Eclipse: night falls at once for half a day. The night hunters rejoice.",
}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var world: Node3D = get_tree().current_scene.get_node_or_null("World")
	if world != null:
		_director = world as SimulationDirector
		if _director != null:
			_director.population_changed.connect(_on_pop_changed)
			_director.time_updated.connect(_on_time_updated)
			_director.simulation_ended.connect(_on_sim_ended)
			_director.rampage_result.connect(_on_rampage_result)
			_director.season_event.connect(_on_season_event)
			_director.control_changed.connect(_on_rule_changed)

	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		_refresh_champion()
		if not gc.side_bet_entity.is_empty():
			var sb_name: String = gc.side_bet_entity.get("name", "")
			var sb_species: String = gc.side_bet_entity.get("species", "")
			var sb_type: String = gc.side_bet_entity.get("bet_type", "")
			$TopRight/VBoxContainer/SideBetLabel.text = "Side Bet: %s the %s (%s)" % [sb_name, sb_species.capitalize(), sb_type.to_upper()]
			$TopRight/VBoxContainer/SideBetLabel.modulate = Color(1.0, 0.8, 0.0)
		call_deferred("_setup_side_bet_marker")

	# Top speed is 4x (a 15-second day); any faster and day and night flicker.
	$BottomBar/Speed1.pressed.connect(func() -> void: Engine.time_scale = Clock.SPEEDS[0])
	$BottomBar/Speed2.pressed.connect(func() -> void: Engine.time_scale = Clock.SPEEDS[1])
	$BottomBar/Speed5.pressed.connect(func() -> void: Engine.time_scale = Clock.SPEEDS[2])
	$BottomBar/Speed5.text = "%dx" % int(Clock.SPEEDS[2])
	_build_power_tray()
	$TopLeft/VBox/WizardCount.text = "%s  0" % ["Shamans" if EraBook.id() == "lost" else "Wizards"]
	Engine.time_scale = Clock.DEFAULT_SPEED
	$BottomBar/Pause.pressed.connect(_toggle_pause)
	$BottomBar/EndEarly.pressed.connect(_end_early)
	$BottomBar/TopDown.pressed.connect(_snap_top_down)
	$BottomBar/TopDown.tooltip_text = "Look straight down. Right-drag orbits, scroll zooms, WASD moves."
	$BottomBar/History.pressed.connect(_open_history)
	$BottomBar/Speed1.tooltip_text = "Standard pace: a day of sun and moon takes two minutes."
	$BottomBar/Speed2.tooltip_text = "Faster: a day takes one minute."
	$BottomBar/Speed5.tooltip_text = "Fast: a day of sun and moon takes 30 seconds."
	$BottomBar/Pause.tooltip_text = "Hold the valley still."
	$BottomBar/EndEarly.tooltip_text = "End the run and score the bets now."
	$BottomBar/History.tooltip_text = "Read births, deaths, and settlements."
	_power_btn("Rain").tooltip_text = "A rain that makes the grass surge."
	_power_btn("Call").tooltip_text = "Call wolves toward the herds."
	_power_btn("Heal").tooltip_text = "Mend the creature you are watching."
	_power_btn("Famine").tooltip_text = "Starve the grass for a stretch."
	_power_btn("Meteor").tooltip_text = "Pick a spot and call down a meteor. It cracks open into a crater of Rainbow Starfruit."
	_power_btn("Rain").pressed.connect(_trigger_rain)
	_power_btn("Call").pressed.connect(_trigger_predator_call)
	_power_btn("Heal").pressed.connect(_trigger_heal)
	_power_btn("Famine").pressed.connect(_trigger_famine)
	_power_btn("Meteor").pressed.connect(_trigger_meteor)
	_power_btn("Flood").pressed.connect(_trigger_flood)


	_update_powerup_buttons()
	_build_goals()
	_build_hill_bars()
	_add_bets_button()
	_refresh_tuned_badge()

	# Tooltip for paused hover inspection
	var tooltip := Panel.new()
	tooltip.name = "Tooltip"
	tooltip.custom_minimum_size = Vector2(280, 160)
	tooltip.anchors_preset = Control.PRESET_TOP_LEFT
	tooltip.size = Vector2(280, 160)
	tooltip.visible = false
	tooltip.z_index = 200
	var ttstyle := StyleBoxFlat.new()
	ttstyle.bg_color = Color(0.09, 0.125, 0.102, 0.94)
	ttstyle.border_color = Color(0.902, 0.765, 0.416, 0.8)
	ttstyle.set_border_width_all(1)
	ttstyle.set_corner_radius_all(16)
	ttstyle.content_margin_left = 12
	ttstyle.content_margin_right = 12
	ttstyle.content_margin_top = 10
	ttstyle.content_margin_bottom = 10
	tooltip.add_theme_stylebox_override("panel", ttstyle)
	var ttm := MarginContainer.new()
	ttm.name = "MarginContainer"
	ttm.custom_minimum_size = Vector2(260, 140)
	ttm.anchors_preset = Control.PRESET_FULL_RECT
	ttm.add_theme_constant_override("margin_left", 8)
	ttm.add_theme_constant_override("margin_top", 8)
	ttm.add_theme_constant_override("margin_right", 8)
	ttm.add_theme_constant_override("margin_bottom", 8)
	tooltip.add_child(ttm)
	var ttlabel := RichTextLabel.new()
	ttlabel.name = "TooltipLabel"
	ttlabel.custom_minimum_size = Vector2(240, 120)
	ttlabel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ttlabel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	ttlabel.bbcode_enabled = true
	ttlabel.scroll_active = false
	ttlabel.autowrap_mode = TextServer.AUTOWRAP_OFF
	ttm.add_child(ttlabel)
	add_child(tooltip)
	FelecoUiScript.dress_hud(self)
	_style_roster()
	_mark_dock()
	_refresh_champion()
	_build_rail()

# Live betting: the Bets button pauses the valley and opens the table over it.
var _bets_button: Button
var _was_paused: bool = false

func _add_bets_button() -> void:
	_bets_button = Button.new()
	_bets_button.name = "Bets"
	_bets_button.text = "Quests"
	_bets_button.tooltip_text = "The quest board. Accept a main quest and any side quests. Missing one gains nothing."
	_bets_button.theme_type_variation = "PrimaryButton"
	_bets_button.custom_minimum_size = Vector2(120, 56)
	_bets_button.pressed.connect(_open_bets)
	if _director != null and _director.bet_tracker != null:
		_director.bet_tracker.bet_settled.connect(func(_b: Dictionary) -> void: _refresh_bet_line())
	_refresh_bet_line()

func _refresh_bet_line() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null or gc.bets.is_empty():
		return
	var open: int = 0
	var won: int = 0
	for b: Dictionary in gc.bets:
		if b["state"] == "open":
			open += 1
		elif b["state"] == "won":
			won += int(b["payout"])
	var line: Label = $TopRight/VBoxContainer/SideBetLabel
	line.text = "Quests: %d open" % open
	line.modulate = Color(1.0, 0.85, 0.4)

func _open_bets() -> void:
	if _director == null or _director._simulation_ended or has_node("LiveTable"):
		return
	_was_paused = get_tree().paused
	get_tree().paused = true
	# Its own canvas layer above the ticker and toasts, so nothing draws over the felt.
	var layer := CanvasLayer.new()
	layer.name = "LiveTable"
	layer.layer = 60
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(layer)
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and gc.current_mode != "challenge" and gc.current_mode != "campaign":
		gc.board_mode = "full"
		var board := QuestBoard.new()
		board.live = true
		board.set_anchors_preset(Control.PRESET_FULL_RECT)
		layer.add_child(board)
		board.tree_exited.connect(func() -> void:
			# Null when the whole scene is changing, not just the board closing.
			if is_instance_valid(layer) and is_inside_tree():
				get_tree().paused = _was_paused
				layer.queue_free()
			_refresh_bet_line())
		return
	var table := BettingTable.new()
	table.live = true
	table.tracker = _director.bet_tracker
	table.closed.connect(func() -> void:
		get_tree().paused = _was_paused
		layer.queue_free()
		_refresh_bet_line())
	layer.add_child(table)

# The powers live in a tray that pops up from the dock, so the bottom of the
# screen stays clear (and fits a phone) until you reach for one.
var _tray: PanelContainer
var _tray_flow: HFlowContainer
var _tray_button: Button

func _power_btn(btn_name: String) -> Button:
	if _tray_flow != null and _tray_flow.has_node(btn_name):
		return _tray_flow.get_node(btn_name) as Button
	return $BottomBar.get_node_or_null(btn_name) as Button

func _build_power_tray() -> void:
	_tray = PanelContainer.new()
	_tray.name = "PowerTray"
	_tray.visible = false
	_tray.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_tray.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_tray.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_tray.offset_top = -260
	_tray.offset_bottom = -190
	_tray.offset_left = -360
	_tray.offset_right = 360
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.1, 0.08, 0.95)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(20)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 12)
	_tray.add_theme_stylebox_override("panel", sb)
	add_child(_tray)
	var tray_col := VBoxContainer.new()
	tray_col.add_theme_constant_override("separation", 10)
	_tray.add_child(tray_col)
	_tray_flow = HFlowContainer.new()
	_tray_flow.alignment = FlowContainer.ALIGNMENT_CENTER
	_tray_flow.add_theme_constant_override("h_separation", 8)
	_tray_flow.add_theme_constant_override("v_separation", 8)
	tray_col.add_child(_tray_flow)
	tray_col.add_child(_build_release_row())
	var handlers: Dictionary = {
		"Eclipse": _trigger_eclipse,
		"Gale": _trigger_simple.bind("gale", "trigger_gale"),
		"Bloom": _trigger_simple.bind("bloom", "trigger_bloom"),
		"Stampede": _trigger_simple.bind("stampede", "trigger_stampede"),
		"Feast": _trigger_simple.bind("feast", "trigger_feast"),
		"RotRain": _trigger_simple.bind("rot_rain", "trigger_rot_rain"),
		"Drought": _trigger_simple.bind("drought", "trigger_drought"),
	}
	for old: String in RETIRED_BUTTONS:
		var gone: Node = $BottomBar.get_node_or_null(old)
		if gone != null:
			gone.queue_free()
	for btn_name: String in POWERUP_BUTTONS.keys():
		var btn: Button = $BottomBar.get_node_or_null(btn_name) as Button
		if btn == null:
			btn = Button.new()
			btn.name = btn_name
			btn.pressed.connect(handlers[btn_name])
		else:
			$BottomBar.remove_child(btn)
		btn.pressed.connect(func() -> void: _tray.visible = false)
		if POWER_ICONS.has(btn_name):
			btn.icon = load("res://assets/icons/%s.svg" % POWER_ICONS[btn_name])
			btn.expand_icon = false
			btn.add_theme_constant_override("icon_max_width", 34)
			btn.add_theme_constant_override("h_separation", 8)
		_tray_flow.add_child(btn)
	_tray_button = Button.new()
	_tray_button.text = "Powers"
	_tray_button.tooltip_text = "A power for each link of the food web, and the weather. One is free each season."
	_tray_button.custom_minimum_size = Vector2(130, 52)
	FelecoUiScript.mark(_tray_button, "TouchButton")
	_tray_button.pressed.connect(func() -> void:
		_tray.visible = not _tray.visible
		_refresh_pack()
		_update_powerup_buttons())

# A reminder in the corner when custom tuning is on, so results aren't mistaken for defaults.
func _refresh_tuned_badge() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var badge: Label = get_node_or_null("TunedBadge")
	if badge == null:
		badge = FelecoUiScript.label("TUNED", 14, FelecoUiScript.INK)
		badge.name = "TunedBadge"
		var sb := StyleBoxFlat.new()
		sb.bg_color = FelecoUiScript.GOLD
		sb.set_corner_radius_all(8)
		sb.content_margin_left = 8
		sb.content_margin_right = 8
		badge.add_theme_stylebox_override("normal", sb)
		badge.position = Vector2(28, 8)
		badge.tooltip_text = "Tuning Lab settings (main menu) are active in this run."
		add_child(badge)
	badge.visible = gc != null and gc.is_tuned()

func _trigger_simple(powerup_id: String, method: String) -> void:
	if _spend_touch_or_stock(powerup_id) and _director != null:
		_director.call(method)

func _trigger_eclipse() -> void:
	if _spend_touch_or_stock("eclipse") and _director != null:
		_director.trigger_eclipse()

func _trigger_midnight_sun() -> void:
	if _spend_touch_or_stock("midnight_sun") and _director != null:
		_director.trigger_midnight_sun()

func _trigger_full_moon() -> void:
	if _spend_touch_or_stock("full_moon") and _director != null:
		_director.trigger_full_moon()

func _trigger_lantern() -> void:
	if _spend_touch_or_stock("lantern_night") and _director != null:
		_director.trigger_lantern_night()

func _mark_dock() -> void:
	for btn_name: String in ["Speed1", "Speed2", "Speed5", "Pause", "TopDown", "History"]:
		var ghost: Button = $BottomBar.get_node(btn_name)
		FelecoUiScript.mark(ghost, "GhostButton")
		ghost.custom_minimum_size = Vector2(96, 52)
	FelecoUiScript.mark($BottomBar/EndEarly, "DangerButton")
	$BottomBar/EndEarly.custom_minimum_size = Vector2(120, 52)
	for btn_name: String in POWERUP_BUTTONS.keys():
		var touch: Button = _power_btn(btn_name)
		FelecoUiScript.mark(touch, "TouchButton")
		touch.custom_minimum_size = Vector2(156, 56)

func _style_roster() -> void:
	var colors: Dictionary = {
		"TimerLabel": Color(0.902, 0.765, 0.416),
		"SheepCount": Color(0.93, 0.9, 0.82),
		"WolfCount": Color(0.86, 0.55, 0.45),
		"HumanCount": Color(0.9, 0.78, 0.55),
		"FalconCount": Color(0.78, 0.84, 0.62),
		"RobinCount": Color(0.55, 0.74, 0.86),
		"BoarCount": Color(0.78, 0.62, 0.42),
		"RabbitCount": Color(0.86, 0.72, 0.68),
		"WizardCount": Color(0.72, 0.62, 0.9),
		"BuilderCount": Color(0.8, 0.7, 0.5),
		"WormCount": Color(0.55, 0.75, 0.48),
		"FishCount": Color(0.35, 0.7, 0.86),
	}
	for label_name: String in colors.keys():
		var label: Label = $TopLeft/VBox.get_node(label_name)
		label.add_theme_color_override("font_color", colors[label_name])
		label.add_theme_font_size_override("font_size", 16)
		if ROSTER_SPECIES.has(label_name):
			# A small line under each count: males, females, tough and special kinds.
			var detail := Label.new()
			detail.name = label_name + "Detail"
			detail.add_theme_font_size_override("font_size", 12)
			detail.add_theme_color_override("font_color", (colors[label_name] as Color).lerp(Color(0.6, 0.66, 0.6), 0.55))
			detail.add_theme_constant_override("line_spacing", 0)
			label.add_sibling(detail)
			_roster_details[ROSTER_SPECIES[label_name]] = detail
	# 3.0 species: their count lines are made here rather than in the scene.
	var after: Node = $TopLeft/VBox.get_node("FishCountDetail") if $TopLeft/VBox.has_node("FishCountDetail") else $TopLeft/VBox/FishCount
	for id: String in SpeciesDB.NEW_SPECIES:
		var col: Color = (SpeciesDB.row(id)["color"] as Color).lightened(0.25)
		var count := Label.new()
		count.name = id.capitalize() + "Count"
		count.add_theme_color_override("font_color", col)
		count.add_theme_font_size_override("font_size", 16)
		after.add_sibling(count)
		var detail := Label.new()
		detail.add_theme_font_size_override("font_size", 12)
		detail.add_theme_color_override("font_color", col.lerp(Color(0.6, 0.66, 0.6), 0.55))
		count.add_sibling(detail)
		_extra_counts[id] = count
		_roster_details[id] = detail
		after = detail
	$TopLeft/VBox.add_theme_constant_override("separation", 1)

const ROSTER_SPECIES: Dictionary = {
	"SheepCount": "sheep", "WolfCount": "wolf", "HumanCount": "human", "FalconCount": "falcon",
	"RobinCount": "robin", "BoarCount": "boar", "RabbitCount": "rabbit", "WormCount": "worm", "FishCount": "fish",
}
var _roster_details: Dictionary = {}
var _extra_counts: Dictionary = {}  # 3.0 species id -> count Label

func _update_breakdown() -> void:
	if _director == null or _roster_details.is_empty():
		return
	var tally: Dictionary = {}
	for data: AgentData in _director._agent_registry:
		if data.node == null or not is_instance_valid(data.node) or not _roster_details.has(data.species):
			continue
		if not tally.has(data.species):
			tally[data.species] = [0, 0, 0, 0, 0]
		var t: Array = tally[data.species]
		t[1 if data.female else 0] += 1
		var kind: int = Roles.role_index(data.role)
		if kind > 0:
			t[1 + kind] += 1
		if data.golden > 0.05:
			t[4] += 1
	for sp: String in _roster_details.keys():
		# With fourteen species the per-kind lines don't fit: they show on hover.
		(_roster_details[sp] as Label).visible = false
		var t: Array = tally.get(sp, [0, 0, 0, 0, 0])
		var line: String = "%dM · %dF · %d tough · %d special" % t.slice(0, 4)
		if int(t[4]) > 0:
			line += " · %d gold" % t[4]
		(_roster_details[sp] as Label).text = line
		var count_label: Control = (_roster_details[sp] as Label).get_parent().get_child((_roster_details[sp] as Label).get_index() - 1)
		count_label.mouse_filter = Control.MOUSE_FILTER_PASS
		count_label.tooltip_text = line

func _refresh_champion() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null or _director == null:
		return
	$TopRight/VBoxContainer/BetLabel.text = _director.champion_line(str(gc.player_bet))

func _update_powerup_buttons() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null:
		return
	var free: bool = _director != null and _director.touches_left > 0
	for btn_name: String in POWERUP_BUTTONS.keys():
		var btn: Button = _power_btn(btn_name)
		if btn == null:
			continue
		var pid: String = POWERUP_BUTTONS[btn_name]
		var count: int = int(gc.powerup_inventory.get(pid, 0))
		var label: String = POWER_LABELS.get(btn_name, btn_name)
		# The UI theme turns expand_icon on for every button, which shrinks an
		# icon into whatever room the label leaves (most vanished). Keep it off.
		btn.expand_icon = false
		var price: int = _power_price(pid)
		btn.text = label if free else ("%s  %d" % [label, count] if count > 0 else "%s  %d EP" % [label, price])
		btn.disabled = (not free) and count <= 0 and int(gc.eco_points) < price
		var tip: String = POWER_TIPS.get(btn_name, "")
		if btn_name == "Feast":
			tip = EraBook.feast_tip()
		elif btn_name == "RotRain":
			tip = EraBook.rot_tip()
		# Say what it does and which bets it pushes; glow if it helps yours.
		if Schemes.POWERS.has(pid):
			tip = "%s\n%s" % [tip, Schemes.POWERS[pid][0]] if not tip.is_empty() else String(Schemes.POWERS[pid][0])
			var mine: Array[String] = []
			var champ: String = SpeciesDB.group_of(String(gc.player_bet).to_lower())
			for bet: Dictionary in gc.bets:
				if bet.get("state", "") == "open" and Schemes.helps(pid, bet, champ):
					mine.append(String(bet.get("label", "")))
			btn.modulate = Color(1.25, 1.1, 0.6) if not mine.is_empty() else Color.WHITE
			if not mine.is_empty():
				btn.text = "★ " + btn.text
				tip += "\nHELPS YOUR BET: %s (+10%% payout each cast)" % ", ".join(mine)
		if free:
			btn.tooltip_text = "%s\nFree: this season's one touch. Stock left: %d." % [tip, count]
		elif count > 0:
			btn.tooltip_text = "%s\nUses a Greenhouse charge. Stock: %d." % [tip, count]
		else:
			btn.tooltip_text = "%s\nBuy and cast now for %d EP." % [tip, price]

# Goals, the tutorial and My Creature live in one card at the top.
var _goals: GoalsPanel
var saga: ValleySaga = null

func _build_goals() -> void:
	_goals = GoalsPanel.new()
	_goals.name = "Goals"
	_goals.director = _director
	_goals.hud = self
	# Top centre: the one strip of screen the stats, champion and bottom bar leave free.
	_goals.anchor_left = 0.5
	_goals.anchor_right = 0.5
	_goals.offset_left = -180.0
	_goals.offset_right = 180.0
	_goals.offset_top = 64.0
	_goals.grow_horizontal = Control.GROW_DIRECTION_BOTH
	add_child(_goals)
	HudWindow.movable(_goals)
	var gc: Node = get_node_or_null("/root/GameConfig")
	# Enter the Valley is a five-year saga (year goals, dawn dilemmas, quests).
	if gc != null and gc.current_mode == "sandbox":
		saga = ValleySaga.new()
		saga.name = "Saga"
		saga.director = _director
		saga.hud = self
		add_child(saga)
		_goals.saga = saga
	if gc != null and gc.main_claim:
		_show_champion_banner.call_deferred()
	elif gc != null and not gc.tutorial_done and gc.current_mode == "sandbox":
		_show_welcome.call_deferred()

# Mid-season: a big line across the valley that fades on its own.
func _on_season_event(text: String, species: String) -> void:
	var line := FelecoUiScript.heading(text, 44, SeasonBook.color(species))
	line.set_anchors_preset(Control.PRESET_CENTER_TOP)
	line.grow_horizontal = Control.GROW_DIRECTION_BOTH
	line.offset_top = 130.0
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	$TopLeft.get_parent().add_child(line)
	var tw := line.create_tween()
	tw.tween_interval(3.5)
	tw.tween_property(line, "modulate:a", 0.0, 1.2)
	tw.tween_callback(line.queue_free)

func _show_champion_banner() -> void:
	while get_tree().paused:
		await get_tree().create_timer(0.3, true, false, true).timeout
	var note := Label.new()
	note.text = "Click any creature. The hand lifts your Champion."
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.set_anchors_preset(Control.PRESET_CENTER_TOP)
	note.offset_left = -280.0
	note.offset_right = 280.0
	note.offset_top = 128.0
	note.offset_bottom = 164.0
	note.add_theme_font_size_override("font_size", 18)
	note.add_theme_color_override("font_color", Color(0.96, 0.9, 0.7))
	note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(note)

# First run: say plainly what Feleco is and what to do.
func _show_welcome() -> void:
	# Wait out the loading screen, which pauses the tree.
	while get_tree().paused:
		await get_tree().create_timer(0.3, true, false, true).timeout
	var shade := ColorRect.new()
	shade.name = "Welcome"
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var card := PanelContainer.new()
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(520, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.97)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(18)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 24)
	card.add_theme_stylebox_override("panel", sb)
	shade.add_child(card)
	HudWindow.movable(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	card.add_child(col)
	col.add_child(FelecoUiScript.heading("Welcome to Feleco!", 30, FelecoUiScript.GOLD))
	for line: String in [
		"This valley is alive. Every animal eats, sleeps, hunts, has babies and grows old on its own.",
		"Your job: pick an animal to raise, help it survive, and bet on which species will rule the valley.",
		"Tap any animal to watch it. Press Make Mine to adopt it, then level it up and train it.",
		"Drag to move the camera. Use Powers to change the weather and help (or hurt) the valley.",
		"Follow the Goals card at the top to earn EP. Watch for a rare diamond!",
	]:
		var l := FelecoUiScript.label(line, 17, FelecoUiScript.CREAM)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(l)
	var go := Button.new()
	go.text = "Let's go!"
	go.theme_type_variation = "PrimaryButton"
	go.custom_minimum_size = Vector2(0, 48)
	go.pressed.connect(func() -> void:
		var gc: Node = get_node_or_null("/root/GameConfig")
		if gc != null:
			gc.tutorial_done = true
			gc.save_meta()
		shade.queue_free())
	col.add_child(go)

# Powers used this run (the goals panel counts them).
var power_uses: int = 0

func _spend_touch_or_stock(powerup_id: String) -> bool:
	var used: bool = false
	if _director != null and _director.touches_left > 0:
		_director.touches_left -= 1
		_refresh_champion()
		used = true
	else:
		used = _consume_powerup(powerup_id)
	if used:
		power_uses += 1
		_scheme(powerup_id)
		_update_powerup_buttons()
	return used

# A power cast in favour of an open bet makes that bet pay more.
func _scheme(powerup_id: String) -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var champ: String = SpeciesDB.group_of(String(gc.player_bet).to_lower()) if gc != null else ""
	var boosted: Array[String] = Schemes.on_power(gc, powerup_id, champ)
	if not boosted.is_empty():
		FXManager.show_dramatic_text(Vector3.ZERO, "SCHEME! +10%% on %s" % ", ".join(boosted), Color(1.0, 0.85, 0.3))
		Juice.sfx(self, "coin")
		if _director != null:
			_director.chronicle.emit("Your scheme pays off: %s now pay more." % ", ".join(boosted))

func _consume_powerup(powerup_id: String) -> bool:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null:
		return false
	var count: int = gc.powerup_inventory.get(powerup_id, 0)
	if count <= 0:
		# No stock: buy it on the spot with EP (the Greenhouse price).
		var price: int = _power_price(powerup_id)
		if not gc.spend_eco_points(price):
			return false
		FXManager.show_dramatic_text(Vector3.ZERO, "-%d EP" % price, FelecoUiScript.GOLD)
		_update_powerup_buttons()
		return true
	gc.powerup_inventory[powerup_id] = count - 1
	gc.save_meta()
	_update_powerup_buttons()
	return true

func _power_price(pid: String) -> int:
	for row: Dictionary in preload("res://scripts/ui/greenhouse_shop.gd").POWERUPS:
		if row["id"] == pid:
			return int(row["cost"])
	return 20

# --- Release 10 ---------------------------------------------------------------
# Pick a species, pay EP, then click the valley: ten of them arrive there.
var _pack_pick: OptionButton
var _pack_btn: Button
var _placing: String = ""

func _pack_price(species: String) -> int:
	return PACK_COST * (2 if PACK_APEX.has(species) else 1)

func _build_release_row() -> Control:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 8)
	row.add_child(FelecoUiScript.label("Release 10:", 14, FelecoUiScript.GOLD))
	_pack_pick = OptionButton.new()
	for sp: String in ["sheep", "rabbit", "deer", "goat", "boar", "bear", "wolf", "lion", "falcon", "robin", "human", "mouse", "beetle", "worm", "fish"]:
		_pack_pick.add_item(SpeciesDB.label(sp))
		_pack_pick.set_item_metadata(_pack_pick.item_count - 1, sp)
	_pack_pick.item_selected.connect(func(_i: int) -> void: _refresh_pack())
	row.add_child(_pack_pick)
	_pack_btn = Button.new()
	_pack_btn.theme_type_variation = "PrimaryButton"
	_pack_btn.pressed.connect(func() -> void:
		_placing = String(_pack_pick.get_item_metadata(_pack_pick.selected))
		_tray.visible = false
		FXManager.show_dramatic_text(Vector3.ZERO, "Click the valley to release ten %s" % SpeciesDB.spoken(_placing), FelecoUiScript.GOLD))
	row.add_child(_pack_btn)
	_refresh_pack()
	return row

func _refresh_pack() -> void:
	if _pack_btn == null:
		return
	var gc: Node = get_node_or_null("/root/GameConfig")
	var sp: String = String(_pack_pick.get_item_metadata(_pack_pick.selected))
	var price: int = _pack_price(sp)
	_pack_btn.text = "Place (%d EP)" % price
	_pack_btn.disabled = gc == null or int(gc.eco_points) < price
	_pack_btn.tooltip_text = "Pay %d EP, then click anywhere in the valley to release ten %s there." % [price, SpeciesDB.spoken(sp)]

# Where the pointer meets the ground (the plane, then refined on the terrain).
func _ground_under(screen: Vector2) -> Vector3:
	var cam := get_viewport().get_camera_3d()
	if cam == null or _director == null:
		return Vector3.INF
	var from: Vector3 = cam.project_ray_origin(screen)
	var dir: Vector3 = cam.project_ray_normal(screen)
	if dir.y > -0.01:
		return Vector3.INF
	var h: float = 0.0
	var p := Vector3.ZERO
	for i: int in 4:
		var t: float = (h - from.y) / dir.y
		p = from + dir * t
		h = _director.ground_height(p.x, p.z)
	return p

func _release_pack(at: Vector3) -> void:
	var sp: String = _placing
	_placing = ""
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null or _director == null:
		return
	var flat := Vector2(at.x, at.z)
	if flat.length() > ValleyTerrain.WALK_RADIUS - 6.0:
		flat = flat.normalized() * (ValleyTerrain.WALK_RADIUS - 6.0)
	at = Vector3(flat.x, 0.0, flat.y)
	if not gc.spend_eco_points(_pack_price(sp)):
		FXManager.show_dramatic_text(Vector3.ZERO, "Not enough EP", Color(0.95, 0.4, 0.3))
		return
	var made: int = 0
	for i: int in PACK_SIZE:
		var p: Vector3 = _director.dry_land(at + Vector3(randf_range(-4.0, 4.0), 0.0, randf_range(-4.0, 4.0)))
		if sp == "fish" and _director.valley != null and _director.valley.river != null:
			var c: Vector3 = _director.valley.river.sample(at.x, at.z).closest
			p = c + Vector3(randf_range(-1.0, 1.0), 0.0, randf_range(-1.0, 1.0))
		var ag := _director.spawn_scripted(sp, p)
		if ag != null:
			ag.scripted = false
			ag.set_state(ag._current_state)
			made += 1
	FXManager.spawn_birth_particles(_director.dry_land(at) + Vector3.UP, FelecoUiScript.GOLD)
	FXManager.show_dramatic_text(_director.dry_land(at) + Vector3.UP * 2.0, "%d %s released!" % [made, SpeciesDB.spoken(sp)], FelecoUiScript.GOLD)
	_director.chronicle.emit("You release %d %s into the valley." % [made, SpeciesDB.spoken(sp)])
	_refresh_pack()
	_update_powerup_buttons()

# Rampages go in the History in gold (won) or red (lost), and the History
# button glows that colour for a few seconds so the player knows to look.
func _on_rampage_result(who: String, kills: int, won: bool) -> void:
	var goal: int = int(get_node("/root/GameConfig").RAMPAGE_GOAL)
	var col: Color = Color(1.0, 0.82, 0.3) if won else Color(0.95, 0.35, 0.3)
	var history: EventHistory = get_node_or_null("EventHistory")
	if history != null:
		history.add_highlight("%s %s's rampage: %d of %d devoured" % ["WON:" if won else "LOST:", who, kills, goal], col)
	var btn: Button = _rail_buttons.get("History", $BottomBar/History)
	var tw := create_tween().set_loops(4)
	tw.tween_property(btn, "modulate", col * 1.4, 0.35)
	tw.tween_property(btn, "modulate", Color.WHITE, 0.35)

func _open_history() -> void:
	var history: EventHistory = get_node_or_null("EventHistory")
	if history != null:
		history.toggle()

	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		_refresh_champion()

func _input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and get_tree().paused:
		_update_tooltip()
	if _aiming and event is InputEventMouseMotion and _aim_mark != null:
		var at := _ground_under((event as InputEventMouseMotion).position)
		_aim_mark.visible = at.is_finite()
		if at.is_finite():
			_aim_mark.global_position = at + Vector3.UP * 0.25

# Follow mode: click a creature in the valley to ride along with it.
var _follow_panel: FollowPanel
var _press_at: Vector2 = Vector2(-1, -1)

func _unhandled_input(event: InputEvent) -> void:
	if _follow_panel != null and is_instance_valid(_follow_panel) and _follow_panel.driving and event.is_action_pressed("ui_cancel"):
		_follow_panel._release_control()
		get_viewport().set_input_as_handled()
		return
	if _aiming and event.is_action_pressed("ui_cancel"):
		_cancel_aim()
		get_viewport().set_input_as_handled()
		return
	var mb := event as InputEventMouseButton
	if mb == null or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	if mb.pressed:
		_press_at = mb.position
		return
	# A click, not a drag: pick the creature under the pointer.
	if _press_at.distance_to(mb.position) > 16.0 or has_node("LiveTable") or has_node("Resolution"):
		return
	if _aiming:
		var aim := _ground_under(mb.position)
		if aim.is_finite():
			_fire_meteor(aim)
		return
	if not _placing.is_empty():
		var at := _ground_under(mb.position)
		if at.is_finite():
			_release_pack(at)
		return
	# Driving: the mouse is the stick, not a pointer.
	if _follow_panel != null and is_instance_valid(_follow_panel) and _follow_panel.driving:
		return
	if _goals != null and _goals.try_collect(mb.position):
		return
	var agent := _get_hovered_agent() as MarkovAgent
	if agent != null:
		if _carries_magic(agent):
			_lift_in_hand(agent)
		else:
			_start_follow(agent)

func _carries_magic(agent: MarkovAgent) -> bool:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and gc.main_claim:
		return true
	if agent._data != null and not agent._data.brand.is_empty():
		return true
	return _goals != null and _goals.is_companion(agent)

var _hand_busy: bool = false

func _lift_in_hand(agent: MarkovAgent) -> void:
	if _hand_busy or agent == null or not is_instance_valid(agent):
		return
	_hand_busy = true
	_stop_follow()
	var cam: Camera3D = get_tree().current_scene.get_node_or_null("Camera3D") as Camera3D
	if cam != null and cam.has_method("follow"):
		cam.follow(agent)
		# Frame the grab without tipping the valley camera onto its side.
		if cam.distance > 26.0:
			cam.set_view(agent.global_position, cam.yaw, cam.pitch, 22.0)
	var hand := SpectralHand.new()
	hand.name = "SpectralHand"
	hand.cancelled.connect(func() -> void:
		_hand_busy = false
		var old: Node = get_node_or_null("HandChoices")
		if old != null:
			old.queue_free())
	var world: Node = get_tree().current_scene
	world.add_child(hand)
	hand.lift(agent, func() -> void: _show_hand_choices(hand, agent))

func _show_hand_choices(hand: SpectralHand, agent: MarkovAgent) -> void:
	if not is_instance_valid(hand) or not is_instance_valid(agent):
		_hand_busy = false
		return
	var plate := StyleBoxFlat.new()
	plate.bg_color = Color(0.04, 0.06, 0.08, 0.9)
	plate.border_color = Color(0.62, 0.8, 0.95, 0.75)
	plate.set_border_width_all(2)
	plate.set_corner_radius_all(12)
	plate.content_margin_left = 18
	plate.content_margin_right = 18
	plate.content_margin_top = 6
	plate.content_margin_bottom = 8
	# Slim, and just above the dock: the creature in the hand stays in view.
	var shell := PanelContainer.new()
	shell.name = "HandChoices"
	shell.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	shell.offset_left = -430.0
	shell.offset_right = 430.0
	# A tall phone wraps the dock onto a second row.
	var dock_top: float = -176.0 if get_viewport().get_visible_rect().size.x < 900.0 else -122.0
	shell.offset_top = dock_top
	shell.offset_bottom = dock_top
	shell.grow_horizontal = Control.GROW_DIRECTION_BOTH
	shell.grow_vertical = Control.GROW_DIRECTION_BEGIN
	shell.process_mode = Node.PROCESS_MODE_ALWAYS
	shell.mouse_filter = Control.MOUSE_FILTER_STOP
	shell.z_index = 30
	shell.add_theme_stylebox_override("panel", plate)
	add_child(shell)
	var bar := VBoxContainer.new()
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("separation", 4)
	bar.mouse_filter = Control.MOUSE_FILTER_STOP
	shell.add_child(bar)
	var held := Label.new()
	var gc_hold: Node = get_node_or_null("/root/GameConfig")
	held.text = "Claim your Champion. Brand changes the body. Train is how they grow." if gc_hold != null and gc_hold.main_claim else "The hand has them."
	held.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	held.add_theme_font_size_override("font_size", 18)
	held.add_theme_color_override("font_color", Color(0.9, 0.86, 0.72))
	bar.add_child(held)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 10)
	bar.add_child(row)
	var claim := Button.new()
	claim.text = "Claimed" if _goals != null and _goals.is_companion(agent) else "Claim"
	claim.theme_type_variation = "PrimaryButton"
	claim.custom_minimum_size = Vector2(150, 52)
	claim.pressed.connect(func() -> void:
		if _goals == null or not is_instance_valid(agent):
			return
		if not _goals.is_companion(agent):
			_goals.adopt(agent)
		claim.text = "Claimed"
		claim.disabled = true
		var gc_claim: Node = get_node_or_null("/root/GameConfig")
		if gc_claim != null and gc_claim.main_claim:
			gc_claim.main_claim = false
			gc_claim.set_record("lesson", "champion", true)
			var studio := BrandStudio.new()
			studio.agent = agent
			add_child(studio))
	row.add_child(claim)
	var brand := Button.new()
	brand.text = "Brand"
	brand.theme_type_variation = "GhostButton"
	brand.custom_minimum_size = Vector2(150, 52)
	brand.tooltip_text = "Tattoo the body. One look, every part."
	brand.pressed.connect(func() -> void:
		if not is_instance_valid(agent):
			return
		var studio := BrandStudio.new()
		studio.agent = agent
		add_child(studio))
	row.add_child(brand)
	var train := Button.new()
	train.text = "Train"
	train.theme_type_variation = "GhostButton"
	train.custom_minimum_size = Vector2(150, 52)
	train.tooltip_text = "Teach them. Claim them first."
	train.pressed.connect(func() -> void:
		if _goals == null or not _goals.is_companion(agent):
			train.tooltip_text = "Claim them first."
			return
		var menu := LevelUpMenu.new()
		menu.goals = _goals
		add_child(menu))
	row.add_child(train)
	var follow := Button.new()
	follow.text = "Follow"
	follow.theme_type_variation = "PrimaryButton"
	follow.custom_minimum_size = Vector2(150, 52)
	follow.tooltip_text = "The hand sets them down. Then you watch."
	follow.pressed.connect(func() -> void:
		follow.disabled = true
		shell.queue_free()
		hand.put_down(func() -> void:
			_hand_busy = false
			if is_instance_valid(agent):
				_start_follow(agent)))
	row.add_child(follow)
	var drop := Button.new()
	drop.text = "Drop"
	drop.theme_type_variation = "GhostButton"
	drop.custom_minimum_size = Vector2(150, 52)
	drop.tooltip_text = "Set them gently back on the ground."
	drop.pressed.connect(func() -> void:
		drop.disabled = true
		shell.queue_free()
		hand.put_down(func() -> void: _hand_busy = false))
	row.add_child(drop)

func _start_follow(agent: MarkovAgent) -> void:
	_stop_follow()
	# Clicking a Gold creature claims its gold (4.7.1).
	if agent != null and agent.golden > 0.05:
		agent.claim_gold()
	var cam: Camera3D = get_tree().current_scene.get_node_or_null("Camera3D") as Camera3D
	if cam != null and cam.has_method("follow"):
		cam.follow(agent)
	_follow_panel = FollowPanel.new()
	_follow_panel.agent = agent
	_follow_panel.director = _director
	_follow_panel.anchor_left = 1.0
	_follow_panel.anchor_right = 1.0
	_follow_panel.offset_left = -440.0 - RAIL_W
	_follow_panel.offset_right = -10.0 - RAIL_W
	_follow_panel.offset_top = 170.0
	# If it ever needs more room it widens to the left, never off the screen.
	_follow_panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_follow_panel.stopped.connect(_stop_follow)
	add_child(_follow_panel)
	HudWindow.dress(_follow_panel, "Creature", null, _stop_follow)
	var hill: Control = get_node_or_null("HillBars")
	if hill != null:
		hill.visible = false

func _stop_follow() -> void:
	if _follow_panel != null and is_instance_valid(_follow_panel):
		_follow_panel.queue_free()
	_follow_panel = null
	var hill: Control = get_node_or_null("HillBars")
	if hill != null:
		hill.visible = true
	var cam: Camera3D = get_tree().current_scene.get_node_or_null("Camera3D") as Camera3D
	if cam != null and cam.has_method("follow") and cam.call("following") != null:
		cam.follow(null)

var _rail_clock: float = 0.0

func _process(_delta: float) -> void:
	_rail_clock -= _delta / maxf(Engine.time_scale, 0.01)
	if _rail_clock <= 0.0 and not _rail_buttons.is_empty():
		_rail_clock = 0.25
		_refresh_rail()
		_tidy_windows()
	# Bet creatures: a pulsing ring on the ground at their feet, following the
	# drawn (smoothed) position so it never slides out from under the sprite.
	if not _bet_rings.is_empty():
		_side_bet_pulse += _delta * 4.0
		for data: AgentData in _bet_rings.keys():
			var ring: MeshInstance3D = _bet_rings[data]
			if data.node == null or not is_instance_valid(data.node) or not data.node.is_inside_tree():
				ring.queue_free()
				_bet_rings.erase(data)
				continue
			var p: Vector3 = data.shown if data.has_shown else data.pos
			var ground: float = _director.ground_height(p.x, p.z) if _director != null else p.y
			ring.global_position = Vector3(p.x, ground + 0.06, p.z)
			var k: float = 1.0 + sin(_side_bet_pulse) * 0.08
			ring.scale = Vector3(k, 1.0, k)
	if _director != null and _director.touches_left != _shown_touches:
		_shown_touches = _director.touches_left
		_update_powerup_buttons()
	_update_tooltip()

func _update_tooltip() -> void:
	var tooltip: Panel = get_node_or_null("Tooltip")
	if tooltip == null:
		return
	# Hover cards are for when *you* pause; the loading screen also pauses the
	# tree, and a card left up then would stick on screen after Play.
	if not (get_tree().paused and _user_paused) or has_node("LiveTable") or has_node("Resolution"):
		tooltip.visible = false
		return
	var agent := _get_hovered_agent()
	if agent == null:
		tooltip.visible = false
		return
	tooltip.visible = true
	var mp := get_viewport().get_mouse_position()
	tooltip.position = mp + Vector2(16, 16)
	# Keep tooltip on screen
	var vp_size := get_viewport().get_visible_rect().size
	if tooltip.position.x + tooltip.size.x > vp_size.x:
		tooltip.position.x = mp.x - tooltip.size.x - 16
	if tooltip.position.y + tooltip.size.y > vp_size.y:
		tooltip.position.y = mp.y - tooltip.size.y - 16
	var ttlabel: RichTextLabel = tooltip.get_node("MarginContainer/TooltipLabel")
	if ttlabel != null:
		ttlabel.text = _build_tooltip_text(agent)

func _get_hovered_agent() -> Node3D:
	var cam: Camera3D = null
	var scene := get_tree().current_scene
	if scene != null:
		cam = scene.get_node_or_null("Camera3D") as Camera3D
	if cam == null:
		# Fallback: find any Camera3D in the tree
		for node in get_tree().get_nodes_in_group("camera"):
			if node is Camera3D:
				cam = node
				break
	if cam == null:
		return null
	if _director == null:
		return null
	# Pick on screen, where the player is looking: the sprite drawn nearest
	# the pointer wins, and among overlapping ones the one in front. (The old
	# ground-plane test picked whatever stood behind on sloped ground.)
	var mouse_pos := get_viewport().get_mouse_position()
	var reach: float = 40.0 * get_viewport().get_visible_rect().size.y / 720.0
	var best: Node3D = null
	var best_score := INF
	for data: AgentData in _director._agent_registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		if not data.node.is_inside_tree():
			continue
		# Spores and mushrooms aren't creatures to follow.
		if data.species == "mushroom":
			continue
		var p: Vector3 = data.shown if data.has_shown else data.pos
		var mid := Vector3(p.x, data.drawn_mid_y if data.has_shown else p.y + 0.8, p.z)
		if cam.is_position_behind(mid):
			continue
		var d: float = cam.unproject_position(mid).distance_to(mouse_pos)
		if d > reach:
			continue
		# Mostly screen distance; depth breaks near-ties toward the front.
		var score: float = d + cam.global_position.distance_to(mid) * 0.5
		if score < best_score:
			best_score = score
			best = data.node
	return best

func _build_tooltip_text(agent: Node3D) -> String:
	var species := "Unknown"
	var name_str := ""
	var state := ""
	var health := 0.0
	var energy := 0.0
	var age := 0.0
	if agent is MarkovAgent:
		name_str = agent.display_name
		state = agent.current_state()
	if agent.get("health") != null:
		health = agent.get("health")
	if agent.get("energy") != null:
		energy = agent.get("energy")
	if agent.get("_age") != null:
		age = agent.get("_age")
	if agent.is_in_group("wolf"): species = "Wolf"
	elif agent.is_in_group("sheep"): species = "Sheep"
	elif agent.is_in_group("human"): species = "Human"
	elif agent.is_in_group("boar"): species = "Boar"
	elif agent.is_in_group("falcon"): species = "Falcon"
	elif agent.is_in_group("robin"): species = "Robin"
	elif agent.is_in_group("rabbit"): species = "Rabbit"
	elif agent.is_in_group("worm"): species = "Worm"
	elif agent.is_in_group("fish"): species = "Fish"
	elif agent.is_in_group("spore"): species = "Mushroom"
	var kind := species
	var lore := _species_rules(species)
	var sex_word := ""
	if agent is MarkovAgent:
		var ma := agent as MarkovAgent
		if not ma.role.is_empty():
			kind = Roles.display_name(ma.species_id, ma.role)
			lore = Roles.lore(ma.species_id, ma.role)
		sex_word = ma.sex
	var text := "[b]%s[/b] the %s\n" % [name_str, kind]
	if not sex_word.is_empty():
		text += "[color=#c9d4c2]%s %s[/color]\n" % [sex_word.capitalize(), species.to_lower()]
	text += "State: [color=#aaffaa]%s[/color]\n" % state
	text += "Health: %.0f  |  Energy: %.0f  |  Age: %.1f\n" % [health, energy, age]
	text += "[i]%s[/i]" % lore
	if agent is MarkovAgent:
		var s: Array = Roles.strategy((agent as MarkovAgent).species_id)
		if not String(s[0]).is_empty():
			text += "\n[color=#e8d9a8]%s[/color]: %s" % [s[0], s[1]]
	return text

func _setup_side_bet_marker() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null or _director == null:
		return
	# Every named creature on the slip (lives, dies early, elder), plus the legacy side bet.
	var wanted: Dictionary = {}
	for b: Dictionary in gc.bets:
		var meta: Dictionary = b.get("meta", {})
		if meta.has("name") and meta.has("species"):
			wanted[String(meta["species"]) + "|" + String(meta["name"])] = true
	if not gc.side_bet_entity.is_empty():
		wanted[String(gc.side_bet_entity.get("species", "")) + "|" + String(gc.side_bet_entity.get("name", ""))] = true
	if wanted.is_empty():
		return
	var world: Node3D = get_tree().current_scene.get_node_or_null("World")
	var vpm: Node = world.get_node_or_null("VisualProxyManager") if world != null else null
	for data: AgentData in _director._agent_registry:
		if data.node == null or not is_instance_valid(data.node) or not data.node is MarkovAgent:
			continue
		if not wanted.has(data.species + "|" + (data.node as MarkovAgent).display_name):
			continue
		if vpm != null:
			vpm.marked[data.node] = true
		var ring := MeshInstance3D.new()
		ring.name = "BetRing"
		var torus := TorusMesh.new()
		var r: float = 0.9
		if VisualProxyManager.SPECIES_CONFIG.has(data.species):
			r = float(VisualProxyManager.SPECIES_CONFIG[data.species]["shadow"]) * 0.6 + 0.35
		torus.inner_radius = r
		torus.outer_radius = r + 0.14
		torus.rings = 48
		torus.ring_segments = 6
		ring.mesh = torus
		ring.scale = Vector3.ONE
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(1.0, 0.95, 0.65)
		mat.no_depth_test = false
		ring.material_override = mat
		ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if world != null:
			world.add_child(ring)
			_bet_rings[data] = ring

func _species_rules(species: String) -> String:
	match species:
		"Sheep":
			return "Graze grass. Flee from wolves and boars. Reproduce when well-fed."
		"Wolf":
			return "Hunt sheep. Sleep to recover energy. Stronger in packs."
		"Human":
			return "Gather food, hunt wolves, build settlements. Stay near shelters."
		"Wizard":
			return "Channels nature magic: grows trees, surges grass, blesses allies."
		"Builder":
			return "Plants trees and builds shelters. Backbone of civilization."
		"Boar":
			return "Forage mushrooms and apples. Charge threats in groups. Flee when alone."
		"Falcon":
			return "Aerial hunter. Dives on prey from above."
		"Robin":
			return "Eats worms and seeds. Quick and flighty."
		"Rabbit":
			return "Fast grazer. Flees from falcons and humans. Reproduces quickly."
		"Worm":
			return "Burrows through soil. Eats rot and dead matter."
		"Mushroom":
			return "Drifts on wind. Spreads mycelium. Dies on ground contact."
		_:
			return ""

func _on_pop_changed(faction: String, count: int) -> void:
	match faction:
		"sheep":
			$TopLeft/VBox/SheepCount.text = "%s  %d" % [SpeciesDB.label("sheep"), count]
		"wolves":
			$TopLeft/VBox/WolfCount.text = "%s  %d" % [SpeciesDB.label("wolf"), count]
		"humans":
			var tribes: int = _director.tribe_count() if _director != null else 0
			$TopLeft/VBox/HumanCount.text = "%s  %d   · %d tribe%s" % [SpeciesDB.label("human"), count, tribes, "" if tribes == 1 else "s"]
		"mushrooms":
			pass
		"falcons":
			$TopLeft/VBox/FalconCount.text = "%s  %d" % [SpeciesDB.label("falcon"), count]
		"robins":
			$TopLeft/VBox/RobinCount.text = "%s  %d" % [SpeciesDB.label("robin"), count]
		"boars":
			$TopLeft/VBox/BoarCount.text = "%s  %d" % [SpeciesDB.label("boar"), count]
		"rabbits":
			$TopLeft/VBox/RabbitCount.text = "%s  %d" % [SpeciesDB.label("rabbit"), count]
		"wizards":
			$TopLeft/VBox/WizardCount.text = "%s  %d" % ["Shamans" if EraBook.id() == "lost" else "Wizards", count]
		"builders":
			$TopLeft/VBox/BuilderCount.text = "Builders  %d" % count

func _on_time_updated(days_remaining: float) -> void:
	_update_hill_bars()
	var season: String = ""
	var part: String = ""
	var day_n: int = 1
	var of_n: int = 1
	if _director != null:
		season = _director.get_season()
		day_n = int(_director.get_day()) + 1
		of_n = int(ceil(_director.year_days()))
		var d: float = _director.daylight
		var into: float = _director.seconds_into_day() / Clock.SECONDS_PER_DAY
		if d >= 0.85:
			part = "Day"
		elif d <= 0.15:
			part = "Night"
		else:
			part = "Dusk" if into > 0.25 and into < 0.75 else "Dawn"
	$TopLeft/VBox/TimerLabel.text = "Day %d of %d  ·  %s  ·  %s" % [mini(day_n, of_n), of_n, season, part]
	if _director != null:
		$TopLeft/VBox/WormCount.text = "%s  %d" % [SpeciesDB.label("worm"), _director._active_worms.size()]
		$TopLeft/VBox/FishCount.text = "%s  %d" % [SpeciesDB.label("fish"), _director._active_fish.size()]
		for id: String in _extra_counts.keys():
			(_extra_counts[id] as Label).text = "%s  %d" % [SpeciesDB.label(id), _director.get_species_count(id)]
		_update_breakdown()
		_refresh_champion()

var _rule_announce_s: float = -20.0

func _on_rule_changed(leader: String) -> void:
	var now: float = Time.get_ticks_msec() / 1000.0
	if now - _rule_announce_s < 8.0:
		return
	_rule_announce_s = now
	var name: String = SpeciesDB.GROUP_LABEL.get(leader, leader.capitalize())
	var tint: Color = SpeciesDB.GROUP_COLOR.get(leader, Color(0.95, 0.85, 0.45))
	FXManager.show_dramatic_text(Vector3.ZERO, "%s take the valley" % name, tint)
	if _director != null:
		_director.chronicle.emit("%s take the hill." % name)

func _on_sim_ended(winner: String) -> void:
	Music.play("finale")
	Engine.time_scale = 1.0
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	# The results own the screen; the ticker would scroll over them.
	$Tickertape.hide()
	var res: Control = load("res://scenes/ui/resolution_screen.tscn").instantiate() as Control
	res.name = "Resolution"
	res.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(res)
	if res.has_method("show_result"):
		res.show_result(winner)

# King of the hill: one bar per food-web group. A day goes to whichever
# group is fullest for its size, the same test the bets pay on.
const HILL_BAR_H: float = 96.0
var _hill_bars: Dictionary = {}
var _hill_crowns: Dictionary = {}
var _hill_days: Dictionary = {}
var _hill_title: Label

func _build_hill_bars() -> void:
	var panel := PanelContainer.new()
	panel.name = "HillBars"
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.offset_left = -420.0 - RAIL_W
	panel.offset_right = -10.0 - RAIL_W
	panel.offset_top = 178.0
	panel.tooltip_text = "Who rules the valley. A bar rises for each day that group is the fullest for its size. Most days ruled wins the bets."
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.125, 0.102, 0.78)
	sb.border_color = Color(0.902, 0.765, 0.416, 0.45)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(12)
	sb.set_content_margin_all(10)
	panel.add_theme_stylebox_override("panel", sb)
	add_child(panel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	panel.add_child(col)
	_hill_title = Label.new()
	_hill_title.text = "No one rules yet"
	_hill_title.add_theme_font_size_override("font_size", 14)
	_hill_title.modulate = Color(0.95, 0.85, 0.55)
	col.add_child(_hill_title)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_child(row)
	for g: String in SpeciesDB.GROUPS:
		var tint: Color = SpeciesDB.GROUP_COLOR[g]
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 2)
		cell.custom_minimum_size = Vector2(72, 0)
		var face := TextureRect.new()
		face.texture = FelecoUiScript.species_texture(BetBook.GROUP_ART[g])
		face.custom_minimum_size = Vector2(32, 32)
		face.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		face.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		face.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		face.mouse_filter = Control.MOUSE_FILTER_IGNORE
		cell.add_child(face)
		var crown := TextureRect.new()
		crown.texture = load("res://assets/icons/crown.svg")
		crown.custom_minimum_size = Vector2(16, 14)
		crown.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		crown.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		crown.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		crown.modulate = Color(1.0, 0.84, 0.3, 0.0)
		cell.add_child(crown)
		var bar := ProgressBar.new()
		bar.fill_mode = ProgressBar.FILL_BOTTOM_TO_TOP
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(28, HILL_BAR_H)
		bar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		bar.max_value = 1.0
		bar.step = 0.0
		var bg := StyleBoxFlat.new()
		bg.bg_color = Color(1, 1, 1, 0.07)
		bg.set_corner_radius_all(4)
		var fill := StyleBoxFlat.new()
		fill.bg_color = tint
		fill.set_corner_radius_all(4)
		bar.add_theme_stylebox_override("background", bg)
		bar.add_theme_stylebox_override("fill", fill)
		cell.add_child(bar)
		var days := Label.new()
		days.text = "0"
		days.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		days.add_theme_font_size_override("font_size", 12)
		days.modulate = Color(1, 1, 1, 0.7)
		cell.add_child(days)
		var tag := Label.new()
		tag.text = SpeciesDB.GROUP_LABEL[g]
		tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tag.add_theme_font_size_override("font_size", 12)
		tag.modulate = tint
		cell.add_child(tag)
		row.add_child(cell)
		_hill_bars[g] = bar
		_hill_crowns[g] = crown
		_hill_days[g] = days

func _update_hill_bars() -> void:
	if _director == null or _hill_bars.is_empty():
		return
	var year: float = _director.year_days()
	var top: String = ""
	var top_d: float = 0.0
	for sp: String in _hill_bars:
		var d: float = float(_director.control_days.get(sp, 0.0))
		if d > top_d:
			top_d = d
			top = sp
	for sp: String in _hill_bars:
		var d: float = float(_director.control_days.get(sp, 0.0))
		var bar := _hill_bars[sp] as ProgressBar
		bar.value = lerpf(bar.value, d / year, 0.35)
		(_hill_days[sp] as Label).text = str(int(d))
		var ruling: bool = sp == _director.current_leader
		bar.modulate = Color(1.25, 1.2, 1.05) if ruling else Color(0.85, 0.85, 0.85)
		(_hill_crowns[sp] as Control).modulate.a = 1.0 if sp == top else (0.45 if ruling else 0.0)
	if not _director.current_leader.is_empty():
		_hill_title.text = "%s rule now" % SpeciesDB.GROUP_LABEL.get(_director.current_leader, _director.current_leader.capitalize())

var _user_paused: bool = false

# The Field Guide over the paused valley. Closing it resumes as it was.
func _open_food_web() -> void:
	if get_node_or_null("FoodWebLayer") != null:
		return
	var was: bool = get_tree().paused
	get_tree().paused = true
	var layer := CanvasLayer.new()
	layer.name = "FoodWebLayer"
	layer.layer = 90
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(layer)
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.05, 0.04)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(bg)
	var guide: Control = (load("res://scenes/ui/field_guide.tscn") as PackedScene).instantiate()
	guide.process_mode = Node.PROCESS_MODE_ALWAYS
	layer.add_child(guide)
	var close := Button.new()
	close.text = "Back to the Valley"
	close.theme_type_variation = "PrimaryButton"
	close.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	close.offset_left = -240.0
	close.offset_top = -62.0
	close.offset_right = -20.0
	close.offset_bottom = -12.0
	close.pressed.connect(func() -> void:
		layer.queue_free()
		get_tree().paused = was)
	layer.add_child(close)

func _toggle_pause() -> void:
	get_tree().paused = not get_tree().paused
	_user_paused = get_tree().paused
	$BottomBar/Pause.text = "Resume" if get_tree().paused else "Pause"

func _end_early() -> void:
	if _director != null:
		_director._end_simulation()

func _snap_top_down() -> void:
	var cam: Camera3D = get_tree().current_scene.get_node_or_null("Camera3D") as Camera3D
	if cam != null and cam.has_method("snap_top_down"):
		cam.snap_top_down()

func _trigger_rain() -> void:
	if not _spend_touch_or_stock("rain"):
		return
	if _director != null:
		_director.trigger_rain()
		FXManager.show_dramatic_text(Vector3.ZERO, "Rain: grass, fungi and worms surge; falcons hunt blind.", Color(0.55, 0.75, 0.9))

func _trigger_predator_call() -> void:
	if not _spend_touch_or_stock("predator_call"):
		return
	if _director != null:
		var n: int = _director.trigger_predator_call()
		var msg: String = "Your champion's kin answer: %d arrive." % n if n > 0 else "No champion to call."
		FXManager.show_dramatic_text(Vector3.ZERO, msg, Color(0.86, 0.45, 0.38))

func _trigger_heal() -> void:
	if not _spend_touch_or_stock("heal"):
		return
	if _director != null:
		_director.trigger_heal()
		FXManager.show_dramatic_text(Vector3.ZERO, "Your champion is mended.", Color(0.62, 0.82, 0.48))

func _trigger_famine() -> void:
	if not _spend_touch_or_stock("famine"):
		return
	if _director != null:
		_director.trigger_famine()
		FXManager.show_dramatic_text(Vector3.ZERO, "Famine: grazers starve, wolves and falcons feast.", Color(0.86, 0.7, 0.4))

func _trigger_flood() -> void:
	if not _spend_touch_or_stock("flood"):
		return
	if _director != null:
		_director.trigger_flood()

# The button only takes aim. The power is spent when you pick the spot.
var _aiming: bool = false
var _aim_mark: MeshInstance3D

func _trigger_meteor() -> void:
	if _director == null:
		return
	if _aiming:
		_cancel_aim()
		return
	var gc: Node = get_node_or_null("/root/GameConfig")
	var stock: int = int(gc.powerup_inventory.get("meteor", 0)) if gc != null else 0
	var points: int = int(gc.eco_points) if gc != null else 0
	if _director.touches_left <= 0 and stock <= 0 and points < _power_price("meteor"):
		# Says why it can't be done.
		_spend_touch_or_stock("meteor")
		return
	_aiming = true
	var ring := TorusMesh.new()
	ring.inner_radius = 0.93
	ring.outer_radius = 1.0
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.45, 0.2)
	_aim_mark = MeshInstance3D.new()
	_aim_mark.mesh = ring
	_aim_mark.material_override = mat
	_aim_mark.scale = Vector3(SimulationDirector.METEOR_BLAST, 0.3, SimulationDirector.METEOR_BLAST)
	_aim_mark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_aim_mark.visible = false
	_director.add_child(_aim_mark)
	FXManager.show_dramatic_text(Vector3.ZERO, "Click where the meteor should fall. Esc cancels.", Color(1.0, 0.6, 0.3))

func _cancel_aim() -> void:
	_aiming = false
	if _aim_mark != null and is_instance_valid(_aim_mark):
		_aim_mark.queue_free()
	_aim_mark = null

func _fire_meteor(at: Vector3) -> void:
	_cancel_aim()
	if _spend_touch_or_stock("meteor"):
		_director.trigger_meteor(at)


# ---------------------------------------------------------------------------
# RIGHT RAIL: one button per HUD window, so every window can be closed and
# opened again, plus Clear view to hide them all and watch the valley. The
# dock along the bottom keeps only time controls; the windows sit left of the
# rail, can be dragged anywhere and fold down to their title bars.
# ---------------------------------------------------------------------------
const RAIL_W: float = 132.0
# An icon for every rail button: SVGs in assets/icons, not emoji (the game's
# fonts have no emoji, so they would draw as empty boxes on Chromebooks).
const RAIL_ICONS: Dictionary = {
	"Census": "rail_census", "Goals": "rail_goals", "Hill": "crown", "Bet Slip": "rail_bets",
	"Creature": "rail_creature", "History": "scroll", "Ticker": "rail_ticker", "Time": "rail_time",
	"Powers": "rail_powers", "Food Web": "rail_census", "Quests": "rail_bets", "Champion": "flag", "Clear view": "eye",
}
var _rail_buttons: Dictionary = {}
var _cleared: Array[Control] = []

func _build_rail() -> void:
	$TopRight.offset_left -= RAIL_W
	$TopRight.offset_right -= RAIL_W
	# The dock: one compact row of time controls above the ticker.
	$BottomBar/History.visible = false
	$BottomBar.offset_right = -16.0 - RAIL_W
	$BottomBar.offset_top = -112.0
	$BottomBar.offset_bottom = -48.0
	for b: Node in $BottomBar.get_children():
		if b is Button:
			(b as Button).custom_minimum_size = Vector2(84, 48)
	_tray.offset_top = -190.0
	_tray.offset_bottom = -120.0
	# The census grows to fit its lines instead of a fixed tall box.
	$TopLeft.offset_bottom = $TopLeft.offset_top
	$TopRight.offset_bottom = $TopRight.offset_top
	HudWindow.dress($TopLeft, "Census", $TopLeft/VBox)
	HudWindow.dress($TopRight, "Champion and Quests", $TopRight/VBoxContainer)
	HudWindow.dress(get_node("HillBars"), "King of the Hill")
	# Start with the bars folded: the valley is the show.
	HudWindow.set_folded(get_node("HillBars"), true)
	_dress_history()

	var rail := VBoxContainer.new()
	rail.name = "Rail"
	rail.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	rail.offset_left = -RAIL_W + 6.0
	rail.offset_right = -8.0
	rail.offset_top = 10.0
	rail.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	rail.add_theme_constant_override("separation", 6)
	add_child(rail)
	var history: EventHistory = get_node_or_null("EventHistory")
	var ticker: Control = get_node_or_null("Tickertape")
	_rail_button(rail, "Food Web", "Pause and open the food web.", _open_food_web)
	_rail_button(rail, "Census", "Show or hide the count of every species.", func() -> void: _toggle_window($TopLeft))
	_rail_button(rail, "Goals", "Show or hide your goals and My Creature.", func() -> void: _toggle_window(_goals))
	_rail_button(rail, "Hill", "Show or hide King of the Hill: who rules the valley.", func() -> void: _toggle_window(get_node("HillBars")))
	_rail_button(rail, "Champion", "Show or hide your champion and the quests you accepted.", func() -> void: _toggle_window($TopRight))
	_rail_button(rail, "Creature", "Show or hide the card of the creature you are following.", func() -> void:
		if _follow_panel != null and is_instance_valid(_follow_panel):
			_toggle_window(_follow_panel))
	_rail_button(rail, "History", "Every birth, death, fight and big moment, colour-coded.", _open_history)
	_rail_button(rail, "Ticker", "Show or hide the news ticker along the bottom.", func() -> void:
		if ticker != null:
			ticker.visible = not ticker.visible)
	_rail_button(rail, "Time", "Show or hide the speed and pause buttons.", func() -> void: $BottomBar.visible = not $BottomBar.visible)
	rail.add_child(HSeparator.new())
	_tray_button.text = "Powers"
	_bets_button.text = "Quests"
	_bets_button.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_bets_button.offset_left = -110.0
	_bets_button.offset_right = 110.0
	_bets_button.offset_top = 8.0
	_bets_button.offset_bottom = 52.0
	_bets_button.custom_minimum_size = Vector2(220, 44)
	_bets_button.add_theme_font_size_override("font_size", 18)
	_bets_button.z_index = 5
	add_child(_bets_button)
	_rail_buttons["Powers"] = _tray_button
	_rail_buttons["Quests"] = _bets_button
	_tray_button.custom_minimum_size = Vector2(0, 44)
	_tray_button.add_theme_font_size_override("font_size", 14)
	_tray_button.focus_mode = Control.FOCUS_NONE
	rail.add_child(_tray_button)
	rail.add_child(HSeparator.new())
	_rail_button(rail, "Clear view", "Hide every window to watch the valley. Press again to bring them back.", _toggle_clear_view)
	for key: String in RAIL_ICONS.keys():
		if _rail_buttons.has(key):
			var b: Button = _rail_buttons[key]
			b.icon = load("res://assets/icons/%s.svg" % RAIL_ICONS[key])
			b.expand_icon = false
			b.add_theme_constant_override("icon_max_width", 20)
			b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	if history != null:
		history.visibility_changed.connect(_refresh_rail)
	_refresh_rail()

func _rail_button(rail: Control, text: String, tip: String, action: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.tooltip_text = tip
	b.toggle_mode = false
	b.custom_minimum_size = Vector2(0, 44)
	b.add_theme_font_size_override("font_size", 14)
	b.focus_mode = Control.FOCUS_NONE
	b.theme_type_variation = "GhostButton"
	b.pressed.connect(func() -> void:
		action.call()
		_refresh_rail())
	rail.add_child(b)
	_rail_buttons[text] = b
	return b

# The windows keep out of each other's way, until the player drags one: then
# that one stays where they put it. Beside the rail on a wide screen, one
# column under the Quests button on a tall phone.
func _tidy_windows() -> void:
	var view: Vector2 = get_viewport().get_visible_rect().size
	var hill: Control = get_node_or_null("HillBars")
	var column: Array[Control] = [$TopRight, hill, _follow_panel]
	if view.x < 900.0:
		var wide: float = view.x - RAIL_W - 16.0
		column = [$TopRight, _goals, hill, _follow_panel, $TopLeft]
		var y: float = 60.0
		if not _narrow_tidied:
			# The census is a long list; on a phone it opens from the rail.
			_narrow_tidied = true
			$TopLeft.visible = false
		for win: Control in column:
			if _free_window(win):
				win.position = Vector2(8.0, y)
				win.size.x = wide
				y += win.size.y + 8.0
		return
	var left: float = view.x - RAIL_W
	var y2: float = 10.0
	for win: Control in column:
		if _free_window(win):
			if win != $TopRight:
				win.position.y = y2
			y2 = win.position.y + win.size.y + 8.0
			left = minf(left, win.position.x)
	if _free_window(_goals):
		_goals.position.x = clampf((view.x - _goals.size.x) * 0.5, 288.0, maxf(288.0, left - _goals.size.x - 8.0))

var _narrow_tidied: bool = false

func _free_window(win: Control) -> bool:
	return win != null and is_instance_valid(win) and win.visible and not win.has_meta("hud_moved")

func _toggle_window(win: Control) -> void:
	if win == null:
		return
	win.visible = not win.visible
	if win.visible:
		HudWindow.set_folded(win, false)

func _dress_history() -> void:
	var history: EventHistory = get_node_or_null("EventHistory")
	if history == null:
		return
	var panel: Panel = history.get_node("Panel")
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.offset_left = -330.0
	panel.offset_right = 330.0
	panel.offset_top = -250.0
	panel.offset_bottom = 230.0
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.97)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	panel.add_theme_stylebox_override("panel", sb)
	HudWindow.dress(panel, "History", history.get_node("Panel/MarginContainer/VBoxContainer"))

func _toggle_clear_view() -> void:
	var windows: Array[Control] = [$TopLeft, $TopRight, _goals, get_node("HillBars"), $BottomBar]
	if _follow_panel != null and is_instance_valid(_follow_panel):
		windows.append(_follow_panel)
	var ticker: Control = get_node_or_null("Tickertape")
	if ticker != null:
		windows.append(ticker)
	if _cleared.is_empty():
		for w: Control in windows:
			if w.visible:
				w.visible = false
				_cleared.append(w)
		_tray.visible = false
	else:
		for w: Control in _cleared:
			if is_instance_valid(w):
				w.visible = true
		_cleared.clear()

# Lit rail buttons mark the windows that are open.
func _refresh_rail() -> void:
	var lit: Dictionary = {
		"Census": $TopLeft.visible,
		"Goals": _goals != null and _goals.visible,
		"Hill": get_node("HillBars").visible,
		"Champion": $TopRight.visible,
		"Creature": _follow_panel != null and is_instance_valid(_follow_panel) and _follow_panel.visible,
		"Ticker": get_node_or_null("Tickertape") != null and get_node("Tickertape").visible,
		"Time": $BottomBar.visible,
		"Clear view": not _cleared.is_empty(),
	}
	var history: EventHistory = get_node_or_null("EventHistory")
	lit["History"] = history != null and history.get_node("Panel").visible
	for key: String in lit.keys():
		if _rail_buttons.has(key):
			(_rail_buttons[key] as Button).modulate = Color(1.0, 0.93, 0.7) if lit[key] else Color(0.72, 0.76, 0.72)
	if _rail_buttons.has("Creature"):
		(_rail_buttons["Creature"] as Button).disabled = _follow_panel == null or not is_instance_valid(_follow_panel)

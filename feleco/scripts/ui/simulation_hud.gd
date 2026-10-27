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
}
# Scene buttons from before 3.0 that are no longer offered.
const RETIRED_BUTTONS: Array[String] = ["Heal", "Famine", "Meteor"]
const POWER_LABELS: Dictionary = {"Call": "Call Kin", "RotRain": "Rot Rain"}
const POWER_TIPS: Dictionary = {
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
	_power_btn("Meteor").tooltip_text = "Drop a meteor on the field."
	_power_btn("Rain").pressed.connect(_trigger_rain)
	_power_btn("Call").pressed.connect(_trigger_predator_call)
	_power_btn("Heal").pressed.connect(_trigger_heal)
	_power_btn("Famine").pressed.connect(_trigger_famine)
	_power_btn("Meteor").pressed.connect(_trigger_meteor)
	_power_btn("Flood").pressed.connect(_trigger_flood)

	_power_btn("Rain").icon = load("res://assets/icons/rain.svg")
	_power_btn("Call").icon = load("res://assets/icons/die.svg")
	_power_btn("Heal").icon = load("res://assets/icons/survive.svg")
	_power_btn("Famine").icon = load("res://assets/icons/famine.svg")
	_power_btn("Meteor").icon = load("res://assets/icons/meteor.svg")

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

# Live betting: the Bets button pauses the valley and opens the table over it.
var _bets_button: Button
var _was_paused: bool = false

func _add_bets_button() -> void:
	_bets_button = Button.new()
	_bets_button.name = "Bets"
	_bets_button.text = "Bets"
	_bets_button.tooltip_text = "Pause and place bets at today's odds. Late bets pay less."
	_bets_button.theme_type_variation = "PrimaryButton"
	_bets_button.custom_minimum_size = Vector2(120, 56)
	_bets_button.pressed.connect(_open_bets)
	$BottomBar.add_child(_bets_button)
	$BottomBar.move_child(_bets_button, 0)
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
	line.text = "Bets: %d open  ·  %d EP won so far  ·  %d EP in the pot" % [open, won, gc.eco_points]
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
	_tray.offset_top = -210
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
	_tray_flow = HFlowContainer.new()
	_tray_flow.alignment = FlowContainer.ALIGNMENT_CENTER
	_tray_flow.add_theme_constant_override("h_separation", 8)
	_tray_flow.add_theme_constant_override("v_separation", 8)
	_tray.add_child(_tray_flow)
	var handlers: Dictionary = {
		"Eclipse": _trigger_eclipse,
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
		_tray_flow.add_child(btn)
	_tray_button = Button.new()
	_tray_button.text = "Powers"
	_tray_button.tooltip_text = "A power for each link of the food web, and the weather. One is free each season."
	_tray_button.custom_minimum_size = Vector2(130, 52)
	FelecoUiScript.mark(_tray_button, "TouchButton")
	_tray_button.pressed.connect(func() -> void: _tray.visible = not _tray.visible)
	$BottomBar.add_child(_tray_button)

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
		btn.text = label if free else "%s  %d" % [label, count]
		btn.disabled = (not free) and count <= 0
		var tip: String = POWER_TIPS.get(btn_name, "")
		if free:
			btn.tooltip_text = "%s\nFree: this season's one touch. Stock left: %d." % [tip, count]
		else:
			btn.tooltip_text = "%s\nUses a Greenhouse charge. Stock: %d." % [tip, count]

# Goals, the tutorial and My Creature live in one card at the top.
var _goals: GoalsPanel

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
	_goals.offset_top = 10.0
	_goals.grow_horizontal = Control.GROW_DIRECTION_BOTH
	add_child(_goals)
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and not gc.tutorial_done and gc.current_mode == "sandbox":
		_show_welcome.call_deferred()

# First run: say plainly what Feleco is and what to do.
func _show_welcome() -> void:
	# Wait out the loading screen, which pauses the tree.
	while get_tree().paused:
		await get_tree().create_timer(0.3, true, false, true).timeout
	var shade := ColorRect.new()
	shade.name = "Welcome"
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
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
	if _director != null and _director.touches_left > 0:
		_director.touches_left -= 1
		_update_powerup_buttons()
		_refresh_champion()
		power_uses += 1
		return true
	var used: bool = _consume_powerup(powerup_id)
	if used:
		power_uses += 1
	return used

func _consume_powerup(powerup_id: String) -> bool:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null:
		return false
	var count: int = gc.powerup_inventory.get(powerup_id, 0)
	if count <= 0:
		return false
	gc.powerup_inventory[powerup_id] = count - 1
	gc.save_meta()
	_update_powerup_buttons()
	return true

# Rampages go in the History in gold (won) or red (lost), and the History
# button glows that colour for a few seconds so the player knows to look.
func _on_rampage_result(who: String, kills: int, won: bool) -> void:
	var goal: int = int(get_node("/root/GameConfig").RAMPAGE_GOAL)
	var col: Color = Color(1.0, 0.82, 0.3) if won else Color(0.95, 0.35, 0.3)
	var history: EventHistory = get_node_or_null("EventHistory")
	if history != null:
		history.add_highlight("%s %s's rampage: %d of %d devoured" % ["★ WON" if won else "✖ LOST", who, kills, goal], col)
	var btn: Button = $BottomBar/History
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

# Follow mode: click a creature in the valley to ride along with it.
var _follow_panel: FollowPanel
var _press_at: Vector2 = Vector2(-1, -1)

func _unhandled_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb == null or mb.button_index != MOUSE_BUTTON_LEFT:
		return
	if mb.pressed:
		_press_at = mb.position
		return
	# A click, not a drag: pick the creature under the pointer.
	if _press_at.distance_to(mb.position) > 16.0 or has_node("LiveTable") or has_node("Resolution"):
		return
	if _goals != null and _goals.try_collect(mb.position):
		return
	var agent := _get_hovered_agent() as MarkovAgent
	if agent != null:
		_start_follow(agent)

func _start_follow(agent: MarkovAgent) -> void:
	_stop_follow()
	var cam: Camera3D = get_tree().current_scene.get_node_or_null("Camera3D") as Camera3D
	if cam != null and cam.has_method("follow"):
		cam.follow(agent)
	_follow_panel = FollowPanel.new()
	_follow_panel.agent = agent
	_follow_panel.director = _director
	_follow_panel.anchor_left = 1.0
	_follow_panel.anchor_right = 1.0
	_follow_panel.offset_left = -440.0
	_follow_panel.offset_right = -10.0
	_follow_panel.offset_top = 170.0
	_follow_panel.stopped.connect(_stop_follow)
	add_child(_follow_panel)
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

func _process(_delta: float) -> void:
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
		var p: Vector3 = data.shown if data.has_shown else data.pos
		var mid: Vector3 = p + Vector3.UP * 0.8
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
			$TopLeft/VBox/SheepCount.text = "Sheep  %d" % count
		"wolves":
			$TopLeft/VBox/WolfCount.text = "Wolves  %d" % count
		"humans":
			var tribes: int = _director.tribe_count() if _director != null else 0
			$TopLeft/VBox/HumanCount.text = "Humans  %d   · %d tribe%s" % [count, tribes, "" if tribes == 1 else "s"]
		"mushrooms":
			pass
		"falcons":
			$TopLeft/VBox/FalconCount.text = "Falcons  %d" % count
		"robins":
			$TopLeft/VBox/RobinCount.text = "Robins  %d" % count
		"boars":
			$TopLeft/VBox/BoarCount.text = "Boars  %d" % count
		"rabbits":
			$TopLeft/VBox/RabbitCount.text = "Rabbits  %d" % count
		"wizards":
			$TopLeft/VBox/WizardCount.text = "Wizards  %d" % count
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
		$TopLeft/VBox/WormCount.text = "Worms  %d" % _director._active_worms.size()
		$TopLeft/VBox/FishCount.text = "Fish  %d" % _director._active_fish.size()
		for id: String in _extra_counts.keys():
			(_extra_counts[id] as Label).text = "%s  %d" % [SpeciesDB.label(id), _director.get_species_count(id)]
		_update_breakdown()
		_refresh_champion()

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

# King of the hill: one bar per species, rising with each day it rules the valley.
const HILL_SPECIES: Array = [
	["sheep", "Shp", Color(0.93, 0.92, 0.86)], ["wolves", "Wlf", Color(0.6, 0.62, 0.68)],
	["humans", "Hum", Color(0.9, 0.68, 0.46)], ["falcons", "Fal", Color(0.72, 0.52, 0.32)],
	["robins", "Rob", Color(0.9, 0.42, 0.3)], ["boars", "Boa", Color(0.5, 0.36, 0.28)],
	["rabbits", "Rab", Color(0.78, 0.7, 0.58)], ["worms", "Wrm", Color(0.85, 0.52, 0.6)],
	["fish", "Fsh", Color(0.42, 0.66, 0.86)],
	["deer", "Der", Color(0.72, 0.5, 0.32)], ["goats", "Got", Color(0.9, 0.88, 0.82)],
	["bears", "Bea", Color(0.46, 0.3, 0.2)], ["lions", "Lio", Color(0.82, 0.62, 0.38)],
	["beetles", "Btl", Color(0.4, 0.58, 0.45)],
]
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
	panel.offset_left = -470.0
	panel.offset_right = -10.0
	panel.offset_top = 178.0
	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.tooltip_text = "Who rules the valley. A bar rises for each day that species is the most dominant population for its kind. Most days ruled at year's end wins."
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
	_hill_title.text = "King of the Hill"
	_hill_title.add_theme_font_size_override("font_size", 14)
	_hill_title.modulate = Color(0.95, 0.85, 0.55)
	col.add_child(_hill_title)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_child(row)
	for entry: Array in HILL_SPECIES:
		var cell := VBoxContainer.new()
		cell.add_theme_constant_override("separation", 2)
		cell.custom_minimum_size = Vector2(26, 0)
		# An icon, not a glyph: the web build has only the game's own fonts.
		var crown := TextureRect.new()
		crown.texture = load("res://assets/icons/crown.svg")
		crown.custom_minimum_size = Vector2(16, 14)
		crown.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		crown.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		crown.modulate = Color(1.0, 0.84, 0.3, 0.0)
		cell.add_child(crown)
		var bar := ProgressBar.new()
		bar.fill_mode = ProgressBar.FILL_BOTTOM_TO_TOP
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(18, HILL_BAR_H)
		bar.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		bar.max_value = 1.0
		bar.step = 0.0
		var bg := StyleBoxFlat.new()
		bg.bg_color = Color(1, 1, 1, 0.07)
		bg.set_corner_radius_all(4)
		var fill := StyleBoxFlat.new()
		fill.bg_color = entry[2]
		fill.set_corner_radius_all(4)
		bar.add_theme_stylebox_override("background", bg)
		bar.add_theme_stylebox_override("fill", fill)
		cell.add_child(bar)
		var days := Label.new()
		days.text = "0"
		days.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		days.add_theme_font_size_override("font_size", 11)
		days.modulate = Color(1, 1, 1, 0.7)
		cell.add_child(days)
		var tag := Label.new()
		tag.text = entry[1]
		tag.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tag.add_theme_font_size_override("font_size", 11)
		tag.modulate = entry[2]
		cell.add_child(tag)
		row.add_child(cell)
		_hill_bars[entry[0]] = bar
		_hill_crowns[entry[0]] = crown
		_hill_days[entry[0]] = days

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
		_hill_title.text = "King of the Hill · %s rule now" % _director.current_leader.capitalize()

var _user_paused: bool = false

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

func _trigger_meteor() -> void:
	if not _spend_touch_or_stock("meteor"):
		return
	if _director != null:
		_director.trigger_meteor()
		FXManager.show_dramatic_text(Vector3.ZERO, "A meteor breaks whoever holds the valley.", Color(0.9, 0.45, 0.35))

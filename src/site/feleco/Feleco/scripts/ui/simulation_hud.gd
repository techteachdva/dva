extends CanvasLayer

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

var _director: SimulationDirector = null
var _side_bet_agent: Node3D = null
var _side_bet_marker: MeshInstance3D = null
var _side_bet_pulse: float = 0.0
var _shown_touches: int = -1

const POWERUP_BUTTONS: Dictionary = {
	"Rain": "rain",
	"Call": "predator_call",
	"Heal": "heal",
	"Famine": "famine",
	"Meteor": "meteor",
	"Flood": "flood",
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

	$BottomBar/Speed1.pressed.connect(func() -> void: Engine.time_scale = 1.0)
	$BottomBar/Speed2.pressed.connect(func() -> void: Engine.time_scale = 2.0)
	$BottomBar/Speed5.pressed.connect(func() -> void: Engine.time_scale = 5.0)
	$BottomBar/Pause.pressed.connect(_toggle_pause)
	$BottomBar/EndEarly.pressed.connect(_end_early)
	$BottomBar/TopDown.pressed.connect(_snap_top_down)
	$BottomBar/TopDown.tooltip_text = "Look straight down. Right-drag orbits, scroll zooms, WASD moves."
	$BottomBar/History.pressed.connect(_open_history)
	$BottomBar/Speed1.tooltip_text = "Run at a normal day."
	$BottomBar/Speed2.tooltip_text = "Run at twice the pace."
	$BottomBar/Speed5.tooltip_text = "Run at five times the pace."
	$BottomBar/Pause.tooltip_text = "Hold the valley still."
	$BottomBar/EndEarly.tooltip_text = "End the run and score the bets now."
	$BottomBar/History.tooltip_text = "Read births, deaths, and settlements."
	$BottomBar/Rain.tooltip_text = "A rain that makes the grass surge."
	$BottomBar/Call.tooltip_text = "Call wolves toward the herds."
	$BottomBar/Heal.tooltip_text = "Mend the creature you are watching."
	$BottomBar/Famine.tooltip_text = "Starve the grass for a stretch."
	$BottomBar/Meteor.tooltip_text = "Drop a meteor on the field."
	$BottomBar/Rain.pressed.connect(_trigger_rain)
	$BottomBar/Call.pressed.connect(_trigger_predator_call)
	$BottomBar/Heal.pressed.connect(_trigger_heal)
	$BottomBar/Famine.pressed.connect(_trigger_famine)
	$BottomBar/Meteor.pressed.connect(_trigger_meteor)
	$BottomBar/Flood.pressed.connect(_trigger_flood)

	$BottomBar/Rain.icon = load("res://assets/icons/rain.svg")
	$BottomBar/Call.icon = load("res://assets/icons/die.svg")
	$BottomBar/Heal.icon = load("res://assets/icons/survive.svg")
	$BottomBar/Famine.icon = load("res://assets/icons/famine.svg")
	$BottomBar/Meteor.icon = load("res://assets/icons/meteor.svg")

	_update_powerup_buttons()

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

func _mark_dock() -> void:
	for btn_name: String in ["Speed1", "Speed2", "Speed5", "Pause", "TopDown", "History"]:
		var ghost: Button = $BottomBar.get_node(btn_name)
		FelecoUiScript.mark(ghost, "GhostButton")
		ghost.custom_minimum_size = Vector2(96, 52)
	FelecoUiScript.mark($BottomBar/EndEarly, "DangerButton")
	$BottomBar/EndEarly.custom_minimum_size = Vector2(120, 52)
	for btn_name: String in POWERUP_BUTTONS.keys():
		var touch: Button = $BottomBar.get_node(btn_name)
		FelecoUiScript.mark(touch, "TouchButton")
		touch.custom_minimum_size = Vector2(148, 56)

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
		var btn: Button = $BottomBar.get_node_or_null(btn_name)
		if btn == null:
			continue
		var pid: String = POWERUP_BUTTONS[btn_name]
		var count: int = int(gc.powerup_inventory.get(pid, 0))
		btn.text = btn_name if free else "%s  %d" % [btn_name, count]
		btn.disabled = (not free) and count <= 0
		if free:
			btn.tooltip_text = "This season's one touch. Stock left: %d. An unspent touch ends with the season." % count
		else:
			btn.tooltip_text = "Spend a Greenhouse charge. Stock: %d." % count

func _spend_touch_or_stock(powerup_id: String) -> bool:
	if _director != null and _director.touches_left > 0:
		_director.touches_left -= 1
		_update_powerup_buttons()
		_refresh_champion()
		return true
	return _consume_powerup(powerup_id)

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

func _process(_delta: float) -> void:
	# Animate side bet highlight marker
	if _side_bet_marker != null and _side_bet_agent != null and is_instance_valid(_side_bet_agent) and _side_bet_agent.is_inside_tree():
		_side_bet_pulse += _delta * 4.0
		var base_y: float = _side_bet_agent.global_position.y + 2.0
		_side_bet_marker.global_position = Vector3(_side_bet_agent.global_position.x, base_y + sin(_side_bet_pulse) * 0.3, _side_bet_agent.global_position.z)
		var scale_val: float = 1.0 + sin(_side_bet_pulse * 2.0) * 0.2
		_side_bet_marker.scale = Vector3(scale_val, 1.0, scale_val)
	elif _side_bet_marker != null:
		_side_bet_marker.queue_free()
		_side_bet_marker = null
	if _director != null and _director.touches_left != _shown_touches:
		_shown_touches = _director.touches_left
		_update_powerup_buttons()
	if get_tree().paused:
		_update_tooltip()

func _update_tooltip() -> void:
	var tooltip: Panel = get_node_or_null("Tooltip")
	if tooltip == null:
		return
	if not get_tree().paused:
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
	var mouse_pos := get_viewport().get_mouse_position()
	var ray_origin := cam.project_ray_origin(mouse_pos)
	var ray_dir := cam.project_ray_normal(mouse_pos)
	# Intersect with ground plane y=0
	if absf(ray_dir.y) < 0.001:
		return null
	var t := -ray_origin.y / ray_dir.y
	if t < 0:
		return null
	var hit_pos := ray_origin + ray_dir * t
	var best: Node3D = null
	var best_dist := 12.0  # generous hover radius for angled cameras
	if _director == null:
		return null
	for data: AgentData in _director._agent_registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		if not data.node.is_inside_tree():
			continue
		var node_pos: Vector3 = data.node.global_position
		# Ignore Y difference for ground agents; use full 3D distance for aerial
		var d: float = Vector2(hit_pos.x, hit_pos.z).distance_to(Vector2(node_pos.x, node_pos.z))
		if d < best_dist:
			best_dist = d
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
	elif agent.is_in_group("human"):
		if agent.get("variant") == "wizard": species = "Wizard"
		elif agent.get("variant") == "builder": species = "Builder"
		else: species = "Human"
	elif agent.is_in_group("boar"): species = "Boar"
	elif agent.is_in_group("falcon"): species = "Falcon"
	elif agent.is_in_group("robin"): species = "Robin"
	elif agent.is_in_group("rabbit"): species = "Rabbit"
	elif agent.is_in_group("worm"): species = "Worm"
	elif agent.is_in_group("spore"): species = "Mushroom"
	var text := "[b]%s[/b] the %s\n" % [name_str, species]
	text += "State: [color=#aaffaa]%s[/color]\n" % state
	text += "Health: %.0f  |  Energy: %.0f  |  Age: %.1f\n" % [health, energy, age]
	text += "[i]%s[/i]" % _species_rules(species)
	return text

func _setup_side_bet_marker() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null or gc.side_bet_entity.is_empty():
		return
	var sb_name: String = gc.side_bet_entity.get("name", "")
	var sb_species: String = gc.side_bet_entity.get("species", "")
	if _director == null:
		return
	for data: AgentData in _director._agent_registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		if not data.node is MarkovAgent:
			continue
		var ma: MarkovAgent = data.node as MarkovAgent
		if ma.display_name == sb_name and data.species == sb_species:
			_side_bet_agent = ma
			break
	if _side_bet_agent == null:
		return
	var marker := MeshInstance3D.new()
	marker.name = "SideBetMarker"
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.2
	cyl.bottom_radius = 1.2
	cyl.height = 0.05
	marker.mesh = cyl
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.8, 0.0)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.8, 0.0)
	mat.emission_energy = 2.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.disable_receive_shadows = true
	marker.material_override = mat
	var world: Node3D = get_tree().current_scene.get_node_or_null("World")
	if world != null:
		world.add_child(marker)
		_side_bet_marker = marker

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
			$TopLeft/VBox/HumanCount.text = "Humans  %d" % count
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
	var total_days: int = int(days_remaining)
	var months: int = int(total_days / 30.0)
	var rem: int = total_days % 30
	var weeks: int = int(rem / 7.0)
	var days: int = rem % 7
	var season: String = ""
	if _director != null:
		season = _director.get_season()
	$TopLeft/VBox/TimerLabel.text = "%s   ·   month %d, week %d, day %d" % [season, months, weeks, days]
	if _director != null:
		$TopLeft/VBox/WormCount.text = "Worms  %d" % _director._active_worms.size()
		$TopLeft/VBox/FishCount.text = "Fish  %d" % _director._active_fish.size()
		_refresh_champion()

func _on_sim_ended(winner: String) -> void:
	Engine.time_scale = 1.0
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	var res: Control = load("res://scenes/ui/resolution_screen.tscn").instantiate() as Control
	res.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(res)
	if res.has_method("show_result"):
		res.show_result(winner)

func _toggle_pause() -> void:
	get_tree().paused = not get_tree().paused
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
		FXManager.show_dramatic_text(Vector3.ZERO, "Rain. The meadow drinks for 5 days.", Color(0.55, 0.75, 0.9))

func _trigger_predator_call() -> void:
	if not _spend_touch_or_stock("predator_call"):
		return
	if _director != null:
		_director.trigger_predator_call()
		FXManager.show_dramatic_text(Vector3.ZERO, "Two wolves answer.", Color(0.86, 0.45, 0.38))

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
		FXManager.show_dramatic_text(Vector3.ZERO, "Famine. The grass fails for 10 days.", Color(0.86, 0.7, 0.4))

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

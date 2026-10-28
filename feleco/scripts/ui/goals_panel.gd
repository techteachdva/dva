class_name GoalsPanel
extends PanelContainer

# Something to do while the valley runs. Students found Feleco confusing and
# "just watching", so this card gives every run a short list of goals (the
# first ones double as the tutorial), and holds My Creature: one animal the
# player adopts, levels up, trains, renames and recolours. A rare diamond
# turns up once a run for sharp-eyed players.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# [id, goal, hint, EP reward]. Shown two at a time, in order.
const GOALS: Array = [
	["watch", "Tap an animal to watch it", "Tap or click any creature. Drag to move the camera; scroll or pinch to zoom.", 10],
	["adopt", "Make it your creature", "On the animal's card, press Make Mine.", 15],
	["power", "Use a power", "Open Powers at the bottom and try one on the valley.", 15],
	["skill", "Train your creature", "Press Level Up & Train on your creature and win a trial.", 20],
	["bet", "Place a bet", "Open Bets and back the species you think will rule the valley.", 15],
	["survive", "Keep your creature alive a whole day", "Heal it, feed it, keep it away from hunters.", 40],
	["level5", "Raise your creature to level 5", "Eating and surviving earn XP faster as it trains.", 60],
	["diamond", "Find the rare diamond", "Now and then a diamond glints somewhere in the valley. Tap it!", 100],
]
const SKILL_MAX: int = 5
const SKILL_NAME: Dictionary = {"speed": "Speed", "tough": "Toughness", "vital": "Vitality", "senses": "Senses", "charm": "Charm"}
# Strong, saturated colours (they multiply the sprite, so they need to be
# punchy to show on white wool or brown fur).
const COLOURS: Array = [
	Color.WHITE, Color(1.25, 0.12, 0.12), Color(0.15, 0.45, 1.3),
	Color(0.15, 1.2, 0.2), Color(1.0, 0.15, 1.25), Color(1.3, 0.85, 0.05), Color(0.05, 1.1, 1.25),
]
const DIAMOND_EP: int = 250

var director: SimulationDirector
var hud: Node
var saga: ValleySaga = null
var _saga_box: VBoxContainer

var _done: Dictionary = {}
var _goal_box: VBoxContainer
var _creature_box: VBoxContainer
var _collapse: Button
var _body: VBoxContainer
var _accum: float = 0.0

# My Creature.
var companion: MarkovAgent = null
var _c_data: AgentData = null
var _adopt_day: float = 0.0
var xp: float = 0.0
var level: int = 1
var points: int = 0
var skills: Dictionary = {"speed": 0, "tough": 0, "vital": 0, "senses": 0, "charm": 0}
var _train_btn: Button
var _last_energy: float = -1.0
var _c_title: Label
var _c_xp: ProgressBar
var _c_info: Label

# The diamond.
var _diamond: Node3D = null
var _diamond_day: float = 0.0
var _diamond_gone_day: float = 0.0
var _diamond_found: bool = false

func _ready() -> void:
	add_to_group("goals_panel")
	process_mode = Node.PROCESS_MODE_ALWAYS
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.9)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 10)
	add_theme_stylebox_override("panel", sb)
	custom_minimum_size = Vector2(360, 0)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	add_child(col)
	var head := HBoxContainer.new()
	col.add_child(head)
	var title := FelecoUiScript.heading("Goals", 16, FelecoUiScript.GOLD)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(title)
	_collapse = Button.new()
	_collapse.text = "-"
	_collapse.tooltip_text = "Fold the goals down to their title. Drag the card to move it."
	HudWindow.style_bar_button(_collapse)
	_collapse.pressed.connect(_toggle)
	head.add_child(_collapse)
	_body = VBoxContainer.new()
	_body.add_theme_constant_override("separation", 6)
	col.add_child(_body)
	_saga_box = VBoxContainer.new()
	_saga_box.add_theme_constant_override("separation", 2)
	_body.add_child(_saga_box)
	_goal_box = VBoxContainer.new()
	_goal_box.add_theme_constant_override("separation", 2)
	_body.add_child(_goal_box)
	# Tutorial goals done in earlier runs stay done.
	var gc0: Node = get_node_or_null("/root/GameConfig")
	if gc0 != null:
		var saved = gc0.record("goals", "done")
		if saved is Dictionary:
			_done = (saved as Dictionary).duplicate()
	_creature_box = VBoxContainer.new()
	_creature_box.add_theme_constant_override("separation", 3)
	_creature_box.visible = false
	_body.add_child(_creature_box)
	_build_creature_box()
	_refresh_goals()
	_diamond_day = -1.0

func _toggle() -> void:
	_body.visible = not _body.visible
	_collapse.text = "-" if _body.visible else "+"

# --- Goals ---------------------------------------------------------------

func _refresh_goals() -> void:
	for c in _goal_box.get_children():
		c.queue_free()
	var shown: int = 0
	for g: Array in GOALS:
		if _done.has(g[0]):
			continue
		var first: bool = shown == 0
		var row := FelecoUiScript.label(("> " if first else "- ") + g[1] + "  (+%d EP)" % g[3], 15 if first else 13,
			FelecoUiScript.CREAM if first else FelecoUiScript.MIST)
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_goal_box.add_child(row)
		if first:
			var hint := FelecoUiScript.label(g[2], 12, FelecoUiScript.GOLD)
			hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			_goal_box.add_child(hint)
		shown += 1
		if shown >= 2:
			break
	if shown == 0 and saga == null:
		_goal_box.add_child(FelecoUiScript.label("All goals done! Try a Challenge next.", 14, FelecoUiScript.LEAF))

func _complete(id: String) -> void:
	if _done.has(id):
		return
	_done[id] = true
	var gcs: Node = get_node_or_null("/root/GameConfig")
	if gcs != null:
		gcs.set_record("goals", "done", _done.duplicate())
	for g: Array in GOALS:
		if g[0] == id:
			var gc: Node = get_node_or_null("/root/GameConfig")
			if gc != null:
				gc.award_eco_points(int(g[3]))
			FXManager.show_dramatic_text(Vector3.ZERO, "Goal done: %s  +%d EP" % [g[1], g[3]], Color(0.62, 0.9, 0.5))
	_refresh_goals()

func _check_goals() -> void:
	if hud != null and hud.get("_follow_panel") != null and is_instance_valid(hud.get("_follow_panel")):
		_complete("watch")
	if companion != null:
		_complete("adopt")
	if hud != null and int(hud.get("power_uses")) > 0:
		_complete("power")
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and not (gc.bets as Array).is_empty():
		_complete("bet")
	if _alive() and director != null and director.get_day() - _adopt_day >= 1.0:
		_complete("survive")
	if level >= 5:
		_complete("level5")

# The saga: this year's goal with a progress bar, then today's quests.
func refresh_saga() -> void:
	if saga == null or _saga_box == null:
		return
	for c in _saga_box.get_children():
		c.queue_free()
	var y: Array = ValleySaga.YEARS[saga.year - 1]
	var prog: Array = saga.year_progress()
	_saga_box.add_child(FelecoUiScript.heading("%s  (of %d)" % [y[0], ValleySaga.YEARS.size()], 15, FelecoUiScript.GOLD))
	var goal := FelecoUiScript.label("YEAR GOAL: %s" % y[1], 14, FelecoUiScript.CREAM)
	goal.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_saga_box.add_child(goal)
	var bar := ProgressBar.new()
	bar.max_value = 1.0
	bar.value = float(prog[0])
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0, 10)
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.5, 0.9, 0.4) if float(prog[0]) >= 0.999 else FelecoUiScript.GOLD
	fill.set_corner_radius_all(4)
	bar.add_theme_stylebox_override("fill", fill)
	_saga_box.add_child(bar)
	_saga_box.add_child(FelecoUiScript.label(prog[1], 12, FelecoUiScript.MIST))
	_saga_box.add_child(FelecoUiScript.heading("Today's quests", 14, FelecoUiScript.GOLD))
	for q: Dictionary in saga.quests():
		var row := FelecoUiScript.label(("[done] " if q["done"] else "- ") + "%s  (+%d EP)" % [q["text"], q["ep"]], 13, FelecoUiScript.LEAF if q["done"] else FelecoUiScript.CREAM)
		row.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_saga_box.add_child(row)

# --- My Creature ---------------------------------------------------------

func _alive() -> bool:
	return companion != null and is_instance_valid(companion) and not companion.is_queued_for_deletion() \
		and companion.is_inside_tree() and companion._data == _c_data

func is_companion(agent: Node) -> bool:
	return _alive() and agent == companion

func adopt(agent: MarkovAgent) -> void:
	if agent == null:
		return
	if _alive():
		_c_data.tint = Color.WHITE
		_c_data.speed_boost = 1.0
	if _alive() and companion.has_node("Aura"):
		companion.get_node("Aura").queue_free()
	companion = agent
	_c_data = agent._data
	# The aura from the Greenhouse rides under your creature.
	var aura := Cosmetics.make_aura(get_node_or_null("/root/GameConfig"))
	if aura != null:
		agent.add_child(aura)
	_adopt_day = director.get_day() if director != null else 0.0
	xp = 0.0
	level = 1
	points = 1
	skills = {"speed": 0, "tough": 0, "vital": 0, "senses": 0, "charm": 0}
	_last_energy = -1.0
	_creature_box.visible = true
	FXManager.show_dramatic_text(agent.global_position, "%s is yours now!" % agent.display_name, FelecoUiScript.GOLD)
	_refresh_creature()

func _build_creature_box() -> void:
	_creature_box.add_child(FelecoUiScript.divider())
	var row := HBoxContainer.new()
	_creature_box.add_child(row)
	_c_title = FelecoUiScript.heading("My Creature", 16, FelecoUiScript.GOLD)
	_c_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_c_title.clip_text = true
	row.add_child(_c_title)
	var find := Button.new()
	find.text = "Find"
	find.theme_type_variation = "GhostButton"
	find.tooltip_text = "Fly the camera to your creature."
	find.pressed.connect(func() -> void:
		if _alive() and hud != null and hud.has_method("_start_follow"):
			hud.call("_start_follow", companion))
	row.add_child(find)
	_c_xp = ProgressBar.new()
	_c_xp.show_percentage = false
	_c_xp.custom_minimum_size = Vector2(0, 10)
	_creature_box.add_child(_c_xp)
	_c_info = FelecoUiScript.label("", 12, FelecoUiScript.MIST)
	_c_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_creature_box.add_child(_c_info)
	# Levelling and training happen in their own menu (LevelUpMenu).
	_train_btn = Button.new()
	_train_btn.text = "Level Up & Train"
	_train_btn.theme_type_variation = "PrimaryButton"
	_train_btn.custom_minimum_size = Vector2(0, 36)
	_train_btn.tooltip_text = "Win minigames to level up and to train Speed, Toughness, Vitality, Senses and Charm."
	_train_btn.pressed.connect(open_menu)
	_creature_box.add_child(_train_btn)
	var custom := HBoxContainer.new()
	custom.add_theme_constant_override("separation", 4)
	_creature_box.add_child(custom)
	var name_edit := LineEdit.new()
	name_edit.placeholder_text = "Rename..."
	name_edit.max_length = 16
	name_edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_edit.text_submitted.connect(func(t: String) -> void:
		if not _alive():
			return
		# Classroom-safe and original names only (NameGenerator.check_player_name).
		var why: String = NameGenerator.check_player_name(t)
		if not why.is_empty():
			name_edit.text = ""
			name_edit.placeholder_text = why
			return
		companion.display_name = t.strip_edges()
		name_edit.text = ""
		name_edit.placeholder_text = "Rename..."
		name_edit.release_focus()
		_refresh_creature())
	custom.add_child(name_edit)
	for c: Color in COLOURS:
		var sw := Button.new()
		sw.custom_minimum_size = Vector2(24, 28)
		sw.tooltip_text = "Colour your creature."
		var st := StyleBoxFlat.new()
		st.bg_color = c
		st.set_corner_radius_all(6)
		sw.add_theme_stylebox_override("normal", st)
		sw.add_theme_stylebox_override("hover", st)
		sw.add_theme_stylebox_override("pressed", st)
		sw.pressed.connect(func() -> void:
			if _alive():
				_c_data.tint = c)
		custom.add_child(sw)

func _xp_needed() -> float:
	return 30.0 + 25.0 * float(level)

# --- For LevelUpMenu ---

func xp_needed() -> float:
	return _xp_needed()

func alive() -> bool:
	return _alive()

func tint() -> Color:
	return _c_data.tint if _alive() else Color.WHITE

func open_menu() -> void:
	if not _alive() or hud == null:
		return
	var menu := LevelUpMenu.new()
	menu.goals = self
	hud.add_child(menu)

func refresh_now() -> void:
	_refresh_creature()

# Won the Feast: the full XP bar becomes a level and a skill point.
func level_up() -> void:
	if not _alive():
		return
	xp = 0.0
	level += 1
	points += 1
	if companion.get("health") != null:
		companion.health = minf(float(companion.health) + 25.0, 100.0)
	FXManager.show_dramatic_text(companion.global_position, "%s reached level %d!" % [companion.display_name, level], FelecoUiScript.GOLD)
	if level >= 5 and Cosmetics.grant(get_node_or_null("/root/GameConfig"), "rainbow"):
		FXManager.show_dramatic_text(companion.global_position + Vector3.UP * 2.0, "Unlocked: Rainbow aura! (Greenhouse > Looks)", Color(0.9, 0.7, 1.0))

# Won a trial: spend the point and raise that line.
func train(id: String) -> void:
	if not _alive() or points <= 0 or int(skills[id]) >= SKILL_MAX:
		return
	points -= 1
	skills[id] = int(skills[id]) + 1
	var r: int = int(skills[id])
	var effect: String = ""
	match id:
		"speed":
			_c_data.speed_boost = 1.0 + 0.1 * float(skills["speed"])
			effect = "runs %d%% faster" % (10 * r)
		"tough":
			effect = "heals %.1f health a second" % (0.6 * r)
		"vital":
			companion._lifespan *= 1.1
			effect = "lives %d%% longer" % int(round((pow(1.1, r) - 1.0) * 100.0))
		"senses":
			if companion._vision_cone != null:
				companion._vision_cone.vision_range *= 1.15
			effect = "spots food and danger %d%% further" % int(round((pow(1.15, r) - 1.0) * 100.0))
		"charm":
			effect = "is ready to raise young sooner"
	# Say what the rank did, so training has a visible result in the valley.
	FXManager.show_dramatic_text(companion.global_position, "%s: %s %d/%d  -  %s" % [companion.display_name, SKILL_NAME.get(id, id.capitalize()), r, SKILL_MAX, effect], FelecoUiScript.GOLD)
	_complete("skill")
	_refresh_creature()

func _tick_creature(delta: float) -> void:
	if _alive() and companion.has_node("Aura"):
		var au := companion.get_node("Aura") as MeshInstance3D
		au.rotate_y(delta * 0.8)
		var m := au.material_override as StandardMaterial3D
		if m != null and m.has_meta("rainbow"):
			m.albedo_color = Color.from_hsv(fposmod(Time.get_ticks_msec() * 0.0002, 1.0), 0.7, 1.0)
	if companion == null:
		return
	if not _alive():
		companion = null
		_c_title.text = "Your creature has died"
		_c_info.text = "Tap another animal and press Make Mine to start again."
		_train_btn.disabled = true
		return
	# XP: staying alive, plus every bite it eats.
	var gain: float = delta * 1.5
	var en: float = float(companion.get("energy")) if companion.get("energy") != null else 0.0
	if _last_energy >= 0.0 and en > _last_energy:
		gain += (en - _last_energy) * 0.5
	_last_energy = en
	# The bar fills and waits: a Feast in the Level Up menu cashes it in.
	var was_full: bool = xp >= _xp_needed()
	xp = minf(xp + gain, _xp_needed())
	if not was_full and xp >= _xp_needed():
		FXManager.show_dramatic_text(companion.global_position, "%s is ready to level up!" % companion.display_name, FelecoUiScript.GOLD)
	# Charm: ready to raise young sooner.
	var charm: int = int(skills["charm"])
	if charm > 0 and companion.get("_repro_cooldown") != null:
		companion.set("_repro_cooldown", float(companion.get("_repro_cooldown")) - 0.3 * charm * delta)
	var tough: int = int(skills["tough"])
	if tough > 0 and companion.get("health") != null:
		companion.health = minf(float(companion.health) + 0.6 * float(tough) * delta, 100.0)

# The title your creature has earned: the best one shows on its card.
func _title() -> String:
	if not _alive():
		return ""
	var days: float = (director.get_day() - _adopt_day) if director != null else 0.0
	if level >= 8:
		return "Legend"
	if companion.golden > 0.05:
		return "Golden One"
	if level >= 5:
		return "Veteran"
	if days >= 2.0:
		return "Old Hand"
	if days >= 1.0:
		return "Survivor"
	return ""

func _refresh_creature() -> void:
	if not _alive():
		return
	_c_title.text = "%s  ·  Lv %d%s" % [companion.display_name, level, ("  ·  " + _title()) if not _title().is_empty() else ""]
	_c_xp.max_value = _xp_needed()
	_c_xp.value = xp
	var hp: float = float(companion.get("health")) if companion.get("health") != null else 0.0
	var ready: bool = xp >= _xp_needed()
	_c_info.text = "%s · Health %d · %s" % [SpeciesDB.label(companion.species_id).trim_suffix("s"), int(hp),
		"READY TO LEVEL UP!" if ready else (("%d skill point%s to spend" % [points, "" if points == 1 else "s"]) if points > 0 else "Earn XP by eating and surviving")]
	_train_btn.disabled = false
	_train_btn.text = "Level Up!" if ready else ("Train (%d point%s)" % [points, "" if points == 1 else "s"] if points > 0 else "Level Up & Train")

# --- The diamond ---------------------------------------------------------

func _tick_diamond(delta: float) -> void:
	if director == null or _diamond_found:
		return
	if _diamond_day < 0.0:
		# The first diamond turns up somewhere in the first few days.
		_diamond_day = director.get_day() + randf_range(0.8, 3.0)
	if _diamond == null and director.get_day() >= _diamond_day:
		_spawn_diamond()
	if _diamond != null:
		_diamond.rotate_y(delta * 2.0)
		if director.get_day() >= _diamond_gone_day:
			# Missed it: it sinks away, and another turns up later.
			_diamond.queue_free()
			_diamond = null
			_diamond_day = director.get_day() + randf_range(1.0, 2.0)

func _spawn_diamond() -> void:
	var ang: float = randf() * TAU
	var r: float = randf_range(8.0, ValleyTerrain.FLOOR_RADIUS - 8.0)
	var x: float = cos(ang) * r
	var z: float = sin(ang) * r
	var gem := MeshInstance3D.new()
	var m := CylinderMesh.new()
	m.top_radius = 0.0
	m.bottom_radius = 0.7
	m.height = 1.2
	m.radial_segments = 6
	m.rings = 1
	gem.mesh = m
	var under := MeshInstance3D.new()
	var m2 := CylinderMesh.new()
	m2.top_radius = 0.7
	m2.bottom_radius = 0.0
	m2.height = 0.6
	m2.radial_segments = 6
	m2.rings = 1
	under.mesh = m2
	under.position.y = -0.9
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.7, 0.95, 1.0)
	gem.material_override = mat
	under.material_override = mat
	_diamond = Node3D.new()
	_diamond.name = "Diamond"
	_diamond.add_child(gem)
	gem.add_child(under)
	director.add_child(_diamond)
	_diamond.global_position = Vector3(x, director.ground_height(x, z) + 1.5, z)
	_diamond_gone_day = director.get_day() + 0.75
	FXManager.show_dramatic_text(_diamond.global_position, "Something glints in the grass...", Color(0.7, 0.95, 1.0))

# Called by the HUD on a tap, before it picks a creature. True if it took it.
func try_collect(screen_pos: Vector2) -> bool:
	if _diamond == null:
		return false
	var cam := get_viewport().get_camera_3d()
	if cam == null or cam.is_position_behind(_diamond.global_position):
		return false
	var reach: float = 48.0 * get_viewport().get_visible_rect().size.y / 720.0
	if cam.unproject_position(_diamond.global_position).distance_to(screen_pos) > reach:
		return false
	_diamond_found = true
	FXManager.show_dramatic_text(_diamond.global_position, "DIAMOND!  +%d EP" % DIAMOND_EP, Color(0.7, 0.95, 1.0))
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.award_eco_points(DIAMOND_EP)
	_diamond.queue_free()
	_diamond = null
	if Cosmetics.grant(gc, "diamond"):
		FXManager.show_dramatic_text(Vector3.ZERO, "Unlocked: Diamond cursor! (Greenhouse > Looks)", Color(0.7, 0.95, 1.0))
	_complete("diamond")
	return true

func _process(delta: float) -> void:
	if get_tree().paused:
		return
	# delta already runs at the game speed (Engine.time_scale).
	_tick_creature(delta)
	_tick_diamond(delta)
	_accum += delta
	if _accum >= 0.5:
		_accum = 0.0
		_check_goals()
		_refresh_creature()
		refresh_saga()

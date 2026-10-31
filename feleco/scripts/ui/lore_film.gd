extends Node

# The short film that opens each mode, the first time it is entered: The Valley
# or Simulation, by gc.current_mode. Scripted in the valley, not the game; it
# ends on a card and the year starts only when the player asks.

const METEOR_FALL: float = 1.8
const VALLEY_LINES: Array[String] = [
	"This valley is yours to watch over.",
	"Everything here eats, hunts, breeds and dies without you.",
	"Pick a champion with your hand. Claim it, train it, take control.",
	"Pour down powers, and watch the ripples spread through the food web.",
	"Mid-season, strange Sprites wake. Claim one if you dare.",
	"Quests set goals. Golden food lets a creature Rampage: take it in hand.",
	"Lead your favourites to glory, or watch them fade.",
]
const SIM_LINES: Array[String] = [
	"Simulation is the whole toybox.",
	"Build any valley: every species, count and season length.",
	"Take the Fates' bets on who will rule the year.",
	"Face a Challenge, or play the Mini Games.",
	"Tune the rules in the Lab, and shop in the Greenhouse.",
	"Settings changes the look: Valley, Pixel or Lost Valley.",
	"Change one thing, and see what happens.",
]

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const WORLD: PackedScene = preload("res://scenes/world.tscn")

var _world: Node
var _dir: SimulationDirector
var _cam: Camera3D
var _root: Control
var _caption: Label
var _shade: ColorRect
var _skip: Button
var _done: bool = false
var _choosing: bool = false
var _anchor: Vector3 = Vector3.ZERO
var _sim: bool = false
var _prey: MarkovAgent = null
var _crew: Array[MarkovAgent] = []
var _mock_bar: HBoxContainer = null
var _hand: SpectralHand = null

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	_sim = str(gc.current_mode) == "sandbox"
	# A quiet valley, so the lesson's cast is the only thing moving.
	gc.disabled_species.clear()
	for id: String in SpeciesDB.ROWS.keys():
		gc.disabled_species.append(id)
	gc.tree_count = 8
	gc.bush_count = 4
	gc.grass_density = 0.6
	gc.spawn_roster.clear()
	gc.bets.clear()
	_world = WORLD.instantiate()
	var loading: Node = _world.get_node_or_null("CanvasLayer/LoadingScreen")
	if loading != null:
		loading.get_parent().remove_child(loading)
		loading.free()
	add_child(_world)
	_dir = _world.get_node("World") as SimulationDirector
	_cam = _world.get_node("Camera3D") as Camera3D
	var hud: Node = _world.get_node_or_null("CanvasLayer/SimulationHUD")
	if hud != null:
		hud.visible = false
		hud.process_mode = Node.PROCESS_MODE_DISABLED
	_build()
	_play.call_deferred()

func _unhandled_input(event: InputEvent) -> void:
	if _done or _choosing:
		return
	var skip: bool = event.is_action_pressed("ui_cancel") or event.is_action_pressed("ui_accept")
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		skip = true
	if event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed:
		skip = true
	if skip:
		get_viewport().set_input_as_handled()
		_show_choice()

func _build() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 40
	add_child(layer)
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_root)
	var bar := ColorRect.new()
	bar.color = Color(0, 0, 0, 0.72)
	bar.anchor_right = 1.0
	bar.anchor_top = 1.0
	bar.anchor_bottom = 1.0
	bar.offset_top = -168.0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(bar)
	_caption = FelecoUiScript.heading("", 28, FelecoUiScript.CREAM)
	_caption.set_anchors_preset(Control.PRESET_FULL_RECT)
	_caption.offset_left = 72.0
	_caption.offset_right = -72.0
	_caption.offset_bottom = -40.0
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_caption.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_caption.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	_caption.add_theme_constant_override("outline_size", 8)
	_root.add_child(_caption)
	_shade = ColorRect.new()
	_shade.color = Color(0, 0, 0, 1)
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_shade)
	_skip = Button.new()
	_skip.text = "Skip"
	_skip.anchor_left = 1.0
	_skip.anchor_right = 1.0
	_skip.offset_left = -180.0
	_skip.offset_right = -20.0
	_skip.offset_top = 16.0
	_skip.offset_bottom = 60.0
	_skip.pressed.connect(_show_choice)
	_root.add_child(_skip)
	FelecoUiScript.dress_hud(layer)
	_skip.theme_type_variation = "GhostButton"

func _play() -> void:
	if not await _frames(24):
		return
	if _dir == null or _cam == null:
		_show_choice()
		return
	# The toybox needs a wide dry stage, well away from the river.
	_anchor = _dir.dry_land(Vector3(-24.0, 0.0, 16.0) if _sim else Vector3(-4.0, 0.0, 6.0))
	_anchor.y = _dir.ground_height(_anchor.x, _anchor.z)
	_clear_stage()
	_view(_anchor, 0.35, -0.55, 58.0, true)
	var tw := create_tween()
	tw.tween_property(_shade, "color:a", 0.0, 1.2)
	if not await _wait(1.3):
		return
	var lines: Array[String] = SIM_LINES if _sim else VALLEY_LINES
	for i: int in lines.size():
		if _sim:
			_stage_sim(i)
		else:
			_stage_valley(i)
		if not await _line(lines[i]):
			return
	if not await _meteor_finale():
		return
	_show_choice()

func _clear_stage() -> void:
	_dir.tree_planting = false
	_dir.hold_daylight = true
	var stage := Rect2(_anchor.x - 18.0, _anchor.z - 8.0, 48.0, 40.0)
	var back_z: float = _anchor.z - 10.0
	for t: Node in _dir.get_node("Trees").get_children() + _dir.get_node("Bushes").get_children():
		var n := t as Node3D
		if n == null or not stage.has_point(Vector2(n.global_position.x, n.global_position.z)):
			continue
		for a: Node in n.find_children("*", "", true, false):
			if a.is_in_group("apple"):
				a.queue_free()
		n.global_position = _dir.dry_land(Vector3(randf_range(-24.0, 24.0), 0.0, randf_range(-25.0, back_z)))
		_dir._snap_to_ground(n)
	for a: Node in get_tree().get_nodes_in_group("apple"):
		var an := a as Node3D
		if an != null and stage.has_point(Vector2(an.global_position.x, an.global_position.z)):
			an.queue_free()

# Golden grass, tall and ripe, around a spot.

# Everything can change in a moment: a meteor takes nearly all of them.
func _meteor_finale() -> bool:
	_mock([])
	_caption.text = ""
	_view(_anchor, 0.35, -0.5, 22.0)
	var row: Array[String] = ["sheep", "wolf", "rabbit", "boar", "deer"]
	for k: int in row.size():
		var a := _cast(row[k], cos(k * 1.3) * 3.5, sin(k * 1.3) * 3.0)
		a.scripted = true
	if not await _wait(1.0):
		return false
	_dir.trigger_meteor(_anchor)
	if not await _wait(METEOR_FALL):
		return false
	for a: MarkovAgent in _crew:
		if is_instance_valid(a) and randf() < 0.85:
			a.golden = 0.0
			a.gold_claimed = true
			a.set("health", 0.0)
			a.call("die")
	return await _wait(3.0)

# The game's real buttons, shown as they will look, pulsing like a hint.
func _mock(labels: Array) -> void:
	if _mock_bar != null:
		_mock_bar.queue_free()
		_mock_bar = null
	if labels.is_empty():
		return
	_mock_bar = HBoxContainer.new()
	_mock_bar.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_mock_bar.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_mock_bar.offset_top = -170.0
	_mock_bar.offset_bottom = -116.0
	_mock_bar.alignment = BoxContainer.ALIGNMENT_CENTER
	_mock_bar.add_theme_constant_override("separation", 10)
	_mock_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_mock_bar)
	for text: Variant in labels:
		var b := Button.new()
		b.text = str(text)
		b.theme_type_variation = "PrimaryButton"
		b.custom_minimum_size = Vector2(130, 50)
		b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_mock_bar.add_child(b)
	var tw := _mock_bar.create_tween().set_loops(4)
	tw.tween_property(_mock_bar, "modulate", Color(1.3, 1.3, 1.1), 0.4)
	tw.tween_property(_mock_bar, "modulate", Color.WHITE, 0.4)

func _at(x: float, z: float) -> Vector3:
	return _dir.dry_land(_anchor + Vector3(x, 0.0, z))

func _cast(id: String, x: float, z: float) -> MarkovAgent:
	var a := _dir.spawn_scripted(id, _at(x, z))
	_crew.append(a)
	return a

func _close(z: float = 16.0) -> void:
	_view(_anchor, 0.35, -0.5, z)

# Each line gets the shot it describes.
func _stage_valley(i: int) -> void:
	_mock([[], [], ["Claim", "Brand", "Train", "Follow", "Drop"], ["Rain", "Drought", "Flood", "Meteor"], ["Make Mine", "Take Control", "WASD: steer", "Space: power"], ["Quests", "Rampage"], ["Vault", "Food Web"]][i])
	match i:
		0:
			pass  # the whole valley, from above
		1:
			_close()
			_prey = _cast("sheep", -9.0, 1.0)
			var wolf := _cast("wolf", -17.0, 2.0)
			_walk(_prey, _at(-5.0, 1.0), 2.6)
			_walk(wolf, _at(-8.0, 1.0), 2.6)
		2:
			if is_instance_valid(_prey):
				_close(12.0)
				_hand = SpectralHand.new()
				_world.add_child(_hand)
				_hand.lift(_prey, func() -> void: pass)
		3:
			if is_instance_valid(_hand):
				_hand.put_down(func() -> void: pass)
			_view(_anchor, 0.35, -0.55, 26.0)
			_dir.trigger_rain()
			_dir.trigger_flood()
		4:
			_close()
			for k: int in 3:
				var fairy := _cast("fairy", -3.0 + k * 3.0, 3.0)
				_walk(fairy, _at(-2.0 + k * 3.0, 0.5), 3.0)
		6:
			pass
		5:
			if is_instance_valid(_prey):
				_prey.make_golden(1.0, "grass")
				if _prey._data != null:
					_prey._data.golden = 1.0
				_close(10.0)

func _stage_sim(i: int) -> void:
	_mock([[], ["Sheep 10", "Wolves 8", "Bears 3", "Trees 6", "12 days"], ["Accept Quest"], ["Challenge", "Mini Games"], ["Tuning Lab", "Greenhouse"], ["Valley", "Pixel", "Lost Valley"], ["Rain", "Drought", "Meteor"]][i])
	match i:
		1:
			_close(22.0)
			var row: Array[String] = ["sheep", "wolf", "bear", "deer", "boar", "rabbit"]
			for k: int in row.size():
				_cast(row[k], -10.0 + k * 4.0, 1.0)
		2:
			_card()
		3:
			var sample: Node = _root.get_node_or_null("QuestSample")
			if sample != null:
				sample.queue_free()
			_close(12.0)
			for n: Node in _dir.get_node("Agents").get_children():
				n.queue_free()
			_cast("wolf", -2.5, 2.0)
			_cast("lion", 2.5, 2.0)
		4:
			_view(_anchor, 0.35, -0.6, 40.0)
			_dir.trigger_bloom()
		6:
			_dir.trigger_drought()

func _card() -> void:
	var card := PanelContainer.new()
	card.name = "QuestSample"
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.11, 0.08, 0.94)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(16)
	card.add_theme_stylebox_override("panel", sb)
	card.custom_minimum_size = Vector2(360, 0)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	card.add_child(col)
	col.add_child(FelecoUiScript.heading("A quest", 22, FelecoUiScript.GOLD))
	for line: String in ["Champion: the flock", "Species: sheep", "Goal: the flocks are the largest crowd", "Time: one season", "Reward: a new cursor"]:
		var l := FelecoUiScript.label(line, 16, FelecoUiScript.CREAM)
		col.add_child(l)
	card.set_anchors_preset(Control.PRESET_CENTER_TOP)
	card.offset_top = 88.0
	card.offset_bottom = 280.0
	card.offset_left = -180.0
	card.offset_right = 180.0
	card.modulate.a = 0.0
	card.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(card)
	create_tween().tween_property(card, "modulate:a", 1.0, 0.35)

func _show_choice() -> void:
	if _choosing or _done or not is_inside_tree():
		return
	_choosing = true
	_caption.text = ""
	_caption.modulate.a = 1.0
	if _skip != null:
		_skip.hide()
	var sample: Node = _root.get_node_or_null("QuestSample")
	if sample != null:
		sample.queue_free()
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(center)
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(460, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.96)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(22)
	card.add_theme_stylebox_override("panel", sb)
	center.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	card.add_child(col)
	var words := FelecoUiScript.label("Open the toybox." if _sim else "Begin the year when you are ready to claim a champion.", 18, FelecoUiScript.CREAM)
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	words.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	words.custom_minimum_size = Vector2(420, 0)
	col.add_child(words)
	var begin := Button.new()
	begin.text = "Open Simulation" if _sim else "Begin the year"
	begin.theme_type_variation = "PrimaryButton"
	begin.custom_minimum_size = Vector2(0, 52)
	begin.pressed.connect(func() -> void: _leave(true))
	col.add_child(begin)
	var back := Button.new()
	back.text = "Back to the menu"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(0, 48)
	back.pressed.connect(func() -> void: _leave(false))
	col.add_child(back)

func _leave(to_valley: bool) -> void:
	if _done or not is_inside_tree():
		return
	_done = true
	var gc: Node = get_node("/root/GameConfig")
	if _sim:
		gc.set_record("lesson", "sim_film", true)
	else:
		gc.lore_seen = true
	gc.save_meta()
	# The film emptied the valley for its cast. The real year starts full.
	var days: float = gc.time_limit
	var setting: String = gc.time_setting
	gc.reset_run_state()
	gc.disabled_species.clear()
	gc.time_limit = days
	gc.time_setting = setting
	var path := "res://scenes/ui/main_menu.tscn"
	if to_valley and _sim:
		gc.current_mode = "sandbox"
		gc.main_claim = false
		gc.board_mode = "full"
		gc.bets.clear()
		path = "res://scenes/ui/setup_board.tscn"
	elif to_valley:
		gc.current_mode = "main"
		gc.main_claim = gc.record("lesson", "champion") == null
		gc.bets.clear()
		path = "res://scenes/world.tscn"
	_silence(_world)
	get_tree().change_scene_to_file.call_deferred(path)

func _silence(n: Node) -> void:
	if n == null or not is_instance_valid(n):
		return
	n.process_mode = Node.PROCESS_MODE_DISABLED
	n.set_process(false)
	n.set_physics_process(false)
	for c: Node in n.get_children():
		_silence(c)

func _line(text: String) -> bool:
	if _done or _choosing or not is_inside_tree():
		return false
	_caption.text = text
	return await _wait(maxf(2.2, float(text.split(" ", false).size()) * 0.36 + 1.0))

func _wait(secs: float) -> bool:
	if _done or _choosing or not is_inside_tree():
		return false
	await get_tree().create_timer(secs).timeout
	return is_inside_tree() and not _done and not _choosing

func _frames(n: int) -> bool:
	for _i: int in n:
		if _done or not is_inside_tree():
			return false
		await get_tree().process_frame
	return true

func _walk(a: MarkovAgent, to: Vector3, secs: float) -> bool:
	if a == null or not is_instance_valid(a):
		return await _wait(secs)
	var from: Vector3 = a.global_position
	to.y = _dir.ground_height(to.x, to.z)
	var t: float = 0.0
	while t < secs:
		if _done or _choosing or not is_inside_tree() or not is_instance_valid(a):
			return false
		t += get_process_delta_time()
		var p: Vector3 = from.lerp(to, smoothstep(0.0, 1.0, t / secs))
		p.y = _dir.ground_height(p.x, p.z)
		a.stage_to(p, "Walk")
		await get_tree().process_frame
	return is_inside_tree() and not _done and not _choosing

func _view(at: Vector3, yaw: float, pitch: float, dist: float, instant: bool = false) -> void:
	if _cam == null:
		return
	if _cam.has_method("follow"):
		_cam.follow(null)
	if _cam.has_method("set_view"):
		_cam.set_view(Vector3(at.x, 0.0, at.z), yaw, pitch, dist, instant)

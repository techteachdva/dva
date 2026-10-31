extends Node

# The short film that opens each mode, the first time it is entered: The Valley
# or Simulation, by gc.current_mode. Scripted in the valley, not the game; it
# ends on a card and the year starts only when the player asks.

const VALLEY_LINES: Array[String] = [
	"This valley is yours to watch over.",
	"Everything here eats, hunts, breeds and dies without you.",
	"Pick a champion with your hand. Claim it, train it, take control.",
	"Pour down powers, and watch the ripples spread through the food web.",
	"Mid-season, strange Sprites wake. Claim one if you dare.",
	"Lead your favourites to glory, or watch them fade.",
]
const SIM_LINES: Array[String] = [
	"Simulation is the whole toybox.",
	"Build any valley: every species, count and season length.",
	"Take the Fates' bets on who will rule the year.",
	"Face a Challenge, or play the Mini Games.",
	"Tune the rules in the Lab, and shop in the Greenhouse.",
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
	_anchor = _dir.dry_land(Vector3(-4.0, 0.0, 6.0))
	_anchor.y = _dir.ground_height(_anchor.x, _anchor.z)
	_view(_anchor, 0.35, -0.55, 58.0, true)
	var tw := create_tween()
	tw.tween_property(_shade, "color:a", 0.0, 1.2)
	if not await _wait(1.3):
		return
	var sheep := _dir.spawn_scripted("sheep", _dir.dry_land(_anchor + Vector3(-3.0, 0.0, 1.0)))
	_view(_anchor, 0.35, -0.5, 16.0)
	for text: String in (SIM_LINES if _sim else VALLEY_LINES):
		if not await _line(text):
			return
		if is_instance_valid(sheep):
			sheep.stage_to(_dir.dry_land(_anchor + Vector3(randf_range(-3.0, 3.0), 0.0, randf_range(-1.0, 2.0))), "Walk")
	_show_choice()

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

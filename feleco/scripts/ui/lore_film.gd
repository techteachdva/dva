extends Node

# The film that opens Main Game. It is not the simulation, and it does not
# mention bets. When it ends, the valley is waiting and the player must
# claim a champion.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const WORLD: PackedScene = preload("res://scenes/world.tscn")
const LINES: Array[String] = [
	"You are Feleco, the Spirit of this Valley.",
	"It is your job to maintain balance here.",
	"It is the beginning of yet another new year.",
	"At the beginning of each season, you will face a choice.",
	"For now, choose a Champion.",
]

var _cam: Camera3D
var _caption: Label
var _done: bool = false

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.current_mode = "main"
	var world := WORLD.instantiate()
	var loading: Node = world.get_node_or_null("CanvasLayer/LoadingScreen")
	if loading != null:
		loading.get_parent().remove_child(loading)
		loading.free()
	add_child(world)
	_cam = world.get_node("Camera3D") as Camera3D
	var hud: Node = world.get_node_or_null("CanvasLayer/SimulationHUD")
	if hud != null:
		hud.visible = false
		hud.process_mode = Node.PROCESS_MODE_DISABLED
	_build()
	_play.call_deferred()

func _unhandled_input(event: InputEvent) -> void:
	if _done:
		return
	var skip: bool = event.is_action_pressed("ui_cancel") or event.is_action_pressed("ui_accept")
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		skip = true
	if skip:
		get_viewport().set_input_as_handled()
		_finish()

func _build() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 40
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	var bar := ColorRect.new()
	bar.color = Color(0, 0, 0, 0.72)
	bar.anchor_right = 1.0
	bar.anchor_top = 1.0
	bar.anchor_bottom = 1.0
	bar.offset_top = -150.0
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bar)
	_caption = FelecoUiScript.heading("", 32, FelecoUiScript.CREAM)
	_caption.set_anchors_preset(Control.PRESET_FULL_RECT)
	_caption.offset_left = 80.0
	_caption.offset_right = -80.0
	_caption.offset_bottom = -36.0
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_caption.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	root.add_child(_caption)
	var skip := Button.new()
	skip.text = "Skip"
	skip.anchor_left = 1.0
	skip.anchor_right = 1.0
	skip.offset_left = -180.0
	skip.offset_right = -20.0
	skip.offset_top = 16.0
	skip.offset_bottom = 60.0
	skip.pressed.connect(_finish)
	root.add_child(skip)
	FelecoUiScript.dress_hud(layer)
	skip.theme_type_variation = "GhostButton"

func _play() -> void:
	for i: int in 20:
		await get_tree().process_frame
	if _cam != null and _cam.has_method("set_view"):
		_cam.set_view(Vector3(0, 0, 4), 0.4, deg_to_rad(-36.0), 48.0, true)
	for line: String in LINES:
		if _done:
			return
		_caption.text = line
		await get_tree().create_timer(3.4).timeout
	_finish()

func _finish() -> void:
	if _done:
		return
	_done = true
	var gc: Node = get_node("/root/GameConfig")
	gc.lore_seen = true
	gc.main_claim = gc.record("lesson", "champion") == null
	gc.current_mode = "main"
	gc.bets.clear()
	gc.save_meta()
	get_tree().change_scene_to_file("res://scenes/world.tscn")

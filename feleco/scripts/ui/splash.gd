extends Control

# The FelEco splash, after Godot's logo: the title, while the menu loads in
# the background, and PLAY waits for the player.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const MENU: String = "res://scenes/ui/main_menu.tscn"
const MIN_TIME: float = 12.0

var _t: float = 0.0
var _logo: BootLogo
var _vine: VinePlay

func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Color(0.071, 0.098, 0.082)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	_logo = BootLogo.new()
	_logo.set_anchors_preset(Control.PRESET_CENTER)
	_logo.offset_left = -240.0
	_logo.offset_right = 240.0
	_logo.offset_top = -280.0
	_logo.offset_bottom = 200.0
	add_child(_logo)
	_vine = VinePlay.new()
	_vine.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_vine.offset_left = -220.0
	_vine.offset_right = 220.0
	_vine.offset_top = -130.0
	_vine.offset_bottom = -56.0
	_vine.play.connect(_enter)
	add_child(_vine)
	var credit := HBoxContainer.new()
	credit.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	credit.grow_horizontal = Control.GROW_DIRECTION_BOTH
	credit.offset_top = -44.0
	credit.offset_bottom = -12.0
	credit.add_theme_constant_override("separation", 8)
	var mark := TextureRect.new()
	mark.texture = load("res://assets/ui/godot_logo.png")
	mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	mark.custom_minimum_size = Vector2(28, 30)
	credit.add_child(mark)
	credit.add_child(FelecoUiScript.label("Godot Game Engine", 15, Color(0.79, 0.78, 0.7)))
	add_child(credit)
	ResourceLoader.load_threaded_request(MENU)

func _process(delta: float) -> void:
	_t += delta
	var got: Array = []
	var status := ResourceLoader.load_threaded_get_status(MENU, got)
	var loaded: float = 1.0 if status == ResourceLoader.THREAD_LOAD_LOADED or status == ResourceLoader.THREAD_LOAD_FAILED else float(got[0]) if not got.is_empty() else 0.0
	var shown: float = minf(loaded, _t / MIN_TIME)
	_logo.progress = shown
	_vine.progress = shown

# Nothing moves on until the player says so.
func _enter() -> void:
	set_process(false)
	var scene: PackedScene = ResourceLoader.load_threaded_get(MENU) as PackedScene
	if scene != null:
		get_tree().change_scene_to_packed(scene)
	else:
		get_tree().change_scene_to_file(MENU)

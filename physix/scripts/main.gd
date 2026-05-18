class_name Main
extends Node

static var instance: Main = null

# Main — persistent root scene for the entire game.
# Levels are loaded as children under $World instead of replacing the
# whole scene tree, keeping AudioManager and other state alive.

@onready var world: Node3D = $World
@onready var gui: CanvasLayer = $GUI
@onready var fps_label: Label = $GUI/FPSCounter

var _current_level: Node = null

func _ready() -> void:
	instance = self
	_apply_boot_settings()
	# Start at the main menu
	_load_main_menu()

func _process(_delta: float) -> void:
	if fps_label.visible:
		fps_label.text = "%d FPS" % Engine.get_frames_per_second()

func _apply_boot_settings() -> void:
	if get_node_or_null("/root/LevelManager") == null:
		return
	# Fullscreen
	var fullscreen: bool = LevelManager.get_setting("fullscreen", false)
	if fullscreen:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
	# FPS counter
	var show_fps: bool = LevelManager.get_setting("show_fps", false)
	if fps_label != null:
		fps_label.visible = show_fps

func load_level(world_num: int, level_num: int) -> void:
	_unload_current()
	var path: String = LevelManager.get_level_scene_path(world_num, level_num)
	var packed: PackedScene = load(path)
	if packed == null:
		push_error("Main: failed to load level scene: %s" % path)
		return
	_current_level = packed.instantiate()
	_mount_scene(_current_level)
	GameManager.current_world = world_num
	GameManager.current_level = level_num

func load_bonus_level(world_num: int) -> void:
	_unload_current()
	var path: String = LevelManager.get_bonus_scene_path(world_num)
	var packed: PackedScene = load(path)
	if packed == null:
		push_error("Main: failed to load bonus scene: %s" % path)
		return
	_current_level = packed.instantiate()
	_mount_scene(_current_level)
	GameManager.current_world = world_num
	GameManager.current_level = 0

func load_secret_level(world_num: int, level_num: int) -> void:
	_unload_current()
	var path: String = LevelManager.get_secret_scene_path(world_num, level_num)
	var packed: PackedScene = load(path)
	if packed == null:
		push_error("Main: failed to load secret scene: %s" % path)
		return
	_current_level = packed.instantiate()
	_mount_scene(_current_level)
	GameManager.current_world = world_num
	GameManager.current_level = level_num

func load_world_map() -> void:
	_unload_current()
	var packed: PackedScene = load("res://scenes/world_map.tscn")
	_current_level = packed.instantiate()
	_mount_scene(_current_level)

func load_main_menu() -> void:
	_load_main_menu()

func load_level_editor() -> void:
	_unload_current()
	var packed: PackedScene = load("res://scenes/level_editor.tscn")
	_current_level = packed.instantiate()
	_mount_scene(_current_level)

func load_editor_test_runner() -> void:
	_unload_current()
	var packed: PackedScene = load("res://scenes/editor_test_runner.tscn")
	_current_level = packed.instantiate()
	_mount_scene(_current_level)

func load_custom_level_loader() -> void:
	_unload_current()
	var packed: PackedScene = load("res://scenes/custom_level_loader.tscn")
	_current_level = packed.instantiate()
	_mount_scene(_current_level)

func _load_main_menu() -> void:
	_unload_current()
	var packed: PackedScene = load("res://scenes/main_menu.tscn")
	_current_level = packed.instantiate()
	_mount_scene(_current_level)

func _mount_scene(scene: Node) -> void:
	if scene is Control or scene is Node2D:
		gui.add_child(scene)
	else:
		world.add_child(scene)

func _unload_current() -> void:
	if _current_level != null and is_instance_valid(_current_level):
		_current_level.queue_free()
		_current_level = null
	for child: Node in world.get_children():
		child.queue_free()
	for child: Node in gui.get_children():
		if child == fps_label:
			continue
		child.queue_free()

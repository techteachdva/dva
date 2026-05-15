extends Node

# Test runner — loads a level scene and attaches the BotPlayer.
# Usage:
#   godot --scene res://tools/test_runner.tscn -- --level=res://scenes/levels/world_1/level_1_1.tscn --duration=30 --bot-log=/tmp/test.log

@export var default_level: String = "res://scenes/levels/world_1/level_1_1.tscn"
@export var default_duration: float = 60.0

var _level_path: String
var _duration: float

func _ready() -> void:
	_level_path = default_level
	_duration = default_duration

	for arg in OS.get_cmdline_args():
		if arg.begins_with("--level="):
			_level_path = arg.substr(8)
		elif arg.begins_with("--duration="):
			_duration = float(arg.substr(11))

	print("[TestRunner] Loading level: %s (duration %.1fs)" % [_level_path, _duration])

	var packed := load(_level_path) as PackedScene
	if packed == null:
		push_error("TestRunner: Failed to load level: %s" % _level_path)
		get_tree().quit(1)
		return

	var level := packed.instantiate()
	add_child(level)

	var bot := preload("res://tools/bot_player.gd").new()
	bot.duration = _duration
	bot.name = "BotPlayer"
	level.add_child(bot)

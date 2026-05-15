extends Node

# HitStop — momentary time freeze on heavy impacts for weight and crunch
# Usage: HitStop.freeze(0.05)  # 50ms freeze

var _frozen: bool = false
var _freeze_timer: float = 0.0

func _ready() -> void:
	set_process(true)

func _process(delta: float) -> void:
	if not _frozen:
		return
	_freeze_timer -= delta
	if _freeze_timer <= 0.0:
		_unfreeze()

func freeze(duration: float, strength: float = 0.15) -> void:
	if duration <= 0.0:
		return
	# If already frozen, extend if the new freeze is longer
	if _frozen:
		if duration > _freeze_timer:
			_freeze_timer = duration
		return
	_frozen = true
	_freeze_timer = duration
	Engine.time_scale = strength
	# Input and ghost recording still happen at real-time via _process delta

func _unfreeze() -> void:
	_frozen = false
	Engine.time_scale = 1.0

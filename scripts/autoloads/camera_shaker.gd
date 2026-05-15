extends Node

# CameraShake — screenshake that exposes a public offset for compositing
# Usage: CameraShaker.shake(0.15, 0.3)
# Then in camera follow code: pos += CameraShaker.shake_offset

var shake_offset: Vector3 = Vector3.ZERO

var _timer: float = 0.0
var _intensity: float = 0.0

func _ready() -> void:
	set_process(true)

func _process(delta: float) -> void:
	_timer -= delta
	if _timer <= 0.0:
		shake_offset = Vector3.ZERO
		return

	var t := Time.get_ticks_msec() * 0.001
	var remaining := _timer / (_timer + delta + 0.001)
	var current_intensity := _intensity * maxf(remaining, 0.0)
	shake_offset = Vector3(
		sin(t * 47.0) * current_intensity,
		sin(t * 33.0) * current_intensity * 0.6,
		sin(t * 61.0) * current_intensity * 0.3
	)

func shake(duration: float, intensity: float) -> void:
	if get_node_or_null("/root/LevelManager") != null and LevelManager.get_setting("reduce_motion", false):
		return
	_timer = duration
	_intensity = intensity

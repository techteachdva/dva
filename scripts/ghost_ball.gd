extends MeshInstance3D

# Ghost Ball — replays a saved ghost run.
# Spawned by GameLevel when ghost data exists for the current level.

var _samples: Array[Dictionary] = []
var _playback_time: float = 0.0
var _playing: bool = false
var _idx: int = 0

func start_ghost(samples: Array[Dictionary]) -> void:
	if samples.is_empty():
		queue_free()
		return
	_samples = samples
	_playback_time = 0.0
	_playing = true
	_idx = 0
	_update_position(0.0)

func stop_ghost() -> void:
	_playing = false

func update_time(elapsed: float) -> void:
	if not _playing or _samples.is_empty():
		return
	_playback_time = elapsed
	if _playback_time > _samples[-1].get("t", 0.0) + 2.0:
		# Ghost finished; stop updating
		_playing = false
		return
	_update_position(_playback_time)

func _update_position(t: float) -> void:
	if _samples.is_empty():
		return
	# Find the two samples to interpolate between
	while _idx > 0 and t < _samples[_idx].get("t", 0.0):
		_idx -= 1
	while _idx < _samples.size() - 1 and t >= _samples[_idx + 1].get("t", 0.0):
		_idx += 1
	if _idx >= _samples.size() - 1:
		# Past end — snap to last sample
		var last: Dictionary = _samples[-1]
		position = Vector3(last.get("px", 0.0), last.get("py", 0.0), last.get("pz", 0.0))
		quaternion = Quaternion(last.get("rx", 0.0), last.get("ry", 0.0), last.get("rz", 0.0), last.get("rw", 1.0)).normalized()
		return
	var a: Dictionary = _samples[_idx]
	var b: Dictionary = _samples[_idx + 1]
	var ta: float = a.get("t", 0.0)
	var tb: float = b.get("t", 0.0)
	var frac: float = 0.0 if tb <= ta else clampf((t - ta) / (tb - ta), 0.0, 1.0)
	var pos_a := Vector3(a.get("px", 0.0), a.get("py", 0.0), a.get("pz", 0.0))
	var pos_b := Vector3(b.get("px", 0.0), b.get("py", 0.0), b.get("pz", 0.0))
	position = pos_a.lerp(pos_b, frac)
	var rot_a := Quaternion(a.get("rx", 0.0), a.get("ry", 0.0), a.get("rz", 0.0), a.get("rw", 1.0))
	var rot_b := Quaternion(b.get("rx", 0.0), b.get("ry", 0.0), b.get("rz", 0.0), b.get("rw", 1.0))
	quaternion = rot_a.normalized().slerp(rot_b.normalized(), frac)

extends Node

# Ghost Manager — records, saves, and loads player ghost replays.
# Add to Autoloads as "GhostManager".

const GHOST_DIR := "user://ghosts/"
const SAMPLE_INTERVAL := 0.1  # 10 Hz
const MAX_SAMPLES := 1200      # ~120 seconds of data

var _recording: bool = false
var _samples: Array[Dictionary] = []
var _record_timer: float = 0.0
var _elapsed: float = 0.0

func _ensure_dir() -> void:
	if not DirAccess.dir_exists_absolute(GHOST_DIR):
		DirAccess.make_dir_recursive_absolute(GHOST_DIR)

func _ghost_path(world: int, level: int) -> String:
	return GHOST_DIR + "w%d_l%d.json" % [world, level]

func has_ghost(world: int, level: int) -> bool:
	return FileAccess.file_exists(_ghost_path(world, level))

func load_ghost(world: int, level: int) -> Dictionary:
	var path := _ghost_path(world, level)
	if not FileAccess.file_exists(path):
		return {}
	var file := FileAccess.open(path, FileAccess.READ)
	if not file:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	if parsed is Dictionary:
		return parsed
	return {}

func start_recording() -> void:
	_recording = true
	_samples = []
	_record_timer = 0.0
	_elapsed = 0.0

func record_sample(pos: Vector3, rot: Quaternion, vel: Vector3, steer: float, jump: bool, brake: bool, dead: bool, delta: float) -> void:
	if not _recording:
		return
	_elapsed += delta
	_record_timer += delta
	if _record_timer < SAMPLE_INTERVAL:
		return
	_record_timer -= SAMPLE_INTERVAL
	if _samples.size() >= MAX_SAMPLES:
		return
	_samples.append({
		"t": snappedf(_elapsed, 0.01),
		"px": snappedf(pos.x, 0.01),
		"py": snappedf(pos.y, 0.01),
		"pz": snappedf(pos.z, 0.01),
		"rx": snappedf(rot.x, 0.001),
		"ry": snappedf(rot.y, 0.001),
		"rz": snappedf(rot.z, 0.001),
		"rw": snappedf(rot.w, 0.001),
		"vx": snappedf(vel.x, 0.01),
		"vy": snappedf(vel.y, 0.01),
		"vz": snappedf(vel.z, 0.01),
		"steer": snappedf(steer, 0.01),
		"jump": jump,
		"brake": brake,
		"dead": dead,
	})

func stop_recording() -> void:
	_recording = false

func save_ghost(world: int, level: int, finish_time: float) -> bool:
	var existing := load_ghost(world, level)
	var best_time: float = existing.get("best_time", INF)
	if finish_time >= best_time:
		return false
	_ensure_dir()
	var data := {
		"version": 1,
		"best_time": snappedf(finish_time, 0.01),
		"samples": _samples,
	}
	var file := FileAccess.open(_ghost_path(world, level), FileAccess.WRITE)
	if not file:
		return false
	file.store_string(JSON.stringify(data))
	return true

func get_best_time(world: int, level: int) -> float:
	var g := load_ghost(world, level)
	return g.get("best_time", INF)

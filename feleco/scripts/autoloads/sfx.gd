extends Node

# The valley's sound. One-shots for the big events, loops that follow the
# weather and time of day, and small creature calls that fade with the
# camera's distance. Sounds: BigSoundBank (CC0); howl and whistle synthesised.

const DIR: String = "res://assets/sfx/"
const LOOPS: Array[String] = ["wind", "crickets", "rain", "flood", "heat", "frogs"]
const HEARING: float = 42.0
# Up here the valley goes quiet: full fade between these camera heights.
const QUIET_FROM: float = 14.0
const QUIET_TO: float = 60.0
const HEIGHT_FADE_DB: float = 34.0
const QUIET_DB: float = -50.0

var _loops: Dictionary = {}
var _cache: Dictionary = {}
var _clock: float = 0.0
var _call_clock: float = 4.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for id: String in LOOPS:
		var p := AudioStreamPlayer.new()
		var s: AudioStreamOggVorbis = _stream(id) as AudioStreamOggVorbis
		if s == null:
			continue
		s.loop = true
		p.stream = s
		p.volume_db = QUIET_DB
		add_child(p)
		_loops[id] = p

func _stream(id: String) -> AudioStream:
	if not _cache.has(id):
		var path: String = DIR + id + ".ogg"
		_cache[id] = load(path) if ResourceLoader.exists(path) else null
	return _cache[id]

func _muted() -> bool:
	var m: Node = get_node_or_null("/root/Music")
	return m != null and bool(m.get("muted"))

func play(id: String, volume_db: float = -6.0, pitch: float = 1.0) -> void:
	var s: AudioStream = _stream(id)
	if s == null or _muted():
		return
	var p := AudioStreamPlayer.new()
	p.stream = s
	p.volume_db = volume_db
	p.pitch_scale = pitch
	add_child(p)
	p.finished.connect(p.queue_free)
	p.play()

# Quieter the farther the camera is; silent beyond HEARING.
func play_at(id: String, at: Vector3, volume_db: float = -8.0) -> void:
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	var d: float = cam.global_position.distance_to(at)
	if d < HEARING:
		play(id, volume_db - 26.0 * d / HEARING, randf_range(0.92, 1.08))

func _height_fade(height: float) -> float:
	return HEIGHT_FADE_DB * clampf((height - QUIET_FROM) / (QUIET_TO - QUIET_FROM), 0.0, 1.0)

func _process(delta: float) -> void:
	_clock -= delta
	if _clock > 0.0:
		return
	_clock = 0.3
	var scene: Node = get_tree().current_scene
	var sim: SimulationDirector = scene.get_node_or_null("World") as SimulationDirector if scene != null else null
	var want: Dictionary = {}
	if sim != null and not _muted() and not get_tree().paused:
		var cam: Camera3D = get_viewport().get_camera_3d()
		var r: float = 0.0
		var height: float = 30.0
		if cam != null:
			r = Vector2(cam.global_position.x, cam.global_position.z).length()
			height = cam.global_position.y
		var night: float = 1.0 - clampf(sim.daylight, 0.0, 1.0)
		want["wind"] = -30.0 + 18.0 * clampf(r / 90.0, 0.0, 1.0)
		want["crickets"] = -40.0 + 26.0 * night
		want["frogs"] = -44.0 + 22.0 * night
		want["rain"] = -12.0 if sim.is_raining() else QUIET_DB
		want["heat"] = -18.0 if sim.is_drought() else QUIET_DB
		want["flood"] = -12.0 if sim.flood_level() > 0.2 else QUIET_DB
		var fade: float = _height_fade(height)
		for id: String in want:
			if float(want[id]) > QUIET_DB:
				want[id] = float(want[id]) - fade
		_creature_calls(sim, night, delta)
	for id: String in _loops:
		var p: AudioStreamPlayer = _loops[id]
		var goal: float = float(want.get(id, QUIET_DB))
		p.volume_db = move_toward(p.volume_db, goal, 6.0)
		if goal > QUIET_DB and not p.playing:
			p.play()
		elif p.playing and p.volume_db <= QUIET_DB:
			p.stop()

# Now and then something near the camera calls out.
func _creature_calls(_sim: SimulationDirector, night: float, _delta: float) -> void:
	_call_clock -= 0.3
	if _call_clock > 0.0:
		return
	_call_clock = randf_range(4.0, 11.0)
	var pick: Array = [["sheep", "sheep"], ["falcon", "crow"]]
	if night > 0.5:
		pick = [["wolf", "howl"], ["falcon", "owl"]]
	var row: Array = pick.pick_random()
	var who: Array = get_tree().get_nodes_in_group(row[0])
	if not who.is_empty():
		play_at(row[1], (who.pick_random() as Node3D).global_position)

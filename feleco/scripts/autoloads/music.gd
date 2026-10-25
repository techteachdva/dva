extends Node

# One soundtrack, three tempos of the same waltz: Allegro for the menus,
# Vivace while the valley runs, Presto when a round is decided.
# Crossfades between them; M toggles mute (remembered).
# Music: "Ancient Mystery Waltz" by Kevin MacLeod (incompetech.com),
# licensed under Creative Commons: By Attribution 4.0.

const TRACKS: Dictionary = {
	"menu": "res://assets/music/Ancient Mystery Waltz Allegro.mp3",
	"valley": "res://assets/music/Ancient Mystery Waltz Vivace.mp3",
	"finale": "res://assets/music/Ancient Mystery Waltz Presto.mp3",
}
const VOLUME_DB: float = -6.0
const SILENT_DB: float = -40.0
const FADE: float = 1.4
const SETTINGS_PATH: String = "user://settings.cfg"

var muted: bool = false
var _players: Array[AudioStreamPlayer] = []
var _active: int = 0
var _current: String = ""
var _last_scene: Node = null
var _scene_check: float = 0.0
var _tween: Tween

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i: int in 2:
		var p := AudioStreamPlayer.new()
		p.volume_db = SILENT_DB
		p.process_mode = Node.PROCESS_MODE_ALWAYS
		add_child(p)
		_players.append(p)
	var cfg := ConfigFile.new()
	if cfg.load(SETTINGS_PATH) == OK:
		muted = bool(cfg.get_value("audio", "muted", false))

# Picks the menu or valley track whenever the scene changes.
func _process(delta: float) -> void:
	_scene_check -= delta
	if _scene_check > 0.0:
		return
	_scene_check = 0.25
	var scene := get_tree().current_scene
	if scene == null or scene == _last_scene:
		return
	_last_scene = scene
	play("valley" if scene.get_node_or_null("World") is SimulationDirector else "menu")

func play(track: String) -> void:
	if track == _current or not TRACKS.has(track):
		return
	_current = track
	var stream := load(TRACKS[track]) as AudioStream
	if stream is AudioStreamMP3:
		(stream as AudioStreamMP3).loop = true
	var old: AudioStreamPlayer = _players[_active]
	_active = 1 - _active
	var nxt: AudioStreamPlayer = _players[_active]
	nxt.stream = stream
	nxt.volume_db = SILENT_DB
	nxt.play()
	if _tween != null and _tween.is_valid():
		_tween.kill()
	_tween = create_tween().set_parallel(true)
	_tween.tween_property(nxt, "volume_db", _target_db(), FADE)
	if old.playing:
		_tween.tween_property(old, "volume_db", SILENT_DB, FADE)
		_tween.chain().tween_callback(old.stop)

func _target_db() -> float:
	return SILENT_DB if muted else VOLUME_DB

func set_muted(on: bool) -> void:
	muted = on
	_players[_active].volume_db = _target_db()
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS_PATH)
	cfg.set_value("audio", "muted", muted)
	cfg.save(SETTINGS_PATH)

func _unhandled_key_input(event: InputEvent) -> void:
	var key := event as InputEventKey
	if key != null and key.pressed and not key.echo and key.keycode == KEY_M:
		set_muted(not muted)
		get_viewport().set_input_as_handled()

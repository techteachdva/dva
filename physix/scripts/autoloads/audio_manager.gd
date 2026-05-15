extends Node

# ── Bus names ─────────────────────────────────────────────────────────────────
const BUS_MUSIC := "Music"
const BUS_SFX   := "SFX"

# ── Asset paths — drop your files here ───────────────────────────────────────
const MUSIC_PATHS: Dictionary = {
	"menu":    "res://assets/sounds/music/main_theme.mp3",
	"world_1": "res://assets/sounds/music/world1_theme.mp3",
	"world_2": "res://assets/sounds/music/world2_theme.mp3",
	"world_3": "res://assets/sounds/music/world3_theme.mp3",
	"world_4": "res://assets/sounds/music/world4_theme.mp3",
	"world_5": "res://assets/sounds/music/world5_theme.mp3",
	"world_6": "res://assets/sounds/music/world6_theme.mp3",
	"chill":   "res://assets/sounds/music/chill.mp3",
	"action":  "res://assets/sounds/music/action.mp3",
	"retro":   "res://assets/sounds/music/retro.mp3",
}
const SFX_PATHS: Dictionary = {
	"jump":       "res://assets/sounds/sfx/jump.mp3",
	"land":       "res://assets/sounds/sfx/land.mp3",
	"coin":       "res://assets/sounds/sfx/coin.mp3",
	"boost":      "res://assets/sounds/sfx/boost.mp3",
	"bump":       "res://assets/sounds/sfx/bump.wav",
	"brake":      "res://assets/sounds/sfx/brake.wav",
	"checkpoint": "res://assets/sounds/sfx/checkpoint.mp3",
	"complete":   "res://assets/sounds/sfx/complete.mp3",
	"unlock":     "res://assets/sounds/sfx/unlock.wav",
	"death":      "res://assets/sounds/sfx/death.mp3",
	"wind":       "res://assets/sounds/sfx/wind.wav",
	"bought":     "res://assets/sounds/sfx/bought.mp3",
	"menu_select":"res://assets/sounds/sfx/menu_select.mp3",
}

# Per-SFX volume scale (0.0–1.0) so aggressive sounds don't overwhelm music
const SFX_VOLUME_SCALES: Dictionary = {
	"jump":       0.35,
	"land":       0.65,
	"coin":       0.80,
	"boost":      0.55,
	"bump":       0.50,
	"brake":      0.50,
	"checkpoint": 0.75,
	"complete":   0.80,
	"unlock":     0.75,
	"death":      0.65,
	"wind":       0.35,
	"bought":     0.75,
	"menu_select":0.85,
}

# ── Playback settings ─────────────────────────────────────────────────────────
var playback_mode: String = "default"  # default | track | random
var loop_enabled: bool = true
var single_track: String = ""

# ── Volume (0.0 – 1.0) ────────────────────────────────────────────────────────
var music_volume: float = 0.4 :
	set(v):
		music_volume = clampf(v, 0.0, 1.0)
		if _music != null:
			_music.volume_db = linear_to_db(music_volume)

var sfx_volume: float = 0.4 :
	set(v):
		sfx_volume = clampf(v, 0.0, 1.0)

var _current_track: String = ""
var _requested_track: String = ""
var _music: AudioStreamPlayer
var _playlist: Array[String] = []
var _playlist_idx: int = 0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_music = AudioStreamPlayer.new()
	_music.name = "MusicPlayer"
	add_child(_music)
	_music.finished.connect(_on_track_finished)
	_ensure_buses()
	# Load saved volume settings
	if get_node_or_null("/root/LevelManager") != null:
		var saved_music: Variant = LevelManager.get_setting("music_volume")
		if saved_music != null:
			music_volume = float(saved_music)
		var saved_sfx: Variant = LevelManager.get_setting("sfx_volume")
		if saved_sfx != null:
			sfx_volume = float(saved_sfx)

# ── Settings helpers ──────────────────────────────────────────────────────────

func set_playback_mode(mode: String) -> void:
	playback_mode = mode
	if mode == "random":
		_build_playlist()

func set_loop_enabled(enabled: bool) -> void:
	loop_enabled = enabled
	if _music.stream is AudioStreamMP3:
		_music.stream.loop = enabled

func set_single_track(track: String) -> void:
	single_track = track

# ── Music ─────────────────────────────────────────────────────────────────────

func play_music(track: String, fade_sec: float = 0.6, force: bool = false) -> void:
	_requested_track = track
	var resolved := track if force else _resolve_track(track)
	if resolved == _current_track and _music.playing:
		return
	_play_resolved(resolved, fade_sec)

func _play_resolved(track: String, fade_sec: float) -> void:
	_current_track = track
	var path: String = MUSIC_PATHS.get(track, "")
	if path.is_empty() or not ResourceLoader.exists(path):
		return
	_music.stream = load(path)
	var should_loop := loop_enabled
	if playback_mode == "random":
		should_loop = false
	if _music.stream is AudioStreamMP3:
		_music.stream.loop = should_loop
	_music.volume_db = -80.0
	_music.play()
	var tw := create_tween()
	tw.tween_property(_music, "volume_db", linear_to_db(music_volume), fade_sec)

func _resolve_track(requested: String) -> String:
	match playback_mode:
		"track":
			if not single_track.is_empty() and MUSIC_PATHS.has(single_track):
				return single_track
			return requested
		"random":
			if _playlist.is_empty():
				_build_playlist()
			if _playlist.is_empty():
				return requested
			return _playlist[_playlist_idx]
		_:
			return requested

func _build_playlist() -> void:
	_playlist.clear()
	for key: String in MUSIC_PATHS.keys():
		if not key.is_empty():
			_playlist.append(key)
	_playlist.shuffle()
	_playlist_idx = 0

func _on_track_finished() -> void:
	if playback_mode == "random" and _playlist.size() > 0:
		_playlist_idx = (_playlist_idx + 1) % _playlist.size()
		_play_resolved(_playlist[_playlist_idx], 0.3)

func stop_music(fade_sec: float = 0.6) -> void:
	_current_track = ""
	var tw := create_tween()
	tw.tween_property(_music, "volume_db", -80.0, fade_sec)
	tw.tween_callback(_music.stop)

# ── SFX ───────────────────────────────────────────────────────────────────────

func play_sfx(sfx: String) -> void:
	var path: String = SFX_PATHS.get(sfx, "")
	if path.is_empty() or not ResourceLoader.exists(path):
		return
	var scale: float = float(SFX_VOLUME_SCALES.get(sfx, 1.0))
	# Use a one-shot player so rapid SFX don't cut each other
	var p := AudioStreamPlayer.new()
	p.stream    = load(path)
	p.volume_db = linear_to_db(sfx_volume * scale)
	p.bus       = BUS_SFX
	add_child(p)
	p.play()
	p.finished.connect(p.queue_free)

# ── Bus setup (called once on start) ─────────────────────────────────────────

func _ensure_buses() -> void:
	_ensure_bus(BUS_MUSIC)
	_ensure_bus(BUS_SFX)
	_music.bus = BUS_MUSIC

func _ensure_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) == -1:
		AudioServer.add_bus()
		var idx := AudioServer.bus_count - 1
		AudioServer.set_bus_name(idx, bus_name)
		AudioServer.set_bus_send(idx, "Master")

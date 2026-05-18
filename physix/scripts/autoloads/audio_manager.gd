extends Node

const BUS_MUSIC := "Music"
const BUS_SFX   := "SFX"

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

const SFX_VOLUME_SCALES: Dictionary = {
	"jump": 0.35, "land": 0.65, "coin": 0.80, "boost": 0.55,
	"bump": 0.50, "brake": 0.50, "checkpoint": 0.75, "complete": 0.80,
	"unlock": 0.75, "death": 0.65, "wind": 0.35, "bought": 0.75,
	"menu_select": 0.85,
}

var playback_mode: String = "default"
var loop_enabled: bool = true
var single_track: String = ""

var music_volume: float = 0.4 :
	set(v):
		music_volume = clampf(v, 0.0, 1.0)
		if _music != null:
			_music.volume_db = linear_to_db(maxf(music_volume, 0.001))

var sfx_volume: float = 0.4 :
	set(v):
		sfx_volume = clampf(v, 0.0, 1.0)

var _current_track: String = ""
var _requested_track: String = ""
var _pending_track: String = ""
var _music: AudioStreamPlayer
var _playlist: Array[String] = []
var _playlist_idx: int = 0
var _stream_cache: Dictionary = {}

var _is_web: bool = false
var _web_gesture_ok: bool = false
var _web_resume_ticks: int = 0
var _web_unlock_js_cb

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_is_web = OS.has_feature("web")
	_web_gesture_ok = not _is_web

	_music = AudioStreamPlayer.new()
	_music.name = "MusicPlayer"
	add_child(_music)
	if _is_web:
		# Threaded web export: stream playback avoids sample-bank issues with MP3.
		_music.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
	_music.finished.connect(_on_track_finished)
	_ensure_buses()
	_unmute_master()

	if get_node_or_null("/root/LevelManager") != null:
		var saved_music: Variant = LevelManager.get_setting("music_volume")
		if saved_music != null:
			music_volume = maxf(float(saved_music), 0.05)
		var saved_sfx: Variant = LevelManager.get_setting("sfx_volume")
		if saved_sfx != null:
			sfx_volume = maxf(float(saved_sfx), 0.05)

	if _is_web:
		_preload_web_streams()
		_web_resume_ticks = 480
		set_process(true)
		_register_web_unlock_bridge()
	else:
		set_process(false)

func _register_web_unlock_bridge() -> void:
	# Must keep a reference; create_callback returns a JS callable, not an integer id.
	_web_unlock_js_cb = JavaScriptBridge.create_callback(_on_js_unlock)
	var win = JavaScriptBridge.get_interface("window")
	win.physixGodotUnlock = _web_unlock_js_cb

func _on_js_unlock(_args: Array) -> void:
	on_web_gesture()

func on_web_gesture() -> void:
	if not _is_web:
		return
	_web_gesture_ok = true
	_resume_browser_audio()
	if not _pending_track.is_empty():
		play_music(_pending_track, 0.0, true)
		_pending_track = ""
	elif not _requested_track.is_empty() and not _music.playing:
		play_music(_requested_track, 0.0, true)

func _process(_delta: float) -> void:
	if not _is_web or _web_resume_ticks <= 0:
		return
	_web_resume_ticks -= 1
	if _web_gesture_ok and _web_resume_ticks % 12 == 0:
		_resume_browser_audio()
	if _web_gesture_ok and _web_resume_ticks % 45 == 0:
		_retry_music_if_silent()

func _preload_web_streams() -> void:
	for path: String in MUSIC_PATHS.values():
		_cache_stream(path)
	for path: String in SFX_PATHS.values():
		_cache_stream(path)

func _cache_stream(path: String) -> AudioStream:
	if _stream_cache.has(path):
		return _stream_cache[path]
	var loaded: AudioStream = load(path) as AudioStream
	if loaded != null:
		_stream_cache[path] = loaded
	return loaded

func _load_stream(path: String) -> AudioStream:
	return _cache_stream(path)

func _bootstrap_web_audio() -> void:
	pass

func _resume_browser_audio() -> void:
	if not _is_web:
		return
	var js := """
try {
    if (window.__resumeAllAudioContexts) {
        window.__resumeAllAudioContexts();
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
        var candidates = [window.godotAudioContext, window.__audioContext];
        for (var k in window) {
            if (window[k] instanceof AC && window[k].state === 'suspended') {
                window[k].resume();
            }
        }
    }
} catch(e) {}
"""
	JavaScriptBridge.eval(js, true)

func _unhandled_input(event: InputEvent) -> void:
	if not _is_web or _web_gesture_ok:
		return
	if event is InputEventMouseButton and event.pressed:
		on_web_gesture()
	elif event is InputEventScreenTouch and event.pressed:
		on_web_gesture()
	elif event is InputEventKey and event.pressed and not event.echo:
		on_web_gesture()

func _unmute_master() -> void:
	var master := AudioServer.get_bus_index(&"Master")
	if master >= 0:
		AudioServer.set_bus_mute(master, false)
		AudioServer.set_bus_volume_db(master, 0.0)
	for bus_name: StringName in [&"Music", &"SFX"]:
		var idx := AudioServer.get_bus_index(bus_name)
		if idx >= 0:
			AudioServer.set_bus_mute(idx, false)

func _retry_music_if_silent() -> void:
	if not _web_gesture_ok:
		return
	if not _requested_track.is_empty() and not _music.playing:
		play_music(_requested_track, 0.0, true)

func set_playback_mode(mode: String) -> void:
	playback_mode = mode
	if mode == "random":
		_build_playlist()

func set_loop_enabled(enabled: bool) -> void:
	loop_enabled = enabled

func set_single_track(track: String) -> void:
	single_track = track

func play_music(track: String, fade_sec: float = 0.6, force: bool = false) -> void:
	_requested_track = track
	if _is_web:
		_resume_browser_audio()
		if not _web_gesture_ok:
			_pending_track = track if force else _resolve_track(track)
			return
	var resolved := track if force else _resolve_track(track)
	if resolved == _current_track and _music.playing:
		return
	_play_resolved(resolved, fade_sec if not _is_web else 0.0)

func _play_resolved(track: String, fade_sec: float) -> void:
	_current_track = track
	var path: String = MUSIC_PATHS.get(track, "")
	if path.is_empty():
		return
	var stream: AudioStream = _load_stream(path)
	if stream == null:
		push_warning("AudioManager: missing music %s" % path)
		return
	if stream is AudioStreamMP3:
		stream.loop = loop_enabled and playback_mode != "random"
	_music.stream = stream
	_music.bus = BUS_MUSIC
	_music.volume_db = linear_to_db(maxf(music_volume, 0.001))
	_music.play()
	if _is_web:
		call_deferred("_verify_web_play", track)
	if fade_sec > 0.0 and not _is_web:
		_music.volume_db = -80.0
		var tw := create_tween()
		tw.tween_property(_music, "volume_db", linear_to_db(music_volume), fade_sec)

func _verify_web_play(track: String) -> void:
	await get_tree().create_timer(0.15).timeout
	if _current_track != track:
		return
	if _music.playing:
		return
	push_warning("AudioManager: web music did not start (%s) — click the game once." % track)
	_music.play()

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
		_play_resolved(_playlist[_playlist_idx], 0.3 if not _is_web else 0.0)

func stop_music(fade_sec: float = 0.6) -> void:
	_current_track = ""
	if _is_web or fade_sec <= 0.0:
		_music.stop()
		return
	var tw := create_tween()
	tw.tween_property(_music, "volume_db", -80.0, fade_sec)
	tw.tween_callback(_music.stop)

func play_sfx(sfx: String) -> void:
	if _is_web:
		_resume_browser_audio()
	var path: String = SFX_PATHS.get(sfx, "")
	if path.is_empty():
		return
	var stream: AudioStream = _load_stream(path)
	if stream == null:
		return
	var scale: float = float(SFX_VOLUME_SCALES.get(sfx, 1.0))
	var p := AudioStreamPlayer.new()
	if _is_web:
		p.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
	p.stream = stream
	p.volume_db = linear_to_db(maxf(sfx_volume * scale, 0.001))
	p.bus = BUS_SFX
	add_child(p)
	p.play()
	p.finished.connect(p.queue_free)

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

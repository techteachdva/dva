extends Node

# Pixel and Lost Valley are not in the web game's first download.
# Each look is a pack, fetched the first time it is chosen and kept
# after that. Valley stays in the main pack. Desktop and the editor
# already have the sheets, so they never fetch.

signal look_changed(era: String)
signal look_status(text: String)

const REV := "1"
const _SPLIT: Array[String] = ["pixel", "lost"]

var _http: HTTPRequest
var _pending: String = ""
var _wanted: String = ""
var _line: String = ""
var _mounted: Dictionary = {}

func _process(_delta: float) -> void:
	if _pending == "" or _http == null:
		return
	var title := str(EraBook.TITLES.get(_pending, _pending))
	var total := _http.get_body_size()
	var got := _http.get_downloaded_bytes()
	if total > 0 and got > 0:
		_set_line("Fetching %s… %d%%" % [title, clampi(int(float(got) * 100.0 / float(total)), 1, 99)])
	else:
		_set_line("Fetching %s…" % title)

# A saved look is a choice already made. Mount a pack that is already
# on disk before the menu draws, or start that one download.
func boot() -> void:
	var era := str(get_node("/root/GameConfig").sprite_era)
	if not _split(era) or ready(era) or _pending == era:
		return
	_wanted = era
	_begin(era)

func ready(era: String) -> bool:
	if not _split(era):
		return true
	if _mounted.get(era, false):
		return true
	return ResourceLoader.exists(_probe(era))

func chosen() -> String:
	if _wanted != "":
		return _wanted
	var era := str(get_node("/root/GameConfig").sprite_era)
	return era if era in ["valley", "pixel", "lost"] else "valley"

func settled() -> bool:
	return ready(chosen())

func line() -> String:
	return _line

func choose(era: String) -> void:
	if era not in ["valley", "pixel", "lost"]:
		era = "valley"
	_wanted = era
	if ready(era):
		_apply(era)
		return
	if _pending == era:
		return
	_begin(era)

func _split(era: String) -> bool:
	return _SPLIT.has(era)

func _probe(era: String) -> String:
	return "res://assets/sprites/%s/sheep.png" % era

func _version() -> String:
	return str(ProjectSettings.get_setting("application/config/version", "0"))

func _path(era: String) -> String:
	return "user://looks/%s-%s-%s.pck" % [era, _version(), REV]

func _url(era: String) -> String:
	var file := "looks/%s.pck" % era
	if not OS.has_feature("web"):
		return file
	var href := str(JavaScriptBridge.eval("window.location.href", true))
	var q := href.find("?")
	if q >= 0:
		href = href.substr(0, q)
	var h := href.find("#")
	if h >= 0:
		href = href.substr(0, h)
	var cut := href.rfind("/")
	if cut < 0:
		return file
	return href.substr(0, cut + 1) + file

func _begin(era: String) -> void:
	if FileAccess.file_exists(_path(era)) and _mount(era):
		if chosen() == era:
			_apply(era)
		return
	if FileAccess.file_exists(_path(era)):
		_drop(era)
	if _http != null:
		_http.queue_free()
	_http = HTTPRequest.new()
	_http.timeout = 180.0
	_http.use_threads = false
	_http.body_size_limit = -1
	add_child(_http)
	_pending = era
	_http.request_completed.connect(_on_http.bind(era))
	_set_line("Fetching %s…" % str(EraBook.TITLES.get(era, era)))
	var err := _http.request(_url(era))
	if err != OK:
		_pending = ""
		if chosen() == era:
			_fail(era)

func _on_http(result: int, code: int, _headers: PackedStringArray, body: PackedByteArray, era: String) -> void:
	if era != _pending:
		return
	_pending = ""
	if result != HTTPRequest.RESULT_SUCCESS or code != 200 or not _is_pack(body):
		if chosen() == era:
			_fail(era)
		return
	if not _save(era, body) or not _mount(era):
		_drop(era)
		if chosen() == era:
			_fail(era)
		return
	if chosen() == era:
		_apply(era)

func _is_pack(body: PackedByteArray) -> bool:
	return body.size() > 4 and body[0] == 0x47 and body[1] == 0x44 and body[2] == 0x50 and body[3] == 0x43

func _save(era: String, body: PackedByteArray) -> bool:
	DirAccess.make_dir_recursive_absolute("user://looks")
	var file := FileAccess.open(_path(era), FileAccess.WRITE)
	if file == null:
		return false
	file.store_buffer(body)
	file.close()
	return true

func _mount(era: String) -> bool:
	var path := _path(era)
	# Leave files the game already has (scripts, Valley sheets) in place.
	# Only the missing look is added from the pack.
	var ok := ProjectSettings.load_resource_pack(path, false)
	if not ok:
		ok = ProjectSettings.load_resource_pack(ProjectSettings.globalize_path(path), false)
	var loaded := ok and ResourceLoader.exists(_probe(era))
	_mounted[era] = loaded
	return loaded

func _drop(era: String) -> void:
	_mounted.erase(era)
	var dir := DirAccess.open("user://looks")
	if dir != null:
		dir.remove(_path(era).get_file())

func _apply(era: String) -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.sprite_era = era
	gc.save_meta()
	_wanted = era
	FelecoUi.forget_creatures()
	_set_line("")
	look_changed.emit(era)

func _fail(era: String) -> void:
	var gc: Node = get_node("/root/GameConfig")
	if str(gc.sprite_era) == era:
		gc.sprite_era = "valley"
		gc.save_meta()
	_wanted = str(gc.sprite_era)
	_set_line("Could not fetch %s. The valley keeps its current look." % str(EraBook.TITLES.get(era, era)))
	look_changed.emit(_wanted)

func _set_line(text: String) -> void:
	if _line == text:
		return
	_line = text
	look_status.emit(text)

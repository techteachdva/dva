extends Control

class_name EventHistory

var _entries: Array[String] = []
const MAX_ENTRIES: int = 500

@onready var _panel: Panel = $Panel
@onready var _rich_text: RichTextLabel = $Panel/MarginContainer/VBoxContainer/RichTextLabel
@onready var _close_button: Button = $Panel/MarginContainer/VBoxContainer/CloseButton

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

func _ready() -> void:
	FelecoUiScript.dress_hud(self)
	process_mode = Node.PROCESS_MODE_ALWAYS
	z_index = 100
	_panel.hide()
	_close_button.pressed.connect(func() -> void: _panel.hide())

func toggle() -> void:
	_panel.visible = not _panel.visible
	if _panel.visible:
		_refresh_display()

func add_entry(text: String) -> void:
	var timestamp: String = _format_time()
	var entry: String = "[%s] %s" % [timestamp, text]
	_entries.append(entry)
	if _entries.size() > MAX_ENTRIES:
		_entries.remove_at(0)
	if _panel.visible:
		_refresh_display()

func set_entries_from_log(entries: Array[String]) -> void:
	_entries = entries.duplicate()
	_refresh_display()

func _format_time() -> String:
	var total: float = Time.get_ticks_msec() / 1000.0
	var mins: int = int(total / 60.0)
	var secs: int = int(total) % 60
	return "%02d:%02d" % [mins, secs]

func _refresh_display() -> void:
	var bbcode := ""
	for entry: String in _entries:
		bbcode += entry + "\n"
	_rich_text.text = bbcode
	# Auto-scroll to bottom
	_rich_text.scroll_to_line(_entries.size())

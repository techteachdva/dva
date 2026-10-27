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

# Each kind of event gets the ticker's colour and tag, so History reads at a
# glance: green births, grey deaths, red hunts, orange fights, gold big news.
func add_entry(text: String, kind: String = "") -> void:
	var timestamp: String = _format_time()
	var entry: String = "[color=#7f8a80][%s][/color] %s" % [timestamp, text]
	if Tickertape.KIND_COLORS.has(kind):
		var col: Color = Tickertape.KIND_COLORS[kind]
		var tag: String = Tickertape.KIND_TAGS[kind]
		var words: String = "[color=#%s]%s[/color]" % [col.lerp(Color(0.97, 0.95, 0.9), 0.3).to_html(false), text]
		if kind in ["big", "kill"]:
			words = "[b]%s[/b]" % words
		if kind == "big":
			words = "[bgcolor=#%s]%s[/bgcolor]" % [col.darkened(0.75).to_html(false), words]
		entry = "[color=#7f8a80][%s][/color] [bgcolor=#%s][color=#10140f][b] %s [/b][/color][/bgcolor] %s" % [timestamp, col.to_html(false), tag, words]
	_entries.append(entry)
	if _entries.size() > MAX_ENTRIES:
		_entries.remove_at(0)
	if _panel.visible:
		_refresh_display()

# A line that stands out: gold for a rampage won, red for one lost.
func add_highlight(text: String, color: Color) -> void:
	var bg: Color = color.darkened(0.7)
	add_entry("[bgcolor=#%s][color=#%s][b]%s[/b][/color][/bgcolor]" % [bg.to_html(false), color.to_html(false), text])

func set_entries_from_log(entries: Array[String]) -> void:
	_entries = entries.duplicate()
	_refresh_display()

func _format_time() -> String:
	var total: float = Time.get_ticks_msec() / 1000.0
	var mins: int = int(total / 60.0)
	var secs: int = int(total) % 60
	return "%02d:%02d" % [mins, secs]

const LEGEND: String = "[font_size=13][color=#73e066]BORN[/color]   [color=#b3bdc7]DIED[/color]   [color=#f2614f]HUNT[/color]   [color=#fa9e4d]FIGHT[/color]   [color=#ffcc47]BIG NEWS[/color]   [color=#d9a8ff]VALLEY[/color][/font_size]

"

func _refresh_display() -> void:
	var bbcode := LEGEND
	for entry: String in _entries:
		bbcode += entry + "\n"
	_rich_text.text = bbcode
	# Auto-scroll to bottom
	_rich_text.scroll_to_line(_entries.size() + 2)

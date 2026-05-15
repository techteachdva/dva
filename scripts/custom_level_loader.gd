extends Control

# Custom Level Loader — paste a level code and play it directly.

@onready var code_edit: TextEdit = $Center/VBox/CodeEdit
@onready var play_btn: Button = $Center/VBox/ButtonRow/PlayBtn
@onready var paste_btn: Button = $Center/VBox/ButtonRow/PasteBtn
@onready var back_btn: Button = $Center/VBox/BackBtn

func _ready() -> void:
	play_btn.pressed.connect(_on_play)
	paste_btn.pressed.connect(_on_paste)
	back_btn.pressed.connect(_on_back)
	code_edit.grab_focus()

func _on_play() -> void:
	var code := code_edit.text.strip_edges()
	if code.is_empty():
		_show_error("Please enter a level code.")
		return
	var bytes: PackedByteArray = Marshalls.base64_to_raw(code)
	var json: String = bytes.get_string_from_utf8()
	if json.is_empty():
		_show_error("Invalid level code.")
		return
	var parsed: Variant = JSON.parse_string(json)
	if not parsed is Dictionary:
		_show_error("Invalid level code format.")
		return
	var version: String = parsed.get("v", "")
	if not version.begins_with("px"):
		_show_error("Unsupported level version.")
		return
	GameManager.editor_test_data = parsed
	GameManager.set_meta("_custom_level", true)
	Main.instance.load_editor_test_runner()

func _on_paste() -> void:
	var text := DisplayServer.clipboard_get()
	if text != null:
		code_edit.text = text

func _on_back() -> void:
	Main.instance.load_main_menu()

func _show_error(msg: String) -> void:
	var lbl := Label.new()
	lbl.text = msg
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_color_override("font_color", Color(1.0, 0.3, 0.3, 1.0))
	lbl.add_theme_font_size_override("font_size", 18)
	$Center/VBox.add_child(lbl)
	var tw := create_tween()
	tw.tween_property(lbl, "modulate:a", 0.0, 2.0)
	tw.tween_callback(func(): lbl.queue_free())

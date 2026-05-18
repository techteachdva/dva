extends Node3D
class_name LevelEditor

# Thin coordinator: input routing, UI shell, persistence. Logic lives in editor/* controllers.

@onready var editor_camera: Camera3D = $EditorCamera
@onready var editor_ui: CanvasLayer = $EditorUI
@onready var toolbar: HBoxContainer = $EditorUI/Toolbar
@onready var palette: VBoxContainer = $EditorUI/Palette/Content
@onready var props_panel: VBoxContainer = $EditorUI/PropertiesPanel/PropsVBox
@onready var code_panel: Panel = $EditorUI/CodePanel
@onready var code_edit: TextEdit = $EditorUI/CodePanel/CodeEdit
@onready var level_root: Node3D = $EditorLevel
@onready var track_root: Node3D = $EditorLevel/TrackRoot
@onready var grid_visual: MeshInstance3D = $EditorLevel/GridVisual
@onready var selection_gizmo: Node3D = $EditorLevel/SelectionGizmo
@onready var status_label: Label = $EditorUI/Toolbar/StatusLabel
@onready var dirty_label: Label = $EditorUI/Toolbar/DirtyLabel
@onready var palette_scroll: ScrollContainer = $EditorUI/Palette
@onready var props_panel_root: Control = $EditorUI/PropertiesPanel
@onready var seg_timeline_panel: Panel = $EditorUI/SegTimeline
@onready var seg_timeline_scroll: ScrollContainer = $EditorUI/SegTimeline/SegTimelineScroll
@onready var seg_timeline_content: HBoxContainer = $EditorUI/SegTimeline/SegTimelineScroll/SegTimelineContent
@onready var mode_buttons_container: HBoxContainer = $EditorUI/ModeButtons
@onready var track_mode_btn: Button = $EditorUI/ModeButtons/TrackModeBtn
@onready var obstacle_mode_btn: Button = $EditorUI/ModeButtons/ObstacleModeBtn
@onready var checkpoint_mode_btn: Button = $EditorUI/ModeButtons/CheckpointModeBtn
@onready var delete_prop_btn: Button = $EditorUI/PropertiesPanel/PropsVBox/PropActions/DeleteBtn
@onready var focus_prop_btn: Button = $EditorUI/PropertiesPanel/PropsVBox/PropActions/FocusBtn

var styles: EditorUiStyles
var undo: EditorUndoManager
var track: EditorTrackController
var placement: EditorPlacementController
var camera: EditorCameraController

var mode: EditorDefinitions.Mode = EditorDefinitions.Mode.TRACK
var selected_tool: String = ""
var selected_node: Node3D = null
var snap_size: float = 1.0
var track_width: float = 8.0
var track_length: float = 150.0

var _level_dirty: bool = false
var _last_saved_path: String = ""
var _import_mode: bool = false
var _pending_restore_level_data: Dictionary = {}
var _mode_buttons: Array[Button] = []
var seg_prop_value_labels: Dictionary = {}


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_SIZE_CHANGED:
		EditorUiLayout.apply(self)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	styles = EditorUiStyles.new()
	track = EditorTrackController.new(self)
	placement = EditorPlacementController.new(self)
	camera = EditorCameraController.new(self)
	undo = EditorUndoManager.new(self)

	camera.setup_defaults()
	var restored_session := GameManager.editor_restore_pending
	if restored_session:
		_restore_editor_session()
	else:
		track.segments = track.default_segments()
	_wire_scene_ui()
	track.bind_timeline(seg_timeline_content)
	_build_palette()
	track.update_snap_ui()
	camera.update_grid()
	_hide_code_panel()
	_connect_toolbar()
	camera.build_controls_panel()
	EditorUiLayout.apply(self)
	_update_dirty_label()
	update_status_bar()
	_sync_mode_buttons()
	track.rebuild()
	track.refresh_timeline()
	if track.selected_index >= 0:
		track.update_properties_panel()
	if not _pending_restore_level_data.is_empty():
		LevelSerializer.import_obstacles_and_coins(_pending_restore_level_data, level_root)
		_pending_restore_level_data = {}
	if restored_session:
		_mark_dirty()
	else:
		_mark_clean()


func _process(delta: float) -> void:
	camera.process(delta)
	placement.process_frame()


func _unhandled_input(event: InputEvent) -> void:
	camera.handle_input(event)
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if not placement.is_dragging and not is_mouse_over_ui():
			placement.handle_left_click(EditorRaycast.mouse_ray(editor_camera, event.position))
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		placement.handle_left_release()
	if event is InputEventKey and event.pressed and event.keycode == KEY_DELETE:
		if selected_node != null:
			placement.delete_selected()
		elif mode == EditorDefinitions.Mode.TRACK and track.selected_index >= 0:
			track.remove_segment()
	if event is InputEventKey and event.pressed and event.ctrl_pressed:
		match event.keycode:
			KEY_Z:
				undo.undo()
			KEY_S:
				_quick_save()
				get_viewport().set_input_as_handled()
			KEY_D:
				if mode != EditorDefinitions.Mode.TRACK:
					placement.duplicate_selected()
					get_viewport().set_input_as_handled()
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		_clear_editor_selection()
	if event is InputEventKey and event.pressed and not event.ctrl_pressed and not event.alt_pressed:
		if event.keycode == KEY_F12 or event.unicode == 63:
			show_help()
		elif mode == EditorDefinitions.Mode.TRACK and not is_mouse_over_ui():
			_handle_track_keyboard(event)


func _handle_track_keyboard(event: InputEventKey) -> void:
	match event.keycode:
		KEY_LEFT, KEY_BRACKETLEFT:
			track.select_neighbor(-1)
			get_viewport().set_input_as_handled()
		KEY_RIGHT, KEY_BRACKETRIGHT:
			track.select_neighbor(1)
			get_viewport().set_input_as_handled()
		KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8, KEY_9:
			track.apply_snap_from_key(int(event.keycode) - KEY_1)
			get_viewport().set_input_as_handled()


func _quick_save() -> void:
	if _last_saved_path.is_empty():
		_on_save()
		return
	var data := _capture_editor_level_data()
	var file := FileAccess.open(_last_saved_path, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
		_mark_clean()
		update_status_bar()


func _handle_left_click(ray: Dictionary) -> void:
	placement.handle_left_click(ray)


func is_mouse_over_ui() -> bool:
	var hovered: Control = get_viewport().gui_get_hovered_control()
	if hovered == null:
		return false
	var node: Node = hovered
	while node != null:
		if node == editor_ui:
			return true
		node = node.get_parent()
	return false


func mark_dirty() -> void:
	_mark_dirty()


func _mark_dirty() -> void:
	if _level_dirty:
		return
	_level_dirty = true
	_update_dirty_label()


func _mark_clean() -> void:
	_level_dirty = false
	_update_dirty_label()


func _update_dirty_label() -> void:
	if dirty_label == null:
		return
	if _level_dirty:
		dirty_label.text = "● Unsaved"
		dirty_label.add_theme_color_override("font_color", Color(1.0, 0.55, 0.35, 1.0))
	else:
		dirty_label.text = ""
		dirty_label.remove_theme_color_override("font_color")


func update_status_bar() -> void:
	if status_label == null:
		return
	var mode_names := ["Track", "Obstacles", "Checkpoints"]
	var text := "Mode: %s" % mode_names[mode]
	if _level_dirty:
		text += "  ·"
	match mode:
		EditorDefinitions.Mode.TRACK:
			if track.selected_index >= 0 and track.selected_index < track.segments.size():
				var seg: EditorSegment = track.segments[track.selected_index]
				var type_name: String = EditorDefinitions.SEGMENT_TYPES.get(seg.type, {}).get("name", seg.type)
				text += "  |  Seg %d/%d: %s  Snap %s" % [track.selected_index + 1, track.segments.size(), type_name, seg.snap]
			else:
				text += "  |  Click segment or timeline to edit 9-snap"
		EditorDefinitions.Mode.OBSTACLE, EditorDefinitions.Mode.CHECKPOINT:
			if selected_tool.is_empty():
				text += "  |  Select or place"
			else:
				text += "  |  Tool: %s" % selected_tool
	status_label.text = text


func _confirm_if_dirty(action: Callable, message: String = "Discard unsaved changes?") -> void:
	if not _level_dirty:
		action.call()
		return
	var dlg := ConfirmationDialog.new()
	dlg.title = "Unsaved changes"
	dlg.dialog_text = message
	dlg.confirmed.connect(func() -> void:
		action.call()
		dlg.queue_free()
	)
	dlg.canceled.connect(dlg.queue_free)
	dlg.close_requested.connect(dlg.queue_free)
	add_child(dlg)
	dlg.popup_centered()


func _clear_editor_selection() -> void:
	selected_tool = ""
	selected_node = null
	placement.clear_ghost()
	track.deselect()
	track.armed_track_type = ""
	track.highlight_armed_type()
	placement.update_selection_gizmo()
	placement.update_properties_ui()
	update_status_bar()


func _wire_scene_ui() -> void:
	_mode_buttons = [track_mode_btn, obstacle_mode_btn, checkpoint_mode_btn]
	for i: int in range(_mode_buttons.size()):
		styles.style_mode_button(_mode_buttons[i])
		_mode_buttons[i].pressed.connect(_set_mode.bind(i))
	seg_prop_value_labels = {
		"Index": $EditorUI/PropertiesPanel/PropsVBox/SegProps/SegGrid/IndexValue,
		"Type": $EditorUI/PropertiesPanel/PropsVBox/SegProps/SegGrid/TypeValue,
		"Snap": $EditorUI/PropertiesPanel/PropsVBox/SegProps/SegGrid/SnapValue,
		"Offset X": $EditorUI/PropertiesPanel/PropsVBox/SegProps/SegGrid/OffsetXValue,
		"Offset Y": $EditorUI/PropertiesPanel/PropsVBox/SegProps/SegGrid/OffsetYValue,
	}
	var spin_paths := {
		"Pos X": "PosXSpin",
		"Pos Y": "PosYSpin",
		"Pos Z": "PosZSpin",
		"Rot X": "RotXSpin",
		"Rot Y": "RotYSpin",
		"Rot Z": "RotZSpin",
	}
	var obs_grid: Node = $EditorUI/PropertiesPanel/PropsVBox/ObstacleProps/ObsGrid
	for label: String in spin_paths:
		var spin: SpinBox = obs_grid.get_node(spin_paths[label]) as SpinBox
		spin.value_changed.connect(placement.on_prop_changed.bind(label))
		placement.prop_spinboxes[label] = spin
	delete_prop_btn.pressed.connect(placement.delete_selected)
	focus_prop_btn.pressed.connect(camera.focus_selected)
	styles.style_tool_button(delete_prop_btn)
	styles.style_tool_button(focus_prop_btn)
	for btn: Node in toolbar.get_children():
		if btn is Button:
			styles.style_tool_button(btn as Button)
	styles.style_tool_button($EditorUI/CodePanel/CopyBtn)
	styles.style_tool_button($EditorUI/CodePanel/CloseBtn)
	_sync_mode_buttons()
	placement.update_properties_ui()


func _sync_mode_buttons() -> void:
	for i: int in range(_mode_buttons.size()):
		var active: bool = (i == int(mode))
		_mode_buttons[i].button_pressed = active
		styles.highlight_mode_button(_mode_buttons[i], active)


func _set_mode(idx: int) -> void:
	mode = idx as EditorDefinitions.Mode
	selected_tool = ""
	selected_node = null
	placement.clear_ghost()
	_sync_mode_buttons()
	_build_palette()
	update_status_bar()
	track.update_snap_ui()


func _build_palette() -> void:
	for child: Node in palette.get_children():
		child.queue_free()
	match mode:
		EditorDefinitions.Mode.TRACK:
			track.build_palette_section(palette)
		EditorDefinitions.Mode.OBSTACLE:
			placement.build_obstacle_palette(palette)
		EditorDefinitions.Mode.CHECKPOINT:
			placement.build_checkpoint_palette(palette)


func _connect_toolbar() -> void:
	$EditorUI/Toolbar/NewBtn.pressed.connect(_on_new)
	$EditorUI/Toolbar/SaveBtn.pressed.connect(_on_save)
	$EditorUI/Toolbar/LoadBtn.pressed.connect(_on_load)
	$EditorUI/Toolbar/ExportBtn.pressed.connect(_on_export)
	$EditorUI/Toolbar/ImportBtn.pressed.connect(_on_import)
	$EditorUI/Toolbar/TestBtn.pressed.connect(_on_test)
	if has_node("EditorUI/Toolbar/RandomBtn"):
		$EditorUI/Toolbar/RandomBtn.pressed.connect(_on_random)
	$EditorUI/Toolbar/MenuBtn.pressed.connect(_on_menu)
	if has_node("EditorUI/Toolbar/UndoBtn"):
		$EditorUI/Toolbar/UndoBtn.pressed.connect(undo.undo)
	if has_node("EditorUI/Toolbar/HelpBtn"):
		$EditorUI/Toolbar/HelpBtn.pressed.connect(show_help)
	$EditorUI/CodePanel/CloseBtn.pressed.connect(_hide_code_panel)
	$EditorUI/CodePanel/CopyBtn.pressed.connect(_on_copy_code)


func show_help() -> void:
	var popup := AcceptDialog.new()
	popup.title = "Level Editor Help"
	popup.dialog_text = """MODES (top center)
Track — edit middle segments + 9-snap grid
Obstacles — place props and patterns
Checkpoints — place hex hoops

TRACK MODE
Left click segment or timeline — select for 9-snap
Left click empty space — deselect
Track type buttons — change selected segment shape
← / → or [ / ] — previous / next segment
1–9 — set 9-snap on selected segment (same order as snap grid)

OBSTACLE / CHECKPOINT MODE
Left click — place active tool (ghost preview)
Left click (no tool) — select and drag object
Right click (tap) — delete selected
Ctrl+D — duplicate selected object

CAMERA: Middle drag orbit | Right drag pan | Scroll zoom
WASD pan | F1–F4 presets | Delete | Ctrl+Z undo | Ctrl+S save | Esc clear"""
	add_child(popup)
	popup.popup_centered()


func _capture_editor_level_data() -> Dictionary:
	var data := LevelSerializer.export_level(level_root)
	data["segs"] = EditorSegment.to_dict_array(track.segments)
	data["mid_only"] = true
	return data


func _restore_editor_session() -> void:
	var session: Dictionary = GameManager.editor_saved_session
	GameManager.editor_restore_pending = false
	if session.is_empty():
		track.segments = track.default_segments()
		return
	var data: Variant = session.get("level", {})
	if data is Dictionary:
		var level_data: Dictionary = data
		track.segments = EditorSegment.normalize_list(level_data.get("segs", []))
		if track.segments.is_empty():
			track.segments = track.default_segments()
		level_root.set("level_name", level_data.get("n", "Custom Level"))
		level_root.set("par_time", level_data.get("pt", 45.0))
		level_root.set("physics_fact", level_data.get("pf", ""))
		_pending_restore_level_data = level_data
	else:
		track.segments = track.default_segments()
		_pending_restore_level_data = {}
	camera.cam_yaw = float(session.get("cam_yaw", camera.cam_yaw))
	camera.cam_pitch = float(session.get("cam_pitch", camera.cam_pitch))
	camera.cam_dist = float(session.get("cam_dist", camera.cam_dist))
	var ct: Variant = session.get("cam_target", camera.cam_target)
	if ct is Vector3:
		camera.cam_target = ct
	track.selected_index = int(session.get("selected_seg", -1))
	_last_saved_path = str(session.get("last_saved_path", ""))
	mode = clampi(int(session.get("mode", 0)), 0, 2) as EditorDefinitions.Mode


func _on_new() -> void:
	_confirm_if_dirty(_apply_new_level, "Create a new empty level? Unsaved changes will be lost.")


func _apply_new_level() -> void:
	var to_remove: Array[Node] = []
	for child: Node in track_root.get_children():
		to_remove.append(child)
	for child: Node in to_remove:
		track_root.remove_child(child)
		child.free()
	GameManager.editor_restore_pending = false
	GameManager.editor_saved_session = {}
	selected_node = null
	placement.update_selection_gizmo()
	placement.update_properties_ui()
	track.segments = track.default_segments()
	track.selected_index = -1
	track.armed_track_type = ""
	mode = EditorDefinitions.Mode.TRACK
	_sync_mode_buttons()
	_build_palette()
	track.refresh_timeline()
	track.rebuild()
	camera.cam_target = Vector3(0, 2, -60)
	camera.reset_view()
	_last_saved_path = ""
	_mark_clean()
	update_status_bar()


func _on_save() -> void:
	var dialog := FileDialog.new()
	dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	dialog.add_filter("*.json", "Level JSON")
	dialog.current_path = _last_saved_path if not _last_saved_path.is_empty() else "user://custom_level.json"
	dialog.file_selected.connect(func(path: String):
		var data := _capture_editor_level_data()
		var file := FileAccess.open(path, FileAccess.WRITE)
		if file:
			file.store_string(JSON.stringify(data))
			_last_saved_path = path
			_mark_clean()
			update_status_bar()
	)
	add_child(dialog)
	dialog.popup_centered(Vector2(800, 600))


func _on_load() -> void:
	var dialog := FileDialog.new()
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialog.add_filter("*.json", "Level JSON")
	dialog.file_selected.connect(func(path: String):
		var file := FileAccess.open(path, FileAccess.READ)
		if file == null:
			return
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		if parsed is Dictionary:
			track.segments = EditorSegment.normalize_list(parsed.get("segs", []))
			if track.segments.is_empty():
				track.segments = track.default_segments()
			track.rebuild()
			LevelSerializer.import_obstacles_and_coins(parsed, level_root)
			track.refresh_timeline()
			track.update_snap_ui()
			_last_saved_path = path
			_mark_clean()
			update_status_bar()
	)
	add_child(dialog)
	dialog.popup_centered(Vector2(800, 600))


func _on_export() -> void:
	var data := _capture_editor_level_data()
	code_edit.text = Marshalls.raw_to_base64(JSON.stringify(data).to_utf8_buffer())
	code_panel.visible = true
	code_edit.select_all()
	code_edit.grab_focus()


func _on_import() -> void:
	if _import_mode:
		return
	code_edit.text = ""
	code_panel.visible = true
	_import_mode = true
	$EditorUI/CodePanel/CopyBtn.text = "Import"
	$EditorUI/CodePanel/CopyBtn.pressed.disconnect(_on_copy_code)
	$EditorUI/CodePanel/CopyBtn.pressed.connect(_on_import_code)


func _hide_code_panel() -> void:
	code_panel.visible = false
	if not _import_mode:
		return
	_import_mode = false
	$EditorUI/CodePanel/CopyBtn.pressed.disconnect(_on_import_code)
	$EditorUI/CodePanel/CopyBtn.pressed.connect(_on_copy_code)
	$EditorUI/CodePanel/CopyBtn.text = "Copy"


func _on_copy_code() -> void:
	DisplayServer.clipboard_set(code_edit.text)
	$EditorUI/CodePanel/CopyBtn.text = "Copied!"
	await get_tree().create_timer(1.5).timeout
	$EditorUI/CodePanel/CopyBtn.text = "Copy"


func _on_import_code() -> void:
	var code := code_edit.text.strip_edges()
	if code.is_empty():
		return
	var parsed: Variant = JSON.parse_string(Marshalls.base64_to_raw(code).get_string_from_utf8())
	if parsed is Dictionary:
		track.segments = EditorSegment.normalize_list(parsed.get("segs", []))
		if track.segments.is_empty():
			track.segments = track.default_segments()
		track.rebuild()
		LevelSerializer.import_obstacles_and_coins(parsed, level_root)
		track.refresh_timeline()
		track.update_snap_ui()
		_mark_dirty()
		update_status_bar()
	_hide_code_panel()


func _on_test() -> void:
	if not _level_dirty:
		_run_test_level()
		return
	var dlg := ConfirmationDialog.new()
	dlg.title = "Test level"
	dlg.dialog_text = "Unsaved file changes. Test uses current editor state (restored when you return)."
	dlg.ok_button_text = "Test"
	dlg.confirmed.connect(func() -> void:
		_run_test_level()
		dlg.queue_free()
	)
	dlg.canceled.connect(dlg.queue_free)
	add_child(dlg)
	dlg.popup_centered()


func _run_test_level() -> void:
	var data := _capture_editor_level_data()
	GameManager.editor_saved_session = {
		"level": data,
		"cam_yaw": camera.cam_yaw,
		"cam_pitch": camera.cam_pitch,
		"cam_dist": camera.cam_dist,
		"cam_target": camera.cam_target,
		"selected_seg": track.selected_index,
		"mode": mode,
		"last_saved_path": _last_saved_path,
	}
	GameManager.editor_restore_pending = true
	var file := FileAccess.open("user://editor_autosave.json", FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(data))
	GameManager.editor_test_data = data
	Main.instance.load_editor_test_runner()


func _on_random() -> void:
	_confirm_if_dirty(_apply_random_level, "Generate a random track? Unsaved changes will be lost.")


func _apply_random_level() -> void:
	var editor_data: Dictionary = LevelFactory.generate_random_editor_level()
	track.segments = EditorSegment.normalize_list(editor_data.get("segs", []))
	if track.segments.is_empty():
		track.segments = track.default_segments()
	level_root.set("level_name", editor_data.get("n", "Random Level"))
	level_root.set("par_time", editor_data.get("pt", 45.0))
	selected_node = null
	track.selected_index = 0 if track.segments.size() > 0 else -1
	_clear_obstacles_only()
	track.rebuild()
	LevelSerializer.import_obstacles_and_coins(editor_data, level_root)
	track.refresh_timeline()
	track.update_snap_ui()
	_build_palette()
	camera.cam_target = Vector3(0, 2, -60)
	camera.update_camera()
	_mark_dirty()
	update_status_bar()


func _clear_obstacles_only() -> void:
	for child: Node in track_root.get_children():
		if TrackMeshBuilder.is_track_geometry_node(child):
			continue
		child.queue_free()


func _on_menu() -> void:
	_confirm_if_dirty(func() -> void: Main.instance.load_main_menu(), "Leave the editor? Unsaved changes will be lost.")

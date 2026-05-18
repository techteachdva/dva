extends RefCounted
class_name EditorCameraController

var _editor: LevelEditor
var cam_yaw: float = 90.0
var cam_pitch: float = 10.0
var cam_dist: float = 35.0
var cam_target: Vector3 = Vector3(0, 2, -60)
var grid_visible: bool = true
var right_click_dragging: bool = false
var right_click_start: Vector2 = Vector2.ZERO
var cam_panel: Control


func _init(editor: LevelEditor) -> void:
	_editor = editor


func setup_defaults() -> void:
	cam_yaw = 90.0
	cam_pitch = 10.0
	cam_dist = 35.0
	cam_target = Vector3(0, 2, -60)
	update_camera()


func build_controls_panel() -> void:
	var panel := PanelContainer.new()
	panel.name = "CameraPanelContainer"
	panel.anchor_left = 1.0
	panel.anchor_right = 1.0
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = -150
	panel.offset_top = -260
	panel.offset_right = -10
	panel.offset_bottom = -10
	_editor.editor_ui.add_child(panel)
	var panel_style := StyleBoxFlat.new()
	EditorUiStyles.apply_flat_style(panel_style, Color(0.04, 0.10, 0.15, 0.92), Color(0.0, 0.6, 0.9, 0.6), 1, 6)
	panel_style.content_margin_left = 8
	panel_style.content_margin_top = 6
	panel_style.content_margin_right = 8
	panel_style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", panel_style)
	cam_panel = panel
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 4)
	panel.add_child(vbox)
	var title := Label.new()
	title.text = "CAMERA"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 14)
	title.add_theme_color_override("font_color", Color(0.0, 0.8, 1.0, 1.0))
	vbox.add_child(title)
	vbox.add_child(HSeparator.new())
	var presets: Array[Dictionary] = [
		{"label": "Snap to Start", "callback": snap_to_start, "tip": "Shortcut: Home"},
		{"label": "Side View", "callback": side_view, "tip": "Shortcut: F2"},
		{"label": "Top View", "callback": top_view, "tip": "Shortcut: F3"},
		{"label": "Front View", "callback": front_view, "tip": "Shortcut: F4"},
		{"label": "Focus Selected", "callback": focus_selected, "tip": "Shortcut: F"},
		{"label": "Reset", "callback": reset_view, "tip": "Shortcut: F1"},
	]
	for p: Dictionary in presets:
		var btn := Button.new()
		btn.text = p["label"]
		btn.tooltip_text = p["tip"]
		_editor.styles.style_cam_button(btn)
		btn.pressed.connect(p["callback"])
		vbox.add_child(btn)
	var grid_btn := Button.new()
	grid_btn.text = "Toggle Grid (G)"
	grid_btn.pressed.connect(toggle_grid)
	_editor.styles.style_cam_button(grid_btn)
	vbox.add_child(grid_btn)
	var help_btn := Button.new()
	help_btn.text = "Shortcuts (?)"
	help_btn.pressed.connect(_editor.show_help)
	_editor.styles.style_cam_button(help_btn)
	vbox.add_child(help_btn)


func process(delta: float) -> void:
	var pan := Vector3.ZERO
	if Input.is_key_pressed(KEY_W): pan.z -= 1
	if Input.is_key_pressed(KEY_S): pan.z += 1
	if Input.is_key_pressed(KEY_A): pan.x -= 1
	if Input.is_key_pressed(KEY_D): pan.x += 1
	if Input.is_key_pressed(KEY_Q): pan.y += 1
	if Input.is_key_pressed(KEY_E): pan.y -= 1
	if Input.is_key_pressed(KEY_UP): pan.z -= 1
	if Input.is_key_pressed(KEY_DOWN): pan.z += 1
	if Input.is_key_pressed(KEY_LEFT): pan.x -= 1
	if Input.is_key_pressed(KEY_RIGHT): pan.x += 1
	if pan != Vector3.ZERO:
		var speed := 6.0 if Input.is_key_pressed(KEY_SHIFT) else 2.0
		var cam_basis := _editor.editor_camera.global_transform.basis
		var move := (cam_basis.x * pan.x + cam_basis.z * pan.z).normalized() * cam_dist * speed * delta
		move.y = pan.y * cam_dist * speed * delta
		cam_target += move
		update_camera()


func handle_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		if Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
			cam_yaw -= event.relative.x * 0.4
			cam_pitch -= event.relative.y * 0.4
			cam_pitch = clampf(cam_pitch, 5.0, 85.0)
			update_camera()
		elif right_click_dragging:
			var cam_basis := _editor.editor_camera.global_transform.basis
			cam_target -= cam_basis.x * event.relative.x * cam_dist * 0.003
			cam_target += cam_basis.y * event.relative.y * cam_dist * 0.003
			update_camera()
	if event is InputEventMouseButton and (event.button_index == MOUSE_BUTTON_WHEEL_UP or event.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		var zoom_speed := 3.0 if Input.is_key_pressed(KEY_SHIFT) else 1.5
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(5.0, cam_dist - zoom_speed)
		else:
			cam_dist = minf(200.0, cam_dist + zoom_speed)
		update_camera()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT:
		if event.pressed:
			right_click_dragging = true
			right_click_start = event.position
		else:
			if right_click_dragging and event.position.distance_to(right_click_start) < 4.0 and not _editor.is_mouse_over_ui():
				_editor.placement.right_click_delete()
			right_click_dragging = false
	if event is InputEventKey and event.pressed:
		match event.keycode:
			KEY_F: focus_selected()
			KEY_G: toggle_grid()
			KEY_HOME: snap_to_start()
			KEY_F1: reset_view()
			KEY_F2: side_view()
			KEY_F3: top_view()
			KEY_F4: front_view()


func update_camera() -> void:
	var yaw := deg_to_rad(cam_yaw)
	var pitch := deg_to_rad(cam_pitch)
	var offset := Vector3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)) * cam_dist
	_editor.editor_camera.global_position = cam_target + offset
	_editor.editor_camera.look_at(cam_target, Vector3.UP)


func snap_to_start() -> void:
	cam_target = Vector3(0, 2, 0)
	update_camera()


func side_view() -> void:
	cam_yaw = 90.0
	cam_pitch = 10.0
	cam_dist = 35.0
	update_camera()


func top_view() -> void:
	cam_yaw = 0.0
	cam_pitch = 85.0
	cam_dist = 60.0
	update_camera()


func front_view() -> void:
	cam_yaw = 0.0
	cam_pitch = 15.0
	cam_dist = 40.0
	update_camera()


func reset_view() -> void:
	cam_target = Vector3(0, 2, -60)
	cam_yaw = 90.0
	cam_pitch = 10.0
	cam_dist = 35.0
	update_camera()


func focus_selected() -> void:
	if _editor.selected_node != null:
		cam_target = _editor.selected_node.global_position
		cam_dist = 20.0
		update_camera()


func toggle_grid() -> void:
	grid_visible = not grid_visible
	_editor.grid_visual.visible = grid_visible


func update_grid() -> void:
	var all_segs: Array = _editor.track.get_all_track_segments_dicts()
	var total_length := 0.0
	var max_width := TrackConstants.RUNWAY_WIDTH
	for seg: Variant in all_segs:
		if seg is Dictionary:
			total_length += float(seg.get("length", 20.0))
			max_width = maxf(max_width, float(seg.get("width", 8.0)))
	var mesh := _editor.grid_visual.mesh as PlaneMesh
	if mesh == null:
		mesh = PlaneMesh.new()
		_editor.grid_visual.mesh = mesh
	mesh.size = Vector2(max_width + 4.0, total_length + 4.0)
	mesh.center_offset = Vector3(0, 0, -total_length / 2.0)
	_editor.grid_visual.position = _editor.track_root.position
	_editor.grid_visual.visible = grid_visible

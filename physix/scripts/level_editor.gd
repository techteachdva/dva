extends Node3D

# Physix Level Editor — internal design tool + forward-compatible UGC pipeline.
# Inspired by Polytrack: build visually, export to a compact "level code" string.

# ── Palette item definitions ──────────────────────────────────────────────────
const PALETTE: Array[Dictionary] = [
	{ "id": "bumper",      "name": "Bumper",      "scene": "res://scenes/obstacles/bumper.tscn",      "category": "Obstacles" },
	{ "id": "boost",       "name": "Speed Boost", "scene": "res://scenes/obstacles/speed_boost.tscn",   "category": "Obstacles" },
	{ "id": "brake",       "name": "Brake Pad",   "scene": "res://scenes/obstacles/brake_pad.tscn",     "category": "Obstacles" },
	{ "id": "grav",        "name": "Gravity Zone","scene": "res://scenes/obstacles/gravity_zone.tscn",  "category": "Obstacles" },
	{ "id": "wind",        "name": "Wind Zone",   "scene": "res://scenes/obstacles/wind_zone.tscn",     "category": "Obstacles" },
	{ "id": "ice",         "name": "Ice Patch",   "scene": "res://scenes/obstacles/ice_patch.tscn",     "category": "Obstacles" },
	{ "id": "spike",       "name": "Spike Trap",  "scene": "res://scenes/obstacles/spike_trap.tscn",    "category": "Obstacles" },
	{ "id": "hoop_bonus",  "name": "Bonus Hoop",  "scene": "res://scenes/obstacles/hoop.tscn",        "category": "Obstacles" },
	{ "id": "hoop_cp",     "name": "Check Hoop",  "scene": "res://scenes/obstacles/hoop.tscn",        "category": "Obstacles" },
	{ "id": "move",        "name": "Moving Plat", "scene": "res://scenes/obstacles/moving_platform.tscn","category": "Obstacles" },
	{ "id": "cp",          "name": "Checkpoint",  "scene": "res://scenes/obstacles/checkpoint.tscn",    "category": "Obstacles" },
	{ "id": "tutorial",    "name": "Tutorial Trigger", "scene": "res://scenes/obstacles/tutorial_trigger.tscn", "category": "Obstacles" },
	{ "id": "coin",        "name": "Coin",        "scene": "res://scenes/coin.tscn",                    "category": "Collectibles" },
	{ "id": "finish",      "name": "Finish Zone", "scene": "",                                          "category": "Meta" },
]

const PATTERNS: Array[Dictionary] = [
	{ "id": "snake",    "name": "Snake",    "category": "Patterns" },
	{ "id": "gauntlet", "name": "Gauntlet", "category": "Patterns" },
	{ "id": "slalom",   "name": "Slalom",   "category": "Patterns" },
	{ "id": "tunnel",   "name": "Tunnel",   "category": "Patterns" },
]

# ── Editor state ──────────────────────────────────────────────────────────────
var selected_tool: String = ""
var selected_node: Node3D = null
var _risk_reward_mode: bool = false
var is_dragging: bool = false
var drag_plane: Plane
var drag_offset: Vector3

var cam_yaw: float = 0.0
var cam_pitch: float = 35.0
var cam_dist: float = 25.0
var cam_target: Vector3 = Vector3(0, 0, -150)

var snap_size: float = 1.0
var track_width: float = 8.0
var track_length: float = 150.0

var _last_saved_path: String = ""
var _import_mode: bool = false

var _undo_stack: Array[Dictionary] = []
var _undo_drag_start: Dictionary = {}
const MAX_UNDO := 50

var _semantic_snap: int = 0  # 0=auto, 1=floor, 2=low, 3=med, 4=high

# ── Track segment system ──────────────────────────────────────────────────────
enum EditorMode { TRACK, OBSTACLE, CHECKPOINT }
var _mode: EditorMode = EditorMode.TRACK
var _segments: Array[Dictionary] = []
var _selected_seg_index: int = -1
var _seg_timeline: HBoxContainer
var _mode_buttons: Array[Button] = []

const SEGMENT_TYPES: Dictionary = {
	"straight":   {"name": "Straight",   "length": 20, "width": 8,  "ramp": 0,  "bank": 0,  "ice": false},
	"ramp_up":    {"name": "Ramp Up",    "length": 20, "width": 8,  "ramp": 3,  "bank": 0,  "ice": false},
	"ramp_down":  {"name": "Ramp Down",  "length": 20, "width": 8,  "ramp": -3, "bank": 0,  "ice": false},
	"gap":        {"name": "Gap",        "length": 10, "width": 8,  "ramp": 0,  "bank": 0,  "ice": false},
	"ice":        {"name": "Ice",        "length": 20, "width": 8,  "ramp": 0,  "bank": 0,  "ice": true},
	"narrow":     {"name": "Narrow",     "length": 20, "width": 5,  "ramp": 0,  "bank": 0,  "ice": false},
	"wide":       {"name": "Wide",       "length": 20, "width": 12, "ramp": 0,  "bank": 0,  "ice": false},
	"bank_left":  {"name": "Bank Left",  "length": 20, "width": 8,  "ramp": 0,  "bank": 15, "ice": false},
	"bank_right": {"name": "Bank Right", "length": 20, "width": 8,  "ramp": 0,  "bank": -15,"ice": false},
}

const HOOP_HEIGHTS: Dictionary = {
	"ground": {"name": "Ground Hoop", "offset": 0.2},
	"mid":    {"name": "Mid Hoop",    "offset": 1.5},
	"high":   {"name": "High Hoop",   "offset": 3.0},
}

const START_RUNWAY_LENGTH := 30.0
const END_RUNWAY_LENGTH := 30.0
const RUNWAY_WIDTH := 10.0
const FINISH_ZONE_HALF_HEIGHT := 3.0

# ── Nodes ─────────────────────────────────────────────────────────────────────
@onready var editor_camera: Camera3D = $EditorCamera
@onready var editor_ui: CanvasLayer = $EditorUI
@onready var toolbar: HBoxContainer = $EditorUI/Toolbar
@onready var palette: VBoxContainer = $EditorUI/Palette/Content
@onready var props_panel: VBoxContainer = $EditorUI/PropertiesPanel
@onready var code_panel: Panel = $EditorUI/CodePanel
@onready var code_edit: TextEdit = $EditorUI/CodePanel/CodeEdit
@onready var level_root: Node3D = $EditorLevel
@onready var track_root: Node3D = $EditorLevel/TrackRoot
@onready var grid_visual: MeshInstance3D = $EditorLevel/GridVisual
@onready var selection_gizmo: Node3D = $EditorLevel/SelectionGizmo

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	# Default side-view camera (left-to-right track profile)
	cam_yaw = 90.0
	cam_pitch = 10.0
	cam_dist = 35.0
	cam_target = Vector3(0, 2, -60)
	# Default track segments
	_segments = [
		{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
		{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
		{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
	]
	_build_mode_buttons()
	_build_segment_timeline()
	_build_palette()
	_build_properties_ui()
	_update_camera()
	_update_grid()
	_hide_code_panel()
	# Connect toolbar
	$EditorUI/Toolbar/NewBtn.pressed.connect(_on_new)
	$EditorUI/Toolbar/SaveBtn.pressed.connect(_on_save)
	$EditorUI/Toolbar/LoadBtn.pressed.connect(_on_load)
	$EditorUI/Toolbar/ExportBtn.pressed.connect(_on_export)
	$EditorUI/Toolbar/ImportBtn.pressed.connect(_on_import)
	$EditorUI/Toolbar/TestBtn.pressed.connect(_on_test)
	$EditorUI/Toolbar/MenuBtn.pressed.connect(_on_menu)
	$EditorUI/CodePanel/CloseBtn.pressed.connect(_hide_code_panel)
	$EditorUI/CodePanel/CopyBtn.pressed.connect(_on_copy_code)
	_rebuild_track()


# ═══════════════════════════════════════════════════════════════════════════════
#  MODE & SEGMENT UI
# ═══════════════════════════════════════════════════════════════════════════════

func _build_mode_buttons() -> void:
	var container := HBoxContainer.new()
	container.name = "ModeButtons"
	container.anchor_left = 0.5
	container.anchor_right = 0.5
	container.anchor_top = 0.0
	container.offset_left = -180
	container.offset_right = 180
	container.offset_top = 10
	container.offset_bottom = 42
	container.alignment = BoxContainer.ALIGNMENT_CENTER
	container.add_theme_constant_override("separation", 8)
	editor_ui.add_child(container)

	var labels := ["Track", "Obstacles", "Checkpoints"]
	for i: int in range(labels.size()):
		var btn := Button.new()
		btn.text = labels[i]
		btn.toggle_mode = true
		btn.button_pressed = (i == 0)
		btn.pressed.connect(_set_mode.bind(i))
		container.add_child(btn)
		_mode_buttons.append(btn)

func _set_mode(idx: int) -> void:
	_mode = idx as EditorMode
	selected_tool = ""
	selected_node = null
	if _ghost_node != null:
		_ghost_node.queue_free()
		_ghost_node = null
	for i: int in range(_mode_buttons.size()):
		_mode_buttons[i].button_pressed = (i == idx)
	_build_palette()
	$EditorUI/Toolbar/StatusLabel.text = "Mode: %s" % ["Track", "Obstacles", "Checkpoints"][_mode]

func _build_segment_timeline() -> void:
	var scroll := ScrollContainer.new()
	scroll.name = "SegTimeline"
	scroll.anchor_left = 0.0
	scroll.anchor_right = 1.0
	scroll.anchor_top = 1.0
	scroll.anchor_bottom = 1.0
	scroll.offset_left = 160
	scroll.offset_right = -160
	scroll.offset_top = -56
	scroll.offset_bottom = -8
	scroll.horizontal_scroll_mode = 1
	scroll.vertical_scroll_mode = 0
	editor_ui.add_child(scroll)

	_seg_timeline = HBoxContainer.new()
	_seg_timeline.name = "SegTimelineContent"
	_seg_timeline.alignment = BoxContainer.ALIGNMENT_CENTER
	_seg_timeline.add_theme_constant_override("separation", 4)
	scroll.add_child(_seg_timeline)

func _refresh_segment_timeline() -> void:
	for child: Node in _seg_timeline.get_children():
		child.queue_free()
	for i: int in range(_segments.size()):
		var seg: Dictionary = _segments[i]
		var btn := Button.new()
		var type_name: String = SEGMENT_TYPES.get(seg["type"], {}).get("name", seg["type"])
		btn.text = "%d\n%s" % [i + 1, type_name]
		btn.custom_minimum_size = Vector2(64, 44)
		btn.toggle_mode = true
		btn.button_pressed = (i == _selected_seg_index)
		btn.pressed.connect(_select_segment.bind(i))
		if i == _selected_seg_index:
			btn.add_theme_color_override("font_color", Color(1.0, 0.85, 0.2, 1.0))
		_seg_timeline.add_child(btn)

func _select_segment(index: int) -> void:
	_selected_seg_index = index
	_refresh_segment_timeline()
	if _mode == EditorMode.TRACK and selected_tool != "":
		# Apply selected track type to this segment
		if index >= 0 and index < _segments.size():
			var params: Dictionary = SEGMENT_TYPES.get(selected_tool, {})
			if not params.is_empty():
				_segments[index] = {
					"type": selected_tool,
					"length": params.get("length", 20),
					"width": params.get("width", 8),
					"ramp": params.get("ramp", 0),
					"bank": params.get("bank", 0),
					"ice": params.get("ice", false),
				}
				_rebuild_track()
				_refresh_segment_timeline()


# ═══════════════════════════════════════════════════════════════════════════════
#  TRACK BUILDING
# ═══════════════════════════════════════════════════════════════════════════════

func _get_all_track_segments() -> Array[Dictionary]:
	var all_segs: Array[Dictionary] = []
	all_segs.append({
		"type": "start_runway", "length": START_RUNWAY_LENGTH, "width": RUNWAY_WIDTH,
		"ramp": 0, "bank": 0, "ice": false,
	})
	for seg: Dictionary in _segments:
		all_segs.append(seg.duplicate())
	all_segs.append({
		"type": "end_runway", "length": END_RUNWAY_LENGTH, "width": RUNWAY_WIDTH,
		"ramp": 0, "bank": 0, "ice": false,
	})
	return all_segs


func _rebuild_track() -> void:
	# Clear existing track geometry
	for child: Node in track_root.get_children():
		child.queue_free()

	var all_segs: Array[Dictionary] = _get_all_track_segments()

	var total_length := 0.0
	for seg: Dictionary in all_segs:
		total_length += seg.get("length", 20.0)
	track_root.transform.origin.z = -total_length / 2.0

	var current_z: float = 0.0
	var current_y: float = 0.0
	var last_seg_x: float = 0.0
	var index: int = 0

	for seg: Dictionary in all_segs:
		var length: float = seg.get("length", 20.0)
		var width: float = seg.get("width", 8.0)
		var ramp: float = seg.get("ramp", 0.0)
		var bank: float = seg.get("bank", 0.0)
		var is_ice: bool = seg.get("ice", false)
		var is_gap: bool = seg.get("type", "") == "gap"

		var cz := current_z - length / 2.0
		var seg_x: float = seg.get("x", 0.0)
		var seg_y: float = current_y + seg.get("y", 0.0)
		var center_y := seg_y + ramp * 0.5
		var ramp_angle := atan(ramp / length) if absf(ramp) > 0.01 else 0.0
		var bank_angle := deg_to_rad(bank)

		if not is_gap:
			var body := StaticBody3D.new()
			body.name = "Seg_%d" % index
			body.position = Vector3(seg_x, center_y, cz)
			body.rotation = Vector3(ramp_angle, 0, bank_angle)
			track_root.add_child(body)
			body.owner = level_root

			var mesh_inst := MeshInstance3D.new()
			mesh_inst.name = "SegMesh"
			var mesh := BoxMesh.new()
			mesh.size = Vector3(width, 0.4, length)
			mesh_inst.mesh = mesh
			mesh_inst.set_meta("mat_type", "ice" if is_ice else "track")
			body.add_child(mesh_inst)
			mesh_inst.owner = level_root

			var col := CollisionShape3D.new()
			col.name = "SegShape"
			var shape := BoxShape3D.new()
			shape.size = Vector3(width, 0.4, length)
			col.shape = shape
			body.add_child(col)
			col.owner = level_root

			if is_ice:
				var ice_mat := PhysicsMaterial.new()
				ice_mat.friction = 0.005
				ice_mat.bounce = 0.05
				body.physics_material_override = ice_mat

			var wh := 1.5
			for side: int in [-1, 1]:
				var wall := StaticBody3D.new()
				wall.name = "Wall_%s_%d" % ["L" if side == -1 else "R", index]
				var wall_local_y: float = wh * 0.5 + 0.2
				wall.position = Vector3(side * (width * 0.5 + 0.15), wall_local_y, 0)
				body.add_child(wall)
				wall.owner = level_root

				var wmesh := MeshInstance3D.new()
				var wbox := BoxMesh.new()
				wbox.size = Vector3(0.3, wh, length)
				wmesh.mesh = wbox
				wmesh.set_meta("mat_type", "wall")
				wall.add_child(wmesh)
				wmesh.owner = level_root

				var wcol := CollisionShape3D.new()
				var wshp := BoxShape3D.new()
				wshp.size = Vector3(0.3, wh, length)
				wcol.shape = wshp
				wall.add_child(wcol)
				wcol.owner = level_root

		current_z -= length
		current_y = seg_y + ramp
		last_seg_x = seg_x
		index += 1

	# Finish zone snaps to the trailing edge of the end runway at track height
	var finish := Area3D.new()
	finish.name = "FinishZone"
	finish.position = Vector3(
		last_seg_x,
		current_y + FINISH_ZONE_HALF_HEIGHT,
		current_z,
	)
	track_root.add_child(finish)
	finish.owner = level_root

	var fshape := CollisionShape3D.new()
	var fbox := BoxShape3D.new()
	fbox.size = Vector3(16, 6.0, 20.0)
	fshape.shape = fbox
	finish.add_child(fshape)
	fshape.owner = level_root

	var fmesh := MeshInstance3D.new()
	var fbox_mesh := BoxMesh.new()
	fbox_mesh.size = Vector3(16, 6.0, 0.1)
	fmesh.mesh = fbox_mesh
	fmesh.set_meta("mat_type", "finish")
	finish.add_child(fmesh)
	fmesh.owner = level_root

	# Apply materials
	var builder: Node = track_root.get_node_or_null("TrackBuilder")
	if builder == null:
		builder = preload("res://scripts/track_builder.gd").new()
		builder.name = "TrackBuilder"
		track_root.add_child(builder)
	if builder.has_method("_apply_materials"):
		builder._apply_materials(track_root)

	_update_grid()

func _get_track_surface_y(world_pos: Vector3) -> float:
	# Raycast straight down from above to find track surface
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.new()
	query.from = world_pos + Vector3(0, 50, 0)
	query.to = world_pos + Vector3(0, -50, 0)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	var result := space.intersect_ray(query)
	if not result.is_empty():
		return result["position"].y
	return 0.22


# ═══════════════════════════════════════════════════════════════════════════════
#  CAMERA
# ═══════════════════════════════════════════════════════════════════════════════

func _unhandled_input(event: InputEvent) -> void:
	# Camera orbit with middle mouse
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
		cam_yaw   -= event.relative.x * 0.4
		cam_pitch -= event.relative.y * 0.4
		cam_pitch = clampf(cam_pitch, 5.0, 85.0)
		_update_camera()

	# Camera zoom with scroll
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_WHEEL_UP:
		cam_dist = maxf(5.0, cam_dist - 1.5)
		_update_camera()
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		cam_dist = minf(200.0, cam_dist + 1.5)
		_update_camera()

	# Place object on click
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		if not is_dragging and not _is_mouse_over_ui():
			var ray := _mouse_ray(event.position)
			if selected_tool.is_empty():
				# Select mode
				_try_select(ray)
			else:
				# Place mode
				_place_at_ray(ray)

	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and not event.pressed:
		if is_dragging and selected_node != null and _undo_drag_start.has("node"):
			var start: Dictionary = _undo_drag_start
			if start["node"] == selected_node and (start["old_pos"] != selected_node.global_position or start["old_rot"] != selected_node.global_rotation_degrees):
				_push_undo({
					"type": "move",
					"node": selected_node,
					"old_pos": start["old_pos"],
					"old_rot": start["old_rot"],
				})
		is_dragging = false
		_undo_drag_start = {}

	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_RIGHT and event.pressed:
		if selected_node != null and not _is_mouse_over_ui():
			_delete_selected()

	# Delete key
	if event is InputEventKey and event.pressed and event.keycode == KEY_DELETE:
		_delete_selected()

	# Undo
	if event is InputEventKey and event.pressed and event.keycode == KEY_Z and event.ctrl_pressed:
		_undo()

	# Escape clears tool
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		_select_tool("")


func _mouse_ray(screen_pos: Vector2) -> Dictionary:
	var origin := editor_camera.project_ray_origin(screen_pos)
	var dir    := editor_camera.project_ray_normal(screen_pos)
	return {"origin": origin, "dir": dir}


func _update_camera() -> void:
	var yaw   := deg_to_rad(cam_yaw)
	var pitch := deg_to_rad(cam_pitch)
	var offset := Vector3(
		cos(pitch) * sin(yaw),
		sin(pitch),
		cos(pitch) * cos(yaw)
	) * cam_dist
	editor_camera.global_position = cam_target + offset
	editor_camera.look_at(cam_target, Vector3.UP)


func _is_mouse_over_ui() -> bool:
	var mp := get_viewport().get_mouse_position()
	var pal_rect: Rect2 = $EditorUI/Palette.get_global_rect()
	var prop_rect: Rect2 = $EditorUI/PropertiesPanel.get_global_rect()
	var tool_rect: Rect2 = $EditorUI/Toolbar.get_global_rect()
	var code_rect: Rect2 = $EditorUI/CodePanel.get_global_rect()
	var mode_rect: Rect2 = Rect2()
	var mode_btns: Node = editor_ui.get_node_or_null("ModeButtons")
	if mode_btns:
		mode_rect = mode_btns.get_global_rect()
	var timeline_rect: Rect2 = Rect2()
	var timeline: Node = editor_ui.get_node_or_null("SegTimeline")
	if timeline:
		timeline_rect = timeline.get_global_rect()
	return pal_rect.has_point(mp) or prop_rect.has_point(mp) or tool_rect.has_point(mp) or mode_rect.has_point(mp) or timeline_rect.has_point(mp) or (code_rect.has_point(mp) and code_panel.visible)


# ═══════════════════════════════════════════════════════════════════════════════
#  PALETTE
# ═══════════════════════════════════════════════════════════════════════════════

func _build_palette() -> void:
	# Clear existing palette children
	for child: Node in palette.get_children():
		child.queue_free()

	match _mode:
		EditorMode.TRACK:
			var title := Label.new()
			title.text = "Track Types"
			title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			palette.add_child(title)
			for key: String in SEGMENT_TYPES.keys():
				var info: Dictionary = SEGMENT_TYPES[key]
				var btn := Button.new()
				btn.text = info["name"]
				btn.custom_minimum_size = Vector2(120, 36)
				btn.pressed.connect(_select_tool.bind(key))
				palette.add_child(btn)
			palette.add_child(HSeparator.new())
			var add_btn := Button.new()
			add_btn.text = "+ Add Segment"
			add_btn.pressed.connect(_add_segment)
			palette.add_child(add_btn)
			var rem_btn := Button.new()
			rem_btn.text = "- Remove Segment"
			rem_btn.pressed.connect(_remove_segment)
			palette.add_child(rem_btn)
			var snap_lbl := Label.new()
			snap_lbl.text = "Snap: %.1f" % snap_size
			snap_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			palette.add_child(snap_lbl)
			var snap_spin := SpinBox.new()
			snap_spin.min_value = 0.1
			snap_spin.max_value = 10.0
			snap_spin.step = 0.1
			snap_spin.value = snap_size
			snap_spin.value_changed.connect(func(v: float):
				snap_size = v
				snap_lbl.text = "Snap: %.1f" % snap_size
			)
			palette.add_child(snap_spin)

		EditorMode.OBSTACLE:
			var title := Label.new()
			title.text = "Obstacles"
			title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			palette.add_child(title)
			for item: Dictionary in PALETTE:
				if item["category"] == "Obstacles" and not item["id"].begins_with("hoop"):
					var btn := Button.new()
					btn.text = item["name"]
					btn.custom_minimum_size = Vector2(120, 36)
					btn.pressed.connect(_select_tool.bind(item["id"]))
					palette.add_child(btn)
			palette.add_child(HSeparator.new())
			var coin_title := Label.new()
			coin_title.text = "Collectibles"
			coin_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			palette.add_child(coin_title)
			var coin_btn := Button.new()
			coin_btn.text = "Coin"
			coin_btn.custom_minimum_size = Vector2(120, 36)
			coin_btn.pressed.connect(_select_tool.bind("coin"))
			palette.add_child(coin_btn)
			var risk_btn := CheckButton.new()
			risk_btn.text = "Danger Coins"
			risk_btn.toggled.connect(func(v: bool): _risk_reward_mode = v)
			palette.add_child(risk_btn)

		EditorMode.CHECKPOINT:
			var title := Label.new()
			title.text = "Checkpoints"
			title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			palette.add_child(title)
			for key: String in HOOP_HEIGHTS.keys():
				var info: Dictionary = HOOP_HEIGHTS[key]
				var btn := Button.new()
				btn.text = info["name"]
				btn.custom_minimum_size = Vector2(120, 36)
				btn.pressed.connect(_select_tool.bind("hoop_" + key))
				palette.add_child(btn)
			palette.add_child(HSeparator.new())
			var coin_btn := Button.new()
			coin_btn.text = "Coin"
			coin_btn.custom_minimum_size = Vector2(120, 36)
			coin_btn.pressed.connect(_select_tool.bind("coin"))
			palette.add_child(coin_btn)

func _add_segment() -> void:
	_segments.append({"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false})
	_selected_seg_index = _segments.size() - 1
	_rebuild_track()
	_refresh_segment_timeline()

func _remove_segment() -> void:
	if _segments.size() <= 1:
		return
	var idx := _selected_seg_index
	if idx < 0 or idx >= _segments.size():
		idx = _segments.size() - 1
	_segments.remove_at(idx)
	_selected_seg_index = clampi(idx - 1, 0, _segments.size() - 1)
	_rebuild_track()
	_refresh_segment_timeline()


func _push_undo(action: Dictionary) -> void:
	_undo_stack.append(action)
	if _undo_stack.size() > MAX_UNDO:
		_undo_stack.pop_front()

func _undo() -> void:
	if _undo_stack.is_empty():
		return
	var action: Dictionary = _undo_stack.pop_back()
	match action.get("type", ""):
		"place":
			var node: Node = action.get("node")
			if is_instance_valid(node):
				node.queue_free()
				if selected_node == node:
					selected_node = null
					_update_selection_gizmo()
					_update_properties_ui()
		"delete":
			var node: Node = action.get("node")
			var parent: Node = action.get("parent")
			if not is_instance_valid(node) or parent == null:
				return
			parent.add_child(node)
			node.owner = level_root
			selected_node = node
			_update_selection_gizmo()
			_update_properties_ui()
		"move":
			var node: Node = action.get("node")
			if is_instance_valid(node):
				node.global_position = action.get("old_pos", node.global_position)
				node.global_rotation_degrees = action.get("old_rot", node.global_rotation_degrees)
				_update_selection_gizmo()
				_update_properties_ui()

func _select_tool(id: String) -> void:
	selected_tool = id
	selected_node = null
	if _ghost_node != null:
		_ghost_node.queue_free()
		_ghost_node = null
	_update_selection_gizmo()
	_update_properties_ui()
	# Update cursor hint
	$EditorUI/Toolbar/StatusLabel.text = "Tool: %s" % (id if not id.is_empty() else "Select")


# ═══════════════════════════════════════════════════════════════════════════════
#  PLACEMENT
# ═══════════════════════════════════════════════════════════════════════════════

var _ghost_node: Node3D = null

func _process(delta: float) -> void:
	# Smooth continuous camera pan with WASD / arrows / Q / E
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
		var cam_basis := editor_camera.global_transform.basis
		var move := (cam_basis.x * pan.x + cam_basis.z * pan.z).normalized() * cam_dist * speed * delta
		move.y = pan.y * cam_dist * speed * delta
		cam_target += move
		_update_camera()

	if is_dragging and selected_node != null:
		var ray := _mouse_ray(get_viewport().get_mouse_position())
		var hit: Variant = drag_plane.intersects_ray(ray["origin"], ray["dir"])
		if hit != null:
			var new_pos := _snap_position(hit + drag_offset)
			selected_node.global_position = new_pos
			_update_selection_gizmo()
			_update_properties_ui_from_node()
		return

	# Update placement ghost when a tool is active
	if not selected_tool.is_empty() and not _is_mouse_over_ui():
		_update_ghost()
	elif _ghost_node != null:
		_ghost_node.queue_free()
		_ghost_node = null


func _update_ghost() -> void:
	var ray := _mouse_ray(get_viewport().get_mouse_position())
	var hit := _raycast_ground(ray)
	if not hit["hit"]:
		if _ghost_node != null:
			_ghost_node.visible = false
		return

	var pos := _snap_position(hit["pos"])
	if selected_tool.begins_with("hoop_"):
		var height_key := selected_tool.substr(5)
		pos.y = _get_track_surface_y(pos) + HOOP_HEIGHTS.get(height_key, {}).get("offset", 1.5)
	elif selected_tool == "coin":
		pos.y = _get_track_surface_y(pos) + 1.5
	if _ghost_node == null:
		_ghost_node = _create_ghost()
		if _ghost_node == null:
			return
		level_root.add_child(_ghost_node)
	_ghost_node.visible = true
	_ghost_node.global_position = pos


func _create_ghost() -> Node3D:
	match selected_tool:
		"finish":
			var g := Area3D.new()
			var s := CollisionShape3D.new()
			var b := BoxShape3D.new()
			b.size = Vector3(track_width, 4.0, 10.0)
			s.shape = b
			g.add_child(s)
			return g
		"coin":
			var g := MeshInstance3D.new()
			var c := CylinderMesh.new()
			c.height = 0.08
			c.top_radius = 0.35
			c.bottom_radius = 0.35
			g.mesh = c
			return g
		"hoop_ground", "hoop_mid", "hoop_high":
			var g := MeshInstance3D.new()
			var torus := TorusMesh.new()
			torus.inner_radius = 1.4
			torus.outer_radius = 1.8
			torus.ring_segments = 6
			g.mesh = torus
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.5, 1.0, 0.5, 0.5)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			g.material_override = mat
			return g
		_:
			for item: Dictionary in PALETTE:
				if item["id"] == selected_tool and not item["scene"].is_empty():
					var sc := load(item["scene"]) as PackedScene
					if sc == null:
						return null
					var node := sc.instantiate()
					# Make it semi-transparent
					_set_ghost_material(node)
					return node
	return null


func _set_ghost_material(node: Node3D) -> void:
	for child: Node in node.get_children():
		if child is MeshInstance3D:
			if child.mesh != null:
				var mat := StandardMaterial3D.new()
				mat.albedo_color = Color(0.5, 1.0, 0.5, 0.5)
				mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
				child.material_override = mat
		if child is Node3D:
			_set_ghost_material(child)


func _semantic_snap_y(base_y: float) -> float:
	match _semantic_snap:
		1: return 0.0   # Floor
		2: return 1.7   # Low
		3: return 3.5   # Medium
		4: return 5.0   # High
		_: return base_y

func _place_at_ray(ray: Dictionary) -> void:
	var hit: Dictionary = _raycast_ground(ray)
	if not hit["hit"]:
		return

	var pos := _snap_position(hit["pos"])
	var node: Node = null
	if selected_tool.begins_with("hoop_"):
		var height_key := selected_tool.substr(5)
		var offset: float = HOOP_HEIGHTS.get(height_key, {}).get("offset", 1.5)
		pos.y = _get_track_surface_y(pos) + offset
		node = _place_hoop(pos, height_key == "ground")
	elif selected_tool == "coin":
		pos.y = _get_track_surface_y(pos) + 1.5
		node = _place_coin(pos)
	elif selected_tool == "finish":
		_rebuild_track()
		return
	elif selected_tool in ["snake", "gauntlet", "slalom", "tunnel"]:
		node = _place_pattern(selected_tool, pos)
	else:
		pos.y = _get_track_surface_y(pos) + 0.22
		node = _place_obstacle(selected_tool, pos)
	if node != null:
		_push_undo({"type": "place", "node": node})


func _raycast_ground(ray: Dictionary) -> Dictionary:
	# Try physics raycast first — accept any hit so placement works on floor, walls, or existing objects
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.new()
	query.from = ray["origin"]
	query.to = ray["origin"] + ray["dir"] * 500.0
	query.collide_with_areas = true
	query.collide_with_bodies = true
	var result := space.intersect_ray(query)
	if not result.is_empty():
		return {"hit": true, "pos": result["position"]}

	# Fallback: intersect with the XZ plane at y = 0.
	# If the ray is parallel (horizontal), nudge the origin slightly downward
	# so the plane intersection always succeeds.
	var origin: Vector3 = ray["origin"]
	var dir: Vector3 = ray["dir"]
	if absf(dir.y) < 0.001:
		origin.y += 1.0
		dir.y = -0.1
		if dir.length_squared() < 0.001:
			dir = Vector3(0.0, -1.0, 0.0)
	var plane := Plane(Vector3.UP, 0.0)
	var t: Variant = plane.intersects_ray(origin, dir)
	if t != null:
		var clamped := Vector3(
			clampf(t.x, -track_width * 0.6, track_width * 0.6),
			t.y,
			clampf(t.z, -track_length, 0.0)
		)
		return {"hit": true, "pos": clamped}
	return {"hit": false}


func _snap_position(pos: Vector3) -> Vector3:
	if snap_size <= 0:
		return pos
	return Vector3(
		snappedf(pos.x, snap_size),
		snappedf(pos.y, snap_size),
		snappedf(pos.z, snap_size)
	)


func _place_obstacle(tool_id: String, pos: Vector3) -> Node:
	for item: Dictionary in PALETTE:
		if item["id"] == tool_id and not item["scene"].is_empty():
			var scene := load(item["scene"]) as PackedScene
			if scene == null:
				return null
			var node := scene.instantiate()
			var local_pos := track_root.to_local(pos)
			node.transform.origin = local_pos
			track_root.add_child(node)
			node.owner = level_root
			return node
	return null

func _place_hoop(pos: Vector3, is_checkpoint: bool) -> Node:
	var scene := load("res://scenes/obstacles/hoop.tscn") as PackedScene
	if scene == null:
		return null
	var node: Node = scene.instantiate()
	if node.has_method("set"):
		node.set("hoop_type", 0 if is_checkpoint else 1)
	var local_pos := track_root.to_local(pos)
	node.transform.origin = local_pos
	track_root.add_child(node)
	node.owner = level_root
	return node

func _place_finish(pos: Vector3) -> Node:
	var existing: Node = track_root.get_node_or_null("FinishZone")
	if existing:
		existing.queue_free()
	var finish := Area3D.new()
	finish.name = "FinishZone"
	var finish_y := pos.y if _semantic_snap > 0 else 3.0
	finish.transform.origin = track_root.to_local(Vector3(pos.x, finish_y, pos.z))
	track_root.add_child(finish)
	finish.owner = level_root

	# Big forgiving finish zone: wide, tall, deep
	var shape := CollisionShape3D.new()
	shape.name = "FinishShape"
	var box := BoxShape3D.new()
	box.size = Vector3(track_width + 4.0, 6.0, 20.0)
	shape.shape = box
	finish.add_child(shape)
	shape.owner = level_root

	var mesh := MeshInstance3D.new()
	mesh.name = "FinishMesh"
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(track_width + 4.0, 6.0, 0.1)
	mesh.mesh = box_mesh
	mesh.set_meta("mat_type", "finish")
	finish.add_child(mesh)
	mesh.owner = level_root

	# Extend floor past finish so the track doesn't end anticlimactically
	_add_runway(finish.transform.origin.z)
	return finish

func _add_runway(finish_local_z: float) -> void:
	# Remove existing runway if any
	var existing: Node = track_root.get_node_or_null("Runway")
	if existing:
		existing.queue_free()
	var runway_length: float = 30.0
	var body := StaticBody3D.new()
	body.name = "Runway"
	body.transform.origin = Vector3(0, 0, finish_local_z - 10.0 - runway_length * 0.5)
	track_root.add_child(body)
	body.owner = level_root

	var mesh_inst := MeshInstance3D.new()
	mesh_inst.name = "RunwayMesh"
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(track_width, 0.4, runway_length)
	mesh_inst.mesh = box_mesh
	mesh_inst.set_meta("mat_type", "track")
	body.add_child(mesh_inst)
	mesh_inst.owner = level_root

	var col := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(track_width, 0.4, runway_length)
	col.shape = box_shape
	body.add_child(col)
	col.owner = level_root

	# Walls on runway
	var wh := 1.5
	for side in [-1, 1]:
		var wall := StaticBody3D.new()
		wall.name = "RunwayWall%s" % ["L" if side == -1 else "R"]
		wall.position = Vector3(side * (track_width * 0.5 + 0.15), wh * 0.5 + 0.2, 0)
		body.add_child(wall)
		wall.owner = level_root
		var wmesh := MeshInstance3D.new()
		var wbox := BoxMesh.new()
		wbox.size = Vector3(0.3, wh, runway_length)
		wmesh.mesh = wbox
		wmesh.set_meta("mat_type", "wall")
		wall.add_child(wmesh)
		wmesh.owner = level_root
		var wcol := CollisionShape3D.new()
		var wshp := BoxShape3D.new()
		wshp.size = Vector3(0.3, wh, runway_length)
		wcol.shape = wshp
		wall.add_child(wcol)
		wcol.owner = level_root

# ═══════════════════════════════════════════════════════════════════════════════
#  PATTERN PRESETS
# ═══════════════════════════════════════════════════════════════════════════════

func _place_pattern(pat_id: String, origin: Vector3) -> Node:
	var last_node: Node = null
	match pat_id:
		"snake":
			for i: int in range(5):
				var side := -1.0 if i % 2 == 0 else 1.0
				var pos := Vector3(side * 2.5, 1.0, origin.z + i * 8.0)
				last_node = _instantiate_obstacle("bumper", pos)
		"gauntlet":
			for i: int in range(6):
				var side := -1.0 if i % 2 == 0 else 1.0
				var pos := Vector3(side * 1.5, 1.0, origin.z + i * 4.0)
				last_node = _instantiate_obstacle("bumper", pos)
		"slalom":
			for i: int in range(5):
				var side := -1.0 if i % 2 == 0 else 1.0
				var z := origin.z + i * 6.0
				if i % 2 == 0:
					last_node = _instantiate_obstacle("bumper", Vector3(side * 2.0, 1.0, z))
				else:
					last_node = _instantiate_obstacle("ice", Vector3(side * 1.5, 0.2, z))
		"tunnel":
			var tunnel_length := 40.0
			var half_w := track_width / 2.0 + 0.5
			last_node = _instantiate_obstacle("wind", Vector3(-half_w, 1.0, origin.z + tunnel_length / 2.0), Vector3(0, 0, 0), {"wf": 8.0, "wd": [1, 0, 0]})
			_instantiate_obstacle("wind", Vector3(half_w, 1.0, origin.z + tunnel_length / 2.0), Vector3(0, 0, 0), {"wf": 8.0, "wd": [-1, 0, 0]})
	return last_node


func _instantiate_obstacle(tool_id: String, pos: Vector3, rot: Vector3 = Vector3.ZERO, props: Dictionary = {}) -> Node:
	for item: Dictionary in PALETTE:
		if item["id"] == tool_id and not item["scene"].is_empty():
			var scene := load(item["scene"]) as PackedScene
			if scene == null:
				return null
			var node := scene.instantiate()
			var local_pos := track_root.to_local(pos)
			# Keep objects on/near the track surface instead of floating
			var surface_y: float = 0.22
			local_pos.y = maxf(local_pos.y, surface_y)
			node.transform.origin = local_pos
			node.rotation_degrees = rot
			for key: String in props.keys():
				match key:
					"wf":
						if node.get("wind_force") != null:
							node.set("wind_force", props[key])
					"wd":
						if node.get("wind_direction") != null:
							node.set("wind_direction", Vector3(props[key][0], props[key][1], props[key][2]))
					_:
						node.set(key, props[key])
			track_root.add_child(node)
			node.owner = level_root
			return node
	return null


# ═══════════════════════════════════════════════════════════════════════════════
#  RISK / REWARD COINS
# ═══════════════════════════════════════════════════════════════════════════════

func _place_coin(pos: Vector3) -> Node:
	var scene := load("res://scenes/coin.tscn") as PackedScene
	if scene == null:
		return null
	var coins_node: Node = track_root.get_node_or_null("Coins")
	if coins_node == null:
		coins_node = Node3D.new()
		coins_node.name = "Coins"
		track_root.add_child(coins_node)
		coins_node.owner = level_root
	var coin := scene.instantiate()
	var place_pos := pos
	if _risk_reward_mode:
		place_pos = _get_risk_reward_pos(pos)
	coin.transform.origin = track_root.to_local(place_pos)
	var idx := coins_node.get_child_count() + 1
	coin.name = "Coin%d" % idx
	coins_node.add_child(coin)
	coin.owner = level_root
	return coin


func _get_risk_reward_pos(fallback: Vector3) -> Vector3:
	var nearest: Node3D = null
	var nearest_dist: float = 9999.0
	for child: Node in track_root.get_children():
		if child == null or child.name == "Floor" or child.name == "Coins" or child.name.begins_with("Wall"):
			continue
		var d: float = child.global_position.distance_to(fallback)
		if d < nearest_dist and d < 16.0:
			nearest_dist = d
			nearest = child
	if nearest == null:
		return fallback
	var type := _obstacle_type_key(nearest)
	var p := nearest.global_position
	match type:
		"bumper":
			# Coin in the narrow gap between bumper and center path
			var side := signf(p.x)
			if side == 0.0:
				side = 1.0
			return Vector3(side * 1.2, 1.7, p.z + 2.5)
		"boost":
			# Coin after boost where momentum makes collection harder
			return Vector3(p.x * 0.5, 1.7, p.z + 8.0)
		"brake":
			# Coin after brake pad where re-acceleration is needed
			return Vector3(p.x * 0.5, 1.7, p.z + 5.0)
		"wind":
			# Coin near the edge of wind zone
			var side := signf(p.x)
			if side == 0.0:
				side = 1.0
			return Vector3(p.x - side * 1.5, 1.7, p.z)
		"ice":
			# Coin in the middle of ice patch (slippery)
			return Vector3(p.x * 0.3, 1.7, p.z + 3.0)
		"move":
			# Coin slightly ahead of moving platform
			return Vector3(p.x * 0.5, 1.7, p.z + 4.0)
		_:
			return Vector3(p.x * 0.6, 1.7, p.z + 3.0)


func _obstacle_type_key(node: Node) -> String:
	var script: Script = node.get_script()
	if script:
		var path: String = script.resource_path
		if path.contains("bumper"):       return "bumper"
		if path.contains("speed_boost"):  return "boost"
		if path.contains("brake_pad"):    return "brake"
		if path.contains("gravity_zone"): return "grav"
		if path.contains("wind_zone"):    return "wind"
		if path.contains("ice_patch"):    return "ice"
		if path.contains("moving_platform"): return "move"
		if path.contains("checkpoint"):   return "cp"
	return ""


# ═══════════════════════════════════════════════════════════════════════════════
#  SELECTION & GIZMO
# ═══════════════════════════════════════════════════════════════════════════════

func _try_select(ray: Dictionary) -> void:
	var space := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.new()
	query.from = ray["origin"]
	query.to   = ray["origin"] + ray["dir"] * 500.0
	query.collide_with_areas = true
	query.collide_with_bodies = true
	var result := space.intersect_ray(query)
	if result.is_empty():
		selected_node = null
		_update_selection_gizmo()
		_update_properties_ui()
		return

	var collider: Node3D = result["collider"]
	# Walk up to find the root obstacle / coin node
	var target: Node3D = collider
	while target != null and target != track_root and target != level_root:
		if target.get_parent() == track_root:
			break
		if target.get_parent() != null and target.get_parent().name == "Coins":
			break
		target = target.get_parent() as Node3D
	if target == track_root or target == level_root:
		selected_node = null
	else:
		selected_node = target
		# Start drag if we clicked the selected object
		is_dragging = true
		_undo_drag_start = {
			"node": selected_node,
			"old_pos": selected_node.global_position,
			"old_rot": selected_node.global_rotation_degrees,
		}
		drag_plane = Plane(Vector3.UP, selected_node.global_position.y)
		var hit: Variant = drag_plane.intersects_ray(ray["origin"], ray["dir"])
		if hit != null:
			drag_offset = selected_node.global_position - hit
	_update_selection_gizmo()
	_update_properties_ui()


func _delete_selected() -> void:
	if selected_node == null:
		return
	var parent := selected_node.get_parent()
	if parent != null:
		parent.remove_child(selected_node)
		_push_undo({"type": "delete", "node": selected_node, "parent": parent})
	else:
		selected_node.queue_free()
	selected_node = null
	_update_selection_gizmo()
	_update_properties_ui()


func _update_selection_gizmo() -> void:
	if selected_node == null:
		selection_gizmo.visible = false
		return
	selection_gizmo.visible = true
	selection_gizmo.global_position = selected_node.global_position


# ═══════════════════════════════════════════════════════════════════════════════
#  PROPERTIES PANEL
# ═══════════════════════════════════════════════════════════════════════════════

var _prop_spinboxes: Dictionary = {}

func _build_properties_ui() -> void:
	var grid := GridContainer.new()
	grid.columns = 2
	props_panel.add_child(grid)
	var labels := ["Pos X", "Pos Y", "Pos Z", "Rot X", "Rot Y", "Rot Z"]
	for lbl: String in labels:
		var label := Label.new()
		label.text = lbl
		grid.add_child(label)
		var spin := SpinBox.new()
		spin.min_value = -9999.0
		spin.max_value = 9999.0
		spin.step = 0.1
		spin.custom_minimum_size = Vector2(80, 0)
		spin.value_changed.connect(_on_prop_changed.bind(lbl))
		grid.add_child(spin)
		_prop_spinboxes[lbl] = spin


func _update_properties_ui() -> void:
	if selected_node == null:
		for spin: SpinBox in _prop_spinboxes.values():
			spin.editable = false
		return
	for spin: SpinBox in _prop_spinboxes.values():
		spin.editable = true
	_update_properties_ui_from_node()


func _update_properties_ui_from_node() -> void:
	if selected_node == null:
		return
	_prop_spinboxes["Pos X"].value = snappedf(selected_node.position.x, 0.01)
	_prop_spinboxes["Pos Y"].value = snappedf(selected_node.position.y, 0.01)
	_prop_spinboxes["Pos Z"].value = snappedf(selected_node.position.z, 0.01)
	_prop_spinboxes["Rot X"].value = snappedf(selected_node.rotation_degrees.x, 0.1)
	_prop_spinboxes["Rot Y"].value = snappedf(selected_node.rotation_degrees.y, 0.1)
	_prop_spinboxes["Rot Z"].value = snappedf(selected_node.rotation_degrees.z, 0.1)


func _on_prop_changed(_val: float, label: String) -> void:
	if selected_node == null:
		return
	match label:
		"Pos X": selected_node.position.x = _prop_spinboxes[label].value
		"Pos Y": selected_node.position.y = _prop_spinboxes[label].value
		"Pos Z": selected_node.position.z = _prop_spinboxes[label].value
		"Rot X": selected_node.rotation_degrees.x = _prop_spinboxes[label].value
		"Rot Y": selected_node.rotation_degrees.y = _prop_spinboxes[label].value
		"Rot Z": selected_node.rotation_degrees.z = _prop_spinboxes[label].value
	_update_selection_gizmo()


# ═══════════════════════════════════════════════════════════════════════════════
#  TOOLBAR ACTIONS
# ═══════════════════════════════════════════════════════════════════════════════

func _on_new() -> void:
	for child: Node in track_root.get_children():
		child.queue_free()
	selected_node = null
	_update_selection_gizmo()
	_update_properties_ui()
	_segments = [
		{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
		{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
		{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false},
	]
	_selected_seg_index = -1
	_mode = EditorMode.TRACK
	_build_palette()
	_refresh_segment_timeline()
	_rebuild_track()
	cam_target = Vector3(0, 2, -60)
	cam_yaw = 90.0
	cam_pitch = 10.0
	cam_dist = 35.0
	_update_camera()
	_last_saved_path = ""


func _on_save() -> void:
	var dialog := FileDialog.new()
	dialog.file_mode = FileDialog.FILE_MODE_SAVE_FILE
	dialog.add_filter("*.json", "Level JSON")
	dialog.current_path = _last_saved_path if not _last_saved_path.is_empty() else "user://custom_level.json"
	dialog.file_selected.connect(func(path: String):
		var data := LevelSerializer.export_level(level_root)
		data["segs"] = _segments.duplicate(true)
		data["mid_only"] = true
		var file := FileAccess.open(path, FileAccess.WRITE)
		if file:
			file.store_string(JSON.stringify(data))
			_last_saved_path = path
	)
	add_child(dialog)
	dialog.popup_centered(Vector2(800, 600))


func _on_load() -> void:
	var dialog := FileDialog.new()
	dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
	dialog.add_filter("*.json", "Level JSON")
	dialog.current_path = "user://"
	dialog.file_selected.connect(func(path: String):
		var file := FileAccess.open(path, FileAccess.READ)
		if file:
			var text: String = file.get_as_text()
			var parsed: Variant = JSON.parse_string(text)
			if parsed is Dictionary:
				LevelSerializer.import_level(parsed, level_root, false)
				var loaded_segs: Variant = parsed.get("segs", [])
				if loaded_segs is Array and not loaded_segs.is_empty():
					_segments = []
					for seg: Variant in loaded_segs:
						if seg is Dictionary:
							if seg.has("type"):
								var seg_type: String = seg.get("type", "")
								if seg_type in ["start_runway", "end_runway"]:
									continue
								_segments.append(seg)
							elif seg.has("t") and seg["t"] == "floor":
								_segments.append({"type": "straight", "length": seg.get("l", 100), "width": 8, "ramp": 0, "bank": 0, "ice": false})
				if _segments.is_empty():
					_segments = [{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false}]
				_rebuild_track()
				_refresh_segment_timeline()
				_last_saved_path = path
	)
	add_child(dialog)
	dialog.popup_centered(Vector2(800, 600))


func _on_export() -> void:
	var data := LevelSerializer.export_level(level_root)
	data["segs"] = _segments.duplicate(true)
	var json := JSON.stringify(data)
	var bytes := json.to_utf8_buffer()
	var code := Marshalls.raw_to_base64(bytes)
	code_edit.text = code
	code_panel.visible = true
	code_edit.select_all()
	code_edit.grab_focus()


func _on_import() -> void:
	if _import_mode:
		return
	code_edit.text = ""
	code_panel.visible = true
	code_edit.grab_focus()
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
	var bytes: PackedByteArray = Marshalls.base64_to_raw(code)
	var json: String = bytes.get_string_from_utf8()
	var parsed: Variant = JSON.parse_string(json)
	if parsed is Dictionary:
		LevelSerializer.import_level(parsed, level_root, false)
		var loaded_segs: Variant = parsed.get("segs", [])
		if loaded_segs is Array and not loaded_segs.is_empty():
			_segments = []
			for seg: Variant in loaded_segs:
				if seg is Dictionary:
					if seg.has("type"):
						var seg_type: String = seg.get("type", "")
						if seg_type in ["start_runway", "end_runway"]:
							continue
						_segments.append(seg)
					elif seg.has("t") and seg["t"] == "floor":
						_segments.append({"type": "straight", "length": seg.get("l", 100), "width": 8, "ramp": 0, "bank": 0, "ice": false})
		if _segments.is_empty():
			_segments = [{"type": "straight", "length": 20, "width": 8, "ramp": 0, "bank": 0, "ice": false}]
		_rebuild_track()
		_refresh_segment_timeline()
	_hide_code_panel()


func _on_test() -> void:
	var data := LevelSerializer.export_level(level_root)
	data["segs"] = _segments.duplicate(true)
	GameManager.editor_test_data = data
	Main.instance.load_editor_test_runner()


func _on_menu() -> void:
	Main.instance.load_main_menu()


# ═══════════════════════════════════════════════════════════════════════════════
#  FLOOR / GRID
# ═══════════════════════════════════════════════════════════════════════════════

func _rebuild_floor() -> void:
	# Legacy stub — replaced by _rebuild_track()
	pass


func _update_grid() -> void:
	var all_segs: Array[Dictionary] = _get_all_track_segments()
	var total_length := 0.0
	var max_width := RUNWAY_WIDTH
	for seg: Dictionary in all_segs:
		total_length += seg.get("length", 20.0)
		max_width = maxf(max_width, seg.get("width", 8.0))
	var mesh := grid_visual.mesh as PlaneMesh
	if mesh == null:
		mesh = PlaneMesh.new()
		grid_visual.mesh = mesh
	mesh.size = Vector2(max_width + 4.0, total_length + 4.0)
	mesh.center_offset = Vector3(0, 0, -total_length / 2.0)
	grid_visual.position = track_root.position
	grid_visual.visible = true

extends RefCounted
class_name EditorTrackController

var _editor: LevelEditor
var segments: Array[EditorSegment] = []
var selected_index: int = -1
var armed_track_type: String = ""
var segment_anchors: Array[Dictionary] = []
var seg_timeline: HBoxContainer
var seg_dir_buttons: Dictionary = {}
var palette_buttons: Dictionary = {}


func _init(editor: LevelEditor) -> void:
	_editor = editor


func default_segments() -> Array[EditorSegment]:
	return [
		EditorSegment.make("straight"),
		EditorSegment.make("straight"),
		EditorSegment.make("straight"),
	]


func bind_timeline(timeline: HBoxContainer) -> void:
	seg_timeline = timeline


func refresh_timeline() -> void:
	if seg_timeline == null:
		return
	for child: Node in seg_timeline.get_children():
		child.queue_free()
	for i: int in range(segments.size()):
		var seg: EditorSegment = segments[i]
		var btn := Button.new()
		var type_name: String = EditorDefinitions.SEGMENT_TYPES.get(seg.type, {}).get("name", seg.type)
		btn.text = "%d\n%s" % [i + 1, type_name]
		btn.toggle_mode = true
		btn.button_pressed = (i == selected_index)
		btn.tooltip_text = "%s — snap %s" % [type_name, seg.snap]
		btn.pressed.connect(select_segment.bind(i))
		_editor.styles.style_timeline_button(btn, i == selected_index)
		seg_timeline.add_child(btn)


func select_segment(index: int) -> void:
	select_for_edit(index)


func select_for_edit(index: int) -> void:
	if index < 0 or index >= segments.size():
		return
	selected_index = index
	_editor.selected_node = null
	_editor.selected_tool = ""
	_editor.placement.clear_ghost()
	_editor.placement.update_selection_gizmo()
	refresh_timeline()
	update_snap_ui()
	update_properties_panel()
	_editor.placement.update_properties_ui()
	highlight_armed_type()
	rebuild_selection_highlight()
	_editor.update_status_bar()


func deselect() -> void:
	if selected_index < 0:
		return
	selected_index = -1
	refresh_timeline()
	update_snap_ui()
	update_properties_panel()
	_editor.placement.update_properties_ui()
	rebuild_selection_highlight()
	_editor.update_status_bar()


func select_neighbor(delta: int) -> void:
	if segments.is_empty():
		return
	var idx: int = selected_index
	if idx < 0:
		idx = 0 if delta > 0 else segments.size() - 1
	else:
		idx = clampi(idx + delta, 0, segments.size() - 1)
	select_for_edit(idx)


func apply_snap_from_key(key_index: int) -> void:
	if selected_index < 0 or selected_index >= segments.size():
		return
	if key_index < 0 or key_index >= EditorDefinitions.SNAP_DIRS.size():
		return
	var snap_entry: Dictionary = EditorDefinitions.SNAP_DIRS[key_index]
	on_snap_selected(String(snap_entry.get("id", "M")))


func rebuild_selection_highlight() -> void:
	TrackMeshBuilder.update_selection_highlight(_editor.track_root, selected_index, _editor.level_root)


func snapshot_state() -> Dictionary:
	return {
		"segments": EditorSegment.to_dict_array(segments),
		"selected": selected_index,
	}


func restore_segments_state(state: Dictionary) -> void:
	segments.clear()
	for item: Variant in state.get("segments", []):
		if item is Dictionary:
			segments.append(EditorSegment.from_dict(item))
	selected_index = int(state.get("selected", -1))
	if selected_index >= segments.size():
		selected_index = segments.size() - 1
	rebuild()
	refresh_timeline()
	update_snap_ui()
	update_properties_panel()
	highlight_armed_type()
	_editor.update_status_bar()


func apply_type_to_segment(index: int, type_key: String) -> void:
	if index < 0 or index >= segments.size():
		return
	var params: Dictionary = EditorDefinitions.SEGMENT_TYPES.get(type_key, {})
	if params.is_empty():
		return
	var seg: EditorSegment = segments[index]
	if seg.type == type_key:
		return
	_editor.undo.push_segment_undo()
	seg.type = type_key
	seg.length = float(params.get("length", 20))
	seg.width = float(params.get("width", 8))
	seg.ramp = float(params.get("ramp", 0))
	seg.bank = float(params.get("bank", 0))
	seg.ice = bool(params.get("ice", false))
	_editor.mark_dirty()
	rebuild()
	refresh_timeline()
	update_snap_ui()
	update_properties_panel()
	_editor.update_status_bar()


func on_track_type_pressed(type_key: String) -> void:
	armed_track_type = type_key
	highlight_armed_type()
	if selected_index >= 0 and selected_index < segments.size():
		apply_type_to_segment(selected_index, type_key)
	_editor.update_status_bar()


func highlight_armed_type() -> void:
	for btn_id in palette_buttons.keys():
		if not EditorDefinitions.SEGMENT_TYPES.has(btn_id):
			continue
		var btn: Button = palette_buttons[btn_id]
		var active := false
		if selected_index >= 0 and selected_index < segments.size():
			active = segments[selected_index].type == btn_id
		elif not armed_track_type.is_empty():
			active = btn_id == armed_track_type
		_editor.styles.set_tool_button_active(btn, active)


func try_select_from_ray(ray: Dictionary) -> bool:
	if segments.is_empty():
		return false
	var world := _editor.get_world_3d()
	var result := EditorRaycast.pick_physics(world, ray)
	if not result.is_empty():
		var body := EditorRaycast.pick_track_segment_body(result, _editor.track_root)
		if body != null:
			var mid: int = EditorRaycast.middle_index_from_seg_body(body)
			if mid >= 0:
				select_for_edit(mid)
				return true
	var hit := EditorRaycast.pick_ground(world, ray, [], _editor.track_width, _editor.track_length)
	if hit["hit"]:
		if _select_at_local_z(_editor.track_root.to_local(hit["pos"]).z, true):
			return true
	deselect()
	return false


func _select_at_local_z(local_z: float, require_proximity: bool) -> bool:
	if segment_anchors.is_empty():
		return false
	var best_i := 0
	var best_dist := INF
	for anchor: Dictionary in segment_anchors:
		var dist: float = absf(anchor["local"].z - local_z)
		if dist < best_dist:
			best_dist = dist
			best_i = anchor["index"]
	if require_proximity and best_dist > TrackConstants.SEGMENT_PICK_MAX_DIST:
		return false
	select_for_edit(best_i)
	return true


func add_segment() -> void:
	if segments.size() >= TrackConstants.MAX_MIDDLE_SEGMENTS:
		return
	_editor.undo.push_segment_undo()
	var seg := EditorSegment.make("straight")
	if segments.size() > 0:
		seg.apply_snap(segments[segments.size() - 1].snap)
	segments.append(seg)
	selected_index = segments.size() - 1
	_editor.mark_dirty()
	rebuild()
	refresh_timeline()
	update_snap_ui()
	update_properties_panel()
	highlight_armed_type()
	_editor.update_status_bar()


func remove_segment() -> void:
	if segments.size() <= 1:
		return
	_editor.undo.push_segment_undo()
	var idx := selected_index
	if idx < 0 or idx >= segments.size():
		idx = segments.size() - 1
	segments.remove_at(idx)
	selected_index = clampi(idx - 1, 0, segments.size() - 1)
	_editor.mark_dirty()
	rebuild()
	refresh_timeline()
	update_snap_ui()
	update_properties_panel()
	_editor.update_status_bar()


func on_snap_selected(snap_id: String) -> void:
	if selected_index < 0 or selected_index >= segments.size():
		return
	var seg: EditorSegment = segments[selected_index]
	if seg.snap == snap_id:
		return
	_editor.undo.push_segment_undo()
	seg.apply_snap(snap_id)
	_editor.mark_dirty()
	_highlight_snap_buttons(snap_id, true)
	rebuild()
	refresh_timeline()
	update_properties_panel()
	_editor.update_status_bar()


func get_all_track_segments_dicts() -> Array:
	var all_segs: Array = []
	all_segs.append({
		"type": "start_runway",
		"length": TrackConstants.START_RUNWAY_LENGTH,
		"width": TrackConstants.RUNWAY_WIDTH,
		"ramp": 0, "bank": 0, "ice": false,
	})
	for seg: EditorSegment in segments:
		all_segs.append(seg.to_dict())
	all_segs.append({
		"type": "end_runway",
		"length": TrackConstants.END_RUNWAY_LENGTH,
		"width": TrackConstants.RUNWAY_WIDTH,
		"ramp": 0, "bank": 0, "ice": false,
	})
	return all_segs


func rebuild() -> void:
	segment_anchors = TrackMeshBuilder.build({
		"track_root": _editor.track_root,
		"level_root": _editor.level_root,
		"all_segments": get_all_track_segments_dicts(),
		"selected_middle_index": selected_index,
	})
	_editor.camera.update_grid()


func build_palette_section(parent: VBoxContainer) -> void:
	palette_buttons.clear()
	var title := Label.new()
	title.text = "Track Types"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(title)
	for key: String in EditorDefinitions.SEGMENT_TYPES.keys():
		var info: Dictionary = EditorDefinitions.SEGMENT_TYPES[key]
		var btn := Button.new()
		btn.text = info["name"]
		btn.pressed.connect(on_track_type_pressed.bind(key))
		_editor.styles.style_tool_button(btn)
		parent.add_child(btn)
		palette_buttons[key] = btn
	highlight_armed_type()
	parent.add_child(HSeparator.new())
	var add_btn := Button.new()
	add_btn.text = "+ Add Segment"
	add_btn.pressed.connect(add_segment)
	_editor.styles.style_tool_button(add_btn)
	parent.add_child(add_btn)
	var rem_btn := Button.new()
	rem_btn.text = "- Remove Segment"
	rem_btn.pressed.connect(remove_segment)
	_editor.styles.style_tool_button(rem_btn)
	parent.add_child(rem_btn)
	parent.add_child(HSeparator.new())
	var seg_snap_lbl := Label.new()
	seg_snap_lbl.text = "Segment position (9-snap)"
	seg_snap_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(seg_snap_lbl)
	var active_snap := "M"
	if selected_index >= 0 and selected_index < segments.size():
		active_snap = segments[selected_index].snap
	_build_snap_grid(parent, seg_dir_buttons, active_snap, on_snap_selected)


func _build_snap_grid(parent: Control, button_map: Dictionary, active_id: String, callback: Callable) -> void:
	button_map.clear()
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 2)
	grid.add_theme_constant_override("v_separation", 2)
	parent.add_child(grid)
	for i: int in range(EditorDefinitions.SNAP_DIRS.size()):
		var d: Dictionary = EditorDefinitions.SNAP_DIRS[i]
		var btn := Button.new()
		btn.text = d["id"]
		btn.tooltip_text = "%s (key %d)" % [d["label"], i + 1]
		btn.toggle_mode = true
		btn.custom_minimum_size = Vector2(36, 28)
		btn.button_pressed = (d["id"] == active_id)
		_editor.styles.style_tool_button(btn)
		var snap_id: String = d["id"]
		btn.pressed.connect(callback.bind(snap_id))
		grid.add_child(btn)
		button_map[snap_id] = btn


func update_snap_ui() -> void:
	var valid := selected_index >= 0 and selected_index < segments.size()
	if seg_dir_buttons.is_empty():
		update_properties_panel()
		return
	if not valid:
		_highlight_snap_buttons("M", false)
		update_properties_panel()
		return
	var seg: EditorSegment = segments[selected_index]
	_highlight_snap_buttons(seg.snap, true)
	update_properties_panel()


func _highlight_snap_buttons(active_id: String, enabled: bool) -> void:
	for snap_id: String in seg_dir_buttons:
		var btn: Button = seg_dir_buttons[snap_id]
		btn.disabled = not enabled
		btn.button_pressed = (snap_id == active_id) and enabled


func update_properties_panel() -> void:
	var seg_props: Node = _editor.props_panel.get_node_or_null("SegProps") if _editor.props_panel else null
	if seg_props == null:
		return
	var show_seg := _editor.mode == EditorDefinitions.Mode.TRACK and selected_index >= 0 and selected_index < segments.size()
	seg_props.visible = show_seg
	if not show_seg:
		return
	var seg: EditorSegment = segments[selected_index]
	var type_name: String = EditorDefinitions.SEGMENT_TYPES.get(seg.type, {}).get("name", seg.type)
	var labels: Dictionary = _editor.seg_prop_value_labels
	if labels.has("Index"):
		labels["Index"].text = "%d / %d" % [selected_index + 1, segments.size()]
	if labels.has("Type"):
		labels["Type"].text = type_name
	if labels.has("Snap"):
		labels["Snap"].text = seg.snap
	if labels.has("Offset X"):
		labels["Offset X"].text = "%.1f" % seg.x
	if labels.has("Offset Y"):
		labels["Offset Y"].text = "%.1f" % seg.y


func resolve_hoop_place_pos(world_click: Vector3, height_offset: float, hoop_snap_enabled: bool, hoop_snap_id: String) -> Vector3:
	if not hoop_snap_enabled or segment_anchors.is_empty():
		return Vector3(world_click.x, EditorRaycast.track_surface_y(_editor.get_world_3d(), world_click) + height_offset, world_click.z)
	var click_local := _editor.track_root.to_local(world_click)
	var best_i := 0
	var best_dist := INF
	for i: int in range(segment_anchors.size()):
		var candidate: Dictionary = segment_anchors[i]
		var local: Vector3 = candidate["local"]
		var dist: float = absf(local.z - click_local.z)
		if dist < best_dist:
			best_dist = dist
			best_i = i
	var anchor: Dictionary = segment_anchors[best_i]
	var snap_off := Vector3.ZERO
	for d: Dictionary in EditorDefinitions.SNAP_DIRS:
		if d["id"] == hoop_snap_id:
			snap_off = Vector3(float(d["dx"]) * TrackConstants.SNAP_LATERAL, float(d["dy"]) * TrackConstants.SNAP_VERTICAL, 0.0)
			break
	var local_pos := Vector3(
		anchor["local"].x + snap_off.x,
		float(anchor["chain_y"]) + snap_off.y + height_offset,
		anchor["local"].z,
	)
	return _editor.track_root.to_global(local_pos)

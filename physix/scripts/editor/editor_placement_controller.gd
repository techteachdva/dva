extends RefCounted
class_name EditorPlacementController

var _editor: LevelEditor
var ghost_node: Node3D = null
var is_dragging: bool = false
var drag_plane: Plane
var drag_offset: Vector3
var undo_drag_start: Dictionary = {}
var semantic_snap: int = 0
var risk_reward_mode: bool = false
var hoop_snap_enabled: bool = false
var hoop_snap_id: String = "M"
var hoop_snap_buttons: Dictionary = {}
var palette_buttons: Dictionary = {}
var prop_spinboxes: Dictionary = {}


func _init(editor: LevelEditor) -> void:
	_editor = editor


func clear_ghost() -> void:
	if ghost_node != null:
		ghost_node.queue_free()
		ghost_node = null


func select_tool(id: String) -> void:
	_editor.selected_tool = id
	_editor.selected_node = null
	clear_ghost()
	update_selection_gizmo()
	update_properties_ui()
	_editor.update_status_bar()
	for btn_id in palette_buttons.keys():
		var btn: Button = palette_buttons[btn_id]
		_editor.styles.set_tool_button_active(btn, btn_id == id)


func handle_left_click(ray: Dictionary) -> void:
	match _editor.mode:
		EditorDefinitions.Mode.TRACK:
			if not _editor.track.try_select_from_ray(ray):
				_editor.track.deselect()
		EditorDefinitions.Mode.OBSTACLE, EditorDefinitions.Mode.CHECKPOINT:
			if _editor.selected_tool.is_empty():
				try_select_obstacle(ray)
			else:
				place_at_ray(ray)


func handle_left_release() -> void:
	if is_dragging and _editor.selected_node != null and undo_drag_start.has("node"):
		var start: Dictionary = undo_drag_start
		if start["node"] == _editor.selected_node:
			if start["old_pos"] != _editor.selected_node.global_position or start["old_rot"] != _editor.selected_node.global_rotation_degrees:
				_editor.undo.push({
					"type": "move",
					"node": _editor.selected_node,
					"old_pos": start["old_pos"],
					"old_rot": start["old_rot"],
				})
				_editor.mark_dirty()
	is_dragging = false
	undo_drag_start = {}


func process_frame() -> void:
	if is_dragging and _editor.selected_node != null:
		var ray := EditorRaycast.mouse_ray(_editor.editor_camera, _editor.get_viewport().get_mouse_position())
		var hit: Variant = drag_plane.intersects_ray(ray["origin"], ray["dir"])
		if hit != null:
			_editor.selected_node.global_position = _snap_position(hit + drag_offset)
			update_selection_gizmo()
			update_properties_ui_from_node()
		return
	if _editor.selection_gizmo.visible:
		var pulse := 1.0 + 0.15 * sin(Engine.get_process_frames() * 0.12)
		var scale_factor := clampf(_editor.camera.cam_dist / 25.0, 0.6, 2.5)
		_editor.selection_gizmo.scale = Vector3.ONE * pulse * scale_factor
	if not _editor.selected_tool.is_empty() and not _editor.is_mouse_over_ui():
		_update_ghost()
	elif ghost_node != null:
		clear_ghost()


func try_select_obstacle(ray: Dictionary) -> void:
	var result := EditorRaycast.pick_physics(_editor.get_world_3d(), ray)
	if result.is_empty():
		_editor.selected_node = null
		update_selection_gizmo()
		update_properties_ui()
		return
	var target := EditorRaycast.pick_obstacle_root(result, _editor.track_root, _editor.level_root)
	if target == null:
		_editor.selected_node = null
	else:
		_editor.selected_node = target
		is_dragging = true
		undo_drag_start = {
			"node": _editor.selected_node,
			"old_pos": _editor.selected_node.global_position,
			"old_rot": _editor.selected_node.global_rotation_degrees,
		}
		drag_plane = Plane(Vector3.UP, _editor.selected_node.global_position.y)
		var hit: Variant = drag_plane.intersects_ray(ray["origin"], ray["dir"])
		if hit != null:
			drag_offset = _editor.selected_node.global_position - hit
	update_selection_gizmo()
	update_properties_ui()


func right_click_delete() -> void:
	if _editor.selected_node != null:
		delete_selected()
		return
	if _editor.mode == EditorDefinitions.Mode.TRACK and _editor.track.selected_index >= 0:
		_editor.track.remove_segment()


func duplicate_selected() -> void:
	if _editor.selected_node == null:
		return
	if _editor.mode == EditorDefinitions.Mode.TRACK:
		return
	var original: Node3D = _editor.selected_node
	var dup: Node = original.duplicate(Node.DUPLICATE_USE_INSTANTIATION | Node.DUPLICATE_SCRIPTS)
	if dup is not Node3D:
		dup.queue_free()
		return
	var copy: Node3D = dup as Node3D
	var parent: Node = original.get_parent()
	if parent == null:
		copy.queue_free()
		return
	parent.add_child(copy)
	copy.owner = _editor.level_root
	var offset := _editor.snap_size if _editor.snap_size > 0.0 else 2.0
	copy.global_position = original.global_position + Vector3(offset, 0.0, 0.0)
	copy.global_rotation = original.global_rotation
	_editor.selected_node = copy
	_editor.undo.push({"type": "place", "node": copy})
	_editor.mark_dirty()
	update_selection_gizmo()
	update_properties_ui()
	_editor.update_status_bar()


func delete_selected() -> void:
	if _editor.selected_node == null:
		return
	var parent := _editor.selected_node.get_parent()
	if parent != null:
		parent.remove_child(_editor.selected_node)
		_editor.undo.push({"type": "delete", "node": _editor.selected_node, "parent": parent})
	else:
		_editor.selected_node.queue_free()
	_editor.selected_node = null
	_editor.mark_dirty()
	update_selection_gizmo()
	update_properties_ui()


func update_selection_gizmo() -> void:
	if _editor.selected_node == null:
		_editor.selection_gizmo.visible = false
		return
	_editor.selection_gizmo.visible = true
	_editor.selection_gizmo.global_position = _editor.selected_node.global_position


func place_at_ray(ray: Dictionary) -> void:
	if EditorDefinitions.SEGMENT_TYPES.has(_editor.selected_tool):
		return
	var exclude: Array[RID] = []
	if ghost_node != null and is_instance_valid(ghost_node) and ghost_node is CollisionObject3D:
		exclude.append((ghost_node as CollisionObject3D).get_rid())
	var hit := EditorRaycast.pick_ground(_editor.get_world_3d(), ray, exclude, _editor.track_width, _editor.track_length)
	if not hit["hit"]:
		return
	var pos := _snap_position(hit["pos"])
	var node: Node = null
	if _editor.selected_tool.begins_with("hoop_"):
		var height_key := _editor.selected_tool.substr(5)
		var offset: float = EditorDefinitions.HOOP_HEIGHTS.get(height_key, {}).get("offset", 1.5)
		pos = _editor.track.resolve_hoop_place_pos(pos, offset, hoop_snap_enabled, hoop_snap_id)
		node = _place_hoop(pos)
	elif _editor.selected_tool == "coin":
		pos.y = EditorRaycast.track_surface_y(_editor.get_world_3d(), pos) + 1.5
		node = _place_coin(pos)
	elif _editor.selected_tool == "finish":
		_editor.track.rebuild()
		return
	elif _editor.selected_tool in ["snake", "gauntlet", "slalom", "tunnel"]:
		node = _place_pattern(_editor.selected_tool, pos)
	else:
		var surface_y: float = EditorRaycast.track_surface_y(_editor.get_world_3d(), pos)
		pos.y = _get_placement_y(surface_y)
		node = _place_obstacle(_editor.selected_tool, pos)
	if node != null:
		_editor.undo.push({"type": "place", "node": node})
		_editor.mark_dirty()


func _get_placement_y(surface_y: float) -> float:
	match semantic_snap:
		1: return surface_y
		2: return surface_y + 1.7
		3: return surface_y + 3.5
		4: return surface_y + 5.0
		_: return surface_y + 0.22


func _snap_position(pos: Vector3) -> Vector3:
	if _editor.snap_size <= 0:
		return pos
	return Vector3(
		snappedf(pos.x, _editor.snap_size),
		snappedf(pos.y, _editor.snap_size),
		snappedf(pos.z, _editor.snap_size),
	)


func _update_ghost() -> void:
	var ray := EditorRaycast.mouse_ray(_editor.editor_camera, _editor.get_viewport().get_mouse_position())
	var exclude: Array[RID] = []
	if ghost_node != null and is_instance_valid(ghost_node) and ghost_node is CollisionObject3D:
		exclude.append((ghost_node as CollisionObject3D).get_rid())
	var hit := EditorRaycast.pick_ground(_editor.get_world_3d(), ray, exclude, _editor.track_width, _editor.track_length)
	if not hit["hit"]:
		if ghost_node != null:
			ghost_node.visible = false
		return
	var pos := _snap_position(hit["pos"])
	if _editor.selected_tool.begins_with("hoop_"):
		var height_key := _editor.selected_tool.substr(5)
		var height_off: float = EditorDefinitions.HOOP_HEIGHTS.get(height_key, {}).get("offset", 1.5)
		pos = _editor.track.resolve_hoop_place_pos(pos, height_off, hoop_snap_enabled, hoop_snap_id)
	elif _editor.selected_tool == "coin":
		pos.y = EditorRaycast.track_surface_y(_editor.get_world_3d(), pos) + 1.5
	if ghost_node == null:
		ghost_node = _create_ghost()
		if ghost_node == null:
			return
		_editor.level_root.add_child(ghost_node)
	ghost_node.visible = true
	ghost_node.global_position = pos


func _create_ghost() -> Node3D:
	match _editor.selected_tool:
		"finish":
			var g := Area3D.new()
			var s := CollisionShape3D.new()
			var b := BoxShape3D.new()
			b.size = Vector3(_editor.track_width, 4.0, 10.0)
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
			g.mesh = Hoop.build_hex_hoop_mesh(Hoop.HOOP_MAJOR_RADIUS, Hoop.HOOP_MINOR_RADIUS)
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.5, 1.0, 0.5, 0.5)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			g.material_override = mat
			return g
		_:
			for item: Dictionary in EditorDefinitions.PALETTE:
				if item["id"] == _editor.selected_tool and not item["scene"].is_empty():
					var sc := load(item["scene"]) as PackedScene
					if sc == null:
						return null
					var node := sc.instantiate()
					_set_ghost_material(node)
					node.process_mode = Node.PROCESS_MODE_DISABLED
					_stop_ghost_effects(node)
					return node
	return null


func _set_ghost_material(node: Node3D) -> void:
	for child: Node in node.get_children():
		if child is MeshInstance3D and child.mesh != null:
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.5, 1.0, 0.5, 0.5)
			mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			child.material_override = mat
		if child is Node3D:
			_set_ghost_material(child)


func _stop_ghost_effects(node: Node3D) -> void:
	for child: Node in node.get_children():
		if child is GPUParticles3D:
			child.emitting = false
		elif child is OmniLight3D or child is SpotLight3D:
			child.light_energy = 0.0
		elif child is Label3D:
			child.visible = false
		if child is Node3D:
			_stop_ghost_effects(child)


func _place_obstacle(tool_id: String, pos: Vector3) -> Node:
	for item: Dictionary in EditorDefinitions.PALETTE:
		if item["id"] == tool_id and not item["scene"].is_empty():
			var scene := load(item["scene"]) as PackedScene
			if scene == null:
				return null
			var node := scene.instantiate()
			node.transform.origin = _editor.track_root.to_local(pos)
			_editor.track_root.add_child(node)
			node.owner = _editor.level_root
			return node
	return null


func _place_hoop(pos: Vector3) -> Node:
	var hoop := Hoop.new()
	hoop.name = "Hoop"
	hoop.boost_strength = 28.0
	hoop.transform.origin = _editor.track_root.to_local(pos)
	hoop.build_visuals()
	_editor.track_root.add_child(hoop)
	hoop.owner = _editor.level_root
	return hoop


func _place_coin(pos: Vector3) -> Node:
	var scene := load("res://scenes/coin.tscn") as PackedScene
	if scene == null:
		return null
	var coins_node: Node = _editor.track_root.get_node_or_null("Coins")
	if coins_node == null:
		coins_node = Node3D.new()
		coins_node.name = "Coins"
		_editor.track_root.add_child(coins_node)
		coins_node.owner = _editor.level_root
	var coin := scene.instantiate()
	var place_pos := pos
	if risk_reward_mode:
		place_pos = _get_risk_reward_pos(pos)
	coin.transform.origin = _editor.track_root.to_local(place_pos)
	coin.name = "Coin%d" % (coins_node.get_child_count() + 1)
	coins_node.add_child(coin)
	coin.owner = _editor.level_root
	return coin


func _place_pattern(pat_id: String, origin: Vector3) -> Node:
	var last_node: Node = null
	match pat_id:
		"snake":
			for i: int in range(5):
				var side := -1.0 if i % 2 == 0 else 1.0
				last_node = _instantiate_obstacle("bumper", Vector3(side * 2.5, 1.0, origin.z + i * 8.0))
		"gauntlet":
			for i: int in range(6):
				var side := -1.0 if i % 2 == 0 else 1.0
				last_node = _instantiate_obstacle("bumper", Vector3(side * 1.5, 1.0, origin.z + i * 4.0))
		"slalom":
			for i: int in range(5):
				var side := -1.0 if i % 2 == 0 else 1.0
				var z := origin.z + i * 6.0
				if i % 2 == 0:
					last_node = _instantiate_obstacle("bumper", Vector3(side * 2.0, 1.0, z))
				else:
					last_node = _instantiate_obstacle("ice", Vector3(side * 1.5, 0.2, z))
		"tunnel":
			var half_w := _editor.track_width / 2.0 + 0.5
			var tunnel_length := 40.0
			last_node = _instantiate_obstacle("wind", Vector3(-half_w, 1.0, origin.z + tunnel_length / 2.0), Vector3.ZERO, {"wf": 8.0, "wd": [1, 0, 0]})
			_instantiate_obstacle("wind", Vector3(half_w, 1.0, origin.z + tunnel_length / 2.0), Vector3.ZERO, {"wf": 8.0, "wd": [-1, 0, 0]})
	return last_node


func _instantiate_obstacle(tool_id: String, pos: Vector3, rot: Vector3 = Vector3.ZERO, props: Dictionary = {}) -> Node:
	for item: Dictionary in EditorDefinitions.PALETTE:
		if item["id"] == tool_id and not item["scene"].is_empty():
			var scene := load(item["scene"]) as PackedScene
			if scene == null:
				return null
			var node := scene.instantiate()
			var local_pos := _editor.track_root.to_local(pos)
			local_pos.y = maxf(local_pos.y, 0.22)
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
			_editor.track_root.add_child(node)
			node.owner = _editor.level_root
			return node
	return null


func _get_risk_reward_pos(fallback: Vector3) -> Vector3:
	var nearest: Node3D = null
	var nearest_dist: float = 9999.0
	for child: Node in _editor.track_root.get_children():
		if child == null or child.name == "Floor" or child.name == "Coins" or child.name.begins_with("Wall"):
			continue
		var d: float = child.global_position.distance_to(fallback)
		if d < nearest_dist and d < 16.0:
			nearest_dist = d
			nearest = child
	if nearest == null:
		return fallback
	var p := nearest.global_position
	return Vector3(p.x * 0.6, 1.7, p.z + 3.0)


func build_obstacle_palette(parent: VBoxContainer) -> void:
	palette_buttons.clear()
	var title := Label.new()
	title.text = "Obstacles"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(title)
	for item: Dictionary in EditorDefinitions.PALETTE:
		if item["category"] == "Obstacles" and not str(item["id"]).begins_with("hoop"):
			var btn := Button.new()
			btn.text = item["name"]
			btn.pressed.connect(select_tool.bind(item["id"]))
			_editor.styles.style_tool_button(btn)
			parent.add_child(btn)
			palette_buttons[item["id"]] = btn
	parent.add_child(HSeparator.new())
	var coin_btn := Button.new()
	coin_btn.text = "Coin"
	coin_btn.pressed.connect(select_tool.bind("coin"))
	_editor.styles.style_tool_button(coin_btn)
	parent.add_child(coin_btn)
	palette_buttons["coin"] = coin_btn
	var risk_btn := CheckButton.new()
	risk_btn.text = "Danger Coins"
	risk_btn.toggled.connect(func(v: bool): risk_reward_mode = v)
	parent.add_child(risk_btn)
	parent.add_child(HSeparator.new())
	var snap_opts := OptionButton.new()
	snap_opts.add_item("Surface +0.22")
	snap_opts.add_item("Floor")
	snap_opts.add_item("Low +1.7")
	snap_opts.add_item("Medium +3.5")
	snap_opts.add_item("High +5.0")
	snap_opts.item_selected.connect(func(idx: int): semantic_snap = idx)
	parent.add_child(snap_opts)
	parent.add_child(HSeparator.new())
	for pat: Dictionary in EditorDefinitions.PATTERNS:
		var btn := Button.new()
		btn.text = pat["name"]
		btn.pressed.connect(select_tool.bind(pat["id"]))
		_editor.styles.style_tool_button(btn)
		parent.add_child(btn)
		palette_buttons[pat["id"]] = btn


func build_checkpoint_palette(parent: VBoxContainer) -> void:
	palette_buttons.clear()
	var title := Label.new()
	title.text = "Checkpoints"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(title)
	for key: String in EditorDefinitions.HOOP_HEIGHTS.keys():
		var info: Dictionary = EditorDefinitions.HOOP_HEIGHTS[key]
		var btn := Button.new()
		btn.text = info["name"]
		btn.pressed.connect(select_tool.bind("hoop_" + key))
		_editor.styles.style_tool_button(btn)
		parent.add_child(btn)
		palette_buttons["hoop_" + key] = btn
	parent.add_child(HSeparator.new())
	var coin_btn := Button.new()
	coin_btn.text = "Coin"
	coin_btn.pressed.connect(select_tool.bind("coin"))
	_editor.styles.style_tool_button(coin_btn)
	parent.add_child(coin_btn)
	palette_buttons["coin"] = coin_btn
	parent.add_child(HSeparator.new())
	var hoop_snap := CheckButton.new()
	hoop_snap.text = "Snap to grid"
	hoop_snap.button_pressed = hoop_snap_enabled
	hoop_snap.toggled.connect(func(on: bool): hoop_snap_enabled = on)
	parent.add_child(hoop_snap)
	var hoop_snap_lbl := Label.new()
	hoop_snap_lbl.text = "Hoop snap"
	hoop_snap_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(hoop_snap_lbl)
	_editor.track._build_snap_grid(parent, hoop_snap_buttons, hoop_snap_id, _on_hoop_snap_selected)


func _on_hoop_snap_selected(snap_id: String) -> void:
	hoop_snap_id = snap_id
	for sid: String in hoop_snap_buttons:
		var btn: Button = hoop_snap_buttons[sid]
		btn.button_pressed = sid == snap_id


func update_properties_ui() -> void:
	var seg_props: Node = _editor.props_panel.get_node_or_null("SegProps")
	var obstacle_props: Node = _editor.props_panel.get_node_or_null("ObstacleProps")
	var show_seg := _editor.mode == EditorDefinitions.Mode.TRACK and _editor.track.selected_index >= 0
	if seg_props:
		seg_props.visible = show_seg
	if obstacle_props:
		obstacle_props.visible = _editor.selected_node != null
	var actions: Node = _editor.props_panel.get_node_or_null("PropActions")
	if _editor.selected_node == null:
		for spin: SpinBox in prop_spinboxes.values():
			spin.editable = false
		if actions:
			for btn: Button in actions.get_children():
				btn.disabled = true
		if _editor.mode == EditorDefinitions.Mode.TRACK:
			_editor.track.update_properties_panel()
		return
	for spin: SpinBox in prop_spinboxes.values():
		spin.editable = true
	if actions:
		for btn: Button in actions.get_children():
			btn.disabled = false
	update_properties_ui_from_node()


func update_properties_ui_from_node() -> void:
	if _editor.selected_node == null:
		return
	prop_spinboxes["Pos X"].value = snappedf(_editor.selected_node.position.x, 0.01)
	prop_spinboxes["Pos Y"].value = snappedf(_editor.selected_node.position.y, 0.01)
	prop_spinboxes["Pos Z"].value = snappedf(_editor.selected_node.position.z, 0.01)
	prop_spinboxes["Rot X"].value = snappedf(_editor.selected_node.rotation_degrees.x, 0.1)
	prop_spinboxes["Rot Y"].value = snappedf(_editor.selected_node.rotation_degrees.y, 0.1)
	prop_spinboxes["Rot Z"].value = snappedf(_editor.selected_node.rotation_degrees.z, 0.1)


func on_prop_changed(_val: float, label: String) -> void:
	if _editor.selected_node == null:
		return
	match label:
		"Pos X": _editor.selected_node.position.x = prop_spinboxes[label].value
		"Pos Y": _editor.selected_node.position.y = prop_spinboxes[label].value
		"Pos Z": _editor.selected_node.position.z = prop_spinboxes[label].value
		"Rot X": _editor.selected_node.rotation_degrees.x = prop_spinboxes[label].value
		"Rot Y": _editor.selected_node.rotation_degrees.y = prop_spinboxes[label].value
		"Rot Z": _editor.selected_node.rotation_degrees.z = prop_spinboxes[label].value
	update_selection_gizmo()
	_editor.mark_dirty()


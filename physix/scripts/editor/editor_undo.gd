extends RefCounted
class_name EditorUndoManager

const MAX_UNDO := 50

var _stack: Array[Dictionary] = []
var _editor: LevelEditor


func _init(editor: LevelEditor) -> void:
	_editor = editor


func push(action: Dictionary) -> void:
	_stack.append(action)
	if _stack.size() > MAX_UNDO:
		_stack.pop_front()


func undo() -> void:
	if _stack.is_empty():
		return
	var action: Dictionary = _stack.pop_back()
	match action.get("type", ""):
		"place":
			var node: Node = action.get("node")
			if is_instance_valid(node):
				node.queue_free()
				if _editor.selected_node == node:
					_editor.selected_node = null
					_editor.placement.update_selection_gizmo()
					_editor.placement.update_properties_ui()
		"delete":
			var node: Node = action.get("node")
			var parent: Node = action.get("parent")
			if not is_instance_valid(node) or parent == null:
				return
			parent.add_child(node)
			node.owner = _editor.level_root
			_editor.selected_node = node
			_editor.placement.update_selection_gizmo()
			_editor.placement.update_properties_ui()
		"move":
			var node: Node = action.get("node")
			if is_instance_valid(node):
				node.global_position = action.get("old_pos", node.global_position)
				node.global_rotation_degrees = action.get("old_rot", node.global_rotation_degrees)
				_editor.placement.update_selection_gizmo()
				_editor.placement.update_properties_ui()
		"segments":
			var before: Dictionary = action.get("before", {})
			_editor.track.restore_segments_state(before)


func push_segment_undo() -> void:
	push({"type": "segments", "before": _editor.track.snapshot_state()})

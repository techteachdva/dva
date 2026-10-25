class_name NodePool

# Safe spawn-side node pooling for Phase 5.5.
# Does NOT intercept agent death (queue_free remains in agent scripts).
# Instead, pre-warms a stock of nodes at startup and reuses them
# during spawn/offspring bursts to reduce instantiate() overhead.

var _scene: PackedScene
var _available: Array[Node] = []
var _species_name: String = ""
var _max_size: int = 0

func _init(scene: PackedScene, species: String, max_size: int = 50) -> void:
	_scene = scene
	_species_name = species
	_max_size = max_size

func pre_warm(count: int) -> void:
	var to_create: int = mini(count, _max_size - _available.size())
	for i: int in range(to_create):
		if _scene == null:
			return
		var node: Node = _scene.instantiate()
		_available.append(node)

func acquire() -> Node:
	if not _available.is_empty():
		return _available.pop_back()
	if _scene != null:
		return _scene.instantiate()
	return null

func release(node: Node) -> void:
	# Only pool if under max size. Otherwise let GC handle it.
	if node == null or not is_instance_valid(node):
		return
	if _available.size() >= _max_size:
		node.queue_free()
		return
	# Detach from tree and hide
	if node.get_parent() != null:
		node.get_parent().remove_child(node)
	if node is Node3D:
		node.visible = false
		(node as Node3D).global_position = Vector3(9999.0, 9999.0, 9999.0)
	_available.append(node)

func size() -> int:
	return _available.size()

func clear() -> void:
	for node in _available:
		if is_instance_valid(node):
			node.queue_free()
	_available.clear()

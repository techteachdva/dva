class_name NetworkGraph
extends RefCounted

var _nodes: Dictionary = {}  # id -> {position: Vector3, weight: float}
var _next_id: int = 0
# Nodes whose emitter is gone (its creature died) keep fading at the
# emitter's rate until they reach zero, then are removed.
var _fading: Dictionary = {}  # id -> decay per second

# kind tells listeners who left the scent ("predator", "sheep", "fungus"...).
func add_node(position: Vector3, weight: float, kind: String = "") -> int:
	var id := _next_id
	_next_id += 1
	_nodes[id] = {"position": position, "weight": weight, "kind": kind}
	return id

func update_node(id: int, position: Vector3, weight: float) -> void:
	if _nodes.has(id):
		_nodes[id]["position"] = position
		_nodes[id]["weight"] = weight

func decay(id: int, amount: float) -> void:
	if _nodes.has(id):
		_nodes[id]["weight"] = maxf(_nodes[id]["weight"] - amount, 0.0)

func prune_below(threshold: float) -> void:
	var to_remove: Array[int] = []
	for id: int in _nodes.keys():
		if _nodes[id]["weight"] <= threshold:
			to_remove.append(id)
	for id: int in to_remove:
		_nodes.erase(id)
		_fading.erase(id)

func release(id: int, decay_rate: float) -> void:
	if _nodes.has(id):
		_fading[id] = decay_rate

func fade(delta: float) -> void:
	for id: int in _fading.keys():
		if not _nodes.has(id):
			_fading.erase(id)
			continue
		var w: float = _nodes[id]["weight"] - _fading[id] * delta
		if w <= 0.0:
			_nodes.erase(id)
			_fading.erase(id)
		else:
			_nodes[id]["weight"] = w

func query_nearby(position: Vector3, radius: float) -> Array[Dictionary]:
	var r2 := radius * radius
	var res: Array[Dictionary] = []
	for id: int in _nodes.keys():
		var entry: Dictionary = _nodes[id]
		if entry["position"].distance_squared_to(position) <= r2:
			res.append({"id": id, "position": entry["position"], "weight": entry["weight"], "kind": entry.get("kind", "")})
	return res

func get_weight(id: int) -> float:
	if _nodes.has(id):
		return _nodes[id]["weight"]
	return 0.0

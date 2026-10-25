class_name VisionCone
extends Node3D

@export var vision_range: float = 8.0
@export var vision_angle_deg: float = 120.0

var _director: SimulationDirector = null
var _cache_frame: int = -1
var _cached_results: Dictionary = {}

func _ready() -> void:
	set_process(false)
	var node := get_parent()
	while node != null:
		if node is SimulationDirector:
			_director = node as SimulationDirector
			break
		node = node.get_parent()

func get_visible_by_tag(tag: String) -> Array[Node3D]:
	if _director == null:
		return []
	var frame := Engine.get_physics_frames()
	if _cache_frame == frame and _cached_results.has(tag):
		return _cached_results[tag] as Array[Node3D]
	if _cache_frame != frame:
		_cached_results.clear()
		_cache_frame = frame
	# Presence grid fast-path: if no agents of this tag nearby, skip expensive spatial query
	if _director.get_presence_count(global_position, vision_range, tag) <= 0:
		var empty: Array[Node3D] = []
		_cached_results[tag] = empty
		return empty
	var parent := get_parent()
	var forward := -global_transform.basis.z.normalized()
	var half_cos := cos(deg_to_rad(vision_angle_deg * 0.5))
	var results: Array[Node3D] = []
	for node in _director.get_nearby_agents(global_position, vision_range, tag):
		if not is_instance_valid(node) or node == parent:
			continue
		var n3d := node as Node3D
		var to := (n3d.global_position - global_position).normalized()
		if forward.dot(to) >= half_cos:
			results.append(n3d)
	_cached_results[tag] = results
	return results

func closest_visible(tag: String) -> Node3D:
	var candidates := get_visible_by_tag(tag)
	var closest: Node3D = null
	var best_dist := INF
	for node in candidates:
		if not is_instance_valid(node):
			continue
		var d := global_position.distance_squared_to(node.global_position)
		if d < best_dist:
			best_dist = d
			closest = node
	return closest

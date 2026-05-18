extends Object
class_name EditorRaycast

static func mouse_ray(camera: Camera3D, screen_pos: Vector2) -> Dictionary:
	return {
		"origin": camera.project_ray_origin(screen_pos),
		"dir": camera.project_ray_normal(screen_pos),
	}


static func pick_physics(world: World3D, ray: Dictionary, exclude: Array[RID] = []) -> Dictionary:
	var space := world.direct_space_state
	var query := PhysicsRayQueryParameters3D.new()
	query.from = ray["origin"]
	query.to = ray["origin"] + ray["dir"] * 500.0
	query.collide_with_areas = true
	query.collide_with_bodies = true
	query.exclude = exclude
	return space.intersect_ray(query)


static func pick_ground(world: World3D, ray: Dictionary, exclude: Array[RID] = [], track_width: float = 8.0, track_length: float = 150.0) -> Dictionary:
	var result := pick_physics(world, ray, exclude)
	if not result.is_empty():
		return {"hit": true, "pos": result["position"]}
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
			clampf(t.z, -track_length, 0.0),
		)
		return {"hit": true, "pos": clamped}
	return {"hit": false}


static func pick_track_segment_body(result: Dictionary, track_root: Node3D) -> StaticBody3D:
	if result.is_empty():
		return null
	var node: Node = result["collider"]
	while node != null:
		if node is StaticBody3D and node.name.begins_with("Seg_") and node.get_parent() == track_root:
			return node as StaticBody3D
		if node.name.begins_with("Wall_"):
			var seg_body := node.get_parent()
			if seg_body is StaticBody3D and seg_body.get_parent() == track_root:
				return seg_body as StaticBody3D
		node = node.get_parent()
	return null


static func middle_index_from_seg_body(body: StaticBody3D) -> int:
	if not body.name.begins_with("Seg_"):
		return -1
	var parts: PackedStringArray = body.name.split("_")
	if parts.size() < 2:
		return -1
	return parts[1].to_int() - 1


static func pick_obstacle_root(result: Dictionary, track_root: Node3D, level_root: Node3D) -> Node3D:
	if result.is_empty():
		return null
	var collider: Node3D = result["collider"]
	var target: Node3D = collider
	while target != null and target != track_root and target != level_root:
		if target.get_parent() == track_root:
			break
		if target.get_parent() != null and target.get_parent().name == "Coins":
			break
		target = target.get_parent() as Node3D
	if target == track_root or target == level_root:
		return null
	return target


static func track_surface_y(world: World3D, world_pos: Vector3) -> float:
	var space := world.direct_space_state
	var query := PhysicsRayQueryParameters3D.new()
	query.from = world_pos + Vector3(0, 50, 0)
	query.to = world_pos + Vector3(0, -50, 0)
	query.collide_with_areas = false
	query.collide_with_bodies = true
	var result := space.intersect_ray(query)
	if not result.is_empty():
		return result["position"].y
	return 0.22

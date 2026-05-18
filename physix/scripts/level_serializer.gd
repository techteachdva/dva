extends Node
class_name LevelSerializer

# Serializes / deserializes Physix levels to a compact JSON dictionary.
# Designed to be versioned and forward-compatible for future UGC sharing.

const FORMAT_VERSION := "px1"

# Scene paths for instantiation
const OBSTACLE_SCENES: Dictionary = {
	"bumper": "res://scenes/obstacles/bumper.tscn",
	"boost":  "res://scenes/obstacles/speed_boost.tscn",
	"brake":  "res://scenes/obstacles/brake_pad.tscn",
	"grav":   "res://scenes/obstacles/gravity_zone.tscn",
	"wind":   "res://scenes/obstacles/wind_zone.tscn",
	"magnet": "res://scenes/obstacles/magnet_zone.tscn",
	"ice":    "res://scenes/obstacles/ice_patch.tscn",
	"move":   "res://scenes/obstacles/moving_platform.tscn",
	"tutorial": "res://scenes/obstacles/tutorial_trigger.tscn",
}

const COIN_SCENE := "res://scenes/coin.tscn"

# Runway dimensions: TrackConstants (scripts/editor/track_constants.gd)
const START_RUNWAY_LENGTH := TrackConstants.START_RUNWAY_LENGTH
const END_RUNWAY_LENGTH := TrackConstants.END_RUNWAY_LENGTH
const RUNWAY_WIDTH := TrackConstants.RUNWAY_WIDTH
const FINISH_ZONE_HALF_HEIGHT := TrackConstants.FINISH_ZONE_HALF_HEIGHT

# ── Export: scene tree → compact dictionary ─────────────────────────────────

static func export_level(level_root: Node3D) -> Dictionary:
	var data: Dictionary = {
		"v": FORMAT_VERSION,
		"n": level_root.get("level_name") if level_root.get("level_name") else "Custom Level",
		"pt": level_root.get("par_time") if level_root.get("par_time") else 45.0,
		"pf": level_root.get("physics_fact") if level_root.get("physics_fact") else "",
	}

	var track_root: Node = _find_child_by_name(level_root, "TrackRoot")
	if track_root:
		data["tw"] = _detect_track_width(track_root)
		data["segs"] = _export_segments(track_root)
		data["obs"]  = _export_obstacles(track_root)
		data["coins"] = _export_coins(track_root)
		# Finish zone position
		var finish: Node = track_root.get_node_or_null("FinishZone")
		if finish:
			data["fz"] = snappedf(finish.position.z, 0.01)
			data["fy"] = snappedf(finish.position.y, 0.01)
			data["fx"] = snappedf(finish.position.x, 0.01)

	return data


static func export_level_code(level_root: Node3D) -> String:
	var data: Dictionary = export_level(level_root)
	var json: String = JSON.stringify(data)
	var bytes: PackedByteArray = json.to_utf8_buffer()
	return Marshalls.raw_to_base64(bytes)


# ── Import: compact dictionary → scene tree ─────────────────────────────────

static func import_level(data: Dictionary, target: Node3D, build_track: bool = true) -> void:
	var version: String = str(data.get("v", FORMAT_VERSION))
	if version.is_empty():
		version = FORMAT_VERSION
	if not version.begins_with("px"):
		push_error("Unsupported level format: %s" % version)
		return

	target.set("level_name", data.get("n", "Custom Level"))
	target.set("par_time", data.get("pt", 45.0))
	target.set("physics_fact", data.get("pf", ""))

	var track_root: Node3D = _ensure_track_root(target)
	if build_track:
		_clear_track_children(track_root)
	else:
		_clear_obstacles_and_coins(track_root)

	var track_width: float = float(data.get("tw", 8.0))
	if build_track:
		var segs: Array[Dictionary] = _segs_from_variant(data.get("segs", []))
		if data.get("mid_only", false):
			segs = _ensure_runway_bookends(segs)
		if segs.is_empty():
			segs = _ensure_runway_bookends([])
		var end_state: Dictionary = _build_floor_and_walls(track_root, segs, track_width)
		var finish_z: float = float(data.get("fz", end_state.get("z", 0.0)))
		var finish_y: float = float(data.get("fy", end_state.get("y", FINISH_ZONE_HALF_HEIGHT)))
		var finish_x: float = float(data.get("fx", end_state.get("x", 0.0)))
		_build_finish(track_root, finish_z, finish_y, finish_x)
	_build_obstacles(track_root, _dict_array_from_variant(data.get("obs", [])))
	_build_coins(track_root, _dict_array_from_variant(data.get("coins", [])))

	# Re-apply materials via TrackBuilder
	var builder: Node = track_root.get_node_or_null("TrackBuilder")
	if builder == null:
		builder = preload("res://scripts/track_builder.gd").new()
		builder.name = "TrackBuilder"
		track_root.add_child(builder)
	if builder.has_method("_apply_materials"):
		builder._apply_materials(track_root)


static func import_level_code(code: String, target: Node3D, build_track: bool = true) -> void:
	var bytes: PackedByteArray = Marshalls.base64_to_raw(code.strip_edges())
	var json: String = bytes.get_string_from_utf8()
	if json.is_empty():
		push_error("Failed to decode level code")
		return
	var parsed: Variant = JSON.parse_string(json)
	if parsed == null:
		push_error("Invalid level code JSON")
		return
	if parsed is Dictionary:
		import_level(parsed, target, build_track)
	else:
		push_error("Invalid level code JSON")


# ── Helpers ───────────────────────────────────────────────────────────────────

static func _find_child_by_name(root: Node, name_: String) -> Node:
	for child: Node in root.get_children():
		if child.name == name_:
			return child
		var found: Node = _find_child_by_name(child, name_)
		if found != null:
			return found
	return null


static func _detect_track_width(track_root: Node) -> float:
	for child: Node in track_root.get_children():
		if child.name == "WallRight" or child.name == "WallRight0":
			var tf: Transform3D = child.transform
			return absf(tf.origin.x) * 2.0
	return 8.0


static func _export_segments(track_root: Node) -> Array[Dictionary]:
	var segs: Array[Dictionary] = []
	for child: Node in track_root.get_children():
		if child is StaticBody3D and child.name == "Floor":
			var mesh_inst: Node = child.get_node_or_null("FloorMesh")
			var shape_node: Node = child.get_node_or_null("FloorShape")
			var length := 100.0
			if mesh_inst and mesh_inst.mesh is BoxMesh:
				length = mesh_inst.mesh.size.z
			elif shape_node and shape_node.shape is BoxShape3D:
				length = shape_node.shape.size.z
			segs.append({
				"t": "floor",
				"l": snappedf(length, 0.01),
				"p": _vec3_array(child.transform.origin),
				"r": _vec3_array(child.rotation_degrees),
			})
		elif child is StaticBody3D and child.name.begins_with("Seg_") and child.name != "Seg_Runway":
			var mesh_inst: Node = child.get_node_or_null("SegMesh")
			var shape_node: Node = child.get_node_or_null("SegShape")
			var length := 100.0
			var width := 8.0
			if mesh_inst and mesh_inst.mesh is BoxMesh:
				length = mesh_inst.mesh.size.z
				width = mesh_inst.mesh.size.x
			elif shape_node and shape_node.shape is BoxShape3D:
				length = shape_node.shape.size.z
				width = shape_node.shape.size.x
			var ramp := 0.0
			if absf(child.rotation.x) > 0.001:
				ramp = tan(child.rotation.x) * length
			var bank := rad_to_deg(child.rotation.z)
			var is_ice := false
			if mesh_inst and mesh_inst.has_meta("mat_type"):
				is_ice = mesh_inst.get_meta("mat_type") == "ice"
			var type := "straight"
			if absf(ramp) > 0.5:
				type = "ramp_up" if ramp > 0 else "ramp_down"
			elif is_ice:
				type = "ice"
			elif width < 6:
				type = "narrow"
			elif width > 10:
				type = "wide"
			elif absf(bank) > 5:
				type = "bank_left" if bank > 0 else "bank_right"
			segs.append({
				"type": type,
				"length": snappedf(length, 0.01),
				"width": snappedf(width, 0.01),
				"ramp": snappedf(ramp, 0.01),
				"bank": snappedf(bank, 0.01),
				"ice": is_ice,
			})
	return segs


static func _export_obstacles(track_root: Node) -> Array[Dictionary]:
	var obs: Array[Dictionary] = []
	for child: Node in track_root.get_children():
		var type_key: String = _obstacle_type_key(child)
		if type_key.is_empty():
			continue
		var entry: Dictionary = {
			"t": type_key,
			"p": _vec3_array(child.transform.origin),
			"r": _vec3_array(child.rotation_degrees),
		}
		# Export custom properties via duck-typing (avoids class-name order issues)
		var bf: Variant = child.get("bump_force")
		if bf != null:
			entry["f"] = snappedf(bf, 0.1)
		var bs: Variant = child.get("boost_strength")
		if bs != null:
			entry["s"] = snappedf(bs, 0.1)
		var ibp: Variant = child.get("is_brake_pad")
		if ibp != null and ibp:
			entry["t"] = "brake"
		var zt: Variant = child.get("zone_type")
		if zt != null:
			entry["zt"] = int(zt)
		var gm: Variant = child.get("gravity_multiplier")
		if gm != null:
			entry["gm"] = snappedf(gm, 0.1)
		var wf: Variant = child.get("wind_force")
		if wf != null:
			entry["wf"] = snappedf(wf, 0.1)
		var wd: Variant = child.get("wind_direction")
		if wd != null:
			entry["wd"] = _vec3_array(wd)
		var mt: Variant = child.get("magnet_type")
		if mt != null:
			entry["mt"] = int(mt)
		var mg: Variant = child.get("strength")
		if mg != null:
			entry["mg"] = snappedf(mg, 0.1)
		var md: Variant = child.get("move_distance")
		if md != null:
			entry["md"] = snappedf(md, 0.1)
		var ma: Variant = child.get("move_axis")
		if ma != null:
			entry["ma"] = _vec3_array(ma)
		var ms: Variant = child.get("move_speed")
		if ms != null:
			entry["ms"] = snappedf(ms, 0.1)
		var ht: Variant = child.get("hint_text")
		if ht != null and not str(ht).is_empty():
			entry["ht"] = str(ht)
		var os: Variant = child.get("one_shot")
		if os != null:
			entry["os"] = bool(os)
		var doe: Variant = child.get("dismiss_on_exit")
		if doe != null:
			entry["doe"] = bool(doe)
		var sd: Variant = child.get("show_duration")
		if sd != null and float(sd) > 0.0:
			entry["sd"] = snappedf(float(sd), 0.1)
		if type_key == "ice":
			var shape_node: Node = child.get_node_or_null("CollisionShape3D")
			if shape_node and shape_node.shape is BoxShape3D:
				entry["l"] = snappedf(shape_node.shape.size.z, 0.1)
				entry["w"] = snappedf(shape_node.shape.size.x, 0.1)
		if type_key == "hoop" or child is Hoop:
			entry["t"] = "hoop"
			var boost: Variant = child.get("boost_strength")
			if boost != null:
				entry["s"] = snappedf(boost, 0.1)
		obs.append(entry)
	return obs


static func _export_coins(track_root: Node) -> Array[Dictionary]:
	var coins: Array[Dictionary] = []
	var coins_node: Node = track_root.get_node_or_null("Coins")
	if coins_node == null:
		return coins
	for child: Node in coins_node.get_children():
		if child is Area3D:
			coins.append({"p": _vec3_array(child.transform.origin)})
	return coins


static func _obstacle_type_key(node: Node) -> String:
	# Match by script path — safe regardless of load order
	var script: Script = node.get_script()
	if script:
		var path: String = script.resource_path
		if path.contains("bumper"):       return "bumper"
		if path.contains("speed_boost"):  return "boost"
		if path.contains("brake_pad"):    return "brake"
		if path.contains("gravity_zone"): return "grav"
		if path.contains("wind_zone"):    return "wind"
		if path.contains("magnet_zone"):  return "magnet"
		if path.contains("ice_patch"):    return "ice"
		if path.contains("moving_platform"): return "move"
		if path.contains("tutorial_trigger"): return "tutorial"
		if path.contains("hoop") or path.contains("checkpoint"):
			return "hoop"
	return ""


static func _vec3_array(v: Vector3) -> Array[float]:
	return [snappedf(v.x, 0.01), snappedf(v.y, 0.01), snappedf(v.z, 0.01)]


# ── Import helpers ────────────────────────────────────────────────────────────

static func _ensure_track_root(level_root: Node3D) -> Node3D:
	var track_root_node: Node = level_root.get_node_or_null("TrackRoot")
	if track_root_node == null:
		track_root_node = Node3D.new()
		track_root_node.name = "TrackRoot"
		level_root.add_child(track_root_node)
		track_root_node.owner = level_root
	return track_root_node


static func _clear_track_children(track_root: Node3D) -> void:
	var to_remove: Array[Node] = []
	for child: Node in track_root.get_children():
		to_remove.append(child)
	for child: Node in to_remove:
		track_root.remove_child(child)
		child.free()


static func _is_track_geometry_node(child: Node) -> bool:
	var n: String = child.name
	if n == "TrackBuilder" or n == "FinishZone" or n == "Runway" or n == "Floor":
		return true
	if child is StaticBody3D and n.begins_with("Seg_"):
		return true
	return false


static func _clear_obstacles_and_coins(track_root: Node3D) -> void:
	for child: Node in track_root.get_children():
		if _is_track_geometry_node(child):
			continue
		child.queue_free()


static func import_obstacles_and_coins(data: Dictionary, target: Node3D) -> void:
	var track_root: Node3D = _ensure_track_root(target)
	_clear_obstacles_and_coins(track_root)
	_build_obstacles(track_root, _dict_array_from_variant(data.get("obs", [])))
	_build_coins(track_root, _dict_array_from_variant(data.get("coins", [])))
	var builder: Node = track_root.get_node_or_null("TrackBuilder")
	if builder != null and builder.has_method("_apply_materials"):
		builder._apply_materials(track_root)


static func _segs_from_variant(raw: Variant) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	if raw is Array:
		for item: Variant in raw:
			if item is Dictionary:
				out.append(item)
	return out


static func _dict_array_from_variant(raw: Variant) -> Array[Dictionary]:
	return _segs_from_variant(raw)


static func _calculate_end_z(segs: Array[Dictionary]) -> float:
	var z: float = 0.0
	for seg: Dictionary in segs:
		z -= seg.get("length", seg.get("l", 100.0))
	return z


static func _ensure_runway_bookends(segs: Array) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for seg: Variant in segs:
		if seg is Dictionary:
			var seg_type: String = seg.get("type", "")
			if seg_type in ["start_runway", "end_runway"]:
				continue
			result.append(seg)
	if result.is_empty() or result[0].get("type", "") != "start_runway":
		result.insert(0, {
			"type": "start_runway", "length": START_RUNWAY_LENGTH, "width": RUNWAY_WIDTH,
			"ramp": 0.0, "bank": 0.0, "ice": false,
		})
	if result.is_empty() or result[-1].get("type", "") != "end_runway":
		result.append({
			"type": "end_runway", "length": END_RUNWAY_LENGTH, "width": RUNWAY_WIDTH,
			"ramp": 0.0, "bank": 0.0, "ice": false,
		})
	return result


static func _build_floor_and_walls(track_root: Node3D, segs: Array[Dictionary], track_width: float) -> Dictionary:
	if segs.is_empty():
		segs = [{"type": "straight", "length": 300.0, "width": track_width, "ramp": 0.0, "bank": 0.0, "ice": false}]
		segs = _ensure_runway_bookends(segs)

	var total_length := 0.0
	for seg: Dictionary in segs:
		total_length += seg.get("length", seg.get("l", 100.0))
	track_root.transform.origin.z = -total_length / 2.0

	var current_z: float = 0.0
	var current_y: float = 0.0
	var last_seg_x: float = 0.0
	var index: int = 0

	for seg: Dictionary in segs:
		var type: String = seg.get("type", "")
		var old_type: String = seg.get("t", "")
		if type.is_empty() and old_type == "floor":
			type = "straight"

		var length: float = maxf(float(seg.get("length", seg.get("l", 100.0))), 0.1)
		var width: float = float(seg.get("width", seg.get("w", track_width)))
		var ramp: float = seg.get("ramp", 0.0)
		var bank: float = seg.get("bank", 0.0)
		var is_ice: bool = seg.get("ice", false)
		var is_gap: bool = type == "gap"

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
			body.owner = track_root.owner

			var mesh_inst := MeshInstance3D.new()
			mesh_inst.name = "SegMesh"
			var mesh := BoxMesh.new()
			mesh.size = Vector3(width, 0.4, length)
			mesh_inst.mesh = mesh
			mesh_inst.set_meta("mat_type", "ice" if is_ice else "track")
			body.add_child(mesh_inst)
			mesh_inst.owner = track_root.owner

			var col := CollisionShape3D.new()
			col.name = "SegShape"
			var shape := BoxShape3D.new()
			shape.size = Vector3(width, 0.4, length)
			col.shape = shape
			body.add_child(col)
			col.owner = track_root.owner

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
				wall.owner = track_root.owner

				var wmesh := MeshInstance3D.new()
				var wbox := BoxMesh.new()
				wbox.size = Vector3(0.3, wh, length)
				wmesh.mesh = wbox
				wmesh.set_meta("mat_type", "wall")
				wall.add_child(wmesh)
				wmesh.owner = track_root.owner

				var wcol := CollisionShape3D.new()
				var wshp := BoxShape3D.new()
				wshp.size = Vector3(0.3, wh, length)
				wcol.shape = wshp
				wall.add_child(wcol)
				wcol.owner = track_root.owner

		current_z -= length
		current_y = seg_y + ramp
		last_seg_x = seg_x
		index += 1

	return {
		"z": current_z,
		"y": current_y + FINISH_ZONE_HALF_HEIGHT,
		"x": last_seg_x,
	}


static func _build_finish(track_root: Node3D, finish_z: float, finish_y: float = 3.0, finish_x: float = 0.0) -> void:
	var finish := Area3D.new()
	finish.name = "FinishZone"
	finish.position = Vector3(finish_x, finish_y, finish_z)
	track_root.add_child(finish)
	finish.owner = track_root.owner

	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(16, 6.0, 20.0)
	shape.shape = box
	finish.add_child(shape)
	shape.owner = track_root.owner

	var mesh := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = Vector3(16, 6.0, 0.1)
	mesh.mesh = box_mesh
	mesh.set_meta("mat_type", "finish")
	finish.add_child(mesh)
	mesh.owner = track_root.owner


static func _build_obstacles(track_root: Node3D, obs: Array[Dictionary]) -> void:
	for entry: Dictionary in obs:
		var type_key: String = entry.get("t", "")
		if type_key == "hoop":
			_spawn_hoop(track_root, entry)
			continue
		var scene_path: String = OBSTACLE_SCENES.get(type_key, "")
		if scene_path.is_empty():
			continue
		var scene := load(scene_path) as PackedScene
		if scene == null:
			continue
		var node := scene.instantiate()
		node.transform.origin = _array_to_vec3(entry.get("p", [0, 0, 0]))
		node.rotation_degrees = _array_to_vec3(entry.get("r", [0, 0, 0]))

		# Apply custom params via duck-typing
		if entry.has("f"):
			node.set("bump_force", entry["f"])
		if entry.has("s"):
			node.set("boost_strength", entry["s"])
		if type_key == "brake":
			node.set("is_brake_pad", true)
		if entry.has("zt"):
			node.set("zone_type", entry["zt"])
		if entry.has("gm"):
			node.set("gravity_multiplier", entry["gm"])
		if entry.has("wf"):
			node.set("wind_force", entry["wf"])
		if entry.has("wd"):
			node.set("wind_direction", _array_to_vec3(entry["wd"]))
		if entry.has("mt"):
			node.set("magnet_type", entry["mt"])
		if entry.has("mg"):
			node.set("strength", entry["mg"])
		if type_key == "ice" and (entry.has("l") or entry.has("w")):
			var shape_node: Node = node.get_node_or_null("CollisionShape3D")
			if shape_node and shape_node.shape is BoxShape3D:
				var l: float = entry.get("l", 10.0)
				var w: float = entry.get("w", 8.0)
				shape_node.shape.size = Vector3(w, 0.2, l)
				var mesh_node: Node = node.get_node_or_null("MeshInstance3D")
				if mesh_node and mesh_node.mesh is BoxMesh:
					mesh_node.mesh.size = Vector3(w, 0.2, l)
		if entry.has("md"):
			node.set("move_distance", entry["md"])
		if entry.has("ma"):
			node.set("move_axis", _array_to_vec3(entry["ma"]))
		if entry.has("ms"):
			node.set("move_speed", entry["ms"])
		if entry.has("ht"):
			node.set("hint_text", entry["ht"])
		if entry.has("os"):
			node.set("one_shot", entry["os"])
		if entry.has("doe"):
			node.set("dismiss_on_exit", entry["doe"])
		if entry.has("sd"):
			node.set("show_duration", entry["sd"])

		track_root.add_child(node)
		node.owner = track_root.owner


static func _spawn_hoop(track_root: Node3D, entry: Dictionary) -> void:
	var hoop := Hoop.new()
	hoop.name = "Hoop"
	hoop.transform.origin = _array_to_vec3(entry.get("p", [0, 0, 0]))
	var boost: float = float(entry.get("s", 28.0))
	hoop.boost_strength = boost
	hoop.build_visuals()
	track_root.add_child(hoop)
	hoop.owner = track_root.owner


static func _build_coins(track_root: Node3D, coins: Array[Dictionary]) -> void:
	if coins.is_empty():
		return
	var coins_node := Node3D.new()
	coins_node.name = "Coins"
	track_root.add_child(coins_node)
	coins_node.owner = track_root.owner

	var coin_scene := load(COIN_SCENE) as PackedScene
	if coin_scene == null:
		return

	for i: int in range(coins.size()):
		var entry: Dictionary = coins[i]
		var coin: Node = coin_scene.instantiate()
		coin.name = "Coin%d" % (i + 1)
		coin.transform.origin = _array_to_vec3(entry.get("p", [0, 1.7, 0]))
		coins_node.add_child(coin)
		coin.owner = track_root.owner


static func _array_to_vec3(arr: Variant) -> Vector3:
	if arr is Array and arr.size() >= 3:
		return Vector3(float(arr[0]), float(arr[1]), float(arr[2]))
	return Vector3.ZERO

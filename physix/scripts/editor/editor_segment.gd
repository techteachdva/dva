extends RefCounted
class_name EditorSegment

var type: String = "straight"
var length: float = 20.0
var width: float = 8.0
var ramp: float = 0.0
var bank: float = 0.0
var ice: bool = false
var snap: String = "M"
var x: float = 0.0
var y: float = 0.0


static func make(type_key: String = "straight") -> EditorSegment:
	var seg := EditorSegment.new()
	var params: Dictionary = EditorDefinitions.SEGMENT_TYPES.get(type_key, {})
	seg.type = type_key
	seg.length = float(params.get("length", 20))
	seg.width = float(params.get("width", 8))
	seg.ramp = float(params.get("ramp", 0))
	seg.bank = float(params.get("bank", 0))
	seg.ice = bool(params.get("ice", false))
	seg.snap = "M"
	seg.x = 0.0
	seg.y = 0.0
	return seg


func to_dict() -> Dictionary:
	return {
		"type": type,
		"length": length,
		"width": width,
		"ramp": ramp,
		"bank": bank,
		"ice": ice,
		"snap": snap,
		"x": x,
		"y": y,
	}


func duplicate_segment() -> EditorSegment:
	var copy := EditorSegment.new()
	copy.type = type
	copy.length = length
	copy.width = width
	copy.ramp = ramp
	copy.bank = bank
	copy.ice = ice
	copy.snap = snap
	copy.x = x
	copy.y = y
	return copy


static func from_dict(raw: Dictionary) -> EditorSegment:
	var seg_type: String = str(raw.get("type", ""))
	if seg_type.is_empty() and raw.get("t", "") == "floor":
		seg_type = "straight"
	elif seg_type.is_empty():
		seg_type = "straight"
	var seg := EditorSegment.new()
	seg.type = seg_type
	seg.length = float(raw.get("length", raw.get("l", 20.0)))
	seg.width = float(raw.get("width", raw.get("w", 8.0)))
	seg.ramp = float(raw.get("ramp", 0.0))
	seg.bank = float(raw.get("bank", 0.0))
	seg.ice = bool(raw.get("ice", false))
	seg.x = float(raw.get("x", 0.0))
	seg.y = float(raw.get("y", 0.0))
	var snap_id: String = str(raw.get("snap", ""))
	if snap_id.is_empty():
		snap_id = EditorSegment.snap_id_from_offsets(seg.x, seg.y)
	seg.apply_snap(snap_id)
	return seg


static func snap_id_from_offsets(offset_x: float, offset_y: float) -> String:
	var best_id := "M"
	var best_dist := INF
	for d: Dictionary in EditorDefinitions.SNAP_DIRS:
		var dx: float = float(d["dx"]) * TrackConstants.SNAP_LATERAL - offset_x
		var dy: float = float(d["dy"]) * TrackConstants.SNAP_VERTICAL - offset_y
		var dist: float = dx * dx + dy * dy
		if dist < best_dist:
			best_dist = dist
			best_id = d["id"]
	return best_id


func apply_snap(snap_id: String) -> void:
	snap = snap_id
	for d: Dictionary in EditorDefinitions.SNAP_DIRS:
		if d["id"] == snap_id:
			x = float(d["dx"]) * TrackConstants.SNAP_LATERAL
			y = float(d["dy"]) * TrackConstants.SNAP_VERTICAL
			return
	snap = "M"
	x = 0.0
	y = 0.0


static func normalize_list(raw: Variant) -> Array[EditorSegment]:
	var out: Array[EditorSegment] = []
	if raw is Array:
		for item: Variant in raw:
			if item is Dictionary:
				var seg_type: String = str(item.get("type", ""))
				if seg_type in ["start_runway", "end_runway"]:
					continue
				if item.has("type") or (item.has("t") and item.get("t") == "floor"):
					out.append(EditorSegment.from_dict(item))
	return out


static func to_dict_array(segments: Array) -> Array:
	var out: Array = []
	for seg: EditorSegment in segments:
		out.append(seg.to_dict())
	return out

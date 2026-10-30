class_name BrandBook
extends RefCounted

# One atlas row per branded creature. The valley shader and the brand studio
# both read it. Parts run left to right: legs, tail, belly, back, neck, head, crown.

const PARTS: Array[String] = ["legs", "tail", "belly", "back", "neck", "head", "crown"]
const SHAPES: Array[String] = ["Natural", "Spikes", "Bulb", "Wing", "Tendril", "Plate", "Horn"]
const TEXTURES: Array[String] = ["Hide", "Scales", "Cracks", "Stars", "Veins", "Eyes", "Ember", "Ridges"]
const PART_NAMES: Array[String] = ["Legs", "Tail", "Belly", "Back", "Neck", "Head", "Crown"]

static var _image: Image
static var _tex: ImageTexture
static var _next: int = 1

static func atlas() -> ImageTexture:
	_ensure()
	return _tex

static func ensure(data: AgentData) -> void:
	if data == null or data.brand.is_empty():
		data.brand_slot = 0
		return
	if data.brand_slot <= 0 or data.brand_slot >= 32:
		data.brand_slot = _next
		_next = 1 if _next >= 31 else _next + 1
		paint(data)

static func fresh(school: String) -> Dictionary:
	var light: bool = school != "dark"
	var parts := {}
	# A ternary of two array literals is an untyped Array, and Godot 4.6
	# refuses to store that in Array[Color]. Branding then never gets a slot.
	var colors: Array[Color] = []
	if light:
		colors = [
			Color(0.95, 0.9, 0.7), Color(0.7, 0.85, 1.0), Color(1.0, 0.95, 0.8),
			Color(0.85, 0.9, 1.0), Color(1.0, 0.8, 0.4), Color(0.95, 0.95, 1.0), Color(1.0, 0.95, 0.6),
		]
	else:
		colors = [
			Color(0.15, 0.05, 0.12), Color(0.3, 0.05, 0.2), Color(0.08, 0.02, 0.06),
			Color(0.2, 0.05, 0.08), Color(0.4, 0.05, 0.05), Color(0.55, 0.08, 0.1), Color(0.7, 0.1, 0.05),
		]
	for i: int in PARTS.size():
		parts[PARTS[i]] = {
			"color": colors[i],
			"texture": 3 if light else 5,
			"size": 0.55,
			"shape": 0,
		}
	return {"school": "light" if light else "dark", "parts": parts}

static func paint(data: AgentData) -> void:
	_ensure()
	var slot: int = data.brand_slot
	if slot <= 0:
		return
	var school: float = 0.0 if str(data.brand.get("school", "light")) == "dark" else 1.0
	var parts: Dictionary = data.brand.get("parts", {})
	for i: int in PARTS.size():
		var row: Dictionary = parts.get(PARTS[i], {})
		var col: Color = row.get("color", Color.WHITE)
		var size: float = clampf(float(row.get("size", 0.5)), 0.0, 1.0)
		_image.set_pixel(i * 2, slot, Color(col.r, col.g, col.b, size))
		var shape: float = clampf(float(row.get("shape", 0)) / 6.0, 0.0, 1.0)
		var tex: float = clampf(float(row.get("texture", 0)) / 7.0, 0.0, 1.0)
		_image.set_pixel(i * 2 + 1, slot, Color(shape, tex, 0.6, school))
	# Compatibility / WebGL often ignores ImageTexture.update on a texture the
	# shader is already sampling. A new texture is what the valley and the
	# studio both pick up on the next draw.
	_tex = ImageTexture.create_from_image(_image)

static func _ensure() -> void:
	if _image != null:
		return
	_image = Image.create(16, 32, false, Image.FORMAT_RGBA8)
	_image.fill(Color(0, 0, 0, 0))
	_tex = ImageTexture.create_from_image(_image)

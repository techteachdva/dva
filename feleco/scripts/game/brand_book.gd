class_name BrandBook
extends RefCounted

# One atlas row per branded creature. The valley shader and the brand studio
# both read it. Parts run left to right: legs, tail, belly, back, neck, head, crown.

const PARTS: Array[String] = ["legs", "tail", "belly", "back", "neck", "head", "crown"]
const SHAPES: Array[String] = ["Natural", "Spikes", "Bulb", "Wing", "Tendril", "Plate", "Horn"]
const TEXTURES: Array[String] = ["Hide", "Scales", "Cracks", "Stars", "Veins", "Eyes", "Ember", "Ridges"]
const PART_NAMES: Array[String] = ["Legs", "Tail", "Belly", "Back", "Neck", "Head", "Crown"]

# Stored size to name. 0.5 is the creature's own natural size (see brand_read).
const SIZES: Array = [["Small", 0.15], ["Natural", 0.5], ["Grand", 0.75], ["Vast", 1.0]]

static var _image: Image
static var _tex: ImageTexture
static var _next: int = 1
# Rows the player has made their own (slot -> weakref to the creature): rare
# coats wrapping round the atlas must not take them.
static var _kept: Dictionary = {}

# Free painting. One small tile per slot in a shared sheet, so a valley full of
# branded creatures costs one texture. A tile covers the sprite's quad, the
# same body space the parts use, so a drawing stays on the body on every frame
# (a limb can slide a little under it mid-stride). Stored as bytes in
# brand["paint"] so it travels with the brand to an heir.
const PAINT_TILE: int = 96
const PAINT_COLS: int = 8
const PAINT_ROWS: int = 4
const BLANK := Color(0.5, 0.5, 0.5, 0.0)
static var _paint_image: Image
static var _paint_tex: ImageTexture
static var _painted: Dictionary = {}

static func atlas() -> ImageTexture:
	_ensure()
	return _tex

static func ensure(data: AgentData) -> void:
	if data == null or data.brand.is_empty():
		data.brand_slot = 0
		return
	if data.brand_slot <= 0 or data.brand_slot >= 32:
		data.brand_slot = _take_slot()
		paint(data)
		_show_paint(data)

static func _take_slot() -> int:
	var slot: int = _next
	for _i: int in 31:
		slot = _next
		_next = 1 if _next >= 31 else _next + 1
		var owner: WeakRef = _kept.get(slot)
		if owner == null or owner.get_ref() == null:
			break
	return slot

# This creature's look is the player's work: its row is never handed on.
static func keep(data: AgentData) -> void:
	if data != null and data.brand_slot > 0:
		_kept[data.brand_slot] = weakref(data)

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
			"texture": 0,
			"size": 0.5,
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

# Which part a point of the body belongs to (brand_part in brand.gdshaderinc).
static func part_at(tx: float, up: float) -> int:
	if up > 0.76 and tx > 0.58:
		return 6
	if tx > 0.76 and up > 0.32:
		return 5
	if tx > 0.60 and up > 0.38:
		return 4
	if up < 0.30:
		return 0
	if tx < 0.30:
		return 1
	if up > 0.52:
		return 3
	return 2

static func paint_atlas() -> ImageTexture:
	_ensure_paint()
	return _paint_tex

static func _ensure_paint() -> void:
	if _paint_image != null:
		return
	_paint_image = Image.create(PAINT_TILE * PAINT_COLS, PAINT_TILE * PAINT_ROWS, false, Image.FORMAT_RGBA8)
	_paint_image.fill(BLANK)
	_paint_tex = ImageTexture.create_from_image(_paint_image)

static func _tile(slot: int) -> Vector2i:
	return Vector2i(slot % PAINT_COLS, slot / PAINT_COLS) * PAINT_TILE

# The creature's drawing as an image to paint on.
static func canvas(data: AgentData) -> Image:
	var bytes: Variant = data.brand.get("paint")
	if bytes is PackedByteArray:
		return Image.create_from_data(PAINT_TILE, PAINT_TILE, false, Image.FORMAT_RGBA8, bytes)
	var img := Image.create(PAINT_TILE, PAINT_TILE, false, Image.FORMAT_RGBA8)
	img.fill(BLANK)
	return img

static func set_canvas(data: AgentData, img: Image) -> void:
	data.brand["paint"] = img.get_data()
	_show_paint(data)

static func _show_paint(data: AgentData) -> void:
	var slot: int = data.brand_slot
	var has_paint: bool = data.brand.get("paint") is PackedByteArray
	if slot <= 0 or (not has_paint and not _painted.has(slot)):
		return
	_ensure_paint()
	_paint_image.blit_rect(canvas(data), Rect2i(0, 0, PAINT_TILE, PAINT_TILE), _tile(slot))
	if has_paint:
		_painted[slot] = true
	else:
		_painted.erase(slot)
	# A new texture, for the same WebGL reason as paint() above.
	_paint_tex = ImageTexture.create_from_image(_paint_image)

static func _ensure() -> void:
	if _image != null:
		return
	_image = Image.create(16, 32, false, Image.FORMAT_RGBA8)
	_image.fill(Color(0, 0, 0, 0))
	_tex = ImageTexture.create_from_image(_image)

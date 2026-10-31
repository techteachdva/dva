class_name Cosmetics
extends RefCounted

# Looks: the only things a god's-eye player can wear. Mouse cursors (the
# emblem itself is the pointer: a big leaf, paw or worm with a small gold tip
# at its top-left, where it clicks) and auras for the creature you adopt.
# Some are bought with EP in the Greenhouse; the best are earned in play.
# Saved in the records under "cosmetic": owned:<id>, cursor, aura.

# [id, name, cost (-1: earned), how to earn / what it is, emblem colour].
const CURSORS: Array = [
	["classic", "Classic", 0, "The plain arrow.", Color(1, 1, 1)],
	["leaf", "Leaf", 20, "A green leaf rides on your arrow.", Color(0.45, 0.85, 0.35)],
	["paw", "Paw Print", 30, "A soft paw.", Color(0.85, 0.65, 0.45)],
	["feather", "Falcon Feather", 30, "A barred feather.", Color(0.6, 0.7, 0.9)],
	["mushroom", "Toadstool", 40, "A red-capped mushroom.", Color(0.9, 0.3, 0.25)],
	["worm", "Wiggler", 25, "Point with a worm. It's a worm.", Color(0.85, 0.5, 0.55)],
	["wand", "Wizard's Star", 60, "A golden star, for the wizards.", Color(1, 0.85, 0.3)],
	["claw", "Golden Claw", -1, "Earned: win a golden Rampage.", Color(1, 0.75, 0.2)],
	["diamond", "Diamond", -1, "Earned: find the rare diamond.", Color(0.6, 0.95, 1.0)],
	["fairy", "Fairy Bloom", -1, "Earned: claim a Flower Fairy.", Color(0.98, 0.55, 0.8)],
	["sunflower", "Sunflower", -1, "Earned: claim a Sunflowerfolk.", Color(0.98, 0.8, 0.2)],
	["pumpkin", "Jack-o'-Lantern", -1, "Earned: claim a Jack-o'-Scarecrow.", Color(0.95, 0.5, 0.12)],
	["snowflake", "Snowball", -1, "Earned: claim a Snowperson.", Color(0.85, 0.95, 1.0)],
]
# [id, name, cost, how / what, colour].
const AURAS: Array = [
	["none", "No aura", 0, "Your creature, plain.", Color(0, 0, 0, 0)],
	["gold", "Golden Glow", 40, "A warm gold ring.", Color(1, 0.82, 0.3)],
	["spirit", "Spirit Blue", 40, "A cool spirit ring.", Color(0.45, 0.75, 1.0)],
	["ember", "Ember", 40, "A smouldering ring.", Color(1, 0.4, 0.2)],
	["rainbow", "Rainbow", -1, "Earned: raise a creature to level 5.", Color(1, 1, 1)],
]

static func owns(gc: Node, id: String) -> bool:
	if id == "classic" or id == "none":
		return true
	return gc != null and gc.record("cosmetic", "owned:" + id) != null

static func grant(gc: Node, id: String) -> bool:
	if gc == null or owns(gc, id):
		return false
	gc.set_record("cosmetic", "owned:" + id, true)
	return true

static func equipped(gc: Node, slot: String) -> String:
	var v = gc.record("cosmetic", slot) if gc != null else null
	return String(v) if v != null else ("classic" if slot == "cursor" else "none")

static func equip(gc: Node, slot: String, id: String) -> void:
	gc.set_record("cosmetic", slot, id)
	if slot == "cursor":
		apply_cursor(gc)

static func _row(list: Array, id: String) -> Array:
	for r: Array in list:
		if r[0] == id:
			return r
	return list[0]

static func aura_color(gc: Node) -> Color:
	return _row(AURAS, equipped(gc, "aura"))[4]

# --- Cursors ------------------------------------------------------------------

static func apply_cursor(gc: Node) -> void:
	var id: String = equipped(gc, "cursor")
	if id == "classic":
		for shape: int in [Input.CURSOR_ARROW, Input.CURSOR_POINTING_HAND, Input.CURSOR_HELP]:
			Input.set_custom_mouse_cursor(null, shape)
		return
	var tex := cursor_texture(id)
	# Every shape a button or panel might ask for, so no plain arrow sneaks in.
	for shape: int in [Input.CURSOR_ARROW, Input.CURSOR_POINTING_HAND, Input.CURSOR_HELP, Input.CURSOR_DRAG, Input.CURSOR_CAN_DROP, Input.CURSOR_MOVE]:
		Input.set_custom_mouse_cursor(tex, shape, Vector2(2, 2))

const CURSOR_SIZE: int = 48
static var _cursor_cache: Dictionary = {}

# A 48px cursor: the emblem fills it, and a small outlined tip at the top-left
# corner marks the hotspot, so it always reads as the chosen look (the old
# version was a plain arrow with a tiny badge and looked like no change).
static func cursor_texture(id: String) -> ImageTexture:
	if _cursor_cache.has(id):
		return _cursor_cache[id]
	var img := Image.create(CURSOR_SIZE, CURSOR_SIZE, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var row: Array = _row(CURSORS, id)
	var col: Color = row[4]
	var c := Vector2(27, 27)
	match id:
		"classic":
			var arrow := PackedVector2Array([Vector2(1, 1), Vector2(1, 31), Vector2(9, 24), Vector2(15, 37), Vector2(20, 35), Vector2(14, 22), Vector2(24, 22)])
			_fill(img, arrow, Color(0.08, 0.06, 0.04), 1.6)
			_fill(img, arrow, Color.WHITE, 0.0)
		"leaf":
			_ellipse(img, c, Vector2(17, 9), 0.75, col.darkened(0.45), 1.5)
			_ellipse(img, c, Vector2(17, 9), 0.75, col)
			_line(img, c - Vector2(12, 11), c + Vector2(12, 11), col.darkened(0.4))
		"paw":
			_disc(img, c + Vector2(0, 6), 10.0, col.darkened(0.5))
			_disc(img, c + Vector2(0, 6), 8.5, col)
			for k: int in 4:
				var toe := c + Vector2(-11 + k * 7.3, -6 - (3.5 if k in [1, 2] else 0.0))
				_disc(img, toe, 4.5, col.darkened(0.5))
				_disc(img, toe, 3.4, col)
		"feather":
			_ellipse(img, c, Vector2(19, 7), -0.8, col.darkened(0.45), 1.5)
			_ellipse(img, c, Vector2(19, 7), -0.8, col)
			for k: int in 5:
				var q: Vector2 = c + Vector2(-9 + k * 4.5, 9 - k * 4.5)
				_line(img, q, q + Vector2(5, 5), col.darkened(0.3))
			_line(img, c + Vector2(-14, 14), c + Vector2(14, -14), col.darkened(0.55))
		"mushroom":
			_rect(img, Rect2(c.x - 4, c.y - 1, 8, 16), Color(0.95, 0.92, 0.85))
			_ellipse(img, c + Vector2(0, -4), Vector2(16, 10), 0.0, col.darkened(0.45), 1.5)
			_ellipse(img, c + Vector2(0, -4), Vector2(16, 10), 0.0, col)
			_disc(img, c + Vector2(-7, -7), 2.6, Color.WHITE)
			_disc(img, c + Vector2(5, -9), 2.2, Color.WHITE)
			_disc(img, c + Vector2(1, -2), 1.8, Color.WHITE)
		"worm":
			# The valley's own worm sprite, curled across the cursor.
			var path: String = SpriteGenerator.SPRITE_DIR + "worm.png"
			if ResourceLoader.exists(path):
				var sheet: Image = (load(path) as Texture2D).get_image()
				if sheet != null:
					sheet.decompress()
					var cell: Image = sheet.get_region(Rect2i(0, 0, sheet.get_height() / 2, sheet.get_height() / 2))
					cell.convert(Image.FORMAT_RGBA8)
					cell.resize(44, 44, Image.INTERPOLATE_BILINEAR)
					img.blend_rect(cell, Rect2i(0, 0, 44, 44), Vector2i(4, 4))
			else:
				for k: int in 9:
					_disc(img, c + Vector2(-14 + k * 3.5, sin(k * 0.9) * 5.0), 4.0, col)
		"fairy", "sunflower", "pumpkin", "snowflake":
			_disc(img, c, 16.0, col.darkened(0.5))
			_disc(img, c, 14.5, col)
			_disc(img, c, 6.0, Color(0.35, 0.2, 0.1) if id == "sunflower" else col.lightened(0.6))
		"wand", "claw", "diamond":
			var pts := PackedVector2Array()
			var spikes: int = 5 if id == "wand" else (3 if id == "claw" else 4)
			for k: int in spikes * 2:
				var rad: float = 17.0 if k % 2 == 0 else (7.0 if id != "diamond" else 17.0 * 0.55)
				pts.append(c + Vector2.from_angle(-PI * 0.5 + k * PI / spikes) * rad)
			_fill(img, pts, col.darkened(0.45), 1.6)
			_fill(img, pts, col, 0.0)
	if id != "classic":
		# The click tip.
		var tip := PackedVector2Array([Vector2(1, 1), Vector2(13, 5), Vector2(5, 13)])
		_fill(img, tip, Color(0.08, 0.06, 0.04), 1.4)
		_fill(img, tip, Color(1.0, 0.86, 0.35), 0.0)
	var tex := ImageTexture.create_from_image(img)
	_cursor_cache[id] = tex
	return tex

static func _fill(img: Image, poly: PackedVector2Array, col: Color, grow: float) -> void:
	for y: int in img.get_height():
		for x: int in img.get_width():
			var p := Vector2(x + 0.5, y + 0.5)
			var inside: bool = Geometry2D.is_point_in_polygon(p, poly)
			if not inside and grow > 0.0:
				for i: int in poly.size():
					if p.distance_to(Geometry2D.get_closest_point_to_segment(p, poly[i], poly[(i + 1) % poly.size()])) <= grow:
						inside = true
						break
			if inside:
				img.set_pixel(x, y, col)

static func _disc(img: Image, c: Vector2, r: float, col: Color) -> void:
	for y: int in img.get_height():
		for x: int in img.get_width():
			if Vector2(x + 0.5, y + 0.5).distance_to(c) <= r:
				img.set_pixel(x, y, col)

static func _ellipse(img: Image, c: Vector2, r: Vector2, ang: float, col: Color, grow: float = 0.0) -> void:
	r += Vector2(grow, grow)
	for y: int in img.get_height():
		for x: int in img.get_width():
			var d: Vector2 = (Vector2(x + 0.5, y + 0.5) - c).rotated(-ang)
			if (d.x * d.x) / (r.x * r.x) + (d.y * d.y) / (r.y * r.y) <= 1.0:
				img.set_pixel(x, y, col)

static func _rect(img: Image, r: Rect2, col: Color) -> void:
	for y: int in range(int(r.position.y), int(r.end.y)):
		for x: int in range(int(r.position.x), int(r.end.x)):
			if x >= 0 and y >= 0 and x < img.get_width() and y < img.get_height():
				img.set_pixel(x, y, col)

static func _line(img: Image, a: Vector2, b: Vector2, col: Color) -> void:
	for k: int in 48:
		var p: Vector2 = a.lerp(b, k / 47.0)
		if p.x >= 0 and p.y >= 0 and p.x < img.get_width() and p.y < img.get_height():
			img.set_pixel(int(p.x), int(p.y), col)

# --- Auras --------------------------------------------------------------------

# A glowing ring on the ground under the adopted creature (a child of it,
# so it follows). Returns null for "none".
static func make_aura(gc: Node) -> Node3D:
	var id: String = equipped(gc, "aura")
	if id == "none":
		return null
	var mi := MeshInstance3D.new()
	mi.name = "Aura"
	var q := QuadMesh.new()
	q.size = Vector2(2.6, 2.6)
	q.orientation = PlaneMesh.FACE_Y
	mi.mesh = q
	var grad := Gradient.new()
	var c: Color = aura_color(gc)
	grad.offsets = PackedFloat32Array([0.0, 0.55, 0.75, 1.0])
	grad.colors = PackedColorArray([Color(c.r, c.g, c.b, 0.0), Color(c.r, c.g, c.b, 0.15), Color(c.r, c.g, c.b, 0.85), Color(c.r, c.g, c.b, 0.0)])
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_texture = tex
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	if id == "rainbow":
		mat.albedo_color = Color(1, 1, 1)
		mat.set_meta("rainbow", true)
	mi.material_override = mat
	mi.position = Vector3(0, 0.06, 0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

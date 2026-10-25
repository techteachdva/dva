class_name SpriteGenerator

# Procedural creature art. Each sprite is painted at 2x with soft volume
# shading, then outlined and box-filtered down, so edges stay clean under
# alpha scissor. Creatures are drawn in side profile facing right; the
# sprite shader mirrors them when they walk left.
#
# Every species has an atlas: columns are the kinds (normal, tough,
# special), rows the sexes (male on top, female below). The game loads the
# baked atlases in res://assets/sprites/ (see bake_all); painting at runtime
# is only a fallback because it costs seconds on the web.

const SIZE: int = 128
const SS: int = 2
const SPRITE_DIR: String = "res://assets/sprites/"
const SPECIES: Array[String] = ["sheep", "wolf", "boar", "falcon", "robin", "worm", "human", "rabbit", "fish", "mushroom"]
const COLS: int = 3
const ROWS: int = 2

static var _img: Image
static var _w: int = 0
static var _h: int = 0

static func cell_size(species: String) -> Vector2i:
	return Vector2i(SIZE, SIZE / 2) if species == "fish" else Vector2i(SIZE, SIZE)

static func texture_for(species: String) -> Texture2D:
	var path := SPRITE_DIR + species + ".png"
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return ImageTexture.create_from_image(atlas_image(species))

static func texture_for_shadow() -> Texture2D:
	var path := SPRITE_DIR + "shadow.png"
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return ImageTexture.create_from_image(shadow_image())

static func atlas_image(species: String) -> Image:
	var cell := cell_size(species)
	var atlas := Image.create(cell.x * COLS, cell.y * ROWS, false, Image.FORMAT_RGBA8)
	atlas.fill(Color(0.1, 0.08, 0.07, 0.0))
	for row: int in ROWS:
		for col: int in COLS:
			var img := generate_image(species, col, row == 1)
			atlas.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(col * cell.x, row * cell.y))
	return atlas

# role: 0 normal, 1 tough, 2 special.
static func generate_image(species: String, role: int = 0, female: bool = false) -> Image:
	var ink := Color(0.1, 0.08, 0.07)
	_begin(cell_size(species), ink)
	match species:
		"sheep": _sheep(role, female)
		"wolf": _wolf(role, female)
		"boar": _boar(role, female)
		"falcon": _falcon(role, female)
		"robin": _robin(role, female)
		"worm": _worm(role, female)
		"human": _human(role, female)
		"rabbit": _rabbit(role, female)
		"fish": _fish(role, female)
		"mushroom": _mushroom(role)
	return _finish(ink, 3)

# Writes every species atlas, the blob shadow and the grass tuft to dir.
static func bake_all(dir: String) -> void:
	DirAccess.make_dir_recursive_absolute(dir)
	for s: String in SPECIES:
		atlas_image(s).save_png(dir.path_join(s + ".png"))
	shadow_image().save_png(dir.path_join("shadow.png"))
	tuft_image().save_png(dir.path_join("tuft.png"))
	mycelium_image().save_png(dir.path_join("mycelium.png"))

static func _pick(role: int, female: bool, table: Array) -> Color:
	return table[role * 2 + (1 if female else 0)]

# ------------------------------------------------------------------
# Creatures (coordinates in 128-space; feet rest near y = 122)
# ------------------------------------------------------------------
static func _sheep(r: int, f: bool) -> void:
	# normal: cream wool; Highlander: shaggy oatmeal; Golden Fleece: gold wool, white face.
	var wool: Color = _pick(r, f, [Color(0.97, 0.95, 0.89), Color(0.98, 0.96, 0.92), Color(0.74, 0.62, 0.48), Color(0.8, 0.7, 0.56), Color(0.98, 0.8, 0.32), Color(1.0, 0.86, 0.46)])
	var face: Color = [Color(0.24, 0.21, 0.21), Color(0.36, 0.24, 0.16), Color(0.94, 0.9, 0.82)][r]
	var horn: Color = [Color(0.72, 0.62, 0.46), Color(0.42, 0.32, 0.22), Color(0.96, 0.9, 0.7)][r]
	var leg: Color = face.darkened(0.15) if r != 2 else Color(0.3, 0.26, 0.22)
	var thick: float = 7.0 if r == 1 else 5.5
	_line(Vector2(42, 92), Vector2(40, 121), thick - 0.5, leg.darkened(0.25))
	_line(Vector2(78, 92), Vector2(80, 121), thick - 0.5, leg.darkened(0.25))
	_ell(60, 80, 36, 24, wool.darkened(0.12))
	for b: Vector3 in [Vector3(30, 74, 13), Vector3(42, 62, 14), Vector3(58, 57, 15), Vector3(74, 60, 14),
			Vector3(87, 70, 12), Vector3(30, 88, 11), Vector3(46, 96, 12), Vector3(64, 98, 12), Vector3(82, 94, 11)]:
		_circ(b.x, b.y, b.z, wool)
	_ell(60, 76, 30, 18, wool)
	if r == 1:
		# Long shaggy fringe under the belly.
		for i: int in 7:
			var x: float = 30.0 + i * 9.0
			_poly([Vector2(x - 5, 96), Vector2(x, 108 + (i % 2) * 4), Vector2(x + 5, 96)], wool.darkened(0.08), 0.4)
	_line(Vector2(50, 96), Vector2(50, 122), thick, leg)
	_line(Vector2(84, 94), Vector2(86, 122), thick, leg)
	_ell(50, 121, 4.5, 2.5, Color(0.1, 0.09, 0.09), 0.0, 0.0)
	_ell(86, 121, 4.5, 2.5, Color(0.1, 0.09, 0.09), 0.0, 0.0)
	_ell(90, 58, 10, 4.5, face.darkened(0.2), 28.0)
	_ell(101, 68, 12, 17, face, -28.0)
	_circ(94, 52, 8, wool)
	_circ(102, 50, 7, wool)
	if not f:
		# Ram: a full curl of horn around the ear.
		var big: float = 1.25 if r == 1 else 1.0
		_arc(91, 60, 9.0 * big, -110.0, 170.0, 5.5 * big, horn)
		_arc(91, 60, 4.5 * big, -60.0, 120.0, 3.5 * big, horn.darkened(0.12))
	elif r == 1:
		_arc(92, 54, 6.0, -150.0, -10.0, 3.6, horn)
	_eye(104, 63, 3.6, Color(0.95, 0.93, 0.85))
	if f:
		_line(Vector2(101, 58), Vector2(107, 57), 1.2, Color(0.08, 0.07, 0.07), 0.0)
	_dot(111, 78, 1.6, Color(0.08, 0.07, 0.07))
	if r == 1:
		# Bellwether's bell.
		_line(Vector2(88, 80), Vector2(96, 84), 2.0, Color(0.5, 0.25, 0.15), 0.0)
		_circ(93, 89, 4.0, Color(0.9, 0.72, 0.3))
	elif r == 2:
		for p: Vector2 in [Vector2(40, 64), Vector2(66, 60), Vector2(54, 84), Vector2(78, 78)]:
			_star(p.x, p.y, 3.4, Color(1.0, 0.98, 0.85))
		if f:
			_circ(97, 46, 3.2, Color(1.0, 1.0, 1.0), 0.0)
			_dot(97, 46, 1.4, Color(0.98, 0.8, 0.2))

static func _wolf(r: int, f: bool) -> void:
	# normal: grey; Alpha: charcoal, scarred; Moon Howler: silver-blue with a moon mark.
	var fur: Color = _pick(r, f, [Color(0.46, 0.49, 0.56), Color(0.56, 0.55, 0.56), Color(0.28, 0.28, 0.31), Color(0.34, 0.32, 0.34), Color(0.76, 0.82, 0.92), Color(0.84, 0.86, 0.94)])
	var dark: Color = fur.darkened(0.4)
	var cream: Color = Color(0.96, 0.97, 1.0) if r == 2 else Color(0.86, 0.83, 0.75)
	var eye: Color = [Color(0.98, 0.78, 0.25), Color(0.98, 0.5, 0.2), Color(0.45, 0.85, 1.0)][r]
	var bulk: float = (2.0 if r == 1 else 0.0) + (0.0 if f else 1.5)
	_ell(22, 80, 19, 8, dark, 38.0)
	_ell(12, 92, 7, 5, cream, 38.0)
	_line(Vector2(40, 88), Vector2(36, 121), 6.5, dark.darkened(0.2))
	_line(Vector2(78, 88), Vector2(81, 121), 6.5, dark.darkened(0.2))
	_ell(58, 80, 34, 16 + bulk, fur)
	_ell(54, 70, 28, 7 + bulk * 0.5, dark)
	_ell(62, 92, 22, 6, cream)
	_ell(84, 82, 14, 15, cream)
	if not f:
		# Males carry a heavy ruff.
		_ell(86, 66, 13, 17, fur.lightened(0.08), -20.0)
	_poly([Vector2(76, 70), Vector2(94, 50), Vector2(106, 58), Vector2(92, 88)], fur)
	_poly([Vector2(91, 48), Vector2(95, 30), Vector2(102, 46)], dark)
	_poly([Vector2(98, 46), Vector2(104, 32), Vector2(108, 48)], dark.darkened(0.15))
	_ell(100, 56, 13, 11, fur)
	_poly([Vector2(104, 51), Vector2(124, 59), Vector2(123, 66), Vector2(104, 67)], cream)
	_dot(123, 60.5, 2.6, Color(0.08, 0.07, 0.07))
	_line(Vector2(110, 66), Vector2(121, 65), 1.0, Color(0.15, 0.12, 0.12), 0.0)
	_line(Vector2(48, 92), Vector2(48, 122), 7.0 + bulk * 0.4, fur)
	_line(Vector2(86, 92), Vector2(90, 122), 7.0 + bulk * 0.4, fur)
	_ell(48, 121, 4.5, 2.5, dark, 0.0, 0.0)
	_ell(90, 121, 4.5, 2.5, dark, 0.0, 0.0)
	_eye(104, 52, 2.8, eye)
	if r == 1:
		_line(Vector2(98, 44), Vector2(108, 60), 1.4, Color(0.85, 0.65, 0.6), 0.0)
		_line(Vector2(102, 44), Vector2(110, 56), 1.2, Color(0.85, 0.65, 0.6), 0.0)
		if f:
			_ell(84, 84, 7, 9, Color(0.97, 0.97, 0.95))
	elif r == 2:
		if f:
			_star(56, 74, 6.0, Color(0.98, 0.96, 0.75))
		else:
			_circ(56, 74, 7, Color(0.98, 0.96, 0.75), 0.0)
			_circ(59, 72, 6.5, fur, 0.0)

static func _boar(r: int, f: bool) -> void:
	# normal: brown; Tusker: near-black, huge tusks; Truffler: russet with a gold snout ring.
	var body: Color = _pick(r, f, [Color(0.46, 0.33, 0.23), Color(0.6, 0.46, 0.34), Color(0.24, 0.19, 0.17), Color(0.34, 0.27, 0.22), Color(0.72, 0.42, 0.22), Color(0.82, 0.54, 0.32)])
	var bristle: Color = body.darkened(0.42)
	var snout := Color(0.74, 0.52, 0.46)
	var ivory := Color(0.96, 0.92, 0.8)
	_line(Vector2(22, 80), Vector2(15, 88), 2.0, bristle, 0.0)
	_line(Vector2(44, 98), Vector2(42, 121), 6.0, bristle)
	_line(Vector2(80, 98), Vector2(82, 121), 6.0, bristle)
	_ell(58, 84, 38, 25 if not f else 22, body)
	var mane: float = 1.0 if not f else 0.5
	for i: int in 9:
		var x: float = 30.0 + i * 7.0
		var top: float = 60.0 - sin(float(i) / 8.0 * PI) * 6.0 + (4.0 if f else 0.0)
		_poly([Vector2(x - 5, top + 9), Vector2(x + 1, top + 9 - 14 * mane), Vector2(x + 5, top + 9)], bristle, 0.4)
	_ell(56, 98, 26, 8, body.lightened(0.12))
	_line(Vector2(52, 100), Vector2(52, 122), 7.0, body.darkened(0.1))
	_line(Vector2(86, 98), Vector2(88, 122), 7.0, body.darkened(0.1))
	_ell(52, 121, 5, 2.5, Color(0.12, 0.09, 0.07), 0.0, 0.0)
	_ell(88, 121, 5, 2.5, Color(0.12, 0.09, 0.07), 0.0, 0.0)
	_poly([Vector2(82, 66), Vector2(110, 72), Vector2(122, 86), Vector2(118, 98), Vector2(92, 100), Vector2(80, 88)], body.lightened(0.05))
	_poly([Vector2(90, 68), Vector2(95, 52), Vector2(103, 70)], bristle)
	_ell(121, 91, 4.5, 6.5, snout)
	_dot(122, 89, 1.2, Color(0.2, 0.1, 0.08))
	_dot(122, 94, 1.2, Color(0.2, 0.1, 0.08))
	if not f or r == 1:
		var t: float = 1.0
		if r == 1:
			t = 0.7 if f else 1.6
		_poly([Vector2(110, 96), Vector2(110 + 9 * t, 96 - 16 * t), Vector2(115, 97)], ivory, 0.3)
	_eye(103, 79, 2.4, Color(0.3, 0.18, 0.1))
	if r == 1:
		_line(Vector2(40, 76), Vector2(54, 84), 1.4, Color(0.55, 0.5, 0.48), 0.0)
		_line(Vector2(62, 72), Vector2(70, 82), 1.4, Color(0.55, 0.5, 0.48), 0.0)
	elif r == 2:
		_arc(121, 91, 5.5, -80.0, 80.0, 1.8, Color(0.98, 0.8, 0.3))
		_line(Vector2(54, 58), Vector2(54, 64), 3.0, Color(0.95, 0.92, 0.84), 0.0)
		_ell(54, 56, 8, 4.5, Color(0.86, 0.24, 0.16))
		_dot(51, 55, 1.2, Color(1, 1, 1))
		_dot(57, 54, 1.0, Color(1, 1, 1))
		if f:
			_circ(96, 56, 3.0, Color(0.98, 0.7, 0.8), 0.0)

static func _falcon(r: int, f: bool) -> void:
	# normal: slate tiercel / brown female; Gyrfalcon: white, speckled; Sky Seer: gold with a crest.
	var slate: Color = _pick(r, f, [Color(0.42, 0.47, 0.56), Color(0.54, 0.43, 0.32), Color(0.92, 0.93, 0.95), Color(0.74, 0.76, 0.8), Color(0.88, 0.66, 0.3), Color(0.86, 0.62, 0.36)])
	var dark: Color = _pick(r, f, [Color(0.24, 0.27, 0.33), Color(0.32, 0.25, 0.18), Color(0.45, 0.47, 0.52), Color(0.36, 0.38, 0.42), Color(0.5, 0.32, 0.15), Color(0.48, 0.36, 0.62)])
	var cream := Color(0.93, 0.88, 0.76)
	var gold := Color(0.98, 0.8, 0.25)
	var span: float = 1.0 if f else 0.92
	_poly([Vector2(58, 60), Vector2(58 - 32 * span, 14), Vector2(14, 20), Vector2(18, 36), Vector2(34, 56), Vector2(46, 66)], dark)
	_poly([Vector2(38, 66), Vector2(12, 72), Vector2(12, 84), Vector2(40, 76)], slate)
	for i: int in 3:
		_line(Vector2(18, 74 + i * 4), Vector2(34, 72 + i * 2), 1.2, dark, 0.0)
	_ell(64, 68, 28, 11 if not f else 12.5, slate, -8.0)
	_ell(74, 74, 15, 7, cream, -8.0)
	for i: int in (4 if not f else 7):
		_dot(66 + i * 3.5, 74 + (i % 2) * 2, 1.2, dark)
	_poly([Vector2(62, 64), Vector2(62 + 42 * span, 18), Vector2(120, 24), Vector2(114, 40), Vector2(94, 58), Vector2(78, 70)], slate.lightened(0.08))
	_poly([Vector2(108, 20), Vector2(120, 26), Vector2(112, 36), Vector2(102, 30)], dark)
	for i: int in 3:
		_line(Vector2(78 + i * 6, 60 - i * 6), Vector2(90 + i * 6, 52 - i * 6), 1.2, dark, 0.0)
	if r == 1:
		for p: Vector2 in [Vector2(84, 50), Vector2(96, 40), Vector2(90, 56), Vector2(104, 34), Vector2(76, 62), Vector2(30, 40), Vector2(40, 52)]:
			_dot(p.x, p.y, 1.5, Color(0.2, 0.22, 0.26))
	_circ(92, 59, 10, dark if r != 1 else slate.darkened(0.1))
	_ell(95, 64, 5, 4, cream, 0.0, 0.4)
	if r == 2:
		for i: int in 3:
			_poly([Vector2(84 + i * 3, 52), Vector2(80 + i * 4, 40 - i * 2), Vector2(88 + i * 3, 50)], gold.darkened(0.1), 0.3)
		_ell(97, 56, 5, 2.5, Color(0.3, 0.55, 0.95), 0.0, 0.2)
	_poly([Vector2(100, 56), Vector2(111, 60), Vector2(101, 65)], gold)
	_dot(109, 60, 1.4, Color(0.1, 0.1, 0.1))
	_eye(95, 56, 2.8, gold)

static func _robin(r: int, f: bool) -> void:
	# normal: red breast (paler hen); Mistle Thrush: spotted breast; Bluebird: blue back.
	var back: Color = _pick(r, f, [Color(0.46, 0.39, 0.31), Color(0.54, 0.47, 0.39), Color(0.55, 0.45, 0.32), Color(0.63, 0.55, 0.43), Color(0.26, 0.46, 0.86), Color(0.55, 0.6, 0.72)])
	var head: Color = back.darkened(0.25) if r != 2 else back.darkened(0.08)
	var breast: Color = _pick(r, f, [Color(0.93, 0.45, 0.18), Color(0.92, 0.62, 0.42), Color(0.94, 0.88, 0.72), Color(0.95, 0.9, 0.78), Color(0.9, 0.5, 0.25), Color(0.92, 0.7, 0.52)])
	var leg := Color(0.62, 0.42, 0.26)
	var big: float = 1.15 if r == 1 else 1.0
	_poly([Vector2(30, 74), Vector2(8, 62), Vector2(10, 72), Vector2(30, 84)], back.darkened(0.15))
	_line(Vector2(58, 96), Vector2(55, 118), 2.0, leg, 0.0)
	_line(Vector2(68, 96), Vector2(70, 118), 2.0, leg, 0.0)
	_line(Vector2(50, 118), Vector2(60, 118), 1.6, leg, 0.0)
	_line(Vector2(66, 118), Vector2(76, 118), 1.6, leg, 0.0)
	_ell(58, 80, 28 * big, 20 * big, back)
	_ell(72, 87, 19 * big, 15 * big, breast)
	if r == 1:
		for p: Vector2 in [Vector2(66, 82), Vector2(74, 86), Vector2(70, 92), Vector2(80, 90), Vector2(64, 92), Vector2(78, 80), Vector2(72, 98)]:
			_dot(p.x, p.y, 1.8, Color(0.3, 0.22, 0.14))
	_ell(48, 78, 19, 10, back.darkened(0.18), 12.0)
	for i: int in 3:
		_line(Vector2(36 + i * 6, 80), Vector2(48 + i * 6, 84), 1.0, back.darkened(0.35), 0.0)
	_circ(82, 60, 15, head)
	if r != 1:
		_ell(88, 71, 10, 8, breast)
	_poly([Vector2(95, 57), Vector2(107, 61), Vector2(95, 65)], Color(0.86, 0.66, 0.3))
	_eye(88, 56, 3.2, Color(0.95, 0.92, 0.86))

static func _worm(r: int, f: bool) -> void:
	# Earthworms are both sexes at once; the two rows differ in their band.
	var skin: Color = _pick(r, f, [Color(0.86, 0.5, 0.52), Color(0.9, 0.62, 0.6), Color(0.52, 0.27, 0.25), Color(0.6, 0.33, 0.29), Color(0.74, 0.9, 0.42), Color(0.58, 0.88, 0.62)])
	var band: Color = _pick(r, f, [Color(0.95, 0.66, 0.6), Color(0.98, 0.78, 0.7), Color(0.72, 0.42, 0.36), Color(0.8, 0.5, 0.42), Color(0.95, 1.0, 0.7), Color(0.9, 1.0, 0.82)])
	var fat: float = 2.2 if r == 1 else 0.0
	var n: int = 22
	var band_lo: int = 15 if not f else 14
	var band_hi: int = 16 if not f else 17
	for i: int in n:
		var t: float = float(i) / float(n - 1)
		var x: float = 14.0 + t * 98.0
		var y: float = 104.0 + sin(t * TAU * 1.1) * 8.0
		var rad: float = lerpf(5.0, 8.0, sin(t * PI * 0.9 + 0.2)) + fat
		_circ(x, y, rad, band if i >= band_lo and i <= band_hi else skin)
	for i: int in range(1, n - 1, 2):
		var t: float = float(i) / float(n - 1)
		var x: float = 14.0 + t * 98.0
		var y: float = 104.0 + sin(t * TAU * 1.1) * 8.0
		_line(Vector2(x, y - 5 - fat), Vector2(x, y + 5 + fat), 0.9, skin.darkened(0.25), 0.0)
	if r == 2:
		_circ(16, 104, 6.0, Color(0.98, 1.0, 0.6), 0.0)
		_dot(16, 104, 3.0, Color(1.0, 1.0, 0.9))
	_dot(110, 99 - fat, 1.6, Color(1, 1, 1, 0.9))

static func _human(r: int, f: bool) -> void:
	var skin := Color(0.9, 0.72, 0.56)
	var wood := Color(0.55, 0.38, 0.22)
	match r:
		0:
			var tunic: Color = Color(0.36, 0.52, 0.32) if not f else Color(0.62, 0.32, 0.3)
			var hair: Color = Color(0.36, 0.22, 0.13) if not f else Color(0.6, 0.36, 0.18)
			if not f:
				_line(Vector2(94, 26), Vector2(86, 120), 2.6, wood)
				_poly([Vector2(91, 14), Vector2(98, 28), Vector2(90, 27)], Color(0.75, 0.77, 0.8))
			else:
				_ell(48, 66, 6, 22, hair, 8.0)
			_line(Vector2(54, 70), Vector2(50, 96), 6.0, tunic.darkened(0.25))
			_villager_legs(Color(0.4, 0.3, 0.22))
			if f:
				_poly([Vector2(49, 62), Vector2(78, 62), Vector2(88, 112), Vector2(40, 112)], tunic)
				_line(Vector2(46, 84), Vector2(82, 84), 2.4, Color(0.85, 0.75, 0.55), 0.0)
			else:
				_poly([Vector2(49, 62), Vector2(78, 62), Vector2(84, 104), Vector2(44, 104)], tunic)
				_line(Vector2(46, 90), Vector2(82, 90), 2.6, Color(0.3, 0.2, 0.12), 0.0)
				_dot(66, 90, 2.0, Color(0.85, 0.7, 0.3))
			_line(Vector2(77, 68), Vector2(88, 88), 6.0, tunic.lightened(0.05))
			if f:
				_ell(92, 94, 9, 6, Color(0.7, 0.52, 0.28))
				_line(Vector2(84, 92), Vector2(100, 92), 1.2, Color(0.45, 0.3, 0.15), 0.0)
				_dot(90, 89, 2.4, Color(0.9, 0.2, 0.15))
				_dot(95, 89, 2.2, Color(0.95, 0.75, 0.2))
			_circ(89, 90, 4.2, skin)
			_villager_head(skin, hair, f)
			if not f:
				_ell(72, 56, 7, 4, hair.lightened(0.1), 0.0, 0.3)
		1:
			var apron := Color(0.66, 0.46, 0.26)
			var shirt: Color = Color(0.74, 0.66, 0.5) if not f else Color(0.5, 0.58, 0.68)
			_villager_legs(Color(0.34, 0.28, 0.2))
			_poly([Vector2(48, 62), Vector2(79, 62), Vector2(84, 104), Vector2(44, 104)], shirt)
			_poly([Vector2(52, 72), Vector2(76, 72), Vector2(80, 104), Vector2(48, 104)], apron)
			_dot(64, 86, 2.0, Color(0.45, 0.3, 0.16))
			_line(Vector2(40, 22), Vector2(80, 74), 3.2, wood)
			_poly([Vector2(28, 18), Vector2(42, 8), Vector2(52, 22), Vector2(38, 32)], Color(0.48, 0.36, 0.26))
			_line(Vector2(36, 15), Vector2(46, 29), 1.6, Color(0.7, 0.7, 0.72), 0.0)
			_line(Vector2(77, 68), Vector2(80, 76), 6.0, shirt)
			_circ(80, 76, 4.2, skin)
			_circ(64, 46, 14, skin)
			if f:
				_ell(50, 50, 6, 12, Color(0.4, 0.24, 0.14))
				_ell(62, 36, 16, 9, Color(0.78, 0.3, 0.25), -6.0)
				_poly([Vector2(46, 38), Vector2(40, 52), Vector2(50, 46)], Color(0.78, 0.3, 0.25), 0.4)
			else:
				_ell(70, 56, 8, 5, Color(0.42, 0.28, 0.16), 0.0, 0.3)
				_ell(64, 36, 23, 5, Color(0.9, 0.76, 0.42))
				_ell(63, 29, 12, 8, Color(0.9, 0.76, 0.42))
				_line(Vector2(52, 33), Vector2(74, 33), 2.0, Color(0.7, 0.3, 0.22), 0.0)
			_circ(78, 48, 3.0, skin)
			_eye(71, 44, 2.3, Color(0.98, 0.96, 0.92))
		2:
			var robe: Color = Color(0.44, 0.27, 0.66) if not f else Color(0.18, 0.5, 0.54)
			var hat: Color = robe.darkened(0.3)
			var trim: Color = Color(0.98, 0.82, 0.35) if not f else Color(0.86, 0.92, 0.96)
			var silver := Color(0.94, 0.94, 0.92)
			_line(Vector2(94, 22), Vector2(91, 121), 3.5, Color(0.5, 0.34, 0.2))
			if f:
				_poly([Vector2(52, 44), Vector2(60, 44), Vector2(56, 92), Vector2(44, 88)], silver.darkened(0.08), 0.5)
			_poly([Vector2(50, 56), Vector2(77, 56), Vector2(92, 121), Vector2(34, 121)], robe)
			_line(Vector2(36, 117), Vector2(90, 117), 2.2, trim, 0.0)
			for p: Vector2 in [Vector2(48, 82), Vector2(70, 96), Vector2(58, 108), Vector2(78, 76), Vector2(44, 102)]:
				_star(p.x, p.y, 2.6, trim)
			if not f:
				_poly([Vector2(60, 50), Vector2(80, 50), Vector2(72, 88)], silver, 0.4)
			_line(Vector2(74, 62), Vector2(89, 70), 6.5, robe.lightened(0.06))
			_circ(90, 70, 4.2, skin)
			_circ(66, 44, 12, skin)
			if not f:
				_poly([Vector2(60, 46), Vector2(80, 46), Vector2(71, 62)], silver, 0.4)
			else:
				_dot(74, 50, 2.0, Color(0.95, 0.6, 0.55, 0.6))
			_ell(64, 34, 23, 5, hat)
			_poly([Vector2(48, 34), Vector2(80, 34), Vector2(74, 16), Vector2(90, 6), Vector2(66, 10)], hat)
			_line(Vector2(50, 31), Vector2(78, 31), 2.4, trim, 0.0)
			_eye(72, 41, 2.3, Color(0.98, 0.96, 0.92))
			_circ(94, 16, 7.5, Color(0.42, 0.96, 0.6), 0.6)
			_dot(92, 13, 2.2, Color(0.95, 1.0, 0.95))

static func _villager_legs(pants: Color) -> void:
	_line(Vector2(57, 100), Vector2(54, 120), 6.5, pants.darkened(0.15))
	_line(Vector2(68, 100), Vector2(73, 120), 6.5, pants)
	_ell(53, 121, 6, 3, Color(0.2, 0.14, 0.1), 0.0, 0.2)
	_ell(76, 121, 6, 3, Color(0.2, 0.14, 0.1), 0.0, 0.2)

static func _villager_head(skin: Color, hair: Color, f: bool) -> void:
	_circ(64, 46, 15, skin)
	_ell(58, 38, 15, 10, hair, -10.0)
	_ell(52, 48, 6, 10 if not f else 14, hair)
	_circ(79, 49, 3.2, skin)
	_dot(74, 54, 2.4, Color(0.95, 0.6, 0.55, 0.6))
	_eye(72, 44, 2.4, Color(0.98, 0.96, 0.92))
	if f:
		_line(Vector2(70, 39), Vector2(76, 39), 1.2, Color(0.1, 0.08, 0.07), 0.0)

static func _rabbit(r: int, f: bool) -> void:
	# normal: buck brown / doe grey-brown; Hare: tawny, long-legged; Moon Rabbit: white with a crescent.
	var fur: Color = _pick(r, f, [Color(0.62, 0.48, 0.34), Color(0.7, 0.62, 0.52), Color(0.74, 0.58, 0.32), Color(0.66, 0.6, 0.5), Color(0.96, 0.96, 0.98), Color(0.9, 0.88, 0.97)])
	var dark: Color = fur.darkened(0.28)
	var pink := Color(0.93, 0.66, 0.66)
	var ear: float = 26.0 if r == 1 else 22.0
	var eye: Color = Color(0.9, 0.35, 0.45) if r == 2 else Color(0.15, 0.1, 0.08)
	_ell(80, 54 - (ear - 22.0), 5, ear - 2, dark, -24.0)
	_ell(56, 116, 18 if r == 1 else 16, 5, dark)
	_circ(52, 92, 22 if not f else 20, fur)
	_ell(68, 96, 28, 17 if not f else 16, fur)
	_ell(66, 104, 18, 8, fur.lightened(0.18))
	_circ(30, 88, 8.5, Color(0.97, 0.95, 0.92))
	var leg_top: float = 96.0 if r == 1 else 100.0
	_line(Vector2(86, leg_top), Vector2(88, 119), 5.0, fur)
	_ell(91, 120, 4.5, 2.2, dark, 0.0, 0.0)
	_ell(93, 81, 15 if not f else 13.5, 12, fur)
	_ell(88, 52 - (ear - 22.0), 6, ear, fur, -14.0)
	if r == 1:
		_ell(82.5, 27, 4.6, 6.5, Color(0.12, 0.1, 0.08), -14.0)
	_ell(89, 53 - (ear - 22.0), 3, ear - 6, pink, -14.0, 0.2)
	_eye(98, 77, 3.0, eye)
	_dot(107, 83, 2.0, pink.darkened(0.15))
	if r == 2:
		if f:
			_star(50, 88, 6.0, Color(0.98, 0.86, 0.5))
		else:
			_circ(50, 88, 7, Color(0.98, 0.86, 0.5), 0.0)
			_circ(53, 86, 6.5, fur, 0.0)
	if f and r == 0:
		_circ(84, 66, 3.0, Color(0.98, 0.85, 0.4), 0.0)

static func _fish(r: int, f: bool) -> void:
	match r:
		0:
			# Trout: the male flushes red and grows a hooked jaw.
			var body: Color = Color(0.5, 0.58, 0.48) if not f else Color(0.7, 0.75, 0.72)
			var fin := body.darkened(0.2)
			_poly([Vector2(24, 32), Vector2(4, 14), Vector2(11, 32), Vector2(4, 50)], fin)
			_poly([Vector2(54, 19), Vector2(68, 7), Vector2(80, 19)], fin)
			_ell(66, 32, 46, 16, body)
			_ell(70, 38, 38, 8, Color(0.88, 0.88, 0.8))
			_ell(64, 33, 38, 2.6 if f else 4.0, Color(0.92, 0.55, 0.55) if f else Color(0.9, 0.35, 0.35), 0.0, 0.2)
			for p: Vector2 in [Vector2(42, 26), Vector2(54, 22), Vector2(66, 25), Vector2(78, 22), Vector2(48, 30), Vector2(88, 26), Vector2(34, 30)]:
				_dot(p.x, p.y, 1.6, Color(0.2, 0.24, 0.2))
			_poly([Vector2(60, 44), Vector2(70, 54), Vector2(74, 44)], fin)
			_eye(100, 28, 3.2, Color(0.95, 0.9, 0.6))
			if not f:
				_arc(110, 38, 4.0, 200.0, 330.0, 1.6, Color(0.25, 0.2, 0.2))
			else:
				_line(Vector2(106, 36), Vector2(111, 35), 1.0, Color(0.2, 0.2, 0.2), 0.0)
		1:
			# Sturgeon: long, armoured, whiskered.
			var body: Color = Color(0.45, 0.48, 0.5) if not f else Color(0.58, 0.6, 0.6)
			_poly([Vector2(18, 30), Vector2(2, 12), Vector2(10, 30), Vector2(4, 44)], body.darkened(0.2))
			_ell(64, 32, 52, 11, body)
			_ell(66, 37, 44, 5, Color(0.82, 0.82, 0.78))
			_poly([Vector2(108, 26), Vector2(126, 32), Vector2(108, 38)], body)
			for i: int in 9:
				var x: float = 24.0 + i * 10.0
				_poly([Vector2(x - 3, 23), Vector2(x, 17), Vector2(x + 3, 23)], Color(0.86, 0.84, 0.78), 0.2)
			_line(Vector2(112, 37), Vector2(110, 44), 1.0, Color(0.3, 0.3, 0.3), 0.0)
			_line(Vector2(116, 36), Vector2(116, 43), 1.0, Color(0.3, 0.3, 0.3), 0.0)
			_eye(104, 29, 2.6, Color(0.85, 0.85, 0.7))
		2:
			# Koi: white with orange (male) or gold with black (female).
			var body: Color = Color(0.97, 0.96, 0.94) if not f else Color(0.98, 0.78, 0.3)
			var patch: Color = Color(0.95, 0.42, 0.14) if not f else Color(0.12, 0.1, 0.1)
			_poly([Vector2(24, 32), Vector2(2, 10), Vector2(12, 32), Vector2(2, 54)], body.darkened(0.05))
			_poly([Vector2(52, 19), Vector2(68, 5), Vector2(82, 19)], body)
			_ell(66, 32, 44, 17, body)
			_ell(52, 26, 14, 9, patch)
			_ell(80, 34, 10, 8, patch)
			_ell(96, 24, 7, 5, patch)
			_poly([Vector2(58, 46), Vector2(70, 58), Vector2(76, 46)], body.darkened(0.05))
			_line(Vector2(108, 36), Vector2(116, 42), 1.0, Color(0.5, 0.4, 0.3), 0.0)
			_eye(100, 28, 3.2, Color(0.15, 0.12, 0.12))

# Columns: drifting spore, fruiting toadstool, magic mushroom.
static func _mushroom(r: int) -> void:
	match r:
		0:
			# A lopsided clump of spores trailing motes on the wind.
			var spore := Color(0.84, 0.8, 0.94)
			for p: Vector3 in [Vector3(64, 64, 11), Vector3(78, 57, 8), Vector3(74, 74, 7), Vector3(53, 55, 6), Vector3(86, 68, 5)]:
				_circ(p.x, p.y, p.z, spore, 0.7)
				_dot(p.x - p.z * 0.35, p.y - p.z * 0.35, p.z * 0.28, Color(1, 1, 1))
			_dot(42, 80, 3.0, spore)
			_dot(33, 89, 2.2, spore)
			_dot(26, 97, 1.6, spore)
		1, 2:
			var cap: Color = Color(0.86, 0.2, 0.14) if r == 1 else Color(0.56, 0.32, 0.86)
			var spot: Color = Color(0.98, 0.96, 0.9) if r == 1 else Color(0.85, 1.0, 0.75)
			_poly([Vector2(54, 120), Vector2(57, 78), Vector2(71, 78), Vector2(74, 120)], Color(0.95, 0.92, 0.84))
			_ell(64, 88, 30, 5, Color(0.86, 0.8, 0.7), 0.0, 0.4)
			var dome: Array = []
			for i: int in 17:
				var a: float = PI + PI * float(i) / 16.0
				dome.append(Vector2(64 + cos(a) * 42.0, 86 + sin(a) * 36.0))
			dome.append(Vector2(64, 92))
			_poly(dome, cap)
			for p: Vector3 in [Vector3(48, 64, 6), Vector3(70, 60, 6), Vector3(88, 70, 5), Vector3(60, 72, 4), Vector3(38, 74, 4)]:
				_dot(p.x, p.y, p.z, spot)

# ------------------------------------------------------------------
# World textures
# ------------------------------------------------------------------
static func shadow_image() -> Image:
	var n: int = 64
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y: int in n:
		for x: int in n:
			var dx: float = (x + 0.5) / n * 2.0 - 1.0
			var dy: float = (y + 0.5) / n * 2.0 - 1.0
			var d: float = sqrt(dx * dx + dy * dy)
			var a: float = 1.0 - smoothstep(0.62, 1.0, d)
			img.set_pixel(x, y, Color(0.04, 0.05, 0.03, a * 0.9))
	return img

# A mat of fungal threads: white so the layer tints it, crisp strands that
# only thin out toward the edge so neighbouring patches knit together.
static func mycelium_image() -> Image:
	_begin(Vector2i(128, 128), Color(1, 1, 1))
	var rng := RandomNumberGenerator.new()
	rng.seed = 23
	var strands: Array = []
	for i: int in 9:
		var ang: float = float(i) / 9.0 * TAU + rng.randf_range(-0.3, 0.3)
		strands.append([Vector2(64, 64) + Vector2(cos(ang), sin(ang)) * rng.randf_range(2.0, 8.0), ang, 1.6, 0])
	while not strands.is_empty():
		var s: Array = strands.pop_back()
		var p: Vector2 = s[0]
		var ang: float = s[1]
		var w: float = s[2]
		var depth: int = s[3]
		for step: int in 10:
			ang += rng.randf_range(-0.45, 0.45)
			var q := p + Vector2(cos(ang), sin(ang)) * rng.randf_range(4.0, 7.0)
			if q.distance_to(Vector2(64, 64)) > 60.0:
				break
			_line(p, q, w, Color(1, 1, 1), 0.0)
			if depth < 2 and rng.randf() < 0.28:
				strands.append([q, ang + rng.randf_range(0.6, 1.1) * (1.0 if rng.randf() > 0.5 else -1.0), w * 0.65, depth + 1])
			p = q
		_dot(p.x, p.y, w * 0.9, Color(1, 1, 1))
	_dot(64, 64, 3.0, Color(1, 1, 1))
	var out := _finish(Color(1, 1, 1), 0)
	for y: int in out.get_height():
		for x: int in out.get_width():
			var c := out.get_pixel(x, y)
			if c.a <= 0.0:
				continue
			var d: float = Vector2(x + 0.5 - 64.0, y + 0.5 - 64.0).length() / 64.0
			c.a *= 1.0 - smoothstep(0.7, 1.0, d)
			out.set_pixel(x, y, c)
	return out

# A clump of blades in near-white so the grass instance colour tints it.
static func tuft_image() -> Image:
	_begin(Vector2i(64, 64), Color(0.5, 0.6, 0.4))
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i: int in 9:
		var bx: float = 14.0 + rng.randf() * 36.0
		var lean: float = (bx - 32.0) * 0.6 + rng.randf_range(-6.0, 6.0)
		var top: float = 6.0 + rng.randf() * 18.0
		var w: float = rng.randf_range(2.6, 4.2)
		var shade: float = rng.randf_range(0.82, 1.0)
		_poly([Vector2(bx - w, 64), Vector2(bx + lean, top), Vector2(bx + w, 64)], Color(shade, shade, shade * 0.94), 0.0)
	# Base darkening gives the clump depth once tinted.
	for y: int in _h:
		var k: float = clampf(float(y) / _h * 1.4 - 0.4, 0.0, 1.0)
		for x: int in _w:
			var c := _img.get_pixel(x, y)
			if c.a > 0.0:
				_img.set_pixel(x, y, Color(c.r * (1.0 - k * 0.45), c.g * (1.0 - k * 0.4), c.b * (1.0 - k * 0.45), c.a))
	return _finish(Color(0.5, 0.6, 0.4), 0)

# ------------------------------------------------------------------
# Painting primitives (all take 128-space coordinates)
# ------------------------------------------------------------------
static func _begin(dims: Vector2i, bleed: Color) -> void:
	_w = dims.x * SS
	_h = dims.y * SS
	_img = Image.create(_w, _h, false, Image.FORMAT_RGBA8)
	_img.fill(Color(bleed.r, bleed.g, bleed.b, 0.0))

static func _finish(ink: Color, outline_px: int) -> Image:
	if outline_px > 0:
		_outline(ink, outline_px)
	var out := _img
	out.resize(_w / SS, _h / SS, Image.INTERPOLATE_BILINEAR)
	_img = null
	return out

# Dilate the silhouette (separable square kernel) and paint the ring in ink.
static func _outline(ink: Color, r: int) -> void:
	var solid := PackedByteArray()
	solid.resize(_w * _h)
	for y: int in _h:
		for x: int in _w:
			solid[y * _w + x] = 1 if _img.get_pixel(x, y).a >= 0.5 else 0
	var horiz := PackedByteArray()
	horiz.resize(_w * _h)
	for y: int in _h:
		for x: int in _w:
			var hit: int = 0
			for k: int in range(maxi(0, x - r), mini(_w, x + r + 1)):
				if solid[y * _w + k] == 1:
					hit = 1
					break
			horiz[y * _w + x] = hit
	for y: int in _h:
		for x: int in _w:
			if solid[y * _w + x] == 1:
				continue
			for k: int in range(maxi(0, y - r), mini(_h, y + r + 1)):
				if horiz[k * _w + x] == 1:
					_img.set_pixel(x, y, ink)
					break

# Light comes from the upper left; edges fall into soft occlusion.
static func _shade(col: Color, nx: float, ny: float, amount: float) -> Color:
	if amount <= 0.0:
		return col
	var l: float = clampf(-0.45 * nx - 0.8 * ny, -1.0, 1.0)
	var c: Color = col.lightened(l * 0.2 * amount) if l > 0.0 else col.darkened(-l * 0.26 * amount)
	var r2: float = nx * nx + ny * ny
	if r2 > 0.7:
		c = c.darkened(clampf((r2 - 0.7) * 0.45, 0.0, 0.14) * amount)
	return c

static func _put(x: int, y: int, c: Color) -> void:
	if c.a <= 0.0:
		return
	if c.a >= 1.0:
		_img.set_pixel(x, y, c)
	else:
		var base := _img.get_pixel(x, y)
		if base.a <= 0.0:
			_img.set_pixel(x, y, c)
		else:
			_img.set_pixel(x, y, Color(base.r, base.g, base.b, base.a).lerp(Color(c.r, c.g, c.b, base.a), c.a))

static func _ell(cx: float, cy: float, rx: float, ry: float, col: Color, rot_deg: float = 0.0, shade: float = 1.0) -> void:
	cx *= SS; cy *= SS; rx *= SS; ry *= SS
	var a: float = deg_to_rad(rot_deg)
	var ca: float = cos(a)
	var sa: float = sin(a)
	var ext: float = maxf(rx, ry) + 1.0
	for y: int in range(maxi(0, int(cy - ext)), mini(_h, int(cy + ext) + 1)):
		for x: int in range(maxi(0, int(cx - ext)), mini(_w, int(cx + ext) + 1)):
			var px: float = x + 0.5 - cx
			var py: float = y + 0.5 - cy
			var lx: float = (px * ca + py * sa) / rx
			var ly: float = (-px * sa + py * ca) / ry
			if lx * lx + ly * ly <= 1.0:
				# Shade in screen space so rotated shapes keep the same light.
				_put(x, y, _shade(col, px / ext, py / ext, shade))

static func _circ(cx: float, cy: float, r: float, col: Color, shade: float = 1.0) -> void:
	_ell(cx, cy, r, r, col, 0.0, shade)

static func _dot(cx: float, cy: float, r: float, col: Color) -> void:
	_ell(cx, cy, r, r, col, 0.0, 0.0)

static func _poly(pts: Array, col: Color, shade: float = 1.0) -> void:
	var poly := PackedVector2Array()
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for p: Vector2 in pts:
		var q := p * SS
		poly.append(q)
		lo = lo.min(q)
		hi = hi.max(q)
	var centre := (lo + hi) * 0.5
	var half := ((hi - lo) * 0.5).max(Vector2.ONE)
	for y: int in range(maxi(0, int(lo.y)), mini(_h, int(hi.y) + 1)):
		for x: int in range(maxi(0, int(lo.x)), mini(_w, int(hi.x) + 1)):
			var p := Vector2(x + 0.5, y + 0.5)
			if Geometry2D.is_point_in_polygon(p, poly):
				_put(x, y, _shade(col, (p.x - centre.x) / half.x, (p.y - centre.y) / half.y, shade))

static func _line(a: Vector2, b: Vector2, width: float, col: Color, shade: float = 1.0) -> void:
	a *= SS
	b *= SS
	var r: float = width * 0.5 * SS
	var lo := a.min(b) - Vector2(r + 1, r + 1)
	var hi := a.max(b) + Vector2(r + 1, r + 1)
	var ab := b - a
	var len2: float = maxf(ab.length_squared(), 0.0001)
	var nrm := Vector2(-ab.y, ab.x).normalized()
	for y: int in range(maxi(0, int(lo.y)), mini(_h, int(hi.y) + 1)):
		for x: int in range(maxi(0, int(lo.x)), mini(_w, int(hi.x) + 1)):
			var p := Vector2(x + 0.5, y + 0.5)
			var t: float = clampf((p - a).dot(ab) / len2, 0.0, 1.0)
			var d: Vector2 = p - (a + ab * t)
			if d.length_squared() <= r * r:
				var across: float = d.dot(nrm) / r
				_put(x, y, _shade(col, across * 0.6, across * 0.6, shade))

# A thick arc (horns, curls, rings) from a0 to a1 degrees.
static func _arc(cx: float, cy: float, radius: float, a0: float, a1: float, width: float, col: Color) -> void:
	var steps: int = maxi(6, int(absf(a1 - a0) / 12.0))
	var prev := Vector2(cx + cos(deg_to_rad(a0)) * radius, cy + sin(deg_to_rad(a0)) * radius)
	for i: int in range(1, steps + 1):
		var a: float = deg_to_rad(lerpf(a0, a1, float(i) / steps))
		var p := Vector2(cx + cos(a) * radius, cy + sin(a) * radius)
		_line(prev, p, width, col, 0.5)
		prev = p

static func _eye(cx: float, cy: float, r: float, iris: Color) -> void:
	_dot(cx, cy, r, iris)
	_dot(cx + r * 0.15, cy + r * 0.1, r * 0.55, Color(0.06, 0.05, 0.05))
	_dot(cx - r * 0.3, cy - r * 0.35, maxf(r * 0.3, 0.8), Color(1, 1, 1))

static func _star(cx: float, cy: float, r: float, col: Color) -> void:
	var pts: Array = []
	for i: int in 8:
		var ang: float = -PI * 0.5 + float(i) * PI * 0.25
		var rr: float = r if i % 2 == 0 else r * 0.4
		pts.append(Vector2(cx + cos(ang) * rr, cy + sin(ang) * rr))
	_poly(pts, col, 0.0)

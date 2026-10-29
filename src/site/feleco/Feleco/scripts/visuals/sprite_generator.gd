class_name SpriteGenerator

# Runtime procedural sprite generator for billboarded agent visuals.
# Generates 64x64 flat-color silhouette textures per species.
# Uses brute-force pixel fills (fast enough for 64x64 at startup).

const SIZE: int = 64

static func generate_for_species(species: String) -> ImageTexture:
	var img := Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))

	match species:
		"sheep":
			_draw_sheep(img)
		"wolf":
			_draw_wolf(img)
		"boar":
			_draw_boar(img)
		"falcon":
			_draw_falcon(img)
		"robin":
			_draw_robin(img)
		"worm":
			_draw_worm(img)
		"human":
			_draw_human(img)
		"rabbit":
			_draw_rabbit(img)
		"wizard":
			_draw_wizard(img)
		"builder":
			_draw_builder(img)
		"fish":
			_draw_fish(img)

	return ImageTexture.create_from_image(img)

# ------------------------------------------------------------------
# Sheep: fluffy white body, small head, tiny ears and legs
# ------------------------------------------------------------------
static func _draw_sheep(img: Image) -> void:
	var wool := Color(0.96, 0.94, 0.88)
	var skin := Color(0.82, 0.78, 0.72)
	var dark := Color(0.55, 0.5, 0.45)
	# Big fluffy body
	_fill_ellipse(img, 32, 38, 20, 16, wool)
	_fill_ellipse(img, 28, 34, 10, 8, wool)
	_fill_ellipse(img, 36, 34, 10, 8, wool)
	# Head
	_fill_ellipse(img, 32, 18, 9, 8, skin)
	# Ears (tiny dark)
	_fill_ellipse(img, 22, 14, 4, 3, dark)
	_fill_ellipse(img, 42, 14, 4, 3, dark)
	# Legs
	_fill_ellipse(img, 24, 54, 3, 6, dark)
	_fill_ellipse(img, 40, 54, 3, 6, dark)
	# Eyes
	_fill_circle(img, 28, 16, 1, Color.BLACK)
	_fill_circle(img, 36, 16, 1, Color.BLACK)

# ------------------------------------------------------------------
# Wolf: dark elongated body, pointed snout, ears, bushy tail, legs
# ------------------------------------------------------------------
static func _draw_wolf(img: Image) -> void:
	var fur := Color(0.22, 0.22, 0.35)
	var dark := Color(0.15, 0.15, 0.25)
	var snout := Color(0.35, 0.3, 0.3)
	# Body (elongated, muscular)
	_fill_ellipse(img, 32, 38, 18, 12, fur)
	# Chest
	_fill_ellipse(img, 32, 30, 12, 8, fur)
	# Head (angular)
	_fill_triangle(img, Vector2i(32, 10), Vector2i(24, 22), Vector2i(40, 22), fur)
	# Snout (long and pointed)
	_fill_triangle(img, Vector2i(32, 6), Vector2i(28, 14), Vector2i(36, 14), snout)
	# Ears (tall and pointed)
	_fill_triangle(img, Vector2i(26, 8), Vector2i(30, 16), Vector2i(22, 14), dark)
	_fill_triangle(img, Vector2i(38, 8), Vector2i(34, 16), Vector2i(42, 14), dark)
	# Bushy tail
	_fill_ellipse(img, 12, 36, 10, 6, dark)
	_fill_ellipse(img, 8, 32, 6, 4, dark)
	# Legs
	_fill_ellipse(img, 26, 50, 3, 8, dark)
	_fill_ellipse(img, 38, 50, 3, 8, dark)
	# Eyes (menacing)
	_fill_circle(img, 28, 18, 1, Color(0.9, 0.1, 0.1))
	_fill_circle(img, 36, 18, 1, Color(0.9, 0.1, 0.1))

# ------------------------------------------------------------------
# Boar: stocky brown body, forward tusks, small ears, stubby tail
# ------------------------------------------------------------------
static func _draw_boar(img: Image) -> void:
	var body := Color(0.55, 0.35, 0.2)
	var dark := Color(0.4, 0.25, 0.12)
	var tusk := Color(0.92, 0.88, 0.78)
	# Stocky body
	_fill_ellipse(img, 32, 38, 20, 14, body)
	# Head (broad)
	_fill_ellipse(img, 32, 22, 13, 10, body)
	# Tusks (prominent, pointing forward)
	_fill_triangle(img, Vector2i(24, 12), Vector2i(30, 18), Vector2i(20, 16), tusk)
	_fill_triangle(img, Vector2i(40, 12), Vector2i(34, 18), Vector2i(44, 16), tusk)
	# Ears (small)
	_fill_triangle(img, Vector2i(22, 14), Vector2i(26, 18), Vector2i(18, 18), dark)
	_fill_triangle(img, Vector2i(42, 14), Vector2i(38, 18), Vector2i(46, 18), dark)
	# Tail (stubby)
	_fill_ellipse(img, 14, 36, 5, 3, dark)
	# Legs (short and thick)
	_fill_ellipse(img, 24, 52, 4, 7, dark)
	_fill_ellipse(img, 40, 52, 4, 7, dark)
	# Eyes
	_fill_circle(img, 28, 20, 1, Color.BLACK)
	_fill_circle(img, 36, 20, 1, Color.BLACK)

# ------------------------------------------------------------------
# Falcon: large wings, small body, tail
# ------------------------------------------------------------------
static func _draw_falcon(img: Image) -> void:
	var wing := Color(0.82, 0.82, 0.82)
	var body := Color(0.55, 0.55, 0.55)
	var dark := Color(0.35, 0.35, 0.35)
	# Wide wingspan
	_fill_triangle(img, Vector2i(4, 32), Vector2i(28, 24), Vector2i(28, 44), wing)
	_fill_triangle(img, Vector2i(60, 32), Vector2i(36, 24), Vector2i(36, 44), wing)
	# Wing tips
	_fill_triangle(img, Vector2i(4, 32), Vector2i(12, 28), Vector2i(12, 36), dark)
	_fill_triangle(img, Vector2i(60, 32), Vector2i(52, 28), Vector2i(52, 36), dark)
	# Body
	_fill_ellipse(img, 32, 34, 8, 12, body)
	# Head
	_fill_circle(img, 32, 22, 7, body)
	# Beak
	_fill_triangle(img, Vector2i(32, 12), Vector2i(29, 18), Vector2i(35, 18), dark)
	# Tail
	_fill_triangle(img, Vector2i(32, 56), Vector2i(26, 46), Vector2i(38, 46), wing)
	# Eyes
	_fill_circle(img, 29, 20, 1, Color(0.9, 0.7, 0.1))
	_fill_circle(img, 35, 20, 1, Color(0.9, 0.7, 0.1))

# ------------------------------------------------------------------
# Robin: small red body, wing triangles, tail
# ------------------------------------------------------------------
static func _draw_robin(img: Image) -> void:
	var body := Color(0.92, 0.22, 0.15)
	var wing := Color(0.72, 0.15, 0.1)
	var belly := Color(0.95, 0.6, 0.25)
	# Body
	_fill_ellipse(img, 32, 34, 9, 8, body)
	# Belly
	_fill_ellipse(img, 32, 38, 6, 4, belly)
	# Head
	_fill_circle(img, 32, 24, 7, body)
	# Beak
	_fill_triangle(img, Vector2i(32, 14), Vector2i(30, 20), Vector2i(34, 20), Color(0.9, 0.8, 0.5))
	# Wings
	_fill_triangle(img, Vector2i(14, 32), Vector2i(26, 28), Vector2i(26, 38), wing)
	_fill_triangle(img, Vector2i(50, 32), Vector2i(38, 28), Vector2i(38, 38), wing)
	# Tail
	_fill_triangle(img, Vector2i(32, 52), Vector2i(28, 44), Vector2i(36, 44), wing)
	# Eyes
	_fill_circle(img, 29, 22, 1, Color.BLACK)
	_fill_circle(img, 35, 22, 1, Color.BLACK)

# ------------------------------------------------------------------
# Worm: green segmented body (4 circles in a line)
# ------------------------------------------------------------------
static func _draw_worm(img: Image) -> void:
	var c := Color(0.2, 0.8, 0.35)
	var dark := Color(0.15, 0.6, 0.25)
	_fill_circle(img, 18, 36, 5, c)
	_fill_circle(img, 28, 36, 6, c)
	_fill_circle(img, 38, 36, 6, c)
	_fill_circle(img, 48, 36, 5, c)
	# Segmentation lines
	_fill_circle(img, 23, 36, 1, dark)
	_fill_circle(img, 33, 36, 1, dark)
	_fill_circle(img, 43, 36, 1, dark)

# ------------------------------------------------------------------
# Human: tan body, round head, arms and legs
# ------------------------------------------------------------------
static func _draw_human(img: Image) -> void:
	var body := Color(0.65, 0.55, 0.45)
	var head := Color(0.72, 0.62, 0.52)
	var dark := Color(0.5, 0.42, 0.35)
	# Body
	_fill_ellipse(img, 32, 38, 11, 15, body)
	# Head
	_fill_circle(img, 32, 18, 10, head)
	# Arms
	_fill_ellipse(img, 18, 34, 4, 9, body)
	_fill_ellipse(img, 46, 34, 4, 9, body)
	# Legs
	_fill_ellipse(img, 26, 56, 4, 9, dark)
	_fill_ellipse(img, 38, 56, 4, 9, dark)
	# Hair
	_fill_ellipse(img, 32, 14, 8, 4, dark)
	# Eyes
	_fill_circle(img, 29, 18, 1, Color.BLACK)
	_fill_circle(img, 35, 18, 1, Color.BLACK)

# ------------------------------------------------------------------
# Rabbit: light brown, long ears, small fluffy tail
# ------------------------------------------------------------------
static func _draw_rabbit(img: Image) -> void:
	var fur := Color(0.78, 0.6, 0.42)
	var dark := Color(0.6, 0.45, 0.3)
	var ear := Color(0.85, 0.65, 0.5)
	# Body
	_fill_ellipse(img, 32, 38, 12, 10, fur)
	# Head
	_fill_ellipse(img, 32, 24, 8, 7, fur)
	# Long ears
	_fill_ellipse(img, 28, 12, 3, 8, ear)
	_fill_ellipse(img, 36, 12, 3, 8, ear)
	# Inner ears
	_fill_ellipse(img, 28, 12, 1, 5, dark)
	_fill_ellipse(img, 36, 12, 1, 5, dark)
	# Tail (fluffy white)
	_fill_circle(img, 18, 38, 4, Color(0.95, 0.92, 0.88))
	# Legs
	_fill_ellipse(img, 26, 50, 3, 6, dark)
	_fill_ellipse(img, 38, 50, 3, 6, dark)
	# Eyes
	_fill_circle(img, 29, 22, 1, Color.BLACK)
	_fill_circle(img, 35, 22, 1, Color.BLACK)

# ------------------------------------------------------------------
# Wizard: pointed hat, staff glow, purple robe
# ------------------------------------------------------------------
static func _draw_wizard(img: Image) -> void:
	var robe := Color(0.55, 0.2, 0.8)
	var hat := Color(0.4, 0.15, 0.6)
	var skin := Color(0.72, 0.62, 0.52)
	var glow := Color(0.4, 0.9, 0.4)
	# Body (robe)
	_fill_ellipse(img, 32, 40, 12, 16, robe)
	# Head
	_fill_circle(img, 32, 20, 9, skin)
	# Hat brim
	_fill_ellipse(img, 32, 12, 14, 4, hat)
	# Hat cone
	_fill_triangle(img, Vector2i(32, 2), Vector2i(22, 14), Vector2i(42, 14), hat)
	# Staff (glowing top)
	_fill_ellipse(img, 48, 36, 3, 14, Color(0.5, 0.35, 0.2))
	_fill_circle(img, 48, 22, 3, glow)
	# Eyes
	_fill_circle(img, 29, 20, 1, Color.BLACK)
	_fill_circle(img, 35, 20, 1, Color.BLACK)

# ------------------------------------------------------------------
# Builder: hammer silhouette, hard hat, overalls
# ------------------------------------------------------------------
static func _draw_builder(img: Image) -> void:
	var overalls := Color(0.5, 0.35, 0.2)
	var shirt := Color(0.7, 0.6, 0.45)
	var skin := Color(0.72, 0.62, 0.52)
	var hat := Color(0.85, 0.7, 0.3)
	# Body (overalls)
	_fill_ellipse(img, 32, 42, 12, 16, overalls)
	# Shirt top
	_fill_ellipse(img, 32, 28, 10, 8, shirt)
	# Head
	_fill_circle(img, 32, 18, 9, skin)
	# Hard hat
	_fill_ellipse(img, 32, 12, 13, 5, hat)
	_fill_ellipse(img, 32, 8, 6, 3, hat)
	# Hammer (held in right hand)
	_fill_ellipse(img, 48, 34, 3, 10, Color(0.4, 0.4, 0.4))
	_fill_ellipse(img, 48, 24, 6, 3, Color(0.55, 0.55, 0.55))
	# Eyes
	_fill_circle(img, 29, 18, 1, Color.BLACK)
	_fill_circle(img, 35, 18, 1, Color.BLACK)

# ------------------------------------------------------------------
# Drawing primitives
# ------------------------------------------------------------------
static func _fill_circle(img: Image, cx: int, cy: int, r: int, color: Color) -> void:
	var w := img.get_width()
	var h := img.get_height()
	var r2 := r * r
	for y in range(clampi(cy - r, 0, h - 1), clampi(cy + r + 1, 0, h)):
		for x in range(clampi(cx - r, 0, w - 1), clampi(cx + r + 1, 0, w)):
			var dx := x - cx
			var dy := y - cy
			if dx * dx + dy * dy <= r2:
				img.set_pixel(x, y, color)

static func _draw_fish(img: Image) -> void:
	var body := Color(0.25, 0.62, 0.78, 1.0)
	var fin := Color(0.15, 0.4, 0.62, 1.0)
	_fill_ellipse(img, 34, 32, 16, 8, body)
	_fill_ellipse(img, 16, 32, 7, 6, fin)
	_fill_ellipse(img, 40, 24, 5, 3, fin)

static func _fill_ellipse(img: Image, cx: int, cy: int, rx: int, ry: int, color: Color) -> void:
	if rx <= 0 or ry <= 0:
		return
	var w := img.get_width()
	var h := img.get_height()
	for y in range(clampi(cy - ry, 0, h - 1), clampi(cy + ry + 1, 0, h)):
		for x in range(clampi(cx - rx, 0, w - 1), clampi(cx + rx + 1, 0, w)):
			var dx := float(x - cx) / rx
			var dy := float(y - cy) / ry
			if dx * dx + dy * dy <= 1.0:
				img.set_pixel(x, y, color)

static func _fill_triangle(img: Image, p1: Vector2i, p2: Vector2i, p3: Vector2i, color: Color) -> void:
	var min_x := mini(mini(p1.x, p2.x), p3.x)
	var max_x := maxi(maxi(p1.x, p2.x), p3.x)
	var min_y := mini(mini(p1.y, p2.y), p3.y)
	var max_y := maxi(maxi(p1.y, p2.y), p3.y)
	var w := img.get_width()
	var h := img.get_height()
	for y in range(clampi(min_y, 0, h - 1), clampi(max_y + 1, 0, h)):
		for x in range(clampi(min_x, 0, w - 1), clampi(max_x + 1, 0, w)):
			if _point_in_triangle(Vector2i(x, y), p1, p2, p3):
				img.set_pixel(x, y, color)

static func _point_in_triangle(p: Vector2i, a: Vector2i, b: Vector2i, c: Vector2i) -> bool:
	var cross1 := _cross(b - a, p - a)
	var cross2 := _cross(c - b, p - b)
	var cross3 := _cross(a - c, p - c)
	return (cross1 >= 0 and cross2 >= 0 and cross3 >= 0) or (cross1 <= 0 and cross2 <= 0 and cross3 <= 0)

static func _cross(a: Vector2i, b: Vector2i) -> int:
	return a.x * b.y - a.y * b.x

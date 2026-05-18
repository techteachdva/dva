class_name GameIconPainter
extends RefCounted

const SIZE := 128


static func make_image(kind: String) -> Image:
	var img := Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	match kind:
		"heart":
			_paint_heart(img)
		"star":
			_paint_star(img, Color(1.0, 0.88, 0.2), Color(0.85, 0.55, 0.05))
		"star_empty":
			_paint_star(img, Color(0.42, 0.44, 0.52), Color(0.28, 0.30, 0.36))
		"coin":
			_paint_coin(img)
		"lock":
			_paint_lock_emoji(img)
		"music_note":
			_paint_music(img)
		"shop_key":
			_paint_shop_key(img)
		"life_plus":
			_paint_life_plus(img)
		"skin_ball":
			_paint_skin_ball(img)
		"theme_paint":
			_paint_theme_paint(img)
		"mat_rubber":
			_paint_mat_rubber(img)
		"mat_metal":
			_paint_mat_metal(img)
		"mat_bouncy":
			_paint_mat_bouncy(img)
	return img


static func make_menu_image(kind: String) -> Image:
	var img := Image.create(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	match kind:
		"play":
			_paint_play(img)
		"resume":
			_paint_continue(img)
		"custom":
			_paint_custom(img)
		"editor":
			_paint_editor(img)
		"credits":
			_paint_credits(img)
		"shop":
			_paint_shop(img)
		"options":
			_paint_options(img)
		"quit":
			_paint_quit(img)
		"music":
			_paint_music(img)
	return img


static func _star_points(cx: float, cy: float, outer_r: float, inner_r: float) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i: int in range(10):
		var angle := -PI * 0.5 + float(i) * PI / 5.0
		var r := outer_r if i % 2 == 0 else inner_r
		pts.append(Vector2(cx + cos(angle) * r, cy + sin(angle) * r))
	return pts


static func _fill_circle(img: Image, cx: float, cy: float, r: float, col: Color) -> void:
	var r2 := r * r
	for y in range(img.get_height()):
		for x in range(img.get_width()):
			if Vector2(x, y).distance_squared_to(Vector2(cx, cy)) <= r2:
				_put_pixel(img, x, y, col)


static func _fill_rect(img: Image, x0: float, y0: float, x1: float, y1: float, col: Color) -> void:
	for y in range(int(y0), int(y1) + 1):
		for x in range(int(x0), int(x1) + 1):
			_put_pixel(img, x, y, col)


static func _fill_round_rect(img: Image, x0: float, y0: float, x1: float, y1: float, rad: float, col: Color) -> void:
	_fill_rect(img, x0 + rad, y0, x1 - rad, y1, col)
	_fill_rect(img, x0, y0 + rad, x1, y1 - rad, col)
	_fill_circle(img, x0 + rad, y0 + rad, rad, col)
	_fill_circle(img, x1 - rad, y0 + rad, rad, col)
	_fill_circle(img, x0 + rad, y1 - rad, rad, col)
	_fill_circle(img, x1 - rad, y1 - rad, rad, col)


static func _fill_polygon(img: Image, pts: PackedVector2Array, col: Color) -> void:
	if pts.size() < 3:
		return
	# Stars are concave — scanline fill leaves a solid wedge; triangulate instead.
	var indices: PackedInt32Array = Geometry2D.triangulate_polygon(pts)
	if indices.is_empty():
		return
	for i: int in range(0, indices.size(), 3):
		_fill_triangle(img, pts[indices[i]], pts[indices[i + 1]], pts[indices[i + 2]], col)


static func _fill_triangle(img: Image, a: Vector2, b: Vector2, c: Vector2, col: Color) -> void:
	var min_x := int(minf(a.x, minf(b.x, c.x)))
	var max_x := int(maxf(a.x, maxf(b.x, c.x)))
	var min_y := int(minf(a.y, minf(b.y, c.y)))
	var max_y := int(maxf(a.y, maxf(b.y, c.y)))
	min_x = maxi(0, min_x)
	max_x = mini(img.get_width() - 1, max_x)
	min_y = maxi(0, min_y)
	max_y = mini(img.get_height() - 1, max_y)
	for y in range(min_y, max_y + 1):
		for x in range(min_x, max_x + 1):
			if _point_in_triangle(Vector2(x, y), a, b, c):
				_put_pixel(img, x, y, col)


static func _point_in_triangle(p: Vector2, a: Vector2, b: Vector2, c: Vector2) -> bool:
	var d1 := (p - a).cross(b - a)
	var d2 := (p - b).cross(c - b)
	var d3 := (p - c).cross(a - c)
	var has_neg := d1 < 0.0 or d2 < 0.0 or d3 < 0.0
	var has_pos := d1 > 0.0 or d2 > 0.0 or d3 > 0.0
	return not (has_neg and has_pos)


static func _stroke_polygon(img: Image, pts: PackedVector2Array, col: Color, width: float) -> void:
	for i in range(pts.size()):
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[(i + 1) % pts.size()]
		_stroke_line(img, a, b, col, width)


static func _stroke_line(img: Image, a: Vector2, b: Vector2, col: Color, width: float) -> void:
	var steps := int(maxf(a.distance_to(b), 1.0) * 2.0)
	var r := maxf(width * 0.5, 0.5)
	for s in range(steps + 1):
		var t := float(s) / float(steps)
		var p: Vector2 = a.lerp(b, t)
		if r <= 1.0:
			_put_pixel(img, int(p.x), int(p.y), col)
		else:
			_fill_circle(img, p.x, p.y, r, col)


static func _put_pixel(img: Image, x: int, y: int, col: Color) -> void:
	if x >= 0 and y >= 0 and x < img.get_width() and y < img.get_height():
		img.set_pixel(x, y, col)


static func _paint_heart(img: Image) -> void:
	var body := Color(0.92, 0.15, 0.28)
	var edge := Color(0.55, 0.05, 0.12)
	_fill_circle(img, 44, 46, 20, edge)
	_fill_circle(img, 84, 46, 20, edge)
	_fill_polygon(img, PackedVector2Array([
		Vector2(24, 58), Vector2(40, 32), Vector2(64, 50),
		Vector2(88, 32), Vector2(104, 58), Vector2(64, 108),
	]), edge)
	_fill_circle(img, 44, 48, 17, body)
	_fill_circle(img, 84, 48, 17, body)
	_fill_polygon(img, PackedVector2Array([
		Vector2(26, 58), Vector2(40, 34), Vector2(64, 52),
		Vector2(88, 34), Vector2(102, 58), Vector2(64, 104),
	]), body)


static func _paint_star(img: Image, fill: Color, edge: Color) -> void:
	var pts := _star_points(64.0, 64.0, 48.0, 17.0)
	_fill_polygon(img, pts, edge)
	var inner := _star_points(64.0, 64.0, 43.0, 15.0)
	_fill_polygon(img, inner, fill)


static func _paint_coin(img: Image) -> void:
	var cx := 64.0
	var cy := 64.0
	_fill_circle(img, cx, cy, 46, Color(0.75, 0.48, 0.05))
	_fill_circle(img, cx, cy, 42, Color(1.0, 0.82, 0.15))
	_fill_circle(img, cx, cy, 36, Color(1.0, 0.92, 0.35))
	# Soft rim shading (no separate highlight blob)
	for y in range(int(cy) - 36, int(cy) + 37):
		for x in range(int(cx) - 36, int(cx) + 37):
			var dist := Vector2(x, y).distance_to(Vector2(cx, cy))
			if dist > 30.0 and dist < 36.0:
				_put_pixel(img, x, y, Color(0.82, 0.55, 0.05))


static func _paint_lock_emoji(img: Image) -> void:
	var shackle := Color(0.72, 0.76, 0.82)
	var shackle_edge := Color(0.45, 0.48, 0.55)
	var body := Color(0.98, 0.78, 0.12)
	var body_dark := Color(0.82, 0.58, 0.06)
	var body_hi := Color(1.0, 0.92, 0.45)
	for y in range(18, 58):
		for x in range(34, 94):
			var d := Vector2(x, y).distance_to(Vector2(64, 52))
			if d >= 24.0 and d <= 32.0 and y < 56:
				var col: Color = shackle_edge if d > 30.5 else shackle
				_put_pixel(img, x, y, col)
	_fill_rect(img, 38, 48, 46, 58, shackle_edge)
	_fill_rect(img, 40, 50, 44, 56, shackle)
	_fill_rect(img, 82, 48, 90, 58, shackle_edge)
	_fill_rect(img, 84, 50, 88, 56, shackle)
	_fill_round_rect(img, 30, 56, 98, 108, 8, body_dark)
	_fill_round_rect(img, 32, 58, 96, 106, 7, body)
	_fill_round_rect(img, 36, 62, 68, 88, 4, body_hi)
	_fill_circle(img, 64, 78, 7, Color(0.18, 0.2, 0.24))
	_fill_rect(img, 60, 78, 68, 94, Color(0.18, 0.2, 0.24))


static func _paint_play(img: Image) -> void:
	_fill_circle(img, 64, 64, 50, Color(0.1, 0.55, 0.28, 0.35))
	_fill_polygon(img, PackedVector2Array([
		Vector2(46, 34), Vector2(46, 94), Vector2(98, 64),
	]), Color(0.15, 0.88, 0.42))
	_stroke_polygon(img, PackedVector2Array([
		Vector2(46, 34), Vector2(46, 94), Vector2(98, 64),
	]), Color(0.05, 0.45, 0.22), 3.0)


static func _paint_continue(img: Image) -> void:
	_fill_circle(img, 64, 64, 50, Color(0.1, 0.35, 0.75, 0.3))
	_fill_polygon(img, PackedVector2Array([
		Vector2(38, 34), Vector2(38, 94), Vector2(72, 64),
	]), Color(0.2, 0.55, 1.0))
	_fill_polygon(img, PackedVector2Array([
		Vector2(58, 34), Vector2(58, 94), Vector2(92, 64),
	]), Color(0.35, 0.75, 1.0))


static func _paint_custom(img: Image) -> void:
	_fill_round_rect(img, 24, 36, 104, 96, 10, Color(0.95, 0.55, 0.12))
	_fill_round_rect(img, 28, 40, 100, 72, 8, Color(1.0, 0.78, 0.28))
	_fill_rect(img, 36, 78, 92, 88, Color(0.85, 0.48, 0.08))


static func _paint_editor(img: Image) -> void:
	_fill_round_rect(img, 28, 78, 100, 92, 4, Color(0.55, 0.35, 0.85))
	_fill_polygon(img, PackedVector2Array([
		Vector2(30, 90), Vector2(44, 28), Vector2(58, 34), Vector2(44, 96),
	]), Color(0.75, 0.55, 1.0))
	_fill_circle(img, 44, 30, 6, Color(1.0, 0.9, 0.5))


static func _paint_credits(img: Image) -> void:
	_fill_round_rect(img, 30, 28, 98, 100, 8, Color(0.2, 0.72, 0.78))
	_fill_round_rect(img, 36, 34, 92, 94, 6, Color(0.85, 0.98, 1.0))
	for i in range(4):
		_fill_rect(img, 44, 44 + i * 14, 84, 52 + i * 14, Color(0.25, 0.65, 0.72, 0.55))


static func _paint_shop(img: Image) -> void:
	_fill_round_rect(img, 28, 48, 100, 100, 10, Color(0.85, 0.55, 0.08))
	_fill_polygon(img, PackedVector2Array([
		Vector2(32, 48), Vector2(48, 28), Vector2(80, 28), Vector2(96, 48),
	]), Color(1.0, 0.72, 0.15))
	_fill_circle(img, 50, 72, 8, Color(1.0, 0.9, 0.4))
	_fill_circle(img, 78, 72, 8, Color(1.0, 0.9, 0.4))


static func _paint_options(img: Image) -> void:
	var c := Color(0.75, 0.78, 0.85)
	var d := Color(0.45, 0.48, 0.58)
	for i in range(8):
		var angle := float(i) * TAU / 8.0
		var ox: float = 64.0 + cos(angle) * 34.0
		var oy: float = 64.0 + sin(angle) * 34.0
		_fill_circle(img, ox, oy, 12, d)
		_fill_circle(img, ox, oy, 8, c)
	_fill_circle(img, 64, 64, 16, d)
	_fill_circle(img, 64, 64, 10, Color(0.9, 0.92, 0.98))


static func _paint_quit(img: Image) -> void:
	_fill_round_rect(img, 30, 30, 98, 98, 8, Color(0.75, 0.15, 0.18))
	_fill_round_rect(img, 36, 36, 92, 92, 6, Color(0.95, 0.35, 0.32))
	_stroke_line(img, Vector2(48, 48), Vector2(80, 80), Color(1, 1, 1, 0.9), 8)
	_stroke_line(img, Vector2(80, 48), Vector2(48, 80), Color(1, 1, 1, 0.9), 8)


static func _paint_music(img: Image) -> void:
	var note := Color(0.95, 0.88, 0.28)
	var edge := Color(0.55, 0.42, 0.08)
	# Single eighth note — matches sidebar music button (♪)
	_fill_circle(img, 72, 82, 16, edge)
	_fill_circle(img, 70, 80, 14, note)
	_fill_rect(img, 80, 28, 88, 82, edge)
	_fill_rect(img, 82, 30, 86, 80, note)
	# Flag curve
	for i: int in range(24):
		var t := float(i) / 23.0
		var px := lerpf(86.0, 108.0, t)
		var py := lerpf(30.0, 52.0, t) + sin(t * PI) * 6.0
		_fill_circle(img, px, py, 4.5, note)


static func _paint_shop_key(img: Image) -> void:
	var gold := Color(1.0, 0.82, 0.2)
	var dark := Color(0.65, 0.45, 0.05)
	# Bow (ring)
	_fill_circle(img, 38, 64, 20, dark)
	_fill_circle(img, 38, 64, 14, gold)
	# Shaft
	_fill_rect(img, 52, 58, 102, 70, gold)
	# Bit teeth
	_fill_rect(img, 84, 70, 92, 82, gold)
	_fill_rect(img, 94, 70, 102, 78, gold)


static func _paint_life_plus(img: Image) -> void:
	_paint_heart(img)
	_fill_round_rect(img, 58, 58, 70, 70, 3, Color(1.0, 1.0, 1.0, 0.92))
	_fill_round_rect(img, 60, 52, 68, 76, 3, Color(1.0, 1.0, 1.0, 0.92))


static func _paint_skin_ball(img: Image) -> void:
	_fill_circle(img, 64, 64, 40, Color(0.85, 0.65, 0.1))
	_fill_circle(img, 64, 64, 34, Color(0.95, 0.82, 0.35))


static func _paint_theme_paint(img: Image) -> void:
	_fill_round_rect(img, 28, 70, 56, 100, 6, Color(0.9, 0.25, 0.35))
	_fill_round_rect(img, 48, 58, 76, 88, 6, Color(0.25, 0.75, 0.95))
	_fill_round_rect(img, 68, 42, 96, 72, 6, Color(0.55, 0.9, 0.35))


static func _paint_mat_rubber(img: Image) -> void:
	_fill_circle(img, 64, 64, 38, Color(0.25, 0.25, 0.28))
	_fill_circle(img, 64, 64, 30, Color(0.45, 0.45, 0.5))


static func _paint_mat_metal(img: Image) -> void:
	_fill_circle(img, 64, 64, 38, Color(0.55, 0.58, 0.65))
	_fill_circle(img, 64, 64, 30, Color(0.72, 0.75, 0.82))


static func _paint_mat_bouncy(img: Image) -> void:
	_fill_circle(img, 64, 64, 38, Color(0.95, 0.45, 0.85))
	_fill_circle(img, 64, 64, 28, Color(1.0, 0.65, 0.92))

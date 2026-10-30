class_name CookedFoodArt
extends RefCounted

# Each cooked food has its own mesh (on the hearth and in the hut) and a
# flat picture. The shape family plus the food's colour keeps them apart:
# a roasted bear is not a cooked pinecone.

static var _cooked: Dictionary = {}
static var _raw: Dictionary = {}
static var _icons: Dictionary = {}

static func cooked_mesh(id: String) -> ArrayMesh:
	if not _cooked.has(id):
		_cooked[id] = _build(id, true)
	return _cooked[id]

static func raw_mesh(id: String) -> ArrayMesh:
	if not _raw.has(id):
		_raw[id] = _build(id, false)
	return _raw[id]

static func icon(id: String) -> Texture2D:
	if not _icons.has(id):
		_icons[id] = ImageTexture.create_from_image(_raster(id, false))
	return _icons[id]

static func add_hearth(hut: Node3D) -> void:
	if hut.get_node_or_null("Hearth") != null:
		return
	var fire := Node3D.new()
	fire.name = "Hearth"
	fire.position = Vector3(2.15, 0.0, 2.35)
	var stones := MeshInstance3D.new()
	stones.mesh = _ring()
	fire.add_child(stones)
	var flame := MeshInstance3D.new()
	flame.mesh = _flame()
	flame.position = Vector3(0, 0.32, 0)
	fire.add_child(flame)
	hut.add_child(fire)

static func show_pantry(hut: Node3D) -> void:
	var old := hut.get_node_or_null("Pantry")
	if old != null:
		old.queue_free()
	var pantry: Dictionary = hut.get_meta("pantry", {})
	if pantry.is_empty():
		return
	var root := Node3D.new()
	root.name = "Pantry"
	hut.add_child(root)
	var slot := 0
	for key: Variant in pantry.keys():
		var n: int = int(pantry[key])
		if n <= 0 or not Kitchen.can_cook(str(key)):
			continue
		for k: int in mini(n, 2):
			var bit := MeshInstance3D.new()
			bit.mesh = cooked_mesh(str(key))
			bit.position = Vector3(-1.3 + float((slot + k) % 4) * 0.5, 0.32, 1.45)
			bit.scale = Vector3.ONE * 0.8
			root.add_child(bit)
		slot += 1
		if slot > 6:
			break

static func show_carried(human: Node3D, id: String) -> void:
	var old := human.get_node_or_null("Burden")
	if old != null:
		old.queue_free()
	if id.is_empty() or not Kitchen.COOK.has(id):
		return
	var bit := MeshInstance3D.new()
	bit.name = "Burden"
	bit.mesh = raw_mesh(id)
	bit.position = Vector3(0.32, 1.15, 0.15)
	bit.scale = Vector3.ONE * 0.5
	human.add_child(bit)

static func export_vectors(dir: String) -> void:
	DirAccess.make_dir_recursive_absolute(dir)
	for id: String in Kitchen.COOK.keys():
		var row: Dictionary = Kitchen.COOK[id]
		var tint: Color = row["tint"]
		var cooked: Color = tint.darkened(0.18)
		var text := "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' role='img' aria-label='%s'><ellipse cx='64' cy='74' rx='34' ry='24' fill='#%s'/><path d='M42 70 H86 M68 54 V88' stroke='#2a140c' stroke-width='3' stroke-linecap='round'/></svg>" % [Kitchen.label(id), cooked.to_html(false)]
		if str(row["family"]) == "kelp":
			text = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' role='img' aria-label='%s'><path d='M40 108 C28 70 52 50 42 22' stroke='#%s' stroke-width='8' fill='none'/><path d='M66 110 C74 64 54 48 70 20' stroke='#2f6a44' stroke-width='7' fill='none'/><path d='M90 104 C100 68 78 56 94 30' stroke='#1c4a32' stroke-width='6' fill='none'/><path d='M48 78 H96' stroke='#2a140c' stroke-width='3'/></svg>" % [Kitchen.label(id), cooked.to_html(false)]
		elif str(row["family"]) == "cone":
			text = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' role='img' aria-label='%s'><polygon points='64,24 96,104 32,104' fill='#%s'/><path d='M46 70 H82 M44 86 H84' stroke='#3a2414' stroke-width='3'/></svg>" % [Kitchen.label(id), cooked.to_html(false)]
		elif str(row["family"]) == "pineapple":
			text = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' role='img' aria-label='%s'><ellipse cx='64' cy='80' rx='22' ry='30' fill='#%s'/><polygon points='64,22 46,58 82,58' fill='#3c7a30'/><path d='M48 78 H80' stroke='#2a140c' stroke-width='3'/></svg>" % [Kitchen.label(id), cooked.to_html(false)]
		elif str(row["family"]) == "fish":
			text = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' role='img' aria-label='%s'><ellipse cx='72' cy='68' rx='36' ry='16' fill='#%s'/><polygon points='24,68 48,52 48,84' fill='#%s'/><path d='M50 68 H96' stroke='#2a140c' stroke-width='3'/></svg>" % [Kitchen.label(id), cooked.to_html(false), cooked.to_html(false)]
		elif str(row["family"]) == "haunch":
			text = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' role='img' aria-label='%s'><ellipse cx='56' cy='70' rx='22' ry='32' fill='#%s'/><rect x='74' y='78' width='32' height='7' rx='3' fill='#efe6d4'/></svg>" % [Kitchen.label(id), cooked.to_html(false)]
		var f := FileAccess.open(dir.path_join("cooked_%s.svg" % id), FileAccess.WRITE)
		if f != null:
			f.store_string(text)
			f.close()
		_raster(id, true).save_png(dir.path_join("cooked_%s.png" % id))
	_raster("riverweed", false).save_png(dir.path_join("riverweed.png"))

static func _build(id: String, cooked: bool) -> ArrayMesh:
	var row: Dictionary = Kitchen.COOK.get(id, {"family": "greens", "tint": Color(0.4, 0.55, 0.3), "mass": 0.5})
	var family := str(row.get("family", "roast"))
	var tint: Color = row.get("tint", Color(0.5, 0.3, 0.2))
	tint = tint.darkened(0.18) if cooked else tint.lightened(0.25)
	var scale := clampf(0.28 + float(row.get("mass", 1.0)) * 0.08, 0.32, 0.95)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	match family:
		"apple":
			_sphere(st, Vector3(0, 0.2, 0), Vector3(0.2, 0.18, 0.2) * scale, tint)
		"pineapple":
			_sphere(st, Vector3(0, 0.22, 0), Vector3(0.14, 0.26, 0.14) * scale, tint)
			_sphere(st, Vector3(0, 0.46, 0) * scale, Vector3(0.1, 0.08, 0.1), Color(0.25, 0.48, 0.18))
		"cone":
			for k: int in 5:
				var r := 0.16 - float(k) * 0.025
				_sphere(st, Vector3(0, 0.06 + float(k) * 0.07, 0), Vector3(r, 0.035, r) * scale, tint.darkened(0.04 * k))
		"cap":
			_sphere(st, Vector3(0, 0.14, 0), Vector3(0.2, 0.08, 0.2) * scale, tint)
		"fish":
			_sphere(st, Vector3(0, 0.1, 0), Vector3(0.26, 0.08, 0.1) * scale, tint)
		"bird":
			_sphere(st, Vector3(0, 0.12, 0), Vector3(0.14, 0.08, 0.1) * scale, tint)
		"skewer":
			_box(st, Vector3(0, 0.08, 0), Vector3(0.28, 0.012, 0.012) * scale, Color(0.42, 0.28, 0.14))
			_sphere(st, Vector3(-0.06, 0.1, 0), Vector3(0.06, 0.05, 0.05) * scale, tint)
		"kelp", "greens":
			_ribbon(st, Vector3(-0.06, 0, 0), 0.4, tint)
			_ribbon(st, Vector3(0.08, 0, 0.02), -0.3, tint.darkened(0.1))
		"fillet":
			_sphere(st, Vector3(0, 0.08, 0), Vector3(0.24, 0.05, 0.12) * scale, tint)
		"haunch":
			_sphere(st, Vector3(0, 0.16, 0), Vector3(0.14, 0.2, 0.12) * scale, tint)
			_box(st, Vector3(-0.1, 0.08, 0), Vector3(0.14, 0.025, 0.025), Color(0.92, 0.88, 0.8))
		_:
			_sphere(st, Vector3(0, 0.14, 0), Vector3(0.18, 0.12, 0.14) * scale, tint)
			_box(st, Vector3(0.1, 0.08, 0), Vector3(0.14, 0.03, 0.03), Color(0.92, 0.88, 0.8))
	if cooked:
		_box(st, Vector3(0, 0.2 * scale, 0), Vector3(0.14 * scale, 0.01, 0.018), Color(0.12, 0.06, 0.04))
	st.generate_normals()
	return st.commit()

static func _raster(id: String, cooked: bool) -> Image:
	var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var row: Dictionary = Kitchen.COOK.get(id, {"tint": Color(0.25, 0.5, 0.32), "family": "kelp"})
	var tint: Color = row.get("tint", Color(0.3, 0.5, 0.3))
	if cooked:
		tint = tint.darkened(0.2)
	var family := str(row.get("family", "kelp"))
	if family == "kelp" or family == "greens":
		_blob(img, 46, 74, 8, 40, tint)
		_blob(img, 68, 68, 7, 44, tint.lightened(0.1))
		_blob(img, 88, 78, 7, 32, tint.darkened(0.08))
	elif family == "cone":
		for k: int in 4:
			_blob(img, 64, 90 - k * 14, 30 - k * 6, 10, tint)
	elif family == "pineapple":
		_blob(img, 64, 78, 20, 32, tint)
		_blob(img, 64, 40, 14, 12, Color(0.28, 0.5, 0.2))
	elif family == "fish":
		_blob(img, 72, 68, 36, 14, tint)
	else:
		_blob(img, 60, 74, 32, 22, tint)
		_blob(img, 96, 82, 14, 4, Color(0.9, 0.86, 0.76))
	if cooked:
		_blob(img, 64, 72, 20, 3, Color(0.15, 0.08, 0.05))
	return img

static func _blob(img: Image, cx: int, cy: int, rx: int, ry: int, col: Color) -> void:
	for y: int in range(maxi(cy - ry, 0), mini(cy + ry, 127) + 1):
		for x: int in range(maxi(cx - rx, 0), mini(cx + rx, 127) + 1):
			var nx := float(x - cx) / float(maxi(rx, 1))
			var ny := float(y - cy) / float(maxi(ry, 1))
			if nx * nx + ny * ny <= 1.0:
				img.set_pixel(x, y, col)

static func _sphere(st: SurfaceTool, center: Vector3, radius: Vector3, col: Color) -> void:
	var lat := 5
	var lon := 7
	for i: int in lat:
		for j: int in lon:
			var a := _sp(center, radius, i, j, lat, lon)
			var b := _sp(center, radius, i + 1, j, lat, lon)
			var c := _sp(center, radius, i + 1, j + 1, lat, lon)
			var d := _sp(center, radius, i, j + 1, lat, lon)
			_tri(st, a, b, c, col)
			_tri(st, a, c, d, col)

static func _sp(center: Vector3, radius: Vector3, i: int, j: int, lat: int, lon: int) -> Vector3:
	var v := float(i) / float(lat) * PI
	var u := float(j) / float(lon) * TAU
	return center + Vector3(sin(v) * cos(u) * radius.x, cos(v) * radius.y, sin(v) * sin(u) * radius.z)

static func _box(st: SurfaceTool, center: Vector3, half: Vector3, col: Color) -> void:
	var p: Array[Vector3] = []
	for s: Vector3 in [Vector3(-1, -1, -1), Vector3(1, -1, -1), Vector3(1, 1, -1), Vector3(-1, 1, -1), Vector3(-1, -1, 1), Vector3(1, -1, 1), Vector3(1, 1, 1), Vector3(-1, 1, 1)]:
		p.append(center + Vector3(s.x * half.x, s.y * half.y, s.z * half.z))
	_quad(st, p[0], p[1], p[2], p[3], col)
	_quad(st, p[4], p[7], p[6], p[5], col)
	_quad(st, p[0], p[4], p[5], p[1], col)
	_quad(st, p[3], p[2], p[6], p[7], col)

static func _ribbon(st: SurfaceTool, origin: Vector3, lean: float, col: Color) -> void:
	var prev := origin
	for i: int in 5:
		var t := float(i + 1) / 5.0
		var next := origin + Vector3(sin(t * 4.0 + lean) * 0.08, t * 0.4, cos(t * 3.0) * 0.05)
		var side := Vector3(0.025, 0, 0.015)
		_quad(st, prev - side, prev + side, next + side, next - side, col)
		prev = next

static func _ring() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i: int in 8:
		var a := float(i) / 8.0 * TAU
		var b := float(i + 1) / 8.0 * TAU
		_tri(st, Vector3(cos(a) * 0.28, 0.04, sin(a) * 0.28), Vector3(cos(b) * 0.28, 0.04, sin(b) * 0.28), Vector3(0, 0.02, 0), Color(0.35, 0.32, 0.28))
	st.generate_normals()
	return st.commit()

static func _flame() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_sphere(st, Vector3(0, 0.1, 0), Vector3(0.07, 0.14, 0.07), Color(0.95, 0.45, 0.12))
	st.generate_normals()
	return st.commit()

static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, col: Color) -> void:
	st.set_color(col)
	st.add_vertex(a)
	st.set_color(col)
	st.add_vertex(b)
	st.set_color(col)
	st.add_vertex(c)

static func _quad(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, d: Vector3, col: Color) -> void:
	_tri(st, a, b, c, col)
	_tri(st, a, c, d, col)

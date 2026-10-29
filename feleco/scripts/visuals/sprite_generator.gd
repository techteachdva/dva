class_name SpriteGenerator

# Procedural creature art. Each sprite is painted at 2x with soft volume
# shading, then outlined and box-filtered down, so edges stay clean under
# alpha scissor. Creatures are drawn in side profile facing right; the
# sprite shader mirrors them when they walk left.
#
# Creatures are painted as little skeletons: legs hang from hips and bend at
# the knee, heads turn on the neck, tails, ears, wings, jaws and arms swing
# from their roots. A pose (see pose_for) sets every joint, so one painter
# draws every frame of every animation.
#
# Every species has two sheets:
#   <species>.png       the rest pose; columns are the kinds (normal, tough,
#                       special, golden), rows the sexes (male on top, female
#                       below).
#                       Menus, the betting table and carcasses use it.
#   <species>_anim.png  every animation frame (FRAMES across) for each of the
#                       eight kind/sex cells (rows: male n/t/s/g, female n/t/s/g).
#                       The valley and the Field Guide animate from it.
# The game loads the baked sheets in res://assets/sprites/ (see bake_all);
# painting at runtime is only a fallback because it is slow.

const SIZE: int = 128
const SS: int = 2
const SPRITE_DIR: String = "res://assets/sprites/"
const SPECIES: Array[String] = ["sheep", "wolf", "boar", "falcon", "robin", "worm", "human", "rabbit", "fish", "mushroom", "deer", "goat", "bear", "lion", "beetle", "mouse"]
# Columns: normal, tough, special, golden (3.0: a creature that ate gold).
const COLS: int = 4
const GOLDEN: int = 3
const ROWS: int = 2

# The animation sheet's frames, shared by every species (the creature rig
# shader picks them by what the creature is doing).
const F_STAND: int = 0
const F_WALK: int = 1          # walk / trot / hop / wingbeat / crawl / swim cycle
const WALK_FRAMES: int = 12
const F_BLINK: int = 13
const F_GLANCE: int = 14       # looks about (up, around, down at the ground)
const F_CAMERA: int = 15       # turns to look out of the picture at the viewer
const F_EAT: int = 16          # two frames
const F_ALARM: int = 18        # startled, with action lines bursting from the head
const F_WINDUP: int = 19
const F_STRIKE: int = 20
const F_SLEEP: int = 21        # two frames (breathing)
const F_WORK: int = 23         # two frames: building, casting, courting, howling
const FRAMES: int = 25
const CELLS: int = 8

static var _img: Image
static var _w: int = 0
static var _h: int = 0
# Joint transforms (128-space to 128-space) applied to everything painted.
static var _xf: Transform2D = Transform2D.IDENTITY
static var _stack: Array[Transform2D] = []
static var _pose: Dictionary = {}
# Where the startle lines burst from (image space), and how far out they start.
static var _crown: Vector2 = Vector2(-1, -1)
static var _crown_r: float = 0.0
# Painting a golden form (see _golden): painters add their golden extras.
static var _gold: bool = false
# Where the wizard's orb was last drawn, for its sparks.
static var _orb: Vector2 = Vector2.ZERO

static func cell_size(species: String) -> Vector2i:
	return Vector2i(SIZE, SIZE / 2) if species == "fish" else Vector2i(SIZE, SIZE)

static func texture_for(species: String) -> Texture2D:
	var path := SPRITE_DIR + species + ".png"
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return ImageTexture.create_from_image(atlas_image(species))

static func anim_texture_for(species: String) -> Texture2D:
	var path := SPRITE_DIR + species + "_anim.png"
	if ResourceLoader.exists(path):
		return load(path) as Texture2D
	return ImageTexture.create_from_image(anim_image(species))

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
			var img := generate_image(species, col, row == 1, F_STAND)
			atlas.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(col * cell.x, row * cell.y))
	return atlas

# Every frame across, the six kind/sex cells down.
static func anim_image(species: String) -> Image:
	var cell := cell_size(species)
	var sheet := Image.create(cell.x * FRAMES, cell.y * CELLS, false, Image.FORMAT_RGBA8)
	sheet.fill(Color(0.1, 0.08, 0.07, 0.0))
	for c: int in CELLS:
		var still: Image = null
		for fr: int in FRAMES:
			var img: Image
			# Mushrooms have one pose; the rig sways them.
			if species == "mushroom" and still != null:
				img = still
			else:
				img = generate_image(species, c % COLS, c >= COLS, fr)
				still = img
			sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(fr * cell.x, c * cell.y))
	return sheet

# role: 0 normal, 1 tough, 2 special.
static func generate_image(species: String, role: int = 0, female: bool = false, frame: int = F_STAND) -> Image:
	var ink := Color(0.1, 0.08, 0.07)
	_begin(cell_size(species), ink)
	_pose = pose_for(species, frame)
	_crown = Vector2(-1, -1)
	if role == GOLDEN:
		_golden(species, female)
		_alarm_lines()
		return _goldify(_finish(ink, 3))
	_paint(species, role, female)
	_alarm_lines()
	return _finish(ink, 3)

static func _paint(species: String, role: int, female: bool) -> void:
	match species:
		"sheep": _sheep(role, female)
		"wolf": _wolf(role, female)
		"boar": _boar(role, female)
		"falcon": _falcon(role, female)
		"robin": _robin(role, female)
		"worm": _worm(role, female)
		"human": _human(role, female)
		"rabbit": _rabbit(role, female)
		"mouse": _mouse(role, female)
		"fish": _fish(role, female)
		"mushroom": _mushroom(role)
		"deer": _deer(role, female)
		"goat": _goat(role, female)
		"bear": _bear(role, female)
		"lion": _lion(role, female)
		"beetle": _beetle(role, female)

# Writes every species sheet, the blob shadow and the grass tuft to dir.
static func bake_all(dir: String, only: Array = []) -> void:
	DirAccess.make_dir_recursive_absolute(dir)
	for s: String in SPECIES:
		if not only.is_empty() and not only.has(s):
			continue
		var t0: int = Time.get_ticks_msec()
		atlas_image(s).save_png(dir.path_join(s + ".png"))
		anim_image(s).save_png(dir.path_join(s + "_anim.png"))
		print("  baked ", s, " in ", (Time.get_ticks_msec() - t0) / 1000.0, "s")
	if only.is_empty():
		shadow_image().save_png(dir.path_join("shadow.png"))
		tuft_image().save_png(dir.path_join("tuft.png"))
		mycelium_image().save_png(dir.path_join("mycelium.png"))
		bake_plants(dir)

# Producer icons and the 3D plant textures (see tree.gd and apple.gd).
static func bake_plants(dir: String) -> void:
	for k: String in ["berry", "moss", "apple", "pinecone", "pineapple"]:
		producer_image(k).save_png(dir.path_join(k + ".png"))
	bark_image().save_png(dir.path_join("bark.png"))
	fruit_image(Color(0.86, 0.14, 0.1)).save_png(dir.path_join("apple_skin.png"))
	fruit_image(Color(0.42, 0.16, 0.55)).save_png(dir.path_join("berry_skin.png"))

# Golden forms. Most species are their normal selves cast in gold; a few
# become something grander.
# Golden forms. Most species are their normal selves cast in gold; a few
# become something grander (their painters add the extras while _gold is on,
# so antlers, tusks and claws move with the head and legs).
static func _golden(species: String, f: bool) -> void:
	_gold = true
	match species:
		"sheep": _sheep(2, f)  # the Golden Fleece
		"deer": _deer(1, false)  # a regal stag, always
		"boar": _boar(1, false)
		"bear": _bear(0, f)
		"human": _human(2, f)  # a golden wizard with a halo
		"mushroom": _mushroom(1)
		_: _paint(species, 0, f)
	_gold = false

# Recast a finished sprite in gold, keeping its light and shade and its
# dark outline.
static func _goldify(img: Image) -> Image:
	var dark := Color(0.5, 0.32, 0.06)
	var bright := Color(1.0, 0.9, 0.5)
	for y: int in img.get_height():
		for x: int in img.get_width():
			var c := img.get_pixel(x, y)
			if c.a < 0.01:
				continue
			var l: float = c.get_luminance()
			if l < 0.14:
				continue
			var g := dark.lerp(bright, clampf(l * 1.15, 0.0, 1.0))
			g.a = c.a
			img.set_pixel(x, y, g)
	return img

static func _pick(role: int, female: bool, table: Array) -> Color:
	return table[role * 2 + (1 if female else 0)]

# ------------------------------------------------------------------
# Poses. Angles are degrees, clockwise on screen for a creature facing
# right: head +down, tail +up, ears +forward, pitch +nose down, wing
# +downstroke. Species read what they need and tune the rest.
# ------------------------------------------------------------------
static func pose_for(species: String, frame: int) -> Dictionary:
	var p: Dictionary = {"act": "stand", "k": 0, "t": 0.0, "walk": false, "bob": 0.0, "pitch": 0.0, "shift": 0.0,
		"head": 0.0, "turn": 0.0, "eyes": "open", "mouth": 0.0, "tail": 0.0, "ears": 0.0,
		"legs": "stand", "lie": 0.0, "lines": false, "wing": 0.0, "breath": 0.0}
	if frame >= F_WALK and frame < F_WALK + WALK_FRAMES:
		var t: float = float(frame - F_WALK) / float(WALK_FRAMES)
		var a: float = t * TAU
		p["act"] = "walk"
		p["walk"] = true
		p["legs"] = "walk"
		p["t"] = t
		p["tail"] = sin(a) * 14.0
		p["head"] = sin(a * 2.0) * 2.5
		# Highest as the legs pass under the body, lowest at full stride.
		p["bob"] = -absf(cos(a)) * 2.4 + 1.0
		p["ears"] = -sin(a * 2.0) * 4.0
		return p
	match frame:
		F_BLINK:
			p["act"] = "blink"
			p["eyes"] = "shut"
		F_GLANCE:
			p["act"] = "glance"
			p["head"] = -14.0
			p["ears"] = 10.0
			p["eyes"] = "up"
			p["tail"] = 8.0
		F_CAMERA:
			p["act"] = "camera"
			p["turn"] = 1.0
			p["head"] = -8.0
			p["ears"] = 8.0
		F_EAT, F_EAT + 1:
			var k: int = frame - F_EAT
			p["act"] = "eat"
			p["k"] = k
			p["head"] = 50.0 - k * 5.0
			p["mouth"] = 0.45 * k
			p["ears"] = -6.0 * k
			p["tail"] = -6.0 + 12.0 * k
		F_ALARM:
			p["act"] = "alarm"
			p["head"] = -14.0
			p["ears"] = 12.0
			p["eyes"] = "wide"
			p["lines"] = true
			p["bob"] = -6.0
			p["legs"] = "splay"
			p["tail"] = 24.0
			p["mouth"] = 0.5
		F_WINDUP:
			p["act"] = "windup"
			p["pitch"] = -7.0
			p["shift"] = -3.0
			p["head"] = -10.0
			p["legs"] = "rear"
			p["mouth"] = 0.35
			p["ears"] = -30.0
			p["tail"] = 10.0
		F_STRIKE:
			p["act"] = "strike"
			p["pitch"] = 6.0
			p["shift"] = 3.0
			p["head"] = 10.0
			p["legs"] = "lunge"
			p["mouth"] = 1.0
			p["ears"] = -30.0
			p["tail"] = 18.0
		F_SLEEP, F_SLEEP + 1:
			p["act"] = "sleep"
			p["k"] = frame - F_SLEEP
			p["lie"] = 1.0
			p["eyes"] = "shut"
			p["head"] = 32.0
			p["breath"] = float(frame - F_SLEEP)
			p["legs"] = "fold"
			p["tail"] = -14.0
			p["ears"] = -20.0
		F_WORK, F_WORK + 1:
			var k2: int = frame - F_WORK
			p["act"] = "work"
			p["k"] = k2
			p["head"] = -18.0 + 20.0 * k2
			p["bob"] = -6.0 * k2
			p["tail"] = 18.0 - 30.0 * k2
			p["ears"] = 10.0
	return p

static func _pf(key: String) -> float:
	return float(_pose.get(key, 0.0))

static func _act() -> String:
	return String(_pose.get("act", "stand"))

# ------------------------------------------------------------------
# Joints
# ------------------------------------------------------------------
# Everything painted until the matching _pop turns `deg` about `pivot`, is
# scaled about it, then moved by `offset`.
static func _push(pivot: Vector2, deg: float, offset: Vector2 = Vector2.ZERO, scale: Vector2 = Vector2.ONE) -> void:
	_stack.append(_xf)
	var local := Transform2D(0.0, pivot + offset) * Transform2D(deg_to_rad(deg), scale, 0.0, Vector2.ZERO) * Transform2D(0.0, -pivot)
	_xf = _xf * local

static func _pop() -> void:
	_xf = _stack.pop_back()

# The whole animal: pitch about the feet, bob, lunge, breathe, lie down.
static func _body_begin(feet: Vector2, drop: float = 0.0) -> void:
	var s := Vector2(1.0, 1.0 + 0.035 * _pf("breath"))
	_push(feet, _pf("pitch"), Vector2(_pf("shift"), _pf("bob") + drop * _pf("lie")), s)

# The head turns on the neck; turned to the camera it foreshortens and
# tips up a little.
static func _head_begin(neck: Vector2, extra: float = 0.0) -> void:
	var turn: float = _pf("turn")
	_push(neck, _pf("head") + extra - 10.0 * turn, Vector2.ZERO, Vector2(1.0 - 0.36 * turn, 1.0))

# The startle lines burst out around this point of the head.
static func _alarm_at(centre: Vector2, r0: float) -> void:
	_crown = _xf * centre
	_crown_r = r0

static func _alarm_lines() -> void:
	if not bool(_pose.get("lines", false)) or _crown.x < 0.0:
		return
	_xf = Transform2D.IDENTITY
	var bright := Color(1.0, 0.97, 0.82)
	for spec: Vector2 in [Vector2(-90, 11), Vector2(-52, 10), Vector2(-128, 10), Vector2(-18, 6), Vector2(-162, 6)]:
		var ang: float = deg_to_rad(spec.x)
		var d := Vector2(cos(ang), sin(ang))
		var a := _crown + d * _crown_r
		var b := _crown + d * (_crown_r + spec.y)
		# Keep the strokes on the canvas (they shrink rather than clip).
		var lim_y: float = 4.0
		if b.y < lim_y and absf(d.y) > 0.01:
			var k: float = clampf((a.y - lim_y) / (a.y - b.y), 0.0, 1.0)
			b = a.lerp(b, k)
		b.x = clampf(b.x, 4.0, _w / SS - 4.0)
		a.x = clampf(a.x, 4.0, _w / SS - 4.0)
		if a.distance_to(b) > 2.5:
			_line(a, b, 3.4, bright, 0.0)

# A two-bone limb hung from hip: thigh to knee, shin to the foot, then a
# hoof or paw. a_hip turns the whole leg, a_knee the shin.
static func _limb(hip: Vector2, knee: Vector2, foot: Vector2, a_hip: float, a_knee: float, w_top: float, w_bot: float, col: Color, paw: Color, paw_r: Vector2) -> void:
	_push(hip, a_hip)
	_line(hip, knee, w_top, col)
	_push(knee, a_knee)
	_line(knee, foot, w_bot, col)
	if paw_r.x > 0.0:
		_ell(foot.x, foot.y, paw_r.x, paw_r.y, paw, 0.0, 0.0)
	_pop()
	_pop()

# Hip and knee angles for one of a four-legged walker's legs. off is the
# leg's place in the stride (diagonal pairs share it).
static func _leg_angles(off: float, front: bool) -> Vector2:
	match String(_pose.get("legs", "stand")):
		"walk":
			var a: float = TAU * (_pf("t") + off)
			var amp: float = float(_pose.get("amp", 24.0))
			var lift: float = float(_pose.get("lift", 40.0))
			# Forward swing with the shin tucked, then a straight leg pushes back.
			return Vector2(-sin(a) * amp, maxf(0.0, cos(a)) * lift)
		"splay":
			return Vector2(-14.0 if front else 16.0, 0.0)
		"lunge":
			return Vector2(-30.0 if front else 26.0, 10.0 if front else 0.0)
		"rear":
			return Vector2(-34.0 if front else 8.0, 64.0 if front else 0.0)
		"fold":
			if front and not bool(_pose.get("tuck", false)):
				return Vector2(-85.0, 0.0)
			return Vector2(-72.0, 150.0)
	return Vector2.ZERO

static func _quad_leg(hip: Vector2, foot: Vector2, off: float, front: bool, w: float, col: Color, paw: Color, paw_r: Vector2) -> void:
	var a := _leg_angles(off, front)
	var knee := (hip + foot) * 0.5 + Vector2(-1.5 if front else 1.5, 0.0)
	_limb(hip, knee, foot, a.x, a.y, w, w * 0.9, col, paw, paw_r)

# An eye in whatever state the pose asks: open, shut, wide with alarm,
# rolled up, or (head turned to the camera) both eyes staring out.
static func _peye(cx: float, cy: float, r: float, iris: Color) -> void:
	var dark := Color(0.06, 0.05, 0.05)
	match String(_pose.get("eyes", "open")):
		"shut":
			_arc(cx, cy - r * 0.2, r * 0.9, 15.0, 165.0, maxf(1.3, r * 0.45), dark)
		"wide":
			_dot(cx, cy, r * 1.5, Color(0.99, 0.98, 0.95))
			_dot(cx + r * 0.1, cy, r * 0.5, dark)
			_dot(cx - r * 0.35, cy - r * 0.5, maxf(r * 0.28, 0.8), Color(1, 1, 1))
		"up":
			_dot(cx, cy, r, iris)
			_dot(cx + r * 0.2, cy - r * 0.32, r * 0.55, dark)
			_dot(cx - r * 0.3, cy - r * 0.35, maxf(r * 0.3, 0.8), Color(1, 1, 1))
		_:
			if _pf("turn") > 0.5:
				_eye_front(cx - r * 0.2, cy, r, iris)
				_eye_front(cx + r * 2.9, cy + r * 0.2, r * 0.92, iris)
			else:
				_eye(cx, cy, r, iris)

static func _eye_front(cx: float, cy: float, r: float, iris: Color) -> void:
	_dot(cx, cy, r * 1.18, Color(0.98, 0.97, 0.93))
	_dot(cx, cy, r * 0.82, iris)
	_dot(cx, cy, r * 0.48, Color(0.06, 0.05, 0.05))
	_dot(cx - r * 0.3, cy - r * 0.35, maxf(r * 0.28, 0.8), Color(1, 1, 1))

# ------------------------------------------------------------------
# Creatures (coordinates in 128-space; feet rest near y = 122)
# ------------------------------------------------------------------
static func _sheep(r: int, f: bool) -> void:
	# normal: cream wool; Highlander: shaggy oatmeal; Golden Fleece: gold wool, white face.
	var wool: Color = _pick(r, f, [Color(0.97, 0.95, 0.89), Color(0.98, 0.96, 0.92), Color(0.74, 0.62, 0.48), Color(0.8, 0.7, 0.56), Color(0.98, 0.8, 0.32), Color(1.0, 0.86, 0.46)])
	var face: Color = [Color(0.24, 0.21, 0.21), Color(0.36, 0.24, 0.16), Color(0.94, 0.9, 0.82)][r]
	var horn: Color = [Color(0.72, 0.62, 0.46), Color(0.42, 0.32, 0.22), Color(0.96, 0.9, 0.7)][r]
	var leg: Color = face.darkened(0.15) if r != 2 else Color(0.3, 0.26, 0.22)
	var hoof := Color(0.1, 0.09, 0.09)
	var thick: float = 7.0 if r == 1 else 5.5
	_pose["amp"] = 22.0
	_pose["lift"] = 46.0
	_pose["tuck"] = true
	match _act():
		"eat": _pose["head"] = 56.0 - _pose["k"] * 6.0
		"strike": _pose["head"] = 26.0   # head down, horns first
		"work": _pose["legs"] = "splay" if _pose["k"] == 1 else "stand"
	_body_begin(Vector2(64, 121), 19.0)
	_quad_leg(Vector2(42, 90), Vector2(40, 121), 0.5, false, thick - 0.5, leg.darkened(0.25), hoof, Vector2(3.8, 2.2))
	_quad_leg(Vector2(78, 90), Vector2(80, 121), 0.0, true, thick - 0.5, leg.darkened(0.25), hoof, Vector2(3.8, 2.2))
	# A stubby tail tucked into the fleece.
	_push(Vector2(28, 72), _pf("tail") * 0.8)
	_ell(20, 76, 8, 6, wool.darkened(0.06), 30.0)
	_pop()
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
	_quad_leg(Vector2(50, 94), Vector2(50, 122), 0.0, false, thick, leg, hoof, Vector2(4.5, 2.5))
	_quad_leg(Vector2(84, 92), Vector2(86, 122), 0.5, true, thick, leg, hoof, Vector2(4.5, 2.5))
	if r == 1:
		# Bellwether's bell.
		_line(Vector2(88, 80), Vector2(96, 84), 2.0, Color(0.5, 0.25, 0.15), 0.0)
		_circ(93, 89, 4.0, Color(0.9, 0.72, 0.3))
	elif r == 2:
		for p: Vector2 in [Vector2(40, 64), Vector2(66, 60), Vector2(54, 84), Vector2(78, 78)]:
			_star(p.x, p.y, 3.4, Color(1.0, 0.98, 0.85))
	_head_begin(Vector2(88, 70))
	_push(Vector2(94, 60), _pf("ears") * 0.8)
	_ell(90, 58, 10, 4.5, face.darkened(0.2), 28.0)
	_pop()
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
	_peye(104, 63, 3.6, Color(0.95, 0.93, 0.85))
	if f and String(_pose["eyes"]) == "open" and _pf("turn") < 0.5:
		_line(Vector2(101, 58), Vector2(107, 57), 1.2, Color(0.08, 0.07, 0.07), 0.0)
	_dot(111, 78, 1.6, Color(0.08, 0.07, 0.07))
	if _pf("mouth") > 0.3:
		_ell(108, 82, 3.0, 2.0 * _pf("mouth"), Color(0.35, 0.12, 0.12), 0.0, 0.0)
	if _act() == "eat":
		# A mouthful of grass.
		for i: int in 3:
			_line(Vector2(108, 83), Vector2(104 + i * 5, 90 + (i % 2) * 2), 1.4, Color(0.4, 0.68, 0.28), 0.0)
	if r == 2 and f:
		_circ(97, 46, 3.2, Color(1.0, 1.0, 1.0), 0.0)
		_dot(97, 46, 1.4, Color(0.98, 0.8, 0.2))
	_alarm_at(Vector2(98, 60), 19.0)
	_pop()
	_pop()

static func _wolf(r: int, f: bool) -> void:
	# normal: grey; Alpha: charcoal, scarred; Moon Howler: silver-blue with a moon mark.
	var fur: Color = _pick(r, f, [Color(0.46, 0.49, 0.56), Color(0.56, 0.55, 0.56), Color(0.28, 0.28, 0.31), Color(0.34, 0.32, 0.34), Color(0.76, 0.82, 0.92), Color(0.84, 0.86, 0.94)])
	var dark: Color = fur.darkened(0.4)
	var cream: Color = Color(0.96, 0.97, 1.0) if r == 2 else Color(0.86, 0.83, 0.75)
	var eye: Color = [Color(0.98, 0.78, 0.25), Color(0.98, 0.5, 0.2), Color(0.45, 0.85, 1.0)][r]
	var bulk: float = (2.0 if r == 1 else 0.0) + (0.0 if f else 1.5)
	_pose["amp"] = 30.0
	_pose["lift"] = 55.0
	match _act():
		"walk":
			# A level, reaching lope: the head stays low and forward.
			_pose["head"] = 6.0 + _pf("head")
			_pose["tail"] = -10.0 + _pf("tail") * 0.6
		"eat":
			_pose["head"] = 38.0 - _pose["k"] * 10.0
			_pose["mouth"] = 0.7 - _pose["k"] * 0.4
		"work":
			# Howling at the sky.
			_pose["head"] = -48.0 - _pose["k"] * 6.0
			_pose["mouth"] = 0.55 + _pose["k"] * 0.35
			_pose["eyes"] = "shut"
			_pose["bob"] = 0.0
			_pose["tail"] = -8.0
			_pose["legs"] = "stand"
		"windup":
			_pose["head"] = 4.0   # head low, hackles up, snarling
			_pose["mouth"] = 0.45
		"strike":
			_pose["head"] = -6.0
	_body_begin(Vector2(64, 121), 18.0)
	_push(Vector2(36, 74), _pf("tail"))
	# A brush hanging back from the rump, tipped in cream.
	_ell(22, 82, 18, 7.5, dark, -36.0)
	_ell(11, 90, 6.5, 4.5, cream, -36.0)
	_pop()
	_quad_leg(Vector2(40, 88), Vector2(36, 121), 0.5, false, 6.5, dark.darkened(0.2), dark.darkened(0.3), Vector2(4.0, 2.2))
	_quad_leg(Vector2(78, 88), Vector2(81, 121), 0.0, true, 6.5, dark.darkened(0.2), dark.darkened(0.3), Vector2(4.0, 2.2))
	_ell(58, 80, 34, 16 + bulk, fur)
	_ell(54, 70, 28, 7 + bulk * 0.5, dark)
	if _act() == "windup" or _act() == "alarm":
		# Hackles up along the spine.
		for i: int in 6:
			var x: float = 40.0 + i * 7.0
			_poly([Vector2(x - 4, 66), Vector2(x + 1, 57), Vector2(x + 4, 66)], dark, 0.3)
	_ell(62, 92, 22, 6, cream)
	_ell(84, 82, 14, 15, cream)
	if not f:
		# Males carry a heavy ruff.
		_ell(86, 66, 13, 17, fur.lightened(0.08), -20.0)
	_poly([Vector2(76, 70), Vector2(94, 50), Vector2(106, 58), Vector2(92, 88)], fur)
	_quad_leg(Vector2(48, 92), Vector2(48, 122), 0.0, false, 7.0 + bulk * 0.4, fur, dark, Vector2(4.5, 2.5))
	_quad_leg(Vector2(86, 92), Vector2(90, 122), 0.5, true, 7.0 + bulk * 0.4, fur, dark, Vector2(4.5, 2.5))
	if r == 2:
		if f:
			_star(56, 74, 6.0, Color(0.98, 0.96, 0.75))
		else:
			_circ(56, 74, 7, Color(0.98, 0.96, 0.75), 0.0)
			_circ(59, 72, 6.5, fur, 0.0)
	_head_begin(Vector2(92, 64))
	_push(Vector2(100, 48), _pf("ears") * 0.7)
	_poly([Vector2(91, 48), Vector2(95, 30), Vector2(102, 46)], dark)
	_poly([Vector2(98, 46), Vector2(104, 32), Vector2(108, 48)], dark.darkened(0.15))
	_pop()
	_ell(100, 56, 13, 11, fur)
	var m: float = _pf("mouth")
	_poly([Vector2(104, 51), Vector2(124, 59), Vector2(123, 63), Vector2(104, 63)], cream)
	if m > 0.05:
		_poly([Vector2(104, 63), Vector2(122, 62), Vector2(118, 73), Vector2(104, 69)], Color(0.42, 0.1, 0.12), 0.0)
		_poly([Vector2(116, 62.5), Vector2(118.5, 62.5), Vector2(117.5, 67)], Color(0.98, 0.97, 0.92), 0.0)
	_push(Vector2(105, 63), m * 26.0)
	_poly([Vector2(104, 63), Vector2(121, 63), Vector2(119, 67), Vector2(104, 67)], cream)
	if m > 0.3:
		_poly([Vector2(112, 63.5), Vector2(114, 60), Vector2(115.5, 63.5)], Color(0.98, 0.97, 0.92), 0.0)
	_pop()
	_dot(123, 60.5, 2.6, Color(0.08, 0.07, 0.07))
	if m <= 0.05:
		_line(Vector2(110, 66), Vector2(121, 65), 1.0, Color(0.15, 0.12, 0.12), 0.0)
	_peye(104, 52, 2.8, eye)
	if _act() == "windup" or _act() == "strike":
		# A scowl.
		_line(Vector2(99, 47), Vector2(108, 50), 1.6, Color(0.08, 0.07, 0.07), 0.0)
	if r == 1:
		_line(Vector2(98, 44), Vector2(108, 60), 1.4, Color(0.85, 0.65, 0.6), 0.0)
		_line(Vector2(102, 44), Vector2(110, 56), 1.2, Color(0.85, 0.65, 0.6), 0.0)
	_alarm_at(Vector2(102, 50), 16.0)
	_pop()
	_pop()

static func _boar(r: int, f: bool) -> void:
	# normal: brown; Tusker: near-black, huge tusks; Truffler: russet with a gold snout ring.
	var body: Color = _pick(r, f, [Color(0.46, 0.33, 0.23), Color(0.6, 0.46, 0.34), Color(0.24, 0.19, 0.17), Color(0.34, 0.27, 0.22), Color(0.72, 0.42, 0.22), Color(0.82, 0.54, 0.32)])
	var bristle: Color = body.darkened(0.42)
	var snout := Color(0.74, 0.52, 0.46)
	var ivory := Color(0.96, 0.92, 0.8)
	var hoof := Color(0.12, 0.09, 0.07)
	_pose["amp"] = 22.0
	_pose["lift"] = 40.0
	_pose["tuck"] = true
	match _act():
		"walk":
			# A quick heavy stomp.
			_pose["bob"] = -absf(sin(_pf("t") * TAU * 2.0)) * 2.5 + 1.0
		"eat":
			_pose["head"] = 30.0 - _pose["k"] * 8.0
		"strike":
			_pose["head"] = -16.0   # tusks hooked up through whatever is in the way
		"windup":
			_pose["head"] = 18.0
	var spiky: float = 1.45 if _act() == "alarm" or _act() == "windup" else 1.0
	_body_begin(Vector2(64, 121), 14.0)
	_push(Vector2(22, 80), _pf("tail") * 1.4)
	_line(Vector2(22, 80), Vector2(15, 88), 2.0, bristle, 0.0)
	_arc(14, 90, 2.5, -90.0, 180.0, 1.6, bristle)
	_pop()
	_quad_leg(Vector2(44, 98), Vector2(42, 121), 0.5, false, 6.0, bristle, hoof, Vector2(4.0, 2.2))
	_quad_leg(Vector2(80, 98), Vector2(82, 121), 0.0, true, 6.0, bristle, hoof, Vector2(4.0, 2.2))
	_ell(58, 84, 38, 25 if not f else 22, body)
	var mane: float = (1.0 if not f else 0.5) * spiky
	for i: int in 9:
		var x: float = 30.0 + i * 7.0
		var top: float = 60.0 - sin(float(i) / 8.0 * PI) * 6.0 + (4.0 if f else 0.0)
		_poly([Vector2(x - 5, top + 9), Vector2(x + 1, top + 9 - 14 * mane), Vector2(x + 5, top + 9)], bristle, 0.4)
	_ell(56, 98, 26, 8, body.lightened(0.12))
	_quad_leg(Vector2(52, 100), Vector2(52, 122), 0.0, false, 7.0, body.darkened(0.1), hoof, Vector2(5.0, 2.5))
	_quad_leg(Vector2(86, 98), Vector2(88, 122), 0.5, true, 7.0, body.darkened(0.1), hoof, Vector2(5.0, 2.5))
	if _gold:
		# A slab of shoulder.
		_ell(76, 76, 16, 14, Color(0.3, 0.24, 0.2), -20.0)
		_ell(40, 82, 14, 13, Color(0.3, 0.24, 0.2), 15.0)
	if r == 1:
		_line(Vector2(40, 76), Vector2(54, 84), 1.4, Color(0.55, 0.5, 0.48), 0.0)
		_line(Vector2(62, 72), Vector2(70, 82), 1.4, Color(0.55, 0.5, 0.48), 0.0)
	elif r == 2:
		_line(Vector2(54, 58), Vector2(54, 64), 3.0, Color(0.95, 0.92, 0.84), 0.0)
		_ell(54, 56, 8, 4.5, Color(0.86, 0.24, 0.16))
		_dot(51, 55, 1.2, Color(1, 1, 1))
		_dot(57, 54, 1.0, Color(1, 1, 1))
	_head_begin(Vector2(84, 80))
	_poly([Vector2(82, 66), Vector2(110, 72), Vector2(122, 86), Vector2(118, 98), Vector2(92, 100), Vector2(80, 88)], body.lightened(0.05))
	_push(Vector2(96, 68), _pf("ears"))
	_poly([Vector2(90, 68), Vector2(95, 52), Vector2(103, 70)], bristle)
	_pop()
	_ell(121, 91, 4.5, 6.5, snout)
	_dot(122, 89, 1.2, Color(0.2, 0.1, 0.08))
	_dot(122, 94, 1.2, Color(0.2, 0.1, 0.08))
	if _pf("mouth") > 0.3:
		_poly([Vector2(104, 98), Vector2(118, 97), Vector2(112, 102)], Color(0.35, 0.12, 0.1), 0.0)
	if not f or r == 1:
		var t: float = 1.0
		if r == 1:
			t = 0.7 if f else 1.6
		_poly([Vector2(110, 96), Vector2(110 + 9 * t, 96 - 16 * t), Vector2(115, 97)], ivory, 0.3)
	if _gold:
		# Great tusks.
		_poly([Vector2(108, 96), Vector2(127, 66), Vector2(115, 97)], Color(0.98, 0.94, 0.8), 0.3)
	_peye(103, 79, 2.4, Color(0.3, 0.18, 0.1))
	if r == 2:
		_arc(121, 91, 5.5, -80.0, 80.0, 1.8, Color(0.98, 0.8, 0.3))
		if f:
			_circ(96, 56, 3.0, Color(0.98, 0.7, 0.8), 0.0)
	_alarm_at(Vector2(100, 74), 18.0)
	_pop()
	_pop()

# ------------------------------------------------------------------
# 3.0 creatures. Same conventions: side profile facing right, legs where
# the matching rig (SpeciesDB "style") expects them.
# ------------------------------------------------------------------
static func _deer(r: int, f: bool) -> void:
	# normal: fawn brown; Twelve-point: dark with a great rack; White Hart: pale, gold-tipped antlers.
	var coat: Color = _pick(r, f, [Color(0.68, 0.46, 0.28), Color(0.74, 0.54, 0.34), Color(0.44, 0.3, 0.2), Color(0.52, 0.38, 0.26), Color(0.94, 0.92, 0.86), Color(0.97, 0.95, 0.9)])
	var belly := Color(0.95, 0.9, 0.8)
	var hoof := Color(0.14, 0.1, 0.08)
	var antler: Color = [Color(0.82, 0.72, 0.55), Color(0.7, 0.6, 0.45), Color(0.98, 0.84, 0.4)][r]
	_pose["amp"] = 28.0
	_pose["lift"] = 60.0
	_pose["tuck"] = true
	match _act():
		"eat":
			# The long neck reaches down to the grass.
			_pose["head"] = 62.0 - _pose["k"] * 6.0
			_pose["shift"] = -14.0
		"strike":
			_pose["head"] = 30.0   # antlers first
			_pose["shift"] = -10.0
		"windup":
			_pose["head"] = 14.0
			_pose["pitch"] = 0.0
			_pose["shift"] = -4.0
		"work":
			# Prancing: head high, then a stotting bound.
			_pose["head"] = -16.0 if _pose["k"] == 0 else -4.0
			_pose["bob"] = 0.0 if _pose["k"] == 0 else -12.0
			_pose["legs"] = "stand" if _pose["k"] == 0 else "splay"
	_body_begin(Vector2(64, 121), 22.0)
	_quad_leg(Vector2(42, 88), Vector2(39, 121), 0.5, false, 4.0, coat.darkened(0.3), hoof, Vector2(2.6, 1.8))
	_quad_leg(Vector2(78, 88), Vector2(81, 121), 0.0, true, 4.0, coat.darkened(0.3), hoof, Vector2(2.6, 1.8))
	_push(Vector2(31, 72), _pf("tail") * 1.2)
	_ell(28, 72, 6, 4, belly, -30.0)
	_pop()
	_ell(60, 78, 32, 16, coat)
	_ell(60, 88, 24, 6, belly)
	_quad_leg(Vector2(50, 90), Vector2(50, 122), 0.0, false, 4.5, coat, hoof, Vector2(3.0, 2.0))
	_quad_leg(Vector2(84, 88), Vector2(86, 122), 0.5, true, 4.5, coat, hoof, Vector2(3.0, 2.0))
	if r == 0 and f:
		# Does keep a few fawn spots.
		for p: Vector2 in [Vector2(48, 72), Vector2(58, 68), Vector2(68, 72), Vector2(56, 78)]:
			_dot(p.x, p.y, 1.8, belly)
	elif r == 2:
		_star(60, 70, 3.4, Color(1.0, 0.92, 0.6))
	_head_begin(Vector2(86, 74))
	_poly([Vector2(82, 70), Vector2(94, 44), Vector2(102, 48), Vector2(92, 80)], coat)
	_ell(102, 46, 9, 7, coat, 20.0)
	_poly([Vector2(104, 42), Vector2(120, 50), Vector2(118, 56), Vector2(104, 54)], coat.lightened(0.05))
	_dot(119, 51, 2.0, Color(0.08, 0.07, 0.07))
	if _pf("mouth") > 0.3:
		_line(Vector2(108, 55), Vector2(116, 56), 1.4, Color(0.3, 0.12, 0.1), 0.0)
	_push(Vector2(98, 40), _pf("ears"))
	_ell(96, 36, 3, 7, coat.darkened(0.1), -30.0)
	_pop()
	_peye(104, 44, 2.4, Color(0.25, 0.15, 0.08))
	if not f or _gold:
		var big: float = 1.4 if r == 1 else 1.0
		_line(Vector2(100, 38), Vector2(96, 38 - 22 * big), 2.4, antler, 0.3)
		_line(Vector2(97, 38 - 10 * big), Vector2(88, 38 - 18 * big), 2.0, antler, 0.3)
		_line(Vector2(96, 38 - 18 * big), Vector2(104, 38 - 28 * big), 2.0, antler, 0.3)
		_line(Vector2(96, 38 - 20 * big), Vector2(86, 38 - 30 * big), 1.8, antler, 0.3)
	if _gold:
		# A regal stag: a towering rack of antlers.
		var a := Color(0.98, 0.85, 0.4)
		_line(Vector2(98, 38), Vector2(84, 2), 3.0, a, 0.3)
		_line(Vector2(100, 38), Vector2(118, 4), 3.0, a, 0.3)
		for k: int in 4:
			var y: float = 30.0 - k * 7.0
			_line(Vector2(96 - k * 3.0, y), Vector2(80 - k * 2.0, y - 6.0), 2.0, a, 0.3)
			_line(Vector2(103 + k * 3.0, y), Vector2(120, y - 5.0), 2.0, a, 0.3)
	_alarm_at(Vector2(104, 46), 14.0)
	_pop()
	_pop()

static func _goat(r: int, f: bool) -> void:
	# normal: white; Old Billy: grey and bearded; Crag Climber: tan with gold horns.
	var coat: Color = _pick(r, f, [Color(0.93, 0.91, 0.86), Color(0.96, 0.94, 0.9), Color(0.6, 0.58, 0.56), Color(0.68, 0.66, 0.63), Color(0.82, 0.68, 0.48), Color(0.86, 0.74, 0.54)])
	var horn: Color = [Color(0.4, 0.36, 0.32), Color(0.3, 0.27, 0.24), Color(0.95, 0.78, 0.32)][r]
	var hoof := Color(0.14, 0.12, 0.1)
	_pose["amp"] = 24.0
	_pose["lift"] = 50.0
	_pose["tuck"] = true
	match _act():
		"eat": _pose["head"] = 52.0 - _pose["k"] * 8.0
		"strike": _pose["head"] = 34.0   # a headbutt
		"windup":
			_pose["head"] = -18.0
			_pose["pitch"] = -16.0
		"work":
			# Up on the hind legs, then a springing leap.
			_pose["pitch"] = -24.0 if _pose["k"] == 0 else -6.0
			_pose["legs"] = "rear" if _pose["k"] == 0 else "splay"
			_pose["bob"] = -2.0 if _pose["k"] == 0 else -12.0
			_pose["head"] = 10.0 if _pose["k"] == 0 else -10.0
	_body_begin(Vector2(64, 121), 20.0)
	_quad_leg(Vector2(42, 90), Vector2(40, 121), 0.5, false, 5.0, coat.darkened(0.25), hoof, Vector2(3.0, 2.0))
	_quad_leg(Vector2(78, 90), Vector2(80, 121), 0.0, true, 5.0, coat.darkened(0.25), hoof, Vector2(3.0, 2.0))
	_push(Vector2(32, 70), _pf("tail") * 1.4)
	_poly([Vector2(32, 68), Vector2(24, 60), Vector2(30, 74)], coat.darkened(0.08), 0.4)
	_pop()
	_ell(60, 80, 30, 18, coat)
	# Shaggy coat hangs low along the flank.
	for i: int in 6:
		var x: float = 36.0 + i * 9.0
		_poly([Vector2(x - 5, 92), Vector2(x, 102), Vector2(x + 5, 92)], coat.darkened(0.06), 0.4)
	_quad_leg(Vector2(50, 94), Vector2(50, 122), 0.0, false, 5.5, coat, hoof, Vector2(3.5, 2.2))
	_quad_leg(Vector2(84, 92), Vector2(86, 122), 0.5, true, 5.5, coat, hoof, Vector2(3.5, 2.2))
	if r == 2:
		_star(60, 72, 3.4, Color(1.0, 0.92, 0.6))
	_head_begin(Vector2(86, 78))
	_poly([Vector2(82, 72), Vector2(94, 52), Vector2(102, 56), Vector2(92, 84)], coat)
	_ell(102, 58, 10, 9, coat)
	_poly([Vector2(104, 56), Vector2(118, 64), Vector2(115, 72), Vector2(104, 68)], coat.lightened(0.04))
	_dot(116, 65, 1.6, Color(0.08, 0.07, 0.07))
	if _pf("mouth") > 0.3:
		_line(Vector2(108, 69), Vector2(115, 70), 1.4, Color(0.3, 0.12, 0.1), 0.0)
	_peye(104, 55, 2.4, Color(0.85, 0.7, 0.2))
	var hb: float = 1.3 if (not f or r == 1) else 0.8
	_arc(96, 52, 9.0 * hb, -170.0, -60.0, 3.6 * hb, horn)
	if not f or r == 1:
		# Beard.
		_poly([Vector2(108, 70), Vector2(111, 84), Vector2(114, 70)], coat.darkened(0.15), 0.4)
	_alarm_at(Vector2(102, 56), 15.0)
	_pop()
	_pop()

static func _bear(r: int, f: bool) -> void:
	# A big round ball of fur on thick legs. normal: brown; Grizzled: silver-tipped
	# coat; Moon Bear: black with a pale crescent.
	var fur: Color = _pick(r, f, [Color(0.42, 0.28, 0.17), Color(0.48, 0.33, 0.21), Color(0.5, 0.42, 0.34), Color(0.56, 0.47, 0.38), Color(0.14, 0.12, 0.12), Color(0.18, 0.16, 0.16)])
	var dark: Color = fur.darkened(0.3)
	var claw := Color(0.9, 0.86, 0.76)
	var bulk: float = 0.0 if f else 3.0
	_pose["amp"] = 18.0
	_pose["lift"] = 0.0
	match _act():
		"walk":
			# A rolling shamble: the whole bulk sways side to side.
			_pose["pitch"] = sin(_pf("t") * TAU) * 2.0
		"eat": _pose["head"] = 30.0 - _pose["k"] * 8.0
		"windup", "work":
			# Up on the hind legs, forepaws raised.
			_pose["pitch"] = -26.0
			_pose["legs"] = "rear"
			_pose["head"] = 10.0
			_pose["mouth"] = 0.8 if _act() == "windup" or _pose["k"] == 1 else 0.0
			_pose["shift"] = 10.0
		"strike":
			# A great swipe.
			_pose["pitch"] = -10.0
			_pose["legs"] = "lunge"
			_pose["head"] = 6.0
			_pose["shift"] = 6.0
	_body_begin(Vector2(64, 121), 14.0)
	# Far legs, then the great body with a shaggy fringe all round it.
	_bear_leg(Vector2(36, 90), 0.5, false, dark, dark, claw)
	_bear_leg(Vector2(80, 90), 0.0, true, dark, dark, claw)
	# One heavy body: rump low at the back, the grizzly's shoulder hump up
	# front, belly fur hanging below. Smooth outline, fur drawn as strokes.
	_ell(54, 80, 42 + bulk, 29 + bulk, fur)
	_ell(80, 68, 24 + bulk * 0.5, 22 + bulk * 0.5, fur, -15.0)
	_ell(34, 76, 22, 22 + bulk * 0.5, fur)
	_ell(60, 70, 30, 14, fur.lightened(0.07), 0.0, 0.6)
	for i: int in 11:
		var x: float = 22.0 + i * 6.5
		var y: float = 74.0 + sin(float(i) * 1.7) * 6.0
		_line(Vector2(x, y), Vector2(x - 3.0, y + 5.0), 1.3, dark, 0.0)
	for i: int in 6:
		var x2: float = 34.0 + i * 8.0
		_poly([Vector2(x2 - 4, 102), Vector2(x2, 109), Vector2(x2 + 4, 102)], fur.darkened(0.08), 0.0)
	_ell(58, 99, 30, 8, fur.darkened(0.08))
	if r == 1:
		for i: int in 9:
			_line(Vector2(30 + i * 6, 50), Vector2(32 + i * 6, 44), 1.6, Color(0.88, 0.85, 0.78), 0.0)
	# Near legs: thick pillars with big paws.
	_bear_leg(Vector2(48, 92), 0.0, false, fur, dark, claw)
	_bear_leg(Vector2(88, 92), 0.5, true, fur, dark, claw)
	if r == 2:
		_arc(86, 88, 11.0, 200.0, 340.0, 3.5, Color(0.95, 0.92, 0.82))
	if r != 0 and f:
		_circ(66, 72, 2.5, Color(0.98, 0.7, 0.8), 0.0)
	# Head: broad and round, small ears, a long snout.
	_head_begin(Vector2(90, 72))
	_circ(100, 66, 17, fur)
	_push(Vector2(92, 54), _pf("ears") * 0.5)
	_circ(91, 49, 6, fur)
	_circ(91, 49, 3, dark)
	_pop()
	var m: float = _pf("mouth")
	if m > 0.05:
		_poly([Vector2(108, 77), Vector2(124, 76), Vector2(120, 86), Vector2(108, 82)], Color(0.4, 0.1, 0.1), 0.0)
	_ell(116, 74, 11, 8, fur.lightened(0.15))
	if m > 0.05:
		_push(Vector2(108, 79), m * 24.0)
		_ell(115, 81, 9, 3.5, fur.lightened(0.1))
		_poly([Vector2(116, 79), Vector2(118, 75.5), Vector2(120, 79)], Color(0.98, 0.97, 0.92), 0.0)
		_pop()
	else:
		_line(Vector2(113, 80), Vector2(122, 79), 1.2, Color(0.15, 0.1, 0.08), 0.0)
	_dot(125, 72, 3.0, Color(0.06, 0.05, 0.05))
	if _gold:
		# A long golden snout.
		_ell(118, 75, 10, 7, Color(0.45, 0.3, 0.2))
		_dot(126, 74, 3.2, Color(0.06, 0.05, 0.05))
	_peye(104, 61, 2.4, Color(0.2, 0.12, 0.08))
	_alarm_at(Vector2(100, 62), 20.0)
	_pop()
	_pop()

# A bear's leg: a thick pillar swinging from the hip, with a big clawed paw.
static func _bear_leg(hip: Vector2, off: float, front: bool, col: Color, paw: Color, claw: Color) -> void:
	var a := _leg_angles(off, front)
	_push(hip, a.x)
	_ell(hip.x, hip.y + 14.0, 10.5, 17.0, col)
	_ell(hip.x + 2.0, hip.y + 28.0, 12.0, 5.0, paw)
	var long: float = 8.0 if _gold else 4.0
	for k: int in 3:
		_line(Vector2(hip.x - 3 + k * 4, hip.y + 29.0), Vector2(hip.x - 1 + k * 4, hip.y + 29.0 + long), 1.4 if not _gold else 2.2, claw, 0.0)
	_pop()

static func _lion(r: int, f: bool) -> void:
	# normal: tawny; Ghost Cat: pale grey; Sun Cat: golden with dark tail tip.
	var fur: Color = _pick(r, f, [Color(0.78, 0.58, 0.36), Color(0.84, 0.64, 0.42), Color(0.7, 0.68, 0.64), Color(0.76, 0.74, 0.7), Color(0.95, 0.72, 0.3), Color(0.98, 0.78, 0.38)])
	var dark: Color = fur.darkened(0.4)
	var cream := Color(0.95, 0.9, 0.8)
	_pose["amp"] = 30.0
	_pose["lift"] = 58.0
	match _act():
		"walk":
			# A low, stalking prowl.
			_pose["head"] = 8.0 + _pf("head")
		"eat":
			_pose["head"] = 40.0 - _pose["k"] * 10.0
			_pose["mouth"] = 0.8 - _pose["k"] * 0.5
		"windup":
			# Crouched to spring, tail tip twitching.
			_pose["lie"] = 0.45
			_pose["legs"] = "fold"
			_pose["head"] = 6.0
			_pose["pitch"] = 4.0
			_pose["tail"] = 20.0
		"strike":
			# The pounce: stretched out, forepaws reaching.
			_pose["pitch"] = -12.0
			_pose["bob"] = -12.0
			_pose["legs"] = "lunge"
			_pose["head"] = -6.0
		"work":
			# A great yawning roar, then a lick of the chops.
			_pose["head"] = -24.0 if _pose["k"] == 0 else -6.0
			_pose["mouth"] = 1.0 if _pose["k"] == 0 else 0.3
			_pose["eyes"] = "shut" if _pose["k"] == 0 else "open"
			_pose["bob"] = 0.0
	_body_begin(Vector2(64, 121), 18.0)
	# Long low tail curling up at the tip.
	_push(Vector2(28, 80), _pf("tail") * 0.8)
	_line(Vector2(26, 82), Vector2(10, 98), 4.0, fur)
	_line(Vector2(10, 98), Vector2(8, 86), 4.0, fur)
	_circ(8, 85, 3.5, dark if r != 1 else fur.darkened(0.2))
	_pop()
	_quad_leg(Vector2(40, 88), Vector2(37, 121), 0.5, false, 6.0, dark, dark, Vector2(4.0, 2.2))
	_quad_leg(Vector2(78, 88), Vector2(81, 121), 0.0, true, 6.0, dark, dark, Vector2(4.0, 2.2))
	_ell(58, 80, 34, 14 + (0.0 if f else 1.5), fur)
	_ell(60, 90, 24, 5, cream)
	_quad_leg(Vector2(48, 90), Vector2(48, 122), 0.0, false, 7.0, fur, dark, Vector2(5.0, 2.5))
	_quad_leg(Vector2(86, 90), Vector2(90, 122), 0.5, true, 7.0, fur, dark, Vector2(5.0, 2.5))
	if r == 1:
		for p: Vector2 in [Vector2(46, 74), Vector2(56, 70), Vector2(66, 74), Vector2(52, 82)]:
			_dot(p.x, p.y, 2.0, fur.darkened(0.15))
	elif r == 2:
		_star(60, 72, 3.4, Color(1.0, 0.95, 0.65))
	_head_begin(Vector2(88, 72))
	_ell(98, 64, 13, 12, fur)
	_push(Vector2(96, 54), _pf("ears") * 0.7)
	_poly([Vector2(92, 52), Vector2(94, 44), Vector2(100, 52)], dark)
	_pop()
	var m: float = _pf("mouth")
	_poly([Vector2(104, 62), Vector2(118, 66), Vector2(117, 69), Vector2(104, 68)], cream)
	if m > 0.05:
		_poly([Vector2(104, 68), Vector2(118, 68), Vector2(114, 78), Vector2(104, 74)], Color(0.42, 0.1, 0.12), 0.0)
		_poly([Vector2(113, 68.5), Vector2(115.5, 68.5), Vector2(114.5, 72.5)], Color(0.98, 0.97, 0.92), 0.0)
	_push(Vector2(105, 68), m * 28.0)
	_poly([Vector2(104, 68), Vector2(117, 69), Vector2(116, 74), Vector2(104, 72)], cream)
	_pop()
	_dot(117, 67, 2.0, Color(0.25, 0.12, 0.1))
	if m <= 0.05:
		_line(Vector2(108, 72), Vector2(116, 73), 1.0, Color(0.2, 0.12, 0.1), 0.0)
	_peye(104, 60, 2.6, Color(0.7, 0.85, 0.35) if r != 2 else Color(0.98, 0.7, 0.2))
	_alarm_at(Vector2(100, 60), 15.0)
	_pop()
	_pop()

static func _beetle(r: int, f: bool) -> void:
	# normal: green-black carrion beetle; Stag: big jaws; Scarab: gold shell.
	var shell: Color = _pick(r, f, [Color(0.18, 0.3, 0.24), Color(0.22, 0.34, 0.27), Color(0.32, 0.2, 0.16), Color(0.36, 0.24, 0.18), Color(0.92, 0.72, 0.22), Color(0.96, 0.78, 0.3)])
	var leg := Color(0.1, 0.09, 0.08)
	var feelers: float = _pf("ears")
	var tuck: float = 0.0
	match _act():
		"walk":
			# Six legs in two tripods; a little bob as each one plants.
			_pose["bob"] = -absf(sin(_pf("t") * TAU * 2.0)) * 1.5
			feelers = sin(_pf("t") * TAU * 2.0) * 10.0
		"eat": _pose["head"] = 18.0 - _pose["k"] * 6.0
		"alarm": feelers = -30.0
		"sleep":
			tuck = 1.0
			_pose["head"] = 6.0
		"windup": _pose["pitch"] = -10.0
		"strike":
			_pose["pitch"] = 6.0
			_pose["head"] = 10.0
		"work":
			# Rolling a ball of dung, as beetles will.
			_pose["pitch"] = 8.0 if _pose["k"] == 0 else 2.0
	_body_begin(Vector2(64, 121), 0.0)
	_push(Vector2(64, 104), 0.0, Vector2(0, tuck * 8.0))
	for i: int in 3:
		var x: float = 44.0 + i * 16.0
		var a: float = 0.0
		if _pf("t") > 0.0 or _act() == "walk":
			a = sin(_pf("t") * TAU + (PI if i % 2 == 0 else 0.0)) * 20.0
		var fold: float = tuck * 50.0
		_push(Vector2(x, 104), a + fold)
		_line(Vector2(x, 104), Vector2(x - 8, 121), 3.0, leg, 0.0)
		_pop()
		_push(Vector2(x + 4, 104), -a - fold)
		_line(Vector2(x + 4, 104), Vector2(x + 10, 121), 3.0, leg, 0.0)
		_pop()
	_ell(62, 96, 30, 18, shell)
	_line(Vector2(62, 80), Vector2(62, 112), 1.4, shell.darkened(0.4), 0.0)
	_ell(54, 90, 12, 5, shell.lightened(0.35), -10.0, 0.0)
	if r == 2:
		_star(62, 96, 4.0, Color(1.0, 0.98, 0.8))
	_head_begin(Vector2(90, 100))
	_ell(94, 100, 10, 9, shell.darkened(0.25))
	_peye(98, 96, 1.8, Color(0.85, 0.3, 0.2))
	_push(Vector2(100, 93), feelers)
	_line(Vector2(100, 92), Vector2(114, 82), 1.6, leg, 0.0)
	_line(Vector2(100, 94), Vector2(116, 90), 1.6, leg, 0.0)
	_pop()
	if r == 1 and not f:
		_push(Vector2(102, 104), -_pf("mouth") * 20.0)
		_arc(108, 104, 9.0, -60.0, 60.0, 3.0, shell.darkened(0.3))
		_pop()
	_alarm_at(Vector2(96, 98), 12.0)
	_pop()
	_pop()
	_pop()

static func _falcon(r: int, f: bool) -> void:
	# normal: slate tiercel / brown female; Gyrfalcon: white, speckled; Sky Seer: gold with a crest.
	var slate: Color = _pick(r, f, [Color(0.42, 0.47, 0.56), Color(0.54, 0.43, 0.32), Color(0.92, 0.93, 0.95), Color(0.74, 0.76, 0.8), Color(0.88, 0.66, 0.3), Color(0.86, 0.62, 0.36)])
	var dark: Color = _pick(r, f, [Color(0.24, 0.27, 0.33), Color(0.32, 0.25, 0.18), Color(0.45, 0.47, 0.52), Color(0.36, 0.38, 0.42), Color(0.5, 0.32, 0.15), Color(0.48, 0.36, 0.62)])
	var cream := Color(0.93, 0.88, 0.76)
	var gold := Color(0.98, 0.8, 0.25)
	var span: float = 1.0 if f else 0.92
	# Wings: angle about the shoulder and how far they are spread.
	var wing: float = 0.0
	var spread: float = 1.0
	var perched: bool = false
	var flap: float = 1.0
	var talons: float = 0.0
	var head: float = _pf("head")
	match _act():
		"walk":
			# A deep wingbeat: a strong downstroke, the wing half-folded coming up.
			var a: float = _pf("t") * TAU
			# Seen side-on the wing sweeps from high above the back to
			# down below the belly: it flips through the shoulder.
			wing = -6.0 * cos(a)
			flap = 0.12 + 0.88 * cos(a)
			spread = 0.92 + 0.08 * cos(a)
			_pose["bob"] = -sin(a) * 4.0
			head = -sin(a) * 4.0
		"stand", "blink", "camera":
			head = _pf("head") + 4.0
		"glance":
			head = 24.0   # scanning the ground below
			_pose["eyes"] = "open"
		"eat":
			# Mantling over a kill, tearing at it.
			wing = 62.0
			spread = 0.82
			talons = -10.0
			perched = true
			head = 42.0 - _pose["k"] * 14.0
			_pose["pitch"] = 8.0
		"alarm":
			wing = -36.0
			spread = 1.0
			head = -12.0
		"windup":
			# Wings swept back for the stoop, talons coming forward.
			wing = -58.0
			spread = 0.78
			talons = -20.0
			perched = true
			head = 8.0
			_pose["pitch"] = 18.0
		"strike":
			wing = -40.0
			spread = 0.95
			talons = -62.0
			perched = true
			head = 4.0
			_pose["pitch"] = -6.0
		"sleep":
			# Perched, wings folded along the back, head sunk into the shoulders.
			wing = -148.0
			spread = 0.62
			talons = 0.0
			perched = true
			head = 22.0
			_pose["lie"] = 0.0
		"work":
			# Display: wings raised high, then thrown wide.
			wing = -44.0 if _pose["k"] == 0 else 54.0
			spread = 1.0
			head = -16.0
	_pose["head"] = head
	_body_begin(Vector2(64, 80))
	var far_wing: float = -wing * 0.85 if wing > -120.0 else -40.0
	_push(Vector2(56, 62), far_wing, Vector2.ZERO, Vector2(spread, spread * flap))
	_poly([Vector2(58, 60), Vector2(58 - 32 * span, 14), Vector2(14, 20), Vector2(18, 36), Vector2(34, 56), Vector2(46, 66)], dark)
	if r == 1:
		for p: Vector2 in [Vector2(30, 40), Vector2(40, 52)]:
			_dot(p.x, p.y, 1.5, Color(0.2, 0.22, 0.26))
	_pop()
	_push(Vector2(40, 72), _pf("tail") * 0.5)
	_poly([Vector2(38, 66), Vector2(12, 72), Vector2(12, 84), Vector2(40, 76)], slate)
	for i: int in 3:
		_line(Vector2(18, 74 + i * 4), Vector2(34, 72 + i * 2), 1.2, dark, 0.0)
	_pop()
	if perched:
		for k: int in 2:
			var hip := Vector2(68 + k * 6, 74)
			_push(hip, talons + k * 6.0)
			_line(hip, hip + Vector2(1, 16), 2.6, gold.darkened(0.15), 0.0)
			for c: int in 3:
				_line(hip + Vector2(1, 16), hip + Vector2(-3 + c * 4, 21), 1.4, Color(0.15, 0.12, 0.1), 0.0)
			_pop()
	_ell(64, 68, 28, 11 if not f else 12.5, slate, -8.0)
	_ell(74, 74, 15, 7, cream, -8.0)
	for i: int in (4 if not f else 7):
		_dot(66 + i * 3.5, 74 + (i % 2) * 2, 1.2, dark)
	_push(Vector2(66, 64), wing, Vector2.ZERO, Vector2(spread, spread * flap))
	_poly([Vector2(62, 64), Vector2(62 + 42 * span, 18), Vector2(120, 24), Vector2(114, 40), Vector2(94, 58), Vector2(78, 70)], slate.lightened(0.08))
	_poly([Vector2(108, 20), Vector2(120, 26), Vector2(112, 36), Vector2(102, 30)], dark)
	for i: int in 3:
		_line(Vector2(78 + i * 6, 60 - i * 6), Vector2(90 + i * 6, 52 - i * 6), 1.2, dark, 0.0)
	if r == 1:
		for p: Vector2 in [Vector2(84, 50), Vector2(96, 40), Vector2(90, 56), Vector2(104, 34), Vector2(76, 62)]:
			_dot(p.x, p.y, 1.5, Color(0.2, 0.22, 0.26))
	_pop()
	_head_begin(Vector2(84, 64))
	_circ(92, 59, 10, dark if r != 1 else slate.darkened(0.1))
	_ell(95, 64, 5, 4, cream, 0.0, 0.4)
	if r == 2:
		for i: int in 3:
			_poly([Vector2(84 + i * 3, 52), Vector2(80 + i * 4, 40 - i * 2), Vector2(88 + i * 3, 50)], gold.darkened(0.1), 0.3)
		_ell(97, 56, 5, 2.5, Color(0.3, 0.55, 0.95), 0.0, 0.2)
	var m: float = _pf("mouth")
	if m > 0.05:
		_poly([Vector2(100, 60), Vector2(109, 61), Vector2(101, 66)], Color(0.4, 0.1, 0.1), 0.0)
	_poly([Vector2(100, 56), Vector2(111, 60), Vector2(101, 61.5)], gold)
	_push(Vector2(100, 61), m * 28.0)
	_poly([Vector2(100, 60.5), Vector2(108, 61.5), Vector2(101, 65)], gold.darkened(0.08))
	_pop()
	_dot(109, 60, 1.4, Color(0.1, 0.1, 0.1))
	_peye(95, 56, 2.8, gold)
	if _act() == "windup" or _act() == "strike":
		_line(Vector2(90, 51), Vector2(99, 53), 1.5, Color(0.08, 0.07, 0.07), 0.0)
	_alarm_at(Vector2(93, 58), 14.0)
	_pop()
	_pop()

static func _robin(r: int, f: bool) -> void:
	# normal: red breast (paler hen); Mistle Thrush: spotted breast; Bluebird: blue back.
	var back: Color = _pick(r, f, [Color(0.46, 0.39, 0.31), Color(0.54, 0.47, 0.39), Color(0.55, 0.45, 0.32), Color(0.63, 0.55, 0.43), Color(0.26, 0.46, 0.86), Color(0.55, 0.6, 0.72)])
	var head_col: Color = back.darkened(0.25) if r != 2 else back.darkened(0.08)
	var breast: Color = _pick(r, f, [Color(0.93, 0.45, 0.18), Color(0.92, 0.62, 0.42), Color(0.94, 0.88, 0.72), Color(0.95, 0.9, 0.78), Color(0.9, 0.5, 0.25), Color(0.92, 0.7, 0.52)])
	var leg := Color(0.62, 0.42, 0.26)
	var big: float = 1.15 if r == 1 else 1.0
	var wing: float = 0.0
	var legs: float = 0.0
	var puff: float = 1.0
	match _act():
		"walk":
			# One hop per cycle with a flutter of the wings at the top.
			var t: float = _pf("t")
			var air: float = sin(clampf((t - 0.1) / 0.75, 0.0, 1.0) * PI)
			_pose["bob"] = -air * 13.0
			_pose["pitch"] = -6.0 * air + 5.0 * (1.0 - air) * sin(t * TAU)
			legs = 40.0 * air
			wing = air * (24.0 + sin(t * TAU * 3.0) * 26.0)
			_pose["tail"] = 18.0 * (1.0 - air) - 6.0
			_pose["head"] = -4.0 * air
		"eat":
			# Peck, then up with a worm.
			_pose["head"] = 58.0 if _pose["k"] == 0 else -4.0
			_pose["mouth"] = 0.0 if _pose["k"] == 0 else 0.35
			_pose["tail"] = 16.0
		"alarm":
			wing = 46.0
			_pose["bob"] = -9.0
			legs = 20.0
		"windup":
			wing = 40.0
			_pose["head"] = -12.0
			_pose["pitch"] = -8.0
		"strike":
			wing = 30.0
			_pose["head"] = 16.0
			_pose["pitch"] = 12.0
			_pose["mouth"] = 0.6
		"sleep":
			puff = 1.1
			_pose["head"] = 24.0
			_pose["lie"] = 0.0
			legs = 0.0
			_pose["breath"] = _pose["k"] * 1.4
		"work":
			# Singing: breast puffed, bill to the sky; then a tail-up flourish.
			puff = 1.08
			_pose["head"] = -26.0 if _pose["k"] == 0 else -10.0
			_pose["mouth"] = 0.8 if _pose["k"] == 0 else 0.3
			_pose["tail"] = 6.0 if _pose["k"] == 0 else 34.0
			wing = 0.0 if _pose["k"] == 0 else -14.0
			_pose["bob"] = 0.0
	_body_begin(Vector2(62, 118), 0.0)
	_push(Vector2(32, 78), _pf("tail"))
	_poly([Vector2(30, 74), Vector2(8, 62), Vector2(10, 72), Vector2(30, 84)], back.darkened(0.15))
	_pop()
	for k: int in 2:
		var hip := Vector2(58 + k * 10, 96)
		var foot := Vector2(55 + k * 15, 118)
		_push(hip, legs + k * 4.0)
		_line(hip, foot, 2.0, leg, 0.0)
		_line(foot + Vector2(-5, 0), foot + Vector2(5, 0), 1.6, leg, 0.0)
		_pop()
	_push(Vector2(62, 84), 0.0, Vector2.ZERO, Vector2(puff, puff))
	_ell(58, 80, 28 * big, 20 * big, back)
	_ell(72, 87, 19 * big, 15 * big, breast)
	if r == 1:
		for p: Vector2 in [Vector2(66, 82), Vector2(74, 86), Vector2(70, 92), Vector2(80, 90), Vector2(64, 92), Vector2(78, 80), Vector2(72, 98)]:
			_dot(p.x, p.y, 1.8, Color(0.3, 0.22, 0.14))
	_pop()
	_push(Vector2(60, 74), wing)
	_ell(48, 78, 19, 10, back.darkened(0.18), 12.0)
	for i: int in 3:
		_line(Vector2(36 + i * 6, 80), Vector2(48 + i * 6, 84), 1.0, back.darkened(0.35), 0.0)
	_pop()
	_head_begin(Vector2(76, 70))
	_circ(82, 60, 15, head_col)
	if r != 1:
		_ell(88, 71, 10, 8, breast)
	var m: float = _pf("mouth")
	_poly([Vector2(95, 57), Vector2(107, 60), Vector2(95, 61.5)], Color(0.86, 0.66, 0.3))
	_push(Vector2(95, 61), m * 30.0)
	_poly([Vector2(95, 60.5), Vector2(105, 61.5), Vector2(95, 65)], Color(0.8, 0.6, 0.28))
	_pop()
	if _act() == "eat" and _pose["k"] == 1:
		# The worm.
		_line(Vector2(104, 62), Vector2(108, 70), 2.4, Color(0.86, 0.5, 0.52), 0.0)
		_line(Vector2(108, 70), Vector2(104, 78), 2.4, Color(0.86, 0.5, 0.52), 0.0)
	_peye(88, 56, 3.2, Color(0.95, 0.92, 0.86))
	_alarm_at(Vector2(84, 58), 17.0)
	_pop()
	_pop()

static func _worm(r: int, f: bool) -> void:
	# Earthworms are both sexes at once; the two rows differ in their band.
	var skin: Color = _pick(r, f, [Color(0.86, 0.5, 0.52), Color(0.9, 0.62, 0.6), Color(0.52, 0.27, 0.25), Color(0.6, 0.33, 0.29), Color(0.74, 0.9, 0.42), Color(0.58, 0.88, 0.62)])
	var band: Color = _pick(r, f, [Color(0.95, 0.66, 0.6), Color(0.98, 0.78, 0.7), Color(0.72, 0.42, 0.36), Color(0.8, 0.5, 0.42), Color(0.95, 1.0, 0.7), Color(0.9, 1.0, 0.82)])
	var fat: float = 2.2 if r == 1 else 0.0
	var n: int = 22
	var band_lo: int = 15 if not f else 14
	var band_hi: int = 16 if not f else 17
	# The body as a curve: a crawling wave, a rearing head, a dig, or a coil.
	var phase: float = 0.0
	var rear: float = 0.0
	var dig: float = 0.0
	var curl: float = 0.0
	var stretch: float = 1.0
	var wave: float = 8.0
	match _act():
		"walk": phase = _pf("t")
		"glance": rear = 0.45
		"camera": rear = 0.7
		"eat":
			dig = 1.0 if _pose["k"] == 0 else 0.6
		"alarm":
			rear = 1.0
			wave = 4.0
		"windup":
			rear = 0.8
			stretch = 0.9
		"strike":
			rear = 0.15
			stretch = 1.08
			wave = 3.0
		"sleep": curl = 1.0
		"work":
			rear = 0.55 if _pose["k"] == 0 else 0.25
			phase = 0.25 * _pose["k"]
	var pts: Array[Vector2] = []
	var rads: Array[float] = []
	for i: int in n:
		var u: float = float(i) / float(n - 1)
		var x: float = 14.0 + u * 98.0 * stretch - (stretch - 1.0) * 30.0
		var y: float = 104.0 + sin(u * TAU * 1.1 - phase * TAU) * wave
		# Peristalsis: the segments bunch and stretch as the wave passes.
		x += sin(u * TAU * 2.0 - phase * TAU * 2.0) * 2.0
		var rad: float = lerpf(5.0, 8.0, sin(u * PI * 0.9 + 0.2)) + fat
		rad *= 1.0 + 0.08 * cos(u * TAU * 2.0 - phase * TAU * 2.0)
		var lift: float = pow(smoothstep(0.62, 1.0, u), 1.4)
		y -= rear * 30.0 * lift
		x -= rear * 10.0 * lift
		y += dig * 9.0 * smoothstep(0.78, 1.0, u)
		if curl > 0.0:
			var ang: float = PI * 0.15 + u * TAU * 1.05
			var rr: float = 30.0 - u * 15.0
			var cx := Vector2(64.0 + cos(ang) * rr, 96.0 + sin(ang) * rr * 0.62 * (1.0 + 0.04 * _pose["k"]))
			x = lerpf(x, cx.x, curl)
			y = lerpf(y, cx.y, curl)
		pts.append(Vector2(x, y))
		rads.append(rad)
	for i: int in n:
		_circ(pts[i].x, pts[i].y, rads[i], band if i >= band_lo and i <= band_hi else skin)
	for i: int in range(1, n - 1, 2):
		var d: Vector2 = (pts[mini(i + 1, n - 1)] - pts[i - 1]).normalized()
		var nrm := Vector2(-d.y, d.x) * (rads[i] - 1.0)
		_line(pts[i] - nrm, pts[i] + nrm, 0.9, skin.darkened(0.25), 0.0)
	if r == 2:
		_circ(pts[0].x + 2, pts[0].y, 6.0, Color(0.98, 1.0, 0.6), 0.0)
		_dot(pts[0].x + 2, pts[0].y, 3.0, Color(1.0, 1.0, 0.9))
	var head: Vector2 = pts[n - 1]
	var hd: Vector2 = (pts[n - 1] - pts[n - 3]).normalized()
	var top := Vector2(hd.y, -hd.x) if hd.x >= 0.0 else Vector2(-hd.y, hd.x)
	var e: Vector2 = head + top * (rads[n - 1] - 2.5) - hd * 1.0
	match String(_pose["eyes"]):
		"shut":
			_line(e - Vector2(1.6, 0), e + Vector2(1.6, 0), 1.0, Color(0.2, 0.1, 0.1), 0.0)
		"wide":
			_dot(e.x, e.y, 2.6, Color(1, 1, 1))
			_dot(e.x + 0.4, e.y, 1.1, Color(0.08, 0.06, 0.06))
		_:
			if _pf("turn") > 0.5:
				for s: float in [-2.6, 2.6]:
					_dot(e.x + s, e.y, 1.9, Color(1, 1, 1))
					_dot(e.x + s, e.y + 0.2, 0.9, Color(0.08, 0.06, 0.06))
			else:
				_dot(e.x, e.y, 1.6, Color(1, 1, 1, 0.9))
	if _pf("mouth") > 0.4:
		_dot(head.x + hd.x * (rads[n - 1] - 1.5), head.y + hd.y * (rads[n - 1] - 1.5) + 1.5, 1.6, Color(0.35, 0.12, 0.14))
	_xf = Transform2D.IDENTITY
	_alarm_at(head, rads[n - 1] + 5.0)

static func _human(r: int, f: bool) -> void:
	var skin := Color(0.9, 0.72, 0.56)
	var wood := Color(0.55, 0.38, 0.22)
	var top: Color
	var pants: Color
	var hair: Color
	var tool: String
	match r:
		0:
			top = Color(0.36, 0.52, 0.32) if not f else Color(0.62, 0.32, 0.3)
			pants = Color(0.4, 0.3, 0.22)
			hair = Color(0.36, 0.22, 0.13) if not f else Color(0.6, 0.36, 0.18)
			tool = "spear" if not f else "basket"
		1:
			top = Color(0.74, 0.66, 0.5) if not f else Color(0.5, 0.58, 0.68)
			pants = Color(0.34, 0.28, 0.2)
			hair = Color(0.42, 0.28, 0.16) if not f else Color(0.4, 0.24, 0.14)
			tool = "mallet"
		_:
			top = Color(0.44, 0.27, 0.66) if not f else Color(0.18, 0.5, 0.54)
			pants = top.darkened(0.3)
			hair = Color(0.94, 0.94, 0.92)
			tool = "staff"
	var hp := _human_pose(r, f, tool)
	if String(hp["tool"]) != "":
		tool = String(hp["tool"])
	var lying: bool = _act() == "sleep"
	# The whole figure: lie down for sleep, else bob and step.
	if lying:
		_push(Vector2(64, 90), 90.0, Vector2(-10, 13))
	else:
		_push(Vector2(64, 121), 0.0, Vector2(_pf("shift"), _pf("bob")))
	var hip_f := Vector2(62, 90)
	var hip_n := Vector2(66, 90)
	var shoulder := Vector2(66, 62)
	var la_f: Vector2 = hp["leg_f"]
	var la_n: Vector2 = hp["leg_n"]
	var foot_f := _fk2(hip_f, la_f.x, la_f.y)
	var foot_n := _fk2(hip_n, la_n.x, la_n.y)
	var sleeve: Color = top
	var tool_side: String = hp["tool_hand"]
	# Far arm and far leg, in shadow behind the body.
	_human_leg(hip_f, la_f, pants.darkened(0.18), r == 2)
	var hand_f := _human_arm(shoulder + Vector2(-3, 0), hp["arm_f"], sleeve.darkened(0.2), r == 2, hp["pitch"])
	if tool_side == "far":
		_held(tool, hand_f, hp["tool_deg"], wood, r, f)
	_abs_dot(hand_f, 3.8, skin.darkened(0.1))
	_human_leg(hip_n, la_n, pants, r == 2)
	# Torso leans from the hips.
	_push(Vector2(64, 90), hp["pitch"])
	_human_torso(r, f, top, foot_f, foot_n)
	_pop()
	_head_begin_human(r, f, skin, hair, hp)
	var hand_n := _human_arm(shoulder, hp["arm_n"], sleeve.lightened(0.04), r == 2, hp["pitch"])
	if tool_side == "near":
		_held(tool, hand_n, hp["tool_deg"], wood, r, f)
	_abs_dot(hand_n, 4.2, skin)
	if r == 2 and (_act() == "work" or _act() == "strike"):
		# Sparks off the orb.
		var orb: Vector2 = _orb
		for s: Vector2 in [Vector2(-9, -8), Vector2(10, -6), Vector2(-4, 11), Vector2(12, 8)]:
			_abs_star(orb + s * (1.0 + 0.3 * _pose["k"]), 2.6, Color(0.85, 1.0, 0.8))
	_pop()

# Hip/knee, shoulder/elbow angles and the held tool for this frame.
static func _human_pose(r: int, f: bool, tool: String) -> Dictionary:
	var hp: Dictionary = {"leg_f": Vector2(2, 4), "leg_n": Vector2(-2, 4), "arm_f": Vector2(6, -14), "arm_n": Vector2(-8, -16),
		"pitch": 0.0, "tool": "", "tool_hand": "near", "tool_deg": 4.0}
	# How each tool is carried when nothing much is happening.
	match tool:
		"spear":
			hp["arm_n"] = Vector2(-12, -52)
			hp["tool_deg"] = 4.0
		"basket":
			hp["arm_n"] = Vector2(-6, -76)
		"mallet":
			hp["arm_n"] = Vector2(-30, -128)
			hp["tool_deg"] = -84.0
		"staff":
			hp["arm_n"] = Vector2(-20, -40)
			hp["tool_deg"] = 3.0
	var rest_arm: Vector2 = hp["arm_n"]
	match _act():
		"walk":
			var a: float = _pf("t") * TAU
			var s: float = sin(a)
			hp["leg_n"] = Vector2(-s * 26.0, maxf(0.0, cos(a)) * 46.0 + 4.0)
			hp["leg_f"] = Vector2(s * 26.0, maxf(0.0, -cos(a)) * 46.0 + 4.0)
			hp["arm_f"] = Vector2(-s * 24.0, -14.0 - 12.0 * maxf(0.0, s))
			hp["arm_n"] = Vector2(s * 24.0, -14.0 - 12.0 * maxf(0.0, -s))
			hp["pitch"] = 3.0
			_pose["bob"] = -absf(cos(a)) * 2.4 + 1.0
			_pose["head"] = -2.0
			match tool:
				"spear":
					hp["arm_n"] = rest_arm + Vector2(s * 8.0, 0.0)
					hp["tool_deg"] = 6.0 + s * 5.0
				"basket":
					hp["arm_n"] = rest_arm + Vector2(s * 7.0, 0.0)
				"mallet":
					hp["arm_n"] = rest_arm
					hp["tool_deg"] = -84.0 + s * 4.0
				"staff":
					hp["arm_n"] = Vector2(-18.0 + s * 10.0, -36.0)
					hp["tool_deg"] = 2.0 + s * 8.0
		"glance":
			_pose["head"] = -12.0
		"camera":
			_pose["head"] = -4.0
		"eat":
			# A bite from the hand; the tool goes to the other hand.
			var k: int = _pose["k"]
			hp["arm_n"] = Vector2(-62, -112) if k == 0 else Vector2(-56, -96)
			hp["tool_hand"] = "far" if tool != "basket" else "none"
			hp["arm_f"] = Vector2(-4, -50)
			hp["tool_deg"] = 4.0
			_pose["head"] = 6.0 if k == 0 else 2.0
			_pose["mouth"] = 0.0 if k == 0 else 0.5
		"alarm":
			hp["arm_n"] = Vector2(-160, -24)
			hp["arm_f"] = Vector2(-146, -30)
			hp["leg_n"] = Vector2(-14, 10)
			hp["leg_f"] = Vector2(16, 6)
			hp["tool_deg"] = -24.0
			hp["pitch"] = -4.0
			_pose["head"] = -8.0
			_pose["mouth"] = 1.0
			_pose["bob"] = -5.0
			if tool == "basket":
				hp["tool"] = "none"
		"windup", "strike":
			var strike: bool = _act() == "strike"
			if tool == "basket":
				tool = "stick"
				hp["tool"] = "stick"
			hp["leg_n"] = Vector2(-22, 12) if strike else Vector2(-12, 10)
			hp["leg_f"] = Vector2(22, 10) if strike else Vector2(14, 6)
			match tool:
				"spear":
					hp["arm_n"] = Vector2(-82, -6) if strike else Vector2(48, -112)
					hp["tool_deg"] = 92.0 if strike else 78.0
				"stick":
					hp["arm_n"] = Vector2(-70, -10) if strike else Vector2(-170, -10)
					hp["tool_deg"] = 120.0 if strike else -20.0
				"mallet":
					hp["arm_n"] = Vector2(-60, -10) if strike else Vector2(-170, -20)
					hp["tool_deg"] = 112.0 if strike else -40.0
				"staff":
					hp["arm_n"] = Vector2(-86, -8) if strike else Vector2(-164, -14)
					hp["tool_deg"] = 64.0 if strike else -6.0
			hp["arm_f"] = Vector2(30, -40) if strike else Vector2(-40, -60)
			hp["pitch"] = 10.0 if strike else -8.0
			_pose["shift"] = 4.0 if strike else -2.0
			_pose["head"] = 6.0 if strike else -4.0
			_pose["mouth"] = 0.6 if strike else 0.0
			_pose["eyes"] = "open"
		"sleep":
			hp["leg_n"] = Vector2(-22, 34)
			hp["leg_f"] = Vector2(-14, 28)
			hp["arm_n"] = Vector2(-30, -60)
			hp["arm_f"] = Vector2(-20, -40)
			hp["tool_hand"] = "none"
			_pose["head"] = -8.0
			_pose["bob"] = 0.0
		"work":
			var k2: int = _pose["k"]
			_pose["bob"] = 0.0
			_pose["head"] = 8.0 if k2 == 1 else -4.0
			match tool:
				"mallet", "spear", "stick":
					# Hammering: raised high, then brought down with the knees bent.
					hp["arm_n"] = Vector2(-170, -16) if k2 == 0 else Vector2(-58, -6)
					hp["tool_deg"] = -36.0 if k2 == 0 else 118.0
					hp["arm_f"] = Vector2(-30, -60)
					hp["pitch"] = -4.0 if k2 == 0 else 16.0
					hp["leg_n"] = Vector2(-10, 8) if k2 == 0 else Vector2(-24, 34)
					hp["leg_f"] = Vector2(12, 4) if k2 == 0 else Vector2(10, 30)
					_pose["bob"] = 0.0 if k2 == 0 else 4.0
				"basket":
					# Stooping to gather, then straightening with a handful.
					hp["arm_f"] = Vector2(-40, -10) if k2 == 0 else Vector2(-60, -70)
					hp["pitch"] = 34.0 if k2 == 0 else 4.0
					hp["leg_n"] = Vector2(-18, 30) if k2 == 0 else Vector2(-4, 6)
					hp["leg_f"] = Vector2(12, 24) if k2 == 0 else Vector2(4, 4)
					_pose["bob"] = 5.0 if k2 == 0 else 0.0
					_pose["head"] = 20.0 if k2 == 0 else -6.0
				"staff":
					# Casting: the staff raised high in both hands, then thrust out.
					hp["arm_n"] = Vector2(-168, -10) if k2 == 0 else Vector2(-92, -6)
					hp["arm_f"] = Vector2(-160, -18) if k2 == 0 else Vector2(-70, -20)
					hp["tool_deg"] = -4.0 if k2 == 0 else 58.0
					hp["pitch"] = -6.0 if k2 == 0 else 8.0
					_pose["head"] = -14.0 if k2 == 0 else 2.0
	return hp

static func _fk2(hip: Vector2, a_hip: float, a_knee: float) -> Vector2:
	var knee := hip + Vector2(0, 15).rotated(deg_to_rad(a_hip))
	return knee + Vector2(0, 15).rotated(deg_to_rad(a_hip + a_knee))

static func _human_leg(hip: Vector2, a: Vector2, pants: Color, robed: bool) -> void:
	var knee := hip + Vector2(0, 15)
	var ankle := hip + Vector2(0, 29)
	_push(hip, a.x)
	_line(hip, knee, 7.0, pants)
	_push(knee, a.y)
	_line(knee, ankle, 6.0, pants)
	# The shoe stays flat-ish: it turns back against the leg's swing.
	_push(ankle, -(a.x + a.y) * 0.6)
	_ell(ankle.x + 3.0, ankle.y + 1.5, 6.2, 3.0, Color(0.2, 0.14, 0.1) if not robed else Color(0.3, 0.22, 0.32), 0.0, 0.2)
	_pop()
	_pop()
	_pop()

# Draws an arm from the shoulder and returns where the hand is (image space).
static func _human_arm(sh: Vector2, a: Vector2, sleeve: Color, robed: bool, pitch: float) -> Vector2:
	_push(Vector2(64, 90), pitch)
	var elbow := sh + Vector2(0, 14)
	_push(sh, a.x)
	_line(sh, elbow, 6.4 if not robed else 7.2, sleeve)
	_push(elbow, a.y)
	_line(elbow, elbow + Vector2(0, 12), 5.6 if not robed else 7.6, sleeve)
	var hand: Vector2 = _xf * (elbow + Vector2(0, 14))
	_pop()
	_pop()
	_pop()
	return hand

static func _abs_dot(at: Vector2, rad: float, col: Color) -> void:
	var saved := _xf
	_xf = Transform2D.IDENTITY
	_circ(at.x, at.y, rad, col)
	_xf = saved

static func _abs_star(at: Vector2, rad: float, col: Color) -> void:
	var saved := _xf
	_xf = Transform2D.IDENTITY
	_star(at.x, at.y, rad, col)
	_xf = saved

# A tool in the hand, drawn in image space. deg: 0 points straight up,
# clockwise from there (90 points forward).
static func _held(kind: String, hand: Vector2, deg: float, wood: Color, r: int, f: bool) -> void:
	var saved := _xf
	_xf = Transform2D.IDENTITY
	var rad: float = deg_to_rad(deg + (_body_tilt() if kind != "basket" else 0.0))
	var d := Vector2(sin(rad), -cos(rad))
	var n := Vector2(-d.y, d.x)
	match kind:
		"spear":
			_line(hand - d * 34.0, hand + d * 42.0, 2.6, wood)
			var tip := hand + d * 42.0
			_poly([tip + n * 3.6, tip + d * 12.0, tip - n * 3.6], Color(0.75, 0.77, 0.8), 0.5)
		"stick":
			_line(hand - d * 8.0, hand + d * 28.0, 3.2, wood)
		"mallet":
			_line(hand - d * 6.0, hand + d * 30.0, 3.2, wood)
			var c := hand + d * 32.0
			_poly([c + n * 10.0 - d * 6.0, c + n * 10.0 + d * 6.0, c - n * 10.0 + d * 6.0, c - n * 10.0 - d * 6.0], Color(0.48, 0.36, 0.26))
			_line(c + n * 5.0 - d * 6.0, c + n * 5.0 + d * 6.0, 1.4, Color(0.7, 0.7, 0.72), 0.0)
		"staff":
			_line(hand - d * 44.0, hand + d * 30.0, 3.5, Color(0.5, 0.34, 0.2))
			var orb := hand + d * 36.0
			_orb = orb
			_circ(orb.x, orb.y, 7.5, Color(0.42, 0.96, 0.6), 0.6)
			_dot(orb.x - 2.0, orb.y - 3.0, 2.2, Color(0.95, 1.0, 0.95))
		"basket":
			var b := hand + Vector2(1.0, 9.0)
			_arc(hand.x + 1.0, hand.y + 6.0, 7.0, 190.0, 350.0, 1.4, Color(0.45, 0.3, 0.15))
			_ell(b.x, b.y, 9.0, 6.0, Color(0.7, 0.52, 0.28))
			_line(b + Vector2(-8, -2), b + Vector2(8, -2), 1.2, Color(0.45, 0.3, 0.15), 0.0)
			_dot(b.x - 3.0, b.y - 4.0, 2.4, Color(0.9, 0.2, 0.15))
			_dot(b.x + 2.0, b.y - 4.0, 2.2, Color(0.95, 0.75, 0.2))
	_xf = saved

static func _body_tilt() -> float:
	return 90.0 if _act() == "sleep" else 0.0

static func _human_torso(r: int, f: bool, top: Color, foot_f: Vector2, foot_n: Vector2) -> void:
	match r:
		0:
			if f:
				_poly([Vector2(54, 58), Vector2(78, 58), Vector2(88, 110), Vector2(44, 110)], top)
				_line(Vector2(50, 80), Vector2(82, 80), 2.4, Color(0.85, 0.75, 0.55), 0.0)
			else:
				_poly([Vector2(54, 58), Vector2(78, 58), Vector2(82, 100), Vector2(50, 100)], top)
				_line(Vector2(50, 88), Vector2(82, 88), 2.6, Color(0.3, 0.2, 0.12), 0.0)
				_dot(68, 88, 2.0, Color(0.85, 0.7, 0.3))
		1:
			_poly([Vector2(53, 58), Vector2(79, 58), Vector2(81, 98), Vector2(51, 98)], top)
			_poly([Vector2(58, 70), Vector2(78, 70), Vector2(82, 104), Vector2(54, 104)], Color(0.66, 0.46, 0.26))
			_line(Vector2(60, 70), Vector2(66, 58), 1.6, Color(0.45, 0.3, 0.16), 0.0)
			_dot(68, 86, 2.0, Color(0.45, 0.3, 0.16))
		_:
			# The robe's hem follows the feet.
			var trim: Color = Color(0.98, 0.82, 0.35) if not f else Color(0.86, 0.92, 0.96)
			var back_x: float = minf(minf(foot_f.x, foot_n.x) - 10.0, 46.0)
			var front_x: float = maxf(maxf(foot_f.x, foot_n.x) + 12.0, 82.0)
			var hem: float = minf(maxf(foot_f.y, foot_n.y) - 2.0, 118.0)
			_poly([Vector2(54, 56), Vector2(78, 56), Vector2(front_x, hem), Vector2(back_x, hem + 1.0)], top)
			_line(Vector2(back_x + 2.0, hem - 3.0), Vector2(front_x - 2.0, hem - 4.0), 2.2, trim, 0.0)
			for p: Vector2 in [Vector2(56, 82), Vector2(72, 96), Vector2(62, 108), Vector2(76, 76), Vector2(54, 100)]:
				_star(p.x, p.y, 2.6, trim)

static func _head_begin_human(r: int, f: bool, skin: Color, hair: Color, hp: Dictionary) -> void:
	_push(Vector2(64, 90), hp["pitch"])
	_push(Vector2(66, 58), _pf("head"))
	var front: bool = _pf("turn") > 0.5
	var dark := Color(0.1, 0.08, 0.07)
	var blush := Color(0.95, 0.6, 0.55, 0.6)
	# Hair that hangs behind the head.
	if f and r == 0:
		_ell(54 if not front else 66, 54, 7 if not front else 15, 16, hair, 6.0 if not front else 0.0)
	elif f and r == 2:
		_poly([Vector2(52, 40), Vector2(60, 40), Vector2(58, 84), Vector2(44, 80)] if not front else [Vector2(50, 40), Vector2(82, 40), Vector2(86, 76), Vector2(46, 76)], hair.darkened(0.08), 0.5)
	if r == 2 and not f and front:
		_ell(66, 44, 15, 4, hair)
	_circ(66, 44, 13.5, skin)
	if front:
		_circ(52.5, 46, 3.0, skin.darkened(0.06))
		_circ(79.5, 46, 3.0, skin.darkened(0.06))
		_circ(66, 44, 13.5, skin)
	# Hair and hats.
	if r == 0 or (r == 1 and not f) or (r == 2 and f):
		if not front:
			_ell(60, 37, 14, 9.5, hair, -12.0)
			_ell(54.5, 46, 5, 9 if not f else 13, hair)
		else:
			_ell(66, 35, 14.5, 8.5, hair)
			if f:
				_ell(54, 46, 4, 12, hair)
				_ell(78, 46, 4, 12, hair)
	if r == 1:
		if not f:
			_ell(66, 33, 22, 5, Color(0.9, 0.76, 0.42))
			_ell(65 if not front else 66, 27, 12, 8, Color(0.9, 0.76, 0.42))
			_line(Vector2(54, 31), Vector2(77, 31), 2.0, Color(0.7, 0.3, 0.22), 0.0)
		else:
			_ell(65, 36, 16, 10, Color(0.78, 0.3, 0.25), -6.0 if not front else 0.0)
			if not front:
				_poly([Vector2(50, 38), Vector2(43, 52), Vector2(53, 47)], Color(0.78, 0.3, 0.25), 0.4)
	elif r == 2:
		var hat: Color = (Color(0.44, 0.27, 0.66) if not f else Color(0.18, 0.5, 0.54)).darkened(0.3)
		var trim: Color = Color(0.98, 0.82, 0.35) if not f else Color(0.86, 0.92, 0.96)
		_ell(66, 33, 23, 5, hat)
		if not front:
			_poly([Vector2(50, 33), Vector2(82, 33), Vector2(76, 16), Vector2(90, 6), Vector2(68, 10)], hat)
		else:
			_poly([Vector2(50, 33), Vector2(82, 33), Vector2(70, 12), Vector2(80, 4), Vector2(62, 10)], hat)
		_line(Vector2(51, 31), Vector2(81, 31), 2.4, trim, 0.0)
	# The face.
	if front:
		_peye_pair(61, 44, 71, 44, 2.3)
		_dot(58, 50, 2.2, blush)
		_dot(74, 50, 2.2, blush)
		_dot(66, 48, 1.3, skin.darkened(0.25))
		if _pf("mouth") > 0.4:
			_ell(66, 53, 2.2, 2.8, dark, 0.0, 0.0)
		else:
			_arc(66, 50, 3.2, 30.0, 150.0, 1.1, dark)
		if r == 2 and not f:
			_poly([Vector2(57, 51), Vector2(75, 51), Vector2(66, 72)], hair, 0.4)
	else:
		_circ(61.5, 46, 2.8, skin.darkened(0.06))
		_circ(78.5, 46.5, 2.8, skin)
		_dot(73, 50, 2.4, blush)
		_peye(72, 42.5, 2.4, Color(0.98, 0.96, 0.92))
		if f and String(_pose["eyes"]) == "open":
			_line(Vector2(70, 38), Vector2(76, 38.5), 1.2, dark, 0.0)
		elif String(_pose["eyes"]) == "wide" or _act() == "windup" or _act() == "strike":
			_line(Vector2(69, 37 if _act() == "alarm" else 38.5), Vector2(76, 37.5 if _act() == "alarm" else 39.5), 1.4, dark, 0.0)
		var m: float = _pf("mouth")
		if m > 0.4:
			_ell(75.5, 53, 1.8, 1.4 + m * 1.6, dark, 0.0, 0.0)
		else:
			_line(Vector2(73.5, 53), Vector2(77, 52.5), 1.1, dark, 0.0)
		if r == 2 and not f:
			_poly([Vector2(62, 50), Vector2(80, 50), Vector2(70, 70)], hair, 0.4)
	if _gold:
		# A halo of light above the hat.
		for k: int in 28:
			var a: float = float(k) / 28.0 * TAU
			_dot(64.0 + cos(a) * 17.0, 16.0 + sin(a) * 5.0, 2.6, Color(1.0, 0.97, 0.7))
	_alarm_at(Vector2(66, 42), 18.0)
	_pop()
	_pop()

static func _peye_pair(x0: float, y0: float, x1: float, y1: float, r: float) -> void:
	var eyes: String = String(_pose["eyes"])
	for c: Vector2 in [Vector2(x0, y0), Vector2(x1, y1)]:
		if eyes == "shut":
			_arc(c.x, c.y - r * 0.2, r * 0.9, 15.0, 165.0, 1.2, Color(0.08, 0.06, 0.06))
		else:
			_eye_front(c.x, c.y, r, Color(0.3, 0.2, 0.12))

# Mice: a round body, big round ears, whiskers and a long bare tail.
# normal: house-grey (doe paler); Dormouse: plump and orange; Snow Mouse: white.
static func _mouse(r: int, f: bool) -> void:
	var fur: Color = _pick(r, f, [Color(0.56, 0.52, 0.5), Color(0.66, 0.62, 0.58), Color(0.86, 0.58, 0.3), Color(0.9, 0.66, 0.38), Color(0.95, 0.95, 0.97), Color(0.92, 0.92, 0.96)])
	var dark: Color = fur.darkened(0.3)
	var pink := Color(0.95, 0.68, 0.7)
	var plump: float = 1.18 if r == 1 else 1.0
	var tail_k: float = _pf("tail")
	var feet: float = 0.0
	match _act():
		"walk":
			var t: float = _pf("t")
			_pose["bob"] = -absf(sin(t * TAU)) * 6.0
			feet = sin(t * TAU) * 30.0
			tail_k += sin(t * TAU) * 10.0
		"eat":
			_pose["head"] = 18.0 - _pose["k"] * 4.0
		"alarm":
			_pose["pitch"] = -22.0
			_pose["head"] = 10.0
		"windup", "strike":
			_pose["pitch"] = -8.0
			_pose["head"] = 8.0
			feet = -40.0
		"sleep":
			_pose["lie"] = 1.0
			_pose["head"] = 14.0
	_body_begin(Vector2(64, 121), 6.0)
	# The tail: a long thin curl behind.
	_push(Vector2(38, 104), tail_k)
	_line(Vector2(38, 104), Vector2(22, 110), 3.0, pink.darkened(0.15))
	_line(Vector2(22, 110), Vector2(12, 100), 2.6, pink.darkened(0.15))
	_line(Vector2(12, 100), Vector2(10, 88), 2.2, pink.darkened(0.15))
	_pop()
	_push(Vector2(56, 110), feet)
	_ell(54, 118, 8, 3, pink.darkened(0.2))
	_pop()
	_ell(62, 102, 26 * plump, 16 * plump, fur)
	_ell(64, 109, 16 * plump, 7, fur.lightened(0.2))
	_push(Vector2(80, 110), -feet)
	_ell(82, 118, 6, 3, pink.darkened(0.2))
	_pop()
	_head_begin(Vector2(84, 98))
	# Ears: big round dishes.
	_circ(80, 80, 10, dark)
	_circ(80, 80, 6.5, pink)
	_circ(92, 82, 9, fur)
	_circ(92, 82, 5.5, pink, 0.2)
	_ell(95, 96, 15, 10, fur)
	_ell(107, 99, 6, 4.5, fur.lightened(0.08))
	_peye(97, 93, 2.8, Color(0.08, 0.06, 0.06))
	_dot(112, 99, 2.2, pink.darkened(0.25))
	for k: int in 3:
		_line(Vector2(109, 99 + k * 2.0), Vector2(122, 95 + k * 4.0), 0.8, Color(0.25, 0.22, 0.2, 0.7))

static func _rabbit(r: int, f: bool) -> void:
	# normal: buck brown / doe grey-brown; Hare: tawny, long-legged; Moon Rabbit: white with a crescent.
	var fur: Color = _pick(r, f, [Color(0.62, 0.48, 0.34), Color(0.7, 0.62, 0.52), Color(0.74, 0.58, 0.32), Color(0.66, 0.6, 0.5), Color(0.96, 0.96, 0.98), Color(0.9, 0.88, 0.97)])
	var dark: Color = fur.darkened(0.28)
	var pink := Color(0.93, 0.66, 0.66)
	var ear: float = 26.0 if r == 1 else 22.0
	var eye: Color = Color(0.9, 0.35, 0.45) if r == 2 else Color(0.15, 0.1, 0.08)
	var hind: float = 0.0
	var front: float = 0.0
	var ears: float = _pf("ears")
	match _act():
		"walk":
			# Crouch, kick off with the hind feet, stretch out in the air,
			# land on the front paws and gather the hind feet under again.
			var t: float = _pf("t")
			var air: float = sin(clampf((t - 0.15) / 0.6, 0.0, 1.0) * PI)
			_pose["bob"] = -air * 17.0
			_pose["pitch"] = -11.0 * sin(clampf((t - 0.08) / 0.45, 0.0, 1.0) * PI) + 9.0 * sin(clampf((t - 0.58) / 0.38, 0.0, 1.0) * PI)
			hind = 58.0 * sin(clampf((t - 0.1) / 0.5, 0.0, 1.0) * PI) - 24.0 * sin(clampf((t - 0.66) / 0.34, 0.0, 1.0) * PI)
			front = -34.0 * air
			ears = -24.0 * air
			_pose["head"] = 0.0
		"eat":
			_pose["head"] = 22.0 - _pose["k"] * 5.0
			ears = -10.0
		"alarm":
			# Bolt upright on the haunches.
			_pose["pitch"] = -24.0
			_pose["bob"] = -3.0
			_pose["head"] = 14.0
			front = -18.0
			ears = 2.0
		"windup":
			_pose["pitch"] = -20.0
			_pose["head"] = 12.0
			front = -70.0
			ears = -30.0
		"strike":
			_pose["pitch"] = -12.0
			_pose["head"] = 6.0
			front = -100.0
			ears = -34.0
		"sleep":
			_pose["head"] = 10.0
			ears = -58.0
			_pose["lie"] = 1.0
		"work":
			# A binky: a twisting leap, then a flick of the heels.
			_pose["bob"] = -16.0 if _pose["k"] == 0 else -9.0
			_pose["pitch"] = -16.0 if _pose["k"] == 0 else 14.0
			hind = 30.0 if _pose["k"] == 0 else 60.0
			front = -30.0 if _pose["k"] == 0 else 0.0
			ears = -20.0
	_body_begin(Vector2(64, 121), 6.0)
	_push(Vector2(54, 100), hind)
	_ell(56, 116, 18 if r == 1 else 16, 5, dark)
	_pop()
	_circ(52, 92, 22 if not f else 20, fur)
	_ell(68, 96, 28, 17 if not f else 16, fur)
	_ell(66, 104, 18, 8, fur.lightened(0.18))
	_push(Vector2(34, 92), _pf("tail"))
	_circ(30, 88, 8.5, Color(0.97, 0.95, 0.92))
	_pop()
	_push(Vector2(58, 104), hind * 0.9)
	_ell(62, 117, 13, 4.2, fur.darkened(0.06))
	_pop()
	var leg_top: float = 96.0 if r == 1 else 100.0
	_push(Vector2(86, leg_top), front)
	_line(Vector2(86, leg_top), Vector2(88, 119), 5.0, fur)
	_ell(91, 120, 4.5, 2.2, dark, 0.0, 0.0)
	_pop()
	if r == 2:
		if f:
			_star(50, 88, 6.0, Color(0.98, 0.86, 0.5))
		else:
			_circ(50, 88, 7, Color(0.98, 0.86, 0.5), 0.0)
			_circ(53, 86, 6.5, fur, 0.0)
	_head_begin(Vector2(84, 90))
	_push(Vector2(84, 70), ears)
	_ell(80, 54 - (ear - 22.0), 5, ear - 2, dark, -24.0)
	_pop()
	_ell(93, 81, 15 if not f else 13.5, 12, fur)
	_push(Vector2(88, 72), ears * 0.9)
	_ell(88, 52 - (ear - 22.0), 6, ear, fur, -14.0)
	if r == 1:
		_ell(82.5, 27, 4.6, 6.5, Color(0.12, 0.1, 0.08), -14.0)
	_ell(89, 53 - (ear - 22.0), 3, ear - 6, pink, -14.0, 0.2)
	_pop()
	_peye(98, 77, 3.0, eye)
	_dot(107, 83 + _pose["k"] * 0.8 * float(_act() == "eat"), 2.0, pink.darkened(0.15))
	if f and r == 0:
		_circ(84, 66, 3.0, Color(0.98, 0.85, 0.4), 0.0)
	_alarm_at(Vector2(96, 76), 16.0)
	_pop()
	_pop()

static func _fish(r: int, f: bool) -> void:
	var tail: float = _pf("tail")
	var sway: float = 0.0
	match _act():
		"walk":
			var a: float = _pf("t") * TAU
			tail = sin(a) * 26.0
			sway = -sin(a - 0.6) * 4.0
		"stand", "blink", "glance", "camera":
			tail = 6.0
		"eat":
			_pose["mouth"] = 1.0 if _pose["k"] == 0 else 0.3
			tail = -10.0 + 20.0 * _pose["k"]
		"alarm":
			tail = 24.0
			sway = -6.0
		"windup":
			tail = 30.0
			sway = 8.0
		"strike":
			tail = -24.0
			sway = -4.0
			_pose["mouth"] = 1.0
		"sleep":
			# Stranded: flopping, curled one way then the other, gasping.
			tail = 38.0 if _pose["k"] == 0 else -36.0
			sway = -12.0 if _pose["k"] == 0 else 10.0
			_pose["mouth"] = 0.9
			_pose["eyes"] = "wide"
		"work":
			tail = 18.0 * (1.0 - 2.0 * _pose["k"])
	_push(Vector2(66, 32), sway)
	var m: float = _pf("mouth")
	match r:
		0:
			# Trout: the male flushes red and grows a hooked jaw.
			var body: Color = Color(0.5, 0.58, 0.48) if not f else Color(0.7, 0.75, 0.72)
			var fin := body.darkened(0.2)
			_push(Vector2(46, 32), tail * 0.45)
			_push(Vector2(26, 32), tail * 0.55)
			_poly([Vector2(24, 32), Vector2(4, 14), Vector2(11, 32), Vector2(4, 50)], fin)
			_pop()
			_ell(36, 32, 16, 8.5, body)
			for p: Vector2 in [Vector2(34, 30), Vector2(42, 26)]:
				_dot(p.x, p.y, 1.6, Color(0.2, 0.24, 0.2))
			_pop()
			_poly([Vector2(54, 19), Vector2(68, 7 - (4 if _act() == "alarm" else 0)), Vector2(80, 19)], fin)
			_ell(68, 32, 44, 16, body)
			_ell(72, 38, 34, 8, Color(0.88, 0.88, 0.8))
			_ell(66, 33, 36, 2.6 if f else 4.0, Color(0.92, 0.55, 0.55) if f else Color(0.9, 0.35, 0.35), 0.0, 0.2)
			for p: Vector2 in [Vector2(54, 22), Vector2(66, 25), Vector2(78, 22), Vector2(48, 30), Vector2(88, 26)]:
				_dot(p.x, p.y, 1.6, Color(0.2, 0.24, 0.2))
			_poly([Vector2(60, 44), Vector2(70, 54), Vector2(74, 44)], fin)
			_fish_mouth(110, 37, m)
			_peye(100, 28, 3.2, Color(0.95, 0.9, 0.6))
			if not f and m < 0.2:
				_arc(110, 38, 4.0, 200.0, 330.0, 1.6, Color(0.25, 0.2, 0.2))
			elif m < 0.2:
				_line(Vector2(106, 36), Vector2(111, 35), 1.0, Color(0.2, 0.2, 0.2), 0.0)
		1:
			# Sturgeon: long, armoured, whiskered.
			var body: Color = Color(0.45, 0.48, 0.5) if not f else Color(0.58, 0.6, 0.6)
			_push(Vector2(40, 32), tail * 0.45)
			_push(Vector2(20, 30), tail * 0.55)
			_poly([Vector2(18, 30), Vector2(2, 12), Vector2(10, 30), Vector2(4, 44)], body.darkened(0.2))
			_pop()
			_ell(30, 32, 20, 9, body)
			_pop()
			_ell(68, 32, 48, 11, body)
			_ell(68, 37, 40, 5, Color(0.82, 0.82, 0.78))
			_poly([Vector2(108, 26), Vector2(126, 32), Vector2(108, 38)], body)
			for i: int in 9:
				var x: float = 24.0 + i * 10.0
				_poly([Vector2(x - 3, 23), Vector2(x, 17), Vector2(x + 3, 23)], Color(0.86, 0.84, 0.78), 0.2)
			_fish_mouth(112, 38, m)
			_line(Vector2(112, 37), Vector2(110, 44), 1.0, Color(0.3, 0.3, 0.3), 0.0)
			_line(Vector2(116, 36), Vector2(116, 43), 1.0, Color(0.3, 0.3, 0.3), 0.0)
			_peye(104, 29, 2.6, Color(0.85, 0.85, 0.7))
		2:
			# Koi: white with orange (male) or gold with black (female).
			var body: Color = Color(0.97, 0.96, 0.94) if not f else Color(0.98, 0.78, 0.3)
			var patch: Color = Color(0.95, 0.42, 0.14) if not f else Color(0.12, 0.1, 0.1)
			_push(Vector2(46, 32), tail * 0.45)
			_push(Vector2(26, 32), tail * 0.55)
			_poly([Vector2(24, 32), Vector2(2, 10), Vector2(12, 32), Vector2(2, 54)], body.darkened(0.05))
			_pop()
			_ell(36, 32, 16, 9, body)
			_pop()
			_poly([Vector2(52, 19), Vector2(68, 5), Vector2(82, 19)], body)
			_ell(68, 32, 42, 17, body)
			_ell(56, 26, 12, 8, patch)
			_ell(80, 34, 10, 8, patch)
			_ell(96, 24, 7, 5, patch)
			_poly([Vector2(58, 46), Vector2(70, 58), Vector2(76, 46)], body.darkened(0.05))
			_fish_mouth(110, 37, m)
			if m < 0.2:
				_line(Vector2(108, 36), Vector2(116, 42), 1.0, Color(0.5, 0.4, 0.3), 0.0)
			_peye(100, 28, 3.2, Color(0.15, 0.12, 0.12))
	_alarm_at(Vector2(98, 26), 10.0)
	_pop()

static func _fish_mouth(x: float, y: float, m: float) -> void:
	if m > 0.2:
		_ell(x, y, 3.0 + m, 2.0 + m * 2.2, Color(0.3, 0.1, 0.12), 0.0, 0.0)

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

# ------------------------------------------------------------------
# Producer icons (menus, the Field Guide) and textures for the 3D plants.
# ------------------------------------------------------------------
static func producer_image(kind: String) -> Image:
	var ink := Color(0.1, 0.08, 0.07)
	_begin(Vector2i(SIZE, SIZE), ink)
	match kind:
		"berry":
			# A low tangle of branches heavy with berries.
			var wood := Color(0.42, 0.28, 0.17)
			for a: float in [-60.0, -30.0, 0.0, 30.0, 60.0]:
				var d := Vector2(sin(deg_to_rad(a)), -cos(deg_to_rad(a)))
				_line(Vector2(64, 118), Vector2(64, 118) + d * 46.0, 5.0, wood)
				_line(Vector2(64, 118) + d * 30.0, Vector2(64, 118) + d * 30.0 + Vector2(d.x * 18.0 + 10.0, -14.0), 3.0, wood)
			for p: Vector2 in [Vector2(40, 74), Vector2(30, 90), Vector2(52, 62), Vector2(64, 70), Vector2(78, 62), Vector2(90, 74), Vector2(98, 90), Vector2(70, 84), Vector2(48, 84), Vector2(84, 86)]:
				_ell(p.x + 6, p.y - 6, 9, 5, Color(0.3, 0.52, 0.24), 30.0)
				_circ(p.x, p.y, 6.0, Color(0.42, 0.16, 0.55))
				_dot(p.x - 2, p.y - 2, 1.6, Color(0.8, 0.6, 0.95))
		"moss":
			# A stub of trunk wrapped in moss, a star moss on top.
			_poly([Vector2(42, 124), Vector2(48, 20), Vector2(82, 20), Vector2(88, 124)], Color(0.42, 0.28, 0.17))
			for i: int in 6:
				_line(Vector2(52 + i * 5, 26), Vector2(50 + i * 6, 120), 1.2, Color(0.3, 0.2, 0.12), 0.0)
			for p: Vector3 in [Vector3(48, 96, 14), Vector3(70, 104, 16), Vector3(84, 84, 12), Vector3(52, 64, 12), Vector3(76, 54, 11), Vector3(60, 80, 10)]:
				_circ(p.x, p.y, p.z, Color(0.32, 0.58, 0.24))
				_circ(p.x - p.z * 0.3, p.y - p.z * 0.3, p.z * 0.45, Color(0.45, 0.7, 0.32), 0.0)
			_star(66, 36, 10.0, Color(0.98, 0.86, 0.3))
		"apple":
			# A red apple with a leaf, a golden one tucked behind.
			_circ(84, 82, 22.0, Color(0.98, 0.8, 0.25))
			_circ(56, 78, 30.0, Color(0.86, 0.14, 0.1))
			_ell(46, 66, 9, 6, Color(1.0, 0.6, 0.55), -30.0, 0.0)
			_line(Vector2(58, 50), Vector2(62, 34), 3.0, Color(0.38, 0.24, 0.12))
			_ell(72, 38, 12, 6, Color(0.36, 0.62, 0.26), -20.0)
		"pinecone":
			# An upright cone of woody scales, rows of them overlapping, a
			# sprig of needles at the stem.
			for k: int in 5:
				var a: float = deg_to_rad(-70.0 + k * 35.0)
				_line(Vector2(64, 22), Vector2(64, 22) + Vector2(sin(a), -cos(a) * 0.6) * 22.0, 2.0, Color(0.2, 0.42, 0.24), 0.0)
			var rows: int = 7
			for r: int in rows:
				var t: float = float(r) / float(rows - 1)
				var y: float = 30.0 + t * 84.0
				# Widest a third of the way down, tapering to a point below.
				var half: float = (14.0 + 24.0 * sin(clampf(t * 1.25, 0.0, 1.0) * PI)) * (1.0 - t * 0.45)
				var n: int = 3 + (r % 2)
				for k: int in n:
					var x: float = 64.0 - half + (2.0 * half) * (float(k) + 0.5) / float(n)
					var sc := Color(0.55, 0.36, 0.18).lerp(Color(0.38, 0.24, 0.12), float((k + r) % 2) * 0.6)
					_poly([Vector2(x - half / float(n) - 2.0, y - 6.0), Vector2(x + half / float(n) + 2.0, y - 6.0), Vector2(x, y + 9.0)], sc, 0.0)
					_line(Vector2(x - 3.0, y - 2.0), Vector2(x + 3.0, y - 2.0), 1.0, Color(0.7, 0.5, 0.3), 0.0)
		"pineapple":
			# Golden-brown body crosshatched into diamonds under a crown of
			# spiky green leaves.
			for k: int in 9:
				var a2: float = deg_to_rad(-60.0 + k * 15.0)
				var tip := Vector2(64, 48) + Vector2(sin(a2), -cos(a2)) * (30.0 + 8.0 * (1.0 - absf(k - 4.0) / 4.0))
				_poly([Vector2(60, 50), tip, Vector2(68, 50)], Color(0.28, 0.58, 0.24).lerp(Color(0.2, 0.45, 0.2), float(k % 2)), 0.0)
			_ell(64, 86, 26, 34, Color(0.86, 0.62, 0.16))
			# Crosshatch, kept inside the fruit: short steps along each line.
			var inside := func(q: Vector2) -> bool:
				return pow((q.x - 64.0) / 24.0, 2.0) + pow((q.y - 86.0) / 32.0, 2.0) <= 1.0
			for i: int in 9:
				var o: float = -64.0 + i * 16.0
				for dir: float in [1.0, -1.0]:
					var a0 := Vector2(64 + o * dir - 25 * dir, 50)
					var a1 := Vector2(64 + o * dir + 25 * dir, 122)
					for k: int in 18:
						var q0: Vector2 = a0.lerp(a1, float(k) / 18.0)
						var q1: Vector2 = a0.lerp(a1, float(k + 1) / 18.0)
						if inside.call(q0) and inside.call(q1):
							_line(q0, q1, 1.6, Color(0.55, 0.36, 0.1), 0.0)
			for p: Vector2 in [Vector2(54, 70), Vector2(74, 70), Vector2(64, 86), Vector2(48, 96), Vector2(80, 96), Vector2(64, 108)]:
				_dot(p.x, p.y, 2.0, Color(0.98, 0.85, 0.4))
	return _finish(ink, 3)

# Tiling bark: dark furrows running up the trunk over warm brown.
# Tiling bark: dark furrows running up the trunk over warm brown.
static func bark_image() -> Image:
	var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
	var base := Color(0.42, 0.29, 0.18)
	for y: int in 128:
		for x: int in 128:
			var u: float = float(x) / 128.0 * TAU
			# Wavy vertical furrows that wrap left to right without a seam.
			var w: float = sin(u * 6.0 + sin(float(y) / 128.0 * TAU * 2.0 + u) * 1.2)
			var n: float = sin(u * 17.0 + float(y) * 0.31) * 0.5 + sin(float(y) * 0.9 + u * 3.0) * 0.3
			var shade: float = clampf(0.82 + 0.22 * w + 0.08 * n, 0.45, 1.15)
			if w < -0.75:
				shade *= 0.55
			img.set_pixel(x, y, Color(base.r * shade, base.g * shade, base.b * shade))
	img.generate_mipmaps()
	return img

# Fruit skin: a soft blush with a highlight and a few freckles.
# Fruit skin: a soft blush with a highlight and a few freckles.
static func fruit_image(base: Color) -> Image:
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	for y: int in 64:
		for x: int in 64:
			var v: float = float(y) / 63.0
			var c := base.lightened(0.25 * (1.0 - v)).darkened(0.25 * v)
			if (x * 7 + y * 13) % 29 == 0:
				c = c.lightened(0.3)
			img.set_pixel(x, y, c)
	img.generate_mipmaps()
	return img

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
# Painting primitives (all take 128-space coordinates, through _xf)
# ------------------------------------------------------------------
static func _begin(dims: Vector2i, bleed: Color) -> void:
	_w = dims.x * SS
	_h = dims.y * SS
	_img = Image.create(_w, _h, false, Image.FORMAT_RGBA8)
	_img.fill(Color(bleed.r, bleed.g, bleed.b, 0.0))
	_xf = Transform2D.IDENTITY
	_stack.clear()

static func _finish(ink: Color, outline_px: int) -> Image:
	if outline_px > 0:
		_outline(ink, outline_px)
	var out := _img
	out.resize(_w / SS, _h / SS, Image.INTERPOLATE_BILINEAR)
	_img = null
	_xf = Transform2D.IDENTITY
	_stack.clear()
	return out

# Dilate the silhouette (separable square kernel) and paint the ring in ink.
static func _outline(ink: Color, r: int) -> void:
	var data := _img.get_data()
	var n: int = _w * _h
	var solid := PackedByteArray()
	solid.resize(n)
	for i: int in n:
		solid[i] = 1 if data[i * 4 + 3] >= 128 else 0
	var horiz := PackedByteArray()
	horiz.resize(n)
	for y: int in _h:
		var row: int = y * _w
		for x: int in _w:
			var hit: int = 0
			for k: int in range(maxi(0, x - r), mini(_w, x + r + 1)):
				if solid[row + k] == 1:
					hit = 1
					break
			horiz[row + x] = hit
	var ir: int = int(ink.r * 255.0)
	var ig: int = int(ink.g * 255.0)
	var ib: int = int(ink.b * 255.0)
	for y: int in _h:
		for x: int in _w:
			var i: int = y * _w + x
			if solid[i] == 1:
				continue
			for k: int in range(maxi(0, y - r), mini(_h, y + r + 1)):
				if horiz[k * _w + x] == 1:
					data[i * 4] = ir
					data[i * 4 + 1] = ig
					data[i * 4 + 2] = ib
					data[i * 4 + 3] = 255
					break
	_img.set_data(_w, _h, false, Image.FORMAT_RGBA8, data)

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

static func _xf_scale() -> float:
	return sqrt(absf(_xf.determinant()))

static func _ell(cx: float, cy: float, rx: float, ry: float, col: Color, rot_deg: float = 0.0, shade: float = 1.0) -> void:
	# Local ellipse space -> supersampled pixels, through the joint transform.
	var m: Transform2D = Transform2D(Vector2(SS, 0), Vector2(0, SS), Vector2.ZERO) * _xf * Transform2D(deg_to_rad(rot_deg), Vector2(cx, cy))
	var inv: Transform2D = m.affine_inverse()
	var c: Vector2 = m.origin
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for k: Vector2 in [Vector2(-rx, -ry), Vector2(rx, -ry), Vector2(-rx, ry), Vector2(rx, ry)]:
		var q: Vector2 = m * k
		lo = lo.min(q)
		hi = hi.max(q)
	# Shade in screen space so rotated shapes keep the same light.
	var ext: float = maxf(rx, ry) * SS * _xf_scale() + 1.0
	var ax: Vector2 = inv.x
	var ay: Vector2 = inv.y
	var ao: Vector2 = inv.origin
	var irx: float = 1.0 / rx
	var iry: float = 1.0 / ry
	for y: int in range(maxi(0, int(lo.y) - 1), mini(_h, int(hi.y) + 2)):
		var py: float = y + 0.5
		for x: int in range(maxi(0, int(lo.x) - 1), mini(_w, int(hi.x) + 2)):
			var px: float = x + 0.5
			var lx: float = (ax.x * px + ay.x * py + ao.x) * irx
			var ly: float = (ax.y * px + ay.y * py + ao.y) * iry
			if lx * lx + ly * ly <= 1.0:
				_put(x, y, _shade(col, (px - c.x) / ext, (py - c.y) / ext, shade))

static func _circ(cx: float, cy: float, r: float, col: Color, shade: float = 1.0) -> void:
	_ell(cx, cy, r, r, col, 0.0, shade)

static func _dot(cx: float, cy: float, r: float, col: Color) -> void:
	_ell(cx, cy, r, r, col, 0.0, 0.0)

static func _poly(pts: Array, col: Color, shade: float = 1.0) -> void:
	var poly := PackedVector2Array()
	var lo := Vector2(INF, INF)
	var hi := Vector2(-INF, -INF)
	for p: Vector2 in pts:
		var q: Vector2 = (_xf * p) * SS
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
	a = (_xf * a) * SS
	b = (_xf * b) * SS
	var r: float = width * 0.5 * SS * _xf_scale()
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

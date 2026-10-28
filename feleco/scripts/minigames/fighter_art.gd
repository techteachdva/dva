class_name FighterArt
extends RefCounted

# Cartoon brawlers for Predator Brawl: the valley's hunters standing
# ridiculously upright on two legs, fists up, ready to box. Drawn from
# simple shapes so every move has its own pose. All three stand the same
# height. Coordinates: feet at the origin, facing +x, u = height / 10.

const LOOKS: Dictionary = {
	"wolf": {"fur": Color(0.52, 0.56, 0.64), "dark": Color(0.33, 0.36, 0.43), "belly": Color(0.88, 0.89, 0.9), "fist": Color(0.62, 0.66, 0.73), "eye": Color(1.0, 0.82, 0.25)},
	"lion": {"fur": Color(0.84, 0.62, 0.36), "dark": Color(0.6, 0.41, 0.22), "belly": Color(0.98, 0.9, 0.74), "fist": Color(0.92, 0.72, 0.46), "eye": Color(0.55, 0.85, 0.35)},
	"falcon": {"fur": Color(0.38, 0.44, 0.56), "dark": Color(0.22, 0.26, 0.35), "belly": Color(0.96, 0.92, 0.82), "fist": Color(0.98, 0.8, 0.25), "eye": Color(0.15, 0.12, 0.1)},
}

# pose: idle, walk, jump, light, heavy, special, block, hurt, ko, evolve,
# taunt, and the combos: sweep, finisher, lunge, rising, slam, whirl.
# t: seconds in the pose (animates it), chain: which jab of a light chain.
static func paint(ci: CanvasItem, species: String, pose: String, t: float, u: float, tint: Color = Color.WHITE, chain: int = 1) -> void:
	var L: Dictionary = LOOKS.get(species, LOOKS["wolf"])
	var fur: Color = (L["fur"] as Color) * tint
	var dark: Color = (L["dark"] as Color) * tint
	var belly: Color = (L["belly"] as Color) * tint
	var fistc: Color = (L["fist"] as Color) * tint
	var bounce: float = sin(t * 7.0) * 0.12 * u
	var lean: float = 0.0
	var front_fist := Vector2(2.0, -7.6) * u
	var back_fist := Vector2(1.3, -8.3) * u
	var step: float = 0.0
	var crouch: float = 0.0
	# A kicking front foot (the low sweep), or none.
	var kick := Vector2.INF
	match pose:
		"walk":
			step = sin(t * 12.0) * 0.8 * u
			bounce = absf(sin(t * 12.0)) * 0.25 * u
		"jump":
			crouch = -0.6 * u
			front_fist = Vector2(2.2, -8.8) * u
			back_fist = Vector2(-0.6, -8.6) * u
		"light":
			# Jabs alternate hands down the chain.
			var reach: float = clampf(t / 0.08, 0.0, 1.0) * clampf((0.24 - t) / 0.1, 0.0, 1.0)
			if chain % 2 == 1:
				front_fist = Vector2(lerpf(2.0, 4.6, reach), -7.7) * u
			else:
				back_fist = Vector2(lerpf(1.3, 4.4, reach), -8.0) * u
			lean = 0.08 * reach
		"heavy":
			# A big wind-up uppercut.
			var k: float = clampf((t - 0.1) / 0.15, 0.0, 1.0)
			back_fist = Vector2(lerpf(-1.4, 3.6, k), lerpf(-6.0, -10.6, k)) * u
			front_fist = Vector2(1.2, -7.0) * u
			lean = lerpf(-0.15, 0.2, k)
			crouch = (1.0 - k) * 0.6 * u
		"special":
			lean = 0.45
			front_fist = Vector2(4.4, -7.0) * u
			back_fist = Vector2(3.8, -6.2) * u
			if species == "falcon":
				lean = 0.9
		"block":
			front_fist = Vector2(1.5, -8.9) * u
			back_fist = Vector2(1.1, -8.0) * u
			crouch = 0.4 * u
			lean = -0.05
		"hurt":
			lean = -0.35
			front_fist = Vector2(0.4, -8.8) * u
			back_fist = Vector2(-1.2, -9.2) * u
		"ko":
			lean = -1.45
			front_fist = Vector2(1.2, -5.0) * u
			back_fist = Vector2(-0.8, -5.5) * u
		"evolve":
			front_fist = Vector2(2.4, -10.4) * u
			back_fist = Vector2(-1.6, -10.4) * u
			bounce = sin(t * 30.0) * 0.2 * u
		"taunt":
			# One fist on the hip, the other waving "come on" over its head.
			front_fist = Vector2(0.9, -5.2) * u
			back_fist = Vector2(-0.6 + sin(t * 14.0) * 0.9, -11.0) * u
			lean = -0.12 + sin(t * 7.0) * 0.06
		"sweep":
			# Drops low and swings the front leg out along the grass.
			var k: float = clampf(t / 0.12, 0.0, 1.0) * clampf((0.45 - t) / 0.15, 0.0, 1.0)
			crouch = 1.8 * u
			lean = 0.3
			kick = Vector2(lerpf(1.0, 5.4, k), -0.3) * u
			front_fist = Vector2(1.4, -6.2) * u
			back_fist = Vector2(-1.0, -6.0) * u
		"finisher":
			# A deep wind-up, then a huge uppercut with the whole body.
			var k: float = clampf((t - 0.14) / 0.14, 0.0, 1.0)
			back_fist = Vector2(lerpf(-2.2, 3.4, k), lerpf(-4.8, -12.0, k)) * u
			front_fist = Vector2(lerpf(1.6, 0.4, k), -7.0) * u
			lean = lerpf(-0.3, 0.3, k)
			crouch = (1.0 - k) * 1.1 * u
		"lunge":
			# A dash with the front fist driven out ahead.
			var k: float = clampf(t / 0.08, 0.0, 1.0)
			front_fist = Vector2(lerpf(2.0, 5.4, k), -7.4) * u
			back_fist = Vector2(-0.4, -7.8) * u
			lean = 0.5 * k
			step = 1.2 * u
		"rising":
			# Springs up, fist leading straight overhead.
			var k: float = clampf(t / 0.12, 0.0, 1.0)
			front_fist = Vector2(lerpf(2.0, 2.6, k), lerpf(-7.6, -12.4, k)) * u
			back_fist = Vector2(0.6, -6.8) * u
			lean = -0.1
			crouch = -0.8 * u * k
		"slam":
			# Both fists raised high, then brought down like a hammer.
			var k: float = clampf((t - 0.24) / 0.1, 0.0, 1.0)
			var up := Vector2(0.4, -12.2) * u
			var down := Vector2(4.0, -4.4) * u
			front_fist = up.lerp(down, k)
			back_fist = (up + Vector2(-0.6, 0.2) * u).lerp(down + Vector2(-0.4, -0.4) * u, k)
			lean = lerpf(-0.35, 0.55, k)
			crouch = k * 0.5 * u
		"whirl":
			# Arms flung wide, spinning on the spot.
			front_fist = Vector2(4.2, -7.2) * u
			back_fist = Vector2(-3.6, -7.0) * u
			lean = sin(t * 40.0) * 0.25
			bounce = absf(sin(t * 20.0)) * 0.3 * u
	# Lean pivots about the hips.
	var hips := Vector2(0, -4.0 * u)
	var lean_xf := Transform2D(0.0, Vector2(0, -bounce + crouch)) * Transform2D(0.0, hips) * Transform2D(lean, Vector2.ZERO) * Transform2D(0.0, -hips)
	# Legs and feet stay planted; the body above the hips leans.
	_legs(ci, species, u, step, crouch, dark, fur, kick)
	var saved := _current_xform(ci)
	ci.draw_set_transform_matrix(saved * lean_xf)
	if species != "falcon":
		_tail(ci, species, u, t, fur, dark)
	else:
		_tail_feathers(ci, u, dark)
	_arm(ci, species, Vector2(-0.4, -7.5) * u, back_fist, u, fur.darkened(0.15), fistc.darkened(0.15))
	# Torso and belly.
	_ellipse(ci, Vector2(0, -6.0) * u, Vector2(1.7, 2.5) * u, fur)
	_ellipse(ci, Vector2(0.45, -5.8) * u, Vector2(1.0, 1.9) * u, belly)
	if species == "falcon":
		for k: int in 6:
			ci.draw_circle(Vector2(0.2 + (k % 2) * 0.5, -6.8 + k * 0.45) * u, 0.12 * u, dark)
	_head(ci, species, u, t, pose, fur, dark, belly, L["eye"])
	_arm(ci, species, Vector2(0.5, -7.4) * u, front_fist, u, fur, fistc)
	ci.draw_set_transform_matrix(saved)

static var _xf_stack: Transform2D = Transform2D.IDENTITY

# The caller sets the canvas transform before paint(); remember it so the
# lean can be applied on top and undone.
static func set_base(ci: CanvasItem, xf: Transform2D) -> void:
	_xf_stack = xf
	ci.draw_set_transform_matrix(xf)

static func _current_xform(_ci: CanvasItem) -> Transform2D:
	return _xf_stack

static func _ellipse(ci: CanvasItem, c: Vector2, r: Vector2, col: Color) -> void:
	var pts := PackedVector2Array()
	for i: int in 20:
		var a: float = TAU * i / 20.0
		pts.append(c + Vector2(cos(a) * r.x, sin(a) * r.y))
	ci.draw_colored_polygon(pts, col)

static func _legs(ci: CanvasItem, species: String, u: float, step: float, crouch: float, dark: Color, fur: Color, kick: Vector2 = Vector2.INF) -> void:
	var hip_y: float = -4.0 * u + crouch
	var legc: Color = Color(0.95, 0.75, 0.2) if species == "falcon" else fur.darkened(0.1)
	for side: float in [-1.0, 1.0]:
		var hip := Vector2(side * 0.7 * u, hip_y)
		var foot := Vector2(side * 0.9 * u + step * side, 0.0)
		if side > 0.0 and kick.is_finite():
			foot = kick
		var knee := (hip + foot) * 0.5 + Vector2(0.5 * u, crouch * 0.3)
		var w: float = (0.5 if species == "falcon" else 1.0) * u
		ci.draw_line(hip, knee, legc, w)
		ci.draw_line(knee, foot, legc, w)
		ci.draw_circle(knee, w * 0.5, legc)
		if species == "falcon":
			for k: int in 3:
				ci.draw_line(foot, foot + Vector2((0.6 + 0.2 * k) * u, (-0.2 + 0.2 * k) * u), legc, 0.25 * u)
		else:
			_ellipse(ci, foot + Vector2(0.4 * u, -0.25 * u), Vector2(0.85, 0.4) * u, dark)

static func _arm(ci: CanvasItem, species: String, shoulder: Vector2, fist: Vector2, u: float, col: Color, fistc: Color) -> void:
	var elbow := (shoulder + fist) * 0.5 + Vector2(-0.3 * u, 0.7 * u)
	ci.draw_line(shoulder, elbow, col, 0.85 * u)
	ci.draw_line(elbow, fist, col, 0.8 * u)
	ci.draw_circle(elbow, 0.42 * u, col)
	if species == "falcon":
		# Wing-arms: a fan of flight feathers hangs under the forearm.
		var dirv: Vector2 = (fist - elbow).normalized()
		for k: int in 4:
			var p: Vector2 = elbow.lerp(fist, 0.2 + 0.25 * k)
			ci.draw_line(p, p + Vector2(-dirv.y, dirv.x).abs() * 0.0 + Vector2(-0.6, 1.6 + 0.2 * k) * u, col.darkened(0.2), 0.35 * u)
	# The fist (boxing-ready knuckles).
	ci.draw_circle(fist, 0.65 * u, fistc)
	ci.draw_line(fist + Vector2(0.1, -0.35) * u, fist + Vector2(0.45, -0.1) * u, fistc.darkened(0.3), 0.12 * u)
	ci.draw_line(fist + Vector2(0.1, 0.0) * u, fist + Vector2(0.5, 0.2) * u, fistc.darkened(0.3), 0.12 * u)

static func _head(ci: CanvasItem, species: String, u: float, t: float, pose: String, fur: Color, dark: Color, belly: Color, eye: Color) -> void:
	var c := Vector2(0.35, -9.4) * u
	match species:
		"wolf":
			for ex: float in [-0.7, 0.5]:
				ci.draw_colored_polygon(PackedVector2Array([c + Vector2(ex, -0.8) * u, c + Vector2(ex + 0.3, -2.5) * u, c + Vector2(ex + 0.9, -1.0) * u]), dark)
			ci.draw_circle(c, 1.45 * u, fur)
			_ellipse(ci, c + Vector2(1.5, 0.45) * u, Vector2(1.15, 0.6) * u, belly)
			ci.draw_circle(c + Vector2(2.55, 0.2) * u, 0.32 * u, Color(0.1, 0.1, 0.12))
		"lion":
			ci.draw_circle(c + Vector2(-0.6, -1.0) * u, 0.5 * u, dark)
			ci.draw_circle(c + Vector2(0.6, -1.15) * u, 0.5 * u, dark)
			ci.draw_circle(c, 1.5 * u, fur)
			_ellipse(ci, c + Vector2(1.15, 0.55) * u, Vector2(0.8, 0.6) * u, belly)
			ci.draw_circle(c + Vector2(1.8, 0.25) * u, 0.26 * u, Color(0.75, 0.42, 0.4))
			for k: int in 3:
				ci.draw_line(c + Vector2(1.5, 0.6 + k * 0.15) * u, c + Vector2(2.4, 0.4 + k * 0.3) * u, dark, 0.06 * u)
		"falcon":
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-1.0, -1.0) * u, c + Vector2(-1.9, -1.7) * u, c + Vector2(-0.6, -1.4) * u]), dark)
			ci.draw_circle(c, 1.4 * u, fur)
			_ellipse(ci, c + Vector2(0.5, 0.6) * u, Vector2(0.9, 0.7) * u, belly)
			# Hooked yellow beak and the falcon's dark moustache stripe.
			ci.draw_colored_polygon(PackedVector2Array([c + Vector2(1.1, -0.35) * u, c + Vector2(2.3, 0.15) * u, c + Vector2(1.9, 0.75) * u, c + Vector2(1.1, 0.4) * u]), Color(0.98, 0.8, 0.25))
			ci.draw_line(c + Vector2(0.35, 0.0) * u, c + Vector2(0.2, 1.1) * u, dark, 0.35 * u)
	# Eye and a determined brow (a funny frown, not a scary one).
	var ep := c + Vector2(0.75, -0.35) * u
	if pose == "ko":
		ci.draw_line(ep - Vector2(0.3, 0.3) * u, ep + Vector2(0.3, 0.3) * u, Color.BLACK, 0.12 * u)
		ci.draw_line(ep + Vector2(-0.3, 0.3) * u, ep + Vector2(0.3, -0.3) * u, Color.BLACK, 0.12 * u)
	else:
		ci.draw_circle(ep, 0.38 * u, Color.WHITE)
		ci.draw_circle(ep + Vector2(0.12, 0.0) * u, 0.22 * u, eye)
		ci.draw_circle(ep + Vector2(0.16, 0.0) * u, 0.1 * u, Color.BLACK)
		var squint: float = 0.15 if pose in ["light", "heavy", "special", "sweep", "finisher", "lunge", "rising", "slam", "whirl"] else 0.0
		ci.draw_line(ep + Vector2(-0.45, -0.55 + squint) * u, ep + Vector2(0.45, -0.3 + squint) * u, dark.darkened(0.3), 0.18 * u)
	if pose == "hurt":
		for k: int in 3:
			var a: float = t * 6.0 + k * TAU / 3.0
			ci.draw_circle(c + Vector2(cos(a) * 1.6, -2.0 + sin(a) * 0.4) * u, 0.18 * u, Color(1, 0.9, 0.3))

static func _tail(ci: CanvasItem, species: String, u: float, t: float, fur: Color, dark: Color) -> void:
	var wag: float = sin(t * 5.0) * 0.3
	var pts := PackedVector2Array()
	var n: int = 6
	for i: int in n + 1:
		var k: float = float(i) / n
		if species == "lion":
			pts.append(Vector2(-1.4 - k * 2.8, -4.4 - sin(k * PI) * 1.2 + k * wag * 2.0) * u)
		else:
			pts.append(Vector2(-1.4 - k * 2.2, -4.6 + k * 0.6 + k * wag * 2.0) * u)
	ci.draw_polyline(pts, fur, (0.35 if species == "lion" else 0.75) * u)
	if species == "lion":
		ci.draw_circle(pts[n], 0.4 * u, dark)
	else:
		ci.draw_circle(pts[n], 0.45 * u, Color(0.9, 0.9, 0.92))

static func _tail_feathers(ci: CanvasItem, u: float, dark: Color) -> void:
	for k: int in 3:
		ci.draw_line(Vector2(-1.2, -4.2) * u, Vector2(-2.8, -3.0 + k * 0.5) * u, dark, 0.45 * u)

# A motion swoosh for a strike in flight: an arc for punches, a low streak
# for the sweep, a ring for the whirlwind, a fall line for the slam.
static func swoosh(ci: CanvasItem, xf: Transform2D, pose: String, t: float, u: float, col: Color) -> void:
	ci.draw_set_transform_matrix(xf)
	var c := Color(col.r, col.g, col.b, 0.55)
	match pose:
		"sweep":
			ci.draw_arc(Vector2(1.5, -0.4) * u, 4.2 * u, -0.35, 0.1, 14, c, 0.5 * u)
		"whirl":
			ci.draw_arc(Vector2(0, -7.0) * u, 4.4 * u, t * 30.0, t * 30.0 + 4.2, 24, c, 0.45 * u)
		"slam":
			ci.draw_arc(Vector2(1.0, -6.0) * u, 6.0 * u, -1.6, 0.3, 16, c, 0.5 * u)
		"rising", "finisher", "heavy":
			ci.draw_arc(Vector2(1.0, -8.0) * u, 4.0 * u, -1.9, -0.2, 16, c, 0.45 * u)
		"lunge":
			for k: int in 3:
				ci.draw_line(Vector2(-3.0 - k * 1.2, -7.4 + k * 0.6) * u, Vector2(-0.5 - k * 1.2, -7.4 + k * 0.6) * u, c, 0.25 * u)
		_:
			ci.draw_arc(Vector2(2.0, -7.6) * u, 2.6 * u, -0.7, 0.7, 12, c, 0.35 * u)

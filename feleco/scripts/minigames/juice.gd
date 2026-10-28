class_name Juice
extends RefCounted

# Game feel for the campaign games: synthesized sound effects (no audio
# files: every sound is built from sine sweeps and noise the first time it
# plays), and a little effects layer each game owns and draws in its own
# coordinates: particle bursts, confetti, rings, streaks, floating text,
# screen shake and flashes.
#
#   var fx := Juice.new()             # one per game
#   fx.update(delta)                  # in _process
#   fx.draw(self)                     # in _draw, inside the game's transform
#   fx.burst(pos, Color.GOLD)         # sparks
#   fx.text(pos, "NICE!", Color.GOLD) # a popping word
#   fx.shake(0.4)                     # read fx.offset() for the camera jolt
#   Juice.sfx(self, "pop")            # a sound, pitch varied a touch

const RATE: int = 22050
static var _cache: Dictionary = {}

# --- Sound ------------------------------------------------------------------

# Plays a named sound from `node`. pitch: base pitch; a little random wobble
# is added so repeats never sound machine-gunned.
static func sfx(node: Node, name: String, pitch: float = 1.0, volume_db: float = -6.0) -> void:
	if node == null or not node.is_inside_tree():
		return
	var stream: AudioStreamWAV = _sound(name)
	if stream == null:
		return
	var p := AudioStreamPlayer.new()
	p.stream = stream
	p.volume_db = volume_db
	p.pitch_scale = maxf(pitch * randf_range(0.94, 1.06), 0.05)
	node.add_child(p)
	p.finished.connect(p.queue_free)
	p.play()

static func _sound(name: String) -> AudioStreamWAV:
	if _cache.has(name):
		return _cache[name]
	var s: PackedFloat32Array
	match name:
		"key":       s = _tone(1200.0, 900.0, 0.035, 0.5, 0.0)
		"pop":       s = _tone(500.0, 1100.0, 0.08, 0.7, 0.0)
		"click":     s = _tone(1800.0, 1400.0, 0.025, 0.5, 0.2)
		"error":     s = _mix(_tone(180.0, 120.0, 0.16, 0.6, 0.0, "square"), _noise(0.08, 0.2))
		"whoosh":    s = _noise(0.22, 0.6, 0.0, true)
		"swish":     s = _noise(0.12, 0.5, 0.0, true)
		"hit":       s = _mix(_noise(0.07, 0.8), _tone(220.0, 90.0, 0.1, 0.8, 0.0))
		"bighit":    s = _mix(_noise(0.16, 1.0), _tone(160.0, 45.0, 0.28, 1.0, 0.0))
		"block":     s = _mix(_tone(900.0, 700.0, 0.06, 0.5, 0.0, "square"), _noise(0.05, 0.3))
		"thud":      s = _tone(120.0, 50.0, 0.16, 0.9, 0.0)
		"coin":      s = _concat(_tone(1320.0, 1320.0, 0.06, 0.5, 0.0), _tone(1760.0, 1760.0, 0.14, 0.5, 0.0))
		"chime":     s = _mix(_tone(880.0, 880.0, 0.5, 0.4, 0.0), _tone(1320.0, 1320.0, 0.5, 0.25, 0.0))
		"plink":     s = _tone(1500.0, 1700.0, 0.09, 0.45, 0.0)
		"splash":    s = _noise(0.35, 0.7, 0.25)
		"rain":      s = _noise(0.5, 0.25, 0.4)
		"grow":      s = _tone(300.0, 700.0, 0.18, 0.5, 0.0, "tri")
		"bonk":      s = _tone(400.0, 160.0, 0.12, 0.7, 0.0, "tri")
		"sink":      s = _concat(_tone(700.0, 300.0, 0.12, 0.6, 0.0), _tone(1046.0, 1046.0, 0.2, 0.4, 0.0))
		"power":     s = _tone(200.0, 1600.0, 0.6, 0.55, 0.0, "square")
		"countdown": s = _tone(660.0, 660.0, 0.14, 0.5, 0.0, "square")
		"go":        s = _tone(990.0, 990.0, 0.3, 0.55, 0.0, "square")
		"fanfare":   s = _concat(_concat(_tone(523.0, 523.0, 0.12, 0.5, 0.0, "square"), _tone(659.0, 659.0, 0.12, 0.5, 0.0, "square")), _tone(784.0, 784.0, 0.4, 0.55, 0.0, "square"))
		"lose":      s = _concat(_tone(392.0, 392.0, 0.18, 0.5, 0.0, "tri"), _tone(262.0, 220.0, 0.45, 0.5, 0.0, "tri"))
		"taunt":     s = _concat(_tone(600.0, 900.0, 0.1, 0.4, 0.0, "tri"), _tone(900.0, 500.0, 0.16, 0.4, 0.0, "tri"))
		"march":     s = _mix(_noise(0.1, 0.4), _tone(140.0, 110.0, 0.1, 0.5, 0.0))
		"capture":   s = _concat(_tone(440.0, 440.0, 0.08, 0.5, 0.0, "square"), _tone(660.0, 660.0, 0.16, 0.5, 0.0, "square"))
		_:           return null
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	var bytes := PackedByteArray()
	bytes.resize(s.size() * 2)
	for i: int in s.size():
		bytes.encode_s16(i * 2, int(clampf(s[i], -1.0, 1.0) * 32000.0))
	w.data = bytes
	_cache[name] = w
	return w

# A pitch sweep from f0 to f1 Hz with a fast attack and a falling tail.
static func _tone(f0: float, f1: float, secs: float, amp: float, attack: float, wave: String = "sine") -> PackedFloat32Array:
	var n: int = int(secs * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var phase: float = 0.0
	for i: int in n:
		var t: float = float(i) / float(n)
		phase += lerpf(f0, f1, t) / RATE
		var x: float = fposmod(phase, 1.0)
		var v: float
		match wave:
			"square": v = 1.0 if x < 0.5 else -1.0
			"tri": v = 4.0 * absf(x - 0.5) - 1.0
			_: v = sin(phase * TAU)
		var env: float = minf(t / maxf(attack, 0.01), 1.0) * pow(1.0 - t, 2.0)
		out[i] = v * env * amp * (0.45 if wave == "square" else 1.0)
	return out

# White noise with a falling tail; `sweep` makes it airy (a whoosh).
static func _noise(secs: float, amp: float, smooth: float = 0.0, sweep: bool = false) -> PackedFloat32Array:
	var n: int = int(secs * RATE)
	var out := PackedFloat32Array()
	out.resize(n)
	var prev: float = 0.0
	for i: int in n:
		var t: float = float(i) / float(n)
		var k: float = smooth if not sweep else lerpf(0.85, 0.2, t)
		prev = lerpf(randf_range(-1.0, 1.0), prev, k)
		var env: float = (sin(t * PI) if sweep else pow(1.0 - t, 2.5))
		out[i] = prev * env * amp
	return out

static func _mix(a: PackedFloat32Array, b: PackedFloat32Array) -> PackedFloat32Array:
	var out := a.duplicate() if a.size() >= b.size() else b.duplicate()
	var other := b if a.size() >= b.size() else a
	for i: int in other.size():
		out[i] += other[i]
	return out

static func _concat(a: PackedFloat32Array, b: PackedFloat32Array) -> PackedFloat32Array:
	var out := a.duplicate()
	out.append_array(b)
	return out

# --- Effects layer ----------------------------------------------------------

# [pos, vel, life, max_life, color, size, gravity, kind]
var parts: Array = []
# [pos, text, life, color, size]
var words: Array = []
# [pos, life, max_life, color, radius]
var rings: Array = []
var _shake: float = 0.0
var flash_color := Color(1, 1, 1, 0)
var font: Font = null

func update(delta: float) -> void:
	for p: Array in parts:
		p[1] += Vector2(0, float(p[6])) * delta
		p[0] += p[1] * delta
		p[1] *= pow(0.25 if p[7] == "dust" else 0.6, delta)
		p[2] -= delta
	parts = parts.filter(func(p: Array) -> bool: return p[2] > 0.0)
	for w: Array in words:
		w[0] += Vector2(0, -70) * delta
		w[2] -= delta
	words = words.filter(func(w: Array) -> bool: return w[2] > 0.0)
	for r: Array in rings:
		r[1] -= delta
	rings = rings.filter(func(r: Array) -> bool: return r[1] > 0.0)
	_shake = maxf(_shake - delta * 2.2, 0.0)
	flash_color.a = maxf(flash_color.a - delta * 3.0, 0.0)

# How far to jolt the view this frame.
func offset() -> Vector2:
	if _shake <= 0.0:
		return Vector2.ZERO
	var m: float = _shake * _shake * 26.0
	return Vector2(randf_range(-m, m), randf_range(-m, m))

func shake(amount: float) -> void:
	_shake = minf(maxf(_shake, amount), 1.0)

func flash(col: Color = Color(1, 1, 1, 0.5)) -> void:
	flash_color = col

# Sparks flying out from a point.
func burst(at: Vector2, col: Color, count: int = 14, speed: float = 320.0, size: float = 5.0, gravity: float = 500.0) -> void:
	for i: int in count:
		var v := Vector2.from_angle(randf() * TAU) * speed * randf_range(0.35, 1.0)
		var life: float = randf_range(0.35, 0.75)
		parts.append([at, v, life, life, col.lightened(randf_range(0.0, 0.3)), size * randf_range(0.6, 1.3), gravity, "spark"])

# Party confetti raining from a point (or a line across the top).
func confetti(at: Vector2, count: int = 60, spread: float = 400.0) -> void:
	var cols: Array[Color] = [Color(1, 0.85, 0.2), Color(0.5, 1, 0.5), Color(0.5, 0.8, 1), Color(1, 0.5, 0.7), Color(1, 0.6, 0.25)]
	for i: int in count:
		var v := Vector2(randf_range(-spread, spread), randf_range(-spread * 1.2, -spread * 0.2))
		var life: float = randf_range(1.2, 2.2)
		parts.append([at, v, life, life, cols[randi() % cols.size()], randf_range(5.0, 9.0), 600.0, "confetti"])

# Puffs of dust kicked up along the ground.
func dust(at: Vector2, col: Color = Color(0.85, 0.8, 0.7), count: int = 8) -> void:
	for i: int in count:
		var v := Vector2(randf_range(-160, 160), randf_range(-120, -20))
		var life: float = randf_range(0.3, 0.6)
		parts.append([at, v, life, life, col, randf_range(5.0, 10.0), 0.0, "dust"])

# Droplets that fall.
func drops(at: Vector2, col: Color = Color(0.5, 0.75, 1.0), count: int = 10) -> void:
	for i: int in count:
		var v := Vector2(randf_range(-140, 140), randf_range(-260, -60))
		var life: float = randf_range(0.4, 0.8)
		parts.append([at, v, life, life, col, randf_range(3.0, 6.0), 900.0, "drop"])

# An expanding ring (impact, ripple, shockwave).
func ring(at: Vector2, col: Color, radius: float = 60.0, secs: float = 0.45) -> void:
	rings.append([at, secs, secs, col, radius])

# A word that pops up and floats.
func text(at: Vector2, s: String, col: Color, size: int = 30) -> void:
	words.append([at, s, 1.0, col, size])

func draw(ci: CanvasItem) -> void:
	for r: Array in rings:
		var k: float = 1.0 - float(r[1]) / float(r[2])
		var c: Color = r[3]
		ci.draw_arc(r[0], float(r[4]) * (0.2 + k), 0.0, TAU, 32, Color(c.r, c.g, c.b, c.a * (1.0 - k)), 4.0 * (1.0 - k) + 1.0)
	for p: Array in parts:
		var a: float = clampf(float(p[2]) / float(p[3]), 0.0, 1.0)
		var c: Color = p[4]
		c.a *= a
		var sz: float = float(p[5])
		match p[7]:
			"confetti":
				var ang: float = float(p[2]) * 9.0
				var d := Vector2.from_angle(ang) * sz
				ci.draw_line(p[0] - d, (p[0] as Vector2) + d, c, sz * 0.7)
			"spark":
				ci.draw_line(p[0], (p[0] as Vector2) - (p[1] as Vector2) * 0.03, c, sz * 0.6)
				ci.draw_circle(p[0], sz * 0.5 * a + 1.0, c)
			"dust":
				ci.draw_circle(p[0], sz * (1.6 - a), Color(c.r, c.g, c.b, c.a * 0.6))
			_:
				ci.draw_circle(p[0], sz * a + 1.0, c)
	if font == null:
		font = ThemeDB.fallback_font
	for w: Array in words:
		var a: float = clampf(float(w[2]) * 2.0, 0.0, 1.0)
		# Pops in big, then settles.
		var pop: float = 1.0 + maxf(float(w[2]) - 0.8, 0.0) * 2.5
		var sz: int = int(float(w[4]) * pop)
		var c: Color = w[3]
		ci.draw_string_outline(font, (w[0] as Vector2) - Vector2(300, 0), w[1], HORIZONTAL_ALIGNMENT_CENTER, 600, sz, 8, Color(0, 0, 0, 0.75 * a))
		ci.draw_string(font, (w[0] as Vector2) - Vector2(300, 0), w[1], HORIZONTAL_ALIGNMENT_CENTER, 600, sz, Color(c.r, c.g, c.b, a))

# A full-screen flash, drawn in screen space (call after resetting transforms).
func draw_flash(ci: CanvasItem, rect: Rect2) -> void:
	if flash_color.a > 0.01:
		ci.draw_rect(rect, flash_color)

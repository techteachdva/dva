class_name CreatureTrials
extends Control

# The minigames My Creature trains with (opened from the Level Up menu).
#   evade  (Speed)      dodge your predator for 20 seconds
#   shove  (Toughness)  time your shoves to push a rival out of the ring
#   feast  (level up)   eat 12 pieces of food in 20 seconds
#   bigfeast (Vitality) eat 18 in 20 seconds, with rotten food about
#   sniff  (Senses)     remember where the food was hidden
#   dance  (Charm)      copy the courtship dance steps
# Move with WASD or the arrow keys, or hold the mouse / a finger where to go.

signal finished(won: bool)

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const Brawl = preload("res://scripts/minigames/predator_brawl.gd")

const ARENA := Vector2(1000, 600)
const INFO: Dictionary = {
	"evade": ["Evade!", "Dodge the %s for 20 seconds. Three bumps and you're out."],
	"shove": ["Shove!", "Press SPACE (or click) when the marker is in the green to shove. Push your rival out of the ring!"],
	"feast": ["Feast!", "Eat 12 pieces of food in 20 seconds. Move with WASD, the arrows, or hold the mouse."],
	"bigfeast": ["Big Feast!", "Eat 18 in 20 seconds. Avoid the rotten brown ones: they slow you down."],
	"sniff": ["Sniff Out!", "Watch where the food hides, then click those tufts. Three rounds; two mistakes and you're out."],
	"dance": ["Courtship Dance!", "Watch the steps, then copy them with the arrow keys or by clicking the arrows. One slip and it's over."],
}
const PREDATOR_OF: Dictionary = {
	"sheep": "wolf", "rabbit": "wolf", "deer": "lion", "goat": "lion", "boar": "wolf", "robin": "falcon",
	"fish": "falcon", "worm": "robin", "beetle": "robin", "wolf": "bear", "lion": "bear", "falcon": "human",
	"bear": "human", "human": "bear",
}

var mode: String = "feast"
var species: String = "sheep"
var tint: Color = Color.WHITE
var rank: int = 0

var _tex: Texture2D
var _foe_tex: Texture2D
var _phase: String = "intro"
var _t: float = 0.0
var _intro_t: float = 2.5
var _me := Vector2(500, 300)
var _foe := Vector2(120, 120)
var _foe_vel := Vector2.ZERO
var _hearts: int = 3
var _invuln: float = 0.0
var _food: Array = []
var _eaten: int = 0
var _spawn_t: float = 0.0
var _slow: float = 0.0
var _ring_me: float = 380.0
var _ring_foe: float = 620.0
var _marker: float = 0.0
var _marker_dir: float = 1.0
var _foe_push_t: float = 1.2
var _tufts: Array = []
var _hidden: Array = []
var _found: Array = []
var _round: int = 0
var _mistakes: int = 0
var _show_t: float = 0.0
var _seq: Array[int] = []
var _input_i: int = 0
var _flash: Array = [-1, 0.0]
var _play_i: int = 0
var _play_t: float = 0.0
var _won: bool = false
var _msg: String = ""
var _keys_prev: Dictionary = {}
var _t_over: float = 0.0

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	theme = FelecoUiScript.theme()
	_tex = Brawl.portrait(species) if SpriteGenerator.SPECIES.has(species) else Brawl.portrait("sheep")
	var foe: String = PREDATOR_OF.get(species, "human") if mode == "evade" else species
	_foe_tex = Brawl.portrait(foe)
	_foe_name = SpeciesDB.label(foe).trim_suffix("s").to_lower() if foe != "wolf" else "wolf"
	match mode:
		"sniff":
			for i: int in 12:
				_tufts.append(Vector2(220 + (i % 4) * 190, 170 + (i / 4) * 150))
		"dance":
			_seq = [randi() % 4, randi() % 4, randi() % 4]
	grab_focus()

var _foe_name: String = "predator"

func _title() -> String:
	return INFO[mode][0]

func _how() -> String:
	var s: String = INFO[mode][1]
	return s % _foe_name if s.contains("%s") else s

# --- Shared input ---------------------------------------------------------

func _move_dir() -> Vector2:
	var d := Vector2.ZERO
	if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): d.x -= 1
	if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): d.x += 1
	if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP): d.y -= 1
	if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN): d.y += 1
	if d == Vector2.ZERO and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		var to: Vector2 = _to_arena(get_local_mouse_position()) - _me
		if to.length() > 12.0:
			d = to
	return d.normalized()

func _xform() -> Transform2D:
	var s: float = minf(size.x / ARENA.x, size.y / ARENA.y) * 0.92
	return Transform2D(Vector2(s, 0), Vector2(0, s), (size - ARENA * s) * 0.5)

func _to_arena(p: Vector2) -> Vector2:
	var x := _xform()
	return (p - x.origin) / x.x.x

func _tapped(name: String, keys: Array) -> bool:
	var now := false
	for k: int in keys:
		now = now or Input.is_physical_key_pressed(k)
	var was: bool = _keys_prev.get(name, false)
	_keys_prev[name] = now
	return now and not was

# --- Loop -----------------------------------------------------------------

func _process(delta: float) -> void:
	queue_redraw()
	if _phase == "intro":
		_intro_t -= delta
		if _intro_t <= 0.0:
			_phase = "play"
		return
	if _phase == "over":
		_t_over += delta
	if _phase != "play":
		return
	_t += delta
	match mode:
		"evade":
			_tick_evade(delta)
		"shove":
			_tick_shove(delta)
		"feast", "bigfeast":
			_tick_feast(delta)
		"sniff":
			_tick_sniff(delta)
		"dance":
			_tick_dance(delta)

func _end(won: bool, msg: String) -> void:
	_phase = "over"
	_won = won
	_msg = msg
	var b := Button.new()
	b.text = "Continue"
	b.theme_type_variation = "PrimaryButton"
	# Anchored to the bottom centre of the screen (offsets, not position, so
	# it can never end up off-screen).
	b.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	b.offset_left = -130
	b.offset_right = 130
	b.offset_top = -140
	b.offset_bottom = -80
	b.pressed.connect(_continue)
	add_child(b)
	b.grab_focus()

var _done: bool = false

# Back to the menu. Also reached by Enter, Space or a click anywhere once
# the result has been up a moment, so a player can never get stuck here.
func _continue() -> void:
	if _done:
		return
	_done = true
	finished.emit(_won)

func _unhandled_input(event: InputEvent) -> void:
	if _phase != "over" or _t_over < 0.6:
		return
	var k := event as InputEventKey
	var mb := event as InputEventMouseButton
	if (k != null and k.pressed and k.physical_keycode in [KEY_ENTER, KEY_SPACE, KEY_ESCAPE, KEY_KP_ENTER]) or (mb != null and mb.pressed):
		_continue()

# Evade: the predator steers after you, faster as time goes on.
func _tick_evade(delta: float) -> void:
	var speed: float = 300.0 * (1.0 + 0.08 * rank)
	_me = (_me + _move_dir() * speed * delta).clamp(Vector2(40, 40), ARENA - Vector2(40, 40))
	var chase: float = lerpf(170.0, 330.0, clampf(_t / 20.0, 0.0, 1.0))
	var want: Vector2 = (_me - _foe).normalized() * chase
	_foe_vel = _foe_vel.lerp(want, delta * 2.2)
	_foe += _foe_vel * delta
	_invuln = maxf(_invuln - delta, 0.0)
	if _invuln <= 0.0 and _me.distance_to(_foe) < 55.0:
		_hearts -= 1
		_invuln = 1.2
		_foe -= _foe_vel.normalized() * 160.0
		_foe_vel = Vector2.ZERO
		if _hearts <= 0:
			_end(false, "Caught! Shake it off and try again.")
			return
	if _t >= 20.0:
		_end(true, "Escaped! Speed trained.")

# Shove: a marker sweeps a bar; shoving in the green moves the rival back.
func _tick_shove(delta: float) -> void:
	var sweep: float = 1.1 + _t * 0.04
	_marker += _marker_dir * sweep * delta
	if _marker > 1.0 or _marker < 0.0:
		_marker_dir = -_marker_dir
		_marker = clampf(_marker, 0.0, 1.0)
	var zone: float = 0.16 + 0.03 * rank
	if _tapped("shove", [KEY_SPACE, KEY_ENTER]) or _tapped("click", []) or (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and not _keys_prev.get("m", false)):
		if absf(_marker - 0.5) < zone * 0.5:
			_ring_me += 55.0
			_ring_foe += 55.0
			_flash = [1, 0.25]
		else:
			_ring_me -= 25.0
			_ring_foe -= 25.0
			_flash = [0, 0.25]
	_keys_prev["m"] = Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	_foe_push_t -= delta
	if _foe_push_t <= 0.0:
		_foe_push_t = maxf(1.0 - _t * 0.02, 0.55)
		_ring_me -= 28.0
		_ring_foe -= 28.0
	_flash[1] = maxf(float(_flash[1]) - delta, 0.0)
	if _ring_foe > 880.0:
		_end(true, "Shoved out! Toughness trained.")
	elif _ring_me < 120.0:
		_end(false, "Pushed out! Get your footing and try again.")
	elif _t > 40.0:
		_end(_ring_me + _ring_foe > 1000.0, "Time! " + ("You held more ground." if _ring_me + _ring_foe > 1000.0 else "Your rival held more ground."))

# Feast: food pops up; walk into it to eat.
func _tick_feast(delta: float) -> void:
	var big: bool = mode == "bigfeast"
	var goal: int = 18 if big else 12
	_slow = maxf(_slow - delta, 0.0)
	var speed: float = 340.0 * (0.45 if _slow > 0.0 else 1.0)
	_me = (_me + _move_dir() * speed * delta).clamp(Vector2(40, 40), ARENA - Vector2(40, 40))
	_spawn_t -= delta
	if _spawn_t <= 0.0 and _food.size() < 7:
		_spawn_t = 0.45 if big else 0.6
		var rotten: bool = big and randf() < 0.3
		_food.append([Vector2(randf_range(60, ARENA.x - 60), randf_range(60, ARENA.y - 60)), rotten, 4.0])
	for f: Array in _food:
		f[2] -= delta
		if _me.distance_to(f[0]) < 48.0:
			f[2] = -1.0
			if f[1]:
				_slow = 1.5
			else:
				_eaten += 1
	_food = _food.filter(func(f: Array) -> bool: return float(f[2]) > 0.0)
	if _eaten >= goal:
		_end(true, "Stuffed! %d eaten." % _eaten)
	elif _t >= 20.0:
		_end(false, "Time's up: %d of %d eaten. Try again!" % [_eaten, goal])

# Sniff: food shows under some tufts, then hides; click where it was.
func _tick_sniff(delta: float) -> void:
	if _hidden.is_empty():
		_round += 1
		if _round > 3:
			_end(true, "Sharp nose! Senses trained.")
			return
		var pool: Array = range(_tufts.size())
		pool.shuffle()
		_hidden = pool.slice(0, _round + 1)
		_found = []
		_show_t = 1.6 + 0.2 * rank
	_show_t -= delta

func _gui_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed or _phase != "play":
		return
	var p := _to_arena(mb.position)
	if mode == "sniff" and _show_t <= 0.0:
		for i: int in _tufts.size():
			if p.distance_to(_tufts[i]) < 60.0 and not _found.has(i):
				if _hidden.has(i):
					_found.append(i)
					if _found.size() == _hidden.size():
						_hidden = []
				else:
					_mistakes += 1
					_flash = [i, 0.4]
					if _mistakes >= 2:
						_end(false, "Wrong tufts! Sniff harder next time.")
				return
	if mode == "dance":
		for k: int in 4:
			if p.distance_to(_pad_pos(k)) < 70.0:
				_dance_press(k)
				return

# Dance: the rival shows a sequence of steps; copy it.
func _pad_pos(k: int) -> Vector2:
	return Vector2(500, 330) + [Vector2(0, -150), Vector2(150, 0), Vector2(0, 150), Vector2(-150, 0)][k]

func _tick_dance(delta: float) -> void:
	_flash[1] = maxf(float(_flash[1]) - delta, 0.0)
	if _play_i < _seq.size():
		_play_t -= delta
		if _play_t <= 0.0:
			_flash = [_seq[_play_i], 0.45]
			_play_i += 1
			_play_t = 0.65
		return
	for k: int in 4:
		var keys: Array = [[KEY_UP, KEY_W], [KEY_RIGHT, KEY_D], [KEY_DOWN, KEY_S], [KEY_LEFT, KEY_A]][k]
		if _tapped("pad%d" % k, keys):
			_dance_press(k)

func _dance_press(k: int) -> void:
	if _play_i < _seq.size() or _phase != "play":
		return
	_flash = [k, 0.25]
	if _seq[_input_i] != k:
		_end(false, "Oops, wrong step! Practise and try again.")
		return
	_input_i += 1
	if _input_i >= _seq.size():
		if _seq.size() >= 6:
			_end(true, "What moves! Charm trained.")
			return
		_seq.append(randi() % 4)
		_input_i = 0
		_play_i = 0
		_play_t = 0.9

# --- Drawing --------------------------------------------------------------

func _sprite(tex: Texture2D, at: Vector2, h: float, flip: bool, col: Color = Color.WHITE) -> void:
	var w: float = h * float(tex.get_width()) / float(tex.get_height())
	draw_set_transform_matrix(_xform() * Transform2D(0.0, Vector2(-1.0 if flip else 1.0, 1.0), 0.0, at))
	draw_texture_rect(tex, Rect2(-w * 0.5, -h * 0.5, w, h), false, col)
	draw_set_transform_matrix(_xform())

func _arrow(c: Vector2, k: int, col: Color) -> void:
	var dirs: Array = [Vector2(0, -1), Vector2(1, 0), Vector2(0, 1), Vector2(-1, 0)]
	var d: Vector2 = dirs[k]
	var side := Vector2(-d.y, d.x)
	draw_colored_polygon(PackedVector2Array([c + d * 46, c + side * 40, c + side * 16, c - d * 40 + side * 16, c - d * 40 - side * 16, c - side * 16, c - side * 40]), col)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.04, 0.06, 0.05, 0.96))
	draw_set_transform_matrix(_xform())
	var font := FelecoUiScript.font("heading")
	draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0.36, 0.56, 0.28) if mode != "dance" else Color(0.25, 0.3, 0.45))
	match mode:
		"evade":
			_sprite(_tex, _me, 90, _move_dir().x < 0.0, tint if fmod(_invuln, 0.2) < 0.1 else Color(1, 1, 1, 0.4))
			_sprite(_foe_tex, _foe, 110, _foe_vel.x < 0.0)
			for k: int in 3:
				draw_circle(Vector2(30 + k * 34, 30), 12, Color(0.95, 0.3, 0.35) if k < _hearts else Color(0.3, 0.3, 0.3))
			draw_string(font, Vector2(0, 40), "%d s" % int(ceil(maxf(20.0 - _t, 0.0))), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, Color.WHITE)
		"shove":
			draw_rect(Rect2(100, 380, 800, 30), Color(0.5, 0.38, 0.22))
			draw_rect(Rect2(100, 380, 20, 30), Color(0.8, 0.2, 0.2))
			draw_rect(Rect2(880, 380, 20, 30), Color(0.8, 0.2, 0.2))
			_sprite(_tex, Vector2(_ring_me, 320), 130, false, tint)
			_sprite(_foe_tex, Vector2(_ring_foe, 320), 130, true, Color(0.85, 0.85, 0.85))
			var bar := Rect2(250, 480, 500, 30)
			draw_rect(bar, Color(0.15, 0.15, 0.15))
			var zone: float = 0.16 + 0.03 * rank
			draw_rect(Rect2(bar.position.x + bar.size.x * (0.5 - zone * 0.5), bar.position.y, bar.size.x * zone, bar.size.y), Color(0.35, 0.85, 0.35))
			draw_rect(Rect2(bar.position.x + bar.size.x * _marker - 4, bar.position.y - 8, 8, bar.size.y + 16), Color.WHITE)
			if float(_flash[1]) > 0.0:
				draw_string(font, Vector2(0, 200), "SHOVE!" if int(_flash[0]) == 1 else "Whiff!", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 48, Color(1, 0.9, 0.3) if int(_flash[0]) == 1 else Color(1, 0.5, 0.4))
		"feast", "bigfeast":
			for f: Array in _food:
				var c: Vector2 = f[0]
				if f[1]:
					draw_circle(c, 18, Color(0.42, 0.3, 0.18))
					draw_circle(c + Vector2(10, -16), 3, Color.BLACK)
				else:
					draw_circle(c, 18, [Color(0.9, 0.15, 0.1), Color(0.45, 0.2, 0.6), Color(0.4, 0.8, 0.3)][int(c.x) % 3])
					draw_circle(c + Vector2(-5, -6), 5, Color(1, 1, 1, 0.5))
			_sprite(_tex, _me, 100, _move_dir().x < 0.0, tint)
			draw_string(font, Vector2(0, 40), "Eaten %d / %d     %d s" % [_eaten, 18 if mode == "bigfeast" else 12, int(ceil(maxf(20.0 - _t, 0.0)))], HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, Color.WHITE)
		"sniff":
			for i: int in _tufts.size():
				var c: Vector2 = _tufts[i]
				var show_food: bool = (_show_t > 0.0 and _hidden.has(i)) or _found.has(i)
				if show_food:
					draw_circle(c, 26, Color(0.9, 0.15, 0.1))
				else:
					var bad: bool = int(_flash[0]) == i and float(_flash[1]) > 0.0
					for k: int in 5:
						draw_line(c + Vector2(-24 + k * 12, 30), c + Vector2(-20 + k * 10, -30), Color(0.8, 0.3, 0.3) if bad else Color(0.25, 0.5, 0.18), 7)
			_flash[1] = maxf(float(_flash[1]) - get_process_delta_time(), 0.0)
			draw_string(font, Vector2(0, 50), ("Remember these!" if _show_t > 0.0 else "Where was the food? Click the tufts.") + "   Round %d of 3" % mini(_round, 3), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 28, Color.WHITE)
		"dance":
			for k: int in 4:
				var lit: bool = int(_flash[0]) == k and float(_flash[1]) > 0.0
				_arrow(_pad_pos(k), k, Color(1, 0.85, 0.3) if lit else Color(0.5, 0.55, 0.7))
			_sprite(_tex, Vector2(500, 330), 110, false, tint)
			draw_string(font, Vector2(0, 50), ("Watch the steps..." if _play_i < _seq.size() else "Your turn! Step %d of %d" % [_input_i + 1, _seq.size()]), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, Color.WHITE)
	if _phase == "intro":
		draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0, 0, 0, 0.6))
		draw_string(font, Vector2(0, 250), _title(), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 64, FelecoUiScript.GOLD)
		draw_string(font, Vector2(60, 330), _how(), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x - 120, 24, Color.WHITE)
		draw_string(font, Vector2(0, 420), "Get ready... %d" % int(ceil(_intro_t)), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, FelecoUiScript.MIST)
	elif _phase == "over":
		draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0, 0, 0, 0.55))
		draw_string(font, Vector2(0, 250), "YOU DID IT!" if _won else "So close!", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 64, Color(0.6, 1.0, 0.5) if _won else Color(1, 0.6, 0.4))
		draw_string(font, Vector2(0, 320), _msg, HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 26, Color.WHITE)
	draw_set_transform_matrix(Transform2D.IDENTITY)

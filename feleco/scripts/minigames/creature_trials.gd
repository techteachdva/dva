class_name CreatureTrials
extends Control

# The minigames My Creature trains with (opened from the Level Up menu).
#   evade  (Speed)      dodge your predator for 20 seconds; dash to slip its lunge
#   shove  (Toughness)  time your shoves to push a rival out of the ring
#   feast  (level up)   eat 12 pieces of your food in 20 seconds
#   bigfeast (Vitality) eat 18 in 20 seconds, with bad food about
#   sniff  (Senses)     remember where the food was hidden
#   dance  (Charm)      copy the courtship dance steps
# Move with WASD or the arrow keys, or hold the mouse / a finger where to go.
# Dash with Space, Shift, a right click, or a tap on your creature.
# Each rank already earned makes the next trial a little sharper: a faster
# hunter, a narrower shove window, more hiding places, a longer dance.
# The food is what the creature really eats in the valley, so the trials
# teach the food web while they train.

signal finished(won: bool)

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const Brawl = preload("res://scripts/minigames/predator_brawl.gd")

const ARENA := Vector2(1000, 600)
const TRIAL_TIME: float = 20.0
const DASH_TIME: float = 0.22
const DASH_COOLDOWN: float = 1.6
const INFO: Dictionary = {
	"evade": ["Evade!", "Dodge the %s for 20 seconds. Three bumps and you're out. Dash (Space) to slip its lunge!"],
	"shove": ["Shove!", "Press SPACE (or click) when the marker is in the green to shove. Push your rival out of the ring!"],
	"feast": ["Feast!", "Eat 12 pieces of food in 20 seconds. Move with WASD, the arrows, or hold the mouse."],
	"bigfeast": ["Big Feast!", "Eat 18 in 20 seconds. Avoid the %s: it slows you down."],
	"sniff": ["Sniff Out!", "Watch where the food hides, then click those tufts. Three rounds; two mistakes and you're out."],
	"dance": ["Courtship Dance!", "Watch the steps, then copy them with the arrow keys or by clicking the arrows. One slip and it's over."],
}
const PREDATOR_OF: Dictionary = {
	"sheep": "wolf", "rabbit": "wolf", "deer": "lion", "goat": "lion", "boar": "wolf", "robin": "falcon",
	"fish": "falcon", "worm": "robin", "beetle": "robin", "wolf": "bear", "lion": "bear", "falcon": "human",
	"bear": "human", "human": "bear", "mushroom": "boar",
}
# What each creature eats in the valley: plants drawn by hand, prey as the
# prey's own sprite. Decomposers eat rot, and their bad food is frost.
const DIET: Dictionary = {
	"sheep": ["grass", "grass", "berry"], "rabbit": ["grass", "grass", "berry"], "deer": ["grass", "apple", "berry"],
	"goat": ["grass", "moss", "berry"], "boar": ["apple", "mushroom", "worm", "rabbit"], "robin": ["worm", "berry", "berry"],
	"human": ["apple", "fish", "mushroom", "berry"], "bear": ["fish", "berry", "apple"], "wolf": ["rabbit", "sheep"],
	"lion": ["deer", "goat", "rabbit"], "falcon": ["robin", "rabbit", "fish"], "fish": ["apple", "berry", "worm"],
	"worm": ["rot", "rot", "apple"], "beetle": ["rot", "rot", "mushroom"], "mushroom": ["rot"],
}
const PLANT_KINDS: Array[String] = ["grass", "berry", "apple", "moss", "mushroom", "rot"]

var mode: String = "feast"
var species: String = "sheep"
var tint: Color = Color.WHITE
var rank: int = 0

var _tex: Texture2D
var _foe_tex: Texture2D
var _prey_tex: Dictionary = {}
var _phase: String = "intro"
var _t: float = 0.0
var _intro_t: float = 2.5
var _me := Vector2(500, 300)
var _face_left: bool = false
var _foe := Vector2(120, 120)
var _foe_vel := Vector2.ZERO
var _hearts: int = 3
var _invuln: float = 0.0
var _dash: float = 0.0
var _dash_cd: float = 0.0
var _dash_dir := Vector2.RIGHT
var _lunge_t: float = 3.0
var _lunge_wind: float = 0.0
var _lunge: float = 0.0
var _hurt_shake: float = 0.0
var _food: Array = []
var _eaten: int = 0
var _spawn_t: float = 0.0
var _slow: float = 0.0
var _streak: int = 0
var _streak_t: float = 0.0
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
var _words: Array = []
var _sparks: Array = []
var _foe_name: String = "predator"
var _bad_name: String = "rotten brown ones"
var _done: bool = false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	process_mode = Node.PROCESS_MODE_ALWAYS
	mouse_filter = Control.MOUSE_FILTER_STOP
	focus_mode = Control.FOCUS_ALL
	theme = FelecoUiScript.theme()
	_tex = Brawl.portrait(species) if SpriteGenerator.SPECIES.has(species) else Brawl.portrait("sheep")
	var foe: String = PREDATOR_OF.get(species, "human") if mode == "evade" else species
	_foe_tex = Brawl.portrait(foe)
	_foe_name = SpeciesDB.one(foe)
	if _is_decomposer():
		_bad_name = "frosty blue ones"
	match mode:
		"sniff":
			for i: int in 12:
				_tufts.append(Vector2(220 + (i % 4) * 190, 170 + (i / 4) * 150))
		"dance":
			_seq = [randi() % 4, randi() % 4, randi() % 4]
		"evade":
			_lunge_t = 3.0
	grab_focus()

func _is_decomposer() -> bool:
	return SpeciesDB.group_of(species) == "decomposer"

func _title() -> String:
	return INFO[mode][0]

func _how() -> String:
	var s: String = INFO[mode][1]
	if s.contains("%s"):
		return s % (_foe_name if mode == "evade" else _bad_name)
	return s

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
	var off: Vector2 = (size - ARENA * s) * 0.5
	if _hurt_shake > 0.0:
		off += Vector2(randf_range(-1, 1), randf_range(-1, 1)) * _hurt_shake * 18.0
	return Transform2D(Vector2(s, 0), Vector2(0, s), off)

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

func _word(at: Vector2, text: String, col: Color, size: int = 26) -> void:
	_words.append([at, text, 0.9, col, size])

func _burst(at: Vector2, col: Color, n: int = 8) -> void:
	for k: int in n:
		_sparks.append([at, Vector2.from_angle(randf() * TAU) * randf_range(120, 320), 0.4, col])

# --- Loop -----------------------------------------------------------------

func _process(delta: float) -> void:
	queue_redraw()
	for w: Array in _words:
		w[2] -= delta
		w[0] += Vector2(0, -50) * delta
	_words = _words.filter(func(w: Array) -> bool: return float(w[2]) > 0.0)
	for s: Array in _sparks:
		s[0] += s[1] * delta
		s[1] *= 0.88
		s[2] -= delta
	_sparks = _sparks.filter(func(s: Array) -> bool: return float(s[2]) > 0.0)
	_hurt_shake = maxf(_hurt_shake - delta * 2.0, 0.0)
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

# --- Evade -----------------------------------------------------------------

# The predator steers after you, faster as time goes on, and every few
# seconds winds up (it flashes) and lunges. A dash slips it.
func _tick_evade(delta: float) -> void:
	var speed: float = 300.0
	var dir: Vector2 = _move_dir()
	if dir.x != 0.0:
		_face_left = dir.x < 0.0
	_dash_cd = maxf(_dash_cd - delta, 0.0)
	var want_dash: bool = _tapped("dash", [KEY_SPACE, KEY_SHIFT, KEY_ENTER]) or (Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT) and not _keys_prev.get("rm", false))
	_keys_prev["rm"] = Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
	if want_dash:
		_try_dash(dir)
	if _dash > 0.0:
		_dash -= delta
		_me += _dash_dir * speed * 2.6 * delta
		_sparks.append([_me + Vector2(randf_range(-20, 20), randf_range(-10, 30)), Vector2.ZERO, 0.25, Color(1, 1, 1, 0.5)])
	else:
		_me += dir * speed * delta
	_me = _me.clamp(Vector2(40, 40), ARENA - Vector2(40, 40))
	# The hunter: a steady chase, with a lunge now and then.
	var chase: float = lerpf(170.0, 320.0, clampf(_t / TRIAL_TIME, 0.0, 1.0)) * (1.0 + 0.06 * rank)
	_lunge_t -= delta
	if _lunge_wind > 0.0:
		_lunge_wind -= delta
		_foe_vel = _foe_vel.lerp(Vector2.ZERO, delta * 6.0)
		if _lunge_wind <= 0.0:
			_lunge = 0.35
			_foe_vel = (_me - _foe).normalized() * 900.0
	elif _lunge > 0.0:
		_lunge -= delta
		if _lunge <= 0.0 and _invuln <= 0.0:
			_word(_foe + Vector2(0, -80), "DODGED!", Color(0.6, 1.0, 0.5))
	else:
		var want: Vector2 = (_me - _foe).normalized() * chase
		_foe_vel = _foe_vel.lerp(want, delta * 2.2)
		if _lunge_t <= 0.0 and _me.distance_to(_foe) < 320.0:
			_lunge_wind = 0.5
			_lunge_t = maxf(3.4 - 0.25 * rank, 2.0)
	_foe += _foe_vel * delta
	_foe = _foe.clamp(Vector2(30, 30), ARENA - Vector2(30, 30))
	_invuln = maxf(_invuln - delta, 0.0)
	if _invuln <= 0.0 and _dash <= 0.0 and _me.distance_to(_foe) < 55.0:
		_hearts -= 1
		_invuln = 1.2
		_hurt_shake = 0.6
		_lunge = 0.0
		_word(_me + Vector2(0, -80), "Ouch!", Color(1, 0.5, 0.4))
		_burst(_me, Color(1, 0.5, 0.4), 10)
		_foe -= _foe_vel.normalized() * 160.0
		_foe_vel = Vector2.ZERO
		if _hearts <= 0:
			_end(false, "Caught! Shake it off and try again.")
			return
	if _t >= TRIAL_TIME:
		_end(true, "Escaped! Speed trained.")

func _try_dash(dir: Vector2) -> void:
	if _dash > 0.0 or _dash_cd > 0.0:
		return
	_dash = DASH_TIME
	_dash_cd = DASH_COOLDOWN
	_dash_dir = dir if dir != Vector2.ZERO else (Vector2.LEFT if _face_left else Vector2.RIGHT)
	_burst(_me, Color(1, 1, 1, 0.8), 6)

# --- Shove --------------------------------------------------------------------

# A marker sweeps a bar; shoving in the green moves the rival back. The
# green shrinks and the marker quickens as Toughness climbs.
func _tick_shove(delta: float) -> void:
	var sweep: float = 1.1 + _t * 0.04 + 0.1 * rank
	_marker += _marker_dir * sweep * delta
	if _marker > 1.0 or _marker < 0.0:
		_marker_dir = -_marker_dir
		_marker = clampf(_marker, 0.0, 1.0)
	var zone: float = _shove_zone()
	if _tapped("shove", [KEY_SPACE, KEY_ENTER]) or (Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and not _keys_prev.get("m", false)):
		if absf(_marker - 0.5) < zone * 0.5:
			var perfect: bool = absf(_marker - 0.5) < zone * 0.15
			var push: float = 70.0 if perfect else 50.0
			_ring_me += push
			_ring_foe += push
			_flash = [1, 0.25]
			_word(Vector2(_ring_foe, 200), "PERFECT!" if perfect else "SHOVE!", Color(1, 0.9, 0.3), 34 if perfect else 28)
			_burst(Vector2(_ring_foe - 40, 320), Color(1, 0.9, 0.3), 10)
			_hurt_shake = 0.3
		else:
			_ring_me -= 25.0
			_ring_foe -= 25.0
			_flash = [0, 0.25]
			_word(Vector2(_ring_me, 200), "Whiff!", Color(1, 0.5, 0.4))
	_keys_prev["m"] = Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	_foe_push_t -= delta
	if _foe_push_t <= 0.0:
		_foe_push_t = maxf(1.0 - _t * 0.02 - 0.05 * rank, 0.5)
		_ring_me -= 28.0
		_ring_foe -= 28.0
		_sparks.append([Vector2(_ring_me + 40, 330), Vector2(-120, -40), 0.3, Color(0.8, 0.75, 0.6)])
	_flash[1] = maxf(float(_flash[1]) - delta, 0.0)
	if _ring_foe > 880.0:
		_end(true, "Shoved out! Toughness trained.")
	elif _ring_me < 120.0:
		_end(false, "Pushed out! Get your footing and try again.")
	elif _t > 40.0:
		_end(_ring_me + _ring_foe > 1000.0, "Time! " + ("You held more ground." if _ring_me + _ring_foe > 1000.0 else "Your rival held more ground."))

func _shove_zone() -> float:
	return maxf(0.2 - 0.02 * rank, 0.1)

# --- Feast ----------------------------------------------------------------

# Food pops up; walk into it to eat. Quick bites in a row make a streak.
func _tick_feast(delta: float) -> void:
	var big: bool = mode == "bigfeast"
	var goal: int = _feast_goal()
	_slow = maxf(_slow - delta, 0.0)
	_streak_t = maxf(_streak_t - delta, 0.0)
	if _streak_t <= 0.0:
		_streak = 0
	var speed: float = 340.0 * (0.45 if _slow > 0.0 else 1.0)
	var dir: Vector2 = _move_dir()
	if dir.x != 0.0:
		_face_left = dir.x < 0.0
	_me = (_me + dir * speed * delta).clamp(Vector2(40, 40), ARENA - Vector2(40, 40))
	_spawn_t -= delta
	if _spawn_t <= 0.0 and _food.size() < 7:
		_spawn_t = 0.45 if big else 0.6
		var bad: bool = big and randf() < 0.3 + 0.04 * rank
		var diet: Array = DIET.get(species, ["grass"])
		_food.append([Vector2(randf_range(60, ARENA.x - 60), randf_range(60, ARENA.y - 60)), bad, 4.0, String(diet[randi() % diet.size()])])
	for f: Array in _food:
		f[2] -= delta
		if _me.distance_to(f[0]) < 48.0:
			f[2] = -1.0
			if f[1]:
				_slow = 1.5
				_word(f[0] + Vector2(0, -40), "Yuck!", Color(0.7, 0.8, 1.0) if _is_decomposer() else Color(0.8, 0.6, 0.4))
				_burst(f[0], Color(0.6, 0.7, 0.9) if _is_decomposer() else Color(0.5, 0.35, 0.2), 6)
			else:
				_eaten += 1
				_streak += 1
				_streak_t = 1.3
				_word(f[0] + Vector2(0, -40), "+1" if _streak < 3 else "+1  x%d streak!" % _streak, Color(0.6, 1.0, 0.5) if _streak < 3 else Color(1, 0.9, 0.3), 24 if _streak < 3 else 28)
				_burst(f[0], Color(0.6, 1.0, 0.5), 8)
	_food = _food.filter(func(f: Array) -> bool: return float(f[2]) > 0.0)
	if _eaten >= goal:
		_end(true, "Stuffed! %d eaten." % _eaten)
	elif _t >= TRIAL_TIME:
		_end(false, "Time's up: %d of %d eaten. Try again!" % [_eaten, goal])

func _feast_goal() -> int:
	return 18 if mode == "bigfeast" else 12

# --- Sniff ------------------------------------------------------------------

# Food shows under some tufts, then hides; click where it was. More hiding
# places, shown for less time, as Senses climbs.
func _tick_sniff(delta: float) -> void:
	if _hidden.is_empty():
		_round += 1
		if _round > 3:
			_end(true, "Sharp nose! Senses trained.")
			return
		var pool: Array = range(_tufts.size())
		pool.shuffle()
		_hidden = pool.slice(0, mini(_round + 1 + rank / 2, 6))
		_found = []
		_show_t = maxf(1.7 - 0.12 * rank, 1.0) + 0.15 * _hidden.size()
	_show_t -= delta

func _gui_input(event: InputEvent) -> void:
	var mb := event as InputEventMouseButton
	if mb == null or not mb.pressed or _phase != "play":
		return
	var p := _to_arena(mb.position)
	if mode == "evade" and mb.button_index == MOUSE_BUTTON_LEFT and p.distance_to(_me) < 50.0:
		# A tap on your own creature dashes (for touch screens).
		_try_dash(_move_dir())
		return
	if mode == "sniff" and _show_t <= 0.0:
		for i: int in _tufts.size():
			if p.distance_to(_tufts[i]) < 60.0 and not _found.has(i):
				if _hidden.has(i):
					_found.append(i)
					_word(_tufts[i] + Vector2(0, -50), "Found!", Color(0.6, 1.0, 0.5))
					_burst(_tufts[i], Color(0.6, 1.0, 0.5), 8)
					if _found.size() == _hidden.size():
						_hidden = []
				else:
					_mistakes += 1
					_flash = [i, 0.4]
					_hurt_shake = 0.4
					_word(_tufts[i] + Vector2(0, -50), "Nothing here..." if _mistakes < 2 else "Oops!", Color(1, 0.5, 0.4))
					if _mistakes >= 2:
						_end(false, "Wrong tufts! Sniff harder next time.")
				return
	if mode == "dance":
		for k: int in 4:
			if p.distance_to(_pad_pos(k)) < 70.0:
				_dance_press(k)
				return

# --- Dance ------------------------------------------------------------------

# The rival shows a sequence of steps; copy it. The dance grows a step each
# time, and a trained dancer must learn a longer one.
func _pad_pos(k: int) -> Vector2:
	return Vector2(500, 330) + [Vector2(0, -150), Vector2(150, 0), Vector2(0, 150), Vector2(-150, 0)][k]

func _dance_goal() -> int:
	return 6 + rank / 2

func _tick_dance(delta: float) -> void:
	_flash[1] = maxf(float(_flash[1]) - delta, 0.0)
	if _play_i < _seq.size():
		_play_t -= delta
		if _play_t <= 0.0:
			_flash = [_seq[_play_i], 0.45]
			_play_i += 1
			_play_t = maxf(0.65 - 0.04 * rank, 0.4)
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
		_hurt_shake = 0.5
		_end(false, "Oops, wrong step! Practise and try again.")
		return
	_burst(_pad_pos(k), Color(1, 0.85, 0.3), 6)
	_input_i += 1
	if _input_i >= _seq.size():
		if _seq.size() >= _dance_goal():
			_end(true, "What moves! Charm trained.")
			return
		_word(Vector2(500, 120), "%d steps!" % _seq.size(), Color(1, 0.9, 0.3))
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

# A piece of food, drawn as what it is.
func _draw_food(c: Vector2, kind: String, bad: bool) -> void:
	if bad:
		if _is_decomposer():
			# Frost: a pale blue crystal.
			draw_colored_polygon(PackedVector2Array([c + Vector2(0, -20), c + Vector2(16, 0), c + Vector2(0, 20), c + Vector2(-16, 0)]), Color(0.75, 0.88, 1.0))
			draw_line(c + Vector2(-8, -8), c + Vector2(8, 8), Color(1, 1, 1, 0.7), 2.0)
		else:
			# Rotten: a brown lump with a fly.
			draw_circle(c, 18, Color(0.42, 0.3, 0.18))
			draw_circle(c + Vector2(6, 4), 5, Color(0.3, 0.5, 0.25))
			draw_circle(c + Vector2(12, -18 + 3 * sin(_t * 9.0)), 3, Color.BLACK)
		return
	if not PLANT_KINDS.has(kind):
		# Prey: the creature's own sprite, small.
		if not _prey_tex.has(kind):
			_prey_tex[kind] = Brawl.portrait(kind) if SpriteGenerator.SPECIES.has(kind) else Brawl.portrait("rabbit")
		_sprite(_prey_tex[kind], c, 52, false)
		return
	match kind:
		"grass":
			for k: int in 4:
				draw_line(c + Vector2(-12 + k * 8, 16), c + Vector2(-14 + k * 9 + 3 * sin(_t * 3.0 + k), -18), Color(0.35, 0.72, 0.25), 5.0)
		"berry":
			for o: Vector2 in [Vector2(-9, 4), Vector2(9, 4), Vector2(0, -8)]:
				draw_circle(c + o, 10, Color(0.45, 0.2, 0.6))
				draw_circle(c + o + Vector2(-3, -3), 3, Color(1, 1, 1, 0.5))
		"apple":
			draw_circle(c, 17, Color(0.9, 0.15, 0.1))
			draw_line(c + Vector2(0, -14), c + Vector2(3, -24), Color(0.4, 0.25, 0.1), 3.0)
			draw_circle(c + Vector2(-5, -6), 5, Color(1, 1, 1, 0.45))
		"moss":
			draw_circle(c, 16, Color(0.3, 0.55, 0.25))
			for k: int in 5:
				draw_circle(c + Vector2.from_angle(k * 1.3) * 11, 6, Color(0.42, 0.7, 0.32))
		"mushroom":
			draw_rect(Rect2(c + Vector2(-5, 0), Vector2(10, 16)), Color(0.95, 0.9, 0.8))
			draw_circle(c + Vector2(0, -2), 16, Color(0.8, 0.25, 0.25))
			draw_circle(c + Vector2(-6, -8), 3, Color.WHITE)
			draw_circle(c + Vector2(6, -4), 3, Color.WHITE)
		"rot":
			draw_circle(c, 18, Color(0.45, 0.32, 0.2))
			draw_circle(c + Vector2(5, -4), 7, Color(0.6, 0.45, 0.5))
			draw_circle(c + Vector2(-7, 5), 5, Color(0.55, 0.4, 0.3))

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.04, 0.06, 0.05, 0.96))
	draw_set_transform_matrix(_xform())
	var font := FelecoUiScript.font("heading")
	draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0.36, 0.56, 0.28) if mode != "dance" else Color(0.25, 0.3, 0.45))
	match mode:
		"evade":
			var flashing: bool = _lunge_wind > 0.0 and fmod(_lunge_wind, 0.12) < 0.06
			_sprite(_tex, _me, 90, _face_left, tint if fmod(_invuln, 0.2) < 0.1 else Color(1, 1, 1, 0.4))
			_sprite(_foe_tex, _foe, 110, _foe_vel.x < 0.0, Color(1.6, 0.6, 0.5) if flashing else Color.WHITE)
			if _lunge_wind > 0.0:
				draw_string(font, _foe + Vector2(-60, -75), "!", HORIZONTAL_ALIGNMENT_CENTER, 120, 40, Color(1, 0.4, 0.3))
			for k: int in 3:
				draw_circle(Vector2(30 + k * 34, 30), 12, Color(0.95, 0.3, 0.35) if k < _hearts else Color(0.3, 0.3, 0.3))
			# Dash charge.
			var dash_bar := Rect2(ARENA.x - 190, 20, 160, 14)
			draw_rect(dash_bar, Color(0, 0, 0, 0.4))
			draw_rect(Rect2(dash_bar.position, Vector2(dash_bar.size.x * (1.0 - _dash_cd / DASH_COOLDOWN), dash_bar.size.y)), Color(1, 1, 1, 0.9) if _dash_cd <= 0.0 else Color(0.7, 0.8, 1.0, 0.7))
			draw_string(font, Vector2(ARENA.x - 190, 52), "DASH (Space)", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1, 1, 1, 0.8))
			draw_string(font, Vector2(0, 40), "%d s" % int(ceil(maxf(TRIAL_TIME - _t, 0.0))), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, Color.WHITE)
		"shove":
			draw_rect(Rect2(100, 380, 800, 30), Color(0.5, 0.38, 0.22))
			draw_rect(Rect2(100, 380, 20, 30), Color(0.8, 0.2, 0.2))
			draw_rect(Rect2(880, 380, 20, 30), Color(0.8, 0.2, 0.2))
			_sprite(_tex, Vector2(_ring_me, 320), 130, false, tint)
			_sprite(_foe_tex, Vector2(_ring_foe, 320), 130, true, Color(0.85, 0.85, 0.85))
			var bar := Rect2(250, 480, 500, 30)
			draw_rect(bar, Color(0.15, 0.15, 0.15))
			var zone: float = _shove_zone()
			draw_rect(Rect2(bar.position.x + bar.size.x * (0.5 - zone * 0.5), bar.position.y, bar.size.x * zone, bar.size.y), Color(0.35, 0.85, 0.35))
			draw_rect(Rect2(bar.position.x + bar.size.x * (0.5 - zone * 0.15), bar.position.y, bar.size.x * zone * 0.3, bar.size.y), Color(0.6, 1.0, 0.5))
			draw_rect(Rect2(bar.position.x + bar.size.x * _marker - 4, bar.position.y - 8, 8, bar.size.y + 16), Color.WHITE)
			draw_string(font, Vector2(0, 545), "SPACE or click in the green. Rank %d: the green is narrower." % rank if rank > 0 else "SPACE or click when the marker is in the green.", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 16, Color(1, 1, 1, 0.75))
		"feast", "bigfeast":
			for f: Array in _food:
				_draw_food(f[0], String(f[3]), bool(f[1]))
			_sprite(_tex, _me, 100, _face_left, tint)
			draw_string(font, Vector2(0, 40), "Eaten %d / %d     %d s" % [_eaten, _feast_goal(), int(ceil(maxf(TRIAL_TIME - _t, 0.0)))], HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, Color.WHITE)
			if _slow > 0.0:
				draw_string(font, Vector2(0, 70), "Slowed!", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 20, Color(1, 0.6, 0.5))
		"sniff":
			for i: int in _tufts.size():
				var c: Vector2 = _tufts[i]
				var show_food: bool = (_show_t > 0.0 and _hidden.has(i)) or _found.has(i)
				if show_food:
					var diet: Array = DIET.get(species, ["grass"])
					_draw_food(c, String(diet[i % diet.size()]), false)
				else:
					var bad: bool = int(_flash[0]) == i and float(_flash[1]) > 0.0
					for k: int in 5:
						draw_line(c + Vector2(-24 + k * 12, 30), c + Vector2(-20 + k * 10, -30), Color(0.8, 0.3, 0.3) if bad else Color(0.25, 0.5, 0.18), 7)
			_flash[1] = maxf(float(_flash[1]) - get_process_delta_time(), 0.0)
			var head: String = "Remember these!" if _show_t > 0.0 else "Where was the food? Click the tufts (%d left)." % (_hidden.size() - _found.size())
			draw_string(font, Vector2(0, 50), head + "   Round %d of 3" % mini(_round, 3), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 28, Color.WHITE)
			if _show_t > 0.0:
				draw_rect(Rect2(300, 70, 400, 8), Color(0, 0, 0, 0.4))
				draw_rect(Rect2(300, 70, 400 * clampf(_show_t / 2.5, 0.0, 1.0), 8), Color(1, 0.9, 0.3))
		"dance":
			for k: int in 4:
				var lit: bool = int(_flash[0]) == k and float(_flash[1]) > 0.0
				_arrow(_pad_pos(k), k, Color(1, 0.85, 0.3) if lit else Color(0.5, 0.55, 0.7))
			_sprite(_tex, Vector2(500, 330), 110, false, tint)
			draw_string(font, Vector2(0, 50), ("Watch the steps..." if _play_i < _seq.size() else "Your turn! Step %d of %d" % [_input_i + 1, _seq.size()]), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, Color.WHITE)
			draw_string(font, Vector2(0, 80), "Dance %d steps to win." % _dance_goal(), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 16, Color(1, 1, 1, 0.7))
	for s: Array in _sparks:
		draw_circle(s[0], 4.0 * float(s[2]) / 0.4 + 1.0, s[3])
	for w: Array in _words:
		var a: float = clampf(float(w[2]), 0.0, 1.0)
		draw_string_outline(font, (w[0] as Vector2) - Vector2(120, 0), w[1], HORIZONTAL_ALIGNMENT_CENTER, 240, int(w[4]), 6, Color(0, 0, 0, a))
		draw_string(font, (w[0] as Vector2) - Vector2(120, 0), w[1], HORIZONTAL_ALIGNMENT_CENTER, 240, int(w[4]), Color(w[3], a))
	if _phase == "intro":
		draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0, 0, 0, 0.6))
		draw_string(font, Vector2(0, 250), _title(), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 64, FelecoUiScript.GOLD)
		draw_string(font, Vector2(60, 330), _how(), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x - 120, 24, Color.WHITE)
		if rank > 0:
			draw_string(font, Vector2(0, 380), "Rank %d trial: a little harder than last time." % (rank + 1), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 20, FelecoUiScript.MIST)
		draw_string(font, Vector2(0, 430), "Get ready... %d" % int(ceil(_intro_t)), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 30, FelecoUiScript.MIST)
	elif _phase == "over":
		draw_rect(Rect2(Vector2.ZERO, ARENA), Color(0, 0, 0, 0.55))
		draw_string(font, Vector2(0, 250), "YOU DID IT!" if _won else "So close!", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 64, Color(0.6, 1.0, 0.5) if _won else Color(1, 0.6, 0.4))
		draw_string(font, Vector2(0, 320), _msg, HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 26, Color.WHITE)
	draw_set_transform_matrix(Transform2D.IDENTITY)

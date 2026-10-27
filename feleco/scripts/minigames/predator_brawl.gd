extends Control

# Carnivore campaign: Predator Brawl. A kid-friendly 2D fighter between the
# valley's hunters. Pick a fighter, then beat the ladder (each rival, then a
# Dire champion), best of three rounds each.
#   Move  A / D or Left / Right     Jump  W or Up     Block  hold S or Down
#   Light J (chain J J J)           Heavy K           Special L
#   Combo J J K: a finisher         EVOLVE (meter full): Down, Fwd, Down, Fwd, then L
# Evolving turns the fighter Dire: bigger, golden, faster and harder hitting,
# with RAMPAGE! shaking across the screen.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const ARENA := Vector2(1280, 720)
const GROUND: float = 610.0
const GRAVITY: float = 2300.0
const ROUND_TIME: float = 60.0
const DIRE_TIME: float = 12.0
const PLATFORMS: Array = [Rect2(250, 450, 220, 18), Rect2(810, 450, 220, 18)]

# Fighter sheets: [speed, jump, weight, light dmg, heavy dmg, special name,
# special description, look size].
const FIGHTERS: Dictionary = {
	"wolf": {"name": "Wolf", "speed": 430.0, "jump": 900.0, "air_jumps": 0, "light": 6.0, "heavy": 13.0,
		"stats": [5, 3, 2], "special": "Howl Dash", "about": "Quick and scrappy. Howl Dash zips through the rival, nipping all the way.", "size": 230.0},
	"lion": {"name": "Mountain Lion", "speed": 380.0, "jump": 1000.0, "air_jumps": 0, "light": 7.0, "heavy": 16.0,
		"stats": [3, 5, 2], "special": "Pounce", "about": "Powerful and patient. Pounce leaps high and lands paws-first.", "size": 260.0},
	"falcon": {"name": "Falcon", "speed": 400.0, "jump": 820.0, "air_jumps": 2, "light": 5.0, "heavy": 12.0,
		"stats": [4, 2, 5], "special": "Dive Bomb", "about": "Light and flighty: jumps three times. Dive Bomb stoops from the sky.", "size": 210.0},
}
const HIT_WORDS: Array[String] = ["BONK!", "POW!", "THWAP!", "CHOMP!", "BOOP!", "WHAM!", "SNAP!", "OOF!"]

class Fighter:
	var species: String
	var sheet: Dictionary
	var tex: Texture2D
	var pos: Vector2
	var vel: Vector2 = Vector2.ZERO
	var facing: float = 1.0
	var hp: float = 100.0
	var meter: float = 0.0
	var state: String = "idle"
	var state_t: float = 0.0
	var on_ground: bool = true
	var air_jumps_left: int = 0
	var blocking: bool = false
	var dire: float = 0.0
	var chain: int = 0
	var chain_t: float = 0.0
	var hit_done: bool = false
	var combo: int = 0
	var cpu: bool = false
	var inputs: Array = []
	var flash: float = 0.0
	func dmg_mult() -> float:
		return 1.5 if dire > 0.0 else 1.0
	func scale() -> float:
		return 1.35 if dire > 0.0 else 1.0

var _p1: Fighter
var _p2: Fighter
var _ladder: Array = []
var _stage: int = 0
var _round: int = 1
var _wins: Vector2i = Vector2i.ZERO
var _timer: float = ROUND_TIME
var _mode: String = "select"
var _banner: String = ""
var _banner_t: float = 0.0
var _shake: float = 0.0
var _words: Array = []
var _sparks: Array = []
var _rampage_t: float = 0.0
var _pause_t: float = 0.0
# Impact freeze (a few frames on every hit) and the final-blow slow motion.
var _hitstop: float = 0.0
var _slowmo: float = 0.0
var _paused: bool = false
var _pause_box: Control
var _select: Control
var _cpu_think: float = 0.0
var _keys_prev: Dictionary = {}
var _portraits: Array[Control] = []
# Attract mode / tests: the computer plays both sides.
var demo: bool = false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = FelecoUiScript.theme()
	focus_mode = Control.FOCUS_ALL
	_show_select()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "brawl"):
		HowToPlay.show(self, "brawl")

# --- Character select ---------------------------------------------------

func _show_select() -> void:
	_mode = "select"
	if _select != null:
		_select.queue_free()
	_select = PanelContainer.new()
	_select.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_select)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 16)
	_select.add_child(col)
	var t := FelecoUiScript.heading("Predator Brawl", 48, FelecoUiScript.GOLD)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var sub := FelecoUiScript.label("Pick your hunter. Beat every rival, then the Dire champion.", 20, FelecoUiScript.CREAM)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(sub)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	col.add_child(row)
	var gc: Node = get_node_or_null("/root/GameConfig")
	for sp: String in FIGHTERS.keys():
		var card := VBoxContainer.new()
		card.custom_minimum_size = Vector2(300, 0)
		row.add_child(card)
		var pic := Control.new()
		pic.custom_minimum_size = Vector2(300, 260)
		var who: String = sp
		pic.draw.connect(func() -> void:
			FighterArt.set_base(pic, Transform2D(0.0, Vector2(150, 250)))
			FighterArt.paint(pic, who, "idle", Time.get_ticks_msec() / 1000.0, 21.0))
		pic.set_process(true)
		card.add_child(pic)
		_portraits.append(pic)
		var f: Dictionary = FIGHTERS[sp]
		var champ = gc.record("brawl", sp) if gc != null else null
		card.add_child(FelecoUiScript.heading(f["name"] + ("  (Champion!)" if champ != null else ""), 24, FelecoUiScript.GOLD))
		var about := FelecoUiScript.label("%s\nSpecial: %s" % [f["about"], f["special"]], 15, FelecoUiScript.MIST)
		about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		card.add_child(about)
		# Speed, power and air at a glance.
		for k: int in 3:
			var row2 := HBoxContainer.new()
			var lbl := FelecoUiScript.label(["Speed", "Power", "Air"][k], 14, FelecoUiScript.CREAM)
			lbl.custom_minimum_size = Vector2(70, 0)
			row2.add_child(lbl)
			var bar := ProgressBar.new()
			bar.max_value = 5
			bar.value = (f["stats"] as Array)[k]
			bar.show_percentage = false
			bar.custom_minimum_size = Vector2(200, 12)
			bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			row2.add_child(bar)
			card.add_child(row2)
		var b := Button.new()
		b.text = "Fight as %s" % f["name"]
		b.theme_type_variation = "PrimaryButton"
		b.custom_minimum_size = Vector2(0, 50)
		b.pressed.connect(func() -> void: _start_ladder(sp))
		card.add_child(b)
	var keys := FelecoUiScript.label("Move A/D   Jump W   Block hold S   Light J   Heavy K   Special L\nCombo: J J K     EVOLVE when your meter is full: Down, Forward, Down, Forward, then L", 17, FelecoUiScript.CREAM)
	keys.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(keys)
	var back := Button.new()
	back.text = "Back"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(200, 48)
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn"))
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "brawl")
	bc.add_child(back)
	col.add_child(bc)

func _start_ladder(sp: String) -> void:
	_select.queue_free()
	_select = null
	_ladder = []
	for o: String in FIGHTERS.keys():
		if o != sp:
			_ladder.append([o, false])
	# The last rival is a Dire version of yourself.
	_ladder.append([sp, true])
	_stage = 0
	_p1 = _make(sp, false)
	_start_match()
	grab_focus()

# One creature cut from the species sheet (its first, plain variant).
static func portrait(sp: String) -> Texture2D:
	var at := AtlasTexture.new()
	at.atlas = SpriteGenerator.texture_for(sp)
	var cell: Vector2i = SpriteGenerator.cell_size(sp)
	at.region = Rect2(0, 0, cell.x, cell.y)
	return at

func _make(sp: String, cpu: bool) -> Fighter:
	var f := Fighter.new()
	f.species = sp
	f.sheet = FIGHTERS[sp]
	f.tex = portrait(sp)
	f.cpu = cpu
	return f

func _start_match() -> void:
	var rival: Array = _ladder[_stage]
	_p2 = _make(rival[0], true)
	_p2.set_meta("boss", rival[1])
	_round = 1
	_wins = Vector2i.ZERO
	_start_round()

func _start_round() -> void:
	for f: Fighter in [_p1, _p2]:
		f.hp = 100.0
		f.vel = Vector2.ZERO
		f.state = "idle"
		f.dire = 0.0
		f.combo = 0
		f.inputs.clear()
	_p1.pos = Vector2(360, GROUND)
	_p1.facing = 1.0
	_p2.pos = Vector2(920, GROUND)
	_p2.facing = -1.0
	# The champion arrives already Dire.
	if _p2.get_meta("boss", false):
		_p2.dire = 999.0
	_timer = ROUND_TIME
	_mode = "intro"
	_pause_t = 1.6
	var rival: String = FIGHTERS[_p2.species]["name"]
	_announce("%sRound %d  -  vs %s" % ["CHAMPION! " if _p2.get_meta("boss", false) else "", _round, rival], 1.6)

func _announce(text: String, secs: float) -> void:
	_banner = text
	_banner_t = secs

# --- Input --------------------------------------------------------------

func _pressed(keys: Array) -> bool:
	for k: int in keys:
		if Input.is_physical_key_pressed(k):
			return true
	return false

func _tapped(name: String, keys: Array) -> bool:
	var now: bool = _pressed(keys)
	var was: bool = _keys_prev.get(name, false)
	_keys_prev[name] = now
	return now and not was

func _player_input(f: Fighter, delta: float) -> void:
	var left: bool = _pressed([KEY_A, KEY_LEFT])
	var right: bool = _pressed([KEY_D, KEY_RIGHT])
	var down: bool = _pressed([KEY_S, KEY_DOWN])
	var jump: bool = _tapped("jump", [KEY_W, KEY_UP, KEY_SPACE])
	var light: bool = _tapped("light", [KEY_J, KEY_Z])
	var heavy: bool = _tapped("heavy", [KEY_K, KEY_X])
	var special: bool = _tapped("special", [KEY_L, KEY_C])
	# Directions for the evolution motion, relative to facing.
	if _tapped("down", [KEY_S, KEY_DOWN]):
		f.inputs.append(["D", 0.0])
	var fwd_keys: Array = [KEY_D, KEY_RIGHT] if f.facing > 0.0 else [KEY_A, KEY_LEFT]
	if _tapped("fwd", fwd_keys):
		f.inputs.append(["F", 0.0])
	_control(f, (1.0 if right else 0.0) - (1.0 if left else 0.0), jump, down, light, heavy, special, delta)

func _evolve_ready(f: Fighter) -> bool:
	# Down, Forward, Down, Forward within a couple of seconds.
	var seq: String = ""
	for i in f.inputs:
		seq += String(i[0])
	return seq.ends_with("DFDF")

func _control(f: Fighter, move: float, jump: bool, block: bool, light: bool, heavy: bool, special: bool, _delta: float) -> void:
	var busy: bool = f.state in ["light", "heavy", "special", "hurt", "ko", "evolve"]
	f.blocking = block and f.on_ground and not busy
	if not busy and not f.blocking:
		f.vel.x = move * float(f.sheet["speed"]) * (1.15 if f.dire > 0.0 else 1.0)
		if move != 0.0:
			f.state = "walk" if f.on_ground else f.state
		elif f.on_ground:
			f.state = "idle"
	elif f.blocking:
		f.vel.x = 0.0
		f.state = "block"
	if jump and not busy:
		if f.on_ground:
			f.vel.y = -float(f.sheet["jump"])
			f.on_ground = false
			f.air_jumps_left = int(f.sheet["air_jumps"])
			_dust(f.pos)
		elif f.air_jumps_left > 0:
			f.air_jumps_left -= 1
			f.vel.y = -float(f.sheet["jump"]) * 0.85
	if special and f.meter >= 100.0 and _evolve_ready(f) and f.dire <= 0.0:
		_evolve(f)
		return
	if busy:
		return
	if light:
		# Light hits chain three times; a heavy straight after two is the finisher.
		f.chain = f.chain + 1 if f.chain_t > 0.0 and f.chain < 3 else 1
		_begin(f, "light")
	elif heavy:
		f.set_meta("finisher", f.chain >= 2 and f.chain_t > 0.0)
		f.chain = 0
		_begin(f, "heavy")
	elif special and f.meter >= 25.0:
		f.meter -= 25.0
		_begin(f, "special")

func _begin(f: Fighter, s: String) -> void:
	f.state = s
	f.state_t = 0.0
	f.hit_done = false
	if f.on_ground:
		f.vel.x = 0.0
	if s == "special":
		match f.species:
			"wolf":
				f.vel.x = f.facing * 1100.0
			"lion":
				f.vel = Vector2(f.facing * 560.0, -950.0)
				f.on_ground = false
			"falcon":
				f.vel = Vector2(f.facing * 200.0, -900.0)
				f.on_ground = false

func _evolve(f: Fighter) -> void:
	f.meter = 0.0
	f.dire = DIRE_TIME
	f.inputs.clear()
	f.state = "evolve"
	f.state_t = 0.0
	f.hp = minf(f.hp + 20.0, 100.0)
	_rampage_t = 2.2
	_shake = 0.7
	_announce("%s EVOLVES!" % String(FIGHTERS[f.species]["name"]).to_upper(), 1.6)

# --- The CPU rival --------------------------------------------------------

func _cpu_input(f: Fighter, foe: Fighter, delta: float) -> void:
	_cpu_think -= delta
	var dist: float = foe.pos.x - f.pos.x
	var near: bool = absf(dist) < 150.0
	var level: float = 0.55 + 0.15 * _stage
	var move: float = 0.0
	var jump := false
	var block := false
	var light := false
	var heavy := false
	var special := false
	if f.state in ["hurt", "ko", "evolve"]:
		_control(f, 0.0, false, false, false, false, false, delta)
		return
	if not near:
		move = signf(dist)
		jump = randf() < 0.008 + (0.03 if foe.pos.y < f.pos.y - 80.0 else 0.0)
	if _cpu_think <= 0.0:
		_cpu_think = randf_range(0.18, 0.4) / level
		if near:
			var r: float = randf()
			if foe.state in ["light", "heavy", "special"] and r < 0.45 * level:
				block = true
			elif r < 0.55:
				light = true
			elif r < 0.8:
				heavy = true
			elif f.meter >= 25.0:
				special = true
			else:
				move = -signf(dist)
		elif f.meter >= 60.0 and randf() < 0.3:
			special = true
		# Evolves when it can (the champion already is).
		if f.meter >= 100.0 and f.dire <= 0.0 and randf() < 0.5:
			f.inputs = [["D", 0.0], ["F", 0.0], ["D", 0.0], ["F", 0.0]]
			special = true
	_control(f, move, jump, block, light, heavy, special, delta)

# --- Simulation -----------------------------------------------------------

func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k != null and k.pressed and not k.echo and k.physical_keycode == KEY_ESCAPE and _mode in ["fight", "intro", "roundover"]:
		_toggle_pause()

func _quit_to_select() -> void:
	_toggle_pause()
	_show_select()

func _toggle_pause() -> void:
	_paused = not _paused
	if _paused:
		_pause_box = VBoxContainer.new()
		_pause_box.set_anchors_preset(Control.PRESET_CENTER)
		_pause_box.add_theme_constant_override("separation", 12)
		add_child(_pause_box)
		_pause_box.add_child(FelecoUiScript.heading("Paused", 40, FelecoUiScript.GOLD))
		for b: Array in [["Resume", _toggle_pause], ["Quit to fighters", _quit_to_select]]:
			var btn := Button.new()
			btn.text = b[0]
			btn.custom_minimum_size = Vector2(260, 50)
			btn.pressed.connect(b[1])
			_pause_box.add_child(btn)
	elif _pause_box != null:
		_pause_box.queue_free()
		_pause_box = null

func _process(real_delta: float) -> void:
	if _paused:
		queue_redraw()
		return
	_slowmo = maxf(_slowmo - real_delta, 0.0)
	var delta: float = real_delta * (0.3 if _slowmo > 0.0 else 1.0)
	if _hitstop > 0.0:
		_hitstop -= real_delta
		queue_redraw()
		return
	_banner_t -= delta
	_rampage_t -= delta
	_shake = maxf(_shake - delta * 1.5, 0.0)
	for w: Array in _words:
		w[2] -= delta
		w[0] += Vector2(0, -60) * delta
	_words = _words.filter(func(w: Array) -> bool: return w[2] > 0.0)
	for s: Array in _sparks:
		s[0] += s[1] * delta
		s[1] *= 0.9
		s[2] -= delta
	_sparks = _sparks.filter(func(s: Array) -> bool: return s[2] > 0.0)
	queue_redraw()
	for pic: Control in _portraits:
		if is_instance_valid(pic):
			pic.queue_redraw()
	if _p1 == null or _mode == "select":
		return
	if _mode in ["intro", "roundover"]:
		_pause_t -= delta
		if _pause_t <= 0.0:
			if _mode == "intro":
				_mode = "fight"
				_announce("FIGHT!", 0.8)
			else:
				_next_after_round()
		_physics(_p1, delta)
		_physics(_p2, delta)
		return
	if _mode != "fight":
		return
	_timer -= delta
	for f: Fighter in [_p1, _p2]:
		for i in f.inputs:
			i[1] += delta
		f.inputs = f.inputs.filter(func(i: Array) -> bool: return float(i[1]) < 1.6)
		f.chain_t = maxf(f.chain_t - delta, 0.0)
		if f.dire > 0.0 and f.dire < 900.0:
			f.dire = maxf(f.dire - delta, 0.0)
		f.flash = maxf(f.flash - delta, 0.0)
	if demo:
		_cpu_input(_p1, _p2, delta)
	else:
		_player_input(_p1, delta)
	_cpu_input(_p2, _p1, delta)
	for f: Fighter in [_p1, _p2]:
		var foe: Fighter = _p2 if f == _p1 else _p1
		_attack_tick(f, foe, delta)
		_physics(f, delta)
		if f.on_ground and f.state in ["idle", "walk", "block"]:
			f.facing = signf(foe.pos.x - f.pos.x) if foe.pos.x != f.pos.x else f.facing
	# Fighters don't pass through each other on the ground.
	var gap: float = _p2.pos.x - _p1.pos.x
	if absf(gap) < 70.0 and absf(_p1.pos.y - _p2.pos.y) < 80.0:
		var push: float = (70.0 - absf(gap)) * 0.5 * signf(gap if gap != 0.0 else 1.0)
		_p1.pos.x -= push
		_p2.pos.x += push
	if _p1.hp <= 0.0 or _p2.hp <= 0.0 or _timer <= 0.0:
		_end_round()

func _physics(f: Fighter, delta: float) -> void:
	f.state_t += delta
	f.vel.y += GRAVITY * delta
	# The falcon floats down; the Dive Bomb comes down hard.
	if f.species == "falcon" and f.vel.y > 0.0 and f.state != "special":
		f.vel.y = minf(f.vel.y, 520.0)
	var prev_y: float = f.pos.y
	f.pos += f.vel * delta
	f.on_ground = false
	if f.pos.y >= GROUND:
		f.pos.y = GROUND
		f.vel.y = 0.0
		f.on_ground = true
	elif f.vel.y >= 0.0:
		# One-way log platforms: land on them from above.
		for p: Rect2 in PLATFORMS:
			if prev_y <= p.position.y and f.pos.y >= p.position.y and f.pos.x > p.position.x and f.pos.x < p.end.x:
				f.pos.y = p.position.y
				f.vel.y = 0.0
				f.on_ground = true
	f.pos.x = clampf(f.pos.x, 60.0, ARENA.x - 60.0)
	if f.on_ground and f.state not in ["special", "light", "heavy"]:
		f.vel.x = move_toward(f.vel.x, 0.0, 3000.0 * delta) if f.state in ["hurt", "ko"] else f.vel.x
	if f.state == "hurt" and f.state_t > 0.35:
		f.state = "idle"
	if f.state == "evolve" and f.state_t > 0.9:
		f.state = "idle"

# Attacks: [active from, active to, total time, reach, damage, knockback].
func _attack_frame(f: Fighter) -> Array:
	var s: Dictionary = f.sheet
	match f.state:
		"light":
			return [0.06, 0.14, 0.24, 120.0, float(s["light"]), 260.0]
		"heavy":
			var fin: bool = f.get_meta("finisher", false)
			return [0.18, 0.3, 0.5, 150.0, float(s["heavy"]) * (1.6 if fin else 1.0), 620.0 if fin else 480.0]
		"special":
			match f.species:
				"wolf":
					return [0.0, 0.35, 0.45, 110.0, 16.0, 420.0]
				"lion":
					return [0.25, 0.9, 1.0, 130.0, 22.0, 650.0]
				"falcon":
					return [0.35, 1.0, 1.1, 120.0, 20.0, 560.0]
	return []

func _attack_tick(f: Fighter, foe: Fighter, _delta: float) -> void:
	var a: Array = _attack_frame(f)
	if a.is_empty():
		return
	if f.state == "special" and f.species == "falcon" and f.state_t > 0.35 and f.state_t < 0.4:
		f.vel = Vector2(f.facing * 700.0, 1300.0)
	if f.state == "special" and f.species == "wolf":
		f.vel.x = f.facing * 1100.0 * (1.0 - f.state_t / 0.45)
	if not f.hit_done and f.state_t >= float(a[0]) and f.state_t <= float(a[1]):
		var reach: float = float(a[3]) * f.scale()
		var dx: float = (foe.pos.x - f.pos.x) * f.facing
		if dx > -30.0 and dx < reach and absf(foe.pos.y - f.pos.y) < 120.0 * f.scale() and foe.state != "ko":
			f.hit_done = true
			_hit(f, foe, float(a[4]), float(a[5]))
	if f.state_t >= float(a[2]) or (f.state == "special" and f.on_ground and f.state_t > float(a[0]) + 0.1 and f.species != "wolf"):
		if f.state == "light":
			f.chain_t = 0.45
		f.state = "idle"
		if f.state == "idle" and f.on_ground:
			f.vel.x = 0.0

func _hit(f: Fighter, foe: Fighter, dmg: float, knock: float) -> void:
	dmg *= f.dmg_mult()
	var blocked: bool = foe.blocking and signf(f.pos.x - foe.pos.x) == foe.facing
	if blocked:
		dmg *= 0.2
		knock *= 0.4
		_word(foe.pos + Vector2(0, -150), "BLOCK!", Color(0.7, 0.85, 1.0))
	else:
		foe.state = "hurt"
		foe.state_t = 0.0
		foe.flash = 0.15
		f.combo += 1
		foe.combo = 0
		_word(foe.pos + Vector2(randf_range(-30, 30), -170), HIT_WORDS[randi() % HIT_WORDS.size()], Color(1.0, 0.9, 0.3) if f.dire > 0.0 else Color.WHITE)
		if f.combo >= 3:
			_word(f.pos + Vector2(0, -230), "%d HIT COMBO!" % f.combo, Color(1.0, 0.55, 0.2))
		if f.get_meta("finisher", false) and f.state == "heavy":
			_word(foe.pos + Vector2(0, -210), "FINISHER!", Color(1.0, 0.4, 0.3))
			_shake = 0.35
	foe.hp = maxf(foe.hp - dmg, 0.0)
	foe.vel = Vector2(f.facing * knock, -knock * 0.45)
	foe.on_ground = false
	f.meter = minf(f.meter + 9.0, 100.0)
	foe.meter = minf(foe.meter + 5.0, 100.0)
	_shake = maxf(_shake, 0.12 + dmg * 0.006)
	_hitstop = 0.05 + dmg * 0.003
	for k: int in 10:
		_sparks.append([foe.pos + Vector2(0, -70), Vector2.from_angle(randf() * TAU) * randf_range(200, 520), 0.35, Color(1, 0.85, 0.3) if f.dire > 0.0 else Color(1, 1, 1)])
	if foe.hp <= 0.0:
		foe.state = "ko"
		_slowmo = 1.2

func _dust(at: Vector2) -> void:
	for k: int in 6:
		_sparks.append([at, Vector2(randf_range(-160, 160), randf_range(-80, -10)), 0.4, Color(0.8, 0.75, 0.6)])

func _word(at: Vector2, text: String, col: Color) -> void:
	_words.append([at, text, 0.9, col])

func _end_round() -> void:
	_mode = "roundover"
	_pause_t = 2.2
	var p1_won: bool = _p1.hp > _p2.hp
	if p1_won:
		_wins.x += 1
	else:
		_wins.y += 1
	var loser: Fighter = _p2 if p1_won else _p1
	var winner: Fighter = _p1 if p1_won else _p2
	loser.state = "ko"
	# Victory pose: fists in the air.
	winner.state = "win"
	winner.state_t = 0.0
	_announce("TUCKERED OUT!" if loser.hp <= 0.0 else "TIME!", 2.0)

func _next_after_round() -> void:
	if _wins.x >= 2:
		_stage += 1
		if _stage >= _ladder.size():
			_finish(true)
			return
		_announce("Next rival!", 1.2)
		_start_match()
	elif _wins.y >= 2:
		_finish(false)
	else:
		_round += 1
		_start_round()

func _finish(won: bool) -> void:
	_mode = "over"
	var gc: Node = get_node_or_null("/root/GameConfig")
	if won and gc != null:
		gc.set_record("brawl", _p1.species, "champion")
		gc.award_eco_points(150)
	_announce("CHAMPION OF THE VALLEY! +150 EP" if won else "Defeated... train and try again!", 999.0)
	var again := Button.new()
	again.text = "Play again"
	again.theme_type_variation = "PrimaryButton"
	again.custom_minimum_size = Vector2(220, 56)
	again.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	again.position = Vector2(size.x * 0.5 - 110, size.y - 120)
	again.pressed.connect(func() -> void:
		again.queue_free()
		_show_select())
	add_child(again)

# --- Drawing --------------------------------------------------------------

func _xform() -> Transform2D:
	var s: float = minf(size.x / ARENA.x, size.y / ARENA.y)
	var off := (size - ARENA * s) * 0.5
	if _shake > 0.0:
		off += Vector2(randf_range(-1, 1), randf_range(-1, 1)) * _shake * 24.0
	return Transform2D(Vector2(s, 0), Vector2(0, s), off)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.05, 0.06, 0.06))
	if _p1 == null or _select != null:
		return
	var xf := _xform()
	draw_set_transform_matrix(xf)
	# Sky, mountains, meadow.
	draw_rect(Rect2(0, 0, ARENA.x, GROUND), Color(0.45, 0.66, 0.85))
	draw_rect(Rect2(0, GROUND * 0.55, ARENA.x, GROUND * 0.45), Color(0.6, 0.76, 0.88))
	draw_colored_polygon(PackedVector2Array([Vector2(0, 470), Vector2(180, 250), Vector2(330, 400), Vector2(520, 200), Vector2(720, 420), Vector2(900, 260), Vector2(1100, 380), Vector2(1280, 230), Vector2(1280, 520), Vector2(0, 520)]), Color(0.42, 0.45, 0.52))
	draw_colored_polygon(PackedVector2Array([Vector2(520, 200), Vector2(560, 240), Vector2(490, 240)]), Color(0.95, 0.96, 1.0))
	draw_rect(Rect2(0, 520, ARENA.x, 200), Color(0.36, 0.58, 0.27))
	draw_rect(Rect2(0, GROUND, ARENA.x, ARENA.y - GROUND), Color(0.28, 0.46, 0.2))
	for p: Rect2 in PLATFORMS:
		draw_rect(p, Color(0.45, 0.3, 0.17))
		draw_rect(Rect2(p.position, Vector2(p.size.x, 6)), Color(0.58, 0.4, 0.24))
	for f: Fighter in [_p1, _p2]:
		_draw_fighter(f)
	for s: Array in _sparks:
		draw_circle(s[0], 5.0 * float(s[2]) / 0.4 + 1.0, s[3])
	var font := FelecoUiScript.font("heading")
	for w: Array in _words:
		draw_string_outline(font, (w[0] as Vector2) - Vector2(80, 0), w[1], HORIZONTAL_ALIGNMENT_CENTER, 160, 34, 8, Color(0, 0, 0, clampf(w[2], 0, 1)))
		draw_string(font, (w[0] as Vector2) - Vector2(80, 0), w[1], HORIZONTAL_ALIGNMENT_CENTER, 160, 34, Color(w[3], clampf(w[2], 0, 1)))
	_draw_hud(font)
	draw_set_transform_matrix(Transform2D.IDENTITY)

func _draw_fighter(f: Fighter) -> void:
	# Upright cartoon brawlers (FighterArt), all the same height.
	var u: float = 23.0 * f.scale()
	var w: float = 4.0 * u
	# A flat oval shadow on the ground under the fighter.
	draw_set_transform_matrix(_xform() * Transform2D(0.0, Vector2(1.0, 0.18), 0.0, Vector2(f.pos.x, GROUND if f.pos.y > GROUND - 200.0 else f.pos.y)))
	draw_circle(Vector2.ZERO, w * 0.6, Color(0, 0, 0, 0.25))
	draw_set_transform_matrix(_xform() * Transform2D(0.0, f.pos))
	# Dire: a golden aura that pulses.
	if f.dire > 0.0:
		var pulse: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.012)
		draw_circle(Vector2(0, -5.5 * u), u * (6.0 + 0.6 * pulse), Color(1.0, 0.8, 0.2, 0.22 + 0.15 * pulse))
	var tint := Color.WHITE
	if f.dire > 0.0:
		tint = Color(1.45, 1.2, 0.5)
	if f.flash > 0.0:
		tint = Color(2.0, 2.0, 2.0)
	if f.blocking:
		tint = tint * Color(0.8, 0.9, 1.2)
	var pose: String = f.state
	if pose in ["idle", "walk"] and not f.on_ground:
		pose = "jump"
	if pose == "win":
		pose = "evolve"
	FighterArt.set_base(self, _xform() * Transform2D(0.0, Vector2(f.facing, 1.0), 0.0, f.pos))
	FighterArt.paint(self, f.species, pose, f.state_t if pose != "idle" else Time.get_ticks_msec() / 1000.0, u, tint, f.chain)
	if f.blocking:
		draw_arc(Vector2(2.2 * u, -8.0 * u), 2.4 * u, -1.3, 1.3, 16, Color(0.6, 0.85, 1.0, 0.8), 0.3 * u)
	draw_set_transform_matrix(_xform())

func _draw_hud(font: Font) -> void:
	for side: int in 2:
		var f: Fighter = _p1 if side == 0 else _p2
		var x: float = 40.0 if side == 0 else ARENA.x - 540.0
		var name: String = String(f.sheet["name"]) + (" (Dire)" if f.dire > 0.0 else "")
		draw_string(font, Vector2(x, 44), name if side == 0 else "CPU " + name, HORIZONTAL_ALIGNMENT_LEFT if side == 0 else HORIZONTAL_ALIGNMENT_RIGHT, 500, 26, Color.WHITE)
		draw_rect(Rect2(x, 54, 500, 26), Color(0.1, 0.1, 0.1))
		var hpw: float = 500.0 * f.hp / 100.0
		draw_rect(Rect2(x if side == 0 else x + 500.0 - hpw, 54, hpw, 26), Color(0.95, 0.75, 0.2) if f.dire > 0.0 else Color(0.4, 0.85, 0.35))
		draw_rect(Rect2(x, 54, 500, 26), Color.WHITE, false, 2.0)
		draw_rect(Rect2(x, 86, 300, 12) if side == 0 else Rect2(x + 200.0, 86, 300, 12), Color(0, 0, 0, 0.35))
		draw_rect(Rect2(x, 86, 300 * f.meter / 100.0, 12) if side == 0 else Rect2(x + 500.0 - 300 * f.meter / 100.0, 86, 300 * f.meter / 100.0, 12), Color(0.5, 0.75, 1.0) if f.meter < 100.0 else Color(1.0, 0.85, 0.2))
		for k: int in (_wins.x if side == 0 else _wins.y):
			draw_circle(Vector2(x + (20 + k * 26 if side == 0 else 480 - k * 26), 118), 9, Color(1, 0.85, 0.2))
	draw_string(font, Vector2(0, 76), str(int(ceil(maxf(_timer, 0.0)))), HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 44, Color(1, 0.4, 0.35) if _timer < 10.0 else Color.WHITE)
	draw_string(font, Vector2(40, 112), "EVOLVE", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1, 1, 1, 0.7))
	draw_string(font, Vector2(0, ARENA.y - 18), "A/D move   W jump   S block   J light   K heavy   L special   J J K finisher   Esc pause", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 16, Color(1, 1, 1, 0.75))
	draw_string(font, Vector2(0, 112), "Rival %d of %d" % [_stage + 1, _ladder.size()], HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 16, Color(1, 1, 1, 0.8))
	if _p1.meter >= 100.0 and _p1.dire <= 0.0 and _mode == "fight":
		var a: float = 0.6 + 0.4 * sin(Time.get_ticks_msec() * 0.01)
		draw_string(font, Vector2(40, 130), "EVOLVE READY: Down, Fwd, Down, Fwd, then L", HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1, 0.85, 0.2, a))
	if _banner_t > 0.0:
		draw_string_outline(font, Vector2(0, 330), _banner, HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 56, 12, Color(0, 0, 0, 0.8))
		draw_string(font, Vector2(0, 330), _banner, HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 56, Color(1, 0.95, 0.7))
	if _rampage_t > 0.0:
		var j := Vector2(randf_range(-10, 10), randf_range(-8, 8))
		draw_string_outline(font, Vector2(0, 260) + j, "RAMPAGE!", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 110, 16, Color(0.3, 0.1, 0.0, 0.9))
		draw_string(font, Vector2(0, 260) + j, "RAMPAGE!", HORIZONTAL_ALIGNMENT_CENTER, ARENA.x, 110, Color(1.0, 0.8, 0.15))

extends Control

# Herbivore campaign: Stampede Sprint. Your herbivore runs as fast as you
# type, and what you type is the valley's own chatter: chunks of the
# creatures' thoughts and the ticker's gossip. Short words first, longer
# runs of words as the finish nears. Every right key is a stride; a wrong
# one is a stumble. Four races, each with faster rivals. Rivals stumble too,
# and the pack bunches up a little (a runner far ahead eases off, one far
# behind digs in), so a race is rarely decided before the last stretch.
# Esc pauses, with a way back to the runners or the Mini-Games.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const Brawl = preload("res://scripts/minigames/predator_brawl.gd")

const VIEW := Vector2(1280, 720)
const LANES: int = 4
const LANE_Y0: float = 300.0
const LANE_H: float = 95.0
const PX_PER_M: float = 24.0

const RUNNERS: Dictionary = {
	"sheep": {"name": "Sheep", "top": 13.0, "stride": 1.15, "about": "Steady. Every stride counts a little extra."},
	"rabbit": {"name": "Rabbit", "top": 15.0, "stride": 0.95, "about": "Fast legs, short hops: type quickly!"},
	"deer": {"name": "Deer", "top": 16.0, "stride": 1.0, "about": "The fastest at full stretch."},
	"goat": {"name": "Mountain Goat", "top": 12.5, "stride": 1.25, "about": "Sure-footed: stumbles cost it less."},
}
# [name, length in metres, rival pace m/s].
const RACES: Array = [
	["Meadow Dash", 200.0, 7.5],
	["Riverside Run", 260.0, 9.0],
	["Orchard Chase", 320.0, 10.5],
	["Valley Grand Prix", 400.0, 12.0],
]
# Everything the valley says: creature thoughts and ticker gossip.
static var _lines: Array[String] = []

static func _dialog() -> Array[String]:
	if _lines.is_empty():
		var raw: Array = []
		raw.append_array(Tickertape.MURMURS)
		raw.append_array(Tickertape.SETTLEMENT_POOL)
		for st: String in FollowPanel.STATES.keys():
			raw.append(FollowPanel.STATES[st][1])
		for line in raw:
			var clean: String = String(line).replace("’", "'").replace("‘", "'")
			# Letters, spaces and apostrophes only: punctuation isn't typed.
			var out := ""
			for ch: String in clean:
				if (ch >= "a" and ch <= "z") or (ch >= "A" and ch <= "Z") or ch == " " or ch == "'":
					out += ch
			out = " ".join(out.split(" ", false))
			if out.length() > 3:
				_lines.append(out.to_lower())
	return _lines

var _species: String = ""
var _race: int = 0
var _length: float = 200.0
var _rival_pace: float = 6.5
var _pos: Array[float] = []
var _speed: Array[float] = []
var _finish_time: Array[float] = []
var _t: float = 0.0
var _mode: String = "select"
var _prompt: String = ""
# The line after this one, shown faintly underneath so you can read ahead.
var _upcoming: String = ""
# The fork: until the first key, a longer GOLDEN line is offered too; the
# first letter you type picks. Golden lines boost more and charge nitro.
var _golden: String = ""
var _is_gold: bool = false
var _clean: bool = true
# Nitro: perfect lines earn charges; Enter spends one for a burst.
var _nitro: int = 0
var _nitro_t: float = 0.0
# Touch screens: an on-screen keyboard (letters, apostrophe, space, nitro).
var _keys_pad: Control
var _synthetic: bool = false
const NITRO_MAX: int = 3
const NITRO_TIME: float = 1.6
var _typed: int = 0
var _stumble: float = 0.0
var _count: float = 0.0
var _keys_right: int = 0
var _keys_wrong: int = 0
var _texts: Array = []
var _select: Control
var _rival_species: Array[String] = []
var _tex: Dictionary = {}
var _end_btns: HBoxContainer
# Rivals trip now and then: [tilt time left] per lane.
var _rival_stumble: Array[float] = [0.0, 0.0, 0.0, 0.0]
var _paused: bool = false
var _pause_box: Control
var _pause_btn: Button
# The typing cursor glides to the next key (Nitro Type style) instead of
# jumping; a wrong key shakes it red, a right key pops the letter behind it.
var _cursor_x: float = -1.0
var _cursor_goal: float = 0.0
var _miss: float = 0.0
var _pop: float = 0.0
var _jx := Juice.new()
var _last_count: int = 4

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	theme = FelecoUiScript.theme()
	_jx.font = FelecoUiScript.font("heading")
	focus_mode = Control.FOCUS_ALL
	_build_pause_button()
	_show_select()
	_build_keyboard()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "race"):
		HowToPlay.show(self, "race")

func _build_keyboard() -> void:
	if not (DisplayServer.is_touchscreen_available() or OS.get_cmdline_user_args().has("--touch")):
		return
	_keys_pad = VBoxContainer.new()
	_keys_pad.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_keys_pad.grow_horizontal = Control.GROW_DIRECTION_BOTH
	_keys_pad.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_keys_pad.offset_bottom = -6
	_keys_pad.add_theme_constant_override("separation", 4)
	_keys_pad.visible = false
	add_child(_keys_pad)
	for row: String in ["qwertyuiop", "asdfghjkl'", "zxcvbnm"]:
		var hb := HBoxContainer.new()
		hb.alignment = BoxContainer.ALIGNMENT_CENTER
		hb.add_theme_constant_override("separation", 4)
		_keys_pad.add_child(hb)
		for ch: String in row:
			hb.add_child(_key_button(ch.to_upper(), ch, Vector2(62, 58)))
	var last := HBoxContainer.new()
	last.alignment = BoxContainer.ALIGNMENT_CENTER
	last.add_theme_constant_override("separation", 6)
	_keys_pad.add_child(last)
	last.add_child(_key_button("SPACE", " ", Vector2(380, 58)))
	last.add_child(_key_button("NITRO", "\n", Vector2(150, 58)))

func _key_button(label: String, ch: String, sz: Vector2) -> Button:
	var b := Button.new()
	b.text = label
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = sz
	b.add_theme_font_size_override("font_size", 22)
	b.button_down.connect(func() -> void:
		var e := InputEventKey.new()
		e.pressed = true
		if ch == "\n":
			e.physical_keycode = KEY_ENTER
		else:
			e.unicode = ch.unicode_at(0)
		_synthetic = true
		_gui_input(e)
		_synthetic = false)
	return b

func _quit_to_campaign() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

func _build_pause_button() -> void:
	_pause_btn = Button.new()
	_pause_btn.text = "Pause"
	_pause_btn.icon = load("res://assets/icons/pause.svg")
	_pause_btn.tooltip_text = "Pause, or leave the race (Esc)."
	_pause_btn.theme_type_variation = "GhostButton"
	_pause_btn.custom_minimum_size = Vector2(130, 44)
	_pause_btn.focus_mode = Control.FOCUS_NONE
	_pause_btn.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_pause_btn.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	_pause_btn.offset_right = -12
	_pause_btn.offset_top = 10
	_pause_btn.offset_left = -142
	_pause_btn.offset_bottom = 54
	_pause_btn.visible = false
	_pause_btn.pressed.connect(func() -> void:
		if _mode in ["race", "count"]:
			_toggle_pause())
	add_child(_pause_btn)

func _toggle_pause() -> void:
	_paused = not _paused
	_pause_btn.text = "Resume" if _paused else "Pause"
	if _paused:
		_pause_box = PanelContainer.new()
		_pause_box.set_anchors_preset(Control.PRESET_CENTER)
		_pause_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
		_pause_box.grow_vertical = Control.GROW_DIRECTION_BOTH
		add_child(_pause_box)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 12)
		_pause_box.add_child(col)
		var h := FelecoUiScript.heading("Paused", 40, FelecoUiScript.GOLD)
		h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(h)
		for b: Array in [["Resume", _toggle_pause, "PrimaryButton"], ["Restart race", func() -> void:
			_toggle_pause()
			_start_race(), ""], ["Runners", func() -> void:
			_toggle_pause()
			_show_select(), "GhostButton"], ["Back to Mini-Games", _quit_to_campaign, "GhostButton"]]:
			var btn := Button.new()
			btn.text = b[0]
			btn.custom_minimum_size = Vector2(280, 50)
			if not String(b[2]).is_empty():
				btn.theme_type_variation = b[2]
			btn.pressed.connect(b[1])
			col.add_child(btn)
	elif _pause_box != null:
		_pause_box.queue_free()
		_pause_box = null
		grab_focus()

func _unhandled_key_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo or k.physical_keycode != KEY_ESCAPE:
		return
	match _mode:
		"select":
			_quit_to_campaign()
		"done":
			_show_select()
		_:
			_toggle_pause()

func _show_select() -> void:
	_mode = "select"
	_paused = false
	if _pause_box != null:
		_pause_box.queue_free()
		_pause_box = null
	_pause_btn.visible = false
	_pause_btn.text = "Pause"
	if _end_btns != null:
		_end_btns.queue_free()
		_end_btns = null
	if _select != null:
		_select.queue_free()
	_select = PanelContainer.new()
	_select.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_select)
	var col := VBoxContainer.new()
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_theme_constant_override("separation", 14)
	_select.add_child(col)
	var t := FelecoUiScript.heading("Stampede Sprint", 48, FelecoUiScript.GOLD)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var sub := FelecoUiScript.label("Type to run! Type what the valley's creatures are saying: words first, then whole lines. Wrong keys make you stumble.", 19, FelecoUiScript.CREAM)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(sub)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	col.add_child(row)
	for sp: String in RUNNERS.keys():
		var card := VBoxContainer.new()
		card.custom_minimum_size = Vector2(250, 0)
		row.add_child(card)
		var pic := TextureRect.new()
		pic.texture = Brawl.portrait(sp)
		pic.custom_minimum_size = Vector2(250, 150)
		pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		card.add_child(pic)
		card.add_child(FelecoUiScript.heading(RUNNERS[sp]["name"], 22, FelecoUiScript.GOLD))
		var about := FelecoUiScript.label(RUNNERS[sp]["about"], 15, FelecoUiScript.MIST)
		about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		card.add_child(about)
		var b := Button.new()
		b.text = "Run as %s" % RUNNERS[sp]["name"]
		b.theme_type_variation = "PrimaryButton"
		b.custom_minimum_size = Vector2(0, 48)
		b.pressed.connect(func() -> void: _pick(sp))
		card.add_child(b)
	var gc: Node = get_node_or_null("/root/GameConfig")
	var best: String = ""
	for i: int in RACES.size():
		var r = gc.record("race", str(i)) if gc != null else null
		best += "%s: %s    " % [RACES[i][0], str(r) if r != null else "-"]
	var bl := FelecoUiScript.label(best, 15, FelecoUiScript.MIST)
	bl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(bl)
	var back := Button.new()
	back.text = "Back to Mini-Games"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(220, 48)
	back.pressed.connect(_quit_to_campaign)
	var bc := HBoxContainer.new()
	bc.alignment = BoxContainer.ALIGNMENT_CENTER
	bc.add_theme_constant_override("separation", 14)
	HowToPlay.button(bc, self, "race")
	bc.add_child(back)
	col.add_child(bc)

func _pick(sp: String) -> void:
	_species = sp
	_race = 0
	_start_race()

func _start_race() -> void:
	if _select != null:
		_select.queue_free()
		_select = null
	if _end_btns != null:
		_end_btns.queue_free()
		_end_btns = null
	_pause_btn.visible = true
	_length = float(RACES[_race][1])
	_rival_pace = float(RACES[_race][2])
	_pos = [0.0, 0.0, 0.0, 0.0]
	_speed = [0.0, 0.0, 0.0, 0.0]
	_finish_time = [-1.0, -1.0, -1.0, -1.0]
	_rival_stumble = [0.0, 0.0, 0.0, 0.0]
	_rival_species = []
	for sp: String in RUNNERS.keys():
		if sp != _species:
			_rival_species.append(sp)
	_t = 0.0
	_count = 3.0
	_last_count = 4
	_mode = "count"
	_typed = 0
	_stumble = 0.0
	_keys_right = 0
	_keys_wrong = 0
	_texts.clear()
	_prompt = ""
	_upcoming = ""
	_nitro = 0
	_nitro_t = 0.0
	_next_prompt()
	grab_focus()

# --- Prompts ----------------------------------------------------------------

func _stage() -> int:
	var f: float = _pos[0] / _length
	if f < 0.25:
		return 0
	if f < 0.5:
		return 1
	if f < 0.75:
		return 2
	return 3

# A chunk of real valley dialog: one word at first, then two, three, and
# whole runs of five or six words for the final stretch.
func _next_prompt() -> void:
	_typed = 0
	_cursor_x = -1.0
	if _upcoming.is_empty():
		_upcoming = _make_prompt()
	_prompt = _upcoming
	_upcoming = _make_prompt()
	_is_gold = false
	_clean = true
	_golden = ""
	for i: int in 12:
		var g: String = _make_prompt(1)
		if g.length() > _prompt.length() and g[0] != _prompt[0]:
			_golden = g
			break

func _make_prompt(extra: int = 0) -> String:
	var lines := _dialog()
	var words: PackedStringArray = lines[randi() % lines.size()].split(" ", false)
	var want: int = [1, 2, 3, 4][_stage()] + extra
	if want == 1:
		# Opening words are short and friendly.
		var short: Array = Array(words).filter(func(w: String) -> bool: return w.length() >= 3 and w.length() <= 6)
		return short[randi() % short.size()] if not short.is_empty() else words[0]
	var start: int = randi() % maxi(words.size() - want + 1, 1)
	return " ".join(words.slice(start, start + want))

func _gui_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo or _mode != "race" or _paused:
		return
	if k.physical_keycode == KEY_ESCAPE:
		return
	if not _synthetic:
		accept_event()
	if _finish_time[0] >= 0.0:
		return
	if k.physical_keycode in [KEY_ENTER, KEY_KP_ENTER]:
		if _nitro > 0 and _nitro_t <= 0.0:
			_nitro -= 1
			_nitro_t = NITRO_TIME
			Juice.sfx(self, "power", 1.3)
			_jx.flash(Color(0.6, 0.85, 1.0, 0.35))
			_jx.text(Vector2(VIEW.x * 0.5, 300), "NITRO!", Color(0.5, 0.85, 1.0), 60)
			_jx.shake(0.3)
		return
	var ch: String = char(k.unicode).to_lower() if k.unicode > 0 else ""
	if ch.is_empty():
		return
	# The first key of a line picks: the plain line or the golden one.
	if _typed == 0 and not _golden.is_empty() and ch == _golden[0] and ch != _prompt[0]:
		_prompt = _golden
		_is_gold = true
		_golden = ""
		Juice.sfx(self, "coin", 1.0, -8.0)
	elif _typed == 0:
		_golden = ""
	var want: String = _prompt.substr(_typed, 1)
	var sheet: Dictionary = RUNNERS[_species]
	if ch == want:
		_typed += 1
		_keys_right += 1
		_pop = 1.0
		Juice.sfx(self, "key", 1.0 + 0.4 * float(_typed) / maxf(_prompt.length(), 1.0), -12.0)
		# A stride: words are worth more per key (they're harder).
		var boost: float = [1.9, 2.1, 2.3, 2.5][_stage()] * float(sheet["stride"])
		_speed[0] = minf(_speed[0] + boost, float(sheet["top"]))
		if _typed >= _prompt.length():
			if _is_gold:
				_speed[0] = minf(_speed[0] + 4.0, float(sheet["top"]) * 1.25)
				_texts.append(["GOLDEN!", 0.9])
				_jx.confetti(Vector2(VIEW.x * 0.5, 210), 30, 300.0)
			elif _prompt.length() > 2:
				_speed[0] = minf(_speed[0] + 2.0, float(sheet["top"]) * 1.15)
				_texts.append(["Nice!", 0.8])
			if _clean and _nitro < NITRO_MAX:
				_nitro += 1 if not _is_gold else mini(2, NITRO_MAX - _nitro)
				_texts.append(["+NITRO  (Enter)", 0.9])
			Juice.sfx(self, "chime", 1.0 + 0.1 * _stage(), -10.0)
			_jx.burst(Vector2(VIEW.x * 0.5, 210), Color(0.5, 1.0, 0.45), 18, 380.0, 5.0, 300.0)
			_jx.ring(Vector2(VIEW.x * 0.5, 210), Color(0.6, 1.0, 0.5), 160.0)
			_next_prompt()
	else:
		_keys_wrong += 1
		_clean = false
		_miss = 1.0
		Juice.sfx(self, "error", 1.0, -8.0)
		_jx.shake(0.25)
		_stumble = 0.35 * (0.6 if _species == "goat" else 1.0)
		_speed[0] *= 0.55
		_texts.append(["Stumble!", 0.8])

# --- Race ---------------------------------------------------------------

func _process(delta: float) -> void:
	if _paused:
		return
	for t: Array in _texts:
		t[1] -= delta
	_miss = maxf(_miss - delta * 3.0, 0.0)
	_jx.update(delta)
	_pop = maxf(_pop - delta * 6.0, 0.0)
	if _cursor_x < 0.0:
		_cursor_x = _cursor_goal
	else:
		_cursor_x = lerpf(_cursor_x, _cursor_goal, 1.0 - exp(-delta * 28.0))
	_texts = _texts.filter(func(t: Array) -> bool: return t[1] > 0.0)
	queue_redraw()
	if _keys_pad != null:
		_keys_pad.visible = _mode in ["race", "count"] and not _paused
	if _mode == "count":
		_count -= delta
		var whole: int = int(ceil(_count))
		if whole != _last_count and whole > 0:
			_last_count = whole
			Juice.sfx(self, "countdown")
		if _count <= 0.0:
			_mode = "race"
			Juice.sfx(self, "go")
			_jx.text(Vector2(VIEW.x * 0.5, 230), "GO!", FelecoUiScript.GOLD, 90)
			_jx.shake(0.3)
		return
	if _mode != "race":
		return
	_t += delta
	_stumble = maxf(_stumble - delta, 0.0)
	# You slow down unless you keep typing, faster the faster you go: top
	# speed is set by how many right keys a second you can keep up.
	var drag: float = 1.0 + _speed[0] * 0.45 + (6.0 if _stumble > 0.0 else 0.0)
	_speed[0] = maxf(_speed[0] - delta * drag, 0.0)
	if _nitro_t > 0.0:
		_nitro_t -= delta
		_speed[0] = maxf(_speed[0], float(RUNNERS[_species]["top"]) * 1.35)
	for i: int in range(1, LANES):
		# Rivals: a steady pace with a little wobble and a late kick.
		var pace: float = _rival_pace * (0.88 + 0.08 * i) * (1.0 + 0.06 * sin(_t * (0.7 + i * 0.3)))
		if _pos[i] > _length * 0.8:
			pace *= 1.04
		# The pack bunches: a rival far ahead of you eases off a little, one
		# far behind digs in. Gentle, so a good typist still wins clean.
		var gap: float = (_pos[i] - _pos[0]) / _length
		pace *= clampf(1.0 - gap * 0.6, 0.85, 1.12)
		# Now and then a rival trips too.
		_rival_stumble[i] = maxf(_rival_stumble[i] - delta, 0.0)
		if _rival_stumble[i] <= 0.0 and randf() < delta * 0.06 and _pos[i] < _length * 0.9:
			_rival_stumble[i] = 0.5
			_speed[i] *= 0.5
			_texts.append(["%s stumbles!" % RUNNERS[_rival_species[(i - 1) % _rival_species.size()]]["name"], 0.9])
		if _rival_stumble[i] > 0.0:
			pace *= 0.4
		_speed[i] = lerpf(_speed[i], pace, delta * 1.5)
	for i: int in LANES:
		if _finish_time[i] < 0.0:
			_pos[i] += _speed[i] * delta
			if _pos[i] >= _length:
				_pos[i] = _length
				_finish_time[i] = _t
	if _finish_time[0] >= 0.0 and _mode == "race":
		_end_race()

func _place() -> int:
	var place: int = 1
	for i: int in range(1, LANES):
		if _finish_time[i] >= 0.0 and _finish_time[i] < _finish_time[0]:
			place += 1
	return place

const EP_BY_PLACE: Array[int] = [60, 35, 20, 5]

func _end_race() -> void:
	_mode = "done"
	_pause_btn.visible = false
	var place: int = _place()
	var medal: String = ["Gold", "Silver", "Bronze", "4th"][place - 1]
	Juice.sfx(self, "fanfare" if place == 1 else ("chime" if place <= 3 else "lose"))
	if place == 1:
		_jx.confetti(Vector2(VIEW.x * 0.5, 120), 120, 600.0)
		_jx.flash(Color(1, 0.95, 0.6, 0.4))
	elif place <= 3:
		_jx.confetti(Vector2(VIEW.x * 0.5, 120), 40, 400.0)
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		var order := ["4th", "Bronze", "Silver", "Gold"]
		var prev = gc.record("race", str(_race))
		if prev == null or order.find(medal) > order.find(String(prev)):
			gc.set_record("race", str(_race), medal)
		gc.award_eco_points(EP_BY_PLACE[place - 1])
	_end_btns = HBoxContainer.new()
	_end_btns.alignment = BoxContainer.ALIGNMENT_CENTER
	_end_btns.add_theme_constant_override("separation", 14)
	_end_btns.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_end_btns.offset_top = -110
	_end_btns.offset_bottom = -50
	_end_btns.offset_left = -400
	_end_btns.offset_right = 400
	add_child(_end_btns)
	if place <= 3 and _race + 1 < RACES.size():
		var nb := Button.new()
		nb.text = "Next race"
		nb.theme_type_variation = "PrimaryButton"
		nb.custom_minimum_size = Vector2(200, 54)
		nb.pressed.connect(func() -> void:
			_race += 1
			_start_race())
		_end_btns.add_child(nb)
	var again := Button.new()
	again.text = "Race again"
	again.custom_minimum_size = Vector2(180, 54)
	again.pressed.connect(_start_race)
	_end_btns.add_child(again)
	var menu := Button.new()
	menu.text = "Runners"
	menu.theme_type_variation = "GhostButton"
	menu.custom_minimum_size = Vector2(150, 54)
	menu.pressed.connect(_show_select)
	_end_btns.add_child(menu)
	var back := Button.new()
	back.text = "Back to Mini-Games"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(200, 54)
	back.pressed.connect(_quit_to_campaign)
	_end_btns.add_child(back)

# --- The prompt -----------------------------------------------------------

# Each key gets its own slot on a strip: typed keys green, the next key under
# a gliding gold cursor, the rest white. A space is drawn as a little space
# bar, so nobody wonders why the word "won't type". Below, a key cap spells
# out exactly which key comes next.
func _draw_prompt(font: Font) -> void:
	var big: int = 64 if _prompt.length() <= 8 else (46 if _prompt.length() <= 20 else 34)
	var word: String = _prompt.to_upper()
	var gap: float = big * 0.12
	var widths: Array[float] = []
	var total: float = 0.0
	for i: int in word.length():
		var ch: String = word[i]
		var w: float = big * 0.75 if ch == " " else font.get_string_size(ch, HORIZONTAL_ALIGNMENT_LEFT, -1, big).x
		widths.append(w)
		total += w + gap
	var x0: float = (VIEW.x - total) * 0.5
	var base_y: float = 232.0
	var top: float = base_y - big * 0.95
	var hgt: float = big * 1.2
	draw_rect(Rect2(x0 - 22, top - 10, total + 44, hgt + 20), Color(0.04, 0.06, 0.05, 0.82))
	# The cursor: where the next key sits.
	var cx: float = x0
	for i: int in mini(_typed, widths.size()):
		cx += widths[i] + gap
	var cw: float = widths[_typed] if _typed < widths.size() else big * 0.5
	_cursor_goal = cx
	var shake: float = sin(_miss * 40.0) * 6.0 * _miss
	var cur := Rect2(_cursor_x - gap * 0.5 + shake, top, cw + gap, hgt)
	draw_rect(cur, Color(1, 0.35, 0.3, 0.5) if _miss > 0.0 else Color(1, 0.84, 0.3, 0.32))
	draw_rect(Rect2(cur.position.x, cur.end.y - 6, cur.size.x, 6), Color(1, 0.4, 0.35) if _miss > 0.0 else FelecoUiScript.GOLD)
	var x: float = x0
	for i: int in word.length():
		var ch: String = word[i]
		var col: Color = Color.WHITE
		if i < _typed:
			col = Color(0.5, 1.0, 0.45)
		elif i == _typed:
			col = Color(1, 0.55, 0.5) if _miss > 0.0 else Color(1, 0.95, 0.75)
		else:
			col = Color(1, 1, 1, 0.82)
		if ch == " ":
			# A little space bar: a flat key with raised ends.
			var bw: float = widths[i] * 0.8
			var bx: float = x + (widths[i] - bw) * 0.5
			var by: float = base_y - big * 0.1
			var bar_col: Color = col if i != _typed else FelecoUiScript.GOLD
			draw_line(Vector2(bx, by - big * 0.18), Vector2(bx, by), bar_col, 3.0)
			draw_line(Vector2(bx, by), Vector2(bx + bw, by), bar_col, 3.0)
			draw_line(Vector2(bx + bw, by), Vector2(bx + bw, by - big * 0.18), bar_col, 3.0)
		else:
			var lift: float = 0.0
			if i == _typed - 1:
				lift = _pop * big * 0.12
			draw_string(font, Vector2(x, base_y - lift), ch, HORIZONTAL_ALIGNMENT_LEFT, -1, big, col)
		x += widths[i] + gap
	# The golden fork, until the first key picks.
	if _typed == 0 and not _golden.is_empty():
		var gw: String = _golden.to_upper()
		var gtxt: String = "or GOLDEN:  " + gw + "   (start with " + gw[0] + ")"
		draw_string_outline(font, Vector2(0, top - 26), gtxt, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 26, 6, Color(0.2, 0.12, 0.0, 0.8))
		draw_string(font, Vector2(0, top - 26), gtxt, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 26, Color(1, 0.85, 0.3, 0.75 + 0.25 * sin(_t * 6.0)))
	# Nitro charges, and the burst.
	for i: int in NITRO_MAX:
		var pc := Vector2(VIEW.x - 70 - i * 34, 110)
		draw_circle(pc, 13, Color(0, 0, 0, 0.4))
		draw_circle(pc, 10, Color(0.45, 0.8, 1.0) if i < _nitro else Color(1, 1, 1, 0.15))
	draw_string(font, Vector2(VIEW.x - 330, 117), "NITRO (Enter)", HORIZONTAL_ALIGNMENT_RIGHT, 180, 16, Color(0.6, 0.85, 1.0, 0.8))
	# The line after this one, faint, so you can read ahead.
	if not _upcoming.is_empty():
		draw_string(font, Vector2(0, top + hgt + 104), "Up next:  " + _upcoming.to_upper(), HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 24, Color(1, 1, 1, 0.38))
	# The next key, spelled out on a key cap.
	if _typed < word.length():
		var nxt: String = word[_typed]
		var is_space: bool = nxt == " "
		var cap_text: String = "SPACE" if is_space else nxt
		var cap_w: float = 260.0 if is_space else 64.0
		var cap := Rect2(VIEW.x * 0.5 - cap_w * 0.5 + 60.0, top + hgt + 22, cap_w, 50)
		draw_string(font, Vector2(cap.position.x - 150, cap.position.y + 35), "Next key", HORIZONTAL_ALIGNMENT_RIGHT, 140, 22, FelecoUiScript.MIST)
		var pulse: float = 0.75 + 0.25 * sin(_t * 8.0)
		draw_rect(Rect2(cap.position + Vector2(0, 5), cap.size), Color(0, 0, 0, 0.45))
		draw_rect(cap, Color(0.95, 0.9, 0.78) if not is_space else Color(1, 0.86, 0.35, pulse))
		draw_rect(cap, Color(0.35, 0.28, 0.15), false, 2.0)
		draw_string(font, Vector2(cap.position.x, cap.position.y + 36), cap_text, HORIZONTAL_ALIGNMENT_CENTER, cap.size.x, 30, FelecoUiScript.INK)

# --- Drawing --------------------------------------------------------------

func _xform() -> Transform2D:
	var s: float = minf(size.x / VIEW.x, size.y / VIEW.y)
	return Transform2D(Vector2(s, 0), Vector2(0, s), (size - VIEW * s) * 0.5)

func _tex_for(sp: String) -> Texture2D:
	if not _tex.has(sp):
		_tex[sp] = Brawl.portrait(sp)
	return _tex[sp]

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.05, 0.06, 0.06))
	if _select != null or _species.is_empty():
		return
	draw_set_transform_matrix(_xform() * Transform2D(0.0, _jx.offset()))
	var cam: float = _pos[0] * PX_PER_M - 300.0
	draw_rect(Rect2(0, 0, VIEW.x, 280), Color(0.5, 0.72, 0.9))
	# Far hills drift slowly (parallax).
	for k: int in 6:
		var hx: float = fposmod(k * 300.0 - cam * 0.2, 1800.0) - 260.0
		draw_circle(Vector2(hx, 300), 200, Color(0.4, 0.62, 0.36))
	draw_rect(Rect2(0, LANE_Y0 - 20, VIEW.x, LANES * LANE_H + 40), Color(0.38, 0.6, 0.28))
	for i: int in LANES + 1:
		draw_line(Vector2(0, LANE_Y0 + i * LANE_H), Vector2(VIEW.x, LANE_Y0 + i * LANE_H), Color(1, 1, 1, 0.25), 2.0)
	# Distance markers every 25 m, and the finish.
	for m: int in range(0, int(_length) + 1, 25):
		var x: float = m * PX_PER_M - cam
		if x > -20 and x < VIEW.x + 20:
			draw_line(Vector2(x, LANE_Y0), Vector2(x, LANE_Y0 + LANES * LANE_H), Color(1, 1, 1, 0.12), 2.0)
	var fx: float = _length * PX_PER_M - cam + 60.0
	for k: int in 16:
		draw_rect(Rect2(fx + (k % 2) * 14, LANE_Y0 + k * LANES * LANE_H / 16.0, 14, LANES * LANE_H / 16.0), Color.WHITE if k % 2 == 0 else Color.BLACK)
	for i: int in LANES:
		var sp: String = _species if i == 0 else _rival_species[(i - 1) % _rival_species.size()]
		var tex := _tex_for(sp)
		var x: float = _pos[i] * PX_PER_M - cam
		var y: float = LANE_Y0 + i * LANE_H + LANE_H - 8.0
		var hop: float = absf(sin(_t * (6.0 + _speed[i] * 0.6) + i)) * minf(_speed[i], 10.0) * 1.8
		var h: float = 90.0
		var w: float = h * float(tex.get_width()) / float(tex.get_height())
		draw_set_transform_matrix(_xform() * Transform2D(0.0, Vector2(1.0, 0.2), 0.0, Vector2(x, y)))
		draw_circle(Vector2.ZERO, w * 0.35, Color(0, 0, 0, 0.25))
		draw_set_transform_matrix(_xform())
		var tilt: float = 0.3 if (i == 0 and _stumble > 0.0) or (i > 0 and _rival_stumble[i] > 0.0) else 0.0
		draw_set_transform_matrix(_xform() * Transform2D(tilt, Vector2(x, y - hop)))
		var gallop: float = 1.0 + sin(Time.get_ticks_msec() * 0.018 + w) * 0.05
		draw_texture_rect(tex, Rect2(-w * 0.5 * (2.0 - gallop), -h * gallop, w * (2.0 - gallop), h * gallop), false)
		draw_set_transform_matrix(_xform())
		# Kicked-up dust, and speed lines when flying.
		if _mode == "race" and _speed[i] > 3.0 and randf() < 0.3:
			_jx.dust(Vector2(x - w * 0.3, y - 4), Color(0.75, 0.68, 0.5), 1)
		if i == 0 and _speed[0] > float(RUNNERS[_species]["top"]) * 0.75:
			for k: int in 4:
				var ly: float = y - h * (0.2 + 0.2 * k)
				var lx: float = x - w * 0.6 - fmod(_t * 900.0 + k * 70.0, 160.0)
				draw_line(Vector2(lx, ly), Vector2(lx - 50, ly), Color(1, 1, 1, 0.5), 3.0)
		if i == 0:
			draw_string(FelecoUiScript.font("heading"), Vector2(x - 40, y - h - hop - 12), "YOU", HORIZONTAL_ALIGNMENT_CENTER, 80, 20, FelecoUiScript.GOLD)
	_draw_hud()
	_jx.draw(self)
	draw_set_transform_matrix(Transform2D.IDENTITY)
	_jx.draw_flash(self, Rect2(Vector2.ZERO, size))

func _draw_hud() -> void:
	var font := FelecoUiScript.font("heading")
	draw_string(font, Vector2(30, 48), "%s  -  Race %d of %d" % [RACES[_race][0], _race + 1, RACES.size()], HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color.WHITE)
	# Progress strip with everyone on it.
	draw_rect(Rect2(30, 70, 600, 10), Color(0, 0, 0, 0.4))
	for i: int in LANES:
		draw_circle(Vector2(30 + 600 * _pos[i] / _length, 75), 9 if i == 0 else 6, FelecoUiScript.GOLD if i == 0 else Color(1, 1, 1, 0.8))
	draw_string(font, Vector2(VIEW.x - 500, 48), "%d m/s   %d m to go" % [int(_speed[0]), int(maxf(_length - _pos[0], 0.0))], HORIZONTAL_ALIGNMENT_RIGHT, 300, 22, Color.WHITE)
	# The prompt: typed part green, the rest white.
	if _mode == "race" and _finish_time[0] < 0.0:
		var label: String = ["Type the word!", "Type both words!", "Type the phrase!", "Type the whole line!"][_stage()]
		draw_string(font, Vector2(0, 150), label, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 24, FelecoUiScript.MIST)
		_draw_prompt(font)
	if _mode == "count":
		draw_string(font, Vector2(0, 230), str(int(ceil(_count))), HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 120, FelecoUiScript.GOLD)
	for k: int in _texts.size():
		var tx: Array = _texts[k]
		draw_string(font, Vector2(0, 280 - k * 30), tx[0], HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 28, Color(1, 0.85, 0.4, clampf(tx[1], 0, 1)))
	if _mode == "done":
		var place: int = _place()
		var acc: int = int(100.0 * _keys_right / maxf(_keys_right + _keys_wrong, 1))
		# Words per minute, the typist's measure: five keys to a word.
		var wpm: int = int(round(_keys_right / 5.0 / maxf(_finish_time[0], 1.0) * 60.0))
		var box := Rect2(VIEW.x * 0.5 - 300, 110, 600, 200)
		draw_rect(box, Color(0.06, 0.09, 0.07, 0.94))
		draw_rect(box, FelecoUiScript.GOLD, false, 3.0)
		draw_string(font, box.position + Vector2(0, 74), ["1st place! GOLD", "2nd place: Silver", "3rd place: Bronze", "4th place"][place - 1], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 46, [Color(1, 0.85, 0.2), Color(0.85, 0.88, 0.95), Color(0.85, 0.55, 0.3), Color(0.8, 0.8, 0.8)][place - 1])
		draw_string(font, box.position + Vector2(0, 124), "Time %.1f s     %d words a minute     Accuracy %d%%" % [_finish_time[0], wpm, acc], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 21, Color.WHITE)
		var note: String = "+%d EP" % EP_BY_PLACE[place - 1]
		if place <= 3 and _race + 1 < RACES.size():
			note += "   -   the next race is unlocked!"
		elif place > 3:
			note += "   -   top 3 unlocks the next race. Accuracy beats speed!"
		draw_string(font, box.position + Vector2(0, 166), note, HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 18, FelecoUiScript.GOLD)

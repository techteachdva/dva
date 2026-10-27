extends Control

# Herbivore campaign: Stampede Sprint. Your herbivore runs as fast as you
# type, and what you type is the valley's own chatter: chunks of the
# creatures' thoughts and the ticker's gossip. Short words first, longer
# runs of words as the finish nears. Every right key is a stride; a wrong
# one is a stumble. Four races, each with faster rivals.

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

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	theme = FelecoUiScript.theme()
	focus_mode = Control.FOCUS_ALL
	_show_select()
	# First time here: explain the game before anything else.
	if not HowToPlay.seen(self, "race"):
		HowToPlay.show(self, "race")

func _show_select() -> void:
	_mode = "select"
	if _end_btns != null:
		_end_btns.queue_free()
		_end_btns = null
	if _select != null:
		_select.queue_free()
	_select = PanelContainer.new()
	_select.set_anchors_preset(Control.PRESET_FULL_RECT)
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
	back.text = "Back"
	back.theme_type_variation = "GhostButton"
	back.custom_minimum_size = Vector2(200, 48)
	back.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn"))
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
	_length = float(RACES[_race][1])
	_rival_pace = float(RACES[_race][2])
	_pos = [0.0, 0.0, 0.0, 0.0]
	_speed = [0.0, 0.0, 0.0, 0.0]
	_finish_time = [-1.0, -1.0, -1.0, -1.0]
	_rival_species = []
	for sp: String in RUNNERS.keys():
		if sp != _species:
			_rival_species.append(sp)
	_t = 0.0
	_count = 3.0
	_mode = "count"
	_typed = 0
	_stumble = 0.0
	_keys_right = 0
	_keys_wrong = 0
	_texts.clear()
	_prompt = ""
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
	var lines := _dialog()
	var words: PackedStringArray = lines[randi() % lines.size()].split(" ", false)
	var want: int = [1, 2, 3, 5][_stage()]
	if want == 1:
		# Opening words are short and friendly.
		var short: Array = Array(words).filter(func(w: String) -> bool: return w.length() >= 3 and w.length() <= 6)
		_prompt = short[randi() % short.size()] if not short.is_empty() else words[0]
		return
	var start: int = randi() % maxi(words.size() - want + 1, 1)
	_prompt = " ".join(words.slice(start, start + want))

func _gui_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k == null or not k.pressed or k.echo or _mode != "race":
		return
	accept_event()
	if _finish_time[0] >= 0.0:
		return
	var ch: String = char(k.unicode).to_lower() if k.unicode > 0 else ""
	if ch.is_empty():
		return
	var want: String = _prompt.substr(_typed, 1)
	var sheet: Dictionary = RUNNERS[_species]
	if ch == want:
		_typed += 1
		_keys_right += 1
		# A stride: words are worth more per key (they're harder).
		var boost: float = [1.9, 2.1, 2.3, 2.5][_stage()] * float(sheet["stride"])
		_speed[0] = minf(_speed[0] + boost, float(sheet["top"]))
		if _typed >= _prompt.length():
			if _prompt.length() > 2:
				_speed[0] = minf(_speed[0] + 2.0, float(sheet["top"]) * 1.15)
				_texts.append(["Nice!", 0.8])
			_next_prompt()
	else:
		_keys_wrong += 1
		_stumble = 0.35 * (0.6 if _species == "goat" else 1.0)
		_speed[0] *= 0.55
		_texts.append(["Stumble!", 0.8])

# --- Race ---------------------------------------------------------------

func _process(delta: float) -> void:
	for t: Array in _texts:
		t[1] -= delta
	_texts = _texts.filter(func(t: Array) -> bool: return t[1] > 0.0)
	queue_redraw()
	if _mode == "count":
		_count -= delta
		if _count <= 0.0:
			_mode = "race"
		return
	if _mode != "race":
		return
	_t += delta
	_stumble = maxf(_stumble - delta, 0.0)
	# You slow down unless you keep typing, faster the faster you go: top
	# speed is set by how many right keys a second you can keep up.
	var drag: float = 1.0 + _speed[0] * 0.45 + (6.0 if _stumble > 0.0 else 0.0)
	_speed[0] = maxf(_speed[0] - delta * drag, 0.0)
	for i: int in range(1, LANES):
		# Rivals: a steady pace with a little wobble and a late kick.
		var pace: float = _rival_pace * (0.88 + 0.08 * i) * (1.0 + 0.06 * sin(_t * (0.7 + i * 0.3)))
		if _pos[i] > _length * 0.8:
			pace *= 1.08
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

func _end_race() -> void:
	_mode = "done"
	var place: int = _place()
	var medal: String = ["Gold", "Silver", "Bronze", "4th"][place - 1]
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		var order := ["4th", "Bronze", "Silver", "Gold"]
		var prev = gc.record("race", str(_race))
		if prev == null or order.find(medal) > order.find(String(prev)):
			gc.set_record("race", str(_race), medal)
		gc.award_eco_points([60, 35, 20, 5][place - 1])
	_end_btns = HBoxContainer.new()
	_end_btns.alignment = BoxContainer.ALIGNMENT_CENTER
	_end_btns.add_theme_constant_override("separation", 14)
	_end_btns.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_end_btns.offset_top = -110
	_end_btns.offset_bottom = -50
	_end_btns.offset_left = -300
	_end_btns.offset_right = 300
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
	draw_set_transform_matrix(_xform())
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
		var tilt: float = 0.3 if i == 0 and _stumble > 0.0 else 0.0
		draw_set_transform_matrix(_xform() * Transform2D(tilt, Vector2(x, y - hop)))
		draw_texture_rect(tex, Rect2(-w * 0.5, -h, w, h), false)
		draw_set_transform_matrix(_xform())
		if i == 0:
			draw_string(FelecoUiScript.font("heading"), Vector2(x - 40, y - h - hop - 12), "YOU", HORIZONTAL_ALIGNMENT_CENTER, 80, 20, FelecoUiScript.GOLD)
	_draw_hud()
	draw_set_transform_matrix(Transform2D.IDENTITY)

func _draw_hud() -> void:
	var font := FelecoUiScript.font("heading")
	draw_string(font, Vector2(30, 48), "%s  -  Race %d of %d" % [RACES[_race][0], _race + 1, RACES.size()], HORIZONTAL_ALIGNMENT_LEFT, -1, 26, Color.WHITE)
	# Progress strip with everyone on it.
	draw_rect(Rect2(30, 70, 600, 10), Color(0, 0, 0, 0.4))
	for i: int in LANES:
		draw_circle(Vector2(30 + 600 * _pos[i] / _length, 75), 9 if i == 0 else 6, FelecoUiScript.GOLD if i == 0 else Color(1, 1, 1, 0.8))
	draw_string(font, Vector2(VIEW.x - 330, 48), "%d m/s   %d m to go" % [int(_speed[0]), int(maxf(_length - _pos[0], 0.0))], HORIZONTAL_ALIGNMENT_RIGHT, 300, 22, Color.WHITE)
	# The prompt: typed part green, the rest white.
	if _mode == "race" and _finish_time[0] < 0.0:
		var label: String = ["Type the word!", "Type both words!", "Type the phrase!", "Type the whole line!"][_stage()]
		draw_string(font, Vector2(0, 150), label, HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 24, FelecoUiScript.MIST)
		var big: int = 72 if _prompt.length() <= 8 else (52 if _prompt.length() <= 20 else 38)
		var word: String = _prompt.to_upper()
		var full_w: float = font.get_string_size(word, HORIZONTAL_ALIGNMENT_LEFT, -1, big).x
		var x0: float = (VIEW.x - full_w) * 0.5
		var done: String = word.substr(0, _typed)
		var rest: String = word.substr(_typed)
		draw_string(font, Vector2(x0, 240), done, HORIZONTAL_ALIGNMENT_LEFT, -1, big, Color(0.5, 1.0, 0.45))
		var dw: float = font.get_string_size(done, HORIZONTAL_ALIGNMENT_LEFT, -1, big).x
		draw_string(font, Vector2(x0 + dw, 240), rest, HORIZONTAL_ALIGNMENT_LEFT, -1, big, Color(1, 0.4, 0.35) if _stumble > 0.0 else Color.WHITE)
	if _mode == "count":
		draw_string(font, Vector2(0, 230), str(int(ceil(_count))), HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 120, FelecoUiScript.GOLD)
	for k: int in _texts.size():
		var tx: Array = _texts[k]
		draw_string(font, Vector2(0, 280 - k * 30), tx[0], HORIZONTAL_ALIGNMENT_CENTER, VIEW.x, 28, Color(1, 0.85, 0.4, clampf(tx[1], 0, 1)))
	if _mode == "done":
		var place: int = _place()
		var acc: int = int(100.0 * _keys_right / maxf(_keys_right + _keys_wrong, 1))
		var box := Rect2(VIEW.x * 0.5 - 300, 110, 600, 170)
		draw_rect(box, Color(0.06, 0.09, 0.07, 0.94))
		draw_rect(box, FelecoUiScript.GOLD, false, 3.0)
		draw_string(font, box.position + Vector2(0, 74), ["1st place! GOLD", "2nd place: Silver", "3rd place: Bronze", "4th place"][place - 1], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 46, [Color(1, 0.85, 0.2), Color(0.85, 0.88, 0.95), Color(0.85, 0.55, 0.3), Color(0.8, 0.8, 0.8)][place - 1])
		draw_string(font, box.position + Vector2(0, 126), "Time %.1f s     Accuracy %d%%" % [_finish_time[0], acc], HORIZONTAL_ALIGNMENT_CENTER, box.size.x, 22, Color.WHITE)

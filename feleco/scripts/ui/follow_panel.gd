class_name FollowPanel
extends PanelContainer

# Follow mode: click a creature in the valley and the camera rides along
# while this card narrates it, after Dwarf Fortress's thoughts screen: a
# coloured emotional status with its cause, a fixed personality that shades
# how it feels things, and dated memories ("felt satisfaction after a good
# meal") triggered by what actually happens to it.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

signal stopped

# What each state looks like from outside: [doing, thought].
const STATES: Dictionary = {
	"Graze": ["Grazing", "Mm, sweet grass."],
	"Forage": ["Foraging", "Something good is under here somewhere."],
	"Gather": ["Gathering food", "Berries, seed, anything for the pot."],
	"Eat": ["Eating", "Finally, a proper meal."],
	"Hunt": ["Hunting", "Easy... stay downwind..."],
	"Chase": ["Chasing prey", "Faster! Don't let it get away!"],
	"Dive": ["Diving on prey", "There, in the open. Now!"],
	"Charge": ["Charging", "Out of my way!"],
	"Flee": ["Running for its life", "Run, run, RUN!"],
	"Rest": ["Resting", "Just a moment to get my breath back."],
	"Sleep": ["Asleep", "Zzz..."],
	"Idle": ["Standing about", "Nothing to worry about. Probably."],
	"Walk": ["Ambling along", "Where's the rest of the flock?"],
	"Wander": ["Roaming", "Something will turn up."],
	"Patrol": ["Circling overhead", "I can see everything from up here."],
	"Fly": ["Flying", "Wind under the wings."],
	"Land": ["Landing", "Down we go."],
	"Mate": ["Courting", "Ahem. Lovely evening, isn't it?"],
	"Travel": ["Heading home", "Home is that way."],
	"Defend": ["Defending the village", "Not one step closer."],
	"Raid": ["Marching on a rival village", "Their huts, our timber."],
	"Build": ["Building", "One more beam and it'll stand."],
	"Channel": ["Channelling magic", "The rain is listening."],
	"Group": ["Gathering the sounder", "Stick together, everyone."],
	"Scavenge": ["Scavenging", "Someone left dinner lying around."],
	"Swim": ["Swimming", "Upstream, downstream, it's all water."],
	"Stranded": ["Stranded on dry land", "Water... where did the water go?"],
	"Crawl": ["Burrowing", "Dark, damp, delicious."],
	"Drift": ["Drifting on the wind", "Where will I land?"],
	"Anchor": ["Taking root", "This spot will do."],
	"Fruit": ["Fruiting", "Spreading spores to the wind."],
}
const NOCTURNAL: Array[String] = ["wolf", "boar", "worm", "mushroom"]

# Personality, fixed per creature from its seed: [word, how it shades feelings].
const TRAITS: Array = [
	["bold", "barely"], ["timid", "deeply"], ["curious", "keenly"], ["greedy", "hungrily"],
	["steady", "calmly"], ["restless", "sharply"], ["gentle", "softly"], ["proud", "fiercely"],
]
const KIN: Dictionary = {
	"sheep": "flock", "wolf": "pack", "human": "village", "falcon": "kin", "robin": "flock",
	"boar": "sounder", "rabbit": "warren", "worm": "kin", "fish": "shoal", "mushroom": "ring",
}
const PREDATORS: Array[String] = ["wolf", "falcon", "human", "boar"]
# Emotion colours: warm good, cold sad, red bad (Dwarf Fortress colours its
# emotion words the same way, so a glance reads the mood).
const GOOD := "#9fd88a"
const CALM := "#c9d4c2"
const SAD := "#8fb3e8"
const BAD := "#e8826b"
const DREAD := "#d8a24a"

var agent: MarkovAgent
var director: SimulationDirector
var _art: TextureRect
var _name: Label
var _kind: Label
var _doing: Label
var _mood: RichTextLabel
var _thought: Label
var _bars: Dictionary = {}
var _memories: RichTextLabel
var _lines: Array[String] = []
var _accum: float = 0.0
var _gone: bool = false
var _trait: Array = ["steady", "calmly"]
# Last seen values, so thoughts fire on change.
var _last: Dictionary = {}
var _cool: Dictionary = {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	custom_minimum_size = Vector2(440, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.94)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(18)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 14)
	add_theme_stylebox_override("panel", sb)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 5)
	add_child(col)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	col.add_child(head)
	_art = TextureRect.new()
	_art.custom_minimum_size = Vector2(64, 56)
	_art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	head.add_child(_art)
	var names := VBoxContainer.new()
	names.add_theme_constant_override("separation", 0)
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(names)
	_name = FelecoUiScript.heading("", 22, FelecoUiScript.GOLD)
	names.add_child(_name)
	_kind = FelecoUiScript.label("", 14, FelecoUiScript.MIST)
	names.add_child(_kind)
	_rampage_btn = Button.new()
	_rampage_btn.text = "Rampage!"
	_rampage_btn.theme_type_variation = "PrimaryButton"
	_rampage_btn.custom_minimum_size = Vector2(110, 40)
	_rampage_btn.tooltip_text = "Take this golden creature in hand and spend its gold: WASD or arrows to steer (or hold a finger where it should go). It devours anything not of its own kind until the gold runs out. Gold burns faster as it goes: devour 12 before it runs out to win a Greenhouse upgrade."
	_rampage_btn.visible = false
	_rampage_btn.pressed.connect(_on_rampage)
	head.add_child(_rampage_btn)
	_mine_btn = Button.new()
	_mine_btn.text = "Make Mine"
	_mine_btn.theme_type_variation = "PrimaryButton"
	_mine_btn.custom_minimum_size = Vector2(110, 40)
	_mine_btn.tooltip_text = "Adopt this animal: it earns XP, levels up, and you can train, rename and colour it."
	_mine_btn.pressed.connect(func() -> void:
		var goals: Node = get_tree().get_first_node_in_group("goals_panel")
		if goals != null:
			goals.call("adopt", agent)
		_mine_btn.visible = false)
	head.add_child(_mine_btn)
	var stop := Button.new()
	stop.text = "Stop"
	stop.theme_type_variation = "GhostButton"
	stop.custom_minimum_size = Vector2(76, 40)
	stop.tooltip_text = "Stop following."
	stop.pressed.connect(func() -> void: stopped.emit())
	head.add_child(stop)
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 3)
	col.add_child(grid)
	for b: Array in [["health", "Health", FelecoUiScript.CLAY], ["energy", "Food", FelecoUiScript.LEAF], ["age", "Age", FelecoUiScript.MIST], ["herd", "Herd", FelecoUiScript.GOLD]]:
		grid.add_child(FelecoUiScript.label(b[1], 13, FelecoUiScript.CREAM))
		var bar := ProgressBar.new()
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(140, 9)
		bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var fill := StyleBoxFlat.new()
		fill.bg_color = b[2]
		fill.set_corner_radius_all(4)
		var bg := StyleBoxFlat.new()
		bg.bg_color = Color(1, 1, 1, 0.08)
		bg.set_corner_radius_all(4)
		bar.add_theme_stylebox_override("fill", fill)
		bar.add_theme_stylebox_override("background", bg)
		bar.tooltip_text = b[1]
		grid.add_child(bar)
		_bars[b[0]] = bar
	_doing = FelecoUiScript.heading("", 18, FelecoUiScript.CREAM)
	_doing.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_doing)
	_mood = _rich(15)
	col.add_child(_mood)
	_thought = FelecoUiScript.label("", 15, Color(0.85, 0.9, 1.0))
	_thought.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(_thought)
	col.add_child(FelecoUiScript.heading("Recent thoughts", 14, FelecoUiScript.GOLD))
	_memories = _rich(13)
	col.add_child(_memories)
	FelecoUiScript.dress_hud(self)
	_trait = TRAITS[agent.get_instance_id() % TRAITS.size()]
	_art.texture = FelecoUiScript.species_texture(agent.species_id, Roles.role_index(agent.role), agent.sex == "female")
	_name.text = agent.display_name if not agent.display_name.is_empty() else agent.species_id.capitalize()
	var kind: String = Roles.display_name(agent.species_id, agent.role)
	var who: String = ("%s %s" % [agent.sex, kind.to_lower()]).strip_edges().capitalize() if agent.sex != "" else kind
	_kind.text = "%s  ·  %s  ·  %s" % [who, _trait[0], Genetics.describe(agent.genes)]
	agent.state_changed.connect(_on_state_changed)
	if director != null:
		director.agent_died.connect(_on_death_nearby)
		director.combat_event.connect(_on_fight_nearby)
	_snapshot()
	_remember(CALM, "noticed", "that someone is watching it closely")
	_refresh()

func _rich(fs: int) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.add_theme_font_size_override("normal_font_size", fs)
	r.add_theme_font_size_override("bold_font_size", fs)
	r.add_theme_font_override("bold_font", FelecoUiScript.font("bold"))
	r.add_theme_color_override("default_color", FelecoUiScript.MIST)
	return r

func _snapshot() -> void:
	_last = {
		"hp": _stat("health"), "en": _stat("energy"), "herd": agent.herd,
		"night": director != null and director.is_night(),
		"old": agent._age > agent._lifespan * 0.75, "indoors": agent.get("indoors") == true,
	}

func _stat(key: String) -> float:
	var v = agent.get(key)
	return float(v) if v != null else 50.0

# A dated memory with its emotion coloured. key throttles repeats.
func _remember(color: String, verb: String, cause: String, key: String = "", cool: float = 20.0) -> void:
	var now: float = Time.get_ticks_msec() / 1000.0
	if not key.is_empty():
		if now < float(_cool.get(key, 0.0)):
			return
		_cool[key] = now + cool
	var when: String = ""
	if director != null:
		when = "Day %d, %s" % [int(director.get_day()) + 1, "night" if director.is_night() else "day"]
	_lines.push_front("[color=#8a9686]%s[/color]  [color=%s][b]%s[/b][/color] %s" % [when, color, verb, cause])
	while _lines.size() > 5:
		_lines.pop_back()
	_memories.text = "\n".join(_lines)

# The trait shades strong feelings: timid creatures feel fear deeply, bold
# ones barely, and so on.
func _felt(emotion: String) -> String:
	return "felt %s %s" % [_trait[1], emotion]

func _on_state_changed(_old: String, new_state: String) -> void:
	match new_state:
		"Flee":
			_remember(BAD, _felt("afraid"), "as a hunter closed in", "flee", 15.0)
		"Chase", "Hunt", "Dive", "Charge":
			_remember(DREAD, "felt the thrill", "of the hunt", "hunt", 25.0)
		"Raid":
			_remember(DREAD, "felt fierce resolve", "marching on a rival village", "raid", 40.0)
		"Build":
			_remember(GOOD, "felt pride", "raising walls for the %s" % KIN.get(agent.species_id, "kin"), "build", 40.0)
		"Mate", "Group":
			_remember(GOOD, "felt warmth", "toward its own kind", "warm", 40.0)
		"Stranded":
			_remember(BAD, _felt("panicked"), "as the water drained away", "strand", 30.0)

func _on_death_nearby(species: String, pos: Vector3) -> void:
	if _gone or not is_instance_valid(agent) or species != agent.species_id:
		return
	if pos.distance_to(agent.global_position) < 10.0:
		_remember(SAD, _felt("grief"), "watching one of its %s fall" % KIN.get(species, "kin"), "grief", 30.0)

func _on_fight_nearby(attacker: String, target: String, pos: Vector3, killed: bool) -> void:
	if _gone or not is_instance_valid(agent) or pos.distance_to(agent.global_position) > 3.0:
		return
	if attacker == agent.species_id and killed:
		_remember(GOOD, "felt fierce satisfaction", "after bringing down a %s" % target, "kill", 10.0)
	elif target == agent.species_id and not killed:
		_remember(BAD, "felt the shock", "of an attack by a %s, and lived" % attacker, "hit", 10.0)

var _mine_btn: Button
var _rampage_btn: Button
var _rampage_bar: ProgressBar
var _rampaging: bool = false

func _camera() -> Camera3D:
	return get_tree().current_scene.get_node_or_null("Camera3D") as Camera3D if get_tree().current_scene != null else null

# Before the gold starts burning, a card says plainly what to do. The valley
# holds still until the player presses Go.
func _on_rampage() -> void:
	if agent == null or not is_instance_valid(agent) or agent.golden <= 0.05:
		return
	var goal: int = int(get_node("/root/GameConfig").RAMPAGE_GOAL)
	var was_paused: bool = get_tree().paused
	get_tree().paused = true
	var layer := CanvasLayer.new()
	layer.layer = 50
	layer.process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().root.add_child(layer)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.5)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(shade)
	var card := PanelContainer.new()
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(500, 0)
	card.add_theme_stylebox_override("panel", get_theme_stylebox("panel"))
	shade.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	card.add_child(col)
	col.add_child(FelecoUiScript.heading("RAMPAGE!", 32, FelecoUiScript.GOLD))
	for line: String in [
		"Goal: devour %d creatures before your gold runs out." % goal,
		"Steer with WASD or the arrow keys, or hold your finger (or mouse) where you want to go.",
		"Run right into other animals to eat them. Your own kind is safe.",
		"The gold bar drains faster and faster. Win to unlock a Greenhouse upgrade!",
	]:
		var l := FelecoUiScript.label(line, 18, FelecoUiScript.CREAM)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(l)
	var go := Button.new()
	go.text = "Go!"
	go.theme_type_variation = "PrimaryButton"
	go.custom_minimum_size = Vector2(0, 50)
	col.add_child(go)
	go.grab_focus()
	await go.pressed
	layer.queue_free()
	get_tree().paused = was_paused
	if agent == null or not is_instance_valid(agent) or not agent.start_rampage():
		return
	_rampaging = true
	_rampage_btn.visible = false
	var cam := _camera()
	if cam != null:
		cam.set("locked", true)
	if _rampage_bar == null:
		_rampage_bar = ProgressBar.new()
		_rampage_bar.max_value = 1.0
		_rampage_bar.custom_minimum_size = Vector2(0, 14)
		_rampage_bar.show_percentage = false
		_rampage_bar.modulate = Color(1.0, 0.85, 0.3)
		_doing.get_parent().add_child(_rampage_bar)
		_doing.get_parent().move_child(_rampage_bar, _doing.get_index())
	_rampage_bar.visible = true
	agent.rampage_ended.connect(_on_rampage_ended, CONNECT_ONE_SHOT)

func _on_rampage_ended(kills: int) -> void:
	_rampaging = false
	var cam := _camera()
	if cam != null:
		cam.set("locked", false)
	if _rampage_bar != null:
		_rampage_bar.visible = false
	_remember(GOOD, "felt the gold burn away", "after a rampage of %d kills" % kills, "rampage", 60.0)

# Steering: keys move relative to the camera; a held finger or mouse button
# pulls the creature toward that spot on the ground.
func _steer_rampage() -> void:
	var cam := _camera()
	var steer := Vector3.ZERO
	if cam != null and cam.has_method("flat_forward"):
		var fwd: Vector3 = cam.flat_forward()
		var right: Vector3 = cam.flat_right()
		if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP): steer += fwd
		if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN): steer -= fwd
		if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT): steer += right
		if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT): steer -= right
		if steer == Vector3.ZERO and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and get_viewport().gui_get_hovered_control() == null:
			var mp := get_viewport().get_mouse_position()
			var from := cam.project_ray_origin(mp)
			var dir := cam.project_ray_normal(mp)
			if absf(dir.y) > 0.01:
				var t: float = (agent.global_position.y - from.y) / dir.y
				var hit: Vector3 = from + dir * t
				var to: Vector3 = hit - agent.global_position
				to.y = 0.0
				if to.length() > 0.8:
					steer = to.normalized()
	agent.rampage_steer = steer.normalized() if steer != Vector3.ZERO else Vector3.ZERO

func _process(delta: float) -> void:
	if _gone:
		return
	if _rampaging and agent != null and is_instance_valid(agent) and not agent.is_queued_for_deletion():
		_steer_rampage()
		_rampage_bar.value = agent.golden
		var goal: int = int(get_node("/root/GameConfig").RAMPAGE_GOAL)
		_doing.text = "On a rampage: %d / %d kills%s" % [agent.rampage_kills, goal, "  WON!" if agent.rampage_kills >= goal else ""]
	if agent == null or not is_instance_valid(agent) or agent.is_queued_for_deletion():
		if _rampaging:
			_on_rampage_ended(0)
		_gone = true
		_doing.text = "%s has died." % _name.text
		_mood.text = "[color=%s][b]At rest[/b][/color]  Its body returns to the meadow." % SAD
		_thought.text = ""
		return
	_accum += delta
	if _accum >= 0.4:
		_accum = 0.0
		_rampage_btn.visible = not _rampaging and agent.golden > 0.05
		var goals: Node = get_tree().get_first_node_in_group("goals_panel")
		_mine_btn.visible = not _rampaging and goals != null and not goals.call("is_companion", agent)
		if _rampaging:
			return
		_watch_changes()
		_refresh()

# New memories from changed circumstances: meals, wounds, the herd, the
# hour, hunger, age and where it slept.
func _watch_changes() -> void:
	var hp: float = _stat("health")
	var en: float = _stat("energy")
	var night: bool = director != null and director.is_night()
	var nocturnal: bool = NOCTURNAL.has(agent.species_id)
	var kin: String = KIN.get(agent.species_id, "kin")
	if en > float(_last["en"]) + 8.0:
		_remember(GOOD, "felt satisfaction", "after %s" % ("a good meal" if PREDATORS.has(agent.species_id) else "a fine feed"), "meal", 25.0)
	if hp < float(_last["hp"]) - 15.0:
		_remember(BAD, _felt("shaken"), "by a terrible wound", "wound", 8.0)
	elif hp < float(_last["hp"]) - 5.0:
		_remember(BAD, "felt pain", "from a fresh wound", "wound", 8.0)
	if agent.herd > 0.55 and float(_last["herd"]) <= 0.55:
		_remember(GOOD, "felt safe", "in the middle of its %s" % kin, "herd_in", 30.0)
	elif agent.herd < 0.08 and float(_last["herd"]) >= 0.3:
		_remember(SAD, _felt("anxious"), "cut off from its %s" % kin, "herd_out", 30.0)
	if night != bool(_last["night"]):
		if night and nocturnal:
			_remember(GOOD, "felt a thrill", "as the moon rose", "dusk", 60.0)
		elif night:
			_remember(DREAD, "felt uneasy", "as darkness fell", "dusk", 60.0)
		elif nocturnal:
			_remember(CALM, "grew drowsy", "in the morning light", "dawn", 60.0)
		else:
			_remember(GOOD, "felt relief", "at first light", "dawn", 60.0)
	if en < 20.0 and float(_last["en"]) >= 20.0:
		_remember(BAD, _felt("distressed"), "by gnawing hunger", "hunger", 40.0)
	var old: bool = agent._age > agent._lifespan * 0.75
	if old and not bool(_last["old"]):
		_remember(SAD, "felt the weight", "of its years", "old", 999.0)
	var indoors: bool = agent.get("indoors") == true
	if indoors and not bool(_last["indoors"]):
		_remember(GOOD, "felt cozy", "asleep at home", "home", 60.0)
	if agent.get("cranky") != null and float(agent.get("cranky")) > 0.95:
		_remember(BAD, "felt cold and cranky", "after a night in the open", "rough", 120.0)
	_snapshot()

func _refresh() -> void:
	var state: String = agent.current_state()
	var words: Array = STATES.get(state, [state, ""])
	var doing: String = words[0]
	if agent.get("indoors") == true:
		doing = "Asleep at home"
	elif state == "Sleep" and agent.species_id == "human":
		doing = "Sleeping rough under the stars"
	_doing.text = doing
	var mood: Array = _mood_now(state)
	_mood.text = "[color=%s][b]%s[/b][/color]  %s" % [mood[1], mood[0], mood[2]]
	_thought.text = "“%s”" % _think(state, String(words[1]))
	(_bars["health"] as ProgressBar).value = clampf(_stat("health"), 0.0, 100.0)
	(_bars["energy"] as ProgressBar).value = clampf(_stat("energy"), 0.0, 100.0)
	(_bars["herd"] as ProgressBar).value = agent.herd * 100.0
	(_bars["age"] as ProgressBar).value = clampf(agent._age / maxf(agent._lifespan, 1.0) * 100.0, 0.0, 100.0)

# The emotional status: [word, colour, why].
func _mood_now(state: String) -> Array:
	var hp: float = _stat("health")
	var en: float = _stat("energy")
	var kin: String = KIN.get(agent.species_id, "kin")
	if state == "Flee":
		return ["Terrified", BAD, "Something is hunting it."]
	if hp < 30.0:
		return ["In agony", BAD, "Badly hurt, and it knows it."]
	if en < 20.0:
		return ["Miserable", DREAD, "Starving."]
	if agent.get("cranky") != null and float(agent.get("cranky")) > 0.4:
		return ["Grumpy", DREAD, "A bad night's sleep."]
	if agent.herd > 0.55:
		return ["Secure", GOOD, "Deep in its %s." % kin]
	if agent.herd < 0.05 and agent.species_id not in ["worm", "mushroom"]:
		return ["Lonely", SAD, "None of its %s nearby." % kin]
	if agent._age > agent._lifespan * 0.85:
		return ["Weary", SAD, "Old now, and slowing."]
	if hp > 70.0 and en > 65.0:
		return ["Content", GOOD, "Fed, whole and among its own."]
	return ["Watchful", CALM, "Getting by."]

# The inner voice: the most pressing thing on its mind right now.
func _think(state: String, default: String) -> String:
	var hp: float = float(agent.get("health")) if agent.get("health") != null else 50.0
	var en: float = float(agent.get("energy")) if agent.get("energy") != null else 50.0
	var night: bool = director != null and director.is_night()
	var nocturnal: bool = NOCTURNAL.has(agent.species_id)
	if state == "Flee":
		return "Something is after me!"
	if hp < 25.0:
		return "I'm hurt badly. I need to rest somewhere safe."
	if en < 15.0:
		return "So hungry I can barely stand."
	if agent.get("cranky") != null and float(agent.get("cranky")) > 0.5:
		return "Slept on rocks all night. Don't talk to me."
	if agent._age > agent._lifespan * 0.85:
		return "My bones ache. I've seen a lot of seasons."
	if en < 35.0 and state not in ["Eat", "Graze", "Forage", "Gather", "Hunt", "Chase", "Dive"]:
		return "My stomach is growling. Food first."
	if agent.herd > 0.6 and state != "Sleep":
		return "The pack is with me. Let's hunt." if agent.species_id in ["wolf", "falcon", "human"] else "Safe in the middle of the flock."
	if agent.herd < 0.05 and state in ["Graze", "Walk", "Wander", "Forage"]:
		return "Where did everyone go? It isn't safe out here alone."
	if night and not nocturnal and state != "Sleep" and agent.species_id != "fish":
		return "It's dark. I should be tucked up somewhere safe."
	if night and nocturnal and state not in ["Sleep", "Eat"]:
		return "The night belongs to me."
	if not night and nocturnal and state in ["Wander", "Sleep"]:
		return "Too bright. I'll wait for the moon."
	return default if not default.is_empty() else "Just getting on with things."

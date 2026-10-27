class_name LevelUpMenu
extends CanvasLayer

# My Creature's level-up menu. The valley pauses while it is open. A full
# XP bar is cashed in by winning a Feast; skill points are spent on the five
# upgrade lines, each trained by winning its own minigame (CreatureTrials).
# A point is only spent when the trial is won.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const Brawl = preload("res://scripts/minigames/predator_brawl.gd")

# [id, name, trial, what each rank does].
const LINES: Array = [
	["speed", "Speed", "evade", "Runs 10% faster per rank. Trial: Evade your predator."],
	["tough", "Toughness", "shove", "Heals itself a little every second. Trial: Shove a rival out of the ring."],
	["vital", "Vitality", "bigfeast", "Lives 10% longer per rank. Trial: the Big Feast."],
	["senses", "Senses", "sniff", "Spots food and danger 15% further per rank. Trial: Sniff Out."],
	["charm", "Charm", "dance", "Ready to raise young sooner. Trial: the Courtship Dance."],
]
const MAX_RANK: int = 5

var goals: GoalsPanel
var _root: Control
var _was_paused: bool = false
# The valley's speed (1x, 2x, 4x) must not leak into the trials: a 20 s
# Evade at 4x would be a five-second blur. Pin real time while this is open.
var _was_speed: float = 1.0

func _ready() -> void:
	layer = 60
	process_mode = Node.PROCESS_MODE_ALWAYS
	_was_paused = get_tree().paused
	_was_speed = Engine.time_scale
	Engine.time_scale = 1.0
	get_tree().paused = true
	_build()

func _close() -> void:
	get_tree().paused = _was_paused
	Engine.time_scale = _was_speed
	goals.refresh_now()
	queue_free()

func _build() -> void:
	if _root != null:
		_root.queue_free()
	_root = ColorRect.new()
	(_root as ColorRect).color = Color(0, 0, 0, 0.65)
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.theme = FelecoUiScript.theme()
	add_child(_root)
	var card := PanelContainer.new()
	card.set_anchors_preset(Control.PRESET_CENTER)
	card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	card.grow_vertical = Control.GROW_DIRECTION_BOTH
	card.custom_minimum_size = Vector2(820, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.98)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(18)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 22)
	card.add_theme_stylebox_override("panel", sb)
	_root.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	card.add_child(col)
	var c: MarkovAgent = goals.companion
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 16)
	col.add_child(head)
	var pic := TextureRect.new()
	pic.texture = Brawl.portrait(c.species_id)
	pic.modulate = goals.tint()
	pic.custom_minimum_size = Vector2(150, 110)
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	head.add_child(pic)
	var names := VBoxContainer.new()
	names.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(names)
	names.add_child(FelecoUiScript.heading("%s  -  Level %d" % [c.display_name, goals.level], 30, FelecoUiScript.GOLD))
	var xpbar := ProgressBar.new()
	xpbar.max_value = goals.xp_needed()
	xpbar.value = goals.xp
	xpbar.show_percentage = false
	xpbar.custom_minimum_size = Vector2(0, 16)
	var fill := StyleBoxFlat.new()
	fill.bg_color = FelecoUiScript.GOLD
	fill.set_corner_radius_all(6)
	xpbar.add_theme_stylebox_override("fill", fill)
	names.add_child(xpbar)
	var ready: bool = goals.xp >= goals.xp_needed()
	names.add_child(FelecoUiScript.label(("XP full! Win a Feast to reach level %d." % (goals.level + 1)) if ready else "XP %d / %d: eat and stay alive to earn more." % [int(goals.xp), int(goals.xp_needed())], 16, Color(0.7, 1.0, 0.6) if ready else FelecoUiScript.MIST))
	names.add_child(FelecoUiScript.label("Skill points: %d   (each level gives one)" % goals.points, 18, FelecoUiScript.CREAM))
	var feast := Button.new()
	feast.text = "LEVEL UP: Feast!"
	feast.theme_type_variation = "PrimaryButton"
	feast.custom_minimum_size = Vector2(220, 56)
	feast.disabled = not ready
	feast.pressed.connect(func() -> void: _trial("feast", ""))
	head.add_child(feast)
	col.add_child(FelecoUiScript.divider())
	for line: Array in LINES:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		col.add_child(row)
		var rank: int = int(goals.skills.get(line[0], 0))
		var nm := FelecoUiScript.heading(line[1], 20, FelecoUiScript.GOLD)
		nm.custom_minimum_size = Vector2(120, 0)
		row.add_child(nm)
		var bar := ProgressBar.new()
		bar.max_value = MAX_RANK
		bar.value = rank
		bar.show_percentage = false
		bar.custom_minimum_size = Vector2(110, 14)
		bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(bar)
		var about := FelecoUiScript.label("%d/%d  %s" % [rank, MAX_RANK, line[3]], 15, FelecoUiScript.MIST)
		about.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		about.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(about)
		var b := Button.new()
		b.text = "Train" if rank < MAX_RANK else "Max"
		b.custom_minimum_size = Vector2(110, 44)
		b.disabled = goals.points <= 0 or rank >= MAX_RANK
		b.tooltip_text = "Costs 1 skill point, only if you win the trial."
		var id: String = line[0]
		var trial: String = line[2]
		b.pressed.connect(func() -> void: _trial(trial, id))
		row.add_child(b)
	var close := Button.new()
	close.text = "Back to the valley"
	close.theme_type_variation = "GhostButton"
	close.custom_minimum_size = Vector2(0, 48)
	close.pressed.connect(_close)
	col.add_child(close)

func _trial(mode: String, skill: String) -> void:
	if not goals.alive():
		_close()
		return
	_root.visible = false
	var t := CreatureTrials.new()
	t.mode = mode
	t.species = goals.companion.species_id
	t.tint = goals.tint()
	t.rank = int(goals.skills.get(skill, 0)) if not skill.is_empty() else 0
	add_child(t)
	t.finished.connect(func(won: bool) -> void:
		t.queue_free()
		if won:
			if skill.is_empty():
				goals.level_up()
			else:
				goals.train(skill)
			# A win goes straight back to the valley; a loss returns here
			# so the player can try again.
			_close()
		else:
			_build())

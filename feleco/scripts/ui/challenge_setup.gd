extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# Challenge mode (3.0): a series of "what if" years, each bending one link of
# the food web (see ChallengeScenarios). Playing a year through unlocks the
# next one; the results screen explains what happened and why.

var _frame: Dictionary = {}
var _list: VBoxContainer
var _title: Label
var _lesson: Label
var _changes: Label
var _question: Label
var _points_label: Label
var _selected: String = ""

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.reset_run_state()
	gc.current_mode = "challenge"

	_frame = FelecoUiScript.build_screen(self, "Challenge: What If?", _on_back)
	var body: BoxContainer = _frame["body"]

	var years := FelecoUiScript.card(body, "The years", 0.9)
	_points_label = FelecoUiScript.label("", 16, FelecoUiScript.GOLD)
	years.add_child(_points_label)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	years.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 6)
	scroll.add_child(_list)

	var detail := FelecoUiScript.card(body, "This year", 1.2)
	_title = FelecoUiScript.heading("", 26, FelecoUiScript.GOLD)
	detail.add_child(_title)
	_lesson = _wrap(FelecoUiScript.label("", 17, FelecoUiScript.CREAM))
	detail.add_child(_lesson)
	detail.add_child(FelecoUiScript.label("What's different", 16, FelecoUiScript.GOLD))
	_changes = _wrap(FelecoUiScript.label("", 15, FelecoUiScript.MIST))
	detail.add_child(_changes)
	detail.add_child(FelecoUiScript.label("This year's question (a bet on the table)", 16, FelecoUiScript.GOLD))
	_question = _wrap(FelecoUiScript.label("", 17, FelecoUiScript.CREAM))
	detail.add_child(_question)
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	detail.add_child(spacer)
	var reset := Button.new()
	reset.text = "Reset challenge progress"
	reset.theme_type_variation = "DangerButton"
	reset.add_theme_font_size_override("font_size", 15)
	reset.pressed.connect(_on_reset_progress)
	detail.add_child(reset)

	var footer: HBoxContainer = _frame["footer"]
	var shop := Button.new()
	shop.text = "Greenhouse"
	shop.icon = load("res://assets/icons/shop.svg")
	shop.custom_minimum_size = Vector2(240, 60)
	shop.pressed.connect(_on_shop)
	footer.add_child(shop)
	var start := Button.new()
	start.text = "To the betting table"
	start.icon = load("res://assets/icons/start.svg")
	start.custom_minimum_size = Vector2(380, 60)
	start.add_theme_font_size_override("font_size", 24)
	start.theme_type_variation = "PrimaryButton"
	start.pressed.connect(_on_start)
	footer.add_child(start)

	FelecoUiScript.dress_menu(self)
	_build_list()
	var unlocked: int = clampi(int(gc.challenge_level), 0, ChallengeScenarios.LIST.size() - 1)
	_select(ChallengeScenarios.LIST[unlocked]["id"])

func _wrap(l: Label) -> Label:
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l

func _build_list() -> void:
	var gc: Node = get_node("/root/GameConfig")
	_points_label.text = "Eco Points: %d" % gc.eco_points
	for c in _list.get_children():
		c.queue_free()
	for i: int in ChallengeScenarios.LIST.size():
		var s: Dictionary = ChallengeScenarios.LIST[i]
		var b := Button.new()
		var done: bool = i < int(gc.challenge_level)
		var locked: bool = i > int(gc.challenge_level)
		b.text = "%d.  %s%s" % [i + 1, s["title"], "  (played)" if done else ""]
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(0, 48)
		b.toggle_mode = true
		b.disabled = locked
		b.tooltip_text = "Play the year before to unlock this one." if locked else String(s["lesson"])
		b.pressed.connect(_select.bind(s["id"]))
		_list.add_child(b)

func _select(id: String) -> void:
	_selected = id
	var s := ChallengeScenarios.find(id)
	var idx := ChallengeScenarios.index_of(id)
	for i: int in _list.get_child_count():
		(_list.get_child(i) as Button).button_pressed = i == idx
	(_frame["title"] as Label).text = "Challenge %d: %s" % [idx + 1, s["title"]]
	_title.text = s["title"]
	_lesson.text = s["lesson"]
	_changes.text = _describe_setup(s)
	_question.text = "%s?" % s["bet"]["label"]

func _describe_setup(s: Dictionary) -> String:
	var lines: PackedStringArray = []
	var setup: Dictionary = s["setup"]
	if setup.has("producer_mult"):
		lines.append("Producers start at %d%% of a normal valley." % int(round(float(setup["producer_mult"]) * 100.0)))
	if setup.has("golden_mult"):
		lines.append("Golden plants are %dx as common (never more than 1 in 20)." % int(setup["golden_mult"]))
	for d: String in setup.get("disabled", []):
		if d.ends_with("_migrants"):
			lines.append("Nothing of the kind wanders back in through the passes.")
		elif d.begins_with("group:"):
			lines.append("No %s." % SpeciesDB.GROUP_LABEL[d.substr(6)].to_lower())
		else:
			lines.append("No %s." % SpeciesDB.label(d).to_lower())
	for e: Dictionary in s["events"]:
		match String(e["do"]):
			"kill_group": lines.append("A sickness strikes the %s early in spring." % SpeciesDB.GROUP_LABEL[e["arg"]].to_lower())
			"drought": lines.append("A drought is certain this summer.")
	return "\n".join(lines) if not lines.is_empty() else "A normal valley."

func _on_start() -> void:
	var gc: Node = get_node("/root/GameConfig")
	ChallengeScenarios.apply(gc, _selected)
	gc.time_limit = Clock.STANDARD_DAYS
	gc.time_setting = "Standard"
	gc.map_preset = "Random Scatter"
	gc.player_bet = ""
	gc.current_mode = "challenge"
	gc.apply_upgrades()
	gc.spawn_roster.clear()
	gc.bets.clear()
	gc.event_log.clear()
	get_tree().change_scene_to_file("res://scenes/ui/betting_table.tscn")

func _on_shop() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/greenhouse_shop.tscn")

func _on_reset_progress() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.challenge_level = 0
	gc.challenge_current_streak = 0
	gc.save_meta()
	_build_list()
	_select(ChallengeScenarios.LIST[0]["id"])

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

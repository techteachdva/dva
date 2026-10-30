class_name QuestBoard
extends Control

# The old betting table, said plainly. A quest names a champion, a species,
# a category, a goal, how long it takes, and what a success unlocks.
# Accepting costs nothing. Failing pays nothing.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const QUESTS: Array = [
	{
		"id": "quest:grazers", "lane": "main", "title": "Stand with the Grazers",
		"explanation": "The plants feed the flocks. If the sheep are the biggest crowd when the season ends, you kept that link of the valley alive.",
		"champion": "The flock", "species": "Sheep", "species_id": "sheep", "category": "Herbivores",
		"goal": "Sheep are the largest crowd at the end of the season.",
		"time": "One season", "reward": "The Leaf cursor",
		"reward_id": "leaf", "reward_kind": "cursor",
		"type": "faction", "target": "sheep", "sprite": "sheep", "label": "Sheep rule the season",
	},
	{
		"id": "quest:hunters", "lane": "main", "title": "Stand with the Hunters",
		"explanation": "Wolves keep the flocks from eating the valley bare. They rule if they are the biggest crowd when the season ends.",
		"champion": "The pack", "species": "Wolves", "species_id": "wolf", "category": "Carnivores",
		"goal": "Wolves are the largest crowd at the end of the season.",
		"time": "One season", "reward": "The Paw cursor, and the Mini Games",
		"reward_id": "paw", "reward_kind": "minigames",
		"type": "faction", "target": "wolves", "sprite": "wolf", "label": "Wolves rule the season",
	},
	{
		"id": "quest:cooks", "lane": "main", "title": "Stand with the Cooks",
		"explanation": "Humans cook what the valley grows. They rule if they are the biggest crowd when the season ends.",
		"champion": "The village", "species": "Humans", "species_id": "human", "category": "Omnivores",
		"goal": "Humans are the largest crowd at the end of the season.",
		"time": "One season", "reward": "The Wizard's Star cursor",
		"reward_id": "wand", "reward_kind": "cursor",
		"type": "faction", "target": "humans", "sprite": "human", "label": "Humans rule the season",
	},
	{
		"id": "quest:green", "lane": "main", "title": "Stand with the Meadow",
		"explanation": "Producers are the grass, the trees and the riverweed. You win if the grazers they feed are the fullest guild.",
		"champion": "The meadow", "species": "Grass and trees", "species_id": "sheep", "category": "Producers",
		"goal": "Grazers are the fullest guild when the season ends.",
		"time": "One season", "reward": "Creature customization",
		"reward_id": "customize", "reward_kind": "customize",
		"type": "guild", "target": "grazers", "sprite": "sheep", "label": "The meadow feeds the grazers",
	},
	{
		"id": "quest:return", "lane": "main", "title": "Stand with the Return",
		"explanation": "Worms and mushrooms turn the dead back into soil. You win if the decomposers are the fullest guild.",
		"champion": "The soil", "species": "Worms", "species_id": "worm", "category": "Decomposers",
		"goal": "Decomposers are the fullest guild when the season ends.",
		"time": "One season", "reward": "The Wiggler cursor, and a spirit aura",
		"reward_id": "worm", "reward_kind": "aura",
		"type": "guild", "target": "decomposers", "sprite": "worm", "label": "The soil guild rules",
	},
	{
		"id": "quest:rabbits", "lane": "side", "title": "A rabbit year",
		"explanation": "A side quest. The rabbits double their starting number before the season ends.",
		"champion": "The warren", "species": "Rabbits", "species_id": "rabbit", "category": "Herbivores",
		"goal": "Rabbits double.",
		"time": "Before the season ends", "reward": "The Falcon Feather cursor",
		"reward_id": "feather", "reward_kind": "cursor",
		"type": "boom", "target": "rabbits", "sprite": "rabbit", "label": "Rabbits double",
		"meta": {"from": 8},
	},
	{
		"id": "quest:fish", "lane": "side", "title": "The river fills",
		"explanation": "A side quest. Twenty fish pass through the valley this season.",
		"champion": "The current", "species": "Fish", "species_id": "fish", "category": "River",
		"goal": "Twenty fish.",
		"time": "This season", "reward": "The Mini Games",
		"reward_id": "minigames", "reward_kind": "minigames",
		"type": "flood", "target": "20", "sprite": "fish", "label": "Twenty fish",
		"meta": {"line": 20},
	},
	{
		"id": "quest:sky", "lane": "side", "title": "Robins over falcons",
		"explanation": "A side quest. More robins than falcons are alive when the season ends.",
		"champion": "The song", "species": "Robins", "species_id": "robin", "category": "Omnivores",
		"goal": "Robins outnumber falcons.",
		"time": "End of the season", "reward": "The Toadstool cursor",
		"reward_id": "mushroom", "reward_kind": "cursor",
		"type": "duel", "target": "robins", "sprite": "robin", "label": "Robins beat falcons",
	},
]

var live: bool = false
var _gc: Node
var _status: Label

func _ready() -> void:
	_gc = get_node("/root/GameConfig")
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var simple: bool = _gc.board_mode == "simple" and not live
	var frame := FelecoUiScript.build_screen(self, "Choose a Plan" if simple else "Quest Board", _on_back)
	var column := VBoxContainer.new()
	column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	column.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_theme_constant_override("separation", 8)
	frame["body"].add_child(column)
	var intro := FelecoUiScript.label(
		"Pick who you stand with. The card tells you the goal, the time, and the reward. Missing it gains nothing." if simple else "Main quests choose a side. Side quests are extra. Accept any you want.",
		16, FelecoUiScript.CREAM)
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	column.add_child(intro)
	if simple:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		row.add_theme_constant_override("separation", 8)
		column.add_child(row)
		for q: Dictionary in QUESTS:
			if q["lane"] == "main":
				row.add_child(_choice(q, true))
	else:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		row.add_theme_constant_override("separation", 16)
		column.add_child(row)
		row.add_child(_lane("Main Quests", "main"))
		row.add_child(_lane("Side Quests", "side"))
	_status = FelecoUiScript.label("Choose one to read it.", 15, FelecoUiScript.GOLD)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_status.custom_minimum_size = Vector2(0, 72)
	column.add_child(_status)
	if simple:
		var tune := Button.new()
		tune.text = "Tune the herds"
		tune.theme_type_variation = "GhostButton"
		tune.custom_minimum_size = Vector2(200, 48)
		tune.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		tune.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn"))
		frame["footer"].add_child(tune)
	var go := Button.new()
	go.text = "Close" if live else ("Enter the Valley" if simple else "Begin the year")
	go.theme_type_variation = "PrimaryButton"
	go.custom_minimum_size = Vector2(240, 48)
	go.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	go.pressed.connect(_on_go if not live else _on_back)
	frame["footer"].add_child(go)
	FelecoUiScript.dress_menu(self)
	_paint_buttons()

func _lane(title: String, lane: String) -> VBoxContainer:
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 6)
	col.add_child(FelecoUiScript.heading(title, 20, FelecoUiScript.GOLD))
	for q: Dictionary in QUESTS:
		if q["lane"] == lane:
			col.add_child(_choice(q, false))
	return col

func _choice(q: Dictionary, simple: bool) -> Button:
	var b := Button.new()
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.custom_minimum_size = Vector2(140, 120 if simple else 68)
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.pressed.connect(_accept.bind(q, b, simple))
	_buttons[String(q["id"])] = b
	return b

var _buttons: Dictionary = {}

func _paint_buttons() -> void:
	for q: Dictionary in QUESTS:
		var b: Button = _buttons.get(q["id"])
		if b == null:
			continue
		var on: bool = _gc.has_quest(String(q["id"]))
		b.theme_type_variation = "PrimaryButton" if on else "GhostButton"
		b.text = "%s\n%s" % [q["title"], q["category"]]
		if on:
			b.text = "Chosen\n" + b.text

func _detail(q: Dictionary) -> String:
	return "%s  ·  Champion: %s  ·  Species: %s\nGoal: %s\nTime: %s  ·  Reward: %s\n%s" % [q["category"], q["champion"], q["species"], q["goal"], q["time"], q["reward"], _strategy(q)]

func _strategy(q: Dictionary) -> String:
	match String(q["category"]):
		"Carnivores":
			return "Let the hunters work. A lone human is prey. Three together can drive a lion off."
		"Omnivores":
			return "Humans cook at the fire. Guard the cook."
		"Producers":
			return "Leave the meadow intact. Grazers need the grass and the riverweed."
		"Decomposers":
			return "Leave the dead to the soil."
		_:
			return "Keep them fed and together."

func _accept(q: Dictionary, _button: Button, simple: bool) -> void:
	if simple:
		_gc.bets.clear()
		_gc.accept_quest(_offer(q))
		_gc.player_bet = String(q["species_id"])
	elif _gc.has_quest(String(q["id"])):
		_gc.drop_quest(String(q["id"]))
	else:
		_gc.accept_quest(_offer(q))
		if q["lane"] == "main":
			_gc.player_bet = String(q["species_id"])
	_status.text = _detail(q)
	_paint_buttons()

func _offer(q: Dictionary) -> Dictionary:
	var o := q.duplicate(true)
	if not o.has("meta"):
		o["meta"] = {}
	o["live"] = false
	o["p"] = 0.4
	return o

func _refresh_status() -> void:
	var n: int = _accepted_count()
	if _status.text.is_empty():
		_status.text = "Quests accepted: %d. Miss them and you gain nothing." % n

func _on_go() -> void:
	if _accepted_count() == 0:
		_status.text = "Choose a plan first. It is who you stand with."
		return
	_gc.apply_upgrades()
	_gc.save_meta()
	get_tree().change_scene_to_file("res://scenes/world.tscn")

func _accepted_count() -> int:
	var n: int = 0
	for b: Dictionary in _gc.bets:
		if b.get("quest", false):
			n += 1
	return n

func _on_back() -> void:
	if live:
		var host: Node = get_parent()
		if host is CanvasLayer:
			host.queue_free()
		else:
			queue_free()
		return
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

static func grant(gc: Node, quest: Dictionary) -> String:
	var kind: String = String(quest.get("reward_kind", ""))
	var id: String = String(quest.get("reward_id", ""))
	if kind == "cursor":
		Cosmetics.grant(gc, id)
		return "Unlocked a cursor."
	if kind == "minigames":
		Cosmetics.grant(gc, "paw")
		gc.unlock("minigames")
		return "Unlocked the Mini Games."
	if kind == "aura":
		Cosmetics.grant(gc, "worm")
		Cosmetics.grant(gc, "spirit")
		return "Unlocked the Wiggler cursor and a spirit aura."
	if kind == "customize":
		gc.set_record("lesson", "customize", true)
		return "Creature customization is open. Claim a creature and press Brand."
	return String(quest.get("reward", "A gift from the valley."))

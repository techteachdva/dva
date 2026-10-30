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
	column.add_theme_constant_override("separation", 10)
	frame["body"].add_child(column)
	var body: Control = column
	var intro := FelecoUiScript.label(
		"A plan aligns you with one kind of creature. It gives you a goal, a way to play, and a season to do it. You gain nothing if you miss it." if simple else "Main quests choose who you stand with. Side quests are extra. Accept any you want. Missing one gains nothing.",
		16, FelecoUiScript.CREAM)
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(intro)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.custom_minimum_size = Vector2(0, 420)
	body.add_child(scroll)
	if simple:
		var col := VBoxContainer.new()
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_theme_constant_override("separation", 12)
		scroll.add_child(col)
		for q: Dictionary in QUESTS:
			if q["lane"] != "main":
				continue
			col.add_child(_card(q, true))
	else:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 16)
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		scroll.add_child(row)
		row.add_child(_lane("Main Quests", "main"))
		row.add_child(_lane("Side Quests", "side"))
	_status = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	frame["footer"].add_child(_status)
	if simple:
		var tune := Button.new()
		tune.text = "Tune the herds"
		tune.theme_type_variation = "GhostButton"
		tune.custom_minimum_size = Vector2(200, 56)
		tune.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn"))
		frame["footer"].add_child(tune)
	var go := Button.new()
	go.text = "Close" if live else ("Enter the Valley" if simple else "Begin the year")
	go.theme_type_variation = "PrimaryButton"
	go.custom_minimum_size = Vector2(280, 56)
	go.pressed.connect(_on_go if not live else _on_back)
	frame["footer"].add_child(go)
	FelecoUiScript.dress_menu(self)
	_refresh_status()

func _lane(title: String, lane: String) -> VBoxContainer:
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 10)
	col.add_child(FelecoUiScript.heading(title, 22, FelecoUiScript.GOLD))
	for q: Dictionary in QUESTS:
		if q["lane"] == lane:
			col.add_child(_card(q, false))
	return col

func _card(q: Dictionary, simple: bool) -> PanelContainer:
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.05, 0.08, 0.06, 0.92)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(14)
	sb.set_content_margin_all(12)
	card.add_theme_stylebox_override("panel", sb)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	card.add_child(col)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	col.add_child(head)
	var art := TextureRect.new()
	art.custom_minimum_size = Vector2(72, 72)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	art.texture = FelecoUiScript.species_texture(String(q["sprite"]))
	head.add_child(art)
	var words := VBoxContainer.new()
	words.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(words)
	words.add_child(FelecoUiScript.heading(q["title"], 18, FelecoUiScript.GOLD))
	words.add_child(FelecoUiScript.label(q["category"], 13, FelecoUiScript.LEAF))
	var body := FelecoUiScript.label(q["explanation"], 14, FelecoUiScript.CREAM)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(body)
	col.add_child(_line("Champion", q["champion"]))
	col.add_child(_line("Species", q["species"]))
	col.add_child(_line("Category", q["category"]))
	col.add_child(_line("Goal", q["goal"]))
	col.add_child(_line("Time", q["time"]))
	col.add_child(_line("Reward", q["reward"]))
	var strategy := "Keep them fed and together. Powers that help this category push the valley their way."
	if q["category"] == "Carnivores":
		strategy = "Let the hunters work. A lone human is prey. A full flock is not a meal."
	elif q["category"] == "Omnivores":
		strategy = "Humans cook at the fire. Guard the cook. Three together blunt a bear or a lion."
	elif q["category"] == "Producers":
		strategy = "Do not strip the meadow. Grazers need the grass and the riverweed."
	elif q["category"] == "Decomposers":
		strategy = "Leave the dead to the soil. Worms and mushrooms close the year."
	col.add_child(_line("Strategy", strategy))
	var b := Button.new()
	b.theme_type_variation = "PrimaryButton"
	b.custom_minimum_size = Vector2(0, 44)
	b.text = "Accept this plan" if simple else ("Accepted" if _gc.has_quest(q["id"]) else "Accept quest")
	b.pressed.connect(_accept.bind(q, b, simple))
	col.add_child(b)
	return card

func _line(name: String, value: String) -> Label:
	var lab := FelecoUiScript.label("%s: %s" % [name, value], 13, FelecoUiScript.MIST)
	lab.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return lab

func _accept(q: Dictionary, button: Button, simple: bool) -> void:
	if simple:
		_gc.bets.clear()
		_gc.accept_quest(_offer(q))
		_gc.player_bet = String(q["species_id"])
		_status.text = "You stand with the %s. %s" % [q["category"], q["goal"]]
		return
	if _gc.has_quest(q["id"]):
		_gc.drop_quest(q["id"])
		button.text = "Accept quest"
	else:
		_gc.accept_quest(_offer(q))
		if q["lane"] == "main":
			_gc.player_bet = String(q["species_id"])
		button.text = "Accepted"
	_refresh_status()

func _offer(q: Dictionary) -> Dictionary:
	var o := q.duplicate(true)
	if not o.has("meta"):
		o["meta"] = {}
	o["live"] = false
	o["p"] = 0.4
	return o

func _refresh_status() -> void:
	var n: int = 0
	for b: Dictionary in _gc.bets:
		if b.get("quest", false) and b.get("state", "") == "open":
			n += 1
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

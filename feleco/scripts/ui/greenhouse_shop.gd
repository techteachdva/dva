extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

var _selected_upgrade: String = ""

const UPGRADES: Array[Dictionary] = [
	{
		"id": "foresight_i",
		"name": "Foresight I",
		"cost": 20,
		"desc": "Show total predator count on the setup screen.",
	},
	{
		"id": "rain_dance",
		"name": "Rain Dance",
		"cost": 25,
		"desc": "Start every run with 1 free Rain powerup.",
	},
	{
		"id": "green_thumb",
		"name": "Green Thumb",
		"cost": 40,
		"desc": "Golden grass, berries, apples and star moss turn up half as often again (never more than 1 in 20).",
	},
	{
		"id": "time_dilation",
		"name": "Time Dilation",
		"cost": 60,
		"desc": "Every run lasts one more day.",
	},
	{
		"id": "long_days",
		"name": "Long Days",
		"cost": 30,
		"desc": "The sun stays up two thirds of every day. Good for grazers, villagers and falcons.",
	},
	{
		"id": "side_eye",
		"name": "Side Eye",
		"cost": 40,
		"desc": "Your betting table limit is 10 coins higher.",
	},
	{
		"id": "cloning_vat",
		"name": "Cloning Vat",
		"cost": 60,
		"desc": "Your bet species gets +1 respawn if it goes extinct mid-run.",
	},
]

# One charge each. Durations are in days of sun and moon (see Clock).
const POWERUPS: Array[Dictionary] = [
	{"id": "bloom", "name": "Bloom", "cost": 15, "desc": "Producers: the meadow, the woods and the moss all surge at once."},
	{"id": "stampede", "name": "Stampede", "cost": 15, "desc": "Herbivores: the herds panic and scatter across the valley."},
	{"id": "predator_call", "name": "Call Kin", "cost": 25, "desc": "A few more of your champion's kind arrive."},
	{"id": "feast", "name": "Feast", "cost": 15, "desc": "Omnivores: every bear, boar, robin and villager eats its fill."},
	{"id": "rot_rain", "name": "Rot Rain", "cost": 15, "desc": "Decomposers: mushrooms, worms and beetles surface across the valley."},
	{"id": "rain", "name": "Rain", "cost": 12, "desc": "Grass grows at 2.2x for a day. Worms and mushrooms surge; falcons hunt blind."},
	{"id": "drought", "name": "Drought", "cost": 18, "desc": "The meadow bakes and the moss shrivels for a day and a half."},
	{"id": "flood", "name": "Flood", "cost": 18, "desc": "The river rises for half a day. Fish left on dry land add to the Flood Toll."},
	{"id": "eclipse", "name": "Eclipse", "cost": 30, "desc": "Night falls at once for half a day."},
]

var _frame: Dictionary = {}
var _points_label: Label
var _feedback: Label
var _upgrade_box: VBoxContainer
var _powerup_box: VBoxContainer

func _ready() -> void:
	_frame = FelecoUiScript.build_screen(self, "The Greenhouse", _on_back)
	var body: HBoxContainer = _frame["body"]
	_upgrade_box = FelecoUiScript.card(body, "Upgrades (win a Rampage to earn)", 1.0)
	_powerup_box = FelecoUiScript.card(body, "Powerups (one use each)", 1.0)
	var footer: HBoxContainer = _frame["footer"]
	_points_label = FelecoUiScript.label("", 22, FelecoUiScript.GOLD)
	footer.add_child(_points_label)
	_feedback = FelecoUiScript.label("", 18, FelecoUiScript.MIST)
	footer.add_child(_feedback)
	FelecoUiScript.dress_menu(self)
	_refresh_display()

func _refresh_display() -> void:
	var gc: Node = get_node("/root/GameConfig")
	_points_label.text = "Eco Points: %d" % gc.eco_points
	_fill(_upgrade_box, UPGRADES, true)
	_fill(_powerup_box, POWERUPS, false)
	FelecoUiScript.dress_menu(self)

# One compact row per item: name and effect on the left, its own buy button
# on the right, so nothing needs selecting first.
func _fill(box: VBoxContainer, items: Array[Dictionary], permanent: bool) -> void:
	var gc: Node = get_node("/root/GameConfig")
	for i: int in range(box.get_child_count() - 1, 0, -1):
		box.get_child(i).queue_free()
	for item: Dictionary in items:
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		var text := VBoxContainer.new()
		text.add_theme_constant_override("separation", 0)
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		text.add_child(FelecoUiScript.label(item["name"], 17, FelecoUiScript.CREAM))
		var desc := FelecoUiScript.label(item["desc"], 13, FelecoUiScript.MIST)
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.add_child(desc)
		row.add_child(text)
		var buy := Button.new()
		buy.custom_minimum_size = Vector2(118, 44)
		buy.add_theme_font_size_override("font_size", 15)
		var owned: bool = permanent and gc.owned_upgrades.has(item["id"])
		var held: int = 0 if permanent else int(gc.powerup_inventory.get(item["id"], 0))
		if owned:
			buy.text = "Owned"
			buy.disabled = true
		elif permanent:
			# Upgrades are earned by winning a Rampage, never bought.
			var next: bool = gc.UPGRADE_ORDER.find(item["id"]) == _next_locked(gc)
			buy.text = "Next" if next else "Locked"
			buy.disabled = true
			buy.tooltip_text = "Win a Rampage to earn this: click a golden creature, press Rampage! and devour %d before its gold runs out." % gc.RAMPAGE_GOAL
		else:
			buy.text = "%d EP" % item["cost"]
			buy.theme_type_variation = "PrimaryButton" if gc.eco_points >= item["cost"] else "TouchButton"
			buy.tooltip_text = "Buy %s for %d Eco Points." % [item["name"], item["cost"]]
			buy.pressed.connect(_buy.bind(item, permanent))
		if held > 0:
			row.add_child(FelecoUiScript.label("x%d" % held, 16, FelecoUiScript.GOLD))
		row.add_child(buy)
		box.add_child(row)

func _next_locked(gc: Node) -> int:
	for i: int in gc.UPGRADE_ORDER.size():
		if not gc.owned_upgrades.get(gc.UPGRADE_ORDER[i], false):
			return i
	return -1

func _buy(item: Dictionary, permanent: bool) -> void:
	var gc: Node = get_node("/root/GameConfig")
	if permanent and gc.owned_upgrades.has(item["id"]):
		_feedback.text = "You already own %s." % item["name"]
		return
	if not gc.spend_eco_points(item["cost"]):
		_feedback.text = "Not enough Eco Points. Need %d." % item["cost"]
		return
	if permanent:
		gc.owned_upgrades[item["id"]] = true
	else:
		gc.powerup_inventory[item["id"]] = gc.powerup_inventory.get(item["id"], 0) + 1
	gc.save_meta()
	_feedback.text = "Purchased %s!" % item["name"]
	_refresh_display()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

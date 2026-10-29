extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

var _selected_upgrade: String = ""

const UPGRADES: Array[Dictionary] = [
	{
		"id": "foresight_i",
		"name": "Foresight I",
		"cost": 50,
		"desc": "Show total predator count on the setup screen.",
	},
	{
		"id": "foresight_ii",
		"name": "Foresight II",
		"cost": 200,
		"desc": "Show individual HP and SPD of all starting entities in setup.",
	},
	{
		"id": "rain_dance",
		"name": "Rain Dance",
		"cost": 100,
		"desc": "Start every run with 1 free Rain powerup.",
	},
	{
		"id": "shepherds_blessing",
		"name": "Shepherd's Blessing",
		"cost": 150,
		"desc": "Your bet species starts with +15% population.",
	},
	{
		"id": "time_dilation",
		"name": "Time Dilation",
		"cost": 300,
		"desc": "All time limits are extended by 10%.",
	},
	{
		"id": "side_eye",
		"name": "Side Eye",
		"cost": 250,
		"desc": "Allow 2 side bets per run instead of 1.",
	},
	{
		"id": "cloning_vat",
		"name": "Cloning Vat",
		"cost": 500,
		"desc": "Your bet species gets +1 respawn if it goes extinct mid-run.",
	},
]

const POWERUPS: Array[Dictionary] = [
	{"id": "rain", "name": "Rain", "cost": 15, "desc": "Grass grows at 2.2× the season for 5 days."},
	{"id": "predator_call", "name": "Predator Call", "cost": 25, "desc": "Summon 2 wolves instantly."},
	{"id": "heal", "name": "Heal", "cost": 20, "desc": "Restore +25 health and energy to your champion."},
	{"id": "famine", "name": "Famine", "cost": 30, "desc": "Grass grows at 1/4 the season for 10 days."},
	{"id": "meteor", "name": "Meteor", "cost": 40, "desc": "Cull 20% of whoever currently holds the valley."},
	{"id": "flood", "name": "Flood", "cost": 35, "desc": "The river rises for 8 days. Fish thrive. The meadow beside it drowns."},
]

var _frame: Dictionary = {}
var _points_label: Label
var _feedback: Label
var _upgrade_box: VBoxContainer
var _powerup_box: VBoxContainer

func _ready() -> void:
	_frame = FelecoUiScript.build_screen(self, "The Greenhouse", _on_back)
	var body: HBoxContainer = _frame["body"]
	_upgrade_box = FelecoUiScript.card(body, "Upgrades (keep forever)", 1.0)
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
		else:
			buy.text = "%d EP" % item["cost"]
			buy.theme_type_variation = "PrimaryButton" if gc.eco_points >= item["cost"] else "TouchButton"
			buy.tooltip_text = "Buy %s for %d Eco Points." % [item["name"], item["cost"]]
			buy.pressed.connect(_buy.bind(item, permanent))
		if held > 0:
			row.add_child(FelecoUiScript.label("x%d" % held, 16, FelecoUiScript.GOLD))
		row.add_child(buy)
		box.add_child(row)

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

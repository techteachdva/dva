extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# Every setting on one screen: herd sizes on the left, season, map and
# champion in the middle, the side bet on the right, Start along the bottom.

# [GameConfig field, label, icon, default]
const SPECIES_FIELDS: Array = [
	["sheep_count", "Sheep", "sheep", 10],
	["wolf_count", "Wolves", "wolf", 3],
	["human_count", "Humans", "human", 5],
	["falcon_count", "Falcons", "falcon", 3],
	["robin_count", "Robins", "robin", 8],
	["boar_count", "Boars", "boar", 5],
	["rabbit_count", "Rabbits", "rabbit", 8],
	["worm_count", "Worms", "worm", 15],
	["spore_count", "Spores", "", 5],
	["tree_count", "Trees", "", 6],
]
const HERDS: Array = [["Tiny", 4], ["Small", 8], ["Medium", 16], ["Large", 32]]
const SEASONS: Array = [["1 Month", 30.0], ["3 Months", 90.0], ["12 Months", 360.0]]
const CHAMPIONS: Array[String] = ["Sheep", "Wolves", "Humans", "Falcons", "Robins", "Boars", "Rabbits", "Worms", "Fish"]
const MAPS: Array[String] = ["Random Scatter", "Corner Clusters"]

var _roster: Array[Dictionary] = []
var _species_icons: Dictionary = {}
var _spins: Dictionary = {}  # GameConfig field -> SpinBox
var _herd_buttons: Array[Button] = []
var _season_buttons: Array[Button] = []
var _setting_counts: bool = false
var _total_label: Label
var _foresight_label: Label
var _champion: OptionButton
var _map: OptionButton
var _roster_list: ItemList
var _bet_confirm: Label

func _ready() -> void:
	var frame := FelecoUiScript.build_screen(self, "Prepare the Valley", _on_back)
	var body: HBoxContainer = frame["body"]
	_build_herds(FelecoUiScript.card(body, "Herds", 1.1))
	_build_rules(FelecoUiScript.card(body, "Season and stakes", 0.8))
	_build_side_bet(FelecoUiScript.card(body, "Side bet", 1.25, 296.0))

	var start := Button.new()
	start.text = "Start"
	start.icon = load("res://assets/icons/start.svg")
	start.tooltip_text = "Start. Open the field with these numbers."
	start.custom_minimum_size = Vector2(420, 60)
	start.add_theme_font_size_override("font_size", 24)
	start.theme_type_variation = "PrimaryButton"
	start.pressed.connect(_on_start)
	frame["footer"].add_child(start)

	FelecoUiScript.dress_menu(self)
	_on_time_setting(1)
	_read_counts_from_config()
	_generate_roster()
	_update_summary()

func _build_herds(card: VBoxContainer) -> void:
	var labels: Array = []
	var icons: Array = []
	for herd: Array in HERDS:
		labels.append("%s %d" % [herd[0], herd[1]])
		icons.append(null)
	labels.append("Random")
	icons.append(load("res://assets/icons/random.svg"))
	_herd_buttons = FelecoUiScript.choice_row(card, labels, icons)
	for i: int in HERDS.size():
		_herd_buttons[i].tooltip_text = "%s. %d of every species." % [HERDS[i][0], HERDS[i][1]]
		_herd_buttons[i].pressed.connect(_on_preset.bind(i))
	_herd_buttons[HERDS.size()].tooltip_text = "Random. A different count for each species, from 2 to 40."
	_herd_buttons[HERDS.size()].pressed.connect(_on_random)

	card.add_child(FelecoUiScript.label("Or set each population (2 to 40):", 15, FelecoUiScript.MIST))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 6)
	card.add_child(grid)
	for entry: Array in SPECIES_FIELDS:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 8)
		var icon := TextureRect.new()
		icon.custom_minimum_size = Vector2(22, 22)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if not str(entry[2]).is_empty():
			icon.texture = _icon_for(entry[2])
		row.add_child(icon)
		var name_label := FelecoUiScript.label(entry[1], 17, FelecoUiScript.CREAM)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(name_label)
		var spin := SpinBox.new()
		spin.min_value = 2
		spin.max_value = 40
		spin.value = entry[3]
		spin.custom_minimum_size = Vector2(76, 40)
		spin.alignment = HORIZONTAL_ALIGNMENT_CENTER
		spin.value_changed.connect(_on_count_edited)
		row.add_child(spin)
		grid.add_child(row)
		_spins[entry[0]] = spin
	card.add_child(Control.new())  # pushes the totals to the card's foot
	card.get_child(card.get_child_count() - 1).size_flags_vertical = Control.SIZE_EXPAND_FILL
	_total_label = FelecoUiScript.label("", 16, FelecoUiScript.MIST)
	card.add_child(_total_label)
	_foresight_label = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_foresight_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(_foresight_label)

func _build_rules(card: VBoxContainer) -> void:
	card.add_child(_hint("How long the valley runs"))
	var labels: Array = []
	var icons: Array = []
	for season: Array in SEASONS:
		labels.append(season[0])
		icons.append(null)
	_season_buttons = FelecoUiScript.choice_row(card, labels, icons)
	for i: int in SEASONS.size():
		_season_buttons[i].tooltip_text = "%s. The valley runs for %d days." % [SEASONS[i][0], int(SEASONS[i][1])]
		_season_buttons[i].pressed.connect(_on_time_setting.bind(i))

	card.add_child(_hint("Champion: the species you think will own the field"))
	_champion = OptionButton.new()
	_champion.custom_minimum_size = Vector2(0, 48)
	_champion.icon = load("res://assets/icons/crown.svg")
	_champion.tooltip_text = "Champion. The species you think will own the field."
	for name: String in CHAMPIONS:
		_champion.add_item(name)
	_champion.select(0)
	card.add_child(_champion)

	card.add_child(_hint("Map: how herds are placed at the start"))
	_map = OptionButton.new()
	_map.custom_minimum_size = Vector2(0, 48)
	_map.icon = load("res://assets/icons/map.svg")
	_map.tooltip_text = "Map. How the herds are placed when the field opens."
	for name: String in MAPS:
		_map.add_item(name)
	_map.select(0)
	card.add_child(_map)

func _build_side_bet(card: VBoxContainer) -> void:
	var hint := FelecoUiScript.label("Pick a named creature, then bet it lives or dies. Hover a name for its stats.", 15, FelecoUiScript.MIST)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(hint)
	_roster_list = ItemList.new()
	_roster_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	# Two columns so all sixteen names show at once without scrolling.
	_roster_list.max_columns = 2
	_roster_list.same_column_width = true
	_roster_list.fixed_icon_size = Vector2i(22, 22)
	_roster_list.add_theme_font_size_override("font_size", 15)
	_roster_list.add_theme_constant_override("v_separation", 4)
	_roster_list.add_theme_constant_override("h_separation", 6)
	card.add_child(_roster_list)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	card.add_child(row)
	var survive := Button.new()
	survive.text = "Survives"
	survive.icon = load("res://assets/icons/survive.svg")
	survive.tooltip_text = "Survive. You win if this creature is alive at the end."
	survive.theme_type_variation = "TouchButton"
	survive.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	survive.add_theme_constant_override("icon_max_width", 24)
	survive.pressed.connect(_on_side_bet.bind("survive"))
	row.add_child(survive)
	var die := Button.new()
	die.text = "Dies"
	die.icon = load("res://assets/icons/die.svg")
	die.tooltip_text = "Die. You win if this creature is dead at the end."
	die.theme_type_variation = "DangerButton"
	die.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	die.add_theme_constant_override("icon_max_width", 24)
	die.pressed.connect(_on_side_bet.bind("die"))
	row.add_child(die)
	_bet_confirm = FelecoUiScript.label("No side bet yet.", 15, FelecoUiScript.MIST)
	_bet_confirm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(_bet_confirm)

func _hint(text: String) -> Label:
	var lbl := FelecoUiScript.label(text, 15, FelecoUiScript.MIST)
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return lbl

func _icon_for(species: String) -> Texture2D:
	if not _species_icons.has(species):
		_species_icons[species] = load("res://assets/icons/%s.svg" % species)
	return _species_icons[species]

func _read_counts_from_config() -> void:
	# Start from whatever the valley used last, so a replay keeps its numbers.
	var gc: Node = get_node("/root/GameConfig")
	_setting_counts = true
	for entry: Array in SPECIES_FIELDS:
		_spins[entry[0]].value = clampi(int(gc.get(entry[0])), 2, 40)
	_setting_counts = false
	_mark_matching_herd()

func _set_all_counts(values: Dictionary) -> void:
	_setting_counts = true
	for field: String in values:
		_spins[field].value = values[field]
	_setting_counts = false
	_update_summary()

func _mark_matching_herd() -> void:
	var first: int = int(_spins[SPECIES_FIELDS[0][0]].value)
	for entry: Array in SPECIES_FIELDS:
		if int(_spins[entry[0]].value) != first:
			FelecoUiScript.pick(_herd_buttons, null)
			return
	for i: int in HERDS.size():
		if HERDS[i][1] == first:
			FelecoUiScript.pick(_herd_buttons, _herd_buttons[i])
			return
	FelecoUiScript.pick(_herd_buttons, null)

func _on_preset(index: int) -> void:
	var values: Dictionary = {}
	for entry: Array in SPECIES_FIELDS:
		values[entry[0]] = HERDS[index][1]
	_set_all_counts(values)
	FelecoUiScript.pick(_herd_buttons, _herd_buttons[index])

func _on_random() -> void:
	var values: Dictionary = {}
	for entry: Array in SPECIES_FIELDS:
		values[entry[0]] = randi() % 39 + 2
	_set_all_counts(values)
	FelecoUiScript.pick(_herd_buttons, _herd_buttons[HERDS.size()])

func _on_count_edited(_value: float) -> void:
	if _setting_counts:
		return
	_mark_matching_herd()
	_update_summary()

func _update_summary() -> void:
	var total: int = 0
	for entry: Array in SPECIES_FIELDS:
		total += int(_spins[entry[0]].value)
	_total_label.text = "%d creatures, spores and trees in the valley." % total
	var gc: Node = get_node("/root/GameConfig")
	if gc.owned_upgrades.get("foresight_i", false) or gc.owned_upgrades.get("foresight_ii", false):
		var predators: int = _count("wolf_count") + _count("human_count") + _count("falcon_count")
		var prey: int = _count("sheep_count") + _count("robin_count") + _count("worm_count") + _count("rabbit_count")
		var text := "Foresight: %d predators, %d prey, %d neutral." % [predators, prey, _count("boar_count") + _count("spore_count")]
		_foresight_label.text = text
		_foresight_label.show()
	else:
		_foresight_label.hide()

func _count(field: String) -> int:
	return int(_spins[field].value)

func _generate_roster() -> void:
	# Two notable creatures per species to name and bet on. Every species has
	# at least two, so the roster doesn't change when the counts do.
	_roster.clear()
	for sp: String in ["sheep", "wolf", "human", "falcon", "robin", "boar", "worm", "rabbit"]:
		for i in range(2):
			var hp: float = 0.0
			var spd: float = 0.0
			var lif: float = 0.0
			match sp:
				"sheep": hp = 20.0 + randf() * 10.0; spd = 1.8 + randf() * 0.6; lif = 35.0 + randf() * 10.0
				"wolf": hp = 70.0 + randf() * 20.0; spd = 4.5 + randf() * 1.5; lif = 45.0 + randf() * 10.0
				"human": hp = 60.0 + randf() * 20.0; spd = 2.5 + randf() * 1.0; lif = 90.0 + randf() * 20.0
				"falcon": hp = 40.0 + randf() * 20.0; spd = 8.0 + randf() * 4.0; lif = 55.0 + randf() * 10.0
				"robin": hp = 25.0 + randf() * 15.0; spd = 4.0 + randf() * 2.0; lif = 55.0 + randf() * 10.0
				"boar": hp = 80.0 + randf() * 20.0; spd = 2.5 + randf() * 1.0; lif = 75.0 + randf() * 10.0
				"rabbit": hp = 15.0 + randf() * 8.0; spd = 4.0 + randf() * 1.5; lif = 12.0 + randf() * 6.0
				"worm": hp = 10.0 + randf() * 5.0; spd = 0.5 + randf() * 0.5; lif = 15.0 + randf() * 10.0
			_roster.append({
				"name": NameGenerator.generate(sp), "species": sp,
				"health": hp, "speed": spd, "lifespan": lif,
			})
	_roster_list.clear()
	for entry: Dictionary in _roster:
		var species: String = entry["species"]
		var idx := _roster_list.add_item(entry["name"], _icon_for(species))
		_roster_list.set_item_tooltip(idx, "%s the %s
HP %.0f durability  ·  SPD %.1f movement  ·  LIF %.0f days" % [entry["name"], species.capitalize(), entry["health"], entry["speed"], entry["lifespan"]])
	_roster_list.select(0)

func _on_time_setting(index: int) -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.time_setting = SEASONS[index][0]
	gc.time_limit = SEASONS[index][1]
	FelecoUiScript.pick(_season_buttons, _season_buttons[index])

func _on_side_bet(bet_type: String) -> void:
	var selected: PackedInt32Array = _roster_list.get_selected_items()
	if selected.is_empty():
		_bet_confirm.text = "Pick a creature from the list first."
		return
	var entry: Dictionary = _roster[selected[0]]
	var gc: Node = get_node("/root/GameConfig")
	gc.side_bet_entity = {
		"name": entry["name"],
		"species": entry["species"],
		"bet_type": bet_type,
	}
	_bet_confirm.text = "Side bet: %s the %s %s." % [entry["name"], entry["species"].capitalize(), "survives" if bet_type == "survive" else "dies"]
	_bet_confirm.add_theme_color_override("font_color", FelecoUiScript.GOLD)

func _on_start() -> void:
	var gc: Node = get_node("/root/GameConfig")
	for entry: Array in SPECIES_FIELDS:
		gc.set(entry[0], _count(entry[0]))
	gc.player_bet = _champion.get_item_text(_champion.selected)
	gc.map_preset = _map.get_item_text(_map.selected)
	gc.grass_density = 0.5
	# After the champion and counts are known, so Shepherd's Blessing lands
	# on the species actually chosen.
	gc.apply_upgrades()
	gc.spawn_roster = _roster.duplicate(true)
	gc.event_log.clear()
	gc.side_bet_result = ""
	get_tree().change_scene_to_file("res://scenes/world.tscn")

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

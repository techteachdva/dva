extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# Every setting on one screen: herd sizes on the left, season, map and
# map in the middle; Start goes to the betting table.

# [GameConfig field, label, icon, default, species id]. "extra:<id>" fields
# live in GameConfig.extra_counts. Every row can be switched off: that
# species never enters the valley, not even through the passes.
const SPECIES_FIELDS: Array = [
	["sheep_count", "Sheep", "sheep", 10, "sheep"],
	["rabbit_count", "Rabbits", "rabbit", 8, "rabbit"],
	["extra:deer", "Deer", "deer", 6, "deer"],
	["extra:goat", "Goats", "goat", 5, "goat"],
	["wolf_count", "Wolves", "wolf", 3, "wolf"],
	["extra:lion", "Mountain Lions", "lion", 3, "lion"],
	["falcon_count", "Falcons", "falcon", 3, "falcon"],
	["human_count", "Humans", "human", 5, "human"],
	["extra:bear", "Bears", "bear", 3, "bear"],
	["boar_count", "Boars", "boar", 5, "boar"],
	["robin_count", "Robins", "robin", 8, "robin"],
	["fish_count", "Fish", "fish", 8, "fish"],
	["worm_count", "Worms", "worm", 15, "worm"],
	["extra:beetle", "Beetles", "beetle", 10, "beetle"],
	["extra:mouse", "Mice", "mouse", 12, "mouse"],
	["spore_count", "Mushrooms", "", 5, "mushroom"],
	["tree_count", "Trees", "", 6, "tree"],
	["bush_count", "Berry bushes", "", 5, "bush"],
]
# Quick switches for whole links of the food web. Trees and bushes count as producers.
const GROUP_SWITCHES: Array = [
	["producer", "Producers"], ["herbivore", "Herbivores"], ["carnivore", "Carnivores"],
	["omnivore", "Omnivores"], ["decomposer", "Decomposers"], ["human", "No humans"],
]
const HERDS: Array = [["Tiny", 4], ["Small", 8], ["Medium", 16], ["Large", 32]]
const SEASONS: Array = Clock.RUNS
const MAPS: Array[String] = ["Random Scatter", "Corner Clusters"]

var _species_icons: Dictionary = {}
var _spins: Dictionary = {}  # GameConfig field -> SpinBox
var _toggles: Dictionary = {}  # GameConfig field -> CheckBox (on = in the valley)
var _group_buttons: Dictionary = {}
var _herd_buttons: Array[Button] = []
var _season_buttons: Array[Button] = []
var _setting_counts: bool = false
var _total_label: Label
var _foresight_label: Label
var _map: OptionButton
var _era_buttons: Array[Button] = []
var _name_labels: Dictionary = {}
var _icon_rects: Dictionary = {}
var _look_status: Label
var _start: Button
const _START_TEXT := "To the Quest Board"

func _ready() -> void:
	var frame := FelecoUiScript.build_screen(self, "Prepare the Valley", _on_back)
	var body: BoxContainer = frame["body"]
	_build_herds(FelecoUiScript.card(body, "Herds", 1.1))
	_build_rules(FelecoUiScript.card(body, "Season and map", 0.8))

	var start := Button.new()
	_start = start
	start.text = _START_TEXT
	start.icon = load("res://assets/icons/start.svg")
	start.tooltip_text = "Accept quests, then open the valley with these numbers."
	start.custom_minimum_size = Vector2(420 if get_viewport_rect().size.x >= 900.0 else 300, 60)
	start.add_theme_font_size_override("font_size", 24)
	start.theme_type_variation = "PrimaryButton"
	start.pressed.connect(_on_start)
	frame["footer"].add_child(start)

	FelecoUiScript.dress_menu(self)
	var packs: Node = get_node("/root/EraPacks")
	packs.connect("look_changed", func(_era: String) -> void: _show_era())
	packs.connect("look_status", _on_look_status)
	_on_time_setting(1)
	_read_counts_from_config()
	_show_era()
	_update_summary()
	_on_look_status(str(get_node("/root/EraPacks").call("line")))

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

	card.add_child(FelecoUiScript.label("Switch whole links of the food web off and on:", 15, FelecoUiScript.MIST))
	var groups := HFlowContainer.new()
	groups.add_theme_constant_override("h_separation", 6)
	groups.add_theme_constant_override("v_separation", 6)
	card.add_child(groups)
	for g: Array in GROUP_SWITCHES:
		var b := Button.new()
		b.text = g[1]
		b.toggle_mode = true
		b.button_pressed = g[0] != "human"
		b.custom_minimum_size = Vector2(0, 40)
		b.tooltip_text = "Take every one of these out of the valley, or put them back." if g[0] != "human" else "A valley without people."
		b.toggled.connect(_on_group_toggled.bind(g[0]))
		groups.add_child(b)
		_group_buttons[g[0]] = b
	card.add_child(FelecoUiScript.label("Or set each population (tick to include, 1 to 40):", 15, FelecoUiScript.MIST))
	# Seventeen rows: they scroll inside the card so the screen always fits.
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	card.add_child(scroll)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 6)
	scroll.add_child(grid)
	for entry: Array in SPECIES_FIELDS:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 8)
		var on := CheckBox.new()
		on.button_pressed = true
		on.tooltip_text = "Include %s. Off: none at the start and none wander in." % entry[1]
		on.toggled.connect(_on_species_toggled.bind(entry[0]))
		row.add_child(on)
		_toggles[entry[0]] = on
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
		_name_labels[entry[0]] = name_label
		if not str(entry[2]).is_empty():
			_icon_rects[entry[0]] = icon
		var spin := SpinBox.new()
		spin.min_value = 1
		spin.max_value = 40
		spin.value = entry[3]
		spin.custom_minimum_size = Vector2(70, 36)
		spin.alignment = HORIZONTAL_ALIGNMENT_CENTER
		spin.value_changed.connect(_on_count_edited)
		row.add_child(spin)
		grid.add_child(row)
		_spins[entry[0]] = spin
	_total_label = FelecoUiScript.label("", 16, FelecoUiScript.MIST)
	card.add_child(_total_label)
	_foresight_label = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_foresight_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(_foresight_label)

func _build_rules(card: VBoxContainer) -> void:
	card.add_child(_hint("Look. Valley is the living sprites. Pixel is those same frames in big pixels. Lost Valley paints prehistoric creatures on the same rig and renames them. Pixel and Lost Valley download when you choose them."))
	var era_labels: Array = []
	for era_id: String in EraBook.IDS:
		era_labels.append(EraBook.TITLES[era_id])
	_era_buttons = FelecoUiScript.choice_row(card, era_labels, [])
	for i: int in EraBook.IDS.size():
		_era_buttons[i].pressed.connect(_on_era.bind(EraBook.IDS[i]))
	_look_status = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_look_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card.add_child(_look_status)
	card.add_child(_hint("How long the valley runs (a day of sun and moon is 1 minute at 2x)"))
	var labels: Array = []
	var icons: Array = []
	for season: Array in SEASONS:
		labels.append(season[0])
		icons.append(null)
	_season_buttons = FelecoUiScript.choice_row(card, labels, icons)
	for i: int in SEASONS.size():
		_season_buttons[i].tooltip_text = "%s: %d days of sun and moon. About %d minutes at the standard 2x, %d at 4x. Every run has all four seasons." % [SEASONS[i][0], int(SEASONS[i][1]), int(Clock.run_minutes(SEASONS[i][1])), int(ceil(Clock.run_minutes(SEASONS[i][1], 4.0)))]
		_season_buttons[i].pressed.connect(_on_time_setting.bind(i))

	card.add_child(_hint("Map: how herds are placed at the start"))
	_map = OptionButton.new()
	_map.custom_minimum_size = Vector2(0, 48)
	_map.icon = load("res://assets/icons/map.svg")
	_map.tooltip_text = "Map. How the herds are placed when the field opens."
	for name: String in MAPS:
		_map.add_item(name)
	_map.select(0)
	card.add_child(_map)

func _hint(text: String) -> Label:
	var lbl := FelecoUiScript.label(text, 15, FelecoUiScript.MIST)
	lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return lbl

func _icon_for(species: String) -> Texture2D:
	if not _species_icons.has(species):
		_species_icons[species] = FelecoUiScript.species_texture(species)
	return _species_icons[species]

func _read_counts_from_config() -> void:
	# Start from whatever the valley used last, so a replay keeps its numbers.
	var gc: Node = get_node("/root/GameConfig")
	_setting_counts = true
	for entry: Array in SPECIES_FIELDS:
		_spins[entry[0]].value = clampi(_config_count(gc, entry), 1, 40)
		_toggles[entry[0]].button_pressed = not gc.disabled_species.has(entry[4])
	_setting_counts = false
	_mark_matching_herd()

func _config_count(gc: Node, entry: Array) -> int:
	var field: String = entry[0]
	if field.begins_with("extra:"):
		return int(gc.extra_counts.get(field.substr(6), entry[3]))
	var v = gc.get(field)
	return int(entry[3]) if v == null else int(v)

func _on_species_toggled(on: bool, field: String) -> void:
	_spins[field].editable = on
	_spins[field].modulate.a = 1.0 if on else 0.35
	if not _setting_counts:
		_update_summary()

func _group_of_entry(entry: Array) -> String:
	var id: String = entry[4]
	if id == "tree" or id == "bush":
		return "producer"
	return SpeciesDB.group_of(id)

func _on_group_toggled(on: bool, group: String) -> void:
	_setting_counts = true
	for entry: Array in SPECIES_FIELDS:
		var hit: bool = entry[4] == "human" if group == "human" else _group_of_entry(entry) == group
		if hit:
			# "No humans" is pressed to remove them; the group buttons are pressed to keep.
			_toggles[entry[0]].button_pressed = (not on) if group == "human" else on
	_setting_counts = false
	_update_summary()

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
	var off: Array[String] = []
	for entry: Array in SPECIES_FIELDS:
		if _toggles[entry[0]].button_pressed:
			total += int(_spins[entry[0]].value)
		else:
			off.append(entry[1])
	_total_label.text = "%d creatures and plants in the valley." % total
	if not off.is_empty():
		_total_label.text += "  Left out: %s." % ", ".join(off)
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
	if _toggles.has(field) and not _toggles[field].button_pressed:
		return 0
	return int(_spins[field].value)

func _on_era(era: String) -> void:
	get_node("/root/EraPacks").choose(era)
	_show_era()

func _on_look_status(text: String) -> void:
	if _look_status != null:
		_look_status.text = text
	if _start != null and _start.text != _START_TEXT:
		_start.text = text if text != "" else _START_TEXT

func _show_era() -> void:
	var which: int = EraBook.IDS.find(str(get_node("/root/EraPacks").chosen()))
	if which < 0:
		which = 0
	FelecoUiScript.pick(_era_buttons, _era_buttons[which])
	for entry: Array in SPECIES_FIELDS:
		var named := EraBook.label_for(entry[4])
		_name_labels[entry[0]].text = named if named != "" else entry[1]
		if _icon_rects.has(entry[0]):
			(_icon_rects[entry[0]] as TextureRect).texture = FelecoUiScript.species_texture(entry[4])
	var deer: SpinBox = _spins["extra:deer"]
	deer.max_value = EraBook.herd_max("deer")
	if EraBook.id() == "lost":
		if int(deer.value) == 6 or int(deer.value) > 12:
			deer.value = mini(int(deer.value), 3 if int(deer.value) == 6 else 12)

func _on_time_setting(index: int) -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.time_setting = SEASONS[index][0]
	gc.time_limit = SEASONS[index][1]
	FelecoUiScript.pick(_season_buttons, _season_buttons[index])

func _on_start() -> void:
	var packs: Node = get_node("/root/EraPacks")
	if not bool(packs.call("settled")):
		var text := str(packs.line())
		_start.text = text if text != "" else "Fetching the look…"
		return
	_start.text = _START_TEXT
	var gc: Node = get_node("/root/GameConfig")
	gc.disabled_species.clear()
	for entry: Array in SPECIES_FIELDS:
		var field: String = entry[0]
		if field.begins_with("extra:"):
			gc.extra_counts[field.substr(6)] = _count(field)
		else:
			gc.set(field, _count(field))
		if not _toggles[field].button_pressed:
			gc.disabled_species.append(entry[4])
	gc.map_preset = _map.get_item_text(_map.selected)
	gc.grass_density = 0.5
	gc.current_mode = "sandbox"
	gc.board_mode = "full"
	gc.main_claim = false
	var producer: Dictionary = gc.link_boons().get("producer", {})
	gc.tree_count += int(producer.get("trees", 0))
	gc.grass_density = minf(gc.grass_density + float(producer.get("grass", 0.0)), 0.8)
	# The betting table names a fresh roster and applies upgrades once the
	# champion (the biggest faction stake) is known.
	gc.spawn_roster.clear()
	gc.bets.clear()
	gc.event_log.clear()
	gc.side_bet_result = ""
	get_tree().change_scene_to_file("res://scenes/ui/quest_board.tscn")

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

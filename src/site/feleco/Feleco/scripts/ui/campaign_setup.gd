extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

var _selected_faction: String = ""

const FACTIONS: Array[String] = ["sheep", "wolf", "human", "falcon", "robin", "boar", "rabbit", "worm", "fish"]

var _frame: Dictionary = {}
var _subtitle: Label
var _faction_grid: GridContainer
var _faction_buttons: Array[Button] = []
var _era_info: Label
var _traits_label: Label
var _start: Button
var _shop: Button

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.reset_run_state()
	gc.current_mode = "campaign"

	_frame = FelecoUiScript.build_screen(self, "Campaign", _on_back)
	var body: HBoxContainer = _frame["body"]
	var main := FelecoUiScript.card(body, "", 1.0)
	_subtitle = FelecoUiScript.label("", 19, FelecoUiScript.MIST)
	_subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	main.add_child(_subtitle)
	_faction_grid = GridContainer.new()
	_faction_grid.columns = 3
	_faction_grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_faction_grid.add_theme_constant_override("h_separation", 14)
	_faction_grid.add_theme_constant_override("v_separation", 14)
	main.add_child(_faction_grid)
	for faction: String in FACTIONS:
		var btn := Button.new()
		btn.text = faction.capitalize()
		if ResourceLoader.exists("res://assets/icons/%s.svg" % faction):
			btn.icon = load("res://assets/icons/%s.svg" % faction)
		btn.add_theme_constant_override("icon_max_width", 36)
		btn.custom_minimum_size = Vector2(0, 92)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.size_flags_vertical = Control.SIZE_EXPAND_FILL
		btn.add_theme_font_size_override("font_size", 22)
		btn.theme_type_variation = "TouchButton"
		btn.pressed.connect(_on_faction_selected.bind(faction))
		_faction_grid.add_child(btn)
		_faction_buttons.append(btn)
	_era_info = FelecoUiScript.label("", 24, FelecoUiScript.CREAM)
	_era_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_era_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_era_info.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_era_info.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	main.add_child(_era_info)
	_traits_label = FelecoUiScript.label("", 18, FelecoUiScript.GOLD)
	_traits_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	main.add_child(_traits_label)

	var footer: HBoxContainer = _frame["footer"]
	_shop = Button.new()
	_shop.text = "Greenhouse"
	_shop.icon = load("res://assets/icons/shop.svg")
	_shop.custom_minimum_size = Vector2(240, 60)
	_shop.pressed.connect(_on_shop)
	footer.add_child(_shop)
	_start = Button.new()
	_start.icon = load("res://assets/icons/start.svg")
	_start.custom_minimum_size = Vector2(380, 60)
	_start.add_theme_font_size_override("font_size", 24)
	_start.theme_type_variation = "PrimaryButton"
	_start.pressed.connect(_on_start)
	footer.add_child(_start)

	FelecoUiScript.dress_menu(self)
	# Show current campaign state
	if gc.campaign_era > 0 and not gc.campaign_faction.is_empty():
		_selected_faction = gc.campaign_faction
		_apply_era_traits(gc.campaign_era)
		_show_continuation()
	else:
		_show_faction_selection()

func _apply_era_traits(era: int) -> void:
	var gc: Node = get_node("/root/GameConfig")
	var traits: Dictionary = gc.campaign_traits
	# Auto-improvements scale with era
	if era >= 1:
		traits["health_boost"] = 1.0 + era * 0.05
	if era >= 3:
		traits["speed_boost"] = 1.0 + (era - 2) * 0.05
	if era >= 5:
		traits["population_boost"] = era - 4
	if era >= 7:
		traits["lifespan_boost"] = 1.0 + (era - 6) * 0.05
	gc.campaign_traits = traits
	gc.save_meta()

func _show_faction_selection() -> void:
	(_frame["title"] as Label).text = "Campaign: Choose Your Faction"
	_subtitle.text = "Pledge to one species. Survive 10 Eras of escalating danger."
	_faction_grid.show()
	_era_info.hide()
	_traits_label.hide()
	_start.text = "Begin Campaign"
	_start.disabled = true
	_shop.hide()

func _show_continuation() -> void:
	var gc: Node = get_node("/root/GameConfig")
	(_frame["title"] as Label).text = "Campaign: %s Ascension" % gc.campaign_faction.capitalize()
	_subtitle.text = "Your faction has survived %d Eras." % gc.campaign_era
	_faction_grid.hide()
	_era_info.show()
	_era_info.text = _describe_era(gc.campaign_era)
	_traits_label.show()
	_traits_label.text = _format_traits(gc.campaign_traits)
	_start.text = "Start Era %d" % (gc.campaign_era + 1)
	_start.disabled = false
	_shop.show()

func _describe_era(era: int) -> String:
	var descriptions: Array[String] = [
		"Era 1: The Seedling. Your species is small but determined.",
		"Era 2: First Bloom. Predators begin to notice your growth.",
		"Era 3: Growing Pains. Resources tighten and competition rises.",
		"Era 4: The Thaw. A harsh season tests your resilience.",
		"Era 5: Expansion. Your species must spread or be crushed.",
		"Era 6: Apex Hunt. The apex predators have learned your patterns.",
		"Era 7: Scarce Earth. Rot and drought claim the old grazing grounds.",
		"Era 8: The Siege. Every other species is stronger than you.",
		"Era 9: Cataclysm. Only the hardiest will see the dawn.",
		"Era 10: The Eternal Meadow. Survive, and your species ascends.",
	]
	return descriptions[mini(era, descriptions.size() - 1)]

func _format_traits(traits: Dictionary) -> String:
	var parts: Array[String] = []
	if traits.get("health_boost", 1.0) > 1.0:
		parts.append("Health +%.0f%%" % ((traits["health_boost"] - 1.0) * 100.0))
	if traits.get("speed_boost", 1.0) > 1.0:
		parts.append("Speed +%.0f%%" % ((traits["speed_boost"] - 1.0) * 100.0))
	if traits.get("population_boost", 0) > 0:
		parts.append("Population +%d" % traits["population_boost"])
	if traits.get("lifespan_boost", 1.0) > 1.0:
		parts.append("Lifespan +%.0f%%" % ((traits["lifespan_boost"] - 1.0) * 100.0))
	if parts.is_empty():
		return "No traits yet."
	return "Active Buffs: " + "  |  ".join(parts)

func _on_faction_selected(faction: String) -> void:
	_selected_faction = faction
	_start.disabled = false
	for btn in _faction_buttons:
		btn.theme_type_variation = "PrimaryButton" if btn.text.to_lower() == faction else "TouchButton"

func _on_start() -> void:
	var gc: Node = get_node("/root/GameConfig")
	if gc.campaign_era == 0 or gc.campaign_faction.is_empty():
		gc.campaign_faction = _selected_faction
		gc.campaign_era = 0
		gc.campaign_traits = {}
		gc.save_meta()

	var counts: Dictionary = _generate_campaign_era_counts(gc.campaign_faction, gc.campaign_era)
	_apply_counts_to_gameconfig(counts)
	gc.time_limit = 90.0
	gc.time_setting = "3 Months"
	gc.map_preset = "Random Scatter"
	gc.player_bet = gc.campaign_faction
	gc.current_mode = "campaign"
	gc.apply_upgrades()
	get_tree().change_scene_to_file("res://scenes/world.tscn")

func _generate_campaign_era_counts(faction: String, era: int) -> Dictionary:
	# Difficulty curve: faction starts small, enemies grow with era
	var base: int = maxi(4, 16 - era * 2)
	var enemy: int = 4 + era * 3
	var neutral: int = 4 + era

	var counts: Dictionary = {}
	for sp: String in FACTIONS:
		if sp == faction:
			counts[sp] = base
		elif sp == "wolf" or sp == "human":
			counts[sp] = enemy
		else:
			counts[sp] = neutral
	# Apply population boost from traits
	var gc: Node = get_node("/root/GameConfig")
	var pop_boost: int = gc.campaign_traits.get("population_boost", 0)
	if pop_boost > 0 and counts.has(faction):
		counts[faction] += pop_boost
	return counts

func _apply_counts_to_gameconfig(counts: Dictionary) -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.sheep_count = counts.get("sheep", 4)
	gc.wolf_count = counts.get("wolf", 4)
	gc.human_count = counts.get("human", 4)
	gc.spore_count = counts.get("spore", 4)
	gc.falcon_count = counts.get("falcon", 4)
	gc.robin_count = counts.get("robin", 4)
	gc.boar_count = counts.get("boar", 4)
	gc.worm_count = counts.get("worm", 4)
	gc.rabbit_count = counts.get("rabbit", 4)
	gc.tree_count = 6
	gc.grass_density = 0.5

func _on_shop() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/greenhouse_shop.tscn")

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

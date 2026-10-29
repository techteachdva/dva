extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

const SPECIES: Array[String] = ["sheep", "wolf", "human", "falcon", "robin", "boar", "worm", "rabbit", "spore"]
const POWERUPS: Array[String] = ["rain", "predator_call", "heal", "famine", "meteor"]

var _level_counts: Dictionary = {}
var _frame: Dictionary = {}
var _streak_label: Label
var _points_label: Label
var _preview_grid: GridContainer
var _bet_opt: OptionButton
var _powerup_label: Label

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.reset_run_state()
	gc.current_mode = "challenge"

	_frame = FelecoUiScript.build_screen(self, "Challenge", _on_back)
	var body: HBoxContainer = _frame["body"]

	var level := FelecoUiScript.card(body, "This level's valley", 1.3)
	_streak_label = FelecoUiScript.label("", 17, FelecoUiScript.CREAM)
	level.add_child(_streak_label)
	_points_label = FelecoUiScript.label("", 17, FelecoUiScript.GOLD)
	level.add_child(_points_label)
	_preview_grid = GridContainer.new()
	_preview_grid.columns = 3
	_preview_grid.add_theme_constant_override("h_separation", 22)
	_preview_grid.add_theme_constant_override("v_separation", 10)
	level.add_child(_preview_grid)

	var stakes := FelecoUiScript.card(body, "Your champion", 1.0)
	var hint := FelecoUiScript.label("Bet on the species you think will hold the valley after 3 months.", 15, FelecoUiScript.MIST)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	stakes.add_child(hint)
	_bet_opt = OptionButton.new()
	_bet_opt.custom_minimum_size = Vector2(0, 48)
	_bet_opt.icon = load("res://assets/icons/crown.svg")
	stakes.add_child(_bet_opt)
	stakes.add_child(FelecoUiScript.label("Powerups you carry in", 17, FelecoUiScript.GOLD))
	_powerup_label = FelecoUiScript.label("", 16, FelecoUiScript.CREAM)
	stakes.add_child(_powerup_label)
	var spacer := Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stakes.add_child(spacer)
	var reset := Button.new()
	reset.text = "Reset challenge progress"
	reset.theme_type_variation = "DangerButton"
	reset.add_theme_font_size_override("font_size", 15)
	reset.pressed.connect(_on_reset_progress)
	stakes.add_child(reset)

	var footer: HBoxContainer = _frame["footer"]
	var shop := Button.new()
	shop.text = "Greenhouse"
	shop.icon = load("res://assets/icons/shop.svg")
	shop.custom_minimum_size = Vector2(240, 60)
	shop.pressed.connect(_on_shop)
	footer.add_child(shop)
	var start := Button.new()
	start.text = "Start Level"
	start.icon = load("res://assets/icons/start.svg")
	start.custom_minimum_size = Vector2(380, 60)
	start.add_theme_font_size_override("font_size", 24)
	start.theme_type_variation = "PrimaryButton"
	start.pressed.connect(_on_start)
	footer.add_child(start)

	FelecoUiScript.dress_menu(self)
	_refresh_display()

func _refresh_display() -> void:
	var gc: Node = get_node("/root/GameConfig")
	_level_counts = ChallengeGenerator.generate_level(gc.challenge_level)
	(_frame["title"] as Label).text = "Challenge: Level %d" % (gc.challenge_level + 1)
	_streak_label.text = "Best streak %d   ·   Current streak %d" % [gc.challenge_best_streak, gc.challenge_current_streak]
	_points_label.text = "Eco Points: %d" % gc.eco_points

	for child in _preview_grid.get_children():
		child.queue_free()
	for sp: String in SPECIES:
		var count: int = _level_counts.get(sp, 0)
		if count <= 0:
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var icon := TextureRect.new()
		icon.custom_minimum_size = Vector2(30, 30)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if ResourceLoader.exists("res://assets/icons/%s.svg" % sp):
			icon.texture = load("res://assets/icons/%s.svg" % sp)
		row.add_child(icon)
		row.add_child(FelecoUiScript.label("%s  %d" % [sp.capitalize(), count], 18, FelecoUiScript.CREAM))
		_preview_grid.add_child(row)

	_bet_opt.clear()
	for sp: String in SPECIES:
		if sp != "spore" and _level_counts.get(sp, 0) > 0:
			_bet_opt.add_item(sp.capitalize())
	if _bet_opt.item_count > 0:
		_bet_opt.select(0)

	var parts: PackedStringArray = []
	for p: String in POWERUPS:
		parts.append("%s  %d" % [p.replace("_", " ").capitalize(), gc.powerup_inventory.get(p, 0)])
	_powerup_label.text = "\n".join(parts)

func _on_start() -> void:
	var gc: Node = get_node("/root/GameConfig")
	_apply_counts_to_gameconfig(_level_counts)
	gc.time_limit = 90.0
	gc.time_setting = "3 Months"
	gc.map_preset = "Random Scatter"
	if _bet_opt.item_count > 0 and _bet_opt.selected >= 0:
		gc.player_bet = _bet_opt.get_item_text(_bet_opt.selected).to_lower()
	else:
		gc.player_bet = _level_counts.get("bet", "sheep")
	gc.current_mode = "challenge"
	gc.apply_upgrades()
	get_tree().change_scene_to_file("res://scenes/world.tscn")

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

func _on_reset_progress() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.challenge_level = 0
	gc.challenge_current_streak = 0
	gc.challenge_best_streak = 0
	gc.save_meta()
	_refresh_display()

func _on_back() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

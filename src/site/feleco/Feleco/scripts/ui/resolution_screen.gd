extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

func _bet_to_plural(bet: String) -> String:
	match bet.to_lower():
		"wolf": return "wolves"
		"human": return "humans"
		"sheep": return "sheep"
		"falcon": return "falcons"
		"robin": return "robins"
		"boar": return "boars"
		"worm": return "worms"
		"rabbit": return "rabbits"
		"wizard": return "wizards"
		"builder": return "builders"
		_:
			return bet.to_lower()

func show_result(winner: String) -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var director: SimulationDirector = get_tree().current_scene.get_node_or_null("World") as SimulationDirector
	if winner.is_empty():
		$ScrollContainer/VBox/WinnerLabel.text = "THE VALLEY IS EMPTY"
	else:
		var hold_pct: int = 0
		if director != null:
			hold_pct = int(round(100.0 * float(director.last_holds.get(winner, 0.0))))
		$ScrollContainer/VBox/WinnerLabel.text = "%s HOLDS IT\n%d%% of its niche" % [winner.to_upper(), hold_pct]
	if gc != null and _bet_to_plural(gc.player_bet) == winner:
		$ScrollContainer/VBox/ResultLabel.text = "Your champion holds the valley."
		$ScrollContainer/VBox/ResultLabel.modulate = Color(0.902, 0.765, 0.416)
	else:
		$ScrollContainer/VBox/ResultLabel.text = "The valley chose otherwise."
		$ScrollContainer/VBox/ResultLabel.modulate = Color(0.733, 0.784, 0.725)
	if director == null:
		return

	# Population graph
	var graph: PopulationGraph = $ScrollContainer/VBox/Graph as PopulationGraph
	if graph != null:
		graph.set_history(director._population_history)

	# Final counts
	var counts: Dictionary = director.get_creature_counts()
	var total: int = 0
	for v: int in counts.values():
		total += v
	if total <= 0:
		total = 1
	var final_text: String = ""
	if director.last_holds.size() > 0:
		final_text = "Hold  "
		for sp: String in ["sheep", "wolves", "humans", "falcons", "robins", "boars", "rabbits", "worms", "fish"]:
			var hp: int = int(round(100.0 * float(director.last_holds.get(sp, 0.0))))
			final_text += "%s %d%%   " % [sp.capitalize(), hp]
		final_text += "\n"
	for sp in ["sheep", "wolves", "humans", "falcons", "robins", "boars", "rabbits", "worms", "fish", "wizards", "builders"]:
		var count: int = counts.get(sp, 0)
		var pct: int = int(round(float(count) / float(total) * 100.0))
		final_text += "%s: %d (%d%%)  |  " % [sp.capitalize(), count, pct]
	$ScrollContainer/VBox/FinalCounts.text = final_text.rstrip(" |")

	# Side bet result
	if gc != null and not gc.side_bet_entity.is_empty():
		var bet_name: String = gc.side_bet_entity.get("name", "")
		var bet_species: String = gc.side_bet_entity.get("species", "")
		var bet_type: String = gc.side_bet_entity.get("bet_type", "")
		var survived: bool = false
		for data: AgentData in director._agent_registry:
			if data.node == null or not is_instance_valid(data.node):
				continue
			if data.node.display_name == bet_name and data.species == bet_species:
				survived = true
				break
		var won: bool = (bet_type == "survive" and survived) or (bet_type == "die" and not survived)
		var result_str: String = "WON" if won else "LOST"
		var result_color: Color = Color.GOLD if won else Color(0.7, 0.2, 0.2)
		$ScrollContainer/VBox/SideBetLabel.text = "Side Bet: %s the %s (%s) - %s!" % [bet_name, bet_species.capitalize(), bet_type.to_upper(), result_str]
		$ScrollContainer/VBox/SideBetLabel.modulate = result_color
	else:
		$ScrollContainer/VBox/SideBetLabel.text = ""

	# Event history
	var event_log: Array[String] = gc.event_log if gc != null else []
	var richtext: RichTextLabel = $EventHistoryOverlay/MarginContainer/RichTextLabel
	var bbcode: String = ""
	for entry in event_log:
		bbcode += entry + "\n"
	richtext.text = bbcode

	# Eco Points award and next-level button
	if gc != null:
		var ep_gain: int = _calculate_ep_gain(winner, director)
		gc.award_eco_points(ep_gain)
		gc.save_meta()
		$ScrollContainer/VBox/EcoPointsLabel.text = "+ %d Eco Points" % ep_gain
		$ScrollContainer/VBox/EcoPointsLabel.modulate = Color.GOLD if ep_gain > 0 else Color.GRAY
		var next_btn: Button = $ScrollContainer/VBox/Buttons/NextLevel
		if gc.current_mode == "campaign":
			var won_campaign: bool = _bet_to_plural(gc.player_bet) == winner
			next_btn.text = "Next Era" if won_campaign else "Restart Campaign"
			next_btn.show()
		elif gc.current_mode == "challenge":
			var won_challenge: bool = _bet_to_plural(gc.player_bet) == winner
			next_btn.text = "Next Level" if won_challenge else "Retry"
			next_btn.show()
		else:
			next_btn.hide()
		# Advance campaign / challenge progress
		if gc.current_mode == "campaign":
			if _bet_to_plural(gc.player_bet) == winner:
				gc.campaign_era += 1
				if gc.campaign_era >= 10:
					gc.campaign_era = 0
					gc.campaign_faction = ""
			else:
				gc.campaign_era = 0
			gc.save_meta()
		elif gc.current_mode == "challenge":
			if _bet_to_plural(gc.player_bet) == winner:
				gc.challenge_level += 1
				gc.challenge_current_streak += 1
				if gc.challenge_current_streak > gc.challenge_best_streak:
					gc.challenge_best_streak = gc.challenge_current_streak
			else:
				gc.challenge_current_streak = 0
			gc.save_meta()

func _calculate_ep_gain(winner: String, director: SimulationDirector) -> int:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null:
		return 0
	var base: int = 10 if _bet_to_plural(gc.player_bet) == winner else 0
	var side: int = 0
	if not gc.side_bet_entity.is_empty():
		var bet_name: String = gc.side_bet_entity.get("name", "")
		var bet_species: String = gc.side_bet_entity.get("species", "")
		var bet_type: String = gc.side_bet_entity.get("bet_type", "")
		var survived: bool = false
		for data: AgentData in director._agent_registry:
			if data.node == null or not is_instance_valid(data.node):
				continue
			if data.node.display_name == bet_name and data.species == bet_species:
				survived = true
				break
		var won: bool = (bet_type == "survive" and survived) or (bet_type == "die" and not survived)
		if won:
			side = 5
	var mode_bonus: int = 0
	if gc.current_mode == "campaign":
		mode_bonus = gc.campaign_era * 5
	elif gc.current_mode == "challenge":
		var streak_mult: int = clampi(gc.challenge_current_streak, 1, 5)
		mode_bonus = gc.challenge_level * 10 * streak_mult
	return base + side + mode_bonus

func _ready() -> void:
	FelecoUiScript.dress_menu(self)
	FelecoUiScript.mark($ScrollContainer/VBox/Buttons/Replay, "PrimaryButton")
	FelecoUiScript.mark($ScrollContainer/VBox/Buttons/MainMenu, "GhostButton")
	$ScrollContainer/VBox/Buttons/Replay.pressed.connect(_on_replay)
	$ScrollContainer/VBox/Buttons/NewSetup.pressed.connect(_on_new_setup)
	$ScrollContainer/VBox/Buttons/NextLevel.pressed.connect(_on_next_level)
	$ScrollContainer/VBox/Buttons/Shop.pressed.connect(_on_shop)
	$ScrollContainer/VBox/Buttons/MainMenu.pressed.connect(_on_main_menu)
	$ScrollContainer/VBox/EventHistoryButton.pressed.connect(_on_show_history)
	$EventHistoryOverlay/CloseHistory.pressed.connect(_on_hide_history)

func _on_show_history() -> void:
	$EventHistoryOverlay.visible = true
	$ScrollContainer/VBox/EventHistoryButton.visible = false

func _on_hide_history() -> void:
	$EventHistoryOverlay.visible = false
	$ScrollContainer/VBox/EventHistoryButton.visible = true

func _on_replay() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.clear()
		gc.side_bet_result = ""
	get_tree().reload_current_scene()

func _on_new_setup() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.clear()
		gc.side_bet_result = ""
	if gc != null and gc.current_mode == "campaign":
		get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")
	elif gc != null and gc.current_mode == "challenge":
		get_tree().change_scene_to_file("res://scenes/ui/challenge_setup.tscn")
	else:
		get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn")

func _on_next_level() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.clear()
		gc.side_bet_result = ""
	if gc != null and gc.current_mode == "campaign":
		get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")
	elif gc != null and gc.current_mode == "challenge":
		get_tree().change_scene_to_file("res://scenes/ui/challenge_setup.tscn")
	else:
		get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn")

func _on_shop() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.clear()
		gc.side_bet_result = ""
	get_tree().change_scene_to_file("res://scenes/ui/greenhouse_shop.tscn")

func _on_main_menu() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.clear()
		gc.side_bet_result = ""
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

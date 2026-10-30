extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

# The year is awarded to a food-web group ("herbivore"), while the champion is
# still stored as a species id ("wolf") or a faction label ("Wolves").
func _champion_rules(bet: String, winner: String) -> bool:
	if winner.is_empty():
		return false
	var key := bet.strip_edges().to_lower()
	if key.is_empty():
		return false
	if key == winner:
		return true
	var group := SpeciesDB.group_of(SpeciesDB.id_for(key))
	return not group.is_empty() and group == winner

func show_result(winner: String) -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	# The game opens up as it's played: a finished year unlocks the next features.
	if gc != null:
		gc.set_record("progress", "runs", gc.valley_runs() + 1)
		gc.unlock("greenhouse")
		gc.unlock("opening")
		if gc.current_mode == "challenge" or gc.valley_runs() >= 3:
			gc.unlock("minigames")
	var director: SimulationDirector = get_tree().current_scene.get_node_or_null("World") as SimulationDirector
	if winner.is_empty():
		%WinnerLabel.text = "THE VALLEY IS EMPTY"
	else:
		var ruled: int = 0
		var share: int = 0
		if director != null:
			ruled = int(director.control_days.get(winner, 0.0))
			share = int(round(100.0 * director.control_share(winner)))
		var who: String = SpeciesDB.GROUP_LABEL.get(winner, winner.capitalize())
		%WinnerLabel.text = "%s hold the valley  ·  ruled %d days (%d%%)" % [who, ruled, share]
	%WinnerLabel.add_theme_font_override("font", FelecoUiScript.font("heading"))
	%WinnerLabel.add_theme_color_override("font_color", FelecoUiScript.GOLD)
	var champ_line: String = "Your champion holds the valley." if (gc != null and _champion_rules(str(gc.player_bet), winner)) else "The valley chose otherwise."
	%ResultLabel.modulate = Color(1, 1, 1)
	%ResultLabel.add_theme_color_override("font_color", FelecoUiScript.MIST)
	if director == null:
		%ResultLabel.text = champ_line
		return
	# The table's faction bets go by head count, so say who that was too.
	var crowd: Dictionary = director.get_creature_counts()
	var big: String = BetBook.leader(crowd)
	if big.is_empty():
		%ResultLabel.text = "%s  ·  Biggest crowd at the end: a tie" % champ_line
	else:
		%ResultLabel.text = "%s  ·  Biggest crowd at the end: %s (%d)" % [champ_line, BetBook.label_of(big), int(crowd.get(big, 0))]

	# Challenge: what the year was meant to show, and what actually happened.
	if gc != null and gc.current_mode == "challenge" and director.bet_tracker != null:
		var sc := ChallengeScenarios.find(gc.scenario_id)
		if not sc.is_empty():
			%ResultLabel.text = "%s
%s
%s" % [sc["moral"], ChallengeScenarios.recap(director.bet_tracker.stats), %ResultLabel.text]
			%ResultLabel.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

	# Population graph
	var graph: PopulationGraph = %Graph as PopulationGraph
	if graph != null:
		graph.set_history(director._population_history)

	# Final counts
	var counts: Dictionary = director.get_creature_counts()
	counts["mushrooms"] = director._active_spores.size()
	var total: int = 0
	for sp: String in SpeciesDB.CENSUS:
		total += int(counts.get(sp, 0))
	if total <= 0:
		total = 1
	var final_text: String = ""
	if director.control_days.size() > 0:
		final_text = "Days ruled  "
		for g: String in SpeciesDB.GROUPS:
			final_text += "%s %d   " % [SpeciesDB.GROUP_LABEL[g], int(director.control_days.get(g, 0.0))]
		final_text += "\n"
	for sp: String in SpeciesDB.CENSUS:
		var count: int = int(counts.get(sp, 0))
		var pct: int = int(round(float(count) / float(total) * 100.0))
		final_text += "%s: %d (%d%%)  |  " % [SpeciesDB.label(SpeciesDB.id_for(sp)), count, pct]
	%FinalCounts.text = final_text.rstrip(" |")

	# Ecosystem Roulette: every bet, won or lost (live wins were paid when they landed).
	if director.bet_tracker != null:
		director.bet_tracker.settle_final()
	var bet_label: Label = %SideBetLabel
	bet_label.hide()
	var board := _bet_board(gc)
	bet_label.get_parent().add_child(board)
	bet_label.get_parent().move_child(board, bet_label.get_index() + 1)

	# Event history
	var event_log: Array[String] = []
	if gc != null:
		event_log = gc.event_log
	var richtext: RichTextLabel = $EventHistoryOverlay/MarginContainer/RichTextLabel
	var bbcode: String = ""
	for entry in event_log:
		bbcode += entry + "\n"
	richtext.text = bbcode

	# Eco Points award and next-level button
	if gc != null:
		var bonus: int = _mode_bonus(gc)
		gc.award_eco_points(bonus)
		gc.save_meta()
		var won: int = 0
		var staked: int = 0
		for b: Dictionary in gc.bets:
			won += int(b.get("payout", 0))
			staked += int(b.get("stake", 0))
		var net: int = won - staked + bonus
		var text := "%s%d EP this run  ·  %d won on %d staked" % ["+" if net >= 0 else "−", absi(net), won, staked]
		if bonus > 0:
			text += "  ·  %d bonus" % bonus
		%EcoPointsLabel.text = "%s  ·  pot %d EP" % [text, gc.eco_points]
		%EcoPointsLabel.add_theme_font_override("font", FelecoUiScript.font("bold"))
		%EcoPointsLabel.modulate = Color.GOLD if net > 0 else Color(0.85, 0.8, 0.75)
		var next_btn: Button = %NextLevel
		if gc.current_mode == "campaign":
			var won_campaign: bool = _champion_rules(str(gc.player_bet), winner)
			next_btn.text = "Next Era" if won_campaign else "Restart Campaign"
			next_btn.show()
		elif gc.current_mode == "challenge":
			# Every year played unlocks the next one: the lesson is the reward.
			next_btn.text = "Next year" if ChallengeScenarios.index_of(gc.scenario_id) + 1 < ChallengeScenarios.LIST.size() else "Back to the years"
			next_btn.show()
		elif gc.current_mode == "sandbox":
			_saga_end(gc, director, next_btn)
		else:
			next_btn.hide()
		# Advance campaign / challenge progress
		if gc.current_mode == "campaign":
			if _champion_rules(str(gc.player_bet), winner):
				gc.campaign_era += 1
				if gc.campaign_era >= 10:
					gc.campaign_era = 0
					gc.campaign_faction = ""
			else:
				gc.campaign_era = 0
			gc.save_meta()
		elif gc.current_mode == "challenge":
			var idx: int = ChallengeScenarios.index_of(gc.scenario_id)
			gc.challenge_level = maxi(int(gc.challenge_level), idx + 1)
			# The streak counts years whose question came true.
			var answered: bool = false
			if director != null and director.bet_tracker != null:
				var fb := ChallengeScenarios.featured_bet(gc.scenario_id)
				answered = not fb.is_empty() and ChallengeScenarios.judge({"meta": fb}, director.bet_tracker.stats, true) > 0
			gc.challenge_current_streak = gc.challenge_current_streak + 1 if answered else 0
			gc.challenge_best_streak = maxi(gc.challenge_best_streak, gc.challenge_current_streak)
			gc.save_meta()

# The Valley Saga: how the year went, and Continue into the next one.
var _saga_summary: Dictionary = {}

func _saga_end(_gc: Node, director: SimulationDirector, next_btn: Button) -> void:
	var saga: ValleySaga = get_tree().current_scene.find_child("Saga", true, false) as ValleySaga
	if saga == null:
		next_btn.hide()
		return
	_saga_summary = saga.finish_year()
	var s: Dictionary = _saga_summary
	var line: String = "%s  -  YEAR GOAL %s: %s  -  goals met %d of %d (need %d to beat FelEco)" % [s["title"], "MET" if s["met"] else "MISSED", s["goal"], s["count"], ValleySaga.YEARS.size(), ValleySaga.YEARS_TO_WIN]
	%ResultLabel.text = "%s
%s" % [line, %ResultLabel.text]
	%ResultLabel.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if s["beaten"]:
		%WinnerLabel.text = "YOU BEAT FELECO!  Keeper of the Valley  (+%d EP)" % ValleySaga.SAGA_WIN_EP
		next_btn.text = "Begin a new saga"
	elif s["over"]:
		next_btn.text = "Saga over (%d of %d). Try again" % [s["count"], ValleySaga.YEARS.size()]
	else:
		next_btn.text = "Continue to Year %d" % (int(s["year"]) + 1)
	FelecoUiScript.mark(next_btn, "PrimaryButton")
	next_btn.show()

func _mode_bonus(gc: Node) -> int:
	if gc.current_mode == "campaign":
		return gc.campaign_era * 5
	if gc.current_mode == "challenge":
		return gc.challenge_level * 10 * clampi(gc.challenge_current_streak, 1, 5)
	return 0

# The bet slip, settled: a compact card per bet with its art, stake, odds and
# a won/lost chip, two columns so a full table of bets fits on screen.
func _bet_board(gc: Node) -> Control:
	var panel := PanelContainer.new()
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var wrap := panel
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.27, 0.17, 1)
	sb.border_color = Color(0.33, 0.22, 0.12, 1)
	sb.set_border_width_all(5)
	sb.set_corner_radius_all(22)
	for side in [SIDE_LEFT, SIDE_RIGHT, SIDE_TOP, SIDE_BOTTOM]:
		sb.set_content_margin(side, 16)
	panel.add_theme_stylebox_override("panel", sb)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	panel.add_child(col)
	col.add_child(FelecoUiScript.heading("Your bets", 24, FelecoUiScript.GOLD))
	if gc == null or gc.bets.is_empty():
		col.add_child(FelecoUiScript.label("You watched this one without a bet.", 17, FelecoUiScript.MIST))
		return wrap
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 6)
	col.add_child(grid)
	# Never scroll: show the biggest results, fold the rest into one line.
	const MAX_ROWS: int = 14
	var order: Array = gc.bets.duplicate()
	order.sort_custom(func(a, b): return int(a["payout"]) + int(a["stake"]) > int(b["payout"]) + int(b["stake"]))
	for i: int in mini(order.size(), MAX_ROWS):
		grid.add_child(_bet_row(gc, order[i]))
	if order.size() > MAX_ROWS:
		var rest_won: int = 0
		var rest_lost: int = 0
		for i: int in range(MAX_ROWS, order.size()):
			rest_won += int(order[i]["payout"])
			rest_lost += int(order[i]["stake"]) if order[i]["state"] != "won" else 0
		col.add_child(FelecoUiScript.label("…and %d more bets: +%d won, −%d lost" % [order.size() - MAX_ROWS, rest_won, rest_lost], 14, FelecoUiScript.MIST))
	return wrap

func _bet_row(gc: Node, b: Dictionary) -> Control:
	var won: bool = b["state"] == "won"
	var row := PanelContainer.new()
	row.custom_minimum_size = Vector2(0, 46)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.16, 0.2, 0.09, 0.95) if won else Color(0.05, 0.12, 0.07, 0.9)
	sb.border_color = FelecoUiScript.GOLD if won else Color(0.42, 0.58, 0.44, 0.6)
	sb.set_border_width_all(2 if won else 1)
	sb.set_corner_radius_all(12)
	for side in [SIDE_LEFT, SIDE_RIGHT]:
		sb.set_content_margin(side, 10)
	row.add_theme_stylebox_override("panel", sb)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	row.add_child(h)
	var art := TextureRect.new()
	var meta: Dictionary = b.get("meta", {})
	art.texture = BettingTable._roster_texture(meta) if meta.has("female") else FelecoUiScript.species_texture(String(b.get("sprite", "sheep")))
	art.custom_minimum_size = Vector2(38, 34)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	if String(b["type"]) in ["extinct", "doomed", "wipeout"]:
		art.flip_v = true
	h.add_child(art)
	var text := VBoxContainer.new()
	text.add_theme_constant_override("separation", -2)
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(text)
	var kind: String = {"survivor": "lives", "doomed": "dies early", "elder": "elder"}.get(String(b["type"]), "")
	var title: String = String(b["label"]) if kind.is_empty() else "%s %s" % [b["label"], kind]
	var tl := FelecoUiScript.heading(title, 15, FelecoUiScript.CREAM)
	tl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	tl.custom_minimum_size.x = 60
	text.add_child(tl)
	var when: String = ""
	if won and b.has("settled_day") and float(b["settled_day"]) < float(gc.time_limit) - 0.5:
		when = "  ·  paid on day %d" % int(b["settled_day"])
	var sub := FelecoUiScript.label("%d at ×%s%s" % [int(b["stake"]), _fmt(float(b["mult"])), when.replace("  ·  paid on day", " · day")], 13, FelecoUiScript.MIST)
	sub.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	sub.custom_minimum_size.x = 60
	text.add_child(sub)
	var chip := FelecoUiScript.heading("+%d" % int(b["payout"]) if won else "−%d" % int(b["stake"]), 18, FelecoUiScript.GOLD if won else FelecoUiScript.CLAY)
	chip.custom_minimum_size = Vector2(40, 0)
	chip.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	h.add_child(chip)
	return row

static func _fmt(m: float) -> String:
	var r: float = snappedf(m, 0.05)
	if absf(r - roundf(r)) < 0.001:
		return str(int(roundf(r)))
	if absf(r * 10.0 - roundf(r * 10.0)) < 0.001:
		return "%.1f" % r
	return "%.2f" % r

func _bet_report(gc: Node) -> String:
	if gc == null or gc.bets.is_empty():
		return "No bets this run."
	var lines: PackedStringArray = ["Your bets:"]
	for b: Dictionary in gc.bets:
		var mark: String = {"won": "WON", "lost": "lost"}.get(b["state"], "open")
		var pay: String = "+%d EP" % int(b["payout"]) if b["state"] == "won" else "-%d EP" % int(b["stake"])
		var when: String = ""
		if b["state"] == "won" and b.has("settled_day") and float(b["settled_day"]) < float(gc.time_limit) - 0.5:
			when = "  (paid on day %d)" % int(b["settled_day"])
		lines.append("%s  %s  ·  %d at ×%s  ·  %s%s" % [mark, b["label"], int(b["stake"]), str(snappedf(float(b["mult"]), 0.1)), pay, when])
	return "
".join(lines)

func _ready() -> void:
	FelecoUiScript.dress_menu(self)
	FelecoUiScript.mark(%Replay, "PrimaryButton")
	FelecoUiScript.mark(%MainMenu, "GhostButton")
	%Replay.pressed.connect(_on_replay)
	%NewSetup.pressed.connect(_on_new_setup)
	%NextLevel.pressed.connect(_on_next_level)
	%Shop.pressed.connect(_on_shop)
	%MainMenu.pressed.connect(_on_main_menu)
	%EventHistoryButton.pressed.connect(_on_show_history)
	$EventHistoryOverlay/CloseHistory.pressed.connect(_on_hide_history)

func _on_show_history() -> void:
	$EventHistoryOverlay.visible = true
	%EventHistoryButton.visible = false

func _on_hide_history() -> void:
	$EventHistoryOverlay.visible = false
	%EventHistoryButton.visible = true

func _on_replay() -> void:
	Engine.time_scale = 1.0
	get_tree().paused = false
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.clear()
		gc.side_bet_result = ""
		gc.bets.clear()
		gc.spawn_roster.clear()
		if gc.current_mode == "sandbox" and not _saga_summary.is_empty():
			ValleySaga.continue_saga(gc, null, true)
	# Same valley, new bets.
	get_tree().change_scene_to_file("res://scenes/ui/betting_table.tscn")

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
	if gc != null and gc.current_mode == "sandbox" and not _saga_summary.is_empty():
		# The saga goes on: next year, this valley's creatures, new bets.
		var director: SimulationDirector = get_tree().current_scene.get_node_or_null("World") as SimulationDirector
		ValleySaga.continue_saga(gc, director, false)
		gc.bets.clear()
		gc.spawn_roster.clear()
		get_tree().change_scene_to_file("res://scenes/ui/betting_table.tscn")
	elif gc != null and gc.current_mode == "campaign":
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

extends Node

# The opening film, played in the real valley. A narrator stumbles on golden
# grass and follows the gold from rabbit to mountain lion to wizard, finds
# some golden coins for the Coin Pot, bets on the wizard's rampage, watches
# it win and the payout fly home, then sets the whole valley running:
# "Felicitus Ecologia", which folds itself into FelEco. One creature per beat,
# scripted (see MarkovAgent.stage_to). Plays once on first launch; Skip, or
# the main menu's "Watch the opening", at any time.

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")
const WORLD: PackedScene = preload("res://scenes/world.tscn")
const TITLE: String = "Felicitus Ecologia"
# Letters of TITLE that stay to spell FelEco.
const KEEP: Array[int] = [0, 1, 2, 10, 11, 12]
# How long every line stays up, relative to the times written below.
const READ_PACE: float = 1.6
# The last word, different every time.
const SIGN_OFFS: Array[String] = ["Nice.", "Sweet.", "Radical.", "Cool.", "Awesome.", "Tuff.", "Fantastic.", "Whoa.", "Wow.", "CoOoOoL!", "OMG.", "Let's cook!", "Didn't have to go so hard..."]

var _world: Node
var _dir: SimulationDirector
var _cam: Camera3D
var _root: Control
var _caption: Label
var _bubble: Label
var _bubble_on: Node3D = null
var _shade: ColorRect
var _done: bool = false
var _anchor: Vector3 = Vector3.ZERO
var _pot: int = 0
var _pot_label: Label
var _pot_box: PanelContainer

func _ready() -> void:
	var gc: Node = get_node("/root/GameConfig")
	gc.reset_run_state()
	gc.current_mode = "intro"
	gc.scenario_id = ""
	# An empty valley: only the cast below walks in it, until the finale.
	gc.disabled_species.clear()
	for id: String in SpeciesDB.ROWS.keys():
		gc.disabled_species.append(id)
	gc.tree_count = 7
	gc.bush_count = 3
	gc.grass_density = 0.55
	gc.time_limit = 60.0
	gc.spawn_roster.clear()
	gc.bets.clear()
	_world = WORLD.instantiate()
	var loading: Node = _world.get_node_or_null("CanvasLayer/LoadingScreen")
	if loading != null:
		loading.get_parent().remove_child(loading)
		loading.free()
	add_child(_world)
	_dir = _world.get_node("World") as SimulationDirector
	_cam = _world.get_node("Camera3D") as Camera3D
	var hud: Node = _world.get_node_or_null("CanvasLayer/SimulationHUD")
	if hud != null:
		hud.set("visible", false)
		hud.process_mode = Node.PROCESS_MODE_DISABLED
	_build_overlay()
	_play.call_deferred()

# Esc, Space or Enter, or any click or tap, skips the film.
func _unhandled_input(event: InputEvent) -> void:
	if _done:
		return
	var skip: bool = event.is_action_pressed("ui_cancel") or event.is_action_pressed("ui_accept")
	if event is InputEventMouseButton and event.pressed:
		skip = true
	if event is InputEventScreenTouch and event.pressed:
		skip = true
	if skip:
		get_viewport().set_input_as_handled()
		_finish()

func _process(_delta: float) -> void:
	# The speech bubble rides above whoever is talking.
	if _bubble_on != null and is_instance_valid(_bubble_on) and _bubble.modulate.a > 0.01:
		var p: Vector2 = _cam.unproject_position(_bubble_on.global_position + Vector3.UP * 2.6)
		_bubble.position = p - Vector2(_bubble.size.x * 0.5, _bubble.size.y)

func _build_overlay() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 40
	add_child(layer)
	_root = Control.new()
	_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_root)
	for top: bool in [true, false]:
		var bar := ColorRect.new()
		bar.color = Color(0, 0, 0, 0.85)
		bar.anchor_right = 1.0
		bar.anchor_top = 0.0 if top else 1.0
		bar.anchor_bottom = 0.0 if top else 1.0
		bar.offset_top = 0.0 if top else -64.0
		bar.offset_bottom = 64.0 if top else 0.0
		bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_root.add_child(bar)
	_caption = FelecoUiScript.heading("", 30, FelecoUiScript.CREAM)
	_caption.anchor_right = 1.0
	_caption.anchor_top = 1.0
	_caption.anchor_bottom = 1.0
	_caption.offset_left = 80.0
	_caption.offset_right = -80.0
	_caption.offset_top = -160.0
	_caption.offset_bottom = -76.0
	_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_caption.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_caption.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_caption.add_theme_constant_override("outline_size", 8)
	_caption.modulate.a = 0.0
	_root.add_child(_caption)
	_bubble = FelecoUiScript.label("", 22, FelecoUiScript.INK)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(1, 0.98, 0.92)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(10)
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_size = 6
	_bubble.add_theme_stylebox_override("normal", sb)
	_bubble.add_theme_font_override("font", FelecoUiScript.font("heading"))
	_bubble.modulate.a = 0.0
	_root.add_child(_bubble)
	_shade = ColorRect.new()
	_shade.color = Color.BLACK
	_shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_shade)
	var skip := Button.new()
	skip.text = "Skip (any key)"
	skip.anchor_left = 1.0
	skip.anchor_right = 1.0
	skip.offset_left = -220
	skip.offset_right = -20
	skip.offset_top = 12
	skip.offset_bottom = 56
	skip.pressed.connect(_finish)
	_root.add_child(skip)
	FelecoUiScript.dress_hud(layer)
	skip.theme_type_variation = "GhostButton"

# ------------------------------------------------------------------
# The film
# ------------------------------------------------------------------
func _play() -> void:
	for i: int in 30:
		await get_tree().process_frame
	_anchor = _dir.dry_land(Vector3(-6.0, 0.0, 8.0))
	_anchor.y = _dir.ground_height(_anchor.x, _anchor.z)
	_clear_stage()
	_grow_gold(_anchor, 1)
	_view(_anchor, 0.2, -0.42, 8.0, true)
	await _fade(0.0, 1.4)
	await _say("What's this? Why... some grass is golden.", 3.2)
	if _done: return

	var rabbit := _dir.spawn_scripted("rabbit", _dir.dry_land(_anchor + Vector3(-9, 0, 1)))
	_follow(rabbit, 9.0)
	_say("Well, here comes a rabbit!", 2.6)
	await _walk(rabbit, _anchor + Vector3(-0.8, 0, 0.2), 2.6, "Walk")
	await _speak(rabbit, "Yummy yummy golden grass.", 2.2, "Graze")
	if _done: return
	rabbit.make_golden(1.0, "grass")
	_dir.grass.consume_density(_anchor, 0.4)
	FXManager.spawn_birth_particles(rabbit.global_position + Vector3.UP * 0.6, Color(1.0, 0.85, 0.3))
	await _hold_say(rabbit, "Oh my! The rabbit is golden now!", 2.6, "Graze")
	_look(rabbit, 2.4)
	await _hold_say(rabbit, "You are what you eat, I suppose...", 2.8, "Idle")
	if _done: return

	var lion := _dir.spawn_scripted("lion", _dir.dry_land(_anchor + Vector3(-11, 0, 4)))
	_view(_anchor + Vector3(-4, 0, 2), 0.1, -0.5, 13.0)
	_say("Oh no! Run, rabbit, run! Here comes a mountain lion!", 3.4)
	_walk(rabbit, _dir.dry_land(_anchor + Vector3(6, 0, -1)), 2.6, "Flee")
	await _walk(lion, _dir.dry_land(_anchor + Vector3(4.5, 0, -0.6)), 2.8, "Chase")
	if _done: return
	FXManager.spawn_combat_particles(rabbit.global_position)
	lion.devour(rabbit)
	_follow(lion, 9.0)
	await _hold_say(lion, "Now the mountain lion is golden!", 2.8, "Eat")
	if _done: return

	var wizard := _dir.spawn_scripted("human", _dir.dry_land(lion.global_position + Vector3(8, 0, 3)))
	Roles.apply(wizard, "human", Roles.SPECIAL)
	_view(lion.global_position + Vector3(3, 0, 1), 0.5, -0.45, 12.0)
	_say("Oh my goodness, a WIZARD?", 2.4)
	await _walk(wizard, lion.global_position + Vector3(3.2, 0, 1.0), 2.4, "Walk")
	await _hold(wizard, 0.8, "Channel")
	if _done: return
	FXManager.show_dramatic_text(lion.global_position + Vector3.UP * 2.0, "Zap!", Color(0.7, 0.6, 1.0))
	FXManager.spawn_combat_particles(lion.global_position)
	var lion_gold: float = lion.golden
	lion.die()
	wizard.make_golden(lion_gold * 0.9, "lion")
	await _hold_say(wizard, "Well, I guess wizard beats mountain lion.", 2.8, "Channel")
	_follow(wizard, 8.0)
	_look(wizard, 2.6)
	await _hold_say(wizard, "Now the wizard is golden. Curious...", 2.8, "Idle")
	if _done: return

	_view(wizard.global_position, 1.0, -0.6, 22.0)
	_dir.trigger_bloom()
	await _hold_say(wizard, "Well, this is fun just watching things, but can I use my powers to...", 3.4, "Channel")
	if _done: return

	await _hold_say(wizard, "A year in the valley is a quest, not a wager.", 3.2, "Idle")
	if _done: return
	_unleash()
	_view(Vector3(0, 0, 4), 0.6, -0.75, 62.0)
	await _say("You are Feleco, the spirit of this valley.", 3.0)
	if _done: return
	await _say("Main Game is the spirit's year. Start Simulation is the valley on its own.", 3.4)
	if _done: return
	await _say("A quest names a champion, a species, a category, a goal, a season, and a reward.", 3.6)
	if _done: return
	await _say("Accept the ones you choose. Succeed, and the valley opens looks, cursors and games.", 3.4)
	if _done: return
	await _say("Miss a quest, and you gain nothing. The valley simply goes on.", 3.2)
	if _done: return
	await _say("Then claim a creature. Brand is their body. Train is how they grow.", 3.2)
	if _done: return
	await _title_card()
	if _done: return
	await _say(SIGN_OFFS.pick_random(), 1.8)
	_finish()

# Every beat plays out along a strip around the anchor, with the camera on
# its +z side. Trees, bushes and fallen fruit there move to the far side of
# the valley, where they frame the shots instead of blocking them, and
# nothing new takes root until the finale.
func _clear_stage() -> void:
	_dir.tree_planting = false
	var stage := Rect2(_anchor.x - 18.0, _anchor.z - 8.0, 48.0, 40.0)
	var back_z: float = _anchor.z - 10.0
	for t: Node in _dir.get_node("Trees").get_children() + _dir.get_node("Bushes").get_children():
		var n := t as Node3D
		if n == null or not stage.has_point(Vector2(n.global_position.x, n.global_position.z)):
			continue
		for a: Node in n.find_children("*", "", true, false):
			if a.is_in_group("apple"):
				a.queue_free()
		n.global_position = _dir.dry_land(Vector3(randf_range(-24.0, 24.0), 0.0, randf_range(-25.0, back_z)))
		_dir._snap_to_ground(n)
	for a: Node in get_tree().get_nodes_in_group("apple"):
		var an := a as Node3D
		if an != null and stage.has_point(Vector2(an.global_position.x, an.global_position.z)):
			an.queue_free()

# Golden grass, tall and ripe, around a spot.
func _grow_gold(at: Vector3, radius: int) -> void:
	var g: GrassLayer = _dir.grass
	var c := g.world_to_grid(at)
	for dz: int in range(-radius, radius + 1):
		for dx: int in range(-radius, radius + 1):
			var x: int = clampi(c.x + dx, 0, g.grid_width - 1)
			var z: int = clampi(c.y + dz, 0, g.grid_height - 1)
			var i: int = z * g.grid_width + x
			g._cell_kind[i] = GrassLayer.Kind.GOLDEN
			# Tall and ripe, but under the line where grass goes to seed and dies.
			g._grid[i] = g.max_density * 0.62
			g._cell_stage[i] = 2.0
			g._cell_age[i] = 0.0
			g._mark_dirty(i)
	g.flush_visuals()

# Golden coins tumble down into the Coin Pot, the purse every bet comes from.
func _coins() -> void:
	_build_pot()
	_say("Oh, what's this? Golden coins? Into the Coin Pot they go. Let's play a game of chance...", 3.6)
	var vp: Vector2 = _root.get_viewport_rect().size
	var home: Vector2 = _pot_box.position + Vector2(14, 10)
	for i: int in 20:
		var coin := Coin.new()
		coin.position = Vector2(randf_range(vp.x * 0.3, vp.x * 0.7), -40.0)
		_root.add_child(coin)
		var tw := create_tween()
		tw.tween_interval(i * 0.08)
		tw.tween_property(coin, "position", Vector2(vp.x * 0.5 + randf_range(-60, 60), vp.y * 0.45), 0.45).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		tw.tween_property(coin, "position", home, 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tw.tween_callback(func() -> void:
			coin.queue_free()
			_add_pot(5))
	await get_tree().create_timer(3.6 * READ_PACE).timeout

# The Coin Pot, bottom left above the letterbox: what the player has to bet.
func _build_pot() -> void:
	var vp: Vector2 = _root.get_viewport_rect().size
	_pot_box = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.1, 0.07, 0.92)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(14)
	sb.set_content_margin_all(10)
	_pot_box.add_theme_stylebox_override("panel", sb)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	_pot_box.add_child(row)
	var icon := Coin.new()
	icon.custom_minimum_size = Vector2(36, 36)
	row.add_child(icon)
	_pot_label = FelecoUiScript.heading("Coin Pot  0", 26, FelecoUiScript.GOLD)
	row.add_child(_pot_label)
	_pot_box.position = Vector2(28, vp.y - 64.0 - 76.0)
	_pot_box.modulate.a = 0.0
	_root.add_child(_pot_box)
	create_tween().tween_property(_pot_box, "modulate:a", 1.0, 0.4)

func _add_pot(n: int) -> void:
	_pot += n
	_pot_label.text = "Coin Pot  %d" % _pot
	_pot_box.pivot_offset = _pot_box.size * 0.5
	var tw := create_tween()
	tw.tween_property(_pot_box, "scale", Vector2(1.08, 1.08), 0.06)
	tw.tween_property(_pot_box, "scale", Vector2.ONE, 0.12)

# A bet card in the style of the Bet Slip.
func _bet_card(sprite: String, title: String, line: String, odds: String) -> PanelContainer:
	var card := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.27, 0.17, 0.95)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(3)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(12)
	card.add_theme_stylebox_override("panel", sb)
	var col := VBoxContainer.new()
	card.add_child(col)
	var art := TextureRect.new()
	art.texture = FelecoUiScript.species_texture(sprite)
	art.custom_minimum_size = Vector2(150, 100)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	col.add_child(art)
	for t: Array in [[title, 24, FelecoUiScript.CREAM], [line, 16, FelecoUiScript.CREAM], [odds, 22, FelecoUiScript.GOLD]]:
		var l := FelecoUiScript.heading(t[0], t[1], t[2])
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		col.add_child(l)
	card.custom_minimum_size = Vector2(220, 0)
	card.modulate.a = 0.0
	_root.add_child(card)
	return card

# Two bets on the wizard; the rampage bet gets the stake. Returns its card.
func _bet_on_rampage(wizard: MarkovAgent) -> Control:
	var vp: Vector2 = _root.get_viewport_rect().size
	_view(wizard.global_position + Vector3(-2, 0, 0), 0.4, -0.5, 13.0)
	var safe := _bet_card("human", "Wizard survives", "Lives to the end of the year", "x1.4")
	var bold := _bet_card("human", "Successful Rampage", "12 kills before the gold runs out", "x3")
	safe.position = Vector2(vp.x * 0.56, vp.y * 0.16)
	bold.position = Vector2(vp.x * 0.56 + 250.0, vp.y * 0.16)
	for c: Control in [safe, bold]:
		create_tween().tween_property(c, "modulate:a", 1.0, 0.4)
	await _say("Golden creatures can be bet on. Safe and small, or bold and big...", 3.2)
	if _done: return bold
	_say("A golden wizard? I'm betting on a Successful Rampage!", 3.0)
	create_tween().tween_property(safe, "modulate:a", 0.35, 0.4)
	bold.pivot_offset = bold.size * 0.5
	var pick := create_tween()
	pick.tween_property(bold, "scale", Vector2(1.1, 1.1), 0.15)
	pick.tween_property(bold, "scale", Vector2.ONE, 0.2).set_trans(Tween.TRANS_BACK)
	# The stake, ten coins, hops out of the pot onto the slip.
	for i: int in 2:
		var coin := Coin.new()
		coin.position = _pot_box.position + Vector2(14, 10)
		_root.add_child(coin)
		_add_pot(-5)
		var hop := create_tween()
		hop.tween_interval(i * 0.15)
		hop.tween_property(coin, "position", bold.position + Vector2(90 + i * 14, bold.size.y - 30), 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		coin.add_to_group("stake")
	await get_tree().create_timer(2.6 * READ_PACE).timeout
	var out := create_tween()
	out.tween_property(safe, "modulate:a", 0.0, 0.4)
	return bold

# The wizard's golden rampage, played for the viewer: it dashes from prey to
# prey while the gold drains. Twelve kills wins, as in the game (RAMPAGE_GOAL).
func _rampage(wizard: MarkovAgent) -> bool:
	if wizard == null or not is_instance_valid(wizard):
		return false
	var goal: int = int(get_node("/root/GameConfig").RAMPAGE_GOAL)
	var prey: Array[MarkovAgent] = []
	var kinds: Array[String] = ["sheep", "rabbit", "deer", "goat", "boar"]
	for i: int in goal + 3:
		var ang: float = TAU * float(i) / float(goal + 3) + randf_range(-0.2, 0.2)
		var p := _dir.dry_land(wizard.global_position + Vector3(cos(ang), 0, sin(ang)) * randf_range(3.5, 8.0))
		var a := _dir.spawn_scripted(kinds[i % kinds.size()], p)
		if a != null:
			prey.append(a)
	_follow(wizard, 14.0)
	await _say("Make it yours, press Rampage, and the gold turns to fury!", 2.8)
	if _done: return false
	# The rampage HUD: gold left and kills toward the goal.
	var vp: Vector2 = _root.get_viewport_rect().size
	var hud := VBoxContainer.new()
	hud.position = Vector2(vp.x * 0.5 - 160.0, 84.0)
	hud.custom_minimum_size = Vector2(320, 0)
	var kills_l := FelecoUiScript.heading("Rampage  0 / %d" % goal, 28, FelecoUiScript.GOLD)
	kills_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	kills_l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	kills_l.add_theme_constant_override("outline_size", 8)
	hud.add_child(kills_l)
	var bar := ProgressBar.new()
	bar.max_value = 1.0
	bar.value = 1.0
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(320, 14)
	var fill := StyleBoxFlat.new()
	fill.bg_color = FelecoUiScript.GOLD
	fill.set_corner_radius_all(7)
	bar.add_theme_stylebox_override("fill", fill)
	hud.add_child(bar)
	_root.add_child(hud)
	wizard.golden = 1.0
	FXManager.show_dramatic_text(wizard.global_position + Vector3.UP * 2.5, "RAMPAGE!", Color(1.0, 0.82, 0.25))
	Engine.time_scale = 1.0
	var kills: int = 0
	var gold: float = 1.0
	while kills < goal and not _done and is_instance_valid(wizard):
		var best: MarkovAgent = null
		var best_d: float = INF
		for a: MarkovAgent in prey:
			if is_instance_valid(a) and not a.is_queued_for_deletion():
				var d: float = a.global_position.distance_to(wizard.global_position)
				if d < best_d:
					best_d = d
					best = a
		if best == null:
			break
		await _walk(wizard, best.global_position, clampf(best_d / 9.0, 0.25, 0.6), "Walk")
		if _done or not is_instance_valid(best):
			break
		FXManager.spawn_combat_particles(best.global_position)
		FXManager.show_floating_text(best.global_position + Vector3.UP, "CHOMP", Color(1.0, 0.85, 0.3))
		prey.erase(best)
		wizard.devour(best)
		kills += 1
		gold -= 0.065
		wizard.golden = gold
		kills_l.text = "Rampage  %d / %d" % [kills, goal]
		create_tween().tween_property(bar, "value", gold, 0.2)
	if _done:
		return false
	wizard.golden = maxf(gold, 0.0)
	FXManager.show_dramatic_text(wizard.global_position + Vector3.UP * 3.0, "Rampage won!", Color(1.0, 0.85, 0.3))
	kills_l.text = "RAMPAGE WON  %d / %d" % [kills, goal]
	await _hold_say(wizard, "Twelve before the gold ran out. The rampage is won!", 2.8, "Channel")
	var out := create_tween().set_parallel(true)
	out.tween_property(hud, "modulate:a", 0.0, 0.5)
	for a: MarkovAgent in prey:
		if is_instance_valid(a):
			a.queue_free()
	return kills >= goal

# The bet pays: stake times three flies from the slip back into the pot.
func _payout(card: Control, wizard: MarkovAgent) -> void:
	var stamp := FelecoUiScript.heading("BET WON  x3", 30, FelecoUiScript.GOLD)
	stamp.add_theme_color_override("font_outline_color", Color(0.25, 0.15, 0.02, 0.95))
	stamp.add_theme_constant_override("outline_size", 10)
	stamp.position = card.position + Vector2(10, -48)
	_root.add_child(stamp)
	_say("The bet pays three to one. Into the pot!", 3.0)
	for c: Node in get_tree().get_nodes_in_group("stake"):
		(c as Control).queue_free()
	var home: Vector2 = _pot_box.position + Vector2(14, 10)
	var from: Vector2 = card.position + card.size * 0.5
	if is_instance_valid(wizard):
		from = _cam.unproject_position(wizard.global_position + Vector3.UP * 1.5)
	for i: int in 6:
		var coin := Coin.new()
		coin.position = from + Vector2(randf_range(-30, 30), randf_range(-30, 30))
		_root.add_child(coin)
		var mid: Vector2 = coin.position.lerp(home, 0.5) + Vector2(0, -160)
		var tw := create_tween()
		tw.tween_interval(i * 0.12)
		tw.tween_property(coin, "position", mid, 0.35).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		tw.tween_property(coin, "position", home, 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tw.tween_callback(func() -> void:
			coin.queue_free()
			_add_pot(5))
	await get_tree().create_timer(3.0 * READ_PACE).timeout
	var out := create_tween().set_parallel(true)
	out.tween_property(card, "modulate:a", 0.0, 0.5)
	out.tween_property(stamp, "modulate:a", 0.0, 0.5)
	await out.finished

# The whole valley at once: every species, running on its own.
func _unleash() -> void:
	_dir.disabled_species.clear()
	_dir.tree_planting = true
	var counts: Dictionary = {"sheep": 8, "rabbit": 8, "deer": 6, "goat": 5, "wolf": 5, "lion": 2, "falcon": 3,
		"human": 6, "bear": 2, "boar": 5, "robin": 6, "worm": 8, "beetle": 8, "fish": 6}
	for id: String in counts.keys():
		for i: int in int(counts[id]):
			var p := _dir.dry_land(Vector3(randf_range(-26, 26), 0, randf_range(-26, 26)))
			if id == "fish" and _dir.valley != null and _dir.valley.river != null:
				p = _dir.valley.river.random_point()
			var a := _dir.spawn_scripted(id, p)
			if a != null:
				a.scripted = false
				a.set_state(a._current_state)

# "FELICITUS ECOLOGIA" in gold, then the extra letters fall away into FelEco.
func _title_card() -> void:
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 0)
	row.set_anchors_preset(Control.PRESET_CENTER)
	row.anchor_left = 0.0
	row.anchor_right = 1.0
	row.offset_top = -70
	row.offset_bottom = 70
	_root.add_child(row)
	var letters: Array[Label] = []
	for i: int in TITLE.length():
		var l := FelecoUiScript.heading(TITLE[i] if TITLE[i] != " " else "  ", 64, FelecoUiScript.GOLD)
		l.add_theme_color_override("font_outline_color", Color(0.25, 0.15, 0.02, 0.95))
		l.add_theme_constant_override("outline_size", 14)
		l.modulate.a = 0.0
		row.add_child(l)
		letters.append(l)
	var tw := create_tween()
	for l: Label in letters:
		tw.tween_property(l, "modulate:a", 1.0, 0.06)
	await tw.finished
	await get_tree().create_timer(1.4).timeout
	# The extra letters fade and fold away, closing the word up.
	for i: int in letters.size():
		if KEEP.has(i):
			continue
		var l: Label = letters[i]
		var fold := create_tween()
		fold.tween_property(l, "modulate:a", 0.0, 0.18)
		fold.tween_callback(l.hide)
		await get_tree().create_timer(0.07).timeout
	await get_tree().create_timer(0.4).timeout
	var bounce := create_tween()
	row.pivot_offset = row.size * 0.5
	bounce.tween_property(row, "scale", Vector2(1.15, 1.15), 0.18)
	bounce.tween_property(row, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK)
	await get_tree().create_timer(1.6).timeout

func _walk(a: MarkovAgent, to: Vector3, secs: float, state: String) -> void:
	if a == null or not is_instance_valid(a):
		return
	var from: Vector3 = a.global_position
	to.y = _dir.ground_height(to.x, to.z)
	var t: float = 0.0
	while t < secs and not _done and is_instance_valid(a):
		t += get_process_delta_time()
		var p: Vector3 = from.lerp(to, smoothstep(0.0, 1.0, t / secs))
		p.y = _dir.ground_height(p.x, p.z)
		a.stage_to(p, state)
		await get_tree().process_frame

# The creature turns to look straight out at the viewer for a moment.
func _look(a: MarkovAgent, secs: float) -> void:
	if a != null and is_instance_valid(a) and a._data != null:
		a._data.look_until = AgentData.clock + secs

func _hold(a: MarkovAgent, secs: float, state: String) -> void:
	var t: float = 0.0
	while t < secs and not _done and is_instance_valid(a):
		t += get_process_delta_time()
		a.stage_to(a.global_position, state)
		await get_tree().process_frame

# Narration while a creature holds a pose.
func _hold_say(a: MarkovAgent, text: String, secs: float, state: String) -> void:
	_say(text, secs)
	await _hold(a, secs * READ_PACE, state)

# A creature's own line, in a speech bubble above it.
func _speak(a: MarkovAgent, text: String, secs: float, state: String) -> void:
	_bubble.text = text
	_bubble.reset_size()
	_bubble_on = a
	var tw := create_tween()
	tw.tween_property(_bubble, "modulate:a", 1.0, 0.2)
	await _hold(a, secs * READ_PACE, state)
	var out := create_tween()
	out.tween_property(_bubble, "modulate:a", 0.0, 0.25)

func _say(text: String, secs: float) -> void:
	if _done:
		return
	_caption.text = text
	var tw := create_tween()
	tw.tween_property(_caption, "modulate:a", 1.0, 0.35)
	tw.tween_interval(maxf(secs * READ_PACE - 0.7, 0.2))
	tw.tween_property(_caption, "modulate:a", 0.0, 0.35)
	await tw.finished

func _fade(to: float, secs: float) -> void:
	var tw := create_tween()
	tw.tween_property(_shade, "color:a", to, secs)
	await tw.finished

func _view(at: Vector3, yaw: float, pitch: float, dist: float, instant: bool = false) -> void:
	if _cam.has_method("follow"):
		_cam.follow(null)
	if _cam.has_method("set_view"):
		_cam.set_view(Vector3(at.x, 0.0, at.z), yaw, pitch, dist, instant)

func _follow(a: Node3D, dist: float) -> void:
	if _cam.has_method("follow"):
		_cam.follow(a)
		_cam.set("_goal_distance", dist)
		_cam.set("_goal_pitch", -0.45)

func _finish() -> void:
	if _done:
		return
	_done = true
	Engine.time_scale = 1.0
	var gc: Node = get_node("/root/GameConfig")
	gc.intro_seen = true
	gc.disabled_species.clear()
	gc.current_mode = "sandbox"
	gc.save_meta()
	var tw := create_tween()
	tw.tween_property(_shade, "color:a", 1.0, 0.6)
	await tw.finished
	get_tree().change_scene_to_file("res://scenes/ui/main_menu.tscn")

# A golden coin with a rim and a shine.
class Coin extends Control:
	func _ready() -> void:
		size = Vector2(36, 36)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		draw_circle(Vector2(18, 18), 17.0, Color(0.62, 0.46, 0.18))
		draw_circle(Vector2(18, 18), 14.0, Color(0.95, 0.8, 0.36))
		draw_circle(Vector2(18, 18), 9.0, Color(0.88, 0.7, 0.28))
		draw_circle(Vector2(13, 12), 3.5, Color(1.0, 0.96, 0.8))

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
# A moderate read: about two words a second, and never a glance.
const SECONDS_PER_WORD: float = 0.55
const MIN_READ: float = 4.2
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
# Seconds the current bottom line still needs to stay up.
var _line_left: float = 0.0
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
	_line_left = maxf(_line_left - _delta, 0.0)
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
	_caption = FelecoUiScript.heading("", 26, FelecoUiScript.CREAM)
	_caption.name = "FilmCaption"
	_caption.anchor_right = 1.0
	_caption.anchor_top = 1.0
	_caption.anchor_bottom = 1.0
	_caption.offset_left = 80.0
	_caption.offset_right = -80.0
	_caption.offset_top = -148.0
	_caption.offset_bottom = -70.0
	_caption.clip_contents = true
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
	await _hold_say(rabbit, "You are what you eat, I suppose...", 2.4, "Idle")
	if _done: return
	await _grass_rampage(rabbit)
	if _done: return
	await _gold_fades(rabbit)
	if _done: return

	var lion := _dir.spawn_scripted("lion", _dir.dry_land(_anchor + Vector3(-11, 0, 4)))
	_view(_anchor + Vector3(-4, 0, 2), 0.1, -0.5, 13.0)
	_say("Oh no! Run, rabbit, run! Here comes a mountain lion!", 3.2)
	_walk(rabbit, _dir.dry_land(_anchor + Vector3(6, 0, -1)), 2.4, "Flee")
	await _walk(lion, _dir.dry_land(_anchor + Vector3(4.5, 0, -0.6)), 2.6, "Chase")
	if _done: return
	FXManager.spawn_combat_particles(rabbit.global_position)
	# The rabbit looks ordinary again. The gold still passes to whoever eats it.
	_allow_death(rabbit)
	lion.devour(rabbit)
	lion.make_golden(1.0, "rabbit")
	_follow(lion, 9.0)
	await _hold_say(lion, "Now the mountain lion is golden!", 2.6, "Eat")
	if _done: return

	var wizard := _dir.spawn_scripted("human", _dir.dry_land(lion.global_position + Vector3(8, 0, 3)))
	Roles.apply(wizard, "human", Roles.SPECIAL)
	_view(lion.global_position + Vector3(3, 0, 1), 0.5, -0.45, 12.0)
	_say("Oh my goodness, a WIZARD?", 2.2)
	await _walk(wizard, lion.global_position + Vector3(3.2, 0, 1.0), 2.2, "Walk")
	if _done: return
	await _two_whacks(wizard, lion)
	if _done: return
	await _hold_say(wizard, "Well, I guess wizard beats mountain lion.", 2.4, "Idle")
	_follow(wizard, 8.0)
	_look(wizard, 2.2)
	await _hold_say(wizard, "Now the wizard is golden. Curious...", 2.4, "Idle")
	if _done: return

	_view(wizard.global_position, 1.0, -0.55, 18.0)
	await _hold_say(wizard, "Your name is Feleco, you are the spirit in charge of this valley", 3.6, "Idle")
	if _done: return
	await _human_markov()
	if _done: return
	await _hold_say(wizard, "A year in the valley is a quest, not a wager.", 2.8, "Idle")
	if _done: return
	_unleash()
	_view(Vector3(0, 0, 4), 0.6, -0.75, 62.0)
	await _say("You are Feleco, the spirit of this valley.", 2.8)
	if _done: return
	await _teach()
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
	var stay: float = _stay_for(text, secs)
	_caption.text = text
	_caption.modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(_caption, "modulate:a", 1.0, 0.3)
	await _hold(a, stay, state)

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
	if not await _let_read():
		return
	_caption.text = text
	var stay: float = _stay_for(text, secs)
	var tw := create_tween()
	tw.tween_property(_caption, "modulate:a", 1.0, 0.35)
	tw.tween_interval(stay)
	tw.tween_property(_caption, "modulate:a", 0.0, 0.35)
	await tw.finished

# Words on screen long enough to read without hurrying, whichever clock is longer.
func _stay_for(text: String, secs: float) -> float:
	return maxf(secs * READ_PACE, _read_for(text))

func _read_for(text: String) -> float:
	var words: int = text.split(" ", false).size()
	return maxf(MIN_READ, float(words) * SECONDS_PER_WORD + 1.8)

# Keeps the line that is already up until it has been readable.
func _let_read() -> bool:
	if _line_left > 0.05:
		var left: float = _line_left
		_line_left = 0.0
		return await _beat(left)
	return is_inside_tree() and not _done

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

# The gold rabbit bolts from tuft to tuft and grazes each one.
func _grass_rampage(rabbit: MarkovAgent) -> void:
	if rabbit == null or not is_instance_valid(rabbit):
		return
	await _note("The gold takes hold. The rabbit rampages through the grass.")
	_follow(rabbit, 12.0)
	var origin: Vector3 = rabbit.global_position
	for i: int in 5:
		if _done or not is_instance_valid(rabbit):
			return
		var ang: float = TAU * float(i) / 5.0
		var spot: Vector3 = _dir.dry_land(origin + Vector3(cos(ang), 0.0, sin(ang)) * 3.4)
		await _walk(rabbit, spot, 0.5, "Walk")
		if _done or not is_instance_valid(rabbit):
			return
		_dir.grass.consume_density(spot, 0.7)
		FXManager.spawn_birth_particles(spot + Vector3.UP * 0.35, Color(0.55, 0.95, 0.4))
		FXManager.show_floating_text(spot + Vector3.UP * 1.2, "munch", Color(0.75, 1.0, 0.5))
		await _hold(rabbit, 0.42, "Graze")
	if not await _beat(0.6):
		return

# The shine leaves. The rabbit stands as an ordinary rabbit again.
func _gold_fades(rabbit: MarkovAgent) -> void:
	if rabbit == null or not is_instance_valid(rabbit):
		return
	var t: float = 0.0
	while t < 0.7 and is_instance_valid(rabbit) and not _done and is_inside_tree():
		t += get_process_delta_time()
		rabbit.golden = lerpf(1.0, 0.0, clampf(t / 0.55, 0.0, 1.0))
		rabbit.gold_latent = false
		rabbit.stage_to(rabbit.global_position, "Idle")
		await get_tree().process_frame
	if is_instance_valid(rabbit):
		rabbit.golden = 0.0
		rabbit.gold_latent = false
		rabbit.gold_claimed = false
		rabbit.stage_to(rabbit.global_position, "Idle")
	await _note("The gold runs out. The rabbit is itself again.")
	await _beat(1.6)

# Two strikes, and only two: wind up, hit, wind up, hit. Then the lion falls.
func _two_whacks(wizard: MarkovAgent, lion: MarkovAgent) -> void:
	if wizard == null or lion == null or not is_instance_valid(wizard) or not is_instance_valid(lion):
		return
	await _note("The wizard strikes. Twice.")
	var face: float = -1.0 if lion.global_position.x < wizard.global_position.x else 1.0
	for hit: int in 2:
		if _done or not is_instance_valid(wizard) or not is_instance_valid(lion):
			return
		_pose(wizard, SpriteGenerator.F_WINDUP, face)
		if not await _beat(0.34):
			return
		_pose(wizard, SpriteGenerator.F_STRIKE, face)
		FXManager.spawn_combat_particles(lion.global_position)
		FXManager.show_floating_text(lion.global_position + Vector3.UP * 1.8, "Whack!", Color(1.0, 0.92, 0.62))
		await _note("The first blow." if hit == 0 else "The second blow.")
		if not await _beat(0.55):
			return
		_pose(wizard, SpriteGenerator.F_STAND, face)
		if hit == 0 and not await _beat(0.38):
			return
	var lion_gold: float = lion.golden
	_allow_death(lion)
	lion.die()
	if is_instance_valid(wizard):
		wizard.make_golden(maxf(lion_gold, 0.9), "lion")
		if wizard._data != null:
			wizard._data.forced_frame = -1
			wizard.stage_to(wizard.global_position, "Idle")

func _pose(a: MarkovAgent, frame: int, face_sign: float) -> void:
	if a == null or not is_instance_valid(a):
		return
	a.stage_to(a.global_position, "Hunt")
	if a._data != null:
		a._data.forced_frame = frame
		a._data.face = face_sign

# A small map of the choices a human actually makes. A token walks the arrows.
func _human_markov() -> void:
	await _note("This is how a human decides. Each arrow is a real choice in the valley.")
	var board := HumanModel.new()
	board.z_index = 30
	_root.add_child(board)
	_root.move_child(board, _caption.get_index())
	if not await _frames(2):
		board.queue_free()
		return
	if not await _beat(1.8):
		board.queue_free()
		return
	var steps: Array[Array] = [
		["Gather", "Most of the time, a human gathers food."],
		["Cook", "Food in hand: they carry it to a fire and cook."],
		["Sleep", "Night falls. They go to sleep."],
		["Flee", "A hunter is close, and they are alone. They flee."],
		["Hunt", "Three humans together do not run. They hunt."],
		["Travel", "Too far from the hut, they travel home."],
	]
	for step: Array in steps:
		if _done or not is_inside_tree():
			break
		await _note(str(step[1]))
		board.focus(str(step[0]))
		if not await _beat(2.7):
			break
	if is_instance_valid(board):
		board.queue_free()

# The film is allowed to finish a meal the gold shield would refuse.
func _scripted_kill(eater: MarkovAgent, prey: MarkovAgent) -> void:
	if prey == null or not is_instance_valid(prey):
		return
	var carried: float = prey.golden
	var source: String = str(prey.species_id)
	_allow_death(prey)
	if eater != null and is_instance_valid(eater):
		eater.devour(prey)
		if carried > 0.05:
			eater.make_golden(carried, source)
	elif is_instance_valid(prey):
		prey.die()

func _allow_death(a: MarkovAgent) -> void:
	if a == null or not is_instance_valid(a):
		return
	a.golden = 0.0
	a.gold_claimed = true
	a.gold_latent = false

# ------------------------------------------------------------------
# How to play, shown as the windows themselves. A cursor does the clicks.
# ------------------------------------------------------------------
var _pointer: Control
var _ring: Panel
var _teach_root: Control
var _taken: Dictionary = {}

func _teach() -> void:
	if not await _doors():
		return
	if not await _quests():
		return
	if not await _hand_lesson():
		return
	if not await _powers_lesson():
		return
	_clear_teach()

func _doors() -> bool:
	var win := _window("Two ways in")
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 18)
	win.add_child(row)
	var main := _door("Main Game", "The spirit's year.\nQuests, then one champion.")
	var sim := _door("Start Simulation", "The valley on its own.\nYou pick one plan first.")
	row.add_child(main)
	row.add_child(sim)
	await _note("Main Game is your year as the spirit. Start Simulation is the valley running by itself.")
	if not await _beat(2.6):
		return false
	if not await _press(main):
		return false
	main.theme_type_variation = "PrimaryButton"
	return await _beat(0.8)

func _quests() -> bool:
	_clear_teach()
	var win := _window("Quest Board")
	var intro := FelecoUiScript.label("Main quests choose a side. Side quests are extra. Accept any you want.", 16, FelecoUiScript.CREAM)
	intro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	win.add_child(intro)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 16)
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	win.add_child(row)
	var buttons: Dictionary = {}
	for lane: String in ["main", "side"]:
		var col := VBoxContainer.new()
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_theme_constant_override("separation", 6)
		col.add_child(FelecoUiScript.heading("Main Quests" if lane == "main" else "Side Quests", 18, FelecoUiScript.GOLD))
		row.add_child(col)
		for q: Dictionary in QuestBoard.QUESTS:
			if q["lane"] != lane:
				continue
			var b := Button.new()
			b.custom_minimum_size = Vector2(0, 44)
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			b.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.set_meta("quest", q)
			_paint_quest(b)
			col.add_child(b)
			buttons[q["id"]] = b
	var status := FelecoUiScript.label("Choose one to read it.", 15, FelecoUiScript.GOLD)
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.custom_minimum_size = Vector2(0, 22)
	win.add_child(status)
	var begin := Button.new()
	begin.text = "Begin the year"
	begin.theme_type_variation = "PrimaryButton"
	begin.custom_minimum_size = Vector2(240, 48)
	begin.mouse_filter = Control.MOUSE_FILTER_IGNORE
	begin.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	win.add_child(begin)
	if not await _frames(2):
		return false
	await _note("Click any quest to take it. Click it again to put it back.")
	if not await _beat(2.8):
		return false
	var grazers: Button = buttons["quest:grazers"]
	if not await _press(grazers):
		return false
	_toggle_quest(grazers, status)
	if not await _beat(1.6):
		return false
	await _note("Click the same quest again to put it back. You are not stuck with the first one you touch.")
	if not await _beat(2.4):
		return false
	if not await _press(grazers):
		return false
	_toggle_quest(grazers, status)
	if not await _beat(1.4):
		return false
	await _note("Take whichever you want. One quest, or every quest. Main and side, together.")
	if not await _beat(2.4):
		return false
	var hunters: Button = buttons["quest:hunters"]
	var rabbits: Button = buttons["quest:rabbits"]
	if not await _press(hunters):
		return false
	_toggle_quest(hunters, status)
	if not await _beat(0.45):
		return false
	if not await _press(rabbits):
		return false
	_toggle_quest(rabbits, status)
	if not await _beat(0.45):
		return false
	if not await _press(grazers):
		return false
	_toggle_quest(grazers, status)
	if not await _beat(1.5):
		return false
	await _note("Miss a quest you accepted, and you gain nothing. One you never took was never yours.")
	if not await _beat(2.6):
		return false
	if not await _press(begin):
		return false
	await _note("Begin the year when the list is the one you want. In the valley, Quests opens this board again.")
	return await _beat(1.2)

func _hand_lesson() -> bool:
	_clear_teach()
	var win := _window("The hand")
	var words := FelecoUiScript.label("Click a creature. The hand lifts your champion.", 18, FelecoUiScript.CREAM)
	words.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	win.add_child(words)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	win.add_child(row)
	var claim := _choice_button("Claim", true)
	var brand := _choice_button("Brand", false)
	var train := _choice_button("Train", false)
	var follow := _choice_button("Follow", false)
	for b: Button in [claim, brand, train, follow]:
		row.add_child(b)
	await _note("Claim makes them yours.")
	if not await _beat(1.6):
		return false
	if not await _press(claim):
		return false
	claim.text = "Claimed"
	claim.disabled = true
	if not await _beat(0.4):
		return false
	await _note("Brand changes the body. One look, every part.")
	if not await _aim(brand):
		return false
	await _note("Train is how they grow. Claim them first.")
	if not await _aim(train):
		return false
	await _note("Follow sets them down, and the camera stays with them.")
	if not await _aim(follow):
		return false
	return await _beat(0.6)

func _powers_lesson() -> bool:
	_clear_teach()
	var win := _window("Powers")
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	win.add_child(row)
	var call := _choice_button("Call Kin", true)
	var heal := _choice_button("Heal", false)
	var rain := _choice_button("Rain", false)
	var drought := _choice_button("Drought", false)
	for b: Button in [call, heal, rain, drought]:
		row.add_child(b)
	await _note("Call and Heal help only your champion.")
	if not await _beat(1.8):
		return false
	if not await _aim(call):
		return false
	if not await _aim(heal):
		return false
	await _note("Rain, drought, flood and the rest move through the whole food web. Some species thrive. Others do not.")
	if not await _beat(2.4):
		return false
	if not await _aim(rain):
		return false
	if not await _aim(drought):
		return false
	return await _beat(0.5)

func _window(title: String) -> VBoxContainer:
	_clear_teach()
	_teach_root = Control.new()
	_teach_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_teach_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_root.add_child(_teach_root)
	_root.move_child(_teach_root, _caption.get_index())
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_teach_root.add_child(dim)
	var frame := PanelContainer.new()
	frame.set_anchors_preset(Control.PRESET_FULL_RECT)
	frame.offset_left = 36.0
	frame.offset_top = 28.0
	frame.offset_right = -36.0
	frame.offset_bottom = -160.0
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.clip_contents = true
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.96)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(18)
	sb.set_content_margin_all(18)
	frame.add_theme_stylebox_override("panel", sb)
	_teach_root.add_child(frame)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(col)
	col.add_child(FelecoUiScript.heading(title, 28, FelecoUiScript.GOLD))
	return col

func _door(title: String, blurb: String) -> Button:
	var b := Button.new()
	b.text = "%s\n%s" % [title, blurb]
	b.custom_minimum_size = Vector2(340, 120)
	b.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	b.theme_type_variation = "GhostButton"
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b

func _choice_button(text: String, primary: bool) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(150, 52)
	b.theme_type_variation = "PrimaryButton" if primary else "GhostButton"
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b

func _paint_quest(b: Button) -> void:
	var q: Dictionary = b.get_meta("quest")
	var on: bool = bool(_taken.get(q["id"], false))
	b.theme_type_variation = "PrimaryButton" if on else "GhostButton"
	b.text = ("Chosen\n" if on else "") + "%s\n%s" % [q["title"], q["category"]]

func _toggle_quest(b: Button, status: Label) -> void:
	var q: Dictionary = b.get_meta("quest")
	var on: bool = not bool(_taken.get(q["id"], false))
	_taken[q["id"]] = on
	_paint_quest(b)
	if on:
		status.text = "%s  ·  Champion: %s  ·  Species: %s\nGoal: %s\nTime: %s  ·  Reward: %s" % [q["category"], q["champion"], q["species"], q["goal"], q["time"], q["reward"]]
	else:
		var n: int = 0
		for id: String in _taken.keys():
			if _taken[id]:
				n += 1
		status.text = "Quests taken: %d. Click any other, or the same one again." % n

func _press(target: Control) -> bool:
	if not await _aim(target):
		return false
	if target is Control:
		target.pivot_offset = target.size * 0.5
		var tw := create_tween()
		tw.tween_property(target, "scale", Vector2(0.96, 0.96), 0.07)
		tw.tween_property(target, "scale", Vector2.ONE, 0.12)
	return await _beat(0.28)

func _aim(target: Control) -> bool:
	if _done or not is_inside_tree() or target == null or not is_instance_valid(target):
		return false
	await get_tree().process_frame
	if _done or not is_inside_tree():
		return false
	var gp := target.get_global_rect()
	var origin := _root.get_global_rect().position
	var tip := gp.position - origin + Vector2(22.0, clampf(gp.size.y * 0.45, 12.0, 48.0))
	if _pointer == null or not is_instance_valid(_pointer):
		_pointer = Pointer.new()
		_pointer.z_index = 90
		_root.add_child(_pointer)
		_pointer.position = tip
	else:
		var tw := create_tween()
		tw.tween_property(_pointer, "position", tip, 0.42).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_halo(target)
	return await _beat(0.48)

func _halo(target: Control) -> void:
	var gp := target.get_global_rect()
	var origin := _root.get_global_rect().position
	if _ring == null or not is_instance_valid(_ring):
		_ring = Panel.new()
		_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_ring.z_index = 70
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.9, 0.77, 0.42, 0.14)
		sb.border_color = FelecoUiScript.GOLD
		sb.set_border_width_all(3)
		sb.set_corner_radius_all(12)
		_ring.add_theme_stylebox_override("panel", sb)
		_root.add_child(_ring)
	_ring.position = gp.position - origin - Vector2(6, 6)
	_ring.size = gp.size + Vector2(12, 12)
	_ring.pivot_offset = _ring.size * 0.5
	var tw := create_tween()
	_ring.scale = Vector2(1.06, 1.06)
	tw.tween_property(_ring, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_BACK)

func _clear_teach() -> void:
	if _ring != null and is_instance_valid(_ring):
		_ring.queue_free()
	_ring = null
	if _teach_root != null and is_instance_valid(_teach_root):
		_teach_root.queue_free()
	_teach_root = null

func _frames(n: int) -> bool:
	for _i: int in n:
		if _done or not is_inside_tree():
			return false
		await get_tree().process_frame
	return is_inside_tree() and not _done

func _note(text: String) -> bool:
	if not await _let_read():
		return false
	if _done or not is_inside_tree():
		return false
	_caption.text = text
	_caption.modulate.a = 1.0
	_line_left = _read_for(text)
	return true

func _beat(secs: float) -> bool:
	if _done or not is_inside_tree():
		return false
	await get_tree().create_timer(secs).timeout
	return is_inside_tree() and not _done

# The human Markov map: six real choices, and a token that walks them.
class HumanModel extends Control:
	const SPOTS: Dictionary = {
		"Flee": Vector2(0.16, 0.40),
		"Gather": Vector2(0.48, 0.40),
		"Cook": Vector2(0.80, 0.40),
		"Hunt": Vector2(0.16, 0.74),
		"Travel": Vector2(0.48, 0.74),
		"Sleep": Vector2(0.80, 0.74),
	}
	const LINKS: Array[Array] = [
		["Gather", "Cook"], ["Cook", "Sleep"], ["Gather", "Flee"],
		["Flee", "Hunt"], ["Gather", "Travel"],
	]
	var _boxes: Dictionary = {}
	var _token: Control
	var _hot: String = "Gather"

	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		set_anchors_preset(Control.PRESET_FULL_RECT)
		offset_left = 70.0
		offset_right = -70.0
		offset_top = 64.0
		offset_bottom = -168.0

	func _ready() -> void:
		var title := FelecoUi.heading("How a human decides", 32, FelecoUi.GOLD)
		title.position = Vector2(28, 16)
		title.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(title)
		var sub := FelecoUi.label("The valley weighs these arrows every moment, then picks one.", 18, FelecoUi.CREAM)
		sub.position = Vector2(28, 58)
		sub.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(sub)
		for id: String in SPOTS.keys():
			var box := PanelContainer.new()
			box.mouse_filter = Control.MOUSE_FILTER_IGNORE
			box.custom_minimum_size = Vector2(176, 62)
			var name := FelecoUi.heading(id, 26, FelecoUi.CREAM)
			name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			box.add_child(name)
			add_child(box)
			_boxes[id] = box
		_token = TextureRect.new()
		_token.texture = FelecoUi.species_texture("human")
		_token.custom_minimum_size = Vector2(52, 52)
		_token.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_token.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_token.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_token.z_index = 5
		add_child(_token)
		resized.connect(_layout)
		_layout()
		_paint()

	func _layout() -> void:
		if size.x < 40.0:
			return
		for id: String in _boxes.keys():
			var box: Control = _boxes[id]
			box.reset_size()
			var at: Vector2 = SPOTS[id] * size
			box.position = at - box.size * 0.5
		if _hot != "":
			_token.position = _token_pos(_hot)
		queue_redraw()

	func focus(id: String) -> void:
		if not _boxes.has(id):
			return
		_hot = id
		_paint()
		_layout()
		var tw := create_tween()
		tw.tween_property(_token, "position", _token_pos(id), 0.45).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		queue_redraw()

	func _center(id: String) -> Vector2:
		var box: Control = _boxes[id]
		return box.position + box.size * 0.5

	# Sits on the top-left corner of the box, so the state name stays readable.
	func _token_pos(id: String) -> Vector2:
		var box: Control = _boxes[id]
		return box.position + Vector2(-8.0, -28.0)

	func _paint() -> void:
		for id: String in _boxes.keys():
			var box: PanelContainer = _boxes[id]
			var sb := StyleBoxFlat.new()
			var on: bool = id == _hot
			sb.bg_color = Color(0.16, 0.22, 0.14, 1) if on else Color(0.09, 0.12, 0.1, 1)
			sb.border_color = FelecoUi.GOLD if on else FelecoUi.LINE
			sb.set_border_width_all(4 if on else 2)
			sb.set_corner_radius_all(14)
			sb.set_content_margin_all(8)
			box.add_theme_stylebox_override("panel", sb)

	func _draw() -> void:
		var r := Rect2(Vector2.ZERO, size)
		draw_rect(r, Color(0.05, 0.08, 0.06, 0.94))
		draw_rect(r, FelecoUi.GOLD, false, 2.0)
		for link: Array in LINKS:
			var a: String = link[0]
			var b: String = link[1]
			if not _boxes.has(a) or not _boxes.has(b):
				continue
			var from: Vector2 = _center(a)
			var to: Vector2 = _center(b)
			var hot: bool = a == _hot or b == _hot
			draw_line(from, to, FelecoUi.GOLD if hot else Color(0.55, 0.62, 0.5, 0.55), 5.0 if hot else 2.5, true)
			var dir: Vector2 = (to - from).normalized()
			var tip: Vector2 = to - dir * 46.0
			draw_colored_polygon(PackedVector2Array([
				tip + dir * 14.0,
				tip + Vector2(-dir.y, dir.x) * 8.0,
				tip + Vector2(dir.y, -dir.x) * 8.0,
			]), FelecoUi.GOLD if hot else Color(0.55, 0.62, 0.5, 0.7))

# A gold arrow. Its tip is the control's position.
class Pointer extends Control:
	func _init() -> void:
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size = Vector2(28, 34)
	func _draw() -> void:
		var pts := PackedVector2Array([
			Vector2(2, 2), Vector2(2, 28), Vector2(10, 20),
			Vector2(15, 32), Vector2(20, 29), Vector2(14, 18), Vector2(26, 16)])
		draw_colored_polygon(pts, Color(0.98, 0.91, 0.55))
		var outline := pts.duplicate()
		outline.append(pts[0])
		draw_polyline(outline, Color(0.22, 0.12, 0.02), 1.6, true)

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

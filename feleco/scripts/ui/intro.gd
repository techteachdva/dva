extends Node

# The opening film, played in the real valley. A narrator stumbles on golden
# grass and follows the gold from rabbit to mountain lion to wizard, finds
# some golden coins, bets on the wolves and sets the whole valley running:
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
	await _hold_say(wizard, "Now the wizard is golden. Curious...", 2.8, "Idle")
	if _done: return

	_view(wizard.global_position, 1.0, -0.6, 22.0)
	_dir.trigger_bloom()
	await _hold_say(wizard, "Well, this is fun just watching things, but can I use my powers to...", 3.4, "Channel")
	if _done: return

	await _coins()
	if _done: return
	await _bet_on_wolves()
	if _done: return

	_say("Now let's see what happens if I...", 2.4)
	await get_tree().create_timer(1.2 * READ_PACE).timeout
	_unleash()
	_view(Vector3(0, 0, 4), 0.6, -0.75, 62.0)
	# The whole valley at its own pace for a few seconds.
	await get_tree().create_timer(7.0).timeout
	await _say("Oh my stars! What is this game? Luck and ecology?", 3.4)
	if _done: return
	await _title_card()
	if _done: return
	await _say(SIGN_OFFS.pick_random(), 1.8)
	_finish()

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

# Golden coins tumble down and gather into a little pile.
func _coins() -> void:
	_say("Oh, what's this? Some golden coins? Well, I might as well play a game of chance...", 3.6)
	var vp: Vector2 = _root.get_viewport_rect().size
	for i: int in 18:
		var coin := Coin.new()
		coin.position = Vector2(randf_range(vp.x * 0.3, vp.x * 0.7), -40.0)
		_root.add_child(coin)
		var land := Vector2(vp.x * 0.5 + randf_range(-60, 60), vp.y * 0.55 + randf_range(-14, 14))
		var tw := create_tween()
		tw.tween_interval(i * 0.08)
		tw.tween_property(coin, "position", land, 0.7).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
		coin.set_meta("tw", tw)
	await get_tree().create_timer(3.4 * READ_PACE).timeout

# A card for the wolves; one coin hops from the pile onto it.
func _bet_on_wolves() -> void:
	var vp: Vector2 = _root.get_viewport_rect().size
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
	art.texture = FelecoUiScript.species_texture("wolf")
	art.custom_minimum_size = Vector2(150, 120)
	art.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	art.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	col.add_child(art)
	var name := FelecoUiScript.heading("Wolves", 24, FelecoUiScript.CREAM)
	name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(name)
	card.position = Vector2(vp.x * 0.68, vp.y * 0.22)
	card.modulate.a = 0.0
	_root.add_child(card)
	var tw := create_tween()
	tw.tween_property(card, "modulate:a", 1.0, 0.4)
	_say("Let's see, who do I want to win... Wolves. OK.", 3.2)
	await get_tree().create_timer(1.6 * READ_PACE).timeout
	var coin := Coin.new()
	coin.position = Vector2(vp.x * 0.5, vp.y * 0.55)
	_root.add_child(coin)
	var hop := create_tween()
	hop.tween_property(coin, "position", card.position + Vector2(70, 140), 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	await get_tree().create_timer(1.8 * READ_PACE).timeout
	# Clear the table: coins and card fade as the valley comes alive.
	var out := create_tween().set_parallel(true)
	for n in _root.get_children():
		if n is Coin or n == card:
			out.tween_property(n, "modulate:a", 0.0, 0.6)
	await out.finished

# The whole valley at once: every species, running on its own.
func _unleash() -> void:
	_dir.disabled_species.clear()
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

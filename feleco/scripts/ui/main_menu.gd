extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

@onready var _btn_campaign: Button = $CenterContainer/VBoxContainer/Campaign
@onready var _btn_challenge: Button = $CenterContainer/VBoxContainer/Challenge
@onready var _btn_sandbox: Button = $CenterContainer/VBoxContainer/Sandbox
@onready var _btn_shop: Button = $CenterContainer/VBoxContainer/Shop
@onready var _btn_rules: Button = $CenterContainer/VBoxContainer/Rules
@onready var _btn_quit: Button = $CenterContainer/VBoxContainer/Quit
@onready var _rules_popup: PopupPanel = $RulesPopup

var _rays: ColorRect
var _ray_target: Control = null
var _btn_about: Button
var _btn_intro: Button
var _btn_main: Button
var _next_hint: Label

# The menu is a game too: it opens one feature at a time as the player plays.
# [feature, button, label, how it unlocks]. Rules is always open.
const LADDER: Array = [
	["main", "MainGame", "Main Game", ""],
	["valley", "Sandbox", "Start Simulation", ""],
	["rules", "Rules", "Rules", ""],
	["greenhouse", "Shop", "Greenhouse", "Finish a year in the Valley Simulation to open the Greenhouse."],
	["challenge", "Challenge", "Challenge", "Visit the Greenhouse to open Challenge."],
	["minigames", "Campaign", "Mini Games", "Play a Challenge year (or three valley years) to open the Mini Games."],
	["opening", "Intro", "Watch The Opening Again", "Finish a year in the valley to rewatch the opening."],
	["lore", "Lore", "Watch the year's beginning", ""],
	["changelog", "About", "Changelog & Credits", "Read the Rules to open the Changelog & Credits."],
]

func _process(delta: float) -> void:
	if _rays == null:
		return
	var fallback: Control = _btn_sandbox if _btn_sandbox.visible else _btn_rules
	var target: Control = _ray_target if _ray_target != null and is_instance_valid(_ray_target) and _ray_target.is_visible_in_tree() else fallback
	var r: Rect2 = target.get_global_rect()
	var grow := Vector2(150.0, 70.0)
	var goal := Rect2(r.position - grow, r.size + grow * 2.0)
	var k: float = 1.0 - exp(-delta * 14.0)
	_rays.global_position = _rays.global_position.lerp(goal.position, k) if _rays.size.x > 1.0 else goal.position
	_rays.size = _rays.size.lerp(goal.size, k) if _rays.size.x > 1.0 else goal.size
	var mat := _rays.material as ShaderMaterial
	mat.set_shader_parameter("inner", (r.size * 0.5) / _rays.size)
	mat.set_shader_parameter("strength", 1.0 if target == fallback else 0.8)

func _hook_rays(node: Node) -> void:
	for child: Node in node.get_children():
		if child is Button:
			var b := child as Button
			b.mouse_entered.connect(func() -> void: _ray_target = b)
			b.focus_entered.connect(func() -> void: _ray_target = b)
			b.mouse_exited.connect(func() -> void:
				if _ray_target == b:
					_ray_target = null)
		_hook_rays(child)

# The "Felicitus Ecologia" -> FelEco opening plays once per session.
static var _title_seen: bool = false

func _play_title() -> void:
	var title: Label = $CenterContainer/VBoxContainer/Title
	var tagline: Label = $CenterContainer/VBoxContainer/Tagline
	var morph := TitleMorph.new()
	title.get_parent().add_child(morph)
	title.get_parent().move_child(morph, title.get_index())
	title.hide()
	if _title_seen:
		morph.finish()
		return
	_title_seen = true
	tagline.modulate.a = 0.0
	morph.finished.connect(func() -> void: create_tween().tween_property(tagline, "modulate:a", 1.0, 0.6))

func _ready() -> void:
	# First launch: the opening film plays before the menu.
	var cfg: Node = get_node_or_null("/root/GameConfig")
	if cfg != null:
		cfg.load_meta()
	if cfg != null and not cfg.intro_seen and DisplayServer.get_name() != "headless" and OS.get_cmdline_user_args().is_empty():
		get_tree().change_scene_to_file.call_deferred("res://scenes/ui/intro.tscn")
		return
	FelecoUiScript.dress_menu(self)
	# The seasons of the valley behind the menu, in place of the old diagram.
	$TitleGraphic.hide()
	var backdrop := MenuBackdrop.new()
	add_child(backdrop)
	move_child(backdrop, $BG.get_index() + 1)
	# Impact lines burst from behind the button under the pointer (or the
	# big "Enter the Valley" button when nothing is hovered).
	_rays = ColorRect.new()
	_rays.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var rays_mat := ShaderMaterial.new()
	rays_mat.shader = preload("res://scripts/ui/button_rays.gdshader")
	_rays.material = rays_mat
	add_child(_rays)
	move_child(_rays, backdrop.get_index() + 1)
	_play_title()
	for btn_name: String in ["Campaign", "Challenge", "Sandbox", "Shop", "Rules", "Quit"]:
		var btn: Button = $CenterContainer/VBoxContainer.get_node(btn_name)
		btn.custom_minimum_size = Vector2(340, 52)
	FelecoUiScript.mark($CenterContainer/VBoxContainer/Sandbox, "PrimaryButton")
	FelecoUiScript.mark($CenterContainer/VBoxContainer/Quit, "GhostButton")
	var btn_main := Button.new()
	_btn_main = btn_main
	btn_main.name = "MainGame"
	btn_main.text = "Main Game"
	btn_main.custom_minimum_size = Vector2(340, 52)
	btn_main.add_theme_font_size_override("font_size", 24)
	FelecoUiScript.mark(btn_main, "PrimaryButton")
	btn_main.pressed.connect(_on_main_game)
	$CenterContainer/VBoxContainer.add_child(btn_main)
	$CenterContainer/VBoxContainer.move_child(btn_main, _btn_sandbox.get_index())
	var gc: Node = get_node("/root/GameConfig")
	gc.load_meta()
	gc.reset_run_state()
	Cosmetics.apply_cursor(gc)

	_btn_campaign.pressed.connect(_on_campaign)
	_btn_challenge.pressed.connect(_on_challenge)
	_btn_sandbox.pressed.connect(_on_sandbox)
	_btn_shop.pressed.connect(_on_shop)
	_btn_rules.pressed.connect(_on_rules)
	_btn_quit.pressed.connect(_on_quit)
	$RulesPopup/MarginContainer/VBox/Close.pressed.connect(func() -> void: _rules_popup.hide())
	if OS.has_feature("web"):
		_btn_quit.hide()

	# Changelog & Credits, plus the version in the corner.
	var about := FelecoChangelog.build_popup(FelecoUiScript.theme())
	add_child(about)
	var btn_about := Button.new()
	_btn_about = btn_about
	btn_about.text = "Changelog & Credits"
	btn_about.custom_minimum_size = Vector2(340, 44)
	FelecoUiScript.mark(btn_about, "GhostButton")
	btn_about.pressed.connect(func() -> void: about.popup_centered())
	$CenterContainer/VBoxContainer.add_child(btn_about)
	$CenterContainer/VBoxContainer.move_child(btn_about, _btn_rules.get_index() + 1)
	var btn_intro := Button.new()
	_btn_intro = btn_intro
	btn_intro.text = "Watch the opening"
	btn_intro.custom_minimum_size = Vector2(340, 44)
	FelecoUiScript.mark(btn_intro, "GhostButton")
	btn_intro.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/intro.tscn"))
	$CenterContainer/VBoxContainer.add_child(btn_intro)
	$CenterContainer/VBoxContainer.move_child(btn_intro, btn_about.get_index() + 1)
	var btn_lore := Button.new()
	_btn_lore = btn_lore
	btn_lore.name = "Lore"
	btn_lore.text = "Watch the year's beginning"
	btn_lore.custom_minimum_size = Vector2(340, 44)
	FelecoUiScript.mark(btn_lore, "GhostButton")
	btn_lore.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/lore_film.tscn"))
	$CenterContainer/VBoxContainer.add_child(btn_lore)
	$CenterContainer/VBoxContainer.move_child(btn_lore, btn_intro.get_index() + 1)
	_hook_rays($CenterContainer)
	var version := Label.new()
	version.text = "v%s  ·  M mutes music  ·  F11 fullscreen" % FelecoChangelog.VERSION
	version.add_theme_font_size_override("font_size", 14)
	version.add_theme_color_override("font_color", FelecoUiScript.MIST)
	version.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	version.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	version.grow_vertical = Control.GROW_DIRECTION_BEGIN
	version.offset_right = -16
	version.offset_bottom = -8
	add_child(version)
	# The rotating tip sits right under the title and tagline. It hangs in a
	# slot in the menu column, wider than the column so the buttons keep their width.
	var slot := Control.new()
	slot.custom_minimum_size = Vector2(0, 36)
	slot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var column: VBoxContainer = $CenterContainer/VBoxContainer
	column.add_child(slot)
	column.move_child(slot, $CenterContainer/VBoxContainer/Tagline.get_index() + 1)
	var ticker := TipTicker.new()
	ticker.hold = 22.0
	ticker.start_delay = 9.0
	ticker.anchor_left = 0.5
	ticker.anchor_right = 0.5
	ticker.anchor_top = 0.0
	ticker.anchor_bottom = 1.0
	ticker.offset_left = -330
	ticker.offset_right = 330
	ticker.font_size = 13
	slot.add_child(ticker)
	version.offset_top = -34
	version.offset_bottom = -12
	version.offset_left = 16
	_btn_campaign.icon = load("res://assets/icons/campaign.svg")
	_btn_challenge.icon = load("res://assets/icons/challenge.svg")
	_btn_sandbox.icon = load("res://assets/icons/sandbox.svg")
	_btn_shop.icon = load("res://assets/icons/shop.svg")
	_btn_rules.icon = load("res://assets/icons/rules.svg")
	_btn_quit.icon = load("res://assets/icons/quit.svg")
	_build_ladder(gc)

func _ladder_button(key: String) -> Button:
	match key:
		"Intro": return _btn_intro
		"About": return _btn_about
		"MainGame": return _btn_main
		"Lore": return _btn_lore
	return $CenterContainer/VBoxContainer.get_node(key) as Button

var _btn_lore: Button

# Reorders and relabels the menu, shows only what's unlocked, and celebrates
# anything newly unlocked.
func _build_ladder(gc: Node) -> void:
	# Players from before the ladder keep everything they already had.
	if gc.record("unlock", "migrated") == null:
		var had: bool = int(gc.eco_points) > 0
		for k: String in ["golf", "race", "brawl", "dominion", "sweep", "saga", "goals", "progress"]:
			if gc.records.has(k):
				had = true
		gc.set_record("unlock", "migrated", true)
		if had:
			gc.set_record("unlock", "all", true)
	var column: VBoxContainer = $CenterContainer/VBoxContainer
	var first: int = _btn_rules.get_index()
	for c: Node in column.get_children():
		if c is Button and c != _btn_quit:
			first = mini(first, c.get_index())
	var at: int = first
	var hint: String = ""
	var grid := GridContainer.new()
	grid.name = "More"
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 6)
	for row: Array in LADDER:
		var b: Button = _ladder_button(row[1])
		b.text = row[2]
		var open: bool = row[0] in ["rules", "main", "valley", "lore"] or gc.unlocked(row[0])
		b.visible = open
		if not open and hint.is_empty():
			hint = row[3]
		var always: bool = row[0] in ["main", "valley", "lore", "rules"]
		if open and not always and gc.record("unlock_seen", row[0]) == null:
			gc.set_record("unlock_seen", row[0], true)
			_celebrate.call_deferred(b)
		if row[1] == "MainGame" or row[1] == "Sandbox":
			b.custom_minimum_size = Vector2(340, 52)
			b.add_theme_font_size_override("font_size", 24)
			column.move_child(b, at)
			at += 1
		else:
			b.custom_minimum_size = Vector2(220, 36)
			b.add_theme_font_size_override("font_size", 15)
			if b.get_parent() != null:
				b.get_parent().remove_child(b)
			grid.add_child(b)
	column.add_child(grid)
	column.move_child(grid, at)
	at += 1
	column.move_child(_btn_quit, at)
	_btn_quit.custom_minimum_size = Vector2(340, 40)
	at += 1
	# Rules is the big button until the valley opens.
	FelecoUiScript.mark(_btn_main, "PrimaryButton")
	FelecoUiScript.mark(_btn_sandbox, "PrimaryButton")
	FelecoUiScript.mark(_btn_rules, "GhostButton")
	_next_hint = FelecoUiScript.label(hint, 15, FelecoUiScript.GOLD)
	_next_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_next_hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_next_hint.custom_minimum_size = Vector2(340, 0)
	_next_hint.visible = not hint.is_empty()
	column.add_child(_next_hint)
	column.move_child(_next_hint, at)
	_add_settings(column)
	if not gc.all_unlocked() and not hint.is_empty():
		var skip := Button.new()
		skip.text = "Already know Feleco? Unlock everything"
		skip.theme_type_variation = "GhostButton"
		skip.add_theme_font_size_override("font_size", 13)
		skip.custom_minimum_size = Vector2(340, 34)
		skip.pressed.connect(func() -> void:
			gc.set_record("unlock", "all", true)
			get_tree().reload_current_scene())
		column.add_child(skip)

# A newly unlocked button: it pops in with a NEW tag and a chime.
func _celebrate(b: Button) -> void:
	var label: String = b.text
	b.text = "NEW!  " + label
	b.pivot_offset = b.size * 0.5
	b.scale = Vector2(0.6, 0.6)
	var tw := create_tween()
	tw.tween_interval(0.6)
	tw.tween_property(b, "scale", Vector2(1.12, 1.12), 0.25).set_trans(Tween.TRANS_BACK)
	tw.tween_property(b, "scale", Vector2.ONE, 0.2)
	tw.tween_callback(func() -> void: Juice.sfx(self, "fanfare", 1.0, -8.0))
	tw.tween_interval(3.0)
	tw.tween_callback(func() -> void: b.text = label)

func _on_campaign() -> void:
	if not _look_ready():
		return
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

func _on_challenge() -> void:
	if not _look_ready():
		return
	get_tree().change_scene_to_file("res://scenes/ui/challenge_setup.tscn")

func _on_main_game() -> void:
	if not _look_ready():
		return
	var gc: Node = get_node("/root/GameConfig")
	gc.current_mode = "main"
	gc.main_claim = gc.record("lesson", "champion") == null
	gc.board_mode = "full"
	if not gc.lore_seen:
		get_tree().change_scene_to_file("res://scenes/ui/lore_film.tscn")
	else:
		gc.bets.clear()
		get_tree().change_scene_to_file("res://scenes/world.tscn")

func _on_sandbox() -> void:
	_spirit_dialog()

func _spirit_dialog() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.72)
	shade.set_anchors_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_STOP
	shade.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(shade)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	shade.add_child(center)
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(560, 0)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.09, 0.07, 0.96)
	sb.border_color = FelecoUiScript.GOLD
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(22)
	card.add_theme_stylebox_override("panel", sb)
	center.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	card.add_child(col)
	var words := FelecoUiScript.label("You are Feleco, the spirit of this Valley. What do the Fates require of you? Time will tell. For now, you must choose your first Champion.", 20, FelecoUiScript.CREAM)
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	words.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	words.custom_minimum_size = Vector2(520, 0)
	col.add_child(words)
	var go := Button.new()
	go.text = "Continue"
	go.disabled = true
	go.theme_type_variation = "PrimaryButton"
	go.custom_minimum_size = Vector2(0, 52)
	col.add_child(go)
	var left: Array = [4]
	go.text = "Continue (4)"
	var tick := func() -> void:
		left[0] -= 1
		if left[0] <= 0:
			go.disabled = false
			go.text = "Continue"
		else:
			go.text = "Continue (%d)" % int(left[0])
	var timer := Timer.new()
	timer.wait_time = 1.0
	timer.timeout.connect(tick)
	shade.add_child(timer)
	timer.start()
	go.pressed.connect(func() -> void:
		if not _look_ready():
			return
		var gc: Node = get_node("/root/GameConfig")
		gc.current_mode = "sandbox"
		gc.main_claim = false
		gc.board_mode = "simple"
		gc.bets.clear()
		get_tree().change_scene_to_file("res://scenes/ui/quest_board.tscn"))

func _on_shop() -> void:
	if not _look_ready():
		return
	get_tree().change_scene_to_file("res://scenes/ui/greenhouse_shop.tscn")

# Rules opens the living Field Guide over the menu, with a Close button.
func _on_rules() -> void:
	var guide := FieldGuide.new()
	guide.name = "FieldGuide"
	add_child(guide)
	var close := Button.new()
	close.text = "Close"
	close.theme_type_variation = "PrimaryButton"
	close.custom_minimum_size = Vector2(150, 48)
	close.pressed.connect(guide.queue_free)
	# The Tuning Lab lives here, beside the rules it bends: hand-set birth,
	# ageing, hunger and more (within half and double) before a run.
	var lab := Button.new()
	lab.text = "Tuning Lab"
	lab.tooltip_text = "Lowkey, Mid, Mega or Giga for each species, stat by stat, then play."
	lab.theme_type_variation = "GhostButton"
	lab.custom_minimum_size = Vector2(170, 48)
	lab.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/tuning_lab.tscn"))
	# Both sit in the guide's footer, below the web, at the guide's scale.
	guide.add_footer(lab)
	guide.add_footer(close)
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and not gc.unlocked("valley"):
		lab.visible = false
		close.visible = false
		var tour := RulesTour.new()
		tour.guide = guide
		guide.add_child(tour)
		tour.finished.connect(func() -> void:
			gc.unlock("valley")
			gc.unlock("changelog")
			close.visible = true
			lab.visible = true
			guide.queue_free()
			get_tree().reload_current_scene())

const _SPRITE_PREVIEW: Array[String] = ["human", "lion", "deer", "falcon", "fish", "sheep"]

var _settings: PopupPanel
var _settings_button: Button
var _look_line: Label
var _era_buttons: Array[Button] = []
var _preview_icons: Array[TextureRect] = []
var _preview_names: Array[Label] = []

func _add_settings(column: VBoxContainer) -> void:
	var b := Button.new()
	b.name = "Settings"
	b.text = "Settings"
	b.custom_minimum_size = Vector2(340, 40)
	FelecoUiScript.mark(b, "GhostButton")
	_settings_button = b
	b.pressed.connect(_open_settings)
	b.mouse_entered.connect(func() -> void: _ray_target = b)
	b.focus_entered.connect(func() -> void: _ray_target = b)
	b.mouse_exited.connect(func() -> void:
		if _ray_target == b:
			_ray_target = null)
	column.add_child(b)
	column.move_child(b, _btn_quit.get_index())
	_settings = _build_settings_popup()
	add_child(_settings)
	var packs: Node = get_node("/root/EraPacks")
	packs.connect("look_changed", func(_era: String) -> void: _refresh_settings())
	packs.connect("look_status", _on_look_status)
	_on_look_status(str(packs.call("line")))

func _build_settings_popup() -> PopupPanel:
	var popup := PopupPanel.new()
	popup.theme = FelecoUiScript.theme()
	popup.size = Vector2i(760, 500)
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side: String in ["left", "right", "top", "bottom"]:
		margin.add_theme_constant_override("margin_" + side, 18)
	popup.add_child(margin)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	margin.add_child(col)
	col.add_child(FelecoUiScript.heading("Settings", 28, FelecoUiScript.GOLD))
	var hint := FelecoUiScript.label("Sprites. The valley wears this look, and Lost Valley renames every creature. Pixel and Lost Valley download the first time you choose them.", 16, FelecoUiScript.MIST)
	hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(hint)
	var labels: Array = []
	for era_id: String in EraBook.IDS:
		labels.append(EraBook.TITLES[era_id])
	_era_buttons = FelecoUiScript.choice_row(col, labels, [])
	for i: int in EraBook.IDS.size():
		_era_buttons[i].pressed.connect(_choose_era.bind(EraBook.IDS[i]))
	_look_line = FelecoUiScript.label("", 15, FelecoUiScript.GOLD)
	_look_line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_look_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(_look_line)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 12)
	col.add_child(row)
	for id: String in _SPRITE_PREVIEW:
		var cell := VBoxContainer.new()
		var icon := TextureRect.new()
		icon.custom_minimum_size = Vector2(96, 96)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		cell.add_child(icon)
		var name := FelecoUiScript.label(id, 14, FelecoUiScript.CREAM)
		name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cell.add_child(name)
		row.add_child(cell)
		_preview_icons.append(icon)
		_preview_names.append(name)
	var done := Button.new()
	done.text = "Done"
	done.theme_type_variation = "PrimaryButton"
	done.custom_minimum_size = Vector2(160, 48)
	done.pressed.connect(func() -> void: popup.hide())
	col.add_child(done)
	return popup

func _open_settings() -> void:
	_refresh_settings()
	_settings.popup_centered()

func _look_ready() -> bool:
	var packs: Node = get_node_or_null("/root/EraPacks")
	if packs == null or bool(packs.call("settled")):
		return true
	var text := str(packs.line())
	if text == "":
		text = "Fetching the look…"
	_on_look_status(text)
	return false

func _on_look_status(text: String) -> void:
	if _look_line != null:
		_look_line.text = text
	if _settings_button != null:
		_settings_button.text = text if text != "" else "Settings"

func _choose_era(era: String) -> void:
	get_node("/root/EraPacks").choose(era)
	_refresh_settings()

func _refresh_settings() -> void:
	var which: int = EraBook.IDS.find(str(get_node("/root/EraPacks").chosen()))
	if which < 0:
		which = 0
	FelecoUiScript.pick(_era_buttons, _era_buttons[which])
	var nearest: bool = EraBook.id() == "pixel"
	for i: int in _SPRITE_PREVIEW.size():
		var id: String = _SPRITE_PREVIEW[i]
		var icon := _preview_icons[i]
		icon.texture = FelecoUiScript.species_texture(id)
		icon.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST if nearest else CanvasItem.TEXTURE_FILTER_LINEAR
		_preview_names[i].text = SpeciesDB.label(id)

func _on_quit() -> void:
	get_tree().quit()

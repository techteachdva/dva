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

func _process(delta: float) -> void:
	if _rays == null:
		return
	var target: Control = _ray_target if _ray_target != null and is_instance_valid(_ray_target) and _ray_target.is_visible_in_tree() else _btn_sandbox
	var r: Rect2 = target.get_global_rect()
	var grow := Vector2(150.0, 70.0)
	var goal := Rect2(r.position - grow, r.size + grow * 2.0)
	var k: float = 1.0 - exp(-delta * 14.0)
	_rays.global_position = _rays.global_position.lerp(goal.position, k) if _rays.size.x > 1.0 else goal.position
	_rays.size = _rays.size.lerp(goal.size, k) if _rays.size.x > 1.0 else goal.size
	var mat := _rays.material as ShaderMaterial
	mat.set_shader_parameter("inner", (r.size * 0.5) / _rays.size)
	mat.set_shader_parameter("strength", 1.0 if target == _btn_sandbox else 0.8)

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
	var gc: Node = get_node("/root/GameConfig")
	gc.load_meta()
	gc.reset_run_state()

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
	btn_about.text = "Changelog & Credits"
	btn_about.custom_minimum_size = Vector2(340, 44)
	FelecoUiScript.mark(btn_about, "GhostButton")
	btn_about.pressed.connect(func() -> void: about.popup_centered())
	$CenterContainer/VBoxContainer.add_child(btn_about)
	$CenterContainer/VBoxContainer.move_child(btn_about, _btn_rules.get_index() + 1)
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

func _on_campaign() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/campaign_setup.tscn")

func _on_challenge() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/challenge_setup.tscn")

func _on_sandbox() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/setup_board.tscn")

func _on_shop() -> void:
	get_tree().change_scene_to_file("res://scenes/ui/greenhouse_shop.tscn")

# Rules opens the living Field Guide over the menu, with a Close button.
func _on_rules() -> void:
	var guide := FieldGuide.new()
	guide.name = "FieldGuide"
	add_child(guide)
	var close := Button.new()
	close.text = "Close"
	close.theme_type_variation = "PrimaryButton"
	close.custom_minimum_size = Vector2(150, 52)
	var vp: Vector2 = get_viewport_rect().size
	close.position = Vector2(vp.x - 182, vp.y - 66)
	close.pressed.connect(guide.queue_free)
	guide.add_child(close)
	# The Tuning Lab lives here, beside the rules it bends: hand-set birth,
	# ageing, hunger and more (within half and double) before a run.
	var lab := Button.new()
	lab.text = "Tuning Lab"
	lab.tooltip_text = "Adjust how each species lives (within half and double), then play."
	lab.theme_type_variation = "GhostButton"
	lab.custom_minimum_size = Vector2(170, 52)
	lab.position = Vector2(vp.x - 182 - 186, vp.y - 66)
	lab.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/tuning_lab.tscn"))
	guide.add_child(lab)

func _on_quit() -> void:
	get_tree().quit()

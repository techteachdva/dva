extends Control

const FelecoUiScript = preload("res://scripts/ui/feleco_ui.gd")

@onready var _btn_campaign: Button = $CenterContainer/VBoxContainer/Campaign
@onready var _btn_challenge: Button = $CenterContainer/VBoxContainer/Challenge
@onready var _btn_sandbox: Button = $CenterContainer/VBoxContainer/Sandbox
@onready var _btn_shop: Button = $CenterContainer/VBoxContainer/Shop
@onready var _btn_rules: Button = $CenterContainer/VBoxContainer/Rules
@onready var _btn_quit: Button = $CenterContainer/VBoxContainer/Quit
@onready var _rules_popup: PopupPanel = $RulesPopup

func _ready() -> void:
	FelecoUiScript.dress_menu(self)
	for btn_name: String in ["Campaign", "Challenge", "Sandbox", "Shop", "Rules", "Quit"]:
		var btn: Button = $CenterContainer/VBoxContainer.get_node(btn_name)
		btn.custom_minimum_size = Vector2(340, 58)
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
	btn_about.custom_minimum_size = Vector2(340, 48)
	FelecoUiScript.mark(btn_about, "GhostButton")
	btn_about.pressed.connect(func() -> void: about.popup_centered())
	$CenterContainer/VBoxContainer.add_child(btn_about)
	$CenterContainer/VBoxContainer.move_child(btn_about, _btn_rules.get_index() + 1)
	# Tuning Lab: hand-set birth, ageing, hunger and more before a run.
	var btn_lab := Button.new()
	btn_lab.text = "Tuning Lab"
	btn_lab.tooltip_text = "Adjust how each species lives (within half and double), then play."
	btn_lab.custom_minimum_size = Vector2(340, 48)
	FelecoUiScript.mark(btn_lab, "GhostButton")
	btn_lab.pressed.connect(func() -> void: get_tree().change_scene_to_file("res://scenes/ui/tuning_lab.tscn"))
	$CenterContainer/VBoxContainer.add_child(btn_lab)
	$CenterContainer/VBoxContainer.move_child(btn_lab, _btn_shop.get_index() + 1)
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
	var ticker := TipTicker.new()
	ticker.anchor_left = 0.5
	ticker.anchor_right = 0.5
	ticker.anchor_top = 1.0
	ticker.anchor_bottom = 1.0
	ticker.offset_left = -330
	ticker.offset_right = 330
	ticker.offset_top = -30
	ticker.offset_bottom = -4
	ticker.font_size = 13
	add_child(ticker)
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

func _on_quit() -> void:
	get_tree().quit()

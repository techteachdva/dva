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

func _on_rules() -> void:
	_rules_popup.show()

func _on_quit() -> void:
	get_tree().quit()

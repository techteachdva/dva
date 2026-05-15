extends Area3D

# Tutorial trigger that shows a contextual hint when the player enters.
# Place in level scenes ahead of new mechanics.

@export var hint_text: String = ""
@export var one_shot: bool = true
@export var dismiss_on_exit: bool = true
@export var show_duration: float = 0.0  # 0 = indefinite until exit/action

var _triggered: bool = false

signal hint_triggered(text: String, duration: float)
signal hint_dismissed()

func _ready() -> void:
	# Ensure we detect the player (kinematic/physics body)
	monitoring = true
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

func _on_body_entered(body: Node3D) -> void:
	if one_shot and _triggered:
		return
	if not body.is_in_group("player"):
		return
	_triggered = true
	hint_triggered.emit(hint_text, show_duration)

func _on_body_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if dismiss_on_exit and show_duration <= 0.0:
		hint_dismissed.emit()

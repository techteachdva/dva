extends Area3D
class_name ObstacleBase

@export var score_value:   int    = 25
@export var obstacle_name: String = "Obstacle"
@export var one_shot:      bool   = true

var cleared: bool = false

signal obstacle_cleared()

func _ready() -> void:
	add_to_group("obstacles")
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_on_player_enter(body)

func _on_body_exited(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	_on_player_exit(body)
	if one_shot and not cleared:
		cleared = true
		GameManager.obstacle_cleared()
		obstacle_cleared.emit()

func _on_player_enter(_player: Node3D) -> void:
	pass

func _on_player_exit(_player: Node3D) -> void:
	pass

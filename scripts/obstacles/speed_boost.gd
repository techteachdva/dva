extends ObstacleBase
class_name SpeedBoost

@export var boost_strength:  float   = 38.0
@export var boost_direction: Vector3 = Vector3(0.0, 0.35, -1.0)  # lift + forward
@export var is_brake_pad:    bool    = false

func _ready() -> void:
	super._ready()
	obstacle_name = "Brake Pad" if is_brake_pad else "Kinetic Pad"

func _on_player_enter(player: Node3D) -> void:
	if is_brake_pad:
		player.apply_central_impulse(-player.linear_velocity * 0.9)
	else:
		var impulse := boost_direction.normalized() * boost_strength
		player.hit_boost(impulse, 1.6, 1.2)
		GameManager.add_score(score_value)

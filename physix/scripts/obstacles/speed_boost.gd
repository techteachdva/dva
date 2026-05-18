extends ObstacleBase
class_name SpeedBoost

@export var boost_strength:  float   = 42.0
@export var boost_direction: Vector3 = Vector3(0.0, 0.28, -1.0)
@export var is_brake_pad:    bool    = false

func _ready() -> void:
	super._ready()
	obstacle_name = "Brake Pad" if is_brake_pad else "Kinetic Pad"

func _on_player_enter(player: Node3D) -> void:
	if is_brake_pad:
		player.apply_central_impulse(-player.linear_velocity * 0.65)
		return
	if player.has_method("apply_speed_burst"):
		player.apply_speed_burst(boost_strength, 1.9, 2.4, 0.26)
	elif player.has_method("hit_boost"):
		var impulse := boost_direction.normalized() * boost_strength
		player.hit_boost(impulse, 1.9, 2.4)
	GameManager.add_score(score_value)

extends ObstacleBase
class_name Bumper

@export var bump_force:    float = 28.0
@export var score_per_hit: int   = 100

func _ready() -> void:
	super._ready()
	obstacle_name = "Bumper"
	one_shot      = false  # Bumpers can be hit repeatedly

func _on_player_enter(player: Node3D) -> void:
	var dir := (player.global_position - global_position).normalized()
	# Keep most of the impulse horizontal so ball doesn't just fly upward
	dir.y = maxf(dir.y, 0.3)
	player.apply_central_impulse(dir.normalized() * bump_force)
	GameManager.add_score(score_per_hit)
	# Camera shake + hitstop on impact
	if get_node_or_null("/root/CameraShaker") != null:
		CameraShaker.shake(0.12, 0.22)
	if get_node_or_null("/root/HitStop") != null:
		HitStop.freeze(0.04, 0.12)
	# Quick scale pulse
	var tw := create_tween().set_trans(Tween.TRANS_BOUNCE)
	tw.tween_property(self, "scale", Vector3(0.75, 0.75, 0.75), 0.08)
	tw.tween_property(self, "scale", Vector3(1.0, 1.0, 1.0), 0.15)

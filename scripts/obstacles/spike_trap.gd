extends ObstacleBase
class_name SpikeTrap

@export var stun_duration: float = 0.35

func _ready() -> void:
	super._ready()
	obstacle_name = "Spike Trap"
	one_shot = false

func _on_player_enter(player: Node3D) -> void:
	if player.has_method("hit_spikes"):
		player.hit_spikes(stun_duration)

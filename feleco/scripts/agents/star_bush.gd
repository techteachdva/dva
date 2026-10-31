class_name StarBush
extends Node3D

# Rides a berry bush planted by a Flower Fairy and fruits Rainbow Starfruit.

const EVERY: float = Clock.BIO_PER_DAY * 1.5

var _wait: float = EVERY * 0.5

func _ready() -> void:
	add_to_group("star_bush")
	add_child(Starfruit.glow_quad(3.0, 0.45))

func _process(delta: float) -> void:
	_wait -= delta * Clock.LIFE_PACE
	if _wait > 0.0:
		return
	_wait = EVERY
	var fruit := Starfruit.new()
	var at: Vector3 = global_position
	fruit.launch(at + Vector3.UP, at + Vector3(randf_range(-2.0, 2.0), 0.0, randf_range(-2.0, 2.0)))
	get_parent().get_parent().add_child(fruit)

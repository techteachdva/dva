class_name MountainLion
extends CritterAgent

# Mountain lions: lone ambush hunters. Mice are the staple. Deer, goats,
# sheep and rabbits are the bigger meals, and a lone villager is dangerous.
func _configure() -> void:
	species = "lion"
	walk_speed = 2.6
	run_speed = 7.0
	metabolism_rate = 1.0
	repro_threshold = 65.0
	repro_cost = 32.0
	health = 85.0
	damage = 30.0
	energy = 65.0
	diet = ["corpse", "fish"]
	prey = ["mouse", "rabbit", "deer", "goat", "sheep", "robin"]
	threats = ["bear"]
	hunts_humans = true
	corpse_energy = 1.4
	hunt_below = 75.0
	death_color = Color(0.75, 0.55, 0.32)

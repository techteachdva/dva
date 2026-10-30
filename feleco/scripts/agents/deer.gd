class_name Deer
extends CritterAgent

# Deer: quick, wary browsers. Grass, moss off the tree trunks, and berries.
func _configure() -> void:
	species = "deer"
	walk_speed = 2.2
	run_speed = 6.5
	metabolism_rate = 1.1
	repro_threshold = 30.0
	repro_cost = 14.0
	health = 40.0
	damage = 4.0
	energy = 40.0
	diet = ["riverweed", "berry", "moss", "grass", "apple"]
	threats = ["lion", "wolf", "human", "bear"]
	grass_gain = 11.0
	corpse_energy = 1.1
	herds = true
	death_color = Color(0.68, 0.48, 0.3)

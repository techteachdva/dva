class_name Goat
extends CritterAgent

# Mountain goats: hardy climbers from the crags. They eat what the others
# leave: tough grass and moss.
func _configure() -> void:
	species = "goat"
	walk_speed = 2.0
	run_speed = 5.5
	metabolism_rate = 0.9
	repro_threshold = 26.0
	repro_cost = 12.0
	health = 45.0
	damage = 8.0
	energy = 40.0
	diet = ["moss", "grass", "berry"]
	threats = ["lion", "wolf"]
	grass_gain = 10.0
	corpse_energy = 0.9
	herds = true
	death_color = Color(0.85, 0.83, 0.78)

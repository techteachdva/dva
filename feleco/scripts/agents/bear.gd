class_name Bear
extends CritterAgent

# Bears: big omnivores. They fish the river, dig out rabbits, raid apple
# trees and berry bushes, eat mushrooms, and sleep through the winter.
func _configure() -> void:
	species = "bear"
	walk_speed = 2.2
	run_speed = 5.0
	metabolism_rate = 1.1
	repro_threshold = 70.0
	repro_cost = 35.0
	health = 120.0
	damage = 35.0
	energy = 75.0
	diet = ["fish", "berry", "apple", "pinecone", "riverweed", "mushroom", "corpse", "grass"]
	prey = ["rabbit", "mouse"]
	threats = []
	hunts_humans = true
	grass_gain = 4.0
	corpse_energy = 2.0
	winter_sleep = true
	hunt_below = 60.0
	death_color = Color(0.4, 0.27, 0.17)

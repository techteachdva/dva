class_name Mouse
extends CritterAgent

# Mice: everywhere, all year, by the hundred. They hunt beetles and worms
# and nibble fallen apples, berries and pinecones, and nearly every hunter
# in the valley eats them: lions, bears, falcons and wolves.
func _configure() -> void:
	species = "mouse"
	walk_speed = 1.6
	run_speed = 5.0
	metabolism_rate = 0.8
	repro_threshold = 16.0
	repro_cost = 6.0
	health = 10.0
	damage = 1.5
	energy = 24.0
	diet = ["berry", "apple", "pinecone"]
	prey = ["beetle", "worm"]
	threats = ["lion", "bear", "falcon", "wolf"]
	corpse_energy = 0.25
	hunt_below = 80.0
	death_color = Color(0.55, 0.5, 0.45)

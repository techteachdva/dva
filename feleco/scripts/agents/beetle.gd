class_name Beetle
extends CritterAgent

# Beetles: carrion and dung beetles. They strip the last scraps from a
# carcass and work the rot back into the soil. Fish and robins eat them.
func _configure() -> void:
	species = "beetle"
	walk_speed = 0.8
	run_speed = 1.6
	metabolism_rate = 0.7
	repro_threshold = 12.0
	repro_cost = 5.0
	health = 8.0
	damage = 1.0
	energy = 20.0
	diet = ["corpse", "rot"]
	threats = ["robin"]
	corpse_energy = 0.15
	death_color = Color(0.25, 0.35, 0.28)

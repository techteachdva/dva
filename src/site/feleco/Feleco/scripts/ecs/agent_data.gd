class_name AgentData

var species: String = ""
var variant: String = ""
var health: float = 0.0
var energy: float = 0.0
var pos: Vector3 = Vector3.ZERO
var vel: Vector3 = Vector3.ZERO
# When pos/vel were last written, so visuals can glide between staggered ticks.
var sync_msec: int = 0
var state: String = ""
var age: float = 0.0
var lifespan: float = 0.0
var timers: Dictionary = {}
var node: Node3D = null

func _init(p_species: String, p_health: float, p_energy: float, p_pos: Vector3, p_lifespan: float, p_node: Node3D = null):
	species = p_species
	health = p_health
	energy = p_energy
	pos = p_pos
	lifespan = p_lifespan
	node = p_node

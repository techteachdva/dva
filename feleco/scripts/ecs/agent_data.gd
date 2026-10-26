class_name AgentData

# Visual clock (game seconds) advanced by VisualProxyManager every frame.
static var clock: float = 0.0

var species: String = ""
var variant: String = ""
var health: float = 0.0
var energy: float = 0.0
var pos: Vector3 = Vector3.ZERO
var vel: Vector3 = Vector3.ZERO
# When pos/vel were last written, so visuals can glide between staggered ticks.
var sync_msec: int = 0
var sync_time: float = 0.0
# Smooth drawing between staggered thinks: the sprite glides from where it
# was last drawn (shown) to the new true position over one think interval.
var prev_pos: Vector3 = Vector3.ZERO
var shown: Vector3 = Vector3.ZERO
var has_shown: bool = false
var interval: float = 0.1
var state: String = ""
var age: float = 0.0
var lifespan: float = 0.0
var timers: Dictionary = {}
var node: Node3D = null
var role: String = ""
var female: bool = false
var golden: float = 0.0
# Sprite facing relative to the camera (+1 right, -1 left) and gait offset.
var face: float = 1.0
var gait_seed: float = 0.0

func _init(p_species: String, p_health: float, p_energy: float, p_pos: Vector3, p_lifespan: float, p_node: Node3D = null):
	species = p_species
	health = p_health
	energy = p_energy
	pos = p_pos
	lifespan = p_lifespan
	node = p_node
	gait_seed = randf() * TAU
	face = 1.0 if randf() > 0.5 else -1.0
	sync_time = clock

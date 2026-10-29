class_name Corpse
extends Node3D

@export var corpse_energy: float = 1.0
@export var decay_timer: float = 8.0

var _initial_scale: Vector3 = Vector3.ONE
var _energy_remaining: float = 0.0

static var _shared_mesh: BoxMesh
static var _shared_mat: StandardMaterial3D

func _ready() -> void:
	add_to_group("corpse")
	if _shared_mesh == null:
		_shared_mesh = BoxMesh.new()
		_shared_mesh.size = Vector3(1.5, 0.3, 2.0)
	if _shared_mat == null:
		_shared_mat = StandardMaterial3D.new()
		_shared_mat.albedo_color = Color(0.15, 0.08, 0.05)
	var mi := MeshInstance3D.new()
	mi.mesh = _shared_mesh
	mi.material_override = _shared_mat
	add_child(mi)
	_initial_scale = scale
	_energy_remaining = corpse_energy

func _process(delta: float) -> void:
	decay_timer -= delta
	var t := clampf(decay_timer / 8.0, 0.0, 1.0)
	scale = _initial_scale * maxf(t, 0.3)
	if decay_timer <= 0.0:
		decompose()
		queue_free()

func absorb_energy(amount: float) -> float:
	var taken := minf(_energy_remaining, amount)
	_energy_remaining -= taken
	corpse_energy = _energy_remaining
	if _energy_remaining <= 0.0:
		queue_free()
	return taken

func get_remaining_energy() -> float:
	return _energy_remaining

func decompose() -> void:
	var node := get_parent()
	var director: SimulationDirector = null
	while node != null:
		if node is SimulationDirector:
			director = node as SimulationDirector
			break
		node = node.get_parent()
	if director == null:
		return
	# Deposit rot as base nutrient
	director.rot.add_density_at_world(global_position, corpse_energy)
	# Chance to spawn mushroom from decay
	if randf() <= 0.25:
		director.spawn_mushroom_spore(self, global_position + Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0))
	# Chance to fertilize grass
	if randf() <= 0.6 and director.grass != null:
		var g := director.grass.world_to_grid(global_position)
		var idx := g.y * director.grass.grid_width + g.x
		if idx >= 0 and idx < director.grass._grid.size():
			director.grass._grid[idx] = clampf(director.grass._grid[idx] + 0.25, 0.0, director.grass.max_density)
			director.grass._nutrients[idx] = clampf(director.grass._nutrients[idx] + 0.15, 0.0, 1.0)
			director.grass._cell_age[idx] = 0.0
			director.grass._cell_stage[idx] = 1.0
			director.grass._mark_dirty(idx)
	# Chance to seed a tree from a buried carcass
	if randf() <= 0.08:
		director.try_plant_tree_seed(global_position, "corpse")

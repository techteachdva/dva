class_name Fish
extends MarkovAgent

@export var swim_speed: float = 2.4
@export var metabolism_rate: float = 0.35
@export var repro_threshold: float = 22.0
@export var repro_cost: float = 8.0

var health: float = 18.0
var energy: float = 30.0
var _repro_cooldown: float = 0.0
var _lateral: float = 0.0

func _ready() -> void:
	add_to_group("fish")
	_aquatic = true
	_lifespan = 40.0
	_lateral = randf_range(-0.6, 0.6)
	_register_states()
	super._ready()
	set_state("Swim")

func _register_states() -> void:
	_register_state("Swim", _on_enter_swim, _on_tick_swim, _on_exit_swim)
	_current_state = "Swim"

func _on_enter_swim() -> void:
	pass

func _on_tick_swim(delta: float) -> void:
	_eat_river_worm()
	if randf() < delta * 0.15:
		_lateral = randf_range(-0.8, 0.8)

func _on_exit_swim() -> void:
	pass

func _physics_process(delta: float) -> void:
	super._physics_process(delta)
	if health <= 0.0:
		die()

func _swim_tick(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.valley == null or sim.valley.river == null:
		return
	var river: River = sim.valley.river
	var here: Dictionary = river.sample(global_position.x, global_position.z)
	var closest: Vector3 = here.closest
	var tangent: Vector3 = here.tangent
	if randf() < 0.004:
		tangent = -tangent
	var side := Vector3(-tangent.z, 0.0, tangent.x) * _lateral * river.half_width()
	var goal: Vector3 = closest + tangent * swim_speed * 0.35 + side
	global_position = global_position.lerp(goal, clampf(delta * 2.2, 0.0, 1.0))
	var settled: Dictionary = river.sample(global_position.x, global_position.z)
	var bank: Vector3 = settled.closest
	if not settled.in_water:
		global_position = global_position.lerp(bank, clampf(delta * 3.0, 0.0, 1.0))
		health -= 6.0 * delta
	global_position.y = bank.y + 0.05
	velocity = tangent * swim_speed

func _eat_river_worm() -> void:
	var sim: SimulationDirector = director
	if sim == null or sim.valley == null or sim.valley.river == null:
		return
	var worm := sim.find_nearest_worm(global_position, 2.6)
	if worm == null:
		return
	if not sim.valley.river.covers_world(worm.global_position.x, worm.global_position.z):
		return
	if worm.has_method("die"):
		worm.die()
	energy += 16.0
	energy = clampf(energy, 0.0, 100.0)
	health += 4.0
	health = clampf(health, 0.0, 40.0)

func _metabolise(delta: float) -> void:
	var sim: SimulationDirector = director
	var wet := false
	if sim != null and sim.valley != null and sim.valley.river != null:
		wet = sim.valley.river.covers_world(global_position.x, global_position.z)
	if wet:
		energy += 1.4 * delta
	energy -= metabolism_rate * delta
	energy = clampf(energy, 0.0, 100.0)
	if energy <= 0.0:
		health -= 2.0 * delta

func _try_reproduce(delta: float) -> void:
	_repro_cooldown -= delta
	if _repro_cooldown > 0.0 or energy < repro_threshold:
		return
	var sim: SimulationDirector = director
	if sim == null:
		return
	var mate := sim.find_nearest_fish(global_position, 5.0)
	if mate == null or mate == self:
		return
	energy -= repro_cost
	_repro_cooldown = 7.0
	sim.spawn_fish_offspring(self, global_position)

func die() -> void:
	var sim: SimulationDirector = director
	if sim != null:
		sim.spawn_corpse(global_position, 0.4)
		sim.agent_died.emit("fish", global_position)
	FXManager.spawn_death_particles(global_position, Color(0.3, 0.65, 0.85))
	queue_free()

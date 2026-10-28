class_name Corpse
extends Node3D

# A carcass is a 3D skeleton of the creature's own kind (CorpseModels) under
# a heap of offal, on a dark stain. Scavengers strip the offal down; the
# decomposers finish it; the bones grey and sink into the grass as it rots.

@export var corpse_energy: float = 1.0
@export var decay_timer: float = 8.0
var species: String = ""
# Gold the creature carried when it died; whoever eats here takes some.
var golden: float = 0.0

const DECAY_TIME: float = 8.0
const BONES_AT: float = 0.4
# Share of a carcass scavengers may eat; the rest is reserved for decomposers.
const SCAVENGE_SHARE: float = 0.7
const BODY_TINT := Color(0.78, 0.74, 0.7)
# How far the smell of a carcass carries to a decomposer's keen nose, from
# a picked-clean scrap up to a fresh, whole body.
const STINK_RANGE_MIN: float = 10.0
const STINK_RANGE_MAX: float = 40.0

var _energy_remaining: float = 0.0
var _initial_energy: float = 0.0
var _stain: MeshInstance3D
var _body_size: float = 1.6

static var _stain_mesh: PlaneMesh
static var _stain_mat: StandardMaterial3D

func _ready() -> void:
	add_to_group("corpse")
	if _stain_mesh == null:
		_stain_mesh = PlaneMesh.new()
		_stain_mesh.size = Vector2(1.0, 1.0)
		_stain_mat = StandardMaterial3D.new()
		_stain_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_stain_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_stain_mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		_stain_mat.albedo_color = Color(0.22, 0.1, 0.07, 0.75)
		_stain_mat.albedo_texture = SpriteGenerator.texture_for_shadow()
		_stain_mat.render_priority = -1
	if VisualProxyManager.SPECIES_CONFIG.has(species):
		_body_size = (VisualProxyManager.SPECIES_CONFIG[species]["size"] as Vector2).x
	# Failsafe: a carcass is never drawn at size zero (see VisualProxyManager).
	_body_size = clampf(_body_size, 0.3, 4.0) if is_finite(_body_size) else 1.0
	_stain = MeshInstance3D.new()
	_stain.mesh = _stain_mesh
	_stain.material_override = _stain_mat
	_stain.position.y = 0.04
	_stain.scale = Vector3(_body_size * 0.8, 1.0, _body_size * 0.45)
	add_child(_stain)
	_build_model()
	_energy_remaining = corpse_energy
	_initial_energy = corpse_energy
	_build_stink()

# Faint green wisps rising off the body: the stink the decomposers follow.
var _wisps: CPUParticles3D

func _build_stink() -> void:
	_wisps = CPUParticles3D.new()
	_wisps.amount = 6
	_wisps.lifetime = 2.4
	var q := QuadMesh.new()
	q.size = Vector2(0.35, 0.35)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	# Particle billboards, never plain ones: a particle not yet emitted has a
	# zero-size transform, and a plain billboard turns that into a sheet of
	# yellow-green across the whole screen (seen at the start of a new run,
	# when the first carcasses appear).
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_color = Color(0.62, 0.75, 0.3, 0.35)
	m.albedo_texture = SpriteGenerator.texture_for_shadow()
	q.material = m
	_wisps.mesh = q
	_wisps.direction = Vector3.UP
	_wisps.spread = 25.0
	_wisps.gravity = Vector3(0, 0.4, 0)
	_wisps.initial_velocity_min = 0.3
	_wisps.initial_velocity_max = 0.7
	_wisps.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	_wisps.emission_sphere_radius = _body_size * 0.3
	_wisps.position.y = 0.3
	add_child(_wisps)

var _skel: MeshInstance3D
var _guts: MeshInstance3D

func _build_model() -> void:
	var holder := Node3D.new()
	holder.rotation.y = randf() * TAU
	holder.scale = Vector3.ONE * _body_size * 0.6
	add_child(holder)
	if CorpseModels.has_skeleton(species):
		_skel = MeshInstance3D.new()
		_skel.mesh = CorpseModels.skeleton(species)
		_skel.material_override = CorpseModels.shell_material() if CorpseModels.is_shell(species) else CorpseModels.bone_material(golden > 0.05)
		_skel.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		holder.add_child(_skel)
	_guts = MeshInstance3D.new()
	_guts.mesh = CorpseModels.offal()
	_guts.material_override = CorpseModels.offal_material()
	_guts.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# The heap sits over the belly, a little behind the ribs.
	_guts.position = Vector3(-0.05, 0.0, 0.0)
	holder.add_child(_guts)

func _process(real_delta: float) -> void:
	# Rots on life time, like everything else alive or once alive.
	var delta: float = real_delta * Clock.LIFE_PACE
	decay_timer -= delta
	var left: float = clampf(decay_timer / DECAY_TIME, 0.0, 1.0)
	# The offal shrinks as it is eaten and as it rots; the bones stay and
	# sink into the grass at the very end.
	var meat: float = clampf(_energy_remaining / maxf(_initial_energy, 0.001), 0.0, 1.0)
	if _guts != null:
		var g: float = maxf((0.25 + 0.75 * meat) * lerpf(0.5, 1.0, left), 0.1)
		_guts.scale = Vector3(g, g, g)
		_guts.visible = meat > 0.04 and left > BONES_AT * 0.25
	if _skel != null:
		_skel.position.y = -lerpf(0.0, 0.08, clampf((BONES_AT - left) / BONES_AT, 0.0, 1.0))
	_stain.scale = Vector3(_body_size * 0.8, 1.0, _body_size * 0.45) * maxf(lerpf(0.6, 1.0, left), 0.6)
	if _wisps != null:
		_wisps.emitting = stink() > 0.25
	if decay_timer <= 0.0:
		finish()

func _pass_gold(eater: Node) -> void:
	if golden > 0.0 and eater != null and eater.has_method("make_golden"):
		eater.make_golden(golden * 0.8, species)

# 0..1: how hard this carcass reeks. A fresh body stinks most and the
# smell fades as it is eaten and as it rots down.
func stink() -> float:
	if _initial_energy <= 0.0:
		return 0.0
	var left: float = clampf(_energy_remaining / maxf(_initial_energy, 0.001), 0.0, 1.0)
	var fresh: float = clampf(decay_timer / DECAY_TIME, 0.0, 1.0)
	return clampf(0.3 + 0.7 * left, 0.0, 1.0) * lerpf(0.4, 1.0, fresh)

func stink_range() -> float:
	return lerpf(STINK_RANGE_MIN, STINK_RANGE_MAX, stink())

# Decomposers: they take what the scavengers left and turn it back into
# the soil as they go, so the energy flows on into the grass.
func absorb_energy(amount: float, eater: Node = null) -> float:
	_pass_gold(eater)
	var taken := minf(_energy_remaining, amount)
	_energy_remaining -= taken
	corpse_energy = _energy_remaining
	var sim := _director()
	if sim != null and sim.rot != null and taken > 0.0:
		sim.rot.add_density_at_world(global_position, taken * 0.5)
	if _energy_remaining <= 0.0:
		finish()
	return taken

# Scavengers tear off meat but always leave the scraps and bones for the
# worms, fungi and grass.
func scavenge(amount: float, eater: Node = null) -> float:
	_pass_gold(eater)
	var floor_left: float = _initial_energy * (1.0 - SCAVENGE_SHARE)
	var taken := clampf(minf(amount, _energy_remaining - floor_left), 0.0, amount)
	_energy_remaining -= taken
	corpse_energy = _energy_remaining
	return taken

func can_scavenge() -> bool:
	return _energy_remaining > _initial_energy * (1.0 - SCAVENGE_SHARE) + 0.01

# Every way a carcass leaves the world returns it to the soil.
func finish() -> void:
	if is_queued_for_deletion():
		return
	decompose()
	queue_free()

func get_remaining_energy() -> float:
	return _energy_remaining

func _director() -> SimulationDirector:
	var node := get_parent()
	while node != null:
		if node is SimulationDirector:
			return node as SimulationDirector
		node = node.get_parent()
	return null

func decompose() -> void:
	var director := _director()
	if director == null:
		return
	# Deposit rot as base nutrient
	director.rot.add_density_at_world(global_position, corpse_energy)
	# A golden carcass leaves gold in the soil: golden grass may come up here.
	if golden > 0.1 and director.grass != null:
		director.grass.seed_golden(global_position, golden)
	# Chance to spawn mushroom from decay
	if randf() <= 0.12 * director.fungal_factor():
		director.spawn_mushroom_spore(self, global_position + Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0))
	# A carcass always feeds the meadow and the fungal mat beneath it.
	if director.mycelium != null:
		director.mycelium.add_density_at_world(global_position, 0.25 + corpse_energy * 0.15)
	if director.grass != null:
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

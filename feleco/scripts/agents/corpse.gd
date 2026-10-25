class_name Corpse
extends Node3D

# A carcass is the creature's own sprite, flipped onto its back with its
# legs in the air, lying on a dark stain. It greys and sinks as it rots;
# near the end only a few bones are left.

@export var corpse_energy: float = 1.0
@export var decay_timer: float = 8.0
var species: String = ""

const DECAY_TIME: float = 8.0
const BONES_AT: float = 0.4
const BODY_TINT := Color(0.78, 0.74, 0.7)

var _energy_remaining: float = 0.0
var _body: Sprite3D
var _stain: MeshInstance3D
var _bones: Array[MeshInstance3D] = []
var _body_size: float = 1.6

static var _stain_mesh: PlaneMesh
static var _stain_mat: StandardMaterial3D
static var _bone_mesh: CapsuleMesh
static var _bone_mat: StandardMaterial3D
static var _textures: Dictionary = {}

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
		_bone_mesh = CapsuleMesh.new()
		_bone_mesh.radius = 0.06
		_bone_mesh.height = 0.8
		_bone_mesh.radial_segments = 6
		_bone_mesh.rings = 1
		_bone_mat = StandardMaterial3D.new()
		_bone_mat.albedo_color = Color(0.93, 0.9, 0.82)
		_bone_mat.roughness = 0.9
	if VisualProxyManager.SPECIES_CONFIG.has(species):
		_body_size = (VisualProxyManager.SPECIES_CONFIG[species]["size"] as Vector2).x
	_stain = MeshInstance3D.new()
	_stain.mesh = _stain_mesh
	_stain.material_override = _stain_mat
	_stain.position.y = 0.04
	_stain.scale = Vector3(_body_size * 0.8, 1.0, _body_size * 0.45)
	add_child(_stain)
	_build_body()
	for k: int in 3:
		var bone := MeshInstance3D.new()
		bone.mesh = _bone_mesh
		bone.material_override = _bone_mat
		bone.position = Vector3(randf_range(-0.3, 0.3), 0.08, randf_range(-0.25, 0.25)) * _body_size
		bone.rotation = Vector3(PI * 0.5, randf() * TAU, 0.0)
		bone.scale = Vector3.ONE * clampf(_body_size * 0.5, 0.5, 1.3)
		bone.visible = false
		add_child(bone)
		_bones.append(bone)
	_energy_remaining = corpse_energy

func _build_body() -> void:
	var tex: Texture2D = _texture(species)
	if tex == null:
		return
	_body = Sprite3D.new()
	_body.texture = tex
	_body.region_enabled = true
	var cell: Vector2i = SpriteGenerator.cell_size(species)
	_body.region_rect = Rect2(0, 0, cell.x, cell.y)
	# Legs in the air.
	_body.flip_v = true
	_body.flip_h = randf() < 0.5
	_body.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
	_body.shaded = false
	_body.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	_body.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_body.pixel_size = _body_size / float(cell.x)
	_body.modulate = BODY_TINT
	# The back (about a third of the way up the drawing) rests on the grass.
	_body.position.y = _body_size * float(cell.y) / float(cell.x) * 0.16
	add_child(_body)

static func _texture(sp: String) -> Texture2D:
	if sp.is_empty() or not SpriteGenerator.SPECIES.has(sp):
		return null
	if not _textures.has(sp):
		_textures[sp] = SpriteGenerator.texture_for(sp)
	return _textures[sp]

func _process(real_delta: float) -> void:
	# Rots on life time, like everything else alive or once alive.
	var delta: float = real_delta * Clock.LIFE_PACE
	decay_timer -= delta
	var left: float = clampf(decay_timer / DECAY_TIME, 0.0, 1.0)
	if _body != null:
		# Fresh, then grey and sunken, then gone to bones.
		var rot: float = 1.0 - left
		_body.modulate = BODY_TINT.lerp(Color(0.42, 0.38, 0.34), rot)
		_body.visible = left > BONES_AT * 0.5
		_body.scale = Vector3.ONE * lerpf(1.0, 0.8, rot)
		_body.position.y = _body_size * 0.16 * lerpf(1.0, 0.3, rot)
	for bone in _bones:
		bone.visible = left < BONES_AT or _body == null
	_stain.scale = Vector3(_body_size * 0.8, 1.0, _body_size * 0.45) * lerpf(0.6, 1.0, left)
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
	if randf() <= 0.35 * director.fungal_factor():
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

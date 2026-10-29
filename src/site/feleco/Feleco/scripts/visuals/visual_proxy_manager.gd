class_name VisualProxyManager
extends Node3D

# Species-scoped MultiMesh billboard sprite renderer.
# Replaces primitive 3D meshes with procedural 2D sprite textures on QuadMesh.
# Uses BILLBOARD_ENABLED so sprites always face the camera.
# Still one draw call per species via MultiMesh.

const SPECIES_CONFIG: Dictionary = {
	"sheep": {
		"sprite_size": Vector2(1.8, 1.8),
		"color": Color(0.95, 0.95, 0.9),
	},
	"wolf": {
		"sprite_size": Vector2(2.0, 2.0),
		"color": Color(0.25, 0.25, 0.4),
	},
	"boar": {
		"sprite_size": Vector2(2.2, 2.2),
		"color": Color(0.55, 0.35, 0.2),
	},
	"falcon": {
		"sprite_size": Vector2(2.5, 2.5),
		"color": Color(0.95, 0.95, 0.95),
	},
	"robin": {
		"sprite_size": Vector2(1.2, 1.2),
		"color": Color(0.9, 0.2, 0.2),
	},
	"worm": {
		"sprite_size": Vector2(1.0, 1.0),
		"color": Color(0.2, 0.8, 0.3),
	},
	"human": {
		"sprite_size": Vector2(1.8, 1.8),
		"color": Color(0.65, 0.55, 0.45),
	},
	"rabbit": {
		"sprite_size": Vector2(1.4, 1.4),
		"color": Color(0.78, 0.6, 0.42),
	},
	"wizard": {
		"sprite_size": Vector2(1.8, 1.8),
		"color": Color(0.7, 0.3, 0.9),
	},
	"builder": {
		"sprite_size": Vector2(1.8, 1.8),
		"color": Color(0.6, 0.45, 0.25),
	},
	"fish": {
		"sprite_size": Vector2(1.5, 0.7),
		"color": Color(0.25, 0.62, 0.78),
	},
}

var _proxies: Dictionary = {}
var _species_buffer: Dictionary = {}

func _ready() -> void:
	name = "VisualProxyManager"
	for species: String in SPECIES_CONFIG.keys():
		_setup_proxy(species)

func _setup_proxy(species: String) -> void:
	var cfg: Dictionary = SPECIES_CONFIG[species]
	var proxy := MultiMeshInstance3D.new()
	proxy.name = species.capitalize() + "Visuals"
	proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true

	var quad := QuadMesh.new()
	quad.size = cfg["sprite_size"]
	mm.mesh = quad
	mm.instance_count = 0
	proxy.multimesh = mm

	var tex: ImageTexture = SpriteGenerator.generate_for_species(species)
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = tex
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = StandardMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = StandardMaterial3D.BILLBOARD_ENABLED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	mat.alpha_scissor_threshold = 0.5
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_NEAREST
	proxy.material_override = mat

	add_child(proxy)
	_proxies[species] = proxy
	_species_buffer[species] = []

const MAX_GLIDE: float = 0.45

func sync(registry: Array[AgentData]) -> void:
	var now_msec := Time.get_ticks_msec()
	# Group active agents by species
	for species: String in _species_buffer.keys():
		_species_buffer[species].clear()

	for data: AgentData in registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		if not data.node.is_inside_tree():
			continue
		var species: String = data.species
		var visual_key: String = data.variant if not data.variant.is_empty() else species
		if _species_buffer.has(visual_key):
			_species_buffer[visual_key].append(data)
		elif _species_buffer.has(species):
			_species_buffer[species].append(data)

	# Fill each proxy's instance buffer in one array and hand it over in a
	# single call: per instance a 3x4 transform (identity basis, the sprites
	# billboard) followed by an RGBA colour.
	for species: String in _proxies.keys():
		var buffer: Array = _species_buffer[species]
		var mm: MultiMesh = _proxies[species].multimesh
		var count: int = buffer.size()
		if mm.instance_count != count:
			mm.instance_count = count
		if count == 0:
			continue
		var lift: float = SPECIES_CONFIG[species]["sprite_size"].y * 0.5
		var mode: int = 1 if species == "falcon" else 2 if species == "robin" else 0
		var floats := PackedFloat32Array()
		floats.resize(count * 16)
		var o: int = 0
		for data: AgentData in buffer:
			# Agents think on staggered ticks; glide along their velocity in
			# between so sprites move smoothly instead of hopping.
			var since: float = clampf(float(now_msec - data.sync_msec) * 0.001, 0.0, MAX_GLIDE)
			var x: float = data.pos.x + data.vel.x * since
			var z: float = data.pos.z + data.vel.z * since
			var y: float
			if mode == 1:
				y = 8.0 + sin(data.age * 2.0) * 0.5
			elif mode == 2:
				y = 2.0 + sin(data.age * 3.0) * 0.3
			else:
				# Lift ground sprites so their bottom edge sits near ground level
				# across all camera angles with BILLBOARD_ENABLED
				y = data.pos.y + lift
			# Fade toward gray based on health (white = full color)
			var shade: float = lerpf(0.3, 1.0, clampf(data.health / 100.0, 0.0, 1.0))
			floats[o] = 1.0
			floats[o + 3] = x
			floats[o + 5] = 1.0
			floats[o + 7] = y
			floats[o + 10] = 1.0
			floats[o + 11] = z
			floats[o + 12] = shade
			floats[o + 13] = shade
			floats[o + 14] = shade
			floats[o + 15] = 1.0
			o += 16
		mm.buffer = floats

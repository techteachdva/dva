class_name VisualProxyManager
extends Node3D

# Species-scoped MultiMesh billboard sprite renderer: one draw call per
# species plus one for every creature's blob shadow. Sprites face the way
# they walk, bob with their gait, start small and grow up, and the
# champion species wears a gold rim.

const SpriteShader: Shader = preload("res://scripts/visuals/creature_sprite.gdshader")

# size: quad in world units. gait: steps per second (radians/s). kind: 0
# walker, 1 flier, 2 swimmer. shadow: blob width (0 = none).
const SPECIES_CONFIG: Dictionary = {
	"sheep": {"size": Vector2(2.5, 2.5), "gait": 9.0, "kind": 0, "shadow": 1.7, "style": 1},
	"wolf": {"size": Vector2(2.8, 2.8), "gait": 11.0, "kind": 0, "shadow": 1.9, "style": 2},
	"boar": {"size": Vector2(2.9, 2.9), "gait": 10.0, "kind": 0, "shadow": 2.0, "style": 3},
	"falcon": {"size": Vector2(2.6, 2.6), "gait": 5.0, "kind": 1, "shadow": 1.4, "style": 8},
	"robin": {"size": Vector2(1.7, 1.7), "gait": 14.0, "kind": 1, "shadow": 0.8, "style": 9},
	"worm": {"size": Vector2(1.4, 1.4), "gait": 4.0, "kind": 2, "shadow": 0.0, "style": 10},
	"human": {"size": Vector2(2.75, 2.75), "gait": 9.0, "kind": 0, "shadow": 1.1, "style": 5},
	"rabbit": {"size": Vector2(2.0, 2.0), "gait": 13.0, "kind": 0, "shadow": 1.1, "style": 4},
	# 3.0: fish drawn smaller so they read as fish next to the bank.
	"fish": {"size": Vector2(1.2, 0.6), "gait": 6.0, "kind": 2, "shadow": 0.0, "style": 11},
	"deer": {"size": Vector2(3.0, 3.0), "gait": 12.0, "kind": 0, "shadow": 1.8, "style": 1},
	"goat": {"size": Vector2(2.6, 2.6), "gait": 11.0, "kind": 0, "shadow": 1.6, "style": 1},
	"bear": {"size": Vector2(3.6, 3.6), "gait": 9.0, "kind": 0, "shadow": 2.6, "style": 3},
	"lion": {"size": Vector2(3.2, 3.2), "gait": 11.0, "kind": 0, "shadow": 2.0, "style": 2},
	"beetle": {"size": Vector2(0.9, 0.9), "gait": 16.0, "kind": 0, "shadow": 0.4, "style": 10},
	# kind 3: drawn where it is (drifting spores, toadstools on the ground).
	"mushroom": {"size": Vector2(2.0, 2.0), "gait": 1.0, "kind": 3, "shadow": 0.8, "style": 12},
}

# Every behaviour state, as the pose the rig layers over the walk:
# 1 eat, 2 fight, 3 flee, 4 sleep/rest, 5 court, 6 work (0 = just move).
const ACTIONS: Dictionary = {
	"Eat": 1, "Graze": 1, "Forage": 1, "Gather": 1, "Scavenge": 1,
	"Hunt": 2, "Chase": 2, "Charge": 2, "Defend": 2, "Raid": 2, "Dive": 2,
	"Flee": 3,
	"Sleep": 4, "Rest": 4, "Idle": 4, "Stranded": 4, "Anchor": 4,
	"Mate": 5, "Group": 5,
	"Build": 6, "Channel": 6,
}

# Feet sit this far above the bottom of the sprite canvas.
const FOOT_MARGIN: float = 0.05
const FLOATS_PER_INSTANCE: int = 20
const SHADOW_FLOATS: int = 16
const GROWN_AGE: float = 8.0

var _proxies: Dictionary = {}
var _materials: Dictionary = {}
var _species_buffer: Dictionary = {}
var _shadows: MultiMeshInstance3D
var _champion: String = ""
# Agent nodes the player has a bet on: drawn with a bright outline.
var marked: Dictionary = {}

func _ready() -> void:
	name = "VisualProxyManager"
	_champion = _champion_species()
	for species: String in SPECIES_CONFIG.keys():
		_setup_proxy(species)
	_setup_shadows()

func _champion_species() -> String:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null:
		return ""
	var bet: String = str(gc.player_bet).to_lower()
	for species: String in SPECIES_CONFIG.keys():
		if bet == species or bet == species + "s" or (species == "wolf" and bet == "wolves"):
			return species
	return ""

func _setup_proxy(species: String) -> void:
	var cfg: Dictionary = SPECIES_CONFIG[species]
	var proxy := MultiMeshInstance3D.new()
	proxy.name = species.capitalize() + "Visuals"
	proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	var quad := QuadMesh.new()
	quad.size = cfg["size"]
	# A small grid so heads, tails, ears and wings can move independently.
	# Fine enough that legs, necks and tails bend at their joints.
	quad.subdivide_width = 14
	quad.subdivide_depth = 14
	mm.mesh = quad
	mm.instance_count = 0
	proxy.multimesh = mm

	var tex: Texture2D = SpriteGenerator.texture_for(species)
	var mat := ShaderMaterial.new()
	mat.shader = SpriteShader
	mat.set_shader_parameter("sprite", tex)
	mat.set_shader_parameter("quad_height", (cfg["size"] as Vector2).y)
	mat.set_shader_parameter("quad_width", (cfg["size"] as Vector2).x)
	mat.set_shader_parameter("style", int(cfg["style"]))
	mat.set_shader_parameter("texel", Vector2(1.0 / tex.get_width(), 1.0 / tex.get_height()))
	mat.set_shader_parameter("grid", Vector2(SpriteGenerator.COLS, SpriteGenerator.ROWS))
	var is_champ: bool = species == _champion
	mat.set_shader_parameter("rim", 1.0 if is_champ else 0.0)
	proxy.material_override = mat
	# Nothing culls correctly once the buffer is filled by hand.
	proxy.custom_aabb = AABB(Vector3(-120, -10, -120), Vector3(240, 60, 240))

	add_child(proxy)
	_proxies[species] = proxy
	_materials[species] = mat
	_species_buffer[species] = []

# Drifting spores are small puffs; an anchored spore is a button that grows
# into a full cap over a few days, each one a slightly different size, and
# shrivels as it nears the end of its life.
func _mushroom_scale(data: AgentData) -> float:
	if data.state == "Anchor":
		return 0.3
	if data.state != "Fruit":
		return 0.55
	var grow: float = clampf(float(data.timers.get("grow", 3.0)) / 3.0, 0.0, 1.0)
	var size: float = 0.8 + fposmod(data.gait_seed * 3.0, 1.0) * 0.45
	var wither: float = 1.0
	if data.lifespan > 0.0:
		wither = lerpf(1.0, 0.6, clampf((data.age / data.lifespan - 0.85) / 0.15, 0.0, 1.0))
	return lerpf(0.3, size, grow * grow * (3.0 - 2.0 * grow)) * wither

func _setup_shadows() -> void:
	_shadows = MultiMeshInstance3D.new()
	_shadows.name = "CreatureShadows"
	_shadows.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var plane := PlaneMesh.new()
	plane.size = Vector2(1.0, 1.0)
	mm.mesh = plane
	mm.instance_count = 0
	_shadows.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	mat.vertex_color_use_as_albedo = true
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var tex_path := SpriteGenerator.SPRITE_DIR + "shadow.png"
	if ResourceLoader.exists(tex_path):
		mat.albedo_texture = load(tex_path)
	else:
		mat.albedo_texture = ImageTexture.create_from_image(SpriteGenerator.shadow_image())
	mat.render_priority = -1
	_shadows.material_override = mat
	_shadows.custom_aabb = AABB(Vector3(-120, -10, -120), Vector3(240, 60, 240))
	add_child(_shadows)

# The sun's say over the blob shadows: which way they fall across the
# ground, how far they stretch (long at dawn and dusk, short at noon) and
# how strong they are (faint by moonlight). Set by the director each frame.
var sun_dir := Vector2(0.0, 1.0)
var sun_stretch: float = 0.6
var shadow_fade: float = 1.0

func set_sun(dir: Vector2, stretch: float, fade: float) -> void:
	sun_dir = dir
	sun_stretch = stretch
	shadow_fade = fade

# 0 by day, 1 at midnight: every creature sprite takes a cool moonlit tint.
func set_night(n: float) -> void:
	for mat: ShaderMaterial in _materials.values():
		mat.set_shader_parameter("night", n)

func _process(delta: float) -> void:
	AgentData.clock += delta
	var director := get_parent() as SimulationDirector
	if director != null:
		sync(director._agent_registry)

func sync(registry: Array[AgentData]) -> void:
	var now: float = AgentData.clock
	for species: String in _species_buffer.keys():
		_species_buffer[species].clear()
	var shadow_count: int = 0
	for data: AgentData in registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		if not data.node.is_inside_tree():
			continue
		# Villagers asleep in their huts are out of sight until morning.
		if data.species == "human" and data.node.get("indoors") == true:
			continue
		if _species_buffer.has(data.species):
			_species_buffer[data.species].append(data)
			if float(SPECIES_CONFIG[data.species]["shadow"]) > 0.0:
				shadow_count += 1

	var cam := get_viewport().get_camera_3d()
	var right := Vector3.RIGHT if cam == null else cam.global_transform.basis.x
	var director := get_parent() as SimulationDirector
	var smm: MultiMesh = _shadows.multimesh
	if smm.instance_count != shadow_count:
		smm.instance_count = shadow_count
	var shadow_floats := PackedFloat32Array()
	shadow_floats.resize(shadow_count * SHADOW_FLOATS)
	var so: int = 0

	# Per instance: 3x4 transform (uniform scale, the shader billboards),
	# RGBA colour, then custom (facing, gait phase, motion, kind).
	for species: String in _proxies.keys():
		var buffer: Array = _species_buffer[species]
		var mm: MultiMesh = _proxies[species].multimesh
		var count: int = buffer.size()
		if mm.instance_count != count:
			mm.instance_count = count
		if count == 0:
			continue
		var cfg: Dictionary = SPECIES_CONFIG[species]
		var size: Vector2 = cfg["size"]
		var lift: float = size.y * (0.5 - FOOT_MARGIN)
		var gait: float = cfg["gait"]
		var kind: int = cfg["kind"]
		var shadow_w: float = cfg["shadow"]
		var floats := PackedFloat32Array()
		floats.resize(count * FLOATS_PER_INSTANCE)
		var o: int = 0
		for data: AgentData in buffer:
			# Agents think on staggered ticks. Between thinks the sprite glides
			# from where it was last drawn to the newest true position, so it
			# never overshoots a turn and snaps back (it trails by one think).
			# A gap further than it could have run in one think (a spawn, a
			# hut door) is a real jump: no glide. With many creatures each one
			# thinks less often, so a fast runner can cover well over 5 m.
			var t: float = clampf((now - data.sync_time) / data.interval, 0.0, 1.0)
			var from: Vector3 = data.prev_pos
			var reach: float = maxf(5.0, data.vel.length() * data.interval * 2.0 + 2.0)
			if from.distance_squared_to(data.pos) > reach * reach:
				from = data.pos
			var gp: Vector3 = from.lerp(data.pos, t)
			var x: float = gp.x
			var z: float = gp.z
			data.shown = gp
			data.has_shown = true
			var speed: float = Vector2(data.vel.x, data.vel.z).length()
			var side: float = data.vel.x * right.x + data.vel.z * right.z
			if side > 0.25:
				data.face = 1.0
			elif side < -0.25:
				data.face = -1.0
			var grown: float = clampf(data.age / GROWN_AGE, 0.0, 1.0)
			var s: float = lerpf(0.6, 1.0, grown)
			if data.golden > 0.05:
				# A golden bear is by far the biggest thing in the valley.
				s *= 1.7 if data.species == "bear" else 1.2
			if kind == 3:
				s = _mushroom_scale(data)
			var ground: float = data.pos.y
			var y: float
			var flying: bool = kind == 1
			if flying and director != null:
				ground = director.ground_height(x, z)
				# A robin that has landed hops on the grass.
				if species == "robin" and data.pos.y < ground + 1.0:
					flying = false
			if flying:
				if species == "falcon":
					y = ground + 8.0 + sin(now * 0.9 + data.gait_seed) * 0.5
				else:
					y = ground + 2.0 + sin(now * 2.2 + data.gait_seed) * 0.3
			elif kind == 3:
				# Spores float at their own height; a fruiting cap stands on the ground.
				if data.state == "Fruit" or data.state == "Anchor":
					y = data.pos.y + lift * s
				else:
					y = data.pos.y + 0.6 + sin(now * 1.3 + data.gait_seed) * 0.12
			elif species == "fish":
				if data.state == "Stranded":
					# Flopping about on the grass.
					y = data.pos.y + lift * s * 0.7 + absf(sin(now * 7.0 + data.gait_seed)) * 0.35
				else:
					# Swimming low in the current, back just breaking the surface.
					y = data.pos.y + lift * s * 0.35
			else:
				y = ground + lift * s if kind == 1 else data.pos.y + lift * s
			var motion: float = clampf((speed - 0.3) / 2.5, 0.0, 1.0) if not flying else 1.0
			# Only the badly hurt fade toward grey.
			var shade: float = 1.0 if kind == 3 else lerpf(0.55, 1.0, clampf(data.health / 40.0, 0.0, 1.0))
			# Golden creatures glow gold and glint now and then.
			var gold: float = data.golden
			floats[o] = s
			floats[o + 3] = x
			floats[o + 5] = s
			floats[o + 7] = y
			floats[o + 10] = s
			floats[o + 11] = z
			if gold > 0.0:
				var glint: float = 1.0 + 0.25 * gold * maxf(sin(now * 3.0 + data.gait_seed * 5.0), 0.0)
				floats[o + 12] = shade * lerpf(1.0, 1.35, gold) * glint
				floats[o + 13] = shade * lerpf(1.0, 1.1, gold) * glint
				floats[o + 14] = shade * lerpf(1.0, 0.4, gold)
			else:
				floats[o + 12] = shade
				floats[o + 13] = shade
				floats[o + 14] = shade
			# Alpha is free (sprites take alpha from the texture): it carries the
			# action, so the rig can pose eating, fighting, sleeping and so on.
			floats[o + 15] = float(ACTIONS.get(data.state, 0)) / 15.0
			floats[o + 16] = data.face
			floats[o + 17] = now * gait + data.gait_seed
			floats[o + 18] = motion
			# Atlas cell (kind column, sex row) plus a per-creature fraction so
			# idles (grazing, rooting, wingbeats) never sync up.
			var cell: int = Roles.role_index(data.role) + (SpriteGenerator.COLS if data.female else 0)
			if kind == 3:
				# Puffballs drift; caps are mostly fly agaric, now and then a violet one.
				cell = 0
				if data.state == "Fruit" or data.state == "Anchor":
					cell = 2 if fposmod(data.gait_seed * 7.0, 1.0) < 0.2 else 1
			if gold > 0.05:
				# Golden creatures wear their golden form (a golden cap, for mushrooms).
				cell = SpriteGenerator.GOLDEN + (SpriteGenerator.COLS if data.female and kind != 3 else 0)
			if data.node != null and marked.has(data.node):
				cell += 8
			floats[o + 19] = float(cell) + fposmod(data.gait_seed / TAU, 1.0) * 0.95
			o += FLOATS_PER_INSTANCE
			if shadow_w > 0.0:
				var w: float = shadow_w * s
				var alpha: float = 0.42
				if flying:
					var height: float = y - ground
					w *= clampf(1.2 - height * 0.05, 0.5, 1.0)
					alpha = clampf(0.4 - height * 0.025, 0.12, 0.4)
				# Cast away from the sun: the blob stretches along the light and
				# its near end stays under the feet. Fliers' shadows stay round.
				var stretch: float = 0.0 if flying else sun_stretch
				var length: float = w * (1.0 + stretch)
				var across: float = w * 0.62
				var d: Vector2 = sun_dir
				var shift: float = (length - w) * 0.5
				shadow_floats[so] = d.x * length
				shadow_floats[so + 1] = 0.0
				shadow_floats[so + 2] = -d.y * across
				shadow_floats[so + 3] = x + d.x * shift
				shadow_floats[so + 4] = 0.0
				shadow_floats[so + 5] = 1.0
				shadow_floats[so + 6] = 0.0
				shadow_floats[so + 7] = ground + 0.08
				shadow_floats[so + 8] = d.y * length
				shadow_floats[so + 9] = 0.0
				shadow_floats[so + 10] = d.x * across
				shadow_floats[so + 11] = z + d.y * shift
				# Long shadows thin out a little; moonlight barely casts any.
				shadow_floats[so + 15] = alpha * shadow_fade / (1.0 + stretch * 0.35)
				so += SHADOW_FLOATS
		mm.buffer = floats
	if shadow_count > 0:
		smm.buffer = shadow_floats

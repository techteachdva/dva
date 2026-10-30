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
	"mouse": {"size": Vector2(1.0, 1.0), "gait": 18.0, "kind": 0, "shadow": 0.45, "style": 4},
	# kind 3: drawn where it is (drifting spores, toadstools on the ground).
	"mushroom": {"size": Vector2(2.0, 2.0), "gait": 1.0, "kind": 3, "shadow": 0.8, "style": 12},
}

# Every behaviour state, as the frames the rig plays:
# 1 eat, 2 fight, 3 flee, 4 sleep/rest, 5 court, 6 work (0 = move or stand
# about). 7 (surprise) is set for a moment when a creature starts to flee.
const ACTIONS: Dictionary = {
	"Eat": 1, "Graze": 1, "Forage": 1, "Gather": 1, "Scavenge": 1,
	"Hunt": 2, "Chase": 2, "Charge": 2, "Defend": 2, "Raid": 2, "Dive": 2, "Perch": 0,
	"Flee": 3,
	"Sleep": 4, "Rest": 4, "Stranded": 4, "Anchor": 4,
	"Mate": 5, "Group": 5,
	"Build": 6, "Channel": 6, "Cook": 6,
}

# Feet sit this far above the bottom of the sprite canvas.
const FOOT_MARGIN: float = 0.05
const FLOATS_PER_INSTANCE: int = 20
# Buffers grow in chunks and never shrink; visible_instance_count shows the
# live ones. Reallocating GPU buffers every birth and death corrupted the
# instance data on some Chromebook GPUs (giant rainbow smears).
const CAPACITY_CHUNK: int = 64
# Failsafe: no sprite or shadow is ever drawn at size zero (or NaN). The
# billboard shader divides the quad by its scale, so a zero, NaN or huge
# scale on some GPUs blows one creature up into a giant distorted sprite.
const MIN_SCALE: float = 0.2
const MAX_SCALE: float = 3.0
# Unused slots in a chunk are parked tiny and deep underground, never zero.
const PARK_SCALE: float = 0.001
const PARK_Y: float = -500.0
# The Compatibility renderer packs colour and custom data as 16-bit floats,
# so the gait phase wraps here to stay small and precise (20 full turns).
const PHASE_WRAP: float = 40.0 * PI
const SHADOW_FLOATS: int = 16
const GROWN_AGE: float = 8.0
const SURPRISE: int = 7
# How long the startle shows when something turns to flee.
const ALARM_TIME: float = 0.8

var _proxies: Dictionary = {}
var _materials: Dictionary = {}
var _species_buffer: Dictionary = {}
var _shadows: MultiMeshInstance3D
# Sleepers breathe out a faint "z" now and then: [x, top of head, z, seed].
var _zzz: MultiMeshInstance3D
var _sleepers: Array = []
const ZZZ_FLOATS: int = 16
# Seconds for one z to rise and fade.
const ZZZ_CYCLE: float = 2.8
var _champion: String = ""
# Agent nodes the player has a bet on: drawn with a bright outline.
var marked: Dictionary = {}

func _ready() -> void:
	name = "VisualProxyManager"
	_champion = _champion_species()
	for species: String in SPECIES_CONFIG.keys():
		_setup_proxy(species)
	_setup_shadows()
	_setup_zzz()

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

	var tex: Texture2D = SpriteGenerator.anim_texture_for(species)
	var mat := ShaderMaterial.new()
	mat.shader = SpriteShader
	mat.set_shader_parameter("sprite", tex)
	mat.set_shader_parameter("quad_height", (cfg["size"] as Vector2).y)
	mat.set_shader_parameter("quad_width", (cfg["size"] as Vector2).x)
	mat.set_shader_parameter("style", int(cfg["style"]))
	mat.set_shader_parameter("texel", Vector2(1.0 / tex.get_width(), 1.0 / tex.get_height()))
	mat.set_shader_parameter("brand_tex", BrandBook.atlas())
	mat.set_shader_parameter("grid", Vector2(SpriteGenerator.FRAMES, SpriteGenerator.CELLS))
	mat.set_shader_parameter("gait", float(cfg["gait"]))
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

func _setup_zzz() -> void:
	_zzz = MultiMeshInstance3D.new()
	_zzz.name = "SleepZzz"
	_zzz.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	var q := QuadMesh.new()
	q.size = Vector2(1.0, 1.0)
	mm.mesh = q
	mm.instance_count = 0
	_zzz.multimesh = mm
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://scripts/visuals/zzz.gdshader")
	_zzz.material_override = mat
	_zzz.custom_aabb = AABB(Vector3(-120, -10, -120), Vector3(240, 60, 240))
	add_child(_zzz)

# One z per sleeper, rising from its head and fading, each on its own beat.
func _draw_zzz(now: float) -> void:
	var mm: MultiMesh = _zzz.multimesh
	var cap: int = _fit_capacity(mm, _sleepers.size())
	if cap == 0:
		return
	var buf := PackedFloat32Array()
	buf.resize(cap * ZZZ_FLOATS)
	var o: int = 0
	for e: Array in _sleepers:
		var t: float = fposmod(now / ZZZ_CYCLE + float(e[3]), 1.0)
		var size: float = lerpf(0.22, 0.4, t)
		buf[o] = size
		buf[o + 3] = float(e[0]) + t * 0.5
		buf[o + 5] = size
		buf[o + 7] = float(e[1]) + 0.2 + t * 0.9
		buf[o + 10] = size
		buf[o + 11] = float(e[2])
		buf[o + 12] = 1.0
		buf[o + 13] = 1.0
		buf[o + 14] = 1.0
		# Subtle: never more than half opaque, easing in and out.
		buf[o + 15] = 0.5 * sin(t * PI)
		o += ZZZ_FLOATS
	mm.buffer = buf

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
	sun_dir = dir.normalized() if dir.is_finite() and dir.length_squared() > 0.0001 else Vector2(0.0, 1.0)
	sun_stretch = clampf(stretch, 0.0, 3.0) if is_finite(stretch) else 0.0
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
	_sleepers.clear()
	for data: AgentData in registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		# A bad position would draw as a screen-filling smear on some GPUs.
		if not data.pos.is_finite() or not data.prev_pos.is_finite():
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

	var brand_tex := BrandBook.atlas()
	for mat: ShaderMaterial in _materials.values():
		mat.set_shader_parameter("brand_tex", brand_tex)
	var cam := get_viewport().get_camera_3d()
	var right := Vector3.RIGHT if cam == null else cam.global_transform.basis.x
	# The followed creature looks up at the camera now and then.
	var followed: Node = cam.call("following") if cam != null and cam.has_method("following") else null
	var director := get_parent() as SimulationDirector
	var smm: MultiMesh = _shadows.multimesh
	var shadow_cap: int = _fit_capacity(smm, shadow_count)
	var shadow_floats := PackedFloat32Array()
	shadow_floats.resize(shadow_cap * SHADOW_FLOATS)
	var so: int = 0

	# Per instance: 3x4 transform (uniform scale, the shader billboards),
	# RGBA colour, then custom (facing, gait phase, motion, kind).
	for species: String in _proxies.keys():
		var buffer: Array = _species_buffer[species]
		var mm: MultiMesh = _proxies[species].multimesh
		var count: int = buffer.size()
		var cap: int = _fit_capacity(mm, count)
		# The last of a species just died: drop its quads. Leaving the old
		# buffer up keeps a eaten creature's sprite on screen.
		if count == 0:
			mm.visible_instance_count = 0
			continue
		var cfg: Dictionary = SPECIES_CONFIG[species]
		var size: Vector2 = cfg["size"]
		var lift: float = size.y * (0.5 - FOOT_MARGIN)
		var gait: float = cfg["gait"]
		var kind: int = cfg["kind"]
		var shadow_w: float = cfg["shadow"]
		var floats := PackedFloat32Array()
		floats.resize(cap * FLOATS_PER_INSTANCE)
		var o: int = 0
		for data: AgentData in buffer:
			# Agents think on staggered ticks. Between thinks the sprite glides
			# from where it was last drawn to the newest true position, so it
			# never overshoots a turn and snaps back (it trails by one think).
			# A gap further than it could have run in one think (a spawn, a
			# hut door) is a real jump: no glide. With many creatures each one
			# thinks less often, so a fast runner can cover well over 5 m.
			# A newborn can arrive before its first think, with no interval yet.
			var t: float = clampf((now - data.sync_time) / maxf(data.interval, 0.001), 0.0, 1.0)
			if not is_finite(t):
				t = 1.0
			var from: Vector3 = data.prev_pos
			var reach: float = maxf(5.0, data.vel.length() * data.interval * 2.0 + 2.0)
			if from.distance_squared_to(data.pos) > reach * reach:
				from = data.pos
			var gp: Vector3 = from.lerp(data.pos, t)
			if not gp.is_finite():
				gp = data.pos
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
			if director != null:
				s *= director.tune(species, "size")
			s = clampf(s, MIN_SCALE, MAX_SCALE) if is_finite(s) else 1.0
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
					# Soars high on patrol; stoops to the grass to strike and eat.
					# Each falcon rides its own height, drifting slowly up and down
					# (5 to 16 m); it stoops to the grass to strike and eat, and
					# drops onto a treetop to perch.
					var low: bool = data.state == "Dive" or data.state == "Eat"
					var cruise: float = 6.0 + fposmod(data.gait_seed * 3.7, 1.0) * 6.0 + sin(now * 0.12 + data.gait_seed * 2.0) * 3.5
					var want: float = 1.2 if low else cruise
					if data.perch_y >= 0.0:
						want = data.perch_y - ground + lift * s * 0.6
					if data.alt < 0.0:
						data.alt = want
					data.alt = move_toward(data.alt, want, (14.0 if low else 4.0) * get_process_delta_time())
					var bob: float = sin(now * 0.9 + data.gait_seed) * 0.5 if not low and data.perch_y < 0.0 else 0.0
					y = ground + data.alt + bob
					# Sitting on a crown: wings folded, no flapping.
					if data.perch_y >= 0.0 and absf(data.alt - want) < 0.3:
						flying = false
				else:
					y = ground + 2.0 + sin(now * 2.2 + data.gait_seed) * 0.3
			elif kind == 3:
				# Spores float at their own height; a fruiting cap stands on the ground.
				# Settled spores sit on the grass; only one riding the wind floats.
				# Always measured from the grass, never the spore's own height: a
				# spore left high (born where a bird fell, or nudged upward) was
				# drawn floating among the falcons.
				var soil: float = director.ground_height(x, z) if director != null else data.pos.y
				if data.state == "Fruit" or data.state == "Anchor" or data.vel.length_squared() < 0.01:
					y = soil + lift * s
				else:
					y = soil + 0.6 + sin(now * 1.3 + data.gait_seed) * 0.12
			elif species == "fish":
				if data.state == "Stranded":
					# Flopping about on the grass.
					y = data.pos.y + lift * s * 0.7 + absf(sin(now * 7.0 + data.gait_seed)) * 0.35
				else:
					# Swimming low in the current, back just breaking the surface.
					y = data.pos.y + lift * s * 0.35
			else:
				y = ground + lift * s if kind == 1 else data.pos.y + lift * s
			y += data.draw_lift
			data.drawn_mid_y = y
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
			if data.brand_slot > 0 and not data.brand.is_empty():
				BrandBook.ensure(data)
				floats[o + 12] = 2.0 + float(data.brand_slot)
				floats[o + 13] = shade
				floats[o + 14] = shade
			elif gold > 0.0:
				var glint: float = 1.0 + 0.25 * gold * maxf(sin(now * 3.0 + data.gait_seed * 5.0), 0.0)
				floats[o + 12] = shade * lerpf(1.0, 1.35, gold) * glint
				floats[o + 13] = shade * lerpf(1.0, 1.1, gold) * glint
				floats[o + 14] = shade * lerpf(1.0, 0.4, gold)
			else:
				floats[o + 12] = shade
				floats[o + 13] = shade
				floats[o + 14] = shade
			if data.tint != Color.WHITE:
				floats[o + 12] *= data.tint.r
				floats[o + 13] *= data.tint.g
				floats[o + 14] *= data.tint.b
			# Alpha is free (sprites take alpha from the texture): it carries the
			# action, so the rig can pose eating, fighting, sleeping and so on.
			if data.state != data.seen_state:
				if data.state == "Flee":
					data.alarm_time = now
				data.seen_state = data.state
			var action: int = ACTIONS.get(data.state, 0)
			if now - data.alarm_time < ALARM_TIME:
				action = SURPRISE
			# Someone sleepy still walking to bed walks; they lie down on arrival.
			# Anyone actually covering ground walks, whatever its state says:
			# its velocity is from its last think and can lag behind.
			var moved: bool = data.prev_pos.distance_squared_to(data.pos) > 0.0025
			if action == ACTIONS["Sleep"] and (speed > 0.4 or moved):
				action = 0
			elif data.state == "Sleep" and action == ACTIONS["Sleep"]:
				_sleepers.append([x, y + size.y * 0.5 * s, z, fposmod(data.gait_seed, 1.0)])
			floats[o + 15] = float(action) / 15.0
			floats[o + 16] = data.face
			floats[o + 17] = fposmod(now * gait + data.gait_seed, PHASE_WRAP)
			# A cued look, or a staged frame (the opening's two whacks), rides in the motion channel.
			var shown_motion: float = motion
			if data.forced_frame >= 0:
				shown_motion = float(data.forced_frame + 2)
			elif now < data.look_until:
				shown_motion = float(SpriteGenerator.F_CAMERA + 2)
			floats[o + 18] = shown_motion
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
			if followed != null and data.node == followed:
				cell += 16
			floats[o + 19] = float(cell) + fposmod(data.gait_seed / TAU, 1.0) * 0.95
			if not is_finite(y):
				floats[o + 7] = data.pos.y
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
				if not is_finite(stretch):
					stretch = 0.0
				var length: float = w * (1.0 + stretch)
				var across: float = w * 0.62
				# A zero or bad sun direction would flatten every shadow to nothing.
				var d: Vector2 = sun_dir.normalized() if sun_dir.is_finite() and sun_dir.length_squared() > 0.0001 else Vector2(0.0, 1.0)
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
		_park(floats, o, FLOATS_PER_INSTANCE)
		_sanitize(floats, FLOATS_PER_INSTANCE)
		mm.buffer = floats
	if shadow_cap > 0:
		_park(shadow_floats, so, SHADOW_FLOATS)
		_sanitize(shadow_floats, SHADOW_FLOATS)
		smm.buffer = shadow_floats
	_draw_zzz(now)

# The last line of defence before the GPU: any non-finite or absurd value in
# an instance (transform, colour or custom data) parks that whole instance
# underground at a tiny size. The shader double-checks (creature_sprite).
static func _sanitize(buf: PackedFloat32Array, stride: int) -> void:
	var at: int = 0
	var n: int = buf.size()
	while at + stride <= n:
		var bad: bool = false
		for k: int in stride:
			var v: float = buf[at + k]
			if not is_finite(v) or absf(v) > 100000.0:
				bad = true
				break
		# Scale entries (the basis diagonal) must stay positive and sane.
		if not bad:
			for k: int in [0, 5, 10]:
				var s: float = absf(buf[at + k])
				if s > 0.0 and s < PARK_SCALE * 0.5 or s > 50.0:
					bad = true
		if bad:
			for k: int in stride:
				buf[at + k] = 0.0
			buf[at] = PARK_SCALE
			buf[at + 5] = PARK_SCALE
			buf[at + 10] = PARK_SCALE
			buf[at + 7] = PARK_Y
		at += stride

# Every slot from `from` on is parked: tiny, deep underground, invisible.
static func _park(buf: PackedFloat32Array, from: int, stride: int) -> void:
	var at: int = from
	while at + 11 < buf.size():
		buf[at] = PARK_SCALE
		buf[at + 5] = PARK_SCALE
		buf[at + 10] = PARK_SCALE
		buf[at + 7] = PARK_Y
		at += stride

# Grows the buffer in chunks (never shrinks, so births and deaths don't
# reallocate) and shows only the live instances. Returns the capacity.
func _fit_capacity(mm: MultiMesh, count: int) -> int:
	if mm.instance_count < count:
		mm.instance_count = (count / CAPACITY_CHUNK + 1) * CAPACITY_CHUNK
	mm.visible_instance_count = count
	return mm.instance_count

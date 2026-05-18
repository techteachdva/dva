extends RefCounted
class_name LevelVisuals

## Applies consistent world-tinted lighting, fog, and glow to gameplay levels.

const WORLD_TINTS: Dictionary = {
	1: Color(1.0, 0.55, 0.10),
	2: Color(0.20, 0.70, 1.00),
	3: Color(0.70, 0.20, 1.00),
	4: Color(1.00, 0.22, 0.22),
	5: Color(0.20, 0.90, 0.60),
	6: Color(1.00, 0.90, 0.30),
}

const THEME_SKY_PARAMS: Dictionary = {
	"theme_neon":  {"base_color": Color(0.15, 0.85, 1.00), "speed": 0.45, "emission_strength": 0.75, "color_contrast": 1.45, "wash_guard": 0.92, "mode": 1},
	"theme_nature":{"base_color": Color(0.45, 0.72, 1.00), "speed": 0.08, "emission_strength": 0.18, "color_contrast": 1.05, "wash_guard": 0.85, "mode": 3},
	"theme_space": {"base_color": Color(0.04, 0.04, 0.18), "speed": 0.03, "emission_strength": 0.55, "color_contrast": 1.35, "wash_guard": 0.88, "mode": 2},
}

const THEME_ENV_OVERRIDES: Dictionary = {
	"theme_neon":  {"ambient_mult": 0.45, "glow_intensity": 0.35, "fog_density": 0.002, "exposure": 1.05, "light_energy_mult": 0.85},
	"theme_nature":{"ambient_mult": 0.85, "glow_intensity": 0.12, "fog_density": 0.001, "exposure": 1.12, "light_energy_mult": 1.15},
	"theme_space": {"ambient_mult": 0.25, "glow_intensity": 0.30, "fog_density": 0.004, "exposure": 0.88, "light_energy_mult": 0.75},
}

static func world_tint(world: int) -> Color:
	return WORLD_TINTS.get(world, WORLD_TINTS[1])

static func _theme_id() -> String:
	var tree := Engine.get_main_loop()
	if tree is SceneTree:
		if tree.root.get_node_or_null("LevelManager") != null:
			return LevelManager.get_equipped_theme()
	return ""

static func setup(level: Node3D, world: int, reduce_motion: bool) -> void:
	_apply_world_environment(level, world, reduce_motion)
	_tune_directional_lights(level, world, reduce_motion)


static func configure_sky_material(mat: ShaderMaterial, world: int, reduce_motion: bool) -> void:
	if mat == null:
		return
	var theme: String = _theme_id()
	var tint := world_tint(world)
	var speed := 0.22 if reduce_motion else 0.28
	var emission := 0.20 if reduce_motion else 0.32
	var contrast := 1.18 if reduce_motion else 1.28
	var wash := 0.78
	var mode := 0

	var overrides: Dictionary = THEME_SKY_PARAMS.get(theme, {})
	if not overrides.is_empty():
		tint = overrides.get("base_color", tint)
		speed = overrides.get("speed", speed)
		emission = overrides.get("emission_strength", emission)
		contrast = overrides.get("color_contrast", contrast)
		wash = overrides.get("wash_guard", wash)
		mode = overrides.get("mode", mode)

	mat.set_shader_parameter("base_color", tint)
	mat.set_shader_parameter("speed", speed)
	mat.set_shader_parameter("emission_strength", emission)
	mat.set_shader_parameter("color_contrast", contrast)
	mat.set_shader_parameter("wash_guard", wash)
	mat.set_shader_parameter("mode", mode)


static func _apply_world_environment(level: Node3D, world: int, reduce_motion: bool) -> void:
	var we := level.get_node_or_null("WorldEnvironment") as WorldEnvironment
	if we == null:
		we = WorldEnvironment.new()
		we.name = "WorldEnvironment"
		level.add_child(we)
	we.environment = _build_environment(world, reduce_motion)


static func _build_environment(world: int, reduce_motion: bool) -> Environment:
	var tint := world_tint(world)
	var theme: String = _theme_id()
	var theme_ov: Dictionary = THEME_ENV_OVERRIDES.get(theme, {})

	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(tint.r * 0.03, tint.g * 0.03, tint.b * 0.04, 1.0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	# Muted ambient — strong world tint was washing out the lava-lamp sky sphere.
	env.ambient_light_color = tint.lerp(Color(0.38, 0.40, 0.48), 0.55)
	env.ambient_light_energy = (0.32 if reduce_motion else 0.24) * theme_ov.get("ambient_mult", 1.0)
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = (1.02 if reduce_motion else 0.98) * theme_ov.get("exposure", 1.0)
	env.tonemap_white = 1.15

	if reduce_motion:
		env.glow_enabled = false
		env.fog_enabled = false
	else:
		env.glow_enabled = true
		env.glow_intensity = theme_ov.get("glow_intensity", 0.26)
		env.glow_strength = 0.72
		env.glow_bloom = 0.035
		env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
		env.glow_hdr_threshold = 1.15
		env.fog_enabled = true
		env.fog_light_color = tint.lerp(Color(0.35, 0.38, 0.45), 0.6)
		env.fog_density = theme_ov.get("fog_density", 0.003)
		env.fog_sky_affect = 0.0
		env.fog_aerial_perspective = 0.18
	return env


static func _tune_directional_lights(level: Node3D, world: int, reduce_motion: bool) -> void:
	var tint := world_tint(world)
	var theme: String = _theme_id()
	var theme_ov: Dictionary = THEME_ENV_OVERRIDES.get(theme, {})
	for child: Node in level.get_children():
		if child is DirectionalLight3D:
			var light := child as DirectionalLight3D
			light.light_color = tint.lerp(Color.WHITE, 0.35)
			light.light_energy = (1.05 if reduce_motion else 1.12) * theme_ov.get("light_energy_mult", 1.0)
			light.shadow_enabled = not reduce_motion
			if light.shadow_enabled:
				light.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
				light.directional_shadow_max_distance = 140.0
				light.shadow_bias = 0.08
			light.light_specular = 0.45
			light.light_specular = 0.45

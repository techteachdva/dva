extends Node3D

# Utility autoload-free helper attached to each level's TrackRoot node.
# Handles shared track materials so each level scene doesn't duplicate them.

# ── Shared material cache ─────────────────────────────────────────────────────
static var _mat_cache: Dictionary = {}

static func _get_or_create(key: String, creator: Callable) -> Material:
	if not _mat_cache.has(key):
		_mat_cache[key] = creator.call()
	return _mat_cache[key]

# ── Shared materials (created once, reused across meshes) ─────────────────────

const WALL_SHADER  := preload("res://assets/shaders/holographic_wall.gdshader")

static func _holo_shader(base: Color, fresnel: float = 2.2, emission: float = 1.1) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = WALL_SHADER
	m.set_shader_parameter("base_color", base)
	m.set_shader_parameter("fresnel_power", fresnel)
	m.set_shader_parameter("emission_mult", emission)
	return m

static func track_material() -> Material:
	if get_node_or_null("/root/LevelManager") != null and LevelManager.get_setting("reduce_motion", false):
		return _get_or_create("track_plain", func():
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.02, 0.02, 0.03, 1.0)
			m.emission_enabled = true
			m.emission = Color(0.01, 0.01, 0.02, 1.0)
			m.emission_energy_multiplier = 0.3
			m.metallic = 0.5
			m.roughness = 0.25
			return m
		)
	return _get_or_create("track", func():
		# Dark, almost black holographic — prismatic edge-glow without nausea
		return _holo_shader(Color(0.008, 0.008, 0.012, 1.0), 3.5, 0.2)
	)

static func wall_material() -> Material:
	if get_node_or_null("/root/LevelManager") != null and LevelManager.get_setting("reduce_motion", false):
		return _get_or_create("wall_plain", func():
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.04, 0.04, 0.06, 0.5)
			m.emission_enabled = true
			m.emission = Color(0.02, 0.02, 0.03, 1.0)
			m.emission_energy_multiplier = 0.3
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			return m
		)
	return _get_or_create("wall", func():
		return _holo_shader(Color(0.04, 0.04, 0.06, 0.5))
	)

static func danger_material() -> StandardMaterial3D:
	return _get_or_create("danger", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(1.0, 0.08, 0.08, 1.0)
		m.emission_enabled     = true
		m.emission             = Color(0.9, 0.0,  0.0,  1.0)
		m.emission_energy_multiplier = 1.0
		return m
	)

static func boost_material() -> StandardMaterial3D:
	return _get_or_create("boost", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(0.1, 1.0, 0.3, 1.0)
		m.emission_enabled     = true
		m.emission             = Color(0.0, 0.8, 0.2, 1.0)
		m.emission_energy_multiplier = 1.0
		return m
	)

static func wind_material() -> StandardMaterial3D:
	return _get_or_create("wind", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(0.55, 0.88, 1.0, 0.22)
		m.emission_enabled     = true
		m.emission             = Color(0.3, 0.7, 1.0, 1.0)
		m.emission_energy_multiplier = 0.6
		m.transparency         = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.roughness            = 0.4
		return m
	)

static func gravity_material() -> StandardMaterial3D:
	return _get_or_create("gravity", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(0.55, 0.15, 0.85, 0.32)
		m.emission_enabled     = true
		m.emission             = Color(0.45, 0.1, 0.75, 1.0)
		m.emission_energy_multiplier = 0.85
		m.transparency         = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.roughness            = 0.35
		return m
	)

static func ice_material() -> StandardMaterial3D:
	return _get_or_create("ice", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(0.75, 0.92, 1.0, 0.85)
		m.emission_enabled     = true
		m.emission             = Color(0.45, 0.78, 1.0, 1.0)
		m.emission_energy_multiplier = 0.8
		m.roughness            = 0.03
		m.metallic             = 0.55
		m.transparency         = BaseMaterial3D.TRANSPARENCY_ALPHA
		return m
	)

static func moving_material() -> StandardMaterial3D:
	return _get_or_create("moving", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(1.0, 0.55, 0.0, 1.0)
		m.emission_enabled     = true
		m.emission             = Color(0.9, 0.4, 0.0, 1.0)
		m.emission_energy_multiplier = 0.9
		m.roughness            = 0.35
		m.metallic             = 0.25
		return m
	)

static func checkpoint_material() -> StandardMaterial3D:
	return _get_or_create("checkpoint", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(1.0, 0.85, 0.05, 1.0)
		m.emission_enabled     = true
		m.emission             = Color(0.85, 0.7, 0.0, 1.0)
		m.emission_energy_multiplier = 1.1
		m.roughness            = 0.3
		return m
	)

static func finish_material() -> StandardMaterial3D:
	return _get_or_create("finish", func():
		var m := StandardMaterial3D.new()
		m.albedo_color         = Color(0.05, 0.95, 0.25, 1.0)
		m.emission_enabled     = true
		m.emission             = Color(0.0, 0.85, 0.15, 1.0)
		m.emission_energy_multiplier = 1.5
		m.roughness            = 0.3
		m.metallic             = 0.2
		return m
	)

# ── Theme overrides ─────────────────────────────────────────────────────────────

static func themed_track_material(theme: String) -> Material:
	match theme:
		"theme_neon":
			return _holo_shader(Color(0.012, 0.005, 0.012, 1.0), 3.5, 0.22)
		"theme_nature":
			return _holo_shader(Color(0.005, 0.012, 0.005, 1.0), 3.5, 0.18)
		"theme_space":
			return _holo_shader(Color(0.005, 0.005, 0.012, 1.0), 3.5, 0.20)
		_:
			return track_material()

static func themed_wall_material(theme: String) -> Material:
	match theme:
		"theme_neon":
			return _holo_shader(Color(0.06, 0.02, 0.08, 0.5))
		"theme_nature":
			return _holo_shader(Color(0.02, 0.06, 0.02, 0.5))
		"theme_space":
			return _holo_shader(Color(0.02, 0.02, 0.06, 0.5))
		_:
			return wall_material()

# ── Runtime: apply shared materials to all MeshInstance3D children tagged ──────

func _ready() -> void:
	# Apply to the whole level, not just TrackRoot, so inline obstacles get colored too
	var level_root: Node = get_parent()
	if level_root != null:
		_apply_materials(level_root)
	else:
		_apply_materials(self)

static func _apply_materials(node: Node) -> void:
	var theme := LevelManager.get_equipped_theme()
	for child: Node in node.get_children():
		if child is MeshInstance3D:
			match child.get_meta("mat_type", ""):
				"track":       child.material_override = themed_track_material(theme)
				"wall":        child.material_override = themed_wall_material(theme)
				"danger":      child.material_override = danger_material()
				"boost":       child.material_override = boost_material()
				"ice":         child.material_override = ice_material()
				"moving":      child.material_override = moving_material()
				"checkpoint":  child.material_override = checkpoint_material()
				"finish":      child.material_override = finish_material()
				"wind":        child.material_override = wind_material()
				"gravity":     child.material_override = gravity_material()
		_apply_materials(child)

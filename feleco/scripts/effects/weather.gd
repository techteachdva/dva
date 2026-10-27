class_name Weather
extends Node3D

# Snow through the winter and a downpour while Rain is active. Both emit
# from a sheet over the meadow; the browser build uses fewer flakes.

var _snow: CPUParticles3D
var _rain: CPUParticles3D
var _rain_left: float = 0.0

func _ready() -> void:
	var scale_amount: float = 0.5 if OS.has_feature("web") else 1.0
	_snow = _make(int(700 * scale_amount), 9.0, Vector3(0, -1.6, 0), Color(1, 1, 1, 0.95), Vector2(0.16, 0.16))
	_snow.initial_velocity_min = 0.2
	_snow.initial_velocity_max = 0.8
	_snow.spread = 60.0
	_snow.direction = Vector3(0.4, -1, 0.2)
	_rain = _make(int(1100 * scale_amount), 1.6, Vector3(0, -26, 0), Color(0.75, 0.85, 1.0, 0.7), Vector2(0.05, 0.9))
	_rain.initial_velocity_min = 6.0
	_rain.initial_velocity_max = 9.0
	_rain.direction = Vector3(0.1, -1, 0)
	_rain.spread = 4.0

func _make(amount: int, life: float, gravity: Vector3, color: Color, size: Vector2) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = maxi(amount, 16)
	p.lifetime = life
	p.emitting = false
	p.local_coords = false
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = Vector3(48, 1, 48)
	p.position = Vector3(0, 22, 0)
	p.gravity = gravity
	p.preprocess = life * 0.5
	var quad := QuadMesh.new()
	quad.size = size
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.vertex_color_use_as_albedo = true
	# Particle billboards (see Corpse._build_stink): plain ones blow up on
	# particles that haven't been emitted yet.
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	quad.material = mat
	p.mesh = quad
	p.color = color
	p.visibility_aabb = AABB(Vector3(-60, -30, -60), Vector3(120, 40, 120))
	add_child(p)
	return p

func set_snow(on: bool) -> void:
	if _snow != null:
		_snow.emitting = on

func rain(seconds: float) -> void:
	_rain_left = maxf(_rain_left, seconds)
	if _rain != null:
		_rain.emitting = true

func _process(delta: float) -> void:
	if _rain_left > 0.0:
		_rain_left -= delta
		if _rain_left <= 0.0 and _rain != null:
			_rain.emitting = false

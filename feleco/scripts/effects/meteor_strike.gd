class_name MeteorStrike
extends Node3D

# A burning rock tears down the sky and slams into the valley. `struck` fires on
# impact, so whatever it kills dies as it lands. The rock sits smoking in its
# crater, cracks, and hinges open like a walnut: out fly the Rainbow Starfruit.
# The crater stays until the fruit is gone, then the ground heals over.

signal struck

const RockShader: Shader = preload("res://scripts/visuals/meteor_rock.gdshader")
const FALL_TIME: float = 1.25
const RADIUS: float = 2.1
const TRAIL: int = 16
const SMOKE: int = 10
# After impact: when the rock cracks, and how long the walnut takes to open.
const CRACK_AT: float = 1.15
const OPEN_TIME: float = 0.5
const CRATER_RADIUS: float = 5.5
const FRUIT: int = 9
# Seconds the crater lasts at least, and at most.
const CRATER_MIN: float = 30.0
const CRATER_MAX: float = 170.0

var land: Vector3 = Vector3.ZERO
var sim: SimulationDirector
var _t: float = 0.0
var _hit: bool = false
var _opened: bool = false
var _cracked: bool = false
var _start: Vector3
var _rock: Node3D
var _hinges: Array[Node3D] = []
var _rock_mat: ShaderMaterial
var _trail: Array[MeshInstance3D] = []
var _smoke: Array[Array] = []
var _flash: MeshInstance3D
var _ring: MeshInstance3D
var _crater: MeshInstance3D
var _bits: Array[Array] = []
var _pool: MeshInstance3D
var _aura: MeshInstance3D

func _ready() -> void:
	top_level = true
	global_position = Vector3.ZERO
	_start = land + Vector3(15.0, 34.0, -11.0)
	_build_rock()
	for i: int in TRAIL:
		var k: float = float(i) / float(TRAIL)
		var col := Color(1.0, 0.86, 0.4).lerp(Color(0.95, 0.24, 0.06), k)
		_trail.append(_ball(lerpf(2.0, 0.35, k), col, true))
	_flash = _ball(1.0, Color(1.0, 0.88, 0.6), true)
	_flash.visible = false
	var torus := TorusMesh.new()
	torus.inner_radius = 0.9
	torus.outer_radius = 1.0
	_ring = MeshInstance3D.new()
	_ring.mesh = torus
	_ring.material_override = _glow(Color(1.0, 0.8, 0.5))
	_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_ring.visible = false
	add_child(_ring)

func _build_rock() -> void:
	_rock = Node3D.new()
	add_child(_rock)
	_rock_mat = ShaderMaterial.new()
	_rock_mat.shader = RockShader
	var inside := ShaderMaterial.new()
	inside.shader = RockShader
	inside.set_shader_parameter("inner", 1.0)
	var dome := SphereMesh.new()
	dome.radius = RADIUS
	dome.height = RADIUS
	dome.is_hemisphere = true
	dome.radial_segments = 20
	dome.rings = 10
	var face := CylinderMesh.new()
	face.top_radius = RADIUS * 0.97
	face.bottom_radius = RADIUS * 0.97
	face.height = 0.1
	face.radial_segments = 20
	# Two halves on a hinge along the ground. Shut, they are one rock.
	for s: float in [1.0, -1.0]:
		var hinge := Node3D.new()
		hinge.position = Vector3(0.0, 0.5 - RADIUS, 0.0)
		_rock.add_child(hinge)
		var shell := MeshInstance3D.new()
		shell.mesh = dome
		shell.material_override = _rock_mat
		shell.position = Vector3(0.0, RADIUS - 0.5, 0.0)
		shell.rotation.x = s * PI * 0.5
		shell.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		hinge.add_child(shell)
		var flesh := MeshInstance3D.new()
		flesh.mesh = face
		flesh.material_override = inside
		flesh.position = Vector3(0.0, 0.05, 0.0)
		flesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		shell.add_child(flesh)
		_hinges.append(hinge)

func _ball(radius: float, col: Color, see_through: bool = false) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 10
	mesh.rings = 6
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = _glow(col) if see_through else _solid(col)
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(m)
	return m

func _solid(col: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = col
	return mat

func _glow(col: Color) -> StandardMaterial3D:
	var mat := _solid(col)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return mat

func _shake(amount: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam != null and cam.has_method("shake"):
		cam.shake(amount)

func _process(delta: float) -> void:
	_t += delta
	if not _hit:
		var f: float = clampf(_t / FALL_TIME, 0.0, 1.0)
		_rock.position = _start.lerp(_rest(), pow(f, 1.5))
		_rock.rotate_x(delta * 3.0)
		_rock.rotate_z(delta * 2.0)
		for i: int in TRAIL:
			var back: float = clampf(f - float(i + 1) * 0.022, 0.0, 1.0)
			_trail[i].position = _start.lerp(_rest(), pow(back, 1.5))
		if f >= 1.0:
			_impact()
		return
	_after(_t - FALL_TIME, delta)

func _rest() -> Vector3:
	return land + Vector3.UP * (RADIUS - 0.5)

func _after(a: float, delta: float) -> void:
	var burst: float = clampf(a / 0.6, 0.0, 1.0)
	_flash.scale = Vector3.ONE * lerpf(1.0, 13.0, 1.0 - pow(1.0 - burst, 3.0))
	_flash.visible = burst < 1.0
	(_flash.material_override as StandardMaterial3D).albedo_color.a = 1.0 - burst
	var wave: float = clampf(a / 1.0, 0.0, 1.0)
	_ring.scale = Vector3(1.0, 0.2, 1.0) * lerpf(1.0, 24.0, 1.0 - pow(1.0 - wave, 2.0))
	_ring.visible = wave < 1.0
	(_ring.material_override as StandardMaterial3D).albedo_color.a = 1.0 - wave
	for b: Array in _bits:
		var bit: MeshInstance3D = b[0]
		var v: Vector3 = b[1]
		v.y -= 24.0 * delta
		b[1] = v
		if bit.position.y > land.y:
			bit.position += v * delta
			bit.rotate_x(delta * 7.0)
		elif bit.visible and a > 3.0:
			bit.visible = false
	for s: Array in _smoke:
		var puff: MeshInstance3D = s[0]
		var age: float = fmod(a + float(s[1]), 2.4)
		puff.position = land + (s[2] as Vector3) + Vector3.UP * (1.0 + age * 2.4)
		puff.scale = Vector3.ONE * (0.8 + age * 0.9)
		var fade: float = 1.0 - smoothstep(4.0, 7.0, a)
		(puff.material_override as StandardMaterial3D).albedo_color.a = (1.0 - age / 2.4) * 0.5 * fade
	# It sits there, seams pulsing. Then the crack.
	if a < CRACK_AT:
		var pulse: float = a / CRACK_AT
		_rock_mat.set_shader_parameter("heat", 1.0 + pulse * sin(a * 24.0) * 0.8)
		_rock.position = _rest() + Vector3(sin(a * 60.0), 0.0, cos(a * 47.0)) * pulse * 0.07
	else:
		if not _cracked:
			_cracked = true
			_shake(0.55)
			FXManager.spawn_birth_particles(_rest(), Color(1.0, 1.0, 1.0))
		_rock.position = _rest()
		var o: float = clampf((a - CRACK_AT) / OPEN_TIME, 0.0, 1.0)
		# Falls open with a little overshoot, and comes to rest propped on the
		# crater floor with the bright inside showing.
		var angle: float = (1.0 - pow(1.0 - o, 3.0)) * 1.28 + sin(o * PI) * 0.16
		_hinges[0].rotation.x = angle
		_hinges[1].rotation.x = -angle
		_rock_mat.set_shader_parameter("heat", maxf(1.0 - (a - CRACK_AT) * 0.25, 0.0))
		if o > 0.3 and not _opened:
			_opened = true
			_spill()
	# The crater stays while there is fruit in it, then heals over.
	var fruit_gone: bool = get_tree().get_nodes_in_group("starfruit").is_empty()
	if (a > CRATER_MIN and fruit_gone) or a > CRATER_MAX:
		var heal: float = _rock.scale.y - delta * 0.4
		if heal <= 0.02:
			queue_free()
			return
		_rock.scale = Vector3.ONE * heal
		_crater.scale.y = heal
		if _pool != null:
			(_pool.material_override as ShaderMaterial).set_shader_parameter("strength", heal)
			(_aura.material_override as ShaderMaterial).set_shader_parameter("strength", heal * 0.5)

func _impact() -> void:
	_hit = true
	_rock.rotation = Vector3.ZERO
	_rock.position = _rest()
	# Hinge across the view, so the rock opens to left and right of the camera.
	var cam := get_viewport().get_camera_3d()
	if cam != null:
		var to_cam: Vector3 = cam.global_position - land
		_rock.rotation.y = atan2(-to_cam.z, to_cam.x)
	for puff: MeshInstance3D in _trail:
		puff.visible = false
	_flash.position = land + Vector3.UP
	_flash.visible = true
	_ring.position = land + Vector3.UP * 0.4
	_ring.visible = true
	_crater = MeshInstance3D.new()
	_crater.mesh = _crater_mesh()
	var dirt := StandardMaterial3D.new()
	dirt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dirt.vertex_color_use_as_albedo = true
	dirt.cull_mode = BaseMaterial3D.CULL_DISABLED
	_crater.material_override = dirt
	_crater.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_crater)
	for i: int in 30:
		var bit := _ball(randf_range(0.16, 0.5), Color(0.34, 0.24, 0.16).lerp(Color(0.95, 0.42, 0.12), randf() * 0.5))
		bit.position = land + Vector3.UP * 0.5
		var ang: float = randf() * TAU
		_bits.append([bit, Vector3(cos(ang), 0.0, sin(ang)) * randf_range(4.0, 15.0) + Vector3.UP * randf_range(9.0, 20.0)])
	for i: int in SMOKE:
		var puff := _ball(1.0, Color(0.32, 0.27, 0.24), true)
		(puff.material_override as StandardMaterial3D).blend_mode = BaseMaterial3D.BLEND_MODE_MIX
		_smoke.append([puff, randf() * 2.4, Vector3(randf_range(-2.4, 2.4), 0.0, randf_range(-2.4, 2.4))])
	_shake(1.5)
	FXManager.show_dramatic_text(land + Vector3.UP * 6.0, "METEOR!", Color(1.0, 0.6, 0.25))
	struck.emit()

# The heart of the crater: neon light across its floor and up into the air.
func _light_crater() -> void:
	var plane := PlaneMesh.new()
	plane.size = Vector2.ONE * CRATER_RADIUS * 2.1
	var mat := ShaderMaterial.new()
	mat.shader = load("res://scripts/visuals/neon_glow.gdshader")
	mat.set_shader_parameter("flat_on_ground", 1.0)
	mat.set_shader_parameter("strength", 1.0)
	mat.set_shader_parameter("star_cells", 7.0)
	_pool = MeshInstance3D.new()
	_pool.mesh = plane
	_pool.material_override = mat
	_pool.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_pool.position = land + Vector3.UP * 0.4
	add_child(_pool)
	_aura = Starfruit.glow_quad(CRATER_RADIUS * 2.6, 0.5)
	_aura.position = land + Vector3.UP * 2.0
	add_child(_aura)

# Fruit bursts from the open rock into the bowl of the crater.
func _spill() -> void:
	_light_crater()
	if sim == null:
		return
	for i: int in FRUIT:
		var ang: float = TAU * float(i) / float(FRUIT) + randf_range(-0.2, 0.2)
		var r: float = randf_range(2.8, CRATER_RADIUS - 1.0)
		var to := land + Vector3(cos(ang) * r, 0.0, sin(ang) * r)
		to.y = sim.ground_height(to.x, to.z) + 0.1
		var fruit := Starfruit.new()
		fruit.launch(land + Vector3.UP * 1.6, to)
		sim.add_child(fruit)
	FXManager.show_dramatic_text(land + Vector3.UP * 5.0, "STARFRUIT!", Color(0.8, 0.9, 1.0))

# A dished scar: scorched floor, a lip of thrown earth, draped over the ground.
func _crater_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var around: int = 28
	var cuts: Array[float] = [0.0, 0.5, 0.78, 0.92, 1.05, 1.3]
	var lift: Array[float] = [0.12, 0.12, 0.26, 0.85, 0.5, 0.0]
	var cols: Array[Color] = [Color(0.05, 0.04, 0.05), Color(0.09, 0.06, 0.06), Color(0.2, 0.13, 0.1), Color(0.42, 0.31, 0.2), Color(0.34, 0.27, 0.17), Color(0.3, 0.36, 0.18)]
	var rows: Array = []
	for j: int in cuts.size():
		var row: Array[Vector3] = []
		for i: int in around:
			var a: float = TAU * float(i) / float(around)
			var wob: float = 1.0 + sin(a * 3.0 + 1.0) * 0.06 + sin(a * 7.0) * 0.03
			var p := land + Vector3(cos(a), 0.0, sin(a)) * CRATER_RADIUS * cuts[j] * wob
			p.y = (sim.ground_height(p.x, p.z) if sim != null else land.y) + lift[j]
			row.append(p)
		rows.append(row)
	for j: int in cuts.size() - 1:
		for i: int in around:
			var n: int = (i + 1) % around
			for v: Array in [[j, i], [j, n], [j + 1, n], [j, i], [j + 1, n], [j + 1, i]]:
				st.set_color(cols[v[0]])
				st.add_vertex(rows[v[0]][v[1]])
	return st.commit()

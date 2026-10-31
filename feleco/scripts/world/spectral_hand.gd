class_name SpectralHand
extends Node3D

# A god's hand reaching into the valley, made of blue light. An arm that thins
# away into drifting motes comes down and, with absurd delicacy for its size,
# pinches the creature by the scruff between thumb and forefinger. The other
# three fingers tuck into the palm.
# It holds them until told to set them down. Local axes: +Y runs up the arm, -Z faces the camera, and the
# origin is the grip, on the creature.

signal cancelled

const SkinShader: Shader = preload("res://scripts/visuals/hand_skin.gdshader")
const InkShader: Shader = preload("res://scripts/visuals/hand_outline.gdshader")
const MOTES: int = 14
# A massive hand moves slowly around small things.
const GENTLE: float = 0.6
# Where the fingertips meet, in the hand's own space.
const PINCH := Vector3(0.48, -0.31, 0.02)
const MOTE_RISE: float = 3.6
# How far above the grip the open hand waits, in hand sizes.
const REACH_HEIGHT: float = 7.0
const LOW_SPECIES: Array[String] = ["worm", "beetle", "mouse"]

var _agent: MarkovAgent
var _done: Callable
var _t: float = 0.0
var _mode: String = "lift"
# Per finger: [knuckle, middle joint, end joint, sideways spread].
var _fingers: Array[Array] = []
var _thumb: Array[Node3D] = []
var _shadow: MeshInstance3D
var _sent: bool = false
var _hold: float = 0.0
var _skin: ShaderMaterial
var _tip: ShaderMaterial
var _ink: ShaderMaterial
var _nail_mat: ShaderMaterial
var _motes: Array[Node3D] = []
var _mote_speed: Array[float] = []

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_ink = ShaderMaterial.new()
	_ink.shader = InkShader
	_skin = _material(Color(0.3, 0.56, 0.96), Color(0.11, 0.2, 0.62), Color(0.62, 0.86, 1.0))
	# Light gathers at the fingertips.
	_tip = _material(Color(0.46, 0.74, 1.0), Color(0.18, 0.36, 0.82), Color(0.8, 0.95, 1.0))
	_nail_mat = _material(Color(0.78, 0.93, 1.0), Color(0.5, 0.74, 1.0), Color(0.95, 1.0, 1.0))
	_build()

func lift(agent: MarkovAgent, on_held: Callable) -> void:
	_agent = agent
	_done = on_held
	_mode = "lift"
	_t = 0.0
	_sent = false

func put_down(on_done: Callable) -> void:
	_done = on_done
	_mode = "drop"
	_t = 0.0
	_sent = false

func _process(delta: float) -> void:
	if _agent == null or not is_instance_valid(_agent):
		cancelled.emit()
		queue_free()
		return
	_t += delta * GENTLE
	var rise := 0.0
	var curl := 0.0
	var away := 0.0
	if _mode == "lift":
		away = 1.0 - smoothstep(0.0, 0.55, _t)
		curl = smoothstep(0.42, 0.8, _t)
		rise = smoothstep(0.72, 1.25, _t) * _hoist()
		_hold = rise
		if _t > 1.3 and not _sent:
			_sent = true
			if _done.is_valid():
				_done.call()
	elif _mode == "hold":
		# A living grip: it shifts its hold a little, never quite still.
		rise = _hold + sin(_t * 1.7) * 0.05
		curl = 1.0 + sin(_t * 2.3) * 0.03
	else:
		rise = lerpf(_hold, 0.0, smoothstep(0.0, 0.5, _t))
		curl = 1.0 - smoothstep(0.42, 0.7, _t)
		away = smoothstep(0.62, 1.05, _t)
		if _t > 1.1 and not _sent:
			_sent = true
			if _agent._data != null:
				_agent._data.draw_lift = 0.0
			if _done.is_valid():
				_done.call()
			queue_free()
			return
	if _mode != "drop" and _sent:
		_mode = "hold"
	if _agent._data != null:
		_agent._data.draw_lift = rise
	_pose(curl, away)
	_place(away)
	_drift_motes(delta)
	if _shadow != null:
		var feet := _shown()
		_shadow.global_position = Vector3(feet.x, feet.y + 0.05, feet.z)
		_shadow.global_rotation = Vector3.ZERO
		var spread: float = _body_height() * (0.7 + rise * 0.08 + away * 0.5)
		_shadow.scale = Vector3(spread, 1.0, spread * 0.65)

# Fingers roll in from the knuckle out, the little finger last, as real ones do.
func _pose(curl: float, away: float) -> void:
	# little, ring, middle, index: knuckle, middle and end joints when pinching.
	var shut: Array[Vector3] = [Vector3(1.25, 1.4, 1.2), Vector3(1.35, 1.4, 1.2), Vector3(1.3, 1.4, 1.2), Vector3(-0.3, 0.7, 0.8)]
	for i: int in _fingers.size():
		var f: Array = _fingers[i]
		var c: float = clampf(curl * 1.25 - float(3 - i) * 0.08, 0.0, 1.0)
		var wiggle: float = sin(_t * 9.0 + float(i) * 1.3) * away * 0.08
		var aim: Vector3 = shut[i]
		(f[0] as Node3D).rotation = Vector3(lerpf(-0.42, aim.x, c) + wiggle, 0.0, lerpf(float(f[3]), float(f[3]) * 0.3, c))
		(f[1] as Node3D).rotation.x = lerpf(0.16, aim.y, c)
		(f[2] as Node3D).rotation.x = lerpf(0.1, aim.z, c)
	_thumb[0].rotation = Vector3(lerpf(0.5, 0.3, curl), 0.0, lerpf(0.75, 0.04, curl))
	_thumb[1].rotation = Vector3(lerpf(0.0, -0.7, curl), 0.0, lerpf(0.05, -0.05, curl))
	_thumb[2].rotation = Vector3(lerpf(0.0, -0.6, curl), 0.0, lerpf(0.05, -0.08, curl))

func _place(away: float) -> void:
	var data: AgentData = _agent._data
	var feet := _shown()
	var mid_y: float = feet.y + _body_height() * 0.46
	if data != null and data.drawn_mid_y > 0.2:
		mid_y = data.drawn_mid_y
	# These are painted along the bottom of their canvas: reach down to them.
	var grip_up: float = 0.1
	if LOW_SPECIES.has(str(_agent.get("species_id"))):
		mid_y = feet.y + _agent_lift() + _body_height() * 0.14
		grip_up = 0.0
	var mid := Vector3(feet.x, mid_y, feet.z)
	var cam := get_viewport().get_camera_3d()
	var to_cam := Vector3(0.0, 0.6, 1.0)
	if cam != null:
		to_cam = cam.global_position - mid
	if to_cam.length_squared() < 0.04:
		to_cam = Vector3(0.0, 0.6, 1.0)
	to_cam = to_cam.normalized()
	var up := Vector3.UP
	if absf(to_cam.dot(up)) > 0.92:
		up = Vector3.FORWARD
	var fit: float = clampf(_body_height() / 2.4, 0.55, 1.7)
	scale = Vector3.ONE * fit
	# -Z points at the camera, so the thumb is on our side of the creature.
	var ease_in: float = away * away
	var drawn_up: Vector3 = (up - to_cam * up.dot(to_cam)).normalized()
	global_position = mid + drawn_up * (_body_height() * grip_up + REACH_HEIGHT * fit * ease_in)
	look_at(global_position + to_cam, up)
	rotate_object_local(Vector3.FORWARD, sin(_t * 1.3) * 0.03 + away * 0.18)
	# Side on: thumb and forefinger pinch across the picture, palm edge to us.
	rotate_object_local(Vector3.UP, PI * 0.5)
	# Put the fingertips, not the palm, on the scruff of the neck.
	global_position += drawn_up * _body_height() * 0.04 - global_basis * PINCH

func _agent_lift() -> float:
	return _agent._data.draw_lift if _agent._data != null else 0.0

func _shown() -> Vector3:
	if _agent._data != null and _agent._data.has_shown:
		return _agent._data.shown
	return _agent.global_position

func _body_height() -> float:
	var species := ""
	if _agent.get("species_id") != null:
		species = str(_agent.species_id)
	var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(species, {})
	var quad: Vector2 = cfg.get("size", Vector2(2.2, 2.2))
	var grown := 1.0
	if _agent._data != null:
		grown = lerpf(0.6, 1.0, clampf(_agent._data.age / VisualProxyManager.GROWN_AGE, 0.0, 1.0))
		if _agent._data.golden > 0.05:
			grown *= 1.7 if species == "bear" else 1.2
	var director: SimulationDirector = _agent.director
	if director != null and species != "":
		grown *= director.tune(species, "size")
	return maxf(quad.y * grown, 0.6)

func _hoist() -> float:
	return clampf(_body_height() * 1.15, 1.7, 3.8)

func _build() -> void:
	# The palm: a broad pad, the heel below the wrist and the ball of the thumb.
	_ball(self, Vector3(0.0, 0.66, 0.1), Vector3(0.62, 0.52, 0.27), _skin)
	_ball(self, Vector3(0.0, 0.98, 0.1), Vector3(0.44, 0.32, 0.24), _skin)
	_ball(self, Vector3(0.42, 0.72, -0.08), Vector3(0.25, 0.36, 0.21), _skin)
	# Fingers hang from the far edge of the palm: little, ring, middle, index.
	var at_x: Array[float] = [-0.46, -0.16, 0.13, 0.42]
	var long: Array[float] = [0.8, 0.96, 1.06, 0.97]
	var fat: Array[float] = [0.88, 0.96, 1.0, 1.0]
	var fan: Array[float] = [-0.2, -0.07, 0.05, 0.17]
	for i: int in 4:
		_fingers.append(_finger(Vector3(at_x[i], 0.34, 0.2), long[i], fat[i], fan[i]))
	# The thumb comes round on the near side of the creature.
	var t1 := _joint(self, Vector3(0.5, 0.5, -0.17))
	_bone(t1, 0.4, 0.145, _skin)
	var t2 := _joint(t1, Vector3(0.0, -0.4, 0.0))
	_bone(t2, 0.32, 0.128, _skin)
	var t3 := _joint(t2, Vector3(0.0, -0.32, 0.0))
	_bone(t3, 0.24, 0.112, _tip)
	_nail(t3, -0.17, 0.112)
	_thumb = [t1, t2, t3]
	_arm()
	_shadow = MeshInstance3D.new()
	var blob := PlaneMesh.new()
	blob.size = Vector2(1.4, 1.0)
	_shadow.mesh = blob
	var shade := StandardMaterial3D.new()
	shade.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shade.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shade.albedo_texture = SpriteGenerator.texture_for_shadow()
	shade.albedo_color = Color(1.0, 1.0, 1.0, 0.55)
	shade.cull_mode = BaseMaterial3D.CULL_DISABLED
	_shadow.material_override = shade
	_shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_shadow.top_level = true
	add_child(_shadow)

# Three bones, each hung from the last. Returns [knuckle, middle, end, spread].
func _finger(at: Vector3, long: float, fat: float, spread: float) -> Array:
	var r: float = 0.128 * fat
	var a := _joint(self, at)
	_bone(a, 0.36 * long, r, _skin)
	var b := _joint(a, Vector3(0.0, -0.36 * long, 0.0))
	_bone(b, 0.27 * long, r * 0.91, _skin)
	var c := _joint(b, Vector3(0.0, -0.27 * long, 0.0))
	_bone(c, 0.21 * long, r * 0.82, _tip)
	_nail(c, -0.15 * long, r * 0.82)
	return [a, b, c, spread]

func _arm() -> void:
	# It leans toward the camera, so we look along it a little. It has no end:
	# it thins into the air, and motes of light drift up off it.
	var arm := _joint(self, Vector3(0.0, 1.12, 0.1))
	arm.rotation.x = -0.38
	var fore := CylinderMesh.new()
	fore.top_radius = 0.36
	fore.bottom_radius = 0.26
	fore.height = 6.0
	fore.rings = 12
	_show(arm, fore, Vector3(0.0, 3.0, 0.0), _skin, Vector3.ONE, true, Vector2(-3.0, -0.4))
	var bead := SphereMesh.new()
	bead.radius = 1.0
	bead.height = 2.0
	bead.radial_segments = 8
	bead.rings = 4
	for i: int in MOTES:
		var mote := MeshInstance3D.new()
		mote.mesh = bead
		mote.material_override = _nail_mat
		mote.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mote.position = Vector3(randf_range(-0.45, 0.45), randf_range(0.0, MOTE_RISE), randf_range(-0.3, 0.3))
		arm.add_child(mote)
		_motes.append(mote)
		_mote_speed.append(randf_range(0.5, 1.1))

func _drift_motes(delta: float) -> void:
	for i: int in _motes.size():
		var m: Node3D = _motes[i]
		m.position.y += delta * _mote_speed[i]
		m.position.x += sin(_t * 1.4 + float(i)) * delta * 0.1
		if m.position.y > MOTE_RISE:
			m.position.y = 0.0
		# They wink out as they rise.
		m.scale = Vector3.ONE * 0.05 * (1.0 - m.position.y / MOTE_RISE)

func _joint(parent: Node3D, at: Vector3) -> Node3D:
	var n := Node3D.new()
	n.position = at
	parent.add_child(n)
	return n

# One finger bone, running down -Y from its joint.
func _bone(joint: Node3D, length: float, radius: float, mat: ShaderMaterial) -> void:
	_show(joint, _capsule(radius, length + radius * 2.0), Vector3(0.0, -length * 0.5, 0.0), mat)

func _nail(joint: Node3D, y: float, radius: float) -> void:
	# On the back of the finger, the side that faces us as it curls round.
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	_show(joint, mesh, Vector3(0.0, y, radius * 0.72), _nail_mat, Vector3(radius * 0.72, radius * 0.95, radius * 0.34), false)

func _ball(parent: Node3D, at: Vector3, radii: Vector3, mat: ShaderMaterial) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = 1.0
	mesh.height = 2.0
	mesh.radial_segments = 24
	mesh.rings = 12
	_show(parent, mesh, at, mat, radii)

func _capsule(radius: float, height: float) -> CapsuleMesh:
	var mesh := CapsuleMesh.new()
	mesh.radius = radius
	mesh.height = maxf(height, radius * 2.0)
	mesh.radial_segments = 16
	mesh.rings = 6
	return mesh

func _show(parent: Node3D, mesh: Mesh, at: Vector3, mat: ShaderMaterial, size: Vector3 = Vector3.ONE, inked: bool = true, fade: Vector2 = Vector2.ZERO) -> void:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.position = at
	m.scale = size
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var own: ShaderMaterial = mat
	if inked:
		# Scaled balls need a thinner push to keep the halo even.
		var line := _ink.duplicate() as ShaderMaterial
		line.set_shader_parameter("width", 0.03 / minf(size.x, minf(size.y, size.z)))
		line.set_shader_parameter("fade_from", fade.x)
		line.set_shader_parameter("fade_to", fade.y)
		own = mat.duplicate() as ShaderMaterial
		own.set_shader_parameter("fade_from", fade.x)
		own.set_shader_parameter("fade_to", fade.y)
		own.next_pass = line
	m.material_override = own
	parent.add_child(m)

func _material(base: Color, shade: Color, lit: Color) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = SkinShader
	mat.set_shader_parameter("base", base)
	mat.set_shader_parameter("shade", shade)
	mat.set_shader_parameter("lit", lit)
	return mat

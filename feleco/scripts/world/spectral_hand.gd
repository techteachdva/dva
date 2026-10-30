class_name SpectralHand
extends Node3D

# A god's hand between the camera and a creature. The palm faces the viewer,
# the fingers curl down over the sprite, and the wrist reaches toward the
# screen. It holds them until told to set them down.

signal cancelled

var _agent: MarkovAgent
var _done: Callable
var _t: float = 0.0
var _mode: String = "lift"
var _fingers: Array[Node3D] = []
var _shadow: MeshInstance3D
var _sent: bool = false
var _hold: float = 0.0
var _mat: ShaderMaterial

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_mat = ShaderMaterial.new()
	_mat.shader = preload("res://scripts/visuals/spectral_hand.gdshader")
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
	_t += delta
	var rise := 0.0
	var curl := 0.15
	var reach := 0.55
	if _mode == "lift":
		rise = smoothstep(0.2, 1.05, _t) * _hoist()
		curl = lerpf(0.05, 1.0, smoothstep(0.35, 1.05, _t))
		reach = lerpf(1.15, 0.42, smoothstep(0.15, 0.7, _t))
		_hold = rise
		if _t > 1.25 and not _sent:
			_sent = true
			if _done.is_valid():
				_done.call()
	elif _mode == "hold":
		rise = _hold
		curl = 1.0
		reach = 0.42
	else:
		rise = lerpf(_hold, 0.0, smoothstep(0.0, 0.55, _t))
		curl = lerpf(1.0, 0.05, smoothstep(0.0, 0.4, _t))
		reach = lerpf(0.42, 1.3, smoothstep(0.15, 0.7, _t))
		if _t > 0.85 and not _sent:
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
	var fidget: float = sin(_t * 14.0) * (1.0 - curl) * 0.22
	for finger: Node3D in _fingers:
		finger.rotation.x = curl * 1.15 + fidget
	_place(reach)
	if _shadow != null:
		var feet := _shown()
		_shadow.global_position = Vector3(feet.x, feet.y + 0.05, feet.z)
		_shadow.global_rotation = Vector3.ZERO
		var spread: float = _body_height() * (0.7 + rise * 0.08)
		_shadow.scale = Vector3(spread, 1.0, spread * 0.65)

func _place(reach: float) -> void:
	var data: AgentData = _agent._data
	var feet := _shown()
	var mid_y: float = feet.y + _body_height() * 0.46
	if data != null and data.drawn_mid_y > 0.2:
		mid_y = data.drawn_mid_y
	var mid := Vector3(feet.x, mid_y, feet.z)
	var cam := get_viewport().get_camera_3d()
	var to_cam := Vector3(0.0, 0.6, 1.0)
	if cam != null:
		to_cam = cam.global_position - mid
	if to_cam.length_squared() < 0.04:
		to_cam = Vector3(0.0, 0.6, 1.0)
	to_cam = to_cam.normalized()
	var fit: float = clampf(_body_height() / 2.4, 0.55, 1.7)
	scale = Vector3.ONE * fit
	global_position = mid + to_cam * (reach * fit)
	# -Z points at the camera, so the palm faces the viewer and the fingers
	# (built along +Z) reach back over the creature.
	var up := Vector3.UP
	if absf(to_cam.dot(up)) > 0.92:
		up = Vector3.FORWARD
	look_at(global_position + to_cam, up)
	rotate_object_local(Vector3.FORWARD, sin(_t * 1.3) * 0.04)

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
	return clampf(_body_height() * 0.7, 1.2, 2.6)

func _build() -> void:
	_box(Vector3(1.35, 0.92, 0.16), Vector3(0, 0, 0))
	# Fingers grow toward the camera (-Z) from the top of the palm, then curl
	# down across the creature. Built the other way, the palm hid them.
	for i: int in 4:
		var pivot := Node3D.new()
		pivot.position = Vector3(-0.48 + float(i) * 0.32, 0.42, -0.12)
		add_child(pivot)
		_fingers.append(pivot)
		_seg(pivot, Vector3(0.22, 0.16, 0.4), Vector3(0, 0.02, -0.22))
		_seg(pivot, Vector3(0.18, 0.14, 0.34), Vector3(0, 0.0, -0.52))
	var thumb := Node3D.new()
	thumb.position = Vector3(-0.72, -0.05, -0.1)
	thumb.rotation.y = 0.6
	add_child(thumb)
	_fingers.append(thumb)
	_seg(thumb, Vector3(0.2, 0.15, 0.38), Vector3(-0.08, -0.02, -0.2))
	for i: int in 4:
		var s: float = 0.34 - float(i) * 0.05
		_box(Vector3(s, s * 0.72, s * 0.8), Vector3(0.0, -0.02, -0.28 - float(i) * 0.28))
	for i: int in 5:
		var cube := MeshInstance3D.new()
		var box := BoxMesh.new()
		var q: float = 0.08 + float(i % 2) * 0.03
		box.size = Vector3(q, q, q)
		cube.mesh = box
		cube.material_override = _mat
		cube.position = Vector3(-0.2 + float(i) * 0.1, 0.22, -0.45 - float(i % 3) * 0.12)
		add_child(cube)
	_eye()
	_arrow()
	_shadow = MeshInstance3D.new()
	var blob := PlaneMesh.new()
	blob.size = Vector2(1.4, 1.0)
	_shadow.mesh = blob
	var shade := StandardMaterial3D.new()
	shade.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shade.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shade.albedo_color = Color(0.02, 0.03, 0.06, 0.4)
	shade.cull_mode = BaseMaterial3D.CULL_DISABLED
	_shadow.material_override = shade
	_shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_shadow.top_level = true
	add_child(_shadow)

func _box(size: Vector3, at: Vector3) -> void:
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.material_override = _mat
	mesh.position = at
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mesh)

func _seg(pivot: Node3D, size: Vector3, at: Vector3) -> void:
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	mesh.mesh = box
	mesh.material_override = _mat
	mesh.position = at
	mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pivot.add_child(mesh)

func _eye() -> void:
	var iris := MeshInstance3D.new()
	var ball := SphereMesh.new()
	ball.radius = 0.16
	ball.height = 0.32
	iris.mesh = ball
	var gold := StandardMaterial3D.new()
	gold.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	gold.albedo_color = Color(0.95, 0.82, 0.45)
	iris.material_override = gold
	iris.position = Vector3(0.0, 0.02, -0.12)
	add_child(iris)
	var pupil := MeshInstance3D.new()
	var pit := SphereMesh.new()
	pit.radius = 0.07
	pit.height = 0.14
	pupil.mesh = pit
	var dark := StandardMaterial3D.new()
	dark.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	dark.albedo_color = Color(0.04, 0.02, 0.06)
	pupil.material_override = dark
	pupil.position = Vector3(0.0, 0.02, -0.24)
	add_child(pupil)

func _arrow() -> void:
	_box(Vector3(0.08, 0.34, 0.04), Vector3(-0.55, 0.15, -0.7))
	var head := MeshInstance3D.new()
	var prism := BoxMesh.new()
	prism.size = Vector3(0.2, 0.16, 0.04)
	head.mesh = prism
	head.material_override = _mat
	head.position = Vector3(-0.55, 0.38, -0.7)
	head.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(head)

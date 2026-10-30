class_name SpectralHand
extends Node3D

# The valley's hand. Androgynous, neither a brawler's fist nor a porcelain
# glove: one length of finger, a calm palm, an eye that knows it is being
# watched. Half of it is a smooth spectral surface, half of it is pixels,
# and a game cursor rides the wrist because it knows it is in a game.

var _agent: MarkovAgent
var _done: Callable
var _t: float = 0.0
var _mode: String = "lift"
var _fingers: Array[Node3D] = []
var _pixels: Array[MeshInstance3D] = []
var _cursor: MeshInstance3D
var _shadow: MeshInstance3D
var _sent: bool = false
var _hold: float = 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	scale = Vector3(2.15, 2.15, 2.15)
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
		if _agent != null and _agent._data != null:
			_agent._data.draw_lift = 0.0
		queue_free()
		return
	_t += delta
	var p: Vector3 = _agent.global_position
	var rise := 0.0
	var curl := 1.0
	var away := 0.0
	if _mode == "lift":
		rise = smoothstep(0.45, 1.35, _t) * 4.2
		curl = smoothstep(0.55, 1.2, _t)
		_hold = rise
		if _t > 1.85 and not _sent:
			_sent = true
			if _done.is_valid():
				_done.call()
	elif _mode == "hold":
		rise = _hold
		curl = 1.0
	else:
		rise = lerpf(_hold, 0.0, smoothstep(0.0, 0.7, _t))
		curl = 1.0 - smoothstep(0.05, 0.55, _t)
		away = smoothstep(0.45, 1.15, _t) * 6.0
		if _t > 1.25 and not _sent:
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
	global_position = p + Vector3(0.35, 0.85 + rise, 0.85 + away)
	rotation.x = deg_to_rad(-62.0)
	rotation.y = sin(_t * 0.6) * 0.08
	var fidget: float = sin(_t * 16.0) * (1.0 - curl) * 0.4 + sin(_t * 2.4) * 0.05 * curl
	for finger: Node3D in _fingers:
		finger.rotation.x = deg_to_rad(-78.0) * curl + fidget
	var spin: float = _t * 1.4
	for i: int in _pixels.size():
		var pix: MeshInstance3D = _pixels[i]
		var a: float = spin + float(i) * TAU / float(_pixels.size())
		var ring: float = 1.15 + 0.15 * sin(_t * 2.0 + float(i))
		pix.position = Vector3(cos(a) * ring, 0.35 + sin(a * 2.0) * 0.18, sin(a) * ring * 0.65)
		pix.rotation = Vector3(a, a * 0.5, 0.0)
	if _cursor != null:
		_cursor.rotation.y = -rotation.y + sin(_t * 3.0) * 0.2
		_cursor.position.y = 0.85 + sin(_t * 2.2) * 0.06
	if _shadow != null:
		_shadow.global_position = Vector3(p.x, p.y + 0.06, p.z)
		_shadow.global_rotation = Vector3.ZERO
		var spread: float = 2.4 + rise * 0.35
		_shadow.scale = Vector3(spread, 1.0, spread * 0.72)
	var cam := get_viewport().get_camera_3d()
	if cam != null and cam.has_method("set_view") and _mode != "drop":
		cam.set_view(p + Vector3(0, 1.4 + rise * 0.35, 0), cam.yaw, deg_to_rad(-26.0), lerpf(cam.distance, 18.0, 0.06))

func _build() -> void:
	var ether := _mat(_ether_code())
	var pixel := _mat(_pixel_code())
	var eye_mat := _mat(_eye_code())
	_palm(ether)
	_eye(eye_mat)
	for i: int in 4:
		var mat: Material = pixel if i % 2 == 0 else ether
		_finger(mat, Vector3(-0.48 + float(i) * 0.32, 0.05, -0.78), 0.0)
	_finger(ether, Vector3(0.72, -0.04, -0.22), 0.65)
	_wrist(pixel)
	for i: int in 10:
		var cube := MeshInstance3D.new()
		var box := BoxMesh.new()
		var s: float = 0.06 + float(i % 3) * 0.025
		box.size = Vector3(s, s, s)
		cube.mesh = box
		cube.material_override = pixel if i % 2 == 0 else ether
		add_child(cube)
		_pixels.append(cube)
	_cursor = MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2(0.42, 0.42)
	_cursor.mesh = quad
	_cursor.material_override = _mat(_cursor_code())
	_cursor.position = Vector3(-0.95, 0.8, -0.2)
	add_child(_cursor)
	_shadow = MeshInstance3D.new()
	var blob := PlaneMesh.new()
	blob.size = Vector2(1.6, 1.1)
	_shadow.mesh = blob
	var shade := StandardMaterial3D.new()
	shade.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shade.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shade.albedo_color = Color(0.02, 0.04, 0.08, 0.45)
	shade.cull_mode = BaseMaterial3D.CULL_DISABLED
	_shadow.material_override = shade
	_shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_shadow.top_level = true
	add_child(_shadow)

func _palm(mat: Material) -> void:
	var mesh := MeshInstance3D.new()
	var ball := SphereMesh.new()
	ball.radius = 0.55
	ball.height = 1.1
	ball.radial_segments = 24
	ball.rings = 12
	mesh.mesh = ball
	mesh.material_override = mat
	mesh.scale = Vector3(1.15, 0.42, 1.35)
	mesh.position = Vector3(0, 0, -0.2)
	add_child(mesh)
	for i: int in 4:
		var knuckle := MeshInstance3D.new()
		var k := SphereMesh.new()
		k.radius = 0.12
		k.height = 0.24
		k.radial_segments = 12
		k.rings = 6
		knuckle.mesh = k
		knuckle.material_override = mat
		knuckle.position = Vector3(-0.42 + float(i) * 0.28, 0.12, -0.72)
		add_child(knuckle)

func _eye(mat: Material) -> void:
	var mesh := MeshInstance3D.new()
	var ball := SphereMesh.new()
	ball.radius = 0.2
	ball.height = 0.4
	ball.radial_segments = 20
	ball.rings = 10
	mesh.mesh = ball
	mesh.material_override = mat
	mesh.position = Vector3(0, -0.16, -0.22)
	add_child(mesh)

func _finger(mat: Material, at: Vector3, yaw: float) -> void:
	var pivot := Node3D.new()
	pivot.position = at
	pivot.rotation.y = yaw
	add_child(pivot)
	_fingers.append(pivot)
	var z: float = 0.0
	for seg: int in 3:
		var mesh := MeshInstance3D.new()
		var cap := CapsuleMesh.new()
		cap.radius = 0.07 - float(seg) * 0.012
		cap.height = 0.34
		cap.radial_segments = 12
		cap.rings = 4
		mesh.mesh = cap
		mesh.material_override = mat
		mesh.rotation.x = PI * 0.5
		z -= 0.2
		mesh.position = Vector3(0, 0, z)
		pivot.add_child(mesh)
		z -= 0.16

func _wrist(mat: Material) -> void:
	for i: int in 6:
		var cube := MeshInstance3D.new()
		var box := BoxMesh.new()
		var s: float = 0.22 - float(i) * 0.028
		box.size = Vector3(s, s * 0.7, s)
		cube.mesh = box
		cube.material_override = mat
		cube.position = Vector3(float(i % 2) * 0.08 - 0.04, 0.02, 0.55 + float(i) * 0.16)
		add_child(cube)

func _mat(code: String) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = code
	var mat := ShaderMaterial.new()
	mat.shader = sh
	return mat

func _ether_code() -> String:
	return "shader_type spatial;\nrender_mode blend_mix, cull_disabled, depth_draw_opaque, shadows_disabled, unshaded;\nvarying vec3 wpos;\nvoid vertex(){ wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }\nvoid fragment(){\n\tvec3 n = normalize(NORMAL);\n\tvec3 view = normalize(VIEW);\n\tfloat fres = pow(1.0 - clamp(dot(n, view), 0.0, 1.0), 1.6);\n\tfloat skin = pow(clamp(dot(n, view), 0.0, 1.0), 2.4);\n\tvec3 hyper = mix(vec3(0.55, 0.72, 0.95), vec3(1.0, 0.9, 0.82), skin);\n\thyper += vec3(0.45, 0.25, 0.7) * fres;\n\tvec2 grid = floor(FRAGCOORD.xy / 7.0);\n\tfloat gate = step(0.55, fract(sin(dot(grid, vec2(19.1, 73.4))) * 43758.5));\n\tvec3 pix = floor(hyper * 6.0) / 6.0;\n\tvec3 col = mix(hyper, pix, gate);\n\tcol *= 0.82 + 0.18 * step(0.62, fract(FRAGCOORD.y * 0.18));\n\tfloat scan = smoothstep(0.0, 0.08, abs(fract(wpos.y * 3.0 - TIME * 0.35) - 0.5));\n\tcol += vec3(0.25, 0.45, 0.7) * (1.0 - scan) * 0.25;\n\tALBEDO = col;\n\tALPHA = 0.34 + fres * 0.5;\n}\n"

func _pixel_code() -> String:
	return "shader_type spatial;\nrender_mode blend_mix, cull_disabled, depth_draw_opaque, shadows_disabled, unshaded;\nvoid vertex(){\n\tVERTEX = round(VERTEX * 9.0) / 9.0;\n}\nvoid fragment(){\n\tvec3 n = normalize(NORMAL);\n\tfloat fres = pow(1.0 - clamp(dot(n, normalize(VIEW)), 0.0, 1.0), 2.0);\n\tvec3 col = floor(mix(vec3(0.25, 0.45, 0.95), vec3(0.95, 0.75, 1.0), fres) * 5.0) / 5.0;\n\tfloat cell = step(0.5, fract(FRAGCOORD.x / 4.0)) * step(0.5, fract(FRAGCOORD.y / 4.0));\n\tcol = mix(col, vec3(0.9, 0.95, 1.0), cell * 0.35);\n\tALBEDO = col;\n\tALPHA = 0.55 + fres * 0.35;\n}\n"

func _eye_code() -> String:
	return "shader_type spatial;\nrender_mode blend_mix, cull_disabled, depth_draw_opaque, shadows_disabled, unshaded;\nvoid fragment(){\n\tvec2 p = FRAGCOORD.xy;\n\tfloat iris = fract(sin(dot(floor(p / 3.0), vec2(12.4, 45.1))) * 2300.0);\n\tvec3 col = mix(vec3(0.05, 0.08, 0.12), vec3(0.95, 0.85, 0.55), smoothstep(0.2, 0.8, iris));\n\tfloat pupil = smoothstep(0.18, 0.05, length(fract(p / 48.0) - 0.5));\n\tcol = mix(col, vec3(0.02, 0.0, 0.04), pupil);\n\tALBEDO = col;\n\tALPHA = 0.92;\n}\n"

func _cursor_code() -> String:
	return "shader_type spatial;\nrender_mode blend_mix, cull_disabled, unshaded, depth_draw_opaque, shadows_disabled;\nvoid fragment(){\n\tvec2 uv = UV;\n\tfloat arrow = step(uv.x, 0.28) * step(uv.y, 0.72);\n\tarrow = max(arrow, step(0.28, uv.x) * step(uv.x, 0.55) * step(0.35, uv.y) * step(uv.y, 0.62));\n\tvec3 col = mix(vec3(0.05, 0.04, 0.03), vec3(1.0, 0.95, 0.85), arrow);\n\tfloat blink = step(0.5, fract(TIME * 1.5));\n\tALBEDO = col;\n\tALPHA = arrow * (0.55 + 0.45 * blink);\n}\n"

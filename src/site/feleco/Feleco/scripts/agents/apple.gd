extends Node3D

var _fall_speed: float = 3.0
var _ground_y: float = 0.0
var _landed: bool = false
var _decay: float = 15.0

func _ready() -> void:
	add_to_group("apple")
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.3
	sphere.height = 0.6
	mesh.mesh = sphere
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.95, 0.1, 0.05)
	mesh.material_override = mat
	add_child(mesh)
	# Small collision shape for raycast detection
	var area := Area3D.new()
	var col := CollisionShape3D.new()
	var s := SphereShape3D.new()
	s.radius = 0.4
	col.shape = s
	area.add_child(col)
	area.collision_layer = 2
	area.collision_mask = 0
	add_child(area)

func _process(delta: float) -> void:
	if not _landed:
		position.y -= _fall_speed * delta
		if position.y <= _ground_y:
			position.y = _ground_y
			_landed = true
	else:
		_decay -= delta
		if _decay <= 0.0:
			_spawn_seed()
			queue_free()

func _spawn_seed() -> void:
	if randf() > 0.4:
		return
	var node := get_parent()
	var sim = null
	while node != null:
		if node.has_method("spawn_trees"):
			sim = node
			break
		node = node.get_parent()
	if sim == null:
		return
	var tree = load("res://scenes/tree.tscn").instantiate()
	sim.get_node("Trees").add_child(tree)
	tree.global_position = global_position + Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0)
	if tree.has_method("set_stage"):
		tree.set_stage(0)

func eat() -> float:
	queue_free()
	return 35.0

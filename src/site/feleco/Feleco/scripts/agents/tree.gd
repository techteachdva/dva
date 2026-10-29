extends Node3D

@export var apple_spawn_interval: float = 4.0
@export var apple_drop_height: float = 3.0

var _stage: int = 2  # 0=seed, 1=sapling, 2=tree
var _growth: float = 0.0
var _seed_grow_time: float = 15.0
var _sapling_grow_time: float = 25.0
var _spawn_timer: float = 0.0
var _apple_scene: PackedScene

var _lifespan: float = 180.0
var _dying: bool = false
var _death_timer: float = 0.0
var _arboreal: bool = false

var _trunk_mesh: MeshInstance3D
var _canopy_mesh: MeshInstance3D
var _body: StaticBody3D

func _ready() -> void:
	add_to_group("tree")
	_apple_scene = load("res://scenes/apple.tscn")
	_setup_visuals()

func set_stage(stage: int) -> void:
	_stage = stage
	_growth = 0.0
	_setup_visuals()

func _setup_visuals() -> void:
	# Clear existing
	for c in get_children():
		c.queue_free()
	_trunk_mesh = null
	_canopy_mesh = null
	_body = null

	match _stage:
		0:  # Seed
			var mesh := MeshInstance3D.new()
			var sphere := SphereMesh.new()
			sphere.radius = 0.3
			sphere.height = 0.5
			mesh.mesh = sphere
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.5, 0.35, 0.15)
			mesh.material_override = mat
			add_child(mesh)
		1:  # Sapling
			var mesh := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.height = 1.5
			cyl.top_radius = 0.15
			cyl.bottom_radius = 0.2
			mesh.mesh = cyl
			var mat := StandardMaterial3D.new()
			mat.albedo_color = Color(0.35, 0.55, 0.2)
			mesh.material_override = mat
			mesh.position.y = 0.75
			add_child(mesh)
			# Small static body
			_body = StaticBody3D.new()
			var col := CollisionShape3D.new()
			var box := BoxShape3D.new()
			box.size = Vector3(0.4, 1.5, 0.4)
			col.shape = box
			_body.add_child(col)
			_body.collision_layer = 1
			add_child(_body)
		2:  # Tree
			_trunk_mesh = MeshInstance3D.new()
			var cylinder := CylinderMesh.new()
			cylinder.height = 3.0
			cylinder.top_radius = 0.4
			cylinder.bottom_radius = 0.5
			_trunk_mesh.mesh = cylinder
			var trunk_mat := StandardMaterial3D.new()
			trunk_mat.albedo_color = Color(0.35, 0.22, 0.12)
			_trunk_mesh.material_override = trunk_mat
			_trunk_mesh.position.y = 1.5
			add_child(_trunk_mesh)

			_canopy_mesh = MeshInstance3D.new()
			var cap := SphereMesh.new()
			cap.radius = 2.0
			cap.height = 3.5
			_canopy_mesh.mesh = cap
			var cap_mat := StandardMaterial3D.new()
			cap_mat.albedo_color = Color(0.15, 0.45, 0.12)
			_canopy_mesh.material_override = cap_mat
			_canopy_mesh.position.y = 3.5
			add_child(_canopy_mesh)

			_body = StaticBody3D.new()
			var col2 := CollisionShape3D.new()
			var box2 := BoxShape3D.new()
			box2.size = Vector3(3.0, 5.5, 3.0)
			col2.shape = box2
			_body.add_child(col2)
			_body.collision_layer = 1
			add_child(_body)

func _process(delta: float) -> void:
	if _dying:
		_death_timer += delta
		if _death_timer >= 20.0:
			var parent = get_parent()
			if parent != null:
				var sim = parent.get_parent()
				if sim != null and sim is SimulationDirector:
					var sd := sim as SimulationDirector
					if sd.rot != null:
						sd.rot.add_density_at_world(global_position, 2.0)
			queue_free()
			return
		return
	match _stage:
		0:
			_growth += delta
			if _growth >= _seed_grow_time:
				set_stage(1)
		1:
			_growth += delta
			if _growth >= _sapling_grow_time:
				set_stage(2)
		2:
			_lifespan -= delta
			if _lifespan <= 0.0:
				_dying = true
				_death_timer = 0.0
				return
			_spawn_timer += delta
			if _spawn_timer >= apple_spawn_interval:
				_spawn_timer = 0.0
				_spawn_apple()

func _spawn_apple() -> void:
	if _apple_scene == null:
		return
	var apple = _apple_scene.instantiate()
	add_child(apple)
	apple.position = Vector3((randf() - 0.5) * 1.0, apple_drop_height, (randf() - 0.5) * 1.0)

func mark_arboreal() -> void:
	_arboreal = true

func harvest() -> bool:
	if _arboreal:
		return false
	if _stage == 0:
		return false
	queue_free()
	return true

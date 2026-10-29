class_name MyceliumLayer
extends CALayer

@export var spread_rate: float = 0.5

var _rot_reference: RotLayer = null
var _multimesh: MultiMeshInstance3D = null
var _dirty_cells: PackedByteArray = PackedByteArray()
var _dirty_indices: Array[int] = []

func _ready() -> void:
	super()
	# Attempt to locate sibling RotLayer if present under same parent
	if get_parent() != null:
		for child: Node in get_parent().get_children():
			if child is RotLayer:
				_rot_reference = child
				break
	_dirty_cells.resize(_grid.size())
	_dirty_cells.fill(0)
	_setup_visuals()

# The front advances at most one cell per hop. Hops are taken every
# HOP_SECONDS of the step so it spreads at the same speed however long the
# step is.
const HOP_SECONDS: float = 0.25

func propagate_growth(dt: float) -> void:
	if _rot_reference == null:
		return
	var rot_grid: PackedFloat32Array = _rot_reference._grid
	if rot_grid.size() != _grid.size():
		return
	var hops: int = maxi(1, int(round(dt / HOP_SECONDS)))
	var step: float = dt / float(hops) * spread_rate
	var w := grid_width
	var h := grid_height
	for hop: int in hops:
		var src := _grid.duplicate()
		for gz: int in h:
			var row := gz * w
			for gx: int in w:
				var idx := row + gx
				if rot_grid[idx] <= 0.2:
					continue
				var has_neighbor: bool = (gx > 0 and src[idx - 1] > 0.0) or (gx < w - 1 and src[idx + 1] > 0.0) 					or (gz > 0 and src[idx - w] > 0.0) or (gz < h - 1 and src[idx + w] > 0.0)
				if not has_neighbor:
					continue
				var old_val: float = _grid[idx]
				var new_val: float = minf(old_val + step, max_density)
				_grid[idx] = new_val
				if absf(new_val - old_val) > 0.001:
					_mark_dirty(idx)

func diffuse_step(dt: float) -> void:
	var new_grid := _diffuse(_grid, diffusion_rate * dt, max_density, true, 0.0)
	for i: int in new_grid.size():
		if absf(new_grid[i] - _grid[i]) > 0.0001:
			_mark_dirty(i)
	_grid = new_grid

func _mark_dirty(idx: int) -> void:
	if idx >= 0 and idx < _dirty_cells.size() and _dirty_cells[idx] == 0:
		_dirty_cells[idx] = 1
		_dirty_indices.append(idx)

func _setup_visuals() -> void:
	_multimesh = MultiMeshInstance3D.new()
	_multimesh.name = "MyceliumVisuals"
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _create_cell_mesh()
	mm.instance_count = grid_width * grid_height
	_multimesh.multimesh = mm
	_multimesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_multimesh.material_override = mat
	add_child(_multimesh)
	_update_visuals()

func _create_cell_mesh() -> Mesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(cell_size, cell_size)
	return quad

func _update_visuals() -> void:
	var mm := _multimesh.multimesh
	for i: int in _dirty_indices:
		if _dirty_cells[i] == 0:
			continue
		_dirty_cells[i] = 0
		var gz := int(i / float(grid_width))
		var gx := i % grid_width
		var density := _grid[i]
		var pos := grid_to_world(gx, gz)
		var alpha := clampf(density * 2.0, 0.0, 0.5)
		var color := Color(0.4, 0.15, 0.5, alpha)  # subtle purple
		var scale_factor := clampf(0.2 + density * 1.5, 0.0, 1.0)
		var xf := Transform3D(Basis().scaled(Vector3(scale_factor, 1.0, scale_factor)), pos)
		mm.set_instance_transform(i, xf)
		mm.set_instance_color(i, color)
	_dirty_indices.clear()

func tick(dt: float) -> void:
	propagate_growth(dt)
	diffuse_step(dt)

func flush_visuals() -> void:
	_update_visuals()

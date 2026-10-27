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
	# A new buffer is all zeros, and only cells the fungus has reached are
	# ever written. A zero-scale patch has no normal to light, and the GPU
	# draws thousands of them as raw green and red streaks across the screen
	# the moment the first carcass grows a mat. Every patch starts hidden.
	for i: int in mm.instance_count:
		mm.set_instance_transform(i, HIDDEN_PATCH)
		mm.set_instance_color(i, Color(0, 0, 0, 0))
	_multimesh.multimesh = mm
	_multimesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# A faint, earthy root mat that takes the scene's light (so it dims at
	# night), not a bright decal: it should read as soil, not as scribble.
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	mat.roughness = 1.0
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	mat.render_priority = -2
	var threads := "res://assets/sprites/mycelium.png"
	if ResourceLoader.exists(threads):
		mat.albedo_texture = load(threads)
	else:
		mat.albedo_texture = ImageTexture.create_from_image(SpriteGenerator.mycelium_image())
	_multimesh.material_override = mat
	add_child(_multimesh)
	_update_visuals()

func _create_cell_mesh() -> Mesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(cell_size * 1.8, cell_size * 1.8)
	quad.orientation = PlaneMesh.FACE_Y
	return quad

# Tiny, deep underground and never size zero (see _setup_visuals).
const HIDDEN_PATCH := Transform3D(Basis(Vector3(0.001, 0, 0), Vector3(0, 0.001, 0), Vector3(0, 0, 0.001)), Vector3(0.0, -500.0, 0.0))

# Ground heights per cell, shared from the grass layer once the valley exists.
var heights: PackedFloat32Array = PackedFloat32Array()

func _update_visuals() -> void:
	var mm := _multimesh.multimesh
	for i: int in _dirty_indices:
		if _dirty_cells[i] == 0:
			continue
		_dirty_cells[i] = 0
		var gz := int(i / float(grid_width))
		var gx := i % grid_width
		var density := _grid[i]
		if not is_finite(density):
			density = 0.0
			_grid[i] = 0.0
		if density <= 0.0:
			mm.set_instance_transform(i, HIDDEN_PATCH)
			mm.set_instance_color(i, Color(0, 0, 0, 0))
			continue
		var pos := grid_to_world(gx, gz)
		if heights.size() == _grid.size():
			pos.y = heights[i] + 0.06
		# Pale threads, brighter as the mat thickens; each patch turned its own way.
		var alpha := clampf(density * 1.4, 0.0, 0.32)
		var color := Color(0.82, 0.76, 0.64, alpha)
		var scale_factor := clampf(0.3 + density * 0.9, 0.0, 0.8)
		var turn: float = fmod(float(i) * 2.399, TAU)
		var xf := Transform3D(Basis(Vector3.UP, turn).scaled(Vector3(scale_factor, 1.0, scale_factor)), pos)
		mm.set_instance_transform(i, xf)
		mm.set_instance_color(i, color)
	_dirty_indices.clear()

# 1.0 in autumn or rain, small otherwise; set by the director each step.
var season_factor: float = 1.0

func tick(dt: float) -> void:
	propagate_growth(dt * season_factor)
	diffuse_step(dt)
	# Out of season the mats slowly die back.
	var fade: float = exp(-(1.0 - season_factor) * 0.04 * dt)
	if fade < 0.9999:
		for i: int in _grid.size():
			var v: float = _grid[i]
			if v > 0.0:
				var nv: float = v * fade
				_grid[i] = 0.0 if nv < 0.01 else nv
				_mark_dirty(i)

func flush_visuals() -> void:
	_update_visuals()

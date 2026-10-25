class_name CALayer
extends Node3D

@export var grid_width: int = 64
@export var grid_height: int = 64
@export var cell_size: float = 2.0
@export var max_density: float = 1.0
@export var growth_rate: float = 0.06
@export var diffusion_rate: float = 0.1

var _grid: PackedFloat32Array = PackedFloat32Array()

func _ready() -> void:
	_grid.resize(grid_width * grid_height)
	_grid.fill(0.0)

func world_to_grid(world_pos: Vector3) -> Vector2i:
	var local := world_pos - global_position
	var gx := int(floor(local.x / cell_size + float(grid_width) / 2.0))
	var gz := int(floor(local.z / cell_size + float(grid_height) / 2.0))
	return Vector2i(clampi(gx, 0, grid_width - 1), clampi(gz, 0, grid_height - 1))

func grid_to_world(gx: int, gz: int) -> Vector3:
	var x := (gx - float(grid_width) / 2.0) * cell_size + cell_size * 0.5
	var z := (gz - float(grid_height) / 2.0) * cell_size + cell_size * 0.5
	return global_position + Vector3(x, 0.0, z)

func get_density(gx: int, gz: int) -> float:
	if gx < 0 or gz < 0 or gx >= grid_width or gz >= grid_height:
		return 0.0
	return _grid[gz * grid_width + gx]

func set_density(gx: int, gz: int, value: float) -> void:
	if gx < 0 or gz < 0 or gx >= grid_width or gz >= grid_height:
		return
	_grid[gz * grid_width + gx] = clampf(value, 0.0, max_density)

func add_density(gx: int, gz: int, amount: float) -> void:
	if gx < 0 or gz < 0 or gx >= grid_width or gz >= grid_height:
		return
	var idx := gz * grid_width + gx
	_grid[idx] = clampf(_grid[idx] + amount, 0.0, max_density)

func tick(dt: float) -> void:
	propagate_growth(dt)
	diffuse_step(dt)

func propagate_growth(dt: float) -> void:
	for i: int in range(_grid.size()):
		_grid[i] = clampf(_grid[i] + dt * growth_rate, 0.0, max_density)

func diffuse_step(dt: float) -> void:
	_grid = _diffuse(_grid, diffusion_rate * dt, max_density, false, 0.0)

# Four-neighbour spread with no per-cell allocations. Each cell above `floor`
# sends rate * strength * val / neighbours to each neighbour (only to lower ones
# when downhill_only), capped so no neighbour exceeds cap. strength_lo > 0 makes
# strength ramp from 0 at strength_lo to 1 at strength_lo + 0.35 (patchy grass).
func _diffuse(src: PackedFloat32Array, rate: float, cap: float, downhill_only: bool, strength_lo: float) -> PackedFloat32Array:
	var dst := src.duplicate()
	var w := grid_width
	var h := grid_height
	for gz: int in h:
		var row := gz * w
		for gx: int in w:
			var idx := row + gx
			var val: float = src[idx]
			if val <= 0.0:
				continue
			var strength: float = 1.0
			if strength_lo > 0.0:
				strength = clampf((val - strength_lo) / 0.35, 0.0, 1.0)
				if strength <= 0.0:
					continue
			var n: int = int(gx > 0) + int(gx < w - 1) + int(gz > 0) + int(gz < h - 1)
			var flow: float = val * rate * strength / float(n)
			if gx > 0:
				var j := idx - 1
				if not downhill_only or src[j] < val:
					var f: float = minf(flow, cap - dst[j])
					dst[j] += f
					dst[idx] -= f
			if gx < w - 1:
				var j := idx + 1
				if not downhill_only or src[j] < val:
					var f: float = minf(flow, cap - dst[j])
					dst[j] += f
					dst[idx] -= f
			if gz > 0:
				var j := idx - w
				if not downhill_only or src[j] < val:
					var f: float = minf(flow, cap - dst[j])
					dst[j] += f
					dst[idx] -= f
			if gz < h - 1:
				var j := idx + w
				if not downhill_only or src[j] < val:
					var f: float = minf(flow, cap - dst[j])
					dst[j] += f
					dst[idx] -= f
	return dst

func _neighbor_indices(gx: int, gz: int) -> Array[int]:
	var res: Array[int] = []
	var dirs := [Vector2i(-1, 0), Vector2i(1, 0), Vector2i(0, -1), Vector2i(0, 1)]
	for d: Vector2i in dirs:
		var nx := gx + d.x
		var ny := gz + d.y
		if nx >= 0 and ny >= 0 and nx < grid_width and ny < grid_height:
			res.append(ny * grid_width + nx)
	return res

func add_density_at_world(world_pos: Vector3, amount: float) -> void:
	var g := world_to_grid(world_pos)
	add_density(g.x, g.y, amount)

func consume_density(world_pos: Vector3, amount: float) -> float:
	var g := world_to_grid(world_pos)
	var idx := g.y * grid_width + g.x
	if idx < 0 or idx >= _grid.size():
		return 0.0
	var available: float = _grid[idx]
	var taken: float = minf(available, amount)
	_grid[idx] = available - taken
	return taken

func get_density_at_world(world_pos: Vector3) -> float:
	var g := world_to_grid(world_pos)
	return get_density(g.x, g.y)

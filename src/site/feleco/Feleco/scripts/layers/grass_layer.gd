class_name GrassLayer
extends CALayer

const NUTRIENT_MAX: float = 1.0
const NUTRIENT_GROWTH_COST: float = 3.0

var _multimesh: MultiMeshInstance3D
var _rot_reference: RotLayer = null
var _mycelium_reference: MyceliumLayer = null
var _senesce_threshold: float = 0.75
var _senesce_rate: float = 0.3
var _cell_age: PackedFloat32Array
var _cell_stage: PackedFloat32Array  # 0=seed, 1=sprout, 2=tall, 3=dead
var _nutrients: PackedFloat32Array
var _dirty_cells: PackedByteArray
var _dirty_indices: Array[int] = []
var _soil_exhaustion: float = 0.0
var _season_boost: float = 1.0
var _valley_floor_radius_sq: float = -1.0
var _height_at: Callable = Callable()
var _is_wet: Callable = Callable()
# Cells the valley mask clears (off the floor or under water), and each cell's
# ground height. Both are baked once so ticks never call back into the terrain.
var _masked: PackedByteArray = PackedByteArray()
var _heights: PackedFloat32Array = PackedFloat32Array()

func _ready() -> void:
	super()
	growth_rate = 0.03
	max_density = 0.8
	if get_parent() != null:
		for child: Node in get_parent().get_children():
			if child is RotLayer:
				_rot_reference = child
			if child is MyceliumLayer:
				_mycelium_reference = child
	_cell_age.resize(_grid.size())
	_cell_stage.resize(_grid.size())
	_nutrients.resize(_grid.size())
	_dirty_cells.resize(_grid.size())
	for i: int in range(_grid.size()):
		_cell_age[i] = randf() * 10.0
		_cell_stage[i] = 2.0 if _grid[i] > 0.4 else 1.0 if _grid[i] > 0.15 else 0.0
		_nutrients[i] = clampf(0.25 + randf() * 0.15 + _grid[i] * 0.2, 0.0, NUTRIENT_MAX)
		_mark_dirty(i)
	_setup_visuals()

const TICK_PARTS: int = 4

func tick(dt: float, grazing_pressure: float = 0.0, season_boost: float = 1.0) -> void:
	for part: int in TICK_PARTS:
		tick_part(part, dt, grazing_pressure, season_boost)

# One grass step split into TICK_PARTS pieces so the director can spread it
# over several frames. Run parts 0..TICK_PARTS-1 in order with the same dt.
func tick_part(part: int, dt: float, grazing_pressure: float = 0.0, season_boost: float = 1.0) -> void:
	match part:
		0:
			_season_boost = season_boost
			var total_grass: float = 0.0
			for v: float in _grid:
				total_grass += v
			if total_grass < 400.0:
				_soil_exhaustion = clampf(_soil_exhaustion + dt * 0.5, 0.0, 20.0)
			elif total_grass > 700.0:
				_soil_exhaustion = maxf(_soil_exhaustion - dt * 0.3, 0.0)
			propagate_growth(dt, grazing_pressure, season_boost)
		1:
			diffuse_step(dt)
		2:
			_cell_step(dt)
		3:
			_nutrient_diffuse_step(dt)
			_pollinate(dt)

func flush_visuals() -> void:
	_update_visuals()

func bind_water(is_wet: Callable) -> void:
	_is_wet = is_wet
	_apply_valley_mask()

func bind_valley(floor_radius: float, height_at: Callable) -> void:
	_valley_floor_radius_sq = floor_radius * floor_radius
	_height_at = height_at
	_apply_valley_mask()
	for i: int in range(_grid.size()):
		_mark_dirty(i)
	_update_visuals()

func _apply_valley_mask() -> void:
	if _valley_floor_radius_sq < 0.0 or _cell_stage.is_empty():
		return
	_masked.resize(_grid.size())
	var bake_heights: bool = _heights.size() != _grid.size() and _height_at.is_valid()
	if bake_heights:
		_heights.resize(_grid.size())
	for gz: int in grid_height:
		for gx: int in grid_width:
			var pos := grid_to_world(gx, gz)
			var idx := gz * grid_width + gx
			if bake_heights:
				_heights[idx] = float(_height_at.call(pos.x, pos.z))
			var outside: bool = pos.x * pos.x + pos.z * pos.z > _valley_floor_radius_sq
			var wet: bool = _is_wet.is_valid() and bool(_is_wet.call(pos.x, pos.z))
			_masked[idx] = 1 if outside or wet else 0
			if _masked[idx] == 0:
				continue
			if _grid[idx] == 0.0 and _cell_stage[idx] == 0.0:
				continue
			_grid[idx] = 0.0
			_cell_stage[idx] = 0.0
			_cell_age[idx] = 0.0
			_mark_dirty(idx)

func _mark_dirty(idx: int) -> void:
	if idx >= 0 and idx < _dirty_cells.size() and _dirty_cells[idx] == 0:
		_dirty_cells[idx] = 1
		_dirty_indices.append(idx)

func consume_density(world_pos: Vector3, amount: float) -> float:
	var g := world_to_grid(world_pos)
	var idx := g.y * grid_width + g.x
	if idx >= 0 and idx < _grid.size():
		var stage: int = int(_cell_stage[idx])
		if stage == 0:
			return 0.0  # seeds are inedible
	var eff_amount := amount * 0.5 if int(_cell_stage[idx]) == 1 else amount
	var taken := super.consume_density(world_pos, eff_amount)
	if taken > 0.0:
		if idx >= 0 and idx < _cell_age.size():
			_cell_age[idx] = 0.0
			# Heavy grazing knocks mature grass back to seed, slowing recovery
			if int(_cell_stage[idx]) >= 2 and _grid[idx] < 0.35:
				_cell_stage[idx] = 0.0
			elif int(_cell_stage[idx]) == 1 and _grid[idx] < 0.15:
				_cell_stage[idx] = 0.0
			_mark_dirty(idx)
		# Manure effect: grazers return ~10% of consumed mass as nutrients
		if idx >= 0 and idx < _nutrients.size():
			_nutrients[idx] = clampf(_nutrients[idx] + taken * 0.1, 0.0, NUTRIENT_MAX)
	return taken

func propagate_growth(dt: float, grazing_pressure: float = 0.0, season_boost: float = 1.0) -> void:
	var pressure_factor: float = clampf(1.0 - grazing_pressure * 3.0, 0.05, 1.0)
	var exhaustion_factor: float = clampf(1.0 - _soil_exhaustion / 20.0, 0.0, 1.0)
	for i: int in range(_grid.size()):
		var old_val: float = _grid[i]
		var stage: int = int(_cell_stage[i])
		var factor: float = 0.06 if stage == 0 else 0.35 if stage == 1 else 1.0
		var nutrient_factor: float = clampf(_nutrients[i] / 0.5, 0.0, 1.0)
		# Spring surge: cells near tall grass get a recovery boost
		var spring_surge: float = 1.0
		if season_boost > 1.2 and stage < 2:
			var gz: int = i / grid_width
			var gx: int = i - gz * grid_width
			var l: int = i - 1 if gx > 0 else i
			var r: int = i + 1 if gx < grid_width - 1 else i
			var u: int = i - grid_width if gz > 0 else i
			var d: int = i + grid_width if gz < grid_height - 1 else i
			if (_cell_stage[l] == 2.0 and _grid[l] > 0.3) or (_cell_stage[r] == 2.0 and _grid[r] > 0.3) \
					or (_cell_stage[u] == 2.0 and _grid[u] > 0.3) or (_cell_stage[d] == 2.0 and _grid[d] > 0.3):
				spring_surge = 2.5
		var growth_increment: float = dt * growth_rate * factor * old_val * (1.0 - old_val / max_density) * nutrient_factor * pressure_factor * exhaustion_factor * season_boost * spring_surge
		if growth_increment > 0.0001:
			_grid[i] = clampf(old_val + growth_increment, 0.0, max_density)
			_nutrients[i] = maxf(_nutrients[i] - growth_increment * NUTRIENT_GROWTH_COST, 0.0)
			_mark_dirty(i)
		elif grazing_pressure > 0.15 and old_val > 0.01:
			# Overgrazing destroys grass directly
			var trample: float = dt * 0.15 * grazing_pressure * old_val
			_grid[i] = maxf(old_val - trample, 0.0)
			_mark_dirty(i)

func diffuse_step(dt: float) -> void:
	# Patchy diffusion: only dense clumps spread; sparse grass stays put
	var new_grid := _diffuse(_grid, diffusion_rate * dt, max_density, true, 0.15)
	for i: int in new_grid.size():
		if absf(new_grid[i] - _grid[i]) > 0.0001:
			_mark_dirty(i)
	_grid = new_grid

# Every per-cell rule in one pass, in the order the separate passes ran:
# age, lifecycle, senesce, winter kill, mycelium suppression, nutrients, valley mask.
# Each rule reads and writes only its own cell, so fusing keeps the results.
func _cell_step(dt: float) -> void:
	var rot_ref := _rot_reference
	var myc_ref := _mycelium_reference
	var rot_grid: PackedFloat32Array = rot_ref._grid if rot_ref != null else PackedFloat32Array()
	var myc_grid: PackedFloat32Array = myc_ref._grid if myc_ref != null else PackedFloat32Array()
	var same_rot: bool = rot_grid.size() == _grid.size()
	var has_myc: bool = myc_grid.size() == _grid.size()
	var threshold := max_density * _senesce_threshold
	var winter: bool = _season_boost < 0.5 and rot_ref != null
	# 200% per second as continuous decay, so the step size doesn't matter.
	var winter_frac: float = 1.0 - exp(-2.0 * dt)
	var has_mask: bool = _masked.size() == _grid.size()
	var w := grid_width
	for idx: int in _grid.size():
		var density: float = _grid[idx]
		var age: float = _cell_age[idx] + dt
		var stage: float = _cell_stage[idx]
		var dirty := false
		var rot_add: float = 0.0
		# lifecycle: seed -> sprout -> tall
		if stage == 0.0:
			if density > 0.10 and age > 6.0:
				stage = 1.0
				age = 0.0
				dirty = true
		elif stage == 1.0:
			if density > 0.25 and age > 6.0:
				stage = 2.0
				age = 0.0
				dirty = true
		# senesce: only tall grass dies; seeds and sprouts are immortal
		if rot_ref != null:
			if stage == 2.0 and (density > threshold or age > 45.0):
				var excess := density - threshold if density > threshold else density * 0.3
				var death := excess * _senesce_rate * dt
				if age > 45.0:
					death = maxf(death, density * (1.0 - exp(-0.8 * dt)))
				death = minf(death, density)
				density -= death
				age = 0.0
				# Enter dead stage instead of reverting immediately to seed
				stage = 3.0
				dirty = true
				rot_add += death * 0.9
				_nutrients[idx] = clampf(_nutrients[idx] + death * 0.1, 0.0, NUTRIENT_MAX)
			elif stage == 3.0 and age > 12.0:
				# Dead grass finally rots away to bare soil (seed stage)
				var old_density := density
				density = old_density * exp(-0.5 * dt)
				if density < 0.05:
					stage = 0.0
					age = 0.0
				dirty = true
				rot_add += old_density - density
		# winter mass die-off
		if winter and stage == 2.0 and density > 0.0:
			var wdeath := density * winter_frac
			density -= wdeath
			age = 0.0
			stage = 3.0
			dirty = true
			rot_add += wdeath * 0.9
		if rot_add > 0.0:
			if same_rot:
				rot_grid[idx] = clampf(rot_grid[idx] + rot_add, 0.0, rot_ref.max_density)
			else:
				var gz: int = idx / w
				rot_ref.add_density_at_world(grid_to_world(idx - gz * w, gz), rot_add)
		# mycelium suppression, then nutrients from rot and mycelium
		var myc: float = myc_grid[idx] if has_myc else 0.0
		if myc > 0.1:
			var kill := density * (1.0 - exp(-myc * 2.0 * dt))
			if kill > 0.0001:
				density -= kill
				dirty = true
			if density < 0.1:
				stage = 0.0
				age = 0.0
				dirty = true
		if rot_ref != null and has_myc:
			var rot_v: float = rot_grid[idx] if same_rot else 0.0
			_nutrients[idx] = clampf(_nutrients[idx] + rot_v * 0.08 * dt + myc * 0.03 * dt + 0.001 * dt, 0.0, NUTRIENT_MAX)
		# valley mask: nothing grows off the floor or under the river
		if has_mask and _masked[idx] == 1 and (density != 0.0 or stage != 0.0):
			density = 0.0
			stage = 0.0
			age = 0.0
			dirty = true
		_grid[idx] = density
		_cell_age[idx] = age
		_cell_stage[idx] = stage
		if dirty:
			_mark_dirty(idx)
	if same_rot:
		rot_ref._grid = rot_grid

func _nutrient_diffuse_step(dt: float) -> void:
	_nutrients = _diffuse(_nutrients, 0.05 * dt, NUTRIENT_MAX, true, 0.0)

func _pollinate(_dt: float) -> void:
	if randf() > 0.02:
		return
	var gx := randi() % grid_width
	var gz := randi() % grid_height
	var idx := gz * grid_width + gx
	if _grid[idx] < 0.35 or int(_cell_stage[idx]) == 3:
		return
	var tx := clampi(gx + (randi() % 20 - 10), 0, grid_width - 1)
	var tz := clampi(gz + (randi() % 20 - 10), 0, grid_height - 1)
	var tidx := tz * grid_width + tx
	if _grid[tidx] < 0.15:
		_grid[tidx] = clampf(_grid[tidx] + 0.08, 0.0, max_density)
		_cell_age[tidx] = 0.0
		_cell_stage[tidx] = 0.0
		_mark_dirty(tidx)
		var nutrient_xfer: float = _nutrients[idx] * 0.05
		_nutrients[tidx] = clampf(_nutrients[tidx] + nutrient_xfer, 0.0, NUTRIENT_MAX)
		_nutrients[idx] = maxf(_nutrients[idx] - nutrient_xfer, 0.0)

func _setup_visuals() -> void:
	_multimesh = MultiMeshInstance3D.new()
	_multimesh.name = "GrassVisuals"
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _create_blade_mesh()
	mm.instance_count = grid_width * grid_height
	_multimesh.multimesh = mm
	_multimesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.params_billboard_mode = StandardMaterial3D.BILLBOARD_ENABLED
	mat.params_billboard_keep_scale = true
	_multimesh.material_override = mat
	add_child(_multimesh)
	_update_visuals()

func _create_blade_mesh() -> Mesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(0.6, 1.2)
	return quad

func _update_visuals() -> void:
	var mm := _multimesh.multimesh
	for i: int in _dirty_indices:
		if _dirty_cells[i] == 0:
			continue
		_dirty_cells[i] = 0
		var gz: int = i / grid_width
		var gx: int = i - gz * grid_width
		var density := _grid[i]
		var stage: int = int(_cell_stage[i])
		var pos := grid_to_world(gx, gz)
		if _heights.size() == _grid.size():
			pos.y = _heights[i]
		var scale_y := 0.0
		var color := Color.BLACK
		match stage:
			0:  # seed
				scale_y = clampf(0.05 + density * 0.3, 0.02, 0.2)
				color = Color(0.7, 0.6, 0.2)  # yellowish
			1:  # sprout
				scale_y = clampf(0.1 + density * 1.2, 0.05, 0.8)
				color = Color(0.2, 0.7, 0.15)  # bright green
			2:  # tall
				scale_y = clampf(0.2 + density * 2.5, 0.1, 2.5)
				var brightness := 0.3 + density * 0.6
				var green := Color(0.1 * brightness, 0.55 * brightness, 0.08 * brightness)
				var brown := Color(0.45 * brightness, 0.40 * brightness, 0.35 * brightness)
				var t := clampf((density - max_density * 0.6) / (max_density * 0.4), 0.0, 1.0)
				color = green.lerp(brown, t)
			3:  # dead
				scale_y = clampf(0.05 + density * 0.4, 0.02, 0.25)
				var dead_brown := 0.25 + density * 0.3
				color = Color(0.4 * dead_brown, 0.25 * dead_brown, 0.12 * dead_brown)
		var xf := Transform3D(Basis().scaled(Vector3(1.0, scale_y, 1.0)), pos)
		mm.set_instance_transform(i, xf)
		mm.set_instance_color(i, color)
	_dirty_indices.clear()

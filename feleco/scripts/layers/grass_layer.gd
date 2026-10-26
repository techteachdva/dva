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
# 3.0 grass kinds per cell: meadow, clover (rich, low), rye (tall, thin),
# golden (rare, very rich). Kinds grow in patches and seed their own kind.
enum Kind { MEADOW, CLOVER, RYE, GOLDEN }
const KIND_VALUE: Array[float] = [1.0, 1.5, 0.8, 3.0]
const KIND_HEIGHT: Array[float] = [1.0, 0.6, 1.5, 1.15]
const KIND_WIDTH: Array[float] = [1.0, 1.35, 0.75, 1.05]
const KIND_LUSH: Array[Color] = [Color(0.36, 0.64, 0.22), Color(0.22, 0.5, 0.24), Color(0.55, 0.66, 0.3), Color(0.95, 0.78, 0.22)]
var _cell_kind: PackedByteArray
# Golden Year and Green Thumb raise this.
var golden_mult: float = 1.0
const GOLDEN_SEED_CHANCE: float = 0.0015
# Gold stays rare: never more than this share of the meadow is golden.
const GOLDEN_CAP: float = 0.05

func _golden_room() -> bool:
	return _cell_kind.count(Kind.GOLDEN) < int(_cell_kind.size() * GOLDEN_CAP)
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
	growth_rate = 0.07
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
	_cell_kind.resize(_grid.size())
	for i: int in range(_grid.size()):
		_cell_kind[i] = _starting_kind(i)
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
			# Thresholds scale with the meadow that can actually grow (the
			# valley mask removes most of the grid).
			var cap: float = float(maxi(_usable_cells, 1)) * max_density
			if total_grass < cap * 0.12:
				_soil_exhaustion = clampf(_soil_exhaustion + dt * 0.5, 0.0, 20.0)
			elif total_grass > cap * 0.3:
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
	var usable: int = 0
	var fresh: bool = _masked.size() != _grid.size()
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
			# A ragged edge, not a ruled circle: the meadow thins out over a few
			# metres and reaches a little way up the foothills here and there.
			var edge: float = sqrt(_valley_floor_radius_sq) + 3.0 + 3.5 * sin(float(gx) * 1.7 + float(gz) * 0.6) * cos(float(gz) * 1.3 - float(gx) * 0.4)
			var outside: bool = pos.x * pos.x + pos.z * pos.z > edge * edge
			var wet: bool = _is_wet.is_valid() and bool(_is_wet.call(pos.x, pos.z))
			var m: int = 1 if outside or wet else 0
			if fresh or _masked[idx] != m:
				_masked[idx] = m
				_mark_dirty(idx)
			if m == 0:
				usable += 1
			if _masked[idx] == 0:
				continue
			if _grid[idx] == 0.0 and _cell_stage[idx] == 0.0:
				continue
			_grid[idx] = 0.0
			_cell_stage[idx] = 0.0
			_cell_age[idx] = 0.0
			_mark_dirty(idx)
	_usable_cells = usable

var _usable_cells: int = 0

func _mark_dirty(idx: int) -> void:
	if idx >= 0 and idx < _dirty_cells.size() and _dirty_cells[idx] == 0:
		_dirty_cells[idx] = 1
		_dirty_indices.append(idx)

# What a grazer can actually eat here: seed is nothing, sprouts are half.
func edible_at_world(world_pos: Vector3) -> float:
	var g := world_to_grid(world_pos)
	var idx := g.y * grid_width + g.x
	if idx < 0 or idx >= _grid.size():
		return 0.0
	var stage: int = int(_cell_stage[idx])
	if stage == 0:
		return 0.0
	return _grid[idx] * (0.5 if stage == 1 else 1.0)

func _starting_kind(i: int) -> int:
	# Coarse hashed patches so clover and rye come in drifts, not speckles.
	var gz: int = i / grid_width
	var gx: int = i - gz * grid_width
	var patch: float = _hash(int(gx / 5) * 131 + int(gz / 5), 7.0)
	if _hash(i, 9.0) < GOLDEN_SEED_CHANCE * golden_mult:
		return Kind.GOLDEN
	if patch < 0.18:
		return Kind.CLOVER
	if patch > 0.84:
		return Kind.RYE
	return Kind.MEADOW

func kind_at_world(world_pos: Vector3) -> int:
	var g := world_to_grid(world_pos)
	var idx := g.y * grid_width + g.x
	return _cell_kind[idx] if idx >= 0 and idx < _cell_kind.size() else Kind.MEADOW

# Like consume_density, but also says how good the mouthful was:
# Vector2(amount taken, food value multiplier for this grass kind).
func consume_food(world_pos: Vector3, amount: float, eater: Node = null) -> Vector2:
	var kind: int = kind_at_world(world_pos)
	var taken := consume_density(world_pos, amount, eater)
	if taken > 0.0 and kind == Kind.GOLDEN:
		# A golden tuft grazed bare grows back as plain meadow.
		var g := world_to_grid(world_pos)
		var idx := g.y * grid_width + g.x
		if idx >= 0 and idx < _grid.size() and _grid[idx] < 0.1:
			_cell_kind[idx] = Kind.MEADOW
	return Vector2(taken, KIND_VALUE[kind])

# Golden soil from a golden carcass: the cell (and maybe a neighbour) turns golden.
func seed_golden(world_pos: Vector3, strength: float) -> void:
	var g := world_to_grid(world_pos)
	for k: int in 1:
		var idx := clampi(g.y + k * (randi() % 3 - 1), 0, grid_height - 1) * grid_width + clampi(g.x + k * (randi() % 3 - 1), 0, grid_width - 1)
		if randf() < 0.1 + strength * 0.2 and _golden_room():
			_cell_kind[idx] = Kind.GOLDEN
			_mark_dirty(idx)

func consume_density(world_pos: Vector3, amount: float, eater: Node = null) -> float:
	var g := world_to_grid(world_pos)
	var idx := g.y * grid_width + g.x
	# Eating golden grass makes the grazer golden.
	if eater != null and idx >= 0 and idx < _cell_kind.size() and _cell_kind[idx] == Kind.GOLDEN and int(_cell_stage[idx]) >= 1 and eater.has_method("make_golden"):
		eater.make_golden(1.0, "grass")
	if idx >= 0 and idx < _grid.size():
		var stage: int = int(_cell_stage[idx])
		if stage == 0:
			return 0.0  # seeds are inedible
	var eff_amount := amount * 0.5 if int(_cell_stage[idx]) == 1 else amount
	var taken := super.consume_density(world_pos, eff_amount)
	if taken > 0.0:
		if idx >= 0 and idx < _cell_age.size():
			_cell_age[idx] = 0.0
			# Grazing a patch bare knocks it back to seed, slowing recovery.
			# (At 0.35 a single bite reset most tall grass, so flocks starved
			# walking between patches.)
			if int(_cell_stage[idx]) >= 2 and _grid[idx] < 0.1:
				_cell_stage[idx] = 0.0
			elif int(_cell_stage[idx]) == 1 and _grid[idx] < 0.05:
				_cell_stage[idx] = 0.0
			_mark_dirty(idx)
		# Manure effect: grazers return ~10% of consumed mass as nutrients
		if idx >= 0 and idx < _nutrients.size():
			_nutrients[idx] = clampf(_nutrients[idx] + taken * 0.1, 0.0, NUTRIENT_MAX)
	return taken

func propagate_growth(dt: float, grazing_pressure: float = 0.0, season_boost: float = 1.0) -> void:
	var pressure_factor: float = clampf(1.0 - grazing_pressure * 3.0, 0.05, 1.0)
	var exhaustion_factor: float = clampf(1.0 - _soil_exhaustion / 20.0 * 0.65, 0.35, 1.0)
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
	# Frost thins the tall grass over the winter instead of killing it overnight,
	# so grazers face a lean season rather than a bare one.
	var winter_frac: float = 1.0 - exp(-0.06 * dt)
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
		# Nutrients from rot, and from mycelium, which carries them to the roots.
		var myc: float = myc_grid[idx] if has_myc else 0.0
		if rot_ref != null and has_myc:
			var rot_v: float = rot_grid[idx] if same_rot else 0.0
			_nutrients[idx] = clampf(_nutrients[idx] + rot_v * 0.08 * dt + myc * 0.15 * dt + 0.001 * dt, 0.0, NUTRIENT_MAX)
		# Mycelium wakes dormant seed in the soil above it.
		if myc > 0.1 and stage == 0.0 and density < 0.12:
			density = minf(density + myc * 0.04 * dt, max_density)
			dirty = true
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
		# Seed carries its parent's kind; golden seed rarely breeds true.
		var k: int = _cell_kind[idx]
		if k == Kind.GOLDEN and randf() > 0.05:
			k = Kind.MEADOW
		elif randf() < GOLDEN_SEED_CHANCE * golden_mult * 4.0 and _golden_room():
			k = Kind.GOLDEN
		_cell_kind[tidx] = k
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
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	mat.alpha_scissor_threshold = 0.4
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var tuft_path := "res://assets/sprites/tuft.png"
	if ResourceLoader.exists(tuft_path):
		mat.albedo_texture = load(tuft_path)
	else:
		mat.albedo_texture = ImageTexture.create_from_image(SpriteGenerator.tuft_image())
	mat.params_billboard_mode = StandardMaterial3D.BILLBOARD_ENABLED
	mat.params_billboard_keep_scale = true
	_multimesh.material_override = mat
	add_child(_multimesh)
	_update_visuals()

func _create_blade_mesh() -> Mesh:
	var quad := QuadMesh.new()
	quad.size = Vector2(1.7, 1.4)
	# Pivot at the base so scaling grows the tuft up out of the soil.
	quad.center_offset = Vector3(0.0, 0.7, 0.0)
	return quad

# Season colour for the meadow; the director sets it when the season turns.
var tint: Color = Color.WHITE

func set_tint(c: Color) -> void:
	if c == tint:
		return
	tint = c
	for i: int in range(_grid.size()):
		_mark_dirty(i)

static func _hash(i: int, salt: float) -> float:
	var v: float = sin(float(i) * 12.9898 + salt * 78.233) * 43758.5453
	return v - floor(v)

func _update_visuals() -> void:
	var mm := _multimesh.multimesh
	var has_mask: bool = _masked.size() == _grid.size()
	var has_heights: bool = _heights.size() == _grid.size()
	for i: int in _dirty_indices:
		if _dirty_cells[i] == 0:
			continue
		_dirty_cells[i] = 0
		var gz: int = i / grid_width
		var gx: int = i - gz * grid_width
		if has_mask and _masked[i] == 1:
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), Vector3.ZERO))
			continue
		var density := _grid[i]
		var stage: int = int(_cell_stage[i])
		var pos := grid_to_world(gx, gz)
		# Break up the grid: every cell's tuft sits at its own spot.
		pos.x += (_hash(i, 1.0) - 0.5) * cell_size * 0.8
		pos.z += (_hash(i, 2.0) - 0.5) * cell_size * 0.8
		if has_heights:
			pos.y = _heights[i] - 0.05
		var jitter: float = _hash(i, 3.0)
		var kind: int = _cell_kind[i] if i < _cell_kind.size() else Kind.MEADOW
		var h := 0.0
		var w := 1.0
		var color := Color.BLACK
		match stage:
			0:  # seed
				h = clampf(0.12 + density * 0.3, 0.1, 0.25)
				w = 0.6
				color = Color(0.66, 0.6, 0.34)
			1:  # sprout
				h = clampf(0.3 + density * 0.9, 0.3, 0.8)
				w = 0.8
				color = Color(0.5, 0.8, 0.3).lerp(Color(0.42, 0.72, 0.26), jitter)
			2:  # tall
				h = clampf(0.55 + density * 1.1, 0.55, 1.5) * KIND_HEIGHT[kind]
				w = (1.0 + density * 0.35) * KIND_WIDTH[kind]
				var lush := KIND_LUSH[kind].lerp(KIND_LUSH[kind].lightened(0.15), jitter)
				var ripe := Color(0.74, 0.7, 0.34)
				var t := clampf((density - max_density * 0.6) / (max_density * 0.4), 0.0, 1.0)
				color = lush if kind == Kind.GOLDEN else lush.lerp(ripe, t * 0.8)
			3:  # dead
				h = clampf(0.25 + density * 0.4, 0.2, 0.55)
				w = 0.9
				color = Color(0.52, 0.4, 0.24).lerp(Color(0.44, 0.33, 0.2), jitter)
		if kind != Kind.GOLDEN or stage != 2:
			color = Color(color.r * tint.r, color.g * tint.g, color.b * tint.b) * (0.92 + jitter * 0.16)
		else:
			# Golden grass ignores the season tint and glows a little.
			color = color * 1.25
		color.a = 1.0
		var xf := Transform3D(Basis().scaled(Vector3(w, h, 1.0)), pos)
		mm.set_instance_transform(i, xf)
		mm.set_instance_color(i, color)
	_dirty_indices.clear()

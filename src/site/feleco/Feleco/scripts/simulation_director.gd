class_name SimulationDirector
extends Node3D

signal population_changed(faction: String, count: int)
signal time_updated(days_remaining: float)
signal simulation_ended(winner: String)
signal agent_born(species: String, pos: Vector3, variant: String)
signal agent_died(species: String, pos: Vector3)
signal combat_event(attacker_species: String, target_species: String, pos: Vector3, killed: bool)
signal settlement_built(pos: Vector3)
signal extinction_event(species: String)
signal overpopulation_event(species: String)

var scent_network: NetworkGraph = NetworkGraph.new()
var grass: GrassLayer
var rot: RotLayer
var mycelium: MyceliumLayer

# Configuration (set by setup UI before simulation starts)
var cfg_sheep: int = 10
var cfg_wolves: int = 3
var cfg_humans: int = 5
var cfg_spores: int = 5
var cfg_falcons: int = 3
var cfg_robins: int = 8
var cfg_boars: int = 5
var cfg_worms: int = 15
var cfg_rabbits: int = 8
var cfg_fish: int = 12
var cfg_trees: int = 6
var cfg_bet: String = ""
var cfg_grass_density: float = 0.5
var cfg_time_limit: float = 120.0
var cfg_preset: String = "Random Scatter"

# Runtime tracking
var _elapsed: float = 0.0
var _sim_day: float = 0.0
const DAYS_PER_SECOND: float = 1.0
var _active_sheep: Array = []
var _active_wolves: Array = []
var _active_humans: Array = []
var _active_spores: Array = []
var _active_falcons: Array = []
var _active_robins: Array = []
var _active_boars: Array = []
var _active_worms: Array = []
var _active_rabbits: Array = []
var _active_fish: Array = []
var _active_shelters: Array[Node3D] = []

# Spatial hash for O(1) agent queries
const SPATIAL_CELL_SIZE: float = 10.0
var _spatial_grid: Dictionary = {}
var _spatial_tick_accum: float = 0.0
var _overpop_timer: float = 0.0
var _arborist_timer: float = 0.0
var _scent_prune_accum: float = 0.0
const SCENT_STEP: float = 0.1
var _scent_step_accum: float = 0.0
var _scent_emitters: Array[ScentEmitter] = []
var _time_emit_accum: float = 0.0
var _last_population_counts: Dictionary = {}

# Euler's constant (e) appears naturally in the logistic sigmoid and exponential decay.
# These carrying capacities define the inflection point of the density-dependent mortality curve.
const CARRYING_CAPACITY: Dictionary = {
	"sheep": 300,
	"wolf": 80,
	"human": 60,
	"spore": 150,
	"falcon": 70,
	"robin": 120,
	"boar": 60,
	"worm": 200,
	"rabbit": 150,
}
# Overpopulation mortality is modeled with a logistic sigmoid:
# mortality_rate = max_mortality / (1 + exp(-steepness * (population - midpoint)))
# where midpoint = capacity * 1.3 (mortality kicks in 30% above carrying capacity)
const OVERPOP_STEEPNESS: float = 0.015
const OVERPOP_MAX_MORTALITY: float = 0.25
const CA_PERIOD: int = GrassLayer.TICK_PARTS + 4
const CA_CYCLE: float = 1.0
var _ca_accum: float = 0.0
var _ca_dt: float = CA_CYCLE
var _ca_phase: int = 0
var _last_extinction_state: Dictionary = {}
var _last_overpop_state: Dictionary = {}

# Seasonal cycle: 30 days per season
var _season_day: float = 0.0
var _current_season: String = "Spring"
const SEASON_LENGTH: float = 30.0
const SEASONS: Array[String] = ["Spring", "Summer", "Autumn", "Winter"]
var _season_index: int = 0
var _season_grass: float = 1.5
var _grass_boost: float = 1.0
var _metabolism_mult: float = 1.0
var touches_left: int = 1
var valley: ValleyTerrain = null
var last_holds: Dictionary = {}

# Hold is population / what that species can carry. Raw headcount made
# rabbits and sheep the only serious bets. These match CARRYING_CAPACITY.
const HOLD_CAPACITY: Dictionary = {
	"sheep": 300.0,
	"wolves": 80.0,
	"humans": 60.0,
	"falcons": 70.0,
	"robins": 120.0,
	"boars": 60.0,
	"rabbits": 150.0,
	"worms": 200.0,
	"fish": 60.0,
}
const HOLD_ORDER: Array[String] = ["sheep", "wolves", "humans", "falcons", "robins", "boars", "rabbits", "worms", "fish"]
const MIGRANT_COUNTS: Dictionary = {
	"sheep": 4,
	"wolves": 2,
	"rabbits": 3,
	"humans": 2,
	"falcons": 2,
	"boars": 2,
	"robins": 3,
	"fish": 4,
}
const MIGRATION_WAIT_DAYS: float = 20.0
const MIGRATION_CHANCE: float = 0.18
var _ever_lived: Dictionary = {}
var _extinct_since: Dictionary = {}
var _migration_lock_until: Dictionary = {}

# Presence grid: coarse occupancy for O(1) vision queries
const PRESENCE_CELL_SIZE: float = 5.0
# Per-species counts: slot (from _presence_slots) * PRESENCE_N^2 + cell.
var _presence_slots: Dictionary = {}
var _presence_counts: PackedInt32Array = PackedInt32Array()
const PRESENCE_N: int = 26
const PRESENCE_HALF: int = 13
const PRESENCE_EVERY: int = 3
var _presence_tick: int = 0

# Crowding field: density per cell for batch separation
var _crowd_grid: PackedInt32Array = PackedInt32Array()

# ECS AgentData registry: flat array of all agent simulation records
var _agent_registry: Array[AgentData] = []

# Phase 5 visual decoupling: species-scoped MultiMesh renderer
var _visual_proxy_manager: VisualProxyManager = null

# Stagger agent AI so only 1/STAGGER_FRAMES of agents tick per frame
const STAGGER_FRAMES: int = 6
const AGENTS_PER_FRAME: float = 16.0
const SPORE_STAGGER_FRAMES: int = 10
# On a machine already at the slowest sim rate, animals think about 1.5x a
# second instead of 2.5x; their sprites still glide between thoughts.
const STRUGGLING_STAGGER_FRAMES: int = 10
const SPORES_PER_FRAME: float = 5.0
var _spore_stagger: int = SPORE_STAGGER_FRAMES
var _spore_phase: int = 0
var _stagger: int = STAGGER_FRAMES
var _tick_phase: int = 0

var _corpse_scene: PackedScene
var _spore_scene: PackedScene
var _sheep_scene: PackedScene
var _wolf_scene: PackedScene
var _human_scene: PackedScene
var _tree_scene: PackedScene
var _falcon_scene: PackedScene
var _robin_scene: PackedScene
var _boar_scene: PackedScene
var _worm_scene: PackedScene
var _rabbit_scene: PackedScene
var _fish_scene: PackedScene

# Phase 5.5: Spawn-side node pools to reduce instantiate() overhead
var _sheep_pool: NodePool = null
var _wolf_pool: NodePool = null
var _human_pool: NodePool = null
var _falcon_pool: NodePool = null
var _robin_pool: NodePool = null
var _boar_pool: NodePool = null
var _worm_pool: NodePool = null
var _rabbit_pool: NodePool = null
var _fish_pool: NodePool = null
const POOL_SIZE: int = 40

var _headless_mode: bool = false
var _log_timer: float = 0.0
var _run_timer: float = 0.0
const HEADLESS_LOG_PATH: String = "user://sim_log.csv"
const HEADLESS_RUN_LIMIT: float = 180.0
var _simulation_ended: bool = false

# Cloning Vat: one-time respawn of bet species if they go extinct mid-run
var _cloning_vat_used: bool = false

# Human Settlement Alliance: unique ID counter for new settlements
var _next_settlement_id: int = 1

# Population history for results graph: array of {time, sheep, wolves, humans, falcons, robins, boars, worms}
var _population_history: Array[Dictionary] = []
var _history_sample_timer: float = 0.0
const HISTORY_SAMPLE_INTERVAL: float = 2.0

func _ready() -> void:
	_headless_mode = DisplayServer.get_name() == "headless"
	if _headless_mode:
		# Ensure defaults are set for standalone runs
		cfg_sheep = 30
		cfg_wolves = 8
		cfg_humans = 10
		cfg_spores = 5
		cfg_falcons = 6
		cfg_robins = 8
		cfg_boars = 8
		cfg_worms = 10
		cfg_rabbits = 10
		cfg_fish = 12
		cfg_trees = 6
		cfg_grass_density = 0.5
		cfg_time_limit = 120.0
		# Write CSV header
		var file := FileAccess.open(HEADLESS_LOG_PATH, FileAccess.WRITE)
		if file != null:
			file.store_line("time,sheep,wolves,humans,falcons,robins,boars,rabbits,grass_sum")
			file.close()

	_corpse_scene = load("res://scenes/corpse.tscn")
	_spore_scene = load("res://scenes/mushroom_spore.tscn")
	_sheep_scene = load("res://scenes/sheep.tscn")
	_wolf_scene = load("res://scenes/wolf.tscn")
	_human_scene = load("res://scenes/human.tscn")
	_tree_scene = load("res://scenes/tree.tscn")
	_falcon_scene = load("res://scenes/falcon.tscn")
	_robin_scene = load("res://scenes/robin.tscn")
	_boar_scene = load("res://scenes/boar.tscn")
	_worm_scene = load("res://scenes/worm.tscn")
	_rabbit_scene = load("res://scenes/rabbit.tscn")
	_fish_scene = load("res://scenes/fish.tscn")

	# Phase 5.5: Pre-warm spawn-side node pools
	_sheep_pool = NodePool.new(_sheep_scene, "sheep", POOL_SIZE)
	_wolf_pool = NodePool.new(_wolf_scene, "wolf", POOL_SIZE)
	_human_pool = NodePool.new(_human_scene, "human", POOL_SIZE)
	_falcon_pool = NodePool.new(_falcon_scene, "falcon", POOL_SIZE)
	_robin_pool = NodePool.new(_robin_scene, "robin", POOL_SIZE)
	_boar_pool = NodePool.new(_boar_scene, "boar", POOL_SIZE)
	_worm_pool = NodePool.new(_worm_scene, "worm", POOL_SIZE)
	_rabbit_pool = NodePool.new(_rabbit_scene, "rabbit", POOL_SIZE)
	_fish_pool = NodePool.new(_fish_scene, "fish", POOL_SIZE)
	_sheep_pool.pre_warm(mini(cfg_sheep, POOL_SIZE))
	_wolf_pool.pre_warm(mini(cfg_wolves, POOL_SIZE))
	_human_pool.pre_warm(mini(cfg_humans, POOL_SIZE))
	_falcon_pool.pre_warm(mini(cfg_falcons, POOL_SIZE))
	_robin_pool.pre_warm(mini(cfg_robins, POOL_SIZE))
	_boar_pool.pre_warm(mini(cfg_boars, POOL_SIZE))
	_worm_pool.pre_warm(mini(cfg_worms, POOL_SIZE))
	_rabbit_pool.pre_warm(mini(cfg_rabbits, POOL_SIZE))
	_fish_pool.pre_warm(mini(cfg_fish, POOL_SIZE))

	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null and not _headless_mode:
		cfg_sheep = gc.sheep_count
		cfg_wolves = gc.wolf_count
		cfg_humans = gc.human_count
		cfg_spores = gc.spore_count
		cfg_falcons = gc.falcon_count
		cfg_robins = gc.robin_count
		cfg_boars = gc.boar_count
		cfg_worms = gc.worm_count
		cfg_rabbits = gc.rabbit_count
		cfg_fish = gc.fish_count
		cfg_trees = gc.tree_count
		cfg_bet = gc.player_bet
		cfg_grass_density = gc.grass_density
		cfg_time_limit = gc.time_limit
		cfg_preset = gc.map_preset

	# Suppress UNUSED_SIGNAL warnings by referencing signals in this class
	agent_died.connect(func(_s, _p): pass)
	combat_event.connect(func(_a, _t, _p, _k): pass)

	if has_node("GrassLayer"):
		grass = $GrassLayer as GrassLayer
	else:
		grass = GrassLayer.new()
		grass.name = "GrassLayer"
		add_child(grass)

	if has_node("RotLayer"):
		rot = $RotLayer as RotLayer
	else:
		rot = RotLayer.new()
		rot.name = "RotLayer"
		add_child(rot)

	if has_node("MyceliumLayer"):
		mycelium = $MyceliumLayer as MyceliumLayer
	else:
		mycelium = MyceliumLayer.new()
		mycelium.name = "MyceliumLayer"
		add_child(mycelium)

	if not has_node("Agents"):
		var agents := Node3D.new()
		agents.name = "Agents"
		add_child(agents)
	if not has_node("Corpses"):
		var corpses := Node3D.new()
		corpses.name = "Corpses"
		add_child(corpses)
	if not has_node("Spores"):
		var spores := Node3D.new()
		spores.name = "Spores"
		add_child(spores)
	if not has_node("Shelters"):
		var shelters := Node3D.new()
		shelters.name = "Shelters"
		add_child(shelters)
	if not has_node("Trees"):
		var trees := Node3D.new()
		trees.name = "Trees"
		add_child(trees)

	_visual_proxy_manager = VisualProxyManager.new()
	add_child(_visual_proxy_manager)

	# Seed grass with clustered patchiness instead of uniform soup
	for gz: int in grass.grid_height:
		for gx: int in grass.grid_width:
			var noise := sin(gx * 0.35) * cos(gz * 0.28) + sin(gx * 0.13 + gz * 0.19) * 0.5
			var base: float = cfg_grass_density * grass.max_density * (0.3 + 0.7 * clampf((noise + 1.0) / 2.0, 0.0, 1.0))
			var idx := gz * grass.grid_width + gx
			grass._grid[idx] = base
			grass._nutrients[idx] = clampf(0.25 + randf() * 0.15 + base * 0.2, 0.0, 1.0)

	call_deferred("spawn_entities")
	call_deferred("spawn_trees")
	_add_valley()
	call_deferred("_prewarm_shaders")

# Browsers link a GPU program the first time a material style is drawn, and
# each link froze the web build for ~0.4s. Godot also frees a style's shader
# when the last material using it goes away, so the freeze came back every
# time e.g. the last fruiting mushroom died. Draw every style once, tiny and
# in front of the camera, while the valley loads, and keep the materials
# alive for the whole session so their shaders are never rebuilt.
static var _kept_styles: Array[StandardMaterial3D] = []

func register_scent_emitter(emitter: ScentEmitter) -> void:
	if not _scent_emitters.has(emitter):
		_scent_emitters.append(emitter)

func unregister_scent_emitter(emitter: ScentEmitter) -> void:
	_scent_emitters.erase(emitter)

func _prewarm_shaders() -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var holder := Node3D.new()
	holder.name = "ShaderPrewarm"
	cam.add_child(holder)
	holder.position = Vector3(0.0, 0.0, -2.0)
	holder.scale = Vector3.ONE * 0.001
	var meshes: Array[Mesh] = [SphereMesh.new(), BoxMesh.new(), CylinderMesh.new()]
	var styles: Array[StandardMaterial3D] = []
	var plain := StandardMaterial3D.new()
	styles.append(plain)
	var glowing := StandardMaterial3D.new()
	glowing.emission_enabled = true
	styles.append(glowing)
	var glass := StandardMaterial3D.new()
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	styles.append(glass)
	var glass_glow := StandardMaterial3D.new()
	glass_glow.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass_glow.emission_enabled = true
	styles.append(glass_glow)
	var marker := StandardMaterial3D.new()
	marker.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	marker.emission_enabled = true
	marker.disable_receive_shadows = true
	styles.append(marker)
	if _kept_styles.is_empty():
		_kept_styles = styles
	styles = _kept_styles
	for mesh in meshes:
		for mat in styles:
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = mat
			holder.add_child(mi)
	# Grid layers and creature sprites draw through MultiMeshes, and the
	# mycelium grid is culled until something grows, so draw one instance
	# of each of their real materials too.
	var instanced: Array[GeometryInstance3D] = []
	for layer: Node in [grass, mycelium, _visual_proxy_manager]:
		for child in layer.get_children():
			if child is MultiMeshInstance3D:
				instanced.append(child)
	for src in instanced:
		var mmi := MultiMeshInstance3D.new()
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = (src as MultiMeshInstance3D).multimesh.mesh
		mm.instance_count = 1
		mm.set_instance_transform(0, Transform3D())
		mm.set_instance_color(0, Color.WHITE)
		mmi.multimesh = mm
		mmi.material_override = src.material_override
		holder.add_child(mmi)
	# A few frames is enough for every program to be linked once.
	get_tree().create_timer(0.5).timeout.connect(holder.queue_free)

func ground_height(x: float, z: float) -> float:
	if valley != null:
		return valley.height_at(x, z)
	return 0.0

func _add_valley() -> void:
	valley = ValleyTerrain.new()
	valley.name = "Valley"
	add_child(valley)
	if grass != null:
		grass.bind_valley(ValleyTerrain.FLOOR_RADIUS, Callable(valley, "height_at"))
		if valley.river != null:
			valley.river.bake(grass)
			grass.bind_water(Callable(valley.river, "covers_world"))

func _snap_to_ground(node: Node) -> void:
	if valley == null or not node is Node3D:
		return
	if node is MarkovAgent and ((node as MarkovAgent)._aerial or (node as MarkovAgent)._aquatic):
		return
	var body := node as Node3D
	var p := body.global_position
	p.y = valley.height_at(p.x, p.z)
	body.global_position = p

func _deferred_spawn_entities() -> void:
	spawn_entities()

func spawn_trees() -> void:
	if _tree_scene == null:
		return
	var world_half: float = 25.0
	for i: int in range(cfg_trees):
		var t = _tree_scene.instantiate()
		$Trees.add_child(t)
		t.global_position = Vector3((randf() - 0.5) * world_half * 2.0, 0.0, (randf() - 0.5) * world_half * 2.0)
		_snap_to_ground(t)

# Arborist Failsafe: when no trees exist, settlements can spontaneously
# generate protected arboreal seeds. Also called when agents eat apples.
func try_plant_tree_seed(pos: Vector3, planter_group: String = "") -> bool:
	var chance: float = 0.0
	match planter_group:
		"human":
			chance = 0.6
		"sheep":
			chance = 0.25
		"boar":
			chance = 0.15
		_:
			chance = 0.3
	if randf() > chance:
		return false
	if _tree_scene == null:
		return false
	var t = _tree_scene.instantiate()
	$Trees.add_child(t)
	t.global_position = pos + Vector3((randf() - 0.5) * 4.0, 0.0, (randf() - 0.5) * 4.0)
	_snap_to_ground(t)
	if t.has_method("set_stage"):
		t.set_stage(0)
	if t.has_method("mark_arboreal") and planter_group == "human":
		t.mark_arboreal()
	return true

func _arborist_failsafe() -> void:
	# If there are no trees on the map, every human settlement has a 50%
	# recurring chance to produce a protected arboreal seed nearby.
	if $Trees.get_child_count() > 0:
		return
	for shelter in _active_shelters:
		if shelter == null or not is_instance_valid(shelter):
			continue
		if randf() <= 0.5:
			var seed_pos := shelter.global_position + Vector3((randf() - 0.5) * 8.0, 0.0, (randf() - 0.5) * 8.0)
			try_plant_tree_seed(seed_pos, "human")

func _physics_process(delta: float) -> void:
	tick(delta)

# Adaptive sim rate. A slow machine (or 5x speed) can't afford 30 sim ticks a
# second, and falling behind makes Godot cram several ticks into each frame.
# When frames run long the director steps down to fewer, larger ticks (the
# sim reads dt everywhere, so its speed is unchanged and sprites glide between
# ticks); when there's headroom again it steps back up.
const TICK_RATES: Array[int] = [30, 20, 15]
const SLOW_FRAME_MS: float = 34.0
const FAST_FRAME_MS: float = 20.0
const MAX_STEPS: int = 3  # matches physics/common/max_physics_steps_per_frame
var _frame_ms_avg: float = 16.0
var _last_frame_us: int = 0
var _rate_timer: float = 0.0

func _process(_delta: float) -> void:
	var now := Time.get_ticks_usec()
	if _last_frame_us > 0:
		var frame_ms: float = minf(float(now - _last_frame_us) / 1000.0, 250.0)
		_frame_ms_avg = lerpf(_frame_ms_avg, frame_ms, 0.05)
		_rate_timer += frame_ms / 1000.0
	_last_frame_us = now
	var i: int = TICK_RATES.find(Engine.physics_ticks_per_second)
	if i < 0:
		return
	if _frame_ms_avg > SLOW_FRAME_MS and _rate_timer >= 2.0:
		if i < TICK_RATES.size() - 1:
			Engine.physics_ticks_per_second = TICK_RATES[i + 1]
		else:
			# Still too slow at the lowest rate: one tick per frame. The valley
			# then runs a little slow-motion instead of stuttering.
			Engine.max_physics_steps_per_frame = 1
		_rate_timer = 0.0
	elif _frame_ms_avg < FAST_FRAME_MS and _rate_timer >= 8.0:
		if Engine.max_physics_steps_per_frame < MAX_STEPS:
			Engine.max_physics_steps_per_frame = MAX_STEPS
		elif i > 0:
			Engine.physics_ticks_per_second = TICK_RATES[i - 1]
		_rate_timer = 0.0

func _struggling() -> bool:
	return Engine.max_physics_steps_per_frame == 1

func _exit_tree() -> void:
	Engine.physics_ticks_per_second = TICK_RATES[0]
	Engine.max_physics_steps_per_frame = MAX_STEPS

func tick(dt: float) -> void:
	if _simulation_ended:
		return
	_elapsed += dt
	_sim_day += dt * DAYS_PER_SECOND
	_update_season(dt)
	var sheep_count: int = _active_sheep.size()
	var grazing_pressure: float = clampf(float(sheep_count) / 600.0, 0.0, 1.0)
	# The grids change on a scale of seconds, so a full grass/rot/mycelium
	# step runs once per CA_CYCLE of sim time. Its CA_PERIOD pieces are spread
	# evenly over that second so no single frame pays for a whole grid, and
	# the cost no longer grows with the tick rate.
	# A machine already at the slowest sim rate steps the grids half as often.
	var ca_cycle: float = CA_CYCLE * (2.0 if _struggling() else 1.0)
	_ca_accum += dt
	if _ca_accum >= ca_cycle / CA_PERIOD:
		_ca_accum -= ca_cycle / CA_PERIOD
		_ca_phase = (_ca_phase + 1) % CA_PERIOD
		# The cycle length is fixed for the whole cycle so every part of it
		# advances the grids by the same time.
		if _ca_phase == 0:
			_ca_dt = ca_cycle
		if _ca_phase < GrassLayer.TICK_PARTS:
			grass.tick_part(_ca_phase, _ca_dt, grazing_pressure, _grass_boost)
		else:
			match _ca_phase - GrassLayer.TICK_PARTS:
				0:
					rot.tick(_ca_dt)
				1:
					mycelium.tick(_ca_dt)
				2:
					grass.flush_visuals()
				3:
					mycelium.flush_visuals()
	_scent_prune_accum += dt
	if _scent_prune_accum >= 1.0:
		_scent_prune_accum = 0.0
		scent_network.prune_below(0.05)
	# Scent decays slowly, so emitters are stepped together a few times a
	# second instead of each one running every rendered frame.
	_scent_step_accum += dt
	if _scent_step_accum >= SCENT_STEP:
		for emitter in _scent_emitters:
			emitter.step(_scent_step_accum)
		scent_network.fade(_scent_step_accum)
		_scent_step_accum = 0.0
	_spatial_tick_accum += dt
	if _spatial_tick_accum >= 0.3:
		_spatial_tick_accum = 0.0
		_update_spatial_hash()
		_emit_population_counts()
	# Agents think at most every few ticks, so the presence grid and crowding
	# field only need rebuilding every PRESENCE_EVERY ticks.
	_presence_tick = (_presence_tick + 1) % PRESENCE_EVERY
	if _presence_tick == 0 or _crowd_grid.is_empty():
		_update_presence_grid()
	_tick_agents(dt)
	# Phase 5: sync visual proxies from ECS registry
	if _visual_proxy_manager != null:
		_visual_proxy_manager.sync(_agent_registry)
	if _rain_timer > 0.0:
		_rain_timer -= dt
		if _rain_timer <= 0.0:
			_rain_timer = 0.0
			_recompute_grass_boost()
	if _famine_timer > 0.0:
		_famine_timer -= dt
		if _famine_timer <= 0.0:
			_famine_timer = 0.0
			_recompute_grass_boost()
	if _flood_timer > 0.0:
		_flood_timer -= dt
		if _flood_timer <= 0.0:
			_flood_timer = 0.0
			_set_flood_scale(1.0)
			FXManager.show_dramatic_text(Vector3.ZERO, "The river falls back to its bed.", Color(0.55, 0.75, 0.85))
	_overpop_timer += dt
	if _overpop_timer >= 2.0:
		_overpop_timer = 0.0
		_apply_overpopulation()
		_apply_pass_migration()
		_check_cloning_vat()
	_arborist_timer += dt
	if _arborist_timer >= 5.0:
		_arborist_timer = 0.0
		_arborist_failsafe()
	# Headless data logging and auto-quit
	if _headless_mode:
		_run_timer += dt
		_log_timer += dt
		if _log_timer >= 5.0:
			_log_timer = 0.0
			var counts := get_faction_counts()
			var grass_val: float = counts.get("grass", 0.0)
			var line := "%d,%d,%d,%d,%d,%d,%d,%d,%.1f" % [
				int(_run_timer),
				counts.get("sheep", 0),
				counts.get("wolves", 0),
				counts.get("humans", 0),
				counts.get("falcons", 0),
				counts.get("robins", 0),
				counts.get("boars", 0),
				counts.get("rabbits", 0),
				grass_val
			]
			print("POPLOG: " + line)
			var file := FileAccess.open(HEADLESS_LOG_PATH, FileAccess.READ_WRITE)
			if file != null:
				file.seek_end()
				file.store_line(line)
				file.close()
		if _run_timer >= HEADLESS_RUN_LIMIT:
			get_tree().quit()
	# Population history sampling for results graph
	_history_sample_timer += dt
	if _history_sample_timer >= HISTORY_SAMPLE_INTERVAL:
		_history_sample_timer = 0.0
		var h_counts: Dictionary = get_creature_counts()
		_population_history.append({
			"time": _elapsed,
			"sheep": h_counts.get("sheep", 0),
			"wolves": h_counts.get("wolves", 0),
			"humans": h_counts.get("humans", 0),
			"falcons": h_counts.get("falcons", 0),
			"robins": h_counts.get("robins", 0),
			"boars": h_counts.get("boars", 0),
			"rabbits": h_counts.get("rabbits", 0),
		})
	# The HUD rebuilds its clock and champion line on this signal; four times
	# a second is plenty and saves that work on most ticks.
	_time_emit_accum += dt
	if _time_emit_accum >= 0.25:
		_time_emit_accum = 0.0
		time_updated.emit(maxf(0.0, (cfg_time_limit * DAYS_PER_SECOND) - _sim_day))
	if _sim_day >= cfg_time_limit * DAYS_PER_SECOND:
		_end_simulation()

func _tick_agents(dt: float) -> void:
	# Each animal thinks once per _stagger frames with the time it missed. When
	# the valley booms the cycle stretches so a frame never runs more than
	# about AGENTS_PER_FRAME animals; it only changes at a cycle boundary so
	# no animal is skipped or ticked twice. Spores (slow drifting fungi that
	# can number in the hundreds) run on their own, slower cycle so a mushroom
	# bloom never makes the animals think less often.
	var spores := $Spores
	if _tick_phase == 0:
		var min_stagger: int = STRUGGLING_STAGGER_FRAMES if _struggling() else STAGGER_FRAMES
		_stagger = maxi(min_stagger, ceili(float(_agent_registry.size()) / AGENTS_PER_FRAME))
	if _spore_phase == 0:
		_spore_stagger = maxi(SPORE_STAGGER_FRAMES, ceili(float(spores.get_child_count()) / SPORES_PER_FRAME))
	var stagger := _stagger
	var phase := _tick_phase
	_tick_phase = (_tick_phase + 1) % stagger
	var spore_stagger := _spore_stagger
	var spore_phase := _spore_phase
	_spore_phase = (_spore_phase + 1) % spore_stagger
	# Drop dead/pooled entries and tick this phase's animals in one backwards
	# pass (removal is safe going backwards). Spores are ticked below, once.
	var idx := _agent_registry.size() - 1
	while idx >= 0:
		var data := _agent_registry[idx]
		var node := data.node
		if node == null or not is_instance_valid(node) or not node.is_inside_tree():
			_agent_registry.remove_at(idx)
		elif node.get_instance_id() % stagger == phase and data.species != "mushroom":
			node._physics_process(dt * stagger)
		idx -= 1
	for child in spores.get_children():
		if child.get_instance_id() % spore_stagger == spore_phase and child is MarkovAgent:
			child._physics_process(dt * spore_stagger)

func spawn_entities() -> void:
	var spawn_positions := _generate_spawn_positions()
	var gc = get_node_or_null("/root/GameConfig")
	var roster_names: Dictionary = {}
	if gc != null:
		for entry: Dictionary in gc.spawn_roster:
			var sp: String = entry.get("species", "")
			if not roster_names.has(sp):
				roster_names[sp] = []
			roster_names[sp].append(entry.get("name", ""))
	for i: int in range(cfg_sheep):
		var s: Node = _sheep_pool.acquire()
		if s == null:
			continue
		$Agents.add_child(s)
		if s is Node3D:
			s.visible = true
			s.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
		_track_agent(s, _active_sheep)
		if roster_names.has("sheep") and not roster_names["sheep"].is_empty():
			s.display_name = roster_names["sheep"].pop_front()
		_apply_phenotype_variance(s)
		_apply_campaign_traits(s, "sheep")
	for i: int in range(cfg_wolves):
		var w: Node = _wolf_pool.acquire()
		if w == null:
			continue
		$Agents.add_child(w)
		if w is Node3D:
			w.visible = true
			w.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
		_track_agent(w, _active_wolves)
		if roster_names.has("wolf") and not roster_names["wolf"].is_empty():
			w.display_name = roster_names["wolf"].pop_front()
		_apply_phenotype_variance(w)
		_apply_campaign_traits(w, "wolf")
	for i: int in range(cfg_humans):
		var h: Node = _human_pool.acquire()
		if h == null:
			continue
		$Agents.add_child(h)
		if h is Node3D:
			h.visible = true
			h.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
		_track_agent(h, _active_humans)
		if roster_names.has("human") and not roster_names["human"].is_empty():
			h.display_name = roster_names["human"].pop_front()
		_apply_phenotype_variance(h)
		_apply_campaign_traits(h, "human")
	for i: int in range(cfg_spores):
		var ms = _spore_scene.instantiate()
		$Spores.add_child(ms)
		ms.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
		ms.global_position.y = 10.0 + randf() * 5.0
		_track_agent(ms, _active_spores)
		if roster_names.has("spore") and not roster_names["spore"].is_empty():
			ms.display_name = roster_names["spore"].pop_front()
		_apply_phenotype_variance(ms)
		_apply_campaign_traits(ms, "spore")
	for i: int in range(cfg_falcons):
		if _falcon_scene == null:
			continue
		var f: Node = _falcon_pool.acquire()
		if f == null:
			continue
		$Agents.add_child(f)
		if f is Node3D:
			f.visible = true
			f.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
			f.global_position.y = 8.0 + randf() * 5.0
		_track_agent(f, _active_falcons)
		if roster_names.has("falcon") and not roster_names["falcon"].is_empty():
			f.display_name = roster_names["falcon"].pop_front()
		_apply_phenotype_variance(f)
		_apply_campaign_traits(f, "falcon")
	for i: int in range(cfg_robins):
		if _robin_scene == null:
			continue
		var r: Node = _robin_pool.acquire()
		if r == null:
			continue
		$Agents.add_child(r)
		if r is Node3D:
			r.visible = true
			r.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
			r.global_position.y = 2.0 + randf() * 3.0
		_track_agent(r, _active_robins)
		if roster_names.has("robin") and not roster_names["robin"].is_empty():
			r.display_name = roster_names["robin"].pop_front()
		_apply_phenotype_variance(r)
		_apply_campaign_traits(r, "robin")
	for i: int in range(cfg_boars):
		if _boar_scene == null:
			continue
		var b: Node = _boar_pool.acquire()
		if b == null:
			continue
		$Agents.add_child(b)
		if b is Node3D:
			b.visible = true
			b.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
		_track_agent(b, _active_boars)
		if roster_names.has("boar") and not roster_names["boar"].is_empty():
			b.display_name = roster_names["boar"].pop_front()
		_apply_phenotype_variance(b)
		_apply_campaign_traits(b, "boar")
	for i: int in range(cfg_worms):
		if _worm_scene == null:
			continue
		var wr: Node = _worm_pool.acquire()
		if wr == null:
			continue
		$Agents.add_child(wr)
		if wr is Node3D:
			wr.visible = true
			wr.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3(randf() - 0.5, 0, randf() - 0.5) * 40.0
		_track_agent(wr, _active_worms)
		if roster_names.has("worm") and not roster_names["worm"].is_empty():
			wr.display_name = roster_names["worm"].pop_front()
		_apply_phenotype_variance(wr)
		_apply_campaign_traits(wr, "worm")
	for i: int in range(cfg_rabbits):
		if _rabbit_scene == null:
			continue
		var rb: Node = _rabbit_pool.acquire()
		if rb == null:
			continue
		$Agents.add_child(rb)
		if rb is Node3D:
			rb.visible = true
			rb.global_position = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3((randf() - 0.5) * 40.0, 0.0, (randf() - 0.5) * 40.0)
		_track_agent(rb, _active_rabbits)
		if roster_names.has("rabbit") and not roster_names["rabbit"].is_empty():
			rb.display_name = roster_names["rabbit"].pop_front()
		_apply_phenotype_variance(rb)
		_apply_campaign_traits(rb, "rabbit")
	_spawn_fish(cfg_fish)

	# Auto-use powerups for challenge mode
	_auto_use_powerups()

func _auto_use_powerups() -> void:
	var gc = get_node_or_null("/root/GameConfig")
	if gc == null or gc.current_mode != "challenge":
		return
	for key: String in gc.powerup_inventory.keys():
		var count: int = gc.powerup_inventory.get(key, 0)
		if count <= 0:
			continue
		for i: int in range(count):
			match key:
				"rain": trigger_rain()
				"predator_call": trigger_predator_call()
				"heal": trigger_heal()
				"famine": trigger_famine()
				"meteor": trigger_meteor()
				"flood": trigger_flood()
		gc.powerup_inventory[key] = 0
	gc.save_meta()

func _generate_spawn_positions() -> Array[Vector3]:
	var positions: Array[Vector3] = []
	var world_half: float = 30.0
	var total_agents: int = cfg_sheep + cfg_wolves + cfg_humans + cfg_spores + cfg_falcons + cfg_robins + cfg_boars + cfg_worms + cfg_rabbits
	match cfg_preset:
		"Random Scatter":
			for i: int in range(total_agents):
				positions.append(Vector3((randf() - 0.5) * world_half * 2.0, 0.0, (randf() - 0.5) * world_half * 2.0))
		"Corner Clusters":
			for i: int in range(cfg_sheep):
				positions.append(Vector3(-world_half * 0.7 + randf() * 5.0, 0.0, -world_half * 0.7 + randf() * 5.0))
			for i: int in range(cfg_wolves):
				positions.append(Vector3(world_half * 0.7 + randf() * 5.0, 0.0, world_half * 0.7 + randf() * 5.0))
			for i: int in range(cfg_humans):
				positions.append(Vector3(-world_half * 0.7 + randf() * 5.0, 0.0, world_half * 0.7 + randf() * 5.0))
			for i: int in range(cfg_spores):
				positions.append(Vector3(randf() * 4.0 - 2.0, 10.0 + randf() * 5.0, randf() * 4.0 - 2.0))
			for i: int in range(cfg_falcons):
				positions.append(Vector3((randf() - 0.5) * world_half * 0.5, 10.0 + randf() * 5.0, (randf() - 0.5) * world_half * 0.5))
			for i: int in range(cfg_robins):
				positions.append(Vector3((randf() - 0.5) * world_half * 2.0, 2.0 + randf() * 2.0, (randf() - 0.5) * world_half * 2.0))
			for i: int in range(cfg_boars):
				positions.append(Vector3((randf() - 0.5) * world_half * 2.0, 0.0, (randf() - 0.5) * world_half * 2.0))
			for i: int in range(cfg_worms):
				positions.append(Vector3((randf() - 0.5) * world_half * 2.0, 0.0, (randf() - 0.5) * world_half * 2.0))
			for i: int in range(cfg_rabbits):
				positions.append(Vector3((randf() - 0.5) * world_half * 2.0, 0.0, (randf() - 0.5) * world_half * 2.0))
		_:
			for i: int in range(total_agents):
				positions.append(Vector3((randf() - 0.5) * world_half * 2.0, 0.0, (randf() - 0.5) * world_half * 2.0))
	positions.shuffle()
	return positions

func spawn_corpse(pos: Vector3, energy: float) -> void:
	if _corpse_scene == null:
		return
	var corpses := $Corpses
	# Hard cap: if too many corpses exist, delete oldest to prevent draw-call bloat
	const MAX_CORPSES: int = 25
	var excess := corpses.get_child_count() - MAX_CORPSES + 1
	for i in range(maxi(excess, 0)):
		var oldest: Node = corpses.get_child(0)
		if oldest == null or not is_instance_valid(oldest):
			break
		oldest.queue_free()
		if oldest.get_parent() == corpses:
			corpses.remove_child(oldest)
	var corpse = _corpse_scene.instantiate()
	corpses.add_child(corpse)
	# Snap corpses to the valley floor so aerial deaths don't float
	corpse.global_position = Vector3(pos.x, ground_height(pos.x, pos.z), pos.z)
	corpse.corpse_energy = energy

func spawn_mushroom_spore(parent: Node, pos: Vector3) -> void:
	if _spore_scene == null:
		return
	var spore = _spore_scene.instantiate()
	$Spores.add_child(spore)
	spore.global_position = pos
	_active_spores.append(spore)
	_apply_phenotype_variance(spore, parent)

func build_shelter(pos: Vector3) -> int:
	var shelter := Node3D.new()
	shelter.name = "Shelter"
	var sid: int = _next_settlement_id
	_next_settlement_id += 1
	if shelter.get("settlement_id") != null:
		shelter.settlement_id = sid
	else:
		shelter.set_meta("settlement_id", sid)
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(4.0, 3.5, 4.0)
	mesh.mesh = box
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.75, 0.6, 0.4)
	mesh.material_override = mat
	shelter.add_child(mesh)
	var static_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box_shape := BoxShape3D.new()
	box_shape.size = Vector3(4.0, 3.5, 4.0)
	col.shape = box_shape
	static_body.add_child(col)
	static_body.collision_layer = 1
	shelter.add_child(static_body)
	$Shelters.add_child(shelter)
	shelter.global_position = Vector3(pos.x, ground_height(pos.x, pos.z), pos.z)
	_active_shelters.append(shelter)
	settlement_built.emit(pos)
	return sid

func _track_agent(agent: Node, array: Array) -> void:
	array.append(agent)
	agent.tree_exiting.connect(func(): array.erase(agent), CONNECT_ONE_SHOT)
	# ECS data binding
	if agent is MarkovAgent:
		var species := ""
		if array == _active_sheep: species = "sheep"
		elif array == _active_wolves: species = "wolf"
		elif array == _active_humans: species = "human"
		elif array == _active_falcons: species = "falcon"
		elif array == _active_robins: species = "robin"
		elif array == _active_boars: species = "boar"
		elif array == _active_worms: species = "worm"
		elif array == _active_rabbits: species = "rabbit"
		elif array == _active_fish: species = "fish"
		elif array == _active_spores: species = "mushroom"
		var h: float = agent.get("health") if agent.get("health") != null else 0.0
		var e: float = agent.get("energy") if agent.get("energy") != null else 0.0
		var ls: float = agent.get("_lifespan") if agent.get("_lifespan") != null else 20.0
		var data := AgentData.new(species, h, e, agent.global_position, ls, agent)
		data.variant = agent.variant
		agent._bind_agent_data(data)
		_agent_registry.append(data)
		agent.tree_exiting.connect(func(): _agent_registry.erase(data), CONNECT_ONE_SHOT)
	_snap_to_ground(agent)

func spawn_sheep_offspring(parent: Node, pos: Vector3) -> void:
	if _sheep_pool == null:
		return
	var s: Node = _sheep_pool.acquire()
	if s == null:
		return
	$Agents.add_child(s)
	if s is Node3D:
		s.visible = true
		s.global_position = pos
	if s.get("energy") != null:
		s.energy = 15.0
	_track_agent(s, _active_sheep)
	_apply_phenotype_variance(s, parent)
	_apply_campaign_traits(s, "sheep")
	agent_born.emit("sheep", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.95, 0.95, 0.95))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Sheep!", Color(0.9, 0.9, 1.0))

func spawn_wolf_offspring(parent: Node, pos: Vector3) -> void:
	if _wolf_pool == null:
		return
	var w: Node = _wolf_pool.acquire()
	if w == null:
		return
	$Agents.add_child(w)
	if w is Node3D:
		w.visible = true
		w.global_position = pos
	if w.get("energy") != null:
		w.energy = 35.0
	_track_agent(w, _active_wolves)
	_apply_phenotype_variance(w, parent)
	_apply_campaign_traits(w, "wolf")
	agent_born.emit("wolf", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.8, 0.1, 0.1))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Wolf!", Color(1.0, 0.5, 0.5))

func spawn_human_offspring(parent: Node, pos: Vector3) -> void:
	if _human_pool == null:
		return
	var h: Node = _human_pool.acquire()
	if h == null:
		return
	$Agents.add_child(h)

	# Settlement-centric spawning: if parent has a settlement, child spawns near it
	var spawn_pos := pos
	var parent_sid = parent.get("_settlement_id")
	var parent_center = parent.get("_settlement_center")
	if parent_sid != null and parent_sid is int and parent_sid > 0:
		if parent_center != null and parent_center is Vector3 and parent_center != Vector3.ZERO:
			var offset := Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * (1.5 + randf() * 1.5)
			spawn_pos = parent_center + offset

	if h is Node3D:
		h.visible = true
		h.global_position = spawn_pos
	if h.get("energy") != null:
		h.energy = 20.0

	# Settlement-born offspring bonus
	if is_position_in_shelter(spawn_pos, 6.0):
		if h.get("health") != null:
			h.health = minf(h.health * 1.25, 100.0)
		if h.get("energy") != null:
			h.energy = minf(h.energy * 1.3, 100.0)
		if h.get("damage") != null:
			h.damage *= 1.15
		if h.get("metabolism_rate") != null:
			h.metabolism_rate *= 0.9
		# Inherit settlement from parent
		if parent_sid != null and parent_sid is int and parent_sid > 0:
			if h.get("_settlement_id") != null:
				h._settlement_id = parent_sid
			if h.get("_settlement_center") != null:
				h._settlement_center = parent_center if parent_center != null else Vector3.ZERO

	# Variant roll for human offspring
	var in_shelter: bool = is_position_in_shelter(spawn_pos, 6.0)
	var roll := randf()
	var chosen_variant := ""
	if in_shelter:
		if roll < 0.05:
			chosen_variant = "wizard"
		elif roll < 0.20:
			chosen_variant = "builder"
	else:
		if roll < 0.05:
			chosen_variant = "builder"
	if not chosen_variant.is_empty() and h.has_method("_apply_variant"):
		h._apply_variant(chosen_variant)

	_track_agent(h, _active_humans)
	_apply_phenotype_variance(h, parent)
	_apply_campaign_traits(h, "human")
	agent_born.emit("human", spawn_pos, chosen_variant)
	FXManager.spawn_birth_particles(spawn_pos, Color(0.9, 0.7, 0.5))
	FXManager.show_floating_text(spawn_pos + Vector3.UP, "Baby Human!", Color(0.95, 0.8, 0.6))

func spawn_falcon_offspring(parent: Node, pos: Vector3) -> void:
	if _falcon_pool == null:
		return
	var f: Node = _falcon_pool.acquire()
	if f == null:
		return
	$Agents.add_child(f)
	if f is Node3D:
		f.visible = true
		f.global_position = pos
		f.global_position.y = 8.0 + randf() * 3.0
	if f.get("energy") != null:
		f.energy = 40.0
	_track_agent(f, _active_falcons)
	_apply_phenotype_variance(f, parent)
	_apply_campaign_traits(f, "falcon")
	agent_born.emit("falcon", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.95, 0.95, 0.95))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Falcon!", Color(0.95, 0.95, 0.8))

func spawn_robin_offspring(parent: Node, pos: Vector3) -> void:
	if _robin_pool == null:
		return
	var r: Node = _robin_pool.acquire()
	if r == null:
		return
	$Agents.add_child(r)
	if r is Node3D:
		r.visible = true
		r.global_position = pos
		r.global_position.y = 2.0 + randf() * 2.0
	if r.get("energy") != null:
		r.energy = 15.0
	_track_agent(r, _active_robins)
	_apply_phenotype_variance(r, parent)
	_apply_campaign_traits(r, "robin")
	agent_born.emit("robin", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.2, 0.6, 0.9))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Robin!", Color(0.6, 0.8, 1.0))

func spawn_boar_offspring(parent: Node, pos: Vector3) -> void:
	if _boar_pool == null:
		return
	var b: Node = _boar_pool.acquire()
	if b == null:
		return
	$Agents.add_child(b)
	if b is Node3D:
		b.visible = true
		b.global_position = pos
	if b.get("energy") != null:
		b.energy = 25.0
	_track_agent(b, _active_boars)
	_apply_phenotype_variance(b, parent)
	_apply_campaign_traits(b, "boar")
	agent_born.emit("boar", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.5, 0.3, 0.2))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Boar!", Color(0.8, 0.6, 0.4))

func spawn_worm_offspring(parent: Node, pos: Vector3) -> void:
	if _worm_pool == null:
		return
	var wr: Node = _worm_pool.acquire()
	if wr == null:
		return
	$Agents.add_child(wr)
	if wr is Node3D:
		wr.visible = true
		wr.global_position = pos
	if wr.get("energy") != null:
		wr.energy = 15.0
	_track_agent(wr, _active_worms)
	_apply_phenotype_variance(wr, parent)
	_apply_campaign_traits(wr, "worm")
	agent_born.emit("worm", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.2, 0.8, 0.3))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Worm!", Color(0.5, 1.0, 0.5))

func spawn_rabbit_offspring(parent: Node, pos: Vector3) -> void:
	if _rabbit_pool == null:
		return
	var rb: Node = _rabbit_pool.acquire()
	if rb == null:
		return
	$Agents.add_child(rb)
	if rb is Node3D:
		rb.visible = true
		rb.global_position = pos
	if rb.get("energy") != null:
		rb.energy = 12.0
	_track_agent(rb, _active_rabbits)
	_apply_phenotype_variance(rb, parent)
	_apply_campaign_traits(rb, "rabbit")
	agent_born.emit("rabbit", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.78, 0.6, 0.42))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Rabbit!", Color(0.9, 0.7, 0.5))

func human_party_size_check(human: Node) -> int:
	# Presence grid: O(1) instead of spatial hash O(n)
	var total: int = get_presence_count(human.global_position, 8.0, "humans")
	return maxi(total - 1, 0)

func get_sheep_count() -> int:
	return _active_sheep.size()

func get_wolf_count() -> int:
	return _active_wolves.size()

func get_human_count() -> int:
	return _active_humans.size()

func get_falcon_count() -> int:
	return _active_falcons.size()

func get_robin_count() -> int:
	return _active_robins.size()

func get_boar_count() -> int:
	return _active_boars.size()

func get_worm_count() -> int:
	return _active_worms.size()

func get_rabbit_count() -> int:
	return _active_rabbits.size()

func get_nearby_humans(pos: Vector3, radius: float) -> Array:
	return get_nearby_agents(pos, radius, "human")

func is_position_in_shelter(pos: Vector3, radius: float = 5.0) -> bool:
	for shelter in _active_shelters:
		if shelter != null and is_instance_valid(shelter) and shelter.global_position.distance_to(pos) <= radius:
			return true
	return false

func wolf_pack_size_check(wolf: Node) -> int:
	# Presence grid: O(1) instead of spatial hash O(n)
	var total: int = get_presence_count(wolf.global_position, 8.0, "wolves")
	return maxi(total - 1, 0)

func _emit_population_counts() -> void:
	var wizard_count: int = 0
	var builder_count: int = 0
	for h in _active_humans:
		if h.get("variant") == "wizard":
			wizard_count += 1
		elif h.get("variant") == "builder":
			builder_count += 1
	var counts: Dictionary = {
		"sheep": _active_sheep.size(),
		"wolves": _active_wolves.size(),
		"humans": _active_humans.size(),
		"falcons": _active_falcons.size(),
		"robins": _active_robins.size(),
		"boars": _active_boars.size(),
		"rabbits": _active_rabbits.size(),
		"wizards": wizard_count,
		"builders": builder_count,
	}
	for k: String in counts.keys():
		var old_count: int = _last_population_counts.get(k, 0)
		if old_count != counts[k]:
			_last_population_counts[k] = counts[k]
			population_changed.emit(k, counts[k])
			if counts[k] < 10 and old_count >= 10:
				FXManager.flash_vignette(Color(0.9, 0.2, 0.2), 0.6)
		# Extinction detection: went from >0 to 0
		if counts[k] == 0 and old_count > 0:
			if not _last_extinction_state.get(k, false):
				_last_extinction_state[k] = true
				extinction_event.emit(k)
		elif counts[k] > 0:
			_last_extinction_state[k] = false
		# Overpopulation detection: crossed 300 threshold
		if counts[k] >= 300 and old_count < 300:
			if not _last_overpop_state.get(k, false):
				_last_overpop_state[k] = true
				overpopulation_event.emit(k)
		elif counts[k] < 250:
			_last_overpop_state[k] = false

func _apply_pass_migration() -> void:
	# A species that has actually died out may walk back in through a pass.
	# Low numbers are left to desperation breeding. Extinction is allowed to last.
	var counts := get_faction_counts()
	for faction: String in MIGRANT_COUNTS.keys():
		var n: int = int(counts.get(faction, 0))
		if n > 0:
			_ever_lived[faction] = true
			_extinct_since.erase(faction)
			continue
		if not _ever_lived.get(faction, false):
			continue
		if not _extinct_since.has(faction):
			_extinct_since[faction] = _sim_day
			continue
		if _sim_day < float(_extinct_since[faction]) + MIGRATION_WAIT_DAYS:
			continue
		if _sim_day < float(_migration_lock_until.get(faction, 0.0)):
			continue
		if randf() > MIGRATION_CHANCE:
			continue
		_arrive_migrants(faction)

func _arrive_migrants(faction: String) -> void:
	var pool: NodePool = null
	var dest: Array = []
	var species_id: String = ""
	match faction:
		"sheep":
			pool = _sheep_pool
			dest = _active_sheep
			species_id = "sheep"
		"wolves":
			pool = _wolf_pool
			dest = _active_wolves
			species_id = "wolf"
		"rabbits":
			pool = _rabbit_pool
			dest = _active_rabbits
			species_id = "rabbit"
		"humans":
			pool = _human_pool
			dest = _active_humans
			species_id = "human"
		"falcons":
			pool = _falcon_pool
			dest = _active_falcons
			species_id = "falcon"
		"boars":
			pool = _boar_pool
			dest = _active_boars
			species_id = "boar"
		"robins":
			pool = _robin_pool
			dest = _active_robins
			species_id = "robin"
	if faction == "fish":
		var school: int = _spawn_fish(int(MIGRANT_COUNTS[faction]))
		if school <= 0:
			return
		_migration_lock_until[faction] = _sim_day + 45.0
		_extinct_since.erase(faction)
		_ever_lived[faction] = true
		FXManager.show_dramatic_text(Vector3.ZERO, "A school returns to the river", Color(0.45, 0.75, 0.9))
		return
	if pool == null:
		return
	var mouth: Dictionary = valley.random_pass_mouth() if valley != null else {"name": "the rim", "position": Vector3(30.0, 0.0, 0.0)}
	var base: Vector3 = mouth["position"]
	var arrived: int = 0
	var founders: int = int(MIGRANT_COUNTS[faction])
	for i: int in founders:
		var agent: Node = pool.acquire()
		if agent == null:
			continue
		$Agents.add_child(agent)
		if agent is Node3D:
			agent.visible = true
			var jitter := Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0)
			agent.global_position = base + jitter
			if faction == "falcons":
				agent.global_position.y = 8.0 + randf() * 4.0
			elif faction == "robins":
				agent.global_position.y = 3.0 + randf() * 2.0
		if agent.get("sex") != null:
			agent.sex = "female" if i % 2 == 0 else "male"
		_track_agent(agent, dest)
		_apply_phenotype_variance(agent, null)
		_apply_campaign_traits(agent, species_id)
		arrived += 1
	if arrived <= 0:
		return
	_migration_lock_until[faction] = _sim_day + 45.0
	_extinct_since.erase(faction)
	_ever_lived[faction] = true
	var label := faction.capitalize()
	FXManager.show_dramatic_text(base, "%s come down the %s" % [label, str(mouth["name"])], Color(0.95, 0.86, 0.45))

func _check_cloning_vat() -> void:
	# Cloning Vat upgrade: if the player's bet species goes extinct mid-run,
	# respawn one agent with boosted health and energy (one time per run).
	if _cloning_vat_used:
		return
	var gc = get_node_or_null("/root/GameConfig")
	if gc == null or not gc.owned_upgrades.get("cloning_vat", false):
		return
	var bet: String = gc.player_bet.to_lower()
	var count: int = 0
	match bet:
		"sheep": count = _active_sheep.size()
		"wolves", "wolf": count = _active_wolves.size()
		"humans", "human": count = _active_humans.size()
		"falcons", "falcon": count = _active_falcons.size()
		"robins", "robin": count = _active_robins.size()
		"boars", "boar": count = _active_boars.size()
		"worms", "worm": count = _active_worms.size()
		"rabbits", "rabbit": count = _active_rabbits.size()
	if count > 0:
		return
	var pool: NodePool = null
	var target_array: Array = []
	match bet:
		"sheep": pool = _sheep_pool; target_array = _active_sheep
		"wolves", "wolf": pool = _wolf_pool; target_array = _active_wolves
		"humans", "human": pool = _human_pool; target_array = _active_humans
		"falcons", "falcon": pool = _falcon_pool; target_array = _active_falcons
		"robins", "robin": pool = _robin_pool; target_array = _active_robins
		"boars", "boar": pool = _boar_pool; target_array = _active_boars
		"worms", "worm": pool = _worm_pool; target_array = _active_worms
		"rabbits", "rabbit": pool = _rabbit_pool; target_array = _active_rabbits
	if pool == null:
		return
	var agent: Node = pool.acquire()
	if agent == null:
		return
	$Agents.add_child(agent)
	if agent is Node3D:
		agent.visible = true
		agent.global_position = Vector3((randf() - 0.5) * 40.0, 0.0, (randf() - 0.5) * 40.0)
	_track_agent(agent, target_array)
	_apply_phenotype_variance(agent)
	_apply_campaign_traits(agent, bet)
	if agent.get("health") != null:
		agent.health = minf(agent.get("health") * 1.5, 100.0)
	if agent.get("energy") != null:
		agent.energy = minf(agent.get("energy") * 1.5, 100.0)
	FXManager.show_dramatic_text(agent.global_position, "Cloning Vat: %s reborn!" % bet.capitalize(), Color.GOLD)
	_cloning_vat_used = true

func _apply_overpopulation() -> void:
	# Density-dependent mortality modeled with a logistic sigmoid using Euler's constant (e).
	# As a population approaches and exceeds its carrying capacity, the per-agent mortality rate
	# rises along a smooth S-curve, creating natural boom-and-bust dynamics.
	# mortality_rate = max_mortality / (1 + exp(-steepness * (population - midpoint)))
	# where midpoint = capacity * 1.3 (significant mortality kicks in ~30% above capacity).
	var factions: Array[Array] = [
		_active_sheep, _active_wolves, _active_humans,
		_active_spores, _active_falcons, _active_robins,
		_active_boars, _active_worms,
			_active_rabbits
	]
	var species_names: Array[String] = ["sheep", "wolf", "human", "spore", "falcon", "robin", "boar", "worm", "rabbit"]
	for i: int in range(factions.size()):
		var faction: Array = factions[i]
		var count: int = faction.size()
		var sp: String = species_names[i]
		var capacity: int = CARRYING_CAPACITY.get(sp, 300)
		var midpoint: float = capacity * 1.3
		var mortality_rate: float = OVERPOP_MAX_MORTALITY / (1.0 + exp(-OVERPOP_STEEPNESS * (count - midpoint)))
		if mortality_rate <= 0.001:
			continue
		var culled: int = 0
		for agent in faction:
			if agent == null or not is_instance_valid(agent):
				continue
			if randf() < mortality_rate:
				culled += 1
				if agent.has_method("die"):
					agent.die()
				else:
					agent.queue_free()
		if culled > 0 and culled >= int(count * 0.15):
			overpopulation_event.emit(sp)

# Euler's constant (e) appears in the logistic sigmoid — the natural S-curve of population limits.
# This function returns a reproduction probability multiplier (0.0..1.0) based on how close
# the global population is to its carrying capacity. As P approaches K, the multiplier falls
# along a smooth sigmoid: f(P) = 1 / (1 + e^(steepness*(P - K*0.7)))
func logistic_reproduction_factor(species: String) -> float:
	var capacity: int = CARRYING_CAPACITY.get(species, 300)
	var count: int = 0
	match species:
		"sheep": count = _active_sheep.size()
		"wolf": count = _active_wolves.size()
		"human": count = _active_humans.size()
		"spore": count = _active_spores.size()
		"falcon": count = _active_falcons.size()
		"robin": count = _active_robins.size()
		"boar": count = _active_boars.size()
		"worm": count = _active_worms.size()
		"rabbit": count = _active_rabbits.size()
	var midpoint: float = capacity * 0.7
	return 1.0 / (1.0 + exp(0.02 * (count - midpoint)))

func find_nearest_apple(pos: Vector3, radius: float = 8.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "apple"):
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var d_sq := pos.distance_squared_to(node.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = node
	return best

func find_nearest_tree(pos: Vector3, radius: float = 10.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "tree"):
		if not is_instance_valid(node) or not node is Node3D:
			continue
		if node.has_method("harvest"):
			var d_sq := pos.distance_squared_to(node.global_position)
			if d_sq < best_dist_sq:
				best_dist_sq = d_sq
				best = node
	return best

func find_nearest_mushroom(pos: Vector3, radius: float = 6.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "mushroom"):
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var n3d := node as Node3D
		var d_sq := pos.distance_squared_to(n3d.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = n3d
	return best

func find_nearest_fish(pos: Vector3, radius: float = 8.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in _active_fish:
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var n3d := node as Node3D
		var d_sq := pos.distance_squared_to(n3d.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = n3d
	return best

func try_eat_fish(from: Vector3, reach: float) -> bool:
	var fish := find_nearest_fish(from, reach)
	if fish == null:
		return false
	if fish.has_method("die"):
		fish.die()
	return true

func find_nearest_worm(pos: Vector3, radius: float = 6.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "worm"):
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var n3d := node as Node3D
		var d_sq := pos.distance_squared_to(n3d.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = n3d
	return best

func find_nearest_corpse(pos: Vector3, radius: float = 8.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "corpse"):
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var d_sq := pos.distance_squared_to(node.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = node
	return best

func get_creature_counts() -> Dictionary:
	var wizard_count: int = 0
	var builder_count: int = 0
	for h in _active_humans:
		if h.get("variant") == "wizard":
			wizard_count += 1
		elif h.get("variant") == "builder":
			builder_count += 1
	return {
		"sheep": _active_sheep.size(),
		"wolves": _active_wolves.size(),
		"humans": _active_humans.size(),
		"falcons": _active_falcons.size(),
		"robins": _active_robins.size(),
		"boars": _active_boars.size(),
		"worms": _active_worms.size(),
		"rabbits": _active_rabbits.size(),
		"fish": _active_fish.size(),
		"wizards": wizard_count,
		"builders": builder_count,
	}

func get_faction_counts() -> Dictionary:
	var grass_sum: float = 0.0
	for v: float in grass._grid:
		grass_sum += v
	return {
		"sheep": _active_sheep.size(),
		"wolves": _active_wolves.size(),
		"humans": _active_humans.size(),
		"mushrooms": _active_spores.size(),
		"falcons": _active_falcons.size(),
		"robins": _active_robins.size(),
		"boars": _active_boars.size(),
		"worms": _active_worms.size(),
		"rabbits": _active_rabbits.size(),
		"fish": _active_fish.size(),
		"grass": grass_sum,
	}

func _world_to_cell(world_pos: Vector3) -> Vector2i:
	var cx := int(floor(world_pos.x / SPATIAL_CELL_SIZE))
	var cz := int(floor(world_pos.z / SPATIAL_CELL_SIZE))
	return Vector2i(cx, cz)

func _world_to_presence_cell(world_pos: Vector3) -> Vector2i:
	var cx := int(floor(world_pos.x / PRESENCE_CELL_SIZE))
	var cz := int(floor(world_pos.z / PRESENCE_CELL_SIZE))
	return Vector2i(cx, cz)

# Presence and crowding live in flat arrays over a fixed PRESENCE_N x PRESENCE_N
# window of 5 m cells centred on the valley (creatures stay within +-50 m), so
# rebuilding and querying them is plain index math instead of dictionary churn.
func _presence_index(cx: int, cz: int) -> int:
	var ix := cx + PRESENCE_HALF
	var iz := cz + PRESENCE_HALF
	if ix < 0 or iz < 0 or ix >= PRESENCE_N or iz >= PRESENCE_N:
		return -1
	return iz * PRESENCE_N + ix

func _update_presence_grid() -> void:
	var cells := PRESENCE_N * PRESENCE_N
	_crowd_grid.resize(cells)
	_crowd_grid.fill(0)
	_presence_counts.resize(_presence_slots.size() * cells)
	_presence_counts.fill(0)
	for data in _agent_registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		var p: Vector3 = data.pos
		var i := _presence_index(int(floor(p.x / PRESENCE_CELL_SIZE)), int(floor(p.z / PRESENCE_CELL_SIZE)))
		if i < 0:
			continue
		var slot: int = _presence_slots.get(data.species, -1)
		if slot < 0:
			slot = _presence_slots.size()
			_presence_slots[data.species] = slot
			_presence_counts.resize((slot + 1) * cells)
			for j: int in range(slot * cells, (slot + 1) * cells):
				_presence_counts[j] = 0
		_presence_counts[slot * cells + i] += 1
		_crowd_grid[i] += 1

func get_crowding_vector(pos: Vector3) -> Vector3:
	if _crowd_grid.is_empty():
		return Vector3.ZERO
	var ccx := int(floor(pos.x / PRESENCE_CELL_SIZE))
	var ccz := int(floor(pos.z / PRESENCE_CELL_SIZE))
	var steer := Vector3.ZERO
	for dx: int in range(-1, 2):
		for dz: int in range(-1, 2):
			var i := _presence_index(ccx + dx, ccz + dz)
			if i < 0:
				continue
			var count: int = _crowd_grid[i]
			if count <= 1 and dx == 0 and dz == 0:
				continue
			if count <= 0:
				continue
			# Repulsion from neighbor cell centers
			var to_x: float = (ccx + dx + 0.5) * PRESENCE_CELL_SIZE - pos.x
			var to_z: float = (ccz + dz + 0.5) * PRESENCE_CELL_SIZE - pos.z
			var dist := sqrt(to_x * to_x + to_z * to_z)
			if dist > 0.01:
				var k: float = float(count) * (1.0 / maxf(dist, 1.0)) * 2.0 / dist
				steer.x -= to_x * k
				steer.z -= to_z * k
	return steer

func _get_faction_array(faction: String) -> Array:
	match faction:
		"sheep": return _active_sheep
		"wolves": return _active_wolves
		"humans": return _active_humans
		"falcons": return _active_falcons
		"robins": return _active_robins
		"boars": return _active_boars
		"worms": return _active_worms
		"rabbits": return _active_rabbits
		_: return []

func get_presence_count(pos: Vector3, radius: float, faction: String) -> int:
	var slot: int = _presence_slots.get(faction, -1)
	if slot < 0:
		return 0
	var base: int = slot * PRESENCE_N * PRESENCE_N
	var ccx := int(floor(pos.x / PRESENCE_CELL_SIZE))
	var ccz := int(floor(pos.z / PRESENCE_CELL_SIZE))
	var cell_radius := int(ceil(radius / PRESENCE_CELL_SIZE))
	var total: int = 0
	for dz: int in range(-cell_radius, cell_radius + 1):
		for dx: int in range(-cell_radius, cell_radius + 1):
			var i := _presence_index(ccx + dx, ccz + dz)
			if i >= 0:
				total += _presence_counts[base + i]
	return total

# Spatial hash: cell key -> {group name -> [Node3D]}, plus ALL_GROUPS for
# untagged queries. Bucketing by group at rebuild time means a query only
# walks the creatures it asked for instead of string-checking every node.
const ALL_GROUPS: String = "*"

func _spatial_add(n3d: Node3D) -> void:
	var p := n3d.global_position
	var key: int = int(floor(p.x / SPATIAL_CELL_SIZE)) * 4096 + int(floor(p.z / SPATIAL_CELL_SIZE))
	var buckets: Dictionary = _spatial_grid.get(key, {})
	if buckets.is_empty():
		_spatial_grid[key] = buckets
		buckets[ALL_GROUPS] = []
	buckets[ALL_GROUPS].append(n3d)
	for g: StringName in n3d.get_groups():
		var gs := String(g)
		if not buckets.has(gs):
			buckets[gs] = []
		buckets[gs].append(n3d)

func _update_spatial_hash() -> void:
	_spatial_grid.clear()
	for parent: Node in [$Agents, $Spores]:
		for child in parent.get_children():
			if child is Node3D:
				_spatial_add(child)
	for child in $Trees.get_children():
		if not child is Node3D:
			continue
		_spatial_add(child)
		for sub in child.get_children():
			if sub is Node3D and sub.is_in_group("apple"):
				_spatial_add(sub)
	for child in $Corpses.get_children():
		if child is Node3D:
			_spatial_add(child)

func get_nearby_agents(pos: Vector3, radius: float, group_tag: String = "") -> Array[Node3D]:
	var r2 := radius * radius
	var results: Array[Node3D] = []
	var ccx := int(floor(pos.x / SPATIAL_CELL_SIZE))
	var ccz := int(floor(pos.z / SPATIAL_CELL_SIZE))
	var cell_radius := int(ceil(radius / SPATIAL_CELL_SIZE))
	var tag: String = ALL_GROUPS if group_tag.is_empty() else group_tag
	for dx: int in range(-cell_radius, cell_radius + 1):
		for dz: int in range(-cell_radius, cell_radius + 1):
			var buckets: Dictionary = _spatial_grid.get((ccx + dx) * 4096 + ccz + dz, {})
			if buckets.is_empty():
				continue
			var list: Variant = buckets.get(tag)
			if list == null:
				continue
			for agent in list:
				if not is_instance_valid(agent):
					continue
				var n3d: Node3D = agent
				if not n3d.is_inside_tree():
					continue
				if n3d.global_position.distance_squared_to(pos) <= r2:
					results.append(n3d)
	return results

func get_nearby_agents_fast(pos: Vector3, radius: float, candidates: Array, group_tag: String = "") -> Array[Node3D]:
	var r2 := radius * radius
	var results: Array[Node3D] = []
	for agent in candidates:
		if not is_instance_valid(agent):
			continue
		if not agent is Node3D:
			continue
		var n3d := agent as Node3D
		if not n3d.is_inside_tree():
			continue
		if n3d.global_position.distance_squared_to(pos) <= r2:
			if group_tag.is_empty() or n3d.is_in_group(group_tag):
				results.append(n3d)
	return results

func _mutate(val: float) -> float:
	return val * (0.9 + randf() * 0.2)

func _apply_phenotype_variance(agent: Node, parent: Node = null) -> void:
	var base: Dictionary = {}
	if parent != null:
		# Inherit from parent
		for p: String in ["metabolism_rate", "repro_threshold", "walk_speed", "wander_speed", "travel_speed", "patrol_speed", "fly_speed", "crawl_speed", "drift_speed", "drift_downward", "anchor_duration", "hunt_speed", "flee_speed", "charge_speed", "graze_rate"]:
			var pv = parent.get(p)
			if pv != null:
				base[p] = _mutate(pv)
	for k: String in base.keys():
		if agent.get(k) != null:
			agent.set(k, base[k])
	if base.is_empty():
		# No parent: random founder variance
		if agent.is_in_group("sheep"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.walk_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("wolf"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.wander_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("human"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.travel_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("falcon"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.patrol_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("robin"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.fly_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("boar"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.walk_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("worm"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.crawl_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("fish"):
			agent.metabolism_rate *= 0.85 + randf() * 0.3
			agent.repro_threshold *= 0.9 + randf() * 0.2
			agent.swim_speed *= 0.9 + randf() * 0.2
		elif agent.is_in_group("spore"):
			agent.drift_speed *= 0.9 + randf() * 0.2
			agent.drift_downward *= 0.9 + randf() * 0.2
			agent.anchor_duration *= 0.9 + randf() * 0.2
	# Age variance for founders and migration: prevents mass synchronized die-offs
	if parent == null and agent.get("_age") != null and agent.get("_lifespan") != null:
		agent._age = randf() * agent._lifespan * 0.5

func _apply_campaign_traits(agent: Node, species: String) -> void:
	var gc = get_node_or_null("/root/GameConfig")
	if gc == null or gc.current_mode != "campaign":
		return
	if gc.campaign_faction != species:
		return
	var traits: Dictionary = gc.campaign_traits
	var health_mult: float = traits.get("health_boost", 1.0)
	var speed_mult: float = traits.get("speed_boost", 1.0)
	var lifespan_mult: float = traits.get("lifespan_boost", 1.0)
	if agent.get("health") != null:
		agent.health *= health_mult
	if agent.get("max_health") != null:
		agent.max_health *= health_mult
	if agent.get("_lifespan") != null:
		agent._lifespan *= lifespan_mult
	# Apply speed boost to all movement-related properties
	for prop: String in ["walk_speed", "wander_speed", "travel_speed", "patrol_speed", "fly_speed", "crawl_speed", "hunt_speed", "flee_speed", "charge_speed", "graze_rate", "drift_speed"]:
		if agent.get(prop) != null:
			agent.set(prop, agent.get(prop) * speed_mult)

func _end_simulation() -> void:
	if _simulation_ended:
		return
	_simulation_ended = true
	last_holds = _compute_holds()
	var counts: Dictionary = get_creature_counts()
	var winner: String = ""
	var best: float = 0.0
	var best_count: int = -1
	for sp: String in HOLD_ORDER:
		var h: float = float(last_holds.get(sp, 0.0))
		var n: int = int(counts.get(sp, 0))
		if h > best or (is_equal_approx(h, best) and n > best_count):
			best = h
			best_count = n
			winner = sp
	if best <= 0.0:
		winner = ""
	simulation_ended.emit(winner)

func _compute_holds() -> Dictionary:
	var counts: Dictionary = get_creature_counts()
	var holds: Dictionary = {}
	for sp: String in HOLD_ORDER:
		var cap: float = float(HOLD_CAPACITY[sp])
		holds[sp] = float(counts.get(sp, 0)) / cap
	return holds

func champion_line(champion: String) -> String:
	var holds: Dictionary = _compute_holds()
	var key := _bet_key(champion)
	var champ_pct: int = int(round(100.0 * float(holds.get(key, 0.0))))
	var lead := ""
	var lead_h: float = -1.0
	for sp: String in HOLD_ORDER:
		var h: float = float(holds.get(sp, 0.0))
		if h > lead_h:
			lead_h = h
			lead = sp
	var lead_pct: int = int(round(100.0 * maxf(lead_h, 0.0)))
	if lead.is_empty() or lead_h <= 0.0:
		return "Champion: %s\nThe valley is empty." % champion.capitalize()
	return "Champion: %s  %d%%\nLeading: %s  %d%%" % [champion.capitalize(), champ_pct, lead.capitalize(), lead_pct]

func _bet_key(bet: String) -> String:
	match bet.to_lower():
		"wolf", "wolves":
			return "wolves"
		"human", "humans":
			return "humans"
		"falcon", "falcons":
			return "falcons"
		"robin", "robins":
			return "robins"
		"boar", "boars":
			return "boars"
		"rabbit", "rabbits":
			return "rabbits"
		"worm", "worms":
			return "worms"
		"fish":
			return "fish"
		_:
			return "sheep"

func _update_season(dt: float) -> void:
	_season_day += dt * DAYS_PER_SECOND
	if _season_day >= SEASON_LENGTH:
		_season_day -= SEASON_LENGTH
		_season_index = (_season_index + 1) % SEASONS.size()
		_current_season = SEASONS[_season_index]
		touches_left = 1
		FXManager.show_dramatic_text(Vector3.ZERO, _current_season + ". One touch.", Color(0.9, 0.85, 0.5))
	match _current_season:
		"Spring":
			_season_grass = 1.5
			_metabolism_mult = 1.0
		"Summer":
			_season_grass = 1.0
			_metabolism_mult = 1.3
		"Autumn":
			_season_grass = 0.8
			_metabolism_mult = 1.1
		"Winter":
			_season_grass = 0.3
			_metabolism_mult = 1.4
	_recompute_grass_boost()

func _recompute_grass_boost() -> void:
	var boost: float = _season_grass
	if _rain_timer > 0.0:
		boost *= 2.2
	if _famine_timer > 0.0:
		boost *= 0.25
	_grass_boost = boost

func get_season() -> String:
	return _current_season

func get_grass_boost() -> float:
	return _grass_boost

func get_metabolism_mult() -> float:
	return _metabolism_mult

# ------------------------------------------------------------------
# Player powerups
# ------------------------------------------------------------------
var _rain_timer: float = 0.0
var _famine_timer: float = 0.0
var _flood_timer: float = 0.0

func _spawn_fish(count: int) -> int:
	if _fish_pool == null or valley == null or valley.river == null:
		return 0
	var spawned := 0
	for i: int in count:
		var fish: Node = _fish_pool.acquire()
		if fish == null:
			continue
		$Agents.add_child(fish)
		if fish is Node3D:
			fish.visible = true
			fish.global_position = valley.river.random_point()
		_track_agent(fish, _active_fish)
		_apply_phenotype_variance(fish, null)
		_apply_campaign_traits(fish, "fish")
		spawned += 1
	return spawned

func spawn_fish_offspring(parent: Node, pos: Vector3) -> void:
	if _fish_pool == null:
		return
	var fish: Node = _fish_pool.acquire()
	if fish == null:
		return
	$Agents.add_child(fish)
	if fish is Node3D:
		fish.visible = true
		var at := pos
		if valley != null and valley.river != null:
			at = valley.river.sample(pos.x, pos.z).closest
		fish.global_position = at
	_track_agent(fish, _active_fish)
	_apply_phenotype_variance(fish, parent)
	_apply_campaign_traits(fish, "fish")
	agent_born.emit("fish", pos, "")

func _set_flood_scale(scale: float) -> void:
	if valley == null or valley.river == null:
		return
	valley.river.set_flood(scale, grass)
	# The grass mask is baked, so re-bake it when the water moves.
	if grass != null:
		grass._apply_valley_mask()

func trigger_flood() -> void:
	_flood_timer = 8.0
	_set_flood_scale(2.35)
	FXManager.show_dramatic_text(Vector3.ZERO, "The river floods the meadow.", Color(0.35, 0.6, 0.85))

func trigger_rain() -> void:
	_rain_timer = 5.0
	_recompute_grass_boost()

func trigger_famine() -> void:
	# Halve the season's grass for 10 days. Stacks with rain by multiplying.
	_famine_timer = 10.0
	_recompute_grass_boost()

func trigger_predator_call() -> void:
	if _wolf_pool == null:
		return
	for i in range(2):
		var w: Node = _wolf_pool.acquire()
		if w == null:
			continue
		$Agents.add_child(w)
		if w is Node3D:
			w.visible = true
			w.global_position = Vector3((randf() - 0.5) * 40.0, 0.0, (randf() - 0.5) * 40.0)
		_track_agent(w, _active_wolves)
		_apply_phenotype_variance(w)
		_apply_campaign_traits(w, "wolf")

func trigger_heal() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var bet: String = "" if gc == null else gc.player_bet.to_lower()
	if bet.is_empty():
		return
	var target_group: String = _group_for_bet(bet)
	for data: AgentData in _agent_registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		if data.node.is_in_group(target_group):
			if data.node.get("health") != null:
				data.node.health = minf(data.node.health + 25.0, 100.0)
			if data.node.get("energy") != null:
				data.node.energy = minf(data.node.energy + 25.0, 100.0)

func _group_for_bet(bet: String) -> String:
	match bet.to_lower():
		"wolves", "wolf":
			return "wolf"
		"humans", "human":
			return "human"
		"falcons", "falcon":
			return "falcon"
		"robins", "robin":
			return "robin"
		"boars", "boar":
			return "boar"
		"rabbits", "rabbit":
			return "rabbit"
		"worms", "worm":
			return "worm"
		"fish":
			return "fish"
		"sheep":
			return "sheep"
		_:
			return bet.to_lower()

func trigger_meteor() -> void:
	# Cull a fifth of whoever currently holds the valley, not whoever has the most bodies.
	var holds: Dictionary = _compute_holds()
	var counts: Dictionary = get_creature_counts()
	var target_key: String = ""
	var best: float = 0.0
	for sp: String in HOLD_ORDER:
		var h: float = float(holds.get(sp, 0.0))
		if h > best:
			best = h
			target_key = sp
	if target_key.is_empty() or best <= 0.0:
		return
	var agent_species: String = _group_for_bet(target_key)
	var max_count: int = int(counts.get(target_key, 0))
	var kill_target: int = maxi(1, int(max_count * 0.2))
	var killed: int = 0
	for data: AgentData in _agent_registry:
		if killed >= kill_target:
			break
		if data.node == null or not is_instance_valid(data.node):
			continue
		if data.species == agent_species:
			data.node.health = 0.0
			if data.node.has_method("_die"):
				data.node._die()
			killed += 1
	emit_signal("combat_event", "meteor", target_key, Vector3.ZERO, true)

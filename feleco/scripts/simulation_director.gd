class_name SimulationDirector
extends Node3D

signal population_changed(faction: String, count: int)
signal time_updated(days_remaining: float)
signal simulation_ended(winner: String)
# A rampage just ended: whose, how many it devoured, and whether it won.
signal rampage_result(who: String, kills: int, won: bool)
signal agent_born(species: String, pos: Vector3, variant: String)
signal agent_died(species: String, pos: Vector3)
signal combat_event(attacker_species: String, target_species: String, pos: Vector3, killed: bool)
signal settlement_built(pos: Vector3)
signal extinction_event(species: String)
signal overpopulation_event(species: String)
signal season_changed(season: String)
signal chronicle(text: String)
signal season_event(text: String, species: String)
# A golden tuft, berry or apple, or star moss was eaten (3.0).
signal golden_found(kind: String, eater: String, pos: Vector3)
signal drought_started()
# Gold moved from one link of the food web to the next (source -> eater).
signal gold_passed(source: String, eater: String, pos: Vector3)
var gold_links: Dictionary = {}

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
var cfg_fish: int = 8
# Counts for the 3.0 species (SpeciesDB.NEW_SPECIES), keyed by id.
var cfg_extra: Dictionary = {}
var cfg_trees: int = 6
var cfg_bushes: int = 5
# Chance multiplier for golden grass, fruit and star moss.
var golden_mult: float = 1.0
# Species switched off for the whole run: they never spawn or migrate in.
var disabled_species: Dictionary = {}
var golden_finds: int = 0
# The wind field that carries seeds (see Wind).
var wind: Wind = null
var riverweeds: Riverweeds = null
# Fruit bookkeeping, to check the orchard is feeding anyone.
var apples_dropped: int = 0
var apples_eaten: int = 0
var berries_dropped: int = 0
var berries_eaten: int = 0
var cfg_bet: String = ""
var cfg_grass_density: float = 0.5
var cfg_time_limit: float = 120.0
var cfg_preset: String = "Random Scatter"

# Runtime tracking
var _elapsed: float = 0.0
# Two clocks (see Clock): _sim_day counts *life time* (the unit lifespans,
# migrations and tribe ages were tuned in), _clock_s counts real seconds of
# the run, which make calendar days of sun and moon.
var _sim_day: float = 0.0
var _clock_s: float = 0.0
const DAYS_PER_SECOND: float = 1.0 / Clock.SECONDS_PER_DAY
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
	"wolf": 45,
	"human": 45,
	"spore": 150,
	"falcon": 70,
	"robin": 120,
	"boar": 50,
	"worm": 120,
	"rabbit": 50,
}
# Overpopulation mortality is modeled with a logistic sigmoid:
# mortality_rate = max_mortality / (1 + exp(-steepness * (population - midpoint)))
# where midpoint = capacity * 1.3 (mortality kicks in 30% above carrying capacity)
const OVERPOP_STEEPNESS: float = 0.08
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
# A run is one compressed year: each season is a quarter of it (in days).
var SEASON_LENGTH: float = 3.0
var _season_event_done: bool = false
const SEASONS: Array[String] = ["Spring", "Summer", "Autumn", "Winter"]
var _season_index: int = 0
var _season_grass: float = 1.5
var _grass_boost: float = 1.0
var _metabolism_mult: float = 1.0
var touches_left: int = 1
var valley: ValleyTerrain = null
var last_holds: Dictionary = {}
# King of the hill: sim days each species spent as the valley's dominant population.
signal control_changed(leader: String)
var control_days: Dictionary = {}
var current_leader: String = ""
var _control_accum: float = 0.0
const CONTROL_SAMPLE_DAYS: float = 0.05

# Hold is population / what that species can carry. Raw headcount made
# rabbits and sheep the only serious bets. These match CARRYING_CAPACITY.
const HOLD_CAPACITY: Dictionary = {
	"sheep": 6.0,
	"wolves": 12.7,
	"humans": 17.0,
	"falcons": 14.0,
	"robins": 7.4,
	"boars": 8.3,
	"rabbits": 34.0,
	"worms": 24.0,
	"fish": 26.0,
	"deer": 9.0,
	"goats": 8.0,
	"bears": 3.0,
	"lions": 2.5,
	"beetles": 24.0,
}
const HOLD_ORDER: Array[String] = ["sheep", "wolves", "humans", "falcons", "robins", "boars", "rabbits", "worms", "fish", "deer", "goats", "bears", "lions", "beetles"]
const MIGRANT_COUNTS: Dictionary = {
	"sheep": 4,
	"wolves": 2,
	"rabbits": 3,
	"humans": 2,
	"falcons": 2,
	"boars": 2,
	"robins": 4,
	"worms": 5,
	"fish": 4,
}
const MIGRATION_WAIT_DAYS: float = 12.0
const MIGRATION_CHANCE: float = 0.3
var _ever_lived: Dictionary = {}
var _extinct_since: Dictionary = {}
var _migration_lock_until: Dictionary = {}
# Set while the valley is sending one species away. Empty means nobody leaves.
var _emigrant_species: String = ""
var _emigrate_said: bool = false

# Presence grid: coarse occupancy for O(1) vision queries.
# The window has to cover the whole walkable valley. A grid that stopped
# inside the slopes treated the outside as empty, and crowding then shoved
# the outer animals further out until the hard edge parked them in a ring.
const PRESENCE_CELL_SIZE: float = 5.0
const PRESENCE_HALF: int = int(ceil((ValleyTerrain.WALK_RADIUS + 10.0) / PRESENCE_CELL_SIZE))
const PRESENCE_N: int = PRESENCE_HALF * 2
# Per-species counts: slot (from _presence_slots) * PRESENCE_N^2 + cell.
var _presence_slots: Dictionary = {}
var _presence_counts: PackedInt32Array = PackedInt32Array()
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
# The 3.0 species share one generic path: id -> {scene, pool, active}.
var _extra: Dictionary = {}

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
	# The dev sim harness runs headless with the real game config (--sim).
	_headless_mode = DisplayServer.get_name() == "headless" and not OS.get_cmdline_user_args().has("--sim")
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
		cfg_fish = 8
		for id: String in SpeciesDB.NEW_SPECIES:
			cfg_extra[id] = int(SpeciesDB.row(id).get("start", 0))
		cfg_trees = 6
		cfg_grass_density = 0.5
		cfg_time_limit = Clock.STANDARD_DAYS
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
	for id: String in SpeciesDB.NEW_SPECIES:
		var sc: PackedScene = load("res://scenes/%s.tscn" % id)
		_extra[id] = {"scene": sc, "pool": NodePool.new(sc, id, POOL_SIZE), "active": []}
	for id: String in SpeciesDB.SEASONAL:
		var sc: PackedScene = load("res://scenes/%s.tscn" % id)
		_extra[id] = {"scene": sc, "pool": NodePool.new(sc, id, SeasonalSprite.MAX_ALIVE + 6), "active": []}

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
		for id: String in SpeciesDB.NEW_SPECIES:
			cfg_extra[id] = int(gc.extra_counts.get(id, SpeciesDB.row(id).get("start", 0)))
		cfg_trees = gc.tree_count
		cfg_bushes = gc.bush_count
		golden_mult = gc.golden_mult * (1.5 if gc.owned_upgrades.get("green_thumb", false) else 1.0)
		for id in gc.disabled_species:
			disabled_species[str(id)] = true
		_apply_disabled()
		if not str(gc.scenario_id).is_empty() and gc.current_mode == "challenge":
			scenario_id = gc.scenario_id
			var setup: Dictionary = ChallengeScenarios.find(scenario_id).get("setup", {})
			drought_chance = float(setup.get("drought_chance", drought_chance))
			_scenario_events = ChallengeScenarios.events_for(scenario_id, cfg_time_limit)
		cfg_bet = gc.player_bet
		cfg_grass_density = gc.grass_density
		# The producer boon (Seedling Golf): more trees and a richer meadow.
		if gc.current_mode == "sandbox":
			var pb: Dictionary = gc.link_boons().get("producer", {})
			cfg_trees += int(pb.get("trees", 0))
			cfg_grass_density = minf(cfg_grass_density + float(pb.get("grass", 0.0)), 1.0)
		cfg_time_limit = gc.time_limit
		cfg_preset = gc.map_preset

	bet_tracker = BetTracker.new()
	add_child(bet_tracker)

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
	if not has_node("Bushes"):
		var bushes := Node3D.new()
		bushes.name = "Bushes"
		add_child(bushes)
	golden_found.connect(_on_golden_found)
	gold_passed.connect(_on_gold_passed)
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
	wind = Wind.new()
	wind.name = "Wind"
	wind.director = self
	add_child(wind)

	# Seed grass with clustered patchiness instead of uniform soup
	for gz: int in grass.grid_height:
		for gx: int in grass.grid_width:
			var noise := sin(gx * 0.35) * cos(gz * 0.28) + sin(gx * 0.13 + gz * 0.19) * 0.5
			var gp := grass.grid_to_world(gx, gz)
			var biome_cap: float = Biomes.grass_cap(gp.x, gp.z)
			var base: float = cfg_grass_density * grass.max_density * biome_cap * (0.3 + 0.7 * clampf((noise + 1.0) / 2.0, 0.0, 1.0))
			var idx := gz * grass.grid_width + gx
			grass._grid[idx] = base
			grass._nutrients[idx] = clampf(0.25 + randf() * 0.15 + base * 0.2, 0.0, 1.0)
			# The meadow starts grown, not as bare seed: tall where it's thick,
			# sprouting where it's thin (4.7.1).
			grass._cell_stage[idx] = 2.0 if base > grass.max_density * 0.3 else (1.0 if base > grass.max_density * 0.08 else 0.0)

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
	# CPUParticles draw through a MultiMesh with colours and custom data.
	if weather != null:
		for p in weather.get_children():
			if p is CPUParticles3D and (p as CPUParticles3D).mesh != null:
				var pmmi := MultiMeshInstance3D.new()
				var pmm := MultiMesh.new()
				pmm.transform_format = MultiMesh.TRANSFORM_3D
				pmm.use_colors = true
				pmm.use_custom_data = true
				pmm.mesh = (p as CPUParticles3D).mesh
				pmm.instance_count = 1
				pmm.set_instance_transform(0, Transform3D())
				pmmi.multimesh = pmm
				holder.add_child(pmmi)
	var instanced: Array[GeometryInstance3D] = []
	var copses: Node = valley.get_node_or_null("Copses") if valley != null else null
	for layer: Node in [grass, mycelium, _visual_proxy_manager, copses]:
		if layer == null:
			continue
		for child in layer.get_children():
			if child is MultiMeshInstance3D:
				instanced.append(child)
	for src in instanced:
		var mmi := MultiMeshInstance3D.new()
		var mm := MultiMesh.new()
		var src_mm: MultiMesh = (src as MultiMeshInstance3D).multimesh
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.use_custom_data = src_mm.use_custom_data
		mm.mesh = src_mm.mesh
		mm.instance_count = 1
		mm.set_instance_transform(0, Transform3D())
		mm.set_instance_color(0, Color.WHITE)
		if mm.use_custom_data:
			mm.set_instance_custom_data(0, Color(1, 0, 0, 0))
		mmi.multimesh = mm
		mmi.material_override = src.material_override
		holder.add_child(mmi)
	# A few frames is enough for every program to be linked once.
	get_tree().create_timer(0.5).timeout.connect(holder.queue_free)

# The river and its flood plain belong to the fish: anything placed there
# (huts, trees, newcomers) is moved out to dry ground past the flood line.
# Room a hut needs: no tree or bush may take root inside this radius.
const HUT_CLEARANCE: float = 4.5

# Where a tree or bush may take root: on dry land and never inside a hut.
func tree_spot(pos: Vector3) -> Vector3:
	var p := dry_land(pos)
	for s in _active_shelters:
		if s == null or not is_instance_valid(s):
			continue
		var away := Vector3(p.x - s.global_position.x, 0.0, p.z - s.global_position.z)
		if away.length() < HUT_CLEARANCE:
			if away.length_squared() < 0.01:
				away = Vector3(randf() - 0.5, 0.0, randf() - 0.5)
			p = s.global_position + away.normalized() * (HUT_CLEARANCE + 0.5)
			p = dry_land(Vector3(p.x, pos.y, p.z))
	return p

func in_hut(pos: Vector3) -> bool:
	for s in _active_shelters:
		if s != null and is_instance_valid(s) and Vector2(pos.x - s.global_position.x, pos.z - s.global_position.z).length() < HUT_CLEARANCE - 0.5:
			return true
	return false

# A new hut clears the young growth from its plot (grown trees are felled
# for the timber anyway, so only seeds and saplings stand in the way).
func _clear_hut_plot(pos: Vector3) -> void:
	for group: Node in [$Trees, $Bushes]:
		for t in group.get_children():
			if t is Node3D and Vector2(t.global_position.x - pos.x, t.global_position.z - pos.z).length() < HUT_CLEARANCE:
				t.queue_free()

func dry_land(pos: Vector3, margin: float = 1.5) -> Vector3:
	if valley == null or valley.river == null:
		return pos
	var river: River = valley.river
	var wet: Dictionary = river.sample(pos.x, pos.z)
	var keep_out: float = River.BASE_HALF_WIDTH * FLOOD_PEAK + margin
	var d: float = float(wet.distance)
	if d >= keep_out:
		return pos
	var bank: Vector3 = wet.closest
	var away := Vector3(pos.x - bank.x, 0.0, pos.z - bank.z)
	if away.length_squared() < 0.0001:
		var tg: Vector3 = wet.tangent
		away = Vector3(-tg.z, 0.0, tg.x) * (1.0 if randf() < 0.5 else -1.0)
	var out := bank + away.normalized() * (keep_out + 0.5)
	return Vector3(out.x, pos.y, out.z)

# Humans never bed down in the channel, on the bank, or inside the flood's reach.
func sleep_keep_out() -> float:
	return River.BASE_HALF_WIDTH * FLOOD_PEAK + 4.0

func too_wet_to_sleep(pos: Vector3) -> bool:
	if valley == null or valley.river == null:
		return false
	return float(valley.river.sample(pos.x, pos.z).distance) < sleep_keep_out()

func dry_sleep_spot(pos: Vector3) -> Vector3:
	var spot := dry_land(pos, 6.0)
	spot.y = ground_height(spot.x, spot.z)
	return spot

func hearth_for(human: Node3D) -> Vector3:
	var best: Node3D = null
	var best_d := INF
	var tid: int = int(human.get("_settlement_id"))
	for s in _active_shelters:
		if not is_instance_valid(s):
			continue
		var hut := s as Node3D
		var own: bool = int(hut.get_meta("settlement_id", 0)) == tid
		var d: float = hut.global_position.distance_to(human.global_position) + (0.0 if own else 18.0)
		if d < best_d:
			best_d = d
			best = hut
	var at := best.global_position + Vector3(2.2, 0, 2.4) if best != null else human.global_position
	if too_wet_to_sleep(at):
		at = dry_sleep_spot(at)
	return at

func store_cooked(human: Node3D, id: String) -> void:
	if not Kitchen.can_cook(id):
		return
	var meal := Kitchen.nutrition(id)
	var hut := _nearest_hut(human, 28.0)
	if hut == null or human.get("energy") != null and float(human.energy) < 38.0:
		human.energy = minf(float(human.energy) + meal, 100.0)
		FXManager.show_floating_text(human.global_position + Vector3.UP * 2.0, Kitchen.label(id), Color(0.95, 0.72, 0.35))
		return
	var pantry: Dictionary = hut.get_meta("pantry", {})
	pantry[id] = int(pantry.get(id, 0)) + 1
	hut.set_meta("pantry", pantry)
	CookedFoodArt.show_pantry(hut)
	if float(human.energy) < 52.0:
		_eat_one(human, hut)
	else:
		FXManager.show_floating_text(human.global_position + Vector3.UP * 2.0, "Stored", Color(0.95, 0.8, 0.45))

func nibble_pantry(human: Node3D) -> bool:
	if float(human.get("energy")) >= 46.0:
		return false
	var hut := _nearest_stocked_hut(human)
	if hut == null:
		return false
	if human.global_position.distance_to(hut.global_position) > 2.4:
		var to := hut.global_position - human.global_position
		to.y = 0.0
		human.velocity = to.normalized() * float(human.get("travel_speed"))
		return true
	return _eat_one(human, hut)

func _nearest_hut(human: Node3D, limit: float) -> Node3D:
	var best: Node3D = null
	var best_d := limit
	for s in _active_shelters:
		if not is_instance_valid(s):
			continue
		var d: float = (s as Node3D).global_position.distance_to(human.global_position)
		if d < best_d:
			best_d = d
			best = s
	return best

func _nearest_stocked_hut(human: Node3D) -> Node3D:
	var best: Node3D = null
	var best_d := 16.0
	for s in _active_shelters:
		if not is_instance_valid(s):
			continue
		var pantry: Dictionary = (s as Node3D).get_meta("pantry", {})
		if pantry.is_empty():
			continue
		var d: float = (s as Node3D).global_position.distance_to(human.global_position)
		if d < best_d:
			best_d = d
			best = s
	return best

func _eat_one(human: Node3D, hut: Node3D) -> bool:
	var pantry: Dictionary = hut.get_meta("pantry", {})
	for key: Variant in pantry.keys():
		if int(pantry[key]) <= 0:
			continue
		pantry[key] = int(pantry[key]) - 1
		if int(pantry[key]) <= 0:
			pantry.erase(key)
		hut.set_meta("pantry", pantry)
		human.energy = minf(float(human.energy) + Kitchen.nutrition(str(key)), 100.0)
		CookedFoodArt.show_pantry(hut)
		FXManager.show_floating_text(human.global_position + Vector3.UP * 2.0, Kitchen.label(str(key)), Color(0.95, 0.72, 0.35))
		return true
	return false

func ground_height(x: float, z: float) -> float:
	if valley != null:
		return valley.surface_height(x, z)
	return 0.0

func _add_valley() -> void:
	valley = ValleyTerrain.new()
	valley.name = "Valley"
	add_child(valley)
	weather = Weather.new()
	weather.name = "Weather"
	add_child(weather)
	_apply_season_mood.call_deferred(_current_season, true)
	if grass != null:
		Biomes.valley = valley
		grass.bind_valley(ValleyTerrain.WALK_RADIUS - 2.0, Callable(valley, "surface_height"))
		if valley.river != null:
			valley.river.bake(grass)
			grass.bind_water(Callable(valley.river, "covers_world"))
			riverweeds = Riverweeds.new()
			valley.add_child(riverweeds)
			riverweeds.plant(valley.river)
		if mycelium != null:
			mycelium.heights = grass._heights

func _snap_to_ground(node: Node) -> void:
	if valley == null or not node is Node3D:
		return
	if node is MarkovAgent and ((node as MarkovAgent)._aerial or (node as MarkovAgent)._aquatic):
		return
	var body := node as Node3D
	var p := body.global_position
	p.y = valley.surface_height(p.x, p.z)
	body.global_position = p

func _deferred_spawn_entities() -> void:
	spawn_entities()

func spawn_trees() -> void:
	if grass != null:
		grass.golden_mult = golden_mult
	if _tree_scene == null:
		return
	# The starting woods by biome: riverbank groves, a few plains trees, and
	# conifer stands up in the highlands; bushes mostly out on the plains.
	for i: int in range(cfg_trees + cfg_trees / 2):
		var biome: String = [Biomes.RIVERBANK, Biomes.RIVERBANK, Biomes.RIVERBANK, Biomes.PLAINS, Biomes.MOUNTAIN, Biomes.MOUNTAIN][i % 6]
		var t = _tree_scene.instantiate()
		t.conifer = biome == Biomes.MOUNTAIN
		$Trees.add_child(t)
		t.global_position = tree_spot(_spot_in(biome))
		_snap_to_ground(t)
	for i: int in range(cfg_bushes):
		plant_bush(_spot_in([Biomes.PLAINS, Biomes.PLAINS, Biomes.RIVERBANK][i % 3]), true)

# A random dry spot in a biome.
func _spot_in(biome: String) -> Vector3:
	for k: int in 60:
		var r: float = sqrt(randf()) * (ValleyTerrain.FLOOR_RADIUS - 3.0) if biome != Biomes.MOUNTAIN else randf_range(ValleyTerrain.FLOOR_RADIUS + 4.0, ValleyTerrain.WALK_RADIUS - 6.0)
		var a: float = randf() * TAU
		var p := dry_land(Vector3(cos(a) * r, 0.0, sin(a) * r))
		if Biomes.at(p.x, p.z) == biome:
			return p
	return dry_land(Vector3(randf_range(-20, 20), 0, randf_range(-20, 20)))

const MAX_BUSHES: int = 30

# Berry bushes: a low tree kept in $Bushes so it never counts as woodland
# (no nests, no timber). Berries that rot where they fall plant new ones.
func plant_bush(pos: Vector3, grown: bool = false) -> Node:
	if _tree_scene == null or $Bushes.get_child_count() >= MAX_BUSHES or (not grown and not tree_planting):
		return null
	if not grown:
		pos = wind.seed_drift(pos) if wind != null else pos
		if randf() > 0.3 * float(BUSH_TAKE.get(Biomes.at(pos.x, pos.z), 1.0)):
			return null
	var b = _tree_scene.instantiate()
	b.bush = true
	b.apple_spawn_interval = 2.5
	$Bushes.add_child(b)
	b.global_position = tree_spot(pos + (Vector3.ZERO if grown else Vector3((randf() - 0.5) * 3.0, 0.0, (randf() - 0.5) * 3.0)))
	_snap_to_ground(b)
	if not grown:
		b.set_stage(0)
	return b

func find_nearest_berry(pos: Vector3, radius: float = 8.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "berry"):
		if not is_instance_valid(node):
			continue
		var d_sq := pos.distance_squared_to(node.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = node
	return best

# Gold's path through the food web, e.g. "grass>sheep", "sheep>wolf", "wolf>beetle".
func _on_gold_passed(source: String, eater: String, pos: Vector3) -> void:
	# Fruit and moss report their own finds; golden grass is found by grazing.
	if source == "grass":
		_on_golden_found("golden grass", eater, pos)
	var key := "%s>%s" % [source, eater]
	gold_links[key] = int(gold_links.get(key, 0)) + 1
	if gold_links[key] == 1 and not source.is_empty():
		chronicle.emit("Gold passes from %s to %s." % [source, SpeciesDB.label(eater).to_lower()])

# Creatures carrying gold right now, per species id.
func golden_census() -> Dictionary:
	var out: Dictionary = {}
	for data: AgentData in _agent_registry:
		if data.golden > 0.05:
			out[data.species] = int(out.get(data.species, 0)) + 1
	return out

func _on_golden_found(kind: String, eater: String, pos: Vector3) -> void:
	golden_finds += 1
	FXManager.show_dramatic_text(pos + Vector3.UP * 2.0, "Golden find: %s!" % kind.capitalize(), Color(1.0, 0.84, 0.25))
	if not eater.is_empty():
		chronicle.emit("A %s finds %s." % [SpeciesDB.label(eater).to_lower().trim_suffix("s"), kind])

# Arborist Failsafe: when no trees exist, settlements can spontaneously
# generate protected arboreal seeds. Also called when agents eat apples.
# The meadow holds this many trees; seeds that fall on a full valley don't take.
const MAX_TREES: int = 48

# Off while the opening film is staged, so no sapling sprouts mid-shot.
var tree_planting: bool = true

# Pineapples (4.7): a pinecone and an apple rotting near each other may both
# sprout, and the meeting of the two seedlings grows a pineapple tree instead.
# The first one only ever appears on the plains; after that anywhere.
const SPROUT_MEMORY: float = 240.0
const SPROUT_MEET: float = 8.0
const PINEAPPLE_CHANCE: float = 0.35
var pineapples_born: int = 0
var _sprouts: Array = []  # [pos, "conifer"/"apple", time]

# What a fallen seed grows into here, or "" if it doesn't take.
func sprout_kind(fruit: String, at: Vector3) -> String:
	var biome: String = Biomes.at(at.x, at.z)
	var grows: String = "pineapple" if fruit == "pineapple" else ("conifer" if fruit == "pinecone" else "apple")
	if grows == "pineapple":
		return grows
	# Off home ground a seed rarely takes: conifers wandering down to the
	# meadow, apples blown up the mountain.
	if (grows == "conifer") != (biome == Biomes.MOUNTAIN) and randf() > 0.2:
		return ""
	var now: float = _clock_s
	_sprouts = _sprouts.filter(func(s: Array) -> bool: return now - float(s[2]) < SPROUT_MEMORY)
	var other: String = "apple" if grows == "conifer" else "conifer"
	for s: Array in _sprouts:
		if s[1] == other and (s[0] as Vector3).distance_to(at) < SPROUT_MEET:
			if (pineapples_born > 0 or biome == Biomes.PLAINS) and randf() < PINEAPPLE_CHANCE:
				_sprouts.erase(s)
				pineapples_born += 1
				if pineapples_born == 1:
					chronicle.emit("Something strange: where a pinecone and an apple rotted side by side, a PINEAPPLE tree is sprouting!")
					FXManager.show_floating_text(at + Vector3.UP * 2.0, "A Pineapple tree?!", Color(1.0, 0.85, 0.2))
				return "pineapple"
	_sprouts.append([at, grows, now])
	if _sprouts.size() > 40:
		_sprouts.pop_front()
	return grows

func can_plant_tree() -> bool:
	return tree_planting and $Trees.get_child_count() < MAX_TREES

# How readily a seed takes root in each biome: trees crowd the riverbank,
# stand sparse on the plains; bushes love the open plains.
const TREE_TAKE: Dictionary = {"riverbank": 1.6, "plains": 0.55, "mountain": 0.85}
const BUSH_TAKE: Dictionary = {"riverbank": 1.2, "plains": 1.5, "mountain": 0.25}

func try_plant_tree_seed(pos: Vector3, planter_group: String = "") -> bool:
	if not can_plant_tree():
		return false
	var chance: float = 0.0
	match planter_group:
		"human":
			chance = 0.85
		"sheep":
			chance = 0.5
		"boar":
			chance = 0.4
		"tree":
			chance = 0.72
		_:
			chance = 0.58
	var land: Vector3 = wind.seed_drift(pos) if wind != null else pos + Vector3((randf() - 0.5) * 4.0, 0.0, (randf() - 0.5) * 4.0)
	chance *= float(TREE_TAKE.get(Biomes.at(land.x, land.z), 1.0))
	if planter_group == "sprite":
		chance = 1.0
	if randf() > chance:
		return false
	if _tree_scene == null:
		return false
	var t = _tree_scene.instantiate()
	t.conifer = Biomes.at(land.x, land.z) == Biomes.MOUNTAIN
	$Trees.add_child(t)
	t.global_position = tree_spot(land)
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
	_clock_s += dt
	# Life runs slower than the clock; everything alive ticks on `bio`.
	var bio: float = dt * Clock.LIFE_PACE
	_sim_day += bio
	_step_daylight(dt)
	_control_accum += dt * DAYS_PER_SECOND
	if _control_accum >= CONTROL_SAMPLE_DAYS:
		_sample_control(_control_accum)
		_control_accum = 0.0
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
			_ca_dt = ca_cycle * Clock.LIFE_PACE
		if _ca_phase < GrassLayer.TICK_PARTS:
			grass.tick_part(_ca_phase, _ca_dt, grazing_pressure, _grass_boost)
		else:
			match _ca_phase - GrassLayer.TICK_PARTS:
				0:
					rot.tick(_ca_dt)
				1:
					mycelium.season_factor = fungal_factor()
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
	if not river_frozen:
		_step_river_swell(bio)
	if _rain_timer > 0.0:
		_rain_timer -= bio
		if _rain_timer <= 0.0:
			_rain_timer = 0.0
			_recompute_grass_boost()
	if _famine_timer > 0.0:
		_famine_timer -= bio
		if _famine_timer <= 0.0:
			_famine_timer = 0.0
			_recompute_grass_boost()
	if _drought_timer > 0.0:
		_drought_timer -= bio
		if _drought_timer <= 0.0:
			_drought_timer = 0.0
			_recompute_grass_boost()
			_apply_season_mood(_current_season, false)
			FXManager.show_dramatic_text(Vector3.ZERO, "The drought breaks.", Color(0.55, 0.75, 0.85))
			chronicle.emit("The heat lifts. Green creeps back into the meadow.")
	if _flood_timer > 0.0 and not river_frozen:
		_flood_timer -= bio
		if _flood_timer <= 0.0:
			_flood_timer = 0.0
			_flood_target = 1.0
			FXManager.show_dramatic_text(Vector3.ZERO, "The river falls back to its bed.", Color(0.55, 0.75, 0.85))
	if not river_frozen:
		_step_flood(dt)
		if riverweeds != null:
			riverweeds.tick(dt * Clock.LIFE_PACE)
	_overpop_timer += bio
	if _overpop_timer >= 2.0:
		_overpop_timer = 0.0
		_apply_overpopulation()
		_apply_emigration()
		_apply_pass_migration()
		_check_cloning_vat()
		_return_fish()
		_tribal_politics(2.0)
		_natural_rain_roll(2.0 / Clock.LIFE_PACE * DAYS_PER_SECOND)
		_natural_drought_roll(2.0 / Clock.LIFE_PACE * DAYS_PER_SECOND)
		_step_scenario()
		_mycelium_fruiting()
		_update_nesting()
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
		var snap := {"time": _elapsed}
		for k: String in h_counts.keys():
			if k == "wizards" or k == "builders":
				continue
			snap[k] = int(h_counts[k])
		if not snap.has("mushrooms"):
			snap["mushrooms"] = _active_spores.size()
		var ruled := get_group_scores()
		for g: String in SpeciesDB.GROUPS:
			snap["rule:" + g] = float(ruled[g])
		_population_history.append(snap)
	# The HUD rebuilds its clock and champion line on this signal; four times
	# a second is plenty and saves that work on most ticks.
	_time_emit_accum += dt
	if _time_emit_accum >= 0.25:
		_time_emit_accum = 0.0
		time_updated.emit(maxf(0.0, cfg_time_limit - get_day()))
	if get_day() >= cfg_time_limit:
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
		elif node.get_instance_id() % stagger == phase and data.species != "mushroom" and not node.rampage and not node.player_drive and not node.scripted:
			node._physics_process(dt * stagger)
		idx -= 1
	for child in spores.get_children():
		if child.get_instance_id() % spore_stagger == spore_phase and child is MarkovAgent and not child.scripted:
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
	for id: String in SpeciesDB.NEW_SPECIES:
		for i: int in range(int(cfg_extra.get(id, 0))):
			var pos: Vector3 = spawn_positions.pop_back() if not spawn_positions.is_empty() else Vector3((randf() - 0.5) * 40.0, 0.0, (randf() - 0.5) * 40.0)
			if id == "goat" and valley != null:
				# Goats come down from the crags: start them near a pass.
				pos = valley.random_pass_mouth()["position"] + Vector3((randf() - 0.5) * 6.0, 0.0, (randf() - 0.5) * 6.0)
			var a := _spawn_extra(id, pos)
			if a != null and roster_names.has(id) and not roster_names[id].is_empty():
				a.display_name = roster_names[id].pop_front()
	_spawn_fish(cfg_fish)
	_apply_roster_identities()
	_settle_biomes()

	# Auto-use powerups for challenge mode
	_auto_use_powerups()

# Everyone starts in one of its home biomes: goats and lions up in the
# highlands, deer on the plains and riverbank, and so on (see Biomes).
func _settle_biomes() -> void:
	for data: AgentData in _agent_registry:
		var n := data.node as Node3D
		if n == null or not is_instance_valid(n) or (n is MarkovAgent and (n as MarkovAgent).scripted):
			continue
		if data.species == "fish" or data.species == "mushroom":
			continue
		if not Biomes.fits(data.species, n.global_position.x, n.global_position.z):
			var p := Biomes.random_point(data.species, self)
			n.global_position = Vector3(p.x, ground_height(p.x, p.z), p.z)

# The betting table names a male and a female of each species, one of them a
# tough or special kind. Give the spawned creatures those identities so the
# creature on the felt is the one in the valley.
func _apply_roster_identities() -> void:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc == null:
		return
	for entry: Dictionary in gc.spawn_roster:
		if not entry.has("sex"):
			continue
		for data: AgentData in _agent_registry:
			if data.node == null or data.species != entry["species"] or data.node.display_name != entry["name"]:
				continue
			var ma := data.node as MarkovAgent
			ma.sex = entry["sex"]
			data.female = ma.sex == "female"
			var role: String = entry.get("role", "")
			if not role.is_empty():
				Roles.apply(ma, data.species, role)
				data.role = ma.role
				data.variant = ma.variant
			# Starters: their rolled health, speed and appetite (see BetBook.roll_starter).
			var st: Dictionary = entry.get("stats", {})
			if not st.is_empty():
				# Replace the random founder genome with the rolled one.
				var old := Genetics.expressed(ma.genes)
				if ma.get("health") != null:
					ma.set("health", float(ma.get("health")) / float(old["health"]))
				for sp_prop: String in Genetics.SPEED_PROPS:
					if ma.get(sp_prop) != null:
						ma.set(sp_prop, float(ma.get(sp_prop)) / float(old["speed"]))
				if ma.get("metabolism_rate") != null:
					ma.set("metabolism_rate", float(ma.get("metabolism_rate")) / float(old["appetite"]))
				var trait_name: String = String(entry.get("trait", {}).get("name", ""))
				Genetics.apply(ma, {"health": st["health"], "speed": st["speed"], "appetite": st["appetite"], "traits": [trait_name] if Genetics.TRAITS.has(trait_name) else []})
			break

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
				"drought": trigger_drought()
				"bloom": trigger_bloom()
				"stampede": trigger_stampede()
				"feast": trigger_feast()
				"rot_rain": trigger_rot_rain()
				"predator_call": trigger_predator_call()
				"heal": trigger_heal()
				"famine": trigger_famine()
				"meteor": trigger_meteor()
				"flood": trigger_flood()
				"eclipse": trigger_eclipse()
				"midnight_sun": trigger_midnight_sun()
				"full_moon": trigger_full_moon()
				"lantern_night": trigger_lantern_night()
		gc.powerup_inventory[key] = 0
	gc.save_meta()

func _generate_spawn_positions() -> Array[Vector3]:
	var positions: Array[Vector3] = []
	var world_half: float = 30.0
	var total_agents: int = cfg_sheep + cfg_wolves + cfg_humans + cfg_spores + cfg_falcons + cfg_robins + cfg_boars + cfg_worms + cfg_rabbits
	for id: String in cfg_extra.keys():
		total_agents += int(cfg_extra[id])
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
	# Nobody starts out in the river or on its flood plain.
	for i: int in positions.size():
		positions[i] = dry_land(positions[i])
	positions.shuffle()
	return positions

func spawn_corpse(pos: Vector3, energy: float, species: String = "", golden: float = 0.0) -> void:
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
		# Evicted carcasses still return to the soil before they go.
		if oldest.has_method("finish"):
			oldest.finish()
		else:
			oldest.queue_free()
		if oldest.get_parent() == corpses:
			corpses.remove_child(oldest)
	var corpse = _corpse_scene.instantiate()
	corpse.species = species
	corpse.golden = golden
	# Set before _ready, which reads it to fill the carcass.
	corpse.corpse_energy = energy
	corpses.add_child(corpse)
	# Snap corpses to the valley floor so aerial deaths don't float
	corpse.global_position = Vector3(pos.x, ground_height(pos.x, pos.z), pos.z)

# Mushrooms are a treat to find, not a carpet: the valley holds only so many.
const MAX_MUSHROOMS: int = 30

func spawn_mushroom_spore(parent: Node, pos: Vector3) -> void:
	if _spore_scene == null or _active_spores.size() >= MAX_MUSHROOMS:
		return
	# Mushrooms grow on the meadow only, never out on the mountainsides.
	var flat := Vector2(pos.x, pos.z)
	if flat.length() > ValleyTerrain.FLOOR_RADIUS - 1.0:
		return
	var spore = _spore_scene.instantiate()
	$Spores.add_child(spore)
	# Spores start just above the meadow wherever they land, never inside a slope.
	spore.global_position = Vector3(pos.x, ground_height(pos.x, pos.z) + 0.3, pos.z)
	# Tracked like any agent so it is drawn and leaves the count when it dies.
	_track_agent(spore, _active_spores)
	_apply_phenotype_variance(spore, parent)

# ------------------------------------------------------------------
# Tribes: every settlement is a tribe with a name and a banner colour.
# Big villages split into rival tribes; tribes raid each other and burn
# undefended huts. Huts count toward humanity's hold on the valley.
# ------------------------------------------------------------------
const TRIBE_FIRST: Array[String] = ["Ash", "Otter", "Red Hand", "Iron Fern", "Long Spear", "Crow", "Salt", "Thorn", "Elk", "Ember", "Mire", "Stone"]
const TRIBE_KIND: Array[String] = ["Clan", "Folk", "Kin", "Band", "Tribe", "Hold"]
var tribes: Dictionary = {}  # id -> {"name": String, "founded": day}
var _politics_timer: float = 0.0
const POLITICS_EVERY_DAYS: float = 4.0
const SPLIT_AT: int = 9
const WAR_SEASON_RAID: float = 0.3
const PEACE_SEASON_RAID: float = 0.08

func tribe_name(tid: int) -> String:
	if not tribes.has(tid):
		return "a wandering band"
	return "the " + String(tribes[tid]["name"])

func _new_tribe(tid: int) -> void:
	if tribes.has(tid):
		return
	var nm: String = "%s %s" % [TRIBE_FIRST[randi() % TRIBE_FIRST.size()], TRIBE_KIND[randi() % TRIBE_KIND.size()]]
	tribes[tid] = {"name": nm, "founded": _sim_day}

func tribe_members(tid: int) -> Array:
	var out: Array = []
	for h in _active_humans:
		if is_instance_valid(h) and int(h.get("_settlement_id")) == tid:
			out.append(h)
	return out

func tribe_huts(tid: int) -> Array:
	var out: Array = []
	for s in _active_shelters:
		if is_instance_valid(s) and int(s.get_meta("settlement_id", 0)) == tid:
			out.append(s)
	return out

func tribe_count() -> int:
	var live: Dictionary = {}
	for h in _active_humans:
		if is_instance_valid(h) and int(h.get("_settlement_id")) > 0:
			live[int(h.get("_settlement_id"))] = true
	return live.size()

func _tribal_politics(dt: float) -> void:
	_politics_timer += dt
	if _politics_timer < POLITICS_EVERY_DAYS:
		return
	_politics_timer = 0.0
	_active_shelters = _active_shelters.filter(func(s): return is_instance_valid(s))
	var ids: Dictionary = {}
	for h in _active_humans:
		if is_instance_valid(h) and int(h.get("_settlement_id")) > 0:
			ids[int(h.get("_settlement_id"))] = true
	for tid: int in ids.keys():
		var members: Array = tribe_members(tid)
		if members.size() >= SPLIT_AT:
			_split_tribe(tid, members)
	# Raids: a strong tribe sends warriors against its nearest rival.
	var raid_p: float = WAR_SEASON_RAID if _current_season == "Summer" else PEACE_SEASON_RAID
	for tid: int in ids.keys():
		var members: Array = tribe_members(tid)
		if members.size() < 5 or randf() > raid_p:
			continue
		var home: Vector3 = members[0]._settlement_center
		var target_tid: int = 0
		var best: float = 45.0 * 45.0
		for other: int in ids.keys():
			if other == tid:
				continue
			var their: Array = tribe_huts(other)
			if their.is_empty():
				continue
			var d: float = home.distance_squared_to((their[0] as Node3D).global_position)
			if d < best:
				best = d
				target_tid = other
		if target_tid == 0:
			continue
		var target_pos: Vector3 = (tribe_huts(target_tid)[0] as Node3D).global_position
		var sent: int = 0
		for h in members:
			if sent >= 2:
				break
			if h.variant == "wizard" or h.health < 50.0:
				continue
			h._raid_target = target_pos
			sent += 1
		if sent > 0:
			chronicle.emit("%s raid %s!" % [tribe_name(tid).capitalize(), tribe_name(target_tid)])
			FXManager.show_dramatic_text(target_pos + Vector3.UP * 3.0, "Raid!", Color(0.95, 0.4, 0.3))

# Three of a crowded village leave to found a rival tribe some way off.
func _split_tribe(tid: int, members: Array) -> void:
	var home: Vector3 = members[0]._settlement_center
	var site := Vector3.ZERO
	for attempt: int in 12:
		var ang: float = randf() * TAU
		var cand := home + Vector3(cos(ang), 0.0, sin(ang)) * randf_range(18.0, 30.0)
		if Vector2(cand.x, cand.z).length() > 33.0:
			continue
		if valley != null and valley.river != null and valley.river.covers_world(cand.x, cand.z):
			continue
		var clear := true
		for s in _active_shelters:
			if is_instance_valid(s) and (s as Node3D).global_position.distance_to(cand) < 14.0:
				clear = false
				break
		if clear:
			site = cand
			break
	if site == Vector3.ZERO:
		return
	members.shuffle()
	members.sort_custom(func(a, b): return a.variant == "builder" and b.variant != "builder")
	var new_tid: int = build_shelter(site)
	for i: int in 3:
		var h = members[i]
		h._settlement_id = new_tid
		h._settlement_center = Vector3(site.x, 0.0, site.z)
		h._raid_target = Vector3.ZERO
	chronicle.emit("A quarrel splits %s. %s found a village of their own." % [tribe_name(tid), tribe_name(new_tid).capitalize()])

# Burn one of a tribe's huts if nobody is left to defend it.
func raze_hut_near(pos: Vector3, raider_tid: int) -> bool:
	for s in _active_shelters:
		if not is_instance_valid(s):
			continue
		var hut := s as Node3D
		var owner_tid: int = int(hut.get_meta("settlement_id", 0))
		if owner_tid == raider_tid or hut.global_position.distance_to(pos) > 8.0:
			continue
		for h in get_nearby_agents(hut.global_position, 8.0, "human"):
			if int(h.get("_settlement_id")) == owner_tid:
				return false
		_active_shelters.erase(hut)
		for h in hut_residents(hut):
			h.set("home", null)
		FXManager.spawn_death_particles(hut.global_position + Vector3.UP * 2.0, Color(0.95, 0.5, 0.2))
		FXManager.show_dramatic_text(hut.global_position + Vector3.UP * 3.0, "Burned!", Color(0.95, 0.5, 0.25))
		chronicle.emit("%s burn a hut of %s." % [tribe_name(raider_tid).capitalize(), tribe_name(owner_tid)])
		hut.queue_free()
		return true
	return false

func build_shelter(pos: Vector3, tribe: int = 0) -> int:
	pos = dry_land(pos, 6.0)
	var shelter := Node3D.new()
	shelter.name = "Shelter"
	var sid: int = tribe
	if sid <= 0:
		sid = _next_settlement_id
		_next_settlement_id += 1
	_new_tribe(sid)
	if shelter.get("settlement_id") != null:
		shelter.settlement_id = sid
	else:
		shelter.set_meta("settlement_id", sid)
	_dress_hut(shelter, sid)
	CookedFoodArt.add_hearth(shelter)
	shelter.set_meta("pantry", {})
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
	_clear_hut_plot(shelter.global_position)
	settlement_built.emit(pos)
	return sid

static var _hut_parts: Dictionary = {}
const HUT_SCALE: float = 0.72
const HUT_BEDS: int = 4

# ------------------------------------------------------------------
# Homes: every villager has a bed in a hut of their tribe (four to a hut).
# At night they go home; couples sharing a hut may have a child.
# ------------------------------------------------------------------
func hut_residents(hut: Node3D) -> Array:
	var r: Array = hut.get_meta("residents", [])
	var live: Array = r.filter(func(h): return is_instance_valid(h) and not h.is_queued_for_deletion())
	if live.size() != r.size():
		hut.set_meta("residents", live)
		_update_hut_badge(hut)
	return live

func _update_hut_badge(hut: Node3D) -> void:
	var badge := hut.get_node_or_null("Badge") as Label3D
	if badge == null:
		return
	var n: int = (hut.get_meta("residents", []) as Array).size()
	badge.text = "%d/%d" % [n, HUT_BEDS]
	badge.modulate = Color(0.902, 0.765, 0.416) if n >= HUT_BEDS else Color(0.957, 0.937, 0.894)

# Finds this villager a bed: their tribe's nearest hut with room, else any
# hut with room close by. Returns null when every bed is taken.
func claim_hut(human: Node3D) -> Node3D:
	var tid: int = int(human.get("_settlement_id"))
	var best: Node3D = null
	var best_d: float = INF
	for s in _active_shelters:
		if not is_instance_valid(s):
			continue
		var hut := s as Node3D
		var own: bool = int(hut.get_meta("settlement_id", 0)) == tid
		var d: float = hut.global_position.distance_to(human.global_position) + (0.0 if own else 30.0)
		if d > 60.0 or hut_residents(hut).size() >= HUT_BEDS:
			continue
		if d < best_d:
			best_d = d
			best = hut
	if best != null:
		var r: Array = best.get_meta("residents", [])
		r.append(human)
		best.set_meta("residents", r)
		_update_hut_badge(best)
	return best

func release_hut(human: Node3D, hut: Node3D) -> void:
	if hut == null or not is_instance_valid(hut):
		return
	var r: Array = hut.get_meta("residents", [])
	r.erase(human)
	hut.set_meta("residents", r)
	_update_hut_badge(hut)

func homeless_in_tribe(tid: int) -> int:
	var n: int = 0
	for h in tribe_members(tid):
		if h.get("home") == null or not is_instance_valid(h.get("home")):
			n += 1
	return n

# Timber walls, a thatched roof, a door and a banner in the settlement's colour.
func _dress_hut(shelter: Node3D, sid: int) -> void:
	if _hut_parts.is_empty():
		var walls := BoxMesh.new()
		walls.size = Vector3(3.6, 2.2, 3.6)
		var roof := PrismMesh.new()
		roof.size = Vector3(4.6, 1.9, 4.4)
		var door := BoxMesh.new()
		door.size = Vector3(0.9, 1.4, 0.1)
		var pole := CylinderMesh.new()
		pole.top_radius = 0.06
		pole.bottom_radius = 0.06
		pole.height = 3.4
		pole.radial_segments = 5
		pole.rings = 1
		var flag := BoxMesh.new()
		flag.size = Vector3(1.1, 0.6, 0.04)
		var wood := StandardMaterial3D.new()
		wood.albedo_color = Color(0.62, 0.46, 0.3)
		var thatch := StandardMaterial3D.new()
		thatch.albedo_color = Color(0.82, 0.68, 0.38)
		var dark := StandardMaterial3D.new()
		dark.albedo_color = Color(0.26, 0.18, 0.12)
		_hut_parts = {"walls": walls, "roof": roof, "door": door, "pole": pole, "flag": flag,
			"wood": wood, "thatch": thatch, "dark": dark, "banners": {}}
	var p := _hut_parts
	var parts: Array = [
		[p["walls"], p["wood"], Vector3(0, 1.1, 0)],
		[p["roof"], p["thatch"], Vector3(0, 3.15, 0)],
		[p["door"], p["dark"], Vector3(0, 0.7, 1.82)],
		[p["pole"], p["dark"], Vector3(2.3, 1.7, 1.9)],
	]
	# Cottages for up to four: three quarters the size of the old long-house.
	var body := Node3D.new()
	body.name = "Body"
	body.scale = Vector3.ONE * HUT_SCALE
	shelter.add_child(body)
	for part: Array in parts:
		var mi := MeshInstance3D.new()
		mi.mesh = part[0]
		mi.material_override = part[1]
		mi.position = part[2]
		body.add_child(mi)
	var badge := Label3D.new()
	badge.name = "Badge"
	badge.text = "0/%d" % HUT_BEDS
	badge.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	badge.no_depth_test = true
	badge.font = FelecoUi.font("bold")
	badge.font_size = 40
	badge.outline_size = 10
	badge.outline_modulate = Color(0.08, 0.06, 0.04, 0.9)
	# Same size on screen at any distance, small enough to sit on the roof.
	badge.fixed_size = true
	badge.pixel_size = 0.0007
	badge.position = Vector3(0, 4.6 * HUT_SCALE + 0.6, 0)
	badge.modulate = Color(0.957, 0.937, 0.894)
	shelter.add_child(badge)
	shelter.set_meta("residents", [])
	var banners: Dictionary = p["banners"]
	if not banners.has(sid):
		var m := StandardMaterial3D.new()
		m.albedo_color = Color.from_hsv(fmod(float(sid) * 0.17, 1.0), 0.65, 0.85)
		banners[sid] = m
	var flag_mi := MeshInstance3D.new()
	flag_mi.mesh = p["flag"]
	flag_mi.material_override = banners[sid]
	flag_mi.position = Vector3(2.85, 3.05, 1.9) * HUT_SCALE
	shelter.add_child(flag_mi)
	shelter.rotation.y = randf() * TAU

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
		else:
			for id: String in _extra.keys():
				if array == _extra[id]["active"]:
					species = id
					break
		var h: float = agent.get("health") if agent.get("health") != null else 0.0
		var e: float = agent.get("energy") if agent.get("energy") != null else 0.0
		var ls: float = agent.get("_lifespan") if agent.get("_lifespan") != null else 20.0
		var data := AgentData.new(species, h, e, agent.global_position, ls, agent)
		data.variant = agent.variant
		data.role = agent.role
		data.female = agent.sex == "female"
		agent._bind_agent_data(data)
		_agent_registry.append(data)
		agent.tree_exiting.connect(func(): _agent_registry.erase(data), CONNECT_ONE_SHOT)
	_snap_to_ground(agent)

# Challenge scenario: timed events, run off the day clock.
var scenario_id: String = ""
var _scenario_events: Array = []

func _step_scenario() -> void:
	var day := get_day()
	while not _scenario_events.is_empty() and day >= float(_scenario_events[0]["day"]):
		var e: Dictionary = _scenario_events.pop_front()
		match str(e["do"]):
			"kill_group":
				var g: String = e["arg"]
				for data: AgentData in _agent_registry.duplicate():
					if SpeciesDB.group_of(data.species) == g and data.node != null and is_instance_valid(data.node) and data.node.has_method("die"):
						data.node.die()
				FXManager.show_dramatic_text(Vector3.ZERO, "A sickness takes the %s!" % SpeciesDB.GROUP_LABEL[g].to_lower(), Color(0.9, 0.4, 0.35))
				chronicle.emit("Overnight, every one of the %s is gone." % SpeciesDB.GROUP_LABEL[g].to_lower())
			"drought":
				trigger_drought()

# Genetics: founders and migrants get a random genome; a baby crosses its
# parent with the nearest mate of the other sex (the likely father or mother).
func _apply_genes(agent: Node, parent: Node) -> void:
	if not agent is MarkovAgent or agent.is_in_group("spore"):
		return
	if parent == null or not parent is MarkovAgent or (parent as MarkovAgent).genes.is_empty():
		Genetics.apply(agent, Genetics.random_genome())
		return
	var pa := parent as MarkovAgent
	var mate: MarkovAgent = null
	var best: float = 100.0
	for n in get_nearby_agents(pa.global_position, 10.0, pa.species_id):
		if n is MarkovAgent and n != pa and (n as MarkovAgent).sex != pa.sex:
			var d: float = pa.global_position.distance_squared_to(n.global_position)
			if d < best:
				best = d
				mate = n
	Genetics.apply(agent, Genetics.cross(pa.genes, mate.genes if mate != null else {}))

# Switched-off species start at zero (and _apply_pass_migration keeps them out).
func _apply_disabled() -> void:
	for id: String in disabled_species.keys():
		match id:
			"sheep": cfg_sheep = 0
			"wolf": cfg_wolves = 0
			"human": cfg_humans = 0
			"falcon": cfg_falcons = 0
			"robin": cfg_robins = 0
			"boar": cfg_boars = 0
			"worm": cfg_worms = 0
			"rabbit": cfg_rabbits = 0
			"fish": cfg_fish = 0
			"mushroom": cfg_spores = 0
			"tree": cfg_trees = 0
			"bush": cfg_bushes = 0
			_: cfg_extra[id] = 0

# One creature for the opening film: tracked and drawn like any other, but
# the director never runs its AI (see MarkovAgent.scripted).
func spawn_scripted(id: String, pos: Vector3) -> MarkovAgent:
	var path: String = "res://scenes/mushroom_spore.tscn" if id == "mushroom" else "res://scenes/%s.tscn" % id
	var a := (load(path) as PackedScene).instantiate() as MarkovAgent
	a.scripted = true
	if id == "mushroom":
		$Spores.add_child(a)
	else:
		$Agents.add_child(a)
	a.global_position = Vector3(pos.x, ground_height(pos.x, pos.z), pos.z)
	var arr: Array = _active_spores if id == "mushroom" else (_extra[id]["active"] if _extra.has(id) else _get_faction_array(SpeciesDB.plural(id)))
	_track_agent(a, arr)
	return a

# The generic spawn for the 3.0 species. Returns the creature, or null.
func _spawn_extra(id: String, pos: Vector3, parent: Node = null) -> Node:
	var e: Dictionary = _extra.get(id, {})
	if e.is_empty() or e["scene"] == null:
		return null
	var a: Node = (e["pool"] as NodePool).acquire()
	if a == null:
		return null
	$Agents.add_child(a)
	if a is Node3D:
		a.visible = true
		a.global_position = _in_valley(pos)
	_track_agent(a, e["active"])
	_apply_phenotype_variance(a, parent)
	_apply_campaign_traits(a, id)
	return a

func spawn_offspring(id: String, parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	var a := _spawn_extra(id, _in_valley(pos), parent)
	if a == null:
		return
	if a.get("energy") != null:
		a.energy = 25.0
	agent_born.emit(id, pos, "")
	FXManager.spawn_birth_particles(pos, SpeciesDB.row(id).get("color", Color.WHITE))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby %s!" % SpeciesDB.label(id).trim_suffix("s"), Color(0.9, 0.9, 1.0))

func get_species_count(id: String) -> int:
	if _extra.has(id):
		return (_extra[id]["active"] as Array).size()
	return _get_faction_array(SpeciesDB.plural(id)).size()

func spawn_sheep_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	if _sheep_pool == null:
		return
	var s: Node = _sheep_pool.acquire()
	if s == null:
		return
	$Agents.add_child(s)
	if s is Node3D:
		s.visible = true
		s.global_position = _in_valley(pos)
	if s.get("energy") != null:
		s.energy = 15.0
	_track_agent(s, _active_sheep)
	_apply_phenotype_variance(s, parent)
	_apply_campaign_traits(s, "sheep")
	agent_born.emit("sheep", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.95, 0.95, 0.95))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Sheep!", Color(0.9, 0.9, 1.0))

func spawn_wolf_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	if _wolf_pool == null:
		return
	var w: Node = _wolf_pool.acquire()
	if w == null:
		return
	$Agents.add_child(w)
	if w is Node3D:
		w.visible = true
		w.global_position = _in_valley(pos)
	if w.get("energy") != null:
		w.energy = 35.0
	_track_agent(w, _active_wolves)
	_apply_phenotype_variance(w, parent)
	_apply_campaign_traits(w, "wolf")
	agent_born.emit("wolf", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.8, 0.1, 0.1))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Wolf!", Color(1.0, 0.5, 0.5))

func spawn_human_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	if _human_pool == null:
		return
	var h: Node = _human_pool.acquire()
	if h == null:
		return
	$Agents.add_child(h)

	# Settlement-centric spawning: if parent has a settlement, child spawns near it
	var spawn_pos := pos
	var parent_sid = null if parent == null else parent.get("_settlement_id")
	var parent_center = null if parent == null else parent.get("_settlement_center")
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

	# Builders and wizards are rolled in _assign_role (more often in shelter).
	_track_agent(h, _active_humans)
	_apply_phenotype_variance(h, parent)
	_apply_campaign_traits(h, "human")
	agent_born.emit("human", spawn_pos, h.variant)
	FXManager.spawn_birth_particles(spawn_pos, Color(0.9, 0.7, 0.5))
	FXManager.show_floating_text(spawn_pos + Vector3.UP, "Baby Human!", Color(0.95, 0.8, 0.6))

func spawn_falcon_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	if _falcon_pool == null:
		return
	var f: Node = _falcon_pool.acquire()
	if f == null:
		return
	$Agents.add_child(f)
	if f is Node3D:
		f.visible = true
		f.global_position = _in_valley(pos)
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
	if not _room_for_birth():
		return
	if _robin_pool == null:
		return
	var r: Node = _robin_pool.acquire()
	if r == null:
		return
	$Agents.add_child(r)
	if r is Node3D:
		r.visible = true
		r.global_position = _in_valley(pos)
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
	if not _room_for_birth():
		return
	if _boar_pool == null:
		return
	var b: Node = _boar_pool.acquire()
	if b == null:
		return
	$Agents.add_child(b)
	if b is Node3D:
		b.visible = true
		b.global_position = _in_valley(pos)
	if b.get("energy") != null:
		b.energy = 25.0
	_track_agent(b, _active_boars)
	_apply_phenotype_variance(b, parent)
	_apply_campaign_traits(b, "boar")
	agent_born.emit("boar", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.5, 0.3, 0.2))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Boar!", Color(0.8, 0.6, 0.4))

func spawn_worm_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	if _worm_pool == null:
		return
	var wr: Node = _worm_pool.acquire()
	if wr == null:
		return
	$Agents.add_child(wr)
	if wr is Node3D:
		wr.visible = true
		wr.global_position = _in_valley(pos)
	if wr.get("energy") != null:
		wr.energy = 15.0
	_track_agent(wr, _active_worms)
	_apply_phenotype_variance(wr, parent)
	_apply_campaign_traits(wr, "worm")
	agent_born.emit("worm", pos, "")
	FXManager.spawn_birth_particles(pos, Color(0.2, 0.8, 0.3))
	FXManager.show_floating_text(pos + Vector3.UP, "Baby Worm!", Color(0.5, 1.0, 0.5))

func spawn_rabbit_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
	if _rabbit_pool == null:
		return
	var rb: Node = _rabbit_pool.acquire()
	if rb == null:
		return
	$Agents.add_child(rb)
	if rb is Node3D:
		rb.visible = true
		rb.global_position = _in_valley(pos)
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
	_add_extra_counts(counts)
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
	var factions: Array = MIGRANT_COUNTS.keys()
	for id: String in SpeciesDB.NEW_SPECIES:
		factions.append(SpeciesDB.plural(id))
	for faction: String in factions:
		if disabled_species.has(SpeciesDB.id_for(faction)) or ChallengeScenarios.blocks_migration(scenario_id, SpeciesDB.id_for(faction)):
			continue
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
		_:
			var xid := SpeciesDB.id_for(faction)
			if _extra.has(xid):
				pool = _extra[xid]["pool"]
				dest = _extra[xid]["active"]
				species_id = xid
	if faction == "worms":
		# Worms don't walk in; they surface from deep soil where rot lies.
		for i: int in int(MIGRANT_COUNTS[faction]):
			spawn_worm_offspring(null, Vector3(randf_range(-26.0, 26.0), 0.0, randf_range(-26.0, 26.0)))
		_migration_lock_until[faction] = _sim_day + 30.0
		_extinct_since.erase(faction)
		_ever_lived[faction] = true
		chronicle.emit("Worms surface from the deep soil.")
		return
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
	var founders: int = int(MIGRANT_COUNTS.get(faction, SpeciesDB.row(SpeciesDB.id_for(faction)).get("migrants", 2)))
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
	for id: String in _extra.keys():
		factions.append(_extra[id]["active"])
		species_names.append(id)
	for i: int in range(factions.size()):
		var faction: Array = factions[i]
		var count: int = faction.size()
		var sp: String = species_names[i]
		var capacity: int = capacity_of(sp)
		var midpoint: float = capacity * 1.3
		# Steepness scales with capacity so small populations (a few bears or
		# lions) aren't culled far below their limit.
		var k: float = OVERPOP_STEEPNESS * maxf(1.0, 100.0 / float(capacity))
		var mortality_rate: float = OVERPOP_MAX_MORTALITY / (1.0 + exp(-k * (count - midpoint)))
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
# Tuning Lab multiplier for a species (1.0 when untouched).
var _gc_cache: Node = null
func tune(species: String, key: String) -> float:
	if _gc_cache == null:
		_gc_cache = get_node_or_null("/root/GameConfig")
		if _gc_cache == null:
			return 1.0
	return _gc_cache.tune("mushroom" if species == "spore" else species, key)

func capacity_of(species: String) -> int:
	var cap: float = float(CARRYING_CAPACITY.get(species, SpeciesDB.row(species).get("cap", 300)))
	cap = float(EraBook.capacity(species, int(cap)))
	return maxi(2, int(cap * tune(species, "capacity")))

func logistic_reproduction_factor(species: String) -> float:
	var capacity: int = capacity_of(species)
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
		_: count = get_species_count(species)
	var midpoint: float = capacity * 0.7
	return 1.0 / (1.0 + exp(0.02 * (count - midpoint)))

func find_nearest_pinecone(pos: Vector3, radius: float = 8.0) -> Node3D:
	var best: Node3D = null
	var best_dist_sq := radius * radius
	for node in get_nearby_agents(pos, radius, "pinecone"):
		if not is_instance_valid(node) or not node is Node3D:
			continue
		var d_sq := pos.distance_squared_to(node.global_position)
		if d_sq < best_dist_sq:
			best_dist_sq = d_sq
			best = node
	return best

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
	# Under winter ice the fish are out of reach of every hunter.
	if river_frozen:
		return null
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

# Refuge: the last few of a species are wary and hidden, so hunting them
# gets much harder. Keeps a crash from becoming a certain wipe-out.
func refuge(species: String) -> float:
	var arr: Array = []
	match species:
		"sheep": arr = _active_sheep
		"wolf": arr = _active_wolves
		"human": arr = _active_humans
		"falcon": arr = _active_falcons
		"robin": arr = _active_robins
		"boar": arr = _active_boars
		"worm": arr = _active_worms
		"rabbit": arr = _active_rabbits
		"fish": arr = _active_fish
		_:
			if not _extra.has(species):
				return 1.0
			arr = _extra[species]["active"]
	return clampf(float(arr.size()) / 8.0, 0.2, 1.0)

func try_eat_fish(from: Vector3, reach: float) -> bool:
	var fish := find_nearest_fish(from, reach)
	if fish == null:
		return false
	# A fish in the current usually slips away; one flopping on dry land doesn't.
	var stranded: bool = fish.get("stranded") == true
	# Fish are not clever: most lunges land.
	if not stranded and randf() < 0.35:
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
	var out := {
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
	_add_extra_counts(out)
	return out

func _add_extra_counts(counts: Dictionary) -> void:
	for id: String in _extra.keys():
		counts[SpeciesDB.plural(id)] = (_extra[id]["active"] as Array).size()

# Head counts per food-web group (lesson cards, the harness).
func get_group_counts() -> Dictionary:
	var census := get_faction_counts()
	census["producers"] = producer_count()
	return SpeciesDB.group_totals(census)

# How full each food-web group is: every member's numbers against what the
# valley can hold of it, averaged over the group (a missing species counts 0).
# Producers: the meadow and the woods against a lush valley. This is what the
# Order bet ranks, so a mushroom bloom can't outvote three wolves.
const PRODUCER_HOLD: float = 220.0
const MUSHROOM_HOLD: float = 40.0
func get_group_scores() -> Dictionary:
	var census := get_faction_counts()
	var out: Dictionary = {"producer": producer_count() / PRODUCER_HOLD}
	for g: String in SpeciesDB.GROUPS:
		if g == "producer":
			continue
		var members := SpeciesDB.members(g)
		var total: float = 0.0
		for id: String in members:
			var key := SpeciesDB.plural(id)
			var hold: float = MUSHROOM_HOLD if id == "mushroom" else float(HOLD_CAPACITY.get(key, 10.0))
			total += float(census.get(key, 0)) / hold
		out[g] = total / maxf(1.0, float(members.size()))
	return out

# Producers on the same scale as animals: a tall grass tuft, a tree, a bush.
func producer_count() -> float:
	var n: float = 0.0
	if grass != null:
		for v: float in grass._grid:
			n += v
		n /= 8.0
	n += float(get_tree().get_nodes_in_group("tree").size()) * 3.0
	n += float(get_tree().get_nodes_in_group("bush").size()) * 1.5
	return n

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
	}.merged(_extra_counts())

func _extra_counts() -> Dictionary:
	var d: Dictionary = {}
	_add_extra_counts(d)
	return d

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
	var wall_r2: float = ValleyTerrain.WALK_RADIUS * ValleyTerrain.WALK_RADIUS
	for dx: int in range(-1, 2):
		for dz: int in range(-1, 2):
			var cx: int = ccx + dx
			var cz: int = ccz + dz
			var cell_x: float = (float(cx) + 0.5) * PRESENCE_CELL_SIZE
			var cell_z: float = (float(cz) + 0.5) * PRESENCE_CELL_SIZE
			var i := _presence_index(cx, cz)
			# A cell past the slopes is a wall. Skipping it used to leave only
			# the inward neighbours, and their repulsion pushed the rim crowd
			# outward onto the clamp circle.
			if i < 0 or cell_x * cell_x + cell_z * cell_z > wall_r2:
				var inward := Vector3(-pos.x, 0.0, -pos.z)
				if inward.length_squared() > 1.0:
					steer += inward.normalized() * 1.2
				continue
			var count: int = _crowd_grid[i]
			if count <= 1 and dx == 0 and dz == 0:
				continue
			if count <= 0:
				continue
			# Repulsion from neighbor cell centers
			var to_x: float = cell_x - pos.x
			var to_z: float = cell_z - pos.z
			var dist := sqrt(to_x * to_x + to_z * to_z)
			if dist > 0.01:
				var k: float = float(count) * (1.0 / maxf(dist, 1.0)) * 2.0 / dist
				steer.x -= to_x * k
				steer.z -= to_z * k
	# A packed crowd must not fling anyone out of the valley: cap the shove.
	if steer.length_squared() > 9.0:
		steer = steer.normalized() * 3.0
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
		"fish": return _active_fish
		_:
			var id := SpeciesDB.id_for(faction)
			return _extra[id]["active"] if _extra.has(id) else []

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
			if sub is Node3D and (sub.is_in_group("apple") or sub.is_in_group("pinecone")):
				_spatial_add(sub)
	for child in $Corpses.get_children():
		if child is Node3D:
			_spatial_add(child)
	for child in $Bushes.get_children():
		if not child is Node3D:
			continue
		_spatial_add(child)
		for sub in child.get_children():
			if sub is Node3D and sub.is_in_group("berry"):
				_spatial_add(sub)

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
	_apply_genes(agent, parent)
	if agent is MarkovAgent and (agent as MarkovAgent)._data != null:
		RareLooks.roll((agent as MarkovAgent)._data, parent)
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
	_assign_role(agent, parent)

# Founders and newborns roll their kind here (normal, tough or special).
func _assign_role(agent: Node, parent: Node) -> void:
	if not agent is MarkovAgent:
		return
	var ma := agent as MarkovAgent
	if not ma.role.is_empty() or not Roles.KINDS.has(ma.species_id):
		return
	var sheltered: bool = ma.species_id == "human" and is_position_in_shelter(ma.global_position, 6.0)
	var role: String = Roles.roll(self, ma.species_id, parent, sheltered)
	if role.is_empty():
		return
	Roles.apply(ma, ma.species_id, role)
	if parent != null:
		var kind: String = Roles.display_name(ma.species_id, role)
		var sex_word: String = "female" if ma.sex == "female" else "male"
		chronicle.emit("%s, a %s %s, is born. %s" % [ma.display_name, sex_word, kind, Roles.lore(ma.species_id, role)])
		FXManager.show_floating_text(ma.global_position + Vector3.UP * 2.5, "A %s is born!" % kind, Color(1.0, 0.85, 0.4))

func _apply_campaign_traits(agent: Node, species: String) -> void:
	var gc = get_node_or_null("/root/GameConfig")
	if gc == null or (gc.current_mode != "campaign" and gc.current_mode != "sandbox"):
		return
	var health_mult: float = 1.0
	var speed_mult: float = 1.0
	var lifespan_mult: float = 1.0
	if gc.current_mode == "campaign" and gc.campaign_faction == species:
		var traits: Dictionary = gc.campaign_traits
		health_mult *= float(traits.get("health_boost", 1.0))
		speed_mult *= float(traits.get("speed_boost", 1.0))
		lifespan_mult *= float(traits.get("lifespan_boost", 1.0))
	# Link boons: the food-web games played and won lend their whole link a little.
	var boon: Dictionary = gc.link_boons().get(SpeciesDB.group_of(species), {})
	health_mult *= float(boon.get("health", 1.0))
	speed_mult *= float(boon.get("speed", 1.0))
	lifespan_mult *= float(boon.get("lifespan", 1.0))
	if is_equal_approx(health_mult, 1.0) and is_equal_approx(speed_mult, 1.0) and is_equal_approx(lifespan_mult, 1.0):
		return
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
	if bet_tracker != null:
		bet_tracker.settle_final()
	last_holds = get_group_scores()
	# The valley goes to the food-web group that ruled it longest. A tie
	# goes to whichever group is fuller right now. Same test as the old
	# per-species hill, run on the five categories instead.
	simulation_ended.emit(ruling_group())

func ruling_group() -> String:
	var scores: Dictionary = get_group_scores()
	var winner: String = ""
	var best: float = 0.0
	for g: String in SpeciesDB.GROUPS:
		var d: float = float(control_days.get(g, 0.0))
		if d > best or (is_equal_approx(d, best) and d > 0.0 and float(scores.get(g, 0.0)) > float(scores.get(winner, 0.0))):
			best = d
			winner = g
	return winner

func _sample_control(days: float) -> void:
	var scores: Dictionary = get_group_scores()
	var leader: String = ""
	var best: float = 0.0
	for g: String in SpeciesDB.GROUPS:
		var h: float = float(scores.get(g, 0.0))
		if h > best:
			best = h
			leader = g
	if leader.is_empty():
		return
	control_days[leader] = float(control_days.get(leader, 0.0)) + days
	if leader != current_leader:
		current_leader = leader
		control_changed.emit(leader)

func year_days() -> float:
	return maxf(1.0, cfg_time_limit)

func control_share(sp: String) -> float:
	var total: float = 0.0
	for v in control_days.values():
		total += float(v)
	return 0.0 if total <= 0.0 else float(control_days.get(sp, 0.0)) / total

func _compute_holds() -> Dictionary:
	var counts: Dictionary = get_creature_counts()
	var holds: Dictionary = {}
	for sp: String in HOLD_ORDER:
		var cap: float = float(HOLD_CAPACITY[sp])
		var n: float = float(counts.get(sp, 0))
		# Villages hold ground too: each standing hut counts as three people.
		if sp == "humans":
			n += 3.0 * float(_active_shelters.filter(func(s): return is_instance_valid(s)).size())
		holds[sp] = n / cap
	return holds

func champion_line(champion: String) -> String:
	var grp: String = SpeciesDB.group_of(SpeciesDB.id_for(champion))
	var grp_name: String = SpeciesDB.GROUP_LABEL.get(grp, grp.capitalize())
	var champ_d: int = int(control_days.get(grp, 0.0))
	var lead := ""
	var lead_d: float = 0.0
	for g: String in SpeciesDB.GROUPS:
		var d: float = float(control_days.get(g, 0.0))
		if d > lead_d:
			lead_d = d
			lead = g
	if lead.is_empty():
		return "Backing: %s\nNo group rules the valley yet." % grp_name
	return "Backing: %s  %d days\nLongest reign: %s  %d days" % [grp_name, champ_d, SpeciesDB.GROUP_LABEL.get(lead, lead), int(lead_d)]

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
			var id := SpeciesDB.id_for(bet)
			return SpeciesDB.plural(id) if SpeciesDB.is_new(id) else "sheep"

# Mid-season: the notification, and a band of this season's Sprites.
func _seasonal_sprites_wake() -> void:
	var row: Array = SeasonBook.EVENTS[_current_season]
	var id: String = row[0]
	season_event.emit(row[1], id)
	chronicle.emit(row[1])
	var at: Vector3 = Biomes.random_point("sheep", self)
	for i: int in SeasonBook.SPAWN_COUNT:
		_spawn_extra(id, at + Vector3(randf_range(-4.0, 4.0), 0.0, randf_range(-4.0, 4.0)))

func _update_season(dt: float) -> void:
	SEASON_LENGTH = maxf(0.5, cfg_time_limit / 4.0)
	_season_day += dt * DAYS_PER_SECOND
	if _season_day >= SEASON_LENGTH:
		_season_day -= SEASON_LENGTH
		_season_index = (_season_index + 1) % SEASONS.size()
		_current_season = SEASONS[_season_index]
		touches_left = 1
		_season_event_done = false
		_apply_season_mood(_current_season, false)
		_river_season_turn(_current_season)
		season_changed.emit(_current_season)
	if not _season_event_done and _season_day >= SEASON_LENGTH * 0.5:
		_season_event_done = true
		_seasonal_sprites_wake()
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
			_season_grass = 0.45
			_metabolism_mult = 1.4
	_recompute_grass_boost()

func _recompute_grass_boost() -> void:
	var boost: float = _season_grass
	if _rain_timer > 0.0:
		boost *= 2.2
	if _famine_timer > 0.0:
		boost *= 0.25
	if _drought_timer > 0.0:
		boost *= 0.3
	_grass_boost = boost

func get_season() -> String:
	return _current_season

func get_season_progress() -> float:
	return clampf(_season_day / SEASON_LENGTH, 0.0, 1.0)

# Calendar day of the run (sun-and-moon days), as shown to the player.
func get_day() -> float:
	return _clock_s / Clock.SECONDS_PER_DAY

# Light, sky, meadow and trees for each season.
const SEASON_MOOD: Dictionary = {
	"Spring": {"light": Color(1.0, 0.97, 0.9), "energy": 1.0, "ambient": Color(0.76, 0.82, 0.84), "grass": Color(1.05, 1.08, 1.0)},
	"Summer": {"light": Color(1.0, 0.93, 0.8), "energy": 1.12, "ambient": Color(0.82, 0.8, 0.74), "grass": Color(1.04, 1.0, 0.86)},
	"Autumn": {"light": Color(1.0, 0.84, 0.66), "energy": 0.98, "ambient": Color(0.8, 0.72, 0.64), "grass": Color(1.12, 0.94, 0.72)},
	"Winter": {"light": Color(0.84, 0.9, 1.0), "energy": 0.86, "ambient": Color(0.74, 0.8, 0.9), "grass": Color(0.9, 0.95, 1.04)},
}
var weather: Weather = null

# ------------------------------------------------------------------
# Day and night (docs/design/day_night_cycle.md)
# ------------------------------------------------------------------
signal daypart_changed(night: bool)
var _mood_light: Color = Color(1.0, 0.97, 0.9)
var _mood_energy: float = 1.0
var _mood_ambient: Color = Color(0.76, 0.82, 0.84)
var daylight: float = 1.0
# The opening film keeps the sun up so its story stays in view.
var hold_daylight: bool = false
var _was_night: bool = false
var _light_node: DirectionalLight3D
var _env: Environment
# Powers that bend the clock: an eclipse darkens the day, the midnight sun
# keeps a night lit, the full moon and lantern night strengthen tonight.
var _eclipse_s: float = 0.0
var _midnight_sun_s: float = 0.0
var full_moon_tonight: bool = false
var lantern_tonight: bool = false

const NIGHT_LIGHT := Color(0.55, 0.65, 0.95)
const NIGHT_AMBIENT := Color(0.2, 0.24, 0.4)

func day_share() -> float:
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		if gc.owned_upgrades.get("long_days", false):
			return 2.0 / 3.0
		if gc.owned_upgrades.get("long_nights", false):
			return 1.0 / 3.0
	return Clock.DAYLIGHT

func night() -> float:
	return 1.0 - daylight

func is_night() -> bool:
	return daylight < 0.5

func seconds_into_day() -> float:
	return fposmod(_clock_s, Clock.SECONDS_PER_DAY)

# Dawn and dusk (0..1): how deep into twilight we are.
func twilight() -> float:
	return 1.0 - absf(daylight - 0.5) * 2.0

func _step_daylight(dt: float) -> void:
	var d: float = Clock.daylight_at(_clock_s, day_share())
	if _eclipse_s > 0.0:
		_eclipse_s -= dt
		d = minf(d, 0.05)
	if _midnight_sun_s > 0.0:
		_midnight_sun_s -= dt
		d = maxf(d, 0.85)
	# Ease toward the target so powers fade the light instead of snapping it.
	if hold_daylight:
		d = 1.0
	daylight = move_toward(daylight, d, dt * 0.6)
	var night_now: bool = is_night()
	if night_now != _was_night:
		_was_night = night_now
		if not night_now:
			full_moon_tonight = false
			lantern_tonight = false
		daypart_changed.emit(night_now)
	_apply_daylight()

const TreeScript = preload("res://scripts/agents/tree.gd")

func _apply_daylight() -> void:
	if _light_node == null:
		_light_node = get_parent().get_node_or_null("DirectionalLight3D") as DirectionalLight3D
	if _env == null and valley != null:
		var env_node := valley.get_node_or_null("ValleySky") as WorldEnvironment
		if env_node != null:
			_env = env_node.environment
	var n: float = night()
	if _light_node != null:
		# The sun sweeps east to west through the day; the moon takes the
		# same path at night, so shadows always swing slowly.
		var arc: float = Clock.arc_at(_clock_s, day_share())
		var elev: float = lerpf(18.0, 62.0, sin(arc * PI))
		_light_node.rotation_degrees = Vector3(-elev, lerpf(-70.0, 70.0, arc), 0.0)
		var warm: Color = _mood_light.lerp(Color(1.0, 0.7, 0.45), twilight() * 0.6)
		var moon: Color = NIGHT_LIGHT * (1.4 if full_moon_tonight else 1.0)
		_light_node.light_color = warm.lerp(moon, n)
		_light_node.light_energy = lerpf(_mood_energy, 0.18 * (1.5 if full_moon_tonight else 1.0), n)
		# Painted shadows (creature blobs, tree shadows) follow the sun: they
		# fall away from it and stretch as it sinks, so the hour shows on the ground.
		var fwd: Vector3 = -_light_node.global_basis.z
		var ground_dir := Vector2(fwd.x, fwd.z)
		if ground_dir.length() > 0.001:
			ground_dir = ground_dir.normalized()
			var stretch: float = clampf(0.55 / tan(deg_to_rad(elev)), 0.25, 2.0)
			var fade: float = lerpf(1.0, 0.25, n)
			if _visual_proxy_manager != null:
				_visual_proxy_manager.set_sun(ground_dir, stretch, fade)
			TreeScript.set_sun(ground_dir, stretch, fade)
	if _env != null:
		_env.ambient_light_color = _mood_ambient.lerp(NIGHT_AMBIENT, n * 0.85)
		_env.background_energy_multiplier = lerpf(1.0, 0.25, n)
		# Many things in the valley are unshaded (sprites, grass), so night
		# also turns the exposure down to make the dark read everywhere.
		_env.tonemap_exposure = lerpf(1.0, 0.5, n)
		# The haze darkens and cools with the light, so night fog isn't a glow.
		_env.fog_light_color = ValleyTerrain.HAZE.lerp(Color(0.12, 0.15, 0.25), n * 0.9)
	if _visual_proxy_manager != null:
		_visual_proxy_manager.set_night(n)

# How each species lives by day and by night: [speed, hunger, breeding] at
# full night (day is 1.0 unless listed under "day"). Twilight bonuses apply
# at dawn and dusk. See the design doc's table.
const DAY_NIGHT: Dictionary = {
	"sheep": {"night": [0.6, 0.7, 0.8]},
	"rabbit": {"night": [0.5, 0.8, 1.0], "twilight": [1.2, 1.0, 1.4]},
	"human": {"night": [0.5, 0.8, 1.0]},
	"falcon": {"night": [0.3, 0.45, 0.8]},
	"robin": {"night": [0.3, 0.7, 0.9], "twilight": [1.0, 1.0, 1.5]},
	"wolf": {"day": [0.85, 1.0, 1.0], "night": [1.15, 1.05, 1.0], "nocturnal": true},
	"boar": {"day": [0.8, 1.0, 1.0], "night": [1.2, 1.0, 1.2], "nocturnal": true},
	"worm": {"day": [0.7, 1.0, 1.1], "night": [1.2, 1.0, 1.8], "nocturnal": true},
	"fish": {"twilight": [1.0, 1.0, 1.3]},
	"mushroom": {"day": [1.0, 1.0, 0.7], "night": [1.0, 1.0, 1.6], "nocturnal": true},
}

# idx: 0 speed, 1 hunger, 2 breeding.
func daynight_mult(species: String, idx: int) -> float:
	var row: Dictionary = DAY_NIGHT.get(species, SpeciesDB.row(species).get("dn", {}))
	if row.is_empty():
		return 1.0
	var n: float = night()
	var nocturnal: bool = row.get("nocturnal", false)
	var champ_ignores: bool = _night_owl_species() == species
	var day_v: float = float(row.get("day", [1.0, 1.0, 1.0])[idx])
	var night_v: float = float(row.get("night", [1.0, 1.0, 1.0])[idx])
	if champ_ignores:
		# Night Owl: the champion's off-hours penalty is waived.
		if nocturnal:
			day_v = maxf(day_v, 1.0)
		else:
			night_v = maxf(night_v, 1.0)
	if nocturnal and full_moon_tonight:
		night_v = 1.0 + (night_v - 1.0) * 1.5
	if species in ["mushroom", "worm"] and _owns("moonlit_harvest"):
		night_v *= 1.25
	var m: float = lerpf(day_v, night_v, n)
	if row.has("twilight"):
		m *= lerpf(1.0, float(row["twilight"][idx]), twilight())
	return m

func _owns(id: String) -> bool:
	var gc: Node = get_node_or_null("/root/GameConfig")
	return gc != null and gc.owned_upgrades.get(id, false)

func _night_owl_species() -> String:
	return _champion_species() if _owns("night_owl") else ""

func trigger_eclipse() -> void:
	_eclipse_s = Clock.SECONDS_PER_DAY * 0.5
	# The hunters wake hungry and strong.
	for data: AgentData in _agent_registry:
		if SpeciesDB.group_of(data.species) == "carnivore" and data.node != null and is_instance_valid(data.node) and data.node.get("energy") != null:
			data.node.energy = minf(float(data.node.energy) + 30.0, 100.0)
	FXManager.show_dramatic_text(Vector3.ZERO, "Eclipse! Night falls at noon.", Color(0.6, 0.65, 0.95))
	chronicle.emit("The sun goes out like a candle. Every wolf in the valley sits up.")

func trigger_midnight_sun() -> void:
	_midnight_sun_s = Clock.SECONDS_PER_DAY
	FXManager.show_dramatic_text(Vector3.ZERO, "Midnight Sun: the night will not come.", Color(1.0, 0.85, 0.45))
	chronicle.emit("The sun refuses to set. The sheep are thrilled. The wolves are furious.")

func trigger_full_moon() -> void:
	full_moon_tonight = true
	FXManager.show_dramatic_text(Vector3.ZERO, "A full moon rises. The night hunters stir.", Color(0.75, 0.8, 1.0))
	chronicle.emit("A huge moon rolls up over the hills. Something howls back at it.")

func trigger_lantern_night() -> void:
	lantern_tonight = true
	FXManager.show_dramatic_text(Vector3.ZERO, "Lantern Night: the villages glow until dawn.", Color(1.0, 0.8, 0.45))
	chronicle.emit("Lanterns go up in every window. The sheep crowd close to the light.")

# Lantern Night: villagers, and sheep near a hut, are left alone tonight.
func lantern_safe(target: Node3D) -> bool:
	if not lantern_tonight or not is_night() or target == null:
		return false
	if target.is_in_group("human"):
		return true
	return target.is_in_group("sheep") and is_position_in_shelter(target.global_position, 10.0)

func _apply_season_mood(season: String, instant: bool) -> void:
	var mood: Dictionary = SEASON_MOOD.get(season, SEASON_MOOD["Spring"])
	if grass != null:
		grass.set_tint(mood["grass"])
	get_tree().call_group("tree", "apply_season", season)
	get_tree().call_group("bush", "apply_season", season)
	# The sun and moon read these every frame (see _step_daylight).
	var dur: float = 0.01 if instant else 3.0
	var tw := create_tween().set_parallel(true)
	tw.tween_property(self, "_mood_light", mood["light"], dur)
	tw.tween_property(self, "_mood_energy", float(mood["energy"]), dur)
	tw.tween_property(self, "_mood_ambient", mood["ambient"], dur)
	if weather != null:
		weather.set_snow(season == "Winter")
	if valley != null:
		valley.set_season(season)

func get_grass_boost() -> float:
	return _grass_boost

func get_metabolism_mult() -> float:
	return _metabolism_mult

# Each species has its own good and hard seasons:
# [metabolism, breeding] for Spring, Summer, Autumn, Winter.
const SEASON_TABLE: Dictionary = {
	"sheep": [[0.9, 1.5], [1.0, 1.0], [0.95, 0.75], [1.1, 0.35]],    # lambing spring
	"rabbit": [[0.9, 1.6], [1.0, 1.2], [1.0, 0.6], [1.1, 0.35]],     # breed all summer
	"wolf": [[1.0, 1.3], [1.1, 0.8], [1.0, 0.9], [0.85, 1.0]],       # winter hunters
	"boar": [[1.0, 1.0], [1.0, 0.9], [0.75, 1.4], [1.1, 0.5]],       # autumn mast
	"falcon": [[1.0, 1.1], [0.9, 1.3], [1.0, 0.7], [1.2, 0.3]],      # summer hunters
	"robin": [[0.85, 1.6], [0.95, 1.1], [1.05, 0.6], [1.35, 0.15]],  # spring nesting
	"worm": [[0.8, 1.4], [1.15, 0.6], [0.8, 1.4], [1.0, 0.4]],       # wet seasons
	"fish": [[0.9, 1.5], [1.0, 1.0], [0.9, 1.2], [1.0, 0.4]],        # spring spawn
	"human": [[1.0, 1.1], [1.0, 1.0], [0.8, 1.3], [1.15, 0.6]],      # autumn harvest
}

# Weather powers ripple through the food web: each species reads the same
# event differently. [metabolism, breeding] multipliers while it lasts.
const POWER_EFFECTS: Dictionary = {
	"rain": {
		"worm": [0.8, 1.6], "robin": [0.9, 1.3], "fish": [1.0, 1.2],
		"falcon": [1.15, 0.8], "human": [1.0, 1.1],
	},
	"famine": {
		"sheep": [1.25, 0.5], "rabbit": [1.25, 0.5], "boar": [1.1, 0.8],
		"wolf": [0.9, 1.25], "falcon": [0.95, 1.15], "human": [1.1, 0.8], "worm": [0.9, 1.1],
	},
	"drought": {
		"sheep": [1.2, 0.6], "rabbit": [1.2, 0.6], "deer": [1.2, 0.6], "goat": [1.05, 0.9],
		"fish": [1.3, 0.4], "worm": [1.2, 0.5], "beetle": [0.9, 1.3], "lion": [0.95, 1.1],
		"wolf": [0.95, 1.1], "bear": [1.1, 0.8], "human": [1.1, 0.8],
	},
	"flood": {
		"fish": [0.9, 2.0], "worm": [1.3, 0.6], "rabbit": [1.1, 0.6],
		"boar": [0.9, 1.1], "falcon": [0.9, 1.1], "sheep": [1.05, 0.9],
	},
}

func _power_mult(species: String, idx: int) -> float:
	var m: float = 1.0
	if _rain_timer > 0.0:
		m *= float(POWER_EFFECTS["rain"].get(species, [1.0, 1.0])[idx])
	if _famine_timer > 0.0:
		m *= float(POWER_EFFECTS["famine"].get(species, [1.0, 1.0])[idx])
	if _flood_timer > 0.0:
		m *= float(POWER_EFFECTS["flood"].get(species, [1.0, 1.0])[idx])
	if _drought_timer > 0.0:
		m *= float(POWER_EFFECTS["drought"].get(species, [1.0, 1.0])[idx])
	return m

func season_metabolism(species: String) -> float:
	var row: Array = SEASON_TABLE.get(species, SpeciesDB.row(species).get("season", []))
	var m: float = 1.0 if row.is_empty() else float(row[_season_index][0])
	if _season_index == 3:
		m *= EraBook.winter_metabolism(species)
	return m * _power_mult(species, 0) * daynight_mult(species, 1)

func season_breeding(species: String) -> float:
	if species == "mushroom":
		return fungal_factor() * daynight_mult(species, 2)
	var row: Array = SEASON_TABLE.get(species, SpeciesDB.row(species).get("season", []))
	var b: float = 1.0 if row.is_empty() else float(row[_season_index][1])
	if species == "falcon":
		b *= nest_factor
	if _season_index == 3:
		b *= EraBook.winter_breeding(species)
	return b * _power_mult(species, 1) * daynight_mult(species, 2)

# Mushrooms and mycelium flourish in autumn and in rain; otherwise they are rare.
func fungal_factor() -> float:
	var f: float = [0.15, 0.08, 1.0, 0.05][_season_index]
	if _rain_timer > 0.0 or _flood_timer > 0.0:
		f = maxf(f, 1.0)
	if _drought_timer > 0.0:
		f *= 0.3
	return f

# ------------------------------------------------------------------
# Player powerups
# ------------------------------------------------------------------
var _rain_timer: float = 0.0
var _famine_timer: float = 0.0
var _drought_timer: float = 0.0
# Chance of a drought per summer (roughly); scenarios can force one.
var drought_chance: float = 0.45

func is_raining() -> bool:
	return _rain_timer > 0.0

func is_drought() -> bool:
	return _drought_timer > 0.0

# A drought: the grass browns and barely grows, moss shrivels, the fungi go
# quiet and no rain comes. Lasts about a day and a half.
func trigger_drought() -> void:
	if wind != null:
		wind.hot_gusts()
	if _drought_timer > 0.0:
		return
	_drought_timer = Clock.BIO_PER_DAY * 1.5
	_rain_timer = 0.0
	_recompute_grass_boost()
	if grass != null:
		grass.set_tint(Color(1.15, 0.9, 0.55))
	FXManager.show_dramatic_text(Vector3.ZERO, "Drought! The meadow bakes.", Color(0.95, 0.65, 0.3))
	chronicle.emit("No rain for weeks. The grass crackles underfoot and the river runs low.")
	drought_started.emit()

func _natural_drought_roll(days: float) -> void:
	if _drought_timer > 0.0 or _current_season != "Summer":
		return
	if randf() < drought_chance * days / maxf(SEASON_LENGTH, 0.1):
		trigger_drought()
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

# Fish that swim out through a copse are away for a while, then come back
# up (or down) the river as themselves.
var _fish_away: Array[Dictionary] = []

func fish_left_valley(fish: Node, at_start: bool) -> void:
	_fish_away.append({
		"name": fish.display_name, "sex": fish.sex, "role": fish.role,
		"back": _elapsed + randf_range(10.0, 35.0), "from_start": randf() < 0.5,
	})
	if not fish.role.is_empty() or randf() < 0.15:
		var way: String = "upriver" if at_start else "downriver"
		chronicle.emit("%s the %s slips %s through the pines." % [fish.display_name, Roles.display_name("fish", fish.role).to_lower(), way])
	fish.queue_free()

# The riverbank's wet soil teems (4.7): worms and beetles keep turning up
# right at the water's edge, so the fish always have something to snap at.
const BANK_BUGS_WANTED: int = 14

func _stock_riverbank_bugs() -> void:
	if valley == null or valley.river == null or river_frozen or not _room_for_birth():
		return
	var river: River = valley.river
	var near: int = 0
	for d: AgentData in _agent_registry:
		if (d.species == "worm" or d.species == "beetle") and d.node != null and river.is_near(d.pos.x, d.pos.z):
			near += 1
	if near >= BANK_BUGS_WANTED or randf() > 0.6:
		return
	for k: int in randi_range(1, 3):
		var s: float = randf_range(river.copse_s.x, river.copse_s.y)
		var t := river.tangent_at(s)
		var side := Vector3(-t.z, 0.0, t.x) * (river.half_width() + randf_range(0.2, 1.4)) * (1.0 if randf() < 0.5 else -1.0)
		var at: Vector3 = river.point_at(s) + side
		if randf() < 0.65:
			spawn_worm_offspring(null, at)
		elif not disabled_species.has("beetle"):
			_spawn_extra("beetle", at)

# The river is fed from both ends: while it runs open, new fish keep swimming
# into the valley up and down the river, in schools when the shoal is thin.
func _restock_fish_upstream() -> void:
	if river_frozen or valley == null or valley.river == null or _fish_pool == null:
		return
	if disabled_species.has("fish") or not _room_for_birth():
		return
	var shoal: int = _active_fish.size()
	var cap: int = Fish.RIVER_CAPACITY
	if shoal >= cap:
		return
	var chance: float = 0.85 if shoal < cap / 3 else (0.35 if shoal < cap * 2 / 3 else 0.08)
	if randf() > chance:
		return
	var river: River = valley.river
	var arrived: int = 0
	# They arrive just outside the meadow (where the river leaves the pines),
	# from upstream or downstream, heading in.
	var from_start: bool = randf() < 0.5
	var school: int = randi_range(3, 6) if shoal < cap / 3 else randi_range(1, 3)
	for k: int in school:
		var fish: Node = _fish_pool.acquire()
		if fish == null:
			break
		$Agents.add_child(fish)
		var s: float = maxf(river.copse_s.x - randf_range(2.0, 14.0), 0.5) if from_start else minf(river.copse_s.y + randf_range(2.0, 14.0), river.length() - 0.5)
		fish.visible = true
		fish.global_position = river.point_at(s)
		fish.sex = "female" if randf() < 0.5 else "male"
		fish._s = s
		fish._dir = 1.0 if from_start else -1.0
		_track_agent(fish, _active_fish)
		_apply_phenotype_variance(fish, null)
		arrived += 1
	if arrived > 0 and shoal < 4:
		chronicle.emit("A school of fish swims %s into the valley." % ("down the river" if from_start else "up the river"))

func _return_fish() -> void:
	_restock_fish_upstream()
	_stock_riverbank_bugs()
	if _fish_away.is_empty() or valley == null or valley.river == null or _fish_pool == null:
		return
	var river: River = valley.river
	var i: int = _fish_away.size() - 1
	while i >= 0:
		var info: Dictionary = _fish_away[i]
		if _elapsed >= float(info["back"]):
			_fish_away.remove_at(i)
			var fish: Node = _fish_pool.acquire()
			if fish != null:
				$Agents.add_child(fish)
				var from_start: bool = info["from_start"]
				var s: float = 0.5 if from_start else river.length() - 0.5
				fish.visible = true
				fish.global_position = river.point_at(s)
				fish.sex = info["sex"]
				fish.display_name = info["name"]
				fish._s = s
				fish._dir = 1.0 if from_start else -1.0
				_track_agent(fish, _active_fish)
				if not String(info["role"]).is_empty():
					Roles.apply(fish, "fish", info["role"])
				if randf() < 0.2 or not String(info["role"]).is_empty():
					chronicle.emit("%s returns %s." % [info["name"], "down the river" if from_start else "up the river"])
		i -= 1

func spawn_fish_offspring(parent: Node, pos: Vector3) -> void:
	if not _room_for_birth():
		return
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

# The water rises over a couple of days and falls back slowly; while it
# falls, fish caught out on the floodplain are left stranded on dry land.
const FLOOD_PEAK: float = 2.35
var _flood_now: float = 1.0
var _flood_target: float = 1.0
var _flood_step_accum: float = 0.0

func flood_receding() -> bool:
	return _flood_target < _flood_now - 0.01

func flood_level() -> float:
	return clampf((_flood_now - 1.0) / (FLOOD_PEAK - 1.0), 0.0, 1.0)

func _step_flood(dt: float) -> void:
	if is_equal_approx(_flood_now, _flood_target):
		return
	_flood_step_accum += dt
	if _flood_step_accum < 0.5:
		return
	var step_dt: float = _flood_step_accum
	_flood_step_accum = 0.0
	var rate: float = 0.75 if _flood_target > _flood_now else 0.35
	_flood_now = move_toward(_flood_now, _flood_target, rate * step_dt)
	_set_flood_scale(_flood_now)
	if valley != null and valley.river != null:
		(valley.river as River).set_flood_tint(flood_level())
	if flood_receding():
		_strand_fish()

func _strand_fish() -> void:
	var river: River = valley.river if valley != null else null
	if river == null:
		return
	var stranded: int = 0
	for f in _active_fish:
		if not is_instance_valid(f) or f.stranded:
			continue
		if not river.covers_world(f.global_position.x, f.global_position.z):
			f.strand()
			stranded += 1
	if stranded >= 3:
		chronicle.emit("The water drops and %d fish are left flapping on the meadow." % stranded)

# Thick mycelium pushes up mushrooms (most in autumn and rain).
func _mycelium_fruiting() -> void:
	if mycelium == null or _active_spores.size() >= MAX_MUSHROOMS:
		return
	var ff: float = fungal_factor()
	for i: int in 4:
		var idx: int = randi() % mycelium._grid.size()
		var d: float = mycelium._grid[idx]
		if d > 0.5 and randf() < d * 0.08 * ff:
			var gx: int = idx % mycelium.grid_width
			var gz: int = int(idx / float(mycelium.grid_width))
			spawn_mushroom_spore(null, mycelium.grid_to_world(gx, gz))

# Fish that die on dry land after a flood falls back: the Flood Toll bet.
var flood_fish_toll: int = 0
var bet_tracker: BetTracker = null

func note_flood_fish_death() -> void:
	flood_fish_toll += 1

# Floods are predictable: they come from rain, never out of the blue.
# Rain swells the river, and how much rain it takes to break the banks
# depends on the season. Spring rain lands on snowmelt, so a spring shower
# soon floods; autumn takes a long wet spell; summer ground drinks it up.
# In winter the river freezes over, fish and all, until the spring thaw.
const SWELL_DAYS: Dictionary = {"Spring": 0.25, "Summer": 1.2, "Autumn": 0.6}
# A flood still out when winter comes may freeze where it stands.
const FLOOD_FREEZE_CHANCE: float = 0.6
var river_frozen: bool = false

func swell_to_flood() -> float:
	return Clock.BIO_PER_DAY * float(SWELL_DAYS.get(_current_season, 0.6))

func _river_season_turn(season: String) -> void:
	if valley == null or valley.river == null:
		return
	var river: River = valley.river
	if season == "Winter" and not river_frozen:
		var flooded: bool = flood_level() > 0.15 or _flood_timer > 0.0
		if flooded and randf() < FLOOD_FREEZE_CHANCE:
			# The floodwater freezes out over the meadow, fish and all.
			_flood_target = _flood_now
			_flood_timer = 0.0
			chronicle.emit("The cold snaps shut on the flood: the meadow is a sheet of ice.")
			FXManager.show_dramatic_text(Vector3.ZERO, "The flood freezes over!", Color(0.75, 0.88, 1.0))
		else:
			# Otherwise the water drains back to its bed before it sets.
			_flood_timer = 0.0
			_flood_target = 1.0
			_flood_now = 1.0
			_set_flood_scale(1.0)
			river.set_flood_tint(0.0)
			chronicle.emit("Winter: the river freezes over. The fish wait out the cold beneath the ice.")
			FXManager.show_dramatic_text(Vector3.ZERO, "The river freezes over.", Color(0.75, 0.88, 1.0))
		river_frozen = true
		_river_swell = 0.0
		river.set_ice(1.0)
	elif season == "Spring" and river_frozen:
		river_frozen = false
		river.set_ice(0.0)
		# The thaw lets any frozen flood drain, and the melt fills the river
		# halfway to its banks: a spring rain now will surely flood it.
		_flood_target = 1.0
		_river_swell = swell_to_flood() * 0.5
		chronicle.emit("The ice breaks up. Meltwater runs high: one good spring rain and the river floods.")
		FXManager.show_dramatic_text(Vector3.ZERO, "The thaw! The river runs high.", Color(0.55, 0.75, 0.85))

func trigger_flood() -> void:
	if river_frozen:
		FXManager.show_dramatic_text(Vector3.ZERO, "The river is frozen solid.", Color(0.75, 0.88, 1.0))
		return
	_flood_timer = Clock.BIO_PER_DAY * 0.5
	_flood_target = FLOOD_PEAK
	FXManager.show_dramatic_text(Vector3.ZERO, "The river floods the meadow.", Color(0.35, 0.6, 0.85))

# ------------------------------------------------------------------
# Rain feeds the river. While it rains the water creeps up its banks; enough
# rain close together and it breaks them in a full flood (Flood Toll and all).
# Showers come on their own in spring and autumn.
# ------------------------------------------------------------------
var _river_swell: float = 0.0

func _step_river_swell(bio: float) -> void:
	if _rain_timer > 0.0:
		_river_swell += bio
		if _river_swell >= swell_to_flood() and _flood_timer <= 0.0 and not flood_receding():
			_river_swell = 0.0
			trigger_flood()
			chronicle.emit("Day after day of rain: the river breaks its banks.")
		elif _flood_timer <= 0.0:
			# Rising, not yet flooding: the water creeps up the banks.
			_flood_target = maxf(_flood_target, 1.0 + 0.35 * (_river_swell / swell_to_flood()))
	else:
		_river_swell = maxf(0.0, _river_swell - bio * 0.5)
		if _flood_timer <= 0.0 and _flood_target > 1.0 and _river_swell <= 0.0:
			_flood_target = 1.0

func _natural_rain_roll(days: float) -> void:
	if _rain_timer > 0.0 or _drought_timer > 0.0:
		return
	var per_season: float = {"Spring": 1.3, "Summer": 0.3, "Autumn": 1.0}.get(_current_season, 0.0)
	if randf() < per_season * days / maxf(SEASON_LENGTH, 0.1):
		trigger_rain()
		if _current_season == "Spring":
			chronicle.emit("Spring rain on the snowmelt. The river is rising: expect a flood.")
		else:
			chronicle.emit("Clouds roll in over the passes. It begins to rain.")

# ------------------------------------------------------------------
# Nesting trees: falcons raise chicks only where there are grown trees to
# nest in. Fell the woods for timber and the falcons fade; with fewer
# falcons the robins and rabbits boom, worms and grass pay for it.
# ------------------------------------------------------------------
var nest_factor: float = 1.0
var _woods_thin: bool = false

func _update_nesting() -> void:
	var grown: int = 0
	for t in $Trees.get_children():
		if t.get("_stage") == 2 and not bool(t.get("_dying")):
			grown += 1
	nest_factor = clampf(float(grown) / 14.0, 0.25, 1.2)
	var thin: bool = nest_factor < 0.5
	if thin and not _woods_thin:
		chronicle.emit("So few trees still stand that the falcons have nowhere left to nest.")
	elif not thin and _woods_thin:
		chronicle.emit("The woods have grown back. Falcons are nesting again.")
	_woods_thin = thin

func trigger_gale() -> void:
	if wind != null:
		wind.gale()
	FXManager.show_dramatic_text(Vector3.ZERO, "Gale! Seeds fly across the valley.", Color(0.75, 0.88, 1.0))
	chronicle.emit("A gale tears across the valley, scattering seeds far and wide.")

func trigger_rain() -> void:
	if wind != null:
		wind.calm()
	_rain_timer = Clock.BIO_PER_DAY
	_recompute_grass_boost()
	if weather != null:
		weather.rain(Clock.SECONDS_PER_DAY)

# 3.0 powers: one for each link of the food web.
# Bloom: the meadow, the woods and the moss all surge at once.
func trigger_bloom() -> void:
	if grass != null:
		for i: int in grass._grid.size():
			if grass._masked.size() == grass._grid.size() and grass._masked[i] == 1:
				continue
			grass._grid[i] = minf(grass._grid[i] + 0.3, grass.max_density)
			if int(grass._cell_stage[i]) == 0:
				grass._cell_stage[i] = 1.0
			grass._mark_dirty(i)
	for t in get_tree().get_nodes_in_group("tree") + get_tree().get_nodes_in_group("bush"):
		if t.has_method("_grow_fruit"):
			t._grow_fruit()
		if t.get("moss") != null and not t.bush:
			t.moss = minf(float(t.moss) + 0.3, 1.0)
	FXManager.show_dramatic_text(Vector3.ZERO, "Bloom! The valley bursts into leaf.", Color(0.5, 0.9, 0.4))
	chronicle.emit("Every stem and branch in the valley swells at once.")

# Stampede: the herbivores panic and scatter across the whole valley.
func trigger_stampede() -> void:
	for data: AgentData in _agent_registry:
		if SpeciesDB.group_of(data.species) != "herbivore" or data.node == null or not is_instance_valid(data.node):
			continue
		var a := data.node as MarkovAgent
		a.velocity = Vector3(randf() - 0.5, 0.0, randf() - 0.5).normalized() * 7.0
		a._flee_boost_timer = 3.0
		a._flee_boost_mult = 1.8
		if a._states.has("Flee"):
			a.set_state("Flee")
		# The rush of the run steadies them: herds heal as they bolt.
		if a.get("health") != null and a.get("max_health") != null:
			a.health = minf(float(a.health) + 25.0, float(a.max_health))
	FXManager.show_dramatic_text(Vector3.ZERO, "Stampede! The herds bolt and rally.", Color(0.95, 0.8, 0.5))
	chronicle.emit("Something spooks the herds. Hooves thunder across the meadow.")

# Feast: every omnivore eats its fill.
func trigger_feast() -> void:
	for data: AgentData in _agent_registry:
		if SpeciesDB.group_of(data.species) == "omnivore" and data.node != null and is_instance_valid(data.node) and data.node.get("energy") != null:
			data.node.energy = minf(float(data.node.energy) + 40.0, 100.0)
			if data.node.get("health") != null and data.node.get("max_health") != null:
				data.node.health = minf(float(data.node.health) + 25.0, float(data.node.max_health))
	FXManager.show_dramatic_text(Vector3.ZERO, "Feast! The omnivores eat their fill and heal.", Color(0.9, 0.6, 0.3))

# Rot Rain: the soil teems; mushrooms push up, worms and beetles surface.
func trigger_rot_rain() -> void:
	if rot != null:
		for i: int in rot._grid.size():
			rot._grid[i] = minf(rot._grid[i] + 0.4, rot.max_density)
	for i: int in 6:
		var p := Vector3(randf_range(-24.0, 24.0), 0.0, randf_range(-24.0, 24.0))
		spawn_mushroom_spore(self, p)
		if not disabled_species.has("worm"):
			spawn_worm_offspring(null, p)
		if not disabled_species.has("beetle"):
			spawn_offspring("beetle", null, p + Vector3(1.0, 0.0, 0.0))
	FXManager.show_dramatic_text(Vector3.ZERO, "Rot Rain: the soil comes alive.", Color(0.7, 0.55, 0.8))

func trigger_famine() -> void:
	# Halve the season's grass for 10 days. Stacks with rain by multiplying.
	_famine_timer = Clock.BIO_PER_DAY
	_recompute_grass_boost()

func _champion_species() -> String:
	var gc: Node = get_node_or_null("/root/GameConfig")
	var bet: String = "" if gc == null else gc.player_bet.to_lower()
	if bet.is_empty() and gc != null:
		# 3.0: no champion was picked, so the first starter is the champion.
		for r: Dictionary in gc.spawn_roster:
			if r.get("starter", false):
				return String(r["species"])
	return "" if bet.is_empty() else _group_for_bet(bet)

# Summons kin of the champion near its strongest member (or the valley centre).
func trigger_predator_call() -> int:
	var sp: String = _champion_species()
	if sp.is_empty() or not (has_method("spawn_%s_offspring" % sp) or _extra.has(sp)):
		return 0
	var anchor: Node3D = null
	var best: float = -1.0
	for data: AgentData in _agent_registry:
		if data.species != sp or data.node == null or not is_instance_valid(data.node):
			continue
		var hp = data.node.get("health")
		if hp != null and float(hp) > best:
			best = float(hp)
			anchor = data.node as Node3D
	var centre: Vector3 = anchor.global_position if anchor != null else Vector3.ZERO
	var n: int = 4 if sp in ["rabbit", "robin", "worm", "fish"] else 3
	for i in range(n):
		var pos := centre + Vector3((randf() - 0.5) * 6.0, 0.0, (randf() - 0.5) * 6.0)
		pos.y = ground_height(pos.x, pos.z)
		if _extra.has(sp):
			spawn_offspring(sp, anchor, pos)
		else:
			call("spawn_%s_offspring" % sp, anchor, pos)
	chronicle.emit("Kin of the %s answer your call." % sp)
	return n

# Mends the champion only: full strength back, fed, and briefly hardier.
func trigger_heal() -> void:
	var sp: String = _champion_species()
	if sp.is_empty():
		return
	for data: AgentData in _agent_registry:
		if data.species != sp or data.node == null or not is_instance_valid(data.node):
			continue
		if data.node.get("health") != null:
			data.node.health = minf(data.node.health + 40.0, 100.0)
		if data.node.get("energy") != null:
			data.node.energy = minf(data.node.energy + 35.0, 100.0)

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
			return SpeciesDB.id_for(bet)

# Returns where it will land: where the player aimed it, or else among the
# creatures it culls, a fifth of whoever holds the valley. Anything in the blast
# goes too. Then the rock opens on a crater of Rainbow Starfruit.
const METEOR_BLAST: float = 3.5

func trigger_meteor(aim: Vector3 = Vector3.INF) -> Vector3:
	var holds: Dictionary = _compute_holds()
	var counts: Dictionary = get_creature_counts()
	var target_key: String = ""
	var best: float = 0.0
	for sp: String in HOLD_ORDER:
		var h: float = float(holds.get(sp, 0.0))
		if h > best:
			best = h
			target_key = sp
	var victims: Array[Node3D] = []
	if not target_key.is_empty():
		var agent_species: String = _group_for_bet(target_key)
		for data: AgentData in _agent_registry:
			if data.species == agent_species and data.node != null and is_instance_valid(data.node):
				victims.append(data.node)
	# An empty valley still gets a rock.
	var land: Vector3 = dry_land(Vector3(randf_range(-16.0, 16.0), 0.0, randf_range(-16.0, 16.0)))
	if aim.is_finite():
		land = dry_land(aim)
	elif not victims.is_empty():
		land = dry_land(victims.pick_random().global_position)
	land.y = ground_height(land.x, land.z)
	victims.sort_custom(func(a: Node3D, b: Node3D) -> bool: return a.global_position.distance_squared_to(land) < b.global_position.distance_squared_to(land))
	var kill_target: int = maxi(1, int(int(counts.get(target_key, 0)) * 0.2))
	# Aimed by hand, it takes only what stands in the blast.
	var doomed: Array[Node3D] = []
	if not aim.is_finite():
		doomed = victims.slice(0, kill_target)
	var hit := func() -> void:
		var dead: Array[Node3D] = doomed.duplicate()
		for data: AgentData in _agent_registry:
			if data.node != null and is_instance_valid(data.node) and data.pos.distance_to(land) < METEOR_BLAST and not dead.has(data.node):
				dead.append(data.node)
		for n: Node3D in dead:
			if is_instance_valid(n):
				n.set("health", 0.0)
				if n.has_method("die"):
					n.die()
		if grass != null:
			grass.consume_density(land, 1.0)
		if not target_key.is_empty():
			emit_signal("combat_event", "meteor", target_key, land, true)
	if _headless_mode:
		hit.call()
		return land
	var strike := MeteorStrike.new()
	strike.land = land
	strike.sim = self
	strike.struck.connect(hit)
	add_child(strike)
	return land

func has_starfruit() -> bool:
	return not get_tree().get_nodes_in_group("starfruit").is_empty()

func find_nearest_starfruit(pos: Vector3, radius: float) -> Node3D:
	var best: Node3D = null
	var best_sq: float = radius * radius
	for n: Node in get_tree().get_nodes_in_group("starfruit"):
		var f := n as Node3D
		var d: float = f.global_position.distance_squared_to(pos)
		if d < best_sq:
			best_sq = d
			best = f
	return best

# The nearest thing a Rainbow hunter can go for: anything alive but its own
# kind and the villagers safe indoors.
func rainbow_prey_for(hunter: MarkovAgent, radius: float) -> Node3D:
	var best: Node3D = null
	var best_sq: float = radius * radius
	var from: Vector3 = hunter.global_position
	for data: AgentData in _agent_registry:
		if data.species == hunter.species_id or data.species == "mushroom":
			continue
		var n: Node3D = data.node
		if n == null or not is_instance_valid(n) or n.get("indoors") == true:
			continue
		var d: float = data.pos.distance_squared_to(from)
		if d < best_sq:
			best_sq = d
			best = n
	return best

# Emigration is the population brake, and it has two gates: the valley is
# already past EMIGRATE_AT living creatures, and the frame rate has already
# fallen to the slowest sim rate (_struggling). Until both are true, animals
# stay. When both are true, the most numerous species walks off to other
# pastures and is removed from the scene. Leaving is not dying: no carcass,
# and survivor bets do not lose a body to a departure.
func _fps_tanking() -> bool:
	if _headless_mode:
		return false
	return _struggling()

func _refresh_emigrant() -> void:
	if _agent_registry.size() <= EMIGRATE_AT or not _fps_tanking():
		_emigrant_species = ""
		_emigrate_said = false
		return
	_emigrant_species = _most_populous_species()

func _most_populous_species() -> String:
	var counts: Dictionary = {}
	for data: AgentData in _agent_registry:
		if data.species.is_empty() or data.node == null or not is_instance_valid(data.node):
			continue
		if data.node.is_queued_for_deletion():
			continue
		counts[data.species] = int(counts.get(data.species, 0)) + 1
	var best := ""
	var n := 0
	for sp: String in counts.keys():
		if int(counts[sp]) > n:
			n = int(counts[sp])
			best = sp
	return best

func _protected_from_emigration(agent: Node) -> bool:
	if agent.get("scripted") == true or agent.get("rampage") == true:
		return true
	if agent.get("golden") != null and float(agent.golden) > 0.05:
		return true
	return false

func should_depart(agent: Node) -> bool:
	if _emigrant_species.is_empty() or agent == null or not is_instance_valid(agent):
		return false
	if String(agent.get("species_id")) != _emigrant_species:
		return false
	return not _protected_from_emigration(agent)

# Remove a creature that has left for another pasture. Returns false if it
# was already going or is not allowed to leave.
func depart(agent: Node) -> bool:
	if agent == null or not is_instance_valid(agent) or agent.is_queued_for_deletion():
		return false
	if not should_depart(agent):
		return false
	var sp: String = String(agent.get("species_id"))
	if agent is Node3D:
		FXManager.show_floating_text((agent as Node3D).global_position + Vector3.UP, "Leaves", Color(0.85, 0.85, 0.75))
	if not _emigrate_said:
		_emigrate_said = true
		chronicle.emit("The %s head over the peaks to other pastures." % SpeciesDB.label(sp).to_lower())
	agent.queue_free()
	return true

func _apply_emigration() -> void:
	_refresh_emigrant()
	if _emigrant_species.is_empty():
		return
	var excess: int = _agent_registry.size() - EMIGRATE_AT
	var batch: int = clampi(int(ceil(float(excess) * 0.08)), 12, 48)
	var leave_r: float = ValleyTerrain.WALK_RADIUS - 8.0
	var leave_r2: float = leave_r * leave_r
	var rim: Array[Node] = []
	var rest: Array[Node] = []
	for data: AgentData in _agent_registry:
		if data.species != _emigrant_species or data.node == null or not is_instance_valid(data.node):
			continue
		if _protected_from_emigration(data.node):
			continue
		if data.pos.x * data.pos.x + data.pos.z * data.pos.z >= leave_r2:
			rim.append(data.node)
		else:
			rest.append(data.node)
	var left := 0
	for node in rim:
		if left >= batch:
			break
		if depart(node):
			left += 1
	for node in rest:
		if left >= batch:
			break
		if depart(node):
			left += 1

# A valley-wide ceiling on births. Emigration, above, is what thins a valley
# that has outgrown the machine. This only stops a runaway past that.
# A dev override (the limits test and the frenzy finale lift it to 10000).
var creature_ceiling: int = 0
const EMIGRATE_AT: int = 2000

func max_creatures() -> int:
	if creature_ceiling > 0:
		return creature_ceiling
	return EMIGRATE_AT + 600

func _room_for_birth() -> bool:
	return _agent_registry.size() < max_creatures()

# Births stay inside the walkable valley (the highlands included).
func _in_valley(pos: Vector3) -> Vector3:
	var flat := Vector2(pos.x, pos.z)
	var limit: float = ValleyTerrain.WALK_RADIUS - 4.0
	if flat.length() > limit:
		flat = flat.normalized() * limit
		return Vector3(flat.x, ground_height(flat.x, flat.y), flat.y)
	return pos

# ------------------------------------------------------------------
# Producers: each one ripens in its own season and is worth most then.
# Grass is everywhere and peaks in spring; berry bushes fruit in summer;
# apple trees drop their (rich, uncommon) apples in autumn; moss, the
# rarest, thickens on the bark through the damp winter.
# ------------------------------------------------------------------
const PRODUCER_VALUE: Dictionary = {
	"grass": {"Spring": 1.3, "Summer": 1.0, "Autumn": 0.8, "Winter": 0.5},
	"moss": {"Spring": 0.9, "Summer": 0.6, "Autumn": 1.1, "Winter": 1.5},
	"riverweed": {"Spring": 1.2, "Summer": 1.0, "Autumn": 0.9, "Winter": 0.45},
}

func producer_value(kind: String) -> float:
	var row: Dictionary = PRODUCER_VALUE.get(kind, {})
	return float(row.get(_current_season, 1.0))

# A grazer's side dish: a berry at its feet or moss on a trunk beside it.
# Returns the energy it got (0 if nothing was in reach).
func browse(eater: Node3D, delta: float) -> float:
	var pos: Vector3 = eater.global_position
	var berry := find_nearest_berry(pos, 2.0)
	if berry != null and berry.has_method("eat") and pos.distance_squared_to(berry.global_position) < 2.0:
		return berry.eat(eater)
	var tree := find_nearest_tree(pos, 3.0)
	if tree != null and tree.has_method("eat_moss"):
		var m: float = tree.eat_moss(delta * 0.35, eater)
		if m > 0.0:
			return m * 30.0 * producer_value("moss")
	return 0.0

# A decomposer follows its nose: the carcass whose stink reaches it most
# strongly, from up to Corpse.STINK_RANGE_MAX away. Null if none reaches.
func smell_corpse(pos: Vector3) -> Node3D:
	var best: Node3D = null
	var best_pull: float = 0.0
	for c in $Corpses.get_children():
		if not c is Corpse or c.is_queued_for_deletion():
			continue
		var corpse := c as Corpse
		var d: float = pos.distance_to(corpse.global_position)
		var reach: float = corpse.stink_range()
		if d > reach:
			continue
		var pull: float = corpse.stink() * (1.0 - d / reach)
		if pull > best_pull:
			best_pull = pull
			best = corpse
	return best

# Spores ride the valley's wind field (4.7); never quite still.
func wind_at(pos: Vector3) -> Vector3:
	var w: Vector3 = wind.sample(pos) if wind != null else Vector3.ZERO
	return w if w.length() > 0.3 else Vector3(0.3, 0.0, 0.0) if w.length_squared() < 0.0001 else w.normalized() * 0.3

class_name MarkovAgent
extends Node3D

signal state_changed(old_state: String, new_state: String)

@export var move_speed: float = 3.0
@export var turn_speed: float = 5.0

var velocity: Vector3 = Vector3.ZERO
var _move_pace: float = 1.0
# Herding: 0 alone or on the edge of a group, up to 1 in the middle of a
# dense one. Creatures drift toward their own kind, and the ones in the
# middle get small bonuses (see HERD_* and CombatSystem).
var herd: float = 0.0
var _herd_pull: Vector3 = Vector3.ZERO
var _herd_timer: float = randf()
const HERD_RADIUS: float = 9.0
const HERD_CORE: float = 4.5
const HERD_FLEE: float = 0.2      # prey run up to 20% faster from the middle
const HERD_HUNGER: float = 0.1    # everyone in the middle gets hungry 10% slower
const HERD_HEAL: float = 0.4      # and mends a little
const URGENT_STATES: Array[String] = ["Flee", "Chase", "Dive", "Charge", "Raid", "Stranded", "Sleep"]
const RESTING_STATES: Array[String] = ["Sleep", "Rest"]

var _states: Dictionary = {}
var _current_state: String = ""
var _state_time: float = 0.0
var _min_state_time: float = 0.25
var _aerial: bool = false
var _aquatic: bool = false
var _attack_cooldown: float = 0.0
var _flee_boost_timer: float = 0.0
var _flee_boost_mult: float = 1.0
var _juvenile_timer: float = 3.0
var _data: AgentData = null
var display_name: String = ""
var sex: String = ""
var variant: String = ""
# "", "tough" or "special" (see Roles).
var role: String = ""
var species_id: String = ""
# Gold (4.7.1): rare, urgent, limited time. A creature that eats a golden
# plant turns Gold for at most one day: invincible, sparkling, and waiting for
# the player. Click it to claim the gold (the shield drops and a rampage is
# ready). Near the end it flashes. Unclaimed, the gold goes quiet: hidden in
# the creature, it passes on to whatever eats it (or its carcass), which
# turns Gold in turn. So the gold travels up the food web.
var golden: float = 0.0
var gold_left: float = 0.0
var gold_claimed: bool = false
var gold_latent: bool = false
const GOLD_FLASH_SHARE: float = 0.3
# Rainbow: eat a Starfruit (only a meteor brings them) and for half a day a
# creature sparkles, moves at 3x and strikes at 3x, and every Starfruit leaves
# it permanently hardier. The hunters among them turn on everything nearby:
# worms swarm and chew the health off much bigger animals, falcons and humans
# devour what they reach at a touch, and humans strip the land as they go.
const RAINBOW_SHARE: float = 0.5
const RAINBOW_MULT: float = 3.0
const RAINBOW_HEALTH: float = 50.0
const RAINBOW_HEALTH_MAX: float = 200.0
const RAINBOW_HUNTERS: Array[String] = ["wolf", "lion", "falcon", "human", "bear", "boar", "worm"]
const RAINBOW_INSTANT: Array[String] = ["falcon", "human"]
const RAINBOW_SIGHT: float = 18.0
const STARFRUIT_SMELL: float = 26.0
const RAINBOW_REACH: float = 2.0
const RAINBOW_STRIKE: float = 0.35
var rainbow_left: float = 0.0
# Permanent: how far above the normal cap health may go, from fruit eaten.
var rainbow_health: float = 0.0
var _rainbow_sparkle: float = 0.0
var _rainbow_strike: float = 0.0
var _rainbow_look: float = 0.0
var _rainbow_prey: Node3D = null
var _starfruit: Node3D = null
var _rainbow_aura: MeshInstance3D = null
# Take Control: the player drives this creature (rampage_steer is the stick).
var player_drive: bool = false
const DRIVE_SPEED: float = 6.0
# Genome (see Genetics): set once at birth or arrival.
var genes: Dictionary = {}
const GOLD_FADE: float = 0.02
var _gold_sparkle: float = 0.0
# Rampage: the player takes a golden creature in hand and spends its gold.
# It devours anything not of its own kind until the gold runs out.
signal rampage_ended(kills: int)
var rampage: bool = false
# Scripted (the opening film): the director leaves it alone and something
# else moves it with stage_to().
var scripted: bool = false
var rampage_steer: Vector3 = Vector3.ZERO
var rampage_kills: int = 0
var _rampage_strike: float = 0.0
var _rampage_time: float = 0.0
# Gold burns faster the longer a rampage runs, kills never refill it, and no
# rampage outlasts RAMPAGE_MAX seconds: a full load lasts about 10 s.
const RAMPAGE_DRAIN: float = 0.04
const RAMPAGE_RAMP: float = 0.005
const RAMPAGE_MAX: float = 20.0
const RAMPAGE_SPEED: float = 7.5
var _role_timer: float = 2.0
var _age: float = 0.0
var _lifespan: float = 80.0
var _lifespan_bonus: float = 0.0
var _death_clock: float = 0.0
var _last_energy: float = -1.0
var _vision_cone: VisionCone = null
const _NO_MODS: Dictionary = {"__none__": true}
# Creatures roam the meadow, the highlands and the lower mountain slopes.
# Only the last few metres turn them back, so the slopes stay lived-in.
# Past the hard edge they leave only when the valley is emigrating (see
# SimulationDirector.should_depart); otherwise they step back in, off the
# exact circle, so a crowd cannot freeze into a ring.
const BOUNDARY_SOFT: float = ValleyTerrain.WALK_RADIUS - 6.0
const BOUNDARY_HARD: float = ValleyTerrain.WALK_RADIUS - 0.5

@onready var director: SimulationDirector = _find_director()

func _find_director() -> SimulationDirector:
	var node := get_parent()
	while node != null:
		if node is SimulationDirector:
			return node as SimulationDirector
		node = node.get_parent()
	return null

func _ready() -> void:
	_register_states()
	assert(not _current_state.is_empty(), "MarkovAgent: initial state must be set in _register_states")
	set_physics_process(false)
	_vision_cone = get_node_or_null("VisionCone") as VisionCone
	# _age and _lifespan are declared here for subclass use in _metabolise and _try_reproduce
	_age = _age
	_lifespan = _lifespan
	# Generate a species-specific display name for tickertape
	var species: String = ""
	if is_in_group("wolf"): species = "wolf"
	elif is_in_group("sheep"): species = "sheep"
	elif is_in_group("human"): species = "human"
	elif is_in_group("boar"): species = "boar"
	elif is_in_group("falcon"): species = "falcon"
	elif is_in_group("robin"): species = "robin"
	elif is_in_group("worm"): species = "worm"
	elif is_in_group("fish"): species = "fish"
	elif is_in_group("spore"): species = "mushroom"
	elif is_in_group("rabbit"): species = "rabbit"
	else:
		for id: String in SpeciesDB.NEW_SPECIES:
			if is_in_group(id):
				species = id
				break
	species_id = species
	# Spores reproduce asexually; everyone else gets a sex, then a name to suit.
	if not is_in_group("spore"):
		sex = "female" if randf() > 0.5 else "male"
	if not species.is_empty():
		display_name = NameGenerator.generate(species, sex)

func _register_states() -> void:
	pass

# Puts a scripted creature somewhere this frame and tells its sprite how it
# is moving, so it walks, eats or sleeps on screen without the AI.
func stage_to(pos: Vector3, state: String = "Walk") -> void:
	var was: Vector3 = global_position
	global_position = pos
	if _data != null:
		var dt: float = maxf(get_process_delta_time(), 0.001)
		_data.prev_pos = pos
		_data.pos = pos
		_data.vel = (pos - was) / dt
		_data.sync_time = AgentData.clock
		_data.interval = 0.05
		_data.state = state
		_data.golden = golden
		if _data.age < 30.0:
			_data.age = 30.0

func start_rampage() -> bool:
	if golden <= 0.05 or rampage:
		return false
	gold_claimed = true
	rampage = true
	rampage_kills = 0
	_rampage_time = 0.0
	# Ticks every frame while in hand, not on the director's stagger.
	set_physics_process(true)
	FXManager.show_dramatic_text(global_position + Vector3.UP * 2.5, "RAMPAGE!", Color(1.0, 0.82, 0.25))
	return true

func end_rampage() -> void:
	if not rampage:
		return
	rampage = false
	rampage_steer = Vector3.ZERO
	velocity = Vector3.ZERO
	golden = 0.0
	set_physics_process(false)
	var sim = director
	if sim != null:
		sim.chronicle.emit("%s's rampage ends after %d kills. The gold is spent." % [display_name, rampage_kills])
	# Win the rampage, earn a Greenhouse upgrade.
	var gc: Node = get_node_or_null("/root/GameConfig")
	var won: bool = gc != null and rampage_kills >= gc.RAMPAGE_GOAL
	if sim != null:
		sim.rampage_result.emit(display_name, rampage_kills, won)
	if not won:
		FXManager.show_dramatic_text(global_position + Vector3.UP * 3.0, "Rampage failed: %d of %d" % [rampage_kills, int(gc.RAMPAGE_GOAL) if gc != null else 0], Color(0.95, 0.35, 0.3))
	if won:
		if Cosmetics.grant(gc, "claw"):
			FXManager.show_dramatic_text(global_position + Vector3.UP * 5.0, "Unlocked: Golden Claw cursor!", Color(1.0, 0.8, 0.3))
		var boosted: Array[String] = Schemes.on_rampage(gc, species_id)
		if not boosted.is_empty():
			FXManager.show_dramatic_text(global_position + Vector3.UP * 4.0, "SCHEME! +15%% on %s" % ", ".join(boosted), Color(1.0, 0.85, 0.3))
		var id: String = gc.unlock_next_upgrade()
		var what: String = "every upgrade is already yours" if id.is_empty() else "%s unlocked" % id.replace("_", " ").capitalize()
		FXManager.show_dramatic_text(global_position + Vector3.UP * 3.0, "Rampage won! %s" % what, Color(1.0, 0.85, 0.3))
		if sim != null:
			sim.chronicle.emit("A rampage for the ages: %s." % what)
	rampage_ended.emit(rampage_kills)

func _rampage_tick(delta: float) -> void:
	velocity = rampage_steer.limit_length(1.0) * RAMPAGE_SPEED
	_rampage_time += delta
	# A rampaging bird flies low and fast, skimming over its prey.
	if _aerial and director != null:
		var low: float = director.ground_height(global_position.x, global_position.z) + 2.0
		global_position.y = lerpf(global_position.y, low, minf(delta * 3.0, 1.0))
	golden -= (RAMPAGE_DRAIN + RAMPAGE_RAMP * _rampage_time) * delta
	_rampage_strike -= delta
	var sim = director
	if sim != null and _rampage_strike <= 0.0:
		# A tight bite: the player has to steer right onto the prey. Fliers
		# strike at the ground under them (a 3D reach never touched anything
		# from the air), with a slightly wider grab for the swoop.
		var bite_at: Vector3 = global_position
		var bite_r: float = 1.8
		if _aerial:
			bite_at.y = sim.ground_height(bite_at.x, bite_at.z)
			bite_r = 2.4
		for n in sim.get_nearby_agents(bite_at, bite_r):
			if n == self or not n is MarkovAgent or n.is_queued_for_deletion() or (n as MarkovAgent).species_id == species_id:
				continue
			_rampage_strike = 0.45
			rampage_kills += 1
			FXManager.spawn_combat_particles(n.global_position)
			FXManager.show_floating_text(n.global_position + Vector3.UP, "CHOMP", Color(1.0, 0.85, 0.3))
			# Devouring golden prey must not top the gold back up.
			var keep: float = golden
			devour(n)
			golden = keep
			if get("energy") != null:
				set("energy", minf(float(get("energy")) + 15.0, 100.0))
			break
	if golden <= 0.02 or _rampage_time >= RAMPAGE_MAX:
		end_rampage()

# The player clicked this Gold creature: the shield drops, the rampage is ready.
func claim_gold() -> void:
	if golden <= 0.05 or gold_claimed:
		return
	gold_claimed = true
	FXManager.show_dramatic_text(global_position + Vector3.UP * 2.2, "Rampage ready!", Color(1.0, 0.85, 0.25))

# Called first in every die(): an unclaimed Gold creature cannot die (true =
# it lives). A creature carrying quiet gold hands it to its eater as it goes.
func gold_shield() -> bool:
	if golden > 0.05 and not gold_claimed and not rampage:
		if get("health") != null:
			set("health", 100.0)
		if get("energy") != null:
			set("energy", maxf(float(get("energy")), 50.0))
		FXManager.show_floating_text(global_position + Vector3.UP * 1.4, "Untouchable!", Color(1.0, 0.85, 0.3))
		return true
	if gold_latent:
		gold_latent = false
		golden = 0.9
	return false

# Eat a whole creature (a worm, a mushroom, a kill): take on its gold, then it dies.
func devour(prey: Node) -> void:
	if prey == null or not is_instance_valid(prey):
		return
	# Only quiet gold passes on; a shining Gold creature can't be eaten at all.
	var quiet: bool = prey.get("gold_latent") == true
	if prey.has_method("die"):
		prey.die()
	if quiet:
		make_golden(1.0, str(prey.get("species_id")))

func is_rainbow() -> bool:
	return rainbow_left > 0.0

# Eating a Starfruit: the richest meal there is, and the Rainbow condition.
func eat_starfruit() -> void:
	rainbow_left = Clock.BIO_PER_DAY * RAINBOW_SHARE
	rainbow_health = minf(rainbow_health + RAINBOW_HEALTH, RAINBOW_HEALTH_MAX)
	if get("health") != null:
		set("health", float(get("health")) + RAINBOW_HEALTH)
	if get("energy") != null:
		set("energy", maxf(float(get("energy")), 0.0) + Starfruit.NUTRITION)
	_starfruit = null
	if _rainbow_aura == null:
		var cfg: Dictionary = VisualProxyManager.SPECIES_CONFIG.get(species_id, {})
		var body: Vector2 = cfg.get("size", Vector2(2.2, 2.2))
		_rainbow_aura = Starfruit.glow_quad(maxf(body.x, body.y) * 2.1, 0.62)
		_rainbow_aura.top_level = true
		add_child(_rainbow_aura)
		_place_rainbow_aura()
	FXManager.show_dramatic_text(global_position + Vector3.UP * 2.2, "RAINBOW!", Color.from_hsv(randf(), 0.7, 1.0))
	var sim: SimulationDirector = director
	if sim != null:
		sim.chronicle.emit("%s eats a Starfruit and turns Rainbow." % display_name)

# Every creature smells Starfruit and drops everything for it.
func _seek_starfruit(delta: float) -> void:
	var sim: SimulationDirector = director
	if sim == null or scripted or species_id == "mushroom" or get("indoors") == true:
		return
	_rainbow_look -= delta
	if _rainbow_look <= 0.0:
		_rainbow_look = 0.4 + randf() * 0.2
		_starfruit = sim.find_nearest_starfruit(global_position, STARFRUIT_SMELL)
	if _starfruit == null or not is_instance_valid(_starfruit):
		_starfruit = null
		return
	var to: Vector3 = _starfruit.global_position - global_position
	to.y = 0.0
	var d: float = to.length()
	if d < 1.5:
		var fruit := _starfruit as Starfruit
		if fruit != null and fruit.claim():
			eat_starfruit()
		return
	# Fish can only take what falls within reach of the water.
	if _aquatic:
		return
	velocity = to / d * 4.5

# The glow follows the sprite, which fliers draw high above their node.
func _place_rainbow_aura() -> void:
	if _rainbow_aura == null:
		return
	var at: Vector3 = _data.shown if _data != null and _data.has_shown else global_position
	if _data != null and _data.drawn_mid_y > 0.2:
		at.y = _data.drawn_mid_y
	else:
		at.y += 1.0
	_rainbow_aura.global_position = at

func _rainbow_tick(delta: float) -> void:
	_place_rainbow_aura()
	_rainbow_sparkle -= delta
	if _rainbow_sparkle <= 0.0:
		_rainbow_sparkle = 0.28
		FXManager.spawn_birth_particles(global_position + Vector3.UP * 0.8, Color.from_hsv(randf(), 0.75, 1.0))
	if scripted or not RAINBOW_HUNTERS.has(species_id):
		return
	var sim: SimulationDirector = director
	if sim == null:
		return
	if species_id == "human":
		sim.grass.consume_density(global_position, delta * 2.0)
	_rainbow_strike -= delta
	if _rainbow_prey == null or not is_instance_valid(_rainbow_prey) or _rainbow_strike <= 0.0:
		_rainbow_prey = sim.rainbow_prey_for(self, RAINBOW_SIGHT)
	if _rainbow_prey == null or not is_instance_valid(_rainbow_prey):
		return
	var to: Vector3 = _rainbow_prey.global_position - global_position
	to.y = 0.0
	var d: float = to.length()
	if d > RAINBOW_REACH:
		if not _aquatic and d > 0.01 and not player_drive:
			velocity = to / d * 5.0
		return
	if _rainbow_strike > 0.0:
		return
	_rainbow_strike = RAINBOW_STRIKE
	_rainbow_hit(_rainbow_prey)

func _rainbow_hit(prey: Node3D) -> void:
	var at: Vector3 = prey.global_position + Vector3.UP
	var armoured: bool = prey.has_method("is_rainbow") and prey.is_rainbow()
	if RAINBOW_INSTANT.has(species_id) and not armoured:
		FXManager.spawn_combat_particles(at)
		devour(prey)
		if get("energy") != null:
			set("energy", float(get("energy")) + 30.0)
		return
	var bite: float = float(get("damage")) if get("damage") != null else 8.0
	bite = maxf(bite, 7.0) * RAINBOW_MULT
	if prey.get("health") == null:
		return
	var left: float = float(prey.get("health")) - bite
	prey.set("health", left)
	FXManager.show_floating_text(at, "-%d" % int(bite), Color.from_hsv(randf(), 0.7, 1.0))
	# It takes for itself what it tears away.
	if get("health") != null:
		set("health", float(get("health")) + bite * 0.25)
	if left <= 0.0 and prey.has_method("die"):
		devour(prey)

# Take on gold from a meal. Strength 1 is a golden plant; kills and carcasses
# pass on a share of what the eaten creature carried.
func make_golden(strength: float, source: String = "") -> void:
	if strength <= 0.02:
		return
	var was: bool = golden > 0.05
	if was:
		return
	golden = 1.0
	gold_left = Clock.BIO_PER_DAY
	gold_claimed = false
	gold_latent = false
	FXManager.show_dramatic_text(global_position + Vector3.UP * 2.0, "GOLD!", Color(1.0, 0.85, 0.25))
	if not was and golden > 0.05:
		var sim = director
		if sim != null and sim.has_signal("gold_passed"):
			sim.gold_passed.emit(source, species_id, global_position)

func _register_state(state_name: String, on_enter: Callable, on_tick: Callable, on_exit: Callable) -> void:
	_states[state_name] = {
		"on_enter": on_enter,
		"on_tick": on_tick,
		"on_exit": on_exit,
	}

func set_state(next: String) -> void:
	assert(_states.has(next), "MarkovAgent: invalid state name '%s'" % next)
	if next == _current_state:
		return
	if _current_state != "" and _states[_current_state]["on_exit"].is_valid():
		_states[_current_state]["on_exit"].call()
	var old := _current_state
	_current_state = next
	_state_time = 0.0
	if _states[_current_state]["on_enter"].is_valid():
		_states[_current_state]["on_enter"].call()
	state_changed.emit(old, _current_state)

func current_state() -> String:
	return _current_state

func _physics_process(delta: float) -> void:
	# Two speeds: bodies move in real time, but everything ecological (eating,
	# fighting, hunting, abilities, hunger, breeding, ageing) runs on life
	# time, Clock.LIFE_PACE slower, so a day holds a calm, readable story.
	var life: float = delta * Clock.LIFE_PACE
	_state_time += delta
	_attack_cooldown = maxf(_attack_cooldown - life, 0.0)
	_flee_boost_timer = maxf(_flee_boost_timer - delta, 0.0)
	_juvenile_timer = maxf(_juvenile_timer - life, 0.0)
	var entry: Variant = _states.get(_current_state)
	if rampage:
		_rampage_tick(delta)
	elif entry != null:
		var on_tick: Callable = entry["on_tick"]
		if on_tick.is_valid():
			on_tick.call(life)
	if not rampage and rainbow_left <= 0.0 and director != null and director.has_starfruit():
		_seek_starfruit(delta)
	if rainbow_left > 0.0:
		rainbow_left -= life
		if rainbow_left <= 0.0:
			FXManager.show_floating_text(global_position + Vector3.UP * 1.5, "The rainbow fades...", Color(0.8, 0.8, 0.95))
			if _rainbow_aura != null:
				_rainbow_aura.queue_free()
				_rainbow_aura = null
		elif not rampage:
			_rainbow_tick(delta)
	if player_drive and not rampage:
		velocity = rampage_steer.limit_length(1.0) * DRIVE_SPEED
	_herd_timer -= delta
	if _herd_timer <= 0.0:
		_herd_timer = 1.0 + randf() * 0.3
		_update_herd()
		_update_corpse_push()
	_movement_tick(delta)
	if not rampage:
		_evaluate_transitions(delta)
	if not role.is_empty():
		Roles.tick(self, species_id, life)
	# Unified lifecycle: subclasses override these methods. Life (hunger,
	# breeding, ageing) runs at Clock.LIFE_PACE; movement above stays real-time.
	var sim: SimulationDirector = director
	var metab_mult: float = 1.0 if sim == null else sim.season_metabolism(species_id) * sim.tune(species_id, "hunger")
	metab_mult *= 1.0 - HERD_HUNGER * herd
	if golden > 0.05 and not rampage:
		gold_left -= life
		if gold_left <= 0.0:
			# Unclaimed: the gold goes quiet, waiting for whatever eats this one.
			golden = 0.0
			gold_claimed = false
			gold_latent = true
			FXManager.show_floating_text(global_position + Vector3.UP * 1.5, "The gold fades...", Color(0.85, 0.75, 0.45))
		_gold_sparkle -= life
		if _gold_sparkle <= 0.0 and golden > 0.05:
			_gold_sparkle = 1.2 + randf()
			FXManager.spawn_birth_particles(global_position + Vector3.UP * 0.6, Color(1.0, 0.85, 0.3))
			if not gold_claimed and randf() < 0.3:
				FXManager.show_floating_text(global_position + Vector3.UP * 1.8, "Click me!" if gold_left > Clock.BIO_PER_DAY * GOLD_FLASH_SHARE else "Hurry!", Color(1.0, 0.85, 0.3))
	if herd > 0.0 and get("health") != null:
		var cap: float = 100.0 + rainbow_health
		var now_health: float = float(get("health"))
		if now_health < cap:
			set("health", minf(now_health + HERD_HEAL * herd * life, cap))
	_metabolise(life * metab_mult)
	# Out of season, breeding stalls; in season it comes round faster.
	var breed: float = 1.0 if sim == null else sim.season_breeding(species_id) * sim.tune(species_id, "birth")
	if breed >= 1.0:
		_try_reproduce(life * breed)
	elif randf() < breed:
		_try_reproduce(life / maxf(breed, 0.05) * 0.5)
	# Lifespan extension: eating and energy gains extend life
	var cur_energy: Variant = get("energy")
	if cur_energy != null and _last_energy >= 0.0 and cur_energy > _last_energy:
		var gained: float = float(cur_energy) - _last_energy
		_lifespan_bonus += gained * 0.03
		_lifespan_bonus = clampf(_lifespan_bonus, 0.0, _lifespan * 0.5)
	_last_energy = cur_energy if cur_energy != null else -1.0
	_age_and_die(life)
	# Sync ECS data record
	if _data != null:
		var clock_now: float = AgentData.clock
		_data.interval = clampf(clock_now - _data.sync_time, 0.016, 1.0)
		_data.prev_pos = _data.shown if _data.has_shown else global_position
		_data.pos = global_position
		# What the creature actually moves at (day/night and tuning included), so
		# the sprite glides along its real path instead of overshooting and snapping.
		_data.vel = velocity * _move_pace
		_data.sync_msec = Time.get_ticks_msec()
		_data.sync_time = AgentData.clock
		_data.state = _current_state
		var cur_health: Variant = get("health")
		if cur_health != null:
			_data.health = cur_health
		cur_energy = get("energy")
		if cur_energy != null:
			_data.energy = cur_energy
		# The last stretch of unclaimed gold flashes on and off.
		var flash: bool = golden > 0.05 and not gold_claimed and not rampage and gold_left < Clock.BIO_PER_DAY * GOLD_FLASH_SHARE and fmod(Time.get_ticks_msec() / 1000.0, 0.5) < 0.22
		_data.golden = 0.0 if flash else golden
		_data.rainbow = rainbow_left > 0.0
		_data.age = _age

# Looks at its own kind within HERD_RADIUS: how close it is to their middle
# and how packed the middle is. Edge-dwellers score near zero.
# Most creatures give a carcass a wide berth. Only the carnivores (and the
# bears) who pick bodies clean, and the decomposers who finish them, go near.
const CORPSE_EATERS: Array[String] = ["wolf", "falcon", "lion", "bear", "beetle", "worm", "mushroom"]
const CORPSE_BERTH: float = 4.0
var _corpse_push: Vector3 = Vector3.ZERO

func _update_corpse_push() -> void:
	_corpse_push = Vector3.ZERO
	if _aerial or _aquatic or CORPSE_EATERS.has(species_id):
		return
	var sim: SimulationDirector = director
	if sim == null:
		return
	var c := sim.find_nearest_corpse(global_position, CORPSE_BERTH)
	if c == null:
		return
	var away := global_position - c.global_position
	away.y = 0.0
	var d: float = away.length()
	if d > 0.01:
		_corpse_push = away / d * (1.0 - d / CORPSE_BERTH) * 2.5

# Who keeps company (4.7): only true herds, flocks, packs and shoals pull
# together. Lone hunters keep their distance from their own kind instead
# (falcons go further and hold territory; see Falcon).
const HERDERS: Array[String] = ["sheep", "deer", "goat", "rabbit", "wolf", "boar", "human", "fish", "robin"]
const SOLITARY: Array[String] = ["lion", "bear", "falcon"]
const SOLITARY_SPACE: float = 10.0
const BIOME_PULL: float = 0.9

func _update_herd() -> void:
	var sim: SimulationDirector = director
	if sim == null or species_id.is_empty() or species_id == "mushroom":
		herd = 0.0
		_herd_pull = Vector3.ZERO
		return
	# Every creature drifts back toward its home biomes when it strays.
	var home: Vector3 = Biomes.pull(species_id, global_position) * BIOME_PULL
	if not HERDERS.has(species_id):
		herd = 0.0
		_herd_pull = home
		if SOLITARY.has(species_id):
			var away := Vector3.ZERO
			for k in sim.get_nearby_agents(global_position, SOLITARY_SPACE, species_id):
				if k == self:
					continue
				var d := Vector3(global_position.x - k.global_position.x, 0.0, global_position.z - k.global_position.z)
				var l: float = d.length()
				if l > 0.05:
					away += d / l * (1.0 - l / SOLITARY_SPACE)
			_herd_pull += away.limit_length(1.2)
		return
	var strength: float = sim.tune(species_id, "herd")
	var kin := sim.get_nearby_agents(global_position, HERD_RADIUS, species_id)
	var centre := Vector3.ZERO
	var n: int = 0
	var core: int = 0
	for k in kin:
		if k == self:
			continue
		centre += k.global_position
		n += 1
		if k.global_position.distance_squared_to(global_position) <= HERD_CORE * HERD_CORE:
			core += 1
	if n < 2:
		herd = 0.0
		_herd_pull = home
		return
	centre /= float(n)
	var to_centre := Vector3(centre.x - global_position.x, 0.0, centre.z - global_position.z)
	var off: float = to_centre.length()
	var middle: float = 1.0 - clampf(off / 5.0, 0.0, 1.0)
	var packed: float = clampf(float(core) / 4.0, 0.0, 1.0)
	herd = clampf(middle * packed * strength, 0.0, 1.0)
	# A gentle pull back toward the group, stronger the further out.
	_herd_pull = to_centre.normalized() * clampf((off - 2.0) * 0.25, 0.0, 1.2) * strength if off > 2.0 else Vector3.ZERO
	_herd_pull += home

func _metabolise(_delta: float) -> void:
	pass

func _try_reproduce(_delta: float) -> void:
	pass

func get_flee_speed(base: float) -> float:
	var pace := base
	var sim: SimulationDirector = director
	if sim != null and not species_id.is_empty():
		pace *= sim.tune(species_id, "nerve")
	if _flee_boost_timer > 0.0:
		return pace * _flee_boost_mult
	return pace

func _movement_tick(delta: float) -> void:
	if _data != null and _data.draw_lift > 0.05:
		velocity = Vector3.ZERO
		return
	if _aquatic:
		if has_method("_swim_tick"):
			call("_swim_tick", delta * (RAINBOW_MULT if rainbow_left > 0.0 else 1.0))
		return
	# Asleep (or resting) and not walking anywhere: lie perfectly still. No
	# crowd, herd, rim or riverbank shove may nudge a sleeper along the ground.
	if RESTING_STATES.has(_current_state) and velocity.length_squared() < 0.25 and not _aerial:
		velocity = Vector3.ZERO
		return
	if _aerial:
		# Birds stay over the valley. The turn starts only on the last slope.
		var ra: float = Vector2(global_position.x, global_position.z).length()
		if ra > BOUNDARY_SOFT:
			var span: float = maxf(BOUNDARY_HARD - BOUNDARY_SOFT, 0.5)
			var t: float = clampf((ra - BOUNDARY_SOFT) / span, 0.0, 1.0)
			velocity += Vector3(-global_position.x, 0.0, -global_position.z) / ra * lerpf(0.6, 3.0, t * t)
	if not _aerial:
		velocity.y = 0.0
		# The mountain slopes are walkable. Only the last few metres ease
		# a creature back down, and only after cancelling an outward shove.
		var r: float = Vector2(global_position.x, global_position.z).length()
		if r > BOUNDARY_SOFT:
			var inward := Vector3(-global_position.x, 0.0, -global_position.z) / r
			var outward: float = -velocity.dot(inward)
			if outward > 0.0:
				velocity += inward * outward
			var span: float = maxf(BOUNDARY_HARD - BOUNDARY_SOFT, 0.5)
			var t: float = clampf((r - BOUNDARY_SOFT) / span, 0.0, 1.0)
			velocity += inward * lerpf(0.35, 2.2, t * t)
	# Batch separation via crowding field (no per-agent spatial queries)
	if velocity.length_squared() > 0.01:
		var sim: SimulationDirector = director
		if sim != null:
			velocity += sim.get_crowding_vector(global_position)
		# Magnetism toward their own kind, unless something urgent is happening.
		if not URGENT_STATES.has(_current_state):
			velocity += _herd_pull
		velocity += _corpse_push
	if velocity.length_squared() > 0.001:
		# Day and night set the pace: sleepers barely shuffle, hunters prowl.
		var pace: float = 1.0
		var dn_sim: SimulationDirector = director
		if dn_sim != null and not species_id.is_empty():
			pace = dn_sim.daynight_mult(species_id, 0) * dn_sim.tune(species_id, "speed")
			if _current_state == "Flee":
				pace *= 1.0 + HERD_FLEE * herd
		if _data != null:
			pace *= _data.speed_boost
		if rainbow_left > 0.0:
			pace *= RAINBOW_MULT
		_move_pace = pace
		global_position += velocity * delta * pace
		# However hard they flee (and however long a staggered step), fliers
		# either leave for another pasture or step back off the cliff.
		if _aerial:
			var fl := Vector2(global_position.x, global_position.z)
			if fl.length() > BOUNDARY_HARD:
				var air_sim: SimulationDirector = director
				if air_sim != null and air_sim.should_depart(self):
					air_sim.depart(self)
					return
				fl = _step_back_from_edge(fl)
				global_position.x = fl.x
				global_position.z = fl.y
	if not _aerial:
		var ground_y := 0.0
		var ground_sim: SimulationDirector = director
		if ground_sim != null:
			ground_y = ground_sim.ground_height(global_position.x, global_position.z)
		var flat := Vector2(global_position.x, global_position.z)
		if flat.length() > BOUNDARY_HARD:
			if ground_sim != null and ground_sim.should_depart(self):
				ground_sim.depart(self)
				return
			flat = _step_back_from_edge(flat)
			global_position.x = flat.x
			global_position.z = flat.y
			velocity = Vector3(-global_position.x, 0.0, -global_position.z).normalized() * 1.5
			if ground_sim != null:
				ground_y = ground_sim.ground_height(flat.x, flat.y)
		global_position.y = ground_y
		if ground_sim != null and ground_sim.valley != null and ground_sim.valley.river != null and ground_sim.valley.river.is_near(global_position.x, global_position.z):
			var wet: Dictionary = ground_sim.valley.river.sample(global_position.x, global_position.z)
			if wet.in_water and float(wet.distance) < ground_sim.valley.river.half_width() * 0.62:
				var bank: Vector3 = wet.closest
				var away := Vector3(global_position.x - bank.x, 0.0, global_position.z - bank.z)
				if away.length_squared() > 0.01:
					velocity += away.normalized() * 7.0

# Pull a creature back inside the slopes, a little off the exact radius and
# a little to one side, so a crowd cannot sit on one perfect circle.
func _step_back_from_edge(flat: Vector2) -> Vector2:
	var inward := flat.normalized()
	var side := Vector2(-inward.y, inward.x) * randf_range(-3.0, 3.0)
	var back: Vector2 = inward * (BOUNDARY_HARD - randf_range(2.0, 7.0)) + side
	if back.length() > BOUNDARY_HARD - 1.0:
		back = back.normalized() * (BOUNDARY_HARD - randf_range(1.5, 4.0))
	return back

func _get_transition_modifiers() -> Dictionary:
	return {}

# Pass the modifiers already computed this tick so they are not built twice.
# Picks a registered state with probability proportional to its modifier.
func _pick_next_state(mods: Dictionary = _NO_MODS) -> String:
	if mods == _NO_MODS:
		mods = _get_transition_modifiers()
	var total := 0.0
	for k: String in mods:
		if _states.has(k):
			total += clampf(mods[k], 0.0, 1.0)
	if total <= 0.0:
		return _current_state
	var pick := randf() * total
	for k: String in mods:
		if not _states.has(k):
			continue
		var p: float = clampf(mods[k], 0.0, 1.0)
		if p > 0.0:
			pick -= p
			if pick <= 0.0:
				return k
	return _current_state

func _evaluate_transitions(_delta: float) -> void:
	var mods := _get_transition_modifiers()
	var emergent: String = ""
	var em_prob: float = 0.0
	for k: String in mods.keys():
		if mods[k] > em_prob:
			em_prob = mods[k]
			emergent = k
	# Instant interrupt for life-threatening transitions
	if em_prob >= 0.8 and emergent != _current_state:
		set_state(emergent)
		return
	if _state_time < _min_state_time:
		return
	var next := _pick_next_state(mods)
	if next != _current_state:
		set_state(next)

# Flocking: steer toward same-species members
func _cohesion_vector(group_tag: String, radius: float, strength: float) -> Vector3:
	var sim: SimulationDirector = director
	if sim == null:
		return Vector3.ZERO
	var nearby := sim.get_nearby_agents(global_position, radius, group_tag)
	var center := Vector3.ZERO
	var count := 0
	for node in nearby:
		if node == self:
			continue
		if not node is Node3D:
			continue
		center += node.global_position
		count += 1
	if count <= 0:
		return Vector3.ZERO
	center /= float(count)
	var dir := (center - global_position).normalized()
	return dir * strength

func _bind_agent_data(data: AgentData) -> void:
	_data = data

# Probabilistic lifespan with exponential death curve (Euler curve).
# Eating extends lifespan bonus. Health/energy modulate death clock speed.
func _age_and_die(delta: float) -> void:
	_age += delta
	# Starvation and wounds kill at any age (young animals used to linger
	# at negative health because the check sat behind the juvenile grace).
	var hp: Variant = get("health")
	if hp != null and float(hp) <= 0.0:
		if has_method("die"):
			call("die")
		return
	# Tuning Lab "death": above 1 they age out sooner, below 1 they live longer.
	var death_mult: float = 1.0
	var tsim: SimulationDirector = director
	if tsim != null:
		death_mult = maxf(tsim.tune(species_id, "death"), 0.05)
	var effective_lifespan: float = (_lifespan + _lifespan_bonus) / death_mult
	# Phase 1: juvenile grace period — no death chance
	if _age < effective_lifespan * 0.75:
		_death_clock = 0.0
		return
	# Phase 2: exponential death probability beyond 75% of lifespan
	_death_clock += delta
	var health: float = get("health") if get("health") != null else 50.0
	var energy: float = get("energy") if get("energy") != null else 50.0
	# Starvation and injury accelerate the death clock
	var clock_mult: float = 1.0
	if health < 30.0:
		clock_mult += 1.5
	if energy < 10.0:
		clock_mult += 2.0
	# Good health and fullness can pause or even slightly reverse the clock
	if health > 80.0 and energy > 60.0:
		clock_mult -= 0.3
	if health > 90.0 and energy > 80.0:
		clock_mult -= 0.3
	clock_mult = clampf(clock_mult, 0.1, 5.0)
	var scaled_clock: float = _death_clock * clock_mult
	# Exponential death probability: P(death) = 1 - exp(-t / tau)
	# tau = 25% of effective lifespan. At t=tau, P=63%. At t=2*tau, P=86%.
	var tau: float = effective_lifespan * 0.25
	var death_prob: float = 1.0 - exp(-scaled_clock / tau)
	if randf() < death_prob:
		if has_method("die"):
			call("die")
		return
	# Hard failsafe: if age exceeds 2.5x effective lifespan, guaranteed death
	if _age >= effective_lifespan * 2.5:
		if has_method("die"):
			call("die")
		return
	# Instant death from zero health (combat, starvation)
	if health <= 0.0:
		if has_method("die"):
			call("die")

func _get_var(var_name: String) -> Variant:
	if get(var_name) != null:
		return get(var_name)
	return null

func _set_var(var_name: String, value: Variant) -> void:
	set(var_name, value)

# Seek target position
func _seek_vector(target_pos: Vector3, strength: float) -> Vector3:
	var dir := (target_pos - global_position).normalized()
	return dir * strength

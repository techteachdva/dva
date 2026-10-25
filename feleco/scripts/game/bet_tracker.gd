class_name BetTracker
extends Node

# Watches the valley for the things bets care about (extinctions, peaks,
# the flood toll, named creatures) and settles bets the moment they are
# decided. Live wins pay straight into the pot.

signal bet_settled(bet: Dictionary)

const CHECK_EVERY: float = 0.5

var director: SimulationDirector
var stats: Dictionary = {
	"start": {}, "peak": {}, "extinct_day": {}, "named_dead": {}, "named_age": {},
	"flood_toll": 0, "max_extinct_at_once": 0,
}
var _accum: float = 0.0
var _started: bool = false
var _final: bool = false
var _seen_named: Dictionary = {}

func _ready() -> void:
	name = "BetTracker"
	director = get_parent() as SimulationDirector

func counts() -> Dictionary:
	if director == null:
		return {}
	var c: Dictionary = director.get_creature_counts()
	c["mushrooms"] = director._active_spores.size()
	return c

func _gc() -> Node:
	return get_node_or_null("/root/GameConfig")

func _physics_process(delta: float) -> void:
	if director == null or _final:
		return
	_accum += delta
	if _accum < CHECK_EVERY:
		return
	_accum = 0.0
	refresh()
	_judge_all(false)

func refresh() -> void:
	var c := counts()
	var day: float = director.get_day()
	if not _started:
		# The first look after spawning is the starting line-up.
		if c.values().reduce(func(a, b): return a + int(b), 0) <= 0:
			return
		_started = true
		stats["start"] = c.duplicate()
	var zero_now: int = 0
	for f: Array in BetBook.FACTIONS:
		var k: String = f[0]
		var n: int = int(c.get(k, 0))
		stats["peak"][k] = maxi(int(stats["peak"].get(k, 0)), n)
		if n == 0 and int(stats["peak"].get(k, 0)) > 0:
			zero_now += 1
			if not stats["extinct_day"].has(k):
				stats["extinct_day"][k] = day
	stats["max_extinct_at_once"] = maxi(int(stats["max_extinct_at_once"]), zero_now)
	stats["flood_toll"] = director.flood_fish_toll
	stats["day"] = day
	var gc := _gc()
	if gc == null:
		return
	var alive: Dictionary = {}
	for data: AgentData in director._agent_registry:
		if data.node == null or not is_instance_valid(data.node):
			continue
		var nm = data.node.get("display_name")
		if nm == null or String(nm).is_empty():
			continue
		# Ages are kept in days of sun and moon, like every bet.
		alive["%s|%s" % [nm, data.species]] = data.age / Clock.BIO_PER_DAY
	for r: Dictionary in gc.spawn_roster:
		var key: String = "%s|%s" % [r["name"], r["species"]]
		if alive.has(key):
			_seen_named[key] = true
			stats["named_age"][key] = alive[key]
		elif _seen_named.has(key) and not stats["named_dead"].has(key):
			stats["named_dead"][key] = day

func progress() -> float:
	return clampf(director.get_day() / director.year_days(), 0.0, 1.0) if director != null else 0.0

func _judge_all(final: bool) -> void:
	var gc := _gc()
	if gc == null or not _started:
		return
	var c := counts()
	for bet: Dictionary in gc.bets:
		if bet["state"] != "open":
			continue
		var r: int = BetBook.judge(bet, c, stats, final)
		if r == 0:
			continue
		bet["state"] = "won" if r > 0 else "lost"
		bet["settled_day"] = director.get_day()
		if r > 0:
			bet["payout"] = int(round(float(bet["stake"]) * float(bet["mult"])))
			gc.award_eco_points(bet["payout"])
			if not final:
				var txt: String = "Bet won: %s pays %d EP!" % [bet["label"], bet["payout"]]
				FXManager.show_dramatic_text(Vector3.ZERO, txt, Color(0.902, 0.765, 0.416))
				director.chronicle.emit(txt)
		bet_settled.emit(bet)

# Called when the run ends, before the results are shown. Safe to call twice.
func settle_final() -> void:
	if _final:
		return
	refresh()
	_judge_all(true)
	_final = true
	var gc := _gc()
	if gc != null:
		gc.save_meta()

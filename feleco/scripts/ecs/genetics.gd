class_name Genetics
extends RefCounted

# Simple genetics. Every creature carries a genome: three stats (health,
# speed, appetite, around 1.0) and a few named traits. A baby blends its two
# parents' stats with a little mutation. Good traits are passed on more often
# when both parents carry them; bad traits are passed on too, and new bad
# mutations turn up at random, so a lineage never only improves.

# name -> [stat, change, good?, hint]
const TRAITS: Dictionary = {
	"Hardy": ["health", 0.2, true, "shrugs off wounds and cold"],
	"Sure-footed": ["speed", 0.15, true, "quick to flee and to find food"],
	"Frugal": ["appetite", -0.15, true, "gets by on very little"],
	"Sickly": ["health", -0.2, false, "the first to fall in a hard winter"],
	"Slow": ["speed", -0.15, false, "an easy catch for any hunter"],
	"Glutton": ["appetite", 0.2, false, "always hungry; starves first in a lean season"],
}
const STATS: Array[String] = ["health", "speed", "appetite"]
# Chance a trait is inherited: [one parent has it, both do].
const PASS_GOOD: Array[float] = [0.35, 0.75]
const PASS_BAD: Array[float] = [0.3, 0.55]
const NEW_BAD: float = 0.08
const NEW_GOOD: float = 0.04
const MUTATION: float = 0.05

static func random_genome() -> Dictionary:
	var g := {"traits": []}
	for s: String in STATS:
		g[s] = randf_range(0.9, 1.1)
	if randf() < 0.2:
		g["traits"].append(TRAITS.keys().pick_random())
	return g

# A baby from two parents. b may be empty (no mate found): then a is used twice.
static func cross(a: Dictionary, b: Dictionary) -> Dictionary:
	if b.is_empty():
		b = a
	var g := {"traits": []}
	for s: String in STATS:
		var w: float = randf()
		g[s] = clampf(lerpf(float(a.get(s, 1.0)), float(b.get(s, 1.0)), w) + randfn(0.0, MUTATION), 0.6, 1.4)
	var ta: Array = a.get("traits", [])
	var tb: Array = b.get("traits", [])
	for t: String in TRAITS.keys():
		var n: int = (1 if ta.has(t) else 0) + (1 if tb.has(t) else 0)
		if n == 0:
			continue
		var good: bool = TRAITS[t][2]
		var p: float = (PASS_GOOD if good else PASS_BAD)[n - 1]
		if randf() < p:
			g["traits"].append(t)
	if randf() < NEW_BAD:
		_add_random(g, false)
	if randf() < NEW_GOOD:
		_add_random(g, true)
	return g

static func _add_random(g: Dictionary, good: bool) -> void:
	var pool: Array = []
	for t: String in TRAITS.keys():
		if TRAITS[t][2] == good and not g["traits"].has(t):
			pool.append(t)
	if not pool.is_empty():
		g["traits"].append(pool.pick_random())

# The stat multipliers the genome actually expresses (traits included).
static func expressed(g: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for s: String in STATS:
		out[s] = float(g.get(s, 1.0))
	for t: String in g.get("traits", []):
		if TRAITS.has(t):
			out[TRAITS[t][0]] += float(TRAITS[t][1])
	for s: String in STATS:
		out[s] = clampf(out[s], 0.5, 1.6)
	return out

const SPEED_PROPS: Array[String] = ["walk_speed", "run_speed", "wander_speed", "hunt_speed", "flee_speed", "travel_speed", "patrol_speed", "fly_speed", "crawl_speed", "swim_speed", "charge_speed"]

# Writes the genome onto a creature's stats (once, at birth or arrival).
static func apply(agent: Node, g: Dictionary) -> void:
	agent.set("genes", g)
	var e := expressed(g)
	if agent.get("health") != null:
		agent.set("health", float(agent.get("health")) * float(e["health"]))
	for p: String in SPEED_PROPS:
		if agent.get(p) != null:
			agent.set(p, float(agent.get(p)) * float(e["speed"]))
	if agent.get("metabolism_rate") != null:
		agent.set("metabolism_rate", float(agent.get("metabolism_rate")) * float(e["appetite"]))

# A short line for the follow card: "Hardy, Glutton".
static func describe(g: Dictionary) -> String:
	var t: Array = g.get("traits", [])
	return "No notable traits" if t.is_empty() else ", ".join(PackedStringArray(t))

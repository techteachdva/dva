class_name Psyche
extends RefCounted

# One creature's inner life, built lazily and silent until something happens.
#   Tags    (Dwarf Fortress style) come from its traits; they set stats and
#           its personal Markov biases, and decide which dreams it can have.
#   Vault   up to 100 remembered events. A significant event passes a small
#           second chain, Notice -> Stored: 66% on a tag match, 33% on a dream
#           match, otherwise it is forgotten.
#   Dream   an aspiration, told in nebulous madlib phrases that still point
#           plainly at the goal. Fulfilling it levels the creature up.
#   bias    state -> added weight: this creature's own copy of the species
#           model. Tags seed it, memories nudge it for good, the dream sways it.

const VAULT_MAX: int = 100
const P_TAG: float = 0.66
const P_DREAM: float = 0.33
const P_DREAM_SLEEP: float = 0.75
const BIAS_LIMIT: float = 0.35
# How much of a goal a dream demands: seconds spent there, or times it happens.
# A creature must also have dreamed the dream in its sleep first.
const GOAL_NEEDS: Dictionary = {"swim": 45, "climb": 60, "run_plains": 30, "birth": 3}
const CAMERA_NEAR: float = 45.0

# tag -> {state bias, stat multipliers}.
const TAGS: Dictionary = {
	"brave": {"bias": {"Flee": -0.15, "Chase": 0.12}, "damage": 1.15},
	"timid": {"bias": {"Flee": 0.15}, "speed": 1.08},
	"hungry": {"bias": {"Forage": 0.1, "Graze": 0.1}},
	"kin": {"bias": {"Herd": 0.15}},
	"roamer": {"bias": {"Walk": 0.1, "Wander": 0.1}, "speed": 1.05},
	"water": {"bias": {"Forage": 0.05}},
	"high": {"bias": {"Wander": 0.05}, "health": 1.1},
	"mystic": {"bias": {"Sleep": 0.1, "Rest": 0.1}},
}
# event -> [tags it matches, flavor, memory bias {state: nudge}].
const EVENTS: Dictionary = {
	"kin_died": [["kin", "timid"], "watched one of its own fall on day %d", {"Flee": 0.02}],
	"survived": [["timid", "brave"], "outran death on day %d, and learned the way", {"Flee": 0.01}],
	"full": [["hungry"], "ate its fill on day %d, and the world felt kind", {"Forage": -0.01}],
	"birth": [["kin"], "brought new life into the valley on day %d", {"Herd": 0.02}],
	"eat_pineapple": [["hungry", "mystic"], "tasted the strange fruit on day %d", {}],
	"eat_starfruit": [["mystic", "hungry"], "swallowed a fallen star on day %d", {}],
	"kill_apex": [["brave"], "brought down a great hunter on day %d", {"Chase": 0.03}],
	"eclipse": [["mystic"], "stood beneath the black sun on day %d", {}],
	"swim": [["water"], "felt the river take its weight on day %d", {}],
	"climb": [["high"], "stood on the mountain's shoulder on day %d", {}],
	"run_plains": [["roamer", "timid"], "ran for its life across the plains on day %d", {}],
	"dream": [["mystic"], "dreamed: %s", {}],
}
# dream -> [tag, goal event, state sway, what it dreams of, a thing to do].
const DREAMS: Dictionary = {
	"slay": ["brave", "kill_apex", {"Chase": 0.2, "Flee": -0.15}, "a great fanged shadow", "fall before its teeth"],
	"children": ["kin", "birth", {"Herd": 0.2}, "small warm voices", "call it by a name"],
	"starfruit": ["mystic", "eat_starfruit", {"Forage": 0.1}, "a star with five ribs", "melt upon its tongue"],
	"pineapple": ["hungry", "eat_pineapple", {"Forage": 0.15}, "a crowned and golden fruit", "split open before it"],
	"eclipse": ["mystic", "eclipse", {"Sleep": -0.1}, "a sun gone black at noon", "look down upon it"],
	"river": ["water", "swim", {"Walk": 0.1}, "cold running water", "close over its back"],
	"mountain": ["high", "climb", {"Wander": 0.15, "Walk": 0.1}, "the white roof of the valley", "rise beneath its feet"],
	"run": ["roamer", "run_plains", {"Flee": 0.1}, "endless grass and a thing behind", "chase it until it flies"],
}
const OPENERS: Array[String] = ["In the dark it saw", "Again, behind its eyes:", "Something whispers of", "It twitches, dreaming of", "Half-asleep it longs for"]
const LINKS: Array[String] = ["that would", "which must one day", "and how it would", "that might yet"]

var tags: Array[String] = []
var vault: Array[String] = []
var bias: Dictionary = {}
var dream: String = ""
var dreams_done: int = 0
var safe_spot: Vector3 = Vector3.INF
var dreamed: bool = false
var progress: int = 0
var _agent: MarkovAgent

func _init(agent: MarkovAgent) -> void:
	_agent = agent
	var names: Array = TAGS.keys()
	# Stable per creature, and a few tags always.
	var rng := RandomNumberGenerator.new()
	rng.seed = agent.get_instance_id()
	for i: int in 2:
		var t: String = names[rng.randi() % names.size()]
		if not tags.has(t):
			tags.append(t)
	for t: String in tags:
		var row: Dictionary = TAGS[t]
		for state: String in row["bias"]:
			_nudge(state, float(row["bias"][state]))
		_apply_stats(row)
	_new_dream()

func _apply_stats(row: Dictionary) -> void:
	if row.has("damage") and _agent.get("damage") != null:
		_agent.set("damage", float(_agent.get("damage")) * float(row["damage"]))
	if row.has("health") and _agent.get("health") != null:
		_agent.set("health", float(_agent.get("health")) * float(row["health"]))
	if row.has("speed") and _agent._data != null:
		_agent._data.speed_boost *= float(row["speed"])

func _nudge(state: String, by: float) -> void:
	bias[state] = clampf(float(bias.get(state, 0.0)) + by, -BIAS_LIMIT, BIAS_LIMIT)

func _new_dream() -> void:
	var fits: Array = []
	for id: String in DREAMS:
		if tags.has(DREAMS[id][0]):
			fits.append(id)
	dream = str((fits if not fits.is_empty() else DREAMS.keys()).pick_random())

func sentence() -> String:
	var d: Array = DREAMS[dream]
	return "%s %s %s %s." % [OPENERS.pick_random(), d[3], LINKS.pick_random(), d[4]]

# Sways one decision: personal bias, then the dream's pull.
func sway(mods: Dictionary) -> void:
	var pull: Dictionary = DREAMS[dream][2]
	for state: String in mods:
		var add: float = float(bias.get(state, 0.0)) + float(pull.get(state, 0.0))
		mods[state] = clampf(float(mods[state]) + add, 0.0, 1.0)

func _day() -> int:
	return int(_agent.director.get_day()) + 1 if _agent.director != null else 1

# A significant event: the second chain decides if it is kept.
func note(event: String, extra: String = "") -> void:
	var row: Array = EVENTS[event]
	var p: float = 0.0
	for t: String in row[0]:
		if tags.has(t):
			p = P_TAG
	if p == 0.0 and (str(DREAMS[dream][1]) == event or event == "dream"):
		p = P_DREAM
	if randf() < p:
		var line: String = str(row[1]) % (extra if event == "dream" else _day())
		if vault.has(line):
			_advance(event)
			return
		vault.append(line)
		if vault.size() > VAULT_MAX:
			vault.pop_front()
		for state: String in row[2]:
			_nudge(state, float(row[2][state]))
		if event == "survived":
			# It remembers where it got away, and gets better at getting away.
			safe_spot = _agent.global_position
			if _agent._data != null:
				_agent._data.speed_boost = minf(_agent._data.speed_boost * 1.02, 1.3)
	_advance(event)

# A step toward the dream, which only counts once it has been dreamed.
func _advance(event: String) -> void:
	if str(DREAMS[dream][1]) != event or not dreamed:
		return
	progress += 1
	if progress >= int(GOAL_NEEDS.get(event, 1)):
		_fulfil()

func on_sleep() -> void:
	var hp: Variant = _agent.get("health")
	var well: bool = _agent.get("energy") != null and float(_agent.get("energy")) > 70.0 and hp != null and float(hp) > 40.0
	if well or randf() < P_DREAM_SLEEP:
		dreamed = true
		note("dream", sentence())

# A dream come true: an instant level up, and a longer life.
func _fulfil() -> void:
	dreams_done += 1
	vault.append("lived its dream on day %d" % _day())
	if vault.size() > VAULT_MAX:
		vault.pop_front()
	_agent._lifespan *= 1.5
	_apply_stats({"damage": 1.2, "health": 1.25, "speed": 1.05})
	var cam: Camera3D = _agent.get_viewport().get_camera_3d() if _agent.is_inside_tree() else null
	if cam != null and cam.global_position.distance_to(_agent.global_position) < CAMERA_NEAR:
		FXManager.show_dramatic_text(_agent.global_position + Vector3.UP * 3.0, "%s's dream came true!" % _agent.display_name, Color(0.8, 0.7, 1.0))
	Sfx.play_at("chime", _agent.global_position, -2.0)
	dreamed = false
	progress = 0
	_new_dream()

# Every second or so: has it reached the place it longs for?
func check_place() -> void:
	var p: Vector3 = _agent.global_position
	var sim: SimulationDirector = _agent.director
	if sim == null:
		return
	var biome: String = str(Biomes.at(p.x, p.z))
	var goal: String = str(DREAMS[dream][1])
	if goal == "climb" and biome == str(Biomes.MOUNTAIN):
		note("climb")
	elif goal == "swim" and (sim.valley != null and sim.valley.river != null and float(sim.valley.river.sample(p.x, p.z).distance) < 1.0):
		note("swim")
	elif goal == "run_plains" and biome == str(Biomes.PLAINS) and _agent.current_state() == "Flee":
		note("run_plains")

func report() -> String:
	var lines: Array[String] = ["[b]Tags:[/b] " + ", ".join(tags), "[b]Dream:[/b] " + sentence()]
	var bits: Array[String] = []
	for state: String in bias:
		if absf(float(bias[state])) > 0.005:
			bits.append("%s %+d%%" % [state, int(float(bias[state]) * 100.0)])
	lines.append("[b]Its own model:[/b] " + (", ".join(bits) if not bits.is_empty() else "the species default"))
	lines.append("[b]Dreams lived:[/b] %d" % dreams_done)
	lines.append("[b]The Vault (%d of %d):[/b]" % [vault.size(), VAULT_MAX])
	for i: int in range(vault.size() - 1, -1, -1):
		lines.append("- " + vault[i])
	return "\n".join(lines)

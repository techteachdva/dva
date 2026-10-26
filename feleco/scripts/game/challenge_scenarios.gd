class_name ChallengeScenarios
extends RefCounted

# Challenge mode, 3.0: a series of "what if" years. Each one bends a single
# link of the food web and asks you to bet on what follows. They are meant
# to be illustrative more than fair: the swings are the point.
#
# setup:  disabled (species ids or "group:<g>"), producer_mult, golden_mult,
#         drought_chance, counts {GameConfig field or "extra:<id>": n}
# events: [{at: share of the year (0..1), do: kill_group|drought|bloom, arg}]
# bet:    the scenario's own bet: {label, p, sprite, kind, target, line}

const LIST: Array = [
	{
		"id": "thin_soil", "title": "Thin Soil",
		"lesson": "Every animal runs on what plants make from sun and soil. Start the year with a starved meadow and few trees.",
		"moral": "With little to graze, the herbivores go hungry first, and everything that eats them follows. Energy enters the web only through the producers.",
		"setup": {"producer_mult": 0.35},
		"events": [],
		"bet": {"label": "Herbivores lose a species", "p": 0.45, "sprite": "deer", "kind": "group_extinct", "target": "herbivore"},
	},
	{
		"id": "grazers_vanish", "title": "The Grazers Vanish",
		"lesson": "A sickness sweeps through on the second day of spring and takes every herbivore in the valley.",
		"moral": "Hunters with no grazers turn on whatever is left, then starve. Meanwhile the meadow, with nothing eating it, runs wild.",
		"setup": {"disabled": ["group:herbivore_migrants"]},
		"events": [{"at": 0.08, "do": "kill_group", "arg": "herbivore"}],
		"bet": {"label": "Carnivores lose a species", "p": 0.5, "sprite": "lion", "kind": "group_extinct", "target": "carnivore"},
	},
	{
		"id": "no_hunters", "title": "No Hunters",
		"lesson": "No wolves, mountain lions or falcons this year. The grazers have the valley to themselves.",
		"moral": "Without predators, herbivores boom until they eat the meadow bare, and then they crash. Hunters keep the herd, and the grass, in check.",
		"setup": {"disabled": ["group:carnivore"]},
		"events": [],
		"bet": {"label": "Herbivores double", "p": 0.45, "sprite": "sheep", "kind": "group_boom", "target": "herbivore"},
	},
	{
		"id": "empty_village", "title": "Empty Village",
		"lesson": "The people have left the valley. No hunting, no felling, no farms.",
		"moral": "Without people the woods grow back and the wild hunters return. Humans are one of the strongest links in any food web.",
		"setup": {"disabled": ["human"]},
		"events": [],
		"bet": {"label": "Producers end on top", "p": 0.35, "sprite": "", "kind": "group_top", "target": "producer"},
	},
	{
		"id": "dry_summer", "title": "Dry Summer",
		"lesson": "This summer the rain will not come. A long drought is certain.",
		"moral": "Drought hits the bottom of the web first: grass and moss shrivel, the river runs low and fish suffer, and the hunger climbs up the chain.",
		"setup": {"drought_chance": 0.0},
		"events": [{"at": 0.3, "do": "drought", "arg": ""}],
		"bet": {"label": "Fish drop below 5", "p": 0.4, "sprite": "fish", "kind": "species_below", "target": "fish", "line": 5},
	},
	{
		"id": "decomposer_strike", "title": "Decomposer Strike",
		"lesson": "No worms, beetles or mushrooms. Nothing will break the dead down.",
		"moral": "Carcasses pile up and their energy never returns to the soil. The meadow slowly starves: decomposers close the loop.",
		"setup": {"disabled": ["group:decomposer"]},
		"events": [],
		"bet": {"label": "Producers end last", "p": 0.35, "sprite": "", "kind": "group_last", "target": "producer"},
	},
	{
		"id": "golden_year", "title": "Golden Year",
		"lesson": "Golden grass, berries, apples and star moss are ten times as common. Follow the gold as it is eaten.",
		"moral": "Gold shows the path energy takes: from plant to grazer, grazer to hunter, and from every carcass back into the soil.",
		"setup": {"golden_mult": 10.0},
		"events": [],
		"bet": {"label": "25 golden finds", "p": 0.4, "sprite": "", "kind": "golden_line", "target": "", "line": 25},
	},
]

static func find(id: String) -> Dictionary:
	for s: Dictionary in LIST:
		if s["id"] == id:
			return s
	return {}

static func index_of(id: String) -> int:
	for i: int in LIST.size():
		if LIST[i]["id"] == id:
			return i
	return -1

# The scenario's featured bet, ready for BetBook.catalogue3.
static func featured_bet(id: String) -> Dictionary:
	var s := find(id)
	if s.is_empty():
		return {}
	var b: Dictionary = (s["bet"] as Dictionary).duplicate()
	b["id"] = id
	return b

# Writes a scenario into GameConfig on top of the default valley.
static func apply(gc: Node, id: String) -> void:
	var s := find(id)
	gc.scenario_id = id
	gc.disabled_species.clear()
	gc.golden_mult = 1.0
	gc.grass_density = 0.5
	gc.tree_count = 6
	gc.bush_count = 5
	gc.sheep_count = 10
	gc.rabbit_count = 8
	gc.wolf_count = 3
	gc.human_count = 5
	gc.falcon_count = 3
	gc.robin_count = 8
	gc.boar_count = 5
	gc.worm_count = 15
	gc.spore_count = 5
	gc.fish_count = 8
	gc.extra_counts.clear()
	if s.is_empty():
		return
	var setup: Dictionary = s["setup"]
	var pm: float = float(setup.get("producer_mult", 1.0))
	gc.grass_density = 0.5 * pm
	gc.tree_count = maxi(1, int(round(6 * pm)))
	gc.bush_count = maxi(1, int(round(5 * pm)))
	gc.golden_mult = float(setup.get("golden_mult", 1.0))
	for d: String in setup.get("disabled", []):
		if d.begins_with("group:"):
			var g := d.substr(6)
			if g.ends_with("_migrants"):
				continue
			for sp: String in SpeciesDB.members(g):
				gc.disabled_species.append(sp)
		else:
			gc.disabled_species.append(d)

# Timed events, as {day, do, arg}, for a run of `days`.
static func events_for(id: String, days: float) -> Array:
	var out: Array = []
	for e: Dictionary in find(id).get("events", []):
		out.append({"day": float(e["at"]) * days, "do": e["do"], "arg": e["arg"]})
	return out

# Species kept from wandering back in for this scenario.
static func blocks_migration(id: String, species: String) -> bool:
	for d: String in find(id).get("setup", {}).get("disabled", []):
		if d == "group:%s_migrants" % SpeciesDB.group_of(species):
			return true
	return false

static func judge(bet: Dictionary, stats: Dictionary, final: bool) -> int:
	var m: Dictionary = bet["meta"]
	var t: String = str(m.get("target", ""))
	var score: Dictionary = stats.get("group_score", {})
	match str(m.get("kind", "")):
		"group_extinct":
			if stats.get("group_extinct", {}).has(t):
				return 1
		"group_boom":
			if float(stats.get("group_peak", {}).get(t, 0.0)) >= 2.0 * maxf(0.05, float(stats.get("group_start", {}).get(t, 0.1))):
				return 1
		"group_top":
			if final:
				return 1 if BetBook.top_group(score) == t else -1
		"group_last":
			if final:
				var r: Array = BetBook.ranked_groups(score)
				return 1 if r[r.size() - 1] == t else -1
		"species_below":
			if int(stats.get("low", {}).get(SpeciesDB.plural(t), 999)) < int(m.get("line", 1)):
				return 1
		"golden_line":
			if int(stats.get("golden_finds", 0)) >= int(m.get("line", 1)):
				return 1
	return -1 if final else 0

# A few lines on how the year went, from the tracker's numbers.
static func recap(stats: Dictionary) -> String:
	var lines: PackedStringArray = []
	var start: Dictionary = stats.get("group_start", {})
	var peak: Dictionary = stats.get("group_peak", {})
	var now: Dictionary = stats.get("group_score", {})
	for g: String in SpeciesDB.GROUPS:
		var s0: float = float(start.get(g, 0.0))
		var p: float = float(peak.get(g, 0.0))
		var e: float = float(now.get(g, 0.0))
		var verb: String = "held steady"
		if p > s0 * 1.8 and e < p * 0.5:
			verb = "boomed, then crashed"
		elif e > s0 * 1.5:
			verb = "grew"
		elif e < s0 * 0.5:
			verb = "collapsed" if e < 0.05 else "shrank"
		lines.append("%s %s." % [SpeciesDB.GROUP_LABEL[g], verb])
	if stats.get("gold_soil", false):
		lines.append("Gold made it all the way back into the soil.")
	return "\n".join(lines)

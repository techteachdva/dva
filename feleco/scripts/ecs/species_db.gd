class_name SpeciesDB
extends RefCounted

# One row per creature: names, food-web group and the tuning that used to be
# copied into a dozen tables. New species (3.0 on) live only here; the older
# nine still have their own hand-written paths in the director.

const GROUPS: Array[String] = ["producer", "herbivore", "omnivore", "carnivore", "decomposer"]
const GROUP_LABEL: Dictionary = {
	"producer": "Producers",
	"herbivore": "Herbivores",
	"omnivore": "Omnivores",
	"carnivore": "Carnivores",
	"decomposer": "Decomposers",
	"river": "River",
}
const GROUP_COLOR: Dictionary = {
	"producer": Color(0.45, 0.78, 0.32),
	"herbivore": Color(0.95, 0.85, 0.55),
	"omnivore": Color(0.85, 0.55, 0.3),
	"carnivore": Color(0.85, 0.25, 0.25),
	"decomposer": Color(0.65, 0.5, 0.75),
	"river": Color(0.4, 0.7, 0.9),
}

# id (singular, the node group) -> row. "plural" is the census / bet key.
# cap: carrying capacity; hold: hold divisor; migrants: founders through a pass;
# days: lifespan; season: [metabolism, breeding] per season; dn: day/night row.
const ROWS: Dictionary = {
	"fairy": {"plural": "fairies", "label": "Flower Fairies", "group": "omnivore", "color": Color(0.98, 0.55, 0.8), "new": true, "cap": 30, "days": 0.75},
	"sunfolk": {"plural": "sunfolk", "label": "Sunflowerfolk", "group": "omnivore", "color": Color(0.98, 0.8, 0.2), "new": true, "cap": 30, "days": 0.75},
	"scarecrow": {"plural": "scarecrows", "label": "Jack-o'-Scarecrows", "group": "omnivore", "color": Color(0.95, 0.5, 0.12), "new": true, "cap": 30, "days": 0.75},
	"snowman": {"plural": "snowpeople", "label": "Snowpeople", "group": "omnivore", "color": Color(0.8, 0.92, 1.0), "new": true, "cap": 30, "days": 0.75},
	"sheep": {"plural": "sheep", "label": "Sheep", "group": "herbivore", "color": Color(0.95, 0.95, 0.9)},
	"rabbit": {"plural": "rabbits", "label": "Rabbits", "group": "herbivore", "color": Color(0.8, 0.65, 0.5)},
	"wolf": {"plural": "wolves", "label": "Wolves", "group": "carnivore", "color": Color(0.55, 0.55, 0.6)},
	"falcon": {"plural": "falcons", "label": "Falcons", "group": "carnivore", "color": Color(0.7, 0.5, 0.3)},
	"human": {"plural": "humans", "label": "Humans", "group": "omnivore", "color": Color(0.95, 0.75, 0.55)},
	"boar": {"plural": "boars", "label": "Boars", "group": "omnivore", "color": Color(0.5, 0.35, 0.25)},
	"robin": {"plural": "robins", "label": "Robins", "group": "omnivore", "color": Color(0.9, 0.35, 0.25)},
	"worm": {"plural": "worms", "label": "Worms", "group": "decomposer", "color": Color(0.85, 0.5, 0.55)},
	"mushroom": {"plural": "mushrooms", "label": "Mushrooms", "group": "decomposer", "color": Color(0.8, 0.3, 0.3)},
	"fish": {"plural": "fish", "label": "Fish", "group": "river", "color": Color(0.4, 0.7, 0.9)},
	"bear": {
		"plural": "bears", "label": "Bears", "group": "omnivore", "color": Color(0.42, 0.28, 0.18),
		"new": true, "cap": 12, "hold": 3.0, "migrants": 2, "days": 4.5, "start": 3,
		"season": [[1.0, 1.2], [1.0, 1.0], [0.85, 1.1], [0.4, 0.2]],  # sleeps through winter
		"dn": {"twilight": [1.1, 1.0, 1.0]},
		"size": Vector2(3.6, 3.6), "gait": 9.0, "kind": 0, "shadow": 2.6, "style": 3,
	},
	"lion": {
		"plural": "lions", "label": "Mountain Lions", "group": "carnivore", "color": Color(0.82, 0.62, 0.38),
		"new": true, "cap": 10, "hold": 2.5, "migrants": 2, "days": 4.0, "start": 3,
		"season": [[1.0, 1.1], [1.05, 1.0], [1.0, 1.0], [0.95, 0.6]],
		"dn": {"day": [0.85, 1.0, 1.0], "night": [1.2, 1.0, 1.0], "nocturnal": true},
		"size": Vector2(3.2, 3.2), "gait": 11.0, "kind": 0, "shadow": 2.0, "style": 2,
	},
	"deer": {
		"plural": "deer", "label": "Deer", "group": "herbivore", "color": Color(0.72, 0.5, 0.32),
		"new": true, "cap": 60, "hold": 9.0, "migrants": 3, "days": 3.5, "start": 6,
		"season": [[0.9, 1.5], [1.0, 1.1], [0.95, 0.8], [1.15, 0.3]],
		"dn": {"twilight": [1.1, 1.0, 1.3]},
		"size": Vector2(3.0, 3.0), "gait": 12.0, "kind": 0, "shadow": 1.8, "style": 1,
	},
	"goat": {
		"plural": "goats", "label": "Mountain Goats", "group": "herbivore", "color": Color(0.9, 0.88, 0.82),
		"new": true, "cap": 50, "hold": 8.0, "migrants": 3, "days": 3.5, "start": 5,
		"season": [[0.9, 1.3], [1.0, 1.0], [0.95, 1.0], [1.0, 0.5]],  # hardy in the cold
		"dn": {"night": [0.6, 0.7, 0.8]},
		"size": Vector2(2.6, 2.6), "gait": 11.0, "kind": 0, "shadow": 1.6, "style": 1,
	},
	"mouse": {
		"plural": "mice", "label": "Mice", "group": "omnivore", "color": Color(0.62, 0.56, 0.5),
		"new": true, "cap": 140, "hold": 26.0, "migrants": 5, "days": 1.5, "start": 12,
		"season": [[1.0, 1.5], [0.9, 1.4], [0.95, 1.2], [1.15, 0.4]],  # breed fast in the warm months
		"dn": {"day": [0.85, 1.0, 1.0], "night": [1.15, 1.0, 1.3], "nocturnal": true},
		"size": Vector2(1.0, 1.0), "gait": 18.0, "kind": 0, "shadow": 0.45, "style": 4,
	},
	"beetle": {
		"plural": "beetles", "label": "Beetles", "group": "decomposer", "color": Color(0.3, 0.45, 0.35),
		"new": true, "cap": 120, "hold": 24.0, "migrants": 5, "days": 1.75, "start": 10,
		"season": [[0.9, 1.3], [0.9, 1.4], [1.0, 1.0], [1.2, 0.3]],  # warm-season grubs
		"dn": {"day": [0.8, 1.0, 1.0], "night": [1.2, 1.0, 1.5], "nocturnal": true},
		"size": Vector2(0.9, 0.9), "gait": 16.0, "kind": 0, "shadow": 0.4, "style": 10,
	},
}

# Seasonal Sprites: never in setup or the census; they arrive mid-season.
const SEASONAL: Array[String] = ["fairy", "sunfolk", "scarecrow", "snowman"]

# The five 3.0 creatures, in setup order.
const NEW_SPECIES: Array[String] = ["deer", "goat", "bear", "lion", "beetle", "mouse"]
# Every creature the census reports, by plural key.
const CENSUS: Array[String] = ["sheep", "rabbits", "deer", "goats", "wolves", "lions", "falcons", "humans", "bears", "boars", "robins", "mice", "worms", "beetles", "mushrooms", "fish"]

static func row(id: String) -> Dictionary:
	return ROWS.get(id, {})

static func is_new(id: String) -> bool:
	return bool(row(id).get("new", false))

static func plural(id: String) -> String:
	return str(row(id).get("plural", id))

const ONE: Dictionary = {
	"sheep": "sheep", "rabbit": "rabbit", "wolf": "wolf", "falcon": "falcon", "human": "villager",
	"boar": "boar", "robin": "robin", "worm": "worm", "mushroom": "mushroom", "fish": "fish",
	"bear": "bear", "lion": "mountain lion", "deer": "deer", "goat": "mountain goat", "beetle": "beetle",
	"mouse": "mouse", "fairy": "flower fairy", "sunfolk": "sunflowerfolk", "scarecrow": "jack-o'-scarecrow", "snowman": "snowperson",
}

static func one(id: String) -> String:
	var named := EraBook.one_for(id)
	if named != "":
		return named
	return str(ONE.get(id, id))

static func label(id: String) -> String:
	var named := EraBook.label_for(id)
	if named != "":
		return named
	return str(row(id).get("label", id.capitalize()))

# Player-facing plural. plural() stays the census key and must not change with the era.
static func spoken(id: String) -> String:
	var named := EraBook.spoken_for(id)
	if named != "":
		return named
	return plural(id)

static func group_of(id: String) -> String:
	return str(row(id).get("group", ""))

# Singular id for a plural or singular name ("wolves" -> "wolf").
static func id_for(name: String) -> String:
	var n := name.to_lower()
	if ROWS.has(n):
		return n
	if n == "spore" or n == "spores":
		return "mushroom"
	for id: String in ROWS.keys():
		if ROWS[id]["plural"] == n:
			return id
	return n

static func members(group: String) -> Array[String]:
	var out: Array[String] = []
	for id: String in ROWS.keys():
		if ROWS[id]["group"] == group:
			out.append(id)
	return out

# Population per food-web group from a census (plural keys). Producers count
# grass cells, trees, bushes and moss so the five groups share one scale.
static func group_totals(census: Dictionary) -> Dictionary:
	var out: Dictionary = {}
	for g: String in GROUPS:
		out[g] = 0.0
	for key: String in census.keys():
		var g := group_of(id_for(key))
		if out.has(g):
			out[g] += float(census[key])
	out["producer"] = float(census.get("producers", 0.0))
	return out

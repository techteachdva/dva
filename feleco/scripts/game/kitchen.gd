class_name Kitchen
extends RefCounted

# Only humans cook. Everything else eats raw. Cooking is the thing that
# puts villagers above the bears: they can turn almost any body or plant
# into a meal. The cost is the wait, and a bear takes far longer than a mouse.
# They never cook kin, corpses, mycelium, or moss.

const FORBIDDEN: Array[String] = ["human", "corpse", "mycelium", "moss"]

# mass * quality sets both the wait and the meal. Life-seconds; a standard
# 2x day is 24 of them (about one real minute).
const MIN_COOK: float = 1.6
const COOK_K: float = 1.55

const COOK: Dictionary = {
	"greens": {"mass": 0.4, "quality": 0.65, "family": "greens", "label": "Cooked Greens", "tint": Color(0.32, 0.48, 0.18)},
	"riverweed": {"mass": 0.55, "quality": 0.9, "family": "kelp", "label": "Cooked Riverweed", "tint": Color(0.2, 0.42, 0.28)},
	"berry": {"mass": 0.45, "quality": 0.85, "family": "apple", "label": "Cooked Berry", "tint": Color(0.55, 0.16, 0.32)},
	"apple": {"mass": 0.95, "quality": 1.25, "family": "apple", "label": "Cooked Apple", "tint": Color(0.72, 0.28, 0.12)},
	"pineapple": {"mass": 2.2, "quality": 1.85, "family": "pineapple", "label": "Cooked Pineapple", "tint": Color(0.85, 0.62, 0.16)},
	"pinecone": {"mass": 0.75, "quality": 1.15, "family": "cone", "label": "Cooked Pinecone", "tint": Color(0.45, 0.28, 0.14)},
	"mushroom": {"mass": 0.7, "quality": 1.05, "family": "cap", "label": "Cooked Mushroom", "tint": Color(0.55, 0.32, 0.22)},
	"worm": {"mass": 0.35, "quality": 0.7, "family": "skewer", "label": "Cooked Worm", "tint": Color(0.7, 0.48, 0.42)},
	"beetle": {"mass": 0.3, "quality": 0.75, "family": "skewer", "label": "Cooked Beetle", "tint": Color(0.28, 0.36, 0.24)},
	"mouse": {"mass": 0.35, "quality": 0.8, "family": "skewer", "label": "Cooked Mouse", "tint": Color(0.62, 0.44, 0.3)},
	"rabbit": {"mass": 0.8, "quality": 1.05, "family": "skewer", "label": "Cooked Rabbit", "tint": Color(0.58, 0.38, 0.26)},
	"robin": {"mass": 0.55, "quality": 1.0, "family": "bird", "label": "Cooked Robin", "tint": Color(0.55, 0.28, 0.18)},
	"falcon": {"mass": 1.1, "quality": 1.2, "family": "bird", "label": "Cooked Falcon", "tint": Color(0.42, 0.28, 0.18)},
	"fish": {"mass": 1.05, "quality": 1.15, "family": "fish", "label": "Cooked Fish", "tint": Color(0.85, 0.55, 0.32)},
	"sheep": {"mass": 2.4, "quality": 1.2, "family": "roast", "label": "Cooked Sheep", "tint": Color(0.55, 0.32, 0.22)},
	"goat": {"mass": 2.1, "quality": 1.15, "family": "roast", "label": "Cooked Goat", "tint": Color(0.5, 0.34, 0.24)},
	"deer": {"mass": 3.2, "quality": 1.45, "family": "haunch", "label": "Cooked Deer", "tint": Color(0.48, 0.26, 0.16)},
	"boar": {"mass": 3.4, "quality": 1.4, "family": "roast", "label": "Cooked Boar", "tint": Color(0.4, 0.22, 0.14)},
	"wolf": {"mass": 2.6, "quality": 1.25, "family": "fillet", "label": "Cooked Wolf", "tint": Color(0.45, 0.3, 0.28)},
	"lion": {"mass": 3.0, "quality": 1.35, "family": "fillet", "label": "Cooked Mountain Lion", "tint": Color(0.62, 0.4, 0.22)},
	"bear": {"mass": 6.2, "quality": 1.85, "family": "roast", "label": "Cooked Bear", "tint": Color(0.32, 0.16, 0.1)},
}

static func can_cook(id: String) -> bool:
	return COOK.has(id) and not FORBIDDEN.has(id)

static func cook_time(id: String) -> float:
	var row: Dictionary = COOK.get(id, {})
	if row.is_empty():
		return MIN_COOK
	return maxf(MIN_COOK, COOK_K * float(row["mass"]) * float(row["quality"]))

static func nutrition(id: String) -> float:
	var row: Dictionary = COOK.get(id, {})
	if row.is_empty():
		return 12.0
	return clampf(12.0 + 9.0 * float(row["mass"]) * float(row["quality"]), 12.0, 58.0)

static func label(id: String) -> String:
	var row: Dictionary = COOK.get(id, {})
	return str(row.get("label", id.capitalize()))

# How many kinds each top feeder actually eats. Humans cook the whole table.
# Bears are the next omnivore. Wolves and lions stay carnivores.
static func breadth(species: String) -> int:
	if species == "human":
		return COOK.size()
	return 0

class_name EraBook
extends RefCounted

# A run's coat of paint. Species ids, hunt odds and the pose rig stay.
# valley: the living sheets in assets/sprites/
# pixel: those same frames, cut into big pixels (assets/sprites/pixel/)
# lost: prehistoric silhouettes, painted on the same rig (assets/sprites/lost/)

const IDS: Array[String] = ["valley", "pixel", "lost"]
const TITLES: Dictionary = {
	"valley": "Valley",
	"pixel": "Pixel",
	"lost": "Lost Valley",
}

const _LABEL: Dictionary = {
	"valley": {
		"sheep": "Sheep", "rabbit": "Rabbits", "deer": "Deer", "goat": "Mountain Goats",
		"wolf": "Wolves", "lion": "Mountain Lions", "falcon": "Falcons", "human": "Humans",
		"bear": "Bears", "boar": "Boars", "robin": "Robins", "mouse": "Mice",
		"worm": "Worms", "beetle": "Beetles", "mushroom": "Mushrooms", "fish": "Fish",
	},
	"lost": {
		"sheep": "Bison", "rabbit": "Dryosaurs", "deer": "Woolly Mammoths", "goat": "Giant Elk",
		"wolf": "Dire Wolves", "lion": "Saber-tooths", "falcon": "Pterodactyls", "human": "Cavemen",
		"bear": "Cave Bears", "boar": "Entelodonts", "robin": "Microraptors", "mouse": "Alphadons",
		"worm": "Velvet Worms", "beetle": "Cockroaches", "mushroom": "Shelf Fungi", "fish": "Megapiranhas",
	},
}
const _ONE: Dictionary = {
	"valley": {
		"sheep": "sheep", "rabbit": "rabbit", "deer": "deer", "goat": "mountain goat",
		"wolf": "wolf", "lion": "mountain lion", "falcon": "falcon", "human": "villager",
		"bear": "bear", "boar": "boar", "robin": "robin", "mouse": "mouse",
		"worm": "worm", "beetle": "beetle", "mushroom": "mushroom", "fish": "fish",
	},
	"lost": {
		"sheep": "bison", "rabbit": "dryosaur", "deer": "mammoth", "goat": "giant elk",
		"wolf": "dire wolf", "lion": "saber-tooth", "falcon": "pterodactyl", "human": "caveman",
		"bear": "cave bear", "boar": "entelodont", "robin": "microraptor", "mouse": "alphadon",
		"worm": "velvet worm", "beetle": "cockroach", "mushroom": "shelf fungus", "fish": "megapiranha",
	},
}
const _SPOKEN: Dictionary = {
	"valley": {
		"sheep": "sheep", "rabbit": "rabbits", "deer": "deer", "goat": "mountain goats",
		"wolf": "wolves", "lion": "mountain lions", "falcon": "falcons", "human": "humans",
		"bear": "bears", "boar": "boars", "robin": "robins", "mouse": "mice",
		"worm": "worms", "beetle": "beetles", "mushroom": "mushrooms", "fish": "fish",
	},
	"lost": {
		"sheep": "bison", "rabbit": "dryosaurs", "deer": "mammoths", "goat": "giant elk",
		"wolf": "dire wolves", "lion": "saber-tooths", "falcon": "pterodactyls", "human": "cavemen",
		"bear": "cave bears", "boar": "entelodonts", "robin": "microraptors", "mouse": "alphadons",
		"worm": "velvet worms", "beetle": "cockroaches", "mushroom": "shelf fungi", "fish": "megapiranhas",
	},
}

# Draw size only. Stats stay, except the mammoth herd (the deer id) below.
const _DRAW: Dictionary = {
	"deer": Vector2(4.2, 4.2),
	"falcon": Vector2(3.4, 2.8),
	"fish": Vector2(1.4, 1.0),
	"sheep": Vector2(3.1, 2.7),
	"boar": Vector2(3.2, 3.0),
}

static func id() -> String:
	var gc: Node = _config()
	if gc == null:
		return "valley"
	# The opening film is the wizard and the mountain lion.
	if str(gc.get("current_mode")) == "intro":
		return "valley"
	var era := str(gc.get("sprite_era"))
	return era if IDS.has(era) else "valley"

static func title() -> String:
	return str(TITLES.get(id(), "Valley"))

static func label_for(species: String) -> String:
	return str(_table(_LABEL).get(species, ""))

static func one_for(species: String) -> String:
	return str(_table(_ONE).get(species, ""))

static func spoken_for(species: String) -> String:
	return str(_table(_SPOKEN).get(species, ""))

static func draw_size(species: String, valley: Vector2) -> Vector2:
	if id() != "lost":
		return valley
	return _DRAW.get(species, valley)

# Lost Valley cannot fill up with sixty mammoths.
static func capacity(species: String, valley: int) -> int:
	if id() == "lost" and species == "deer":
		return 12
	return valley

static func herd_max(species: String) -> int:
	if id() == "lost" and species == "deer":
		return 12
	return 40

static func feast_tip() -> String:
	if id() == "lost":
		return "Feast (omnivores): every cave bear, entelodont, microraptor and caveman eats its fill."
	return "Feast (omnivores): every bear, boar, robin and villager eats its fill."

static func rot_tip() -> String:
	if id() == "lost":
		return "Rot Rain (decomposers): the soil teems; shelf fungi, velvet worms and cockroaches surface."
	return "Rot Rain (decomposers): the soil teems; mushrooms, worms and beetles surface."

static func _table(book: Dictionary) -> Dictionary:
	var era := "lost" if id() == "lost" else "valley"
	return book[era]

static func _config() -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return null
	return tree.root.get_node_or_null("GameConfig")

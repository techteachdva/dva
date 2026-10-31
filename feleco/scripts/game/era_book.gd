class_name EraBook
extends RefCounted

# A run's coat of paint. Species ids, hunt odds and the pose rig stay.
# valley: the living sheets in assets/sprites/
# pixel: those same frames, redrawn as 32x32 pixel art (assets/sprites/pixel/)
# lost: prehistoric creatures on the same rig (assets/sprites/lost/), with
# their own food web and rules (see "Lost Valley rules" below)

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

# Draw size only. Stats live with the Lost Valley rules below.
const _DRAW: Dictionary = {
	"deer": Vector2(4.2, 4.2),
	"falcon": Vector2(3.4, 2.8),
	"fish": Vector2(1.4, 1.0),
	"sheep": Vector2(3.1, 2.7),
	"boar": Vector2(3.2, 3.0),
	"goat": Vector2(3.6, 3.6),
	"rabbit": Vector2(1.9, 1.9),
}

static func id() -> String:
	var gc: Node = _config()
	if gc == null:
		return "valley"
	# The opening film is the wizard and the mountain lion.
	if str(gc.get("current_mode")) == "intro":
		return "valley"
	var era := str(gc.get("sprite_era"))
	if not IDS.has(era):
		return "valley"
	# The web build leaves Pixel and Lost Valley out of the first download.
	# Until that pack is mounted, keep the valley sheets and names.
	if era != "valley" and not _sheets_ready(era):
		return "valley"
	return era

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
	if species == "falcon":
		return mini(valley, 24)
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

# ------------------------------------------------------------------
# Lost Valley rules. An Ice Age valley ruled by giants:
#   Mammoths are too big for wolves; only saber-tooths and cavemen dare them.
#   Saber-tooths are big-game specialists and ignore small fry.
#   Cave bears live on plants and carrion and sleep through winter.
#   Pterodactyls leave dryosaurs alone and take smaller prey.
#   Winter is an Ice Age: woolly giants thrive, small warm things suffer.
# ------------------------------------------------------------------
const _LOST_CRITTER: Dictionary = {
	"lion": {"prey": ["deer", "goat", "sheep", "boar"], "health": 120.0, "damage": 42.0, "run_speed": 6.2},
	"bear": {"prey": [], "hunts_humans": false, "health": 170.0},
	"deer": {"health": 260.0, "damage": 34.0, "walk_speed": 2.1, "run_speed": 4.2},
	"goat": {"health": 95.0, "damage": 18.0, "run_speed": 7.0},
}
const _LOST_COLD: Dictionary = {"deer": 0.65, "sheep": 0.75, "goat": 0.75, "wolf": 0.9, "human": 1.15,
	"rabbit": 1.45, "mouse": 1.35, "robin": 1.4, "falcon": 1.25, "boar": 1.2}
const _LOST_BREED_COLD: Dictionary = {"rabbit": 0.3, "robin": 0.4, "mouse": 0.5}
const _FALCON_PREY: Array[String] = ["mouse", "robin", "beetle", "worm"]

# Food -> eater links the Field Guide drops or adds in Lost Valley.
const _WEB_CUT: Array = [["deer", "wolf"], ["rabbit", "falcon"], ["rabbit", "lion"], ["robin", "lion"], ["fish", "lion"],
	["mouse", "lion"], ["rabbit", "bear"], ["mouse", "bear"], ["fish", "bear"], ["human", "bear"]]
const _WEB_ADD: Array = [["boar", "lion", "hunt"]]

const _GUIDE: Dictionary = {
	"human": "Cavemen hunt in bands, cook at the hearth and fear the long winter: the cold burns through them.",
	"wolf": "Dire wolves run in night packs. Bison, elk, entelodonts and dryosaurs are fair game, but a mammoth is too much.",
	"falcon": "Pterodactyls glide the day sky, snatching megapiranhas from the river, plus microraptors and small fry. Dryosaurs are too big.",
	"robin": "Microraptors glide on four feathered wings, snapping up velvet worms and fruit. The Ice Age winter hits them hard.",
	"fish": "Megapiranhas shoal in the river with crushing underbites. Worms, cockroaches and weed feed them.",
	"rabbit": "Dryosaurs are quick two-legged grazers. They breed fast in warm months and barely at all in the Ice Age winter.",
	"sheep": "Steppe bison graze in herds, shaggy capes shrugging off the cold. Saber-tooths and dire wolves follow them.",
	"boar": "Entelodonts root, crush and brawl. Their jaws fear little, but saber-tooths will take them.",
	"worm": "Velvet worms creep on stubby legs through the leaf litter, turning rot into soil.",
	"mushroom": "Shelf fungi climb the dead stumps, fruiting at night and after rain.",
	"deer": "Woolly mammoths are the giants of the valley and thrive in winter. Dire wolves cannot bring one down; only saber-tooths and cavemen try.",
	"goat": "Giant elk carry the widest antlers that ever lived. Tough and quick, they hold out well through the cold.",
	"bear": "Cave bears live on plants and carrion, sleep through winter, and leave cavemen alone.",
	"lion": "Saber-tooths are big-game killers: mammoths, bison, elk and entelodonts. They ignore small fry, so they need the giants to survive.",
	"mouse": "Alphadons are tiny early marsupials that hunt insects by night and shiver through the Ice Age.",
	"beetle": "Cockroaches were here before everything else. They clean up the valley's rot.",
}

static func lost() -> bool:
	return id() == "lost"

# Called at the end of a CritterAgent's _configure.
static func adapt(agent: Node, species: String) -> void:
	if not lost():
		return
	var row: Dictionary = _LOST_CRITTER.get(species, {})
	for key: String in row:
		var value: Variant = row[key]
		if value is Array:
			var list: Array[String] = []
			for item: Variant in value:
				list.append(str(item))
			agent.set(key, list)
		else:
			agent.set(key, value)

static func winter_metabolism(species: String) -> float:
	return float(_LOST_COLD.get(species, 1.0)) if lost() else 1.0

static func winter_breeding(species: String) -> float:
	return float(_LOST_BREED_COLD.get(species, 1.0)) if lost() else 1.0

static func falcon_prey(valley: Array[String]) -> Array[String]:
	return _FALCON_PREY if lost() else valley

static func guide_text(species: String, valley: String) -> String:
	return str(_GUIDE.get(species, valley)) if lost() else valley

static func web_edges(valley: Array) -> Array:
	if not lost():
		return valley
	var out: Array = []
	for edge: Array in valley:
		if not _WEB_CUT.has([edge[0], edge[1]]):
			out.append(edge)
	out.append_array(_WEB_ADD)
	return out

static func _table(book: Dictionary) -> Dictionary:
	var era := "lost" if id() == "lost" else "valley"
	return book[era]

static func _sheets_ready(era: String) -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return true
	var packs := tree.root.get_node_or_null("EraPacks")
	if packs == null:
		return true
	return bool(packs.call("ready", era))

static func _config() -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null:
		return null
	return tree.root.get_node_or_null("GameConfig")

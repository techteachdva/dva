class_name NameGenerator
extends RefCounted

static var _wolf_names: Array[String] = [
	"Fenrir", "Skoll", "Hati", "Romulus", "Remus", "Lupa", "Freki", "Geri",
	"Ghost", "Nymeria", "Summer", "Shaggydog", "Grey Wind", "Lady", "Dire",
	"Howler", "Moonfang", "Shadow", "Storm", "Raven", "Ash", "Ember", "Frost",
	"Thorn", "Rune", "Sable", "Onyx", "Flint", "Cinder", "Bramble", "Wraith",
	"Dusk", "Sirius", "Canis", "Lycan", "Varg", "Ulfr", "Tala", "Kiba",
	"Akela", "Raksha", "Bhageera", "Mowgli", "Whitefang", "Balto", "Okami"
]

static var _sheep_names: Array[String] = [
	"Wooliam", "Baa-bara", "Fleecia", "Ewe-genie", "Ram-bo", "Lambert",
	"Dolly", "Shaun", "Timmy", "Cotton", "Fluffy", "Marshmallow", "Cloud",
	"Nimbus", "Cirrus", "Stratus", "Cumulus", "Misty", "Foggy", "Dewey",
	"Sunny", "Bleater", "Merino", "Suffolk", "Dorset", "Hampshire", "Cheviot",
	"Lincoln", "Ryeland", "Jacob", "Hebridean", "Soay", "Manx", "Shetland",
	"Welsh", "Scottish", "Border", "Penny", "Shilling", "Pound", "Tuppence"
]

static var _human_names: Array[String] = [
	"Aldric", "Beorn", "Cedric", "Duncan", "Eadric", "Faramond", "Godric",
	"Harold", "Ivor", "Jocelyn", "Kendrick", "Leofric", "Mordred", "Norman",
	"Oswald", "Percival", "Quentin", "Roderick", "Sigurd", "Tristan", "Ulric",
	"Vladimir", "Wulfric", "Xavier", "Yorick", "Zacharias", "Astrid", "Brunhild",
	"Cassandra", "Diana", "Elowen", "Freya", "Guinevere", "Hilda", "Isolde",
	"Jocasta", "Kriemhild", "Lorelei", "Morgana", "Nimue", "Ophelia", "Rowena"
]

static var _boar_names: Array[String] = [
	"Gore", "Tusk", "Snout", "Bristle", "Razorback", "Gristle", "Ham",
	"Bacon", "Chops", "Brisket", "Ribs", "Sausage", "Pepper", "Clove",
	"Rooter", "Wallow", "Mudder", "Slop", "Oink", "Grunt", "Squeal",
	"Snuffle", "Truffle", "Cranberry", "Apple", "Chestnut", "Acorn", "Hazel",
	"Mycroft", "Fungus", "Morel", "Porcini", "Chanterelle", "Bolete", "Chaga",
	"Ganoderma", "Russula", "Amanita", "Agaricus", "Lactarius", "Morchella"
]

static var _falcon_names: Array[String] = [
	"Horus", "Ra", "Anubis", "Thoth", "Osiris", "Set", "Horizon", "Zenith",
	"Nadir", "Apex", "Pinnacle", "Summit", "Crest", "Peak", "Crown", "Vertex",
	"Kestrel", "Merlin", "Peregrine", "Saker", "Lanner", "Gyr", "Barbary",
	"Saker", "Tiercel", "Eyas", "Passager", "Haggard", "Souse", "Rouse",
	"Stoop", "Windhover", "Plunge", "Dive", "Swoop", "Soar", "Glide", "Drift"
]

static var _robin_names: Array[String] = [
	"Redbreast", "Dickon", "Cock", "Robin", "Hood", "Marian", "Friar", "Tuck",
	"Scarlet", "Crimson", "Ruby", "Garnet", "Carmine", "Vermilion", "Rusty",
	"Cheerio", "Chirp", "Tweet", "Trill", "Warble", "Chirrup", "Peep", "Pip",
	"Sparrow", "Wren", "Tit", "Finch", "Lark", "Thrush", "Blackbird", "Starling",
	"Dunnock", "Nuthatch", "Treecreeper", "Goldcrest", "Firecrest", "Chiffchaff"
]

static var _fish_names: Array[String] = [
	"Silver", "Brook", "Minnow", "Pike", "Glen", "Reed", "Nim", "Pearl",
	"Current", "Shimmer", "Otter", "Pebble", "Rapid", "Willow", "Dace", "Chub"
]

static var _worm_names: Array[String] = [
	"Squirm", "Wriggle", "Wiggle", "Jiggle", "Slither", "Crawl", "Burrow",
	"Tunnel", "Mine", "Bore", "Drill", "Digger", "Mole", "Earth", "Soil",
	"Dirt", "Loam", "Clay", "Silt", "Sand", "Gravel", "Peat", "Humus",
	"Compost", "Mulch", "Vermi", "Lumbricus", "Eisenia", "Aporrectodea",
	"Octolasion", "Dendrobaena", "Allolobophora", "Eiseniella", "Bimastos"
]

static var _mushroom_names: Array[String] = [
	"Spore", "Mycel", "Fungus", "Toadstool", "Puffball", "Truffle", "Morel",
	"Chanterelle", "Shiitake", "Oyster", "Enoki", "Porcini", "Portobello",
	"Cremini", "Button", "Champignon", "Agaricus", "Boletus", "Russula",
	"Amanita", "Psilocybe", "Cordyceps", "Reishi", "Chaga", "Lion", "Mane",
	"Turkey", "Tail", "Maitake", "Oyster", "Wood", "Ear", "Cloud", "Ear"
]

static var _wizard_names: Array[String] = [
	"Merlin", "Gandalf", "Elminster", "Dumbledore", "Raistlin",
	"Morgana", "Circe", "Prospero", "Thulsa", "Alatar",
	"Pallando", "Saruman", "Radagast", "Jafar", "Vivi",
	"Schmendrick", "Tamsin", "Zeddicus", "Belgarath", "Polgara",
	"Harry", "Ged", "Allanon", "Fizban", "Dalamar",
]

static var _builder_names: Array[String] = [
	"Bob", "Builder", "Hammerman", "Tim", "Taylor",
	"Mike", "Mulligan", "Larry", "Lumbergh", "Foreman",
	"Gus", "Gravel", "Brick", "Mason", "Carpenter",
	"Wright", "Sawyer", "Planer", "Nail", "Joist",
	"Mortar", "Trowel", "Plumb", "Level", "Square",
]

static func generate(species: String) -> String:
	var pool: Array[String] = []
	match species:
		"wolf":
			pool = _wolf_names
		"sheep":
			pool = _sheep_names
		"human":
			pool = _human_names
		"boar":
			pool = _boar_names
		"falcon":
			pool = _falcon_names
		"robin":
			pool = _robin_names
		"worm":
			pool = _worm_names
		"fish":
			pool = _fish_names
		"mushroom", "spore":
			pool = _mushroom_names
		"wizard":
			pool = _wizard_names
		"builder":
			pool = _builder_names
		_:
			pool = _sheep_names
	if pool.is_empty():
		return "Unknown"
	return pool[randi() % pool.size()]

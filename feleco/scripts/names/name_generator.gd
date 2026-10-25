class_name NameGenerator
extends RefCounted

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

# A name for this species and sex from NameLists (100+ each, built from
# names.txt). With no sex given, either list. Wizards and builders keep
# their own lists above.
static func generate(species: String, sex: String = "") -> String:
	var key: String = species
	if key == "spore" or key == "mushroom":
		return _pick_clean(NameLists.LISTS["mushroom:any"])
	if NameLists.LISTS.has(key + ":male"):
		var s: String = sex if sex in ["male", "female"] else ("female" if randf() < 0.5 else "male")
		return _pick_clean(NameLists.LISTS["%s:%s" % [key, s]])
	var pool: Array[String] = _builder_names if species == "builder" else _wizard_names
	return _pick_clean(pool)

static func _pick_clean(pool: Array) -> String:
	if pool.is_empty():
		return "Unknown"
	# Every name is checked, so a word list edit can never put something
	# rude in front of a classroom.
	for i: int in 12:
		var name: String = pool[randi() % pool.size()]
		if is_clean(name):
			return name
	return "Sprout"

# Feleco is played by middle schoolers. Names are blocked if any word is on
# the list, or if they contain a clearly offensive root anywhere.
const BLOCKED_WORDS: Array[String] = [
	"cock", "dick", "dickon", "tit", "tits", "titty", "knob", "nob", "willy", "wang", "dong",
	"booty", "butt", "arse", "ass", "bum", "fanny", "pussy", "balls", "nuts", "boner",
	"souse", "drunk", "beer", "weed", "pot", "hooker", "pimp", "sexy", "nude", "naked",
	"hell", "damn", "crap", "poop", "turd", "pee", "wee", "fart",
]
const BLOCKED_ROOTS: Array[String] = [
	"fuck", "shit", "cunt", "piss", "slut", "whore", "bitch", "bastard", "penis", "vagin",
	"boob", "porn", "nazi", "nigg", "fag", "retard", "rape", "psilo", "cocaine", "heroin",
]

static func is_clean(name: String) -> bool:
	var low := name.to_lower()
	for root: String in BLOCKED_ROOTS:
		if low.contains(root):
			return false
	for word: String in low.replace("-", " ").replace("'", " ").split(" ", false):
		if BLOCKED_WORDS.has(word):
			return false
	return true

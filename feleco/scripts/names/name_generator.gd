class_name NameGenerator
extends RefCounted

# Originals only: no wizard or builder names from books, films or games
# (see scripts/dev/franchise_names.txt).
static var _wizard_names: Array[String] = [
	"Merlin", "Morgana", "Circe", "Prospero", "Tamsin",
	"Thistlewick", "Ombrin", "Ashgrove", "Fennimore", "Bramblebeard",
	"Quillon", "Mossworth", "Oriel", "Elderwyn", "Rainmaker",
	"Hazelrune", "Cindervale", "Wispwood", "Larkspur", "Old Fenwick",
	"Starling", "Cobblemere", "Puddlewhit", "Mirabel", "Oakhart",
]

static var _builder_names: Array[String] = [
	"Hammerman", "Taylor", "Larry", "Foreman", "Gus",
	"Gravel", "Brick", "Mason", "Carpenter", "Wright",
	"Sawyer", "Planer", "Nail", "Joist", "Mortar",
	"Trowel", "Plumb", "Level", "Square", "Rafter",
	"Beam", "Chisel", "Thatch", "Cobb", "Lintel",
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
# the list, if they contain a clearly offensive root anywhere (also after
# undoing l33t spellings and stripping spaces and symbols), or if they are a
# name from a book, film, game or show.
const BLOCKED_WORDS: Array[String] = [
	"cock", "dick", "dickon", "tit", "tits", "titty", "knob", "nob", "willy", "wang", "dong",
	"booty", "butt", "arse", "ass", "bum", "fanny", "pussy", "balls", "nuts", "boner",
	"souse", "drunk", "beer", "weed", "pot", "hooker", "pimp", "sexy", "nude", "naked",
	"hell", "damn", "crap", "poop", "turd", "pee", "wee", "fart", "cum", "anal", "anus",
	"sex", "thot", "milf", "kys", "wtf", "stfu", "suck", "sucks", "poo", "vape", "bong",
	"simp", "goon", "kill", "die", "dead", "gay", "hoe", "ho", "dum", "dumb", "idiot", "stupid",
	"loser", "ugly", "fat", "nerd", "moron", "jerk", "kkk", "drug", "drugs", "gun", "bomb", "spic",
]
const BLOCKED_ROOTS: Array[String] = [
	"fuck", "fuk", "shit", "cunt", "piss", "slut", "whore", "bitch", "bastard", "penis",
	"vagin", "boob", "porn", "nazi", "hitler", "nigg", "nigga", "fag", "retard", "rape", "psilo",
	"cocaine", "heroin", "dildo", "jizz", "nipple", "testic", "orgasm", "horny", "erect",
	"pedo", "molest", "suicid", "diarrh", "puke", "vomit", "asshole", "dumbass", "jackass",
	"wanker", "twat", "skank", "tranny", "chink", "kike", "beaner", "gook", "terroris",
]
const FRANCHISE: Array[String] = [
	"gandalf", "dumbledore", "elminster", "raistlin", "saruman", "radagast", "jafar", "voldemort",
	"hermione", "hagrid", "snape", "hedwig", "dobby", "frodo", "bilbo", "gollum", "aragorn",
	"legolas", "sauron", "galadriel", "nemo", "simba", "mufasa", "pumbaa", "bambi", "baloo",
	"bagheera", "mowgli", "aslan", "pikachu", "totoro", "elsa", "olaf", "moana", "mickey",
	"shrek", "garfield", "snoopy", "scooby", "yoda", "chewbacca", "mario", "luigi", "sonic",
	"kirby", "yoshi", "zelda", "groot", "hulk", "batman", "superman", "spiderman", "pooh",
	"eeyore", "tigger", "peppa", "thumper", "harry potter", "potter", "bluey", "minecraft",
	"fortnite", "roblox", "skibidi", "gyatt",
]

static func _squash(text: String) -> String:
	var low := text.to_lower()
	var leet := {"0": "o", "1": "i", "!": "i", "3": "e", "4": "a", "@": "a", "5": "s", "$": "s", "7": "t", "8": "b", "9": "g"}
	var out := ""
	for ch: String in low:
		ch = leet.get(ch, ch)
		if ch >= "a" and ch <= "z":
			out += ch
	return out

static func is_clean(name: String) -> bool:
	var low := name.to_lower()
	var squashed := _squash(name)
	for root: String in BLOCKED_ROOTS:
		if low.contains(root) or squashed.contains(root):
			return false
	for word: String in low.replace("-", " ").replace("'", " ").replace("_", " ").replace(".", " ").split(" ", false):
		if BLOCKED_WORDS.has(word) or BLOCKED_WORDS.has(_squash(word)):
			return false
	for f: String in FRANCHISE:
		if squashed.contains(f.replace(" ", "")):
			return false
	return true

# A player's own name for their creature: letters, spaces, hyphens and
# apostrophes only, 2 to 16 characters, and clean. Returns "" if allowed,
# otherwise the reason to show.
static func check_player_name(name: String) -> String:
	var n := name.strip_edges()
	if n.length() < 2:
		return "Names need at least 2 letters."
	if n.length() > 16:
		return "Names can be at most 16 letters."
	for ch: String in n:
		var ok: bool = (ch >= "a" and ch <= "z") or (ch >= "A" and ch <= "Z") or ch == " " or ch == "-" or ch == "'"
		if not ok:
			return "Letters only, please."
	if not is_clean(n):
		return "Let's pick a kinder (and original) name."
	return ""

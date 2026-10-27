extends Control

class_name Tickertape

# The valley's running commentary: births, deaths, scraps, floods and the
# odd thought from nowhere, scrolling past as a marquee, each story tinted
# by what kind of news it is. Written for a middle-school audience:
# dramatic and silly, never gory.

# With nothing else to report, the valley mutters to itself.
const MURMUR_AFTER: float = 9.0

var _director: SimulationDirector = null
var _quiet: float = 0.0

@onready var _label: Label = $Panel/Label
@onready var _panel: Panel = $Panel

# Each kind of news has its own colour, a tag word and a font style, shared
# with the History window so a kill always looks like a kill.
const KIND_COLORS: Dictionary = {
	"birth": Color(0.45, 0.88, 0.4),
	"death": Color(0.7, 0.74, 0.78),
	"kill": Color(0.95, 0.38, 0.32),
	"wound": Color(0.98, 0.62, 0.3),
	"big": Color(1.0, 0.8, 0.28),
	"murmur": Color(0.55, 0.72, 1.0),
	"news": Color(0.85, 0.66, 1.0),
}
const KIND_TAGS: Dictionary = {
	"birth": "BORN", "death": "DIED", "kill": "HUNT", "wound": "FIGHT",
	"big": "BIG NEWS", "murmur": "...", "news": "VALLEY",
}
# Font per kind: big news bold, murmurs italic, the rest regular.
const KIND_FONTS: Dictionary = {"big": "bold", "kill": "bold", "murmur": "italic"}

# ---------------------------------------------------------------------------
# BIRTH
# ---------------------------------------------------------------------------
const BIRTH_POOLS: Dictionary = {
	"sheep": [
		"A lamb named %s tumbles into the world, all knees and bleats.",
		"The grass whispers as %s the sheep takes their first breath.",
		"%s the lamb is born and immediately follows the wrong sheep.",
		"Welcome, %s! You are a sheep. Your hobbies are now grass and standing.",
		"%s the lamb has arrived and is already mostly fluff.",
		"A new sheep, %s, looks at the world and says 'baa' with total confidence.",
		"%s the lamb is born. Somewhere a wolf adds them to a list.",
	],
	"wolf": [
		"A pup named %s opens amber eyes and howls at nothing in particular.",
		"%s the wolf pup is born and has already chewed a stick to death.",
		"The pack grows. %s the pup practises a scary face. It is adorable.",
		"%s the wolf is born and tries to howl. It comes out as a squeak.",
		"A new pup, %s, wags so hard their whole back half joins in.",
	],
	"human": [
		"A child named %s draws their first breath, already plotting.",
		"The village cheers! %s is born. May they build higher walls.",
		"%s the human arrives and immediately wants to know what everything is called.",
		"Baby %s is born. The village argues about whose nose they have.",
		"A new villager, %s, has entered the valley armed with nothing but lungs.",
	],
	"falcon": [
		"An egg cracks. %s the falcon spreads wings wet with ambition.",
		"From the aerie, %s the falcon screams their first hunting cry.",
		"%s the falcon chick glares at the sky like it owes them money.",
		"Hatched: %s the falcon. Eyesight: incredible. Manners: none.",
	],
	"robin": [
		"A tiny heartbeat flutters. %s the robin hops into being.",
		"The morning chorus gains a voice: %s the robin chirps hello.",
		"Small, red-breasted and utterly convinced of their own importance: %s.",
		"%s the robin hatches and starts a feud with a leaf.",
	],
	"boar": [
		"The mud bubbles. %s the boar rises, snout first.",
		"A snorting miracle: %s the boar is born, already searching for truffles.",
		"%s the piglet is born stripy, like a tiny furious melon.",
		"Welcome %s, the newest boar. Personal space is not a boar concept.",
	],
	"worm": [
		"The soil splits silently. %s the worm greets the dark.",
		"A humble beginning: %s the worm, no bigger than a lie.",
		"%s the worm is born. Which end is the front? %s isn't sure either.",
		"A new worm, %s, joins the underground committee for dirt.",
	],
	"rabbit": [
		"A twitching nose breaks the surface. %s the rabbit surveys a strange world.",
		"Quick, soft and dangerously adorable: %s the rabbit is born.",
		"The warren celebrates! %s the rabbit arrives with ears like sails.",
		"%s the kit is born and has already planned four escape routes.",
	],
	"fish": [
		"A fry named %s wriggles out of the gravel and into the current.",
		"%s the fish is born. First lesson: water is wet. Second lesson: herons.",
		"The river gains a tiny swimmer: %s, the size of a spelling mistake.",
		"%s hatches, sees the whole river and decides to go the other way.",
	],
	"spore": [
		"A spore named %s drifts down and roots in the forgotten.",
		"From decay, %s the mushroom blooms, beautiful and brief.",
		"The mycelium network sings. %s the spore has joined the group chat.",
		"%s the mushroom pops up overnight, looking suspiciously pleased.",
	],
}

# ---------------------------------------------------------------------------
# DEATH (combat deaths are narrated separately)
# ---------------------------------------------------------------------------
const DEATH_POOLS: Dictionary = {
	"sheep": [
		"The worms have found %s the sheep. The cycle is kind, if a bit icky.",
		"A sheep named %s has gone to the great pasture in the sky.",
		"The grass grows greener where %s the sheep once stood. Cruel irony.",
		"%s the sheep has stopped. The flock notices four days later.",
		"Farewell, %s. You were mostly wool, and that was enough.",
	],
	"wolf": [
		"Even top predators fall. %s the wolf returns to the dirt that feared them.",
		"The pack howls for %s the wolf, though mostly out of habit.",
		"The moon weeps, or maybe it's just dew. %s the wolf is gone.",
		"%s the wolf has run their last run. The sheep pretend not to be relieved.",
	],
	"human": [
		"A villager named %s has passed. Their chair stays warm a while.",
		"The village mourns %s, then politely divides their soup bowls.",
		"%s the human has returned to the soil they never truly owned.",
		"A small stone is set for %s. Someone carves it slightly wonky.",
	],
	"falcon": [
		"The sky is emptier. %s the falcon will not dive again.",
		"Feathers settle like snow. %s the falcon has fallen.",
		"%s the falcon has gone. The rabbits hold a very quiet party.",
	],
	"robin": [
		"A small song ends. %s the robin chirps no more.",
		"Quick lives, quick ends. %s the robin has flown west, permanently.",
		"%s the robin is gone. A worm somewhere relaxes for the first time in weeks.",
	],
	"boar": [
		"The mud reclaims its own. %s the boar has gone to root in darker soil.",
		"A boar named %s ends as they lived: loudly, and in a puddle.",
		"%s the boar will be remembered fondly by the mushrooms.",
	],
	"worm": [
		"The earth opens wider. %s the worm has gone to the deeper dark.",
		"%s the worm has finished their life's work: dirt, but better.",
		"A tiny wriggle stops. %s the worm is now officially soil.",
	],
	"rabbit": [
		"A rabbit named %s has hopped their last hop. The hawks circle.",
		"The warren feels a vacancy. %s the rabbit is gone.",
		"%s the rabbit has left. Their burrow is listed as 'cosy, slightly used'.",
	],
	"fish": [
		"%s the fish has swum to the great pond beyond the hills.",
		"A ripple fades. %s the fish is no more.",
		"%s the fish is gone. The river doesn't say anything. Rivers never do.",
	],
	"spore": [
		"A spore named %s releases their final puff.",
		"%s the mushroom collapses into a small, damp legend.",
		"The mycelium mourns in slow, chemical song. %s the spore is gone.",
	],
}

# ---------------------------------------------------------------------------
# HUNTS
# ---------------------------------------------------------------------------
const KILL_POOLS: Dictionary = {
	"wolf->sheep": [
		"The pack descends. %s the wolf catches %s the sheep before the poor thing can bleat.",
		"Nature is not subtle. %s the wolf has %s the sheep for dinner, wool and all.",
		"%s the wolf takes %s the sheep. The flock moves three steps left and carries on.",
		"%s the wolf has eaten %s the sheep. Somewhere a shepherd shakes a fist at the sky.",
	],
	"human->wolf": [
		"A hunter's spear finds its mark. %s the human brings down %s the wolf.",
		"The pack loses a member. %s's spear was too much for %s the wolf.",
		"%s the human out-thinks %s the wolf. Brains: 1, teeth: 0.",
	],
	"wolf->human": [
		"The hunter becomes the hunted. %s the wolf catches %s the human far from home.",
		"%s the wolf was waiting when %s the human wandered too far from the village.",
	],
	"human->sheep": [
		"%s the human needed mutton. %s the sheep was in the wrong field at the wrong time.",
		"Dinner is decided. %s takes %s the sheep back to the village pot.",
	],
	"human->robin": [
		"A sling whirls. %s the human brings down %s the robin.",
		"%s the human collects %s the robin for a very small pie.",
	],
	"human->rabbit": [
		"A snare tightens. %s the human claims %s the rabbit for the stew.",
		"%s the human outsmarts %s the rabbit. The warren files a complaint.",
	],
	"falcon->robin": [
		"From above, doom. %s the falcon dives and catches %s the robin mid-flight.",
		"The sky isn't big enough for both. %s the falcon snatches %s the robin.",
	],
	"falcon->rabbit": [
		"Talons like anchors. %s the falcon drops on %s the rabbit out of the sun.",
		"The rabbit ran. %s the falcon was faster. %s won't be running again.",
	],
	"falcon->fish": [
		"Splash! %s the falcon plucks %s the fish straight out of the river.",
		"%s the falcon catches %s the fish looking up at exactly the wrong moment.",
	],
	"boar->wolf": [
		"A boar charges like a hairy boulder. %s flattens %s the wolf.",
		"The wolf underestimated the pig. %s the boar sends %s flying and keeps trotting.",
	],
	"boar->human": [
		"A wall of bristle and grumpiness. %s the boar bowls over %s the human.",
		"%s the boar did not shoo when %s the human tried to shoo it.",
	],
	"boar->sheep": [
		"Wrong field, wrong boar. %s the boar knocks %s the sheep clean over.",
	],
	"boar->boar": [
		"Boar-on-boar drama. %s beats %s in a dispute over mud rights.",
	],
	"human->human": [
		"Neighbours fall out. %s the human defeats %s over a patch of dirt.",
		"A tribal squabble turns serious. %s bests %s and the village goes very quiet.",
	],
	"generic": [
		"A tough scrap. %s the %s defeats %s the %s.",
		"The strong eat the weak. %s the %s catches %s the %s.",
		"One less soul in the valley. %s the %s got the better of %s the %s.",
		"Circle of life, fast-forward edition: %s the %s catches %s the %s.",
	],
}

# ---------------------------------------------------------------------------
# NEAR MISSES
# ---------------------------------------------------------------------------
const WOUND_POOLS: Dictionary = {
	"wolf->sheep": [
		"%s the wolf nips %s the sheep, who escapes minus some wool and all dignity.",
		"Teeth meet fleece. %s the wolf misses %s the sheep by a whisker. Next time, says the wolf.",
	],
	"human->wolf": [
		"A spear glances off. %s the human scares off %s the wolf, who limps into the dark.",
	],
	"wolf->human": [
		"%s the wolf chases %s the human all the way back to the walls.",
	],
	"human->sheep": [
		"%s the human lunges for %s the sheep and gets a faceful of wool.",
	],
	"falcon->robin": [
		"Feathers fly, but nobody falls. %s the falcon just misses %s the robin.",
		"A near miss with talons. %s the falcon swoops, but %s the robin escapes and tells everyone.",
	],
	"boar->*": [
		"%s the boar barrels through %s the %s, who staggers off seeing stars.",
		"A bristling missile named %s clips %s the %s and vanishes into the brush.",
	],
	"generic": [
		"A scuffle ends in bruises, not tragedy. %s the %s rattles %s the %s.",
		"Claws and cries. %s the %s scratches %s the %s, who flees into the undergrowth.",
		"The duel continues. %s the %s bloodies %s the %s's nose, but the hunt fails.",
		"%s the %s goes for %s the %s and misses spectacularly. Embarrassing for everyone.",
	],
}

# ---------------------------------------------------------------------------
# SETTLEMENTS, EXTINCTION, OVERPOPULATION
# ---------------------------------------------------------------------------
const SETTLEMENT_POOL: Array[String] = [
	"A new village rises from the mud! The stonemasons weep with joy.",
	"Hammers ring out. A new settlement stands where none stood before.",
	"Civilisation advances one wall at a time. A new hut is built.",
	"The humans have staked their claim. A village blooms like a stubborn weed.",
	"A new hut! It has a door, a roof and a small sign that says KEEP OUT, WOLVES.",
	"Someone built a house. Someone else is already complaining about the view.",
]

const EXTINCTION_POOL: Dictionary = {
	"sheep": [
		"SILENCE OF THE LAMBS. No sheep remain. The wolves begin to eye each other.",
		"The last sheep is gone. The meadows grow eerily quiet.",
	],
	"wolf": [
		"THE PACK IS NO MORE. The wolves are extinct. The sheep throw a party.",
		"The howling has stopped. No wolves remain to haunt the night.",
	],
	"human": [
		"HUMANITY'S LIGHT IS SNUFFED. No villagers remain. Nature takes the furniture.",
		"The last human is gone. Their fires go cold; the squirrels move in.",
	],
	"falcon": [
		"The skies are free of falcons. The robins sing louder, foolishly.",
	],
	"robin": [
		"No more robins. The worms rejoice, briefly.",
	],
	"boar": [
		"The last boar is gone. The mud shall remember them.",
	],
	"worm": [
		"The soil is empty. No worms wriggle in the dark. A quiet apocalypse.",
	],
	"rabbit": [
		"The warrens are silent. No rabbits hop. The hawks look at each other awkwardly.",
	],
	"spore": [
		"No spores drift. The mycelium has gone quiet. The rot feels lonely.",
	],
	"generic": [
		"EXTINCTION: The %s have vanished from the valley entirely.",
		"GONE. No %s remain to tell their story.",
	],
}

const OVERPOPULATION_POOL: Dictionary = {
	"sheep": [
		"The meadows groan beneath wool. Sheep overpopulation threatens the grass itself.",
		"TOO. MANY. SHEEP. The valley is one giant bleating carpet.",
	],
	"wolf": [
		"The pack grows too large. The wolves are eyeing each other's dinners.",
		"Wolf overpopulation: the apex has become the problem.",
	],
	"human": [
		"The villages spill over. Too many mouths, too few walls.",
		"Humans are breeding like... well, humans.",
	],
	"falcon": [
		"The sky is crowded. The robins have nowhere left to hide.",
	],
	"robin": [
		"Robins everywhere. The trees are dripping with them. It's unsettling.",
	],
	"boar": [
		"The boars have formed a parliament. There are too many. Nature trembles.",
	],
	"worm": [
		"The soil is nothing but worms. A squirming, wriggling abundance.",
	],
	"rabbit": [
		"The warrens have warrens. Rabbit overpopulation: cute, but catastrophic.",
	],
	"spore": [
		"Spores choke the air. Breathing is a fungal experience now.",
	],
	"generic": [
		"OVERPOPULATION: The %s are breeding out of control.",
		"The %s have multiplied beyond reason. Something will correct this.",
	],
}

# ---------------------------------------------------------------------------
# MURMURS: weird asides when nothing else is happening
# ---------------------------------------------------------------------------
const MURMURS: Array[String] = [
	"A sheep has been staring at a rock for eleven minutes. Nobody knows why.",
	"A worm has reached the surface, looked around, and gone straight back down.",
	"Two rabbits are having an argument. It is entirely in thumps.",
	"A boar sneezes. Three robins fall out of a tree in surprise.",
	"Somewhere, a mushroom is thinking very slowly about everything.",
	"A wolf practises its scary face in the river. The river is not impressed.",
	"A falcon has been hovering in one spot for so long it might be furniture.",
	"The grass is growing. This is the most exciting thing happening right now.",
	"A villager names a cloud. The cloud does not answer to it.",
	"A robin has found a worm. The worm has found religion.",
	"A sheep tries to count other sheep and falls asleep.",
	"The mycelium sends a message across the valley. It just says 'hmm'.",
	"A rabbit freezes completely still. It is now a very convincing loaf.",
	"A boar has discovered a puddle and is having the best day of its life.",
	"A fish jumps, sees the dry land and says 'no thank you'.",
	"An owl would have something wise to say here, but there are no owls.",
	"The wind changes. Every sheep in the valley turns to face it, just in case.",
	"A wolf sits down to think. It thinks about sheep. It always thinks about sheep.",
	"A worm and a mushroom have formed an alliance. Its goals are unclear.",
	"A villager drops a spoon. The whole valley hears it.",
	"Somewhere a falcon remembers it left the egg on. It didn't. Falcons don't cook.",
	"A robin bounces three times for no reason, then looks around to see if anyone noticed.",
	"The river carries a leaf past at a dignified pace.",
	"A boar and a sheep lock eyes. Neither one blinks. Neither one knows why they started.",
	"A tree drops one apple. Four species notice instantly.",
]

# Murmurs that read the valley as it is right now. %d is a live count.
const CENSUS_MURMURS: Array = [
	["fish", "Census: %d fish. The river is mostly opinions now."],
	["sheep", "There are %d sheep. Every one of them thinks it's the main character."],
	["wolves", "%d wolves patrol the valley, each pretending to be the leader."],
	["rabbits", "Rabbit count: %d, and rising while you read this."],
	["worms", "%d worms are quietly holding the whole valley together."],
	["humans", "%d villagers. They have built %s and argued about all of it."],
	["robins", "%d robins, and every one has a strong opinion about worms."],
	["boars", "%d boars roam the valley. The mud has never been happier."],
	["falcons", "%d falcons circle overhead, judging everyone."],
]

# ---------------------------------------------------------------------------
# UTILITY
# ---------------------------------------------------------------------------
func _pick(arr: Array) -> String:
	if arr.is_empty():
		return "Something happened."
	return arr[randi() % arr.size()]

func _fmt(template: String, args: Array) -> String:
	# Some lines use the name twice; repeat the last argument to fill them.
	var need: int = template.count("%s")
	var a: Array = args.duplicate()
	while a.size() < need and not a.is_empty():
		a.append(a[a.size() - 1])
	return template % a.slice(0, need)

# The base pools here plus StoryBank's extra lines for the same key.
func _pool(base: Dictionary, extra: Dictionary, key: String, fallback: String = "") -> Array:
	var out: Array = []
	out.append_array(base.get(key, []))
	out.append_array(extra.get(key, []))
	if out.is_empty() and not fallback.is_empty():
		out.append_array(base.get(fallback, []))
		out.append_array(extra.get(fallback, []))
	return out

# ---------------------------------------------------------------------------
# SAGAS: stories use the real creature's name, and the ticker remembers what
# happened to it, so a lucky rabbit's third escape or a lion's fifth catch is
# called back when it happens. Keyed by instance id; cleared as they die.
# ---------------------------------------------------------------------------
var _sagas: Dictionary = {}
# Creatures whose end (or birth) was already told, so it isn't told twice.
var _told: Dictionary = {}

# The creature an event happened to: the nearest of its species, or for a
# birth the youngest nearby (the parent stands right beside the baby).
func _real(species: String, pos: Vector3, skip: Node = null, newborn: bool = false) -> MarkovAgent:
	if _director == null:
		return null
	var agents: Node = _director.get_node_or_null("Agents")
	if agents == null:
		return null
	var best: MarkovAgent = null
	var best_d: float = 9.0
	for n: Node in agents.get_children():
		var a := n as MarkovAgent
		if a == null or a == skip or a.species_id != species or a.display_name.is_empty() or (newborn and _told.has(a.get_instance_id())):
			continue
		var d: float = a.global_position.distance_squared_to(pos)
		if newborn:
			if d > 9.0 or a._age > 1.0:
				continue
			d = a._age
		if d < best_d:
			best_d = d
			best = a
	return best

func _name_of(a: MarkovAgent, species: String) -> String:
	return a.display_name if a != null else NameGenerator.generate(species)

func _saga(a: MarkovAgent) -> Dictionary:
	if a == null:
		return {}
	var id: int = a.get_instance_id()
	if not _sagas.has(id):
		_sagas[id] = {"escapes": 0, "kills": 0}
	return _sagas[id]

static func nth(n: int) -> String:
	var suffix: String = "th"
	if n % 100 < 11 or n % 100 > 13:
		suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][n % 10]
	return "%d%s" % [n, suffix]

func _flavor_birth(species: String, variant: String = "", pos: Vector3 = Vector3.ZERO) -> String:
	var key: String = variant if not variant.is_empty() else species
	var a: MarkovAgent = _real(species, pos, null, true)
	if a != null:
		_told[a.get_instance_id()] = true
	var name_str: String = a.display_name if a != null else NameGenerator.generate(key)
	var pool: Array = _pool(BIRTH_POOLS, StoryBank.BIRTHS, key)
	if pool.is_empty():
		pool = _pool(BIRTH_POOLS, StoryBank.BIRTHS, species)
	if pool.is_empty():
		pool = ["%s the " + species + " is born. Welcome to the valley!"]
	return _fmt(_pick(pool), [name_str])

func _flavor_death(species: String, pos: Vector3 = Vector3.ZERO) -> String:
	var a: MarkovAgent = _real(species, pos)
	var name_str: String = _name_of(a, species)
	var pool: Array = _pool(DEATH_POOLS, StoryBank.DEATHS, species)
	if pool.is_empty():
		pool = ["%s the " + species + " has died, and returns to the soil."]
	var line: String = _fmt(_pick(pool), [name_str])
	return line + _epitaph(a, name_str)

# A short callback to the creature's story, when it had one.
func _epitaph(a: MarkovAgent, name_str: String) -> String:
	if a == null:
		return ""
	var saga: Dictionary = _sagas.get(a.get_instance_id(), {})
	_sagas.erase(a.get_instance_id())
	if int(saga.get("kills", 0)) >= 3:
		return " " + _pick(StoryBank.SAGA_FALL_HUNTER) % [name_str, int(saga["kills"])]
	if int(saga.get("escapes", 0)) >= 2:
		return " " + _pick(StoryBank.SAGA_FALL_SURVIVOR) % [name_str, int(saga["escapes"])]
	if a._age > a._lifespan * 0.85:
		var seasons: int = maxi(4, int(a._age / maxf(a._lifespan, 1.0) * 8.0))
		return " " + _pick(StoryBank.SAGA_OLD) % [name_str, seasons]
	return ""

func _flavor_kill(attacker: String, target: String, pos: Vector3 = Vector3.ZERO) -> String:
	var t: MarkovAgent = _real(target, pos)
	var at: MarkovAgent = _real(attacker, pos, t)
	var a_name: String = _name_of(at, attacker)
	var t_name: String = _name_of(t, target)
	var key: String = "%s->%s" % [attacker, target]
	var pool: Array = _pool(KILL_POOLS, StoryBank.KILLS, key)
	var line: String
	if pool.is_empty():
		line = _fmt(_pick(_pool(KILL_POOLS, StoryBank.KILLS, "generic")), [a_name, _species_word(attacker), t_name, _species_word(target)])
	else:
		line = _fmt(_pick(pool), [a_name, t_name])
	line += _epitaph(t, t_name)
	if t != null:
		_told[t.get_instance_id()] = "killed"
	var saga: Dictionary = _saga(at)
	if not saga.is_empty():
		saga["kills"] = int(saga["kills"]) + 1
		if int(saga["kills"]) >= 3 and randf() < 0.6:
			line += " " + _pick(StoryBank.SAGA_TALLY) % [a_name, nth(int(saga["kills"]))]
	return line

func _flavor_wound(attacker: String, target: String, pos: Vector3 = Vector3.ZERO) -> String:
	var t: MarkovAgent = _real(target, pos)
	var at: MarkovAgent = _real(attacker, pos, t)
	var a_name: String = _name_of(at, attacker)
	var t_name: String = _name_of(t, target)
	var key: String = "%s->%s" % [attacker, target]
	var pool: Array = _pool(WOUND_POOLS, StoryBank.WOUNDS, key)
	var line: String
	if not pool.is_empty():
		line = _fmt(_pick(pool), [a_name, t_name])
	elif attacker == "boar":
		line = _fmt(_pick(WOUND_POOLS["boar->*"]), [a_name, t_name, _species_word(target)])
	else:
		line = _fmt(_pick(_pool(WOUND_POOLS, StoryBank.WOUNDS, "generic")), [a_name, _species_word(attacker), t_name, _species_word(target)])
	var saga: Dictionary = _saga(t)
	if not saga.is_empty():
		saga["escapes"] = int(saga["escapes"]) + 1
		if int(saga["escapes"]) >= 2:
			line += " " + _pick(StoryBank.SAGA_SURVIVOR) % [t_name, nth(int(saga["escapes"]))]
	return line

const SPECIES_WORDS: Dictionary = {"lion": "mountain lion", "goat": "mountain goat", "spore": "mushroom"}

func _species_word(species: String) -> String:
	return SPECIES_WORDS.get(species, species)

func _flavor_settlement() -> String:
	return _pick(SETTLEMENT_POOL)

func _flavor_extinction(species: String) -> String:
	var pool: Array = EXTINCTION_POOL.get(species, EXTINCTION_POOL.get("generic", []))
	var template: String = _pick(pool)
	if "%s" in template:
		return _fmt(template, [species.capitalize()])
	return template

func _flavor_overpopulation(species: String) -> String:
	var pool: Array = OVERPOPULATION_POOL.get(species, OVERPOPULATION_POOL.get("generic", []))
	var template: String = _pick(pool)
	if "%s" in template:
		return _fmt(template, [species.capitalize()])
	return template

func _murmur() -> String:
	if _director != null and randf() < 0.4:
		var counts: Dictionary = _director.get_creature_counts()
		var pick: Array = CENSUS_MURMURS[randi() % CENSUS_MURMURS.size()]
		var n: int = int(counts.get(pick[0], 0))
		if n > 1:
			var line: String = pick[1]
			if line.count("%") >= 2:
				var huts: int = _director._active_shelters.filter(func(s): return is_instance_valid(s)).size()
				return line % [n, "%d hut%s" % [huts, "" if huts == 1 else "s"]]
			return line % n
	if _director != null and randf() < 0.25:
		return _pick(StoryBank.SEASON_MURMURS.get(_director.get_season(), MURMURS))
	return _pick(MURMURS + StoryBank.MURMURS)

# ---------------------------------------------------------------------------
# LIFECYCLE
# ---------------------------------------------------------------------------
func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	z_index = 100
	# The single label is replaced by a marquee strip of stories.
	_label.visible = false
	_panel.clip_contents = true
	# A full-width strip along the very bottom edge, below the buttons.
	var strip: StyleBox = _panel.get_theme_stylebox("panel")
	if strip is StyleBoxFlat:
		strip = strip.duplicate()
		strip.set_corner_radius_all(0)
		strip.border_width_left = 0
		strip.border_width_right = 0
		strip.border_width_bottom = 0
		_panel.add_theme_stylebox_override("panel", strip)
	_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var world: Node3D = get_tree().current_scene.get_node_or_null("World")
	if world != null:
		_director = world as SimulationDirector
		if _director != null:
			_director.agent_born.connect(_on_agent_born)
			_director.agent_died.connect(_on_agent_died)
			_director.combat_event.connect(_on_combat_event)
			if _director.has_signal("settlement_built"):
				_director.settlement_built.connect(_on_settlement_built)
			if _director.has_signal("extinction_event"):
				_director.extinction_event.connect(_on_extinction)
			if _director.has_signal("overpopulation_event"):
				_director.overpopulation_event.connect(_on_overpopulation)
			if _director.has_signal("chronicle"):
				_director.chronicle.connect(func(t: String) -> void: _add_event(t, "news"))

# ---------------------------------------------------------------------------
# MARQUEE: one line of stories gliding right to left at an easy reading pace
# (about 13 characters a second, whatever the game speed). New stories join
# the end of the line; if they pile up, ambient murmurs are dropped first and
# then the oldest waiting stories.
# ---------------------------------------------------------------------------
const SCROLL_PX: float = 95.0
const GAP_PX: float = 90.0
const MAX_WAITING: int = 6
var _items: Array[Control] = []
var _waiting: Array[Dictionary] = []

func _process(delta: float) -> void:
	# Steady on screen regardless of 1x/2x/4x or pause.
	var real: float = delta / maxf(Engine.time_scale, 0.01)
	if not get_tree().paused:
		_quiet += real
	var w: float = _panel.size.x
	for item: Control in _items:
		item.position.x -= SCROLL_PX * real
	while not _items.is_empty() and _items[0].position.x + _items[0].size.x < -8.0:
		var gone: Control = _items.pop_front()
		gone.queue_free()
	var tail_end: float = -INF if _items.is_empty() else _items[-1].position.x + _items[-1].size.x
	if tail_end < w - GAP_PX:
		if _waiting.is_empty() and _quiet >= MURMUR_AFTER and _items.size() <= 1:
			_queue(_murmur(), "murmur")
		if not _waiting.is_empty():
			_launch(_waiting.pop_front(), maxf(w, tail_end + GAP_PX))
	_panel.modulate.a = move_toward(_panel.modulate.a, 1.0 if not _items.is_empty() else 0.0, real * 3.0)

func _launch(ev: Dictionary, at_x: float) -> void:
	var kind: String = ev["kind"]
	var accent: Color = KIND_COLORS.get(kind, KIND_COLORS["news"])
	# One story = a coloured tag saying what kind it is, then its words in
	# that kind's colour and font.
	var tag := Label.new()
	tag.text = KIND_TAGS.get(kind, "VALLEY")
	tag.add_theme_font_override("font", FelecoUi.font("bold"))
	tag.add_theme_font_size_override("font_size", 12)
	tag.add_theme_color_override("font_color", Color(0.06, 0.08, 0.06))
	var tag_bg := StyleBoxFlat.new()
	tag_bg.bg_color = accent
	tag_bg.set_corner_radius_all(6)
	tag_bg.content_margin_left = 7
	tag_bg.content_margin_right = 7
	tag_bg.content_margin_top = 2
	tag_bg.content_margin_bottom = 2
	tag.add_theme_stylebox_override("normal", tag_bg)
	var words := Label.new()
	words.text = ev["text"]
	words.add_theme_font_override("font", FelecoUi.font(KIND_FONTS.get(kind, "regular")))
	words.add_theme_font_size_override("font_size", 20 if kind == "big" else 18)
	words.add_theme_color_override("font_color", accent.lerp(Color(0.97, 0.95, 0.9), 0.15 if kind == "big" else 0.4))
	if kind == "big":
		words.add_theme_color_override("font_outline_color", Color(0.3, 0.2, 0.0))
		words.add_theme_constant_override("outline_size", 4)
	var story := Control.new()
	for c: Control in [story, tag, words]:
		c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	story.add_child(tag)
	story.add_child(words)
	_panel.add_child(story)
	tag.reset_size()
	words.reset_size()
	var h: float = maxf(tag.size.y, words.size.y)
	tag.position = Vector2(0, (h - tag.size.y) * 0.5)
	words.position = Vector2(tag.size.x + 10.0, (h - words.size.y) * 0.5)
	story.size = Vector2(words.position.x + words.size.x, h)
	story.position = Vector2(at_x, (_panel.size.y - h) * 0.5)
	_items.append(story)

func _queue(text: String, kind: String) -> void:
	_waiting.append({"text": text, "kind": kind})
	while _waiting.size() > MAX_WAITING:
		var drop: int = 0
		for i: int in _waiting.size():
			if _waiting[i]["kind"] == "murmur":
				drop = i
				break
		_waiting.remove_at(drop)

func _add_event(text: String, kind: String = "news") -> void:
	_quiet = 0.0
	if kind != "murmur":
		# Real news jumps ahead of any murmur still waiting.
		_waiting = _waiting.filter(func(e: Dictionary) -> bool: return e["kind"] != "murmur")
	_queue(text, kind)
	if kind == "murmur":
		return
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.append(text)
	var history: EventHistory = get_node_or_null("../EventHistory")
	if history == null:
		history = get_tree().current_scene.get_node_or_null("EventHistory")
	if history != null:
		history.add_entry(text, kind)

func _on_agent_born(species: String, _pos: Vector3, variant: String = "") -> void:
	_add_event(_flavor_birth(species, variant, _pos), "birth")

func _on_agent_died(species: String, _pos: Vector3) -> void:
	# A hunted creature's end was already told by its hunter's story.
	var a: MarkovAgent = _real(species, _pos)
	if a != null and _told.get(a.get_instance_id()) is String:
		_told.erase(a.get_instance_id())
		return
	if a != null:
		_told.erase(a.get_instance_id())
	_add_event(_flavor_death(species, _pos), "death")

func _on_combat_event(attacker_species: String, target_species: String, _pos: Vector3, killed: bool) -> void:
	if killed:
		_add_event(_flavor_kill(attacker_species, target_species, _pos), "kill")
	else:
		_add_event(_flavor_wound(attacker_species, target_species, _pos), "wound")

func _on_settlement_built(_pos: Vector3) -> void:
	_add_event(_flavor_settlement(), "big")

func _on_extinction(species: String) -> void:
	_add_event(_flavor_extinction(species), "big")

func _on_overpopulation(species: String) -> void:
	_add_event(_flavor_overpopulation(species), "big")

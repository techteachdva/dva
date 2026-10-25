extends Control

class_name Tickertape

# The valley's running commentary: births, deaths, scraps, floods and the
# odd thought from nowhere. Each line pops in with a little bounce, types
# itself out and is tinted by what kind of news it is. Written for a
# middle-school audience: dramatic and silly, never gory.

const MAX_EVENTS: int = 12
const DISPLAY_TIME: float = 6.0
const FADE_TIME: float = 0.6
# With nothing else to report, the valley mutters to itself.
const MURMUR_AFTER: float = 9.0

var _events: Array[Dictionary] = []
var _director: SimulationDirector = null
var _display_timer: float = 0.0
var _current_index: int = 0
var _fade_state: float = 1.0
var _quiet: float = 0.0
var _pop: Tween
var _shown_text: String = ""

@onready var _label: Label = $Panel/Label
@onready var _panel: Panel = $Panel

# Tint of the panel border per kind of news.
const KIND_COLORS: Dictionary = {
	"birth": Color(0.55, 0.82, 0.48),
	"death": Color(0.73, 0.78, 0.73),
	"kill": Color(0.86, 0.48, 0.4),
	"wound": Color(0.9, 0.66, 0.42),
	"big": Color(0.902, 0.765, 0.416),
	"murmur": Color(0.62, 0.72, 0.9),
	"news": Color(0.902, 0.765, 0.416),
}

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
		"The pack loses a member. %s the wolf was no match for %s's spear.",
		"%s the human out-thinks %s the wolf. Brains: 1, teeth: 0.",
	],
	"wolf->human": [
		"The hunter becomes the hunted. %s the wolf catches %s the human far from home.",
		"%s the human wandered too far. %s the wolf made sure they didn't wander back.",
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
		"%s the fish looked up at exactly the wrong moment. %s the falcon says thanks.",
	],
	"boar->wolf": [
		"A boar charges like a hairy boulder. %s flattens %s the wolf.",
		"The wolf underestimated the pig. %s the boar sends %s flying and keeps trotting.",
	],
	"boar->human": [
		"A wall of bristle and grumpiness. %s the boar bowls over %s the human.",
		"%s the human tried to shoo %s the boar. It did not shoo.",
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
		"A near miss with talons. %s the robin escapes %s the falcon and tells everyone.",
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

func _flavor_birth(species: String, variant: String = "") -> String:
	var key: String = variant if not variant.is_empty() else species
	var name_str: String = NameGenerator.generate(key)
	var pool: Array = BIRTH_POOLS.get(key, BIRTH_POOLS.get(species, BIRTH_POOLS.get("sheep", [])))
	return _fmt(_pick(pool), [name_str])

func _flavor_death(species: String) -> String:
	var name_str: String = NameGenerator.generate(species)
	var pool: Array = DEATH_POOLS.get(species, DEATH_POOLS.get("sheep", []))
	return _fmt(_pick(pool), [name_str])

func _flavor_kill(attacker: String, target: String) -> String:
	var a_name: String = NameGenerator.generate(attacker)
	var t_name: String = NameGenerator.generate(target)
	var key: String = "%s->%s" % [attacker, target]
	if not KILL_POOLS.has(key):
		return _fmt(_pick(KILL_POOLS["generic"]), [a_name, attacker.capitalize(), t_name, target.capitalize()])
	return _fmt(_pick(KILL_POOLS[key]), [a_name, t_name])

func _flavor_wound(attacker: String, target: String) -> String:
	var a_name: String = NameGenerator.generate(attacker)
	var t_name: String = NameGenerator.generate(target)
	var key: String = "%s->%s" % [attacker, target]
	if attacker == "boar" and not WOUND_POOLS.has(key):
		return _fmt(_pick(WOUND_POOLS["boar->*"]), [a_name, t_name, target.capitalize()])
	if not WOUND_POOLS.has(key):
		return _fmt(_pick(WOUND_POOLS["generic"]), [a_name, attacker.capitalize(), t_name, target.capitalize()])
	return _fmt(_pick(WOUND_POOLS[key]), [a_name, t_name])

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
	return _pick(MURMURS)

# ---------------------------------------------------------------------------
# LIFECYCLE
# ---------------------------------------------------------------------------
func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	z_index = 100
	_label.add_theme_font_override("font", FelecoUi.font("bold"))
	_label.add_theme_font_size_override("font_size", 17)
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

func _process(delta: float) -> void:
	if not get_tree().paused:
		_quiet += delta
		if _quiet >= MURMUR_AFTER:
			_add_event(_murmur(), "murmur")
	if _events.is_empty():
		_panel.modulate = Color(1, 1, 1, 0)
		return
	_display_timer += delta
	if _display_timer >= DISPLAY_TIME:
		_display_timer = 0.0
		_current_index = (_current_index + 1) % _events.size()
		_fade_state = 1.0
		_update_label()
	elif _display_timer >= DISPLAY_TIME - FADE_TIME:
		_fade_state = clampf(1.0 - (_display_timer - (DISPLAY_TIME - FADE_TIME)) / FADE_TIME, 0.0, 1.0)
	else:
		_fade_state = 1.0
	_panel.modulate = Color(1, 1, 1, _fade_state)
	var i: int = _events.size() - 1
	while i >= 0:
		_events[i]["ttl"] -= delta
		if _events[i]["ttl"] <= 0.0:
			_events.remove_at(i)
			if _current_index >= _events.size() and _events.size() > 0:
				_current_index = 0
			elif _events.size() == 0:
				_current_index = 0
		i -= 1

func _update_label() -> void:
	if _events.is_empty():
		_label.text = ""
		return
	var idx: int = clampi(_current_index, 0, _events.size() - 1)
	var ev: Dictionary = _events[idx]
	if ev["text"] == _shown_text:
		return
	_shown_text = ev["text"]
	_label.text = ev["text"]
	_pop_in(String(ev.get("kind", "news")))

# A springy pop, a quick type-on and a flash in the colour of the news.
func _pop_in(kind: String) -> void:
	var accent: Color = KIND_COLORS.get(kind, KIND_COLORS["news"])
	var box := _panel.get_theme_stylebox("panel") as StyleBoxFlat
	if box != null:
		box = box.duplicate()
		box.border_color = accent
		box.set_border_width_all(2)
		_panel.add_theme_stylebox_override("panel", box)
	_panel.pivot_offset = _panel.size * 0.5
	if _pop != null:
		_pop.kill()
	_panel.scale = Vector2(0.86, 0.86)
	_panel.rotation = deg_to_rad(randf_range(-1.6, 1.6))
	_label.visible_ratio = 0.0
	_label.add_theme_color_override("font_color", accent.lerp(Color(0.957, 0.937, 0.894), 0.2))
	_pop = create_tween().set_parallel(true)
	_pop.tween_property(_panel, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	_pop.tween_property(_panel, "rotation", 0.0, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	var type_time: float = clampf(_label.text.length() / 70.0, 0.35, 1.1)
	_pop.tween_property(_label, "visible_ratio", 1.0, type_time)
	_pop.tween_method(func(c: Color) -> void: _label.add_theme_color_override("font_color", c), accent.lerp(Color(1, 1, 1), 0.3), Color(0.957, 0.937, 0.894), 1.2).set_delay(type_time)
	if kind == "big" or kind == "kill":
		_pop.chain().tween_property(_panel, "position:x", _panel.position.x + 6.0, 0.05)
		_pop.chain().tween_property(_panel, "position:x", _panel.position.x, 0.12).set_trans(Tween.TRANS_ELASTIC)

func _add_event(text: String, kind: String = "news") -> void:
	_quiet = 0.0
	_events.append({"text": text, "ttl": DISPLAY_TIME * 3.0, "kind": kind})
	if _events.size() > MAX_EVENTS:
		if _current_index >= _events.size() - 1:
			_current_index = 0
		_events.remove_at(0)
	if _events.size() == 1:
		_current_index = 0
		_display_timer = 0.0
		_fade_state = 1.0
		_update_label()
	if kind == "murmur":
		return
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.append(text)
	var history: EventHistory = get_node_or_null("../EventHistory")
	if history == null:
		history = get_tree().current_scene.get_node_or_null("EventHistory")
	if history != null:
		history.add_entry(text)

func _on_agent_born(species: String, _pos: Vector3, variant: String = "") -> void:
	_add_event(_flavor_birth(species, variant), "birth")

func _on_agent_died(species: String, _pos: Vector3) -> void:
	_add_event(_flavor_death(species), "death")

func _on_combat_event(attacker_species: String, target_species: String, _pos: Vector3, killed: bool) -> void:
	if killed:
		_add_event(_flavor_kill(attacker_species, target_species), "kill")
	else:
		_add_event(_flavor_wound(attacker_species, target_species), "wound")

func _on_settlement_built(_pos: Vector3) -> void:
	_add_event(_flavor_settlement(), "big")

func _on_extinction(species: String) -> void:
	_add_event(_flavor_extinction(species), "big")

func _on_overpopulation(species: String) -> void:
	_add_event(_flavor_overpopulation(species), "big")

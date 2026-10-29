extends Control

class_name Tickertape

const MAX_EVENTS: int = 12
const DISPLAY_TIME: float = 6.0
const FADE_TIME: float = 0.6

var _events: Array[Dictionary] = []
var _director: SimulationDirector = null
var _display_timer: float = 0.0
var _current_index: int = 0
var _fade_state: float = 1.0

@onready var _label: Label = $Panel/Label

# ---------------------------------------------------------------------------
# BIRTH — wonder, magic, new life
# ---------------------------------------------------------------------------
const BIRTH_POOLS: Dictionary = {
	"sheep": [
		"A lamb named %s tumbles into the world, all knees and bleats.",
		"The grass whispers as %s the sheep takes their first breath.",
		"From fleece and foam, %s emerges — soft, stupid, and smiling.",
		"A shepherd's heart swells: %s the sheep has been born beneath the old oak.",
	],
	"wolf": [
		"A pup named %s opens amber eyes and howls at nothing in particular.",
		"The pack grows hungrier. %s the wolf has arrived, teeth like milk.",
		"In the dark of the den, %s the wolf learns to snarl before learning to walk.",
		"The moon bears witness: %s the wolf is born under a bloodstained sky.",
	],
	"human": [
		"A child named %s draws their first breath, already plotting.",
		"From dust and desire, %s the human enters the realm.",
		"The settlement cheers! %s has been born — may they build higher walls.",
		"A new soul, %s, cries out. The land listens, and waits.",
	],
	"falcon": [
		"An egg cracks. %s the falcon spreads wings wet with albumen and ambition.",
		"From the aerie, %s the falcon screams their first hunting cry.",
		"The wind greets a new master: %s the falcon, sharp-eyed and hollow-boned.",
	],
	"robin": [
		"A tiny heartbeat flutters. %s the robin hops into being.",
		"The morning chorus gains a voice: %s the robin chirps their hello.",
		"Small, red-breasted, and utterly convinced of their own importance: %s.",
	],
	"boar": [
		"The mud bubbles. %s the boar rises, tusks first.",
		"A snorting miracle: %s the boar is born, already searching for truffles.",
		"The forest shudders as %s the boar claims their first wallow.",
	],
	"worm": [
		"The soil splits silently. %s the worm greets the dark.",
		"From rot and richness, %s the worm uncoils into existence.",
		"A humble beginning: %s the worm, no bigger than a lie.",
	],
	"rabbit": [
		"A twitching nose breaks the surface. %s the rabbit surveys a cruel world.",
		"Quick, soft, and doomed to be adorable: %s the rabbit is born.",
		"The warren celebrates! %s the rabbit arrives with ears like sails.",
	],
	"spore": [
		"A spore named %s drifts down and roots in the forgotten.",
		"From decay, %s the mushroom blooms — beautiful and brief.",
		"The mycelium network sings. %s the spore has joined the hive-mind.",
	],
}

# ---------------------------------------------------------------------------
# DEATH — entropy, return, aftermath (combat deaths narrated separately)
# ---------------------------------------------------------------------------
const DEATH_POOLS: Dictionary = {
	"sheep": [
		"The worms have found %s the sheep. The cycle is kind, if grotesque.",
		"A sheep named %s has gone to the great pasture in the sky.",
		"The grass grows greener where %s the sheep has fallen. Cruel irony.",
		"Flies convene. %s the sheep is no longer a sheep, but an ecosystem.",
	],
	"wolf": [
		"Even apex predators fall. %s the wolf returns to the dirt that feared them.",
		"The pack howls for %s the wolf, though mostly out of hunger.",
		"A wolf named %s has died. Their bones will be picked clean by smaller mouths.",
		"The moon weeps, or maybe it's just dew. %s the wolf is gone.",
	],
	"human": [
		"A mortal named %s has perished. Their walls stand empty.",
		"The settlement mourns %s, then divides their belongings by noon.",
		"Dust to dust. %s the human has returned to the soil they never truly owned.",
		"A grave is dug. %s the human sleeps beneath the world they tried to tame.",
	],
	"falcon": [
		"The sky is emptier. %s the falcon will not stoop again.",
		"Feathers settle like ash. %s the falcon has fallen.",
		"Even the wind falters. %s the falcon is no more.",
	],
	"robin": [
		"A small song ends. %s the robin chirps no more.",
		"The branch is bare where %s the robin once preened. A tiny tragedy.",
		"Quick lives, quick deaths. %s the robin has flown west, permanently.",
	],
	"boar": [
		"The mud reclaims its own. %s the boar has gone to root in darker soil.",
		"A boar named %s dies as they lived: loudly, and in a ditch.",
		"The forest forgets slowly. %s the boar will be remembered by the fungi.",
	],
	"worm": [
		"A worm named %s has been bisected by the great indifferent boot of fate.",
		"The earth opens wider. %s the worm has gone to the deeper dark.",
		"Humble and headless, %s the worm fertilizes what they once consumed.",
	],
	"rabbit": [
		"A rabbit named %s has hopped their last hop. The hawks circle.",
		"Soft fur, softer grave. %s the rabbit is now someone's lunch.",
		"The warren feels a vacancy. %s the rabbit has joined the silent majority.",
	],
	"spore": [
		"A spore named %s releases their final puff. The wind scatters their legacy.",
		"From dust to dust, but faster. %s the mushroom collapses into myth.",
		"The mycelium mourns in slow, chemical song. %s the spore is gone.",
	],
}

# ---------------------------------------------------------------------------
# COMBAT KILLS — visceral, dramatic, matchup-specific
# ---------------------------------------------------------------------------
const KILL_POOLS: Dictionary = {
	"wolf->sheep": [
		"A wolf tears into a sheep — %s rips the throat from %s in a crimson spray.",
		"The pack descends. %s the wolf slaughtered %s the sheep before the poor thing could bleat.",
		"Nature is not subtle. %s the wolf devours %s the sheep, wool and all.",
		"A sheep named %s meets a wolf named %s. It was never going to end well.",
	],
	"human->wolf": [
		"A hunter's spear finds its mark. %s the human felled %s the wolf with cold precision.",
		"The pack loses a brother. %s the wolf was cut down by %s the human.",
		"Steel versus sinew. %s the human skinned %s the wolf before breakfast.",
		"A wolf named %s underestimated %s the human. Fatal mistake.",
	],
	"wolf->human": [
		"The hunter becomes the hunted. %s the wolf dragged %s the human into the dark.",
		"A human named %s wandered too far. %s the wolf made sure they never returned.",
		"Teeth versus tactics. %s the wolf overwhelmed %s the human in the tall grass.",
	],
	"human->sheep": [
		"A human named %s easily hunts a sheep. %s didn't see the blade coming.",
		"%s the human needed mutton. %s the sheep was in the wrong field at the wrong time.",
		"The shepherd's crook rises and falls. %s the sheep falls to %s the human.",
	],
	"human->robin": [
		"A sling whirls. %s the human drops %s the robin from the sky.",
		"Small targets are still targets. %s the human collected %s the robin for the pot.",
		"A robin named %s trusted the air. %s the human proved the air is not safe.",
	],
	"human->rabbit": [
		"A snare tightens. %s the human claims %s the rabbit for the stew.",
		"Quick feet, quicker hunger. %s the human outsmarted %s the rabbit.",
	],
	"falcon->robin": [
		"From above, death. %s the falcon stoops and shatters %s the robin mid-flight.",
		"The sky is not big enough for both. %s the falcon devoured %s the robin.",
		"A red breast, a red beak. %s the falcon ended %s the robin's song forever.",
	],
	"falcon->rabbit": [
		"Talons like anchors. %s the falcon plunged into %s the rabbit from the sun.",
		"The rabbit ran. %s the falcon was faster. %s is now lunch.",
	],
	"boar->wolf": [
		"A boar charges with tusks like ivory scythes. %s gored %s the wolf.",
		"The wolf underestimated the pig. %s the boar impaled %s and kept running.",
	],
	"boar->human": [
		"A wall of bristle and rage. %s the boar trampled %s the human into the mud.",
		"The settlement loses a soul. %s the human was gored by %s the boar.",
	],
	"boar->sheep": [
		"Wrong field, wrong boar. %s the boar eviscerated %s the sheep in a blind charge.",
	],
	"boar->boar": [
		"Boar on boar violence. %s murdered %s in a dispute over mud rights.",
	],
	"human->human": [
		"Brother against brother. %s the human slew %s the human over a patch of dirt.",
		"The settlement weeps quietly. %s the human murdered %s the human in cold blood.",
	],
	"generic": [
		"A brutal exchange. %s the %s killed %s the %s in savage combat.",
		"The strong eat the weak. %s the %s devoured %s the %s.",
		"One less soul in the realm. %s the %s ended %s the %s.",
	],
}

# ---------------------------------------------------------------------------
# COMBAT WOUNDS — narrow escapes, bleeding but breathing
# ---------------------------------------------------------------------------
const WOUND_POOLS: Dictionary = {
	"wolf->sheep": [
		"A wolf named %s shredded %s the sheep, but the bleater limped away, trailing wool and blood.",
		"Teeth met fleece. %s the wolf wounded %s the sheep — next time, the feast.",
	],
	"human->wolf": [
		"A spear glanced off hide. %s the human wounded %s the wolf, who limped into the dark.",
		"Steel bit flesh. %s the wolf escaped %s the human, bleeding but alive.",
	],
	"wolf->human": [
		"A wolf named %s mauled %s the human, who staggered back to the walls.",
		"Fangs found flesh. %s the human was wounded by %s the wolf, barely escaping.",
	],
	"human->sheep": [
		"A blade grazed wool. %s the human wounded %s the sheep, who bolted in terror.",
	],
	"falcon->robin": [
		"Feathers flew, but no body fell. %s the falcon wounded %s the robin mid-air.",
		"A near-death experience with talons. %s the robin escaped %s the falcon.",
	],
	"boar->*": [
		"Tusks sliced flesh. %s the boar charged through %s the %s, leaving a bleeding mess.",
		"A bristling missile named %s wounded %s the %s and vanished into the brush.",
	],
	"generic": [
		"A skirmish ends in blood, not death. %s the %s wounded %s the %s.",
		"Claws and cries. %s the %s raked %s the %s, who fled into the undergrowth.",
		"The duel continues. %s the %s bloodied %s the %s, but the kill eludes them.",
	],
}

# ---------------------------------------------------------------------------
# SETTLEMENTS, EXTINCTION, OVERPOPULATION
# ---------------------------------------------------------------------------
const SETTLEMENT_POOL: Array[String] = [
	"A new human settlement rises from the mud! Stonemasons weep with joy.",
	"Hammers ring out. A colony of humans has founded a village where none stood before.",
	"Civilization advances one wall at a time. A new settlement has been built.",
	"The humans have staked their claim. A new village blooms like a stubborn weed.",
]

const EXTINCTION_POOL: Dictionary = {
	"sheep": [
		"SILENCE OF THE LAMBS. No sheep remain. The wolves begin to eye each other.",
		"The last sheep has fallen. The meadows grow eerily quiet.",
	],
	"wolf": [
		"THE PACK IS NO MORE. The wolves are extinct. The sheep throw a party.",
		"The howling has stopped. No wolves remain to haunt the night.",
	],
	"human": [
		"HUMANITY'S LIGHT IS SNUFFED. No settlements stand. Nature reclaims all.",
		"The last human has perished. Their walls crumble, their fires go cold.",
	],
	"falcon": [
		"The skies are free of falcons. The robins sing louder, foolishly.",
	],
	"robin": [
		"No more robins. The worms rejoice, briefly.",
	],
	"boar": [
		"The last boar has died. The mud shall remember them.",
	],
	"worm": [
		"The soil is empty. No worms wriggle in the dark. A quiet apocalypse.",
	],
	"rabbit": [
		"The warrens are silent. No rabbits hop. The hawks go hungry.",
	],
	"spore": [
		"No spores drift. The mycelium has gone quiet. The rot grows lonely.",
	],
	"generic": [
		"EXTINCTION: The %s have vanished from the realm entirely.",
		"GONE. No %s remain to tell their story.",
	],
}

const OVERPOPULATION_POOL: Dictionary = {
	"sheep": [
		"The meadows groan beneath wool. Sheep overpopulation threatens the grass itself.",
		"TOO. MANY. SHEEP. The land is one giant bleating carpet.",
	],
	"wolf": [
		"The pack grows too large. The wolves are eyeing each other with hunger.",
		"Wolf overpopulation: the apex has become the problem.",
	],
	"human": [
		"The settlements spill over. Human overpopulation breeds famine and fury.",
		"Too many mouths, too few walls. Humans are breeding like... well, humans.",
	],
	"falcon": [
		"The sky is crowded. Falcon overpopulation means the robins have no hiding place.",
	],
	"robin": [
		"Robins everywhere. The trees are dripping with them. It's unsettling.",
	],
	"boar": [
		"The boars have formed a parliament. There are too many. Nature trembles.",
	],
	"worm": [
		"The soil is nothing but worms. A squirming, writhing abundance.",
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
# UTILITY
# ---------------------------------------------------------------------------
func _pick(arr: Array) -> String:
	if arr.is_empty():
		return "Something happened."
	return arr[randi() % arr.size()]

func _fmt(template: String, args: Array) -> String:
	return template % args

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
	var pool: Array = KILL_POOLS.get(key, KILL_POOLS.get("generic", []))
	if pool == KILL_POOLS.get("generic", []):
		return _fmt(_pick(pool), [a_name, attacker.capitalize(), t_name, target.capitalize()])
	return _fmt(_pick(pool), [a_name, t_name])

func _flavor_wound(attacker: String, target: String) -> String:
	var a_name: String = NameGenerator.generate(attacker)
	var t_name: String = NameGenerator.generate(target)
	var key: String = "%s->%s" % [attacker, target]
	var pool: Array = WOUND_POOLS.get(key, WOUND_POOLS.get("generic", []))
	if key == "boar->*":
		return _fmt(_pick(pool), [a_name, t_name, target.capitalize()])
	if pool == WOUND_POOLS.get("generic", []):
		return _fmt(_pick(pool), [a_name, attacker.capitalize(), t_name, target.capitalize()])
	return _fmt(_pick(pool), [a_name, t_name])

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

# ---------------------------------------------------------------------------
# LIFECYCLE
# ---------------------------------------------------------------------------
func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	z_index = 100
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

func _process(delta: float) -> void:
	if _events.is_empty():
		_label.modulate = Color(1, 1, 1, 0)
		return
	_display_timer += delta
	if _display_timer >= DISPLAY_TIME:
		_display_timer = 0.0
		_current_index = (_current_index + 1) % _events.size()
		_fade_state = 1.0
		_update_label()
	elif _display_timer >= DISPLAY_TIME - FADE_TIME:
		_fade_state = clampf(1.0 - (_display_timer - (DISPLAY_TIME - FADE_TIME)) / FADE_TIME, 0.0, 1.0)
	elif _display_timer <= FADE_TIME:
		_fade_state = clampf(_display_timer / FADE_TIME, 0.0, 1.0)
	else:
		_fade_state = 1.0
	_label.modulate = Color(1, 1, 1, _fade_state)
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
	_label.text = _events[idx]["text"]

func _add_event(text: String) -> void:
	_events.append({"text": text, "ttl": DISPLAY_TIME * 3.0})
	if _events.size() > MAX_EVENTS:
		if _current_index >= _events.size() - 1:
			_current_index = 0
		_events.remove_at(0)
	if _events.size() == 1:
		_current_index = 0
		_display_timer = FADE_TIME
		_fade_state = 1.0
		_update_label()
	var gc: Node = get_node_or_null("/root/GameConfig")
	if gc != null:
		gc.event_log.append(text)
	var history: EventHistory = get_node_or_null("../EventHistory")
	if history == null:
		history = get_tree().current_scene.get_node_or_null("EventHistory")
	if history != null:
		history.add_entry(text)

func _on_agent_born(species: String, _pos: Vector3, variant: String = "") -> void:
	_add_event(_flavor_birth(species, variant))

func _on_agent_died(species: String, _pos: Vector3) -> void:
	_add_event(_flavor_death(species))

func _on_combat_event(attacker_species: String, target_species: String, _pos: Vector3, killed: bool) -> void:
	if killed:
		_add_event(_flavor_kill(attacker_species, target_species))
	else:
		_add_event(_flavor_wound(attacker_species, target_species))

func _on_settlement_built(_pos: Vector3) -> void:
	_add_event(_flavor_settlement())

func _on_extinction(species: String) -> void:
	_add_event(_flavor_extinction(species))

func _on_overpopulation(species: String) -> void:
	_add_event(_flavor_overpopulation(species))

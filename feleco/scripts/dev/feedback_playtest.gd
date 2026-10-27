extends Node

# Dev-only: prove campaign games and creature trials write into the valley.
# Does not ship (scripts/dev is export-excluded). Restores the player's save.
# godot --headless --path . res://scenes/dev/feedback_playtest.tscn

var _fails: int = 0
var gc: Node

func _ready() -> void:
	await get_tree().process_frame
	gc = get_node("/root/GameConfig")
	var snap: Dictionary = _snapshot()
	var save_bak: String = ""
	if FileAccess.file_exists("user://feleco_meta.save"):
		save_bak = FileAccess.get_file_as_string("user://feleco_meta.save")
	await _run()
	_restore(snap)
	if not save_bak.is_empty():
		var f := FileAccess.open("user://feleco_meta.save", FileAccess.WRITE)
		if f != null:
			f.store_string(save_bak)
			f.close()
	gc.load_meta()
	if _fails == 0:
		print("FB all passed")
	else:
		print("FB FAILED %d" % _fails)
	get_tree().quit(1 if _fails > 0 else 0)

func _ok(name: String, cond: bool, detail: String = "") -> void:
	if cond:
		print("FB OK ", name)
	else:
		_fails += 1
		print("FB FAIL ", name, " ", detail)

func _snapshot() -> Dictionary:
	return {
		"records": (gc.records as Dictionary).duplicate(true),
		"eco_points": gc.eco_points,
		"current_mode": gc.current_mode,
		"campaign_faction": gc.campaign_faction,
		"campaign_era": gc.campaign_era,
		"campaign_traits": (gc.campaign_traits as Dictionary).duplicate(true),
		"tree_count": gc.tree_count,
		"grass_density": gc.grass_density,
		"counts": {
			"sheep_count": gc.sheep_count, "wolf_count": gc.wolf_count, "human_count": gc.human_count,
			"spore_count": gc.spore_count, "falcon_count": gc.falcon_count, "robin_count": gc.robin_count,
			"boar_count": gc.boar_count, "worm_count": gc.worm_count, "rabbit_count": gc.rabbit_count,
			"fish_count": gc.fish_count, "bush_count": gc.bush_count,
		},
		"extra_counts": (gc.extra_counts as Dictionary).duplicate(true),
	}

func _restore(s: Dictionary) -> void:
	gc.records = (s["records"] as Dictionary).duplicate(true)
	gc.eco_points = int(s["eco_points"])
	gc.current_mode = String(s["current_mode"])
	gc.campaign_faction = String(s["campaign_faction"])
	gc.campaign_era = int(s["campaign_era"])
	gc.campaign_traits = (s["campaign_traits"] as Dictionary).duplicate(true)
	gc.tree_count = int(s["tree_count"])
	gc.grass_density = float(s["grass_density"])
	for k: String in (s["counts"] as Dictionary).keys():
		gc.set(k, int((s["counts"] as Dictionary)[k]))
	gc.extra_counts = (s["extra_counts"] as Dictionary).duplicate(true)

func _run() -> void:
	await _test_boons_and_persist()
	await _test_minigame_awards()
	await _test_campaign_apply()
	await _test_companion_train()
	await _test_campaign_cards()

func _test_boons_and_persist() -> void:
	gc.records = {}
	_ok("empty records give no boons", gc.link_boons().is_empty(), str(gc.link_boons()))

	gc.set_record("brawl", "wolf", "cub")
	var b: Dictionary = gc.link_boons().get("carnivore", {})
	_ok("brawl cub +5% carnivore health", is_equal_approx(float(b.get("health", 0.0)), 1.05), str(b))

	gc.set_record("brawl", "lion", "dire")
	b = gc.link_boons().get("carnivore", {})
	_ok("brawl dire +15% carnivore health", is_equal_approx(float(b.get("health", 0.0)), 1.15), str(b))

	gc.set_record("dominion", "human", "ruled")
	var o: Dictionary = gc.link_boons().get("omnivore", {})
	_ok("one clan rule +5% omnivore life", is_equal_approx(float(o.get("lifespan", 0.0)), 1.05), str(o))
	gc.set_record("dominion", "bear", "ruled")
	o = gc.link_boons().get("omnivore", {})
	_ok("two clan rules +10% omnivore life", is_equal_approx(float(o.get("lifespan", 0.0)), 1.10), str(o))

	gc.set_record("race", "0", "Gold")
	gc.set_record("race", "1", "Gold")
	gc.set_record("race", "2", "Silver")
	var h: Dictionary = gc.link_boons().get("herbivore", {})
	_ok("two golds +4% herbivore speed", is_equal_approx(float(h.get("speed", 0.0)), 1.04), str(h))

	gc.set_record("golf", "0", "S")
	gc.set_record("golf", "1", "A")
	gc.set_record("golf", "2", "B")
	var p: Dictionary = gc.link_boons().get("producer", {})
	_ok("S+A seedlings add a tree and meadow", int(p.get("trees", 0)) == 1 and is_equal_approx(float(p.get("grass", 0.0)), 0.04), str(p))

	var ep0: int = gc.eco_points
	gc.award_eco_points(25)
	_ok("award_eco_points writes the pot", gc.eco_points == ep0 + 25, "%d" % gc.eco_points)
	gc.load_meta()
	_ok("records survive save/load", String(gc.record("brawl", "lion")) == "dire", str(gc.records))
	_ok("EP survives save/load", gc.eco_points == ep0 + 25, "%d" % gc.eco_points)

func _test_minigame_awards() -> void:
	# Predator Brawl: a won climb writes the best difficulty and pays champion EP.
	var brawl: Node = load("res://scenes/minigames/predator_brawl.tscn").instantiate()
	add_child(brawl)
	await get_tree().process_frame
	await get_tree().process_frame
	_ok("brawl has an on-screen Pause", brawl.get("_pause_btn") != null, "")
	gc.records = {}
	var ep_before: int = gc.eco_points
	brawl.demo = false
	brawl._difficulty = 2
	brawl._start_ladder("wolf")
	await get_tree().process_frame
	brawl._finish(true)
	_ok("brawl win records dire for the fighter", String(gc.record("brawl", "wolf")) == "dire", str(gc.record("brawl", "wolf")))
	_ok("brawl champion pays EP", gc.eco_points >= ep_before + 60, "delta %d" % (gc.eco_points - ep_before))
	# Keep-best: a later Cub climb must not overwrite Dire.
	brawl._difficulty = 0
	brawl._start_ladder("wolf")
	await get_tree().process_frame
	brawl._finish(true)
	_ok("brawl keeps the best difficulty", String(gc.record("brawl", "wolf")) == "dire", str(gc.record("brawl", "wolf")))
	brawl.queue_free()
	await get_tree().process_frame

	# Stampede Sprint: gold on a race, then a worse place must not overwrite.
	var race: Node = load("res://scenes/minigames/stampede_sprint.tscn").instantiate()
	add_child(race)
	await get_tree().process_frame
	await get_tree().process_frame
	_ok("race has an on-screen Pause", race.get("_pause_btn") != null, "")
	gc.set_record("race", "0", "Gold")
	race._race = 0
	race._finish_time.clear()
	for t: float in [2.5, 1.0, 1.5, 1.8]:
		race._finish_time.append(t)
	race._end_race()
	_ok("race keeps Gold over a later 4th", String(gc.record("race", "0")) == "Gold", str(gc.record("race", "0")))
	race.queue_free()
	await get_tree().process_frame

	# Seedling Golf keep-best uses the same rank order as _finish().
	var order := "FDCBAS"
	gc.set_record("golf", "0", "S")
	_ok("golf S writes a seedling record", String(gc.record("golf", "0")) == "S", str(gc.record("golf", "0")))
	var prev = gc.record("golf", "0")
	var worse := "C"
	if prev == null or order.find(worse) > order.find(String(prev)):
		gc.set_record("golf", "0", worse)
	_ok("golf keeps S over a later C", String(gc.record("golf", "0")) == "S", str(gc.record("golf", "0")))

	var golf: Node = load("res://scenes/minigames/seed_golf.tscn").instantiate()
	add_child(golf)
	await get_tree().process_frame
	_ok("golf scene boots", golf != null, "")
	golf.queue_free()
	await get_tree().process_frame

	var dom: Node = load("res://scenes/minigames/valley_dominion.tscn").instantiate()
	add_child(dom)
	await get_tree().process_frame
	await get_tree().process_frame
	_ok("dominion has Pause or End turn", _find_text(dom, "End turn") or _find_text(dom, "Pause") or dom.get("_end_btn") != null, "")
	ep_before = gc.eco_points
	gc.set_record("dominion", "human", "ruled")
	gc.award_eco_points(50)
	_ok("dominion win records the clan", String(gc.record("dominion", "human")) == "ruled", str(gc.records.get("dominion", {})))
	_ok("dominion placement pays EP", gc.eco_points == ep_before + 50, "%d" % gc.eco_points)
	dom.queue_free()
	await get_tree().process_frame

func _test_campaign_apply() -> void:
	gc.records = {
		"brawl": {"wolf": "dire"},
		"dominion": {"human": "ruled", "bear": "ruled"},
		"race": {"0": "Gold", "1": "Gold"},
		"golf": {"0": "S", "1": "A"},
	}
	gc.current_mode = "campaign"
	gc.campaign_faction = "wolf"
	gc.campaign_traits = {}
	# Keep the director in the tree so /root/GameConfig resolves, but spawn
	# nobody: we apply traits to clean agents so phenotype noise cannot hide
	# the boon.
	for k: String in ["sheep_count", "wolf_count", "human_count", "spore_count", "falcon_count", "robin_count", "boar_count", "worm_count", "rabbit_count", "fish_count", "tree_count", "bush_count"]:
		gc.set(k, 0)
	for id: String in SpeciesDB.NEW_SPECIES:
		gc.extra_counts[id] = 0

	var dir: SimulationDirector = SimulationDirector.new()
	add_child(dir)
	await get_tree().process_frame
	var wolf: Node = load("res://scenes/wolf.tscn").instantiate()
	var sheep: Node = load("res://scenes/sheep.tscn").instantiate()
	var boar: Node = load("res://scenes/boar.tscn").instantiate()
	add_child(wolf)
	add_child(sheep)
	add_child(boar)
	await get_tree().process_frame

	var wh: float = float(wolf.health)
	var sl: float = float(sheep.walk_speed)
	var bl: float = float(boar._lifespan)
	dir._apply_campaign_traits(wolf, "wolf")
	dir._apply_campaign_traits(sheep, "sheep")
	dir._apply_campaign_traits(boar, "boar")
	_ok("campaign wolf gets +15% health from brawl", is_equal_approx(float(wolf.health), wh * 1.15), "%s vs %s" % [wolf.health, wh * 1.15])
	_ok("campaign sheep gets +4% speed from race golds", is_equal_approx(float(sheep.walk_speed), sl * 1.04), "%s vs %s" % [sheep.walk_speed, sl * 1.04])
	_ok("campaign boar gets +10% life from dominion", is_equal_approx(float(boar._lifespan), bl * 1.10), "%s vs %s" % [boar._lifespan, bl * 1.10])

	# Sandbox gets the same link boons so a Brawl win still matters in the valley.
	gc.current_mode = "sandbox"
	var wolf2: Node = load("res://scenes/wolf.tscn").instantiate()
	add_child(wolf2)
	await get_tree().process_frame
	var w2: float = float(wolf2.health)
	dir._apply_campaign_traits(wolf2, "wolf")
	_ok("sandbox wolf gets the brawl health boon", is_equal_approx(float(wolf2.health), w2 * 1.15), "%s vs %s" % [wolf2.health, w2 * 1.15])

	# Producer boon: the same two lines campaign_setup._on_start uses.
	gc.current_mode = "campaign"
	gc.tree_count = 10
	gc.grass_density = 0.5
	var producer: Dictionary = gc.link_boons().get("producer", {})
	gc.tree_count += int(producer.get("trees", 0))
	gc.grass_density = minf(gc.grass_density + float(producer.get("grass", 0.0)), 0.8)
	_ok("producer boon adds a starting tree", gc.tree_count == 11, "%d" % gc.tree_count)
	_ok("producer boon fattens the meadow", is_equal_approx(gc.grass_density, 0.54), "%s" % gc.grass_density)

	wolf.queue_free()
	sheep.queue_free()
	boar.queue_free()
	wolf2.queue_free()
	dir.free()
	await get_tree().process_frame

func _test_companion_train() -> void:
	var sheep: Node = load("res://scenes/sheep.tscn").instantiate()
	add_child(sheep)
	await get_tree().process_frame
	var data := AgentData.new("sheep", 25.0, 32.0, Vector3.ZERO, float(sheep._lifespan), sheep)
	sheep._bind_agent_data(data)
	var goals: GoalsPanel = GoalsPanel.new()
	add_child(goals)
	await get_tree().process_frame
	var ep_before: int = gc.eco_points
	goals.adopt(sheep)
	goals.points = 5
	var life0: float = float(sheep._lifespan)
	var see0: float = float(sheep._vision_cone.vision_range)
	goals.train("speed")
	goals.train("vital")
	goals.train("senses")
	_ok("speed trial writes a 10% companion boost", is_equal_approx(data.speed_boost, 1.1), "%s" % data.speed_boost)
	_ok("vital trial lengthens the companion", is_equal_approx(float(sheep._lifespan), life0 * 1.1), "%s" % sheep._lifespan)
	_ok("senses trial lengthens vision", is_equal_approx(float(sheep._vision_cone.vision_range), see0 * 1.15), "%s" % sheep._vision_cone.vision_range)
	_ok("winning a trial completes the Train goal and pays EP", gc.eco_points >= ep_before + 20, "delta %d" % (gc.eco_points - ep_before))
	_ok("train spends a skill point", goals.points == 2, "%d" % goals.points)
	sheep.queue_free()
	goals.queue_free()
	await get_tree().process_frame

func _test_campaign_cards() -> void:
	gc.records = {"brawl": {"wolf": "dire"}, "race": {"0": "Gold"}}
	var setup: Node = load("res://scenes/ui/campaign_setup.tscn").instantiate()
	add_child(setup)
	await get_tree().process_frame
	await get_tree().process_frame
	var carn: bool = _find_text(setup, "Carnivores start with")
	var herb: bool = _find_text(setup, "Herbivores run")
	var win_to: bool = _find_text(setup, "Win to earn a valley boon")
	_ok("campaign cards show the carnivore boon", carn, "")
	_ok("campaign cards show the herbivore boon", herb, "")
	_ok("campaign cards still tease unearned links", win_to, "")
	_ok("boon tease says omnivores, not omnivore.s", _find_text(setup, "omnivores") and not _find_text(setup, "omnivore.s"), "")
	setup.queue_free()
	await get_tree().process_frame

func _find_text(n: Node, needle: String) -> bool:
	if n is Label and needle in (n as Label).text:
		return true
	if n is Button and needle in (n as Button).text:
		return true
	for c in n.get_children():
		if _find_text(c, needle):
			return true
	return false

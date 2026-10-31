extends Node

# The year's lesson quiets the valley by disabling every species on the shared
# config. Leaving must put that cast back, or Begin the year spawns nobody.
#   godot --headless --path feleco res://scenes/dev/lore_cast_test.tscn

const Lore = preload("res://scripts/ui/lore_film.gd")

var _fails: int = 0

func _ready() -> void:
	_run.call_deferred()

func _ok(what: String, cond: bool, detail: String = "") -> void:
	print(("OK " if cond else "FAIL ") + what + (" " + detail if not detail.is_empty() else ""))
	if not cond:
		_fails += 1

func _run() -> void:
	var gc: Node = get_node("/root/GameConfig")
	# A fresh Main Game: nothing is switched off, and the plant counts are the defaults.
	gc.disabled_species.clear()
	gc.tree_count = 10
	gc.bush_count = 5
	gc.grass_density = 0.5
	var saved: Dictionary = Lore.quiet_valley(gc)
	_ok("lesson disables every species", gc.disabled_species.size() == SpeciesDB.ROWS.size() and gc.disabled_species.has("sheep") and gc.disabled_species.has("lion"))
	_ok("lesson keeps the saved cast", (saved["disabled"] as Array).is_empty(), str((saved["disabled"] as Array).size()))
	_ok("lesson uses its own plants", gc.tree_count == 8 and gc.bush_count == 4 and is_equal_approx(gc.grass_density, 0.6))
	Lore.restore_valley(gc, saved)
	_ok("begin the year restores an empty cast", gc.disabled_species.is_empty(), str(gc.disabled_species))
	_ok("begin the year restores the plants", gc.tree_count == 10 and gc.bush_count == 5 and is_equal_approx(gc.grass_density, 0.5))
	# Back to the menu must not leave the setup board with every species off,
	# and must not forget a species the player had already switched off.
	gc.disabled_species = ["wolf"]
	gc.tree_count = 12
	gc.bush_count = 7
	gc.grass_density = 0.35
	saved = Lore.quiet_valley(gc)
	_ok("saved list survives the clear", (saved["disabled"] as Array).size() == 1 and (saved["disabled"] as Array).has("wolf"))
	Lore.restore_valley(gc, saved)
	_ok("menu return keeps the prior cast", gc.disabled_species.size() == 1 and gc.disabled_species.has("wolf") and not gc.disabled_species.has("sheep"), str(gc.disabled_species))
	_ok("menu return keeps the prior plants", gc.tree_count == 12 and gc.bush_count == 7 and is_equal_approx(gc.grass_density, 0.35))
	gc.disabled_species.clear()
	print("LORE CAST %s" % ("FAIL %d" % _fails if _fails > 0 else "OK"))
	get_tree().quit(1 if _fails > 0 else 0)

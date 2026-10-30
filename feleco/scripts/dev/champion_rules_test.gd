extends SceneTree

# The year-end winner is a food-web group. Campaign progress used to compare
# that to a species plural, so a won year reset the era. This locks the match.

func _init() -> void:
	var script: GDScript = load("res://scripts/ui/resolution_screen.gd") as GDScript
	if script == null:
		print("FAIL could not load resolution screen")
		quit(1)
		return
	var screen = script.new()
	var cases: Array = [
		["sheep", "herbivore", true],
		["wolf", "carnivore", true],
		["Wolves", "carnivore", true],
		["human", "omnivore", true],
		["Humans", "omnivore", true],
		["falcon", "carnivore", true],
		["rabbit", "herbivore", true],
		["boar", "omnivore", true],
		["worm", "decomposer", true],
		["deer", "herbivore", true],
		["bear", "omnivore", true],
		["lion", "carnivore", true],
		["beetle", "decomposer", true],
		["mouse", "omnivore", true],
		["herbivore", "herbivore", true],
		["sheep", "carnivore", false],
		["wolf", "herbivore", false],
		["", "herbivore", false],
		["sheep", "", false],
		["fish", "herbivore", false],
	]
	var failed := 0
	for row: Array in cases:
		var got: bool = screen._champion_rules(str(row[0]), str(row[1]))
		if got != bool(row[2]):
			failed += 1
			print("FAIL %s vs %s -> %s, wanted %s" % [row[0], row[1], got, row[2]])
	if failed > 0:
		print("%d champion-rule checks failed" % failed)
		quit(1)
		return
	print("OK %d champion-rule checks" % cases.size())
	quit()

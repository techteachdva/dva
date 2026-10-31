extends SceneTree

func _init() -> void:
	var paths: Array[String] = [
		"res://scripts/game/kitchen.gd",
		"res://scripts/visuals/cooked_food_art.gd",
		"res://scripts/world/riverweeds.gd",
		"res://scripts/world/river.gd",
		"res://scripts/agents/human.gd",
		"res://scripts/agents/critter.gd",
		"res://scripts/agents/lion.gd",
		"res://scripts/agents/bear.gd",
		"res://scripts/combat_system.gd",
		"res://scripts/simulation_director.gd",
		"res://scripts/ui/field_guide.gd",
	]
	var ok := true
	for path: String in paths:
		var s: Script = load(path)
		if s == null:
			print("PARSE ERROR: ", path)
			ok = false
		else:
			print("OK: ", path)
	if ok:
		CookedFoodArt.export_vectors(ProjectSettings.globalize_path("res://assets/food"))
		print("EXPORTED FOOD ART")
	quit(0 if ok else 1)

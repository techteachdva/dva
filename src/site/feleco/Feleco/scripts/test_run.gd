extends SceneTree
func _init():
	var scripts := [
		"res://scripts/effects/fx_manager.gd",
		"res://scripts/effects/floating_text.gd",
		"res://scripts/effects/fx_bridge.gd",
		"res://scripts/simulation_director.gd",
		"res://scripts/combat_system.gd",
		"res://scripts/agents/sheep.gd",
		"res://scripts/agents/wolf.gd",
		"res://scripts/agents/human.gd",
		"res://scripts/agents/falcon.gd",
		"res://scripts/agents/robin.gd",
		"res://scripts/agents/boar.gd",
		"res://scripts/agents/worm.gd",
	]
	for s in scripts:
		var _r = load(s)
		print("OK: " + s)
	print("All scripts loaded OK")
	quit()

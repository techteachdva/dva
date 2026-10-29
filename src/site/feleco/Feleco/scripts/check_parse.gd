extends SceneTree

func _init():
	var scripts = [
		"res://scripts/ui/resolution_screen.gd",
		"res://scripts/ui/campaign_setup.gd",
		"res://scripts/ui/challenge_setup.gd",
		"res://scripts/ui/greenhouse_shop.gd",
		"res://scripts/ui/simulation_hud.gd",
		"res://scripts/autoloads/game_config.gd",
		"res://scripts/simulation_director.gd",
	]
	var ok = true
	for path in scripts:
		var s = load(path)
		if s == null:
			print("PARSE ERROR: " + path)
			ok = false
		else:
			print("OK: " + path)
	if ok:
		print("ALL SCRIPTS PARSED OK")
		quit(0)
	else:
		quit(1)

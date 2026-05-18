extends SceneTree

func _initialize() -> void:
	print("[Regen] Generating World 3 levels...")
	for level: int in range(1, 7):
		var data: Dictionary = LevelFactory.generate(3, level)
		LevelFactory.save_to_file(3, level, data)
		print("[Regen] Saved 3-%d" % level)
	print("[Regen] Done.")
	quit()

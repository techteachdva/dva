extends SceneTree

func _initialize() -> void:
	for world: int in [3, 4]:
		print("[Regen] Generating World %d levels..." % world)
		for level: int in range(1, 7):
			var data: Dictionary = LevelFactory.generate(world, level)
			LevelFactory.save_to_file(world, level, data)
			print("[Regen] Saved %d-%d" % [world, level])
		# Bonus level
		var bonus: Dictionary = LevelFactory.generate_bonus(world)
		LevelFactory.save_bonus_to_file(world, bonus)
		print("[Regen] Saved B-%d" % world)
	print("[Regen] Done.")
	quit()

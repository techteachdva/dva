extends SceneTree

## Regenerate B-1 … B-6 using LevelFactory.generate_bonus (same rules as main levels).
## Run: godot --headless --path . -s res://tools/regen_bonus_levels.gd

const BONUS_SEEDS: Dictionary = {1: 201, 2: 202, 3: 203, 4: 204, 5: 205, 6: 206}

func _init() -> void:
	for world: int in range(1, 7):
		var data: Dictionary = LevelFactory.generate_bonus(world, BONUS_SEEDS.get(world, 200 + world))
		LevelFactory.save_bonus_to_file(world, data)
		var segs: int = data.get("segments", []).size()
		var hoops: int = data.get("checkpoints", []).size()
		var finish_z: float = float(data.get("finish_z", 0.0))
		var min_cp: float = 0.0
		for z: Variant in data.get("checkpoints", []):
			min_cp = minf(min_cp, float(z)) if min_cp == 0.0 else minf(min_cp, float(z))
		print(
			"B-%d: segs=%d hoops=%d finish_z=%.1f min_hoop_z=%.1f ok=%s"
			% [world, segs, hoops, finish_z, min_cp, str(min_cp >= finish_z + 10.0)]
		)
	print("Bonus levels regenerated.")
	quit()

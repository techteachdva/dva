extends SceneTree

func _init() -> void:
	for path: String in ["res://scripts/visuals/creature_sprite.gdshader", "res://scripts/visuals/creature_sprite_2d.gdshader", "res://scripts/ui/tuning_lab.gd", "res://scripts/ui/brand_studio.gd", "res://scripts/game/brand_book.gd"]:
		var res: Resource = load(path)
		print(path, " ", "OK" if res != null else "FAIL")
	quit(0)

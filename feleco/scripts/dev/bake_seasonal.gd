extends SceneTree

# Dev: paint the Seasonal Sprite sheets into assets/sprites/.
#   godot --headless --path . -s res://scripts/dev/bake_seasonal.gd

func _initialize() -> void:
	SpriteGenerator.bake_all(ProjectSettings.globalize_path(SpriteGenerator.SPRITE_DIR), Array(SpeciesDB.SEASONAL))
	quit()

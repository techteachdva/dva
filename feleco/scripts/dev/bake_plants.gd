extends SceneTree

# Dev: bake only the producer icons and plant textures.
#   godot --path . -s res://scripts/dev/bake_plants.gd

func _initialize() -> void:
	SpriteGenerator.bake_plants(ProjectSettings.globalize_path(SpriteGenerator.SPRITE_DIR))
	quit()

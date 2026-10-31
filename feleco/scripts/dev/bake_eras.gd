extends SceneTree

# Dev: paint the Lost Valley sheets, every frame of every kind and sex.
#   godot --headless --path . -s res://scripts/dev/bake_eras.gd

func _initialize() -> void:
	var dir := ProjectSettings.globalize_path("res://assets/sprites/lost")
	SpriteGenerator.bake_era("lost", dir)
	print("LOST SHEETS ", dir)
	quit()

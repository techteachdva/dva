extends SceneTree

# Dev: paint the Lost Valley sheets, every frame of every kind and sex.
#   godot --headless --path . -s res://scripts/dev/bake_eras.gd [-- falcon worm]

func _initialize() -> void:
	var dir := ProjectSettings.globalize_path("res://assets/sprites/lost")
	SpriteGenerator.bake_era("lost", dir, Array(OS.get_cmdline_user_args()))
	print("LOST SHEETS ", dir)
	quit()

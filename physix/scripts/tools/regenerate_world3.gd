@tool
extends Node

# Attach this to any node in the editor, then click "Regenerate World 3"
# in the Inspector to overwrite 3-1 through 3-6 with fresh factory layouts.

@export_tool_button("Regenerate World 3") var _btn: Callable = _run

func _run() -> void:
	print("[Regen] Generating World 3 levels...")
	for level: int in range(1, 7):
		var data: Dictionary = LevelFactory.generate(3, level)
		LevelFactory.save_to_file(3, level, data)
	print("[Regen] Done. 6 files written to res://levels/")

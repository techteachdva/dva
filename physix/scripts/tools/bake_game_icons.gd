@tool
extends EditorScript
## Run from Editor > Run Script to write PNG icons into assets/icons/.


func _run() -> void:
	for kind in ["heart", "star", "star_empty", "coin", "lock"]:
		var path := "res://assets/icons/%s.png" % kind
		var err := GameIconPainter.make_image(kind).save_png(path)
		if err != OK:
			push_error("Failed to save %s (err %d)" % [path, err])
		else:
			print("Saved ", path)
	for kind in ["play", "resume", "custom", "editor", "credits", "shop", "options", "quit"]:
		var file_name := "menu_continue.png" if kind == "resume" else "menu_%s.png" % kind
		var path := "res://assets/icons/%s" % file_name
		var err := GameIconPainter.make_menu_image(kind).save_png(path)
		if err != OK:
			push_error("Failed to save %s (err %d)" % [path, err])
		else:
			print("Saved ", path)
	print("Done. Reimport assets/icons in Godot.")

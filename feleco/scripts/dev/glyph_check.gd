extends SceneTree

# Dev check: which non-ASCII characters used in scripts are missing from the
# game's bundled fonts (the web build has no system fallback fonts).
# godot --headless --path . -s res://scripts/dev/glyph_check.gd
func _initialize() -> void:
	var fonts: Array = [load("res://assets/fonts/Nunito.ttf"), load("res://assets/fonts/Fredoka.ttf")]
	var used: Dictionary = {}
	for dir: String in ["res://scripts/ui", "res://scripts", "res://scripts/game", "res://scripts/effects", "res://scripts/agents", "res://scripts/ecs", "res://scripts/names", "res://scripts/world", "res://scripts/autoloads"]:
		for f: String in DirAccess.get_files_at(dir):
			if not f.ends_with(".gd"):
				continue
			var txt: String = FileAccess.get_file_as_string(dir + "/" + f)
			for i: int in txt.length():
				var c: int = txt.unicode_at(i)
				if c > 127:
					used[c] = used.get(c, []) + [f] if not used.has(c) or not used[c].has(f) else used[c]
	for c: int in used.keys():
		var miss: Array = []
		for k: int in fonts.size():
			if not fonts[k].has_char(c):
				miss.append(["Nunito", "Fredoka"][k])
		if not miss.is_empty():
			print("MISSING ", String.chr(c), " U+%04X in " % c, miss, " used in ", used[c])
	quit()

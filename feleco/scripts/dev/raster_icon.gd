extends SceneTree

# Dev-only: renders icon.svg to the PWA PNGs.
# godot --headless --path . -s res://scripts/dev/raster_icon.gd
func _init() -> void:
	var svg: String = FileAccess.get_file_as_string("res://icon.svg")
	for size: int in [144, 180, 512]:
		var img := Image.new()
		img.load_svg_from_string(svg, float(size) / 512.0)
		img.save_png("res://assets/pwa/icon_%d.png" % size)
	quit()

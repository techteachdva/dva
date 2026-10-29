extends SceneTree

# Dev: every cursor, side by side, for checking the art.
#   godot --path . -s res://scripts/dev/cursor_sheet.gd -- <out png>

func _initialize() -> void:
	var out: String = OS.get_cmdline_user_args()[0]
	var n: int = Cosmetics.CURSORS.size()
	var sheet := Image.create(64 * n, 64, false, Image.FORMAT_RGBA8)
	sheet.fill(Color(0.2, 0.32, 0.18))
	for i: int in n:
		var img: Image = Cosmetics.cursor_texture(Cosmetics.CURSORS[i][0]).get_image()
		sheet.blend_rect(img, Rect2i(0, 0, 48, 48), Vector2i(i * 64 + 8, 8))
	sheet.save_png(out)
	quit()
